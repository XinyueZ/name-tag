import * as ort from 'onnxruntime-web/webgpu'
import { API_ORT_PREFIX, type BoundingBox } from '../../invariant'

export interface LetterboxMeta {
  readonly scale: number
  readonly padLeft: number
  readonly padTop: number
  readonly newW: number
  readonly newH: number
  readonly targetSize: number
}

export interface PrototypeTensorInput {
  readonly data: Float32Array
  readonly dims: readonly number[]
}

export interface DetectionInferenceOutput {
  readonly boxes: readonly BoundingBox[]
  readonly inferMs: number
  readonly frameWidth: number
  readonly frameHeight: number
}

export type ExecutionProviderKind = 'webgpu' | 'wasm'

interface DecodedCandidate {
  readonly box: BoundingBox
  readonly x1Canvas: number
  readonly y1Canvas: number
  readonly x2Canvas: number
  readonly y2Canvas: number
  readonly coeffOffset: number
}

/**
 * FastSamInferenceEngine: OOP ONNX Runtime Web wrapper for FastSAM-s instance segmentation.
 * Decodes both detection boxes (outputs[0]) and 32-channel prototype masks (outputs[1]).
 */
export class FastSamInferenceEngine {
  private static readonly DEFAULT_IMG_SIZE = 640
  private static readonly RAW_CONF_FLOOR = 0.02
  private static readonly RAW_NMS_IOU = 0.70
  private static readonly MAX_DETECTIONS = 80

  private session: ort.InferenceSession | null = null
  private inputName = 'images'
  private inputSize = FastSamInferenceEngine.DEFAULT_IMG_SIZE
  private activeEp: ExecutionProviderKind = 'wasm'
  private offscreenCanvas: HTMLCanvasElement | null = null
  private offscreenCtx: CanvasRenderingContext2D | null = null
  private inputBuffer: Float32Array | null = null

  public isReady(): boolean {
    return this.session !== null
  }

  public getExecutionProvider(): ExecutionProviderKind {
    return this.activeEp
  }

  public getInputSize(): number {
    return this.inputSize
  }

  private static configureOrtEnvironment(): void {
    ort.env.wasm.wasmPaths = API_ORT_PREFIX
    ort.env.wasm.proxy = false
    const isolated = typeof globalThis.crossOriginIsolated === 'boolean' && globalThis.crossOriginIsolated
    ort.env.wasm.numThreads = isolated ? 4 : 1
    ort.env.logLevel = 'warning'
  }

  private static async hasUsableWebGpu(): Promise<boolean> {
    try {
      const nav = globalThis.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
      if (!nav || !nav.gpu) return false
      const adapter = await nav.gpu.requestAdapter()
      return adapter !== null && adapter !== undefined
    } catch {
      return false
    }
  }

  public async initialize(modelBuffer: ArrayBuffer): Promise<ExecutionProviderKind> {
    await this.dispose()
    FastSamInferenceEngine.configureOrtEnvironment()
    const bytes = new Uint8Array(modelBuffer)
    const canWebGpu = await FastSamInferenceEngine.hasUsableWebGpu()

    if (canWebGpu) {
      try {
        this.session = await ort.InferenceSession.create(bytes, {
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all',
        })
        this.activeEp = 'webgpu'
      } catch {
        this.session = null
      }
    }

    if (this.session === null) {
      this.session = await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
      this.activeEp = 'wasm'
    }

    this.inspectSessionSignature()
    return this.activeEp
  }

  private inspectSessionSignature(): void {
    if (this.session === null) return
    if (this.session.inputNames.length > 0) {
      this.inputName = this.session.inputNames[0]
    }
    try {
      const meta = (this.session as unknown as {
        inputMetadata?: Record<string, { dimensions?: readonly (number | string)[] }>
      }).inputMetadata?.[this.inputName]
      const dims = meta?.dimensions
      if (dims && dims.length === 4 && typeof dims[2] === 'number' && dims[2] > 0) {
        this.inputSize = dims[2]
      } else {
        this.inputSize = FastSamInferenceEngine.DEFAULT_IMG_SIZE
      }
    } catch {
      this.inputSize = FastSamInferenceEngine.DEFAULT_IMG_SIZE
    }
    this.inputBuffer = new Float32Array(3 * this.inputSize * this.inputSize)
  }

