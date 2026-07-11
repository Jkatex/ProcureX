import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadTenderDocument, openTenderDocument } from '../../tenderDocumentActions';
import { useTenderDetail } from '../../hooks';
import type { TenderDetail, TenderDetailDocument } from '../../types';
import {
  CommercialTable,
  DetailBadges,
  DetailFieldCards,
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
  requirementCounts,
  tenderCategories
} from './TenderDetailPrototypeComponents';

export function SupplierTenderDetailProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);

  if (!tenderId) return <EmptyTenderDetail message="Open a tender from the marketplace to view its supplier tender pack." />;
  if (isLoading) return <EmptyTenderDetail message="Loading tender detail..." />;
  if (isError || !tender) return <EmptyTenderDetail message="Tender detail could not be loaded. Return to the marketplace and try again." />;

  const counts = requirementCounts(tender);
  const remainingDays = daysRemaining(tender.closingDate);
  const alreadyBid = tender.currentBid?.status === 'SUBMITTED' || tender.hasSubmittedBid;
  const canBid = Boolean(tender.canBid ?? (!tender.ownedByCurrentOrganization && !alreadyBid));
  const bidUrl = `/bidding?tenderId=${tender.id}`;
  const handleDownloadDocument = async (document?: TenderDetailDocument) => {
    if (isPreparingDownload) return;
    setIsPreparingDownload(true);
    try {
      await downloadTenderDocument(tender, document);
    } catch (error) {
      console.error('Tender document download failed', error);
    } finally {
      setIsPreparingDownload(false);
    }
  };
  const handleOpenDocument = (document?: TenderDetailDocument) => {
    void openTenderDocument(tender, document, 'documents').catch((error) => {
      console.error('Tender document open failed', error);
    });
  };

  return (
    <div className="procurement-app-page supplier-tender-detail-page">
      <div className="main-layout">
        <aside className="sidebar">
          <div style={{ padding: '0 16px 20px' }}>
            <h3>Tender Detail</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Supplier view</div>
          </div>
          <ul className="sidebar-nav">
            <li><Link to="/procurement/marketplace">Marketplace</Link></li>
            <li><Link to="/communication">Communication Center</Link></li>
            <li><Link to={bidUrl}>Start Bid</Link></li>
            <li><Link to="/procurement/guide">Procurement Process Guide</Link></li>
            <li><Link to="/sign-in">Logout</Link></li>
          </ul>
        </aside>

        <main className="main-content">
          <div className="journey-page supplier-tender-detail-page" data-supplier-tender-detail data-tender-id={tender.id}>
            <section className="journey-hero compact">
              <div>
                <span className="badge badge-success">{formatStatus(tender.status)}</span>
                <h1>{tender.title}</h1>
                <p>{tender.organization}. Review the full tender, save it for later, ask clarifications, then start the bid only when ready.</p>
              </div>
              <div className="hero-action-stack supplier-detail-actions">
                {alreadyBid ? (
                  <Link className="btn btn-secondary supplier-detail-primary-action" to={bidUrl}>Open Submitted Bid</Link>
                ) : canBid ? (
                  <Link className="btn btn-primary supplier-detail-primary-action" to={bidUrl}>{tender.currentBid || tender.hasDraftBid ? 'Continue Bid' : 'Start Bid'}</Link>
                ) : (
                  <button className="btn btn-primary supplier-detail-primary-action" type="button" disabled>Bidding unavailable</button>
                )}
                <div className="supplier-detail-action-row">
                  <button className="btn btn-secondary" type="button" onClick={() => handleOpenDocument()}>Open Document</button>
                  <button className="btn btn-secondary" type="button" disabled={isPreparingDownload} onClick={() => void handleDownloadDocument()}>
                    {isPreparingDownload ? 'Preparing...' : 'Download Document'}
                  </button>
                </div>
                <div className="supplier-detail-action-row">
                  <button className="btn btn-secondary" type="button" disabled={tender.ownedByCurrentOrganization}>{tender.isSaved ? 'Saved' : 'Save Tender'}</button>
                  <Link className="btn btn-secondary" to={clarificationComposeUrl(tender)}>Ask clarification</Link>
                </div>
              </div>
            </section>

            <section className="journey-grid four-col">
              <Kpi label="Mandatory before bid" value={String(counts.mandatory)} />
              <Kpi label="Additional responses" value={String(counts.optional)} />
              <Kpi label="Time remaining" value={`${remainingDays}d`} />
              <Kpi label="Clarifications" value="0" />
            </section>

            <PrototypeTabs
              defaultTabId="procurement-details"
              tabs={[
                {
                  id: 'procurement-details',
                  label: 'Procurement details',
                  content: (
                    <SupplierProcurementDetails
                      tender={tender}
                      onOpenDocument={handleOpenDocument}
                      onDownloadDocument={(document) => void handleDownloadDocument(document)}
                    />
                  )
                },
                { id: 'questions-requirements', label: 'Questions and requirements', content: <SupplierQuestions tender={tender} /> },
                { id: 'complaints', label: 'Complaints', content: <SupplierComplaints /> },
                { id: 'monitoring-reporting', label: 'Monitoring and reporting', content: <SupplierMonitoring tender={tender} remainingDays={remainingDays} /> }
              ]}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function SupplierProcurementDetails({
  tender,
  onOpenDocument,
  onDownloadDocument
}: {
  tender: TenderDetail;
  onOpenDocument: (document: TenderDetailDocument) => void;
  onDownloadDocument: (document: TenderDetailDocument) => void;
}) {
  return (
    <div className="supplier-detail-procurement-document">
      <div className="supplier-detail-jump-nav">
        <span>Jump to</span>
        <div>
          <a href="#customer-information">Customer information</a>
          <a href="#purchase-information">Purchase information</a>
          <a href="#tender-documentation">Tender documentation</a>
          <a href="#documents">Documents</a>
        </div>
      </div>
      <section className="tender-document-view supplier-procurement-full-document">
        <header className="tender-document-cover">
          <div>
            <span className="section-kicker">Procurement details</span>
            <h2>{tender.title || 'Tender brief'}</h2>
            <p>{tender.description || 'Review the full procurement detail document before preparing a bid.'}</p>
          </div>
          <div className="tender-document-stamp">
            <strong>{formatStatus(tender.status || 'Open')}</strong>
            <span>{formatTenderType(tender.type || 'Tender')}</span>
          </div>
        </header>
        <CustomerInformation tender={tender} />
        <PurchaseInformation tender={tender} />
        <TenderDocumentation tender={tender} />
        <TenderDocuments tender={tender} onOpenDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
      </section>
    </div>
  );
}

function CustomerInformation({ tender }: { tender: TenderDetail }) {
  return (
    <TenderDocumentSection number="1" title="Customer Information" kicker="Procurement details" id="customer-information">
      <DetailSummary
        rows={[
          { label: 'Procuring entity', value: tender.organization },
          { label: 'Procurement type', value: formatTenderType(tender.type) },
          { label: 'Procurement method', value: tender.method || 'Open Tender' },
          { label: 'Visibility', value: formatStatus(tender.visibility || 'PUBLIC_MARKETPLACE') },
          { label: 'Location', value: tender.location },
          { label: 'Eligibility summary', value: tender.description }
        ]}
      />
      <div className="tender-document-categories">
        <span>Categories</span>
        <DetailBadges items={tenderCategories(tender)} />
      </div>
    </TenderDocumentSection>
  );
}

function PurchaseInformation({ tender }: { tender: TenderDetail }) {
  return (
    <TenderDocumentSection number="2" title="Purchase Information" kicker="Commercial scope" id="purchase-information">
      <DetailSummary
        rows={[
          { label: 'Tender title', value: tender.title },
          { label: 'Tender ID', value: tender.id },
          { label: 'Budget estimate', value: formatMoney(tender.budget, tender.currency) },
          { label: 'Commercial model', value: commercialModel(tender) },
          { label: 'Closing date', value: formatDate(tender.closingDate) }
        ]}
      />
      <div className="supplier-detail-section-block">
        <span className="section-kicker">Quantity schedule</span>
        <DetailValue value={tender.commercialItems ?? []} />
      </div>
      <div className="supplier-detail-section-block">
        <span className="section-kicker">BOQ / price schedule rows</span>
        <CommercialTable tender={tender} />
      </div>
      <div className="supplier-detail-section-block">
        <span className="section-kicker">Delivery requirements</span>
        <DetailValue value={(tender.requirements ?? {}).deliveryRequirements ?? (tender.requirements ?? {}).delivery ?? []} />
      </div>
    </TenderDocumentSection>
  );
}

function TenderDocumentation({ tender }: { tender: TenderDetail }) {
  return (
    <TenderDocumentSection number="3" title="Tender Documentation" kicker="Supplier submission requirements" id="tender-documentation">
      <div className="supplier-document-guide-intro">
        <strong>Submission guide</strong>
        <span>Use these grouped requirements to prepare the bid documents before opening the bidding workspace. Licenses, ordinary documents, CVs, and templates are separated so each upload is clear.</span>
      </div>
      <section className="supplier-detail-section-block">
        <span className="section-kicker">Requirements and evidence</span>
        <RequirementCards tender={tender} />
      </section>
      <section className="supplier-detail-section-block">
        <span className="section-kicker">Structured fields</span>
        <DetailFieldCards fields={tender.requirements ?? {}} />
      </section>
    </TenderDocumentSection>
  );
}

function TenderDocuments({
  tender,
  onOpenDocument,
  onDownloadDocument
}: {
  tender: TenderDetail;
  onOpenDocument: (document: TenderDetailDocument) => void;
  onDownloadDocument: (document: TenderDetailDocument) => void;
}) {
  return (
    <TenderDocumentSection number="4" title="Documents" kicker="Tender pack" id="documents">
      <DocumentCards tender={tender} onViewDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
    </TenderDocumentSection>
  );
}

function SupplierQuestions({ tender }: { tender: TenderDetail }) {
  return (
    <PrototypeTabs
      defaultTabId="clarifications"
      tabs={[
        {
          id: 'clarifications',
          label: 'Clarifications',
          content: (
            <TenderDocumentSection number="1" title="Clarifications" kicker="Questions and requirements">
              <div className="clarification-deadline-card">
                <div>
                  <span className="section-kicker">Clarification deadline</span>
                  <strong>{formatDate(tender.closingDate)}</strong>
                  <p>Supplier clarification messages are tracked in the communication center and linked to this tender record.</p>
                </div>
                <Link className="btn btn-secondary" to={clarificationComposeUrl(tender)}>Ask clarification</Link>
              </div>
            </TenderDocumentSection>
          )
        },
        {
          id: 'public-qa',
          label: 'Public Q&A',
          content: <TenderDocumentSection number="2" title="Public Q&A" kicker="Published buyer responses"><div className="scope-empty">No public clarifications have been published yet.</div></TenderDocumentSection>
        },
        {
          id: 'amendments',
          label: 'Published Amendments',
          content: <TenderDocumentSection number="3" title="Published Amendments" kicker="Tender addenda"><div className="scope-empty">No amendments have been published yet.</div></TenderDocumentSection>
        }
      ]}
    />
  );
}

function SupplierComplaints() {
  return (
    <PrototypeTabs
      defaultTabId="submit-complaint"
      tabs={[
        { id: 'submit-complaint', label: 'Submit Complaint', content: <TenderDocumentSection number="1" title="Submit Complaint" kicker="Supplier remedy"><div className="scope-empty">Complaint submission is not connected in this workspace yet.</div></TenderDocumentSection> },
        { id: 'complaint-history', label: 'Complaint History', content: <TenderDocumentSection number="2" title="Complaint History" kicker="Records"><div className="scope-empty">No complaints submitted yet.</div></TenderDocumentSection> },
        { id: 'complaint-status', label: 'Complaint Status', content: <TenderDocumentSection number="3" title="Complaint Status" kicker="Buyer/admin response"><div className="scope-empty">No complaints submitted yet.</div></TenderDocumentSection> }
      ]}
    />
  );
}

function SupplierMonitoring({ tender, remainingDays }: { tender: TenderDetail; remainingDays: number }) {
  return (
    <PrototypeTabs
      defaultTabId="timeline"
      tabs={[
        { id: 'timeline', label: 'Tender Timeline', content: <TenderDocumentSection number="1" title="Tender Timeline" kicker="Monitoring"><TimelineList tender={tender} /></TenderDocumentSection> },
        { id: 'milestones', label: 'Milestones', content: <TenderDocumentSection number="2" title="Milestones" kicker="Key dates"><DetailValue value={tender.milestones ?? []} /></TenderDocumentSection> },
        {
          id: 'evaluation-status',
          label: 'Evaluation Status',
          content: (
            <TenderDocumentSection number="3" title="Evaluation Status" kicker="Published criteria">
              <DetailSummary rows={[{ label: 'Time remaining', value: `${remainingDays}d` }, { label: 'Bid state', value: tender.currentBid?.status || 'Not started' }, { label: 'Evaluation', value: 'Pending tender close' }]} />
            </TenderDocumentSection>
          )
        }
      ]}
    />
  );
}

function EmptyTenderDetail({ message }: { message: string }) {
  return (
    <div className="procurement-app-page supplier-tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Supplier tender detail</span>
            <h1>Tender detail</h1>
            <p>{message}</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-secondary" to="/procurement/marketplace">Marketplace</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function commercialModel(tender: TenderDetail) {
  if (/works/i.test(tender.type)) return 'Bill of Quantities';
  if (/consultancy/i.test(tender.type)) return 'Financial Proposal';
  if (/service|non consultancy/i.test(tender.type)) return 'Service Commercial Schedule';
  return 'Quantity Schedule';
}

function clarificationComposeUrl(tender: TenderDetail) {
  const params = new URLSearchParams({
    view: 'compose',
    mode: 'clarification',
    tenderId: tender.id,
    tenderReference: tender.reference,
    tenderTitle: tender.title,
    recipientName: tender.organization,
    buyerName: tender.organization,
    category: 'Clarification',
    subject: 'Seeking clarification'
  });

  if (tender.buyerOrgId) params.set('recipientOrgId', tender.buyerOrgId);
  return `/communication?${params.toString()}`;
}
