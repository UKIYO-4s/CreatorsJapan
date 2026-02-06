import { useState } from 'react'
import {
  StatCard,
  Card,
  CardHeader,
  CardContent,
  PageLoading,
  ErrorDisplay,
} from '../components/common'
import { useApi } from '../hooks'
import { fetchGSC } from '../lib/api'
import type { Site } from '../types'

interface GSCReportProps {
  site: Site
}

export function GSCReport({ site }: GSCReportProps) {
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data, loading, error, refetch } = useApi(
    () => fetchGSC(site, period),
    [site, period]
  )

  if (loading) {
    return <PageLoading />
  }

  if (error) {
    return <ErrorDisplay message={error} retry={refetch} />
  }

  const report = data?.report
  if (!report) {
    return <ErrorDisplay message="データがありません" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Search Console レポート</h1>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* サマリー統計 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="クリック数" value={report.summary.clicks} format="number" />
        <StatCard
          label="表示回数"
          value={report.summary.impressions}
          format="number"
        />
        <StatCard label="CTR" value={report.summary.ctr} format="percent" />
        <StatCard label="平均掲載順位" value={report.summary.position.toFixed(1)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 検索クエリ */}
        <Card>
          <CardHeader title="検索クエリ" subtitle="クリック数順" />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      クエリ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      クリック
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      表示
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CTR
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      順位
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.topQueries.map((query, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                        {query.query}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {query.clicks.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {query.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {query.ctr.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {query.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 人気ページ */}
        <Card>
          <CardHeader title="人気ページ" subtitle="クリック数順" />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ページ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      クリック
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      表示
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CTR
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      順位
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.topPages.map((page, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                        {page.page}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {page.clicks.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {page.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {page.ctr.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {page.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
