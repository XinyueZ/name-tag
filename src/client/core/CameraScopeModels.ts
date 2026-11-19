import type { CameraScopeItemData, CameraScopeStateData } from '../../invariant'

export type CameraScopeAddStatus = 'added' | 'empty' | 'reserved-builtin' | 'duplicate'

export interface CameraScopeBuiltInLabels {
  readonly all: string
  readonly humanFace: string
}

export interface CameraScopeAddResult {
  readonly collection: CameraScopeCollection
  readonly addedItem: CameraScopeItem | null
  readonly status: CameraScopeAddStatus
}

/**
 * CameraScopeItem: Immutable OOP domain entity representing one entry in the
 * top-left editable dropdown on the camera viewport. Built-in items ('all' and
 * 'human-face') are strictly non-editable and non-deletable.
 */
export class CameraScopeItem {
  public static readonly ALL_ID = 'all'
  public static readonly HUMAN_FACE_ID = 'human-face'

  public readonly id: string
  public readonly text: string
  public readonly editable: boolean

  public constructor(init: {
    readonly id: string
    readonly text: string
    readonly editable: boolean
  }) {
    this.id = init.id
    this.text = init.text
    this.editable = init.editable
  }

  public static isBuiltInId(id: string): boolean {
    return id === CameraScopeItem.ALL_ID || id === CameraScopeItem.HUMAN_FACE_ID
  }

  public get isAll(): boolean {
    return this.id === CameraScopeItem.ALL_ID
  }

  public get isBuiltIn(): boolean {
    return CameraScopeItem.isBuiltInId(this.id)
  }

  public static createAll(label: string): CameraScopeItem {
    const resolved = label.trim().length > 0 ? label.trim() : 'All'
    return new CameraScopeItem({
      id: CameraScopeItem.ALL_ID,
      text: resolved,
      editable: false,
    })
  }

  public static createHumanFace(label: string): CameraScopeItem {
    const resolved = label.trim().length > 0 ? label.trim() : 'Human Face'
    return new CameraScopeItem({
      id: CameraScopeItem.HUMAN_FACE_ID,
      text: resolved,
      editable: false,
    })
  }

  public static createCustom(text: string, id?: string): CameraScopeItem | null {
    const trimmed = text.trim()
    if (trimmed.length === 0) return null
    const resolvedId =
      typeof id === 'string' && id.trim().length > 0 && !CameraScopeItem.isBuiltInId(id.trim())
        ? id.trim()
        : 'scope-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
    return new CameraScopeItem({
      id: resolvedId,
      text: trimmed,
      editable: true,
    })
  }

  public static fromRaw(raw: unknown, fallbackIndex = 0): CameraScopeItem | null {
    if (raw === null || typeof raw !== 'object') return null
    const rec = raw as Record<string, unknown>
    const rawId = typeof rec.id === 'string' ? rec.id.trim() : ''
    if (CameraScopeItem.isBuiltInId(rawId)) return null
    const rawText = typeof rec.text === 'string' ? rec.text.trim() : ''
    if (rawText.length === 0) return null
    const id = rawId.length > 0 ? rawId : 'scope-' + (fallbackIndex + 1)
    return new CameraScopeItem({
      id,
      text: rawText,
      editable: true,
    })
  }

  public withText(nextText: string): CameraScopeItem {
    if (!this.editable || this.isBuiltIn) return this
    const trimmed = nextText.trim()
    if (trimmed.length === 0) return this
    return new CameraScopeItem({
      id: this.id,
      text: trimmed,
      editable: true,
    })
  }

  public toJSON(): CameraScopeItemData {
    return {
      id: this.id,
      text: this.text,
      editable: this.editable,
    }
  }
}

/**
 * CameraScopeCollection: Immutable OOP aggregate managing built-in locked items
 * ('All' and 'Human Face'), unbounded user-added items, selection state, inline
 * renames, and safe deletion.
 */
export class CameraScopeCollection {
  public static readonly DEFAULT_LABELS: CameraScopeBuiltInLabels = {
    all: '所有',
    humanFace: '人脸',
  }

  public readonly selectedId: string
  public readonly customItems: readonly CameraScopeItem[]

  public constructor(
    selectedId = CameraScopeItem.ALL_ID,
    customItems: readonly CameraScopeItem[] = [],
  ) {
    const deduped: CameraScopeItem[] = []
    const seenIds = new Set<string>()
    const seenTexts = new Set<string>()
    for (let i = 0; i < customItems.length; i += 1) {
      const item = customItems[i]
      const norm = item.text.trim().toLowerCase()
      if (item.isBuiltIn || norm.length === 0 || seenIds.has(item.id) || seenTexts.has(norm)) {
        continue
      }
      seenIds.add(item.id)
      seenTexts.add(norm)
      deduped.push(item)
    }
    this.customItems = deduped
    this.selectedId =
      CameraScopeItem.isBuiltInId(selectedId) || seenIds.has(selectedId)
        ? selectedId
        : CameraScopeItem.ALL_ID
  }

  public static createDefault(): CameraScopeCollection {
    return new CameraScopeCollection(CameraScopeItem.ALL_ID, [])
  }

