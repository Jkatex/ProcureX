/* Supports the shared server workflow with reusable logic kept close to the module that owns it. */
import { createHash } from 'node:crypto';
import { AuditSeverity, type Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { SupportedLanguage } from '@procurex/shared';
import { requestLanguage } from './localization.js';

export type RequestAuditContext = {
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  language?: SupportedLanguage;
};

export type AuditEventInput = RequestAuditContext & {
  actorUserId?: string | null;
  ownerOrgId?: string | null;
  event: string;
  entityType: string;
  entityRef?: string | null;
  severity?: AuditSeverity;
  details?: Record<string, unknown>;
};

export function auditHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function requestAuditContext(req: Request): RequestAuditContext {
  return {
    ipAddress: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
    path: req.path,
    method: req.method,
    language: requestLanguage(req)
  };
}

export function auditPayload(input: RequestAuditContext & { details?: Record<string, unknown> } = {}): Prisma.InputJsonObject {
  return {
    ...(input.details ?? {}),
    ...(input.path ? { path: input.path } : {}),
    ...(input.method ? { method: input.method } : {}),
    ...(input.ipAddress ? { ipHash: auditHash(input.ipAddress) } : {}),
    ...(input.userAgent ? { userAgentHash: auditHash(input.userAgent) } : {})
  };
}
