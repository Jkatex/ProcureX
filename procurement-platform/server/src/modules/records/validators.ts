import { z } from 'zod';
import { recordStatusValues, recordTypeValues, sortFieldValues } from './types.js';

const allFilterSchema = z.literal('all');

const dateFilterSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)));
const optionalDateFilterSchema = z.union([z.literal(''), dateFilterSchema]);

export const moduleStatusQuerySchema = z.object({}).strict();

export const recordsQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional().default(''),
    recordType: z.union([allFilterSchema, z.enum(recordTypeValues)]).optional().default('all'),
    status: z.union([allFilterSchema, z.enum(recordStatusValues)]).optional().default('all'),
    category: z.string().trim().max(80).optional().default(''),
    startDate: optionalDateFilterSchema.optional().default(''),
    endDate: optionalDateFilterSchema.optional().default(''),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
    sortBy: z.enum(sortFieldValues).optional().default('date'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc')
  })
  .strict()
  .refine(
    (query) =>
      !query.startDate ||
      !query.endDate ||
      Date.parse(`${query.startDate}T00:00:00.000Z`) <= Date.parse(`${query.endDate}T23:59:59.999Z`),
    {
      message: 'Start date must be before or equal to end date.',
      path: ['startDate']
    }
  );

export const recordsExportQuerySchema = recordsQuerySchema.transform((query) => ({
  ...query,
  page: 1,
  pageSize: 100
}));

