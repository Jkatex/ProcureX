import type {
  BidSchemaEnvelope,
  BidSubmissionFieldType,
  BidSubmissionResponseType,
  BidSubmissionSchemaDto,
  BidSubmissionSchemaFieldDto,
  BidSubmissionSchemaStepDto,
  BidSubmissionStepId
} from './types.js';

type TenderSchemaInput = {
  id: string;
  reference: string;
  title: string;
  type: unknown;
  requirements: unknown;
  metadata: unknown;
  requirementRows?: Array<{ id: string; section: string; payload: unknown }>;
  commercialItems?: Array<{
    id: string;
    itemNo: string | null;
    description: string;
    quantity: unknown;
    unit: string | null;
    rate: unknown;
    total: unknown;
    payload: unknown;
  }>;
  documents?: Array<{
    label: string | null;
    document?: { id: string; name: string; documentType: string };
  }>;
};

type WorkflowType = 'goods' | 'works' | 'services' | 'consultancy' | 'generic';

type CommercialItem = {
  id: string;
  itemNo: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number | null;
  source: string;
};

const schemaVersion = 'bid-submission-schema-v1' as const;

export function buildBidSubmissionSchema(tender: TenderSchemaInput): BidSubmissionSchemaDto {
  const requirements = objectPayload(tender.requirements);
  const metadata = objectPayload(tender.metadata);
  const workflow = workflowFromTenderType(tender.type);
  const fields = requirementFields(requirements, workflow);
  const requirementRows = tender.requirementRows ?? [];
  const commercial = commercialItems(tender, requirements, fields);
  const samples = sampleFields(requirements, fields);
  const criteria = evaluationCriteria(metadata);
  const documents = documentFields(fields, requirementRows, metadata);

  const administrative = [
    field('administrative.eligible', 'administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', true, 'boolean', 'ADMINISTRATIVE', 'system'),
    field('administrative.authorized', 'administrative.authorizedRepresentative', 'Confirm authorized representative', 'boolean', 'administrative', true, 'boolean', 'ADMINISTRATIVE', 'system'),
    ...documents.filter((item) => item.section === 'administrative')
  ];
  const technical = uniqueFields([
    ...technicalFields(workflow, requirements, fields, requirementRows),
    ...documents.filter((item) => item.section === 'technical'),
    ...criteriaFields(criteria).filter((item) => item.section === 'technical')
  ]);
  const financial = uniqueFields([
    ...financialFields(workflow, commercial, fields, requirements),
    ...documents.filter((item) => item.section === 'financial'),
    ...criteriaFields(criteria).filter((item) => item.section === 'financial')
  ]);
  const declarations = declarationFields(fields);

  const steps: BidSubmissionSchemaStepDto[] = [
    step('administrative', 'Administrative', 'ADMINISTRATIVE', administrative),
    ...(technical.length ? [step('technical', 'Technical', 'TECHNICAL', technical)] : []),
    ...(financial.length ? [step('financial', 'Financial', 'FINANCIAL', financial)] : []),
    ...(samples.length ? [step('samples', 'Samples', 'TECHNICAL', samples)] : []),
    step('declarations', 'Declarations', 'COMBINED', declarations),
    step('review', 'Review', 'COMBINED', [
      field('review.confirmComplete', 'review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', true, 'acknowledgement', 'COMBINED', 'system')
    ]),
    step('receipt', 'Receipt', 'COMBINED', [])
  ];

  return {
    tenderId: tender.id,
    tenderReference: tender.reference,
    tenderTitle: tender.title,
    tenderType: String(tender.type || 'UNKNOWN'),
    schemaVersion,
    steps
  };
}

