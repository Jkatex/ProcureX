import { randomUUID } from 'node:crypto';
import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions } from 'resend';
import { isProductionRuntime } from '../../security/config.js';

export type DeliveryReceipt = {
  provider: string;
  messageId?: string;
  providerMetadata?: Record<string, unknown>;
};

type DeliveryInput = {
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

type EmailCodeInput = DeliveryInput & {
  to: string;
  code: string;
  expiresInMinutes: number;
  actionUrl?: string;
};

export type EmailSendInput = DeliveryInput & {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateParams?: Record<string, string | number>;
};

export type BeemSmsInput = DeliveryInput & {
  to: string | string[];
  message: string;
  scheduleTime?: string;
};

export type BriqSmsInput = DeliveryInput & {
  to: string | string[];
  message: string;
};

export type BeemWhatsAppTemplateInput = DeliveryInput & {
  to: string | Array<{ phoneNumber: string; params?: string[] }>;
  templateId: string | number;
  params?: string[];
  mediaUrl?: string;
};

export type BeemWhatsAppSessionInput = DeliveryInput & {
  to: string;
  messageType?: 'text' | 'image' | 'document' | 'list' | 'quick_reply' | 'location';
  text?: string;
  payload?: Record<string, unknown>;
  callbackUrl?: string;
};

export type IdentityNotificationProvider = {
  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt>;
  sendEmailActivation(input: EmailCodeInput): Promise<DeliveryReceipt>;
  sendPasswordReset(input: EmailCodeInput): Promise<DeliveryReceipt>;
  sendWhatsAppTemplate?(input: BeemWhatsAppTemplateInput): Promise<DeliveryReceipt>;
  sendWhatsAppSessionMessage?(input: BeemWhatsAppSessionInput): Promise<DeliveryReceipt>;
};

function devConsoleEnabled(config = process.env) {
  return config.IDENTITY_NOTIFICATION_PROVIDER === 'dev-console';
}

function providerName(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function productionRuntimeFor(config = process.env) {
  return config.NODE_ENV === 'production' || config.APP_ENV === 'production';
}

function deliveryConfigError(message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = 502;
  return error;
}

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function normalizeRecipient(phone: string) {
  return phone.replace(/^\+/, '').trim();
}

function beemBasicAuth(config: NodeJS.ProcessEnv) {
  const apiKey = config.BEEM_API_KEY?.trim();
  const secretKey = config.BEEM_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) {
    throw deliveryConfigError('Beem API key and secret key are not configured.');
  }
  return `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`;
}

async function jsonResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function beemMessageId(body: Record<string, unknown>) {
  const data = body.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const item = data as Record<string, unknown>;
    return firstString(item.request_id, item.requestId, item.jobId, item.message_id, item.messageId, item.id);
  }
  return firstString(body.request_id, body.requestId, body.jobId, body.message_id, body.messageId, body.id);
}

function briqMessageId(body: Record<string, unknown>) {
  return firstString(body.job_id, body.jobId, body.message_id, body.messageId, body.id);
}

export class ResendEmailProvider {
  private readonly client: Resend;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(private readonly config = process.env) {
    const apiKey = config.RESEND_API_KEY?.trim();
    this.from = config.RESEND_FROM?.trim() ?? '';
    this.replyTo = config.RESEND_REPLY_TO?.trim() || undefined;

    if (!apiKey) {
      throw deliveryConfigError('Resend API key is not configured.');
    }
    if (!this.from) {
      throw deliveryConfigError('Resend sender is not configured.');
    }

    this.client = new Resend(apiKey);
  }

