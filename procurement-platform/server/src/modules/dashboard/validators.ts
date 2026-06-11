import { z } from 'zod';

const uuidSchema = z.string().trim().uuid();
const optionalUuidSchema = z.union([z.literal(''), uuidSchema]).optional().default('');

export const moduleStatusQuerySchema = z.object({}).strict();

export const dashboardQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    deadlineWindowDays: z.coerce.number().int().min(1).max(365).optional().default(90),
    itemLimit: z.coerce.number().int().min(1).max(25).optional().default(8)
  })
  .strict();
