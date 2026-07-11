import type { Tender } from '@/shared/types/domain';

export type ProcurementTender = Tender;

export type CreateTenderProcurementTypeId = 'goods' | 'works' | 'services' | 'consultancy';

export type CreateTenderDraftStatus = 'DRAFT' | 'SUBMITTED' | 'PUBLISHED';

export type CreateTenderRequirementControl = {
  id: string;
  label: string;
  help?: string;
  kind: 'text' | 'textarea' | 'select' | 'number' | 'date';
  options?: string[];
};

export type CreateTenderRequirementTemplate = {
  id: string;
  typeId: CreateTenderProcurementTypeId;
  title: string;
  description: string;
  controls: CreateTenderRequirementControl[];
};

export type CreateTenderEvaluationCriterion = {
  id: string;
  label: string;
  weight: number;
  notes: string;
  suggestedFor: CreateTenderProcurementTypeId[];
  category?: string;
  evaluationType?: string;
  description?: string;
  maxScore?: number;
  mandatory?: boolean;
  passFailGate?: boolean;
  evidenceRequired?: string[];
  scoringGuide?: string[];
  subcriteria?: string[];
  custom?: boolean;
};

export type CreateTenderSetup = {
  procurementTypes: Array<{ id: CreateTenderProcurementTypeId; label: string; description: string }>;
  categories: Record<CreateTenderProcurementTypeId, string[]>;
  fundingSources: string[];
  currencies: string[];
  procurementMethods: string[];
  regulatoryLicenses: Record<CreateTenderProcurementTypeId, string[]>;
  requirementTemplates: CreateTenderRequirementTemplate[];
  evaluationCatalog: CreateTenderEvaluationCriterion[];
  milestoneDefaults: string[];
};

export type CreateTenderContact = {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
};

export type CreateTenderLineItem = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice?: string;
};

export type CreateTenderProductSpecificationRow = {
  id: string;
  sourceItemId: string;
  specificationName: string;
  acceptableRequirement: string;
};

export type CreateTenderSampleRequirementRow = {
  id: string;
  relatedBoqItemId: string;
  sampleRequired: boolean;
  numberOfSamples: string;
  sampleDescription: string;
  deliveryLocation: string;
  deliveryDeadline: string;
  mandatory: boolean;
  returnableSample: boolean;
};

export type CreateTenderFinancialRequirementRow = {
  id: string;
  requirementType: string;
  minimumValue: string;
  period: string;
  evidenceRequired: string;
  mandatory: boolean;
};

export type CreateTenderEligibilityRequirementRow = {
  id: string;
  requirementName: string;
  mandatory: boolean;
  requiresUpload: boolean;
  notes: string;
};

export type CreateTenderRegulatoryLicenseRequirementRow = {
  id: string;
  license: string;
  body: string;
  mandatory: boolean;
  expiryRequired: boolean;
};

export type CreateTenderWorksSpecificationDocumentRow = {
  id: string;
  documentTitle: string;
  customDocumentTitle: string;
  uploadName: string;
};

export type CreateTenderWorksDrawingRow = {
  id: string;
  documentType: string;
  otherDocumentName: string;
  uploadName: string;
};

export type CreateTenderWorksLumpSumPricingRow = {
  id: string;
  section: string;
  description: string;
  amount: string;
};

export type CreateTenderWorksBoqRow = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
};

export type CreateTenderWorksMilestoneRow = {
  id: string;
  milestone: string;
  targetDate: string;
};

export type CreateTenderServiceBoqRow = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
};

export type CreateTenderServicePersonnelRequirementRow = {
  id: string;
  position: string;
  minimumEducation: string;
  minimumYearsExperience: string;
  cvRequired: boolean;
  mandatory: boolean;
};

export type CreateTenderServiceEquipmentRequirementRow = {
  id: string;
  equipmentName: string;
  quantity: string;
  ownershipRequirement: string;
  technicalSpecification: string;
  evidenceRequired: string[];
  mandatory: boolean;
  evaluationMethod: string;
  supplierResponseType: string;
};

export type CreateTenderServiceEnvironmentalSocialRequirementCard = {
  id: string;
  category: string;
  description: string;
  evidenceRequired: string[];
  mandatory: boolean;
};

