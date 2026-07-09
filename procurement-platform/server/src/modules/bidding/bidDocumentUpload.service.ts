import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Busboy from 'busboy';
import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize } from 'node:path';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { BidDocumentInput } from './types.js';

const allowedEnvelopes = new Set(['ADMINISTRATIVE', 'TECHNICAL', 'FINANCIAL', 'COMBINED']);
const allowedDocumentTypes = new Set([
  'ADMINISTRATIVE_EVIDENCE',
  'TECHNICAL_PRODUCT_SPEC',
  'FINANCIAL_OFFER',
  'SAMPLE_EVIDENCE',
  'WORKS_CAPACITY',
  'WORKS_BOQ',
  'SERVICE_TECHNICAL_EVIDENCE',
  'SERVICE_PRICING',
  'CONSULTANCY_TECHNICAL_PROPOSAL',
  'CONSULTANCY_FINANCIAL_PROPOSAL',
  'TECHNICAL_PROPOSAL',
  'FINANCIAL_PROPOSAL',
  'SUPPORTING_DOCUMENT',
  'BID_EVIDENCE'
]);
const allowedExtensions = new Set(['.pdf', '.docx', '.xlsx', '.csv', '.txt', '.jpg', '.jpeg', '.png']);
const unsafeExtensions = new Set([
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.ps1',
  '.sh',
  '.bash',
  '.js',
  '.mjs',
  '.cjs',
  '.vbs',
  '.jar',
  '.html',
  '.htm',
  '.svg',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.docm',
  '.xlsm'
]);
const unsafeMimePrefixes = ['application/x-', 'text/html'];
const unsafeMimes = new Set([
  'application/javascript',
  'text/javascript',
  'image/svg+xml',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-ms-installer',
  'application/java-archive',
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed'
]);
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

type StoredUpload = {
  objectKey: string;
  name: string;
  checksum: string;
  size: number;
  mimeType: string;
  extension: string;
  localPath?: string;
  encryptionKeyRef?: string;
  metadata: Record<string, unknown>;
};

export function maxBidDocumentBytes() {
  const value = Number(process.env.BID_DOCUMENT_MAX_BYTES ?? 26214400);
  return Number.isFinite(value) && value > 0 ? value : 26214400;
}

export function validateBidDocumentDescriptor(input: { name: string; documentType: string; envelope?: string; mimeType?: string; size?: number }) {
  const documentType = input.documentType.trim().toUpperCase();
  const envelope = (input.envelope || 'COMBINED').trim().toUpperCase();
  if (!allowedDocumentTypes.has(documentType)) throw requestError('Unsupported bid document type.', 400);
  if (!allowedEnvelopes.has(envelope)) throw requestError('Invalid bid document payload.', 400);
  validateFileSafety({
    name: input.name,
    mimeType: input.mimeType || 'application/octet-stream',
    size: input.size ?? 0
  });
}

