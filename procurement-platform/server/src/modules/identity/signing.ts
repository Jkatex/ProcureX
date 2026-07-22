/* Supports the identity server workflow with reusable logic kept close to the module that owns it. */
import { createCipheriv, createDecipheriv, createHash, generateKeyPairSync, randomBytes, scrypt as scryptCallback, sign as signBuffer } from 'node:crypto';

export const signingProviderName = 'procurex-keyphrase-ed25519-v1';
const keyphraseMinLength = 6;
const keyphraseMaxLength = 128;
const scryptParams = { N: 16384, r: 8, p: 1, keyLength: 32 };

export class SigningKeyphraseError extends Error {
  status = 403;
}

export class SigningCredentialRequiredError extends Error {
  status = 409;
}

export type StoredSigningCredential = {
  id: string;
  userId: string;
  status: string;
  publicKeyPem: string;
  keyFingerprint: string;
  encryptedPrivateKey: string;
  kdfMetadata: unknown;
  encryptionMetadata: unknown;
  providerMetadata: unknown;
};

export type SigningCredentialCreateInput = {
  publicKeyPem: string;
  keyFingerprint: string;
  encryptedPrivateKey: string;
  kdfMetadata: Record<string, unknown>;
  encryptionMetadata: Record<string, unknown>;
  providerMetadata: Record<string, unknown>;
};

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function keyphraseError(message: string) {
  return new SigningKeyphraseError(message);
}

export function validateKeyphrase(keyphrase: string) {
  if (keyphrase.length < keyphraseMinLength) throw keyphraseError('Keyphrase must contain at least 6 characters.');
  if (keyphrase.length > keyphraseMaxLength) throw keyphraseError('Keyphrase must be 128 characters or fewer.');
}

export function validateRepeatedKeyphrase(keyphrase: string, repeatedKeyphrase: string) {
  validateKeyphrase(keyphrase);
  if (keyphrase !== repeatedKeyphrase) throw keyphraseError('Key phrase and repeated key phrase do not match.');
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

type KdfParams = typeof scryptParams;

async function deriveEncryptionKey(keyphrase: string, salt: Buffer, params: KdfParams = scryptParams) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      keyphrase,
      salt,
      params.keyLength,
      {
        N: params.N,
        r: params.r,
        p: params.p
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

async function encryptPrivateKeyPem(privateKeyPem: string, keyphrase: string, publicKeyPem: string): Promise<SigningCredentialCreateInput> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveEncryptionKey(keyphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const keyFingerprint = sha256(publicKeyPem);

  return {
    publicKeyPem,
    keyFingerprint,
    encryptedPrivateKey: encrypted.toString('base64'),
    kdfMetadata: {
      algorithm: 'scrypt',
      salt: salt.toString('base64'),
      N: scryptParams.N,
      r: scryptParams.r,
      p: scryptParams.p,
      keyLength: scryptParams.keyLength
    },
    encryptionMetadata: {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    },
    providerMetadata: {
      provider: signingProviderName,
      algorithm: 'Ed25519',
      keyFingerprint,
      publicKeyPem
    }
  };
}

export async function createEncryptedSigningCredential(keyphrase: string): Promise<SigningCredentialCreateInput> {
  validateKeyphrase(keyphrase);

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  return encryptPrivateKeyPem(privateKeyPem, keyphrase, publicKeyPem);
}

export async function decryptPrivateKeyPem(credential: StoredSigningCredential, keyphrase: string) {
  if (credential.status !== 'ACTIVE') {
    throw new SigningCredentialRequiredError('Digital signature keyphrase must be active before signing.');
  }

  validateKeyphrase(keyphrase);

  const kdf = metadataObject(credential.kdfMetadata);
  const encryption = metadataObject(credential.encryptionMetadata);
  const salt = typeof kdf.salt === 'string' ? Buffer.from(kdf.salt, 'base64') : null;
  const params = {
    N: typeof kdf.N === 'number' ? kdf.N : scryptParams.N,
    r: typeof kdf.r === 'number' ? kdf.r : scryptParams.r,
    p: typeof kdf.p === 'number' ? kdf.p : scryptParams.p,
    keyLength: typeof kdf.keyLength === 'number' ? kdf.keyLength : scryptParams.keyLength
  };
  const iv = typeof encryption.iv === 'string' ? Buffer.from(encryption.iv, 'base64') : null;
  const authTag = typeof encryption.authTag === 'string' ? Buffer.from(encryption.authTag, 'base64') : null;
  if (!salt || !iv || !authTag) throw new SigningCredentialRequiredError('Digital signature credential is incomplete.');

  try {
    const key = await deriveEncryptionKey(keyphrase, salt, params);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(Buffer.from(credential.encryptedPrivateKey, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw keyphraseError('Invalid keyphrase.');
  }
}

export async function reencryptSigningCredential(credential: StoredSigningCredential, currentKeyphrase: string, newKeyphrase: string): Promise<SigningCredentialCreateInput> {
  validateKeyphrase(newKeyphrase);
  const privateKeyPem = await decryptPrivateKeyPem(credential, currentKeyphrase);
  return encryptPrivateKeyPem(privateKeyPem, newKeyphrase, credential.publicKeyPem);
}

export async function signCanonicalPayloadHash(credential: StoredSigningCredential, keyphrase: string, canonicalPayloadHash: string) {
  const privateKeyPem = await decryptPrivateKeyPem(credential, keyphrase);
  const signatureBase64 = signBuffer(null, Buffer.from(canonicalPayloadHash, 'utf8'), privateKeyPem).toString('base64');

  return {
    signatureBase64,
    signatureHash: sha256(signatureBase64),
    providerMetadata: {
      provider: signingProviderName,
      algorithm: 'Ed25519',
      keyFingerprint: credential.keyFingerprint,
      signatureBase64,
      publicKeyPem: credential.publicKeyPem
    }
  };
}

export function signatureStatusDto(credential?: { id: string; status: string; keyFingerprint: string; createdAt: Date; revokedAt?: Date | null } | null) {
  return {
    hasCredential: Boolean(credential && credential.status === 'ACTIVE'),
    status: credential?.status ?? 'NOT_REQUESTED',
    keyFingerprint: credential?.keyFingerprint ?? null,
    createdAt: credential?.createdAt?.toISOString() ?? null,
    revokedAt: credential?.revokedAt?.toISOString() ?? null,
    provider: credential ? signingProviderName : null
  };
}
