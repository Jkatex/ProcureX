/* Supports the identity server workflow with reusable logic kept close to the module that owns it. */
import Busboy from 'busboy';
import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, unlink } from 'node:fs/promises';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { requestError } from '../shared/apiErrors.js';

export type ProfileImageMetadata = {
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedAt: string;
  imageRole: string;
  storage: 'local-dev';
};

export type ProfileImageContent = {
  filename: string;
  contentType: string;
  body: Buffer;
};

const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream']);
const unsafeExtensions = new Set(['.svg', '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.ps1', '.sh', '.js', '.mjs', '.cjs', '.vbs', '.html', '.htm']);
const unsafeMimes = new Set(['image/svg+xml', 'text/html', 'application/javascript', 'text/javascript', 'application/x-msdownload']);

export function maxProfileImageBytes() {
  const value = Number(process.env.PROFILE_IMAGE_MAX_BYTES ?? 2 * 1024 * 1024);
  return Number.isFinite(value) && value > 0 ? value : 2 * 1024 * 1024;
}

export async function parseAndStoreProfileImage(req: IncomingMessage, userId: string): Promise<ProfileImageMetadata> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) throw requestError('Invalid profile image payload.', 400);

  const fields: Record<string, string> = {};
  let upload: ProfileImageMetadata | null = null;
  let storedKey: string | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers as IncomingHttpHeaders, limits: { fileSize: maxProfileImageBytes(), files: 1, fields: 5 } });
      let pending = 0;
      let done = false;

      const maybeResolve = () => {
        if (done && pending === 0) resolve();
      };

      busboy.on('field', (name, value) => {
        fields[name] = value;
      });
      busboy.on('file', (name, file, info) => {
        if (name !== 'file') {
          file.resume();
          return;
        }
        pending += 1;
        storeProfileImageStream(file, {
          userId,
          filename: info.filename || 'profile-image',
          mimeType: info.mimeType || 'application/octet-stream',
          imageRole: fields.imageRole
        }).then((stored) => {
          upload = stored;
          storedKey = stored.objectKey;
        }).catch(reject).finally(() => {
          pending -= 1;
          maybeResolve();
        });
      });
      busboy.on('filesLimit', () => reject(requestError('Only one profile image can be uploaded at a time.', 400)));
      busboy.on('fieldsLimit', () => reject(requestError('Invalid profile image payload.', 400)));
      busboy.on('error', reject);
      busboy.on('finish', () => {
        done = true;
        maybeResolve();
      });
      req.pipe(busboy);
    });

    if (!upload) throw requestError('Choose a profile image to upload.', 400);
    return upload;
  } catch (error) {
    if (storedKey) await removeStoredProfileImage(storedKey).catch(() => undefined);
    throw error;
  }
}

export async function readStoredProfileImage(metadata: unknown): Promise<ProfileImageContent> {
  const image = profileImageMetadata(metadata);
  if (!image) throw requestError('Profile image was not found.', 404);
  return {
    filename: image.fileName,
    contentType: image.mimeType,
    body: await readFile(localPathForObjectKey(image.objectKey))
  };
}

export async function removeStoredProfileImage(objectKey: string) {
  await rm(localPathForObjectKey(objectKey), { force: true });
}

export function profileImageMetadata(value: unknown): ProfileImageMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<ProfileImageMetadata>;
  if (
    typeof candidate.objectKey !== 'string' ||
    typeof candidate.fileName !== 'string' ||
    typeof candidate.mimeType !== 'string' ||
    typeof candidate.checksum !== 'string' ||
    typeof candidate.uploadedAt !== 'string'
  ) {
    return null;
  }
  return {
    objectKey: candidate.objectKey,
    fileName: candidate.fileName,
    mimeType: candidate.mimeType,
    size: typeof candidate.size === 'number' ? candidate.size : 0,
    checksum: candidate.checksum,
    uploadedAt: candidate.uploadedAt,
    imageRole: typeof candidate.imageRole === 'string' ? candidate.imageRole : 'profile-image',
    storage: 'local-dev'
  };
}

