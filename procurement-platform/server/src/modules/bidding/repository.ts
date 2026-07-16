import { BidSampleStatus, BidStatus, EnvelopeType, TenderStatus, TenderType, Visibility, type Prisma, type PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { signSensitiveAction } from '../identity/sensitiveActionSigning.js';
import { canonicalJson, sealBidPackage, sha256Hex, type CanonicalBidPackage } from './bidEncryption.service.js';
import { draftFromBidRecord, validateBidDraft } from './bidValidation.service.js';
import type { BidDocumentInput, BidDraftInput, BidDto, BidReceiptDto, BidSampleDto, CreateBidSampleInput, PatchBidSampleInput } from './types.js';

const tenderValidationInclude = {
  buyerOrg: { select: { id: true, name: true } },
  requirementRows: { orderBy: { createdAt: 'asc' as const } },
  commercialItems: { orderBy: { itemNo: 'asc' as const } },
  documents: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          documentType: true
        }
      }
    }
  }
} satisfies Prisma.TenderInclude;

const bidInclude = {
  tender: {
    include: tenderValidationInclude
  },
  buyerOrg: { select: { id: true, name: true } },
  supplierOrg: { select: { id: true, name: true } },
  responses: { orderBy: { createdAt: 'asc' } },
  documents: {
    orderBy: { createdAt: 'asc' },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          documentType: true,
          objectKey: true,
          checksum: true,
          encryptionKeyRef: true,
          metadata: true
        }
      }
    }
  },
  samples: { orderBy: { createdAt: 'asc' } },
  receipt: true
} satisfies Prisma.BidInclude;

const tenderBidGuardInclude = {
  buyerOrg: { select: { id: true, name: true } },
  bids: {
    include: bidInclude,
    orderBy: { updatedAt: 'desc' as const }
  }
} satisfies Prisma.TenderInclude;

const tenderSchemaInclude = {
  ...tenderValidationInclude,
  categories: { orderBy: { name: 'asc' as const } },
  milestones: { orderBy: { dueDate: 'asc' as const } }
} satisfies Prisma.TenderInclude;

