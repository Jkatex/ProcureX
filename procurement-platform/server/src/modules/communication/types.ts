/* Defines communication TypeScript contracts that keep API payloads, state, and UI props aligned. */
import type { CommunicationKind, CommunicationPriority, CommunicationStatus, OrganizationKind } from '@prisma/client';

export const moduleDefinition = {
  key: 'communication',
  name: 'Communication',
  description: 'Messages, clarifications, notifications, alerts, attachments, and tender communication history.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export const communicationFolderValues = ['all', 'inbox', 'sent', 'drafts', 'archived', 'unread'] as const;

export type CommunicationFolder = (typeof communicationFolderValues)[number];

export const communicationSortValues = ['date', 'subject', 'sender', 'recipient', 'priority', 'status'] as const;

export type CommunicationSort = (typeof communicationSortValues)[number];

export type CommunicationQuery = {
  organizationId: string;
  folder: CommunicationFolder;
  search: string;
  kind: CommunicationKind | 'all';
  status: CommunicationStatus | 'all';
  priority: CommunicationPriority | 'all';
  category: string;
  tenderId: string;
  page: number;
  pageSize: number;
  sortBy: CommunicationSort;
  sortDirection: 'asc' | 'desc';
};

export type CommunicationAttachmentInput = {
  documentId: string;
};

export type CommunicationAttachmentUploadInput = {
  name: string;
  documentType?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
};

export type ComposeMessageInput = {
  senderOrgId: string;
  recipientOrgId: string;
  ownerOrgId?: string;
  tenderId?: string;
  kind: CommunicationKind;
  category: string;
  subject: string;
  body: string;
  priority: CommunicationPriority;
  visibility?: string;
  actionRequired: boolean;
  attachments: CommunicationAttachmentInput[];
  attachmentUploads: CommunicationAttachmentUploadInput[];
  metadata: Record<string, unknown>;
};

export type ReplyMessageInput = {
  senderOrgId?: string;
  recipientOrgId?: string;
  subject?: string;
  category?: string;
  body: string;
  priority?: CommunicationPriority;
  visibility?: string;
  attachments: CommunicationAttachmentInput[];
  attachmentUploads: CommunicationAttachmentUploadInput[];
  metadata: Record<string, unknown>;
};

export type PatchMessageInput = {
  folder?: 'inbox' | 'sent' | 'archived';
  status?: CommunicationStatus;
  priority?: CommunicationPriority;
  read?: boolean;
  actionRequired?: boolean;
  visibility?: string | null;
  metadata?: Record<string, unknown>;
};

export type CommunicationThreadEntryDto = {
  senderOrgId: string | null;
  senderName: string | null;
  body: string;
  notice: string | null;
  createdAt: string;
};

export type CommunicationAttachmentDto = {
  id: string;
  documentId: string;
  name: string;
  documentType: string;
  objectKey: string;
  checksum: string | null;
  createdAt: string;
};

export type CommunicationAttachmentFileDto = {
  name: string;
  mimeType: string;
  content: Buffer;
};

export type CommunicationMessageDto = {
  id: string;
  kind: CommunicationKind;
  folder: string;
  category: string;
  subject: string;
  body: string;
  status: CommunicationStatus;
  priority: CommunicationPriority;
  read: boolean;
  actionRequired: boolean;
  visibility: string | null;
  ownerOrgId: string | null;
  ownerName: string | null;
  senderOrgId: string | null;
  senderName: string | null;
  recipientOrgId: string | null;
  recipientName: string | null;
  tenderId: string | null;
  tenderReference: string | null;
  tenderTitle: string | null;
  relatedMessageId: string | null;
  conversationId: string | null;
  contextKey: string | null;
  thread: CommunicationThreadEntryDto[];
  attachments: CommunicationAttachmentDto[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationCountsDto = {
  total: number;
  inbox: number;
  sent: number;
  drafts: number;
  archived: number;
  unread: number;
  actionRequired: number;
};

export type CommunicationListDto = {
  messages: CommunicationMessageDto[];
  counts: CommunicationCountsDto;
  totalMessages: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ComposeMessageResultDto = {
  message: CommunicationMessageDto;
  deliveries: CommunicationMessageDto[];
};

export type CommunicationRecipientDto = {
  id: string;
  name: string;
  kind: OrganizationKind;
  country: string;
  capabilities: string[];
};

export type CommunicationTenderLinkDto = {
  id: string;
  reference: string;
  title: string;
  buyerName: string;
  status: string;
};
