import {
  ApprovalStatus,
  AuditSeverity,
  AwardNoticeStatus,
  AwardResponseAction,
  BidSampleStatus,
  BidStatus,
  ContractLifecycleItemStatus,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractRiskLevel,
  ContractStatus,
  ContractTerminationStatus,
  InvoiceStatus,
  RecommendationStatus,
  SignatureStatus,
  TenderStatus,
  WorkflowAssignmentType,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { signSensitiveAction } from '../identity/sensitiveActionSigning.js';
import { buildBidSubmissionSchema } from '../bidding/bidSubmissionSchema.service.js';
import { signCanonicalPayloadHash } from '../identity/signing.js';
import type {
  AwardContractRequestContext,
  AwardDecisionDraftInput,
  AwardDecisionInput,
  AwardGroupDto,
  AwardSourceDocumentDto,
  AwardApprovalRouteInput,
  AwardApprovalStepInput,
  AwardNotificationInput,
  AwardNoticeCancelInput,
  AwardNoticeReissueInput,
  AwardNoticeResponseInput,
  AwardRecommendationDetailDto,
  AwardRecommendationListItemDto,
  AwardRecommendationQuery,
  AwardSettlementInput,
  AwardTieBreakerInput,
  BudgetCommitmentInput,
  ContractDetailDto,
  AwardContractDocumentDto,
  AwardContractDocumentUploadInput,
  ContractCloseoutInput,
  ContractActivateInput,
  ContractActivationItemReviewInput,
  ContractActivationItemSubmitInput,
  ContractEvidenceRequirementInput,
  ContractAmendmentInput,
  ContractBoqMeasurementInput,
  BoqMeasurementReviewInput,
  ContractClaimInput,
  ContractClaimResponseInput,
  ContractConsultancyDeliverableInput,
  ConsultancyDeliverableReviewInput,
  ConsultancyFinalReportInput,
  ConsultancyFinalReportReviewInput,
  ContractDefectActionInput,
  ContractDefectInput,
  ContractDeliverableReviewInput,
  ContractDeliverableVersionInput,
  DeliverableReviewPaymentEligibilityInput,
  ContractDeliveryScheduleInput,
  ContractDispatchNoticeInput,
  ContractExtensionRequestInput,
  ContractGoodsReceiptInput,
  ContractInterimPaymentCertificateInput,
  InterimPaymentCertificateCertifyInput,
  ContractListItemDto,
  ContractManagementPlanDraftInput,
  ContractManagementPlanInput,
  ContractMeetingActionInput,
  ContractMeetingActionPatchInput,
  ContractMeetingInput,
  ContractMilestoneEvidenceInput,
  ContractMilestoneInput,
  ContractMilestonePatchInput,
  ContractNoticeActionInput,
  ContractNoticeInput,
  ContractObligationInput,
  ContractServiceCreditInput,
  ServiceCreditReviewInput,
  ContractServiceIncidentInput,
  ServiceIncidentActionInput,
  ContractServiceLevelInput,
  ContractServicePeriodInput,
  ContractServiceReportInput,
  ServiceReportReviewInput,
  ContractSiteHandoverInput,
  ContractWorksProgressReportInput,
  WorksCompletionCertificateInput,
  WorksProgressReviewInput,
  ContractQuery,
  DeliveryFeasibilityInput,
  GoodsInspectionInput,
  InvoiceInput,
  InspectionInput,
  InvoiceStatusPatchInput,
  LifecycleItemInput,
  LifecycleItemPatchInput,
  LifecycleQueueId,
  ReplacementProcurementInput,
  RiskInput,
  SupplierPerformanceInput,
  TerminationEvidenceInput,
  TerminationInput,
  TerminationNoticeInput,
  TerminationPatchInput,
  TerminationSettlementInput,
  TerminationValuationInput,
  VariationInput,
  ContractSignatureRequestInput,
  ContractSignatureSignInput,
  ContractNegotiationDecisionInput,
  ContractStatusPatchInput,
  ContractVersionInput,
  AwardContractDashboardDto,
  AwardContractSampleDashboardDto,
  AwardContractSampleDto,
  AcceptanceInput,
  ClauseInput,
  ContractChangeRequestInput,
  ContractCommencementInput,
  ContractNonConformanceInput,
  ControlWorkflowActionInput,
  FinanceWorkflowActionInput,
  ContractPaymentInput,
  ContractPenaltyInput,
  ContractReferenceSampleInput,
  ContractSecurityInput,
  ContractSecurityActionInput,
  DeliverableInput,
  LifecycleActionDto,
  ListAwardRecommendationsResponseDto,
  ListContractsResponseDto,
  NegotiationInput,
  PaymentScheduleInput,
  PaymentApprovalInput,
  PaymentConfirmationInput,
  PerformanceScoreInput,
  RequiredDocumentInput,
  RiskForecastInput,
  SampleCustodyTransferInput,
  SampleDispositionInput,
  SampleEvaluationInput,
  SampleReceiptInput,
  SampleTestInput,
  SampleVerificationInput,
  WarrantyInput,
  WorkflowApprovalInput,
  StandstillPeriodInput,
  SupplierRiskProfileInput,
  ThreeWayMatchInput
} from './types.js';

const recommendationInclude = {
  workspace: {
    include: {
      tender: {
        select: {
          id: true,
          reference: true,
          title: true
        }
      },
      buyerOrg: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  bid: {
    include: {
      supplierOrg: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  approvals: {
    orderBy: {
      decidedAt: 'desc'
    }
  },
  notice: {
    include: {
      responses: {
        orderBy: {
          createdAt: 'desc'
        }
      },
      contract: true
    }
  },
  contracts: true
} satisfies Prisma.AwardRecommendationInclude;

const contractInclude = {
  tender: {
    select: {
      id: true,
      reference: true,
      title: true,
      type: true
    }
  },
  awardNotice: true,
  buyerOrg: {
    select: {
      id: true,
      name: true
    }
  },
  supplierOrg: {
    select: {
      id: true,
      name: true
    }
  },
  versions: {
    include: {
      document: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      versionNo: 'asc'
    }
  },
  parties: {
    orderBy: { role: 'asc' }
  },
  clauses: {
    orderBy: [{ category: 'asc' }, { clauseKey: 'asc' }]
  },
  negotiations: {
    orderBy: { updatedAt: 'desc' }
  },
  signatures: {
    orderBy: {
      createdAt: 'asc'
    }
  },
  milestones: {
    include: {
      evidence: {
        include: {
          document: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  },
  managementPlan: true,
  mobilizationItems: {
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }]
  },
  kpis: {
    orderBy: [{ area: 'asc' }, { createdAt: 'asc' }]
  },
  deliverables: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  },
  acceptances: {
    orderBy: { createdAt: 'desc' }
  },
  inspections: {
    orderBy: { createdAt: 'desc' }
  },
  goodsInspections: {
    orderBy: { createdAt: 'desc' }
  },
  paymentSchedules: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  },
  invoices: {
    orderBy: { createdAt: 'desc' }
  },
  purchaseOrders: {
    orderBy: { createdAt: 'desc' }
  },
  payments: {
    orderBy: { createdAt: 'desc' }
  },
  risks: {
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }]
  },
  variations: {
    orderBy: { createdAt: 'desc' }
  },
  issues: {
    orderBy: { createdAt: 'desc' }
  },
  disputes: {
    orderBy: { createdAt: 'desc' }
  },
  terminations: {
    include: {
      notices: { orderBy: { createdAt: 'desc' } },
      evidence: { orderBy: { createdAt: 'desc' } },
      valuation: true,
      settlement: true,
      replacementProcurement: true
    },
    orderBy: { createdAt: 'desc' }
  },
  warranties: {
    orderBy: [{ endDate: 'asc' }, { createdAt: 'asc' }]
  },
  requiredDocuments: {
    orderBy: [{ ownerRole: 'asc' }, { createdAt: 'asc' }]
  },
  activation: {
    include: {
      items: {
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }]
      }
    }
  },
  activationItems: {
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }]
  },
  baselines: {
    orderBy: [{ versionNo: 'asc' }, { createdAt: 'asc' }]
  },
  obligations: {
    include: {
      evidenceRequirements: {
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
      }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  },
  evidenceRequirements: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  },
  deliverySchedules: {
    orderBy: [{ plannedDeliveryDate: 'asc' }, { createdAt: 'asc' }]
  },
  dispatchNotices: {
    orderBy: { createdAt: 'desc' }
  },
  goodsReceipts: {
    include: {
      lines: {
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { receivedAt: 'desc' }
  },
  siteHandovers: {
    orderBy: { handoverDate: 'desc' }
  },
  worksProgressReports: {
    orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }]
  },
  boqMeasurements: {
    orderBy: { createdAt: 'desc' }
  },
  interimPaymentCertificates: {
    orderBy: { createdAt: 'desc' }
  },
  worksCompletionCertificates: {
    orderBy: [{ certificateType: 'asc' }, { createdAt: 'desc' }]
  },
  defects: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
  },
  serviceLevels: {
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
  },
  servicePeriods: {
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }]
  },
  serviceReports: {
    orderBy: { submittedAt: 'desc' }
  },
  serviceCredits: {
    orderBy: { createdAt: 'desc' }
  },
  serviceIncidents: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
  },
  consultancyDeliverables: {
    include: {
      versions: {
        include: {
          reviews: {
            orderBy: { reviewedAt: 'desc' }
          }
        },
        orderBy: { versionNo: 'desc' }
      }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  },
  deliverableVersions: {
    include: {
      reviews: {
        orderBy: { reviewedAt: 'desc' }
      }
    },
    orderBy: { submittedAt: 'desc' }
  },
  deliverableReviews: {
    orderBy: { reviewedAt: 'desc' }
  },
  consultancyFinalReports: {
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }]
  },
  claims: {
    include: {
      responses: {
        orderBy: { respondedAt: 'desc' }
      }
    },
    orderBy: { submittedAt: 'desc' }
  },
  claimResponses: {
    orderBy: { respondedAt: 'desc' }
  },
  extensionRequests: {
    orderBy: { createdAt: 'desc' }
  },
  amendments: {
    orderBy: { createdAt: 'desc' }
  },
  notices: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
  },
  meetings: {
    include: {
      actions: {
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
      }
    },
    orderBy: [{ meetingDate: 'desc' }, { createdAt: 'desc' }]
  },
  meetingActions: {
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
  },
  approvalSteps: {
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
  },
  urgentActions: {
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }]
  },
  notifications: {
    orderBy: { createdAt: 'desc' },
    take: 20
  },
  closeout: true,
  supplierPerformanceRecords: {
    orderBy: { createdAt: 'desc' }
  }
} satisfies Prisma.ContractInclude;

type RecommendationRecord = Prisma.AwardRecommendationGetPayload<{ include: typeof recommendationInclude }>;
type ContractRecord = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;
type DbClient = PrismaClient | Prisma.TransactionClient;

const documentSelect = {
  id: true,
  name: true,
  documentType: true,
  createdAt: true,
  ownerOrgId: true,
  metadata: true
} satisfies Prisma.DocumentObjectSelect;

type ContractDocumentRecord = Prisma.DocumentObjectGetPayload<{ select: typeof documentSelect }>;

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function effectiveOrgId(context: AwardContractRequestContext, requestedOrgId?: string) {
  if (context.isAdmin) return requestedOrgId || context.organizationId || '';
  return context.organizationId || '';
}

function requireOrg(context: AwardContractRequestContext) {
  if (!context.organizationId && !context.isAdmin) throw requestError('Organization context is required.', 403);
  return context.organizationId ?? '';
}

function requireUserId(context: AwardContractRequestContext) {
  if (!context.userId) throw requestError('User context is required for signed action.', 403);
  return context.userId;
}

function requireSignatureKeyphrase(value?: string) {
  if (!value) throw requestError('Digital signature keyphrase is required.', 400);
  return value;
}

function recommendationScope(context: AwardContractRequestContext, requestedOrgId?: string): Prisma.AwardRecommendationWhereInput {
  const organizationId = effectiveOrgId(context, requestedOrgId);
  if (!organizationId) return {};
  return {
    OR: [
      { supplierOrgId: organizationId },
      { workspace: { buyerOrgId: organizationId } },
      { notice: { is: { OR: [{ buyerOrgId: organizationId }, { supplierOrgId: organizationId }] } } }
    ]
  };
}

function contractScope(context: AwardContractRequestContext, requestedOrgId?: string): Prisma.ContractWhereInput {
  const organizationId = effectiveOrgId(context, requestedOrgId);
  if (!organizationId) return {};
  return {
    OR: [{ buyerOrgId: organizationId }, { supplierOrgId: organizationId }]
  };
}

function documentVisibilityWhere(context: AwardContractRequestContext): Prisma.DocumentObjectWhereInput {
  if (context.isAdmin) return {};
  return {
    OR: [
      { ownerOrgId: null },
      { ownerOrgId: context.organizationId ?? '' }
    ]
  };
}

function assertBuyerAccess(record: { workspace: { buyerOrgId: string } }, context: AwardContractRequestContext) {
  if (context.isAdmin) return;
  if (!context.organizationId || record.workspace.buyerOrgId !== context.organizationId) {
    throw requestError('Buyer organization access is required.', 403);
  }
}

function assertSupplierNoticeAccess(record: { supplierOrgId: string }, context: AwardContractRequestContext) {
  if (context.isAdmin) return;
  if (!context.organizationId || record.supplierOrgId !== context.organizationId) {
    throw requestError('Supplier organization access is required.', 403);
  }
}

function assertContractVisible(record: { buyerOrgId: string; supplierOrgId: string | null }, context: AwardContractRequestContext) {
  if (context.isAdmin) return;
  if (!context.organizationId || (record.buyerOrgId !== context.organizationId && record.supplierOrgId !== context.organizationId)) {
    throw requestError('Contract was not found.', 404);
  }
}

function assertContractManager(record: { buyerOrgId: string }, context: AwardContractRequestContext) {
  if (context.isAdmin) return;
  if (!context.organizationId || record.buyerOrgId !== context.organizationId) {
    throw requestError('Buyer contract access is required.', 403);
  }
}

function assertContractSupplier(record: { supplierOrgId: string | null }, context: AwardContractRequestContext) {
  if (context.isAdmin) return;
  if (!context.organizationId || !record.supplierOrgId || record.supplierOrgId !== context.organizationId) {
    throw requestError('Supplier contract access is required.', 403);
  }
}

function isPreAwardContract(record: { awardId?: string | null; supplierOrgId?: string | null }) {
  return !record.awardId && !record.supplierOrgId;
}

function assertAwardLinkedContract(record: { awardId?: string | null; supplierOrgId?: string | null }) {
  if (!record.awardId || !record.supplierOrgId) {
    throw requestError('Evaluation results and an accepted award are required before this contract can be signed or activated.', 409);
  }
}

function finalDraftAcceptanceRole(item: { payload: unknown; status: ContractLifecycleItemStatus }) {
  if (item.status !== ContractLifecycleItemStatus.APPROVED && item.status !== ContractLifecycleItemStatus.CLOSED) return '';
  const payload = objectPayload(item.payload);
  if (payload.acceptanceType !== 'NEGOTIATED_DRAFT') return '';
  return typeof payload.role === 'string' ? payload.role.toUpperCase() : '';
}

function openNegotiationItems(record: { negotiations: Array<{ status: ContractLifecycleItemStatus }> }) {
  const resolvedStatuses = new Set<ContractLifecycleItemStatus>([
    ContractLifecycleItemStatus.APPROVED,
    ContractLifecycleItemStatus.REJECTED,
    ContractLifecycleItemStatus.WAIVED,
    ContractLifecycleItemStatus.CLOSED
  ]);
  return record.negotiations.filter((item) => !resolvedStatuses.has(item.status));
}

function assertFinalDraftReadyForSignatures(record: {
  negotiations: Array<{ status: ContractLifecycleItemStatus }>;
  acceptances: Array<{ payload: unknown; status: ContractLifecycleItemStatus }>;
  approvalSteps?: Array<{ stepKey: string; status: ContractLifecycleItemStatus }>;
}) {
  const unresolved = openNegotiationItems(record);
  if (unresolved.length > 0) {
    throw requestError('Resolve all amendment and clarification requests before requesting signatures.', 409);
  }
  const acceptedRoles = new Set(record.acceptances.map(finalDraftAcceptanceRole).filter(Boolean));
  if (!acceptedRoles.has('BUYER') || !acceptedRoles.has('SUPPLIER')) {
    throw requestError('Buyer and supplier must both accept the negotiated draft before signatures can be requested.', 409);
  }
  const outcomeNoticeConfirmed = (record.approvalSteps ?? []).some((step) =>
    step.stepKey === 'outcome-communications' &&
    (step.status === ContractLifecycleItemStatus.APPROVED || step.status === ContractLifecycleItemStatus.CLOSED)
  );
  if (!outcomeNoticeConfirmed) {
    throw requestError('Confirm winner and non-winning supplier outcome communications before requesting signatures.', 409);
  }
}

function workflowAccess(record: { buyerOrgId: string; supplierOrgId: string | null }, context: AwardContractRequestContext) {
  const viewerRole =
    context.isAdmin ? 'ADMIN'
      : context.organizationId && record.buyerOrgId === context.organizationId ? 'BUYER'
        : context.organizationId && record.supplierOrgId === context.organizationId ? 'SUPPLIER'
          : 'NONE';
  return {
    viewerRole,
    canManageBuyerActions: viewerRole === 'BUYER' || viewerRole === 'ADMIN',
    canSubmitSupplierActions: viewerRole === 'SUPPLIER' || viewerRole === 'ADMIN',
    canSignBuyer: viewerRole === 'BUYER' || viewerRole === 'ADMIN',
    canSignSupplier: viewerRole === 'SUPPLIER' || viewerRole === 'ADMIN',
    readOnlyReason:
      viewerRole === 'NONE'
        ? 'This record belongs to another organization.'
        : viewerRole === 'BUYER'
          ? 'Supplier actions are read-only for the buyer.'
          : viewerRole === 'SUPPLIER'
            ? 'Buyer actions are read-only for the supplier.'
            : null
  } as const;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function controlPayload(existing: unknown, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext): Record<string, unknown> {
  return {
    ...objectPayload(existing),
    ...objectPayload(input.payload),
    workflowAction: action,
    workflowStatus: input.status ?? null,
    decision: input.decision ?? null,
    note: input.note ?? null,
    response: input.response ?? input.supplierResponse ?? null,
    privateNote: input.privateNote ?? objectPayload(existing).privateNote ?? null,
    dueDate: input.dueDate ?? null,
    cureDeadline: input.cureDeadline ?? null,
    amountApproved: input.amountApproved ?? null,
    settlementAmount: input.settlementAmount ?? null,
    paymentImpact: input.paymentImpact ?? null,
    costImpact: input.costImpact ?? null,
    timeImpactDays: input.timeImpactDays ?? null,
    amendmentId: input.amendmentId ?? null,
    amendmentReference: input.amendmentReference ?? null,
    visibilityScope: input.visibilityScope ?? objectPayload(existing).visibilityScope ?? 'SHARED',
    lastActionByUserId: context.userId ?? null,
    lastActionByOrgId: context.organizationId ?? null,
    lastActionAt: new Date().toISOString()
  };
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function toDateTime(value?: string) {
  return value ? new Date(value) : undefined;
}

function numberFromUnknown(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function payloadNumber(payload: unknown, ...keys: string[]) {
  const data = objectPayload(payload);
  for (const key of keys) {
    const value = numberFromUnknown(data[key]);
    if (value !== null) return value;
  }
  return null;
}

function payloadString(payload: unknown, ...keys: string[]) {
  const data = objectPayload(payload);
  for (const key of keys) {
    const value = String(data[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function payloadBoolean(payload: unknown, key: string) {
  return objectPayload(payload)[key] === true;
}

function acceptedReceiptValue(receipt: { payload: unknown; lines?: Array<{ acceptedQuantity?: unknown; payload?: unknown }> }) {
  const direct = payloadNumber(receipt.payload, 'acceptedValue', 'acceptedAmount', 'invoiceableAmount');
  if (direct !== null) return direct;
  let total = 0;
  let hasLineValue = false;
  for (const line of receipt.lines ?? []) {
    const lineValue = payloadNumber(line.payload, 'acceptedValue', 'acceptedAmount', 'invoiceableAmount');
    if (lineValue !== null) {
      total += lineValue;
      hasLineValue = true;
      continue;
    }
    const acceptedQuantity = numberFromUnknown(line.acceptedQuantity);
    const unitRate = payloadNumber(line.payload, 'unitRate', 'unitPrice', 'rate');
    if (acceptedQuantity !== null && unitRate !== null) {
      total += acceptedQuantity * unitRate;
      hasLineValue = true;
    }
  }
  return hasLineValue ? total : null;
}

function goodsInspectionAcceptedValue(inspection: { payload: unknown; quantityAccepted?: unknown }) {
  const direct = payloadNumber(inspection.payload, 'acceptedValue', 'acceptedAmount', 'invoiceableAmount');
  if (direct !== null) return direct;
  const acceptedQuantity = numberFromUnknown(inspection.quantityAccepted);
  const unitRate = payloadNumber(inspection.payload, 'unitRate', 'unitPrice', 'rate');
  return acceptedQuantity !== null && unitRate !== null ? acceptedQuantity * unitRate : null;
}

function acceptedExecutionAmount(record: { acceptedValue?: unknown; acceptedAmount?: unknown; certifiedAmount?: unknown; finalAccountAmount?: unknown; amount?: unknown; grossAmount?: unknown; netAmount?: unknown; payload: unknown }) {
  return numberFromUnknown(record.acceptedValue)
    ?? numberFromUnknown(record.acceptedAmount)
    ?? numberFromUnknown(record.netAmount)
    ?? numberFromUnknown(record.certifiedAmount)
    ?? numberFromUnknown(record.finalAccountAmount)
    ?? numberFromUnknown(record.amount)
    ?? numberFromUnknown(record.grossAmount)
    ?? payloadNumber(record.payload, 'acceptedValue', 'acceptedAmount', 'invoiceableAmount');
}

function workflowValueDto(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (Array.isArray(value)) return value.map(workflowValueDto);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, workflowValueDto(nested)]));
  }
  return value;
}

function workflowRecordDto(record: Record<string, unknown>) {
  return workflowValueDto(record) as Record<string, unknown>;
}

const sampleQueueIds = [
  'awaiting-submission',
  'awaiting-receipt',
  'received',
  'awaiting-verification',
  'under-evaluation',
  'clarification-required',
  'passed',
  'failed',
  'awaiting-return',
  'retained-reference-samples',
  'overdue-sample-actions',
  'not-required'
] as const;

function sampleReference() {
  return `SMP-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function normalizedStatus(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function isLifecycleOpen(value: unknown) {
  return !['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED', 'COMPLETED', 'PAID', 'MATCHED', 'REJECTED', 'WAIVED', 'CANCELLED', 'TERMINATED', 'SETTLED', 'RELEASED'].includes(normalizedStatus(value));
}

function sampleAwardingStatus(input: {
  trackingStatus: unknown;
  deliveryDeadline?: Date | null;
  receipt: Record<string, unknown> | null;
  latestVerification: Record<string, unknown> | null;
  latestEvaluation: Record<string, unknown> | null;
  latestDisposition: Record<string, unknown> | null;
  referenceSamples: Array<Record<string, unknown>>;
}) {
  const now = new Date();
  const dispositionType = normalizedStatus(input.latestDisposition?.dispositionType);
  const dispositionStatus = normalizedStatus(input.latestDisposition?.status);
  const verificationResult = normalizedStatus(input.latestVerification?.result);
  const evaluationDecision = normalizedStatus(input.latestEvaluation?.decision);
  const trackingStatus = normalizedStatus(input.trackingStatus);
  const isOverdue = Boolean(
    input.deliveryDeadline &&
    input.deliveryDeadline.getTime() < now.getTime() &&
    !input.receipt &&
    !['ACCEPTED', 'REJECTED', 'RECEIVED', 'INSPECTED'].includes(trackingStatus)
  );

  if (isOverdue) return 'overdue-sample-actions';
  if (input.referenceSamples.length > 0) return 'retained-reference-samples';
  if (dispositionType === 'RETURN' && !['COMPLETED', 'CLOSED'].includes(dispositionStatus)) return 'awaiting-return';
  if (['FAILED', 'FAIL', 'REJECTED'].includes(evaluationDecision)) return 'failed';
  if (['PASSED', 'PASS', 'ACCEPTED'].includes(evaluationDecision)) return 'passed';
  if (input.latestVerification?.clarificationRequired || ['CLARIFICATION_REQUIRED', 'CLARIFICATION'].includes(verificationResult)) return 'clarification-required';
  if (input.latestVerification || input.latestEvaluation) return 'under-evaluation';
  if (input.receipt || ['RECEIVED', 'INSPECTED'].includes(trackingStatus)) return 'awaiting-verification';
  if (['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(trackingStatus)) return 'awaiting-receipt';
  return 'awaiting-submission';
}

function sampleDto(
  sample: Record<string, unknown> & {
    tender?: { id: string; reference?: string | null; title?: string | null; buyerOrgId?: string | null };
    supplierOrg?: { id: string; name?: string | null };
  },
  related: {
    receipt: Record<string, unknown> | null;
    verifications: Array<Record<string, unknown>>;
    evaluations: Array<Record<string, unknown>>;
    tests: Array<Record<string, unknown>>;
    custodyLogs: Array<Record<string, unknown>>;
    dispositions: Array<Record<string, unknown>>;
    referenceSamples: Array<Record<string, unknown>>;
    contractId: string | null;
  },
  context: AwardContractRequestContext
): AwardContractSampleDto {
  const receipt = related.receipt ? workflowRecordDto(related.receipt) : null;
  const verifications = related.verifications.map(workflowRecordDto);
  const evaluations = related.evaluations.map(workflowRecordDto);
  const dispositions = related.dispositions.map(workflowRecordDto);
  const referenceSamples = related.referenceSamples.map(workflowRecordDto);
  const awardingStatus = sampleAwardingStatus({
    trackingStatus: sample.trackingStatus,
    deliveryDeadline: sample.deliveryDeadline as Date | null | undefined,
    receipt,
    latestVerification: verifications[0] ?? null,
    latestEvaluation: evaluations[0] ?? null,
    latestDisposition: dispositions[0] ?? null,
    referenceSamples
  });
  const buyerOrgId = String(sample.tender?.buyerOrgId ?? '');
  const supplierOrgId = String(sample.supplierOrgId);
  const viewerRole = context.isAdmin ? 'ADMIN' : context.organizationId === buyerOrgId ? 'BUYER' : context.organizationId === supplierOrgId ? 'SUPPLIER' : 'NONE';
  return {
    id: String(sample.id),
    bidSampleId: String(sample.id),
    viewerRole,
    sampleRequired: true,
    sampleRequirementStatus: 'SUBMITTED',
    actionable: true,
    tenderId: String(sample.tenderId),
    tenderReference: sample.tender?.reference ?? null,
    tenderTitle: sample.tender?.title ?? 'Tender sample',
    bidId: String(sample.bidId),
    supplierOrgId,
    supplierName: sample.supplierOrg?.name ?? 'Supplier',
    buyerOrgId,
    sampleName: String(sample.sampleName ?? 'Sample'),
    relatedItem: String(sample.relatedItem ?? ''),
    quantity: decimalToNumber(sample.quantity),
    deliveryLocation: String(sample.deliveryLocation ?? ''),
    deliveryDeadline: isoDate(sample.deliveryDeadline as Date | null | undefined),
    trackingStatus: String(sample.trackingStatus ?? ''),
    awardingStatus,
    sampleReference: String(receipt?.sampleReference ?? ''),
    courier: String(sample.courier ?? ''),
    trackingNumber: String(sample.trackingNumber ?? ''),
    submittedAt: isoDate(sample.submittedAt as Date | null | undefined),
    receivedAt: isoDate(sample.receivedAt as Date | null | undefined) ?? (receipt?.receivedAt ? String(receipt.receivedAt) : null),
    inspectedAt: isoDate(sample.inspectedAt as Date | null | undefined),
    receipt,
    latestVerification: verifications[0] ?? null,
    evaluations,
    tests: related.tests.map(workflowRecordDto),
    custodyLogs: related.custodyLogs.map(workflowRecordDto),
    dispositions,
    referenceSamples,
    contractId: related.contractId,
    payload: objectPayload(sample.metadata),
    createdAt: isoDate(sample.createdAt as Date | null | undefined) ?? '',
    updatedAt: isoDate(sample.updatedAt as Date | null | undefined) ?? ''
  };
}

function sampleViewerRole(buyerOrgId: string, supplierOrgId: string, context: AwardContractRequestContext): AwardContractSampleDto['viewerRole'] {
  if (context.isAdmin) return 'ADMIN';
  if (context.organizationId === buyerOrgId) return 'BUYER';
  if (context.organizationId === supplierOrgId) return 'SUPPLIER';
  return 'NONE';
}

function tenderSampleFields(tender: {
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
  documents?: Array<{ label: string | null; document?: { id: string; name: string; documentType: string } | null }>;
}) {
  const schemaTender = {
    ...tender,
    documents: tender.documents?.map((item) => item.document ? { label: item.label, document: item.document } : { label: item.label })
  };
  return buildBidSubmissionSchema(schemaTender).steps.flatMap((step) => step.fields).filter((field) => field.section === 'samples');
}

function sampleRequirementDto(
  bid: {
    id: string;
    tenderId: string;
    buyerOrgId: string;
    supplierOrgId: string;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    tender: { id: string; reference: string; title: string; buyerOrgId: string };
    supplierOrg: { id: string; name: string };
  },
  requirement: { id: string; label: string; required: boolean; payload?: Record<string, unknown> },
  context: AwardContractRequestContext
): AwardContractSampleDto {
  const status = requirement.required ? 'MISSING_REQUIRED' : 'NOT_REQUIRED';
  const payload = objectPayload(requirement.payload);
  return {
    id: `${status === 'MISSING_REQUIRED' ? 'sample-required' : 'sample-not-required'}-${bid.id}-${requirement.id}`,
    bidSampleId: null,
    viewerRole: sampleViewerRole(bid.buyerOrgId, bid.supplierOrgId, context),
    sampleRequired: requirement.required,
    sampleRequirementStatus: status,
    actionable: false,
    tenderId: bid.tenderId,
    tenderReference: bid.tender.reference,
    tenderTitle: bid.tender.title,
    bidId: bid.id,
    supplierOrgId: bid.supplierOrgId,
    supplierName: bid.supplierOrg.name,
    buyerOrgId: bid.buyerOrgId,
    sampleName: requirement.required ? requirement.label : 'Sample not required',
    relatedItem: String(payload.relatedItem ?? ''),
    quantity: decimalToNumber(payload.quantity),
    deliveryLocation: String(payload.deliveryLocation ?? ''),
    deliveryDeadline: null,
    trackingStatus: requirement.required ? 'REQUIRED' : 'NOT_REQUIRED',
    awardingStatus: requirement.required ? 'awaiting-submission' : 'not-required',
    sampleReference: '',
    courier: '',
    trackingNumber: '',
    submittedAt: isoDate(bid.submittedAt),
    receivedAt: null,
    inspectedAt: null,
    receipt: null,
    latestVerification: null,
    evaluations: [],
    tests: [],
    custodyLogs: [],
    dispositions: [],
    referenceSamples: [],
    contractId: null,
    payload: {
      source: 'bid-submission-schema',
      requirementKey: requirement.id,
      required: requirement.required,
      ...payload
    },
    createdAt: bid.createdAt.toISOString(),
    updatedAt: bid.updatedAt.toISOString()
  };
}

function commitmentNo() {
  return `BC-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function awardReference() {
  return `PX-AWD-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function awardNoticeReference() {
  return `PX-NOT-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function awardGroupReference() {
  return `PX-AG-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function invoiceReference() {
  return `INV-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function purchaseOrderReference() {
  return `PX-PO-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function goodsInspectionReference() {
  return `PX-GI-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function acceptanceCertificateReference() {
  return `PX-ACPT-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function confirmationReference() {
  return `PAY-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function executionReference(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

const terminalApprovalStatuses: ApprovalStatus[] = [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.RETURNED];
const terminalInvoiceStatuses: InvoiceStatus[] = [InvoiceStatus.MATCHED, InvoiceStatus.PAID, InvoiceStatus.REJECTED, InvoiceStatus.BLOCKED];
const invoiceDecisionStatuses: InvoiceStatus[] = [InvoiceStatus.MATCHED, InvoiceStatus.REJECTED, InvoiceStatus.BLOCKED];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

function safeObjectName(value: string) {
  return safeFilename(value).slice(0, 180) || 'document';
}

function sourceDocumentDto(input: Omit<AwardSourceDocumentDto, 'openUrl' | 'downloadUrl'>): AwardSourceDocumentDto {
  const baseUrl = input.documentId ? `/api/documents/${input.documentId}/content` : '';
  return {
    ...input,
    openUrl: baseUrl,
    downloadUrl: baseUrl ? `${baseUrl}?download=true` : ''
  };
}

function contractDocumentDto(document: ContractDocumentRecord, sourceLabel: string): AwardContractDocumentDto {
  return {
    id: document.id,
    name: document.name,
    documentType: document.documentType,
    createdAt: document.createdAt.toISOString(),
    contentUrl: `/api/documents/${document.id}/content`,
    sourceLabel
  };
}

function awardDecisionDraftPayload(input: AwardDecisionDraftInput): Record<string, unknown> {
  return {
    ...(input.selectedSupplier !== undefined ? { selectedSupplier: input.selectedSupplier } : {}),
    ...(input.awardAmount !== undefined ? { awardAmount: input.awardAmount } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.awardDate !== undefined ? { awardDate: input.awardDate } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.conditions !== undefined ? { conditions: input.conditions } : {}),
    ...(input.confirmationBy !== undefined ? { confirmationBy: input.confirmationBy } : {}),
    ...(input.confirmations !== undefined ? { confirmations: input.confirmations } : {}),
    note: input.note
  };
}

function contractReference() {
  return `PX-CON-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function displaySearch(search: string): Prisma.StringFilter<'AwardRecommendation'> {
  return { contains: search, mode: 'insensitive' };
}

function recommendationWhere(query: AwardRecommendationQuery, context: AwardContractRequestContext): Prisma.AwardRecommendationWhereInput {
  const filters: Prisma.AwardRecommendationWhereInput[] = [recommendationScope(context, query.organizationId)];
  if (query.status !== 'all') filters.push({ status: query.status });
  if (query.search) {
    filters.push({
      OR: [
        { reference: displaySearch(query.search) },
        { reason: displaySearch(query.search) },
        { workspace: { tender: { title: { contains: query.search, mode: 'insensitive' } } } },
        { workspace: { tender: { reference: { contains: query.search, mode: 'insensitive' } } } },
        { bid: { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } } }
      ]
    });
  }
  return andWhere(filters);
}

function contractWhere(query: ContractQuery, context: AwardContractRequestContext): Prisma.ContractWhereInput {
  const filters: Prisma.ContractWhereInput[] = [contractScope(context, query.organizationId)];
  if (query.status !== 'all') filters.push({ status: query.status });
  if (query.search) {
    filters.push({
      OR: [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { tender: { reference: { contains: query.search, mode: 'insensitive' } } },
        { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]
    });
  }
  return andWhere(filters);
}

function andWhere<T extends object>(filters: T[]): T {
  const active = filters.filter((filter) => Object.keys(filter).length > 0);
  if (active.length === 0) return {} as T;
  if (active.length === 1) return active[0];
  return { AND: active } as T;
}

function listRecommendationDto(record: RecommendationRecord): AwardRecommendationListItemDto {
  return {
    id: record.id,
    reference: record.reference,
    tenderId: record.workspace.tenderId,
    tenderReference: record.workspace.tender.reference,
    tenderTitle: record.workspace.tender.title,
    buyerOrgId: record.workspace.buyerOrgId,
    buyerName: record.workspace.buyerOrg.name,
    supplierOrgId: record.supplierOrgId,
    supplierName: record.bid?.supplierOrg.name ?? null,
    bidId: record.bidId,
    status: record.status,
    amount: decimalToNumber(record.amount),
    currency: record.currency,
    noticeStatus: record.notice?.status ?? null,
    contractId: record.notice?.contractId ?? record.contracts[0]?.id ?? null,
    createdAt: record.createdAt.toISOString()
  };
}

function noticeDto(record: NonNullable<RecommendationRecord['notice']>) {
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    buyerOrgId: record.buyerOrgId,
    supplierOrgId: record.supplierOrgId,
    contractId: record.contractId,
    buyerNote: record.buyerNote ?? '',
    supplierNote: record.supplierNote ?? '',
    issuedAt: record.issuedAt.toISOString(),
    respondedAt: record.respondedAt?.toISOString() ?? null,
    responses: record.responses.map((response) => ({
      id: response.id,
      action: response.action,
      note: response.note ?? '',
      actorOrgId: response.actorOrgId,
      actorUserId: response.actorUserId,
      createdAt: response.createdAt.toISOString()
    }))
  };
}

function contractListDto(record: ContractRecord): ContractListItemDto {
  const pendingSignatureCount = record.signatures.filter((signature) => signature.status === SignatureStatus.PENDING).length;
  return {
    id: record.id,
    reference: record.reference,
    tenderId: record.tenderId,
    tenderReference: record.tender?.reference ?? null,
    title: record.title,
    buyerOrgId: record.buyerOrgId,
    buyerName: record.buyerOrg.name,
    supplierOrgId: record.supplierOrgId,
    supplierName: record.supplierOrg?.name ?? null,
    status: record.status,
    amount: decimalToNumber(record.amount),
    currency: record.currency,
    versionCount: record.versions.length,
    signatureCount: record.signatures.length,
    pendingSignatureCount,
    milestoneCount: record.milestones.length,
    updatedAt: record.updatedAt.toISOString()
  };
}

function managementPlanDto(record: ContractRecord['managementPlan']) {
  if (!record) return null;
  return {
    id: record.id,
    contractManagerId: record.contractManagerId,
    objectives: record.objectives ?? '',
    monitoringPlan: record.monitoringPlan ?? '',
    reportingPlan: record.reportingPlan ?? '',
    communicationPlan: record.communicationPlan ?? '',
    payload: objectPayload(record.payload),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function lifecycleItemDto(record: {
  id: string;
  category?: string | null;
  inspectionType?: string | null;
  evidenceType?: string | null;
  noticeType?: string | null;
  title?: string | null;
  status?: string | null;
  result?: string | null;
  dueDate?: Date | null;
  deadline?: Date | null;
  note?: string | null;
  resolution?: string | null;
  decision?: string | null;
  reason?: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt?: Date | null;
}) {
  return {
    id: record.id,
    type: record.category ?? record.inspectionType ?? record.evidenceType ?? record.noticeType ?? 'general',
    title: record.title ?? record.noticeType ?? record.evidenceType ?? 'Lifecycle item',
    status: record.status ?? record.result ?? 'OPEN',
    dueDate: isoDate(record.dueDate ?? record.deadline),
    note: record.note ?? record.resolution ?? record.decision ?? record.reason ?? '',
    payload: objectPayload(record.payload),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null
  };
}

function riskDto(record: ContractRecord['risks'][number]) {
  return {
    ...lifecycleItemDto(record),
    category: record.category,
    level: record.level,
    score: record.score,
    mitigationAction: record.mitigationAction ?? ''
  };
}

function variationDto(record: ContractRecord['variations'][number]) {
  return {
    ...lifecycleItemDto({ ...record, category: record.changeType }),
    changeType: record.changeType,
    costImpact: decimalToNumber(record.costImpact),
    timeImpactDays: record.timeImpactDays
  };
}

function paymentDto(record: ContractRecord['payments'][number]) {
  return {
    id: record.id,
    invoiceId: record.invoiceId,
    scheduleId: record.scheduleId,
    status: record.status,
    grossAmount: decimalToNumber(record.grossAmount),
    retentionAmount: decimalToNumber(record.retentionAmount),
    advanceRecovery: decimalToNumber(record.advanceRecovery),
    liquidatedDamages: decimalToNumber(record.liquidatedDamages),
    taxWithholding: decimalToNumber(record.taxWithholding),
    netAmount: decimalToNumber(record.netAmount),
    currency: record.currency,
    reviewedByUserId: record.reviewedByUserId,
    approvedByUserId: record.approvedByUserId,
    paidAt: isoDate(record.paidAt),
    note: record.note ?? '',
    payload: objectPayload(record.payload),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function terminationDto(record: ContractRecord['terminations'][number]) {
  return {
    id: record.id,
    terminationType: record.terminationType,
    status: record.status,
    reason: record.reason,
    contractClause: record.contractClause ?? '',
    faultParty: record.faultParty ?? '',
    noticeDate: isoDate(record.noticeDate),
    cureDeadline: isoDate(record.cureDeadline),
    terminationEffectiveDate: isoDate(record.terminationEffectiveDate),
    supplierResponse: record.supplierResponse ?? '',
    finalDecision: record.finalDecision ?? '',
    payload: objectPayload(record.payload),
    notices: record.notices.map((notice) => lifecycleItemDto(notice)),
    evidence: record.evidence.map((evidence) => lifecycleItemDto(evidence)),
    valuation: record.valuation ? objectPayload(record.valuation) : null,
    settlement: record.settlement ? objectPayload(record.settlement) : null,
    replacementProcurement: record.replacementProcurement ? objectPayload(record.replacementProcurement) : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function urgencyFromDate(dueDate: string | null, fallback: LifecycleActionDto['riskLevel'] = 'Low'): LifecycleActionDto['riskLevel'] {
  if (!dueDate) return fallback;
  const delta = new Date(dueDate).getTime() - Date.now();
  if (delta < 0) return 'Critical';
  if (delta <= 24 * 60 * 60 * 1000) return 'High';
  if (delta <= 3 * 24 * 60 * 60 * 1000) return 'Medium';
  return fallback;
}

function actionKeyFrom(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'open-record';
}

function nextAction(
  action: Pick<LifecycleActionDto, 'requiredAction' | 'nextRoute' | 'roleContext'>,
  options: Partial<LifecycleActionDto['nextAction']> = {}
): LifecycleActionDto['nextAction'] {
  return {
    key: options.key ?? actionKeyFrom(action.requiredAction),
    label: options.label ?? action.requiredAction,
    url: options.url ?? action.nextRoute,
    method: options.method ?? 'GET',
    canAct: options.canAct ?? true,
    disabledReason: options.disabledReason ?? null,
    requiredRole: options.requiredRole ?? action.roleContext,
    requiredEvidence: options.requiredEvidence ?? []
  };
}

function recommendationAction(record: AwardRecommendationListItemDto, roleContext: 'BUYER' | 'SUPPLIER') {
  if (roleContext === 'BUYER') {
    if (record.status === RecommendationStatus.RECOMMENDED || record.status === RecommendationStatus.DRAFT) {
      return {
        stage: 'Award approval',
        requiredAction: 'Approve award',
        dueDate: daysFromNow(2),
        riskLevel: 'Medium' as const,
        nextRoute: `/awards-contracts/recommendation?recommendation=${record.id}`
      };
    }
    if (record.noticeStatus === AwardNoticeStatus.PENDING_RESPONSE) {
      return {
        stage: 'Supplier response',
        requiredAction: 'Track supplier award response',
        dueDate: daysFromNow(3),
        riskLevel: 'Medium' as const,
        nextRoute: `/awards-contracts/recommendation?recommendation=${record.id}&tab=notices`
      };
    }
    if (record.noticeStatus === AwardNoticeStatus.DECLINED) {
      return {
        stage: 'Award declined',
        requiredAction: 'Select next award action',
        dueDate: daysFromNow(1),
        riskLevel: 'High' as const,
        nextRoute: `/awards-contracts/recommendation?recommendation=${record.id}`
      };
    }
    return {
      stage: 'Contract formation',
      requiredAction: record.contractId ? 'Review contract draft' : 'Generate contract draft',
      dueDate: daysFromNow(5),
      riskLevel: 'Low' as const,
      nextRoute: record.contractId ? `/awards-contracts/negotiation?contract=${record.contractId}` : `/awards-contracts/recommendation?recommendation=${record.id}`
    };
  }

  if (record.noticeStatus === AwardNoticeStatus.PENDING_RESPONSE) {
    return {
      stage: 'Award received',
      requiredAction: 'Accept, clarify, or decline award',
      dueDate: daysFromNow(2),
      riskLevel: 'High' as const,
      nextRoute: `/awards-contracts/award-response?award=${record.id}`
    };
  }
  return {
    stage: 'Contract preparation',
    requiredAction: record.contractId ? 'Review contract terms' : 'Wait for buyer contract draft',
    dueDate: daysFromNow(5),
    riskLevel: 'Low' as const,
    nextRoute: record.contractId ? `/awards-contracts/negotiation?contract=${record.contractId}` : `/awards-contracts/award-response?award=${record.id}`
  };
}

function firstDueDate(records: Array<{ dueDate?: Date | null }> | undefined) {
  return (records ?? []).find((record) => record.dueDate)?.dueDate?.toISOString() ?? null;
}

function contractAction(record: ContractRecord, roleContext: 'BUYER' | 'SUPPLIER') {
  const payload = objectPayload(record.payload);
  const redraftRequired = Boolean(payload.redraftRequired);
  if (isPreAwardContract(record)) {
    return {
      stage: 'Contract preparation',
      requiredAction: roleContext === 'BUYER' ? 'Prepare contract' : 'Await buyer contract preparation',
      dueDate: daysFromNow(5),
      riskLevel: roleContext === 'BUYER' ? 'Medium' as const : 'Low' as const,
      nextRoute: `/awards-contracts/drafting?contract=${record.id}`
    };
  }
  if (record.status === ContractStatus.DRAFT) {
    return {
      stage: redraftRequired ? 'Redraft contract' : 'Contract drafting',
      requiredAction: roleContext === 'BUYER' ? (redraftRequired ? 'Revise contract draft' : 'Generate contract draft') : 'Await buyer draft',
      dueDate: daysFromNow(3),
      riskLevel: roleContext === 'BUYER' ? 'Medium' as const : 'Low' as const,
      nextRoute: `/awards-contracts/drafting?contract=${record.id}`
    };
  }
  if (record.status === ContractStatus.NEGOTIATION) {
    return {
      stage: 'Negotiation',
      requiredAction: roleContext === 'BUYER' ? 'Review supplier contract requests' : 'Review contract draft',
      dueDate: daysFromNow(2),
      riskLevel: 'Medium' as const,
      nextRoute: `/awards-contracts/negotiation?contract=${record.id}&tab=negotiation`
    };
  }
  if (record.status === ContractStatus.SIGNATURE_PENDING) {
    const pendingSignature = record.signatures.find((signature) => signature.status === SignatureStatus.PENDING);
    return {
      stage: 'Signature',
      requiredAction: pendingSignature?.signerOrgId ? 'Sign contract' : 'Collect signatures',
      dueDate: daysFromNow(1),
      riskLevel: 'High' as const,
      nextRoute: `/awards-contracts/signing?contract=${record.id}`
    };
  }
  if (record.status === ContractStatus.SIGNED || record.status === ContractStatus.PENDING_ACTIVATION || record.status === ContractStatus.MOBILIZATION) {
    return {
      stage: record.status === ContractStatus.SIGNED ? 'Activation setup' : 'Mobilization',
      requiredAction: record.status === ContractStatus.SIGNED ? 'Start activation checklist' : 'Complete activation checklist',
      dueDate: firstDueDate(record.activationItems) ?? firstDueDate(record.mobilizationItems) ?? daysFromNow(5),
      riskLevel: 'Medium' as const,
      nextRoute: `/post-award?contract=${record.id}&stage=setup`
    };
  }
  if (record.status === ContractStatus.SUSPENDED) {
    return {
      stage: 'Suspended',
      requiredAction: 'Resolve suspension or move to termination review',
      dueDate: daysFromNow(2),
      riskLevel: 'High' as const,
      nextRoute: `/post-award?contract=${record.id}&stage=risk`
    };
  }
  if (record.status === ContractStatus.AT_RISK || record.status === ContractStatus.TERMINATION_REVIEW) {
    return {
      stage: record.status === ContractStatus.AT_RISK ? 'At risk' : 'Termination review',
      requiredAction: record.status === ContractStatus.AT_RISK ? 'Review risk and cure actions' : 'Complete termination review',
      dueDate: daysFromNow(1),
      riskLevel: 'Critical' as const,
      nextRoute: `/post-award?contract=${record.id}&stage=history`
    };
  }
  if (record.status === ContractStatus.COMPLETED || record.status === ContractStatus.CLOSING || record.status === ContractStatus.WARRANTY_DEFECTS) {
    return {
      stage: record.status === ContractStatus.WARRANTY_DEFECTS ? 'Warranty / defects' : record.status === ContractStatus.CLOSING ? 'Closing' : 'Completion',
      requiredAction: 'Complete close-out',
      dueDate: daysFromNow(7),
      riskLevel: 'Low' as const,
      nextRoute: `/post-award?contract=${record.id}&stage=closeout`
    };
  }
  if (record.status === ContractStatus.TERMINATED || record.status === ContractStatus.CLOSED) {
    return {
      stage: record.status === ContractStatus.TERMINATED ? 'Terminated' : 'Closed',
      requiredAction: 'View audit file',
      dueDate: null,
      riskLevel: 'Low' as const,
      nextRoute: `/post-award?contract=${record.id}&stage=history`
    };
  }
  const dueDate = firstDueDate(record.milestones);
  return {
    stage: 'Active contract',
    requiredAction: record.milestones.some((milestone) => milestone.status === ContractMilestoneStatus.SUBMITTED) ? 'Inspect submitted milestone' : 'Monitor contract',
    dueDate,
    riskLevel: urgencyFromDate(dueDate),
    nextRoute: `/post-award?contract=${record.id}&stage=delivery`
  };
}

const postAwardDashboardStatuses = new Set<ContractStatus>([
  ContractStatus.SIGNED,
  ContractStatus.PENDING_ACTIVATION,
  ContractStatus.MOBILIZATION,
  ContractStatus.ACTIVE,
  ContractStatus.SUSPENDED,
  ContractStatus.AT_RISK,
  ContractStatus.COMPLETED,
  ContractStatus.WARRANTY_DEFECTS,
  ContractStatus.CLOSING,
  ContractStatus.TERMINATION_REVIEW,
  ContractStatus.TERMINATED,
  ContractStatus.CLOSED
]);

function defaultMobilizationItems(procurementType: string) {
  const common = [
    ['general', 'Contract signed by both parties', 'Buyer Admin'],
    ['general', 'Contract manager assigned', 'Buyer Admin'],
    ['general', 'Supplier representative confirmed', 'Supplier Representative'],
    ['general', 'Performance security submitted', 'Supplier Representative'],
    ['general', 'Payment schedule confirmed', 'Finance Officer'],
    ['general', 'Risk register opened', 'Contract Manager']
  ];
  const type = procurementType.toUpperCase();
  const categorySpecific =
    type.includes('WORK')
      ? [
          ['works', 'Site handover completed', 'Technical Officer'],
          ['works', 'Health and safety plan submitted', 'Supplier Representative'],
          ['works', 'Work program submitted', 'Supplier Representative']
        ]
      : type.includes('CONSULT')
        ? [
            ['consultancy', 'Inception meeting held', 'Contract Manager'],
            ['consultancy', 'Team leader confirmed', 'Supplier Representative'],
            ['consultancy', 'Reporting schedule approved', 'Contract Manager']
          ]
        : type.includes('SERVICE')
          ? [
              ['services', 'Service level schedule confirmed', 'Contract Manager'],
              ['services', 'Supervisor confirmation process agreed', 'Technical Officer'],
              ['services', 'Monthly reporting template approved', 'Supplier Representative']
            ]
          : [
              ['goods', 'Delivery plan confirmed', 'Supplier Representative'],
              ['goods', 'Inspection plan approved', 'Technical Officer'],
              ['goods', 'Warranty documents prepared', 'Supplier Representative']
            ];
  return [...common, ...categorySpecific].map(([category, title, responsibleRole]) => ({
    category,
    title,
    responsibleRole,
    payload: {}
  }));
}

function defaultActivationItems(procurementType: string) {
  const common = [
    ['general', 'Signed contract file verified', 'buyer'],
    ['general', 'Contract baseline confirmed', 'buyer'],
    ['general', 'Contract management plan approved', 'buyer'],
    ['general', 'Supplier execution contacts confirmed', 'supplier'],
    ['general', 'Mandatory securities and documents cleared', 'buyer']
  ];
  const type = procurementType.toUpperCase();
  const specific =
    type.includes('WORK')
      ? [
          ['works', 'Site handover readiness confirmed', 'buyer'],
          ['works', 'Work programme and HSE plan accepted', 'buyer']
        ]
      : type.includes('CONSULT')
        ? [
            ['consultancy', 'Inception deliverable schedule approved', 'buyer'],
            ['consultancy', 'Key experts mobilized', 'supplier']
          ]
        : type.includes('SERVICE')
          ? [
              ['services', 'SLA calendar approved', 'buyer'],
              ['services', 'Service reporting template agreed', 'buyer']
            ]
          : [
              ['goods', 'Delivery schedule approved', 'buyer'],
              ['goods', 'Inspection and receipt plan agreed', 'buyer']
            ];
  return [...common, ...specific].map(([category, title, ownerRole]) => ({
    category,
    title,
    ownerRole,
    required: true,
    payload: {}
  }));
}

function defaultKpis() {
  return [
    ['Time', 'Delivery completed by agreed date'],
    ['Cost', 'Contract remains within approved amount'],
    ['Quality', 'Outputs meet specifications'],
    ['Documentation', 'Required reports submitted on time'],
    ['Payment', 'Certified invoices paid on time']
  ].map(([area, title]) => ({ area, title, target: 'Configured during CMP review', payload: {} }));
}

function defaultContractClauses() {
  return [
    ['scope', 'Scope of contract', 'general'],
    ['price-payment', 'Contract price and payment terms', 'financial'],
    ['milestones', 'Milestones and deliverables', 'delivery'],
    ['inspection-acceptance', 'Inspection and acceptance', 'quality'],
    ['performance-security', 'Performance security', 'security'],
    ['warranty-defects', 'Warranty and defects liability', 'quality'],
    ['liquidated-damages', 'Liquidated damages', 'financial'],
    ['variations', 'Variation control', 'change-control'],
    ['disputes', 'Dispute resolution', 'legal'],
    ['termination', 'Termination and replacement procurement', 'legal'],
    ['anti-corruption', 'Anti-corruption and compliance', 'compliance']
  ].map(([clauseKey, title, category]) => ({
    clauseKey,
    title,
    category,
    status: ContractLifecycleItemStatus.OPEN,
    payload: {}
  }));
}

function defaultRequiredDocuments(procurementType: string) {
  const type = procurementType.toUpperCase();
  const documents = [
    ['performance-security', 'Performance security', 'Supplier'],
    ['signatory-authorization', 'Signatory authorization', 'Supplier'],
    ['bank-details', 'Bank details', 'Supplier'],
    ['work-plan', type.includes('WORK') ? 'Work program' : 'Delivery or work plan', 'Supplier']
  ];
  if (type.includes('WORK')) {
    documents.push(['insurance', 'Contractor insurance', 'Supplier'], ['health-safety-plan', 'Health and safety plan', 'Supplier']);
  } else if (type.includes('SERVICE')) {
    documents.push(['sla', 'Service level schedule', 'Buyer']);
  } else if (type.includes('CONSULT')) {
    documents.push(['team-cvs', 'Consultant team confirmation', 'Supplier']);
  } else {
    documents.push(['warranty-documents', 'Warranty documents', 'Supplier']);
  }
  return documents.map(([documentType, title, ownerRole]) => ({
    documentType,
    title,
    ownerRole,
    payload: {}
  }));
}

function defaultWorkflowApprovals() {
  return [
    ['contract-owner-approval', 'Contract Owner']
  ].map(([stepKey, role]) => ({
    stepKey,
    role,
    payload: {}
  }));
}

function riskLevelFromScore(score: number) {
  if (score >= 20) return ContractRiskLevel.CRITICAL;
  if (score >= 12) return ContractRiskLevel.HIGH;
  if (score >= 6) return ContractRiskLevel.MEDIUM;
  return ContractRiskLevel.LOW;
}

function contractDetailDto(
  record: ContractRecord,
  audit: Array<{ event: string; actorUserId: string | null; createdAt: Date }> = [],
  context: AwardContractRequestContext = {}
): ContractDetailDto {
  return {
    ...contractListDto(record),
    access: workflowAccess(record, context),
    awardId: record.awardId,
    noticeId: record.awardNotice?.id ?? null,
    payload: objectPayload(record.payload),
    parties: record.parties.map((party) => ({
      id: party.id,
      role: party.role,
      organizationId: party.organizationId,
      displayName: party.displayName,
      contactName: party.contactName ?? '',
      contactEmail: party.contactEmail ?? '',
      signatoryName: party.signatoryName ?? '',
      signatoryTitle: party.signatoryTitle ?? '',
      payload: objectPayload(party.payload)
    })),
    clauses: record.clauses.map((clause) => lifecycleItemDto({
      ...clause,
      category: clause.category,
      title: clause.title,
      note: clause.body,
      payload: {
        ...objectPayload(clause.payload),
        clauseKey: clause.clauseKey,
        buyerComment: clause.buyerComment ?? '',
        supplierComment: clause.supplierComment ?? '',
        legalComment: clause.legalComment ?? ''
      }
    })),
    negotiations: record.negotiations.map((negotiation) => lifecycleItemDto({
      ...negotiation,
      category: negotiation.raisedByRole,
      title: negotiation.subject,
      note: negotiation.position ?? negotiation.counterOffer,
      dueDate: negotiation.dueDate,
      payload: {
        ...objectPayload(negotiation.payload),
        clauseId: negotiation.clauseId,
        raisedByOrgId: negotiation.raisedByOrgId,
        counterOffer: negotiation.counterOffer ?? ''
      }
    })),
    versions: record.versions.map((version) => ({
      id: version.id,
      versionNo: version.versionNo,
      documentId: version.documentId,
      documentName: version.document?.name ?? null,
      payload: objectPayload(version.payload),
      createdAt: version.createdAt.toISOString()
    })),
    signatures: record.signatures.map((signature) => ({
      id: signature.id,
      role: signature.role,
      status: signature.status,
      signerOrgId: signature.signerOrgId,
      signerUserId: signature.signerUserId,
      signerName: signature.signerName ?? '',
      signerTitle: signature.signerTitle ?? '',
      signedAt: signature.signedAt?.toISOString() ?? null,
      declinedAt: signature.declinedAt?.toISOString() ?? null
    })),
    milestones: record.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description ?? '',
      status: milestone.status,
      dueDate: milestone.dueDate?.toISOString() ?? null,
      completedAt: milestone.completedAt?.toISOString() ?? null,
      amount: decimalToNumber(milestone.amount),
      currency: milestone.currency,
      payload: objectPayload(milestone.payload),
      evidence: milestone.evidence.map((evidence) => ({
        id: evidence.id,
        documentId: evidence.documentId,
        documentName: evidence.document.name,
        uploadedByUserId: evidence.uploadedByUserId,
        uploaderOrgId: evidence.uploaderOrgId,
        note: evidence.note ?? '',
        createdAt: evidence.createdAt.toISOString()
      })),
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString()
    })),
    managementPlan: managementPlanDto(record.managementPlan),
    mobilizationItems: record.mobilizationItems.map(lifecycleItemDto),
    kpis: record.kpis.map((kpi) => lifecycleItemDto({ ...kpi, category: kpi.area })),
    deliverables: record.deliverables.map((deliverable) => lifecycleItemDto({
      ...deliverable,
      category: 'deliverable',
      note: deliverable.acceptanceNote ?? deliverable.description,
      dueDate: deliverable.dueDate,
      payload: {
        ...objectPayload(deliverable.payload),
        milestoneId: deliverable.milestoneId,
        submittedByOrgId: deliverable.submittedByOrgId,
        submittedAt: isoDate(deliverable.submittedAt),
        reviewedAt: isoDate(deliverable.reviewedAt)
      }
    })),
    acceptances: record.acceptances.map((acceptance) => lifecycleItemDto({
      ...acceptance,
      category: 'acceptance',
      title: acceptance.certificateNo ?? 'Acceptance certificate',
      note: acceptance.note,
      payload: {
        ...objectPayload(acceptance.payload),
        deliverableId: acceptance.deliverableId,
        inspectionId: acceptance.inspectionId,
        goodsReceiptId: acceptance.goodsReceiptId,
        goodsInspectionId: acceptance.goodsInspectionId,
        acceptedValue: decimalToNumber(acceptance.acceptedValue),
        currency: acceptance.currency,
        acceptedAt: isoDate(acceptance.acceptedAt)
      }
    })),
    inspections: record.inspections.map((inspection) => lifecycleItemDto({ ...inspection, status: inspection.result, category: inspection.inspectionType })),
    goodsInspections: record.goodsInspections.map((inspection) => workflowRecordDto(inspection as unknown as Record<string, unknown>)),
    paymentSchedules: record.paymentSchedules.map((payment) => lifecycleItemDto({
      ...payment,
      category: 'payment',
      note: payment.amount === null ? null : `${decimalToNumber(payment.amount)} ${payment.currency}`,
      payload: {
        ...objectPayload(payment.payload),
        milestoneId: payment.milestoneId,
        amount: decimalToNumber(payment.amount),
        currency: payment.currency
      }
    })),
    purchaseOrders: record.purchaseOrders.map((purchaseOrder) => workflowRecordDto(purchaseOrder as unknown as Record<string, unknown>)),
    invoices: record.invoices.map((invoice) => workflowRecordDto(invoice as unknown as Record<string, unknown>)),
    payments: record.payments.map(paymentDto),
    threeWayMatches: [],
    paymentApprovals: [],
    paymentConfirmations: [],
    commencements: [],
    nonConformances: [],
    securities: [],
    penalties: [],
    changeRequests: [],
    referenceSamples: [],
    risks: record.risks.map(riskDto),
    riskForecasts: [],
    variations: record.variations.map(variationDto),
    issues: record.issues.map(lifecycleItemDto),
    disputes: record.disputes.map(lifecycleItemDto),
    terminations: record.terminations.map(terminationDto),
    warranties: record.warranties.map((warranty) => lifecycleItemDto({
      ...warranty,
      category: 'warranty',
      note: warranty.resolution,
      dueDate: warranty.endDate,
      payload: {
        ...objectPayload(warranty.payload),
        defectReference: warranty.defectReference ?? '',
        startDate: isoDate(warranty.startDate),
        responsibleRole: warranty.responsibleRole ?? ''
      }
    })),
    requiredDocuments: record.requiredDocuments.map((document) => lifecycleItemDto({
      ...document,
      category: document.ownerRole,
      title: document.title,
      note: document.note,
      dueDate: document.dueDate,
      payload: {
        ...objectPayload(document.payload),
        documentType: document.documentType,
        documentId: document.documentId,
        reviewedAt: isoDate(document.reviewedAt)
      }
    })),
    activation: record.activation ? workflowRecordDto(record.activation as unknown as Record<string, unknown>) : null,
    activationItems: record.activationItems.map((item) => lifecycleItemDto({
      ...item,
      category: item.category,
      note: item.note,
      dueDate: item.dueDate,
      payload: {
        ...objectPayload(item.payload),
        activationId: item.activationId,
        ownerRole: item.ownerRole,
        required: item.required,
        documentId: item.documentId,
        submittedByOrgId: item.submittedByOrgId,
        submittedAt: isoDate(item.submittedAt),
        reviewedByUserId: item.reviewedByUserId,
        reviewedAt: isoDate(item.reviewedAt)
      }
    })),
    baselines: record.baselines.map((baseline) => workflowRecordDto(baseline as unknown as Record<string, unknown>)),
    obligations: record.obligations.map((obligation) => lifecycleItemDto({
      ...obligation,
      category: obligation.obligationType,
      note: obligation.description,
      dueDate: obligation.dueDate,
      payload: {
        ...objectPayload(obligation.payload),
        ownerRole: obligation.ownerRole,
        relatedMilestoneId: obligation.relatedMilestoneId,
        amount: decimalToNumber(obligation.amount),
        currency: obligation.currency,
        acceptanceMethod: obligation.acceptanceMethod,
        acceptanceCriteria: obligation.acceptanceCriteria,
        paymentEligible: obligation.paymentEligible,
        evidenceRequirements: obligation.evidenceRequirements.map((requirement) => workflowRecordDto(requirement as unknown as Record<string, unknown>))
      }
    })),
    evidenceRequirements: record.evidenceRequirements.map((requirement) => lifecycleItemDto({
      ...requirement,
      category: requirement.ownerRole,
      note: requirement.note,
      dueDate: requirement.dueDate,
      payload: {
        ...objectPayload(requirement.payload),
        obligationId: requirement.obligationId,
        milestoneId: requirement.milestoneId,
        evidenceType: requirement.evidenceType,
        mandatory: requirement.mandatory,
        documentId: requirement.documentId
      }
    })),
    deliverySchedules: record.deliverySchedules.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    dispatchNotices: record.dispatchNotices.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    goodsReceipts: record.goodsReceipts.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    siteHandovers: record.siteHandovers.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    worksProgressReports: record.worksProgressReports.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    boqMeasurements: record.boqMeasurements.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    interimPaymentCertificates: record.interimPaymentCertificates.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    worksCompletionCertificates: record.worksCompletionCertificates.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    defects: record.defects.map((defect) => lifecycleItemDto({
      ...defect,
      category: defect.severity,
      note: defect.description,
      dueDate: defect.dueDate,
      payload: {
        ...objectPayload(defect.payload),
        defectReference: defect.defectReference,
        identifiedAt: isoDate(defect.identifiedAt),
        closedAt: isoDate(defect.closedAt),
        sourceRecordType: defect.sourceRecordType ?? '',
        sourceRecordId: defect.sourceRecordId ?? '',
        responsibleRole: defect.responsibleRole ?? '',
        responseDueDate: isoDate(defect.responseDueDate),
        respondedAt: isoDate(defect.respondedAt),
        verifiedByUserId: defect.verifiedByUserId ?? '',
        verifiedAt: isoDate(defect.verifiedAt),
        visibilityScope: defect.visibilityScope ?? 'SHARED'
      }
    })),
    serviceLevels: record.serviceLevels.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    servicePeriods: record.servicePeriods.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    serviceReports: record.serviceReports.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    serviceCredits: record.serviceCredits.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    serviceIncidents: record.serviceIncidents.map((incident) => lifecycleItemDto({
      ...incident,
      category: incident.incidentType,
      note: incident.description,
      dueDate: incident.dueDate,
      payload: {
        ...objectPayload(incident.payload),
        incidentReference: incident.incidentReference,
        severity: incident.severity,
        serviceLevelId: incident.serviceLevelId ?? '',
        periodId: incident.periodId ?? '',
        serviceReportId: incident.serviceReportId ?? '',
        occurredAt: isoDate(incident.occurredAt),
        closedAt: isoDate(incident.closedAt),
        responsibleRole: incident.responsibleRole ?? '',
        responseDueDate: isoDate(incident.responseDueDate),
        respondedAt: isoDate(incident.respondedAt),
        verifiedByUserId: incident.verifiedByUserId ?? '',
        verifiedAt: isoDate(incident.verifiedAt),
        visibilityScope: incident.visibilityScope ?? 'SHARED'
      }
    })),
    consultancyDeliverables: record.consultancyDeliverables.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    deliverableVersions: record.deliverableVersions.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    deliverableReviews: record.deliverableReviews.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    consultancyFinalReports: record.consultancyFinalReports.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
    claims: record.claims.map((claim) => workflowRecordDto(claim as unknown as Record<string, unknown>)),
    claimResponses: record.claimResponses.map((response) => workflowRecordDto(response as unknown as Record<string, unknown>)),
    extensionRequests: record.extensionRequests.map((request) => workflowRecordDto(request as unknown as Record<string, unknown>)),
    amendments: record.amendments.map((amendment) => workflowRecordDto(amendment as unknown as Record<string, unknown>)),
    notices: record.notices.map((notice) => workflowRecordDto(notice as unknown as Record<string, unknown>)),
    meetings: record.meetings.map((meeting) => workflowRecordDto(meeting as unknown as Record<string, unknown>)),
    meetingActions: record.meetingActions.map((action) => workflowRecordDto(action as unknown as Record<string, unknown>)),
    workflowApprovals: record.approvalSteps.map((approval) => lifecycleItemDto({
      ...approval,
      category: approval.role,
      title: approval.stepKey,
      note: approval.note,
      payload: {
        ...objectPayload(approval.payload),
        actorUserId: approval.actorUserId,
        decidedAt: isoDate(approval.decidedAt)
      }
    })),
    urgentActions: record.urgentActions.map((action) => lifecycleItemDto({
      ...action,
      category: action.riskLevel,
      title: action.title,
      status: action.status,
      note: action.requiredAction,
      dueDate: action.dueDate,
      payload: {
        ...objectPayload(action.payload),
        actionKey: action.actionKey,
        nextRoute: action.nextRoute
      }
    })),
    notifications: record.notifications.map((notification) => lifecycleItemDto({
      ...notification,
      category: notification.channel,
      title: notification.title,
      status: notification.status,
      note: notification.body,
      payload: objectPayload(notification.payload)
    })),
    closeout: record.closeout ? objectPayload(record.closeout) : null,
    supplierPerformanceRecords: record.supplierPerformanceRecords.map((performance) => objectPayload(performance)),
    performanceScores: [],
    supplierRiskProfile: null,
    audit: audit.map((event) => ({
      event: event.event,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString()
    })),
    createdAt: record.createdAt.toISOString()
  };
}

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async dashboard(context: AwardContractRequestContext): Promise<AwardContractDashboardDto> {
    const organizationId = requireOrg(context);
    const [recommendations, contracts] = await Promise.all([
      this.db.awardRecommendation.findMany({
        where: recommendationScope(context, organizationId),
        include: recommendationInclude,
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      this.db.contract.findMany({
        where: contractScope(context, organizationId),
        include: contractInclude,
        orderBy: { updatedAt: 'desc' },
        take: 100
      })
    ]);

    const queues: Record<LifecycleQueueId, LifecycleActionDto[]> = {
      'sample-procurement': [],
      'contract-preparation': [],
      'awarding-in-progress': [],
      'awards-received': [],
      'contracts-in-progress': [],
      'contract-signing': []
    };

    for (const recommendation of recommendations) {
      const listItem = listRecommendationDto(recommendation);
      const roleContext = recommendation.workspace.buyerOrgId === organizationId ? 'BUYER' : 'SUPPLIER';
      const action = recommendationAction(listItem, roleContext);
      const dto: LifecycleActionDto = {
        id: `award-${recommendation.id}`,
        roleContext,
        sourceType: roleContext === 'BUYER' ? 'TENDER_CREATED' : 'AWARD_RECEIVED',
        tenderId: recommendation.workspace.tenderId,
        awardId: recommendation.id,
        noticeId: recommendation.notice?.id ?? null,
        contractId: listItem.contractId,
        reference: recommendation.reference,
        noticeReference: recommendation.notice?.reference ?? null,
        title: recommendation.workspace.tender.title,
        otherParty: roleContext === 'BUYER' ? listItem.supplierName ?? 'Supplier pending' : listItem.buyerName,
        currentStage: action.stage,
        requiredAction: action.requiredAction,
        dueDate: action.dueDate,
        riskLevel: action.riskLevel,
        status: recommendation.notice?.status ?? recommendation.status,
        amount: decimalToNumber(recommendation.amount),
        currency: recommendation.currency,
        nextRoute: action.nextRoute,
        nextAction: nextAction({
          roleContext,
          requiredAction: action.requiredAction,
          nextRoute: action.nextRoute
        })
      };
      if (roleContext === 'BUYER') queues['awarding-in-progress'].push(dto);
      else queues['awards-received'].push(dto);
    }

    for (const contract of contracts) {
      const roleContext = contract.buyerOrgId === organizationId ? 'BUYER' : 'SUPPLIER';
      const action = contractAction(contract, roleContext);
      const dto: LifecycleActionDto = {
        id: `contract-${contract.id}`,
        roleContext,
        sourceType: 'CONTRACT_ACTIVE',
        tenderId: contract.tenderId,
        awardId: contract.awardId,
        noticeId: contract.awardNotice?.id ?? null,
        contractId: contract.id,
        reference: contract.reference,
        noticeReference: null,
        title: contract.title,
        otherParty: roleContext === 'BUYER' ? contract.supplierOrg?.name ?? 'Supplier pending' : contract.buyerOrg.name,
        currentStage: action.stage,
        requiredAction: action.requiredAction,
        dueDate: action.dueDate,
        riskLevel: action.riskLevel,
        status: contract.status,
        amount: decimalToNumber(contract.amount),
        currency: contract.currency,
        nextRoute: action.nextRoute,
        nextAction: nextAction({
          roleContext,
          requiredAction: action.requiredAction,
          nextRoute: action.nextRoute
        })
      };
      if ((isPreAwardContract(contract) || contract.status === ContractStatus.DRAFT) && roleContext === 'BUYER') {
        queues['contract-preparation'].push(dto);
      } else if (contract.status === ContractStatus.SIGNATURE_PENDING) {
        queues['contract-signing'].push(dto);
      } else if (contract.status === ContractStatus.NEGOTIATION || postAwardDashboardStatuses.has(contract.status)) {
        queues['contracts-in-progress'].push(dto);
      }
    }

    const sampleDashboard = await this.listSamples(context);
    for (const sample of Object.values(sampleDashboard.queues).flat()) {
      if (sample.sampleRequirementStatus === 'NOT_REQUIRED' || sample.sampleRequired === false || sample.awardingStatus === 'not-required') continue;
      if (sample.awardingStatus === 'passed' || sample.awardingStatus === 'failed') continue;
      const dto: LifecycleActionDto = {
        id: `sample-${sample.id}`,
        roleContext: sample.buyerOrgId === organizationId ? 'BUYER' : 'SUPPLIER',
        sourceType: 'SAMPLE_ACTION',
        tenderId: sample.tenderId,
        awardId: null,
        noticeId: null,
        contractId: sample.contractId,
        reference: sample.sampleReference || sample.trackingNumber || sample.id,
        noticeReference: null,
        title: sample.sampleName,
        otherParty: sample.buyerOrgId === organizationId ? sample.supplierName : sample.tenderTitle,
        currentStage: sample.awardingStatus.replace(/-/g, ' '),
        requiredAction: sample.buyerOrgId === organizationId ? 'Manage sample procurement' : 'View sample status',
        dueDate: sample.deliveryDeadline,
        riskLevel: sample.awardingStatus === 'overdue-sample-actions' ? 'High' : 'Medium',
        status: sample.awardingStatus,
        amount: null,
        currency: 'TZS',
        nextRoute: '/awards-contracts/samples',
        nextAction: nextAction({
          roleContext: sample.buyerOrgId === organizationId ? 'BUYER' : 'SUPPLIER',
          requiredAction: 'Manage sample procurement',
          nextRoute: '/awards-contracts/samples'
        })
      };
      queues['sample-procurement'].push(dto);
    }

    return {
      summary: {
        awardQueues: queues['awarding-in-progress'].length + queues['awards-received'].length,
        contractActions: queues['sample-procurement'].length + queues['contract-preparation'].length + queues['contracts-in-progress'].length + queues['contract-signing'].length
      },
      queues
    };
  }

  async listSamples(context: AwardContractRequestContext): Promise<AwardContractSampleDashboardDto> {
    const organizationId = requireOrg(context);
    const where: Prisma.BidSampleWhereInput = context.isAdmin
      ? {}
      : {
          OR: [
            { supplierOrgId: organizationId },
            { tender: { buyerOrgId: organizationId } }
          ]
        };
    const samples = await this.db.bidSample.findMany({
      where,
      include: {
        tender: { select: { id: true, reference: true, title: true, buyerOrgId: true } },
        supplierOrg: { select: { id: true, name: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });
    const detailed = await Promise.all(samples.map((sample) => this.sampleDetailForRecord(this.db, sample, context)));
    const sampleBidIds = new Set(samples.map((sample) => sample.bidId));
    const bidWhere: Prisma.BidWhereInput = context.isAdmin
      ? { status: { in: [BidStatus.SUBMITTED, BidStatus.OPENED, BidStatus.UNDER_EVALUATION, BidStatus.DISQUALIFIED, BidStatus.AWARDED, BidStatus.LOST] } }
      : {
          status: { in: [BidStatus.SUBMITTED, BidStatus.OPENED, BidStatus.UNDER_EVALUATION, BidStatus.DISQUALIFIED, BidStatus.AWARDED, BidStatus.LOST] },
          OR: [
            { supplierOrgId: organizationId },
            { buyerOrgId: organizationId }
          ]
        };
    const bids = await this.db.bid.findMany({
      where: bidWhere,
      include: {
        tender: {
          select: {
            id: true,
            reference: true,
            title: true,
            type: true,
            requirements: true,
            metadata: true,
            buyerOrgId: true,
            requirementRows: { select: { id: true, section: true, payload: true } },
            commercialItems: {
              select: {
                id: true,
                itemNo: true,
                description: true,
                quantity: true,
                unit: true,
                rate: true,
                total: true,
                payload: true
              }
            },
            documents: {
              select: {
                label: true,
                document: { select: { id: true, name: true, documentType: true } }
              }
            }
          }
        },
        supplierOrg: { select: { id: true, name: true } },
        samples: { select: { id: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });
    const requirementRows = bids
      .filter((bid) => !sampleBidIds.has(bid.id) && bid.samples.length === 0)
      .flatMap((bid) => {
        const requirements = tenderSampleFields(bid.tender);
        if (requirements.length === 0) {
          return [sampleRequirementDto(bid, { id: 'not-required', label: 'Sample not required', required: false, payload: {} }, context)];
        }
        return requirements.map((requirement) =>
          sampleRequirementDto(bid, {
            id: requirement.requirementKey || requirement.id,
            label: requirement.label,
            required: requirement.required,
            payload: objectPayload((requirement as unknown as { payload?: unknown }).payload)
          }, context)
        );
      });
    const queues = Object.fromEntries(sampleQueueIds.map((id) => [id, [] as AwardContractSampleDto[]]));
    for (const sample of [...detailed, ...requirementRows]) {
      const queue = queues[sample.awardingStatus] ?? queues['awaiting-submission'];
      queue.push(sample);
    }
    return {
      summary: Object.fromEntries(Object.entries(queues).map(([key, value]) => [key, value.length])),
      queues
    };
  }

  async getSample(sampleId: string, context: AwardContractRequestContext) {
    return this.sampleDetail(sampleId, context);
  }

  async receiveSample(sampleId: string, input: SampleReceiptInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSample(tx, sampleId, context, true);
      const receivedAt = toDateTime(input.receivedAt) ?? new Date();
      await tx.sampleReceipt.upsert({
        where: { bidSampleId: sample.id },
        update: {
          receivedQuantity: input.receivedQuantity,
          conditionAtReceipt: input.conditionAtReceipt || null,
          packagingCondition: input.packagingCondition || null,
          deliveryRepresentative: input.deliveryRepresentative || null,
          receivingOfficerId: input.receivingOfficerId || null,
          storageLocation: input.storageLocation || null,
          missingComponents: input.missingComponents || null,
          visibleDamage: input.visibleDamage || null,
          remarks: input.remarks || null,
          receivedAt,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          sampleReference: sampleReference(),
          receivedQuantity: input.receivedQuantity,
          conditionAtReceipt: input.conditionAtReceipt || null,
          packagingCondition: input.packagingCondition || null,
          deliveryRepresentative: input.deliveryRepresentative || null,
          receivingOfficerId: input.receivingOfficerId || null,
          storageLocation: input.storageLocation || null,
          missingComponents: input.missingComponents || null,
          visibleDamage: input.visibleDamage || null,
          remarks: input.remarks || null,
          receivedAt,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.bidSample.update({ where: { id: sample.id }, data: { trackingStatus: BidSampleStatus.RECEIVED, receivedAt } });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.received', 'bid_sample', sample.id, { sampleName: sample.sampleName });
    });
    return this.sampleDetail(sampleId, context);
  }

  async verifySample(sampleId: string, input: SampleVerificationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSampleWithReceipt(tx, sampleId, context);
      const verifiedAt = toDateTime(input.verifiedAt) ?? new Date();
      await tx.sampleVerification.create({
        data: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          result: input.result,
          quantityAccepted: input.quantityAccepted ?? false,
          certificatesAttached: input.certificatesAttached ?? false,
          packagingAccepted: input.packagingAccepted ?? false,
          matchesBid: input.matchesBid ?? false,
          completeUndamaged: input.completeUndamaged ?? false,
          clarificationRequired: input.clarificationRequired ?? false,
          note: input.note || null,
          verifiedByUserId: context.userId ?? null,
          verifiedAt,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.bidSample.update({ where: { id: sample.id }, data: { inspectedAt: verifiedAt } });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.verified', 'bid_sample', sample.id, { result: input.result });
    });
    return this.sampleDetail(sampleId, context);
  }

  async transferSampleCustody(sampleId: string, input: SampleCustodyTransferInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSampleWithReceipt(tx, sampleId, context);
      await tx.sampleCustodyLog.create({
        data: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          fromCustodianId: input.fromCustodianId || null,
          toCustodianId: input.toCustodianId || null,
          previousLocation: input.previousLocation || null,
          newLocation: input.newLocation || null,
          transferPurpose: input.transferPurpose,
          conditionBefore: input.conditionBefore || null,
          conditionAfter: input.conditionAfter || null,
          authorizedById: context.userId ?? null,
          remarks: input.remarks || null,
          transferredAt: toDateTime(input.transferredAt) ?? new Date(),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.custody_transferred', 'bid_sample', sample.id, { transferPurpose: input.transferPurpose });
    });
    return this.sampleDetail(sampleId, context);
  }

  async evaluateSample(sampleId: string, input: SampleEvaluationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSampleWithReceipt(tx, sampleId, context);
      const decision = input.decision || (input.passed === true ? 'PASSED' : input.passed === false ? 'FAILED' : 'UNDER_EVALUATION');
      await tx.sampleEvaluation.create({
        data: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          criterion: input.criterion,
          score: input.score,
          maximumScore: input.maximumScore,
          passed: input.passed ?? normalizedStatus(decision) === 'PASSED',
          decision,
          comments: input.comments || null,
          evaluatorUserId: context.userId ?? null,
          evaluatedAt: toDateTime(input.evaluatedAt) ?? new Date(),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (['PASSED', 'ACCEPTED'].includes(normalizedStatus(decision))) await tx.bidSample.update({ where: { id: sample.id }, data: { trackingStatus: BidSampleStatus.ACCEPTED } });
      if (['FAILED', 'REJECTED'].includes(normalizedStatus(decision))) await tx.bidSample.update({ where: { id: sample.id }, data: { trackingStatus: BidSampleStatus.REJECTED } });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.evaluated', 'bid_sample', sample.id, { criterion: input.criterion, decision });
    });
    return this.sampleDetail(sampleId, context);
  }

  async createSampleTest(sampleId: string, input: SampleTestInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSampleWithReceipt(tx, sampleId, context);
      if (input.reportDocumentId) await this.assertDocumentVisible(tx, input.reportDocumentId, context);
      await tx.sampleTest.create({
        data: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          testName: input.testName,
          testingInstitution: input.testingInstitution || null,
          testingOfficer: input.testingOfficer || null,
          testingMethod: input.testingMethod || null,
          testingStandard: input.testingStandard || null,
          expectedResult: input.expectedResult || null,
          actualResult: input.actualResult || null,
          result: input.result || 'PENDING',
          testCost: input.testCost,
          currency: input.currency,
          responsibleParty: input.responsibleParty || null,
          reportDocumentId: input.reportDocumentId || null,
          testedAt: toDateTime(input.testedAt) ?? new Date(),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.test_created', 'bid_sample', sample.id, { testName: input.testName });
    });
    return this.sampleDetail(sampleId, context);
  }

  async requestSampleClarification(sampleId: string, input: SampleVerificationInput, context: AwardContractRequestContext) {
    return this.verifySample(sampleId, { ...input, result: input.result || 'CLARIFICATION_REQUIRED', clarificationRequired: true }, context);
  }

  async disposeSample(sampleId: string, input: SampleDispositionInput, context: AwardContractRequestContext) {
    return this.createSampleDisposition(sampleId, { ...input, dispositionType: input.dispositionType || 'DISPOSE' }, context);
  }

  async returnSample(sampleId: string, input: SampleDispositionInput, context: AwardContractRequestContext) {
    return this.createSampleDisposition(sampleId, { ...input, dispositionType: input.dispositionType || 'RETURN' }, context);
  }

  async retainSample(sampleId: string, input: SampleDispositionInput & ContractReferenceSampleInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSampleWithReceipt(tx, sampleId, context);
      const contract = input.contractId
        ? await tx.contract.findUnique({ where: { id: input.contractId } })
        : await tx.contract.findFirst({
            where: { tenderId: sample.tenderId, supplierOrgId: sample.supplierOrgId, awardId: { not: null } },
            orderBy: { updatedAt: 'desc' }
          });
      if (!contract) throw requestError('An awarded contract is required before retaining a reference sample.', 409);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      if (contract.tenderId !== sample.tenderId || contract.supplierOrgId !== sample.supplierOrgId) {
        throw requestError('Reference sample must match the contract tender and supplier.', 409);
      }
      const completedAt = toDateTime(input.completedAt) ?? new Date();
      await tx.sampleDisposition.create({
        data: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          dispositionType: 'RETAIN',
          reason: input.reason || null,
          authorizedByUserId: context.userId ?? null,
          supplierNotifiedAt: toDateTime(input.supplierNotifiedAt),
          collectionDeadline: toDateTime(input.collectionDeadline),
          collectionRepresentative: input.collectionRepresentative || null,
          returnCondition: input.returnCondition || null,
          disposalMethod: input.disposalMethod || null,
          witnesses: input.witnesses || null,
          acknowledgementDocumentId: input.acknowledgementDocumentId || null,
          status: input.status || 'COMPLETED',
          completedAt,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.contractReferenceSample.upsert({
        where: { contractId_bidSampleId: { contractId: contract.id, bidSampleId: sample.id } },
        update: {
          referenceNo: input.referenceNo || sample.sampleName,
          storageLocation: input.storageLocation || null,
          status: input.status || 'RETAINED',
          note: input.note || input.reason || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId: contract.id,
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          referenceNo: input.referenceNo || sample.sampleName,
          sampleName: sample.sampleName,
          storageLocation: input.storageLocation || null,
          status: input.status || 'RETAINED',
          note: input.note || input.reason || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.retained_reference', 'bid_sample', sample.id, { contractId: contract.id });
    });
    return this.sampleDetail(sampleId, context);
  }

  async upsertCommencement(contractId: string, input: ContractCommencementInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId }, include: { mobilizationItems: true } });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      assertAwardLinkedContract(contract);
      const commencementReadyStatuses: ContractStatus[] = [ContractStatus.SIGNED, ContractStatus.MOBILIZATION, ContractStatus.ACTIVE];
      if (!commencementReadyStatuses.includes(contract.status)) throw requestError('Contract must be signed before commencement can be recorded.', 409);
      const completedMobilizationStatuses: ContractLifecycleItemStatus[] = [ContractLifecycleItemStatus.APPROVED, ContractLifecycleItemStatus.WAIVED, ContractLifecycleItemStatus.CLOSED];
      const blockingMobilization = contract.mobilizationItems.filter((item) => item.required && !completedMobilizationStatuses.includes(item.status));
      if (blockingMobilization.length > 0) throw requestError('Required mobilization checklist items must be approved or waived before commencement.', 409);
      await tx.contractCommencement.upsert({
        where: { contractId },
        update: {
          noticeDate: toDate(input.noticeDate) ?? null,
          startDate: toDate(input.startDate) ?? null,
          effectiveDate: toDate(input.effectiveDate) ?? null,
          completionDate: toDate(input.completionDate) ?? null,
          deliveryLocation: input.deliveryLocation || null,
          buyerContractManager: input.buyerContractManager || null,
          supplierContractManager: input.supplierContractManager || null,
          initialMeetingDate: toDate(input.initialMeetingDate) ?? null,
          approvedWorkPlan: input.approvedWorkPlan || null,
          approvedDeliverySchedule: input.approvedDeliverySchedule || null,
          status: input.status || 'DRAFT',
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          noticeDate: toDate(input.noticeDate) ?? null,
          startDate: toDate(input.startDate) ?? null,
          effectiveDate: toDate(input.effectiveDate) ?? null,
          completionDate: toDate(input.completionDate) ?? null,
          deliveryLocation: input.deliveryLocation || null,
          buyerContractManager: input.buyerContractManager || null,
          supplierContractManager: input.supplierContractManager || null,
          initialMeetingDate: toDate(input.initialMeetingDate) ?? null,
          approvedWorkPlan: input.approvedWorkPlan || null,
          approvedDeliverySchedule: input.approvedDeliverySchedule || null,
          status: input.status || 'DRAFT',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.commencement.upserted', 'contract', contractId, { status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async createNonConformance(contractId: string, input: ContractNonConformanceInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractNonConformance.create({
        data: {
          contractId,
          category: input.category,
          title: input.title,
          description: input.description || null,
          relatedRecordId: input.relatedRecordId || null,
          contractClause: input.contractClause || null,
          severity: input.severity || 'MINOR',
          responsibleSupplierOfficer: input.responsibleSupplierOfficer || null,
          correctiveAction: input.correctiveAction || null,
          correctiveActionDeadline: toDate(input.correctiveActionDeadline) ?? null,
          verificationResult: input.verificationResult || null,
          status: input.status || 'OPEN',
          identifiedAt: toDateTime(input.identifiedAt) ?? new Date(),
          closedAt: toDateTime(input.closedAt) ?? null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.non_conformance.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async createContractSecurity(contractId: string, input: ContractSecurityInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      await tx.contractSecurity.create({
        data: {
          contractId,
          securityType: input.securityType,
          issuingInstitution: input.issuingInstitution || null,
          referenceNumber: input.referenceNumber || null,
          amount: input.amount,
          currency: input.currency,
          issueDate: toDate(input.issueDate) ?? null,
          expiryDate: toDate(input.expiryDate) ?? null,
          verificationStatus: input.verificationStatus || 'PENDING',
          claimStatus: input.claimStatus || 'NONE',
          releasedAt: toDateTime(input.releasedAt) ?? null,
          documentId: input.documentId || null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.security.created', 'contract', contractId, { securityType: input.securityType });
    });
    return this.getContract(contractId, context);
  }

  async createContractPenalty(contractId: string, input: ContractPenaltyInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractPenalty.create({
        data: {
          contractId,
          invoiceId: input.invoiceId || null,
          penaltyType: input.penaltyType,
          contractClause: input.contractClause || null,
          basis: input.basis || null,
          amount: input.amount,
          currency: input.currency,
          status: input.status || 'DRAFT',
          approvedByUserId: normalizedStatus(input.status) === 'APPROVED' ? context.userId ?? null : null,
          evidence: (input.evidence ?? []) as Prisma.InputJsonArray,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.penalty.created', 'contract', contractId, { penaltyType: input.penaltyType });
    });
    return this.getContract(contractId, context);
  }

  async createContractChangeRequest(contractId: string, input: ContractChangeRequestInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractChangeRequest.create({
        data: {
          contractId,
          changeType: input.changeType,
          title: input.title,
          reason: input.reason || null,
          raisedByOrgId: context.organizationId ?? null,
          technicalReview: input.technicalReview || null,
          financialReview: input.financialReview || null,
          budgetCheck: input.budgetCheck || null,
          legalReview: input.legalReview || null,
          supplierResponse: input.supplierResponse || null,
          amendmentVersionId: input.amendmentVersionId || null,
          status: input.status || 'RAISED',
          approvedAt: toDateTime(input.approvedAt) ?? null,
          signedAt: toDateTime(input.signedAt) ?? null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.change_request.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async controlContractSecurity(contractId: string, securityId: string, action: 'review' | 'extend' | 'release' | 'claim' | 'waive', input: ContractSecurityActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const security = await tx.contractSecurity.findFirst({ where: { id: securityId, contractId } });
      if (!security) throw requestError('Security or guarantee was not found.', 404);
      const verificationStatus =
        input.verificationStatus
          || (action === 'release' ? 'RELEASED' : action === 'waive' ? 'WAIVED' : action === 'review' ? 'VERIFIED' : security.verificationStatus);
      const claimStatus = input.claimStatus || (action === 'claim' ? 'CLAIMED' : security.claimStatus);
      await tx.contractSecurity.update({
        where: { id: security.id },
        data: {
          verificationStatus,
          claimStatus,
          expiryDate: toDate(input.expiryDate) ?? security.expiryDate,
          releasedAt: toDateTime(input.releasedAt) ?? security.releasedAt ?? (action === 'release' ? new Date() : undefined),
          note: input.note || security.note,
          payload: {
            ...objectPayload(security.payload),
            ...objectPayload(input.payload),
            privateNote: input.privateNote || objectPayload(security.payload).privateNote || null,
            lastAction: action,
            lastActionAt: new Date().toISOString()
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, `contract.security.${action}`, 'contract', contractId, { securityId, verificationStatus, claimStatus });
    });
    return this.getContract(contractId, context);
  }

  async controlChangeRequest(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      const item = await tx.contractChangeRequest.findUnique({ where: { id: itemId } });
      if (!item || item.contractId !== contractId) throw requestError('Change request was not found.', 404);
      assertContractVisible(contract, context);
      if (action !== 'respond') assertContractManager(contract, context);
      const nextPayload = controlPayload(item.payload, action, input, context);
      const data: Prisma.ContractChangeRequestUpdateInput = { payload: nextPayload as Prisma.InputJsonObject };
      if (action === 'respond') {
        data.supplierResponse = input.supplierResponse || input.response || input.note || item.supplierResponse || null;
        data.status = input.status ? String(input.status) : 'SUPPLIER_RESPONDED';
      } else if (action === 'review') {
        data.technicalReview = input.note ?? item.technicalReview;
        data.status = input.status ? String(input.status) : 'UNDER_REVIEW';
      } else if (action === 'approve') {
        const amendment = await this.requireSignedAmendment(tx, contractId, input);
        data.status = 'APPROVED';
        data.approvedAt = new Date();
        data.signedAt = amendment.signedAt ?? new Date();
        data.amendmentVersionId = amendment.id;
      } else if (action === 'reject') {
        data.status = 'REJECTED';
      }
      await tx.contractChangeRequest.update({ where: { id: itemId }, data });
      await this.audit(tx, contract.buyerOrgId, context.userId, `contract.change_request.${action}`, 'contract', contractId, { itemId, status: data.status });
    });
    return this.getContract(contractId, context);
  }

  async controlVariation(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractVariation.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Variation was not found.', 404);
      assertContractVisible(item.contract, context);
      assertContractManager(item.contract, context);
      const payload = controlPayload(item.payload, action, input, context);
      const data: Prisma.ContractVariationUpdateInput = {
        payload: payload as Prisma.InputJsonObject,
        ...(input.note !== undefined || input.decision !== undefined ? { decision: input.decision || input.note || null } : {})
      };
      if (action === 'review') data.status = ContractLifecycleItemStatus.IN_PROGRESS;
      if (action === 'reject') data.status = ContractLifecycleItemStatus.REJECTED;
      if (action === 'close') data.status = ContractLifecycleItemStatus.CLOSED;
      if (action === 'approve') {
        const amendment = await this.requireSignedAmendment(tx, contractId, input);
        data.status = ContractLifecycleItemStatus.APPROVED;
        data.payload = {
          ...payload,
          linkedAmendmentId: amendment.id,
          linkedAmendmentReference: amendment.amendmentReference,
          linkedBaselineVersionNo: amendment.baselineVersionNo ?? null
        } as Prisma.InputJsonObject;
      }
      await tx.contractVariation.update({ where: { id: itemId }, data });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.variation.${action}`, 'contract', contractId, { itemId, status: data.status });
    });
    return this.getContract(contractId, context);
  }

  async controlExtensionRequest(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractExtensionRequest.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Extension request was not found.', 404);
      assertContractVisible(item.contract, context);
      assertContractManager(item.contract, context);
      const data: Prisma.ContractExtensionRequestUpdateInput = {
        payload: controlPayload(item.payload, action, input, context) as Prisma.InputJsonObject
      };
      if (action === 'review') data.status = ContractLifecycleItemStatus.IN_PROGRESS;
      if (action === 'reject') data.status = ContractLifecycleItemStatus.REJECTED;
      if (action === 'close') data.status = ContractLifecycleItemStatus.CLOSED;
      if (action === 'approve') {
        data.status = ContractLifecycleItemStatus.APPROVED;
        data.decidedAt = new Date();
        if (item.requestedEndDate) {
          await tx.contractCommencement.updateMany({ where: { contractId }, data: { completionDate: item.requestedEndDate } });
        }
      }
      await tx.contractExtensionRequest.update({ where: { id: itemId }, data });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.extension_request.${action}`, 'contract', contractId, { itemId, status: data.status });
    });
    return this.getContract(contractId, context);
  }

  async controlClaim(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractClaim.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Claim was not found.', 404);
      assertContractVisible(item.contract, context);
      const responderRole = item.contract.buyerOrgId === context.organizationId ? 'buyer' : 'supplier';
      const response = input.response || input.note || input.decision || '';
      const decision = input.decision || (action === 'settle' ? 'SETTLED' : action === 'reject' ? 'REJECTED' : action === 'escalate' ? 'ESCALATED' : 'UNDER_REVIEW');
      await tx.contractClaimResponse.create({
        data: {
          contractId,
          claimId: item.id,
          responderRole,
          decision,
          response: response || null,
          amountApproved: input.amountApproved ?? input.settlementAmount ?? null,
          payload: controlPayload({}, action, input, context) as Prisma.InputJsonObject
        }
      });
      let payload = controlPayload(item.payload, action, input, context);
      let status: ContractLifecycleItemStatus = action === 'reject' ? ContractLifecycleItemStatus.REJECTED : action === 'settle' ? ContractLifecycleItemStatus.APPROVED : ContractLifecycleItemStatus.IN_PROGRESS;
      if (action === 'escalate') {
        const dispute = await tx.contractDispute.create({
          data: {
            contractId,
            raisedByOrgId: context.organizationId ?? null,
            title: `Dispute for ${item.claimReference}`,
            description: item.description || item.title,
            route: String(input.payload.route ?? 'DISPUTE_BOARD'),
            status: ContractLifecycleItemStatus.OPEN,
            decision: null,
            payload: {
              sourceClaimId: item.id,
              claimReference: item.claimReference,
              reason: input.note || input.response || ''
            } as Prisma.InputJsonObject
          }
        });
        payload = { ...payload, escalatedDisputeId: dispute.id };
        status = ContractLifecycleItemStatus.CLOSED;
      }
      await tx.contractClaim.update({ where: { id: itemId }, data: { status, payload: payload as Prisma.InputJsonObject } });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.claim.${action}`, 'contract', contractId, { itemId, decision });
    });
    return this.getContract(contractId, context);
  }

  async controlNonConformance(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractNonConformance.findUnique({ where: { id: itemId } });
      const contract = await this.requireContract(tx, contractId, context);
      if (!item || item.contractId !== contractId) throw requestError('Non-conformance was not found.', 404);
      assertContractVisible(contract, context);
      const data: Prisma.ContractNonConformanceUpdateInput = {
        payload: controlPayload(item.payload, action, input, context) as Prisma.InputJsonObject
      };
      if (action === 'respond') {
        data.correctiveAction = input.response || input.supplierResponse || input.note || item.correctiveAction || null;
        data.status = 'SUBMITTED';
      }
      if (action === 'verify') {
        data.verificationResult = input.decision || input.note || 'VERIFIED';
        data.status = String(input.status ?? 'APPROVED');
      }
      if (action === 'close') {
        if (!item.verificationResult && !input.decision && !input.note) throw requestError('NCR cannot be closed before buyer verification is recorded.', 409);
        data.status = 'CLOSED';
        data.closedAt = new Date();
      }
      await tx.contractNonConformance.update({ where: { id: itemId }, data });
      await this.audit(tx, contract.buyerOrgId, context.userId, `contract.non_conformance.${action}`, 'contract', contractId, { itemId });
    });
    return this.getContract(contractId, context);
  }

  async controlRisk(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    const status = action === 'close' ? ContractLifecycleItemStatus.CLOSED : action === 'mitigate' ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.SUBMITTED;
    return this.updateRisk(contractId, itemId, { status, note: input.note, dueDate: input.dueDate, payload: controlPayload(input.payload, action, input, context) }, context);
  }

  async controlIssue(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractIssue.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Issue was not found.', 404);
      assertContractVisible(item.contract, context);
      const status = action === 'close' ? ContractLifecycleItemStatus.CLOSED : action === 'resolve' ? ContractLifecycleItemStatus.SUBMITTED : ContractLifecycleItemStatus.IN_PROGRESS;
      await tx.contractIssue.update({
        where: { id: itemId },
        data: {
          status,
          ...(input.note !== undefined || input.response !== undefined ? { resolution: input.note || input.response || null } : {}),
          ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) ?? null } : {}),
          payload: controlPayload(item.payload, action, input, context) as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.issue.${action}`, 'contract', contractId, { itemId, status });
    });
    return this.getContract(contractId, context);
  }

  async controlDispute(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractDispute.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Dispute was not found.', 404);
      assertContractVisible(item.contract, context);
      const status = action === 'close' ? ContractLifecycleItemStatus.CLOSED : action === 'resolve' ? ContractLifecycleItemStatus.APPROVED : ContractLifecycleItemStatus.IN_PROGRESS;
      await tx.contractDispute.update({
        where: { id: itemId },
        data: {
          status,
          decision: input.decision || input.note || input.response || item.decision || null,
          payload: controlPayload(item.payload, action, input, context) as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.dispute.${action}`, 'contract', contractId, { itemId, status });
    });
    return this.getContract(contractId, context);
  }

  async listRecommendations(query: AwardRecommendationQuery, context: AwardContractRequestContext): Promise<ListAwardRecommendationsResponseDto> {
    const where = recommendationWhere(query, context);
    const [records, totalRecords] = await Promise.all([
      this.db.awardRecommendation.findMany({
        where,
        include: recommendationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.db.awardRecommendation.count({ where })
    ]);

    return {
      recommendations: records.map(listRecommendationDto),
      page: query.page,
      pageSize: query.pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / query.pageSize))
    };
  }

  async getRecommendation(id: string, context: AwardContractRequestContext): Promise<AwardRecommendationDetailDto | null> {
    const record = await this.db.awardRecommendation.findFirst({
      where: andWhere([{ id }, recommendationScope(context)]),
      include: recommendationInclude
    });
    if (!record) return null;
    const contractId = record.notice?.contractId ?? record.contracts[0]?.id;
    const contract = contractId ? await this.getContract(contractId, context) : null;
    const [audit, approvalRoutes, approvalSteps, tieBreakers, feasibilityChecks, standstillPeriods, awardNotifications, budgetCommitments, awardGroup] = await Promise.all([
      this.db.auditEvent.findMany({
        where: {
          OR: [
            { entityType: 'award_recommendation', entityRef: record.id },
            ...(record.notice ? [{ entityType: 'award_notice', entityRef: record.notice.id }] : []),
            ...(record.awardGroupId ? [{ entityType: 'award_group', entityRef: record.awardGroupId }] : []),
            ...(contractId ? [{ entityType: 'contract', entityRef: contractId }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.db.awardApprovalRoute.findMany({ where: { recommendationId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.awardApprovalStep.findMany({ where: { recommendationId: record.id }, orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.db.awardTieBreaker.findMany({ where: { recommendationId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.deliveryFeasibilityCheck.findMany({ where: { recommendationId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.standstillPeriod.findMany({ where: { recommendationId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.awardNotification.findMany({ where: { recommendationId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.budgetCommitment.findMany({ where: { recommendationId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.awardGroupDetail(record, context)
    ]);
    const sourceDocuments = await this.recommendationSourceDocuments(record, awardGroup);

    return {
      ...listRecommendationDto(record),
      awardGroupId: awardGroup.id,
      access: workflowAccess({ buyerOrgId: record.workspace.buyerOrgId, supplierOrgId: record.supplierOrgId }, context),
      reason: record.reason ?? '',
      payload: objectPayload(record.payload),
      sourceDocuments,
      awardGroup,
      notice: record.notice ? noticeDto(record.notice) : null,
      contract,
      approvalRoutes: approvalRoutes.map((item) => ({
        ...workflowRecordDto(item as unknown as Record<string, unknown>),
        steps: approvalSteps.filter((step) => step.routeId === item.id).map((step) => workflowRecordDto(step as unknown as Record<string, unknown>))
      })),
      tieBreakers: tieBreakers.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      feasibilityChecks: feasibilityChecks.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      standstillPeriods: standstillPeriods.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      awardNotifications: awardNotifications.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      budgetCommitments: budgetCommitments.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      approvals: record.approvals.map((approval) => ({
        id: approval.id,
        status: approval.status,
        action: approval.action ?? '',
        actorUserId: approval.actorUserId,
        decidedAt: approval.decidedAt?.toISOString() ?? null
      })),
      audit: audit.map((event) => ({
        event: event.event,
        actorUserId: event.actorUserId,
        createdAt: event.createdAt.toISOString()
      }))
    };
  }

  async saveAwardDecisionDraft(id: string, input: AwardDecisionDraftInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({
        where: { id },
        include: recommendationInclude
      });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      await this.updateAwardDecisionDraft(tx, recommendation, input, context, 'award.decision_draft.saved');
    });

    return this.getRecommendation(id, context);
  }

  async approveRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({
        where: { id },
        include: recommendationInclude
      });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      if (!recommendation.supplierOrgId || !recommendation.bidId) throw requestError('Award recommendation must reference a supplier bid.', 409);

      await this.updateAwardDecisionDraft(tx, recommendation, input, context, 'award.decision.approved');
      await this.upsertApprovalStep(tx, recommendation.id, context.userId, ApprovalStatus.APPROVED, 'approved', input.note);
      await this.upsertSingleUserAwardApproval(tx, recommendation.id, context, ApprovalStatus.APPROVED, input.note);
      await tx.awardRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: RecommendationStatus.APPROVED,
          reason: input.reason || input.note || recommendation.reason
        }
      });
      await this.findOrCreateAwardGroup(tx, recommendation);
      await signSensitiveAction(tx, {
        userId: requireUserId(context),
        organizationId: context.organizationId ?? recommendation.workspace.buyerOrgId,
        signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
        moduleKey: 'award-contract',
        actionKey: 'award_recommendation.approve',
        entityType: 'award_recommendation',
        entityRef: recommendation.id,
        payload: {
          recommendationId: recommendation.id,
          tenderId: recommendation.workspace.tenderId,
          bidId: recommendation.bidId,
          supplierOrgId: recommendation.supplierOrgId,
          amount: input.awardAmount ?? recommendation.amount,
          currency: input.currency ?? recommendation.currency,
          note: input.note
        }
      });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.single_user_approval.approved', 'award_recommendation', recommendation.id, {
        note: input.note,
        actorUserId: context.userId ?? null,
        organizationId: context.organizationId ?? null
      });
    });

    return this.getRecommendation(id, context);
  }

  async returnRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({
        where: { id },
        include: recommendationInclude
      });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);

      await this.upsertApprovalStep(tx, recommendation.id, context.userId, ApprovalStatus.RETURNED, 'returned', input.note);
      await this.upsertSingleUserAwardApproval(tx, recommendation.id, context, ApprovalStatus.RETURNED, input.note);
      await tx.awardRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: RecommendationStatus.RETURNED,
          reason: input.note || recommendation.reason
        }
      });
      if (recommendation.notice) {
        await tx.awardNotice.update({
          where: { id: recommendation.notice.id },
          data: { status: AwardNoticeStatus.CANCELLED }
        });
      }
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.single_user_approval.returned', 'award_recommendation', recommendation.id, {
        note: input.note,
        actorUserId: context.userId ?? null,
        organizationId: context.organizationId ?? null
      });
    });

    return this.getRecommendation(id, context);
  }

  async upsertAwardApprovalRoute(id: string, input: AwardApprovalRouteInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      await tx.awardApprovalRoute.upsert({
        where: { recommendationId_routeKey: { recommendationId: id, routeKey: input.routeKey } },
        update: {
          title: input.title,
          status: input.status ?? 'DRAFT',
          currentStepOrder: input.currentStepOrder ?? 1,
          requiredQuorum: input.requiredQuorum ?? 1,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          recommendationId: id,
          routeKey: input.routeKey,
          title: input.title,
          status: input.status ?? 'DRAFT',
          currentStepOrder: input.currentStepOrder ?? 1,
          requiredQuorum: input.requiredQuorum ?? 1,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.approval_route.upserted', 'award_recommendation', id, { routeKey: input.routeKey });
    });
    return this.getRecommendation(id, context);
  }

  async upsertAwardApprovalStep(id: string, input: AwardApprovalStepInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      const route = await tx.awardApprovalRoute.findFirst({ where: { id: input.routeId, recommendationId: id } });
      if (!route) throw requestError('Award approval route was not found.', 404);
      const status = (input.status ?? ApprovalStatus.PENDING) as ApprovalStatus;
      const actorUserId = this.approvalActorUserId(input.actorUserId, context);
      await tx.awardApprovalStep.upsert({
        where: { routeId_stepKey: { routeId: input.routeId, stepKey: input.stepKey } },
        update: {
          stepOrder: input.stepOrder,
          role: input.role,
          actorUserId,
          status,
          dueDate: toDate(input.dueDate),
          decidedAt: terminalApprovalStatuses.includes(status) ? new Date() : null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          routeId: input.routeId,
          recommendationId: id,
          stepOrder: input.stepOrder,
          stepKey: input.stepKey,
          role: input.role,
          actorUserId,
          status,
          dueDate: toDate(input.dueDate),
          decidedAt: terminalApprovalStatuses.includes(status) ? new Date() : null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (terminalApprovalStatuses.includes(status)) {
        await tx.approvalStep.create({
          data: {
            recommendationId: id,
            actorUserId,
            assignment: WorkflowAssignmentType.APPROVER,
            status,
            action: input.stepKey,
            decidedAt: new Date(),
            payload: { note: input.note, routeId: input.routeId, role: input.role } as Prisma.InputJsonObject
          }
        });
      }
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.approval_step.upserted', 'award_recommendation', id, { stepKey: input.stepKey, status });
    });
    return this.getRecommendation(id, context);
  }

  async createAwardTieBreaker(id: string, input: AwardTieBreakerInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      await tx.awardTieBreaker.create({
        data: {
          recommendationId: id,
          tenderId: recommendation.workspace.tenderId,
          triggerReason: input.triggerReason,
          method: input.method,
          criteria: (input.criteria ?? []) as Prisma.InputJsonArray,
          outcomeBidId: input.outcomeBidId,
          status: input.status ?? 'OPEN',
          decidedByUserId: input.status === 'RESOLVED' || input.outcomeBidId ? context.userId ?? null : null,
          decidedAt: input.status === 'RESOLVED' || input.outcomeBidId ? new Date() : null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.tie_breaker.created', 'award_recommendation', id, { method: input.method, status: input.status });
    });
    return this.getRecommendation(id, context);
  }

  async upsertDeliveryFeasibility(id: string, input: DeliveryFeasibilityInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      const existing = await tx.deliveryFeasibilityCheck.findFirst({ where: { recommendationId: id }, orderBy: { createdAt: 'desc' } });
      const data = {
        tenderId: recommendation.workspace.tenderId,
        bidId: recommendation.bidId,
        supplierOrgId: recommendation.supplierOrgId,
        deliveryCapacity: input.deliveryCapacity || null,
        siteReadiness: input.siteReadiness || null,
        resourcePlan: input.resourcePlan || null,
        riskRating: input.riskRating ?? 'MEDIUM',
        status: input.status ?? 'PENDING',
        reviewerUserId: context.userId ?? null,
        reviewedAt: input.status ? new Date() : null,
        note: input.note || null,
        payload: input.payload as Prisma.InputJsonObject
      };
      if (existing) await tx.deliveryFeasibilityCheck.update({ where: { id: existing.id }, data });
      else await tx.deliveryFeasibilityCheck.create({ data: { recommendationId: id, ...data } });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.delivery_feasibility.upserted', 'award_recommendation', id, { status: input.status, riskRating: input.riskRating });
    });
    return this.getRecommendation(id, context);
  }

  async upsertStandstillPeriod(id: string, input: StandstillPeriodInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      const startsAt = toDateTime(input.startsAt) ?? new Date();
      const endsAt = toDateTime(input.endsAt) ?? new Date(startsAt.getTime() + (input.days ?? 7) * 24 * 60 * 60 * 1000);
      const existing = await tx.standstillPeriod.findFirst({ where: { recommendationId: id }, orderBy: { createdAt: 'desc' } });
      const data = {
        noticeId: recommendation.notice?.id ?? null,
        buyerOrgId: recommendation.workspace.buyerOrgId,
        supplierOrgId: recommendation.supplierOrgId,
        startsAt,
        endsAt,
        days: input.days ?? Math.max(0, Math.ceil((endsAt.getTime() - startsAt.getTime()) / (24 * 60 * 60 * 1000))),
        status: input.waived ? 'WAIVED' : input.status ?? (endsAt.getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE'),
        waived: input.waived ?? false,
        waiverReason: input.waiverReason || null,
        payload: input.payload as Prisma.InputJsonObject
      };
      if (existing) await tx.standstillPeriod.update({ where: { id: existing.id }, data });
      else await tx.standstillPeriod.create({ data: { recommendationId: id, ...data } });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.standstill.upserted', 'award_recommendation', id, { status: data.status, endsAt: endsAt.toISOString() });
    });
    return this.getRecommendation(id, context);
  }

  async createAwardNotification(id: string, input: AwardNotificationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      const recipientOrgId = input.recipientOrgId ?? recommendation.supplierOrgId ?? null;
      await tx.awardNotification.create({
        data: {
          recommendationId: id,
          noticeId: recommendation.notice?.id ?? null,
          recipientOrgId,
          channel: input.channel ?? 'IN_APP',
          notificationType: input.notificationType,
          subject: input.subject,
          body: input.body || null,
          status: input.status ?? 'SENT',
          sentAt: input.status === 'DRAFT' ? null : new Date(),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (recipientOrgId) {
        await tx.notification.create({
          data: {
            ownerOrgId: recipientOrgId,
            awardId: id,
            channel: input.channel ?? 'IN_APP',
            title: input.subject,
            body: input.body || null,
            payload: { notificationType: input.notificationType, recommendationId: id } as Prisma.InputJsonObject
          }
        });
      }
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.notification.created', 'award_recommendation', id, { recipientOrgId, notificationType: input.notificationType });
    });
    return this.getRecommendation(id, context);
  }

  async createBudgetCommitmentForRecommendation(id: string, input: BudgetCommitmentInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      await tx.budgetCommitment.create({
        data: {
          recommendationId: id,
          tenderId: recommendation.workspace.tenderId,
          contractId: input.contractId ?? recommendation.notice?.contractId ?? recommendation.contracts[0]?.id ?? null,
          buyerOrgId: recommendation.workspace.buyerOrgId,
          commitmentNo: input.commitmentNo || commitmentNo(),
          budgetCode: input.budgetCode,
          amount: input.amount,
          currency: input.currency,
          status: input.status ?? 'RESERVED',
          reservedAt: new Date(),
          approvedByUserId: context.userId ?? null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.budget_commitment.created', 'award_recommendation', id, { amount: input.amount, budgetCode: input.budgetCode });
    });
    return this.getRecommendation(id, context);
  }

  async upsertAwardClause(id: string, input: ClauseInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      const group = await this.findOrCreateAwardGroup(tx, recommendation);
      await tx.awardClause.upsert({
        where: { awardGroupId_clauseKey: { awardGroupId: group.id, clauseKey: input.clauseKey } },
        update: {
          title: input.title,
          body: input.body || null,
          category: input.category || 'general',
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          buyerComment: input.buyerComment || null,
          supplierComment: input.supplierComment || null,
          legalComment: input.legalComment || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          awardGroupId: group.id,
          clauseKey: input.clauseKey,
          title: input.title,
          body: input.body || null,
          category: input.category || 'general',
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          buyerComment: input.buyerComment || null,
          supplierComment: input.supplierComment || null,
          legalComment: input.legalComment || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.awardGroup.update({ where: { id: group.id }, data: { status: 'NEGOTIATION' } });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.clause.upserted', 'award_group', group.id, { clauseKey: input.clauseKey });
    });
    return this.getRecommendation(id, context);
  }

  async createAwardNegotiation(id: string, input: NegotiationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      const isBuyer = context.isAdmin || recommendation.workspace.buyerOrgId === context.organizationId;
      const isSupplier = Boolean(context.organizationId && recommendation.supplierOrgId === context.organizationId);
      if (!isBuyer && !isSupplier) throw requestError('Award negotiation is not visible to this organization.', 403);
      const group = await this.findOrCreateAwardGroup(tx, recommendation);
      await tx.awardNegotiation.create({
        data: {
          awardGroupId: group.id,
          winnerId: input.winnerId || null,
          clauseId: input.clauseId || null,
          raisedByRole: input.raisedByRole,
          raisedByOrgId: context.organizationId ?? null,
          subject: input.subject,
          position: input.position || null,
          counterOffer: input.counterOffer || null,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.awardGroup.update({ where: { id: group.id }, data: { status: 'NEGOTIATION' } });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.negotiation.created', 'award_group', group.id, { subject: input.subject });
    });
    return this.getRecommendation(id, context);
  }

  async generateAwardBidPack(id: string, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      const group = await this.findOrCreateAwardGroup(tx, recommendation);
      await this.generateAwardBidPackRecord(tx, group.id, context, 'Manual generation from award workspace');
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.bid_pack.generated', 'award_group', group.id, {});
    });
    return this.getRecommendation(id, context);
  }

  async settleAwardGroup(id: string, input: AwardSettlementInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({ where: { id }, include: recommendationInclude });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      if (recommendation.status !== RecommendationStatus.APPROVED) {
        throw requestError('Confirm the award before sending notices.', 409);
      }
      const group = await this.findOrCreateAwardGroup(tx, recommendation);

      await this.generateAwardBidPackRecord(tx, group.id, context, input.note || 'Generated during award settlement');
      const winners = await tx.awardWinner.findMany({ where: { awardGroupId: group.id } });
      for (const winner of winners) {
        const winnerRecommendationId = winner.recommendationId ?? recommendation.id;
        const winnerRecommendation =
          winner.recommendationId && winner.recommendationId !== recommendation.id
            ? await tx.awardRecommendation.findUnique({ where: { id: winner.recommendationId }, include: recommendationInclude })
            : recommendation;
        if (!winnerRecommendation?.supplierOrgId || !winnerRecommendation.bidId) continue;
        const notice = await tx.awardNotice.upsert({
          where: { recommendationId: winnerRecommendationId },
          update: {
            status: AwardNoticeStatus.PENDING_RESPONSE,
            buyerNote: input.note || null,
            issuedByUserId: context.userId ?? null,
            respondedByUserId: null,
            respondedAt: null,
            payload: {
              ...objectPayload(winnerRecommendation.notice?.payload),
              awardGroupId: group.id,
              settlementPayload: input.payload
            } as Prisma.InputJsonObject
          },
          create: {
            reference: awardNoticeReference(),
            recommendationId: winnerRecommendationId,
            buyerOrgId: winnerRecommendation.workspace.buyerOrgId,
            supplierOrgId: winnerRecommendation.supplierOrgId,
            buyerNote: input.note || null,
            issuedByUserId: context.userId ?? null,
            payload: {
              tenderId: winnerRecommendation.workspace.tenderId,
              bidId: winnerRecommendation.bidId,
              awardGroupId: group.id,
              settlementPayload: input.payload
            } as Prisma.InputJsonObject
          }
        });
        await tx.awardWinner.update({
          where: { id: winner.id },
          data: {
            status: AwardNoticeStatus.PENDING_RESPONSE,
            noticeId: notice.id,
            payload: {
              ...objectPayload(winner.payload),
              settledAt: new Date().toISOString()
            } as Prisma.InputJsonObject
          }
        });
        await tx.awardRecommendation.update({
          where: { id: winnerRecommendationId },
          data: { status: RecommendationStatus.APPROVED, reason: input.note || winnerRecommendation.reason }
        });
        await tx.bid.update({ where: { id: winnerRecommendation.bidId }, data: { status: BidStatus.AWARDED } });
      }
      await tx.tender.update({ where: { id: recommendation.workspace.tenderId }, data: { status: TenderStatus.AWARDED } });
      await tx.awardGroup.update({
        where: { id: group.id },
        data: {
          status: 'NOTICED',
          settledAt: new Date(),
          payload: {
            ...objectPayload(group.payload),
            settlementNote: input.note,
            settlementPayload: input.payload
          } as Prisma.InputJsonObject
        }
      });
      await signSensitiveAction(tx, {
        userId: requireUserId(context),
        organizationId: context.organizationId ?? recommendation.workspace.buyerOrgId,
        signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
        moduleKey: 'award-contract',
        actionKey: 'award_group.settle',
        entityType: 'award_group',
        entityRef: group.id,
        payload: {
          recommendationId: recommendation.id,
          awardGroupId: group.id,
          tenderId: recommendation.workspace.tenderId,
          winnerCount: winners.length,
          note: input.note
        }
      });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.group.settled', 'award_group', group.id, { note: input.note });
    });
    return this.getRecommendation(id, context);
  }

  async respondToNotice(id: string, input: AwardNoticeResponseInput, context: AwardContractRequestContext) {
    let contractId: string | null = null;
    await this.db.$transaction(async (tx) => {
      const notice = await tx.awardNotice.findUnique({
        where: { id },
        include: {
          recommendation: {
            include: {
              workspace: {
                include: {
                  tender: true
                }
              },
              bid: true
            }
          },
          contract: true
        }
      });
      if (!notice) throw requestError('Award notice was not found.', 404);
      assertSupplierNoticeAccess(notice, context);
      if (notice.status === AwardNoticeStatus.CANCELLED) throw requestError('Award notice has been cancelled.', 409);

      await tx.awardResponse.create({
        data: {
          noticeId: notice.id,
          actorUserId: context.userId ?? null,
          actorOrgId: context.organizationId ?? null,
          action: input.action,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });

      if (input.action === AwardResponseAction.ACCEPT) {
        const contract = notice.contract ?? await this.findOrCreateContractFromNotice(tx, notice);
        contractId = contract.id;
        await tx.awardNotice.update({
          where: { id: notice.id },
          data: {
            status: AwardNoticeStatus.ACCEPTED,
            supplierNote: input.note || null,
            respondedByUserId: context.userId ?? null,
            respondedAt: new Date(),
            contractId: contract.id
          }
        });
      } else {
        await tx.awardNotice.update({
          where: { id: notice.id },
          data: {
            status: input.action === AwardResponseAction.REQUEST_CLARIFICATION ? AwardNoticeStatus.CLARIFICATION_REQUESTED : AwardNoticeStatus.DECLINED,
            supplierNote: input.note || null,
            respondedByUserId: context.userId ?? null,
            respondedAt: new Date()
          }
        });
      }

      if (input.action === AwardResponseAction.ACCEPT || input.action === AwardResponseAction.DECLINE) {
        await signSensitiveAction(tx, {
          userId: requireUserId(context),
          organizationId: context.organizationId ?? notice.supplierOrgId,
          signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
          moduleKey: 'award-contract',
          actionKey: `award_notice.${input.action.toLowerCase()}`,
          entityType: 'award_notice',
          entityRef: notice.id,
          payload: {
            noticeId: notice.id,
            recommendationId: notice.recommendationId,
            supplierOrgId: notice.supplierOrgId,
            buyerOrgId: notice.buyerOrgId,
            action: input.action,
            contractId
          }
        });
      }

      await this.audit(tx, notice.supplierOrgId, context.userId, `award.notice.${input.action.toLowerCase()}`, 'award_notice', notice.id, {
        note: input.note,
        contractId
      });
    });

    return this.getRecommendationByNotice(id, context);
  }

  async cancelAwardNotice(id: string, input: AwardNoticeCancelInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const notice = await tx.awardNotice.findUnique({
        where: { id },
        include: {
          recommendation: {
            include: recommendationInclude
          }
        }
      });
      if (!notice) throw requestError('Award notice was not found.', 404);
      assertBuyerAccess(notice.recommendation, context);
      if (notice.status === AwardNoticeStatus.ACCEPTED) {
        throw requestError('Cancel the supplier handoff from contract negotiation when the award notice has already been accepted.', 409);
      }
      const now = new Date().toISOString();
      const currentPayload = objectPayload(notice.payload);
      const cancellationHistory = Array.isArray(currentPayload.cancellationHistory) ? currentPayload.cancellationHistory : [];
      await tx.awardNotice.update({
        where: { id },
        data: {
          status: AwardNoticeStatus.CANCELLED,
          buyerNote: input.reason,
          payload: {
            ...currentPayload,
            cancellationReason: input.reason,
            cancellationPayload: input.payload,
            cancellationHistory: [
              ...cancellationHistory,
              {
                reason: input.reason,
                payload: input.payload,
                cancelledAt: now,
                actorUserId: context.userId ?? null,
                actorOrgId: context.organizationId ?? null
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await tx.awardWinner.updateMany({
        where: { noticeId: notice.id },
        data: {
          status: AwardNoticeStatus.CANCELLED,
          payload: {
            cancellationReason: input.reason,
            cancelledAt: now
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, notice.buyerOrgId, context.userId, 'award.notice.cancelled', 'award_notice', notice.id, {
        reason: input.reason,
        supplierOrgId: notice.supplierOrgId,
        recommendationId: notice.recommendationId
      });
    });

    return this.getRecommendationByNotice(id, context);
  }

  async reissueAwardNotice(id: string, input: AwardNoticeReissueInput, context: AwardContractRequestContext) {
    let nextRecommendationId = '';
    await this.db.$transaction(async (tx) => {
      const currentNotice = await tx.awardNotice.findUnique({
        where: { id },
        include: {
          recommendation: {
            include: recommendationInclude
          }
        }
      });
      if (!currentNotice) throw requestError('Award notice was not found.', 404);
      assertBuyerAccess(currentNotice.recommendation, context);
      if (!currentNotice.recommendation.awardGroupId) throw requestError('Award ranking is not available for this notice.', 409);

      const winners = await tx.awardWinner.findMany({
        where: { awardGroupId: currentNotice.recommendation.awardGroupId },
        orderBy: { createdAt: 'asc' }
      });
      const candidate = winners.find((winner) => {
        if (!winner.recommendationId || winner.recommendationId === currentNotice.recommendationId) return false;
        if (input.supplierOrgId && winner.supplierOrgId !== input.supplierOrgId) return false;
        if (input.bidId && winner.bidId !== input.bidId) return false;
        if (!input.supplierOrgId && !input.bidId && (winner.status === 'CONTRACT_FORMED' || winner.status === AwardNoticeStatus.ACCEPTED)) return false;
        return true;
      });
      if (!candidate?.recommendationId || !candidate.supplierOrgId || !candidate.bidId) {
        throw requestError('No alternate ranked supplier is available for a new award notice.', 409);
      }

      const recommendation = await tx.awardRecommendation.findUnique({
        where: { id: candidate.recommendationId },
        include: recommendationInclude
      });
      if (!recommendation?.supplierOrgId || !recommendation.bidId) throw requestError('Selected ranked supplier is not ready for notice.', 409);
      nextRecommendationId = recommendation.id;

      const now = new Date().toISOString();
      await tx.awardNotice.update({
        where: { id: currentNotice.id },
        data: {
          status: AwardNoticeStatus.CANCELLED,
          buyerNote: currentNotice.buyerNote ?? input.reason,
          payload: {
            ...objectPayload(currentNotice.payload),
            reissuedToRecommendationId: recommendation.id,
            reissueReason: input.reason,
            reissuedAt: now
          } as Prisma.InputJsonObject
        }
      });
      await tx.awardWinner.updateMany({
        where: { noticeId: currentNotice.id },
        data: { status: AwardNoticeStatus.CANCELLED }
      });

      const notice = await tx.awardNotice.upsert({
        where: { recommendationId: recommendation.id },
        update: {
          status: AwardNoticeStatus.PENDING_RESPONSE,
          buyerNote: input.reason,
          issuedByUserId: context.userId ?? null,
          respondedByUserId: null,
          respondedAt: null,
          payload: {
            ...objectPayload(recommendation.notice?.payload),
            awardGroupId: currentNotice.recommendation.awardGroupId,
            reissuePayload: input.payload,
            reissueReason: input.reason,
            previousNoticeId: currentNotice.id
          } as Prisma.InputJsonObject
        },
        create: {
          reference: awardNoticeReference(),
          recommendationId: recommendation.id,
          buyerOrgId: recommendation.workspace.buyerOrgId,
          supplierOrgId: recommendation.supplierOrgId,
          buyerNote: input.reason,
          issuedByUserId: context.userId ?? null,
          payload: {
            tenderId: recommendation.workspace.tenderId,
            bidId: recommendation.bidId,
            awardGroupId: currentNotice.recommendation.awardGroupId,
            reissuePayload: input.payload,
            reissueReason: input.reason,
            previousNoticeId: currentNotice.id
          } as Prisma.InputJsonObject
        }
      });
      await tx.awardWinner.update({
        where: { id: candidate.id },
        data: {
          status: AwardNoticeStatus.PENDING_RESPONSE,
          noticeId: notice.id,
          payload: {
            ...objectPayload(candidate.payload),
            reissuedAt: now,
            reissueReason: input.reason
          } as Prisma.InputJsonObject
        }
      });
      await tx.awardRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: RecommendationStatus.APPROVED,
          reason: input.reason || recommendation.reason
        }
      });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.notice.reissued', 'award_notice', notice.id, {
        reason: input.reason,
        previousNoticeId: currentNotice.id,
        recommendationId: recommendation.id,
        supplierOrgId: recommendation.supplierOrgId
      });
    });

    return this.getRecommendation(nextRecommendationId, context);
  }

  async listContracts(query: ContractQuery, context: AwardContractRequestContext): Promise<ListContractsResponseDto> {
    const where = contractWhere(query, context);
    const [records, totalRecords] = await Promise.all([
      this.db.contract.findMany({
        where,
        include: contractInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.db.contract.count({ where })
    ]);
    return {
      contracts: records.map(contractListDto),
      page: query.page,
      pageSize: query.pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / query.pageSize))
    };
  }

  async prepareTenderContractDraft(tenderId: string, context: AwardContractRequestContext) {
    let contractId = '';
    await this.db.$transaction(async (tx) => {
      const tender = await tx.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          reference: true,
          title: true,
          type: true,
          status: true,
          buyerOrgId: true,
          budget: true,
          currency: true,
          contractType: true
        }
      });
      if (!tender) throw requestError('Tender was not found.', 404);
      if (!context.isAdmin && tender.buyerOrgId !== context.organizationId) throw requestError('Only the tender buyer can prepare the contract.', 403);
      const allowedStatuses: TenderStatus[] = [TenderStatus.PUBLISHED, TenderStatus.OPEN, TenderStatus.EVALUATION];
      if (!allowedStatuses.includes(tender.status)) {
        throw requestError('Contract preparation is available after the tender has been published or opened.', 409);
      }

      const existing = await tx.contract.findFirst({
        where: {
          tenderId,
          buyerOrgId: tender.buyerOrgId,
          awardId: null,
          supplierOrgId: null
        },
        orderBy: { createdAt: 'asc' }
      });
      if (existing) {
        contractId = existing.id;
        return;
      }

      const clauses = defaultContractClauses().map((clause) => ({
        ...clause,
        payload: {
          ...objectPayload(clause.payload),
          source: 'pre_award_contract_preparation'
        } as Prisma.InputJsonObject
      }));
      const contract = await tx.contract.create({
        data: {
          reference: contractReference(),
          tenderId: tender.id,
          buyerOrgId: tender.buyerOrgId,
          title: `Contract preparation for ${tender.title}`,
          status: ContractStatus.DRAFT,
          amount: null,
          currency: tender.currency,
          payload: {
            source: 'pre_award_contract_preparation',
            draft: {
              tender: {
                id: tender.id,
                reference: tender.reference,
                title: tender.title,
                procurementType: tender.type,
                contractType: tender.contractType
              },
              financials: {
                budget: decimalToNumber(tender.budget),
                currency: tender.currency
              },
              awardLocked: true,
              supplierLocked: true
            }
          } as Prisma.InputJsonObject,
          versions: {
            create: {
              versionNo: 1,
              payload: {
                source: 'pre_award_contract_preparation',
                generatedAt: new Date().toISOString(),
                tenderId: tender.id,
                tenderReference: tender.reference,
                clauseKeys: clauses.map((clause) => clause.clauseKey)
              } as Prisma.InputJsonObject
            }
          },
          parties: {
            create: {
              role: ContractPartyRole.BUYER,
              organizationId: tender.buyerOrgId,
              displayName: 'Buyer organization',
              payload: {}
            }
          },
          clauses: { createMany: { data: clauses } },
          requiredDocuments: {
            createMany: {
              data: defaultRequiredDocuments(String(tender.type)).map((document) => ({
                ...document,
                payload: { source: 'pre_award_contract_preparation' }
              }))
            }
          },
          approvalSteps: { createMany: { data: defaultWorkflowApprovals() } }
        }
      });
      contractId = contract.id;
      await this.audit(tx, tender.buyerOrgId, context.userId, 'contract.pre_award_draft.created', 'contract', contract.id, { tenderId: tender.id });
    });
    return contractId ? this.getContract(contractId, context) : null;
  }

  async getContract(id: string, context: AwardContractRequestContext): Promise<ContractDetailDto | null> {
    const record = await this.db.contract.findFirst({
      where: andWhere([{ id }, contractScope(context)]),
      include: contractInclude
    });
    if (!record) return null;
    const [
      audit,
      goodsInspections,
      threeWayMatches,
      paymentApprovals,
      paymentConfirmations,
      commencements,
      nonConformances,
      securities,
      penalties,
      changeRequests,
      referenceSamples,
      riskForecasts,
      performanceScores,
      supplierRiskProfile
    ] = await Promise.all([
      this.db.auditEvent.findMany({
        where: { entityType: 'contract', entityRef: record.id },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.db.goodsInspection.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.threeWayMatchResult.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.paymentApproval.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.paymentConfirmation.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.contractCommencement.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.contractNonConformance.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.contractSecurity.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.contractPenalty.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.contractChangeRequest.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.contractReferenceSample.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.riskForecast.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      this.db.performanceScore.findMany({ where: { contractId: record.id }, orderBy: { createdAt: 'desc' } }),
      record.supplierOrgId ? this.db.supplierRiskProfile.findUnique({ where: { supplierOrgId: record.supplierOrgId } }) : Promise.resolve(null)
    ]);
    return {
      ...contractDetailDto(record, audit, context),
      goodsInspections: goodsInspections.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      threeWayMatches: threeWayMatches.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      paymentApprovals: paymentApprovals.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      paymentConfirmations: paymentConfirmations.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      commencements: commencements.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      nonConformances: nonConformances.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      securities: securities.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      penalties: penalties.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      changeRequests: changeRequests.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      referenceSamples: referenceSamples.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      riskForecasts: riskForecasts.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      performanceScores: performanceScores.map((item) => workflowRecordDto(item as unknown as Record<string, unknown>)),
      supplierRiskProfile: supplierRiskProfile ? workflowRecordDto(supplierRiskProfile as unknown as Record<string, unknown>) : null
    };
  }

  async contractDocuments(contractId: string, context: AwardContractRequestContext): Promise<AwardContractDocumentDto[]> {
    const contract = await this.requireContract(this.db, contractId, context);
    const sourceLabels = new Map<string, string>();
    const [
      versions,
      milestoneEvidence,
      paymentConfirmations,
      terminationEvidence,
      securities,
      requiredDocuments,
      uploadedDocuments
    ] = await Promise.all([
      this.db.contractVersion.findMany({ where: { contractId, documentId: { not: null } }, select: { documentId: true } }),
      this.db.contractMilestoneEvidence.findMany({ where: { milestone: { contractId } }, select: { documentId: true } }),
      this.db.paymentConfirmation.findMany({ where: { contractId, evidenceDocumentId: { not: null } }, select: { evidenceDocumentId: true } }),
      this.db.terminationEvidence.findMany({ where: { termination: { contractId }, documentId: { not: null } }, select: { documentId: true } }),
      this.db.contractSecurity.findMany({ where: { contractId, documentId: { not: null } }, select: { documentId: true } }),
      this.db.contractRequiredDocument.findMany({ where: { contractId, documentId: { not: null } }, select: { documentId: true } }),
      this.db.documentObject.findMany({
        where: {
          AND: [
            { metadata: { path: ['sourceModule'], equals: 'award-contract' } },
            { metadata: { path: ['contractId'], equals: contractId } },
            documentVisibilityWhere(context)
          ]
        },
        orderBy: { createdAt: 'desc' },
        select: documentSelect
      })
    ]);

    for (const row of versions) if (row.documentId) sourceLabels.set(row.documentId, 'Contract version');
    for (const row of milestoneEvidence) sourceLabels.set(row.documentId, 'Milestone evidence');
    for (const row of paymentConfirmations) if (row.evidenceDocumentId) sourceLabels.set(row.evidenceDocumentId, 'Payment confirmation');
    for (const row of terminationEvidence) if (row.documentId) sourceLabels.set(row.documentId, 'Termination evidence');
    for (const row of securities) if (row.documentId) sourceLabels.set(row.documentId, 'Security or guarantee');
    for (const row of requiredDocuments) if (row.documentId) sourceLabels.set(row.documentId, 'Required document');
    for (const row of uploadedDocuments) sourceLabels.set(row.id, sourceLabels.get(row.id) ?? 'Uploaded evidence');

    const documentIds = Array.from(sourceLabels.keys());
    const linkedDocuments = documentIds.length
      ? await this.db.documentObject.findMany({
          where: { id: { in: documentIds } },
          orderBy: { createdAt: 'desc' },
          select: documentSelect
        })
      : [];
    const byId = new Map([...uploadedDocuments, ...linkedDocuments].map((document) => [document.id, document]));

    return Array.from(byId.values())
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((document) => contractDocumentDto(document, sourceLabels.get(document.id) ?? contract.reference));
  }

  async uploadContractDocument(contractId: string, input: AwardContractDocumentUploadInput, context: AwardContractRequestContext): Promise<AwardContractDocumentDto> {
    const contract = await this.requireContract(this.db, contractId, context);
    const content = input.contentBase64 ? Buffer.from(input.contentBase64, 'base64') : null;
    const document = await this.db.documentObject.create({
      data: {
        ownerOrgId: context.organizationId ?? contract.buyerOrgId,
        uploadedByUserId: context.userId ?? null,
        name: input.name,
        objectKey: `award-contract/${contract.id}/${randomUUID()}/${safeObjectName(input.name)}`,
        documentType: input.documentType ?? input.mimeType ?? 'POST_AWARD_EVIDENCE',
        checksum: content ? createHash('sha256').update(content).digest('hex') : null,
        metadata: {
          sourceModule: 'award-contract',
          sourceEntityType: 'contract',
          sourceEntityId: contract.id,
          contractId: contract.id,
          contractReference: contract.reference,
          mimeType: input.mimeType ?? null,
          size: input.size ?? content?.byteLength ?? null,
          contentBase64: input.contentBase64 ?? null
        } as Prisma.InputJsonObject
      },
      select: documentSelect
    });
    await this.audit(this.db, contract.buyerOrgId, context.userId, 'contract.document.uploaded', 'contract', contract.id, { documentId: document.id });
    return contractDocumentDto(document, 'Uploaded evidence');
  }

  async createContractVersion(id: string, input: ContractVersionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id }, include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } } });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      const versionNo = (contract.versions[0]?.versionNo ?? 0) + 1;
      await tx.contractVersion.create({
        data: {
          contractId: contract.id,
          versionNo,
          documentId: input.documentId,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.version.created', 'contract', contract.id, { versionNo });
    });
    return this.getContract(id, context);
  }

  async sendContractForNegotiation(id: string, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { versionNo: 'desc' }, take: 1 },
          awardNotice: true
        }
      });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      if (!contract.awardId || !contract.supplierOrgId) throw requestError('Send to negotiation after award notice acceptance and supplier linking.', 409);
      if (contract.awardNotice?.status !== AwardNoticeStatus.ACCEPTED) throw requestError('Supplier must accept the award notice before contract negotiation starts.', 409);
      if (contract.versions.length === 0) throw requestError('Generate or save a contract draft version before sending to negotiation.', 409);

      await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.NEGOTIATION,
          payload: {
            ...objectPayload(contract.payload),
            redraftRequired: false,
            sentForNegotiationAt: new Date().toISOString(),
            sentVersionNo: contract.versions[0]?.versionNo ?? null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.sent_for_negotiation', 'contract', contract.id, {
        versionNo: contract.versions[0]?.versionNo ?? null
      });
    });
    return this.getContract(id, context);
  }

  async createSignatureRequests(id: string, input: ContractSignatureRequestInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id },
        include: {
          negotiations: true,
          acceptances: true,
          approvalSteps: true
        }
      });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      assertAwardLinkedContract(contract);
      assertFinalDraftReadyForSignatures(contract);

      for (const role of input.roles) {
        const signerOrgId = role === ContractPartyRole.BUYER ? contract.buyerOrgId : contract.supplierOrgId;
        if (!signerOrgId) continue;
        await tx.contractSignature.upsert({
          where: {
            contractId_signerOrgId_role: {
              contractId: contract.id,
              signerOrgId,
              role
            }
          },
          update: {
            status: SignatureStatus.PENDING,
            declinedAt: null
          },
          create: {
            contractId: contract.id,
            signerOrgId,
            role
          }
        });
      }

      await tx.contract.update({ where: { id: contract.id }, data: { status: ContractStatus.SIGNATURE_PENDING } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.signatures.requested', 'contract', contract.id, { roles: input.roles });
    });
    return this.getContract(id, context);
  }

  async signContractSignature(contractId: string, signatureId: string, input: ContractSignatureSignInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const signature = await tx.contractSignature.findUnique({
        where: { id: signatureId },
        include: { contract: true }
      });
      if (!signature || signature.contractId !== contractId) throw requestError('Contract signature was not found.', 404);
      assertContractVisible(signature.contract, context);
      if (!context.isAdmin && signature.signerOrgId !== context.organizationId) throw requestError('Signature is assigned to another organization.', 403);
      if (signature.status === SignatureStatus.SIGNED) return;
      if (signature.status !== SignatureStatus.PENDING) throw requestError('Only pending signature requests can be signed.', 409);
      if (signature.role === ContractPartyRole.SUPPLIER) {
        const buyerSigned = await tx.contractSignature.count({
          where: {
            contractId,
            role: ContractPartyRole.BUYER,
            status: SignatureStatus.SIGNED
          }
        });
        if (buyerSigned === 0) throw requestError('Buyer signature must be completed before supplier signature.', 409);
      }
      if (!context.userId) throw requestError('Authenticated signer is required.', 403);

      const signingCredential = await tx.signingCredential.findFirst({
        where: { userId: context.userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      if (!signingCredential) throw requestError('Create a digital signature keyphrase before signing contracts.', 409);

      const signedAt = new Date();
      const canonicalPayload = {
        contractId,
        signatureId,
        signerOrgId: signature.signerOrgId,
        signerUserId: context.userId ?? null,
        role: signature.role,
        signerName: input.signerName,
        signerTitle: input.signerTitle,
        payload: input.payload,
        signedAt: signedAt.toISOString()
      };
      const canonicalPayloadHash = sha256(canonicalJson(canonicalPayload));
      const signed = await signCanonicalPayloadHash(signingCredential, input.signatureKeyphrase, canonicalPayloadHash);

      await tx.contractSignature.update({
        where: { id: signature.id },
        data: {
          status: SignatureStatus.SIGNED,
          signerUserId: context.userId ?? null,
          signerName: input.signerName,
          signerTitle: input.signerTitle || null,
          canonicalPayloadHash,
          signatureHash: signed.signatureHash,
          signedAt,
          declinedAt: null,
          payload: input.payload as Prisma.InputJsonObject,
          providerMetadata: {
            ...signed.providerMetadata,
            signatureCredentialId: signingCredential.id
          } as Prisma.InputJsonObject
        }
      });

      const pending = await tx.contractSignature.count({
        where: {
          contractId,
          status: { not: SignatureStatus.SIGNED }
        }
      });
      if (pending === 0) await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.SIGNED } });
      await this.audit(tx, signature.contract.buyerOrgId, context.userId, 'contract.signature.signed', 'contract', contractId, {
        signatureId: signature.id,
        role: signature.role
      });
    });
    return this.getContract(contractId, context);
  }

  async createMilestone(contractId: string, input: ContractMilestoneInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId } });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      await tx.contractMilestone.create({
        data: {
          contractId,
          title: input.title,
          description: input.description || null,
          dueDate: toDate(input.dueDate),
          amount: input.amount,
          currency: input.currency,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.milestone.created', 'contract', contract.id, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async updateMilestone(contractId: string, milestoneId: string, input: ContractMilestonePatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const milestone = await tx.contractMilestone.findUnique({ where: { id: milestoneId }, include: { contract: true } });
      if (!milestone || milestone.contractId !== contractId) throw requestError('Contract milestone was not found.', 404);
      assertContractVisible(milestone.contract, context);
      assertContractManager(milestone.contract, context);
      await tx.contractMilestone.update({
        where: { id: milestone.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) ?? null } : {}),
          ...(input.completedAt !== undefined ? { completedAt: new Date(input.completedAt) } : {}),
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonObject } : {}),
          ...(input.status === ContractMilestoneStatus.COMPLETED && input.completedAt === undefined ? { completedAt: new Date() } : {})
        }
      });
      await this.audit(tx, milestone.contract.buyerOrgId, context.userId, 'contract.milestone.updated', 'contract', contractId, { milestoneId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async addMilestoneEvidence(contractId: string, milestoneId: string, input: ContractMilestoneEvidenceInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const milestone = await tx.contractMilestone.findUnique({ where: { id: milestoneId }, include: { contract: true } });
      if (!milestone || milestone.contractId !== contractId) throw requestError('Contract milestone was not found.', 404);
      assertContractVisible(milestone.contract, context);
      await this.assertDocumentVisible(tx, input.documentId, context);
      await tx.contractMilestoneEvidence.upsert({
        where: {
          milestoneId_documentId: {
            milestoneId,
            documentId: input.documentId
          }
        },
        update: {
          note: input.note || null,
          uploadedByUserId: context.userId ?? null,
          uploaderOrgId: context.organizationId ?? null
        },
        create: {
          milestoneId,
          documentId: input.documentId,
          uploadedByUserId: context.userId ?? null,
          uploaderOrgId: context.organizationId ?? null,
          note: input.note || null
        }
      });
      await this.audit(tx, milestone.contract.buyerOrgId, context.userId, 'contract.milestone.evidence_added', 'contract', contractId, { milestoneId, documentId: input.documentId });
    });
    return this.getContract(contractId, context);
  }

  async updateContractStatus(contractId: string, input: ContractStatusPatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId }, include: contractInclude });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      this.assertStatusTransition(contract.status, input.status);
      const awardLinkedStatuses: ContractStatus[] = [ContractStatus.SIGNATURE_PENDING, ContractStatus.SIGNED, ContractStatus.PENDING_ACTIVATION, ContractStatus.MOBILIZATION, ContractStatus.ACTIVE];
      if (awardLinkedStatuses.includes(input.status)) {
        assertAwardLinkedContract(contract);
      }
      if (input.status === ContractStatus.SIGNATURE_PENDING) {
        assertFinalDraftReadyForSignatures(contract);
      }
      let activationAwareContract = contract;
      if (input.status === ContractStatus.PENDING_ACTIVATION || input.status === ContractStatus.ACTIVE) {
        await this.ensureActivation(tx, contract);
        activationAwareContract = await tx.contract.findUnique({ where: { id: contractId }, include: contractInclude }) ?? contract;
      }
      if (input.status === ContractStatus.ACTIVE) {
        this.assertActivationReady(activationAwareContract);
        const blockingSecurityCount = await tx.contractSecurity.count({
          where: {
            contractId: contract.id,
            verificationStatus: { notIn: ['APPROVED', 'VERIFIED', 'RELEASED', 'WAIVED'] }
          }
        });
        if (blockingSecurityCount > 0) throw requestError('Required securities and guarantees must be approved before activation.', 409);
      }
      await tx.contract.update({ where: { id: contract.id }, data: { status: input.status } });
      if (input.status === ContractStatus.TERMINATION_REVIEW) {
        await tx.invoice.updateMany({
          where: {
            contractId: contract.id,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SUBMITTED, InvoiceStatus.REVIEW, InvoiceStatus.MATCHED] }
          },
          data: {
            status: InvoiceStatus.BLOCKED,
            payload: {
              reason: 'Payment on hold - termination review',
              note: input.note
            } as Prisma.InputJsonObject
          }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.status.updated', 'contract', contract.id, {
        from: contract.status,
        to: input.status,
        note: input.note
      });
    });
    return this.getContract(contractId, context);
  }

  async submitActivationItem(contractId: string, itemId: string, input: ContractActivationItemSubmitInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractActivationItem.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Activation checklist item was not found.', 404);
      assertContractVisible(item.contract, context);
      this.assertActivationItemOwner(item.ownerRole, item.contract, context);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      await tx.contractActivationItem.update({
        where: { id: item.id },
        data: {
          status: ContractLifecycleItemStatus.SUBMITTED,
          documentId: input.documentId || item.documentId,
          submittedByOrgId: context.organizationId ?? null,
          submittedAt: new Date(),
          note: input.note ?? item.note,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.refreshActivationReadiness(tx, contractId);
      await this.audit(tx, item.contract.buyerOrgId, context.userId, 'contract.activation_item.submitted', 'contract', contractId, {
        itemId: item.id,
        title: item.title
      });
    });
    return this.getContract(contractId, context);
  }

  async reviewActivationItem(contractId: string, itemId: string, input: ContractActivationItemReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractActivationItem.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Activation checklist item was not found.', 404);
      assertContractVisible(item.contract, context);
      assertContractManager(item.contract, context);
      const allowedReviewStatuses: ContractLifecycleItemStatus[] = [
        ContractLifecycleItemStatus.APPROVED,
        ContractLifecycleItemStatus.REJECTED,
        ContractLifecycleItemStatus.WAIVED,
        ContractLifecycleItemStatus.CLOSED
      ];
      if (!allowedReviewStatuses.includes(input.status)) {
        throw requestError('Activation review status must be approved, rejected, waived, or closed.', 400);
      }
      await tx.contractActivationItem.update({
        where: { id: item.id },
        data: {
          status: input.status,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          note: input.note ?? item.note,
          payload: {
            ...objectPayload(item.payload),
            ...input.payload
          } as Prisma.InputJsonObject
        }
      });
      await this.refreshActivationReadiness(tx, contractId);
      await this.audit(tx, item.contract.buyerOrgId, context.userId, 'contract.activation_item.reviewed', 'contract', contractId, {
        itemId: item.id,
        title: item.title,
        status: input.status
      });
    });
    return this.getContract(contractId, context);
  }

  async activateContract(contractId: string, input: ContractActivateInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId }, include: contractInclude });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      const activatableStatuses: ContractStatus[] = [ContractStatus.SIGNED, ContractStatus.PENDING_ACTIVATION, ContractStatus.MOBILIZATION];
      if (!activatableStatuses.includes(contract.status)) {
        throw requestError('Only signed, pending activation, or mobilization contracts can be activated.', 409);
      }
      await this.ensureActivation(tx, contract);
      const refreshed = await tx.contract.findUnique({ where: { id: contractId }, include: contractInclude });
      if (!refreshed) throw requestError('Contract was not found.', 404);
      if (contract.status === ContractStatus.SIGNED) this.assertStatusTransition(ContractStatus.SIGNED, ContractStatus.PENDING_ACTIVATION);
      this.assertStatusTransition(contract.status === ContractStatus.SIGNED ? ContractStatus.PENDING_ACTIVATION : contract.status, ContractStatus.ACTIVE);
      this.assertActivationReady(refreshed);
      const blockingSecurityCount = await tx.contractSecurity.count({
        where: {
          contractId: contract.id,
          verificationStatus: { notIn: ['APPROVED', 'VERIFIED', 'RELEASED', 'WAIVED'] }
        }
      });
      if (blockingSecurityCount > 0) throw requestError('Required securities and guarantees must be approved before activation.', 409);
      await tx.contract.update({ where: { id: contract.id }, data: { status: ContractStatus.ACTIVE } });
      await tx.contractActivation.update({
        where: { contractId },
        data: {
          status: 'ACTIVE',
          readyForActivation: true,
          activatedAt: new Date(),
          activatedByUserId: context.userId ?? null,
          note: input.note ?? null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.activated', 'contract', contract.id, {
        from: contract.status,
        to: ContractStatus.ACTIVE,
        note: input.note
      });
    });
    return this.getContract(contractId, context);
  }

  async createObligation(contractId: string, input: ContractObligationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractObligation.create({
        data: {
          contractId,
          obligationType: input.obligationType || 'GENERAL',
          title: input.title,
          description: input.description || null,
          ownerRole: input.ownerRole,
          relatedMilestoneId: input.relatedMilestoneId || null,
          status: input.status || ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate),
          amount: input.amount === undefined ? null : input.amount,
          currency: input.currency || contract.currency,
          acceptanceMethod: input.acceptanceMethod || null,
          acceptanceCriteria: input.acceptanceCriteria || null,
          paymentEligible: input.paymentEligible ?? false,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.obligation.created', 'contract', contractId, { title: input.title, ownerRole: input.ownerRole });
    });
    return this.getContract(contractId, context);
  }

  async createEvidenceRequirement(contractId: string, input: ContractEvidenceRequirementInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      await tx.contractEvidenceRequirement.create({
        data: {
          contractId,
          obligationId: input.obligationId || null,
          milestoneId: input.milestoneId || null,
          title: input.title,
          evidenceType: input.evidenceType || 'DOCUMENT',
          ownerRole: input.ownerRole,
          mandatory: input.mandatory ?? true,
          status: input.status || ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate),
          documentId: input.documentId || null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.evidence_requirement.created', 'contract', contractId, { title: input.title, ownerRole: input.ownerRole });
    });
    return this.getContract(contractId, context);
  }

  async createDeliverySchedule(contractId: string, input: ContractDeliveryScheduleInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractDeliverySchedule.create({
        data: {
          contractId,
          obligationId: input.obligationId || null,
          lineReference: input.lineReference || null,
          description: input.description,
          plannedQuantity: input.plannedQuantity ?? null,
          unit: input.unit || null,
          deliveryLocation: input.deliveryLocation || null,
          plannedDeliveryDate: toDate(input.plannedDeliveryDate),
          status: input.status || ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.delivery_schedule.created', 'contract', contractId, { description: input.description });
    });
    return this.getContract(contractId, context);
  }

  async createDispatchNotice(contractId: string, input: ContractDispatchNoticeInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      const scheduleId = input.scheduleId || payloadString(input.payload, 'scheduleId');
      const manualExceptionApproved = payloadBoolean(input.payload, 'manualExceptionApproved');
      if (!scheduleId && !manualExceptionApproved) {
        throw requestError('Dispatch notice requires an approved delivery schedule.', 409);
      }
      if (scheduleId) {
        const schedule = await tx.contractDeliverySchedule.findFirst({ where: { id: scheduleId, contractId } });
        if (!schedule) throw requestError('Delivery schedule was not found for this contract.', 404);
      }
      await tx.contractDispatchNotice.create({
        data: {
          contractId,
          scheduleId: scheduleId || null,
          dispatchReference: input.dispatchReference || executionReference('DSP'),
          carrier: input.carrier || null,
          trackingReference: input.trackingReference || null,
          dispatchedQuantity: input.dispatchedQuantity ?? null,
          expectedArrivalDate: toDate(input.expectedArrivalDate),
          status: input.status || 'DISPATCHED',
          submittedByOrgId: context.organizationId ?? null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.dispatch_notice.created', 'contract', contractId, { scheduleId });
    });
    return this.getContract(contractId, context);
  }

  async createGoodsReceipt(contractId: string, input: ContractGoodsReceiptInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const dispatchNoticeId = input.dispatchNoticeId || payloadString(input.payload, 'dispatchNoticeId');
      const manualExceptionApproved = payloadBoolean(input.payload, 'manualExceptionApproved');
      if (!dispatchNoticeId && !manualExceptionApproved) {
        throw requestError('Goods receipt requires a submitted dispatch notice.', 409);
      }
      if (dispatchNoticeId) {
        const dispatchNotice = await tx.contractDispatchNotice.findFirst({ where: { id: dispatchNoticeId, contractId } });
        if (!dispatchNotice) throw requestError('Dispatch notice was not found for this contract.', 404);
      }
      const scheduleIds = [...new Set((input.lines ?? []).map((line) => line.scheduleId).filter(Boolean) as string[])];
      if (scheduleIds.length) {
        const existingSchedules = await tx.contractDeliverySchedule.count({ where: { id: { in: scheduleIds }, contractId } });
        if (existingSchedules !== scheduleIds.length) throw requestError('One or more receipt lines reference a delivery schedule outside this contract.', 409);
      }
      await tx.contractGoodsReceipt.create({
        data: {
          contractId,
          dispatchNoticeId: dispatchNoticeId || null,
          receiptReference: input.receiptReference || executionReference('GRN'),
          receivedAt: toDateTime(input.receivedAt) ?? new Date(),
          receivedByUserId: context.userId ?? null,
          location: input.location || null,
          conditionAtReceipt: input.conditionAtReceipt || null,
          status: input.status || ContractLifecycleItemStatus.OPEN,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject,
          lines: input.lines?.length
            ? {
                createMany: {
                  data: input.lines.map((line) => ({
                    scheduleId: line.scheduleId || null,
                    description: line.description,
                    orderedQuantity: line.orderedQuantity ?? null,
                    receivedQuantity: line.receivedQuantity ?? null,
                    acceptedQuantity: line.acceptedQuantity ?? null,
                    rejectedQuantity: line.rejectedQuantity ?? null,
                    unit: line.unit || null,
                    note: line.note || null,
                    payload: (line.payload ?? {}) as Prisma.InputJsonObject
                  }))
                }
              }
            : undefined
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.goods_receipt.created', 'contract', contractId, { dispatchNoticeId });
    });
    return this.getContract(contractId, context);
  }

  async createSiteHandover(contractId: string, input: ContractSiteHandoverInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractSiteHandover.create({
        data: {
          contractId,
          handoverReference: input.handoverReference || executionReference('SITE'),
          handoverDate: toDate(input.handoverDate) ?? new Date(),
          location: input.location || null,
          handedOverBy: input.handedOverBy || null,
          receivedBy: input.receivedBy || null,
          constraints: input.constraints || null,
          status: input.status || 'HANDED_OVER',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.site_handover.created', 'contract', contractId, { location: input.location });
    });
    return this.getContract(contractId, context);
  }

  async createWorksProgressReport(contractId: string, input: ContractWorksProgressReportInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      const [siteHandoverCount, openMobilization] = await Promise.all([
        tx.contractSiteHandover.count({ where: { contractId, status: { not: 'CANCELLED' } } }),
        tx.contractMobilizationItem.findMany({
          where: {
            contractId,
            required: true,
            status: {
              notIn: [
                ContractLifecycleItemStatus.APPROVED,
                ContractLifecycleItemStatus.CLOSED,
                ContractLifecycleItemStatus.WAIVED
              ]
            }
          },
          select: { title: true }
        })
      ]);
      if (siteHandoverCount === 0) throw requestError('Works progress cannot be submitted before site handover.', 409);
      if (openMobilization.length > 0) {
        throw requestError(`Works progress is blocked until required mobilization items are cleared: ${openMobilization.map((item) => item.title).join(', ')}`, 409);
      }
      await tx.contractWorksProgressReport.create({
        data: {
          contractId,
          reportReference: input.reportReference || executionReference('WPR'),
          periodStart: toDate(input.periodStart),
          periodEnd: toDate(input.periodEnd),
          progressPercent: input.progressPercent ?? null,
          programmeReference: input.programmeReference || null,
          narrative: input.narrative || null,
          submittedByOrgId: context.organizationId ?? null,
          status: input.status || 'SUBMITTED',
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.works_progress_report.created', 'contract', contractId, { progressPercent: input.progressPercent });
    });
    return this.getContract(contractId, context);
  }

  async reviewWorksProgressReport(contractId: string, reportId: string, input: WorksProgressReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const report = await tx.contractWorksProgressReport.findFirst({ where: { id: reportId, contractId } });
      if (!report) throw requestError('Works progress report was not found.', 404);
      const reviewHistory: unknown[] = Array.isArray(objectPayload(report.payload).reviewHistory) ? objectPayload(report.payload).reviewHistory as unknown[] : [];
      await tx.contractWorksProgressReport.update({
        where: { id: report.id },
        data: {
          status: input.status.toUpperCase(),
          progressPercent: input.progressPercent ?? report.progressPercent,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          payload: {
            ...objectPayload(report.payload),
            reviewNote: input.note || null,
            reviewPayload: input.payload,
            reviewHistory: [
              ...reviewHistory,
              {
                status: input.status.toUpperCase(),
                note: input.note || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                reviewedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.works_progress_report.reviewed', 'contract', contractId, { reportId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async createBoqMeasurement(contractId: string, input: ContractBoqMeasurementInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const progressWhere = input.reportId
        ? { id: input.reportId, contractId, status: { in: ['APPROVED', 'VERIFIED', 'ACCEPTED', 'CERTIFIED', 'CLOSED'] } }
        : { contractId, status: { in: ['APPROVED', 'VERIFIED', 'ACCEPTED', 'CERTIFIED', 'CLOSED'] } };
      const approvedProgress = await tx.contractWorksProgressReport.findFirst({ where: progressWhere, orderBy: { createdAt: 'desc' } });
      if (!approvedProgress) throw requestError('BOQ measurement requires an approved works progress report.', 409);
      const calculatedAmount = input.amount ?? (
        input.currentQuantity !== undefined && input.unitRate !== undefined
          ? input.currentQuantity * input.unitRate
          : undefined
      );
      const status = (input.status || 'MEASURED').toUpperCase();
      const certifiedQuantity = input.certifiedQuantity ?? (['APPROVED', 'CERTIFIED'].includes(status) ? input.currentQuantity : undefined);
      const certifiedAmount = input.certifiedAmount ?? (['APPROVED', 'CERTIFIED'].includes(status) ? calculatedAmount : undefined);
      await tx.contractBoqMeasurement.create({
        data: {
          contractId,
          reportId: approvedProgress.id,
          measurementReference: input.measurementReference || executionReference('BOQ'),
          boqItemReference: input.boqItemReference,
          description: input.description || null,
          previousQuantity: input.previousQuantity ?? null,
          currentQuantity: input.currentQuantity ?? null,
          cumulativeQuantity: input.cumulativeQuantity ?? null,
          unitRate: input.unitRate ?? null,
          amount: calculatedAmount ?? null,
          certifiedQuantity: certifiedQuantity ?? null,
          certifiedAmount: certifiedAmount ?? null,
          status,
          reviewedByUserId: ['APPROVED', 'CERTIFIED'].includes(status) ? context.userId ?? null : null,
          reviewedAt: ['APPROVED', 'CERTIFIED'].includes(status) ? new Date() : null,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.boq_measurement.created', 'contract', contractId, { boqItemReference: input.boqItemReference });
    });
    return this.getContract(contractId, context);
  }

  async reviewBoqMeasurement(contractId: string, measurementId: string, input: BoqMeasurementReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const measurement = await tx.contractBoqMeasurement.findFirst({ where: { id: measurementId, contractId } });
      if (!measurement) throw requestError('BOQ measurement was not found.', 404);
      const status = input.status.toUpperCase();
      const certifiedQuantity = input.certifiedQuantity ?? decimalToNumber(measurement.certifiedQuantity) ?? decimalToNumber(measurement.currentQuantity) ?? undefined;
      const unitRate = decimalToNumber(measurement.unitRate);
      const certifiedAmount = input.certifiedAmount ?? (
        certifiedQuantity !== undefined && unitRate !== null
          ? certifiedQuantity * unitRate
          : decimalToNumber(measurement.certifiedAmount) ?? decimalToNumber(measurement.amount) ?? undefined
      );
      const reviewHistory: unknown[] = Array.isArray(objectPayload(measurement.payload).reviewHistory) ? objectPayload(measurement.payload).reviewHistory as unknown[] : [];
      await tx.contractBoqMeasurement.update({
        where: { id: measurement.id },
        data: {
          status,
          certifiedQuantity: certifiedQuantity ?? null,
          certifiedAmount: certifiedAmount ?? null,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          payload: {
            ...objectPayload(measurement.payload),
            reviewNote: input.note || null,
            reviewPayload: input.payload,
            reviewHistory: [
              ...reviewHistory,
              {
                status,
                note: input.note || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                reviewedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.boq_measurement.reviewed', 'contract', contractId, { measurementId, status });
    });
    return this.getContract(contractId, context);
  }

  async createInterimPaymentCertificate(contractId: string, input: ContractInterimPaymentCertificateInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const measurement = await tx.contractBoqMeasurement.findFirst({
        where: input.measurementId
          ? { id: input.measurementId, contractId, status: { in: ['APPROVED', 'CERTIFIED', 'CLOSED'] } }
          : { contractId, status: { in: ['APPROVED', 'CERTIFIED', 'CLOSED'] } },
        orderBy: { createdAt: 'desc' }
      });
      if (!measurement) throw requestError('Interim payment certificate requires an approved BOQ measurement.', 409);
      const grossAmount = input.grossAmount ?? input.certifiedAmount ?? decimalToNumber(measurement.certifiedAmount) ?? decimalToNumber(measurement.amount) ?? undefined;
      const specificDeductions =
        (input.retentionAmount ?? 0) +
        (input.advanceRecoveryAmount ?? 0) +
        (input.liquidatedDamagesAmount ?? 0) +
        (input.taxWithholdingAmount ?? 0) +
        (input.otherDeductionsAmount ?? 0);
      const deductionsAmount = input.deductionsAmount ?? specificDeductions;
      const netAmount = input.netAmount ?? (grossAmount !== undefined ? Math.max(grossAmount - deductionsAmount, 0) : undefined);
      const status = (input.status || 'DRAFT').toUpperCase();
      const certified = ['APPROVED', 'CERTIFIED'].includes(status);
      await tx.contractInterimPaymentCertificate.create({
        data: {
          contractId,
          measurementId: measurement.id,
          certificateNumber: input.certificateNumber || executionReference('IPC'),
          certificateType: (input.certificateType || 'INTERIM').toUpperCase(),
          periodStart: toDate(input.periodStart),
          periodEnd: toDate(input.periodEnd),
          grossAmount: grossAmount ?? null,
          deductionsAmount: deductionsAmount || null,
          retentionAmount: input.retentionAmount ?? null,
          advanceRecoveryAmount: input.advanceRecoveryAmount ?? null,
          liquidatedDamagesAmount: input.liquidatedDamagesAmount ?? null,
          taxWithholdingAmount: input.taxWithholdingAmount ?? null,
          otherDeductionsAmount: input.otherDeductionsAmount ?? null,
          certifiedAmount: input.certifiedAmount ?? grossAmount ?? null,
          netAmount: netAmount ?? null,
          currency: input.currency || contract.currency,
          status,
          approvedAt: certified ? toDateTime(input.approvedAt) ?? new Date() : toDateTime(input.approvedAt),
          reviewedByUserId: certified ? context.userId ?? null : null,
          reviewedAt: certified ? new Date() : null,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.ipc.created', 'contract', contractId, { certificateNumber: input.certificateNumber });
    });
    return this.getContract(contractId, context);
  }

  async certifyInterimPaymentCertificate(contractId: string, ipcId: string, input: InterimPaymentCertificateCertifyInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const certificate = await tx.contractInterimPaymentCertificate.findFirst({ where: { id: ipcId, contractId } });
      if (!certificate) throw requestError('Interim payment certificate was not found.', 404);
      if (certificate.measurementId) {
        const measurement = await tx.contractBoqMeasurement.findFirst({ where: { id: certificate.measurementId, contractId, status: { in: ['APPROVED', 'CERTIFIED', 'CLOSED'] } } });
        if (!measurement) throw requestError('IPC cannot be certified until the linked BOQ measurement is approved.', 409);
      }
      const grossAmount = input.grossAmount ?? decimalToNumber(certificate.grossAmount) ?? decimalToNumber(certificate.certifiedAmount) ?? undefined;
      const retentionAmount = input.retentionAmount ?? decimalToNumber(certificate.retentionAmount) ?? 0;
      const advanceRecoveryAmount = input.advanceRecoveryAmount ?? decimalToNumber(certificate.advanceRecoveryAmount) ?? 0;
      const liquidatedDamagesAmount = input.liquidatedDamagesAmount ?? decimalToNumber(certificate.liquidatedDamagesAmount) ?? 0;
      const taxWithholdingAmount = input.taxWithholdingAmount ?? decimalToNumber(certificate.taxWithholdingAmount) ?? 0;
      const otherDeductionsAmount = input.otherDeductionsAmount ?? decimalToNumber(certificate.otherDeductionsAmount) ?? 0;
      const deductionsAmount = input.deductionsAmount ?? retentionAmount + advanceRecoveryAmount + liquidatedDamagesAmount + taxWithholdingAmount + otherDeductionsAmount;
      const certifiedAmount = input.certifiedAmount ?? grossAmount ?? decimalToNumber(certificate.certifiedAmount) ?? undefined;
      const netAmount = input.netAmount ?? (grossAmount !== undefined ? Math.max(grossAmount - deductionsAmount, 0) : decimalToNumber(certificate.netAmount) ?? undefined);
      const status = input.status.toUpperCase();
      const certificationHistory: unknown[] = Array.isArray(objectPayload(certificate.payload).certificationHistory) ? objectPayload(certificate.payload).certificationHistory as unknown[] : [];
      await tx.contractInterimPaymentCertificate.update({
        where: { id: certificate.id },
        data: {
          status,
          grossAmount: grossAmount ?? null,
          deductionsAmount,
          retentionAmount,
          advanceRecoveryAmount,
          liquidatedDamagesAmount,
          taxWithholdingAmount,
          otherDeductionsAmount,
          certifiedAmount: certifiedAmount ?? null,
          netAmount: netAmount ?? null,
          approvedAt: ['APPROVED', 'CERTIFIED'].includes(status) ? new Date() : certificate.approvedAt,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          payload: {
            ...objectPayload(certificate.payload),
            certificationNote: input.note || null,
            certificationPayload: input.payload,
            certificationHistory: [
              ...certificationHistory,
              {
                status,
                note: input.note || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                certifiedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.ipc.certified', 'contract', contractId, { ipcId, status });
    });
    return this.getContract(contractId, context);
  }

  async createWorksCompletionCertificate(contractId: string, input: WorksCompletionCertificateInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const certificateType = input.certificateType.toUpperCase();
      const [approvedProgress, certifiedIpc, practicalCompletion, openDefects, openClaims, openNcrs, finalAccount] = await Promise.all([
        tx.contractWorksProgressReport.findFirst({ where: { contractId, status: { in: ['APPROVED', 'VERIFIED', 'ACCEPTED', 'CERTIFIED', 'CLOSED'] } }, orderBy: { createdAt: 'desc' } }),
        tx.contractInterimPaymentCertificate.findFirst({ where: { contractId, status: { in: ['APPROVED', 'CERTIFIED', 'CLOSED'] } }, orderBy: { createdAt: 'desc' } }),
        tx.contractWorksCompletionCertificate.findFirst({ where: { contractId, certificateType: 'PRACTICAL_COMPLETION', status: { notIn: ['REJECTED', 'CANCELLED'] } } }),
        tx.contractDefect.count({ where: { contractId, status: { notIn: [ContractLifecycleItemStatus.CLOSED, ContractLifecycleItemStatus.WAIVED, ContractLifecycleItemStatus.REJECTED] } } }),
        tx.contractClaim.count({ where: { contractId, status: { notIn: [ContractLifecycleItemStatus.CLOSED, ContractLifecycleItemStatus.WAIVED, ContractLifecycleItemStatus.REJECTED] } } }),
        tx.contractNonConformance.count({ where: { contractId, status: { notIn: ['CLOSED', 'WAIVED', 'REJECTED'] } } }),
        tx.contractWorksCompletionCertificate.findFirst({ where: { contractId, certificateType: 'FINAL_ACCOUNT', status: { notIn: ['REJECTED', 'CANCELLED'] } } })
      ]);
      if (certificateType === 'PRACTICAL_COMPLETION' && !approvedProgress && !certifiedIpc) {
        throw requestError('Practical completion requires approved progress or a certified IPC.', 409);
      }
      if (certificateType === 'FINAL_ACCOUNT' && !certifiedIpc) {
        throw requestError('Final account requires at least one certified IPC.', 409);
      }
      if (certificateType === 'FINAL_COMPLETION') {
        if (!practicalCompletion) throw requestError('Final completion requires a practical completion certificate first.', 409);
        if (!finalAccount) throw requestError('Final completion requires an approved final account first.', 409);
      }
      if (['FINAL_ACCOUNT', 'FINAL_COMPLETION'].includes(certificateType) && (openDefects > 0 || openClaims > 0 || openNcrs > 0)) {
        throw requestError('Final Works completion is blocked by open defects, claims, or non-conformances.', 409);
      }
      await tx.contractWorksCompletionCertificate.create({
        data: {
          contractId,
          certificateNumber: input.certificateNumber || executionReference(certificateType === 'FINAL_ACCOUNT' ? 'FAC' : certificateType === 'FINAL_COMPLETION' ? 'FCC' : 'PCC'),
          certificateType,
          status: (input.status || 'ISSUED').toUpperCase(),
          progressReportId: input.progressReportId || approvedProgress?.id || null,
          ipcId: input.ipcId || certifiedIpc?.id || null,
          completionDate: toDate(input.completionDate) ?? new Date(),
          defectsSummary: input.defectsSummary || null,
          outstandingWorks: input.outstandingWorks || null,
          finalAccountAmount: input.finalAccountAmount ?? null,
          retentionReleaseAmount: input.retentionReleaseAmount ?? null,
          currency: input.currency || contract.currency,
          issuedByUserId: context.userId ?? null,
          issuedAt: new Date(),
          note: input.note || null,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.works_completion_certificate.created', 'contract', contractId, { certificateType });
    });
    return this.getContract(contractId, context);
  }

  async createContractDefect(contractId: string, input: ContractDefectInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractDefect.create({
        data: {
          contractId,
          defectReference: input.defectReference || executionReference('DEF'),
          title: input.title,
          description: input.description || null,
          severity: input.severity || 'MINOR',
          identifiedAt: toDateTime(input.identifiedAt) ?? new Date(),
          dueDate: toDate(input.dueDate),
          status: input.status || ContractLifecycleItemStatus.OPEN,
          closedAt: toDateTime(input.closedAt),
          sourceRecordType: input.sourceRecordType || null,
          sourceRecordId: input.sourceRecordId || null,
          responsibleRole: input.responsibleRole || 'SUPPLIER',
          responseDueDate: toDate(input.responseDueDate),
          respondedAt: input.response ? new Date() : null,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: {
            ...input.payload,
            note: input.note || null,
            response: input.response || null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.defect.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async respondToContractDefect(contractId: string, defectId: string, input: ContractDefectActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      const defect = await tx.contractDefect.findFirst({ where: { id: defectId, contractId } });
      if (!defect) throw requestError('Defect was not found.', 404);
      if (defect.status === ContractLifecycleItemStatus.CLOSED) throw requestError('Closed defects cannot be updated by the supplier.', 409);
      const responseHistory: unknown[] = Array.isArray(objectPayload(defect.payload).responseHistory) ? objectPayload(defect.payload).responseHistory as unknown[] : [];
      await tx.contractDefect.update({
        where: { id: defect.id },
        data: {
          status: input.status ?? ContractLifecycleItemStatus.SUBMITTED,
          respondedAt: new Date(),
          payload: {
            ...objectPayload(defect.payload),
            response: input.response || objectPayload(defect.payload).response || null,
            evidence: input.evidence ?? objectPayload(defect.payload).evidence ?? [],
            responsePayload: input.payload,
            responseHistory: [
              ...responseHistory,
              {
                response: input.response || null,
                evidence: input.evidence ?? [],
                payload: input.payload,
                actorUserId: context.userId ?? null,
                respondedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.defect.responded', 'contract', contractId, { defectId });
    });
    return this.getContract(contractId, context);
  }

  async verifyContractDefect(contractId: string, defectId: string, input: ContractDefectActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const defect = await tx.contractDefect.findFirst({ where: { id: defectId, contractId } });
      if (!defect) throw requestError('Defect was not found.', 404);
      const status = input.status ?? ContractLifecycleItemStatus.APPROVED;
      const verificationHistory: unknown[] = Array.isArray(objectPayload(defect.payload).verificationHistory) ? objectPayload(defect.payload).verificationHistory as unknown[] : [];
      await tx.contractDefect.update({
        where: { id: defect.id },
        data: {
          status,
          dueDate: toDate(input.dueDate) ?? defect.dueDate,
          verifiedByUserId: context.userId ?? null,
          verifiedAt: new Date(),
          closedAt: status === ContractLifecycleItemStatus.CLOSED ? new Date() : defect.closedAt,
          payload: {
            ...objectPayload(defect.payload),
            verifiedNote: input.verifiedNote || null,
            verificationPayload: input.payload,
            verificationHistory: [
              ...verificationHistory,
              {
                status,
                note: input.verifiedNote || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                verifiedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.defect.verified', 'contract', contractId, { defectId, status });
    });
    return this.getContract(contractId, context);
  }

  async closeContractDefect(contractId: string, defectId: string, input: ContractDefectActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const defect = await tx.contractDefect.findFirst({ where: { id: defectId, contractId } });
      if (!defect) throw requestError('Defect was not found.', 404);
      await tx.contractDefect.update({
        where: { id: defect.id },
        data: {
          status: ContractLifecycleItemStatus.CLOSED,
          verifiedByUserId: context.userId ?? null,
          verifiedAt: defect.verifiedAt ?? new Date(),
          closedAt: new Date(),
          payload: {
            ...objectPayload(defect.payload),
            closureNote: input.closureNote || input.verifiedNote || null,
            closurePayload: input.payload,
            closedByUserId: context.userId ?? null,
            closedAt: new Date().toISOString()
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.defect.closed', 'contract', contractId, { defectId });
    });
    return this.getContract(contractId, context);
  }

  async createServiceLevel(contractId: string, input: ContractServiceLevelInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractServiceLevel.upsert({
        where: { contractId_metricKey: { contractId, metricKey: input.metricKey } },
        update: {
          title: input.title,
          targetValue: input.targetValue || null,
          measurementUnit: input.measurementUnit || null,
          creditRule: input.creditRule || null,
          status: input.status || 'ACTIVE',
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          metricKey: input.metricKey,
          title: input.title,
          targetValue: input.targetValue || null,
          measurementUnit: input.measurementUnit || null,
          creditRule: input.creditRule || null,
          status: input.status || 'ACTIVE',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_level.upserted', 'contract', contractId, { metricKey: input.metricKey });
    });
    return this.getContract(contractId, context);
  }

  async createServicePeriod(contractId: string, input: ContractServicePeriodInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractServicePeriod.upsert({
        where: { contractId_periodKey: { contractId, periodKey: input.periodKey } },
        update: {
          startDate: toDate(input.startDate) ?? new Date(),
          endDate: toDate(input.endDate) ?? new Date(),
          status: input.status || 'OPEN',
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          periodKey: input.periodKey,
          startDate: toDate(input.startDate) ?? new Date(),
          endDate: toDate(input.endDate) ?? new Date(),
          status: input.status || 'OPEN',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_period.upserted', 'contract', contractId, { periodKey: input.periodKey });
    });
    return this.getContract(contractId, context);
  }

  async createServiceReport(contractId: string, input: ContractServiceReportInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      const period = await tx.contractServicePeriod.findFirst({
        where: input.periodId
          ? { id: input.periodId, contractId, status: { in: ['OPEN', 'ACTIVE', 'IN_PROGRESS'] } }
          : { contractId, status: { in: ['OPEN', 'ACTIVE', 'IN_PROGRESS'] } },
        orderBy: { startDate: 'desc' }
      });
      if (!period) throw requestError('Service report requires an open service period.', 409);
      await tx.contractServiceReport.create({
        data: {
          contractId,
          periodId: period.id,
          reportReference: input.reportReference || executionReference('SRV'),
          submittedByOrgId: context.organizationId ?? null,
          submittedAt: toDateTime(input.submittedAt) ?? new Date(),
          status: input.status || 'SUBMITTED',
          acceptedAmount: input.acceptedAmount ?? null,
          correctedAt: toDateTime(input.correctedAt),
          visibilityScope: input.visibilityScope || 'SHARED',
          summary: input.summary || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_report.created', 'contract', contractId, { periodId: period.id });
    });
    return this.getContract(contractId, context);
  }

  async reviewServiceReport(contractId: string, reportId: string, input: ServiceReportReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const report = await tx.contractServiceReport.findFirst({ where: { id: reportId, contractId } });
      if (!report) throw requestError('Service report was not found.', 404);
      const status = input.status.toUpperCase();
      const reviewHistory: unknown[] = Array.isArray(objectPayload(report.payload).reviewHistory) ? objectPayload(report.payload).reviewHistory as unknown[] : [];
      await tx.contractServiceReport.update({
        where: { id: report.id },
        data: {
          status,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          verifiedSlaResult: input.verifiedSlaResult || null,
          acceptedAmount: input.acceptedAmount ?? report.acceptedAmount,
          correctionDueDate: toDate(input.correctionDueDate) ?? report.correctionDueDate,
          payload: {
            ...objectPayload(report.payload),
            reviewNote: input.note || null,
            reviewPayload: input.payload,
            reviewHistory: [
              ...reviewHistory,
              {
                status,
                verifiedSlaResult: input.verifiedSlaResult || null,
                acceptedAmount: input.acceptedAmount ?? null,
                note: input.note || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                reviewedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_report.reviewed', 'contract', contractId, { reportId, status });
    });
    return this.getContract(contractId, context);
  }

  async createServiceCredit(contractId: string, input: ContractServiceCreditInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      if (input.serviceReportId) {
        const report = await tx.contractServiceReport.findFirst({ where: { id: input.serviceReportId, contractId } });
        if (!report) throw requestError('Service credit must link to a valid service report.', 404);
      }
      await tx.contractServiceCredit.create({
        data: {
          contractId,
          serviceLevelId: input.serviceLevelId || null,
          periodId: input.periodId || null,
          serviceReportId: input.serviceReportId || null,
          creditType: input.creditType || 'SERVICE_CREDIT',
          amount: input.amount ?? null,
          invoiceImpactAmount: input.invoiceImpactAmount ?? input.amount ?? null,
          currency: input.currency || contract.currency,
          status: input.status || 'DRAFT',
          decision: input.decision || null,
          visibilityScope: input.visibilityScope || 'SHARED',
          reason: input.reason || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_credit.created', 'contract', contractId, { creditType: input.creditType });
    });
    return this.getContract(contractId, context);
  }

  async reviewServiceCredit(contractId: string, creditId: string, input: ServiceCreditReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const credit = await tx.contractServiceCredit.findFirst({ where: { id: creditId, contractId } });
      if (!credit) throw requestError('Service credit or penalty was not found.', 404);
      const status = input.status.toUpperCase();
      const reviewHistory: unknown[] = Array.isArray(objectPayload(credit.payload).reviewHistory) ? objectPayload(credit.payload).reviewHistory as unknown[] : [];
      await tx.contractServiceCredit.update({
        where: { id: credit.id },
        data: {
          status,
          decision: input.decision || status,
          amount: input.amount ?? credit.amount,
          invoiceImpactAmount: input.invoiceImpactAmount ?? input.amount ?? credit.invoiceImpactAmount,
          reason: input.reason || credit.reason,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          payload: {
            ...objectPayload(credit.payload),
            reviewPayload: input.payload,
            reviewHistory: [
              ...reviewHistory,
              {
                status,
                decision: input.decision || status,
                amount: input.amount ?? null,
                invoiceImpactAmount: input.invoiceImpactAmount ?? input.amount ?? null,
                reason: input.reason || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                reviewedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_credit.reviewed', 'contract', contractId, { creditId, status });
    });
    return this.getContract(contractId, context);
  }

  async createServiceIncident(contractId: string, input: ContractServiceIncidentInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractServiceIncident.create({
        data: {
          contractId,
          incidentReference: input.incidentReference || executionReference('SINC'),
          incidentType: input.incidentType || 'INCIDENT',
          title: input.title,
          description: input.description || null,
          severity: input.severity || 'MINOR',
          serviceLevelId: input.serviceLevelId || null,
          periodId: input.periodId || null,
          serviceReportId: input.serviceReportId || null,
          occurredAt: toDateTime(input.occurredAt) ?? new Date(),
          dueDate: toDate(input.dueDate),
          status: input.status || ContractLifecycleItemStatus.OPEN,
          responsibleRole: input.responsibleRole || 'SUPPLIER',
          responseDueDate: toDate(input.responseDueDate),
          respondedAt: input.response ? new Date() : null,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: {
            ...input.payload,
            response: input.response || null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_incident.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async respondToServiceIncident(contractId: string, incidentId: string, input: ServiceIncidentActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      const incident = await tx.contractServiceIncident.findFirst({ where: { id: incidentId, contractId } });
      if (!incident) throw requestError('Service incident was not found.', 404);
      if (incident.status === ContractLifecycleItemStatus.CLOSED) throw requestError('Closed service incidents cannot be updated by the supplier.', 409);
      const responseHistory: unknown[] = Array.isArray(objectPayload(incident.payload).responseHistory) ? objectPayload(incident.payload).responseHistory as unknown[] : [];
      await tx.contractServiceIncident.update({
        where: { id: incident.id },
        data: {
          status: input.status ?? ContractLifecycleItemStatus.SUBMITTED,
          respondedAt: new Date(),
          payload: {
            ...objectPayload(incident.payload),
            response: input.response || objectPayload(incident.payload).response || null,
            evidence: input.evidence ?? objectPayload(incident.payload).evidence ?? [],
            responsePayload: input.payload,
            responseHistory: [
              ...responseHistory,
              {
                response: input.response || null,
                evidence: input.evidence ?? [],
                payload: input.payload,
                actorUserId: context.userId ?? null,
                respondedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_incident.responded', 'contract', contractId, { incidentId });
    });
    return this.getContract(contractId, context);
  }

  async verifyServiceIncident(contractId: string, incidentId: string, input: ServiceIncidentActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const incident = await tx.contractServiceIncident.findFirst({ where: { id: incidentId, contractId } });
      if (!incident) throw requestError('Service incident was not found.', 404);
      const status = input.status ?? ContractLifecycleItemStatus.APPROVED;
      const verificationHistory: unknown[] = Array.isArray(objectPayload(incident.payload).verificationHistory) ? objectPayload(incident.payload).verificationHistory as unknown[] : [];
      await tx.contractServiceIncident.update({
        where: { id: incident.id },
        data: {
          status,
          dueDate: toDate(input.dueDate) ?? incident.dueDate,
          verifiedByUserId: context.userId ?? null,
          verifiedAt: new Date(),
          closedAt: status === ContractLifecycleItemStatus.CLOSED ? new Date() : incident.closedAt,
          payload: {
            ...objectPayload(incident.payload),
            verifiedNote: input.verifiedNote || null,
            verificationPayload: input.payload,
            verificationHistory: [
              ...verificationHistory,
              {
                status,
                note: input.verifiedNote || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                verifiedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_incident.verified', 'contract', contractId, { incidentId, status });
    });
    return this.getContract(contractId, context);
  }

  async closeServiceIncident(contractId: string, incidentId: string, input: ServiceIncidentActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const incident = await tx.contractServiceIncident.findFirst({ where: { id: incidentId, contractId } });
      if (!incident) throw requestError('Service incident was not found.', 404);
      await tx.contractServiceIncident.update({
        where: { id: incident.id },
        data: {
          status: ContractLifecycleItemStatus.CLOSED,
          verifiedByUserId: context.userId ?? null,
          verifiedAt: incident.verifiedAt ?? new Date(),
          closedAt: new Date(),
          payload: {
            ...objectPayload(incident.payload),
            closureNote: input.closureNote || input.verifiedNote || null,
            closurePayload: input.payload,
            closedByUserId: context.userId ?? null,
            closedAt: new Date().toISOString()
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.service_incident.closed', 'contract', contractId, { incidentId });
    });
    return this.getContract(contractId, context);
  }

  async createConsultancyDeliverable(contractId: string, input: ContractConsultancyDeliverableInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractConsultancyDeliverable.upsert({
        where: { contractId_deliverableCode: { contractId, deliverableCode: input.deliverableCode } },
        update: {
          title: input.title,
          description: input.description || null,
          dueDate: toDate(input.dueDate),
          paymentEligible: input.paymentEligible ?? false,
          acceptedAmount: input.acceptedAmount ?? null,
          approvalStatus: input.approvalStatus || null,
          isFinalReport: input.isFinalReport ?? false,
          visibilityScope: input.visibilityScope || 'SHARED',
          status: input.status || ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          deliverableCode: input.deliverableCode,
          title: input.title,
          description: input.description || null,
          dueDate: toDate(input.dueDate),
          paymentEligible: input.paymentEligible ?? false,
          acceptedAmount: input.acceptedAmount ?? null,
          approvalStatus: input.approvalStatus || null,
          isFinalReport: input.isFinalReport ?? false,
          visibilityScope: input.visibilityScope || 'SHARED',
          status: input.status || ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.consultancy_deliverable.upserted', 'contract', contractId, { deliverableCode: input.deliverableCode });
    });
    return this.getContract(contractId, context);
  }

  async reviewConsultancyDeliverable(contractId: string, deliverableId: string, input: ConsultancyDeliverableReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const deliverable = await tx.contractConsultancyDeliverable.findFirst({ where: { id: deliverableId, contractId } });
      if (!deliverable) throw requestError('Consultancy deliverable was not found.', 404);
      const history: unknown[] = Array.isArray(objectPayload(deliverable.payload).reviewHistory) ? objectPayload(deliverable.payload).reviewHistory as unknown[] : [];
      await tx.contractConsultancyDeliverable.update({
        where: { id: deliverable.id },
        data: {
          status: input.status ?? ContractLifecycleItemStatus.APPROVED,
          paymentEligible: input.paymentEligible ?? deliverable.paymentEligible,
          acceptedAmount: input.acceptedAmount ?? deliverable.acceptedAmount,
          approvalStatus: input.approvalStatus || String(input.status ?? ContractLifecycleItemStatus.APPROVED),
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          visibilityScope: input.visibilityScope || deliverable.visibilityScope || 'SHARED',
          payload: {
            ...objectPayload(deliverable.payload),
            reviewNote: input.note || null,
            reviewPayload: input.payload,
            reviewHistory: [
              ...history,
              {
                status: input.status ?? ContractLifecycleItemStatus.APPROVED,
                paymentEligible: input.paymentEligible ?? null,
                acceptedAmount: input.acceptedAmount ?? null,
                note: input.note || null,
                payload: input.payload,
                actorUserId: context.userId ?? null,
                reviewedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.consultancy_deliverable.reviewed', 'contract', contractId, { deliverableId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async createDeliverableVersion(contractId: string, input: ContractDeliverableVersionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      if (!input.deliverableId) throw requestError('Deliverable version requires a consultancy deliverable plan.', 409);
      const deliverable = await tx.contractConsultancyDeliverable.findFirst({ where: { id: input.deliverableId, contractId } });
      if (!deliverable) throw requestError('Deliverable version must link to a valid consultancy deliverable.', 404);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      const latestVersion = await tx.contractDeliverableVersion.findFirst({ where: { deliverableId: input.deliverableId }, orderBy: { versionNo: 'desc' } });
      if (input.previousVersionId) {
        const previous = await tx.contractDeliverableVersion.findFirst({ where: { id: input.previousVersionId, contractId, deliverableId: input.deliverableId } });
        if (!previous) throw requestError('Previous deliverable version was not found for this deliverable.', 404);
      }
      const versionNo = input.versionNo ?? (latestVersion?.versionNo ?? 0) + 1;
      await tx.contractDeliverableVersion.create({
        data: {
          contractId,
          deliverableId: input.deliverableId,
          previousVersionId: input.previousVersionId || latestVersion?.id || null,
          versionNo,
          documentId: input.documentId || null,
          submittedByOrgId: context.organizationId ?? null,
          submittedAt: toDateTime(input.submittedAt) ?? new Date(),
          status: input.status || 'SUBMITTED',
          note: input.note || null,
          revisionReason: input.revisionReason || null,
          correctionDueDate: toDate(input.correctionDueDate),
          correctedAt: toDateTime(input.correctedAt),
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.contractConsultancyDeliverable.update({ where: { id: deliverable.id }, data: { status: ContractLifecycleItemStatus.SUBMITTED } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.deliverable_version.created', 'contract', contractId, { deliverableId: input.deliverableId, versionNo });
    });
    return this.getContract(contractId, context);
  }

  async reviewDeliverableVersion(contractId: string, versionId: string, input: ContractDeliverableReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const version = await tx.contractDeliverableVersion.findFirst({ where: { id: versionId, contractId } });
      if (!version) throw requestError('Deliverable version was not found.', 404);
      const decision = input.decision || 'REVISION_REQUESTED';
      const review = await tx.contractDeliverableReview.create({
        data: {
          contractId,
          versionId,
          decision,
          reviewerUserId: context.userId ?? null,
          reviewedAt: toDateTime(input.reviewedAt) ?? new Date(),
          comments: input.comments || null,
          commentSummary: input.commentSummary || null,
          buyerPrivateNotes: input.buyerPrivateNotes || null,
          paymentEligible: input.paymentEligible ?? false,
          acceptedAmount: input.acceptedAmount ?? null,
          revisionDueDate: toDate(input.revisionDueDate),
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.contractDeliverableVersion.update({
        where: { id: version.id },
        data: {
          status: decision,
          correctionDueDate: toDate(input.revisionDueDate) ?? version.correctionDueDate,
          payload: {
            ...objectPayload(version.payload),
            latestReviewId: review.id,
            latestReviewDecision: decision,
            latestReviewComments: input.comments || null
          } as Prisma.InputJsonObject
        }
      });
      if (version.deliverableId) {
        await tx.contractConsultancyDeliverable.update({
          where: { id: version.deliverableId },
          data: {
            status: decision === 'APPROVED' ? ContractLifecycleItemStatus.APPROVED : decision === 'REJECTED' ? ContractLifecycleItemStatus.REJECTED : ContractLifecycleItemStatus.IN_PROGRESS,
            paymentEligible: input.paymentEligible ?? false,
            acceptedAmount: input.acceptedAmount ?? null,
            reviewedByUserId: context.userId ?? null,
            reviewedAt: new Date(),
            approvalStatus: decision
          }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.deliverable_version.reviewed', 'contract', contractId, { versionId, decision });
    });
    return this.getContract(contractId, context);
  }

  async createDeliverableReview(contractId: string, input: ContractDeliverableReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const version = input.versionId ? await tx.contractDeliverableVersion.findFirst({ where: { id: input.versionId, contractId } }) : null;
      if (input.versionId && !version) throw requestError('Deliverable version was not found.', 404);
      await tx.contractDeliverableReview.create({
        data: {
          contractId,
          versionId: input.versionId || null,
          decision: input.decision || 'REVISION_REQUESTED',
          reviewerUserId: context.userId ?? null,
          reviewedAt: toDateTime(input.reviewedAt) ?? new Date(),
          comments: input.comments || null,
          commentSummary: input.commentSummary || null,
          buyerPrivateNotes: input.buyerPrivateNotes || null,
          paymentEligible: input.paymentEligible ?? false,
          acceptedAmount: input.acceptedAmount ?? null,
          revisionDueDate: toDate(input.revisionDueDate),
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.versionId) {
        await tx.contractDeliverableVersion.update({ where: { id: input.versionId }, data: { status: input.decision || 'REVISION_REQUESTED' } });
      }
      if (version?.deliverableId && input.decision === 'APPROVED') {
        await tx.contractConsultancyDeliverable.update({
          where: { id: version.deliverableId },
          data: {
            status: ContractLifecycleItemStatus.APPROVED,
            paymentEligible: input.paymentEligible ?? false,
            acceptedAmount: input.acceptedAmount ?? null,
            reviewedByUserId: context.userId ?? null,
            reviewedAt: new Date(),
            approvalStatus: input.decision
          }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.deliverable_review.created', 'contract', contractId, { versionId: input.versionId, decision: input.decision });
    });
    return this.getContract(contractId, context);
  }

  async confirmDeliverableReviewPaymentEligibility(contractId: string, reviewId: string, input: DeliverableReviewPaymentEligibilityInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const review = await tx.contractDeliverableReview.findFirst({ where: { id: reviewId, contractId }, include: { version: true } });
      if (!review) throw requestError('Deliverable review was not found.', 404);
      await tx.contractDeliverableReview.update({
        where: { id: review.id },
        data: {
          decision: input.decision || review.decision,
          paymentEligible: input.paymentEligible ?? true,
          acceptedAmount: input.acceptedAmount ?? review.acceptedAmount,
          visibilityScope: input.visibilityScope || review.visibilityScope || 'SHARED',
          payload: {
            ...objectPayload(review.payload),
            paymentEligibilityNote: input.note || null,
            paymentEligibilityPayload: input.payload,
            paymentEligibilityConfirmedAt: new Date().toISOString(),
            paymentEligibilityConfirmedByUserId: context.userId ?? null
          } as Prisma.InputJsonObject
        }
      });
      if (review.version?.deliverableId) {
        await tx.contractConsultancyDeliverable.update({
          where: { id: review.version.deliverableId },
          data: {
            paymentEligible: input.paymentEligible ?? true,
            acceptedAmount: input.acceptedAmount ?? review.acceptedAmount,
            status: ContractLifecycleItemStatus.APPROVED,
            reviewedByUserId: context.userId ?? null,
            reviewedAt: new Date(),
            approvalStatus: input.decision || review.decision
          }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.deliverable_review.payment_eligibility_confirmed', 'contract', contractId, { reviewId });
    });
    return this.getContract(contractId, context);
  }

  async upsertConsultancyFinalReport(contractId: string, input: ConsultancyFinalReportInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      if (input.deliverableId) {
        const deliverable = await tx.contractConsultancyDeliverable.findFirst({ where: { id: input.deliverableId, contractId } });
        if (!deliverable) throw requestError('Final report must link to a valid consultancy deliverable.', 404);
      }
      if (input.versionId) {
        const version = await tx.contractDeliverableVersion.findFirst({ where: { id: input.versionId, contractId } });
        if (!version) throw requestError('Final report must link to a valid deliverable version.', 404);
      }
      const reportReference = input.reportReference || executionReference('CFR');
      await tx.contractConsultancyFinalReport.upsert({
        where: { contractId_reportReference: { contractId, reportReference } },
        update: {
          deliverableId: input.deliverableId || null,
          versionId: input.versionId || null,
          documentId: input.documentId || null,
          submittedByOrgId: context.organizationId ?? null,
          submittedAt: toDateTime(input.submittedAt) ?? new Date(),
          status: input.status ?? ContractLifecycleItemStatus.SUBMITTED,
          summary: input.summary || null,
          acceptedAmount: input.acceptedAmount ?? null,
          paymentEligible: input.paymentEligible ?? false,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          reportReference,
          deliverableId: input.deliverableId || null,
          versionId: input.versionId || null,
          documentId: input.documentId || null,
          submittedByOrgId: context.organizationId ?? null,
          submittedAt: toDateTime(input.submittedAt) ?? new Date(),
          status: input.status ?? ContractLifecycleItemStatus.SUBMITTED,
          summary: input.summary || null,
          acceptedAmount: input.acceptedAmount ?? null,
          paymentEligible: input.paymentEligible ?? false,
          visibilityScope: input.visibilityScope || 'SHARED',
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.consultancy_final_report.upserted', 'contract', contractId, { reportReference });
    });
    return this.getContract(contractId, context);
  }

  async reviewConsultancyFinalReport(contractId: string, reportId: string, input: ConsultancyFinalReportReviewInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const report = await tx.contractConsultancyFinalReport.findFirst({ where: { id: reportId, contractId } });
      if (!report) throw requestError('Consultancy final report was not found.', 404);
      const history: unknown[] = Array.isArray(objectPayload(report.payload).reviewHistory) ? objectPayload(report.payload).reviewHistory as unknown[] : [];
      await tx.contractConsultancyFinalReport.update({
        where: { id: report.id },
        data: {
          status: input.status ?? ContractLifecycleItemStatus.APPROVED,
          acceptedAmount: input.acceptedAmount ?? report.acceptedAmount,
          paymentEligible: input.paymentEligible ?? true,
          reviewedByUserId: context.userId ?? null,
          reviewedAt: new Date(),
          visibilityScope: input.visibilityScope || report.visibilityScope || 'SHARED',
          payload: {
            ...objectPayload(report.payload),
            reviewNote: input.note || null,
            reviewPayload: input.payload,
            reviewHistory: [
              ...history,
              {
                status: input.status ?? ContractLifecycleItemStatus.APPROVED,
                acceptedAmount: input.acceptedAmount ?? null,
                paymentEligible: input.paymentEligible ?? true,
                note: input.note || null,
                actorUserId: context.userId ?? null,
                reviewedAt: new Date().toISOString()
              }
            ]
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.consultancy_final_report.reviewed', 'contract', contractId, { reportId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async createClaim(contractId: string, input: ContractClaimInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractVisible(contract, context);
      await tx.contractClaim.create({
        data: {
          contractId,
          claimReference: input.claimReference || executionReference('CLM'),
          claimType: input.claimType || 'GENERAL',
          title: input.title,
          description: input.description || null,
          raisedByRole: input.raisedByRole || (contract.buyerOrgId === context.organizationId ? 'buyer' : 'supplier'),
          amount: input.amount ?? null,
          currency: input.currency || contract.currency,
          status: input.status || ContractLifecycleItemStatus.OPEN,
          submittedAt: toDateTime(input.submittedAt) ?? new Date(),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.claim.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async createClaimResponse(contractId: string, input: ContractClaimResponseInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractVisible(contract, context);
      await tx.contractClaimResponse.create({
        data: {
          contractId,
          claimId: input.claimId || null,
          responderRole: input.responderRole || (contract.buyerOrgId === context.organizationId ? 'buyer' : 'supplier'),
          decision: input.decision || 'UNDER_REVIEW',
          response: input.response || null,
          amountApproved: input.amountApproved ?? null,
          respondedAt: toDateTime(input.respondedAt) ?? new Date(),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.claim_response.created', 'contract', contractId, { claimId: input.claimId, decision: input.decision });
    });
    return this.getContract(contractId, context);
  }

  async createExtensionRequest(contractId: string, input: ContractExtensionRequestInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractVisible(contract, context);
      await tx.contractExtensionRequest.create({
        data: {
          contractId,
          requestReference: input.requestReference || executionReference('EXT'),
          requestedByRole: input.requestedByRole || (contract.buyerOrgId === context.organizationId ? 'buyer' : 'supplier'),
          reason: input.reason || null,
          requestedEndDate: toDate(input.requestedEndDate),
          impactSummary: input.impactSummary || null,
          status: input.status || ContractLifecycleItemStatus.OPEN,
          decidedAt: toDateTime(input.decidedAt),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.extension_request.created', 'contract', contractId, { requestReference: input.requestReference });
    });
    return this.getContract(contractId, context);
  }

  async createAmendment(contractId: string, input: ContractAmendmentInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const amendment = await tx.contractAmendment.create({
        data: {
          contractId,
          amendmentReference: input.amendmentReference || executionReference('AMD'),
          amendmentType: input.amendmentType || 'VARIATION',
          title: input.title,
          reason: input.reason || null,
          baselineVersionNo: input.baselineVersionNo ?? null,
          valueDelta: input.valueDelta ?? null,
          timeDeltaDays: input.timeDeltaDays ?? null,
          status: input.status || 'DRAFT',
          approvedAt: toDateTime(input.approvedAt),
          signedAt: toDateTime(input.signedAt),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (['APPROVED', 'SIGNED'].includes(amendment.status) || amendment.approvedAt || amendment.signedAt) {
        await this.createAmendedBaseline(tx, contract, amendment);
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.amendment.created', 'contract', contractId, { title: input.title, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async upsertManagementPlan(contractId: string, input: ContractManagementPlanInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractManagementPlan.upsert({
        where: { contractId },
        update: {
          contractManagerId: input.contractManagerId || null,
          objectives: input.objectives || null,
          monitoringPlan: input.monitoringPlan || null,
          reportingPlan: input.reportingPlan || null,
          communicationPlan: input.communicationPlan || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          contractManagerId: input.contractManagerId || null,
          objectives: input.objectives || null,
          monitoringPlan: input.monitoringPlan || null,
          reportingPlan: input.reportingPlan || null,
          communicationPlan: input.communicationPlan || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.cmp.upserted', 'contract', contractId, {});
    });
    return this.getContract(contractId, context);
  }

  async updateMobilizationItem(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractMobilizationItem.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Mobilization item was not found.', 404);
      assertContractVisible(item.contract, context);
      assertContractManager(item.contract, context);
      await tx.contractMobilizationItem.update({
        where: { id: item.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.category !== undefined ? { category: input.category || 'general' } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.required !== undefined ? { required: input.required } : {}),
          ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) ?? null } : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
          ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonObject } : {}),
          ...(input.status === ContractLifecycleItemStatus.APPROVED ? { completedAt: new Date() } : {}),
          ...(input.waived || input.status === ContractLifecycleItemStatus.WAIVED ? { status: ContractLifecycleItemStatus.WAIVED, waivedAt: new Date() } : {})
        }
      });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, 'contract.mobilization.updated', 'contract', contractId, { itemId });
    });
    return this.getContract(contractId, context);
  }

  async createInspection(contractId: string, input: InspectionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractInspection.create({
        data: {
          contractId,
          milestoneId: input.milestoneId,
          inspectionType: input.inspectionType,
          title: input.title,
          result: input.status ?? ContractLifecycleItemStatus.OPEN,
          inspectedAt: toDateTime(input.inspectedAt),
          inspectorUserId: input.inspectorUserId,
          note: input.note || input.description || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.inspection.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async createGoodsInspection(contractId: string, input: GoodsInspectionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const result = input.result ?? ContractLifecycleItemStatus.OPEN;
      const inspectionNo = input.inspectionNo || goodsInspectionReference();
      const goodsReceiptId = input.goodsReceiptId || payloadString(input.payload, 'goodsReceiptId', 'receiptId');
      if (goodsReceiptId) {
        const receipt = await tx.contractGoodsReceipt.findFirst({ where: { id: goodsReceiptId, contractId } });
        if (!receipt) throw requestError('Goods receipt was not found for this contract.', 404);
      }
      const payload = {
        ...objectPayload(input.payload),
        goodsReceiptId: goodsReceiptId || null
      } as Prisma.InputJsonObject;
      await tx.goodsInspection.upsert({
        where: { contractId_inspectionNo: { contractId, inspectionNo } },
        update: {
          milestoneId: input.milestoneId,
          deliverableId: input.deliverableId,
          goodsDescription: input.goodsDescription,
          quantityOrdered: input.quantityOrdered,
          quantityReceived: input.quantityReceived,
          quantityAccepted: input.quantityAccepted,
          quantityRejected: input.quantityRejected,
          unit: input.unit || null,
          location: input.location || null,
          result,
          inspectedByUserId: context.userId ?? null,
          inspectedAt: toDateTime(input.inspectedAt) ?? new Date(),
          defects: (input.defects ?? []) as Prisma.InputJsonArray,
          note: input.note || null,
          payload
        },
        create: {
          contractId,
          milestoneId: input.milestoneId,
          deliverableId: input.deliverableId,
          inspectionNo,
          goodsDescription: input.goodsDescription,
          quantityOrdered: input.quantityOrdered,
          quantityReceived: input.quantityReceived,
          quantityAccepted: input.quantityAccepted,
          quantityRejected: input.quantityRejected,
          unit: input.unit || null,
          location: input.location || null,
          result,
          inspectedByUserId: context.userId ?? null,
          inspectedAt: toDateTime(input.inspectedAt) ?? new Date(),
          defects: (input.defects ?? []) as Prisma.InputJsonArray,
          note: input.note || null,
          payload
        }
      });
      if (input.milestoneId && result === ContractLifecycleItemStatus.APPROVED) {
        await tx.contractMilestone.update({ where: { id: input.milestoneId }, data: { status: ContractMilestoneStatus.ACCEPTED } });
      }
      if (input.deliverableId && result === ContractLifecycleItemStatus.APPROVED) {
        await tx.contractDeliverable.update({ where: { id: input.deliverableId }, data: { status: ContractLifecycleItemStatus.APPROVED, reviewedAt: new Date() } });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.goods_inspection.upserted', 'contract', contractId, { inspectionNo, result });
    });
    return this.getContract(contractId, context);
  }

  async createInvoice(contractId: string, input: InvoiceInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      if (contract.status === ContractStatus.TERMINATION_REVIEW && input.status !== InvoiceStatus.BLOCKED && input.status !== InvoiceStatus.REJECTED) {
        throw requestError('Invoices are blocked while termination review is active.', 409);
      }
      await this.assertInvoiceExecutionEligible(tx, contractId, input);
      await tx.invoice.create({
        data: {
          reference: input.reference || invoiceReference(),
          purchaseOrderId: input.purchaseOrderId,
          contractId,
          buyerOrgId: contract.buyerOrgId,
          supplierOrgId: input.supplierOrgId ?? contract.supplierOrgId,
          executionReferenceType: input.executionReferenceType || null,
          executionReferenceId: input.executionReferenceId || null,
          visibilityScope: String(input.payload?.visibilityScope ?? 'SHARED'),
          status: input.status ?? InvoiceStatus.SUBMITTED,
          amount: input.amount,
          currency: input.currency,
          payload: {
            ...input.payload,
            executionReferenceType: input.executionReferenceType ?? null,
            executionReferenceId: input.executionReferenceId ?? null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.invoice.created', 'contract', contractId, { amount: input.amount, status: input.status, executionReferenceId: input.executionReferenceId });
    });
    return this.getContract(contractId, context);
  }

  async generateManagementPlanDraft(contractId: string, input: ContractManagementPlanDraftInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId }, include: contractInclude });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      if (contract.managementPlan && !input.overwrite) {
        await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.cmp.draft_skipped', 'contract', contractId, { reason: 'existing_management_plan' });
        return;
      }
      const procurementType = String(objectPayload(contract.payload).procurementType ?? contract.tender?.type ?? 'GENERAL');
      const milestoneSummary = contract.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        dueDate: isoDate(milestone.dueDate),
        amount: decimalToNumber(milestone.amount),
        currency: milestone.currency
      }));
      const obligationSummary = contract.obligations.map((obligation) => ({
        id: obligation.id,
        type: obligation.obligationType,
        title: obligation.title,
        ownerRole: obligation.ownerRole,
        dueDate: isoDate(obligation.dueDate),
        paymentEligible: obligation.paymentEligible
      }));
      const securitySummary = contract.requiredDocuments
        .filter((document) => /security|guarantee|insurance/i.test(`${document.documentType} ${document.title}`))
        .map((document) => ({ documentType: document.documentType, title: document.title, ownerRole: document.ownerRole }));
      const draftPayload = {
        ...objectPayload(input.payload),
        generated: true,
        generatedAt: new Date().toISOString(),
        source: 'post_award_cmp_draft',
        procurementType,
        tenderReference: contract.tender?.reference ?? null,
        contractValue: decimalToNumber(contract.amount),
        currency: contract.currency,
        milestones: milestoneSummary,
        obligations: obligationSummary,
        requiredSecurities: securitySummary,
        paymentScheduleCount: contract.paymentSchedules.length,
        defaultEscalation: ['Contract manager review', 'Formal notice', 'Claim or dispute workflow', 'Termination review when applicable']
      } as Prisma.InputJsonObject;
      await tx.contractManagementPlan.upsert({
        where: { contractId },
        update: {
          objectives: `Manage ${contract.title} through controlled delivery, acceptance, finance, performance, and closeout.`,
          monitoringPlan: `Monitor ${procurementType} execution through milestones, obligations, evidence, inspections, finance queues, risks, and control workflows.`,
          reportingPlan: 'Use role-aware Post Award tasks, meetings, notices, and monthly performance/finance summaries.',
          communicationPlan: 'Use ProcureX formal notices for contractual instructions, meetings for action tracking, and shared records for supplier-visible correction reasons.',
          payload: draftPayload
        },
        create: {
          contractId,
          contractManagerId: context.userId ?? null,
          objectives: `Manage ${contract.title} through controlled delivery, acceptance, finance, performance, and closeout.`,
          monitoringPlan: `Monitor ${procurementType} execution through milestones, obligations, evidence, inspections, finance queues, risks, and control workflows.`,
          reportingPlan: 'Use role-aware Post Award tasks, meetings, notices, and monthly performance/finance summaries.',
          communicationPlan: 'Use ProcureX formal notices for contractual instructions, meetings for action tracking, and shared records for supplier-visible correction reasons.',
          payload: draftPayload
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.cmp.draft_generated', 'contract', contractId, { overwrite: input.overwrite ?? false });
    });
    return this.getContract(contractId, context);
  }

  async createContractNotice(contractId: string, input: ContractNoticeInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      const senderRole = String(input.senderRole || (contract.supplierOrgId === context.organizationId ? 'SUPPLIER' : 'BUYER')).toUpperCase();
      if (senderRole === 'SUPPLIER') assertContractSupplier(contract, context);
      else assertContractManager(contract, context);
      await tx.contractNotice.create({
        data: {
          contractId,
          noticeType: input.noticeType || 'ORDINARY_MESSAGE',
          title: input.title,
          body: input.body || null,
          status: input.status || 'SENT',
          senderRole,
          recipientRole: input.recipientRole || (senderRole === 'SUPPLIER' ? 'BUYER' : 'SUPPLIER'),
          sentAt: toDateTime(input.sentAt) ?? new Date(),
          receivedAt: toDateTime(input.receivedAt) ?? null,
          dueDate: toDate(input.dueDate) ?? null,
          relatedRecordType: input.relatedRecordType || null,
          relatedRecordId: input.relatedRecordId || null,
          visibilityScope: input.visibilityScope || 'SHARED',
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.notice.created', 'contract', contractId, { noticeType: input.noticeType, title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async controlContractNotice(contractId: string, noticeId: string, action: 'acknowledge' | 'respond' | 'close', input: ContractNoticeActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const notice = await tx.contractNotice.findUnique({ where: { id: noticeId }, include: { contract: true } });
      if (!notice || notice.contractId !== contractId) throw requestError('Notice was not found.', 404);
      assertContractVisible(notice.contract, context);
      if (action === 'close') assertContractManager(notice.contract, context);
      const recipientRole = String(notice.recipientRole ?? '').toUpperCase();
      if (action !== 'close' && recipientRole === 'SUPPLIER') assertContractSupplier(notice.contract, context);
      if (action !== 'close' && recipientRole !== 'SUPPLIER') assertContractManager(notice.contract, context);
      const status = input.status || (action === 'acknowledge' ? 'ACKNOWLEDGED' : action === 'respond' ? 'RESPONDED' : 'CLOSED');
      await tx.contractNotice.update({
        where: { id: notice.id },
        data: {
          status,
          response: input.response || notice.response,
          receivedAt: toDateTime(input.receivedAt) ?? notice.receivedAt ?? (action === 'acknowledge' ? new Date() : undefined),
          acknowledgedAt: toDateTime(input.acknowledgedAt) ?? notice.acknowledgedAt ?? (action === 'acknowledge' ? new Date() : undefined),
          respondedAt: toDateTime(input.respondedAt) ?? notice.respondedAt ?? (action === 'respond' ? new Date() : undefined),
          closedAt: toDateTime(input.closedAt) ?? notice.closedAt ?? (action === 'close' ? new Date() : undefined),
          note: input.note || notice.note,
          payload: {
            ...objectPayload(notice.payload),
            ...objectPayload(input.payload),
            privateNote: input.privateNote || objectPayload(notice.payload).privateNote || null,
            lastAction: action,
            lastActionAt: new Date().toISOString(),
            lastActionByOrgId: context.organizationId ?? null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, notice.contract.buyerOrgId, context.userId, `contract.notice.${action}`, 'contract', contractId, { noticeId: notice.id, status });
    });
    return this.getContract(contractId, context);
  }

  async createContractMeeting(contractId: string, input: ContractMeetingInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const meeting = await tx.contractMeeting.create({
        data: {
          contractId,
          meetingType: input.meetingType || 'PROGRESS_MEETING',
          title: input.title,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          meetingDate: toDateTime(input.meetingDate) ?? null,
          participants: (input.participants ?? []) as Prisma.InputJsonArray,
          agenda: input.agenda || null,
          minutes: input.minutes || null,
          decisions: input.decisions || null,
          visibilityScope: input.visibilityScope || 'SHARED',
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.actions?.length) {
        await tx.contractMeetingAction.createMany({
          data: input.actions.map((action) => ({
            contractId,
            meetingId: meeting.id,
            title: action.title,
            ownerRole: action.ownerRole || 'SHARED',
            status: action.status ?? ContractLifecycleItemStatus.OPEN,
            dueDate: toDate(action.dueDate) ?? null,
            response: action.response || null,
            verificationNote: action.verificationNote || null,
            visibilityScope: action.visibilityScope || input.visibilityScope || 'SHARED',
            note: action.note || null,
            payload: action.payload as Prisma.InputJsonObject
          }))
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.meeting.created', 'contract', contractId, { meetingId: meeting.id, title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async createContractMeetingAction(contractId: string, meetingId: string, input: ContractMeetingActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const meeting = await tx.contractMeeting.findUnique({ where: { id: meetingId }, include: { contract: true } });
      if (!meeting || meeting.contractId !== contractId) throw requestError('Meeting was not found.', 404);
      assertContractVisible(meeting.contract, context);
      assertContractManager(meeting.contract, context);
      await tx.contractMeetingAction.create({
        data: {
          contractId,
          meetingId,
          title: input.title,
          ownerRole: input.ownerRole || 'SHARED',
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate) ?? null,
          response: input.response || null,
          verificationNote: input.verificationNote || null,
          visibilityScope: input.visibilityScope || 'SHARED',
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, meeting.contract.buyerOrgId, context.userId, 'contract.meeting_action.created', 'contract', contractId, { meetingId, title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async controlContractMeetingAction(contractId: string, actionId: string, action: 'complete' | 'verify' | 'close', input: ContractMeetingActionPatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const item = await tx.contractMeetingAction.findUnique({ where: { id: actionId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError('Meeting action was not found.', 404);
      assertContractVisible(item.contract, context);
      const ownerRole = String(item.ownerRole).toUpperCase();
      if (action === 'complete') {
        if (ownerRole === 'BUYER') assertContractManager(item.contract, context);
        else if (ownerRole === 'SUPPLIER') assertContractSupplier(item.contract, context);
      } else {
        assertContractManager(item.contract, context);
      }
      const status = input.status ?? (action === 'complete' ? ContractLifecycleItemStatus.SUBMITTED : ContractLifecycleItemStatus.CLOSED);
      await tx.contractMeetingAction.update({
        where: { id: item.id },
        data: {
          status,
          completedAt: action === 'complete' ? new Date() : item.completedAt,
          verifiedAt: action === 'verify' ? new Date() : item.verifiedAt,
          closedAt: action === 'close' ? new Date() : item.closedAt,
          response: input.response || item.response,
          verificationNote: input.verificationNote || item.verificationNote,
          visibilityScope: input.visibilityScope || item.visibilityScope,
          note: input.note || item.note,
          payload: {
            ...objectPayload(item.payload),
            ...objectPayload(input.payload),
            lastAction: action,
            lastActionAt: new Date().toISOString(),
            lastActionByOrgId: context.organizationId ?? null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.meeting_action.${action}`, 'contract', contractId, { actionId: item.id, status });
    });
    return this.getContract(contractId, context);
  }

  async upsertThreeWayMatch(contractId: string, input: ThreeWayMatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
      if (!invoice || invoice.contractId !== contractId) throw requestError('Invoice was not found for this contract.', 404);
      let acceptanceId = input.acceptanceId;
      let goodsReceiptId = input.goodsReceiptId;
      let goodsInspectionId = input.goodsInspectionId;
      const invoiceExecutionType = String(invoice.executionReferenceType ?? '').toLowerCase();
      if (invoice.executionReferenceId) {
        if (!acceptanceId && ['acceptance', 'contract_acceptance'].includes(invoiceExecutionType)) acceptanceId = invoice.executionReferenceId;
        if (!goodsReceiptId && ['goods_receipt', 'receipt'].includes(invoiceExecutionType)) goodsReceiptId = invoice.executionReferenceId;
        if (!goodsInspectionId && ['goods_inspection', 'inspection'].includes(invoiceExecutionType)) goodsInspectionId = invoice.executionReferenceId;
      }
      const hasGenericExecutionEvidence = Boolean(invoice.executionReferenceId && invoice.executionReferenceType && !['acceptance', 'contract_acceptance', 'goods_receipt', 'receipt', 'goods_inspection', 'inspection'].includes(invoiceExecutionType));
      if (!acceptanceId && !goodsReceiptId && !goodsInspectionId && !hasGenericExecutionEvidence) {
        throw requestError('Three-way match requires accepted execution evidence linked to the invoice.', 409);
      }
      if (hasGenericExecutionEvidence) {
        await this.assertInvoiceExecutionEligible(tx, contractId, {
          amount: 0,
          currency: invoice.currency,
          status: invoice.status,
          executionReferenceType: invoice.executionReferenceType ?? undefined,
          executionReferenceId: invoice.executionReferenceId ?? undefined,
          payload: objectPayload(invoice.payload)
        });
      }
      if (input.purchaseOrderId) {
        const purchaseOrder = await tx.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, contractId } });
        if (!purchaseOrder) throw requestError('Purchase order was not found for this contract.', 404);
      }
      if (input.scheduleId) {
        const schedule = await tx.contractDeliverySchedule.findFirst({ where: { id: input.scheduleId, contractId } });
        if (!schedule) throw requestError('Delivery schedule was not found for this contract.', 404);
      }
      if (acceptanceId) {
        const acceptance = await tx.contractAcceptance.findFirst({ where: { id: acceptanceId, contractId } });
        if (!acceptance) throw requestError('Acceptance was not found for this contract.', 404);
        if (acceptance.status !== ContractLifecycleItemStatus.APPROVED && acceptance.status !== ContractLifecycleItemStatus.CLOSED) {
          throw requestError('Three-way match requires an approved acceptance.', 409);
        }
      }
      if (goodsReceiptId) {
        const receipt = await tx.contractGoodsReceipt.findFirst({ where: { id: goodsReceiptId, contractId }, include: { lines: true } });
        if (!receipt) throw requestError('Goods receipt was not found for this contract.', 404);
        const acceptedQuantity = receipt.lines.reduce((total, line) => total + Number(line.acceptedQuantity ?? 0), 0);
        if (receipt.status !== ContractLifecycleItemStatus.APPROVED && receipt.status !== ContractLifecycleItemStatus.CLOSED && acceptedQuantity <= 0) {
          throw requestError('Three-way match requires an approved goods receipt or accepted quantity.', 409);
        }
      }
      if (goodsInspectionId) {
        const inspection = await tx.goodsInspection.findFirst({ where: { id: goodsInspectionId, contractId } });
        if (!inspection) throw requestError('Goods inspection was not found for this contract.', 404);
        if (inspection.result !== ContractLifecycleItemStatus.APPROVED) {
          throw requestError('Three-way match requires an approved goods inspection.', 409);
        }
      }
      const matched = Boolean(input.poMatched && input.receiptMatched && input.invoiceMatched);
      const status = matched ? InvoiceStatus.MATCHED : (input.status === InvoiceStatus.REJECTED || input.status === InvoiceStatus.BLOCKED ? input.status : InvoiceStatus.REVIEW);
      const mismatchType = matched
        ? null
        : input.mismatchType || (!acceptanceId && !goodsReceiptId && !goodsInspectionId
          ? hasGenericExecutionEvidence ? 'EXECUTION_EVIDENCE_REVIEW' : 'MISSING_ACCEPTANCE'
          : !input.receiptMatched
            ? 'QUANTITY_OR_RECEIPT_MISMATCH'
            : !input.invoiceMatched || Number(input.varianceAmount ?? 0) !== 0
              ? 'PRICE_OR_AMOUNT_VARIANCE'
              : !input.poMatched
                ? 'ORDER_REFERENCE_MISMATCH'
                : 'MATCH_REVIEW_REQUIRED');
      await tx.threeWayMatchResult.upsert({
        where: { invoiceId: input.invoiceId },
        update: {
          contractId,
          purchaseOrderId: input.purchaseOrderId,
          acceptanceId,
          goodsReceiptId,
          goodsInspectionId,
          scheduleId: input.scheduleId,
          status,
          poMatched: input.poMatched ?? false,
          receiptMatched: input.receiptMatched ?? false,
          invoiceMatched: input.invoiceMatched ?? false,
          varianceAmount: input.varianceAmount,
          currency: input.currency,
          mismatchType,
          reviewerUserId: context.userId ?? null,
          reviewedAt: new Date(),
          note: input.note || null,
          payload: { ...input.payload, executionReferenceType: invoice.executionReferenceType, executionReferenceId: invoice.executionReferenceId } as Prisma.InputJsonObject
        },
        create: {
          contractId,
          invoiceId: input.invoiceId,
          purchaseOrderId: input.purchaseOrderId,
          acceptanceId,
          goodsReceiptId,
          goodsInspectionId,
          scheduleId: input.scheduleId,
          status,
          poMatched: input.poMatched ?? false,
          receiptMatched: input.receiptMatched ?? false,
          invoiceMatched: input.invoiceMatched ?? false,
          varianceAmount: input.varianceAmount,
          currency: input.currency,
          mismatchType,
          reviewerUserId: context.userId ?? null,
          reviewedAt: new Date(),
          note: input.note || null,
          payload: { ...input.payload, executionReferenceType: invoice.executionReferenceType, executionReferenceId: invoice.executionReferenceId } as Prisma.InputJsonObject
        }
      });
      await tx.invoice.update({ where: { id: input.invoiceId }, data: { status } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.three_way_match.upserted', 'contract', contractId, { invoiceId: input.invoiceId, status });
    });
    return this.getContract(contractId, context);
  }

  async createPaymentApproval(contractId: string, input: PaymentApprovalInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      if (input.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
        if (!invoice || invoice.contractId !== contractId) throw requestError('Invoice was not found for this contract.', 404);
        const approvalEligibleStatuses: InvoiceStatus[] = [InvoiceStatus.MATCHED];
        if (!approvalEligibleStatuses.includes(invoice.status)) {
          throw requestError('Invoice must be matched before payment approval.', 409);
        }
        if (input.amountApproved !== undefined && Number(input.amountApproved) > Number(invoice.amount)) {
          throw requestError('Payment approval cannot exceed the matched invoice amount.', 409);
        }
        const duplicatePaidOrApproved = await tx.paymentApproval.count({
          where: {
            invoiceId: input.invoiceId,
            status: { in: [InvoiceStatus.MATCHED, InvoiceStatus.PAID] }
          }
        });
        if (duplicatePaidOrApproved > 0) throw requestError('This invoice already has a payment approval.', 409);
        const approvedTotal = await tx.paymentApproval.aggregate({
          where: {
            contractId,
            status: { in: [InvoiceStatus.MATCHED, InvoiceStatus.PAID] }
          },
          _sum: { amountApproved: true }
        });
        const nextTotal = Number(approvedTotal._sum.amountApproved ?? 0) + Number(input.amountApproved ?? invoice.amount ?? 0);
        if (contract.amount !== null && nextTotal > Number(contract.amount)) {
          throw requestError('Payment approvals cannot exceed the contract value.', 409);
        }
        const match = await tx.threeWayMatchResult.findUnique({ where: { invoiceId: input.invoiceId } });
        const matched = Boolean(match?.poMatched && match.receiptMatched && match.invoiceMatched && match.status === InvoiceStatus.MATCHED);
        if (!matched) throw requestError('Resolve three-way matching exceptions before approving payment.', 409);
      }
      const status = input.status ?? InvoiceStatus.MATCHED;
      await tx.paymentApproval.create({
        data: {
          contractId,
          invoiceId: input.invoiceId,
          paymentId: input.paymentId,
          stepKey: input.stepKey,
          role: input.role,
          status,
          amountApproved: input.amountApproved,
          currency: input.currency,
          actorUserId: context.userId ?? null,
          decidedAt: terminalInvoiceStatuses.includes(status) ? new Date() : null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.invoiceId && invoiceDecisionStatuses.includes(status)) {
        await tx.invoice.update({ where: { id: input.invoiceId }, data: { status } });
      }
      await signSensitiveAction(tx, {
        userId: requireUserId(context),
        organizationId: context.organizationId ?? contract.buyerOrgId,
        signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
        moduleKey: 'award-contract',
        actionKey: 'payment.approve',
        entityType: 'contract',
        entityRef: contractId,
        payload: {
          contractId,
          invoiceId: input.invoiceId ?? null,
          paymentId: input.paymentId ?? null,
          status,
          amountApproved: input.amountApproved ?? null,
          currency: input.currency,
          stepKey: input.stepKey
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.payment_approval.created', 'contract', contractId, { stepKey: input.stepKey, status });
    });
    return this.getContract(contractId, context);
  }

  async verifyInvoiceFinance(contractId: string, invoiceId: string, action: 'verify' | 'return' | 'reject', input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.contractId !== contractId) throw requestError('Invoice was not found for this contract.', 404);
      const currentPayload = objectPayload(invoice.payload);
      const status = action === 'verify' ? InvoiceStatus.REVIEW : action === 'return' ? InvoiceStatus.BLOCKED : InvoiceStatus.REJECTED;
      const verificationStatuses = new Set<InvoiceStatus>([InvoiceStatus.SUBMITTED, InvoiceStatus.REVIEW, InvoiceStatus.MATCHED]);
      if (action === 'verify' && !verificationStatuses.has(invoice.status)) {
        throw requestError('Only submitted, review, or matched invoices can be verified.', 409);
      }
      if ((action === 'return' || action === 'reject') && invoice.status === InvoiceStatus.PAID) {
        throw requestError('Paid invoices cannot be returned or rejected.', 409);
      }
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status,
          payload: {
            ...currentPayload,
            financeVerification: {
              action,
              note: input.note ?? '',
              decision: input.decision ?? '',
              privateNote: input.privateNote ?? '',
              correctionReason: action === 'return' ? input.response || input.note || input.decision || '' : '',
              reviewedByUserId: context.userId ?? null,
              reviewedAt: new Date().toISOString(),
              visibilityScope: input.visibilityScope ?? (action === 'return' ? 'SHARED' : 'BUYER_PRIVATE')
            },
            ...input.payload
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, `contract.invoice.finance_${action}`, 'contract', contractId, { invoiceId, status });
    });
    return this.getContract(contractId, context);
  }

  async correctInvoiceFinance(contractId: string, invoiceId: string, input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.contractId !== contractId) throw requestError('Invoice was not found for this contract.', 404);
      const correctableStatuses = new Set<InvoiceStatus>([InvoiceStatus.BLOCKED, InvoiceStatus.REJECTED, InvoiceStatus.REVIEW]);
      if (!correctableStatuses.has(invoice.status)) {
        throw requestError('Only returned, rejected, or review invoices can be corrected by the supplier.', 409);
      }
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.SUBMITTED,
          payload: {
            ...objectPayload(invoice.payload),
            ...input.payload,
            supplierCorrection: {
              note: input.note ?? input.response ?? '',
              correctedByUserId: context.userId ?? null,
              correctedAt: new Date().toISOString()
            }
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.invoice.finance_corrected', 'contract', contractId, { invoiceId });
    });
    return this.getContract(contractId, context);
  }

  async createPaymentRecommendation(contractId: string, input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      if (!input.invoiceId) throw requestError('Payment recommendation requires an invoice.', 400);
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
      if (!invoice || invoice.contractId !== contractId) throw requestError('Invoice was not found for this contract.', 404);
      const exceptionApproved = objectPayload(input.payload).exceptionApproved === true || objectPayload(invoice.payload).exceptionApproved === true;
      if (invoice.status !== InvoiceStatus.MATCHED && !exceptionApproved) {
        throw requestError('Payment recommendation requires a matched invoice or approved exception handling.', 409);
      }
      const duplicate = await tx.paymentApproval.findFirst({
        where: {
          contractId,
          invoiceId: input.invoiceId,
          stepKey: { in: ['payment-recommendation', 'finance-payment-recommendation'] },
          status: { in: [InvoiceStatus.REVIEW, InvoiceStatus.MATCHED, InvoiceStatus.PAID] }
        }
      });
      if (duplicate) throw requestError('This invoice already has an open payment recommendation.', 409);
      const amountApproved = input.amountApproved ?? input.amount ?? Number(invoice.amount ?? 0);
      if (amountApproved > Number(invoice.amount ?? 0)) throw requestError('Payment recommendation cannot exceed the invoice amount.', 409);
      await tx.paymentApproval.create({
        data: {
          contractId,
          invoiceId: input.invoiceId,
          paymentId: input.paymentId,
          stepKey: 'payment-recommendation',
          role: 'FINANCE_REVIEWER',
          status: InvoiceStatus.REVIEW,
          amountApproved,
          currency: input.currency || invoice.currency,
          actorUserId: context.userId ?? null,
          decidedAt: null,
          note: input.note || null,
          payload: {
            ...input.payload,
            recommendedAt: new Date().toISOString(),
            recommendedByUserId: context.userId ?? null,
            privateNote: input.privateNote ?? null,
            visibilityScope: input.visibilityScope ?? 'BUYER_PRIVATE'
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.payment_recommendation.created', 'contract', contractId, { invoiceId: input.invoiceId, amountApproved });
    });
    return this.getContract(contractId, context);
  }

  async reviewPaymentApproval(contractId: string, approvalId: string, action: 'review' | 'approve' | 'reject', input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const approval = await tx.paymentApproval.findUnique({ where: { id: approvalId } });
      if (!approval || approval.contractId !== contractId) throw requestError('Payment approval was not found for this contract.', 404);
      if (approval.status === InvoiceStatus.PAID) throw requestError('Paid approvals cannot be changed.', 409);
      let status: InvoiceStatus = InvoiceStatus.REVIEW;
      if (action === 'approve') {
        status = InvoiceStatus.MATCHED;
        if (approval.invoiceId) {
          const invoice = await tx.invoice.findUnique({ where: { id: approval.invoiceId } });
          if (!invoice || invoice.contractId !== contractId) throw requestError('Linked invoice was not found for this contract.', 404);
          if (invoice.status !== InvoiceStatus.MATCHED) throw requestError('Payment approval requires a matched invoice.', 409);
          const match = await tx.threeWayMatchResult.findUnique({ where: { invoiceId: approval.invoiceId } });
          const matched = Boolean(match?.poMatched && match.receiptMatched && match.invoiceMatched && match.status === InvoiceStatus.MATCHED);
          const exceptionApproved = objectPayload(approval.payload).exceptionApproved === true || objectPayload(input.payload).exceptionApproved === true;
          if (!matched && !exceptionApproved) throw requestError('Resolve three-way matching exceptions before approving payment.', 409);
        }
        await signSensitiveAction(tx, {
          userId: requireUserId(context),
          organizationId: context.organizationId ?? contract.buyerOrgId,
          signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
          moduleKey: 'award-contract',
          actionKey: 'payment.approve',
          entityType: 'contract',
          entityRef: contractId,
          payload: {
            contractId,
            approvalId,
            invoiceId: approval.invoiceId ?? null,
            paymentId: approval.paymentId ?? null,
            amountApproved: input.amountApproved ?? approval.amountApproved ?? null,
            currency: input.currency ?? approval.currency,
            stepKey: approval.stepKey
          }
        });
      } else if (action === 'reject') {
        status = InvoiceStatus.REJECTED;
      }
      await tx.paymentApproval.update({
        where: { id: approvalId },
        data: {
          status,
          amountApproved: input.amountApproved ?? input.amount ?? approval.amountApproved,
          currency: input.currency ?? approval.currency,
          actorUserId: context.userId ?? approval.actorUserId,
          decidedAt: action === 'approve' || action === 'reject' ? new Date() : approval.decidedAt,
          note: input.note ?? approval.note,
          payload: {
            ...objectPayload(approval.payload),
            ...input.payload,
            financeApprovalAction: action,
            privateNote: input.privateNote ?? objectPayload(approval.payload).privateNote ?? null,
            reviewedAt: new Date().toISOString(),
            reviewedByUserId: context.userId ?? null,
            visibilityScope: input.visibilityScope ?? objectPayload(approval.payload).visibilityScope ?? 'BUYER_PRIVATE'
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, `contract.payment_approval.${action}`, 'contract', contractId, { approvalId, status });
    });
    return this.getContract(contractId, context);
  }

  async controlPayment(contractId: string, paymentId: string, action: 'initiate' | 'complete', input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const payment = await tx.contractPayment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.contractId !== contractId) throw requestError('Payment record was not found for this contract.', 404);
      const invoiceId = input.invoiceId ?? payment.invoiceId ?? undefined;
      if (invoiceId) {
        const approval = await tx.paymentApproval.findFirst({ where: { contractId, invoiceId, status: { in: [InvoiceStatus.MATCHED, InvoiceStatus.PAID] } } });
        if (!approval) throw requestError('Payment cannot proceed until a payment approval exists.', 409);
      }
      const status = action === 'complete' ? InvoiceStatus.PAID : InvoiceStatus.REVIEW;
      const grossAmount = input.grossAmount ?? Number(payment.grossAmount ?? 0);
      const retentionAmount = input.retentionAmount ?? Number(payment.retentionAmount ?? 0);
      const advanceRecovery = input.advanceRecovery ?? Number(payment.advanceRecovery ?? 0);
      const liquidatedDamages = input.liquidatedDamages ?? Number(payment.liquidatedDamages ?? 0);
      const taxWithholding = input.taxWithholding ?? Number(payment.taxWithholding ?? 0);
      const netAmount = input.netAmount ?? (grossAmount ? grossAmount - retentionAmount - advanceRecovery - liquidatedDamages - taxWithholding : Number(payment.netAmount ?? 0));
      const paidAt = action === 'complete' ? toDateTime(input.paidAt) ?? new Date() : payment.paidAt;
      await tx.contractPayment.update({
        where: { id: paymentId },
        data: {
          status,
          grossAmount,
          retentionAmount,
          advanceRecovery,
          liquidatedDamages,
          taxWithholding,
          netAmount,
          currency: input.currency ?? payment.currency,
          approvedByUserId: action === 'complete' ? context.userId ?? payment.approvedByUserId : payment.approvedByUserId,
          paidAt,
          note: input.note ?? payment.note,
          payload: {
            ...objectPayload(payment.payload),
            ...input.payload,
            financePaymentAction: action,
            paymentReference: input.reference ?? objectPayload(payment.payload).paymentReference ?? null,
            initiatedAt: action === 'initiate' ? new Date().toISOString() : objectPayload(payment.payload).initiatedAt ?? null,
            completedAt: action === 'complete' ? new Date().toISOString() : objectPayload(payment.payload).completedAt ?? null,
            privateNote: input.privateNote ?? objectPayload(payment.payload).privateNote ?? null,
            visibilityScope: input.visibilityScope ?? objectPayload(payment.payload).visibilityScope ?? 'BUYER_PRIVATE'
          } as Prisma.InputJsonObject
        }
      });
      if (invoiceId && action === 'complete') await tx.invoice.update({ where: { id: invoiceId }, data: { status: InvoiceStatus.PAID } });
      await this.audit(tx, contract.buyerOrgId, context.userId, `contract.payment.${action}`, 'contract', contractId, { paymentId, status });
    });
    return this.getContract(contractId, context);
  }

  async createPaymentConfirmation(contractId: string, input: PaymentConfirmationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      if (!context.isAdmin && context.organizationId !== contract.buyerOrgId && context.organizationId !== contract.supplierOrgId) {
        throw requestError('Buyer or Supplier contract access is required.', 403);
      }
      if (input.evidenceDocumentId) await this.assertDocumentVisible(tx, input.evidenceDocumentId, context);
      if (input.paymentId) {
        const payment = await tx.contractPayment.findUnique({ where: { id: input.paymentId } });
        if (!payment || payment.contractId !== contractId) throw requestError('Payment was not found for this contract.', 404);
        if (payment.status !== InvoiceStatus.PAID) throw requestError('Supplier receipt can only be confirmed after payment completion.', 409);
      }
      if (input.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
        if (!invoice || invoice.contractId !== contractId) throw requestError('Invoice was not found for this contract.', 404);
        if (invoice.status !== InvoiceStatus.PAID) throw requestError('Supplier receipt can only be confirmed after payment completion.', 409);
      }
      const paidAt = toDateTime(input.paidAt) ?? new Date();
      await tx.paymentConfirmation.create({
        data: {
          contractId,
          invoiceId: input.invoiceId,
          paymentId: input.paymentId,
          confirmationReference: input.confirmationReference || confirmationReference(),
          paidAmount: input.paidAmount,
          currency: input.currency,
          paidAt,
          evidenceDocumentId: input.evidenceDocumentId,
          confirmedByUserId: context.userId ?? null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.invoiceId) await tx.invoice.update({ where: { id: input.invoiceId }, data: { status: InvoiceStatus.PAID } });
      if (input.paymentId) await tx.contractPayment.update({ where: { id: input.paymentId }, data: { status: InvoiceStatus.PAID, paidAt } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.payment_confirmation.created', 'contract', contractId, { invoiceId: input.invoiceId, paidAmount: input.paidAmount });
    });
    return this.getContract(contractId, context);
  }

  async createPerformanceScore(contractId: string, input: PerformanceScoreInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.performanceScore.create({
        data: {
          contractId,
          supplierOrgId: contract.supplierOrgId,
          scoreType: input.scoreType,
          score: input.score,
          weight: input.weight,
          periodStart: toDate(input.periodStart),
          periodEnd: toDate(input.periodEnd),
          evaluatorUserId: context.userId ?? null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (contract.supplierOrgId) {
        const riskScore = Math.max(0, Math.min(100, Math.round(100 - input.score)));
        await tx.supplierRiskProfile.upsert({
          where: { supplierOrgId: contract.supplierOrgId },
          update: { riskScore, lastReviewedAt: new Date(), reviewerUserId: context.userId ?? null },
          create: {
            supplierOrgId: contract.supplierOrgId,
            riskScore,
            riskLevel: riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW',
            trustTier: 'VERIFIED',
            lastReviewedAt: new Date(),
            reviewerUserId: context.userId ?? null,
            summary: `Updated from ${input.scoreType} performance score.`,
            drivers: [{ scoreType: input.scoreType, score: input.score }] as Prisma.InputJsonArray,
            payload: {} as Prisma.InputJsonObject
          }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.performance_score.created', 'contract', contractId, { scoreType: input.scoreType, score: input.score });
    });
    return this.getContract(contractId, context);
  }

  async createRiskForecast(contractId: string, input: RiskForecastInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.riskForecast.create({
        data: {
          contractId,
          supplierOrgId: input.supplierOrgId ?? contract.supplierOrgId,
          tenderId: input.tenderId ?? contract.tenderId,
          forecastType: input.forecastType,
          horizonDays: input.horizonDays ?? 30,
          probability: input.probability,
          impactLevel: (input.impactLevel ?? 'MEDIUM') as any,
          status: input.status ?? 'OPEN',
          drivers: (input.drivers ?? []) as Prisma.InputJsonArray,
          recommendation: input.recommendation || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.risk_forecast.created', 'contract', contractId, { forecastType: input.forecastType, probability: input.probability });
    });
    return this.getContract(contractId, context);
  }

  async upsertSupplierRiskProfile(contractId: string, input: SupplierRiskProfileInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const supplierOrgId = input.supplierOrgId ?? contract.supplierOrgId;
      if (!supplierOrgId) throw requestError('Supplier organization is required for risk profile.', 409);
      const previous = await tx.supplierRiskProfile.findUnique({ where: { supplierOrgId } });
      const profile = await tx.supplierRiskProfile.upsert({
        where: { supplierOrgId },
        update: {
          riskLevel: input.riskLevel as any,
          riskScore: input.riskScore,
          trustTier: input.trustTier,
          activeAlerts: input.activeAlerts,
          openViolations: input.openViolations,
          lastReviewedAt: new Date(),
          reviewerUserId: context.userId ?? null,
          summary: input.summary || null,
          drivers: (input.drivers ?? []) as Prisma.InputJsonArray,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          supplierOrgId,
          riskLevel: (input.riskLevel ?? 'MEDIUM') as any,
          riskScore: input.riskScore ?? 50,
          trustTier: input.trustTier ?? 'UNVERIFIED',
          activeAlerts: input.activeAlerts ?? 0,
          openViolations: input.openViolations ?? 0,
          lastReviewedAt: new Date(),
          reviewerUserId: context.userId ?? null,
          summary: input.summary || null,
          drivers: (input.drivers ?? []) as Prisma.InputJsonArray,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.supplier_risk_profile.upserted', 'contract', contractId, {
        supplierOrgId,
        previous: previous ? {
          riskLevel: previous.riskLevel,
          riskScore: previous.riskScore,
          trustTier: previous.trustTier,
          activeAlerts: previous.activeAlerts,
          openViolations: previous.openViolations,
          summary: previous.summary
        } : null,
        next: {
          riskLevel: profile.riskLevel,
          riskScore: profile.riskScore,
          trustTier: profile.trustTier,
          activeAlerts: profile.activeAlerts,
          openViolations: profile.openViolations,
          summary: profile.summary
        },
        reason: input.summary || ''
      });
    });
    return this.getContract(contractId, context);
  }

  async createRisk(contractId: string, input: RiskInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractRisk.create({
        data: {
          contractId,
          title: input.title,
          category: input.category || 'general',
          description: input.description || null,
          likelihood: input.likelihood ?? 1,
          impact: input.impact ?? 1,
          score: (input.likelihood ?? 1) * (input.impact ?? 1),
          level: input.level ?? riskLevelFromScore((input.likelihood ?? 1) * (input.impact ?? 1)),
          responsibleUserId: input.responsibleUserId,
          mitigationAction: input.mitigationAction || null,
          dueDate: toDate(input.dueDate),
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.risk.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async updateRisk(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.updateSimpleLifecycleItem('contractRisk', 'risk', contractId, itemId, input, context);
  }

  async createVariation(contractId: string, input: VariationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      await tx.contractVariation.create({
        data: {
          contractId,
          requestedByOrgId: context.organizationId ?? null,
          title: input.title,
          changeType: input.changeType,
          reason: input.description || input.note || input.title,
          affectedClause: input.affectedClause || null,
          costImpact: input.costImpact,
          timeImpactDays: input.timeImpactDays,
          technicalImpact: input.technicalImpact || null,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.variation.created', 'contract', contractId, { changeType: input.changeType });
    });
    return this.getContract(contractId, context);
  }

  async updateVariation(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const variation = await tx.contractVariation.findUnique({ where: { id: itemId }, include: { contract: { include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } } } } });
      if (!variation || variation.contractId !== contractId) throw requestError('variation item was not found.', 404);
      assertContractVisible(variation.contract, context);
      assertContractManager(variation.contract, context);
      await tx.contractVariation.update({
        where: { id: itemId },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.note !== undefined ? { decision: input.note || null } : {}),
          ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonObject } : {})
        }
      });
      if (input.status === ContractLifecycleItemStatus.APPROVED) {
        const currentAmount = decimalToNumber(variation.contract.amount) ?? 0;
        const costImpact = decimalToNumber(variation.costImpact) ?? 0;
        const versionNo = (variation.contract.versions[0]?.versionNo ?? 0) + 1;
        await tx.contract.update({
          where: { id: contractId },
          data: {
            amount: currentAmount + costImpact,
            payload: {
              ...objectPayload(variation.contract.payload),
              lastApprovedVariationId: variation.id,
              lastApprovedVariationAt: new Date().toISOString()
            } as Prisma.InputJsonObject
          }
        });
        await tx.contractVersion.create({
          data: {
            contractId,
            versionNo,
            payload: {
              source: 'approved_variation',
              variationId: variation.id,
              title: variation.title,
              costImpact,
              timeImpactDays: variation.timeImpactDays,
              decision: input.note ?? variation.decision ?? ''
            } as Prisma.InputJsonObject
          }
        });
        await signSensitiveAction(tx, {
          userId: requireUserId(context),
          organizationId: context.organizationId ?? variation.contract.buyerOrgId,
          signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
          moduleKey: 'award-contract',
          actionKey: 'variation.approve',
          entityType: 'contract_variation',
          entityRef: variation.id,
          payload: {
            contractId,
            variationId: variation.id,
            title: variation.title,
            costImpact,
            timeImpactDays: variation.timeImpactDays,
            versionNo,
            decision: input.note ?? variation.decision ?? ''
          }
        });
      }
      await this.audit(tx, variation.contract.buyerOrgId, context.userId, 'contract.variation.updated', 'contract', contractId, { itemId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async createIssue(contractId: string, input: LifecycleItemInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      await tx.contractIssue.create({
        data: {
          contractId,
          raisedByOrgId: context.organizationId ?? null,
          title: input.title,
          description: input.description || null,
          category: input.category || 'general',
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate),
          resolution: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.issue.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async updateIssue(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.updateSimpleLifecycleItem('contractIssue', 'issue', contractId, itemId, input, context);
  }

  async createDispute(contractId: string, input: LifecycleItemInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      await tx.contractDispute.create({
        data: {
          contractId,
          raisedByOrgId: context.organizationId ?? null,
          title: input.title,
          contractClause: String(input.payload.contractClause ?? '') || null,
          description: input.description || null,
          route: String(input.payload.route ?? '') || null,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          decision: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.dispute.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async updateDispute(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.updateSimpleLifecycleItem('contractDispute', 'dispute', contractId, itemId, input, context);
  }

  async createTermination(contractId: string, input: TerminationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractTermination.create({
        data: {
          contractId,
          terminationType: input.terminationType,
          initiatedByOrgId: context.organizationId ?? null,
          reason: input.reason,
          contractClause: input.contractClause || null,
          faultParty: input.faultParty || null,
          noticeDate: toDate(input.noticeDate),
          cureDeadline: toDate(input.cureDeadline),
          terminationEffectiveDate: toDate(input.terminationEffectiveDate),
          supplierResponse: input.supplierResponse || null,
          finalDecision: input.finalDecision || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.TERMINATION_REVIEW } });
      await tx.invoice.updateMany({
        where: { contractId, status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SUBMITTED, InvoiceStatus.REVIEW, InvoiceStatus.MATCHED] } },
        data: { status: InvoiceStatus.BLOCKED }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.termination.created', 'contract', contractId, { terminationType: input.terminationType });
    });
    return this.getContract(contractId, context);
  }

  async updateTermination(contractId: string, terminationId: string, input: TerminationPatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const termination = await tx.contractTermination.findUnique({ where: { id: terminationId }, include: { contract: true } });
      if (!termination || termination.contractId !== contractId) throw requestError('Termination record was not found.', 404);
      assertContractVisible(termination.contract, context);
      if (!context.isAdmin && termination.contract.buyerOrgId !== context.organizationId) {
        const supplierOnly = Object.entries(input).every(([key, value]) => value === undefined || ['supplierResponse', 'payload'].includes(key));
        if (!supplierOnly || termination.contract.supplierOrgId !== context.organizationId) {
          throw requestError('Buyer contract access is required for termination decisions.', 403);
        }
      }
      await tx.contractTermination.update({
        where: { id: termination.id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
          ...(input.contractClause !== undefined ? { contractClause: input.contractClause || null } : {}),
          ...(input.faultParty !== undefined ? { faultParty: input.faultParty || null } : {}),
          ...(input.noticeDate !== undefined ? { noticeDate: toDate(input.noticeDate) ?? null } : {}),
          ...(input.cureDeadline !== undefined ? { cureDeadline: toDate(input.cureDeadline) ?? null } : {}),
          ...(input.terminationEffectiveDate !== undefined ? { terminationEffectiveDate: toDate(input.terminationEffectiveDate) ?? null } : {}),
          ...(input.supplierResponse !== undefined ? { supplierResponse: input.supplierResponse || null } : {}),
          ...(input.finalDecision !== undefined ? { finalDecision: input.finalDecision || null } : {}),
          ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonObject } : {})
        }
      });
      if (input.status === ContractTerminationStatus.TERMINATED) {
        await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.TERMINATED } });
      }
      if (input.status === ContractTerminationStatus.APPROVED || input.status === ContractTerminationStatus.TERMINATED) {
        await signSensitiveAction(tx, {
          userId: requireUserId(context),
          organizationId: context.organizationId ?? termination.contract.buyerOrgId,
          signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
          moduleKey: 'award-contract',
          actionKey: input.status === ContractTerminationStatus.TERMINATED ? 'termination.finalize' : 'termination.approve',
          entityType: 'contract_termination',
          entityRef: termination.id,
          payload: {
            contractId,
            terminationId: termination.id,
            previousStatus: termination.status,
            nextStatus: input.status,
            finalDecision: input.finalDecision ?? termination.finalDecision ?? null
          }
        });
      }
      await this.audit(tx, termination.contract.buyerOrgId, context.userId, 'contract.termination.updated', 'contract', contractId, { terminationId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async addTerminationNotice(contractId: string, terminationId: string, input: TerminationNoticeInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const termination = await this.requireTermination(tx, contractId, terminationId, context);
      assertContractManager(termination.contract, context);
      await tx.terminationNotice.create({
        data: {
          terminationId,
          noticeType: input.noticeType,
          contractClause: input.contractClause || null,
          requiredAction: input.requiredAction || null,
          deadline: toDate(input.deadline),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await tx.contractTermination.update({ where: { id: terminationId }, data: { status: ContractTerminationStatus.NOTICE_ISSUED, noticeDate: new Date() } });
      await this.audit(tx, termination.contract.buyerOrgId, context.userId, 'contract.termination.notice_created', 'contract', contractId, { terminationId });
    });
    return this.getContract(contractId, context);
  }

  async addTerminationEvidence(contractId: string, terminationId: string, input: TerminationEvidenceInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const termination = await this.requireTermination(tx, contractId, terminationId, context);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      await tx.terminationEvidence.create({
        data: {
          terminationId,
          documentId: input.documentId,
          evidenceType: input.evidenceType,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, termination.contract.buyerOrgId, context.userId, 'contract.termination.evidence_added', 'contract', contractId, { terminationId });
    });
    return this.getContract(contractId, context);
  }

  async upsertTerminationValuation(contractId: string, terminationId: string, input: TerminationValuationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const termination = await this.requireTermination(tx, contractId, terminationId, context);
      assertContractManager(termination.contract, context);
      await tx.terminationValuation.upsert({
        where: { terminationId },
        update: { ...input, payload: input.payload as Prisma.InputJsonObject },
        create: { terminationId, ...input, payload: input.payload as Prisma.InputJsonObject }
      });
      await this.audit(tx, termination.contract.buyerOrgId, context.userId, 'contract.termination.valuation_upserted', 'contract', contractId, { terminationId });
    });
    return this.getContract(contractId, context);
  }

  async upsertTerminationSettlement(contractId: string, terminationId: string, input: TerminationSettlementInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const termination = await this.requireTermination(tx, contractId, terminationId, context);
      assertContractManager(termination.contract, context);
      await tx.terminationSettlement.upsert({
        where: { terminationId },
        update: {
          status: input.status,
          settlementNote: input.settlementNote || null,
          settledAt: toDateTime(input.settledAt),
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          terminationId,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          settlementNote: input.settlementNote || null,
          settledAt: toDateTime(input.settledAt),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, termination.contract.buyerOrgId, context.userId, 'contract.termination.settlement_upserted', 'contract', contractId, { terminationId });
    });
    return this.getContract(contractId, context);
  }

  async upsertReplacementProcurement(contractId: string, terminationId: string, input: ReplacementProcurementInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const termination = await this.requireTermination(tx, contractId, terminationId, context);
      assertContractManager(termination.contract, context);
      await tx.replacementProcurementPlan.upsert({
        where: { terminationId },
        update: {
          method: input.method,
          urgencyLevel: input.urgencyLevel ?? ContractRiskLevel.MEDIUM,
          remainingScope: input.remainingScope || null,
          estimatedCost: input.estimatedCost,
          currency: input.currency,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          terminationId,
          method: input.method,
          urgencyLevel: input.urgencyLevel ?? ContractRiskLevel.MEDIUM,
          remainingScope: input.remainingScope || null,
          estimatedCost: input.estimatedCost,
          currency: input.currency,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, termination.contract.buyerOrgId, context.userId, 'contract.termination.replacement_procurement_upserted', 'contract', contractId, { terminationId });
    });
    return this.getContract(contractId, context);
  }

  async upsertCloseout(contractId: string, input: ContractCloseoutInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractCloseout.upsert({
        where: { contractId },
        update: {
          status: input.status,
          completionCertificate: input.completionCertificate,
          finalAccountApproved: input.finalAccountApproved,
          warrantyStartDate: toDate(input.warrantyStartDate),
          warrantyEndDate: toDate(input.warrantyEndDate),
          lessonsLearned: input.lessonsLearned || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          completionCertificate: input.completionCertificate ?? false,
          finalAccountApproved: input.finalAccountApproved ?? false,
          warrantyStartDate: toDate(input.warrantyStartDate),
          warrantyEndDate: toDate(input.warrantyEndDate),
          lessonsLearned: input.lessonsLearned || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.status === ContractLifecycleItemStatus.CLOSED) await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.CLOSED } });
      if (input.status === ContractLifecycleItemStatus.CLOSED || input.completionCertificate || input.finalAccountApproved) {
        await signSensitiveAction(tx, {
          userId: requireUserId(context),
          organizationId: context.organizationId ?? contract.buyerOrgId,
          signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
          moduleKey: 'award-contract',
          actionKey: input.status === ContractLifecycleItemStatus.CLOSED ? 'closeout.complete' : 'closeout.certificate_approve',
          entityType: 'contract',
          entityRef: contractId,
          payload: {
            contractId,
            status: input.status ?? null,
            completionCertificate: input.completionCertificate ?? null,
            finalAccountApproved: input.finalAccountApproved ?? null
          }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.closeout.upserted', 'contract', contractId, { status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async updateCloseoutStep(contractId: string, stepId: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const existing = await tx.contractCloseout.findUnique({ where: { contractId } });
      const existingPayload = objectPayload(existing?.payload);
      const steps = objectPayload(existingPayload.steps);
      const nextSteps = {
        ...steps,
        [stepId]: {
          status: input.status ?? ContractLifecycleItemStatus.APPROVED,
          decision: input.decision ?? null,
          note: input.note ?? null,
          privateNote: input.privateNote ?? objectPayload(steps[stepId]).privateNote ?? null,
          updatedAt: new Date().toISOString(),
          updatedByUserId: context.userId ?? null,
          payload: objectPayload(input.payload)
        }
      };
      await tx.contractCloseout.upsert({
        where: { contractId },
        update: {
          status: existing?.status ?? ContractLifecycleItemStatus.OPEN,
          payload: {
            ...existingPayload,
            steps: nextSteps,
            lastStepId: stepId
          } as Prisma.InputJsonObject
        },
        create: {
          contractId,
          status: ContractLifecycleItemStatus.OPEN,
          payload: {
            steps: nextSteps,
            lastStepId: stepId,
            source: 'post_award_closeout_wizard'
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.closeout.step_updated', 'contract', contractId, { stepId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async upsertSupplierPerformance(contractId: string, input: SupplierPerformanceInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.supplierPerformanceRecord.create({
        data: {
          contractId,
          buyerOrgId: contract.buyerOrgId,
          supplierOrgId: contract.supplierOrgId,
          overallScore: input.overallScore,
          timeScore: input.timeScore,
          qualityScore: input.qualityScore,
          costScore: input.costScore,
          complianceScore: input.complianceScore,
          terminationFault: input.terminationFault || null,
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.performance.created', 'contract', contractId, {});
    });
    return this.getContract(contractId, context);
  }

  async updateInvoiceStatus(contractId: string, invoiceId: string, input: InvoiceStatusPatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: input.status,
          payload: {
            statusNote: input.note,
            reviewedAt: new Date().toISOString()
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.invoice.status_updated', 'contract', contractId, { invoiceId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async upsertClause(contractId: string, input: ClauseInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractClause.upsert({
        where: { contractId_clauseKey: { contractId, clauseKey: input.clauseKey } },
        update: {
          title: input.title,
          body: input.body || null,
          category: input.category || 'general',
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          buyerComment: input.buyerComment || null,
          supplierComment: input.supplierComment || null,
          legalComment: input.legalComment || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          clauseKey: input.clauseKey,
          title: input.title,
          body: input.body || null,
          category: input.category || 'general',
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          buyerComment: input.buyerComment || null,
          supplierComment: input.supplierComment || null,
          legalComment: input.legalComment || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.clause.upserted', 'contract', contractId, { clauseKey: input.clauseKey });
    });
    return this.getContract(contractId, context);
  }

  async deleteClause(contractId: string, clauseId: string, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const clause = await tx.contractClause.findFirst({ where: { id: clauseId, contractId } });
      if (!clause) throw requestError('Contract clause was not found.', 404);
      await tx.contractClause.delete({ where: { id: clause.id } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.clause.deleted', 'contract', contractId, { clauseId, clauseKey: clause.clauseKey });
    });
    return this.getContract(contractId, context);
  }

  async createNegotiation(contractId: string, input: NegotiationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId }, include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } } });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      if (contract.status !== ContractStatus.NEGOTIATION) throw requestError('Contract negotiation starts after the buyer sends a draft for negotiation.', 409);
      if (!context.isAdmin && context.organizationId !== contract.supplierOrgId && context.organizationId !== contract.buyerOrgId) {
        throw requestError('You do not have access to this contract negotiation.', 403);
      }
      const payload = objectPayload(input.payload);
      const requestType = input.requestType ?? (String(payload.requestType ?? '').toUpperCase() === 'CLARIFICATION' ? 'CLARIFICATION' : 'AMENDMENT');
      await tx.contractNegotiation.create({
        data: {
          contractId,
          clauseId: input.clauseId,
          raisedByRole: input.raisedByRole,
          raisedByOrgId: context.organizationId ?? null,
          subject: input.subject,
          position: input.position || null,
          counterOffer: input.counterOffer || null,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate),
          payload: {
            ...payload,
            requestType,
            linkedVersionNo: contract.versions[0]?.versionNo ?? null,
            decisionReason: null,
            redraftRequired: false
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.negotiation.created', 'contract', contractId, { subject: input.subject });
    });
    return this.getContract(contractId, context);
  }

  async updateNegotiation(contractId: string, negotiationId: string, input: ContractNegotiationDecisionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const negotiation = await tx.contractNegotiation.findUnique({ where: { id: negotiationId }, include: { contract: true } });
      if (!negotiation || negotiation.contractId !== contractId) throw requestError('Contract negotiation request was not found.', 404);
      assertContractVisible(negotiation.contract, context);
      assertContractManager(negotiation.contract, context);
      const payload = objectPayload(negotiation.payload);
      const requestType = String(payload.requestType ?? '').toUpperCase();
      const acceptedAmendment = input.status === ContractLifecycleItemStatus.APPROVED && requestType === 'AMENDMENT';
      await tx.contractNegotiation.update({
        where: { id: negotiation.id },
        data: {
          status: input.status,
          payload: {
            ...payload,
            ...input.payload,
            decisionReason: input.reason,
            decidedByOrgId: context.organizationId ?? null,
            decidedAt: new Date().toISOString(),
            redraftRequired: acceptedAmendment
          } as Prisma.InputJsonObject
        }
      });
      if (acceptedAmendment) {
        await tx.contract.update({
          where: { id: contractId },
          data: {
            status: ContractStatus.DRAFT,
            payload: {
              ...objectPayload(negotiation.contract.payload),
              redraftRequired: true,
              redraftReason: input.reason,
              redraftNegotiationId: negotiation.id,
              redraftRequestedAt: new Date().toISOString()
            } as Prisma.InputJsonObject
          }
        });
      }
      await this.audit(tx, negotiation.contract.buyerOrgId, context.userId, 'contract.negotiation.updated', 'contract', contractId, {
        negotiationId,
        status: input.status,
        redraftRequired: acceptedAmendment
      });
    });
    return this.getContract(contractId, context);
  }

  async createDeliverable(contractId: string, input: DeliverableInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      assertContractSupplier(contract, context);
      await tx.contractDeliverable.create({
        data: {
          contractId,
          milestoneId: input.milestoneId,
          title: input.title,
          description: input.description || null,
          submittedByOrgId: context.organizationId ?? null,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          dueDate: toDate(input.dueDate),
          submittedAt: toDateTime(input.submittedAt),
          acceptanceNote: input.acceptanceNote || input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.deliverable.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async createAcceptance(contractId: string, input: AcceptanceInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const acceptancePayload = objectPayload(input.payload);
      const finalDraftRole = acceptancePayload.acceptanceType === 'NEGOTIATED_DRAFT' ? String(acceptancePayload.role ?? '').toUpperCase() : '';
      const isFinalDraftAcceptance = finalDraftRole === 'BUYER' || finalDraftRole === 'SUPPLIER';
      const contract = await this.requireContract(tx, contractId, context, !isFinalDraftAcceptance);
      if (finalDraftRole === 'BUYER') assertContractManager(contract, context);
      if (finalDraftRole === 'SUPPLIER') assertContractSupplier(contract, context);
      const hasExecutionLink = Boolean(input.deliverableId || input.inspectionId || input.goodsReceiptId || input.goodsInspectionId);
      if (!isFinalDraftAcceptance && !hasExecutionLink) {
        throw requestError('Acceptance requires linked deliverable, inspection, goods receipt, or goods inspection evidence.', 409);
      }
      const status = input.status ?? ContractLifecycleItemStatus.APPROVED;
      let acceptedValue = input.acceptedValue;
      if (input.deliverableId) {
        const deliverable = await tx.contractDeliverable.findFirst({ where: { id: input.deliverableId, contractId } });
        if (!deliverable) throw requestError('Deliverable was not found for this contract.', 404);
      }
      if (input.inspectionId) {
        const inspection = await tx.contractInspection.findFirst({ where: { id: input.inspectionId, contractId } });
        if (!inspection) throw requestError('Inspection was not found for this contract.', 404);
        if (status === ContractLifecycleItemStatus.APPROVED && inspection.result !== ContractLifecycleItemStatus.APPROVED) {
          throw requestError('Acceptance requires an approved inspection.', 409);
        }
      }
      if (input.goodsReceiptId) {
        const receipt = await tx.contractGoodsReceipt.findFirst({ where: { id: input.goodsReceiptId, contractId }, include: { lines: true } });
        if (!receipt) throw requestError('Goods receipt was not found for this contract.', 404);
        const acceptedQuantity = receipt.lines.reduce((total, line) => total + Number(line.acceptedQuantity ?? 0), 0);
        const approvedReceipt = receipt.status === ContractLifecycleItemStatus.APPROVED || receipt.status === ContractLifecycleItemStatus.CLOSED;
        if (status === ContractLifecycleItemStatus.APPROVED && !approvedReceipt && acceptedQuantity <= 0) {
          throw requestError('Goods acceptance requires an approved receipt or accepted quantity.', 409);
        }
        acceptedValue ??= acceptedReceiptValue(receipt) ?? undefined;
      }
      if (input.goodsInspectionId) {
        const inspection = await tx.goodsInspection.findFirst({ where: { id: input.goodsInspectionId, contractId } });
        if (!inspection) throw requestError('Goods inspection was not found for this contract.', 404);
        if (status === ContractLifecycleItemStatus.APPROVED && inspection.result !== ContractLifecycleItemStatus.APPROVED) {
          throw requestError('Goods acceptance requires an approved goods inspection.', 409);
        }
        acceptedValue ??= goodsInspectionAcceptedValue(inspection) ?? undefined;
      }
      const certificateNo = input.certificateNo || acceptanceCertificateReference();
      await tx.contractAcceptance.create({
        data: {
          contractId,
          deliverableId: input.deliverableId,
          inspectionId: input.inspectionId,
          goodsReceiptId: input.goodsReceiptId,
          goodsInspectionId: input.goodsInspectionId,
          certificateNo,
          status,
          acceptedValue,
          currency: input.currency,
          acceptedAt: toDateTime(input.acceptedAt) ?? new Date(),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.deliverableId) {
        await tx.contractDeliverable.update({ where: { id: input.deliverableId }, data: { status, reviewedAt: new Date() } });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.acceptance.created', 'contract', contractId, { certificateNo });
    });
    return this.getContract(contractId, context);
  }

  async createPaymentSchedule(contractId: string, input: PaymentScheduleInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractPaymentSchedule.create({
        data: {
          contractId,
          milestoneId: input.milestoneId,
          title: input.title,
          amount: input.amount,
          currency: input.currency,
          dueDate: toDate(input.dueDate),
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.payment_schedule.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async createPayment(contractId: string, input: ContractPaymentInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const status = input.status ?? InvoiceStatus.REVIEW;
      if (contract.status === ContractStatus.TERMINATION_REVIEW && status !== InvoiceStatus.BLOCKED && status !== InvoiceStatus.REJECTED) {
        throw requestError('Payments are on hold while termination review is active.', 409);
      }
      const deductions = (input.retentionAmount ?? 0) + (input.advanceRecovery ?? 0) + (input.liquidatedDamages ?? 0) + (input.taxWithholding ?? 0);
      const netAmount = input.netAmount ?? (input.grossAmount === undefined ? undefined : input.grossAmount - deductions);
      await tx.contractPayment.create({
        data: {
          contractId,
          invoiceId: input.invoiceId,
          scheduleId: input.scheduleId,
          status,
          grossAmount: input.grossAmount,
          retentionAmount: input.retentionAmount,
          advanceRecovery: input.advanceRecovery,
          liquidatedDamages: input.liquidatedDamages,
          taxWithholding: input.taxWithholding,
          netAmount,
          currency: input.currency,
          reviewedByUserId: context.userId ?? null,
          approvedByUserId: status === InvoiceStatus.PAID || status === InvoiceStatus.MATCHED ? context.userId ?? null : null,
          paidAt: toDateTime(input.paidAt) ?? (status === InvoiceStatus.PAID ? new Date() : undefined),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.invoiceId) {
        await tx.invoice.update({ where: { id: input.invoiceId }, data: { status } });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.payment.created', 'contract', contractId, { status, invoiceId: input.invoiceId });
    });
    return this.getContract(contractId, context);
  }

  async upsertWarranty(contractId: string, input: WarrantyInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      await tx.contractWarranty.create({
        data: {
          contractId,
          title: input.title,
          defectReference: input.defectReference || null,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          startDate: toDate(input.startDate),
          endDate: toDate(input.endDate ?? input.dueDate),
          responsibleRole: input.responsibleRole || null,
          resolution: input.note || input.description || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.warranty.created', 'contract', contractId, { title: input.title });
    });
    return this.getContract(contractId, context);
  }

  async controlWarranty(contractId: string, warrantyId: string, action: 'respond' | 'verify' | 'close', input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const warranty = await tx.contractWarranty.findUnique({ where: { id: warrantyId }, include: { contract: true } });
      if (!warranty || warranty.contractId !== contractId) throw requestError('Warranty item was not found.', 404);
      assertContractVisible(warranty.contract, context);
      if (action === 'respond') assertContractSupplier(warranty.contract, context);
      else assertContractManager(warranty.contract, context);
      const status =
        input.status
          ? String(input.status)
          : action === 'respond'
            ? ContractLifecycleItemStatus.SUBMITTED
            : action === 'verify'
              ? ContractLifecycleItemStatus.APPROVED
              : ContractLifecycleItemStatus.CLOSED;
      await tx.contractWarranty.update({
        where: { id: warranty.id },
        data: {
          status: status as ContractLifecycleItemStatus,
          resolution: input.response || input.note || warranty.resolution,
          payload: {
            ...objectPayload(warranty.payload),
            ...objectPayload(input.payload),
            workflowAction: action,
            response: input.response ?? null,
            decision: input.decision ?? status,
            privateNote: input.privateNote || objectPayload(warranty.payload).privateNote || null,
            visibilityScope: input.visibilityScope ?? objectPayload(warranty.payload).visibilityScope ?? 'SHARED',
            lastActionAt: new Date().toISOString(),
            lastActionByOrgId: context.organizationId ?? null
          } as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, warranty.contract.buyerOrgId, context.userId, `contract.warranty.${action}`, 'contract', contractId, { warrantyId, status });
    });
    return this.getContract(contractId, context);
  }

  async recalculateUrgentActions(contractId: string, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId }, include: contractInclude });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      const now = new Date();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const rows: Array<{ ownerOrgId: string | null; actionKey: string; title: string; requiredAction: string; riskLevel: string; dueDate: Date | null; nextRoute: string; payload: Prisma.InputJsonObject }> = [];
      for (const security of await tx.contractSecurity.findMany({ where: { contractId } })) {
        const expiry = security.expiryDate;
        const terminal = ['RELEASED', 'WAIVED', 'CLAIMED'].includes(String(security.verificationStatus).toUpperCase()) || ['CLAIMED', 'CLOSED'].includes(String(security.claimStatus).toUpperCase());
        if (!expiry || terminal) continue;
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (expiry.getTime() - now.getTime() <= thirtyDays) {
          rows.push({
            ownerOrgId: contract.buyerOrgId,
            actionKey: `${contractId}:security-expiry:${security.id}`,
            title: `${security.securityType} expiring`,
            requiredAction: days < 0 ? 'Expired security must be extended, claimed, released, or waived.' : 'Review, extend, claim, release, or waive this guarantee before expiry.',
            riskLevel: days < 0 ? 'Critical' : days <= 7 ? 'High' : 'Medium',
            dueDate: expiry,
            nextRoute: `/post-award?contract=${contractId}&stage=documents`,
            payload: { source: 'post_award_operational_recalc', securityId: security.id, daysToExpiry: days }
          });
        }
      }
      for (const warranty of contract.warranties) {
        if (!warranty.endDate || !isLifecycleOpen(warranty.status)) continue;
        const days = Math.ceil((warranty.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (warranty.endDate.getTime() - now.getTime() <= thirtyDays) {
          rows.push({
            ownerOrgId: contract.supplierOrgId ?? contract.buyerOrgId,
            actionKey: `${contractId}:warranty-expiry:${warranty.id}`,
            title: `${warranty.title} warranty action`,
            requiredAction: days < 0 ? 'Warranty item is overdue for resolution.' : 'Resolve or verify the warranty item before expiry.',
            riskLevel: days < 0 ? 'High' : 'Medium',
            dueDate: warranty.endDate,
            nextRoute: `/post-award?contract=${contractId}&stage=documents`,
            payload: { source: 'post_award_operational_recalc', warrantyId: warranty.id, daysToExpiry: days }
          });
        }
      }
      await tx.urgentAction.updateMany({
        where: { contractId, actionKey: { contains: `${contractId}:` }, status: 'OPEN' },
        data: { status: 'SUPERSEDED' }
      });
      for (const row of rows) {
        const ownerOrgId = row.ownerOrgId ?? contract.buyerOrgId;
        await tx.urgentAction.upsert({
          where: { ownerOrgId_actionKey: { ownerOrgId, actionKey: row.actionKey } },
          update: { ...row, ownerOrgId, contractId, status: 'OPEN' },
          create: { ...row, ownerOrgId, contractId, status: 'OPEN' }
        });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.urgent_actions.recalculated', 'contract', contractId, { count: rows.length });
    });
    return this.getContract(contractId, context);
  }

  async upsertRequiredDocument(contractId: string, input: RequiredDocumentInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
      if (/supplier/i.test(input.ownerRole)) assertContractSupplier(contract, context);
      else assertContractManager(contract, context);
      if (input.documentId) await this.assertDocumentVisible(tx, input.documentId, context);
      await tx.contractRequiredDocument.upsert({
        where: { contractId_documentType: { contractId, documentType: input.documentType } },
        update: {
          title: input.title,
          ownerRole: input.ownerRole,
          status: input.status ?? ContractLifecycleItemStatus.SUBMITTED,
          documentId: input.documentId,
          dueDate: toDate(input.dueDate),
          reviewedAt: toDateTime(input.reviewedAt),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          documentType: input.documentType,
          title: input.title,
          ownerRole: input.ownerRole,
          status: input.status ?? ContractLifecycleItemStatus.OPEN,
          documentId: input.documentId,
          dueDate: toDate(input.dueDate),
          reviewedAt: toDateTime(input.reviewedAt),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.required_document.upserted', 'contract', contractId, { documentType: input.documentType });
    });
    return this.getContract(contractId, context);
  }

  async upsertWorkflowApproval(contractId: string, input: WorkflowApprovalInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      await tx.contractWorkflowApproval.upsert({
        where: { contractId_stepKey: { contractId, stepKey: input.stepKey } },
        update: {
          role: input.role,
          status: input.status ?? ContractLifecycleItemStatus.APPROVED,
          actorUserId: context.userId ?? null,
          decidedAt: new Date(),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          stepKey: input.stepKey,
          role: input.role,
          status: input.status ?? ContractLifecycleItemStatus.APPROVED,
          actorUserId: context.userId ?? null,
          decidedAt: new Date(),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.workflow_approval.upserted', 'contract', contractId, { stepKey: input.stepKey });
    });
    return this.getContract(contractId, context);
  }

  private async requireContract(tx: DbClient, contractId: string, context: AwardContractRequestContext, managerOnly = false) {
    const contract = await tx.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw requestError('Contract was not found.', 404);
    assertContractVisible(contract, context);
    if (managerOnly) assertContractManager(contract, context);
    return contract;
  }

  private async assertInvoiceExecutionEligible(tx: DbClient, contractId: string, input: InvoiceInput) {
    if (input.status === InvoiceStatus.BLOCKED || input.status === InvoiceStatus.REJECTED) return;
    if (!input.executionReferenceId) {
      throw requestError('Invoice requires an accepted execution reference before submission.', 409);
    }
    const type = String(input.executionReferenceType || '').toLowerCase();
    const id = input.executionReferenceId;
    const acceptedStatuses = ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'];
    const acceptedLifecycleStatuses: ContractLifecycleItemStatus[] = [
      ContractLifecycleItemStatus.APPROVED,
      ContractLifecycleItemStatus.CLOSED
    ];
    const acceptedMilestoneStatuses: ContractMilestoneStatus[] = [ContractMilestoneStatus.ACCEPTED, ContractMilestoneStatus.COMPLETED];
    const checks: Array<() => Promise<{ accepted: boolean; amount: number | null }>> = [];
    if (!type || ['acceptance', 'contract_acceptance'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractAcceptance.findFirst({ where: { id, contractId, status: { in: acceptedLifecycleStatuses } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['goods_receipt', 'receipt'].includes(type)) {
      checks.push(async () => {
        const receipt = await tx.contractGoodsReceipt.findFirst({ where: { id, contractId }, include: { lines: true } });
        return {
          accepted: Boolean(receipt && (acceptedLifecycleStatuses.includes(receipt.status) || receipt.lines.some((line) => Number(line.acceptedQuantity ?? 0) > 0))),
          amount: receipt ? acceptedReceiptValue(receipt) : null
        };
      });
    }
    if (!type || ['goods_inspection', 'inspection'].includes(type)) {
      checks.push(async () => {
        const record = await tx.goodsInspection.findFirst({ where: { id, contractId, result: ContractLifecycleItemStatus.APPROVED } });
        return { accepted: Boolean(record), amount: record ? goodsInspectionAcceptedValue(record) : null };
      });
      checks.push(async () => {
        const record = await tx.contractInspection.findFirst({ where: { id, contractId, result: ContractLifecycleItemStatus.APPROVED } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (['boq_measurement', 'boq'].includes(type)) {
      throw requestError('Works invoices must reference a certified IPC or final account, not a BOQ measurement.', 409);
    }
    if (!type) {
      checks.push(async () => {
        const record = await tx.contractBoqMeasurement.findFirst({ where: { id, contractId, status: { in: ['APPROVED', 'CERTIFIED'] } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['ipc', 'interim_payment_certificate'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractInterimPaymentCertificate.findFirst({ where: { id, contractId, status: { in: ['APPROVED', 'CERTIFIED'] } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['works_completion_certificate', 'completion_certificate', 'final_account'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractWorksCompletionCertificate.findFirst({
          where: {
            id,
            contractId,
            certificateType: { in: ['FINAL_ACCOUNT', 'FINAL_COMPLETION'] },
            status: { in: ['ISSUED', 'APPROVED', 'CERTIFIED', 'CLOSED'] }
          }
        });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['service_report'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractServiceReport.findFirst({ where: { id, contractId, status: { in: acceptedStatuses } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['service_credit', 'service_decision'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractServiceCredit.findFirst({ where: { id, contractId, status: { in: ['APPROVED', 'APPLIED', 'CERTIFIED', 'CLOSED'] } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['consultancy_deliverable'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractConsultancyDeliverable.findFirst({ where: { id, contractId, status: { in: acceptedLifecycleStatuses }, paymentEligible: true } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['deliverable_version'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractDeliverableVersion.findFirst({ where: { id, contractId, status: { in: acceptedStatuses } }, include: { reviews: true } });
        const payable = record?.reviews.some((review) => review.paymentEligible && acceptedStatuses.includes(review.decision));
        return { accepted: Boolean(record && payable), amount: record ? acceptedExecutionAmount(record.reviews.find((review) => review.paymentEligible) ?? record) : null };
      });
    }
    if (!type || ['deliverable_review'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractDeliverableReview.findFirst({ where: { id, contractId, decision: { in: acceptedStatuses }, paymentEligible: true } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['consultancy_final_report', 'final_report'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractConsultancyFinalReport.findFirst({ where: { id, contractId, status: { in: acceptedLifecycleStatuses }, paymentEligible: true } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['milestone'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractMilestone.findFirst({ where: { id, contractId, status: { in: acceptedMilestoneStatuses } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    if (!type || ['deliverable'].includes(type)) {
      checks.push(async () => {
        const record = await tx.contractDeliverable.findFirst({ where: { id, contractId, status: { in: acceptedLifecycleStatuses } } });
        return { accepted: Boolean(record), amount: record ? acceptedExecutionAmount(record) : null };
      });
    }
    let acceptedAmount: number | null = null;
    for (const check of checks) {
      const result = await check();
      if (result.accepted) {
        acceptedAmount = result.amount;
        break;
      }
    }
    if (acceptedAmount === null && checks.length > 0) {
      const accepted = await Promise.all(checks.map((check) => check()));
      if (!accepted.some((result) => result.accepted)) throw requestError('Invoice execution reference must point to accepted, certified, or approved work.', 409);
    } else if (acceptedAmount === null) {
      throw requestError('Invoice execution reference must point to accepted, certified, or approved work.', 409);
    }
    if (acceptedAmount !== null) {
      const alreadyInvoiced = await tx.invoice.aggregate({
        where: {
          contractId,
          executionReferenceId: id,
          status: { notIn: [InvoiceStatus.BLOCKED, InvoiceStatus.REJECTED] }
        },
        _sum: { amount: true }
      });
      const alreadyAmount = Number(alreadyInvoiced._sum.amount ?? 0);
      if (alreadyAmount + Number(input.amount ?? 0) > acceptedAmount + 0.005) {
        throw requestError('Invoice amount exceeds the remaining accepted value for this execution item.', 409);
      }
      return;
    }
  }

  private async createAmendedBaseline(tx: DbClient, contract: { id: string; amount: unknown; currency: string; title: string }, amendment: { id: string; valueDelta: unknown; timeDeltaDays: number | null; approvedAt: Date | null; signedAt: Date | null }) {
    const existing = await tx.contractBaseline.findFirst({ where: { contractId: contract.id, sourceRecordId: amendment.id } });
    if (existing) return;
    const latest = await tx.contractBaseline.findFirst({ where: { contractId: contract.id }, orderBy: { versionNo: 'desc' } });
    const versionNo = (latest?.versionNo ?? 0) + 1;
    const latestValue = latest?.contractValue ?? contract.amount ?? null;
    const nextValue = latestValue === null || latestValue === undefined ? null : Number(latestValue) + Number(amendment.valueDelta ?? 0);
    const nextCompletion =
      latest?.completionDate && amendment.timeDeltaDays
        ? new Date(latest.completionDate.getTime() + amendment.timeDeltaDays * 24 * 60 * 60 * 1000)
        : latest?.completionDate ?? null;
    await tx.contractBaseline.updateMany({ where: { contractId: contract.id, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
    await tx.contractBaseline.create({
      data: {
        contractId: contract.id,
        baselineType: 'AMENDED',
        versionNo,
        contractValue: nextValue,
        currency: latest?.currency || contract.currency,
        startDate: latest?.startDate ?? null,
        completionDate: nextCompletion,
        scopeSummary: latest?.scopeSummary || contract.title,
        status: 'ACTIVE',
        sourceRecordId: amendment.id,
        approvedAt: amendment.signedAt ?? amendment.approvedAt ?? new Date(),
        payload: {
          source: 'contract_amendment',
          previousVersionNo: latest?.versionNo ?? null,
          valueDelta: Number(amendment.valueDelta ?? 0),
          timeDeltaDays: amendment.timeDeltaDays ?? 0
        } as Prisma.InputJsonObject
      }
    });
  }

  private async requireSample(tx: DbClient, sampleId: string, context: AwardContractRequestContext, buyerOnly = false) {
    const sample = await tx.bidSample.findUnique({
      where: { id: sampleId },
      include: {
        tender: { select: { id: true, reference: true, title: true, buyerOrgId: true } },
        supplierOrg: { select: { id: true, name: true } }
      }
    });
    if (!sample) throw requestError('Sample was not found.', 404);
    const canView = context.isAdmin || sample.tender.buyerOrgId === context.organizationId || sample.supplierOrgId === context.organizationId;
    if (!canView) throw requestError('Sample was not found.', 404);
    if (buyerOnly && !context.isAdmin && sample.tender.buyerOrgId !== context.organizationId) {
      throw requestError('Buyer sample management access is required.', 403);
    }
    return sample;
  }

  private async requireSampleWithReceipt(tx: DbClient, sampleId: string, context: AwardContractRequestContext) {
    const sample = await this.requireSample(tx, sampleId, context, true);
    const receipt = await tx.sampleReceipt.findUnique({ where: { bidSampleId: sample.id } });
    if (!receipt) throw requestError('Sample must be received before this action can be recorded.', 409);
    return sample;
  }

  private async sampleDetail(sampleId: string, context: AwardContractRequestContext) {
    const sample = await this.requireSample(this.db, sampleId, context);
    return this.sampleDetailForRecord(this.db, sample, context);
  }

  private async sampleDetailForRecord(tx: DbClient, sample: Awaited<ReturnType<ModuleRepository['requireSample']>>, context: AwardContractRequestContext) {
    const [receipt, verifications, evaluations, tests, custodyLogs, dispositions, referenceSamples, contract] = await Promise.all([
      tx.sampleReceipt.findUnique({ where: { bidSampleId: sample.id } }),
      tx.sampleVerification.findMany({ where: { bidSampleId: sample.id }, orderBy: { createdAt: 'desc' } }),
      tx.sampleEvaluation.findMany({ where: { bidSampleId: sample.id }, orderBy: { createdAt: 'desc' } }),
      tx.sampleTest.findMany({ where: { bidSampleId: sample.id }, orderBy: { createdAt: 'desc' } }),
      tx.sampleCustodyLog.findMany({ where: { bidSampleId: sample.id }, orderBy: { createdAt: 'desc' } }),
      tx.sampleDisposition.findMany({ where: { bidSampleId: sample.id }, orderBy: { createdAt: 'desc' } }),
      tx.contractReferenceSample.findMany({ where: { bidSampleId: sample.id }, orderBy: { createdAt: 'desc' } }),
      tx.contract.findFirst({
        where: { tenderId: sample.tenderId, supplierOrgId: sample.supplierOrgId },
        select: { id: true },
        orderBy: { updatedAt: 'desc' }
      })
    ]);
    return sampleDto(sample, {
      receipt: receipt as unknown as Record<string, unknown> | null,
      verifications: verifications as unknown as Array<Record<string, unknown>>,
      evaluations: evaluations as unknown as Array<Record<string, unknown>>,
      tests: tests as unknown as Array<Record<string, unknown>>,
      custodyLogs: custodyLogs as unknown as Array<Record<string, unknown>>,
      dispositions: dispositions as unknown as Array<Record<string, unknown>>,
      referenceSamples: referenceSamples as unknown as Array<Record<string, unknown>>,
      contractId: contract?.id ?? null
    }, context);
  }

  private async createSampleDisposition(sampleId: string, input: SampleDispositionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const sample = await this.requireSampleWithReceipt(tx, sampleId, context);
      await tx.sampleDisposition.create({
        data: {
          bidSampleId: sample.id,
          tenderId: sample.tenderId,
          bidId: sample.bidId,
          buyerOrgId: sample.tender.buyerOrgId,
          supplierOrgId: sample.supplierOrgId,
          dispositionType: input.dispositionType,
          reason: input.reason || null,
          authorizedByUserId: context.userId ?? null,
          supplierNotifiedAt: toDateTime(input.supplierNotifiedAt),
          collectionDeadline: toDateTime(input.collectionDeadline),
          collectionRepresentative: input.collectionRepresentative || null,
          returnCondition: input.returnCondition || null,
          disposalMethod: input.disposalMethod || null,
          witnesses: input.witnesses || null,
          acknowledgementDocumentId: input.acknowledgementDocumentId || null,
          status: input.status || 'OPEN',
          completedAt: toDateTime(input.completedAt),
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, sample.tender.buyerOrgId, context.userId, 'sample.disposition.created', 'bid_sample', sample.id, {
        dispositionType: input.dispositionType,
        status: input.status
      });
    });
    return this.sampleDetail(sampleId, context);
  }

  private async requireTermination(tx: DbClient, contractId: string, terminationId: string, context: AwardContractRequestContext) {
    const termination = await tx.contractTermination.findUnique({ where: { id: terminationId }, include: { contract: true } });
    if (!termination || termination.contractId !== contractId) throw requestError('Termination record was not found.', 404);
    assertContractVisible(termination.contract, context);
    return termination;
  }

  private async requireSignedAmendment(tx: DbClient, contractId: string, input: ControlWorkflowActionInput) {
    if (!input.amendmentId && !input.amendmentReference) {
      throw requestError('A signed amendment must be linked before this control item can be approved.', 409);
    }
    const amendment = await tx.contractAmendment.findFirst({
      where: {
        contractId,
        ...(input.amendmentId ? { id: input.amendmentId } : { amendmentReference: input.amendmentReference }),
        OR: [{ status: 'SIGNED' }, { signedAt: { not: null } }]
      }
    });
    if (!amendment) throw requestError('The linked amendment must be signed before approval can update the control workflow.', 409);
    return amendment;
  }

  private async updateSimpleLifecycleItem(
    model: 'contractRisk' | 'contractVariation' | 'contractIssue' | 'contractDispute',
    label: string,
    contractId: string,
    itemId: string,
    input: LifecycleItemPatchInput,
    context: AwardContractRequestContext
  ) {
    await this.db.$transaction(async (tx) => {
      const delegate = tx[model] as any;
      const item = await delegate.findUnique({ where: { id: itemId }, include: { contract: true } });
      if (!item || item.contractId !== contractId) throw requestError(`${label} item was not found.`, 404);
      assertContractVisible(item.contract, context);
      assertContractManager(item.contract, context);

      const sharedData = {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonObject } : {})
      };
      const data =
        model === 'contractVariation'
          ? {
              ...sharedData,
              ...(input.title !== undefined ? { title: input.title } : {}),
              ...(input.note !== undefined ? { decision: input.note || null } : {})
            }
          : model === 'contractIssue'
            ? {
                ...sharedData,
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.category !== undefined ? { category: input.category || 'general' } : {}),
                ...(input.description !== undefined ? { description: input.description || null } : {}),
                ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) ?? null } : {}),
                ...(input.note !== undefined ? { resolution: input.note || null } : {})
              }
            : model === 'contractDispute'
              ? {
                  ...sharedData,
                  ...(input.title !== undefined ? { title: input.title } : {}),
                  ...(input.description !== undefined ? { description: input.description || null } : {}),
                  ...(input.note !== undefined ? { decision: input.note || null } : {})
                }
              : {
                  ...sharedData,
                  ...(input.title !== undefined ? { title: input.title } : {}),
                  ...(input.category !== undefined ? { category: input.category || 'general' } : {}),
                  ...(input.description !== undefined ? { description: input.description || null } : {}),
                  ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) ?? null } : {})
                };
      await delegate.update({ where: { id: itemId }, data });
      await this.audit(tx, item.contract.buyerOrgId, context.userId, `contract.${label}.updated`, 'contract', contractId, { itemId, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async evaluationReport(id: string, context: AwardContractRequestContext) {
    const recommendation = await this.getRecommendation(id, context);
    if (!recommendation) throw requestError('Award recommendation was not found.', 404);
    const rows = [
      ['Tender', recommendation.tenderTitle],
      ['Tender reference', recommendation.tenderReference],
      ['Recommended supplier', recommendation.supplierName ?? 'Not set'],
      ['Award amount', recommendation.amount === null ? 'Not priced' : `${recommendation.currency} ${recommendation.amount.toLocaleString()}`],
      ['Recommendation reason', recommendation.reason || 'No reason recorded'],
      ['Award status', recommendation.status]
    ];
    const winnerRows = recommendation.awardGroup.winners.map((winner, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(winner.supplierName ?? 'Supplier pending')}</td>
        <td>${escapeHtml(winner.status)}</td>
        <td>${winner.amount === null ? 'Not priced' : `${escapeHtml(winner.currency)} ${winner.amount.toLocaleString()}`}</td>
      </tr>
    `).join('');

    return {
      filename: `${safeFilename(recommendation.tenderReference || recommendation.reference)}-evaluation-report.html`,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
        <html>
          <head><meta charset="utf-8"><title>Evaluation report</title></head>
          <body style="font-family: Arial, sans-serif; color: #172033; max-width: 920px; margin: 32px auto; line-height: 1.5;">
            <h1>Evaluation Report</h1>
            <p>This generated report summarizes the evaluation outcome used for the award decision.</p>
            <table style="width:100%;border-collapse:collapse;margin:24px 0;">
              <tbody>${rows.map(([label, value]) => `<tr><th style="text-align:left;border:1px solid #d8dee8;padding:10px;width:220px;">${escapeHtml(label)}</th><td style="border:1px solid #d8dee8;padding:10px;">${escapeHtml(String(value ?? '-'))}</td></tr>`).join('')}</tbody>
            </table>
            <h2>Recommended winners</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr><th style="border:1px solid #d8dee8;padding:10px;">Rank</th><th style="border:1px solid #d8dee8;padding:10px;">Supplier</th><th style="border:1px solid #d8dee8;padding:10px;">Status</th><th style="border:1px solid #d8dee8;padding:10px;">Amount</th></tr></thead>
              <tbody>${winnerRows || '<tr><td colspan="4" style="border:1px solid #d8dee8;padding:10px;">No winners recorded.</td></tr>'}</tbody>
            </table>
          </body>
        </html>`
    };
  }

  private async updateAwardDecisionDraft(
    tx: DbClient,
    recommendation: RecommendationRecord,
    input: AwardDecisionDraftInput,
    context: AwardContractRequestContext,
    event: string
  ) {
    const currentPayload = objectPayload(recommendation.payload);
    const currentDraft = objectPayload(currentPayload.awardDecisionDraft);
    const nextDraft = {
      ...currentDraft,
      ...awardDecisionDraftPayload(input),
      savedAt: new Date().toISOString(),
      savedByUserId: context.userId ?? null
    };
    await tx.awardRecommendation.update({
      where: { id: recommendation.id },
      data: {
        ...(input.awardAmount !== undefined ? { amount: input.awardAmount } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.reason || input.note ? { reason: input.reason || input.note } : {}),
        payload: {
          ...currentPayload,
          awardDecisionDraft: nextDraft
        } as Prisma.InputJsonObject
      }
    });
    await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, event, 'award_recommendation', recommendation.id, {
      note: input.note,
      awardAmount: input.awardAmount,
      currency: input.currency
    });
  }

  private async recommendationSourceDocuments(record: RecommendationRecord, awardGroup: AwardGroupDto): Promise<AwardSourceDocumentDto[]> {
    const documents: AwardSourceDocumentDto[] = [];
    const tenderDocuments = await this.db.tenderDocument.findMany({
      where: { tenderId: record.workspace.tenderId },
      include: { document: { select: { id: true, name: true, documentType: true } } },
      orderBy: { createdAt: 'asc' }
    });
    for (const row of tenderDocuments) {
      documents.push(sourceDocumentDto({
        id: `tender-${row.id}`,
        sourceType: 'tender',
        documentId: row.documentId,
        label: row.label || 'Tender Document',
        name: row.document.name,
        status: row.document.documentType
      }));
    }

    for (const winner of awardGroup.winners) {
      for (const row of winner.bidDocuments) {
        documents.push(sourceDocumentDto({
          id: `bid-${row.id}`,
          sourceType: 'bid',
          documentId: row.documentId,
          label: 'Bid Document',
          name: row.name,
          status: row.reviewStatus,
          supplierName: winner.supplierName,
          bidId: row.bidId
        }));
      }
    }

    documents.push({
      id: `evaluation-report-${record.id}`,
      sourceType: 'evaluation-report',
      documentId: null,
      label: 'Evaluation Report',
      name: `${record.workspace.tender.reference} evaluation report`,
      status: 'Generated',
      openUrl: `/api/award-contract/recommendations/${record.id}/evaluation-report`,
      downloadUrl: `/api/award-contract/recommendations/${record.id}/evaluation-report?download=true`
    });
    return documents;
  }

  private async awardGroupDetail(record: RecommendationRecord, context: AwardContractRequestContext) {
    const fallbackGroup = {
      id: record.awardGroupId ?? record.id,
      reference: `PX-AG-${record.reference}`,
      title: record.workspace.tender.title,
      status: record.notice?.contractId ? 'CONTRACT_FORMED' : record.notice ? 'NOTICED' : record.status === RecommendationStatus.APPROVED ? 'SETTLED' : 'NEGOTIATION',
      tenderId: record.workspace.tenderId,
      buyerOrgId: record.workspace.buyerOrgId,
      settledAt: record.status === RecommendationStatus.APPROVED ? record.notice?.issuedAt?.toISOString() ?? null : null,
      winners: [],
      clauses: [],
      negotiations: [],
      bidPacks: [],
      payload: {
        virtual: !record.awardGroupId,
        recommendationId: record.id
      }
    };
    const group = record.awardGroupId
      ? await this.db.awardGroup.findUnique({
          where: { id: record.awardGroupId },
          include: {
            winners: { orderBy: { createdAt: 'asc' } },
            clauses: { orderBy: [{ category: 'asc' }, { clauseKey: 'asc' }] },
            negotiations: { orderBy: { updatedAt: 'desc' } },
            bidPacks: { orderBy: { generatedAt: 'desc' } }
          }
        })
      : null;
    const winners = group?.winners.length
      ? group.winners
      : [
          {
            id: record.id,
            recommendationId: record.id,
            bidId: record.bidId,
            supplierOrgId: record.supplierOrgId,
            noticeId: record.notice?.id ?? null,
            contractId: record.notice?.contractId ?? record.contracts[0]?.id ?? null,
            amount: record.amount,
            currency: record.currency,
            status: record.notice?.status ?? record.status,
            payload: {},
            awardGroupId: record.awardGroupId ?? record.id,
            createdAt: record.createdAt,
            updatedAt: record.createdAt
          }
        ];
    const supplierIds = [...new Set(winners.map((winner) => winner.supplierOrgId).filter((value): value is string => Boolean(value)))];
    const bidIds = [...new Set(winners.map((winner) => winner.bidId).filter((value): value is string => Boolean(value)))];
    const [suppliers, bidDocuments] = await Promise.all([
      supplierIds.length
        ? this.db.organization.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      bidIds.length
        ? this.db.bidDocument.findMany({
            where: { bidId: { in: bidIds } },
            include: {
              document: {
                select: {
                  id: true,
                  name: true,
                  documentType: true,
                  checksum: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          })
        : Promise.resolve([])
    ]);
    const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
    const bidDocumentsByBidId = new Map<string, typeof bidDocuments>();
    for (const document of bidDocuments) {
      const list = bidDocumentsByBidId.get(document.bidId) ?? [];
      list.push(document);
      bidDocumentsByBidId.set(document.bidId, list);
    }
    return {
      ...fallbackGroup,
      ...(group
        ? {
            id: group.id,
            reference: group.reference,
            title: group.title,
            status: group.status,
            tenderId: group.tenderId,
            buyerOrgId: group.buyerOrgId,
            settledAt: group.settledAt?.toISOString() ?? null,
            payload: objectPayload(group.payload)
          }
        : {}),
      winners: winners.map((winner) => ({
        id: winner.id,
        recommendationId: winner.recommendationId,
        bidId: winner.bidId,
        supplierOrgId: winner.supplierOrgId,
        supplierName: winner.supplierOrgId ? supplierNameById.get(winner.supplierOrgId) ?? (winner.supplierOrgId === record.supplierOrgId ? record.bid?.supplierOrg.name ?? null : null) : null,
        noticeId: winner.noticeId,
        contractId: winner.contractId,
        amount: decimalToNumber(winner.amount),
        currency: winner.currency,
        status: String(winner.status),
        bidDocuments: (winner.bidId ? bidDocumentsByBidId.get(winner.bidId) ?? [] : []).map((document) => ({
          id: document.id,
          bidId: document.bidId,
          documentId: document.documentId,
          name: document.document.name,
          documentType: document.document.documentType,
          envelope: document.envelope,
          reviewStatus: document.reviewStatus,
          checksum: document.document.checksum,
          createdAt: document.createdAt.toISOString()
        })),
        payload: objectPayload(winner.payload)
      })),
      clauses: (group?.clauses ?? []).map((clause) => lifecycleItemDto({
        ...clause,
        category: clause.category,
        title: clause.title,
        note: clause.body,
        payload: {
          ...objectPayload(clause.payload),
          clauseKey: clause.clauseKey,
          winnerId: clause.winnerId,
          buyerComment: clause.buyerComment ?? '',
          supplierComment: clause.supplierComment ?? '',
          legalComment: clause.legalComment ?? ''
        }
      })),
      negotiations: (group?.negotiations ?? []).map((negotiation) => lifecycleItemDto({
        ...negotiation,
        category: negotiation.raisedByRole,
        title: negotiation.subject,
        note: negotiation.position ?? negotiation.counterOffer,
        dueDate: negotiation.dueDate,
        payload: {
          ...objectPayload(negotiation.payload),
          winnerId: negotiation.winnerId,
          clauseId: negotiation.clauseId,
          raisedByOrgId: negotiation.raisedByOrgId,
          counterOffer: negotiation.counterOffer ?? ''
        }
      })),
      bidPacks: (group?.bidPacks ?? []).map((pack) => ({
        id: pack.id,
        documentId: pack.documentId,
        status: pack.status,
        checksum: pack.checksum,
        generatedAt: pack.generatedAt.toISOString(),
        payload: objectPayload(pack.payload)
      }))
    };
  }

  private async findOrCreateAwardGroup(tx: DbClient, recommendation: RecommendationRecord) {
    if (recommendation.awardGroupId) {
      const existing = await tx.awardGroup.findUnique({ where: { id: recommendation.awardGroupId } });
      if (existing) {
        await this.ensureAwardWinner(tx, existing.id, recommendation);
        await this.ensureDefaultAwardClauses(tx, existing.id);
        return existing;
      }
    }
    const group = await tx.awardGroup.create({
      data: {
        reference: awardGroupReference(),
        workspaceId: recommendation.workspaceId,
        tenderId: recommendation.workspace.tenderId,
        buyerOrgId: recommendation.workspace.buyerOrgId,
        title: recommendation.workspace.tender.title,
        status: 'NEGOTIATION',
        payload: {
          source: 'award_recommendation',
          firstRecommendationId: recommendation.id
        } as Prisma.InputJsonObject
      }
    });
    await tx.awardRecommendation.update({
      where: { id: recommendation.id },
      data: { awardGroupId: group.id }
    });
    await this.ensureAwardWinner(tx, group.id, recommendation);
    await this.ensureDefaultAwardClauses(tx, group.id);
    return group;
  }

  private async ensureAwardWinner(tx: DbClient, awardGroupId: string, recommendation: RecommendationRecord) {
    const existing = await tx.awardWinner.findFirst({ where: { recommendationId: recommendation.id } });
    const data = {
      awardGroupId,
      bidId: recommendation.bidId,
      supplierOrgId: recommendation.supplierOrgId,
      noticeId: recommendation.notice?.id ?? null,
      contractId: recommendation.notice?.contractId ?? recommendation.contracts[0]?.id ?? null,
      amount: recommendation.amount,
      currency: recommendation.currency,
      status: recommendation.notice?.status ?? recommendation.status,
      payload: {
        source: 'award_recommendation',
        tenderReference: recommendation.workspace.tender.reference
      } as Prisma.InputJsonObject
    };
    if (existing) return tx.awardWinner.update({ where: { id: existing.id }, data });
    return tx.awardWinner.create({ data: { ...data, recommendationId: recommendation.id } });
  }

  private async ensureDefaultAwardClauses(tx: DbClient, awardGroupId: string) {
    const existing = await tx.awardClause.count({ where: { awardGroupId } });
    if (existing > 0) return;
    await tx.awardClause.createMany({
      data: defaultContractClauses().map((clause) => ({
        awardGroupId,
        clauseKey: clause.clauseKey,
        title: clause.title,
        body: null,
        category: clause.category,
        status: ContractLifecycleItemStatus.OPEN,
        payload: {
          ...objectPayload(clause.payload),
          source: 'award_default_clause'
        } as Prisma.InputJsonObject
      }))
    });
  }

  private async generateAwardBidPackRecord(tx: DbClient, awardGroupId: string, context: AwardContractRequestContext, note: string) {
    const group = await tx.awardGroup.findUnique({
      where: { id: awardGroupId },
      include: {
        winners: { orderBy: { createdAt: 'asc' } },
        clauses: { orderBy: [{ category: 'asc' }, { clauseKey: 'asc' }] },
        negotiations: { orderBy: { updatedAt: 'desc' } }
      }
    });
    if (!group) throw requestError('Award group was not found.', 404);
    const bidIds = [...new Set(group.winners.map((winner) => winner.bidId).filter((value): value is string => Boolean(value)))];
    const [bids, bidDocuments] = await Promise.all([
      bidIds.length
        ? tx.bid.findMany({
            where: { id: { in: bidIds } },
            include: {
              supplierOrg: { select: { id: true, name: true } },
              receipt: true,
              responses: true
            }
          })
        : Promise.resolve([]),
      bidIds.length
        ? tx.bidDocument.findMany({
            where: { bidId: { in: bidIds } },
            include: {
              document: {
                select: {
                  id: true,
                  name: true,
                  documentType: true,
                  checksum: true,
                  metadata: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          })
        : Promise.resolve([])
    ]);
    const documentsByBidId = new Map<string, typeof bidDocuments>();
    for (const document of bidDocuments) {
      const list = documentsByBidId.get(document.bidId) ?? [];
      list.push(document);
      documentsByBidId.set(document.bidId, list);
    }
    const bidById = new Map(bids.map((bid) => [bid.id, bid]));
    const payload = {
      generatedAt: new Date().toISOString(),
      generatedByUserId: context.userId ?? null,
      note,
      awardGroup: {
        id: group.id,
        reference: group.reference,
        title: group.title,
        status: group.status,
        tenderId: group.tenderId,
        buyerOrgId: group.buyerOrgId
      },
      winners: group.winners.map((winner) => {
        const bid = winner.bidId ? bidById.get(winner.bidId) : null;
        return {
          id: winner.id,
          recommendationId: winner.recommendationId,
          bidId: winner.bidId,
          supplierOrgId: winner.supplierOrgId,
          supplierName: bid?.supplierOrg.name ?? null,
          amount: decimalToNumber(winner.amount),
          currency: winner.currency,
          status: winner.status,
          receipt: bid?.receipt ? workflowRecordDto(bid.receipt as unknown as Record<string, unknown>) : null,
          responses: bid?.responses.map((response) => workflowRecordDto(response as unknown as Record<string, unknown>)) ?? [],
          documents: (winner.bidId ? documentsByBidId.get(winner.bidId) ?? [] : []).map((document) => ({
            id: document.id,
            documentId: document.documentId,
            name: document.document.name,
            documentType: document.document.documentType,
            envelope: document.envelope,
            reviewStatus: document.reviewStatus,
            checksum: document.document.checksum,
            metadata: objectPayload(document.document.metadata),
            createdAt: document.createdAt.toISOString()
          }))
        };
      }),
      clauses: group.clauses.map((clause) => ({
        id: clause.id,
        clauseKey: clause.clauseKey,
        title: clause.title,
        body: clause.body,
        category: clause.category,
        status: clause.status,
        buyerComment: clause.buyerComment,
        supplierComment: clause.supplierComment,
        legalComment: clause.legalComment
      })),
      negotiations: group.negotiations.map((negotiation) => ({
        id: negotiation.id,
        subject: negotiation.subject,
        raisedByRole: negotiation.raisedByRole,
        status: negotiation.status,
        position: negotiation.position,
        counterOffer: negotiation.counterOffer,
        dueDate: isoDate(negotiation.dueDate)
      }))
    };
    const checksum = sha256(canonicalJson(payload));
    const existing = await tx.awardBidPack.findFirst({ where: { awardGroupId }, orderBy: { generatedAt: 'desc' } });
    if (existing) {
      return tx.awardBidPack.update({
        where: { id: existing.id },
        data: {
          status: 'GENERATED',
          checksum,
          payload: payload as Prisma.InputJsonObject,
          generatedAt: new Date()
        }
      });
    }
    return tx.awardBidPack.create({
      data: {
        awardGroupId,
        status: 'GENERATED',
        checksum,
        payload: payload as Prisma.InputJsonObject
      }
    });
  }

  private async getRecommendationByNotice(noticeId: string, context: AwardContractRequestContext) {
    const notice = await this.db.awardNotice.findUnique({ where: { id: noticeId }, select: { recommendationId: true } });
    return notice ? this.getRecommendation(notice.recommendationId, context) : null;
  }

  private async upsertApprovalStep(
    tx: DbClient,
    recommendationId: string,
    actorUserId: string | undefined,
    status: ApprovalStatus,
    action: string,
    note: string
  ) {
    const existing = await tx.approvalStep.findFirst({ where: { recommendationId, assignment: WorkflowAssignmentType.APPROVER }, orderBy: { decidedAt: 'desc' } });
    const data = {
      actorUserId: actorUserId ?? null,
      assignment: WorkflowAssignmentType.APPROVER,
      status,
      action,
      decidedAt: new Date(),
      payload: { note } as Prisma.InputJsonObject
    };
    if (existing) return tx.approvalStep.update({ where: { id: existing.id }, data });
    return tx.approvalStep.create({ data: { recommendationId, ...data } });
  }

  private approvalActorUserId(inputActorUserId: string | undefined, context: AwardContractRequestContext) {
    if (!context.userId) throw requestError('Authenticated user is required for approval actions.', 401);
    if (inputActorUserId && inputActorUserId !== context.userId) {
      throw requestError('Approval actor must be the authenticated user.', 403);
    }
    return context.userId;
  }

  private async upsertSingleUserAwardApproval(
    tx: DbClient,
    recommendationId: string,
    context: AwardContractRequestContext,
    status: ApprovalStatus,
    note: string
  ) {
    const actorUserId = this.approvalActorUserId(undefined, context);
    const route = await tx.awardApprovalRoute.upsert({
      where: {
        recommendationId_routeKey: {
          recommendationId,
          routeKey: 'single-user-award-approval'
        }
      },
      update: {
        title: 'Single-user award approval',
        status,
        currentStepOrder: 1,
        requiredQuorum: 1,
        note: note || null,
        payload: {
          hidden: true,
          model: 'single-user',
          actorUserId,
          organizationId: context.organizationId ?? null
        } as Prisma.InputJsonObject
      },
      create: {
        recommendationId,
        routeKey: 'single-user-award-approval',
        title: 'Single-user award approval',
        status,
        currentStepOrder: 1,
        requiredQuorum: 1,
        note: note || null,
        payload: {
          hidden: true,
          model: 'single-user',
          actorUserId,
          organizationId: context.organizationId ?? null
        } as Prisma.InputJsonObject
      }
    });

    await tx.awardApprovalStep.upsert({
      where: {
        routeId_stepKey: {
          routeId: route.id,
          stepKey: 'award-owner-approval'
        }
      },
      update: {
        stepOrder: 1,
        role: 'Award Owner',
        actorUserId,
        status,
        dueDate: null,
        decidedAt: new Date(),
        note: note || null,
        payload: {
          hidden: true,
          model: 'single-user',
          organizationId: context.organizationId ?? null
        } as Prisma.InputJsonObject
      },
      create: {
        routeId: route.id,
        recommendationId,
        stepOrder: 1,
        stepKey: 'award-owner-approval',
        role: 'Award Owner',
        actorUserId,
        status,
        dueDate: null,
        decidedAt: new Date(),
        note: note || null,
        payload: {
          hidden: true,
          model: 'single-user',
          organizationId: context.organizationId ?? null
        } as Prisma.InputJsonObject
      }
    });
  }

  private async findOrCreateContractFromNotice(
    tx: DbClient,
    notice: Prisma.AwardNoticeGetPayload<{
      include: {
        recommendation: {
          include: {
            workspace: { include: { tender: true } };
            bid: true;
          };
        };
        contract: true;
      };
    }>
  ) {
    const existing = await tx.contract.findFirst({ where: { awardId: notice.recommendationId } });
    if (existing) return existing;
    const agreedAwardClauses = notice.recommendation.awardGroupId
      ? await tx.awardClause.findMany({
          where: { awardGroupId: notice.recommendation.awardGroupId },
          orderBy: [{ category: 'asc' }, { clauseKey: 'asc' }]
        })
      : [];
    const contractClauseSeeds = agreedAwardClauses.length
      ? agreedAwardClauses.map((clause) => ({
          clauseKey: clause.clauseKey,
          title: clause.title,
          body: clause.body,
          category: clause.category,
          status: clause.status,
          buyerComment: clause.buyerComment,
          supplierComment: clause.supplierComment,
          legalComment: clause.legalComment,
          payload: {
            ...objectPayload(clause.payload),
            source: 'settled_award_clause',
            awardClauseId: clause.id,
            readOnly: true
          } as Prisma.InputJsonObject
        }))
      : defaultContractClauses();
    const contractClauses = contractClauseSeeds.map((clause) => ({
      clauseKey: clause.clauseKey,
      title: clause.title,
      body: 'body' in clause ? clause.body : null,
      category: clause.category,
      status: clause.status,
      buyerComment: 'buyerComment' in clause ? clause.buyerComment : null,
      supplierComment: 'supplierComment' in clause ? clause.supplierComment : null,
      legalComment: 'legalComment' in clause ? clause.legalComment : null,
      payload: objectPayload(clause.payload) as Prisma.InputJsonObject
    }));
    const preparedContract = await tx.contract.findFirst({
      where: {
        tenderId: notice.recommendation.workspace.tenderId,
        buyerOrgId: notice.buyerOrgId,
        awardId: null,
        supplierOrgId: null
      },
      orderBy: { createdAt: 'asc' }
    });
    if (preparedContract) {
      const currentPayload = objectPayload(preparedContract.payload);
      const currentDraft = objectPayload(currentPayload.draft);
      await tx.contract.update({
        where: { id: preparedContract.id },
        data: {
          awardId: notice.recommendationId,
          supplierOrgId: notice.supplierOrgId,
          title: preparedContract.title.startsWith('Contract preparation for ') ? `Contract for ${notice.recommendation.workspace.tender.title}` : preparedContract.title,
          amount: notice.recommendation.amount,
          currency: notice.recommendation.currency,
          payload: {
            ...currentPayload,
            source: currentPayload.source ?? 'pre_award_contract_preparation',
            noticeId: notice.id,
            bidId: notice.recommendation.bidId,
            awardLinkedAt: new Date().toISOString(),
            draft: {
              ...currentDraft,
              parties: {
                ...objectPayload(currentDraft.parties),
                buyerOrgId: notice.buyerOrgId,
                supplierOrgId: notice.supplierOrgId
              },
              tender: {
                ...objectPayload(currentDraft.tender),
                id: notice.recommendation.workspace.tenderId,
                reference: notice.recommendation.workspace.tender.reference,
                title: notice.recommendation.workspace.tender.title,
                procurementType: notice.recommendation.workspace.tender.type,
                contractType: notice.recommendation.workspace.tender.contractType
              },
              financials: {
                ...objectPayload(currentDraft.financials),
                contractPrice: decimalToNumber(notice.recommendation.amount),
                currency: notice.recommendation.currency,
                budget: decimalToNumber(notice.recommendation.workspace.tender.budget)
              },
              awardLocked: false,
              supplierLocked: false
            }
          } as Prisma.InputJsonObject
        }
      });
      await tx.contractParty.upsert({
        where: { contractId_role: { contractId: preparedContract.id, role: ContractPartyRole.BUYER } },
        update: {
          organizationId: notice.buyerOrgId,
          displayName: 'Buyer organization'
        },
        create: {
          contractId: preparedContract.id,
          role: ContractPartyRole.BUYER,
          organizationId: notice.buyerOrgId,
          displayName: 'Buyer organization',
          payload: {}
        }
      });
      await tx.contractParty.upsert({
        where: { contractId_role: { contractId: preparedContract.id, role: ContractPartyRole.SUPPLIER } },
        update: {
          organizationId: notice.supplierOrgId,
          displayName: 'Supplier organization'
        },
        create: {
          contractId: preparedContract.id,
          role: ContractPartyRole.SUPPLIER,
          organizationId: notice.supplierOrgId,
          displayName: 'Supplier organization',
          payload: {}
        }
      });
      for (const clause of contractClauses) {
        await tx.contractClause.upsert({
          where: { contractId_clauseKey: { contractId: preparedContract.id, clauseKey: clause.clauseKey } },
          update: {
            title: clause.title,
            body: clause.body ?? undefined,
            category: clause.category,
            status: clause.status,
            buyerComment: clause.buyerComment ?? undefined,
            supplierComment: clause.supplierComment ?? undefined,
            legalComment: clause.legalComment ?? undefined,
            payload: {
              ...objectPayload(clause.payload),
              mergedFromAwardAt: new Date().toISOString()
            } as Prisma.InputJsonObject
          },
          create: {
            contractId: preparedContract.id,
            ...clause
          }
        });
      }
      const latestVersion = await tx.contractVersion.findFirst({ where: { contractId: preparedContract.id }, orderBy: { versionNo: 'desc' } });
      await tx.contractVersion.create({
        data: {
          contractId: preparedContract.id,
          versionNo: (latestVersion?.versionNo ?? 0) + 1,
          payload: {
            source: 'award_acceptance',
            generatedAt: new Date().toISOString(),
            tenderReference: notice.recommendation.workspace.tender.reference,
            awardId: notice.recommendationId,
            awardGroupId: notice.recommendation.awardGroupId,
            reusedPreAwardDraft: true,
            clauseKeys: contractClauses.map((clause) => clause.clauseKey)
          } as Prisma.InputJsonObject
        }
      });
      const hasPaymentSchedule = await tx.contractPaymentSchedule.count({ where: { contractId: preparedContract.id } });
      if (hasPaymentSchedule === 0) {
        await tx.contractPaymentSchedule.create({
          data: {
            contractId: preparedContract.id,
            title: 'Initial contract payment schedule',
            amount: notice.recommendation.amount,
            currency: notice.recommendation.currency,
            payload: {
              source: 'award_acceptance',
              instruction: 'Refine into milestone-based payments during contract review.'
            } as Prisma.InputJsonObject
          }
        });
      }
      const hasPurchaseOrder = await tx.purchaseOrder.count({ where: { contractId: preparedContract.id } });
      if (hasPurchaseOrder === 0) {
        await tx.purchaseOrder.create({
          data: {
            contractId: preparedContract.id,
            reference: purchaseOrderReference(),
            buyerOrgId: notice.buyerOrgId,
            amount: notice.recommendation.amount ?? 0,
            currency: notice.recommendation.currency,
            payload: {
              source: 'award_acceptance',
              noticeId: notice.id,
              awardId: notice.recommendationId,
              tenderReference: notice.recommendation.workspace.tender.reference
            } as Prisma.InputJsonObject
          }
        });
      }
      for (const document of defaultRequiredDocuments(String(notice.recommendation.workspace.tender.type))) {
        await tx.contractRequiredDocument.upsert({
          where: { contractId_documentType: { contractId: preparedContract.id, documentType: document.documentType } },
          update: {},
          create: {
            contractId: preparedContract.id,
            ...document
          }
        });
      }
      for (const approval of defaultWorkflowApprovals()) {
        await tx.contractWorkflowApproval.upsert({
          where: { contractId_stepKey: { contractId: preparedContract.id, stepKey: approval.stepKey } },
          update: {},
          create: {
            contractId: preparedContract.id,
            ...approval
          }
        });
      }
      await tx.contractManagementPlan.upsert({
        where: { contractId: preparedContract.id },
        update: {},
        create: {
          contractId: preparedContract.id,
          objectives: `Deliver ${notice.recommendation.workspace.tender.title} according to the approved tender scope, winning bid, agreed time, quality, and cost.`,
          monitoringPlan: 'Track milestones, KPIs, risks, inspections, payments, variations, disputes, and close-out actions in ProcureX.',
          reportingPlan: 'The contract owner reviews progress and exceptions regularly in ProcureX and records any needed specialist input as supporting evidence.',
          communicationPlan: 'All formal notices, evidence, comments, and decisions are recorded in ProcureX.',
          payload: {}
        }
      });
      const hasMobilization = await tx.contractMobilizationItem.count({ where: { contractId: preparedContract.id } });
      if (hasMobilization === 0) {
        await tx.contractMobilizationItem.createMany({
          data: defaultMobilizationItems(String(notice.recommendation.workspace.tender.type)).map((item) => ({
            contractId: preparedContract.id,
            ...item
          }))
        });
      }
      const hasKpis = await tx.contractKpi.count({ where: { contractId: preparedContract.id } });
      if (hasKpis === 0) {
        await tx.contractKpi.createMany({
          data: defaultKpis().map((item) => ({
            contractId: preparedContract.id,
            ...item
          }))
        });
      }
      if (notice.recommendation.awardGroupId) {
        await tx.awardWinner.updateMany({
          where: { awardGroupId: notice.recommendation.awardGroupId, recommendationId: notice.recommendationId },
          data: { contractId: preparedContract.id, status: 'CONTRACT_FORMED' }
        });
        await tx.awardGroup.update({
          where: { id: notice.recommendation.awardGroupId },
          data: { status: 'CONTRACT_FORMED' }
        });
      }
      return preparedContract;
    }
    const contract = await tx.contract.create({
      data: {
        reference: contractReference(),
        tenderId: notice.recommendation.workspace.tenderId,
        awardId: notice.recommendationId,
        buyerOrgId: notice.buyerOrgId,
        supplierOrgId: notice.supplierOrgId,
        title: `Contract for ${notice.recommendation.workspace.tender.title}`,
        amount: notice.recommendation.amount,
        currency: notice.recommendation.currency,
        payload: {
          source: 'award_notice',
          noticeId: notice.id,
          bidId: notice.recommendation.bidId,
          draft: {
            parties: {
              buyerOrgId: notice.buyerOrgId,
              supplierOrgId: notice.supplierOrgId
            },
            tender: {
              id: notice.recommendation.workspace.tenderId,
              reference: notice.recommendation.workspace.tender.reference,
              title: notice.recommendation.workspace.tender.title,
              procurementType: notice.recommendation.workspace.tender.type,
              contractType: notice.recommendation.workspace.tender.contractType
            },
            financials: {
              contractPrice: decimalToNumber(notice.recommendation.amount),
              currency: notice.recommendation.currency,
              budget: decimalToNumber(notice.recommendation.workspace.tender.budget)
            },
            clauses: contractClauses.map((clause) => ({
              clauseKey: clause.clauseKey,
              title: clause.title,
              category: clause.category,
              source: objectPayload(clause.payload).source ?? 'contract_default_clause'
            }))
          }
        } as Prisma.InputJsonObject,
        versions: {
          create: {
            versionNo: 1,
            payload: {
              source: 'award_acceptance',
              generatedAt: new Date().toISOString(),
              tenderReference: notice.recommendation.workspace.tender.reference,
              awardId: notice.recommendationId,
              awardGroupId: notice.recommendation.awardGroupId,
              clauseKeys: contractClauses.map((clause) => clause.clauseKey)
            } as Prisma.InputJsonObject
          }
        },
        parties: {
          createMany: {
            data: [
              {
                role: ContractPartyRole.BUYER,
                organizationId: notice.buyerOrgId,
                displayName: 'Buyer organization',
                payload: {}
              },
              {
                role: ContractPartyRole.SUPPLIER,
                organizationId: notice.supplierOrgId,
                displayName: 'Supplier organization',
                payload: {}
              }
            ]
          }
        },
        clauses: {
          createMany: {
            data: contractClauses
          }
        },
        paymentSchedules: {
          createMany: {
            data: [
              {
                title: 'Initial contract payment schedule',
                amount: notice.recommendation.amount,
                currency: notice.recommendation.currency,
                payload: {
                  source: 'award_acceptance',
                  instruction: 'Refine into milestone-based payments during contract review.'
                }
              }
            ]
          }
        },
        purchaseOrders: {
          create: {
            reference: purchaseOrderReference(),
            buyerOrgId: notice.buyerOrgId,
            amount: notice.recommendation.amount ?? 0,
            currency: notice.recommendation.currency,
            payload: {
              source: 'award_acceptance',
              noticeId: notice.id,
              awardId: notice.recommendationId,
              tenderReference: notice.recommendation.workspace.tender.reference
            } as Prisma.InputJsonObject
          }
        },
        requiredDocuments: {
          createMany: {
            data: defaultRequiredDocuments(String(notice.recommendation.workspace.tender.type))
          }
        },
        approvalSteps: {
          createMany: {
            data: defaultWorkflowApprovals()
          }
        },
        managementPlan: {
          create: {
            objectives: `Deliver ${notice.recommendation.workspace.tender.title} according to the approved tender scope, winning bid, agreed time, quality, and cost.`,
            monitoringPlan: 'Track milestones, KPIs, risks, inspections, payments, variations, disputes, and close-out actions in ProcureX.',
            reportingPlan: 'The contract owner reviews progress and exceptions regularly in ProcureX and records any needed specialist input as supporting evidence.',
            communicationPlan: 'All formal notices, evidence, comments, and decisions are recorded in ProcureX.',
            payload: {}
          }
        },
        mobilizationItems: {
          createMany: {
            data: defaultMobilizationItems(String(notice.recommendation.workspace.tender.type))
          }
        },
        kpis: {
          createMany: {
            data: defaultKpis()
          }
        }
      }
    });
    if (notice.recommendation.awardGroupId) {
      await tx.awardWinner.updateMany({
        where: { awardGroupId: notice.recommendation.awardGroupId, recommendationId: notice.recommendationId },
        data: { contractId: contract.id, status: 'CONTRACT_FORMED' }
      });
      await tx.awardGroup.update({
        where: { id: notice.recommendation.awardGroupId },
        data: { status: 'CONTRACT_FORMED' }
      });
    }
    return contract;
  }

  private async assertDocumentVisible(tx: DbClient, documentId: string, context: AwardContractRequestContext) {
    const document = await tx.documentObject.findUnique({ where: { id: documentId }, select: { ownerOrgId: true } });
    if (!document) throw requestError('Document was not found.', 404);
    if (!context.isAdmin && document.ownerOrgId && document.ownerOrgId !== context.organizationId) {
      throw requestError('Document is not visible to this organization.', 403);
    }
  }

  private async ensureActivation(tx: DbClient, contract: ContractRecord) {
    const existing = await tx.contractActivation.findUnique({ where: { contractId: contract.id }, include: { items: true } });
    if (existing) return existing;
    const procurementType = String(objectPayload(contract.payload).procurementType ?? contract.tender?.type ?? 'GOODS');
    const activation = await tx.contractActivation.create({
      data: {
        contractId: contract.id,
        status: 'DRAFT',
        payload: {
          createdFromStatus: contract.status,
          procurementType
        } as Prisma.InputJsonObject,
        items: {
          createMany: {
            data: defaultActivationItems(procurementType).map((item) => ({ ...item, contractId: contract.id }))
          }
        }
      },
      include: { items: true }
    });
    const existingBaseline = await tx.contractBaseline.findFirst({ where: { contractId: contract.id, versionNo: 1 } });
    if (!existingBaseline) {
      await tx.contractBaseline.create({
        data: {
          contractId: contract.id,
          baselineType: 'ORIGINAL',
          versionNo: 1,
          contractValue: contract.amount,
          currency: contract.currency,
          scopeSummary: contract.title,
          status: 'ACTIVE',
          approvedAt: contract.status === ContractStatus.SIGNED ? new Date() : null,
          payload: {
            source: 'contract_activation',
            tenderId: contract.tenderId,
            awardId: contract.awardId
          } as Prisma.InputJsonObject
        }
      });
    }
    return activation;
  }

  private assertActivationItemOwner(ownerRole: string, contract: { buyerOrgId: string; supplierOrgId: string | null }, context: AwardContractRequestContext) {
    const normalized = ownerRole.toLowerCase();
    if (normalized.includes('supplier')) {
      assertContractSupplier(contract, context);
      return;
    }
    if (normalized.includes('buyer')) {
      assertContractManager(contract, context);
      return;
    }
    assertContractVisible(contract, context);
  }

  private async refreshActivationReadiness(tx: DbClient, contractId: string) {
    const completedStatuses: ContractLifecycleItemStatus[] = [
      ContractLifecycleItemStatus.APPROVED,
      ContractLifecycleItemStatus.WAIVED,
      ContractLifecycleItemStatus.CLOSED
    ];
    const blockingCount = await tx.contractActivationItem.count({
      where: {
        contractId,
        required: true,
        status: { notIn: completedStatuses }
      }
    });
    await tx.contractActivation.update({
      where: { contractId },
      data: {
        readyForActivation: blockingCount === 0,
        status: blockingCount === 0 ? 'READY' : 'IN_PROGRESS'
      }
    });
  }

  private assertStatusTransition(from: ContractStatus, to: ContractStatus) {
    if (from === to) return;
    const allowed: Record<ContractStatus, ContractStatus[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.NEGOTIATION, ContractStatus.SIGNATURE_PENDING],
      [ContractStatus.NEGOTIATION]: [ContractStatus.SIGNATURE_PENDING, ContractStatus.DRAFT],
      [ContractStatus.SIGNATURE_PENDING]: [ContractStatus.SIGNED],
      [ContractStatus.SIGNED]: [ContractStatus.PENDING_ACTIVATION, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.PENDING_ACTIVATION]: [ContractStatus.ACTIVE, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.MOBILIZATION]: [ContractStatus.ACTIVE, ContractStatus.AT_RISK, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.ACTIVE]: [ContractStatus.SUSPENDED, ContractStatus.AT_RISK, ContractStatus.COMPLETED, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.SUSPENDED]: [ContractStatus.ACTIVE, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.AT_RISK]: [ContractStatus.ACTIVE, ContractStatus.SUSPENDED, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.COMPLETED]: [ContractStatus.CLOSING, ContractStatus.WARRANTY_DEFECTS, ContractStatus.CLOSED],
      [ContractStatus.CLOSING]: [ContractStatus.CLOSED],
      [ContractStatus.WARRANTY_DEFECTS]: [ContractStatus.CLOSING, ContractStatus.CLOSED],
      [ContractStatus.TERMINATION_REVIEW]: [ContractStatus.TERMINATED, ContractStatus.ACTIVE, ContractStatus.AT_RISK],
      [ContractStatus.TERMINATED]: [ContractStatus.CLOSED],
      [ContractStatus.CLOSED]: []
    };
    if (!allowed[from].includes(to)) throw requestError(`Invalid contract status transition from ${from} to ${to}.`, 409);
  }

  private assertActivationReady(contract: ContractRecord) {
    if (!contract.managementPlan) throw requestError('Contract Management Plan is required before activation.', 409);
    if (contract.milestones.length === 0) throw requestError('At least one contract milestone is required before activation.', 409);
    const completedMobilizationStatuses: ContractLifecycleItemStatus[] = [
      ContractLifecycleItemStatus.APPROVED,
      ContractLifecycleItemStatus.WAIVED,
      ContractLifecycleItemStatus.CLOSED
    ];
    const blockingMobilization = contract.mobilizationItems.filter((item) => item.required && !completedMobilizationStatuses.includes(item.status));
    if (blockingMobilization.length > 0) {
      throw requestError('Required mobilization checklist items must be approved or waived before activation.', 409);
    }
    if (contract.activationItems.length === 0) throw requestError('Contract activation checklist is required before activation.', 409);
    const blockingActivation = contract.activationItems.filter((item) => item.required && !completedMobilizationStatuses.includes(item.status));
    if (blockingActivation.length > 0) {
      throw requestError('Required activation checklist items must be approved or waived before activation.', 409);
    }
  }

  private async audit(tx: DbClient, ownerOrgId: string | null, actorUserId: string | undefined, event: string, entityType: string, entityRef: string, payload: Record<string, unknown>) {
    await tx.auditEvent.create({
      data: {
        ownerOrgId,
        actorUserId: actorUserId ?? null,
        event,
        entityType,
        entityRef,
        severity: AuditSeverity.INFO,
        payload: payload as Prisma.InputJsonObject
      }
    });
    const notificationDelegate = (tx as DbClient & { notification?: { create: (args: unknown) => Promise<unknown> } }).notification;
    if (ownerOrgId && notificationDelegate) {
      await notificationDelegate.create({
        data: {
          ownerOrgId,
          userId: actorUserId ?? null,
          contractId: entityType === 'contract' ? entityRef : null,
          awardId: entityType === 'award_recommendation' ? entityRef : null,
          title: event,
          body: typeof payload.note === 'string' ? payload.note : null,
          payload: {
            entityType,
            entityRef,
            ...payload
          } as Prisma.InputJsonObject
        }
      });
    }
  }
}
