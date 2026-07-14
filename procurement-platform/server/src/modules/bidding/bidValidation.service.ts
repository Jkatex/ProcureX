import { buildBidSubmissionSchema } from './bidSubmissionSchema.service.js';
import type {
  BidDocumentInput,
  BidDto,
  BidDraftInput,
  BidSubmissionSchemaDto,
  BidSubmissionSchemaFieldDto,
  BidValidationIssue,
  BidValidationMissingRequiredField,
  BidValidationResult,
  BidValidationSeverity
} from './types.js';

type BidSampleLike = {
  sampleName?: unknown;
  relatedItem?: unknown;
  quantity?: unknown;
  metadata?: unknown;
};

type TenderValidationInput = {
  id?: string;
  reference?: string;
  title?: string;
  type?: unknown;
  requirements?: unknown;
  metadata?: unknown;
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

export function validateBidDraft(input: {
  draft: BidDraftInput;
  tender: TenderValidationInput;
  mode: 'draft' | 'submit';
  samples?: BidSampleLike[];
}): BidValidationResult {
  const { draft, mode } = input;
  const schema = buildBidSubmissionSchema(schemaTender(input.tender));
  const issues: BidValidationIssue[] = [];
  const missingRequiredFields: BidValidationMissingRequiredField[] = [];
  const severity: BidValidationSeverity = mode === 'submit' ? 'error' : 'warning';
  const samples = input.samples ?? [];
  const financialRows = Array.isArray(draft.financial?.items) ? draft.financial.items : [];
  const financialFields = requiredFields(schema).filter(isFinancialPricingField);
  const computedTotalAmount = computeFinancialTotal(financialRows, financialFields);

  const addRequiredIssue = (field: BidSubmissionSchemaFieldDto, message: string) => {
    issues.push({ section: field.section, field: field.requirementKey, message, severity });
    missingRequiredFields.push({
      section: field.section,
      field: field.id,
      label: field.label,
      requirementKey: field.requirementKey
    });
  };

  for (const field of requiredFields(schema)) {
    if (field.section === 'receipt' || field.section === 'review') continue;
    if (field.type === 'file' || field.responseType === 'attachment') {
      if (!hasRequiredDocument(field, draft)) addRequiredIssue(field, `Required document is missing: ${field.label}.`);
      continue;
    }
    if (isFinancialPricingField(field)) {
      const row = matchingFinancialRow(field, financialRows, financialFields);
      if (!row) {
        addRequiredIssue(field, `Required financial pricing is missing: ${field.label}.`);
        continue;
      }
      const rowIssues = validateFinancialRow(row, field);
      rowIssues.forEach((message) => addRequiredIssue(field, message));
      continue;
    }
    if (field.section === 'financial') {
      if (!hasRequiredResponse(field, draft)) addRequiredIssue(field, `Required response is missing: ${field.label}.`);
      continue;
    }
    if (field.section === 'samples') {
      if (!hasRequiredSample(field, samples)) addRequiredIssue(field, `Required sample is missing: ${field.label}.`);
      continue;
    }
    if (field.section === 'declarations') {
      if (valueForField(field, draft) !== true) addRequiredIssue(field, `Required declaration must be accepted: ${field.label}.`);
      continue;
    }
    if (isStructuredField(field)) {
      if (!hasRequiredResponse(field, draft)) {
        addRequiredIssue(field, `Required response is missing: ${field.label}.`);
        continue;
      }
      const missingEvidence = missingStructuredEvidenceUploads(field, draft);
      if (missingEvidence.length) missingEvidence.forEach((slot) => addRequiredIssue(field, `Required evidence upload is missing: ${field.label} - ${slot.label}.`));
      continue;
    }
    if (!hasRequiredResponse(field, draft)) addRequiredIssue(field, `Required response is missing: ${field.label}.`);
  }

  validateDocumentDescriptors(draft.documents ?? [], issues, mode);
  if (financialFields.length > 0 && computedTotalAmount <= 0) {
    issues.push({
      section: 'financial',
      field: 'computedTotalAmount',
      message: 'Computed total amount must be greater than 0.',
      severity
    });
  }

  const hasError = issues.some((issue) => issue.severity === 'error');
  return {
    valid: !hasError,
    issues,
    missingRequiredFields: uniqueMissingFields(missingRequiredFields),
    computedTotalAmount,
    completeness: completeness(schema, issues),
    schemaVersion: schema.schemaVersion
  };
}

export function draftWithValidation(draft: BidDraftInput, validation: BidValidationResult): BidDraftInput {
  return {
    ...draft,
    totalAmount: validation.computedTotalAmount,
    completeness: validation.completeness,
    validationIssues: validation.issues.map((issue) => `${issue.severity}:${issue.section}.${issue.field}:${issue.message}`)
  };
}

export function withValidation<T extends BidDto>(bid: T, validation: BidValidationResult): T {
  return { ...bid, validation };
}

export function draftFromBidRecord(bid: {
  payload: unknown;
  responses: Array<{ requirementKey: string; response: unknown }>;
  documents: Array<{ envelope: string; document: { name: string; documentType: string; checksum: string | null; metadata: unknown } }>;
  totalAmount?: unknown;
  currency?: string;
}): BidDraftInput {
  const payload = objectPayload(bid.payload);
  return {
    workflowType: workflowTypeValue(payload.workflowType),
    workflowVersion: stringValue(payload.workflowVersion) || 'procurex-v1',
    administrative: objectPayload(payload.administrative),
    technical: objectPayload(payload.technical),
    financial: objectPayload(payload.financial),
    declarations: objectPayload(payload.declarations),
    responses: bid.responses.map((item) => ({ requirementKey: item.requirementKey, response: objectPayload(item.response) })),
    documents: bid.documents.map((item) => ({
      name: item.document.name,
      documentType: item.document.documentType,
      envelope: item.envelope as BidDocumentInput['envelope'],
      checksum: item.document.checksum ?? undefined,
      metadata: objectPayload(item.document.metadata)
    })),
    fileManifest: objectPayload(payload.fileManifest),
    envelopes: objectPayload(payload.envelopes),
    reviewReadiness: objectPayload(payload.reviewReadiness),
    totalAmount: numericValue(bid.totalAmount) ?? undefined,
    currency: bid.currency,
    completeness: objectPayload(payload.completeness),
    validationIssues: Array.isArray(payload.validationIssues) ? payload.validationIssues.map(String) : []
  };
}

function schemaTender(tender: TenderValidationInput) {
  return {
    id: tender.id ?? 'tender',
    reference: tender.reference ?? '',
    title: tender.title ?? '',
    type: tender.type ?? 'GENERIC',
    requirements: tender.requirements ?? {},
    metadata: tender.metadata ?? {},
    requirementRows: tender.requirementRows ?? [],
    commercialItems: tender.commercialItems ?? [],
    documents: tender.documents ?? []
  };
}

function requiredFields(schema: BidSubmissionSchemaDto) {
  return schema.steps.flatMap((step) => step.fields).filter((field) => field.required);
}

function isFinancialPricingField(field: BidSubmissionSchemaFieldDto) {
  if (field.section !== 'financial' || field.responseType === 'attachment') return false;
  if (field.responseType !== 'money' && field.responseType !== 'pricing') return false;
  if (field.validation.itemId || field.validation.itemNo || field.validation.description || field.validation.quantity || field.validation.unit) return true;
  return /commercialitems|boq|quantityschedule|pricingrows|financialofferrows/i.test(`${field.requirementKey} ${field.source}`);
}

function hasRequiredDocument(field: BidSubmissionSchemaFieldDto, draft: BidDraftInput) {
  const documents = draft.documents ?? [];
  return documents.some((document) => documentMatchesField(document, field)) || responseContainsDocument(field, draft);
}

function isStructuredField(field: BidSubmissionSchemaFieldDto) {
  return field.type === 'table' || field.responseType === 'structured';
}

type StructuredEvidenceSlot = {
  key: string;
  label: string;
  requirementKey: string;
};

function structuredEvidenceSlots(field: BidSubmissionSchemaFieldDto): StructuredEvidenceSlot[] {
  if (!isStructuredField(field)) return [];
  const control = stringValue(field.validation.control);
  if (control === 'goodsProductSpecification') return [];
  return explicitEvidenceRows(control).map((row) => ({
    ...row,
    requirementKey: `${field.requirementKey}.${row.key}`
  }));
}

function explicitEvidenceRows(control: string): Array<{ key: string; label: string }> {
  if (control === 'worksSimilarProject') return [{ key: 'referenceEvidence', label: 'Upload similar project document' }];
  if (control === 'worksPersonnel' || control === 'serviceStaffing' || control === 'consultancyKeyExpert') return [{ key: 'cvEvidence', label: 'CV upload' }];
  if (control === 'worksEquipment' || control === 'serviceEquipment') return [{ key: 'evidenceReference', label: 'Upload Lease / access agreement' }];
  return [];
}

function missingStructuredEvidenceUploads(field: BidSubmissionSchemaFieldDto, draft: BidDraftInput) {
  return structuredEvidenceSlots(field).filter((slot) => !hasStructuredEvidenceUpload(field, slot, draft));
}

function hasStructuredEvidenceUpload(field: BidSubmissionSchemaFieldDto, slot: StructuredEvidenceSlot, draft: BidDraftInput) {
  return (draft.documents ?? []).some((document) => documentMatchesEvidenceSlot(document, field, slot));
}

function documentMatchesEvidenceSlot(document: BidDocumentInput, field: BidSubmissionSchemaFieldDto, slot: StructuredEvidenceSlot) {
  if (!validEnvelope(document.envelope)) return false;
  const metadata = objectPayload(document.metadata);
  return (
    stringEquals(metadata.requirementKey, slot.requirementKey) ||
    (stringEquals(metadata.parentRequirementKey, field.requirementKey) && stringEquals(metadata.evidenceKey, slot.key)) ||
    (stringEquals(metadata.fieldId, field.id) && stringEquals(metadata.evidenceKey, slot.key))
  );
}

function documentMatchesField(document: BidDocumentInput, field: BidSubmissionSchemaFieldDto) {
  if (!validEnvelope(document.envelope)) return false;
  const metadata = objectPayload(document.metadata);
  if (stringEquals(metadata.requirementKey, field.requirementKey) || stringEquals(metadata.fieldId, field.id)) return true;
  const documentText = normalize(`${document.name} ${document.documentType}`);
  const label = normalize(field.label);
  const requiredType = normalize(stringValue(field.validation.documentType));
  const envelopeCompatible = !document.envelope || document.envelope === field.envelope || document.envelope === 'COMBINED';
  return envelopeCompatible && Boolean((label && documentText.includes(label)) || (requiredType && documentText.includes(requiredType)));
}

function responseContainsDocument(field: BidSubmissionSchemaFieldDto, draft: BidDraftInput) {
  const response = responseForRequirement(field, draft);
  if (!response) return false;
  return containsDocumentDescriptor(response);
}

function containsDocumentDescriptor(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsDocumentDescriptor);
  if (!isRecord(value)) return false;
  if (nonEmptyString(value.documentId) || nonEmptyString(value.documentType) || nonEmptyString(value.checksum) || nonEmptyString(value.fileName) || nonEmptyString(value.name)) return true;
  return Object.values(value).some(containsDocumentDescriptor);
}

