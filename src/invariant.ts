import type { Context } from '@deepseek-ai/cordis'

export const name = '@deepseek-ai/dsh-client-name-tag/invariant'

export const PLUGIN_ID = '@deepseek-ai/dsh-client-name-tag'
export const SLOT_ID = 'name-tag'
export const LOCALE_NS = 'name.tag'

export const API_MODEL_PATH = '/api/name-tag/model'
export const API_MODEL_STATUS_PATH = '/api/name-tag/model/status'
export const API_ORT_PREFIX = '/api/name-tag/ort/'

export const FASTSAM_MODEL_FILENAME = 'FastSAM-s.onnx'
export const FASTSAM_REMOTE_URL =
  'https://huggingface.co/SpatialHub/fastsam-onnx/resolve/main/FastSAM-s.onnx'
export const EMBEDDING_MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX'
export const EMBEDDING_DIM = 768
export const DEFAULT_MATCH_THRESHOLD = 0.78
export const DEFAULT_RECOGNITION_IOU_THRESHOLD = 0.30
export const DEFAULT_MATCH_TOP_K = 30
export const MIN_MATCH_TOP_K = 1
export const MAX_MATCH_TOP_K = 500
export const DEFAULT_SCOPE_CONFIDENCE_THRESHOLD = 0.50

export const ORT_ASSET_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jspi.mjs',
  'ort-wasm-simd-threaded.asyncify.mjs',
] as const

export type GranularityPreset = 'coarse' | 'balanced' | 'fine' | 'custom'

export interface GranularityParams {
  readonly preset: GranularityPreset
  readonly comprehensive: number
  readonly containmentThreshold: number
  readonly minAreaPercent: number
  readonly confThreshold: number
  readonly showSuppressed: boolean
}

export interface SavedGranularityPreset {
  readonly id: string
  readonly text: string
  readonly selected: boolean
  readonly settings: GranularityParams
  readonly savedAt: number
}

export interface CameraScopeItemData {
  readonly id: string
  readonly text: string
  readonly editable: boolean
}

export interface CameraScopeStateData {
  readonly selectedId: string
  readonly customItems: readonly CameraScopeItemData[]
}

export interface NameTagPreferences {
  readonly granularity: GranularityParams
  readonly granularityCardCollapsed?: boolean
  readonly savedPresets?: readonly SavedGranularityPreset[]
  readonly cameraScopes?: CameraScopeStateData
  readonly scopeConfidenceThreshold?: number
  readonly matchThreshold?: number
  readonly recognitionIouThreshold?: number
  readonly matchTopK?: number
}

export interface BoundingBox {
  readonly id: string
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly score: number
  readonly area: number
  readonly colorIndex: number
  readonly maskWidth?: number
  readonly maskHeight?: number
  readonly maskData?: Uint8Array
  readonly maskArea?: number
  readonly anchorX?: number
  readonly anchorY?: number
}

export interface GranularityFilterResult {
  readonly kept: readonly BoundingBox[]
  readonly suppressed: readonly BoundingBox[]
  readonly durationMs: number
}

export type VectorImageKind = 'original' | 'flip' | 'scale' | 'color' | 'rotate' | 'blur'

export interface TagVectorMetadata {
  readonly targetId: string
  readonly title: string
  readonly description: string
  readonly imageKind: VectorImageKind
  readonly isOriginal: boolean
  readonly augmentation: Exclude<VectorImageKind, 'original'> | null
  readonly vectorHead: readonly number[]
  readonly vectorTail: readonly number[]
  readonly vectorDim: number
  readonly createdAt: number
}

export interface VectorSaveItemInput {
  readonly imageKind: VectorImageKind
  readonly vector: readonly number[]
}

export interface SaveTaggedTargetRequest {
  readonly title: string
  readonly description: string
  readonly items: readonly VectorSaveItemInput[]
}

export interface SaveTaggedTargetResponse {
  readonly ok: true
  readonly targetId: string
  readonly insertedCount: number
  readonly totalVectors: number
  readonly totalTargets: number
}

export interface VectorTableRow {
  readonly id: string
  readonly targetId?: string
  readonly vectorHead: readonly number[]
  readonly vectorTail: readonly number[]
  readonly vectorDim: number
  readonly imageKind: VectorImageKind
  readonly augmentation: string
  readonly title: string
  readonly description: string
  readonly createdAt: number
}

export interface VectorSearchCandidate {
  readonly targetId: string
  readonly title: string
  readonly description?: string | null
  readonly similarity: number
}

export interface VectorSearchMatchResult {
  readonly index: number
  readonly matched: boolean
  readonly targetId: string | null
  readonly title: string | null
  readonly description?: string | null
  readonly similarity: number
  readonly candidates?: readonly VectorSearchCandidate[]
}

export interface RecognizedDetection {
  readonly targetId: string
  readonly title: string
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly colorIndex: number
  readonly recognizedAt: number
  readonly similarity?: number
}

export interface VectorSearchResponse {
  readonly results: readonly VectorSearchMatchResult[]
}

export interface VectorStoreStatsResponse {
  readonly totalVectors: number
  readonly totalTargets: number
  readonly entries?: readonly VectorTableRow[]
}

export interface ModelStatusResponse {
  readonly exists: boolean
  readonly filename: string
  readonly sizeBytes: number
  readonly cachePath: string
  readonly remoteUrl: string
}

export function apply(_ctx: Context): void {
  // Shared constants & types between Node host static mirror and Browser client.
}
