#!/usr/bin/env node
/**
 * Generates cryptographically strong values for the secrets in .env.example.
 * Usage: node scripts/generate-secrets.js
 */
const crypto = require('node:crypto');

const secrets = {
  JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('base64url'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
};

console.log('\nCopy these into backend/.env:\n');
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
console.log('\nNote: changing ENCRYPTION_KEY makes existing encrypted payout details unreadable.\n');
