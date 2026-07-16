import type { IncomingMessage } from 'node:http';
import { ModuleRepository } from './repository.js';
import { parseAndStoreDocumentUpload, removeStoredDocument } from './storage.js';
import {
  moduleDefinition,
  type DocumentContentAccessMode,
  type DocumentObjectDto,
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

  async upload(req: IncomingMessage, context: DocumentRequestContext): Promise<DocumentObjectDto> {
    const upload = await parseAndStoreDocumentUpload(req, { organizationId: context.organizationId });
    try {
      return await this.repository.createUploadedDocument(upload, context);
    } catch (error) {
      await removeStoredDocument(upload.objectKey, upload.metadata).catch(() => undefined);
      throw error;
    }
  }

  content(id: string, context: DocumentRequestContext, mode: DocumentContentAccessMode = 'open') {
    return this.repository.content(id, context, mode);
  }

  officialTemplates(query: { documentType?: string; procurementType?: string; language?: 'en' | 'sw' }) {
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

  approveDocument(id: string, input: OfficialDocumentActionInput, context: DocumentRequestContext) {
    return this.repository.approveDocument(id, input, context);
  }

  signDocument(id: string, input: OfficialDocumentActionInput, context: DocumentRequestContext) {
    return this.repository.signDocument(id, input, context);
  }
}
