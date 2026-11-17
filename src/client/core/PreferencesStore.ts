import { type GranularityParams, type NameTagPreferences, type SavedGranularityPreset } from '../../invariant'
import { GranularitySettings, SavedPresetItem } from './SavedPresetModels'

export interface LoadedWorkspacePreferences {
  readonly granularity: GranularityParams
  readonly granularityCardCollapsed: boolean
  readonly savedPresets: SavedPresetItem[]
}

/**
 * PreferencesStore: 100% browser-local persistence (localStorage only)
 * so multi-user deployments keep preferences and presets completely isolated.
 */
export class PreferencesStore {
  public static readonly STORAGE_KEY = 'dsh-name-tag:preferences:v1'

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

  public static sanitizePreferences(raw: unknown): NameTagPreferences | null {
    if (raw === null || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    const granularity = PreferencesStore.sanitizeGranularity(obj.granularity)
    if (granularity === null) return null
    const items = PreferencesStore.sanitizeSavedPresets(obj.savedPresets)
    return {
      granularity,
      granularityCardCollapsed: Boolean(obj.granularityCardCollapsed),
      savedPresets: items.map((item) => item.toJSON()),
    }
  }

  public static toWorkspacePreferences(raw: NameTagPreferences | null): LoadedWorkspacePreferences | null {
    if (raw === null) return null
    return {
      granularity: raw.granularity,
      granularityCardCollapsed: Boolean(raw.granularityCardCollapsed),
      savedPresets: PreferencesStore.sanitizeSavedPresets(raw.savedPresets),
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
  }): void {
    const payload: NameTagPreferences = {
      granularity: state.granularity,
      granularityCardCollapsed: state.granularityCardCollapsed,
      savedPresets: state.savedPresets.map((item): SavedGranularityPreset => item.toJSON()),
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
