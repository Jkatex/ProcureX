/* Encapsulates intelligence persistence queries so service logic does not depend on raw Prisma access patterns. */
import { BidStatus, OrganizationCapabilityName, TenderStatus, Visibility, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { standardizeCategoryName } from '../procurement/category-taxonomy.js';
import type {
  AnalyticsBreakdownRow,
  AnalyticsBudgetBand,
  MarketplaceAnalyticsDto,
  MarketplaceAnalyticsResponseDto,
  RecommendedTenderRow,
  RecommendedTendersResponseDto,
  SupplierRecommendationRow,
  SupplierRecommendationsResponseDto
} from './types.js';
import { requestError } from '../shared/apiErrors.js';

const scoringVersion = 'supplier-recommendations-v1';
const maxRecommendations = 20;

const recommendedTenderInclude = {
  buyerOrg: { select: { id: true, name: true } },
  categories: { select: { name: true }, orderBy: { name: 'asc' } }
} satisfies Prisma.TenderInclude;

const supplierContextInclude = {
  supplierProfile: true,
  profile: true,
  capabilities: {
    where: { enabled: true },
    select: { capability: true }
  }
} satisfies Prisma.OrganizationInclude;

const supplierRecommendationInclude = {
  supplierProfile: true,
  profile: true,
  capabilities: {
    where: { enabled: true },
    select: { capability: true }
  }
} satisfies Prisma.OrganizationInclude;

const supplierRecommendationTenderInclude = {
  categories: { select: { name: true }, orderBy: { name: 'asc' } }
} satisfies Prisma.TenderInclude;

const marketplaceAnalyticsTenderSelect = {
  id: true,
  type: true,
  status: true,
  budget: true,
  location: true,
  publishedAt: true,
  createdAt: true,
  closingDate: true,
  buyerOrg: { select: { name: true } },
  categories: { select: { name: true }, orderBy: { name: 'asc' } },
  _count: {
    select: {
      bids: {
        where: {
          status: { not: BidStatus.WITHDRAWN }
        }
      }
    }
  }
} satisfies Prisma.TenderSelect;

type RecommendedTenderRecord = Prisma.TenderGetPayload<{ include: typeof recommendedTenderInclude }>;
type MarketplaceAnalyticsTenderRecord = Prisma.TenderGetPayload<{ select: typeof marketplaceAnalyticsTenderSelect }>;
type SupplierContextRecord = Prisma.OrganizationGetPayload<{ include: typeof supplierContextInclude }>;
type SupplierRecommendationTenderRecord = Prisma.TenderGetPayload<{ include: typeof supplierRecommendationTenderInclude }>;
type SupplierCandidateRecord = Prisma.OrganizationGetPayload<{ include: typeof supplierRecommendationInclude }>;
type SupplierBidHistoryRecord = Prisma.BidGetPayload<{
  select: {
    tender: {
      select: {
        type: true;
        categories: { select: { name: true } };
      };
    };
  };
}>;
type BuyerSupplierBidHistoryRecord = Prisma.BidGetPayload<{
  select: {
    supplierOrgId: true;
    tender: {
      select: {
        type: true;
        location: true;
        budget: true;
        categories: { select: { name: true } };
      };
    };
  };
}>;

type SupplierSignals = {
  categoryTokens: Set<string>;
  typeTokens: Set<string>;
  locationTokens: Set<string>;
  bidLimit: number | null;
  historyCategoryTokens: Set<string>;
  historyTypeTokens: Set<string>;
};

type ScoredTender = {
  tender: RecommendedTenderRecord;
  row: RecommendedTenderRow;
};

type TenderSignals = {
  categoryTokens: Set<string>;
  typeToken: string;
  locationToken: string;
  budget: number;
};

type SupplierCandidateSignals = {
  categoryTokens: Set<string>;
  typeTokens: Set<string>;
  locationTokens: Set<string>;
  bidLimit: number | null;
  categories: string[];
  locations: string[];
  capabilitySummary: string;
};

type ScoredSupplier = {
  supplier: SupplierCandidateRecord;
  row: SupplierRecommendationRow;
};

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async marketplaceAnalytics(): Promise<MarketplaceAnalyticsResponseDto> {
    const tenders = await this.db.tender.findMany({
      where: {
        visibility: Visibility.PUBLIC_MARKETPLACE,
        status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] }
      },
      select: marketplaceAnalyticsTenderSelect,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5000
    });

    return {
      success: true,
      data: marketplaceAnalytics(tenders)
    };
  }

  async recommendedTenders(context: { organizationId: string; userId: string }): Promise<RecommendedTendersResponseDto> {
    const now = new Date();
    const [organization, bidHistory, tenders, savedTenderRecords] = await Promise.all([
      this.db.organization.findUnique({
        where: { id: context.organizationId },
        include: supplierContextInclude
      }),
      this.db.bid.findMany({
        where: {
          supplierOrgId: context.organizationId,
          status: { notIn: [BidStatus.DRAFT, BidStatus.WITHDRAWN] }
        },
        select: {
          tender: {
            select: {
              type: true,
              categories: { select: { name: true } }
            }
          }
        },
        take: 500
      }),
      this.db.tender.findMany({
        where: {
          buyerOrgId: { not: context.organizationId },
          visibility: Visibility.PUBLIC_MARKETPLACE,
          status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] },
          closingDate: { gt: now }
        },
        include: recommendedTenderInclude,
        orderBy: [{ closingDate: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 1000
      }),
      this.db.savedTender.findMany({
        where: { organizationId: context.organizationId },
        select: { tenderId: true }
      })
    ]);

    const supplierSignals = supplierSignalsFrom(organization, bidHistory);
    const savedTenderIds = new Set(savedTenderRecords.map((record) => record.tenderId));
    const scoredRows = tenders
      .map((tender) => scoreTender(tender, context.organizationId, supplierSignals, savedTenderIds))
      .filter((scored) => scored.row.matchScore > 0)
      .sort(compareScoredTenders)
      .slice(0, maxRecommendations);

    await this.refreshMatchSignals(context.organizationId, scoredRows);

    return {
      success: true,
      data: scoredRows.map((scored) => scored.row)
    };
  }

  async supplierRecommendations(tenderId: string, context: { organizationId: string; userId: string }): Promise<SupplierRecommendationsResponseDto | null> {
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      include: supplierRecommendationTenderInclude
    });
    if (!tender) return null;
    if (tender.buyerOrgId !== context.organizationId) throw requestError('Only the tender owner organization can view supplier recommendations.', 403);

    const suppliers = await this.db.organization.findMany({
      where: {
        id: { not: context.organizationId },
        capabilities: {
          some: {
            capability: OrganizationCapabilityName.SUPPLIER,
            enabled: true
          }
        }
      },
      include: supplierRecommendationInclude,
      orderBy: { name: 'asc' },
      take: 1000
    });
    const supplierIds = suppliers.map((supplier) => supplier.id);
    const bidHistory =
      supplierIds.length > 0
        ? await this.db.bid.findMany({
            where: {
              supplierOrgId: { in: supplierIds },
              status: { notIn: [BidStatus.DRAFT, BidStatus.WITHDRAWN] }
            },
            select: {
              supplierOrgId: true,
              tender: {
                select: {
                  type: true,
                  location: true,
                  budget: true,
                  categories: { select: { name: true } }
                }
              }
            },
            take: 1000
          })
        : [];

    const historyBySupplier = groupSupplierHistory(bidHistory);
    const target = tenderSignalsFrom(tender);
    const scoredRows = suppliers
      .map((supplier) => scoreSupplier(supplier, target, historyBySupplier.get(supplier.id) ?? []))
      .filter((scored) => scored.row.matchScore > 0)
      .sort(compareScoredSuppliers)
      .slice(0, maxRecommendations);

    await this.refreshBuyerSupplierSignals(tender, scoredRows);

    return {
      success: true,
      data: scoredRows.map((scored) => scored.row)
    };
  }

  private async refreshMatchSignals(supplierOrgId: string, recommendations: ScoredTender[]) {
    await this.db.$transaction(async (tx) => {
      await tx.supplierMatchSignal.deleteMany({
        where: {
          supplierOrgId,
          tenderId: { not: null },
          AND: [
            { payload: { path: ['scoringVersion'], equals: scoringVersion } },
            { NOT: { payload: { path: ['direction'], equals: 'buyer_supplier_recommendation' } } }
          ]
        }
      });
      if (recommendations.length === 0) return;

      await tx.supplierMatchSignal.createMany({
        data: recommendations.map((recommendation) => ({
          tenderId: recommendation.tender.id,
          supplierOrgId,
          score: recommendation.row.matchScore,
          payload: {
            scoringVersion,
            reasons: recommendation.row.matchReasons,
            tenderReference: recommendation.tender.reference
          } as Prisma.InputJsonObject
        }))
      });
    });
  }

  private async refreshBuyerSupplierSignals(tender: SupplierRecommendationTenderRecord, recommendations: ScoredSupplier[]) {
    if (recommendations.length === 0) return;
    const supplierOrgIds = recommendations.map((recommendation) => recommendation.supplier.id);

    await this.db.$transaction(async (tx) => {
      await tx.supplierMatchSignal.deleteMany({
        where: {
          tenderId: tender.id,
          supplierOrgId: { in: supplierOrgIds }
        }
      });
      await tx.supplierMatchSignal.createMany({
        data: recommendations.map((recommendation) => ({
          tenderId: tender.id,
          supplierOrgId: recommendation.supplier.id,
          score: recommendation.row.matchScore,
          payload: {
            scoringVersion,
            direction: 'buyer_supplier_recommendation',
            reasons: recommendation.row.matchReasons,
            tenderReference: tender.reference
          } as Prisma.InputJsonObject
        }))
      });
    });
  }
}

