import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { editableTrustTierValues } from '@/shared/trustRisk';
import type { PickerOption } from '../../types';
import { StatusBadge } from './AwardsContractsProcurexShared';
import { actionDefinitionForTitle } from './AwardContractActionCatalogue';
import { clearAwardContractDirtyWork, confirmAwardContractNavigation, useAwardContractFlowGuard } from './AwardContractFlow';
import { notifyAward } from './AwardContractSimpleShared';
import { canUseWorkflowOwner, inferActionOwner, LockedWorkflowPanel, ownerLockedReason, useAwardContractAccess } from './AwardContractRoleAccess';

export type FieldOption = {
  label: string;
  value: string;
  description?: string;
  status?: string;
};

export type AwardContractFieldKind =
  | 'text'
  | 'password'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'uuid'
  | 'currency'
  | 'json'
  | 'multi'
  | 'picker';

export type AwardContractFieldConfig = {
  name: string;
  label: string;
  kind: AwardContractFieldKind;
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: string;
  note?: string;
  helpText?: string;
  section?: 'basics' | 'linked' | 'dates' | 'amounts' | 'decision' | 'evidence' | 'payload';
  advanced?: boolean;
  technical?: boolean;
  transform?: 'lineArray' | 'driverArray';
  picker?: boolean | { options?: PickerOption[]; emptyLabel?: string };
};

type FormValue = string | boolean | string[];
export type AwardContractFormValues = Record<string, FormValue>;
export type AwardContractPayload = Record<string, unknown>;

type ActionFormPanelProps = {
  title: string;
  eyebrow?: string;
  badge?: string;
  fields: AwardContractFieldConfig[];
  initialValues?: AwardContractFormValues;
  submitLabel?: string;
  onSubmit: (payload: AwardContractPayload, values: AwardContractFormValues) => Promise<unknown>;
  onComplete?: (result: unknown) => void;
  children?: ReactNode;
  drawerSummary?: ReactNode;
  defaultSelected?: boolean;
};

export const lifecycleStatusOptions = ['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED', 'CLOSED'].map((value) => option(value));
export const milestoneStatusOptions = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID'].map((value) => option(value));
export const contractStatusOptions = [
  'DRAFT',
  'NEGOTIATION',
  'SIGNATURE_PENDING',
  'SIGNED',
  'MOBILIZATION',
  'ACTIVE',
  'AT_RISK',
  'COMPLETED',
  'WARRANTY_DEFECTS',
  'TERMINATION_REVIEW',
  'TERMINATED',
  'CLOSED'
].map((value) => option(value));
export const invoiceStatusOptions = ['DRAFT', 'SUBMITTED', 'MATCHED', 'REVIEW', 'BLOCKED', 'PAID', 'REJECTED'].map((value) => option(value));
export const terminationTypeOptions = [
  'SUPPLIER_DEFAULT',
  'BUYER_DEFAULT',
  'CONVENIENCE',
  'MUTUAL',
  'FORCE_MAJEURE',
  'INSOLVENCY',
  'FRAUD_CORRUPTION'
].map((value) => option(value));
export const terminationStatusOptions = [
  'DRAFT',
  'NOTICE_ISSUED',
  'CURE_PERIOD_ACTIVE',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'TERMINATED',
  'SETTLEMENT_PENDING',
  'DISPUTED',
  'CLOSED'
].map((value) => option(value));
export const riskLevelOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => option(value));
export const trustTierOptions = editableTrustTierValues.map((value) => option(value));

export function option(value: string, label = displayLabel(value)): FieldOption {
  return { value, label };
}

export function displayLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type PickerRecord = {
  id: string;
  title?: string | null;
  subject?: string | null;
  reference?: string | null;
  inspectionNo?: string | null;
  certificateNo?: string | null;
  confirmationReference?: string | null;
  commitmentNo?: string | null;
  scoreType?: string | null;
  forecastType?: string | null;
  type?: string | null;
  status?: string | null;
  riskLevel?: string | null;
  amount?: number | string | null;
  paidAmount?: number | string | null;
  score?: number | string | null;
  probability?: number | string | null;
  currency?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
};

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function pickerRecordTitle(item: PickerRecord) {
  return item.title || item.subject || item.reference || item.inspectionNo || item.certificateNo || item.confirmationReference || item.commitmentNo || item.scoreType || item.forecastType || item.type || 'Linked record';
}

