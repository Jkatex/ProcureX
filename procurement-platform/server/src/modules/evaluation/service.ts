/* Coordinates evaluation business rules across repositories and peer modules before data leaves the server boundary. */
import { EvaluationStage, type Prisma } from '@prisma/client';
import { ModuleRepository, type EvaluationWorkspaceAuditRecord, type EvaluationWorkspaceTenderRecord } from './repository.js';
import {
  moduleDefinition,
  type EvaluationDashboardDto,
  type EvaluationDecisionStatus,
  type EvaluationDraftsResponseDto,
  type EvaluationRecordsQuery,
  type EvaluationRecordsResponseDto,
  type EvaluationRequestContext,
  type EvaluationWorkspaceDto,
  type ModuleStatus,
  type ReadyEvaluationResponseDto,
  type SaveEvaluationWorkspaceInput
} from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async dashboard(context?: EvaluationRequestContext): Promise<EvaluationDashboardDto> {
    try {
      const [publishedTenders, readyToEvaluate, draftedEvaluations, lockedUntilClosing, totalRecords] = await this.repository.getDashboardData(undefined, context);

      return {
        publishedTenders,
        readyToEvaluate,
        draftedEvaluations,
        lockedUntilClosing,
        totalRecords
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyDashboard;
      throw error;
    }
  }

  async records(query: EvaluationRecordsQuery, context?: EvaluationRequestContext): Promise<EvaluationRecordsResponseDto> {
    try {
      const data = await this.repository.listRecords(query, context);

      return {
        totalRecords: data.totalRecords,
        records: data.records.map((record) => ({
          id: record.id,
          tenderId: record.tender.id,
          reference: record.tender.reference,
          title: record.tender.title,
          buyerName: record.tender.buyerOrg.name,
          procurementType: record.tender.type,
          status: record.status,
          currentStage: readString(record.payload, 'activeStageId') ?? record.currentStage,
          progressPercentage: record.progress,
          recommendationStatus: record.recommendations[0]?.status ?? null,
          submittedBidCount: record.tender.bids.length,
          closingDate: record.tender.closingDate?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        }))
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { records: [], totalRecords: 0 };
      throw error;
    }
  }

  async drafts(context?: EvaluationRequestContext): Promise<EvaluationDraftsResponseDto> {
    try {
      const drafts = await this.repository.listDrafts(context);

      return {
        drafts: drafts.map((draft) => ({
          id: draft.id,
          tenderId: draft.tender.id,
          reference: draft.tender.reference,
          title: draft.tender.title,
          procurementType: draft.tender.type,
          currentStage: readString(draft.payload, 'activeStageId') ?? draft.currentStage,
          progressPercentage: draft.progress,
          submittedBidCount: draft.tender.bids.length,
          updatedAt: draft.updatedAt.toISOString()
        }))
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { drafts: [] };
      throw error;
    }
  }

  async ready(context?: EvaluationRequestContext): Promise<ReadyEvaluationResponseDto> {
    try {
      const tenders = await this.repository.listReadyTenders(context);
      const now = new Date();

      return {
        tenders: tenders.map((tender) => {
          const eligibility = tenderEvaluationEligibility(tender, now);
          const bidOpeningStatus = bidOpeningStatusLabel(tender);
          return {
            tenderId: tender.id,
            reference: tender.reference,
            title: tender.title,
            buyerName: tender.buyerOrg.name,
            procurementType: tender.type,
            closingDate: tender.closingDate?.toISOString() ?? '',
            submittedBidCount: tender.bids.length,
            bidCount: tender.bids.length,
            requirementCount: tender.requirementRows.length || countRequirementItems(tender.requirements),
            criteriaCount: tender.evaluation?.criteria.length ?? countEvaluationCriteria(tender.metadata),
            ready: eligibility.canStartEvaluation || eligibility.canContinueEvaluation,
            status: eligibility.evaluationStatus,
            tenderStatus: tender.status,
            bidOpeningStatus,
            hasClosed: eligibility.hasClosed,
            openingStatus: eligibility.openingStatus,
            evaluationStatus: eligibility.evaluationStatus,
            canStartEvaluation: eligibility.canStartEvaluation,
            canContinueEvaluation: eligibility.canContinueEvaluation,
            lockReason: eligibility.lockReason,
            currentStage: readString(tender.evaluation?.payload, 'activeStageId') ?? tender.evaluation?.currentStage ?? null,
            progressPercentage: tender.evaluation?.progress ?? 0,
            readinessReason: eligibility.lockReason
          };
        })
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { tenders: [] };
      throw error;
    }
  }

  async workspace(tenderId: string, context?: EvaluationRequestContext): Promise<EvaluationWorkspaceDto> {
    try {
      const data = await this.repository.getWorkspaceByTenderId(tenderId, context);
      return toWorkspaceDto(data.tender, data.auditEvents);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyWorkspace;
      throw error;
    }
  }

  async saveWorkspace(tenderId: string, input: SaveEvaluationWorkspaceInput, context?: EvaluationRequestContext): Promise<EvaluationWorkspaceDto> {
    try {
      await this.repository.saveWorkspace(tenderId, input, context);
      const data = await this.repository.getWorkspaceByTenderId(tenderId, context);
      return toWorkspaceDto(data.tender, data.auditEvents);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyWorkspace;
      throw error;
    }
  }
}

const emptyDashboard: EvaluationDashboardDto = {
  publishedTenders: 0,
  readyToEvaluate: 0,
  draftedEvaluations: 0,
  lockedUntilClosing: 0,
  totalRecords: 0
};

const emptyWorkspace: EvaluationWorkspaceDto = {
  tender: null,
  availability: {
    isReady: false,
    reason: 'No submitted bids available for evaluation yet.'
  },
  summary: {
    submittedBidCount: 0,
    evaluatedBidCount: 0,
    pendingEvaluationCount: 0,
    evaluationStatus: 'NOT_STARTED',
    recommendedBidder: null,
    updatedAt: null,
    lastSavedAt: null,
    activeStageId: null,
    selectedBidId: null
  },
  evaluationConfiguration: null,
  criteria: [],
  bids: [],
  rankings: [],
  sectionDraft: {},
  audit: {
    evaluatedBy: null,
    lastUpdatedBy: null,
    events: []
  }
};

const decisionStatuses: EvaluationDecisionStatus[] = ['PENDING', 'PASSED', 'FAILED', 'NEEDS_CLARIFICATION', 'RECOMMENDED'];

function toWorkspaceDto(tender: EvaluationWorkspaceTenderRecord | null, auditEvents: EvaluationWorkspaceAuditRecord[]): EvaluationWorkspaceDto {
  if (!tender) {
    return {
      ...emptyWorkspace,
      availability: {
        isReady: false,
        reason: 'Tender was not found.'
      }
    };
  }

  const workspace = tender.evaluation;
  const criteria = workspace?.criteria ?? [];
  const scores = workspace?.scores ?? [];
  const decisions = readDecisions(workspace?.payload);
  const sectionDraft = readSectionDraft(workspace?.payload);
  const openings = readOpenings(workspace?.payload);
  const priceScores = openings.financialOpened ? financialScores(tender.bids) : new Map<string, number>();
  const bids = tender.bids.map((bid) => {
    const bidScores = criteria.map((criterion) => {
      const score = latestScore(scores, bid.id, criterion.id);
      return {
        criterionId: criterion.id,
        score: decimalToNumber(score?.score),
        comment: score?.comment ?? '',
        evaluatorName: userName(score?.evaluatorUser ?? null),
        evaluatedAt: score?.createdAt.toISOString() ?? null
      };
    });
    const technical = technicalScore(bid.id, criteria, scores);
    const decision = decisions[bid.id];
    const comments = bidScores.map((score) => score.comment).filter(Boolean);

    return {
      id: bid.id,
      reference: bid.reference,
      supplierName: bid.supplierOrg.name,
      status: bid.status,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
      receiptRef: bid.receipt?.receiptRef ?? null,
      receiptHash: bid.receipt?.receiptHash ?? null,
      documents: bid.documents.filter((item) => financialDocumentsVisible(item.envelope, openings.financialOpened)).map((item) => ({
        id: item.document.id,
        name: item.document.name,
        documentType: item.document.documentType,
        reviewStatus: item.reviewStatus
      })),
      responses: bid.responses.map((response) => ({
        requirementKey: response.requirementKey,
        response: response.response
      })),
      financialAmount: openings.financialOpened ? decimalToNumber(bid.totalAmount) : null,
      currency: bid.currency,
      eligibilityStatus: eligibilityStatus(bid.payload),
      scores: bidScores,
      technicalScore: technical,
      financialScore: openings.financialOpened ? priceScores.get(bid.id) ?? null : null,
      totalScore: technical,
      evaluated: technical !== null,
      decisionStatus: decisionStatus(decision?.status),
      decisionComment: decision?.comment ?? '',
      commentSummary: decision?.comment || comments[0] || ''
    };
  });

  const rankings = bids
    .filter((bid) => bid.totalScore !== null)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .map((bid, index) => ({
      rank: index + 1,
      bidId: bid.id,
      bidderName: bid.supplierName,
      technicalScore: bid.technicalScore,
      financialScore: bid.financialScore,
      totalScore: bid.totalScore ?? 0,
      decisionStatus: bid.decisionStatus,
      commentSummary: bid.commentSummary
    }));
  const recommended = bids.find((bid) => bid.decisionStatus === 'RECOMMENDED')
    ?? workspace?.recommendations.find((recommendation) => recommendation.bid)?.bid
    ?? null;
  const evaluatedBidCount = bids.filter((bid) => bid.evaluated).length;
  const lastScore = scores[0] ?? null;
  const lastAudit = auditEvents[0] ?? null;

  return {
    tender: {
      id: tender.id,
      reference: tender.reference,
      referenceNumber: tender.reference,
      title: tender.title,
      buyerName: tender.buyerOrg.name,
      procurementType: tender.type,
      procurementCategory: tender.type,
      procurementMethod: humanizeEnum(tender.method ?? 'OPEN_TENDER'),
      evaluationMethod: evaluationMethod(tender.metadata),
      status: tender.status,
      closingDate: tender.closingDate?.toISOString() ?? null,
      currency: tender.currency,
      requirements: tender.requirements,
      metadata: tender.metadata,
      requirementRows: tender.requirementRows.map((row) => ({
        id: row.id,
        section: row.section,
        payload: row.payload
      })),
      commercialItems: tender.commercialItems.map((item) => ({
        id: item.id,
        itemNo: item.itemNo,
        description: item.description,
        quantity: decimalToNumber(item.quantity),
        unit: item.unit,
        rate: decimalToNumber(item.rate),
        total: decimalToNumber(item.total),
        payload: item.payload
      }))
    },
    availability: workspaceAvailability(tender),
    summary: {
      submittedBidCount: bids.length,
      evaluatedBidCount,
      pendingEvaluationCount: Math.max(0, bids.length - evaluatedBidCount),
      evaluationStatus: workspace?.status ?? 'NOT_STARTED',
      recommendedBidder: recommended
        ? {
            bidId: 'supplierName' in recommended ? recommended.id : recommended.id,
            supplierName: 'supplierName' in recommended ? recommended.supplierName : recommended.supplierOrg.name
          }
        : null,
      updatedAt: workspace?.updatedAt.toISOString() ?? null,
      lastSavedAt: readString(workspace?.payload, 'lastSavedAt') ?? lastAudit?.createdAt.toISOString() ?? null,
      activeStageId: readString(workspace?.payload, 'activeStageId'),
      selectedBidId: readString(workspace?.payload, 'selectedBidId')
    },
    evaluationConfiguration: buildEvaluationConfiguration(tender, criteria),
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      category: readCriterionCategory(criterion.payload) ?? humanizeEnum(criterion.stage),
      stage: criterion.stage,
      weight: decimalToNumber(criterion.weight),
      maxScore: decimalToNumber(criterion.maxScore) ?? 100
    })),
    bids,
    rankings,
    sectionDraft,
    audit: {
      evaluatedBy: userName(lastScore?.evaluatorUser ?? null),
      lastUpdatedBy: userName(lastAudit?.actorUser ?? null),
      events: auditEvents.map((event) => ({
        event: event.event,
        actorName: userName(event.actorUser ?? null),
        createdAt: event.createdAt.toISOString()
      }))
    }
  };
}

