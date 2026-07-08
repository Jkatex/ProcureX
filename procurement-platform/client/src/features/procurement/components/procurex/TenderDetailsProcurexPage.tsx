import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { procurementApi } from '../../api';
import { useTenderDetail } from '../../hooks';
import type { TenderDetail } from '../../types';
import {
  CommercialTable,
  DetailBadges,
  DetailSummary,
  DetailValue,
  DocumentCards,
  PrototypeTabs,
  RequirementCards,
  TenderDocumentSection,
  TimelineList,
  daysRemaining,
  formatDate,
  formatMoney,
  formatStatus,
  formatTenderType,
  isPastTender,
  tenderCategories,
  tenderStatusBadgeClass
} from './TenderDetailPrototypeComponents';

export function TenderDetailsProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);
  const [isRecordingDownload, setIsRecordingDownload] = useState(false);

  if (!tenderId) return <BuyerEmpty message="Open one of your tenders from My Tenders to view buyer details." />;
  if (isLoading) return <BuyerEmpty message="Loading buyer tender detail..." />;
  if (isError || !tender) return <BuyerEmpty title="Tender not found" message="Return to My Tenders and choose an available tender." />;

  const remainingDays = daysRemaining(tender.closingDate);
  const past = isPastTender(tender);
  const interestedSuppliers = Math.max(tender.bidSummary?.total ?? 0, tender.hasDraftBid || tender.hasSubmittedBid ? 1 : 0);
  const marketplaceViews = activityValue(tender.activity?.marketplaceViews, 180 + interestedSuppliers * 22);
  const documentDownloads = activityValue(tender.activity?.documentDownloads, 45 + (tender.documents?.length ?? 0) * 11);
  const primaryDocumentId = tender.documents?.[0]?.id;
  const recordDownload = async () => {
    if (!primaryDocumentId || isRecordingDownload) return;
    setIsRecordingDownload(true);
    try {
      await procurementApi.recordTenderDocumentDownload(tender.id, primaryDocumentId);
    } finally {
      setIsRecordingDownload(false);
    }
  };

  return (
    <div className="procurement-app-page tender-detail-page">
      <div className="main-layout">
        <aside className="sidebar">
          <div style={{ padding: '0 16px 20px' }}>
            <h3>Tender Detail</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Buyer view</div>
          </div>
          <ul className="sidebar-nav">
            <li><Link to="/procurement/my-tenders">My Tenders</Link></li>
            <li><Link to="/communication">Communication Center</Link></li>
            <li><Link to="/evaluation">Evaluation</Link></li>
            <li><Link to="/procurement/marketplace">Marketplace</Link></li>
            <li><Link to="/sign-in">Logout</Link></li>
          </ul>
        </aside>

        <main className="main-content">
          <div className="journey-page buyer-tender-detail-page" data-buyer-tender-detail data-tender-id={tender.id}>
            <section className="journey-hero compact">
              <div>
                <span className={`badge ${tenderStatusBadgeClass(tender)}`}>{past ? 'Archived tender' : 'Active tender'}</span>
                <h1>{tender.title}</h1>
                <p>{tender.id} / {tender.organization}. Manage live tender interactions, amendments, supplier clarifications, and evaluation readiness.</p>
              </div>
              <div className="hero-action-stack">
                <button className="btn btn-secondary" type="button">Open Document</button>
                <button className="btn btn-secondary" type="button" disabled={isRecordingDownload || !primaryDocumentId} onClick={recordDownload}>
                  {isRecordingDownload ? 'Recording...' : 'Download Document'}
                </button>
                <button className="btn btn-secondary" type="button">Create Amendment</button>
                <Link className="btn btn-primary" to="/evaluation">Open Evaluation</Link>
              </div>
            </section>

            <section className="buyer-tender-status-list" aria-label="Tender activity summary">
              <article className="buyer-tender-status-row">
                <span>Marketplace views</span>
                <strong>{marketplaceViews}</strong>
              </article>
              <article className="buyer-tender-status-row">
                <span>Document downloads</span>
                <strong>{documentDownloads}</strong>
              </article>
              <article className="buyer-tender-status-row">
                <span>Time to close</span>
                <strong>{past ? 'Closed' : `${remainingDays}d`}</strong>
              </article>
            </section>

            <BuyerTabbedDetail tender={tender} remainingDays={remainingDays} past={past} />
            <BuyerAmendmentPlaceholder />
          </div>
        </main>
      </div>
    </div>
  );
}

