import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Site } from '../types'

interface SiteContextType {
  currentSite: Site
  setSite: (site: Site) => void
}

const SiteContext = createContext<SiteContextType | null>(null)

interface SiteProviderProps {
  children: ReactNode
}

// テーマをドキュメントに適用
function applyTheme(site: Site) {
  const root = document.documentElement
  root.classList.remove('theme-public', 'theme-salon')
  root.classList.add(`theme-${site}`)
}

export function SiteProvider({ children }: SiteProviderProps) {
  const [currentSite, setCurrentSite] = useState<Site>(() => {
    const saved = localStorage.getItem('currentSite')
    return (saved === 'public' || saved === 'salon') ? saved : 'public'
  })

  // 初期テーマ適用
  useEffect(() => {
    applyTheme(currentSite)
  }, [])

  const setSite = (site: Site) => {
    setCurrentSite(site)
    localStorage.setItem('currentSite', site)
    applyTheme(site)
  }

  return (
    <SiteContext.Provider value={{ currentSite, setSite }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  const context = useContext(SiteContext)
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider')
  }
  return context
}
