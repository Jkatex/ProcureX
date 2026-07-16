import nodemailer, { type Transporter } from 'nodemailer';
import type { SupportTicketPriority } from '@prisma/client';
import { resolveSupportedLanguage, type SupportedLanguage } from '@procurex/shared';

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
  language?: SupportedLanguage;
};

export type PublicContactEmailInput = {
  fullName: string;
  email: string;
  phone?: string;
  organization?: string;
  requestType: string;
  message: string;
  language?: SupportedLanguage;
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

function notProvided(language: SupportedLanguage) {
  return language === 'sw' ? 'Haijatolewa' : 'Not provided';
}

function line(label: string, value: unknown, language: SupportedLanguage) {
  const text = value === undefined || value === null || value === '' ? notProvided(language) : String(value);
  return `${label}: ${text}`;
}

const labels = {
  en: {
    ticketIntro: 'A signed-in ProcureX user created a support ticket.',
    ticketId: 'Ticket ID',
    subject: 'Subject',
    category: 'Category',
    priority: 'Priority',
    userId: 'User ID',
    userEmail: 'User email',
    userName: 'User name',
    orgId: 'Organization ID',
    organization: 'Organization',
    description: 'Description:',
    contactIntro: 'A public ProcureX contact request was submitted.',
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone',
    requestType: 'Request type',
    message: 'Message:'
  },
  sw: {
    ticketIntro: 'Mtumiaji aliyeingia ProcureX ametengeneza ombi la msaada.',
    ticketId: 'Namba ya ombi',
    subject: 'Mada',
    category: 'Kategoria',
    priority: 'Kipaumbele',
    userId: 'Namba ya mtumiaji',
    userEmail: 'Barua pepe ya mtumiaji',
    userName: 'Jina la mtumiaji',
    orgId: 'Namba ya shirika',
    organization: 'Shirika',
    description: 'Maelezo:',
    contactIntro: 'Ombi la mawasiliano la umma la ProcureX limewasilishwa.',
    fullName: 'Jina kamili',
    email: 'Barua pepe',
    phone: 'Simu',
    requestType: 'Aina ya ombi',
    message: 'Ujumbe:'
  }
};

export class SmtpSupportEmailSender implements SupportEmailSender {
  private transporter?: Transporter;
  private readonly user: string;
  private readonly pass: string;
  private readonly from: string;
  private readonly to: string;
  private readonly replyTo?: string;

  constructor(private readonly config = process.env) {
    this.user = config.SMTP_USER?.trim() ?? '';
    this.pass = config.SMTP_PASS?.trim() ?? '';
    this.from = config.SMTP_FROM?.trim() || this.user || '';
    this.to = config.SUPPORT_EMAIL_TO?.trim() || 'procurexsupport@gmail.com';
    this.replyTo = config.SMTP_REPLY_TO?.trim() || this.user || undefined;
  }

  async sendTicketCreated(input: SupportEmailTicketInput) {
    const language = resolveSupportedLanguage(input.language);
    const copy = labels[language];
    const text = [
      copy.ticketIntro,
      '',
      line(copy.ticketId, input.id, language),
      line(copy.subject, input.subject, language),
      line(copy.category, input.category, language),
      line(copy.priority, input.priority, language),
      line(copy.userId, input.ownerUserId, language),
      line(copy.userEmail, input.ownerEmail, language),
      line(copy.userName, input.ownerName, language),
      line(copy.orgId, input.ownerOrgId, language),
      line(copy.organization, input.organizationName, language),
      '',
      copy.description,
      input.description
    ].join('\n');

    await this.send({
      subject: `[ProcureX Support] ${input.priority}: ${input.subject}`,
      text,
      replyTo: input.ownerEmail || this.replyTo
    });
  }

  async sendPublicContact(input: PublicContactEmailInput) {
    const language = resolveSupportedLanguage(input.language);
    const copy = labels[language];
    const text = [
      copy.contactIntro,
      '',
      line(copy.fullName, input.fullName, language),
      line(copy.email, input.email, language),
      line(copy.phone, input.phone, language),
      line(copy.organization, input.organization, language),
      line(copy.requestType, input.requestType, language),
      '',
      copy.message,
      input.message
    ].join('\n');

    await this.send({
      subject: `[ProcureX Contact] ${input.requestType}: ${input.fullName}`,
      text,
      replyTo: input.email
    });
  }

  private async send(input: { subject: string; text: string; replyTo?: string }) {
    await this.getTransporter()
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

  private getTransporter() {
    if (!this.user || !this.pass) {
      throw deliveryConfigError('SMTP user and password are not configured.');
    }
    if (!this.from) {
      throw deliveryConfigError('SMTP sender is not configured.');
    }
    if (!this.to) {
      throw deliveryConfigError('Support recipient email is not configured.');
    }

    this.transporter ??= nodemailer.createTransport({
      host: this.config.SMTP_HOST?.trim() || 'smtp.gmail.com',
      port: numberConfig(this.config.SMTP_PORT, 587),
      secure: boolConfig(this.config.SMTP_SECURE, false),
      auth: { user: this.user, pass: this.pass }
    });
    return this.transporter;
  }
}
