import type { Request, RequestHandler } from 'express';
import type { SupportTicketStatus } from '@prisma/client';
import { requestAuditContext } from '../shared/audit.js';
import { ModuleService } from './service.js';
import {
  addCommentSchema,
  createTicketSchema,
  moduleStatusQuerySchema,
  publicContactSchema,
  ticketListQuerySchema,
  ticketParamsSchema,
  updateTicketStatusSchema
} from './validators.js';

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService()) {}

  private async recordAccessDenied(req: Request, error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 500;
    if (status !== 401 && status !== 403) return;
    try {
      await this.service.recordAccessDenied({
        ...requestAuditContext(req),
        path: req.path,
        method: req.method
      });
    } catch {
      // Keep the original authorization response intact.
    }
  }

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  tickets: RequestHandler = async (req, res, next) => {
    try {
      const query = ticketListQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid support ticket query parameters.');
      res.json(await this.service.listTickets(bearerToken(req), query.data as { status?: SupportTicketStatus; ownerOrgId?: string }));
    } catch (error) {
      await this.recordAccessDenied(req, error);
      next(error);
    }
  };

  createTicket: RequestHandler = async (req, res, next) => {
    try {
      const body = createTicketSchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid support ticket payload.');
      res.status(201).json(await this.service.createTicket(bearerToken(req), body.data, requestAuditContext(req)));
    } catch (error) {
      await this.recordAccessDenied(req, error);
      next(error);
    }
  };

  publicContact: RequestHandler = async (req, res, next) => {
    try {
      const body = publicContactSchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contact support payload.');
      res.status(202).json(await this.service.publicContact(body.data, requestAuditContext(req)));
    } catch (error) {
      next(error);
    }
  };

  ticket: RequestHandler = async (req, res, next) => {
    try {
      const params = ticketParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid support ticket id.');
      res.json(await this.service.getTicket(bearerToken(req), params.data.id));
    } catch (error) {
      await this.recordAccessDenied(req, error);
      next(error);
    }
  };

  addComment: RequestHandler = async (req, res, next) => {
    try {
      const params = ticketParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid support ticket id.');
      const body = addCommentSchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid support ticket comment payload.');
      res.status(201).json(await this.service.addComment(bearerToken(req), params.data.id, body.data, requestAuditContext(req)));
    } catch (error) {
      await this.recordAccessDenied(req, error);
      next(error);
    }
  };

  updateStatus: RequestHandler = async (req, res, next) => {
    try {
      const params = ticketParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid support ticket id.');
      const body = updateTicketStatusSchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid support ticket status payload.');
      res.json(await this.service.updateStatus(bearerToken(req), params.data.id, body.data.status as SupportTicketStatus, requestAuditContext(req)));
    } catch (error) {
      await this.recordAccessDenied(req, error);
      next(error);
    }
  };
}
