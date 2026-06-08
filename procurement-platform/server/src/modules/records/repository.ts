import {
  BidStatus,
  CommunicationStatus,
  ComplianceCaseStatus,
  ContractStatus,
  DocumentReviewStatus,
  EvaluationStatus,
  RecommendationStatus,
  TenderStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { ChartPointDto, ProcurementRecordDto, ProcurementRecordType, RecordsQuery } from './types.js';

type RepositoryRecord = Omit<ProcurementRecordDto, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
  durationDays?: number | null;
};

const maxSourceRows = 2000;

const tenderStatuses = Object.values(TenderStatus);
const bidStatuses = Object.values(BidStatus);
const evaluationStatuses = Object.values(EvaluationStatus);
const recommendationStatuses = Object.values(RecommendationStatus);
const contractStatuses = Object.values(ContractStatus);
const documentStatuses = Object.values(DocumentReviewStatus);
const communicationStatuses = Object.values(CommunicationStatus);
const complianceStatuses = Object.values(ComplianceCaseStatus);

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async getDashboardData() {
    const [
      tenderRecords,
      bidRecords,
      contractRecords,
      evidenceFiles,
      evaluationRecords,
      awardRecords,
      communicationRecords,
      complianceRecords,
      archiveRecords,
      tenderValue,
      bidValue,
      contractValue,
      awardValue
    ] = await Promise.all([
      this.db.tender.count(),
      this.db.bid.count(),
      this.db.contract.count(),
      this.db.documentObject.count(),
      this.db.evaluationWorkspace.count(),
      this.db.awardRecommendation.count(),
      this.db.communicationItem.count(),
      this.db.complianceCase.count(),
      this.db.recordEntry.count(),
      this.db.tender.aggregate({ _sum: { budget: true } }),
      this.db.bid.aggregate({ _sum: { totalAmount: true } }),
      this.db.contract.aggregate({ _sum: { amount: true } }),
      this.db.awardRecommendation.aggregate({ _sum: { amount: true } })
    ]);

    return {
      tenderRecords,
      bidRecords,
      contractRecords,
      evidenceFiles,
      recordedValue:
        decimalToNumber(tenderValue._sum.budget) +
        decimalToNumber(bidValue._sum.totalAmount) +
        decimalToNumber(contractValue._sum.amount) +
        decimalToNumber(awardValue._sum.amount),
      currency: 'TZS',
      totalRecords:
        tenderRecords +
        bidRecords +
        contractRecords +
        evidenceFiles +
        evaluationRecords +
        awardRecords +
        communicationRecords +
        complianceRecords +
        archiveRecords
    };
  }

  async listRecords(query: RecordsQuery) {
    const records = sortRecords(await this.collectRecords(query), query);
    const start = (query.page - 1) * query.pageSize;
    const pageRecords = records.slice(start, start + query.pageSize);

    return {
      records: pageRecords,
      totalRecords: records.length,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(records.length / query.pageSize))
    };
  }

  async listAllRecords(query: RecordsQuery) {
    return sortRecords(await this.collectRecords(query), query);
  }

  async getCharts(query: RecordsQuery) {
    const records = await this.collectRecords(query);
    const categories = unique(records.map((record) => record.category).filter(Boolean) as string[]);

    if (records.length === 0) {
      return {
        tendersByStatus: [],
        procurementRecordsByMonth: [],
        contractValueByCategory: [],
        supplierParticipation: [],
        awardVsCancellationTrend: [],
        complianceCompletionSummary: [],
        categories
      };
    }

    const awardTrend = groupAwardsAndCancellations(records);

    return {
      tendersByStatus: groupCount(records.filter((record) => record.recordType === 'TENDER'), (record) => record.status),
      procurementRecordsByMonth: groupCount(records, (record) => monthLabel(record.createdAt)),
      contractValueByCategory: groupAmount(
        records.filter((record) => record.recordType === 'CONTRACT' && record.valueAmount !== null),
        (record) => record.category ?? 'Uncategorized'
      ),
      supplierParticipation: groupCount(
        records.filter((record) => record.supplierName),
        (record) => record.supplierName ?? 'Not recorded'
      ),
      awardVsCancellationTrend: awardTrend,
      complianceCompletionSummary: groupCompliance(records),
      categories
    };
  }

  async getInsights(query: RecordsQuery) {
    const records = await this.collectRecords(query);
    const categoryCounts = groupCount(
      records.filter((record) => record.category),
      (record) => record.category ?? 'Uncategorized'
    );
    const supplierCounts = groupCount(
      records.filter((record) => record.supplierName),
      (record) => record.supplierName ?? 'Not recorded'
    );
    const valueRecords = records
      .filter((record) => typeof record.valueAmount === 'number' && record.valueAmount > 0)
      .sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0));
    const tenderDurations = records
      .filter((record) => record.recordType === 'TENDER' && Number.isFinite(record.durationDays))
      .map((record) => Number(record.durationDays));
    const awardCount = records.filter((record) => record.recordType === 'AWARD' && ['RECOMMENDED', 'APPROVED', 'AWARDED'].includes(record.status)).length;
    const cancellationCount = records.filter((record) => record.status === 'CANCELLED').length;
    const complianceRecords = records.filter((record) => record.recordType === 'COMPLIANCE' || record.recordType === 'DOCUMENT');
    const completedCompliance = complianceRecords.filter((record) => isComplianceComplete(record.status)).length;

    return {
      mostActiveCategory: categoryCounts[0]?.label ?? null,
      highestValueRecord: valueRecords[0]
        ? {
            title: valueRecords[0].title,
            referenceNumber: valueRecords[0].referenceNumber,
            valueAmount: valueRecords[0].valueAmount ?? 0,
            currency: valueRecords[0].currency
          }
        : null,
      bestSupplierParticipation: supplierCounts[0]
        ? {
            supplierName: supplierCounts[0].label,
            recordCount: supplierCounts[0].value
          }
        : null,
      complianceCompletion: complianceRecords.length ? Math.round((completedCompliance / complianceRecords.length) * 100) : 0,
      awardSuccessRate: awardCount + cancellationCount ? Math.round((awardCount / (awardCount + cancellationCount)) * 100) : 0,
      averageTenderDuration: tenderDurations.length
        ? Math.round(tenderDurations.reduce((sum, duration) => sum + duration, 0) / tenderDurations.length)
        : null
    };
  }

  private async collectRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    const batches = await Promise.all([
      this.listTenderRecords(query),
      this.listBidRecords(query),
      this.listEvaluationRecords(query),
      this.listAwardRecords(query),
      this.listContractRecords(query),
      this.listDocumentRecords(query),
      this.listCommunicationRecords(query),
      this.listComplianceRecords(query),
      this.listArchiveRecords(query)
    ]);

    return batches.flat().filter((record) => matchesCrossFilters(record, query));
  }

  private async listTenderRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'TENDER') || !statusMatches(query, tenderStatuses)) return [];

    const where: Prisma.TenderWhereInput = {
      ...dateWhere(query),
      ...searchWhere(query, [
        { title: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { categories: { some: { name: { contains: query.search, mode: 'insensitive' } } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as TenderStatus } : {}),
      ...(query.category ? { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } : {})
    };

    const tenders = await this.db.tender.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        buyerOrg: { select: { name: true } },
        categories: { select: { name: true }, take: 1 },
        documents: {
          select: {
            label: true,
            document: { select: { name: true } }
          }
        }
      }
    });

    return tenders.map((tender) => {
      const start = tender.publishedAt ?? tender.createdAt;
      const durationDays = tender.closingDate ? daysBetween(start, tender.closingDate) : null;

      return {
        id: `tender:${tender.id}`,
        recordType: 'TENDER',
        sourceModule: 'procurement',
        sourceId: tender.id,
        title: tender.title,
        referenceNumber: tender.reference,
        status: tender.status,
        valueAmount: nullableDecimalToNumber(tender.budget),
        currency: tender.currency,
        category: tender.categories[0]?.name ?? null,
        procurementType: tender.type,
        buyerName: tender.buyerOrg.name,
        supplierName: null,
        tenderId: tender.id,
        bidId: null,
        contractId: null,
        evidenceCount: tender.documents.length,
        evidence: evidenceLabels(tender.documents.map((item) => item.label ?? item.document.name)),
        createdAt: tender.createdAt,
        updatedAt: tender.updatedAt,
        durationDays
      };
    });
  }

  private async listBidRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'BID') || !statusMatches(query, bidStatuses)) return [];

    const where: Prisma.BidWhereInput = {
      ...dateWhere(query),
      ...searchWhere(query, [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { tender: { title: { contains: query.search, mode: 'insensitive' } } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as BidStatus } : {}),
      ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
    };

    const bids = await this.db.bid.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        buyerOrg: { select: { name: true } },
        supplierOrg: { select: { name: true } },
        tender: {
          select: {
            id: true,
            reference: true,
            title: true,
            type: true,
            categories: { select: { name: true }, take: 1 }
          }
        },
        documents: {
          select: {
            document: { select: { name: true } }
          }
        }
      }
    });

    return bids.map((bid) => ({
      id: `bid:${bid.id}`,
      recordType: 'BID',
      sourceModule: 'bidding',
      sourceId: bid.id,
      title: `${bid.reference} - ${bid.tender.title}`,
      referenceNumber: bid.reference,
      status: bid.status,
      valueAmount: nullableDecimalToNumber(bid.totalAmount),
      currency: bid.currency,
      category: bid.tender.categories[0]?.name ?? null,
      procurementType: bid.tender.type,
      buyerName: bid.buyerOrg.name,
      supplierName: bid.supplierOrg.name,
      tenderId: bid.tender.id,
      bidId: bid.id,
      contractId: null,
      evidenceCount: bid.documents.length,
      evidence: evidenceLabels(bid.documents.map((item) => item.document.name)),
      createdAt: bid.createdAt,
      updatedAt: bid.updatedAt
    }));
  }

  private async listEvaluationRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'EVALUATION') || !statusMatches(query, evaluationStatuses)) return [];

    const where: Prisma.EvaluationWorkspaceWhereInput = {
      ...dateWhere(query),
      ...searchWhere(query, [
        { tender: { title: { contains: query.search, mode: 'insensitive' } } },
        { tender: { reference: { contains: query.search, mode: 'insensitive' } } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as EvaluationStatus } : {}),
      ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
    };

    const evaluations = await this.db.evaluationWorkspace.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        buyerOrg: { select: { name: true } },
        tender: {
          select: {
            id: true,
            reference: true,
            title: true,
            type: true,
            categories: { select: { name: true }, take: 1 }
          }
        },
        scores: { select: { id: true } }
      }
    });

    return evaluations.map((evaluation) => ({
      id: `evaluation:${evaluation.id}`,
      recordType: 'EVALUATION',
      sourceModule: 'evaluation',
      sourceId: evaluation.id,
      title: `Evaluation - ${evaluation.tender.title}`,
      referenceNumber: evaluation.tender.reference,
      status: evaluation.status,
      valueAmount: null,
      currency: 'TZS',
      category: evaluation.tender.categories[0]?.name ?? null,
      procurementType: evaluation.tender.type,
      buyerName: evaluation.buyerOrg.name,
      supplierName: null,
      tenderId: evaluation.tender.id,
      bidId: null,
      contractId: null,
      evidenceCount: evaluation.scores.length,
      evidence: [],
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt
    }));
  }

  private async listAwardRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'AWARD') || !statusMatches(query, recommendationStatuses)) return [];

    const where: Prisma.AwardRecommendationWhereInput = {
      ...dateWhere(query),
      ...searchWhere(query, [
        { workspace: { tender: { title: { contains: query.search, mode: 'insensitive' } } } },
        { workspace: { tender: { reference: { contains: query.search, mode: 'insensitive' } } } },
        { bid: { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as RecommendationStatus } : {}),
      ...(query.category ? { workspace: { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } } : {})
    };

    const awards = await this.db.awardRecommendation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        workspace: {
          select: {
            tender: {
              select: {
                id: true,
                reference: true,
                title: true,
                type: true,
                buyerOrg: { select: { name: true } },
                categories: { select: { name: true }, take: 1 }
              }
            }
          }
        },
        bid: {
          select: {
            id: true,
            supplierOrg: { select: { name: true } }
          }
        },
        approvals: { select: { id: true } }
      }
    });

    return awards.map((award) => ({
      id: `award:${award.id}`,
      recordType: 'AWARD',
      sourceModule: 'evaluation',
      sourceId: award.id,
      title: `Award recommendation - ${award.workspace.tender.title}`,
      referenceNumber: award.workspace.tender.reference,
      status: award.status,
      valueAmount: nullableDecimalToNumber(award.amount),
      currency: award.currency,
      category: award.workspace.tender.categories[0]?.name ?? null,
      procurementType: award.workspace.tender.type,
      buyerName: award.workspace.tender.buyerOrg.name,
      supplierName: award.bid?.supplierOrg.name ?? null,
      tenderId: award.workspace.tender.id,
      bidId: award.bid?.id ?? null,
      contractId: null,
      evidenceCount: award.approvals.length,
      evidence: [],
      createdAt: award.createdAt,
      updatedAt: award.createdAt
    }));
  }

  private async listContractRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'CONTRACT') || !statusMatches(query, contractStatuses)) return [];

    const where: Prisma.ContractWhereInput = {
      ...dateWhere(query),
      ...searchWhere(query, [
        { title: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as ContractStatus } : {}),
      ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
    };

    const contracts = await this.db.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        buyerOrg: { select: { name: true } },
        supplierOrg: { select: { name: true } },
        tender: {
          select: {
            id: true,
            reference: true,
            type: true,
            categories: { select: { name: true }, take: 1 }
          }
        },
        versions: {
          select: {
            document: { select: { name: true } }
          }
        }
      }
    });

    return contracts.map((contract) => ({
      id: `contract:${contract.id}`,
      recordType: 'CONTRACT',
      sourceModule: 'contract',
      sourceId: contract.id,
      title: contract.title,
      referenceNumber: contract.reference,
      status: contract.status,
      valueAmount: nullableDecimalToNumber(contract.amount),
      currency: contract.currency,
      category: contract.tender?.categories[0]?.name ?? null,
      procurementType: contract.tender?.type ?? null,
      buyerName: contract.buyerOrg.name,
      supplierName: contract.supplierOrg?.name ?? null,
      tenderId: contract.tender?.id ?? null,
      bidId: null,
      contractId: contract.id,
      evidenceCount: contract.versions.filter((version) => version.document).length,
      evidence: evidenceLabels(contract.versions.map((version) => version.document?.name).filter(Boolean) as string[]),
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt
    }));
  }

  private async listDocumentRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'DOCUMENT')) return [];
    if (query.status !== 'all' && !documentStatuses.includes(query.status as DocumentReviewStatus) && query.status !== 'UPLOADED') return [];
    if (query.category) return [];

    const documents = await this.db.documentObject.findMany({
      where: {
        ...dateWhere(query),
        ...searchWhere(query, [
          { name: { contains: query.search, mode: 'insensitive' } },
          { documentType: { contains: query.search, mode: 'insensitive' } }
        ])
      },
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        ownerOrg: { select: { name: true } }
      }
    });

    return documents.map((document) => ({
      id: `document:${document.id}`,
      recordType: 'DOCUMENT',
      sourceModule: 'documents',
      sourceId: document.id,
      title: document.name,
      referenceNumber: document.id,
      status: 'UPLOADED',
      valueAmount: null,
      currency: 'TZS',
      category: document.documentType,
      procurementType: null,
      buyerName: document.ownerOrg?.name ?? null,
      supplierName: null,
      tenderId: null,
      bidId: null,
      contractId: null,
      evidenceCount: 1,
      evidence: [document.name],
      createdAt: document.createdAt,
      updatedAt: document.createdAt
    }));
  }

  private async listCommunicationRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'COMMUNICATION') || !statusMatches(query, communicationStatuses)) return [];
    if (query.category) return [];

    const where: Prisma.CommunicationItemWhereInput = {
      ...dateWhere(query),
      ...searchWhere(query, [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { senderOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { recipientOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { tender: { title: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as CommunicationStatus } : {})
    };

    const communications = await this.db.communicationItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        ownerOrg: { select: { name: true } },
        senderOrg: { select: { name: true } },
        recipientOrg: { select: { name: true } },
        tender: {
          select: {
            id: true,
            reference: true,
            type: true,
            categories: { select: { name: true }, take: 1 }
          }
        },
        attachments: {
          select: {
            document: { select: { name: true } }
          }
        }
      }
    });

    return communications.map((item) => ({
      id: `communication:${item.id}`,
      recordType: 'COMMUNICATION',
      sourceModule: 'communication',
      sourceId: item.id,
      title: item.subject,
      referenceNumber: item.tender?.reference ?? item.id,
      status: item.status,
      valueAmount: null,
      currency: 'TZS',
      category: item.tender?.categories[0]?.name ?? item.category,
      procurementType: item.tender?.type ?? null,
      buyerName: item.ownerOrg?.name ?? item.recipientOrg?.name ?? null,
      supplierName: item.senderOrg?.name ?? null,
      tenderId: item.tender?.id ?? null,
      bidId: null,
      contractId: null,
      evidenceCount: item.attachments.length,
      evidence: evidenceLabels(item.attachments.map((attachment) => attachment.document.name)),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  private async listComplianceRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'COMPLIANCE') || !statusMatches(query, complianceStatuses)) return [];
    if (query.category) return [];

    const cases = await this.db.complianceCase.findMany({
      where: {
        ...dateWhere(query),
        ...searchWhere(query, [{ title: { contains: query.search, mode: 'insensitive' } }]),
        ...(query.status !== 'all' ? { status: query.status as ComplianceCaseStatus } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        ownerOrg: { select: { name: true } }
      }
    });

    return cases.map((item) => ({
      id: `compliance:${item.id}`,
      recordType: 'COMPLIANCE',
      sourceModule: 'compliance',
      sourceId: item.id,
      title: item.title,
      referenceNumber: item.id,
      status: item.status,
      valueAmount: null,
      currency: 'TZS',
      category: null,
      procurementType: null,
      buyerName: item.ownerOrg?.name ?? null,
      supplierName: null,
      tenderId: null,
      bidId: null,
      contractId: null,
      evidenceCount: 0,
      evidence: [],
      createdAt: item.createdAt,
      updatedAt: item.createdAt
    }));
  }

  private async listArchiveRecords(query: RecordsQuery): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'ARCHIVE')) return [];
    if (query.category) return [];

    const entries = await this.db.recordEntry.findMany({
      where: {
        ...dateWhere(query),
        ...searchWhere(query, [
          { title: { contains: query.search, mode: 'insensitive' } },
          { entityType: { contains: query.search, mode: 'insensitive' } },
          { entityRef: { contains: query.search, mode: 'insensitive' } }
        ])
      },
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows
    });

    return entries.map((entry) => ({
      id: `archive:${entry.id}`,
      recordType: 'ARCHIVE',
      sourceModule: 'records',
      sourceId: entry.id,
      title: entry.title,
      referenceNumber: entry.entityRef,
      status: 'ARCHIVED',
      valueAmount: null,
      currency: 'TZS',
      category: entry.entityType,
      procurementType: null,
      buyerName: null,
      supplierName: null,
      tenderId: null,
      bidId: null,
      contractId: null,
      evidenceCount: 0,
      evidence: [],
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt
    }));
  }
}