function hasRequiredResponse(field: BidSubmissionSchemaFieldDto, draft: BidDraftInput) {
  const response = responseForRequirement(field, draft);
  if (hasMeaningfulValue(response)) return true;
  return hasMeaningfulValue(valueForField(field, draft));
}

function responseForRequirement(field: BidSubmissionSchemaFieldDto, draft: BidDraftInput): unknown {
  const exact = draft.responses.find((item) => item.requirementKey === field.requirementKey || item.requirementKey === field.id);
  if (exact) return exact.response;
  const normalizedTarget = normalize(field.requirementKey || field.id || field.label);
  const fuzzy = draft.responses.find((item) => normalize(item.requirementKey) === normalizedTarget);
  return fuzzy?.response;
}

function valueForField(field: BidSubmissionSchemaFieldDto, draft: BidDraftInput): unknown {
  const sectionPayload = objectPayload(draft[field.section as keyof Pick<BidDraftInput, 'administrative' | 'technical' | 'financial' | 'declarations'>]);
  const candidates = [
    field.requirementKey,
    field.id,
    field.id.split('.').slice(1).join('.'),
    field.requirementKey.split('.').at(-1) ?? '',
    field.id.split('.').at(-1) ?? '',
    normalizeCamel(field.label)
  ].filter(Boolean);
  for (const key of candidates) {
    const value = getByPath(sectionPayload, key);
    if (value !== undefined) return value;
    const directKey = Object.keys(sectionPayload).find((item) => normalize(item) === normalize(key));
    if (directKey) return sectionPayload[directKey];
  }
  return undefined;
}

