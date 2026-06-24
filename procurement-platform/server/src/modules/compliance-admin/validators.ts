import { AdminActionType, AuditSeverity, ComplianceCaseStatus } from '@prisma/client';
import { z } from 'zod';

const uuidSchema = z.string().trim().uuid();
const optionalUuidSchema = z.union([z.literal(''), uuidSchema]).optional().transform((value) => value || undefined);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const jsonValueSchema = z.custom<unknown>((value) => value !== undefined, 'Value is required.');
const dataStoreNameSchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9_.:-]+$/);
const dataStoreScopeSchema = z.enum(['GLOBAL', 'USER']);
const statusSchema = z.string().trim().min(1).max(40).regex(/^[A-Z][A-Z0-9_ -]*$/);
const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((value) => value === true || value === 'true' || value === '1');
const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined))
  .refine((value) => !value || !Number.isNaN(value.getTime()), 'Invalid date.');

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(500).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
  })
  .strict();

export const userListQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().max(120).optional(),
    verificationStatus: z.string().trim().max(40).optional(),
    accountType: z.string().trim().max(40).optional(),
    role: z.string().trim().max(40).optional()
  })
  .strict();

export const searchQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().max(160).optional().default(''),
    type: z
      .enum(['users', 'organizations', 'tenders', 'bids', 'contracts', 'audit-events', 'records', 'documents', 'evaluations', 'awards', 'compliance'])
      .optional(),
    status: z.string().trim().max(60).optional(),
    stage: z.string().trim().max(60).optional(),
    from: optionalDateSchema,
    to: optionalDateSchema,
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    flaggedOnly: booleanQuerySchema
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'From date must be before to date.')
  .refine((value) => value.minAmount === undefined || value.maxAmount === undefined || value.minAmount <= value.maxAmount, 'Minimum amount must be lower than maximum amount.');

export const caseListQuerySchema = paginationQuerySchema
  .extend({
    status: z.nativeEnum(ComplianceCaseStatus).optional(),
    severity: z.nativeEnum(AuditSeverity).optional()
  })
  .strict();

export const ruleListQuerySchema = paginationQuerySchema
  .extend({
    status: z.string().trim().max(40).optional(),
    severity: z.nativeEnum(AuditSeverity).optional()
  })
  .strict();

