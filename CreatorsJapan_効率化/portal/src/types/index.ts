// ========================================
// 共通型定義
// ========================================

export type Site = 'public' | 'salon';
export type Role = 'admin' | 'client';

// ========================================
// ユーザー関連
// ========================================

export interface User {
  email: string;
  role: Role;
}

export interface UserPermissions {
  dashboard: boolean;
  ga4: boolean;
  gsc: boolean;
  articles: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  permissions: UserPermissions;
  sites: Site[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserManagementData extends AuthUser {
  isActive: boolean;
  createdAt: string;
}

// ========================================
// 記事データ
// ========================================

export interface Article {
  id?: number;
  url: string;
  title: string;
  publishedDate: string;
  ogImage?: string;
  excerpt?: string;
  category?: string;
  author?: string; // Salonのみ
}

export interface ArticleFilters {
  categories: string[];
  authors: string[]; // Salonのみ
  months: string[];
}

export interface ArticlePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ArticlesResponse {
  articles: Article[];
  pagination: ArticlePagination;
  filters: ArticleFilters;
  lastSyncAt: string | null;
}

export interface ArticleFetchParams {
  page?: number;
  limit?: number;
  category?: string;
  author?: string;
  month?: string;
}

export interface ArticleSyncResponse {
  synced: boolean;
  insertedCount: number;
  updatedCount: number;
  totalCount: number;
  wpArticleCount: number;
  forceSync: boolean;
}

// ========================================
// GA4レポート
// ========================================

export interface GA4Summary {
  pageViews: number;
  users: number;
  newUsers: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export interface GA4DailyData {
  date: string;
  pageViews: number;
  users: number;
}

export interface GA4TopPage {
  path: string;
  title: string;
  views: number;
}

export interface GA4Report {
  period: string;
  summary: GA4Summary;
  dailyData: GA4DailyData[];
  topPages: GA4TopPage[];
  comparison?: {
    pageViewsChange: number;
    usersChange: number;
  };
}

export interface GAResponse {
  report: GA4Report;
  fromCache: boolean;
  cachedAt?: string;
}

// ========================================
// Search Console レポート
// ========================================

export interface GSCSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCReport {
  period: string;
  summary: GSCSummary;
  topQueries: GSCQuery[];
  topPages: GSCPage[];
}

export interface GSCResponse {
  report: GSCReport;
  fromCache: boolean;
  cachedAt?: string;
}

// ========================================
// 月次サマリー
// ========================================

export interface MonthlySummary {
  id: number;
  site: Site;
  yearMonth: string;
  gaSummary: GA4Summary | null;
  gscSummary: GSCSummary | null;
  articleCount: number;
  discordNotifiedAt: string | null;
  createdAt: string;
}

// ========================================
// API レスポンス
// ========================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    fromCache: boolean;
    cachedAt?: string;
    requestId: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ========================================
// エラーコード
// ========================================

export enum ErrorCode {
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_SITE = 'INVALID_SITE',
  INVALID_PERIOD = 'INVALID_PERIOD',
  GA4_API_ERROR = 'GA4_API_ERROR',
  GSC_API_ERROR = 'GSC_API_ERROR',
  SCRAPE_ERROR = 'SCRAPE_ERROR',
  DISCORD_ERROR = 'DISCORD_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  KV_ERROR = 'KV_ERROR',
  D1_ERROR = 'D1_ERROR',
}

// ========================================
// Cloudflare Bindings
// ========================================

export interface Env {
  CACHE: KVNamespace;
  DB: D1Database;
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  DISCORD_WEBHOOK_URL_PUBLIC: string;
  DISCORD_WEBHOOK_URL_SALON: string;
  GA4_PROPERTY_ID_PUBLIC: string;
  GA4_PROPERTY_ID_SALON: string;
  ADMIN_EMAILS: string;
  SITE_URL_PUBLIC: string;
  SITE_URL_SALON: string;
}
