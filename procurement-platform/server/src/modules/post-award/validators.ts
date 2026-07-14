import { z } from 'zod';

export const uuidSchema = z.string().trim().uuid();

export const idParamsSchema = z
  .object({
    contractId: uuidSchema
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
