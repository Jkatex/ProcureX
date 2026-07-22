/* Supports the procurement client workflow with reusable logic kept close to the screens that consume it. */
import html2pdf from 'html2pdf.js';
import {
  consultancyTenderDocumentModelFromTender,
  isConsultancyTenderType
} from './consultancyTenderDocumentModel';
import { buildConsultancyTenderDocumentPdfHtml } from './consultancyTenderDocumentPdfHtml';
import {
  goodsTenderDocumentModelFromTender,
  isGoodsTenderType
} from './goodsTenderDocumentModel';
import { buildGoodsTenderDocumentPdfHtml } from './goodsTenderDocumentPdfHtml';
import type { TenderDetail } from './types';

const pdfOptions = {
  margin: [8, 8, 10, 8] as [number, number, number, number],
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  pagebreak: { mode: ['css', 'legacy'] }
};

const goodsPdfOptions = {
  ...pdfOptions,
  margin: [16, 18, 16, 18] as [number, number, number, number],
  pagebreak: { mode: ['css', 'legacy', 'avoid-all'] }
};

const privateOrRuntimeKeys = new Set([
  'activity',
  'bidSummary',
  'buyerOrgId',
  'canBid',
  'createdByCurrentUser',
  'currentBid',
  'hasDraftBid',
  'hasSubmittedBid',
  'isSaved',
  'ownedByCurrentOrganization',
  'ownerUserId'
]);

const renderedTopLevelKeys = new Set([
  'budget',
  'category',
  'categories',
  'closingDate',
  'commercialItems',
  'contractType',
  'currency',
  'description',
  'documents',
  'id',
  'location',
  'metadata',
  'method',
  'milestones',
  'organization',
  'ownerOrganization',
  'publishedAt',
  'reference',
  'requirementRows',
  'requirements',
  'status',
  'title',
  'type',
  'visibility'
]);

export async function generateTenderPackPdfBlob(tender: TenderDetail) {
  const container = createTenderPackContainer(tender);

  try {
    const result = await html2pdf()
      .set({ ...(isGoodsTenderType(tender.type) ? goodsPdfOptions : pdfOptions), filename: generatedTenderPackFilename(tender) })
      .from(container.firstElementChild as HTMLElement)
      .outputPdf('blob');

    return normalizePdfBlob(result);
  } finally {
    container.remove();
  }
}

export function createTenderPackContainer(tender: TenderDetail) {
  const container = document.createElement('div');
  container.className = 'procurex-pdf-render-root';
  container.innerHTML = buildTenderPackPdfHtml(tender);
  document.body.appendChild(container);
  return container;
}