export async function parseAndStoreBidDocuments(req: IncomingMessage, bidId: string): Promise<BidDocumentInput[]> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) throw requestError('Invalid bid document payload.', 400);
  const fields: Record<string, string> = {};
  const uploads: StoredUpload[] = [];
  const storedKeys: string[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers as IncomingHttpHeaders, limits: { fileSize: maxBidDocumentBytes(), files: 100, fields: 50 } });
      let pending = 0;
      let done = false;

      const maybeResolve = () => {
        if (done && pending === 0) resolve();
      };

      busboy.on('field', (name, value) => {
        fields[name] = value;
      });
      busboy.on('file', (name, file, info) => {
        if (name !== 'file' && name !== 'files') {
          file.resume();
          return;
        }
        pending += 1;
        storeFileStream(file, {
          bidId,
          filename: info.filename || 'bid-document',
          mimeType: info.mimeType || 'application/octet-stream'
        }).then((upload) => {
          uploads.push(upload);
          storedKeys.push(upload.objectKey);
        }).catch(reject).finally(() => {
          pending -= 1;
          maybeResolve();
        });
      });
      busboy.on('filesLimit', () => reject(requestError('Invalid bid document payload.', 400)));
      busboy.on('fieldsLimit', () => reject(requestError('Invalid bid document payload.', 400)));
      busboy.on('error', reject);
      busboy.on('finish', () => {
        done = true;
        maybeResolve();
      });
      req.pipe(busboy);
    });

    if (uploads.length === 0) throw requestError('Invalid bid document payload.', 400);
    const documentType = String(fields.documentType || '').trim().toUpperCase();
    const envelope = String(fields.envelope || 'COMBINED').trim().toUpperCase();
    const fieldMetadata = parseMetadata(fields.metadata);
    return uploads.map((upload) => {
      validateBidDocumentDescriptor({ name: upload.name, documentType, envelope, mimeType: upload.mimeType, size: upload.size });
      const metadata = {
        ...fieldMetadata,
        ...upload.metadata,
        originalName: upload.name,
        mimeType: upload.mimeType,
        size: upload.size,
        storage: upload.metadata.storage
      };
      return {
        name: upload.name,
        documentType,
        envelope: envelope as BidDocumentInput['envelope'],
        checksum: upload.checksum,
        objectKey: upload.objectKey,
        size: upload.size,
        mimeType: upload.mimeType,
        encryptionKeyRef: upload.encryptionKeyRef,
        metadata
      };
    });
  } catch (error) {
    await Promise.all(storedKeys.map((key) => removeStoredBidDocument(key).catch(() => undefined)));
    throw error;
  }
}

export async function removeStoredBidDocument(objectKey: string, metadata?: Record<string, unknown>) {
  const storage = typeof metadata?.storage === 'string' ? metadata.storage : storageDriver() === 's3' ? 's3' : 'local-dev';
  if (storage === 's3') {
    const bucket = process.env.S3_DOCUMENT_BUCKET;
    if (!bucket) return;
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    return;
  }
  const target = localPathForObjectKey(objectKey);
  await rm(target, { force: true });
}

async function storeFileStream(
  file: NodeJS.ReadableStream,
  input: { bidId: string; filename: string; mimeType: string }
): Promise<StoredUpload> {
  validateFileSafety({ name: input.filename, mimeType: input.mimeType, size: 0 });
  const objectKey = `bids/${input.bidId}/${Date.now()}-${randomBytes(8).toString('hex')}-${safeFilename(input.filename)}`;
  return storageDriver() === 's3'
    ? storeS3File(file, { ...input, objectKey })
    : storeLocalFile(file, { ...input, objectKey });
}

async function storeLocalFile(file: NodeJS.ReadableStream, input: { objectKey: string; filename: string; mimeType: string }): Promise<StoredUpload> {
  const target = localPathForObjectKey(input.objectKey);
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
        if (size > maxBidDocumentBytes()) {
          failed = true;
          const error = requestError('Bid document exceeds the maximum upload size.', 413);
          writer.destroy(error);
          destroyReadable(file, error);
          reject(error);
          return;
        }
        if (Buffer.concat(firstChunks).length < 64) firstChunks.push(Buffer.from(chunk.subarray(0, Math.max(0, 64 - Buffer.concat(firstChunks).length))));
        hash.update(chunk);
      });
      file.on('limit', () => reject(requestError('Bid document exceeds the maximum upload size.', 413)));
      file.on('end', () => {
        if ((file as { truncated?: boolean }).truncated) reject(requestError('Bid document exceeds the maximum upload size.', 413));
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
      size,
      mimeType: input.mimeType,
      extension: extname(input.filename).toLowerCase(),
      localPath: target,
      metadata: { storage: 'local-dev' }
    };
  } catch (error) {
    writer.destroy();
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

async function storeS3File(file: NodeJS.ReadableStream, input: { objectKey: string; filename: string; mimeType: string }): Promise<StoredUpload> {
  const chunks: Buffer[] = [];
  const hash = createHash('sha256');
  let size = 0;
  await new Promise<void>((resolve, reject) => {
    let failed = false;
    file.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBidDocumentBytes()) {
        failed = true;
        const error = requestError('Bid document exceeds the maximum upload size.', 413);
        destroyReadable(file, error);
        reject(error);
        return;
      }
      chunks.push(Buffer.from(chunk));
      hash.update(chunk);
    });
    file.on('limit', () => reject(requestError('Bid document exceeds the maximum upload size.', 413)));
    file.on('end', () => {
      if ((file as { truncated?: boolean }).truncated) reject(requestError('Bid document exceeds the maximum upload size.', 413));
    });
    file.on('error', reject);
    file.on('end', resolve);
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
    size,
    mimeType: input.mimeType,
    extension: extname(input.filename).toLowerCase(),
    encryptionKeyRef: process.env.BID_DOCUMENT_ENCRYPTION_KEY_REF || undefined,
    metadata: { storage: 's3' }
  };
}

