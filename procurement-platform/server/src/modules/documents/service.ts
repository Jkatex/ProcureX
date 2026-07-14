import { ModuleRepository } from './repository.js';
import {
  moduleDefinition,
  type DocumentRequestContext,
  type ModuleStatus,
  type OfficialDocumentActionInput,
  type OfficialDocumentGenerateInput
} from './types.js';

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

  officialTemplates(query: { documentType?: string; procurementType?: string }) {
    return this.repository.listOfficialTemplates(query);
  }

  generateOfficialDocument(input: OfficialDocumentGenerateInput, context: DocumentRequestContext) {
    return this.repository.generateOfficialDocument(input, context);
  }

  officialDocumentFile(id: string, context: DocumentRequestContext) {
    return this.repository.getOfficialDocumentFile(id, context);
  }

  officialDocumentVersions(id: string, context: DocumentRequestContext) {
    return this.repository.listOfficialVersions(id, context);
  }

  approveOfficialDocument(id: string, input: OfficialDocumentActionInput, context: DocumentRequestContext) {
    return this.repository.approveOfficialDocument(id, input, context);
  }

  signOfficialDocument(id: string, input: OfficialDocumentActionInput, context: DocumentRequestContext) {
    return this.repository.signOfficialDocument(id, input, context);
  }
}
