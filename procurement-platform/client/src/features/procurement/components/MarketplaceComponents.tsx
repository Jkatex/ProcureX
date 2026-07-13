import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { MarketplaceTenderRow, MyBidRow, MyTenderRow } from '../types';

export type MarketplaceTabId = 'recommended' | 'all-tenders' | 'invited-tenders' | 'my-workspace';

type MarketplaceFiltersValue = {
  query: string;
  region: string;
  budgetMin: string;
  budgetMax: string;
};

type MarketplaceHeroProps = {
  organization: string;
  canCreateTender: boolean;
};

type MarketplaceTabsProps = {
  activeTab: MarketplaceTabId;
  onTabChange: (tab: MarketplaceTabId) => void;
};

type MarketplaceFiltersProps = MarketplaceFiltersValue & {
  onQueryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onBudgetMinChange: (value: string) => void;
  onBudgetMaxChange: (value: string) => void;
};

type MarketplaceRecommendedSearchProps = Pick<MarketplaceFiltersValue, 'query'> & {
  onQueryChange: (value: string) => void;
};

type TenderListPanelProps = {
  tenders: MarketplaceTenderRow[];
  savedTenderIds: Set<string>;
  savingTenderIds?: Set<string>;
  onToggleSaved: (tender: MarketplaceTenderRow) => void;
  title?: string;
  kicker?: string;
  empty?: string;
};

type TenderRowCardProps = {
  tender: MarketplaceTenderRow;
  isSaved: boolean;
  isSaving?: boolean;
  onToggleSaved: (tender: MarketplaceTenderRow) => void;
};

export function MarketplaceHero({ organization, canCreateTender }: MarketplaceHeroProps) {
  return (
    <section className="procurement-market-hero">
      <div>
        <span className="section-kicker">Tender Marketplace</span>
        <h1>Marketplace</h1>
        <p>Search open tenders, manage tenders created by {organization}, and track bid drafts and submitted bid records.</p>
      </div>
      <div className="procurement-market-actions">
        {canCreateTender ? (
          <Link className="btn btn-primary" to="/procurement/create-tender">
            Create Tender
          </Link>
        ) : (
          <span className="badge badge-info">Individual account</span>
        )}
      </div>
    </section>
  );
}

