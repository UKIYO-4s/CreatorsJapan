/**
 * 初期管理者ユーザー作成スクリプト
 * 実行: npx tsx scripts/create-admin.ts
 */

const ITERATIONS = 100000;
const HASH_LENGTH = 32;

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));

  return `${ITERATIONS}$${saltB64}$${hashB64}`;
}

async function main() {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'admin123';

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  console.log('-- 初期管理者作成SQL --');
  console.log(`-- Email: ${email}`);
  console.log(`-- Password: ${password}`);
  console.log('');
  console.log(`INSERT INTO users (id, email, password_hash, display_name, is_admin, is_active)`);
  console.log(`VALUES ('${userId}', '${email}', '${passwordHash}', 'Administrator', 1, 1);`);
  console.log('');
  console.log(`INSERT INTO user_permissions (user_id, can_dashboard, can_ga4, can_gsc, can_articles)`);
  console.log(`VALUES ('${userId}', 1, 1, 1, 1);`);
  console.log('');
  console.log(`INSERT INTO user_site_access (user_id, site) VALUES ('${userId}', 'public');`);
  console.log(`INSERT INTO user_site_access (user_id, site) VALUES ('${userId}', 'salon');`);
}

main();
