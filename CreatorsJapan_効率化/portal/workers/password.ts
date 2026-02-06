/**
 * パスワードハッシュ処理
 * Web Crypto API (PBKDF2) - Cloudflare Workers対応
 */

const ITERATIONS = 100000;
const HASH_LENGTH = 32;

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
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

  // フォーマット: iterations$salt$hash (全てBase64)
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));

  return `${ITERATIONS}$${saltB64}$${hashB64}`;
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3) return false;

  const [iterStr, saltB64, hashB64] = parts;
  const iterations = parseInt(iterStr, 10);

  if (isNaN(iterations)) return false;

  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const storedHash = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
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
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  const computedHash = new Uint8Array(hash);

  // 定数時間比較（タイミング攻撃対策）
  if (computedHash.length !== storedHash.length) return false;

  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash[i] ^ storedHash[i];
  }

  return result === 0;
}
