import { API_MODEL_PATH, API_MODEL_STATUS_PATH, FASTSAM_MODEL_FILENAME, type ModelStatusResponse } from '../../invariant'

export type ModelLoadSource = 'indexeddb' | 'local-disk' | 'remote-lazyload' | 'local-file'

export interface LoadedModelArtifact {
  readonly buffer: ArrayBuffer
  readonly source: ModelLoadSource
}

export type ModelProgressCallback = (loadedBytes: number, totalBytes: number) => void

interface TransportGlobal {
  __DSH_TRANSPORT__?: {
    fetch?: (input: string, init?: RequestInit) => Promise<Response>
  }
}

/**
 * ModelCacheStore: OOP IndexedDB + DSH Host lazy-load repository for FastSAM-s.onnx.
 * Checks browser local cache first; only fetches from Host/Remote when absent.
 */
export class ModelCacheStore {
  private static readonly DB_NAME = 'dsh-name-tag-models'
  private static readonly DB_VERSION = 1
  private static readonly STORE_NAME = 'models'
  private readonly modelKey: string

  public constructor(modelKey = FASTSAM_MODEL_FILENAME) {
    this.modelKey = modelKey
  }

  private static getCarrierFetch(): (input: string, init?: RequestInit) => Promise<Response> {
    const custom = (globalThis as unknown as TransportGlobal).__DSH_TRANSPORT__?.fetch
    if (custom !== undefined) return custom
    return (input, init) => globalThis.fetch(input, init)
  }

  private static openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable in this environment'))
        return
      }
      const request = indexedDB.open(ModelCacheStore.DB_NAME, ModelCacheStore.DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(ModelCacheStore.STORE_NAME)) {
          db.createObjectStore(ModelCacheStore.STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })
  }

  public async getFromIndexedDb(): Promise<ArrayBuffer | null> {
    try {
      const db = await ModelCacheStore.openDb()
      return await new Promise<ArrayBuffer | null>((resolve, reject) => {
        const tx = db.transaction(ModelCacheStore.STORE_NAME, 'readonly')
        const store = tx.objectStore(ModelCacheStore.STORE_NAME)
        const req = store.get(this.modelKey)
        req.onsuccess = () => {
          const res = req.result
          db.close()
          if (res instanceof ArrayBuffer && res.byteLength > 0) {
            resolve(res)
          } else {
            resolve(null)
          }
        }
        req.onerror = () => {
          db.close()
          reject(req.error ?? new Error('IndexedDB read failed'))
        }
      })
    } catch {
      return null
    }
  }

  public async saveToIndexedDb(buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await ModelCacheStore.openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ModelCacheStore.STORE_NAME, 'readwrite')
        const store = tx.objectStore(ModelCacheStore.STORE_NAME)
        const req = store.put(buffer, this.modelKey)
        req.onsuccess = () => {
          db.close()
          resolve()
        }
        req.onerror = () => {
          db.close()
          reject(req.error ?? new Error('IndexedDB write failed'))
        }
      })
    } catch {
      // Best-effort persistence; inference still proceeds in memory.
    }
  }

  public async clearIndexedDb(): Promise<void> {
    try {
      const db = await ModelCacheStore.openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ModelCacheStore.STORE_NAME, 'readwrite')
        const store = tx.objectStore(ModelCacheStore.STORE_NAME)
        const req = store.delete(this.modelKey)
        req.onsuccess = () => {
          db.close()
          resolve()
        }
        req.onerror = () => {
          db.close()
          reject(req.error ?? new Error('IndexedDB clear failed'))
        }
      })
    } catch {
      // ignore
    }
  }

  public async checkLocalAvailability(): Promise<{
    hasLocalModel: boolean
    source: 'indexeddb' | 'local-disk' | 'none'
    hostStatus: ModelStatusResponse | null
  }> {
    const cached = await this.getFromIndexedDb()
    let hostStatus: ModelStatusResponse | null = null
    try {
      const doFetch = ModelCacheStore.getCarrierFetch()
      const res = await doFetch(API_MODEL_STATUS_PATH, { method: 'GET' })
      if (res.ok) {
        hostStatus = (await res.json()) as ModelStatusResponse
      }
    } catch {
      // Ignore transient host status errors.
    }
    if (cached !== null) {
      return { hasLocalModel: true, source: 'indexeddb', hostStatus }
    }
    if (hostStatus?.exists) {
      return { hasLocalModel: true, source: 'local-disk', hostStatus }
    }
    return { hasLocalModel: false, source: 'none', hostStatus }
  }

  public async loadLazy(onProgress?: ModelProgressCallback): Promise<LoadedModelArtifact> {
    const cached = await this.getFromIndexedDb()
    if (cached !== null) {
      return { buffer: cached, source: 'indexeddb' }
    }

    const doFetch = ModelCacheStore.getCarrierFetch()
    const response = await doFetch(API_MODEL_PATH, { method: 'GET' })
    if (!response.ok) {
      let detail = 'HTTP ' + response.status
      try {
        const errJson = (await response.json()) as { error?: string }
        if (errJson.error) detail = errJson.error
      } catch {
        // ignore non-json error body
      }
      throw new Error(detail)
    }

    const headerSource = response.headers.get('x-nametag-model-source')
    const source: ModelLoadSource = headerSource === 'local-disk' ? 'local-disk' : 'remote-lazyload'
    const totalBytes = Number(response.headers.get('content-length') ?? '0') || 47_251_206

    let buffer: ArrayBuffer
    if (response.body !== null) {
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value !== undefined) {
          chunks.push(value)
          received += value.byteLength
          onProgress?.(received, Math.max(totalBytes, received))
        }
      }
      const merged = new Uint8Array(received)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
      }
      buffer = merged.buffer
    } else {
      buffer = await response.arrayBuffer()
      onProgress?.(buffer.byteLength, buffer.byteLength)
    }

    await this.saveToIndexedDb(buffer)
    return { buffer, source }
  }

  public async loadFromLocalFile(file: File): Promise<LoadedModelArtifact> {
    const buffer = await file.arrayBuffer()
    if (buffer.byteLength === 0) {
      throw new Error('Selected ONNX file is empty')
    }
    await this.saveToIndexedDb(buffer)
    return { buffer, source: 'local-file' }
  }
}
