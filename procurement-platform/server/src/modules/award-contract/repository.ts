import {
  ApprovalStatus,
  AuditSeverity,
  AwardNoticeStatus,
  AwardResponseAction,
  BidStatus,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractStatus,
  RecommendationStatus,
  SignatureStatus,
  TenderStatus,
  WorkflowAssignmentType,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import type {
  AwardContractRequestContext,
  AwardDecisionInput,
  AwardNoticeResponseInput,
  AwardRecommendationDetailDto,
  AwardRecommendationListItemDto,
  AwardRecommendationQuery,
  ContractDetailDto,
  ContractListItemDto,
  ContractMilestoneEvidenceInput,
  ContractMilestoneInput,
  ContractMilestonePatchInput,
  ContractQuery,
  ContractSignatureRequestInput,
  ContractSignatureSignInput,
  ContractStatusPatchInput,
  ContractVersionInput,
  ListAwardRecommendationsResponseDto,
  ListContractsResponseDto
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

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

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

function signatureSecret() {
  return process.env.SIGNATURE_HASH_SECRET || (process.env.NODE_ENV === 'test' ? 'vitest-signature-secret' : 'local-development-signature-secret');
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

function contractDetailDto(record: ContractRecord, audit: Array<{ event: string; actorUserId: string | null; createdAt: Date }> = []): ContractDetailDto {
  return {
    ...contractListDto(record),
    awardId: record.awardId,
    noticeId: record.awardNotice?.id ?? null,
    payload: objectPayload(record.payload),
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
    const audit = await this.db.auditEvent.findMany({
      where: {
        OR: [
          { entityType: 'award_recommendation', entityRef: record.id },
          ...(record.notice ? [{ entityType: 'award_notice', entityRef: record.notice.id }] : []),
          ...(contractId ? [{ entityType: 'contract', entityRef: contractId }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return {
      ...listRecommendationDto(record),
      reason: record.reason ?? '',
      notice: record.notice ? noticeDto(record.notice) : null,
      contract,
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

  async approveRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    await this.db.$transaction(async (tx) => {
      const recommendation = await tx.awardRecommendation.findUnique({
        where: { id },
        include: recommendationInclude
      });
      if (!recommendation) throw requestError('Award recommendation was not found.', 404);
      assertBuyerAccess(recommendation, context);
      if (!recommendation.supplierOrgId || !recommendation.bidId) throw requestError('Award recommendation must reference a supplier bid.', 409);

      await this.upsertApprovalStep(tx, recommendation.id, context.userId, ApprovalStatus.APPROVED, 'approved', input.note);
      await tx.awardRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: RecommendationStatus.APPROVED,
          reason: input.note || recommendation.reason
        }
      });
      await tx.awardNotice.upsert({
        where: { recommendationId: recommendation.id },
        update: {
          status: AwardNoticeStatus.PENDING_RESPONSE,
          buyerNote: input.note || null,
          issuedByUserId: context.userId ?? null,
          respondedByUserId: null,
          respondedAt: null
        },
        create: {
          recommendationId: recommendation.id,
          buyerOrgId: recommendation.workspace.buyerOrgId,
          supplierOrgId: recommendation.supplierOrgId,
          buyerNote: input.note || null,
          issuedByUserId: context.userId ?? null,
          payload: {
            tenderId: recommendation.workspace.tenderId,
            bidId: recommendation.bidId
          } as Prisma.InputJsonObject
        }
      });
      await tx.tender.update({ where: { id: recommendation.workspace.tenderId }, data: { status: TenderStatus.AWARDED } });
      await tx.bid.update({ where: { id: recommendation.bidId }, data: { status: BidStatus.AWARDED } });
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.recommendation.approved', 'award_recommendation', recommendation.id, { note: input.note });
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
      await this.audit(tx, recommendation.workspace.buyerOrgId, context.userId, 'award.recommendation.returned', 'award_recommendation', recommendation.id, { note: input.note });
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

  async getContract(id: string, context: AwardContractRequestContext): Promise<ContractDetailDto | null> {
    const record = await this.db.contract.findFirst({
      where: andWhere([{ id }, contractScope(context)]),
      include: contractInclude
    });
    if (!record) return null;
    const audit = await this.db.auditEvent.findMany({
      where: { entityType: 'contract', entityRef: record.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return contractDetailDto(record, audit);
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
      const signatureHash = createHmac('sha256', signatureSecret()).update(`${canonicalPayloadHash}:${signature.id}:${context.userId ?? ''}`).digest('hex');

      await tx.contractSignature.update({
        where: { id: signature.id },
        data: {
          status: SignatureStatus.SIGNED,
          signerUserId: context.userId ?? null,
          signerName: input.signerName,
          signerTitle: input.signerTitle || null,
          canonicalPayloadHash,
          signatureHash,
          signedAt,
          declinedAt: null,
          payload: input.payload as Prisma.InputJsonObject,
          providerMetadata: { provider: 'procurex-contract-signature-v1' } as Prisma.InputJsonObject
        }
      });

      const pending = await tx.contractSignature.count({
        where: {
          contractId,
          status: { not: SignatureStatus.SIGNED }
        }
      });
      if (pending === 0) await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.ACTIVE } });
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
      const contract = await tx.contract.findUnique({ where: { id: contractId } });
      if (!contract) throw requestError('Contract was not found.', 404);
      assertContractVisible(contract, context);
      assertContractManager(contract, context);
      this.assertStatusTransition(contract.status, input.status);
      await tx.contract.update({ where: { id: contract.id }, data: { status: input.status } });
      await this.audit(tx, contract.buyerOrgId, context.userId, 'contract.status.updated', 'contract', contract.id, {
        from: contract.status,
        to: input.status,
        note: input.note
      });
    });
    return this.getContract(contractId, context);
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
    return tx.contract.create({
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
          bidId: notice.recommendation.bidId
        } as Prisma.InputJsonObject
      }
    });
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
    if (to === ContractStatus.TERMINATED && from !== ContractStatus.COMPLETED) return;
    const allowed: Record<ContractStatus, ContractStatus[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.NEGOTIATION],
      [ContractStatus.NEGOTIATION]: [ContractStatus.SIGNATURE_PENDING],
      [ContractStatus.SIGNATURE_PENDING]: [ContractStatus.ACTIVE],
      [ContractStatus.ACTIVE]: [ContractStatus.COMPLETED],
      [ContractStatus.COMPLETED]: [],
      [ContractStatus.TERMINATED]: []
    };
    if (!allowed[from].includes(to)) throw requestError(`Invalid contract status transition from ${from} to ${to}.`, 409);
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
  }
}
