/* Supports the identity server workflow with reusable logic kept close to the module that owns it. */
export type EmailValidationRequest = {
  email: string;
};

export type EmailValidationResult = {
  provider: string;
  configured: boolean;
  accepted: boolean;
  reasons: string[];
  score?: number;
  didYouMean?: string;
  checks?: {
    formatValid?: boolean;
    mxFound?: boolean;
    smtpCheck?: boolean;
    disposable?: boolean;
    role?: boolean;
    free?: boolean;
  };
};

export interface EmailValidationProvider {
  validate(input: EmailValidationRequest): Promise<EmailValidationResult>;
}

type MailboxlayerResponse = {
  email?: string;
  did_you_mean?: string;
  format_valid?: boolean;
  mx_found?: boolean;
  smtp_check?: boolean | null;
  catch_all?: boolean | null;
  role?: boolean;
  disposable?: boolean;
  free?: boolean;
  score?: number;
  success?: false;
  error?: {
    code?: number;
    type?: string;
    info?: string;
  };
};

function providerError(message: string) {
  const error = new Error(message) as Error & { providerFailure?: true };
  error.providerFailure = true;
  return error;
}

function boolEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function baseUrlWithPath(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!url.pathname || url.pathname === '/') url.pathname = '/api/check';
  else if (url.pathname.replace(/\/$/, '') === '/api') url.pathname = '/api/check';
  return url;
}

export class MailboxlayerEmailValidationProvider implements EmailValidationProvider {
  constructor(private readonly config = process.env) {}

  async validate(input: EmailValidationRequest): Promise<EmailValidationResult> {
    const accessKey = this.config.MAILBOXLAYER_ACCESS_KEY?.trim();
    const enabled = boolEnv(this.config.MAILBOXLAYER_EMAIL_VALIDATION_ENABLED, Boolean(accessKey));
    if (!enabled || !accessKey) {
      return {
        provider: 'mailboxlayer',
        configured: false,
        accepted: true,
        reasons: []
      };
    }

    const url = baseUrlWithPath(this.config.MAILBOXLAYER_BASE_URL || 'https://apilayer.net/api/check');
    url.searchParams.set('access_key', accessKey);
    url.searchParams.set('email', input.email);
    url.searchParams.set('smtp', boolEnv(this.config.MAILBOXLAYER_SMTP_CHECK, true) ? '1' : '0');
    url.searchParams.set('format', '0');

    const response = await fetch(url, { headers: { accept: 'application/json' } }).catch((error: unknown) => {
      throw providerError(error instanceof Error ? error.message : 'Mailboxlayer request failed.');
    });

    if (!response.ok) {
      throw providerError(`Mailboxlayer returned ${response.status}.`);
    }

    const body = (await response.json().catch(() => {
      throw providerError('Mailboxlayer returned invalid JSON.');
    })) as MailboxlayerResponse;

    if (body.success === false || body.error) {
      throw providerError(body.error?.type || body.error?.info || 'Mailboxlayer rejected the request.');
    }

    const minScore = Math.min(1, Math.max(0, numberEnv(this.config.MAILBOXLAYER_MIN_SCORE, 0.65)));
    const requireSmtp = boolEnv(this.config.MAILBOXLAYER_REQUIRE_SMTP, false);
    const blockDisposable = boolEnv(this.config.MAILBOXLAYER_BLOCK_DISPOSABLE, true);
    const blockRole = boolEnv(this.config.MAILBOXLAYER_BLOCK_ROLE_EMAILS, false);
    const reasons: string[] = [];

    if (body.format_valid === false) reasons.push('Email address format is invalid.');
    if (body.mx_found === false) reasons.push('Email domain does not have valid mail records.');
    if (requireSmtp && body.smtp_check === false) reasons.push('Mailbox could not be verified by SMTP.');
    if (blockDisposable && body.disposable === true) reasons.push('Disposable email addresses are not allowed.');
    if (blockRole && body.role === true) reasons.push('Role-based email addresses are not allowed.');
    if (typeof body.score === 'number' && body.score < minScore) reasons.push('Email deliverability score is too low.');

    return {
      provider: 'mailboxlayer',
      configured: true,
      accepted: reasons.length === 0,
      reasons,
      score: typeof body.score === 'number' ? body.score : undefined,
      didYouMean: typeof body.did_you_mean === 'string' && body.did_you_mean ? body.did_you_mean : undefined,
      checks: {
        formatValid: body.format_valid,
        mxFound: body.mx_found,
        smtpCheck: body.smtp_check ?? undefined,
        disposable: body.disposable,
        role: body.role,
        free: body.free
      }
    };
  }
}

export function isEmailValidationProviderFailure(error: unknown) {
  return Boolean((error as Error & { providerFailure?: true }).providerFailure);
}
