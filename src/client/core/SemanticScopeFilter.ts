import type { BoundingBox, RecognizedDetection, VectorSearchCandidate } from '../../invariant'
import { CameraScopeItem } from './CameraScopeModels'
import { CutoutAugmenter } from './CutoutAugmenter'
import { FastSamInferenceEngine } from './FastSamInferenceEngine'

export interface SemanticScopePrototype {
  readonly scopeKey: string
  readonly positiveTextCentroid: readonly number[]
  readonly negativeTextVectors: readonly (readonly number[])[]
  readonly visualCentroid: readonly number[] | null
}

export interface DueScopeTrack {
  readonly trackId: number
  readonly queryCutoutUrl: string
  readonly rawPocketUrl: string
  readonly box: BoundingBox
}

interface ScopeTrackState {
  readonly trackId: number
  lastBox: BoundingBox
  lastSeenMs: number
  seenFrames: number
  bestQuality: number
  bestQueryCutoutUrl: string | null
  bestRawPocketUrl: string | null
  lastScoredMs: number
  lastScopeScore: number | null
  lastVector: readonly number[] | null
  recognizedTargetId: string | null
  recognizedTitle: string | null
  recognizedSimilarity: number
  recognizedAt: number
}

/**
 * SemanticScopeFilter: Real-time embedding-based semantic filtering layer positioned
 * directly above GranularityFilter. Reuses EmbeddingGemma 2's shared 768-d Vision+Text
 * space with contrastive positive/negative prompt scoring + optional few-shot visual
 * prototype fusion from the browser vector DB. Supports multi-instance tracking at full
 * FastSAM-s FPS and reuses the exact same 768-d image vector for downstream Pocket search.
 */
export class SemanticScopeFilter {
  public static readonly NEGATIVE_PROMPTS = [
    'background wall floor ceiling',
    'an empty desk table or room surface',
    'an unrelated everyday object',
    'blurry edge shadow or noise',
  ] as const
  private static readonly NEGATIVE_CONFLICT_TOKENS: readonly (readonly string[])[] = [
    ['wall', 'floor', 'ceiling', 'background', '墙', '壁', '地板', '天花板', '背景'],
    ['desk', 'table', 'room', 'surface', '桌', '台面', '房间'],
    ['object', 'clutter', 'thing', 'item', '杂物', '小东西', '物件', '物品'],
    ['shadow', 'edge', 'noise', 'blur', '阴影', '边缘', '噪点'],
  ]
  private static readonly HUMAN_FACE_KEYWORDS = [
    'face', 'human face', 'portrait', 'head', 'person', 'people', 'man', 'woman', 'dad', 'mom', 'papa', 'mama', 'father', 'mother',
    '人脸', '脸', '人像', '头像', '肖像', '爸爸', '妈妈',
  ] as const
  public static readonly POST_RECOG_TEXT_SIM_FLOOR = 0.42
  public static readonly COMPETITIVE_MARGIN = 0.08
  public static readonly SOFTMAX_TEMPERATURE = 0.05
  public static readonly STABLE_FRAMES = 2
  public static readonly REQUERY_MS = 2000
  public static readonly TRACK_EXPIRE_MS = 1800
  public static readonly MATCH_IOU_THRESHOLD = 0.40
  public static readonly MAX_QUERIES_PER_TICK = 4

  private activeScopeKey: string | null = null
  private prototype: SemanticScopePrototype | null = null
  private nextTrackId = 1
  private readonly tracks = new Map<number, ScopeTrackState>()
  private lastBoxToTrack = new Map<string, number>()
  private readonly postRecogScoreCache = new Map<string, { readonly score: number; readonly posSim: number; readonly allowed?: boolean }>()
  private personDistractorVec: readonly number[] | null = null
  private objectDistractorVec: readonly number[] | null = null

