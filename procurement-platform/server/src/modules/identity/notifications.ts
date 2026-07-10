import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
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

function deliveryConfigError(message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = 502;
  return error;
}

function boolConfig(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function numberConfig(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function listConfig(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function metaWhatsAppMessageId(body: Record<string, unknown>) {
  const messages = body.messages;
  if (Array.isArray(messages)) {
    const first = messages[0];
    if (first && typeof first === 'object') {
      return firstString((first as Record<string, unknown>).id, (first as Record<string, unknown>).message_id);
    }
  }
  return firstString(body.message_id, body.messageId, body.id);
}

function metaWhatsAppError(body: Record<string, unknown>) {
  const error = body.error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    return firstString((error as Record<string, unknown>).message, (error as Record<string, unknown>).error_user_msg);
  }
  return firstString(body.message, body.error);
}

function activationEmailContent(input: EmailCodeInput) {
  const actionText = input.actionUrl ? `\n\nOpen this link to continue: ${input.actionUrl}` : '';
  const actionHtml = input.actionUrl ? `<p><a href="${input.actionUrl}">Continue in ProcureX</a></p>` : '';
  return {
    subject: 'Activate your ProcureX account',
    text: `Your ProcureX activation code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.${actionText}`,
    html: `<p>Your ProcureX activation code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>${actionHtml}`
  };
}

function passwordResetEmailContent(input: EmailCodeInput) {
  const actionText = input.actionUrl ? `\n\nOpen this link to reset your password: ${input.actionUrl}` : '';
  const actionHtml = input.actionUrl ? `<p><a href="${input.actionUrl}">Reset your password</a></p>` : '';
  return {
    subject: 'Reset your ProcureX password',
    text: `Your ProcureX password reset code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.${actionText}`,
    html: `<p>Your ProcureX password reset code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>${actionHtml}`
  };
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
    return this.send({
      to: input.to,
      ...activationEmailContent(input),
      idempotencyKey: input.idempotencyKey,
      metadata: { category: 'identity_activation', ...(input.metadata ?? {}) }
    });
  }

  sendPasswordReset(input: EmailCodeInput) {
    return this.send({
      to: input.to,
      ...passwordResetEmailContent(input),
      idempotencyKey: input.idempotencyKey,
      metadata: { category: 'identity_password_reset', ...(input.metadata ?? {}) }
    });
  }
}

export class SmtpEmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(private readonly config = process.env) {
    const user = config.SMTP_USER?.trim();
    const pass = config.SMTP_PASS?.trim();
    this.from = config.SMTP_FROM?.trim() || user || '';
    this.replyTo = config.SMTP_REPLY_TO?.trim() || undefined;

    if (isProductionRuntime() || config.APP_ENV === 'production' || config.NODE_ENV === 'production') {
      throw deliveryConfigError('The SMTP identity email provider is for local testing only.');
    }
    if (!user || !pass) {
      throw deliveryConfigError('SMTP user and password are not configured.');
    }
    if (!this.from) {
      throw deliveryConfigError('SMTP sender is not configured.');
    }

    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST?.trim() || 'smtp.gmail.com',
      port: numberConfig(config.SMTP_PORT, 587),
      secure: boolConfig(config.SMTP_SECURE, false),
      auth: { user, pass }
    });
  }

  async send(input: EmailSendInput): Promise<DeliveryReceipt> {
    if (input.templateId) {
      throw deliveryConfigError('SMTP email templates are not supported.');
    }

    const info = await this.transporter
      .sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.html !== undefined ? { html: input.html } : {})
      })
      .catch((error: unknown) => {
        throw deliveryConfigError(error instanceof Error ? error.message : 'SMTP email request failed.');
      });

    return { provider: 'smtp', messageId: firstString(info.messageId, info.response) };
  }

  sendActivation(input: EmailCodeInput) {
    return this.send({
      to: input.to,
      ...activationEmailContent(input),
      idempotencyKey: input.idempotencyKey,
      metadata: { category: 'identity_activation', ...(input.metadata ?? {}) }
    });
  }

  sendPasswordReset(input: EmailCodeInput) {
    return this.send({
      to: input.to,
      ...passwordResetEmailContent(input),
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

export class MetaWhatsAppOtpProvider {
  private readonly graphVersion: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly templateName: string;
  private readonly templateLanguage: string;
  private readonly allowedTestRecipients: string[];

  constructor(private readonly config = process.env) {
    if (isProductionRuntime() || config.APP_ENV === 'production' || config.NODE_ENV === 'production') {
      throw deliveryConfigError('The WhatsApp identity phone provider is for local testing only.');
    }

    this.graphVersion = config.META_WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0';
    this.phoneNumberId = config.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ?? '';
    this.accessToken = config.META_WHATSAPP_ACCESS_TOKEN?.trim() ?? '';
    this.templateName = config.META_WHATSAPP_TEMPLATE_NAME?.trim() ?? '';
    this.templateLanguage = config.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en_US';
    this.allowedTestRecipients = listConfig(config.META_WHATSAPP_ALLOWED_TEST_RECIPIENTS).map(normalizeRecipient);

    if (!this.phoneNumberId) {
      throw deliveryConfigError('Meta WhatsApp phone number ID is not configured.');
    }
    if (!this.accessToken) {
      throw deliveryConfigError('Meta WhatsApp access token is not configured.');
    }
    if (!this.templateName) {
      throw deliveryConfigError('Meta WhatsApp template name is not configured.');
    }
  }

  async sendOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt> {
    const to = normalizeRecipient(input.to);
    if (this.allowedTestRecipients.length > 0 && !this.allowedTestRecipients.includes(to)) {
      throw deliveryConfigError('WhatsApp test recipient is not allowed.');
    }

    const response = await fetch(endpoint(`https://graph.facebook.com/${this.graphVersion}`, `/${this.phoneNumberId}/messages`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: this.templateName,
          language: { code: this.templateLanguage },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: input.code }]
            }
          ]
        }
      })
    }).catch((error: unknown) => {
      throw deliveryConfigError(error instanceof Error ? error.message : 'Meta WhatsApp request failed.');
    });

    const body = await jsonResponse(response);
    if (!response.ok) {
      const message = metaWhatsAppError(body);
      throw deliveryConfigError(`Meta WhatsApp returned ${response.status}${message ? `: ${message}` : ''}.`);
    }

    return {
      provider: 'meta-whatsapp',
      messageId: metaWhatsAppMessageId(body),
      providerMetadata: {
        contacts: body.contacts,
        messages: body.messages
      }
    };
  }
}

