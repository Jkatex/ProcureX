/* Renders the public Guest Marketplace ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarketplaceCategoryGrid, PublicTenderRowCard } from '@/features/procurement/components/MarketplaceComponents';
import { useMarketplaceData } from '@/features/procurement/hooks';
import { isActiveMarketplaceTender } from '@/features/procurement/marketplaceTenderVisibility';
import type { MarketplaceTenderRow } from '@/features/procurement/types';

export function GuestMarketplaceProcurexPage() {
  const { data, isLoading, isError } = useMarketplaceData();
  const [selectedType, setSelectedType] = useState('');
  const [marketplaceNow, setMarketplaceNow] = useState(() => Date.now());

  useEffect(() => {
    const previousPage = document.body.dataset.page;
    document.body.dataset.page = 'guest-marketplace';
    document.body.dataset.procurexReactPage = 'true';

    return () => {
      if (previousPage) document.body.dataset.page = previousPage;
      else delete document.body.dataset.page;
      delete document.body.dataset.procurexReactPage;
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    const nextTransition = (data?.tenders ?? []).reduce<number | null>((nearest, tender) => {
      const times = [marketplaceTransitionTime(tender.openingDate, 'start'), marketplaceTransitionTime(tender.closingDate, 'end')];
      const nextTime = times.reduce<number | null>((candidate, time) => {
        if (!Number.isFinite(time) || time <= now) return candidate;
        return candidate === null || time < candidate ? time : candidate;
      }, null);
      if (nextTime === null) return nearest;
      return nearest === null || nextTime < nearest ? nextTime : nearest;
    }, null);

    if (nextTransition === null) return undefined;

    const timer = window.setTimeout(
      () => setMarketplaceNow(Date.now()),
      Math.min(Math.max(nextTransition - now, 0), 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [data?.tenders, marketplaceNow]);

  const publicTenders = useMemo(() => {
    return sortTendersByDeadline((data?.tenders ?? []).filter((tender) => isActiveMarketplaceTender(tender, marketplaceNow)));
  }, [data?.tenders, marketplaceNow]);

  const visibleTenders = useMemo(() => {
    const selected = normalizeTenderTypeFilter(selectedType);
    if (!selected) return publicTenders;
    return publicTenders.filter((tender) => normalizeTenderTypeFilter(tender.type) === selected);
  }, [publicTenders, selectedType]);

  const totalBudget = publicTenders.reduce((sum, tender) => sum + tender.budget, 0);
  const currency = publicTenders[0]?.currency || 'TZS';

  return (
    <div className="guest-marketplace-v2" data-marketplace-root>
      <header className="app-topbar-public">
        <div className="app-topbar-public-inner">
          <Link className="brand" to="/" aria-label="ProcureX home">
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span className="brand-text">ProcureX</span>
          </Link>
          <div className="guest-topbar-actions">
            <Link className="btn btn-secondary" to="/">
              Home
            </Link>
            <Link className="btn btn-primary" to="/register">
              Create Account
            </Link>
          </div>
        </div>
      </header>

      <main className="guest-market-shell-v2">
        <section className="marketplace-hero guest-market-hero">
          <div className="guest-hero-copy">
            <h2>Find open public tenders.</h2>
            <p>Browse published opportunities, compare buyer requirements, review deadlines, and sign in when you are ready to view full tender packs or submit a secure bid.</p>
          </div>
          <div className="guest-hero-auth-panel">
            <Link className="btn btn-primary" to="/sign-in">
              Sign In to Bid
            </Link>
            <p>
              Don't have an account? <Link to="/register">Create account</Link>
            </p>
          </div>
        </section>

        <section className="procurement-market-summary guest-market-summary" aria-label="Marketplace summary">
          <article className="kpi-card">
            <div className="kpi-value">{publicTenders.length}</div>
            <div className="kpi-label">Open tenders</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-value">{formatCompactCurrency(totalBudget, currency)}</div>
            <div className="kpi-label">Total budget value</div>
          </article>
        </section>

        <MarketplaceCategoryGrid tenders={publicTenders} selectedType={selectedType} onSelectType={setSelectedType} />

        <section className="procurement-list-panel guest-list-panel">
          <div className="panel-heading">
            <div>
              <h2>Open opportunities</h2>
            </div>
          </div>

          {isLoading ? <div className="scope-empty">Loading public tenders...</div> : null}
          {isError ? <div className="scope-empty">Public tenders could not be loaded. Try refreshing the page.</div> : null}

          <div className="procurement-tender-list market-list guest-tender-list">
            {!isLoading && !isError && visibleTenders.length ? (
              visibleTenders.map((tender) => <PublicTenderRowCard key={tender.id} tender={tender} />)
            ) : !isLoading && !isError ? (
              <div className="scope-empty">No public open tenders match this filter right now.</div>
            ) : null}
          </div>
        </section>

        <section className="guest-final-cta-panel">
          <strong>Your next big contract starts here. Join today and start winning.</strong>
          <Link to="/register">Create Your Free Account →</Link>
        </section>
      </main>
    </div>
  );
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

function sortTendersByDeadline(rows: MarketplaceTenderRow[]) {
  return [...rows].sort((a, b) => tenderDeadlineTime(a) - tenderDeadlineTime(b) || a.title.localeCompare(b.title));
}

function tenderDeadlineTime(tender: MarketplaceTenderRow) {
  const parsed = marketplaceTransitionTime(tender.closingDate, 'end');
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function marketplaceTransitionTime(value: string | undefined, boundary: 'start' | 'end') {
  if (!value) return Number.NaN;
  const normalized = value.trim();
  const withBoundary = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? `${normalized}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`
    : normalized;
  return Date.parse(withBoundary);
}

function formatCompactCurrency(value: number, currency: string) {
  if (value >= 1_000_000_000) return `${currency} ${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${currency} ${value.toLocaleString('en-US')}`;
}
