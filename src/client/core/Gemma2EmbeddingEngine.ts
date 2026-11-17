import {
  AutoConfig,
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from '@huggingface/transformers'
import { Embeddings } from '@langchain/core/embeddings'
import { API_ORT_PREFIX, EMBEDDING_DIM, EMBEDDING_MODEL_ID } from '../../invariant'

export type EmbeddingProgressCallback = (info: {
  readonly status: string
  readonly progress: number
  readonly file?: string
}) => void

/**
 * Gemma2EmbeddingEngine: Client-side OOP wrapper for onnx-community/embeddinggemma-2-ONNX.
 * Loads only Text + Vision encoders (audio_config disabled) in Browser CacheStorage.
 */
export class Gemma2EmbeddingEngine {
  public static readonly CACHE_NAME = 'transformers-cache'
  private static readonly NEUTRAL_GRAY = '#808080'

  private processor: any = null
  private model: any = null
  private device: 'webgpu' | 'wasm' = 'wasm'

  public isReady(): boolean {
    return this.processor !== null && this.model !== null
  }

  public getDevice(): 'webgpu' | 'wasm' {
    return this.device
  }

  private static configureEnvironment(): void {
    env.allowLocalModels = false
    env.allowRemoteModels = true
    env.useBrowserCache = true
    env.cacheKey = Gemma2EmbeddingEngine.CACHE_NAME
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = API_ORT_PREFIX
      env.backends.onnx.wasm.proxy = false
    }
  }

  private static async hasWebGpu(): Promise<boolean> {
    try {
      const nav = globalThis.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
      if (!nav || !nav.gpu) return false
      const adapter = await nav.gpu.requestAdapter()
      return adapter !== null && adapter !== undefined
    } catch {
      return false
    }
  }

  public static async checkBrowserCacheExists(): Promise<boolean> {
    try {
      if (typeof globalThis.caches === 'undefined') return false
      const hasKey = await globalThis.caches.has(Gemma2EmbeddingEngine.CACHE_NAME)
      if (!hasKey) return false
      const cache = await globalThis.caches.open(Gemma2EmbeddingEngine.CACHE_NAME)
      const keys = await cache.keys()
      return keys.some((req) => req.url.includes('embeddinggemma-2'))
    } catch {
      return false
    }
  }

  public static async clearBrowserCache(): Promise<void> {
    try {
      if (typeof globalThis.caches !== 'undefined') {
        await globalThis.caches.delete(Gemma2EmbeddingEngine.CACHE_NAME)
      }
    } catch {
      // ignore cache deletion failures
    }
  }

  public async initialize(onProgress?: EmbeddingProgressCallback): Promise<'webgpu' | 'wasm'> {
    if (this.isReady()) return this.device
    Gemma2EmbeddingEngine.configureEnvironment()
    const useWebGpu = await Gemma2EmbeddingEngine.hasWebGpu()
    const targetDevice: 'webgpu' | 'wasm' = useWebGpu ? 'webgpu' : 'wasm'

    const progressCb = (data: Record<string, unknown>): void => {
      const status = typeof data.status === 'string' ? data.status : 'progress'
      const rawPct = typeof data.progress === 'number' && Number.isFinite(data.progress) ? data.progress : 0
      const file = typeof data.file === 'string' ? data.file : undefined
      onProgress?.({ status, progress: Math.min(100, Math.max(0, Math.round(rawPct))), file })
    }

    const config = await AutoConfig.from_pretrained(EMBEDDING_MODEL_ID, { progress_callback: progressCb })
    const mutableConfig = config as unknown as Record<string, unknown>
    mutableConfig.audio_config = null

    this.processor = await AutoProcessor.from_pretrained(EMBEDDING_MODEL_ID, { progress_callback: progressCb })

    const loadModelOn = async (dev: 'webgpu' | 'wasm') => {
      return AutoModel.from_pretrained(EMBEDDING_MODEL_ID, {
        config,
        device: dev,
        dtype: { model: 'q4', vision_encoder: 'q4' },
        progress_callback: progressCb,
      } as Record<string, unknown>)
    }

    if (targetDevice === 'webgpu') {
      try {
        this.model = await loadModelOn('webgpu')
        this.device = 'webgpu'
        return this.device
      } catch {
        this.model = null
      }
    }

    this.model = await loadModelOn('wasm')
    this.device = 'wasm'
    return this.device
  }

  public static async flattenDataUrlToNeutralGrayCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Failed to decode cutout image for embedding'))
      el.src = dataUrl
    })
    const w = Math.max(8, img.naturalWidth || img.width)
    const h = Math.max(8, img.naturalHeight || img.height)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      throw new Error('Failed to acquire 2D canvas context for gray-background flattening')
    }
    ctx.fillStyle = Gemma2EmbeddingEngine.NEUTRAL_GRAY
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas
  }

  public static l2Normalize(vec: ArrayLike<number>): number[] {
    const out = new Array<number>(vec.length)
    let sumSq = 0
    for (let i = 0; i < vec.length; i += 1) {
      const v = vec[i]
      out[i] = v
      sumSq += v * v
    }
    const norm = Math.sqrt(sumSq)
    if (norm > 1e-12) {
      for (let i = 0; i < out.length; i += 1) {
        out[i] = out[i] / norm
      }
    }
    return out
  }

  public async embedImageDataUrl(dataUrl: string): Promise<number[]> {
    if (!this.isReady()) {
      throw new Error('EmbeddingGemma 2 model is not initialized yet')
    }
    const canvas = await Gemma2EmbeddingEngine.flattenDataUrlToNeutralGrayCanvas(dataUrl)
    const rawImg = RawImage.fromCanvas(canvas)
    const inputs = await this.processor(null, [[rawImg]])
    const output = await this.model(inputs)
    const embTensor = output.sentence_embedding
    const rawData = embTensor.data as Float32Array | number[]
    const result = Gemma2EmbeddingEngine.l2Normalize(rawData)
    if (result.length !== EMBEDDING_DIM) {
      return result.slice(0, EMBEDDING_DIM)
    }
    return result
  }

  public async embedImageDataUrls(dataUrls: readonly string[]): Promise<number[][]> {
    const vectors: number[][] = []
    for (let i = 0; i < dataUrls.length; i += 1) {
      vectors.push(await this.embedImageDataUrl(dataUrls[i]))
    }
    return vectors
  }

  public async embedText(text: string): Promise<number[]> {
    if (!this.isReady()) {
      throw new Error('EmbeddingGemma 2 model is not initialized yet')
    }
    const inputs = await this.processor([text])
    const output = await this.model(inputs)
    return Gemma2EmbeddingEngine.l2Normalize(output.sentence_embedding.data as Float32Array | number[])
  }

  public async dispose(): Promise<void> {
    if (this.model && typeof this.model.dispose === 'function') {
      try {
        await this.model.dispose()
      } catch {
        // ignore disposal errors
      }
    }
    this.model = null
    this.processor = null
  }
}

/**
 * Gemma2LangChainEmbeddings: Client-side LangChain Embeddings subclass backed by Gemma2EmbeddingEngine.
 */
export class Gemma2LangChainEmbeddings extends Embeddings {
  private readonly engine: Gemma2EmbeddingEngine

  public constructor(engine: Gemma2EmbeddingEngine) {
    super({})
    this.engine = engine
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    const out: number[][] = []
    for (let i = 0; i < texts.length; i += 1) {
      out.push(await this.engine.embedText(texts[i]))
    }
    return out
  }

  public async embedQuery(text: string): Promise<number[]> {
    return this.engine.embedText(text)
  }

  public async embedImages(dataUrls: readonly string[]): Promise<number[][]> {
    return this.engine.embedImageDataUrls(dataUrls)
  }
}
