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
const signatureKeyphraseSchema = z.string().min(6).max(128);

export const moduleStatusQuerySchema = z.object({}).strict();

export const idParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const tenderParamsSchema = z
  .object({
    tenderId: uuidSchema
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

export const sampleParamsSchema = z
  .object({
    sampleId: uuidSchema
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

export const contractDocumentUploadBodySchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    documentType: z.string().trim().min(1).max(120).optional(),
    mimeType: z.string().trim().min(1).max(160).optional(),
    size: z.coerce.number().int().nonnegative().optional(),
    contentBase64: z.string().trim().max(20_000_000).optional()
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
    signatureKeyphrase: signatureKeyphraseSchema,
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
    payload: jsonObjectSchema,
    signatureKeyphrase: signatureKeyphraseSchema.optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.action === AwardResponseAction.ACCEPT || value.action === AwardResponseAction.DECLINE) && !value.signatureKeyphrase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['signatureKeyphrase'],
        message: 'Digital signature keyphrase is required for final award response.'
      });
    }
  });

export const awardNoticeCancelBodySchema = z
  .object({
    reason: nonEmptyText.max(4000),
    payload: jsonObjectSchema.optional().default({})
  })
  .strict();

export const awardNoticeReissueBodySchema = z
  .object({
    supplierOrgId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    reason: nonEmptyText.max(4000),
    payload: jsonObjectSchema.optional().default({})
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
    waived: z.boolean().optional(),
    signatureKeyphrase: signatureKeyphraseSchema.optional()
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
    status: z.nativeEnum(ContractTerminationStatus).optional(),
    signatureKeyphrase: signatureKeyphraseSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one termination field is required.')
  .superRefine((value, ctx) => {
    if ((value.status === ContractTerminationStatus.APPROVED || value.status === ContractTerminationStatus.TERMINATED) && !value.signatureKeyphrase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['signatureKeyphrase'],
        message: 'Digital signature keyphrase is required for termination approval.'
      });
    }
  });

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
    payload: jsonObjectSchema,
    signatureKeyphrase: signatureKeyphraseSchema.optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.status === ContractLifecycleItemStatus.CLOSED || value.completionCertificate || value.finalAccountApproved) && !value.signatureKeyphrase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['signatureKeyphrase'],
        message: 'Digital signature keyphrase is required for final closeout approvals.'
      });
    }
  });

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
    payload: jsonObjectSchema,
    signatureKeyphrase: signatureKeyphraseSchema
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
    payload: jsonObjectSchema,
    signatureKeyphrase: signatureKeyphraseSchema
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