function matchingFinancialRow(field: BidSubmissionSchemaFieldDto, rows: unknown[], financialFields: BidSubmissionSchemaFieldDto[]) {
  const itemId = stringValue(field.validation.itemId);
  const itemNo = stringValue(field.validation.itemNo);
  const description = stringValue(field.validation.description || field.label.replace(/^Unit rate for\s+/i, ''));
  const index = financialFields.indexOf(field);
  const candidates = rows.filter(isRecord);
  return (
    candidates.find((row) => itemId && [row.id, row.itemId, row.commercialItemId, row.requirementKey].some((value) => stringEquals(value, itemId))) ??
    candidates.find((row) => itemNo && [row.itemNo, row.itemNumber, row.lineNo].some((value) => stringEquals(value, itemNo))) ??
    candidates.find((row) => description && normalize(`${row.description ?? row.itemDescription ?? row.name ?? ''}`).includes(normalize(description))) ??
    (financialFields.length === rows.length && isRecord(rows[index]) ? rows[index] as Record<string, unknown> : undefined)
  );
}

function validateFinancialRow(row: Record<string, unknown>, field: BidSubmissionSchemaFieldDto) {
  const messages: string[] = [];
  const quantity = numericValue(row.quantity ?? field.validation.quantity);
  const rate = numericValue(row.rate ?? row.unitRate ?? row.unitPrice);
  const submittedTotal = numericValue(row.total ?? row.totalPrice ?? row.amount);
  if (quantity === null || quantity <= 0) messages.push(`Quantity must be greater than 0 for ${field.label}.`);
  if (rate === null || rate < 0) messages.push(`Rate must be greater than or equal to 0 for ${field.label}.`);
  if (quantity !== null && quantity > 0 && rate !== null && rate >= 0 && submittedTotal !== null) {
    const expected = roundMoney(quantity * rate);
    if (Math.abs(roundMoney(submittedTotal) - expected) > 0.01) messages.push(`Total must equal quantity multiplied by rate for ${field.label}.`);
  }
  return messages;
}

