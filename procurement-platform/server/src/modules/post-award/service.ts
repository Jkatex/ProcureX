import type { ContractStatus } from '@prisma/client';
import { ModuleService as AwardContractService } from '../award-contract/service.js';
import { moduleDefinition, type ModuleStatus, type PostAwardActionDto, type PostAwardContractRowDto, type PostAwardRecordDto, type PostAwardRequestContext, type PostAwardStageDto, type PostAwardWorkspaceDto } from './types.js';
import type { ContractDetailDto, ContractListItemDto } from '../award-contract/types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

const activeStatuses = new Set(['SIGNED', 'PENDING_ACTIVATION', 'MOBILIZATION', 'ACTIVE', 'SUSPENDED', 'AT_RISK', 'COMPLETED', 'WARRANTY_DEFECTS', 'CLOSING', 'TERMINATION_REVIEW', 'TERMINATED', 'CLOSED']);

export class ModuleService {
  constructor(private readonly awardContracts = new AwardContractService()) {}

  async status(): Promise<ModuleStatus> {
    return { ...moduleDefinition, status: 'ready' };
  }

  async contracts(context: PostAwardRequestContext): Promise<PostAwardContractRowDto[]> {
    const pageSize = 100;
    const firstPage = await this.awardContracts.listContracts({ organizationId: context.organizationId ?? '', status: 'all', search: '', page: 1, pageSize }, context);
    const contracts = [...firstPage.contracts];
    for (let page = 2; page <= Number(firstPage.totalPages ?? 1); page += 1) {
      const nextPage = await this.awardContracts.listContracts({ organizationId: context.organizationId ?? '', status: 'all', search: '', page, pageSize }, context);
      contracts.push(...nextPage.contracts);
    }
    return contracts.filter((row) => activeStatuses.has(String(row.status))).map((row) => {
      const viewerRole = contractViewerRole(row, context);
      return {
        id: row.id,
        reference: row.reference,
        title: row.title,
        status: row.status,
        buyerName: viewerRole === 'BUYER' ? 'Your organization' : row.buyerName,
        supplierName: viewerRole === 'SUPPLIER' ? 'Your organization' : row.supplierName,
        viewerRole,
        amount: row.amount,
        currency: row.currency,
        stage: stageLabel(row.status),
        nextAction: row.status === 'COMPLETED' || row.status === 'WARRANTY_DEFECTS' ? 'Prepare close-out' : 'Monitor execution',
        dueDate: null,
        riskLevel: 'Low'
      };
    });
  }

  async workspace(contractId: string, context: PostAwardRequestContext): Promise<PostAwardWorkspaceDto> {
    const contract = await this.awardContracts.contract(contractId, context);
    if (!activeStatuses.has(String(contract.status))) {
      throw requestError('Post Award starts after the contract is signed or active.', 409);
    }
    return workspaceDto(contract);
  }

  async actions(contractId: string, context: PostAwardRequestContext): Promise<PostAwardActionDto[]> {
    return (await this.workspace(contractId, context)).actions;
  }

  async uploadDocument(contractId: string, input: Parameters<AwardContractService['uploadContractDocument']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return this.awardContracts.uploadContractDocument(contractId, input, context);
  }

