import { BidSampleStatus, BidStatus, TenderStatus, Visibility } from '@prisma/client';
import { ModuleService as IdentityService } from '../identity/service.js';
import { ModuleRepository, tenderAcceptsBids, toBidDto } from './repository.js';
import { parseAndStoreBidDocuments, removeStoredBidDocument, validateBidDocumentDescriptor } from './bidDocumentUpload.service.js';
import {
  moduleDefinition,
  type BidDocumentInput,
  type BidDraftInput,
  type CreateBidSampleInput,
  type ModuleStatus,
  type PatchBidSampleInput
} from './types.js';
import { draftWithValidation, validateBidDraft, withValidation } from './bidValidation.service.js';
import type { Request } from 'express';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function validateJsonDocumentMetadata(document: BidDocumentInput) {
  if (!document.checksum || !/^[a-f0-9]{64}$/i.test(document.checksum)) throw requestError('Bid document checksum is required.', 400);
  if (document.objectKey || document.encryptionKeyRef) throw requestError('Invalid bid document payload.', 400);
  const metadata = document.metadata ?? {};
  for (const key of ['storage', 'path', 'localPath', 'fullPath', 'objectKey', 'storagePath', 'sealedPayload', 'iv', 'authTag', 'keyRef', 'encryptionKeyRef', 'encryptionMetadata', 'encryptedPayload']) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) throw requestError('Invalid bid document payload.', 400);
  }
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
    return bids.map((bid) => toBidDto(bid));
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
    assertSupplierCanBidOnTender(tender, supplierOrgId);
    const existing = tender.bids.find((item) => item.status !== BidStatus.WITHDRAWN);
    if (existing?.status === BidStatus.SUBMITTED) throw requestError('This bid has already been submitted.', 409);
    assertTenderAcceptsBidMutations(tender);
    const validation = validateBidDraft({ draft, tender, mode: 'draft' });
    const saved = await this.repository.saveDraft({
      tender,
      supplierOrgId,
      supplierName: session.user.organization || 'Supplier',
      userId: session.user.id,
      draft: draftWithValidation(draft, validation)
    });
    return withValidation(saved, validation);
  }

  async getBid(token: string | undefined, bidId: string) {
    const session = await this.identity.requireSession(token);
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertBidVisible(bid, session.user.organizationId);
    return toBidDto(bid, { revealFinancialDocuments: bid.supplierOrgId === session.user.organizationId });
  }

  async patchBid(token: string | undefined, bidId: string, draft: BidDraftInput) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
    const tender = await this.repository.findTenderForBid(bid.tenderId, bid.supplierOrgId);
    if (!tender) throw requestError('Tender was not found.', 404);
    assertSupplierCanBidOnTender(tender, bid.supplierOrgId);
    assertTenderAcceptsBidMutations(tender);
    const validation = validateBidDraft({ draft, tender, mode: 'draft' });
    const saved = await this.repository.saveDraft({
      tender,
      supplierOrgId: bid.supplierOrgId,
      supplierName: bid.supplierOrg.name,
      userId: session.user.id,
      draft: draftWithValidation(draft, validation)
    });
    return withValidation(saved, validation);
  }

  async addDocuments(token: string | undefined, bidId: string, documents: BidDocumentInput[]) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
    assertTenderAcceptsBidMutations(bid.tender);
    for (const document of documents) {
      validateBidDocumentDescriptor({
        name: document.name,
        documentType: document.documentType,
        envelope: document.envelope,
        mimeType: document.mimeType,
        size: document.size
      });
      validateJsonDocumentMetadata(document);
    }
    return this.repository.addDocuments({ bid, supplierOrgId: bid.supplierOrgId, userId: session.user.id, documents });
  }

  async addMultipartDocuments(token: string | undefined, bidId: string, req: Request) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
    assertTenderAcceptsBidMutations(bid.tender);
    const documents = await parseAndStoreBidDocuments(req, bid.id);
    try {
      return await this.repository.addDocuments({ bid, supplierOrgId: bid.supplierOrgId, userId: session.user.id, documents });
    } catch (error) {
      await Promise.all(documents.map((document) => document.objectKey ? removeStoredBidDocument(document.objectKey, document.metadata).catch(() => undefined) : undefined));
      throw error;
    }
  }

  async deleteDocument(token: string | undefined, bidId: string, documentId: string) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, session.user.organizationId);
    if (bid.status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
    assertTenderAcceptsBidMutations(bid.tender);
    const result = await this.repository.deleteDocument({ bid, documentId, userId: session.user.id });
    await removeStoredBidDocument(result.removedDocument.objectKey, result.removedDocument.metadata).catch(() => undefined);
    return result.bid;
  }

  async createSample(token: string | undefined, bidId: string, input: CreateBidSampleInput) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const supplierOrgId = requireOrganization(session.user.organizationId);
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    assertSupplierOwnsBid(bid, supplierOrgId);
    assertDraftBidForSampleMutation(bid.status);
    assertTenderAcceptsBidMutations(bid.tender);
    assertSampleDeliveryDeadline(input, bid.tender);
    return this.repository.createSample({ bid, userId: session.user.id, sample: input });
  }

  async listSamples(token: string | undefined, bidId: string) {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);
    if (bid.supplierOrgId === organizationId) return this.repository.listSamples({ bidId: bid.id });
    if (bid.buyerOrgId === organizationId) {
      if (bid.status !== BidStatus.SUBMITTED) throw requestError('Bid samples are only visible to buyers after bid submission.', 409);
      return this.repository.listSamples({ bidId: bid.id });
    }
    throw requestError('Bid access is not allowed.', 403);
  }

  async patchSample(token: string | undefined, bidId: string, sampleId: string, input: PatchBidSampleInput) {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    const bid = await this.repository.findBidForAccess(bidId);
    if (!bid) throw requestError('Bid was not found.', 404);

    if (bid.supplierOrgId === organizationId) {
      const submitSession = await this.identity.requirePermission(token, 'bidding.submit');
      assertSupplierOwnsBid(bid, submitSession.user.organizationId);
      assertDraftBidForSampleMutation(bid.status);
      assertTenderAcceptsBidMutations(bid.tender);
      assertSupplierSamplePatch(input);
      assertSampleDeliveryDeadline(input, bid.tender);
      return this.repository.patchSample({ bid, sampleId, userId: submitSession.user.id, actor: 'supplier', patch: input });
    }

    if (bid.buyerOrgId === organizationId) {
      if (bid.status !== BidStatus.SUBMITTED) throw requestError('Bid samples are only visible to buyers after bid submission.', 409);
      assertBuyerSamplePatch(input);
      return this.repository.patchSample({ bid, sampleId, userId: session.user.id, actor: 'buyer', patch: input });
    }

    throw requestError('Bid access is not allowed.', 403);
  }

  async submit(token: string | undefined, bidId: string) {
    const session = await this.identity.requirePermission(token, 'bidding.submit');
    const supplierOrgId = requireOrganization(session.user.organizationId);
    return this.repository.submit({ bidId, supplierOrgId, userId: session.user.id });
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

function assertSupplierCanBidOnTender(tender: { buyerOrgId: string }, supplierOrgId: string) {
  if (tender.buyerOrgId === supplierOrgId) throw requestError('Buyers cannot bid on their own tenders.', 403);
}

function assertTenderAcceptsBidMutations(tender: { status: TenderStatus; visibility: Visibility; closingDate: Date | null }) {
  const visible = tender.visibility === Visibility.PUBLIC_MARKETPLACE || tender.visibility === Visibility.INVITED;
  const open = tender.status === TenderStatus.OPEN || tender.status === TenderStatus.PUBLISHED;
  if (!visible || !open) throw requestError('This tender is not open for bid submission.', 409);
  if (!tender.closingDate) throw requestError('Tender closing date is required before bids can be submitted.', 409);
  if (tender.closingDate.getTime() <= Date.now()) throw requestError('The bid submission deadline has passed.', 409);
}

function assertDraftBidForSampleMutation(status: BidStatus) {
  if (status === BidStatus.SUBMITTED) throw requestError('Submitted bids cannot be edited.', 409);
  if (status !== BidStatus.DRAFT) throw requestError('Only draft bids can be updated with sample records.', 409);
}

function assertSupplierSamplePatch(input: PatchBidSampleInput) {
  if (input.receivedAt !== undefined || input.inspectedAt !== undefined || input.inspectionNotes !== undefined) {
    throw requestError('Suppliers cannot update buyer sample tracking fields.', 403);
  }
  if (
    input.trackingStatus !== undefined &&
    input.trackingStatus !== BidSampleStatus.PENDING_SUBMISSION &&
    input.trackingStatus !== BidSampleStatus.SUBMITTED
  ) {
    throw requestError('Invalid sample tracking status transition.', 409);
  }
}

function assertBuyerSamplePatch(input: PatchBidSampleInput) {
  const supplierFields: Array<keyof PatchBidSampleInput> = [
    'sampleName',
    'relatedItem',
    'quantity',
    'deliveryLocation',
    'deliveryDeadline',
    'courier',
    'trackingNumber',
    'metadata'
  ];
  if (supplierFields.some((field) => input[field] !== undefined)) throw requestError('Buyer cannot change supplier-owned sample fields.', 403);
  if (
    input.trackingStatus !== undefined &&
    input.trackingStatus !== BidSampleStatus.RECEIVED &&
    input.trackingStatus !== BidSampleStatus.INSPECTED &&
    input.trackingStatus !== BidSampleStatus.ACCEPTED &&
    input.trackingStatus !== BidSampleStatus.REJECTED
  ) {
    throw requestError('Invalid sample tracking status transition.', 409);
  }
}

function assertSampleDeliveryDeadline(
  input: { deliveryDeadline?: string; relatedItem?: string },
  tender: { closingDate: Date | null; requirements: unknown }
) {
  if (!input.deliveryDeadline || !tender.closingDate) return;
  const deliveryDeadline = new Date(input.deliveryDeadline);
  if (deliveryDeadline.getTime() <= tender.closingDate.getTime()) return;
  if (sampleDeliveryAfterClosingAllowed(tender.requirements, input.relatedItem)) return;
  throw requestError('Sample delivery deadline cannot be after the tender closing date.', 400);
}

function sampleDeliveryAfterClosingAllowed(requirements: unknown, relatedItem?: string): boolean {
  if (Array.isArray(requirements)) return requirements.some((item) => sampleDeliveryAfterClosingAllowed(item, relatedItem));
  if (!requirements || typeof requirements !== 'object') return false;
  const record = requirements as Record<string, unknown>;
  const identityFields = [record.relatedBoqItem, record.relatedItem, record.sampleName, record.sampleDescription];
  const matchesRelatedItem = relatedItem
    ? identityFields
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .includes(relatedItem.trim().toLowerCase())
    : false;
  const hasSampleIdentity = identityFields.some((value) => typeof value === 'string' && value.trim().length > 0);
  if (record.allowSampleDeliveryAfterClosing === true && (!hasSampleIdentity || matchesRelatedItem)) return true;
  return Object.values(record).some((value) => sampleDeliveryAfterClosingAllowed(value, relatedItem));
}

function assertBidVisible(bid: { buyerOrgId: string; supplierOrgId: string }, organizationId?: string) {
  if (!organizationId || (bid.buyerOrgId !== organizationId && bid.supplierOrgId !== organizationId)) {
    throw requestError('Bid access is not allowed.', 403);
  }
}

function assertSupplierOwnsBid(bid: { supplierOrgId: string }, organizationId?: string) {
  if (!organizationId || bid.supplierOrgId !== organizationId) throw requestError('Bid access is not allowed.', 403);
}
