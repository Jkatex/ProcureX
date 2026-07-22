/* Defines auth TypeScript contracts that keep API payloads, state, and UI props aligned. */
import type { SessionUser } from '@/shared/types/domain';

export type AuthSession = {
  user: SessionUser | null;
  isAuthenticated: boolean;
};
