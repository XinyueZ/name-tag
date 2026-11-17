import { Document, type DocumentInterface } from '@langchain/core/documents'
import type { EmbeddingsInterface } from '@langchain/core/embeddings'
import { VectorStore } from '@langchain/core/vectorstores'
import type {
  SaveTaggedTargetRequest,
  SaveTaggedTargetResponse,
  TagVectorMetadata,
  VectorSearchMatchResult,
  VectorSearchResponse,
  VectorStoreStatsResponse,
  VectorTableRow,
} from '../../invariant'

export interface StoredVectorRecord {
  readonly id: string
  readonly vector: number[]
  readonly pageContent: string
  readonly metadata: TagVectorMetadata
}

export interface VectorStorageDriver {
  readAll(): Promise<StoredVectorRecord[]>
  putBatch(records: readonly StoredVectorRecord[]): Promise<void>
  deleteByIds(ids: readonly string[]): Promise<void>
  clear(): Promise<void>
}

/**
 * IndexedDbVectorDriver: Browser-local IndexedDB persistence driver for vectors.
 * Falls back cleanly to in-memory storage in headless unit-test environments.
 */
export class IndexedDbVectorDriver implements VectorStorageDriver {
  public static readonly DB_NAME = 'dsh-name-tag-vectors'
  public static readonly DB_VERSION = 1
  public static readonly STORE_NAME = 'vectors'
  private memoryFallback: Map<string, StoredVectorRecord> | null = null

  private static openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'))
        return
      }
      const req = indexedDB.open(IndexedDbVectorDriver.DB_NAME, IndexedDbVectorDriver.DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IndexedDbVectorDriver.STORE_NAME)) {
          db.createObjectStore(IndexedDbVectorDriver.STORE_NAME, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('Failed to open vector IndexedDB'))
    })
  }

  private ensureMemory(): Map<string, StoredVectorRecord> {
    if (this.memoryFallback === null) this.memoryFallback = new Map()
    return this.memoryFallback
  }

  public async readAll(): Promise<StoredVectorRecord[]> {
    if (typeof indexedDB === 'undefined') {
      return Array.from(this.ensureMemory().values())
    }
    const db = await IndexedDbVectorDriver.openDb()
    return new Promise<StoredVectorRecord[]>((resolve, reject) => {
      const tx = db.transaction(IndexedDbVectorDriver.STORE_NAME, 'readonly')
      const store = tx.objectStore(IndexedDbVectorDriver.STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => {
        db.close()
        resolve((req.result as StoredVectorRecord[] | undefined) ?? [])
      }
      req.onerror = () => {
        db.close()
        reject(req.error ?? new Error('Failed to read IndexedDB vectors'))
      }
    })
  }

  public async putBatch(records: readonly StoredVectorRecord[]): Promise<void> {
    if (records.length === 0) return
    if (typeof indexedDB === 'undefined') {
      const mem = this.ensureMemory()
      for (let i = 0; i < records.length; i += 1) mem.set(records[i].id, records[i])
      return
    }
    const db = await IndexedDbVectorDriver.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IndexedDbVectorDriver.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbVectorDriver.STORE_NAME)
      for (let i = 0; i < records.length; i += 1) store.put(records[i])
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error ?? new Error('Failed to persist vectors in IndexedDB'))
      }
    })
  }

  public async deleteByIds(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    if (typeof indexedDB === 'undefined') {
      const mem = this.ensureMemory()
      for (let i = 0; i < ids.length; i += 1) mem.delete(ids[i])
      return
    }
    const db = await IndexedDbVectorDriver.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IndexedDbVectorDriver.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbVectorDriver.STORE_NAME)
      for (let i = 0; i < ids.length; i += 1) store.delete(ids[i])
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error ?? new Error('Failed to delete IndexedDB vectors'))
      }
    })
  }

  public async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.ensureMemory().clear()
      return
    }
    const db = await IndexedDbVectorDriver.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IndexedDbVectorDriver.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbVectorDriver.STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => {
        db.close()
        resolve()
      }
      req.onerror = () => {
        db.close()
        reject(req.error ?? new Error('Failed to clear IndexedDB vector store'))
      }
    })
  }
}

/**
 * IndexedDbLangChainVectorStore: Pure client-side LangChain VectorStore subclass
 * backed by Browser IndexedDB with exact cosine similarity scoring.
 */
