import { ModuleRepository } from './repository.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import {
  type CommunicationAttachmentFileDto,
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
import { requestError } from '../shared/apiErrors.js';

type CommunicationAccessContext = {
  isAdmin: boolean;
  organizationId: string;
};

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly identity = new IdentityService()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async listMessages(token: string | undefined, query: CommunicationQuery): Promise<CommunicationListDto> {
    const context = await this.accessContext(token);
    const scopedQuery = this.scopeQuery(context, query);
    try {
      await this.repository.ensureDraftBidDeadlineReminders(scopedQuery.organizationId);
      return await this.repository.listMessages(scopedQuery);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyList(scopedQuery);
      throw error;
    }
  }

  async getMessage(token: string | undefined, messageId: string): Promise<CommunicationMessageDto | null> {
    const context = await this.accessContext(token);
    return this.visibleMessage(context, messageId);
  }

  async composeMessage(token: string | undefined, input: ComposeMessageInput): Promise<ComposeMessageResultDto> {
    const context = await this.accessContext(token);
    return this.repository.createMessage(this.scopeComposeInput(context, input));
  }

  async reply(token: string | undefined, messageId: string, input: ReplyMessageInput): Promise<ComposeMessageResultDto | null> {
    const context = await this.accessContext(token);
    const original = await this.visibleMessage(context, messageId);
    if (!original) return null;
    return this.repository.reply(messageId, this.scopeReplyInput(context, input));
  }

  async patchMessage(token: string | undefined, messageId: string, input: PatchMessageInput): Promise<CommunicationMessageDto | null> {
    const context = await this.accessContext(token);
    const original = await this.visibleMessage(context, messageId);
    if (!original) return null;
    return this.repository.patchMessage(messageId, input);
  }

  async markRead(token: string | undefined, messageId: string): Promise<CommunicationMessageDto | null> {
    const context = await this.accessContext(token);
    const original = await this.visibleMessage(context, messageId);
    if (!original) return null;
    return this.repository.markRead(messageId);
  }

  async getAttachment(token: string | undefined, messageId: string, attachmentId: string): Promise<CommunicationAttachmentFileDto | null> {
    const context = await this.accessContext(token);
    const original = await this.visibleMessage(context, messageId);
    if (!original) return null;
    return this.repository.getAttachment(messageId, attachmentId);
  }

  async archive(token: string | undefined, messageId: string): Promise<CommunicationMessageDto | null> {
    const context = await this.accessContext(token);
    const original = await this.visibleMessage(context, messageId);
    if (!original) return null;
    return this.repository.archive(messageId);
  }

  async listRecipients(token: string | undefined, input: { search: string; capability?: 'BUYER' | 'SUPPLIER'; pageSize: number }): Promise<CommunicationRecipientDto[]> {
    await this.accessContext(token);
    try {
      return await this.repository.listRecipients(input);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async listTenderLinks(token: string | undefined, input: { search: string; organizationId: string; pageSize: number }): Promise<CommunicationTenderLinkDto[]> {
    const context = await this.accessContext(token);
    const scopedInput = {
      ...input,
      organizationId: context.isAdmin ? input.organizationId : context.organizationId
    };
    try {
      return await this.repository.listTenderLinks(scopedInput);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  private async accessContext(token: string | undefined): Promise<CommunicationAccessContext> {
    const session = await this.identity.requireSession(token);
    const isAdmin = session.user.accountType === 'ADMIN';
    const organizationId = session.user.organizationId ?? '';
    if (!isAdmin && !organizationId) throw requestError('An organization profile is required.', 409);
    return { isAdmin, organizationId };
  }

  private scopeQuery(context: CommunicationAccessContext, query: CommunicationQuery): CommunicationQuery {
    return {
      ...query,
      organizationId: context.isAdmin ? query.organizationId || context.organizationId : context.organizationId
    };
  }

  private scopeComposeInput(context: CommunicationAccessContext, input: ComposeMessageInput): ComposeMessageInput {
    if (context.isAdmin) return input;
    return {
      ...input,
      senderOrgId: context.organizationId,
      ownerOrgId: context.organizationId
    };
  }

  private scopeReplyInput(context: CommunicationAccessContext, input: ReplyMessageInput): ReplyMessageInput {
    if (context.isAdmin) return input;
    return {
      ...input,
      senderOrgId: context.organizationId
    };
  }

  private async visibleMessage(context: CommunicationAccessContext, messageId: string) {
    const message = await this.repository.getMessage(messageId);
    if (!message) return null;
    if (!context.isAdmin && message.ownerOrgId !== context.organizationId) return null;
    return message;
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

