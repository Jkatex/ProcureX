/* Supports the procurement client workflow with reusable logic kept close to the screens that consume it. */
import type { ConsultancyTenderDocumentModel } from './consultancyTenderDocumentModel';

type InfoRow = {
  label: string;
  value: unknown;
  omitWhenEmpty?: boolean;
};

type QualificationSection = {
  key: string;
  title: string;
  visible: boolean;
  content: string;
};

export function buildConsultancyTenderDocumentPdfHtml(model: ConsultancyTenderDocumentModel) {
  return `
    <article class="goods-tender-document goods-dossier consultancy-tender-document consultancy-dossier" aria-label="Consultancy tender document">
      ${renderTenderIdentity(model)}
      ${renderTenderSummary(model)}
      <div class="consultancy-dossier-tor-marker">TERMS OF REFERENCE</div>
      ${renderIntroduction(model)}
      ${renderObjectives(model)}
      ${renderScope(model)}
      ${renderResponsibilities(model)}
      ${renderDeliverables(model)}
      ${renderQualifications(model)}
      ${renderInstitutionalArrangements(model)}
      ${renderAttachmentsAndReferences(model)}
      ${renderEvaluation(model)}
      ${model.amendments.length ? renderAmendments(model) : ''}
      ${renderDocumentFooter(model)}
    </article>
  `;
}

