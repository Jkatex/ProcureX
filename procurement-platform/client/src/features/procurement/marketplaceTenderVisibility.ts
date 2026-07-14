import type { MarketplaceTenderRow } from './types';

type TenderDeadline = Pick<MarketplaceTenderRow, 'closingDate'>;
type TenderOpening = Partial<Pick<MarketplaceTenderRow, 'openingDate'>>;
type TenderVisibility = Pick<MarketplaceTenderRow, 'status' | 'closingDate' | 'visibility'> & TenderOpening;

export function hasActiveMarketplaceDeadline(tender: TenderDeadline, now = Date.now()) {
  const closingTime = parseMarketplaceDate(tender.closingDate, 'end');
  return Number.isFinite(closingTime) && closingTime > now;
}

export function hasReachedOpeningDate(tender: TenderOpening, now = Date.now()) {
  const openingTime = parseMarketplaceDate(tender.openingDate, 'start');
  return !Number.isFinite(openingTime) || openingTime <= now;
}

export function isUpcomingMarketplaceTender(tender: TenderVisibility, now = Date.now()) {
  return isVisibleActiveTender(tender, now) && !hasReachedOpeningDate(tender, now);
}

export function isTenderOpenForBidding(tender: TenderVisibility, now = Date.now()) {
  return isVisibleActiveTender(tender, now) && hasReachedOpeningDate(tender, now);
}

export function isActiveMarketplaceTender(tender: TenderVisibility, now = Date.now()) {
  const status = normalizeMarketplaceStatus(tender.status);
  return isPublicMarketplaceVisibility(tender.visibility) && (status === 'OPEN' || status === 'PUBLISHED') && hasActiveMarketplaceDeadline(tender, now);
}

export function isActiveInvitedTender(tender: TenderVisibility, now = Date.now()) {
  const status = normalizeMarketplaceStatus(tender.status);
  return normalizeMarketplaceStatus(tender.visibility) === 'INVITED' && (status === 'OPEN' || status === 'PUBLISHED') && hasActiveMarketplaceDeadline(tender, now);
}

function normalizeMarketplaceStatus(status: unknown) {
  return String(status ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function isPublicMarketplaceVisibility(visibility: unknown) {
  return normalizeMarketplaceStatus(visibility) === 'PUBLIC_MARKETPLACE';
}

function isVisibleActiveTender(tender: TenderVisibility, now: number) {
  const status = normalizeMarketplaceStatus(tender.status);
  const visibility = normalizeMarketplaceStatus(tender.visibility);
  return (visibility === 'PUBLIC_MARKETPLACE' || visibility === 'INVITED') && (status === 'OPEN' || status === 'PUBLISHED') && hasActiveMarketplaceDeadline(tender, now);
}

function parseMarketplaceDate(value: unknown, boundary: 'start' | 'end') {
  if (typeof value !== 'string' || !value.trim()) return Number.NaN;
  const normalized = value.trim();
  const withBoundary = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? `${normalized}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`
    : normalized;
  return Date.parse(withBoundary);
}
