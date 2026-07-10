import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

export const ticketListQuerySchema = z.object({
  status: z.enum(['OPEN', 'WAITING_ON_SUPPORT', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED']).optional(),
  ownerOrgId: z.string().uuid().optional()
});

export const ticketParamsSchema = z.object({
  id: z.string().uuid()
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  category: z.string().trim().min(2).max(80).default('General'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  description: z.string().trim().min(10).max(5000),
  payload: z.record(z.unknown()).optional()
});

export const publicContactSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  organization: z.string().trim().max(180).optional().or(z.literal('')),
  requestType: z.string().trim().min(2).max(80).default('General support'),
  message: z.string().trim().min(10).max(5000)
});

export const addCommentSchema = z.object({
  body: z.string().trim().min(2).max(4000),
  visibility: z.enum(['PUBLIC', 'INTERNAL']).default('PUBLIC'),
  payload: z.record(z.unknown()).optional()
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'WAITING_ON_SUPPORT', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'])
});