  async send(input: EmailSendInput): Promise<DeliveryReceipt> {
    const base = {
      from: this.from,
      to: input.to,
      subject: input.subject,
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      ...(input.metadata
        ? {
            tags: Object.entries(input.metadata).flatMap(([name, value]) => {
              const tagName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
              const tagValue = String(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
              return tagName && tagValue ? [{ name: tagName, value: tagValue }] : [];
            })
          }
        : {})
    };
    const payload: CreateEmailOptions = input.templateId
      ? {
          ...base,
          template: {
            id: input.templateId,
            variables: input.templateParams ?? {}
          }
        }
      : {
          ...base,
          html: input.html ?? '',
          ...(input.text !== undefined ? { text: input.text } : {})
        };
    const requestOptions: CreateEmailRequestOptions | undefined = input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined;
    const { data, error } = await this.client.emails.send(payload, requestOptions);

    if (error) {
      throw deliveryConfigError(error.message || 'Resend email request failed.');
    }

    return { provider: 'resend', messageId: data?.id };
  }

  sendActivation(input: EmailCodeInput) {
    const actionText = input.actionUrl ? `\n\nOpen this link to continue: ${input.actionUrl}` : '';
    const actionHtml = input.actionUrl ? `<p><a href="${input.actionUrl}">Continue in ProcureX</a></p>` : '';
    return this.send({
      to: input.to,
      subject: 'Activate your ProcureX account',
      text: `Your ProcureX activation code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.${actionText}`,
      html: `<p>Your ProcureX activation code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>${actionHtml}`,
      idempotencyKey: input.idempotencyKey,
      metadata: { category: 'identity_activation', ...(input.metadata ?? {}) }
    });
  }

  sendPasswordReset(input: EmailCodeInput) {
    const actionText = input.actionUrl ? `\n\nOpen this link to reset your password: ${input.actionUrl}` : '';
    const actionHtml = input.actionUrl ? `<p><a href="${input.actionUrl}">Reset your password</a></p>` : '';
    return this.send({
      to: input.to,
      subject: 'Reset your ProcureX password',
      text: `Your ProcureX password reset code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.${actionText}`,
      html: `<p>Your ProcureX password reset code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>${actionHtml}`,
      idempotencyKey: input.idempotencyKey,
      metadata: { category: 'identity_password_reset', ...(input.metadata ?? {}) }
    });
  }
}

export class BeemSmsProvider {
  private readonly baseUrl: string;
  private readonly senderName: string;
  private readonly authorization: string;

  constructor(private readonly config = process.env) {
    this.baseUrl = config.BEEM_SMS_BASE_URL || 'https://apisms.beem.africa';
    this.senderName = config.BEEM_SMS_SENDER?.trim() ?? '';
    this.authorization = beemBasicAuth(config);

    if (!this.senderName) {
      throw deliveryConfigError('Beem SMS sender is not configured.');
    }
  }

  async send(input: BeemSmsInput): Promise<DeliveryReceipt> {
    const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map((to, index) => ({
      recipient_id: index + 1,
      dest_addr: normalizeRecipient(to)
    }));

    const response = await fetch(endpoint(this.baseUrl, '/v1/send'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: this.authorization
      },
      body: JSON.stringify({
        source_addr: this.senderName,
        schedule_time: input.scheduleTime ?? '',
        encoding: 0,
        message: input.message,
        recipients
      })
    }).catch((error: unknown) => {
      throw deliveryConfigError(error instanceof Error ? error.message : 'Beem SMS request failed.');
    });

    if (!response.ok) {
      throw deliveryConfigError(`Beem SMS returned ${response.status}.`);
    }

    const body = await jsonResponse(response);
    return { provider: 'beem-sms', messageId: beemMessageId(body), providerMetadata: body };
  }

  sendOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    return this.send({
      to: input.to,
      message: `Your ProcureX verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`
    });
  }
}

export class BriqSmsProvider {
  private readonly baseUrl: string;
  private readonly senderName: string;
  private readonly apiKey: string;

  constructor(private readonly config = process.env) {
    this.baseUrl = config.BRIQ_SMS_BASE_URL || 'https://karibu.briq.tz';
    this.senderName = config.BRIQ_SMS_SENDER?.trim() ?? '';
    this.apiKey = config.BRIQ_API_KEY?.trim() ?? '';

    if (!this.apiKey) {
      throw deliveryConfigError('Briq API key is not configured.');
    }
    if (!this.senderName) {
      throw deliveryConfigError('Briq SMS sender is not configured.');
    }
  }

  async send(input: BriqSmsInput): Promise<DeliveryReceipt> {
    const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map(normalizeRecipient);
    const response = await fetch(endpoint(this.baseUrl, '/v1/message/send-instant'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        content: input.message,
        recipients,
        sender_id: this.senderName
      })
    }).catch((error: unknown) => {
      throw deliveryConfigError(error instanceof Error ? error.message : 'Briq SMS request failed.');
    });

    const body = await jsonResponse(response);

    if (!response.ok) {
      throw deliveryConfigError(`Briq SMS returned ${response.status}.`);
    }
    if (body.success === false) {
      throw deliveryConfigError(firstString(body.message, body.error) ?? 'Briq SMS request failed.');
    }

    return { provider: 'briq-sms', messageId: briqMessageId(body), providerMetadata: body };
  }

  sendOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    return this.send({
      to: input.to,
      message: `Your ProcureX verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`
    });
  }
}

