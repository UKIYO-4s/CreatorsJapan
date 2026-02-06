import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context';
import { PageLoading } from './Loading';
import type { Site } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: 'dashboard' | 'ga4' | 'gsc' | 'articles';
  requiredSite?: Site;
  adminOnly?: boolean;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredSite,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoading />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Admin bypass - 管理者は全アクセス可能
  if (user.isAdmin) {
    return <>{children}</>;
  }

  // Admin-only route
  if (adminOnly) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Administrator access required.</p>
      </div>
    );
  }

  // Permission check
  if (requiredPermission && !user.permissions[requiredPermission]) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">You don't have permission to access this feature.</p>
      </div>
    );
  }

  // Site access check
  if (requiredSite && !user.sites.includes(requiredSite)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">You don't have access to this site.</p>
      </div>
    );
  }

  return <>{children}</>;
}
