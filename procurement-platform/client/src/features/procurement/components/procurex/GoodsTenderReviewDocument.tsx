/* Renders the procurement Goods Tender Review Document UI while keeping page-specific presentation near its workflow data. */
import { type ReactNode } from 'react';
import { useProfileImagePreview } from '@/features/identity/hooks/useProfileImagePreview';
import {
  goodsTenderDocumentModelFromDraft,
  goodsTenderDocumentModelFromTender,
  isGoodsTenderType,
  type GoodsTenderDocumentModel
} from '../../goodsTenderDocumentModel';
import type { CreateTenderDraft, TenderDetail } from '../../types';

export { isGoodsTenderType };

type GoodsTenderReviewDocumentProps = {
  draft?: CreateTenderDraft;
  tender?: TenderDetail;
  profileOrganization?: string;
};

type DocumentSectionEntry = {
  key: 'goods' | 'samples' | 'financial' | 'eligibility' | 'evaluation' | 'amendments';
  title: string;
  visible: boolean;
};

type DocumentInfoRow = {
  label: string;
  value: ReactNode;
  omitWhenEmpty?: boolean;
};

export function GoodsTenderReviewDocument({ draft, tender, profileOrganization }: GoodsTenderReviewDocumentProps) {
  const { previewUrl } = useProfileImagePreview({
    loadFromProfile: true,
    enabled: Boolean(draft?.procurementTypeId === 'goods')
  });
  const model = draft
    ? goodsTenderDocumentModelFromDraft(draft, profileOrganization, previewUrl || null)
    : goodsTenderDocumentModelFromTender(tender);

  return (
    <div className="supplier-detail-procurement-document goods-dossier-shell">
      <GoodsTenderDocument model={model} />
    </div>
  );
}

function GoodsTenderDocument({ model }: { model: GoodsTenderDocumentModel }) {
  const sections = goodsDocumentSections(model);
  const sectionNumber = (key: DocumentSectionEntry['key']) =>
    String(sections.findIndex((section) => section.key === key) + 1).padStart(2, '0');

  return (
    <article className="goods-tender-document goods-dossier" aria-label="Goods tender summary">
      <TenderIdentityHeader model={model} />
      <RunningHeader model={model} />
      <TenderSummary model={model} />

      <GoodsDetailsSection number={sectionNumber('goods')} model={model} />
      {isSectionVisible(sections, 'samples') ? <SampleRequirementsSection number={sectionNumber('samples')} model={model} /> : null}
      {isSectionVisible(sections, 'financial') ? <FinancialCapacitySection number={sectionNumber('financial')} model={model} /> : null}
      {isSectionVisible(sections, 'eligibility') ? <EligibilitySection number={sectionNumber('eligibility')} model={model} /> : null}
      {isSectionVisible(sections, 'evaluation') ? <EvaluationCriteriaSection number={sectionNumber('evaluation')} model={model} /> : null}
      {isSectionVisible(sections, 'amendments') ? <AmendmentsSection number={sectionNumber('amendments')} model={model} /> : null}

      <DocumentFooter model={model} />
    </article>
  );
}

