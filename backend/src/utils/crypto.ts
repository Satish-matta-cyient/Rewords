import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';
const key = crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();

/** Encrypts sensitive at-rest values (bank account, PAN). Format: iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed ciphertext');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

export function last4(value: string): string {
  return value.slice(-4);
}

/** UI-safe masking, e.g. XXXX XXXX 1234 */
export function maskAccount(last: string | null | undefined): string {
  return last ? `XXXX XXXX ${last}` : 'Not provided';
}

export function maskPan(last: string | null | undefined): string {
  return last ? `XXXXX${last}` : 'Not provided';
}
