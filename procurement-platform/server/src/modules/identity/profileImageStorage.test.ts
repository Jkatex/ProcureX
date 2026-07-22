/* Exercises identity behavior so regressions are caught close to the domain workflow they protect. */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { ModuleService, mergeVerificationProfileInput } from './service.js';
import { parseAndStoreProfileImage, readStoredProfileImage } from './profileImageStorage.js';

const originalUploadDir = process.env.PROFILE_IMAGE_UPLOAD_DIR;
const originalMaxBytes = process.env.PROFILE_IMAGE_MAX_BYTES;
let uploadDir: string | null = null;

afterEach(async () => {
  if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
  uploadDir = null;
  if (originalUploadDir === undefined) delete process.env.PROFILE_IMAGE_UPLOAD_DIR;
  else process.env.PROFILE_IMAGE_UPLOAD_DIR = originalUploadDir;
  if (originalMaxBytes === undefined) delete process.env.PROFILE_IMAGE_MAX_BYTES;
  else process.env.PROFILE_IMAGE_MAX_BYTES = originalMaxBytes;
});

function multipartRequest(input: { filename: string; contentType: string; body: Buffer; imageRole?: string }) {
  const boundary = `----procurex-${Date.now()}`;
  const chunks = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="imageRole"\r\n\r\n${input.imageRole ?? 'profile-image'}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.filename}"\r\nContent-Type: ${input.contentType}\r\n\r\n`),
    input.body,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ];
  const req = new PassThrough() as IncomingMessage & PassThrough;
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
  queueMicrotask(() => {
    req.end(Buffer.concat(chunks));
  });
  return req;
}

async function withUploadDir() {
  uploadDir = await mkdtemp(join(tmpdir(), 'procurex-profile-image-'));
  process.env.PROFILE_IMAGE_UPLOAD_DIR = uploadDir;
}

describe('profile image storage', () => {
  it('stores and reads a valid PNG image with metadata', async () => {
    await withUploadDir();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const metadata = await parseAndStoreProfileImage(multipartRequest({ filename: 'avatar.png', contentType: 'image/png', body: png, imageRole: 'profile-photo' }), 'user-1');

    expect(metadata).toEqual(expect.objectContaining({
      fileName: 'avatar.png',
      mimeType: 'image/png',
      size: png.length,
      imageRole: 'profile-photo'
    }));

    const content = await readStoredProfileImage(metadata);
    expect(content.contentType).toBe('image/png');
    expect(content.body).toEqual(png);
  });

  it('rejects oversized, SVG, and invalid magic-byte image uploads', async () => {
    await withUploadDir();
    process.env.PROFILE_IMAGE_MAX_BYTES = '4';

    await expect(parseAndStoreProfileImage(multipartRequest({ filename: 'too-large.png', contentType: 'image/png', body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]) }), 'user-1')).rejects.toThrow(/maximum upload size/i);
    process.env.PROFILE_IMAGE_MAX_BYTES = '2097152';
    await expect(parseAndStoreProfileImage(multipartRequest({ filename: 'bad.svg', contentType: 'image/svg+xml', body: Buffer.from('<svg></svg>') }), 'user-1')).rejects.toThrow(/unsupported profile image/i);
    await expect(parseAndStoreProfileImage(multipartRequest({ filename: 'fake.png', contentType: 'image/png', body: Buffer.from('not-a-png') }), 'user-1')).rejects.toThrow(/unsupported profile image/i);
  });

  it('requires authentication before profile image content can be read', async () => {
    const service = new ModuleService();
    await expect(service.profileImageContent(undefined)).rejects.toThrow(/authentication is required/i);
  });

  it('preserves existing profile image metadata when verification submit supplies new profile fields', () => {
    const profileImage = {
      objectKey: 'profile-images/user/logo.png',
      fileName: 'logo.png',
      mimeType: 'image/png',
      size: 8,
      checksum: 'checksum',
      uploadedAt: '2026-06-18T00:00:00.000Z',
      imageRole: 'logo'
    };

    expect(mergeVerificationProfileInput({ profile: { profileImage, preferredLanguage: 'Swahili' } }, { displayName: 'Kilimanjaro Supplies' })).toEqual({
      profileImage,
      preferredLanguage: 'Swahili',
      displayName: 'Kilimanjaro Supplies'
    });
  });
});