function marketplaceAnalytics(tenders: MarketplaceAnalyticsTenderRecord[]): MarketplaceAnalyticsDto {
  const totalBudgetValue = tenders.reduce((sum, tender) => sum + decimalToNumber(tender.budget), 0);
  const totalBidCount = tenders.reduce((sum, tender) => sum + tender._count.bids, 0);

  return {
    openTenders: tenders.filter((tender) => tender.status === TenderStatus.OPEN).length,
    publishedTenders: tenders.filter((tender) => tender.status === TenderStatus.PUBLISHED).length,
    closingSoon: closingSoonTenderCount(tenders),
    totalBudgetValue,
    averageTenderValue: tenders.length > 0 ? Math.round(totalBudgetValue / tenders.length) : 0,
    tendersByType: groupTenderAnalytics(tenders, (tender) => frontendTenderType(tender.type)),
    tendersByCategory: groupTenderAnalytics(tenders, (tender) => analyticsCategory(tender)),
    tendersByLocation: groupTenderAnalytics(tenders, (tender) => tender.location || 'Tanzania'),
    tendersByMonth: groupTenderAnalytics(tenders, (tender) => analyticsMonth(tender)),
    budgetBands: analyticsBudgetBands(tenders),
    topBuyerOrganizations: groupTenderAnalytics(tenders, (tender) => tender.buyerOrg.name).slice(0, 10),
    competitionSignals: {
      averageBidsPerTender: tenders.length > 0 ? Math.round((totalBidCount / tenders.length) * 100) / 100 : 0,
      tendersWithNoBids: tenders.filter((tender) => tender._count.bids === 0).length,
      highCompetitionTenders: tenders.filter((tender) => tender._count.bids >= 5).length
    }
  };
}