  private ensureCanvas(size: number): CanvasRenderingContext2D {
    if (this.offscreenCanvas === null) {
      this.offscreenCanvas = document.createElement('canvas')
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })
    }
    if (this.offscreenCanvas.width !== size || this.offscreenCanvas.height !== size) {
      this.offscreenCanvas.width = size
      this.offscreenCanvas.height = size
    }
    if (this.offscreenCtx === null) {
      throw new Error('Failed to acquire 2D canvas context for preprocessing')
    }
    return this.offscreenCtx
  }

  private preprocessVideoFrame(video: HTMLVideoElement): { tensor: ort.Tensor; letterbox: LetterboxMeta } {
    const size = this.inputSize
    const origW = video.videoWidth
    const origH = video.videoHeight
    const ctx = this.ensureCanvas(size)

    const scale = Math.min(size / origW, size / origH)
    const newW = Math.round(origW * scale)
    const newH = Math.round(origH * scale)
    const padLeft = Math.floor((size - newW) / 2)
    const padTop = Math.floor((size - newH) / 2)

    ctx.fillStyle = 'rgb(114, 114, 114)'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(video, padLeft, padTop, newW, newH)

    const imageData = ctx.getImageData(0, 0, size, size).data
    const planeSize = size * size
    if (this.inputBuffer === null || this.inputBuffer.length !== 3 * planeSize) {
      this.inputBuffer = new Float32Array(3 * planeSize)
    }
    const dst = this.inputBuffer
    const inv255 = 1 / 255

    for (let i = 0, p = 0; i < planeSize; i += 1, p += 4) {
      dst[i] = imageData[p] * inv255
      dst[planeSize + i] = imageData[p + 1] * inv255
      dst[2 * planeSize + i] = imageData[p + 2] * inv255
    }

    const tensor = new ort.Tensor('float32', dst, [1, 3, size, size])
    return {
      tensor,
      letterbox: { scale, padLeft, padTop, newW, newH, targetSize: size },
    }
  }

  public static computeIoU(a: BoundingBox, b: BoundingBox): number {
    const ix1 = Math.max(a.x1, b.x1)
    const iy1 = Math.max(a.y1, b.y1)
    const ix2 = Math.min(a.x2, b.x2)
    const iy2 = Math.min(a.y2, b.y2)
    const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1)
    const union = a.area + b.area - inter
    return union > 0 ? inter / union : 0
  }

  public static applyNms(
    candidates: readonly DecodedCandidate[],
    iouThreshold: number,
    maxDetections: number,
  ): DecodedCandidate[] {
    const sorted = candidates.slice().sort((a, b) => b.box.score - a.box.score)
    const selected: DecodedCandidate[] = []
    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i]
      let suppressed = false
      for (let j = 0; j < selected.length; j += 1) {
        if (FastSamInferenceEngine.computeIoU(current.box, selected[j].box) > iouThreshold) {
          suppressed = true
          break
        }
      }
      if (!suppressed) {
        selected.push(current)
        if (selected.length >= maxDetections) break
      }
    }
    return selected
  }

  private static synthesizeInstanceMask(
    candidate: DecodedCandidate,
    rawData: Float32Array,
    channelsFirst: boolean,
    numChannels: number,
    numAnchors: number,
    prototypes: PrototypeTensorInput,
    letterbox: LetterboxMeta,
    origW: number,
    origH: number,
  ): BoundingBox {
    const pDims = prototypes.dims
    if (pDims.length !== 4 || pDims[1] < 1) return candidate.box
    const protoChannels = pDims[1]
    const protoH = pDims[2]
    const protoW = pDims[3]
    const maskDimCount = Math.min(protoChannels, numChannels - 5)
    if (maskDimCount <= 0 || protoH <= 0 || protoW <= 0) return candidate.box

    const ratioX = letterbox.targetSize / protoW
    const ratioY = letterbox.targetSize / protoH

    const uLeft = Math.max(0, Math.floor(letterbox.padLeft / ratioX))
    const uTop = Math.max(0, Math.floor(letterbox.padTop / ratioY))
    const uRight = Math.min(protoW, Math.ceil((letterbox.padLeft + letterbox.newW) / ratioX))
    const uBottom = Math.min(protoH, Math.ceil((letterbox.padTop + letterbox.newH) / ratioY))
    const uW = Math.max(1, uRight - uLeft)
    const uH = Math.max(1, uBottom - uTop)

    const bx1 = Math.max(uLeft, Math.floor(candidate.x1Canvas / ratioX))
    const by1 = Math.max(uTop, Math.floor(candidate.y1Canvas / ratioY))
    const bx2 = Math.min(uRight, Math.ceil(candidate.x2Canvas / ratioX))
    const by2 = Math.min(uBottom, Math.ceil(candidate.y2Canvas / ratioY))

    const coeffs = new Float32Array(maskDimCount)
    for (let c = 0; c < maskDimCount; c += 1) {
      coeffs[c] = channelsFirst
        ? rawData[(5 + c) * numAnchors + candidate.coeffOffset]
        : rawData[candidate.coeffOffset * numChannels + (5 + c)]
    }

    const maskData = new Uint8Array(uW * uH)
    const protoData = prototypes.data
    const protoPlane = protoH * protoW
    let fgCount = 0
    let sumX = 0
    let sumY = 0

    for (let py = by1; py < by2; py += 1) {
      const outRowOffset = (py - uTop) * uW
      const protoRowOffset = py * protoW
      for (let px = bx1; px < bx2; px += 1) {
        const protoIdx = protoRowOffset + px
        let logit = 0
        for (let c = 0; c < maskDimCount; c += 1) {
          logit += coeffs[c] * protoData[c * protoPlane + protoIdx]
        }
        if (logit > 0) {
          maskData[outRowOffset + (px - uLeft)] = 1
          fgCount += 1
          sumX += px - uLeft
          sumY += py - uTop
        }
      }
    }

    if (fgCount === 0) {
      return candidate.box
    }

    const frameArea = Math.max(1, origW * origH)
    const scaledMaskArea = (fgCount / (uW * uH)) * frameArea
    const centroidX = ((sumX / fgCount) / uW) * origW
    const centroidY = ((sumY / fgCount) / uH) * origH

    return {
      ...candidate.box,
      maskWidth: uW,
      maskHeight: uH,
      maskData,
      maskArea: scaledMaskArea,
      anchorX: centroidX,
      anchorY: centroidY,
    }
  }

  public static decodePredictions(
    rawData: Float32Array,
    dims: readonly number[],
    letterbox: LetterboxMeta,
    origW: number,
    origH: number,
    minConf = FastSamInferenceEngine.RAW_CONF_FLOOR,
    nmsIou = FastSamInferenceEngine.RAW_NMS_IOU,
    maxDet = FastSamInferenceEngine.MAX_DETECTIONS,
    prototypes?: PrototypeTensorInput,
  ): BoundingBox[] {
    if (dims.length < 3) return []
    const dim1 = dims[1]
    const dim2 = dims[2]
    const channelsFirst = dim1 <= 128 && dim2 > dim1
    const numChannels = channelsFirst ? dim1 : dim2
    const numAnchors = channelsFirst ? dim2 : dim1
    if (numChannels < 5 || numAnchors <= 0) return []

    const candidates: DecodedCandidate[] = []
    const { scale, padLeft, padTop, targetSize } = letterbox

    for (let a = 0; a < numAnchors; a += 1) {
      const score = channelsFirst
        ? rawData[4 * numAnchors + a]
        : rawData[a * numChannels + 4]
      if (score < minConf) continue

      let cx = channelsFirst ? rawData[0 * numAnchors + a] : rawData[a * numChannels + 0]
      let cy = channelsFirst ? rawData[1 * numAnchors + a] : rawData[a * numChannels + 1]
      let bw = channelsFirst ? rawData[2 * numAnchors + a] : rawData[a * numChannels + 2]
      let bh = channelsFirst ? rawData[3 * numAnchors + a] : rawData[a * numChannels + 3]

      if (cx <= 1.0 && cy <= 1.0 && bw <= 1.0 && bh <= 1.0) {
        cx *= targetSize
        cy *= targetSize
        bw *= targetSize
        bh *= targetSize
      }

      const x1Canvas = Math.max(0, Math.min(targetSize, cx - bw * 0.5))
      const y1Canvas = Math.max(0, Math.min(targetSize, cy - bh * 0.5))
      const x2Canvas = Math.max(0, Math.min(targetSize, cx + bw * 0.5))
      const y2Canvas = Math.max(0, Math.min(targetSize, cy + bh * 0.5))

      const x1 = Math.max(0, Math.min(origW, (x1Canvas - padLeft) / scale))
      const y1 = Math.max(0, Math.min(origH, (y1Canvas - padTop) / scale))
      const x2 = Math.max(0, Math.min(origW, (x2Canvas - padLeft) / scale))
      const y2 = Math.max(0, Math.min(origH, (y2Canvas - padTop) / scale))

      const boxW = x2 - x1
      const boxH = y2 - y1
      if (boxW <= 2 || boxH <= 2) continue

      candidates.push({
        box: {
          id: 'seg-' + a,
          x1,
          y1,
          x2,
          y2,
          score,
          area: boxW * boxH,
          colorIndex: candidates.length,
        },
        x1Canvas,
        y1Canvas,
        x2Canvas,
        y2Canvas,
        coeffOffset: a,
      })
    }

    const nmsed = FastSamInferenceEngine.applyNms(candidates, nmsIou, maxDet)
    return nmsed.map((cand, idx) => {
      const baseWithId: DecodedCandidate = {
        ...cand,
        box: {
          ...cand.box,
          id: 'seg-' + (idx + 1),
          colorIndex: idx,
        },
      }
      if (prototypes === undefined) return baseWithId.box
      return FastSamInferenceEngine.synthesizeInstanceMask(
        baseWithId,
        rawData,
        channelsFirst,
        numChannels,
        numAnchors,
        prototypes,
        letterbox,
        origW,
        origH,
      )
    })
  }

  public async detectFrame(video: HTMLVideoElement): Promise<DetectionInferenceOutput> {
    if (this.session === null) {
      throw new Error('FastSAM-s session is not initialized')
    }
    const origW = video.videoWidth
    const origH = video.videoHeight
    if (origW <= 0 || origH <= 0) {
      return { boxes: [], inferMs: 0, frameWidth: 0, frameHeight: 0 }
    }

    const t0 = performance.now()
    const { tensor, letterbox } = this.preprocessVideoFrame(video)
    let results: Record<string, ort.Tensor> | null = null
    try {
      results = await this.session.run({ [this.inputName]: tensor })
      const predName = this.session.outputNames[0]
      const predTensor = results[predName]
      const protoName = this.session.outputNames.length > 1 ? this.session.outputNames[1] : undefined
      const protoTensor = protoName !== undefined ? results[protoName] : undefined
      const prototypes: PrototypeTensorInput | undefined =
        protoTensor !== undefined
          ? { data: protoTensor.data as Float32Array, dims: protoTensor.dims }
          : undefined

      const boxes = FastSamInferenceEngine.decodePredictions(
        predTensor.data as Float32Array,
        predTensor.dims,
        letterbox,
        origW,
        origH,
        FastSamInferenceEngine.RAW_CONF_FLOOR,
        FastSamInferenceEngine.RAW_NMS_IOU,
        FastSamInferenceEngine.MAX_DETECTIONS,
        prototypes,
      )
      const inferMs = Number((performance.now() - t0).toFixed(1))
      return { boxes, inferMs, frameWidth: origW, frameHeight: origH }
    } finally {
      tensor.dispose()
      if (results !== null) {
        for (const outTensor of Object.values(results)) {
          outTensor.dispose()
        }
      }
    }
  }

  public async dispose(): Promise<void> {
    if (this.session !== null) {
      try {
        await this.session.release()
      } catch {
        // ignore release errors
      }
      this.session = null
    }
  }
}
