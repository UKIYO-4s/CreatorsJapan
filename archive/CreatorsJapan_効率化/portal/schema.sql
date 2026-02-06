-- Creators Japan Portal - D1 Schema
-- 最小限のデータのみ永続化（設計思想に基づく）

-- システム設定
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 月次サマリー（履歴用）
CREATE TABLE IF NOT EXISTS monthly_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  year_month TEXT NOT NULL,
  ga_summary TEXT,
  gsc_summary TEXT,
  article_count INTEGER DEFAULT 0,
  discord_notified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(site, year_month)
);

-- 通知ログ
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ========================================
-- ユーザー管理テーブル
-- ========================================

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  is_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 機能権限
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  can_dashboard INTEGER DEFAULT 1,
  can_ga4 INTEGER DEFAULT 0,
  can_gsc INTEGER DEFAULT 0,
  can_articles INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- サイトアクセス
CREATE TABLE IF NOT EXISTS user_site_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site TEXT NOT NULL CHECK(site IN ('public', 'salon')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, site)
);

-- セッション
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_summaries_site_month ON monthly_summaries(site, year_month);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_site_access_user ON user_site_access(user_id);

-- ========================================
-- 記事管理テーブル（差分更新対応）
-- ========================================

-- 記事テーブル
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL CHECK(site IN ('public', 'salon')),
  wp_id INTEGER,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  published_date TEXT NOT NULL,
  category TEXT,
  author TEXT,  -- Salonのみ使用
  og_image TEXT,
  excerpt TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(site, url)
);

-- 同期状態テーブル
CREATE TABLE IF NOT EXISTS article_sync (
  site TEXT PRIMARY KEY,
  last_sync_at TEXT,
  total_count INTEGER DEFAULT 0
);

-- 記事用インデックス
CREATE INDEX IF NOT EXISTS idx_articles_site ON articles(site);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(site, category);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(site, author);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(site, published_date DESC);

-- 初期設定データ
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('initialized', 'true'),
  ('version', '"1.0.0"');