function groupTenderAnalytics(tenders: MarketplaceAnalyticsTenderRecord[], getLabel: (tender: MarketplaceAnalyticsTenderRecord) => string): AnalyticsBreakdownRow[] {
  const groups = new Map<string, AnalyticsBreakdownRow>();
  for (const tender of tenders) {
    const label = getLabel(tender) || 'Unspecified';
    const current = groups.get(label) ?? { label, value: 0, amount: 0 };
    current.value += 1;
    current.amount += decimalToNumber(tender.budget);
    groups.set(label, current);
  }
  return Array.from(groups.values()).sort((left, right) => right.value - left.value || right.amount - left.amount || left.label.localeCompare(right.label));
}

function analyticsBudgetBands(tenders: MarketplaceAnalyticsTenderRecord[]): MarketplaceAnalyticsDto['budgetBands'] {
  const bands: MarketplaceAnalyticsDto['budgetBands'] = {
    underHundredMillion: emptyBudgetBand(),
    hundredMillionToOneBillion: emptyBudgetBand(),
    billionPlus: emptyBudgetBand()
  };

  for (const tender of tenders) {
    const budget = decimalToNumber(tender.budget);
    const band = budget < 100000000 ? bands.underHundredMillion : budget < 1000000000 ? bands.hundredMillionToOneBillion : bands.billionPlus;
    band.value += 1;
    band.amount += budget;
  }

  return bands;
}

function emptyBudgetBand(): AnalyticsBudgetBand {
  return { value: 0, amount: 0 };
}

