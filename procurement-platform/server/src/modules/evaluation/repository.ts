import {
  AuditSeverity,
  BidStatus,
  EvaluationStage,
  EvaluationStatus,
  RecommendationStatus,
  TenderStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { signSensitiveAction } from '../identity/sensitiveActionSigning.js';
import type { EvaluationDecisionStatus, EvaluationRecordsQuery, EvaluationRequestContext, SaveEvaluationWorkspaceInput } from './types.js';

const publishedTenderStatuses = [
  TenderStatus.PUBLISHED,
  TenderStatus.OPEN,
  TenderStatus.CLOSED,
  TenderStatus.EVALUATION
] as const;

const lockableTenderStatuses = [TenderStatus.PUBLISHED, TenderStatus.OPEN] as const;
const evaluationOpenTenderStatuses = [TenderStatus.CLOSED, TenderStatus.EVALUATION] as const;

const draftEvaluationStatuses = [EvaluationStatus.IN_PROGRESS, EvaluationStatus.RETURNED] as const;
const decisionStatuses: EvaluationDecisionStatus[] = ['PENDING', 'PASSED', 'FAILED', 'NEEDS_CLARIFICATION', 'RECOMMENDED'];

function awardReference() {
  return `PX-AWD-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

const workspaceTenderInclude = {
  buyerOrg: {
    select: {
      id: true,
      name: true
    }
  },
  evaluation: {
    include: {
      criteria: {
        orderBy: [{ stage: 'asc' }, { name: 'asc' }]
      },
      scores: {
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          evaluatorUser: {
            select: {
              id: true,
              displayName: true,
              email: true
            }
          }
        }
      },
      recommendations: {
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          bid: {
            select: {
              id: true,
              supplierOrg: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  },
  bids: {
    where: {
      status: BidStatus.SUBMITTED
    },
    orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      supplierOrg: {
        select: {
          id: true,
          name: true
        }
      },
      documents: {
        include: {
          document: {
            select: {
              id: true,
              name: true,
              documentType: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      responses: {
        select: {
          requirementKey: true,
          response: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      receipt: {
        select: {
          receiptRef: true,
          receiptHash: true
        }
      }
    }
  },
  requirementRows: {
    orderBy: [{ section: 'asc' }, { createdAt: 'asc' }]
  },
  commercialItems: {
    orderBy: {
      itemNo: 'asc'
    }
  },
  documents: {
    include: {
      document: {
        select: {
          id: true,
          name: true,
          documentType: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  }
} satisfies Prisma.TenderInclude;

type DbClient = PrismaClient | Prisma.TransactionClient;
export type EvaluationWorkspaceTenderRecord = Prisma.TenderGetPayload<{ include: typeof workspaceTenderInclude }>;
export type EvaluationWorkspaceAuditRecord = Prisma.AuditEventGetPayload<{
  include: {
    actorUser: {
      select: {
        displayName: true;
        email: true;
      };
    };
  };
}>;

function buyerScope(context?: EvaluationRequestContext) {
  return context?.organizationId && !context.isAdmin ? { buyerOrgId: context.organizationId } : {};
}

function readyTenderWhere(now: Date, context?: EvaluationRequestContext): Prisma.TenderWhereInput {
  return {
    ...buyerScope(context),
    status: { in: [...publishedTenderStatuses] },
    OR: [
      { closingDate: { lte: now } },
      { status: { in: [...evaluationOpenTenderStatuses] } }
    ],
    bids: {
      some: {
        status: BidStatus.SUBMITTED
      }
    },
    AND: [
      {
        OR: [
          {
            evaluation: {
              is: null
            }
          },
          {
            evaluation: {
              is: {
                status: {
                  not: EvaluationStatus.COMPLETED
                }
              }
            }
          }
        ]
      }
    ]
  };
}

function publishedTenderWhere(context?: EvaluationRequestContext): Prisma.TenderWhereInput {
  return {
    ...buyerScope(context),
    status: { in: [...publishedTenderStatuses] }
  };
}

function lockedTenderWhere(now: Date, context?: EvaluationRequestContext): Prisma.TenderWhereInput {
  return {
    ...buyerScope(context),
    status: { in: [...lockableTenderStatuses] },
    closingDate: { gt: now }
  };
}

function draftEvaluationWhere(context?: EvaluationRequestContext): Prisma.EvaluationWorkspaceWhereInput {
  return {
    ...(context?.organizationId && !context.isAdmin ? { buyerOrgId: context.organizationId } : {}),
    status: { in: [...draftEvaluationStatuses] },
    OR: [
      { payload: { path: ['draftSaved'], equals: true } },
      { scores: { some: {} } }
    ]
  };
}

function recordsWhere(query: EvaluationRecordsQuery, context?: EvaluationRequestContext): Prisma.EvaluationWorkspaceWhereInput {
  const tenderWhere: Prisma.TenderWhereInput = {
    ...buyerScope(context)
  };

  if (query.search) {
    tenderWhere.OR = [
      { reference: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
      { buyerOrg: { name: { contains: query.search, mode: 'insensitive' } } }
    ];
  }

  if (query.type !== 'all') {
    tenderWhere.type = query.type;
  }

  const where: Prisma.EvaluationWorkspaceWhereInput = {
    ...(context?.organizationId && !context.isAdmin ? { buyerOrgId: context.organizationId } : {})
  };

  if (query.status !== 'all') {
    where.status = query.status;
  }

  if (Object.keys(tenderWhere).length > 0) {
    where.tender = {
      is: tenderWhere
    };
  }

  return where;
}

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function scopedTenderWhere(tenderId: string, context?: EvaluationRequestContext): Prisma.TenderWhereInput {
  return {
    id: tenderId,
    ...(context?.organizationId && !context.isAdmin ? { buyerOrgId: context.organizationId } : {})
  };
}

function workspacePayload(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function workspaceDecisions(value: Prisma.JsonValue | null | undefined) {
  const payload = workspacePayload(value);
  const decisions = payload.decisions;
  if (typeof decisions !== 'object' || decisions === null || Array.isArray(decisions)) return {};
  return decisions as Record<string, { status?: string; comment?: string; updatedAt?: string; evaluatorUserId?: string | null }>;
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : Number(value.toString());
}

function scoreLimit(criterion: { maxScore: Prisma.Decimal | null }) {
  return decimalToNumber(criterion.maxScore) ?? 100;
}

function latestScoresByBidCriterion(scores: Array<{ bidId: string; criterionId: string | null; score: Prisma.Decimal | null }>) {
  const byKey = new Map<string, { bidId: string; criterionId: string | null; score: Prisma.Decimal | null }>();
  for (const score of scores) {
    if (!score.criterionId) continue;
    const key = `${score.bidId}:${score.criterionId}`;
    if (!byKey.has(key)) byKey.set(key, score);
  }
  return byKey;
}

function isBidEvaluated(
  bidId: string,
  criteria: Array<{ id: string; maxScore: Prisma.Decimal | null }>,
  scores: Array<{ bidId: string; criterionId: string | null; score: Prisma.Decimal | null }>
) {
  if (criteria.length === 0) return false;
  const latestScores = latestScoresByBidCriterion(scores);
  return criteria.every((criterion) => {
    const row = latestScores.get(`${bidId}:${criterion.id}`);
    return row?.score !== null && row?.score !== undefined && Number(row.score.toString()) <= scoreLimit(criterion);
  });
}

function technicalScore(
  bidId: string,
  criteria: Array<{ id: string; weight: Prisma.Decimal | null; maxScore: Prisma.Decimal | null }>,
  scores: Array<{ bidId: string; criterionId: string | null; score: Prisma.Decimal | null }>
) {
  if (!isBidEvaluated(bidId, criteria, scores)) return null;
  const latestScores = latestScoresByBidCriterion(scores);
  const totalWeight = criteria.reduce((sum, criterion) => sum + (decimalToNumber(criterion.weight) ?? 0), 0);

  if (totalWeight > 0) {
    return roundScore(
      criteria.reduce((sum, criterion) => {
        const row = latestScores.get(`${bidId}:${criterion.id}`);
        const score = row?.score ? Number(row.score.toString()) : 0;
        return sum + (score / scoreLimit(criterion)) * (decimalToNumber(criterion.weight) ?? 0);
      }, 0)
    );
  }

  return roundScore(
    criteria.reduce((sum, criterion) => {
      const row = latestScores.get(`${bidId}:${criterion.id}`);
      const score = row?.score ? Number(row.score.toString()) : 0;
      return sum + (score / scoreLimit(criterion)) * 100;
    }, 0) / Math.max(1, criteria.length)
  );
}

function financialScores(bids: Array<{ id: string; totalAmount: Prisma.Decimal | null }>) {
  const amounts = bids
    .map((bid) => ({ bidId: bid.id, amount: decimalToNumber(bid.totalAmount) }))
    .filter((row): row is { bidId: string; amount: number } => typeof row.amount === 'number' && row.amount > 0);
  const lowest = Math.min(...amounts.map((row) => row.amount));
  const scores = new Map<string, number>();
  if (!Number.isFinite(lowest)) return scores;
  for (const row of amounts) scores.set(row.bidId, roundScore((lowest / row.amount) * 100));
  return scores;
}

function rankingSnapshot(
  bids: Array<{ id: string; totalAmount: Prisma.Decimal | null; supplierOrg: { name: string } }>,
  criteria: Array<{ id: string; weight: Prisma.Decimal | null; maxScore: Prisma.Decimal | null }>,
  scores: Array<{ bidId: string; criterionId: string | null; score: Prisma.Decimal | null; comment?: string | null }>,
  decisions: Record<string, { status?: string; comment?: string }>
) {
  const priceScores = financialScores(bids);
  return bids
    .map((bid) => {
      const techScore = technicalScore(bid.id, criteria, scores);
      if (techScore === null) return null;
      const comments = scores
        .filter((score) => score.bidId === bid.id && score.comment)
        .map((score) => score.comment as string);
      const decision = decisions[bid.id];
      return {
        bidId: bid.id,
        bidderName: bid.supplierOrg.name,
        technicalScore: techScore,
        financialScore: priceScores.get(bid.id) ?? null,
        totalScore: techScore,
        decisionStatus: decisionStatuses.includes(decision?.status as EvaluationDecisionStatus)
          ? decision?.status
          : 'PENDING',
        commentSummary: decision?.comment || comments[0] || ''
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function publishedCriteriaFromTender(tender: Pick<EvaluationWorkspaceTenderRecord, 'metadata'>) {
  const metadata = workspacePayload(tender.metadata);
  const criteria = metadata.evaluationCriteria;
  if (!Array.isArray(criteria)) return [];
  return criteria
    .map((value, index) => {
      const row = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const name = stringValue(row.label) || stringValue(row.name) || stringValue(row.criterion) || `Criterion ${index + 1}`;
      const category = stringValue(row.category) || name;
      const evaluationType = stringValue(row.evaluationType) || stringValue(row.type);
      const text = `${name} ${category} ${evaluationType}`.toLowerCase();
      const stage = /financial|price|cost|boq|fee|commercial/.test(text) ? EvaluationStage.FINANCIAL : /admin|eligib|document|license|certificate|tax/.test(text) ? EvaluationStage.ELIGIBILITY : EvaluationStage.TECHNICAL;
      const weight = numberValue(row.weight) ?? numberValue(row.maximumScore);
      const maxScore = numberValue(row.maxScore) ?? numberValue(row.maximumScore) ?? (/pass|fail|document|gate/.test(evaluationType.toLowerCase()) ? 1 : 100);
      return {
        stage,
        name,
        weight,
        maxScore,
        payload: {
          ...row,
          source: 'published_tender_metadata',
          sourceId: stringValue(row.id) || stringValue(row.sourceId) || null,
          category
        } as Prisma.InputJsonObject
      };
    })
    .filter((row) => row.name.trim());
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function workspaceSectionDraft(value: Prisma.JsonValue | null | undefined) {
  const payload = workspacePayload(value);
  const sectionDraft = payload.sectionDraft;
  if (typeof sectionDraft !== 'object' || sectionDraft === null || Array.isArray(sectionDraft)) return {};
  return sectionDraft as Record<string, unknown>;
}

function mergeSectionDraft(value: Prisma.JsonValue | null | undefined, nextDraft: Record<string, unknown>) {
  return {
    ...workspaceSectionDraft(value),
    ...nextDraft
  };
}

function sectionDraftAllowsCompletion(sectionDraft: Record<string, unknown>) {
  const completion = sectionDraft.completion;
  if (typeof completion !== 'object' || completion === null || Array.isArray(completion)) return false;
  return (completion as Record<string, unknown>).canComplete === true;
}

function sectionDraftProgress(sectionDraft: Record<string, unknown>) {
  const completion = sectionDraft.completion;
  if (typeof completion !== 'object' || completion === null || Array.isArray(completion)) return 0;
  const percent = (completion as Record<string, unknown>).percent;
  return typeof percent === 'number' && Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
}

function stageForActiveStageId(activeStageId: string | undefined): EvaluationStage | undefined {
  if (!activeStageId) return undefined;
  if (activeStageId === 'opening') return EvaluationStage.OPENING;
  if (activeStageId === 'preliminary' || activeStageId === 'administrative') return EvaluationStage.ELIGIBILITY;
  if (activeStageId === 'technical' || activeStageId === 'criteria' || activeStageId === 'tor') return EvaluationStage.TECHNICAL;
  if (activeStageId === 'financial' || activeStageId === 'boq' || activeStageId === 'pricing') return EvaluationStage.FINANCIAL;
  if (activeStageId === 'verification' || activeStageId === 'sla' || activeStageId === 'postqual') return EvaluationStage.CLARIFICATIONS;
  if (activeStageId === 'ranking') return EvaluationStage.COMPARISON;
  if (activeStageId === 'report') return EvaluationStage.REPORT;
  return undefined;
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function availability(tender: EvaluationWorkspaceTenderRecord, now = new Date()) {
  if (!publishedTenderStatuses.includes(tender.status as (typeof publishedTenderStatuses)[number])) {
    return { isReady: false, reason: 'Tender is not published yet.' };
  }
  if (!evaluationOpenTenderStatuses.includes(tender.status as (typeof evaluationOpenTenderStatuses)[number]) && (!tender.closingDate || tender.closingDate > now)) {
    return { isReady: false, reason: 'Tender is locked until the closing date passes.' };
  }
  if (tender.bids.length === 0) {
    return { isReady: false, reason: 'No submitted bids available for evaluation yet.' };
  }
  if (tender.evaluation?.status === EvaluationStatus.COMPLETED) {
    return { isReady: false, reason: 'Evaluation is already completed.' };
  }
  return { isReady: true, reason: null };
}

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async getDashboardData(now = new Date(), context?: EvaluationRequestContext) {
    await this.closeElapsedTenders(now, context);

    return Promise.all([
      this.db.tender.count({
        where: {
          ...buyerScope(context),
          status: {
            in: [...publishedTenderStatuses]
          }
        }
      }),
      this.db.tender.count({
        where: readyTenderWhere(now, context)
      }),
      this.db.evaluationWorkspace.count({
        where: draftEvaluationWhere(context)
      }),
      this.db.tender.count({
        where: lockedTenderWhere(now, context)
      }),
      this.db.evaluationWorkspace.count({
        where: context?.organizationId && !context.isAdmin ? { buyerOrgId: context.organizationId } : {}
      })
    ]);
  }

  async listRecords(query: EvaluationRecordsQuery, context?: EvaluationRequestContext) {
    const where = recordsWhere(query, context);
    const [records, totalRecords] = await Promise.all([
      this.db.evaluationWorkspace.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        include: {
          tender: {
            select: {
              id: true,
              reference: true,
              title: true,
              type: true,
              closingDate: true,
              buyerOrg: {
                select: {
                  name: true
                }
              },
              bids: {
                where: {
                  status: BidStatus.SUBMITTED
                },
                select: {
                  id: true
                }
              }
            }
          },
          recommendations: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            select: {
              status: true
            }
          }
        }
      }),
      this.db.evaluationWorkspace.count({ where })
    ]);

    return { records, totalRecords };
  }

  async listDrafts(context?: EvaluationRequestContext) {
    return this.db.evaluationWorkspace.findMany({
      where: draftEvaluationWhere(context),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        tender: {
          select: {
            id: true,
            reference: true,
            title: true,
            type: true,
            bids: {
              where: {
                status: BidStatus.SUBMITTED
              },
              select: {
                id: true
              }
            }
          }
        }
      }
    });
  }

  async listReadyTenders(context?: EvaluationRequestContext) {
    await this.closeElapsedTenders(new Date(), context);

    return this.db.tender.findMany({
      where: publishedTenderWhere(context),
      orderBy: [{ closingDate: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        reference: true,
        title: true,
        type: true,
        status: true,
        closingDate: true,
        requirements: true,
        metadata: true,
        requirementRows: {
          select: {
            id: true
          }
        },
        buyerOrg: {
          select: {
            name: true
          }
        },
        evaluation: {
          select: {
            status: true,
            currentStage: true,
            progress: true,
            payload: true,
            criteria: {
              select: {
                id: true
              }
            }
          }
        },
        bids: {
          where: {
            status: BidStatus.SUBMITTED
          },
          select: {
            id: true
          }
        }
      }
    });
  }

  async getWorkspaceByTenderId(tenderId: string, context?: EvaluationRequestContext) {
    await this.closeElapsedTenders(new Date(), context);

    let tender = await this.findWorkspaceTender(tenderId, context, this.db);
    if (tender && !tender.evaluation && availability(tender).isReady) {
      await this.createWorkspaceFromTender(tender, context, this.db);
      tender = await this.findWorkspaceTender(tenderId, context, this.db);
    }
    const auditEvents = tender?.evaluation
      ? await this.db.auditEvent.findMany({
          where: {
            entityType: 'evaluation_workspace',
            entityRef: tender.evaluation.id
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 8,
          include: {
            actorUser: {
              select: {
                displayName: true,
                email: true
              }
            }
          }
        })
      : [];

    return { tender, auditEvents };
  }

  async saveWorkspace(tenderId: string, input: SaveEvaluationWorkspaceInput, context?: EvaluationRequestContext) {
    await this.db.$transaction(async (tx) => {
      await this.closeElapsedTenders(new Date(), context, tx);

      const tender = await this.findWorkspaceTender(tenderId, context, tx);
      if (!tender) throw requestError('Tender was not found.', 404);

      const state = availability(tender);
      if (!state.isReady) throw requestError(state.reason ?? 'Tender is not ready for evaluation.');

      const workspace =
        tender.evaluation ??
        await this.createWorkspaceFromTender(tender, context, tx);

      const criteria = await tx.evaluationCriterion.findMany({
        where: {
          workspaceId: workspace.id
        },
        orderBy: [{ stage: 'asc' }, { name: 'asc' }]
      });

      if (input.scores.length > 0 && criteria.length === 0) {
        throw requestError('Evaluation criteria are required before scores can be saved.');
      }

      const submittedBidIds = new Set(tender.bids.map((bid) => bid.id));
      const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));
      if (input.selectedBidId && !submittedBidIds.has(input.selectedBidId)) {
        throw requestError('Selected bid must belong to a submitted bid on this tender.');
      }

      for (const score of input.scores) {
        const criterion = criteriaById.get(score.criterionId);
        if (!submittedBidIds.has(score.bidId)) throw requestError('Scores can only be saved for submitted bids on this tender.');
        if (!criterion) throw requestError('Score references an evaluation criterion that does not belong to this tender.');
        if (score.score > scoreLimit(criterion)) throw requestError('Score cannot exceed the criterion maximum score.');

        await tx.evaluationScore.deleteMany({
          where: {
            workspaceId: workspace.id,
            bidId: score.bidId,
            criterionId: score.criterionId,
            evaluatorUserId: context?.userId ?? null
          }
        });
        await tx.evaluationScore.create({
          data: {
            workspaceId: workspace.id,
            criterionId: score.criterionId,
            bidId: score.bidId,
            evaluatorUserId: context?.userId ?? null,
            score: score.score,
            comment: score.comment || null
          }
        });
      }

      const freshScores = await tx.evaluationScore.findMany({
        where: {
          workspaceId: workspace.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const existingDecisions = workspaceDecisions(workspace.payload);
      const nextDecisions = { ...existingDecisions };
      const nextSectionDraft = mergeSectionDraft(workspace.payload, input.sectionDraft);
      const categoryCompletionOverride = sectionDraftAllowsCompletion(nextSectionDraft);

      for (const decision of input.decisions) {
        if (!submittedBidIds.has(decision.bidId)) throw requestError('Decisions can only be saved for submitted bids on this tender.');
        if (decision.status === 'RECOMMENDED' && !categoryCompletionOverride && !isBidEvaluated(decision.bidId, criteria, freshScores)) {
          throw requestError('A bid must be fully evaluated before it can be recommended.');
        }
        nextDecisions[decision.bidId] = {
          status: decision.status,
          comment: decision.comment,
          updatedAt: new Date().toISOString(),
          evaluatorUserId: context?.userId ?? null
        };
      }

      const rankings = rankingSnapshot(tender.bids, criteria, freshScores, nextDecisions);
      const evaluatedBidCount = tender.bids.filter((bid) => isBidEvaluated(bid.id, criteria, freshScores)).length;
      const scoreProgress = tender.bids.length > 0 ? Math.round((evaluatedBidCount / tender.bids.length) * 100) : 0;
      const completed = Boolean(input.complete && tender.bids.length > 0 && (evaluatedBidCount === tender.bids.length || sectionDraftAllowsCompletion(nextSectionDraft)));
      const progress = completed ? 100 : Math.max(scoreProgress, sectionDraftProgress(nextSectionDraft));
      const activeStage = stageForActiveStageId(input.activeStageId);
      const payload = {
        ...workspacePayload(workspace.payload),
        decisions: nextDecisions,
        sectionDraft: nextSectionDraft,
        rankings,
        lastSavedAt: new Date().toISOString(),
        ...(input.complete ? {} : { draftSaved: true }),
        ...(input.activeStageId ? { activeStageId: input.activeStageId } : {}),
        ...(input.selectedBidId ? { selectedBidId: input.selectedBidId } : {}),
        ...(completed ? { completedAt: new Date().toISOString() } : {})
      };

      await tx.evaluationWorkspace.update({
        where: {
          id: workspace.id
        },
        data: {
          status: completed ? EvaluationStatus.COMPLETED : EvaluationStatus.IN_PROGRESS,
          currentStage: completed ? EvaluationStage.RECOMMENDATION : activeStage ?? workspace.currentStage ?? EvaluationStage.OPENING,
          progress,
          payload: payload as Prisma.InputJsonObject
        }
      });

      const recommendedDecision = Object.entries(nextDecisions).find((entry) => entry[1]?.status === 'RECOMMENDED');
      if (recommendedDecision) {
        const recommendedBid = tender.bids.find((bid) => bid.id === recommendedDecision[0]);
        if (recommendedBid) {
          const existingRecommendation = await tx.awardRecommendation.findFirst({
            where: {
              workspaceId: workspace.id,
              status: RecommendationStatus.DRAFT
            },
            orderBy: {
              createdAt: 'desc'
            }
          });
          const recommendationData = {
            bidId: recommendedBid.id,
            supplierOrgId: recommendedBid.supplierOrg.id,
            amount: recommendedBid.totalAmount,
            currency: recommendedBid.currency,
            reason: recommendedDecision[1]?.comment || 'Prepared from completed evaluation scoring.',
            payload: {
              source: 'evaluation_workspace',
              ranking: rankings.find((ranking) => ranking.bidId === recommendedBid.id) ?? null
            } as Prisma.InputJsonObject
          };

          if (existingRecommendation) {
            await tx.awardRecommendation.update({
              where: {
                id: existingRecommendation.id
              },
              data: recommendationData
            });
          } else {
            await tx.awardRecommendation.create({
              data: {
                reference: awardReference(),
                workspaceId: workspace.id,
                ...recommendationData
              }
            });
          }

          await tx.auditEvent.create({
            data: {
              ownerOrgId: tender.buyerOrgId,
              actorUserId: context?.userId ?? null,
              event: 'evaluation.recommendation.prepared',
              entityType: 'evaluation_workspace',
              entityRef: workspace.id,
              severity: AuditSeverity.INFO,
              payload: {
                tenderId: tender.id,
                bidId: recommendedBid.id,
                supplierOrgId: recommendedBid.supplierOrg.id
              }
            }
          });
        }
      }

      if (completed) {
        if (!context?.userId || !input.signatureKeyphrase) {
          throw requestError('Digital signature keyphrase is required to complete evaluation.', 400);
        }
        await signSensitiveAction(tx, {
          userId: context.userId,
          organizationId: context.organizationId ?? tender.buyerOrgId,
          signatureKeyphrase: input.signatureKeyphrase,
          moduleKey: 'evaluation',
          actionKey: 'workspace.complete',
          entityType: 'evaluation_workspace',
          entityRef: workspace.id,
          payload: {
            tenderId: tender.id,
            workspaceId: workspace.id,
            progress,
            completedAt: payload.completedAt ?? null,
            evaluatedBidCount,
            submittedBidCount: tender.bids.length,
            recommendedBidId: recommendedDecision?.[0] ?? null,
            rankings
          }
        });
      }

      await tx.auditEvent.create({
        data: {
          ownerOrgId: tender.buyerOrgId,
          actorUserId: context?.userId ?? null,
          event: completed ? 'evaluation.workspace.completed' : 'evaluation.workspace.saved',
          entityType: 'evaluation_workspace',
          entityRef: workspace.id,
          severity: AuditSeverity.INFO,
          payload: {
            tenderId: tender.id,
            savedScoreCount: input.scores.length,
            savedDecisionCount: input.decisions.length,
            progress
          }
        }
      });
    });
  }

  private async closeElapsedTenders(now: Date, context?: EvaluationRequestContext, db: DbClient = this.db) {
    await db.tender.updateMany({
      where: {
        ...buyerScope(context),
        status: { in: [...lockableTenderStatuses] },
        closingDate: { lte: now }
      },
      data: {
        status: TenderStatus.CLOSED
      }
    });
  }

  private findWorkspaceTender(tenderId: string, context: EvaluationRequestContext | undefined, db: DbClient) {
    return db.tender.findFirst({
      where: scopedTenderWhere(tenderId, context),
      include: workspaceTenderInclude
    });
  }

  private async createWorkspaceFromTender(tender: EvaluationWorkspaceTenderRecord, context: EvaluationRequestContext | undefined, db: DbClient) {
    const workspace = await db.evaluationWorkspace.create({
      data: {
        tenderId: tender.id,
        buyerOrgId: tender.buyerOrgId,
        status: EvaluationStatus.IN_PROGRESS,
        currentStage: EvaluationStage.OPENING,
        progress: 0
      },
      include: {
        criteria: true,
        scores: true
      }
    });

    const criteria = publishedCriteriaFromTender(tender);
    if (criteria.length) {
      await db.evaluationCriterion.createMany({
        data: criteria.map((criterion) => ({
          workspaceId: workspace.id,
          ...criterion
        }))
      });
    }

    await db.auditEvent.create({
      data: {
        ownerOrgId: tender.buyerOrgId,
        actorUserId: context?.userId ?? null,
        event: 'evaluation.workspace.started',
        entityType: 'evaluation_workspace',
        entityRef: workspace.id,
        severity: AuditSeverity.INFO,
        payload: {
          tenderId: tender.id,
          seededCriterionCount: criteria.length
        }
      }
    });

    return db.evaluationWorkspace.findUniqueOrThrow({
      where: {
        id: workspace.id
      },
      include: {
        criteria: true,
        scores: true
      }
    });
  }
}
