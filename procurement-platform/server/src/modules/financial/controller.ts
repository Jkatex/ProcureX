/* Translates financial HTTP requests into service calls while normalizing responses and errors for Express. */
import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { moduleStatusQuerySchema } from './validators.js';

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
}