function technicalFields(
  workflow: WorkflowType,
  requirements: Record<string, unknown>,
  fields: Record<string, unknown>,
  requirementRows: Array<{ id: string; section: string; payload: unknown }>
) {
  const output: BidSubmissionSchemaFieldDto[] = [];
  const keys = technicalKeys(workflow);
  keys.forEach((key) => collectRequirementValue(key, fields[key], output, 'technical', 'TECHNICAL', `requirements.${key}`));

  for (const row of requirementRows) {
    if (!isTechnicalText(`${row.section} ${payloadSummary(objectPayload(row.payload))}`)) continue;
    const payload = objectPayload(row.payload);
    output.push(
      field(
        `technical.${row.id}`,
        `requirementRows.${row.id}`,
        payloadTitle(payload, row.section),
        fieldType(payload),
        'technical',
        payload.mandatory !== false && payload.required !== false,
        responseTypeForField(fieldType(payload)),
        'TECHNICAL',
        `requirementRows.${row.section}`,
        validationHints(payload)
      )
    );
  }

  return output.filter((item) => !isDocumentField(item) && !isSampleField(item) && !isFinancialText(`${item.requirementKey} ${item.label}`));
}

function financialFields(workflow: WorkflowType, commercial: CommercialItem[], fields: Record<string, unknown>, requirements: Record<string, unknown>) {
  const output = commercial.map((item, index) =>
    field(
      `financial.price.${safeKey(item.id || String(index + 1))}`,
      `commercialItems.${item.id || index + 1}.unitRate`,
      `Unit rate for ${item.description}`,
      'number',
      'financial',
      true,
      'money',
      'FINANCIAL',
      item.source,
      compact({
        itemId: item.id,
        itemNo: item.itemNo,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        min: 0
      })
    )
  );
  const financialRows = firstArray(fields.financialOfferRows, fields.commercialPricingRows, fields.financialRequirementRows, objectPayload(requirements[workflow]).financialProposalRows);
  if (!output.length) collectRequirementValue('financial.proposal', financialRows, output, 'financial', 'FINANCIAL', 'requirements.financial');
  if (workflow === 'consultancy' && !output.length) {
    output.push(field('financial.proposal', 'financial.proposal', 'Financial proposal', 'table', 'financial', true, 'pricing', 'FINANCIAL', 'system', { minRows: 1 }));
  }
  return output;
}

function documentFields(fields: Record<string, unknown>, requirementRows: Array<{ id: string; section: string; payload: unknown }>, metadata: Record<string, unknown>) {
  const documents: BidSubmissionSchemaFieldDto[] = [];
  collectDocuments(fields.supportingDocumentRows, documents, 'supportingDocumentRows');
  collectDocuments(fields.regulatoryLicenseRequirementRows, documents, 'regulatoryLicenseRequirementRows');
  collectDocuments(fields.eligibilityRequirementCards, documents, 'eligibilityRequirementCards');
  collectDocuments(fields.otherEligibilityRequirements, documents, 'otherEligibilityRequirements');
  collectDocuments(fields.technicalSpecificationDocuments, documents, 'technicalSpecificationDocuments');
  collectRecursiveDocuments(fields, documents);
  collectAttachmentNames(firstArray(metadata.attachments), documents, 'metadata.attachments');

  for (const row of requirementRows) {
    const payload = objectPayload(row.payload);
    const text = `${row.section} ${payloadSummary(payload)}`;
    if (!isDocumentText(text)) continue;
    documents.push(
      fileField(
        `document.${row.id}`,
        `requirementRows.${row.id}`,
        payloadTitle(payload, row.section),
        envelopeFromText(text),
        payload.mandatory !== false && payload.required !== false,
        `requirementRows.${row.section}`,
        payload
      )
    );
  }

  return uniqueFields(documents);
}

function collectDocuments(value: unknown, output: BidSubmissionSchemaFieldDto[], source: string) {
  if (!Array.isArray(value)) return;
  value.filter(isRecord).forEach((row, index) => {
    const label =
      stringValue(row.documentName ?? row.documentTitle ?? row.evidenceRequired ?? row.license ?? row.requirementName ?? row.name ?? row.category) ||
      `${humanize(source)} ${index + 1}`;
    const text = `${source} ${payloadSummary(row)}`;
    output.push(fileField(`document.${source}.${row.id || index + 1}`, `${source}.${row.id || index + 1}`, label, envelopeFromText(text), row.mandatory !== false && row.required !== false, source, row));
  });
}

