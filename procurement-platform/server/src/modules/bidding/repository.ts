import { BidStatus, EnvelopeType, TenderStatus, Visibility, type Prisma, type PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import type { BidDocumentInput, BidDraftInput, BidDto } from './types.js';

const bidInclude = {
  tender: {
    select: {
      id: true,
      reference: true,
      title: true,
      type: true,
      status: true,
      visibility: true,
      closingDate: true,
      currency: true,
      buyerOrgId: true,
      buyerOrg: { select: { id: true, name: true } }
    }
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
          checksum: true,
          metadata: true
        }
      }
    }
  },
  receipt: true
} satisfies Prisma.BidInclude;

const tenderBidGuardInclude = {
  buyerOrg: { select: { id: true, name: true } },
  bids: {
    include: bidInclude,
    orderBy: { updatedAt: 'desc' as const }
  }
} satisfies Prisma.TenderInclude;

type BidRecord = Prisma.BidGetPayload<{ include: typeof bidInclude }>;
type TenderBidGuardRecord = Prisma.TenderGetPayload<{ include: typeof tenderBidGuardInclude }>;

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
    const totalAmount = input.draft.totalAmount ?? deriveTotalAmount(input.draft);
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

  async addDocuments(input: { bid: BidRecord; supplierOrgId: string; userId: string; documents: BidDocumentInput[] }) {
    const bid = await this.db.$transaction(async (tx) => {
      await appendDocuments(tx, input.bid.id, input.supplierOrgId, input.userId, input.documents);
      await audit(tx, input.bid.buyerOrgId, input.userId, 'bidding.bid_documents_added', input.bid.id, {
        documentCount: input.documents.length
      });
      return tx.bid.findUniqueOrThrow({ where: { id: input.bid.id }, include: bidInclude });
    });

    return toBidDto(bid);
  }

  async submit(input: { bid: BidRecord; userId: string }) {
    const submittedAt = new Date();
    try {
      const bid = await this.db.$transaction(async (tx) => {
        const fullBid = await tx.bid.findUniqueOrThrow({ where: { id: input.bid.id }, include: bidInclude });
        const nextVersion = (await tx.bidVersion.count({ where: { bidId: fullBid.id } })) + 1;
        const canonical = canonicalBidPayload(fullBid, submittedAt.toISOString());
        const envelopes = bidEnvelopes(fullBid, canonical);
        const sealedHash = sha256(JSON.stringify({ bidId: fullBid.id, envelopes: envelopes.map((item) => ({ envelope: item.envelope, sealedHash: item.sealedHash })) }));
        const receiptRef = `BID-${fullBid.reference}-${String(nextVersion).padStart(2, '0')}`;

        await tx.bidVersion.createMany({
          data: envelopes.map((envelope) => ({
            bidId: fullBid.id,
            versionNo: nextVersion,
            envelope: envelope.envelope,
            sealedHash: envelope.sealedHash,
            payload: envelope.payload as Prisma.InputJsonObject
          }))
        });
        await tx.bid.update({
          where: { id: fullBid.id },
          data: {
            status: BidStatus.SUBMITTED,
            submittedAt,
            submittedByUserId: input.userId
          }
        });
        await tx.bidReceipt.upsert({
          where: { bidId: fullBid.id },
          update: {
            receiptRef,
            receiptHash: sealedHash
          },
          create: {
            bidId: fullBid.id,
            receiptRef,
            receiptHash: sealedHash
          }
        });
        await audit(tx, fullBid.buyerOrgId, input.userId, 'bidding.bid_submitted', fullBid.id, {
          tenderId: fullBid.tenderId,
          supplierOrgId: fullBid.supplierOrgId,
          receiptRef,
          receiptHash: sealedHash,
          envelopeHashes: envelopes.map((envelope) => ({ envelope: envelope.envelope, sealedHash: envelope.sealedHash }))
        });

        return tx.bid.findUniqueOrThrow({ where: { id: fullBid.id }, include: bidInclude });
      });

      return toBidDto(bid);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw requestError('A submitted bid already exists for this tender.', 409);
      throw error;
    }
  }

  async withdraw(input: { bid: BidRecord; userId: string }) {
    const bid = await this.db.$transaction(async (tx) => {
      await tx.bid.update({
        where: { id: input.bid.id },
        data: { status: BidStatus.WITHDRAWN }
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

export function toBidDto(bid: BidRecord): BidDto {
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
    totalAmount: Number(bid.totalAmount ?? 0),
    currency: bid.currency,
    payload: objectPayload(bid.payload),
    responses: bid.responses.map((item) => ({
      requirementKey: item.requirementKey,
      response: objectPayload(item.response)
    })),
    documents: bid.documents.map((item) => ({
      id: item.id,
      documentId: item.documentId,
      name: item.document.name,
      documentType: item.document.documentType,
      envelope: item.envelope,
      reviewStatus: item.reviewStatus,
      checksum: item.document.checksum,
      metadata: objectPayload(item.document.metadata)
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
  const beforeClose = !tender.closingDate || tender.closingDate.getTime() > Date.now();
  return visible && open && beforeClose;
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
    completeness: draft.completeness,
    validationIssues: draft.validationIssues
  };
}

function deriveTotalAmount(draft: BidDraftInput) {
  const rows = Array.isArray(draft.financial.items) ? draft.financial.items : [];
  return rows.reduce((sum, row) => {
    if (!row || typeof row !== 'object') return sum;
    const record = row as Record<string, unknown>;
    const total = Number(record.total ?? 0);
    if (Number.isFinite(total)) return sum + total;
    const quantity = Number(record.quantity ?? 0);
    const rate = Number(record.rate ?? 0);
    return Number.isFinite(quantity) && Number.isFinite(rate) ? sum + quantity * rate : sum;
  }, 0);
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
    const object = await tx.documentObject.create({
      data: {
        ownerOrgId,
        uploadedByUserId: userId,
        name: document.name,
        objectKey: document.objectKey || `bid/${bidId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${document.name}`,
        documentType: document.documentType,
        checksum: document.checksum,
        metadata: {
          ...(document.metadata ?? {}),
          ...(document.size !== undefined ? { size: document.size } : {}),
          ...(document.mimeType ? { mimeType: document.mimeType } : {})
        } as Prisma.InputJsonObject
      }
    });
    await tx.bidDocument.create({
      data: {
        bidId,
        documentId: object.id,
        envelope: (document.envelope ?? 'COMBINED') as EnvelopeType
      }
    });
  }
}

function canonicalBidPayload(bid: BidRecord, submittedAt: string) {
  return {
    bidId: bid.id,
    tenderId: bid.tenderId,
    tenderReference: bid.tender.reference,
    supplierOrgId: bid.supplierOrgId,
    totalAmount: Number(bid.totalAmount ?? 0),
    currency: bid.currency,
    submittedAt,
    payload: objectPayload(bid.payload),
    responses: bid.responses.map((item) => [item.requirementKey, objectPayload(item.response)]),
    documents: bid.documents.map((item) => ({
      name: item.document.name,
      documentType: item.document.documentType,
      envelope: item.envelope,
      checksum: item.document.checksum
    }))
  };
}

function bidEnvelopes(bid: BidRecord, canonical: ReturnType<typeof canonicalBidPayload>) {
  const payload = objectPayload(bid.payload);
  if (bid.tender.type !== 'Consultancy') {
    return [
      {
        envelope: EnvelopeType.COMBINED,
        sealedHash: sha256(JSON.stringify(canonical)),
        payload: canonical
      }
    ];
  }

  const technicalPayload = {
    ...canonical,
    envelope: EnvelopeType.TECHNICAL,
    payload: {
      workflowType: payload.workflowType,
      workflowVersion: payload.workflowVersion,
      administrative: payload.administrative,
      technical: payload.technical,
      declarations: payload.declarations,
      completeness: payload.completeness
    },
    documents: canonical.documents.filter((document) => document.envelope !== EnvelopeType.FINANCIAL),
    responses: canonical.responses.filter(([key]) => !String(key).toLowerCase().includes('financial'))
  };
  const financialPayload = {
    ...canonical,
    envelope: EnvelopeType.FINANCIAL,
    payload: {
      workflowType: payload.workflowType,
      workflowVersion: payload.workflowVersion,
      financial: payload.financial,
      declarations: payload.declarations,
      completeness: payload.completeness
    },
    documents: canonical.documents.filter((document) => document.envelope === EnvelopeType.FINANCIAL),
    responses: canonical.responses.filter(([key]) => String(key).toLowerCase().includes('financial'))
  };

  return [
    {
      envelope: EnvelopeType.TECHNICAL,
      sealedHash: sha256(JSON.stringify(technicalPayload)),
      payload: technicalPayload
    },
    {
      envelope: EnvelopeType.FINANCIAL,
      sealedHash: sha256(JSON.stringify(financialPayload)),
      payload: financialPayload
    }
  ];
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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}
