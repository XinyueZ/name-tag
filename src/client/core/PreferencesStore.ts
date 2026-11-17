import { API_PREFERENCES_PATH, type GranularityParams, type NameTagPreferences, type SavedGranularityPreset } from '../../invariant'
import { GranularitySettings, SavedPresetItem } from './SavedPresetModels'

interface TransportGlobal {
  __DSH_TRANSPORT__?: {
    fetch?: (input: string, init?: RequestInit) => Promise<Response>
  }
}

export interface LoadedWorkspacePreferences {
  readonly granularity: GranularityParams
  readonly granularityCardCollapsed: boolean
  readonly savedPresets: SavedPresetItem[]
}

/**
 * PreferencesStore: OOP persistence manager saving Granularity panel settings,
 * card collapse state, and SavedPresetItem instances across restarts.
 */
export class PreferencesStore {
  private static readonly STORAGE_KEY = 'dsh-name-tag:preferences:v1'
  private syncTimer: number | null = null

  private static getCarrierFetch(): (input: string, init?: RequestInit) => Promise<Response> {
    const custom = (globalThis as unknown as TransportGlobal).__DSH_TRANSPORT__?.fetch
    if (custom !== undefined) return custom
    return (input, init) => globalThis.fetch(input, init)
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

  public async loadFromHost(): Promise<LoadedWorkspacePreferences | null> {
    try {
      const doFetch = PreferencesStore.getCarrierFetch()
      const res = await doFetch(API_PREFERENCES_PATH, { method: 'GET' })
      if (!res.ok) return null
      const parsed = await res.json()
      const sanitized = PreferencesStore.sanitizePreferences(parsed)
      if (sanitized !== null) {
        this.saveLocal(sanitized)
      }
      return PreferencesStore.toWorkspacePreferences(sanitized)
    } catch {
      return null
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
    this.save(payload)
  }

  public save(prefs: NameTagPreferences): void {
    this.saveLocal(prefs)
    if (typeof globalThis.setTimeout === 'undefined') return
    if (this.syncTimer !== null) {
      globalThis.clearTimeout(this.syncTimer)
    }
    this.syncTimer = globalThis.setTimeout(() => {
      this.syncTimer = null
      const doFetch = PreferencesStore.getCarrierFetch()
      void doFetch(API_PREFERENCES_PATH, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(prefs),
      }).catch(() => {})
    }, 180) as unknown as number
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

  public async clearAll(): Promise<void> {
    this.dispose()
    this.clearLocal()
    try {
      const doFetch = PreferencesStore.getCarrierFetch()
      await doFetch(API_PREFERENCES_PATH, { method: 'DELETE' })
    } catch {
      // ignore transient network errors
    }
  }

  public dispose(): void {
    if (this.syncTimer !== null && typeof globalThis.clearTimeout !== 'undefined') {
      globalThis.clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
  }
}
