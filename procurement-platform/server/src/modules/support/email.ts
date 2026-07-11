import nodemailer, { type Transporter } from 'nodemailer';
import type { SupportTicketPriority } from '@prisma/client';

export type SupportEmailTicketInput = {
  id: string;
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  description: string;
  ownerUserId: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
  ownerOrgId?: string | null;
  organizationName?: string | null;
};

export type PublicContactEmailInput = {
  fullName: string;
  email: string;
  phone?: string;
  organization?: string;
  requestType: string;
  message: string;
};

export type SupportEmailSender = {
  sendTicketCreated(input: SupportEmailTicketInput): Promise<void>;
  sendPublicContact(input: PublicContactEmailInput): Promise<void>;
};

function boolConfig(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function numberConfig(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function deliveryConfigError(message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = 502;
  return error;
}

function line(label: string, value: unknown) {
  const text = value === undefined || value === null || value === '' ? 'Not provided' : String(value);
  return `${label}: ${text}`;
}

export class SmtpSupportEmailSender implements SupportEmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly to: string;
  private readonly replyTo?: string;

  constructor(private readonly config = process.env) {
    const user = config.SMTP_USER?.trim();
    const pass = config.SMTP_PASS?.trim();
    this.from = config.SMTP_FROM?.trim() || user || '';
    this.to = config.SUPPORT_EMAIL_TO?.trim() || 'procurexsupport@gmail.com';
    this.replyTo = config.SMTP_REPLY_TO?.trim() || user || undefined;

    if (!user || !pass) {
      throw deliveryConfigError('SMTP user and password are not configured.');
    }
    if (!this.from) {
      throw deliveryConfigError('SMTP sender is not configured.');
    }
    if (!this.to) {
      throw deliveryConfigError('Support recipient email is not configured.');
    }

    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST?.trim() || 'smtp.gmail.com',
      port: numberConfig(config.SMTP_PORT, 587),
      secure: boolConfig(config.SMTP_SECURE, false),
      auth: { user, pass }
    });
  }

  async sendTicketCreated(input: SupportEmailTicketInput) {
    const text = [
      'A signed-in ProcureX user created a support ticket.',
      '',
      line('Ticket ID', input.id),
      line('Subject', input.subject),
      line('Category', input.category),
      line('Priority', input.priority),
      line('User ID', input.ownerUserId),
      line('User email', input.ownerEmail),
      line('User name', input.ownerName),
      line('Organization ID', input.ownerOrgId),
      line('Organization', input.organizationName),
      '',
      'Description:',
      input.description
    ].join('\n');

    await this.send({
      subject: `[ProcureX Support] ${input.priority}: ${input.subject}`,
      text,
      replyTo: input.ownerEmail || this.replyTo
    });
  }

  async sendPublicContact(input: PublicContactEmailInput) {
    const text = [
      'A public ProcureX contact request was submitted.',
      '',
      line('Full name', input.fullName),
      line('Email', input.email),
      line('Phone', input.phone),
      line('Organization', input.organization),
      line('Request type', input.requestType),
      '',
      'Message:',
      input.message
    ].join('\n');

    await this.send({
      subject: `[ProcureX Contact] ${input.requestType}: ${input.fullName}`,
      text,
      replyTo: input.email
    });
  }

  private async send(input: { subject: string; text: string; replyTo?: string }) {
    await this.transporter
      .sendMail({
        from: this.from,
        to: this.to,
        subject: input.subject,
        text: input.text,
        replyTo: input.replyTo || this.replyTo
      })
      .catch((error: unknown) => {
        throw deliveryConfigError(error instanceof Error ? error.message : 'Support email request failed.');
      });
  }
}