function closingSoonTenderCount(tenders: MarketplaceAnalyticsTenderRecord[]) {
  const now = Date.now();
  const closingSoonThreshold = now + 7 * 24 * 60 * 60 * 1000;
  return tenders.filter((tender) => {
    const closingTime = tender.closingDate?.getTime();
    return Boolean(closingTime && closingTime >= now && closingTime <= closingSoonThreshold);
  }).length;
}

function analyticsCategory(tender: MarketplaceAnalyticsTenderRecord) {
  const categoryNames = uniqueDisplayStrings(tender.categories.map((category) => standardizeCategoryName(category.name, tender.type)).filter(Boolean));
  if (categoryNames.length > 0) return categoryNames.join(' / ');
  return frontendTenderType(tender.type);
}

function analyticsMonth(tender: MarketplaceAnalyticsTenderRecord) {
  return (tender.publishedAt ?? tender.createdAt).toISOString().slice(0, 7);
}

function scoreTender(tender: RecommendedTenderRecord, organizationId: string, signals: SupplierSignals, savedTenderIds: Set<string> = new Set()): ScoredTender {
  const reasons: string[] = [];
  let score = 0;
  const categoryTokens = new Set(tender.categories.map((category) => normalizeToken(standardizeCategoryName(category.name, tender.type))).filter(Boolean));
  const typeToken = normalizeToken(frontendTenderType(tender.type));
  const budget = decimalToNumber(tender.budget);

  if (intersects(categoryTokens, signals.categoryTokens)) {
    score += 35;
    reasons.push('Category matches supplier profile');
  }

  if (signals.typeTokens.has(typeToken)) {
    score += 25;
    reasons.push('Tender type matches supplier preference');
  }

  const locationToken = normalizeToken(tender.location);
  if (locationToken && signals.locationTokens.has(locationToken)) {
    score += 20;
    reasons.push('Location matches supplier operating area');
  }

  if (signals.bidLimit !== null && budget > 0 && budget <= signals.bidLimit) {
    score += 10;
    reasons.push('Budget is within supplier capacity');
  }

  if (intersects(categoryTokens, signals.historyCategoryTokens) || signals.historyTypeTokens.has(typeToken)) {
    score += 10;
    reasons.push('Similar previous bid history');
  }

  return {
    tender,
    row: {
      ...toRecommendedTenderRow(tender, organizationId, savedTenderIds),
      matchScore: Math.min(score, 100),
      matchReasons: reasons
    }
  };
}

function supplierSignalsFrom(organization: SupplierContextRecord | null, bidHistory: SupplierBidHistoryRecord[]): SupplierSignals {
  const supplierCategories = tokenSet([
    ...stringValues(organization?.supplierProfile?.categories),
    ...stringsForKeys(organization?.profile?.payload, categoryKey),
    ...stringsForKeys(organization?.metadata, categoryKey)
  ].map((category) => standardizeCategoryName(category)));
  const typeTokens = new Set(
    [
      ...stringsForKeys(organization?.profile?.payload, typeKey),
      ...stringsForKeys(organization?.metadata, typeKey),
      ...supplierCategories
    ]
      .map((value) => tenderTypeToken(value))
      .filter((value): value is string => Boolean(value))
  );
  const historyCategoryTokens = new Set<string>();
  const historyTypeTokens = new Set<string>();

  for (const bid of bidHistory) {
    historyTypeTokens.add(normalizeToken(frontendTenderType(bid.tender.type)));
    for (const category of bid.tender.categories) {
      const token = normalizeToken(standardizeCategoryName(category.name, bid.tender.type));
      if (token) historyCategoryTokens.add(token);
    }
  }

  return {
    categoryTokens: supplierCategories,
    typeTokens,
    locationTokens: tokenSet([
      ...stringsForKeys(organization?.profile?.payload, locationKey),
      ...stringsForKeys(organization?.metadata, locationKey)
    ]),
    bidLimit: organization?.supplierProfile?.bidLimit ? decimalToNumber(organization.supplierProfile.bidLimit) : null,
    historyCategoryTokens,
    historyTypeTokens
  };
}

