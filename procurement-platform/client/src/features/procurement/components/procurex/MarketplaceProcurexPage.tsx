import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { demoUsers } from '@/shared/data/fixtures';
import { ProcurexWorkspaceChrome } from '@/shared/components/procurex/ProcurexWorkspaceChrome';
import { procurementApi } from '../../api';
import { useMarketplaceData } from '../../hooks';
import { isActiveMarketplaceTender } from '../../marketplaceTenderVisibility';
import { openTenderDocument } from '../../tenderDocumentActions';
import type { MarketplaceTenderRow, MyBidRow } from '../../types';
import {
  MarketplaceCategoryGrid,
  MarketplaceFilters,
  MarketplaceHero,
  MarketplaceSection,
  MarketplaceSummary,
  MarketplaceTabs,
  MyBidRowCard,
  MyTenderRowCard,
  TenderListPanel,
  getBudgetBand,
  searchableTenderText,
  type MarketplaceTabId
} from '../MarketplaceComponents';

type MarketplaceFiltersState = {
  query: string;
  type: string;
  budget: string;
  status: string;
  sort: string;
};

const emptyFilters: MarketplaceFiltersState = {
  query: '',
  type: '',
  budget: '',
  status: '',
  sort: 'deadline'
};

const tabRoutes: Record<MarketplaceTabId, string> = {
  marketplace: '/procurement/marketplace',
  'my-tenders': '/procurement/my-tenders',
  'my-bids': '/procurement/my-bids'
};

