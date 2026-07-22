/* Validates public request payloads at the module boundary before service logic trusts client input. */
import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const publicPageParamsSchema = z.object({
  pageKey: z.enum(['about-procurex', 'privacy-policy', 'terms-and-conditions'])
});
