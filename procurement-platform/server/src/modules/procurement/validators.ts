import { z } from 'zod';
import { planningSortValues } from './types.js';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const publicWelcomeQuerySchema = z.object({}).passthrough();

const uuidSchema = z.string().trim().uuid();
const optionalUuidSchema = z.union([z.literal(''), uuidSchema]).optional().default('');
const optionalDateSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidDateOnly)
  ])
  .optional()
  .default('');
const metadataSchema = z.record(z.unknown()).optional().default({});
const customValuesSchema = z.record(z.string()).optional().default({});

type PlanLineDateInput = {
  openingDate?: string;
  closingDate?: string;
  expectedCompletionDate?: string;
};

function isValidDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateEpoch(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function hasChronologicalPlanningDates(line: PlanLineDateInput) {
  const opening = dateEpoch(line.openingDate);
  const closing = dateEpoch(line.closingDate);
  const completion = dateEpoch(line.expectedCompletionDate);

  return (
    (opening === null || closing === null || opening <= closing) &&
    (closing === null || completion === null || closing <= completion)
  );
}

export const planningQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    financialYear: z.string().trim().max(20).optional().default(''),
    search: z.string().trim().max(120).optional().default(''),
    status: z.string().trim().max(80).optional().default(''),
    category: z.string().trim().max(80).optional().default(''),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(planningSortValues).optional().default('date'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc')
  })
  .strict();

export const planParamsSchema = z
  .object({
    planId: uuidSchema
  })
  .strict();

export const planLineParamsSchema = z
  .object({
    lineId: uuidSchema
  })
  .strict();

export const tenderParamsSchema = z
  .object({
    tenderId: uuidSchema
  })
  .strict();

const planLineFieldsSchema = z
  .object({
    tenderTitle: z.string().trim().min(1).max(220),
    openingDate: optionalDateSchema,
    closingDate: optionalDateSchema,
    category: z.string().trim().min(1).max(80).default('Goods'),
    budget: z.coerce.number().min(0).max(999999999999999.99).default(0),
    procurementMethod: z.string().trim().min(1).max(120).default('Open Tender'),
    sourceOfFunds: z.string().trim().min(1).max(160).default('Approved budget'),
    expectedCompletionDate: optionalDateSchema,
    status: z.string().trim().min(1).max(80).default('Draft planning'),
    planState: z.string().trim().min(1).max(80).default('Planning begun'),
    notes: z.string().trim().max(2000).optional().default(''),
    customValues: customValuesSchema,
    metadata: metadataSchema,
    tenderId: uuidSchema.optional()
  })
  .strict();

export const planLineBodySchema = planLineFieldsSchema.refine(hasChronologicalPlanningDates, {
  message: 'Procurement planning dates must be chronological.',
  path: ['closingDate']
});

export const saveAnnualPlanBodySchema = z
  .object({
    ownerOrgId: uuidSchema.optional(),
    financialYear: z.string().trim().min(4).max(20),
    name: z.string().trim().min(1).max(160).optional(),
    status: z.string().trim().min(1).max(80).optional().default('DRAFT'),
    source: z.string().trim().min(1).max(80).optional().default('manual'),
    currency: z.string().trim().min(3).max(8).optional().default('TZS'),
    metadata: metadataSchema,
    lines: z.array(planLineBodySchema).min(1).max(500)
  })
  .strict();

export const updatePlanBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    status: z.string().trim().min(1).max(80).optional(),
    source: z.string().trim().min(1).max(80).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    metadata: metadataSchema.optional(),
    lines: z.array(planLineBodySchema).min(1).max(500).optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one procurement plan field must be provided.'
  });

export const patchPlanLineBodySchema = planLineFieldsSchema
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one procurement plan line field must be provided.'
  })
  .refine(hasChronologicalPlanningDates, {
    message: 'Procurement planning dates must be chronological.',
    path: ['closingDate']
  });