function workspaceAvailability(tender: EvaluationWorkspaceTenderRecord, now = new Date()) {
  if (!['PUBLISHED', 'OPEN', 'CLOSED', 'EVALUATION'].includes(tender.status)) {
    return { isReady: false, reason: 'Tender is not published yet.' };
  }
  if (!tenderHasClosed(tender, now)) {
    return { isReady: false, reason: 'Tender is locked until the closing date passes.' };
  }
  if (tender.bids.length === 0) {
    return { isReady: false, reason: 'No submitted bids available for evaluation yet.' };
  }
  if (tender.evaluation?.status === 'COMPLETED') {
    return { isReady: false, reason: 'Evaluation is already completed.' };
  }
  return { isReady: true, reason: null };
}

function buildEvaluationConfiguration(
  tender: EvaluationWorkspaceTenderRecord,
  criteria: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['criteria']
) {
  const stages = evaluationStagesForType(tender.type);
  const sections = stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    emptyMessage: emptySectionMessage(stage.label),
    items: [] as ReturnType<typeof configurationItemFromRow>[]
  }));
  const byStage = new Map(sections.map((section) => [section.id, section]));
  const seenItems = new Set<string>();
  const push = (item: ReturnType<typeof configurationItemFromRow>) => {
    const key = `${item.stageId}:${item.title.toLowerCase()}:${item.source.toLowerCase()}`;
    if (seenItems.has(key)) return;
    seenItems.add(key);
    const target = byStage.get(item.stageId);
    if (target) target.items.push(item);
  };

  for (const row of tender.requirementRows ?? []) push(configurationItemFromRow(tender.type, row));
  for (const item of tender.commercialItems ?? []) push(configurationItemFromCommercial(tender.type, item));
  for (const document of tender.documents ?? []) push(configurationItemFromTenderDocument(tender.type, document));
  for (const item of configuredItemsFromRequirements(tender)) push(item);
  for (const criterion of criteria) push(configurationItemFromCriterion(tender.type, criterion));

  const items = sections.flatMap((section) => section.items);
  const evaluationItems = items.filter((item) => item.source === 'evaluation criteria');
  const technicalWeight = sumWeights(evaluationItems.filter((item) => item.stageId === 'technical'));
  const financialWeight = sumWeights(evaluationItems.filter((item) => item.stageId === 'financial'));

  return {
    procurementCategory: tender.type,
    procurementMethod: humanizeEnum(tender.method ?? 'OPEN_TENDER'),
    evaluationMethod: evaluationMethod(tender.metadata),
    minimumPassMark: firstNumber(jsonObject(tender.metadata).minimumPassMark, jsonObject(tender.metadata).technicalPassMark),
    technicalWeight,
    financialWeight,
    requirements: tender.requirements,
    requiredDocuments: items.filter((item) => item.stageId === 'preliminary' || /document|license|certificate|submission/i.test(`${item.title} ${item.category}`)),
    technicalSpecifications: items.filter((item) => /technical|specification|scope|methodology|tor|personnel|equipment|work|sla/i.test(`${item.stageId} ${item.title} ${item.category}`)),
    evaluationCriteria: evaluationItems,
    qualificationRequirements: items.filter((item) => item.stageId === 'verification' || /qualification|experience|capacity|personnel|equipment|expert/i.test(`${item.title} ${item.category}`)),
    stages,
    sections
  };
}

