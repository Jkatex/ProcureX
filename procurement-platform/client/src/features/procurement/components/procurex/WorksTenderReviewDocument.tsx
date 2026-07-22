/* Renders the procurement Works Tender Review Document UI while keeping page-specific presentation near its workflow data. */
import { type ReactNode } from 'react';
import { useProfileImagePreview } from '@/features/identity/hooks/useProfileImagePreview';
import { createEmptyWorksRequirements } from '../../createTenderConfig';
import type {
  CreateTenderDraft,
  CreateTenderEvaluationCriterion,
  CreateTenderFinancialRequirementRow,
  CreateTenderRegulatoryLicenseRequirementRow,
  CreateTenderWorksBoqRow,
  CreateTenderWorksDrawingRow,
  CreateTenderWorksMilestoneRow,
  CreateTenderWorksRequirements,
  CreateTenderWorksSpecificationDocumentRow,
  TenderDetail,
  TenderDetailDocument
} from '../../types';

type WorksTenderReviewDocumentProps = {
  draft?: CreateTenderDraft;
  tender?: TenderDetail;
  profileOrganization?: string;
  onOpenDocument?: (document: TenderDetailDocument) => void;
  onDownloadDocument?: (document: TenderDetailDocument) => void;
};

type WorksReviewData = {
  title: string;
  description: string;
  organization: string;
  logoUrl?: string;
  reference: string;
  method: string;
  openingDate?: string;
  closingDate?: string;
  location: string;
  contactPerson: string;
  contactPhone: string;
  fundingSource: string;
  requirements: CreateTenderWorksRequirements;
  technicalSpecificationDocuments: WorksReviewDocumentRow[];
  drawingDesignDocuments: WorksReviewDocumentRow[];
  siteSurveyDocuments: WorksReviewDocumentRow[];
  financialRequirements: CreateTenderFinancialRequirementRow[];
  regulatoryLicenseRequirements: CreateTenderRegulatoryLicenseRequirementRow[];
  evaluationCriteria: CreateTenderEvaluationCriterion[];
  amendments: WorksReviewAmendment[];
};

type WorksReviewDocumentRow = {
  id: string;
  title: string;
  uploadedDocument: string;
  category?: string;
  document?: TenderDetailDocument;
};

type WorksReviewAmendment = {
  reference?: string;
  amendmentNumber?: string;
  number?: string;
  publishedAt?: string;
  date?: string;
  updatedAt?: string;
  createdAt?: string;
  summary?: string;
  description?: string;
  title?: string;
};

export function isWorksTenderType(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '') === 'works';
}

