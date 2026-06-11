import { ModuleRepository } from './repository.js';
import {
  moduleDefinition,
  type CommunicationListDto,
  type CommunicationMessageDto,
  type CommunicationQuery,
  type CommunicationRecipientDto,
  type CommunicationTenderLinkDto,
  type ComposeMessageInput,
  type ComposeMessageResultDto,
  type ModuleStatus,
  type PatchMessageInput,
  type ReplyMessageInput
} from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async listMessages(query: CommunicationQuery): Promise<CommunicationListDto> {
    try {
      return await this.repository.listMessages(query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyList(query);
      throw error;
    }
  }

  async getMessage(messageId: string): Promise<CommunicationMessageDto | null> {
    return this.repository.getMessage(messageId);
  }

  async composeMessage(input: ComposeMessageInput): Promise<ComposeMessageResultDto> {
    return this.repository.createMessage(input);
  }

  async reply(messageId: string, input: ReplyMessageInput): Promise<ComposeMessageResultDto | null> {
    return this.repository.reply(messageId, input);
  }

  async patchMessage(messageId: string, input: PatchMessageInput): Promise<CommunicationMessageDto | null> {
    return this.repository.patchMessage(messageId, input);
  }

  async markRead(messageId: string): Promise<CommunicationMessageDto | null> {
    return this.repository.markRead(messageId);
  }

  async archive(messageId: string): Promise<CommunicationMessageDto | null> {
    return this.repository.archive(messageId);
  }

  async softDelete(messageId: string): Promise<CommunicationMessageDto | null> {
    return this.repository.softDelete(messageId);
  }

  async listRecipients(input: { search: string; capability?: 'BUYER' | 'SUPPLIER'; pageSize: number }): Promise<CommunicationRecipientDto[]> {
    try {
      return await this.repository.listRecipients(input);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async listTenderLinks(input: { search: string; organizationId: string; pageSize: number }): Promise<CommunicationTenderLinkDto[]> {
    try {
      return await this.repository.listTenderLinks(input);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }
}

function emptyList(query: CommunicationQuery): CommunicationListDto {
  return {
    messages: [],
    counts: {
      total: 0,
      inbox: 0,
      sent: 0,
      drafts: 0,
      archived: 0,
      trash: 0,
      unread: 0,
      actionRequired: 0
    },
    totalMessages: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 1
  };
}

function isDatabaseUnavailable(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return code === 'P1001' || code === 'P2024' || message.includes("can't reach database") || message.includes('database_url');
}

