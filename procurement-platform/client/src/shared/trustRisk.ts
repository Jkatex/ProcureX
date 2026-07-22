/* Supports the shared client workflow with reusable logic kept close to the screens that consume it. */
import type { RiskLevel, TrustTier, ScreeningStatus } from './types/domain';

export const editableTrustTierValues = ['UNVERIFIED', 'VERIFIED', 'BRONZE', 'SILVER', 'GOLD'] as const;
export const riskLevelValues = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export function displayTrustRiskLabel(value?: string | null) {
  if (!value) return 'Not assessed';
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function trustTierSummary(tier?: TrustTier | string | null, reasons: string[] = []) {
  if (!tier || tier === 'UNVERIFIED') return reasons[0] ?? 'Not assessed yet. Complete verification to receive a trust tier.';
  if (reasons.length) return reasons.join(' ');
  if (tier === 'VERIFIED') return 'Identity checks passed. More complete records can improve this tier.';
  if (tier === 'BRONZE') return 'Verified account with enough profile evidence for normal procurement access.';
  if (tier === 'SILVER') return 'Strong verification, clean screening, and complete organization evidence.';
  if (tier === 'GOLD') return 'Highest standard trust tier currently assigned by ProcureX verification checks.';
  return 'Trust tier assigned from verification and screening evidence.';
}

export function riskLevelSummary(level?: RiskLevel | string | null, screening?: ScreeningStatus | string | null) {
  if (screening === 'BLOCKED') return 'Screening blocked this account and the risk level is critical.';
  if (screening === 'REVIEW') return 'Screening requires review before the account can be treated as low risk.';
  if (level === 'LOW') return 'No active screening blockers are recorded.';
  if (level === 'MEDIUM') return 'Some verification evidence is still incomplete or not recently assessed.';
  if (level === 'HIGH') return 'Review is required before relying on this supplier without controls.';
  if (level === 'CRITICAL') return 'Do not proceed without compliance review.';
  return 'Risk has not been assessed yet.';
}
