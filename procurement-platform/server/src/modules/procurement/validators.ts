import { z } from 'zod';
import { TenderType } from '@prisma/client';
import { marketplaceBudgetBandValues, marketplaceSortValues, planningSortValues } from './types.js';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const publicWelcomeQuerySchema = z.object({}).passthrough();

export const masterDataQuerySchema = z.object({}).passthrough();

export const masterDataGroupParamsSchema = z
  .object({
    group: z.string().trim().min(1).max(80)
  })
  .strict();

export const designFormSchemasQuerySchema = z.object({}).passthrough();

export const designFormSchemaParamsSchema = z
  .object({
    type: z.string().trim().min(1).max(40).transform((value) => value.toLowerCase())
  })
  .strict();

export const scanLanguageBodySchema = z
  .object({
    title: z.string().trim().max(300).optional().default(''),
    description: z.string().trim().max(10000).optional().default(''),
    requirements: z.record(z.unknown()).optional().default({}),
    evaluationCriteria: z.record(z.unknown()).optional().default({}),
    metadata: z.record(z.unknown()).optional().default({})
  })
  .strict();

export const taxonomyQuerySchema = z.object({}).passthrough();

export const marketplaceQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional().default(''),
    type: z
      .string()
      .trim()
      .max(80)
      .refine((value) => isAllowedMarketplaceType(value), { message: 'Invalid tender type filter.' })
      .optional()
      .default(''),
    budgetBand: z.enum(marketplaceBudgetBandValues).or(z.literal('')).optional().default(''),
    status: z
      .string()
      .trim()
      .max(80)
      .refine((value) => isAllowedMarketplaceStatus(value), { message: 'Invalid tender status filter.' })
      .optional()
      .default(''),
    sort: z.enum(marketplaceSortValues).optional().default('deadline'),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
  .strict();

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

function normalizedTenderType(value: unknown) {
  const normalized = normalizedLabel(value);

  if (normalized === 'GOODS') return TenderType.GOODS;
  if (normalized === 'WORKS') return TenderType.WORKS;
  if (normalized === 'SERVICE' || normalized === 'SERVICES' || normalized === 'NON_CONSULTANCY' || normalized === 'NON_CONSULTANCY_SERVICES') {
    return TenderType.SERVICE;
  }
  if (normalized === 'CONSULTANCY') return TenderType.CONSULTANCY;
  return normalized;
}

function normalizedLabel(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function isAllowedMarketplaceType(value: string) {
  if (!value) return true;
  return Object.values(TenderType).includes(normalizedTenderType(value) as TenderType);
}

function isAllowedMarketplaceStatus(value: string) {
  const normalized = normalizedLabel(value);
  if (!normalized) return true;
  if (normalized === 'OPEN' || normalized === 'PUBLISHED') return true;
  if (normalized === 'EVALUATION' || normalized === 'UNDER_EVALUATION') return true;
  if (normalized === 'AWARDED') return true;
  if (normalized === 'CLOSED') return true;
  if (normalized === 'DRAFT') return true;
  if (normalized === 'CANCELLED') return true;
  return false;
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

const tenderTypeInputSchema = z.preprocess((value) => normalizedTenderType(value), z.nativeEnum(TenderType));
const draftClosingDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: 'Date must be parseable.'
  })
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: 'Closing date must be in the future.'
  });
const categoryInputSchema = z.string().trim().min(1).max(120);

export const standardizeCategoryBodySchema = z
  .object({
    rawCategory: categoryInputSchema,
    type: tenderTypeInputSchema.optional()
  })
  .strict();

export const createTenderBodySchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    type: tenderTypeInputSchema,
    description: z.string().trim().min(20).max(5000),
    budget: z.coerce.number().positive().max(999999999999999.99).optional(),
    currency: z
      .string()
      .trim()
      .min(3)
      .max(8)
      .optional()
      .default('TZS')
      .transform((value) => value.toUpperCase()),
    location: z.string().trim().min(1).max(180),
    closingDate: draftClosingDateSchema.optional(),
    categories: z.array(categoryInputSchema).max(20).optional().default([]),
    category: categoryInputSchema.optional(),
    requirements: metadataSchema,
    metadata: metadataSchema,
    reference: z.string().trim().min(1).max(80).optional()
  })
  .strict()
  .transform(({ category, categories, ...input }) => {
    const combinedCategories = [...(category ? [category] : []), ...categories];
    const seen = new Set<string>();
    return {
      ...input,
      categories: combinedCategories.filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    };
  });

export const updateTenderBodySchema = z
  .object({
    title: z.string().trim().min(5).max(200).optional(),
    type: tenderTypeInputSchema.optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    budget: z.coerce.number().positive().max(999999999999999.99).optional(),
    currency: z
      .string()
      .trim()
      .min(3)
      .max(8)
      .optional()
      .transform((value) => value?.toUpperCase()),
    location: z.string().trim().min(1).max(180).optional(),
    closingDate: draftClosingDateSchema.optional(),
    categories: z.array(categoryInputSchema).max(20).optional(),
    category: categoryInputSchema.optional(),
    requirements: metadataSchema.optional(),
    metadata: metadataSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one editable field is required.'
  })
  .transform(({ category, categories, ...input }) => {
    if (category === undefined && categories === undefined) return input;
    const combinedCategories = [...(category ? [category] : []), ...(categories ?? [])];
    const seen = new Set<string>();
    return {
      ...input,
      categories: combinedCategories.filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    };
  });

export const publishTenderBodySchema = z.object({}).strict();

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