  /**
   * Drops any default background negative prompt that overlaps the user's chosen
   * scope (e.g. searching for 'wall', '墙壁', 'desk', '杂物') so users never lose
   * the ability to filter and tag background/small/clutter targets.
   */
  public static getEffectiveNegativeIndices(scopeText: string): readonly number[] {
    const norm = scopeText.trim().toLowerCase()
    const kept: number[] = []
    for (let i = 0; i < SemanticScopeFilter.NEGATIVE_PROMPTS.length; i += 1) {
      const tokens = SemanticScopeFilter.NEGATIVE_CONFLICT_TOKENS[i] ?? []
      const conflicts = norm.length > 0 && tokens.some((tok) => norm.includes(tok))
      if (!conflicts) kept.push(i)
    }
    return kept
  }

  public static matchesLiteralMetadata(
    scopeId: string,
    scopeText: string,
    title: string,
    description: string,
  ): boolean {
    const normScope = scopeText.trim().toLowerCase()
    const normTitle = title.trim().toLowerCase()
    const normDesc = description.trim().toLowerCase()
    const combined = normTitle + ' ' + normDesc
    if (scopeId === CameraScopeItem.HUMAN_FACE_ID) {
      if (SemanticScopeFilter.HUMAN_FACE_KEYWORDS.some((kw) => combined.includes(kw))) {
        return true
      }
    }
    if (normScope.length === 0) return true
    if (combined.includes(normScope)) return true
    if (normTitle.length >= 2 && normScope.includes(normTitle)) return true
    return false
  }

  public static buildPositivePrompts(scopeId: string, scopeText: string): readonly string[] {
    if (scopeId === CameraScopeItem.HUMAN_FACE_ID) {
      return [
        'a photo of a human face',
        'a close-up portrait of a person face',
        'human face',
      ]
    }
    const trimmed = scopeText.trim()
    if (trimmed.length === 0) return ['a photo of an object']
    return [
      'a photo of ' + trimmed,
      'a close-up of ' + trimmed,
      trimmed,
    ]
  }

  public static dotProduct(a: readonly number[], b: readonly number[]): number {
    const len = Math.min(a.length, b.length)
    let sum = 0
    for (let i = 0; i < len; i += 1) {
      sum += a[i] * b[i]
    }
    return sum
  }

  public static computeCentroid(vectors: readonly (readonly number[])[]): number[] | null {
    if (vectors.length === 0) return null
    const dim = vectors[0].length
    if (dim === 0) return null
    const sum = new Float64Array(dim)
    let count = 0
    for (let i = 0; i < vectors.length; i += 1) {
      const v = vectors[i]
      if (v.length !== dim) continue
      for (let d = 0; d < dim; d += 1) sum[d] += v[d]
      count += 1
    }
    if (count === 0) return null
    let normSq = 0
    for (let d = 0; d < dim; d += 1) normSq += sum[d] * sum[d]
    const norm = Math.sqrt(normSq)
    const out = new Array<number>(dim)
    if (norm > 1e-12) {
      for (let d = 0; d < dim; d += 1) out[d] = sum[d] / norm
    } else {
      for (let d = 0; d < dim; d += 1) out[d] = 0
    }
    return out
  }

  public static scoreEmbedding(
    imgVec: readonly number[],
    prototype: SemanticScopePrototype,
  ): number {
    if (imgVec.length === 0 || prototype.positiveTextCentroid.length === 0) return 0
    const posSim = SemanticScopeFilter.dotProduct(imgVec, prototype.positiveTextCentroid)
    let maxNegSim = -1
    for (let i = 0; i < prototype.negativeTextVectors.length; i += 1) {
      const s = SemanticScopeFilter.dotProduct(imgVec, prototype.negativeTextVectors[i])
      if (s > maxNegSim) maxNegSim = s
    }
    const textProb =
      prototype.negativeTextVectors.length > 0
        ? 1 / (1 + Math.exp((maxNegSim - posSim) / SemanticScopeFilter.SOFTMAX_TEMPERATURE))
        : Math.max(0, Math.min(1, posSim))

    if (prototype.visualCentroid !== null && prototype.visualCentroid.length > 0) {
      const visSim = Math.max(0, Math.min(1, SemanticScopeFilter.dotProduct(imgVec, prototype.visualCentroid)))
      return Math.max(textProb, visSim)
    }
    return textProb
  }