function BuyerTabbedDetail({ tender, remainingDays, past }: { tender: TenderDetail; remainingDays: number; past: boolean }) {
  return (
    <PrototypeTabs
      variant="buyer"
      defaultTabId="procurement-details"
      tabs={[
        { id: 'procurement-details', label: 'Procurement details', content: <BuyerTenderDocument tender={tender} /> },
        { id: 'questions-amendments', label: 'Questions and amendments', content: <BuyerQuestions tender={tender} /> },
        { id: 'supplier-activity', label: 'Supplier activity', content: <BuyerSupplierActivity tender={tender} remainingDays={remainingDays} past={past} /> },
        { id: 'evaluation-records', label: 'Evaluation and records', content: <BuyerEvaluationAndRecords tender={tender} past={past} /> }
      ]}
    />
  );
}

function BuyerSupplierActivity({ tender, remainingDays, past }: { tender: TenderDetail; remainingDays: number; past: boolean }) {
  const submitted = tender.bidSummary?.submitted ?? 0;
  const draft = tender.bidSummary?.draft ?? 0;
  const supplierCount = tender.bidSummary?.total ?? submitted + draft;
  const clarificationCount: number = 0;
  const documentCount = tender.documents?.length ?? 0;
  const marketplaceViews = activityValue(tender.activity?.marketplaceViews, 180 + supplierCount * 22);
  const documentDownloads = activityValue(tender.activity?.documentDownloads, 45 + supplierCount * 11);
  return (
    <section className="buyer-tender-detail-rows">
      <article className="journey-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Marketplace activity</span>
            <h2>Supplier engagement</h2>
          </div>
          <span className="badge badge-info">{supplierCount} supplier{supplierCount === 1 ? '' : 's'}</span>
        </div>
        <DetailSummary rows={[{ label: 'Marketplace views', value: marketplaceViews }, { label: 'Document downloads', value: documentDownloads }, { label: 'Time to close', value: past ? 'Closed' : `${remainingDays}d` }]} />
        <div className="inbox-list">
          <div className="inbox-item">
            <div>
              <strong>Marketplace engagement</strong>
              <span>{supplierCount ? `${supplierCount} supplier${supplierCount === 1 ? '' : 's'} have shown aggregate activity.` : 'No supplier engagement recorded yet.'}</span>
            </div>
            <em>{marketplaceViews} views</em>
          </div>
          <div className="inbox-item">
            <div>
              <strong>Document interest</strong>
              <span>Tender documents have been accessed through the marketplace.</span>
            </div>
            <em>{documentDownloads} downloads</em>
          </div>
          <div className="inbox-item">
            <div>
              <strong>Clarification activity</strong>
              <span>Supplier questions are summarized without revealing individual supplier identities.</span>
            </div>
            <em>{clarificationCount} item{clarificationCount === 1 ? '' : 's'}</em>
          </div>
        </div>
      </article>

      <article className="journey-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Supplier questions</span>
            <h2>Activity requiring buyer attention</h2>
          </div>
          <span className="badge badge-warning">{clarificationCount} item{clarificationCount === 1 ? '' : 's'}</span>
        </div>
        <DetailSummary rows={[{ label: 'Clarifications', value: clarificationCount }, { label: 'Documents', value: documentCount }]} />
        <button className="btn btn-secondary" type="button">Create Amendment</button>
      </article>
    </section>
  );
}

function BuyerQuestions({ tender }: { tender: TenderDetail }) {
  return (
    <div className="journey-grid two-col">
      <article className="journey-panel control-panel">
        <span className="section-kicker">Clarifications</span>
        <h2>Supplier questions</h2>
        <p>No open clarification questions are awaiting buyer response.</p>
        <Link className="btn btn-secondary" to="/communication">Communication Center</Link>
      </article>
      <article className="journey-panel control-panel">
        <span className="section-kicker">Amendments</span>
        <h2>Addenda</h2>
        <p>Create structured amendments when requirements, documents, dates, or pricing instructions change.</p>
        <button className="btn btn-secondary" type="button">Create Amendment</button>
      </article>
      <article className="journey-panel control-panel">
        <span className="section-kicker">Tender dates</span>
        <h2>Deadline controls</h2>
        <DetailSummary rows={[{ label: 'Published', value: formatDate(tender.publishedAt || '') }, { label: 'Closing', value: formatDate(tender.closingDate) }]} compact />
      </article>
    </div>
  );
}

