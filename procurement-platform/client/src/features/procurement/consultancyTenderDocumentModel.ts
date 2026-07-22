/* Supports the procurement client workflow with reusable logic kept close to the screens that consume it. */
import { createEmptyConsultancyRequirements } from './createTenderConfig';
import type {
  CreateTenderConsultancyAssignmentActivityRow,
  CreateTenderConsultancyDeliverableRow,
  CreateTenderConsultancyEntityBackgroundCard,
  CreateTenderConsultancyExternalReferenceRow,
  CreateTenderConsultancyKeyExpertRow,
  CreateTenderConsultancyReportingRequirementRow,
  CreateTenderConsultancyRequirements,
  CreateTenderConsultancyResponsibilityRow,
  CreateTenderConsultancySpecificObjectiveRow,
  CreateTenderConsultancySupportingDocumentRow,
  CreateTenderDraft,
  CreateTenderEvaluationCriterion,
  CreateTenderFinancialRequirementRow,
  CreateTenderRegulatoryLicenseRequirementRow,
  TenderDetail,
  TenderDetailDocument
} from './types';

export type ConsultancyTenderDocumentModel = {
  organization: {
    name: string;
    logoUrl?: string | null;
  };
  tender: {
    title: string;
    number: string;
    procurementCategory: 'CONSULTANCY';
    procurementMethod: 'OPEN' | 'INVITED' | string;
    openingDate?: string | null;
    closingDate?: string | null;
    publicContactName?: string | null;
    publicContactPhone?: string | null;
    fundingSource?: string | null;
    assignmentLocation?: string | null;
    publicVersion?: string | null;
  };
  introduction: {
    entityBackground: Array<{
      id: string;
      organizationBackground?: string | null;
      departmentOrUnit?: string | null;
    }>;
    projectBackground: {
      projectName?: string | null;
      backgroundNarrative?: string | null;
      existingChallenges?: string | null;
      currentSituation?: string | null;
      relatedInitiatives?: string | null;
    };
    problemStatement: {
      mainProblemDescription?: string | null;
      expectedImpact?: string | null;
    };
  };
  objectives: {
    generalObjective?: string | null;
    specificObjectives: Array<{
      id: string;
      title: string;
      description?: string | null;
      priorityLevel?: string | null;
    }>;
  };
  scope: {
    activities: Array<{
      id: string;
      title: string;
      description?: string | null;
      expectedOutput?: string | null;
      location?: string | null;
      durationText?: string | null;
    }>;
    outOfScopeActivities?: string | null;
  };
  responsibilities: {
    client: Array<{
      id: string;
      title: string;
      description?: string | null;
      supportType?: string | null;
    }>;
    consultant: Array<{
      id: string;
      title: string;
      description?: string | null;
      reportingFrequency?: string | null;
    }>;
  };
  deliverables: Array<{
    id: string;
    name: string;
    description?: string | null;
    submissionTimeline?: string | null;
    formatRequired?: string | null;
    submissionChannel?: string | null;
    mandatory?: boolean | null;
  }>;
  reportingRequirements: Array<{
    id: string;
    reportType: string;
    frequency?: string | null;
    submissionFormat?: string | null;
    submissionChannel?: string | null;
  }>;
  qualifications: {
    individual: {
      professionalRegistrations: string[];
      cvRequired?: string | null;
      minimumYearsExperience?: string | null;
      minimumSimilarAssignments?: string | null;
      similarAssignmentEvidenceRequired?: string | null;
    };
    firm: {
      minimumYearsExperience?: string | null;
      minimumSimilarAssignments?: string | null;
      sectorExperience: string[];
      similarAssignmentEvidenceRequired?: string | null;
      keyPersonnel: Array<{
        id: string;
        positionTitle: string;
        minimumQualification?: string | null;
        yearsExperience?: string | null;
        certifications?: string | null;
        quantity?: string | null;
        mandatory?: boolean | null;
      }>;
    };
    regulatoryLicences: Array<{
      name: string;
      issuingBody?: string | null;
      mandatory?: boolean | null;
    }>;
    financialCapacityRequirements: Array<{
      requirementType: string;
      minimumValue?: string | number | null;
      period?: string | null;
      evidenceRequired?: string | null;
      mandatory?: boolean | null;
    }>;
  };
  institutionalArrangements: {
    consultantReportsTo?: string | null;
    supervisingOfficer?: string | null;
    approvalAuthority?: string | null;
    meetingFrequency?: string | null;
    coordinationMechanism?: string | null;
    communicationMethods: string[];
    officeSpaceProvided?: boolean | null;
    accessToFacilities?: boolean | null;
    accessToDocuments?: boolean | null;
  };
  supportingDocuments: ConsultancyTenderDocumentAttachment[];
  externalReferences: Array<{
    id: string;
    name: string;
    description?: string | null;
    url: string;
    safeHref?: string | null;
  }>;
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

export type ConsultancyTenderDocumentAttachment = {
  id: string;
  title: string;
  uploadedDocument: string;
  category?: string | null;
  confidential?: boolean | null;
  document?: TenderDetailDocument;
};

type ConsultancyReviewAmendment = {
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

export function isConsultancyTenderType(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '') === 'consultancy';
}

export function consultancyTenderDocumentModelFromDraft(
  draft: CreateTenderDraft,
  profileOrganization?: string,
  profileLogoUrl?: string | null
): ConsultancyTenderDocumentModel {
  const requirements = normalizeConsultancyRequirements(draft.consultancyRequirements);
  const amendments = normalizeAmendments(consultancyReviewAmendments(draft));

  return {
    organization: {
      name: draft.procuringEntity || profileOrganization || 'Procuring organization',
      logoUrl: profileLogoUrl || null
    },
    tender: {
      title: draft.title,
      number: draft.reference,
      procurementCategory: 'CONSULTANCY',
      procurementMethod: procurementMethodCode(draft.method),
      openingDate: draft.openingDate || null,
      closingDate: draft.submissionDate || null,
      publicContactName: stringValue(draft.contact.name) || null,
      publicContactPhone: stringValue(draft.contact.phone) || null,
      fundingSource: fundingSourceLabel(draft.fundingSource, draft.customFundingSource),
      assignmentLocation: draft.location || null,
      publicVersion: documentVersionFromSource(draft, amendments.length)
    },
    ...consultancyContentFromRequirements(requirements, draft.financialRequirements, draft.regulatoryLicenseRequirements, draft.evaluationCriteria),
    supportingDocuments: consultancyDocumentsFromDraftRows(requirements.supportingDocumentRows),
    amendments
  };
}

export function consultancyTenderDocumentModelFromTender(tender: TenderDetail | undefined): ConsultancyTenderDocumentModel {
  const requirements = objectValue(tender?.requirements);
  const metadata = objectValue(tender?.metadata);
  const fields = objectValue(objectValue(requirements.consultancy).fields);
  const publication = objectValue(metadata.publication);
  const contact = objectValue(metadata.contact);
  const consultancy = normalizeConsultancyRequirements({
    ...fields,
    ...objectValue(requirements.consultancyRequirements)
  });
  const amendments = normalizeAmendments(consultancyReviewAmendments(tender));

  return {
    organization: {
      name: stringValue(metadata.procuringEntity) || tenderOrganization(tender),
      logoUrl: tender?.buyerLogoUrl || null
    },
    tender: {
      title: tender?.title || '',
      number: tender?.reference || '',
      procurementCategory: 'CONSULTANCY',
      procurementMethod: procurementMethodCode(stringValue(metadata.method) || tender?.method || tender?.visibility || 'Open Tender'),
      openingDate: stringValue(publication.openingDate) || tender?.openingDate || null,
      closingDate: tender?.closingDate || null,
      publicContactName: stringValue(contact.name) || null,
      publicContactPhone: stringValue(contact.phone) || null,
      fundingSource: stringValue(metadata.fundingSource) || null,
      assignmentLocation: tender?.location || null,
      publicVersion: documentVersionFromSource(tender, amendments.length)
    },
    ...consultancyContentFromRequirements(
      consultancy,
      typedRows<CreateTenderFinancialRequirementRow>(firstArray(requirements.financialRequirements, fields.financialRequirementRows)),
      typedRows<CreateTenderRegulatoryLicenseRequirementRow>(firstArray(requirements.regulatoryLicenseRequirements, fields.regulatoryLicenseRequirementRows)),
      tenderEvaluationCriteria(tender, requirements, metadata)
    ),
    supportingDocuments: consultancyReviewDocuments(consultancy.supportingDocumentRows, tender?.documents ?? []),
    amendments
  };
}

function consultancyContentFromRequirements(
  requirements: CreateTenderConsultancyRequirements,
  financialRequirements: CreateTenderFinancialRequirementRow[],
  regulatoryLicenseRequirements: CreateTenderRegulatoryLicenseRequirementRow[],
  evaluationCriteria: unknown[]
): Omit<ConsultancyTenderDocumentModel, 'organization' | 'tender' | 'supportingDocuments' | 'amendments'> {
  return {
    introduction: {
      entityBackground: requirements.entityBackgroundCards.map((row, index) => ({
        id: row.id || `entity-background-${index + 1}`,
        organizationBackground: stringValue(row.organizationBackground) || null,
        departmentOrUnit: stringValue(row.departmentUnit) || null
      })),
      projectBackground: {
        projectName: stringValue(requirements.projectName) || null,
        backgroundNarrative: stringValue(requirements.backgroundNarrative) || null,
        existingChallenges: stringValue(requirements.existingChallenges) || null,
        currentSituation: stringValue(requirements.currentSituation) || null,
        relatedInitiatives: stringValue(requirements.relatedInitiatives) || null
      },
      problemStatement: {
        mainProblemDescription: stringValue(requirements.mainProblemDescription) || null,
        expectedImpact: stringValue(requirements.expectedImpact) || null
      }
    },
    objectives: {
      generalObjective: stringValue(requirements.generalObjective) || null,
      specificObjectives: requirements.specificObjectiveRows.map((row, index) => ({
        id: row.id || `objective-${index + 1}`,
        title: stringValue(row.objectiveTitle),
        description: stringValue(row.objectiveDescription) || null,
        priorityLevel: stringValue(row.priorityLevel) || null
      }))
    },
    scope: {
      activities: requirements.assignmentActivityRows.map((row, index) => ({
        id: row.id || `activity-${index + 1}`,
        title: stringValue(row.activityTitle),
        description: stringValue(row.detailedDescription) || null,
        expectedOutput: stringValue(row.expectedOutput) || null,
        location: stringValue(row.location) || null,
        durationText: durationWithUnit(row.duration)
      })),
      outOfScopeActivities: stringValue(requirements.outOfScopeActivities) || null
    },
    responsibilities: {
      client: requirements.clientResponsibilityRows.map((row, index) => ({
        id: row.id || `client-responsibility-${index + 1}`,
        title: stringValue(row.title),
        description: stringValue(row.description) || null,
        supportType: stringValue(row.supportType) || null
      })),
      consultant: requirements.consultantResponsibilityRows.map((row, index) => ({
        id: row.id || `consultant-responsibility-${index + 1}`,
        title: stringValue(row.title),
        description: stringValue(row.description) || null,
        reportingFrequency: stringValue(row.reportingFrequency) || stringValue(row.supportType) || null
      }))
    },
    deliverables: requirements.deliverableRows.map((row, index) => ({
      id: row.id || `deliverable-${index + 1}`,
      name: stringValue(row.deliverableName),
      description: stringValue(row.description) || null,
      submissionTimeline: stringValue(row.submissionTimeline) || null,
      formatRequired: stringValue(row.formatRequired) || null,
      submissionChannel: stringValue(row.submissionChannel) || stringValue(row.reviewer) || null,
      mandatory: typeof row.mandatory === 'boolean' ? row.mandatory : null
    })),
    reportingRequirements: requirements.reportingRequirementRows.map((row, index) => ({
      id: row.id || `reporting-requirement-${index + 1}`,
      reportType: stringValue(row.reportType),
      frequency: stringValue(row.frequency) || null,
      submissionFormat: stringValue(row.submissionFormat) || null,
      submissionChannel: stringValue(row.submissionChannel) || null
    })),
    qualifications: {
      individual: {
        professionalRegistrations: requirements.individualProfessionalCertifications,
        cvRequired: stringValue(requirements.individualCvRequired) || null,
        minimumYearsExperience: stringValue(requirements.individualYearsExperience) || null,
        minimumSimilarAssignments: stringValue(requirements.individualSimilarAssignmentsCount) || null,
        similarAssignmentEvidenceRequired: stringValue(requirements.individualSimilarAssignmentsEvidenceRequired) || null
      },
      firm: {
        minimumYearsExperience: stringValue(requirements.firmMinimumYearsExperience) || null,
        minimumSimilarAssignments: stringValue(requirements.firmRequiredSimilarAssignments) || null,
        sectorExperience: requirements.firmSectorExperience,
        similarAssignmentEvidenceRequired: stringValue(requirements.firmRequiredEvidence) || null,
        keyPersonnel: requirements.keyExpertRows.map((row, index) => ({
          id: row.id || `key-personnel-${index + 1}`,
          positionTitle: stringValue(row.positionTitle),
          minimumQualification: stringValue(row.minimumQualification) || null,
          yearsExperience: stringValue(row.yearsOfExperience) || null,
          certifications: stringValue(row.certifications) || null,
          quantity: stringValue(row.quantityRequired) || null,
          mandatory: typeof row.mandatory === 'boolean' ? row.mandatory : null
        }))
      },
      regulatoryLicences: regulatoryLicenseRequirements.map((row) => ({
        name: stringValue(row.license),
        issuingBody: stringValue(row.body) || null,
        mandatory: typeof row.mandatory === 'boolean' ? row.mandatory : null
      })),
      financialCapacityRequirements: financialRequirements.map((row) => ({
        requirementType: stringValue(row.requirementType),
        minimumValue: stringValue(row.minimumValue) || null,
        period: stringValue(row.period) || null,
        evidenceRequired: stringValue(row.evidenceRequired) || null,
        mandatory: typeof row.mandatory === 'boolean' ? row.mandatory : null
      }))
    },
    institutionalArrangements: {
      consultantReportsTo: stringValue(requirements.consultantReportsTo) || null,
      supervisingOfficer: stringValue(requirements.supervisingOfficer) || null,
      approvalAuthority: stringValue(requirements.approvalAuthority) || null,
      meetingFrequency: stringValue(requirements.meetingFrequency) || null,
      coordinationMechanism: stringValue(requirements.coordinationMechanism) || null,
      communicationMethods: requirements.communicationMethods,
      officeSpaceProvided: requirements.officeSpaceProvided,
      accessToFacilities: requirements.accessToFacilities,
      accessToDocuments: requirements.accessToDocuments
    },
    externalReferences: requirements.externalReferenceRows
      .map((row, index) => {
        const url = stringValue(row.url);
        return {
          id: row.id || `external-reference-${index + 1}`,
          name: stringValue(row.referenceName) || url || `External reference ${index + 1}`,
          description: stringValue(row.description) || null,
          url,
          safeHref: safeExternalHref(url)
        };
      })
      .filter((row) => row.name || row.url),
    evaluationCriteria: evaluationCriteria.map(normalizeEvaluationCriterion)
  };
}

function normalizeConsultancyRequirements(value: unknown): CreateTenderConsultancyRequirements {
  const record = objectValue(value);
  return {
    ...createEmptyConsultancyRequirements(),
    ...record,
    generalObjective: stringValue(record.generalObjective) || stringValue(record.consultancyGeneralObjective),
    entityBackgroundCards: typedRows<CreateTenderConsultancyEntityBackgroundCard>(record.entityBackgroundCards),
    specificObjectiveRows: typedRows<CreateTenderConsultancySpecificObjectiveRow>(record.specificObjectiveRows),
    assignmentActivityRows: typedRows<CreateTenderConsultancyAssignmentActivityRow>(record.assignmentActivityRows),
    clientResponsibilityRows: typedRows<CreateTenderConsultancyResponsibilityRow>(record.clientResponsibilityRows),
    consultantResponsibilityRows: typedRows<CreateTenderConsultancyResponsibilityRow>(record.consultantResponsibilityRows),
    deliverableRows: typedRows<CreateTenderConsultancyDeliverableRow>(record.deliverableRows),
    reportingRequirementRows: typedRows<CreateTenderConsultancyReportingRequirementRow>(record.reportingRequirementRows),
    individualProfessionalCertifications: stringArray(record.individualProfessionalCertifications),
    firmSectorExperience: stringArray(record.firmSectorExperience),
    keyExpertRows: typedRows<CreateTenderConsultancyKeyExpertRow>(record.keyExpertRows),
    communicationMethods: stringArray(record.communicationMethods),
    supportingDocumentRows: typedRows<CreateTenderConsultancySupportingDocumentRow>(record.supportingDocumentRows),
    externalReferenceRows: typedRows<CreateTenderConsultancyExternalReferenceRow>(record.externalReferenceRows)
  };
}

function consultancyDocumentsFromDraftRows(rows: CreateTenderConsultancySupportingDocumentRow[]): ConsultancyTenderDocumentAttachment[] {
  return rows
    .map((row, index) => {
      const uploadedDocument = stringValue(row.uploadName || row.documentTitle);
      if (!uploadedDocument && !row.documentTitle) return null;
      const document: TenderDetailDocument = {
        id: `draft-consultancy-document-${index + 1}`,
        name: uploadedDocument || row.documentTitle,
        documentType: 'DRAFT_ATTACHMENT',
        label: row.category || 'Draft attachment'
      };
      return {
        id: row.id || document.id,
        title: row.documentTitle || uploadedDocument || `Reference document ${index + 1}`,
        uploadedDocument: uploadedDocument || row.documentTitle,
        category: row.category || null,
        confidential: row.confidential,
        document
      };
    })
    .filter(Boolean) as ConsultancyTenderDocumentAttachment[];
}

function consultancyReviewDocuments(
  rows: CreateTenderConsultancySupportingDocumentRow[],
  documents: TenderDetailDocument[]
): ConsultancyTenderDocumentAttachment[] {
  if (!rows.length) {
    return documents.map((document) => ({
      id: document.id,
      title: document.label || document.documentType || document.name,
      uploadedDocument: document.name,
      category: document.label,
      confidential: null,
      document
    }));
  }

  const usedDocumentIds = new Set<string>();
  const linkedRows = rows
    .map((row, index) => {
      const document = findMatchingDocument(row, documents, usedDocumentIds);
      if (document) usedDocumentIds.add(document.id);
      const uploadedDocument = row.uploadName || document?.name || row.documentTitle;
      if (!row.documentTitle && !uploadedDocument) return null;
      return {
        id: row.id || document?.id || `consultancy-document-${index + 1}`,
        title: row.documentTitle || document?.label || document?.name || `Reference document ${index + 1}`,
        uploadedDocument: uploadedDocument || 'Document listed in ProcureX',
        category: row.category || document?.label || null,
        confidential: row.confidential,
        document
      };
    })
    .filter(Boolean) as ConsultancyTenderDocumentAttachment[];

  const extraDocuments = documents
    .filter((document) => !usedDocumentIds.has(document.id))
    .map((document) => ({
      id: document.id,
      title: document.label || document.documentType || document.name,
      uploadedDocument: document.name,
      category: document.label,
      confidential: null,
      document
    }));

  return [...linkedRows, ...extraDocuments];
}

function findMatchingDocument(
  row: CreateTenderConsultancySupportingDocumentRow,
  documents: TenderDetailDocument[],
  usedDocumentIds: Set<string>
) {
  const terms = [row.uploadName, row.documentTitle].map((value) => stringValue(value).toLowerCase()).filter(Boolean);
  return documents.find((document) => {
    if (usedDocumentIds.has(document.id)) return false;
    const name = stringValue(document.name).toLowerCase();
    const label = stringValue(document.label).toLowerCase();
    return terms.some((term) => name.includes(term) || term.includes(name) || label.includes(term));
  });
}

function tenderEvaluationCriteria(
  tender: TenderDetail | undefined,
  requirements: Record<string, unknown>,
  metadata: Record<string, unknown>
) {
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

function normalizeEvaluationCriterion(value: unknown): ConsultancyTenderDocumentModel['evaluationCriteria'][number] {
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

function normalizeAmendments(rows: ConsultancyReviewAmendment[]): ConsultancyTenderDocumentModel['amendments'] {
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

function consultancyReviewAmendments(source: unknown): ConsultancyReviewAmendment[] {
  const value = objectValue(source);
  return typedRows<ConsultancyReviewAmendment>(firstArray(value.amendments, value.amendmentRows));
}

function procurementMethodCode(method: string | undefined | null) {
  return /invited|restricted/i.test(String(method || '')) ? 'INVITED' : 'OPEN';
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

function tenderOrganization(tender: TenderDetail | undefined) {
  const buyerName = stringValue((tender as unknown as { buyerName?: string })?.buyerName);
  return buyerName || tender?.organization || tender?.ownerOrganization || 'Procuring organization';
}

function durationWithUnit(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  if (/[a-z]/i.test(text)) return text;
  return `${text} days`;
}

function safeExternalHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
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

function typedRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === 'object') as T[]) : [];
}

function firstArray(...values: unknown[]) {
  return values.find((value): value is unknown[] => Array.isArray(value) && value.length > 0) ?? [];
}
