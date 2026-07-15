import { type ReactNode } from 'react';
import { useProfileImagePreview } from '@/features/identity/hooks/useProfileImagePreview';
import {
  consultancyTenderDocumentModelFromDraft,
  consultancyTenderDocumentModelFromTender,
  isConsultancyTenderType,
  type ConsultancyTenderDocumentAttachment,
  type ConsultancyTenderDocumentModel
} from '../../consultancyTenderDocumentModel';
import type { CreateTenderDraft, TenderDetail, TenderDetailDocument } from '../../types';

export { isConsultancyTenderType };

type ConsultancyTenderReviewDocumentProps = {
  draft?: CreateTenderDraft;
  tender?: TenderDetail;
  profileOrganization?: string;
  onOpenDocument?: (document: TenderDetailDocument) => void;
  onDownloadDocument?: (document: TenderDetailDocument) => void;
};

type InfoRow = {
  label: string;
  value: ReactNode;
  omitWhenEmpty?: boolean;
};

type QualificationSubsection = {
  key: string;
  title: string;
  visible: boolean;
  content: ReactNode;
};

export function ConsultancyTenderReviewDocument({
  draft,
  tender,
  profileOrganization,
  onOpenDocument,
  onDownloadDocument
}: ConsultancyTenderReviewDocumentProps) {
  const { previewUrl } = useProfileImagePreview({
    loadFromProfile: true,
    enabled: Boolean(draft?.procurementTypeId === 'consultancy')
  });
  const model = draft
    ? consultancyTenderDocumentModelFromDraft(draft, profileOrganization, previewUrl || null)
    : consultancyTenderDocumentModelFromTender(tender);

  return (
    <div className="supplier-detail-procurement-document goods-dossier-shell consultancy-dossier-shell">
      <ConsultancyTenderDocument model={model} onOpenDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
    </div>
  );
}

function ConsultancyTenderDocument({
  model,
  onOpenDocument,
  onDownloadDocument
}: {
  model: ConsultancyTenderDocumentModel;
  onOpenDocument?: (document: TenderDetailDocument) => void;
  onDownloadDocument?: (document: TenderDetailDocument) => void;
}) {
  return (
    <article className="goods-tender-document goods-dossier consultancy-tender-document consultancy-dossier" aria-label="Consultancy tender summary">
      <TenderIdentityHeader model={model} />
      <RunningHeader model={model} />
      <TenderSummary model={model} />
      <TorDocumentMarker />

      <IntroductionSection model={model} />
      <ObjectivesSection model={model} />
      <ScopeSection model={model} />
      <ResponsibilitiesSection model={model} />
      <DeliverablesSection model={model} />
      <QualificationsSection model={model} />
      <InstitutionalArrangementsSection model={model} />
      <AttachmentsAndReferencesSection model={model} onOpenDocument={onOpenDocument} onDownloadDocument={onDownloadDocument} />
      <EvaluationCriteriaSection model={model} />
      {model.amendments.length ? <AmendmentsSection model={model} /> : null}

      <DocumentFooter model={model} />
    </article>
  );
}

