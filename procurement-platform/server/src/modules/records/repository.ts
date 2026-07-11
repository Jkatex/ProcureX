import {
  BidStatus,
  CommunicationStatus,
  ComplianceCaseStatus,
  ContractStatus,
  EvaluationStatus,
  RecommendationStatus,
  TenderAmendmentStatus,
  TenderStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  ChartPointDto,
  ProcurementRecordDto,
  ProcurementRecordType,
  RecordsAuditDto,
  RecordsDetailDto,
  RecordsDocumentDto,
  RecordsLifecycleStageDto,
  RecordsQuery,
  RecordsRequestContext
} from './types.js';

type RepositoryRecord = Omit<ProcurementRecordDto, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
  durationDays?: number | null;
  documentNames?: string[];
};

const maxSourceRows = 2000;

const tenderStatuses = Object.values(TenderStatus);
const bidStatuses = Object.values(BidStatus);
const evaluationStatuses = Object.values(EvaluationStatus);
const recommendationStatuses = Object.values(RecommendationStatus);
const contractStatuses = Object.values(ContractStatus);
const communicationStatuses = Object.values(CommunicationStatus);
const complianceStatuses = Object.values(ComplianceCaseStatus);
const amendmentStatuses = Object.values(TenderAmendmentStatus);

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async getDashboardData(context?: RecordsRequestContext) {
    const records = await this.collectRecords(baseRecordsQuery(), context);
    const tenderRecords = records.filter((record) => record.recordType === 'TENDER').length;
    const bidRecords = records.filter((record) => record.recordType === 'BID').length;
    const contractRecords = records.filter((record) => record.recordType === 'CONTRACT').length;
    const activeContracts = records.filter((record) => record.recordType === 'CONTRACT' && record.status === ContractStatus.ACTIVE).length;
    const evaluationRecords = records.filter((record) => record.recordType === 'REPORT').length;
    const awardRecords = records.filter((record) => record.recordType === 'AWARD').length;
    const archivedRecords = records.filter((record) => record.status === 'ARCHIVED').length;

    return {
      tenderRecords,
      bidRecords,
      evaluationRecords,
      awardRecords,
      contractRecords,
      activeContracts,
      evidenceFiles: records.reduce((sum, record) => sum + record.evidenceCount, 0),
      archivedRecords,
      recordedValue: dedupedRecordedValue(records),
      currency: 'TZS',
      totalRecords: records.length
    };
  }

  async listRecords(query: RecordsQuery, context?: RecordsRequestContext) {
    const records = sortRecords(await this.collectRecords(query, context), query);
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

  async listAllRecords(query: RecordsQuery, context?: RecordsRequestContext) {
    return sortRecords(await this.collectRecords(query, context), query);
  }

  async getCharts(query: RecordsQuery, context?: RecordsRequestContext) {
    const records = await this.collectRecords(query, context);
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

  async getInsights(query: RecordsQuery, context?: RecordsRequestContext) {
    const records = await this.collectRecords(query, context);
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
    const complianceRecords = records.filter((record) => record.recordType === 'COMPLIANCE');
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

  async getRecordDetail(recordId: string, context?: RecordsRequestContext): Promise<(Omit<RecordsDetailDto, 'record'> & { record: RepositoryRecord }) | null> {
    const record = await this.findRecord(recordId, context);
    if (!record) return null;
    const [lifecycle, documents, audit] = await Promise.all([
      this.getLifecycle(recordId, context),
      this.getRecordDocuments(recordId, context),
      this.getRecordAudit(recordId, context)
    ]);
    return { record, lifecycle, documents, audit };
  }

  async getLifecycle(recordId: string, context?: RecordsRequestContext): Promise<RecordsLifecycleStageDto[]> {
    const record = await this.findRecord(recordId, context);
    if (!record) return [];
    const all = await this.collectRecords(baseRecordsQuery(), context);
    const related = all.filter((item) => {
      if (record.tenderId && item.tenderId === record.tenderId) return true;
      if (record.bidId && item.bidId === record.bidId) return true;
      if (record.contractId && item.contractId === record.contractId) return true;
      return item.id === record.id;
    });
    return buildLifecycleStages(record, related);
  }

  async listDocuments(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsDocumentDto[]> {
    const records = await this.collectRecords(query, context);
    return records.flatMap((record) => (record.documentNames ?? []).map((name, index) => recordDocument(record, name, index)));
  }

  async getRecordDocuments(recordId: string, context?: RecordsRequestContext): Promise<RecordsDocumentDto[]> {
    const record = await this.findRecord(recordId, context);
    if (!record) return [];
    return (record.documentNames ?? []).map((name, index) => recordDocument(record, name, index));
  }

  async listAuditEvents(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsAuditDto[]> {
    const organizationId = scopedOrganizationId(context);
    const where: Prisma.AuditEventWhereInput = andWhere([
      auditScope(organizationId),
      dateWhere(query),
      searchWhere<Prisma.AuditEventWhereInput>(query, [
        { event: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { entityRef: { contains: query.search, mode: 'insensitive' } }
      ])
    ]);
    const events = await this.db.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.pageSize
    });
    return events.map(auditDto);
  }

  async getRecordAudit(recordId: string, context?: RecordsRequestContext): Promise<RecordsAuditDto[]> {
    const record = await this.findRecord(recordId, context);
    if (!record) return [];
    const refs = [record.sourceId, record.referenceNumber, record.tenderId, record.bidId, record.contractId].filter(Boolean) as string[];
    const events = await this.db.auditEvent.findMany({
      where: andWhere([
        auditScope(scopedOrganizationId(context)),
        refs.length ? { OR: refs.map((ref) => ({ entityRef: ref })) } : {}
      ]),
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return events.map(auditDto);
  }

  private async findRecord(recordId: string, context?: RecordsRequestContext) {
    return (await this.collectRecords(baseRecordsQuery(), context)).find((record) => record.id === recordId) ?? null;
  }

  private async collectRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    const batches = await Promise.all([
      this.listTenderRecords(query, context),
      this.listAmendmentRecords(query, context),
      this.listBidRecords(query, context),
      this.listEvaluationRecords(query, context),
      this.listAwardRecords(query, context),
      this.listContractRecords(query, context),
      this.listCommunicationRecords(query, context),
      this.listComplianceRecords(query, context)
    ]);

    return batches.flat().filter((record) => matchesCrossFilters(record, query));
  }

  private async listTenderRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'TENDER') || !statusMatches(query, tenderStatuses)) return [];

    const where: Prisma.TenderWhereInput = andWhere([
      tenderScope(scopedOrganizationId(context)),
      {
      ...dateWhere(query),
      ...searchWhere(query, [
        { title: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { categories: { some: { name: { contains: query.search, mode: 'insensitive' } } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as TenderStatus } : {}),
      ...(query.category ? { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } : {})
      }
    ]);

    const tenders = await this.db.tender.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: maxSourceRows,
      include: {
        buyerOrg: { select: { name: true } },
        categories: { select: { name: true }, take: 1 },
        _count: { select: { bids: true, contracts: true, communications: true, amendments: true } },
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
        evidence: sectionEvidence([
          'Details',
          tender._count.bids > 0 ? 'Bids' : '',
          tender.status === TenderStatus.CLOSED ? 'Opening' : '',
          tender._count.amendments > 0 ? 'Clarification' : '',
          tender._count.contracts > 0 ? 'Contract' : '',
          tender._count.communications > 0 ? 'Clarification' : ''
        ]),
        documentNames: tender.documents.map((item) => item.label ?? item.document.name).filter(Boolean),
        createdAt: tender.createdAt,
        updatedAt: tender.updatedAt,
        durationDays
      };
    });
  }

  private async listAmendmentRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'AMENDMENT') || !statusMatches(query, amendmentStatuses)) return [];

    const where: Prisma.TenderAmendmentWhereInput = andWhere([
      amendmentScope(scopedOrganizationId(context)),
      {
        ...dateWhere(query),
        ...searchWhere(query, [
          { reference: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } },
          { tender: { title: { contains: query.search, mode: 'insensitive' } } },
          { tender: { reference: { contains: query.search, mode: 'insensitive' } } },
          { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } }
        ]),
        ...(query.status !== 'all' ? { status: query.status as TenderAmendmentStatus } : {}),
        ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
      }
    ]);

    const amendments = await this.db.tenderAmendment.findMany({
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
        }
      }
    });

    return amendments.map((amendment) => ({
      id: `amendment:${amendment.id}`,
      recordType: 'AMENDMENT',
      sourceModule: 'procurement',
      sourceId: amendment.id,
      title: amendment.title || `Amendment - ${amendment.tender.title}`,
      referenceNumber: amendment.reference,
      status: amendment.status,
      valueAmount: null,
      currency: 'TZS',
      category: amendment.tender.categories[0]?.name ?? null,
      procurementType: amendment.tender.type,
      buyerName: amendment.buyerOrg.name,
      supplierName: null,
      tenderId: amendment.tender.id,
      bidId: null,
      contractId: null,
      evidenceCount: 1,
      evidence: sectionEvidence(['Clarification', 'Details']),
      documentNames: [],
      createdAt: amendment.publishedAt ?? amendment.createdAt,
      updatedAt: amendment.updatedAt
    }));
  }

  private async listBidRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'BID') || !statusMatches(query, bidStatuses)) return [];

    const where: Prisma.BidWhereInput = andWhere([
      bidScope(scopedOrganizationId(context)),
      {
      ...dateWhere(query),
      ...searchWhere(query, [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { tender: { title: { contains: query.search, mode: 'insensitive' } } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as BidStatus } : {}),
      ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
      }
    ]);

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
        receipt: { select: { receiptRef: true, createdAt: true } },
        versions: { select: { id: true } },
        documents: {
          select: {
            reviewStatus: true,
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
      evidence: sectionEvidence([
        'Details',
        bid.receipt ? 'Receipt' : '',
        bid.versions.length > 0 ? 'Bids' : '',
        bid.documents.length > 0 ? 'Compliance' : ''
      ]),
      documentNames: bid.documents.map((item) => item.document.name),
      createdAt: bid.submittedAt ?? bid.createdAt,
      updatedAt: bid.updatedAt
    }));
  }

  private async listEvaluationRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'REPORT') || !statusMatches(query, evaluationStatuses)) return [];

    const where: Prisma.EvaluationWorkspaceWhereInput = andWhere([
      evaluationScope(scopedOrganizationId(context)),
      {
      ...dateWhere(query),
      ...searchWhere(query, [
        { tender: { title: { contains: query.search, mode: 'insensitive' } } },
        { tender: { reference: { contains: query.search, mode: 'insensitive' } } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as EvaluationStatus } : {}),
      ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
      }
    ]);

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
      recordType: 'REPORT',
      sourceModule: 'evaluation',
      sourceId: evaluation.id,
      title: `Evaluation report - ${evaluation.tender.title}`,
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
      evidence: sectionEvidence(['Report', evaluation.scores.length > 0 ? 'Evaluation' : '']),
      documentNames: [],
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt
    }));
  }

  private async listAwardRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'AWARD') || !statusMatches(query, recommendationStatuses)) return [];

    const where: Prisma.AwardRecommendationWhereInput = andWhere([
      awardScope(scopedOrganizationId(context)),
      {
      ...dateWhere(query),
      ...searchWhere(query, [
        { workspace: { tender: { title: { contains: query.search, mode: 'insensitive' } } } },
        { workspace: { tender: { reference: { contains: query.search, mode: 'insensitive' } } } },
        { bid: { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as RecommendationStatus } : {}),
      ...(query.category ? { workspace: { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } } : {})
      }
    ]);

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
        approvals: { select: { id: true } },
        contracts: { select: { id: true } }
      }
    });

    return awards.map((award) => ({
      id: `award:${award.id}`,
      recordType: 'AWARD',
      sourceModule: 'evaluation',
      sourceId: award.id,
      title: `Award recommendation - ${award.workspace.tender.title}`,
      referenceNumber: award.reference,
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
      evidence: sectionEvidence(['Award', award.approvals.length > 0 ? 'Report' : '', award.contracts.length > 0 ? 'Contract' : '']),
      documentNames: [],
      createdAt: award.createdAt,
      updatedAt: award.createdAt
    }));
  }

  private async listContractRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'CONTRACT') || !statusMatches(query, contractStatuses)) return [];

    const where: Prisma.ContractWhereInput = andWhere([
      contractScope(scopedOrganizationId(context)),
      {
      ...dateWhere(query),
      ...searchWhere(query, [
        { title: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { supplierOrg: { name: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as ContractStatus } : {}),
      ...(query.category ? { tender: { categories: { some: { name: { equals: query.category, mode: 'insensitive' } } } } } : {})
      }
    ]);

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
      evidence: sectionEvidence(['Contract', contract.awardId ? 'Award' : '', contract.versions.some((version) => version.document) ? 'Details' : '']),
      documentNames: contract.versions.map((version) => version.document?.name).filter(Boolean) as string[],
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt
    }));
  }

  private async listCommunicationRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'CLARIFICATION') || !statusMatches(query, communicationStatuses)) return [];
    if (query.category) return [];

    const where: Prisma.CommunicationItemWhereInput = andWhere([
      communicationScope(scopedOrganizationId(context)),
      {
      ...dateWhere(query),
      ...searchWhere(query, [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { senderOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { recipientOrg: { name: { contains: query.search, mode: 'insensitive' } } },
        { tender: { title: { contains: query.search, mode: 'insensitive' } } }
      ]),
      ...(query.status !== 'all' ? { status: query.status as CommunicationStatus } : {})
      }
    ]);

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
      recordType: 'CLARIFICATION',
      sourceModule: 'communication',
      sourceId: item.id,
      title: item.subject,
      referenceNumber: item.tender?.reference ?? null,
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
      evidence: sectionEvidence(['Clarification', item.attachments.length > 0 ? 'Details' : '']),
      documentNames: item.attachments.map((attachment) => attachment.document.name),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  private async listComplianceRecords(query: RecordsQuery, context?: RecordsRequestContext): Promise<RepositoryRecord[]> {
    if (!typeMatches(query, 'COMPLIANCE') || !statusMatches(query, complianceStatuses)) return [];
    if (query.category) return [];

    const where: Prisma.ComplianceCaseWhereInput = andWhere([
      complianceScope(scopedOrganizationId(context)),
      {
        ...dateWhere(query),
        ...searchWhere<Prisma.ComplianceCaseWhereInput>(query, [{ title: { contains: query.search, mode: 'insensitive' } }]),
        ...(query.status !== 'all' ? { status: query.status as ComplianceCaseStatus } : {})
      }
    ]);

    const cases = await this.db.complianceCase.findMany({
      where,
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
      referenceNumber: null,
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
      evidence: sectionEvidence(['Compliance', 'Report']),
      documentNames: [],
      createdAt: item.createdAt,
      updatedAt: item.createdAt
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
  if (query.recordId && record.id !== query.recordId) return false;
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

function baseRecordsQuery(): RecordsQuery {
  return {
    search: '',
    recordId: undefined,
    recordType: 'all',
    status: 'all',
    category: '',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 100,
    sortBy: 'date',
    sortDirection: 'desc'
  };
}

function scopedOrganizationId(context?: RecordsRequestContext) {
  return context?.isAdmin ? '' : context?.organizationId ?? '';
}

function tenderScope(organizationId: string): Prisma.TenderWhereInput {
  return organizationId
    ? {
        OR: [
          { buyerOrgId: organizationId },
          { bids: { some: { supplierOrgId: organizationId } } },
          { contracts: { some: { supplierOrgId: organizationId } } },
          { savedBy: { some: { organizationId } } }
        ]
      }
    : {};
}

function bidScope(organizationId: string): Prisma.BidWhereInput {
  return organizationId ? { OR: [{ buyerOrgId: organizationId }, { supplierOrgId: organizationId }] } : {};
}

function evaluationScope(organizationId: string): Prisma.EvaluationWorkspaceWhereInput {
  return organizationId ? { buyerOrgId: organizationId } : {};
}

function amendmentScope(organizationId: string): Prisma.TenderAmendmentWhereInput {
  return organizationId
    ? {
        OR: [
          { buyerOrgId: organizationId },
          {
            AND: [
              { status: TenderAmendmentStatus.PUBLISHED },
              {
                tender: {
                  OR: [
                    { bids: { some: { supplierOrgId: organizationId } } },
                    { contracts: { some: { supplierOrgId: organizationId } } },
                    { savedBy: { some: { organizationId } } }
                  ]
                }
              }
            ]
          }
        ]
      }
    : {};
}

function awardScope(organizationId: string): Prisma.AwardRecommendationWhereInput {
  return organizationId ? { OR: [{ supplierOrgId: organizationId }, { workspace: { buyerOrgId: organizationId } }] } : {};
}

function contractScope(organizationId: string): Prisma.ContractWhereInput {
  return organizationId ? { OR: [{ buyerOrgId: organizationId }, { supplierOrgId: organizationId }] } : {};
}

function communicationScope(organizationId: string): Prisma.CommunicationItemWhereInput {
  return organizationId ? { OR: [{ ownerOrgId: organizationId }, { senderOrgId: organizationId }, { recipientOrgId: organizationId }] } : {};
}

function complianceScope(organizationId: string): Prisma.ComplianceCaseWhereInput {
  return organizationId ? { ownerOrgId: organizationId } : {};
}

function auditScope(organizationId: string): Prisma.AuditEventWhereInput {
  return organizationId ? { ownerOrgId: organizationId } : {};
}

function andWhere<T extends object>(filters: T[]): T {
  const active = filters.filter((filter) => Object.keys(filter).length > 0);
  if (active.length === 0) return {} as T;
  if (active.length === 1) return active[0];
  return { AND: active } as T;
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

function dedupedRecordedValue(records: RepositoryRecord[]) {
  const byChain = new Map<string, { priority: number; amount: number }>();
  const priorities: Partial<Record<ProcurementRecordType, number>> = {
    TENDER: 1,
    BID: 2,
    AWARD: 3,
    CONTRACT: 4
  };

  for (const record of records) {
    const amount = record.valueAmount ?? 0;
    const priority = priorities[record.recordType] ?? 0;
    if (!amount || !priority) continue;
    const chainKey = record.tenderId ?? record.bidId ?? record.contractId ?? record.id;
    const existing = byChain.get(chainKey);
    if (!existing || priority > existing.priority) byChain.set(chainKey, { priority, amount });
  }

  return Array.from(byChain.values()).reduce((sum, item) => sum + item.amount, 0);
}

function nullableDecimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sectionEvidence(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 4);
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
  const complianceRecords = records.filter((record) => record.recordType === 'COMPLIANCE');
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

function recordDocument(record: RepositoryRecord, name: string, index = 0): RecordsDocumentDto {
  const category = record.recordType;
  return {
    id: `${record.id}:document:${index}`,
    name,
    category,
    relatedRecord: record.referenceNumber,
    uploadedBy: record.supplierName ?? record.buyerName,
    uploadedAt: record.createdAt.toISOString(),
    fileType: documentFileType(name, category),
    version: 'Current',
    accessLevel: record.recordType === 'BID' ? 'Restricted' : 'Organization'
  };
}

function documentFileType(name: string, category: string | null) {
  const extension = name.split('.').pop();
  if (extension && extension !== name && extension.length <= 5) return extension.toUpperCase();
  if (category) return category.toUpperCase().slice(0, 24);
  return 'FILE';
}

function auditDto(event: {
  id: string;
  event: string;
  entityType: string;
  entityRef: string | null;
  severity: string;
  createdAt: Date;
}): RecordsAuditDto {
  return {
    id: event.id,
    occurredAt: event.createdAt.toISOString(),
    user: null,
    organization: null,
    action: event.event,
    recordType: event.entityType,
    recordReference: event.entityRef,
    result: event.severity
  };
}

function buildLifecycleStages(record: RepositoryRecord, related: RepositoryRecord[]): RecordsLifecycleStageDto[] {
  const stageDefinitions = [
    { key: 'tender', label: 'Tender', match: ['TENDER'] },
    { key: 'clarifications', label: 'Clarifications', match: ['AMENDMENT', 'CLARIFICATION'] },
    { key: 'bid', label: 'Bid Submission', match: ['BID'] },
    { key: 'opening', label: 'Bid Opening', match: ['BID'] },
    { key: 'evaluation', label: 'Evaluation Report', match: ['REPORT'] },
    { key: 'award', label: 'Award', match: ['AWARD'] },
    { key: 'contract', label: 'Contract', match: ['CONTRACT'] },
    { key: 'closure', label: 'Completion or Closure', match: ['COMPLIANCE'] }
  ];
  const activeIndex = Math.max(0, stageDefinitions.findIndex((stage) => stage.match.includes(record.recordType)));

  return stageDefinitions.map((stage, index) => {
    const source = related.find((item) => stage.match.includes(item.recordType));
    const status: RecordsLifecycleStageDto['status'] = source ? 'completed' : index === activeIndex ? 'current' : 'pending';
    return {
      key: stage.key,
      label: stage.label,
      status,
      date: source?.createdAt.toISOString() ?? null,
      detail: source ? `${source.recordType} / ${source.status}` : null,
      recordId: source?.id ?? null
    };
  });
}

