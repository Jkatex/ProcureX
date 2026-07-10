import type { MarketplaceTenderRow } from './types';

type TenderDeadline = Pick<MarketplaceTenderRow, 'closingDate'>;
type TenderVisibility = Pick<MarketplaceTenderRow, 'status' | 'closingDate'>;

export function hasActiveMarketplaceDeadline(tender: TenderDeadline, now = Date.now()) {
  const closingTime = Date.parse(tender.closingDate);
  return Number.isFinite(closingTime) && closingTime > now;
}

export function isActiveMarketplaceTender(tender: TenderVisibility, now = Date.now()) {
  const status = normalizeMarketplaceStatus(tender.status);
  return (status === 'OPEN' || status === 'PUBLISHED') && hasActiveMarketplaceDeadline(tender, now);
}

function normalizeMarketplaceStatus(status: unknown) {
  return String(status ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}
