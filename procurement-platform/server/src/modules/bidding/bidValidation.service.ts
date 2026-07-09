import type {
  BidDocumentInput,
  BidDto,
  BidDraftInput,
  BidValidationIssue,
  BidValidationResult,
  BidValidationSeverity
} from './types.js';

export function validateBidDraft(input: {
  draft: BidDraftInput;
  tender: { type?: unknown; requirements?: unknown };
  mode: 'draft' | 'submit';
}): BidValidationResult {
  const { draft, tender, mode } = input;
  const issues: BidValidationIssue[] = [];
  const blockerSeverity: BidValidationSeverity = mode === 'submit' ? 'error' : 'warning';
  const administrative = objectPayload(draft.administrative);
  const technical = objectPayload(draft.technical);
  const financial = objectPayload(draft.financial);
  const declarations = objectPayload(draft.declarations);
  const requiredUploads = requiredUploadLabels(tender.requirements);
  const documents = draft.documents ?? [];

  const addIssue = (section: string, field: string, message: string, severity: BidValidationSeverity = blockerSeverity) => {
    issues.push({ section, field, message, severity });
  };

  if (administrative.eligible !== true) addIssue('administrative', 'eligible', 'Eligibility confirmation is required.');
  if (administrative.taxCompliant !== true) addIssue('administrative', 'taxCompliant', 'Tax compliance confirmation is required.');
  if (administrative.authorized !== true) addIssue('administrative', 'authorized', 'Authorization confirmation is required.');

  if (!nonEmptyString(technical.approach)) addIssue('technical', 'approach', 'Technical approach is required.');
  if (!nonEmptyString(technical.deliveryPlan)) addIssue('technical', 'deliveryPlan', 'Delivery plan is required.');
  const experienceMandatory = tenderRequiresExperience(tender.requirements);
  if (!nonEmptyString(technical.experience)) {
    addIssue(
      'technical',
      'experience',
      experienceMandatory ? 'Experience is required by the tender requirements.' : 'Experience is recommended before submission.',
      experienceMandatory ? blockerSeverity : 'warning'
    );
  }

  const financialRows = Array.isArray(financial.items) ? financial.items : [];
  if (!Array.isArray(financial.items)) addIssue('financial', 'items', 'Financial items must be an array.');
  if (!financialRows.length) addIssue('financial', 'items', 'At least one financial item is required.');
  const computedTotalAmount = financialRows.reduce((sum, row, index) => {
    if (!isRecord(row)) {
      addIssue('financial', `items[${index}]`, 'Financial item must be an object.');
      return sum;
    }
    if (!nonEmptyString(row.description)) addIssue('financial', `items[${index}].description`, 'Description is required.');
    if (!nonEmptyString(row.unit)) addIssue('financial', `items[${index}].unit`, 'Unit is required.');
    const quantity = numericValue(row.quantity);
    const rate = numericValue(row.rate);
    if (quantity === null || quantity <= 0) addIssue('financial', `items[${index}].quantity`, 'Quantity must be greater than 0.');
    if (rate === null || rate < 0) addIssue('financial', `items[${index}].rate`, 'Rate must be greater than or equal to 0.');
    return quantity !== null && quantity > 0 && rate !== null && rate >= 0 ? sum + quantity * rate : sum;
  }, 0);
  if (computedTotalAmount <= 0) addIssue('financial', 'totalAmount', 'Computed total amount must be greater than 0.');

  if (declarations.confirmAccuracy !== true) addIssue('declarations', 'confirmAccuracy', 'Accuracy declaration is required.');
  if (declarations.acceptTerms !== true) addIssue('declarations', 'acceptTerms', 'Terms acceptance is required.');
  if (declarations.noConflict !== true) addIssue('declarations', 'noConflict', 'No-conflict declaration is required.');

  documents.forEach((document, index) => {
    if (!nonEmptyString(document.name)) addIssue('documents', `documents[${index}].name`, 'Document name is required.');
    if (!nonEmptyString(document.documentType)) addIssue('documents', `documents[${index}].documentType`, 'Document type is required.');
    if (!validEnvelope(document.envelope)) addIssue('documents', `documents[${index}].envelope`, 'Document envelope is invalid.');
  });
  for (const label of requiredUploads) {
    if (!documents.some((document) => documentMatchesRequiredUpload(document, label))) {
      addIssue('documents', normalizeField(label), `Required document is missing: ${label}.`);
    }
  }

  const hasError = issues.some((issue) => issue.severity === 'error');
  return {
    valid: !hasError,
    issues,
    computedTotalAmount,
    completeness: {
      administrative: !issues.some((issue) => issue.section === 'administrative'),
      technical: !issues.some((issue) => issue.section === 'technical'),
      financial: !issues.some((issue) => issue.section === 'financial'),
      declarations: !issues.some((issue) => issue.section === 'declarations'),
      documents: !issues.some((issue) => issue.section === 'documents')
    }
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

function requiredUploadLabels(requirements: unknown): string[] {
  const fields = requirementFields(requirements);
  const labels = new Set<string>();
  collectNamedRows(fields.otherEligibilityRequirements, (row) => row.mandatory !== false && row.requiresUpload !== false, labels);
  collectNamedRows(fields.supportingDocumentRows, (row) => row.mandatory !== false, labels);
  collectNamedRows(fields.financialRequirementRows, (row) => row.mandatory !== false && nonEmptyString(row.evidenceRequired), labels, 'evidenceRequired');
  collectRecursiveUploadRows(fields, labels);
  return [...labels];
}

function collectNamedRows(value: unknown, predicate: (row: Record<string, unknown>) => boolean, labels: Set<string>, preferredField?: string) {
  if (!Array.isArray(value)) return;
  value.filter(isRecord).filter(predicate).forEach((row) => {
    const label = labelForRequirement(row, preferredField);
    if (label) labels.add(label);
  });
}

function collectRecursiveUploadRows(value: unknown, labels: Set<string>) {
  if (Array.isArray(value)) {
    value.filter(isRecord).forEach((row) => {
      if (row.mandatory !== false && row.requiresUpload === true) {
        const label = labelForRequirement(row);
        if (label) labels.add(label);
      }
      Object.values(row).forEach((child) => collectRecursiveUploadRows(child, labels));
    });
    return;
  }
  if (isRecord(value)) Object.values(value).forEach((child) => collectRecursiveUploadRows(child, labels));
}

function labelForRequirement(row: Record<string, unknown>, preferredField?: string) {
  const candidates = [
    preferredField ? row[preferredField] : undefined,
    row.documentName,
    row.requirementName,
    row.evidenceRequired,
    row.license,
    row.category,
    row.documentTitle,
    row.name
  ];
  return candidates.map(stringValue).find(Boolean);
}

function tenderRequiresExperience(requirements: unknown) {
  const fields = requirementFields(requirements);
  return Boolean(fields.experienceMandatory || fields.experienceRequired || fields.similarCompletedProjectsRequired);
}

function requirementFields(requirements: unknown): Record<string, unknown> {
  const root = objectPayload(requirements);
  if (isRecord(root.fields)) return root.fields;
  for (const value of Object.values(root)) {
    if (isRecord(value) && isRecord(value.fields)) return value.fields;
  }
  return root;
}

function documentMatchesRequiredUpload(document: BidDocumentInput, requiredLabel: string) {
  const haystack = normalizeField(`${document.name} ${document.documentType}`);
  const needle = normalizeField(requiredLabel);
  return Boolean(needle && haystack.includes(needle));
}

function normalizeField(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function validEnvelope(value: unknown): value is NonNullable<BidDocumentInput['envelope']> {
  return value === undefined || value === 'ADMINISTRATIVE' || value === 'TECHNICAL' || value === 'FINANCIAL' || value === 'COMBINED';
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null && String(value).trim().length > 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
