import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, ProtectedRoute, PageLoading } from './components/common'
import { SiteProvider, AuthProvider, useSite, useAuth } from './context'
import { Dashboard, GAReport, GSCReport, Articles, Settings, Login, UserManagement } from './pages'

function AppContent() {
  const { user, loading } = useAuth()
  const { currentSite } = useSite()

  // 認証状態読み込み中
  if (loading) {
    return <PageLoading />
  }

  // 未ログイン
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout user={user}>
      <Routes>
        {/* ルートリダイレクト */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* ダッシュボード */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredPermission="dashboard" requiredSite={currentSite}>
              <Dashboard site={currentSite} />
            </ProtectedRoute>
          }
        />

        {/* GA4レポート */}
        <Route
          path="/ga"
          element={
            <ProtectedRoute requiredPermission="ga4" requiredSite={currentSite}>
              <GAReport site={currentSite} />
            </ProtectedRoute>
          }
        />

        {/* GSCレポート */}
        <Route
          path="/gsc"
          element={
            <ProtectedRoute requiredPermission="gsc" requiredSite={currentSite}>
              <GSCReport site={currentSite} />
            </ProtectedRoute>
          }
        />

        {/* 記事一覧 */}
        <Route
          path="/articles"
          element={
            <ProtectedRoute requiredPermission="articles" requiredSite={currentSite}>
              <Articles site={currentSite} />
            </ProtectedRoute>
          }
        />

        {/* 設定（管理者のみ） */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute adminOnly>
              <Settings site={currentSite} />
            </ProtectedRoute>
          }
        />

        {/* ユーザー管理（管理者のみ） */}
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* 旧パスからのリダイレクト */}
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
        <Route path="/client/*" element={<Navigate to="/dashboard" replace />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <h1 className="text-4xl font-bold text-gray-300 mb-4">404</h1>
              <p className="text-gray-500">Page not found</p>
            </div>
          }
        />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <AppContent />
      </SiteProvider>
    </AuthProvider>
  )
}

export default App
