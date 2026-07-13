import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { signCanonicalPayloadHash } from './signing.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type SensitiveActionSigningInput = {
  userId: string;
  organizationId?: string | null;
  signatureKeyphrase: string;
  moduleKey: string;
  actionKey: string;
  entityType: string;
  entityRef: string;
  payload: Record<string, unknown>;
  requestMetadata?: Record<string, unknown>;
};

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function signSensitiveAction(tx: DbClient, input: SensitiveActionSigningInput) {
  const signingCredential = await tx.signingCredential.findFirst({
    where: { userId: input.userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
  if (!signingCredential) throw requestError('Create a digital signature keyphrase before confirming this action.', 409);

  const signedAt = new Date();
  const canonicalPayload = {
    moduleKey: input.moduleKey,
    actionKey: input.actionKey,
    entityType: input.entityType,
    entityRef: input.entityRef,
    userId: input.userId,
    organizationId: input.organizationId ?? null,
    payload: input.payload,
    signedAt: signedAt.toISOString()
  };
  const canonicalPayloadHash = sha256(canonicalJson(canonicalPayload));
  const signed = await signCanonicalPayloadHash(signingCredential, input.signatureKeyphrase, canonicalPayloadHash);

  return tx.signedAction.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      signingCredentialId: signingCredential.id,
      moduleKey: input.moduleKey,
      actionKey: input.actionKey,
      entityType: input.entityType,
      entityRef: input.entityRef,
      canonicalPayloadHash,
      signatureHash: signed.signatureHash,
      keyFingerprint: signingCredential.keyFingerprint,
      signedAt,
      requestMetadata: (input.requestMetadata ?? {}) as Prisma.InputJsonObject,
      payload: input.payload as Prisma.InputJsonObject,
      providerMetadata: {
        ...signed.providerMetadata,
        signatureCredentialId: signingCredential.id
      } as Prisma.InputJsonObject
    }
  });
}