export function MarketplaceTabs({ activeTab, onTabChange }: MarketplaceTabsProps) {
  const tabs: Array<{ id: MarketplaceTabId; label: string }> = [
    { id: 'recommended', label: 'Recommended' },
    { id: 'all-tenders', label: 'All Tenders' },
    { id: 'invited-tenders', label: 'Invited Tenders' },
    { id: 'my-workspace', label: 'My Workspace' }
  ];

  return (
    <div className="supplier-detail-tabs marketplace-tabs" role="tablist" aria-label="Marketplace sections">
      {tabs.map((tab) => (
        <button
          className={`supplier-detail-tab ${tab.id === activeTab ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function MarketplaceFilters({
  query,
  region,
  budgetMin,
  budgetMax,
  onQueryChange,
  onRegionChange,
  onBudgetMinChange,
  onBudgetMaxChange
}: MarketplaceFiltersProps) {
  return (
    <section className="procurement-search-panel marketplace-search-panel" aria-label="Marketplace search">
      <div className="market-search-field">
        <input
          className="form-input"
          type="search"
          aria-label="Search title"
          placeholder="Search title"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="market-search-field">
        <input
          className="form-input"
          type="search"
          aria-label="Search by region"
          placeholder="Search by region"
          value={region}
          onChange={(event) => onRegionChange(event.target.value)}
        />
      </div>
      <div className="market-budget-range-field" role="group" aria-label="Filter by budget range">
        <span>Budget range</span>
        <input
          className="form-input"
          type="number"
          min="0"
          inputMode="numeric"
          aria-label="Minimum budget"
          placeholder="Min"
          value={budgetMin}
          onChange={(event) => onBudgetMinChange(event.target.value)}
        />
        <input
          className="form-input"
          type="number"
          min="0"
          inputMode="numeric"
          aria-label="Maximum budget"
          placeholder="Max"
          value={budgetMax}
          onChange={(event) => onBudgetMaxChange(event.target.value)}
        />
      </div>
    </section>
  );
}

export function MarketplaceRecommendedSearch({ query, onQueryChange }: MarketplaceRecommendedSearchProps) {
  return (
    <section className="procurement-search-panel marketplace-search-panel marketplace-search-panel-simple" aria-label="Marketplace search">
      <div className="market-search-field">
        <input
          className="form-input"
          type="search"
          aria-label="Search title, buyer, reference, sector, location"
          placeholder="Search title, buyer, reference, sector, location"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
    </section>
  );
}

export function MarketplaceCategoryGrid({
  tenders,
  selectedType,
  onSelectType
}: {
  tenders: MarketplaceTenderRow[];
  selectedType: string;
  onSelectType: (type: string) => void;
}) {
  const typeFilters = [
    { id: '', label: 'All' },
    { id: 'GOODS', label: 'Goods' },
    { id: 'SERVICE', label: 'Non Consultancy' },
    { id: 'CONSULTANCY', label: 'Consultancy' },
    { id: 'WORKS', label: 'Works' }
  ];
  const counts = tenders.reduce<Record<string, number>>((acc, tender) => {
    const type = normalizedTenderType(tender.type);
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="marketplace-category-grid" aria-label="Filter by tender type">
      {typeFilters.map((type) => {
        const isActive = selectedType === type.id;
        const isAll = type.id === '';
        const count = isAll ? tenders.length : counts[type.id] ?? 0;
        return (
          <button
            className={`marketplace-category-card ${isActive ? 'active' : ''}`}
            type="button"
            aria-pressed={isActive}
            key={type.id}
            onClick={() => onSelectType(isActive && !isAll ? '' : type.id)}
          >
            <strong>{type.label}</strong>
            <span className="marketplace-category-count">{count}</span>
          </button>
        );
      })}
    </section>
  );
}

export function TenderListPanel({
  tenders,
  savedTenderIds,
  savingTenderIds = new Set(),
  onToggleSaved,
  title = 'Available tenders',
  kicker = 'Tender list',
  empty = 'No active marketplace tenders right now. Create a tender to start a compliant procurement.'
}: TenderListPanelProps) {
  return (
    <section className="procurement-list-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="procurement-tender-list market-list">
        {tenders.length ? (
          tenders.map((tender) => (
            <TenderRowCard
              key={tender.id}
              tender={tender}
              isSaved={savedTenderIds.has(tender.id)}
              isSaving={savingTenderIds.has(tender.id)}
              onToggleSaved={onToggleSaved}
            />
          ))
        ) : (
          <div className="scope-empty">{empty}</div>
        )}
      </div>
    </section>
  );
}

export function MarketplaceSection<T>({
  title,
  kicker,
  rows,
  empty,
  renderRow
}: {
  title: string;
  kicker: string;
  rows: T[];
  empty: string;
  renderRow: (row: T) => ReactElement;
}) {
  return (
    <section className="procurement-list-panel marketplace-work-section">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="procurement-tender-list market-list">{rows.length ? rows.map(renderRow) : <div className="scope-empty">{empty}</div>}</div>
    </section>
  );
}

export function MyTenderRowCard({ row }: { row: MyTenderRow }) {
  const tender = row.tender;
  const action = myTenderAction(row);

  return (
    <article className="procurement-tender-row market-row is-owned">
      <div>
        <div className="tender-row-title">
          <strong>{row.title}</strong>
          <span className={`badge ${statusBadgeClass(row.status)}`}>{row.status}</span>
        </div>
        <p>
          {formatTenderType(row.type)} / {tender?.organization || 'Owner organization'}
        </p>
        <span>{tender?.description || 'Tender record owned by the current user.'}</span>
        <div className="market-row-meta">
          <span>{tender?.closingDate ? `Closing ${formatDate(tender.closingDate)}` : 'No closing date set'}</span>
          <span>Updated {formatDate(row.lastActivity)}</span>
        </div>
      </div>
      <div className="tender-row-actions">
        {action.kind === 'status' ? (
          <button className="btn btn-secondary marketplace-disabled-action" type="button" disabled>
            {action.label}
          </button>
        ) : (
          <Link className="btn btn-primary" to={action.to}>
            {action.label}
          </Link>
        )}
      </div>
    </article>
  );
}

export function MyBidRowCard({ row }: { row: MyBidRow }) {
  const bidUrl = row.nav?.startsWith('/') ? row.nav : `/bidding?tenderId=${row.tender.id}`;
  const actionLabel = row.section === 'draft' ? 'Continue Bid' : 'Open Bid';

  return (
    <article className="procurement-tender-row market-row">
      <div>
        <div className="tender-row-title">
          <strong>{row.title}</strong>
          <span className={`badge ${row.section === 'submitted' ? 'badge-success' : 'badge-warning'}`}>{row.status}</span>
        </div>
        <p>
          {row.tender.organization} / {formatTenderType(row.tender.type)}
          {row.amount ? ` / ${row.amount}` : ''}
        </p>
        <span>{row.section === 'submitted' ? 'Submitted bid package is sealed and recorded.' : 'Draft bid submission saved for completion.'}</span>
        <div className="market-row-meta">
          <span>{row.tender.closingDate ? `Closing ${formatDate(row.tender.closingDate)}` : 'Deadline not set'}</span>
          <span>Updated {formatDate(row.lastActivity)}</span>
        </div>
      </div>
      <div className="tender-row-actions">
        <Link className="btn btn-primary" to={bidUrl}>
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}

function TenderRowCard({
  tender,
  isSaved,
  isSaving = false,
  onToggleSaved
}: TenderRowCardProps) {
  const ownedByCurrentOrganization = Boolean(tender.ownedByCurrentOrganization ?? tender.createdByCurrentUser);
  const canBid = isBiddableVisibility(tender.visibility) && !ownedByCurrentOrganization && Boolean(tender.canBid ?? (isOpenStatus(tender.status) && !tender.hasSubmittedBid));
  const daysRemaining = getDaysRemaining(tender.closingDate);
  const detailUrl = ownedByCurrentOrganization ? `/procurement/tender-details?tenderId=${tender.id}` : `/procurement/supplier-tender-detail?tenderId=${tender.id}`;
  const bidUrl = `/bidding?tenderId=${tender.id}`;
  const bidLabel = tender.hasSubmittedBid ? 'Already Bid' : tender.hasDraftBid ? 'Continue Bid' : 'Bid';
  const saveDisabled = ownedByCurrentOrganization || isSaving;
  const tag = marketplaceTenderTag(tender);

  return (
    <article className={`procurement-tender-row market-row ${ownedByCurrentOrganization ? 'is-owned' : ''}`}>
      <div>
        <div className="tender-row-title">
          <strong>{tender.title}</strong>
          <span className={`badge ${tag.className}`}>{tag.label}</span>
        </div>
        <p>
          {tender.organization} / {formatTenderType(tender.type)} / Budget: {tender.currency} {tender.budget.toLocaleString()}
        </p>
        <span>{tender.description}</span>
        <div className="market-row-meta">
          <span>{tender.location}</span>
          <span>{daysRemaining === null ? 'Deadline not set' : daysRemaining < 0 ? 'Closed' : `${daysRemaining} days remaining`}</span>
        </div>
      </div>
      <div className="tender-row-actions">
        {ownedByCurrentOrganization ? (
          <Link className="btn btn-primary" to={detailUrl}>
            View tender
          </Link>
        ) : (
          <>
            <button className="btn btn-secondary" type="button" disabled={saveDisabled} onClick={() => onToggleSaved(tender)}>
              {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
            </button>
            <Link className="btn btn-secondary" to={detailUrl}>
              View Tender
            </Link>
            {canBid ? (
              <Link className="btn btn-primary" to={bidUrl}>
                {bidLabel}
              </Link>
            ) : (
              <button className="btn btn-primary" type="button" disabled>
                {bidLabel}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function myTenderAction(row: MyTenderRow): { kind: 'link'; label: string; to: string } | { kind: 'status'; label: string } {
  if (isAwaitingReviewStatus(row.status)) return { kind: 'status', label: 'Awaiting review' };
  if (isFailedReviewStatus(row.status)) return { kind: 'link', label: 'Amend tender', to: tenderEditUrl(row) };
  if (row.section === 'draft' || isDraftStatus(row.status)) return { kind: 'link', label: 'Continue creating', to: tenderEditUrl(row) };
  return { kind: 'link', label: 'View tender', to: tenderDetailUrl(row) };
}

function tenderEditUrl(row: MyTenderRow) {
  if (row.nav?.startsWith('/procurement/create-tender')) return row.nav;
  const tenderId = row.tender?.id;
  return tenderId ? `/procurement/create-tender?tenderId=${encodeURIComponent(tenderId)}` : `/procurement/create-tender?draftId=${encodeURIComponent(row.id)}`;
}

function tenderDetailUrl(row: MyTenderRow) {
  if (row.nav?.startsWith('/procurement/tender-details')) return row.nav;
  const tenderId = row.tender?.id || row.id;
  return `/procurement/tender-details?tenderId=${encodeURIComponent(tenderId)}`;
}

export function getBudgetBand(value: number) {
  if (value >= 1000000000) return 'billion-plus';
  if (value >= 100000000) return 'hundred-million-plus';
  return 'under-hundred-million';
}

export function searchableTenderText(tender: MarketplaceTenderRow) {
  return [tender.id, tender.reference, tender.title, tender.organization, tender.type, tender.categories.join(' '), tender.description, tender.location]
    .join(' ')
    .toLowerCase();
}

export function formatTenderType(value: string) {
  const labels: Record<string, string> = {
    GOODS: 'Goods',
    WORKS: 'Works',
    SERVICE: 'Non Consultancy',
    CONSULTANCY: 'Consultancy'
  };
  return labels[normalizedTenderType(value)] || value;
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusBadgeClass(value: string) {
  if (/open|published|posted/i.test(value)) return 'badge-success';
  if (/fail|reject/i.test(value)) return 'badge-error';
  if (/draft|pending|evaluation|review/i.test(value)) return 'badge-warning';
  return 'badge-info';
}

function marketplaceTenderTag(tender: MarketplaceTenderRow) {
  if (tender.hasSubmittedBid) return { label: 'You already bid', className: 'badge-success' };
  return { label: formatStatus(tender.status), className: statusBadgeClass(tender.status) };
}

function normalizedTenderType(value: string) {
  const normalized = normalizedStatus(value);
  if (normalized === 'SERVICES' || normalized === 'NON_CONSULTANCY' || normalized === 'NON_CONSULTANCY_SERVICES') return 'SERVICE';
  return normalized;
}

function normalizedStatus(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function isDraftStatus(value: string) {
  return normalizedStatus(value) === 'DRAFT';
}

function isFailedReviewStatus(value: string) {
  const status = normalizedStatus(value);
  return status === 'FAILED_REVIEW' || status === 'FAILED' || status === 'REJECTED_REVIEW';
}

function isAwaitingReviewStatus(value: string) {
  const status = normalizedStatus(value);
  return status === 'AWAITING_REVIEW' || status === 'UNDER_REVIEW' || status === 'REVIEW_PENDING';
}

function isOpenStatus(value: string) {
  return /^(open|published)$/i.test(value.trim());
}

function isBiddableVisibility(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
  return normalized === 'PUBLIC_MARKETPLACE' || normalized === 'INVITED';
}

function getDaysRemaining(closingDate: string) {
  const closingTime = Date.parse(`${closingDate}T23:59:59`);
  if (!Number.isFinite(closingTime)) return null;
  return Math.ceil((closingTime - Date.now()) / 86400000);
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
