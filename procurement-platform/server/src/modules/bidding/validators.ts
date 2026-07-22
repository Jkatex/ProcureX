/* Validates bidding request payloads at the module boundary before service logic trusts client input. */
import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

const uuidSchema = z.string().trim().uuid();
const metadataSchema = z.record(z.unknown()).optional().default({});
const signatureKeyphraseSchema = z.string().min(6).max(128);

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

export const bidDocumentParamsSchema = z
  .object({
    bidId: uuidSchema,
    documentId: uuidSchema
  })
  .strict();

export const bidSampleParamsSchema = z
  .object({
    bidId: uuidSchema,
    sampleId: uuidSchema
  })
  .strict();

const bidSampleStatusSchema = z.enum(['REQUIRED', 'PENDING_SUBMISSION', 'SUBMITTED', 'RECEIVED', 'INSPECTED', 'ACCEPTED', 'REJECTED']);

const bidDocumentSchema = z
  .object({
    documentId: uuidSchema.optional(),
    name: z.string().trim().min(1).max(240),
    documentType: z.string().trim().min(1).max(120),
    envelope: z.enum(['ADMINISTRATIVE', 'TECHNICAL', 'FINANCIAL', 'COMBINED']).optional().default('COMBINED'),
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
    responses: z.array(bidResponseSchema).max(1000).optional().default([]),
    documents: z.array(bidDocumentSchema).max(300).optional().default([]),
    fileManifest: z.record(z.unknown()).optional().default({}),
    envelopes: z.record(z.unknown()).optional().default({}),
    reviewReadiness: z.record(z.unknown()).optional().default({}),
    workspaceState: z.record(z.unknown()).optional().default({}),
    totalAmount: z.coerce.number().min(0).max(999999999999999.99).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    completeness: z.record(z.unknown()).optional().default({}),
    validationIssues: z.array(z.string().trim().max(300)).max(100).optional().default([])
  })
  .strict();

export const bidDocumentsBodySchema = z
  .object({
    documents: z.array(bidDocumentSchema).min(1).max(300)
  })
  .strict();

export const createBidSampleBodySchema = z
  .object({
    sampleName: z.string().trim().min(1).max(240),
    relatedItem: z.string().trim().min(1).max(240).optional(),
    quantity: z.coerce.number().positive().max(999999999999999.99),
    deliveryLocation: z.string().trim().min(1).max(500).optional(),
    deliveryDeadline: z.string().datetime().optional(),
    trackingStatus: z.enum(['PENDING_SUBMISSION', 'SUBMITTED']).optional(),
    courier: z.string().trim().min(1).max(160).optional(),
    trackingNumber: z.string().trim().min(1).max(160).optional(),
    metadata: metadataSchema
  })
  .strict();

export const patchBidSampleBodySchema = z
  .object({
    sampleName: z.string().trim().min(1).max(240).optional(),
    relatedItem: z.string().trim().min(1).max(240).optional(),
    quantity: z.coerce.number().positive().max(999999999999999.99).optional(),
    deliveryLocation: z.string().trim().min(1).max(500).optional(),
    deliveryDeadline: z.string().datetime().optional(),
    trackingStatus: bidSampleStatusSchema.optional(),
    courier: z.string().trim().min(1).max(160).optional(),
    trackingNumber: z.string().trim().min(1).max(160).optional(),
    receivedAt: z.string().datetime().optional(),
    inspectedAt: z.string().datetime().optional(),
    inspectionNotes: z.string().trim().max(2000).optional(),
    metadata: metadataSchema
  })
  .strict();

export const bidSignatureBodySchema = z
  .object({
    signatureKeyphrase: signatureKeyphraseSchema
  })
  .strict();
