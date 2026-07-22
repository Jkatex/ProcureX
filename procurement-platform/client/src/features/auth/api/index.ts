/* Wraps auth HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';
import type { SessionUser } from '@/shared/types/domain';
import type { TanzaniaLocationSelection } from '@procurex/shared';

export type AuthSessionResponse = {
  token: string;
  user: SessionUser;
  expiresAt: string;
  isFirstSignIn: boolean;
};

export type MfaChallengeResponse = {
  mfaRequired: true;
  challengeId: string;
  methods: Array<'totp' | 'recovery_code'>;
  expiresAt: string;
};

export type AuthSignInResponse = AuthSessionResponse | MfaChallengeResponse;

export type SessionResponse = {
  user: SessionUser;
  expiresAt: string;
};

export type ForgotPasswordResponse = {
  ok: boolean;
  message: string;
  accountFound: boolean;
  challengeId?: string;
  expiresAt?: string;
  resendAvailableAt?: string;
};

export type VerifyResetCodeResponse = {
  ok: true;
  challengeId: string;
  expiresAt: string;
};

export const authApi = {
  async startRegistration(input: { email: string; phone: string; turnstileToken: string; location?: TanzaniaLocationSelection }) {
    const response = await apiClient.post<{
      user: SessionUser;
      challengeId: string;
      expiresAt: string;
      resendAvailableAt?: string;
      maxAttempts?: number;
      devCode?: string;
    }>('/api/identity/registration/start', input);
    return response.data;
  },
  async verifyOtp(input: { challengeId: string; code: string }) {
    const response = await apiClient.post<{
      activationChallengeId: string;
      expiresAt: string;
      resendAvailableAt?: string;
      devCode?: string;
    }>('/api/identity/registration/verify-otp', input);
    return response.data;
  },
  async resendOtp(input: { challengeId: string; turnstileToken: string }) {
    const response = await apiClient.post<{
      challengeId: string;
      expiresAt: string;
      resendAvailableAt?: string;
      maxAttempts?: number;
      devCode?: string;
    }>('/api/identity/registration/resend-otp', input);
    return response.data;
  },
  async activateEmail(input: { challengeId: string; code: string }) {
    const response = await apiClient.post<{ user: SessionUser }>('/api/identity/registration/activate-email', input);
    return response.data;
  },
  async resendActivation(input: { challengeId: string; turnstileToken: string }) {
    const response = await apiClient.post<{
      activationChallengeId: string;
      expiresAt: string;
      resendAvailableAt?: string;
      devCode?: string;
    }>('/api/identity/registration/resend-activation', input);
    return response.data;
  },
  async setPassword(input: {
    email: string;
    password: string;
    termsAccepted: true;
    privacyAccepted: true;
    termsVersionId?: string;
    privacyVersionId?: string;
  }) {
    const response = await apiClient.post<{ user: SessionUser }>('/api/identity/registration/set-password', input);
    return response.data;
  },
  async signIn(input: { email: string; password: string; turnstileToken: string }) {
    const response = await apiClient.post<AuthSignInResponse>('/api/identity/auth/sign-in', input);
    return response.data;
  },
  async verifyMfa(input: { challengeId: string; code: string }) {
    const response = await apiClient.post<AuthSessionResponse>('/api/identity/auth/mfa/verify', input);
    return response.data;
  },
  async forgotPassword(input: { email: string; turnstileToken: string }) {
    const response = await apiClient.post<ForgotPasswordResponse>('/api/identity/auth/forgot-password', input);
    return response.data;
  },
  async resendResetCode(input: { challengeId: string; turnstileToken: string }) {
    const response = await apiClient.post<ForgotPasswordResponse>('/api/identity/auth/resend-reset-code', input);
    return response.data;
  },
  async verifyResetCode(input: { challengeId: string; code: string; turnstileToken: string }) {
    const response = await apiClient.post<VerifyResetCodeResponse>('/api/identity/auth/verify-reset-code', input);
    return response.data;
  },
  async resetPassword(input: { challengeId: string; code: string; password: string; turnstileToken: string }) {
    const response = await apiClient.post<{ ok: boolean; user: SessionUser }>('/api/identity/auth/reset-password', input);
    return response.data;
  },
  async getSession() {
    const response = await apiClient.get<SessionResponse>('/api/identity/session');
    return response.data;
  },
  async getAccessMe() {
    const response = await apiClient.get<SessionUser>('/api/identity/access/me');
    return response.data;
  },
  async signOut() {
    const response = await apiClient.post<{ ok: boolean }>('/api/identity/auth/sign-out');
    return response.data;
  }
};
