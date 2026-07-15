import {
  BidStatus,
  CommunicationKind,
  CommunicationPriority,
  CommunicationStatus,
  OrganizationKind,
  ProcurementMethod,
  RiskLevel,
  TenderAmendmentStatus,
  TenderStatus,
  TenderType,
  Visibility,
  VerificationStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { signSensitiveAction } from '../identity/sensitiveActionSigning.js';
import { profileImageMetadata, type ProfileImageMetadata } from '../identity/profileImageStorage.js';
import { categorySearchTerms, standardizeCategoryName } from './category-taxonomy.js';
import { tenderLanguageScannerVersion } from './design-language-scanner.js';
import type {
  CloseTenderResponseDto,
  CreateTenderInput,
  CreateTenderResponseDto,
  DeleteTenderDraftResponseDto,
  MarketplaceQuery,
  MarketplaceTenderRow,
  MyBidRow,
  MyTenderRow,
  PublishTenderResponseDto,
  ProcurementPlanLineInput,
  ProcurementPlanLinePatchInput,
  ProcurementPlanningQuery,
  ProcurementMarketplacePayload,
  SaveAnnualPlanInput,
  SavedTendersPayload,
  SaveTenderResponseDto,
  TenderAmendmentDto,
  TenderAmendmentInput,
  TenderAmendmentPatchInput,
  TenderAmendmentResponseDto,
  TenderAmendmentsResponseDto,
  TenderReviewDecisionResponseDto,
  TenderReviewDetailDto,
  TenderReviewFailInput,
  TenderReviewListDto,
  TenderReviewQuery,
  TenderReviewQueueItemDto,
  TenderDetailDto,
  TenderDocumentStreamDto,
  TenderLanguageScanDto,
  UnsaveTenderResponseDto,
  UpdateBuyerNoticeInput,
  UpdateBuyerNoticeResponseDto,
  UpdateTenderInput,
  UpdateTenderResponseDto,
  UpdateProcurementPlanInput
} from './types.js';

const planInclude = {
  ownerOrg: { select: { id: true, name: true } },
  lines: {
    orderBy: [{ openingDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      tender: { select: { id: true } }
    }
  }
} satisfies Prisma.ProcurementPlanInclude;

type ProcurementPlanRecord = Prisma.ProcurementPlanGetPayload<{ include: typeof planInclude }>;

const marketplaceTenderInclude = {
  buyerOrg: {
    select: {
      id: true,
      name: true,
      verificationProfiles: {
        select: { payload: true },
        orderBy: { updatedAt: 'desc' },
        take: 1
      }
    }
  },
  categories: { select: { name: true }, orderBy: { name: 'asc' } }
} satisfies Prisma.TenderInclude;

const tenderViewedEvent = 'procurement.tender.viewed';
const tenderDocumentDownloadedEvent = 'procurement.tender_document.downloaded';
const amendmentCreatedEvent = 'procurement.tender_amendment.created';
const amendmentUpdatedEvent = 'procurement.tender_amendment.updated';
const amendmentPublishedEvent = 'procurement.tender_amendment.published';
const amendmentCancelledEvent = 'procurement.tender_amendment.cancelled';

function tenderDetailInclude() {
  return {
    ...marketplaceTenderInclude,
    bids: {
      select: {
        id: true,
        reference: true,
        supplierOrgId: true,
        supplierOrg: { select: { id: true, name: true } },
        status: true,
        submittedAt: true,
        receipt: { select: { receiptHash: true } }
      },
      orderBy: { updatedAt: 'desc' }
    },
    requirementRows: { orderBy: [{ section: 'asc' }, { createdAt: 'asc' }] },
    milestones: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] },
    commercialItems: { orderBy: { itemNo: 'asc' } },
    documents: {
      include: {
        document: {
          select: { id: true, name: true, documentType: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    },
    amendments: {
      select: { status: true }
    }
  } satisfies Prisma.TenderInclude;
}

const tenderReviewQueueInclude = {
  buyerOrg: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, displayName: true, email: true } },
  categories: { select: { name: true }, orderBy: { name: 'asc' } }
} satisfies Prisma.TenderInclude;

const tenderClarificationInquiryInclude = {
  senderOrg: { select: { id: true, name: true } }
} satisfies Prisma.CommunicationItemInclude;

function tenderReviewDetailInclude() {
  return {
    ...tenderDetailInclude(),
    ownerUser: { select: { id: true, displayName: true, email: true } }
  } satisfies Prisma.TenderInclude;
}

type MarketplaceTenderRecord = Prisma.TenderGetPayload<{ include: typeof marketplaceTenderInclude }>;
type TenderDetailRecord = Prisma.TenderGetPayload<{ include: ReturnType<typeof tenderDetailInclude> }>;
type TenderReviewQueueRecord = Prisma.TenderGetPayload<{ include: typeof tenderReviewQueueInclude }>;
type TenderReviewDetailRecord = Prisma.TenderGetPayload<{ include: ReturnType<typeof tenderReviewDetailInclude> }>;
type TenderClarificationInquiryRecord = Prisma.CommunicationItemGetPayload<{ include: typeof tenderClarificationInquiryInclude }>;
type MarketplaceBidRecord = Prisma.BidGetPayload<{ include: { tender: { include: typeof marketplaceTenderInclude }; receipt: { select: { receiptHash: true } } } }>;
type MarketplaceSavedTenderRecord = { tenderId: string; tender?: MarketplaceTenderRecord | null };
type MarketplaceVerificationProfileRecord = {
  payload: unknown;
  registrySource?: string | null;
  registryNumber?: string | null;
  status?: VerificationStatus;
  documents?: Array<{ document?: { name?: string | null; documentType?: string | null } | null }>;
};
type MarketplaceContext = { organizationId?: string; userId?: string; organizationName?: string };
type MarketplaceBidState = { hasDraftBid: boolean; hasSubmittedBid: boolean };
type TenderActivity = { marketplaceViews: number; documentDownloads: number; clarifications: number };
type MarketplaceTenderRowContext = MarketplaceContext & {
  savedTenderIds?: Set<string>;
  bidState?: MarketplaceBidState;
};

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function requireSignatureKeyphrase(value?: string) {
  if (!value) throw requestError('Digital signature keyphrase is required.', 400);
  return value;
}

function auditEventDelegate(db: PrismaClient) {
  return (db as unknown as {
    auditEvent?: {
      count?: (args: Prisma.AuditEventCountArgs) => Promise<number>;
      create?: (args: Prisma.AuditEventCreateArgs) => Promise<unknown>;
    };
  }).auditEvent;
}

function marketplaceVerificationProfileDelegate(db: PrismaClient) {
  return (db as unknown as {
    verificationProfile?: {
      findFirst?: (args: Prisma.VerificationProfileFindFirstArgs) => Promise<MarketplaceVerificationProfileRecord | null>;
    };
  }).verificationProfile;
}

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async marketplaceContextWithOrganizationName(context: MarketplaceContext): Promise<MarketplaceContext> {
    if (!context.organizationId || context.organizationName) return context;
    const organizationDelegate = (this.db as unknown as { organization?: { findUnique?: PrismaClient['organization']['findUnique'] } }).organization;
    if (!organizationDelegate?.findUnique) return context;
    const organization = await organizationDelegate.findUnique({
      where: { id: context.organizationId },
      select: { name: true }
    });
    return { ...context, organizationName: organization?.name };
  }

  async health() {
    return { ready: true };
  }

  async getWelcomeData() {
    if (this.db === prisma && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const activePublicTenderWhere = activePublicMarketplaceTenderWhere([TenderStatus.OPEN]);
    const [participantCount, openTenderCount, verifiedUserCount, featuredTenders] = await Promise.all([
      this.db.organization.count(),
      this.db.tender.count({
        where: activePublicTenderWhere
      }),
      this.db.user.count({
        where: {
          verificationStatus: VerificationStatus.APPROVED
        }
      }),
      this.db.tender.findMany({
        where: activePublicTenderWhere,
        orderBy: [{ closingDate: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 3,
        include: {
          buyerOrg: {
            select: {
              name: true
            }
          },
          categories: {
            select: {
              name: true
            },
            orderBy: {
              name: 'asc'
            }
          }
        }
      })
    ]);

    return {
      participantCount,
      openTenderCount,
      verifiedUserCount,
      featuredTenders
    };
  }

  async getMarketplaceData(context: MarketplaceContext, query: MarketplaceQuery): Promise<ProcurementMarketplacePayload> {
    const marketplaceContext = await this.marketplaceContextWithOrganizationName(context);
    const publicWhere = marketplaceWhere(query);
    const verificationProfileDelegate = marketplaceVerificationProfileDelegate(this.db);
    const [matchingTenders, invitedTenderRecords, myTenderRecords, myBidRecords, savedTenderRecords, verificationProfile] = await Promise.all([
      this.db.tender.findMany({
        where: publicWhere,
        include: marketplaceTenderInclude,
        orderBy: marketplaceOrderBy(query.sort),
        take: 1000
      }),
      marketplaceContext.organizationId
        ? this.db.tender.findMany({
            where: {
              visibility: Visibility.INVITED,
              status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] },
              closingDate: { gt: new Date() },
              NOT: { buyerOrgId: marketplaceContext.organizationId }
            },
            include: marketplaceTenderInclude,
            orderBy: marketplaceOrderBy('deadline'),
            take: 500
          })
        : Promise.resolve([]),
      marketplaceContext.organizationId
        ? this.db.tender.findMany({
            where: {
              buyerOrgId: marketplaceContext.organizationId,
              ...(query.visibility ? { visibility: query.visibility as Visibility } : {}),
              status: {
                in: [
                  TenderStatus.DRAFT,
                  TenderStatus.REVIEW,
                  TenderStatus.PUBLISHED,
                  TenderStatus.OPEN,
                  TenderStatus.CLOSED,
                  TenderStatus.EVALUATION,
                  TenderStatus.AWARDED,
                  TenderStatus.CANCELLED
                ]
              }
            },
            include: marketplaceTenderInclude,
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: 500
          })
        : Promise.resolve([]),
      marketplaceContext.organizationId
        ? this.db.bid.findMany({
            where: {
              supplierOrgId: marketplaceContext.organizationId,
              status: { not: BidStatus.WITHDRAWN }
            },
            include: {
              tender: { include: marketplaceTenderInclude },
              receipt: { select: { receiptHash: true } }
            },
            orderBy: [{ updatedAt: 'desc' }],
            take: 500
          })
        : Promise.resolve([]),
      marketplaceContext.organizationId
        ? this.db.savedTender.findMany({
            where: { organizationId: marketplaceContext.organizationId },
            select: { tenderId: true }
          })
        : Promise.resolve([]),
      marketplaceContext.organizationId && verificationProfileDelegate?.findFirst
        ? verificationProfileDelegate.findFirst({
            where: { organizationId: marketplaceContext.organizationId },
            include: {
              documents: {
                include: {
                  document: { select: { name: true, documentType: true } }
                }
              }
            },
            orderBy: { updatedAt: 'desc' }
          })
        : Promise.resolve(null)
    ]);

    const filteredTenders = filterMarketplaceTenders(matchingTenders, query);
    const sortedTenders = sortMarketplaceTenders(filteredTenders, query.sort);
    const pagedTenders = sortedTenders.slice((query.page - 1) * query.limit, query.page * query.limit);
    const pagination = marketplacePagination(sortedTenders.length, query);
    const savedTenderIds = new Set(savedTenderRecords.map((record) => record.tenderId));
    const bidStates = bidStatesByTender(myBidRecords);
    const rows = pagedTenders.map((tender) =>
      toMarketplaceTenderRow(tender, {
        ...marketplaceContext,
        savedTenderIds,
        bidState: bidStates.get(tender.id)
      })
    );
    const invitedTenders = invitedTenderRecords
      .filter((tender) => isInvitedTenderForContext(tender, marketplaceContext))
      .map((tender) =>
        toMarketplaceTenderRow(tender, {
          ...marketplaceContext,
          savedTenderIds,
          bidState: bidStates.get(tender.id)
        })
      );
    const recommendedTenders = recommendedMarketplaceTenderRows({
      publicTenders: sortedTenders,
      invitedTenders: invitedTenderRecords.filter((tender) => isInvitedTenderForContext(tender, marketplaceContext)),
      myBidRecords,
      savedTenderRecords,
      verificationProfile,
      context: marketplaceContext,
      savedTenderIds,
      bidStates
    });
    const myTenders = myTenderRecords.map((tender) => toMyTenderRow(tender, { ...marketplaceContext, savedTenderIds }));
    const myBids = myBidRecords.map((bid) =>
      toMyBidRow(bid, {
        ...marketplaceContext,
        savedTenderIds,
        bidState: bidStates.get(bid.tenderId) ?? bidStateFromStatus(bid.status)
      })
    );

    return {
      tenders: rows,
      recommendedTenders,
      invitedTenders,
      myTenders,
      myBids,
      summary: marketplaceSummary(sortedTenders, myTenders, myBids),
      pagination
    };
  }

  async getTenderDetail(tenderId: string, context: MarketplaceContext) {
    const marketplaceContext = await this.marketplaceContextWithOrganizationName(context);
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      include: tenderDetailInclude()
    });
    if (!tender || !canViewTenderDetail(tender, marketplaceContext)) return null;
    if (shouldRecordMarketplaceView(tender, marketplaceContext.organizationId)) {
      await this.recordTenderView(tender, marketplaceContext);
    }
    const [activity, clarificationInquiries] = await Promise.all([
      this.tenderActivity(tender.id),
      this.tenderClarificationInquiries(tender, marketplaceContext)
    ]);
    return toTenderDetailDto(tender, marketplaceContext, activity, clarificationInquiries);
  }

  async recordTenderDocumentDownload(tenderId: string, documentId: string, context: MarketplaceContext) {
    const marketplaceContext = await this.marketplaceContextWithOrganizationName(context);
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      include: tenderDetailInclude()
    });
    if (!tender || !canViewTenderDetail(tender, marketplaceContext)) return null;
    const belongsToTender = tender.documents.some((document) => document.document.id === documentId);
    if (!belongsToTender) return null;
    await this.createTenderAuditEvent({
      tender,
      context: marketplaceContext,
      event: tenderDocumentDownloadedEvent,
      payload: {
        viewerOrgId: marketplaceContext.organizationId ?? null,
        documentId,
        source: 'tender-detail'
      }
    });
    return {
      success: true as const,
      message: 'Document download recorded' as const
    };
  }

  async getTenderBuyerLogo(tenderId: string, context: MarketplaceContext): Promise<ProfileImageMetadata | null> {
    const marketplaceContext = await this.marketplaceContextWithOrganizationName(context);
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        status: true,
        visibility: true,
        metadata: true,
        buyerOrg: {
          select: {
            verificationProfiles: {
              select: { payload: true },
              orderBy: { updatedAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });
    if (!tender || !canViewTenderDetail(tender, marketplaceContext)) return null;
    return buyerLogoMetadata(tender.buyerOrg.verificationProfiles[0]?.payload);
  }

  async getTenderDocumentForStream(
    tenderId: string,
    documentId: string,
    context: MarketplaceContext,
    disposition: TenderDocumentStreamDto['disposition']
  ): Promise<TenderDocumentStreamDto | null> {
    const marketplaceContext = await this.marketplaceContextWithOrganizationName(context);
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        status: true,
        visibility: true,
        metadata: true,
        documents: {
          where: { documentId },
          select: {
            document: {
              select: {
                id: true,
                name: true,
                documentType: true,
                objectKey: true
              }
            }
          }
        }
      }
    });
    if (!tender || !canViewTenderDetail(tender, marketplaceContext)) return null;
    const document = tender.documents[0]?.document;
    if (!document) return null;
    if (disposition === 'attachment') {
      await this.createTenderAuditEvent({
        tender,
        context: marketplaceContext,
        event: tenderDocumentDownloadedEvent,
        payload: {
          viewerOrgId: marketplaceContext.organizationId ?? null,
          documentId,
          source: 'tender-document-stream'
        }
      });
    }
    return {
      id: document.id,
      name: document.name,
      documentType: document.documentType,
      objectKey: document.objectKey,
      disposition
    };
  }

  async listTenderAmendments(tenderId: string, context: MarketplaceContext): Promise<TenderAmendmentsResponseDto | null> {
    const marketplaceContext = await this.marketplaceContextWithOrganizationName(context);
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        status: true,
        visibility: true,
        metadata: true
      }
    });
    if (!tender || !canViewTenderDetail(tender, marketplaceContext)) return null;
    const isOwner = Boolean(marketplaceContext.organizationId && tender.buyerOrgId === marketplaceContext.organizationId);
    const amendments = await this.db.tenderAmendment.findMany({
      where: {
        tenderId,
        ...(isOwner ? {} : { status: TenderAmendmentStatus.PUBLISHED })
      },
      orderBy: [{ createdAt: 'desc' }]
    });
    return {
      success: true,
      data: amendments.map(toTenderAmendmentDto)
    };
  }

  async createTenderAmendment(tenderId: string, input: TenderAmendmentInput, context: { organizationId: string; userId: string }): Promise<TenderAmendmentResponseDto | null> {
    const tender = await this.getTenderForOwnerAction(tenderId);
    if (!tender) return null;
    if (tender.buyerOrgId !== context.organizationId) throw requestError('Only the owner organization can amend this tender.', 403);
    const amendment = await this.db.tenderAmendment.create({
      data: {
        tenderId,
        buyerOrgId: context.organizationId,
        createdByUserId: context.userId,
        reference: generateAmendmentReference(tender.reference),
        title: input.title,
        summary: input.summary || null,
        payload: input.payload as Prisma.InputJsonObject
      }
    });
    await this.createTenderAuditEvent({
      tender,
      context,
      event: amendmentCreatedEvent,
      payload: { amendmentId: amendment.id, reference: amendment.reference }
    });
    return amendmentResponse('Tender amendment created successfully', amendment);
  }

  async updateTenderAmendment(
    tenderId: string,
    amendmentId: string,
    input: TenderAmendmentPatchInput,
    context: { organizationId: string; userId: string }
  ): Promise<TenderAmendmentResponseDto | null> {
    const amendment = await this.db.tenderAmendment.findUnique({
      where: { id: amendmentId },
      include: { tender: { select: { id: true, buyerOrgId: true } } }
    });
    if (!amendment || amendment.tenderId !== tenderId) return null;
    if (amendment.buyerOrgId !== context.organizationId) throw requestError('Only the owner organization can update this amendment.', 403);
    if (amendment.status !== TenderAmendmentStatus.DRAFT) throw requestError('Only draft amendments can be updated.', 409);
    const updated = await this.db.tenderAmendment.update({
      where: { id: amendmentId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary || null } : {}),
        ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonObject } : {})
      }
    });
    await this.createTenderAuditEvent({
      tender: amendment.tender,
      context,
      event: amendmentUpdatedEvent,
      payload: { amendmentId: updated.id, reference: updated.reference }
    });
    return amendmentResponse('Tender amendment updated successfully', updated);
  }

  async publishTenderAmendment(
    tenderId: string,
    amendmentId: string,
    context: { organizationId: string; userId: string; signatureKeyphrase: string }
  ): Promise<TenderAmendmentResponseDto | null> {
    const published = await this.db.$transaction(async (tx) => {
      const amendment = await tx.tenderAmendment.findUnique({
        where: { id: amendmentId },
        include: { tender: { select: { id: true, buyerOrgId: true } } }
      });
      if (!amendment || amendment.tenderId !== tenderId) return null;
      if (amendment.buyerOrgId !== context.organizationId) throw requestError('Only the owner organization can publish this amendment.', 403);
      if (amendment.status !== TenderAmendmentStatus.DRAFT) throw requestError('Only draft amendments can be published.', 409);
      const result = await tx.tenderAmendment.update({
        where: { id: amendmentId },
        data: {
          status: TenderAmendmentStatus.PUBLISHED,
          publishedAt: new Date()
        }
      });
      await signSensitiveAction(tx, {
        userId: context.userId,
        organizationId: context.organizationId,
        signatureKeyphrase: requireSignatureKeyphrase(context.signatureKeyphrase),
        moduleKey: 'procurement',
        actionKey: 'tender_amendment.publish',
        entityType: 'tender_amendment',
        entityRef: result.id,
        payload: {
          tenderId,
          amendmentId: result.id,
          reference: result.reference,
          status: result.status,
          publishedAt: result.publishedAt?.toISOString() ?? null
        }
      });
      await this.createTenderAuditEvent({
        tender: amendment.tender,
        context,
        event: amendmentPublishedEvent,
        payload: { amendmentId: result.id, reference: result.reference }
      });
      return result;
    });
    return published ? amendmentResponse('Tender amendment published successfully', published) : null;
  }

  async cancelTenderAmendment(tenderId: string, amendmentId: string, context: { organizationId: string; userId: string }): Promise<TenderAmendmentResponseDto | null> {
    const amendment = await this.db.tenderAmendment.findUnique({
      where: { id: amendmentId },
      include: { tender: { select: { id: true, buyerOrgId: true } } }
    });
    if (!amendment || amendment.tenderId !== tenderId) return null;
    if (amendment.buyerOrgId !== context.organizationId) throw requestError('Only the owner organization can cancel this amendment.', 403);
    if (amendment.status === TenderAmendmentStatus.CANCELLED) return amendmentResponse('Tender amendment cancelled successfully', amendment);
    const cancelled = await this.db.tenderAmendment.update({
      where: { id: amendmentId },
      data: {
        status: TenderAmendmentStatus.CANCELLED
      }
    });
    await this.createTenderAuditEvent({
      tender: amendment.tender,
      context,
      event: amendmentCancelledEvent,
      payload: { amendmentId: cancelled.id, reference: cancelled.reference }
    });
    return amendmentResponse('Tender amendment cancelled successfully', cancelled);
  }

  async getTenderForEvaluationOpen(tenderId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true
      }
    });
  }

  private getTenderForOwnerAction(tenderId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        reference: true,
        buyerOrgId: true,
        status: true,
        visibility: true
      }
    });
  }

  async getTenderForPublication(tenderId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        title: true,
        type: true,
        method: true,
        description: true,
        budget: true,
        status: true,
        location: true,
        closingDate: true,
        reference: true,
        visibility: true,
        publishedAt: true,
        requirements: true,
        metadata: true,
        categories: { select: { name: true }, orderBy: { name: 'asc' } }
      }
    });
  }

  private async tenderActivity(tenderId: string): Promise<TenderActivity> {
    const auditEvent = auditEventDelegate(this.db);
    if (!auditEvent?.count) return emptyTenderActivity();
    const [marketplaceViews, documentDownloads] = await Promise.all([
      auditEvent.count({
        where: {
          event: tenderViewedEvent,
          entityType: 'tender',
          entityRef: tenderId
        }
      }),
      auditEvent.count({
        where: {
          event: tenderDocumentDownloadedEvent,
          entityType: 'tender',
          entityRef: tenderId
        }
      })
    ]);
    return {
      marketplaceViews,
      documentDownloads,
      clarifications: 0
    };
  }

  private async recordTenderView(tender: TenderDetailRecord, context: MarketplaceContext) {
    await this.createTenderAuditEvent({
      tender,
      context,
      event: tenderViewedEvent,
      payload: {
        viewerOrgId: context.organizationId ?? null,
        source: 'supplier-tender-detail'
      }
    });
  }

  private async createTenderAuditEvent(input: {
    tender: Pick<TenderDetailRecord, 'id' | 'buyerOrgId'>;
    context: MarketplaceContext;
    event: string;
    payload: Record<string, unknown>;
  }) {
    const auditEvent = auditEventDelegate(this.db);
    if (!auditEvent?.create) return;
    await auditEvent.create({
      data: {
        ownerOrgId: input.tender.buyerOrgId,
        actorUserId: input.context.userId ?? null,
        event: input.event,
        entityType: 'tender',
        entityRef: input.tender.id,
        payload: input.payload as Prisma.InputJsonObject
      }
    });
  }

  async getTenderForUpdate(tenderId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        status: true,
        type: true,
        metadata: true
      }
    });
  }

  async getTenderForClose(tenderId: string) {
    return this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        status: true
      }
    });
  }

  async createTender(input: CreateTenderInput, context: { organizationId: string; userId: string }): Promise<CreateTenderResponseDto> {
    const categories = normalizeCategoryInputs(input.categories);
    const providedReference = input.reference?.trim();
    let attempt = 0;

    while (attempt < 4) {
      const reference = providedReference || generateTenderReference(input.type);
      try {
        const tender = await this.db.$transaction(async (tx) => {
          const savedTender = await tx.tender.create({
            data: {
              reference,
              buyerOrgId: context.organizationId,
              ownerUserId: context.userId,
              title: input.title,
              description: input.description,
              type: input.type,
              status: TenderStatus.DRAFT,
              method: tenderMethodFromMetadata(input.metadata) ?? ProcurementMethod.OPEN_TENDER,
              visibility: Visibility.PRIVATE,
              budget: input.budget ?? null,
              currency: input.currency,
              location: input.location,
              closingDate: input.closingDate ? tenderDateInput(input.closingDate) : null,
              requirements: input.requirements as Prisma.InputJsonObject,
              metadata: input.metadata as Prisma.InputJsonObject
            }
          });

          if (categories.length > 0) {
            await tx.tenderCategory.createMany({
              data: categories.map((name) => ({ tenderId: savedTender.id, name })),
              skipDuplicates: true
            });
          }

          await replaceTenderDesignRows(tx, savedTender.id, input);

          return savedTender;
        });

        return toCreateTenderResponseDto(tender);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          if (!providedReference && attempt < 3) {
            attempt += 1;
            continue;
          }
          throw requestError('Tender reference already exists.', 409);
        }
        throw error;
      }
    }

    throw requestError('Tender reference could not be generated.', 500);
  }

  async updateTender(
    tenderId: string,
    input: UpdateTenderInput,
    context: { organizationId: string; userId: string }
  ): Promise<UpdateTenderResponseDto | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          buyerOrgId: true,
          status: true
        }
      });
      if (!existing) return null;
      if (existing.buyerOrgId !== context.organizationId) {
        throw requestError('Only the owner organization can update this tender.', 403);
      }
      if (!isEditableTenderStatus(existing.status)) {
        throw requestError('Only draft or review tenders can be updated.', 409);
      }

      if (input.categories !== undefined) {
        await tx.tenderCategory.deleteMany({ where: { tenderId } });
        const categories = normalizeCategoryInputs(input.categories);
        if (categories.length > 0) {
          await tx.tenderCategory.createMany({
            data: categories.map((name) => ({ tenderId, name })),
            skipDuplicates: true
          });
        }
      }

      if (input.requirementRows !== undefined || input.commercialItems !== undefined) {
        await replaceTenderDesignRows(tx, tenderId, input);
      }

      const tender = await tx.tender.update({
        where: { id: tenderId },
        data: tenderUpdateInput(input),
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          updatedAt: true
        }
      });
      return toUpdateTenderResponseDto(tender);
    });
  }

  async deleteTenderDraft(tenderId: string, context: { organizationId: string; userId: string }): Promise<DeleteTenderDraftResponseDto | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          reference: true,
          title: true,
          buyerOrgId: true,
          status: true
        }
      });
      if (!existing) return null;
      if (existing.buyerOrgId !== context.organizationId) {
        throw requestError('Only the owner organization can delete this tender draft.', 403);
      }
      if (existing.status !== TenderStatus.DRAFT) {
        throw requestError('Only draft tenders can be deleted.', 409);
      }

      await tx.tender.delete({ where: { id: tenderId } });

      return {
        success: true,
        message: 'Tender draft deleted successfully',
        data: {
          id: existing.id,
          reference: existing.reference,
          title: existing.title
        }
      };
    });
  }

  async updateTenderBuyerNotice(
    tenderId: string,
    input: UpdateBuyerNoticeInput,
    context: { organizationId: string; userId: string }
  ): Promise<UpdateBuyerNoticeResponseDto | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          buyerOrgId: true,
          status: true,
          metadata: true
        }
      });
      if (!existing) return null;
      if (existing.buyerOrgId !== context.organizationId) {
        throw requestError('Only the owner organization can update this tender.', 403);
      }
      if (!isBuyerNoticeEditableStatus(existing.status)) {
        throw requestError('Buyer notice cannot be updated for this tender.', 409);
      }

      const buyerNotice = input.buyerNotice.trim();
      const metadata = {
        ...objectPayload(existing.metadata),
        buyerNotice,
        buyerNoticeUpdatedAt: new Date().toISOString(),
        buyerNoticeUpdatedByUserId: context.userId
      };
      const tender = await tx.tender.update({
        where: { id: tenderId },
        data: { metadata: metadata as Prisma.InputJsonObject },
        select: {
          id: true,
          updatedAt: true
        }
      });
      return toUpdateBuyerNoticeResponseDto(tender, buyerNotice);
    });
  }

  async submitTenderForReview(
    tenderId: string,
    organizationId: string,
    context: { userId: string; signatureKeyphrase: string }
  ): Promise<PublishTenderResponseDto | null> {
    const submittedAt = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      const existing = await tx.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          buyerOrgId: true,
          status: true,
          metadata: true
        }
      });
      if (!existing) return null;
      if (existing.buyerOrgId !== organizationId) throw requestError('Only the owner organization can submit this tender for review.', 403);
      if (!isEditableTenderStatus(existing.status)) throw requestError('Only draft or review tenders can be submitted for review.', 409);

      await tx.tender.update({
        where: { id: tenderId },
        data: {
          status: TenderStatus.REVIEW,
          visibility: Visibility.PRIVATE,
          publishedAt: null,
          metadata: pendingReviewMetadata(existing.metadata, {
            submittedAt,
            submittedByUserId: context.userId
          }) as Prisma.InputJsonObject
        }
      });
      await signSensitiveAction(tx, {
        userId: context.userId,
        organizationId,
        signatureKeyphrase: requireSignatureKeyphrase(context.signatureKeyphrase),
        moduleKey: 'procurement',
        actionKey: 'tender.publish_submit',
        entityType: 'tender',
        entityRef: tenderId,
        payload: {
          tenderId,
          previousStatus: existing.status,
          nextStatus: TenderStatus.REVIEW,
          submittedAt: submittedAt.toISOString()
        }
      });

      return tx.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          visibility: true,
          publishedAt: true,
          closingDate: true
        }
      });
    });

    return updated ? toPublishTenderResponseDto(updated, 'Tender submitted for admin review') : null;
  }

  async listTenderReviews(query: TenderReviewQuery): Promise<TenderReviewListDto> {
    const where = tenderReviewWhere(query);
    const [items, total] = await Promise.all([
      this.db.tender.findMany({
        where,
        include: tenderReviewQueueInclude,
        orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.db.tender.count({ where })
    ]);

    return {
      success: true,
      items: items.map(toTenderReviewQueueItemDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      generatedAt: new Date().toISOString()
    };
  }

  private async tenderClarificationInquiries(
    tender: Pick<TenderDetailRecord, 'id' | 'buyerOrgId'>,
    context: MarketplaceContext
  ): Promise<TenderClarificationInquiryRecord[]> {
    if (!context.organizationId || context.organizationId !== tender.buyerOrgId) return [];
    const communicationDelegate = (this.db as unknown as {
      communicationItem?: {
        findMany?: (args: Prisma.CommunicationItemFindManyArgs) => Promise<TenderClarificationInquiryRecord[]>;
      };
    }).communicationItem;
    if (!communicationDelegate?.findMany) return [];

    const inquiries = await communicationDelegate.findMany({
      where: {
        tenderId: tender.id,
        ownerOrgId: context.organizationId,
        recipientOrgId: context.organizationId,
        senderOrgId: { not: context.organizationId },
        folder: 'inbox',
        kind: CommunicationKind.CLARIFICATION,
        status: { not: CommunicationStatus.DELETED }
      },
      include: tenderClarificationInquiryInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: 50
    });

    return inquiries.filter((inquiry) => isOriginalIncomingTenderClarificationInquiry(inquiry, tender.buyerOrgId)).slice(0, 20);
  }

  async getTenderReview(tenderId: string): Promise<TenderReviewDetailDto | null> {
    const tender = await this.db.tender.findFirst({
      where: {
        id: tenderId,
        status: TenderStatus.REVIEW
      },
      include: tenderReviewDetailInclude()
    });
    if (!tender) return null;
    return toTenderReviewDetailDto(tender, await this.tenderActivity(tender.id));
  }

  async publishTender(tenderId: string, organizationId: string, visibility: Visibility): Promise<PublishTenderResponseDto | null> {
    const publishedAt = new Date();
    const update = await this.db.tender.updateMany({
      where: {
        id: tenderId,
        buyerOrgId: organizationId,
        status: { in: [TenderStatus.DRAFT, TenderStatus.REVIEW] }
      },
      data: {
        status: TenderStatus.OPEN,
        visibility,
        publishedAt
      }
    });
    if (update.count === 0) return null;

    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        visibility: true,
        publishedAt: true,
        closingDate: true
      }
    });
    return tender ? toPublishTenderResponseDto(tender) : null;
  }

  async resolvePlatformOrganizationId(preferredOrgId?: string): Promise<string> {
    const preferred = preferredOrgId
      ? await this.db.organization.findUnique({
          where: { id: preferredOrgId },
          select: { id: true, kind: true }
        })
      : null;
    if (preferred?.kind === OrganizationKind.PLATFORM) return preferred.id;

    const platform = await this.db.organization.findFirst({
      where: { kind: OrganizationKind.PLATFORM },
      select: { id: true },
      orderBy: { createdAt: 'asc' }
    });
    if (platform) return platform.id;
    if (preferred) return preferred.id;
    throw requestError('A platform organization is required for tender review communication.', 409);
  }

  async passTenderReview(
    tenderId: string,
    context: { adminOrgId: string; adminUserId: string; signatureKeyphrase: string },
    visibility: Visibility
  ): Promise<TenderReviewDecisionResponseDto | null> {
    const decidedAt = new Date();
    const result = await this.db.$transaction(async (tx) => {
      const existing = await tx.tender.findFirst({
        where: {
          id: tenderId,
          status: TenderStatus.REVIEW
        },
        include: tenderReviewDetailInclude()
      });
      if (!existing) return null;

      const updatedCount = await tx.tender.updateMany({
        where: {
          id: tenderId,
          status: TenderStatus.REVIEW
        },
        data: {
          status: TenderStatus.OPEN,
          visibility,
          publishedAt: decidedAt,
          metadata: passedReviewMetadata(existing.metadata, {
            decidedAt,
            adminUserId: context.adminUserId
          }) as Prisma.InputJsonObject
        }
      });
      if (updatedCount.count === 0) return null;

      const tender = await tx.tender.findUniqueOrThrow({
        where: { id: tenderId },
        include: tenderReviewDetailInclude()
      });
      await signSensitiveAction(tx, {
        userId: context.adminUserId,
        organizationId: context.adminOrgId,
        signatureKeyphrase: requireSignatureKeyphrase(context.signatureKeyphrase),
        moduleKey: 'procurement',
        actionKey: 'tender.publish_approve',
        entityType: 'tender',
        entityRef: tender.id,
        payload: {
          tenderId: tender.id,
          reference: tender.reference,
          visibility,
          publishedAt: decidedAt.toISOString(),
          previousStatus: TenderStatus.REVIEW,
          nextStatus: TenderStatus.OPEN
        }
      });
      const messageId = await createTenderReviewPassMessage(tx, tender, context.adminOrgId, decidedAt);
      return { tender, messageId };
    });

    return result
      ? toTenderReviewDecisionResponseDto('Tender review passed. The tender is now published to the marketplace.', result.tender, result.messageId, {
          marketplaceRoute: viewTenderRoute(result.tender.id)
        })
      : null;
  }

  async failTenderReview(
    tenderId: string,
    context: { adminUserId: string },
    input: TenderReviewFailInput
  ): Promise<TenderReviewDecisionResponseDto | null> {
    const decidedAt = new Date();
    const result = await this.db.$transaction(async (tx) => {
      const existing = await tx.tender.findFirst({
        where: {
          id: tenderId,
          status: TenderStatus.REVIEW
        },
        select: {
          id: true,
          reference: true,
          title: true,
          buyerOrgId: true,
          status: true,
          visibility: true,
          publishedAt: true,
          metadata: true
        }
      });
      if (!existing) return null;

      const message = await tx.communicationItem.findUnique({
        where: { id: input.messageId },
        select: {
          id: true,
          tenderId: true,
          ownerOrgId: true,
          recipientOrgId: true
        }
      });
      if (!message || message.tenderId !== tenderId || (message.ownerOrgId !== existing.buyerOrgId && message.recipientOrgId !== existing.buyerOrgId)) {
        throw requestError('A review failure message must be sent to the tender owner before removing this tender from review.', 409);
      }

      const updatedCount = await tx.tender.updateMany({
        where: {
          id: tenderId,
          status: TenderStatus.REVIEW
        },
        data: {
          status: TenderStatus.DRAFT,
          visibility: Visibility.PRIVATE,
          publishedAt: null,
          metadata: failedReviewMetadata(existing.metadata, {
            decidedAt,
            adminUserId: context.adminUserId,
            messageId: message.id
          }) as Prisma.InputJsonObject
        }
      });
      if (updatedCount.count === 0) return null;

      const tender = await tx.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          visibility: true,
          publishedAt: true
        }
      });
      return { tender, messageId: message.id };
    });

    return result
      ? toTenderReviewDecisionResponseDto('Tender review failed. The tender has been returned to draft for amendments.', result.tender, result.messageId, {
          amendmentRoute: amendTenderRoute(result.tender.id)
        })
      : null;
  }

  async recordTenderLanguageScan(tenderId: string, scan: TenderLanguageScanDto) {
    await this.db.riskSignal.create({
      data: {
        tenderId,
        riskLevel: riskLevelFromScan(scan),
        score: scan.score,
        driver: 'tender_language_scan',
        payload: {
          source: 'publish',
          scannerVersion: tenderLanguageScannerVersion,
          riskLevel: scan.riskLevel,
          issues: scan.issues
        } as Prisma.InputJsonObject
      }
    });
  }

  async applyTenderCategoryStandardization(tenderId: string, categories: string[], metadata: Record<string, unknown>) {
    await this.db.$transaction(async (tx) => {
      await tx.tenderCategory.deleteMany({ where: { tenderId } });
      const normalizedCategories = normalizeCategoryInputs(categories);
      if (normalizedCategories.length > 0) {
        await tx.tenderCategory.createMany({
          data: normalizedCategories.map((name) => ({ tenderId, name })),
          skipDuplicates: true
        });
      }
      await tx.tender.update({
        where: { id: tenderId },
        data: {
          metadata: metadata as Prisma.InputJsonObject
        }
      });
    });
  }

  async closeTender(tenderId: string, organizationId: string): Promise<CloseTenderResponseDto | null> {
    const update = await this.db.tender.updateMany({
      where: {
        id: tenderId,
        buyerOrgId: organizationId,
        status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] }
      },
      data: {
        status: TenderStatus.CLOSED
      }
    });
    if (update.count === 0) return null;

    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        closingDate: true,
        updatedAt: true
      }
    });
    return tender ? toCloseTenderResponseDto(tender) : null;
  }

  async saveTender(tenderId: string, context: { organizationId: string; userId: string }): Promise<SaveTenderResponseDto> {
    const tender = await this.db.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        buyerOrgId: true,
        status: true,
        visibility: true
      }
    });
    if (!tender) throw requestError('Tender was not found.', 404);
    if (tender.buyerOrgId === context.organizationId) throw requestError('You cannot save your own tender.', 409);
    if (!isPublicOpenTender(tender)) throw requestError('Only public open tenders can be saved.', 409);

    try {
      await this.db.savedTender.create({
        data: {
          tenderId,
          organizationId: context.organizationId,
          userId: context.userId
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    return savedTenderResponse();
  }

  async unsaveTender(tenderId: string, organizationId: string): Promise<UnsaveTenderResponseDto> {
    await this.db.savedTender.deleteMany({
      where: {
        tenderId,
        organizationId
      }
    });
    return unsaveTenderResponse();
  }

  async getSavedTenders(organizationId: string): Promise<SavedTendersPayload> {
    const savedTenders = await this.db.savedTender.findMany({
      where: {
        organizationId,
        tender: {
          visibility: Visibility.PUBLIC_MARKETPLACE
        }
      },
      include: {
        tender: { include: marketplaceTenderInclude }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    const savedTenderIds = new Set(savedTenders.map((record) => record.tenderId));
    return {
      tenders: savedTenders.map((record) => toMarketplaceTenderRow(record.tender, { organizationId, savedTenderIds }))
    };
  }

  async listPlans(query: ProcurementPlanningQuery) {
    const where = planWhere(query);
    const [plans, totalPlans, allMatchingPlans, years] = await Promise.all([
      this.db.procurementPlan.findMany({
        where,
        include: planInclude,
        orderBy: planOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.db.procurementPlan.count({ where }),
      this.db.procurementPlan.findMany({
        where,
        include: planInclude,
        orderBy: planOrderBy(query),
        take: 2000
      }),
      this.db.procurementPlan.findMany({
        where: query.organizationId ? { ownerOrgId: query.organizationId } : {},
        select: { financialYear: true },
        distinct: ['financialYear'],
        orderBy: { financialYear: 'desc' }
      })
    ]);

    return {
      plans: plans.map(toPlanDto),
      records: sortPlanLines(plans.flatMap((plan) => toFilteredLineDtos(plan, query)), query),
      summary: buildSummary(allMatchingPlans, query, years.map((item) => item.financialYear)),
      totalPlans,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(totalPlans / query.pageSize))
    };
  }

  async getPlan(planId: string) {
    const plan = await this.db.procurementPlan.findUnique({
      where: { id: planId },
      include: planInclude
    });

    return plan ? toPlanDto(plan) : null;
  }

  async saveAnnualPlan(input: SaveAnnualPlanInput) {
    const ownerOrgId = await this.resolveOwnerOrgId(input.ownerOrgId);
    const name = input.name || `${input.financialYear} annual procurement plan`;

    const plan = await this.db.$transaction(async (tx) => {
      const savedPlan = await tx.procurementPlan.upsert({
        where: {
          ownerOrgId_financialYear_name: {
            ownerOrgId,
            financialYear: input.financialYear,
            name
          }
        },
        update: {
          status: input.status,
          source: input.source,
          currency: input.currency,
          metadata: input.metadata as Prisma.InputJsonObject
        },
        create: {
          ownerOrgId,
          financialYear: input.financialYear,
          name,
          status: input.status,
          source: input.source,
          currency: input.currency,
          metadata: input.metadata as Prisma.InputJsonObject
        }
      });

      await tx.procurementPlanLine.deleteMany({ where: { planId: savedPlan.id } });

      if (input.lines.length > 0) {
        await tx.procurementPlanLine.createMany({
          data: input.lines.map((line) => lineCreateInput(savedPlan.id, line))
        });
      }

      return tx.procurementPlan.findUniqueOrThrow({
        where: { id: savedPlan.id },
        include: planInclude
      });
    });

    return toPlanDto(plan);
  }

  async updatePlan(planId: string, input: UpdateProcurementPlanInput) {
    const existing = await this.db.procurementPlan.findUnique({ where: { id: planId } });
    if (!existing) return null;

    const plan = await this.db.$transaction(async (tx) => {
      await tx.procurementPlan.update({
        where: { id: planId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonObject } : {})
        }
      });

      if (input.lines) {
        await tx.procurementPlanLine.deleteMany({ where: { planId } });
        await tx.procurementPlanLine.createMany({
          data: input.lines.map((line) => lineCreateInput(planId, line))
        });
      }

      return tx.procurementPlan.findUniqueOrThrow({
        where: { id: planId },
        include: planInclude
      });
    });

    return toPlanDto(plan);
  }

  async createPlanLine(planId: string, input: ProcurementPlanLineInput) {
    const plan = await this.db.procurementPlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return null;

    const line = await this.db.procurementPlanLine.create({
      data: lineCreateInput(planId, input),
      include: { plan: true }
    });

    return toLineDto({
      ...line,
      tender: null
    });
  }

  async updatePlanLine(lineId: string, input: ProcurementPlanLinePatchInput) {
    const existing = await this.db.procurementPlanLine.findUnique({ where: { id: lineId } });
    if (!existing) return null;

    const line = await this.db.procurementPlanLine.update({
      where: { id: lineId },
      data: lineUpdateInput(input),
      include: { plan: true, tender: { select: { id: true } } }
    });

    return toLineDto(line);
  }

  async deletePlanLine(lineId: string) {
    const existing = await this.db.procurementPlanLine.findUnique({
      where: { id: lineId },
      include: { plan: true, tender: { select: { id: true } } }
    });
    if (!existing) return null;

    await this.db.procurementPlanLine.delete({ where: { id: lineId } });
    return toLineDto(existing);
  }

  private async resolveOwnerOrgId(ownerOrgId?: string) {
    if (ownerOrgId) {
      const organization = await this.db.organization.findUnique({ where: { id: ownerOrgId }, select: { id: true } });
      if (!organization) throw new Error('Procurement planning owner organization was not found.');
      return organization.id;
    }

    const organization =
      (await this.db.organization.findFirst({
        where: { kind: OrganizationKind.COMPANY },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      })) ??
      (await this.db.organization.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      }));

    if (!organization) throw new Error('Create an organization before saving procurement plans.');
    return organization.id;
  }
}

function planWhere(query: ProcurementPlanningQuery): Prisma.ProcurementPlanWhereInput {
  return andPlanWhere([
    query.organizationId ? { ownerOrgId: query.organizationId } : {},
    query.financialYear ? { financialYear: query.financialYear } : {},
    query.status ? { lines: { some: { status: { contains: query.status, mode: 'insensitive' } } } } : {},
    query.category ? { lines: { some: { category: { contains: query.category, mode: 'insensitive' } } } } : {},
    query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { financialYear: { contains: query.search, mode: 'insensitive' } },
            { ownerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
            { lines: { some: { tenderTitle: { contains: query.search, mode: 'insensitive' } } } },
            { lines: { some: { category: { contains: query.search, mode: 'insensitive' } } } },
            { lines: { some: { procurementMethod: { contains: query.search, mode: 'insensitive' } } } }
          ]
        }
      : {}
  ]);
}

function planOrderBy(query: ProcurementPlanningQuery): Prisma.ProcurementPlanOrderByWithRelationInput[] {
  const direction = query.sortDirection;
  if (query.sortBy === 'title') return [{ name: direction }, { updatedAt: 'desc' }];
  if (query.sortBy === 'status') return [{ status: direction }, { updatedAt: 'desc' }];
  return [{ updatedAt: direction }];
}

function andPlanWhere(filters: Prisma.ProcurementPlanWhereInput[]): Prisma.ProcurementPlanWhereInput {
  const active = filters.filter((filter) => Object.keys(filter).length > 0);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0];
  return { AND: active };
}

