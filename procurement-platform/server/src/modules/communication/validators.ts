import { CommunicationKind, CommunicationPriority, CommunicationStatus } from '@prisma/client';
import { z } from 'zod';
import { communicationFolderValues, communicationSortValues } from './types.js';

const uuidSchema = z.string().trim().uuid();
const optionalUuidSchema = z.union([z.literal(''), uuidSchema]).optional().default('');
const optionalStringFilterSchema = z.string().trim().max(120).optional().default('');
const metadataSchema = z.record(z.unknown()).optional().default({});

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const messageParamsSchema = z
  .object({
    messageId: uuidSchema
  })
  .strict();

export const communicationQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    folder: z.enum(communicationFolderValues).optional().default('inbox'),
    search: optionalStringFilterSchema,
    kind: z.union([z.literal('all'), z.nativeEnum(CommunicationKind)]).optional().default('all'),
    status: z.union([z.literal('all'), z.nativeEnum(CommunicationStatus)]).optional().default('all'),
    priority: z.union([z.literal('all'), z.nativeEnum(CommunicationPriority)]).optional().default('all'),
    category: optionalStringFilterSchema,
    tenderId: optionalUuidSchema,
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(communicationSortValues).optional().default('date'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc')
  })
  .strict();

const attachmentInputSchema = z
  .object({
    documentId: uuidSchema
  })
  .strict();

const attachmentUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    documentType: z.string().trim().min(1).max(80).optional(),
    mimeType: z.string().trim().max(120).optional(),
    size: z.coerce.number().int().min(0).max(100 * 1024 * 1024).optional()
  })
  .strict();

export const composeMessageBodySchema = z
  .object({
    senderOrgId: uuidSchema,
    recipientOrgId: uuidSchema,
    ownerOrgId: uuidSchema.optional(),
    tenderId: uuidSchema.optional(),
    kind: z.nativeEnum(CommunicationKind).optional().default(CommunicationKind.MESSAGE),
    category: z.string().trim().min(1).max(80).optional().default('General Message'),
    subject: z.string().trim().min(1).max(180),
    body: z.string().trim().min(1).max(10000),
    priority: z.nativeEnum(CommunicationPriority).optional().default(CommunicationPriority.NORMAL),
    visibility: z.string().trim().max(120).optional(),
    actionRequired: z.boolean().optional().default(false),
    attachments: z.array(attachmentInputSchema).max(20).optional().default([]),
    attachmentUploads: z.array(attachmentUploadSchema).max(20).optional().default([]),
    metadata: metadataSchema
  })
  .strict()
  .refine((body) => body.attachments.length + body.attachmentUploads.length <= 20, {
    message: 'A message can include at most 20 attachments.'
  });

export const replyMessageBodySchema = z
  .object({
    senderOrgId: uuidSchema.optional(),
    recipientOrgId: uuidSchema.optional(),
    body: z.string().trim().min(1).max(10000),
    priority: z.nativeEnum(CommunicationPriority).optional(),
    visibility: z.string().trim().max(120).optional(),
    attachments: z.array(attachmentInputSchema).max(20).optional().default([]),
    attachmentUploads: z.array(attachmentUploadSchema).max(20).optional().default([]),
    metadata: metadataSchema
  })
  .strict()
  .refine((body) => body.attachments.length + body.attachmentUploads.length <= 20, {
    message: 'A reply can include at most 20 attachments.'
  });

export const patchMessageBodySchema = z
  .object({
    folder: z.enum(['inbox', 'sent', 'archived', 'trash']).optional(),
    status: z.nativeEnum(CommunicationStatus).optional(),
    priority: z.nativeEnum(CommunicationPriority).optional(),
    read: z.boolean().optional(),
    actionRequired: z.boolean().optional(),
    visibility: z.union([z.string().trim().max(120), z.null()]).optional(),
    metadata: metadataSchema.optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one message field must be provided.'
  });

export const recipientQuerySchema = z
  .object({
    search: optionalStringFilterSchema,
    capability: z.enum(['BUYER', 'SUPPLIER']).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
  })
  .strict();

export const tenderLinkQuerySchema = z
  .object({
    search: optionalStringFilterSchema,
    organizationId: optionalUuidSchema,
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
  })
  .strict();
