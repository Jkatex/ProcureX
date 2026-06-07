import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { moduleStatusQuerySchema, publicWelcomeQuerySchema } from './validators.js';

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
}
