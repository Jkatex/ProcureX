import { AuditSeverity } from '@prisma/client';
import type { RequestHandler } from 'express';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { ModuleRepository } from '../modules/identity/repository.js';
import { isProductionRuntime, securityConfig } from './config.js';

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();
let redisClient: Redis | null = null;

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function requestError(message: string, status = 429) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function incrementMemoryRateLimit(key: string, windowSeconds: number) {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }

  existing.count += 1;
  return existing.count;
}

function redis() {
  const { redisUrl } = securityConfig();
  if (!redisUrl) {
    if (isProductionRuntime()) {
      throw new Error('REDIS_URL is required for production auth rate limiting.');
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

async function auditRateLimit(req: Parameters<RequestHandler>[0], limiterName: string) {
  if (!process.env.DATABASE_URL) return;
  try {
    await new ModuleRepository().createAuditEvent({
      event: 'identity.auth.rate_limited',
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

export function resetAuthRateLimitState() {
  memoryStore.clear();
}

export function createAuthRateLimit(name: string): RequestHandler {
  return async (req, _res, next) => {
    const config = securityConfig();
    if (!config.authRateLimitEnabled) {
      next();
      return;
    }

    try {
      const windowSeconds = config.authRateLimitWindowSeconds;
      const key = `auth:rate:${name}:${hashValue(req.ip ?? 'unknown')}`;
      let count: number;
      const client = redis();

      if (client) {
        try {
          if (client.status === 'wait') await client.connect();
          count = await client.incr(key);
          if (count === 1) await client.expire(key, windowSeconds);
        } catch (error) {
          if (isProductionRuntime()) throw error;
          count = incrementMemoryRateLimit(key, windowSeconds);
        }
      } else {
        count = incrementMemoryRateLimit(key, windowSeconds);
      }

      if (count > config.authRateLimitMax) {
        await auditRateLimit(req, name);
        next(requestError('Too many auth requests. Please wait and try again.', 429));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