function typeMatches(query: RecordsQuery, type: ProcurementRecordType) {
  return query.recordType === 'all' || query.recordType === type;
}

function statusMatches(query: RecordsQuery, allowedStatuses: string[]) {
  return query.status === 'all' || allowedStatuses.includes(query.status);
}

function dateWhere(query: RecordsQuery) {
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.startDate) createdAt.gte = new Date(`${query.startDate}T00:00:00.000Z`);
  if (query.endDate) createdAt.lte = new Date(`${query.endDate}T23:59:59.999Z`);
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

function searchWhere<T>(query: RecordsQuery, conditions: T[]) {
  return query.search ? { OR: conditions } : {};
}

function matchesCrossFilters(record: RepositoryRecord, query: RecordsQuery) {
  if (!typeMatches(query, record.recordType)) return false;
  if (query.status !== 'all' && record.status !== query.status) return false;
  if (query.category && record.category?.toLowerCase() !== query.category.toLowerCase()) return false;
  if (query.startDate && record.createdAt < new Date(`${query.startDate}T00:00:00.000Z`)) return false;
  if (query.endDate && record.createdAt > new Date(`${query.endDate}T23:59:59.999Z`)) return false;
  if (!query.search) return true;

  const haystack = [
    record.title,
    record.referenceNumber,
    record.recordType,
    record.status,
    record.category,
    record.procurementType,
    record.buyerName,
    record.supplierName,
    ...record.evidence
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.search.toLowerCase());
}

