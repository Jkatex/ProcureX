import type {
  BidSchemaEnvelope,
  BidSubmissionFieldType,
  BidSubmissionResponseType,
  BidSubmissionSection,
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
  sourceId?: string;
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
  const commercial = commercialItems(tender, requirements, fields, workflow);
  const samples = sampleFields(requirements, fields);
  const criteria = evaluationCriteria(metadata);
  const documents = documentFields(fields, requirementRows, metadata, workflow);
  const dynamicRequirements = dynamicRequirementFields(requirements, workflow);
  const workflowResponses = workflowResponseFields(fields, commercial, workflow);

  const administrative = uniqueFields([
    field('administrative.eligible', 'administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', true, 'boolean', 'ADMINISTRATIVE', 'system'),
    ...goodsAdministrativeFields(fields, workflow),
    ...documents.filter((item) => item.section === 'administrative'),
    ...dynamicRequirements.filter((item) => item.section === 'administrative')
  ]);
  const technical = uniqueFields([
    ...technicalFields(workflow, requirements, fields, requirementRows),
    ...workflowResponses.filter((item) => item.section === 'technical'),
    ...documents.filter((item) => item.section === 'technical'),
    ...(workflow === 'goods' ? [] : dynamicRequirements.filter((item) => item.section === 'technical')),
    ...(workflow === 'goods' ? [] : criteriaFields(criteria).filter((item) => item.section === 'technical'))
  ]);
  const financial = uniqueFields([
    ...financialFields(workflow, commercial, fields, requirements),
    ...workflowResponses.filter((item) => item.section === 'financial'),
    ...documents.filter((item) => item.section === 'financial'),
    ...dynamicRequirements.filter((item) => item.section === 'financial'),
    ...criteriaFields(criteria).filter((item) => item.section === 'financial')
  ]);
  const declarations = declarationFields(fields, workflow);

  const steps = workflowSteps(workflow, { administrative, technical, financial, samples, declarations });

  return {
    tenderId: tender.id,
    tenderReference: tender.reference,
    tenderTitle: tender.title,
    tenderType: String(tender.type || 'UNKNOWN'),
    schemaVersion,
    steps
  };
}

function workflowSteps(
  workflow: WorkflowType,
  groups: {
    administrative: BidSubmissionSchemaFieldDto[];
    technical: BidSubmissionSchemaFieldDto[];
    financial: BidSubmissionSchemaFieldDto[];
    samples: BidSubmissionSchemaFieldDto[];
    declarations: BidSubmissionSchemaFieldDto[];
  }
): BidSubmissionSchemaStepDto[] {
  const review = reviewFields();
  const eligibility = step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', groups.administrative);

  if (workflow === 'goods') {
    return compactSteps([
      eligibility,
      step('goodsTechnical', 'Technical Response', 'TECHNICAL', groups.technical),
      step('goodsFinancial', 'Quantity Schedule / Financial Offer', 'FINANCIAL', groups.financial),
      groups.samples.length ? step('goodsSamples', 'Sample Submission', 'TECHNICAL', groups.samples) : null,
      step('goodsReview', 'Review Submission', 'COMBINED', review),
      step('goodsDeclaration', 'Supplier Declaration and Submit', 'COMBINED', groups.declarations)
    ]);
  }

  if (workflow === 'works') {
    const capacity = groups.technical.filter(isWorksCapacityField);
    const proposal = groups.technical.filter((field) => !capacity.includes(field));
    const financialCapacity = groups.financial.filter(isWorksCapacityField);
    const pricing = groups.financial.filter((field) => !financialCapacity.includes(field));
    return compactSteps([
      eligibility,
      step('worksCapacity', 'Technical Capacity and Experience', 'TECHNICAL', capacity),
      step('worksTechnicalProposal', 'Technical Proposal and Work Program', 'TECHNICAL', proposal),
      step('worksFinancial', 'Financial Proposal / BOQ Pricing', 'FINANCIAL', uniqueFields([...pricing, ...financialCapacity])),
      step('worksReview', 'Review Submission', 'COMBINED', review),
      step('worksDeclaration', 'Declaration and Submission', 'COMBINED', groups.declarations)
    ]);
  }

  if (workflow === 'services') {
    const methodology = groups.technical.filter((field) => /methodology|scope|understanding|approach/i.test(stepRouteText(field)));
    const delivery = groups.technical.filter((field) => !methodology.includes(field) && /delivery|deliverable|milestone|schedule/i.test(stepRouteText(field)));
    const staffing = groups.technical.filter((field) => !methodology.includes(field) && !delivery.includes(field) && /staff|personnel|supervision|equipment|tools|capacity|continuity/i.test(stepRouteText(field)));
    const sla = groups.technical.filter((field) => !methodology.includes(field) && !delivery.includes(field) && !staffing.includes(field));
    return compactSteps([
      eligibility,
      step('servicesMethodology', 'Service Understanding and Methodology', 'TECHNICAL', methodology.length ? methodology : groups.technical.slice(0, 1)),
      step('servicesDeliveryPlan', 'Service Schedule and Delivery Plan', 'TECHNICAL', delivery),
      step('servicesStaffing', 'Staffing, Capacity and Continuity Plan', 'TECHNICAL', staffing),
      step('servicesSla', 'Performance, SLA, Reporting and Compliance', 'TECHNICAL', sla),
      step('servicesCommercial', 'Commercial Pricing and Cost Breakdown', 'FINANCIAL', groups.financial),
      step('servicesReview', 'Review Submission', 'COMBINED', uniqueFields([...groups.declarations, ...review]))
    ]);
  }

  if (workflow === 'consultancy') {
    return compactSteps([
      eligibility,
      step('consultancyTechnical', 'Technical Proposal', 'TECHNICAL', groups.technical),
      step('consultancyFinancial', 'Financial Proposal', 'FINANCIAL', groups.financial),
      step('consultancyReview', 'Review and Submit', 'COMBINED', uniqueFields([...groups.declarations, ...review]))
    ]);
  }

  return compactSteps([
    eligibility,
    groups.technical.length ? step('technical', 'Technical Response', 'TECHNICAL', groups.technical) : null,
    groups.financial.length ? step('financial', 'Financial Offer', 'FINANCIAL', groups.financial) : null,
    groups.samples.length ? step('samples', 'Sample Submission', 'TECHNICAL', groups.samples) : null,
    step('declarations', 'Declarations and Submit', 'COMBINED', groups.declarations),
    step('review', 'Review Submission', 'COMBINED', review)
  ]);
}