function toPlanDto(plan: ProcurementPlanRecord) {
  const lines = plan.lines.map((line) => toLineDto({ ...line, plan }));

  return {
    id: plan.id,
    ownerOrgId: plan.ownerOrgId,
    ownerName: plan.ownerOrg.name,
    financialYear: plan.financialYear,
    name: plan.name,
    status: plan.status,
    source: plan.source,
    currency: plan.currency,
    lineCount: plan.lines.length,
    totalBudget: lines.reduce((sum, line) => sum + line.budget, 0),
    metadata: objectPayload(plan.metadata),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    lines
  };
}

function toFilteredLineDtos(plan: ProcurementPlanRecord, query: ProcurementPlanningQuery) {
  return plan.lines
    .filter((line) => {
      if (query.status && !line.status.toLowerCase().includes(query.status.toLowerCase())) return false;
      if (query.category && !line.category.toLowerCase().includes(query.category.toLowerCase())) return false;
      if (!query.search) return true;
      const haystack = [
        line.tenderTitle,
        line.category,
        line.procurementMethod,
        line.sourceOfFunds,
        line.status,
        line.planState,
        line.notes,
        plan.name,
        plan.ownerOrg.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query.search.toLowerCase());
    })
    .map((line) => toLineDto({ ...line, plan }));
}

