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
import { createHash, randomBytes } from 'node:crypto';
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
  AwardNoticeResponseInput,
  AwardRecommendationDetailDto,
  AwardRecommendationListItemDto,
  AwardRecommendationQuery,
  AwardSettlementInput,
  AwardTieBreakerInput,
  BudgetCommitmentInput,
  ContractDetailDto,
  ContractCloseoutInput,
  ContractListItemDto,
  ContractManagementPlanInput,
  ContractMilestoneEvidenceInput,
  ContractMilestoneInput,
  ContractMilestonePatchInput,
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
  ContractPaymentInput,
  ContractPenaltyInput,
  ContractReferenceSampleInput,
  ContractSecurityInput,
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
      title: true
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

function workflowRecordDto(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value instanceof Date) return [key, value.toISOString()];
      if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
        return [key, (value as { toNumber: () => number }).toNumber()];
      }
      return [key, value];
    })
  );
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

function sourceDocumentDto(input: Omit<AwardSourceDocumentDto, 'openUrl' | 'downloadUrl'>): AwardSourceDocumentDto {
  const baseUrl = input.documentId ? `/api/documents/${input.documentId}/content` : '';
  return {
    ...input,
    openUrl: baseUrl,
    downloadUrl: baseUrl ? `${baseUrl}?download=true` : ''
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

function firstDueDate(records: Array<{ dueDate?: Date | null }>) {
  return records.find((record) => record.dueDate)?.dueDate?.toISOString() ?? null;
}

function contractAction(record: ContractRecord, roleContext: 'BUYER' | 'SUPPLIER') {
  if (isPreAwardContract(record)) {
    return {
      stage: 'Contract preparation',
      requiredAction: roleContext === 'BUYER' ? 'Prepare contract' : 'Await buyer contract preparation',
      dueDate: daysFromNow(5),
      riskLevel: roleContext === 'BUYER' ? 'Medium' as const : 'Low' as const,
      nextRoute: `/awards-contracts/negotiation?contract=${record.id}&step=clauses`
    };
  }
  if (record.status === ContractStatus.DRAFT) {
    return {
      stage: 'Draft contract',
      requiredAction: roleContext === 'BUYER' ? 'Generate or update contract draft' : 'Await buyer draft',
      dueDate: daysFromNow(3),
      riskLevel: roleContext === 'BUYER' ? 'Medium' as const : 'Low' as const,
      nextRoute: `/awards-contracts/negotiation?contract=${record.id}&tab=overview`
    };
  }
  if (record.status === ContractStatus.NEGOTIATION) {
    return {
      stage: 'Negotiation',
      requiredAction: roleContext === 'BUYER' ? 'Complete contract owner approval' : 'Review contract terms',
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
      nextRoute: `/awards-contracts/negotiation?contract=${record.id}&tab=signatures`
    };
  }
  if (record.status === ContractStatus.SIGNED || record.status === ContractStatus.MOBILIZATION) {
    return {
      stage: 'Mobilization',
      requiredAction: 'Complete mobilization checklist',
      dueDate: firstDueDate(record.mobilizationItems) ?? daysFromNow(5),
      riskLevel: 'Medium' as const,
      nextRoute: `/awards-contracts/post-award?contract=${record.id}&tab=mobilization`
    };
  }
  if (record.status === ContractStatus.AT_RISK || record.status === ContractStatus.TERMINATION_REVIEW) {
    return {
      stage: record.status === ContractStatus.AT_RISK ? 'At risk' : 'Termination review',
      requiredAction: record.status === ContractStatus.AT_RISK ? 'Review risk and cure actions' : 'Complete termination review',
      dueDate: daysFromNow(1),
      riskLevel: 'Critical' as const,
      nextRoute: `/awards-contracts/post-award?contract=${record.id}&tab=termination`
    };
  }
  if (record.status === ContractStatus.COMPLETED || record.status === ContractStatus.WARRANTY_DEFECTS) {
    return {
      stage: record.status === ContractStatus.WARRANTY_DEFECTS ? 'Warranty / defects' : 'Completion',
      requiredAction: 'Complete close-out',
      dueDate: daysFromNow(7),
      riskLevel: 'Low' as const,
      nextRoute: `/awards-contracts/post-award?contract=${record.id}&tab=closure`
    };
  }
  if (record.status === ContractStatus.TERMINATED || record.status === ContractStatus.CLOSED) {
    return {
      stage: record.status === ContractStatus.TERMINATED ? 'Terminated' : 'Closed',
      requiredAction: 'View audit file',
      dueDate: null,
      riskLevel: 'Low' as const,
      nextRoute: `/awards-contracts/post-award?contract=${record.id}&tab=closure`
    };
  }
  const dueDate = firstDueDate(record.milestones);
  return {
    stage: 'Active contract',
    requiredAction: record.milestones.some((milestone) => milestone.status === ContractMilestoneStatus.SUBMITTED) ? 'Inspect submitted milestone' : 'Monitor contract',
    dueDate,
    riskLevel: urgencyFromDate(dueDate),
    nextRoute: `/awards-contracts/post-award?contract=${record.id}&tab=milestones`
  };
}

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
      'active-contracts': [],
      'closed-contracts': []
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
      const inProgressStatuses: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.NEGOTIATION, ContractStatus.SIGNATURE_PENDING, ContractStatus.SIGNED];
      const closedStatuses: ContractStatus[] = [ContractStatus.COMPLETED, ContractStatus.WARRANTY_DEFECTS, ContractStatus.TERMINATED, ContractStatus.CLOSED];
      if (isPreAwardContract(contract) && roleContext === 'BUYER') {
        queues['contract-preparation'].push(dto);
      } else if (inProgressStatuses.includes(contract.status)) {
        queues['contracts-in-progress'].push(dto);
      } else if (closedStatuses.includes(contract.status)) {
        queues['closed-contracts'].push(dto);
      } else {
        queues['active-contracts'].push(dto);
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
        contractActions: queues['sample-procurement'].length + queues['contract-preparation'].length + queues['contracts-in-progress'].length + queues['active-contracts'].filter((item) => item.requiredAction !== 'Monitor contract').length
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
      if (contract.status === ContractStatus.DRAFT) {
        await tx.contract.update({ where: { id: contract.id }, data: { status: ContractStatus.NEGOTIATION } });
      }
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.version.created', 'contract', contract.id, { versionNo });
    });
    return this.getContract(id, context);
  }

  async createSignatureRequests(id: string, input: ContractSignatureRequestInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id } });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      assertAwardLinkedContract(contract);

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
      const awardLinkedStatuses: ContractStatus[] = [ContractStatus.SIGNATURE_PENDING, ContractStatus.SIGNED, ContractStatus.MOBILIZATION, ContractStatus.ACTIVE];
      if (awardLinkedStatuses.includes(input.status)) {
        assertAwardLinkedContract(contract);
      }
      if (input.status === ContractStatus.ACTIVE) {
        this.assertActivationReady(contract);
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
          payload: input.payload as Prisma.InputJsonObject
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
          payload: input.payload as Prisma.InputJsonObject
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
      await tx.invoice.create({
        data: {
          reference: input.reference || invoiceReference(),
          purchaseOrderId: input.purchaseOrderId,
          contractId,
          buyerOrgId: contract.buyerOrgId,
          supplierOrgId: input.supplierOrgId ?? contract.supplierOrgId,
          status: input.status ?? InvoiceStatus.SUBMITTED,
          amount: input.amount,
          currency: input.currency,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.invoice.created', 'contract', contractId, { amount: input.amount, status: input.status });
    });
    return this.getContract(contractId, context);
  }

  async upsertThreeWayMatch(contractId: string, input: ThreeWayMatchInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      const matched = Boolean(input.poMatched && input.receiptMatched && input.invoiceMatched);
      const status = input.status ?? (matched ? InvoiceStatus.MATCHED : InvoiceStatus.REVIEW);
      await tx.threeWayMatchResult.upsert({
        where: { invoiceId: input.invoiceId },
        update: {
          contractId,
          purchaseOrderId: input.purchaseOrderId,
          acceptanceId: input.acceptanceId,
          status,
          poMatched: input.poMatched ?? false,
          receiptMatched: input.receiptMatched ?? false,
          invoiceMatched: input.invoiceMatched ?? false,
          varianceAmount: input.varianceAmount,
          currency: input.currency,
          reviewerUserId: context.userId ?? null,
          reviewedAt: new Date(),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        },
        create: {
          contractId,
          invoiceId: input.invoiceId,
          purchaseOrderId: input.purchaseOrderId,
          acceptanceId: input.acceptanceId,
          status,
          poMatched: input.poMatched ?? false,
          receiptMatched: input.receiptMatched ?? false,
          invoiceMatched: input.invoiceMatched ?? false,
          varianceAmount: input.varianceAmount,
          currency: input.currency,
          reviewerUserId: context.userId ?? null,
          reviewedAt: new Date(),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
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
        const match = await tx.threeWayMatchResult.findUnique({ where: { invoiceId: input.invoiceId } });
        const matched = Boolean(match?.poMatched && match.receiptMatched && match.invoiceMatched && match.status === InvoiceStatus.MATCHED);
        if (!matched) throw requestError('Resolve three-way matching exceptions before approving payment.', 409);
      }
      const status = input.status ?? InvoiceStatus.REVIEW;
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

  async createPaymentConfirmation(contractId: string, input: PaymentConfirmationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context, true);
      if (input.evidenceDocumentId) await this.assertDocumentVisible(tx, input.evidenceDocumentId, context);
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

  async createNegotiation(contractId: string, input: NegotiationInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, contractId, context);
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
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (contract.status === ContractStatus.DRAFT) await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.NEGOTIATION } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.negotiation.created', 'contract', contractId, { subject: input.subject });
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
      const contract = await this.requireContract(tx, contractId, context, true);
      const certificateNo = input.certificateNo || acceptanceCertificateReference();
      await tx.contractAcceptance.create({
        data: {
          contractId,
          deliverableId: input.deliverableId,
          inspectionId: input.inspectionId,
          certificateNo,
          status: input.status ?? ContractLifecycleItemStatus.APPROVED,
          acceptedValue: input.acceptedValue,
          currency: input.currency,
          acceptedAt: toDateTime(input.acceptedAt) ?? new Date(),
          note: input.note || null,
          payload: input.payload as Prisma.InputJsonObject
        }
      });
      if (input.deliverableId) {
        await tx.contractDeliverable.update({ where: { id: input.deliverableId }, data: { status: input.status ?? ContractLifecycleItemStatus.APPROVED, reviewedAt: new Date() } });
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

  private assertStatusTransition(from: ContractStatus, to: ContractStatus) {
    if (from === to) return;
    const allowed: Record<ContractStatus, ContractStatus[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.NEGOTIATION, ContractStatus.SIGNATURE_PENDING],
      [ContractStatus.NEGOTIATION]: [ContractStatus.SIGNATURE_PENDING, ContractStatus.DRAFT],
      [ContractStatus.SIGNATURE_PENDING]: [ContractStatus.SIGNED],
      [ContractStatus.SIGNED]: [ContractStatus.MOBILIZATION, ContractStatus.ACTIVE, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.MOBILIZATION]: [ContractStatus.ACTIVE, ContractStatus.AT_RISK, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.ACTIVE]: [ContractStatus.AT_RISK, ContractStatus.COMPLETED, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.AT_RISK]: [ContractStatus.ACTIVE, ContractStatus.TERMINATION_REVIEW],
      [ContractStatus.COMPLETED]: [ContractStatus.WARRANTY_DEFECTS, ContractStatus.CLOSED],
      [ContractStatus.WARRANTY_DEFECTS]: [ContractStatus.CLOSED],
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
