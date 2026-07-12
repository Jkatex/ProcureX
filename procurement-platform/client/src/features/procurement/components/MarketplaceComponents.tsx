import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { MarketplaceTenderRow, MyBidRow, MyTenderRow } from '../types';

export type MarketplaceTabId = 'marketplace' | 'my-tenders' | 'my-bids';

type MarketplaceFiltersValue = {
  query: string;
  type: string;
  budget: string;
  status: string;
  sort: string;
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
  onTypeChange: (value: string) => void;
  onBudgetChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
};

type TenderListPanelProps = {
  tenders: MarketplaceTenderRow[];
  savedTenderIds: Set<string>;
  savingTenderIds?: Set<string>;
  openingBidTenderIds?: Set<string>;
  onToggleSaved: (tender: MarketplaceTenderRow) => void;
  onOpenBidDocument: (tender: MarketplaceTenderRow) => void;
};

type TenderRowCardProps = {
  tender: MarketplaceTenderRow;
  isSaved: boolean;
  isSaving?: boolean;
  isOpeningBidDocument?: boolean;
  onToggleSaved: (tender: MarketplaceTenderRow) => void;
  onOpenBidDocument: (tender: MarketplaceTenderRow) => void;
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

export function MarketplaceSummary({
  tenders,
  myTenders,
  myBids
}: {
  tenders: MarketplaceTenderRow[];
  myTenders: MyTenderRow[];
  myBids: MyBidRow[];
}) {
  const openCount = tenders.filter((tender) => tender.status === 'OPEN').length;
  const totalBudget = tenders.reduce((sum, tender) => sum + tender.budget, 0);

  return (
    <section className="procurement-market-summary">
      <div className="kpi-card">
        <div className="kpi-value">{openCount}</div>
        <div className="kpi-label">Open tenders</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">{myTenders.length}</div>
        <div className="kpi-label">My tenders</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">{myBids.length}</div>
        <div className="kpi-label">My bids</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">TZS {(totalBudget / 1000000000).toFixed(1)}B</div>
        <div className="kpi-label">Total budget value</div>
      </div>
    </section>
  );
}

export function MarketplaceTabs({ activeTab, onTabChange }: MarketplaceTabsProps) {
  const tabs: Array<{ id: MarketplaceTabId; label: string }> = [
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'my-tenders', label: 'My Tenders' },
    { id: 'my-bids', label: 'My Bids' }
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
  type,
  budget,
  status,
  sort,
  onQueryChange,
  onTypeChange,
  onBudgetChange,
  onStatusChange,
  onSortChange
}: MarketplaceFiltersProps) {
  return (
    <section className="procurement-search-panel" aria-label="Marketplace filters">
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
      <select className="form-input" aria-label="Type" value={type} onChange={(event) => onTypeChange(event.target.value)}>
        <option value="">All tender types</option>
        <option value="GOODS">Goods</option>
        <option value="WORKS">Works</option>
        <option value="SERVICE">Services</option>
        <option value="CONSULTANCY">Consultancy</option>
      </select>
      <select className="form-input" aria-label="Budget" value={budget} onChange={(event) => onBudgetChange(event.target.value)}>
        <option value="">All budgets</option>
        <option value="under-hundred-million">Under TZS 100M</option>
        <option value="hundred-million-plus">TZS 100M to 1B</option>
        <option value="billion-plus">TZS 1B+</option>
      </select>
      <select className="form-input" aria-label="Status" value={status} onChange={(event) => onStatusChange(event.target.value)}>
        <option value="">All statuses</option>
        <option value="OPEN">Open</option>
        <option value="PUBLISHED">Published</option>
        <option value="EVALUATION">Evaluation</option>
        <option value="AWARDED">Awarded</option>
        <option value="CLOSED">Closed</option>
      </select>
      <select className="form-input" aria-label="Sort" value={sort} onChange={(event) => onSortChange(event.target.value)}>
        <option value="deadline">Sort by deadline</option>
        <option value="newest">Newest</option>
        <option value="budget-desc">Budget high to low</option>
        <option value="budget-asc">Budget low to high</option>
      </select>
    </section>
  );
}