function pickerRecordDescription(item: PickerRecord) {
  const parts = [
    item.type ? displayLabel(String(item.type)) : '',
    item.amount !== null && item.amount !== undefined ? `${item.currency ?? ''} ${item.amount}`.trim() : '',
    item.paidAmount !== null && item.paidAmount !== undefined ? `Paid ${item.currency ?? ''} ${item.paidAmount}`.trim() : '',
    item.score !== null && item.score !== undefined ? `Score ${item.score}` : '',
    item.probability !== null && item.probability !== undefined ? `Probability ${item.probability}` : '',
    item.dueDate ? `Due ${dateLabel(item.dueDate)}` : '',
    item.createdAt ? `Created ${dateLabel(item.createdAt)}` : ''
  ].filter(Boolean);
  return parts.join(' | ');
}

export function itemOptions(items: PickerRecord[], emptyLabel = 'Select record'): FieldOption[] {
  return [
    option('', emptyLabel),
    ...items.map((item) => ({
      value: item.id,
      label: pickerRecordTitle(item),
      description: pickerRecordDescription(item),
      status: item.status || item.riskLevel || undefined
    }))
  ];
}

export function recordPickerOptions(records: Array<Record<string, unknown>>, emptyLabel = 'Select record'): FieldOption[] {
  return itemOptions(
    records
      .map((record) => ({
        id: String(record.id ?? ''),
        title: record.title === null || record.title === undefined ? undefined : String(record.title),
        subject: record.subject === null || record.subject === undefined ? undefined : String(record.subject),
        reference: record.reference === null || record.reference === undefined ? undefined : String(record.reference),
        inspectionNo: record.inspectionNo === null || record.inspectionNo === undefined ? undefined : String(record.inspectionNo),
        certificateNo: record.certificateNo === null || record.certificateNo === undefined ? undefined : String(record.certificateNo),
        confirmationReference: record.confirmationReference === null || record.confirmationReference === undefined ? undefined : String(record.confirmationReference),
        commitmentNo: record.commitmentNo === null || record.commitmentNo === undefined ? undefined : String(record.commitmentNo),
        scoreType: record.scoreType === null || record.scoreType === undefined ? undefined : String(record.scoreType),
        forecastType: record.forecastType === null || record.forecastType === undefined ? undefined : String(record.forecastType),
        type: record.type === null || record.type === undefined ? undefined : String(record.type),
        status: record.status === null || record.status === undefined ? undefined : String(record.status),
        riskLevel: record.riskLevel === null || record.riskLevel === undefined ? undefined : String(record.riskLevel),
        amount: record.amount as number | string | null | undefined,
        paidAmount: record.paidAmount as number | string | null | undefined,
        score: record.score as number | string | null | undefined,
        probability: record.probability as number | string | null | undefined,
        currency: record.currency === null || record.currency === undefined ? undefined : String(record.currency),
        dueDate: record.dueDate === null || record.dueDate === undefined ? undefined : String(record.dueDate),
        createdAt: record.createdAt === null || record.createdAt === undefined ? undefined : String(record.createdAt)
      }))
      .filter((record) => record.id),
    emptyLabel
  );
}

export function signatureOptions() {
  return [option('BUYER', 'Buyer'), option('SUPPLIER', 'Supplier')];
}

function defaultValue(field: AwardContractFieldConfig): FormValue {
  if (field.kind === 'checkbox') return false;
  if (field.kind === 'multi') return [];
  if (field.kind === 'json') return '{}';
  return '';
}

function isBlank(value: FormValue | undefined) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === false || String(value).trim() === '';
}

function normalizeDatetime(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'form';
}

function fieldSection(field: AwardContractFieldConfig) {
  if (field.section) return field.section;
  if (field.kind === 'json' || field.advanced) return 'payload';
  if (/document|evidence|certificate|proof/i.test(field.name)) return 'evidence';
  if (field.kind === 'uuid' && !field.options?.length && !field.picker) return 'payload';
  if (/id$/i.test(field.name) || field.kind === 'picker' || field.picker) return 'linked';
  if (/date|at$/i.test(field.name) || field.kind === 'date' || field.kind === 'datetime') return 'dates';
  if (/amount|cost|price|currency|score|quantity|days|weight|tax|retention|advance|damages|withholding|probability/i.test(field.name)) return 'amounts';
  if (/status|note|reason|decision|response|comment|approval|result/i.test(field.name)) return 'decision';
  return 'basics';
}

const sectionLabels: Record<ReturnType<typeof fieldSection>, string> = {
  basics: 'Basics',
  linked: 'Linked records',
  dates: 'Dates and timing',
  amounts: 'Amounts and scores',
  decision: 'Decision',
  evidence: 'Evidence',
  payload: 'Advanced payload'
};