function TenderIdentityHeader({ model }: { model: ConsultancyTenderDocumentModel }) {
  const logoUrl = model.organization.logoUrl;
  return (
    <header className={`goods-dossier-cover consultancy-dossier-cover${logoUrl ? '' : ' is-without-logo'}`}>
      <div className="goods-dossier-cover-grid">
        {logoUrl ? (
          <div className="goods-dossier-logo-block">
            <img src={logoUrl} alt={`${model.organization.name || 'Procuring organization'} logo`} />
          </div>
        ) : null}

        <div className="goods-dossier-title-block">
          <p className="goods-dossier-organization-name">{reviewText(model.organization.name, 'Procuring organization')}</p>
          <p className="goods-dossier-eyebrow">CONSULTANCY SERVICES</p>
          <h1>{reviewText(model.tender.title, 'Consultancy Tender')}</h1>
          <div className="goods-dossier-cover-meta">
            <span>
              Tender No. <strong>{reviewText(model.tender.number, 'Pending assignment')}</strong>
            </span>
            <span>{procurementMethodLabel(model.tender.procurementMethod)} - Consultancy Services</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function RunningHeader({ model }: { model: ConsultancyTenderDocumentModel }) {
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

function TenderSummary({ model }: { model: ConsultancyTenderDocumentModel }) {
  return (
    <section className="goods-dossier-summary" aria-labelledby="consultancy-tender-summary-heading">
      <h2 id="consultancy-tender-summary-heading">Tender Summary</h2>
      <DocumentInfoGrid
        rows={[
          { label: 'Procuring Organization', value: model.organization.name },
          { label: 'Tender Number', value: model.tender.number || 'Pending assignment' },
          { label: 'Procurement Category', value: 'Consultancy Services' },
          { label: 'Procurement Method', value: procurementMethodLabel(model.tender.procurementMethod) },
          { label: 'Opening Date', value: formatDocumentDate(model.tender.openingDate), omitWhenEmpty: true },
          { label: 'Closing Date', value: formatDocumentDate(model.tender.closingDate) },
          { label: 'Contact Person', value: model.tender.publicContactName, omitWhenEmpty: true },
          { label: 'Phone Number', value: model.tender.publicContactPhone, omitWhenEmpty: true },
          { label: 'Funding Source', value: model.tender.fundingSource, omitWhenEmpty: true },
          { label: 'Assignment / Delivery Location', value: model.tender.assignmentLocation, omitWhenEmpty: true }
        ]}
      />
    </section>
  );
}

function TorDocumentMarker() {
  return <div className="consultancy-dossier-tor-marker">TERMS OF REFERENCE</div>;
}

function IntroductionSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  const entityRows = model.introduction.entityBackground.filter(
    (row) => isMeaningful(row.organizationBackground) || isMeaningful(row.departmentOrUnit)
  );
  const project = model.introduction.projectBackground;
  const problem = model.introduction.problemStatement;
  const hasProject = hasAnyValue(project);
  const hasProblem = hasAnyValue(problem);

  return (
    <DocumentSection number="1" title="Introduction" id="consultancy-introduction">
      {entityRows.length ? (
        <DocumentSubsection number="1.1" title="Procuring Entity Background">
          <div className="consultancy-dossier-item-list">
            {entityRows.map((row, index) => (
              <article className="consultancy-dossier-item" key={row.id || index}>
                {entityRows.length > 1 ? <h4>{`Entity Background ${index + 1}`}</h4> : null}
                {isMeaningful(row.departmentOrUnit) ? <p className="consultancy-dossier-meta-line">Department / Unit: {row.departmentOrUnit}</p> : null}
                <NarrativeText value={row.organizationBackground} />
              </article>
            ))}
          </div>
        </DocumentSubsection>
      ) : null}

      {hasProject ? (
        <DocumentSubsection number="1.2" title="Project Background">
          <DocumentInfoGrid rows={[{ label: 'Project Name', value: project.projectName, omitWhenEmpty: true }]} />
          <NarrativeGroup
            rows={[
              ['Background Narrative', project.backgroundNarrative],
              ['Existing Challenges', project.existingChallenges],
              ['Current Situation', project.currentSituation],
              ['Related Initiatives', project.relatedInitiatives]
            ]}
          />
        </DocumentSubsection>
      ) : null}

      {hasProblem ? (
        <DocumentSubsection number="1.3" title="Problem Statement">
          <NarrativeGroup
            rows={[
              ['Main Problem Description', problem.mainProblemDescription],
              ['Expected Impact', problem.expectedImpact]
            ]}
          />
        </DocumentSubsection>
      ) : null}

      {!entityRows.length && !hasProject && !hasProblem ? <EmptyState /> : null}
    </DocumentSection>
  );
}

function ObjectivesSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  return (
    <DocumentSection number="2" title="Objectives of the Consultancy" id="consultancy-objectives">
      {isMeaningful(model.objectives.generalObjective) ? (
        <DocumentSubsection number="2.1" title="General Objective">
          <NarrativeText value={model.objectives.generalObjective} />
        </DocumentSubsection>
      ) : null}

      {model.objectives.specificObjectives.length ? (
        <DocumentSubsection number="2.2" title="Specific Objectives">
          <div className="consultancy-dossier-item-list">
            {model.objectives.specificObjectives.map((objective, index) => (
              <article className="consultancy-dossier-item" key={objective.id || index}>
                <h4>
                  {model.objectives.specificObjectives.length > 1 ? `${index + 1}. ` : ''}
                  {reviewText(objective.title, `Specific objective ${index + 1}`)}
                </h4>
                {isMeaningful(objective.priorityLevel) ? <p className="consultancy-dossier-meta-line">Priority Level: {objective.priorityLevel}</p> : null}
                <NarrativeText value={objective.description} />
              </article>
            ))}
          </div>
        </DocumentSubsection>
      ) : null}

      {!isMeaningful(model.objectives.generalObjective) && !model.objectives.specificObjectives.length ? <EmptyState /> : null}
    </DocumentSection>
  );
}

function ScopeSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  return (
    <DocumentSection number="3" title="Scope of Consultancy Services" id="consultancy-scope">
      <DocumentSubsection number="3.1" title="Assignment Activities">
        <DocumentTable
          columns={['Activity Title', 'Detailed Description', 'Expected Output', 'Location', 'Duration']}
          rows={model.scope.activities.map((row) => [
            reviewText(row.title),
            <DocumentValue value={row.description} key={`${row.id}-description`} />,
            <DocumentValue value={row.expectedOutput} key={`${row.id}-output`} />,
            reviewText(row.location),
            reviewText(row.durationText)
          ])}
          emptyText="No information provided."
        />
      </DocumentSubsection>

      {isMeaningful(model.scope.outOfScopeActivities) ? (
        <DocumentSubsection number="3.2" title="Assignment Boundaries - Out-of-Scope Activities">
          <NarrativeText value={model.scope.outOfScopeActivities} />
        </DocumentSubsection>
      ) : null}
    </DocumentSection>
  );
}

function ResponsibilitiesSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  return (
    <DocumentSection number="4" title="Duties and Responsibilities of the Parties" id="consultancy-responsibilities">
      {model.responsibilities.client.length ? (
        <DocumentSubsection number="4.1" title="Client Responsibilities">
          <ResponsibilityList
            rows={model.responsibilities.client.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
              metaLabel: 'Support Type',
              metaValue: row.supportType
            }))}
          />
        </DocumentSubsection>
      ) : null}

      {model.responsibilities.consultant.length ? (
        <DocumentSubsection number="4.2" title="Consultant Responsibilities">
          <ResponsibilityList
            rows={model.responsibilities.consultant.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
              metaLabel: 'Reporting Frequency',
              metaValue: row.reportingFrequency
            }))}
          />
        </DocumentSubsection>
      ) : null}

      {!model.responsibilities.client.length && !model.responsibilities.consultant.length ? <EmptyState /> : null}
    </DocumentSection>
  );
}

function DeliverablesSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  return (
    <DocumentSection number="5" title="Deliverables and Timeline" id="consultancy-deliverables">
      <DocumentSubsection number="5.1" title="Deliverables">
        <DocumentTable
          columns={['Deliverable Name', 'Description', 'Submission Timeline', 'Format Required', 'Submission Channel', 'Mandatory']}
          rows={model.deliverables.map((row) => [
            reviewText(row.name),
            <DocumentValue value={row.description} key={`${row.id}-description`} />,
            reviewText(row.submissionTimeline),
            reviewText(row.formatRequired),
            reviewText(row.submissionChannel),
            yesNo(row.mandatory)
          ])}
          emptyText="No information provided."
        />
      </DocumentSubsection>

      {model.reportingRequirements.length ? (
        <DocumentSubsection number="5.2" title="Reporting Requirements">
          <DocumentTable
            columns={['Report Type', 'Frequency', 'Submission Format', 'Submission Channel']}
            rows={model.reportingRequirements.map((row) => [
              reviewText(row.reportType),
              reviewText(row.frequency),
              reviewText(row.submissionFormat),
              reviewText(row.submissionChannel)
            ])}
            emptyText="No information provided."
          />
        </DocumentSubsection>
      ) : null}
    </DocumentSection>
  );
}

function QualificationsSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  const individualRows: InfoRow[] = [
    { label: 'Professional Registrations / Certifications', value: model.qualifications.individual.professionalRegistrations.join(', '), omitWhenEmpty: true },
    { label: 'Curriculum Vitae', value: model.qualifications.individual.cvRequired, omitWhenEmpty: true },
    { label: 'Minimum Years of Experience', value: yearsText(model.qualifications.individual.minimumYearsExperience), omitWhenEmpty: true },
    { label: 'Minimum Similar Assignments', value: model.qualifications.individual.minimumSimilarAssignments, omitWhenEmpty: true },
    { label: 'Similar Assignment Evidence', value: model.qualifications.individual.similarAssignmentEvidenceRequired, omitWhenEmpty: true }
  ];
  const firmRows: InfoRow[] = [
    { label: 'Minimum Years of Experience', value: yearsText(model.qualifications.firm.minimumYearsExperience), omitWhenEmpty: true },
    { label: 'Minimum Similar Assignments', value: model.qualifications.firm.minimumSimilarAssignments, omitWhenEmpty: true },
    { label: 'Sector Experience', value: model.qualifications.firm.sectorExperience.join(', '), omitWhenEmpty: true },
    { label: 'Similar Assignment Evidence', value: model.qualifications.firm.similarAssignmentEvidenceRequired, omitWhenEmpty: true }
  ];
  const subsections: QualificationSubsection[] = [
    {
      key: 'individual',
      title: 'Individual / Sole Proprietor Requirements',
      visible: hasVisibleInfoRows(individualRows),
      content: <DocumentInfoGrid rows={individualRows} />
    },
    {
      key: 'firm',
      title: 'Consulting Firm - Firm Experience',
      visible: hasVisibleInfoRows(firmRows),
      content: <DocumentInfoGrid rows={firmRows} />
    },
    {
      key: 'keyPersonnel',
      title: 'Consulting Firm - Key Personnel',
      visible: model.qualifications.firm.keyPersonnel.length > 0,
      content: (
        <DocumentTable
          columns={['Position Title', 'Minimum Qualification', 'Years', 'Certifications', 'Quantity', 'Mandatory']}
          numericColumns={[2, 4]}
          rows={model.qualifications.firm.keyPersonnel.map((row) => [
            reviewText(row.positionTitle),
            reviewText(row.minimumQualification),
            reviewText(row.yearsExperience),
            reviewText(row.certifications),
            reviewText(row.quantity),
            yesNo(row.mandatory)
          ])}
          emptyText="No information provided."
        />
      )
    },
    {
      key: 'regulatoryLicences',
      title: 'Regulatory Licence Requirements',
      visible: model.qualifications.regulatoryLicences.length > 0,
      content: (
        <DocumentTable
          columns={['Requirement', 'Issuing Body', 'Mandatory']}
          rows={model.qualifications.regulatoryLicences.map((row) => [
            reviewText(row.name),
            reviewText(row.issuingBody),
            yesNo(row.mandatory)
          ])}
          emptyText="No information provided."
        />
      )
    },
    {
      key: 'financial',
      title: 'Financial Capacity Requirements',
      visible: model.qualifications.financialCapacityRequirements.length > 0,
      content: (
        <DocumentTable
          columns={['Requirement Type', 'Minimum Value', 'Period', 'Evidence Required', 'Mandatory']}
          numericColumns={[1]}
          rows={model.qualifications.financialCapacityRequirements.map((row) => [
            reviewText(row.requirementType),
            reviewText(row.minimumValue),
            reviewText(row.period),
            reviewText(row.evidenceRequired),
            yesNo(row.mandatory)
          ])}
          emptyText="No information provided."
        />
      )
    }
  ].filter((section) => section.visible);

  return (
    <DocumentSection number="6" title="Required Qualifications and Experience" id="consultancy-qualifications">
      {subsections.length ? (
        subsections.map((section, index) => (
          <DocumentSubsection number={`6.${index + 1}`} title={section.title} key={section.key}>
            {section.content}
          </DocumentSubsection>
        ))
      ) : (
        <EmptyState />
      )}
    </DocumentSection>
  );
}

function InstitutionalArrangementsSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  const arrangements = model.institutionalArrangements;
  const governanceRows: InfoRow[] = [
    { label: 'Consultant Reports To', value: arrangements.consultantReportsTo, omitWhenEmpty: true },
    { label: 'Supervising Officer', value: arrangements.supervisingOfficer, omitWhenEmpty: true },
    { label: 'Approval Authority', value: arrangements.approvalAuthority, omitWhenEmpty: true },
    { label: 'Meeting Frequency', value: arrangements.meetingFrequency, omitWhenEmpty: true }
  ];
  const supportItems = [
    arrangements.officeSpaceProvided ? 'Office space provided' : '',
    arrangements.accessToFacilities ? 'Access to facilities' : '',
    arrangements.accessToDocuments ? 'Access to documents' : ''
  ].filter(Boolean);

  return (
    <DocumentSection number="7" title="Institutional and Organizational Arrangements" id="consultancy-institutional-arrangements">
      {hasVisibleInfoRows(governanceRows) ? (
        <DocumentSubsection number="7.1" title="Governance and Reporting">
          <DocumentInfoGrid rows={governanceRows} />
        </DocumentSubsection>
      ) : null}

      {isMeaningful(arrangements.coordinationMechanism) ? (
        <DocumentSubsection number="7.2" title="Coordination Mechanism">
          <NarrativeText value={arrangements.coordinationMechanism} />
        </DocumentSubsection>
      ) : null}

      {arrangements.communicationMethods.length ? (
        <DocumentSubsection number="7.3" title="Communication Methods">
          <p className="consultancy-dossier-narrative">{arrangements.communicationMethods.join(', ')}</p>
        </DocumentSubsection>
      ) : null}

      {supportItems.length ? (
        <DocumentSubsection number="7.4" title="Client Facilities and Support">
          <ul className="goods-dossier-cell-list consultancy-dossier-list">
            {supportItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </DocumentSubsection>
      ) : null}

      {!hasVisibleInfoRows(governanceRows) && !isMeaningful(arrangements.coordinationMechanism) && !arrangements.communicationMethods.length && !supportItems.length ? <EmptyState /> : null}
    </DocumentSection>
  );
}

