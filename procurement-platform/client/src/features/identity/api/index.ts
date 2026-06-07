import { apiClient } from '@/shared/api/http';
import type {
  BusinessRegistrationSource,
  EntityType,
  RegistryRecord,
  VerificationMe,
  VerificationProfile,
  VerificationSubmitResult
} from '../types';

export type VerificationDraftInput = {
  entityType?: EntityType;
  businessRegistrationSource?: BusinessRegistrationSource;
  registrySource?: string;
  registryNumber?: string;
  registryVerified?: boolean;
  registryRecordId?: string;
  signatureName?: string;
  signatureTitle?: string;
  signatureConsent?: boolean;
  signatureConsentVersion?: string;
  signatureConsentTitle?: string;
  profile?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
};

export type VerificationSubmitInput = Required<
  Pick<
    VerificationDraftInput,
    'entityType' | 'registrySource' | 'registryNumber' | 'registryVerified' | 'registryRecordId' | 'signatureName' | 'signatureConsent'
  >
> &
  VerificationDraftInput;

export const identityApi = {
  async getVerificationMe() {
    const response = await apiClient.get<VerificationMe>('/api/identity/verification/me');
    return response.data;
  },
  async lookupRegistry(input: {
    entityType: EntityType;
    businessRegistrationSource?: BusinessRegistrationSource;
    registryNumber: string;
  }) {
    const response = await apiClient.post<RegistryRecord>('/api/identity/verification/registry-lookup', input);
    return response.data;
  },
  async saveVerificationDraft(input: VerificationDraftInput) {
    const response = await apiClient.put<VerificationProfile>('/api/identity/verification/draft', input);
    return response.data;
  },
  async submitVerification(input: VerificationSubmitInput) {
    const response = await apiClient.post<VerificationSubmitResult>('/api/identity/verification/submit', input);
    return response.data;
  },
  async updateProfile(input: { profile: Record<string, unknown>; documents?: Record<string, unknown>[] }) {
    const response = await apiClient.put<VerificationProfile>('/api/identity/profile', input);
    return response.data;
  }
};