  async upsertManagementPlan(contractId: string, input: Parameters<AwardContractService['upsertManagementPlan']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertManagementPlan(contractId, input, context)));
  }

  async submitActivationItem(contractId: string, itemId: string, input: Parameters<AwardContractService['submitActivationItem']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.submitActivationItem(contractId, itemId, input, context)));
  }

  async reviewActivationItem(contractId: string, itemId: string, input: Parameters<AwardContractService['reviewActivationItem']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewActivationItem(contractId, itemId, input, context)));
  }

  async activateContract(contractId: string, input: Parameters<AwardContractService['activateContract']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.activateContract(contractId, input, context)));
  }

  async createObligation(contractId: string, input: Parameters<AwardContractService['createObligation']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createObligation(contractId, input, context)));
  }

  async createEvidenceRequirement(contractId: string, input: Parameters<AwardContractService['createEvidenceRequirement']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createEvidenceRequirement(contractId, input, context)));
  }

  async createDeliverySchedule(contractId: string, input: Parameters<AwardContractService['createDeliverySchedule']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverySchedule(contractId, input, context)));
  }

  async createDispatchNotice(contractId: string, input: Parameters<AwardContractService['createDispatchNotice']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDispatchNotice(contractId, input, context)));
  }

  async createGoodsReceipt(contractId: string, input: Parameters<AwardContractService['createGoodsReceipt']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createGoodsReceipt(contractId, input, context)));
  }

  async createSiteHandover(contractId: string, input: Parameters<AwardContractService['createSiteHandover']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createSiteHandover(contractId, input, context)));
  }

  async createWorksProgressReport(contractId: string, input: Parameters<AwardContractService['createWorksProgressReport']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createWorksProgressReport(contractId, input, context)));
  }

  async createBoqMeasurement(contractId: string, input: Parameters<AwardContractService['createBoqMeasurement']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createBoqMeasurement(contractId, input, context)));
  }

  async createInterimPaymentCertificate(contractId: string, input: Parameters<AwardContractService['createInterimPaymentCertificate']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createInterimPaymentCertificate(contractId, input, context)));
  }

  async createContractDefect(contractId: string, input: Parameters<AwardContractService['createContractDefect']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractDefect(contractId, input, context)));
  }

  async createServiceLevel(contractId: string, input: Parameters<AwardContractService['createServiceLevel']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceLevel(contractId, input, context)));
  }

  async createServicePeriod(contractId: string, input: Parameters<AwardContractService['createServicePeriod']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServicePeriod(contractId, input, context)));
  }

  async createServiceReport(contractId: string, input: Parameters<AwardContractService['createServiceReport']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceReport(contractId, input, context)));
  }

  async createServiceCredit(contractId: string, input: Parameters<AwardContractService['createServiceCredit']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceCredit(contractId, input, context)));
  }

  async createConsultancyDeliverable(contractId: string, input: Parameters<AwardContractService['createConsultancyDeliverable']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createConsultancyDeliverable(contractId, input, context)));
  }

  async createDeliverableVersion(contractId: string, input: Parameters<AwardContractService['createDeliverableVersion']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverableVersion(contractId, input, context)));
  }

  async createDeliverableReview(contractId: string, input: Parameters<AwardContractService['createDeliverableReview']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverableReview(contractId, input, context)));
  }

  async createClaim(contractId: string, input: Parameters<AwardContractService['createClaim']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createClaim(contractId, input, context)));
  }

  async createClaimResponse(contractId: string, input: Parameters<AwardContractService['createClaimResponse']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createClaimResponse(contractId, input, context)));
  }

  async createExtensionRequest(contractId: string, input: Parameters<AwardContractService['createExtensionRequest']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createExtensionRequest(contractId, input, context)));
  }

  async createAmendment(contractId: string, input: Parameters<AwardContractService['createAmendment']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createAmendment(contractId, input, context)));
  }

  async createDeliverable(contractId: string, input: Parameters<AwardContractService['createDeliverable']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverable(contractId, input, context)));
  }

  async addMilestoneEvidence(contractId: string, milestoneId: string, input: Parameters<AwardContractService['addMilestoneEvidence']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.addMilestoneEvidence(contractId, milestoneId, input, context)));
  }

  async createInspection(contractId: string, input: Parameters<AwardContractService['createInspection']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createInspection(contractId, input, context)));
  }

  async createAcceptance(contractId: string, input: Parameters<AwardContractService['createAcceptance']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createAcceptance(contractId, input, context)));
  }

  async createInvoice(contractId: string, input: Parameters<AwardContractService['createInvoice']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createInvoice(contractId, input, context)));
  }

  async updateInvoiceStatus(contractId: string, invoiceId: string, input: Parameters<AwardContractService['updateInvoiceStatus']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.updateInvoiceStatus(contractId, invoiceId, input, context)));
  }

  async createPayment(contractId: string, input: Parameters<AwardContractService['createPayment']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createPayment(contractId, input, context)));
  }

  async createIssue(contractId: string, input: Parameters<AwardContractService['createIssue']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createIssue(contractId, input, context)));
  }

  async createVariation(contractId: string, input: Parameters<AwardContractService['createVariation']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createVariation(contractId, input, context)));
  }

  async upsertCloseout(contractId: string, input: Parameters<AwardContractService['upsertCloseout']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertCloseout(contractId, input, context)));
  }

  private async ensureAccess(contractId: string, context: PostAwardRequestContext, owner: 'BUYER' | 'SUPPLIER' | 'SHARED') {
    const workspace = await this.workspace(contractId, context);
    const access = workspace.contract.access;
    if (owner === 'BUYER' && !access.canManageBuyerActions) throw requestError(access.readOnlyReason ?? 'This action is restricted to the buyer.', 403);
    if (owner === 'SUPPLIER' && !access.canSubmitSupplierActions) throw requestError(access.readOnlyReason ?? 'This action is restricted to the supplier.', 403);
    if (owner === 'SHARED' && access.viewerRole === 'NONE') throw requestError(access.readOnlyReason ?? 'You do not have access to this contract.', 403);
  }
}

