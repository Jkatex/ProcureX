import type { RequestHandler, Response } from 'express';
import type { ZodError } from 'zod';
import { MARKETPLACE_UNAVAILABLE_CODE, MARKETPLACE_UNAVAILABLE_MESSAGE, ModuleService, PUBLISH_VALIDATION_FAILED_CODE } from './service.js';
import {
  buyerNoticeBodySchema,
  contactVerificationStartBodySchema,
  contactVerificationVerifyBodySchema,
  createTenderBodySchema,
  designFormSchemaParamsSchema,
  designFormSchemasQuerySchema,
  emptyActionBodySchema,
  failTenderReviewBodySchema,
  masterDataGroupParamsSchema,
  masterDataQuerySchema,
  moduleStatusQuerySchema,
  marketplaceQuerySchema,
  patchPlanLineBodySchema,
  planLineBodySchema,
  planLineParamsSchema,
  planParamsSchema,
  planningQuerySchema,
  publicWelcomeQuerySchema,
  publishTenderBodySchema,
  scanLanguageBodySchema,
  saveAnnualPlanBodySchema,
  standardizeCategoryBodySchema,
  taxonomyQuerySchema,
  tenderReviewQuerySchema,
  tenderAmendmentBodySchema,
  tenderAmendmentParamsSchema,
  tenderAmendmentPatchBodySchema,
  tenderDocumentDownloadParamsSchema,
  tenderParamsSchema,
  updateTenderBodySchema,
  updatePlanBodySchema
} from './validators.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function validationResponse(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }))
  });
}

function isMarketplaceUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  return candidate.code === MARKETPLACE_UNAVAILABLE_CODE && candidate.status === 503;
}

function isPublishValidationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; errors?: unknown };
  return candidate.code === PUBLISH_VALIDATION_FAILED_CODE && Array.isArray(candidate.errors);
}

export class ModuleController {
  constructor(private readonly service = new ModuleService()) {}

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  publicWelcome: RequestHandler = async (req, res, next) => {
    try {
      publicWelcomeQuerySchema.parse(req.query);
      res.json(await this.service.publicWelcome());
    } catch (error) {
      next(error);
    }
  };

  masterData: RequestHandler = async (req, res, next) => {
    try {
      masterDataQuerySchema.parse(req.query);
      res.json(await this.service.masterData());
    } catch (error) {
      next(error);
    }
  };

  masterDataGroup: RequestHandler = async (req, res, next) => {
    try {
      const params = masterDataGroupParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const group = await this.service.masterDataGroup(params.data.group);
      if (!group) throw requestError('Master data group was not found.', 404);
      res.json(group);
    } catch (error) {
      next(error);
    }
  };

  designFormSchemas: RequestHandler = async (req, res, next) => {
    try {
      designFormSchemasQuerySchema.parse(req.query);
      res.json(await this.service.designFormSchemas());
    } catch (error) {
      next(error);
    }
  };

  designFormSchema: RequestHandler = async (req, res, next) => {
    try {
      const params = designFormSchemaParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const schema = await this.service.designFormSchema(params.data.type);
      if (!schema) throw requestError('Form schema type was not found.', 404);
      res.json(schema);
    } catch (error) {
      next(error);
    }
  };

  taxonomy: RequestHandler = async (req, res, next) => {
    try {
      taxonomyQuerySchema.parse(req.query);
      res.json(await this.service.taxonomy());
    } catch (error) {
      next(error);
    }
  };