type LineWithPlan = Prisma.ProcurementPlanLineGetPayload<{
  include: { plan: true; tender: { select: { id: true } } };
}>;

function toLineDto(line: LineWithPlan) {
  return {
    id: line.id,
    planId: line.planId,
    tenderId: line.tenderId,
    financialYear: line.plan.financialYear,
    tenderTitle: line.tenderTitle,
    openingDate: dateOnly(line.openingDate),
    closingDate: dateOnly(line.closingDate),
    category: line.category,
    budget: decimalToNumber(line.budget),
    procurementMethod: line.procurementMethod,
    sourceOfFunds: line.sourceOfFunds,
    expectedCompletionDate: dateOnly(line.expectedCompletionDate),
    status: line.status,
    planState: line.planState,
    notes: line.notes ?? '',
    customValues: stringRecord(line.customValues),
    metadata: objectPayload(line.metadata),
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString()
  };
}

function marketplaceWhere(query: MarketplaceQuery): Prisma.TenderWhereInput {
  const statusFilter = statusFilterValues(query.status);
  const typeFilter = typeFilterValues(query.type);
  const allowedStatuses = marketplaceStatusValues(query.includeClosed);
  const statuses = statusFilter.length > 0 ? intersectTenderStatuses(statusFilter, allowedStatuses) : allowedStatuses;
  const activeFilters: Prisma.TenderWhereInput[] = [
    activePublicMarketplaceTenderWhere(statuses)
  ];

  if (query.search) {
    const categoryTerms = marketplaceCategorySearchTerms(query.search, typeFilter[0]);
    activeFilters.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { categories: { some: { name: { contains: query.search, mode: 'insensitive' } } } },
        ...categoryTerms.map((term) => ({ categories: { some: { name: { contains: term, mode: 'insensitive' as const } } } }))
      ]
    });
  }

  if (query.category) {
    const categoryTerms = marketplaceCategorySearchTerms(query.category, typeFilter[0]);
    activeFilters.push({
      OR: [
        { categories: { some: { name: { contains: query.category, mode: 'insensitive' } } } },
        ...categoryTerms.map((term) => ({ categories: { some: { name: { contains: term, mode: 'insensitive' as const } } } }))
      ]
    });
  }

  if (typeFilter.length > 0) activeFilters.push({ type: { in: typeFilter } });

  if (query.budgetBand === 'under-hundred-million') {
    activeFilters.push({ budget: { lt: 100000000 } });
  } else if (query.budgetBand === 'hundred-million-plus') {
    activeFilters.push({ budget: { gte: 100000000, lt: 1000000000 } });
  } else if (query.budgetBand === 'billion-plus') {
    activeFilters.push({ budget: { gte: 1000000000 } });
  }

  return activeFilters.length === 1 ? activeFilters[0] : { AND: activeFilters };
}

