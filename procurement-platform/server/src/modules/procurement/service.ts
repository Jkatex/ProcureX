import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ProcurementMethod, TenderStatus, Visibility } from '@prisma/client';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { getProcurementTaxonomy, standardizeCategory, standardizeCategoryList } from './category-taxonomy.js';
import { getProcurementDesignFormSchema, getProcurementDesignFormSchemas, procurementDesignSchemaVersion } from './design-form-schemas.js';
import { scanTenderLanguage } from './design-language-scanner.js';
import { responseValidation, schemaMetadata, tenderTypeProfile, validateTenderDraftRequirements } from './design-validation.js';
import { getProcurementMasterDataGroup, getProcurementMasterDataGroups } from './master-data.js';
import { ModuleRepository } from './repository.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { ModuleService as EvaluationService } from '../evaluation/service.js';
import { prisma } from '../../db/prisma.js';
import { signSensitiveAction } from '../identity/sensitiveActionSigning.js';
import { isProductionRuntime } from '../../security/config.js';
import {
  type CloseTenderResponseDto,
  type CategoryStandardizationResultDto,
  type CategoryStandardizationResponseDto,
  type CreateTenderInput,
  type CreateTenderResponseDto,
  type DesignFormSchemaListResponseDto,
  type DesignFormSchemaResponseDto,
  type MasterDataGroupResponseDto,
  type MasterDataListResponseDto,
  moduleDefinition,
  type MarketplaceQuery,
  type ProcurementMarketplacePayload,
  type ProcurementTaxonomyResponseDto,
  type ModuleStatus,
  type PublishTenderResponseDto,
  type PublishValidationIssueDto,
  type ProcurementPlanDto,
  type ProcurementPlanLineDto,
  type ProcurementPlanLineInput,
  type ProcurementPlanLinePatchInput,
  type ProcurementPlanningListDto,
  type ProcurementPlanningQuery,
  type PublicWelcomePayload,
  type PublicWelcomeTender,
  type SaveAnnualPlanInput,
  type SavedTendersPayload,
  type SaveTenderResponseDto,
  type OpenEvaluationResponseDto,
  type TenderAmendmentInput,
  type TenderAmendmentPatchInput,
  type TenderAmendmentResponseDto,
  type TenderAmendmentsResponseDto,
  type TenderReviewDecisionResponseDto,
  type TenderReviewDetailDto,
  type TenderReviewFailInput,
  type TenderReviewListDto,
  type TenderReviewQuery,
  type TenderDocumentDownloadResponseDto,
  type TenderDocumentStreamDto,
  type TenderDetailDto,
  type TenderLanguageScanInput,
  type TenderLanguageScanResponseDto,
  type UnsaveTenderResponseDto,
  type UpdateBuyerNoticeInput,
  type UpdateBuyerNoticeResponseDto,
  type UpdateTenderInput,
  type UpdateTenderResponseDto,
  type UpdateProcurementPlanInput
} from './types.js';

export const MARKETPLACE_UNAVAILABLE_MESSAGE = 'Marketplace is temporarily unavailable. Please try again later.';
export const MARKETPLACE_UNAVAILABLE_CODE = 'MARKETPLACE_UNAVAILABLE';
export const PUBLISH_VALIDATION_FAILED_CODE = 'PUBLISH_VALIDATION_FAILED';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function marketplaceUnavailableError() {
  const error = requestError(MARKETPLACE_UNAVAILABLE_MESSAGE, 503) as Error & { code?: string };
  error.code = MARKETPLACE_UNAVAILABLE_CODE;
  return error;
}