export const auditListQuerySchema = paginationQuerySchema
  .extend({
    severity: z.nativeEnum(AuditSeverity).optional(),
    entityType: z.string().trim().max(80).optional(),
    eventType: z.string().trim().max(120).optional(),
    actorRole: z.string().trim().max(40).optional(),
    from: optionalDateSchema,
    to: optionalDateSchema,
    q: z.string().trim().max(160).optional()
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'From date must be before to date.');

export const analyticsQuerySchema = z
  .object({
    from: optionalDateSchema,
    to: optionalDateSchema
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'From date must be before to date.');

export const idParamsSchema = z.object({ id: uuidSchema }).strict();

export const caseUpdateSchema = z
  .object({
    status: z.nativeEnum(ComplianceCaseStatus).optional(),
    severity: z.nativeEnum(AuditSeverity).optional(),
    owner: z.string().trim().max(120).nullable().optional(),
    payload: jsonObjectSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const ruleCreateSchema = z
  .object({
    ownerOrgId: optionalUuidSchema.nullable(),
    code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9_.-]+$/),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1000).nullable().optional(),
    severity: z.nativeEnum(AuditSeverity).default(AuditSeverity.WARNING),
    status: statusSchema.optional().default('ACTIVE'),
    condition: jsonObjectSchema.default({}),
    payload: jsonObjectSchema.optional().default({})
  })
  .strict();

export const ruleUpdateSchema = z
  .object({
    ownerOrgId: optionalUuidSchema.nullable(),
    code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9_.-]+$/).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    severity: z.nativeEnum(AuditSeverity).optional(),
    status: statusSchema.optional(),
    condition: jsonObjectSchema.optional(),
    payload: jsonObjectSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const adminActionSchema = z
  .object({
    ownerOrgId: optionalUuidSchema.nullable(),
    actionType: z.nativeEnum(AdminActionType),
    entityType: z.string().trim().min(2).max(80),
    entityRef: z.string().trim().max(120).nullable().optional(),
    summary: z.string().trim().max(500).optional(),
    payload: jsonObjectSchema.optional(),
    previousState: jsonObjectSchema.optional(),
    nextState: jsonObjectSchema.optional(),
    reversible: z.boolean().optional()
  })
  .strict();

export const adminNoteSchema = z
  .object({
    note: z.string().trim().max(500).optional()
  })
  .strict();

export const adminUserActionSchema = adminNoteSchema
  .extend({
    revokeSessions: z.boolean().optional().default(false)
  })
  .strict();

export const adminUserInviteSchema = z
  .object({
    email: z.string().trim().email().max(180),
    displayName: z.string().trim().min(2).max(160),
    accountType: z.enum(['USER', 'ADMIN']).optional().default('USER'),
    note: z.string().trim().max(500).optional()
  })
  .strict();

export const adminProfilePreferencesSchema = z
  .object({
    preferredLanguage: z.string().trim().min(2).max(12).optional(),
    timezone: z.string().trim().min(2).max(80).optional(),
    metadata: jsonObjectSchema.optional(),
    note: z.string().trim().max(500).optional()
  })
  .strict()
  .refine((value) => Boolean(value.preferredLanguage || value.timezone || value.metadata), 'At least one preference field is required.');

export const communicationStateParamsSchema = z
  .object({
    id: uuidSchema,
    state: z.enum(['read', 'unread', 'archive', 'unarchive', 'delete', 'restore'])
  })
  .strict();

export const dataStoreNamespaceQuerySchema = z
  .object({
    scope: dataStoreScopeSchema.optional(),
    q: z.string().trim().max(160).optional()
  })
  .strict();

export const dataStoreEntryQuerySchema = paginationQuerySchema
  .extend({
    scope: dataStoreScopeSchema.optional(),
    namespace: dataStoreNameSchema.optional(),
    ownerUserId: optionalUuidSchema,
    q: z.string().trim().max(160).optional()
  })
  .strict();

export const dataStoreCreateSchema = z
  .object({
    scope: dataStoreScopeSchema.default('GLOBAL'),
    ownerUserId: optionalUuidSchema.nullable(),
    namespace: dataStoreNameSchema,
    key: dataStoreNameSchema,
    value: jsonValueSchema,
    encrypted: z.boolean().optional().default(false)
  })
  .strict()
  .refine((value) => (value.scope === 'USER' ? Boolean(value.ownerUserId) : !value.ownerUserId), 'USER scope requires ownerUserId; GLOBAL scope must not include ownerUserId.');

export const dataStoreUpdateSchema = z
  .object({
    namespace: dataStoreNameSchema.optional(),
    key: dataStoreNameSchema.optional(),
    value: z.unknown().optional(),
    encrypted: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const dataStoreDeleteSchema = z
  .object({
    confirm: z.literal('DELETE'),
    note: z.string().trim().max(500).optional()
  })
  .strict();

export const workflowListQuerySchema = paginationQuerySchema
  .extend({
    status: z.string().trim().max(80).optional(),
    supplierOrgId: optionalUuidSchema,
    ownerOrgId: optionalUuidSchema,
    tenderId: optionalUuidSchema,
    contractId: optionalUuidSchema,
    q: z.string().trim().max(160).optional()
  })
  .strict();

export const complianceReviewBodySchema = z.object({
  ownerOrgId: optionalUuidSchema,
  entityType: z.string().trim().min(1).max(120),
  entityRef: z.string().trim().max(160).optional(),
  reviewType: z.string().trim().min(1).max(120),
  status: z.nativeEnum(ComplianceCaseStatus).optional(),
  severity: z.nativeEnum(AuditSeverity).optional(),
  assignedUserId: optionalUuidSchema,
  findings: z.string().trim().max(4000).optional(),
  decision: z.string().trim().max(4000).optional(),
  dueDate: z.string().trim().date().optional(),
  completedAt: z.string().trim().datetime().optional(),
  payload: jsonObjectSchema.optional().default({})
}).strict();

export const violationCaseBodySchema = z.object({
  reviewId: optionalUuidSchema,
  ownerOrgId: optionalUuidSchema,
  supplierOrgId: optionalUuidSchema,
  title: z.string().trim().min(1).max(220),
  violationType: z.string().trim().min(1).max(120),
  severity: z.nativeEnum(AuditSeverity).optional(),
  status: z.nativeEnum(ComplianceCaseStatus).optional(),
  statement: z.string().trim().max(4000).optional(),
  assignedUserId: optionalUuidSchema,
  decision: z.string().trim().max(4000).optional(),
  decidedAt: z.string().trim().datetime().optional(),
  payload: jsonObjectSchema.optional().default({})
}).strict();

export const violationEvidenceBodySchema = z.object({
  violationId: uuidSchema,
  documentId: optionalUuidSchema,
  evidenceType: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  payload: jsonObjectSchema.optional().default({})
}).strict();

export const enforcementRecordBodySchema = z.object({
  violationId: optionalUuidSchema,
  supplierOrgId: optionalUuidSchema,
  enforcementType: z.string().trim().min(1).max(120),
  status: statusSchema.optional().default('PENDING'),
  severity: z.nativeEnum(AuditSeverity).optional(),
  effectiveFrom: z.string().trim().datetime().optional(),
  effectiveTo: z.string().trim().datetime().optional(),
  actionSummary: z.string().trim().max(4000).optional(),
  payload: jsonObjectSchema.optional().default({})
}).strict();

export const appealRecordBodySchema = z.object({
  enforcementId: optionalUuidSchema,
  violationId: optionalUuidSchema,
  appellantOrgId: optionalUuidSchema,
  appealGrounds: z.string().trim().min(1).max(4000),
  status: statusSchema.optional().default('SUBMITTED'),
  decision: z.string().trim().max(4000).optional(),
  decidedAt: z.string().trim().datetime().optional(),
  payload: jsonObjectSchema.optional().default({})
}).strict();

export const collusionAlertBodySchema = z.object({
  tenderId: optionalUuidSchema,
  bidId: optionalUuidSchema,
  supplierOrgId: optionalUuidSchema,
  alertType: z.string().trim().min(1).max(120),
  severity: z.nativeEnum(AuditSeverity).optional(),
  status: statusSchema.optional().default('OPEN'),
  confidence: z.coerce.number().min(0).max(100).optional(),
  signalSummary: z.string().trim().max(4000).optional(),
  assignedUserId: optionalUuidSchema,
  resolvedAt: z.string().trim().datetime().optional(),
  payload: jsonObjectSchema.optional().default({})
}).strict();

export const supplierRiskProfileBodySchema = z.object({
  supplierOrgId: uuidSchema,
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  riskScore: z.coerce.number().int().min(0).max(100).optional().default(50),
  trustTier: z.string().trim().min(1).max(80).optional().default('UNVERIFIED'),
  activeAlerts: z.coerce.number().int().min(0).optional().default(0),
  openViolations: z.coerce.number().int().min(0).optional().default(0),
  summary: z.string().trim().max(2000).optional(),
  drivers: z.array(z.unknown()).optional().default([]),
  payload: jsonObjectSchema.optional().default({})
}).strict();
