import type { GranularityParams, GranularityPreset, SavedGranularityPreset } from '../../invariant'
import { GranularityFilter } from './GranularityFilter'

/**
 * GranularitySettings: OOP value-object class representing a complete set of
 * granularity filter parameters.
 */
export class GranularitySettings implements GranularityParams {
  public readonly preset: GranularityPreset
  public readonly comprehensive: number
  public readonly containmentThreshold: number
  public readonly minAreaPercent: number
  public readonly confThreshold: number
  public readonly showSuppressed: boolean

  public constructor(params: GranularityParams) {
    this.preset = params.preset
    this.comprehensive = params.comprehensive
    this.containmentThreshold = params.containmentThreshold
    this.minAreaPercent = params.minAreaPercent
    this.confThreshold = params.confThreshold
    this.showSuppressed = params.showSuppressed
  }

  public static sanitize(raw: unknown): GranularitySettings | null {
    if (raw === null || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    const comp = typeof obj.comprehensive === 'number' && Number.isFinite(obj.comprehensive)
      ? Math.round(GranularityFilter.clamp(obj.comprehensive, 0, 100))
      : null
    const contain = typeof obj.containmentThreshold === 'number' && Number.isFinite(obj.containmentThreshold)
      ? Number(GranularityFilter.clamp(obj.containmentThreshold, 0, 1.0).toFixed(2))
      : null
    const minArea = typeof obj.minAreaPercent === 'number' && Number.isFinite(obj.minAreaPercent)
      ? Number(GranularityFilter.clamp(obj.minAreaPercent, 0, 100.0).toFixed(1))
      : null
    const conf = typeof obj.confThreshold === 'number' && Number.isFinite(obj.confThreshold)
      ? Number(GranularityFilter.clamp(obj.confThreshold, 0, 1.0).toFixed(2))
      : null
    if (comp === null || contain === null || minArea === null || conf === null) return null
    const preset =
      obj.preset === 'coarse' || obj.preset === 'balanced' || obj.preset === 'fine' || obj.preset === 'custom'
        ? obj.preset
        : 'custom'
    return new GranularitySettings({
      preset,
      comprehensive: comp,
      containmentThreshold: contain,
      minAreaPercent: minArea,
      confThreshold: conf,
      showSuppressed: Boolean(obj.showSuppressed),
    })
  }

  public static fromParams(params: GranularityParams): GranularitySettings {
    return new GranularitySettings(params)
  }

  public clone(): GranularitySettings {
    return new GranularitySettings(this.toParams())
  }

  public toParams(): GranularityParams {
    return {
      preset: this.preset,
      comprehensive: this.comprehensive,
      containmentThreshold: this.containmentThreshold,
      minAreaPercent: this.minAreaPercent,
      confThreshold: this.confThreshold,
      showSuppressed: this.showSuppressed,
    }
  }
}

/**
 * SavedPresetItem: OOP entity class for each saved dropdown entry,
 * holding id, text, selected flag, and a GranularitySettings instance.
 */
export class SavedPresetItem {
  public readonly id: string
  public readonly text: string
  public readonly selected: boolean
  public readonly settings: GranularitySettings
  public readonly savedAt: number

  public constructor(init: {
    readonly id: string
    readonly text: string
    readonly selected: boolean
    readonly settings: GranularitySettings
    readonly savedAt: number
  }) {
    this.id = init.id
    this.text = init.text
    this.selected = init.selected
    this.settings = init.settings
    this.savedAt = init.savedAt
  }

  public static fromRaw(raw: unknown, fallbackIndex = 0): SavedPresetItem | null {
    if (raw === null || typeof raw !== 'object') return null
    const rec = raw as Record<string, unknown>
    const settings = GranularitySettings.sanitize(rec.settings ?? rec.params)
    if (settings === null) return null
    const id = typeof rec.id === 'string' && rec.id.trim().length > 0
      ? rec.id.trim()
      : 'preset-' + (fallbackIndex + 1)
    const rawText = typeof rec.text === 'string' ? rec.text : (typeof rec.name === 'string' ? rec.name : '')
    const text = rawText.trim().length > 0 ? rawText.trim() : 'Preset ' + (fallbackIndex + 1)
    const selected = Boolean(rec.selected)
    const savedAt = typeof rec.savedAt === 'number' && Number.isFinite(rec.savedAt) ? rec.savedAt : Date.now()
    return new SavedPresetItem({ id, text, selected, settings, savedAt })
  }

  public withText(nextText: string): SavedPresetItem {
    const trimmed = nextText.trim()
    return new SavedPresetItem({
      id: this.id,
      text: trimmed.length > 0 ? trimmed : this.text,
      selected: this.selected,
      settings: this.settings,
      savedAt: this.savedAt,
    })
  }

  public withSelected(nextSelected: boolean): SavedPresetItem {
    return new SavedPresetItem({
      id: this.id,
      text: this.text,
      selected: nextSelected,
      settings: this.settings,
      savedAt: this.savedAt,
    })
  }

  public toJSON(): SavedGranularityPreset {
    return {
      id: this.id,
      text: this.text,
      selected: this.selected,
      settings: this.settings.toParams(),
      savedAt: this.savedAt,
    }
  }
}