export function WorksTenderReviewDocument({
  draft,
  tender,
  profileOrganization,
  onOpenDocument,
  onDownloadDocument
}: WorksTenderReviewDocumentProps) {
  const { previewUrl } = useProfileImagePreview({ loadFromProfile: true, enabled: Boolean(draft?.procurementTypeId === 'works') });
  const data = draft ? worksReviewDataFromDraft(draft, profileOrganization, previewUrl || undefined) : worksReviewDataFromTender(tender);
  const works = data.requirements;
  const technicalCapacityRows = worksTechnicalCapacityRows(works);

  return (
    <div className="supplier-detail-procurement-document goods-review-document-wrap works-review-document-wrap">
      <section className="tender-document-view supplier-procurement-full-document goods-review-document works-review-document">
        <header className="tender-document-cover goods-review-cover">
          <div>
            <span className="section-kicker">Works procurement details</span>
            <h2>{data.title || 'Works tender review'}</h2>
            <p>{data.description || 'Review the full works procurement detail document before preparing or approving this tender.'}</p>
          </div>
          <div className="goods-review-logo-card" aria-label="Organization Logo">
            <span>Organization Logo</span>
            <img src={data.logoUrl || '/assets/logo.svg'} alt={`${data.organization} logo`} />
          </div>
        </header>

        <section className="goods-review-top-page" aria-label="Works tender summary">
          <div className="goods-review-meta-grid">
            <WorksReviewMeta label="Procuring Organization" value={data.organization} />
            <WorksReviewMeta label="Tender Title" value={data.title} />
            <WorksReviewMeta label="Tender Number" value={data.reference || 'Pending assignment'} />
            <WorksReviewMeta label="Procurement Category" value="Works" />
            <WorksReviewMeta label="Procurement Method" value={worksProcurementMethodLabel(data.method)} />
            <WorksReviewMeta label="Opening Date" value={formatWorksReviewDate(data.openingDate)} />
            <WorksReviewMeta label="Closing Date" value={formatWorksReviewDate(data.closingDate)} />
            <WorksReviewMeta label="Contact Person" value={data.contactPerson} />
            <WorksReviewMeta label="Contact Phone Number" value={data.contactPhone} />
            <WorksReviewMeta label="Funding Source" value={data.fundingSource} />
            <WorksReviewMeta label="Delivery Point / Location" value={data.location} />
          </div>
        </section>

        <WorksReviewSection number="1" title="Scope of Work" kicker="Works description">
          <p className="goods-review-section-intro">{reviewText(works.scopeSummary || data.description)}</p>
        </WorksReviewSection>

        <WorksReviewSection number="2" title="Main Activities" kicker="Activities to be carried out">
          <WorksReviewTable
            columns={['Activity']}
            rows={works.mainConstructionActivities.map((activity) => [reviewText(activity)])}
            emptyText="No main activities added yet."
          />
        </WorksReviewSection>

        <WorksReviewSection number="3" title="Technical Specifications" kicker="Buyer uploads">
          <WorksReviewTable
            columns={['Document title', 'Uploaded document']}
            rows={data.technicalSpecificationDocuments.map((row) => [
              reviewText(row.title),
              <WorksDocumentCell key={row.id} row={row} onOpenDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
            ])}
            emptyText="No technical specification documents uploaded yet."
          />
        </WorksReviewSection>

        <WorksReviewSection number="4" title="Drawings and Design Documents" kicker="Buyer uploads">
          <WorksReviewTable
            columns={['Document title', 'Uploaded document']}
            rows={data.drawingDesignDocuments.map((row) => [
              reviewText(row.title),
              <WorksDocumentCell key={row.id} row={row} onOpenDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
            ])}
            emptyText="No drawings or design documents uploaded yet."
          />
        </WorksReviewSection>

        <WorksReviewSection number="5" title="Bill of Quantities" kicker="Commercial schedule">
          <WorksReviewTable
            columns={['No.', 'Description', 'Unit', 'Quantity', 'Rate', 'Total']}
            rows={works.boqRows.map((row, index) => [
              String(index + 1),
              reviewText(row.description),
              reviewText(row.unit),
              formatNumberLike(row.quantity),
              formatNumberLike(row.rate),
              worksBoqTotal(row)
            ])}
            emptyText="No bill of quantities rows added yet."
          />
        </WorksReviewSection>

        <WorksReviewSection number="6" title="Time Schedule and Milestones" kicker="Implementation timeline">
          <div className="goods-review-subsection">
            <WorksReviewFieldGrid
              rows={[
                ['Commencement day', formatWorksReviewDate(works.commencementDate)],
                ['Completion period', works.worksCompletionPeriod || works.completionPeriod]
              ]}
            />
          </div>
          <div className="goods-review-subsection">
            <h4>Milestones</h4>
            <WorksReviewTable
              columns={['Milestone title', 'Target date']}
              rows={works.worksMilestoneRows.map((row) => [reviewText(row.milestone), formatWorksReviewDate(row.targetDate)])}
              emptyText="No works milestones added yet."
            />
          </div>
        </WorksReviewSection>

        <WorksReviewSection number="7" title="Site Visit" kicker="Site access requirements">
          <WorksReviewFieldGrid rows={[['Site visit requirement', works.siteVisitRequirement]]} />
          {works.siteVisitRequirement === 'Not mandatory' ? (
            <div className="goods-review-subsection">
              <h4>Site Survey Documents</h4>
              <WorksReviewTable
                columns={['Document title', 'Uploaded document']}
                rows={data.siteSurveyDocuments.map((row) => [
                  reviewText(row.title),
                  <WorksDocumentCell key={row.id} row={row} onOpenDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
                ])}
                emptyText="No site survey documents uploaded yet."
              />
            </div>
          ) : null}
        </WorksReviewSection>

        <WorksReviewSection number="8" title="Technical Capacity" kicker="Bidder upload requirements">
          <WorksReviewTable
            columns={['Requirement', 'Evidence bidders must upload']}
            rows={technicalCapacityRows}
            emptyText="No technical capacity upload requirements configured."
          />
        </WorksReviewSection>

        <WorksReviewSection number="9" title="Financial Capacity Requirements" kicker="Bidder financial evidence">
          <WorksReviewTable
            columns={['Requirement type', 'Minimum value', 'Period', 'Evidence required']}
            rows={data.financialRequirements.map((row) => [
              reviewText(row.requirementType),
              reviewText(row.minimumValue),
              reviewText(row.period),
              reviewText(row.evidenceRequired)
            ])}
            emptyText="No financial capacity requirements added yet."
          />
        </WorksReviewSection>

        <WorksReviewSection number="10" title="Regulatory License Requirements" kicker="Licenses and compliance">
          <WorksReviewTable
            columns={['License', 'Issuing body', 'Mandatory', 'Expiry validation']}
            rows={data.regulatoryLicenseRequirements.map((row) => [reviewText(row.license), reviewText(row.body), yesNo(row.mandatory), yesNo(row.expiryRequired)])}
            emptyText="No regulatory license requirements added yet."
          />
        </WorksReviewSection>

        <WorksReviewSection number="11" title="Evaluation Criteria" kicker="Bid evaluation basis">
          <WorksReviewTable
            columns={['Criteria', 'Sub-criterias', 'Weight']}
            rows={data.evaluationCriteria.map((criterion) => [
              reviewText(criterion.label || criterionName(criterion)),
              reviewText(criterionSubcriteria(criterion)),
              `${Number(criterion.weight || 0)}%`
            ])}
            emptyText="No evaluation criteria configured yet."
          />
        </WorksReviewSection>

        {data.amendments.length ? (
          <WorksReviewSection number="12" title="Amendments" kicker="Published tender changes">
            <WorksReviewTable
              columns={['Amendment number', 'Date of amendment', 'Description of amendment']}
              rows={data.amendments.map((row, index) => [
                row.reference || row.amendmentNumber || row.number || `Amendment ${index + 1}`,
                formatWorksReviewDate(row.publishedAt || row.date || row.updatedAt || row.createdAt || ''),
                row.summary || row.description || row.title || 'Amendment details not specified'
              ])}
              emptyText="No amendments have been made."
            />
          </WorksReviewSection>
        ) : null}
      </section>
    </div>
  );
}