export type CreateTenderServiceSupportingDocumentRow = {
  id: string;
  documentName: string;
  mandatory: boolean;
};

export type CreateTenderConsultancyEntityBackgroundCard = {
  id: string;
  organizationBackground: string;
  departmentUnit: string;
};

export type CreateTenderConsultancySpecificObjectiveRow = {
  id: string;
  objectiveTitle: string;
  objectiveDescription: string;
  priorityLevel: string;
};

export type CreateTenderConsultancyAssignmentActivityRow = {
  id: string;
  activityTitle: string;
  detailedDescription: string;
  expectedOutput: string;
  location: string;
  duration: string;
};

export type CreateTenderConsultancyResponsibilityRow = {
  id: string;
  title: string;
  description: string;
  supportType: string;
};

export type CreateTenderConsultancyDeliverableRow = {
  id: string;
  deliverableName: string;
  description: string;
  submissionTimeline: string;
  formatRequired: string;
  reviewer: string;
  mandatory: boolean;
};

export type CreateTenderConsultancyReportingRequirementRow = {
  id: string;
  reportType: string;
  frequency: string;
  submissionFormat: string;
  submissionChannel: string;
};

export type CreateTenderConsultancyKeyExpertRow = {
  id: string;
  positionTitle: string;
  minimumQualification: string;
  yearsOfExperience: string;
  certifications: string;
  quantityRequired: string;
  mandatory: boolean;
};

export type CreateTenderConsultancySupportingDocumentRow = {
  id: string;
  documentTitle: string;
  category: string;
  uploadName: string;
  confidential: boolean;
};

export type CreateTenderConsultancyExternalReferenceRow = {
  id: string;
  referenceName: string;
  url: string;
  description: string;
};

export type CreateTenderConsultancyRequirements = {
  entityBackgroundCards: CreateTenderConsultancyEntityBackgroundCard[];
  projectName: string;
  backgroundNarrative: string;
  existingChallenges: string;
  currentSituation: string;
  relatedInitiatives: string;
  mainProblemDescription: string;
  expectedImpact: string;
  generalObjective: string;
  specificObjectiveRows: CreateTenderConsultancySpecificObjectiveRow[];
  assignmentActivityRows: CreateTenderConsultancyAssignmentActivityRow[];
  outOfScopeActivities: string;
  clientResponsibilityRows: CreateTenderConsultancyResponsibilityRow[];
  consultantResponsibilityRows: CreateTenderConsultancyResponsibilityRow[];
  deliverableRows: CreateTenderConsultancyDeliverableRow[];
  reportingRequirementRows: CreateTenderConsultancyReportingRequirementRow[];
  individualProfessionalCertifications: string[];
  individualCvRequired: string;
  individualYearsExperience: string;
  individualSimilarAssignmentsCount: string;
  individualSimilarAssignmentsEvidenceRequired: string;
  firmMinimumYearsExperience: string;
  firmRequiredSimilarAssignments: string;
  firmSectorExperience: string[];
  firmRequiredEvidence: string;
  keyExpertRows: CreateTenderConsultancyKeyExpertRow[];
  consultantReportsTo: string;
  supervisingOfficer: string;
  approvalAuthority: string;
  meetingFrequency: string;
  coordinationMechanism: string;
  communicationMethods: string[];
  officeSpaceProvided: boolean;
  accessToFacilities: boolean;
  accessToDocuments: boolean;
  supportingDocumentRows: CreateTenderConsultancySupportingDocumentRow[];
  externalReferenceRows: CreateTenderConsultancyExternalReferenceRow[];
};

