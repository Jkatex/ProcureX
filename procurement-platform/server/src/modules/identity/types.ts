/* Defines identity TypeScript contracts that keep API payloads, state, and UI props aligned. */
import type { AccountType, VerificationStatus } from '@prisma/client';
import type { FeatureGateMap, PermissionName, RiskLevel, ScreeningStatus, TrustTier } from '@procurex/shared';

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
  permissions: PermissionName[];
  trustTier: TrustTier;
  riskLevel: RiskLevel;
  featureGates: FeatureGateMap;
  screeningStatus: ScreeningStatus;
  trustRisk: {
    trustTier: TrustTier;
    riskLevel: RiskLevel;
    screeningStatus: ScreeningStatus;
    score: number | null;
    reasons: string[];
    assessedAt: string | null;
    history: Array<{
      previousTier?: TrustTier | null;
      nextTier: TrustTier;
      riskLevel: RiskLevel;
      score: number;
      reasons: string[];
      createdAt: string;
    }>;
  };
  preferences: {
    preferredLanguage: 'en' | 'sw';
    timezone: string;
  };
  location?: {
    region: string;
    district: string;
    ward: string;
  };
};

export type AuthSessionDto = {
  token: string;
  user: SessionUserDto;
  expiresAt: string;
  isFirstSignIn: boolean;
};

export type MfaChallengeDto = {
  mfaRequired: true;
  challengeId: string;
  methods: Array<'totp' | 'recovery_code'>;
  expiresAt: string;
};

export type AuthSignInResponseDto = AuthSessionDto | MfaChallengeDto;

export type MfaStatusDto = {
  enabled: boolean;
  methods: Array<'totp' | 'recovery_code'>;
  factors: Array<{
    id: string;
    type: string;
    verified: boolean;
    createdAt: string;
  }>;
  recoveryCodesRemaining: number;
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

export type SigningCredentialStatusDto = {
  hasCredential: boolean;
  status: string;
  keyFingerprint: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  provider: string | null;
};

export type AdminVerificationDto = VerificationProfileDto & {
  user: SessionUserDto;
  reviewReasons: string[];
  screeningStatus: ScreeningStatus;
  trustTier: TrustTier;
  riskLevel: RiskLevel;
};
