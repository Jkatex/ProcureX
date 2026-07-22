/* Supports the module contract ts server workflow with reusable logic kept close to the module that owns it. */
import type { Router } from 'express';

export type ModuleDefinition = {
  key: string;
  name: string;
  description: string;
};

export type RegisteredModule = ModuleDefinition & {
  basePath: string;
  router: Router;
};