function collectRecursiveDocuments(value: unknown, output: BidSubmissionSchemaFieldDto[], path = 'requirements') {
  if (Array.isArray(value)) {
    value.filter(isRecord).forEach((row, index) => {
      if (row.requiresUpload === true || row.documentRequired === true || row.requiredAttachment === true) {
        const text = `${path} ${payloadSummary(row)}`;
        output.push(fileField(`document.${safeKey(path)}.${row.id || index + 1}`, `${path}.${row.id || index + 1}`, payloadTitle(row, `${path} ${index + 1}`), envelopeFromText(text), row.mandatory !== false && row.required !== false, path, row));
      }
      Object.entries(row).forEach(([key, child]) => collectRecursiveDocuments(child, output, `${path}.${key}`));
    });
    return;
  }
  if (isRecord(value)) Object.entries(value).forEach(([key, child]) => collectRecursiveDocuments(child, output, `${path}.${key}`));
}

function collectAttachmentNames(values: unknown[], output: BidSubmissionSchemaFieldDto[], source: string) {
  values.forEach((value, index) => {
    const label = typeof value === 'string' ? value : payloadTitle(objectPayload(value), `Required attachment ${index + 1}`);
    if (!label) return;
    output.push(fileField(`document.attachment.${index + 1}`, `${source}.${index + 1}`, label, envelopeFromText(label), true, source, objectPayload(value)));
  });
}

function sampleFields(requirements: Record<string, unknown>, fields: Record<string, unknown>) {
  const rows = firstArray(requirements.sampleRequirements, objectPayload(requirements.goods).fields && objectPayload(objectPayload(requirements.goods).fields).sampleRequirementRows, fields.sampleRequirementRows);
  return rows.filter(isRecord).map((row, index) =>
    field(
      `sample.${row.id || index + 1}`,
      `sampleRequirements.${row.id || index + 1}`,
      stringValue(row.sampleName ?? row.sampleDescription ?? row.description) || `Sample ${index + 1}`,
      'table',
      'samples',
      row.sampleRequired !== false && row.mandatory !== false,
      'structured',
      'TECHNICAL',
      'sampleRequirements',
      compact({
        relatedItem: stringValue(row.relatedBoqItemId ?? row.relatedBoqItem ?? row.relatedItem) || undefined,
        quantity: numberValue(row.numberOfSamples ?? row.quantity),
        deliveryLocation: stringValue(row.deliveryLocation) || undefined,
        deliveryDeadline: stringValue(row.deliveryDeadline) || undefined,
        allowDeliveryAfterClosing: row.allowSampleDeliveryAfterClosing === true
      })
    )
  );
}

function criteriaFields(criteria: Record<string, unknown>[]) {
  return criteria.map((criterion, index) => {
    const label = stringValue(criterion.name ?? criterion.label ?? criterion.title ?? criterion.criterion) || `Evaluation criterion ${index + 1}`;
    const section = isFinancialText(label) ? 'financial' : isAdministrativeText(label) ? 'administrative' : 'technical';
    const envelope: BidSchemaEnvelope = section === 'financial' ? 'FINANCIAL' : section === 'administrative' ? 'ADMINISTRATIVE' : 'TECHNICAL';
    return field(
      `criteria.${safeKey(stringValue(criterion.id) || String(index + 1))}`,
      `evaluationCriteria.${stringValue(criterion.id) || index + 1}`,
      `Response for ${label}`,
      section === 'financial' ? 'number' : 'textarea',
      section,
      true,
      section === 'financial' ? 'money' : 'text',
      envelope,
      'metadata.evaluationCriteria',
      compact({
        criterionId: stringValue(criterion.id) || undefined,
        weight: numberValue(criterion.weight),
        maxScore: numberValue(criterion.maxScore)
      })
    );
  });
}

