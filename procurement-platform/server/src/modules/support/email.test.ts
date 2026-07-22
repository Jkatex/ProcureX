/* Exercises support behavior so regressions are caught close to the domain workflow they protect. */
import { describe, expect, it, vi } from 'vitest';

const smtpMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn()
}));

vi.mock('nodemailer', () => {
  const createTransport = vi.fn((_options: unknown) => {
    smtpMocks.createTransport(_options);
    return {
      sendMail: smtpMocks.sendMail
    };
  });
  return {
    default: { createTransport },
    createTransport
  };
});

import { SmtpSupportEmailSender } from './email.js';

function config(): NodeJS.ProcessEnv {
  return {
    SMTP_USER: 'procurexsupport@gmail.com',
    SMTP_PASS: 'secret',
    SMTP_FROM: 'ProcureX <procurexsupport@gmail.com>',
    SUPPORT_EMAIL_TO: 'support@example.test'
  } as NodeJS.ProcessEnv;
}

describe('support email localization', () => {
  it('renders public contact email labels in Swahili', async () => {
    smtpMocks.sendMail.mockResolvedValue({ messageId: 'smtp-1' });
    const sender = new SmtpSupportEmailSender(config());

    await sender.sendPublicContact({
      fullName: 'Public User',
      email: 'public@example.test',
      requestType: 'General support',
      message: 'I need help before creating an account.',
      language: 'sw'
    });

    expect(smtpMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Jina kamili: Public User')
      })
    );
  });
});
