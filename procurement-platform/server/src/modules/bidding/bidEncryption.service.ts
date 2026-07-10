import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const encryptionAlgorithm = 'aes-256-gcm';
const sealVersion = 'bid-seal-v1';

export class BidEncryptionConfigurationError extends Error {
  status = 503;
}

export type CanonicalBidPackage = {
  bidId: string;
  tenderId: string;
  supplierOrgId: string;
  buyerOrgId: string;
  payload: Record<string, unknown>;
  documentChecksums: Array<Record<string, unknown>>;
  computedTotalAmount: number;
  currency: string;
  submittedAt: string;
};

type EncryptionMetadata =
  | {
      enabled: true;
      algorithm: typeof encryptionAlgorithm;
      iv: string;
      authTag: string;
      keyRef: string;
    }
  | {
      enabled: false;
    };

export type SealedBidPackage = {
  version: typeof sealVersion;
  envelope: string;
  payloadHash: string;
  sealedHash: string;
  encryption: EncryptionMetadata;
  sealedPayload?: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export function sha256Hex(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

export function resolveBidEncryptionKey(value = process.env.BID_ENCRYPTION_KEY) {
  const configured = value?.trim();
  if (!configured) return null;

  const raw = Buffer.from(configured, 'utf8');
  if (raw.length === 32) return raw;

  const decoded = decodeStrictBase64(configured);
  if (decoded?.length === 32) return decoded;

  throw new BidEncryptionConfigurationError('BID_ENCRYPTION_KEY must be 32 bytes or base64-decode to 32 bytes.');
}

export function sealBidPackage(bidPackage: CanonicalBidPackage, envelope: string): SealedBidPackage {
  const canonicalPackage = canonicalJson(bidPackage);
  const payloadHash = sha256Hex(canonicalPackage);
  const sealedHash = sha256Hex(canonicalJson({ envelope, payloadHash, package: bidPackage }));
  const key = resolveBidEncryptionKey();

  if (!key) {
    return {
      version: sealVersion,
      envelope,
      payloadHash,
      sealedHash,
      encryption: { enabled: false }
    };
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(encryptionAlgorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(canonicalPackage, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: sealVersion,
    envelope,
    payloadHash,
    sealedHash,
    encryption: {
      enabled: true,
      algorithm: encryptionAlgorithm,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyRef: `bid-key:${sha256Hex(key).slice(0, 16)}`
    },
    sealedPayload: encrypted.toString('base64')
  };
}

function decodeStrictBase64(value: string) {
  try {
    const decoded = Buffer.from(value, 'base64');
    const normalizedInput = value.replace(/=+$/u, '');
    const normalizedOutput = decoded.toString('base64').replace(/=+$/u, '');
    return normalizedInput === normalizedOutput ? decoded : null;
  } catch {
    return null;
  }
}