function requireContractResult(contract: ContractDetailDto | null): ContractDetailDto {
  if (!contract) throw requestError('Contract was not found after saving the post-award action.', 404);
  return contract;
}

function contractViewerRole(contract: ContractListItemDto, context: PostAwardRequestContext): PostAwardContractRowDto['viewerRole'] {
  if (context.isAdmin) return 'ADMIN';
  if (context.organizationId && contract.buyerOrgId === context.organizationId) return 'BUYER';
  if (context.organizationId && contract.supplierOrgId === context.organizationId) return 'SUPPLIER';
  return 'NONE';
}

function workspaceDto(contract: ContractDetailDto): PostAwardWorkspaceDto {
  const role = contract.access?.viewerRole ?? 'NONE';
  return {
    contract: {
      id: contract.id,
      reference: contract.reference,
      title: contract.title,
      status: contract.status as ContractStatus,
      buyerName: contract.buyerName,
      supplierName: contract.supplierName,
      viewerRole: role,
      amount: contract.amount,
      currency: contract.currency,
      stage: stageLabel(contract.status),
      nextAction: nextAction(contract),
      dueDate: nextDueDate(contract),
      riskLevel: riskLabel(contract),
      tenderId: contract.tenderId,
      tenderReference: contract.tenderReference,
      access: {
        viewerRole: role,
        canSubmitSupplierActions: Boolean(contract.access?.canSubmitSupplierActions),
        canManageBuyerActions: Boolean(contract.access?.canManageBuyerActions),
        readOnlyReason: contract.access?.readOnlyReason ?? null
      }
    },
    metrics: [
      { label: 'Milestones', value: contract.milestones.length, tone: 'info' },
      { label: 'Open obligations', value: (contract.obligations ?? []).filter((item) => item.status !== 'CLOSED').length, tone: (contract.obligations ?? []).length ? 'warning' : 'success' },
      { label: 'Invoices', value: contract.invoices?.length ?? 0, tone: 'info' },
      { label: 'Accepted', value: contract.acceptances?.length ?? 0, tone: 'success' }
    ],
    stages: [
      stage('setup', 'Activation / Setup', 'Activation checklist, baselines, obligations, evidence requirements, CMP, and mobilization readiness.', [
        ...typedRecords(contract.activation ? [contract.activation] : [], 'activation'),
        ...typedRecords(contract.activationItems, 'activation_item'),
        ...typedRecords(contract.baselines, 'baseline'),
        ...typedRecords(contract.obligations, 'obligation'),
        ...typedRecords(contract.evidenceRequirements, 'evidence_requirement'),
        ...typedRecords(contract.managementPlan ? [contract.managementPlan] : [], 'management_plan'),
        ...typedRecords(contract.commencements, 'commencement'),
        ...typedRecords(contract.mobilizationItems, 'mobilization')
      ]),
      stage('delivery', 'Delivery', 'Milestones, deliverables, and supplier evidence.', [
        ...typedRecords(contract.milestones, 'milestone'),
        ...typedRecords(contract.deliverables, 'deliverable'),
        ...typedRecords(contract.deliverySchedules, 'delivery_schedule'),
        ...typedRecords(contract.dispatchNotices, 'dispatch_notice'),
        ...typedRecords(contract.goodsReceipts, 'goods_receipt'),
        ...typedRecords(contract.siteHandovers, 'site_handover'),
        ...typedRecords(contract.worksProgressReports, 'works_progress_report'),
        ...typedRecords(contract.boqMeasurements, 'boq_measurement'),
        ...typedRecords(contract.interimPaymentCertificates, 'interim_payment_certificate'),
        ...typedRecords(contract.serviceLevels, 'service_level'),
        ...typedRecords(contract.servicePeriods, 'service_period'),
        ...typedRecords(contract.serviceReports, 'service_report'),
        ...typedRecords(contract.serviceCredits, 'service_credit'),
        ...typedRecords(contract.consultancyDeliverables, 'consultancy_deliverable'),
        ...typedRecords(contract.deliverableVersions, 'deliverable_version'),
        ...typedRecords(contract.deliverableReviews, 'deliverable_review')
      ]),
      stage('inspections', 'Inspections / Acceptance', 'Buyer inspections, goods checks, defects, and acceptance certificates.', [
        ...typedRecords(contract.inspections, 'inspection'),
        ...typedRecords(contract.goodsInspections, 'goods_inspection'),
        ...typedRecords(contract.defects, 'defect'),
        ...typedRecords(contract.acceptances, 'acceptance')
      ]),
      stage('finance', 'Finance', 'Invoices, payment review, approvals, payments, and confirmations.', [
        ...typedRecords(contract.invoices, 'invoice'),
        ...typedRecords(contract.paymentSchedules, 'payment_schedule'),
        ...typedRecords(contract.payments, 'payment'),
        ...typedRecords(contract.paymentApprovals, 'payment_approval'),
        ...typedRecords(contract.paymentConfirmations, 'payment_confirmation')
      ]),
      stage('risk', 'Risk', 'Risks, forecasts, non-conformance, and corrective action.', [
        ...typedRecords(contract.risks, 'risk'),
        ...typedRecords(contract.riskForecasts, 'risk_forecast'),
        ...typedRecords(contract.nonConformances, 'non_conformance'),
        ...typedRecords(contract.issues, 'issue')
      ]),
      stage('changes', 'Changes', 'Formal scope, cost, time, technical changes, and amendments.', [
        ...typedRecords(contract.variations, 'variation'),
        ...typedRecords(contract.changeRequests, 'change_request'),
        ...typedRecords(contract.extensionRequests, 'extension_request'),
        ...typedRecords(contract.amendments, 'amendment'),
        ...typedRecords(contract.disputes, 'dispute')
      ]),
      stage('claims', 'Claims', 'Claims, responses, disputes, and entitlement decisions.', [
        ...typedRecords(contract.claims, 'claim'),
        ...typedRecords(contract.claimResponses, 'claim_response')
      ]),
      stage('documents', 'Documents / Warranty', 'Required documents, warranty records, and securities.', [
        ...typedRecords(contract.requiredDocuments, 'required_document'),
        ...typedRecords(contract.warranties, 'warranty'),
        ...typedRecords(contract.securities, 'security')
      ]),
      stage('closeout', 'Close-out', 'Completion certificate, final account, and lessons learned.', typedRecords(contract.closeout ? [contract.closeout] : [], 'closeout')),
      stage('performance', 'Supplier Performance', 'Supplier scorecards, risk profile, and performance history.', [
        ...typedRecords(contract.supplierPerformanceRecords, 'supplier_performance'),
        ...typedRecords(contract.performanceScores, 'performance_score'),
        ...typedRecords(contract.supplierRiskProfile ? [contract.supplierRiskProfile] : [], 'supplier_risk')
      ]),
      stage('history', 'History', 'Execution activity and audit trail.', [
        ...typedRecords(contract.audit, 'activity'),
        ...typedRecords(contract.notifications, 'notification')
      ])
    ],
    secondary: [
      secondary('termination', 'Termination', typedRecords(contract.terminations, 'termination')),
      secondary('securities', 'Securities', typedRecords(contract.securities, 'security')),
      secondary('audit', 'Audit', typedRecords(contract.audit, 'activity'))
    ],
    actions: actionsFor(contract)
  };
}

