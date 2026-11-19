import {
  DEFAULT_MATCH_THRESHOLD,
  DEFAULT_MATCH_TOP_K,
  DEFAULT_RECOGNITION_IOU_THRESHOLD,
  DEFAULT_SCOPE_CONFIDENCE_THRESHOLD,
  MAX_MATCH_TOP_K,
  MIN_MATCH_TOP_K,
  type CameraScopeStateData,
  type GranularityParams,
  type NameTagPreferences,
  type SavedGranularityPreset,
} from '../../invariant'
import { CameraScopeCollection } from './CameraScopeModels'
import { GranularityFilter } from './GranularityFilter'
import { GranularitySettings, SavedPresetItem } from './SavedPresetModels'

export interface LoadedWorkspacePreferences {
  readonly granularity: GranularityParams
  readonly granularityCardCollapsed: boolean
  readonly savedPresets: SavedPresetItem[]
  readonly cameraScopes: CameraScopeCollection
  readonly scopeConfidenceThreshold: number
  readonly matchThreshold: number
  readonly recognitionIouThreshold: number
  readonly matchTopK: number
}

/**
 * PreferencesStore: 100% browser-local persistence (localStorage only)
 * so multi-user deployments keep preferences, presets, scope list, and thresholds
 * completely isolated per browser.
 */
export class PreferencesStore {
  public static readonly STORAGE_KEY = 'dsh-name-tag:preferences:v1'

  public static sanitizeUnitThreshold(raw: unknown, fallback: number): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
    return Number(GranularityFilter.clamp(raw, 0, 1).toFixed(2))
  }

  public static sanitizeTopK(raw: unknown, fallback = DEFAULT_MATCH_TOP_K): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
    return Math.round(GranularityFilter.clamp(raw, MIN_MATCH_TOP_K, MAX_MATCH_TOP_K))
  }

  public static sanitizeGranularity(raw: unknown): GranularityParams | null {
    return GranularitySettings.sanitize(raw)?.toParams() ?? null
  }

  public static sanitizeSavedPresets(raw: unknown): SavedPresetItem[] {
    if (!Array.isArray(raw)) return []
    const result: SavedPresetItem[] = []
    for (let i = 0; i < raw.length; i += 1) {
      const item = SavedPresetItem.fromRaw(raw[i], i)
      if (item !== null) result.push(item)
    }
    return result
  }

  public static sanitizeCameraScopes(raw: unknown): CameraScopeStateData {
    return CameraScopeCollection.fromRaw(raw).toJSON()
  }

  public static sanitizePreferences(raw: unknown): NameTagPreferences | null {
    if (raw === null || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    const granularity = PreferencesStore.sanitizeGranularity(obj.granularity)
    if (granularity === null) return null
    const items = PreferencesStore.sanitizeSavedPresets(obj.savedPresets)
    const cameraScopes = PreferencesStore.sanitizeCameraScopes(obj.cameraScopes)
    const scopeConfidenceThreshold = PreferencesStore.sanitizeUnitThreshold(
      obj.scopeConfidenceThreshold,
      DEFAULT_SCOPE_CONFIDENCE_THRESHOLD,
    )
    const matchThreshold = PreferencesStore.sanitizeUnitThreshold(
      obj.matchThreshold,
      DEFAULT_MATCH_THRESHOLD,
    )
    const recognitionIouThreshold = PreferencesStore.sanitizeUnitThreshold(
      obj.recognitionIouThreshold,
      DEFAULT_RECOGNITION_IOU_THRESHOLD,
    )
    const matchTopK = PreferencesStore.sanitizeTopK(obj.matchTopK, DEFAULT_MATCH_TOP_K)
    return {
      granularity,
      granularityCardCollapsed: Boolean(obj.granularityCardCollapsed),
      savedPresets: items.map((item) => item.toJSON()),
      cameraScopes,
      scopeConfidenceThreshold,
      matchThreshold,
      recognitionIouThreshold,
      matchTopK,
    }
  }

  public static toWorkspacePreferences(raw: NameTagPreferences | null): LoadedWorkspacePreferences | null {
    if (raw === null) return null
    return {
      granularity: raw.granularity,
      granularityCardCollapsed: Boolean(raw.granularityCardCollapsed),
      savedPresets: PreferencesStore.sanitizeSavedPresets(raw.savedPresets),
      cameraScopes: CameraScopeCollection.fromRaw(raw.cameraScopes),
      scopeConfidenceThreshold: PreferencesStore.sanitizeUnitThreshold(
        raw.scopeConfidenceThreshold,
        DEFAULT_SCOPE_CONFIDENCE_THRESHOLD,
      ),
      matchThreshold: PreferencesStore.sanitizeUnitThreshold(
        raw.matchThreshold,
        DEFAULT_MATCH_THRESHOLD,
      ),
      recognitionIouThreshold: PreferencesStore.sanitizeUnitThreshold(
        raw.recognitionIouThreshold,
        DEFAULT_RECOGNITION_IOU_THRESHOLD,
      ),
      matchTopK: PreferencesStore.sanitizeTopK(raw.matchTopK, DEFAULT_MATCH_TOP_K),
    }
  }

  public loadLocal(): LoadedWorkspacePreferences | null {
    try {
      if (typeof globalThis.localStorage === 'undefined') return null
      const text = globalThis.localStorage.getItem(PreferencesStore.STORAGE_KEY)
      if (!text) return null
      const sanitized = PreferencesStore.sanitizePreferences(JSON.parse(text))
      return PreferencesStore.toWorkspacePreferences(sanitized)
    } catch {
      return null
    }
  }

  public saveLocal(prefs: NameTagPreferences): void {
    try {
      if (typeof globalThis.localStorage === 'undefined') return
      globalThis.localStorage.setItem(PreferencesStore.STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // ignore quota / restricted storage errors
    }
  }

  public saveWorkspace(state: {
    readonly granularity: GranularityParams
    readonly granularityCardCollapsed: boolean
    readonly savedPresets: readonly SavedPresetItem[]
    readonly cameraScopes?: CameraScopeCollection
    readonly scopeConfidenceThreshold?: number
    readonly matchThreshold?: number
    readonly recognitionIouThreshold?: number
    readonly matchTopK?: number
  }): void {
    const payload: NameTagPreferences = {
      granularity: state.granularity,
      granularityCardCollapsed: state.granularityCardCollapsed,
      savedPresets: state.savedPresets.map((item): SavedGranularityPreset => item.toJSON()),
      cameraScopes: (state.cameraScopes ?? CameraScopeCollection.createDefault()).toJSON(),
      scopeConfidenceThreshold: PreferencesStore.sanitizeUnitThreshold(
        state.scopeConfidenceThreshold,
        DEFAULT_SCOPE_CONFIDENCE_THRESHOLD,
      ),
      matchThreshold: PreferencesStore.sanitizeUnitThreshold(
        state.matchThreshold,
        DEFAULT_MATCH_THRESHOLD,
      ),
      recognitionIouThreshold: PreferencesStore.sanitizeUnitThreshold(
        state.recognitionIouThreshold,
        DEFAULT_RECOGNITION_IOU_THRESHOLD,
      ),
      matchTopK: PreferencesStore.sanitizeTopK(state.matchTopK, DEFAULT_MATCH_TOP_K),
    }
    this.saveLocal(payload)
  }

  public clearLocal(): void {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        globalThis.localStorage.removeItem(PreferencesStore.STORAGE_KEY)
      }
    } catch {
      // ignore storage removal errors
    }
  }
}