function evaluationStagesForType(type: string) {
  void type;
  return [
    { id: 'opening', label: 'Opening Register' },
    { id: 'preliminary', label: 'Administrative & Eligibility Evaluation' },
    { id: 'technical', label: 'Custom Evaluation Criteria' },
    { id: 'financial', label: 'Financial Review' },
    { id: 'verification', label: 'Verification / Post-Qualification' },
    { id: 'ranking', label: 'Ranking & Recommendation' },
    { id: 'report', label: 'Evaluation Report' }
  ];
}

function configurationItemFromRow(type: string, row: EvaluationWorkspaceTenderRecord['requirementRows'][number]) {
  const payload = jsonObject(row.payload);
  const title = textValue(payload.title, payload.label, payload.requirementName, payload.requirement, payload.documentName, payload.documentTitle, payload.license, payload.role, payload.position, payload.equipmentName, payload.description) || row.section;
  const description = textValue(payload.description, payload.notes, payload.value, payload.requirement, payload.evidenceRequired, payload.technicalSpecification, payload.minimumQualification) || row.section;
  return {
    id: `requirement-${row.id}`,
    stageId: stageForConfiguredItem(type, `${row.section} ${title} ${description}`),
    title,
    description,
    source: row.section,
    category: row.section,
    mandatory: payload.mandatory !== false,
    weight: firstNumber(payload.weight),
    maxScore: firstNumber(payload.maxScore, payload.maximumScore),
    evidenceRequired: textList(payload.evidenceRequired ?? (payload.requiresUpload === true ? title : undefined)),
    payload: row.payload
  };
}

