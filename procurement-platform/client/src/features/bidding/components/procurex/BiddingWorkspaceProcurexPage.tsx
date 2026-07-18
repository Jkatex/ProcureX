import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { store } from '@/app/store';
import { SignatureKeyphraseModal } from '@/shared/components/SignatureKeyphraseModal';
import { ProcurexWorkspaceChrome } from '@/shared/components/procurex/ProcurexWorkspaceChrome';
import { apiErrorMessage, apiRawErrorMessage, isKeyphraseApiError } from '@/shared/api/errors';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDocumentEnvelope, BidDocumentInput, BidDraftPayload, BidDto, BidReceiptDto, BidSampleDto, BidSubmissionSchemaDto, BidSubmissionSchemaFieldDto, BidSubmissionSchemaStepDto, CreateBidSampleInput, PatchBidSampleInput } from '../../types';

type WorkflowType = 'goods' | 'works' | 'services' | 'consultancy' | 'generic';
type Envelope = BidDocumentEnvelope;
type BidDocumentState = BidDto['documents'][number];
type UploadMetadata = Record<string, unknown>;
type UploadHandler = (files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel?: string, metadata?: UploadMetadata) => Promise<void>;
type BidNoticeTone = 'success' | 'info' | 'warning' | 'error';

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

type WorksBoqValue = {
  status: string;
  labor: number;
  material: number;
  equipment: number;
  overheads: number;
  profit: number;
  unitRate?: number;
};