function worksReviewDataFromDraft(draft: CreateTenderDraft, profileOrganization?: string, profileLogoUrl?: string): WorksReviewData {
  const works = normalizeWorksRequirements(draft.worksRequirements);
  return {
    title: draft.title || works.projectName,
    description: 'Review the buyer-facing works procurement details before submitting the tender for approval and publication.',
    organization: works.procuringEntity || draft.procuringEntity || profileOrganization || 'Procuring organization',
    logoUrl: profileLogoUrl,
    reference: draft.reference,
    method: draft.method,
    openingDate: draft.openingDate,
    closingDate: draft.submissionDate,
    location: works.location || draft.location,
    contactPerson: draft.contact.name,
    contactPhone: draft.contact.phone,
    fundingSource: draft.fundingSource === 'Other' ? draft.customFundingSource || 'Other' : draft.fundingSource,
    requirements: works,
    technicalSpecificationDocuments: worksTechnicalSpecificationDocumentsFromDraft(works.technicalSpecificationDocuments),
    drawingDesignDocuments: worksDrawingDocumentsFromDraft(works.drawingDesignRows),
    siteSurveyDocuments: worksSiteSurveyDocumentsFromDraft(works),
    financialRequirements: draft.financialRequirements,
    regulatoryLicenseRequirements: draft.regulatoryLicenseRequirements,
    evaluationCriteria: draft.evaluationCriteria,
    amendments: worksReviewAmendments(draft)
  };
}

