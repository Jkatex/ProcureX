import { z } from 'zod';
import { officialDocumentTypes, officialProcurementTypes } from './types.js';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const documentParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

export const officialTemplateQuerySchema = z
  .object({
    documentType: z.enum(officialDocumentTypes).optional(),
    procurementType: z.enum(officialProcurementTypes).optional()
  })
  .passthrough();

export const officialGenerateBodySchema = z
  .object({
    templateCode: z.string().trim().min(1).max(120).optional(),
    documentType: z.enum(officialDocumentTypes),
    procurementType: z.enum(officialProcurementTypes).optional(),
    sourceModule: z.string().trim().min(1).max(80),
    sourceEntityType: z.string().trim().min(1).max(80),
    sourceEntityId: z.string().trim().min(1).max(120)
  })
  .strict();

export const officialDocumentParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

export const officialActionBodySchema = z
  .object({
    note: z.string().trim().max(2000).optional(),
    signatureKeyphrase: z.string().trim().min(4).max(500).optional()
  })
  .strict();