export function MarketplaceProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { data, isLoading, isError } = useMarketplaceData();
  const [filters, setFilters] = useState<MarketplaceFiltersState>(emptyFilters);
  const [savedTenderIds, setSavedTenderIds] = useState<Set<string>>(() => new Set());
  const [savingTenderIds, setSavingTenderIds] = useState<Set<string>>(() => new Set());
  const [openingBidTenderIds, setOpeningBidTenderIds] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState('');
  const [bidDocumentError, setBidDocumentError] = useState('');
  const [deadlineNow, setDeadlineNow] = useState(() => Date.now());
  const activeTab = getActiveTab(location.pathname);
  const organization = user?.organization || demoUsers.user.organization;
  const canCreateTender = !user || user.capabilities.includes('BUYER');

  const activeMarketplaceTenders = useMemo(() => {
    return (data?.tenders ?? []).filter((tender) => isActiveMarketplaceTender(tender, deadlineNow));
  }, [data?.tenders, deadlineNow]);

  const visibleTenders = useMemo(() => {
    return filterAndSortTenders(activeMarketplaceTenders, filters, deadlineNow);
  }, [activeMarketplaceTenders, deadlineNow, filters]);

  function selectTab(tab: MarketplaceTabId) {
    navigate(tabRoutes[tab]);
  }

  function updateFilter<K extends keyof MarketplaceFiltersState>(key: K, value: MarketplaceFiltersState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    const savedIds = new Set((data?.tenders ?? []).filter((tender) => tender.isSaved).map((tender) => tender.id));
    setSavedTenderIds(savedIds);
  }, [data?.tenders]);

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

  async function openBidDocument(tender: Pick<MarketplaceTenderRow, 'id'>) {
    const tenderId = tender.id;
    if (openingBidTenderIds.has(tenderId)) return;

    setBidDocumentError('');
    setOpeningBidTenderIds((current) => new Set(current).add(tenderId));
    try {
      const detail = await procurementApi.getTenderDetail(tenderId);
      await openTenderDocument(detail, detail.documents?.[0], 'documents');
    } catch (error) {
      console.error('Bid document open failed', error);
      setBidDocumentError('Bid document could not be opened. Open the tender detail and try again.');
    } finally {
      setOpeningBidTenderIds((current) => {
        const next = new Set(current);
        next.delete(tenderId);
        return next;
      });
    }
  }

  function openMyBidDocument(row: MyBidRow) {
    void openBidDocument(row.tender);
  }

  return (
    <ProcurexWorkspaceChrome title="Procurement">
      <div className="procurement-app-page" data-marketplace-root>
        <main className="procurement-market-shell">
          <MarketplaceHero organization={organization} canCreateTender={canCreateTender} />

          {isLoading ? <div className="scope-empty">Loading marketplace...</div> : null}
          {isError ? <div className="scope-empty">Marketplace data could not be loaded. Try refreshing the page.</div> : null}
          {saveError ? <div className="scope-empty">{saveError}</div> : null}
          {bidDocumentError ? <div className="scope-empty">{bidDocumentError}</div> : null}

          {data ? (
            <>
              <MarketplaceSummary tenders={activeMarketplaceTenders} myTenders={data.myTenders} myBids={data.myBids} />

              <section className="supplier-detail-tabbed-view marketplace-tabbed-view">
                <MarketplaceTabs activeTab={activeTab} onTabChange={selectTab} />
                <div className="supplier-detail-tab-panels marketplace-tab-panels">
                  {activeTab === 'marketplace' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="Marketplace tenders">
                      <MarketplaceFilters
                        query={filters.query}
                        type={filters.type}
                        budget={filters.budget}
                        status={filters.status}
                        sort={filters.sort}
                        onQueryChange={(value) => updateFilter('query', value)}
                        onTypeChange={(value) => updateFilter('type', value)}
                        onBudgetChange={(value) => updateFilter('budget', value)}
                        onStatusChange={(value) => updateFilter('status', value)}
                        onSortChange={(value) => updateFilter('sort', value)}
                      />
                      <MarketplaceCategoryGrid tenders={activeMarketplaceTenders} onSelectType={(value) => updateFilter('type', value)} />
                      <TenderListPanel
                        tenders={visibleTenders}
                        savedTenderIds={savedTenderIds}
                        savingTenderIds={savingTenderIds}
                        openingBidTenderIds={openingBidTenderIds}
                        onToggleSaved={toggleSaved}
                        onOpenBidDocument={(tender) => void openBidDocument(tender)}
                      />
                    </section>
                  ) : null}

                  {activeTab === 'my-tenders' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="My tenders">
                      <MarketplaceSection
                        title="Draft Tenders"
                        kicker="Tender creation"
                        rows={data.myTenders.filter((row) => row.section === 'draft')}
                        empty="No tender creation drafts for this account."
                        renderRow={(row) => <MyTenderRowCard key={row.id} row={row} />}
                      />
                      <MarketplaceSection
                        title="Completed / Posted Tenders"
                        kicker="Published by you"
                        rows={data.myTenders.filter((row) => row.section === 'posted')}
                        empty="No posted tenders for this account."
                        renderRow={(row) => <MyTenderRowCard key={row.id} row={row} />}
                      />
                      <MarketplaceSection
                        title="Closed / Completed Tenders"
                        kicker="Tender history"
                        rows={data.myTenders.filter((row) => row.section === 'completed')}
                        empty="No closed or completed tenders for this account."
                        renderRow={(row) => <MyTenderRowCard key={row.id} row={row} />}
                      />
                    </section>
                  ) : null}

                  {activeTab === 'my-bids' ? (
                    <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="My bids">
                      <MarketplaceSection
                        title="Draft Bid Submissions"
                        kicker="Bid preparation"
                        rows={data.myBids.filter((row) => row.section === 'draft')}
                        empty="No draft bid submissions for this account."
                        renderRow={(row) => <MyBidRowCard key={row.id} row={row} />}
                      />
                      <MarketplaceSection
                        title="Submitted / Completed Bid Submissions"
                        kicker="Bid records"
                        rows={data.myBids.filter((row) => row.section === 'submitted')}
                        empty="No submitted bid records for this account."
                        renderRow={(row) => (
                          <MyBidRowCard
                            key={row.id}
                            row={row}
                            isOpeningBidDocument={openingBidTenderIds.has(row.tender.id)}
                            onOpenBidDocument={openMyBidDocument}
                          />
                        )}
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

function getActiveTab(pathname: string): MarketplaceTabId {
  if (pathname.endsWith('/procurement/my-tenders')) return 'my-tenders';
  if (pathname.endsWith('/procurement/my-bids')) return 'my-bids';
  return 'marketplace';
}

function filterAndSortTenders(tenders: MarketplaceTenderRow[], filters: MarketplaceFiltersState, now = Date.now()) {
  const query = filters.query.trim().toLowerCase();

  const filtered = tenders.filter((tender) => {
    if (!isActiveMarketplaceTender(tender, now)) return false;
    const matchesQuery = !query || searchableTenderText(tender).includes(query);
    const matchesType = !filters.type || tender.type === filters.type;
    const matchesBudget = !filters.budget || getBudgetBand(tender.budget) === filters.budget;
    const matchesStatus = !filters.status || tender.status === filters.status;
    return matchesQuery && matchesType && matchesBudget && matchesStatus;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === 'budget-desc') return b.budget - a.budget;
    if (filters.sort === 'budget-asc') return a.budget - b.budget;
    if (filters.sort === 'newest') return Date.parse(b.closingDate) - Date.parse(a.closingDate);
    return Date.parse(a.closingDate) - Date.parse(b.closingDate);
  });
}
