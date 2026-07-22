/* Renders the awards Contracts Award Contract Simple Shared UI while keeping page-specific presentation near its workflow data. */
import { useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/shared/api/http';
import type { AwardDecisionDraftInput, AwardRecommendationDetailDto, AwardSourceDocumentDto } from '../../types';
import { formatMoney, StatusBadge } from './AwardsContractsProcurexShared';

export function notifyAward(tone: 'success' | 'warning' | 'error' | 'info', title: string, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('procurex:notify', { detail: { tone, title, message, dismissible: true } }));
}

export async function openAwardDocument(url: string, filename: string, download = false) {
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data);
  if (download) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return;
  }
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function ExpandableAwardDetails({
  title,
  summary,
  children,
  open = false
}: {
  title: string;
  summary: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="award-simple-details" open={open}>
      <summary>
        <span>
          <strong>{title}</strong>
          <em>{summary}</em>
        </span>
      </summary>
      <div className="award-simple-details-body">{children}</div>
    </details>
  );
}

type PlainRecord = Record<string, unknown>;

function readableRecordValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'Saved details';
  return String(value);
}

export function AwardPlainRecordList({
  records,
  emptyMessage = 'No records are saved yet.'
}: {
  records?: PlainRecord[];
  emptyMessage?: string;
}) {
  if (!records?.length) return <div className="scope-empty">{emptyMessage}</div>;
  return (
    <div className="award-simple-record-list">
      {records.map((record, index) => {
        const title = readableRecordValue(record.title ?? record.reference ?? record.id ?? `Record ${index + 1}`);
        const status = readableRecordValue(record.status ?? record.action ?? record.role ?? record.type);
        const note = readableRecordValue(record.note ?? record.description ?? record.reason ?? record.createdAt);
        return (
          <article className="award-simple-record" key={String(record.id ?? `${title}-${index}`)}>
            <div>
              <strong>{title}</strong>
              <span>{note}</span>
            </div>
            <StatusBadge value={status} />
          </article>
        );
      })}
    </div>
  );
}

export function SourceDocumentsPanel({ documents = [] }: { documents?: AwardSourceDocumentDto[] }) {
  const tenderDocuments = documents.filter((document) => document.sourceType === 'tender');
  const bidDocuments = documents.filter((document) => document.sourceType === 'bid');
  const evaluationReports = documents.filter((document) => document.sourceType === 'evaluation-report');

  async function handleDocument(document: AwardSourceDocumentDto, download: boolean) {
    const url = download ? document.downloadUrl : document.openUrl;
    if (!url) {
      notifyAward('warning', 'Document unavailable', `${document.name} is not available yet.`);
      return;
    }
    try {
      await openAwardDocument(url, `${document.name}.html`, download);
    } catch (error) {
      notifyAward('error', 'Document unavailable', error instanceof Error ? error.message : `${document.name} could not be opened.`);
    }
  }

  const row = (document: AwardSourceDocumentDto) => (
    <article className="award-source-document-row" key={document.id}>
      <div>
        <strong>{document.label}</strong>
        <span>{document.supplierName ? `${document.name} - ${document.supplierName}` : document.name}</span>
      </div>
      <div className="inline-actions">
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleDocument(document, false)}>Open</button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleDocument(document, true)}>Download</button>
      </div>
    </article>
  );

  return (
    <div className="award-source-document-list">
      {tenderDocuments.length ? tenderDocuments.map(row) : <div className="scope-empty">No tender document is linked yet.</div>}
      <details className="award-source-document-row award-bid-document-details">
        <summary>
          <span>
            <strong>Bid Documents</strong>
            <em>{bidDocuments.length} submitted document{bidDocuments.length === 1 ? '' : 's'}</em>
          </span>
        </summary>
        <div className="award-bid-document-list">
          {bidDocuments.length ? bidDocuments.map(row) : <div className="scope-empty">No submitted bid documents are linked yet.</div>}
        </div>
      </details>
      {evaluationReports.map(row)}
    </div>
  );
}

type AwardDecisionValues = Required<Omit<AwardDecisionDraftInput, 'confirmations'>> & {
  confirmations: NonNullable<AwardDecisionDraftInput['confirmations']>;
};

function draftFromRecommendation(recommendation: AwardRecommendationDetailDto | null): AwardDecisionValues {
  const draft = ((recommendation as unknown as { payload?: { awardDecisionDraft?: Partial<AwardDecisionValues> } })?.payload?.awardDecisionDraft ?? {}) as Partial<AwardDecisionValues>;
  const supplier = recommendation?.supplierName ?? recommendation?.otherParty ?? '';
  const amount = recommendation?.amount ?? 0;
  return {
    selectedSupplier: draft.selectedSupplier ?? supplier,
    awardAmount: Number(draft.awardAmount ?? amount ?? 0),
    currency: draft.currency ?? recommendation?.currency ?? 'TZS',
    awardDate: draft.awardDate ?? new Date().toISOString().slice(0, 10),
    reason: draft.reason ?? recommendation?.reason ?? '',
    conditions: draft.conditions ?? '',
    confirmationBy: draft.confirmationBy ?? '',
    note: draft.note ?? recommendation?.reason ?? '',
    confirmations: {
      evaluationReviewed: Boolean(draft.confirmations?.evaluationReviewed),
      documentsReviewed: Boolean(draft.confirmations?.documentsReviewed),
      authorityConfirmed: Boolean(draft.confirmations?.authorityConfirmed)
    }
  };
}

