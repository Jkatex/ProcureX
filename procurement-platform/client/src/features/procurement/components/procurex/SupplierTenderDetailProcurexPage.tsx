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
  formatDate,
  formatMoney,
  formatStatus,
  formatTenderType,
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
                  <Link className="btn btn-secondary" to={clarificationComposeUrl(tender)}>Ask for Clarification</Link>
                </div>
              </div>
            </section>

            <PrototypeTabs
              variant="supplierTender"
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
                {
                  id: 'clarification-buyer-notice',
                  label: 'Clarification and buyer notice',
                  content: <SupplierClarificationAndBuyerNotice tender={tender} />
                }
              ]}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export function SupplierProcurementDetails({
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

function SupplierClarificationAndBuyerNotice({ tender }: { tender: TenderDetail }) {
  const notice = buyerNoticeText(tender);
  return (
    <div className="supplier-clarification-notice-stack">
      <section className="journey-panel control-panel supplier-clarification-panel">
        <span className="section-kicker">Clarification</span>
        <h2>Ask for clarification</h2>
        <div className="supplier-clarification-action-card">
          <div>
            <p>Send your question through the communication center so it stays linked to this tender.</p>
          </div>
          <Link className="btn btn-secondary" to={clarificationComposeUrl(tender)}>Ask clarification</Link>
        </div>
      </section>

      <section className="journey-panel control-panel supplier-buyer-notice-panel">
        <span className="section-kicker">Buyer updates</span>
        <h2>Buyer notice</h2>
        {notice ? <p className="supplier-buyer-notice-text">{notice}</p> : <div className="scope-empty">No buyer notice has been published for this tender.</div>}
      </section>
    </div>
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

function commercialModel(tender: TenderDetail) {
  if (/works/i.test(tender.type)) return 'Bill of Quantities';
  if (/consultancy/i.test(tender.type)) return 'Financial Proposal';
  if (/service|non consultancy/i.test(tender.type)) return 'Service Commercial Schedule';
  return 'Quantity Schedule';
}

export function buyerNoticeText(tender: TenderDetail) {
  const metadata = tender.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const value = (metadata as Record<string, unknown>).buyerNotice;
  return typeof value === 'string' ? value.trim() : '';
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
