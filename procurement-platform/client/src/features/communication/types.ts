import type { MessageItem } from '@/shared/types/domain';

export type CommunicationMessage = MessageItem;

export type CommunicationKind = 'MESSAGE' | 'CLARIFICATION' | 'NOTIFICATION' | 'ALERT';
export type CommunicationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type CommunicationStatus =
  | 'UNREAD'
  | 'READ'
  | 'REPLIED'
  | 'PENDING_RESPONSE'
  | 'RESOLVED'
  | 'ARCHIVED'
  | 'DELETED'
  | 'ACTION_REQUIRED'
  | 'COMPLETED';

export type CommunicationAttachment = {
  id: string;
  documentId: string;
  name: string;
  documentType: string;
  objectKey: string;
  checksum: string | null;
  createdAt: string;
};

export type CommunicationAttachmentUpload = {
  name: string;
  documentType?: string;
  mimeType?: string;
  size?: number;
};

export type CommunicationThreadEntry = {
  senderOrgId: string | null;
  senderName: string | null;
  body: string;
  notice: string | null;
  createdAt: string;
};

export type CommunicationMailboxMessage = {
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
  thread: CommunicationThreadEntry[];
  attachments: CommunicationAttachment[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationCounts = {
  total: number;
  inbox: number;
  sent: number;
  drafts: number;
  archived: number;
  unread: number;
  actionRequired: number;
};

export type CommunicationMailboxQuery = Partial<{
  organizationId: string;
  folder: 'all' | 'inbox' | 'sent' | 'drafts' | 'archived' | 'unread';
  search: string;
  kind: CommunicationKind | 'all';
  status: CommunicationStatus | 'all';
  priority: CommunicationPriority | 'all';
  category: string;
  tenderId: string;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'subject' | 'sender' | 'recipient' | 'priority' | 'status';
  sortDirection: 'asc' | 'desc';
}>;

export type CommunicationListResponse = {
  messages: CommunicationMailboxMessage[];
  counts: CommunicationCounts;
  totalMessages: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ComposeCommunicationMessageInput = {
  senderOrgId: string;
  recipientOrgId: string;
  ownerOrgId?: string;
  tenderId?: string;
  kind?: CommunicationKind;
  category?: string;
  subject: string;
  body: string;
  priority?: CommunicationPriority;
  visibility?: string;
  actionRequired?: boolean;
  attachments?: Array<{ documentId: string }>;
  attachmentUploads?: CommunicationAttachmentUpload[];
  metadata?: Record<string, unknown>;
};

export type ReplyCommunicationMessageInput = {
  senderOrgId?: string;
  recipientOrgId?: string;
  subject?: string;
  category?: string;
  body: string;
  priority?: CommunicationPriority;
  visibility?: string;
  attachments?: Array<{ documentId: string }>;
  attachmentUploads?: CommunicationAttachmentUpload[];
  metadata?: Record<string, unknown>;
};

export type PatchCommunicationMessageInput = Partial<{
  folder: 'inbox' | 'sent' | 'archived';
  status: CommunicationStatus;
  priority: CommunicationPriority;
  read: boolean;
  actionRequired: boolean;
  visibility: string | null;
  metadata: Record<string, unknown>;
}>;

export type ComposeCommunicationMessageResult = {
  message: CommunicationMailboxMessage;
  deliveries: CommunicationMailboxMessage[];
};

export type CommunicationRecipient = {
  id: string;
  name: string;
  kind: 'COMPANY' | 'PLATFORM';
  country: string;
  capabilities: string[];
};

export type CommunicationTenderLink = {
  id: string;
  reference: string;
  title: string;
  buyerName: string;
  status: string;
};
