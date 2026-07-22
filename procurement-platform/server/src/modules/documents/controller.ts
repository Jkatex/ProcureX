/* Translates documents HTTP requests into service calls while normalizing responses and errors for Express. */
import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { requestLanguage } from '../shared/localization.js';
import type { SupportedLanguage } from '@procurex/shared';
import {
  documentParamsSchema,
  moduleStatusQuerySchema,
  officialActionBodySchema,
  officialDocumentParamsSchema,
  officialGenerateBodySchema,
  officialTemplateQuerySchema
} from './validators.js';
import type { DocumentRequestContext } from './types.js';
import { requestError } from '../shared/apiErrors.js';

function bearerToken(header = '') {
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService(), private readonly identityService = new IdentityService()) {}

  private async requireContext(authorization = '', language: SupportedLanguage = 'en'): Promise<DocumentRequestContext> {
    const session = await this.identityService.requireSession(bearerToken(authorization));
    return {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      isAdmin: session.user.accountType === 'ADMIN',
      language: session.user.preferences?.preferredLanguage ?? language
    };
  }

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  content: RequestHandler = async (req, res, next) => {
    try {
      const params = documentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid document id.');
      const download = req.query.download === 'true';
      const document = await this.service.content(params.data.id, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req)), download ? 'download' : 'open');
      if (download) res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
      res.type(document.contentType).send(document.body);
    } catch (error) {
      next(error);
    }
  };

  upload: RequestHandler = async (req, res, next) => {
    try {
      const context = await this.requireContext(req.header('authorization') ?? '', requestLanguage(req));
      res.status(201).json(await this.service.upload(req, context));
    } catch (error) {
      next(error);
    }
  };

  officialTemplates: RequestHandler = async (req, res, next) => {
    try {
      const query = officialTemplateQuerySchema.parse(req.query);
      res.json(await this.service.officialTemplates({ ...query, language: query.language ?? requestLanguage(req) }));
    } catch (error) {
      next(error);
    }
  };

  generateOfficialDocument: RequestHandler = async (req, res, next) => {
    try {
      const input = officialGenerateBodySchema.parse(req.body);
      const context = await this.requireContext(req.header('authorization') ?? '', input.language ?? requestLanguage(req));
      res.status(201).json(await this.service.generateOfficialDocument(input, context));
    } catch (error) {
      next(error);
    }
  };

  openOfficialDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = officialDocumentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid official document id.');
      const document = await this.service.officialDocumentFile(params.data.id, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req)));
      res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
      res.type(document.contentType).send(document.body);
    } catch (error) {
      next(error);
    }
  };

  downloadOfficialDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = officialDocumentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid official document id.');
      const document = await this.service.officialDocumentFile(params.data.id, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req)));
      res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
      res.type(document.contentType).send(document.body);
    } catch (error) {
      next(error);
    }
  };

  officialDocumentVersions: RequestHandler = async (req, res, next) => {
    try {
      const params = officialDocumentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid official document id.');
      res.json(await this.service.officialDocumentVersions(params.data.id, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req))));
    } catch (error) {
      next(error);
    }
  };

  approveOfficialDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = officialDocumentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid official document id.');
      const input = officialActionBodySchema.parse(req.body ?? {});
      res.json(await this.service.approveOfficialDocument(params.data.id, input, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req))));
    } catch (error) {
      next(error);
    }
  };

  signOfficialDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = officialDocumentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid official document id.');
      const input = officialActionBodySchema.parse(req.body ?? {});
      res.json(await this.service.signOfficialDocument(params.data.id, input, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req))));
    } catch (error) {
      next(error);
    }
  };

  approveDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = documentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid document id.');
      const input = officialActionBodySchema.parse(req.body ?? {});
      res.json(await this.service.approveDocument(params.data.id, input, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req))));
    } catch (error) {
      next(error);
    }
  };

  signDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = documentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid document id.');
      const input = officialActionBodySchema.parse(req.body ?? {});
      res.json(await this.service.signDocument(params.data.id, input, await this.requireContext(req.header('authorization') ?? '', requestLanguage(req))));
    } catch (error) {
      next(error);
    }
  };
}
