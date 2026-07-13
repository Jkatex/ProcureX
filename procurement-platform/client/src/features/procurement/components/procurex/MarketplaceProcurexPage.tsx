import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { demoUsers } from '@/shared/data/fixtures';
import { ProcurexWorkspaceChrome } from '@/shared/components/procurex/ProcurexWorkspaceChrome';
import { procurementApi } from '../../api';
import { useMarketplaceData } from '../../hooks';
import { hasActiveMarketplaceDeadline, isActiveInvitedTender, isActiveMarketplaceTender } from '../../marketplaceTenderVisibility';
import type { MarketplaceTenderRow, MyBidRow, MyTenderRow } from '../../types';
import {
  MarketplaceCategoryGrid,
  MarketplaceFilters,
  MarketplaceHero,
  MarketplaceRecommendedSearch,
  MarketplaceSection,
  MarketplaceTabs,
  MyBidRowCard,
  MyTenderRowCard,
  searchableTenderText,
  TenderListPanel,
  type MarketplaceTabId
} from '../MarketplaceComponents';

type MarketplaceFiltersState = {
  query: string;
  region: string;
  budgetMin: string;
  budgetMax: string;
  type: string;
};

const emptyFilters: MarketplaceFiltersState = {
  query: '',
  region: '',
  budgetMin: '',
  budgetMax: '',
  type: ''
};

const tabRoutes: Record<MarketplaceTabId, string> = {
  recommended: '/procurement/marketplace',
  'all-tenders': '/procurement/marketplace?view=all-tenders',
  'invited-tenders': '/procurement/marketplace?view=invited-tenders',
  'my-workspace': '/procurement/marketplace?view=my-workspace'
};