export class ProductionIdentityNotifications implements IdentityNotificationProvider {
  private sms?: BeemSmsProvider;
  private email?: ResendEmailProvider;
  private whatsApp?: BeemWhatsAppProvider;
  private metaWhatsAppOtp?: MetaWhatsAppOtpProvider;

  constructor(private readonly config = process.env) {}

  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    const provider = (this.config.IDENTITY_SMS_PROVIDER || 'beem').trim().toLowerCase();
    if (provider !== 'beem') {
      throw deliveryConfigError(`Unsupported identity SMS provider: ${provider}.`);
    }
    this.sms ??= new BeemSmsProvider(this.config);
    return this.sms.sendOtp(input);
  }

  sendWhatsAppOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    this.metaWhatsAppOtp ??= new MetaWhatsAppOtpProvider(this.config);
    return this.metaWhatsAppOtp.sendOtp(input);
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
  private smtpEmail?: SmtpEmailProvider;
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
    if (this.phoneProvider === 'whatsapp') return this.production.sendWhatsAppOtp(input);
    if (this.phoneProvider !== 'sms') throw deliveryConfigError(`Unsupported identity phone provider: ${this.phoneProvider}.`);
    return this.production.sendPhoneOtp(input);
  }

  sendEmailActivation(input: EmailCodeInput) {
    if (this.emailProvider === 'dev-console') return this.devConsole!.sendEmailActivation(input);
    if (this.emailProvider === 'smtp') {
      this.smtpEmail ??= new SmtpEmailProvider(this.config);
      return this.smtpEmail.sendActivation(input);
    }
    if (this.emailProvider !== 'resend') throw deliveryConfigError(`Unsupported identity email provider: ${this.emailProvider}.`);
    return this.production.sendEmailActivation(input);
  }

  sendPasswordReset(input: EmailCodeInput) {
    if (this.emailProvider === 'dev-console') return this.devConsole!.sendPasswordReset(input);
    if (this.emailProvider === 'smtp') {
      this.smtpEmail ??= new SmtpEmailProvider(this.config);
      return this.smtpEmail.sendPasswordReset(input);
    }
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
