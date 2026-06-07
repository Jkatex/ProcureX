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
