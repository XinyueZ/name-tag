import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'
import {
  API_MODEL_PATH,
  API_MODEL_STATUS_PATH,
  API_ORT_PREFIX,
  FASTSAM_MODEL_FILENAME,
  FASTSAM_REMOTE_URL,
  ORT_ASSET_FILES,
  type ModelStatusResponse,
} from './invariant'

export const name = '@deepseek-ai/dsh-client-name-tag'

interface ConnectionFetchRoute {
  readonly path: string
  readonly methods: readonly string[]
  readonly requestBody: 'buffered' | 'streaming'
  readonly fetch: (request: Request) => Promise<Response>
}

interface ConnectionLike {
  readonly fetch: {
    register(route: ConnectionFetchRoute): () => Promise<void> | void
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    connection?: ConnectionLike
  }
}

/**
 * NameTagHostServer: Stateless read-only static mirror for ONNX Runtime Web WASM assets
 * and public FastSAM-s weights. Holds zero user data, zero preferences, and zero vectors.
 */
export class NameTagHostServer {
  private readonly pluginRoot: string
  private inFlightDownload: Promise<string> | null = null

  public constructor(pluginRoot?: string) {
    this.pluginRoot = pluginRoot ?? NameTagHostServer.resolvePluginRoot()
  }

  public static resolvePluginRoot(): string {
    const require = createRequire(import.meta.url)
    return dirname(require.resolve('../package.json'))
  }

  public static resolveCacheDir(): string {
    const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
    return join(dshHome, 'cache', 'name-tag')
  }

  public static resolveCacheFilePath(): string {
    return join(NameTagHostServer.resolveCacheDir(), FASTSAM_MODEL_FILENAME)
  }

  public static resolveBundledModelPath(pluginRoot: string): string {
    return join(pluginRoot, 'models', FASTSAM_MODEL_FILENAME)
  }

  public static resolveOrtDistDir(): string | null {
    try {
      const require = createRequire(import.meta.url)
      const wasmPath = require.resolve('onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm')
      return dirname(wasmPath)
    } catch {
      return null
    }
  }

  public static mimeTypeFor(filename: string): string {
    if (filename.endsWith('.wasm')) return 'application/wasm'
    if (filename.endsWith('.mjs') || filename.endsWith('.js')) {
      return 'application/javascript; charset=utf-8'
    }
    return 'application/octet-stream'
  }

  public static async statIfExists(filePath: string): Promise<number | null> {
    try {
      const info = await stat(filePath)
      if (!info.isFile() || info.size <= 0) return null
      return info.size
    } catch {
      return null
    }
  }

  public async findExistingLocalModel(): Promise<{ path: string; sizeBytes: number } | null> {
    const candidates = [
      NameTagHostServer.resolveBundledModelPath(this.pluginRoot),
      NameTagHostServer.resolveCacheFilePath(),
    ]
    for (const candidate of candidates) {
      const sizeBytes = await NameTagHostServer.statIfExists(candidate)
      if (sizeBytes !== null) {
        return { path: candidate, sizeBytes }
      }
    }
    return null
  }

  public async getModelStatus(): Promise<ModelStatusResponse> {
    const existing = await this.findExistingLocalModel()
    const cachePath = NameTagHostServer.resolveCacheFilePath()
    return {
      exists: existing !== null,
      filename: FASTSAM_MODEL_FILENAME,
      sizeBytes: existing?.sizeBytes ?? 0,
      cachePath: existing?.path ?? cachePath,
      remoteUrl: FASTSAM_REMOTE_URL,
    }
  }

  private async ensureModelOnDisk(): Promise<{ path: string; source: 'local-disk' | 'remote-lazyload' }> {
    const existing = await this.findExistingLocalModel()
    if (existing !== null) {
      return { path: existing.path, source: 'local-disk' }
    }
    if (this.inFlightDownload === null) {
      this.inFlightDownload = this.downloadModelAtomically().finally(() => {
        this.inFlightDownload = null
      })
    }
    const downloadedPath = await this.inFlightDownload
    return { path: downloadedPath, source: 'remote-lazyload' }
  }

