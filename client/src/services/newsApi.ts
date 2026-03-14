import api from './api'

export interface NewsArticle {
  id: number
  uuid: string
  title: string
  description: string | null
  snippet: string | null
  url: string
  image_url: string | null
  published_at: string
  source: string | null
  categories: string[]
  locale: string | null
  relevance_score: number | null
  is_featured: boolean
  inserted_at: string
  updated_at: string
}

export interface NewsListResponse {
  data: NewsArticle[]
}

export interface NewsArticleResponse {
  data: NewsArticle
}

export interface NewsSearchParams {
  query: string
  limit?: number
  store?: boolean
}

export interface NewsAIContextResponse {
  context: string
  article_count: number
}

/**
 * Fetches recent breaking news articles
 */
export async function fetchNews(params?: {
  limit?: number
  featured_only?: boolean
  categories?: string[]
}): Promise<NewsArticle[]> {
  const queryParams = new URLSearchParams()
  
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString())
  }
  
  if (params?.featured_only) {
    queryParams.append('featured_only', 'true')
  }
  
  if (params?.categories && params.categories.length > 0) {
    queryParams.append('categories', params.categories.join(','))
  }

  const url = `/news${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  const response = await api.get<NewsListResponse>(url)
  return response.data.data
}

/**
 * Fetches a single news article by UUID
 */
export async function fetchNewsArticle(uuid: string): Promise<NewsArticle> {
  const response = await api.get<NewsArticleResponse>(`/news/${uuid}`)
  return response.data.data
}

/**
 * Searches for news articles
 */
export async function searchNews(params: NewsSearchParams): Promise<NewsArticle[]> {
  const response = await api.post<NewsListResponse>('/news/search', params)
  return response.data.data
}

/**
 * Manually triggers a news fetch (admin only)
 */
export async function triggerNewsFetch(): Promise<void> {
  await api.post('/news/fetch')
}

/**
 * Gets formatted news context for AI
 */
export async function fetchNewsAIContext(limit?: number): Promise<NewsAIContextResponse> {
  const url = `/news/ai-context${limit ? `?limit=${limit}` : ''}`
  const response = await api.get<NewsAIContextResponse>(url)
  return response.data
}
