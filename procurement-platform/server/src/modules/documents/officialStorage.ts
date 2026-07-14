import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export type StoredOfficialPdf = {
  objectKey: string;
  checksum: string;
  sizeBytes: number;
};

const storageRoot = resolve(process.env.OFFICIAL_DOCUMENT_UPLOAD_DIR ?? join(process.cwd(), '.data'));

export async function storeOfficialPdf(input: {
  body: Buffer;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  documentType: string;
  versionNo: number;
  reference: string;
}): Promise<StoredOfficialPdf> {
  const checksum = sha256(input.body);
  const filename = `${safeFilename(input.reference)}-v${input.versionNo}-${input.documentType.toLowerCase()}.pdf`;
  const objectKey = [
    'official-documents',
    safePathPart(input.sourceModule),
    safePathPart(input.sourceEntityType),
    safePathPart(input.sourceEntityId),
    `${Date.now()}-${randomUUID()}-${filename}`
  ].join('/');
  const filePath = resolveObjectKey(objectKey);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body);
  return { objectKey, checksum, sizeBytes: input.body.byteLength };
}

export async function readOfficialPdf(objectKey: string) {
  return readFile(resolveObjectKey(objectKey));
}

export function sha256(body: Buffer | string) {
  return createHash('sha256').update(body).digest('hex');
}

export function safeFilename(value: string) {
  return safePathPart(value).replace(/\.+$/g, '') || 'official-document';
}

function safePathPart(value: string) {
  return String(value || 'document')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'document';
}

function resolveObjectKey(objectKey: string) {
  const normalised = objectKey.split('/').filter(Boolean);
  const filePath = resolve(storageRoot, ...normalised);
  const rootWithSep = storageRoot.endsWith(sep) ? storageRoot : `${storageRoot}${sep}`;
  if (filePath !== storageRoot && !filePath.startsWith(rootWithSep)) {
    throw new Error('Official document object key is outside the storage root.');
  }
  return filePath;
}