function configurationItemFromCommercial(type: string, item: EvaluationWorkspaceTenderRecord['commercialItems'][number]) {
  return {
    id: `commercial-${item.id}`,
    stageId: 'financial',
    title: `${item.itemNo ? `${item.itemNo} - ` : ''}${item.description}`,
    description: [item.quantity ? `Qty ${decimalToNumber(item.quantity)}` : '', item.unit, item.rate ? `Rate ${decimalToNumber(item.rate)}` : '', item.total ? `Total ${decimalToNumber(item.total)}` : ''].filter(Boolean).join(' / '),
    source: type === 'WORKS' ? 'Bill of quantities' : type === 'SERVICE' ? 'Price schedule' : 'Commercial schedule',
    category: 'Commercial schedule',
    mandatory: true,
    weight: null,
    maxScore: null,
    evidenceRequired: [],
    payload: item.payload
  };
}

function configurationItemFromTenderDocument(type: string, item: EvaluationWorkspaceTenderRecord['documents'][number]) {
  return {
    id: `document-${item.document.id}`,
    stageId: 'preliminary',
    title: item.label || item.document.name,
    description: item.document.documentType || 'Tender document',
    source: 'Required document',
    category: type === 'CONSULTANCY' ? 'Proposal document' : 'Submission document',
    mandatory: true,
    weight: null,
    maxScore: null,
    evidenceRequired: [item.document.name],
    payload: { documentId: item.document.id, documentType: item.document.documentType }
  };
}