function compactSteps(steps: Array<BidSubmissionSchemaStepDto | null>): BidSubmissionSchemaStepDto[] {
  return steps.filter((item): item is BidSubmissionSchemaStepDto => Boolean(item));
}

function reviewFields() {
  return [
    field('review.confirmComplete', 'review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', true, 'acknowledgement', 'COMBINED', 'system')
  ];
}

function isWorksCapacityField(field: BidSubmissionSchemaFieldDto) {
  const text = stepRouteText(field);
  if (/works\.(proposal|schedule|drawings|design|siteVisit)|worksProposalNarrative|worksSchedule|worksDrawingDesign|worksSiteVisit/i.test(text)) return false;
  return /capacity|experience|similar|project|personnel|expert|cv|qualification|equipment|plant|hse|safety|environment|financial capacity|bank|statement|credit/i.test(text);
}

function stepRouteText(field: BidSubmissionSchemaFieldDto) {
  return `${field.id} ${field.requirementKey} ${field.label} ${field.source} ${field.validation.control ?? ''} ${field.validation.prompt ?? ''}`;
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
  if (workflow === 'goods') return output;

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
        control: workflow === 'works' ? 'worksBoqCostBreakdown' : undefined,
        itemId: item.id,
        sourceId: item.sourceId,
        aliases: commercialItemAliases(item),
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
  if (workflow === 'works') output.push(...worksCommercialTermFields(fields));
  return output;
}

function goodsFinancialRequirementFields(value: unknown) {
  return financialRequirementRows(value).map((row, index) => {
    const title = payloadTitle(row, `Financial capacity requirement ${index + 1}`);
    const rowId = stringValue(row.id) || String(index + 1);
    return field(
      `goods.financialRequirement.${safeKey(rowId)}`,
      `goods.financialRequirement.${rowId}`,
      title,
      'table',
      'administrative',
      row.mandatory !== false && row.required !== false,
      'structured',
      'ADMINISTRATIVE',
      'requirements.goods.financialRequirementRows',
      compact({
        control: 'goodsFinancialRequirement',
        aliases: [`requirements.goods.fields.financialRequirementRows.${rowId}`],
        requirementName: title,
        minimumValue: stringValue(row.minimumValue ?? row.minValue ?? row.value ?? row.threshold) || undefined,
        evidenceRequired: stringValue(row.evidenceRequired ?? row.documentName ?? row.documentTitle) || undefined,
        prompt: stringValue(row.description ?? row.requirementDescription ?? row.notes) || payloadSummary(row),
        rowIndex: index + 1
      })
    );
  });
}