function computeFinancialTotal(rows: unknown[], financialFields: BidSubmissionSchemaFieldDto[]) {
  if (!rows.length) return 0;
  const fields = financialFields.length ? financialFields : rows.map((_, index) => ({
    id: `financial.items.${index}`,
    requirementKey: `financial.items.${index}`,
    label: `Financial item ${index + 1}`,
    validation: {}
  }) as BidSubmissionSchemaFieldDto);
  return fields.reduce((sum, field) => {
    const row = matchingFinancialRow(field, rows, fields);
    if (!row) return sum;
    const quantity = numericValue(row.quantity ?? field.validation.quantity);
    const rate = numericValue(row.rate ?? row.unitRate ?? row.unitPrice);
    return quantity !== null && quantity > 0 && rate !== null && rate >= 0 ? sum + quantity * rate : sum;
  }, 0);
}

function hasRequiredSample(field: BidSubmissionSchemaFieldDto, samples: BidSampleLike[]) {
  const label = normalize(field.label);
  const relatedItem = normalize(stringValue(field.validation.relatedItem));
  return samples.some((sample) => {
    const metadata = objectPayload(sample.metadata);
    if (stringEquals(metadata.requirementKey, field.requirementKey) || stringEquals(metadata.fieldId, field.id)) return true;
    const sampleName = normalize(stringValue(sample.sampleName));
    const sampleRelated = normalize(stringValue(sample.relatedItem));
    return Boolean((label && sampleName && (sampleName.includes(label) || label.includes(sampleName))) || (relatedItem && sampleRelated && sampleRelated.includes(relatedItem)));
  });
}

function validateDocumentDescriptors(documents: BidDocumentInput[], issues: BidValidationIssue[], mode: 'draft' | 'submit') {
  const severity: BidValidationSeverity = mode === 'submit' ? 'error' : 'warning';
  documents.forEach((document, index) => {
    if (!nonEmptyString(document.name)) issues.push({ section: 'documents', field: `documents[${index}].name`, message: 'Document name is required.', severity });
    if (!nonEmptyString(document.documentType)) issues.push({ section: 'documents', field: `documents[${index}].documentType`, message: 'Document type is required.', severity });
    if (!validEnvelope(document.envelope)) issues.push({ section: 'documents', field: `documents[${index}].envelope`, message: 'Document envelope is invalid.', severity });
  });
}

function completeness(schema: BidSubmissionSchemaDto, issues: BidValidationIssue[]) {
  const result: Record<string, boolean> = {};
  for (const step of schema.steps) {
    if (step.id === 'receipt') continue;
    const sections = new Set(step.fields.map((field) => field.section));
    result[step.id] = !issues.some((issue) => issue.section === step.id || sections.has(issue.section as any) || (step.id === 'administrative' && issue.section === 'documents'));
  }
  return result;
}

function uniqueMissingFields(fields: BidValidationMissingRequiredField[]) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = `${field.section}:${field.requirementKey}:${field.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getByPath(payload: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let current: unknown = payload;
  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isRecord(value)) {
    for (const key of ['answer', 'value', 'text', 'comment', 'response', 'description', 'documentId', 'documentType', 'checksum', 'name']) {
      if (hasMeaningfulValue(value[key])) return true;
    }
    return Object.values(value).some(hasMeaningfulValue);
  }
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function normalizeCamel(value: string) {
  const words = normalize(value).split(' ').filter(Boolean);
  return words.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))).join('');
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function validEnvelope(value: unknown): value is NonNullable<BidDocumentInput['envelope']> {
  return value === undefined || value === 'ADMINISTRATIVE' || value === 'TECHNICAL' || value === 'FINANCIAL' || value === 'COMBINED';
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null && String(value).trim().length > 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function stringEquals(left: unknown, right: unknown) {
  return normalize(stringValue(left)) === normalize(stringValue(right));
}

function numericValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function workflowTypeValue(value: unknown): BidDraftInput['workflowType'] {
  return value === 'goods' || value === 'works' || value === 'services' || value === 'consultancy' || value === 'generic' ? value : 'generic';
}
