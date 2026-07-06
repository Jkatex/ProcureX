import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDocumentInput, BidDraftPayload, BidDto, BidReceiptDto } from '../../types';

type WorkflowType = 'goods' | 'works' | 'services' | 'consultancy' | 'generic';
type Envelope = NonNullable<BidDocumentInput['envelope']>;

type PriceRow = {
  id: string;
  itemNo: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  taxIncluded: boolean;
  discount: number;
};

type BidFormState = {
  administrative: Record<string, unknown>;
  technical: Record<string, unknown>;
  financial: {
    items: PriceRow[];
    boqItems: PriceRow[];
    fees: PriceRow[];
    paymentTerms: string;
    validityDays: string;
  };
  declarations: Record<string, unknown>;
};

type Step = {
  id: string;
  label: string;
  title: string;
  kicker: string;
};

const WORKFLOW_VERSION = 'procurex-v1';

export function BiddingWorkspaceProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading: tenderLoading, isError } = useTenderDetail(tenderId);
  const [activeStep, setActiveStep] = useState(0);
  const [bid, setBid] = useState<BidDto | null>(null);
  const [receipt, setReceipt] = useState<BidReceiptDto | null>(null);
  const [status, setStatus] = useState('Loading bid workspace...');
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<BidDocumentInput[]>([]);
  const [form, setForm] = useState<BidFormState>(() => emptyBidForm());

  const workflow = useMemo(() => workflowFromTender(tender), [tender]);
  const steps = useMemo(() => workflowSteps(workflow, tender), [workflow, tender]);
  const totalAmount = useMemo(() => totalFromForm(form, workflow), [form, workflow]);
  const validationIssues = useMemo(() => validateForm(workflow, form, documents, totalAmount), [workflow, form, documents, totalAmount]);
  const completeness = useMemo(() => {
    const all = Math.max(1, steps.length - 1);
    const complete = Math.max(0, all - validationIssues.length);
    return { percent: Math.min(100, Math.round((complete / all) * 100)), sectionsComplete: complete, totalSections: all };
  }, [steps.length, validationIssues.length]);

  useEffect(() => {
    if (!tender) return;
    setForm((current) => mergeTenderDefaults(current, tender, workflow));
  }, [tender, workflow]);

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
          setBid(draft);
          setReceipt(draft.receipt ? { ...draft.receipt, bid: draft } : null);
          hydrateDraft(draft);
          setActiveStep(draft.receipt ? steps.length - 1 : 0);
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
  }, [tenderId, steps.length]);

  function hydrateDraft(draft: BidDto) {
    const payload = draft.payload;
    const administrative = objectPayload(payload.administrative);
    const technical = objectPayload(payload.technical);
    const financial = objectPayload(payload.financial);
    const declarations = objectPayload(payload.declarations);
    setForm((current) => ({
      administrative: { ...current.administrative, ...administrative },
      technical: { ...current.technical, ...technical },
      financial: {
        ...current.financial,
        items: normalizePriceRows(financial.items, current.financial.items),
        boqItems: normalizePriceRows(financial.boqItems, current.financial.boqItems),
        fees: normalizePriceRows(financial.fees, current.financial.fees),
        paymentTerms: String(financial.paymentTerms ?? current.financial.paymentTerms),
        validityDays: String(financial.validityDays ?? current.financial.validityDays)
      },
      declarations: { ...current.declarations, ...declarations }
    }));
    setDocuments(
      draft.documents.map((document) => ({
        name: document.name,
        documentType: document.documentType,
        envelope: document.envelope as Envelope,
        checksum: document.checksum ?? undefined,
        objectKey: document.metadata.objectKey as string | undefined,
        size: Number(document.metadata.size || 0) || undefined,
        mimeType: document.metadata.mimeType as string | undefined,
        metadata: document.metadata
      }))
    );
  }

  function draftPayload(): BidDraftPayload {
    const responses = responseList(workflow, form);
    return {
      workflowType: workflow,
      workflowVersion: WORKFLOW_VERSION,
      administrative: form.administrative,
      technical: form.technical,
      financial: {
        items: form.financial.items.map(withTotal),
        boqItems: form.financial.boqItems.map(withTotal),
        fees: form.financial.fees.map(withTotal),
        paymentTerms: form.financial.paymentTerms,
        validityDays: form.financial.validityDays
      },
      declarations: form.declarations,
      responses,
      documents,
      fileManifest: { documentCount: documents.length, checksums: documents.map((document) => document.checksum).filter(Boolean) },
      envelopes: envelopeManifest(workflow, documents),
      reviewReadiness: { issues: validationIssues, totalAmount, generatedAt: new Date().toISOString() },
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
      const payload = draftPayload();
      const saved = bid ? await biddingApi.updateBid(bid.id, payload) : await biddingApi.saveTenderDraft(tenderId, payload);
      setBid(saved);
      setReceipt(saved.receipt ? { ...saved.receipt, bid: saved } : null);
      setStatus('Draft saved to the database.');
    } catch (error) {
      setStatus(errorMessage(error, 'Draft could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitBid() {
    if (validationIssues.length) {
      setStatus(`Complete required sections before submitting: ${validationIssues.join(', ')}.`);
      setActiveStep(Math.max(0, steps.length - 2));
      return;
    }
    setSaving(true);
    setStatus('Submitting sealed bid...');
    try {
      const payload = draftPayload();
      const saved = bid ? await biddingApi.updateBid(bid.id, payload) : tenderId ? await biddingApi.saveTenderDraft(tenderId, payload) : null;
      if (!saved) throw new Error('Tender id is missing.');
      const submitted = await biddingApi.submitBid(saved.id);
      setBid(submitted.bid);
      setReceipt(submitted);
      setActiveStep(steps.length - 1);
      setStatus(workflow === 'consultancy' ? 'Technical and financial envelopes sealed. Receipt generated.' : 'Bid package sealed. Receipt generated.');
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
      setReceipt(withdrawn.receipt ? { ...withdrawn.receipt, bid: withdrawn } : null);
      setStatus('Bid withdrawn. A new active bid package can be prepared before closing.');
      setActiveStep(0);
    } catch (error) {
      setStatus(errorMessage(error, 'Bid could not be withdrawn.'));
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string) {
    if (!files) return;
    setStatus('Hashing selected evidence...');
    const next = await Promise.all(
      Array.from(files).map(async (file): Promise<BidDocumentInput> => {
        const checksum = await sha256File(file);
        return {
          name: file.name,
          documentType,
          envelope,
          checksum,
          objectKey: `bid/${tenderId || 'pending'}/${checksum}-${safeFileName(file.name)}`,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          metadata: {
            requirementKey,
            originalName: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            lastModified: file.lastModified,
            objectKey: `bid/${tenderId || 'pending'}/${checksum}-${safeFileName(file.name)}`
          }
        };
      })
    );
    setDocuments((current) => [...current, ...next]);
    setStatus(`${next.length} evidence file${next.length === 1 ? '' : 's'} added to the bid manifest.`);
  }

  if (!tenderId) return <WorkspaceEmpty message="Open a tender from the marketplace to start or continue a bid." />;
  if (tenderLoading) return <WorkspaceEmpty message="Loading tender..." />;
  if (isError || !tender) return <WorkspaceEmpty message="Tender could not be loaded. Return to the marketplace and try again." />;

  const loadedTender = tender;
  const isSubmitted = bid?.status === 'SUBMITTED';
  const currentStep = steps[Math.min(activeStep, steps.length - 1)];

  return (
    <div className="procurement-app-page bid-flow-page" data-bid-total={totalAmount} data-bid-workflow={workflow}>
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">{workflowLabel(workflow)} bid</span>
            <h1>Bid Submission Workspace</h1>
            <p>{tender.title} - wizard generated from tender requirements, evidence, and commercial schedule.</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-secondary" to={`/procurement/supplier-tender-detail?tenderId=${tender.id}`}>
              View Tender Details
            </Link>
            <Link className="btn btn-secondary" to="/communication">
              Ask Clarification
            </Link>
            <button className="btn btn-secondary" type="button" disabled={saving || isSubmitted} onClick={saveDraft}>
              Save Draft
            </button>
            {isSubmitted ? (
              <button className="btn btn-secondary" type="button" disabled={saving} onClick={withdrawBid}>
                Withdraw
              </button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={saving} onClick={submitBid}>
                Review Submission
              </button>
            )}
          </div>
        </section>

        <section className="procurement-market-summary">
          <Kpi label="Tender" value={tender.reference} />
          <Kpi label="Workflow" value={workflowLabel(workflow)} />
          <Kpi label="Completeness" value={`${completeness.percent}%`} />
          <Kpi label="Total" value={formatMoney(totalAmount, tender.currency)} />
        </section>

        <section className="wizard-shell">
          <nav className="wizard-step-progress bid-step-progress" aria-label="Bid submission progress">
            {steps.map((step, index) => (
              <button className={index === activeStep ? 'active' : ''} type="button" key={step.id} onClick={() => setActiveStep(index)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {step.label}
              </button>
            ))}
          </nav>

          <aside className="wizard-rail">
            {steps.map((step, index) => (
              <button className={`wizard-rail-step ${index === activeStep ? 'active' : ''}`} type="button" key={step.id} onClick={() => setActiveStep(index)}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
              </button>
            ))}
          </aside>

          <main className="wizard-workspace">
            <div className="form-status">{status}</div>
            <StepPanel kicker={currentStep.kicker} title={currentStep.title} badge={stepBadge(currentStep.id, validationIssues, documents, receipt)}>
              {renderStep(currentStep.id)}
            </StepPanel>
          </main>
        </section>
      </main>
    </div>
  );

  function renderStep(stepId: string) {
    if (stepId === 'eligibility') {
      return (
        <>
          <div className="tender-detail-field-grid">
            <CheckCard label="Confirm eligibility to participate" checked={Boolean(form.administrative.eligible)} onChange={(value) => patchAdmin('eligible', value)} />
            <CheckCard label="Confirm tax and statutory compliance" checked={Boolean(form.administrative.taxCompliant)} onChange={(value) => patchAdmin('taxCompliant', value)} />
            <CheckCard label="Confirm authorized representative" checked={Boolean(form.administrative.authorized)} onChange={(value) => patchAdmin('authorized', value)} />
            <CheckCard label="Confirm mandatory documents are attached" checked={Boolean(form.administrative.documentsConfirmed)} onChange={(value) => patchAdmin('documentsConfirmed', value)} />
          </div>
          <RequirementPreview tender={loadedTender} />
          <UploadBox envelope="COMBINED" title="Eligibility and administrative evidence" documentType="ADMINISTRATIVE_EVIDENCE" requirementKey="eligibility" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'goods-technical') {
      return (
        <>
          <TextArea label="Product compliance statement" value={String(form.technical.productCompliance || '')} onChange={(value) => patchTechnical('productCompliance', value)} />
          <EditablePriceTable className="goods-offer-table" rows={form.financial.items} currency={loadedTender.currency} rateLabel="Quoted unit price" onChange={(rows) => patchFinancial('items', rows)} showTax />
          <UploadBox envelope="TECHNICAL" title="Product brochures, catalogues, and specification evidence" documentType="TECHNICAL_PRODUCT_SPEC" requirementKey="goods-technical" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'goods-financial') {
      return (
        <>
          <EditablePriceTable className="goods-offer-table" rows={form.financial.items} currency={loadedTender.currency} rateLabel="Unit price" onChange={(rows) => patchFinancial('items', rows)} showTax />
          <TermsPanel form={form} patchFinancial={patchFinancialText} />
          <UploadBox envelope="FINANCIAL" title="Financial offer and price schedule" documentType="FINANCIAL_OFFER" requirementKey="goods-financial" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'goods-samples') {
      return (
        <>
          <TextArea label="Sample dispatch and delivery evidence" value={String(form.technical.samplePlan || '')} onChange={(value) => patchTechnical('samplePlan', value)} />
          <UploadBox envelope="TECHNICAL" title="Sample dispatch receipts and photos" documentType="SAMPLE_EVIDENCE" requirementKey="goods-samples" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'works-capacity') {
      return (
        <div className="form-grid">
          <TextArea label="Similar works experience" value={String(form.technical.experience || '')} onChange={(value) => patchTechnical('experience', value)} />
          <TextArea label="Key personnel and equipment" value={String(form.technical.capacity || '')} onChange={(value) => patchTechnical('capacity', value)} />
          <TextArea label="Health, safety, and environmental plan" value={String(form.technical.hse || '')} onChange={(value) => patchTechnical('hse', value)} />
          <UploadBox envelope="TECHNICAL" title="Works capacity evidence" documentType="WORKS_CAPACITY" requirementKey="works-capacity" onFiles={addFiles} />
        </div>
      );
    }
    if (stepId === 'works-technical') {
      return (
        <div className="form-grid">
          <TextArea label="Methodology and construction approach" value={String(form.technical.methodology || '')} onChange={(value) => patchTechnical('methodology', value)} />
          <TextArea label="Work programme and schedule" value={String(form.technical.workPlan || '')} onChange={(value) => patchTechnical('workPlan', value)} />
          <TextArea label="Site response and drawings register" value={String(form.technical.siteResponse || '')} onChange={(value) => patchTechnical('siteResponse', value)} />
        </div>
      );
    }
    if (stepId === 'works-financial') {
      return (
        <>
          <EditablePriceTable className="works-boq-table premium-review-table" rows={form.financial.boqItems} currency={loadedTender.currency} rateLabel="Unit rate" onChange={(rows) => patchFinancial('boqItems', rows)} />
          <TermsPanel form={form} patchFinancial={patchFinancialText} />
          <UploadBox envelope="FINANCIAL" title="Priced BOQ and commercial offer" documentType="WORKS_BOQ" requirementKey="works-financial" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'services-methodology') {
      return (
        <div className="form-grid">
          <TextArea label="Understanding of service scope" value={String(form.technical.methodology || '')} onChange={(value) => patchTechnical('methodology', value)} />
          <TextArea label="Workflow and quality assurance" value={String(form.technical.qualityAssurance || '')} onChange={(value) => patchTechnical('qualityAssurance', value)} />
          <TextArea label="Risk management approach" value={String(form.technical.riskPlan || '')} onChange={(value) => patchTechnical('riskPlan', value)} />
        </div>
      );
    }
    if (stepId === 'services-delivery') {
      return (
        <div className="form-grid">
          <TextArea label="Delivery plan, milestones, and locations" value={String(form.technical.deliveryPlan || '')} onChange={(value) => patchTechnical('deliveryPlan', value)} />
          <TextArea label="Staffing, capacity, and continuity plan" value={String(form.technical.staffingPlan || '')} onChange={(value) => patchTechnical('staffingPlan', value)} />
        </div>
      );
    }
    if (stepId === 'services-sla') {
      return (
        <div className="form-grid">
          <TextArea label="SLA commitment" value={String(form.technical.sla || '')} onChange={(value) => patchTechnical('sla', value)} />
          <TextArea label="Reporting plan" value={String(form.technical.reportingPlan || '')} onChange={(value) => patchTechnical('reportingPlan', value)} />
          <UploadBox envelope="TECHNICAL" title="SLA, staffing, and reporting evidence" documentType="SERVICE_TECHNICAL_EVIDENCE" requirementKey="services-sla" onFiles={addFiles} />
        </div>
      );
    }
    if (stepId === 'services-commercial') {
      return (
        <>
          <EditablePriceTable className="service-pricing-table premium-commercial-table" rows={form.financial.items} currency={loadedTender.currency} rateLabel="Billing rate" onChange={(rows) => patchFinancial('items', rows)} />
          <TermsPanel form={form} patchFinancial={patchFinancialText} />
          <UploadBox envelope="FINANCIAL" title="Service pricing schedule" documentType="SERVICE_PRICING" requirementKey="services-commercial" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'consultancy-technical') {
      return (
        <div className="form-grid">
          <TextArea label="TOR understanding and technical proposal" value={String(form.technical.technicalProposal || '')} onChange={(value) => patchTechnical('technicalProposal', value)} />
          <TextArea label="Methodology and work plan" value={String(form.technical.methodology || '')} onChange={(value) => patchTechnical('methodology', value)} />
          <TextArea label="Team qualifications and evidence" value={String(form.technical.teamQualifications || '')} onChange={(value) => patchTechnical('teamQualifications', value)} />
          <UploadBox envelope="TECHNICAL" title="Technical proposal envelope" documentType="CONSULTANCY_TECHNICAL_PROPOSAL" requirementKey="consultancy-technical" onFiles={addFiles} />
        </div>
      );
    }
    if (stepId === 'consultancy-financial') {
      return (
        <>
          <EditablePriceTable className="service-pricing-table premium-commercial-table" rows={form.financial.fees} currency={loadedTender.currency} rateLabel="Fee rate" onChange={(rows) => patchFinancial('fees', rows)} />
          <TermsPanel form={form} patchFinancial={patchFinancialText} />
          <UploadBox envelope="FINANCIAL" title="Financial proposal envelope" documentType="CONSULTANCY_FINANCIAL_PROPOSAL" requirementKey="consultancy-financial" onFiles={addFiles} />
        </>
      );
    }
    if (stepId === 'review') {
      return <ReviewPanel workflow={workflow} form={form} documents={documents} issues={validationIssues} totalAmount={totalAmount} currency={loadedTender.currency} />;
    }
    if (stepId === 'declaration') {
      return (
        <>
          <div className="form-grid">
            <Input label="Authorized representative" value={String(form.declarations.representativeName || '')} onChange={(value) => patchDeclaration('representativeName', value)} />
            <Input label="Position" value={String(form.declarations.position || '')} onChange={(value) => patchDeclaration('position', value)} />
          </div>
          <div className="tender-detail-field-grid">
            <CheckCard label="I confirm the bid is accurate and complete" checked={Boolean(form.declarations.confirmAccuracy)} onChange={(value) => patchDeclaration('confirmAccuracy', value)} />
            <CheckCard label="I accept the tender and contract terms" checked={Boolean(form.declarations.acceptTerms)} onChange={(value) => patchDeclaration('acceptTerms', value)} />
            <CheckCard label="I declare no conflict of interest" checked={Boolean(form.declarations.noConflict)} onChange={(value) => patchDeclaration('noConflict', value)} />
            <CheckCard label="I confirm anti-corruption compliance" checked={Boolean(form.declarations.antiCorruption)} onChange={(value) => patchDeclaration('antiCorruption', value)} />
          </div>
          <div className="submit-strip">
            <button className="btn btn-secondary" type="button" disabled={saving || isSubmitted} onClick={saveDraft}>
              Save Draft
            </button>
            <button className="btn btn-primary" type="button" disabled={saving || isSubmitted} onClick={submitBid}>
              Submit Sealed Bid
            </button>
          </div>
        </>
      );
    }
    return (
      <div className="record-summary tender-detail-summary">
        {receipt ? (
          <>
            <SummaryItem label="Receipt reference" value={receipt.receiptRef} />
            <SummaryItem label="Receipt hash" value={receipt.receiptHash} />
            <SummaryItem label="Submitted" value={formatDate(receipt.createdAt)} />
            <SummaryItem label="Bid reference" value={receipt.bid.reference} />
          </>
        ) : (
          <SummaryItem label="Receipt" value="Submit the bid to generate a receipt." />
        )}
      </div>
    );
  }

  function patchAdmin(key: string, value: boolean | string) {
    setForm((current) => ({ ...current, administrative: { ...current.administrative, [key]: value } }));
  }

  function patchTechnical(key: string, value: unknown) {
    setForm((current) => ({ ...current, technical: { ...current.technical, [key]: value } }));
  }

  function patchFinancial(key: 'items' | 'boqItems' | 'fees', rows: PriceRow[]) {
    setForm((current) => ({ ...current, financial: { ...current.financial, [key]: rows } }));
  }

  function patchFinancialText(key: 'paymentTerms' | 'validityDays', value: string) {
    setForm((current) => ({ ...current, financial: { ...current.financial, [key]: value } }));
  }

  function patchDeclaration(key: string, value: boolean | string) {
    setForm((current) => ({ ...current, declarations: { ...current.declarations, [key]: value } }));
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

function StepPanel({ kicker, title, badge, children }: { kicker: string; title: string; badge: string; children: ReactNode }) {
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <textarea className="form-input" rows={5} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input className="form-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function UploadBox({
  envelope,
  title,
  documentType,
  requirementKey,
  onFiles
}: {
  envelope: Envelope;
  title: string;
  documentType: string;
  requirementKey: string;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string) => void;
}) {
  return (
    <label className="supplier-requirement-preview">
      <span>{envelope} documents</span>
      <strong>{title}</strong>
      <input className="form-input" type="file" multiple onChange={(event) => onFiles(event.target.files, envelope, documentType, requirementKey)} />
    </label>
  );
}

function EditablePriceTable({
  className,
  rows,
  currency,
  rateLabel,
  showTax,
  onChange
}: {
  className: string;
  rows: PriceRow[];
  currency: string;
  rateLabel: string;
  showTax?: boolean;
  onChange: (rows: PriceRow[]) => void;
}) {
  return (
    <div className={`data-table ${className}`}>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>{rateLabel}</th>
            {showTax ? <th>Tax included</th> : null}
            <th>Discount</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.itemNo}</td>
              <td>{row.description}</td>
              <td><NumberInput value={row.quantity} onChange={(value) => updateRow(row.id, { quantity: value })} /></td>
              <td>{row.unit}</td>
              <td><NumberInput value={row.rate} onChange={(value) => updateRow(row.id, { rate: value })} /></td>
              {showTax ? (
                <td>
                  <input type="checkbox" checked={row.taxIncluded} onChange={(event) => updateRow(row.id, { taxIncluded: event.target.checked })} />
                </td>
              ) : null}
              <td><NumberInput value={row.discount} onChange={(value) => updateRow(row.id, { discount: value })} /></td>
              <td>{formatMoney(row.quantity * row.rate - row.discount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  function updateRow(id: string, patch: Partial<PriceRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="form-input" type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />;
}

function TermsPanel({ form, patchFinancial }: { form: BidFormState; patchFinancial: (key: 'paymentTerms' | 'validityDays', value: string) => void }) {
  return (
    <div className="form-grid">
      <Input label="Payment terms" value={form.financial.paymentTerms} onChange={(value) => patchFinancial('paymentTerms', value)} />
      <Input label="Offer validity days" value={form.financial.validityDays} onChange={(value) => patchFinancial('validityDays', value)} />
    </div>
  );
}

function RequirementPreview({ tender }: { tender: TenderDetail }) {
  const rows = tender.requirementRows?.length ? tender.requirementRows : requirementRowsFromJson(tender.requirements);
  return (
    <div className="tender-detail-card-list">
      {rows.slice(0, 8).map((row) => (
        <article className="supplier-requirement-preview" key={row.id}>
          <span>{humanize(row.section)}</span>
          <strong>{payloadTitle(row.payload, row.section)}</strong>
          <p>{payloadSummary(row.payload)}</p>
        </article>
      ))}
    </div>
  );
}

function ReviewPanel({ workflow, form, documents, issues, totalAmount, currency }: { workflow: WorkflowType; form: BidFormState; documents: BidDocumentInput[]; issues: string[]; totalAmount: number; currency: string }) {
  return (
    <>
      <div className="record-summary tender-detail-summary">
        <SummaryItem label="Workflow" value={workflowLabel(workflow)} />
        <SummaryItem label="Administrative" value={form.administrative.eligible && form.administrative.authorized ? 'Complete' : 'Incomplete'} />
        <SummaryItem label="Technical responses" value={responseList(workflow, form).length ? `${responseList(workflow, form).length} response groups` : 'Incomplete'} />
        <SummaryItem label="Documents" value={`${documents.length} evidence record${documents.length === 1 ? '' : 's'}`} />
        <SummaryItem label="Financial total" value={formatMoney(totalAmount, currency)} />
      </div>
      {issues.length ? <div className="scope-empty">Complete required sections before submitting: {issues.join(', ')}.</div> : <div className="scope-empty">Bid package is ready for sealed submission.</div>}
    </>
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

function emptyBidForm(): BidFormState {
  return {
    administrative: { eligible: false, taxCompliant: false, authorized: false, documentsConfirmed: false },
    technical: {},
    financial: { items: [], boqItems: [], fees: [], paymentTerms: '', validityDays: '90' },
    declarations: { confirmAccuracy: false, acceptTerms: false, noConflict: false, antiCorruption: false, representativeName: '', position: '' }
  };
}

function workflowFromTender(tender?: TenderDetail | null): WorkflowType {
  const type = String(tender?.type || '').toLowerCase();
  if (type.includes('goods')) return 'goods';
  if (type.includes('works')) return 'works';
  if (type.includes('consultancy')) return 'consultancy';
  if (type.includes('service') || type.includes('non consultancy')) return 'services';
  return 'generic';
}

function workflowSteps(workflow: WorkflowType, tender?: TenderDetail | null): Step[] {
  const base: Step[] = [{ id: 'eligibility', label: 'Eligibility', title: 'Eligibility and Document Requirements', kicker: 'Step 01' }];
  if (workflow === 'goods') {
    base.push({ id: 'goods-technical', label: 'Technical Response', title: 'Technical Response', kicker: 'Step 02' });
    base.push({ id: 'goods-financial', label: 'Financial Offer', title: 'Financial Offer', kicker: 'Step 03' });
    if (hasSampleRequirements(tender)) base.push({ id: 'goods-samples', label: 'Samples', title: 'Sample Dispatch and Delivery Evidence', kicker: 'Step 04' });
  } else if (workflow === 'works') {
    base.push({ id: 'works-capacity', label: 'Technical Capacity', title: 'Technical Capacity', kicker: 'Step 02' });
    base.push({ id: 'works-technical', label: 'Technical Proposal', title: 'Technical Proposal', kicker: 'Step 03' });
    base.push({ id: 'works-financial', label: 'Financial Proposal', title: 'Financial Proposal', kicker: 'Step 04' });
  } else if (workflow === 'services') {
    base.push({ id: 'services-methodology', label: 'Methodology', title: 'Methodology', kicker: 'Step 02' });
    base.push({ id: 'services-delivery', label: 'Delivery Plan', title: 'Delivery Plan, Staffing, and Continuity', kicker: 'Step 03' });
    base.push({ id: 'services-sla', label: 'SLA and Reporting', title: 'SLA and Reporting', kicker: 'Step 04' });
    base.push({ id: 'services-commercial', label: 'Commercial Pricing', title: 'Commercial Pricing', kicker: 'Step 05' });
  } else if (workflow === 'consultancy') {
    base.push({ id: 'consultancy-technical', label: 'Technical Proposal', title: 'Technical Proposal', kicker: 'Step 02' });
    base.push({ id: 'consultancy-financial', label: 'Financial Proposal', title: 'Financial Proposal', kicker: 'Step 03' });
  } else {
    base.push({ id: 'services-methodology', label: 'Dynamic Responses', title: 'Dynamic Responses', kicker: 'Step 02' });
    base.push({ id: 'services-commercial', label: 'Financial Offer', title: 'Financial Offer', kicker: 'Step 03' });
  }
  base.push({ id: 'review', label: 'Review Submission', title: 'Review Submission', kicker: `Step ${String(base.length + 1).padStart(2, '0')}` });
  base.push({ id: 'declaration', label: 'Declaration and Submit', title: 'Declaration and Submit', kicker: `Step ${String(base.length + 1).padStart(2, '0')}` });
  base.push({ id: 'receipt', label: 'Receipt', title: 'Receipt', kicker: `Step ${String(base.length + 1).padStart(2, '0')}` });
  return base;
}

function mergeTenderDefaults(current: BidFormState, tender: TenderDetail, workflow: WorkflowType): BidFormState {
  const rows = commercialRowsFromTender(tender);
  return {
    ...current,
    financial: {
      ...current.financial,
      items: current.financial.items.length ? current.financial.items : rows,
      boqItems: current.financial.boqItems.length ? current.financial.boqItems : rows,
      fees: current.financial.fees.length ? current.financial.fees : rows
    },
    technical: {
      ...defaultTechnical(workflow, tender),
      ...current.technical
    }
  };
}

function commercialRowsFromTender(tender: TenderDetail): PriceRow[] {
  const explicit = tender.commercialItems ?? [];
  const jsonRows = Array.isArray(tender.requirements?.commercialItems) ? (tender.requirements?.commercialItems as Record<string, unknown>[]) : [];
  const source = explicit.length
    ? explicit.map((item, index) => ({ id: item.id, itemNo: item.itemNo || String(index + 1), description: item.description, quantity: item.quantity, unit: item.unit || 'Lot', rate: item.rate }))
    : jsonRows.map((item, index) => ({
        id: String(item.id || `line-${index + 1}`),
        itemNo: String(index + 1),
        description: String(item.description || item.itemDescription || 'Tender line item'),
        quantity: Number(item.quantity || 1),
        unit: String(item.unit || item.unitOfMeasure || 'Lot'),
        rate: Number(item.unitPrice || item.rate || 0)
      }));
  return (source.length ? source : [{ id: 'line-1', itemNo: '1', description: tender.title, quantity: 1, unit: 'Lot', rate: 0 }]).map((row) => ({
    ...row,
    quantity: Number(row.quantity || 1),
    rate: Number(row.rate || 0),
    taxIncluded: true,
    discount: 0
  }));
}

function defaultTechnical(workflow: WorkflowType, tender: TenderDetail) {
  if (workflow === 'goods') return { productCompliance: `We respond to the product specifications for ${tender.reference}.` };
  if (workflow === 'works') return { methodology: '', workPlan: '', capacity: '', experience: '', hse: '' };
  if (workflow === 'services') return { methodology: '', deliveryPlan: '', staffingPlan: '', sla: '', reportingPlan: '' };
  if (workflow === 'consultancy') return { technicalProposal: '', methodology: '', teamQualifications: '' };
  return {};
}

function normalizePriceRows(value: unknown, fallback: PriceRow[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map((row, index) => {
    const record = objectPayload(row);
    return {
      id: String(record.id || `line-${index + 1}`),
      itemNo: String(record.itemNo || index + 1),
      description: String(record.description || 'Tender line item'),
      quantity: Number(record.quantity || 0),
      unit: String(record.unit || 'Lot'),
      rate: Number(record.rate || 0),
      taxIncluded: record.taxIncluded !== false,
      discount: Number(record.discount || 0)
    };
  });
}

function withTotal(row: PriceRow) {
  return { ...row, total: Math.max(0, row.quantity * row.rate - row.discount) };
}

function totalFromForm(form: BidFormState, workflow: WorkflowType) {
  const rows = workflow === 'works' ? form.financial.boqItems : workflow === 'consultancy' ? form.financial.fees : form.financial.items;
  return rows.reduce((sum, row) => sum + Math.max(0, row.quantity * row.rate - row.discount), 0);
}

function responseList(workflow: WorkflowType, form: BidFormState) {
  return Object.entries(form.technical)
    .filter(([, value]) => String(value ?? '').trim())
    .map(([key, value]) => ({
      requirementKey: `${workflow}-${key}`,
      response: { value }
    }));
}

function validateForm(workflow: WorkflowType, form: BidFormState, documents: BidDocumentInput[], totalAmount: number) {
  const issues: string[] = [];
  if (!form.administrative.eligible || !form.administrative.authorized) issues.push('administrative confirmations');
  if (documents.length < 1) issues.push('supporting documents');
  if (totalAmount <= 0) issues.push('financial offer');
  if (!form.declarations.confirmAccuracy || !form.declarations.acceptTerms) issues.push('declarations');
  if (workflow === 'goods' && !String(form.technical.productCompliance || '').trim()) issues.push('product technical response');
  if (workflow === 'works' && (!String(form.technical.methodology || '').trim() || !String(form.technical.workPlan || '').trim())) issues.push('works methodology');
  if (workflow === 'services' && (!String(form.technical.methodology || '').trim() || !String(form.technical.sla || '').trim())) issues.push('service methodology and SLA');
  if (workflow === 'consultancy' && (!String(form.technical.technicalProposal || '').trim() || !String(form.technical.methodology || '').trim())) issues.push('consultancy technical proposal');
  return issues;
}

function envelopeManifest(workflow: WorkflowType, documents: BidDocumentInput[]) {
  return {
    mode: workflow === 'consultancy' ? 'two-envelope' : 'combined',
    technical: documents.filter((document) => document.envelope === 'TECHNICAL').map((document) => document.checksum).filter(Boolean),
    financial: documents.filter((document) => document.envelope === 'FINANCIAL').map((document) => document.checksum).filter(Boolean),
    combined: documents.filter((document) => document.envelope === 'COMBINED').map((document) => document.checksum).filter(Boolean)
  };
}

function requirementRowsFromJson(requirements?: Record<string, unknown>) {
  if (!requirements) return [];
  return Object.entries(requirements).flatMap(([section, value]) => {
    if (Array.isArray(value)) return value.map((item, index) => ({ id: `${section}-${index}`, section, payload: objectPayload(item) }));
    if (value && typeof value === 'object') return [{ id: section, section, payload: objectPayload(value) }];
    return [{ id: section, section, payload: { value } }];
  });
}

function hasSampleRequirements(tender?: TenderDetail | null) {
  const samples = tender?.requirements?.sampleRequirements;
  return Array.isArray(samples) && samples.some((item) => objectPayload(item).sampleRequired !== false);
}

function stepBadge(stepId: string, issues: string[], documents: BidDocumentInput[], receipt: BidReceiptDto | null) {
  if (stepId === 'receipt') return receipt ? 'Submitted' : 'Pending';
  if (stepId === 'review') return `${issues.length} issues`;
  if (stepId === 'eligibility') return `${documents.length} files`;
  return issues.length ? 'In progress' : 'Ready';
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function sha256File(file: File) {
  if (!globalThis.crypto?.subtle) return `${file.name}-${file.size}-${file.lastModified}`;
  const buffer = await file.arrayBuffer();
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function payloadTitle(payload: Record<string, unknown>, fallback: string) {
  return String(payload.title || payload.name || payload.requirementName || payload.description || payload.value || fallback);
}

function payloadSummary(payload: Record<string, unknown>) {
  const pairs = Object.entries(payload)
    .filter(([key, value]) => key !== 'id' && value !== undefined && value !== null && String(value).trim())
    .slice(0, 4)
    .map(([key, value]) => `${humanize(key)}: ${formatUnknown(value)}`);
  return pairs.join(' / ') || 'Buyer requirement';
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatUnknown).join(', ');
  if (value && typeof value === 'object') return payloadTitle(value as Record<string, unknown>, 'Configured');
  return String(value ?? '');
}

function workflowLabel(value: WorkflowType) {
  if (value === 'services') return 'Services';
  return humanize(value);
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed);
}
