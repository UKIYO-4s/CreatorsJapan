import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardHeader,
  CardContent,
  PageLoading,
  ErrorDisplay,
} from '../components/common'
import { fetchArticles, syncArticles } from '../lib/api'
import { useAuth } from '../context'
import type { Site, Article, ArticlesResponse } from '../types'

interface ArticlesProps {
  site: Site
}

const LIMIT_OPTIONS = [20, 50, 100]

export function Articles({ site }: ArticlesProps) {
  const { user } = useAuth()

  // フィルター状態
  const [category, setCategory] = useState<string>('')
  const [author, setAuthor] = useState<string>('')
  const [month, setMonth] = useState<string>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // データ状態
  const [data, setData] = useState<ArticlesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 同期状態
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // サイト切り替え時に状態をリセット
  useEffect(() => {
    setCategory('')
    setAuthor('')
    setMonth('')
    setPage(1)
    setData(null)
    setSyncMessage(null)
  }, [site])

  // 記事取得
  const fetchData = useCallback(async () => {
    console.log('[Articles] Fetching for site:', site)
    setLoading(true)
    setError(null)
    try {
      const result = await fetchArticles(site, {
        page,
        limit,
        category: category || undefined,
        author: author || undefined,
        month: month || undefined,
      })
      console.log('[Articles] Received data for site:', site, 'count:', result.pagination?.total)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '記事の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [site, page, limit, category, author, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // フィルター変更時はページを1に戻す
  const handleFilterChange = (type: 'category' | 'author' | 'month', value: string) => {
    setPage(1)
    if (type === 'category') setCategory(value)
    if (type === 'author') setAuthor(value)
    if (type === 'month') setMonth(value)
  }

  // 表示件数変更
  const handleLimitChange = (newLimit: number) => {
    setPage(1)
    setLimit(newLimit)
  }

  // 同期実行
  const handleSync = async (forceSync = false) => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await syncArticles(site, forceSync)
      setSyncMessage(
        `同期完了: ${result.insertedCount}件の新規記事を追加（合計: ${result.totalCount}件）`
      )
      // リロード
      setPage(1)
      await fetchData()
    } catch (err) {
      setSyncMessage(
        `同期失敗: ${err instanceof Error ? err.message : '不明なエラー'}`
      )
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !data) {
    return <PageLoading />
  }

  if (error && !data) {
    return <ErrorDisplay message={error} retry={fetchData} />
  }

  const articles = data?.articles || []
  const pagination = data?.pagination
  const filters = data?.filters
  const lastSyncAt = data?.lastSyncAt

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            記事一覧
            <span className="ml-2 px-2 py-1 text-sm rounded bg-primary-100 text-primary-800">
              {site === 'salon' ? 'Salon' : 'Public'}
            </span>
          </h1>
          {lastSyncAt && (
            <p className="text-sm text-gray-500 mt-1">
              最終同期: {new Date(lastSyncAt).toLocaleString('ja-JP')}
            </p>
          )}
        </div>

        {/* 管理者用同期ボタン */}
        {user?.isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
            >
              {syncing ? '同期中...' : '差分同期'}
            </button>
            <button
              onClick={() => handleSync(true)}
              disabled={syncing}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm"
            >
              全件同期
            </button>
          </div>
        )}
      </div>

      {/* 同期メッセージ */}
      {syncMessage && (
        <div
          className={`p-4 rounded-lg ${
            syncMessage.includes('failed')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}
        >
          {syncMessage}
        </div>
      )}

      {/* フィルターバー */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
        {/* カテゴリフィルター */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">カテゴリ:</label>
          <select
            value={category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">すべて</option>
            {filters?.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* 執筆者フィルター（Salonのみ） */}
        {site === 'salon' && filters?.authors && filters.authors.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">執筆者:</label>
            <select
              value={author}
              onChange={(e) => handleFilterChange('author', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">すべて</option>
              {filters.authors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 月フィルター */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">月:</label>
          <select
            value={month}
            onChange={(e) => handleFilterChange('month', e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">すべて</option>
            {filters?.months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* 区切り */}
        <div className="flex-1" />

        {/* 表示件数 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">表示:</label>
          <select
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {LIMIT_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}件
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 記事リスト */}
      <Card>
        <CardHeader
          title="公開記事"
          subtitle={
            pagination
              ? `${pagination.total}件（${pagination.page}/${pagination.totalPages}ページ）`
              : ''
          }
        />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : articles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {pagination?.total === 0
                ? '記事がありません。「差分同期」をクリックしてWordPressから記事を取得してください。'
                : '条件に一致する記事がありません。'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {articles.map((article, i) => (
                <ArticleItem key={article.id || i} article={article} showAuthor={site === 'salon'} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ページネーション */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            前へ
          </button>

          {/* ページ番号 */}
          <div className="flex items-center gap-1">
            {generatePageNumbers(page, pagination.totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="px-2 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  disabled={loading}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    page === p
                      ? 'bg-primary-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages || loading}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  )
}

function ArticleItem({ article, showAuthor }: { article: Article; showAuthor: boolean }) {
  const publishDate = new Date(article.publishedDate)
  const isValidDate = !isNaN(publishDate.getTime())

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      {article.ogImage && (
        <div className="flex-shrink-0 w-32 h-20 bg-gray-100 rounded overflow-hidden">
          <img
            src={article.ogImage}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">{article.title}</h3>
        {article.excerpt && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-2">{article.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          {isValidDate && (
            <span className="font-medium text-gray-600">
              {publishDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
          {article.category && (
            <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">
              {article.category}
            </span>
          )}
          {showAuthor && article.author && (
            <span className="px-2 py-0.5 bg-blue-50 rounded text-blue-600">
              {article.author}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

/**
 * ページ番号の配列を生成（省略記号付き）
 */
function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = []

  // 最初のページ
  pages.push(1)

  if (current > 3) {
    pages.push('...')
  }

  // 現在ページの前後
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i)
    }
  }

  if (current < total - 2) {
    pages.push('...')
  }

  // 最後のページ
  if (!pages.includes(total)) {
    pages.push(total)
  }

  return pages
}