export function MarketplaceProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { data, isLoading, isError } = useMarketplaceData();
  const [filters, setFilters] = useState<MarketplaceFiltersState>(emptyFilters);
  const [recommendedQuery, setRecommendedQuery] = useState('');
  const [invitedQuery, setInvitedQuery] = useState('');
  const [savedTenderIds, setSavedTenderIds] = useState<Set<string>>(() => new Set());
  const [savingTenderIds, setSavingTenderIds] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState('');
  const [deadlineNow, setDeadlineNow] = useState(() => Date.now());
  const activeTab = getActiveTab(location.pathname, location.search);
  const organization = user?.organization || demoUsers.user.organization;
  const canCreateTender = !user || user.capabilities.includes('BUYER');

  const activeMarketplaceTenders = useMemo(() => {
    return (data?.tenders ?? []).filter((tender) => isActiveMarketplaceTender(tender, deadlineNow));
  }, [data?.tenders, deadlineNow]);

  const visibleTenders = useMemo(() => {
    return filterTenders(activeMarketplaceTenders, filters, deadlineNow);
  }, [activeMarketplaceTenders, deadlineNow, filters]);

  const activeRecommendedTenders = useMemo(() => {
    const rows = data?.recommendedTenders ?? [];
    return rows.filter((tender) => isActiveMarketplaceTender(tender, deadlineNow) || isActiveInvitedTender(tender, deadlineNow));
  }, [data?.recommendedTenders, deadlineNow]);

  const recommendedTenders = useMemo(() => {
    return filterRecommendedTenders(activeRecommendedTenders, recommendedQuery, deadlineNow);
  }, [activeRecommendedTenders, deadlineNow, recommendedQuery]);

  const invitedTenders = useMemo(() => {
    const rows = data?.invitedTenders ?? (data?.tenders ?? []).filter((tender) => isActiveInvitedTender(tender, deadlineNow));
    return filterInvitedTenders(rows, invitedQuery, deadlineNow);
  }, [data?.invitedTenders, data?.tenders, deadlineNow, invitedQuery]);

  const workspace = useMemo(() => {
    return buildWorkspaceSections({
      tenders: activeMarketplaceTenders,
      myBids: data?.myBids ?? [],
      myTenders: data?.myTenders ?? [],
      savedTenderIds,
      now: deadlineNow
    });
  }, [activeMarketplaceTenders, data?.myBids, data?.myTenders, deadlineNow, savedTenderIds]);

  function selectTab(tab: MarketplaceTabId) {
    navigate(tabRoutes[tab]);
  }

  function updateFilter<K extends keyof MarketplaceFiltersState>(key: K, value: MarketplaceFiltersState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    const savedIds = new Set(
      [...(data?.tenders ?? []), ...(data?.recommendedTenders ?? []), ...(data?.invitedTenders ?? [])]
        .filter((tender) => tender.isSaved)
        .map((tender) => tender.id)
    );
    setSavedTenderIds(savedIds);
  }, [data?.invitedTenders, data?.recommendedTenders, data?.tenders]);

  useEffect(() => {
    const now = Date.now();
    const nextDeadline = (data?.tenders ?? []).reduce<number | null>((nearest, tender) => {
      const deadline = Date.parse(tender.closingDate);
      if (!Number.isFinite(deadline) || deadline <= now) return nearest;
      return nearest === null || deadline < nearest ? deadline : nearest;
    }, null);

    if (nextDeadline === null) return undefined;

    // Re-evaluate at the exact next deadline so an open marketplace page does
    // not continue showing an expired tender until its next data refresh.
    const timer = window.setTimeout(
      () => setDeadlineNow(Date.now()),
      Math.min(Math.max(nextDeadline - now, 0), 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [data?.tenders, deadlineNow]);

  async function toggleSaved(tender: MarketplaceTenderRow) {
    const tenderId = tender.id;
    const wasSaved = savedTenderIds.has(tenderId);
    setSaveError('');
    setSavedTenderIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(tenderId);
      else next.add(tenderId);
      return next;
    });
    setSavingTenderIds((current) => new Set(current).add(tenderId));

    try {
      if (wasSaved) await procurementApi.unsaveTender(tenderId);
      else await procurementApi.saveTender(tenderId);
    } catch {
      setSavedTenderIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(tenderId);
        else next.delete(tenderId);
        return next;
      });
      setSaveError('Saved tender status could not be updated. Sign in and try again.');
    } finally {
      setSavingTenderIds((current) => {
        const next = new Set(current);
        next.delete(tenderId);
        return next;
      });
    }
  }

  return (
    <ProcurexWorkspaceChrome title="Procurement">
      <div className="procurement-app-page" data-marketplace-root>
        <main className="procurement-market-shell">
          <MarketplaceHero organization={organization} canCreateTender={canCreateTender} />

          {isLoading ? <div className="scope-empty">Loading marketplace...</div> : null}
          {isError ? <div className="scope-empty">Marketplace data could not be loaded. Try refreshing the page.</div> : null}
          {saveError ? <div className="scope-empty">{saveError}</div> : null}

          {data ? (
            <>
              <section className="supplier-detail-tabbed-view marketplace-tabbed-view">
                <MarketplaceTabs activeTab={activeTab} onTabChange={selectTab} />
                <div className="supplier-detail-tab-panels marketplace-tab-panels">
                  {activeTab === 'recommended' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="Recommended tenders">
                      <MarketplaceRecommendedSearch query={recommendedQuery} onQueryChange={setRecommendedQuery} />
                      <TenderListPanel
                        tenders={recommendedTenders}
                        savedTenderIds={savedTenderIds}
                        savingTenderIds={savingTenderIds}
                        onToggleSaved={toggleSaved}
                        title="Recommended tenders"
                        kicker="Recommended"
                        empty="No relevant recommended tenders right now."
                      />
                    </section>
                  ) : null}

                  {activeTab === 'all-tenders' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="All tenders">
                      <MarketplaceFilters
                        query={filters.query}
                        region={filters.region}
                        budgetMin={filters.budgetMin}
                        budgetMax={filters.budgetMax}
                        onQueryChange={(value) => updateFilter('query', value)}
                        onRegionChange={(value) => updateFilter('region', value)}
                        onBudgetMinChange={(value) => updateFilter('budgetMin', value)}
                        onBudgetMaxChange={(value) => updateFilter('budgetMax', value)}
                      />
                      <MarketplaceCategoryGrid
                        tenders={activeMarketplaceTenders}
                        selectedType={filters.type}
                        onSelectType={(value) => updateFilter('type', value)}
                      />
                      <TenderListPanel
                        tenders={visibleTenders}
                        savedTenderIds={savedTenderIds}
                        savingTenderIds={savingTenderIds}
                        onToggleSaved={toggleSaved}
                        title="All tenders"
                        kicker="Tender list"
                      />
                    </section>
                  ) : null}

                  {activeTab === 'invited-tenders' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="Invited tenders">
                      <MarketplaceRecommendedSearch query={invitedQuery} onQueryChange={setInvitedQuery} />
                      <TenderListPanel
                        tenders={invitedTenders}
                        savedTenderIds={savedTenderIds}
                        savingTenderIds={savingTenderIds}
                        onToggleSaved={toggleSaved}
                        title="Invited tenders"
                        kicker="Invited"
                        empty="Tenders you are invited to, will appear here"
                      />
                    </section>
                  ) : null}

                  {activeTab === 'my-workspace' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="My workspace">
                      <TenderListPanel
                        tenders={workspace.saved}
                        savedTenderIds={savedTenderIds}
                        savingTenderIds={savingTenderIds}
                        onToggleSaved={toggleSaved}
                        title="Saved"
                        kicker="Saved tenders"
                        empty="No saved active tenders. Save an open tender from Recommended or All Tenders to track it here."
                      />
                      <MarketplaceSection
                        title="My Bids"
                        kicker="Bid workspace"
                        rows={workspace.myBids}
                        empty="No active tender bid drafts or submitted bids for this account."
                        renderRow={(row) => <MyBidRowCard key={row.id} row={row} />}
                      />
                      <MarketplaceSection
                        title="My Tenders"
                        kicker="Tender creation"
                        rows={workspace.myTenders}
                        empty="No active created tenders, drafts, review items, or failed-review tenders for this account."
                        renderRow={(row) => <MyTenderRowCard key={row.id} row={row} />}
                      />
                    </section>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </ProcurexWorkspaceChrome>
  );
}