export class BeemWhatsAppProvider {
  private readonly chatBaseUrl: string;
  private readonly broadcastBaseUrl: string;
  private readonly from: string;
  private readonly authorization: string;

  constructor(private readonly config = process.env) {
    this.chatBaseUrl = config.BEEM_CHAT_BASE_URL || 'https://apichatcore.beem.africa';
    this.broadcastBaseUrl = config.BEEM_BROADCAST_BASE_URL || 'https://apibroadcast.beem.africa';
    this.from = config.BEEM_WHATSAPP_FROM?.trim() ?? '';
    this.authorization = beemBasicAuth(config);

    if (!this.from) {
      throw deliveryConfigError('Beem WhatsApp sender is not configured.');
    }
  }

  async sendTemplate(input: BeemWhatsAppTemplateInput): Promise<DeliveryReceipt> {
    const destination = Array.isArray(input.to)
      ? input.to.map((item) =>
          typeof item === 'string'
            ? { phoneNumber: normalizeRecipient(item), params: input.params ?? [] }
            : { phoneNumber: normalizeRecipient(item.phoneNumber), params: item.params ?? input.params ?? [] }
        )
      : [{ phoneNumber: normalizeRecipient(input.to), params: input.params ?? [] }];

    const response = await fetch(endpoint(this.broadcastBaseUrl, '/v1/broadcast/template/api-send'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: this.authorization
      },
      body: JSON.stringify({
        from_addr: normalizeRecipient(this.from),
        destination_addr: destination,
        channel: 'whatsapp',
        ...(input.mediaUrl ? { content: { mediaUrl: input.mediaUrl } } : {}),
        messageTemplateData: { id: input.templateId }
      })
    }).catch((error: unknown) => {
      throw deliveryConfigError(error instanceof Error ? error.message : 'Beem WhatsApp template request failed.');
    });

    if (!response.ok) {
      throw deliveryConfigError(`Beem WhatsApp template returned ${response.status}.`);
    }

    const body = await jsonResponse(response);
    return { provider: 'beem-whatsapp-template', messageId: beemMessageId(body), providerMetadata: body };
  }

  async sendSessionMessage(input: BeemWhatsAppSessionInput): Promise<DeliveryReceipt> {
    const messageType = input.messageType ?? 'text';
    const response = await fetch(endpoint(this.chatBaseUrl, '/v1/chatapi'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: this.authorization
      },
      body: JSON.stringify({
        from: normalizeRecipient(this.from),
        to: normalizeRecipient(input.to),
        channel: 'whatsapp',
        transaction_id: input.idempotencyKey ?? randomUUID(),
        message_type: messageType,
        ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
        ...(messageType === 'text' ? { text: input.text ?? '' } : {}),
        ...(input.payload ?? {})
      })
    }).catch((error: unknown) => {
      throw deliveryConfigError(error instanceof Error ? error.message : 'Beem WhatsApp session request failed.');
    });

    if (!response.ok) {
      throw deliveryConfigError(`Beem WhatsApp session message returned ${response.status}.`);
    }

    const body = await jsonResponse(response);
    return { provider: 'beem-whatsapp-session', messageId: beemMessageId(body), providerMetadata: body };
  }
}

export class ProductionIdentityNotifications implements IdentityNotificationProvider {
  private beemSms?: BeemSmsProvider;
  private briqSms?: BriqSmsProvider;
  private email?: ResendEmailProvider;
  private whatsApp?: BeemWhatsAppProvider;

