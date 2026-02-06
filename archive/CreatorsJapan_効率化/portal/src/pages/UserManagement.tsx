import { useState, useEffect } from 'react'
import { Card, CardContent, PageLoading, ErrorDisplay } from '../components/common'
import type { UserManagementData, Site, UserPermissions, ApiResponse } from '../types'

interface UserFormData {
  email: string
  password: string
  displayName: string
  isAdmin: boolean
  permissions: UserPermissions
  sites: Site[]
}

const defaultFormData: UserFormData = {
  email: '',
  password: '',
  displayName: '',
  isAdmin: false,
  permissions: {
    dashboard: true,
    ga4: false,
    gsc: false,
    articles: false,
  },
  sites: [],
}

export function UserManagement() {
  const [users, setUsers] = useState<UserManagementData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserManagementData | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<UserFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      const data: ApiResponse<UserManagementData[]> = await response.json()
      if (data.success) {
        setUsers(data.data)
      } else {
        setError(data.error.message)
      }
    } catch {
      setError('ユーザーの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = () => {
    setFormData(defaultFormData)
    setSelectedUser(null)
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (user: UserManagementData) => {
    setFormData({
      email: user.email,
      password: '',
      displayName: user.displayName || '',
      isAdmin: user.isAdmin,
      permissions: user.permissions,
      sites: user.sites,
    })
    setSelectedUser(user)
    setIsEditing(true)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      if (isEditing && selectedUser) {
        const response = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: formData.displayName || undefined,
            password: formData.password || undefined,
            isAdmin: formData.isAdmin,
            permissions: formData.permissions,
            sites: formData.sites,
          }),
        })
        const data: ApiResponse<UserManagementData> = await response.json()
        if (!data.success) {
          throw new Error(data.error.message)
        }
        setMessage({ type: 'success', text: 'ユーザーを更新しました' })
      } else {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        const data: ApiResponse<{ id: string; created: boolean }> = await response.json()
        if (!data.success) {
          throw new Error(data.error.message)
        }
        setMessage({ type: 'success', text: 'ユーザーを作成しました' })
      }
      setShowModal(false)
      fetchUsers()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '不明なエラー',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: UserManagementData) => {
    if (!confirm(`${user.email} を削除しますか？`)) return

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      })
      const data: ApiResponse<{ deleted: boolean }> = await response.json()
      if (!data.success) {
        throw new Error(data.error.message)
      }
      setMessage({ type: 'success', text: 'ユーザーを削除しました' })
      fetchUsers()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ユーザーの削除に失敗しました',
      })
    }
  }

  const handleToggleActive = async (user: UserManagementData) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const data: ApiResponse<UserManagementData> = await response.json()
      if (!data.success) {
        throw new Error(data.error.message)
      }
      fetchUsers()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ユーザーの更新に失敗しました',
      })
    }
  }

  if (loading) return <PageLoading />
  if (error) return <ErrorDisplay message={error} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          ユーザー追加
        </button>
      </div>

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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ユーザー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    権限
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    機能
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    サイト
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    状態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        {user.displayName && (
                          <div className="text-sm text-gray-500">{user.displayName}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.isAdmin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.isAdmin ? '管理者' : 'ユーザー'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {user.permissions.dashboard && <PermBadge label="D" title="ダッシュボード" />}
                        {user.permissions.ga4 && <PermBadge label="GA" title="GA4" />}
                        {user.permissions.gsc && <PermBadge label="GSC" title="Search Console" />}
                        {user.permissions.articles && <PermBadge label="A" title="記事" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {user.sites.includes('public') && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Public
                          </span>
                        )}
                        {user.sites.includes('salon') && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            Salon
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.isActive ? '有効' : '無効'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {isEditing ? 'ユーザー編集' : 'ユーザー作成'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isEditing}
                  required={!isEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード {isEditing && '（変更しない場合は空欄）'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!isEditing}
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={formData.isAdmin}
                  onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700">
                  管理者（全機能アクセス可）
                </label>
              </div>

              {!formData.isAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      機能権限
                    </label>
                    <div className="space-y-2">
                      {[
                        { key: 'dashboard', label: 'ダッシュボード' },
                        { key: 'ga4', label: 'GA4 レポート' },
                        { key: 'gsc', label: 'GSC レポート' },
                        { key: 'articles', label: '記事一覧' },
                      ].map((perm) => (
                        <label key={perm.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.permissions[perm.key as keyof UserPermissions]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                permissions: {
                                  ...formData.permissions,
                                  [perm.key]: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      サイトアクセス
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: 'public' as Site, label: 'CREATORS JAPAN (Public)' },
                        { id: 'salon' as Site, label: 'Salon' },
                      ].map((site) => (
                        <label key={site.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.sites.includes(site.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  sites: [...formData.sites, site.id],
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  sites: formData.sites.filter((s) => s !== site.id),
                                })
                              }
                            }}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">{site.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : isEditing ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PermBadge({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className="w-6 h-6 flex items-center justify-center text-xs font-medium bg-primary-100 text-primary-800 rounded"
    >
      {label}
    </span>
  )
}
