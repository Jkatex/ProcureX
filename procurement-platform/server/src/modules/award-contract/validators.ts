import {
  ApprovalStatus,
  AwardResponseAction,
  ContractLifecycleItemStatus,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractRiskLevel,
  ContractStatus,
  ContractTerminationStatus,
  ContractTerminationType,
  InvoiceStatus,
  RecommendationStatus
} from '@prisma/client';
import { z } from 'zod';

const uuidSchema = z.string().trim().uuid();
const optionalUuidSchema = z.union([z.literal(''), uuidSchema]).optional().default('');
const nonEmptyText = z.string().trim().min(1).max(2000);
const optionalNote = z.string().trim().max(2000).optional().default('');
const jsonObjectSchema = z.record(z.string(), z.unknown()).optional().default({});
const statusTextSchema = z.string().trim().min(1).max(80).regex(/^[A-Z][A-Z0-9_ -]*$/).optional();

export const moduleStatusQuerySchema = z.object({}).strict();

export const idParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const signatureParamsSchema = z
  .object({
    id: uuidSchema,
    signatureId: uuidSchema
  })
  .strict();

export const milestoneParamsSchema = z
  .object({
    id: uuidSchema,
    milestoneId: uuidSchema
  })
  .strict();

export const lifecycleItemParamsSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema
  })
  .strict();

export const terminationParamsSchema = z
  .object({
    id: uuidSchema,
    terminationId: uuidSchema
  })
  .strict();

export const invoiceParamsSchema = z
  .object({
    id: uuidSchema,
    invoiceId: uuidSchema
  })
  .strict();

export const awardRecommendationQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    status: z.union([z.literal('all'), z.nativeEnum(RecommendationStatus)]).optional().default('all'),
    search: z.string().trim().max(120).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
  .strict();