function AttachmentsAndReferencesSection({
  model,
  onOpenDocument,
  onDownloadDocument
}: {
  model: ConsultancyTenderDocumentModel;
  onOpenDocument?: (document: TenderDetailDocument) => void;
  onDownloadDocument?: (document: TenderDetailDocument) => void;
}) {
  return (
    <DocumentSection number="8" title="Attachments and Reference Documents" id="consultancy-attachments-references">
      {model.supportingDocuments.length ? (
        <DocumentSubsection number="8.1" title="Supporting Documents">
          <DocumentTable
            columns={['Document Title', 'Category', 'Access']}
            rows={model.supportingDocuments.map((row) => [
              reviewText(row.title),
              <DocumentValue value={row.category} key={`${row.id}-category`} />,
              <SupportingDocumentActions
                key={row.id}
                row={row}
                onOpenDocument={onOpenDocument}
                onDownloadDocument={onDownloadDocument}
              />
            ])}
            emptyText="No information provided."
          />
        </DocumentSubsection>
      ) : null}

      {model.externalReferences.length ? (
        <DocumentSubsection number="8.2" title="External References">
          <DocumentTable
            columns={['Reference Name', 'Description', 'URL']}
            rows={model.externalReferences.map((row) => [
              row.safeHref ? (
                <a href={row.safeHref} target="_blank" rel="noopener noreferrer" key={`${row.id}-link`}>
                  {reviewText(row.name)}
                </a>
              ) : (
                reviewText(row.name)
              ),
              <DocumentValue value={row.description} key={`${row.id}-description`} />,
              row.safeHref ? (
                <a className="consultancy-dossier-url" href={row.safeHref} target="_blank" rel="noopener noreferrer" key={`${row.id}-url`}>
                  {row.url}
                </a>
              ) : (
                <span className="consultancy-dossier-invalid-url" key={`${row.id}-invalid-url`}>
                  {row.url ? 'Invalid or unsupported URL' : 'Not specified'}
                </span>
              )
            ])}
            emptyText="No information provided."
          />
        </DocumentSubsection>
      ) : null}

      {!model.supportingDocuments.length && !model.externalReferences.length ? <EmptyState /> : null}
    </DocumentSection>
  );
}

function EvaluationCriteriaSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  const totalWeight = evaluationTotalWeight(model.evaluationCriteria);
  return (
    <DocumentSection number="9" title="Evaluation Criteria" id="consultancy-evaluation-criteria">
      <DocumentTable
        columns={['Criteria', 'Sub-criteria', 'Weight']}
        numericColumns={[2]}
        footer={totalWeight ? ['TOTAL', '', totalWeight] : undefined}
        rows={model.evaluationCriteria.map((criterion) => [
          reviewText(criterion.criterion),
          <DocumentValue value={criterion.subCriterion} key={`${criterion.criterion}-sub`} />,
          formatWeight(criterion.weight)
        ])}
        emptyText="No information provided."
      />
    </DocumentSection>
  );
}

function AmendmentsSection({ model }: { model: ConsultancyTenderDocumentModel }) {
  return (
    <DocumentSection number="10" title="Amendments" id="consultancy-amendments">
      <DocumentTable
        columns={['Amendment Number', 'Date of Amendment', 'Description']}
        rows={model.amendments.map((row) => [
          reviewText(row.number),
          formatDocumentDate(row.date),
          <DocumentValue value={row.description} key={`${row.number}-description`} />
        ])}
        emptyText="No information provided."
      />
    </DocumentSection>
  );
}

function DocumentSection({ number, title, id, children }: { number: string; title: string; id: string; children: ReactNode }) {
  return (
    <section className="goods-dossier-section consultancy-dossier-section" id={id}>
      <div className="goods-dossier-section-heading document-section-heading">
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      <div className="goods-dossier-section-divider"></div>
      <div className="goods-dossier-section-body">{children}</div>
    </section>
  );
}