function publishValidationError(errors: PublishValidationIssueDto[], status = 400) {
  const error = requestError('Tender cannot be published', status) as Error & {
    code?: string;
    errors?: PublishValidationIssueDto[];
  };
  error.code = PUBLISH_VALIDATION_FAILED_CODE;
  error.errors = errors;
  return error;
}

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly identity = new IdentityService(),
    private readonly evaluation = new EvaluationService()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async publicWelcome(): Promise<PublicWelcomePayload> {
    try {
      return this.mapWelcomeData(await this.repository.getWelcomeData());
    } catch {
      return defaultWelcomePayload;
    }
  }

  async masterData(): Promise<MasterDataListResponseDto> {
    return {
      success: true,
      data: {
        groups: getProcurementMasterDataGroups()
      }
    };
  }

  async masterDataGroup(group: string): Promise<MasterDataGroupResponseDto | null> {
    const data = getProcurementMasterDataGroup(group);
    return data ? { success: true, data } : null;
  }

  async designFormSchemas(): Promise<DesignFormSchemaListResponseDto> {
    return {
      success: true,
      data: {
        schemaVersion: procurementDesignSchemaVersion,
        schemas: getProcurementDesignFormSchemas()
      }
    };
  }

  async designFormSchema(type: string): Promise<DesignFormSchemaResponseDto | null> {
    const data = getProcurementDesignFormSchema(type);
    return data ? { success: true, data } : null;
  }

  async taxonomy(): Promise<ProcurementTaxonomyResponseDto> {
    return getProcurementTaxonomy();
  }

  async standardizeCategory(input: { rawCategory: string; type?: CreateTenderInput['type'] }): Promise<CategoryStandardizationResponseDto> {
    return {
      success: true,
      data: standardizeCategory(input.rawCategory, input.type)
    };
  }

  async scanTenderLanguage(token: string | undefined, input: TenderLanguageScanInput): Promise<TenderLanguageScanResponseDto> {
    await this.identity.requireSession(token);
    return {
      success: true,
      data: scanTenderLanguage(input)
    };
  }

  async marketplace(token?: string, query: MarketplaceQuery = defaultMarketplaceQuery): Promise<ProcurementMarketplacePayload> {
    try {
      const context = await this.contextFromToken(token);
      return await this.repository.getMarketplaceData(context, query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        if (!isProductionRuntime()) return emptyMarketplace(query);
        console.error('[procurement.marketplace] Database unavailable while loading marketplace.', error);
        throw marketplaceUnavailableError();
      }
      throw error;
    }
  }

  async getTenderDetail(tenderId: string, token?: string): Promise<TenderDetailDto | null> {
    const context = await this.contextFromToken(token);
    return this.repository.getTenderDetail(tenderId, context);
  }

  async recordTenderDocumentDownload(tenderId: string, documentId: string, token?: string): Promise<TenderDocumentDownloadResponseDto | null> {
    const context = await this.contextFromToken(token);
    return this.repository.recordTenderDocumentDownload(tenderId, documentId, context);
  }

  async tenderDocumentStream(tenderId: string, documentId: string, disposition: TenderDocumentStreamDto['disposition'], token?: string) {
    const context = await this.contextFromToken(token);
    const document = await this.repository.getTenderDocumentForStream(tenderId, documentId, context, disposition);
    if (!document) return null;
    const response = await s3Client().send(new GetObjectCommand({ Bucket: requiredDocumentBucket(), Key: document.objectKey }));
    return {
      document,
      contentType: response.ContentType || contentTypeForDocument(document),
      contentLength: response.ContentLength,
      stream: await toNodeReadable(response.Body)
    };
  }

  async listTenderAmendments(tenderId: string, token?: string): Promise<TenderAmendmentsResponseDto | null> {
    const context = await this.contextFromToken(token);
    return this.repository.listTenderAmendments(tenderId, context);
  }

  async createTenderAmendment(tenderId: string, token: string | undefined, input: TenderAmendmentInput): Promise<TenderAmendmentResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.createTenderAmendment(tenderId, input, { organizationId, userId: session.user.id });
  }

  async updateTenderAmendment(tenderId: string, amendmentId: string, token: string | undefined, input: TenderAmendmentPatchInput): Promise<TenderAmendmentResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.updateTenderAmendment(tenderId, amendmentId, input, { organizationId, userId: session.user.id });
  }

  async publishTenderAmendment(
    tenderId: string,
    amendmentId: string,
    token: string | undefined,
    input: { signatureKeyphrase?: string }
  ): Promise<TenderAmendmentResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.publishTenderAmendment(tenderId, amendmentId, {
      organizationId,
      userId: session.user.id,
      signatureKeyphrase: input.signatureKeyphrase
    });
  }

  async cancelTenderAmendment(tenderId: string, amendmentId: string, token: string | undefined): Promise<TenderAmendmentResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.cancelTenderAmendment(tenderId, amendmentId, { organizationId, userId: session.user.id });
  }

  async openEvaluation(tenderId: string, token: string | undefined, input: { signatureKeyphrase?: string } = {}): Promise<OpenEvaluationResponseDto> {
    const session = await this.identity.requirePermission(token, 'evaluation.manage');
    const organizationId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.getTenderForEvaluationOpen(tenderId);
    if (!tender) throw requestError('Tender was not found.', 404);
    if (tender.buyerOrgId !== organizationId) throw requestError('Only the owner organization can open evaluation for this tender.', 403);
    const workspace = await this.evaluation.workspace(tenderId, { organizationId, userId: session.user.id });
    if (!workspace.availability.isReady) {
      throw requestError(workspace.availability.reason ?? 'Tender is not ready for evaluation.', 409);
    }
    if (!input.signatureKeyphrase) throw requestError('Digital signature keyphrase is required to open evaluation.', 400);
    await signSensitiveAction(prisma, {
      userId: session.user.id,
      organizationId,
      signatureKeyphrase: input.signatureKeyphrase,
      moduleKey: 'evaluation',
      actionKey: 'bid_opening.open',
      entityType: 'tender',
      entityRef: tenderId,
      payload: {
        tenderId,
        availability: workspace.availability
      }
    });
    return {
      success: true,
      nav: `/evaluation?tenderId=${tenderId}`,
      data: {
        tenderId,
        availability: workspace.availability
      }
    };
  }

  async createTender(token: string | undefined, input: CreateTenderInput): Promise<CreateTenderResponseDto> {
    const session = await this.identity.requirePermission(token, 'procurement.create');
    const organizationId = requireOrganization(session.user.organizationId);
    const validation = validateTenderDraftRequirements(input.type, input.requirements);
    if (validation.errors.length > 0) throw requestError(validation.errors[0], 400);
    const categoryStandardization = standardizeCategoryList(input.categories, input.type);
    const tender = await this.repository.createTender(
      {
        ...input,
        categories: categoryStandardization.standardCategories,
        metadata: schemaMetadata(withCategoryStandardization(input.metadata, categoryStandardization), input.type)
      },
      { organizationId, userId: session.user.id }
    );
    return { ...tender, message: 'Tender draft saved successfully', validation: responseValidation(validation) };
  }

  async updateTender(tenderId: string, token: string | undefined, input: UpdateTenderInput): Promise<UpdateTenderResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    const existing = await this.repository.getTenderForUpdate(tenderId);
    if (!existing) return null;
    if (existing.buyerOrgId !== organizationId) throw requestError('Only the owner organization can update this tender.', 403);
    if (!isEditableTenderStatus(existing.status)) throw requestError('Only draft or review tenders can be updated.', 409);

    const effectiveType = input.type ?? existing.type;
    const categoryStandardization =
      input.categories === undefined ? null : standardizeCategoryList(input.categories, effectiveType);
    const validation = input.requirements === undefined
      ? {
          warnings: [],
          missingRequiredFields: [],
          schemaVersion: procurementDesignSchemaVersion,
          errors: [],
          typeProfile: tenderTypeProfile(effectiveType)
        }
      : validateTenderDraftRequirements(effectiveType, input.requirements);
    if (validation.errors.length > 0) throw requestError(validation.errors[0], 400);

    const tender = await this.repository.updateTender(
      tenderId,
      {
        ...input,
        categories: categoryStandardization?.standardCategories ?? input.categories,
        metadata: schemaMetadata(
          withCategoryStandardization({ ...objectMetadata(existing.metadata), ...(input.metadata ?? {}) }, categoryStandardization),
          effectiveType
        )
      },
      { organizationId, userId: session.user.id }
    );
    return tender ? { ...tender, message: 'Tender draft saved successfully', validation: responseValidation(validation) } : null;
  }

  async updateTenderBuyerNotice(tenderId: string, token: string | undefined, input: UpdateBuyerNoticeInput): Promise<UpdateBuyerNoticeResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.updateTenderBuyerNotice(tenderId, input, { organizationId, userId: session.user.id });
  }

  async publishTender(tenderId: string, token: string | undefined, input: { signatureKeyphrase?: string } = {}): Promise<PublishTenderResponseDto> {
    const session = await this.identity.requirePermission(token, 'procurement.publish');
    const organizationId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.getTenderForPublication(tenderId);
    if (!tender) throw requestError('Tender was not found.', 404);

    const ownershipStatusErrors = ownershipAndStatusIssues(tender, organizationId);
    if (ownershipStatusErrors.length > 0) throw publishValidationError(ownershipStatusErrors, publishErrorStatus(ownershipStatusErrors));

    const basicErrors = basicPublishIssues(tender);
    if (basicErrors.length > 0) throw publishValidationError(basicErrors, 400);

    const schemaErrors = schemaPublishIssues(tender);
    if (schemaErrors.length > 0) throw publishValidationError(schemaErrors, 400);

    const evaluationErrors = evaluationCriteriaIssues(objectMetadata(tender.metadata));
    if (evaluationErrors.length > 0) throw publishValidationError(evaluationErrors, 400);

    const categoryStandardization = standardizeCategoryList(tender.categories.map((category) => category.name), tender.type);
    const warnings = categoryStandardizationWarnings(categoryStandardization);
    await this.repository.applyTenderCategoryStandardization(
      tenderId,
      categoryStandardization.standardCategories,
      withCategoryStandardization(objectMetadata(tender.metadata), categoryStandardization)
    );

    const languageScan = scanTenderLanguage(languageScanInputFromTender(tender));
    await this.repository.recordTenderLanguageScan(tender.id, languageScan);
    if (languageScan.riskLevel === 'High') {
      throw publishValidationError(
        [
          ...languageScan.issues.map((issue) => ({
            step: 'language-scan',
            field: issue.field,
            message: `${issue.type}: ${issue.suggestion}`,
            severity: 'error' as const
          }))
        ],
        409
      );
    }
    if (languageScan.riskLevel === 'Medium') {
      warnings.push(...languageScan.issues.map((issue) => `${issue.type}: ${issue.suggestion}`));
    }

    const visibility = targetVisibilityForMethod(tender.method);
    if (!visibility) {
      throw publishValidationError(
        [{ step: 'visibility', field: 'method', message: 'Unsupported procurement method for publication.', severity: 'error' }],
        400
      );
    }

    const published = await this.repository.submitTenderForReview(tenderId, organizationId, {
      userId: session.user.id,
      signatureKeyphrase: input.signatureKeyphrase
    });
    if (!published) throw requestError('Tender was not found.', 404);
    return {
      ...published,
      languageScan,
      validation: {
        warnings,
        scannerIssues: languageScan.issues,
        standardizedCategories: categoryStandardization.standardCategories
      }
    };
  }

  async listTenderReviews(token: string | undefined, query: TenderReviewQuery): Promise<TenderReviewListDto> {
    await this.identity.requireAdmin(token);
    return this.repository.listTenderReviews(query);
  }

  async getTenderReview(tenderId: string, token: string | undefined): Promise<TenderReviewDetailDto | null> {
    await this.identity.requireAdmin(token);
    return this.repository.getTenderReview(tenderId);
  }

  async passTenderReview(tenderId: string, token: string | undefined, input: { signatureKeyphrase?: string } = {}): Promise<TenderReviewDecisionResponseDto> {
    const session = await this.identity.requireAdmin(token);
    const tender = await this.repository.getTenderForPublication(tenderId);
    if (!tender) throw requestError('Tender was not found.', 404);
    if (tender.status !== TenderStatus.REVIEW) {
      throw publishValidationError(
        [{ step: 'admin-review', field: 'status', message: 'Only tenders awaiting admin review can be passed.', severity: 'error' }],
        409
      );
    }

    const basicErrors = basicPublishIssues(tender);
    if (basicErrors.length > 0) throw publishValidationError(basicErrors, 400);

    const schemaErrors = schemaPublishIssues(tender);
    if (schemaErrors.length > 0) throw publishValidationError(schemaErrors, 400);

    const evaluationErrors = evaluationCriteriaIssues(objectMetadata(tender.metadata));
    if (evaluationErrors.length > 0) throw publishValidationError(evaluationErrors, 400);

    const categoryStandardization = standardizeCategoryList(tender.categories.map((category) => category.name), tender.type);
    const warnings = categoryStandardizationWarnings(categoryStandardization);
    await this.repository.applyTenderCategoryStandardization(
      tenderId,
      categoryStandardization.standardCategories,
      withCategoryStandardization(objectMetadata(tender.metadata), categoryStandardization)
    );

    const languageScan = scanTenderLanguage(languageScanInputFromTender(tender));
    await this.repository.recordTenderLanguageScan(tender.id, languageScan);
    if (languageScan.riskLevel === 'High') {
      throw publishValidationError(
        [
          ...languageScan.issues.map((issue) => ({
            step: 'language-scan',
            field: issue.field,
            message: `${issue.type}: ${issue.suggestion}`,
            severity: 'error' as const
          }))
        ],
        409
      );
    }
    if (languageScan.riskLevel === 'Medium') {
      warnings.push(...languageScan.issues.map((issue) => `${issue.type}: ${issue.suggestion}`));
    }

    const visibility = targetVisibilityForMethod(tender.method);
    if (!visibility) {
      throw publishValidationError(
        [{ step: 'visibility', field: 'method', message: 'Unsupported procurement method for publication.', severity: 'error' }],
        400
      );
    }

    const adminOrgId = await this.repository.resolvePlatformOrganizationId(session.user.organizationId);
    const result = await this.repository.passTenderReview(
      tenderId,
      { adminOrgId, adminUserId: session.user.id, signatureKeyphrase: input.signatureKeyphrase },
      visibility
    );
    if (!result) throw requestError('Tender review item was not found.', 404);
    return result;
  }

  async failTenderReview(tenderId: string, token: string | undefined, input: TenderReviewFailInput): Promise<TenderReviewDecisionResponseDto> {
    const session = await this.identity.requireAdmin(token);
    const result = await this.repository.failTenderReview(tenderId, { adminUserId: session.user.id }, input);
    if (!result) throw requestError('Tender review item was not found.', 404);
    return result;
  }

  async closeTender(tenderId: string, token: string | undefined): Promise<CloseTenderResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.getTenderForClose(tenderId);
    if (!tender) throw requestError('Tender was not found.', 404);
    if (tender.buyerOrgId !== organizationId) throw requestError('Only the owner organization can close this tender.', 403);
    assertTenderClosable(tender);
    const closed = await this.repository.closeTender(tenderId, organizationId);
    if (!closed) throw requestError('Tender was not found.', 404);
    return closed;
  }

  async saveTender(tenderId: string, token: string | undefined): Promise<SaveTenderResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.saveTender(tenderId, { organizationId, userId: session.user.id });
  }

  async unsaveTender(tenderId: string, token: string | undefined): Promise<UnsaveTenderResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.unsaveTender(tenderId, organizationId);
  }

  async savedTenders(token: string | undefined): Promise<SavedTendersPayload> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.getSavedTenders(organizationId);
  }

  async planning(query: ProcurementPlanningQuery): Promise<ProcurementPlanningListDto> {
    try {
      return await this.repository.listPlans(query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyPlanningList(query);
      throw error;
    }
  }

  async planningSummary(query: ProcurementPlanningQuery) {
    const data = await this.planning({ ...query, page: 1, pageSize: 1 });
    return data.summary;
  }

  async getPlan(planId: string): Promise<ProcurementPlanDto | null> {
    return this.repository.getPlan(planId);
  }

  async saveAnnualPlan(input: SaveAnnualPlanInput): Promise<ProcurementPlanDto> {
    return this.repository.saveAnnualPlan(input);
  }

  async updatePlan(planId: string, input: UpdateProcurementPlanInput): Promise<ProcurementPlanDto | null> {
    return this.repository.updatePlan(planId, input);
  }

  async createPlanLine(planId: string, input: ProcurementPlanLineInput): Promise<ProcurementPlanLineDto | null> {
    return this.repository.createPlanLine(planId, input);
  }

  async updatePlanLine(lineId: string, input: ProcurementPlanLinePatchInput): Promise<ProcurementPlanLineDto | null> {
    return this.repository.updatePlanLine(lineId, input);
  }

  async deletePlanLine(lineId: string): Promise<ProcurementPlanLineDto | null> {
    return this.repository.deletePlanLine(lineId);
  }

  private async contextFromToken(token?: string) {
    if (!token) return {};
    try {
      const session = await this.identity.requireSession(token);
      return { organizationId: session.user.organizationId, userId: session.user.id };
    } catch {
      return {};
    }
  }

  private mapWelcomeData(data: WelcomeRepositoryData): PublicWelcomePayload {
    const participantCount = Math.max(data.participantCount, defaultWelcomePayload.stats.participantCount);
    const openTenderCount = Math.max(data.openTenderCount, defaultWelcomePayload.stats.openTenderCount);
    const verifiedProfileCompletionRate =
      data.participantCount > 0
        ? Math.min(
            100,
            Math.max(
              defaultWelcomePayload.stats.verifiedProfileCompletionRate,
              Math.round((data.verifiedUserCount / data.participantCount) * 1000) / 10
            )
          )
        : defaultWelcomePayload.stats.verifiedProfileCompletionRate;

    return {
      stats: {
        participantCount,
        participantLabel: formatParticipantLabel(participantCount),
        openTenderCount,
        verifiedProfileCompletionRate,
        activeWorkspaceLabel: defaultWelcomePayload.stats.activeWorkspaceLabel
      },
      featuredTenders: data.featuredTenders.length > 0 ? data.featuredTenders.map(mapTender) : defaultWelcomePayload.featuredTenders
    };
  }
}

