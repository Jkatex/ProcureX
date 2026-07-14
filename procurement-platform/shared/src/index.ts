export const accountTypes = ['USER', 'ADMIN'] as const;
export const organizationCapabilities = ['BUYER', 'SUPPLIER'] as const;
export const trustTiers = ['UNVERIFIED', 'VERIFIED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
export const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const screeningStatuses = ['NOT_RUN', 'CLEAR', 'REVIEW', 'BLOCKED'] as const;
export const permissionNames = [
  'identity.verify',
  'identity.review',
  'procurement.create',
  'procurement.publish',
  'bidding.submit',
  'evaluation.manage',
  'award.manage',
  'award.respond',
  'contract.manage',
  'contract.sign',
  'contract.track',
  'admin.access',
  'compliance.review'
] as const;

export type AccountType = (typeof accountTypes)[number];
export type OrganizationCapability = (typeof organizationCapabilities)[number];
export type TrustTier = (typeof trustTiers)[number];
export type RiskLevel = (typeof riskLevels)[number];
export type ScreeningStatus = (typeof screeningStatuses)[number];
export type PermissionName = (typeof permissionNames)[number];

export type FeatureGateName =
  | 'identityVerification'
  | 'adminReview'
  | 'tenderCreation'
  | 'tenderPublication'
  | 'bidSubmission'
  | 'evaluationManagement'
  | 'awardManagement'
  | 'awardResponse'
  | 'contractManagement'
  | 'contractSigning'
  | 'contractTracking'
  | 'complianceReview';

export type FeatureGateMap = Record<FeatureGateName, boolean>;

export * from './tanzaniaAdministrativeAreas.js';
export * from './helpCentre.js';