function declarationFields(fields: Record<string, unknown>) {
  const configured = firstArray(fields.declarationRows, fields.declarations, fields.submissionDeclarations);
  const mapped = configured.filter(isRecord).map((row, index) =>
    field(`declaration.${row.id || index + 1}`, `declarations.${row.id || index + 1}`, payloadTitle(row, `Declaration ${index + 1}`), 'boolean', 'declarations', row.mandatory !== false && row.required !== false, 'declaration', 'COMBINED', 'declarations', validationHints(row))
  );
  return mapped.length
    ? mapped
    : [
        field('declaration.confirmAccuracy', 'declarations.confirmAccuracy', 'I confirm the bid is accurate and complete', 'boolean', 'declarations', true, 'declaration', 'COMBINED', 'system'),
        field('declaration.acceptTerms', 'declarations.acceptTerms', 'I accept the tender and contract terms', 'boolean', 'declarations', true, 'declaration', 'COMBINED', 'system'),
        field('declaration.noConflict', 'declarations.noConflict', 'I declare no conflict of interest', 'boolean', 'declarations', true, 'declaration', 'COMBINED', 'system')
      ];
}

function collectRequirementValue(key: string, value: unknown, output: BidSubmissionSchemaFieldDto[], section: BidSubmissionStepId, envelope: BidSchemaEnvelope, source: string) {
  if (Array.isArray(value)) {
    value.filter(isRecord).forEach((row, index) => {
      const type = fieldType(row);
      output.push(
        field(
          `${section}.${safeKey(key)}.${row.id || index + 1}`,
          `${key}.${row.id || index + 1}`,
          payloadTitle(row, `${humanize(key)} ${index + 1}`),
          type,
          section,
          row.mandatory !== false && row.required !== false,
          responseTypeForField(type),
          envelope,
          source,
          validationHints(row)
        )
      );
    });
    return;
  }
  if (isRecord(value)) {
    if (Array.isArray(value.rows)) collectRequirementValue(key, value.rows, output, section, envelope, source);
    else {
      const type = fieldType(value);
      output.push(field(`${section}.${safeKey(key)}`, key, payloadTitle(value, humanize(key)), type, section, value.mandatory !== false && value.required !== false, responseTypeForField(type), envelope, source, validationHints(value)));
    }
  } else if (typeof value === 'string' && value.trim()) {
    output.push(field(`${section}.${safeKey(key)}`, key, humanize(key), 'textarea', section, true, 'text', envelope, source, { prompt: value.trim() }));
  }
}

function commercialItems(tender: TenderSchemaInput, requirements: Record<string, unknown>, fields: Record<string, unknown>): CommercialItem[] {
  const normalized = (tender.commercialItems ?? []).map((item, index) => ({
    id: item.id || `commercial-${index + 1}`,
    itemNo: item.itemNo,
    description: item.description,
    quantity: numberValue(item.quantity),
    unit: item.unit,
    rate: numberValue(item.rate),
    total: numberValue(item.total),
    source: 'commercialItems'
  }));
  if (normalized.length) return normalized;
  const rows = firstArray(requirements.commercialItems, fields.quantityScheduleRows, fields.boqRows, fields.boqItems, fields.serviceBoqRows, fields.serviceScheduleRows, fields.financialOfferRows, fields.commercialPricingRows);
  return rows.filter(isRecord).map((row, index) => ({
    id: stringValue(row.id) || `commercial-${index + 1}`,
    itemNo: stringValue(row.itemNo ?? row.itemNumber) || String(index + 1),
    description: stringValue(row.description ?? row.itemDescription ?? row.workItem ?? row.serviceTask ?? row.productName ?? row.name) || `Commercial item ${index + 1}`,
    quantity: numberValue(row.quantity),
    unit: stringValue(row.unit ?? row.unitOfMeasure),
    rate: numberValue(row.rate ?? row.unitPrice),
    total: numberValue(row.total ?? row.totalPrice),
    source: 'requirements.commercialItems'
  }));
}

function requirementFields(requirements: Record<string, unknown>, workflow: WorkflowType) {
  const typed = objectPayload(requirements[workflow]);
  const typedFields = objectPayload(typed.fields);
  if (Object.keys(typedFields).length) return typedFields;
  const singular = workflow === 'services' ? 'service' : workflow;
  const alternateFields = objectPayload(objectPayload(requirements[singular]).fields);
  if (Object.keys(alternateFields).length) return alternateFields;
  return objectPayload(requirements.fields);
}

