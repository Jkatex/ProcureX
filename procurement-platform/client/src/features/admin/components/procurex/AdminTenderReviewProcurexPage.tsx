import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { procurementApi } from '@/features/procurement/api';
import type { TenderReviewDetail, TenderReviewListResponse, TenderReviewQueueItem } from '@/features/procurement/types';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminError, AdminHero, AdminPanel, AdminShell, Pager, badgeClass, displayLabel, formatDate } from './AdminShared';

const pageSize = 30;

const emptyQueue: TenderReviewListResponse = {
  success: true,
  items: [],
  total: 0,
  page: 1,
  pageSize,
  totalPages: 1,
  generatedAt: ''
};

export function AdminTenderReviewProcurexPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queue, setQueue] = useState<TenderReviewListResponse>(emptyQueue);
  const [detail, setDetail] = useState<TenderReviewDetail | null>(null);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const selectedTenderId = searchParams.get('tenderId') ?? '';

  useBodyPageMetadata('admin-tender-review');

  const loadQueue = useCallback(async (nextPage = page, nextSearch = submittedSearch) => {
    setLoading(true);
    setError(null);
    try {
      const response = await procurementApi.listTenderReviews({
        search: nextSearch.trim() || undefined,
        page: nextPage,
        pageSize
      });
      setQueue(response);
      setPage(nextPage);
    } catch (caught) {
      setQueue(emptyQueue);
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [page, submittedSearch]);

  const loadDetail = useCallback(async (tenderId: string) => {
    if (!tenderId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await procurementApi.getTenderReview(tenderId));
    } catch (caught) {
      setDetail(null);
      setError(caught);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue(page, submittedSearch);
  }, [loadQueue, page, submittedSearch]);

  useEffect(() => {
    void loadDetail(selectedTenderId);
  }, [loadDetail, selectedTenderId]);

  const selectedQueueItem = useMemo(
    () => queue.items.find((item) => item.id === selectedTenderId) ?? null,
    [queue.items, selectedTenderId]
  );

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    setPage(1);
  }

  function openTender(item: TenderReviewQueueItem) {
    setNotice('');
    setSearchParams({ tenderId: item.id });
  }

  async function passTender() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    setNotice('');
    try {
      const response = await procurementApi.passTenderReview(detail.id);
      setNotice(response.message);
      setDetail(null);
      setSearchParams({});
      await loadQueue(1, submittedSearch);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  function failTender() {
    if (!detail) return;
    const params = new URLSearchParams({
      view: 'compose',
      reviewDecision: 'fail',
      reviewTenderId: detail.id,
      tenderId: detail.id,
      tenderReference: detail.reference,
      tenderTitle: detail.title,
      recipientOrgId: detail.buyerOrgId ?? '',
      recipientName: detail.buyerName,
      category: 'Tender Review',
      subject: 'Your tender has failed review',
      actionLabel: 'Amend Tender',
      actionRoute: `/procurement/create-tender?tenderId=${detail.id}`
    });
    navigate(`/admin/communication?${params.toString()}`);
  }

  return (
    <AdminShell currentPath="/admin/tender-review" title="Tender Review">
      <AdminHero
        badge="Admin review"
        heading="Tender Review"
        body="Review submitted tenders before they become visible in the marketplace."
        actions={
          <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void loadQueue(page, submittedSearch)}>
            Refresh
          </button>
        }
      />

      {notice ? (
        <section className="communication-context-panel communication-context-panel-primary">
          <strong>{notice}</strong>
        </section>
      ) : null}
      {error ? <AdminError error={error} title="Tender review could not load" /> : null}

      <section className="communication-shell">
        <aside className="communication-folders">
          <div className="communication-folder-title">
            <strong>Review queue</strong>
            <span>{queue.total} awaiting review</span>
          </div>
          <form className="communication-toolbar" onSubmit={submitSearch}>
            <input
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, reference, buyer, category"
            />
            <button className="btn btn-secondary btn-sm" type="submit">
              Search
            </button>
          </form>
          <div className="communication-list">
            {loading ? (
              <div className="communication-detail empty">
                <strong>Loading tenders...</strong>
              </div>
            ) : queue.items.length ? (
              queue.items.map((item) => (
                <button
                  className={`communication-row ${selectedTenderId === item.id ? 'active' : ''}`}
                  type="button"
                  key={item.id}
                  onClick={() => openTender(item)}
                >
                  <span className="communication-row-main">
                    <span className="communication-row-top">
                      <strong>{item.reference}</strong>
                      <time>{formatDate(item.submittedAt)}</time>
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.buyerName}</p>
                    <span className="communication-row-meta">
                      <span>{item.type}</span>
                      <span>{formatMoney(item.budget, item.currency)}</span>
                    </span>
                  </span>
                  <span className="communication-row-badges">
                    <span className={badgeClass(item.status)}>{displayLabel(item.status)}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="communication-detail empty">
                <strong>No tenders are awaiting review.</strong>
              </div>
            )}
          </div>
          <Pager page={page} total={queue.total} pageSize={pageSize} onPage={(nextPage) => setPage(nextPage)} />
        </aside>

        <div className="communication-main">
          {detailLoading ? (
            <AdminPanel title="Tender details" kicker="Review">
              <div className="communication-detail empty">
                <strong>Loading tender details...</strong>
              </div>
            </AdminPanel>
          ) : detail ? (
            <TenderReviewDetailView tender={detail} saving={saving} onPass={() => void passTender()} onFail={failTender} />
          ) : (
            <AdminPanel title="Tender details" kicker="Review">
              <div className="communication-detail empty">
                <strong>{selectedQueueItem ? 'Open tender details' : 'Select a tender from the queue.'}</strong>
              </div>
            </AdminPanel>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function TenderReviewDetailView({
  tender,
  saving,
  onPass,
  onFail
}: {
  tender: TenderReviewDetail;
  saving: boolean;
  onPass: () => void;
  onFail: () => void;
}) {
  return (
    <AdminPanel title={tender.title} kicker={tender.reference} badge={tender.status}>
      <div className="record-summary compact">
        <div><span>Buyer</span><strong>{tender.buyerName}</strong></div>
        <div><span>Owner</span><strong>{tender.ownerName ?? 'Not assigned'}</strong></div>
        <div><span>Type</span><strong>{tender.type}</strong></div>
        <div><span>Budget</span><strong>{formatMoney(tender.budget, tender.currency)}</strong></div>
        <div><span>Location</span><strong>{tender.location || 'Tanzania'}</strong></div>
        <div><span>Closing date</span><strong>{tender.closingDate || 'Not set'}</strong></div>
        <div><span>Submitted</span><strong>{formatDate(tender.submittedAt)}</strong></div>
        <div><span>Attempts</span><strong>{tender.reviewAttempts}</strong></div>
      </div>

      <section className="communication-message-body">
        <span className="section-kicker">Description</span>
        <p>{tender.description || 'No description captured.'}</p>
      </section>

      <section className="communication-context-panel">
        <div className="record-summary compact">
          <div><span>Method</span><strong>{displayLabel(tender.method ?? '')}</strong></div>
          <div><span>Visibility</span><strong>{displayLabel(tender.visibility ?? '')}</strong></div>
          <div><span>Categories</span><strong>{(tender.categories ?? []).join(', ') || tender.category || 'Not categorized'}</strong></div>
          <div><span>Documents</span><strong>{tender.documents?.length ?? 0}</strong></div>
          <div><span>Requirements</span><strong>{tender.requirementRows?.length ?? 0}</strong></div>
          <div><span>Commercial items</span><strong>{tender.commercialItems?.length ?? 0}</strong></div>
        </div>
      </section>

      <section className="communication-context-panel">
        <span className="section-kicker">Requirements snapshot</span>
        <pre className="admin-json-preview">{JSON.stringify(tender.requirements ?? {}, null, 2)}</pre>
      </section>

      <div className="inline-actions">
        <button
          className="btn"
          type="button"
          disabled={saving}
          style={{ background: '#15803d', borderColor: '#15803d', color: '#ffffff' }}
          onClick={onPass}
        >
          {saving ? 'Passing...' : 'Pass'}
        </button>
        <button
          className="btn"
          type="button"
          disabled={saving}
          style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#ffffff' }}
          onClick={onFail}
        >
          Fail
        </button>
      </div>
    </AdminPanel>
  );
}

function formatMoney(value: number, currency = 'TZS') {
  return `${currency || 'TZS'} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}