function renderTenderIdentity(model: ConsultancyTenderDocumentModel) {
  const logo = model.organization.logoUrl
    ? `<div class="goods-dossier-logo-block"><img src="${escapeAttribute(model.organization.logoUrl)}" alt="${escapeAttribute(`${model.organization.name || 'Procuring organization'} logo`)}" /></div>`
    : '';

  return `
    <header class="goods-dossier-cover consultancy-dossier-cover${model.organization.logoUrl ? '' : ' is-without-logo'}">
      <div class="goods-dossier-cover-grid">
        ${logo}
        <div class="goods-dossier-title-block">
          <p class="goods-dossier-organization-name">${escapeHtml(reviewText(model.organization.name, 'Procuring organization'))}</p>
          <p class="goods-dossier-eyebrow">CONSULTANCY SERVICES</p>
          <h1>${escapeHtml(reviewText(model.tender.title, 'Consultancy Tender'))}</h1>
          <div class="goods-dossier-cover-meta">
            <span>Tender No. <strong>${escapeHtml(reviewText(model.tender.number, 'Pending assignment'))}</strong></span>
            <span>${escapeHtml(`${procurementMethodLabel(model.tender.procurementMethod)} - Consultancy Services`)}</span>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderTenderSummary(model: ConsultancyTenderDocumentModel) {
  return `
    <section class="goods-dossier-summary" aria-labelledby="consultancy-tender-summary-heading">
      <h2 id="consultancy-tender-summary-heading">Tender Summary</h2>
      ${renderInfoGrid([
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
      ])}
    </section>
  `;
}

function renderIntroduction(model: ConsultancyTenderDocumentModel) {
  const entityRows = model.introduction.entityBackground.filter((row) => isMeaningful(row.organizationBackground) || isMeaningful(row.departmentOrUnit));
  const project = model.introduction.projectBackground;
  const problem = model.introduction.problemStatement;
  const content = [
    entityRows.length
      ? renderSubsection('1.1', 'Procuring Entity Background', `
          <div class="consultancy-dossier-item-list">
            ${entityRows.map((row, index) => `
              <article class="consultancy-dossier-item">
                ${entityRows.length > 1 ? `<h4>Entity Background ${index + 1}</h4>` : ''}
                ${isMeaningful(row.departmentOrUnit) ? `<p class="consultancy-dossier-meta-line">Department / Unit: ${escapeHtml(row.departmentOrUnit)}</p>` : ''}
                ${renderNarrative(row.organizationBackground)}
              </article>
            `).join('')}
          </div>
        `)
      : '',
    hasAnyValue(project)
      ? renderSubsection('1.2', 'Project Background', `
          ${renderInfoGrid([{ label: 'Project Name', value: project.projectName, omitWhenEmpty: true }])}
          ${renderNarrativeGroup([
            ['Background Narrative', project.backgroundNarrative],
            ['Existing Challenges', project.existingChallenges],
            ['Current Situation', project.currentSituation],
            ['Related Initiatives', project.relatedInitiatives]
          ])}
        `)
      : '',
    hasAnyValue(problem)
      ? renderSubsection('1.3', 'Problem Statement', renderNarrativeGroup([
          ['Main Problem Description', problem.mainProblemDescription],
          ['Expected Impact', problem.expectedImpact]
        ]))
      : ''
  ].join('');

  return renderSection('1', 'Introduction', content || renderEmptyState('No information provided.'));
}

function renderObjectives(model: ConsultancyTenderDocumentModel) {
  const content = [
    isMeaningful(model.objectives.generalObjective)
      ? renderSubsection('2.1', 'General Objective', renderNarrative(model.objectives.generalObjective))
      : '',
    model.objectives.specificObjectives.length
      ? renderSubsection('2.2', 'Specific Objectives', `
          <div class="consultancy-dossier-item-list">
            ${model.objectives.specificObjectives.map((objective, index) => `
              <article class="consultancy-dossier-item">
                <h4>${escapeHtml(`${model.objectives.specificObjectives.length > 1 ? `${index + 1}. ` : ''}${reviewText(objective.title, `Specific objective ${index + 1}`)}`)}</h4>
                ${isMeaningful(objective.priorityLevel) ? `<p class="consultancy-dossier-meta-line">Priority Level: ${escapeHtml(objective.priorityLevel)}</p>` : ''}
                ${renderNarrative(objective.description)}
              </article>
            `).join('')}
          </div>
        `)
      : ''
  ].join('');

  return renderSection('2', 'Objectives of the Consultancy', content || renderEmptyState('No information provided.'));
}

function renderScope(model: ConsultancyTenderDocumentModel) {
  return renderSection('3', 'Scope of Consultancy Services', `
    ${renderSubsection('3.1', 'Assignment Activities', renderTable(
      ['Activity Title', 'Detailed Description', 'Expected Output', 'Location', 'Duration'],
      model.scope.activities.map((row) => [
        escapeHtml(reviewText(row.title)),
        renderCellValue(row.description),
        renderCellValue(row.expectedOutput),
        escapeHtml(reviewText(row.location)),
        escapeHtml(reviewText(row.durationText))
      ])
    ))}
    ${isMeaningful(model.scope.outOfScopeActivities) ? renderSubsection('3.2', 'Assignment Boundaries - Out-of-Scope Activities', renderNarrative(model.scope.outOfScopeActivities)) : ''}
  `);
}

function renderResponsibilities(model: ConsultancyTenderDocumentModel) {
  const content = [
    model.responsibilities.client.length
      ? renderSubsection('4.1', 'Client Responsibilities', renderResponsibilityList(model.responsibilities.client.map((row) => ({
          title: row.title,
          description: row.description,
          metaLabel: 'Support Type',
          metaValue: row.supportType
        }))))
      : '',
    model.responsibilities.consultant.length
      ? renderSubsection('4.2', 'Consultant Responsibilities', renderResponsibilityList(model.responsibilities.consultant.map((row) => ({
          title: row.title,
          description: row.description,
          metaLabel: 'Reporting Frequency',
          metaValue: row.reportingFrequency
        }))))
      : ''
  ].join('');

  return renderSection('4', 'Duties and Responsibilities of the Parties', content || renderEmptyState('No information provided.'));
}

function renderDeliverables(model: ConsultancyTenderDocumentModel) {
  return renderSection('5', 'Deliverables and Timeline', `
    ${renderSubsection('5.1', 'Deliverables', renderTable(
      ['Deliverable Name', 'Description', 'Submission Timeline', 'Format Required', 'Submission Channel', 'Mandatory'],
      model.deliverables.map((row) => [
        escapeHtml(reviewText(row.name)),
        renderCellValue(row.description),
        escapeHtml(reviewText(row.submissionTimeline)),
        escapeHtml(reviewText(row.formatRequired)),
        escapeHtml(reviewText(row.submissionChannel)),
        escapeHtml(yesNo(row.mandatory))
      ])
    ))}
    ${model.reportingRequirements.length ? renderSubsection('5.2', 'Reporting Requirements', renderTable(
      ['Report Type', 'Frequency', 'Submission Format', 'Submission Channel'],
      model.reportingRequirements.map((row) => [
        escapeHtml(reviewText(row.reportType)),
        escapeHtml(reviewText(row.frequency)),
        escapeHtml(reviewText(row.submissionFormat)),
        escapeHtml(reviewText(row.submissionChannel))
      ])
    )) : ''}
  `);
}

function renderQualifications(model: ConsultancyTenderDocumentModel) {
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
  const subsections: QualificationSection[] = [
    { key: 'individual', title: 'Individual / Sole Proprietor Requirements', visible: hasVisibleInfoRows(individualRows), content: renderInfoGrid(individualRows) },
    { key: 'firm', title: 'Consulting Firm - Firm Experience', visible: hasVisibleInfoRows(firmRows), content: renderInfoGrid(firmRows) },
    {
      key: 'keyPersonnel',
      title: 'Consulting Firm - Key Personnel',
      visible: model.qualifications.firm.keyPersonnel.length > 0,
      content: renderTable(
        ['Position Title', 'Minimum Qualification', 'Years', 'Certifications', 'Quantity', 'Mandatory'],
        model.qualifications.firm.keyPersonnel.map((row) => [
          escapeHtml(reviewText(row.positionTitle)),
          escapeHtml(reviewText(row.minimumQualification)),
          escapeHtml(reviewText(row.yearsExperience)),
          escapeHtml(reviewText(row.certifications)),
          escapeHtml(reviewText(row.quantity)),
          escapeHtml(yesNo(row.mandatory))
        ]),
        { numericColumns: [2, 4] }
      )
    },
    {
      key: 'regulatory',
      title: 'Regulatory Licence Requirements',
      visible: model.qualifications.regulatoryLicences.length > 0,
      content: renderTable(
        ['Requirement', 'Issuing Body', 'Mandatory'],
        model.qualifications.regulatoryLicences.map((row) => [
          escapeHtml(reviewText(row.name)),
          escapeHtml(reviewText(row.issuingBody)),
          escapeHtml(yesNo(row.mandatory))
        ])
      )
    },
    {
      key: 'financial',
      title: 'Financial Capacity Requirements',
      visible: model.qualifications.financialCapacityRequirements.length > 0,
      content: renderTable(
        ['Requirement Type', 'Minimum Value', 'Period', 'Evidence Required', 'Mandatory'],
        model.qualifications.financialCapacityRequirements.map((row) => [
          escapeHtml(reviewText(row.requirementType)),
          escapeHtml(reviewText(row.minimumValue)),
          escapeHtml(reviewText(row.period)),
          escapeHtml(reviewText(row.evidenceRequired)),
          escapeHtml(yesNo(row.mandatory))
        ]),
        { numericColumns: [1] }
      )
    }
  ].filter((section) => section.visible);

  return renderSection('6', 'Required Qualifications and Experience', subsections.length
    ? subsections.map((section, index) => renderSubsection(`6.${index + 1}`, section.title, section.content)).join('')
    : renderEmptyState('No information provided.'));
}

function renderInstitutionalArrangements(model: ConsultancyTenderDocumentModel) {
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
  const content = [
    hasVisibleInfoRows(governanceRows) ? renderSubsection('7.1', 'Governance and Reporting', renderInfoGrid(governanceRows)) : '',
    isMeaningful(arrangements.coordinationMechanism) ? renderSubsection('7.2', 'Coordination Mechanism', renderNarrative(arrangements.coordinationMechanism)) : '',
    arrangements.communicationMethods.length ? renderSubsection('7.3', 'Communication Methods', `<p class="consultancy-dossier-narrative">${escapeHtml(arrangements.communicationMethods.join(', '))}</p>`) : '',
    supportItems.length ? renderSubsection('7.4', 'Client Facilities and Support', `<ul class="goods-dossier-cell-list consultancy-dossier-list">${supportItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`) : ''
  ].join('');

  return renderSection('7', 'Institutional and Organizational Arrangements', content || renderEmptyState('No information provided.'));
}

function renderAttachmentsAndReferences(model: ConsultancyTenderDocumentModel) {
  const content = [
    model.supportingDocuments.length ? renderSubsection('8.1', 'Supporting Documents', renderTable(
      ['Document Title', 'Category', 'Access'],
      model.supportingDocuments.map((row) => [
        escapeHtml(reviewText(row.title)),
        escapeHtml(reviewText(row.category)),
        [
          `<strong>${escapeHtml(reviewText(row.uploadedDocument, 'Document listed in ProcureX'))}</strong>`,
          row.confidential ? '<span>Restricted</span>' : '',
          '<span>Available through ProcureX document access controls.</span>'
        ].filter(Boolean).join('<br />')
      ])
    )) : '',
    model.externalReferences.length ? renderSubsection('8.2', 'External References', renderTable(
      ['Reference Name', 'Description', 'URL'],
      model.externalReferences.map((row) => [
        row.safeHref
          ? `<a href="${escapeAttribute(row.safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(reviewText(row.name))}</a>`
          : escapeHtml(reviewText(row.name)),
        renderCellValue(row.description),
        row.safeHref
          ? `<a class="consultancy-dossier-url" href="${escapeAttribute(row.safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.url)}</a>`
          : `<span class="consultancy-dossier-invalid-url">${escapeHtml(row.url ? 'Invalid or unsupported URL' : 'Not specified')}</span>`
      ])
    )) : ''
  ].join('');

  return renderSection('8', 'Attachments and Reference Documents', content || renderEmptyState('No information provided.'));
}

