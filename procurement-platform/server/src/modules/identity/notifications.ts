import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { isProductionRuntime } from '../../security/config.js';

export type DeliveryReceipt = {
  provider: string;
  messageId?: string;
};

type EmailCodeInput = {
  to: string;
  code: string;
  expiresInMinutes: number;
  actionUrl?: string;
};

export type IdentityNotificationProvider = {
  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt>;
  sendEmailActivation(input: EmailCodeInput): Promise<DeliveryReceipt>;
  sendPasswordReset(input: EmailCodeInput): Promise<DeliveryReceipt>;
};

function devConsoleEnabled(config = process.env) {
  return config.IDENTITY_NOTIFICATION_PROVIDER === 'dev-console';
}

function providerName(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function boolEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function productionRuntimeFor(config = process.env) {
  return config.NODE_ENV === 'production' || config.APP_ENV === 'production';
}

function emailCodeLogCopyEnabled(config = process.env) {
  return !productionRuntimeFor(config) && !isProductionRuntime() && boolEnv(config.IDENTITY_EMAIL_CODE_LOG_COPY, true);
}

function deliveryConfigError(message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = 502;
  return error;
}

export class TwilioSmsProvider {
  private readonly client;
  private readonly fromNumber?: string;
  private readonly messagingServiceSid?: string;

  constructor(config = process.env) {
    const accountSid = config.TWILIO_ACCOUNT_SID;
    const authToken = config.TWILIO_AUTH_TOKEN;
    this.messagingServiceSid = config.TWILIO_MESSAGING_SERVICE_SID;
    this.fromNumber = config.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken) {
      throw deliveryConfigError('Twilio credentials are not configured.');
    }
    if (!this.messagingServiceSid && !this.fromNumber) {
      throw deliveryConfigError('Twilio sender is not configured.');
    }

    this.client = twilio(accountSid, authToken);
  }

  async sendOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt> {
    const message = await this.client.messages.create({
      to: input.to,
      body: `Your ProcureX verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
      ...(this.messagingServiceSid ? { messagingServiceSid: this.messagingServiceSid } : { from: this.fromNumber })
    });

    return { provider: 'twilio', messageId: message.sid };
  }
}

type SendchampSmsResponse = {
  id?: unknown;
  reference?: unknown;
  message_id?: unknown;
  messageId?: unknown;
  data?: unknown;
};

function sendchampEndpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function sendchampMessageId(body: SendchampSmsResponse): string | undefined {
  const data = body.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const item = data as SendchampSmsResponse & { messages?: unknown };
    const direct = firstString(item.id, item.reference, item.message_id, item.messageId);
    if (direct) return direct;
    if (Array.isArray(item.messages)) {
      const [message] = item.messages;
      if (message && typeof message === 'object' && !Array.isArray(message)) {
        const messageItem = message as SendchampSmsResponse;
        return firstString(messageItem.id, messageItem.reference, messageItem.message_id, messageItem.messageId);
      }
    }
  }
  if (Array.isArray(data)) {
    const [item] = data;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const message = item as SendchampSmsResponse;
      return firstString(message.id, message.reference, message.message_id, message.messageId);
    }
  }
  return firstString(body.id, body.reference, body.message_id, body.messageId);
}

export class SendchampSmsProvider {
  private readonly baseUrl: string;
  private readonly accessKey: string;
  private readonly senderName: string;
  private readonly route: string;

  constructor(config = process.env) {
    this.baseUrl = config.SENDCHAMP_BASE_URL || 'https://api.sendchamp.com/api/v1';
    this.accessKey = config.SENDCHAMP_ACCESS_KEY?.trim() ?? '';
    this.senderName = config.SENDCHAMP_SMS_SENDER?.trim() ?? '';
    this.route = config.SENDCHAMP_SMS_ROUTE?.trim() ?? '';

    if (!this.accessKey) {
      throw deliveryConfigError('Sendchamp access key is not configured.');
    }
    if (!this.senderName || !this.route) {
      throw deliveryConfigError('Sendchamp sender and route are not configured.');
    }
  }

  async sendOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt> {
    const response = await fetch(sendchampEndpoint(this.baseUrl, '/sms/send'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${this.accessKey}`
      },
      body: JSON.stringify({
        to: [input.to.replace(/^\+/, '')],
        message: `Your ProcureX verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
        sender_name: this.senderName,
        route: this.route
      })
    }).catch((error: unknown) => {
      throw deliveryConfigError(error instanceof Error ? error.message : 'Sendchamp SMS request failed.');
    });

    if (!response.ok) {
      throw deliveryConfigError(`Sendchamp SMS returned ${response.status}.`);
    }

    const body = (await response.json().catch(() => ({}))) as SendchampSmsResponse;
    return { provider: 'sendchamp', messageId: sendchampMessageId(body) };
  }
}

export class SmtpEmailProvider {
  private readonly transporter;
  private readonly from: string;
  private readonly logCodeCopy: boolean;

  constructor(config = process.env) {
    const host = config.SMTP_HOST;
    const port = Number(config.SMTP_PORT ?? 587);
    const user = config.SMTP_USER;
    const pass = config.SMTP_PASS;
    this.from = config.SMTP_FROM ?? '';
    this.logCodeCopy = emailCodeLogCopyEnabled(config);

    if (!host || !this.from) {
      throw deliveryConfigError('SMTP host and sender are not configured.');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: config.SMTP_SECURE === 'true' || port === 465,
      auth: user && pass ? { user, pass } : undefined
    });
  }

  async sendActivation(input: EmailCodeInput): Promise<DeliveryReceipt> {
    const actionText = input.actionUrl ? `\n\nOpen this link to continue: ${input.actionUrl}` : '';
    const actionHtml = input.actionUrl ? `<p><a href="${input.actionUrl}">Continue in ProcureX</a></p>` : '';
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'Activate your ProcureX account',
      text: `Your ProcureX activation code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.${actionText}`,
      html: `<p>Your ProcureX activation code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>${actionHtml}`
    });

    if (this.logCodeCopy) {
      console.info(`[identity:smtp-log-copy] email activation for ${input.to}: ${input.code} (expires in ${input.expiresInMinutes} minutes)${input.actionUrl ? ` ${input.actionUrl}` : ''}`);
    }

    return { provider: 'smtp', messageId: result.messageId };
  }

  async sendPasswordReset(input: EmailCodeInput): Promise<DeliveryReceipt> {
    const actionText = input.actionUrl ? `\n\nOpen this link to reset your password: ${input.actionUrl}` : '';
    const actionHtml = input.actionUrl ? `<p><a href="${input.actionUrl}">Reset your password</a></p>` : '';
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'Reset your ProcureX password',
      text: `Your ProcureX password reset code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.${actionText}`,
      html: `<p>Your ProcureX password reset code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>${actionHtml}`
    });

    if (this.logCodeCopy) {
      console.info(`[identity:smtp-log-copy] password reset for ${input.to}: ${input.code} (expires in ${input.expiresInMinutes} minutes)${input.actionUrl ? ` ${input.actionUrl}` : ''}`);
    }

    return { provider: 'smtp', messageId: result.messageId };
  }
}

export class ProductionIdentityNotifications implements IdentityNotificationProvider {
  private sms?: TwilioSmsProvider | SendchampSmsProvider;
  private email?: SmtpEmailProvider;

  constructor(private readonly config = process.env) {}

  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    if (!this.sms) {
      const provider = (this.config.IDENTITY_SMS_PROVIDER || 'sendchamp').trim().toLowerCase();
      this.sms = provider === 'twilio' ? new TwilioSmsProvider(this.config) : new SendchampSmsProvider(this.config);
    }
    return this.sms.sendOtp(input);
  }

  sendEmailActivation(input: EmailCodeInput) {
    this.email ??= new SmtpEmailProvider(this.config);
    return this.email.sendActivation(input);
  }

  sendPasswordReset(input: EmailCodeInput) {
    this.email ??= new SmtpEmailProvider(this.config);
    return this.email.sendPasswordReset(input);
  }
}

export class RoutedIdentityNotifications implements IdentityNotificationProvider {
  private readonly devConsole?: DevConsoleIdentityNotifications;
  private readonly production: ProductionIdentityNotifications;
  private readonly emailProvider: string;
  private readonly phoneProvider: string;

  constructor(private readonly config = process.env) {
    const legacyDevConsole = devConsoleEnabled(config);
    this.emailProvider = providerName(config.IDENTITY_EMAIL_PROVIDER) ?? (legacyDevConsole ? 'dev-console' : 'smtp');
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
    if (this.emailProvider !== 'smtp') throw deliveryConfigError(`Unsupported identity email provider: ${this.emailProvider}.`);
    return this.production.sendEmailActivation(input);
  }

  sendPasswordReset(input: EmailCodeInput) {
    if (this.emailProvider === 'dev-console') return this.devConsole!.sendPasswordReset(input);
    if (this.emailProvider !== 'smtp') throw deliveryConfigError(`Unsupported identity email provider: ${this.emailProvider}.`);
    return this.production.sendPasswordReset(input);
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
