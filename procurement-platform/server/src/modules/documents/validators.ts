import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const documentParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();