export const sampleReceiptBodySchema = z
  .object({
    receivedQuantity: z.coerce.number().finite().nonnegative().optional(),
    conditionAtReceipt: z.string().trim().max(1000).optional().default(''),
    packagingCondition: z.string().trim().max(1000).optional().default(''),
    deliveryRepresentative: z.string().trim().max(220).optional().default(''),
    receivingOfficerId: uuidSchema.optional(),
    storageLocation: z.string().trim().max(220).optional().default(''),
    missingComponents: z.string().trim().max(2000).optional().default(''),
    visibleDamage: z.string().trim().max(2000).optional().default(''),
    remarks: z.string().trim().max(4000).optional().default(''),
    receivedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const sampleVerificationBodySchema = z
  .object({
    result: z.string().trim().min(1).max(80),
    quantityAccepted: z.boolean().optional(),
    certificatesAttached: z.boolean().optional(),
    packagingAccepted: z.boolean().optional(),
    matchesBid: z.boolean().optional(),
    completeUndamaged: z.boolean().optional(),
    clarificationRequired: z.boolean().optional(),
    note: optionalNote,
    verifiedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const sampleCustodyTransferBodySchema = z
  .object({
    fromCustodianId: uuidSchema.optional(),
    toCustodianId: uuidSchema.optional(),
    previousLocation: z.string().trim().max(220).optional().default(''),
    newLocation: z.string().trim().max(220).optional().default(''),
    transferPurpose: z.string().trim().min(1).max(500),
    conditionBefore: z.string().trim().max(1000).optional().default(''),
    conditionAfter: z.string().trim().max(1000).optional().default(''),
    remarks: z.string().trim().max(4000).optional().default(''),
    transferredAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const sampleEvaluationBodySchema = z
  .object({
    criterion: z.string().trim().min(1).max(220),
    score: z.coerce.number().finite().nonnegative().optional(),
    maximumScore: z.coerce.number().finite().positive().optional(),
    passed: z.boolean().optional(),
    decision: z.string().trim().max(80).optional().default('UNDER_EVALUATION'),
    comments: z.string().trim().max(4000).optional().default(''),
    evaluatedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const sampleTestBodySchema = z
  .object({
    testName: z.string().trim().min(1).max(220),
    testingInstitution: z.string().trim().max(220).optional().default(''),
    testingOfficer: z.string().trim().max(220).optional().default(''),
    testingMethod: z.string().trim().max(1000).optional().default(''),
    testingStandard: z.string().trim().max(220).optional().default(''),
    expectedResult: z.string().trim().max(2000).optional().default(''),
    actualResult: z.string().trim().max(2000).optional().default(''),
    result: z.string().trim().max(80).optional().default('PENDING'),
    testCost: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    responsibleParty: z.string().trim().max(120).optional().default(''),
    reportDocumentId: uuidSchema.optional(),
    testedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const sampleDispositionBodySchema = z
  .object({
    dispositionType: z.string().trim().min(1).max(80).optional().default('RETURN'),
    contractId: uuidSchema.optional(),
    referenceNo: z.string().trim().max(120).optional().default(''),
    storageLocation: z.string().trim().max(220).optional().default(''),
    note: optionalNote,
    reason: z.string().trim().max(2000).optional().default(''),
    supplierNotifiedAt: z.string().trim().datetime().optional(),
    collectionDeadline: z.string().trim().datetime().optional(),
    collectionRepresentative: z.string().trim().max(220).optional().default(''),
    returnCondition: z.string().trim().max(1000).optional().default(''),
    disposalMethod: z.string().trim().max(220).optional().default(''),
    witnesses: z.string().trim().max(1000).optional().default(''),
    acknowledgementDocumentId: uuidSchema.optional(),
    status: z.string().trim().max(80).optional().default('OPEN'),
    completedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const contractReferenceSampleBodySchema = z
  .object({
    contractId: uuidSchema.optional(),
    referenceNo: z.string().trim().max(120).optional().default(''),
    storageLocation: z.string().trim().max(220).optional().default(''),
    status: z.string().trim().max(80).optional().default('RETAINED'),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const contractCommencementBodySchema = z
  .object({
    noticeDate: z.string().trim().date().optional(),
    startDate: z.string().trim().date().optional(),
    effectiveDate: z.string().trim().date().optional(),
    completionDate: z.string().trim().date().optional(),
    deliveryLocation: z.string().trim().max(220).optional().default(''),
    buyerContractManager: z.string().trim().max(220).optional().default(''),
    supplierContractManager: z.string().trim().max(220).optional().default(''),
    initialMeetingDate: z.string().trim().date().optional(),
    approvedWorkPlan: z.string().trim().max(4000).optional().default(''),
    approvedDeliverySchedule: z.string().trim().max(4000).optional().default(''),
    status: z.string().trim().max(80).optional().default('DRAFT'),
    payload: jsonObjectSchema
  })
  .strict();

export const nonConformanceBodySchema = z
  .object({
    category: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(220),
    description: z.string().trim().max(4000).optional().default(''),
    relatedRecordId: uuidSchema.optional(),
    contractClause: z.string().trim().max(240).optional().default(''),
    severity: z.string().trim().max(80).optional().default('MINOR'),
    responsibleSupplierOfficer: z.string().trim().max(220).optional().default(''),
    correctiveAction: z.string().trim().max(4000).optional().default(''),
    correctiveActionDeadline: z.string().trim().date().optional(),
    verificationResult: z.string().trim().max(1000).optional().default(''),
    status: z.string().trim().max(80).optional().default('OPEN'),
    identifiedAt: z.string().trim().datetime().optional(),
    closedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();

export const contractSecurityBodySchema = z
  .object({
    securityType: z.string().trim().min(1).max(120),
    issuingInstitution: z.string().trim().max(220).optional().default(''),
    referenceNumber: z.string().trim().max(120).optional().default(''),
    amount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    issueDate: z.string().trim().date().optional(),
    expiryDate: z.string().trim().date().optional(),
    verificationStatus: z.string().trim().max(80).optional().default('PENDING'),
    claimStatus: z.string().trim().max(80).optional().default('NONE'),
    releasedAt: z.string().trim().datetime().optional(),
    documentId: uuidSchema.optional(),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const contractPenaltyBodySchema = z
  .object({
    invoiceId: uuidSchema.optional(),
    penaltyType: z.string().trim().min(1).max(120),
    contractClause: z.string().trim().max(240).optional().default(''),
    basis: z.string().trim().max(2000).optional().default(''),
    amount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional().default('TZS'),
    status: z.string().trim().max(80).optional().default('DRAFT'),
    evidence: z.array(z.unknown()).optional().default([]),
    note: optionalNote,
    payload: jsonObjectSchema
  })
  .strict();

export const contractChangeRequestBodySchema = z
  .object({
    changeType: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(220),
    reason: z.string().trim().max(4000).optional().default(''),
    technicalReview: z.string().trim().max(4000).optional().default(''),
    financialReview: z.string().trim().max(4000).optional().default(''),
    budgetCheck: z.string().trim().max(4000).optional().default(''),
    legalReview: z.string().trim().max(4000).optional().default(''),
    supplierResponse: z.string().trim().max(4000).optional().default(''),
    amendmentVersionId: uuidSchema.optional(),
    status: z.string().trim().max(80).optional().default('RAISED'),
    approvedAt: z.string().trim().datetime().optional(),
    signedAt: z.string().trim().datetime().optional(),
    payload: jsonObjectSchema
  })
  .strict();