  public static isReservedBuiltInText(
    text: string,
    labels: CameraScopeBuiltInLabels = CameraScopeCollection.DEFAULT_LABELS,
  ): boolean {
    const normalized = text.trim().toLowerCase()
    if (normalized.length === 0) return false
    return (
      normalized === 'all' ||
      normalized === '所有' ||
      normalized === 'human face' ||
      normalized === '人脸' ||
      normalized === labels.all.trim().toLowerCase() ||
      normalized === labels.humanFace.trim().toLowerCase()
    )
  }

  public static fromRaw(raw: unknown): CameraScopeCollection {
    if (raw === null || typeof raw !== 'object') return CameraScopeCollection.createDefault()
    const obj = raw as Record<string, unknown>
    const listRaw = Array.isArray(obj.customItems) ? obj.customItems : []
    const items: CameraScopeItem[] = []
    for (let i = 0; i < listRaw.length; i += 1) {
      const parsed = CameraScopeItem.fromRaw(listRaw[i], i)
      if (parsed !== null && !CameraScopeCollection.isReservedBuiltInText(parsed.text)) {
        items.push(parsed)
      }
    }
    const selectedId =
      typeof obj.selectedId === 'string' && obj.selectedId.trim().length > 0
        ? obj.selectedId.trim()
        : CameraScopeItem.ALL_ID
    return new CameraScopeCollection(selectedId, items)
  }

  public getAllItems(
    labels: CameraScopeBuiltInLabels = CameraScopeCollection.DEFAULT_LABELS,
  ): readonly CameraScopeItem[] {
    return [
      CameraScopeItem.createAll(labels.all),
      CameraScopeItem.createHumanFace(labels.humanFace),
      ...this.customItems,
    ]
  }

  public getSelectedItem(
    labels: CameraScopeBuiltInLabels = CameraScopeCollection.DEFAULT_LABELS,
  ): CameraScopeItem {
    if (this.selectedId === CameraScopeItem.HUMAN_FACE_ID) {
      return CameraScopeItem.createHumanFace(labels.humanFace)
    }
    if (this.selectedId !== CameraScopeItem.ALL_ID) {
      const found = this.customItems.find((item) => item.id === this.selectedId)
      if (found) return found
    }
    return CameraScopeItem.createAll(labels.all)
  }

  public addItem(
    rawText: string,
    labels: CameraScopeBuiltInLabels = CameraScopeCollection.DEFAULT_LABELS,
  ): CameraScopeAddResult {
    const trimmed = rawText.trim()
    if (trimmed.length === 0) {
      return { collection: this, addedItem: null, status: 'empty' }
    }
    if (CameraScopeCollection.isReservedBuiltInText(trimmed, labels)) {
      return { collection: this, addedItem: null, status: 'reserved-builtin' }
    }
    const norm = trimmed.toLowerCase()
    const exists = this.customItems.some((item) => item.text.toLowerCase() === norm)
    if (exists) {
      return { collection: this, addedItem: null, status: 'duplicate' }
    }
    const created = CameraScopeItem.createCustom(trimmed)
    if (created === null) {
      return { collection: this, addedItem: null, status: 'empty' }
    }
    return {
      collection: new CameraScopeCollection(this.selectedId, [...this.customItems, created]),
      addedItem: created,
      status: 'added',
    }
  }

  public selectItem(id: string): CameraScopeCollection {
    if (CameraScopeItem.isBuiltInId(id)) {
      return new CameraScopeCollection(id, this.customItems)
    }
    const exists = this.customItems.some((item) => item.id === id)
    if (!exists) return this
    return new CameraScopeCollection(id, this.customItems)
  }

  public renameItem(
    id: string,
    nextText: string,
    labels: CameraScopeBuiltInLabels = CameraScopeCollection.DEFAULT_LABELS,
  ): CameraScopeCollection {
    if (CameraScopeItem.isBuiltInId(id)) return this
    const trimmed = nextText.trim()
    if (trimmed.length === 0 || CameraScopeCollection.isReservedBuiltInText(trimmed, labels)) {
      return this
    }
    const norm = trimmed.toLowerCase()
    const duplicate = this.customItems.some(
      (item) => item.id !== id && item.text.toLowerCase() === norm,
    )
    if (duplicate) return this
    const nextItems = this.customItems.map((item) => (item.id === id ? item.withText(trimmed) : item))
    return new CameraScopeCollection(this.selectedId, nextItems)
  }

  public removeItem(id: string): CameraScopeCollection {
    if (CameraScopeItem.isBuiltInId(id)) return this
    const nextItems = this.customItems.filter((item) => item.id !== id)
    if (nextItems.length === this.customItems.length) return this
    const nextSelected = this.selectedId === id ? CameraScopeItem.ALL_ID : this.selectedId
    return new CameraScopeCollection(nextSelected, nextItems)
  }

  public toJSON(): CameraScopeStateData {
    return {
      selectedId: this.selectedId,
      customItems: this.customItems.map((item) => item.toJSON()),
    }
  }
}