function technicalKeys(workflow: WorkflowType) {
  if (workflow === 'goods') return ['productSpecificationTemplate', 'technicalSpecificationRows', 'productSpecifications', 'deliveryRequirements', 'deliverySchedule', 'warrantyRequirements', 'afterSalesRequirements', 'eligibilityRequirementCards'];
  if (workflow === 'works') return ['scopeSummary', 'mainConstructionActivities', 'technicalSpecificationRows', 'technicalSpecificationDocuments', 'drawingDesignRows', 'siteVisitRequirement', 'worksMilestoneRows', 'personnelRequirementRows', 'equipmentRequirementRows', 'experienceRequirements', 'hseRequirements', 'esRequirementCards'];
  if (workflow === 'services') return ['scopeOfServices', 'serviceRequirements', 'serviceScheduleRows', 'serviceDeliverables', 'serviceMilestones', 'slaRows', 'slaRequirement', 'personnelRequirementRows', 'equipmentRequirementRows', 'reportingRequirements', 'esRequirementCards'];
  if (workflow === 'consultancy') return ['torRows', 'backgroundNarrative', 'consultancyGeneralObjective', 'methodologyRows', 'workPlanRows', 'specificObjectiveRows', 'assignmentActivityRows', 'consultantResponsibilityRows', 'deliverableRows', 'reportingRequirementRows', 'keyExpertRows', 'entityBackgroundCards', 'externalReferenceRows'];
  return [];
}

function step(id: BidSubmissionStepId, label: string, envelope: BidSchemaEnvelope, fields: BidSubmissionSchemaFieldDto[]): BidSubmissionSchemaStepDto {
  return { id, label, envelope, required: fields.some((item) => item.required), fields };
}

function field(
  id: string,
  requirementKey: string,
  label: string,
  type: BidSubmissionFieldType,
  section: BidSubmissionStepId,
  required: boolean,
  responseType: BidSubmissionResponseType,
  envelope: BidSchemaEnvelope,
  source: string,
  validation: Record<string, unknown> = {}
): BidSubmissionSchemaFieldDto {
  return {
    id: safeId(id),
    requirementKey,
    label,
    type,
    section,
    required,
    responseType,
    envelope,
    source,
    validation: sanitizeObject(validation)
  };
}

function fileField(id: string, requirementKey: string, label: string, envelope: BidSchemaEnvelope, required: boolean, source: string, metadata: Record<string, unknown>) {
  return field(id, requirementKey, label, 'file', envelope === 'FINANCIAL' ? 'financial' : envelope === 'TECHNICAL' ? 'technical' : 'administrative', required, 'attachment', envelope, source, {
    documentType: documentType(label, envelope),
    ...validationHints(metadata)
  });
}

function validationHints(payload: Record<string, unknown>) {
  return compact({
    min: numberValue(payload.min),
    max: numberValue(payload.max),
    maxLength: numberValue(payload.maxLength),
    minRows: numberValue(payload.minRows),
    maxRows: numberValue(payload.maxRows),
    options: Array.isArray(payload.options) ? payload.options.filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') : undefined,
    prompt: stringValue(payload.prompt ?? payload.description ?? payload.requirementDescription) || undefined
  });
}

function evaluationCriteria(metadata: Record<string, unknown>) {
  const criteria = metadata.evaluationCriteria;
  if (Array.isArray(criteria)) return criteria.filter(isRecord);
  if (isRecord(criteria)) return Object.values(criteria).filter(isRecord);
  return [];
}

function workflowFromTenderType(type: unknown): WorkflowType {
  const value = String(type || '').toLowerCase();
  if (value.includes('goods')) return 'goods';
  if (value.includes('works')) return 'works';
  if (value.includes('service') || value.includes('non_consultancy') || value.includes('non consultancy') || value.includes('non-consultancy')) return 'services';
  if (value.includes('consultancy')) return 'consultancy';
  return 'generic';
}

function envelopeFromText(text: string): BidSchemaEnvelope {
  const value = text.toLowerCase();
  if (/financial|commercial|price|pricing|boq|bank|turnover|tax|fee|cost/.test(value)) return 'FINANCIAL';
  if (/administrative|eligibility|registration|license|certificate|authorization|statutory/.test(value)) return 'ADMINISTRATIVE';
  if (/technical|method|spec|personnel|equipment|sla|\btor\b|drawing|hse|scope|sample|warranty|delivery/.test(value)) return 'TECHNICAL';
  if (/combined|declaration|submission/.test(value)) return 'COMBINED';
  return 'ADMINISTRATIVE';
}

