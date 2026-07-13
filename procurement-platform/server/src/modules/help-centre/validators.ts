import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const helpMessageSchema = z.object({
  message: z.string().trim().min(1).max(500),
  category: z.string().trim().max(120).optional(),
  currentPath: z.string().trim().max(240).optional()
});

export const faqListQuerySchema = z.object({
  category: z.string().trim().max(120).optional(),
  role: z.enum(['PUBLIC', 'BUYER', 'SUPPLIER', 'ADMIN']).optional(),
  q: z.string().trim().max(120).optional()
});

export const faqParamsSchema = z.object({
  faqId: z.string().trim().min(3).max(120)
});

export const categoryParamsSchema = z.object({
  categoryId: z.string().trim().min(3).max(120)
});

export const suggestionQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8)
});