function configurationItemFromCriterion(type: string, criterion: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['criteria'][number]) {
  const payload = jsonObject(criterion.payload);
  const category = readCriterionCategory(criterion.payload) ?? humanizeEnum(criterion.stage);
  const stageId = criterion.stage === 'FINANCIAL' ? 'financial' : criterion.stage === 'ELIGIBILITY' || criterion.stage === 'PRELIMINARY' ? 'preliminary' : 'technical';
  return {
    id: `criterion-${criterion.id}`,
    stageId,
    title: criterion.name,
    description: textValue(payload.description, payload.scoringGuide, payload.subcriteria) || category,
    source: 'evaluation criteria',
    category,
    mandatory: payload.mandatory === true || firstNumber(criterion.maxScore) === 1,
    weight: decimalToNumber(criterion.weight),
    maxScore: decimalToNumber(criterion.maxScore),
    evidenceRequired: textList(payload.evidenceRequired),
    payload: criterion.payload
  };
}

function configuredItemsFromRequirements(tender: EvaluationWorkspaceTenderRecord) {
  const requirements = jsonObject(tender.requirements);
  const fields = objectFromUnknown(
    objectFromUnknown(requirements[tender.type.toLowerCase()]).fields
      || objectFromUnknown(requirements.goods).fields
      || objectFromUnknown(requirements.works).fields
      || objectFromUnknown(requirements.services).fields
      || objectFromUnknown(requirements.consultancy).fields
  );
  const rows: ReturnType<typeof configurationItemFromRow>[] = [];
  const addArray = (key: string, section: string) => {
    const value = fields[key] ?? requirements[key];
    if (!Array.isArray(value)) return;
    value.forEach((payload, index) => {
      rows.push(configurationItemFromRow(tender.type, {
        id: `json-${key}-${index}`,
        section,
        payload: (typeof payload === 'object' && payload !== null ? payload : { title: String(payload) }) as Prisma.JsonValue,
        tenderId: tender.id,
        createdAt: new Date(0)
      } as EvaluationWorkspaceTenderRecord['requirementRows'][number]));
    });
  };
  addArray('productSpecificationTemplate', 'Technical specification');
  addArray('sampleRequirementRows', 'Sample requirement');
  addArray('financialRequirementRows', 'Financial requirement');
  addArray('eligibilityRequirementCards', 'Eligibility');
  addArray('otherEligibilityRequirements', 'Eligibility');
  addArray('regulatoryLicenseRequirementRows', 'Regulatory license');
  addArray('technicalSpecificationDocuments', 'Technical specification');
  addArray('drawingDesignRows', 'Drawings');
  addArray('personnelRequirementRows', 'Personnel');
  addArray('equipmentRequirementRows', 'Equipment');
  addArray('supportingDocumentRows', 'Supporting document');
  addArray('serviceBoqRows', 'Price schedule');
  addArray('boqRows', 'Bill of quantities');
  addArray('lumpSumPricingRows', 'Bill of quantities');
  addArray('specificObjectiveRows', 'Terms of reference');
  addArray('assignmentActivityRows', 'Terms of reference');
  addArray('deliverableRows', 'Terms of reference');
  addArray('reportingRequirementRows', 'Terms of reference');
  addArray('keyExpertRows', 'Key experts');
  return rows;
}

