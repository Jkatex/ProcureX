import { AuditSeverity } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { ipKeyGenerator, rateLimit, type IncrementResponse, type Options, type Store } from 'express-rate-limit';
import { ModuleRepository } from '../modules/identity/repository.js';
import { requestError } from '../modules/shared/apiErrors.js';
import { isProductionRuntime, securityConfig } from './config.js';

type MemoryEntry = {
  count: number;
  resetAt: number;
};

type RateLimitProfile = {
  prefix: string;
  event: string;
  message: string;
  max: () => number;
  windowSeconds: () => number;
  enabled: () => boolean;
};

const memoryStore = new Map<string, MemoryEntry>();
let redisClient: Redis | null = null;

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function incrementMemoryRateLimit(key: string, windowSeconds: number): IncrementResponse {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return { totalHits: 1, resetTime: new Date(resetAt) };
  }

  existing.count += 1;
  return { totalHits: existing.count, resetTime: new Date(existing.resetAt) };
}

function resetMemoryRateLimit(key: string) {
  memoryStore.delete(key);
}

function redis() {
  const { redisUrl } = securityConfig();
  if (!redisUrl) {
    if (isProductionRuntime()) {
      throw new Error('REDIS_URL is required for production rate limiting.');
    }
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
    redisClient.on('error', () => {
      // Local development can run without Redis; the request path falls back to memory.
    });
  }
  return redisClient;
}

async function auditRateLimit(req: Request, limiterName: string, event: string) {
  if (!process.env.DATABASE_URL) return;
  try {
    await new ModuleRepository().createAuditEvent({
      event,
      entityType: 'identity_auth',
      severity: AuditSeverity.WARNING,
      payload: {
        limiterName,
        path: req.path,
        method: req.method,
        ipHash: hashValue(req.ip ?? ''),
        userAgentHash: hashValue(req.header('user-agent') ?? '')
      }
    });
  } catch {
    // Rate-limit enforcement must not depend on audit storage availability.
  }
}

class ProcureXRateLimitStore implements Store {
  readonly prefix: string;
  readonly localKeys = false;

  constructor(
    prefix: string,
    private readonly windowSeconds: () => number
  ) {
    this.prefix = prefix;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const windowSeconds = this.windowSeconds();
    const storageKey = `${this.prefix}:${key}`;
    const client = redis();

    if (client) {
      try {
        if (client.status === 'wait') await client.connect();
        const count = await client.incr(storageKey);
        if (count === 1) await client.expire(storageKey, windowSeconds);
        const ttl = await client.ttl(storageKey);
        const resetMs = Date.now() + Math.max(ttl, 1) * 1000;
        return { totalHits: count, resetTime: new Date(resetMs) };
      } catch (error) {
        if (isProductionRuntime()) throw error;
      }
    }

    return incrementMemoryRateLimit(storageKey, windowSeconds);
  }

  async decrement(key: string): Promise<void> {
    const storageKey = `${this.prefix}:${key}`;
    const entry = memoryStore.get(storageKey);
    if (entry) entry.count = Math.max(0, entry.count - 1);
  }

  async resetKey(key: string): Promise<void> {
    const storageKey = `${this.prefix}:${key}`;
    resetMemoryRateLimit(storageKey);
    const client = redis();
    if (!client) return;

    try {
      if (client.status === 'wait') await client.connect();
      await client.del(storageKey);
    } catch {
      // Reset helpers are best-effort for local tests and development.
    }
  }

  async resetAll(): Promise<void> {
    const client = redis();
    memoryStore.clear();
    if (!client) return;

    try {
      if (client.status === 'wait') await client.connect();
      const keys = await client.keys(`${this.prefix}:*`);
      if (keys.length > 0) await client.del(...keys);
    } catch {
      // Reset helpers are best-effort for local tests and development.
    }
  }
}

export async function resetAuthRateLimitState() {
  memoryStore.clear();
  if (!redisClient) return;

  try {
    if (redisClient.status === 'wait') await redisClient.connect();
    const keys = [...(await redisClient.keys('auth:rate:*')), ...(await redisClient.keys('api:mutation:*'))];
    if (keys.length > 0) await redisClient.del(...keys);
  } catch {
    // Test and local reset helpers should not fail when Redis is unavailable.
  }
}

function createRateLimitOptions(name: string, profile: RateLimitProfile): Partial<Options> {
  return {
    windowMs: profile.windowSeconds() * 1000,
    limit: () => profile.max(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !profile.enabled(),
    keyGenerator: (req) => hashValue(ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown')),
    store: new ProcureXRateLimitStore(`${profile.prefix}:${name}`, profile.windowSeconds),
    handler: async (req, _res, next) => {
      await auditRateLimit(req, name, profile.event);
      next(requestError(profile.message, 429));
    }
  };
}

export function createAuthRateLimitOptions(name: string): Partial<Options> {
  return createRateLimitOptions(name, {
    prefix: 'auth:rate',
    event: 'identity.auth.rate_limited',
    message: 'Too many auth requests. Please wait and try again.',
    max: () => securityConfig().authRateLimitMax,
    windowSeconds: () => securityConfig().authRateLimitWindowSeconds,
    enabled: () => securityConfig().authRateLimitEnabled
  });
}

export function createApiMutationRateLimitOptions(name: string): Partial<Options> {
  return createRateLimitOptions(name, {
    prefix: 'api:mutation',
    event: 'api.mutation.rate_limited',
    message: 'Too many change requests. Please wait and try again.',
    max: () => securityConfig().apiMutationRateLimitMax,
    windowSeconds: () => securityConfig().apiMutationRateLimitWindowSeconds,
    enabled: () => securityConfig().apiMutationRateLimitEnabled
  });
}

export function createAuthRateLimit(name: string): RequestHandler {
  return rateLimit(createAuthRateLimitOptions(name));
}