function activePublicMarketplaceTenderWhere(statuses: TenderStatus[]): Prisma.TenderWhereInput {
  return {
    visibility: Visibility.PUBLIC_MARKETPLACE,
    status: { in: statuses },
    closingDate: { gt: new Date() }
  };
}

function tenderReviewWhere(query: TenderReviewQuery): Prisma.TenderWhereInput {
  const filters: Prisma.TenderWhereInput[] = [{ status: TenderStatus.REVIEW }];
  if (query.search) {
    filters.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { categories: { some: { name: { contains: query.search, mode: 'insensitive' } } } }
      ]
    });
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function marketplaceStatusValues(includeClosed: boolean) {
  return includeClosed ? [TenderStatus.OPEN, TenderStatus.PUBLISHED, TenderStatus.CLOSED] : [TenderStatus.OPEN, TenderStatus.PUBLISHED];
}

function intersectTenderStatuses(left: TenderStatus[], right: TenderStatus[]) {
  const allowed = new Set(right);
  return left.filter((status) => allowed.has(status));
}

function filterMarketplaceTenders(tenders: MarketplaceTenderRecord[], query: MarketplaceQuery) {
  return tenders.filter(
    (tender) =>
      hasActiveMarketplaceDeadline(tender) &&
      matchesMarketplaceSearch(tender, query.search) &&
      matchesMarketplaceCategory(tender, query.category)
  );
}