function renderEvaluation(model: ConsultancyTenderDocumentModel) {
  const totalWeight = evaluationTotalWeight(model.evaluationCriteria);
  return renderSection('9', 'Evaluation Criteria', renderTable(
    ['Criteria', 'Sub-criteria', 'Weight'],
    model.evaluationCriteria.map((criterion) => [
      escapeHtml(reviewText(criterion.criterion)),
      renderCellValue(criterion.subCriterion),
      escapeHtml(formatWeight(criterion.weight))
    ]),
    { numericColumns: [2], footer: totalWeight ? ['TOTAL', '', totalWeight] : undefined }
  ));
}

function renderAmendments(model: ConsultancyTenderDocumentModel) {
  return renderSection('10', 'Amendments', renderTable(
    ['Amendment Number', 'Date of Amendment', 'Description'],
    model.amendments.map((row) => [
      escapeHtml(reviewText(row.number)),
      escapeHtml(formatDocumentDate(row.date)),
      renderCellValue(row.description)
    ])
  ));
}

function renderSection(number: string, title: string, content: string) {
  return `
    <section class="goods-dossier-section consultancy-dossier-section">
      <div class="goods-dossier-section-heading document-section-heading">
        <span>${escapeHtml(number)}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="goods-dossier-section-divider"></div>
      <div class="goods-dossier-section-body">${content}</div>
    </section>
  `;
}