export function AwardDecisionForm({
  recommendation,
  saving,
  onSave,
  onConfirm,
  confirmLabel = 'Confirm award'
}: {
  recommendation: AwardRecommendationDetailDto | null;
  saving?: boolean;
  onSave: (payload: AwardDecisionDraftInput) => Promise<void>;
  onConfirm: (payload: AwardDecisionDraftInput) => Promise<void>;
  confirmLabel?: string;
}) {
  const [values, setValues] = useState<AwardDecisionValues>(() => draftFromRecommendation(recommendation));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setValues(draftFromRecommendation(recommendation));
    setSubmitted(false);
  }, [recommendation?.id]);

  const ready =
    values.selectedSupplier.trim() &&
    values.awardAmount > 0 &&
    values.currency.trim() &&
    values.awardDate &&
    values.reason.trim() &&
    values.confirmationBy.trim() &&
    values.confirmations.evaluationReviewed &&
    values.confirmations.documentsReviewed &&
    values.confirmations.authorityConfirmed;

  function payload(): AwardDecisionDraftInput {
    return {
      selectedSupplier: values.selectedSupplier.trim(),
      awardAmount: Number(values.awardAmount),
      currency: values.currency.trim().toUpperCase(),
      awardDate: values.awardDate,
      reason: values.reason.trim(),
      conditions: values.conditions.trim(),
      confirmationBy: values.confirmationBy.trim(),
      note: values.note || values.reason,
      confirmations: values.confirmations
    };
  }

  function update<K extends keyof AwardDecisionValues>(key: K, value: AwardDecisionValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function confirm() {
    setSubmitted(true);
    if (!ready) {
      notifyAward('warning', 'Complete award decision', 'Complete the required fields and confirmations.');
      return;
    }
    await onConfirm(payload());
  }

  return (
    <section className="procurement-panel evaluation-panel award-decision-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Award Decision</span>
          <h2>Approve award for {values.selectedSupplier || 'recommended supplier'}</h2>
          <p>Confirm the award details.</p>
        </div>
        <StatusBadge value={recommendation?.status ?? 'Draft'} />
      </div>

      <form className="award-main-form" noValidate>
        <div className="award-readonly-summary">
          <article><span>Recommended supplier</span><strong>{recommendation?.supplierName ?? recommendation?.otherParty ?? values.selectedSupplier}</strong></article>
          <article><span>Recommended amount</span><strong>{formatMoney(recommendation?.amount ?? values.awardAmount, recommendation?.currency ?? values.currency)}</strong></article>
          <article><span>Tender</span><strong>{recommendation?.tenderTitle ?? recommendation?.title ?? 'Selected tender'}</strong></article>
        </div>

        <div className="award-form-grid">
          <label className="award-form-field">
            <span>Selected supplier *</span>
            <input className="form-input" value={values.selectedSupplier} placeholder="Supplier to award" onChange={(event) => update('selectedSupplier', event.target.value)} />
            {submitted && !values.selectedSupplier.trim() ? <em>Enter the supplier name.</em> : null}
          </label>
          <label className="award-form-field">
            <span>Award amount *</span>
            <input className="form-input" type="number" min="0" value={values.awardAmount || ''} placeholder="0.00" onChange={(event) => update('awardAmount', Number(event.target.value || 0))} />
            {submitted && values.awardAmount <= 0 ? <em>Enter the award amount.</em> : null}
          </label>
          <label className="award-form-field">
            <span>Currency *</span>
            <input className="form-input" value={values.currency} maxLength={3} placeholder="TZS" onChange={(event) => update('currency', event.target.value.toUpperCase())} />
          </label>
          <label className="award-form-field">
            <span>Award date *</span>
            <input className="form-input" type="date" value={values.awardDate} onChange={(event) => update('awardDate', event.target.value)} />
          </label>
          <label className="award-form-field award-form-field-wide">
            <span>Reason for award *</span>
            <textarea className="form-input" rows={4} value={values.reason} placeholder="Award reason" onChange={(event) => update('reason', event.target.value)} />
            {submitted && !values.reason.trim() ? <em>Write the award reason.</em> : null}
          </label>
          <label className="award-form-field award-form-field-wide">
            <span>Conditions</span>
            <textarea className="form-input" rows={3} value={values.conditions} placeholder="Award conditions" onChange={(event) => update('conditions', event.target.value)} />
          </label>
          <label className="award-form-field">
            <span>Confirmed by *</span>
            <input className="form-input" value={values.confirmationBy} placeholder="Your name or role" onChange={(event) => update('confirmationBy', event.target.value)} />
          </label>
        </div>

        <fieldset className="award-confirmation-box">
          <legend>Buyer confirmations *</legend>
          {[
            ['evaluationReviewed', 'I reviewed the evaluation recommendation.'],
            ['documentsReviewed', 'I can open the tender, bid, and evaluation documents.'],
            ['authorityConfirmed', 'I have authority to confirm this award.']
          ].map(([key, label]) => (
            <label className="award-form-checkbox" key={key}>
              <input
                type="checkbox"
                checked={Boolean(values.confirmations[key as keyof AwardDecisionValues['confirmations']])}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  confirmations: { ...current.confirmations, [key]: event.target.checked }
                }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <div className="award-simple-actions">
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => void onSave(payload())}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void confirm()}>{confirmLabel}</button>
        </div>
      </form>
    </section>
  );
}