  constructor(private readonly config = process.env) {}

  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    const provider = (this.config.IDENTITY_SMS_PROVIDER || 'briq').trim().toLowerCase();
    if (provider === 'briq') {
      this.briqSms ??= new BriqSmsProvider(this.config);
      return this.briqSms.sendOtp(input);
    }
    if (provider === 'beem') {
      this.beemSms ??= new BeemSmsProvider(this.config);
      return this.beemSms.sendOtp(input);
    }
    throw deliveryConfigError(`Unsupported identity SMS provider: ${provider}.`);
  }

  sendEmailActivation(input: EmailCodeInput) {
    this.email ??= new ResendEmailProvider(this.config);
    return this.email.sendActivation(input);
  }

  sendPasswordReset(input: EmailCodeInput) {
    this.email ??= new ResendEmailProvider(this.config);
    return this.email.sendPasswordReset(input);
  }

  sendWhatsAppTemplate(input: BeemWhatsAppTemplateInput) {
    this.whatsApp ??= new BeemWhatsAppProvider(this.config);
    return this.whatsApp.sendTemplate(input);
  }

  sendWhatsAppSessionMessage(input: BeemWhatsAppSessionInput) {
    this.whatsApp ??= new BeemWhatsAppProvider(this.config);
    return this.whatsApp.sendSessionMessage(input);
  }
}

export class RoutedIdentityNotifications implements IdentityNotificationProvider {
  private readonly devConsole?: DevConsoleIdentityNotifications;
  private readonly production: ProductionIdentityNotifications;
  private readonly emailProvider: string;
  private readonly phoneProvider: string;

  constructor(private readonly config = process.env) {
    const legacyDevConsole = devConsoleEnabled(config);
    this.emailProvider = providerName(config.IDENTITY_EMAIL_PROVIDER) ?? (legacyDevConsole ? 'dev-console' : 'resend');
    this.phoneProvider = providerName(config.IDENTITY_PHONE_PROVIDER) ?? (legacyDevConsole ? 'dev-console' : 'sms');
    this.production = new ProductionIdentityNotifications(config);

    if (this.emailProvider === 'dev-console' || this.phoneProvider === 'dev-console') {
      this.devConsole = new DevConsoleIdentityNotifications(config);
    }
  }

  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    if (this.phoneProvider === 'dev-console') return this.devConsole!.sendPhoneOtp(input);
    if (this.phoneProvider !== 'sms') throw deliveryConfigError(`Unsupported identity phone provider: ${this.phoneProvider}.`);
    return this.production.sendPhoneOtp(input);
  }

  sendEmailActivation(input: EmailCodeInput) {
    if (this.emailProvider === 'dev-console') return this.devConsole!.sendEmailActivation(input);
    if (this.emailProvider !== 'resend') throw deliveryConfigError(`Unsupported identity email provider: ${this.emailProvider}.`);
    return this.production.sendEmailActivation(input);
  }

  sendPasswordReset(input: EmailCodeInput) {
    if (this.emailProvider === 'dev-console') return this.devConsole!.sendPasswordReset(input);
    if (this.emailProvider !== 'resend') throw deliveryConfigError(`Unsupported identity email provider: ${this.emailProvider}.`);
    return this.production.sendPasswordReset(input);
  }

  sendWhatsAppTemplate(input: BeemWhatsAppTemplateInput) {
    return this.production.sendWhatsAppTemplate(input);
  }

  sendWhatsAppSessionMessage(input: BeemWhatsAppSessionInput) {
    return this.production.sendWhatsAppSessionMessage(input);
  }
}

export class DevConsoleIdentityNotifications implements IdentityNotificationProvider {
  constructor(config = process.env) {
    if (isProductionRuntime() || config.APP_ENV === 'production' || config.NODE_ENV === 'production') {
      throw deliveryConfigError('The dev-console identity notification provider cannot run in production.');
    }
  }

  async sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt> {
    console.info(`[identity:dev-console] phone OTP for ${input.to}: ${input.code} (expires in ${input.expiresInMinutes} minutes)`);
    return { provider: 'dev-console' };
  }

  async sendEmailActivation(input: EmailCodeInput): Promise<DeliveryReceipt> {
    console.info(`[identity:dev-console] email activation for ${input.to}: ${input.code} (expires in ${input.expiresInMinutes} minutes)${input.actionUrl ? ` ${input.actionUrl}` : ''}`);
    return { provider: 'dev-console' };
  }

  async sendPasswordReset(input: EmailCodeInput): Promise<DeliveryReceipt> {
    console.info(`[identity:dev-console] password reset for ${input.to}: ${input.code} (expires in ${input.expiresInMinutes} minutes)${input.actionUrl ? ` ${input.actionUrl}` : ''}`);
    return { provider: 'dev-console' };
  }
}

export function createIdentityNotifications(config = process.env): IdentityNotificationProvider {
  return new RoutedIdentityNotifications(config);
}
