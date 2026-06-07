import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

const passwordSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character.');

const turnstileTokenSchema = z.string().min(1).max(4096);

export const startRegistrationSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(32),
  turnstileToken: turnstileTokenSchema
});

export const verifyOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/)
});

export const resendChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  turnstileToken: turnstileTokenSchema
});

export const activateEmailSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(8).max(24)
});

export const setPasswordSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  termsVersionId: z.string().uuid().optional(),
  privacyVersionId: z.string().uuid().optional()
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: turnstileTokenSchema
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  turnstileToken: turnstileTokenSchema
});

export const resetPasswordSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(6).max(24),
  password: passwordSchema,
  turnstileToken: turnstileTokenSchema
});

export const registryLookupSchema = z.object({
  entityType: z.enum(['individual', 'company', 'business']),
  businessRegistrationSource: z.enum(['tin', 'brela']).optional(),
  registryNumber: z.string().min(3).max(64)
});

export const verificationDraftSchema = z.object({
  entityType: z.enum(['individual', 'company', 'business']).optional(),
  businessRegistrationSource: z.enum(['tin', 'brela']).optional(),
  registrySource: z.string().optional(),
  registryNumber: z.string().optional(),
  registryVerified: z.boolean().optional(),
  registryRecordId: z.string().uuid().optional(),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  signatureConsent: z.boolean().optional(),
  signatureConsentVersion: z.string().max(64).optional(),
  signatureConsentTitle: z.string().max(200).optional(),
  profile: z.record(z.unknown()).optional(),
  documents: z.array(z.record(z.unknown())).optional()
});

export const verificationSubmitSchema = verificationDraftSchema.extend({
  entityType: z.enum(['individual', 'company', 'business']),
  registrySource: z.string().min(2),
  registryNumber: z.string().min(3),
  registryVerified: z.literal(true),
  registryRecordId: z.string().uuid(),
  signatureName: z.string().min(2),
  signatureConsent: z.literal(true)
});

export const profileUpdateSchema = z.object({
  profile: z.record(z.unknown()).default({}),
  documents: z.array(z.record(z.unknown())).optional()
});

export const adminVerificationListQuerySchema = z.object({
  status: z.enum(['NOT_STARTED', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']).optional()
});

export const adminDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional()
});