  private static computeSalience(box: BoundingBox, frameW: number, frameH: number): number {
    const cx = (box.x1 + box.x2) * 0.5
    const cy = (box.y1 + box.y2) * 0.5
    const dx = (cx - frameW * 0.5) / Math.max(1, frameW * 0.5)
    const dy = (cy - frameH * 0.5) / Math.max(1, frameH * 0.5)
    const centerWeight = Math.max(0.15, 1 - Math.sqrt(dx * dx + dy * dy) * 0.65)
    const areaRatio = Math.min(1, box.area / Math.max(1, frameW * frameH))
    return Math.sqrt(areaRatio) * centerWeight * Math.max(0.1, box.score)
  }

  public reset(nextScopeKey: string | null = null): void {
    this.activeScopeKey = nextScopeKey
    this.prototype = null
    this.tracks.clear()
    this.lastBoxToTrack.clear()
    this.postRecogScoreCache.clear()
  }

  public clearPostRecognitionCache(): void {
    this.postRecogScoreCache.clear()
    this.personDistractorVec = null
    this.objectDistractorVec = null
  }

  /**
   * Post-Recognition Semantic Gate: once the vector DB identifies a track's
   * { targetId, title, description }, verify that the identified target matches the
   * active non-'All' scope before drawing its BBox or pushing it to the Pocket.
   * - For 'human-face', people are usually tagged by proper names (e.g. 'papa', 'Xinyue',
   *   'Alice'), so we also verify the target's stored visual centroid against face vs
   *   inanimate-object prototypes while rejecting clear non-face objects like 'glass'.
   */
  public async verifyRecognizedTarget(
    targetId: string,
    title: string,
    description: string,
    scopeId: string,
    scopeText: string,
    confidenceThreshold: number,
    embedTextFn: (text: string) => Promise<readonly number[]>,
    getStoredVisualCentroidFn?: (targetId: string) => Promise<readonly number[] | null>,
  ): Promise<boolean> {
    if (scopeId === CameraScopeItem.ALL_ID) return true
    if (SemanticScopeFilter.matchesLiteralMetadata(scopeId, scopeText, title, description)) {
      return true
    }
    const proto = this.prototype
    if (proto === null) return false

    const cacheKey = targetId + '|' + title + '|' + description
    const cached = this.postRecogScoreCache.get(cacheKey)
    const minScore = Math.max(0.55, confidenceThreshold)
    if (cached !== undefined) {
      if (cached.allowed !== undefined) return cached.allowed
      return cached.posSim >= SemanticScopeFilter.POST_RECOG_TEXT_SIM_FLOOR && cached.score >= minScore
    }

    const labelText = description.trim().length > 0 ? title.trim() + ' — ' + description.trim() : title.trim()
    const metaVec = await embedTextFn(labelText)
    if (metaVec.length === 0) return false

    if (scopeId === CameraScopeItem.HUMAN_FACE_ID) {
      if (this.objectDistractorVec === null) {
        this.objectDistractorVec = await embedTextFn('eyeglasses glasses cup mug bottle phone keyboard toy bag desk wall object accessory')
      }
      if (this.personDistractorVec === null) {
        this.personDistractorVec = await embedTextFn('a human person face portrait name dad mom papa friend family member')
      }
      const objTextSim = this.objectDistractorVec.length > 0 ? SemanticScopeFilter.dotProduct(metaVec, this.objectDistractorVec) : 0
      const personTextSim = this.personDistractorVec.length > 0 ? SemanticScopeFilter.dotProduct(metaVec, this.personDistractorVec) : 0
      // If the label clearly names an inanimate object/accessory (like 'glass' / 'cup'), reject immediately
      if (objTextSim > personTextSim + 0.04) {
        this.postRecogScoreCache.set(cacheKey, { score: 0, posSim: 0, allowed: false })
        return false
      }
      // Verify the target's actual stored image centroid in IndexedDB looks like a human face
      const storedImgCentroid = getStoredVisualCentroidFn ? await getStoredVisualCentroidFn(targetId) : null
      if (storedImgCentroid !== null && storedImgCentroid.length > 0) {
        const faceImgSim = SemanticScopeFilter.dotProduct(storedImgCentroid, proto.positiveTextCentroid)
        let maxNonFaceImgSim = -1
        for (let i = 0; i < proto.negativeTextVectors.length; i += 1) {
          const s = SemanticScopeFilter.dotProduct(storedImgCentroid, proto.negativeTextVectors[i])
          if (s > maxNonFaceImgSim) maxNonFaceImgSim = s
        }
        if (this.objectDistractorVec.length > 0) {
          const objImgSim = SemanticScopeFilter.dotProduct(storedImgCentroid, this.objectDistractorVec)
          if (objImgSim > maxNonFaceImgSim) maxNonFaceImgSim = objImgSim
        }
        const faceImgProb =
          maxNonFaceImgSim > -1
            ? 1 / (1 + Math.exp((maxNonFaceImgSim - faceImgSim) / SemanticScopeFilter.SOFTMAX_TEMPERATURE))
            : Math.max(0, Math.min(1, faceImgSim))
        const allowed = faceImgProb >= Math.min(0.50, confidenceThreshold)
        this.postRecogScoreCache.set(cacheKey, { score: faceImgProb, posSim: faceImgSim, allowed })
        return allowed
      }
      const allowed = personTextSim >= objTextSim
      this.postRecogScoreCache.set(cacheKey, { score: allowed ? 1 : 0, posSim: personTextSim, allowed })
      return allowed
    }

    const posSim = SemanticScopeFilter.dotProduct(metaVec, proto.positiveTextCentroid)
    let maxNegSim = -1
    for (let i = 0; i < proto.negativeTextVectors.length; i += 1) {
      const s = SemanticScopeFilter.dotProduct(metaVec, proto.negativeTextVectors[i])
      if (s > maxNegSim) maxNegSim = s
    }
    if (this.personDistractorVec === null) {
      this.personDistractorVec = await embedTextFn('a human person face portrait name dad mom papa friend family member')
    }
    if (this.personDistractorVec.length > 0) {
      const personSim = SemanticScopeFilter.dotProduct(metaVec, this.personDistractorVec)
      if (personSim > maxNegSim) maxNegSim = personSim
    }
    const score =
      maxNegSim > -1
        ? 1 / (1 + Math.exp((maxNegSim - posSim) / SemanticScopeFilter.SOFTMAX_TEMPERATURE))
        : Math.max(0, Math.min(1, posSim))

    this.postRecogScoreCache.set(cacheKey, { score, posSim })
    return posSim >= SemanticScopeFilter.POST_RECOG_TEXT_SIM_FLOOR && score >= minScore
  }