function shouldUsePicker(field: AwardContractFieldConfig) {
  return field.kind === 'picker' || Boolean(field.picker) || (field.kind === 'select' && /id$/i.test(field.name) && Boolean(field.options?.length));
}

function pickerOptions(field: AwardContractFieldConfig) {
  const configured = typeof field.picker === 'object' ? field.picker.options : undefined;
  return configured ?? field.options ?? [];
}

function formCounts(fields: AwardContractFieldConfig[]) {
  const visibleFields = fields.filter((field) => !isTechnicalField(field));
  const required = visibleFields.filter((field) => field.required).length;
  const linked = visibleFields.filter((field) => fieldSection(field) === 'linked').length;
  const advanced = visibleFields.filter((field) => fieldSection(field) === 'payload').length;
  return { required, linked, advanced };
}

function isTechnicalField(field: AwardContractFieldConfig) {
  return Boolean(field.technical || field.advanced) || (field.kind === 'json' && field.name === 'payload');
}

function reviewValue(field: AwardContractFieldConfig, value: FormValue | undefined) {
  if (value === undefined || value === false || value === '') return 'Not set';
  if (Array.isArray(value)) return value.length ? value.map(displayLabel).join(', ') : 'Not set';
  if (field.kind === 'checkbox') return value ? 'Yes' : 'No';
  const text = String(value);
  const selected = pickerOptions(field).find((item) => item.value === text);
  return selected?.label ?? (text.length > 80 ? `${text.slice(0, 77)}...` : text);
}

function ActionReviewSummary({ fields, values }: { fields: AwardContractFieldConfig[]; values: AwardContractFormValues }) {
  const visibleFields = fields
    .filter((field) => field.kind !== 'json' && !field.advanced && !isTechnicalField(field))
    .slice(0, 6);

  if (visibleFields.length === 0) return null;

  return (
    <section className="award-action-review-summary" aria-label="Action summary">
      {visibleFields.map((field) => (
        <article key={field.name}>
          <span>{field.label}</span>
          <strong>{reviewValue(field, values[field.name])}</strong>
        </article>
      ))}
    </section>
  );
}

export function buildAwardContractPayload(fields: AwardContractFieldConfig[], values: AwardContractFormValues) {
  const payload: AwardContractPayload = {};
  const errors: string[] = [];

  for (const field of fields) {
    const raw = values[field.name] ?? defaultValue(field);
    if (field.required && isBlank(raw)) errors.push(`${field.label} is required.`);

    if (field.transform === 'lineArray') {
      payload[field.name] = splitLines(raw);
      continue;
    }

    if (field.transform === 'driverArray') {
      payload[field.name] = splitLines(raw).map((driver) => ({ driver }));
      continue;
    }

    if (field.kind === 'json') {
      const text = String(raw || '{}').trim() || '{}';
      try {
        payload[field.name] = JSON.parse(text);
      } catch {
        errors.push(`${field.label} must be valid JSON.`);
      }
      continue;
    }

    if (!field.required && isBlank(raw)) continue;

    if (field.kind === 'checkbox') {
      payload[field.name] = Boolean(raw);
    } else if (field.kind === 'multi') {
      payload[field.name] = Array.isArray(raw) ? raw : [];
    } else if (field.kind === 'number') {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) errors.push(`${field.label} must be a number.`);
      else payload[field.name] = numeric;
    } else if (field.kind === 'datetime') {
      payload[field.name] = normalizeDatetime(String(raw));
    } else if (field.kind === 'currency') {
      payload[field.name] = String(raw).trim().toUpperCase();
    } else {
      payload[field.name] = String(raw).trim();
    }
  }

  return { payload, errors };
}