export const contractQuerySchema = z
  .object({
    organizationId: optionalUuidSchema,
    status: z.union([z.literal('all'), z.nativeEnum(ContractStatus)]).optional().default('all'),
    search: z.string().trim().max(120).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
  .strict();

export const awardDecisionBodySchema = z
  .object({
    selectedSupplier: z.string().trim().max(240).optional(),
    awardAmount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    awardDate: z.string().trim().date().optional(),
    reason: z.string().trim().max(4000).optional(),
    conditions: z.string().trim().max(4000).optional(),
    confirmationBy: z.string().trim().max(160).optional(),
    confirmations: z
      .object({
        evaluationReviewed: z.boolean().optional(),
        documentsReviewed: z.boolean().optional(),
        authorityConfirmed: z.boolean().optional()
      })
      .optional(),
    note: optionalNote
  })
  .strict();

export const awardNoticeResponseBodySchema = z
  .object({
    action: z.nativeEnum(AwardResponseAction),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const contractVersionBodySchema = z
  .object({
    documentId: uuidSchema.optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const contractSignatureRequestBodySchema = z
  .object({
    roles: z.array(z.nativeEnum(ContractPartyRole)).min(1).max(2).optional().default([ContractPartyRole.BUYER, ContractPartyRole.SUPPLIER])
  })
  .strict();

export const contractSignatureSignBodySchema = z
  .object({
    signerName: nonEmptyText.max(160),
    signerTitle: z.string().trim().max(160).optional().default(''),
    signatureKeyphrase: z.string().min(6).max(128),
    payload: jsonObjectSchema
  })
  .strict();

export const contractMilestoneBodySchema = z
  .object({
    title: nonEmptyText.max(180),
    description: z.string().trim().max(2000).optional().default(''),
    dueDate: z.string().trim().date().optional(),
    amount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    payload: jsonObjectSchema
  })
  .strict();

export const contractMilestonePatchBodySchema = contractMilestoneBodySchema
  .partial()
  .extend({
    status: z.nativeEnum(ContractMilestoneStatus).optional(),
    completedAt: z.string().trim().datetime().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one milestone field is required.');

export const contractMilestoneEvidenceBodySchema = z
  .object({
    documentId: uuidSchema,
    note: optionalNote
  })
  .strict();

export const contractStatusPatchBodySchema = z
  .object({
    status: z.nativeEnum(ContractStatus),
    note: optionalNote
  })
  .strict();

export const contractManagementPlanBodySchema = z
  .object({
    contractManagerId: uuidSchema.optional(),
    objectives: z.string().trim().max(4000).optional().default(''),
    monitoringPlan: z.string().trim().max(4000).optional().default(''),
    reportingPlan: z.string().trim().max(4000).optional().default(''),
    communicationPlan: z.string().trim().max(4000).optional().default(''),
    payload: jsonObjectSchema
  })
  .strict();

const lifecycleBaseSchema = z
  .object({
    title: nonEmptyText.max(220),
    category: z.string().trim().max(120).optional().default('general'),
    description: z.string().trim().max(4000).optional().default(''),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    dueDate: z.string().trim().date().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const lifecycleItemBodySchema = lifecycleBaseSchema;

export const lifecycleItemPatchBodySchema = lifecycleBaseSchema
  .partial()
  .extend({
    required: z.boolean().optional(),
    waived: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one lifecycle field is required.');

export const inspectionBodySchema = lifecycleBaseSchema
  .extend({
    milestoneId: uuidSchema.optional(),
    inspectionType: z.string().trim().min(1).max(120),
    inspectedAt: z.string().trim().datetime().optional(),
    inspectorUserId: uuidSchema.optional()
  })
  .strict();

export const riskBodySchema = lifecycleBaseSchema
  .extend({
    likelihood: z.coerce.number().int().min(1).max(5).optional().default(1),
    impact: z.coerce.number().int().min(1).max(5).optional().default(1),
    level: z.nativeEnum(ContractRiskLevel).optional(),
    responsibleUserId: uuidSchema.optional(),
    mitigationAction: z.string().trim().max(4000).optional().default('')
  })
  .strict();

export const variationBodySchema = lifecycleBaseSchema
  .extend({
    changeType: z.string().trim().min(1).max(120),
    affectedClause: z.string().trim().max(240).optional().default(''),
    costImpact: z.coerce.number().finite().optional(),
    timeImpactDays: z.coerce.number().int().optional(),
    technicalImpact: z.string().trim().max(4000).optional().default('')
  })
  .strict();

export const terminationBodySchema = z
  .object({
    terminationType: z.nativeEnum(ContractTerminationType),
    reason: nonEmptyText.max(4000),
    contractClause: z.string().trim().max(240).optional().default(''),
    faultParty: z.string().trim().max(120).optional().default(''),
    noticeDate: z.string().trim().date().optional(),
    cureDeadline: z.string().trim().date().optional(),
    terminationEffectiveDate: z.string().trim().date().optional(),
    supplierResponse: z.string().trim().max(4000).optional().default(''),
    finalDecision: z.string().trim().max(4000).optional().default(''),
    payload: jsonObjectSchema
  })
  .strict();

export const terminationPatchBodySchema = terminationBodySchema
  .partial()
  .extend({
    status: z.nativeEnum(ContractTerminationStatus).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one termination field is required.');

export const terminationNoticeBodySchema = z
  .object({
    noticeType: z.string().trim().min(1).max(120),
    contractClause: z.string().trim().max(240).optional().default(''),
    requiredAction: z.string().trim().max(1000).optional().default(''),
    deadline: z.string().trim().date().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const terminationEvidenceBodySchema = z
  .object({
    documentId: uuidSchema.optional(),
    evidenceType: z.string().trim().min(1).max(120),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const terminationValuationBodySchema = z
  .object({
    acceptedValue: z.coerce.number().finite().nonnegative().optional(),
    rejectedValue: z.coerce.number().finite().nonnegative().optional(),
    advanceRecovery: z.coerce.number().finite().nonnegative().optional(),
    retentionHeld: z.coerce.number().finite().nonnegative().optional(),
    liquidatedDamages: z.coerce.number().finite().nonnegative().optional(),
    costToComplete: z.coerce.number().finite().nonnegative().optional(),
    performanceSecurityClaim: z.coerce.number().finite().nonnegative().optional(),
    finalAmountPayable: z.coerce.number().finite().optional(),
    finalAmountRecoverable: z.coerce.number().finite().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    payload: jsonObjectSchema
  })
  .strict();

export const terminationSettlementBodySchema = z
  .object({
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    settlementNote: z.string().trim().max(4000).optional().default(''),
    settledAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const replacementProcurementBodySchema = z
  .object({
    method: z.string().trim().min(1).max(160),
    urgencyLevel: z.nativeEnum(ContractRiskLevel).optional(),
    remainingScope: z.string().trim().max(4000).optional().default(''),
    estimatedCost: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const closeoutBodySchema = z
  .object({
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    completionCertificate: z.boolean().optional(),
    finalAccountApproved: z.boolean().optional(),
    warrantyStartDate: z.string().trim().date().optional(),
    warrantyEndDate: z.string().trim().date().optional(),
    lessonsLearned: z.string().trim().max(4000).optional().default(''),
    payload: jsonObjectSchema
  })
  .strict();

export const supplierPerformanceBodySchema = z
  .object({
    overallScore: z.coerce.number().min(0).max(100).optional(),
    timeScore: z.coerce.number().min(0).max(100).optional(),
    qualityScore: z.coerce.number().min(0).max(100).optional(),
    costScore: z.coerce.number().min(0).max(100).optional(),
    complianceScore: z.coerce.number().min(0).max(100).optional(),
    terminationFault: z.string().trim().max(120).optional().default(''),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const invoiceStatusPatchBodySchema = z
  .object({
    status: z.nativeEnum(InvoiceStatus),
    note: optionalNote
  })
  .strict();

export const clauseBodySchema = z
  .object({
    clauseKey: z.string().trim().min(1).max(120),
    title: nonEmptyText.max(220),
    body: z.string().trim().max(8000).optional().default(''),
    category: z.string().trim().max(120).optional().default('general'),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    buyerComment: z.string().trim().max(4000).optional().default(''),
    supplierComment: z.string().trim().max(4000).optional().default(''),
    legalComment: z.string().trim().max(4000).optional().default(''),
    payload: jsonObjectSchema
  })
  .strict();

export const negotiationBodySchema = z
  .object({
    winnerId: uuidSchema.optional(),
    clauseId: uuidSchema.optional(),
    raisedByRole: z.string().trim().min(1).max(80),
    subject: nonEmptyText.max(220),
    position: z.string().trim().max(4000).optional().default(''),
    counterOffer: z.string().trim().max(4000).optional().default(''),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    dueDate: z.string().trim().date().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const awardSettlementBodySchema = z
  .object({
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const deliverableBodySchema = lifecycleBaseSchema
  .extend({
    milestoneId: uuidSchema.optional(),
    submittedAt: z.string().trim().datetime().optional(),
    acceptanceNote: z.string().trim().max(4000).optional().default('')
  })
  .strict();

export const acceptanceBodySchema = z
  .object({
    deliverableId: uuidSchema.optional(),
    inspectionId: uuidSchema.optional(),
    certificateNo: z.string().trim().max(120).optional().default(''),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    acceptedValue: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    acceptedAt: z.string().trim().datetime().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const paymentScheduleBodySchema = z
  .object({
    milestoneId: uuidSchema.optional(),
    title: nonEmptyText.max(220),
    amount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    dueDate: z.string().trim().date().optional(),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const contractPaymentBodySchema = z
  .object({
    invoiceId: uuidSchema.optional(),
    scheduleId: uuidSchema.optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
    grossAmount: z.coerce.number().finite().nonnegative().optional(),
    retentionAmount: z.coerce.number().finite().nonnegative().optional(),
    advanceRecovery: z.coerce.number().finite().nonnegative().optional(),
    liquidatedDamages: z.coerce.number().finite().nonnegative().optional(),
    taxWithholding: z.coerce.number().finite().nonnegative().optional(),
    netAmount: z.coerce.number().finite().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    paidAt: z.string().trim().datetime().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const warrantyBodySchema = lifecycleBaseSchema
  .extend({
    defectReference: z.string().trim().max(120).optional().default(''),
    startDate: z.string().trim().date().optional(),
    endDate: z.string().trim().date().optional(),
    responsibleRole: z.string().trim().max(120).optional().default('')
  })
  .strict();

export const requiredDocumentBodySchema = z
  .object({
    documentType: z.string().trim().min(1).max(120),
    title: nonEmptyText.max(220),
    ownerRole: z.string().trim().min(1).max(120),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    documentId: uuidSchema.optional(),
    dueDate: z.string().trim().date().optional(),
    reviewedAt: z.string().trim().datetime().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const workflowApprovalBodySchema = z
  .object({
    stepKey: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120),
    status: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const awardApprovalRouteBodySchema = z
  .object({
    routeKey: z.string().trim().min(1).max(120),
    title: nonEmptyText.max(220),
    status: statusTextSchema,
    currentStepOrder: z.coerce.number().int().min(1).optional(),
    requiredQuorum: z.coerce.number().int().min(1).optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const awardApprovalStepBodySchema = z
  .object({
    routeId: uuidSchema,
    stepOrder: z.coerce.number().int().min(1),
    stepKey: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120),
    actorUserId: uuidSchema.optional(),
    status: z.nativeEnum(ApprovalStatus).optional(),
    dueDate: z.string().trim().date().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const awardTieBreakerBodySchema = z
  .object({
    triggerReason: nonEmptyText.max(1000),
    method: z.string().trim().min(1).max(160),
    criteria: z.array(z.unknown()).optional().default([]),
    outcomeBidId: uuidSchema.optional(),
    status: statusTextSchema,
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const deliveryFeasibilityBodySchema = z
  .object({
    deliveryCapacity: z.string().trim().max(2000).optional().default(''),
    siteReadiness: z.string().trim().max(2000).optional().default(''),
    resourcePlan: z.string().trim().max(2000).optional().default(''),
    riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    status: statusTextSchema,
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const standstillPeriodBodySchema = z
  .object({
    startsAt: z.string().trim().datetime().optional(),
    endsAt: z.string().trim().datetime().optional(),
    days: z.coerce.number().int().min(0).max(365).optional().default(7),
    status: statusTextSchema,
    waived: z.boolean().optional(),
    waiverReason: z.string().trim().max(1000).optional().default(''),
    payload: jsonObjectSchema
  })
  .strict();

export const awardNotificationBodySchema = z
  .object({
    recipientOrgId: uuidSchema.optional(),
    channel: z.string().trim().min(1).max(80).optional().default('IN_APP'),
    notificationType: z.string().trim().min(1).max(120),
    subject: nonEmptyText.max(220),
    body: z.string().trim().max(4000).optional().default(''),
    status: statusTextSchema,
    payload: jsonObjectSchema
  })
  .strict();

export const budgetCommitmentBodySchema = z
  .object({
    contractId: uuidSchema.optional(),
    commitmentNo: z.string().trim().max(120).optional(),
    budgetCode: z.string().trim().min(1).max(120),
    amount: z.coerce.number().finite().nonnegative(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    status: statusTextSchema,
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const invoiceBodySchema = z
  .object({
    reference: z.string().trim().max(120).optional(),
    purchaseOrderId: uuidSchema.optional(),
    supplierOrgId: uuidSchema.optional(),
    amount: z.coerce.number().finite().nonnegative(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    status: z.nativeEnum(InvoiceStatus).optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const goodsInspectionBodySchema = z
  .object({
    milestoneId: uuidSchema.optional(),
    deliverableId: uuidSchema.optional(),
    inspectionNo: z.string().trim().max(120).optional(),
    goodsDescription: nonEmptyText.max(1000),
    quantityOrdered: z.coerce.number().finite().nonnegative().optional(),
    quantityReceived: z.coerce.number().finite().nonnegative().optional(),
    quantityAccepted: z.coerce.number().finite().nonnegative().optional(),
    quantityRejected: z.coerce.number().finite().nonnegative().optional(),
    unit: z.string().trim().max(40).optional().default(''),
    location: z.string().trim().max(220).optional().default(''),
    result: z.nativeEnum(ContractLifecycleItemStatus).optional(),
    inspectedAt: z.string().trim().datetime().optional(),
    defects: z.array(z.unknown()).optional().default([]),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const threeWayMatchBodySchema = z
  .object({
    invoiceId: uuidSchema,
    purchaseOrderId: uuidSchema.optional(),
    acceptanceId: uuidSchema.optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
    poMatched: z.boolean().optional(),
    receiptMatched: z.boolean().optional(),
    invoiceMatched: z.boolean().optional(),
    varianceAmount: z.coerce.number().finite().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const paymentApprovalBodySchema = z
  .object({
    invoiceId: uuidSchema.optional(),
    paymentId: uuidSchema.optional(),
    stepKey: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120),
    status: z.nativeEnum(InvoiceStatus).optional(),
    amountApproved: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const paymentConfirmationBodySchema = z
  .object({
    invoiceId: uuidSchema.optional(),
    paymentId: uuidSchema.optional(),
    confirmationReference: z.string().trim().max(120).optional(),
    paidAmount: z.coerce.number().finite().nonnegative(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    paidAt: z.string().trim().datetime().optional(),
    evidenceDocumentId: uuidSchema.optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const performanceScoreBodySchema = z
  .object({
    scoreType: z.string().trim().min(1).max(120),
    score: z.coerce.number().min(0).max(100),
    weight: z.coerce.number().min(0).max(100).optional(),
    periodStart: z.string().trim().date().optional(),
    periodEnd: z.string().trim().date().optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const riskForecastBodySchema = z
  .object({
    supplierOrgId: uuidSchema.optional(),
    tenderId: uuidSchema.optional(),
    forecastType: z.string().trim().min(1).max(120),
    horizonDays: z.coerce.number().int().min(1).max(365).optional().default(30),
    probability: z.coerce.number().min(0).max(100),
    impactLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    status: statusTextSchema,
    drivers: z.array(z.unknown()).optional().default([]),
    recommendation: z.string().trim().max(2000).optional().default(''),
    payload: jsonObjectSchema
  })
  .strict();

export const supplierRiskProfileBodySchema = z
  .object({
    supplierOrgId: uuidSchema.optional(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    riskScore: z.coerce.number().int().min(0).max(100).optional().default(50),
    trustTier: z.enum(['UNVERIFIED', 'VERIFIED', 'BRONZE', 'SILVER', 'GOLD']).optional().default('UNVERIFIED'),
    activeAlerts: z.coerce.number().int().min(0).optional().default(0),
    openViolations: z.coerce.number().int().min(0).optional().default(0),
    summary: z.string().trim().max(2000).optional().default(''),
    drivers: z.array(z.unknown()).optional().default([]),
    payload: jsonObjectSchema
  })
  .strict();