  public async selectScopedMatch(
    candidates: readonly VectorSearchCandidate[],
    scopeId: string,
    scopeText: string,
    confidenceThreshold: number,
    embedTextFn: (text: string) => Promise<readonly number[]>,
    getStoredVisualCentroidFn?: (targetId: string) => Promise<readonly number[] | null>,
  ): Promise<VectorSearchCandidate | null> {
    if (candidates.length === 0) return null
    if (scopeId === CameraScopeItem.ALL_ID) return candidates[0]
    const top1Sim = candidates[0].similarity
    for (let i = 0; i < candidates.length; i += 1) {
      const cand = candidates[i]
      if (top1Sim - cand.similarity > SemanticScopeFilter.COMPETITIVE_MARGIN) {
        break
      }
      const ok = await this.verifyRecognizedTarget(
        cand.targetId,
        cand.title,
        cand.description ?? '',
        scopeId,
        scopeText,
        confidenceThreshold,
        embedTextFn,
        getStoredVisualCentroidFn,
      )
      if (ok) return cand
    }
    return null
  }

  public getActiveScopeKey(): string | null {
    return this.activeScopeKey
  }

  public setPrototype(proto: SemanticScopePrototype | null): void {
    if (proto !== null && proto.scopeKey !== this.activeScopeKey) return
    this.prototype = proto
    if (proto !== null) {
      // Immediately re-score any already-embedded tracks with the updated prototype
      for (const track of this.tracks.values()) {
        if (track.lastVector !== null) {
          track.lastScopeScore = SemanticScopeFilter.scoreEmbedding(track.lastVector, proto)
        }
      }
    }
  }

  public getPrototype(): SemanticScopePrototype | null {
    return this.prototype
  }

