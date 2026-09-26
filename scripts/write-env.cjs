#!/usr/bin/env node
// Creates backend/.env from .env.example with real secrets filled in.
// Never overwrites an existing backend/.env.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const examplePath = path.join(root, '.env.example');
const targetPath = path.join(root, 'backend', '.env');

if (fs.existsSync(targetPath)) {
  console.log('backend/.env already exists — leaving it untouched.');
  process.exit(0);
}

let content = fs.readFileSync(examplePath, 'utf8');

const secrets = {
  JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('base64url'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
};

content = content
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secrets.JWT_SECRET}`)
  .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secrets.JWT_REFRESH_SECRET}`)
  .replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`);

fs.mkdirSync(path.join(root, 'backend'), { recursive: true });
fs.writeFileSync(targetPath, content);
console.log('Created backend/.env with freshly generated secrets.');
