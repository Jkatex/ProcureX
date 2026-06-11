import {
  type AccountType,
  type FeatureGateMap,
  type OrganizationCapability,
  type PermissionName,
  type RiskLevel,
  type ScreeningStatus,
  type TrustTier,
  permissionNames
} from '@procurex/shared';

export type AccessSubject = {
  accountType: AccountType;
  verificationStatus: 'NOT_STARTED' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  capabilities: string[];
  trustTier?: TrustTier | null;
  riskLevel?: RiskLevel | null;
  screeningStatus?: ScreeningStatus | null;
};

export type AccessContext = {
  permissions: PermissionName[];
  featureGates: FeatureGateMap;
  trustTier: TrustTier;
  riskLevel: RiskLevel;
  screeningStatus: ScreeningStatus;
};

const trustTierRank: Record<TrustTier, number> = {
  UNVERIFIED: 0,
  VERIFIED: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5
};

// Temporary development switch: false means signed-in users can use core procurement while trust gates are being iterated.
const TEMP_PROCUREMENT_CORE_GATES_ENABLED = false;
const coreProcurementPermissions: PermissionName[] = ['procurement.create', 'procurement.publish', 'bidding.submit', 'evaluation.manage'];

function hasCapability(subject: AccessSubject, capability: OrganizationCapability) {
  return subject.capabilities.includes(capability);
}

function hasTrustAtLeast(actual: TrustTier, minimum: TrustTier) {
  return trustTierRank[actual] >= trustTierRank[minimum];
}

export function computeAccessContext(subject: AccessSubject): AccessContext {
  const trustTier = subject.trustTier ?? (subject.verificationStatus === 'APPROVED' ? 'VERIFIED' : 'UNVERIFIED');
  const riskLevel = subject.riskLevel ?? 'MEDIUM';
  const screeningStatus = subject.screeningStatus ?? 'NOT_RUN';
  const isAdmin = subject.accountType === 'ADMIN';
  const isVerified = subject.verificationStatus === 'APPROVED';
  const isBlocked = screeningStatus === 'BLOCKED' || riskLevel === 'CRITICAL';
  const canOperate = isAdmin || (isVerified && !isBlocked && hasTrustAtLeast(trustTier, 'BRONZE'));

  const permissions = new Set<PermissionName>();
  permissions.add('identity.verify');

  if (isAdmin) {
    for (const permission of permissionNames) permissions.add(permission);
  } else if (!TEMP_PROCUREMENT_CORE_GATES_ENABLED) {
    for (const permission of coreProcurementPermissions) permissions.add(permission);
  } else {
    if (canOperate && hasCapability(subject, 'BUYER')) {
      permissions.add('procurement.create');
      permissions.add('procurement.publish');
    }
    if (canOperate && hasCapability(subject, 'SUPPLIER')) {
      permissions.add('bidding.submit');
    }
    if (canOperate && hasCapability(subject, 'BUYER')) {
      permissions.add('evaluation.manage');
    }
  }

  return {
    permissions: [...permissions],
    trustTier,
    riskLevel,
    screeningStatus,
    featureGates: {
      identityVerification: !isVerified,
      adminReview: isAdmin,
      tenderCreation: permissions.has('procurement.create'),
      tenderPublication: permissions.has('procurement.publish'),
      bidSubmission: permissions.has('bidding.submit'),
      evaluationManagement: permissions.has('evaluation.manage'),
      complianceReview: permissions.has('compliance.review')
    }
  };
}

export function assertPermission(subject: AccessSubject, permission: PermissionName) {
  const access = computeAccessContext(subject);
  if (!access.permissions.includes(permission)) {
    const error = new Error(`Permission ${permission} is required.`) as Error & { status?: number };
    error.status = 403;
    throw error;
  }
  return access;
}