function scoreSupplier(supplier: SupplierCandidateRecord, tender: TenderSignals, bidHistory: BuyerSupplierBidHistoryRecord[]): ScoredSupplier {
  const signals = supplierCandidateSignalsFrom(supplier);
  const reasons: string[] = [];
  let score = 0;

  if (intersects(tender.categoryTokens, signals.categoryTokens)) {
    score += 35;
    reasons.push('Category or capability matches tender');
  }

  if (signals.typeTokens.has(tender.typeToken)) {
    score += 25;
    reasons.push('Tender type matches supplier profile');
  }

  if (tender.locationToken && signals.locationTokens.has(tender.locationToken)) {
    score += 20;
    reasons.push('Location matches supplier operating area');
  }

  if (tender.budget > 0 && (signals.bidLimit === null || tender.budget <= signals.bidLimit)) {
    score += 10;
    reasons.push('Budget is within supplier capacity');
  }

  if (hasRelevantSupplierHistory(bidHistory, tender)) {
    score += 10;
    reasons.push('Previous relevant procurement history');
  }

  return {
    supplier,
    row: {
      supplierOrgId: supplier.id,
      supplierName: supplier.name,
      matchScore: Math.min(score, 100),
      matchReasons: reasons,
      categories: signals.categories,
      locations: signals.locations,
      capabilitySummary: signals.capabilitySummary
    }
  };
}

function supplierCandidateSignalsFrom(supplier: SupplierCandidateRecord): SupplierCandidateSignals {
  const categories = uniqueDisplayStrings([
    ...stringValues(supplier.supplierProfile?.categories),
    ...stringsForKeys(supplier.profile?.payload, categoryKey),
    ...stringsForKeys(supplier.metadata, categoryKey)
  ].map((category) => standardizeCategoryName(category)));
  const locations = uniqueDisplayStrings([...stringsForKeys(supplier.profile?.payload, locationKey), ...stringsForKeys(supplier.metadata, locationKey)]);
  const categoryTokens = tokenSet(categories);
  const typeTokens = new Set(
    [
      ...stringsForKeys(supplier.profile?.payload, typeKey),
      ...stringsForKeys(supplier.metadata, typeKey),
      ...categories
    ]
      .map((value) => tenderTypeToken(value))
      .filter((value): value is string => Boolean(value))
  );
  const capabilityLabels = supplier.capabilities.map((capability) => titleCaseLabel(normalizeLabel(capability.capability)));

  return {
    categoryTokens,
    typeTokens,
    locationTokens: tokenSet(locations),
    bidLimit: supplier.supplierProfile?.bidLimit ? decimalToNumber(supplier.supplierProfile.bidLimit) : null,
    categories,
    locations,
    capabilitySummary: supplier.profile?.summary?.trim() || [...capabilityLabels, ...categories.slice(0, 3)].filter(Boolean).join(', ') || 'Supplier'
  };
}

function tenderSignalsFrom(tender: SupplierRecommendationTenderRecord): TenderSignals {
  return {
    categoryTokens: tokenSet(tender.categories.map((category) => standardizeCategoryName(category.name, tender.type))),
    typeToken: normalizeToken(frontendTenderType(tender.type)),
    locationToken: normalizeToken(tender.location),
    budget: decimalToNumber(tender.budget)
  };
}

function hasRelevantSupplierHistory(bidHistory: BuyerSupplierBidHistoryRecord[], tender: TenderSignals) {
  return bidHistory.some((bid) => {
    const historyCategories = tokenSet(bid.tender.categories.map((category) => standardizeCategoryName(category.name, bid.tender.type)));
    return (
      intersects(historyCategories, tender.categoryTokens) ||
      normalizeToken(frontendTenderType(bid.tender.type)) === tender.typeToken ||
      (tender.locationToken && normalizeToken(bid.tender.location) === tender.locationToken)
    );
  });
}

function groupSupplierHistory(bidHistory: BuyerSupplierBidHistoryRecord[]) {
  const grouped = new Map<string, BuyerSupplierBidHistoryRecord[]>();
  for (const bid of bidHistory) {
    grouped.set(bid.supplierOrgId, [...(grouped.get(bid.supplierOrgId) ?? []), bid]);
  }
  return grouped;
}

function compareScoredSuppliers(left: ScoredSupplier, right: ScoredSupplier) {
  return right.row.matchScore - left.row.matchScore || left.row.supplierName.localeCompare(right.row.supplierName);
}