function TenderIdentityHeader({ model }: { model: GoodsTenderDocumentModel }) {
  const logoUrl = model.organization.logoUrl;
  return (
    <header className={`goods-dossier-cover${logoUrl ? '' : ' is-without-logo'}`}>
      <div className="goods-dossier-cover-grid">
        {logoUrl ? (
          <div className="goods-dossier-logo-block">
            <img src={logoUrl} alt={`${model.organization.name || 'Procuring organization'} logo`} />
          </div>
        ) : null}

        <div className="goods-dossier-title-block">
          <p className="goods-dossier-organization-name">{reviewText(model.organization.name, 'Procuring organization')}</p>
          <p className="goods-dossier-eyebrow">GOODS TENDER</p>
          <h1>{reviewText(model.tender.title, 'Goods Tender')}</h1>
          <div className="goods-dossier-cover-meta">
            <span>
              Tender No. <strong>{reviewText(model.tender.number, 'Pending assignment')}</strong>
            </span>
            <span>{formatProcurementClassification(model.tender.procurementMethod)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function RunningHeader({ model }: { model: GoodsTenderDocumentModel }) {
  return (
    <div className="goods-dossier-print-header" aria-hidden="true">
      {model.organization.logoUrl ? <img src={model.organization.logoUrl} alt="" /> : null}
      <div>
        <strong>{reviewText(model.tender.title, model.organization.name)}</strong>
        <span>{reviewText(model.tender.number, 'Tender number pending')}</span>
      </div>
    </div>
  );
}

function TenderSummary({ model }: { model: GoodsTenderDocumentModel }) {
  return (
    <section className="goods-dossier-summary" aria-labelledby="goods-tender-summary-heading">
      <h2 id="goods-tender-summary-heading">Tender Summary</h2>
      <DocumentInfoGrid
        rows={[
          { label: 'Procuring Organization', value: model.organization.name },
          { label: 'Tender Number', value: model.tender.number || 'Pending assignment' },
          { label: 'Procurement Method', value: procurementMethodLabel(model.tender.procurementMethod) },
          { label: 'Category', value: 'Goods' },
          { label: 'Opening Date', value: formatDocumentDate(model.tender.openingDate), omitWhenEmpty: true },
          { label: 'Closing Date', value: formatDocumentDate(model.tender.closingDate) },
          { label: 'Delivery Point / Location', value: model.tender.deliveryLocation, omitWhenEmpty: true },
          { label: 'Contact Person', value: model.tender.publicContact, omitWhenEmpty: true },
          { label: 'Funding Source', value: model.tender.fundingSource, omitWhenEmpty: true }
        ]}
      />
    </section>
  );
}

function GoodsDetailsSection({ number, model }: { number: string; model: GoodsTenderDocumentModel }) {
  return (
    <DocumentSection number={number} title="Goods Details" id="goods-details">
      <div className="goods-dossier-subsection">
        <h3><span aria-hidden="true">A. </span>Goods List</h3>
        <GoodsListTable goods={model.goods} />
      </div>

      <ProductSpecifications goods={model.goods} />
    </DocumentSection>
  );
}

function GoodsListTable({ goods }: { goods: GoodsTenderDocumentModel['goods'] }) {
  return (
    <DocumentTable
      columns={['Item Name', 'Quantity']}
      numericColumns={[1]}
      rows={goods.map((item) => [reviewText(item.name, 'Goods item'), quantityWithUnit(item.quantity, item.unit)])}
      emptyText="No information provided."
    />
  );
}

function ProductSpecifications({ goods }: { goods: GoodsTenderDocumentModel['goods'] }) {
  if (!goods.length) return <EmptyState />;
  return (
    <div className="goods-dossier-subsection">
      <h3><span aria-hidden="true">B. </span>Product Specifications</h3>
      <div className="goods-dossier-product-stack">
        {goods.map((item, index) => (
          <ProductSpecificationBlock item={item} index={index} key={item.id || item.name || index} />
        ))}
      </div>
    </div>
  );
}

function ProductSpecificationBlock({ item, index }: { item: GoodsTenderDocumentModel['goods'][number]; index: number }) {
  return (
    <article className="goods-dossier-product-spec">
      <span className="goods-dossier-product-index">Item {String(index + 1).padStart(2, '0')}</span>
      <h4>{reviewText(item.name, `Goods item ${index + 1}`)}</h4>
      <DocumentTable
        columns={['Specification', 'Required Value']}
        rows={item.specifications
          .filter((specification) => isMeaningful(specification.name) || isMeaningful(specification.value))
          .map((specification) => [
            reviewText(specification.name, 'Specification'),
            <DocumentValue key={`${item.id}-${specification.name}`} value={specification.value} />
          ])}
        emptyText="No additional product specifications provided."
      />
    </article>
  );
}

function SampleRequirementsSection({ number, model }: { number: string; model: GoodsTenderDocumentModel }) {
  return (
    <DocumentSection number={number} title="Sample Requirements" id="goods-sample-requirements">
      <div className="goods-dossier-info-box">Suppliers are required to submit samples for the items listed below.</div>
      <DocumentTable
        columns={['Item Name', 'Sample Quantity', 'Description', 'Delivery Location', 'Delivery Deadline', 'Sample Returned']}
        numericColumns={[1]}
        rows={model.samples.items.map((row) => [
          reviewText(row.itemName, 'Goods item'),
          quantityWithUnit(row.quantity, row.unit),
          reviewText(row.description),
          reviewText(row.deliveryLocation),
          formatDocumentDate(row.deadline),
          row.willBeReturned ? 'Yes' : 'No'
        ])}
        emptyText="No sample rows configured. Review the tender before publication."
      />
    </DocumentSection>
  );
}

function FinancialCapacitySection({ number, model }: { number: string; model: GoodsTenderDocumentModel }) {
  return (
    <DocumentSection number={number} title="Financial Capacity Requirements" id="goods-financial-capacity">
      <DocumentTable
        columns={['Requirement Type', 'Minimum Value', 'Period', 'Evidence Required']}
        numericColumns={[1]}
        rows={model.financialCapacityRequirements.map((row) => [
          reviewText(row.requirementType),
          reviewText(row.minimumValue),
          reviewText(row.period),
          reviewText(row.evidenceRequired)
        ])}
        emptyText="No information provided."
      />
    </DocumentSection>
  );
}

function EligibilitySection({ number, model }: { number: string; model: GoodsTenderDocumentModel }) {
  const hasRegulatory = model.eligibility.regulatoryLicences.length > 0;
  const hasOther = model.eligibility.otherRequirements.length > 0;
  return (
    <DocumentSection number={number} title="Eligibility Requirements" id="goods-eligibility">
      {hasRegulatory ? (
        <div className="goods-dossier-subsection">
          <h3><span aria-hidden="true">A. </span>Regulatory Licence Requirements</h3>
          <ul className="goods-dossier-checklist">
            {model.eligibility.regulatoryLicences.map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <span aria-hidden="true"></span>
                <div>
                  <strong>{reviewText(row.name)}</strong>
                  {isMeaningful(row.evidence) ? <p>{row.evidence}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasOther ? (
        <div className="goods-dossier-subsection">
          <h3>
            <span aria-hidden="true">{hasRegulatory ? 'B. ' : 'A. '}</span>
            Other Eligibility Requirements
          </h3>
          <div className="goods-dossier-eligibility-list">
            {model.eligibility.otherRequirements.map((row, index) => (
              <article key={`${row.name}-${index}`}>
                <h4>{reviewText(row.name)}</h4>
                {isMeaningful(row.description) ? <p>{row.description}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </DocumentSection>
  );
}

function EvaluationCriteriaSection({ number, model }: { number: string; model: GoodsTenderDocumentModel }) {
  const totalWeight = evaluationTotalWeight(model.evaluationCriteria);
  return (
    <DocumentSection number={number} title="Evaluation Criteria" id="goods-evaluation-criteria">
      <DocumentTable
        columns={['Criteria', 'Sub-criteria', 'Weight']}
        numericColumns={[2]}
        footer={totalWeight ? ['TOTAL', '', totalWeight] : undefined}
        rows={model.evaluationCriteria.map((criterion) => [
          reviewText(criterion.criterion),
          reviewText(criterion.subCriterion),
          formatWeight(criterion.weight)
        ])}
        emptyText="No information provided."
      />
    </DocumentSection>
  );
}

function AmendmentsSection({ number, model }: { number: string; model: GoodsTenderDocumentModel }) {
  return (
    <DocumentSection number={number} title="Amendments" id="goods-amendments">
      <DocumentTable
        columns={['Amendment Number', 'Date of Amendment', 'Description']}
        rows={model.amendments.map((row) => [
          reviewText(row.number),
          formatDocumentDate(row.date),
          reviewText(row.description)
        ])}
        emptyText="No information provided."
      />
    </DocumentSection>
  );
}

function DocumentSection({ number, title, id, children }: { number: string; title: string; id: string; children: ReactNode }) {
  return (
    <section className="goods-dossier-section" id={id}>
      <div className="goods-dossier-section-heading document-section-heading">
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      <div className="goods-dossier-section-divider"></div>
      <div className="goods-dossier-section-body">{children}</div>
    </section>
  );
}

function DocumentInfoGrid({ rows }: { rows: DocumentInfoRow[] }) {
  const visibleRows = rows.filter((row) => !row.omitWhenEmpty || isMeaningful(row.value));
  return (
    <dl className="goods-dossier-info-grid">
      {visibleRows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{isMeaningful(row.value) ? row.value : 'Not specified'}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentTable({
  columns,
  rows,
  emptyText,
  numericColumns = [],
  footer
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyText: string;
  numericColumns?: number[];
  footer?: ReactNode[];
}) {
  if (!rows.length) return <EmptyState text={emptyText} />;
  return (
    <div className="goods-dossier-table-wrap">
      <table className="goods-dossier-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th className={numericColumns.includes(index) ? 'is-numeric' : undefined} key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td className={numericColumns.includes(columnIndex) ? 'is-numeric' : undefined} key={`${column}-${columnIndex}`}>
                  {isMeaningful(row[columnIndex]) ? row[columnIndex] : 'Not specified'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr>
              {columns.map((column, index) => (
                <td className={numericColumns.includes(index) ? 'is-numeric' : undefined} key={`${column}-footer`}>
                  {footer[index] ?? ''}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function DocumentValue({ value }: { value: string | number | boolean | string[] | null | undefined }) {
  if (Array.isArray(value)) {
    const cleanValues = value.map((item) => String(item || '').trim()).filter(Boolean);
    if (!cleanValues.length) return <>Not specified</>;
    if (cleanValues.length > 3 || cleanValues.some((item) => item.length > 40)) {
      return (
        <ul className="goods-dossier-cell-list">
          {cleanValues.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }
    return <>{cleanValues.join(', ')}</>;
  }
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  return <>{reviewText(value)}</>;
}

function EmptyState({ text = 'No information provided.' }: { text?: string }) {
  return <p className="goods-dossier-empty">{text}</p>;
}

function DocumentFooter({ model }: { model: GoodsTenderDocumentModel }) {
  return (
    <footer className="goods-dossier-footer">
      <span>{reviewText(model.tender.publicVersion, 'Version 1.0')}</span>
      <span>Generated by ProcureX</span>
      <span>
        Page <span className="goods-dossier-current-page">1</span> of <span className="goods-dossier-total-pages">1</span>
      </span>
    </footer>
  );
}

function goodsDocumentSections(model: GoodsTenderDocumentModel): DocumentSectionEntry[] {
  const sections: DocumentSectionEntry[] = [
    { key: 'goods', title: 'Goods Details', visible: true },
    { key: 'samples', title: 'Sample Requirements', visible: model.samples.required },
    {
      key: 'financial',
      title: 'Financial Capacity Requirements',
      visible: model.financialCapacityRequirements.length > 0
    },
    {
      key: 'eligibility',
      title: 'Eligibility Requirements',
      visible: model.eligibility.regulatoryLicences.length > 0 || model.eligibility.otherRequirements.length > 0
    },
    { key: 'evaluation', title: 'Evaluation Criteria', visible: model.evaluationCriteria.length > 0 },
    { key: 'amendments', title: 'Amendments', visible: model.amendments.length > 0 }
  ];

  return sections.filter((section) => section.visible);
}

function isSectionVisible(sections: DocumentSectionEntry[], key: DocumentSectionEntry['key']) {
  return sections.some((section) => section.key === key);
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

function isMeaningful(value: ReactNode) {
  if (value === null || value === undefined || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

function reviewText(value: string | number | boolean | null | undefined, fallback = 'Not specified') {
  const text = String(value ?? '').trim();
  return text || fallback;
}
