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
import { fetchGA } from '../lib/api'
import type { Site } from '../types'

interface GAReportProps {
  site: Site
}

export function GAReport({ site }: GAReportProps) {
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data, loading, error, refetch } = useApi(
    () => fetchGA(site, period),
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
        <h1 className="text-2xl font-bold text-gray-900">GA4 レポート</h1>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* サマリー統計 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="PV" value={report.summary.pageViews} format="number" />
        <StatCard label="ユーザー数" value={report.summary.users} format="number" />
        <StatCard
          label="新規ユーザー"
          value={report.summary.newUsers}
          format="number"
        />
        <StatCard
          label="セッション"
          value={report.summary.sessions}
          format="number"
        />
        <StatCard
          label="平均滞在時間"
          value={report.summary.avgSessionDuration}
          format="duration"
        />
        <StatCard
          label="直帰率"
          value={report.summary.bounceRate}
          format="percent"
        />
      </div>

      {/* 日別チャート */}
      <Card>
        <CardHeader title="日別推移" subtitle={report.period} />
        <CardContent>
          <div className="h-64 flex items-end gap-1">
            {report.dailyData.map((day, i) => {
              const maxPV = Math.max(...report.dailyData.map((d) => d.pageViews))
              const height = (day.pageViews / maxPV) * 100
              return (
                <div
                  key={i}
                  className="flex-1 bg-primary-500 rounded-t hover:bg-primary-600 transition-colors group relative"
                  style={{ height: `${Math.max(height, 2)}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {day.date}: {day.pageViews.toLocaleString()} PV
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{report.dailyData[0]?.date}</span>
            <span>{report.dailyData[report.dailyData.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* 人気ページ */}
      <Card>
        <CardHeader title="人気ページ" subtitle="ページビュー順" />
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ページ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  閲覧数
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.topPages.map((page, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{i + 1}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {page.title || '無題'}
                    </div>
                    <div className="text-xs text-gray-500">{page.path}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {page.views.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