  standardizeCategory: RequestHandler = async (req, res, next) => {
    try {
      const body = standardizeCategoryBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.standardizeCategory(body.data));
    } catch (error) {
      next(error);
    }
  };

  scanLanguage: RequestHandler = async (req, res, next) => {
    try {
      const body = scanLanguageBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.scanTenderLanguage(bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  marketplace: RequestHandler = async (req, res, next) => {
    try {
      const query = marketplaceQuerySchema.safeParse(req.query);
      if (!query.success) return validationResponse(res, query.error);
      res.json(await this.service.marketplace(bearerToken(req), query.data));
    } catch (error) {
      if (isMarketplaceUnavailableError(error)) {
        res.status(503).json({
          success: false,
          message: MARKETPLACE_UNAVAILABLE_MESSAGE
        });
        return;
      }
      next(error);
    }
  };

  listTenderReviews: RequestHandler = async (req, res, next) => {
    try {
      const query = tenderReviewQuerySchema.safeParse(req.query);
      if (!query.success) return validationResponse(res, query.error);
      res.json(await this.service.listTenderReviews(bearerToken(req), query.data));
    } catch (error) {
      next(error);
    }
  };

  getTenderReview: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const tender = await this.service.getTenderReview(params.data.tenderId, bearerToken(req));
      if (!tender) throw requestError('Tender review item was not found.', 404);
      res.json(tender);
    } catch (error) {
      next(error);
    }
  };

  passTenderReview: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = publishTenderBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.passTenderReview(params.data.tenderId, bearerToken(req), body.data));
    } catch (error) {
      if (isPublishValidationError(error)) {
        const candidate = error as { status?: number; errors: unknown[] };
        res.status(candidate.status ?? 400).json({
          success: false,
          message: 'Tender cannot be published',
          errors: candidate.errors
        });
        return;
      }
      next(error);
    }
  };

  failTenderReview: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = failTenderReviewBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.failTenderReview(params.data.tenderId, bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  startContactVerification: RequestHandler = async (req, res, next) => {
    try {
      const body = contactVerificationStartBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      res.status(201).json(await this.service.startContactVerification(bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  verifyContactVerification: RequestHandler = async (req, res, next) => {
    try {
      const body = contactVerificationVerifyBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.verifyContactVerification(bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  createTender: RequestHandler = async (req, res, next) => {
    try {
      const body = createTenderBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      res.status(201).json(await this.service.createTender(bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  updateTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = updateTenderBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      const tender = await this.service.updateTender(params.data.tenderId, bearerToken(req), body.data);
      if (!tender) throw requestError('Tender was not found.', 404);
      res.json(tender);
    } catch (error) {
      next(error);
    }
  };

  deleteTenderDraft: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const tender = await this.service.deleteTenderDraft(params.data.tenderId, bearerToken(req));
      if (!tender) throw requestError('Tender draft was not found.', 404);
      res.json(tender);
    } catch (error) {
      next(error);
    }
  };

  updateTenderBuyerNotice: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = buyerNoticeBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      const result = await this.service.updateTenderBuyerNotice(params.data.tenderId, bearerToken(req), body.data);
      if (!result) throw requestError('Tender was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getTenderDetail: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const tender = await this.service.getTenderDetail(params.data.tenderId, bearerToken(req));
      if (!tender) throw requestError('Tender was not found.', 404);
      res.json(tender);
    } catch (error) {
      next(error);
    }
  };

  recordTenderDocumentDownload: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderDocumentDownloadParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const result = await this.service.recordTenderDocumentDownload(params.data.tenderId, params.data.documentId, bearerToken(req));
      if (!result) throw requestError('Tender document was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  tenderBuyerLogo: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const image = await this.service.tenderBuyerLogo(params.data.tenderId, bearerToken(req));
      if (!image) throw requestError('Buyer logo was not found.', 404);
      res.setHeader('Content-Disposition', `inline; filename="${safeHeaderFilename(image.filename)}"`);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.type(image.contentType).send(image.body);
    } catch (error) {
      next(error);
    }
  };

  openTenderDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderDocumentDownloadParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const result = await this.service.tenderDocumentStream(params.data.tenderId, params.data.documentId, 'inline', bearerToken(req));
      if (!result) throw requestError('Tender document was not found.', 404);
      streamTenderDocument(res, result, 'inline', next);
    } catch (error) {
      next(error);
    }
  };

  downloadTenderDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderDocumentDownloadParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const result = await this.service.tenderDocumentStream(params.data.tenderId, params.data.documentId, 'attachment', bearerToken(req));
      if (!result) throw requestError('Tender document was not found.', 404);
      streamTenderDocument(res, result, 'attachment', next);
    } catch (error) {
      next(error);
    }
  };

  listTenderAmendments: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const result = await this.service.listTenderAmendments(params.data.tenderId, bearerToken(req));
      if (!result) throw requestError('Tender was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createTenderAmendment: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = tenderAmendmentBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      const result = await this.service.createTenderAmendment(params.data.tenderId, bearerToken(req), body.data);
      if (!result) throw requestError('Tender was not found.', 404);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateTenderAmendment: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderAmendmentParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = tenderAmendmentPatchBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      const result = await this.service.updateTenderAmendment(params.data.tenderId, params.data.amendmentId, bearerToken(req), body.data);
      if (!result) throw requestError('Tender amendment was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  publishTenderAmendment: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderAmendmentParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = publishTenderBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      const result = await this.service.publishTenderAmendment(params.data.tenderId, params.data.amendmentId, bearerToken(req), body.data);
      if (!result) throw requestError('Tender amendment was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  cancelTenderAmendment: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderAmendmentParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = emptyActionBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      const result = await this.service.cancelTenderAmendment(params.data.tenderId, params.data.amendmentId, bearerToken(req));
      if (!result) throw requestError('Tender amendment was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  openEvaluation: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = publishTenderBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.openEvaluation(params.data.tenderId, bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  savedTenders: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.savedTenders(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  saveTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      res.json(await this.service.saveTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  unsaveTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      res.json(await this.service.unsaveTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  publishTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = publishTenderBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.publishTender(params.data.tenderId, bearerToken(req), body.data));
    } catch (error) {
      if (isPublishValidationError(error)) {
        const candidate = error as { status?: number; errors: unknown[] };
        res.status(candidate.status ?? 400).json({
          success: false,
          message: 'Tender cannot be published',
          errors: candidate.errors
        });
        return;
      }
      next(error);
    }
  };

  closeTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      res.json(await this.service.closeTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  planning: RequestHandler = async (req, res, next) => {
    try {
      const query = planningQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid procurement planning query parameters.');
      res.json(await this.service.planning(query.data));
    } catch (error) {
      next(error);
    }
  };

  planningSummary: RequestHandler = async (req, res, next) => {
    try {
      const query = planningQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid procurement planning summary query parameters.');
      res.json(await this.service.planningSummary(query.data));
    } catch (error) {
      next(error);
    }
  };

  saveAnnualPlan: RequestHandler = async (req, res, next) => {
    try {
      const body = saveAnnualPlanBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid annual procurement plan payload.');
      res.status(201).json(await this.service.saveAnnualPlan(body.data));
    } catch (error) {
      next(error);
    }
  };

  getPlan: RequestHandler = async (req, res, next) => {
    try {
      const params = planParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan id.');
      const plan = await this.service.getPlan(params.data.planId);
      if (!plan) throw requestError('Procurement plan was not found.', 404);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  };

  updatePlan: RequestHandler = async (req, res, next) => {
    try {
      const params = planParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan id.');
      const body = updatePlanBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid procurement plan update payload.');
      const plan = await this.service.updatePlan(params.data.planId, body.data);
      if (!plan) throw requestError('Procurement plan was not found.', 404);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  };

  createPlanLine: RequestHandler = async (req, res, next) => {
    try {
      const params = planParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan id.');
      const body = planLineBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid procurement plan line payload.');
      const line = await this.service.createPlanLine(params.data.planId, body.data);
      if (!line) throw requestError('Procurement plan was not found.', 404);
      res.status(201).json(line);
    } catch (error) {
      next(error);
    }
  };

  updatePlanLine: RequestHandler = async (req, res, next) => {
    try {
      const params = planLineParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan line id.');
      const body = patchPlanLineBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid procurement plan line update payload.');
      const line = await this.service.updatePlanLine(params.data.lineId, body.data);
      if (!line) throw requestError('Procurement plan line was not found.', 404);
      res.json(line);
    } catch (error) {
      next(error);
    }
  };

  deletePlanLine: RequestHandler = async (req, res, next) => {
    try {
      const params = planLineParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan line id.');
      const line = await this.service.deletePlanLine(params.data.lineId);
      if (!line) throw requestError('Procurement plan line was not found.', 404);
      res.json(line);
    } catch (error) {
      next(error);
    }
  };
}

function bearerToken(req: Parameters<RequestHandler>[0]) {
  const header = req.header('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return undefined;
  return header.slice(7).trim();
}

function streamTenderDocument(
  res: Response,
  result: Awaited<ReturnType<ModuleService['tenderDocumentStream']>> & NonNullable<Awaited<ReturnType<ModuleService['tenderDocumentStream']>>>,
  disposition: 'inline' | 'attachment',
  next: Parameters<RequestHandler>[2]
) {
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeHeaderFilename(result.document.name)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (typeof result.contentLength === 'number') res.setHeader('Content-Length', String(result.contentLength));
  result.stream.on('error', (error) => {
    if (!res.headersSent) next(error);
    else res.destroy(error);
  });
  result.stream.pipe(res);
}

function safeHeaderFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, '_') || 'document';
}
