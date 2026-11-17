import {
  API_VECTORS_PATH,
  API_VECTOR_SEARCH_PATH,
  type SaveTaggedTargetRequest,
  type SaveTaggedTargetResponse,
  type VectorSearchResponse,
  type VectorStoreStatsResponse,
} from '../../invariant'

interface TransportGlobal {
  __DSH_TRANSPORT__?: {
    fetch?: (input: string, init?: RequestInit) => Promise<Response>
  }
}

/**
 * TargetVectorClient: OOP client gateway to Host LangChain FaissStore endpoints.
 */
export class TargetVectorClient {
  private static getCarrierFetch(): (input: string, init?: RequestInit) => Promise<Response> {
    const custom = (globalThis as unknown as TransportGlobal).__DSH_TRANSPORT__?.fetch
    if (custom !== undefined) return custom
    return (input, init) => globalThis.fetch(input, init)
  }

  private static async parseJsonSafely<T>(res: Response, endpoint: string): Promise<T> {
    const rawText = await res.text()
    let parsed: (T & { error?: string }) | null = null
    if (rawText.trim().length > 0) {
      try {
        parsed = JSON.parse(rawText) as T & { error?: string }
      } catch {
        parsed = null
      }
    }
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          'Host route ' + endpoint + ' returned 404 (' + (rawText.trim() || 'not found') + '). Please restart "pnpm dsh web" to load the updated Node plugin routes.',
        )
      }
      throw new Error(parsed?.error ?? (rawText.trim() || ('HTTP ' + res.status)))
    }
    if (parsed === null) {
      throw new Error('Unexpected non-JSON response from ' + endpoint + ': ' + rawText.slice(0, 120))
    }
    return parsed
  }

  public async listEntries(): Promise<VectorStoreStatsResponse> {
    const doFetch = TargetVectorClient.getCarrierFetch()
    const res = await doFetch(API_VECTORS_PATH + '?include=entries', { method: 'GET' })
    const data = await TargetVectorClient.parseJsonSafely<VectorStoreStatsResponse>(res, API_VECTORS_PATH)
    if (data.entries === undefined && data.totalVectors > 0) {
      throw new Error(
        'Running dsh web host returned stats without entries (' + data.totalVectors + ' vectors on disk). Please restart "pnpm dsh web" so the updated Node backend loads.',
      )
    }
    return data
  }

  public async getStats(): Promise<VectorStoreStatsResponse> {
    const doFetch = TargetVectorClient.getCarrierFetch()
    const res = await doFetch(API_VECTORS_PATH, { method: 'GET' })
    return TargetVectorClient.parseJsonSafely<VectorStoreStatsResponse>(res, API_VECTORS_PATH)
  }

  public async saveTaggedTarget(payload: SaveTaggedTargetRequest): Promise<SaveTaggedTargetResponse> {
    const doFetch = TargetVectorClient.getCarrierFetch()
    const res = await doFetch(API_VECTORS_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return TargetVectorClient.parseJsonSafely<SaveTaggedTargetResponse>(res, API_VECTORS_PATH)
  }

  public async searchMatches(vectors: readonly (readonly number[])[], threshold: number): Promise<VectorSearchResponse> {
    const doFetch = TargetVectorClient.getCarrierFetch()
    const res = await doFetch(API_VECTOR_SEARCH_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vectors, threshold }),
    })
    return TargetVectorClient.parseJsonSafely<VectorSearchResponse>(res, API_VECTOR_SEARCH_PATH)
  }

  public async clearAll(): Promise<void> {
    const doFetch = TargetVectorClient.getCarrierFetch()
    await doFetch(API_VECTORS_PATH, { method: 'DELETE' })
  }
}