function hasActiveMarketplaceDeadline(tender: { closingDate: Date | null }) {
  return Boolean(tender.closingDate && tender.closingDate.getTime() > Date.now());
}

function matchesMarketplaceSearch(tender: MarketplaceTenderRecord, search: string) {
  if (!search) return true;
  return marketplaceTextValues(tender).some((value) => containsSearch(value, search));
}

function matchesMarketplaceCategory(tender: MarketplaceTenderRecord, category: string) {
  if (!category) return true;
  const terms = marketplaceCategorySearchTerms(category, tender.type);
  const categoryValues = marketplaceCategoryValues(tender);
  return [category, ...terms].some((term) => categoryValues.some((value) => containsSearch(value, term)));
}

function marketplaceTextValues(tender: MarketplaceTenderRecord) {
  return [
    tender.title,
    tender.description,
    tender.reference,
    tender.buyerOrg.name,
    tender.location,
    ...marketplaceCategoryValues(tender),
    ...tenderPayloadSignalValues(tender.requirements),
    ...tenderPayloadSignalValues(tender.metadata)
  ];
}

function marketplaceCategoryValues(tender: MarketplaceTenderRecord) {
  return tender.categories.flatMap((category) => [category.name, standardizeCategoryName(category.name, tender.type)]);
}

function marketplaceCategorySearchTerms(value: string, type?: TenderType) {
  const terms = [value, standardizeCategoryName(value, type), ...categorySearchTerms(value)];
  return uniqueCategoryNames(terms.filter(Boolean));
}

function containsSearch(value: unknown, search: string) {
  return normalizeSearchText(value).includes(normalizeSearchText(search));
}

function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function marketplaceOrderBy(sort: MarketplaceQuery['sort']): Prisma.TenderOrderByWithRelationInput[] {
  if (sort === 'budget-desc') return [{ budget: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];
  if (sort === 'budget-asc') return [{ budget: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];
  if (sort === 'newest') return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  return [{ closingDate: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];
}

function sortMarketplaceTenders(tenders: MarketplaceTenderRecord[], sort: MarketplaceQuery['sort']) {
  return [...tenders].sort((left, right) => {
    if (sort === 'budget-desc') return decimalToNumber(right.budget) - decimalToNumber(left.budget) || newestTime(right) - newestTime(left);
    if (sort === 'budget-asc') return decimalToNumber(left.budget) - decimalToNumber(right.budget) || newestTime(right) - newestTime(left);
    if (sort === 'newest') return newestTime(right) - newestTime(left);
    return deadlineTime(left) - deadlineTime(right) || newestTime(right) - newestTime(left);
  });
}

function recommendedMarketplaceTenderRows({
  publicTenders,
  invitedTenders,
  myBidRecords,
  savedTenderRecords,
  verificationProfile,
  context,
  savedTenderIds,
  bidStates
}: {
  publicTenders: MarketplaceTenderRecord[];
  invitedTenders: MarketplaceTenderRecord[];
  myBidRecords: MarketplaceBidRecord[];
  savedTenderRecords: MarketplaceSavedTenderRecord[];
  verificationProfile: MarketplaceVerificationProfileRecord | null;
  context: MarketplaceContext;
  savedTenderIds: Set<string>;
  bidStates: Map<string, MarketplaceBidState>;
}) {
  const candidateMap = new Map<string, MarketplaceTenderRecord>();
  for (const tender of [...publicTenders, ...invitedTenders]) {
    if (!context.organizationId || tender.buyerOrgId !== context.organizationId) candidateMap.set(tender.id, tender);
  }

  const invitedTenderIds = new Set(invitedTenders.map((tender) => tender.id));
  const weightedTerms = new Map<string, number>();
  const typeWeights = new Map<TenderType, number>();
  const locationWeights = new Map<string, number>();

  for (const bid of myBidRecords) {
    const weight = bid.status === BidStatus.AWARDED ? 14 : bid.status === BidStatus.DRAFT ? 5 : 8;
    addTenderRecommendationSignal(bid.tender, weight, weightedTerms, typeWeights, locationWeights);
    if (bid.status === BidStatus.AWARDED) addTenderRecommendationSignal(bid.tender, 8, weightedTerms, typeWeights, locationWeights);
  }

  for (const savedTender of savedTenderRecords) {
    const tender = savedTender.tender ?? candidateMap.get(savedTender.tenderId);
    if (tender) addTenderRecommendationSignal(tender, 7, weightedTerms, typeWeights, locationWeights);
  }

  for (const invitedTender of invitedTenders) {
    addTenderRecommendationSignal(invitedTender, 9, weightedTerms, typeWeights, locationWeights);
  }

  addProfileRecommendationSignal(verificationProfile, weightedTerms, locationWeights);

  const scored = [...candidateMap.values()]
    .map((tender) => {
      const recommendationContext = {
        weightedTerms,
        typeWeights,
        locationWeights,
        invitedTenderIds,
        savedTenderIds,
        bidState: bidStates.get(tender.id)
      };
      const matchScore = marketplaceRecommendationMatchScore(tender, recommendationContext);
      const locationBoost = matchScore > 0 ? marketplaceRecommendationLocationBoost(tender, recommendationContext.locationWeights) : 0;
      return {
        tender,
        matchScore,
        score: matchScore + locationBoost + (recommendationContext.typeWeights.get(tender.type) ?? 0) * 2
      };
    })
    .filter((entry) => entry.matchScore > 0);

  const ranked = scored.sort((left, right) => right.score - left.score || deadlineTime(left.tender) - deadlineTime(right.tender) || newestTime(right.tender) - newestTime(left.tender));

  return ranked.slice(0, 24).map(({ tender }) =>
    toMarketplaceTenderRow(tender, {
      ...context,
      savedTenderIds,
      bidState: bidStates.get(tender.id)
    })
  );
}

function addTenderRecommendationSignal(
  tender: MarketplaceTenderRecord,
  weight: number,
  weightedTerms: Map<string, number>,
  typeWeights: Map<TenderType, number>,
  locationWeights: Map<string, number>
) {
  for (const term of tenderRecommendationTerms(tender)) addWeightedTerm(weightedTerms, term, weight);
  typeWeights.set(tender.type, (typeWeights.get(tender.type) ?? 0) + weight);
  for (const term of recommendationTerms([tender.location])) addWeightedTerm(locationWeights, term, weight);
}

function addProfileRecommendationSignal(
  profile: MarketplaceVerificationProfileRecord | null,
  weightedTerms: Map<string, number>,
  locationWeights: Map<string, number>
) {
  if (!profile) return;
  const values = [
    ...(profile.documents?.flatMap((item) => [item.document?.name, item.document?.documentType]) ?? []),
    ...profilePayloadSignalValues(profile.payload)
  ];
  for (const term of recommendationTerms(values)) addWeightedTerm(weightedTerms, term, 5);
  for (const term of recommendationTerms(profileLocationSignalValues(profile.payload))) addWeightedTerm(locationWeights, term, 7);
}

function marketplaceRecommendationMatchScore(
  tender: MarketplaceTenderRecord,
  context: {
    weightedTerms: Map<string, number>;
    typeWeights: Map<TenderType, number>;
    locationWeights: Map<string, number>;
    invitedTenderIds: Set<string>;
    savedTenderIds: Set<string>;
    bidState?: MarketplaceBidState;
  }
) {
  let score = 0;
  if (context.invitedTenderIds.has(tender.id)) score += 100;
  if (context.savedTenderIds.has(tender.id)) score += 45;
  if (context.bidState?.hasDraftBid) score += 28;
  if (context.bidState?.hasSubmittedBid) score += 12;

  for (const term of tenderRecommendationTerms(tender)) score += context.weightedTerms.get(term) ?? 0;
  return score;
}

function marketplaceRecommendationLocationBoost(tender: MarketplaceTenderRecord, locationWeights: Map<string, number>) {
  let score = 0;
  for (const term of recommendationTerms([tender.location])) score += locationWeights.get(term) ?? 0;
  return score;
}

function tenderRecommendationTerms(tender: MarketplaceTenderRecord) {
  return recommendationTerms([
    tender.title,
    tender.description,
    tender.reference,
    tender.buyerOrg.name,
    marketplaceCategory(tender),
    ...marketplaceCategoryValues(tender),
    ...marketplaceCategoryValues(tender).flatMap((category) => categorySearchTerms(category)),
    ...tenderPayloadSignalValues(tender.requirements),
    ...tenderPayloadSignalValues(tender.metadata)
  ]);
}

function tenderPayloadSignalValues(value: unknown): unknown[] {
  const values: unknown[] = [];
  collectTenderPayloadValues(value, values);
  return values;
}

function collectTenderPayloadValues(value: unknown, values: unknown[]) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number') {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTenderPayloadValues(item, values);
    return;
  }
  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      values.push(childKey);
      collectTenderPayloadValues(childValue, values);
    }
  }
}

function profilePayloadSignalValues(value: unknown): unknown[] {
  const values: unknown[] = [];
  collectProfilePayloadValues(value, values, (key) => /categor|classif|sector|industry|business|certif|compliance|license|document/i.test(key));
  return values;
}

function profileLocationSignalValues(value: unknown): unknown[] {
  const values: unknown[] = [];
  collectProfilePayloadValues(value, values, (key) => /region|district|location|city|ward|address/i.test(key));
  return values;
}

function collectProfilePayloadValues(value: unknown, values: unknown[], keyFilter: (key: string) => boolean, key = '', parentMatches = false) {
  if (value === null || value === undefined) return;
  const currentMatches = parentMatches || (key ? keyFilter(key) : false);
  if (typeof value === 'string' || typeof value === 'number') {
    if (currentMatches) values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectProfilePayloadValues(item, values, keyFilter, key, currentMatches);
    return;
  }
  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      collectProfilePayloadValues(childValue, values, keyFilter, childKey, currentMatches || keyFilter(childKey));
    }
  }
}

function recommendationTerms(values: unknown[]) {
  const terms = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSearchText(value);
    if (!normalized) continue;
    if (normalized.length >= 3 && !recommendationStopWords.has(normalized)) terms.add(normalized);
    for (const part of normalized.split(' ')) {
      if (part.length >= 3 && !recommendationStopWords.has(part)) terms.add(part);
    }
  }
  return [...terms];
}

function addWeightedTerm(weights: Map<string, number>, term: string, weight: number) {
  weights.set(term, (weights.get(term) ?? 0) + weight);
}

const recommendationStopWords = new Set([
  'and',
  'for',
  'the',
  'with',
  'from',
  'this',
  'that',
  'tender',
  'procurement',
  'public',
  'private',
  'marketplace',
  'company',
  'limited',
  'ltd',
  'llc',
  'goods',
  'works',
  'service',
  'services',
  'consultancy',
  'certificate',
  'certificates',
  'certification',
  'compliance',
  'document',
  'documents',
  'license',
  'registration',
  'supplier',
  'business',
  'tanzania'
]);

function toMarketplaceTenderRow(tender: MarketplaceTenderRecord, context: MarketplaceTenderRowContext = {}): MarketplaceTenderRow {
  const category = marketplaceCategory(tender);
  const ownedByCurrentOrganization = Boolean(context.organizationId && tender.buyerOrgId === context.organizationId);
  const createdByCurrentUser = Boolean(context.userId && tender.ownerUserId === context.userId);
  const hasDraftBid = Boolean(context.bidState?.hasDraftBid);
  const hasSubmittedBid = Boolean(context.bidState?.hasSubmittedBid);
  const buyerLogo = buyerLogoMetadata(tender.buyerOrg.verificationProfiles?.[0]?.payload);
  return {
    id: tender.id,
    title: tender.title,
    organization: tender.buyerOrg.name,
    ownerOrganization: tender.buyerOrg.name,
    ...(buyerLogo ? { buyerLogoUrl: tenderBuyerLogoUrl(tender.id) } : {}),
    type: frontendTenderType(tender.type),
    category,
    description: tender.description || '',
    location: tender.location || 'Tanzania',
    budget: decimalToNumber(tender.budget),
    status: frontendTenderStatus(tender.status),
    visibility: tender.visibility,
    reference: tender.reference,
    publishedAt: tender.publishedAt?.toISOString() ?? '',
    openingDate: marketplaceOpeningDate(tender.metadata),
    closingDate: dateOnly(tender.closingDate),
    createdByCurrentUser,
    ownedByCurrentOrganization,
    canBid: canBidOnTender(tender, context, hasSubmittedBid),
    hasDraftBid,
    hasSubmittedBid,
    isSaved: Boolean(context.organizationId && context.savedTenderIds?.has(tender.id))
  };
}

