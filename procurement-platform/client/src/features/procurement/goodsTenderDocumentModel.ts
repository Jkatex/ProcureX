import type {
  CreateTenderDraft,
  CreateTenderEligibilityRequirementRow,
  CreateTenderEvaluationCriterion,
  CreateTenderFinancialRequirementRow,
  CreateTenderProductSpecificationRow,
  CreateTenderRegulatoryLicenseRequirementRow,
  CreateTenderSampleRequirementRow,
  TenderDetail
} from './types';

export type GoodsTenderDocumentModel = {
  organization: {
    name: string;
    logoUrl?: string | null;
  };
  tender: {
    title: string;
    number: string;
    procurementMethod: 'OPEN' | 'INVITED' | string;
    category: 'GOODS';
    openingDate?: string | null;
    closingDate?: string | null;
    deliveryLocation?: string | null;
    publicContact?: string | null;
    fundingSource?: string | null;
    publicVersion?: string | null;
  };
  goods: Array<{
    id: string;
    name: string;
    quantity: number | string;
    unit?: string | null;
    specifications: Array<{
      name: string;
      value?: string | number | boolean | string[] | null;
    }>;
  }>;
  samples: {
    required: boolean;
    items: Array<{
      itemName: string;
      quantity: number | string;
      unit?: string | null;
      description?: string | null;
      deliveryLocation: string;
      deadline: string;
      willBeReturned: boolean;
    }>;
  };
  financialCapacityRequirements: Array<{
    requirementType: string;
    minimumValue?: string | number | null;
    period?: string | null;
    evidenceRequired?: string | null;
  }>;
  eligibility: {
    regulatoryLicences: Array<{ name: string; evidence?: string | null }>;
    otherRequirements: Array<{ name: string; description?: string | null }>;
  };
  evaluationCriteria: Array<{
    criterion: string;
    subCriterion?: string | null;
    weight?: number | string | null;
  }>;
  amendments: Array<{
    number: string;
    date: string;
    description: string;
  }>;
};

type GoodsReviewItem = {
  id: string;
  description: string;
  quantity: string | number;
  unit: string;
};

type GoodsReviewAmendment = {
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

export function isGoodsTenderType(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '') === 'goods';
}

export function goodsTenderDocumentModelFromDraft(
  draft: CreateTenderDraft,
  profileOrganization?: string,
  profileLogoUrl?: string | null
): GoodsTenderDocumentModel {
  const amendments = normalizeAmendments(goodsReviewAmendments(draft));
  const goods = draft.commercialItems.map((row, index) => ({
    id: row.id || `goods-item-${index + 1}`,
    name: row.description,
    quantity: row.quantity,
    unit: row.unit,
    specifications: draft.productSpecifications
      .filter((specification) => specification.sourceItemId === row.id)
      .map(normalizeProductSpecification)
  }));

  return {
    organization: {
      name: draft.procuringEntity || profileOrganization || 'Procuring organization',
      logoUrl: profileLogoUrl || null
    },
    tender: {
      title: draft.title,
      number: draft.reference,
      procurementMethod: procurementMethodCode(draft.method),
      category: 'GOODS',
      openingDate: draft.openingDate || null,
      closingDate: draft.submissionDate || null,
      deliveryLocation: draft.location || null,
      publicContact: publicContact(draft.contact.name, draft.contact.phone),
      fundingSource: fundingSourceLabel(draft.fundingSource, draft.customFundingSource),
      publicVersion: documentVersionFromSource(draft, amendments.length)
    },
    goods,
    samples: {
      required: draft.requirements.requireSamples === 'Yes',
      items: draft.sampleRequirements
        .filter((row) => row.sampleRequired !== false)
        .map((row) => ({
          itemName: goodsItemName(goods, row.relatedBoqItemId),
          quantity: row.numberOfSamples,
          unit: null,
          description: row.sampleDescription || null,
          deliveryLocation: row.deliveryLocation,
          deadline: row.deliveryDeadline,
          willBeReturned: Boolean(row.returnableSample)
        }))
    },
    financialCapacityRequirements: draft.financialRequirements.map(normalizeFinancialRequirement),
    eligibility: {
      regulatoryLicences: draft.regulatoryLicenseRequirements.map(normalizeRegulatoryLicence),
      otherRequirements: draft.eligibilityRequirements.map(normalizeOtherEligibility)
    },
    evaluationCriteria: draft.evaluationCriteria.map(normalizeEvaluationCriterion),
    amendments
  };
}