function sortRecords(records: RepositoryRecord[], query: RecordsQuery) {
  const direction = query.sortDirection === 'asc' ? 1 : -1;

  return [...records].sort((a, b) => {
    const aValue = sortValue(a, query.sortBy);
    const bValue = sortValue(b, query.sortBy);

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function sortValue(record: RepositoryRecord, field: RecordsQuery['sortBy']) {
  if (field === 'date') return record.createdAt.getTime();
  if (field === 'title') return record.title.toLowerCase();
  if (field === 'type') return record.recordType;
  if (field === 'status') return record.status;
  return record.valueAmount ?? 0;
}

function decimalToNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableDecimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function evidenceLabels(values: string[]) {
  return values.filter(Boolean).slice(0, 4);
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function monthLabel(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function groupCount<T>(items: T[], getLabel: (item: T) => string): ChartPointDto[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const label = getLabel(item);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function groupAmount(items: RepositoryRecord[], getLabel: (item: RepositoryRecord) => string): ChartPointDto[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const label = getLabel(item);
    map.set(label, (map.get(label) ?? 0) + (item.valueAmount ?? 0));
  }
  return Array.from(map, ([label, amount]) => ({ label, value: amount, amount, currency: 'TZS' })).sort(
    (a, b) => (b.amount ?? 0) - (a.amount ?? 0) || a.label.localeCompare(b.label)
  );
}

function groupAwardsAndCancellations(records: RepositoryRecord[]): ChartPointDto[] {
  const months = unique(records.map((record) => monthLabel(record.createdAt)));

  return months
    .map((label) => ({
      label,
      value: records.filter((record) => monthLabel(record.createdAt) === label && record.recordType === 'AWARD').length,
      secondaryValue: records.filter((record) => monthLabel(record.createdAt) === label && record.status === 'CANCELLED').length
    }))
    .filter((row) => row.value > 0 || Number(row.secondaryValue) > 0);
}

function groupCompliance(records: RepositoryRecord[]): ChartPointDto[] {
  const complianceRecords = records.filter((record) => record.recordType === 'COMPLIANCE' || record.recordType === 'DOCUMENT');
  if (complianceRecords.length === 0) return [];

  const completed = complianceRecords.filter((record) => isComplianceComplete(record.status)).length;

  return [
    { label: 'Completed evidence', value: completed },
    { label: 'Pending or not applicable', value: complianceRecords.length - completed }
  ];
}

function isComplianceComplete(status: string) {
  return ['APPROVED', 'VERIFIED', 'RESOLVED', 'COMPLETED', 'CLOSED'].includes(status);
}

