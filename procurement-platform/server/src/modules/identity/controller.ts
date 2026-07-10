import { AuditSeverity, VerificationStatus } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { verifyTurnstileToken } from '../../security/turnstile.js';
import { ModuleService } from './service.js';
import {
  activateEmailSchema,
  accountActivitySchema,
  adminDecisionSchema,
  adminVerificationListQuerySchema,
  moduleStatusQuerySchema,
  preferencesPatchSchema,
  profileUpdateSchema,
  registryLookupSchema,
  forgotPasswordSchema,
  resendChallengeSchema,
  resetPasswordSchema,
  setPasswordSchema,
  signInSchema,
  signatureKeyphraseOnlySchema,
  signatureRequestSchema,
  startRegistrationSchema,
  verificationDraftSchema,
  verificationSubmitSchema,
  verifyOtpSchema,
  verifyResetCodeSchema
} from './validators.js';

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

function requestError(message: string, status = 403) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService()) {}

  private auditContext(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.header('user-agent') ?? undefined
    };
  }

  private async recordTurnstileRejection(req: Request, target: string | undefined, details: Record<string, unknown>, severity: AuditSeverity = AuditSeverity.WARNING) {
    if (!process.env.DATABASE_URL) return;
    try {
      await this.service.recordAuthEvent('identity.auth.turnstile_rejected', {
        ...this.auditContext(req),
        target,
        severity,
        details: {
          path: req.path,
          method: req.method,
          ...details
        }
      });
    } catch {
      // The request should still receive the security failure even if audit storage is unavailable.
    }
  }

  private async recordUnauthorizedMenuAccess(req: Request, error: unknown, event: string) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 500;
    if (status !== 401 && status !== 403) return;
    if (!process.env.DATABASE_URL) return;
    try {
      await this.service.recordAuthEvent(event, {
        ...this.auditContext(req),
        severity: AuditSeverity.WARNING,
        details: {
          path: req.path,
          method: req.method,
          status
        }
      });
    } catch {
      // Preserve the original auth failure even if audit storage is unavailable.
    }
  }

  private async requireTurnstile(req: Request, token: string, target?: string) {
    let result: Awaited<ReturnType<typeof verifyTurnstileToken>>;
    try {
      result = await verifyTurnstileToken({ token, remoteIp: req.ip });
    } catch (error) {
      await this.recordTurnstileRejection(req, target, { providerError: error instanceof Error ? error.message : 'Security check failed.' }, AuditSeverity.ERROR);
      throw error;
    }

    if (!result.success) {
      await this.recordTurnstileRejection(req, target, { errorCodes: result.errorCodes });
      throw requestError('Security check failed. Please refresh the page and try again.', 403);
    }
  }

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  startRegistration: RequestHandler = async (req, res, next) => {
    try {
      const input = startRegistrationSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken, input.email);
      res.status(201).json(await this.service.startRegistration(input, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  verifyOtp: RequestHandler = async (req, res, next) => {
    try {
      const input = verifyOtpSchema.parse(req.body);
      res.json(await this.service.verifyOtp(input.challengeId, input.code, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  resendOtp: RequestHandler = async (req, res, next) => {
    try {
      const input = resendChallengeSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken);
      res.json(await this.service.resendOtp(input.challengeId, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  resendActivation: RequestHandler = async (req, res, next) => {
    try {
      const input = resendChallengeSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken);
      res.json(await this.service.resendActivation(input.challengeId, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  activateEmail: RequestHandler = async (req, res, next) => {
    try {
      const input = activateEmailSchema.parse(req.body);
      res.json(await this.service.activateEmail(input.challengeId, input.code, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  setPassword: RequestHandler = async (req, res, next) => {
    try {
      const input = setPasswordSchema.parse(req.body);
      res.json(
        await this.service.setPassword(input.email, input.password, {
          termsAccepted: input.termsAccepted,
          privacyAccepted: input.privacyAccepted,
          termsVersionId: input.termsVersionId,
          privacyVersionId: input.privacyVersionId,
          source: 'registration',
          ipAddress: req.ip,
          userAgent: req.header('user-agent') ?? undefined
          },
          this.auditContext(req)
        )
      );
    } catch (error) {
      next(error);
    }
  };

  signIn: RequestHandler = async (req, res, next) => {
    try {
      const input = signInSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken, input.email);
      res.json(await this.service.signIn(input.email, input.password, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  forgotPassword: RequestHandler = async (req, res, next) => {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken, input.email);
      res.json(await this.service.forgotPassword(input.email, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  resendResetCode: RequestHandler = async (req, res, next) => {
    try {
      const input = resendChallengeSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken);
      res.json(await this.service.resendResetCode(input.challengeId, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  verifyResetCode: RequestHandler = async (req, res, next) => {
    try {
      const input = verifyResetCodeSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken);
      res.json(await this.service.verifyResetCode(input.challengeId, input.code, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  resetPassword: RequestHandler = async (req, res, next) => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      await this.requireTurnstile(req, input.turnstileToken);
      res.json(await this.service.resetPassword(input.challengeId, input.code, input.password, this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  getSession: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.sessionFromToken(bearerToken(req) ?? ''));
    } catch (error) {
      next(error);
    }
  };

  accessMe: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.accessMe(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  getPreferences: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.preferences(bearerToken(req)));
    } catch (error) {
      await this.recordUnauthorizedMenuAccess(req, error, 'identity.preferences.access_denied');
      next(error);
    }
  };

  updatePreferences: RequestHandler = async (req, res, next) => {
    try {
      const input = preferencesPatchSchema.parse(req.body);
      res.json(await this.service.updatePreferences(bearerToken(req), input, this.auditContext(req)));
    } catch (error) {
      await this.recordUnauthorizedMenuAccess(req, error, 'identity.preferences.access_denied');
      next(error);
    }
  };

  recordAccountActivity: RequestHandler = async (req, res, next) => {
    try {
      const input = accountActivitySchema.parse(req.body);
      res.status(202).json(await this.service.recordAccountActivity(bearerToken(req), input.event, this.auditContext(req)));
    } catch (error) {
      await this.recordUnauthorizedMenuAccess(req, error, 'identity.account_menu.access_denied');
      next(error);
    }
  };

  signOut: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.signOut(bearerToken(req) ?? '', this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  registryLookup: RequestHandler = async (req, res, next) => {
    try {
      await this.service.requireSession(bearerToken(req));
      res.json(await this.service.registryLookup(registryLookupSchema.parse(req.body), this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  getVerificationMe: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.getVerificationMe(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  saveVerificationDraft: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.saveVerificationDraft(bearerToken(req), verificationDraftSchema.parse(req.body), this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  submitVerification: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.submitVerification(bearerToken(req), verificationSubmitSchema.parse(req.body), this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  getSignatureStatus: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.getSignatureStatus(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  requestSignature: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.requestSignature(bearerToken(req), signatureRequestSchema.parse(req.body), this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  testSignature: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.testSignature(bearerToken(req), signatureKeyphraseOnlySchema.parse(req.body), this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  revokeSignature: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.revokeSignature(bearerToken(req), this.auditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  updateProfile: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.updateProfile(bearerToken(req), profileUpdateSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  listAdminVerifications: RequestHandler = async (req, res, next) => {
    try {
      const query = adminVerificationListQuerySchema.parse(req.query);
      res.json(await this.service.listAdminVerifications(bearerToken(req), query.status as VerificationStatus | undefined));
    } catch (error) {
      next(error);
    }
  };

  decideAdminVerification: RequestHandler = async (req, res, next) => {
    try {
      const input = adminDecisionSchema.parse(req.body);
      res.json(await this.service.decideAdminVerification(bearerToken(req), req.params.id, input.decision, input.note));
    } catch (error) {
      next(error);
    }
  };

  rescreenAdminVerification: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.rescreenAdminVerification(bearerToken(req), req.params.id));
    } catch (error) {
      next(error);
    }
  };
}
