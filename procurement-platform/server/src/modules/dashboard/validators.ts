import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).strict();

export const dashboardQuerySchema = z
  .object({
    organizationId: z.string().trim().uuid().optional(),
    deadlineWindowDays: z.coerce.number().int().min(1).max(365).optional().default(90),
    itemLimit: z.coerce.number().int().min(1).max(25).optional().default(8)
  })
  .strict();