async function storeProfileImageStream(
  file: NodeJS.ReadableStream,
  input: { userId: string; filename: string; mimeType: string; imageRole?: string }
): Promise<ProfileImageMetadata> {
  validateProfileImageDescriptor({ name: input.filename, mimeType: input.mimeType, size: 0 });
  const objectKey = `profile-images/${input.userId}/${Date.now()}-${randomBytes(8).toString('hex')}-${safeFilename(input.filename)}`;
  const target = localPathForObjectKey(objectKey);
  await mkdir(dirname(target), { recursive: true });
  const writer = createWriteStream(target, { flags: 'wx' });
  const hash = createHash('sha256');
  const firstChunks: Buffer[] = [];
  let size = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      let failed = false;
      file.on('data', (chunk: Buffer) => {
        if (failed) return;
        size += chunk.length;
        if (size > maxProfileImageBytes()) {
          failed = true;
          const error = requestError('Profile image exceeds the maximum upload size.', 413);
          writer.destroy(error);
          destroyReadable(file, error);
          reject(error);
          return;
        }
        if (Buffer.concat(firstChunks).length < 16) firstChunks.push(Buffer.from(chunk.subarray(0, Math.max(0, 16 - Buffer.concat(firstChunks).length))));
        hash.update(chunk);
      });
      file.on('limit', () => reject(requestError('Profile image exceeds the maximum upload size.', 413)));
      file.on('end', () => {
        if ((file as { truncated?: boolean }).truncated) reject(requestError('Profile image exceeds the maximum upload size.', 413));
      });
      file.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', resolve);
      file.pipe(writer);
    });
    const firstBytes = Buffer.concat(firstChunks);
    assertSafeImageMagicBytes(input.filename, input.mimeType, firstBytes);
    validateProfileImageDescriptor({ name: input.filename, mimeType: input.mimeType, size });
    return {
      objectKey,
      fileName: safeDisplayName(input.filename),
      mimeType: normalizedMimeType(input.filename, input.mimeType),
      size,
      checksum: hash.digest('hex'),
      uploadedAt: new Date().toISOString(),
      imageRole: safeImageRole(input.imageRole),
      storage: 'local-dev'
    };
  } catch (error) {
    writer.destroy();
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

function validateProfileImageDescriptor(input: { name: string; mimeType: string; size: number }) {
  const extension = extname(input.name).toLowerCase();
  const mimeType = input.mimeType.toLowerCase();
  if (input.size > maxProfileImageBytes()) throw requestError('Profile image exceeds the maximum upload size.', 413);
  if (unsafeExtensions.has(extension) || !allowedExtensions.has(extension)) throw requestError('Unsupported profile image file type.', 400);
  if (unsafeMimes.has(mimeType) || !allowedMimes.has(mimeType)) throw requestError('Unsupported profile image file type.', 400);
}

function assertSafeImageMagicBytes(name: string, mimeType: string, firstBytes: Buffer) {
  const extension = extname(name).toLowerCase();
  if (extension === '.png' && firstBytes.subarray(0, 4).toString('hex') !== '89504e47') throw requestError('Unsupported profile image file type.', 400);
  if ((extension === '.jpg' || extension === '.jpeg') && firstBytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw requestError('Unsupported profile image file type.', 400);
  if (extension === '.webp' && (firstBytes.subarray(0, 4).toString('utf8') !== 'RIFF' || firstBytes.subarray(8, 12).toString('utf8') !== 'WEBP')) {
    throw requestError('Unsupported profile image file type.', 400);
  }
  if (mimeType === 'image/png' && extension !== '.png') throw requestError('Unsupported profile image file type.', 400);
  if (mimeType === 'image/jpeg' && extension !== '.jpg' && extension !== '.jpeg') throw requestError('Unsupported profile image file type.', 400);
  if (mimeType === 'image/webp' && extension !== '.webp') throw requestError('Unsupported profile image file type.', 400);
}

function normalizedMimeType(name: string, mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower !== 'application/octet-stream') return lower;
  const extension = extname(name).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function safeImageRole(value?: string) {
  const role = String(value || 'profile-image').trim().toLowerCase();
  if (role === 'logo' || role === 'profile-photo' || role === 'profile-image') return role;
  return 'profile-image';
}

function localPathForObjectKey(objectKey: string) {
  const root = process.env.PROFILE_IMAGE_UPLOAD_DIR || join(process.cwd(), '.data', 'profile-images');
  const target = normalize(join(root, objectKey));
  const normalizedRoot = normalize(root);
  if (!target.startsWith(normalizedRoot)) throw requestError('Invalid profile image payload.', 400);
  return target;
}

function safeFilename(value: string) {
  const extension = extname(value).toLowerCase();
  const base = value.slice(0, Math.max(0, value.length - extension.length)).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'profile-image'}${allowedExtensions.has(extension) ? extension : '.png'}`.slice(0, 180);
}

function safeDisplayName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180) || 'profile-image';
}

function destroyReadable(stream: NodeJS.ReadableStream, error: Error) {
  const destroyable = stream as unknown as { destroy?: (cause?: Error) => void };
  if (typeof destroyable.destroy === 'function') {
    destroyable.destroy(error);
  }
}
