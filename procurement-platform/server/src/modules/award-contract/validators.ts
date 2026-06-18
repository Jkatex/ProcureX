import {
  AwardResponseAction,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractStatus,
  RecommendationStatus
} from '@prisma/client';
import { z } from 'zod';

const uuidSchema = z.string().trim().uuid();
const optionalUuidSchema = z.union([z.literal(''), uuidSchema]).optional().default('');
const nonEmptyText = z.string().trim().min(1).max(2000);
const optionalNote = z.string().trim().max(2000).optional().default('');
const jsonObjectSchema = z.record(z.string(), z.unknown()).optional().default({});

export const moduleStatusQuerySchema = z.object({}).strict();

export const idParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const signatureParamsSchema = z
  .object({
    id: uuidSchema,
    signatureId: uuidSchema
  })
  .strict();

export const milestoneParamsSchema = z
  .object({
    id: uuidSchema,
    milestoneId: uuidSchema
  })
  .strict();

export const awardRecommendationQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    status: z.union([z.literal('all'), z.nativeEnum(RecommendationStatus)]).optional().default('all'),
    search: z.string().trim().max(120).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
  .strict();

export const contractQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    status: z.union([z.literal('all'), z.nativeEnum(ContractStatus)]).optional().default('all'),
    search: z.string().trim().max(120).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
  .strict();

export const awardDecisionBodySchema = z
  .object({
    note: optionalNote
  })
  .strict();

export const awardNoticeResponseBodySchema = z
  .object({
    action: z.nativeEnum(AwardResponseAction),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const contractVersionBodySchema = z
  .object({
    documentId: uuidSchema.optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const contractSignatureRequestBodySchema = z
  .object({
    roles: z.array(z.nativeEnum(ContractPartyRole)).min(1).max(2).optional().default([ContractPartyRole.BUYER, ContractPartyRole.SUPPLIER])
  })
  .strict();

export const contractSignatureSignBodySchema = z
  .object({
    signerName: nonEmptyText.max(160),
    signerTitle: z.string().trim().max(160).optional().default(''),
    signatureKeyphrase: z.string().min(6).max(128),
    payload: jsonObjectSchema
  })
  .strict();

export const contractMilestoneBodySchema = z
  .object({
    title: nonEmptyText.max(180),
    description: z.string().trim().max(2000).optional().default(''),
    dueDate: z.string().trim().date().optional(),
    amount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    payload: jsonObjectSchema
  })
  .strict();

export const contractMilestonePatchBodySchema = contractMilestoneBodySchema
  .partial()
  .extend({
    status: z.nativeEnum(ContractMilestoneStatus).optional(),
    completedAt: z.string().trim().datetime().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one milestone field is required.');

export const contractMilestoneEvidenceBodySchema = z
  .object({
    documentId: uuidSchema,
    note: optionalNote
  })
  .strict();

export const contractStatusPatchBodySchema = z
  .object({
    status: z.nativeEnum(ContractStatus),
    note: optionalNote
  })
  .strict();
