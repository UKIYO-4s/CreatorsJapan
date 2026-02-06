import { useEffect } from 'react'
import { useSite } from '../../context'
import type { Site } from '../../types'

interface SiteSelectorProps {
  allowedSites: Site[]
}

const sites: { id: Site; name: string }[] = [
  { id: 'public', name: 'CREATORS JAPAN' },
  { id: 'salon', name: 'Salon' },
]

export function SiteSelector({ allowedSites }: SiteSelectorProps) {
  const { currentSite, setSite } = useSite()

  // アクセス可能なサイトのみ表示
  const availableSites = sites.filter((site) => allowedSites.includes(site.id))

  // 現在選択中のサイトにアクセスできない場合、最初のサイトに切り替え
  useEffect(() => {
    if (!allowedSites.includes(currentSite) && availableSites.length > 0) {
      setSite(availableSites[0].id)
    }
  }, [allowedSites, currentSite, availableSites, setSite])

  // アクセス可能なサイトが1つだけの場合はセレクターを非表示
  if (availableSites.length <= 1) {
    const site = availableSites[0]
    if (!site) return null
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary-600" />
        <span className="text-sm font-medium text-gray-700">{site.name}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {availableSites.map((site) => (
        <button
          key={site.id}
          onClick={() => setSite(site.id)}
          className={`
            px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${
              currentSite === site.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
        >
          {site.name}
        </button>
      ))}
    </div>
  )
}