function splitLines(value: FormValue | undefined) {
  if (Array.isArray(value)) return value.map(String).map((line) => line.trim()).filter(Boolean);
  return String(value ?? '')
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ActionFormPanel({
  title,
  eyebrow,
  badge = 'Form',
  fields,
  initialValues,
  submitLabel = 'Submit',
  onSubmit,
  onComplete,
  children,
  drawerSummary,
  defaultSelected = false
}: ActionFormPanelProps) {
  const access = useAwardContractAccess();
  const actionDefinition = actionDefinitionForTitle(title);
  const owner = actionDefinition?.owner ?? inferActionOwner(title, badge);
  const allowed = canUseWorkflowOwner(access, owner);
  const [selected, setSelected] = useState(defaultSelected);
  const formKey = useMemo(() => slug(title), [title]);
  const formTitleId = `award-action-${formKey}-title`;
  const defaults = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, initialValues?.[field.name] ?? defaultValue(field)])) as AwardContractFormValues,
    [fields, initialValues]
  );
  const [values, setValues] = useState<AwardContractFormValues>(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const dirtyRef = useRef(false);
  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(defaults), [defaults, values]);
  useAwardContractFlowGuard(selected && isDirty);

  useEffect(() => {
    setValues(defaults);
    setMessage('');
  }, [defaults]);

  useEffect(() => {
    dirtyRef.current = selected && isDirty;
  }, [isDirty, selected]);

  const built = buildAwardContractPayload(fields, values);
  const blocked = saving || built.errors.length > 0;
  const counts = formCounts(fields);
  const fieldsBySection = useMemo(() => {
    const grouped = new Map<string, AwardContractFieldConfig[]>();
    for (const field of fields.filter((entry) => !isTechnicalField(entry) || fieldSection(entry) === 'payload')) {
      const section = fieldSection(field);
      grouped.set(section, [...(grouped.get(section) ?? []), field]);
    }
    return grouped;
  }, [fields]);

  if (!allowed) {
    return <LockedWorkflowPanel title={title} owner={owner} reason={ownerLockedReason(access, owner)} />;
  }

  function setValue(name: string, value: FormValue) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function closeInlineForm() {
    if (saving) return;
    if (selected && isDirty && !confirmAwardContractNavigation()) return;
    setSelected(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = buildAwardContractPayload(fields, values);
    if (next.errors.length > 0) {
      setMessage(next.errors[0]);
      notifyAward('warning', 'Complete required fields', next.errors[0]);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = await onSubmit(next.payload, values);
      setMessage(`${title} saved.`);
      notifyAward('success', `${title} saved`, 'Your changes were saved to the award and contract record.');
      onComplete?.(result);
      clearAwardContractDirtyWork();
      setSelected(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${title} could not be saved.`;
      setMessage(errorMessage);
      notifyAward('error', `${title} could not be saved`, errorMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`award-action-launcher award-action-inline-row${selected ? ' selected' : ''}`} data-award-contract-form={title}>
      <div className="award-action-table-row">
        <div className="award-action-cell award-action-cell-main">
          {eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}
          <h2>{title}</h2>
          <p>{actionDefinition?.group ?? 'Workflow action'}</p>
        </div>
        <div className="award-action-cell">
          <span>Owner</span>
          <strong>{owner === 'ANY' ? 'Shared' : owner === 'BUYER' ? 'Buyer' : owner === 'SUPPLIER' ? 'Supplier' : 'Admin'}</strong>
        </div>
        <div className="award-action-cell">
          <span>Required</span>
          <strong>{counts.required ? `${counts.required} fields` : 'Optional'}</strong>
        </div>
        <div className="award-action-cell">
          <span>Status</span>
          <StatusBadge value={badge} />
        </div>
        <div className="award-action-cell award-action-cell-select">
          <button className="btn btn-primary btn-sm" type="button" aria-expanded={selected} onClick={() => (selected ? closeInlineForm() : setSelected(true))}>
            {selected ? 'Hide' : 'Select'}
          </button>
        </div>
      </div>
      {selected ? (
        <form className="award-action-form award-action-form-inline" aria-labelledby={formTitleId} noValidate onSubmit={submit}>
          <div className="award-inline-form-heading">
            <div>
              {eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}
              <h2 id={formTitleId}>{title}</h2>
              <p>{owner === 'ANY' ? 'Shared workflow action' : owner === 'BUYER' ? 'Buyer-owned workflow action' : owner === 'SUPPLIER' ? 'Supplier-owned workflow action' : 'Admin-owned workflow action'}</p>
            </div>
            <StatusBadge value={badge} />
          </div>
          {drawerSummary ?? children ?? <ActionReviewSummary fields={fields} values={values} />}
          {Array.from(fieldsBySection.entries()).map(([section, sectionFields]) => {
            const content = (
              <div className="award-form-grid">
                {sectionFields.map((field) => (
                  <AwardContractField
                    field={field}
                    formKey={formKey}
                    value={values[field.name] ?? defaultValue(field)}
                    onChange={(value) => setValue(field.name, value)}
                    key={field.name}
                  />
                ))}
              </div>
            );
            if (section === 'payload') {
              return (
                <details className="award-form-section award-form-section-advanced" key={section}>
                  <summary>{sectionLabels[section as keyof typeof sectionLabels]}</summary>
                  {content}
                </details>
              );
            }
            return (
              <section className="award-form-section" key={section}>
                <h3>{sectionLabels[section as keyof typeof sectionLabels]}</h3>
                {content}
              </section>
            );
          })}
          {built.errors.length > 0 ? <p className="panel-note">{built.errors[0]}</p> : null}
          {message ? <p className="panel-note" aria-live="polite">{message}</p> : null}
          <div className="inline-actions award-inline-form-footer">
            <button className="btn btn-primary btn-sm" type="submit" disabled={blocked}>
              {saving ? 'Saving...' : submitLabel}
            </button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => setValues(defaults)}>
              Reset
            </button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={closeInlineForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function AwardContractField({
  field,
  formKey,
  value,
  onChange
}: {
  field: AwardContractFieldConfig;
  formKey: string;
  value: FormValue;
  onChange: (value: FormValue) => void;
}) {
  const id = `award-contract-${formKey}-${field.name}`;
  const [filter, setFilter] = useState('');
  const label = (
    <>
      {field.label}
      {field.required ? <span aria-hidden="true"> *</span> : null}
    </>
  );

  if (field.kind === 'json') {
    return (
      <details className="award-form-field award-form-field-wide">
        <summary>{label}</summary>
        <textarea className="form-input" rows={field.rows ?? 5} id={id} value={String(value)} onChange={(event) => onChange(event.target.value)} />
        {field.note ? <span>{field.note}</span> : null}
      </details>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <label className="award-form-field" htmlFor={id}>
        <span>{label}</span>
        <textarea className="form-input" rows={field.rows ?? 3} id={id} value={String(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
        {field.note ? <em>{field.note}</em> : null}
      </label>
    );
  }

  if (shouldUsePicker(field)) {
    const options = pickerOptions(field);
    const selected = options.find((item) => item.value === String(value));
    const filtered = options.filter((item) => `${item.label} ${item.description ?? ''} ${item.status ?? ''} ${item.value}`.toLowerCase().includes(filter.trim().toLowerCase()));
    return (
      <div className="award-form-field award-picker-field">
        <label htmlFor={`${id}-search`}>
          <span>{label}</span>
        </label>
        <input
          className="form-input"
          id={`${id}-search`}
          type="search"
          value={filter}
          placeholder={selected ? selected.label : field.placeholder ?? 'Search records'}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className="award-picker-list" role="listbox" aria-label={field.label}>
          {filtered.length === 0 ? (
            <button className="award-picker-option" type="button" disabled>No matching records</button>
          ) : filtered.map((item) => (
            <button
              className={`award-picker-option${item.value === String(value) ? ' selected' : ''}`}
              type="button"
              role="option"
              aria-selected={item.value === String(value)}
              onClick={() => {
                onChange(item.value);
                setFilter('');
              }}
              key={item.value}
            >
              <strong>{item.label}</strong>
              <span>{item.description || (item.value ? 'Linked record' : 'No selection')}</span>
              {item.status ? <StatusBadge value={item.status} /> : null}
            </button>
          ))}
        </div>
        {selected ? <em>Selected: {selected.label}</em> : null}
        {field.note ?? field.helpText ? <em>{field.note ?? field.helpText}</em> : null}
      </div>
    );
  }

  if (field.kind === 'select') {
    return (
      <label className="award-form-field" htmlFor={id}>
        <span>{label}</span>
        <select className="form-input" id={id} value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((item) => (
            <option value={item.value} key={item.value}>{item.label}</option>
          ))}
        </select>
        {field.note ?? field.helpText ? <em>{field.note ?? field.helpText}</em> : null}
      </label>
    );
  }

  if (field.kind === 'checkbox') {
    return (
      <label className="award-form-field award-form-checkbox" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }

  if (field.kind === 'multi') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="award-form-field">
        <legend>{label}</legend>
        {(field.options ?? []).map((item) => (
          <label className="award-form-checkbox" key={item.value}>
            <input
              type="checkbox"
              checked={selected.includes(item.value)}
              onChange={(event) => {
                onChange(event.target.checked ? [...selected, item.value] : selected.filter((entry) => entry !== item.value));
              }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  const type = field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : field.kind === 'datetime' ? 'datetime-local' : field.kind === 'password' ? 'password' : 'text';
  return (
    <label className="award-form-field" htmlFor={id}>
      <span>{label}</span>
      <input
        className="form-input"
        id={id}
        type={type}
        min={field.min}
        max={field.max}
        step={field.step}
        value={String(value)}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {field.note ? <em>{field.note}</em> : null}
    </label>
  );
}
