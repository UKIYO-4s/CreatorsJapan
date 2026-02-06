import { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SiteSelector } from './SiteSelector'
import {
  DashboardIcon,
  ChartIcon,
  SearchIcon,
  DocumentIcon,
  SettingsIcon,
  UsersIcon,
  LogoutIcon,
} from './Icons'
import { useAuth } from '../../context'
import type { AuthUser } from '../../types'

interface LayoutProps {
  children: ReactNode
  user: AuthUser
}

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission?: 'dashboard' | 'ga4' | 'gsc' | 'articles'
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'ダッシュボード', icon: DashboardIcon, permission: 'dashboard' },
  { path: '/ga', label: 'GA4 レポート', icon: ChartIcon, permission: 'ga4' },
  { path: '/gsc', label: 'GSC レポート', icon: SearchIcon, permission: 'gsc' },
  { path: '/articles', label: '記事一覧', icon: DocumentIcon, permission: 'articles' },
  { path: '/settings', label: '設定', icon: SettingsIcon, adminOnly: true },
  { path: '/users', label: 'ユーザー管理', icon: UsersIcon, adminOnly: true },
]

export function Layout({ children, user }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  // 権限に基づいてナビゲーションをフィルタリング
  const filteredNavItems = navItems.filter((item) => {
    // 管理者は全てアクセス可能
    if (user.isAdmin) return true
    // 管理者専用ページは非表示
    if (item.adminOnly) return false
    // 権限チェック
    if (item.permission && !user.permissions[item.permission]) return false
    return true
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* サイドバー */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* ロゴ */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link to="/" className="text-xl font-bold text-primary-700">
            CJ Portal
          </Link>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 rounded-lg
                      transition-colors duration-150
                      ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ユーザー情報 */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-medium">
                {user.email[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.displayName || user.email}
              </p>
              <p className="text-xs text-gray-500">
                {user.isAdmin ? '管理者' : 'ユーザー'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogoutIcon className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 bg-gray-50">
        {/* ヘッダー */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <SiteSelector allowedSites={user.sites} />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString('ja-JP')}
            </span>
          </div>
        </header>

        {/* コンテンツ */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
