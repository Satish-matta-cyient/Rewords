import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { env } from '../config/env';
import { ValidationError } from '../errors';

const ALLOWED_IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_DOC = new Set([...ALLOWED_IMAGE, 'application/pdf']);

export const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Filenames are always regenerated from a UUID — the client-supplied name is only
 * used to read the extension, and even that is validated against the MIME type.
 */
function storageFor(folder: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureDir(path.join(uploadRoot, folder))),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
      cb(null, `${crypto.randomUUID()}${ext || '.bin'}`);
    },
  });
}

function makeUploader(folder: string, allowed: Set<string>) {
  return multer({
    storage: storageFor(folder),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    },
  });
}

export const screenshotUpload = makeUploader('submissions', ALLOWED_IMAGE);
export const creativeUpload = makeUploader('creatives', ALLOWED_DOC);
export const kycUpload = makeUploader('kyc', ALLOWED_DOC);
export const avatarUpload = makeUploader('avatars', ALLOWED_IMAGE);
export const supportUpload = makeUploader('support', ALLOWED_DOC);

export function publicUrlFor(folder: string, filename: string): string {
  return `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/uploads/${folder}/${filename}`;
}