function renderSubsection(number: string, title: string, content: string) {
  return `
    <section class="goods-dossier-subsection consultancy-dossier-subsection">
      <h3 class="consultancy-dossier-subsection-heading"><span>${escapeHtml(number)}</span>${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderInfoGrid(rows: InfoRow[]) {
  const visibleRows = rows.filter((row) => !row.omitWhenEmpty || isMeaningful(row.value));
  if (!visibleRows.length) return renderEmptyState('No information provided.');
  return `
    <dl class="goods-dossier-info-grid consultancy-dossier-info-grid">
      ${visibleRows.map((row) => `
        <div>
          <dt>${escapeHtml(row.label)}</dt>
          <dd>${escapeHtml(isMeaningful(row.value) ? String(row.value) : 'Not specified')}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderNarrativeGroup(rows: Array<[string, unknown]>) {
  const visibleRows = rows.filter(([, value]) => isMeaningful(value));
  if (!visibleRows.length) return renderEmptyState('No information provided.');
  return `
    <div class="consultancy-dossier-narrative-stack">
      ${visibleRows.map(([title, value]) => `
        <div class="consultancy-dossier-narrative-block">
          <h4>${escapeHtml(title)}</h4>
          ${renderNarrative(value)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderNarrative(value: unknown) {
  const blocks = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return '';
  return blocks.map((block) => `<p class="consultancy-dossier-narrative">${escapeHtml(block)}</p>`).join('');
}

function renderResponsibilityList(rows: Array<{ title: string; description?: string | null; metaLabel: string; metaValue?: string | null }>) {
  if (!rows.length) return renderEmptyState('No information provided.');
  return `
    <div class="consultancy-dossier-item-list">
      ${rows.map((row, index) => `
        <article class="consultancy-dossier-item">
          <h4>${escapeHtml(`${rows.length > 1 ? `${index + 1}. ` : ''}${reviewText(row.title, `Responsibility ${index + 1}`)}`)}</h4>
          ${isMeaningful(row.metaValue) ? `<p class="consultancy-dossier-meta-line">${escapeHtml(row.metaLabel)}: ${escapeHtml(row.metaValue)}</p>` : ''}
          ${renderNarrative(row.description)}
        </article>
      `).join('')}
    </div>
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
      <table class="goods-dossier-table consultancy-dossier-table">
        <thead>
          <tr>${columns.map((column, index) => `<th scope="col" class="${numericColumns.includes(index) ? 'is-numeric' : ''}">${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column, index) => `
                <td class="${numericColumns.includes(index) ? 'is-numeric' : ''}">${isMeaningful(row[index]) ? row[index] : 'Not specified'}</td>
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

function renderDocumentFooter(model: ConsultancyTenderDocumentModel) {
  return `
    <footer class="goods-dossier-footer">
      <span>${escapeHtml(reviewText(model.tender.publicVersion, 'Version 1.0'))}</span>
      <span>Generated by ProcureX</span>
      <span>Page <span class="goods-dossier-current-page">1</span> of <span class="goods-dossier-total-pages">1</span></span>
    </footer>
  `;
}

function renderCellValue(value: unknown) {
  if (Array.isArray(value)) return escapeHtml(value.map((item) => String(item || '').trim()).filter(Boolean).join(', ') || 'Not specified');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return escapeHtml(reviewText(value));
}

function renderEmptyState(text: string) {
  return `<p class="goods-dossier-empty">${escapeHtml(text)}</p>`;
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
