import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDocumentInput, BidDraftPayload, BidDto, BidReceiptDto } from '../../types';

type FinancialRow = {
  id: string;
  itemNo: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
};

const steps = ['Administrative Compliance', 'Technical Response', 'Financial Offer', 'Declarations', 'Review', 'Receipt'];

export function BiddingWorkspaceProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading: tenderLoading, isError } = useTenderDetail(tenderId);
  const [activeStep, setActiveStep] = useState(0);
  const [bid, setBid] = useState<BidDto | null>(null);
  const [receipt, setReceipt] = useState<BidReceiptDto | null>(null);
  const [status, setStatus] = useState('Loading bid workspace...');
  const [saving, setSaving] = useState(false);
  const [administrative, setAdministrative] = useState({ eligible: false, taxCompliant: false, authorized: false });
  const [technical, setTechnical] = useState({ approach: '', deliveryPlan: '', experience: '' });
  const [financialRows, setFinancialRows] = useState<FinancialRow[]>([]);
  const [declarations, setDeclarations] = useState({ confirmAccuracy: false, acceptTerms: false, noConflict: false });
  const [documents, setDocuments] = useState<BidDocumentInput[]>([]);

  useEffect(() => {
    if (!tender) return;
    setFinancialRows((current) => (current.length ? current : financialRowsFromTender(tender)));
  }, [tender]);

  useEffect(() => {
    if (!tenderId) {
      setStatus('Open a tender from the marketplace to prepare a bid.');
      return;
    }

    let mounted = true;
    biddingApi
      .getTenderDraft(tenderId)
      .then((draft) => {
        if (!mounted) return;
        if (draft) {
          hydrateDraft(draft);
          setBid(draft);
          setReceipt(draft.receipt ? { ...draft.receipt, bid: draft } : null);
          setActiveStep(draft.receipt ? 5 : 0);
          setStatus(draft.status === 'SUBMITTED' ? 'Submitted bid loaded.' : 'Draft bid loaded.');
        } else {
          setStatus('Ready to prepare a new sealed bid.');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setStatus('Sign in with bidding access to save and submit this bid.');
      });

    return () => {
      mounted = false;
    };
  }, [tenderId]);

  const totalAmount = useMemo(() => financialRows.reduce((sum, row) => sum + row.quantity * row.rate, 0), [financialRows]);
  const validationIssues = useMemo(() => buildValidationIssues(administrative, technical, financialRows, declarations), [administrative, technical, financialRows, declarations]);
  const completeness = useMemo(() => {
    const complete = 4 - validationIssues.length;
    return { percent: Math.max(0, Math.round((complete / 4) * 100)), sectionsComplete: complete, totalSections: 4 };
  }, [validationIssues]);

  function hydrateDraft(draft: BidDto) {
    const payload = draft.payload;
    setAdministrative({
      eligible: Boolean((payload.administrative as Record<string, unknown> | undefined)?.eligible),
      taxCompliant: Boolean((payload.administrative as Record<string, unknown> | undefined)?.taxCompliant),
      authorized: Boolean((payload.administrative as Record<string, unknown> | undefined)?.authorized)
    });
    setTechnical({
      approach: String((payload.technical as Record<string, unknown> | undefined)?.approach ?? ''),
      deliveryPlan: String((payload.technical as Record<string, unknown> | undefined)?.deliveryPlan ?? ''),
      experience: String((payload.technical as Record<string, unknown> | undefined)?.experience ?? '')
    });
    setDeclarations({
      confirmAccuracy: Boolean((payload.declarations as Record<string, unknown> | undefined)?.confirmAccuracy),
      acceptTerms: Boolean((payload.declarations as Record<string, unknown> | undefined)?.acceptTerms),
      noConflict: Boolean((payload.declarations as Record<string, unknown> | undefined)?.noConflict)
    });
    const rows = (payload.financial as Record<string, unknown> | undefined)?.items;
    if (Array.isArray(rows)) setFinancialRows(rows.map(normalizeFinancialRow));
    setDocuments(
      draft.documents.map((document) => ({
        name: document.name,
        documentType: document.documentType,
        envelope: document.envelope as BidDocumentInput['envelope'],
        checksum: document.checksum ?? undefined,
        metadata: document.metadata
      }))
    );
  }

  function draftPayload(): BidDraftPayload {
    return {
      administrative,
      technical,
      financial: { items: financialRows.map((row) => ({ ...row, total: row.quantity * row.rate })) },
      declarations,
      responses: [
        { requirementKey: 'technical-approach', response: { text: technical.approach } },
        { requirementKey: 'delivery-plan', response: { text: technical.deliveryPlan } },
        { requirementKey: 'experience', response: { text: technical.experience } }
      ].filter((item) => String(item.response.text || '').trim()),
      documents,
      totalAmount,
      currency: tender?.currency || 'TZS',
      completeness,
      validationIssues
    };
  }

  async function saveDraft() {
    if (!tenderId) return;
    setSaving(true);
    setStatus('Saving draft...');
    try {
      const saved = bid ? await biddingApi.updateBid(bid.id, draftPayload()) : await biddingApi.saveTenderDraft(tenderId, draftPayload());
      setBid(saved);
      setReceipt(saved.receipt ? { ...saved.receipt, bid: saved } : null);
      setStatus('Draft saved.');
    } catch (error) {
      setStatus(errorMessage(error, 'Draft could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitBid() {
    if (validationIssues.length) {
      setStatus(`Complete required sections before submitting: ${validationIssues.join(', ')}.`);
      setActiveStep(4);
      return;
    }
    setSaving(true);
    setStatus('Submitting sealed bid...');
    try {
      const saved = bid ? await biddingApi.updateBid(bid.id, draftPayload()) : tenderId ? await biddingApi.saveTenderDraft(tenderId, draftPayload()) : null;
      if (!saved) throw new Error('Tender id is missing.');
      const submitted = await biddingApi.submitBid(saved.id);
      setBid(submitted.bid);
      setReceipt(submitted);
      setActiveStep(5);
      setStatus('Bid submitted and receipt generated.');
    } catch (error) {
      setStatus(errorMessage(error, 'Bid could not be submitted.'));
    } finally {
      setSaving(false);
    }
  }

  async function withdrawBid() {
    if (!bid) return;
    setSaving(true);
    setStatus('Withdrawing submitted bid...');
    try {
      const withdrawn = await biddingApi.withdrawBid(bid.id);
      setBid(withdrawn);
      setStatus('Bid withdrawn. You can prepare a new bid before the deadline.');
      setActiveStep(0);
    } catch (error) {
      setStatus(errorMessage(error, 'Bid could not be withdrawn.'));
    } finally {
      setSaving(false);
    }
  }

  function addFiles(files: FileList | null, envelope: BidDocumentInput['envelope']) {
    if (!files) return;
    const next = Array.from(files).map((file): BidDocumentInput => ({
      name: file.name,
      documentType: envelope === 'FINANCIAL' ? 'FINANCIAL_OFFER' : envelope === 'TECHNICAL' ? 'TECHNICAL_PROPOSAL' : 'BID_DOCUMENT',
      envelope,
      metadata: {
        size: file.size,
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified
      }
    }));
    setDocuments((current) => [...current, ...next]);
  }

  if (!tenderId) return <WorkspaceEmpty message="Open a tender from the marketplace to start or continue a bid." />;
  if (tenderLoading) return <WorkspaceEmpty message="Loading tender..." />;
  if (isError || !tender) return <WorkspaceEmpty message="Tender could not be loaded. Return to the marketplace and try again." />;

  return (
    <div className="procurement-app-page bid-flow-page" data-bid-total={totalAmount}>
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Bidding workspace</span>
            <h1>{tender.title}</h1>
            <p>Prepare administrative confirmations, technical responses, commercial pricing, declarations, review validation, and submit a sealed bid receipt.</p>
          </div>
          <div className="hero-action-stack">
            <button className="btn btn-secondary" type="button" disabled={saving || bid?.status === 'SUBMITTED'} onClick={saveDraft}>
              Save Draft
            </button>
            {bid?.status === 'SUBMITTED' ? (
              <button className="btn btn-secondary" type="button" disabled={saving} onClick={withdrawBid}>
                Withdraw
              </button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={saving} onClick={submitBid}>
                Submit Bid
              </button>
            )}
          </div>
        </section>

        <section className="procurement-market-summary">
          <Kpi label="Tender" value={tender.reference} />
          <Kpi label="Status" value={bid ? formatStatus(bid.status) : 'Draft'} />
          <Kpi label="Completeness" value={`${completeness.percent}%`} />
          <Kpi label="Total" value={formatMoney(totalAmount, tender.currency)} />
        </section>

        <section className="wizard-shell">
          <aside className="wizard-rail">
            {steps.map((step, index) => (
              <button className={`wizard-rail-step ${index === activeStep ? 'active' : ''}`} type="button" key={step} onClick={() => setActiveStep(index)}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </button>
            ))}
          </aside>

          <main className="wizard-workspace">
            <div className="form-status">{status}</div>
            {activeStep === 0 ? (
              <StepPanel kicker="Step 01" title="Administrative Compliance" badge={`${documents.length} uploads`}>
                <div className="tender-detail-field-grid">
                  <CheckCard label="Confirm eligibility to participate" checked={administrative.eligible} onChange={(value) => setAdministrative((current) => ({ ...current, eligible: value }))} />
                  <CheckCard label="Confirm tax and statutory compliance" checked={administrative.taxCompliant} onChange={(value) => setAdministrative((current) => ({ ...current, taxCompliant: value }))} />
                  <CheckCard label="Confirm signatory authority" checked={administrative.authorized} onChange={(value) => setAdministrative((current) => ({ ...current, authorized: value }))} />
                </div>
                <UploadBox envelope="COMBINED" onFiles={addFiles} />
              </StepPanel>
            ) : null}

            {activeStep === 1 ? (
              <StepPanel kicker="Step 02" title="Technical Response" badge="Technical">
                <div className="form-grid">
                  <label>
                    <span>Technical approach</span>
                    <textarea className="form-input" rows={6} value={technical.approach} onChange={(event) => setTechnical((current) => ({ ...current, approach: event.target.value }))} />
                  </label>
                  <label>
                    <span>Delivery plan</span>
                    <textarea className="form-input" rows={6} value={technical.deliveryPlan} onChange={(event) => setTechnical((current) => ({ ...current, deliveryPlan: event.target.value }))} />
                  </label>
                  <label className="span-2">
                    <span>Relevant experience</span>
                    <textarea className="form-input" rows={4} value={technical.experience} onChange={(event) => setTechnical((current) => ({ ...current, experience: event.target.value }))} />
                  </label>
                </div>
                <UploadBox envelope="TECHNICAL" onFiles={addFiles} />
              </StepPanel>
            ) : null}

            {activeStep === 2 ? (
              <StepPanel kicker="Step 03" title="Financial Offer" badge={formatMoney(totalAmount, tender.currency)}>
                <div className="data-table tender-detail-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.itemNo}</td>
                          <td>{row.description}</td>
                          <td>
                            <input className="form-input" type="number" min="0" value={row.quantity} onChange={(event) => updateFinancialRow(row.id, 'quantity', Number(event.target.value))} />
                          </td>
                          <td>{row.unit}</td>
                          <td>
                            <input className="form-input" type="number" min="0" value={row.rate} onChange={(event) => updateFinancialRow(row.id, 'rate', Number(event.target.value))} />
                          </td>
                          <td>{formatMoney(row.quantity * row.rate, tender.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <UploadBox envelope="FINANCIAL" onFiles={addFiles} />
              </StepPanel>
            ) : null}

            {activeStep === 3 ? (
              <StepPanel kicker="Step 04" title="Declarations and Contract Terms" badge="Declarations">
                <div className="tender-detail-field-grid">
                  <CheckCard label="I confirm the bid is accurate and complete" checked={declarations.confirmAccuracy} onChange={(value) => setDeclarations((current) => ({ ...current, confirmAccuracy: value }))} />
                  <CheckCard label="I accept the tender and contract terms" checked={declarations.acceptTerms} onChange={(value) => setDeclarations((current) => ({ ...current, acceptTerms: value }))} />
                  <CheckCard label="I declare no conflict of interest" checked={declarations.noConflict} onChange={(value) => setDeclarations((current) => ({ ...current, noConflict: value }))} />
                </div>
              </StepPanel>
            ) : null}

            {activeStep === 4 ? (
              <StepPanel kicker="Step 05" title="Review Bid" badge={`${validationIssues.length} issues`}>
                <div className="record-summary tender-detail-summary">
                  <SummaryItem label="Administrative" value={administrative.eligible && administrative.taxCompliant && administrative.authorized ? 'Complete' : 'Incomplete'} />
                  <SummaryItem label="Technical responses" value={technical.approach.trim() && technical.deliveryPlan.trim() ? 'Complete' : 'Incomplete'} />
                  <SummaryItem label="Financial total" value={formatMoney(totalAmount, tender.currency)} />
                  <SummaryItem label="Documents" value={`${documents.length} metadata record${documents.length === 1 ? '' : 's'}`} />
                </div>
                {validationIssues.length ? (
                  <div className="scope-empty">Complete required sections before submitting: {validationIssues.join(', ')}.</div>
                ) : (
                  <div className="scope-empty">Bid package passes client validation and is ready for sealed submission.</div>
                )}
              </StepPanel>
            ) : null}

            {activeStep === 5 ? (
              <StepPanel kicker="Step 06" title="Receipt" badge={receipt ? 'Submitted' : 'No receipt'}>
                {receipt ? (
                  <div className="record-summary tender-detail-summary">
                    <SummaryItem label="Receipt reference" value={receipt.receiptRef} />
                    <SummaryItem label="Receipt hash" value={receipt.receiptHash} />
                    <SummaryItem label="Submitted" value={formatDate(receipt.createdAt)} />
                    <SummaryItem label="Bid reference" value={receipt.bid.reference} />
                  </div>
                ) : (
                  <div className="scope-empty">Submit the bid to generate a receipt.</div>
                )}
              </StepPanel>
            ) : null}
          </main>
        </section>
      </main>
    </div>
  );

  function updateFinancialRow(id: string, key: 'quantity' | 'rate', value: number) {
    setFinancialRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: Number.isFinite(value) ? value : 0 } : row)));
  }
}

function WorkspaceEmpty({ message }: { message: string }) {
  return (
    <div className="procurement-app-page bid-flow-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Bidding workspace</span>
            <h1>Bid submission</h1>
            <p>{message}</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-secondary" to="/procurement/marketplace">
              Marketplace
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function StepPanel({ kicker, title, badge, children }: { kicker: string; title: string; badge: string; children: React.ReactNode }) {
  return (
    <article className="journey-panel active">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span className="badge badge-info">{badge}</span>
      </div>
      {children}
    </article>
  );
}

function CheckCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="tender-detail-field-card">
      <span>{label}</span>
      <strong>{checked ? 'Confirmed' : 'Pending'}</strong>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function UploadBox({ envelope, onFiles }: { envelope: BidDocumentInput['envelope']; onFiles: (files: FileList | null, envelope: BidDocumentInput['envelope']) => void }) {
  return (
    <label className="supplier-requirement-preview">
      <span>{envelope} documents</span>
      <strong>Attach metadata record</strong>
      <input className="form-input" type="file" multiple onChange={(event) => onFiles(event.target.files, envelope)} />
    </label>
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function financialRowsFromTender(tender: TenderDetail): FinancialRow[] {
  const rows = tender.commercialItems ?? [];
  if (!rows.length) {
    return [{ id: 'line-1', itemNo: '1', description: tender.title, quantity: 1, unit: 'Lot', rate: 0 }];
  }
  return rows.map((row, index) => ({
    id: row.id,
    itemNo: row.itemNo || String(index + 1),
    description: row.description,
    quantity: Number(row.quantity || 1),
    unit: row.unit || 'Lot',
    rate: Number(row.rate || 0)
  }));
}

function normalizeFinancialRow(value: unknown, index: number): FinancialRow {
  const row = value && typeof value === 'object' ? (value as Partial<FinancialRow>) : {};
  return {
    id: String(row.id || `line-${index + 1}`),
    itemNo: String(row.itemNo || index + 1),
    description: String(row.description || 'Tender line item'),
    quantity: Number(row.quantity || 0),
    unit: String(row.unit || 'Lot'),
    rate: Number(row.rate || 0)
  };
}

function buildValidationIssues(
  administrative: { eligible: boolean; taxCompliant: boolean; authorized: boolean },
  technical: { approach: string; deliveryPlan: string; experience: string },
  financialRows: FinancialRow[],
  declarations: { confirmAccuracy: boolean; acceptTerms: boolean; noConflict: boolean }
) {
  const issues: string[] = [];
  if (!administrative.eligible || !administrative.taxCompliant || !administrative.authorized) issues.push('administrative confirmations');
  if (!technical.approach.trim() || !technical.deliveryPlan.trim()) issues.push('technical response');
  if (financialRows.reduce((sum, row) => sum + row.quantity * row.rate, 0) <= 0) issues.push('financial offer');
  if (!declarations.confirmAccuracy || !declarations.acceptTerms) issues.push('declarations');
  return issues;
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed);
}