  public updateFrame(
    frameCanvas: HTMLCanvasElement | null,
    liveBoxes: readonly BoundingBox[],
    frameW: number,
    frameH: number,
    nowMs: number,
    qualityFn?: (box: BoundingBox) => number,
    cropFn?: (box: BoundingBox) => { readonly queryCutoutUrl: string; readonly rawPocketUrl: string },
  ): void {
    const nextMap = new Map<string, number>()
    const claimedTracks = new Set<number>()

    const ordered = liveBoxes
      .slice()
      .sort((a, b) => SemanticScopeFilter.computeSalience(b, frameW, frameH) - SemanticScopeFilter.computeSalience(a, frameW, frameH))

    for (let i = 0; i < ordered.length; i += 1) {
      const box = ordered[i]
      const boxArea = Math.max(1, (box.x2 - box.x1) * (box.y2 - box.y1))
      let bestTrack: ScopeTrackState | null = null
      let bestIoU = 0
      for (const track of this.tracks.values()) {
        if (claimedTracks.has(track.trackId)) continue
        const iou = FastSamInferenceEngine.computeIoU(track.lastBox, box)
        if (iou <= bestIoU) continue
        const trackArea = Math.max(1, (track.lastBox.x2 - track.lastBox.x1) * (track.lastBox.y2 - track.lastBox.y1))
        const scaleRatio = Math.max(boxArea / trackArea, trackArea / boxArea)
        if (scaleRatio > 2.5 && iou < 0.55) continue
        bestIoU = iou
        bestTrack = track
      }

      let targetTrack: ScopeTrackState
      if (bestTrack !== null && bestIoU >= SemanticScopeFilter.MATCH_IOU_THRESHOLD) {
        bestTrack.lastBox = box
        bestTrack.lastSeenMs = nowMs
        bestTrack.seenFrames += 1
        targetTrack = bestTrack
      } else {
        const trackId = this.nextTrackId++
        targetTrack = {
          trackId,
          lastBox: box,
          lastSeenMs: nowMs,
          seenFrames: 1,
          bestQuality: -1,
          bestQueryCutoutUrl: null,
          bestRawPocketUrl: null,
          lastScoredMs: 0,
          lastScopeScore: null,
          lastVector: null,
          recognizedTargetId: null,
          recognizedTitle: null,
          recognizedSimilarity: 0,
          recognizedAt: 0,
        }
        this.tracks.set(trackId, targetTrack)
      }

      claimedTracks.add(targetTrack.trackId)
      nextMap.set(box.id, targetTrack.trackId)

      if (qualityFn && cropFn) {
        const q = qualityFn(box)
        if (q > targetTrack.bestQuality || targetTrack.bestQueryCutoutUrl === null) {
          const crops = cropFn(box)
          targetTrack.bestQuality = q
          targetTrack.bestQueryCutoutUrl = crops.queryCutoutUrl
          targetTrack.bestRawPocketUrl = crops.rawPocketUrl
        }
      } else if (frameCanvas !== null) {
        const q = CutoutAugmenter.computeCropQuality(frameCanvas, box)
        if (q > targetTrack.bestQuality || targetTrack.bestQueryCutoutUrl === null) {
          const cutout = CutoutAugmenter.extractTransparentCutout(frameCanvas, box)
          const rawPocket = CutoutAugmenter.extractRawBboxCrop(frameCanvas, box)
          targetTrack.bestQuality = q
          targetTrack.bestQueryCutoutUrl = cutout.toDataURL('image/png')
          targetTrack.bestRawPocketUrl = rawPocket.toDataURL('image/png')
        }
      }
    }

    this.lastBoxToTrack = nextMap

    for (const [id, track] of this.tracks.entries()) {
      if (nowMs - track.lastSeenMs > SemanticScopeFilter.TRACK_EXPIRE_MS) {
        this.tracks.delete(id)
      }
    }
  }