function toRecommendedTenderRow(tender: RecommendedTenderRecord, organizationId: string, savedTenderIds: Set<string> = new Set()) {
  const category = marketplaceCategory(tender);
  return {
    id: tender.id,
    title: tender.title,
    organization: tender.buyerOrg.name,
    ownerOrganization: tender.buyerOrg.name,
    type: frontendTenderType(tender.type),
    category,
    description: tender.description || '',
    location: tender.location || 'Tanzania',
    budget: decimalToNumber(tender.budget),
    status: frontendTenderStatus(tender.status),
    reference: tender.reference,
    publishedAt: tender.publishedAt?.toISOString() ?? '',
    closingDate: dateOnly(tender.closingDate),
    createdByCurrentUser: tender.buyerOrgId === organizationId,
    isSaved: savedTenderIds.has(tender.id)
  };
}

function compareScoredTenders(left: ScoredTender, right: ScoredTender) {
  return (
    right.row.matchScore - left.row.matchScore ||
    deadlineTime(left.tender) - deadlineTime(right.tender) ||
    newestTime(right.tender) - newestTime(left.tender)
  );
}

function marketplaceCategory(tender: RecommendedTenderRecord) {
  const categoryNames = uniqueDisplayStrings(tender.categories.map((category) => standardizeCategoryName(category.name, tender.type)).filter(Boolean));
  if (categoryNames.length > 0) return categoryNames.join(' / ');
  return frontendTenderType(tender.type);
}

function frontendTenderStatus(status: unknown) {
  const value = normalizeLabel(status);
  if (value === 'OPEN' || value === 'PUBLISHED') return 'Open';
  if (value === 'EVALUATION' || value === 'UNDER_EVALUATION') return 'Evaluation';
  if (value === 'AWARDED') return 'Awarded';
  if (value === 'CLOSED') return 'Closed';
  if (value === 'DRAFT') return 'Draft';
  if (value === 'CANCELLED') return 'Cancelled';
  return titleCaseLabel(value);
}

function frontendTenderType(type: unknown) {
  const value = normalizeLabel(type);
  if (value === 'GOODS') return 'Goods';
  if (value === 'WORKS') return 'Works';
  if (value === 'SERVICE' || value === 'SERVICES' || value === 'NON_CONSULTANCY' || value === 'NON_CONSULTANCY_SERVICES') return 'Non Consultancy';
  if (value === 'CONSULTANCY') return 'Consultancy';
  return titleCaseLabel(value);
}

function tenderTypeToken(value: unknown) {
  const normalized = normalizeLabel(value);
  if (normalized === 'GOODS') return normalizeToken('Goods');
  if (normalized === 'WORKS') return normalizeToken('Works');
  if (normalized === 'SERVICE' || normalized === 'SERVICES' || normalized === 'NON_CONSULTANCY' || normalized === 'NON_CONSULTANCY_SERVICES') {
    return normalizeToken('Non Consultancy');
  }
  if (normalized === 'CONSULTANCY') return normalizeToken('Consultancy');
  return null;
}

function normalizeLabel(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function titleCaseLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeToken(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(values: unknown[]) {
  return new Set(values.map(normalizeToken).filter(Boolean));
}

function uniqueDisplayStrings(values: unknown[]) {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const value of values) {
    const display = String(value ?? '').trim();
    const token = normalizeToken(display);
    if (!display || !token || seen.has(token)) continue;
    seen.add(token);
    rows.push(display);
  }
  return rows;
}

function intersects(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function categoryKey(key: string) {
  return /categor|sector|industry|speciali[sz]|service|product|capabil/i.test(key);
}

function typeKey(key: string) {
  return /type|procurement|tender/i.test(key);
}

function locationKey(key: string) {
  return /location|region|district|area|zone|operat/i.test(key);
}

function stringsForKeys(value: unknown, keyMatches: (key: string) => boolean): string[] {
  const results: string[] = [];
  collectStringsForKeys(value, keyMatches, false, results);
  return results;
}

function collectStringsForKeys(value: unknown, keyMatches: (key: string) => boolean, active: boolean, results: string[]) {
  if (typeof value === 'string') {
    if (active) results.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringsForKeys(item, keyMatches, active, results);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    collectStringsForKeys(child, keyMatches, active || keyMatches(key), results);
  }
}

function stringValues(value: unknown): string[] {
  const results: string[] = [];
  collectStringValues(value, results);
  return results;
}

function collectStringValues(value: unknown, results: string[]) {
  if (typeof value === 'string') {
    results.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, results);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value as Record<string, unknown>)) collectStringValues(child, results);
}

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function decimalToNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function newestTime(tender: RecommendedTenderRecord) {
  return (tender.publishedAt ?? tender.createdAt).getTime();
}

function deadlineTime(tender: RecommendedTenderRecord) {
  return tender.closingDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