function getActiveTab(pathname: string, search = ''): MarketplaceTabId {
  if (pathname.endsWith('/procurement/my-tenders') || pathname.endsWith('/procurement/my-bids')) return 'my-workspace';

  const view = new URLSearchParams(search).get('view');
  if (view === 'all-tenders') return 'all-tenders';
  if (view === 'invited-tenders') return 'invited-tenders';
  if (view === 'my-workspace') return 'my-workspace';
  return 'recommended';
}

function filterTenders(tenders: MarketplaceTenderRow[], filters: MarketplaceFiltersState, now = Date.now()) {
  const query = filters.query.trim().toLowerCase();
  const region = filters.region.trim().toLowerCase();
  const type = normalizeTenderTypeFilter(filters.type);
  const budgetMin = parseBudgetFilter(filters.budgetMin);
  const budgetMax = parseBudgetFilter(filters.budgetMax);

  const filtered = tenders.filter((tender) => {
    if (!isActiveMarketplaceTender(tender, now)) return false;
    if (query && !tender.title.toLowerCase().includes(query)) return false;
    if (region && !tender.location.toLowerCase().includes(region)) return false;
    if (type && normalizeTenderTypeFilter(tender.type) !== type) return false;
    if (budgetMin !== null && tender.budget < budgetMin) return false;
    if (budgetMax !== null && tender.budget > budgetMax) return false;
    return true;
  });

  return sortTendersByDeadline(filtered);
}

function filterRecommendedTenders(tenders: MarketplaceTenderRow[], query: string, now = Date.now()) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = tenders.filter((tender) => {
    if (!isActiveMarketplaceTender(tender, now) && !isActiveInvitedTender(tender, now)) return false;
    return !normalizedQuery || searchableTenderText(tender).includes(normalizedQuery);
  });

  return uniqueTenderRows(filtered);
}

function filterInvitedTenders(tenders: MarketplaceTenderRow[], query: string, now = Date.now()) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = tenders.filter((tender) => {
    if (!isActiveInvitedTender(tender, now)) return false;
    return !normalizedQuery || searchableTenderText(tender).includes(normalizedQuery);
  });

  return sortTendersByDeadline(uniqueTenderRows(filtered));
}