function worksReviewDataFromTender(tender: TenderDetail | undefined): WorksReviewData {
  const requirements = objectValue(tender?.requirements);
  const metadata = objectValue(tender?.metadata);
  const fields = objectValue(objectValue(requirements.works).fields);
  const publication = objectValue(metadata.publication);
  const contact = objectValue(metadata.contact);
  const works = normalizeWorksRequirements({
    ...fields,
    ...objectValue(metadata.worksRequirements),
    ...objectValue(requirements.worksRequirements)
  });
  const normalizedWorks: CreateTenderWorksRequirements = {
    ...works,
    projectName: works.projectName || tender?.title || '',
    scopeSummary: works.scopeSummary || tender?.description || '',
    location: works.location || tender?.location || '',
    boqRows: works.boqRows.length ? works.boqRows : tenderCommercialBoqRows(tender),
    worksMilestoneRows: works.worksMilestoneRows.length ? works.worksMilestoneRows : tenderMilestoneRows(tender)
  };
  const documents = tender?.documents ?? [];

  return {
    title: tender?.title || normalizedWorks.projectName || '',
    description: tender?.description || 'Review the full works procurement detail document before preparing a bid.',
    organization: normalizedWorks.procuringEntity || stringValue(metadata.procuringEntity) || tenderOrganization(tender),
    logoUrl: tender?.buyerLogoUrl,
    reference: tender?.reference || tender?.id || '',
    method: stringValue(metadata.method) || tender?.method || tender?.visibility || 'Open Tender',
    openingDate: stringValue(publication.openingDate) || tender?.openingDate,
    closingDate: tender?.closingDate,
    location: normalizedWorks.location,
    contactPerson: stringValue(contact.name),
    contactPhone: stringValue(contact.phone),
    fundingSource: stringValue(metadata.fundingSource),
    requirements: normalizedWorks,
    technicalSpecificationDocuments: worksTechnicalSpecificationDocumentsFromTender(normalizedWorks.technicalSpecificationDocuments, documents),
    drawingDesignDocuments: worksDrawingDocumentsFromTender(normalizedWorks.drawingDesignRows, documents),
    siteSurveyDocuments: worksSiteSurveyDocumentsFromTender(normalizedWorks, documents),
    financialRequirements: typedRows<CreateTenderFinancialRequirementRow>(firstArray(requirements.financialRequirements, fields.financialRequirementRows)),
    regulatoryLicenseRequirements: typedRows<CreateTenderRegulatoryLicenseRequirementRow>(firstArray(requirements.regulatoryLicenseRequirements, fields.regulatoryLicenseRequirementRows)),
    evaluationCriteria: tenderEvaluationCriteria(tender, requirements, metadata),
    amendments: worksReviewAmendments(tender)
  };
}

function WorksReviewSection({
  number,
  title,
  kicker,
  children
}: {
  number: string;
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <article className="tender-document-section goods-review-section works-review-section">
      <div className="tender-document-section-heading">
        <span>{number}</span>
        <div>
          <small>{kicker}</small>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="tender-document-section-body">{children}</div>
    </article>
  );
}

function WorksReviewMeta({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{reviewText(value)}</strong>
    </div>
  );
}

function WorksReviewFieldGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
  const meaningfulRows = rows.filter(([, value]) => isMeaningful(value));
  if (!meaningfulRows.length) return <div className="scope-empty">No information configured.</div>;
  return (
    <div className="consultancy-review-field-grid works-review-field-grid">
      {meaningfulRows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value || 'Not specified'}</strong>
        </div>
      ))}
    </div>
  );
}