function stageForConfiguredItem(type: string, text: string) {
  const value = text.toLowerCase();
  if (/price|financial|boq|bill|quantity|commercial|fee|rate|schedule/.test(value)) return 'financial';
  if (/license|certificate|registration|tax|document|eligib|administrative|declaration|submission|mandatory/.test(value)) return 'preliminary';
  if (/qualification|post|verification|due diligence|reference|capacity|past performance|manufacturer authorization|physical address/.test(value)) return 'verification';
  if (type === 'CONSULTANCY' && /expert|cv|availability|negotiation|remuneration|reimbursable/.test(value)) return 'verification';
  return 'technical';
}

function evaluationMethod(metadata: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(metadata);
  return textValue(object.evaluationMethod, object.awardMethod, object.selectionMethod, object.method) || 'Manual Buyer Review';
}

function emptySectionMessage(label: string) {
  return `No ${label.toLowerCase()} data was configured for this tender.`;
}

function sumWeights(items: Array<{ weight: number | null }>) {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  return total > 0 ? roundScore(total) : null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(String(value).replace(/,/g, '').trim());
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function textValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) return value.map((item: unknown) => textValue(item)).filter(Boolean).join(', ');
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      const nested: string = textValue(object.title, object.label, object.name, object.description, object.value, object.requirement);
      if (nested) return nested;
    }
  }
  return '';
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item: unknown) => textValue(item)).filter(Boolean);
  const text = textValue(value);
  return text ? text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) : [];
}