export type CreateTenderServiceRequirements = {
  serviceCategory: string;
  scopeOfServices: string;
  serviceLocations: string[];
  duration: string;
  serviceBoqRows: CreateTenderServiceBoqRow[];
  personnelRequirementRows: CreateTenderServicePersonnelRequirementRow[];
  numberOfGuards: string;
  shiftSchedule: string;
  patrolFrequency: string;
  weaponRequirement: string;
  controlRoomRequirement: string;
  cleaningAreas: string;
  cleaningFrequency: string;
  cleaningMaterials: string;
  wasteDisposalRequirements: string;
  serviceDeliverables: string[];
  serviceMilestones: string[];
  reportingRequirements: string;
  slaRequirement: string;
  uptimeRequirement: string;
  responseTime: string;
  supportHours: string;
  maintenanceSchedule: string;
  sparePartsRequirement: string;
  technicianRequirements: string;
  menuRequirements: string;
  hygieneRequirements: string;
  foodCertifications: string[];
  fleetRequirements: string;
  driverLicenseRequirements: string;
  routeCoverage: string;
  equipmentRequirementRows: CreateTenderServiceEquipmentRequirementRow[];
  esRequirementCards: CreateTenderServiceEnvironmentalSocialRequirementCard[];
  supportingDocumentRows: CreateTenderServiceSupportingDocumentRow[];
  insuranceCovers: string[];
  insuranceNotes: string;
  riskAssessmentRequirement: string;
  safetyPlanRequirement: string;
  ppeRequirements: string;
};

export type CreateTenderWorksRequirements = {
  projectName: string;
  procuringEntity: string;
  location: string;
  contractType: string;
  customContractType: string;
  completionPeriod: string;
  scopeSummary: string;
  mainConstructionActivities: string[];
  technicalSpecificationDocuments: CreateTenderWorksSpecificationDocumentRow[];
  drawingDesignRows: CreateTenderWorksDrawingRow[];
  lumpSumPricingRows: CreateTenderWorksLumpSumPricingRow[];
  boqRows: CreateTenderWorksBoqRow[];
  commencementDate: string;
  worksCompletionPeriod: string;
  worksMilestoneRows: CreateTenderWorksMilestoneRow[];
  siteVisitRequirement: 'Mandatory' | 'Not mandatory';
  siteSurveyUploadName: string;
  similarCompletedProjectsRequired: boolean;
  keyPersonnelCvsRequired: boolean;
  bankStatementsRequired: boolean;
  bankStatementPeriod: string;
};

export type CreateTenderMilestone = {
  id: string;
  label: string;
  dueDate: string;
};

export type CreateTenderConfirmationId = 'accuracy' | 'compliance' | 'evaluation' | 'publication';

export type CreateTenderDraft = {
  id: string;
  status: CreateTenderDraftStatus;
  title: string;
  reference: string;
  description: string;
  procuringEntity: string;
  fundingSource: string;
  customFundingSource: string;
  currency: string;
  estimatedBudget: string;
  contact: CreateTenderContact;
  submissionDate: string;
  openingDate: string;
  clarificationDeadline: string;
  publicationDate: string;
  location: string;
  procurementTypeId: CreateTenderProcurementTypeId;
  categories: string[];
  method: string;
  invitedSuppliers: string[];
  requirements: Record<string, string>;
  selectedLicenses: string[];
  commercialItems: CreateTenderLineItem[];
  productSpecifications: CreateTenderProductSpecificationRow[];
  sampleRequirements: CreateTenderSampleRequirementRow[];
  financialRequirements: CreateTenderFinancialRequirementRow[];
  eligibilityRequirements: CreateTenderEligibilityRequirementRow[];
  regulatoryLicenseRequirements: CreateTenderRegulatoryLicenseRequirementRow[];
  consultancyRequirements: CreateTenderConsultancyRequirements;
  serviceRequirements: CreateTenderServiceRequirements;
  worksRequirements: CreateTenderWorksRequirements;
  deliverables: string[];
  attachments: string[];
  milestones: CreateTenderMilestone[];
  evaluationCriteria: CreateTenderEvaluationCriterion[];
  confirmations: Record<CreateTenderConfirmationId, boolean>;
  planFilledFields: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  publishedAt?: string;
};

export type CreateTenderSubmissionResult = {
  tenderId: string;
  reference: string;
  status: 'PASSED';
  submittedAt: string;
};

export type MarketplaceTenderRow = Tender & {
  category?: string;
  ownerOrganization?: string;
  ownedByCurrentOrganization?: boolean;
  canBid?: boolean;
  hasDraftBid?: boolean;
  hasSubmittedBid?: boolean;
  isSaved?: boolean;
};

