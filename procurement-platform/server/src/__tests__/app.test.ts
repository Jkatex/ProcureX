import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { registeredModules } from '../modules/index.js';
import { resetAuthRateLimitState } from '../security/rateLimit.js';

describe('ProcureX server skeleton', () => {
  beforeEach(() => {
    resetAuthRateLimitState();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
    delete process.env.AUTH_RATE_LIMIT_DISABLED;
    delete process.env.CORS_ORIGINS;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it('returns health with all registered modules', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.modules).toHaveLength(registeredModules.length);
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

  it('rate limits public auth endpoints before repeated security checks', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '1';
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';

    const app = createApp();
    await request(app).post('/api/identity/auth/sign-in').send({ email: 'user@example.test', password: 'Strong123!', turnstileToken: 'bad-token' }).expect(403);
    await request(app).post('/api/identity/auth/sign-in').send({ email: 'user@example.test', password: 'Strong123!', turnstileToken: 'bad-token' }).expect(429);
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
});
