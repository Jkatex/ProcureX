import { securityConfig } from './config.js';

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
  const secret = securityConfig().turnstileSecretKey;
  if (!secret) {
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
