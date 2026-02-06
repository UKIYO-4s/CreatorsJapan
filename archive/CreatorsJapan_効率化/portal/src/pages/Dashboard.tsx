import {
  StatCard,
  Card,
  CardHeader,
  CardContent,
  PageLoading,
  ErrorDisplay,
  PageViewsIcon,
  UsersIcon,
  RefreshIcon,
  ClockIcon,
  CursorClickIcon,
  EyeIcon,
  ChartIcon,
  LocationIcon,
} from '../components/common'
import { useApi } from '../hooks'
import { fetchGA, fetchGSC, fetchArticles } from '../lib/api'
import type { Site, Article } from '../types'

interface DashboardProps {
  site: Site
}

export function Dashboard({ site }: DashboardProps) {
  const {
    data: gaData,
    loading: gaLoading,
    error: gaError,
  } = useApi(() => fetchGA(site), [site])

  const {
    data: gscData,
    loading: gscLoading,
    error: gscError,
  } = useApi(() => fetchGSC(site), [site])

  const {
    data: articlesData,
    loading: articlesLoading,
    error: articlesError,
  } = useApi(() => fetchArticles(site), [site])

  const loading = gaLoading || gscLoading || articlesLoading
  const error = gaError || gscError || articlesError

  if (loading) {
    return <PageLoading />
  }

  if (error) {
    return <ErrorDisplay message={error} />
  }

  const ga = gaData?.report
  const gsc = gscData?.report
  const articles = articlesData?.articles || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <span className="text-sm text-gray-500">
          {site === 'public' ? 'CREATORS JAPAN' : 'Salon'}
        </span>
      </div>

      {/* GA4 Stats */}
      {ga && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="ページビュー"
            value={ga.summary.pageViews}
            icon={<PageViewsIcon className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            label="ユーザー数"
            value={ga.summary.users}
            icon={<UsersIcon className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            label="セッション数"
            value={ga.summary.sessions}
            icon={<RefreshIcon className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            label="平均滞在時間"
            value={ga.summary.avgSessionDuration}
            icon={<ClockIcon className="w-6 h-6" />}
            format="duration"
          />
        </div>
      )}

      {/* GSC Stats */}
      {gsc && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="クリック数"
            value={gsc.summary.clicks}
            icon={<CursorClickIcon className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            label="表示回数"
            value={gsc.summary.impressions}
            icon={<EyeIcon className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            label="CTR"
            value={gsc.summary.ctr}
            icon={<ChartIcon className="w-6 h-6" />}
            format="percent"
          />
          <StatCard
            label="平均掲載順位"
            value={gsc.summary.position.toFixed(1)}
            icon={<LocationIcon className="w-6 h-6" />}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        {ga && (
          <Card>
            <CardHeader title="人気ページ" subtitle="ページビュー順" />
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ページ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      閲覧数
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ga.topPages.slice(0, 5).map((page, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900 truncate max-w-[200px]">
                        {page.title || page.path}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 text-right">
                        {page.views.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Top Queries */}
        {gsc && (
          <Card>
            <CardHeader title="検索クエリ" subtitle="クリック数順" />
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      クエリ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      クリック数
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gsc.topQueries.slice(0, 5).map((query, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900 truncate max-w-[200px]">
                        {query.query}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 text-right">
                        {query.clicks.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Articles */}
      <Card>
        <CardHeader
          title="最新記事"
          subtitle={`${articles.length}件`}
        />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {articles.slice(0, 5).map((article, i) => (
              <ArticleRow key={i} article={article} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ArticleRow({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-6 py-4 hover:bg-gray-50 transition-colors"
    >
      <h4 className="font-medium text-gray-900 mb-1">{article.title}</h4>
      {article.excerpt && (
        <p className="text-sm text-gray-500 line-clamp-2">{article.excerpt}</p>
      )}
      <p className="text-xs text-gray-400 mt-2">
        {new Date(article.publishedDate).toLocaleDateString('ja-JP')}
      </p>
    </a>
  )
}
