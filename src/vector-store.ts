import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Document } from '@langchain/core/documents'
import { Embeddings } from '@langchain/core/embeddings'
import { FaissStore } from '@langchain/community/vectorstores/faiss'
import type {
  SaveTaggedTargetRequest,
  SaveTaggedTargetResponse,
  TagVectorMetadata,
  VectorSearchMatchResult,
  VectorSearchRequest,
  VectorSearchResponse,
  VectorStoreStatsResponse,
  VectorTableRow,
} from './invariant'

/**
 * PrecomputedLangChainEmbeddings: LangChain Embeddings adapter used by FaissStore
 * when client-computed EmbeddingGemma 2 vectors are indexed.
 */
export class PrecomputedLangChainEmbeddings extends Embeddings {
  private readonly dimension: number

  public constructor(dimension = 768) {
    super({})
    this.dimension = dimension
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array<number>(this.dimension).fill(0))
  }

  public async embedQuery(_text: string): Promise<number[]> {
    return new Array<number>(this.dimension).fill(0)
  }
}

/**
 * TargetVectorRepository: OOP LangChain + FAISS repository storing 6 image-vector
 * indices per tagged object pointing to shared title/description metadata.
 */
export class TargetVectorRepository {
  private readonly indexDir: string
  private readonly embeddings: PrecomputedLangChainEmbeddings
  private store: FaissStore | null = null

  public constructor(indexDir: string, dimension = 768) {
    this.indexDir = indexDir
    this.embeddings = new PrecomputedLangChainEmbeddings(dimension)
  }

  private async ensureStore(): Promise<FaissStore> {
    if (this.store !== null) return this.store
    const indexFile = join(this.indexDir, 'faiss.index')
    const docstoreFile = join(this.indexDir, 'docstore.json')
    if (existsSync(indexFile) && existsSync(docstoreFile)) {
      this.store = await FaissStore.load(this.indexDir, this.embeddings)
    } else {
      this.store = new FaissStore(this.embeddings, {})
    }
    return this.store
  }

  public async saveTarget(payload: SaveTaggedTargetRequest): Promise<SaveTaggedTargetResponse> {
    const title = payload.title.trim()
    const description = payload.description.trim()
    if (title.length === 0 || description.length === 0) {
      throw new Error('Title and description are both required')
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('At least one image vector item is required')
    }

    const store = await this.ensureStore()
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
      const vectorHead = item.vector.slice(0, 5)
      const vectorTail = item.vector.slice(-5)
      const metadata: TagVectorMetadata = {
        targetId,
        title,
        description,
        imageKind: item.imageKind,
        isOriginal,
        augmentation: isOriginal ? null : item.imageKind,
        vectorHead,
        vectorTail,
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

    await store.addVectors(vectors, documents, { ids })
    await mkdir(this.indexDir, { recursive: true })
    await store.save(this.indexDir)

    const stats = await this.getStats()
    return {
      ok: true,
      targetId,
      insertedCount: vectors.length,
      totalVectors: stats.totalVectors,
      totalTargets: stats.totalTargets,
      indexDir: this.indexDir,
    }
  }

  public async getStats(): Promise<VectorStoreStatsResponse> {
    const indexFile = join(this.indexDir, 'faiss.index')
    const docstoreFile = join(this.indexDir, 'docstore.json')
    if (this.store === null && (!existsSync(indexFile) || !existsSync(docstoreFile))) {
      return { totalVectors: 0, totalTargets: 0, indexDir: this.indexDir }
    }
    const store = await this.ensureStore()
    const docMap = store.getDocstore()._docs
    const targetIds = new Set<string>()
    let totalVectors = 0
    for (const doc of docMap.values()) {
      totalVectors += 1
      const tid = (doc.metadata as Partial<TagVectorMetadata> | undefined)?.targetId
      if (typeof tid === 'string' && tid.length > 0) targetIds.add(tid)
    }
    return {
      totalVectors,
      totalTargets: targetIds.size,
      indexDir: this.indexDir,
    }
  }

  public async listAllEntries(): Promise<VectorStoreStatsResponse> {
    const indexFile = join(this.indexDir, 'faiss.index')
    const docstoreFile = join(this.indexDir, 'docstore.json')
    if (this.store === null && (!existsSync(indexFile) || !existsSync(docstoreFile))) {
      return { totalVectors: 0, totalTargets: 0, indexDir: this.indexDir, entries: [] }
    }
    const store = await this.ensureStore()
    const mapping = store.getMapping()
    const docstore = store.getDocstore()
    const entries: VectorTableRow[] = []
    const targetIds = new Set<string>()
    const numericKeys = Object.keys(mapping)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)

    let rawIndexBuf: Buffer | null = null
    let rawDataOffset = 0
    let indexDim = 768
    try {
      const ntotal = store.index.ntotal()
      indexDim = store.index.getDimension()
      if (ntotal > 0 && indexDim > 0) {
        rawIndexBuf = store.index.toBuffer()
        const expectedFloatBytes = ntotal * indexDim * 4
        if (rawIndexBuf.length >= expectedFloatBytes) {
          rawDataOffset = rawIndexBuf.length - expectedFloatBytes
        } else {
          rawIndexBuf = null
        }
      }
    } catch {
      rawIndexBuf = null
    }

    for (let i = 0; i < numericKeys.length; i += 1) {
      const docId = mapping[numericKeys[i]]
      if (!docId) continue
      const doc = docstore.search(docId)
      if (!doc) continue
      const meta = (doc.metadata ?? {}) as Partial<TagVectorMetadata>
      if (typeof meta.targetId === 'string' && meta.targetId.length > 0) {
        targetIds.add(meta.targetId)
      }
      const kind = meta.imageKind ?? 'original'
      let vectorHead = Array.isArray(meta.vectorHead) && meta.vectorHead.length > 0 ? meta.vectorHead : []
      let vectorTail = Array.isArray(meta.vectorTail) && meta.vectorTail.length > 0 ? meta.vectorTail : []
      const numericSlot = numericKeys[i]
      if ((vectorHead.length === 0 || vectorTail.length === 0) && rawIndexBuf !== null && indexDim >= 5) {
        const vecBase = rawDataOffset + numericSlot * indexDim * 4
        if (vecBase + indexDim * 4 <= rawIndexBuf.length) {
          const h: number[] = []
          const t: number[] = []
          for (let k = 0; k < 5; k += 1) h.push(rawIndexBuf.readFloatLE(vecBase + k * 4))
          for (let k = indexDim - 5; k < indexDim; k += 1) t.push(rawIndexBuf.readFloatLE(vecBase + k * 4))
          vectorHead = h
          vectorTail = t
        }
      }
      entries.push({
        id: docId,
        targetId: typeof meta.targetId === 'string' ? meta.targetId : undefined,
        vectorHead,
        vectorTail,
        vectorDim: typeof meta.vectorDim === 'number' ? meta.vectorDim : indexDim,
        imageKind: kind,
        augmentation: meta.isOriginal ? 'original' : (meta.augmentation ?? kind),
        title: typeof meta.title === 'string' ? meta.title : '',
        description: typeof meta.description === 'string' ? meta.description : '',
        createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : 0,
      })
    }

    return {
      totalVectors: entries.length,
      totalTargets: targetIds.size,
      indexDir: this.indexDir,
      entries,
    }
  }