type WelcomeRepositoryData = Awaited<ReturnType<ModuleRepository['getWelcomeData']>>;

function mapTender(tender: WelcomeRepositoryData['featuredTenders'][number]): PublicWelcomeTender {
  return {
    id: tender.id,
    reference: tender.reference,
    title: tender.title,
    buyerName: tender.buyerOrg.name,
    type: tender.type,
    status: tender.status,
    budget: tender.budget?.toString() ?? null,
    currency: tender.currency,
    location: tender.location,
    closingDate: tender.closingDate?.toISOString() ?? null,
    categories: tender.categories.map((category) => category.name)
  };
}

function formatParticipantLabel(count: number) {
  if (count >= 1000) return `Used by ${Math.floor(count / 1000).toLocaleString('en-US')},000+ participants`;
  return `Used by ${count.toLocaleString('en-US')}+ participants`;
}

const defaultWelcomePayload: PublicWelcomePayload = {
  stats: {
    participantCount: 2000,
    participantLabel: 'Used by 2,000+ participants',
    openTenderCount: 12,
    verifiedProfileCompletionRate: 98.4,
    activeWorkspaceLabel: 'Active workspace'
  },
  featuredTenders: [
    {
      id: 'welcome-featured-tender',
      reference: 'PX-OPEN-2026',
      title: 'Open procurement opportunities',
      buyerName: 'Verified procuring entities',
      type: 'OPEN_TENDER',
      status: 'OPEN',
      budget: null,
      currency: 'TZS',
      location: 'Tanzania',
      closingDate: null,
      categories: ['Goods', 'Services', 'Works']
    }
  ]
};

