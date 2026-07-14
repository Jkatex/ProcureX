import type { SessionUser } from '@/shared/types/domain';

export type VerificationStep = 'registry' | 'documents' | 'capabilities' | 'signature';
export type EntityType = 'individual' | 'company' | 'business';
export type BusinessRegistrationSource = 'tin' | 'brela';

export type RegistryRecord = {
  id: string;
  source: string;
  registryNumber: string;
  entityType: string;
  name: string;
  status: string;
  confidence: number;
  payload: Record<string, unknown>;
};

export type VerificationProfile = {
  id: string;
  status: SessionUser['verificationStatus'];
  registrySource?: string | null;
  registryNumber?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type VerificationMe = {
  user: SessionUser;
  verification: VerificationProfile | null;
};

export type VerificationSubmitResult = {
  user: SessionUser;
  verification: VerificationProfile;
  autoApproved: boolean;
  reviewReasons: string[];
};

export type SigningCredentialStatus = {
  hasCredential: boolean;
  status: string;
  keyFingerprint: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  provider: string | null;
};

export type KeyphraseRecoveryHistoryItem = {
  id: string;
  status: string;
  email: string;
  phoneMasked: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  completedAt: string | null;
  oldKeyFingerprint: string | null;
  newKeyFingerprint: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; displayName: string } | null;
  organization?: { id: string; name: string } | null;
};

export type KeyphraseStatusResponse = {
  credential: SigningCredentialStatus;
  recoveryHistory: KeyphraseRecoveryHistoryItem[];
};