  public collectDueTracks(nowMs: number): readonly DueScopeTrack[] {
    if (this.prototype === null) return []
    const due: { readonly item: DueScopeTrack; readonly priority: number }[] = []
    for (const track of this.tracks.values()) {
      if (track.seenFrames < SemanticScopeFilter.STABLE_FRAMES) continue
      if (track.bestQueryCutoutUrl === null || track.bestRawPocketUrl === null) continue
      const neverScored = track.lastScopeScore === null
      const stale = nowMs - track.lastScoredMs >= SemanticScopeFilter.REQUERY_MS
      if (!neverScored && !stale) continue
      due.push({
        item: {
          trackId: track.trackId,
          queryCutoutUrl: track.bestQueryCutoutUrl,
          rawPocketUrl: track.bestRawPocketUrl,
          box: track.lastBox,
        },
        // Prioritize never-scored tracks first so newly visible targets appear fast
        priority: neverScored ? 2 : 1,
      })
    }
    due.sort((a, b) => b.priority - a.priority || b.item.box.area - a.item.box.area)
    return due.slice(0, SemanticScopeFilter.MAX_QUERIES_PER_TICK).map((d) => d.item)
  }

  public applyEmbeddingResult(
    trackId: number,
    vector: readonly number[],
    nowMs: number,
    scopeKey: string,
  ): number | null {
    if (this.activeScopeKey !== scopeKey || this.prototype === null) return null
    const track = this.tracks.get(trackId)
    if (!track) return null
    const score = SemanticScopeFilter.scoreEmbedding(vector, this.prototype)
    track.lastVector = vector
    track.lastScopeScore = score
    track.lastScoredMs = nowMs
    // Reset buffered quality so the next 2s window captures a fresh sharpest crop
    track.bestQuality = -1
    return score
  }

  public applyPocketMatchResult(
    trackId: number,
    matched: boolean,
    targetId: string | null,
    title: string | null,
    nowMs: number,
    similarity = 0,
  ): void {
    const track = this.tracks.get(trackId)
    if (!track) return
    if (matched && targetId !== null && title !== null) {
      track.recognizedTargetId = targetId
      track.recognizedTitle = title
      track.recognizedSimilarity = similarity
      track.recognizedAt = nowMs
    } else {
      track.recognizedTargetId = null
      track.recognizedTitle = null
      track.recognizedSimilarity = 0
    }
  }

  public getFilteredBoxes(
    liveBoxes: readonly BoundingBox[],
    confidenceThreshold: number,
  ): readonly BoundingBox[] {
    if (liveBoxes.length === 0 || this.prototype === null) return []
    const kept: BoundingBox[] = []
    for (let i = 0; i < liveBoxes.length; i += 1) {
      const box = liveBoxes[i]
      const trackId = this.lastBoxToTrack.get(box.id)
      if (trackId === undefined) continue
      const track = this.tracks.get(trackId)
      if (!track || track.lastScopeScore === null) continue
      if (track.lastScopeScore >= confidenceThreshold) {
        kept.push(box)
      }
    }
    return kept
  }

  public getBestScore(liveBoxes: readonly BoundingBox[]): number | null {
    let best: number | null = null
    for (let i = 0; i < liveBoxes.length; i += 1) {
      const trackId = this.lastBoxToTrack.get(liveBoxes[i].id)
      if (trackId === undefined) continue
      const track = this.tracks.get(trackId)
      if (!track || track.lastScopeScore === null) continue
      if (best === null || track.lastScopeScore > best) {
        best = track.lastScopeScore
      }
    }
    return best
  }

  public getRecognizedDetections(
    liveBoxes: readonly BoundingBox[],
    confidenceThreshold: number,
  ): readonly RecognizedDetection[] {
    if (liveBoxes.length === 0 || this.prototype === null) return []
    const out: RecognizedDetection[] = []
    for (let i = 0; i < liveBoxes.length; i += 1) {
      const box = liveBoxes[i]
      const trackId = this.lastBoxToTrack.get(box.id)
      if (trackId === undefined) continue
      const track = this.tracks.get(trackId)
      if (!track || track.lastScopeScore === null || track.lastScopeScore < confidenceThreshold) continue
      if (track.recognizedTargetId !== null && track.recognizedTitle !== null) {
        out.push({
          targetId: track.recognizedTargetId,
          title: track.recognizedTitle,
          x1: box.x1,
          y1: box.y1,
          x2: box.x2,
          y2: box.y2,
          colorIndex: box.colorIndex,
          recognizedAt: track.recognizedAt,
          similarity: track.recognizedSimilarity,
        })
      }
    }
    return out
  }
}