type BidRecord = Prisma.BidGetPayload<{ include: typeof bidInclude }>;
type TenderBidGuardRecord = Prisma.TenderGetPayload<{ include: typeof tenderBidGuardInclude }>;
export type TenderSchemaRecord = Prisma.TenderGetPayload<{ include: typeof tenderSchemaInclude }>;
type BidSampleRecord = Prisma.BidSampleGetPayload<object>;

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  findTenderForBid(tenderId: string, supplierOrgId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      include: {
        ...tenderBidGuardInclude,
        bids: {
          ...tenderBidGuardInclude.bids,
          where: { supplierOrgId }
        }
      }
    });
  }

  findTenderForSchema(tenderId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      include: tenderSchemaInclude
    });
  }

  findBidForAccess(bidId: string) {
    return this.db.bid.findUnique({
      where: { id: bidId },
      include: bidInclude
    });
  }

  listMine(input: { supplierOrgId: string }) {
    return this.db.bid.findMany({
      where: { supplierOrgId: input.supplierOrgId },
      include: bidInclude,
      orderBy: [{ updatedAt: 'desc' }]
    });
  }

  async hasSubmittedBidForTenderSupplier(input: { tenderId: string; supplierOrgId: string; excludingBidId?: string }) {
    const existing = await this.db.bid.findFirst({
      where: {
        tenderId: input.tenderId,
        supplierOrgId: input.supplierOrgId,
        status: BidStatus.SUBMITTED,
        ...(input.excludingBidId ? { id: { not: input.excludingBidId } } : {})
      },
      select: { id: true }
    });
    return Boolean(existing);
  }

  async saveDraft(input: {
    tender: TenderBidGuardRecord;
    supplierOrgId: string;
    supplierName: string;
    userId: string;
    draft: BidDraftInput;
  }) {
    const existing = input.tender.bids.find((bid) => bid.status !== BidStatus.WITHDRAWN);
    const payload = buildPayload(input.draft);
    const totalAmount = input.draft.totalAmount ?? 0;
    const currency = input.draft.currency || input.tender.currency || 'TZS';

    try {
      const bid = await this.db.$transaction(async (tx) => {
        const saved = existing
          ? await tx.bid.update({
              where: { id: existing.id },
              data: {
                totalAmount,
                currency,
                payload: payload as Prisma.InputJsonObject,
                submittedByUserId: input.userId
              }
            })
          : await tx.bid.create({
              data: {
                tenderId: input.tender.id,
                buyerOrgId: input.tender.buyerOrgId,
                supplierOrgId: input.supplierOrgId,
                submittedByUserId: input.userId,
                reference: await this.nextBidReference(tx),
                totalAmount,
                currency,
                payload: payload as Prisma.InputJsonObject
              }
            });

        await replaceResponses(tx, saved.id, input.draft.responses);
        await replaceDocuments(tx, saved.id, input.supplierOrgId, input.userId, input.draft.documents);
        await audit(tx, input.tender.buyerOrgId, input.userId, 'bidding.bid_draft_saved', saved.id, {
          tenderId: input.tender.id,
          supplierOrgId: input.supplierOrgId,
          validationIssues: input.draft.validationIssues
        });

        return tx.bid.findUniqueOrThrow({
          where: { id: saved.id },
          include: bidInclude
        });
      });

      return toBidDto(bid);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw requestError('A bid already exists for this tender.', 409);
      throw error;
    }
  }

  async addDocuments(input: { bid: BidRecord; supplierOrgId: string; userId: string; documents: BidDocumentInput[]; revealFinancialDocuments?: boolean }) {
    const bid = await this.db.$transaction(async (tx) => {
      await appendDocuments(tx, input.bid.id, input.supplierOrgId, input.userId, input.documents);
      await audit(tx, input.bid.buyerOrgId, input.userId, 'bidding.bid_documents_added', input.bid.id, {
        documentCount: input.documents.length
      });
      return tx.bid.findUniqueOrThrow({ where: { id: input.bid.id }, include: bidInclude });
    });

    return toBidDto(bid, { revealFinancialDocuments: input.revealFinancialDocuments ?? true });
  }

  async deleteDocument(input: { bid: BidRecord; documentId: string; userId: string; revealFinancialDocuments?: boolean }) {
    const result = await this.db.$transaction(async (tx) => {
      const existing = await tx.bidDocument.findFirst({
        where: {
          bidId: input.bid.id,
          documentId: input.documentId
        },
        include: {
          document: {
            select: {
              id: true,
              objectKey: true,
              metadata: true
            }
          }
        }
      });
      if (!existing) throw requestError('Bid document was not found.', 404);

      await tx.bidDocument.delete({ where: { id: existing.id } });
      await tx.documentObject.delete({ where: { id: existing.document.id } });
      await audit(tx, input.bid.buyerOrgId, input.userId, 'bidding.bid_document_deleted', input.bid.id, {
        documentId: input.documentId
      });
      const bid = await tx.bid.findUniqueOrThrow({ where: { id: input.bid.id }, include: bidInclude });
      return {
        bid,
        removedDocument: {
          objectKey: existing.document.objectKey,
          metadata: objectPayload(existing.document.metadata)
        }
      };
    });

    return {
      bid: toBidDto(result.bid, { revealFinancialDocuments: input.revealFinancialDocuments ?? true }),
      removedDocument: result.removedDocument
    };
  }

  async listSamples(input: { bidId: string }) {
    const samples = await this.db.bidSample.findMany({
      where: { bidId: input.bidId },
      orderBy: [{ createdAt: 'asc' }]
    });
    return samples.map(toBidSampleDto);
  }

  async createSample(input: { bid: BidRecord; userId: string; sample: CreateBidSampleInput }) {
    return this.db.$transaction(async (tx) => {
      const status = (input.sample.trackingStatus ?? BidSampleStatus.PENDING_SUBMISSION) as BidSampleStatus;
      const sample = await tx.bidSample.create({
        data: {
          bidId: input.bid.id,
          tenderId: input.bid.tenderId,
          supplierOrgId: input.bid.supplierOrgId,
          sampleName: input.sample.sampleName,
          relatedItem: input.sample.relatedItem ?? null,
          quantity: input.sample.quantity,
          deliveryLocation: input.sample.deliveryLocation ?? null,
          deliveryDeadline: input.sample.deliveryDeadline ? new Date(input.sample.deliveryDeadline) : null,
          trackingStatus: status,
          courier: input.sample.courier ?? null,
          trackingNumber: input.sample.trackingNumber ?? null,
          submittedAt: status === BidSampleStatus.SUBMITTED ? new Date() : null,
          metadata: (input.sample.metadata ?? {}) as Prisma.InputJsonObject
        }
      });
      await auditSample(tx, input.bid.buyerOrgId, input.userId, 'bidding.bid_sample_created', sample);
      if (status === BidSampleStatus.SUBMITTED) {
        await auditSample(tx, input.bid.buyerOrgId, input.userId, 'bidding.bid_sample_submitted', sample);
      }
      return toBidSampleDto(sample);
    });
  }

  async patchSample(input: { bid: BidRecord; sampleId: string; userId: string; actor: 'supplier' | 'buyer'; patch: PatchBidSampleInput }) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.bidSample.findFirst({ where: { id: input.sampleId, bidId: input.bid.id } });
      if (!existing) throw requestError('Bid sample was not found.', 404);

      const nextStatus = input.patch.trackingStatus as BidSampleStatus | undefined;
      if (nextStatus && nextStatus !== existing.trackingStatus) {
        assertSampleStatusTransition(existing.trackingStatus, nextStatus, input.actor);
      }
      const data = patchSampleData(existing, input.patch, input.actor);
      const sample = await tx.bidSample.update({
        where: { id: existing.id },
        data
      });
      const event = nextStatus && nextStatus !== existing.trackingStatus ? sampleStatusAuditEvent(nextStatus) : null;
      if (event) await auditSample(tx, input.bid.buyerOrgId, input.userId, event, sample);
      return toBidSampleDto(sample);
    });
  }

  async submit(input: { bidId: string; supplierOrgId: string; userId: string; signatureKeyphrase?: string }): Promise<BidReceiptDto> {
    const submittedAt = new Date();
    try {
      return await this.db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM bidding.bids WHERE id = ${input.bidId}::uuid FOR UPDATE`;
        if (!locked.length) throw requestError('Bid was not found.', 404);

        const fullBid = await tx.bid.findUnique({ where: { id: input.bidId }, include: bidInclude });
        if (!fullBid) throw requestError('Bid was not found.', 404);

        assertTransactionalSubmitAllowed(fullBid, input.supplierOrgId);
        const duplicate = await tx.bid.findFirst({
          where: {
            tenderId: fullBid.tenderId,
            supplierOrgId: fullBid.supplierOrgId,
            status: BidStatus.SUBMITTED,
            id: { not: fullBid.id }
          },
          select: { id: true }
        });
        if (duplicate) throw requestError('A submitted bid already exists for this tender.', 409);

        const validation = validateBidDraft({ draft: draftFromBidRecord(fullBid), tender: fullBid.tender, samples: fullBid.samples, mode: 'submit' });
        if (!validation.valid) {
          const fields = validation.issues.filter((issue) => issue.severity === 'error').map((issue) => validationIssuePath(issue.section, issue.field));
          throw requestError(`Complete required bid sections before submitting: ${fields.join(', ')}.`, 400);
        }

        const nextVersion = (await tx.bidVersion.count({ where: { bidId: fullBid.id } })) + 1;
        const totalAmount = validation.computedTotalAmount;
        const currency = normalizeCurrency(fullBid.currency, fullBid.tender.currency || 'TZS');
        const canonical = canonicalBidPackage(fullBid, submittedAt.toISOString(), totalAmount, currency);
        const envelopes = bidEnvelopes(fullBid, canonical).map((envelope) => ({
          envelope: envelope.envelope,
          sealed: sealBidPackage(envelope.package, envelope.envelope)
        }));
        const receiptHash = sha256Hex(canonicalJson({ bidId: fullBid.id, envelopes: envelopes.map((item) => ({ envelope: item.envelope, sealedHash: item.sealed.sealedHash })) }));
        const receiptRef = `BID-${fullBid.reference}-${String(nextVersion).padStart(2, '0')}`;

        for (const envelope of envelopes) {
          await tx.bidVersion.create({
            data: {
              bidId: fullBid.id,
              versionNo: nextVersion,
              envelope: envelope.envelope,
              sealedHash: envelope.sealed.sealedHash,
              payload: envelope.sealed as Prisma.InputJsonObject
            }
          });
        }
        await tx.bid.update({
          where: { id: fullBid.id },
          data: {
            status: BidStatus.SUBMITTED,
            submittedAt,
            submittedByUserId: input.userId,
            totalAmount,
            currency
          }
        });
        await tx.bidReceipt.create({
          data: {
            bidId: fullBid.id,
            receiptRef,
            receiptHash: receiptHash
          }
        });
        await signSensitiveAction(tx, {
          userId: input.userId,
          organizationId: input.supplierOrgId,
          signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
          moduleKey: 'bidding',
          actionKey: 'bid.submit',
          entityType: 'bid',
          entityRef: fullBid.id,
          payload: {
            bidId: fullBid.id,
            tenderId: fullBid.tenderId,
            supplierOrgId: fullBid.supplierOrgId,
            receiptRef,
            receiptHash,
            versionNo: nextVersion,
            submittedAt: submittedAt.toISOString()
          }
        });
        await audit(tx, fullBid.buyerOrgId, input.userId, 'bidding.bid_submitted', fullBid.id, {
          tenderId: fullBid.tenderId,
          supplierOrgId: fullBid.supplierOrgId,
          receiptRef,
          receiptHash,
          envelopeHashes: envelopes.map((envelope) => ({ envelope: envelope.envelope, payloadHash: envelope.sealed.payloadHash, sealedHash: envelope.sealed.sealedHash }))
        });

        const submitted = await tx.bid.findUniqueOrThrow({ where: { id: fullBid.id }, include: bidInclude });
        const dto = toBidDto(submitted);
        if (!dto.receipt) throw requestError('Bid receipt was not created.', 500);
        return {
          ...dto.receipt,
          bid: dto
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw requestError('A submitted bid already exists for this tender.', 409);
      throw error;
    }
  }

  async withdraw(input: { bid: BidRecord; userId: string; signatureKeyphrase?: string }) {
    const bid = await this.db.$transaction(async (tx) => {
      await tx.bid.update({
        where: { id: input.bid.id },
        data: { status: BidStatus.WITHDRAWN }
      });
      await signSensitiveAction(tx, {
        userId: input.userId,
        organizationId: input.bid.supplierOrgId,
        signatureKeyphrase: requireSignatureKeyphrase(input.signatureKeyphrase),
        moduleKey: 'bidding',
        actionKey: 'bid.withdraw',
        entityType: 'bid',
        entityRef: input.bid.id,
        payload: {
          bidId: input.bid.id,
          tenderId: input.bid.tenderId,
          supplierOrgId: input.bid.supplierOrgId,
          previousStatus: input.bid.status,
          nextStatus: BidStatus.WITHDRAWN
        }
      });
      await audit(tx, input.bid.buyerOrgId, input.userId, 'bidding.bid_withdrawn', input.bid.id, {
        tenderId: input.bid.tenderId,
        supplierOrgId: input.bid.supplierOrgId
      });
      return tx.bid.findUniqueOrThrow({ where: { id: input.bid.id }, include: bidInclude });
    });

    return toBidDto(bid);
  }

  private async nextBidReference(tx: Prisma.TransactionClient) {
    const count = await tx.bid.count();
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `PX-BID-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}-${suffix}`;
  }
}

export function toBidDto(bid: BidRecord, options: { revealFinancialDocuments?: boolean } = {}): BidDto {
  const revealFinancial = options.revealFinancialDocuments !== false;
  const documents = options.revealFinancialDocuments === false
    ? bid.documents.filter((item) => item.envelope !== EnvelopeType.FINANCIAL)
    : bid.documents;
  return {
    id: bid.id,
    tenderId: bid.tenderId,
    tenderReference: bid.tender.reference,
    tenderTitle: bid.tender.title,
    buyerOrgId: bid.buyerOrgId,
    buyerName: bid.buyerOrg.name,
    supplierOrgId: bid.supplierOrgId,
    supplierName: bid.supplierOrg.name,
    reference: bid.reference,
    status: bid.status,
    submittedAt: bid.submittedAt?.toISOString() ?? null,
    totalAmount: revealFinancial ? Number(bid.totalAmount ?? 0) : 0,
    currency: bid.currency,
    payload: revealFinancial ? objectPayload(bid.payload) : redactedBidPayload(bid.payload),
    responses: bid.responses.filter((item) => revealFinancial || !isFinancialResponse(item.requirementKey, item.response)).map((item) => ({
      requirementKey: item.requirementKey,
      response: objectPayload(item.response)
    })),
    documents: documents.map((item) => ({
      id: item.id,
      documentId: item.documentId,
      name: item.document.name,
      documentType: item.document.documentType,
      envelope: item.envelope,
      reviewStatus: item.reviewStatus,
      checksum: item.document.checksum,
      metadata: responseDocumentMetadata(item.document.metadata)
    })),
    receipt: bid.receipt
      ? {
          receiptRef: bid.receipt.receiptRef,
          receiptHash: bid.receipt.receiptHash,
          createdAt: bid.receipt.createdAt.toISOString()
        }
      : null,
    createdAt: bid.createdAt.toISOString(),
    updatedAt: bid.updatedAt.toISOString()
  };
}

export function tenderAcceptsBids(tender: { status: TenderStatus; visibility: Visibility; closingDate: Date | null }) {
  const visible = tender.visibility === Visibility.PUBLIC_MARKETPLACE || tender.visibility === Visibility.INVITED;
  const open = tender.status === TenderStatus.OPEN || tender.status === TenderStatus.PUBLISHED;
  const beforeClose = Boolean(tender.closingDate && tender.closingDate.getTime() > Date.now());
  return visible && open && beforeClose;
}

export function toBidSampleDto(sample: BidSampleRecord): BidSampleDto {
  return {
    id: sample.id,
    bidId: sample.bidId,
    tenderId: sample.tenderId,
    supplierOrgId: sample.supplierOrgId,
    sampleName: sample.sampleName,
    relatedItem: sample.relatedItem,
    quantity: sample.quantity === null || sample.quantity === undefined ? null : Number(sample.quantity),
    deliveryLocation: sample.deliveryLocation,
    deliveryDeadline: sample.deliveryDeadline?.toISOString() ?? null,
    trackingStatus: sample.trackingStatus,
    courier: sample.courier,
    trackingNumber: sample.trackingNumber,
    submittedAt: sample.submittedAt?.toISOString() ?? null,
    receivedAt: sample.receivedAt?.toISOString() ?? null,
    inspectedAt: sample.inspectedAt?.toISOString() ?? null,
    inspectionNotes: sample.inspectionNotes,
    metadata: objectPayload(sample.metadata),
    createdAt: sample.createdAt.toISOString(),
    updatedAt: sample.updatedAt.toISOString()
  };
}

function assertTransactionalSubmitAllowed(
  bid: BidRecord,
  supplierOrgId: string
) {
  if (bid.supplierOrgId !== supplierOrgId) throw requestError('Bid access is not allowed.', 403);
  if (bid.status === BidStatus.SUBMITTED || bid.receipt) throw requestError('This bid has already been submitted.', 409);
  if (bid.status !== BidStatus.DRAFT) throw requestError('Only draft bids can be submitted.', 409);
  assertTenderAcceptsBidSubmission(bid.tender);
  if (bid.buyerOrgId === bid.supplierOrgId) throw requestError('Buyers cannot bid on their own tenders.', 403);
}

function assertTenderAcceptsBidSubmission(tender: { status: TenderStatus; visibility: Visibility; closingDate: Date | null }) {
  const visible = tender.visibility === Visibility.PUBLIC_MARKETPLACE || tender.visibility === Visibility.INVITED;
  const open = tender.status === TenderStatus.OPEN || tender.status === TenderStatus.PUBLISHED;
  if (!visible || !open) throw requestError('This tender is not open for bid submission.', 409);
  if (!tender.closingDate) throw requestError('Tender closing date is required before bids can be submitted.', 409);
  if (tender.closingDate.getTime() <= Date.now()) throw requestError('The bid submission deadline has passed.', 409);
}

function normalizeCurrency(value: string, fallback: string) {
  const candidate = String(value || fallback || 'TZS').trim().toUpperCase();
  return /^[A-Z0-9]{3,8}$/.test(candidate) ? candidate : 'TZS';
}

function assertSampleStatusTransition(current: BidSampleStatus, next: BidSampleStatus, actor: 'supplier' | 'buyer') {
  const supplierTransitions = new Set([
    `${BidSampleStatus.REQUIRED}:${BidSampleStatus.PENDING_SUBMISSION}`,
    `${BidSampleStatus.REQUIRED}:${BidSampleStatus.SUBMITTED}`,
    `${BidSampleStatus.PENDING_SUBMISSION}:${BidSampleStatus.SUBMITTED}`
  ]);
  const buyerTransitions = new Set([
    `${BidSampleStatus.SUBMITTED}:${BidSampleStatus.RECEIVED}`,
    `${BidSampleStatus.RECEIVED}:${BidSampleStatus.INSPECTED}`,
    `${BidSampleStatus.INSPECTED}:${BidSampleStatus.ACCEPTED}`,
    `${BidSampleStatus.INSPECTED}:${BidSampleStatus.REJECTED}`
  ]);
  const key = `${current}:${next}`;
  const allowed = actor === 'supplier' ? supplierTransitions : buyerTransitions;
  if (!allowed.has(key)) throw requestError('Invalid sample tracking status transition.', 409);
}

function patchSampleData(existing: BidSampleRecord, patch: PatchBidSampleInput, actor: 'supplier' | 'buyer'): Prisma.BidSampleUpdateInput {
  const data: Prisma.BidSampleUpdateInput = {};
  if (actor === 'supplier') {
    if (patch.sampleName !== undefined) data.sampleName = patch.sampleName;
    if (patch.relatedItem !== undefined) data.relatedItem = patch.relatedItem;
    if (patch.quantity !== undefined) data.quantity = patch.quantity;
    if (patch.deliveryLocation !== undefined) data.deliveryLocation = patch.deliveryLocation;
    if (patch.deliveryDeadline !== undefined) data.deliveryDeadline = new Date(patch.deliveryDeadline);
    if (patch.courier !== undefined) data.courier = patch.courier;
    if (patch.trackingNumber !== undefined) data.trackingNumber = patch.trackingNumber;
    if (patch.metadata !== undefined) data.metadata = patch.metadata as Prisma.InputJsonObject;
    if (patch.trackingStatus !== undefined) {
      data.trackingStatus = patch.trackingStatus as BidSampleStatus;
      if (patch.trackingStatus === BidSampleStatus.SUBMITTED && !existing.submittedAt) data.submittedAt = new Date();
    }
    return data;
  }

  if (patch.trackingStatus !== undefined) {
    data.trackingStatus = patch.trackingStatus as BidSampleStatus;
    if (patch.trackingStatus === BidSampleStatus.RECEIVED && !existing.receivedAt) data.receivedAt = patch.receivedAt ? new Date(patch.receivedAt) : new Date();
    if (patch.trackingStatus === BidSampleStatus.INSPECTED && !existing.inspectedAt) data.inspectedAt = patch.inspectedAt ? new Date(patch.inspectedAt) : new Date();
  }
  if (patch.receivedAt !== undefined) data.receivedAt = new Date(patch.receivedAt);
  if (patch.inspectedAt !== undefined) data.inspectedAt = new Date(patch.inspectedAt);
  if (patch.inspectionNotes !== undefined) data.inspectionNotes = patch.inspectionNotes;
  return data;
}

function sampleStatusAuditEvent(status: BidSampleStatus) {
  const events: Partial<Record<BidSampleStatus, string>> = {
    [BidSampleStatus.SUBMITTED]: 'bidding.bid_sample_submitted',
    [BidSampleStatus.RECEIVED]: 'bidding.bid_sample_received',
    [BidSampleStatus.INSPECTED]: 'bidding.bid_sample_inspected',
    [BidSampleStatus.ACCEPTED]: 'bidding.bid_sample_accepted',
    [BidSampleStatus.REJECTED]: 'bidding.bid_sample_rejected'
  };
  return events[status] ?? null;
}

function validationIssuePath(section: string, field: string) {
  if (!field) return section;
  return field.startsWith(`${section}.`) ? field : `${section}.${field}`;
}

function buildPayload(draft: BidDraftInput) {
  return {
    workflowType: draft.workflowType ?? 'generic',
    workflowVersion: draft.workflowVersion ?? 'procurex-v1',
    administrative: draft.administrative,
    technical: draft.technical,
    financial: draft.financial,
    declarations: draft.declarations,
    fileManifest: draft.fileManifest ?? {},
    envelopes: draft.envelopes ?? {},
    reviewReadiness: draft.reviewReadiness ?? {},
    workspaceState: draft.workspaceState ?? {},
    completeness: draft.completeness,
    validationIssues: draft.validationIssues
  };
}

async function replaceResponses(tx: Prisma.TransactionClient, bidId: string, responses: BidDraftInput['responses']) {
  await tx.bidResponse.deleteMany({ where: { bidId } });
  if (!responses.length) return;
  await tx.bidResponse.createMany({
    data: responses.map((item) => ({
      bidId,
      requirementKey: item.requirementKey,
      response: item.response as Prisma.InputJsonObject
    }))
  });
}

async function replaceDocuments(tx: Prisma.TransactionClient, bidId: string, ownerOrgId: string, userId: string, documents: BidDocumentInput[]) {
  await tx.bidDocument.deleteMany({ where: { bidId } });
  await appendDocuments(tx, bidId, ownerOrgId, userId, documents);
}

async function appendDocuments(tx: Prisma.TransactionClient, bidId: string, ownerOrgId: string, userId: string, documents: BidDocumentInput[]) {
  for (const document of documents) {
    const documentId = document.documentId || (await tx.documentObject.create({
      data: {
        ownerOrgId,
        uploadedByUserId: userId,
        name: document.name,
        objectKey: document.objectKey || `bid/${bidId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${document.name}`,
        documentType: document.documentType,
        checksum: document.checksum,
        encryptionKeyRef: document.encryptionKeyRef,
        metadata: {
          ...safeDocumentMetadata(document.metadata),
          ...(document.size !== undefined ? { size: document.size } : {}),
          ...(document.mimeType ? { mimeType: document.mimeType } : {})
        } as Prisma.InputJsonObject
      }
    })).id;
    await tx.bidDocument.deleteMany({ where: { bidId, documentId } });
    await tx.bidDocument.create({
      data: {
        bidId,
        documentId,
        envelope: (document.envelope ?? 'COMBINED') as EnvelopeType
      }
    });
  }
}

function canonicalBidPackage(bid: BidRecord, submittedAt: string, totalAmount = Number(bid.totalAmount ?? 0), currency = bid.currency): CanonicalBidPackage {
  return {
    bidId: bid.id,
    tenderId: bid.tenderId,
    supplierOrgId: bid.supplierOrgId,
    buyerOrgId: bid.buyerOrgId,
    payload: {
      bid: objectPayload(bid.payload),
      responses: bid.responses.map((item) => ({
        requirementKey: item.requirementKey,
        response: objectPayload(item.response)
      }))
    },
    documentChecksums: documentChecksumRecords(bid),
    computedTotalAmount: totalAmount,
    currency,
    submittedAt
  };
}

function bidEnvelopes(bid: BidRecord, canonical: CanonicalBidPackage) {
  const payload = objectPayload(bid.payload);
  if (bid.tender.type !== TenderType.CONSULTANCY) {
    return [
      {
        envelope: EnvelopeType.COMBINED,
        package: canonical
      }
    ];
  }

  const technicalPackage: CanonicalBidPackage = {
    ...canonical,
    payload: {
      bid: {
        workflowType: payload.workflowType,
        workflowVersion: payload.workflowVersion,
        administrative: payload.administrative,
        technical: payload.technical,
        declarations: payload.declarations,
        completeness: payload.completeness
      },
      responses: bid.responses
        .filter((item) => !item.requirementKey.toLowerCase().includes('financial'))
        .map((item) => ({ requirementKey: item.requirementKey, response: objectPayload(item.response) }))
    },
    documentChecksums: documentChecksumRecords(bid, (item) => item.envelope !== EnvelopeType.FINANCIAL)
  };
  const financialPackage: CanonicalBidPackage = {
    ...canonical,
    payload: {
      bid: {
        workflowType: payload.workflowType,
        workflowVersion: payload.workflowVersion,
        financial: payload.financial,
        declarations: payload.declarations,
        completeness: payload.completeness
      },
      responses: bid.responses
        .filter((item) => item.requirementKey.toLowerCase().includes('financial'))
        .map((item) => ({ requirementKey: item.requirementKey, response: objectPayload(item.response) }))
    },
    documentChecksums: documentChecksumRecords(bid, (item) => item.envelope === EnvelopeType.FINANCIAL)
  };

  return [
    {
      envelope: EnvelopeType.TECHNICAL,
      package: technicalPackage
    },
    {
      envelope: EnvelopeType.FINANCIAL,
      package: financialPackage
    }
  ];
}

function documentChecksumRecords(bid: BidRecord, predicate: (item: BidRecord['documents'][number]) => boolean = () => true) {
  return bid.documents
    .filter(predicate)
    .map((item) => ({
      documentId: item.documentId,
      envelope: item.envelope,
      checksum: item.document.checksum ?? null
    }))
    .sort((left, right) => `${left.envelope}:${left.documentId}:${left.checksum ?? ''}`.localeCompare(`${right.envelope}:${right.documentId}:${right.checksum ?? ''}`));
}

async function audit(tx: Prisma.TransactionClient, ownerOrgId: string, actorUserId: string, event: string, entityRef: string, payload: Record<string, unknown>) {
  await tx.auditEvent.create({
    data: {
      ownerOrgId,
      actorUserId,
      event,
      entityType: 'bid',
      entityRef,
      payload: payload as Prisma.InputJsonObject
    }
  });
}

async function auditSample(tx: Prisma.TransactionClient, ownerOrgId: string, actorUserId: string, event: string, sample: BidSampleRecord) {
  await audit(tx, ownerOrgId, actorUserId, event, sample.id, {
    bidId: sample.bidId,
    tenderId: sample.tenderId,
    supplierOrgId: sample.supplierOrgId,
    trackingStatus: sample.trackingStatus
  });
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function redactedBidPayload(value: unknown): Record<string, unknown> {
  const payload = { ...objectPayload(value) };
  delete payload.financial;
  delete payload.fileManifest;
  delete payload.envelopes;
  delete payload.totalAmount;
  return payload;
}

function isFinancialResponse(requirementKey: string, response: unknown) {
  const key = requirementKey.toLowerCase();
  if (key.includes('financial') || key.includes('price') || key.includes('boq') || key.includes('fee')) return true;
  const payload = objectPayload(response);
  return Object.keys(payload).some((item) => {
    const normalized = item.toLowerCase();
    return normalized.includes('financial') || normalized.includes('price') || normalized.includes('amount') || normalized.includes('rate') || normalized.includes('fee');
  });
}

function responseDocumentMetadata(value: unknown): Record<string, unknown> {
  return safeDocumentMetadata(value);
}

function safeDocumentMetadata(value: unknown): Record<string, unknown> {
  const metadata = { ...objectPayload(value) };
  for (const key of [
    'localPath',
    'path',
    'fullPath',
    'objectKey',
    'storagePath',
    'sealedPayload',
    'iv',
    'authTag',
    'keyRef',
    'encryptionKeyRef',
    'encryptionMetadata',
    'encryptedPayload'
  ]) {
    delete metadata[key];
  }
  return metadata;
}

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function requireSignatureKeyphrase(value?: string) {
  if (!value) throw requestError('Digital signature keyphrase is required.', 400);
  return value;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}
