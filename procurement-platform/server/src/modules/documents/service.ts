import { ModuleRepository } from './repository.js';
import { moduleDefinition, type DocumentRequestContext, type ModuleStatus } from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  content(id: string, context: DocumentRequestContext) {
    return this.repository.content(id, context);
  }
}
