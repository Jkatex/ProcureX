import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDocumentEnvelope, BidDocumentInput, BidDraftPayload, BidDto, BidReceiptDto, BidSampleDto, BidSubmissionSchemaDto, BidSubmissionSchemaFieldDto, BidSubmissionSchemaStepDto, CreateBidSampleInput, PatchBidSampleInput } from '../../types';

type WorkflowType = 'goods' | 'works' | 'services' | 'consultancy' | 'generic';
type Envelope = BidDocumentEnvelope;
type BidDocumentState = BidDto['documents'][number];

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
  description: string;
};

type GateItem = {
  id: string;
  label: string;
  category: string;
  mandatory: boolean;
  complete: boolean;
};

type GateStatus = {
  items: GateItem[];
  mandatoryTotal: number;
  completeMandatory: number;
  remaining: number;
  complete: boolean;
  message: string;
};

type SampleFormState = {
  relatedItem: string;
  sampleName: string;
  quantity: string;
  deliveryLocation: string;
  courier: string;
  trackingNumber: string;
  markSubmitted: boolean;
};

type SampleRequirement = {
  id: string;
  relatedItem: string;
  sampleName: string;
  quantity: number;
  deliveryLocation: string;
  deliveryDeadline?: string;
  mandatory: boolean;
};

type SampleItemOption = {
  value: string;
  label: string;
};

