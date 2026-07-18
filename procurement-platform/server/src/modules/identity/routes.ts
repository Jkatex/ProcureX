import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAuthRateLimitOptions } from '../../security/rateLimit.js';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();
  const publicAuthLimit = rateLimit(createAuthRateLimitOptions('public-auth'));
  const sensitiveIdentityLimit = rateLimit(createAuthRateLimitOptions('sensitive-identity'));
  const profileContactLimit = rateLimit(createAuthRateLimitOptions('profile-contact-change'));

  router.get('/', controller.status);

  router.post('/registration/start', publicAuthLimit, controller.startRegistration);
  router.post('/registration/resend-otp', publicAuthLimit, controller.resendOtp);
  router.post('/registration/verify-otp', publicAuthLimit, controller.verifyOtp);
  router.post('/registration/resend-activation', publicAuthLimit, controller.resendActivation);
  router.post('/registration/activate-email', publicAuthLimit, controller.activateEmail);
  router.post('/registration/set-password', publicAuthLimit, controller.setPassword);

  router.post('/auth/sign-in', publicAuthLimit, controller.signIn);
  router.post('/auth/mfa/verify', publicAuthLimit, controller.verifyAuthMfa);
  router.post('/auth/forgot-password', publicAuthLimit, controller.forgotPassword);
  router.post('/auth/resend-reset-code', publicAuthLimit, controller.resendResetCode);
  router.post('/auth/verify-reset-code', publicAuthLimit, controller.verifyResetCode);
  router.post('/auth/reset-password', publicAuthLimit, controller.resetPassword);
  router.get('/session', controller.getSession);
  router.get('/access/me', controller.accessMe);
  router.get('/preferences', controller.getPreferences);
  router.patch('/preferences', controller.updatePreferences);
  router.post('/activity', controller.recordAccountActivity);
  router.post('/auth/sign-out', controller.signOut);
  router.get('/mfa/status', controller.mfaStatus);
  router.post('/mfa/totp/start', sensitiveIdentityLimit, controller.startTotpMfa);
  router.post('/mfa/totp/verify', sensitiveIdentityLimit, controller.verifyTotpMfa);
  router.post('/mfa/recovery-codes/regenerate', sensitiveIdentityLimit, controller.regenerateMfaRecoveryCodes);

  router.get('/verification/me', controller.getVerificationMe);
  router.post('/verification/registry-lookup', sensitiveIdentityLimit, controller.registryLookup);
  router.put('/verification/draft', controller.saveVerificationDraft);
  router.post('/verification/submit', sensitiveIdentityLimit, controller.submitVerification);
  router.get('/signature/status', controller.getSignatureStatus);
  router.post('/signature/request', sensitiveIdentityLimit, controller.requestSignature);
  router.post('/signature/test', sensitiveIdentityLimit, controller.testSignature);
  router.post('/signature/revoke', sensitiveIdentityLimit, controller.revokeSignature);
  router.get('/keyphrase/status', controller.getKeyphraseStatus);
  router.post('/keyphrase/change', sensitiveIdentityLimit, controller.changeKeyphrase);
  router.post('/keyphrase/recovery/start', publicAuthLimit, controller.startKeyphraseRecovery);
  router.post('/keyphrase/recovery/verify-email', publicAuthLimit, controller.verifyKeyphraseRecoveryEmail);
  router.post('/keyphrase/recovery/verify-phone', publicAuthLimit, controller.verifyKeyphraseRecoveryPhone);
  router.post('/keyphrase/recovery/complete', publicAuthLimit, controller.completeKeyphraseRecovery);
  router.get('/keyphrase/recovery-history', controller.keyphraseRecoveryHistory);
  router.put('/profile', controller.updateProfile);
  router.post('/profile/contact-change/start', profileContactLimit, controller.startProfileContactChange);
  router.post('/profile/contact-change/verify', profileContactLimit, controller.verifyProfileContactChange);
  router.post('/profile/image', controller.uploadProfileImage);
  router.get('/profile/image/content', controller.profileImageContent);
  router.delete('/profile/image', controller.deleteProfileImage);

  router.get('/admin/verifications', controller.listAdminVerifications);
  router.post('/admin/verifications/:id/decision', controller.decideAdminVerification);
  router.post('/admin/verifications/:id/rescreen', controller.rescreenAdminVerification);
  router.get('/admin/keyphrase-recovery-history', controller.adminKeyphraseRecoveryHistory);

  return router;
}
