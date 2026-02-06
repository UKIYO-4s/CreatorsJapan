import { useState } from 'react'
import { Card, CardHeader, CardContent } from '../components/common'
import { sendDiscordNotify, clearCache } from '../lib/api'
import type { Site } from '../types'

interface SettingsProps {
  site: Site
}

export function Settings({ site }: SettingsProps) {
  const [notifying, setNotifying] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSendMonthlyReport = async () => {
    setNotifying(true)
    setMessage(null)
    try {
      const result = await sendDiscordNotify(site, 'monthly')
      if (result.sent) {
        setMessage({ type: 'success', text: '月次レポートをDiscordに送信しました' })
      } else {
        setMessage({ type: 'error', text: '通知の送信に失敗しました' })
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setNotifying(false)
    }
  }

  const handleClearCache = async () => {
    setClearing(true)
    setMessage(null)
    try {
      const result = await clearCache()
      setMessage({
        type: 'success',
        text: `キャッシュをクリアしました（${result.cleared}件）`,
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Discord通知 */}
        <Card>
          <CardHeader
            title="Discord通知"
            subtitle="レポートをDiscordに送信"
          />
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              月次レポートのサマリーを設定済みのDiscord Webhookに送信します。
            </p>
            <button
              onClick={handleSendMonthlyReport}
              disabled={notifying}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {notifying ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  送信中...
                </>
              ) : (
                '月次レポートを送信'
              )}
            </button>
          </CardContent>
        </Card>

        {/* キャッシュ管理 */}
        <Card>
          <CardHeader
            title="キャッシュ管理"
            subtitle="キャッシュデータをクリア"
          />
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              すべてのAPIキャッシュをクリアします。次回リクエスト時にデータが再取得されます。
            </p>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {clearing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  クリア中...
                </>
              ) : (
                'すべてのキャッシュをクリア'
              )}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* サイト情報 */}
      <Card>
        <CardHeader title="サイト情報" />
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">現在のサイト</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {site === 'public' ? 'CREATORS JAPAN' : 'Salon'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">API Endpoint</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">/api</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
