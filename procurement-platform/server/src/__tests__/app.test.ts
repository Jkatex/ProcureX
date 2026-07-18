import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { registeredModules } from '../modules/index.js';
import { apiErrorResponseBody } from '../modules/shared/apiErrors.js';
import { resetAuthRateLimitState } from '../security/rateLimit.js';
import { verifyTurnstileToken } from '../security/turnstile.js';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDirectUrl = process.env.DIRECT_URL;
const originalAppEnv = process.env.APP_ENV;

describe('ProcureX server skeleton', () => {
  beforeEach(async () => {
    await resetAuthRateLimitState();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.DATABASE_URL = '';
    process.env.DIRECT_URL = '';
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
    delete process.env.AUTH_RATE_LIMIT_DISABLED;
    delete process.env.API_MUTATION_RATE_LIMIT_MAX;
    delete process.env.API_MUTATION_RATE_LIMIT_WINDOW_SECONDS;
    delete process.env.API_MUTATION_RATE_LIMIT_DISABLED;
    delete process.env.CORS_ORIGINS;
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.APP_ENV = 'local';
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalDirectUrl === undefined) delete process.env.DIRECT_URL;
    else process.env.DIRECT_URL = originalDirectUrl;
    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
  });

  it('returns health with all registered modules', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.modules).toHaveLength(registeredModules.length);
  });

  it('returns the standard user-facing error contract for missing routes', async () => {
    const response = await request(createApp()).get('/api/not-a-module').expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: 'request_error',
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested ProcureX endpoint was not found.',
      userMessage: 'The requested ProcureX endpoint was not found.',
      reason: 'Check the link or return to the previous page.',
      fieldErrors: []
    });
  });

  it('localizes validation errors into the standard response contract', async () => {
    const response = await request(createApp())
      .post('/api/identity/auth/sign-in')
      .set('X-ProcureX-Language', 'sw')
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: 'request_error',
      code: 'VALIDATION_FAILED',
      userMessage: 'Baadhi ya taarifa ulizowasilisha hazijakamilika au si sahihi.',
      reason: 'Kagua sehemu zilizoonyeshwa kisha ujaribu tena.'
    });
    expect(response.body.fieldErrors.length).toBeGreaterThan(0);
  });

  it('keeps internal server errors generic in the standard response contract', () => {
    const response = apiErrorResponseBody(Object.assign(new Error('Database password leaked.'), { status: 500 }), 'en');

    expect(response).toMatchObject({
      success: false,
      error: 'internal_error',
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
      userMessage: 'Unexpected server error.',
      reason: 'ProcureX could not complete this request.',
      fieldErrors: []
    });
    expect(JSON.stringify(response)).not.toContain('Database password leaked');
  });

  it('mounts each module status route', async () => {
    for (const module of registeredModules) {
      const statusPath = module.key === 'records' ? `${module.basePath}/status` : module.basePath;
      const response = await request(createApp()).get(statusPath).expect(200);

      expect(response.body.key).toBe(module.key);
      expect(response.body.status).toBe('ready');
    }
  });

  it('sets security headers and rejects unapproved CORS origins', async () => {
    const app = createApp();
    const health = await request(app).get('/health').set('Origin', 'http://localhost:5173').expect(200);
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    await request(app).get('/health').set('Origin', 'https://evil.example').expect(403);
  });

  it('sets an explicit CSP for app assets, API fetches, dotLottie, and Turnstile', async () => {
    const response = await request(createApp()).get('/health').expect(200);
    const csp = response.headers['content-security-policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://unpkg.com');
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain('http://localhost:4000');
  });

  it('requires a valid Turnstile token before public auth handlers run', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, 'error-codes': ['invalid-input-response'] })
      })
    );

    const response = await request(createApp())
      .post('/api/identity/auth/sign-in')
      .send({ email: 'user@example.test', password: 'Strong123!', turnstileToken: 'bad-token' })
      .expect(403);

    expect(response.body.message).toContain('Security check failed');
  });

  it('accepts the local Cloudflare testing secret without a network call', async () => {
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyTurnstileToken({ token: 'local-test-token' })).resolves.toEqual({
      success: true,
      errorCodes: []
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits public auth endpoints before repeated security checks', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '1';
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';

    const app = createApp();
    await request(app).post('/api/identity/auth/sign-in').send({ email: 'user@example.test', password: 'Strong123!', turnstileToken: 'bad-token' }).expect(403);
    await request(app).post('/api/identity/auth/sign-in').send({ email: 'user@example.test', password: 'Strong123!', turnstileToken: 'bad-token' }).expect(429);
  });

  it('rate limits sensitive identity profile and signature mutations', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '1';
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';

    const app = createApp();
    await request(app).post('/api/identity/signature/request').send({ signatureName: 'Amina Buyer' });
    await request(app).post('/api/identity/signature/request').send({ signatureName: 'Amina Buyer' }).expect(429);
  });

  it('rate limits procurement contact verification mutations', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '1';
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';

    const app = createApp();
    await request(app).post('/api/procurement/contact-verifications/verify').send({ challengeId: 'challenge-1', code: '000000' });
    await request(app).post('/api/procurement/contact-verifications/verify').send({ challengeId: 'challenge-1', code: '000000' }).expect(429);
  });

  it('rate limits award-contract sample mutations', async () => {
    process.env.API_MUTATION_RATE_LIMIT_MAX = '1';
    process.env.API_MUTATION_RATE_LIMIT_WINDOW_SECONDS = '60';

    const app = createApp();
    await request(app).post('/api/award-contract/samples/sample-1/verify').send({ condition: 'accepted' });
    await request(app).post('/api/award-contract/samples/sample-1/verify').send({ condition: 'accepted' }).expect(429);
  });

  it('rate limits post-award finance mutations', async () => {
    process.env.API_MUTATION_RATE_LIMIT_MAX = '1';
    process.env.API_MUTATION_RATE_LIMIT_WINDOW_SECONDS = '60';

    const app = createApp();
    await request(app).patch('/api/post-award/contracts/contract-1/invoices/invoice-1/verify').send({ financeNote: 'Checked' });
    await request(app).patch('/api/post-award/contracts/contract-1/invoices/invoice-1/verify').send({ financeNote: 'Checked' }).expect(429);
  });

  it('returns the public welcome contract without authentication', async () => {
    const response = await request(createApp()).get('/api/procurement/public/welcome').expect(200);

    expect(response.body.stats).toEqual(
      expect.objectContaining({
        participantCount: expect.any(Number),
        participantLabel: expect.any(String),
        openTenderCount: expect.any(Number),
        verifiedProfileCompletionRate: expect.any(Number),
        activeWorkspaceLabel: expect.any(String)
      })
    );
    expect(response.body.featuredTenders[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        reference: expect.any(String),
        title: expect.any(String),
        buyerName: expect.any(String),
        type: expect.any(String),
        status: expect.any(String),
        currency: expect.any(String),
        categories: expect.any(Array)
      })
    );
  });

  it('returns public page and current legal version contracts without authentication', async () => {
    const pageResponse = await request(createApp()).get('/api/public/pages/privacy-policy').expect(200);
    expect(pageResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        pageKey: 'privacy-policy',
        version: expect.any(String),
        status: 'PUBLISHED',
        title: 'Privacy Policy',
        content: expect.any(Object),
        effectiveAt: expect.any(String),
        lastUpdated: expect.any(String)
      })
    );

    const legalResponse = await request(createApp()).get('/api/public/legal/current').expect(200);
    expect(legalResponse.body.terms.pageKey).toBe('terms-and-conditions');
    expect(legalResponse.body.privacy.pageKey).toBe('privacy-policy');
  });

  it('keeps award-contract workflow routes behind authentication', async () => {
    await request(createApp()).get('/api/award-contract/recommendations').expect(401);
    await request(createApp()).get('/api/award-contract/contracts').expect(401);
    await request(createApp())
      .post('/api/award-contract/notices/11111111-1111-4111-8111-111111111111/respond')
      .send({ action: 'ACCEPT' })
      .expect(401);
  });

  it('keeps compliance admin data routes behind authentication', async () => {
    await request(createApp()).get('/api/compliance-admin/dashboard').expect(401);
    await request(createApp()).get('/api/compliance-admin/users').expect(401);
    await request(createApp()).get('/api/compliance-admin/audit/events').expect(401);
    await request(createApp())
      .post('/api/compliance-admin/compliance/rules')
      .send({ code: 'KYC.TEST', title: 'Test rule', condition: {} })
      .expect(401);
  });
});