function toMyTenderRow(tender: MarketplaceTenderRecord, context: MarketplaceTenderRowContext = {}): MyTenderRow {
  const section = myTenderSection(tender.status);
  const status = myTenderWorkspaceStatus(tender);
  return {
    id: tender.id,
    section,
    title: tender.title,
    status,
    type: frontendTenderType(tender.type),
    lastActivity: tender.updatedAt.toISOString(),
    nav: myTenderWorkspaceRoute(tender, section, status),
    actionLabel: myTenderWorkspaceActionLabel(section, status),
    tender: toMarketplaceTenderRow(tender, context)
  };
}

function toMyBidRow(bid: MarketplaceBidRecord, context: MarketplaceTenderRowContext = {}): MyBidRow {
  const section = myBidSection(bid.status);
  return {
    id: bid.id,
    tenderId: bid.tenderId,
    section,
    title: bid.tender.title,
    status: frontendBidStatus(bid.status),
    amount: bid.totalAmount ? `${bid.currency} ${decimalToNumber(bid.totalAmount).toLocaleString('en-US')}` : undefined,
    receiptHash: bid.receipt?.receiptHash,
    lastActivity: bid.updatedAt.toISOString(),
    nav: 'bidding-workspace',
    actionLabel: section === 'draft' ? 'Continue Bid' : 'Open Bid',
    tender: toMarketplaceTenderRow(bid.tender, context)
  };
}

function marketplaceSummary(tenders: MarketplaceTenderRecord[], myTenders: MyTenderRow[], myBids: MyBidRow[]) {
  const rows = tenders.map((tender) => toMarketplaceTenderRow(tender));
  return {
    openTenders: rows.filter((row) => row.status === 'Open').length,
    myTenders: myTenders.length,
    myBids: myBids.length,
    totalBudgetValue: rows.reduce((sum, row) => sum + row.budget, 0),
    categoryCounts: groupCount(rows, (row) => row.category),
    closingSoon: closingSoonCount(rows)
  };
}

function marketplacePagination(matching: number, query: MarketplaceQuery) {
  const totalPages = Math.ceil(matching / query.limit);
  return {
    page: query.page,
    limit: query.limit,
    matching,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1 && totalPages > 0
  };
}

function toCreateTenderResponseDto(tender: { id: string; reference: string; title: string; status: TenderStatus; type: TenderType; createdAt: Date }): CreateTenderResponseDto {
  return {
    success: true,
    message: 'Tender draft created successfully',
    data: {
      id: tender.id,
      reference: tender.reference,
      title: tender.title,
      status: frontendTenderStatus(tender.status),
      type: frontendTenderType(tender.type),
      createdAt: tender.createdAt.toISOString()
    }
  };
}

function toUpdateTenderResponseDto(tender: { id: string; reference: string; title: string; status: TenderStatus; updatedAt: Date }): UpdateTenderResponseDto {
  return {
    success: true,
    message: 'Tender updated successfully',
    data: {
      id: tender.id,
      reference: tender.reference,
      title: tender.title,
      status: frontendTenderStatus(tender.status),
      updatedAt: tender.updatedAt.toISOString()
    }
  };
}

function toUpdateBuyerNoticeResponseDto(tender: { id: string; updatedAt: Date }, buyerNotice: string): UpdateBuyerNoticeResponseDto {
  return {
    success: true,
    message: 'Buyer notice saved successfully',
    data: {
      id: tender.id,
      buyerNotice,
      updatedAt: tender.updatedAt.toISOString()
    }
  };
}

function toPublishTenderResponseDto(tender: {
  id: string;
  reference: string;
  title: string;
  status: TenderStatus;
  visibility: Visibility;
  publishedAt: Date | null;
  closingDate: Date | null;
}, message = 'Tender published successfully'): PublishTenderResponseDto {
  return {
    success: true,
    message,
    data: {
      id: tender.id,
      reference: tender.reference,
      title: tender.title,
      status: frontendTenderStatus(tender.status),
      visibility: tender.visibility,
      publishedAt: tender.publishedAt?.toISOString() ?? '',
      closingDate: dateOnly(tender.closingDate)
    },
    validation: {
      warnings: [],
      scannerIssues: [],
      standardizedCategories: []
    }
  };
}

function toTenderReviewQueueItemDto(tender: TenderReviewQueueRecord): TenderReviewQueueItemDto {
  return {
    id: tender.id,
    reference: tender.reference,
    title: tender.title,
    buyerOrgId: tender.buyerOrgId,
    buyerName: tender.buyerOrg.name,
    ownerUserId: tender.ownerUserId,
    ownerName: tender.ownerUser?.displayName ?? tender.ownerUser?.email ?? null,
    type: frontendTenderType(tender.type),
    status: frontendTenderStatus(tender.status),
    method: tender.method,
    visibility: tender.visibility,
    budget: decimalToNumber(tender.budget),
    currency: tender.currency,
    location: tender.location || 'Tanzania',
    closingDate: dateOnly(tender.closingDate),
    categories: tender.categories.map((category) => category.name),
    submittedAt: reviewSubmittedAt(tender.metadata, tender.updatedAt),
    createdAt: tender.createdAt.toISOString(),
    updatedAt: tender.updatedAt.toISOString()
  };
}

function toTenderReviewDetailDto(tender: TenderReviewDetailRecord, activity: TenderActivity): TenderReviewDetailDto {
  const detail = toTenderDetailDto(tender, { organizationId: tender.buyerOrgId, userId: tender.ownerUserId ?? undefined }, activity);
  const review = adminReviewPayload(tender.metadata);
  return {
    ...detail,
    buyerName: tender.buyerOrg.name,
    ownerName: tender.ownerUser?.displayName ?? tender.ownerUser?.email ?? null,
    submittedAt: reviewSubmittedAt(tender.metadata, tender.updatedAt),
    reviewAttempts: numberPayload(review.attempts) ?? 0
  };
}

function toTenderReviewDecisionResponseDto(
  message: string,
  tender: {
    id: string;
    reference: string;
    title: string;
    status: TenderStatus;
    visibility: Visibility;
    publishedAt: Date | null;
  },
  communicationMessageId: string | null,
  routes: { marketplaceRoute?: string; amendmentRoute?: string }
): TenderReviewDecisionResponseDto {
  return {
    success: true,
    message,
    data: {
      tenderId: tender.id,
      reference: tender.reference,
      title: tender.title,
      status: frontendTenderStatus(tender.status),
      visibility: tender.visibility,
      publishedAt: tender.publishedAt?.toISOString() ?? '',
      communicationMessageId,
      ...routes
    }
  };
}

async function createTenderReviewPassMessage(
  tx: Prisma.TransactionClient,
  tender: TenderReviewDetailRecord,
  platformOrgId: string,
  createdAt: Date
): Promise<string> {
  const body =
    `Your tender ${tender.reference} has passed admin review and has successfully been published to the marketplace. ` +
    'You can reply to this message or open the tender record from the action button below.';
  const conversationId = `conversation-${randomUUID()}`;
  const metadata = {
    source: 'tender-review',
    reviewDecision: 'PASS',
    actionLabel: 'View Tender',
    actionRoute: viewTenderRoute(tender.id),
    tenderReference: tender.reference,
    tenderTitle: tender.title
  };
  const payload = {
    conversationId,
    contextKey: `tender:${tender.id}`,
    metadata,
    thread: [
      {
        senderOrgId: platformOrgId,
        senderName: 'ProcureX Platform',
        body,
        notice: null,
        createdAt: createdAt.toISOString()
      }
    ]
  } satisfies Prisma.InputJsonObject;

  const senderCopy = await tx.communicationItem.create({
    data: {
      ownerOrgId: platformOrgId,
      senderOrgId: platformOrgId,
      recipientOrgId: tender.buyerOrgId,
      tenderId: tender.id,
      kind: CommunicationKind.NOTIFICATION,
      folder: 'sent',
      category: 'Tender Review',
      subject: 'Your tender has passed review',
      body,
      status: CommunicationStatus.READ,
      priority: CommunicationPriority.NORMAL,
      read: true,
      actionRequired: false,
      visibility: 'Private',
      payload: {
        ...payload,
        deliveryRole: 'sender'
      } as Prisma.InputJsonObject
    },
    select: { id: true }
  });

  const recipientCopy = await tx.communicationItem.create({
    data: {
      ownerOrgId: tender.buyerOrgId,
      senderOrgId: platformOrgId,
      recipientOrgId: tender.buyerOrgId,
      tenderId: tender.id,
      kind: CommunicationKind.NOTIFICATION,
      folder: 'inbox',
      category: 'Tender Review',
      subject: 'Your tender has passed review',
      body,
      status: CommunicationStatus.UNREAD,
      priority: CommunicationPriority.NORMAL,
      read: false,
      actionRequired: false,
      visibility: 'Private',
      payload: {
        ...payload,
        deliveryRole: 'recipient',
        senderCopyId: senderCopy.id
      } as Prisma.InputJsonObject
    },
    select: { id: true }
  });

  return recipientCopy.id;
}

function riskLevelFromScan(scan: TenderLanguageScanDto) {
  if (scan.riskLevel === 'High') return RiskLevel.HIGH;
  if (scan.riskLevel === 'Medium') return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function toCloseTenderResponseDto(tender: {
  id: string;
  reference: string;
  title: string;
  status: TenderStatus;
  closingDate: Date | null;
  updatedAt: Date;
}): CloseTenderResponseDto {
  return {
    success: true,
    message: 'Tender closed successfully',
    data: {
      id: tender.id,
      reference: tender.reference,
      title: tender.title,
      status: frontendTenderStatus(tender.status),
      closingDate: dateOnly(tender.closingDate),
      updatedAt: tender.updatedAt.toISOString()
    }
  };
}

function savedTenderResponse(): SaveTenderResponseDto {
  return {
    success: true,
    message: 'Tender saved successfully'
  };
}

function unsaveTenderResponse(): UnsaveTenderResponseDto {
  return {
    success: true,
    message: 'Tender removed from saved tenders'
  };
}

function toTenderDetailDto(
  tender: TenderDetailRecord,
  context: MarketplaceContext = {},
  activity: TenderActivity = emptyTenderActivity(),
  clarificationInquiries: TenderClarificationInquiryRecord[] = []
): TenderDetailDto {
  const createdByCurrentUser = Boolean(context.userId && tender.ownerUserId === context.userId);
  const ownedByCurrentOrganization = Boolean(context.organizationId && tender.buyerOrgId === context.organizationId);
  const currentOrgBids = context.organizationId ? tender.bids.filter((bid) => bid.supplierOrgId === context.organizationId) : [];
  const currentBid = currentOrgBids.find((bid) => bid.status !== BidStatus.WITHDRAWN) ?? currentOrgBids[0] ?? null;
  const hasDraftBid = currentOrgBids.some((bid) => bid.status === BidStatus.DRAFT);
  const hasSubmittedBid = currentOrgBids.some((bid) => isSubmittedBidStatus(bid.status));
  const buyerLogo = buyerLogoMetadata(tender.buyerOrg.verificationProfiles?.[0]?.payload);
  const summary = {
    total: tender.bids.length,
    draft: tender.bids.filter((bid) => bid.status === BidStatus.DRAFT).length,
    submitted: tender.bids.filter((bid) => isSubmittedBidStatus(bid.status)).length,
    withdrawn: tender.bids.filter((bid) => bid.status === BidStatus.WITHDRAWN).length
  };
  const submittedBidBusinesses = ownedByCurrentOrganization
    ? tender.bids
        .filter((bid) => isSubmittedBidStatus(bid.status))
        .map((bid) => ({
          id: bid.supplierOrg.id,
          name: bid.supplierOrg.name,
          submittedAt: bid.submittedAt?.toISOString() ?? null
        }))
    : [];

  return {
    id: tender.id,
    title: tender.title,
    reference: tender.reference,
    buyerOrgId: tender.buyerOrgId,
    ownerUserId: tender.ownerUserId,
    organization: tender.buyerOrg.name,
    ownerOrganization: tender.buyerOrg.name,
    ...(buyerLogo ? { buyerLogoUrl: tenderBuyerLogoUrl(tender.id) } : {}),
    type: frontendTenderType(tender.type),
    category: marketplaceCategory(tender),
    description: tender.description || '',
    location: tender.location || 'Tanzania',
    budget: decimalToNumber(tender.budget),
    currency: tender.currency,
    status: frontendTenderStatus(tender.status),
    method: tender.method,
    contractType: tender.contractType,
    visibility: tender.visibility,
    publishedAt: tender.publishedAt?.toISOString() ?? '',
    openingDate: marketplaceOpeningDate(tender.metadata),
    closingDate: dateOnly(tender.closingDate),
    requirements: objectPayload(tender.requirements),
    metadata: objectPayload(tender.metadata),
    requirementRows: tender.requirementRows.map((row) => ({
      id: row.id,
      section: row.section,
      payload: objectPayload(row.payload)
    })),
    milestones: tender.milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      dueDate: milestone.dueDate?.toISOString() ?? null,
      payload: objectPayload(milestone.payload)
    })),
    commercialItems: tender.commercialItems.map((item) => ({
      id: item.id,
      itemNo: item.itemNo,
      description: item.description,
      quantity: decimalToNullableNumber(item.quantity),
      unit: item.unit,
      rate: decimalToNullableNumber(item.rate),
      total: decimalToNullableNumber(item.total),
      payload: objectPayload(item.payload)
    })),
    documents: tender.documents.map((document) => ({
      id: document.document.id,
      name: document.document.name,
      documentType: document.document.documentType,
      label: document.label,
      openUrl: tenderDocumentActionUrl(tender.id, document.document.id, 'open'),
      downloadUrl: tenderDocumentActionUrl(tender.id, document.document.id, 'download')
    })),
    createdByCurrentUser,
    ownedByCurrentOrganization,
    canBid: canBidOnTender(tender, context, hasSubmittedBid),
    hasDraftBid,
    hasSubmittedBid,
    bidSummary: ownedByCurrentOrganization ? summary : { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
    submittedBidBusinesses,
    clarificationInquiries: ownedByCurrentOrganization ? clarificationInquiries.map(toTenderClarificationInquiryDto) : [],
    currentBid: currentBid
      ? {
          id: currentBid.id,
          reference: currentBid.reference,
          status: currentBid.status,
          submittedAt: currentBid.submittedAt?.toISOString() ?? null,
          receiptHash: currentBid.receipt?.receiptHash ?? null
        }
      : null,
    activity,
    amendmentSummary: amendmentSummary(tender.amendments, ownedByCurrentOrganization)
  };
}