function stage(id: PostAwardStageDto['id'], label: string, description: string, records: unknown[]): PostAwardStageDto {
  const normalized = records.filter(Boolean).map(recordDto);
  return { id, label, description, count: normalized.length, records: normalized };
}

function secondary(id: PostAwardWorkspaceDto['secondary'][number]['id'], label: string, records: unknown[]) {
  const normalized = records.filter(Boolean).map(recordDto);
  return { id, label, count: normalized.length, records: normalized };
}

function typedRecords(records: unknown[] | undefined, type: string) {
  return (records ?? []).filter(Boolean).map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { type, value };
    const record = value as Record<string, unknown>;
    return { ...record, type: stringValue(record.type) || type };
  });
}

function recordDto(value: unknown): PostAwardRecordDto {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = stringValue(record.id) || stringValue(record.event) || `${stringValue(record.type) || 'record'}-${stringValue(record.createdAt) || 'generated'}`;
  return {
    id,
    type: stringValue(record.type) || stringValue(record.event) || stringValue(record.category) || 'record',
    title: stringValue(record.title) || stringValue(record.subject) || stringValue(record.reference) || stringValue(record.dispatchReference) || stringValue(record.receiptReference) || stringValue(record.handoverReference) || stringValue(record.reportReference) || stringValue(record.certificateNumber) || stringValue(record.certificateNo) || stringValue(record.claimReference) || stringValue(record.requestReference) || stringValue(record.amendmentReference) || stringValue(record.defectReference) || stringValue(record.deliverableCode) || stringValue(record.boqItemReference) || stringValue(record.metricKey) || stringValue(record.periodKey) || stringValue(record.inspectionNo) || stringValue(record.event) || 'Record',
    status: stringValue(record.status) || stringValue(record.result) || stringValue(record.decision) || stringValue(record.riskLevel) || 'RECORDED',
    ownerRole: stringValue(record.ownerRole) || stringValue(record.responsibleRole) || null,
    dueDate: stringValue(record.dueDate) || stringValue(record.plannedDeliveryDate) || stringValue(record.expectedArrivalDate) || stringValue(record.newCompletionDate) || null,
    amount: (record.amount as number | string | null | undefined) ?? (record.amountClaimed as number | string | null | undefined) ?? (record.approvedAmount as number | string | null | undefined) ?? (record.acceptedValue as number | string | null | undefined) ?? (record.netAmount as number | string | null | undefined) ?? (record.grossAmount as number | string | null | undefined) ?? null,
    currency: stringValue(record.currency) || null,
    note: stringValue(record.note) || stringValue(record.summary) || stringValue(record.description) || null,
    createdAt: stringValue(record.createdAt) || null,
    updatedAt: stringValue(record.updatedAt) || null,
    payload: objectValue(record.payload)
  };
}