  public static squaredL2ToCosineSimilarity(squaredL2: number): number {
    if (!Number.isFinite(squaredL2)) return -1
    return Math.max(-1, Math.min(1, 1 - squaredL2 * 0.5))
  }

  public async searchMatches(payload: VectorSearchRequest): Promise<VectorSearchResponse> {
    const indexFile = join(this.indexDir, 'faiss.index')
    const docstoreFile = join(this.indexDir, 'docstore.json')
    if (this.store === null && (!existsSync(indexFile) || !existsSync(docstoreFile))) {
      return {
        results: payload.vectors.map((_, index) => ({
          index,
          matched: false,
          targetId: null,
          title: null,
          similarity: 0,
        })),
      }
    }

    const store = await this.ensureStore()
    const docCount = store.getDocstore()._docs.size
    if (docCount === 0) {
      return {
        results: payload.vectors.map((_, index) => ({
          index,
          matched: false,
          targetId: null,
          title: null,
          similarity: 0,
        })),
      }
    }

    const threshold = Math.max(0, Math.min(1, Number.isFinite(payload.threshold) ? payload.threshold : 0.78))
    const results: VectorSearchMatchResult[] = []
    for (let i = 0; i < payload.vectors.length; i += 1) {
      const qVec = payload.vectors[i]
      if (!Array.isArray(qVec) || qVec.length === 0) {
        results.push({ index: i, matched: false, targetId: null, title: null, similarity: 0 })
        continue
      }
      const hits = await store.similaritySearchVectorWithScore(qVec.slice(), 1)
      if (hits.length === 0) {
        results.push({ index: i, matched: false, targetId: null, title: null, similarity: 0 })
        continue
      }
      const [doc, distance] = hits[0]
      const similarity = TargetVectorRepository.squaredL2ToCosineSimilarity(distance)
      const meta = (doc.metadata ?? {}) as Partial<TagVectorMetadata>
      const targetId = typeof meta.targetId === 'string' && meta.targetId.length > 0 ? meta.targetId : null
      const title = typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : null
      const matched = targetId !== null && similarity >= threshold
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

  public async clearAll(): Promise<void> {
    this.store = null
    await rm(this.indexDir, { recursive: true, force: true })
  }
}
