import { Router } from 'express';
import { createAuthRateLimit } from '../../security/rateLimit.js';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();
  const publicAuthLimit = createAuthRateLimit('public-auth');

  router.get('/', controller.status);

  router.post('/registration/start', publicAuthLimit, controller.startRegistration);
  router.post('/registration/resend-otp', publicAuthLimit, controller.resendOtp);
  router.post('/registration/verify-otp', controller.verifyOtp);
  router.post('/registration/resend-activation', publicAuthLimit, controller.resendActivation);
  router.post('/registration/activate-email', controller.activateEmail);
  router.post('/registration/set-password', controller.setPassword);

  router.post('/auth/sign-in', publicAuthLimit, controller.signIn);
  router.post('/auth/forgot-password', publicAuthLimit, controller.forgotPassword);
  router.post('/auth/resend-reset-code', publicAuthLimit, controller.resendResetCode);
  router.post('/auth/reset-password', publicAuthLimit, controller.resetPassword);
  router.get('/session', controller.getSession);
  router.get('/access/me', controller.accessMe);
  router.get('/preferences', controller.getPreferences);
  router.patch('/preferences', controller.updatePreferences);
  router.post('/activity', controller.recordAccountActivity);
  router.post('/auth/sign-out', controller.signOut);

  router.get('/verification/me', controller.getVerificationMe);
  router.post('/verification/registry-lookup', controller.registryLookup);
  router.put('/verification/draft', controller.saveVerificationDraft);
  router.post('/verification/submit', controller.submitVerification);
  router.get('/signature/status', controller.getSignatureStatus);
  router.post('/signature/request', controller.requestSignature);
  router.post('/signature/test', controller.testSignature);
  router.post('/signature/revoke', controller.revokeSignature);
  router.put('/profile', controller.updateProfile);

  router.get('/admin/verifications', controller.listAdminVerifications);
  router.post('/admin/verifications/:id/decision', controller.decideAdminVerification);
  router.post('/admin/verifications/:id/rescreen', controller.rescreenAdminVerification);

  return router;
}