type GoodsOfferValue = {
  status: string;
  unitPrice: number;
  taxIncluded: string;
  discount: string;
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

const goodsFallbackSpecificationKey = 'goods.productSpecification.line-1';

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

function BiddingWorkspaceChrome({ children }: { children: ReactNode }) {
  return <ProcurexWorkspaceChrome title="Bidding">{children}</ProcurexWorkspaceChrome>;
}

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
  const [rawSchema, setRawSchema] = useState<BidSubmissionSchemaDto | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaResponses, setSchemaResponses] = useState<SchemaResponseState>({});
  const [reviewEditTarget, setReviewEditTarget] = useState<string | null>(null);
  const [pendingSignatureAction, setPendingSignatureAction] = useState<'submit' | 'withdraw' | null>(null);
  const [signatureError, setSignatureError] = useState('');

  const workflow = useMemo(() => workflowFromTender(tender), [tender]);
  const schema = useMemo(() => withGoodsBidInformationStep(rawSchema, workflow, tender), [rawSchema, tender, workflow]);
  const sessionUser = useSyncExternalStore(store.subscribe, () => store.getState().auth.user, () => store.getState().auth.user);
  const bidderName = useMemo(() => bid?.supplierName || sessionUser?.organization || sessionUser?.displayName || 'Supplier organization', [bid?.supplierName, sessionUser?.displayName, sessionUser?.organization]);
  const bidReferenceNumber = useMemo(() => bid?.reference || generatedBidReference(tender, sessionUser?.organizationId || sessionUser?.id || bidderName), [bid?.reference, bidderName, sessionUser?.id, sessionUser?.organizationId, tender]);
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

  function showBidNotice(tone: BidNoticeTone, title: string, message: string) {
    setStatus(message);
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('procurex:notify', {
        detail: {
          tone,
          title,
          message,
          presentation: 'bidNotice',
          dismissible: true,
          autoDismissMs: 3000
        }
      })
    );
  }

  useEffect(() => {
    if (!tender) return;
    setForm((current) => mergeTenderDefaults(current, tender, workflow));
  }, [tender, workflow]);

  useEffect(() => {
    if (!tenderId) {
      setRawSchema(null);
      return;
    }

    let mounted = true;
    setSchemaLoading(true);
    biddingApi
      .getTenderSchema(tenderId)
      .then((nextSchema) => {
        if (!mounted) return;
        setRawSchema(nextSchema);
        setActiveStep(0);
      })
      .catch((error) => {
        if (!mounted) return;
        setRawSchema(null);
        showBidNotice('error', 'Notice', errorMessage(error, 'Bid response fields could not be loaded from the tender requirements.'));
      })
      .finally(() => {
        if (mounted) setSchemaLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tenderId]);

  useEffect(() => {
    if (workflow !== 'goods' || !schemaStep(schema, 'goodsBidInformation')) return;
    setSchemaResponses((current) =>
      withGoodsBidInformationDefaults(current, schema, workflow, bidderName, bidReferenceNumber, {
        forceBidderName: Boolean(bid?.supplierName),
        forceReferenceNumber: Boolean(bid?.reference)
      })
    );
  }, [bid?.reference, bid?.supplierName, bidReferenceNumber, bidderName, schema, workflow]);

  useEffect(() => {
    if (!tenderId) {
      showBidNotice('info', 'Notice', 'Open a tender from the marketplace to prepare a bid.');
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
          showBidNotice('info', 'Notice', draft.status === 'SUBMITTED' ? 'Submitted bid loaded.' : 'Draft bid loaded.');
        } else {
          setSamples([]);
          setSampleEdits({});
          showBidNotice('info', 'Notice', 'Ready to prepare a new sealed bid.');
        }
      })
      .catch(() => {
        if (!mounted) return;
        showBidNotice('warning', 'Notice', 'Sign in with bidding access to save and submit this bid.');
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
        showBidNotice('error', 'Notice', errorMessage(error, 'Sample tracking could not be loaded.'));
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
      target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      const focusTarget = target.querySelector<HTMLElement>('textarea, input:not([type="hidden"]), select, button:not([disabled])');
      focusTarget?.focus({ preventScroll: true });
      window.setTimeout(() => target.classList.remove('bid-review-edit-target'), 2200);
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [activeStep, reviewEditTarget]);

  function hydrateDraft(draft: BidDto) {
    const payload = draft.payload;
    const workspaceState = objectPayload(payload.workspaceState);
    const workspaceForm = objectPayload(workspaceState.form);
    const workspaceFinancial = objectPayload(workspaceForm.financial);
    const administrative = objectPayload(payload.administrative);
    const technical = objectPayload(payload.technical);
    const financial = objectPayload(payload.financial);
    const declarations = objectPayload(payload.declarations);
    const workspaceAdministrative = objectPayload(workspaceForm.administrative);
    const workspaceTechnical = objectPayload(workspaceForm.technical);
    const workspaceDeclarations = objectPayload(workspaceForm.declarations);
    const workspaceSchemaResponses = objectPayload(workspaceState.schemaResponses);
    const responseState = Object.fromEntries(draft.responses.map((item) => [item.requirementKey, responseValue(item.response)]));
    const hydratedResponses = {
      ...responseState,
      ...schemaResponsesFromPayload(administrative),
      ...schemaResponsesFromPayload(technical),
      ...schemaResponsesFromPayload(financial),
      ...schemaResponsesFromPayload(declarations),
      ...workspaceSchemaResponses
    };
    setSchemaResponses(
      withGoodsBidInformationDefaults(
        hydratedResponses,
        schema,
        workflow,
        draft.supplierName || bidderName,
        draft.reference || bidReferenceNumber,
        {
          forceBidderName: Boolean(draft.supplierName),
          forceReferenceNumber: Boolean(draft.reference)
        }
      )
    );
    setForm((current) => ({
      administrative: { ...current.administrative, ...administrative, ...workspaceAdministrative },
      technical: { ...current.technical, ...technical, ...workspaceTechnical },
      financial: {
        ...current.financial,
        items: normalizePriceRows(workspaceFinancial.items ?? financial.items, current.financial.items),
        boqItems: normalizePriceRows(workspaceFinancial.boqItems ?? financial.boqItems, current.financial.boqItems),
        fees: normalizePriceRows(workspaceFinancial.fees ?? financial.fees, current.financial.fees),
        paymentTerms: String(workspaceFinancial.paymentTerms ?? financial.paymentTerms ?? current.financial.paymentTerms),
        validityDays: String(workspaceFinancial.validityDays ?? financial.validityDays ?? current.financial.validityDays)
      },
      declarations: { ...current.declarations, ...declarations, ...workspaceDeclarations }
    }));
  }

  function draftPayload(): BidDraftPayload {
    const administrative = schema ? schemaAdministrativePayload(schema, schemaResponses, workflow) : form.administrative;
    const technical = schema ? schemaSectionPayload(schema, schemaResponses, 'technical') : backendTechnicalPayload(workflow, form.technical);
    const responses = schema ? schemaResponseList(schema, schemaResponses) : responseList(workflow, { ...form, technical });
    const financialItems = schema ? schemaFinancialRows(schema, schemaResponses) : form.financial.items.map(withTotal);
    const financial = {
      items: financialItems,
      boqItems: schema && workflow === 'works' ? financialItems : form.financial.boqItems.map(withTotal),
      fees: schema && workflow === 'consultancy' ? financialItems : form.financial.fees.map(withTotal),
      paymentTerms: schema ? String(schemaResponses['financial.paymentTerms'] ?? '') : form.financial.paymentTerms,
      validityDays: schema ? String(schemaResponses['financial.validityDays'] ?? '') : form.financial.validityDays
    };
    const declarations = schema ? schemaSectionPayload(schema, schemaResponses, 'declarations') : form.declarations;
    const draftDocuments = documents.map(bidDocumentInputFromDto);
    return {
      workflowType: workflow,
      workflowVersion: WORKFLOW_VERSION,
      administrative,
      technical,
      financial,
      declarations,
      responses,
      documents: draftDocuments,
      fileManifest: { documentCount: documents.length, checksums: documents.map((document) => document.checksum).filter(Boolean) },
      envelopes: envelopeManifest(workflow, documents),
      reviewReadiness: { issues: validationIssues, totalAmount, generatedAt: new Date().toISOString() },
      workspaceState: reactWorkspaceState({
        activeStep,
        completeness,
        currency: tender?.currency || 'TZS',
        documents: draftDocuments,
        form,
        samples,
        schemaResponses,
        tenderId,
        totalAmount,
        validationIssues,
        workflow
      }),
      totalAmount,
      currency: tender?.currency || 'TZS',
      completeness,
      validationIssues
    };
  }

  async function saveDraft() {
    if (!tenderId) return;
    setSaving(true);
    showBidNotice('info', 'Notice', 'Saving draft...');
    try {
      const payload = draftPayload();
      const saved = bid ? await biddingApi.updateBid(bid.id, payload) : await biddingApi.saveTenderDraft(tenderId, payload);
      syncBidState(saved);
      showBidNotice('success', 'Notice', 'Draft saved to the database.');
    } catch (error) {
      showBidNotice('error', 'Notice', errorMessage(error, 'Draft could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitBid(signatureKeyphrase?: string) {
    if (validationIssues.length) {
      showBidNotice('warning', 'Notice', `Complete required sections before submitting: ${validationIssues.join(', ')}.`);
      setActiveStep(Math.max(0, steps.length - 2));
      return;
    }
    if (!signatureKeyphrase) {
      setSignatureError('');
      setPendingSignatureAction('submit');
      return;
    }
    setSaving(true);
    showBidNotice('info', 'Notice', 'Submitting sealed bid...');
    try {
      const payload = draftPayload();
      const saved = bid ? await biddingApi.updateBid(bid.id, payload) : tenderId ? await biddingApi.saveTenderDraft(tenderId, payload) : null;
      if (!saved) throw new Error('Tender id is missing.');
      const submitted = await biddingApi.submitBid(saved.id, { signatureKeyphrase });
      syncBidState(submitted.bid);
      setPendingSignatureAction(null);
      setSignatureError('');
      setReceipt(submitted);
      setActiveStep(receiptStepIndex(steps, workflow));
      showBidNotice('success', 'Notice', workflow === 'consultancy' ? 'Technical and financial envelopes sealed. Receipt generated.' : 'Bid package sealed. Receipt generated.');
    } catch (error) {
      const message = bidSubmitErrorMessage(error, 'Bid could not be submitted.');
      setSignatureError(isKeyphraseApiError(error) ? message : '');
      showBidNotice('error', 'Notice', message);
    } finally {
      setSaving(false);
    }
  }

  async function withdrawBid(signatureKeyphrase?: string) {
    if (!bid) return;
    if (!signatureKeyphrase) {
      setSignatureError('');
      setPendingSignatureAction('withdraw');
      return;
    }
    setSaving(true);
    showBidNotice('info', 'Notice', 'Withdrawing submitted bid...');
    try {
      const withdrawn = await biddingApi.withdrawBid(bid.id, { signatureKeyphrase });
      syncBidState(withdrawn);
      setPendingSignatureAction(null);
      setSignatureError('');
      showBidNotice('success', 'Notice', 'Bid withdrawn. A new active bid package can be prepared before closing.');
      setActiveStep(0);
    } catch (error) {
      const message = errorMessage(error, 'Bid could not be withdrawn.');
      setSignatureError(isKeyphraseApiError(error) ? message : '');
      showBidNotice('error', 'Notice', message);
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | null, envelope: Envelope, documentType: string, requirementKey: string, requirementLabel = '', metadata: UploadMetadata = {}) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    setUploadingKey(requirementKey);
    showBidNotice('info', 'Notice', bid ? 'Uploading evidence document...' : 'Creating draft before upload...');
    try {
      const draft = await ensureDraftBid();
      showBidNotice('info', 'Notice', `Uploading ${selectedFiles.length} evidence file${selectedFiles.length === 1 ? '' : 's'}...`);
      const updated = await biddingApi.uploadDocuments(draft.id, {
        files: selectedFiles,
        envelope,
        documentType,
        metadata: { requirementKey, requirementLabel, source: 'bid-workspace', ...metadata }
      });
      syncBidState(updated);
      showBidNotice('success', 'Notice', `${selectedFiles.length} evidence file${selectedFiles.length === 1 ? '' : 's'} uploaded and validated.`);
    } catch (error) {
      showBidNotice('error', 'Notice', errorMessage(error, 'Document upload failed.'));
    } finally {
      setUploadingKey(null);
    }
  }

  async function addSampleRecord(input: SampleFormState) {
    const payload = samplePayloadFromForm(input);
    if (!payload) {
      showBidNotice('warning', 'Notice', 'Enter sample name and quantity before adding a sample.');
      return false;
    }
    setSampleSaving(true);
    showBidNotice('info', 'Notice', bid ? 'Adding sample record...' : 'Creating draft before adding sample...');
    try {
      const draft = await ensureDraftBid();
      const created = await biddingApi.createSample(draft.id, payload);
      setSamples((current) => [...current, created]);
      setSampleEdits((current) => ({ ...current, [created.id]: sampleFormFromDto(created) }));
      showBidNotice('success', 'Notice', created.trackingStatus === 'SUBMITTED' ? 'Sample record added and marked as submitted.' : 'Sample record added.');
      return true;
    } catch (error) {
      showBidNotice('error', 'Notice', errorMessage(error, 'Sample record could not be added.'));
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
      showBidNotice('warning', 'Notice', 'Enter sample name and quantity before saving sample changes.');
      return;
    }
    setSampleSaving(true);
    showBidNotice('info', 'Notice', 'Saving sample record...');
    try {
      const updated = await biddingApi.patchSample(bid.id, sample.id, payload);
      syncSample(updated);
      showBidNotice('success', 'Notice', 'Sample record saved.');
    } catch (error) {
      showBidNotice('error', 'Notice', errorMessage(error, 'Sample record could not be saved.'));
    } finally {
      setSampleSaving(false);
    }
  }

  async function markSampleSubmitted(sample: BidSampleDto) {
    if (!bid) return;
    setSampleSaving(true);
    showBidNotice('info', 'Notice', 'Marking sample as submitted...');
    try {
      const updated = await biddingApi.patchSample(bid.id, sample.id, { trackingStatus: 'SUBMITTED' });
      syncSample(updated);
      showBidNotice('success', 'Notice', 'Sample marked as submitted.');
    } catch (error) {
      showBidNotice('error', 'Notice', errorMessage(error, 'Sample could not be marked as submitted.'));
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

  function focusSchemaField(field: BidSubmissionSchemaFieldDto) {
    window.setTimeout(() => {
      const target =
        Array.from(document.querySelectorAll<HTMLElement>('[data-bid-review-source-id]')).find((element) => element.getAttribute('data-bid-review-source-id') === field.id) ??
        Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find((element) => element.getAttribute('aria-label') === field.label);
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      const focusTarget = target?.matches('input, textarea, select, button')
        ? target
        : target?.querySelector<HTMLElement>('textarea, input:not([type="hidden"]), select, button:not([disabled])');
      focusTarget?.focus({ preventScroll: true });
    }, 50);
  }

  function incompleteFieldLabel(field: BidSubmissionSchemaFieldDto) {
    const suffix = field.type === 'file' || field.responseType === 'attachment'
      ? ' (Document upload)'
      : field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'declaration' || field.responseType === 'acknowledgement'
        ? ' (Confirmation)'
        : '';
    return `${field.label || 'Required field'}${suffix}`;
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
    showBidNotice('info', 'Notice', 'Jumped to the source field. Update it, then return to Review Submission.');
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
      const missing = schemaStepValidationFields(currentSchemaStep).filter((field) => field.required && !schemaFieldComplete(field, schemaResponses, documents, samples));
      if (missing.length) {
        const firstMissing = missing[0];
        const message = step.id === 'administrative'
          ? `Complete all mandatory eligibility requirements before continuing. Incomplete: ${incompleteFieldLabel(firstMissing)}`
          : `Complete ${missing.length} required response${missing.length === 1 ? '' : 's'} in this section before continuing. First incomplete: ${incompleteFieldLabel(firstMissing)}`;
        showBidNotice('warning', 'Notice', message);
        focusSchemaField(firstMissing);
        return false;
      }
      return true;
    }
    if (step.id === 'administrative' && !gate.complete) {
      showBidNotice('warning', 'Notice', gate.message);
      return false;
    }
    if ((step.id.includes('financial') || step.id.includes('commercial')) && totalAmount <= 0) {
      showBidNotice('warning', 'Notice', 'Complete the financial offer before continuing.');
      return false;
    }
    return true;
  }

  if (!tenderId) {
    return (
      <BiddingWorkspaceChrome>
        <WorkspaceEmpty message="Open a tender from the marketplace to start or continue a bid." />
      </BiddingWorkspaceChrome>
    );
  }
  if (tenderLoading) {
    return (
      <BiddingWorkspaceChrome>
        <WorkspaceEmpty message="Loading tender..." />
      </BiddingWorkspaceChrome>
    );
  }
  if (isError || !tender) {
    return (
      <BiddingWorkspaceChrome>
        <WorkspaceEmpty message="Tender could not be loaded. Return to the marketplace and try again." />
      </BiddingWorkspaceChrome>
    );
  }
  if (schemaLoading) {
    return (
      <BiddingWorkspaceChrome>
        <WorkspaceEmpty message="Loading bid response fields from the tender requirements..." />
      </BiddingWorkspaceChrome>
    );
  }
  if (!schema) {
    return (
      <BiddingWorkspaceChrome>
        <WorkspaceEmpty message="Bid response fields could not be loaded from the tender requirements." />
      </BiddingWorkspaceChrome>
    );
  }

  const loadedTender = tender;
  const loadedSchema = schema;
  const isSubmitted = bid?.status === 'SUBMITTED';
  const uploading = Boolean(uploadingKey);
  const currentStepIndex = Math.min(activeStep, steps.length - 1);
  const currentStep = steps[currentStepIndex];
  const receiptVisible = Boolean(receipt && currentStep && isReceiptPanelStep(workflow, currentStep.id));

  return (
    <BiddingWorkspaceChrome>
      <div className="procurement-app-page">
        <SignatureKeyphraseModal
          open={pendingSignatureAction !== null}
          title={pendingSignatureAction === 'withdraw' ? 'Withdraw submitted bid' : 'Submit sealed bid'}
          actionLabel={pendingSignatureAction === 'withdraw' ? 'Withdraw bid' : 'Submit bid'}
          isSubmitting={saving}
          error={signatureError}
          onCancel={() => {
            setPendingSignatureAction(null);
            setSignatureError('');
          }}
          onConfirm={(signatureKeyphrase) => {
            if (pendingSignatureAction === 'withdraw') void withdrawBid(signatureKeyphrase);
            else void submitBid(signatureKeyphrase);
          }}
        />
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
            {workflow !== 'goods' ? (
              <Link className="btn btn-secondary" to="/communication">
                Ask Buyer
              </Link>
            ) : null}
            <button className="btn btn-secondary" type="button" disabled={saving || uploading || isSubmitted} onClick={saveDraft}>
              Save Draft
            </button>
            {isSubmitted ? (
              <button className="btn btn-secondary" type="button" disabled={saving || uploading} onClick={() => void withdrawBid()}>
                Withdraw
              </button>
            ) : null}
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
            <div className="sr-only" aria-live="polite" data-bid-workspace-status>{status}</div>
            <StepPanel kicker={currentStep.kicker} title={receiptVisible ? 'Submission Receipt' : currentStep.title} description={currentStep.id === 'worksDeclaration' ? '' : receiptVisible ? 'Bid hash and post-submission actions' : currentStep.description} badge={stepBadge(currentStep.id, validationIssues, documents, receipt, gate)} className={currentStep.id === 'administrative' ? 'bid-mandatory-gate' : undefined}>
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
    </BiddingWorkspaceChrome>
  );

  function renderStep(stepId: string) {
    if (receipt && isReceiptPanelStep(workflow, stepId)) {
      return (
        <ReceiptPanel
          tender={loadedTender}
          schema={loadedSchema}
          responses={schemaResponses}
          documents={documents}
          samples={samples}
          issues={validationIssues}
          totalAmount={totalAmount}
          currency={loadedTender.currency}
          completeness={completeness}
          receipt={receipt}
          onWithdraw={withdrawBid}
          canWithdraw={!saving && !uploading && isSubmitted}
        />
      );
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
              receipt={receipt ?? undefined}
              onEditField={editReviewField}
              onPatch={patchSchemaResponse}
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
      if (workflow === 'works' && currentSchemaStep.id === 'worksDeclaration') {
        return (
          <div data-bid-review-source-id={currentSchemaStep.id}>
            <WorksDeclarationPanel
              step={currentSchemaStep}
              responses={schemaResponses}
              documents={documents}
              disabled={saving || uploading || isSubmitted || Boolean(receipt)}
              uploadingKey={uploadingKey}
              isSubmitted={isSubmitted}
              onPatch={patchSchemaResponse}
              onFiles={addFiles}
              onSubmit={submitBid}
            />
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
      if (workflow === 'goods' && currentSchemaStep.id === 'goodsBidInformation') {
        return (
          <BidInformationPanel
            step={currentSchemaStep}
            tender={loadedTender}
            schema={loadedSchema}
            bid={bid}
            responses={schemaResponses}
            disabled={saving || uploading || isSubmitted || Boolean(receipt)}
            onPatch={patchSchemaResponse}
          />
        );
      }
      if (currentSchemaStep.id === 'administrative') {
        return (
          <AdministrativeGateSchemaPanel
            gate={gate}
            step={currentSchemaStep}
            responses={schemaResponses}
            documents={documents}
            disabled={saving || uploading || isSubmitted || Boolean(receipt)}
            uploadingKey={uploadingKey}
            onPatch={patchSchemaResponse}
            onFiles={addFiles}
          />
        );
      }
      if (workflow === 'goods' && isGoodsTechnicalStep(currentSchemaStep)) {
        return (
          <GoodsTechnicalResponsePanel
            step={currentSchemaStep}
            responses={schemaResponses}
            documents={documents}
            disabled={saving || uploading || isSubmitted || Boolean(receipt)}
            uploadingKey={uploadingKey}
            onPatch={patchSchemaResponse}
            onFiles={addFiles}
          />
        );
      }
      if (workflow === 'goods' && currentSchemaStep.id === 'goodsFinancial') {
        return (
          <GoodsFinancialResponsePanel step={currentSchemaStep} responses={schemaResponses} documents={documents} currency={loadedTender.currency} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
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
      if (workflow === 'works' && currentSchemaStep.id === 'worksTechnicalProposal') {
        return (
          <>
            <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
            <WorksTechnicalProposalPanel step={currentSchemaStep} tender={loadedTender} responses={schemaResponses} documents={documents} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
          </>
        );
      }
      if (workflow === 'works' && currentSchemaStep.id === 'worksFinancial') {
        return (
          <>
            <WorkflowStepContext tender={loadedTender} workflow={workflow} step={currentSchemaStep} />
            <WorksFinancialProposalPanel step={currentSchemaStep} responses={schemaResponses} documents={documents} currency={loadedTender.currency} disabled={saving || uploading || isSubmitted || Boolean(receipt)} uploadingKey={uploadingKey} onPatch={patchSchemaResponse} onFiles={addFiles} />
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
      {description ? (
        <div className="bid-step-intro">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      ) : null}
      {children}
    </article>
  );
}

function WorkflowStepContext({ tender, workflow, step }: { tender: TenderDetail; workflow: WorkflowType; step: BidSubmissionSchemaStepDto }) {
  const context = workflowStepCopy(workflow, step.id);
  const configuredCount = step.fields.filter((field) => field.source !== 'system').length;
  if (workflow === 'goods' || isReviewStep(step) || isReceiptStep(step)) return null;
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
  gate,
  step,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  gate: GateStatus;
  step: BidSubmissionSchemaStepDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const groups = administrativeGateGroups(step);
  const hasFinancialSection = groups.financialFields.length > 0;
  const hasLicenseSection = groups.licenseFields.length > 0;
  const hasSubmissionSection = groups.submissionFields.length > 0;
  const hasOtherSection = groups.otherDocumentFields.length > 0;
  let sectionIndex = 1;
  const financialIndex = sectionIndex;
  if (hasFinancialSection) sectionIndex += 1;
  const licenseIndex = sectionIndex;
  if (hasLicenseSection) sectionIndex += 1;
  const submissionIndex = sectionIndex;
  if (hasSubmissionSection) sectionIndex += 1;
  const otherIndex = sectionIndex;
  if (hasOtherSection) sectionIndex += 1;
  const declarationIndex = sectionIndex;
  const hasDeclarationSection = groups.declarationFields.length > 0;
  const hasAnyTenderRequirement = hasFinancialSection || hasLicenseSection || hasSubmissionSection || hasOtherSection || hasDeclarationSection;

  return (
    <>
      <div className={`bid-gate-status ${gate.complete ? 'balanced' : ''}`}>{gate.message}</div>
      {!hasAnyTenderRequirement ? <div className="scope-empty">No additional tender-specific eligibility responses are required.</div> : null}
      {hasFinancialSection ? (
        <AdministrativeFinancialCapacitySection
          index={financialIndex}
          fields={groups.financialFields}
          responses={responses}
          documents={documents}
          disabled={disabled}
          uploadingKey={uploadingKey}
          onPatch={onPatch}
          onFiles={onFiles}
        />
      ) : null}
      {hasLicenseSection ? (
        <AdministrativeLicenseEvidenceSection index={licenseIndex} fields={groups.licenseFields} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
      ) : null}
      {hasSubmissionSection ? (
        <AdministrativeDocumentGroup
          index={submissionIndex}
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
        <AdministrativeOtherEligibilitySection
          index={otherIndex}
          fields={groups.otherDocumentFields}
          responses={responses}
          documents={documents}
          disabled={disabled}
          uploadingKey={uploadingKey}
          onPatch={onPatch}
          onFiles={onFiles}
        />
      ) : null}
      {hasDeclarationSection ? (
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
        />
      ) : null}
    </>
  );
}

function AdministrativeFinancialCapacitySection({
  index,
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  index: number;
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const mandatoryCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(fields.length - mandatoryCount, 0);
  return (
    <div className="bid-gate-group financial-capacity-response">
      <div className="bid-gate-group-heading">
        <div>
          <span className="section-kicker">{`${index}. Financial capacity requirements`}</span>
          <h3>Financial capacity response</h3>
        </div>
        <span className={`badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}`}>{`${mandatoryCount} mandatory / ${optionalCount} optional`}</span>
      </div>
      {fields.length ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Buyer requirement details</th>
                <th>Supplier declared / actual value</th>
                <th>Explanation / comment</th>
                <th>Evidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const value = structuredValue(schemaFieldValue(field, responses));
                const evidenceSlots = evidenceUploadSlotsForField(field);
                return (
                  <tr key={field.id} data-bid-review-source-id={field.id}>
                    <td>
                      <strong>{field.label}</strong>
                      <span className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</span>
                    </td>
                    <td>{financialCapacityBuyerDetail(field)}</td>
                    <td>
                      {isGoodsFinancialRequirementField(field) ? (
                        <input
                          className="form-input"
                          aria-label={`${field.label} Supplier declared value`}
                          value={String(value.responseValue ?? '')}
                          disabled={disabled}
                          onChange={(event) => patchGoodsStructuredField(field, value, 'responseValue', event.target.value, onPatch)}
                        />
                      ) : (
                        <span className="form-hint">Evidence-only requirement</span>
                      )}
                    </td>
                    <td>
                      {isGoodsFinancialRequirementField(field) ? (
                        <textarea
                          className="form-input"
                          aria-label={`${field.label} Explanation or comment`}
                          rows={2}
                          value={String(value.notes ?? '')}
                          disabled={disabled}
                          onChange={(event) => patchGoodsStructuredField(field, value, 'notes', event.target.value, onPatch)}
                        />
                      ) : (
                        <span className="form-hint">No comment required.</span>
                      )}
                    </td>
                    <td>
                      {evidenceSlots.length ? evidenceSlots.map((slot) => <TechnicalEvidenceUpload key={slot.key} field={field} slot={slot} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />) : isSchemaAttachmentField(field) ? <AdministrativeUploadField field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} /> : <span className="form-hint">No evidence required.</span>}
                    </td>
                    <td>{schemaFieldStatus(field, responses, documents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty">No financial capacity requirements were configured for this tender.</div>
      )}
    </div>
  );
}

function AdministrativeLicenseEvidenceSection({
  index,
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  index: number;
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const mandatoryCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(fields.length - mandatoryCount, 0);
  return (
    <div className="bid-gate-group license-compliance-matrix">
      <div className="bid-gate-group-heading">
        <div>
          <span className="section-kicker">{`${index}. Regulatory license requirements`}</span>
          <h3>{fields.length ? 'Regulatory licence response' : 'Licence and certification documents'}</h3>
        </div>
        <span className={`badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}`}>{`${mandatoryCount} mandatory / ${optionalCount} optional`}</span>
      </div>
      {fields.length ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Licence requirement</th>
                <th>Issuing body</th>
                <th>Possession status</th>
                <th>Licence / certificate number</th>
                <th>Issue date</th>
                <th>Expiry / validity date</th>
                <th>Evidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const value = structuredValue(schemaFieldValue(field, responses));
                return (
                  <tr key={field.id} data-bid-review-source-id={field.id}>
                    <td>
                      <div className="license-permit-cell">
                        <strong>{field.label}</strong>
                        <span className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</span>
                      </div>
                    </td>
                    <td>{administrativeFieldDetail(field)}</td>
                    <td>
                      <select
                        className="form-input"
                        value={String(value.status ?? '')}
                        disabled={disabled}
                        aria-label={`${field.label} possession status`}
                        onChange={(event) => patchGoodsStructuredField(field, value, 'status', event.target.value, onPatch)}
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={String(value.licenseNumber ?? '')}
                        disabled={disabled}
                        aria-label={`${field.label} licence or certificate number`}
                        onChange={(event) => patchGoodsStructuredField(field, value, 'licenseNumber', event.target.value, onPatch)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="date"
                        value={String(value.issueDate ?? '')}
                        disabled={disabled}
                        aria-label={`${field.label} issue date`}
                        onChange={(event) => patchGoodsStructuredField(field, value, 'issueDate', event.target.value, onPatch)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={String(value.expiryDate ?? '')}
                        disabled={disabled}
                        aria-label={`${field.label} expiry or validity`}
                        placeholder="Expiry date or validity note"
                        onChange={(event) => patchGoodsStructuredField(field, value, 'expiryDate', event.target.value, onPatch)}
                      />
                    </td>
                    <td>
                      {isGoodsRegulatoryLicenseField(field) ? (
                        <TechnicalEvidenceUpload field={field} slot={goodsRegulatoryLicenseEvidenceSlot(field)} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                      ) : (
                        <AdministrativeUploadField field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                      )}
                    </td>
                    <td>{schemaFieldStatus(field, responses, documents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty">The buyer has not requested any license or certification documents for this tender.</div>
      )}
    </div>
  );
}

function AdministrativeOtherEligibilitySection({
  index,
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  index: number;
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const mandatoryCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(fields.length - mandatoryCount, 0);
  return (
    <div className="bid-gate-group other-eligibility-response">
      <div className="bid-gate-group-heading">
        <div>
          <span className="section-kicker">{`${index}. Other eligibility requirements`}</span>
          <h3>Other eligibility response</h3>
        </div>
        <span className={`badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}`}>{`${mandatoryCount} mandatory / ${optionalCount} optional`}</span>
      </div>
      {fields.length ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Buyer requirement details</th>
                <th>Confirmation</th>
                <th>Comment</th>
                <th>Evidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const value = structuredValue(schemaFieldValue(field, responses));
                const evidenceSlots = evidenceUploadSlotsForField(field);
                return (
                  <tr key={field.id} data-bid-review-source-id={field.id}>
                    <td>
                      <strong>{field.label}</strong>
                      <span className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</span>
                    </td>
                    <td>{goodsCleanRequirementText(field.validation.notes) || goodsCleanRequirementText(field.validation.prompt) || 'No additional buyer details provided.'}</td>
                    <td>
                      {isGoodsOtherEligibilityField(field) ? (
                        <select
                          className="form-input"
                          aria-label={`${field.label} confirmation`}
                          value={String(value.confirmationStatus ?? '')}
                          disabled={disabled}
                          onChange={(event) => patchGoodsStructuredField(field, value, 'confirmationStatus', event.target.value, onPatch)}
                        >
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      ) : (
                        <span className="form-hint">Evidence-only requirement</span>
                      )}
                    </td>
                    <td>
                      {isGoodsOtherEligibilityField(field) ? (
                        <textarea
                          className="form-input"
                          aria-label={`${field.label} comment`}
                          rows={2}
                          value={String(value.comment ?? '')}
                          disabled={disabled}
                          onChange={(event) => patchGoodsStructuredField(field, value, 'comment', event.target.value, onPatch)}
                        />
                      ) : (
                        <span className="form-hint">No comment required.</span>
                      )}
                    </td>
                    <td>
                      {evidenceSlots.length ? evidenceSlots.map((slot) => <TechnicalEvidenceUpload key={slot.key} field={field} slot={slot} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />) : isSchemaAttachmentField(field) ? <AdministrativeUploadField field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} /> : <span className="form-hint">No evidence required.</span>}
                    </td>
                    <td>{schemaFieldStatus(field, responses, documents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty">No other eligibility requirements were configured for this tender.</div>
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
  onFiles: UploadHandler;
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
  onFiles: UploadHandler;
}) {
  const uploaded = documentsForSchemaField(documents, field);
  const hint = String(field.validation.prompt ?? '');
  return (
    <div>
      <UploadBox
        envelope={field.envelope}
        title={administrativeUploadTitle(field)}
        documentType={String(field.validation.documentType ?? field.responseType ?? 'BID_DOCUMENT')}
        requirementKey={field.requirementKey}
        disabled={disabled}
        isUploading={uploadingKey === field.requirementKey}
        metadata={{ fieldId: field.id }}
        uploadedDocuments={uploaded}
        onFiles={(files, envelope, documentType, requirementKey, requirementLabel, metadata) => onFiles(files, envelope, documentType, requirementKey, requirementLabel || field.label, metadata)}
      />
      {!uploaded.length && hint ? <span className="form-hint">{hint}</span> : null}
    </div>
  );
}

function administrativeGateGroups(step: BidSubmissionSchemaStepDto) {
  const fields = step.fields.filter((field) => field.section === 'administrative');
  const documentFields = fields.filter(isAdministrativeAttachmentField);
  const structuredLicenseFields = fields.filter(isGoodsRegulatoryLicenseField);
  const structuredFinancialFields = fields.filter(isGoodsFinancialRequirementField);
  const structuredOtherEligibilityFields = fields.filter(isGoodsOtherEligibilityField);
  const licenseFields = [...structuredLicenseFields, ...documentFields.filter(isAdministrativeLicenseField)];
  const remainingDocumentFields = documentFields.filter((field) => !licenseFields.includes(field));
  const financialFields = [...structuredFinancialFields, ...remainingDocumentFields.filter(isAdministrativeFinancialCapacityField)];
  const afterFinancialFields = remainingDocumentFields.filter((field) => !financialFields.includes(field));
  const submissionFields = afterFinancialFields.filter(isAdministrativeSubmissionDocumentField);
  const otherDocumentFields = [...structuredOtherEligibilityFields, ...afterFinancialFields.filter((field) => !submissionFields.includes(field))];
  const groupedSet = new Set([...licenseFields, ...financialFields, ...submissionFields, ...otherDocumentFields]);
  const declarationFields = fields.filter((field) => !groupedSet.has(field) && !isAdministrativeAttachmentField(field) && !isGoodsEligibilityDeclarationField(field));

  return {
    financialFields,
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
  if (isAdministrativeFinancialCapacityField(field) || isGoodsOtherEligibilityField(field) || isGoodsOtherEligibilityEvidenceField(field)) return false;
  return /license|certificate|registration|permit|regulatory|crb|osha|statutory|tax clearance|vat registration|manufacturer authorization|authorization/i.test(text);
}

function isGoodsRegulatoryLicenseField(field: BidSubmissionSchemaFieldDto) {
  return (field.type === 'table' || field.responseType === 'structured') && String(field.validation.control ?? '') === 'goodsRegulatoryLicense';
}

function isAdministrativeFinancialCapacityField(field: BidSubmissionSchemaFieldDto) {
  return isGoodsFinancialRequirementField(field) || isGoodsFinancialCapacityEvidenceField(field) || /financialRequirementRows|financial capacity|financialRequirement|turnover|audited accounts|bank statement/i.test(administrativeFieldSearchText(field));
}

function isGoodsFinancialCapacityEvidenceField(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.control ?? '') === 'goodsFinancialCapacityEvidence';
}

function isGoodsOtherEligibilityEvidenceField(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.control ?? '') === 'goodsOtherEligibilityEvidence';
}

function isGoodsOtherEligibilityField(field: BidSubmissionSchemaFieldDto) {
  return (field.type === 'table' || field.responseType === 'structured') && String(field.validation.control ?? '') === 'goodsOtherEligibility';
}

function isAdministrativeSubmissionDocumentField(field: BidSubmissionSchemaFieldDto) {
  const text = administrativeFieldSearchText(field);
  if (isAdministrativeFinancialCapacityField(field) || isGoodsOtherEligibilityField(field) || isGoodsOtherEligibilityEvidenceField(field)) return false;
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

function financialCapacityBuyerDetail(field: BidSubmissionSchemaFieldDto) {
  const rows = [
    ['Minimum value', field.validation.minimumValue],
    ['Period', field.validation.period],
    ['Evidence required', field.validation.evidenceRequired],
    ['Description', field.validation.prompt]
  ]
    .map(([label, value]) => {
      const text = goodsCleanRequirementText(value);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean);
  return rows.join(' / ') || 'No additional buyer details provided.';
}

function schemaFieldStatus(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, documents: BidDocumentState[]) {
  if (schemaFieldComplete(field, responses, documents, [])) return 'Complete';
  if (hasMeaningfulStructuredResponse(schemaFieldValue(field, responses)) || documentsForSchemaField(documents, field).length || evidenceUploadSummary(field, documents)) return 'In progress';
  return 'Not started';
}

function isAdministrativeConfirmationField(field: BidSubmissionSchemaFieldDto) {
  return field.section === 'administrative' && (field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'declaration' || field.responseType === 'acknowledgement');
}

function isGoodsEligibilityDeclarationField(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.control ?? '') === 'goodsEligibilityDeclaration';
}

function administrativeConfirmationCategory(field: BidSubmissionSchemaFieldDto) {
  const category = String(field.validation.category ?? field.validation.group ?? '').trim();
  return category || 'Administrative compliance';
}

function administrativeConfirmationDescription(field: BidSubmissionSchemaFieldDto) {
  const prompt = String(field.validation.prompt ?? field.validation.description ?? field.validation.requirementDescription ?? '').trim();
  if (prompt) return prompt;
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
  onFiles: UploadHandler;
}) {
  const groups = worksCapacityGroups(step);
  const hasAnyGroupedSection = groups.similarProjects.length || groups.personnel.length || groups.equipment.length || groups.hse.length;
  if (!hasAnyGroupedSection) return <div className="scope-empty">No technical capacity fields were configured for this tender.</div>;
  return (
    <div className="works-capacity-workbook">
      {groups.similarProjects.length ? <WorksSimilarProjectsSection fields={groups.similarProjects} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} /> : null}
      {groups.personnel.length ? <WorksPersonnelSection fields={groups.personnel} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} /> : null}
      {groups.equipment.length ? <WorksEquipmentSection fields={groups.equipment} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} /> : null}
      {groups.hse.length ? <WorksHseResponseSection fields={groups.hse} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} /> : null}
    </div>
  );
}

function WorksSimilarProjectsSection({
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
  onFiles: UploadHandler;
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
          return (
            <article className="works-capacity-card" data-bid-review-source-id={field.id} data-works-similar-project-card key={field.id}>
              <div className="bid-dynamic-group-heading">
                <span className="section-kicker">{`Similar project ${index + 1}`}</span>
              </div>
              <div className="form-grid">
                {evidenceUploadSlotsForField(field).map((slot) => (
                  <TechnicalEvidenceUpload key={slot.key} field={field} slot={slot} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                ))}
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
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  uploadingKey: string | null;
  onFiles: UploadHandler;
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
                  {evidenceUploadSlotsForField(field).map((slot) => (
                    <TechnicalEvidenceUpload key={slot.key} field={field} slot={slot} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WorksHseResponseSection({
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const responseField = worksHseResponseField(fields);
  const uploadField = worksHseUploadField(fields) ?? responseField;
  if (!responseField) return null;
  const required = fields.some((field) => field.required);
  const value = structuredValue(schemaFieldValue(responseField, responses));
  return (
    <section className="works-response-section" data-bid-review-source-id={responseField.id}>
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Health, Safety and Environmental Response</h3>
          <p>Provide site-specific safety, environmental, incident, PPE, and waste management controls.</p>
        </div>
        <span className={`badge ${required ? 'badge-warning' : 'badge-info'}`}>{required ? 'Required' : 'Optional response'}</span>
      </div>
      <div className="form-grid two">
        <WorksHseSelect field={responseField} value={value} fieldKey="safetyPolicyAvailable" label="Safety Policy Available" disabled={disabled} onPatch={onPatch} />
        <WorksHseSelect field={responseField} value={value} fieldKey="environmentalPolicyAvailable" label="Environmental Policy Available" disabled={disabled} onPatch={onPatch} />
        <WorksHseSelect field={responseField} value={value} fieldKey="safetyOfficerAssigned" label="Safety Officer Assigned" disabled={disabled} onPatch={onPatch} />
        <WorksHseEvidenceUpload field={responseField} uploadField={uploadField} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
      </div>
      <div className="form-grid">
        <WorksHseTextArea field={responseField} value={value} fieldKey="ppePlan" label="PPE Plan" disabled={disabled} onPatch={onPatch} />
        <WorksHseTextArea field={responseField} value={value} fieldKey="incidentManagementPlan" label="Incident Management Plan" disabled={disabled} onPatch={onPatch} />
        <WorksHseTextArea field={responseField} value={value} fieldKey="wasteManagementPlan" label="Waste Management Plan" disabled={disabled} onPatch={onPatch} />
      </div>
    </section>
  );
}

function WorksEquipmentSection({
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
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
                    {evidenceUploadSlotsForField(field).map((slot) => (
                      <TechnicalEvidenceUpload key={slot.key} field={field} slot={slot} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                    ))}
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

function WorksTechnicalProposalPanel({
  step,
  tender,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  step: BidSubmissionSchemaStepDto;
  tender: TenderDetail;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const fields = step.fields;
  const scopeSummary = worksTenderFieldText(tender, 'scopeSummary') || tender.description || 'Explain how the contractor will execute and complete the works.';
  const proposalSections = [
    ['works.proposal.understanding', 'Project Understanding', 'Understanding of buyer scope, site conditions, drawings, constraints, and deliverables.'],
    ['works.proposal.methodology', 'Construction Methodology', 'Construction sequence, methods, supervision controls, testing, and handover approach.'],
    ['works.proposal.riskPlan', 'Risk Mitigation Plan', 'Technical, schedule, safety, environmental, and commercial risk controls.'],
    ['works.proposal.qualityPlan', 'Quality Assurance Approach', 'Inspection test plans, material approvals, workmanship control, and QA/QC records.']
  ] as const;
  const drawings = worksDrawingRows(tender);
  const alternativeProposedField = schemaFieldByRequirement(fields, 'works.design.alternativeProposed');
  const alternativeProposed = String(schemaOptionalFieldValue(alternativeProposedField, responses) ?? '') === 'Yes';
  return (
    <div className="works-proposal-workbook">
      <section className="works-response-section">
        <div className="bid-dynamic-group-heading">
          <div>
            <h3>Project understanding and methodology</h3>
            <p>{scopeSummary}</p>
          </div>
          <span className="badge badge-warning">Narrative required</span>
        </div>
        <div className="works-accordion-list">
          {proposalSections.map(([key, title, description], index) => {
            const field = schemaFieldByRequirement(fields, key) ?? (key === 'works.proposal.methodology' ? schemaFieldByRequirement(fields, 'works.methodStatement') : undefined);
            if (!field) return null;
            return (
              <details className="works-accordion-card" open={index < 2} key={key}>
                <summary>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </summary>
                <textarea className="form-input works-rich-textarea" aria-label={title} rows={5} value={String(schemaFieldValue(field, responses) ?? '')} disabled={disabled} placeholder={`Write the contractor response for ${title.toLowerCase()}.`} onChange={(event) => onPatch(field, event.target.value)} />
              </details>
            );
          })}
        </div>
      </section>

      <section className="works-response-section">
        <div className="bid-dynamic-group-heading">
          <div>
            <h3>Construction schedule / work program</h3>
            <p>Provide the proposed start date, completion period, resource allocation, and uploaded work program. Milestones, Gantt details, and working hours should be included in the work program file.</p>
          </div>
          <span className="badge badge-warning">Work program required</span>
        </div>
        <div className="form-grid two">
          <WorksSchemaInput field={schemaFieldByRequirement(fields, 'works.schedule.startDate')} responses={responses} disabled={disabled} type="date" onPatch={onPatch} />
          <WorksSchemaInput field={schemaFieldByRequirement(fields, 'works.schedule.completionPeriod')} responses={responses} disabled={disabled} fallbackValue={worksTenderFieldText(tender, 'completionPeriod')} onPatch={onPatch} />
          <WorksSchemaTextArea className="wide" field={schemaFieldByRequirement(fields, 'works.schedule.workPlan')} responses={responses} disabled={disabled} rows={4} placeholder="Describe the work breakdown, sequencing, mobilization, subcontractors, materials, site logistics, and how the uploaded work program will be executed." onPatch={onPatch} />
          <WorksSchemaTextArea className="wide" field={schemaFieldByRequirement(fields, 'works.schedule.resources')} responses={responses} disabled={disabled} rows={3} onPatch={onPatch} />
          <WorksSchemaUpload className="wide" field={schemaFieldByRequirement(fields, 'works.schedule.workProgramUpload')} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
        </div>
      </section>

      <section className="works-response-section">
        <div className="bid-dynamic-group-heading">
          <div>
            <h3>Drawing and Design Section</h3>
            <p>Acknowledge buyer drawings and upload proposed alternative designs where applicable.</p>
          </div>
          <span className={`badge ${worksSiteVisitMandatory(tender) ? 'badge-warning' : 'badge-info'}`}>{worksSiteVisitMandatory(tender) ? 'Site visit required' : 'Site visit response'}</span>
        </div>
        {drawings.length ? (
          <div className="works-drawing-list">
            {drawings.map((drawing, index) => (
              <article className="works-drawing-card" key={`${payloadTitle(drawing, 'Drawing')}-${index}`}>
                <strong>{String(drawing.documentType ?? drawing.otherDocumentName ?? `Drawing ${index + 1}`)}</strong>
                <span>{String(drawing.buyerDocumentUpload ?? 'Buyer drawing uploaded')}</span>
                <label className="bid-response-check">
                  <input type="checkbox" disabled={disabled} />
                  <span>Drawing reviewed</span>
                </label>
              </article>
            ))}
          </div>
        ) : (
          <div className="scope-empty">No drawing rows were configured by the buyer.</div>
        )}
        <WorksSchemaCheck className="works-drawing-review-panel" field={schemaFieldByRequirement(fields, 'works.drawings.reviewedAcknowledgement')} responses={responses} disabled={disabled} onPatch={onPatch} label="We acknowledge that we have reviewed the buyer drawings, schedules, specifications, and design information provided for this tender." hint={drawings.length ? 'Tick this after reviewing all configured buyer drawing rows above.' : 'Tick this after reviewing all drawing or design documents included in the tender package.'} />
        <div className="form-grid two works-design-response-grid">
          <WorksSchemaSelect field={schemaFieldByRequirement(fields, 'works.design.clarificationNeeded')} responses={responses} disabled={disabled} onPatch={onPatch} />
          <WorksSchemaSelect field={alternativeProposedField} responses={responses} disabled={disabled} hint="Select Yes if your bid includes a proposed alternative design or drawing set." onPatch={onPatch} />
          {alternativeProposed ? <WorksSchemaUpload className="wide works-design-alternative-panel" field={schemaFieldByRequirement(fields, 'works.design.alternativeUpload')} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} /> : null}
          {alternativeProposed ? <WorksSchemaTextArea className="wide works-design-alternative-panel" field={schemaFieldByRequirement(fields, 'works.design.alternative')} responses={responses} disabled={disabled} rows={4} placeholder="Describe the proposed alternative design, affected drawings, technical rationale, compliance basis, assumptions, and any buyer approval required." onPatch={onPatch} /> : null}
        </div>
        <WorksSiteVisitResponse fields={fields} tender={tender} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
      </section>
    </div>
  );
}

function WorksFinancialProposalPanel({
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
  onFiles: UploadHandler;
}) {
  const pricingFields = step.fields.filter(isSchemaBoqPricingField);
  const nonPricingFields = step.fields.filter((field) => !isSchemaBoqPricingField(field));
  const financialAttachments = nonPricingFields.filter(isSchemaAttachmentField);
  const commercialFields = nonPricingFields.filter((field) => !isSchemaAttachmentField(field));
  const bidSecurityField = schemaFieldByRequirement(commercialFields, 'works.commercial.bidSecuritySubmitted');
  const bidSecurityDocumentField = schemaFieldByRequirement(financialAttachments, 'works.commercial.bidSecurityDocument');
  const otherFinancialAttachments = financialAttachments.filter((field) => field !== bidSecurityDocumentField);
  const bidSecuritySubmitted = schemaOptionalFieldValue(bidSecurityField, responses) === true;
  return (
    <>
      <WorksFinancialCapacityMatrix fields={otherFinancialAttachments} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
      <div className="data-table works-boq-table premium-review-table">
        <table className="financial-review-table" aria-label="Editable financial offer review table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Work Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Labor</th>
              <th>Material</th>
              <th>Equipment</th>
              <th>Overheads</th>
              <th>Profit %</th>
              <th>Unit Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody data-bid-commercial-body>
            {pricingFields.length ? pricingFields.map((field, index) => <WorksBoqCostRow field={field} responses={responses} currency={currency} disabled={disabled} index={index} onPatch={onPatch} key={field.id} />) : <tr><td colSpan={12}>No works BOQ configured.</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="bid-dynamic-group">
        <div className="bid-dynamic-group-heading">
          <div>
            <h3>Commercial terms response</h3>
            <p>Confirm bid validity, retention, liquidated damages, performance guarantee, and defects liability commitments.</p>
          </div>
          <span className="badge badge-warning">Response required</span>
        </div>
        <div className="goods-commercial-terms works-commercial-terms">
          <div className="form-grid two">
            <WorksSchemaInput field={schemaFieldByRequirement(commercialFields, 'works.commercial.bidValidity')} responses={responses} disabled={disabled} type="number" fallbackValue="120" onPatch={onPatch} />
            <WorksSchemaSelect field={schemaFieldByRequirement(commercialFields, 'works.commercial.currency')} responses={responses} disabled={disabled} fallbackValue={currency || 'TZS'} onPatch={onPatch} />
            <WorksSchemaTextArea className="wide" field={schemaFieldByRequirement(commercialFields, 'works.commercial.clarifications')} responses={responses} disabled={disabled} rows={2} placeholder="Optional BOQ pricing assumptions only. Contract terms are handled after award." onPatch={onPatch} />
            <WorksSchemaCheck field={bidSecurityField} responses={responses} disabled={disabled} onPatch={onPatch} label="Bid security submitted, if required by this tender." />
            {bidSecuritySubmitted ? <WorksSchemaUpload className="wide bid-security-upload-panel" field={bidSecurityDocumentField} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} /> : null}
          </div>
        </div>
      </section>
    </>
  );
}

function WorksFinancialCapacityMatrix({
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const requiredCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(0, fields.length - requiredCount);
  return (
    <section className="bid-dynamic-group financial-capacity-matrix financial-statements-requirements">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Financial statements and capacity requirements</h3>
          <p>Respond to the financial requirements configured by the buyer and upload the requested statements or supporting evidence.</p>
        </div>
        <span className={`badge ${requiredCount ? 'badge-warning' : 'badge-info'}`}>{fields.length ? `${requiredCount} mandatory / ${optionalCount} optional` : 'Not configured'}</span>
      </div>
      {fields.length ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Buyer Requirement</th>
                <th>Minimum / Period</th>
                <th>Evidence Required</th>
                <th>Your Response</th>
                <th>Evidence Note</th>
                <th>Upload</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const value = structuredValue(schemaFieldValue(field, responses));
                return (
                  <tr data-bid-review-source-id={field.id} key={field.id}>
                    <td>
                      <strong>{field.label || `Financial requirement ${index + 1}`}</strong>
                      <small>{field.required ? 'Mandatory' : 'Optional'}</small>
                    </td>
                    <td>{worksFinancialMinimumPeriod(field)}</td>
                    <td>{worksFinancialEvidenceRequired(field)}</td>
                    <td>
                      <textarea className="form-input" rows={2} aria-label={`Response for ${field.label}`} placeholder="Enter amount or response" value={String(value.response ?? '')} disabled={disabled} onChange={(event) => worksPatchStructuredField(field, value, 'response', event.target.value, onPatch)} />
                    </td>
                    <td>
                      <textarea className="form-input" rows={2} aria-label={`Evidence note for ${field.label}`} value={String(value.evidenceNote ?? '')} disabled={disabled} onChange={(event) => worksPatchStructuredField(field, value, 'evidenceNote', event.target.value, onPatch)} />
                    </td>
                    <td>
                      <WorksSchemaUpload field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty">No financial statement requirements were configured for this tender.</div>
      )}
    </section>
  );
}

function WorksSiteVisitResponse({
  fields,
  tender,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  tender: TenderDetail;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  const siteVisitField = schemaFieldByRequirement(fields, 'works.siteVisit');
  const siteVisitNotesField = schemaFieldByRequirement(fields, 'works.siteVisit.notes');
  const siteVisitEvidence = schemaFieldByRequirement(fields, 'works.siteVisitEvidence');
  if (!siteVisitField && !siteVisitNotesField && !siteVisitEvidence) return null;
  return (
    <section className="works-site-visit-response">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Site visit response</h3>
          <p>{worksTenderFieldText(tender, 'siteVisitRequirement') || 'Confirm site investigation status and upload site visit evidence where required.'}</p>
        </div>
        <span className={`badge ${worksSiteVisitMandatory(tender) ? 'badge-warning' : 'badge-info'}`}>{worksSiteVisitMandatory(tender) ? 'Mandatory' : 'Optional'}</span>
      </div>
      <div className="form-grid two">
        <WorksSchemaSelect field={siteVisitField} responses={responses} disabled={disabled} onPatch={onPatch} />
        <WorksSchemaUpload field={siteVisitEvidence} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
        <WorksSchemaTextArea className="wide" field={siteVisitNotesField} responses={responses} disabled={disabled} rows={3} onPatch={onPatch} />
      </div>
    </section>
  );
}

function WorksDeclarationPanel({
  step,
  responses,
  documents,
  disabled,
  uploadingKey,
  isSubmitted,
  onPatch,
  onFiles,
  onSubmit
}: {
  step: BidSubmissionSchemaStepDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  isSubmitted: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
  onSubmit: () => void;
}) {
  const fields = step.fields;
  const signatoryField = schemaFieldByRequirement(fields, 'works.declaration.signatoryName');
  const positionField = schemaFieldByRequirement(fields, 'works.declaration.position');
  const companyStampField = schemaFieldByRequirement(fields, 'works.declaration.companyStamp');
  const signatureField = schemaFieldByRequirement(fields, 'works.declaration.digitalSignature');
  const finalField = schemaFieldByRequirement(fields, 'works.declaration.final');
  const conflictField = schemaFieldByRequirement(fields, 'works.declaration.conflict');
  const antiCorruptionField = schemaFieldByRequirement(fields, 'works.declaration.antiCorruption');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="form-grid two">
        <WorksSchemaInput field={signatoryField} responses={responses} disabled={disabled} onPatch={onPatch} />
        <WorksSchemaInput field={positionField} responses={responses} disabled={disabled} onPatch={onPatch} />
        <WorksDeclarationUpload field={companyStampField} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
        <WorksSchemaInput field={signatureField} responses={responses} disabled={disabled} placeholder="Type authorized digital signature" onPatch={onPatch} />
        <WorksSchemaCheck field={finalField} responses={responses} disabled={disabled} onPatch={onPatch} />
        <WorksSchemaCheck field={conflictField} responses={responses} disabled={disabled} onPatch={onPatch} />
        <WorksSchemaCheck field={antiCorruptionField} responses={responses} disabled={disabled} onPatch={onPatch} />
      </div>
      <div className="review-summary-grid" style={{ marginTop: 18 }}>
        <article className="review-card">
          <span>Submission date</span>
          <strong>{today}</strong>
          <small>Generated automatically by the system.</small>
        </article>
        <article className="review-card">
          <span>Bid status</span>
          <strong data-bid-final-status>Draft until submitted</strong>
          <small>Final submission locks the contractor bid package.</small>
        </article>
      </div>
      <div className="submit-strip">
        <div>
          <strong>Ready to seal</strong>
          <span>The system will check required responses, seal the works bid, and store a receipt.</span>
        </div>
        <button className="btn btn-primary" type="button" disabled={disabled || isSubmitted} onClick={() => onSubmit()}>
          Submit Bid
        </button>
      </div>
    </>
  );
}

function WorksDeclarationUpload({ field, documents, disabled, uploadingKey, onFiles }: { field?: BidSubmissionSchemaFieldDto; documents: BidDocumentState[]; disabled: boolean; uploadingKey: string | null; onFiles: UploadHandler }) {
  if (!field) return null;
  const uploaded = documentsForSchemaField(documents, field);
  const accept = String(field.validation.accept ?? '.pdf,.jpg,.jpeg,.png');
  const documentType = String(field.validation.documentType ?? 'DECLARATION_COMPANY_STAMP');
  return (
    <div className="form-group">
      <label className="form-label">{field.label}</label>
      <UploadBox
        envelope={field.envelope}
        title={field.label}
        documentType={documentType}
        requirementKey={field.requirementKey}
        disabled={disabled}
        isUploading={uploadingKey === field.requirementKey}
        metadata={{ fieldId: field.id }}
        uploadedDocuments={uploaded}
        accept={accept}
        onFiles={onFiles}
      />
    </div>
  );
}

function WorksBoqCostRow({ field, responses, currency, disabled, index, onPatch }: { field: BidSubmissionSchemaFieldDto; responses: SchemaResponseState; currency: string; disabled: boolean; index: number; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  const value = worksBoqValue(schemaFieldValue(field, responses));
  const quantity = Number(field.validation.quantity ?? 1) || 1;
  const unitRate = value.status === 'Not Bid' ? 0 : worksBoqUnitRate(value, quantity);
  const total = value.status === 'Not Bid' ? 0 : unitRate * quantity;
  function patch(next: Partial<WorksBoqValue>) {
    const merged = { ...value, ...next };
    onPatch(field, { ...merged, unitRate: merged.status === 'Not Bid' ? 0 : worksBoqUnitRate(merged, quantity) });
  }
  return (
    <tr className="works-boq-row" data-works-boq-row>
      <td className="financial-review-code">{String(field.validation.itemNo ?? index + 1)}</td>
      <td className="financial-review-work-item">
        <strong>{String(field.validation.description ?? field.label.replace(/^Unit rate for\s+/i, ''))}</strong>
        <small>{String(field.validation.description ?? 'Works BOQ item')}</small>
      </td>
      <td className="financial-review-qty" data-bid-line-qty>{quantity}</td>
      <td className="financial-review-unit">{String(field.validation.unit ?? 'Lot')}</td>
      <td>
        <select className="form-input financial-review-select" aria-label={`Bid status for work item ${index + 1}`} value={value.status} disabled={disabled} onChange={(event) => patch({ status: event.target.value })}>
          <option value="">Select</option>
          <option value="Bid">Bid</option>
          <option value="Not Bid">Not Bid</option>
        </select>
      </td>
      <td><WorksMoneyInput label={`Labor cost for work item ${index + 1}`} currency={currency} value={value.labor} disabled={disabled} onChange={(labor) => patch({ labor })} /></td>
      <td><WorksMoneyInput label={`Material cost for work item ${index + 1}`} currency={currency} value={value.material} disabled={disabled} onChange={(material) => patch({ material })} /></td>
      <td><WorksMoneyInput label={`Equipment cost for work item ${index + 1}`} currency={currency} value={value.equipment} disabled={disabled} onChange={(equipment) => patch({ equipment })} /></td>
      <td><WorksMoneyInput label={`Overheads for work item ${index + 1}`} currency={currency} value={value.overheads} disabled={disabled} onChange={(overheads) => patch({ overheads })} /></td>
      <td><input className="form-input financial-review-profit" type="number" min="0" max="100" step="0.5" aria-label={`Profit margin percentage for work item ${index + 1}`} value={String(value.profit)} disabled={disabled} onChange={(event) => patch({ profit: Number(event.target.value) || 0 })} /></td>
      <td className="financial-review-total-cell" data-works-unit-rate>{formatMoney(unitRate, currency)}</td>
      <td className="financial-review-grand-total" data-bid-line-amount>{formatMoney(total, currency)}</td>
    </tr>
  );
}

function WorksMoneyInput({ label, currency, value, disabled, onChange }: { label: string; currency: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <div className="money-edit-field">
      <span>{currency}</span>
      <input className="form-input" type="number" min="0" step="1000" aria-label={label} value={String(value)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value) || 0)} />
    </div>
  );
}

function WorksSchemaInput({ field, responses, disabled, type = 'text', fallbackValue = '', placeholder, onPatch }: { field?: BidSubmissionSchemaFieldDto; responses: SchemaResponseState; disabled: boolean; type?: string; fallbackValue?: string; placeholder?: string; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  if (!field) return null;
  return (
    <div className="form-group">
      <label className="form-label">{field.label}</label>
      <input className="form-input" aria-label={field.label} type={type} min={type === 'number' ? 1 : undefined} value={String(schemaFieldValue(field, responses) ?? fallbackValue)} disabled={disabled} placeholder={placeholder ?? (typeof field.validation.placeholder === 'string' ? field.validation.placeholder : undefined)} onChange={(event) => onPatch(field, type === 'number' ? Number(event.target.value) || 0 : event.target.value)} />
    </div>
  );
}

function WorksSchemaTextArea({ field, responses, disabled, rows = 3, className = '', placeholder, onPatch }: { field?: BidSubmissionSchemaFieldDto; responses: SchemaResponseState; disabled: boolean; rows?: number; className?: string; placeholder?: string; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  if (!field) return null;
  return (
    <div className={`form-group ${className}`.trim()}>
      <label className="form-label">{field.label}</label>
      <textarea className="form-input" aria-label={field.label} rows={rows} value={String(schemaFieldValue(field, responses) ?? '')} disabled={disabled} placeholder={placeholder} onChange={(event) => onPatch(field, event.target.value)} />
    </div>
  );
}

function WorksSchemaSelect({ field, responses, disabled, fallbackValue = '', hint, onPatch }: { field?: BidSubmissionSchemaFieldDto; responses: SchemaResponseState; disabled: boolean; fallbackValue?: string; hint?: string; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  if (!field) return null;
  const options = Array.isArray(field.validation.options) ? field.validation.options.map(String) : ['Yes', 'No'];
  return (
    <div className="form-group">
      <label className="form-label">{field.label}</label>
      <select className="form-input" aria-label={field.label} value={String(schemaFieldValue(field, responses) ?? fallbackValue)} disabled={disabled} onChange={(event) => onPatch(field, event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option value={option} key={option}>{option}</option>
        ))}
      </select>
      {hint ? <small className="form-hint">{hint}</small> : null}
    </div>
  );
}

function WorksSchemaCheck({ field, responses, disabled, label, hint, className = '', onPatch }: { field?: BidSubmissionSchemaFieldDto; responses: SchemaResponseState; disabled: boolean; label?: string; hint?: string; className?: string; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  if (!field) return null;
  return (
    <article className={className || undefined}>
      <label className="bid-response-check">
        <input type="checkbox" checked={schemaFieldValue(field, responses) === true} disabled={disabled} onChange={(event) => onPatch(field, event.target.checked)} />
        <span>{label ?? field.label}</span>
      </label>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function WorksSchemaUpload({ field, documents, disabled, uploadingKey, onFiles, className = '' }: { field?: BidSubmissionSchemaFieldDto; documents: BidDocumentState[]; disabled: boolean; uploadingKey: string | null; onFiles: UploadHandler; className?: string }) {
  if (!field) return null;
  const uploaded = documentsForSchemaField(documents, field);
  return (
    <div className={`form-group ${className}`.trim()}>
      <UploadBox envelope={field.envelope} title={field.label} documentType={String(field.validation.documentType ?? 'BID_DOCUMENT')} requirementKey={field.requirementKey} disabled={disabled} isUploading={uploadingKey === field.requirementKey} metadata={{ fieldId: field.id }} uploadedDocuments={uploaded} onFiles={onFiles} />
    </div>
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

function WorksHseSelect({
  field,
  value,
  fieldKey,
  label,
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: Record<string, unknown>;
  fieldKey: string;
  label: string;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <label className="form-group">
      <span>{label}</span>
      <select className="form-input" aria-label={label} value={String(value[fieldKey] ?? '')} disabled={disabled} onChange={(event) => worksPatchStructuredField(field, value, fieldKey, event.target.value, onPatch)}>
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </label>
  );
}

function WorksHseTextArea({
  field,
  value,
  fieldKey,
  label,
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: Record<string, unknown>;
  fieldKey: string;
  label: string;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <label className="form-group">
      <span>{label}</span>
      <textarea className="form-input" rows={4} aria-label={label} value={String(value[fieldKey] ?? '')} disabled={disabled} onChange={(event) => worksPatchStructuredField(field, value, fieldKey, event.target.value, onPatch)} />
    </label>
  );
}

function WorksHseEvidenceUpload({
  field,
  uploadField,
  documents,
  disabled,
  uploadingKey,
  onFiles
}: {
  field: BidSubmissionSchemaFieldDto;
  uploadField: BidSubmissionSchemaFieldDto;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onFiles: UploadHandler;
}) {
  const slot = hseEvidenceUploadSlot(field, uploadField);
  const uploaded = documentsForHseUpload(documents, field, uploadField, slot);
  return (
    <div className="form-group technical-evidence-upload">
      <UploadBox
        envelope={uploadField.envelope}
        title={slot.label}
        documentType={slot.documentType}
        requirementKey={slot.requirementKey}
        disabled={disabled}
        isUploading={uploadingKey === slot.requirementKey}
        metadata={{ parentRequirementKey: field.requirementKey, fieldId: field.id, evidenceKey: slot.key }}
        uploadedDocuments={uploaded}
        onFiles={onFiles}
      />
      {!uploaded.length && (field.required || uploadField.required) ? <span className="form-hint">Required evidence upload.</span> : null}
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

function worksHseResponseField(fields: BidSubmissionSchemaFieldDto[]) {
  return fields.find((field) => field.type !== 'file' && field.responseType !== 'attachment') ?? fields[0];
}

function worksHseUploadField(fields: BidSubmissionSchemaFieldDto[]) {
  return fields.find((field) => field.type === 'file' || field.responseType === 'attachment');
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

function worksFinancialMinimumPeriod(field: BidSubmissionSchemaFieldDto) {
  const amount = field.validation.amount ?? field.validation.minimumAmount ?? field.validation.minAmount ?? field.validation.turnoverAmount;
  const period = field.validation.period ?? field.validation.duration ?? field.validation.statementPeriod ?? field.validation.minimumPeriod;
  const amountText = amount === undefined || amount === null || amount === '' ? '' : String(amount);
  const periodText = period === undefined || period === null || period === '' ? '' : String(period);
  if (amountText && periodText) return `${amountText} / ${periodText}`;
  return amountText || periodText || 'Not specified';
}

function worksFinancialEvidenceRequired(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.evidenceRequired ?? field.validation.evidence ?? field.validation.supportingEvidence ?? field.validation.documentType ?? 'Financial capability evidence');
}

function GoodsTechnicalResponsePanel({
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
  onFiles: UploadHandler;
}) {
  const groups = goodsTechnicalGroups(step);

  return (
    <div className="goods-technical-response-workspace">
      <GoodsProductSpecificationResponse fields={groups.productSpecifications} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />

      <GoodsTechnicalUploadSection fields={groups.attachments} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
    </div>
  );
}

function GoodsProductSpecificationResponse({
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  if (!fields.length) {
    return <div className="scope-empty">No buyer product specification template was configured for this goods tender.</div>;
  }

  return (
    <div className="goods-compliance-matrix">
      {fields.map((field, index) => {
        const value = structuredValue(schemaFieldValue(field, responses));
        const details = goodsProductSpecificationDetails(field, index);
        return (
          <article className="goods-compliance-card" data-bid-review-source-id={field.id} key={field.id}>
            <div className="goods-compliance-buyer">
              <span className="section-kicker">{`Item ${details.itemNo}`}</span>
              <h3>{details.requestedProduct}</h3>
              <p>{details.quantityLabel}</p>
              <small>{details.buyerSpecification}</small>
            </div>
            <div className="goods-compliance-response">
              <span className="section-kicker">Supplier response</span>
              <div className="form-grid two">
                <div className="form-group">
                  <label className="form-label">Compliance Status</label>
                  <select className="form-input" aria-label={`${field.label} Compliance`} value={String(value.complianceStatus ?? '')} disabled={disabled} onChange={(event) => patchGoodsStructuredField(field, value, 'complianceStatus', event.target.value, onPatch)}>
                    <option value="">Select status</option>
                    <option value="Comply">Comply</option>
                    <option value="Partially Comply">Partially Comply</option>
                    <option value="Do Not Comply">Do Not Comply</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Evidence / attachment reference</label>
                  <input className="form-input" aria-label={`${field.label} Evidence / attachment reference`} value={String(value.evidenceReference ?? '')} disabled={disabled} onChange={(event) => patchGoodsStructuredField(field, value, 'evidenceReference', event.target.value, onPatch)} />
                </div>
                <div className="form-group wide">
                  <label className="form-label">Offered Value / Supplier Response</label>
                  <textarea className="form-input" aria-label={`${field.label} Supplier offered specification`} rows={3} value={String(value.offeredSpecification ?? '')} disabled={disabled} onChange={(event) => patchGoodsStructuredField(field, value, 'offeredSpecification', event.target.value, onPatch)} />
                </div>
                <div className="form-group wide">
                  <label className="form-label">Deviation / Clarification</label>
                  <textarea className="form-input" aria-label={`${field.label} Deviations / comments`} rows={2} value={String(value.deviations ?? '')} disabled={disabled} onChange={(event) => patchGoodsStructuredField(field, value, 'deviations', event.target.value, onPatch)} />
                </div>
                <GoodsItemEvidenceUpload field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function GoodsItemEvidenceUpload({ field, documents, disabled, uploadingKey, onFiles }: { field: BidSubmissionSchemaFieldDto; documents: BidDocumentState[]; disabled: boolean; uploadingKey: string | null; onFiles: UploadHandler }) {
  if (!goodsRequirementEvidenceAllowed(field, false)) return null;
  const slot = goodsItemEvidenceSlot(field);
  return <TechnicalEvidenceUpload field={field} slot={slot} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />;
}

function GoodsFinancialResponsePanel({
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
  onFiles: UploadHandler;
}) {
  const pricingFields = step.fields.filter(isSchemaBoqPricingField);
  const financialRequirements = step.fields.filter(isGoodsFinancialRequirementField);
  const grouped = new Set([...pricingFields, ...financialRequirements]);
  const commercialFields = step.fields.filter((field) => !grouped.has(field) && String(field.validation.control ?? '') === 'goodsCommercialTerms');
  commercialFields.forEach((field) => grouped.add(field));
  const attachments = step.fields.filter((field) => !grouped.has(field) && isSchemaAttachmentField(field));
  attachments.forEach((field) => grouped.add(field));
  const remaining = step.fields.filter((field) => !grouped.has(field));
  const grandTotal = pricingFields.reduce((sum, field) => sum + schemaFinancialFieldTotal(field, responses), 0);
  const hasDiscountColumn = pricingFields.some(goodsLineDiscountAllowed);
  const hasTaxColumn = pricingFields.some(goodsLineTaxAllowed);
  const columnCount = 6 + (hasDiscountColumn ? 1 : 0) + (hasTaxColumn ? 1 : 0);
  return (
    <div className="goods-financial-response-workspace">
      <section className="bid-financial-boq goods-offer-table" aria-label="Goods financial offer">
        <div className="bid-financial-boq-heading">
          <div>
            <h3>Goods offer rows</h3>
            <span>{`${pricingFields.length} quantity schedule item${pricingFields.length === 1 ? '' : 's'} ready for pricing`}</span>
          </div>
          <div className="bid-financial-boq-total">
            <span>Bid total</span>
            <strong>{formatMoney(grandTotal, currency)}</strong>
          </div>
        </div>
        <div className="bid-financial-boq-scroll">
          <table className="bid-financial-boq-table financial-review-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Unit Price</th>
                {hasDiscountColumn ? <th>Discount</th> : null}
                {hasTaxColumn ? <th>Tax</th> : null}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {pricingFields.length ? (
                pricingFields.map((field, index) => <GoodsOfferRow field={field} responses={responses} currency={currency} disabled={disabled} index={index} showDiscount={hasDiscountColumn} showTax={hasTaxColumn} onPatch={onPatch} key={field.id} />)
              ) : (
                <tr><td colSpan={columnCount}>No quantity schedule configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <GoodsCommercialTermsSection fields={commercialFields} responses={responses} currency={currency} disabled={disabled} onPatch={onPatch} />
      <GoodsFinancialRequirementSection fields={financialRequirements} responses={responses} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />

      {attachments.length ? (
        <section className="bid-dynamic-group goods-financial-upload-section">
          <div className="bid-dynamic-group-heading">
            <div>
              <h3>Financial evidence uploads</h3>
              <p>Upload buyer-requested financial offer or capacity documents.</p>
            </div>
            <span className="badge badge-info">{`${attachments.length} upload${attachments.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="bid-requirement-list">
            {attachments.map((field) => (
              <article className="bid-requirement-card" data-bid-review-source-id={field.id} key={field.id}>
                <div className="bid-response-card-heading">
                  <div>
                    <span className="section-kicker">Financial evidence</span>
                    <h3>{field.label}</h3>
                    <p>{goodsCleanRequirementText(field.validation.prompt) || 'Attach the financial document requested by the buyer.'}</p>
                  </div>
                  <em className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</em>
                </div>
                <WorksSchemaUpload field={field} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {remaining.length ? (
        <section className="bid-dynamic-group goods-additional-financial-response">
          <div className="bid-dynamic-group-heading">
            <div>
              <h3>Additional financial responses</h3>
              <p>Complete remaining buyer-configured financial requirements.</p>
            </div>
            <span className="badge badge-info">{`${remaining.length} response${remaining.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="form-grid two">
            {remaining.map((field) => (
              <SchemaFieldControl key={field.id} field={field} value={schemaFieldValue(field, responses)} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={onPatch} onFiles={onFiles} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function administrativeUploadTitle(field: BidSubmissionSchemaFieldDto) {
  if (isAdministrativeFinancialCapacityField(field)) return 'Upload financial evidence';
  if (isAdministrativeLicenseField(field) || isGoodsRegulatoryLicenseField(field)) return 'Upload license evidence';
  if (isGoodsOtherEligibilityField(field) || isGoodsOtherEligibilityEvidenceField(field) || /eligibility/i.test(administrativeFieldSearchText(field))) return 'Upload eligibility evidence';
  return field.required ? 'Upload mandatory evidence' : 'Upload evidence';
}

function GoodsOfferRow({ field, responses, currency, disabled, index, showDiscount, showTax, onPatch }: { field: BidSubmissionSchemaFieldDto; responses: SchemaResponseState; currency: string; disabled: boolean; index: number; showDiscount: boolean; showTax: boolean; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  const value = goodsOfferValue(schemaFieldValue(field, responses));
  const row = schemaFinancialRow(field, responses, index);
  const discountAllowed = goodsLineDiscountAllowed(field);
  const taxAllowed = goodsLineTaxAllowed(field);
  function patch(next: Partial<GoodsOfferValue>) {
    onPatch(field, { ...value, ...next });
  }
  return (
    <tr className="goods-offer-row" data-bid-review-source-id={field.id}>
      <td className="bid-boq-item-no">{row.itemNo}</td>
      <td className="bid-boq-description"><strong>{row.description}</strong><small>{`${row.quantity} ${row.unit} requested`}</small></td>
      <td className="bid-boq-number" data-bid-line-qty>{String(row.quantity)}</td>
      <td>{row.unit}</td>
      <td>
        <div className="bid-boq-rate-field">
          <span>{currency}</span>
          <input className="form-input" type="number" min={Number(field.validation.min ?? 0)} value={String(value.unitPrice || '')} disabled={disabled} aria-label={`Unit price for ${row.description}`} onChange={(event) => patch({ unitPrice: Number(event.target.value) || 0 })} />
        </div>
      </td>
      {showDiscount ? <td>{discountAllowed ? <input className="form-input" aria-label={`Discount for goods item ${index + 1}`} value={value.discount} disabled={disabled} placeholder="Amount or %" onChange={(event) => patch({ discount: event.target.value })} /> : <span className="form-hint">Not applicable</span>}</td> : null}
      {showTax ? (
        <td>
          {taxAllowed ? (
            <select className="form-input" aria-label={`Tax for goods item ${index + 1}`} value={value.taxIncluded} disabled={disabled} onChange={(event) => patch({ taxIncluded: event.target.value })}>
              <option value="">Select</option>
              <option value="Included">Included</option>
              <option value="Excluded">Excluded</option>
            </select>
          ) : <span className="form-hint">Not applicable</span>}
        </td>
      ) : null}
      <td className="bid-boq-total" data-bid-line-amount>{formatMoney(row.total ?? 0, currency)}</td>
    </tr>
  );
}

function GoodsCommercialTermsSection({ fields, responses, currency, disabled, onPatch }: { fields: BidSubmissionSchemaFieldDto[]; responses: SchemaResponseState; currency: string; disabled: boolean; onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void }) {
  if (!fields.length) return null;
  return (
    <section className="bid-dynamic-group">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Commercial terms response</h3>
          <p>Confirm bid validity, currency, and delivery terms acceptance for this goods offer.</p>
        </div>
        <span className="badge badge-warning">Response required</span>
      </div>
      <div className="goods-commercial-terms">
        <div className="form-grid two">
          <WorksSchemaInput field={schemaFieldByRequirement(fields, 'goods.commercial.bidValidity')} responses={responses} disabled={disabled} type="number" fallbackValue="90" onPatch={onPatch} />
          <WorksSchemaSelect field={schemaFieldByRequirement(fields, 'goods.commercial.currency')} responses={responses} disabled={disabled} fallbackValue={currency || 'TZS'} onPatch={onPatch} />
          <WorksSchemaCheck className="wide" field={schemaFieldByRequirement(fields, 'goods.commercial.deliveryTermsAccepted')} responses={responses} disabled={disabled} onPatch={onPatch} />
        </div>
      </div>
    </section>
  );
}

function GoodsFinancialRequirementSection({
  fields,
  responses,
  documents,
  disabled,
  uploadingKey,
  onPatch,
  onFiles
}: {
  fields: BidSubmissionSchemaFieldDto[];
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
  onFiles: UploadHandler;
}) {
  if (!fields.length) return null;
  return (
    <section className="bid-dynamic-group goods-financial-requirement-response">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Financial capacity requirements</h3>
          <p>Respond to buyer financial capacity requirements and attach supporting evidence.</p>
        </div>
        <span className="badge badge-warning">{`${fields.length} requirement${fields.length === 1 ? '' : 's'}`}</span>
      </div>
      <div className="bid-requirement-list">
        {fields.map((field) => {
          const value = structuredValue(schemaFieldValue(field, responses));
          return (
            <article className="bid-requirement-card" data-bid-review-source-id={field.id} key={field.id}>
              <div className="bid-response-card-heading">
                <div>
                  <span className="section-kicker">Financial capacity</span>
                  <h3>{field.label}</h3>
                  <p>{goodsCleanRequirementText(field.validation.prompt) || 'Provide your response and supporting evidence for this financial requirement.'}</p>
                </div>
                <em className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</em>
              </div>
              <div className="form-grid two">
                <GoodsStructuredTextArea className="wide" field={field} value={value} fieldKey="responseValue" label={`${field.label} Response / value`} visibleLabel="Response / value" rows={3} disabled={disabled} onPatch={onPatch} />
                <GoodsStructuredTextArea className="wide" field={field} value={value} fieldKey="notes" label={`${field.label} Notes`} visibleLabel="Notes" rows={2} disabled={disabled} onPatch={onPatch} />
                <GoodsStructuredInput field={field} value={value} fieldKey="evidenceReference" label={`${field.label} Evidence reference`} visibleLabel="Evidence reference" disabled={disabled} onPatch={onPatch} />
                <TechnicalEvidenceUpload field={field} slot={goodsFinancialRequirementEvidenceSlot(field)} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GoodsTechnicalUploadSection({
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
  onFiles: UploadHandler;
}) {
  const mandatoryCount = fields.filter((field) => field.required).length;
  const optionalCount = Math.max(fields.length - mandatoryCount, 0);
  return (
    <section className="bid-dynamic-group goods-technical-upload-section">
      <div className="bid-dynamic-group-heading">
        <div>
          <h3>Technical requirement uploads</h3>
          <p>Upload goods-related technical evidence requested by the buyer, excluding licenses, administrative submission documents, and financial capacity documents.</p>
        </div>
        <span className={`badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}`}>{`${mandatoryCount} mandatory / ${optionalCount} optional`}</span>
      </div>
      {fields.length ? (
        <div className="bid-requirement-list">
          {fields.map((field) => {
            const uploaded = documentsForSchemaField(documents, field);
            const detail = goodsUploadDetail(field);
            return (
              <article className="bid-requirement-card" data-bid-review-source-id={field.id} key={field.id}>
                <div className="bid-response-card-heading">
                  <div>
                    <span className="section-kicker">{detail.category}</span>
                    <h3>{field.label}</h3>
                    <p>{detail.description}</p>
                  </div>
                  <em className={`badge ${field.required ? 'badge-warning' : 'badge-info'}`}>{field.required ? 'Mandatory' : 'Optional'}</em>
                </div>
                <UploadBox
                  envelope={field.envelope}
                  title={field.required ? 'Upload mandatory evidence' : 'Upload evidence'}
                  documentType={String(field.validation.documentType ?? field.responseType ?? 'BID_DOCUMENT')}
                  requirementKey={field.requirementKey}
                  disabled={disabled}
                  isUploading={uploadingKey === field.requirementKey}
                  metadata={{ fieldId: field.id }}
                  uploadedDocuments={uploaded}
                  onFiles={onFiles}
                />
                {!uploaded.length ? <span className="form-hint">No file selected yet.</span> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="scope-empty">No separate technical evidence uploads were requested for this goods tender.</div>
      )}
    </section>
  );
}

function isGoodsTechnicalStep(step: BidSubmissionSchemaStepDto | { id: string; fields?: BidSubmissionSchemaFieldDto[] }) {
  return step.id === 'goodsTechnical' || (step.id === 'technical' && Boolean(step.fields?.some(isGoodsProductSpecificationField)));
}

function goodsTechnicalGroups(step: BidSubmissionSchemaStepDto) {
  const fields = step.fields.filter((field) => field.section !== 'receipt' && field.section !== 'review' && field.section !== 'samples');
  const productSpecifications = fields.filter(isGoodsProductSpecificationField);
  const productSet = new Set(productSpecifications);
  const attachments = fields.filter((field) => !productSet.has(field) && isSchemaAttachmentField(field));
  return { productSpecifications, attachments };
}

function isGoodsProductSpecificationField(field: BidSubmissionSchemaFieldDto) {
  return (field.type === 'table' || field.responseType === 'structured') && String(field.validation.control ?? '') === 'goodsProductSpecification';
}

function isGoodsFinancialRequirementField(field: BidSubmissionSchemaFieldDto) {
  return (field.type === 'table' || field.responseType === 'structured') && String(field.validation.control ?? '') === 'goodsFinancialRequirement';
}

function isSchemaAttachmentField(field: BidSubmissionSchemaFieldDto) {
  return field.type === 'file' || field.responseType === 'attachment';
}

function goodsLineDiscountAllowed(field: BidSubmissionSchemaFieldDto) {
  return goodsPolicyFlag(field.validation.allowDiscounts)
    || goodsPolicyFlag(field.validation.discountAllowed)
    || goodsPolicyFlag(field.validation.lineDiscountAllowed)
    || goodsPolicyFlag(field.validation.permitDiscount);
}

function goodsLineTaxAllowed(field: BidSubmissionSchemaFieldDto) {
  if (goodsPolicyFlag(field.validation.allowTax) || goodsPolicyFlag(field.validation.taxAllowed) || goodsPolicyFlag(field.validation.taxRequired)) return true;
  const policy = String(field.validation.taxPolicy ?? field.validation.taxMode ?? '').trim();
  return Boolean(policy && !/^(none|not applicable|n\/a)$/i.test(policy));
}

function goodsPolicyFlag(value: unknown) {
  return value === true || /^(yes|true|enabled|allowed|required|1)$/i.test(String(value ?? ''));
}

function patchGoodsStructuredField(field: BidSubmissionSchemaFieldDto, value: Record<string, unknown>, key: string, nextValue: unknown, onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void) {
  onPatch(field, { ...value, [key]: nextValue });
}

function GoodsStructuredInput({
  field,
  value,
  fieldKey,
  label,
  visibleLabel,
  type = 'text',
  fallbackValue = '',
  placeholder,
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: Record<string, unknown>;
  fieldKey: string;
  label: string;
  visibleLabel: string;
  type?: 'text' | 'number';
  fallbackValue?: string | number;
  placeholder?: string;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{visibleLabel}</label>
      <input
        className="form-input"
        type={type}
        min={type === 'number' ? 0 : undefined}
        aria-label={label}
        value={String(value[fieldKey] ?? fallbackValue)}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => patchGoodsStructuredField(field, value, fieldKey, type === 'number' ? Number(event.target.value) || 0 : event.target.value, onPatch)}
      />
    </div>
  );
}

function GoodsStructuredTextArea({
  field,
  value,
  fieldKey,
  label,
  visibleLabel,
  rows = 3,
  className = '',
  disabled,
  onPatch
}: {
  field: BidSubmissionSchemaFieldDto;
  value: Record<string, unknown>;
  fieldKey: string;
  label: string;
  visibleLabel: string;
  rows?: number;
  className?: string;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  return (
    <div className={`form-group ${className}`.trim()}>
      <label className="form-label">{visibleLabel}</label>
      <textarea className="form-input" aria-label={label} rows={rows} value={String(value[fieldKey] ?? '')} disabled={disabled} onChange={(event) => patchGoodsStructuredField(field, value, fieldKey, event.target.value, onPatch)} />
    </div>
  );
}

function goodsProductSpecificationDetails(field: BidSubmissionSchemaFieldDto, index: number) {
  const itemNo = goodsText(field.validation.itemNo) || String(index + 1);
  const requestedProduct = goodsText(field.validation.requestedProduct) || field.label.replace(/^Product specification response\s*-\s*/i, '').trim() || `Goods item ${index + 1}`;
  const quantity = Number(field.validation.quantity);
  const unit = goodsText(field.validation.unit) || 'unit';
  const quantityLabel = Number.isFinite(quantity) && quantity > 0 ? `${quantity} ${unit} required` : 'Quantity configured by buyer';
  const buyerSpecification =
    goodsCleanRequirementText(field.validation.buyerSpecification) ||
    goodsCleanRequirementText(field.validation.specification) ||
    goodsCleanRequirementText(field.validation.technicalSpecification) ||
    goodsCleanRequirementText(field.validation.minimumSpecification) ||
    goodsCleanRequirementText(field.validation.materialQuality) ||
    goodsCleanRequirementText(field.validation.prompt) ||
    'Buyer specification details not provided.';
  return { itemNo, requestedProduct, quantityLabel, buyerSpecification };
}

function goodsUploadDetail(field: BidSubmissionSchemaFieldDto) {
  const description = goodsCleanRequirementText(field.validation.prompt) || goodsCleanRequirementText(field.validation.description) || goodsCleanRequirementText(field.validation.requirementDescription) || 'Attach or describe the evidence required for this bid.';
  const category = goodsText(field.validation.category) || goodsText(field.validation.group) || humanize(String(field.source || 'Technical evidence'));
  return { category, description };
}

function goodsItemEvidenceSlot(field: BidSubmissionSchemaFieldDto): EvidenceUploadSlot {
  return {
    key: 'evidenceReference',
    label: 'Attach item evidence',
    requirementKey: evidenceRequirementKey(field, 'evidenceReference'),
    documentType: evidenceDocumentType(field, { key: 'evidenceReference', label: 'Item evidence' })
  };
}

function goodsRegulatoryLicenseEvidenceSlot(field: BidSubmissionSchemaFieldDto): EvidenceUploadSlot {
  return {
    key: 'licenseEvidence',
    label: 'Upload license evidence',
    requirementKey: evidenceRequirementKey(field, 'licenseEvidence'),
    documentType: evidenceDocumentType(field, { key: 'licenseEvidence', label: 'License evidence' })
  };
}

function goodsFinancialRequirementEvidenceSlot(field: BidSubmissionSchemaFieldDto): EvidenceUploadSlot {
  return {
    key: 'evidenceUpload',
    label: 'Upload financial evidence',
    requirementKey: evidenceRequirementKey(field, 'evidenceUpload'),
    documentType: evidenceDocumentType(field, { key: 'evidenceUpload', label: 'Financial evidence' })
  };
}

function goodsText(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value).trim() : '';
}

function goodsCleanRequirementText(value: unknown) {
  const text = goodsText(value);
  if (!text || goodsLooksLikeRawMetadata(text)) return '';
  return text;
}

function goodsLooksLikeRawMetadata(text: string) {
  const uuidMatches = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)?.length ?? 0;
  if (uuidMatches > 0) return true;
  if (/\b(product-spec|item|line)-\d{8,}[-\w]*\b/i.test(text)) return true;
  return /^[\w-]{8,}\s+\d+\s+.+\s+\d+\s+\w+\s+(true|false)$/i.test(text.trim());
}

function BidInformationPanel({
  step,
  tender,
  schema,
  bid,
  responses,
  disabled,
  onPatch
}: {
  step: BidSubmissionSchemaStepDto;
  tender: TenderDetail;
  schema: BidSubmissionSchemaDto | null;
  bid: BidDto | null;
  responses: SchemaResponseState;
  disabled: boolean;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  const fieldByKey = Object.fromEntries(step.fields.map((field) => [field.requirementKey, field]));
  const fields = [
    fieldByKey['bidInformation.bidderName'],
    fieldByKey['bidInformation.contactName'],
    fieldByKey['bidInformation.contactEmail'],
    fieldByKey['bidInformation.contactPhone'],
    fieldByKey['bidInformation.referenceNumber']
  ].filter((field): field is BidSubmissionSchemaFieldDto => Boolean(field));

  return (
    <section className="bid-dynamic-group bid-information-panel" data-bid-review-source-id={step.id}>
      <div className="bid-information-groups">
        <BidInformationReadOnlyGroup
          title="Tender being responded to"
          rows={[
            ['Tender title', tender.title || schema?.tenderTitle || 'Not provided'],
            ['Tender number', tender.reference || schema?.tenderReference || 'Not provided'],
            ['Procuring organization', goodsTenderOrganizationName(tender)],
            ['Procurement category', 'Goods'],
            ['Procurement method', goodsTenderProcurementMethod(tender)],
            ['Closing date/time', goodsDateLabel(tender.closingDate)]
          ]}
        />
        <BidInformationReadOnlyGroup
          title="Bidder organization"
          rows={[
            ['Supplier organization', bidderNameFromResponses(responses) || bid?.supplierName || 'Not provided'],
            ['Supplier account context', bid?.supplierName || bidderNameFromResponses(responses) || 'Not provided']
          ]}
        />
        <BidInformationReadOnlyGroup
          title="Bid response"
          rows={[
            ['Bid reference', String(responses['bidInformation.referenceNumber'] ?? bid?.reference ?? '').trim() || 'Pending draft reference'],
            ['Draft status', bid?.status || 'DRAFT'],
            ['Response version', goodsDraftResponseVersion(bid)],
            ['Last saved', bid?.updatedAt ? formatDate(bid.updatedAt) : 'Not saved yet']
          ]}
        />
        <BidInformationReadOnlyGroup
          title="Bid scope"
          rows={[
            ['Scope', 'This bid covers the required tender items.'],
            ['Important timing', `Submission must complete before ${goodsDateLabel(tender.closingDate)}.`]
          ]}
        />
      </div>
      <div className="form-grid two">
        {fields.map((field) => {
          const readOnly = field.validation.readOnly === true;
          return (
            <label className={readOnly ? 'bid-readonly-field' : undefined} data-bid-review-source-id={field.id} key={field.id}>
              <span>{field.label}</span>
              <input
                className="form-input"
                aria-label={field.label}
                type={field.validation.inputType === 'email' ? 'email' : field.validation.inputType === 'tel' ? 'tel' : 'text'}
                value={String(schemaFieldValue(field, responses) ?? '')}
                disabled={disabled}
                readOnly={readOnly}
                onChange={(event) => onPatch(field, event.target.value)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
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
  onFiles: UploadHandler;
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
  onFiles: UploadHandler;
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
          metadata={{ fieldId: field.id }}
          uploadedDocuments={uploaded}
          onFiles={onFiles}
        />
        {!uploaded.length && hint ? <span className="form-hint">{hint}</span> : null}
      </div>
    );
  }

  if (field.type === 'table' || field.responseType === 'structured') {
    return <StructuredResponseControl field={field} value={value} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onPatch={(nextValue) => onPatch(field, nextValue)} onFiles={onFiles} />;
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
  onPatch: (value: Record<string, unknown>) => void;
  onFiles: UploadHandler;
}) {
  const current = structuredValue(value);
  const control = String(field.validation.control ?? '');
  const title = structuredControlTitle(control, field.label);
  const prompt = String(field.validation.prompt ?? field.validation.buyerRequirement ?? schemaRequirementText(field));
  const rows = structuredControlRows(control);
  const evidenceSlots = evidenceUploadSlotsForField(field);

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
                  {evidenceSlots.some((slot) => slot.key === row.key) ? (
                    <TechnicalEvidenceUpload field={field} slot={evidenceSlots.find((slot) => slot.key === row.key)!} documents={documents} disabled={disabled} uploadingKey={uploadingKey} onFiles={onFiles} />
                  ) : row.kind === 'select' ? (
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

type EvidenceUploadSlot = {
  key: string;
  label: string;
  requirementKey: string;
  documentType: string;
};

function TechnicalEvidenceUpload({
  field,
  slot,
  documents,
  disabled,
  uploadingKey,
  onFiles
}: {
  field: BidSubmissionSchemaFieldDto;
  slot: EvidenceUploadSlot;
  documents: BidDocumentState[];
  disabled: boolean;
  uploadingKey: string | null;
  onFiles: UploadHandler;
}) {
  const uploaded = documentsForEvidenceSlot(documents, field, slot);
  const uploadRequired = evidenceUploadRequired(field);
  return (
    <div className="form-group technical-evidence-upload">
      <UploadBox
        envelope={field.envelope}
        title={slot.label}
        documentType={slot.documentType}
        requirementKey={slot.requirementKey}
        disabled={disabled}
        isUploading={uploadingKey === slot.requirementKey}
        metadata={{ parentRequirementKey: field.requirementKey, fieldId: field.id, evidenceKey: slot.key }}
        uploadedDocuments={uploaded}
        onFiles={onFiles}
      />
      {uploaded.length ? <span className="form-hint">{`Uploaded: ${documentNames(uploaded)}`}</span> : uploadRequired ? <span className="form-hint">Required evidence upload.</span> : null}
    </div>
  );
}

function evidenceUploadRequired(field: BidSubmissionSchemaFieldDto) {
  const control = String(field.validation.control ?? '');
  if (control === 'goodsRegulatoryLicense') return field.required || goodsRequirementEvidenceRequired(field);
  if (control === 'goodsFinancialRequirement' || control === 'goodsOtherEligibility' || control === 'goodsProductSpecification') return goodsRequirementEvidenceRequired(field);
  return field.required;
}

function evidenceUploadSlotsForField(field: BidSubmissionSchemaFieldDto): EvidenceUploadSlot[] {
  if (field.type !== 'table' && field.responseType !== 'structured') return [];
  const control = String(field.validation.control ?? '');
  if (control === 'goodsProductSpecification') return [];
  const configured = explicitEvidenceRows(control, field);
  const rows = configured.length ? configured : structuredControlRows(control).filter(isEvidenceStructuredRow);
  return rows.map((row) => ({
    key: row.key,
    label: uploadLabelForEvidenceRow(row),
    requirementKey: evidenceRequirementKey(field, row.key),
    documentType: String(field.validation.documentType ?? '').trim() || evidenceDocumentType(field, row)
  }));
}

function explicitEvidenceRows(control: string, field: BidSubmissionSchemaFieldDto): StructuredControlRow[] {
  if (control === 'goodsFinancialRequirement') return goodsFinancialEvidenceAllowed(field) ? [{ key: 'evidenceUpload', label: 'Upload financial evidence' }] : [];
  if (control === 'goodsRegulatoryLicense') return goodsRequirementEvidenceAllowed(field, true) ? [{ key: 'licenseEvidence', label: 'Upload license evidence' }] : [];
  if (control === 'goodsOtherEligibility') return goodsRequirementEvidenceAllowed(field, true) ? [{ key: 'evidenceUpload', label: 'Upload eligibility evidence' }] : [];
  if (control === 'worksSimilarProject') return [{ key: 'referenceEvidence', label: 'Similar project document' }];
  if (control === 'worksPersonnel' || control === 'serviceStaffing' || control === 'consultancyKeyExpert') return [{ key: 'cvEvidence', label: 'CV upload' }];
  if (control === 'worksEquipment' || control === 'serviceEquipment') return [{ key: 'evidenceReference', label: 'Lease / access agreement' }];
  return [];
}

function isEvidenceStructuredRow(row: StructuredControlRow) {
  return /evidence|cv|proof|certificate|attachment|document|upload/i.test(`${row.key} ${row.label}`);
}

function uploadLabelForEvidenceRow(row: StructuredControlRow) {
  return /upload/i.test(row.label) ? row.label : `Upload ${row.label}`;
}

function evidenceRequirementKey(field: BidSubmissionSchemaFieldDto, evidenceKey: string) {
  return `${field.requirementKey}.${evidenceKey}`;
}

function evidenceDocumentType(field: BidSubmissionSchemaFieldDto, row: StructuredControlRow) {
  const prefix = field.envelope === 'ADMINISTRATIVE' ? 'ADMIN' : field.envelope;
  const normalized = `${field.label}_${row.label}`
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return `${prefix}_${normalized || 'EVIDENCE'}`.slice(0, 120);
}

function structuredControlRows(control: string): StructuredControlRow[] {
  if (control === 'goodsProductSpecification') {
    return [
      { key: 'complianceStatus', label: 'Compliance', kind: 'select', options: ['Comply', 'Partially Comply', 'Do Not Comply'] },
      { key: 'offeredSpecification', label: 'Offered value / supplier response', long: true },
      { key: 'evidenceReference', label: 'Evidence / attachment reference' },
      { key: 'deviations', label: 'Deviation / clarification', long: true }
    ];
  }
  if (control === 'goodsFinancialRequirement') {
    return [
      { key: 'responseValue', label: 'Response / value', long: true },
      { key: 'notes', label: 'Notes', long: true },
      { key: 'evidenceReference', label: 'Evidence reference' },
      { key: 'evidenceUpload', label: 'Financial evidence' }
    ];
  }
  if (control === 'goodsRegulatoryLicense') {
    return [
      { key: 'status', label: 'Possession status', kind: 'select', options: ['Yes', 'No'] },
      { key: 'licenseNumber', label: 'Licence / certificate number' },
      { key: 'issueDate', label: 'Issue date' },
      { key: 'expiryDate', label: 'Expiry / validity date' },
      { key: 'licenseEvidence', label: 'License evidence' }
    ];
  }
  if (control === 'goodsOtherEligibility') {
    return [
      { key: 'confirmationStatus', label: 'Confirmation', kind: 'select', options: ['Yes', 'No'] },
      { key: 'comment', label: 'Comment', long: true },
      { key: 'evidenceUpload', label: 'Eligibility evidence' }
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
    goodsFinancialRequirement: 'Financial capacity requirement',
    goodsRegulatoryLicense: 'Regulatory license response',
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
      <button className="btn btn-secondary" type="button" disabled={saving || uploading || isSubmitted} onClick={() => onSave()}>
        Save Draft
      </button>
      <button className="btn btn-primary" type="button" disabled={saving || uploading || isSubmitted} onClick={() => onSubmit()}>
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
  metadata = {},
  uploadedDocuments = [],
  accept,
  onFiles
}: {
  envelope: Envelope;
  title: string;
  documentType: string;
  requirementKey: string;
  disabled: boolean;
  isUploading: boolean;
  metadata?: UploadMetadata;
  uploadedDocuments?: BidDocumentState[];
  accept?: string;
  onFiles: UploadHandler;
}) {
  const hasUploadedDocuments = uploadedDocuments.length > 0;
  return (
    <label className={`supplier-requirement-preview ${hasUploadedDocuments ? 'has-upload' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <span>{isUploading ? 'Uploading...' : hasUploadedDocuments ? 'Uploaded documents' : `${envelope} documents`}</span>
      <strong>{title}</strong>
      {hasUploadedDocuments ? <small className="form-hint">{`Uploaded: ${documentNames(uploadedDocuments)}`}</small> : null}
      <span className="bid-upload-action">{hasUploadedDocuments ? 'Upload another file' : 'Browse files'}</span>
      <input
        className="bid-upload-input sr-only"
        type="file"
        multiple
        accept={accept}
        aria-label={title}
        disabled={disabled}
        onChange={(event) => {
          const input = event.currentTarget;
          void onFiles(input.files, envelope, documentType, requirementKey, title, metadata).finally(() => {
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

type ReviewChecklistItem = {
  label: string;
  value: string;
  note: string;
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
  receipt,
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
  receipt?: BidReceiptDto;
  onEditField: (sourceId: string) => void;
  onPatch: (field: BidSubmissionSchemaFieldDto, value: unknown) => void;
}) {
  if (isGoodsBidReview(schema, tender)) {
    return (
      <GoodsOfficialBidReviewPanel
        tender={tender}
        schema={schema}
        responses={responses}
        documents={documents}
        samples={samples}
        totalAmount={totalAmount}
        currency={currency}
        completeness={completeness}
        isSubmitted={isSubmitted}
        receipt={receipt}
        onEditField={onEditField}
      />
    );
  }
  const sections = reviewDocumentSections(schema, responses, documents, samples, currency);
  const responseCount = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const statusLabel = isSubmitted ? 'Submitted' : issues.length ? 'Draft review' : 'Ready for submission';
  const checklistItems = reviewCompletenessChecklist(schema, responses, documents, samples, currency);
  const confirmationField = reviewConfirmationField(schema);
  const confirmationChecked = confirmationField ? schemaFieldValue(confirmationField, responses) === true : false;
  const bidderLabel = bidderNameFromResponses(responses);
  return (
    <>
      <div className="record-summary submission-readiness-dashboard">
        <SummaryItem label="Bidder" value={bidderLabel} />
        <SummaryItem label="Eligibility readiness" value={sectionReadiness(schema, responses, documents, samples, 'administrative')} />
        <SummaryItem label="Technical response" value={`${technicalReviewResponseCount(schema, responses, documents, samples, currency)} response fields`} />
        <SummaryItem label="Financial offer" value={formatMoney(totalAmount, currency)} />
        <SummaryItem label="Evidence files" value={`${documents.length} uploaded`} />
        <SummaryItem label="Submission status" value={statusLabel} />
      </div>
      <div className="bid-step-intro">
        <strong>Submission readiness dashboard</strong>
        <span>Review completeness, pricing, technical evidence, work program details, and declaration readiness before submitting.</span>
      </div>
      <section className="bid-dynamic-group bid-validation-checklist">
        <div className="bid-dynamic-group-heading">
          <div>
            <h3>Bid submission completeness checklist</h3>
            <p>Confirm the bid package is complete before the declaration and sealed submission.</p>
          </div>
          <span className="badge badge-warning">{`${checklistItems.length} checks`}</span>
        </div>
        <div className="review-summary-grid">
          {checklistItems.map((item) => (
            <article className="review-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
        <label className="bid-response-check">
          <input
            type="checkbox"
            checked={confirmationChecked}
            disabled={isSubmitted || !confirmationField || !onPatch}
            onChange={(event) => {
              if (confirmationField && onPatch) onPatch(confirmationField, event.target.checked);
            }}
          />
          <span>I have reviewed the completeness checklist and corrected any incomplete bid sections.</span>
        </label>
      </section>
      <section className="bid-response-review" data-bid-response-review>
      <div className="evaluation-bid-document-review">
        <div className="bid-response-download-panel">
          <div>
            <span className="section-kicker">Supplier submission preview</span>
            <strong>Bid submission review preview</strong>
            <p>Download or print the current supplier bid review after required actions are captured.</p>
          </div>
          <div className="inline-actions">
            <button className="btn btn-secondary" type="button" data-bid-download-review-document onClick={(event) => { void downloadBidResponseDocument(tender, event.currentTarget); }}>
              Download HTML
            </button>
            <button className="btn btn-primary" type="button" data-bid-print-review-document onClick={(event) => printBidResponseDocument(tender, event.currentTarget)}>
              Print / Save PDF
            </button>
          </div>
        </div>
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
            <section className="bid-completeness-summary">
              <div>
                <span className="section-kicker">Action required before submission</span>
                <strong>{`${completeness.percent}%`}</strong>
                <p>{issues.length ? `Complete ${issues.length} pending required item${issues.length === 1 ? '' : 's'} before final submission.` : 'All required review checks are complete.'}</p>
              </div>
              <div className="bid-completeness-meter" aria-label={`${completeness.percent}% complete`}>
                <span style={{ width: `${completeness.percent}%` }} />
              </div>
            </section>
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
      </section>
    </>
  );
}

function BidInformationReadOnlyGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="bid-information-readonly-group">
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function goodsFinancialEvidenceAllowed(field: BidSubmissionSchemaFieldDto) {
  return goodsRequirementEvidenceAllowed(field, false);
}

function goodsRequirementEvidenceAllowed(field: BidSubmissionSchemaFieldDto, defaultAllowed: boolean) {
  const policy = String(field.validation.attachmentPolicy ?? '').toUpperCase();
  if (policy === 'NONE') return false;
  if (policy === 'OPTIONAL' || policy === 'REQUIRED') return true;
  if (goodsEvidenceInstructionText(field)) return true;
  if ([field.validation.evidenceRequired, field.validation.requiresUpload, field.validation.documentRequired].some((value) => value === true || /^(yes|true|required|mandatory|1)$/i.test(String(value ?? '')))) return true;
  return defaultAllowed;
}

function goodsRequirementEvidenceRequired(field: BidSubmissionSchemaFieldDto) {
  const policy = String(field.validation.attachmentPolicy ?? '').toUpperCase();
  if (policy === 'REQUIRED') return true;
  return Boolean(goodsEvidenceInstructionText(field)) || [field.validation.evidenceRequired, field.validation.requiresUpload, field.validation.documentRequired].some((value) => value === true || /^(yes|true|required|mandatory|1)$/i.test(String(value ?? '')));
}

function goodsEvidenceInstructionText(field: BidSubmissionSchemaFieldDto) {
  const value = goodsCleanRequirementText(field.validation.evidenceRequired);
  if (!value || /^(no|none|not required|n\/a)$/i.test(value)) return '';
  return value;
}

type GoodsBidSummaryField = {
  label: string;
  value: string;
  emphasis?: boolean;
};

type GoodsBidEligibilityRow = {
  id: string;
  requirement: string;
  buyerRequirement: string;
  supplierResponse: string;
  evidence: string;
  status: string;
  sourceId: string;
  complete: boolean;
};

type GoodsBidEligibilityGroup = {
  title: string;
  rows: GoodsBidEligibilityRow[];
};

type GoodsBidTechnicalRow = {
  id: string;
  specification: string;
  requiredValue: string;
  offeredValue: string;
  compliance: string;
  deviation: string;
  evidence: string;
  sourceId: string;
  complete: boolean;
};

type GoodsBidTechnicalGroup = {
  id: string;
  itemNo: string;
  itemName: string;
  quantityLabel: string;
  rows: GoodsBidTechnicalRow[];
};

type GoodsBidFinancialRow = {
  id: string;
  line: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  tax: string;
  lineTotal: string;
  sourceId: string;
  complete: boolean;
};

type GoodsBidSampleRow = {
  id: string;
  item: string;
  requiredQuantity: string;
  condition: string;
  delivery: string;
  supplierPlan: string;
  tracking: string;
};

type GoodsBidAttachmentRow = {
  id: string;
  ref: string;
  title: string;
  category: string;
  related: string;
  filename: string;
};

type GoodsBidDeviationRow = {
  id: string;
  ref: string;
  requirement: string;
  supplierPosition: string;
  explanation: string;
};

function GoodsOfficialBidReviewPanel({
  tender,
  schema,
  responses,
  documents,
  samples,
  totalAmount,
  currency,
  completeness,
  isSubmitted,
  receipt,
  onEditField
}: {
  tender: TenderDetail;
  schema: BidSubmissionSchemaDto;
  responses: SchemaResponseState;
  documents: BidDocumentState[];
  samples: BidSampleDto[];
  totalAmount: number;
  currency: string;
  completeness: { percent: number; sectionsComplete: number; totalSections: number };
  isSubmitted: boolean;
  receipt?: BidReceiptDto;
  onEditField: (sourceId: string) => void;
}) {
  const attachmentRegister = goodsBidAttachmentRegister(schema, documents);
  const eligibilityGroups = goodsBidEligibilityGroups(schema, responses, documents, samples, attachmentRegister);
  const technicalGroups = goodsBidTechnicalGroups(schema, responses, documents, samples, attachmentRegister);
  const financialRows = goodsBidFinancialRows(schema, responses, currency, documents, samples);
  const financialSummary = goodsBidFinancialSummary(schema, responses, currency, totalAmount);
  const sampleRows = goodsBidSampleRows(schema, tender, samples);
  const deviationRows = goodsBidDeviationRows(technicalGroups);
  const pendingActions = reviewDocumentSections(schema, responses, documents, samples, currency)
    .filter((section) => !/declaration|submit/i.test(section.title))
    .flatMap((section) => section.rows.map((row) => ({ ...row, sectionTitle: section.title })))
    .filter((row) => !row.complete);
  const blockingIssues = goodsPreDeclarationValidationIssues(schema, responses, documents, samples);
  const bidderLabel = bidderNameFromResponses(responses);
  const bidReference = goodsBidReference(responses, tender);
  const statusText = isSubmitted ? 'SUBMITTED' : 'DRAFT — NOT SUBMITTED';
  const versionLabel = goodsBidSubmissionVersion(receipt);
  const tenderVersion = goodsTenderVersionLabel(tender);
  const summaryFields: GoodsBidSummaryField[] = [
    { label: 'Procuring Organization', value: goodsTenderOrganizationName(tender) },
    { label: 'Tender Number', value: tender.reference || schema.tenderReference || 'Not provided' },
    { label: 'Procurement Category', value: 'Goods' },
    { label: 'Procurement Method', value: goodsTenderProcurementMethod(tender) },
    { label: 'Bidder', value: bidderLabel },
    { label: 'Bid Reference', value: bidReference },
    { label: 'Bid Status', value: statusText },
    { label: 'Bid Submission Version', value: versionLabel },
    { label: 'Closing Date', value: goodsDateLabel(tender.closingDate) },
    { label: 'Currency', value: currency || tender.currency || 'Not provided' },
    { label: 'Grand Total Bid Price', value: formatMoney(totalAmount, currency), emphasis: true },
    { label: 'Sample Requirement', value: sampleRows.length ? 'Required' : 'Not required' },
    { label: 'Tender Version Acknowledged', value: tenderVersion }
  ];
  const bidInfoRows = goodsBidInformationRows(responses);
  const financialPolicyFields = schemaFinancialFields(schema);
  const hasDiscountColumn = financialPolicyFields.some(goodsLineDiscountAllowed);
  const hasTaxColumn = financialPolicyFields.some(goodsLineTaxAllowed);

  return (
    <>
      <section className="bid-dynamic-group bid-review-validation-summary no-print">
        <div className="bid-dynamic-group-heading">
          <div>
            <h3>Document completeness summary</h3>
            <p>Blocking validation items must be resolved outside the official document canvas before final declaration.</p>
          </div>
          <span className={`badge ${blockingIssues.length ? 'badge-warning' : 'badge-success'}`}>{blockingIssues.length ? `${blockingIssues.length} blocking` : 'Ready'}</span>
        </div>
        <div className="bid-review-completeness-grid">
          <div>
            <span>Completion</span>
            <strong>{`${completeness.percent}%`}</strong>
          </div>
          <div>
            <span>Completed required sections</span>
            <strong>{`${completeness.sectionsComplete}/${completeness.totalSections}`}</strong>
          </div>
          <div>
            <span>Bid status</span>
            <strong>{isSubmitted ? 'Submitted' : 'Draft review'}</strong>
          </div>
        </div>
        {blockingIssues.length ? <ul className="bid-review-issue-list">{blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p className="form-hint">No blocking validation issues are currently detected.</p>}
      </section>
      {pendingActions.length ? (
        <section className="bid-dynamic-group bid-review-actions-list no-print">
          <div className="bid-dynamic-group-heading">
            <div>
              <h3>Required corrections</h3>
              <p>Use these actions to return to the exact tender-derived response that still needs work. The official document preview remains read-only.</p>
            </div>
            <span className="badge badge-warning">{`${pendingActions.length} pending`}</span>
          </div>
          <div className="bid-review-action-grid">
            {pendingActions.map((row) => (
              <article className="bid-review-action-row" key={`${row.sectionTitle}-${row.id}`}>
                <div>
                  <span>{row.sectionTitle}</span>
                  <strong>{row.label}</strong>
                  <small>{row.upload ? 'Upload evidence file' : 'Complete supplier response'}</small>
                </div>
                {isSubmitted ? (
                  <span className="bid-review-readonly">Read only</span>
                ) : (
                  <button className="bid-review-edit-button" type="button" onClick={() => onEditField(row.sourceId)}>
                    {row.upload ? 'Replace file' : 'Change'}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="bid-response-review goods-official-bid-review" data-bid-response-review>
        <div className="evaluation-bid-document-review">
          <div className="bid-response-download-panel">
            <div>
              <span className="section-kicker">Review Submission</span>
              <strong>Official goods bid submission document</strong>
              <p>Download a marked draft copy or print to PDF. A submitted copy is final only after the server creates a receipt.</p>
            </div>
            <div className="inline-actions">
              <button className="btn btn-secondary" type="button" data-bid-download-review-document onClick={(event) => { void downloadBidResponseDocument(tender, event.currentTarget); }}>
                Download PDF
              </button>
              <button className="btn btn-primary" type="button" data-bid-print-review-document onClick={(event) => printBidResponseDocument(tender, event.currentTarget)}>
                Print / Save PDF
              </button>
            </div>
          </div>
          <article className="bid-response-document goods-bid-official-document" data-bid-document-status={statusText} data-bid-document-version={versionLabel} data-bid-reference={bidReference} data-tender-reference={tender.reference || schema.tenderReference || tender.id}>
            <header className="goods-bid-doc-front">
              <div className="goods-bid-doc-org">
                {tender.buyerLogoUrl ? <img src={tender.buyerLogoUrl} alt={`${goodsTenderOrganizationName(tender)} logo`} /> : null}
                <div>
                  <strong>{goodsTenderOrganizationName(tender)}</strong>
                  <span>BID SUBMISSION — GOODS PROCUREMENT</span>
                </div>
              </div>
              <div className="goods-bid-doc-title-block">
                <h1>{tender.title || schema.tenderTitle}</h1>
                <p>{`Tender Number: ${tender.reference || schema.tenderReference || 'Not provided'}`}</p>
                <p>{`Submitted by: ${bidderLabel}`}</p>
                <p>{`Bid Reference: ${bidReference}`}</p>
              </div>
              <aside className="goods-bid-doc-status-block" aria-label="Bid document status">
                <span>{statusText}</span>
                <strong>{versionLabel}</strong>
                <small>{`Tender version: ${tenderVersion}`}</small>
                {receipt?.createdAt ? <small>{`Submitted: ${formatDate(receipt.createdAt)}`}</small> : null}
              </aside>
            </header>

            <section className="goods-bid-doc-summary-grid" aria-label="Bid front matter summary">
              {summaryFields.map((field) => (
                <div className={field.emphasis ? 'is-emphasis' : ''} key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </section>

            <GoodsBidDocSection number="01" title="Bid Submission Summary">
              <div className="goods-bid-doc-info-grid">
                <GoodsBidInfoItem label="Bid reference and response version" value={`${bidReference} / ${versionLabel}`} />
                <GoodsBidInfoItem label="Tender reference" value={tender.reference || schema.tenderReference || 'Not provided'} />
                <GoodsBidInfoItem label="Supplier organization" value={bidderLabel} />
                <GoodsBidInfoItem label="Submission status" value={statusText} />
                {receipt?.createdAt ? <GoodsBidInfoItem label="Submission date/time" value={formatDate(receipt.createdAt)} /> : null}
                <GoodsBidInfoItem label="Grand total bid price" value={formatMoney(totalAmount, currency)} />
                <GoodsBidInfoItem label="Goods lines offered" value={String(financialRows.length)} />
                <GoodsBidInfoItem label="Eligibility requirements answered" value={goodsCompletedEligibilityCount(eligibilityGroups)} />
                <GoodsBidInfoItem label="Technical specifications responded to" value={String(goodsTechnicalResponseCount(technicalGroups))} />
                <GoodsBidInfoItem label="Sample response summary" value={sampleRows.length ? `${sampleRows.length} sample response${sampleRows.length === 1 ? '' : 's'}` : 'Not required'} />
                <GoodsBidInfoItem label="Tender/amendment version acknowledged" value={tenderVersion} />
              </div>
            </GoodsBidDocSection>

            <GoodsBidDocSection number="02" title="Bidder Information">
              <div className="goods-bid-doc-info-grid">
                {bidInfoRows.map((row) => <GoodsBidInfoItem key={row.label} label={row.label} value={row.value} />)}
              </div>
            </GoodsBidDocSection>

            <GoodsBidDocSection number="03" title="Eligibility and Documentary Requirements Response Schedule">
              {eligibilityGroups.length ? eligibilityGroups.map((group) => (
                <div className="goods-bid-doc-subsection" key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="goods-bid-doc-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Requirement</th>
                          <th>Buyer Requirement / Threshold</th>
                          <th>Supplier Response</th>
                          <th>Evidence</th>
                          <th>Response Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr className={row.complete ? '' : 'is-incomplete'} key={row.id}>
                            <td>{row.requirement}</td>
                            <td>{row.buyerRequirement}</td>
                            <td>{row.supplierResponse}</td>
                            <td>{row.evidence}</td>
                            <td>{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )) : <p className="goods-bid-doc-empty">No additional tender-specific eligibility responses are required.</p>}
            </GoodsBidDocSection>

            <GoodsBidDocSection number="04" title="Technical Offer and Specification Compliance Schedule">
              {technicalGroups.length ? technicalGroups.map((group) => (
                <div className="goods-bid-doc-subsection goods-bid-doc-item-group" key={group.id}>
                  <h3>{`${group.itemNo}. ${group.itemName}`}</h3>
                  <p>{group.quantityLabel}</p>
                  <div className="goods-bid-doc-table goods-bid-doc-technical-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Specification</th>
                          <th>Required Value</th>
                          <th>Offered Value</th>
                          <th>Compliance</th>
                          <th>Deviation / Clarification</th>
                          <th>Evidence Ref.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr className={goodsTechnicalRowClass(row)} key={row.id}>
                            <td>{row.specification}</td>
                            <td>{row.requiredValue}</td>
                            <td>{row.offeredValue}</td>
                            <td>{row.compliance}</td>
                            <td>{row.deviation}</td>
                            <td>{row.evidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )) : <p className="goods-bid-doc-empty">No technical response information has been provided.</p>}
            </GoodsBidDocSection>

            <GoodsBidDocSection number="05" title="Quantity Schedule and Financial Offer">
              <div className="goods-bid-doc-table goods-bid-doc-financial-table">
                <table>
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Description of Goods</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Unit Price</th>
                      {hasDiscountColumn ? <th>Discount</th> : null}
                      {hasTaxColumn ? <th>Tax</th> : null}
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRows.length ? financialRows.map((row) => (
                      <tr className={row.complete ? '' : 'is-incomplete'} key={row.id}>
                        <td>{row.line}</td>
                        <td>{row.description}</td>
                        <td>{row.quantity}</td>
                        <td>{row.unit}</td>
                        <td className="is-money">{row.unitPrice}</td>
                        {hasDiscountColumn ? <td className="is-money">{row.discount}</td> : null}
                        {hasTaxColumn ? <td>{row.tax}</td> : null}
                        <td className="is-money">{row.lineTotal}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5 + (hasDiscountColumn ? 1 : 0) + (hasTaxColumn ? 1 : 0)}>No quantity schedule configured.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="goods-bid-doc-financial-summary">
                {financialSummary.map((row) => (
                  <div className={row.emphasis ? 'is-emphasis' : ''} key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </GoodsBidDocSection>

            {sampleRows.length ? (
              <GoodsBidDocSection number="06" title="Sample Submission Schedule">
                <div className="goods-bid-doc-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Required Quantity</th>
                        <th>Buyer Description / Condition</th>
                        <th>Delivery Location / Deadline</th>
                        <th>Supplier Submission Plan / Status</th>
                        <th>Tracking / Evidence Ref.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.item}</td>
                          <td>{row.requiredQuantity}</td>
                          <td>{row.condition}</td>
                          <td>{row.delivery}</td>
                          <td>{row.supplierPlan}</td>
                          <td>{row.tracking}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GoodsBidDocSection>
            ) : null}

            <GoodsBidDocSection number={sampleRows.length ? '07' : '06'} title="Attachments and Evidence Register">
              <div className="goods-bid-doc-table">
                <table>
                  <thead>
                    <tr>
                      <th>Ref.</th>
                      <th>Document Title</th>
                      <th>Category</th>
                      <th>Related Requirement / Item</th>
                      <th>Filename</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachmentRegister.length ? attachmentRegister.map((row) => (
                      <tr key={row.id}>
                        <td>{row.ref}</td>
                        <td>{row.title}</td>
                        <td>{row.category}</td>
                        <td>{row.related}</td>
                        <td>{row.filename}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5}>No supporting attachments have been uploaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GoodsBidDocSection>

            {deviationRows.length ? (
              <GoodsBidDocSection number={sampleRows.length ? '08' : '07'} title="Deviations, Exceptions, and Clarifications">
                <div className="goods-bid-doc-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Ref.</th>
                        <th>Requirement</th>
                        <th>Supplier Position</th>
                        <th>Explanation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviationRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.ref}</td>
                          <td>{row.requirement}</td>
                          <td>{row.supplierPosition}</td>
                          <td>{row.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GoodsBidDocSection>
            ) : null}

            {receipt ? (
              <>
                <GoodsBidDocSection number={sampleRows.length ? (deviationRows.length ? '09' : '08') : (deviationRows.length ? '08' : '07')} title="Supplier Declaration and Authorized Submission">
                  <div className="goods-bid-doc-info-grid">
                    <GoodsBidInfoItem label="Declaration status" value="Accepted at final submission" />
                    <GoodsBidInfoItem label="Authorized submitter" value={bidderLabel} />
                    <GoodsBidInfoItem label="Supplier organization" value={bidderLabel} />
                    <GoodsBidInfoItem label="Submission timestamp" value={formatDate(receipt.createdAt)} />
                  </div>
                </GoodsBidDocSection>
                <GoodsBidDocSection number={sampleRows.length ? (deviationRows.length ? '10' : '09') : (deviationRows.length ? '09' : '08')} title="Electronic Submission Record / Receipt">
                  <div className="goods-bid-doc-info-grid">
                    <GoodsBidInfoItem label="Bid Receipt Number" value={receipt.receiptHash || receipt.receiptRef} />
                    <GoodsBidInfoItem label="Bid Reference" value={receipt.bid.reference || bidReference} />
                    <GoodsBidInfoItem label="Tender Number" value={receipt.bid.tenderReference || tender.reference || schema.tenderReference} />
                    <GoodsBidInfoItem label="Supplier" value={receipt.bid.supplierName || bidderLabel} />
                    <GoodsBidInfoItem label="Submission Version" value={versionLabel} />
                    <GoodsBidInfoItem label="Received At" value={formatDate(receipt.createdAt)} />
                    <GoodsBidInfoItem label="Tender Version" value={tenderVersion} />
                    <GoodsBidInfoItem label="Status" value="Successfully Submitted" />
                  </div>
                </GoodsBidDocSection>
              </>
            ) : null}

            <footer className="goods-bid-doc-footer">
              <span>{statusText}</span>
              <strong>Generated by ProcureX</strong>
              <span>Page <span className="goods-page-current" /> of <span className="goods-page-total" /></span>
            </footer>
          </article>
        </div>
      </section>
    </>
  );
}

function GoodsBidDocSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="goods-bid-doc-section">
      <div className="goods-bid-doc-section-heading">
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      <div className="goods-bid-doc-section-body">{children}</div>
    </section>
  );
}

function GoodsBidInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'Not provided'}</strong>
    </div>
  );
}

function isGoodsBidReview(schema: BidSubmissionSchemaDto, tender: TenderDetail) {
  return isGoodsTender(tender) || /goods/i.test(schema.tenderType);
}

function goodsTenderOrganizationName(tender: TenderDetail) {
  const extended = tender as TenderDetail & { buyerName?: string; procuringOrganization?: string };
  const metadata = objectPayload(tender.metadata);
  return goodsText(extended.procuringOrganization)
    || goodsText(extended.buyerName)
    || goodsText(tender.organization)
    || goodsText(metadata.procuringOrganization)
    || goodsText(metadata.buyerName)
    || 'Procuring organization';
}

function goodsTenderProcurementMethod(tender: TenderDetail) {
  const method = goodsText(tender.method);
  if (method) return humanize(method);
  return /invited|private/i.test(String(tender.visibility ?? '')) ? 'Invited' : 'Open';
}

function goodsTenderVersionLabel(tender: TenderDetail) {
  const metadata = objectPayload(tender.metadata);
  return goodsText(metadata.tenderVersion ?? metadata.version ?? metadata.amendmentVersion ?? metadata.publishedTenderVersion)
    || 'Published tender version';
}

function goodsBidSubmissionVersion(receipt?: BidReceiptDto) {
  const payload = objectPayload(receipt?.bid.payload);
  return goodsText(payload.submissionVersion ?? payload.responseVersion ?? payload.version) || 'v1';
}

function goodsDraftResponseVersion(bid: BidDto | null) {
  const payload = objectPayload(bid?.payload);
  return goodsText(payload.responseVersion ?? payload.submissionVersion ?? payload.version) || 'v1';
}

function goodsBidReference(responses: SchemaResponseState, tender: TenderDetail) {
  return String(responses['bidInformation.referenceNumber'] ?? '').trim() || generatedBidReference(tender, bidderNameFromResponses(responses));
}

function goodsDateLabel(value: string | null | undefined) {
  return value ? formatDate(value) : 'Not provided';
}

function goodsBidInformationRows(responses: SchemaResponseState): GoodsBidSummaryField[] {
  return [
    { label: 'Supplier legal/display name', value: bidderNameFromResponses(responses) },
    { label: 'Contact person', value: String(responses['bidInformation.contactName'] ?? '').trim() || 'Not provided' },
    { label: 'Contact email', value: String(responses['bidInformation.contactEmail'] ?? '').trim() || 'Not provided' },
    { label: 'Contact phone', value: String(responses['bidInformation.contactPhone'] ?? '').trim() || 'Not provided' },
    { label: 'Bid reference number', value: String(responses['bidInformation.referenceNumber'] ?? '').trim() || 'Not provided' }
  ];
}

function goodsCompletedEligibilityCount(groups: GoodsBidEligibilityGroup[]) {
  const rows = groups.flatMap((group) => group.rows);
  if (!rows.length) return '0';
  const complete = rows.filter((row) => row.complete).length;
  return `${complete}/${rows.length}`;
}

function goodsTechnicalResponseCount(groups: GoodsBidTechnicalGroup[]) {
  return groups.reduce((sum, group) => sum + group.rows.length, 0);
}

function goodsBidEligibilityGroups(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], attachmentRegister: GoodsBidAttachmentRow[]): GoodsBidEligibilityGroup[] {
  const administrativeStep = schemaStep(schema, 'administrative');
  if (!administrativeStep) return [];
  const groups = administrativeGateGroups(administrativeStep);
  return [
    goodsBidEligibilityGroup('Financial Capacity', groups.financialFields, responses, documents, samples, attachmentRegister),
    goodsBidEligibilityGroup('Regulatory Licences', groups.licenseFields, responses, documents, samples, attachmentRegister),
    goodsBidEligibilityGroup('Other Eligibility Requirements', groups.otherDocumentFields, responses, documents, samples, attachmentRegister)
  ].filter((group): group is GoodsBidEligibilityGroup => Boolean(group && group.rows.length));
}

function goodsBidEligibilityGroup(title: string, fields: BidSubmissionSchemaFieldDto[], responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], attachmentRegister: GoodsBidAttachmentRow[]): GoodsBidEligibilityGroup | null {
  const rows = fields.map((field) => goodsBidEligibilityRow(field, responses, documents, samples, attachmentRegister));
  return rows.length ? { title, rows } : null;
}

function goodsBidEligibilityRow(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], attachmentRegister: GoodsBidAttachmentRow[]): GoodsBidEligibilityRow {
  const value = structuredValue(schemaFieldValue(field, responses));
  const complete = schemaFieldComplete(field, responses, documents, samples);
  const evidence = goodsEvidenceReferenceText(field, documents, attachmentRegister);
  const supplierResponse = isGoodsFinancialRequirementField(field)
    ? [
        goodsText(value.responseValue) ? `Declared value: ${goodsText(value.responseValue)}` : '',
        goodsText(value.notes) ? `Comment: ${goodsText(value.notes)}` : ''
      ].filter(Boolean).join(' / ') || 'Awaiting response'
    : isGoodsRegulatoryLicenseField(field)
    ? [
        goodsText(value.status) ? `Possession: ${goodsText(value.status)}` : 'Possession not provided',
        goodsText(value.licenseNumber) ? `Licence No: ${goodsText(value.licenseNumber)}` : '',
        goodsText(value.issueDate) ? `Issued: ${goodsText(value.issueDate)}` : '',
        goodsText(value.expiryDate) ? `Validity: ${goodsText(value.expiryDate)}` : ''
      ].filter(Boolean).join(' / ')
    : isGoodsOtherEligibilityField(field)
    ? [
        goodsText(value.confirmationStatus) ? `Confirmation: ${goodsText(value.confirmationStatus)}` : '',
        goodsText(value.comment) ? `Comment: ${goodsText(value.comment)}` : ''
      ].filter(Boolean).join(' / ') || 'Awaiting response'
    : evidence === 'Not attached' ? 'Awaiting evidence upload' : 'Evidence uploaded';
  return {
    id: field.id,
    requirement: field.label,
    buyerRequirement: goodsEligibilityRequirementText(field),
    supplierResponse,
    evidence,
    status: complete ? 'Complete' : field.required ? 'Pending required response' : 'Optional response pending',
    sourceId: field.id,
    complete
  };
}

function goodsEligibilityRequirementText(field: BidSubmissionSchemaFieldDto) {
  const parts = [
    goodsText(field.validation.minimumValue) ? `Minimum value: ${goodsText(field.validation.minimumValue)}` : '',
    goodsText(field.validation.period) ? `Period: ${goodsText(field.validation.period)}` : '',
    goodsText(field.validation.evidenceRequired) ? `Evidence required: ${goodsText(field.validation.evidenceRequired)}` : '',
    goodsText(field.validation.issuingAuthority) ? `Issuing body: ${goodsText(field.validation.issuingAuthority)}` : '',
    goodsCleanRequirementText(field.validation.prompt)
  ].filter(Boolean);
  return parts.join(' / ') || schemaRequirementText(field);
}

function goodsBidTechnicalGroups(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], attachmentRegister: GoodsBidAttachmentRow[]): GoodsBidTechnicalGroup[] {
  const fields = schema.steps
    .filter((step) => isGoodsTechnicalStep(step) || step.fields.some((field) => field.section === 'technical' && field.envelope === 'TECHNICAL'))
    .flatMap((step) => step.fields.filter((field) => field.section === 'technical' && isGoodsProductSpecificationField(field)));
  const groups = new Map<string, GoodsBidTechnicalGroup>();

  fields.forEach((field, index) => {
    const details = goodsProductSpecificationDetails(field, index);
    const group = goodsBidTechnicalGroup(groups, details.itemNo, details.requestedProduct, details.quantityLabel);
    const value = structuredValue(schemaFieldValue(field, responses));
    group.rows.push({
      id: field.id,
      specification: goodsText(field.validation.specificationName) || field.label.replace(/^Product specification response\s*-\s*/i, '').trim() || 'Product specification',
      requiredValue: details.buyerSpecification,
      offeredValue: goodsStructuredText(value, 'offeredSpecification', 'supplierResponse', 'responseValue') || 'Not provided',
      compliance: goodsStructuredText(value, 'complianceStatus', 'compliance') || 'Not declared',
      deviation: goodsStructuredText(value, 'deviations', 'deviation', 'comments') || 'None declared',
      evidence: goodsEvidenceOrStructuredReference(field, value, documents, attachmentRegister, goodsItemEvidenceSlot(field)),
      sourceId: field.id,
      complete: schemaFieldComplete(field, responses, documents, samples)
    });
  });

  return [...groups.values()].filter((group) => group.rows.length);
}

function goodsBidTechnicalGroup(groups: Map<string, GoodsBidTechnicalGroup>, itemNo: string, itemName: string, quantityLabel: string) {
  const id = safeSchemaKey(`${itemNo}-${itemName}`);
  const existing = groups.get(id);
  if (existing) return existing;
  const created = { id, itemNo, itemName, quantityLabel, rows: [] };
  groups.set(id, created);
  return created;
}

function goodsStructuredText(value: Record<string, unknown>, ...keys: string[]) {
  return keys.map((key) => goodsText(value[key])).find(Boolean) || '';
}

function goodsEvidenceOrStructuredReference(field: BidSubmissionSchemaFieldDto, value: Record<string, unknown>, documents: BidDocumentState[], attachmentRegister: GoodsBidAttachmentRow[], slot?: EvidenceUploadSlot) {
  const evidence = goodsEvidenceReferenceText(field, documents, attachmentRegister, slot);
  const typedReference = goodsStructuredText(value, 'evidenceReference', 'attachmentReference', 'evidence');
  return evidence === 'Not attached' && typedReference ? typedReference : evidence;
}

function goodsBidFinancialRows(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, currency: string, documents: BidDocumentState[], samples: BidSampleDto[]): GoodsBidFinancialRow[] {
  return schemaFinancialFields(schema).map((field, index) => {
    const row = schemaFinancialRow(field, responses, index);
    const value = goodsOfferValue(schemaFieldValue(field, responses));
    const complete = schemaFieldComplete(field, responses, documents, samples);
    return {
      id: field.id,
      line: row.itemNo,
      description: row.description,
      quantity: String(row.quantity),
      unit: row.unit,
      unitPrice: formatMoney(row.rate, currency),
      discount: goodsLineDiscountAllowed(field) ? (row.discount > 0 ? formatMoney(row.discount, currency) : goodsText(value.discount) || 'Not provided') : 'Not applicable',
      tax: goodsLineTaxAllowed(field) ? goodsText(value.taxIncluded) || 'Not provided' : 'Not applicable',
      lineTotal: formatMoney(row.total ?? 0, currency),
      sourceId: field.id,
      complete
    };
  });
}

function goodsBidFinancialSummary(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, currency: string, totalAmount: number): GoodsBidSummaryField[] {
  const rows = schemaFinancialFields(schema).map((field, index) => schemaFinancialRow(field, responses, index));
  const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.rate, 0);
  const discountTotal = rows.reduce((sum, row) => sum + row.discount, 0);
  const grandTotal = totalAmount || rows.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const summary: GoodsBidSummaryField[] = [
    { label: 'Subtotal before discounts/tax', value: formatMoney(subtotal, currency) }
  ];
  if (discountTotal > 0) summary.push({ label: 'Discount total', value: formatMoney(discountTotal, currency) });
  summary.push({ label: 'Grand Total Bid Price', value: formatMoney(grandTotal, currency), emphasis: true });
  return summary;
}

function goodsBidSampleRows(schema: BidSubmissionSchemaDto, tender: TenderDetail, samples: BidSampleDto[]): GoodsBidSampleRow[] {
  const requirements = schemaSampleRequirements(schema, tender);
  if (!requirements.length && !samples.length) return [];
  const requirementRows = requirements.map((requirement, index) => {
    const sample = samples.find((item) => item.relatedItem === requirement.relatedItem || item.sampleName === requirement.sampleName);
    return {
      id: requirement.id,
      item: requirement.relatedItem || requirement.sampleName || `Sample ${index + 1}`,
      requiredQuantity: String(requirement.quantity),
      condition: requirement.sampleName || 'Buyer sample requirement',
      delivery: [requirement.deliveryLocation, requirement.deliveryDeadline ? goodsDateLabel(requirement.deliveryDeadline) : ''].filter(Boolean).join(' / ') || 'Not provided',
      supplierPlan: sample ? sampleStatusLabel(sample.trackingStatus) : 'No supplier sample response recorded',
      tracking: sample ? [sample.courier, sample.trackingNumber].filter(Boolean).join(' / ') || 'No tracking reference provided' : 'Not provided'
    };
  });
  const unmatchedSamples = samples
    .filter((sample) => !requirements.some((requirement) => requirement.relatedItem === sample.relatedItem || requirement.sampleName === sample.sampleName))
    .map((sample) => ({
      id: sample.id,
      item: sample.relatedItem || sample.sampleName || 'Sample',
      requiredQuantity: sample.quantity ? String(sample.quantity) : 'Not specified',
      condition: sample.sampleName || 'Supplier sample record',
      delivery: [sample.deliveryLocation, sample.deliveryDeadline ? goodsDateLabel(sample.deliveryDeadline) : ''].filter(Boolean).join(' / ') || 'Not provided',
      supplierPlan: sampleStatusLabel(sample.trackingStatus),
      tracking: [sample.courier, sample.trackingNumber].filter(Boolean).join(' / ') || 'No tracking reference provided'
    }));
  return [...requirementRows, ...unmatchedSamples];
}

function goodsBidAttachmentRegister(schema: BidSubmissionSchemaDto, documents: BidDocumentState[]): GoodsBidAttachmentRow[] {
  return documents.map((document, index) => {
    const relatedField = bidDocumentRelatedField(schema, document);
    const metadata = objectPayload(document.metadata);
    return {
      id: document.id || document.documentId || `attachment-${index + 1}`,
      ref: `ATT-${String(index + 1).padStart(3, '0')}`,
      title: goodsText(metadata.requirementLabel) || relatedField?.label || document.documentType || 'Bid attachment',
      category: bidDocumentCategory(document, relatedField),
      related: relatedField?.label || goodsText(metadata.requirementKey) || goodsText(metadata.parentRequirementKey) || document.documentType || 'Bid document',
      filename: document.name
    };
  });
}

function bidDocumentRelatedField(schema: BidSubmissionSchemaDto, document: BidDocumentState) {
  const metadata = objectPayload(document.metadata);
  const candidates = [
    goodsText(metadata.fieldId),
    goodsText(metadata.requirementKey),
    goodsText(metadata.parentRequirementKey),
    document.documentType
  ].filter(Boolean);
  return actionableSchemaFields(schema).find((field) => candidates.some((candidate) => candidate === field.id || candidate === field.requirementKey || candidate === goodsText(field.validation.documentType)));
}

function bidDocumentCategory(document: BidDocumentState, field?: BidSubmissionSchemaFieldDto) {
  if (field?.section === 'administrative') return 'Eligibility';
  if (field?.section === 'technical') return 'Technical';
  if (field?.section === 'samples') return 'Sample';
  if (field?.section === 'financial') return 'Financial';
  if (document.envelope === 'ADMINISTRATIVE') return 'Eligibility';
  if (document.envelope === 'TECHNICAL') return 'Technical';
  if (document.envelope === 'FINANCIAL') return 'Financial';
  return 'Other';
}

function goodsEvidenceReferenceText(field: BidSubmissionSchemaFieldDto, documents: BidDocumentState[], attachmentRegister: GoodsBidAttachmentRow[], slot?: EvidenceUploadSlot) {
  const relatedDocuments = slot ? documentsForEvidenceSlot(documents, field, slot) : documentsForSchemaField(documents, field);
  if (!relatedDocuments.length) return 'Not attached';
  const refs = relatedDocuments
    .map((document) => attachmentRegister.find((row) => row.id === (document.id || document.documentId))?.ref)
    .filter(Boolean);
  return refs.length ? refs.join(', ') : documentNames(relatedDocuments);
}

function goodsBidDeviationRows(groups: GoodsBidTechnicalGroup[]): GoodsBidDeviationRow[] {
  return groups.flatMap((group) => group.rows
    .filter((row) => /partial|not compliant|do not|exception|deviation/i.test(`${row.compliance} ${row.deviation}`) && !/^none declared$/i.test(row.deviation))
    .map((row, index) => ({
      id: `${group.id}-${row.id}-deviation`,
      ref: `${group.itemNo}.${index + 1}`,
      requirement: row.specification,
      supplierPosition: row.compliance,
      explanation: row.deviation
    })));
}

function goodsTechnicalRowClass(row: GoodsBidTechnicalRow) {
  if (!row.complete) return 'is-incomplete';
  return /partial|not compliant|do not/i.test(`${row.compliance} ${row.deviation}`) ? 'is-deviation' : '';
}

function bidderNameFromResponses(responses: SchemaResponseState) {
  return String(responses['bidInformation.bidderName'] ?? '').trim() || 'Supplier organization';
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

function reviewCompletenessChecklist(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], currency: string): ReviewChecklistItem[] {
  const eligibilityRows = schemaSectionRows(schema, responses, documents, samples, currency, 'administrative');
  const technicalRows = schema.steps
    .filter((step) => /technical|capacity|methodology|staffing|sla/i.test(step.id) || step.fields.some((field) => field.envelope === 'TECHNICAL'))
    .flatMap((step) => schemaSectionRows(schema, responses, documents, samples, currency, step.id));
  const financialRows = schema.steps
    .filter((step) => /financial|commercial/i.test(step.id) || step.fields.some((field) => field.envelope === 'FINANCIAL'))
    .flatMap((step) => schemaSectionRows(schema, responses, documents, samples, currency, step.id));
  const requiredRows = reviewDocumentSections(schema, responses, documents, samples, currency).flatMap((section) => section.rows.filter((row) => row.mandatory));
  const samplesRows = schemaSectionRows(schema, responses, documents, samples, currency, 'samples');
  const declarationsRows = schema.steps
    .filter((step) => isDeclarationStep(step))
    .flatMap((step) => schemaSectionRows(schema, responses, documents, samples, currency, step.id));
  return [
    reviewChecklistItem('Eligibility documents', eligibilityRows, 'gate items reviewed'),
    reviewChecklistItem('Technical response', technicalRows, 'technical responses checked'),
    reviewChecklistItem('Financial offer', financialRows, 'pricing items reviewed'),
    reviewChecklistItem('Required supporting evidence', requiredRows.filter((row) => row.upload), 'evidence areas checked'),
    reviewChecklistItem('Financial capacity', financialRows.filter((row) => /capacity|statement|bank|financial/i.test(`${row.label} ${row.requirement}`)), 'capacity matrix completed'),
    reviewChecklistItem('Award-stage terms', declarationsRows, 'contract clauses configured'),
    reviewChecklistItem('Samples / site / category extras', samplesRows, 'extra visit and drawing response checked')
  ];
}

function reviewChecklistItem(label: string, rows: ReviewDocumentRow[], suffix: string): ReviewChecklistItem {
  const complete = rows.filter((row) => row.complete).length;
  const total = rows.length;
  return {
    label,
    value: total ? `${complete}/${total}` : 'Not required',
    note: total ? suffix : 'No configured items'
  };
}

function technicalReviewResponseCount(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], currency: string) {
  return schema.steps
    .filter((step) => /technical|capacity|methodology|staffing|sla/i.test(step.id) || step.fields.some((field) => field.envelope === 'TECHNICAL'))
    .flatMap((step) => schemaSectionRows(schema, responses, documents, samples, currency, step.id)).length;
}

function reviewConfirmationField(schema: BidSubmissionSchemaDto) {
  const reviewFields = schema.steps.filter((step) => isReviewStep(step)).flatMap((step) => step.fields);
  return reviewFields.find((field) => /confirm|complete|checklist|reviewed/i.test(`${field.id} ${field.requirementKey} ${field.label}`))
    ?? reviewFields.find((field) => field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'acknowledgement');
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
    const missingEvidence = missingEvidenceUploadSlots(field, documents);
    const evidenceSummary = evidenceUploadSummary(field, documents);
    const responseSummary = structuredResponseSummary(value) || 'Missing structured response';
    const displayValue = [responseSummary, missingEvidence.length ? `Missing evidence: ${missingEvidence.map((slot) => slot.label).join(', ')}` : evidenceSummary].filter(Boolean).join(' / ');
    return reviewRow(field.id, field.label, schemaRequirementText(field), displayValue, field.required, complete, field.id, field.required && missingEvidence.length > 0);
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

async function downloadBidResponseDocument(tender: TenderDetail, trigger: HTMLElement) {
  const documentNode = getExportableBidResponseDocumentNode(trigger);
  if (!documentNode) return;
  if (documentNode.classList.contains('goods-bid-official-document')) {
    await downloadBidResponsePdf(tender, documentNode);
    return;
  }
  const blob = new Blob([buildBidResponseDocumentExportHtml(tender, documentNode.outerHTML)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(`${tender.reference || tender.title || 'bid-submission-review'}-review`)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printBidResponseDocument(tender: TenderDetail, trigger: HTMLElement) {
  const documentNode = getExportableBidResponseDocumentNode(trigger);
  if (!documentNode) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildBidResponseDocumentExportHtml(tender, documentNode.outerHTML));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function getExportableBidResponseDocumentNode(trigger: HTMLElement) {
  const review = trigger.closest('[data-bid-response-review]');
  const documentNode = review?.querySelector('.bid-response-document');
  if (!documentNode) return null;
  const clone = documentNode.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.bid-status-chip.editable, .bid-review-edit-button').forEach((node) => node.remove());
  return clone;
}

async function downloadBidResponsePdf(tender: TenderDetail, documentNode: HTMLElement) {
  const container = document.createElement('div');
  container.className = 'procurex-pdf-render-root bid-response-pdf-render-root';
  container.appendChild(documentNode);
  document.body.appendChild(container);

  try {
    const filename = goodsBidPdfFilename(tender, documentNode);
    const bidPdfOptions = {
      margin: [16, 18, 16, 18] as [number, number, number, number],
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy', 'avoid-all'] }
    };
    const result = await html2pdf()
      .set({ ...bidPdfOptions, filename })
      .from(documentNode)
      .outputPdf('blob');
    downloadBidBlob(normalizeBidPdfBlob(result), filename);
  } catch {
    const fallbackHtml = buildBidResponseDocumentExportHtml(tender, documentNode.outerHTML);
    const blob = new Blob([fallbackHtml], { type: 'text/html;charset=utf-8' });
    downloadBidBlob(blob, goodsBidHtmlFallbackFilename(tender, documentNode));
  } finally {
    container.remove();
  }
}

function goodsBidPdfFilename(tender: TenderDetail, documentNode: HTMLElement) {
  const bidReference = safeFileName(documentNode.dataset.bidReference || 'bid');
  const tenderReference = safeFileName(documentNode.dataset.tenderReference || tender.reference || tender.title || 'tender');
  const version = safeFileName(documentNode.dataset.bidDocumentVersion || 'v1');
  const versionLabel = /^v/i.test(version) ? version : `v${version}`;
  return documentNode.dataset.bidDocumentStatus === 'SUBMITTED'
    ? `Bid_${bidReference}_${tenderReference}_Submitted_${versionLabel}.pdf`
    : `Bid_${bidReference}_${tenderReference}_DRAFT.pdf`;
}

function goodsBidHtmlFallbackFilename(tender: TenderDetail, documentNode: HTMLElement) {
  return goodsBidPdfFilename(tender, documentNode).replace(/\.pdf$/i, '.html');
}

function normalizeBidPdfBlob(value: unknown) {
  if (value instanceof Blob) return value.type === 'application/pdf' ? value : new Blob([value], { type: 'application/pdf' });
  if (value instanceof ArrayBuffer) return new Blob([value], { type: 'application/pdf' });
  if (typeof value === 'string') return new Blob([value], { type: 'application/pdf' });
  return new Blob([JSON.stringify(value ?? '')], { type: 'application/pdf' });
}

function downloadBidBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildBidResponseDocumentExportHtml(tender: TenderDetail, documentHtml: string) {
  const title = `${tender.title || 'Bid Submission Review'} - ${tender.reference || 'review'}`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeBidDocumentHtml(title)}</title>
<style>
body { margin: 0; padding: 32px; background: #eef2f7; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
.bid-response-document { max-width: 980px; margin: 0 auto; padding: 46px 52px 34px; border: 1px solid #cbd5e1; background: #fff; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14); }
.bid-response-document-masthead { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 2px solid #071a33; }
.bid-response-document-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 4px; background: #071a33; color: #fff; font-weight: 900; }
.bid-response-document-masthead span, .section-kicker, .bid-response-document-meta span { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.bid-response-document-masthead strong { display: block; color: #071a33; font-size: 18px; }
.bid-response-document-masthead em { justify-self: end; color: #475569; font-size: 11px; font-style: normal; font-weight: 800; text-transform: uppercase; }
.bid-response-document-cover { display: flex; justify-content: space-between; gap: 22px; padding: 24px 0 20px; border-bottom: 1px solid #cbd5e1; }
.bid-response-document-cover h3 { margin: 0; color: #071a33; font-size: 28px; line-height: 1.16; }
.bid-response-document-cover p { margin: 8px 0 0; color: #475569; line-height: 1.5; }
.bid-response-document-status { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.bid-status-chip { display: inline-flex; min-height: 24px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
.bid-status-chip.review { background: #dbeafe; color: #1e40af; }
.bid-status-chip.submitted { background: #dcfce7; color: #166534; }
.bid-status-chip.offer { background: #e0f2fe; color: #075985; }
.bid-response-document-meta { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #cbd5e1; margin: 24px 0; }
.bid-response-document-meta article { padding: 15px 16px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
.bid-response-document-meta strong { display: block; margin-top: 6px; color: #071a33; font-size: 16px; }
.bid-response-document-meta em { display: block; margin-top: 4px; color: #94a3b8; font-size: 12px; font-style: normal; }
.bid-completeness-summary { display: grid; gap: 10px; padding: 14px; border: 1px solid #bbf7d0; background: #f0fdf4; margin-bottom: 22px; }
.bid-completeness-summary strong { display: block; margin-top: 4px; color: #0d7c3d; font-size: 28px; line-height: 1; }
.bid-completeness-summary p { margin: 6px 0 0; color: #334155; font-size: 13px; }
.bid-completeness-meter { overflow: hidden; height: 8px; border-radius: 999px; background: #dcfce7; }
.bid-completeness-meter span { display: block; height: 100%; border-radius: inherit; background: #0d7c3d; }
.bid-response-document-sections { display: grid; gap: 22px; }
.bid-response-document-section-heading { display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
.bid-response-document-section-heading > span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 4px; background: #071a33; color: #fff; font-size: 12px; font-weight: 900; }
.bid-response-document-section-heading h4 { margin: 0; color: #071a33; font-size: 17px; }
.bid-response-document-section-heading small { color: #64748b; font-size: 12px; }
.bid-response-document-table { overflow-x: auto; margin-top: 14px; border: 1px solid #e2e8f0; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 13px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; font-size: 14px; line-height: 1.4; }
th { background: #f1f5f9; color: #334155; font-size: 12px; font-weight: 800; text-transform: uppercase; }
td strong { display: block; color: #0f172a; }
td small { display: block; margin-top: 4px; color: #64748b; font-size: 12px; line-height: 1.35; }
.bid-requirement-marker { display: inline-flex; min-height: 22px; margin: 0 5px 5px 0; padding: 4px 7px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.required-complete { background: #e8f5e9; color: #0d7c3d; }
.required-incomplete { background: #fff1f1; color: #b00020; }
.optional-complete { background: #e0f2fe; color: #075985; }
.optional-empty { background: #f1f5f9; color: #64748b; }
.is-incomplete td { background: #fffafa; }
.bid-review-readonly { display: inline-flex; align-items: center; min-height: 28px; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.bid-response-document-footer { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 14px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
${goodsOfficialBidDocumentExportCss()}
@page { size: A4 portrait; margin: 16mm 18mm; }
@media print { body { padding: 0; background: #fff; } .bid-response-document { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; border: 0; } table, tr, .bid-response-document-section { break-inside: avoid; page-break-inside: avoid; } }
</style>
</head>
<body>${documentHtml}</body>
</html>`;
}

function goodsOfficialBidDocumentExportCss() {
  return `
.goods-bid-official-document { display: block; box-sizing: border-box; width: 210mm; max-width: 100%; min-height: 297mm; margin: 0 auto; padding: 16mm 18mm; border: 1px solid #d9e0e8; border-radius: 0; background: #fff; box-shadow: none; color: #252a31; font-family: Inter, Aptos, "Segoe UI", Arial, sans-serif; }
.goods-bid-official-document::before { display: none; }
.goods-bid-doc-front { display: grid; grid-template-columns: minmax(0, 1fr) 42mm; gap: 9mm; padding-bottom: 7mm; border-bottom: 1px solid #c7d0db; }
.goods-bid-doc-org { display: flex; align-items: center; gap: 5mm; grid-column: 1 / -1; }
.goods-bid-doc-org img { width: auto; max-width: 24mm; max-height: 24mm; object-fit: contain; }
.goods-bid-doc-org strong { display: block; color: #374151; font-size: 10.5pt; font-weight: 600; line-height: 1.3; }
.goods-bid-doc-org span { display: block; margin-top: 1.5mm; color: #0f4c81; font-size: 8.5pt; font-weight: 700; line-height: 1.25; letter-spacing: .02em; }
.goods-bid-doc-title-block h1 { margin: 0 0 4mm; color: #1f2937; font-size: 22pt; font-weight: 700; line-height: 1.18; letter-spacing: 0; }
.goods-bid-doc-title-block p { margin: 1.5mm 0 0; color: #374151; font-size: 9.5pt; font-weight: 500; line-height: 1.45; }
.goods-bid-doc-status-block { align-self: start; display: grid; gap: 2mm; padding: 4mm; border: 1px solid #d9e0e8; background: #fafbfc; }
.goods-bid-doc-status-block span { color: #0f4c81; font-size: 8.5pt; font-weight: 700; line-height: 1.25; }
.goods-bid-doc-status-block strong { color: #252a31; font-size: 9.5pt; font-weight: 600; }
.goods-bid-doc-status-block small { color: #667085; font-size: 7.5pt; line-height: 1.25; }
.goods-bid-doc-summary-grid, .goods-bid-doc-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #d9e0e8; border-bottom: 0; }
.goods-bid-doc-summary-grid { margin-top: 7mm; }
.goods-bid-doc-summary-grid div, .goods-bid-doc-info-grid div { min-width: 0; padding: 2.8mm 3.2mm; border-right: 1px solid #d9e0e8; border-bottom: 1px solid #d9e0e8; background: #fff; }
.goods-bid-doc-summary-grid div:nth-child(2n), .goods-bid-doc-info-grid div:nth-child(2n) { border-right: 0; }
.goods-bid-doc-summary-grid div.is-emphasis, .goods-bid-doc-financial-summary div.is-emphasis { background: #eaf2f8; }
.goods-bid-doc-summary-grid span, .goods-bid-doc-info-grid span, .goods-bid-doc-financial-summary span { display: block; color: #5b6472; font-size: 8.5pt; font-weight: 600; line-height: 1.35; }
.goods-bid-doc-summary-grid strong, .goods-bid-doc-info-grid strong, .goods-bid-doc-financial-summary strong { display: block; margin-top: 1mm; color: #252a31; font-size: 9.5pt; font-weight: 500; line-height: 1.45; overflow-wrap: anywhere; }
.goods-bid-doc-section { margin-top: 11mm; break-inside: avoid; page-break-inside: avoid; }
.goods-bid-doc-section-heading { display: grid; grid-template-columns: 9mm minmax(0, 1fr); align-items: center; gap: 3.5mm; padding-bottom: 3mm; border-bottom: 1px solid #c7d0db; }
.goods-bid-doc-section-heading span { display: grid; place-items: center; width: 9mm; height: 9mm; background: #0f4c81; color: #fff; font-size: 8.5pt; font-weight: 700; line-height: 1; }
.goods-bid-doc-section-heading h2 { margin: 0; color: #0f4c81; font-size: 14pt; font-weight: 700; line-height: 1.25; letter-spacing: 0; }
.goods-bid-doc-section-body { margin-top: 5mm; color: #252a31; font-size: 9.5pt; line-height: 1.55; }
.goods-bid-doc-subsection { margin-top: 6mm; break-inside: avoid; page-break-inside: avoid; }
.goods-bid-doc-subsection:first-child { margin-top: 0; }
.goods-bid-doc-subsection h3 { margin: 0 0 3mm; color: #1f2937; font-size: 11pt; font-weight: 700; line-height: 1.3; }
.goods-bid-doc-subsection p { margin: 0 0 3mm; color: #5b6472; font-size: 9pt; line-height: 1.45; }
.goods-bid-doc-table { width: 100%; overflow: visible; border: 1px solid #d9e0e8; background: #fff; }
.goods-bid-doc-table table { width: 100%; min-width: 0; border-spacing: 0; border-collapse: collapse; table-layout: fixed; }
.goods-bid-doc-table thead { display: table-header-group; }
.goods-bid-doc-table th, .goods-bid-doc-table td { padding: 2.6mm 3mm; border-bottom: .75pt solid #d9e0e8; text-align: left; vertical-align: top; color: #252a31; font-size: 8.7pt; font-weight: 400; line-height: 1.4; overflow-wrap: anywhere; }
.goods-bid-doc-table th { min-height: 10.5mm; background: #f3f6fa; color: #273142; font-size: 8.3pt; font-weight: 700; }
.goods-bid-doc-table tbody tr:nth-child(even) td { background: #fafbfc; }
.goods-bid-doc-table tbody tr:last-child td { border-bottom: 0; }
.goods-bid-doc-table tr.is-incomplete td { background: #fffafa; }
.goods-bid-doc-table tr.is-deviation td { background: #fff8ed; }
.goods-bid-doc-table .is-money { text-align: right; }
.goods-bid-doc-financial-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 4mm; border: 1px solid #d9e0e8; border-bottom: 0; }
.goods-bid-doc-financial-summary div { padding: 2.8mm 3.2mm; border-right: 1px solid #d9e0e8; border-bottom: 1px solid #d9e0e8; }
.goods-bid-doc-financial-summary div:last-child { border-right: 0; }
.goods-bid-doc-empty { margin: 0; color: #667085; font-size: 9.5pt; font-style: italic; }
.goods-bid-doc-footer { display: flex; align-items: center; justify-content: space-between; gap: 5mm; margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #d9e0e8; color: #667085; font-size: 7.5pt; line-height: 1.2; }
.goods-bid-doc-footer strong { color: #667085; font-weight: 400; }
.goods-page-current::after { content: "1"; }
.goods-page-total::after { content: "1"; }
@media print { .goods-bid-official-document { width: auto !important; min-height: auto !important; padding: 0 !important; border: 0 !important; background: #fff !important; color: #252a31 !important; } .goods-bid-official-document * { box-shadow: none !important; } .goods-bid-doc-section-heading, .goods-bid-doc-subsection h3 { break-after: avoid; page-break-after: avoid; } .goods-bid-doc-section, .goods-bid-doc-subsection, .goods-bid-doc-table, .goods-bid-doc-financial-summary, .goods-bid-doc-table tr { break-inside: avoid; page-break-inside: avoid; } .goods-bid-doc-table thead { display: table-header-group; } .goods-page-current::after { content: counter(page); } .goods-page-total::after { content: counter(pages); } }
@media (max-width: 820px) { .goods-bid-official-document { width: 100%; min-height: auto; padding: 18px; } .goods-bid-doc-front, .goods-bid-doc-summary-grid, .goods-bid-doc-info-grid, .goods-bid-doc-financial-summary { grid-template-columns: 1fr; } .goods-bid-doc-summary-grid div, .goods-bid-doc-info-grid div, .goods-bid-doc-financial-summary div { border-right: 0; } }
`;
}

function escapeBidDocumentHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
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

function ReceiptPanel({
  tender,
  schema,
  responses,
  documents,
  samples,
  issues,
  totalAmount,
  currency,
  completeness,
  receipt,
  onWithdraw,
  canWithdraw
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
  receipt: BidReceiptDto;
  onWithdraw: () => void;
  canWithdraw: boolean;
}) {
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
      <ReviewPanel
        tender={tender}
        schema={schema}
        responses={responses}
        documents={documents}
        samples={samples}
        issues={issues}
        totalAmount={totalAmount || receipt.bid.totalAmount}
        currency={currency}
        completeness={completeness}
        isSubmitted
        receipt={receipt}
        onEditField={() => undefined}
        onPatch={() => undefined}
      />
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
    administrative: { eligible: false, taxCompliant: false, documentsConfirmed: false },
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

function withGoodsBidInformationStep(schema: BidSubmissionSchemaDto | null, workflow: WorkflowType, tender?: TenderDetail | null): BidSubmissionSchemaDto | null {
  if (!schema || workflow !== 'goods') return schema;

  const bidInformationStep: BidSubmissionSchemaStepDto = {
    id: 'goodsBidInformation',
    label: 'Bid Information',
    envelope: 'ADMINISTRATIVE',
    required: true,
    fields: goodsBidInformationFields()
  };
  const schemaWithBidInformation: BidSubmissionSchemaDto = schema.steps.some((step) => step.id === 'goodsBidInformation')
    ? schema
    : {
        ...schema,
        steps: [bidInformationStep, ...schema.steps]
      };

  return withGoodsEligibilityDocumentRequirements(schemaWithBidInformation, tender);
}

function goodsBidInformationFields(): BidSubmissionSchemaFieldDto[] {
  return [
    bidInformationField('bidInformation.bidderName', 'Name of bidder', true, { readOnly: true }),
    bidInformationField('bidInformation.contactName', 'Contact person name', true),
    bidInformationField('bidInformation.contactEmail', 'Contact person email', true, { inputType: 'email' }),
    bidInformationField('bidInformation.contactPhone', 'Contact person phone number', true, { inputType: 'tel' }),
    bidInformationField('bidInformation.referenceNumber', 'Bid reference number', true, { readOnly: true })
  ];
}

function bidInformationField(id: string, label: string, required: boolean, validation: Record<string, unknown> = {}): BidSubmissionSchemaFieldDto {
  return {
    id,
    requirementKey: id,
    label,
    type: 'text',
    section: 'administrative',
    required,
    responseType: 'text',
    envelope: 'ADMINISTRATIVE',
    source: 'bid-information',
    validation
  };
}

function withGoodsEligibilityDocumentRequirements(schema: BidSubmissionSchemaDto, tender?: TenderDetail | null): BidSubmissionSchemaDto {
  const existingFields = schema.steps.flatMap((step) => step.fields);
  const movedFinancialFields = existingFields.filter(isGoodsFinancialRequirementField).map(goodsFinancialEvidenceFieldFromSchema);
  const derivedFields = goodsEligibilityDocumentFieldsFromTender(tender);
  const generatedFields = uniqueGoodsEligibilityFields([...movedFinancialFields, ...derivedFields]);
  const hasRemovedConfirmationFields = existingFields.some(isRemovedGoodsAdministrativeConfirmationField) || existingFields.some(isGoodsEligibilityDeclarationField);

  if (!generatedFields.length && !movedFinancialFields.length && !hasRemovedConfirmationFields) return schema;

  const stepsWithoutFinancialCapacity = schema.steps.map((step) => {
    if (step.id === 'administrative') return step;
    return { ...step, fields: step.fields.filter((field) => !isGoodsFinancialRequirementField(field)) };
  });
  const administrativeIndex = stepsWithoutFinancialCapacity.findIndex((step) => step.id === 'administrative');
  const administrativeStep: BidSubmissionSchemaStepDto = administrativeIndex >= 0
    ? stepsWithoutFinancialCapacity[administrativeIndex]
    : { id: 'administrative', label: 'Eligibility and Document Requirements', envelope: 'ADMINISTRATIVE', required: true, fields: [] };
  const nextAdministrative = {
    ...administrativeStep,
    fields: uniqueGoodsEligibilityFields([
      ...administrativeStep.fields.filter((field) => !isGoodsFinancialRequirementField(field) && !isRemovedGoodsAdministrativeConfirmationField(field) && !isGoodsEligibilityDeclarationField(field)),
      ...generatedFields
    ])
  };
  const nextSteps = administrativeIndex >= 0
    ? stepsWithoutFinancialCapacity.map((step, index) => (index === administrativeIndex ? nextAdministrative : step))
    : [...stepsWithoutFinancialCapacity, nextAdministrative];

  return { ...schema, steps: nextSteps };
}

function goodsEligibilityDocumentFieldsFromTender(tender?: TenderDetail | null): BidSubmissionSchemaFieldDto[] {
  if (!isGoodsTender(tender)) return [];
  const requirements = objectPayload(tender?.requirements);
  const fields = objectPayload(objectPayload(requirements.goods).fields);
  const financialRows = firstRecordArray(requirements.financialRequirements, fields.financialRequirementRows, requirements.financialRequirementRows);
  const regulatoryRows = firstRecordArray(requirements.regulatoryLicenseRequirements, fields.regulatoryLicenseRequirementRows, requirements.regulatoryLicenseRequirementRows);
  const eligibilityRows = firstRecordArray(requirements.eligibilityRequirements, fields.eligibilityRequirementCards, requirements.eligibilityRequirementCards);

  return [
    ...financialRows.flatMap((row, index) => goodsFinancialEvidenceFieldFromTender(row, index)),
    ...regulatoryRows.map(goodsRegulatoryLicenseFieldFromTender),
    ...eligibilityRows.map(goodsOtherEligibilityFieldFromTender)
  ];
}

function goodsFinancialEvidenceFieldFromSchema(field: BidSubmissionSchemaFieldDto): BidSubmissionSchemaFieldDto {
  const evidenceRequired = goodsText(field.validation.evidenceRequired);
  return {
    ...field,
    section: 'administrative',
    envelope: 'ADMINISTRATIVE',
    label: field.label,
    source: 'requirements.goods.financialRequirementRows',
    validation: {
      ...field.validation,
      control: 'goodsFinancialRequirement',
      originalRequirementKey: field.requirementKey,
      documentType: bidDocumentType('ADMIN_FINANCIAL_CAPACITY', field.label),
      evidenceRequired: evidenceRequired || undefined,
      prompt: goodsCleanRequirementText(field.validation.prompt)
    }
  };
}

function goodsFinancialEvidenceFieldFromTender(row: Record<string, unknown>, index: number): BidSubmissionSchemaFieldDto[] {
  const evidenceRequired = goodsText(row.evidenceRequired ?? row.documentName ?? row.documentTitle ?? row.evidence);
  const id = goodsRequirementRowId(row, index, 'financial');
  const label = goodsText(row.requirementType ?? row.requirementName ?? row.name ?? row.title) || `Financial capacity requirement ${index + 1}`;
  return [
    {
      id: `goods.financialRequirement.${id}`,
      requirementKey: `goods.financialRequirement.${id}`,
      label,
      type: 'table',
      section: 'administrative',
      required: row.mandatory !== false && row.required !== false,
      responseType: 'structured',
      envelope: 'ADMINISTRATIVE',
      source: 'requirements.goods.financialRequirementRows',
      validation: {
        control: 'goodsFinancialRequirement',
        requirementName: label,
        documentType: bidDocumentType('ADMIN_FINANCIAL_CAPACITY', label),
        minimumValue: goodsText(row.minimumValue),
        period: goodsText(row.period),
        evidenceRequired,
        prompt: goodsCleanRequirementText(row.description ?? row.requirementDescription ?? row.notes),
        rowIndex: index + 1
      }
    }
  ];
}

function goodsRegulatoryLicenseFieldFromTender(row: Record<string, unknown>, index: number): BidSubmissionSchemaFieldDto {
  const id = goodsRequirementRowId(row, index, 'license');
  const label = goodsText(row.license ?? row.requirementName ?? row.name ?? row.title) || `Regulatory license ${index + 1}`;
  const issuingAuthority = goodsText(row.body ?? row.issuingAuthority ?? row.issuingBody ?? row.authority ?? row.board);
  return {
    id: `goods.regulatoryLicense.${id}`,
    requirementKey: `goods.regulatoryLicense.${id}`,
    label,
    type: 'table',
    section: 'administrative',
    required: row.mandatory !== false && row.required !== false,
    responseType: 'structured',
    envelope: 'ADMINISTRATIVE',
    source: 'requirements.goods.regulatoryLicenseRequirementRows',
    validation: {
      control: 'goodsRegulatoryLicense',
      licenseName: label,
      issuingAuthority,
      attachmentPolicy: row.mandatory !== false && row.required !== false ? 'REQUIRED' : 'OPTIONAL',
      prompt: goodsCleanRequirementText(row.evidenceRequired ?? row.description ?? row.notes) || issuingAuthority || 'Upload the license evidence required by the buyer.',
      rowIndex: index + 1
    }
  };
}

function goodsOtherEligibilityFieldFromTender(row: Record<string, unknown>, index: number): BidSubmissionSchemaFieldDto {
  const id = goodsRequirementRowId(row, index, 'eligibility');
  const label = goodsText(row.requirementName ?? row.documentName ?? row.documentTitle ?? row.name ?? row.title) || `Eligibility requirement ${index + 1}`;
  const notes = goodsCleanRequirementText(row.notes ?? row.description ?? row.requirementDescription);
  const evidenceRequired = row.requiresUpload === true || row.evidenceRequired === true;
  return {
    id: `goods.eligibilityRequirement.${id}`,
    requirementKey: `goods.eligibilityRequirement.${id}`,
    label,
    type: 'table',
    section: 'administrative',
    required: row.mandatory !== false && row.required !== false,
    responseType: 'structured',
    envelope: 'ADMINISTRATIVE',
    source: 'requirements.goods.eligibilityRequirements',
    validation: {
      control: 'goodsOtherEligibility',
      notes,
      documentType: bidDocumentType('ADMIN_ELIGIBILITY', label),
      attachmentPolicy: evidenceRequired ? 'REQUIRED' : 'OPTIONAL',
      evidenceRequired: evidenceRequired ? 'Eligibility evidence required by the buyer.' : undefined,
      prompt: notes
    }
  };
}

function isRemovedGoodsAdministrativeConfirmationField(field: BidSubmissionSchemaFieldDto) {
  const normalizedLabel = field.label.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalizedLabel === 'confirm eligibility to participate'
    || normalizedLabel === 'confirm tax and statutory compliance'
    || normalizedLabel === 'confirm mandatory documents are attached'
    || normalizedLabel === 'i confirm i am authorized to submit these documents on behalf of the bidder.';
}

function uniqueGoodsEligibilityFields(fields: BidSubmissionSchemaFieldDto[]) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = goodsEligibilityDedupeKey(field);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function goodsEligibilityDedupeKey(field: BidSubmissionSchemaFieldDto) {
  const control = String(field.validation.control ?? '');
  const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (isGoodsFinancialCapacityEvidenceField(field) || control === 'goodsFinancialRequirement') return `financial::${normalizedLabel}`;
  if (isGoodsRegulatoryLicenseField(field)) return `regulatory::${normalizedLabel}`;
  if (isGoodsOtherEligibilityField(field) || isGoodsOtherEligibilityEvidenceField(field) || /eligibilityRequirementCards|eligibilityRequirements/i.test(field.source)) return `eligibility::${normalizedLabel}`;
  return `${field.id}::${field.requirementKey}`;
}

function goodsRequirementRowId(row: Record<string, unknown>, index: number, fallbackPrefix: string) {
  return safeSchemaKey(goodsText(row.id ?? row.sourceItemId ?? row.requirementKey) || `${fallbackPrefix}-${index + 1}`);
}

function safeSchemaKey(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'item';
}

function bidDocumentType(prefix: string, label: string) {
  const suffix = label.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `${prefix}_${suffix || 'DOCUMENT'}`.slice(0, 120);
}

function firstRecordArray(...values: unknown[]) {
  const found = values.find((value) => Array.isArray(value) && value.some((item) => Object.keys(objectPayload(item)).length));
  return Array.isArray(found) ? found.map(objectPayload).filter((row) => Object.keys(row).length > 0) : [];
}

function isGoodsTender(tender?: TenderDetail | null) {
  return String(tender?.type ?? '').toLowerCase().replace(/[^a-z]/g, '') === 'goods';
}

function withGoodsBidInformationDefaults(
  responses: SchemaResponseState,
  schema: BidSubmissionSchemaDto | null,
  workflow: WorkflowType,
  bidderName: string,
  bidReferenceNumber: string,
  options: { forceBidderName?: boolean; forceReferenceNumber?: boolean } = {}
) {
  if (workflow !== 'goods' || !schemaStep(schema, 'goodsBidInformation')) return responses;

  const next: SchemaResponseState = {};
  const currentBidderName = String(responses['bidInformation.bidderName'] ?? '').trim();
  const currentReferenceNumber = String(responses['bidInformation.referenceNumber'] ?? '').trim();
  if ((!currentBidderName || options.forceBidderName) && bidderName && currentBidderName !== bidderName) next['bidInformation.bidderName'] = bidderName;
  if ((!currentReferenceNumber || options.forceReferenceNumber) && bidReferenceNumber && currentReferenceNumber !== bidReferenceNumber) next['bidInformation.referenceNumber'] = bidReferenceNumber;
  return Object.keys(next).length ? { ...responses, ...next } : responses;
}

function generatedBidReference(tender: TenderDetail | null | undefined, supplierKey: string | undefined) {
  const tenderPart = safeReferencePart(tender?.reference || tender?.id || 'TENDER');
  const supplierPart = shortHash(supplierKey || 'SUPPLIER');
  return `PX-BID-${tenderPart}-${supplierPart}`;
}

function safeReferencePart(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toUpperCase() || 'TENDER';
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

function schemaSteps(schema: BidSubmissionSchemaDto): Step[] {
  return schema.steps.map((step, index) => ({
    id: step.id,
    label: step.label,
    title: schemaReviewSectionTitle(step),
    description: schemaStepDescription(step),
    kicker: step.id === 'worksDeclaration' ? `Step ${index + 1}` : `Step ${String(index + 1).padStart(2, '0')}`
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
  if (step.id === 'goodsBidInformation') return '';
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
    goodsBidInformation: 'Bid Information',
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

function schemaOptionalFieldValue(field: BidSubmissionSchemaFieldDto | undefined, responses: SchemaResponseState) {
  return field ? schemaFieldValue(field, responses) : undefined;
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
    .filter((field) => field.section !== 'samples' && (field.type !== 'file' && field.responseType !== 'attachment' || hasMeaningfulStructuredResponse(schemaFieldValue(field, responses))))
    .map((field) => ({
      requirementKey: field.requirementKey,
      response: { value: schemaFieldValue(field, responses) }
    }));
}

function schemaSectionPayload(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, section: 'administrative' | 'technical' | 'financial' | 'declarations') {
  const fields = actionableSchemaFields(schema).filter((field) => field.section === section && field.type !== 'file' && field.responseType !== 'attachment');
  return Object.fromEntries(fields.map((field) => [schemaPayloadKey(field), schemaFieldValue(field, responses)]));
}

function schemaAdministrativePayload(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, workflow: WorkflowType) {
  const payload = schemaSectionPayload(schema, responses, 'administrative');
  const goodsDeclarationFields = actionableSchemaFields(schema).filter(isGoodsEligibilityDeclarationField);
  const goodsDeclarationsComplete = goodsDeclarationFields.length > 0 && goodsDeclarationFields.every((field) => schemaFieldValue(field, responses) === true);
  if (workflow === 'goods' && goodsDeclarationsComplete) return { ...payload, eligible: true };
  return payload;
}

function schemaPayloadKey(field: BidSubmissionSchemaFieldDto) {
  return field.requirementKey.split('.').at(-1) || field.id.split('.').at(-1) || field.id;
}

function actionableSchemaFields(schema: BidSubmissionSchemaDto) {
  return schema.steps.flatMap((step) => step.fields).filter((field) => field.section !== 'review' && field.section !== 'receipt');
}

function validateSchemaResponses(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  return actionableValidationFields(schema)
    .filter((field) => field.required && !schemaFieldComplete(field, responses, documents, samples))
    .map((field) => field.label);
}

function goodsPreDeclarationValidationIssues(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  return actionableValidationFields(schema)
    .filter((field) => field.section !== 'declarations' && !isDeclarationLikeField(field))
    .filter((field) => field.required && !schemaFieldComplete(field, responses, documents, samples))
    .map((field) => field.label);
}

function isDeclarationLikeField(field: BidSubmissionSchemaFieldDto) {
  return field.responseType === 'declaration' || field.responseType === 'acknowledgement' || /declaration|submit/i.test(`${field.requirementKey} ${field.source} ${field.label}`);
}

function schemaCompleteness(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  const fields = actionableValidationFields(schema).filter((field) => field.required);
  const totalSections = Math.max(1, fields.length);
  const sectionsComplete = fields.filter((field) => schemaFieldComplete(field, responses, documents, samples)).length;
  return { percent: Math.round((sectionsComplete / totalSections) * 100), sectionsComplete, totalSections };
}

function actionableValidationFields(schema: BidSubmissionSchemaDto) {
  return schema.steps.flatMap(schemaStepValidationFields).filter((field) => field.section !== 'review' && field.section !== 'receipt');
}

function schemaStepValidationFields(step: BidSubmissionSchemaStepDto) {
  if (step.id !== 'worksCapacity') return step.fields;
  return worksCapacityRenderableFields(step);
}

function worksCapacityRenderableFields(step: BidSubmissionSchemaStepDto) {
  const groups = worksCapacityGroups(step);
  return uniqueSchemaFields([...groups.similarProjects, ...groups.personnel, ...groups.equipment, ...groups.hse]);
}

function uniqueSchemaFields(fields: BidSubmissionSchemaFieldDto[]) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = `${field.id}::${field.requirementKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function schemaFieldComplete(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[]) {
  if (field.type === 'file' || field.responseType === 'attachment') return documentsForSchemaField(documents, field).length > 0;
  if (field.section === 'samples') return samples.some((sample) => sampleMatchesField(sample, field));
  const value = schemaFieldValue(field, responses);
  if (field.type === 'boolean' || field.responseType === 'boolean' || field.responseType === 'declaration' || field.responseType === 'acknowledgement') return value === true;
  if (isSchemaBoqPricingField(field) && goodsOfferResponseValue(value)) return schemaFinancialFieldTotal(field, responses) > 0;
  if (isSchemaBoqPricingField(field) && worksBoqResponseValue(value)) return worksBoqValue(value).status === 'Not Bid' || schemaFinancialFieldTotal(field, responses) > 0;
  if (field.responseType === 'money' || field.responseType === 'pricing') return Number(value) > 0;
  if (worksFieldControl(field) === 'worksSimilarProject') return field.required ? fieldEvidenceUploadsComplete(field, documents) : hasMeaningfulStructuredResponse(value) || fieldEvidenceUploadsComplete(field, documents);
  if (worksFieldControl(field) === 'worksPersonnel') return field.required ? hasFilledStructuredKey(value, 'namedResource') && fieldEvidenceUploadsComplete(field, documents) : hasFilledStructuredKey(value, 'namedResource') || fieldEvidenceUploadsComplete(field, documents);
  if (isWorksHseField(field)) return worksHseFieldComplete(field, responses, documents);
  if (isGoodsProductSpecificationField(field)) return goodsProductSpecificationComplete(field, value, documents);
  if (isGoodsRegulatoryLicenseField(field)) return goodsRegulatoryLicenseComplete(field, value, documents);
  if (isGoodsOtherEligibilityField(field)) return goodsOtherEligibilityComplete(field, value, documents);
  if (isGoodsFinancialRequirementField(field)) return goodsFinancialRequirementComplete(field, value, documents);
  if (field.type === 'table' || field.responseType === 'structured') {
    const hasResponse = hasMeaningfulStructuredResponse(value);
    return field.required ? hasResponse && fieldEvidenceUploadsComplete(field, documents) : hasResponse;
  }
  return String(value ?? '').trim().length > 0;
}

function goodsProductSpecificationComplete(field: BidSubmissionSchemaFieldDto, value: unknown, documents: BidDocumentState[]) {
  const payload = structuredValue(value);
  const compliance = String(payload.complianceStatus ?? '').trim();
  const offeredValue = String(payload.offeredSpecification ?? '').trim();
  const deviation = String(payload.deviations ?? '').trim();
  const deviationRequired = /partial|do not|not comply|not compliant/i.test(compliance);
  const evidenceComplete = !goodsRequirementEvidenceRequired(field) || documentsForEvidenceSlot(documents, field, goodsItemEvidenceSlot(field)).length > 0;
  const responseComplete = Boolean(compliance && offeredValue && (!deviationRequired || deviation));
  return field.required ? responseComplete && evidenceComplete : responseComplete || evidenceComplete;
}

function goodsRegulatoryLicenseComplete(field: BidSubmissionSchemaFieldDto, value: unknown, documents: BidDocumentState[]) {
  const payload = structuredValue(value);
  const hasStatus = String(payload.status ?? '').trim().length > 0;
  const expiryRequired = field.validation.expiryRequired === true || /^(yes|true|required|mandatory|1)$/i.test(String(field.validation.expiryRequired ?? ''));
  const hasExpiry = !expiryRequired || String(payload.expiryDate ?? '').trim().length > 0;
  const evidenceRequired = field.required || goodsRequirementEvidenceRequired(field);
  const evidenceComplete = !evidenceRequired || fieldEvidenceUploadsComplete(field, documents);
  return field.required ? hasStatus && hasExpiry && evidenceComplete : hasStatus || fieldEvidenceUploadsComplete(field, documents);
}

function goodsOtherEligibilityComplete(field: BidSubmissionSchemaFieldDto, value: unknown, documents: BidDocumentState[]) {
  const payload = structuredValue(value);
  const hasConfirmation = String(payload.confirmationStatus ?? '').trim().length > 0;
  const evidenceComplete = !goodsRequirementEvidenceRequired(field) || fieldEvidenceUploadsComplete(field, documents);
  return field.required ? hasConfirmation && evidenceComplete : hasConfirmation || fieldEvidenceUploadsComplete(field, documents);
}

function goodsFinancialRequirementComplete(field: BidSubmissionSchemaFieldDto, value: unknown, documents: BidDocumentState[]) {
  const hasResponse = hasMeaningfulStructuredResponse(value);
  const evidenceComplete = !goodsRequirementEvidenceRequired(field) || fieldEvidenceUploadsComplete(field, documents);
  return field.required ? hasResponse && evidenceComplete : hasResponse || fieldEvidenceUploadsComplete(field, documents);
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
  const value = schemaFieldValue(field, responses);
  const quantity = Number(field.validation.quantity ?? 1) || 1;
  const goodsValue = goodsOfferValue(value);
  const rate = goodsOfferResponseValue(value)
    ? goodsValue.unitPrice
    : worksBoqResponseValue(value)
      ? (worksBoqValue(value).status === 'Not Bid' ? 0 : worksBoqUnitRate(worksBoqValue(value), quantity))
      : Number(value ?? 0);
  const discount = goodsOfferResponseValue(value) && goodsLineDiscountAllowed(field) ? goodsDiscountValue(goodsValue.discount, rate * quantity) : 0;
  return withTotal({
    id: String(field.validation.itemId ?? field.id),
    itemNo: String(field.validation.itemNo ?? index + 1),
    description: String(field.validation.description ?? field.label.replace(/^Unit rate for\s+/i, '')),
    quantity,
    unit: String(field.validation.unit ?? 'Lot'),
    rate,
    taxIncluded: true,
    discount
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

function documentsForEvidenceSlot(documents: BidDocumentState[], field: BidSubmissionSchemaFieldDto, slot: EvidenceUploadSlot) {
  return documents.filter((document) => {
    const metadata = objectPayload(document.metadata);
    const requirementKey = String(metadata.requirementKey ?? '');
    const parentRequirementKey = String(metadata.parentRequirementKey ?? '');
    const fieldId = String(metadata.fieldId ?? '');
    const evidenceKey = String(metadata.evidenceKey ?? '');
    return (
      requirementKey === slot.requirementKey ||
      (parentRequirementKey === field.requirementKey && evidenceKey === slot.key) ||
      (fieldId === field.id && evidenceKey === slot.key) ||
      document.documentType === slot.documentType
    );
  });
}

function hseEvidenceUploadSlot(field: BidSubmissionSchemaFieldDto, uploadField = field): EvidenceUploadSlot {
  const documentType = String(uploadField.validation.documentType ?? '');
  const requirementKey = uploadField === field || (uploadField.type !== 'file' && uploadField.responseType !== 'attachment') ? `${field.requirementKey}.documents` : uploadField.requirementKey;
  return {
    key: 'documents',
    label: 'Upload HSE documents',
    requirementKey,
    documentType: documentType || 'TECHNICAL_HSE_DOCUMENTS'
  };
}

function documentsForHseUpload(documents: BidDocumentState[], field: BidSubmissionSchemaFieldDto, uploadField = field, slot = hseEvidenceUploadSlot(field, uploadField)) {
  return documents.filter((document) => {
    const metadata = objectPayload(document.metadata);
    const requirementKey = String(metadata.requirementKey ?? '');
    const parentRequirementKey = String(metadata.parentRequirementKey ?? '');
    const fieldId = String(metadata.fieldId ?? '');
    const evidenceKey = String(metadata.evidenceKey ?? '');
    return (
      requirementKey === slot.requirementKey ||
      requirementKey === field.requirementKey ||
      requirementKey === uploadField.requirementKey ||
      (parentRequirementKey === field.requirementKey && evidenceKey === slot.key) ||
      (fieldId === field.id && evidenceKey === slot.key) ||
      document.documentType === slot.documentType
    );
  });
}

function fieldEvidenceUploadsComplete(field: BidSubmissionSchemaFieldDto, documents: BidDocumentState[]) {
  return evidenceUploadSlotsForField(field).every((slot) => documentsForEvidenceSlot(documents, field, slot).length > 0);
}

function missingEvidenceUploadSlots(field: BidSubmissionSchemaFieldDto, documents: BidDocumentState[]) {
  return evidenceUploadSlotsForField(field).filter((slot) => documentsForEvidenceSlot(documents, field, slot).length === 0);
}

function evidenceUploadSummary(field: BidSubmissionSchemaFieldDto, documents: BidDocumentState[]) {
  return evidenceUploadSlotsForField(field)
    .map((slot) => {
      const uploaded = documentsForEvidenceSlot(documents, field, slot);
      return uploaded.length ? `${slot.label}: ${documentNames(uploaded)}` : '';
    })
    .filter(Boolean)
    .join(' / ');
}

function hasFilledStructuredKey(value: unknown, key: string) {
  const payload = structuredValue(value);
  return String(payload[key] ?? '').trim().length > 0;
}

function worksHseFieldComplete(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState, documents: BidDocumentState[]) {
  const value = worksHseAggregateValue(field, responses);
  const responseComplete = ['safetyPolicyAvailable', 'environmentalPolicyAvailable', 'safetyOfficerAssigned', 'ppePlan', 'incidentManagementPlan', 'wasteManagementPlan'].every((key) => String(value[key] ?? '').trim().length > 0);
  if (!field.required) return responseComplete || documentsForHseUpload(documents, field).length > 0;
  return responseComplete && documentsForHseUpload(documents, field).length > 0;
}

function worksHseAggregateValue(field: BidSubmissionSchemaFieldDto, responses: SchemaResponseState) {
  const ownValue = structuredValue(schemaFieldValue(field, responses));
  if (hasMeaningfulStructuredResponse(ownValue)) return ownValue;
  const hseEntry = Object.entries(responses).find(([key, value]) => /hse|health|safety|environment|environmental|ppe|incident|waste/i.test(key) && hasMeaningfulStructuredResponse(value));
  return hseEntry ? structuredValue(hseEntry[1]) : ownValue;
}

function schemaFieldByRequirement(fields: BidSubmissionSchemaFieldDto[], requirementKey: string) {
  return fields.find((field) => field.requirementKey === requirementKey || field.id === requirementKey);
}

function worksRequirementFields(tender: TenderDetail) {
  const requirements = objectPayload(tender.requirements);
  return {
    ...objectPayload(requirements.worksRequirements),
    ...objectPayload(objectPayload(requirements.works).fields),
    ...objectPayload(requirements.fields)
  };
}

function worksTenderFieldText(tender: TenderDetail, key: string) {
  const value = worksRequirementFields(tender)[key];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function worksDrawingRows(tender: TenderDetail) {
  const value = worksRequirementFields(tender).drawingDesignRows;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
}

function worksSiteVisitMandatory(tender: TenderDetail) {
  return /mandatory|required/i.test(worksTenderFieldText(tender, 'siteVisitRequirement'));
}

function worksBoqResponseValue(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && ('labor' in value || 'material' in value || 'equipment' in value || 'unitRate' in value || 'status' in value));
}

function goodsOfferResponseValue(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && ('unitPrice' in value || 'taxIncluded' in value || 'discount' in value));
}

function goodsOfferValue(value: unknown): GoodsOfferValue {
  if (typeof value === 'number') return { status: value > 0 ? 'Bid' : '', unitPrice: Math.max(0, value), taxIncluded: '', discount: '' };
  const payload = objectPayload(value);
  return {
    status: String(payload.status ?? ''),
    unitPrice: Number(payload.unitPrice ?? payload.unitRate ?? 0) || 0,
    taxIncluded: String(payload.taxIncluded ?? ''),
    discount: String(payload.discount ?? '')
  };
}

function goodsDiscountValue(value: string, lineTotal: number) {
  const text = value.trim();
  if (!text) return 0;
  const numeric = Number(text.replace('%', ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return text.includes('%') ? Math.min(lineTotal, (lineTotal * numeric) / 100) : Math.min(lineTotal, numeric);
}

function worksBoqValue(value: unknown): WorksBoqValue {
  if (typeof value === 'number') return { status: value > 0 ? 'Bid' : '', labor: 0, material: 0, equipment: 0, overheads: 0, profit: 6, unitRate: value };
  const payload = objectPayload(value);
  return {
    status: String(payload.status ?? ''),
    labor: Number(payload.labor ?? 0) || 0,
    material: Number(payload.material ?? 0) || 0,
    equipment: Number(payload.equipment ?? 0) || 0,
    overheads: Number(payload.overheads ?? 0) || 0,
    profit: Number(payload.profit ?? 6) || 0,
    unitRate: Number(payload.unitRate ?? 0) || 0
  };
}

function worksBoqDirectCost(value: WorksBoqValue) {
  return Math.max(0, value.labor + value.material + value.equipment + value.overheads);
}

function worksBoqLineTotal(value: WorksBoqValue) {
  return Math.round(worksBoqDirectCost(value) * (1 + Math.max(0, value.profit) / 100));
}

function worksBoqUnitRate(value: WorksBoqValue, quantity: number) {
  if (worksBoqDirectCost(value) <= 0 && value.unitRate) return Math.max(0, Math.round(value.unitRate));
  return Math.round(worksBoqLineTotal(value) / Math.max(1, quantity || 1));
}

function schemaRequirementText(field: BidSubmissionSchemaFieldDto) {
  return String(field.validation.prompt ?? field.source ?? field.requirementKey);
}

function schemaSourceStepId(schema: BidSubmissionSchemaDto, sourceId: string) {
  const step = schema.steps.find((item) => item.id === sourceId || item.fields.some((field) => field.id === sourceId || field.requirementKey === sourceId));
  return step?.id ?? sourceId;
}

function sectionReadiness(schema: BidSubmissionSchemaDto, responses: SchemaResponseState, documents: BidDocumentState[], samples: BidSampleDto[], section: string) {
  const fields = actionableValidationFields(schema).filter((field) => field.section === section && field.required);
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
  if (workflow === 'goods') {
    return {
      [goodsFallbackSpecificationKey]: {
        complianceStatus: 'Comply',
        offeredSpecification: `We respond to the product specifications for ${tender.reference}.`
      }
    };
  }
  if (workflow === 'works') return { methodology: '', workPlan: '', capacity: '', experience: '', hse: '' };
  if (workflow === 'services') return { methodology: '', deliveryPlan: '', staffingPlan: '', sla: '', reportingPlan: '' };
  if (workflow === 'consultancy') return { technicalProposal: '', methodology: '', teamQualifications: '' };
  return {};
}

function goodsFallbackTechnicalText(technical: Record<string, unknown>) {
  const specification = objectPayload(technical[goodsFallbackSpecificationKey]);
  return goodsText(specification.offeredSpecification ?? specification.response ?? specification.complianceStatus)
    || goodsText(technical.approach ?? technical.deliveryPlan);
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
  const approach = value('approach', 'methodology', 'technicalProposal');
  const deliveryPlan = value('deliveryPlan', 'workPlan', 'samplePlan', 'staffingPlan', 'sla', 'technicalProposal', 'methodology');

  if (workflow === 'goods') {
    const goodsTechnical = goodsFallbackTechnicalText(technical);
    normalized.approach = value('approach') || goodsTechnical;
    normalized.deliveryPlan = value('deliveryPlan', 'samplePlan') || goodsTechnical;
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
      requirementKey: workflow === 'goods' && key.startsWith('goods.') ? key : `${workflow}-${key}`,
      response: { value }
    }));
}

function validateForm(workflow: WorkflowType, form: BidFormState, documents: BidDocumentState[], totalAmount: number) {
  const issues: string[] = [];
  if (!form.administrative.eligible) issues.push('administrative confirmations');
  if (documents.length < 1) issues.push('supporting documents');
  if (totalAmount <= 0) issues.push('financial offer');
  if (!form.declarations.confirmAccuracy || !form.declarations.acceptTerms) issues.push('declarations');
  if (workflow === 'goods' && !goodsFallbackTechnicalText(form.technical)) issues.push('product specification response');
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
  if (stepId === 'worksDeclaration') return 'Final step';
  if (stepId === 'receipt') return receipt ? 'Submitted' : 'Pending';
  if (stepId === 'review') return `${issues.length} issues`;
  if (stepId === 'eligibility') return gate.complete ? 'Gate complete' : `${gate.remaining} remaining`;
  return issues.length ? 'In progress' : 'Ready';
}

function reactWorkspaceState(input: {
  activeStep: number;
  completeness: { percent: number; sectionsComplete: number; totalSections: number };
  currency: string;
  documents: BidDocumentInput[];
  form: BidFormState;
  samples: BidSampleDto[];
  schemaResponses: SchemaResponseState;
  tenderId: string | null;
  totalAmount: number;
  validationIssues: string[];
  workflow: WorkflowType;
}): Record<string, unknown> {
  return {
    source: 'react-bidding-workspace',
    workflowType: input.workflow,
    workflowVersion: WORKFLOW_VERSION,
    tenderId: input.tenderId,
    activeStep: input.activeStep,
    schemaResponses: input.schemaResponses,
    form: input.form,
    documents: input.documents,
    samples: input.samples,
    totalAmount: input.totalAmount,
    currency: input.currency,
    completeness: input.completeness,
    validationIssues: input.validationIssues,
    updatedAt: new Date().toISOString()
  };
}

function bidDocumentInputFromDto(document: BidDocumentState): BidDocumentInput {
  const metadata = objectPayload(document.metadata);
  const size = Number(metadata.size);
  return {
    documentId: document.documentId,
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

function errorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}

function bidSubmitErrorMessage(error: unknown, fallback: string) {
  if (isKeyphraseApiError(error)) return apiErrorMessage(error, fallback);
  const status = (error as { response?: { status?: number } }).response?.status;
  const rawMessage = apiRawErrorMessage(error);
  if (status && status >= 400 && status < 500 && rawMessage) return rawMessage;
  return apiErrorMessage(error, fallback);
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