function fieldType(row: Record<string, unknown>): BidSubmissionFieldType {
  const text = `${row.type || ''} ${row.fieldType || ''} ${row.inputType || ''}`.toLowerCase();
  if (text.includes('number') || text.includes('money') || text.includes('currency')) return 'number';
  if (text.includes('date')) return 'date';
  if (text.includes('select')) return 'select';
  if (text.includes('toggle') || text.includes('boolean') || text.includes('yesno')) return 'boolean';
  if (text.includes('file') || text.includes('upload')) return 'file';
  if (text.includes('table') || text.includes('rows')) return 'table';
  return 'textarea';
}

function responseTypeForField(type: BidSubmissionFieldType): BidSubmissionResponseType {
  if (type === 'file') return 'attachment';
  if (type === 'boolean') return 'boolean';
  if (type === 'number') return 'number';
  if (type === 'date') return 'date';
  if (type === 'table') return 'structured';
  return 'text';
}

function documentType(label: string, envelope: BidSchemaEnvelope) {
  const prefix = envelope === 'ADMINISTRATIVE' ? 'ADMIN' : envelope;
  return `${prefix}_${normalize(label).replace(/\s+/g, '_').toUpperCase() || 'DOCUMENT'}`.slice(0, 120);
}

function uniqueFields(fields: BidSubmissionSchemaFieldDto[]) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = `${field.section}:${field.envelope}:${normalize(field.requirementKey || field.label)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isDocumentField(field: BidSubmissionSchemaFieldDto) {
  return field.type === 'file' || isDocumentText(`${field.requirementKey} ${field.label}`);
}

function isSampleField(field: BidSubmissionSchemaFieldDto) {
  return /sample/i.test(`${field.requirementKey} ${field.label}`);
}

function isDocumentText(text: string) {
  return /document|license|certificate|registration|evidence|upload|attachment|authorization|cv|brochure/i.test(text);
}

function isFinancialText(text: string) {
  return /financial|commercial|price|pricing|boq|bank|turnover|tax|fee|cost|payment/i.test(text);
}

function isTechnicalText(text: string) {
  return /technical|method|spec|personnel|equipment|sla|tor|scope|hse|experience|schedule|delivery|warranty|after.sales|work plan|deliverable|site visit|sample/i.test(text) && !isDocumentText(text) && !isFinancialText(text);
}

function isAdministrativeText(text: string) {
  return /administrative|eligibility|registration|license|tax|statutory|authorization|certificate/i.test(text);
}

function firstArray(...values: unknown[]) {
  return (values.find(Array.isArray) as unknown[] | undefined) ?? [];
}

function payloadTitle(payload: Record<string, unknown>, fallback: string) {
  return (
    stringValue(
      payload.title ??
        payload.label ??
        payload.name ??
        payload.role ??
        payload.position ??
        payload.positionTitle ??
        payload.equipmentName ??
        payload.requirementName ??
        payload.documentName ??
        payload.documentTitle ??
        payload.category ??
        payload.specificationName ??
        payload.description ??
        payload.sampleDescription
    ) || humanize(fallback)
  );
}

function payloadSummary(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([key]) => !isPrivateKey(key))
    .map(([, value]) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''))
    .filter(Boolean)
    .join(' ');
}

function sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => !isPrivateKey(key) && item !== undefined && item !== '')
      .map(([key, item]) => [key, sanitizeValue(item)])
      .filter(([, item]) => item !== undefined)
  );
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue).filter((item) => item !== undefined);
  if (isRecord(value)) return sanitizeObject(value);
  return value;
}

function isPrivateKey(key: string) {
  return /buyer.*note|buyerOnly|internal|private|confidential|secret|evaluationOnly|ownerNote/i.test(key);
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function humanize(value: string) {
  return value
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '.').replace(/\.+/g, '.').replace(/^\./, '').replace(/\.$/, '');
}

function safeKey(value: string) {
  return safeId(value || 'field');
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
