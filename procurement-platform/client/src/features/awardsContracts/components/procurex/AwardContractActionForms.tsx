import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { StatusBadge } from './AwardsContractsProcurexShared';

export type FieldOption = {
  label: string;
  value: string;
};

export type AwardContractFieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'uuid'
  | 'currency'
  | 'json'
  | 'multi';

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

export function option(value: string, label = displayLabel(value)): FieldOption {
  return { value, label };
}

export function displayLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function itemOptions(items: Array<{ id: string; title?: string; type?: string; status?: string }>, emptyLabel = 'Select record') {
  return [
    option('', emptyLabel),
    ...items.map((item) => option(item.id, `${item.title || item.id}${item.status ? ` (${item.status})` : ''}`))
  ];
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

export function buildAwardContractPayload(fields: AwardContractFieldConfig[], values: AwardContractFormValues) {
  const payload: AwardContractPayload = {};
  const errors: string[] = [];

  for (const field of fields) {
    const raw = values[field.name] ?? defaultValue(field);
    if (field.required && isBlank(raw)) errors.push(`${field.label} is required.`);

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

export function ActionFormPanel({
  title,
  eyebrow,
  badge = 'Form',
  fields,
  initialValues,
  submitLabel = 'Submit',
  onSubmit,
  onComplete,
  children
}: ActionFormPanelProps) {
  const formKey = useMemo(() => slug(title), [title]);
  const defaults = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, initialValues?.[field.name] ?? defaultValue(field)])) as AwardContractFormValues,
    [fields, initialValues]
  );
  const [values, setValues] = useState<AwardContractFormValues>(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setValues(defaults);
    setMessage('');
  }, [defaults]);

  const built = buildAwardContractPayload(fields, values);
  const blocked = saving || built.errors.length > 0;

  function setValue(name: string, value: FormValue) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = buildAwardContractPayload(fields, values);
    if (next.errors.length > 0) {
      setMessage(next.errors[0]);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = await onSubmit(next.payload, values);
      setMessage(`${title} saved.`);
      onComplete?.(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${title} could not be saved.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="award-action-form" data-award-contract-form={title} noValidate onSubmit={submit}>
      <div className="panel-heading">
        <div>
          {eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        <StatusBadge value={badge} />
      </div>
      {children}
      <div className="award-form-grid">
        {fields.map((field) => (
          <AwardContractField
            field={field}
            formKey={formKey}
            value={values[field.name] ?? defaultValue(field)}
            onChange={(value) => setValue(field.name, value)}
            key={field.name}
          />
        ))}
      </div>
      {built.errors.length > 0 ? <p className="panel-note">{built.errors[0]}</p> : null}
      {message ? <p className="panel-note" aria-live="polite">{message}</p> : null}
      <div className="inline-actions">
        <button className="btn btn-primary btn-sm" type="submit" disabled={blocked}>
          {saving ? 'Saving...' : submitLabel}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => setValues(defaults)}>
          Reset
        </button>
      </div>
    </form>
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

  if (field.kind === 'select') {
    return (
      <label className="award-form-field" htmlFor={id}>
        <span>{label}</span>
        <select className="form-input" id={id} value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((item) => (
            <option value={item.value} key={item.value}>{item.label}</option>
          ))}
        </select>
        {field.note ? <em>{field.note}</em> : null}
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

  const type = field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : field.kind === 'datetime' ? 'datetime-local' : 'text';
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