function actionsFor(contract: ContractDetailDto): PostAwardActionDto[] {
  const access = contract.access;
  const supplier = Boolean(access?.canSubmitSupplierActions);
  const buyer = Boolean(access?.canManageBuyerActions);
  return [
    action('activation-submit', 'Submit activation item', 'setup', 'SHARED', supplier || buyer, 'High', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('activation-review', 'Review activation item', 'setup', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('activate-contract', 'Activate contract', 'setup', 'BUYER', buyer && (contract.activationItems ?? []).length > 0, 'Critical', (contract.activationItems ?? []).length ? (buyer ? null : access?.readOnlyReason ?? 'Buyer action') : 'Start activation checklist first.'),
    action('obligation', 'Add obligation', 'setup', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('evidence-requirement', 'Add evidence requirement', 'setup', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('management-plan', 'Update CMP', 'setup', 'BUYER', buyer, !contract.managementPlan ? 'High' : 'Low', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('deliverable', 'Submit deliverable', 'delivery', 'SUPPLIER', supplier, 'Medium', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('evidence', 'Upload milestone evidence', 'delivery', 'SUPPLIER', supplier && contract.milestones.length > 0, 'High', contract.milestones.length ? (supplier ? null : access?.readOnlyReason ?? 'Supplier action') : 'Create a milestone first.'),
    action('inspection', 'Record inspection', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('acceptance', 'Accept delivery', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('invoice', 'Submit invoice', 'finance', 'SUPPLIER', supplier, 'Medium', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('payment', 'Record payment review', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('issue', 'Raise issue', 'risk', 'SHARED', supplier || buyer, 'Medium', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('variation', 'Create variation', 'changes', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('closeout', 'Close contract', 'closeout', 'BUYER', buyer, 'Low', buyer ? null : access?.readOnlyReason ?? 'Buyer action')
  ];
}

function action(key: string, label: string, stageId: PostAwardActionDto['stage'], owner: PostAwardActionDto['owner'], enabled: boolean, priority: PostAwardActionDto['priority'], reason: string | null): PostAwardActionDto {
  return { key, label, stage: stageId, owner, priority, enabled, reason };
}

function stringValue(value: unknown) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nextDueDate(contract: ContractDetailDto) {
  return (contract.activationItems ?? []).find((item) => item.dueDate)?.dueDate ?? (contract.obligations ?? []).find((item) => item.dueDate)?.dueDate ?? contract.milestones.find((milestone) => milestone.dueDate)?.dueDate ?? null;
}

function stageLabel(status: string) {
  return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function riskLabel(contract: ContractDetailDto) {
  if (contract.risks.some((risk) => risk.level === 'CRITICAL')) return 'Critical';
  if (contract.issues.some((issue) => issue.status !== 'CLOSED')) return 'High';
  if (contract.milestones.some((milestone) => milestone.status === 'SUBMITTED')) return 'Medium';
  return 'Low';
}

function nextAction(contract: ContractDetailDto) {
  if (contract.status === 'SIGNED') return 'Start activation setup';
  if (contract.status === 'PENDING_ACTIVATION' && (contract.activationItems ?? []).some((item) => item.status !== 'APPROVED' && item.status !== 'WAIVED' && item.status !== 'CLOSED')) return 'Complete activation checklist';
  if (!contract.managementPlan) return 'Complete contract management plan';
  if (contract.deliverables?.some((item) => item.status === 'SUBMITTED')) return 'Inspect submitted deliverables';
  if (contract.invoices?.some((item) => String(item.status) === 'SUBMITTED')) return 'Review submitted invoices';
  if (!contract.closeout && ['COMPLETED', 'WARRANTY_DEFECTS', 'CLOSING'].includes(contract.status)) return 'Prepare close-out';
  return 'Monitor execution';
}