export class IndexedDbLangChainVectorStore extends VectorStore {
  public declare FilterType: (doc: DocumentInterface) => boolean
  public lc_namespace = ['name-tag', 'vectorstores', 'indexeddb']
  private readonly driver: VectorStorageDriver
  private cache: StoredVectorRecord[] | null = null

  public constructor(embeddings: EmbeddingsInterface, driver?: VectorStorageDriver) {
    super(embeddings, {})
    this.driver = driver ?? new IndexedDbVectorDriver()
  }

  public _vectorstoreType(): string {
    return 'indexeddb'
  }

  private async ensureLoaded(): Promise<StoredVectorRecord[]> {
    if (this.cache === null) {
      this.cache = await this.driver.readAll()
    }
    return this.cache
  }

  public static cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    const len = Math.min(a.length, b.length)
    if (len === 0) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < len; i += 1) {
      const va = a[i]
      const vb = b[i]
      dot += va * vb
      normA += va * va
      normB += vb * vb
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    if (denom <= 1e-12) return 0
    return Math.max(-1, Math.min(1, dot / denom))
  }

  public async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: { readonly ids?: string[] },
  ): Promise<string[]> {
    if (vectors.length !== documents.length) {
      throw new Error('Vectors and documents must have the same length')
    }
    if (vectors.length === 0) return []
    const existing = await this.ensureLoaded()
    const newRecords: StoredVectorRecord[] = []
    const outIds: string[] = []

    for (let i = 0; i < vectors.length; i += 1) {
      const id = options?.ids?.[i] ?? ('vec-' + Date.now() + '-' + i)
      const record: StoredVectorRecord = {
        id,
        vector: vectors[i].slice(),
        pageContent: documents[i].pageContent,
        metadata: documents[i].metadata as TagVectorMetadata,
      }
      newRecords.push(record)
      outIds.push(id)
    }

    await this.driver.putBatch(newRecords)
    const byId = new Map(existing.map((r) => [r.id, r]))
    for (let i = 0; i < newRecords.length; i += 1) {
      byId.set(newRecords[i].id, newRecords[i])
    }
    this.cache = Array.from(byId.values())
    return outIds
  }

  public async addDocuments(
    documents: DocumentInterface[],
    options?: { readonly ids?: string[] },
  ): Promise<string[]> {
    const texts = documents.map((d) => d.pageContent)
    const vectors = await this.embeddings.embedDocuments(texts)
    return this.addVectors(vectors, documents, options)
  }

  public async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: (doc: DocumentInterface) => boolean,
  ): Promise<[DocumentInterface, number][]> {
    const records = await this.ensureLoaded()
    if (records.length === 0 || k <= 0) return []
    const scored: { readonly doc: DocumentInterface; readonly score: number }[] = []

    for (let i = 0; i < records.length; i += 1) {
      const rec = records[i]
      const doc = new Document({
        pageContent: rec.pageContent,
        metadata: rec.metadata,
      })
      if (filter && !filter(doc)) continue
      const score = IndexedDbLangChainVectorStore.cosineSimilarity(query, rec.vector)
      scored.push({ doc, score })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, k).map((entry) => [entry.doc, entry.score])
  }

  public async delete(params?: { readonly ids?: string[]; readonly deleteAll?: boolean }): Promise<void> {
    if (params?.deleteAll || !params?.ids) {
      await this.driver.clear()
      this.cache = []
      return
    }
    await this.driver.deleteByIds(params.ids)
    if (this.cache !== null) {
      const delSet = new Set(params.ids)
      this.cache = this.cache.filter((r) => !delSet.has(r.id))
    }
  }

  public async getAllRecords(): Promise<readonly StoredVectorRecord[]> {
    return this.ensureLoaded()
  }
}

/**
 * BrowserTargetVectorRepository: Pure browser OOP repository wrapping
 * IndexedDbLangChainVectorStore for multi-user zero-server-state vector storage.
 */
export class BrowserTargetVectorRepository {
  private readonly store: IndexedDbLangChainVectorStore

  public constructor(embeddings: EmbeddingsInterface, driver?: VectorStorageDriver) {
    this.store = new IndexedDbLangChainVectorStore(embeddings, driver)
  }

  public getVectorStore(): IndexedDbLangChainVectorStore {
    return this.store
  }

