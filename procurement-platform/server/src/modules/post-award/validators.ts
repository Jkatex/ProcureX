/* Validates post award request payloads at the module boundary before service logic trusts client input. */
import { z } from 'zod';
import { ContractLifecycleItemStatus, ContractTerminationStatus, InvoiceStatus } from '@prisma/client';

export const uuidSchema = z.string().trim().uuid();

export const idParamsSchema = z
  .object({
    contractId: uuidSchema
  })
  .strict();

export const activationItemParamsSchema = z
  .object({
    contractId: uuidSchema,
    itemId: uuidSchema
  })
  .strict();

export const recordParamsSchema = z
  .object({
    contractId: uuidSchema,
    recordId: uuidSchema
  })
  .strict();

export const closeoutStepParamsSchema = z
  .object({
    contractId: uuidSchema,
    stepId: z.string().trim().min(1).max(80)
  })
  .strict();

export const milestoneParamsSchema = z
  .object({
    contractId: uuidSchema,
    milestoneId: uuidSchema
  })
  .strict();

export const invoiceParamsSchema = z
  .object({
    contractId: uuidSchema,
    invoiceId: uuidSchema
  })
  .strict();

export const moduleStatusQuerySchema = z.object({}).strict();

export const controlWorkflowActionBodySchema = z
  .object({
    status: z.union([z.nativeEnum(ContractLifecycleItemStatus), z.nativeEnum(ContractTerminationStatus), z.string().trim().min(1).max(80)]).optional(),
    decision: z.string().trim().max(120).optional(),
    note: z.string().trim().max(4000).optional(),
    response: z.string().trim().max(4000).optional(),
    supplierResponse: z.string().trim().max(4000).optional(),
    privateNote: z.string().trim().max(4000).optional(),
    dueDate: z.string().trim().date().optional(),
    cureDeadline: z.string().trim().date().optional(),
    amountApproved: z.coerce.number().finite().optional(),
    settlementAmount: z.coerce.number().finite().optional(),
    paymentImpact: z.coerce.number().finite().optional(),
    costImpact: z.coerce.number().finite().optional(),
    timeImpactDays: z.coerce.number().int().optional(),
    amendmentId: uuidSchema.optional(),
    amendmentReference: z.string().trim().max(120).optional(),
    signatureKeyphrase: z.string().trim().min(4).max(200).optional(),
    visibilityScope: z.enum(['SHARED', 'BUYER_PRIVATE', 'SUPPLIER_PRIVATE']).optional(),
    payload: z.record(z.string(), z.unknown()).optional().default({})
  })
  .strict();

export const financeWorkflowActionBodySchema = z
  .object({
    invoiceId: uuidSchema.optional(),
    paymentId: uuidSchema.optional(),
    scheduleId: uuidSchema.optional(),
    status: z.union([z.nativeEnum(InvoiceStatus), z.string().trim().min(1).max(80)]).optional(),
    decision: z.string().trim().max(120).optional(),
    note: z.string().trim().max(4000).optional(),
    response: z.string().trim().max(4000).optional(),
    privateNote: z.string().trim().max(4000).optional(),
    amount: z.coerce.number().finite().nonnegative().optional(),
    amountApproved: z.coerce.number().finite().nonnegative().optional(),
    settlementAmount: z.coerce.number().finite().nonnegative().optional(),
    paymentImpact: z.coerce.number().finite().optional(),
    grossAmount: z.coerce.number().finite().nonnegative().optional(),
    retentionAmount: z.coerce.number().finite().nonnegative().optional(),
    advanceRecovery: z.coerce.number().finite().nonnegative().optional(),
    liquidatedDamages: z.coerce.number().finite().nonnegative().optional(),
    taxWithholding: z.coerce.number().finite().nonnegative().optional(),
    netAmount: z.coerce.number().finite().optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    paidAt: z.string().trim().datetime().optional(),
    reference: z.string().trim().max(160).optional(),
    evidenceDocumentId: uuidSchema.optional(),
    dueDate: z.string().trim().date().optional(),
    signatureKeyphrase: z.string().trim().min(4).max(200).optional(),
    visibilityScope: z.enum(['SHARED', 'BUYER_PRIVATE', 'SUPPLIER_PRIVATE']).optional(),
    payload: z.record(z.string(), z.unknown()).optional().default({})
  })
  .strict();