function DocumentSubsection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="goods-dossier-subsection consultancy-dossier-subsection">
      <h3 className="consultancy-dossier-subsection-heading">
        <span>{number}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function NarrativeGroup({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  const visibleRows = rows.filter(([, value]) => isMeaningful(value));
  if (!visibleRows.length) return <EmptyState />;
  return (
    <div className="consultancy-dossier-narrative-stack">
      {visibleRows.map(([title, value]) => (
        <div className="consultancy-dossier-narrative-block" key={title}>
          <h4>{title}</h4>
          <NarrativeText value={value} />
        </div>
      ))}
    </div>
  );
}

function NarrativeText({ value }: { value: string | null | undefined }) {
  const blocks = narrativeBlocks(value);
  if (!blocks.length) return null;
  return (
    <>
      {blocks.map((block, index) => (
        <p className="consultancy-dossier-narrative" key={`${block}-${index}`}>
          {block}
        </p>
      ))}
    </>
  );
}

function ResponsibilityList({
  rows
}: {
  rows: Array<{ id: string; title: string; description?: string | null; metaLabel: string; metaValue?: string | null }>;
}) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="consultancy-dossier-item-list">
      {rows.map((row, index) => (
        <article className="consultancy-dossier-item" key={row.id || index}>
          <h4>
            {rows.length > 1 ? `${index + 1}. ` : ''}
            {reviewText(row.title, `Responsibility ${index + 1}`)}
          </h4>
          {isMeaningful(row.metaValue) ? <p className="consultancy-dossier-meta-line">{row.metaLabel}: {row.metaValue}</p> : null}
          <NarrativeText value={row.description} />
        </article>
      ))}
    </div>
  );
}

function DocumentInfoGrid({ rows }: { rows: InfoRow[] }) {
  const visibleRows = rows.filter((row) => !row.omitWhenEmpty || isMeaningful(row.value));
  if (!visibleRows.length) return <EmptyState />;
  return (
    <dl className="goods-dossier-info-grid consultancy-dossier-info-grid">
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
      <table className="goods-dossier-table consultancy-dossier-table">
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

function DocumentValue({ value }: { value: ReactNode }) {
  if (Array.isArray(value)) {
    const cleanValues = value.map((item) => String(item || '').trim()).filter(Boolean);
    if (!cleanValues.length) return <>Not specified</>;
    if (cleanValues.length > 3 || cleanValues.some((item) => item.length > 40)) {
      return (
        <ul className="goods-dossier-cell-list consultancy-dossier-list">
          {cleanValues.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }
    return <>{cleanValues.join(', ')}</>;
  }
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  return <>{reviewText(value as string | number | null | undefined)}</>;
}

function SupportingDocumentActions({
  row,
  onOpenDocument,
  onDownloadDocument
}: {
  row: ConsultancyTenderDocumentAttachment;
  onOpenDocument?: (document: TenderDetailDocument) => void;
  onDownloadDocument?: (document: TenderDetailDocument) => void;
}) {
  return (
    <div className="consultancy-dossier-document-cell">
      <strong>{reviewText(row.uploadedDocument, 'Document listed in ProcureX')}</strong>
      {row.confidential ? <span>Restricted</span> : null}
      {row.document ? (
        <div className="consultancy-dossier-document-actions">
          <button className="btn btn-secondary" type="button" onClick={() => onOpenDocument?.(row.document as TenderDetailDocument)}>
            View
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => onDownloadDocument?.(row.document as TenderDetailDocument)}>
            Download
          </button>
        </div>
      ) : (
        <span>Document unavailable</span>
      )}
    </div>
  );
}

function EmptyState({ text = 'No information provided.' }: { text?: string }) {
  return <p className="goods-dossier-empty">{text}</p>;
}

function DocumentFooter({ model }: { model: ConsultancyTenderDocumentModel }) {
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

function narrativeBlocks(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function hasAnyValue(value: Record<string, unknown>) {
  return Object.values(value).some(isMeaningful);
}

function hasVisibleInfoRows(rows: InfoRow[]) {
  return rows.some((row) => !row.omitWhenEmpty || isMeaningful(row.value));
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

function yearsText(value: string | number | null | undefined) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/[a-z]/i.test(text)) return text;
  return `${text} years`;
}

function yesNo(value: boolean | null | undefined) {
  if (value === null || value === undefined) return '';
  return value ? 'Yes' : 'No';
}

function evaluationTotalWeight(criteria: ConsultancyTenderDocumentModel['evaluationCriteria']) {
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

function isMeaningful(value: unknown) {
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