function objectFromUnknown(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function tenderEvaluationEligibility(tender: {
  status: string;
  closingDate: Date | null;
  bids: Array<unknown>;
  metadata?: Prisma.JsonValue;
  evaluation: {
    status: string;
  } | null;
}, now = new Date()) {
  const openingStatus = bidOpeningStatusValue(tender);
  const hasClosed = tenderHasClosed(tender, now);
  const evaluationStatus = tender.evaluation?.status ?? 'NOT_STARTED';
  const bidCount = tender.bids.length;

  if (tender.evaluation?.status === 'COMPLETED') {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'COMPLETED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: null
    };
  }
  if (tender.evaluation?.status === 'IN_PROGRESS' || tender.evaluation?.status === 'RETURNED') {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: tender.evaluation.status,
      canStartEvaluation: false,
      canContinueEvaluation: true,
      lockReason: null
    };
  }
  if (!hasClosed) {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'LOCKED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: 'Tender has not closed yet'
    };
  }
  if (bidCount === 0) {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'LOCKED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: 'No bids available for evaluation'
    };
  }
  if (!openingComplete(openingStatus)) {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'LOCKED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: 'Complete bid opening first'
    };
  }
  return {
    hasClosed,
    bidCount,
    openingStatus,
    evaluationStatus,
    canStartEvaluation: true,
    canContinueEvaluation: false,
    lockReason: null
  };
}

function tenderHasClosed(tender: { status: string; closingDate: Date | null }, now = new Date()) {
  return tender.status === 'CLOSED' || tender.status === 'EVALUATION' || Boolean(tender.closingDate && tender.closingDate <= now);
}

function bidOpeningStatusValue(tender: { status: string; bids: Array<unknown>; metadata?: Prisma.JsonValue; evaluation?: { status: string } | null }) {
  const metadata = jsonObject(tender.metadata);
  const direct = metadata.bidOpeningStatus ?? metadata.openingStatus;
  if (typeof direct === 'string' && direct.trim()) return direct.trim().toUpperCase();
  if (tender.evaluation && ['IN_PROGRESS', 'RETURNED', 'COMPLETED'].includes(tender.evaluation.status)) return 'COMPLETED';
  if (['CLOSED', 'EVALUATION'].includes(tender.status) && tender.bids.length > 0) return 'COMPLETED';
  return 'PENDING';
}

function bidOpeningStatusLabel(tender: { status: string; bids: Array<unknown>; metadata?: Prisma.JsonValue; evaluation?: { status: string } | null }) {
  const value = bidOpeningStatusValue(tender);
  if (openingComplete(value)) return 'Opening Completed';
  if (value === 'OPENED') return 'Opened';
  return humanizeEnum(value);
}

function openingComplete(value: string) {
  return ['COMPLETED', 'COMPLETE', 'OPENED'].includes(value);
}

function countRequirementItems(value: Prisma.JsonValue | null | undefined): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => {
    if (Array.isArray(item)) return sum + item.length;
    if (item && typeof item === 'object') {
      const rows = (item as Record<string, unknown>).rows;
      if (Array.isArray(rows)) return sum + rows.length;
      return sum + Object.keys(item).length;
    }
    return item === null || item === undefined || item === '' ? sum : sum + 1;
  }, 0);
}

function countEvaluationCriteria(metadata: Prisma.JsonValue | null | undefined): number {
  const criteria = jsonObject(metadata).evaluationCriteria;
  if (Array.isArray(criteria)) return criteria.length;
  if (criteria && typeof criteria === 'object') return Object.keys(criteria).length;
  return 0;
}

function financialDocumentsVisible(envelope: string, financialOpened: boolean) {
  if (envelope !== 'FINANCIAL') return true;
  return financialOpened;
}

