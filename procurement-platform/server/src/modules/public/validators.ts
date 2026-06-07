import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const publicPageParamsSchema = z.object({
  pageKey: z.enum(['about-procurex', 'privacy-policy', 'terms-and-conditions'])
});