function buildWorkspaceSections({
  tenders,
  myBids,
  myTenders,
  savedTenderIds,
  now
}: {
  tenders: MarketplaceTenderRow[];
  myBids: MyBidRow[];
  myTenders: MyTenderRow[];
  savedTenderIds: Set<string>;
  now: number;
}) {
  const ownedRows = uniqueByWorkspaceTender(
    myTenders.filter((row) => isActiveWorkspaceTender(row.tender, now) && workspaceMyTenderRank(row) > 0),
    workspaceMyTenderRank
  );
  const ownedKeys = new Set(ownedRows.map((row) => workspaceTenderKey(row.tender) || row.id));

  const bidRows = uniqueByWorkspaceTender(
    myBids.filter((row) => isActiveWorkspaceTender(row.tender, now) && !ownedKeys.has(workspaceTenderKey(row.tender) || row.id)),
    workspaceBidRank
  );
  const bidKeys = new Set(bidRows.map((row) => workspaceTenderKey(row.tender) || row.id));

  const savedRows = uniqueTenderRows(
    tenders.filter((tender) => {
      const key = workspaceTenderKey(tender);
      return savedTenderIds.has(tender.id) && hasActiveMarketplaceDeadline(tender, now) && !ownedKeys.has(key) && !bidKeys.has(key);
    })
  );

  return {
    saved: sortTendersByDeadline(savedRows),
    myBids: sortWorkspaceRowsByDeadline(bidRows),
    myTenders: sortWorkspaceRowsByDeadline(ownedRows)
  };
}

function uniqueTenderRows(rows: MarketplaceTenderRow[]) {
  return [...new Map(rows.map((row) => [workspaceTenderKey(row), row])).values()];
}

function uniqueByWorkspaceTender<T extends { id: string; tender?: MarketplaceTenderRow; lastActivity?: string }>(rows: T[], rank: (row: T) => number) {
  const byTender = new Map<string, T>();
  for (const row of rows) {
    const key = workspaceTenderKey(row.tender) || row.id;
    const current = byTender.get(key);
    if (!current || rank(row) > rank(current) || (rank(row) === rank(current) && workspaceUpdatedTime(row) > workspaceUpdatedTime(current))) {
      byTender.set(key, row);
    }
  }
  return [...byTender.values()];
}

function workspaceTenderKey(tender?: MarketplaceTenderRow) {
  if (!tender) return '';
  return tender.id || tender.reference;
}

function isActiveWorkspaceTender(tender: MarketplaceTenderRow | undefined, now: number) {
  return Boolean(tender && hasActiveMarketplaceDeadline(tender, now));
}

function workspaceBidRank(row: MyBidRow) {
  return row.section === 'submitted' ? 2 : 1;
}

function workspaceMyTenderRank(row: MyTenderRow) {
  const status = normalizedWorkspaceStatus(row.status);
  if (status === 'FAILED_REVIEW' || status === 'FAILED') return 4;
  if (status === 'AWAITING_REVIEW' || status === 'UNDER_REVIEW') return 3;
  if (row.section === 'posted' || status === 'OPEN' || status === 'PUBLISHED' || status === 'POSTED') return 2;
  if (row.section === 'draft' || status === 'DRAFT') return 1;
  return 0;
}

function workspaceUpdatedTime(row: { lastActivity?: string }) {
  const time = Date.parse(row.lastActivity ?? '');
  return Number.isFinite(time) ? time : 0;
}

function sortTendersByDeadline(rows: MarketplaceTenderRow[]) {
  return [...rows].sort((a, b) => tenderDeadlineTime(a) - tenderDeadlineTime(b) || a.title.localeCompare(b.title));
}

function sortWorkspaceRowsByDeadline<T extends { tender?: MarketplaceTenderRow; title?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => tenderDeadlineTime(a.tender) - tenderDeadlineTime(b.tender) || String(a.title ?? '').localeCompare(String(b.title ?? '')));
}

function tenderDeadlineTime(tender?: MarketplaceTenderRow) {
  const parsed = Date.parse(tender?.closingDate ?? '');
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function normalizedWorkspaceStatus(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function parseBudgetFilter(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTenderTypeFilter(value: string) {
  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
  if (normalized === 'SERVICES' || normalized === 'NON_CONSULTANCY' || normalized === 'NON_CONSULTANCY_SERVICES') return 'SERVICE';
  return normalized;
}