function documentFields(fields: Record<string, unknown>, requirementRows: Array<{ id: string; section: string; payload: unknown }>, metadata: Record<string, unknown>, workflow: WorkflowType) {
  const documents: BidSubmissionSchemaFieldDto[] = [];
  collectDocuments(fields.supportingDocumentRows, documents, 'supportingDocumentRows');
  if (workflow !== 'goods') collectDocuments(fields.regulatoryLicenseRequirementRows, documents, 'regulatoryLicenseRequirementRows');
  collectDocuments(fields.eligibilityRequirementCards, documents, 'eligibilityRequirementCards');
  collectDocuments(fields.otherEligibilityRequirements, documents, 'otherEligibilityRequirements');
  collectDocuments(fields.technicalSpecificationDocuments, documents, 'technicalSpecificationDocuments');
  collectRecursiveDocuments(workflow === 'goods' ? { ...fields, regulatoryLicenseRequirementRows: [] } : fields, documents);
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

const dynamicSkipKeyPattern =
  /contractClauseCards$|quantityScheduleRows|boqRows|boqItems|lumpSumPricingRows|commercialPricingRows|financialOfferRows|serviceBoqRows|productSpecificationTemplate|sampleRequirementRows|supportingDocumentRows|regulatoryLicenseRequirementRows|regulatoryLicenseRows|eligibilityRequirementCards|otherEligibilityRequirements|technicalSpecificationDocuments|declarationRows|declarations|submissionDeclarations/i;

function dynamicRequirementFields(requirements: Record<string, unknown>, workflow: WorkflowType) {
  const output: BidSubmissionSchemaFieldDto[] = [];
  const containers = requirementContainers(requirements, workflow);

  for (const [path, container] of containers) {
    Object.entries(objectPayload(container.fields)).forEach(([key, value]) => collectDynamicRequirement(`${path}.fields.${key}`, key, value, output));
    Object.entries(objectPayload(container.lists)).forEach(([key, value]) => collectDynamicRequirement(`${path}.lists.${key}`, key, value, output));
  }

  Object.entries(objectPayload(requirements.fields)).forEach(([key, value]) => collectDynamicRequirement(`requirements.fields.${key}`, key, value, output));
  Object.entries(objectPayload(requirements.lists)).forEach(([key, value]) => collectDynamicRequirement(`requirements.lists.${key}`, key, value, output));

  return uniqueFields(output);
}

function requirementContainers(requirements: Record<string, unknown>, workflow: WorkflowType): Array<[string, Record<string, unknown>]> {
  const singular = workflow === 'services' ? 'service' : workflow;
  return [
    [`requirements.${workflow}`, objectPayload(requirements[workflow])],
    [`requirements.${singular}`, objectPayload(requirements[singular])]
  ].filter(([, value]) => Object.keys(value).length) as Array<[string, Record<string, unknown>]>;
}

function collectDynamicRequirement(path: string, key: string, value: unknown, output: BidSubmissionSchemaFieldDto[]) {
  if (dynamicSkipKeyPattern.test(key) || !isMeaningfulRequirementValue(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (!isMeaningfulRequirementValue(item)) return;
      const payload: Record<string, unknown> = isRecord(item) ? item : { text: item };
      pushDynamicRequirement(`${path}.${stringValue(payload.id) || index + 1}`, key, payload, output, index);
    });
    return;
  }
  if (isRecord(value)) {
    pushDynamicRequirement(path, key, value, output, 0);
    return;
  }
  if (typeof value === 'boolean') {
    if (!value || !/required|mandatory|need|upload|cv|certificate|statement|license|declaration|confirm/i.test(key)) return;
    pushDynamicRequirement(path, key, { title: humanize(key).replace(/\s+(Required|Mandatory)$/i, ''), mandatory: true, responseType: 'boolean' }, output, 0);
    return;
  }
  if (/required|mandatory|upload|certificate|license|evidence|declaration|confirm|technical|method|scope|schedule|delivery|warranty|financial|price|cost/i.test(key)) {
    pushDynamicRequirement(path, key, { title: humanize(key), description: stringValue(value), mandatory: /required|mandatory/i.test(key) }, output, 0);
  }
}

function pushDynamicRequirement(path: string, key: string, payload: Record<string, unknown>, output: BidSubmissionSchemaFieldDto[], index: number) {
  const title = payloadTitle(payload, `${humanize(key)} ${index + 1}`);
  if (!title || !isSupplierFacingRequirement(key, payload)) return;
  const text = `${key} ${title} ${payloadSummary(payload)}`;
  const dynamicType = dynamicFieldType(text, payload);
  const envelope = envelopeFromText(text);
  const section: BidSubmissionSection = envelope === 'FINANCIAL' ? 'financial' : envelope === 'ADMINISTRATIVE' ? 'administrative' : 'technical';
  const required = dynamicRequirementRequired(key, payload);
  const validation = validationHints({ ...payload, prompt: stringValue(payload.description ?? payload.notes ?? payload.requirementDescription) || undefined });

  if (dynamicType === 'file') {
    output.push(fileField(`dynamic.${safeKey(path)}`, path, title, envelope === 'COMBINED' ? 'ADMINISTRATIVE' : envelope, required, 'requirements.dynamic', payload));
    return;
  }

  output.push(
    field(
      `dynamic.${safeKey(path)}`,
      path,
      title,
      dynamicType,
      section,
      required,
      responseTypeForField(dynamicType),
      envelope === 'COMBINED' ? 'TECHNICAL' : envelope,
      'requirements.dynamic',
      validation
    )
  );
}

function dynamicFieldType(text: string, payload: Record<string, unknown>): BidSubmissionFieldType {
  if (stringValue(payload.responseType).toLowerCase() === 'boolean') return 'boolean';
  if (stringValue(payload.responseType).toLowerCase() === 'upload') return 'file';
  const configured = fieldType(payload);
  if (configured !== 'textarea' || /type|fieldType|inputType/i.test(Object.keys(payload).join(' '))) return configured;
  if (payload.requiresUpload === true || isDocumentText(text)) return 'file';
  if (/declaration|acknowledge|confirm|eligibility|conflict|anti.corruption|anti corruption/i.test(text)) return 'boolean';
  if (isFinancialText(text)) return 'number';
  return 'textarea';
}

function dynamicRequirementRequired(key: string, payload: Record<string, unknown>) {
  if (payload.mandatory === false || payload.required === false) return false;
  if (['mandatory', 'mandatoryActivity', 'required', 'sampleRequired', 'requiresUpload', 'cvRequired'].some((fieldName) => normalizeFlag(payload[fieldName]))) return true;
  return /required|mandatory/i.test(key);
}

