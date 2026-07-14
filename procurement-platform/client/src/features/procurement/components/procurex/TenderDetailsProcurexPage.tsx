import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '@/features/awardsContracts/api';
import { downloadTenderDocument, openTenderDocument } from '../../tenderDocumentActions';
import { useTenderDetail } from '../../hooks';
import { procurementApi } from '../../api';
import type { TenderDetail, TenderDetailDocument } from '../../types';
import {
  DetailSummary,
  PrototypeTabs,
  formatDate
} from './TenderDetailPrototypeComponents';
import { SupplierProcurementDetails, buyerNoticeText } from './SupplierTenderDetailProcurexPage';

export function TenderDetailsProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);

  if (!tenderId) return <BuyerEmpty message="Open one of your tenders from My Tenders to view buyer details." />;
  if (isLoading) return <BuyerEmpty message="Loading buyer tender detail..." />;
  if (isError || !tender) return <BuyerEmpty title="Tender not found" message="Return to My Tenders and choose an available tender." />;

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
                <h1>{tender.title}</h1>
                <p>{tender.organization}. View the supplier-facing tender information and manage tender activity.</p>
              </div>
              <div className="hero-action-stack buyer-detail-actions">
                <div className="buyer-detail-action-row">
                  <button className="btn btn-secondary" type="button" onClick={() => handleOpenDocument()}>Open Document</button>
                  <button className="btn btn-secondary" type="button" disabled={isPreparingDownload} onClick={() => void handleDownloadDocument()}>
                    {isPreparingDownload ? 'Preparing...' : 'Download Document'}
                  </button>
                </div>
              </div>
            </section>

            <PrototypeTabs
              variant="buyer"
              defaultTabId="procurement-details"
              tabs={[
                {
                  id: 'procurement-details',
                  label: 'Procurement details',
                  content: (
                    <section className="buyer-tender-section" aria-label="Procurement details">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Supplier-facing view</span>
                          <h2>Procurement details</h2>
                        </div>
                      </div>
                      <SupplierProcurementDetails
                        tender={tender}
                        onOpenDocument={handleOpenDocument}
                        onDownloadDocument={(document) => void handleDownloadDocument(document)}
                      />
                    </section>
                  )
                },
                {
                  id: 'tender-activity',
                  label: 'Tender activity',
                  content: <BuyerTenderActivity tender={tender} />
                }
              ]}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function BuyerTenderActivity({ tender }: { tender: TenderDetail }) {
  const navigate = useNavigate();
  const summary = tender.bidSummary ?? { total: 0, draft: 0, submitted: 0, withdrawn: 0 };
  const clarificationInquiries = tender.clarificationInquiries ?? [];
  const [notice, setNotice] = useState(() => buyerNoticeText(tender));
  const [savedNotice, setSavedNotice] = useState(() => buyerNoticeText(tender));
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  async function saveBuyerNotice() {
    setIsSavingNotice(true);
    setNoticeMessage('');
    try {
      const result = await procurementApi.updateBuyerNotice(tender.id, notice);
      setNotice(result.data.buyerNotice);
      setSavedNotice(result.data.buyerNotice);
      setNoticeMessage('Buyer notice saved for bidders.');
    } catch {
      setNoticeMessage('Buyer notice could not be saved. Try again.');
    } finally {
      setIsSavingNotice(false);
    }
  }

  async function removeBuyerNotice() {
    setIsSavingNotice(true);
    setNoticeMessage('');
    try {
      const result = await procurementApi.updateBuyerNotice(tender.id, '');
      setNotice(result.data.buyerNotice);
      setSavedNotice(result.data.buyerNotice);
      setNoticeMessage('Buyer notice removed for bidders.');
    } catch {
      setNoticeMessage('Buyer notice could not be removed. Try again.');
    } finally {
      setIsSavingNotice(false);
    }
  }
  const [isPreparingContract, setIsPreparingContract] = useState(false);
  const [contractMessage, setContractMessage] = useState('');
  const canPrepareContract = buyerCanPrepareContract(tender);

  async function prepareContract() {
    if (isPreparingContract || !canPrepareContract) return;
    setIsPreparingContract(true);
    setContractMessage('');
    try {
      const contract = await awardsContractsApi.prepareTenderContract(tender.id);
      navigate(`/awards-contracts/negotiation?contract=${contract.id}&step=clauses`);
    } catch (error) {
      setContractMessage(apiErrorMessage(error, 'Contract preparation could not be opened.'));
    } finally {
      setIsPreparingContract(false);
    }
  }

  return (
    <section className="buyer-tender-section buyer-tender-activity" aria-label="Tender activity">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Tender activity</span>
          <h2>Tender activity</h2>
        </div>
      </div>
      <div className="journey-grid two-col buyer-activity-grid">
        <article className="journey-panel control-panel">
          <span className="section-kicker">Bid summary</span>
          <h3>Bid summary</h3>
          <DetailSummary
            rows={[
              { label: 'Submitted bids', value: summary.submitted },
              { label: 'Draft bids', value: summary.draft },
              { label: 'Days remaining until tender closes', value: daysRemainingUntil(tender.closingDate) }
            ]}
            compact
          />
        </article>

        <article className="journey-panel control-panel">
          <span className="section-kicker">Clarification inquiries</span>
          <h3>Clarification inquiries</h3>
          <div className="inbox-list buyer-clarification-list">
            {clarificationInquiries.length ? (
              clarificationInquiries.map((message) => (
                <Link
                  className={`inbox-item buyer-clarification-link ${message.read ? 'is-read' : 'is-unread'}`}
                  key={message.id}
                  to={`/communication?view=message&id=${message.id}`}
                >
                  <div>
                    <strong>{message.subject}</strong>
                    <span className="buyer-clarification-sender">{message.senderName ?? 'Supplier'}</span>
                    <span className="buyer-clarification-body">{message.body}</span>
                  </div>
                  <em>{formatDate(message.createdAt)}</em>
                </Link>
              ))
            ) : (
              <div className="scope-empty">No clarification inquiries are linked to this tender yet.</div>
            )}
          </div>
        </article>

        <article className="journey-panel control-panel buyer-notice-panel">
          <span className="section-kicker">Buyer notice</span>
          <h3>Buyer notice</h3>
          <p>Write a bidder-facing note that should be shown in the supplier tender view.</p>
          <textarea
            className="form-input"
            aria-label="Buyer notice"
            value={notice}
            onChange={(event) => {
              setNotice(event.target.value);
              setNoticeMessage('');
            }}
            placeholder="Write an update for all bidders..."
          />
          <div className="buyer-notice-actions">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={isSavingNotice}
              onClick={() => void saveBuyerNotice()}
            >
              {isSavingNotice ? 'Saving...' : 'Save notice'}
            </button>
            {savedNotice ? (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={isSavingNotice}
                onClick={() => void removeBuyerNotice()}
              >
                Remove notice
              </button>
            ) : null}
          </div>
          {noticeMessage ? <span className="tender-detail-muted" aria-live="polite">{noticeMessage}</span> : null}
        </article>

        <article className="journey-panel control-panel">
          <span className="section-kicker">Contract preparation</span>
          <h3>Prepare contract</h3>
          <p>Prepare contract clauses, document versions, and amendment notes before evaluation results are ready.</p>
          <button className="btn btn-secondary" type="button" disabled={!canPrepareContract || isPreparingContract} onClick={() => void prepareContract()}>
            {isPreparingContract ? 'Opening...' : 'Prepare contract'}
          </button>
          {contractMessage ? <span className="tender-detail-muted">{contractMessage}</span> : null}
        </article>

        <article className="journey-panel control-panel">
          <span className="section-kicker">Make amendment</span>
          <h3>Make amendment</h3>
          <p>Use an amendment when tender requirements, dates, documents, or pricing instructions need to change.</p>
          <button className="btn btn-secondary" type="button" disabled>
            Make amendment
          </button>
        </article>

        <article className="journey-panel control-panel">
          <span className="section-kicker">Cancel tender</span>
          <h3>Cancel tender</h3>
          <p>Cancel only when the procurement should be withdrawn from marketplace activity.</p>
          <button className="btn btn-secondary" type="button" disabled>
            Cancel tender
          </button>
        </article>
      </div>
    </section>
  );
}

function buyerCanPrepareContract(tender: TenderDetail) {
  const status = String(tender.status || '').toUpperCase();
  return Boolean(tender.ownedByCurrentOrganization) && ['PUBLISHED', 'OPEN', 'EVALUATION'].includes(status);
}

function daysRemainingUntil(closingDate: string) {
  const closingTime = new Date(closingDate.includes('T') ? closingDate : `${closingDate}T23:59:59.999Z`).getTime();
  if (!Number.isFinite(closingTime)) return 'Not set';
  return Math.max(0, Math.ceil((closingTime - Date.now()) / 86_400_000));
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