export function goodsTenderDocumentModelFromTender(tender: TenderDetail | undefined): GoodsTenderDocumentModel {
  const requirements = objectValue(tender?.requirements);
  const metadata = objectValue(tender?.metadata);
  const summary = objectValue(requirements.summary);
  const publication = objectValue(metadata.publication);
  const contact = objectValue(metadata.contact);
  const fields = goodsRequirementFields(requirements);
  const items = tenderGoodsItems(tender, requirements, fields);
  const specifications = typedRows<CreateTenderProductSpecificationRow>(
    firstArray(requirements.productSpecifications, fields.productSpecificationTemplate)
  );
  const samples = typedRows<CreateTenderSampleRequirementRow>(
    firstArray(requirements.sampleRequirements, fields.sampleRequirementRows, requirements.sampleRequirementRows)
  );
  const sampleFlag = stringValue(summary.requireSamples).toLowerCase();
  const amendments = normalizeAmendments(goodsReviewAmendments(tender));
  const goods = items.map((item) => ({
    id: item.id,
    name: item.description,
    quantity: item.quantity,
    unit: item.unit,
    specifications: specifications
      .filter((specification) => specification.sourceItemId === item.id)
      .map(normalizeProductSpecification)
  }));

  return {
    organization: {
      name: stringValue(metadata.procuringEntity) || tenderOrganization(tender),
      logoUrl: tender?.buyerLogoUrl || null
    },
    tender: {
      title: tender?.title || '',
      number: tender?.reference || '',
      procurementMethod: procurementMethodCode(stringValue(metadata.method) || tender?.method || tender?.visibility || 'Open Tender'),
      category: 'GOODS',
      openingDate: stringValue(publication.openingDate) || tender?.openingDate || null,
      closingDate: tender?.closingDate || null,
      deliveryLocation: tender?.location || null,
      publicContact: publicContact(stringValue(contact.name), stringValue(contact.phone)),
      fundingSource: stringValue(metadata.fundingSource) || null,
      publicVersion: documentVersionFromSource(tender, amendments.length)
    },
    goods,
    samples: {
      required: sampleFlag === 'yes' || (!sampleFlag && samples.some((row) => row.sampleRequired !== false)),
      items: samples
        .filter((row) => row.sampleRequired !== false)
        .map((row) => ({
          itemName: goodsItemName(goods, row.relatedBoqItemId),
          quantity: row.numberOfSamples,
          unit: null,
          description: row.sampleDescription || null,
          deliveryLocation: row.deliveryLocation,
          deadline: row.deliveryDeadline,
          willBeReturned: Boolean(row.returnableSample)
        }))
    },
    financialCapacityRequirements: typedRows<CreateTenderFinancialRequirementRow>(
      firstArray(requirements.financialRequirements, fields.financialRequirementRows)
    ).map(normalizeFinancialRequirement),
    eligibility: {
      regulatoryLicences: typedRows<CreateTenderRegulatoryLicenseRequirementRow>(
        firstArray(requirements.regulatoryLicenseRequirements, fields.regulatoryLicenseRequirementRows)
      ).map(normalizeRegulatoryLicence),
      otherRequirements: typedRows<CreateTenderEligibilityRequirementRow>(
        firstArray(requirements.eligibilityRequirements, fields.eligibilityRequirementCards)
      ).map(normalizeOtherEligibility)
    },
    evaluationCriteria: tenderEvaluationCriteria(tender, requirements, metadata).map(normalizeEvaluationCriterion),
    amendments
  };
}

function normalizeProductSpecification(row: CreateTenderProductSpecificationRow) {
  return {
    name: stringValue(row.specificationName),
    value: stringValue(row.acceptableRequirement) || null
  };
}

function normalizeFinancialRequirement(row: CreateTenderFinancialRequirementRow) {
  return {
    requirementType: stringValue(row.requirementType),
    minimumValue: stringValue(row.minimumValue) || null,
    period: stringValue(row.period) || null,
    evidenceRequired: stringValue(row.evidenceRequired) || null
  };
}

function normalizeRegulatoryLicence(row: CreateTenderRegulatoryLicenseRequirementRow) {
  return {
    name: stringValue(row.license),
    evidence: [
      row.body ? `Issuing body: ${row.body}` : '',
      row.mandatory ? 'Mandatory' : '',
      row.expiryRequired ? 'Expiry validation required' : ''
    ].filter(Boolean).join(' / ') || null
  };
}

function normalizeOtherEligibility(row: CreateTenderEligibilityRequirementRow) {
  return {
    name: stringValue(row.requirementName),
    description: stringValue(row.notes) || null
  };
}

function normalizeEvaluationCriterion(value: unknown): GoodsTenderDocumentModel['evaluationCriteria'][number] {
  const record = objectValue(value);
  return {
    criterion:
      stringValue(record.label) ||
      stringValue(record.name) ||
      stringValue(record.criterion) ||
      stringValue(record.title) ||
      'Criteria',
    subCriterion: stringArray(record.subcriteria).join(', ') || stringValue(record.notes) || stringValue(record.description) || null,
    weight: stringValue(record.weight)
  };
}