  private async downloadModelAtomically(): Promise<string> {
    const destPath = NameTagHostServer.resolveCacheFilePath()
    const tmpPath = destPath + '.tmp-' + process.pid + '-' + Date.now()
    await mkdir(dirname(destPath), { recursive: true })
    const response = await fetch(FASTSAM_REMOTE_URL, { redirect: 'follow' })
    if (!response.ok || response.body === null) {
      throw new Error('Failed to download ' + FASTSAM_MODEL_FILENAME + ': HTTP ' + response.status)
    }
    try {
      const writer = createWriteStream(tmpPath)
      const reader = response.body.getReader()
      await new Promise<void>((resolveWrite, rejectWrite) => {
        writer.on('error', rejectWrite)
        const pump = async (): Promise<void> => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                writer.end(() => resolveWrite())
                return
              }
              if (value !== undefined && !writer.write(Buffer.from(value))) {
                await new Promise<void>((drainResolve) => {
                  writer.once('drain', drainResolve)
                })
              }
            }
          } catch (err) {
            rejectWrite(err)
          }
        }
        void pump()
      })
      await rename(tmpPath, destPath)
      return destPath
    } catch (error) {
      await unlink(tmpPath).catch(() => {})
      throw error
    }
  }

  private static createFileResponse(
    filePath: string,
    sizeBytes: number,
    headersExtra?: Record<string, string>,
  ): Response {
    const nodeStream = createReadStream(filePath)
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
    return new Response(webStream, {
      status: 200,
      headers: {
        'content-type': NameTagHostServer.mimeTypeFor(filePath),
        'content-length': String(sizeBytes),
        'cache-control': 'public, max-age=86400',
        ...headersExtra,
      },
    })
  }

  public register(ctx: Context): void {
    ctx.inject(['connection'], (connCtx) => {
      const connection = connCtx.connection
      if (connection === undefined) return

      connCtx.effect(() => connection.fetch.register({
        path: API_MODEL_STATUS_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (): Promise<Response> => {
          const status = await this.getModelStatus()
          return Response.json(status, { headers: { 'cache-control': 'no-store' } })
        },
      }), 'name-tag: /api model status route')

      connCtx.effect(() => connection.fetch.register({
        path: API_MODEL_PATH,
        methods: ['GET', 'HEAD'],
        requestBody: 'buffered',
        fetch: async (request: Request): Promise<Response> => {
          if (request.method === 'HEAD') {
            const existing = await this.findExistingLocalModel()
            if (existing === null) return new Response(null, { status: 404 })
            return new Response(null, {
              status: 200,
              headers: {
                'content-type': 'application/octet-stream',
                'content-length': String(existing.sizeBytes),
                'x-nametag-model-source': 'local-disk',
              },
            })
          }
          try {
            const { path: modelPath, source } = await this.ensureModelOnDisk()
            const sizeBytes = await NameTagHostServer.statIfExists(modelPath)
            if (sizeBytes === null) {
              return Response.json({ error: 'Cached model file is empty or unreadable.' }, { status: 500 })
            }
            return NameTagHostServer.createFileResponse(modelPath, sizeBytes, {
              'x-nametag-model-source': source,
              'cache-control': 'no-store',
            })
          } catch (error: unknown) {
            return Response.json(
              { error: error instanceof Error ? error.message : String(error) },
              { status: 502, headers: { 'cache-control': 'no-store' } },
            )
          }
        },
      }), 'name-tag: /api model lazy-load route')

      const ortDistDir = NameTagHostServer.resolveOrtDistDir()
      if (ortDistDir !== null) {
        for (const filename of ORT_ASSET_FILES) {
          const assetPath = resolve(ortDistDir, filename)
          if (!existsSync(assetPath)) continue
          connCtx.effect(() => connection.fetch.register({
            path: API_ORT_PREFIX + filename,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async (): Promise<Response> => {
              const sizeBytes = await NameTagHostServer.statIfExists(assetPath)
              if (sizeBytes === null) return new Response('Not Found', { status: 404 })
              return NameTagHostServer.createFileResponse(assetPath, sizeBytes)
            },
          }), 'name-tag: /api ort asset ' + filename)
        }
      }
    })
  }
}

export function apply(ctx: Context): void {
  const server = new NameTagHostServer()
  server.register(ctx)
}
