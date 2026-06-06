import nodemailer from 'nodemailer';
import twilio from 'twilio';

export type DeliveryReceipt = {
  provider: string;
  messageId?: string;
};

export type IdentityNotificationProvider = {
  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt>;
  sendEmailActivation(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt>;
  sendPasswordReset(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt>;
};

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

export class SmtpEmailProvider {
  private readonly transporter;
  private readonly from: string;

  constructor(config = process.env) {
    const host = config.SMTP_HOST;
    const port = Number(config.SMTP_PORT ?? 587);
    const user = config.SMTP_USER;
    const pass = config.SMTP_PASS;
    this.from = config.SMTP_FROM ?? '';

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

  async sendActivation(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'Activate your ProcureX account',
      text: `Your ProcureX activation code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
      html: `<p>Your ProcureX activation code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>`
    });

    return { provider: 'smtp', messageId: result.messageId };
  }

  async sendPasswordReset(input: { to: string; code: string; expiresInMinutes: number }): Promise<DeliveryReceipt> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'Reset your ProcureX password',
      text: `Your ProcureX password reset code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
      html: `<p>Your ProcureX password reset code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>`
    });

    return { provider: 'smtp', messageId: result.messageId };
  }
}

export class ProductionIdentityNotifications implements IdentityNotificationProvider {
  private sms?: TwilioSmsProvider;
  private email?: SmtpEmailProvider;

  sendPhoneOtp(input: { to: string; code: string; expiresInMinutes: number }) {
    this.sms ??= new TwilioSmsProvider();
    return this.sms.sendOtp(input);
  }

  sendEmailActivation(input: { to: string; code: string; expiresInMinutes: number }) {
    this.email ??= new SmtpEmailProvider();
    return this.email.sendActivation(input);
  }

  sendPasswordReset(input: { to: string; code: string; expiresInMinutes: number }) {
    this.email ??= new SmtpEmailProvider();
    return this.email.sendPasswordReset(input);
  }
}