export function MarketplaceCategoryGrid({ tenders, onSelectType }: { tenders: MarketplaceTenderRow[]; onSelectType: (type: string) => void }) {
  const counts = tenders.reduce<Record<string, number>>((acc, tender) => {
    acc[tender.type] = (acc[tender.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="marketplace-category-grid" aria-label="Browse categories">
      {Object.entries(counts).map(([category, count]) => (
        <button className="marketplace-category-card" type="button" key={category} onClick={() => onSelectType(category)}>
          <strong>{formatTenderType(category)}</strong>
          <span>
            {count} {count === 1 ? 'tender' : 'tenders'}
          </span>
        </button>
      ))}
    </section>
  );
}

export function TenderListPanel({
  tenders,
  savedTenderIds,
  savingTenderIds = new Set(),
  openingBidTenderIds = new Set(),
  onToggleSaved,
  onOpenBidDocument
}: TenderListPanelProps) {
  return (
    <section className="procurement-list-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Tender list</span>
          <h2>Available tenders</h2>
        </div>
        <span className="badge badge-success">{tenders.length} matching</span>
      </div>
      <div className="procurement-tender-list market-list">
        {tenders.length ? (
          tenders.map((tender) => (
            <TenderRowCard
              key={tender.id}
              tender={tender}
              isSaved={savedTenderIds.has(tender.id)}
              isSaving={savingTenderIds.has(tender.id)}
              isOpeningBidDocument={openingBidTenderIds.has(tender.id)}
              onToggleSaved={onToggleSaved}
              onOpenBidDocument={onOpenBidDocument}
            />
          ))
        ) : (
          <div className="scope-empty">No active marketplace tenders right now. Create a tender to start a compliant procurement.</div>
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
        <span className="badge badge-info">
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="procurement-tender-list market-list">{rows.length ? rows.map(renderRow) : <div className="scope-empty">{empty}</div>}</div>
    </section>
  );
}

export function MyTenderRowCard({ row }: { row: MyTenderRow }) {
  const tender = row.tender;

  return (
    <article className="procurement-tender-row market-row is-owned">
      <div>
        <div className="tender-row-title">
          <strong>{row.title}</strong>
          <span className={`badge ${statusBadgeClass(row.status)}`}>{row.status}</span>
          <span className="badge badge-info">Created by you</span>
        </div>
        <p>
          {formatTenderType(row.type)} / {tender?.organization || 'Your organization'}
        </p>
        <span>{tender?.description || 'Tender record owned by the current user.'}</span>
        <div className="market-row-meta">
          <em>{tender?.closingDate ? `Closing ${formatDate(tender.closingDate)}` : 'No closing date set'}</em>
          <em>Updated {formatDate(row.lastActivity)}</em>
        </div>
      </div>
      <div className="tender-row-actions">
        <Link className="btn btn-primary" to={row.nav}>
          {row.actionLabel}
        </Link>
      </div>
    </article>
  );
}

export function MyBidRowCard({
  row,
  isOpeningBidDocument = false,
  onOpenBidDocument
}: {
  row: MyBidRow;
  isOpeningBidDocument?: boolean;
  onOpenBidDocument?: (row: MyBidRow) => void;
}) {
  const opensBidDocument = row.actionLabel === 'Open Bid' && onOpenBidDocument;

  return (
    <article className="procurement-tender-row market-row">
      <div>
        <div className="tender-row-title">
          <strong>{row.title}</strong>
          <span className={`badge ${row.section === 'submitted' ? 'badge-success' : 'badge-warning'}`}>{row.status}</span>
          {row.receiptHash ? <span className="badge badge-info">{row.receiptHash}</span> : null}
        </div>
        <p>
          {row.tender.organization} / {formatTenderType(row.tender.type)}
          {row.amount ? ` / ${row.amount}` : ''}
        </p>
        <span>{row.section === 'submitted' ? 'Submitted bid package is sealed and recorded.' : 'Draft bid submission saved for completion.'}</span>
        <div className="market-row-meta">
          <em>{row.tender.closingDate ? `Closing ${formatDate(row.tender.closingDate)}` : 'Deadline not set'}</em>
          <em>Updated {formatDate(row.lastActivity)}</em>
        </div>
      </div>
      <div className="tender-row-actions">
        {opensBidDocument ? (
          <button className="btn btn-primary" type="button" disabled={isOpeningBidDocument} onClick={() => onOpenBidDocument(row)}>
            {isOpeningBidDocument ? 'Opening...' : row.actionLabel}
          </button>
        ) : (
          <Link className="btn btn-primary" to={row.nav}>
            {row.actionLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

function TenderRowCard({
  tender,
  isSaved,
  isSaving = false,
  isOpeningBidDocument = false,
  onToggleSaved,
  onOpenBidDocument
}: TenderRowCardProps) {
  const createdByCurrentUser = Boolean(tender.createdByCurrentUser);
  const ownedByCurrentOrganization = Boolean(tender.ownedByCurrentOrganization ?? tender.createdByCurrentUser);
  const canBid = Boolean(tender.canBid ?? (isOpenStatus(tender.status) && !ownedByCurrentOrganization && !tender.hasSubmittedBid));
  const daysRemaining = getDaysRemaining(tender.closingDate);
  const detailUrl = ownedByCurrentOrganization ? `/procurement/tender-details?tenderId=${tender.id}` : `/procurement/supplier-tender-detail?tenderId=${tender.id}`;
  const bidLabel = tender.hasSubmittedBid ? 'Already Bid' : tender.hasDraftBid ? 'Continue Bid' : 'Bid';
  const saveDisabled = ownedByCurrentOrganization || isSaving;

  return (
    <article className={`procurement-tender-row market-row ${ownedByCurrentOrganization ? 'is-owned' : ''}`}>
      <div>
        <div className="tender-row-title">
          <strong>{tender.title}</strong>
          <span className="badge badge-info">{tender.reference}</span>
          <span className={`badge ${statusBadgeClass(tender.status)}`}>{formatStatus(tender.status)}</span>
          {createdByCurrentUser ? <span className="badge badge-info">Created by you</span> : null}
          {ownedByCurrentOrganization && !createdByCurrentUser ? <span className="badge badge-info">Your organization</span> : null}
          {tender.hasSubmittedBid ? <span className="badge badge-success">You already bid</span> : null}
          {tender.hasDraftBid && !tender.hasSubmittedBid ? <span className="badge badge-warning">Draft bid saved</span> : null}
        </div>
        <p>
          {tender.organization} / {formatTenderType(tender.type)} / Budget: {tender.currency} {tender.budget.toLocaleString()}
        </p>
        <span>{tender.description}</span>
        <div className="market-row-meta">
          <em>{tender.location}</em>
          <em>{daysRemaining === null ? 'Deadline not set' : daysRemaining < 0 ? 'Closed' : `${daysRemaining} days remaining`}</em>
        </div>
      </div>
      <div className="tender-row-actions">
        <button className="btn btn-secondary" type="button" disabled={saveDisabled} onClick={() => onToggleSaved(tender)}>
          {ownedByCurrentOrganization ? 'Own Org' : isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
        </button>
        <Link className={ownedByCurrentOrganization ? 'btn btn-primary' : 'btn btn-secondary'} to={detailUrl}>
          {createdByCurrentUser ? 'View My Tender' : ownedByCurrentOrganization ? 'View Org Tender' : 'View Tender'}
        </Link>
        {!ownedByCurrentOrganization ? (
          canBid ? (
            <button className="btn btn-primary" type="button" disabled={isOpeningBidDocument} onClick={() => onOpenBidDocument(tender)}>
              {isOpeningBidDocument ? 'Opening...' : bidLabel}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" disabled>
              {bidLabel}
            </button>
          )
        ) : (
          <button className="btn btn-primary" type="button" disabled>
            {createdByCurrentUser ? 'Your Tender' : 'Org Tender'}
          </button>
        )}
      </div>
    </article>
  );
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
    SERVICE: 'Services',
    CONSULTANCY: 'Consultancy'
  };
  return labels[value] || value;
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
  if (/draft|pending|evaluation|review/i.test(value)) return 'badge-warning';
  return 'badge-info';
}

function isOpenStatus(value: string) {
  return /^(open|published)$/i.test(value.trim());
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