function isSupplierFacingRequirement(key: string, payload: Record<string, unknown>) {
  const text = `${key} ${payloadSummary(payload)}`;
  if (isPrivateKey(key) || /buyerOnly|internal|evaluationOnly/i.test(text)) return false;
  return isDocumentText(text) || isFinancialText(text) || isTechnicalText(text) || isAdministrativeText(text) || /required|mandatory|declaration|confirm|cv|certificate|license|evidence|method|scope|schedule|delivery|warranty|personnel|equipment|experience/i.test(text);
}

function isMeaningfulRequirementValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(isMeaningfulRequirementValue);
  if (isRecord(value)) return Object.entries(value).some(([key, item]) => !isPrivateKey(key) && isMeaningfulRequirementValue(item));
  return false;
}

function normalizeFlag(value: unknown) {
  if (value === true) return true;
  return /^(yes|true|required|mandatory|1)$/i.test(stringValue(value));
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

function workflowResponseFields(fields: Record<string, unknown>, commercial: CommercialItem[], workflow: WorkflowType) {
  if (workflow === 'goods') return goodsWorkflowFields(fields);
  if (workflow === 'works') return worksWorkflowFields(fields);
  if (workflow === 'services') return serviceWorkflowFields(fields);
  if (workflow === 'consultancy') return consultancyWorkflowFields(fields);
  return [];
}

function goodsWorkflowFields(fields: Record<string, unknown>) {
  const output: BidSubmissionSchemaFieldDto[] = [];
  const rows = uniqueProductSpecificationRows([
    ...productSpecificationRows(fields.productSpecificationTemplate),
    ...productSpecificationRows(fields.technicalSpecificationRows)
  ]);

  rows.forEach((row, index) => {
    const title = stringValue(row.productName ?? row.requestedProduct ?? row.productDescription ?? row.itemDescription ?? row.description ?? row.specificationName) || `Product specification ${index + 1}`;
    const buyerSpecification = goodsSpecificationText(row, title);
    output.push(
      field(
        `goods.productSpecification.${row.id || index + 1}`,
        `goods.productSpecification.${row.id || index + 1}`,
        `Product specification response - ${title}`,
        'table',
        'technical',
        row.mandatory !== false,
        'structured',
        'TECHNICAL',
        'requirements.goods.productSpecificationTemplate',
        compact({
          control: 'goodsProductSpecification',
          itemNo: stringValue(row.itemNo ?? row.itemNumber) || String(index + 1),
          requestedProduct: title,
          buyerSpecification: buyerSpecification || undefined,
          quantity: numberValue(row.quantity),
          unit: stringValue(row.unit ?? row.unitOfMeasure) || undefined,
          attachmentPolicy: stringValue(row.attachmentPolicy ?? row.evidencePolicy ?? row.technicalEvidencePolicy) || undefined,
          evidenceRequired: stringValue(row.evidenceRequired ?? row.evidence ?? row.documentName ?? row.documentTitle) || undefined,
          requiresUpload: row.requiresUpload === true || row.documentRequired === true || undefined,
          documentType: stringValue(row.documentType ?? row.evidenceDocumentType) || undefined,
          prompt: payloadSummary(row)
        })
      )
    );
  });

  return output;
}

function goodsSpecificationText(row: Record<string, unknown>, title: string) {
  const direct = stringValue(row.specification ?? row.technicalSpecification ?? row.materialQuality ?? row.minimumSpecification ?? row.specificDetail ?? row.specificDetailRequired ?? row.value);
  if (direct) return direct;
  const parts = [row.specificationName, row.requirementName, row.requirement, row.detail]
    .map(stringValue)
    .filter((value) => value && value.toLowerCase() !== title.toLowerCase() && !/^[\w-]{8,}$/i.test(value));
  return parts.join(' / ');
}

function goodsAdministrativeFields(fields: Record<string, unknown>, workflow: WorkflowType) {
  if (workflow !== 'goods') return [];
  const financialFields = goodsFinancialRequirementFields(fields.financialRequirementRows);
  const licenseFields = regulatoryLicenseRows(fields.regulatoryLicenseRequirementRows).map((row, index) => {
    const title = payloadTitle(row, `Regulatory license ${index + 1}`);
    return field(
      `goods.regulatoryLicense.${safeKey(stringValue(row.id) || String(index + 1))}`,
      `goods.regulatoryLicense.${stringValue(row.id) || index + 1}`,
      title,
      'table',
      'administrative',
      row.mandatory !== false && row.required !== false,
      'structured',
      'ADMINISTRATIVE',
      'requirements.goods.regulatoryLicenseRequirementRows',
      compact({
        control: 'goodsRegulatoryLicense',
        licenseName: title,
        issuingAuthority: stringValue(row.issuingAuthority ?? row.issuingBody ?? row.authority ?? row.board) || undefined,
        category: stringValue(row.category ?? row.licenseType) || undefined,
        prompt: stringValue(row.description ?? row.requirementDescription ?? row.evidenceRequired) || payloadSummary(row),
        rowIndex: index + 1
      })
    );
  });
  return [...financialFields, ...licenseFields];
}

function worksWorkflowFields(fields: Record<string, unknown>) {
  const output: BidSubmissionSchemaFieldDto[] = [];
  const siteVisitText = stringValue(fields.siteVisitRequirement);
  if (siteVisitText) {
    output.push(
      field('works.siteVisit', 'works.siteVisit', 'Site visit response', 'select', 'technical', /mandatory|required/i.test(siteVisitText), 'text', 'TECHNICAL', 'requirements.works.siteVisitRequirement', {
        control: 'worksSiteVisit',
        prompt: siteVisitText,
        options: ['Conducted', 'Scheduled', 'Not conducted', 'Not applicable']
      })
    );
    output.push(fileField('works.siteVisitEvidence', 'works.siteVisitEvidence', 'Site visit evidence upload', 'TECHNICAL', /mandatory|required/i.test(siteVisitText), 'requirements.works.siteVisitRequirement', { prompt: siteVisitText }));
  }

  if (normalizeFlag(fields.similarCompletedProjectsRequired)) {
    output.push(structuredWorkflowField('works.similarProjects', 'Similar completed project evidence', 'worksSimilarProject', true, 'requirements.works.similarCompletedProjectsRequired', fields));
  }
  if (normalizeFlag(fields.keyPersonnelCvsRequired)) {
    output.push(structuredWorkflowField('works.keyPersonnel', 'Key personnel CV and qualification response', 'worksPersonnel', true, 'requirements.works.keyPersonnelCvsRequired', fields));
  }
  if (normalizeFlag(fields.bankStatementsRequired)) {
    output.push(fileField('works.financialCapacityEvidence', 'works.financialCapacityEvidence', 'Financial capacity and bank statement evidence', 'FINANCIAL', true, 'requirements.works.bankStatementsRequired', { prompt: stringValue(fields.bankStatementPeriod) || 'Upload bank statements or financial capacity evidence.' }));
  }

  collectWorkflowRows(fields.personnelRequirementRows, output, 'works.personnelRequirement', 'worksPersonnel', 'Personnel requirement response');
  collectWorkflowRows(fields.equipmentRequirementRows, output, 'works.equipmentRequirement', 'worksEquipment', 'Equipment availability response');
  collectWorkflowRows(fields.worksMilestoneRows, output, 'works.workProgram', 'worksWorkProgram', 'Work program and milestone response');
  output.push(...worksTechnicalProposalFields(fields));
  collectWorkflowText(fields.mainConstructionActivities ?? fields.scopeSummary, output, 'works.methodStatement', 'Method statement and scope response', 'worksMethodStatement', true);
  return output;
}

function worksTechnicalProposalFields(fields: Record<string, unknown>) {
  const scope = stringValue(fields.scopeSummary ?? fields.mainConstructionActivities);
  const methodStatementRequired = [fields.methodStatementRequired, fields.requireMethodStatement, fields.methodStatement, fields.mainConstructionActivities].some(normalizeFlag);
  const workProgramRequired = [fields.ganttChartRequired, fields.requireGanttChart, fields.workProgramRequired, fields.requireWorkProgram].some(normalizeFlag);
  const siteVisitRequired = /mandatory|required/i.test(stringValue(fields.siteVisitRequirement));
  return [
    field('works.proposal.understanding', 'works.proposal.understanding', 'Project Understanding', 'textarea', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.technicalProposal', { control: 'worksProposalNarrative', prompt: scope || 'Understanding of buyer scope, site conditions, drawings, constraints, and deliverables.' }),
    field('works.proposal.methodology', 'works.proposal.methodology', 'Construction Methodology', 'textarea', 'technical', methodStatementRequired, 'text', 'TECHNICAL', 'requirements.works.technicalProposal', { control: 'worksProposalNarrative', prompt: 'Construction sequence, methods, supervision controls, testing, and handover approach.' }),
    field('works.proposal.riskPlan', 'works.proposal.riskPlan', 'Risk Mitigation Plan', 'textarea', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.technicalProposal', { control: 'worksProposalNarrative', prompt: 'Technical, schedule, safety, environmental, and commercial risk controls.' }),
    field('works.proposal.qualityPlan', 'works.proposal.qualityPlan', 'Quality Assurance Approach', 'textarea', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.technicalProposal', { control: 'worksProposalNarrative', prompt: 'Inspection test plans, material approvals, workmanship control, and QA/QC records.' }),
    field('works.schedule.startDate', 'works.schedule.startDate', 'Proposed Start Date', 'date', 'technical', workProgramRequired, 'date', 'TECHNICAL', 'requirements.works.workProgram', { control: 'worksSchedule' }),
    field('works.schedule.completionPeriod', 'works.schedule.completionPeriod', 'Proposed Completion Period', 'text', 'technical', workProgramRequired, 'text', 'TECHNICAL', 'requirements.works.workProgram', { control: 'worksSchedule', prompt: stringValue(fields.completionPeriod) || undefined }),
    field('works.schedule.workPlan', 'works.schedule.workPlan', 'Proposed Work Plan', 'textarea', 'technical', workProgramRequired, 'text', 'TECHNICAL', 'requirements.works.workProgram', { control: 'worksSchedule', prompt: 'Describe the work breakdown, sequencing, mobilization, subcontractors, materials, site logistics, and how the uploaded work program will be executed.' }),
    field('works.schedule.resources', 'works.schedule.resources', 'Resource Allocation Plan', 'textarea', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.workProgram', { control: 'worksSchedule' }),
    fileField('works.schedule.workProgramUpload', 'works.schedule.workProgramUpload', 'Upload work program', 'TECHNICAL', workProgramRequired, 'requirements.works.workProgram', { control: 'worksSchedule', prompt: 'Upload work program, milestone plan, Gantt chart, or schedule file.' }),
    field('works.drawings.reviewedAcknowledgement', 'works.drawings.reviewedAcknowledgement', 'Drawing reviewed acknowledgement', 'boolean', 'technical', false, 'acknowledgement', 'TECHNICAL', 'requirements.works.drawingDesignRows', { control: 'worksDrawingDesign' }),
    field('works.design.clarificationNeeded', 'works.design.clarificationNeeded', 'Design Clarification Needed', 'select', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.drawingDesignRows', { control: 'worksDrawingDesign', options: ['Yes', 'No'] }),
    field('works.design.alternativeProposed', 'works.design.alternativeProposed', 'Alternative Design Proposed?', 'select', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.drawingDesignRows', { control: 'worksDrawingDesign', options: ['Yes', 'No'] }),
    fileField('works.design.alternativeUpload', 'works.design.alternativeUpload', 'Upload proposed alternative designs', 'TECHNICAL', false, 'requirements.works.drawingDesignRows', { control: 'worksDrawingDesign' }),
    field('works.design.alternative', 'works.design.alternative', 'Proposed Design Alternative', 'textarea', 'technical', false, 'text', 'TECHNICAL', 'requirements.works.drawingDesignRows', { control: 'worksDrawingDesign', prompt: 'Describe the proposed alternative design, affected drawings, technical rationale, compliance basis, assumptions, and any buyer approval required.' }),
    field('works.siteVisit.notes', 'works.siteVisit.notes', 'Site Visit Notes', 'textarea', 'technical', siteVisitRequired, 'text', 'TECHNICAL', 'requirements.works.siteVisitRequirement', { control: 'worksSiteVisit', prompt: stringValue(fields.siteVisitRequirement) || undefined })
  ];
}

function worksCommercialTermFields(fields: Record<string, unknown>) {
  const bidSecurityRequired = [fields.bidSecurityRequired, fields.requireBidSecurity, fields.bidSecurity].some(normalizeFlag);
  return [
    field('works.commercial.bidValidity', 'works.commercial.bidValidity', 'Bid Validity Period (days)', 'number', 'financial', true, 'number', 'FINANCIAL', 'requirements.works.commercialTerms', { control: 'worksCommercialTerms', min: 1 }),
    field('works.commercial.currency', 'works.commercial.currency', 'Currency', 'select', 'financial', true, 'text', 'FINANCIAL', 'requirements.works.commercialTerms', { control: 'worksCommercialTerms', options: ['TZS', 'USD', 'EUR', 'GBP'] }),
    field('works.commercial.clarifications', 'works.commercial.clarifications', 'Commercial Clarifications', 'textarea', 'financial', false, 'text', 'FINANCIAL', 'requirements.works.commercialTerms', { control: 'worksCommercialTerms', prompt: 'Optional BOQ pricing assumptions only. Contract terms are handled after award.' }),
    field('works.commercial.bidSecuritySubmitted', 'works.commercial.bidSecuritySubmitted', 'Bid security submitted, if required by this tender.', 'boolean', 'financial', bidSecurityRequired, 'boolean', 'FINANCIAL', 'requirements.works.commercialTerms', { control: 'worksCommercialTerms' }),
    fileField('works.commercial.bidSecurityDocument', 'works.commercial.bidSecurityDocument', 'Bid security document', 'FINANCIAL', false, 'requirements.works.commercialTerms', { control: 'worksCommercialTerms' })
  ];
}

function serviceWorkflowFields(fields: Record<string, unknown>) {
  const output: BidSubmissionSchemaFieldDto[] = [];
  collectWorkflowText(fields.scopeOfServices, output, 'services.methodology', 'Service methodology response', 'serviceMethodology', true);
  collectWorkflowRows(fields.personnelRequirementRows, output, 'services.personnelRequirement', 'serviceStaffing', 'Staffing and supervision response');
  collectWorkflowRows(fields.equipmentRequirementRows, output, 'services.equipmentRequirement', 'serviceEquipment', 'Tools and equipment response');
  collectWorkflowRows(fields.serviceMilestones, output, 'services.deliveryMilestone', 'serviceMilestone', 'Delivery milestone response');
  collectWorkflowRows(fields.serviceDeliverables, output, 'services.deliverable', 'serviceDeliverable', 'Service deliverable response');
  collectWorkflowText(fields.slaRequirement, output, 'services.sla', 'SLA and performance response', 'serviceSla', true);
  collectWorkflowText(fields.reportingRequirements, output, 'services.reporting', 'Reporting and communication response', 'serviceReporting', false);
  collectWorkflowText(fields.riskAssessmentRequirement, output, 'services.riskManagement', 'Risk, safety, and continuity response', 'serviceRisk', false);
  return output;
}

function consultancyWorkflowFields(fields: Record<string, unknown>) {
  const output: BidSubmissionSchemaFieldDto[] = [];
  collectWorkflowText(fields.consultancyGeneralObjective ?? fields.backgroundNarrative, output, 'consultancy.torUnderstanding', 'TOR understanding and methodology response', 'consultancyTorUnderstanding', true);
  collectWorkflowRows(fields.specificObjectiveRows, output, 'consultancy.specificObjective', 'consultancyObjective', 'Specific objective response');
  collectWorkflowRows(fields.assignmentActivityRows, output, 'consultancy.assignmentActivity', 'consultancyActivity', 'Assignment activity response');
  collectWorkflowRows(fields.consultantResponsibilityRows, output, 'consultancy.consultantResponsibility', 'consultancyResponsibility', 'Consultant responsibility response');
  collectWorkflowRows(fields.deliverableRows, output, 'consultancy.deliverable', 'consultancyDeliverable', 'Deliverable response');
  collectWorkflowRows(fields.reportingRequirementRows, output, 'consultancy.reporting', 'consultancyReporting', 'Reporting response');
  collectWorkflowRows(fields.keyExpertRows, output, 'consultancy.keyExpert', 'consultancyKeyExpert', 'Key expert response');
  return output;
}

function productSpecificationRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  const payload = objectPayload(value);
  if (Array.isArray(payload.rows)) return payload.rows.filter(isRecord).map((row) => objectPayload(row.values ?? row));
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return [];
}

function uniqueProductSpecificationRows(rows: Record<string, unknown>[]) {
  const seen = new Set<string>();
  return rows.filter((row, index) => {
    const key = stringValue(row.id ?? row.specificationId ?? row.sourceSpecificationId ?? row.sourceItemId ?? row.itemId)
      || `${stringValue(row.itemNo ?? row.itemNumber) || index + 1}:${payloadTitle(row, `spec-${index + 1}`)}:${goodsSpecificationText(row, '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function financialRequirementRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  const payload = objectPayload(value);
  if (Array.isArray(payload.rows)) return payload.rows.filter(isRecord).map((row) => objectPayload(row.values ?? row));
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return [];
}

function regulatoryLicenseRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  const payload = objectPayload(value);
  if (Array.isArray(payload.rows)) return payload.rows.filter(isRecord).map((row) => objectPayload(row.values ?? row));
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return [];
}

function collectWorkflowRows(value: unknown, output: BidSubmissionSchemaFieldDto[], baseKey: string, control: string, fallbackLabel: string) {
  firstArray(value).filter(isRecord).forEach((row, index) => {
    const title = payloadTitle(row, `${fallbackLabel} ${index + 1}`);
    output.push(
      structuredWorkflowField(
        `${baseKey}.${row.id || index + 1}`,
        `${fallbackLabel} - ${title}`,
        control,
        row.mandatory !== false && row.required !== false,
        baseKey,
        row,
        index
      )
    );
  });
}

function collectWorkflowText(value: unknown, output: BidSubmissionSchemaFieldDto[], requirementKey: string, label: string, control: string, required: boolean) {
  if (!isMeaningfulRequirementValue(value)) return;
  const payload = isRecord(value) ? value : { prompt: value };
  output.push(
    field(
      requirementKey,
      requirementKey,
      label,
      'textarea',
      'technical',
      required,
      'text',
      'TECHNICAL',
      requirementKey,
      compact({
        control,
        prompt: stringValue(payload.prompt ?? payload.description ?? payload.requirementDescription ?? value) || payloadSummary(payload)
      })
    )
  );
}

function structuredWorkflowField(id: string, label: string, control: string, required: boolean, source: string, payload: Record<string, unknown>, index = 0) {
  return field(id, id, label, 'table', 'technical', required, 'structured', 'TECHNICAL', source, {
    ...validationHints(payload),
    control,
    prompt: stringValue(payload.prompt ?? payload.description ?? payload.requirementDescription) || payloadSummary(payload),
    rowIndex: index + 1,
    buyerRequirement: payloadSummary(payload)
  });
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

function declarationFields(fields: Record<string, unknown>, workflow: WorkflowType) {
  if (workflow === 'works') return worksDeclarationFields();
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

function worksDeclarationFields() {
  return [
    field('works.declaration.signatoryName', 'works.declaration.signatoryName', 'Authorized Signatory Name', 'text', 'declarations', true, 'text', 'COMBINED', 'system', { control: 'worksDeclaration' }),
    field('works.declaration.position', 'works.declaration.position', 'Position', 'text', 'declarations', true, 'text', 'COMBINED', 'system', { control: 'worksDeclaration' }),
    field('works.declaration.companyStamp', 'works.declaration.companyStamp', 'Company stamp upload', 'file', 'declarations', false, 'attachment', 'COMBINED', 'system', {
      control: 'worksDeclaration',
      accept: '.pdf,.jpg,.jpeg,.png',
      documentType: 'DECLARATION_COMPANY_STAMP'
    }),
    field('works.declaration.digitalSignature', 'works.declaration.digitalSignature', 'Digital Signature', 'text', 'declarations', true, 'text', 'COMBINED', 'system', { control: 'worksDeclaration', placeholder: 'Type authorized digital signature' }),
    field('works.declaration.final', 'works.declaration.final', 'I confirm this works bid is complete, accurate, and authorized.', 'boolean', 'declarations', true, 'declaration', 'COMBINED', 'system', { control: 'worksDeclaration' }),
    field('works.declaration.conflict', 'works.declaration.conflict', 'I declare no conflict of interest.', 'boolean', 'declarations', true, 'declaration', 'COMBINED', 'system', { control: 'worksDeclaration' }),
    field('works.declaration.antiCorruption', 'works.declaration.antiCorruption', 'I accept anti-corruption declarations.', 'boolean', 'declarations', true, 'declaration', 'COMBINED', 'system', { control: 'worksDeclaration' })
  ];
}

function collectRequirementValue(key: string, value: unknown, output: BidSubmissionSchemaFieldDto[], section: BidSubmissionSection, envelope: BidSchemaEnvelope, source: string) {
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

function commercialItems(tender: TenderSchemaInput, requirements: Record<string, unknown>, fields: Record<string, unknown>, workflow: WorkflowType): CommercialItem[] {
  const normalized = (tender.commercialItems ?? []).map((item, index) => ({
    id: item.id || `commercial-${index + 1}`,
    sourceId: commercialItemSourceId(item.payload),
    itemNo: item.itemNo,
    description: item.description,
    quantity: numberValue(item.quantity),
    unit: item.unit,
    rate: numberValue(item.rate),
    total: numberValue(item.total),
    source: 'commercialItems'
  }));
  if (normalized.length) return normalized;
  const candidates: Array<[string, unknown]> =
    workflow === 'works'
      ? [
          ['requirements.works.fields.boqRows', fields.boqRows],
          ['requirements.works.fields.boqItems', fields.boqItems],
          ['requirements.commercialItems', requirements.commercialItems],
          ['requirements.works.fields.financialOfferRows', fields.financialOfferRows],
          ['requirements.works.fields.commercialPricingRows', fields.commercialPricingRows]
        ]
      : workflow === 'services'
        ? [
            ['requirements.services.fields.serviceBoqRows', fields.serviceBoqRows],
            ['requirements.services.fields.commercialPricingRows', fields.commercialPricingRows],
            ['requirements.commercialItems', requirements.commercialItems],
            ['requirements.services.fields.financialOfferRows', fields.financialOfferRows]
          ]
        : [
            ['requirements.commercialItems', requirements.commercialItems],
            ['requirements.goods.fields.quantityScheduleRows', fields.quantityScheduleRows],
            ['requirements.fields.boqRows', fields.boqRows],
            ['requirements.fields.boqItems', fields.boqItems],
            ['requirements.fields.financialOfferRows', fields.financialOfferRows],
            ['requirements.fields.commercialPricingRows', fields.commercialPricingRows]
          ];
  const [source, rows] = firstNonEmptyArray(...candidates);
  return rows.filter(isRecord).map((row, index) => ({
    id: stringValue(row.id) || `commercial-${index + 1}`,
    sourceId: commercialItemSourceId(row),
    itemNo: stringValue(row.itemNo ?? row.itemNumber) || String(index + 1),
    description: stringValue(row.description ?? row.itemDescription ?? row.workItem ?? row.workDescription ?? row.serviceTask ?? row.serviceDescription ?? row.activity ?? row.productName ?? row.name) || `Commercial item ${index + 1}`,
    quantity: numberValue(row.quantity ?? row.qty),
    unit: stringValue(row.unit ?? row.unitOfMeasure ?? row.uom),
    rate: numberValue(row.rate ?? row.unitPrice),
    total: numberValue(row.total ?? row.totalPrice),
    source
  }));
}

function commercialItemSourceId(value: unknown) {
  const payload = objectPayload(value);
  return stringValue(payload.sourceId ?? payload.originalId ?? payload.itemId ?? payload.lineId) || undefined;
}

function commercialItemAliases(item: CommercialItem) {
  const aliases = [item.id, item.sourceId, item.itemNo ? `item-${item.itemNo}` : undefined, item.itemNo ? String(item.itemNo) : undefined]
    .map((value) => stringValue(value))
    .filter((value): value is string => Boolean(value));
  return aliases.length ? Array.from(new Set(aliases)) : undefined;
}

function requirementFields(requirements: Record<string, unknown>, workflow: WorkflowType) {
  const typed = objectPayload(requirements[workflow]);
  const typedFields = objectPayload(typed.fields);
  if (Object.keys(typedFields).length) return typedFields;
  const singular = workflow === 'services' ? 'service' : workflow;
  const alternateFields = objectPayload(objectPayload(requirements[singular]).fields);
  if (Object.keys(alternateFields).length) return alternateFields;
  const legacyWorkflowFields = objectPayload(requirements[`${workflow}Requirements`]);
  if (Object.keys(legacyWorkflowFields).length) return legacyWorkflowFields;
  return objectPayload(requirements.fields);
}

function technicalKeys(workflow: WorkflowType) {
  if (workflow === 'goods') return [];
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
  section: BidSubmissionSection,
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
  if (/tax clearance|vat registration|business registration|certificate of incorporation|administrative|eligibility|registration|license|certificate|authorization|statutory/.test(value)) return 'ADMINISTRATIVE';
  if (/financial|commercial|price|pricing|boq|bank|turnover|fee|cost/.test(value)) return 'FINANCIAL';
  if (/technical|method|spec|personnel|equipment|sla|\btor\b|drawing|hse|scope|sample|warranty|delivery|site/.test(value)) return 'TECHNICAL';
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

function firstNonEmptyArray(...values: Array<[string, unknown]>): [string, unknown[]] {
  const found = values.find(([, value]) => Array.isArray(value) && value.length);
  return found ? [found[0], found[1] as unknown[]] : ['requirements.commercialItems', []];
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
        payload.license ??
        payload.requirementName ??
        payload.documentName ??
        payload.documentTitle ??
        payload.category ??
        payload.specificationName ??
        payload.text ??
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
