import { BidStatus } from '@prisma/client';
import { ModuleService as IdentityService } from '../identity/service.js';
import { ModuleRepository, tenderAcceptsBids, toBidDto } from './repository.js';
import { moduleDefinition, type BidDocumentInput, type BidDraftInput, type ModuleStatus } from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly identity = new IdentityService()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async listMine(token?: string) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const supplierOrgId = requireOrganization(session.user.organizationId);
    const bids = await this.repository.listMine({ supplierOrgId });
    return bids.map(toBidDto);
  }

  async getDraft(token: string | undefined, tenderId: string) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const supplierOrgId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.findTenderForBid(tenderId, supplierOrgId);
    if (!tender) throw requestError('Tender was not found.', 404);
    const bid = tender.bids.find((item) => item.status !== BidStatus.WITHDRAWN);
    return bid ? toBidDto(bid) : null;
  }

  async saveDraft(token: string | undefined, tenderId: string, draft: BidDraftInput) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const supplierOrgId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.findTenderForBid(tenderId, supplierOrgId);
    if (!tender) throw requestError('Tender was not found.', 404);
    assertCanBid(tender, supplierOrgId);
    const existing = tender.bids.find((item) => item.status !== BidStatus.WITHDRAWN);
    if (existing?.status === BidStatus.SUBMITTED) throw requestError('This bid has already been submitted.', 409);
    return this.repository.saveDraft({
      tender,
      supplierOrgId,
      supplierName: session.user.organization || 'Supplier',
      userId: session.user.id,
      draft
    });
  }

  async getBid(token: string | undefined, bidId: string) {
    const session = await this.identity.requireSession(token);
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertBidVisible(bid, session.user.organizationId);
    return toBidDto(bid);
  }

  async patchBid(token: string | undefined, bidId: string, draft: BidDraftInput) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
    const tender = await this.repository.findTenderForBid(bid.tenderId, bid.supplierOrgId);
    if (!tender) throw requestError('Tender was not found.', 404);
    assertCanBid(tender, bid.supplierOrgId);
    return this.repository.saveDraft({
      tender,
      supplierOrgId: bid.supplierOrgId,
      supplierName: bid.supplierOrg.name,
      userId: session.user.id,
      draft
    });
  }

  async addDocuments(token: string | undefined, bidId: string, documents: BidDocumentInput[]) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
    return this.repository.addDocuments({ bid, supplierOrgId: bid.supplierOrgId, userId: session.user.id, documents });
  }

  async submit(token: string | undefined, bidId: string) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('This bid has already been submitted.', 409);
    if (!tenderAcceptsBids(bid.tender)) throw requestError('This tender is not open for bid submission.', 409);
    const hasSubmittedBid = await this.repository.hasSubmittedBidForTenderSupplier({
      tenderId: bid.tenderId,
      supplierOrgId: bid.supplierOrgId,
      excludingBidId: bid.id
    });
    if (hasSubmittedBid) throw requestError('A submitted bid already exists for this tender.', 409);
    const issues = validateBidForSubmission(bid.payload, bid.responses.length, Number(bid.totalAmount ?? 0));
    if (issues.length) throw requestError(`Complete required bid sections before submitting: ${issues.join(', ')}.`, 400);
    const submitted = await this.repository.submit({ bid, userId: session.user.id });
    if (!submitted.receipt) throw requestError('Bid receipt was not created.', 500);
    return {
      ...submitted.receipt,
      bid: submitted
    };
  }

  async withdraw(token: string | undefined, bidId: string) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status !== BidStatus.SUBMITTED) throw requestError('Only submitted bids can be withdrawn.', 409);
    if (!tenderAcceptsBids(bid.tender)) throw requestError('The tender is closed; withdrawal is no longer available.', 409);
    return this.repository.withdraw({ bid, userId: session.user.id });
  }
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) throw requestError('An organization profile is required.', 409);
  return organizationId;
}

function assertCanBid(tender: { buyerOrgId: string; status: unknown; visibility: unknown; closingDate: Date | null }, supplierOrgId: string) {
  if (tender.buyerOrgId === supplierOrgId) throw requestError('Buyers cannot bid on their own tenders.', 403);
  if (!tenderAcceptsBids(tender as Parameters<typeof tenderAcceptsBids>[0])) throw requestError('This tender is not open for bid submission.', 409);
}

function assertBidVisible(bid: { buyerOrgId: string; supplierOrgId: string }, organizationId?: string) {
  if (!organizationId || (bid.buyerOrgId !== organizationId && bid.supplierOrgId !== organizationId)) {
    throw requestError('Bid access is not allowed.', 403);
  }
}

function assertSupplierOwnsBid(bid: { supplierOrgId: string }, organizationId?: string) {
  if (!organizationId || bid.supplierOrgId !== organizationId) throw requestError('Bid access is not allowed.', 403);
}

function validateBidForSubmission(payload: unknown, responseCount: number, totalAmount: number) {
  const body = objectPayload(payload);
  const declarations = objectPayload(body.declarations);
  const issues: string[] = [];
  if (responseCount < 1) issues.push('technical response');
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) issues.push('financial offer');
  if (declarations.confirmAccuracy !== true && declarations.acceptTerms !== true) issues.push('declaration');
  return issues;
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
