import crypto from 'node:crypto';

// Ambiguous characters (0/O, 1/I) removed so codes survive being read aloud or handwritten.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function buildReferralLink(frontendUrl: string, code: string): string {
  return `${frontendUrl.replace(/\/$/, '')}/signup?ref=${code}`;
}
