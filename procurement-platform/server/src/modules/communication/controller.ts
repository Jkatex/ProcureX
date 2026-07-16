import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import {
  communicationQuerySchema,
  composeMessageBodySchema,
  messageAttachmentParamsSchema,
  messageParamsSchema,
  moduleStatusQuerySchema,
  patchMessageBodySchema,
  recipientQuerySchema,
  replyMessageBodySchema,
  tenderLinkQuerySchema
} from './validators.js';
import { requestError } from '../shared/apiErrors.js';

function bearerToken(req: Parameters<RequestHandler>[0]) {
  const header = req.header('authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined;
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

  messages: RequestHandler = async (req, res, next) => {
    try {
      const query = communicationQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid communication query parameters.');
      res.json(await this.service.listMessages(bearerToken(req), query.data));
    } catch (error) {
      next(error);
    }
  };

  message: RequestHandler = async (req, res, next) => {
    try {
      const params = messageParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid message id.');
      const message = await this.service.getMessage(bearerToken(req), params.data.messageId);
      if (!message) throw requestError('Communication message was not found.', 404);
      res.json(message);
    } catch (error) {
      next(error);
    }
  };

  compose: RequestHandler = async (req, res, next) => {
    try {
      const body = composeMessageBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid communication message payload.');
      const result = await this.service.composeMessage(bearerToken(req), body.data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  reply: RequestHandler = async (req, res, next) => {
    try {
      const params = messageParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid message id.');
      const body = replyMessageBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid communication reply payload.');
      const result = await this.service.reply(bearerToken(req), params.data.messageId, body.data);
      if (!result) throw requestError('Communication message was not found.', 404);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  patch: RequestHandler = async (req, res, next) => {
    try {
      const params = messageParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid message id.');
      const body = patchMessageBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid communication patch payload.');
      const result = await this.service.patchMessage(bearerToken(req), params.data.messageId, body.data);
      if (!result) throw requestError('Communication message was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  markRead: RequestHandler = async (req, res, next) => {
    try {
      const params = messageParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid message id.');
      const result = await this.service.markRead(bearerToken(req), params.data.messageId);
      if (!result) throw requestError('Communication message was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  attachment: RequestHandler = async (req, res, next) => {
    try {
      const params = messageAttachmentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid attachment id.');
      const file = await this.service.getAttachment(
        bearerToken(req),
        params.data.messageId,
        params.data.attachmentId
      );
      if (!file) throw requestError('Communication attachment was not found.', 404);
      res.type(file.mimeType);
      res.setHeader('Content-Disposition', attachmentDisposition(params.data.disposition, file.name));
      res.setHeader('Content-Length', String(file.content.byteLength));
      res.send(file.content);
    } catch (error) {
      next(error);
    }
  };

  archive: RequestHandler = async (req, res, next) => {
    try {
      const params = messageParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid message id.');
      const result = await this.service.archive(bearerToken(req), params.data.messageId);
      if (!result) throw requestError('Communication message was not found.', 404);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  recipients: RequestHandler = async (req, res, next) => {
    try {
      const query = recipientQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid communication recipient query parameters.');
      res.json({ recipients: await this.service.listRecipients(bearerToken(req), query.data) });
    } catch (error) {
      next(error);
    }
  };

  tenderLinks: RequestHandler = async (req, res, next) => {
    try {
      const query = tenderLinkQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid communication tender query parameters.');
      res.json({ tenders: await this.service.listTenderLinks(bearerToken(req), query.data) });
    } catch (error) {
      next(error);
    }
  };
}

function attachmentDisposition(disposition: 'open' | 'download', fileName: string) {
  const mode = disposition === 'download' ? 'attachment' : 'inline';
  const safeName = fileName.replace(/[\\"]/g, '_');
  return `${mode}; filename="${safeName}"`;
}

