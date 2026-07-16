import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Busboy from 'busboy';
import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, unlink } from 'node:fs/promises';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { requestError } from '../shared/apiErrors.js';

export type StoredDocumentUpload = {
  objectKey: string;
  name: string;
  checksum: string;
  sizeBytes: number;
  contentType: string;
  storageDriver: 'local' | 's3';
  metadata: Record<string, unknown>;
};

export type ParsedDocumentUpload = StoredDocumentUpload & {
  documentType: string;
  ownerOrgId?: string | null;
  sourceModule?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  userMetadata: Record<string, unknown>;
};

const allowedExtensions = new Set(['.pdf', '.docx', '.xlsx', '.csv', '.txt', '.jpg', '.jpeg', '.png']);
const allowedMimes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'application/octet-stream'
]);
const unsafeExtensions = new Set(['.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.ps1', '.sh', '.js', '.mjs', '.cjs', '.vbs', '.jar', '.html', '.htm', '.svg', '.zip', '.rar', '.7z', '.tar', '.gz', '.docm', '.xlsm']);

export function maxDocumentUploadBytes() {
  const value = Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES ?? process.env.BID_DOCUMENT_MAX_BYTES ?? 26214400);
  return Number.isFinite(value) && value > 0 ? value : 26214400;
}

export async function parseAndStoreDocumentUpload(req: IncomingMessage, context: { organizationId?: string | null }): Promise<ParsedDocumentUpload> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) throw requestError('Invalid document upload payload.', 400);

  const fields: Record<string, string> = {};
  let upload: StoredDocumentUpload | null = null;
  let storedKey: string | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers as IncomingHttpHeaders, limits: { fileSize: maxDocumentUploadBytes(), files: 1, fields: 30 } });
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
        if (upload) {
          file.resume();
          reject(requestError('Only one document can be uploaded at a time.', 400));
          return;
        }
        pending += 1;
        storeFileStream(file, {
          filename: info.filename || fields.name || 'document',
          mimeType: info.mimeType || 'application/octet-stream',
          sourceModule: fields.sourceModule,
          sourceEntityType: fields.sourceEntityType,
          sourceEntityId: fields.sourceEntityId
        }).then((stored) => {
          upload = stored;
          storedKey = stored.objectKey;
        }).catch(reject).finally(() => {
          pending -= 1;
          maybeResolve();
        });
      });
      busboy.on('filesLimit', () => reject(requestError('Only one document can be uploaded at a time.', 400)));
      busboy.on('fieldsLimit', () => reject(requestError('Invalid document upload payload.', 400)));
      busboy.on('error', reject);
      busboy.on('finish', () => {
        done = true;
        maybeResolve();
      });
      req.pipe(busboy);
    });

    const storedUpload = requireStoredUpload(upload);
    const documentType = safeDocumentType(fields.documentType);
    const ownerOrgId = safeUuidLike(fields.ownerOrgId) || context.organizationId || null;
    const userMetadata = parseMetadata(fields.metadata);
    return {
      ...storedUpload,
      name: safeDisplayName(fields.name || storedUpload.name),
      documentType,
      ownerOrgId,
      sourceModule: safeText(fields.sourceModule, 80),
      sourceEntityType: safeText(fields.sourceEntityType, 80),
      sourceEntityId: safeText(fields.sourceEntityId, 120),
      userMetadata
    };
  } catch (error) {
    if (storedKey) await removeStoredDocument(storedKey).catch(() => undefined);
    throw error;
  }
}

function requireStoredUpload(upload: StoredDocumentUpload | null) {
  if (!upload) throw requestError('Choose a document to upload.', 400);
  return upload;
}

export async function readStoredDocument(objectKey: string, metadata?: Record<string, unknown>) {
  const storage = storageDriverFromMetadata(metadata);
  if (storage === 's3') {
    const bucket = process.env.S3_DOCUMENT_BUCKET;
    if (!bucket) throw requestError('Document storage is not configured.', 503);
    const response = await s3Client().send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    return streamToBuffer(response.Body);
  }
  return readFile(localPathForObjectKey(objectKey));
}

export async function removeStoredDocument(objectKey: string, metadata?: Record<string, unknown>) {
  const storage = storageDriverFromMetadata(metadata);
  if (storage === 's3') {
    const bucket = process.env.S3_DOCUMENT_BUCKET;
    if (!bucket) return;
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    return;
  }
  await rm(localPathForObjectKey(objectKey), { force: true });
}

