import { z } from 'zod';
import { EvaluationStatus, TenderType } from '@prisma/client';

const allFilterSchema = z.literal('all');
const uuidSchema = z.string().uuid();
const decisionStatusSchema = z.enum(['PENDING', 'PASSED', 'FAILED', 'NEEDS_CLARIFICATION', 'RECOMMENDED']);
const activeStageSchema = z.enum(['opening', 'administrative', 'criteria', 'financial', 'boq', 'pricing', 'sla', 'postqual', 'ranking', 'report']);
const signatureKeyphraseSchema = z.string().min(6).max(128);

export const moduleStatusQuerySchema = z.object({}).strict();

export const recordsQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional().default(''),
    status: z.union([allFilterSchema, z.nativeEnum(EvaluationStatus)]).optional().default('all'),
    type: z.union([allFilterSchema, z.nativeEnum(TenderType)]).optional().default('all')
  })
  .strict();

export const workspaceParamsSchema = z
  .object({
    tenderId: uuidSchema
  })
  .strict();

export const saveWorkspaceBodySchema = z
  .object({
    scores: z
      .array(
        z
          .object({
            bidId: uuidSchema,
            criterionId: uuidSchema,
            score: z.coerce.number().finite().min(0),
            comment: z.string().trim().max(2000).optional().default('')
          })
          .strict()
      )
      .optional()
      .default([]),
    decisions: z
      .array(
        z
          .object({
            bidId: uuidSchema,
            status: decisionStatusSchema,
            comment: z.string().trim().max(2000).optional().default('')
          })
          .strict()
      )
      .optional()
      .default([]),
    activeStageId: activeStageSchema.optional(),
    selectedBidId: uuidSchema.optional(),
    complete: z.boolean().optional().default(false),
    signatureKeyphrase: signatureKeyphraseSchema.optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.complete && !value.signatureKeyphrase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['signatureKeyphrase'],
        message: 'Digital signature keyphrase is required to complete evaluation.'
      });
    }
  });
