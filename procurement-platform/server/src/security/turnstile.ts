import { securityConfig } from './config.js';

const localDevelopmentTokenPrefix = 'local-dev-turnstile:';
const cloudflareAlwaysPassTestingSecret = '1x0000000000000000000000000000000AA';

type TurnstileResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

function requestError(message: string, status = 403) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export async function verifyTurnstileToken(input: { token: string; remoteIp?: string }) {
  const config = securityConfig();
  if (!config.production && input.token.startsWith(localDevelopmentTokenPrefix)) {
    return {
      success: true,
      errorCodes: []
    };
  }

  const secret = config.turnstileSecretKey;
  if (!config.production && secret === cloudflareAlwaysPassTestingSecret) {
    return {
      success: true,
      errorCodes: []
    };
  }

  if (!secret) {
    if (!config.production) {
      return {
        success: false,
        errorCodes: ['local-development-token-required']
      };
    }
    throw requestError('Security check is not configured.', 403);
  }

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', input.token);
  if (input.remoteIp) form.set('remoteip', input.remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    throw requestError('Security check provider is unavailable.', 502);
  }

  const payload = (await response.json()) as TurnstileResponse;
  return {
    success: payload.success === true,
    errorCodes: payload['error-codes'] ?? []
  };
}
