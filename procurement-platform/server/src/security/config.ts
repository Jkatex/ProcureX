const localCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:4000'];

function boolEnv(value: string | undefined) {
  return value === 'true' || value === '1';
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function listEnv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
}

export function securityConfig() {
  const production = isProductionRuntime();
  return {
    production,
    corsOrigins: listEnv(process.env.CORS_ORIGINS),
    localCorsOrigins,
    redisUrl: process.env.REDIS_URL,
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
    authRateLimitMax: numberEnv(process.env.AUTH_RATE_LIMIT_MAX, 10),
    authRateLimitWindowSeconds: numberEnv(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS, 60),
    authRateLimitEnabled: !boolEnv(process.env.AUTH_RATE_LIMIT_DISABLED)
  };
}

export function validateProductionSecurityConfig() {
  const config = securityConfig();
  if (config.production && process.env.IDENTITY_NOTIFICATION_PROVIDER === 'dev-console') {
    throw new Error('Production security configuration is invalid: IDENTITY_NOTIFICATION_PROVIDER=dev-console is local-only.');
  }
  if (!config.production) return;

  const missing = [
    ['CORS_ORIGINS', config.corsOrigins.length > 0],
    ['REDIS_URL', Boolean(config.redisUrl)],
    ['TURNSTILE_SECRET_KEY', Boolean(config.turnstileSecretKey)],
    ['TWILIO_ACCOUNT_SID', Boolean(process.env.TWILIO_ACCOUNT_SID)],
    ['TWILIO_AUTH_TOKEN', Boolean(process.env.TWILIO_AUTH_TOKEN)],
    ['TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER', Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER)],
    ['SMTP_HOST', Boolean(process.env.SMTP_HOST)],
    ['SMTP_FROM', Boolean(process.env.SMTP_FROM)],
    ['TRA_REGISTRY_BASE_URL', Boolean(process.env.TRA_REGISTRY_BASE_URL)],
    ['TRA_REGISTRY_API_KEY', Boolean(process.env.TRA_REGISTRY_API_KEY)],
    ['BRELA_REGISTRY_BASE_URL', Boolean(process.env.BRELA_REGISTRY_BASE_URL)],
    ['BRELA_REGISTRY_API_KEY', Boolean(process.env.BRELA_REGISTRY_API_KEY)],
    ['SIGNATURE_HASH_SECRET', Boolean(process.env.SIGNATURE_HASH_SECRET)]
  ].filter(([, configured]) => !configured);

  if (missing.length > 0) {
    throw new Error(`Production security configuration is incomplete: ${missing.map(([name]) => name).join(', ')}.`);
  }
}