export type MyTenderRow = {
  id: string;
  title: string;
  section: 'draft' | 'posted' | 'completed';
  status: string;
  type: Tender['type'];
  tender?: Tender;
  lastActivity: string;
  actionLabel: string;
  nav: string;
};

export type MyBidRow = {
  id: string;
  tenderId?: string;
  title: string;
  section: 'draft' | 'submitted';
  status: string;
  tender: Tender;
  tenderReference: string;
  amount?: string;
  receiptHash?: string;
  lastActivity: string;
  actionLabel: string;
  nav: string;
};

export type MarketplacePayload = {
  tenders: MarketplaceTenderRow[];
  myTenders: MyTenderRow[];
  myBids: MyBidRow[];
};

export type TenderDraftValidation = {
  warnings: string[];
  missingRequiredFields: Array<{ path: string; label: string; section: string }>;
  schemaVersion: string;
};

export type CreateTenderPayload = {
  title: string;
  description: string;
  type: 'Goods' | 'Works' | 'Non Consultancy' | 'Consultancy';
  categories: string[];
  budget?: number;
  currency: string;
  location: string;
  closingDate?: string;
  requirements: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type UpdateTenderPayload = Partial<CreateTenderPayload>;

export type CreateTenderResponse = {
  success: true;
  message: string;
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    type: string;
    createdAt: string;
  };
  validation?: TenderDraftValidation;
};

export type UpdateTenderResponse = {
  success: true;
  message: string;
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    updatedAt: string;
  };
  validation?: TenderDraftValidation;
};

export type PublishTenderResponse = {
  success: true;
  message: string;
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    visibility: string;
    publishedAt: string;
    closingDate: string;
  };
  validation?: {
    warnings: string[];
    scannerIssues: Array<Record<string, unknown>>;
    standardizedCategories: string[];
  };
  languageScan?: Record<string, unknown>;
};

export type PublishTenderFailure = {
  success: false;
  message: string;
  errors: Array<{ step?: string; field?: string; message: string; severity?: string }>;
};

export type TenderDetailDocument = {
  id: string;
  name: string;
  documentType: string;
  label: string | null;
  openUrl?: string;
  downloadUrl?: string;
};

export type TenderDetail = MarketplaceTenderRow & {
  buyerOrgId?: string;
  ownerUserId?: string | null;
  method?: string;
  contractType?: string | null;
  visibility?: string;
  publishedAt?: string | null;
  requirements?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requirementRows?: Array<{ id: string; section: string; payload: Record<string, unknown> }>;
  milestones?: Array<{ id: string; name: string; dueDate: string | null; payload: Record<string, unknown> }>;
  commercialItems?: Array<{
    id: string;
    itemNo: string | null;
    description: string;
    quantity: number;
    unit: string | null;
    rate: number;
    total: number;
    payload: Record<string, unknown>;
  }>;
  documents?: TenderDetailDocument[];
  canBid?: boolean;
  bidSummary?: {
    total: number;
    draft: number;
    submitted: number;
    withdrawn: number;
  };
  submittedBidBusinesses?: Array<{
    id: string;
    name: string;
    submittedAt: string | null;
  }>;
  currentBid?: {
    id: string;
    reference?: string;
    status: string;
    submittedAt: string | null;
    receiptHash: string | null;
  } | null;
  activity?: {
    marketplaceViews: number;
    documentDownloads: number;
    clarifications: number;
  };
};

export type TenderReviewQueueItem = {
  id: string;
  reference: string;
  title: string;
  buyerOrgId: string;
  buyerName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  type: string;
  status: string;
  method: string;
  visibility: string;
  budget: number;
  currency: string;
  location: string;
  closingDate: string;
  categories: string[];
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TenderReviewListResponse = {
  success: true;
  items: TenderReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  generatedAt: string;
};

export type TenderReviewDetail = TenderDetail & {
  buyerName: string;
  ownerName: string | null;
  submittedAt: string;
  reviewAttempts: number;
};

export type TenderReviewDecisionResponse = {
  success: true;
  message: string;
  data: {
    tenderId: string;
    reference: string;
    title: string;
    status: string;
    visibility: string;
    publishedAt: string;
    communicationMessageId: string | null;
    marketplaceRoute?: string;
    amendmentRoute?: string;
  };
};
