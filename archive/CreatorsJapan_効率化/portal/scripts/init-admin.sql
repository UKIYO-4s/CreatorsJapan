-- 初期管理者ユーザー作成
-- Email: shoeigoto.sd@gmail.com
-- Password: (別途管理)

INSERT OR IGNORE INTO users (id, email, password_hash, display_name, is_admin, is_active)
VALUES ('db09a9c8-4fdf-473d-9bc4-21bb0d575f90', 'shoeigoto.sd@gmail.com', '100000$mNWf6sB6N6svDklfKJryrw==$RDUECq9y1IyOWXH4Gq8J0bg9FMxNXDYJmRFgma3gU6M=', 'shoeigoto', 1, 1);

INSERT OR IGNORE INTO user_permissions (user_id, can_dashboard, can_ga4, can_gsc, can_articles)
VALUES ('db09a9c8-4fdf-473d-9bc4-21bb0d575f90', 1, 1, 1, 1);

INSERT OR IGNORE INTO user_site_access (user_id, site) VALUES ('db09a9c8-4fdf-473d-9bc4-21bb0d575f90', 'public');
INSERT OR IGNORE INTO user_site_access (user_id, site) VALUES ('db09a9c8-4fdf-473d-9bc4-21bb0d575f90', 'salon');
