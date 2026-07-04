import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resendMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  send: vi.fn()
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation((apiKey: string) => {
    resendMocks.constructor(apiKey);
    return {
      emails: {
        send: resendMocks.send
      }
    };
  })
}));

import {
  BeemSmsProvider,
  BeemWhatsAppProvider,
  createIdentityNotifications,
  ResendEmailProvider
} from '../modules/identity/notifications.js';
import { BeemPhoneValidationProvider } from '../modules/identity/phoneValidation.js';
import { validateProductionSecurityConfig } from '../security/config.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

function mockJsonFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function basicAuth() {
  return `Basic ${Buffer.from('beem-key:beem-secret').toString('base64')}`;
}

function beemConfig(): NodeJS.ProcessEnv {
  return {
    BEEM_API_KEY: 'beem-key',
    BEEM_SECRET_KEY: 'beem-secret',
    BEEM_SMS_BASE_URL: 'https://apisms.beem.africa',
    BEEM_SMS_SENDER: 'ProcureX',
    BEEM_CHAT_BASE_URL: 'https://apichatcore.beem.africa',
    BEEM_BROADCAST_BASE_URL: 'https://apibroadcast.beem.africa',
    BEEM_WHATSAPP_FROM: '+255700000099'
  } as NodeJS.ProcessEnv;
}

function setProductionEnv() {
  process.env.NODE_ENV = 'production';
  process.env.APP_ENV = 'production';
  process.env.CORS_ORIGINS = 'https://app.procurex.test';
  process.env.REDIS_URL = 'redis://redis:6379';
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
  process.env.APP_PUBLIC_URL = 'https://app.procurex.test';
  process.env.IDENTITY_EMAIL_PROVIDER = 'resend';
  process.env.IDENTITY_PHONE_PROVIDER = 'sms';
  process.env.IDENTITY_SMS_PROVIDER = 'beem';
  process.env.RESEND_API_KEY = 'resend-key';
  process.env.RESEND_FROM = 'ProcureX <no-reply@procurex.test>';
  process.env.BEEM_API_KEY = 'beem-key';
  process.env.BEEM_SECRET_KEY = 'beem-secret';
  process.env.BEEM_SMS_BASE_URL = 'https://apisms.beem.africa';
  process.env.BEEM_SMS_SENDER = 'ProcureX';
  process.env.TRA_REGISTRY_BASE_URL = 'https://tra.procurex.test';
  process.env.TRA_REGISTRY_API_KEY = 'tra-key';
  process.env.BRELA_REGISTRY_BASE_URL = 'https://brela.procurex.test';
  process.env.BRELA_REGISTRY_API_KEY = 'brela-key';
  process.env.MAILBOXLAYER_ACCESS_KEY = 'mailboxlayer-key';
  process.env.SIGNATURE_HASH_SECRET = 'signature-secret';
}