function readDecisions(payload: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(payload);
  const decisions = object.decisions;
  if (typeof decisions !== 'object' || decisions === null || Array.isArray(decisions)) return {};
  return decisions as Record<string, { status?: string; comment?: string }>;
}

function readSectionDraft(payload: Prisma.JsonValue | null | undefined) {
  const sectionDraft = jsonObject(payload).sectionDraft;
  if (typeof sectionDraft !== 'object' || sectionDraft === null || Array.isArray(sectionDraft)) return {};
  return sectionDraft as Record<string, unknown>;
}

function readOpenings(payload: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(payload);
  return {
    technicalOpened: typeof object.technicalOpenedAt === 'string' && object.technicalOpenedAt.length > 0,
    financialOpened: typeof object.financialOpenedAt === 'string' && object.financialOpenedAt.length > 0
  };
}

function readString(payload: Prisma.JsonValue | null | undefined, key: string) {
  const value = jsonObject(payload)[key];
  return typeof value === 'string' ? value : null;
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readCriterionCategory(payload: Prisma.JsonValue | null | undefined) {
  const value = jsonObject(payload).category;
  return typeof value === 'string' && value.trim() ? value : null;
}

function eligibilityStatus(payload: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(payload);
  const direct = object.eligibilityStatus;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const eligibility = object.eligibility;
  if (typeof eligibility === 'object' && eligibility !== null && !Array.isArray(eligibility)) {
    const status = (eligibility as Record<string, unknown>).status;
    if (typeof status === 'string' && status.trim()) return status;
  }
  return 'Pending';
}

function latestScore(
  scores: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['scores'],
  bidId: string,
  criterionId: string
) {
  return scores.find((score) => score.bidId === bidId && score.criterionId === criterionId) ?? null;
}

function technicalScore(
  bidId: string,
  criteria: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['criteria'],
  scores: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['scores']
) {
  if (criteria.length === 0) return null;
  const rows = criteria.map((criterion) => ({ criterion, score: latestScore(scores, bidId, criterion.id) }));
  if (rows.some((row) => row.score?.score === null || row.score?.score === undefined)) return null;
  const totalWeight = criteria.reduce((sum, criterion) => sum + (decimalToNumber(criterion.weight) ?? 0), 0);
  if (totalWeight > 0) {
    return roundScore(
      rows.reduce((sum, row) => {
        const score = decimalToNumber(row.score?.score) ?? 0;
        const maxScore = decimalToNumber(row.criterion.maxScore) ?? 100;
        return sum + (score / maxScore) * (decimalToNumber(row.criterion.weight) ?? 0);
      }, 0)
    );
  }
  return roundScore(
    rows.reduce((sum, row) => {
      const score = decimalToNumber(row.score?.score) ?? 0;
      const maxScore = decimalToNumber(row.criterion.maxScore) ?? 100;
      return sum + (score / maxScore) * 100;
    }, 0) / Math.max(1, rows.length)
  );
}

function financialScores(bids: EvaluationWorkspaceTenderRecord['bids']) {
  const amounts = bids
    .map((bid) => ({ bidId: bid.id, amount: decimalToNumber(bid.totalAmount) }))
    .filter((row): row is { bidId: string; amount: number } => typeof row.amount === 'number' && row.amount > 0);
  const lowest = Math.min(...amounts.map((row) => row.amount));
  const scores = new Map<string, number>();
  if (!Number.isFinite(lowest)) return scores;
  for (const row of amounts) scores.set(row.bidId, roundScore((lowest / row.amount) * 100));
  return scores;
}

function decisionStatus(value: string | undefined): EvaluationDecisionStatus {
  return decisionStatuses.includes(value as EvaluationDecisionStatus) ? value as EvaluationDecisionStatus : 'PENDING';
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : Number(value.toString());
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function userName(user: { displayName: string | null; email: string } | null) {
  return user?.displayName || user?.email || null;
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isDatabaseUnavailable(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return code === 'P1001' || code === 'P2024' || message.includes("can't reach database") || message.includes('database_url');
}
