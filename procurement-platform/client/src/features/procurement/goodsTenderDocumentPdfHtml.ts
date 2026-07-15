import type { GoodsTenderDocumentModel } from './goodsTenderDocumentModel';

type GoodsPdfSectionEntry = {
  key: 'goods' | 'samples' | 'financial' | 'eligibility' | 'evaluation' | 'amendments';
  visible: boolean;
};

export function buildGoodsTenderDocumentPdfHtml(model: GoodsTenderDocumentModel) {
  const sections = goodsPdfSections(model);
  const sectionNumber = (key: GoodsPdfSectionEntry['key']) =>
    String(sections.findIndex((section) => section.key === key) + 1).padStart(2, '0');

  return `
    <article class="goods-tender-document goods-dossier" aria-label="Goods tender document">
      ${renderTenderIdentity(model)}
      ${renderTenderSummary(model)}
      ${renderGoodsDetails(sectionNumber('goods'), model)}
      ${isPdfSectionVisible(sections, 'samples') ? renderSampleRequirements(sectionNumber('samples'), model) : ''}
      ${isPdfSectionVisible(sections, 'financial') ? renderFinancialCapacity(sectionNumber('financial'), model) : ''}
      ${isPdfSectionVisible(sections, 'eligibility') ? renderEligibility(sectionNumber('eligibility'), model) : ''}
      ${isPdfSectionVisible(sections, 'evaluation') ? renderEvaluation(sectionNumber('evaluation'), model) : ''}
      ${isPdfSectionVisible(sections, 'amendments') ? renderAmendments(sectionNumber('amendments'), model) : ''}
      ${renderDocumentFooter(model)}
    </article>
  `;
}

