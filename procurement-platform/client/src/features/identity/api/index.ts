import { apiClient } from '@/shared/api/http';
import type { SessionUser } from '@/shared/types/domain';
import type { TanzaniaLocationSelection } from '@procurex/shared';
import type {
  BusinessRegistrationSource,
  EntityType,
  RegistryRecord,
  SigningCredentialStatus,
  KeyphraseRecoveryHistoryItem,
  KeyphraseStatusResponse,
  ProfileImageMutationResult,
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
  signatureKeyphrase?: string;
  signatureConsentVersion?: string;
  signatureConsentTitle?: string;
  location?: TanzaniaLocationSelection;
  profile?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
};

export type VerificationSubmitInput = Required<
  Pick<
    VerificationDraftInput,
    'entityType' | 'registrySource' | 'registryNumber' | 'registryVerified' | 'registryRecordId' | 'signatureName' | 'signatureConsent' | 'location'
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
  async getSignatureStatus() {
    const response = await apiClient.get<SigningCredentialStatus>('/api/identity/signature/status');
    return response.data;
  },
  async requestSignature(input: { keyphrase: string; repeatedKeyphrase: string }) {
    const response = await apiClient.post<SigningCredentialStatus>('/api/identity/signature/request', input);
    return response.data;
  },
  async testSignature(input: { keyphrase: string }) {
    const response = await apiClient.post<{ ok: boolean; canonicalPayloadHash: string; signatureHash: string }>('/api/identity/signature/test', input);
    return response.data;
  },
  async revokeSignature() {
    const response = await apiClient.post<SigningCredentialStatus>('/api/identity/signature/revoke');
    return response.data;
  },
  async getKeyphraseStatus() {
    const response = await apiClient.get<KeyphraseStatusResponse>('/api/identity/keyphrase/status');
    return response.data;
  },
  async changeKeyphrase(input: { currentKeyphrase: string; password: string; newKeyphrase: string; confirmKeyphrase: string }) {
    const response = await apiClient.post<SigningCredentialStatus>('/api/identity/keyphrase/change', input);
    return response.data;
  },
  async startKeyphraseRecovery(input: { email: string; turnstileToken: string }) {
    const response = await apiClient.post<{ ok: boolean; message: string; recoveryId?: string; expiresAt?: string; resendAvailableAt?: string }>('/api/identity/keyphrase/recovery/start', input);
    return response.data;
  },
  async verifyKeyphraseRecoveryEmail(input: { recoveryId: string; code: string; turnstileToken: string }) {
    const response = await apiClient.post<{ ok: boolean; recoveryId: string; phoneMasked: string | null; expiresAt: string }>('/api/identity/keyphrase/recovery/verify-email', input);
    return response.data;
  },
  async verifyKeyphraseRecoveryPhone(input: { recoveryId: string; code: string; turnstileToken: string }) {
    const response = await apiClient.post<{ ok: boolean; recoveryId: string }>('/api/identity/keyphrase/recovery/verify-phone', input);
    return response.data;
  },
  async completeKeyphraseRecovery(input: { recoveryId: string; newKeyphrase: string; confirmKeyphrase: string; turnstileToken: string }) {
    const response = await apiClient.post<{ ok: boolean; message: string }>('/api/identity/keyphrase/recovery/complete', input);
    return response.data;
  },
  async getKeyphraseRecoveryHistory() {
    const response = await apiClient.get<{ recoveries: KeyphraseRecoveryHistoryItem[] }>('/api/identity/keyphrase/recovery-history');
    return response.data;
  },
  async getAdminKeyphraseRecoveryHistory() {
    const response = await apiClient.get<{ recoveries: KeyphraseRecoveryHistoryItem[] }>('/api/identity/admin/keyphrase-recovery-history');
    return response.data;
  },
  async updateProfile(input: { profile: Record<string, unknown>; documents?: Record<string, unknown>[] }) {
    const response = await apiClient.put<VerificationProfile>('/api/identity/profile', input);
    return response.data;
  },
  async startProfileContactChange(input: { field: 'email' | 'phone'; value: string }) {
    const response = await apiClient.post<{
      challengeId: string;
      field: 'email' | 'phone';
      target: string;
      expiresAt: string;
      resendAvailableAt: string;
      maxAttempts: number;
      devCode?: string;
    }>('/api/identity/profile/contact-change/start', input);
    return response.data;
  },
  async verifyProfileContactChange(input: { challengeId: string; code: string }) {
    const response = await apiClient.post<{ user: SessionUser; verification: VerificationProfile }>('/api/identity/profile/contact-change/verify', input);
    return response.data;
  },
  async uploadProfileImage(file: File, imageRole?: string) {
    const formData = new FormData();
    if (imageRole) formData.append('imageRole', imageRole);
    formData.append('file', file);
    const response = await apiClient.post<ProfileImageMutationResult>('/api/identity/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  async getProfileImageBlob() {
    const response = await apiClient.get<Blob>('/api/identity/profile/image/content', { responseType: 'blob' });
    return response.data;
  },
  async deleteProfileImage() {
    const response = await apiClient.delete<ProfileImageMutationResult>('/api/identity/profile/image');
    return response.data;
  }
};