function WorksReviewTable({
  columns,
  rows,
  emptyText
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  if (!rows.length) return <div className="scope-empty">{emptyText}</div>;
  return (
    <div className="data-table tender-detail-table goods-review-table works-review-table">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => <td key={`${column}-${columnIndex}`}>{row[columnIndex] ?? 'Not specified'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorksDocumentCell({
  row,
  onOpenDocument,
  onDownloadDocument
}: {
  row: WorksReviewDocumentRow;
  onOpenDocument?: (document: TenderDetailDocument) => void;
  onDownloadDocument?: (document: TenderDetailDocument) => void;
}) {
  if (!row.document) {
    return (
      <div className="consultancy-document-cell works-document-cell">
        <strong>{reviewText(row.uploadedDocument)}</strong>
        <span>No uploaded file linked</span>
      </div>
    );
  }

  return (
    <div className="consultancy-document-cell works-document-cell">
      <strong>{reviewText(row.uploadedDocument || row.document.name)}</strong>
      {row.category ? <span>{row.category}</span> : null}
      <div className="consultancy-document-actions works-document-actions">
        <button className="btn btn-secondary" type="button" onClick={() => onOpenDocument?.(row.document as TenderDetailDocument)}>
          Open
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => onDownloadDocument?.(row.document as TenderDetailDocument)}>
          Download
        </button>
      </div>
    </div>
  );
}

function normalizeWorksRequirements(value: unknown): CreateTenderWorksRequirements {
  const record = objectValue(value);
  const empty = createEmptyWorksRequirements();
  return {
    ...empty,
    projectName: stringValue(record.projectName),
    procuringEntity: stringValue(record.procuringEntity),
    location: stringValue(record.location),
    contractType: stringValue(record.contractType),
    customContractType: stringValue(record.customContractType),
    completionPeriod: stringValue(record.completionPeriod),
    scopeSummary: stringValue(record.scopeSummary),
    mainConstructionActivities: stringArray(record.mainConstructionActivities),
    technicalSpecificationDocuments: typedRows<CreateTenderWorksSpecificationDocumentRow>(record.technicalSpecificationDocuments),
    drawingDesignRows: typedRows<CreateTenderWorksDrawingRow>(record.drawingDesignRows),
    lumpSumPricingRows: typedRows<CreateTenderWorksRequirements['lumpSumPricingRows'][number]>(record.lumpSumPricingRows),
    boqRows: typedRows<CreateTenderWorksBoqRow>(record.boqRows),
    commencementDate: stringValue(record.commencementDate),
    worksCompletionPeriod: stringValue(record.worksCompletionPeriod),
    worksMilestoneRows: typedRows<CreateTenderWorksMilestoneRow>(record.worksMilestoneRows),
    siteVisitRequirement: normalizeSiteVisitRequirement(record.siteVisitRequirement),
    siteSurveyUploadName: stringValue(record.siteSurveyUploadName),
    similarCompletedProjectsRequired: booleanValue(record.similarCompletedProjectsRequired),
    keyPersonnelCvsRequired: booleanValue(record.keyPersonnelCvsRequired),
    bankStatementsRequired: booleanValue(record.bankStatementsRequired),
    bankStatementPeriod: stringValue(record.bankStatementPeriod)
  };
}

function worksTechnicalSpecificationDocumentsFromDraft(rows: CreateTenderWorksSpecificationDocumentRow[]): WorksReviewDocumentRow[] {
  return rows
    .map((row, index) => {
      const title = worksSpecificationTitle(row, index);
      const uploadedDocument = row.uploadName || title;
      if (!row.uploadName && !title) return null;
      const document = draftDocument(`draft-works-technical-document-${index + 1}`, uploadedDocument, title);
      return { id: row.id || document.id, title, uploadedDocument, category: 'Technical specification', document };
    })
    .filter(Boolean) as WorksReviewDocumentRow[];
}

function worksDrawingDocumentsFromDraft(rows: CreateTenderWorksDrawingRow[]): WorksReviewDocumentRow[] {
  return rows
    .map((row, index) => {
      const title = worksDrawingTitle(row, index);
      const uploadedDocument = row.uploadName || title;
      if (!row.uploadName && !title) return null;
      const document = draftDocument(`draft-works-drawing-document-${index + 1}`, uploadedDocument, title);
      return { id: row.id || document.id, title, uploadedDocument, category: 'Drawing or design', document };
    })
    .filter(Boolean) as WorksReviewDocumentRow[];
}

function worksSiteSurveyDocumentsFromDraft(works: CreateTenderWorksRequirements): WorksReviewDocumentRow[] {
  if (!works.siteSurveyUploadName) return [];
  const document = draftDocument('draft-works-site-survey-document', works.siteSurveyUploadName, 'Site survey document');
  return [{ id: document.id, title: 'Site survey document', uploadedDocument: works.siteSurveyUploadName, category: 'Site survey', document }];
}

function worksTechnicalSpecificationDocumentsFromTender(rows: CreateTenderWorksSpecificationDocumentRow[], documents: TenderDetailDocument[]): WorksReviewDocumentRow[] {
  const usedDocumentIds = new Set<string>();
  return rows
    .map((row, index) => {
      const title = worksSpecificationTitle(row, index);
      const document = findMatchingDocument([row.uploadName, title, row.documentTitle, row.customDocumentTitle], documents, usedDocumentIds);
      if (document) usedDocumentIds.add(document.id);
      const uploadedDocument = row.uploadName || document?.name || title;
      if (!title && !uploadedDocument) return null;
      return {
        id: row.id || document?.id || `works-technical-document-${index + 1}`,
        title: title || document?.label || document?.name || `Technical specification ${index + 1}`,
        uploadedDocument: uploadedDocument || 'Not specified',
        category: 'Technical specification',
        document
      };
    })
    .filter(Boolean) as WorksReviewDocumentRow[];
}

function worksDrawingDocumentsFromTender(rows: CreateTenderWorksDrawingRow[], documents: TenderDetailDocument[]): WorksReviewDocumentRow[] {
  const usedDocumentIds = new Set<string>();
  return rows
    .map((row, index) => {
      const title = worksDrawingTitle(row, index);
      const document = findMatchingDocument([row.uploadName, title, row.documentType, row.otherDocumentName], documents, usedDocumentIds);
      if (document) usedDocumentIds.add(document.id);
      const uploadedDocument = row.uploadName || document?.name || title;
      if (!title && !uploadedDocument) return null;
      return {
        id: row.id || document?.id || `works-drawing-document-${index + 1}`,
        title: title || document?.label || document?.name || `Drawing or design document ${index + 1}`,
        uploadedDocument: uploadedDocument || 'Not specified',
        category: 'Drawing or design',
        document
      };
    })
    .filter(Boolean) as WorksReviewDocumentRow[];
}

function worksSiteSurveyDocumentsFromTender(works: CreateTenderWorksRequirements, documents: TenderDetailDocument[]): WorksReviewDocumentRow[] {
  if (!works.siteSurveyUploadName) return [];
  const document = findMatchingDocument([works.siteSurveyUploadName, 'site survey', 'survey'], documents, new Set<string>());
  return [{
    id: document?.id || 'works-site-survey-document',
    title: 'Site survey document',
    uploadedDocument: works.siteSurveyUploadName || document?.name || 'Site survey document',
    category: 'Site survey',
    document
  }];
}

function draftDocument(id: string, name: string, label: string): TenderDetailDocument {
  return {
    id,
    name,
    documentType: 'DRAFT_ATTACHMENT',
    label
  };
}

function worksSpecificationTitle(row: CreateTenderWorksSpecificationDocumentRow, index: number) {
  if (row.documentTitle === 'Others') return row.customDocumentTitle || row.uploadName || `Technical specification ${index + 1}`;
  return row.documentTitle || row.uploadName || `Technical specification ${index + 1}`;
}

function worksDrawingTitle(row: CreateTenderWorksDrawingRow, index: number) {
  if (row.documentType === 'Other') return row.otherDocumentName || row.uploadName || `Drawing or design document ${index + 1}`;
  return row.documentType || row.uploadName || `Drawing or design document ${index + 1}`;
}

function worksTechnicalCapacityRows(works: CreateTenderWorksRequirements): ReactNode[][] {
  const rows: ReactNode[][] = [];
  if (works.similarCompletedProjectsRequired) {
    rows.push(['Similar completed projects', 'Bidder must upload documents showing similar completed projects.']);
  }
  if (works.keyPersonnelCvsRequired) {
    rows.push(['Key personnel CVs', 'Bidder must upload CVs for key personnel.']);
  }
  if (works.bankStatementsRequired) {
    rows.push(['Bank statement', works.bankStatementPeriod ? `Bidder must upload bank statements for ${works.bankStatementPeriod}.` : 'Bidder must upload bank statements.']);
  }
  return rows;
}

function tenderCommercialBoqRows(tender: TenderDetail | undefined): CreateTenderWorksBoqRow[] {
  return (tender?.commercialItems ?? []).map((row, index) => ({
    id: row.id || `works-boq-${index + 1}`,
    description: row.description || `BOQ line ${index + 1}`,
    unit: row.unit || '',
    quantity: stringValue(row.quantity),
    rate: stringValue(row.rate)
  }));
}

function tenderMilestoneRows(tender: TenderDetail | undefined): CreateTenderWorksMilestoneRow[] {
  return (tender?.milestones ?? []).map((row, index) => {
    const payload = objectValue(row.payload);
    return {
      id: row.id || `works-milestone-${index + 1}`,
      milestone: row.name || stringValue(payload.title) || `Milestone ${index + 1}`,
      targetDate: row.dueDate || stringValue(payload.targetDate)
    };
  });
}

function tenderEvaluationCriteria(tender: TenderDetail | undefined, requirements: Record<string, unknown>, metadata: Record<string, unknown>) {
  const rows = firstArray(metadata.evaluationCriteria, requirements.evaluationCriteria);
  if (rows.length) return typedRows<CreateTenderEvaluationCriterion>(rows).map(normalizeEvaluationCriterion);
  return (tender?.requirementRows ?? [])
    .filter((row) => row.section.toLowerCase() === 'evaluation')
    .map((row, index) => normalizeEvaluationCriterion({ id: row.id, ...row.payload, weight: numberFromValue(row.payload.weight) || 0, label: stringValue(row.payload.title) || `Criteria ${index + 1}` }));
}

function normalizeEvaluationCriterion(value: unknown): CreateTenderEvaluationCriterion {
  const record = objectValue(value);
  const fallbackId = stringValue(record.label) || stringValue(record.name) || stringValue(record.criterion) || stringValue(record.title) || 'criterion';
  return {
    id: stringValue(record.id) || fallbackId,
    label: stringValue(record.label) || stringValue(record.name) || stringValue(record.criterion) || stringValue(record.title) || 'Criteria',
    weight: numberFromValue(record.weight) || 0,
    notes: stringValue(record.notes) || stringValue(record.description),
    suggestedFor: ['works'],
    subcriteria: stringArray(record.subcriteria)
  };
}

function criterionName(criterion: CreateTenderEvaluationCriterion) {
  return stringValue((criterion as unknown as Record<string, unknown>).criterion) || stringValue((criterion as unknown as Record<string, unknown>).name);
}

function criterionSubcriteria(criterion: CreateTenderEvaluationCriterion) {
  const subcriteria = stringArray(criterion.subcriteria);
  return subcriteria.length ? subcriteria.join(', ') : criterion.notes || criterion.description || '';
}

function worksBoqTotal(row: CreateTenderWorksBoqRow) {
  const quantity = numberFromValue(row.quantity);
  const rate = numberFromValue(row.rate);
  if (quantity === null || rate === null) return 'Not specified';
  return formatNumber(quantity * rate);
}

function formatNumberLike(value: string | number | undefined) {
  const parsed = numberFromValue(value);
  return parsed === null ? reviewText(value) : formatNumber(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function findMatchingDocument(terms: Array<string | undefined>, documents: TenderDetailDocument[], usedDocumentIds: Set<string>) {
  const normalizedTerms = terms.map((term) => stringValue(term).toLowerCase()).filter(Boolean);
  if (!normalizedTerms.length) return undefined;
  return documents.find((document) => {
    if (usedDocumentIds.has(document.id)) return false;
    const name = stringValue(document.name).toLowerCase();
    const label = stringValue(document.label).toLowerCase();
    const documentType = stringValue(document.documentType).toLowerCase();
    return normalizedTerms.some((term) => name.includes(term) || term.includes(name) || label.includes(term) || documentType.includes(term));
  });
}

function normalizeSiteVisitRequirement(value: unknown): CreateTenderWorksRequirements['siteVisitRequirement'] {
  return stringValue(value).toLowerCase() === 'mandatory' ? 'Mandatory' : 'Not mandatory';
}

function worksReviewAmendments(source: unknown): WorksReviewAmendment[] {
  const value = objectValue(source);
  return typedRows<WorksReviewAmendment>(firstArray(value.amendments, value.amendmentRows));
}

function worksProcurementMethodLabel(method: string) {
  return /invited|restricted/i.test(method) ? 'Invited' : 'Open';
}

function formatWorksReviewDate(value: string | undefined) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return 'Not specified';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function tenderOrganization(tender: TenderDetail | undefined) {
  const buyerName = stringValue((tender as unknown as { buyerName?: string })?.buyerName);
  return buyerName || tender?.organization || tender?.ownerOrganization || 'Procuring organization';
}

function isMeaningful(value: ReactNode) {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function reviewText(value: string | number | undefined, fallback = 'Not specified') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function yesNo(value: boolean | undefined) {
  return value ? 'Yes' : 'No';
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  return /^(true|yes|1)$/i.test(stringValue(value));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return String(value ?? '').trim();
}

function numberFromValue(value: unknown) {
  const parsed = Number(stringValue(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean);
  return stringValue(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function typedRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === 'object') as T[]) : [];
}

function firstArray(...values: unknown[]) {
  return values.find((value): value is unknown[] => Array.isArray(value) && value.length > 0) ?? [];
}