function tenderDocumentActionUrl(tenderId: string, documentId: string, action: 'open' | 'download') {
  return `/api/procurement/tenders/${tenderId}/documents/${documentId}/${action}`;
}

function tenderBuyerLogoUrl(tenderId: string) {
  return `/api/procurement/tenders/${tenderId}/buyer-logo`;
}

function buyerLogoMetadata(profilePayload: unknown): ProfileImageMetadata | null {
  const profile = objectPayload(objectPayload(profilePayload).profile);
  return profileImageMetadata(profile.profileImage);
}

function toTenderClarificationInquiryDto(inquiry: TenderClarificationInquiryRecord) {
  return {
    id: inquiry.id,
    senderOrgId: inquiry.senderOrgId,
    senderName: inquiry.senderOrg?.name ?? null,
    subject: inquiry.subject,
    body: inquiry.body,
    status: inquiry.status,
    read: inquiry.read,
    createdAt: inquiry.createdAt.toISOString(),
    updatedAt: inquiry.updatedAt.toISOString()
  };
}

function isOriginalIncomingTenderClarificationInquiry(inquiry: TenderClarificationInquiryRecord, buyerOrgId: string) {
  const payload = objectPayload(inquiry.payload);
  return (
    inquiry.folder === 'inbox' &&
    inquiry.ownerOrgId === buyerOrgId &&
    inquiry.recipientOrgId === buyerOrgId &&
    inquiry.senderOrgId !== buyerOrgId &&
    !stringPayload(payload.relatedMessageId)
  );
}

function amendmentSummary(amendments: Array<{ status: TenderAmendmentStatus }> | undefined, includeDrafts: boolean) {
  const rows = amendments ?? [];
  const published = rows.filter((amendment) => amendment.status === TenderAmendmentStatus.PUBLISHED).length;
  const draft = includeDrafts ? rows.filter((amendment) => amendment.status === TenderAmendmentStatus.DRAFT).length : 0;
  return {
    total: includeDrafts ? rows.length : published,
    published,
    draft
  };
}

function toTenderAmendmentDto(amendment: {
  id: string;
  tenderId: string;
  reference: string;
  title: string;
  summary: string | null;
  status: TenderAmendmentStatus;
  payload: Prisma.JsonValue;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TenderAmendmentDto {
  return {
    id: amendment.id,
    tenderId: amendment.tenderId,
    reference: amendment.reference,
    title: amendment.title,
    summary: amendment.summary ?? '',
    status: amendment.status,
    payload: objectPayload(amendment.payload),
    publishedAt: amendment.publishedAt?.toISOString() ?? null,
    createdAt: amendment.createdAt.toISOString(),
    updatedAt: amendment.updatedAt.toISOString()
  };
}

function amendmentResponse(message: string, amendment: Parameters<typeof toTenderAmendmentDto>[0]): TenderAmendmentResponseDto {
  return {
    success: true,
    message,
    data: toTenderAmendmentDto(amendment)
  };
}

function emptyTenderActivity(): TenderActivity {
  return {
    marketplaceViews: 0,
    documentDownloads: 0,
    clarifications: 0
  };
}

function canViewTenderDetail(tender: { buyerOrgId: string; status: TenderStatus; visibility: Visibility; metadata?: unknown }, context: MarketplaceContext) {
  if (context.organizationId && tender.buyerOrgId === context.organizationId) return true;
  return isPublicOpenTender(tender) || isInvitedTenderForContext(tender, context);
}

function isPublicOpenTender(tender: { status: TenderStatus; visibility: Visibility }) {
  return tender.visibility === Visibility.PUBLIC_MARKETPLACE && (tender.status === TenderStatus.OPEN || tender.status === TenderStatus.PUBLISHED);
}

function isInvitedTenderForContext(tender: { buyerOrgId: string; status: TenderStatus; visibility: Visibility; metadata?: unknown }, context: MarketplaceContext) {
  if (!context.organizationId || tender.buyerOrgId === context.organizationId) return false;
  if (tender.visibility !== Visibility.INVITED || (tender.status !== TenderStatus.OPEN && tender.status !== TenderStatus.PUBLISHED)) return false;
  return isOrganizationInvited(tender.metadata, context);
}

function shouldRecordMarketplaceView(tender: { buyerOrgId: string; status: TenderStatus; visibility: Visibility }, organizationId?: string) {
  if (!isPublicOpenTender(tender)) return false;
  return !organizationId || tender.buyerOrgId !== organizationId;
}

function canBidOnTender(tender: Pick<TenderDetailRecord, 'buyerOrgId' | 'status' | 'visibility' | 'closingDate' | 'metadata'>, context: MarketplaceContext, hasSubmittedBid: boolean) {
  if (!context.organizationId) return false;
  if (tender.buyerOrgId === context.organizationId) return false;
  if (!isPublicOpenTender(tender) && !isInvitedTenderForContext(tender, context)) return false;
  if (hasSubmittedBid) return false;
  if (!hasReachedOpeningDate(tender.metadata)) return false;
  return tender.closingDate ? tender.closingDate.getTime() > Date.now() : false;
}

function isOrganizationInvited(metadata: unknown, context: MarketplaceContext) {
  const inviteValues = invitedSupplierValues(metadata).map(normalizeInvitationValue);
  if (!inviteValues.length) return false;
  const identityValues = [context.organizationId, context.organizationName, context.userId]
    .map(normalizeInvitationValue)
    .filter(Boolean);
  return identityValues.some((identity) => inviteValues.includes(identity));
}

function invitedSupplierValues(metadata: unknown): string[] {
  const record = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  const values = [
    record.invitedSuppliers,
    record.invitedSupplierNames,
    record.invitedOrganizations,
    record.invitedOrganizationIds,
    record.invitedUserIds
  ];
  return values.flatMap(invitationValueStrings);
}

function invitationValueStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(invitationValueStrings);
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [record.id, record.name, record.organizationId, record.organizationName, record.email].flatMap(invitationValueStrings);
  }
  return [];
}