function normalizeAmendments(rows: GoodsReviewAmendment[]): GoodsTenderDocumentModel['amendments'] {
  return rows
    .map((row, index) => ({
      number: stringValue(row.reference) || stringValue(row.amendmentNumber) || stringValue(row.number) || `Amendment ${index + 1}`,
      date: stringValue(row.publishedAt) || stringValue(row.date) || stringValue(row.updatedAt) || stringValue(row.createdAt),
      description: stringValue(row.summary) || stringValue(row.description) || stringValue(row.title),
      index
    }))
    .filter((row) => row.number || row.date || row.description)
    .sort((left, right) => amendmentSortValue(left.number, left.date, left.index) - amendmentSortValue(right.number, right.date, right.index))
    .map(({ number, date, description }) => ({ number, date, description }));
}

function amendmentSortValue(number: string, date: string, index: number) {
  const numeric = Number(number.replace(/[^\d.]/g, ''));
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(date);
  if (Number.isFinite(parsed)) return parsed;
  return index;
}

function tenderGoodsItems(tender: TenderDetail | undefined, requirements: Record<string, unknown>, fields: Record<string, unknown>): GoodsReviewItem[] {
  const requirementItems = firstArray(requirements.commercialItems, fields.quantityScheduleRows);
  if (requirementItems.length) {
    return requirementItems.map((row, index) => {
      const record = objectValue(row);
      return {
        id: stringValue(record.id) || stringValue(record.sourceItemId) || `goods-item-${index + 1}`,
        description: stringValue(record.description) || stringValue(record.itemDescription) || `Goods item ${index + 1}`,
        quantity: stringValue(record.quantity) || stringValue(record.quantityValue),
        unit: stringValue(record.unit) || stringValue(record.unitOfMeasure)
      };
    });
  }

  return (tender?.commercialItems ?? []).map((row, index) => ({
    id: row.id || `goods-item-${index + 1}`,
    description: row.description || `Goods item ${index + 1}`,
    quantity: row.quantity ?? '',
    unit: row.unit || ''
  }));
}

function goodsRequirementFields(requirements: Record<string, unknown>) {
  return objectValue(objectValue(requirements.goods).fields);
}

function tenderEvaluationCriteria(tender: TenderDetail | undefined, requirements: Record<string, unknown>, metadata: Record<string, unknown>) {
  const rows = firstArray(metadata.evaluationCriteria, requirements.evaluationCriteria);
  if (rows.length) return typedRows<CreateTenderEvaluationCriterion>(rows);
  return (tender?.requirementRows ?? [])
    .filter((row) => row.section.toLowerCase() === 'evaluation')
    .map((row, index) => ({
      id: row.id,
      ...row.payload,
      weight: numberValue(row.payload.weight) || 0,
      label: stringValue(row.payload.title) || `Criteria ${index + 1}`
    }));
}

function goodsItemName(goods: GoodsTenderDocumentModel['goods'], itemId: string) {
  const itemIndex = goods.findIndex((item) => item.id === itemId);
  const item = itemIndex >= 0 ? goods[itemIndex] : null;
  return item ? item.name || `Goods item ${itemIndex + 1}` : 'Unknown goods item';
}

function procurementMethodCode(method: string | undefined | null) {
  return /invited|restricted/i.test(String(method || '')) ? 'INVITED' : 'OPEN';
}

function publicContact(name?: string, phone?: string) {
  const parts = [stringValue(name), stringValue(phone)].filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

function fundingSourceLabel(value: string, customValue: string) {
  if (value === 'Other') return stringValue(customValue) || 'Other';
  return stringValue(value) || null;
}

function documentVersionFromSource(source: unknown, amendmentCount: number) {
  const value = objectValue(source);
  const metadata = objectValue(value.metadata);
  return stringValue(metadata.documentVersion) || stringValue(metadata.version) || `Version ${amendmentCount + 1}.0`;
}

function goodsReviewAmendments(source: unknown): GoodsReviewAmendment[] {
  const value = objectValue(source);
  return typedRows<GoodsReviewAmendment>(firstArray(value.amendments, value.amendmentRows));
}

function tenderOrganization(tender: TenderDetail | undefined) {
  const buyerName = stringValue((tender as unknown as { buyerName?: string })?.buyerName);
  return buyerName || tender?.organization || tender?.ownerOrganization || 'Procuring organization';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return String(value ?? '').trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean);
  return stringValue(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function typedRows<T>(value: unknown[]): T[] {
  return value.filter((row) => row && typeof row === 'object') as T[];
}

function firstArray(...values: unknown[]) {
  return values.find((value): value is unknown[] => Array.isArray(value) && value.length > 0) ?? [];
}
