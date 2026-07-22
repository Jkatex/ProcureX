/* Defines support TypeScript contracts that keep API payloads, state, and UI props aligned. */
import type { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';

export const moduleDefinition = {
  key: 'support',
  name: 'Support',
  description: 'Help Center support tickets, comments, status updates, and account-menu activity support.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type SupportTicketDto = {
  id: string;
  ownerUserId: string;
  ownerOrgId?: string | null;
  ownerName?: string | null;
  organizationName?: string | null;
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  description: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  comments: SupportTicketCommentDto[];
};

export type SupportTicketCommentDto = {
  id: string;
  ticketId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  body: string;
  visibility: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SupportTicketListDto = {
  tickets: SupportTicketDto[];
};

export type CreateSupportTicketInput = {
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  description: string;
  payload?: Record<string, unknown>;
};

export type PublicContactInput = {
  fullName: string;
  email: string;
  phone?: string;
  organization?: string;
  requestType: string;
  message: string;
};

export type AddSupportTicketCommentInput = {
  body: string;
  visibility?: string;
  payload?: Record<string, unknown>;
};
