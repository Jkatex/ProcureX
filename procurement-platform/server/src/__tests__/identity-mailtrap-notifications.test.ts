import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mailMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn()
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mailMocks.createTransport
  }
}));

import nodemailer from 'nodemailer';
import { createIdentityNotifications, SmtpEmailProvider } from '../modules/identity/notifications.js';
import { validateProductionSecurityConfig } from '../security/config.js';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

function mailtrapConfig(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    SMTP_HOST: 'live.smtp.mailtrap.io',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'apismtp@mailtrap.io',
    SMTP_PASS: 'test-mailtrap-token',
    SMTP_FROM: 'ProcureX <no-reply@demomailtrap.co>'
  } as NodeJS.ProcessEnv;
}

function setProductionEnv() {
  process.env.NODE_ENV = 'production';
  process.env.APP_ENV = 'production';
  process.env.CORS_ORIGINS = 'https://app.procurex.test';
  process.env.REDIS_URL = 'redis://redis:6379';
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
  process.env.APP_PUBLIC_URL = 'https://app.procurex.test';
  process.env.IDENTITY_EMAIL_PROVIDER = 'smtp';
  process.env.IDENTITY_PHONE_PROVIDER = 'sms';
  process.env.IDENTITY_SMS_PROVIDER = 'sendchamp';
  process.env.SENDCHAMP_ACCESS_KEY = 'sendchamp-key';
  process.env.SENDCHAMP_BASE_URL = 'https://api.sendchamp.com/api/v1';
  process.env.SENDCHAMP_SMS_SENDER = 'ProcureX';
  process.env.SENDCHAMP_SMS_ROUTE = 'international';
  process.env.SMTP_HOST = 'live.smtp.mailtrap.io';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'apismtp@mailtrap.io';
  process.env.SMTP_PASS = 'mailtrap-token';
  process.env.SMTP_FROM = 'ProcureX <no-reply@demomailtrap.co>';
  process.env.TRA_REGISTRY_BASE_URL = 'https://tra.procurex.test';
  process.env.TRA_REGISTRY_API_KEY = 'tra-key';
  process.env.BRELA_REGISTRY_BASE_URL = 'https://brela.procurex.test';
  process.env.BRELA_REGISTRY_API_KEY = 'brela-key';
  process.env.MAILBOXLAYER_ACCESS_KEY = 'mailboxlayer-key';
  process.env.SIGNATURE_HASH_SECRET = 'signature-secret';
}

describe('Mailtrap SMTP identity notifications', () => {
  beforeEach(() => {
    mailMocks.sendMail.mockResolvedValue({ messageId: 'mailtrap-message-1' });
    mailMocks.createTransport.mockReturnValue({ sendMail: mailMocks.sendMail });
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('configures Nodemailer for Mailtrap live SMTP on port 587 with STARTTLS', async () => {
    const provider = new SmtpEmailProvider(mailtrapConfig());

    const receipt = await provider.sendActivation({ to: 'owner@example.test', code: 'ABC123', expiresInMinutes: 60 });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'live.smtp.mailtrap.io',
      port: 587,
      secure: false,
      auth: {
        user: 'apismtp@mailtrap.io',
        pass: 'test-mailtrap-token'
      }
    });
    expect(mailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ProcureX <no-reply@demomailtrap.co>',
        to: 'owner@example.test',
        subject: 'Activate your ProcureX account'
      })
    );
    expect(receipt).toEqual({ provider: 'smtp', messageId: 'mailtrap-message-1' });
  });

  it('routes email through SMTP while keeping phone OTP on dev-console', async () => {
    const notifications = createIdentityNotifications({
      ...mailtrapConfig(),
      IDENTITY_NOTIFICATION_PROVIDER: 'dev-console',
      IDENTITY_EMAIL_PROVIDER: 'smtp',
      IDENTITY_PHONE_PROVIDER: 'dev-console',
      IDENTITY_EMAIL_CODE_LOG_COPY: 'true'
    } as NodeJS.ProcessEnv);

    const phoneReceipt = await notifications.sendPhoneOtp({ to: '+255700000001', code: '123456', expiresInMinutes: 10 });
    const emailReceipt = await notifications.sendPasswordReset({ to: 'owner@example.test', code: 'RESET123', expiresInMinutes: 30 });

    expect(phoneReceipt).toEqual({ provider: 'dev-console' });
    expect(emailReceipt).toEqual({ provider: 'smtp', messageId: 'mailtrap-message-1' });
    expect(mailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ProcureX <no-reply@demomailtrap.co>',
        subject: 'Reset your ProcureX password'
      })
    );
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[identity:smtp-log-copy] password reset for owner@example.test: RESET123'));
  });

  it('does not log SMTP email codes in production', async () => {
    const provider = new SmtpEmailProvider({
      ...mailtrapConfig(),
      NODE_ENV: 'production',
      APP_ENV: 'production',
      IDENTITY_EMAIL_CODE_LOG_COPY: 'true'
    } as NodeJS.ProcessEnv);

    await provider.sendPasswordReset({ to: 'owner@example.test', code: 'RESET123', expiresInMinutes: 30 });

    expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('RESET123'));
  });

  it('requires Mailtrap SMTP credentials in production when SMTP email is selected', () => {
    setProductionEnv();

    expect(() => validateProductionSecurityConfig()).not.toThrow();

    delete process.env.SMTP_PASS;
    expect(() => validateProductionSecurityConfig()).toThrow(/SMTP_PASS/);
  });
});