function renderTenderIdentity(model: GoodsTenderDocumentModel) {
  const logo = model.organization.logoUrl
    ? `<div class="goods-dossier-logo-block"><img src="${escapeAttribute(model.organization.logoUrl)}" alt="${escapeAttribute(`${model.organization.name || 'Procuring organization'} logo`)}" /></div>`
    : '';

  return `
    <header class="goods-dossier-cover${model.organization.logoUrl ? '' : ' is-without-logo'}">
      <div class="goods-dossier-cover-grid">
        ${logo}
        <div class="goods-dossier-title-block">
          <p class="goods-dossier-organization-name">${escapeHtml(reviewText(model.organization.name, 'Procuring organization'))}</p>
          <p class="goods-dossier-eyebrow">GOODS TENDER</p>
          <h1>${escapeHtml(reviewText(model.tender.title, 'Goods Tender'))}</h1>
          <div class="goods-dossier-cover-meta">
            <span>Tender No. <strong>${escapeHtml(reviewText(model.tender.number, 'Pending assignment'))}</strong></span>
            <span>${escapeHtml(formatProcurementClassification(model.tender.procurementMethod))}</span>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderTenderSummary(model: GoodsTenderDocumentModel) {
  return `
    <section class="goods-dossier-summary" aria-labelledby="goods-tender-summary-heading">
      <h2 id="goods-tender-summary-heading">Tender Summary</h2>
      ${renderInfoGrid([
        { label: 'Procuring Organization', value: model.organization.name },
        { label: 'Tender Number', value: model.tender.number || 'Pending assignment' },
        { label: 'Procurement Method', value: procurementMethodLabel(model.tender.procurementMethod) },
        { label: 'Category', value: 'Goods' },
        { label: 'Opening Date', value: formatDocumentDate(model.tender.openingDate), omitWhenEmpty: true },
        { label: 'Closing Date', value: formatDocumentDate(model.tender.closingDate) },
        { label: 'Delivery Point / Location', value: model.tender.deliveryLocation, omitWhenEmpty: true },
        { label: 'Contact Person', value: model.tender.publicContact, omitWhenEmpty: true },
        { label: 'Funding Source', value: model.tender.fundingSource, omitWhenEmpty: true }
      ])}
    </section>
  `;
}

function renderGoodsDetails(number: string, model: GoodsTenderDocumentModel) {
  return renderSection(number, 'Goods Details', `
    <div class="goods-dossier-subsection">
      <h3>A. Goods List</h3>
      ${renderTable(['Item Name', 'Quantity'], model.goods.map((item) => [
        reviewText(item.name, 'Goods item'),
        quantityWithUnit(item.quantity, item.unit)
      ]), { numericColumns: [1] })}
    </div>
    <div class="goods-dossier-subsection">
      <h3>B. Product Specifications</h3>
      <div class="goods-dossier-product-stack">
        ${model.goods.length ? model.goods.map((item, index) => `
          <article class="goods-dossier-product-spec">
            <span class="goods-dossier-product-index">Item ${String(index + 1).padStart(2, '0')}</span>
            <h4>${escapeHtml(reviewText(item.name, `Goods item ${index + 1}`))}</h4>
            ${renderTable(
              ['Specification', 'Required Value'],
              item.specifications
                .filter((specification) => isMeaningful(specification.name) || isMeaningful(specification.value))
                .map((specification) => [
                  reviewText(specification.name, 'Specification'),
                  formatDocumentValue(specification.value)
                ]),
              { emptyText: 'No additional product specifications provided.' }
            )}
          </article>
        `).join('') : renderEmptyState('No information provided.')}
      </div>
    </div>
  `);
}

function renderSampleRequirements(number: string, model: GoodsTenderDocumentModel) {
  return renderSection(number, 'Sample Requirements', `
    <div class="goods-dossier-info-box">Suppliers are required to submit samples for the items listed below.</div>
    ${renderTable(
      ['Item Name', 'Sample Quantity', 'Description', 'Delivery Location', 'Delivery Deadline', 'Sample Returned'],
      model.samples.items.map((row) => [
        reviewText(row.itemName, 'Goods item'),
        quantityWithUnit(row.quantity, row.unit),
        reviewText(row.description),
        reviewText(row.deliveryLocation),
        formatDocumentDate(row.deadline),
        row.willBeReturned ? 'Yes' : 'No'
      ]),
      { numericColumns: [1], emptyText: 'No sample rows configured. Review the tender before publication.' }
    )}
  `);
}

function renderFinancialCapacity(number: string, model: GoodsTenderDocumentModel) {
  return renderSection(number, 'Financial Capacity Requirements', renderTable(
    ['Requirement Type', 'Minimum Value', 'Period', 'Evidence Required'],
    model.financialCapacityRequirements.map((row) => [
      reviewText(row.requirementType),
      reviewText(row.minimumValue),
      reviewText(row.period),
      reviewText(row.evidenceRequired)
    ]),
    { numericColumns: [1] }
  ));
}

function renderEligibility(number: string, model: GoodsTenderDocumentModel) {
  const hasRegulatory = model.eligibility.regulatoryLicences.length > 0;
  const hasOther = model.eligibility.otherRequirements.length > 0;
  return renderSection(number, 'Eligibility Requirements', `
    ${hasRegulatory ? `
      <div class="goods-dossier-subsection">
        <h3>A. Regulatory Licence Requirements</h3>
        <ul class="goods-dossier-checklist">
          ${model.eligibility.regulatoryLicences.map((row) => `
            <li>
              <span aria-hidden="true"></span>
              <div>
                <strong>${escapeHtml(reviewText(row.name))}</strong>
                ${isMeaningful(row.evidence) ? `<p>${escapeHtml(String(row.evidence))}</p>` : ''}
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
    ${hasOther ? `
      <div class="goods-dossier-subsection">
        <h3>${hasRegulatory ? 'B. Other Eligibility Requirements' : 'A. Other Eligibility Requirements'}</h3>
        <div class="goods-dossier-eligibility-list">
          ${model.eligibility.otherRequirements.map((row) => `
            <article>
              <h4>${escapeHtml(reviewText(row.name))}</h4>
              ${isMeaningful(row.description) ? `<p>${escapeHtml(String(row.description))}</p>` : ''}
            </article>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `);
}

function renderEvaluation(number: string, model: GoodsTenderDocumentModel) {
  const totalWeight = evaluationTotalWeight(model.evaluationCriteria);
  return renderSection(number, 'Evaluation Criteria', renderTable(
    ['Criteria', 'Sub-criteria', 'Weight'],
    model.evaluationCriteria.map((criterion) => [
      reviewText(criterion.criterion),
      reviewText(criterion.subCriterion),
      formatWeight(criterion.weight)
    ]),
    { numericColumns: [2], footer: totalWeight ? ['TOTAL', '', totalWeight] : undefined }
  ));
}

function renderAmendments(number: string, model: GoodsTenderDocumentModel) {
  return renderSection(number, 'Amendments', renderTable(
    ['Amendment Number', 'Date of Amendment', 'Description'],
    model.amendments.map((row) => [
      reviewText(row.number),
      formatDocumentDate(row.date),
      reviewText(row.description)
    ])
  ));
}

function renderSection(number: string, title: string, content: string) {
  return `
    <section class="goods-dossier-section">
      <div class="goods-dossier-section-heading document-section-heading">
        <span>${escapeHtml(number)}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="goods-dossier-section-divider"></div>
      <div class="goods-dossier-section-body">${content}</div>
    </section>
  `;
}

function renderInfoGrid(rows: Array<{ label: string; value: unknown; omitWhenEmpty?: boolean }>) {
  const visibleRows = rows.filter((row) => !row.omitWhenEmpty || isMeaningful(row.value));
  return `
    <dl class="goods-dossier-info-grid">
      ${visibleRows.map((row) => `
        <div>
          <dt>${escapeHtml(row.label)}</dt>
          <dd>${escapeHtml(isMeaningful(row.value) ? String(row.value) : 'Not specified')}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderTable(
  columns: string[],
  rows: string[][],
  options: { numericColumns?: number[]; footer?: string[]; emptyText?: string } = {}
) {
  if (!rows.length) return renderEmptyState(options.emptyText || 'No information provided.');
  const numericColumns = options.numericColumns || [];
  return `
    <div class="goods-dossier-table-wrap">
      <table class="goods-dossier-table">
        <thead>
          <tr>${columns.map((column, index) => `<th scope="col" class="${numericColumns.includes(index) ? 'is-numeric' : ''}">${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column, index) => `
                <td class="${numericColumns.includes(index) ? 'is-numeric' : ''}">${escapeHtml(isMeaningful(row[index]) ? row[index] : 'Not specified')}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
        ${options.footer ? `
          <tfoot>
            <tr>${columns.map((column, index) => `<td class="${numericColumns.includes(index) ? 'is-numeric' : ''}">${escapeHtml(options.footer?.[index] || '')}</td>`).join('')}</tr>
          </tfoot>
        ` : ''}
      </table>
    </div>
  `;
}

function renderDocumentFooter(model: GoodsTenderDocumentModel) {
  return `
    <footer class="goods-dossier-footer">
      <span>${escapeHtml(reviewText(model.tender.publicVersion, 'Version 1.0'))}</span>
      <span>Generated by ProcureX</span>
      <span>Page <span class="goods-dossier-current-page">1</span> of <span class="goods-dossier-total-pages">1</span></span>
    </footer>
  `;
}

function renderEmptyState(text: string) {
  return `<p class="goods-dossier-empty">${escapeHtml(text)}</p>`;
}

function goodsPdfSections(model: GoodsTenderDocumentModel): GoodsPdfSectionEntry[] {
  const sections: GoodsPdfSectionEntry[] = [
    { key: 'goods', visible: true },
    { key: 'samples', visible: model.samples.required },
    { key: 'financial', visible: model.financialCapacityRequirements.length > 0 },
    { key: 'eligibility', visible: model.eligibility.regulatoryLicences.length > 0 || model.eligibility.otherRequirements.length > 0 },
    { key: 'evaluation', visible: model.evaluationCriteria.length > 0 },
    { key: 'amendments', visible: model.amendments.length > 0 }
  ];

  return sections.filter((section) => section.visible);
}

function isPdfSectionVisible(sections: GoodsPdfSectionEntry[], key: GoodsPdfSectionEntry['key']) {
  return sections.some((section) => section.key === key);
}

function formatDocumentValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return reviewText(value);
}

function formatProcurementClassification(method: string) {
  return `${procurementMethodLabel(method)} - Goods`;
}

function procurementMethodLabel(method: string) {
  return /invited|restricted/i.test(method) ? 'Invited Tender' : 'Open Tender';
}

function formatDocumentDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  const hasTime = /[T\s]\d{1,2}:\d{2}/.test(raw);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(hasTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {})
  }).format(parsed);
}

function quantityWithUnit(quantity: unknown, unit: unknown) {
  const quantityText = String(quantity ?? '').trim();
  const unitText = String(unit ?? '').trim();
  if (!quantityText && !unitText) return '';
  return [formatComparableNumber(quantityText), unitText].filter(Boolean).join(' ');
}

function formatComparableNumber(value: string) {
  const numeric = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(numeric) || value === '') return value;
  if (!/^-?\d+(\.\d+)?$/.test(value.replace(/,/g, ''))) return value;
  return numeric.toLocaleString('en-US');
}

function evaluationTotalWeight(criteria: GoodsTenderDocumentModel['evaluationCriteria']) {
  const numericWeights = criteria
    .map((criterion) => Number(String(criterion.weight ?? '').replace('%', '').trim()))
    .filter((value) => Number.isFinite(value));
  if (!numericWeights.length) return '';
  return `${numericWeights.reduce((sum, value) => sum + value, 0)}%`;
}

function formatWeight(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.includes('%') ? text : `${text}%`;
}

function reviewText(value: unknown, fallback = 'Not specified') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== '';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