const defaultMarketplaceQuery: MarketplaceQuery = {
  search: '',
  category: '',
  type: '',
  budgetBand: '',
  status: '',
  includeClosed: false,
  visibility: '',
  sort: 'deadline',
  page: 1,
  limit: 20
};

function emptyMarketplace(query: MarketplaceQuery): ProcurementMarketplacePayload {
  return {
    tenders: [],
    recommendedTenders: [],
    invitedTenders: [],
    myTenders: [],
    myBids: [],
    summary: {
      openTenders: 0,
      myTenders: 0,
      myBids: 0,
      totalBudgetValue: 0,
      categoryCounts: [],
      closingSoon: 0
    },
    pagination: {
      page: query.page,
      limit: query.limit,
      matching: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) throw requestError('An organization profile is required.', 409);
  return organizationId;
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function withCategoryStandardization(metadata: Record<string, unknown>, standardization: CategoryStandardizationResultDto | null) {
  if (!standardization) return metadata;
  return {
    ...metadata,
    categoryStandardization: standardization
  };
}

function ownershipAndStatusIssues(tender: { buyerOrgId: string; status: TenderStatus }, organizationId: string): PublishValidationIssueDto[] {
  const errors: PublishValidationIssueDto[] = [];
  if (tender.buyerOrgId !== organizationId) {
    errors.push({
      step: 'ownership-status',
      field: 'buyerOrgId',
      message: 'Only the owner organization can publish this tender.',
      severity: 'error'
    });
  }
  if (tender.status !== TenderStatus.DRAFT && tender.status !== TenderStatus.REVIEW) {
    errors.push({
      step: 'ownership-status',
      field: 'status',
      message: 'Only draft or review tenders can be published.',
      severity: 'error'
    });
  }
  return errors;
}

function basicPublishIssues(tender: {
  title: string;
  type: unknown;
  description: string | null;
  budget: unknown;
  location: string | null;
  closingDate: Date | null;
  requirements: unknown;
}): PublishValidationIssueDto[] {
  const errors: PublishValidationIssueDto[] = [];
  if (!tender.title.trim()) errors.push(publishIssue('basic-fields', 'title', 'Tender title is required before publishing.'));
  if (!tender.type) errors.push(publishIssue('basic-fields', 'type', 'Tender type is required before publishing.'));
  if (!tender.description?.trim()) errors.push(publishIssue('basic-fields', 'description', 'Tender description is required before publishing.'));
  if (Number(tender.budget ?? 0) <= 0) errors.push(publishIssue('basic-fields', 'budget', 'Tender budget is required before publishing.'));
  if (!tender.location?.trim()) errors.push(publishIssue('basic-fields', 'location', 'Tender location is required before publishing.'));
  if (!tender.closingDate) {
    errors.push(publishIssue('basic-fields', 'closingDate', 'Tender closing date is required before publishing.'));
  } else if (tender.closingDate.getTime() <= Date.now()) {
    errors.push(publishIssue('basic-fields', 'closingDate', 'Tender closing date must be in the future.'));
  }
  if (!hasRequirements(tender.requirements)) errors.push(publishIssue('basic-fields', 'requirements', 'Tender requirements are required before publishing.'));
  return errors;
}

function schemaPublishIssues(tender: { type: CreateTenderInput['type']; requirements: unknown }): PublishValidationIssueDto[] {
  const validation = validateTenderDraftRequirements(tender.type, tender.requirements);
  return [
    ...validation.errors.map((message) => publishIssue('schema-required-fields', 'requirements', message)),
    ...validation.missingRequiredFields.map((field) =>
      publishIssue('schema-required-fields', field.path, `${field.label} is required before publishing.`)
    )
  ];
}

function evaluationCriteriaIssues(metadata: Record<string, unknown>): PublishValidationIssueDto[] {
  const criteria = metadata.evaluationCriteria;
  if (criteria === undefined || criteria === null) return [];
  const weights = evaluationWeights(criteria);
  if (weights.length === 0) {
    return [publishIssue('evaluation-criteria', 'metadata.evaluationCriteria', 'Evaluation criteria weights must total 100.')];
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return Math.abs(total - 100) <= 0.01
    ? []
    : [publishIssue('evaluation-criteria', 'metadata.evaluationCriteria', `Evaluation criteria weights must total 100. Current total is ${roundWeight(total)}.`)];
}

function categoryStandardizationWarnings(standardization: CategoryStandardizationResultDto) {
  const warnings: string[] = [];
  if (standardization.standardCategories.length === 0) {
    warnings.push('No standardized categories were found for this tender.');
  }
  for (const mapping of standardization.mappings) {
    if (mapping.confidence < 0.7) {
      warnings.push(`Low-confidence category mapping: ${mapping.rawCategory} -> ${mapping.standardCategory}.`);
    }
  }
  return warnings;
}

function targetVisibilityForMethod(method: unknown): Visibility | null {
  if (method === ProcurementMethod.OPEN_TENDER || String(method) === 'OPEN_TENDER') return Visibility.PUBLIC_MARKETPLACE;
  if (method === ProcurementMethod.INVITED_TENDER || String(method) === 'INVITED_TENDER') return Visibility.INVITED;
  return null;
}

function publishIssue(step: string, field: string, message: string): PublishValidationIssueDto {
  return { step, field, message, severity: 'error' };
}

function publishErrorStatus(errors: PublishValidationIssueDto[]) {
  return errors.some((error) => error.field === 'buyerOrgId') ? 403 : 409;
}

function evaluationWeights(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(evaluationWeights);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const ownWeight = numericValue(record.weight);
  const nested = ['criteria', 'items', 'rows', 'technical', 'financial']
    .flatMap((key) => evaluationWeights(record[key]));
  return ownWeight === null ? nested : [ownWeight, ...nested];
}

function numericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
}

let cachedS3Client: S3Client | null = null;

function s3Client() {
  if (cachedS3Client) return cachedS3Client;
  cachedS3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'us-east-1',
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
          }
        : undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
  });
  return cachedS3Client;
}

