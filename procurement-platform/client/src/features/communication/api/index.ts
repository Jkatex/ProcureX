import { apiClient } from '@/shared/api/http';
import type {
  CommunicationListResponse,
  CommunicationMailboxMessage,
  CommunicationMailboxQuery,
  CommunicationMessage,
  CommunicationRecipient,
  CommunicationTenderLink,
  ComposeCommunicationMessageInput,
  ComposeCommunicationMessageResult,
  PatchCommunicationMessageInput,
  ReplyCommunicationMessageInput
} from '@/features/communication/types';

export const communicationApi = {
  async listMessages(query: CommunicationMailboxQuery = {}): Promise<CommunicationMessage[]> {
    const mailbox = await requestMailbox(query);
    return mailbox.messages.map(toMessageItem);
  },

  async listMailbox(query: CommunicationMailboxQuery = {}) {
    return requestMailbox(query);
  },

  async getMessage(messageId: string) {
    const response = await apiClient.get<CommunicationMailboxMessage>(`/api/communication/messages/${messageId}`);
    return response.data;
  },

  async composeMessage(input: ComposeCommunicationMessageInput) {
    const response = await apiClient.post<ComposeCommunicationMessageResult>('/api/communication/messages', input);
    return response.data;
  },

  async replyToMessage(messageId: string, input: ReplyCommunicationMessageInput) {
    const response = await apiClient.post<ComposeCommunicationMessageResult>(`/api/communication/messages/${messageId}/replies`, input);
    return response.data;
  },

  async patchMessage(messageId: string, input: PatchCommunicationMessageInput) {
    const response = await apiClient.patch<CommunicationMailboxMessage>(`/api/communication/messages/${messageId}`, input);
    return response.data;
  },

  async markRead(messageId: string) {
    const response = await apiClient.post<CommunicationMailboxMessage>(`/api/communication/messages/${messageId}/read`);
    return response.data;
  },

  async getAttachment(messageId: string, attachmentId: string, disposition: 'open' | 'download' = 'open') {
    const response = await apiClient.get<Blob>(
      `/api/communication/messages/${messageId}/attachments/${attachmentId}/${disposition}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  async listRecipients(query: { search?: string; capability?: 'BUYER' | 'SUPPLIER'; pageSize?: number } = {}) {
    const response = await apiClient.get<{ recipients: CommunicationRecipient[] }>('/api/communication/recipients', {
      params: query
    });
    return response.data.recipients;
  },

  async listTenderLinks(query: { search?: string; organizationId?: string; pageSize?: number } = {}) {
    const response = await apiClient.get<{ tenders: CommunicationTenderLink[] }>('/api/communication/tenders', {
      params: query
    });
    return response.data.tenders;
  }
};

async function requestMailbox(query: CommunicationMailboxQuery) {
  const response = await apiClient.get<CommunicationListResponse>('/api/communication/messages', {
    params: query
  });
  return response.data;
}

function toMessageItem(message: CommunicationMailboxMessage): CommunicationMessage {
  return {
    id: message.id,
    subject: message.subject,
    body: message.body,
    category: message.category,
    status: displayEnum(message.status),
    priority: displayEnum(message.priority) as CommunicationMessage['priority'],
    tenderReference: message.tenderReference ?? undefined
  };
}

function displayEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