function validateFileSafety(input: { name: string; mimeType: string; size: number }) {
  const extension = extname(input.name).toLowerCase();
  const mimeType = input.mimeType.toLowerCase();
  if (input.size > maxBidDocumentBytes()) throw requestError('Bid document exceeds the maximum upload size.', 413);
  if (unsafeExtensions.has(extension) || !allowedExtensions.has(extension)) throw requestError('Unsupported bid document file type.', 400);
  if (unsafeMimes.has(mimeType) || unsafeMimePrefixes.some((prefix) => mimeType.startsWith(prefix))) throw requestError('Unsupported bid document file type.', 400);
  if (mimeType && !allowedMimes.has(mimeType)) throw requestError('Unsupported bid document file type.', 400);
}

function assertSafeMagicBytes(name: string, mimeType: string, firstBytes: Buffer) {
  const prefix = firstBytes.toString('utf8').trimStart().toLowerCase();
  if (firstBytes.subarray(0, 2).toString('hex') === '4d5a') throw requestError('Unsupported bid document file type.', 400);
  if (prefix.startsWith('#!') || prefix.startsWith('<script') || prefix.startsWith('<html') || prefix.startsWith('<?php')) {
    throw requestError('Unsupported bid document file type.', 400);
  }
  const extension = extname(name).toLowerCase();
  if (extension === '.pdf' && firstBytes.subarray(0, 4).toString('utf8') !== '%PDF') throw requestError('Unsupported bid document file type.', 400);
  if (extension === '.png' && firstBytes.subarray(0, 4).toString('hex') !== '89504e47') throw requestError('Unsupported bid document file type.', 400);
  if ((extension === '.jpg' || extension === '.jpeg') && firstBytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw requestError('Unsupported bid document file type.', 400);
  if ((extension === '.docx' || extension === '.xlsx') && firstBytes.subarray(0, 2).toString('utf8') !== 'PK') throw requestError('Unsupported bid document file type.', 400);
  if (mimeType === 'application/pdf' && extension !== '.pdf') throw requestError('Unsupported bid document file type.', 400);
}

function parseMetadata(value: string | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? safeUserMetadata(parsed as Record<string, unknown>) : {};
  } catch {
    throw requestError('Invalid bid document payload.', 400);
  }
}

function safeUserMetadata(value: Record<string, unknown>) {
  const blocked = new Set(['path', 'localPath', 'fullPath', 'objectKey', 'sealedPayload', 'iv', 'authTag', 'keyRef', 'encryptionKeyRef']);
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => !blocked.has(key) && ['string', 'number', 'boolean'].includes(typeof entry))
  );
}

function storageDriver() {
  return process.env.BID_DOCUMENT_STORAGE_DRIVER === 's3' ? 's3' : 'local';
}

function localPathForObjectKey(objectKey: string) {
  const root = process.env.BID_DOCUMENT_UPLOAD_DIR || join(process.cwd(), '.data', 'bid-documents');
  const target = normalize(join(root, objectKey));
  const normalizedRoot = normalize(root);
  if (!target.startsWith(normalizedRoot)) throw requestError('Invalid bid document payload.', 400);
  return target;
}

function safeFilename(value: string) {
  const name = safeDisplayName(value);
  const extension = extname(name).toLowerCase();
  const stem = basename(name, extension).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'document';
  return `${stem}${extension}`;
}

function safeDisplayName(value: string) {
  return basename(value).replace(/[^\w .()[\]-]+/g, '_').slice(0, 180) || 'bid-document';
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

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function destroyReadable(stream: NodeJS.ReadableStream, error: Error) {
  (stream as NodeJS.ReadableStream & { destroy?: (error?: Error) => void }).destroy?.(error);
}
