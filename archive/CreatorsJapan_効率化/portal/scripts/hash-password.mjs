/**
 * パスワードハッシュ生成スクリプト (Node.js)
 * 使用: node scripts/hash-password.mjs <password>
 */
import crypto from 'crypto';

const ITERATIONS = 100000;
const HASH_LENGTH = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, 'sha256');

  const saltB64 = salt.toString('base64');
  const hashB64 = hash.toString('base64');

  return `${ITERATIONS}$${saltB64}$${hashB64}`;
}

const password = process.argv[2] || 'cjportal2026';
const hashed = hashPassword(password);

console.log('Password:', password);
console.log('Hash:', hashed);
