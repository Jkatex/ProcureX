/* Coordinates integration business rules across repositories and peer modules before data leaves the server boundary. */
import { ModuleRepository } from './repository.js';
import { moduleDefinition, type ModuleStatus } from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }
}

