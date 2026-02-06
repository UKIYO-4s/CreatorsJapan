import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  change?: number
  icon?: ReactNode
  format?: 'number' | 'percent' | 'duration'
}

function formatValue(value: string | number, format?: string): string {
  if (typeof value === 'string') return value

  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'duration':
      const mins = Math.floor(value / 60)
      const secs = value % 60
      return mins > 0 ? `${mins}分 ${secs}秒` : `${secs}秒`
    case 'number':
    default:
      return value.toLocaleString('ja-JP')
  }
}

export function StatCard({ label, value, change, icon, format }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatValue(value, format)}
          </p>
          {change !== undefined && (
            <p
              className={`text-sm mt-1 ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change >= 0 ? '+' : ''}
              {change.toFixed(1)}%
            </p>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  )
}