function normalizeInvitationValue(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isSubmittedBidStatus(status: BidStatus) {
  return status !== BidStatus.DRAFT && status !== BidStatus.WITHDRAWN;
}

function bidStatesByTender(bids: MarketplaceBidRecord[]) {
  const states = new Map<string, MarketplaceBidState>();
  for (const bid of bids) {
    const current = states.get(bid.tenderId) ?? { hasDraftBid: false, hasSubmittedBid: false };
    const next = bidStateFromStatus(bid.status);
    current.hasDraftBid ||= next.hasDraftBid;
    current.hasSubmittedBid ||= next.hasSubmittedBid;
    states.set(bid.tenderId, current);
  }
  return states;
}

function bidStateFromStatus(status: BidStatus): MarketplaceBidState {
  return {
    hasDraftBid: status === BidStatus.DRAFT,
    hasSubmittedBid: isSubmittedBidStatus(status)
  };
}

function bidSummary(bids: Array<{ status: BidStatus }>) {
  return bids.reduce(
    (summary, bid) => {
      summary.total += 1;
      if (bid.status === BidStatus.DRAFT) summary.draft += 1;
      else if (bid.status === BidStatus.WITHDRAWN) summary.withdrawn += 1;
      else if (isSubmittedBidStatus(bid.status)) summary.submitted += 1;
      return summary;
    },
    { total: 0, draft: 0, submitted: 0, withdrawn: 0 }
  );
}

function marketplaceCategory(tender: MarketplaceTenderRecord) {
  const categoryNames = uniqueCategoryNames(tender.categories.map((category) => standardizeCategoryName(category.name, tender.type)).filter(Boolean));
  if (categoryNames.length > 0) return categoryNames.join(' / ');
  return frontendTenderType(tender.type);
}

function uniqueCategoryNames(categories: string[]) {
  const seen = new Set<string>();
  return categories.filter((category) => {
    const key = normalizeLabel(category);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function frontendTenderStatus(status: unknown) {
  const value = normalizeLabel(status);
  if (value === 'OPEN' || value === 'PUBLISHED') return 'Open';
  if (value === 'EVALUATION' || value === 'UNDER_EVALUATION') return 'Evaluation';
  if (value === 'AWARDED') return 'Awarded';
  if (value === 'CLOSED') return 'Closed';
  if (value === 'DRAFT') return 'Draft';
  if (value === 'CANCELLED') return 'Cancelled';
  if (value === 'REVIEW' || value === 'PENDING' || value === 'UNDER_REVIEW') return 'Under Review';
  if (value === 'COMPLETED') return 'Completed';
  return titleCaseLabel(value);
}

function frontendBidStatus(status: unknown) {
  const value = normalizeLabel(status);
  if (value === 'DRAFT') return 'Draft';
  if (value === 'SUBMITTED') return 'Submitted';
  if (value === 'AWARDED') return 'Awarded';
  if (value === 'DISQUALIFIED' || value === 'REJECTED' || value === 'LOST') return 'Rejected';
  if (value === 'UNDER_EVALUATION' || value === 'OPENED' || value === 'EVALUATED') return 'Evaluated';
  if (value === 'WITHDRAWN') return 'Withdrawn';
  return titleCaseLabel(value);
}

function myTenderWorkspaceStatus(tender: MarketplaceTenderRecord) {
  const reviewStatus = normalizeLabel(adminReviewPayload(tender.metadata).status);
  if (reviewStatus === 'FAILED') return 'Failed Review';
  if (normalizeLabel(tender.status) === 'REVIEW') return 'Awaiting Review';
  return frontendTenderStatus(tender.status);
}

function myTenderWorkspaceRoute(tender: MarketplaceTenderRecord, section: MyTenderRow['section'], status: string) {
  if (isFailedReviewStatus(status) || section === 'draft') return amendTenderRoute(tender.id);
  return viewTenderRoute(tender.id);
}

function myTenderWorkspaceActionLabel(section: MyTenderRow['section'], status: string) {
  if (isFailedReviewStatus(status)) return 'Amend tender';
  if (isAwaitingReviewStatus(status)) return 'Awaiting review';
  if (section === 'draft') return 'Continue creating';
  return 'View tender';
}

function frontendTenderType(type: unknown) {
  const value = normalizeLabel(type);
  if (value === 'GOODS') return 'Goods';
  if (value === 'WORKS') return 'Works';
  if (value === 'SERVICE' || value === 'SERVICES' || value === 'NON_CONSULTANCY' || value === 'NON_CONSULTANCY_SERVICES') return 'Non Consultancy';
  if (value === 'CONSULTANCY') return 'Consultancy';
  return titleCaseLabel(value);
}

function isFailedReviewStatus(status: string) {
  return normalizeLabel(status) === 'FAILED_REVIEW' || normalizeLabel(status) === 'FAILED';
}

function isAwaitingReviewStatus(status: string) {
  const value = normalizeLabel(status);
  return value === 'AWAITING_REVIEW' || value === 'UNDER_REVIEW' || value === 'REVIEW_PENDING';
}

function myTenderSection(status: unknown): MyTenderRow['section'] {
  const value = normalizeLabel(status);
  if (value === 'DRAFT' || value === 'PENDING' || value === 'REVIEW' || value === 'UNDER_REVIEW') return 'draft';
  if (value === 'OPEN' || value === 'PUBLISHED') return 'posted';
  if (value === 'CLOSED' || value === 'COMPLETED' || value === 'AWARDED' || value === 'CANCELLED') return 'completed';
  return 'posted';
}

function myBidSection(status: unknown): MyBidRow['section'] {
  const value = normalizeLabel(status);
  if (value === 'DRAFT') return 'draft';
  if (value === 'SUBMITTED' || value === 'EVALUATED' || value === 'AWARDED' || value === 'REJECTED') return 'submitted';
  return 'submitted';
}

function typeFilterValues(type: string): TenderType[] {
  const value = normalizeLabel(type);
  if (!value) return [];
  if (value === 'GOODS') return [TenderType.GOODS];
  if (value === 'WORKS') return [TenderType.WORKS];
  if (value === 'NON_CONSULTANCY' || value === 'NON_CONSULTANCY_SERVICES' || value === 'SERVICE' || value === 'SERVICES') return [TenderType.SERVICE];
  if (value === 'CONSULTANCY') return [TenderType.CONSULTANCY];
  return [];
}

function statusFilterValues(status: string): TenderStatus[] {
  const value = normalizeLabel(status);
  if (!value) return [];
  if (value === 'OPEN' || value === 'PUBLISHED') return [TenderStatus.OPEN, TenderStatus.PUBLISHED];
  if (value === 'EVALUATION' || value === 'UNDER_EVALUATION') return [TenderStatus.EVALUATION];
  if (value === 'AWARDED') return [TenderStatus.AWARDED];
  if (value === 'CLOSED') return [TenderStatus.CLOSED];
  if (value === 'DRAFT') return [TenderStatus.DRAFT];
  if (value === 'CANCELLED') return [TenderStatus.CANCELLED];
  return [];
}

function normalizeLabel(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function titleCaseLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function newestTime(tender: MarketplaceTenderRecord) {
  return (tender.publishedAt ?? tender.createdAt).getTime();
}

function deadlineTime(tender: MarketplaceTenderRecord) {
  return tender.closingDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function closingSoonCount(rows: MarketplaceTenderRow[]) {
  const now = Date.now();
  const closingSoonThreshold = now + 7 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    if (row.status !== 'Open') return false;
    const closingTime = Date.parse(`${row.closingDate}T23:59:59.999Z`);
    return Number.isFinite(closingTime) && closingTime >= now && closingTime <= closingSoonThreshold;
  }).length;
}

function buildSummary(plans: ProcurementPlanRecord[], query: ProcurementPlanningQuery, years: string[]) {
  const records = plans.flatMap((plan) => toFilteredLineDtos(plan, query));

  return {
    financialYear: query.financialYear || null,
    years,
    totalPlans: plans.length,
    totalLines: records.length,
    totalBudget: records.reduce((sum, record) => sum + record.budget, 0),
    byStatus: groupCount(records, (record) => record.status),
    byCategory: groupCount(records, (record) => record.category)
  };
}

function groupCount<T extends { budget?: number }>(items: T[], getLabel: (item: T) => string) {
  const groups = new Map<string, { value: number; amount: number }>();
  for (const item of items) {
    const label = getLabel(item) || 'Unspecified';
    const current = groups.get(label) ?? { value: 0, amount: 0 };
    current.value += 1;
    current.amount += item.budget ?? 0;
    groups.set(label, current);
  }
  return Array.from(groups, ([label, value]) => ({ label, ...value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function sortPlanLines<T extends { createdAt: string; tenderTitle: string; budget: number; status: string; category: string }>(
  lines: T[],
  query: ProcurementPlanningQuery
) {
  const direction = query.sortDirection === 'asc' ? 1 : -1;
  return [...lines].sort((left, right) => {
    const leftValue = lineSortValue(left, query.sortBy);
    const rightValue = lineSortValue(right, query.sortBy);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function lineSortValue(line: { createdAt: string; tenderTitle: string; budget: number; status: string; category: string }, sortBy: ProcurementPlanningQuery['sortBy']) {
  if (sortBy === 'title') return line.tenderTitle.toLowerCase();
  if (sortBy === 'budget') return line.budget;
  if (sortBy === 'status') return line.status.toLowerCase();
  if (sortBy === 'category') return line.category.toLowerCase();
  return line.createdAt;
}

function lineCreateInput(planId: string, line: ProcurementPlanLineInput): Prisma.ProcurementPlanLineCreateManyInput {
  return {
    planId,
    tenderId: line.tenderId,
    tenderTitle: line.tenderTitle,
    openingDate: dateInput(line.openingDate),
    closingDate: dateInput(line.closingDate),
    category: line.category,
    budget: line.budget,
    procurementMethod: line.procurementMethod,
    sourceOfFunds: line.sourceOfFunds,
    expectedCompletionDate: dateInput(line.expectedCompletionDate),
    status: line.status,
    planState: line.planState,
    notes: line.notes || null,
    customValues: line.customValues as Prisma.InputJsonObject,
    metadata: line.metadata as Prisma.InputJsonObject
  };
}

function lineUpdateInput(line: ProcurementPlanLinePatchInput): Prisma.ProcurementPlanLineUpdateInput {
  return {
    ...(line.tenderId !== undefined ? { tender: { connect: { id: line.tenderId } } } : {}),
    ...(line.tenderTitle !== undefined ? { tenderTitle: line.tenderTitle } : {}),
    ...(line.openingDate !== undefined ? { openingDate: dateInput(line.openingDate) } : {}),
    ...(line.closingDate !== undefined ? { closingDate: dateInput(line.closingDate) } : {}),
    ...(line.category !== undefined ? { category: line.category } : {}),
    ...(line.budget !== undefined ? { budget: line.budget } : {}),
    ...(line.procurementMethod !== undefined ? { procurementMethod: line.procurementMethod } : {}),
    ...(line.sourceOfFunds !== undefined ? { sourceOfFunds: line.sourceOfFunds } : {}),
    ...(line.expectedCompletionDate !== undefined ? { expectedCompletionDate: dateInput(line.expectedCompletionDate) } : {}),
    ...(line.status !== undefined ? { status: line.status } : {}),
    ...(line.planState !== undefined ? { planState: line.planState } : {}),
    ...(line.notes !== undefined ? { notes: line.notes || null } : {}),
    ...(line.customValues !== undefined ? { customValues: line.customValues as Prisma.InputJsonObject } : {}),
    ...(line.metadata !== undefined ? { metadata: line.metadata as Prisma.InputJsonObject } : {})
  };
}

function normalizeCategoryInputs(categories: string[]) {
  const seen = new Set<string>();
  return categories
    .map((category) => category.trim())
    .filter(Boolean)
    .filter((category) => {
      const key = category.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function replaceTenderDesignRows(
  tx: Prisma.TransactionClient,
  tenderId: string,
  input: Pick<CreateTenderInput, 'requirementRows' | 'commercialItems'>
) {
  if (input.requirementRows !== undefined) {
    await tx.tenderRequirement.deleteMany({ where: { tenderId } });
    const rows = input.requirementRows
      .map((row) => ({
        tenderId,
        section: row.section,
        payload: {
          ...row.payload,
          ...(row.id ? { sourceId: row.id } : {})
        } as Prisma.InputJsonObject
      }))
      .filter((row) => row.section.trim());
    if (rows.length) await tx.tenderRequirement.createMany({ data: rows });
  }

  if (input.commercialItems !== undefined) {
    await tx.tenderCommercialItem.deleteMany({ where: { tenderId } });
    const rows = input.commercialItems
      .map((item) => ({
        tenderId,
        itemNo: item.itemNo ?? null,
        description: item.description,
        quantity: decimalOrNull(item.quantity),
        unit: item.unit ?? null,
        rate: decimalOrNull(item.rate),
        total: decimalOrNull(item.total),
        payload: {
          ...(item.payload ?? {}),
          ...(item.id ? { sourceId: item.id } : {})
        } as Prisma.InputJsonObject
      }))
      .filter((item) => item.description.trim());
    if (rows.length) await tx.tenderCommercialItem.createMany({ data: rows });
  }
}

function decimalOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function tenderUpdateInput(input: UpdateTenderInput): Prisma.TenderUpdateInput {
  const method = input.metadata !== undefined ? tenderMethodFromMetadata(input.metadata) : undefined;
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(method !== undefined ? { method } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.closingDate !== undefined ? { closingDate: tenderDateInput(input.closingDate) } : {}),
    ...(input.requirements !== undefined ? { requirements: input.requirements as Prisma.InputJsonObject } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonObject } : {})
  };
}

function tenderMethodFromMetadata(metadata: Record<string, unknown> | undefined): ProcurementMethod | undefined {
  const rawMethod = typeof metadata?.method === 'string' ? metadata.method : '';
  const normalized = rawMethod.trim().replace(/[\s-]+/g, '_').toUpperCase();
  if (normalized === 'INVITED_TENDER') return ProcurementMethod.INVITED_TENDER;
  if (normalized === 'OPEN_TENDER') return ProcurementMethod.OPEN_TENDER;
  return undefined;
}

function isEditableTenderStatus(status: TenderStatus) {
  return status === TenderStatus.DRAFT || status === TenderStatus.REVIEW;
}

function isBuyerNoticeEditableStatus(status: TenderStatus) {
  return status !== TenderStatus.CANCELLED;
}

function generateTenderReference(type: TenderType) {
  const prefix = type === TenderType.WORKS ? 'WRK' : type === TenderType.SERVICE ? 'SVC' : type === TenderType.CONSULTANCY ? 'CNS' : 'GDS';
  const year = new Date().getUTCFullYear();
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `PX-${prefix}-${year}-${stamp}-${suffix}`;
}

function generateAmendmentReference(tenderReference: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `${tenderReference}-AMD-${stamp}-${suffix}`;
}

function tenderDateInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`);
  return new Date(value);
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}

function dateInput(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function marketplaceOpeningDate(metadata: unknown) {
  const publication = objectPayload(objectPayload(metadata).publication);
  const value = stringPayload(publication.openingDate);
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value.slice(0, 10);
}

function hasReachedOpeningDate(metadata: unknown, now = Date.now()) {
  const openingDate = marketplaceOpeningDate(metadata);
  if (!openingDate) return true;
  const openingTime = Date.parse(`${openingDate}T00:00:00.000`);
  return !Number.isFinite(openingTime) || openingTime <= now;
}

function decimalToNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function decimalToNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function adminReviewPayload(metadata: unknown) {
  return objectPayload(objectPayload(metadata).adminReview);
}

function pendingReviewMetadata(metadata: unknown, input: { submittedAt: Date; submittedByUserId: string }) {
  const base = objectPayload(metadata);
  const currentReview = adminReviewPayload(metadata);
  const attempts = (numberPayload(currentReview.attempts) ?? 0) + 1;
  return {
    ...base,
    adminReview: {
      ...currentReview,
      status: 'PENDING',
      submittedAt: input.submittedAt.toISOString(),
      submittedByUserId: input.submittedByUserId,
      attempts,
      updatedAt: input.submittedAt.toISOString()
    }
  };
}

function passedReviewMetadata(metadata: unknown, input: { decidedAt: Date; adminUserId: string }) {
  const base = objectPayload(metadata);
  const currentReview = adminReviewPayload(metadata);
  return {
    ...base,
    adminReview: {
      ...currentReview,
      status: 'PASSED',
      passedAt: input.decidedAt.toISOString(),
      decidedByUserId: input.adminUserId,
      updatedAt: input.decidedAt.toISOString()
    }
  };
}

function failedReviewMetadata(metadata: unknown, input: { decidedAt: Date; adminUserId: string; messageId: string }) {
  const base = objectPayload(metadata);
  const currentReview = adminReviewPayload(metadata);
  return {
    ...base,
    adminReview: {
      ...currentReview,
      status: 'FAILED',
      failedAt: input.decidedAt.toISOString(),
      decidedByUserId: input.adminUserId,
      messageId: input.messageId,
      updatedAt: input.decidedAt.toISOString()
    }
  };
}

function reviewSubmittedAt(metadata: unknown, fallbackDate: Date) {
  const submittedAt = stringPayload(adminReviewPayload(metadata).submittedAt);
  return submittedAt ?? fallbackDate.toISOString();
}

function numberPayload(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringPayload(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function viewTenderRoute(tenderId: string) {
  return `/procurement/tender-details?tenderId=${encodeURIComponent(tenderId)}`;
}

function amendTenderRoute(tenderId: string) {
  return `/procurement/create-tender?tenderId=${encodeURIComponent(tenderId)}`;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, typeof item === 'string' ? item : String(item ?? '')])
  );
}
