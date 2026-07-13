import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SupplierProcurementDetails } from '@/features/procurement/components/procurex/SupplierTenderDetailProcurexPage';
import { downloadTenderDocument, openTenderDocument } from '@/features/procurement/tenderDocumentActions';
import { procurementApi } from '@/features/procurement/api';
import type { TenderReviewDetail, TenderReviewListResponse, TenderReviewQueueItem } from '@/features/procurement/types';
import { SignatureKeyphraseModal } from '@/shared/components/SignatureKeyphraseModal';
import type { TenderDetailDocument, TenderReviewDetail, TenderReviewListResponse, TenderReviewQueueItem } from '@/features/procurement/types';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminError, AdminHero, AdminPanel, AdminShell, badgeClass, displayLabel, formatDate } from './AdminShared';

const pageSize = 1000;

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
  const { tenderId = '' } = useParams();
  useBodyPageMetadata('admin-tender-review');

  if (tenderId) return <TenderReviewDetailPage tenderId={tenderId} />;
  return <TenderReviewQueuePage />;
}

function TenderReviewQueuePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [queue, setQueue] = useState<TenderReviewListResponse>(emptyQueue);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const notice = searchParams.get('reviewNotice') ?? '';

  const loadQueue = useCallback(async (nextSearch = submittedSearch) => {
    setLoading(true);
    setError(null);
    try {
      const response = await procurementApi.listTenderReviews({
        search: nextSearch.trim() || undefined,
        page: 1,
        pageSize
      });
      setQueue(response);
    } catch (caught) {
      setQueue(emptyQueue);
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [submittedSearch]);

  useEffect(() => {
    void loadQueue(submittedSearch);
  }, [loadQueue, submittedSearch]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function openTender(item: TenderReviewQueueItem) {
    navigate(`/admin/tender-review/${item.id}`);
  }

  return (
    <AdminShell currentPath="/admin/tender-review" title="Tender Review">
      <AdminHero
        badge="Admin review"
        heading="Tender Review"
        body="Review submitted tenders before they become visible in the marketplace."
        actions={
          <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void loadQueue(submittedSearch)}>
            Refresh
          </button>
        }
      />

      {notice ? (
        <section className="admin-tender-review-notice">
          <strong>{notice}</strong>
        </section>
      ) : null}
      {error ? <AdminError error={error} title="Tender review could not load" /> : null}

      <section className="admin-tender-review-queue-panel">
        <div className="admin-tender-review-queue-header">
          <strong>
            <span className="admin-tender-review-count-badge" aria-label={`${queue.total} tenders in review queue`}>
              {queue.total}
            </span>
            Review queue
          </strong>
        </div>
        <form className="admin-tender-review-toolbar" onSubmit={submitSearch}>
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
        <div className="admin-tender-review-list">
          {loading ? (
            <div className="admin-tender-review-empty">
              <strong>Loading tenders...</strong>
            </div>
          ) : queue.items.length ? (
            queue.items.map((item) => (
              <button
                className="admin-tender-review-row"
                type="button"
                key={item.id}
                onClick={() => openTender(item)}
              >
                <span className="admin-tender-review-cell admin-tender-review-cell-primary">
                  <em>Tender</em>
                  <strong className="admin-tender-review-reference">{item.reference}</strong>
                  <h3>{item.title}</h3>
                  <time>Submitted {formatDate(item.submittedAt)}</time>
                </span>
                <span className="admin-tender-review-cell">
                  <em>Buyer</em>
                  <strong>{item.buyerName}</strong>
                </span>
                <span className="admin-tender-review-cell">
                  <em>Type</em>
                  <strong>{item.type}</strong>
                </span>
                <span className="admin-tender-review-cell">
                  <em>Location</em>
                  <strong>{item.location}</strong>
                </span>
                <span className="admin-tender-review-cell">
                  <em>Budget</em>
                  <strong>{formatMoney(item.budget, item.currency)}</strong>
                </span>
                <span className="admin-tender-review-cell">
                  <em>Closing</em>
                  <strong>{formatDate(item.closingDate)}</strong>
                </span>
                <span className="admin-tender-review-cell admin-tender-review-status-cell">
                  <em>Status</em>
                  <span className={badgeClass(item.status)}>{displayLabel(item.status)}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="admin-tender-review-empty">
              <strong>No tenders are awaiting review.</strong>
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function TenderReviewDetailPage({ tenderId }: { tenderId: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TenderReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showPassSignature, setShowPassSignature] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await procurementApi.getTenderReview(tenderId));
    } catch (caught) {
      setDetail(null);
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function passTender(signatureKeyphrase?: string) {
    if (!detail) return;
    if (!signatureKeyphrase) {
      setShowPassSignature(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await procurementApi.passTenderReview(detail.id, { signatureKeyphrase });
      setShowPassSignature(false);
      navigate(`/admin/tender-review?reviewNotice=${encodeURIComponent(response.message)}`, { replace: true });
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
      <SignatureKeyphraseModal
        open={showPassSignature}
        title="Publish tender to marketplace"
        actionLabel="Pass review"
        isSubmitting={saving}
        onCancel={() => setShowPassSignature(false)}
        onConfirm={(signatureKeyphrase) => void passTender(signatureKeyphrase)}
      />
      <AdminHero
        badge="Admin review"
        heading="Tender Review"
        body="Review the submitted tender details before publication."
        actions={
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/admin/tender-review')}>
            Back to Review Queue
          </button>
        }
      />
      {error ? <AdminError error={error} title="Tender review could not load" /> : null}
      {loading ? (
        <AdminPanel title="Tender details" kicker="Review">
          <div className="admin-tender-review-empty">
            <strong>Loading tender details...</strong>
          </div>
        </AdminPanel>
      ) : detail ? (
        <TenderReviewDetailView tender={detail} saving={saving} onPass={() => void passTender()} onFail={failTender} />
      ) : (
        <AdminPanel title="Tender details" kicker="Review">
          <div className="admin-tender-review-empty">
            <strong>Tender review item was not found.</strong>
          </div>
        </AdminPanel>
      )}
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
  function handleOpenDocument(document: TenderDetailDocument) {
    void openTenderDocument(tender, document, 'documents').catch(() => window.alert(`Could not open ${document.name}.`));
  }

  function handleDownloadDocument(document: TenderDetailDocument) {
    void downloadTenderDocument(tender, document).catch(() => window.alert(`Could not download ${document.name}.`));
  }

  return (
    <div className="admin-tender-review-detail">
      <div className="admin-tender-review-summary admin-tender-review-detail-summary">
        <div><span>Buyer</span><strong>{tender.buyerName}</strong></div>
        <div><span>Type</span><strong>{tender.type}</strong></div>
        <div><span>Budget</span><strong>{formatMoney(tender.budget, tender.currency)}</strong></div>
        <div><span>Location</span><strong>{tender.location || 'Tanzania'}</strong></div>
        <div><span>Closing date</span><strong>{tender.closingDate || 'Not set'}</strong></div>
        <div><span>Submitted</span><strong>{formatDate(tender.submittedAt)}</strong></div>
        <div><span>Attempts</span><strong>{tender.reviewAttempts}</strong></div>
      </div>

      <div className="admin-tender-review-document-shell supplier-tender-detail-page">
        <SupplierProcurementDetails tender={tender} onOpenDocument={handleOpenDocument} onDownloadDocument={handleDownloadDocument} />
      </div>

      <div className="admin-tender-review-actions" aria-label="Tender review decision actions">
        <button
          className="btn admin-tender-review-pass"
          type="button"
          disabled={saving}
          onClick={onPass}
        >
          {saving ? 'Passing...' : 'Pass'}
        </button>
        <button
          className="btn admin-tender-review-fail"
          type="button"
          disabled={saving}
          onClick={onFail}
        >
          Fail
        </button>
      </div>
    </div>
  );
}

function formatMoney(value: number, currency = 'TZS') {
  return `${currency || 'TZS'} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}
