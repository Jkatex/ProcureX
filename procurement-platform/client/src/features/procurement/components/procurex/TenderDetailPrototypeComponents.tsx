import { useState, type ReactNode } from 'react';
import type { TenderDetail } from '../../types';

export type PrototypeTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export function PrototypeTabs({
  tabs,
  defaultTabId,
  variant = 'supplier'
}: {
  tabs: PrototypeTab[];
  defaultTabId: string;
  variant?: 'supplier' | 'buyer';
}) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  return (
    <section className="supplier-detail-tabbed-view">
      <div className={variant === 'buyer' ? 'supplier-detail-tabs buyer-detail-tabs' : 'supplier-detail-tabs'} role="tablist">
        {tabs.map((tab) => (
          <button
            className={`supplier-detail-tab ${tab.id === activeTab.id ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab.id}
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="supplier-detail-tab-panels">
        <section className="supplier-detail-tab-panel" role="tabpanel" aria-label={activeTab.label}>
          {activeTab.content}
        </section>
      </div>
    </section>
  );
}

export function TenderDocumentSection({
  number,
  title,
  kicker,
  children,
  aside,
  id
}: {
  number: string;
  title: string;
  kicker: string;
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <article className="tender-document-section" id={id}>
      <div className="tender-document-section-heading">
        <span>{number}</span>
        <div>
          <small>{kicker}</small>
          <h3>{title}</h3>
        </div>
        {aside}
      </div>
      <div className="tender-document-section-body">{children}</div>
    </article>
  );
}

export function DetailSummary({ rows, compact = false }: { rows: Array<{ label: string; value: unknown }>; compact?: boolean }) {
  const meaningfulRows = rows.filter((row) => isMeaningful(row.value));
  if (!meaningfulRows.length) return <div className="scope-empty">No summary information configured.</div>;
  return (
    <div className={`record-summary tender-detail-summary ${compact ? 'compact' : ''}`}>
      {meaningfulRows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong>{formatScalar(row.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function DetailBadges({ items, emptyText = 'Not specified' }: { items: unknown; emptyText?: string }) {
  const values = normalizeList(items).map((item) => (typeof item === 'object' ? valueTitle(item as Record<string, unknown>, '') : String(item).trim())).filter(Boolean);
  if (!values.length) return <div className="scope-empty">{emptyText}</div>;
  return (
    <div className="tender-detail-chip-list">
      {values.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function DetailValue({ value }: { value: unknown }) {
  if (!isMeaningful(value)) return <span className="tender-detail-muted">Not specified</span>;
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== 'object')) return <DetailBadges items={value} />;
    return <DetailObjectList items={value} />;
  }
  if (typeof value === 'object') return <DetailObject item={value as Record<string, unknown>} />;
  return <span>{formatScalar(value)}</span>;
}

export function DetailFieldCards({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields).filter(([, value]) => isMeaningful(value));
  if (!entries.length) return <div className="scope-empty">No structured requirement fields configured.</div>;
  return (
    <div className="tender-detail-field-grid">
      {entries.map(([key, value]) => (
        <article className="tender-detail-field-card" key={key}>
          <span>{humanize(key)}</span>
          <DetailValue value={value} />
        </article>
      ))}
    </div>
  );
}

export function CommercialTable({ tender, priceLabel = 'Rate / Estimate' }: { tender: TenderDetail; priceLabel?: string }) {
  const rows = tender.commercialItems ?? [];
  if (!rows.length) return <div className="scope-empty">No commercial schedule configured.</div>;
  return (
    <div className="data-table tender-detail-table">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Requirement</th>
            <th>Qty / Duration</th>
            <th>Unit</th>
            <th>{priceLabel}</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{row.itemNo || `${index + 1}.1`}</td>
              <td>{row.description || 'Tender requirement'}</td>
              <td>{row.quantity || 1}</td>
              <td>{row.unit || 'Lot'}</td>
              <td>{row.rate ? formatMoney(row.rate, tender.currency) : 'Supplier priced'}</td>
              <td>{row.total ? formatMoney(row.total, tender.currency) : row.rate ? formatMoney((row.quantity || 1) * row.rate, tender.currency) : 'Supplier priced'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentCards({ tender, emptyText = 'No tender documents configured.' }: { tender: TenderDetail; emptyText?: string }) {
  const documents = tender.documents ?? [];
  if (!documents.length) return <div className="scope-empty">{emptyText}</div>;
  return (
    <div className="attachment-grid tender-detail-attachment-grid">
      {documents.map((document) => (
        <div className="attachment-card" key={document.id}>
          <strong>{document.name}</strong>
          <span>{document.label || document.documentType || 'Available for review'}</span>
          <div className="attachment-actions">
            <button className="btn btn-secondary" type="button">
              View
            </button>
            <button className="btn btn-secondary" type="button">
              Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RequirementCards({ tender, includeJsonRequirements = true }: { tender: TenderDetail; includeJsonRequirements?: boolean }) {
  const rows = tender.requirementRows ?? [];
  const requirementEntries = includeJsonRequirements ? Object.entries(tender.requirements ?? {}).filter(([, value]) => isMeaningful(value)) : [];
  if (!rows.length && !requirementEntries.length) return <div className="scope-empty">No structured requirement fields configured.</div>;
  return (
    <div className="tender-detail-card-list">
      {rows.map((row) => (
        <article className="supplier-requirement-preview" key={row.id}>
          <span>{row.section}</span>
          <strong>{valueTitle(row.payload, row.section)}</strong>
          <p>{payloadSummary(row.payload)}</p>
        </article>
      ))}
      {requirementEntries.map(([key, value]) => (
        <article className="supplier-requirement-preview" key={key}>
          <span>{humanize(key)}</span>
          <DetailValue value={value} />
        </article>
      ))}
    </div>
  );
}

export function TimelineList({ tender }: { tender: TenderDetail }) {
  const rows = [
    { id: 'published', name: 'Tender published', dueDate: tender.publishedAt || '' },
    ...(tender.milestones ?? []),
    { id: 'closing', name: 'Submission deadline', dueDate: tender.closingDate }
  ];
  return (
    <div className="supplier-timeline-list">
      {rows.map((row) => (
        <div className="timeline-row" key={row.id}>
          <span>{formatDate(row.dueDate || '')}</span>
          <strong>{row.name}</strong>
          <span className="badge badge-info">{row.id === 'closing' ? 'Deadline' : 'Milestone'}</span>
        </div>
      ))}
    </div>
  );
}

function DetailObjectList({ items }: { items: unknown[] }) {
  const meaningfulItems = items.filter(isMeaningful);
  if (!meaningfulItems.length) return <div className="scope-empty">No items configured.</div>;
  const objectItems = meaningfulItems.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
  const keys = [...new Set(objectItems.flatMap((item) => Object.keys(item).filter((key) => isMeaningful(item[key]))))].slice(0, 6);

  if (objectItems.length === meaningfulItems.length && keys.length && meaningfulItems.length > 1) {
    return (
      <div className="data-table tender-detail-table">
        <table>
          <thead>
            <tr>{keys.map((key) => <th key={key}>{humanize(key)}</th>)}</tr>
          </thead>
          <tbody>
            {objectItems.map((item, index) => (
              <tr key={String(item.id ?? index)}>
                {keys.map((key) => (
                  <td key={key}>{formatCompactValue(item[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="tender-detail-card-list">
      {meaningfulItems.map((item, index) => (
        <article className="supplier-requirement-preview" key={index}>
          <span>{`Item ${index + 1}`}</span>
          <strong>{typeof item === 'object' ? valueTitle(item as Record<string, unknown>, `Item ${index + 1}`) : formatScalar(item)}</strong>
          {typeof item === 'object' ? <DetailObject item={item as Record<string, unknown>} /> : null}
        </article>
      ))}
    </div>
  );
}

function DetailObject({ item }: { item: Record<string, unknown> }) {
  const entries = Object.entries(item).filter(([, value]) => isMeaningful(value));
  if (!entries.length) return <div className="scope-empty">No information configured.</div>;
  return (
    <div className="tender-detail-object">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{humanize(key)}</span>
          <strong>{formatCompactValue(value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function tenderCategories(tender: TenderDetail) {
  return Array.isArray(tender.categories) && tender.categories.length ? tender.categories : [tender.category || tender.type].filter(Boolean);
}

export function tenderStatusBadgeClass(tender: TenderDetail) {
  return /closed|awarded|archived/i.test(tender.status) ? 'badge-info' : 'badge-success';
}

export function daysRemaining(closingDate: string) {
  const closingTime = Date.parse(`${closingDate}T23:59:59`);
  if (!Number.isFinite(closingTime)) return 0;
  return Math.max(0, Math.ceil((closingTime - Date.now()) / 86400000));
}

export function isPastTender(tender: TenderDetail) {
  return /closed|awarded|cancelled/i.test(tender.status) || daysRemaining(tender.closingDate) === 0;
}

export function requirementCounts(tender: TenderDetail) {
  const rowCount = tender.requirementRows?.length ?? 0;
  const jsonCount = Object.values(tender.requirements ?? {}).filter(isMeaningful).length;
  const documentCount = tender.documents?.length ?? 0;
  const mandatory = rowCount + documentCount;
  const optional = Math.max(0, jsonCount - rowCount);
  return { mandatory, optional };
}

export function formatStatus(value: string) {
  return String(value || 'Not set')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTenderType(value: string) {
  if (value === 'SERVICE') return 'Non Consultancy';
  return formatStatus(value);
}

export function formatMoney(value: number, currency = 'TZS') {
  return `${currency || 'TZS'} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

export function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

export function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (typeof value === 'object') return Object.values(value).some(isMeaningful);
  return String(value).trim() !== '';
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatScalar(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '');
}

function formatCompactValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? valueTitle(item as Record<string, unknown>, '') : formatScalar(item))).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return valueTitle(value as Record<string, unknown>, 'Configured');
  return formatScalar(value);
}

function valueTitle(value: Record<string, unknown>, fallback = 'Item') {
  return String(
    [
      value.title,
      value.name,
      value.documentTitle,
      value.requirementName,
      value.deliverableName,
      value.activityTitle,
      value.positionTitle,
      value.position,
      value.milestone,
      value.workItem,
      value.itemDescription,
      value.productDescription,
      value.equipmentName,
      value.serviceTask,
      value.objectiveTitle,
      value.referenceName,
      value.reportType,
      value.license,
      value.text
    ].find(isMeaningful) || fallback
  );
}

function payloadSummary(payload: Record<string, unknown>) {
  return (
    Object.entries(payload)
      .filter(([key, value]) => key !== 'id' && isMeaningful(value))
      .slice(0, 4)
      .map(([key, value]) => `${humanize(key)}: ${formatCompactValue(value)}`)
      .join(' / ') || 'Buyer requirement'
  );
}
