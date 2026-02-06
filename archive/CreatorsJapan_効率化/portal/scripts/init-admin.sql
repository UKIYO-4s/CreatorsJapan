-- 初期管理者ユーザー作成
-- Email: admin@example.com
-- Password: admin123456

INSERT OR IGNORE INTO users (id, email, password_hash, display_name, is_admin, is_active)
VALUES ('0e92fdd1-fa4f-48f3-8f12-29fe5b36ab92', 'admin@example.com', '100000$Q7a0iCjRqToVA+qbNu3WQQ==$8H4AqsOzBwwCAV/c02VMi/ouDrORYY/UZhH9UsIqNuE=', 'Administrator', 1, 1);

INSERT OR IGNORE INTO user_permissions (user_id, can_dashboard, can_ga4, can_gsc, can_articles)
VALUES ('0e92fdd1-fa4f-48f3-8f12-29fe5b36ab92', 1, 1, 1, 1);

INSERT OR IGNORE INTO user_site_access (user_id, site) VALUES ('0e92fdd1-fa4f-48f3-8f12-29fe5b36ab92', 'public');
INSERT OR IGNORE INTO user_site_access (user_id, site) VALUES ('0e92fdd1-fa4f-48f3-8f12-29fe5b36ab92', 'salon');
