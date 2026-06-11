import { OrganizationKind, TenderStatus, Visibility, VerificationStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  ProcurementPlanLineInput,
  ProcurementPlanLinePatchInput,
  ProcurementPlanningQuery,
  SaveAnnualPlanInput,
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

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async getWelcomeData() {
    if (this.db === prisma && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const [participantCount, openTenderCount, verifiedUserCount, featuredTenders] = await Promise.all([
      this.db.organization.count(),
      this.db.tender.count({
        where: {
          status: TenderStatus.OPEN,
          visibility: Visibility.PUBLIC_MARKETPLACE
        }
      }),
      this.db.user.count({
        where: {
          verificationStatus: VerificationStatus.APPROVED
        }
      }),
      this.db.tender.findMany({
        where: {
          status: TenderStatus.OPEN,
          visibility: Visibility.PUBLIC_MARKETPLACE
        },
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

function dateInput(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function decimalToNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, typeof item === 'string' ? item : String(item ?? '')])
  );
}
