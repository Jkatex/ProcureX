import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

const uuidSchema = z.string().trim().uuid();
const metadataSchema = z.record(z.unknown()).optional().default({});

export const tenderBidParamsSchema = z
  .object({
    tenderId: uuidSchema
  })
  .strict();

export const bidParamsSchema = z
  .object({
    bidId: uuidSchema
  })
  .strict();

const bidDocumentSchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    documentType: z.string().trim().min(1).max(120),
    envelope: z.enum(['TECHNICAL', 'FINANCIAL', 'COMBINED']).optional().default('COMBINED'),
    checksum: z.string().trim().max(160).optional(),
    objectKey: z.string().trim().max(500).optional(),
    size: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
    mimeType: z.string().trim().max(160).optional(),
    metadata: metadataSchema
  })
  .strict();

const bidResponseSchema = z
  .object({
    requirementKey: z.string().trim().min(1).max(180),
    response: z.record(z.unknown()).default({})
  })
  .strict();

export const bidDraftBodySchema = z
  .object({
    workflowType: z.enum(['goods', 'works', 'services', 'consultancy', 'generic']).optional().default('generic'),
    workflowVersion: z.string().trim().min(1).max(40).optional().default('procurex-v1'),
    administrative: z.record(z.unknown()).optional().default({}),
    technical: z.record(z.unknown()).optional().default({}),
    financial: z.record(z.unknown()).optional().default({}),
    declarations: z.record(z.unknown()).optional().default({}),
    responses: z.array(bidResponseSchema).max(300).optional().default([]),
    documents: z.array(bidDocumentSchema).max(100).optional().default([]),
    fileManifest: z.record(z.unknown()).optional().default({}),
    envelopes: z.record(z.unknown()).optional().default({}),
    reviewReadiness: z.record(z.unknown()).optional().default({}),
    totalAmount: z.coerce.number().min(0).max(999999999999999.99).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    completeness: z.record(z.unknown()).optional().default({}),
    validationIssues: z.array(z.string().trim().max(300)).max(100).optional().default([])
  })
  .strict();

export const bidDocumentsBodySchema = z
  .object({
    documents: z.array(bidDocumentSchema).min(1).max(100)
  })
  .strict();