async function storeFileStream(file: NodeJS.ReadableStream, input: { filename: string; mimeType: string; sourceModule?: string; sourceEntityType?: string; sourceEntityId?: string }): Promise<StoredDocumentUpload> {
  validateFileSafety({ name: input.filename, mimeType: input.mimeType, size: 0 });
  const objectKey = ['documents', safePathPart(input.sourceModule || 'general'), safePathPart(input.sourceEntityType || 'upload'), safePathPart(input.sourceEntityId || 'unscoped'), `${Date.now()}-${randomBytes(8).toString('hex')}-${safeFilename(input.filename)}`].join('/');
  return storageDriver() === 's3'
    ? storeS3File(file, { ...input, objectKey })
    : storeLocalFile(file, { ...input, objectKey });
}

async function storeLocalFile(file: NodeJS.ReadableStream, input: { objectKey: string; filename: string; mimeType: string }): Promise<StoredDocumentUpload> {
  const target = localPathForObjectKey(input.objectKey);
  await mkdir(dirname(target), { recursive: true });
  const writer = createWriteStream(target, { flags: 'wx' });
  const hash = createHash('sha256');
  const firstChunks: Buffer[] = [];
  let firstSize = 0;
  let size = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      let failed = false;
      file.on('data', (chunk: Buffer) => {
        if (failed) return;
        size += chunk.length;
        if (size > maxDocumentUploadBytes()) {
          failed = true;
          const error = requestError('Document exceeds the maximum upload size.', 413);
          writer.destroy(error);
          destroyReadable(file, error);
          reject(error);
          return;
        }
        if (firstSize < 64) {
          const next = Buffer.from(chunk.subarray(0, Math.min(64 - firstSize, chunk.length)));
          firstChunks.push(next);
          firstSize += next.length;
        }
        hash.update(chunk);
      });
      file.on('limit', () => reject(requestError('Document exceeds the maximum upload size.', 413)));
      file.on('end', () => {
        if ((file as { truncated?: boolean }).truncated) reject(requestError('Document exceeds the maximum upload size.', 413));
      });
      file.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', resolve);
      file.pipe(writer);
    });
    assertSafeMagicBytes(input.filename, input.mimeType, Buffer.concat(firstChunks));
    validateFileSafety({ name: input.filename, mimeType: input.mimeType, size });
    return {
      objectKey: input.objectKey,
      name: safeDisplayName(input.filename),
      checksum: hash.digest('hex'),
      sizeBytes: size,
      contentType: input.mimeType,
      storageDriver: 'local',
      metadata: { storage: 'local', contentType: input.mimeType, sizeBytes: size }
    };
  } catch (error) {
    writer.destroy();
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

async function storeS3File(file: NodeJS.ReadableStream, input: { objectKey: string; filename: string; mimeType: string }): Promise<StoredDocumentUpload> {
  const chunks: Buffer[] = [];
  const hash = createHash('sha256');
  let size = 0;
  await new Promise<void>((resolve, reject) => {
    let failed = false;
    file.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxDocumentUploadBytes()) {
        failed = true;
        const error = requestError('Document exceeds the maximum upload size.', 413);
        destroyReadable(file, error);
        reject(error);
        return;
      }
      chunks.push(Buffer.from(chunk));
      hash.update(chunk);
    });
    file.on('limit', () => reject(requestError('Document exceeds the maximum upload size.', 413)));
    file.on('end', () => {
      if ((file as { truncated?: boolean }).truncated) reject(requestError('Document exceeds the maximum upload size.', 413));
      else resolve();
    });
    file.on('error', reject);
  });
  const body = Buffer.concat(chunks);
  assertSafeMagicBytes(input.filename, input.mimeType, body.subarray(0, 64));
  validateFileSafety({ name: input.filename, mimeType: input.mimeType, size });
  const bucket = process.env.S3_DOCUMENT_BUCKET;
  if (!bucket) throw requestError('Document storage is not configured.', 503);
  await s3Client().send(new PutObjectCommand({ Bucket: bucket, Key: input.objectKey, Body: body, ContentType: input.mimeType }));
  return {
    objectKey: input.objectKey,
    name: safeDisplayName(input.filename),
    checksum: hash.digest('hex'),
    sizeBytes: size,
    contentType: input.mimeType,
    storageDriver: 's3',
    metadata: { storage: 's3', contentType: input.mimeType, sizeBytes: size }
  };
}