export function buildTenderPackPdfHtml(tender: TenderDetail) {
  if (isGoodsTenderType(tender.type)) {
    return buildGoodsTenderDocumentPdfHtml(goodsTenderDocumentModelFromTender(tender));
  }

  if (isConsultancyTenderType(tender.type)) {
    return buildConsultancyTenderDocumentPdfHtml(consultancyTenderDocumentModelFromTender(tender));
  }

  const generatedAt = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());

  return `
    <article class="procurex-tender-pdf" data-tender-pack-reference="${escapeHtml(tender.reference || tender.id)}">
      <header class="procurex-pdf-cover">
        <div>
          <span class="procurex-pdf-kicker">ProcureX Tender Pack</span>
          <h1>${escapeHtml(tender.title || 'Tender document')}</h1>
          <p>${escapeHtml(tender.organization || tender.ownerOrganization || 'Procuring entity')}</p>
        </div>
        <div class="procurex-pdf-stamp">
          <strong>${escapeHtml(formatStatus(tender.status))}</strong>
          <span>${escapeHtml(formatStatus(tender.type))}</span>
        </div>
      </header>

      ${renderInfoTable([
        { label: 'Tender title', value: tender.title },
        { label: 'Reference', value: tender.reference || tender.id },
        { label: 'Buyer / Procuring entity', value: tender.organization || tender.ownerOrganization },
        { label: 'Procurement method', value: tender.method },
        { label: 'Procurement type', value: tender.type },
        { label: 'Status', value: tender.status },
        { label: 'Visibility', value: tender.visibility },
        { label: 'Budget', value: formatMoney(tender.budget, tender.currency) },
        { label: 'Currency', value: tender.currency },
        { label: 'Location', value: tender.location },
        { label: 'Categories', value: tender.categories?.length ? tender.categories.join(', ') : tender.category },
        { label: 'Contract type', value: tender.contractType },
        { label: 'Published date', value: formatDate(tender.publishedAt) },
        { label: 'Closing date', value: formatDate(tender.closingDate) },
        { label: 'Generated', value: generatedAt }
      ])}

      ${renderSection('1', 'Tender Description and Submission Details', `
        <p>${escapeHtml(tender.description || 'No tender description was provided.')}</p>
        ${renderMatchedDetails('Submission fields', [tender.requirements, tender.metadata], /submi|deadline|opening|clarification|validity|bid/i)}
      `)}
      ${renderSection('2', 'Buyer Requirements', `
        ${renderNamedValue('Requirements', tender.requirements)}
        ${renderRequirementRows(tender.requirementRows)}
      `)}
      ${renderSection('3', 'Tender Configuration and Type-Specific Details', `
        ${renderNamedValue('Metadata', tender.metadata)}
        ${renderMatchedDetails('Type-specific requirement groups', [tender.requirements, tender.metadata], /works|goods|service|consultancy|technical|scope|specification|deliverable|personnel|equipment|drawing|boq|tor/i)}
      `)}
      ${renderSection('4', 'Eligibility, Compliance, Evaluation, and Submission Fields', `
        ${renderMatchedDetails('Eligibility and compliance', [tender.requirements, tender.metadata], /eligib|compliance|license|regulatory|certificate|tax|registration|qualification|financial/i)}
        ${renderMatchedDetails('Evaluation fields', [tender.requirements, tender.metadata], /evaluation|criteria|criterion|score|weight|pass|fail/i)}
      `)}
      ${renderSection('5', 'Commercial Items', renderCommercialItems(tender))}
      ${renderSection('6', 'Milestones and Key Dates', renderMilestones(tender))}
      ${renderSection('7', 'Documents and Annexes', renderDocuments(tender))}
      ${renderSection('8', 'Additional Buyer-Provided Details', renderAdditionalDetails(tender))}
    </article>
  `;
}

export function generatedTenderPackFilename(tender: TenderDetail) {
  if (isGoodsTenderType(tender.type)) {
    return `Tender_${sanitizeFilename(tender.reference || tender.title || tender.id || 'Tender')}_Goods.pdf`;
  }
  if (isConsultancyTenderType(tender.type)) {
    return `Tender_${sanitizeFilename(tender.reference || tender.title || tender.id || 'Tender')}_Consultancy.pdf`;
  }
  return `${sanitizeFilename(tender.reference || tender.title || tender.id || 'tender')}-tender-pack.pdf`;
}

function renderSection(number: string, title: string, content: string) {
  return `
    <section class="procurex-pdf-section">
      <div class="procurex-pdf-section-title">
        <span>${escapeHtml(number)}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="procurex-pdf-section-body">${content}</div>
    </section>
  `;
}

