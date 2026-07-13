import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function requestError(message: string, status = 429) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function resetHelpCentreRateLimitState() {
  memoryStore.clear();
}

export function createHelpCentreRateLimit(name: string): RequestHandler {
  return (req, _res, next) => {
    const max = Number(process.env.HELP_CENTRE_RATE_LIMIT_MAX ?? 120);
    const windowSeconds = Number(process.env.HELP_CENTRE_RATE_LIMIT_WINDOW_SECONDS ?? 60);
    if (!Number.isFinite(max) || max <= 0) {
      next();
      return;
    }

    const now = Date.now();
    const key = `help:${name}:${hashValue(req.ip ?? 'unknown')}`;
    const existing = memoryStore.get(key);
    if (!existing || existing.resetAt <= now) {
      memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > max) {
      next(requestError('Too many Help Centre requests. Please wait and try again.'));
      return;
    }

    next();
  };
}