function validateFileSafety(input: { name: string; mimeType: string; size: number }) {
  const extension = extname(input.name).toLowerCase();
  const mimeType = input.mimeType.toLowerCase();
  if (input.size > maxDocumentUploadBytes()) throw requestError('Document exceeds the maximum upload size.', 413);
  if (unsafeExtensions.has(extension) || !allowedExtensions.has(extension)) throw requestError('Unsupported document file type.', 400);
  if (mimeType && !allowedMimes.has(mimeType)) throw requestError('Unsupported document file type.', 400);
}

function assertSafeMagicBytes(name: string, mimeType: string, firstBytes: Buffer) {
  const prefix = firstBytes.toString('utf8').trimStart().toLowerCase();
  if (firstBytes.subarray(0, 2).toString('hex') === '4d5a') throw requestError('Unsupported document file type.', 400);
  if (prefix.startsWith('#!') || prefix.startsWith('<script') || prefix.startsWith('<html') || prefix.startsWith('<?php')) {
    throw requestError('Unsupported document file type.', 400);
  }
  const extension = extname(name).toLowerCase();
  if (extension === '.pdf' && firstBytes.subarray(0, 4).toString('utf8') !== '%PDF') throw requestError('Unsupported document file type.', 400);
  if (extension === '.png' && firstBytes.subarray(0, 4).toString('hex') !== '89504e47') throw requestError('Unsupported document file type.', 400);
  if ((extension === '.jpg' || extension === '.jpeg') && firstBytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw requestError('Unsupported document file type.', 400);
  if ((extension === '.docx' || extension === '.xlsx') && firstBytes.subarray(0, 2).toString('utf8') !== 'PK') throw requestError('Unsupported document file type.', 400);
  if (mimeType === 'application/pdf' && extension !== '.pdf') throw requestError('Unsupported document file type.', 400);
}

function parseMetadata(value: string | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return safeUserMetadata(parsed as Record<string, unknown>);
  } catch {
    throw requestError('Invalid document upload metadata.', 400);
  }
}

function safeUserMetadata(value: Record<string, unknown>) {
  const blocked = new Set(['path', 'localPath', 'fullPath', 'objectKey', 'storagePath', 'contentBase64', 'sealedPayload', 'iv', 'authTag', 'keyRef', 'encryptionKeyRef', 'encryptedPayload']);
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) => !blocked.has(key) && ['string', 'number', 'boolean'].includes(typeof entry)));
}

function safeDocumentType(value: string | undefined) {
  const normalized = String(value || 'GENERAL_DOCUMENT').trim().toUpperCase().replace(/[^A-Z0-9_:-]+/g, '_').slice(0, 120);
  if (!normalized) throw requestError('Document type is required.', 400);
  return normalized;
}

function safeUuidLike(value: string | undefined) {
  const text = value?.trim();
  return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : undefined;
}

function safeText(value: string | undefined, max: number) {
  const text = value?.trim();
  return text ? text.slice(0, max) : undefined;
}

function storageDriver() {
  return process.env.DOCUMENT_STORAGE_DRIVER === 's3' || process.env.BID_DOCUMENT_STORAGE_DRIVER === 's3' ? 's3' : 'local';
}

function storageDriverFromMetadata(metadata?: Record<string, unknown>) {
  return metadata?.storage === 's3' || metadata?.storageDriver === 's3' ? 's3' : 'local';
}

function localPathForObjectKey(objectKey: string) {
  const root = process.env.DOCUMENT_UPLOAD_DIR || join(process.cwd(), '.data', 'documents');
  const target = normalize(join(root, objectKey));
  const normalizedRoot = normalize(root);
  if (!target.startsWith(normalizedRoot)) throw requestError('Invalid document object key.', 400);
  return target;
}

function safeFilename(value: string) {
  const name = safeDisplayName(value);
  const extension = extname(name).toLowerCase();
  const stem = basename(name, extension).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'document';
  return `${stem}${extension}`;
}

function safeDisplayName(value: string) {
  return basename(value).replace(/[^\w .()[\]-]+/g, '_').slice(0, 180) || 'document';
}

function safePathPart(value: string) {
  return String(value || 'document').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'document';
}

let cachedS3Client: S3Client | null = null;

function s3Client() {
  if (cachedS3Client) return cachedS3Client;
  cachedS3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'us-east-1',
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
          }
        : undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
  });
  return cachedS3Client;
}

async function streamToBuffer(body: unknown) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  if (body && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
  }
  return Buffer.alloc(0);
}

function destroyReadable(stream: NodeJS.ReadableStream, error: Error) {
  (stream as NodeJS.ReadableStream & { destroy?: (error?: Error) => void }).destroy?.(error);
}