function renderInfoTable(rows: Array<{ label: string; value: unknown }>) {
  const visibleRows = rows.filter((row) => isMeaningful(row.value));
  if (!visibleRows.length) return '<p class="procurex-pdf-empty">No information configured.</p>';

  return `
    <table class="procurex-pdf-info-table">
      <tbody>
        ${visibleRows.map((row) => `
          <tr>
            <th>${escapeHtml(row.label)}</th>
            <td>${renderValue(row.value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderNamedValue(title: string, value: unknown) {
  if (!isMeaningful(value)) return `<p class="procurex-pdf-empty">No ${escapeHtml(title.toLowerCase())} configured.</p>`;
  return `<h3>${escapeHtml(title)}</h3>${renderValue(value)}`;
}

function renderRequirementRows(rows: TenderDetail['requirementRows']) {
  if (!rows?.some(isMeaningful)) return '<p class="procurex-pdf-empty">No requirement rows configured.</p>';
  return `
    <h3>Requirement rows</h3>
    <table class="procurex-pdf-table">
      <thead><tr><th>Section</th><th>Requirement</th><th>Details</th></tr></thead>
      <tbody>
        ${rows.filter(isMeaningful).map((row) => `
          <tr>
            <td>${escapeHtml(row.section || 'Requirement')}</td>
            <td>${escapeHtml(valueTitle(row.payload, row.section || 'Requirement'))}</td>
            <td>${escapeHtml(compactValue(row.payload))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderCommercialItems(tender: TenderDetail) {
  const items = tender.commercialItems ?? [];
  if (!items.some(isMeaningful)) return '<p class="procurex-pdf-empty">No commercial schedule configured.</p>';

  return `
    <table class="procurex-pdf-table procurex-pdf-commercial-table">
      <thead>
        <tr><th>Code</th><th>Requirement</th><th>Qty / Duration</th><th>Unit</th><th>Rate / Estimate</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${items.filter(isMeaningful).map((item, index) => `
          <tr>
            <td>${escapeHtml(item.itemNo || `${index + 1}.1`)}</td>
            <td>${escapeHtml(item.description || valueTitle(item.payload, 'Tender requirement'))}</td>
            <td>${escapeHtml(item.quantity || 1)}</td>
            <td>${escapeHtml(item.unit || 'Lot')}</td>
            <td>${escapeHtml(item.rate ? formatMoney(item.rate, tender.currency) : 'Supplier priced')}</td>
            <td>${escapeHtml(item.total ? formatMoney(item.total, tender.currency) : item.rate ? formatMoney((item.quantity || 1) * item.rate, tender.currency) : 'Supplier priced')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderMilestones(tender: TenderDetail) {
  const rows = [
    { id: 'published', name: 'Tender published', dueDate: tender.publishedAt, payload: {} },
    ...(tender.milestones ?? []),
    { id: 'closing', name: 'Submission deadline', dueDate: tender.closingDate, payload: {} }
  ].filter(isMeaningful);

  if (!rows.length) return '<p class="procurex-pdf-empty">No milestones configured.</p>';

  return `
    <table class="procurex-pdf-table">
      <thead><tr><th>Milestone</th><th>Date</th><th>Details</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.name || 'Milestone')}</td>
            <td>${escapeHtml(formatDate(row.dueDate))}</td>
            <td>${escapeHtml(compactValue(row.payload))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderDocuments(tender: TenderDetail) {
  const documents = tender.documents ?? [];
  if (!documents.some(isMeaningful)) return '<p class="procurex-pdf-empty">No uploaded tender documents or annexes are listed.</p>';

  return `
    <table class="procurex-pdf-table">
      <thead><tr><th>Document</th><th>Type</th><th>Label</th></tr></thead>
      <tbody>
        ${documents.filter(isMeaningful).map((document) => `
          <tr>
            <td>${escapeHtml(document.name)}</td>
            <td>${escapeHtml(formatStatus(document.documentType))}</td>
            <td>${escapeHtml(document.label || 'Available for review')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAdditionalDetails(tender: TenderDetail) {
  const additional = Object.entries(tender as Record<string, unknown>)
    .filter(([key, value]) => !privateOrRuntimeKeys.has(key) && !renderedTopLevelKeys.has(key) && isMeaningful(value));

  if (!additional.length) return '<p class="procurex-pdf-empty">No additional buyer-provided details were found.</p>';
  return renderInfoTable(additional.map(([key, value]) => ({ label: humanize(key), value })));
}

function renderMatchedDetails(title: string, sources: unknown[], matcher: RegExp) {
  const rows = sources.flatMap((source) => flattenMatchedValues(source, matcher));
  if (!rows.length) return `<p class="procurex-pdf-empty">No ${escapeHtml(title.toLowerCase())} configured.</p>`;
  return `<h3>${escapeHtml(title)}</h3>${renderInfoTable(rows.map((row) => ({ label: row.label, value: row.value })))}`;
}

function flattenMatchedValues(value: unknown, matcher: RegExp, path: string[] = []): Array<{ label: string; value: unknown }> {
  if (!isMeaningful(value)) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenMatchedValues(item, matcher, [...path, `Item ${index + 1}`]));
  }
  if (typeof value !== 'object') return matcher.test(path.join(' ')) ? [{ label: path.map(humanize).join(' / '), value }] : [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const nextPath = [...path, key];
    const ownMatch = matcher.test(nextPath.join(' '));
    if (ownMatch && isMeaningful(child)) return [{ label: nextPath.map(humanize).join(' / '), value: child }];
    return flattenMatchedValues(child, matcher, nextPath);
  });
}

function renderValue(value: unknown): string {
  if (!isMeaningful(value)) return '<span class="procurex-pdf-muted">Not specified</span>';
  if (Array.isArray(value)) return renderArray(value);
  if (typeof value === 'object') return renderObject(value as Record<string, unknown>);
  return `<span>${escapeHtml(formatScalar(value))}</span>`;
}

function renderArray(values: unknown[]) {
  const meaningfulValues = values.filter(isMeaningful);
  if (!meaningfulValues.length) return '<p class="procurex-pdf-empty">No items configured.</p>';
  if (meaningfulValues.every((value) => typeof value !== 'object')) {
    return `<ul class="procurex-pdf-list">${meaningfulValues.map((value) => `<li>${escapeHtml(formatScalar(value))}</li>`).join('')}</ul>`;
  }

  return meaningfulValues.map((value, index) => `
    <div>
      <h3>${escapeHtml(typeof value === 'object' && value ? valueTitle(value as Record<string, unknown>, `Item ${index + 1}`) : `Item ${index + 1}`)}</h3>
      ${renderValue(value)}
    </div>
  `).join('');
}

function renderObject(value: Record<string, unknown>) {
  const entries = Object.entries(value).filter(([, child]) => isMeaningful(child));
  if (!entries.length) return '<p class="procurex-pdf-empty">No information configured.</p>';

  const scalarRows = entries.filter(([, child]) => !Array.isArray(child) && (child === null || typeof child !== 'object'));
  const complexRows = entries.filter(([, child]) => Array.isArray(child) || (child !== null && typeof child === 'object'));

  return `
    ${scalarRows.length ? renderInfoTable(scalarRows.map(([key, child]) => ({ label: humanize(key), value: child }))) : ''}
    ${complexRows.map(([key, child]) => `<h3>${escapeHtml(humanize(key))}</h3>${renderValue(child)}`).join('')}
  `;
}

function compactValue(value: unknown): string {
  if (!isMeaningful(value)) return 'Not specified';
  if (Array.isArray(value)) return value.map(compactValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, child]) => isMeaningful(child));
    const summary = entries
      .filter(([, child]) => !Array.isArray(child) && (child === null || typeof child !== 'object'))
      .slice(0, 4)
      .map(([key, child]) => `${humanize(key)}: ${formatScalar(child)}`)
      .join(' / ');
    return summary || valueTitle(value as Record<string, unknown>, 'Configured');
  }
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

function normalizePdfBlob(value: unknown) {
  if (value instanceof Blob) {
    return value.type === 'application/pdf' ? value : value.slice(0, value.size, 'application/pdf');
  }
  return new Blob([value instanceof ArrayBuffer ? value : String(value ?? '')], { type: 'application/pdf' });
}

function formatMoney(value: unknown, currency = 'TZS') {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || !amount) return '';
  return `${currency || 'TZS'} ${Math.round(amount).toLocaleString('en-US')}`;
}

function formatDate(value: unknown) {
  if (!value) return '';
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function formatStatus(value: unknown) {
  return String(value || 'Not set')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatScalar(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '');
}

function humanize(value: string) {
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

function sanitizeFilename(filename: string) {
  return Array.from(filename)
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
