import type { Request, RequestHandler } from 'express';
import { ModuleService } from './service.js';
import {
  bidDocumentParamsSchema,
  bidDocumentsBodySchema,
  bidDraftBodySchema,
  bidParamsSchema,
  bidSampleParamsSchema,
  bidSignatureBodySchema,
  createBidSampleBodySchema,
  moduleStatusQuerySchema,
  patchBidSampleBodySchema,
  tenderBidParamsSchema
} from './validators.js';
import { requestError } from '../shared/apiErrors.js';

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
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

  listMine: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.listMine(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  getTenderDraft: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderBidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid tender id.');
      res.json(await this.service.getDraft(bearerToken(req), params.data.tenderId));
    } catch (error) {
      next(error);
    }
  };

  getTenderSchema: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderBidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid tender id.');
      res.json({ success: true, data: await this.service.getTenderSchema(bearerToken(req), params.data.tenderId) });
    } catch (error) {
      next(error);
    }
  };

  saveTenderDraft: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderBidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid tender id.');
      const body = bidDraftBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid bid draft payload.');
      res.status(201).json(await this.service.saveDraft(bearerToken(req), params.data.tenderId, body.data));
    } catch (error) {
      next(error);
    }
  };

  getBid: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      res.json(await this.service.getBid(bearerToken(req), params.data.bidId));
    } catch (error) {
      next(error);
    }
  };

  patchBid: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      const body = bidDraftBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid bid draft payload.');
      res.json(await this.service.patchBid(bearerToken(req), params.data.bidId, body.data));
    } catch (error) {
      next(error);
    }
  };

  addDocuments: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      if (req.is('multipart/form-data')) {
        res.status(201).json(await this.service.addMultipartDocuments(bearerToken(req), params.data.bidId, req));
        return;
      }
      const body = bidDocumentsBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid bid document payload.');
      res.status(201).json(await this.service.addDocuments(bearerToken(req), params.data.bidId, body.data.documents));
    } catch (error) {
      next(error);
    }
  };

  deleteDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = bidDocumentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid document id.');
      res.json(await this.service.deleteDocument(bearerToken(req), params.data.bidId, params.data.documentId));
    } catch (error) {
      next(error);
    }
  };

  createSample: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      const body = createBidSampleBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid bid sample payload.');
      res.status(201).json(await this.service.createSample(bearerToken(req), params.data.bidId, body.data));
    } catch (error) {
      next(error);
    }
  };

  listSamples: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      res.json(await this.service.listSamples(bearerToken(req), params.data.bidId));
    } catch (error) {
      next(error);
    }
  };

  patchSample: RequestHandler = async (req, res, next) => {
    try {
      const params = bidSampleParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid sample id.');
      const body = patchBidSampleBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid bid sample payload.');
      res.json(await this.service.patchSample(bearerToken(req), params.data.bidId, params.data.sampleId, body.data));
    } catch (error) {
      next(error);
    }
  };

  submit: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      const body = bidSignatureBodySchema.safeParse(req.body ?? {});
      if (!body.success) throw requestError('Digital signature keyphrase is required.');
      res.status(201).json(await this.service.submit(bearerToken(req), params.data.bidId, body.data));
    } catch (error) {
      next(error);
    }
  };

  withdraw: RequestHandler = async (req, res, next) => {
    try {
      const params = bidParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid bid id.');
      const body = bidSignatureBodySchema.safeParse(req.body ?? {});
      if (!body.success) throw requestError('Digital signature keyphrase is required.');
      res.json(await this.service.withdraw(bearerToken(req), params.data.bidId, body.data));
    } catch (error) {
      next(error);
    }
  };
}