type SchemaResponseState = Record<string, unknown>;

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
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [documents, setDocuments] = useState<BidDocumentState[]>([]);
  const [samples, setSamples] = useState<BidSampleDto[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleSaving, setSampleSaving] = useState(false);
  const [sampleEdits, setSampleEdits] = useState<Record<string, SampleFormState>>({});
  const [form, setForm] = useState<BidFormState>(() => emptyBidForm());
  const [schema, setSchema] = useState<BidSubmissionSchemaDto | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaResponses, setSchemaResponses] = useState<SchemaResponseState>({});
  const [reviewEditTarget, setReviewEditTarget] = useState<string | null>(null);

  const workflow = useMemo(() => workflowFromTender(tender), [tender]);
  const sampleRequirements = useMemo(() => schemaSampleRequirements(schema, tender), [schema, tender]);
  const sampleItemOptions = useMemo(() => sampleOptionsFromTender(tender, sampleRequirements), [tender, sampleRequirements]);
  const steps = useMemo(() => (schema ? schemaSteps(schema) : []), [schema]);
  const totalAmount = useMemo(() => (schema ? schemaTotalFromResponses(schema, schemaResponses) : totalFromForm(form, workflow)), [form, schema, schemaResponses, workflow]);
  const gate = useMemo(() => schemaGateStatus(schema, schemaResponses, documents), [documents, schema, schemaResponses]);
  const validationIssues = useMemo(() => (schema ? validateSchemaResponses(schema, schemaResponses, documents, samples) : validateForm(workflow, form, documents, totalAmount)), [documents, form, samples, schema, schemaResponses, totalAmount, workflow]);
  const completeness = useMemo(() => {
    if (!schema) {
      const all = Math.max(1, steps.length - 1);
      const complete = Math.max(0, all - validationIssues.length);
      return { percent: Math.min(100, Math.round((complete / all) * 100)), sectionsComplete: complete, totalSections: all };
    }
    return schemaCompleteness(schema, schemaResponses, documents, samples);
  }, [documents, samples, schema, schemaResponses, steps.length, validationIssues.length]);

  useEffect(() => {
    if (!tender) return;
    setForm((current) => mergeTenderDefaults(current, tender, workflow));
  }, [tender, workflow]);

  useEffect(() => {
    if (!tenderId) {
      setSchema(null);
      return;
    }

    let mounted = true;
    setSchemaLoading(true);
    biddingApi
      .getTenderSchema(tenderId)
      .then((nextSchema) => {
        if (!mounted) return;
        setSchema(nextSchema);
        setActiveStep(0);
      })
      .catch((error) => {
        if (!mounted) return;
        setSchema(null);
        setStatus(errorMessage(error, 'Bid response fields could not be loaded from the tender requirements.'));
      })
      .finally(() => {
        if (mounted) setSchemaLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tenderId]);

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
          setDocuments(draft.documents);
          hydrateDraft(draft);
          setActiveStep(draft.receipt ? receiptStepIndex(steps, workflow) : 0);
          setStatus(draft.status === 'SUBMITTED' ? 'Submitted bid loaded.' : 'Draft bid loaded.');
        } else {
          setSamples([]);
          setSampleEdits({});
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

  useEffect(() => {
    if (!bid?.id || !schemaSampleStep(schema)) {
      setSamples([]);
      setSampleEdits({});
      return;
    }
    if (sampleSaving) return;

    let mounted = true;
    setSampleLoading(true);
    biddingApi
      .listSamples(bid.id)
      .then((items) => {
        if (!mounted) return;
        setSamples(items);
        setSampleEdits(Object.fromEntries(items.map((sample) => [sample.id, sampleFormFromDto(sample)])));
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus(errorMessage(error, 'Sample tracking could not be loaded.'));
      })
      .finally(() => {
        if (mounted) setSampleLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [bid?.id, sampleSaving, schema]);

  useEffect(() => {
    if (!reviewEditTarget) return;
    const timeout = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-bid-review-source-id="${reviewEditTarget}"]`);
      if (!target) return;
      target.classList.add('bid-review-edit-target');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusTarget = target.querySelector<HTMLElement>('textarea, input:not([type="hidden"]), select, button:not([disabled])');
      focusTarget?.focus({ preventScroll: true });
      window.setTimeout(() => target.classList.remove('bid-review-edit-target'), 2200);
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [activeStep, reviewEditTarget]);

  function hydrateDraft(draft: BidDto) {
    const payload = draft.payload;
    const administrative = objectPayload(payload.administrative);
    const technical = objectPayload(payload.technical);
    const financial = objectPayload(payload.financial);
    const declarations = objectPayload(payload.declarations);
    const responseState = Object.fromEntries(draft.responses.map((item) => [item.requirementKey, responseValue(item.response)]));
    setSchemaResponses({
      ...responseState,
      ...schemaResponsesFromPayload(administrative),
      ...schemaResponsesFromPayload(technical),
      ...schemaResponsesFromPayload(financial),
      ...schemaResponsesFromPayload(declarations)
    });
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
  }

  function draftPayload(): BidDraftPayload {
    const technical = schema ? schemaSectionPayload(schema, schemaResponses, 'technical') : backendTechnicalPayload(workflow, form.technical);
    const responses = schema ? schemaResponseList(schema, schemaResponses) : responseList(workflow, { ...form, technical });
    const financialItems = schema ? schemaFinancialRows(schema, schemaResponses) : form.financial.items.map(withTotal);
    const draftDocuments = documents.map(bidDocumentInputFromDto);
    return {
      workflowType: workflow,
      workflowVersion: WORKFLOW_VERSION,
      administrative: schema ? schemaSectionPayload(schema, schemaResponses, 'administrative') : form.administrative,
      technical,
      financial: {
        items: financialItems,
        boqItems: schema && workflow === 'works' ? financialItems : form.financial.boqItems.map(withTotal),
        fees: schema && workflow === 'consultancy' ? financialItems : form.financial.fees.map(withTotal),
        paymentTerms: schema ? String(schemaResponses['financial.paymentTerms'] ?? '') : form.financial.paymentTerms,
        validityDays: schema ? String(schemaResponses['financial.validityDays'] ?? '') : form.financial.validityDays
      },
      declarations: schema ? schemaSectionPayload(schema, schemaResponses, 'declarations') : form.declarations,
      responses,
      documents: draftDocuments,
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
      syncBidState(saved);
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
      syncBidState(submitted.bid);
      setReceipt(submitted);
      setActiveStep(receiptStepIndex(steps, workflow));
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
      syncBidState(withdrawn);
      setStatus('Bid withdrawn. A new active bid package can be prepared before closing.');
      setActiveStep(0);
    } catch (error) {
      setStatus(errorMessage(error, 'Bid could not be withdrawn.'));
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel = '') {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    setUploadingKey(requirementKey);
    setStatus(bid ? 'Uploading evidence document...' : 'Creating draft before upload...');
    try {
      const draft = await ensureDraftBid();
      setStatus(`Uploading ${selectedFiles.length} evidence file${selectedFiles.length === 1 ? '' : 's'}...`);
      const updated = await biddingApi.uploadDocuments(draft.id, {
        files: selectedFiles,
        envelope,
        documentType,
        metadata: { requirementKey, requirementLabel, source: 'bid-workspace' }
      });
      syncBidState(updated);
      setStatus(`${selectedFiles.length} evidence file${selectedFiles.length === 1 ? '' : 's'} uploaded and validated.`);
    } catch (error) {
      setStatus(errorMessage(error, 'Document upload failed.'));
    } finally {
      setUploadingKey(null);
    }
  }

  async function addSampleRecord(input: SampleFormState) {
    const payload = samplePayloadFromForm(input);
    if (!payload) {
      setStatus('Enter sample name and quantity before adding a sample.');
      return false;
    }
    setSampleSaving(true);
    setStatus(bid ? 'Adding sample record...' : 'Creating draft before adding sample...');
    try {
      const draft = await ensureDraftBid();
      const created = await biddingApi.createSample(draft.id, payload);
      setSamples((current) => [...current, created]);
      setSampleEdits((current) => ({ ...current, [created.id]: sampleFormFromDto(created) }));
      setStatus(created.trackingStatus === 'SUBMITTED' ? 'Sample record added and marked as submitted.' : 'Sample record added.');
      return true;
    } catch (error) {
      setStatus(errorMessage(error, 'Sample record could not be added.'));
      return false;
    } finally {
      setSampleSaving(false);
    }
  }

  async function saveSampleRecord(sample: BidSampleDto) {
    if (!bid) return;
    const edit = sampleEdits[sample.id] ?? sampleFormFromDto(sample);
    const payload = samplePatchFromForm(edit, sample);
    if (!payload) {
      setStatus('Enter sample name and quantity before saving sample changes.');
      return;
    }
    setSampleSaving(true);
    setStatus('Saving sample record...');
    try {
      const updated = await biddingApi.patchSample(bid.id, sample.id, payload);
      syncSample(updated);
      setStatus('Sample record saved.');
    } catch (error) {
      setStatus(errorMessage(error, 'Sample record could not be saved.'));
    } finally {
      setSampleSaving(false);
    }
  }

  async function markSampleSubmitted(sample: BidSampleDto) {
    if (!bid) return;
    setSampleSaving(true);
    setStatus('Marking sample as submitted...');
    try {
      const updated = await biddingApi.patchSample(bid.id, sample.id, { trackingStatus: 'SUBMITTED' });
      syncSample(updated);
      setStatus('Sample marked as submitted.');
    } catch (error) {
      setStatus(errorMessage(error, 'Sample could not be marked as submitted.'));
    } finally {
      setSampleSaving(false);
    }
  }

  async function ensureDraftBid() {
    if (bid) return bid;
    if (!tenderId) throw new Error('Tender id is missing.');
    const saved = await biddingApi.saveTenderDraft(tenderId, draftPayload());
    syncBidState(saved);
    return saved;
  }

  function syncBidState(updated: BidDto) {
    setBid(updated);
    setReceipt(updated.receipt ? { ...updated.receipt, bid: updated } : null);
    setDocuments(updated.documents);
  }

  function syncSample(updated: BidSampleDto) {
    setSamples((current) => current.map((sample) => (sample.id === updated.id ? updated : sample)));
    setSampleEdits((current) => ({ ...current, [updated.id]: sampleFormFromDto(updated) }));
  }

  function jumpToReview() {
    const reviewIndex = steps.findIndex((step) => isReviewStep(step));
    setActiveStep(reviewIndex > -1 ? reviewIndex : Math.max(0, steps.length - 1));
  }

  function goToStep(index: number) {
    if (index === activeStep) return;
    if (index > activeStep && !isSubmitted && !receipt && !canLeaveStep(activeStep)) return;
    setActiveStep(Math.min(Math.max(index, 0), steps.length - 1));
  }

  function editReviewField(sourceId: string) {
    if (isSubmitted || receipt) return;
    const stepId = schema ? schemaSourceStepId(schema, sourceId) : reviewSourceStepId(sourceId, workflow);
    const index = steps.findIndex((step) => step.id === stepId);
    setReviewEditTarget(sourceId);
    setStatus('Jumped to the source field. Update it, then return to Review Submission.');
    if (index > -1) setActiveStep(index);
  }

  function continueStep() {
    if (!isSubmitted && !receipt && !canLeaveStep(activeStep)) return;
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setActiveStep((current) => Math.max(current - 1, 0));
  }

  function canLeaveStep(index: number) {
    const step = steps[index];
    if (!step) return true;
    const currentSchemaStep = schemaStep(schema, step.id);
    if (currentSchemaStep && !isReviewStep(currentSchemaStep) && !isReceiptStep(currentSchemaStep)) {
      const missing = currentSchemaStep.fields.filter((field) => field.required && !schemaFieldComplete(field, schemaResponses, documents, samples));
      if (missing.length) {
        setStatus(`Complete required tender fields before continuing: ${missing.map((field) => field.label).join(', ')}.`);
        return false;
      }
      return true;
    }
    if (step.id === 'administrative' && !gate.complete) {
      setStatus(gate.message);
      return false;
    }
    if ((step.id.includes('financial') || step.id.includes('commercial')) && totalAmount <= 0) {
      setStatus('Complete the financial offer before continuing.');
      return false;
    }
    return true;
  }

  if (!tenderId) return <WorkspaceEmpty message="Open a tender from the marketplace to start or continue a bid." />;
  if (tenderLoading) return <WorkspaceEmpty message="Loading tender..." />;
  if (isError || !tender) return <WorkspaceEmpty message="Tender could not be loaded. Return to the marketplace and try again." />;
  if (schemaLoading) return <WorkspaceEmpty message="Loading bid response fields from the tender requirements..." />;
  if (!schema) return <WorkspaceEmpty message="Bid response fields could not be loaded from the tender requirements." />;

  const loadedTender = tender;
  const loadedSchema = schema;
  const isSubmitted = bid?.status === 'SUBMITTED';
  const uploading = Boolean(uploadingKey);
  const currentStepIndex = Math.min(activeStep, steps.length - 1);
  const currentStep = steps[currentStepIndex];
  const receiptVisible = Boolean(receipt && currentStep && isReceiptPanelStep(workflow, currentStep.id));

  return (
    <div className="procurement-app-page">
      <main className="procurement-market-shell">
        <div className="journey-page tender-wizard-page bid-flow-page" data-bid-total={totalAmount} data-bid-workflow={workflow}>
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
              Ask Buyer
            </Link>
            <button className="btn btn-secondary" type="button" disabled={saving || uploading || isSubmitted} onClick={saveDraft}>
              Save Draft
            </button>
            {isSubmitted ? (
              <button className="btn btn-secondary" type="button" disabled={saving || uploading} onClick={withdrawBid}>
                Withdraw
              </button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={saving || uploading} onClick={jumpToReview}>
                Review Submission
              </button>
            )}
          </div>
        </section>

        <section className="wizard-shell">
          <nav className="wizard-step-progress bid-step-progress" aria-label="Bid submission progress">
            {steps.map((step, index) => (
              <button className={`wizard-progress-step ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`} type="button" key={step.id} onClick={() => goToStep(index)}>
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <span>{step.label}</span>
              </button>
            ))}
          </nav>

          <aside className="wizard-rail">
            {steps.map((step, index) => (
              <button className={`wizard-rail-step ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`} type="button" key={step.id} onClick={() => goToStep(index)}>
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <span>{step.label}</span>
              </button>
            ))}
          </aside>

          <main className="wizard-workspace">
            <div className="form-status">{status}</div>
            <StepPanel kicker={currentStep.kicker} title={receiptVisible ? 'Submission Receipt' : currentStep.title} description={receiptVisible ? 'Bid hash and post-submission actions' : currentStep.description} badge={stepBadge(currentStep.id, validationIssues, documents, receipt, gate)} className={currentStep.id === 'administrative' ? 'bid-mandatory-gate' : undefined}>
              {renderStep(currentStep.id)}
            </StepPanel>
            <div className="wizard-flow-controls" data-bid-flow-controls>
              <button className="btn btn-secondary" type="button" disabled={currentStepIndex === 0 || saving || uploading} onClick={previousStep}>
                Back
              </button>
              <div className="wizard-flow-progress">
                <strong>{`Step ${currentStepIndex + 1} of ${steps.length} - ${completeness.percent}% complete`}</strong>
                <span>{currentStep.title}</span>
              </div>
              <button className="btn btn-primary" type="button" hidden={currentStepIndex === steps.length - 1} disabled={saving || uploading} onClick={continueStep}>
                Continue
              </button>
            </div>
          </main>
        </section>
        </div>
      </main>
    </div>
  );

  function renderStep(stepId: string) {
    if (receipt && isReceiptPanelStep(workflow, stepId)) {
      return <ReceiptPanel receipt={receipt} totalAmount={totalAmount} currency={loadedTender.currency} documents={documents} onWithdraw={withdrawBid} canWithdraw={!saving && !uploading && isSubmitted} />;
    }

    const currentSchemaStep = schemaStep(loadedSchema, stepId);
    if (currentSchemaStep) {
      if (isReviewStep(currentSchemaStep)) {
        return (
          <>
            <ReviewPanel
              tender={loadedTender}
              schema={loadedSchema}
              responses={schemaResponses}
              documents={documents}
              samples={samples}
              issues={validationIssues}
              totalAmount={totalAmount}
              currency={loadedTender.currency}
              completeness={completeness}
              isSubmitted={isSubmitted || Boolean(receipt)}
              onEditField={editReviewField}
            />
            {reviewStepSubmits(workflow, currentSchemaStep.id) ? (
              <>
                <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
                <SchemaStepFields step={currentSchemaStep} responses={schemaResponses} documents={documents} currency={loadedTender.currency} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
                <SchemaSubmitPanel saving={saving} uploading={uploading} isSubmitted={isSubmitted} onSave={saveDraft} onSubmit={submitBid} />
              </>
            ) : null}
          </>
        );
      }
      if (isReceiptStep(currentSchemaStep)) {
        return <div className="scope-empty">Submit the bid to generate a receipt.</div>;
      }
      if (isSampleStep(currentSchemaStep)) {
        return (
          <div data-bid-review-source-id={currentSchemaStep.id}>
            <SampleTrackingSection
              requirements={sampleRequirements}
              itemOptions={sampleItemOptions}
              samples={samples}
              edits={sampleEdits}
              loading={sampleLoading}
              saving={sampleSaving}
              disabled={saving || uploading || sampleSaving || Boolean(bid && bid.status !== 'DRAFT')}
              onAdd={addSampleRecord}
              onEdit={(sampleId, patch) => {
                setSampleEdits((current) => ({
                  ...current,
                  [sampleId]: { ...(current[sampleId] ?? emptySampleForm()), ...patch }
                }));
              }}
              onSave={saveSampleRecord}
              onSubmit={markSampleSubmitted}
            />
            <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
            <SchemaStepFields step={currentSchemaStep} responses={schemaResponses} documents={documents} currency={loadedTender.currency} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
          </div>
        );
      }
      if (isDeclarationStep(currentSchemaStep)) {
        return (
          <div data-bid-review-source-id={currentSchemaStep.id}>
            <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
            <SchemaStepFields step={currentSchemaStep} responses={schemaResponses} documents={documents} currency={loadedTender.currency} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
            <SchemaSubmitPanel saving={saving} uploading={uploading} isSubmitted={isSubmitted} onSave={saveDraft} onSubmit={submitBid} />
          </div>
        );
      }
      if (currentSchemaStep.id === 'administrative') {
        return (
          <AdministrativeGateSchemaPanel
            tender={loadedTender}
            gate={gate}
            step={currentSchemaStep}
            responses={schemaResponses}
            documents={documents}
            currency={loadedTender.currency}
            disabled={saving || uploading || isSubmitted || Boolean(receipt)}
            uploadingKey={uploadingKey}
            onPatch={patchSchemaResponse}
            onFiles={addFiles}
          />
        );
      }
      if (workflow === 'works' && currentSchemaStep.id === 'worksCapacity') {
        return (
          <>
            <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
            <WorksCapacitySchemaPanel
              step={currentSchemaStep}
              responses={schemaResponses}
              documents={documents}
              disabled={saving || uploading || isSubmitted || Boolean(receipt)}
              uploadingKey={uploadingKey}
              onPatch={patchSchemaResponse}
              onFiles={addFiles}
            />
          </>
        );
      }
      return (
        <>
          <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
          <SchemaStepFields step={currentSchemaStep} responses={schemaResponses} documents={documents} currency={loadedTender.currency} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
        </>
      );
    }

    return <div className="scope-empty">No bid response fields were configured for this section.</div>;
  }

  function uploadBoxState(requirementKey: string) {
    return {
      disabled: saving || sampleSaving || isSubmitted || uploading,
      isUploading: uploadingKey === requirementKey
    };
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

  function patchSchemaResponse(field: BidSubmissionSchemaFieldDto, value: unknown) {
    setSchemaResponses((current) => ({
      ...current,
      [field.requirementKey]: value,
      [field.id]: value
    }));
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

function StepPanel({ kicker, title, description, badge, className, children }: { kicker: string; title: string; description: string; badge: string; className?: string; children: ReactNode }) {
  return (
    <article className={`journey-panel active ${className ?? ''}`}>
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span className="badge badge-info">{badge}</span>
      </div>
      <div className="bid-step-intro">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </article>
  );
}

function BidCommandBar({
  tender,
  requiredInputs,
  totalAmount,
  documents,
  samples,
  validationIssues,
  completeness
}: {
  tender: TenderDetail;
  requiredInputs: number;
  totalAmount: number;
  documents: BidDocumentState[];
  samples: BidSampleDto[];
  validationIssues: string[];
  completeness: { percent: number; sectionsComplete: number; totalSections: number };
}) {
  const pendingCount = validationIssues.length;
  const readinessLabel = pendingCount ? `${pendingCount} pending` : 'Ready';
  return (
    <aside className="bid-command-bar" aria-label="Bid workspace status">
      <BidCommandMetric label="Required inputs" value={String(requiredInputs)} />
      <BidCommandMetric label="Evidence" value={String(documents.length)} />
      <BidCommandMetric label="Samples" value={String(samples.length)} />
      <BidCommandMetric label="Total" value={formatMoney(totalAmount, tender.currency || 'TZS')} />
      <div className={`bid-command-readiness ${pendingCount ? 'is-pending' : 'is-ready'}`}>
        <span>{readinessLabel}</span>
        <strong>{`${completeness.percent}% complete`}</strong>
      </div>
    </aside>
  );
}

function BidCommandMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bid-command-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkflowStepContext({ tender, workflow, step }: { tender: TenderDetail; workflow: WorkflowType; step: BidSubmissionSchemaStepDto }) {
  const context = workflowStepCopy(workflow, step.id);
  const configuredCount = step.fields.filter((field) => field.source !== 'system').length;
  if (isReviewStep(step) || isReceiptStep(step)) return null;
  return (
    <section className="bid-step-intro workflow-step-context">
      <div>
        <strong>{context.title}</strong>
        <span>{context.description}</span>
      </div>
      <div className="inline-actions">
        <span className="badge badge-info">{`${configuredCount} tender-driven item${configuredCount === 1 ? '' : 's'}`}</span>
        <Link className="btn btn-secondary" to={`/communication?view=compose&mode=clarification&tenderId=${encodeURIComponent(tender.id)}&category=${encodeURIComponent(context.category)}&context=${encodeURIComponent(context.askContext)}`}>
          Ask Buyer
        </Link>
      </div>
    </section>
  );
}

function workflowStepCopy(workflow: WorkflowType, stepId: string) {
  if (stepId === 'administrative') {
    return {
      title: 'Administrative compliance gate',
      description: 'Complete eligibility confirmations and required buyer documents before preparing the bid package.',
      category: 'Administrative',
      askContext: 'Question about eligibility, registration, license, or statutory evidence'
    };
  }
  if (['financial', 'goodsFinancial', 'worksFinancial', 'servicesCommercial', 'consultancyFinancial'].includes(stepId)) {
    return {
      title: workflow === 'consultancy' ? 'Sealed financial proposal' : workflow === 'works' ? 'BOQ and cost breakdown' : 'Commercial and pricing response',
      description: workflow === 'consultancy' ? 'Enter the financial proposal separately from the technical proposal for controlled evaluation.' : 'Price the commercial schedule configured in tender creation and attach financial evidence where required.',
      category: 'Financial',
      askContext: 'Question about pricing schedule, BOQ, currency, tax, or commercial terms'
    };
  }
  if (stepId === 'samples' || stepId === 'goodsSamples') {
    return {
      title: 'Sample submission response',
      description: 'Record sample preparation, dispatch, delivery details, and buyer-facing tracking information.',
      category: 'Samples',
      askContext: 'Question about sample submission, quantity, delivery, or return requirements'
    };
  }
  if (['declarations', 'goodsDeclaration', 'worksDeclaration'].includes(stepId)) {
    return {
      title: 'Supplier declaration and contract terms',
      description: 'Confirm accuracy, conflict-of-interest, anti-corruption, and tender term acceptance before sealing the bid.',
      category: 'Declarations',
      askContext: 'Question about declaration, contract terms, or submission confirmation'
    };
  }
  if (workflow === 'goods') {
    return {
      title: 'Goods technical response',
      description: 'Respond to product specifications, compliance, delivery, warranty, samples, and buyer-required evidence.',
      category: 'Technical',
      askContext: 'Question about goods product specifications or compliance'
    };
  }
  if (workflow === 'works') {
    if (stepId === 'worksCapacity') {
      return {
        title: 'Technical capacity and experience',
        description: 'Provide projects, personnel, equipment, financial capacity, HSE, and buyer-required evidence before the work proposal.',
        category: 'Technical Capacity',
        askContext: 'Question about works capacity, personnel, equipment, HSE, or experience requirements'
      };
    }
    if (stepId === 'worksTechnicalProposal') {
      return {
        title: 'Technical proposal and work program',
        description: 'Explain methodology, work program, site visit, drawings, alternative design, and delivery approach.',
        category: 'Technical Proposal',
        askContext: 'Question about drawings, site visit, milestones, or methodology'
      };
    }
    return {
      title: 'Works technical capacity and proposal',
      description: 'Respond to site visit, method statement, personnel, equipment, HSE, experience, drawings, and work program requirements.',
      category: 'Technical',
      askContext: 'Question about works methodology, personnel, equipment, HSE, or site visit requirements'
    };
  }
  if (workflow === 'services') {
    if (stepId === 'servicesMethodology') {
      return {
        title: 'Service understanding and methodology',
        description: 'Describe service approach, work methods, quality controls, and how the buyer scope will be delivered.',
        category: 'Methodology',
        askContext: 'Question about service methodology or scope'
      };
    }
    if (stepId === 'servicesDeliveryPlan') {
      return {
        title: 'Service schedule and delivery plan',
        description: 'Respond to milestones, deliverables, locations, timeline, reporting points, and acceptance expectations.',
        category: 'Delivery Plan',
        askContext: 'Question about service delivery schedule or milestones'
      };
    }
    if (stepId === 'servicesStaffing') {
      return {
        title: 'Staffing, capacity and continuity plan',
        description: 'Provide staff, supervision, tools, backup capacity, continuity arrangements, and related evidence.',
        category: 'Staffing',
        askContext: 'Question about staffing, capacity, continuity, or tools'
      };
    }
    if (stepId === 'servicesSla') {
      return {
        title: 'Performance, SLA, reporting and compliance',
        description: 'Confirm service levels, reports, QA, risk controls, compliance evidence, and operational governance.',
        category: 'SLA and Reporting',
        askContext: 'Question about SLA, reporting, QA, compliance, or risk controls'
      };
    }
    return {
      title: 'Service methodology and delivery plan',
      description: 'Respond to scope, staffing, workflow, SLA, reporting, risk, continuity, tools, and delivery milestones.',
      category: 'Technical',
      askContext: 'Question about service methodology, staffing, deliverables, or SLA requirements'
    };
  }
  if (workflow === 'consultancy') {
    if (stepId === 'consultancyTechnical') {
      return {
        title: 'Technical envelope',
        description: 'Respond to TOR understanding, methodology, work plan, objectives, deliverables, responsibilities, and expert CV requirements.',
        category: 'Technical Proposal',
        askContext: 'Question about consultancy TOR, methodology, work plan, or expert qualifications'
      };
    }
    if (stepId === 'consultancyReview') {
      return {
        title: 'Review and submit',
        description: 'Review the technical and financial envelopes, accept declarations, and submit the sealed consultancy bid.',
        category: 'Review',
        askContext: 'Question about final bid submission or declarations'
      };
    }
    return {
      title: 'Consultancy technical proposal',
      description: 'Respond to TOR understanding, methodology, key experts, deliverables, reporting, and firm experience.',
      category: 'Technical',
      askContext: 'Question about consultancy TOR, methodology, work plan, or expert qualifications'
    };
  }
  return {
    title: 'Tender response',
    description: 'Complete buyer-configured response fields and attach requested evidence.',
    category: 'Technical',
    askContext: 'Question about bid response requirements'
  };
}

function AdministrativeGateSchemaPanel({
  tender,
  gate,
  step,
  responses,
  documents,
  currency,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  tender: TenderDetail;
  gate: GateStatus;
  step: BidSubmissionSchemaStepDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  currency: string;
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const groups = administrativeGateGroups(step);
  const hasSubmissionSection = groups.submissionFields.length > 0;
  const hasOtherSection = groups.otherDocumentFields.length > 0;
  const declarationIndex = 2 + (hasSubmissionSection ? 1 : 0) + (hasOtherSection ? 1 : 0);

  return (
    <>
      <div className={`bid-gate-status ${gate.complete ? 'balanced' : ''}`}>{gate.message}</div>
      <div className="bid-prequalification-note">
        <strong>Eligibility and document requirements</strong>
        <span>Upload administrative eligibility documents and complete required confirmations before moving forward. Technical uploads are completed in the technical response steps, and financial capacity uploads are completed in the financial offer.</span>
      </div>
      <AdministrativeLicenseEvidenceSection fields={groups.licenseFields} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
      {hasSubmissionSection ? (
        <AdministrativeDocumentGroup
          index={2}
          kicker="Submission documents"
          title="Bid submission documents"
          description="Tender submission forms, signed bid documents, authorization letters, and buyer-required administrative submission files."
          fields={groups.submissionFields}
          responses={responses}
          documents={documents}
          disabled={disabled}
          uploadingKey={uploadingKey}
          onPatch={onPatch}
          onFiles={onFiles}
        />
      ) : null}
      {hasOtherSection ? (
        <AdministrativeDocumentGroup
          index={2 + (hasSubmissionSection ? 1 : 0)}
          kicker="Other documents"
          title="Other administrative supporting documents"
          description="Additional administrative evidence that is not a license, certification, technical upload, or financial capacity document."
          fields={groups.otherDocumentFields}
          responses={responses}
          documents={documents}
          disabled={disabled}
          uploadingKey={uploadingKey}
          onPatch={onPatch}
          onFiles={onFiles}
        />
      ) : null}
      <AdministrativeDocumentGroup
        index={declarationIndex}
        kicker="Eligibility declarations/confirmations"
        title="Administrative confirmations"
        fields={groups.declarationFields}
        responses={responses}
        documents={documents}
        disabled={disabled}
        uploadingKey={uploadingKey}
        onPatch={onPatch}
        onFiles={onFiles}
        emptyMessage="No additional confirmations are required."
        action={
          <Link className="btn btn-secondary btn-sm" to={`/communication?view=compose&mode=clarification&tenderId=${encodeURIComponent(tender.id)}&category=Administrative&context=eligibility`}>
            Ask Buyer
          </Link>
        }
      />
    </>
  );
}

function AdministrativeLicenseEvidenceSection({
  fields,
  documents,
  disabled,
  uploadingKey,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const mandatoryCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(fields.length - mandatoryCount, 0);
  return (
    <div className="bid-gate-group license-compliance-matrix">
      <div className="bid-gate-group-heading">
        <div>
          <span className="section-kicker">1. Licenses and certifications</span>
          <h3>{fields.length ? 'Regulatory license evidence' : 'License and certification documents'}</h3>
          <p>Upload the required license evidence in the table below. Each row shows the license name first and the issuing board or authority below it.</p>
        </div>
        <span className={`badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}`}>{`${mandatoryCount} mandatory / ${optionalCount} optional`}</span>
      </div>
      {fields.length ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Permit / license</th>
                <th>Status</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} data-bid-review-source-id={field.id}>
                  <td>
                    <div className="license-permit-cell">
                      <strong>{field.label}</strong>
                      <small>
                        <span>Issuing body</span>
                        {administrativeFieldDetail(field)}
                      </small>
                    </div>
                  </td>
                  <td>
                    <select className="form-input" defaultValue="" disabled={disabled} aria-label={`${field.label} status`}>
                      <option value="">Select</option>
                      <option value="Valid">Valid</option>
                      <option value="Renewal in progress">Renewal in progress</option>
                      <option value="Not applicable">Not applicable</option>
                    </select>
                  </td>
                  <td>
                    <AdministrativeUploadField field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty">The buyer has not requested any license or certification documents for this tender.</div>
      )}
    </div>
  );
}

function AdministrativeDocumentGroup({
  index,
  kicker,
  title,
  description,
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles,
  emptyMessage = 'No documents were configured for this section.',
  action
}: {
  index: number;
  kicker: string;
  title: string;
  description?: string;
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
  emptyMessage?: string;
  action?: ReactNode;
}) {
  const mandatoryCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(fields.length - mandatoryCount, 0);
  const badgeText = fields.length && optionalCount ? `${mandatoryCount} mandatory / ${optionalCount} optional` : fields.length ? `${mandatoryCount} mandatory` : '0 items';
  return (
    <div className="bid-gate-group">
      <div className="bid-gate-group-heading">
        <div>
          <span className="section-kicker">{`${index}. ${kicker}`}</span>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="inline-actions">
          <span className={`badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}`}>{badgeText}</span>
          {action}
        </div>
      </div>
      {fields.length ? (
        <div className="bid-requirement-list">
          {fields.map((field) => {
            const value = schemaFieldValue(field, responses);
            return isAdministrativeConfirmationField(field) ? (
              <AdministrativeConfirmationCard key={field.id} field={field} checked={value === true} disabled={disabled} onChange={(checked) => onPatch(field, checked)} />
            ) : (
              <SchemaFieldControl key={field.id} field={field} value={value} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
            );
          })}
        </div>
      ) : (
        <div className="scope-empty">{emptyMessage}</div>
      )}
    </div>
  );
}

function AdministrativeConfirmationCard({
  field,
  checked,
  disabled,
  onChange
}: {
  field: BidSubmissionSchemaFieldDto;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <article className={`bid-requirement-card ${checked ? 'completed' : ''}`} data-bid-review-source-id={field.id}>
      <div className="bid-response-card-heading">
        <div>
          <span className="section-kicker">{administrativeConfirmationCategory(field)}</span>
          <h3>{field.label}</h3>
          <p>{administrativeConfirmationDescription(field)}</p>
        </div>
        <em className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</em>
      </div>
      <label className="bid-response-check">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span>I confirm and accept this requirement.</span>
      </label>
    </article>
  );
}

function AdministrativeUploadField({
  field,
  documents,
  disabled,
  uploadingKey,
  onFiles
}: {
  field: BidSubmissionSchemaFieldDto;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const uploaded = documentsForSchemaField(documents, field);
  const hint = String(field.validation.prompt ?? '');
  return (
    <div>
      <UploadBox
        envelope={field.envelope}
        title="Upload license evidence"
        documentType={String(field.validation.documentType ?? field.responseType ?? 'BID_DOCUMENT')}
        requirementKey={field.requirementKey}
        disabled={disabled}
        isUploading={uploadingKey === field.requirementKey}
        onFiles={(files, envelope, documentType, requirementKey) => onFiles(files, envelope, documentType, requirementKey, field.label)}
      />
      {uploaded.length ? <span className="form-hint">{`Uploaded: ${documentNames(uploaded)}`}</span> : hint ? <span className="form-hint">{hint}</span> : null}
    </div>
  );
}

function administrativeGateGroups(step: BidSubmissionSchemaStepDto) {
  const fields = step.fields.filter((field) => field.section === 'administrative');
  const documentFields = fields.filter(isAdministrativeAttachmentField);
  const licenseFields = documentFields.filter(isAdministrativeLicenseField);
  const remainingDocumentFields = documentFields.filter((field) => !licenseFields.includes(field));
  const submissionFields = remainingDocumentFields.filter(isAdministrativeSubmissionDocumentField);
  const otherDocumentFields = remainingDocumentFields.filter((field) => !submissionFields.includes(field));
  const declarationFields = fields.filter((field) => !isAdministrativeAttachmentField(field));

  return {
    licenseFields,
    submissionFields,
    otherDocumentFields,
    declarationFields
  };
}

function isAdministrativeAttachmentField(field: BidSubmissionSchemaFieldDto) {
  return field.type === 'file' || field.responseType === 'attachment';
}

function isAdministrativeLicenseField(field: BidSubmissionSchemaFieldDto) {
  const text = administrativeFieldSearchText(field);
  return /license|certificate|registration|permit|regulatory|crb|osha|statutory|tax clearance|vat registration|manufacturer authorization|authorization/i.test(text);
}

function isAdministrativeSubmissionDocumentField(field: BidSubmissionSchemaFieldDto) {
  const text = administrativeFieldSearchText(field);
  return /submission|bid form|signed|signature|power of attorney|authority letter|authorization letter|administrative submission/i.test(text);
}

function administrativeFieldSearchText(field: BidSubmissionSchemaFieldDto) {
  return [
    field.label,
    field.requirementKey,
    field.source,
    field.validation.documentType,
    field.validation.prompt,
    field.validation.description,
    field.validation.requirementDescription
  ]
    .filter(Boolean)
    .join(' ');
}

function administrativeFieldDetail(field: BidSubmissionSchemaFieldDto) {
  const prompt = String(field.validation.prompt ?? '').trim();
  if (prompt) return prompt;
  const source = String(field.source || field.requirementKey || field.envelope).replace(/\.\d+$/, '');
  return humanize(source);
}

function isAdministrativeConfirmationField(field: BidSubmissionSchemaFieldDto) {
  return field.section === 'administrative' && (field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'declaration' || field.responseType === 'acknowledgement');
}

function administrativeConfirmationCategory(field: BidSubmissionSchemaFieldDto) {
  const category = String(field.validation.category ?? field.validation.group ?? '').trim();
  return category || 'Administrative compliance';
}

function administrativeConfirmationDescription(field: BidSubmissionSchemaFieldDto) {
  const prompt = String(field.validation.prompt ?? field.validation.description ?? field.validation.requirementDescription ?? '').trim();
  if (prompt) return prompt;
  if (/authorized/i.test(field.label)) return 'Confirm the submitted bid is approved by an authorized representative of the supplier.';
  if (/similar project/i.test(field.label)) return 'Confirm that similar completed project evidence is completed in the technical capacity response.';
  if (/eligib/i.test(field.label)) return 'Confirm the supplier meets the eligibility requirements for this tender.';
  return 'Supplier response required.';
}

function WorksCapacitySchemaPanel({
  step,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  step: BidSubmissionSchemaStepDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const groups = worksCapacityGroups(step);
  const hasAnyGroupedSection = groups.similarProjects.length || groups.personnel.length || groups.equipment.length || groups.hse.length || groups.remaining.length;
  if (!hasAnyGroupedSection) return <div className="scope-empty">No technical capacity fields were configured for this tender.</div>;
  return (
    <div className="works-capacity-workbook">
      {groups.similarProjects.length ? <WorksSimilarProjectsSection fields={groups.similarProjects} responses={responses} disabled={disabled} onPatch={onPatch} /> : null}
      {groups.personnel.length ? <WorksPersonnelSection fields={groups.personnel} responses={responses} disabled={disabled} onPatch={onPatch} /> : null}
      {groups.equipment.length ? <WorksEquipmentSection fields={groups.equipment} responses={responses} disabled={disabled} onPatch={onPatch} /> : null}
      {groups.hse.length ? <WorksCapacityFallbackSection title="Health, Safety and Environmental Response" description="Provide site-specific safety, environmental, incident, PPE, and waste management controls." fields={groups.hse} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} /> : null}
      {groups.remaining.length ? <WorksCapacityFallbackSection title="Additional capacity responses" description="Complete the remaining buyer-configured technical capacity fields for this works tender." fields={groups.remaining} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} /> : null}
    </div>
  );
}

function WorksSimilarProjectsSection({
  fields,
  responses,
  disabled,
  onPatch
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  const required = fields.some((field) => field.required);
  return (
    <section className="works-response-section">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Similar completed projects</h3>
          <p>Upload documents explaining previous similar projects, including any completion proof, references, and client details.</p>
        </div>
        <span className={`badge ${required ? 'badge-warning' : 'badge-info'}`}>{required ? 'Required' : 'Optional'}</span>
      </div>
      <div className="works-card-grid" data-works-similar-project-list>
        {fields.map((field, index) => {
          const value = structuredValue(schemaFieldValue(field, responses));
          return (
            <article className="works-capacity-card" data-bid-review-source-id={field.id} data-works-similar-project-card key={field.id}>
              <div className="bid-dynamic-group-heading">
                <span className="section-kicker">{`Similar project ${index + 1}`}</span>
              </div>
              <div className="form-grid two">
                <WorksStructuredInput field={field} value={value} fieldKey="projectName" label="Project / client" disabled={disabled} onPatch={onPatch} />
                <WorksStructuredInput field={field} value={value} fieldKey="contractValue" label="Value" type="number" disabled={disabled} onPatch={onPatch} />
                <WorksStructuredInput field={field} value={value} fieldKey="completionDate" label="Completion / status" disabled={disabled} onPatch={onPatch} />
                <WorksStructuredInput field={field} value={value} fieldKey="referenceEvidence" label="Evidence / attachment reference" disabled={disabled} onPatch={onPatch} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WorksPersonnelSection({
  fields,
  responses,
  disabled,
  onPatch
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <section className="works-response-section">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Key personnel</h3>
          <p>Add personnel positions and upload the matching CV for each person.</p>
        </div>
        <span className={`badge ${fields.some((field) => field.required) ? 'badge-warning' : 'badge-info'}`}>{`${fields.length} profile${fields.length === 1 ? '' : 's'}`}</span>
      </div>
      <div className="works-personnel-grid" data-works-personnel-list>
        {fields.map((field, index) => {
          const value = structuredValue(schemaFieldValue(field, responses));
          return (
            <article className="works-person-card" data-bid-review-source-id={field.id} data-works-personnel-card key={field.id}>
              <div className="works-person-avatar">{worksAvatarLetter(field.label)}</div>
              <div>
                <div className="bid-dynamic-group-heading">
                  <span className="section-kicker">{`Personnel ${index + 1}`}</span>
                </div>
                <div className="form-grid two">
                  <WorksStructuredInput field={field} value={value} fieldKey="namedResource" label="Personnel Position" disabled={disabled} onPatch={onPatch} />
                  <WorksStructuredInput field={field} value={value} fieldKey="qualification" label="Qualification / certification" disabled={disabled} onPatch={onPatch} />
                  <WorksStructuredInput field={field} value={value} fieldKey="experienceYears" label="Years experience" type="number" disabled={disabled} onPatch={onPatch} />
                  <WorksStructuredInput field={field} value={value} fieldKey="cvEvidence" label="CV / evidence reference" disabled={disabled} onPatch={onPatch} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WorksEquipmentSection({
  fields,
  responses,
  disabled,
  onPatch
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <section className="works-response-section">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Equipment capacity</h3>
          <p>Confirm ownership or access to plant, tools, transport, and specialized equipment.</p>
        </div>
        <span className="badge badge-warning">{`${fields.length} equipment item${fields.length === 1 ? '' : 's'}`}</span>
      </div>
      <div className="data-table works-equipment-table">
        <table>
          <thead>
            <tr>
              <th>Equipment Name</th>
              <th>Quantity Available</th>
              <th>Ownership Status</th>
              <th>Lease / Access Agreement</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const value = structuredValue(schemaFieldValue(field, responses));
              return (
                <tr className="works-equipment-row" data-bid-review-source-id={field.id} key={field.id}>
                  <td className="works-equipment-name">
                    <strong>{worksEquipmentName(field, index)}</strong>
                    <small>{worksEquipmentDetail(field)}</small>
                  </td>
                  <td>
                    <WorksStructuredInput field={field} value={value} fieldKey="quantityAvailable" label={`Quantity available for ${worksEquipmentName(field, index)}`} type="number" labelHidden disabled={disabled} onPatch={onPatch} />
                  </td>
                  <td>
                    <WorksStructuredSelect field={field} value={value} fieldKey="ownershipStatus" label={`Ownership status for ${worksEquipmentName(field, index)}`} options={['Owned', 'Leased', 'Hire agreement', 'Subcontractor provided']} disabled={disabled} onPatch={onPatch} />
                  </td>
                  <td>
                    <WorksStructuredInput field={field} value={value} fieldKey="leaseAgreement" label="Lease / access agreement" labelHidden disabled={disabled} onPatch={onPatch} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorksCapacityFallbackSection({
  title,
  description,
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  title: string;
  description: string;
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const required = fields.some((field) => field.required);
  return (
    <section className="works-response-section">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`badge ${required ? 'badge-warning' : 'badge-info'}`}>{required ? 'Response required' : 'Optional response'}</span>
      </div>
      <div className="form-grid two">
        {fields.map((field) => (
          <SchemaFieldControl key={field.id} field={field} value={schemaFieldValue(field, responses)} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
        ))}
      </div>
    </section>
  );
}

function WorksStructuredInput({
  field,
  value,
  fieldKey,
  label,
  type = 'text',
  labelHidden = false,
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: Record<string, unknown>;
  fieldKey: string;
  label: string;
  type?: 'text' | 'number';
  labelHidden?: boolean;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <div className="form-group">
      {labelHidden ? null : <label className="form-label">{label}</label>}
      <input className="form-input" type={type} min={type === 'number' ? 0 : undefined} aria-label={label} value={String(value[fieldKey] ?? '')} disabled={disabled} onChange={(event) => worksPatchStructuredField(field, value, fieldKey, type === 'number' ? Number(event.target.value) || 0 : event.target.value, onPatch)} />
    </div>
  );
}

function WorksStructuredSelect({
  field,
  value,
  fieldKey,
  label,
  options,
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: Record<string, unknown>;
  fieldKey: string;
  label: string;
  options: string[];
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <div className="form-group">
      <select className="form-input" aria-label={label} value={String(value[fieldKey] ?? '')} disabled={disabled} onChange={(event) => worksPatchStructuredField(field, value, fieldKey, event.target.value, onPatch)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function worksCapacityGroups(step: BidSubmissionSchemaStepDto) {
  const fields = step.fields.filter((field) => field.section !== 'receipt' && field.section !== 'review');
  const similarProjects = fields.filter((field) => worksFieldControl(field) === 'worksSimilarProject');
  const personnel = fields.filter((field) => worksFieldControl(field) === 'worksPersonnel');
  const equipment = fields.filter((field) => worksFieldControl(field) === 'worksEquipment');
  const grouped = new Set([...similarProjects, ...personnel, ...equipment]);
  const hse = fields.filter((field) => !grouped.has(field) && isWorksHseField(field));
  hse.forEach((field) => grouped.add(field));
  const remaining = fields.filter((field) => !grouped.has(field));
  return { similarProjects, personnel, equipment, hse, remaining };
}

function worksFieldControl(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.control ?? '');
}

function isWorksHseField(field: BidSubmissionSchemaFieldDto) {
  return /hse|health|safety|environment|environmental|osha|ppe|incident|waste/i.test(worksFieldSearchText(field));
}

function worksFieldSearchText(field: BidSubmissionSchemaFieldDto) {
  return [field.id, field.label, field.requirementKey, field.source, field.validation.control, field.validation.prompt, field.validation.description, field.validation.requirementDescription].filter(Boolean).join(' ');
}

function worksPatchStructuredField(field: BidSubmissionSchemaFieldDto, value: Record<string, unknown>, key: string, nextValue: unknown, onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void) {
  onPatch(field, { ...value, [key]: nextValue });
}

function worksAvatarLetter(label: string) {
  return String(label || 'P').trim().slice(0, 1).toUpperCase() || 'P';
}

function worksEquipmentName(field: BidSubmissionSchemaFieldDto, index: number) {
  return String(field.validation.equipmentName ?? field.validation.resource ?? field.validation.itemName ?? field.label ?? `Equipment ${index + 1}`);
}

function worksEquipmentDetail(field: BidSubmissionSchemaFieldDto) {
  const quantity = field.validation.quantity ?? field.validation.requiredQuantity ?? field.validation.qty ?? '1';
  const ownership = field.validation.ownershipRequirement ?? field.validation.ownership ?? field.validation.prompt ?? 'Evidence required';
  return `Requested: ${String(quantity)} / ${String(ownership)}`;
}

function SchemaStepFields({
  step,
  responses,
  documents,
  currency,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  step: BidSubmissionSchemaStepDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  currency: string;
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const fields = step.fields.filter((field) => {
    if (field.section === 'receipt') return false;
    if (field.section === 'review' && !isReviewStep(step)) return false;
    if (isSampleStep(step) && field.responseType === 'structured') return false;
    return true;
  });
  if (!fields.length) return <div className="scope-empty">No bid response fields were configured for this section.</div>;
  if (fields.some(isSchemaBoqPricingField)) {
    const pricingFields = fields.filter(isSchemaBoqPricingField);
    const otherFields = fields.filter((field) => !isSchemaBoqPricingField(field));
    return (
      <div className="bid-schema-field-list">
        {pricingFields.length ? <SchemaFinancialTable fields={pricingFields} responses={responses} currency={currency} disabled={disabled} onPatch={onPatch} /> : null}
        {otherFields.map((field) => (
          <SchemaFieldControl key={field.id} field={field} value={schemaFieldValue(field, responses)} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
        ))}
      </div>
    );
  }
  return (
    <div className="bid-schema-field-list">
      {fields.map((field) => (
        <SchemaFieldControl key={field.id} field={field} value={schemaFieldValue(field, responses)} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
      ))}
    </div>
  );
}

function SchemaFinancialTable({
  fields,
  responses,
  currency,
  disabled,
  onPatch
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  currency: string;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  const grandTotal = fields.reduce((sum, field) => sum + schemaFinancialFieldTotal(field, responses), 0);
  return (
    <section className="bid-financial-boq" aria-label="BOQ pricing schedule">
      <div className="bid-financial-boq-heading">
        <div>
          <h3>BOQ pricing schedule</h3>
          <span>{`${fields.length} tender line item${fields.length === 1 ? '' : 's'} ready for pricing`}</span>
        </div>
        <div className="bid-financial-boq-total">
          <span>Bid total</span>
          <strong>{formatMoney(grandTotal, currency)}</strong>
        </div>
      </div>
      <div className="bid-financial-boq-scroll">
        <table className="bid-financial-boq-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const row = schemaFinancialRow(field, responses, index);
              return (
                <tr data-bid-review-source-id={field.id} key={field.id}>
                  <td className="bid-boq-item-no">{row.itemNo}</td>
                  <td className="bid-boq-description">{row.description}</td>
                  <td className="bid-boq-number">{String(row.quantity)}</td>
                  <td>{row.unit}</td>
                  <td>
                    <div className="bid-boq-rate-field">
                      <span>{currency}</span>
                      <input className="form-input" type="number" min={Number(field.validation.min ?? 0)} value={String(schemaFieldValue(field, responses) ?? '')} disabled={disabled} aria-label={`Rate for ${row.description}`} onChange={(event) => onPatch(field, Number(event.target.value) || 0)} />
                    </div>
                  </td>
                  <td className="bid-boq-total">{formatMoney(row.total ?? 0, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SchemaFieldControl({
  field,
  value,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  field: BidSubmissionSchemaFieldDto;
  value: unknown;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  const sourceId = field.id;
  const hint = String(field.validation.prompt ?? '');
  if (field.type === 'file' || field.responseType === 'attachment') {
    const uploaded = documentsForSchemaField(documents, field);
    return (
      <div data-bid-review-source-id={sourceId}>
        <UploadBox
          envelope={field.envelope}
          title={field.label}
          documentType={String(field.validation.documentType ?? field.responseType ?? 'BID_DOCUMENT')}
          requirementKey={field.requirementKey}
          disabled={disabled}
          isUploading={uploadingKey === field.requirementKey}
          onFiles={onFiles}
        />
        {uploaded.length ? <span className="form-hint">{`Uploaded: ${documentNames(uploaded)}`}</span> : hint ? <span className="form-hint">{hint}</span> : null}
      </div>
    );
  }

  if (field.type === 'table' || field.responseType === 'structured') {
    return <StructuredResponseControl field={field} value={value} disabled={disabled} onPatch={(nextValue) => onPatch(field, nextValue)} />;
  }

  if (field.responseType === 'money' || field.responseType === 'pricing') {
    return (
      <label data-bid-review-source-id={sourceId}>
        <span>{field.label}</span>
        <input className="form-input" type="number" min={Number(field.validation.min ?? 0)} value={String(value ?? '')} disabled={disabled} onChange={(event) => onPatch(field, Number(event.target.value) || 0)} />
        <small className="form-hint">{schemaFinancialHint(field)}</small>
      </label>
    );
  }

  if (field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'declaration' || field.responseType === 'acknowledgement') {
    return (
      <div data-bid-review-source-id={sourceId}>
        <CheckCard label={field.label} checked={value === true} disabled={disabled} onChange={(checked) => onPatch(field, checked)} />
        {hint ? <span className="form-hint">{hint}</span> : null}
      </div>
    );
  }

  if (field.type === 'select' && Array.isArray(field.validation.options)) {
    const options = field.validation.options.map(String);
    return (
      <label data-bid-review-source-id={sourceId}>
        <span>{field.label}</span>
        <select className="form-input" value={String(value ?? '')} disabled={disabled} onChange={(event) => onPatch(field, event.target.value)}>
          <option value="">Select response</option>
          {options.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        {hint ? <small className="form-hint">{hint}</small> : null}
      </label>
    );
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  if (field.type === 'textarea' || field.responseType === 'text') {
    return <TextArea label={field.label} value={String(value ?? '')} disabled={disabled} hint={hint} sourceId={sourceId} onChange={(nextValue) => onPatch(field, nextValue)} />;
  }

  return <Input label={field.label} value={String(value ?? '')} type={inputType} disabled={disabled} hint={hint} sourceId={sourceId} onChange={(nextValue) => onPatch(field, field.type === 'number' ? Number(nextValue) || 0 : nextValue)} />;
}

function StructuredResponseControl({
  field,
  value,
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: unknown;
  disabled: boolean;
  onPatch: (value: Record<string, unknown>) => void;
}) {
  const current = structuredValue(value);
  const control = String(field.validation.control ?? '');
  const title = structuredControlTitle(control, field.label);
  const prompt = String(field.validation.prompt ?? field.validation.buyerRequirement ?? schemaRequirementText(field));
  const rows = structuredControlRows(control, field);

  function patch(key: string, nextValue: unknown) {
    onPatch({ ...current, [key]: nextValue });
  }

  return (
    <section className="premium-response-matrix" data-bid-review-source-id={field.id}>
      <div className="premium-response-matrix-heading">
        <div>
          <span>{field.required ? 'Mandatory structured response' : 'Structured response'}</span>
          <strong>{title}</strong>
          <p>{prompt}</p>
        </div>
        <em>{field.envelope}</em>
      </div>
      <div className="data-table service-category-response-table">
        <table>
          <thead>
            <tr>
              <th>Buyer requirement</th>
              {rows.map((row) => (
                <th key={row.key}>{row.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="premium-response-table-row">
              <td>
                <div className="premium-response-row-label">
                  <span>{String(field.validation.rowIndex ?? '01').padStart(2, '0')}</span>
                  <div>
                    <strong>{field.label}</strong>
                    <small>{prompt}</small>
                  </div>
                </div>
              </td>
              {rows.map((row) => (
                <td className="premium-response-cell" key={row.key}>
                  {row.kind === 'select' ? (
                    <select className="form-input premium-response-input" aria-label={`${field.label} ${row.label}`} value={String(current[row.key] ?? '')} disabled={disabled} onChange={(event) => patch(row.key, event.target.value)}>
                      <option value="">Select</option>
                      {(row.options ?? []).map((option) => (
                        <option value={option} key={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : row.kind === 'number' ? (
                    <input className="form-input premium-response-input" aria-label={`${field.label} ${row.label}`} type="number" min="0" value={String(current[row.key] ?? '')} disabled={disabled} onChange={(event) => patch(row.key, Number(event.target.value) || 0)} />
                  ) : (
                    <textarea className="form-input premium-response-input" aria-label={`${field.label} ${row.label}`} rows={row.long ? 4 : 2} value={String(current[row.key] ?? '')} disabled={disabled} onChange={(event) => patch(row.key, event.target.value)} />
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

type StructuredControlRow = {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'select';
  options?: string[];
  long?: boolean;
};

function structuredControlRows(control: string, field: BidSubmissionSchemaFieldDto): StructuredControlRow[] {
  if (control === 'goodsProductSpecification') {
    return [
      { key: 'complianceStatus', label: 'Compliance', kind: 'select', options: ['Compliant', 'Partially compliant', 'Not compliant'] },
      { key: 'offeredSpecification', label: 'Supplier offered specification', long: true },
      { key: 'evidenceReference', label: 'Evidence / attachment reference' },
      { key: 'deviations', label: 'Deviations / comments', long: true }
    ];
  }
  if (control === 'worksSimilarProject') {
    return [
      { key: 'projectName', label: 'Project / client' },
      { key: 'contractValue', label: 'Value', kind: 'number' },
      { key: 'completionDate', label: 'Completion / status' },
      { key: 'referenceEvidence', label: 'Reference evidence' }
    ];
  }
  if (control === 'worksPersonnel' || control === 'serviceStaffing' || control === 'consultancyKeyExpert') {
    return [
      { key: 'namedResource', label: control === 'consultancyKeyExpert' ? 'Proposed expert' : 'Named resource' },
      { key: 'qualification', label: 'Qualification / certification' },
      { key: 'experienceYears', label: 'Years experience', kind: 'number' },
      { key: 'cvEvidence', label: 'CV / evidence reference' }
    ];
  }
  if (control === 'worksEquipment' || control === 'serviceEquipment') {
    return [
      { key: 'resource', label: 'Equipment / tool' },
      { key: 'availability', label: 'Availability', kind: 'select', options: ['Owned', 'Leased', 'Available on award', 'Not available'] },
      { key: 'mobilization', label: 'Mobilization timing' },
      { key: 'evidenceReference', label: 'Ownership / lease evidence' }
    ];
  }
  if (control === 'worksWorkProgram' || control === 'serviceMilestone' || control === 'serviceDeliverable' || control === 'consultancyDeliverable' || control === 'consultancyReporting') {
    return [
      { key: 'approach', label: 'Supplier approach', long: true },
      { key: 'schedule', label: 'Schedule / due date' },
      { key: 'responsibleLead', label: 'Responsible lead' },
      { key: 'evidenceReference', label: 'Evidence / output reference' }
    ];
  }
  if (control === 'serviceRisk') {
    return [
      { key: 'riskLevel', label: 'Risk level', kind: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      { key: 'mitigation', label: 'Mitigation action', long: true },
      { key: 'contingency', label: 'Contingency plan', long: true },
      { key: 'owner', label: 'Owner' }
    ];
  }
  if (control.startsWith('consultancy')) {
    return [
      { key: 'understanding', label: 'Understanding / response', long: true },
      { key: 'methodology', label: 'Methodology / work plan', long: true },
      { key: 'teamOrEvidence', label: 'Team / evidence' },
      { key: 'assumptions', label: 'Assumptions / comments', long: true }
    ];
  }
  return [
    { key: 'response', label: 'Supplier response', long: true },
    { key: 'evidenceReference', label: 'Evidence reference' },
    { key: 'remarks', label: 'Remarks', long: true }
  ];
}

function structuredControlTitle(control: string, fallback: string) {
  const labels: Record<string, string> = {
    goodsProductSpecification: 'Product specification compliance response',
    goodsDeliveryPlan: 'Delivery and logistics response',
    goodsWarranty: 'Warranty and after-sales response',
    worksSiteVisit: 'Site visit response',
    worksSimilarProject: 'Similar completed project evidence',
    worksPersonnel: 'Key personnel response',
    worksEquipment: 'Equipment and resource response',
    worksWorkProgram: 'Work program response',
    worksMethodStatement: 'Method statement response',
    serviceMethodology: 'Service methodology response',
    serviceStaffing: 'Staffing and supervision response',
    serviceEquipment: 'Tools and equipment response',
    serviceMilestone: 'Delivery milestone response',
    serviceDeliverable: 'Service deliverable response',
    serviceRisk: 'Risk and continuity response',
    consultancyTorUnderstanding: 'TOR understanding response',
    consultancyKeyExpert: 'Key expert response'
  };
  return labels[control] ?? fallback;
}

function structuredValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasMeaningfulStructuredResponse(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).some((item) => {
    if (item === null || item === undefined) return false;
    if (typeof item === 'number') return Number.isFinite(item) && item > 0;
    if (typeof item === 'boolean') return item;
    return String(item).trim().length > 0;
  });
}

function structuredResponseSummary(value: unknown) {
  const payload = structuredValue(value);
  return Object.entries(payload)
    .filter(([, item]) => item !== null && item !== undefined && String(item).trim())
    .slice(0, 4)
    .map(([key, item]) => `${humanize(key)}: ${String(item)}`)
    .join(' / ');
}

function SchemaSubmitPanel({ saving, uploading, isSubmitted, onSave, onSubmit }: { saving: boolean; uploading: boolean; isSubmitted: boolean; onSave: () => void; onSubmit: () => void }) {
  return (
    <div className="submit-strip">
      <div>
        <strong>Ready to seal</strong>
        <span>The system will check required tender response fields, seal the bid package, and store a receipt.</span>
      </div>
      <button className="btn btn-secondary" type="button" disabled={saving || uploading || isSubmitted} onClick={onSave}>
        Save Draft
      </button>
      <button className="btn btn-primary" type="button" disabled={saving || uploading || isSubmitted} onClick={onSubmit}>
        Submit Sealed Bid
      </button>
    </div>
  );
}

function CheckCard({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="tender-detail-field-card">
      <span>{label}</span>
      <strong>{checked ? 'Confirmed' : 'Pending'}</strong>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function TextArea({ label, value, disabled = false, hint, sourceId, onChange }: { label: string; value: string; disabled?: boolean; hint?: string; sourceId?: string; onChange: (value: string) => void }) {
  return (
    <label data-bid-review-source-id={sourceId}>
      <span>{label}</span>
      <textarea className="form-input" rows={5} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small className="form-hint">{hint}</small> : null}
    </label>
  );
}

function Input({ label, value, type = 'text', disabled = false, hint, sourceId, onChange }: { label: string; value: string; type?: string; disabled?: boolean; hint?: string; sourceId?: string; onChange: (value: string) => void }) {
  return (
    <label data-bid-review-source-id={sourceId}>
      <span>{label}</span>
      <input className="form-input" type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small className="form-hint">{hint}</small> : null}
    </label>
  );
}

function UploadBox({
  envelope,
  title,
  documentType,
  requirementKey,
  disabled,
  isUploading,
  onFiles
}: {
  envelope: Envelope;
  title: string;
  documentType: string;
  requirementKey: string;
  disabled: boolean;
  isUploading: boolean;
  onFiles: (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string) => Promise<void>;
}) {
  return (
    <label className="supplier-requirement-preview">
      <span>{isUploading ? 'Uploading...' : `${envelope} documents`}</span>
      <strong>{title}</strong>
      <input
        className="form-input"
        type="file"
        multiple
        disabled={disabled}
        onChange={(event) => {
          const input = event.currentTarget;
            void onFiles(input.files, envelope, documentType, requirementKey, title).finally(() => {
            input.value = '';
          });
        }}
      />
    </label>
  );
}

function SampleTrackingSection({
  requirements,
  itemOptions,
  samples,
  edits,
  loading,
  saving,
  disabled,
  onAdd,
  onEdit,
  onSave,
  onSubmit
}: {
  requirements: SampleRequirement[];
  itemOptions: SampleItemOption[];
  samples: BidSampleDto[];
  edits: Record<string, SampleFormState>;
  loading: boolean;
  saving: boolean;
  disabled: boolean;
  onAdd: (input: SampleFormState) => Promise<boolean>;
  onEdit: (sampleId: string, patch: Partial<SampleFormState>) => void;
  onSave: (sample: BidSampleDto) => Promise<void>;
  onSubmit: (sample: BidSampleDto) => Promise<void>;
}) {
  const [newSample, setNewSample] = useState<SampleFormState>(() => emptySampleForm(requirements[0], itemOptions[0]?.value));

  useEffect(() => {
    setNewSample(emptySampleForm(requirements[0], itemOptions[0]?.value));
  }, [requirements, itemOptions]);

  return (
    <section className="goods-requirements-section">
      <div className="scope-list-heading">
        <div>
          <h3>Sample Submission</h3>
          <span className="form-hint">Track physical sample dispatch and buyer status updates.</span>
        </div>
      </div>

      {requirements.length ? (
        <div className="tender-detail-card-list">
          {requirements.map((requirement) => (
            <article className="supplier-requirement-preview" key={requirement.id}>
              <span>{requirement.mandatory ? 'Mandatory sample' : 'Sample requirement'}</span>
              <strong>{requirement.sampleName}</strong>
              <p>
                {displayRelatedItem(requirement.relatedItem, itemOptions)}
                {requirement.quantity ? ` / Qty ${requirement.quantity}` : ''}
                {requirement.deliveryLocation ? ` / ${requirement.deliveryLocation}` : ''}
                {requirement.deliveryDeadline ? ` / Due ${formatDateOnly(requirement.deliveryDeadline)}` : ''}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="form-grid">
        <label>
          <span>Related item</span>
          <select className="form-input" value={newSample.relatedItem} disabled={disabled} onChange={(event) => setNewSample((current) => mergeSampleRequirementDefaults({ ...current, relatedItem: event.target.value }, requirements))}>
            {itemOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sample name</span>
          <input className="form-input" value={newSample.sampleName} disabled={disabled} onChange={(event) => setNewSample((current) => ({ ...current, sampleName: event.target.value }))} />
        </label>
        <label>
          <span>Quantity</span>
          <input className="form-input" type="number" min="1" value={newSample.quantity} disabled={disabled} onChange={(event) => setNewSample((current) => ({ ...current, quantity: event.target.value }))} />
        </label>
        <label>
          <span>Delivery location</span>
          <input className="form-input" value={newSample.deliveryLocation} disabled={disabled} onChange={(event) => setNewSample((current) => ({ ...current, deliveryLocation: event.target.value }))} />
        </label>
        <label>
          <span>Courier</span>
          <input className="form-input" value={newSample.courier} disabled={disabled} onChange={(event) => setNewSample((current) => ({ ...current, courier: event.target.value }))} />
        </label>
        <label>
          <span>Tracking number</span>
          <input className="form-input" value={newSample.trackingNumber} disabled={disabled} onChange={(event) => setNewSample((current) => ({ ...current, trackingNumber: event.target.value }))} />
        </label>
      </div>

      <div className="tender-detail-field-grid">
        <label className="tender-detail-field-card">
          <span>Mark sample as submitted</span>
          <strong>{newSample.markSubmitted ? 'Submitted' : 'Pending'}</strong>
          <input aria-label="Mark sample as submitted" type="checkbox" checked={newSample.markSubmitted} disabled={disabled} onChange={(event) => setNewSample((current) => ({ ...current, markSubmitted: event.target.checked }))} />
        </label>
      </div>
      <div className="submit-strip">
        <button
          className="btn btn-secondary"
          type="button"
          disabled={disabled || saving}
          onClick={async () => {
            const added = await onAdd(newSample);
            if (added) setNewSample(emptySampleForm(requirements[0], itemOptions[0]?.value));
          }}
        >
          Add sample record
        </button>
      </div>

      {loading ? <div className="scope-empty">Loading sample records...</div> : null}
      {!loading && !samples.length ? <div className="scope-empty">No sample records added yet.</div> : null}

      {samples.length ? (
        <div className="data-table premium-review-table">
          <table>
            <thead>
              <tr>
                <th>Related item</th>
                <th>Sample</th>
                <th>Qty</th>
                <th>Delivery</th>
                <th>Courier</th>
                <th>Tracking</th>
                <th>Status</th>
                <th>Buyer update</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => {
                const edit = edits[sample.id] ?? sampleFormFromDto(sample);
                const readOnly = disabled || isBuyerSampleStatus(sample.trackingStatus);
                return (
                  <tr key={sample.id}>
                    <td>
                      <select className="form-input" aria-label={`Related item for ${sample.sampleName}`} value={edit.relatedItem} disabled={readOnly} onChange={(event) => onEdit(sample.id, { relatedItem: event.target.value })}>
                        {withSampleOption(itemOptions, edit.relatedItem).map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input className="form-input" aria-label={`Sample name for ${sample.sampleName}`} value={edit.sampleName} disabled={readOnly} onChange={(event) => onEdit(sample.id, { sampleName: event.target.value })} />
                    </td>
                    <td>
                      <input className="form-input" aria-label={`Quantity for ${sample.sampleName}`} type="number" min="1" value={edit.quantity} disabled={readOnly} onChange={(event) => onEdit(sample.id, { quantity: event.target.value })} />
                    </td>
                    <td>
                      <input className="form-input" aria-label={`Delivery location for ${sample.sampleName}`} value={edit.deliveryLocation} disabled={readOnly} onChange={(event) => onEdit(sample.id, { deliveryLocation: event.target.value })} />
                    </td>
                    <td>
                      <input className="form-input" aria-label={`Courier for ${sample.sampleName}`} value={edit.courier} disabled={readOnly} onChange={(event) => onEdit(sample.id, { courier: event.target.value })} />
                    </td>
                    <td>
                      <input className="form-input" aria-label={`Tracking number for ${sample.sampleName}`} value={edit.trackingNumber} disabled={readOnly} onChange={(event) => onEdit(sample.id, { trackingNumber: event.target.value })} />
                    </td>
                    <td>
                      <strong>{sampleStatusLabel(sample.trackingStatus)}</strong>
                      {sample.submittedAt ? <span>{formatDate(sample.submittedAt)}</span> : null}
                    </td>
                    <td>
                      <span>{buyerSampleSummary(sample)}</span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" type="button" disabled={readOnly || saving} onClick={() => void onSave(sample)}>
                        Save
                      </button>
                      <button className="btn btn-primary" type="button" disabled={readOnly || saving || sample.trackingStatus === 'SUBMITTED'} onClick={() => void onSubmit(sample)}>
                        Mark submitted
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
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

function EligibilityGate({ gate, tender, administrative, onPatch, uploadBox }: { gate: GateStatus; tender: TenderDetail; administrative: Record<string, unknown>; onPatch: (key: string, value: boolean | string) => void; uploadBox: ReactNode }) {
  const previewRows = tender.requirementRows?.length ? tender.requirementRows : requirementRowsFromJson(tender.requirements);
  return (
    <>
      <div className={`bid-gate-status ${gate.complete ? 'balanced' : ''}`}>
        {gate.message}
      </div>
      <div className="bid-prequalification-note">
        <strong>Eligibility and document requirements</strong>
        <span>Upload administrative eligibility documents and complete required confirmations before moving forward. Technical uploads are completed in the technical response steps, and financial capacity uploads are completed in the financial offer.</span>
      </div>
      <section className="bid-gate-group">
        <div className="bid-gate-group-heading">
          <div>
            <span className="section-kicker">Eligibility declarations/confirmations</span>
            <h3>Mandatory supplier confirmations</h3>
          </div>
          <span className={`badge ${gate.complete ? 'badge-success' : 'badge-warning'}`}>{gate.complete ? 'Gate complete' : `${gate.remaining} remaining`}</span>
        </div>
        <div className="tender-detail-field-grid">
          <CheckCard label="Confirm eligibility to participate" checked={Boolean(administrative.eligible)} onChange={(value) => onPatch('eligible', value)} />
          <CheckCard label="Confirm tax and statutory compliance" checked={Boolean(administrative.taxCompliant)} onChange={(value) => onPatch('taxCompliant', value)} />
          <CheckCard label="Confirm authorized representative" checked={Boolean(administrative.authorized)} onChange={(value) => onPatch('authorized', value)} />
          <CheckCard label="Confirm mandatory documents are attached" checked={Boolean(administrative.documentsConfirmed)} onChange={(value) => onPatch('documentsConfirmed', value)} />
        </div>
        {uploadBox}
      </section>
      <div className="tender-detail-card-list">
        {gate.items.map((item) => (
          <article className={`supplier-requirement-preview ${item.complete ? 'completed' : ''}`} key={item.id}>
            <span>{item.category}</span>
            <strong>{item.label}</strong>
            <p>{item.complete ? 'Complete' : item.mandatory ? 'Mandatory gate item pending.' : 'Optional item for review.'}</p>
          </article>
        ))}
      </div>
      {previewRows.length ? <RequirementPreview tender={tender} /> : null}
    </>
  );
}

type ReviewDocumentRow = {
  id: string;
  label: string;
  requirement: string;
  value: string;
  mandatory: boolean;
  complete: boolean;
  sourceId: string;
  upload?: boolean;
};

type ReviewDocumentSection = {
  id: string;
  title: string;
  rows: ReviewDocumentRow[];
};

function ReviewPanel({
  tender,
  schema,
  responses,
  documents,
  samples,
  issues,
  totalAmount,
  currency,
  completeness,
  isSubmitted,
  onEditField
}: {
  tender: TenderDetail;
  schema: BidSubmissionSchemaDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  samples: BidSampleDto[];
  issues: string[];
  totalAmount: number;
  currency: string;
  completeness: { percent: number; sectionsComplete: number; totalSections: number };
  isSubmitted: boolean;
  onEditField: (sourceId: string) => void;
}) {
  const sections = reviewDocumentSections(schema, responses, documents, samples, currency);
  const responseCount = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const statusLabel = isSubmitted ? 'Submitted' : issues.length ? 'Draft review' : 'Ready for submission';
  return (
    <>
      <div className="record-summary tender-detail-summary">
        <SummaryItem label="Eligibility readiness" value={sectionReadiness(schema, responses, documents, samples, 'administrative')} />
        <SummaryItem label="Workflow" value={schema.tenderType} />
        <SummaryItem label="Administrative" value={sectionReadiness(schema, responses, documents, samples, 'administrative')} />
        <SummaryItem label="Technical responses" value={`${schemaSectionRows(schema, responses, documents, samples, currency, 'technical').length} response fields`} />
        <SummaryItem label="Documents" value={`${documents.length} evidence record${documents.length === 1 ? '' : 's'}`} />
        <SummaryItem label="Financial total" value={formatMoney(totalAmount, currency)} />
      </div>
      {issues.length ? <div className="scope-empty">Complete required sections before submitting: {issues.join(', ')}.</div> : <div className="scope-empty">Bid package is ready for sealed submission.</div>}
      <div className="evaluation-bid-document-review">
        <div className="bid-response-document procurex-bid-package-document">
          <div className="bid-response-document-masthead">
            <div className="bid-response-document-mark">PX</div>
            <div>
              <span>ProcureX e-Procurement</span>
              <strong>Supplier Bid Submission Review</strong>
            </div>
            <em>{isSubmitted ? 'Read only' : 'Editable review'}</em>
          </div>
          <header className="bid-response-document-cover">
            <div>
              <span className="section-kicker">Tender Bid Submission Review</span>
              <h3>{tender.title}</h3>
              <p>This review summarizes supplier responses, completeness status, uploaded evidence, pricing, and final checks before sealed submission.</p>
            </div>
            <div className="bid-response-document-status">
              <span className={`bid-status-chip ${isSubmitted ? 'submitted' : 'review'}`}>{statusLabel}</span>
              {!isSubmitted ? <span className="bid-status-chip editable">Edits enabled</span> : null}
              <span className="bid-status-chip offer">{formatMoney(totalAmount, currency)}</span>
            </div>
          </header>
          <div className="bid-response-document-meta">
            <article>
              <span>Tender reference</span>
              <strong>{tender.reference}</strong>
              <em>Tender information</em>
            </article>
            <article>
              <span>Tender title</span>
              <strong>{tender.title}</strong>
              <em>Tender information</em>
            </article>
            <article>
              <span>Supplier / bid status</span>
              <strong>{statusLabel}</strong>
              <em>Supplier information</em>
            </article>
            <article className="bid-value-card">
              <span>Financial total</span>
              <strong>{formatMoney(totalAmount, currency)}</strong>
              <em>Commercial offer</em>
            </article>
            <article>
              <span>Responses captured</span>
              <strong>{String(responseCount)}</strong>
              <em>Bid package scope</em>
            </article>
            <article>
              <span>Documents count</span>
              <strong>{String(documents.length)}</strong>
              <em>Evidence manifest</em>
            </article>
            <article>
              <span>Completeness</span>
              <strong>{`${completeness.percent}%`}</strong>
              <em>{issues.length ? `${issues.length} pending` : 'Ready'}</em>
            </article>
          </div>
          <div className="bid-response-document-sections">
            {sections.map((section, sectionIndex) => (
              <article className="bid-response-document-section" key={section.id}>
                <div className="bid-response-document-section-heading">
                  <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
                  <div>
                    <h4>{section.title}</h4>
                    <small>{`${section.rows.length} supplier response${section.rows.length === 1 ? '' : 's'}`}</small>
                  </div>
                </div>
                <div className="bid-response-document-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Requirement</th>
                        <th>Supplier response</th>
                        <th>Action needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => (
                        <tr className={row.complete ? '' : 'is-incomplete'} key={row.id}>
                          <td>
                            <span className={`bid-requirement-marker ${row.mandatory ? (row.complete ? 'required-complete' : 'required-incomplete') : row.complete ? 'optional-complete' : 'optional-empty'}`}>
                              {row.complete ? 'Complete' : 'Missing'}
                            </span>
                          </td>
                          <td>
                            <strong>{row.label}</strong>
                            <small>{row.requirement}</small>
                          </td>
                          <td>{row.value}</td>
                          <td>
                            <span>{row.complete ? 'No action needed' : row.upload ? 'Upload evidence file' : 'Complete supplier response'}</span>
                            {isSubmitted ? (
                              <span className="bid-review-readonly">Read only</span>
                            ) : (
                              <button className="bid-review-edit-button" type="button" onClick={() => onEditField(row.sourceId)}>
                                {row.upload ? 'Replace file' : 'Change'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
          <footer className="bid-response-document-footer">
            <span>{tender.reference}</span>
            <strong>{isSubmitted ? 'Submitted record' : 'Supplier editable review'}</strong>
          </footer>
        </div>
      </div>
    </>
  );
}

function reviewDocumentSections(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], currency: string): ReviewDocumentSection[] {
  return schema.steps
    .filter((step) => !isReviewStep(step) && !isReceiptStep(step))
    .map((step) => ({
      id: step.id,
      title: schemaReviewSectionTitle(step),
      rows: schemaSectionRows(schema, responses, documents, samples, currency, step.id)
    }))
    .filter((section) => section.rows.length);
}

function schemaSectionRows(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], currency: string, sectionId: string): ReviewDocumentRow[] {
  const step = schema.steps.find((item) => item.id === sectionId);
  const fields = step ? step.fields : actionableSchemaFields(schema).filter((field) => field.section === sectionId);
  return fields
    .filter((field) => field.section !== 'review' && field.section !== 'receipt')
    .map((field) => schemaReviewRow(field, responses, documents, samples, currency));
}

function schemaReviewRow(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], currency: string): ReviewDocumentRow {
  if (field.type === 'file' || field.responseType === 'attachment') {
    const files = documentsForSchemaField(documents, field);
    return reviewRow(field.id, field.label, schemaRequirementText(field), files.length ? documentNames(files) : 'Missing file', field.required, Boolean(files.length), field.id, true);
  }
  if (field.section === 'samples') {
    const sample = samples.find((item) => sampleMatchesField(item, field));
    const value = sample ? `${sample.sampleName} / Qty ${sample.quantity ?? '-'} / ${sampleStatusLabel(sample.trackingStatus)}` : 'Missing sample record';
    return reviewRow(field.id, field.label, schemaRequirementText(field), value, field.required, Boolean(sample), field.id);
  }
  if (isSchemaBoqPricingField(field)) {
    const amount = Number(schemaFieldValue(field, responses) ?? 0);
    const quantity = Number(field.validation.quantity ?? 1) || 1;
    const total = Math.max(0, amount * quantity);
    return reviewRow(field.id, field.label, schemaFinancialHint(field), total > 0 ? `${formatMoney(amount, currency)} / total ${formatMoney(total, currency)}` : 'Missing price', field.required, total > 0, field.id);
  }
  if (field.type === 'table' || field.responseType === 'structured') {
    const value = schemaFieldValue(field, responses);
    const complete = schemaFieldComplete(field, responses, documents, samples);
    return reviewRow(field.id, field.label, schemaRequirementText(field), structuredResponseSummary(value) || 'Missing structured response', field.required, complete, field.id);
  }
  const value = schemaFieldValue(field, responses);
  const complete = schemaFieldComplete(field, responses, documents, samples);
  const displayValue = value === true ? 'Confirmed' : value === false || value === undefined || value === '' ? (field.type === 'boolean' ? 'Missing confirmation' : 'Missing response') : String(value);
  return reviewRow(field.id, field.label, schemaRequirementText(field), displayValue, field.required, complete, field.id);
}

function reviewRow(id: string, label: string, requirement: string, value: string, mandatory: boolean, complete: boolean, sourceId: string, upload = false): ReviewDocumentRow {
  return { id, label, requirement, value, mandatory, complete, sourceId, upload };
}

function documentNames(documents: BidDocumentState[]) {
  return documents.map((document) => document.name).join(', ');
}

function DeclarationSubmitPanel({ saving, uploading, isSubmitted, form, onPatch, onSave, onSubmit }: { saving: boolean; uploading: boolean; isSubmitted: boolean; form: BidFormState; onPatch: (key: string, value: boolean | string) => void; onSave: () => void; onSubmit: () => void }) {
  return (
    <>
      <div className="form-grid">
        <Input label="Authorized representative" value={String(form.declarations.representativeName || '')} onChange={(value) => onPatch('representativeName', value)} />
        <Input label="Position" value={String(form.declarations.position || '')} onChange={(value) => onPatch('position', value)} />
      </div>
      <div className="tender-detail-field-grid">
        <CheckCard label="I confirm the bid is accurate and complete" checked={Boolean(form.declarations.confirmAccuracy)} onChange={(value) => onPatch('confirmAccuracy', value)} />
        <CheckCard label="I accept the tender and contract terms" checked={Boolean(form.declarations.acceptTerms)} onChange={(value) => onPatch('acceptTerms', value)} />
        <CheckCard label="I declare no conflict of interest" checked={Boolean(form.declarations.noConflict)} onChange={(value) => onPatch('noConflict', value)} />
        <CheckCard label="I confirm anti-corruption compliance" checked={Boolean(form.declarations.antiCorruption)} onChange={(value) => onPatch('antiCorruption', value)} />
      </div>
      <div className="submit-strip">
        <div>
          <strong>Ready to seal</strong>
          <span>The system will check required responses, seal the bid package, and store a receipt.</span>
        </div>
        <button className="btn btn-secondary" type="button" disabled={saving || uploading || isSubmitted} onClick={onSave}>
          Save Draft
        </button>
        <button className="btn btn-primary" type="button" disabled={saving || uploading || isSubmitted} onClick={onSubmit}>
          Submit Sealed Bid
        </button>
      </div>
    </>
  );
}

function downloadBidRecord(receipt: BidReceiptDto, totalAmount: number, currency: string, documents: BidDocumentState[]) {
  const bid = receipt.bid;
  const record = {
    tenderReference: bid.tenderReference || bid.tenderId,
    tenderTitle: bid.tenderTitle,
    bidReference: bid.reference,
    receiptRef: receipt.receiptRef,
    receiptHash: receipt.receiptHash,
    submittedAt: receipt.createdAt,
    status: bid.status,
    totalAmount: totalAmount || bid.totalAmount,
    currency,
    supplierName: bid.supplierName,
    buyerName: bid.buyerName,
    documents: documents.map((document) => ({
      name: document.name,
      documentType: document.documentType,
      envelope: document.envelope,
      reviewStatus: document.reviewStatus,
      checksum: document.checksum ?? null
    }))
  };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(bid.reference || receipt.receiptRef || 'bid-record')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printSubmissionReceipt() {
  window.print();
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'bid-record';
}

function ReceiptPanel({ receipt, totalAmount, currency, documents, onWithdraw, canWithdraw }: { receipt: BidReceiptDto; totalAmount: number; currency: string; documents: BidDocumentState[]; onWithdraw: () => void; canWithdraw: boolean }) {
  return (
    <>
      <section className="bid-submission-confirmation">
        <div className="bid-submission-confirmation-mark">OK</div>
        <div>
          <span className="section-kicker">Bid submitted successfully</span>
          <h3>Submission receipt</h3>
          <p>Your bid is sealed and cannot be modified after submission. Use withdrawal before the deadline when the tender rules allow it.</p>
        </div>
        <div className="record-summary">
          <SummaryItem label="Tender" value={receipt.bid.tenderReference || receipt.bid.tenderId} />
          <SummaryItem label="Submitted" value={formatDate(receipt.createdAt)} />
          <SummaryItem label="Submission Receipt No" value={receipt.receiptHash || receipt.receiptRef} />
          <SummaryItem label="Bid total" value={formatMoney(totalAmount || receipt.bid.totalAmount, currency)} />
          <SummaryItem label="Files" value={`${documents.length} document${documents.length === 1 ? '' : 's'} uploaded`} />
          <SummaryItem label="Bid reference" value={receipt.bid.reference} />
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary" type="button" aria-label="Download submitted bid record" title="Download submitted bid record" onClick={() => downloadBidRecord(receipt, totalAmount, currency, documents)}>
            Download Bid Record
          </button>
          <button className="btn btn-secondary" type="button" aria-label="Print submission receipt" title="Print submission receipt" onClick={printSubmissionReceipt}>
            Print Submission Receipt
          </button>
          {canWithdraw ? (
            <button className="btn btn-secondary" type="button" onClick={onWithdraw}>
              Withdraw Submission
            </button>
          ) : null}
          <Link className="btn btn-primary" to="/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </section>
    </>
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

function emptySampleForm(requirement?: SampleRequirement, fallbackItem = ''): SampleFormState {
  return {
    relatedItem: requirement?.relatedItem || fallbackItem,
    sampleName: requirement?.sampleName || '',
    quantity: requirement?.quantity ? String(requirement.quantity) : '1',
    deliveryLocation: requirement?.deliveryLocation || '',
    courier: '',
    trackingNumber: '',
    markSubmitted: false
  };
}

function sampleFormFromDto(sample: BidSampleDto): SampleFormState {
  return {
    relatedItem: sample.relatedItem ?? '',
    sampleName: sample.sampleName,
    quantity: sample.quantity ? String(sample.quantity) : '',
    deliveryLocation: sample.deliveryLocation ?? '',
    courier: sample.courier ?? '',
    trackingNumber: sample.trackingNumber ?? '',
    markSubmitted: sample.trackingStatus === 'SUBMITTED'
  };
}

function samplePayloadFromForm(input: SampleFormState): CreateBidSampleInput | null {
  const sampleName = input.sampleName.trim();
  const quantity = Number(input.quantity);
  if (!sampleName || !Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    sampleName,
    quantity,
    ...(input.relatedItem.trim() ? { relatedItem: input.relatedItem.trim() } : {}),
    ...(input.deliveryLocation.trim() ? { deliveryLocation: input.deliveryLocation.trim() } : {}),
    ...(input.courier.trim() ? { courier: input.courier.trim() } : {}),
    ...(input.trackingNumber.trim() ? { trackingNumber: input.trackingNumber.trim() } : {}),
    trackingStatus: input.markSubmitted ? 'SUBMITTED' : 'PENDING_SUBMISSION'
  };
}

function samplePatchFromForm(input: SampleFormState, sample: BidSampleDto): PatchBidSampleInput | null {
  const payload = samplePayloadFromForm(input);
  if (!payload) return null;
  const patch: PatchBidSampleInput = {
    sampleName: payload.sampleName,
    quantity: payload.quantity,
    ...(payload.relatedItem ? { relatedItem: payload.relatedItem } : {}),
    ...(payload.deliveryLocation ? { deliveryLocation: payload.deliveryLocation } : {}),
    ...(payload.courier ? { courier: payload.courier } : {}),
    ...(payload.trackingNumber ? { trackingNumber: payload.trackingNumber } : {})
  };
  if (input.markSubmitted && sample.trackingStatus !== 'SUBMITTED') patch.trackingStatus = 'SUBMITTED';
  return patch;
}

function schemaSteps(schema: BidSubmissionSchemaDto): Step[] {
  return schema.steps.map((step, index) => ({
    id: step.id,
    label: step.label,
    title: schemaReviewSectionTitle(step),
    description: schemaStepDescription(step),
    kicker: `Step ${String(index + 1).padStart(2, '0')}`
  }));
}

function schemaStep(schema: BidSubmissionSchemaDto | null, stepId: string) {
  return schema?.steps.find((step) => step.id === stepId);
}

function schemaSampleStep(schema: BidSubmissionSchemaDto | null) {
  return schema?.steps.find((step) => isSampleStep(step));
}

function isSampleStep(step: BidSubmissionSchemaStepDto | { id: string; fields?: BidSubmissionSchemaFieldDto[] }) {
  return step.id === 'samples' || step.id === 'goodsSamples' || Boolean(step.fields?.some((field) => field.section === 'samples'));
}

function isReviewStep(step: BidSubmissionSchemaStepDto | { id: string }) {
  return ['review', 'goodsReview', 'worksReview', 'servicesReview', 'consultancyReview'].includes(step.id);
}

function isDeclarationStep(step: BidSubmissionSchemaStepDto | { id: string }) {
  return ['declarations', 'goodsDeclaration', 'worksDeclaration'].includes(step.id);
}

function isReceiptStep(step: BidSubmissionSchemaStepDto | { id: string }) {
  return step.id === 'receipt';
}

function reviewStepSubmits(workflow: WorkflowType, stepId: string) {
  return workflow === 'services' || workflow === 'consultancy' || stepId === 'servicesReview' || stepId === 'consultancyReview';
}

function schemaStepDescription(step: BidSubmissionSchemaStepDto) {
  if (!step.fields.length) return 'No supplier response fields configured for this step.';
  return `${step.fields.length} tender-derived supplier response field${step.fields.length === 1 ? '' : 's'}.`;
}

function schemaReviewSectionTitle(step: BidSubmissionSchemaStepDto) {
  const labels: Record<string, string> = {
    administrative: 'Eligibility and Document Requirements',
    technical: 'Technical Response',
    financial: 'Financial Offer',
    samples: 'Sample Submission',
    declarations: 'Supplier Declarations',
    review: 'Review Submission',
    receipt: 'Submission Receipt',
    goodsTechnical: 'Technical Response',
    goodsFinancial: 'Quantity Schedule / Financial Offer',
    goodsSamples: 'Sample Submission',
    goodsReview: 'Review Submission',
    goodsDeclaration: 'Supplier Declaration and Submit',
    worksCapacity: 'Technical Capacity and Experience',
    worksTechnicalProposal: 'Technical Proposal and Work Program',
    worksFinancial: 'Financial Proposal / BOQ Pricing',
    worksReview: 'Review Submission',
    worksDeclaration: 'Declaration and Submission',
    servicesMethodology: 'Service Understanding and Methodology',
    servicesDeliveryPlan: 'Service Schedule and Delivery Plan',
    servicesStaffing: 'Staffing, Capacity and Continuity Plan',
    servicesSla: 'Performance, SLA, Reporting and Compliance',
    servicesCommercial: 'Commercial Pricing and Cost Breakdown',
    servicesReview: 'Review Submission',
    consultancyTechnical: 'Technical Proposal',
    consultancyFinancial: 'Financial Proposal',
    consultancyReview: 'Review and Submit'
  };
  return labels[step.id] ?? step.label;
}

function schemaFieldValue(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState) {
  return responses[field.requirementKey] ?? responses[field.id];
}

function responseValue(response: Record<string, unknown>) {
  if ('value' in response) return response.value;
  if ('checked' in response) return response.checked;
  if ('rate' in response) return response.rate;
  return response;
}

function schemaResponsesFromPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value]));
}

function schemaResponseList(schema: BidSubmissionSchemaDto, responses: SchemaResponseState) {
  return actionableSchemaFields(schema)
    .filter((field) => field.section !== 'samples' && field.type !== 'file' && field.responseType !== 'attachment')
    .map((field) => ({
      requirementKey: field.requirementKey,
      response: { value: schemaFieldValue(field, responses) }
    }));
}

function schemaSectionPayload(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, section: 'administrative' | 'technical' | 'financial' | 'declarations') {
  const fields = actionableSchemaFields(schema).filter((field) => field.section === section && field.type !== 'file' && field.responseType !== 'attachment');
  return Object.fromEntries(fields.map((field) => [schemaPayloadKey(field), schemaFieldValue(field, responses)]));
}

function schemaPayloadKey(field: BidSubmissionSchemaFieldDto) {
  return field.requirementKey.split('.').at(-1) || field.id.split('.').at(-1) || field.id;
}

function actionableSchemaFields(schema: BidSubmissionSchemaDto) {
  return schema.steps.flatMap((step) => step.fields).filter((field) => field.section !== 'review' && field.section !== 'receipt');
}

function requiredSchemaFieldCount(schema: BidSubmissionSchemaDto) {
  return actionableSchemaFields(schema).filter((field) => field.required).length;
}

function validateSchemaResponses(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  return actionableSchemaFields(schema)
    .filter((field) => field.required && !schemaFieldComplete(field, responses, documents, samples))
    .map((field) => field.label);
}

function schemaCompleteness(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  const fields = actionableSchemaFields(schema).filter((field) => field.required);
  const totalSections = Math.max(1, fields.length);
  const sectionsComplete = fields.filter((field) => schemaFieldComplete(field, responses, documents, samples)).length;
  return { percent: Math.round((sectionsComplete / totalSections) * 100), sectionsComplete, totalSections };
}

function schemaFieldComplete(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  if (field.type === 'file' || field.responseType === 'attachment') return documentsForSchemaField(documents, field).length > 0;
  if (field.section === 'samples') return samples.some((sample) => sampleMatchesField(sample, field));
  const value = schemaFieldValue(field, responses);
  if (field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'declaration' || field.responseType === 'acknowledgement') return value === true;
  if (field.responseType === 'money' || field.responseType === 'pricing') return Number(value) > 0;
  if (field.type === 'table' || field.responseType === 'structured') return hasMeaningfulStructuredResponse(value);
  return String(value ?? '').trim().length > 0;
}

function schemaGateStatus(schema: BidSubmissionSchemaDto | null, responses: SchemaResponseState, documents: BidDocumentState[]): GateStatus {
  const fields = schema?.steps.find((step) => step.id === 'administrative')?.fields ?? [];
  const items = fields
    .filter((field) => field.required)
    .map((field) => ({
      id: field.id,
      label: field.label,
      category: field.source || 'Administrative',
      mandatory: field.required,
      complete: schemaFieldComplete(field, responses, documents, [])
    }));
  const completeMandatory = items.filter((item) => item.complete).length;
  const remaining = Math.max(0, items.length - completeMandatory);
  return {
    items,
    mandatoryTotal: items.length,
    completeMandatory,
    remaining,
    complete: remaining === 0,
    message: remaining ? `${completeMandatory} of ${items.length} mandatory administrative requirements complete. Complete ${remaining} more to continue.` : 'Administrative requirements complete. You can continue to the bid workflow.'
  };
}

function schemaTotalFromResponses(schema: BidSubmissionSchemaDto, responses: SchemaResponseState) {
  return schemaFinancialFields(schema).reduce((sum, field) => sum + schemaFinancialFieldTotal(field, responses), 0);
}

function schemaFinancialFields(schema: BidSubmissionSchemaDto) {
  return actionableSchemaFields(schema).filter(isSchemaBoqPricingField);
}

function isSchemaPricingField(field: BidSubmissionSchemaFieldDto) {
  return field.responseType === 'money' || field.responseType === 'pricing';
}

function isSchemaBoqPricingField(field: BidSubmissionSchemaFieldDto) {
  if (field.section !== 'financial' || !isSchemaPricingField(field)) return false;
  if (field.validation.itemId || field.validation.itemNo || field.validation.description || field.validation.quantity || field.validation.unit) return true;
  return /commercialitems|boq|quantityschedule|pricingrows|financialofferrows/i.test(`${field.requirementKey} ${field.source}`);
}

function schemaFinancialRows(schema: BidSubmissionSchemaDto, responses: SchemaResponseState): PriceRow[] {
  return schemaFinancialFields(schema)
    .map((field, index) => schemaFinancialRow(field, responses, index));
}

function schemaFinancialRow(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, index: number): PriceRow & { total: number } {
  const rate = Number(schemaFieldValue(field, responses) ?? 0);
  const quantity = Number(field.validation.quantity ?? 1) || 1;
  return withTotal({
    id: String(field.validation.itemId ?? field.id),
    itemNo: String(field.validation.itemNo ?? index + 1),
    description: String(field.validation.description ?? field.label.replace(/^Unit rate for\s+/i, '')),
    quantity,
    unit: String(field.validation.unit ?? 'Lot'),
    rate,
    taxIncluded: true,
    discount: 0
  }) as PriceRow & { total: number };
}

function schemaFinancialFieldTotal(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState) {
  return Math.max(0, schemaFinancialRow(field, responses, 0).total ?? 0);
}

function schemaFinancialHint(field: BidSubmissionSchemaFieldDto) {
  const quantity = field.validation.quantity ? `Qty ${field.validation.quantity}` : '';
  const unit = field.validation.unit ? String(field.validation.unit) : '';
  return [quantity, unit].filter(Boolean).join(' ') || 'Enter the tender-required financial response.';
}

function documentsForSchemaField(documents: BidDocumentState[], field: BidSubmissionSchemaFieldDto) {
  const documentType = String(field.validation.documentType ?? '');
  return documents.filter((document) => {
    const requirementKey = String(document.metadata?.requirementKey ?? '');
    const fieldId = String(document.metadata?.fieldId ?? '');
    return requirementKey === field.requirementKey || requirementKey === field.id || fieldId === field.id || (documentType && document.documentType === documentType);
  });
}

function schemaRequirementText(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.prompt ?? field.source ?? field.requirementKey);
}

function schemaSourceStepId(schema: BidSubmissionSchemaDto, sourceId: string) {
  const step = schema.steps.find((item) => item.id === sourceId || item.fields.some((field) => field.id === sourceId || field.requirementKey === sourceId));
  return step?.id ?? sourceId;
}

function sectionReadiness(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], section: string) {
  const fields = actionableSchemaFields(schema).filter((field) => field.section === section && field.required);
  if (!fields.length) return 'No required fields';
  const complete = fields.filter((field) => schemaFieldComplete(field, responses, documents, samples)).length;
  return complete === fields.length ? 'Complete' : `${fields.length - complete} pending`;
}

function schemaSampleRequirements(schema: BidSubmissionSchemaDto | null, tender?: TenderDetail | null): SampleRequirement[] {
  const fields = schemaSampleStep(schema)?.fields ?? [];
  if (!fields.length) return normalizeSampleRequirements(tender);
  return fields.map((field, index) => ({
    id: field.id,
    relatedItem: String(field.validation.relatedItem ?? ''),
    sampleName: field.label || `Sample ${index + 1}`,
    quantity: Number(field.validation.quantity ?? 1) || 1,
    deliveryLocation: String(field.validation.deliveryLocation ?? ''),
    deliveryDeadline: typeof field.validation.deliveryDeadline === 'string' ? field.validation.deliveryDeadline : undefined,
    mandatory: field.required
  }));
}

function sampleMatchesField(sample: BidSampleDto, field: BidSubmissionSchemaFieldDto) {
  const relatedItem = String(field.validation.relatedItem ?? '');
  return Boolean((relatedItem && sample.relatedItem === relatedItem) || sample.sampleName === field.label);
}

function workflowFromTender(tender?: TenderDetail | null): WorkflowType {
  const type = String(tender?.type || '').toLowerCase();
  if (type.includes('goods')) return 'goods';
  if (type.includes('works')) return 'works';
  if (type.includes('non_consultancy') || type.includes('non consultancy') || type.includes('non-consultancy') || type.includes('service')) return 'services';
  if (type.includes('consultancy')) return 'consultancy';
  return 'generic';
}

function reviewIncludesDeclaration(workflow: WorkflowType) {
  return workflow === 'services' || workflow === 'consultancy' || workflow === 'generic';
}

function reviewSourceStepId(sourceId: string, workflow: WorkflowType) {
  if (sourceId === 'declaration') return reviewIncludesDeclaration(workflow) ? 'review' : 'declaration';
  return sourceId;
}

function financialSourceId(workflow: WorkflowType) {
  if (workflow === 'works') return 'works-financial';
  if (workflow === 'consultancy') return 'consultancy-financial';
  if (workflow === 'services' || workflow === 'generic') return 'services-commercial';
  return 'goods-financial';
}

function receiptStepIndex(steps: Step[], workflow: WorkflowType) {
  const receiptIndex = steps.findIndex((step) => step.id === 'receipt');
  if (receiptIndex > -1) return receiptIndex;
  const finalSubmitIndex = steps.findIndex((step) => isReceiptPanelStep(workflow, step.id));
  return finalSubmitIndex > -1 ? finalSubmitIndex : Math.max(0, steps.length - 1);
}

function isReceiptPanelStep(workflow: WorkflowType, stepId: string) {
  if (stepId === 'receipt') return true;
  if (workflow === 'services') return stepId === 'servicesReview' || stepId === 'review';
  if (workflow === 'consultancy') return stepId === 'consultancyReview' || stepId === 'review';
  if (workflow === 'goods') return stepId === 'goodsDeclaration' || stepId === 'declarations';
  if (workflow === 'works') return stepId === 'worksDeclaration' || stepId === 'declarations';
  return stepId === 'declarations' || stepId === 'review';
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

function backendTechnicalPayload(workflow: WorkflowType, technical: Record<string, unknown>) {
  const normalized = { ...technical };
  const value = (...keys: string[]) => keys.map((key) => String(technical[key] ?? '').trim()).find(Boolean) ?? '';
  const approach = value('approach', 'methodology', 'technicalProposal', 'productCompliance');
  const deliveryPlan = value('deliveryPlan', 'workPlan', 'samplePlan', 'staffingPlan', 'sla', 'technicalProposal', 'productCompliance', 'methodology');

  if (workflow === 'goods') {
    normalized.approach = value('approach', 'productCompliance');
    normalized.deliveryPlan = value('deliveryPlan', 'samplePlan', 'productCompliance');
  } else if (workflow === 'works') {
    normalized.approach = value('approach', 'methodology');
    normalized.deliveryPlan = value('deliveryPlan', 'workPlan', 'siteResponse', 'methodology');
  } else if (workflow === 'services') {
    normalized.approach = value('approach', 'methodology');
    normalized.deliveryPlan = value('deliveryPlan', 'staffingPlan', 'sla', 'methodology');
  } else if (workflow === 'consultancy') {
    normalized.approach = value('approach', 'methodology', 'technicalProposal');
    normalized.deliveryPlan = value('deliveryPlan', 'technicalProposal', 'methodology');
  } else {
    normalized.approach = approach;
    normalized.deliveryPlan = deliveryPlan;
  }

  return normalized;
}

function responseList(workflow: WorkflowType, form: BidFormState) {
  return Object.entries(form.technical)
    .filter(([, value]) => String(value ?? '').trim())
    .map(([key, value]) => ({
      requirementKey: `${workflow}-${key}`,
      response: { value }
    }));
}

function validateForm(workflow: WorkflowType, form: BidFormState, documents: BidDocumentState[], totalAmount: number) {
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

function envelopeManifest(workflow: WorkflowType, documents: BidDocumentState[]) {
  return {
    mode: workflow === 'consultancy' ? 'two-envelope' : 'combined',
    administrative: documents.filter((document) => document.envelope === 'ADMINISTRATIVE').map((document) => document.checksum).filter(Boolean),
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

function normalizeSampleRequirements(tender?: TenderDetail | null): SampleRequirement[] {
  const requirements = objectPayload(tender?.requirements);
  const goods = objectPayload(requirements.goods);
  const fields = objectPayload(goods.fields);
  const sources = [requirements.sampleRequirements, fields.sampleRequirementRows].filter(Array.isArray) as unknown[][];
  const rows = sources.flatMap((source) => source.map(objectPayload));
  return rows
    .filter((row) => row.sampleRequired !== false)
    .map((row, index) => {
      const relatedItem = String(row.relatedBoqItemId || row.relatedBoqItem || row.relatedItem || row.itemId || '').trim();
      const sampleName = String(row.sampleDescription || row.sampleName || row.description || `Sample ${index + 1}`).trim();
      const quantity = Number(row.numberOfSamples || row.quantity || 1);
      return {
        id: String(row.id || relatedItem || `sample-requirement-${index + 1}`),
        relatedItem,
        sampleName,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        deliveryLocation: String(row.deliveryLocation || '').trim(),
        deliveryDeadline: typeof row.deliveryDeadline === 'string' ? row.deliveryDeadline : undefined,
        mandatory: row.mandatory !== false
      };
    });
}

function hasSampleRequirements(tender?: TenderDetail | null) {
  const requirements = objectPayload(tender?.requirements);
  const summary = objectPayload(requirements.summary);
  return normalizeSampleRequirements(tender).length > 0 || summary.requireSamples === 'Yes' || summary.requireSamples === true || requirements.requireSamples === 'Yes' || requirements.requireSamples === true;
}

function bidGateStatus(form: BidFormState, documents: BidDocumentState[], tender?: TenderDetail | null): GateStatus {
  const hasUploadedAdministrativeEvidence = documents.some((document) => {
    const metadata = objectPayload(document.metadata);
    return document.envelope === 'ADMINISTRATIVE' || metadata.requirementKey === 'eligibility' || document.documentType === 'ADMINISTRATIVE_EVIDENCE';
  });
  const hasAdministrativeEvidence = hasUploadedAdministrativeEvidence || form.administrative.documentsConfirmed === true;
  const items: GateItem[] = [
    { id: 'eligible', label: 'Confirm eligibility to participate', category: 'Eligibility declarations/confirmations', mandatory: true, complete: form.administrative.eligible === true },
    { id: 'taxCompliant', label: 'Confirm tax and statutory compliance', category: 'Eligibility declarations/confirmations', mandatory: true, complete: form.administrative.taxCompliant === true },
    { id: 'authorized', label: 'Confirm authorized representative', category: 'Eligibility declarations/confirmations', mandatory: true, complete: form.administrative.authorized === true },
    { id: 'documentsConfirmed', label: 'Confirm mandatory documents are attached', category: 'Submission documents', mandatory: true, complete: form.administrative.documentsConfirmed === true },
    { id: 'administrativeEvidence', label: 'Upload eligibility and administrative evidence', category: 'Licenses and certifications', mandatory: true, complete: hasAdministrativeEvidence }
  ];

  gateRequirementRows(tender).forEach((row, index) => {
    items.push({
      id: `buyer-gate-${index}`,
      label: payloadTitle(row.payload, row.section),
      category: humanize(row.section),
      mandatory: false,
      complete: false
    });
  });

  const mandatoryItems = items.filter((item) => item.mandatory);
  const completeMandatory = mandatoryItems.filter((item) => item.complete).length;
  const remaining = Math.max(0, mandatoryItems.length - completeMandatory);
  const complete = remaining === 0;
  const uploadPending = !hasAdministrativeEvidence;
  const message = complete
    ? 'License and mandatory evidence gate complete. You can continue to the bid workflow.'
    : uploadPending
      ? `Upload ${uploadPending ? 1 : 0} required administrative evidence file and complete eligibility evidence to unlock the bid workflow.`
      : `${completeMandatory} of ${mandatoryItems.length} mandatory requirements complete. Complete ${remaining} more to continue.`;

  return {
    items,
    mandatoryTotal: mandatoryItems.length,
    completeMandatory,
    remaining,
    complete,
    message
  };
}

function gateRequirementRows(tender?: TenderDetail | null) {
  const rows = tender?.requirementRows?.length ? tender.requirementRows : requirementRowsFromJson(tender?.requirements);
  return rows
    .filter((row) => {
      const section = row.section.toLowerCase();
      const summary = `${payloadTitle(row.payload, row.section)} ${payloadSummary(row.payload)}`.toLowerCase();
      return /license|certificate|registration|tax|eligibility|submission|authorization|administrative/.test(`${section} ${summary}`);
    })
    .slice(0, 6);
}

function sampleOptionsFromTender(tender?: TenderDetail | null, requirements: SampleRequirement[] = []): SampleItemOption[] {
  const requirementOptions = requirements
    .filter((requirement) => requirement.relatedItem)
    .map((requirement) => ({ value: requirement.relatedItem, label: requirement.sampleName ? `${displayRelatedItem(requirement.relatedItem, [])} - ${requirement.sampleName}` : requirement.relatedItem }));
  const explicit = (tender?.commercialItems ?? []).map((item, index) => ({
    value: item.id,
    label: `${item.itemNo || index + 1}. ${item.description}`
  }));
  const requirementsPayload = objectPayload(tender?.requirements);
  const jsonRows = Array.isArray(requirementsPayload.commercialItems) ? (requirementsPayload.commercialItems as Record<string, unknown>[]) : [];
  const jsonOptions = jsonRows.map((item, index) => ({
    value: String(item.id || `line-${index + 1}`),
    label: `${index + 1}. ${String(item.description || item.itemDescription || 'Tender line item')}`
  }));
  const options = [...explicit, ...jsonOptions, ...requirementOptions].filter((option) => option.value);
  const unique = new Map(options.map((option) => [option.value, option]));
  return [...unique.values()];
}

function mergeSampleRequirementDefaults(input: SampleFormState, requirements: SampleRequirement[]): SampleFormState {
  const requirement = requirements.find((item) => item.relatedItem === input.relatedItem);
  if (!requirement) return input;
  return {
    ...input,
    sampleName: input.sampleName || requirement.sampleName,
    quantity: input.quantity || String(requirement.quantity),
    deliveryLocation: input.deliveryLocation || requirement.deliveryLocation
  };
}

function withSampleOption(options: SampleItemOption[], value: string): SampleItemOption[] {
  if (!value || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: value }];
}

function displayRelatedItem(value: string | null | undefined, options: SampleItemOption[]) {
  if (!value) return 'No related item';
  return options.find((option) => option.value === value)?.label ?? value;
}

function isBuyerSampleStatus(status: BidSampleDto['trackingStatus']) {
  return status === 'RECEIVED' || status === 'INSPECTED' || status === 'ACCEPTED' || status === 'REJECTED';
}

function sampleStatusLabel(status: BidSampleDto['trackingStatus']) {
  return humanize(status.toLowerCase());
}

function buyerSampleSummary(sample: BidSampleDto) {
  if (sample.trackingStatus === 'RECEIVED') return sample.receivedAt ? `Received ${formatDate(sample.receivedAt)}` : 'Received';
  if (sample.trackingStatus === 'INSPECTED') return sample.inspectedAt ? `Inspected ${formatDate(sample.inspectedAt)}` : 'Inspected';
  if (sample.trackingStatus === 'ACCEPTED') return sample.inspectionNotes ? `Accepted - ${sample.inspectionNotes}` : 'Accepted';
  if (sample.trackingStatus === 'REJECTED') return sample.inspectionNotes ? `Rejected - ${sample.inspectionNotes}` : 'Rejected';
  return 'Awaiting buyer update';
}

function stepBadge(stepId: string, issues: string[], documents: BidDocumentState[], receipt: BidReceiptDto | null, gate: GateStatus) {
  if (receipt && (stepId === 'receipt' || stepId === 'review' || stepId === 'declaration')) return 'Submitted';
  if (stepId === 'receipt') return receipt ? 'Submitted' : 'Pending';
  if (stepId === 'review') return `${issues.length} issues`;
  if (stepId === 'eligibility') return gate.complete ? 'Gate complete' : `${gate.remaining} remaining`;
  return issues.length ? 'In progress' : 'Ready';
}

function bidDocumentInputFromDto(document: BidDocumentState): BidDocumentInput {
  const metadata = objectPayload(document.metadata);
  const size = Number(metadata.size);
  return {
    name: document.name,
    documentType: document.documentType,
    envelope: coerceEnvelope(document.envelope),
    checksum: document.checksum ?? undefined,
    size: Number.isFinite(size) && size >= 0 ? size : undefined,
    mimeType: typeof metadata.mimeType === 'string' ? metadata.mimeType : undefined,
    metadata
  };
}

function coerceEnvelope(value: string | undefined): Envelope {
  return value === 'ADMINISTRATIVE' || value === 'TECHNICAL' || value === 'FINANCIAL' || value === 'COMBINED' ? value : 'COMBINED';
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

function errorMessage(_error: unknown, fallback: string) {
  return fallback;
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed);
}

function formatDateOnly(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