  public async saveTaggedTarget(payload: SaveTaggedTargetRequest): Promise<SaveTaggedTargetResponse> {
    const title = payload.title.trim()
    const description = payload.description.trim()
    if (title.length === 0 || description.length === 0) {
      throw new Error('Title and description are both required')
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('At least one image vector item is required')
    }

    const targetId = 'target-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    const createdAt = Date.now()
    const vectors: number[][] = []
    const documents: Document<TagVectorMetadata>[] = []
    const ids: string[] = []

    for (let i = 0; i < payload.items.length; i += 1) {
      const item = payload.items[i]
      if (!Array.isArray(item.vector) || item.vector.length === 0) {
        throw new Error('Invalid embedding vector at index ' + i)
      }
      const isOriginal = item.imageKind === 'original'
      const metadata: TagVectorMetadata = {
        targetId,
        title,
        description,
        imageKind: item.imageKind,
        isOriginal,
        augmentation: isOriginal ? null : item.imageKind,
        vectorHead: item.vector.slice(0, 5),
        vectorTail: item.vector.slice(-5),
        vectorDim: item.vector.length,
        createdAt,
      }
      vectors.push(item.vector.slice())
      documents.push(
        new Document<TagVectorMetadata>({
          pageContent: title + '\n' + description,
          metadata,
        }),
      )
      ids.push(targetId + ':' + item.imageKind + ':' + i)
    }

    await this.store.addVectors(vectors, documents, { ids })
    const stats = await this.getStats()
    return {
      ok: true,
      targetId,
      insertedCount: vectors.length,
      totalVectors: stats.totalVectors,
      totalTargets: stats.totalTargets,
    }
  }

  public async searchMatches(
    vectors: readonly (readonly number[])[],
    threshold: number,
  ): Promise<VectorSearchResponse> {
    const safeThreshold = Math.max(0, Math.min(1, Number.isFinite(threshold) ? threshold : 0.78))
    const results: VectorSearchMatchResult[] = []
    for (let i = 0; i < vectors.length; i += 1) {
      const qVec = vectors[i]
      if (!Array.isArray(qVec) || qVec.length === 0) {
        results.push({ index: i, matched: false, targetId: null, title: null, similarity: 0 })
        continue
      }
      const hits = await this.store.similaritySearchVectorWithScore(qVec.slice(), 1)
      if (hits.length === 0) {
        results.push({ index: i, matched: false, targetId: null, title: null, similarity: 0 })
        continue
      }
      const [doc, similarity] = hits[0]
      const meta = (doc.metadata ?? {}) as Partial<TagVectorMetadata>
      const targetId = typeof meta.targetId === 'string' && meta.targetId.length > 0 ? meta.targetId : null
      const title = typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : null
      const matched = targetId !== null && similarity >= safeThreshold
      results.push({
        index: i,
        matched,
        targetId: matched ? targetId : null,
        title: matched ? title : null,
        similarity: Number(similarity.toFixed(4)),
      })
    }
    return { results }
  }

  public async getStats(): Promise<VectorStoreStatsResponse> {
    const records = await this.store.getAllRecords()
    const targetIds = new Set<string>()
    for (let i = 0; i < records.length; i += 1) {
      const tid = records[i].metadata?.targetId
      if (typeof tid === 'string' && tid.length > 0) targetIds.add(tid)
    }
    return {
      totalVectors: records.length,
      totalTargets: targetIds.size,
    }
  }

  public async listEntries(): Promise<VectorStoreStatsResponse> {
    const records = await this.store.getAllRecords()
    const targetIds = new Set<string>()
    const entries: VectorTableRow[] = []
    for (let i = 0; i < records.length; i += 1) {
      const rec = records[i]
      const meta = rec.metadata
      if (meta.targetId) targetIds.add(meta.targetId)
      entries.push({
        id: rec.id,
        targetId: meta.targetId,
        vectorHead: Array.isArray(meta.vectorHead) ? meta.vectorHead : rec.vector.slice(0, 5),
        vectorTail: Array.isArray(meta.vectorTail) ? meta.vectorTail : rec.vector.slice(-5),
        vectorDim: typeof meta.vectorDim === 'number' ? meta.vectorDim : rec.vector.length,
        imageKind: meta.imageKind ?? 'original',
        augmentation: meta.isOriginal ? 'original' : (meta.augmentation ?? meta.imageKind ?? 'original'),
        title: meta.title ?? '',
        description: meta.description ?? '',
        createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : 0,
      })
    }
    return {
      totalVectors: entries.length,
      totalTargets: targetIds.size,
      entries,
    }
  }

  public async clearAll(): Promise<void> {
    await this.store.delete({ deleteAll: true })
  }
}