describe('Resend and Beem identity delivery integrations', () => {
  beforeEach(() => {
    resendMocks.send.mockResolvedValue({ data: { id: 'resend-message-1' }, error: null });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv();
    vi.clearAllMocks();
  });

  it('sends activation email through Resend with idempotency and metadata tags', async () => {
    const provider = new ResendEmailProvider({
      RESEND_API_KEY: 'resend-key',
      RESEND_FROM: 'ProcureX <no-reply@procurex.test>',
      RESEND_REPLY_TO: 'support@procurex.test'
    } as NodeJS.ProcessEnv);

    const receipt = await provider.sendActivation({
      to: 'owner@example.test',
      code: 'ACTIVATE123',
      expiresInMinutes: 60,
      idempotencyKey: 'identity-email-activation/challenge-1',
      metadata: { challenge_id: 'challenge-1' }
    });

    expect(resendMocks.constructor).toHaveBeenCalledWith('resend-key');
    expect(resendMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ProcureX <no-reply@procurex.test>',
        to: 'owner@example.test',
        subject: 'Activate your ProcureX account',
        replyTo: 'support@procurex.test'
      }),
      { idempotencyKey: 'identity-email-activation/challenge-1' }
    );
    expect(resendMocks.send.mock.calls[0][0].html).toContain('ACTIVATE123');
    expect(resendMocks.send.mock.calls[0][0].tags).toEqual(
      expect.arrayContaining([
        { name: 'category', value: 'identity_activation' },
        { name: 'challenge_id', value: 'challenge-1' }
      ])
    );
    expect(receipt).toEqual({ provider: 'resend', messageId: 'resend-message-1' });
  });

  it('sends password reset email through Resend and surfaces SDK errors', async () => {
    const provider = new ResendEmailProvider({
      RESEND_API_KEY: 'resend-key',
      RESEND_FROM: 'ProcureX <no-reply@procurex.test>'
    } as NodeJS.ProcessEnv);

    await provider.sendPasswordReset({
      to: 'owner@example.test',
      code: '123456',
      expiresInMinutes: 30,
      actionUrl: 'https://app.procurex.test/forgot-password?challengeId=challenge-2#code=123456',
      idempotencyKey: 'identity-password-reset/challenge-2'
    });

    expect(resendMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your ProcureX password'
      }),
      { idempotencyKey: 'identity-password-reset/challenge-2' }
    );
    expect(resendMocks.send.mock.calls[0][0].text).toContain('https://app.procurex.test/forgot-password');

    resendMocks.send.mockResolvedValueOnce({ data: null, error: { message: 'domain not verified', name: 'validation_error' } });
    await expect(
      provider.sendPasswordReset({ to: 'owner@example.test', code: '123456', expiresInMinutes: 30 })
    ).rejects.toThrow(/domain not verified/);
  });

  it('formats Beem SMS requests with Basic auth, sender ID, and recipients without leading plus', async () => {
    const fetchMock = mockJsonFetch({ successful: true, request_id: 67, code: 100 });
    const provider = new BeemSmsProvider(beemConfig());

    const receipt = await provider.sendOtp({ to: '+255700000001', code: '123456', expiresInMinutes: 10 });

    expect(fetchMock).toHaveBeenCalledWith('https://apisms.beem.africa/v1/send', expect.any(Object));
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: basicAuth()
    });
    expect(JSON.parse(options.body as string)).toEqual({
      source_addr: 'ProcureX',
      schedule_time: '',
      encoding: 0,
      message: 'Your ProcureX verification code is 123456. It expires in 10 minutes.',
      recipients: [{ recipient_id: 1, dest_addr: '255700000001' }]
    });
    expect(receipt).toMatchObject({ provider: 'beem-sms', messageId: '67' });
  });

  it('formats Beem WhatsApp template and session requests', async () => {
    const fetchMock = mockJsonFetch({ data: { jobId: 'job-1', successful: true } });
    const provider = new BeemWhatsAppProvider(beemConfig());

    const templateReceipt = await provider.sendTemplate({
      to: '+255700000001',
      templateId: 1024,
      params: ['123456'],
      mediaUrl: 'https://cdn.procurex.test/notice.pdf'
    });

    expect(fetchMock).toHaveBeenCalledWith('https://apibroadcast.beem.africa/v1/broadcast/template/api-send', expect.any(Object));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      from_addr: '255700000099',
      destination_addr: [{ phoneNumber: '255700000001', params: ['123456'] }],
      channel: 'whatsapp',
      content: { mediaUrl: 'https://cdn.procurex.test/notice.pdf' },
      messageTemplateData: { id: 1024 }
    });
    expect(templateReceipt).toMatchObject({ provider: 'beem-whatsapp-template', messageId: 'job-1' });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message_id: 'session-1' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const sessionReceipt = await provider.sendSessionMessage({
      to: '+255700000002',
      text: 'Hello from ProcureX',
      idempotencyKey: 'conversation-1'
    });

    expect(fetchMock).toHaveBeenLastCalledWith('https://apichatcore.beem.africa/v1/chatapi', expect.any(Object));
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toMatchObject({
      from: '255700000099',
      to: '255700000002',
      channel: 'whatsapp',
      transaction_id: 'conversation-1',
      message_type: 'text',
      text: 'Hello from ProcureX'
    });
    expect(sessionReceipt).toMatchObject({ provider: 'beem-whatsapp-session', messageId: 'session-1' });
  });

  it('keeps phone validation local while naming Beem as the configured delivery path', async () => {
    const provider = new BeemPhoneValidationProvider();

    await expect(provider.validate({ phone: '+255700000001' })).resolves.toMatchObject({
      provider: 'beem-phone-validation',
      configured: false,
      accepted: true,
      checks: { valid: true }
    });
    await expect(provider.validate({ phone: '0700000001' })).resolves.toMatchObject({
      accepted: false,
      reasons: ['Phone number must use a valid international format.']
    });
  });

  it('routes identity delivery through Resend and Beem while allowing local dev-console overrides', async () => {
    const fetchMock = mockJsonFetch({ request_id: 'sms-1' });
    const notifications = createIdentityNotifications({
      ...beemConfig(),
      RESEND_API_KEY: 'resend-key',
      RESEND_FROM: 'ProcureX <no-reply@procurex.test>',
      IDENTITY_EMAIL_PROVIDER: 'resend',
      IDENTITY_PHONE_PROVIDER: 'sms',
      IDENTITY_SMS_PROVIDER: 'beem'
    } as NodeJS.ProcessEnv);

    await expect(notifications.sendPhoneOtp({ to: '+255700000001', code: '123456', expiresInMinutes: 10 })).resolves.toMatchObject({ provider: 'beem-sms' });
    await expect(notifications.sendEmailActivation({ to: 'owner@example.test', code: 'ABC123', expiresInMinutes: 60 })).resolves.toMatchObject({ provider: 'resend' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resendMocks.send).toHaveBeenCalledTimes(1);

    const devNotifications = createIdentityNotifications({
      NODE_ENV: 'test',
      APP_ENV: 'test',
      IDENTITY_NOTIFICATION_PROVIDER: 'dev-console',
      IDENTITY_EMAIL_PROVIDER: 'dev-console',
      IDENTITY_PHONE_PROVIDER: 'dev-console'
    } as NodeJS.ProcessEnv);
    await expect(devNotifications.sendPhoneOtp({ to: '+255700000001', code: '123456', expiresInMinutes: 10 })).resolves.toEqual({ provider: 'dev-console' });
  });

  it('requires Resend and Beem env in production and rejects legacy providers', () => {
    setProductionEnv();
    expect(() => validateProductionSecurityConfig()).not.toThrow();

    delete process.env.RESEND_API_KEY;
    expect(() => validateProductionSecurityConfig()).toThrow(/RESEND_API_KEY/);

    setProductionEnv();
    delete process.env.BEEM_SECRET_KEY;
    expect(() => validateProductionSecurityConfig()).toThrow(/BEEM_SECRET_KEY/);

    setProductionEnv();
    process.env.IDENTITY_EMAIL_PROVIDER = 'legacy-email';
    expect(() => validateProductionSecurityConfig()).toThrow(/IDENTITY_EMAIL_PROVIDER/);

    setProductionEnv();
    process.env.IDENTITY_SMS_PROVIDER = 'legacy-sms';
    expect(() => validateProductionSecurityConfig()).toThrow(/IDENTITY_SMS_PROVIDER/);

    setProductionEnv();
    process.env.IDENTITY_EMAIL_PROVIDER = 'dev-console';
    expect(() => validateProductionSecurityConfig()).toThrow(/dev-console/);
  });

  it('requires WhatsApp env only when Beem WhatsApp is enabled', () => {
    setProductionEnv();
    process.env.BEEM_WHATSAPP_ENABLED = 'true';
    expect(() => validateProductionSecurityConfig()).toThrow(/BEEM_WHATSAPP_FROM/);

    process.env.BEEM_WHATSAPP_FROM = '+255700000099';
    expect(() => validateProductionSecurityConfig()).toThrow(/BEEM_WHATSAPP_TEMPLATE_OTP/);

    process.env.BEEM_WHATSAPP_TEMPLATE_OTP = '1024';
    expect(() => validateProductionSecurityConfig()).not.toThrow();
  });
});