function BuyerEvaluationAndRecords({ tender, past }: { tender: TenderDetail; past: boolean }) {
  const submitted = tender.bidSummary?.submitted ?? 0;
  const draft = tender.bidSummary?.draft ?? 0;
  const withdrawn = tender.bidSummary?.withdrawn ?? 0;
  const readyForEvaluation = submitted > 0 && (past || /closed|evaluation|awarded/i.test(tender.status));
  return (
    <div className="buyer-tender-detail-rows">
      <section className="journey-grid three-col">
        <article className="journey-panel control-panel">
          <span className="section-kicker">Evaluation readiness</span>
          <h2>{readyForEvaluation ? 'Ready to evaluate' : 'Awaiting close'}</h2>
          <div className="progress-stack">
            <div>
              <span>Submission coverage</span>
              <strong>{submitted}</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, submitted * 25)}%` }} />
            </div>
            <p>{readyForEvaluation ? 'Evaluation can begin using the sealed submission summaries.' : 'Detailed bid contents remain sealed until the existing evaluation workflow opens them.'}</p>
          </div>
        </article>
        <article className="journey-panel control-panel">
          <span className="section-kicker">Bid summary</span>
          <h2>Sealed Bid Summary</h2>
          <DetailSummary rows={[{ label: 'Total bid records', value: tender.bidSummary?.total ?? 0 }, { label: 'Submitted', value: submitted }, { label: 'Draft supplier bids', value: draft }, { label: 'Withdrawn', value: withdrawn }, { label: 'Disclosure', value: 'Sealed until evaluation' }]} compact />
        </article>
        <article className="journey-panel control-panel">
          <span className="section-kicker">Evaluation workspace</span>
          <h2>Open evaluation</h2>
          <p>Use the evaluation workspace once the tender closes and submitted bids are ready for review.</p>
          <Link className="btn btn-primary" to="/evaluation">Open Evaluation</Link>
        </article>
      </section>

      <section className="journey-panel control-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Audit Trail</span>
            <h2>Lifecycle archive</h2>
          </div>
          <span className={`badge ${past ? 'badge-info' : 'badge-success'}`}>{past ? 'Archived' : 'Active'}</span>
        </div>
        <DetailSummary
          rows={[
            { label: 'Amendments', value: 0 },
            { label: 'Clarifications', value: 0 },
            { label: 'Tender reference', value: tender.reference },
            { label: 'Published', value: formatDate(tender.publishedAt || '') },
            { label: 'Closing', value: formatDate(tender.closingDate) },
            { label: 'Current status', value: formatStatus(tender.status) }
          ]}
          compact
        />
        <Link className="btn btn-secondary" to="/records-history">Open Records and History</Link>
      </section>
    </div>
  );
}

function BuyerTenderDocument({ tender }: { tender: TenderDetail }) {
  return (
    <div className="supplier-detail-procurement-document">
      <section className="tender-document-view supplier-procurement-full-document">
        <header className="tender-document-cover">
          <div>
            <span className="section-kicker">Tender document</span>
            <h2>{tender.title}</h2>
            <p>{tender.description || 'Review the structured tender information and supplier-facing pack.'}</p>
          </div>
          <div className="tender-document-stamp">
            <strong>{formatStatus(tender.status)}</strong>
            <span>{formatTenderType(tender.type)}</span>
          </div>
        </header>
        <TenderDocumentSection number="1" title="Customer Information" kicker="Procurement details">
          <DetailSummary rows={[{ label: 'Procuring entity', value: tender.organization }, { label: 'Tender reference', value: tender.reference }, { label: 'Procurement method', value: tender.method || 'Open Tender' }, { label: 'Location', value: tender.location }]} />
          <div className="tender-document-categories">
            <span>Categories</span>
            <DetailBadges items={tenderCategories(tender)} />
          </div>
        </TenderDocumentSection>
        <TenderDocumentSection number="2" title="Purchase Information" kicker="Commercial scope">
          <DetailSummary rows={[{ label: 'Budget estimate', value: formatMoney(tender.budget, tender.currency) }, { label: 'Closing date', value: formatDate(tender.closingDate) }, { label: 'Currency', value: tender.currency }]} />
          <CommercialTable tender={tender} priceLabel="Estimate" />
        </TenderDocumentSection>
        <TenderDocumentSection number="3" title="Requirements" kicker="Buyer requirements">
          <RequirementCards tender={tender} />
        </TenderDocumentSection>
        <TenderDocumentSection number="4" title="Documents" kicker="Tender pack">
          <DocumentCards tender={tender} />
        </TenderDocumentSection>
        <TenderDocumentSection number="5" title="Timeline" kicker="Monitoring">
          <TimelineList tender={tender} />
          <DetailValue value={tender.milestones ?? []} />
        </TenderDocumentSection>
      </section>
    </div>
  );
}

function BuyerAmendmentPlaceholder() {
  return (
    <section className="buyer-amendment-workspace" aria-label="Tender amendment workspace">
      <div className="buyer-amendment-card">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Tender amendment</span>
            <h2>Create structured amendment</h2>
          </div>
          <button className="btn btn-secondary" type="button">Close</button>
        </div>
        <div className="scope-empty">Amendment persistence is not connected yet. Use this workspace once the amendment backend is available.</div>
      </div>
    </section>
  );
}

function activityValue(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function BuyerEmpty({ message, title = 'Tender detail' }: { message: string; title?: string }) {
  return (
    <div className="procurement-app-page tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Buyer tender detail</span>
            <h1>{title}</h1>
            <p>{message}</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-secondary" to="/procurement/my-tenders">My Tenders</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
