import type { AccountType, VerificationStatus } from '@prisma/client';

export const moduleDefinition = {
  key: 'identity',
  name: 'Identity',
  description: 'Accounts, sessions, verification, admin account type, and user access context.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type SessionUserDto = {
  id: string;
  email: string;
  phone?: string | null;
  displayName: string;
  accountType: AccountType;
  verificationStatus: VerificationStatus;
  organization?: string;
  organizationId?: string;
  capabilities: string[];
};

export type AuthSessionDto = {
  token: string;
  user: SessionUserDto;
  expiresAt: string;
};

export type RegistryRecordDto = {
  id: string;
  source: string;
  registryNumber: string;
  entityType: string;
  name: string;
  status: string;
  confidence: number;
  payload: Record<string, unknown>;
};

export type VerificationProfileDto = {
  id: string;
  status: VerificationStatus;
  registrySource?: string | null;
  registryNumber?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AdminVerificationDto = VerificationProfileDto & {
  user: SessionUserDto;
  reviewReasons: string[];
};