function requiredDocumentBucket() {
  const bucket = process.env.S3_DOCUMENT_BUCKET;
  if (!bucket) throw requestError('Document storage is not configured.', 503);
  return bucket;
}

function contentTypeForDocument(document: Pick<TenderDocumentStreamDto, 'documentType' | 'name'>) {
  const value = `${document.documentType} ${document.name}`.toLowerCase();
  if (value.includes('pdf')) return 'application/pdf';
  if (value.endsWith('.docx') || value.includes('word')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (value.endsWith('.xlsx') || value.includes('excel') || value.includes('spreadsheet')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (value.endsWith('.csv')) return 'text/csv';
  if (value.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

async function toNodeReadable(body: unknown): Promise<Readable> {
  if (!body) throw requestError('Document content was not available.', 502);
  if (body instanceof Readable) return body;
  if (typeof body === 'object' && body !== null && 'pipe' in body) return body as Readable;
  if (typeof body === 'object' && body !== null && 'transformToWebStream' in body) {
    const stream = (body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
    return Readable.fromWeb(stream as unknown as NodeReadableStream);
  }
  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Readable.from(Buffer.from(bytes));
  }
  if (body instanceof Uint8Array) return Readable.from(Buffer.from(body));
  throw requestError('Document content could not be streamed.', 502);
}

function assertTenderPublishable(tender: {
  title: string;
  type: unknown;
  description: string | null;
  budget: unknown;
  status: TenderStatus;
  location: string | null;
  closingDate: Date | null;
  requirements: unknown;
}) {
  if (tender.status !== TenderStatus.DRAFT && tender.status !== TenderStatus.REVIEW) {
    throw requestError('Only draft or review tenders can be published.', 409);
  }
  if (!tender.title.trim()) throw requestError('Tender title is required before publishing.', 400);
  if (!tender.type) throw requestError('Tender type is required before publishing.', 400);
  if (!tender.description?.trim()) throw requestError('Tender description is required before publishing.', 400);
  if (Number(tender.budget ?? 0) <= 0) throw requestError('Tender budget is required before publishing.', 400);
  if (!tender.location?.trim()) throw requestError('Tender location is required before publishing.', 400);
  if (!tender.closingDate) throw requestError('Tender closing date is required before publishing.', 400);
  if (tender.closingDate.getTime() <= Date.now()) throw requestError('Tender closing date must be in the future.', 400);
  if (!hasRequirements(tender.requirements)) throw requestError('Tender requirements are required before publishing.', 400);
}

function assertTenderClosable(tender: { status: TenderStatus }) {
  if (tender.status !== TenderStatus.OPEN && tender.status !== TenderStatus.PUBLISHED) {
    throw requestError('Only open or published tenders can be closed.', 409);
  }
}

function assertTenderDesignComplete(tender: { type: CreateTenderInput['type']; requirements: unknown }) {
  const validation = validateTenderDraftRequirements(tender.type, tender.requirements);
  if (validation.errors.length > 0) throw requestError(validation.errors[0], 400);
  if (validation.missingRequiredFields.length > 0) {
    const labels = validation.missingRequiredFields.map((field) => field.label).join(', ');
    throw requestError(`Tender requirements are incomplete: ${labels}.`, 400);
  }
}

function languageScanInputFromTender(tender: {
  title: string;
  description: string | null;
  requirements: unknown;
  metadata: unknown;
  closingDate: Date | null;
}): TenderLanguageScanInput {
  const metadata = objectMetadata(tender.metadata);
  const evaluationCriteria = objectMetadata(metadata.evaluationCriteria);
  return {
    title: tender.title,
    description: tender.description ?? '',
    requirements: objectMetadata(tender.requirements),
    evaluationCriteria,
    metadata: {
      ...metadata,
      closingDate: tender.closingDate?.toISOString() ?? ''
    }
  };
}

function isEditableTenderStatus(status: TenderStatus) {
  return status === TenderStatus.DRAFT || status === TenderStatus.REVIEW;
}

function hasRequirements(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function emptyPlanningList(query: ProcurementPlanningQuery): ProcurementPlanningListDto {
  return {
    plans: [],
    records: [],
    summary: {
      financialYear: query.financialYear || null,
      years: query.financialYear ? [query.financialYear] : [],
      totalPlans: 0,
      totalLines: 0,
      totalBudget: 0,
      byStatus: [],
      byCategory: []
    },
    totalPlans: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 1
  };
}

function isDatabaseUnavailable(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return code === 'P1001' || code === 'P2024' || message.includes("can't reach database") || message.includes('database_url');
}
