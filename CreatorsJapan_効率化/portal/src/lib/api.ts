import type {
  Site,
  ArticlesResponse,
  ArticleFetchParams,
  ArticleSyncResponse,
  GAResponse,
  GSCResponse,
  MonthlySummary,
  ApiResponse,
} from '../types'

const API_BASE = '/api'

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const data = await response.json() as ApiResponse<T>

  if (!data.success) {
    throw new Error(data.error.message)
  }

  return data.data
}

// 記事一覧取得
export async function fetchArticles(
  site: Site,
  params?: ArticleFetchParams
): Promise<ArticlesResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.category) searchParams.set('category', params.category)
  if (params?.author) searchParams.set('author', params.author)
  if (params?.month) searchParams.set('month', params.month)

  const queryString = searchParams.toString()
  const url = queryString ? `/articles/${site}?${queryString}` : `/articles/${site}`
  return fetchApi<ArticlesResponse>(url)
}

// 記事同期（管理者のみ）
export async function syncArticles(
  site: Site,
  forceSync = false
): Promise<ArticleSyncResponse> {
  const params = forceSync ? '?forceSync=true' : ''
  return fetchApi<ArticleSyncResponse>(`/articles/sync/${site}${params}`, {
    method: 'POST',
  })
}

// GA4レポート取得
export async function fetchGA(
  site: Site,
  period?: string
): Promise<GAResponse> {
  const params = period ? `?period=${period}` : ''
  return fetchApi<GAResponse>(`/ga/${site}${params}`)
}

// GSCレポート取得
export async function fetchGSC(
  site: Site,
  period?: string
): Promise<GSCResponse> {
  const params = period ? `?period=${period}` : ''
  return fetchApi<GSCResponse>(`/gsc/${site}${params}`)
}

// 月次サマリー取得
export async function fetchSummaries(
  site: Site
): Promise<MonthlySummary[]> {
  return fetchApi<MonthlySummary[]>(`/summaries/${site}`)
}

// Discord通知送信
export async function sendDiscordNotify(
  site: Site,
  type: 'monthly' | 'article'
): Promise<{ sent: boolean }> {
  return fetchApi<{ sent: boolean }>('/discord/notify', {
    method: 'POST',
    body: JSON.stringify({ site, type }),
  })
}

// キャッシュクリア（管理者のみ）
export async function clearCache(): Promise<{ cleared: number }> {
  return fetchApi<{ cleared: number }>('/cache/clear', {
    method: 'POST',
  })
}
