import { prisma } from '../../db/prisma.js';
import {
  buildOfficialPdfSections,
  documentControlRows,
  validateOfficialSource,
  validationWarningRows,
  type OfficialSourceSnapshot
} from './officialDocumentBuilder.js';
import { renderOfficialPdf } from './officialPdfRenderer.js';
import { readOfficialPdf, safeFilename as safeOfficialFilename, sha256, storeOfficialPdf } from './officialStorage.js';
import { findOfficialTemplate, listOfficialTemplateDtos, type OfficialTemplateDefinition } from './officialTemplates.js';
import { loadOfficialSource } from './officialSourceLoader.js';
import type {
  DocumentContent,
  DocumentRequestContext,
  OfficialDocumentActionInput,
  OfficialDocumentFile,
  OfficialDocumentGenerateInput,
  OfficialDocumentGenerateResponse,
  OfficialDocumentStatus,
  OfficialDocumentVersionDto,
  OfficialProcurementType,
  OfficialTemplateDto,
  OfficialValidationWarning
} from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

function documentCopy(language: 'en' | 'sw' | undefined) {
  if (language === 'sw') {
    return {
      securePreview: 'Muonekano huu salama umetengenezwa kutoka rekodi ya waraka wa ProcureX.',
      documentName: 'Jina la waraka',
      documentType: 'Aina ya waraka',
      objectKey: 'Ufunguo wa hifadhi',
      checksum: 'Checksum',
      created: 'Imeundwa',
      metadata: 'Metadata',
      notRecorded: 'Haijarekodiwa',
      blockingValidationReport: 'Ripoti ya Uthibitishaji Inayozuia',
      validationBlocked: 'Utengenezaji rasmi umezuiwa kwa sababu taarifa za lazima za mtiririko hazijakamilika',
      officialReadyDocument: 'Waraka wa mzunguko wa ununuzi ulio tayari kwa matumizi rasmi',
      validationRequired: 'RASIMU - UTHIBITISHAJI UNAHITAJIKA',
      draftUnsigned: 'RASIMU - HAIJASAINIWA',
      watermarkValidation: 'UTHIBITISHAJI UNAHITAJIKA',
      watermarkDraft: 'RASIMU'
    };
  }
  return {
    securePreview: 'This secure preview is generated from the ProcureX document record.',
    documentName: 'Document name',
    documentType: 'Document type',
    objectKey: 'Object key',
    checksum: 'Checksum',
    created: 'Created',
    metadata: 'Metadata',
    notRecorded: 'Not recorded',
    blockingValidationReport: 'Blocking Validation Report',
    validationBlocked: 'Official-ready generation blocked by missing required workflow data',
    officialReadyDocument: 'Official-ready procurement lifecycle document',
    validationRequired: 'DRAFT - VALIDATION REQUIRED',
    draftUnsigned: 'DRAFT - UNSIGNED',
    watermarkValidation: 'VALIDATION REQUIRED',
    watermarkDraft: 'DRAFT'
  };
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class ModuleRepository {
  constructor(private readonly db = prisma) {}

  async health() {
    return { ready: true };
  }

  async content(id: string, context: DocumentRequestContext): Promise<DocumentContent> {
    const document = await this.db.documentObject.findUnique({
      where: { id },
      include: {
        tenderDocuments: {
          include: { tender: { select: { buyerOrgId: true, reference: true, title: true } } }
        },
        bidDocuments: {
          include: { bid: { select: { buyerOrgId: true, supplierOrgId: true, reference: true } } }
        },
        contractVersions: {
          include: { contract: { select: { buyerOrgId: true, supplierOrgId: true, reference: true } } }
        },
        contractMilestoneEvidence: {
          include: { milestone: { include: { contract: { select: { buyerOrgId: true, supplierOrgId: true, reference: true } } } } }
        },
        terminationEvidence: {
          include: { termination: { include: { contract: { select: { buyerOrgId: true, supplierOrgId: true, reference: true } } } } }
        }
      }
    });
    if (!document) throw requestError('Document was not found.', 404);
    if (!this.canReadDocument(document, context)) throw requestError('Document is not visible to this organization.', 403);

    const metadata = objectPayload(document.metadata);
    const copy = documentCopy(context.language);
    const contentBase64 = typeof metadata.contentBase64 === 'string' ? metadata.contentBase64 : '';
    const mimeType = typeof metadata.mimeType === 'string' && metadata.mimeType.trim() ? metadata.mimeType.trim() : '';
    if (contentBase64 && mimeType) {
      return {
        filename: safeFilename(document.name),
        contentType: mimeType,
        body: Buffer.from(contentBase64, 'base64')
      };
    }

    const rows = [
      [copy.documentName, document.name],
      [copy.documentType, document.documentType],
      [copy.objectKey, document.objectKey],
      [copy.checksum, document.checksum ?? copy.notRecorded],
      [copy.created, document.createdAt.toISOString()],
      [copy.metadata, JSON.stringify(metadata)]
    ];
    return {
      filename: `${safeFilename(document.name)}.html`,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
        <html>
          <head><meta charset="utf-8"><title>${escapeHtml(document.name)}</title></head>
          <body style="font-family: Arial, sans-serif; color: #172033; max-width: 820px; margin: 32px auto; line-height: 1.5;">
            <h1>${escapeHtml(document.name)}</h1>
            <p>${escapeHtml(copy.securePreview)}</p>
            <table style="width:100%;border-collapse:collapse;">
              <tbody>${rows.map(([label, value]) => `<tr><th style="text-align:left;border:1px solid #d8dee8;padding:10px;width:180px;">${escapeHtml(label)}</th><td style="border:1px solid #d8dee8;padding:10px;">${escapeHtml(value)}</td></tr>`).join('')}</tbody>
            </table>
          </body>
        </html>`
    };
  }

  async listOfficialTemplates(query: { documentType?: string; procurementType?: string; language?: 'en' | 'sw' } = {}): Promise<OfficialTemplateDto[]> {
    return listOfficialTemplateDtos(query.language ?? 'en').filter((template) => {
      if (query.documentType && template.documentType !== query.documentType) return false;
      if (query.procurementType && template.procurementType !== query.procurementType) return false;
      return true;
    });
  }

  async generateOfficialDocument(input: OfficialDocumentGenerateInput, context: DocumentRequestContext): Promise<OfficialDocumentGenerateResponse> {
    const source = await loadOfficialSource(this.db as any, input);
    if (!this.canAccessOfficialSource(source, context)) throw requestError('Official document source is not visible to this organization.', 403);

    const procurementType = input.procurementType ?? (source.procurementType as OfficialProcurementType | undefined);
    const template = findOfficialTemplate({
      templateCode: input.templateCode,
      documentType: input.documentType,
      procurementType,
      language: input.language ?? context.language ?? 'en'
    });
    if (!template) throw requestError('No official document template matches the requested document type and procurement type.', 404);

    const templateRecord = await this.upsertOfficialTemplate(template);
    const validationWarnings = validateOfficialSource(template, source);
    const versionNo = await this.nextOfficialVersionNo(input);
    const generatedAt = new Date();
    const status: OfficialDocumentStatus = 'DRAFT';
    const copy = documentCopy(template.language);
    const pdf = await renderOfficialPdf({
      title: validationWarnings.length ? `${copy.blockingValidationReport} - ${template.name}` : `${template.name} - ${source.title}`,
      subtitle: validationWarnings.length ? copy.validationBlocked : copy.officialReadyDocument,
      reference: source.reference,
      status: validationWarnings.length ? copy.validationRequired : copy.draftUnsigned,
      generatedAt,
      metadataRows: documentControlRows({
        template,
        source,
        versionNo,
        status,
        generatedAt,
        generatedByUserId: context.userId
      }),
      validationWarnings: validationWarnings.length ? validationWarningRows(validationWarnings) : undefined,
      sections: buildOfficialPdfSections(template, source),
      watermark: validationWarnings.length ? copy.watermarkValidation : copy.watermarkDraft
    });
    const stored = await storeOfficialPdf({
      body: pdf,
      sourceModule: input.sourceModule,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      documentType: input.documentType,
      versionNo,
      reference: source.reference
    });
    const documentObject = await this.db.documentObject.create({
      data: {
        ownerOrgId: source.ownerOrgId ?? null,
        uploadedByUserId: context.userId ?? null,
        name: `${source.reference} - ${template.name} v${versionNo}`,
        objectKey: stored.objectKey,
        documentType: input.documentType,
        checksum: stored.checksum,
        metadata: {
          officialDocument: true,
          templateCode: template.code,
          templateVersion: template.version,
          sourceModule: input.sourceModule,
          sourceEntityType: input.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          validationWarningCount: validationWarnings.length
        } as any
      }
    });
    const version = await this.db.officialDocumentVersion.create({
      data: {
        templateId: templateRecord.id,
        documentObjectId: documentObject.id,
        ownerOrgId: source.ownerOrgId ?? null,
        generatedByUserId: context.userId ?? null,
        sourceModule: input.sourceModule,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        documentType: input.documentType,
        procurementType: procurementType ?? template.procurementType ?? null,
        title: source.title,
        reference: source.reference,
        versionNo,
        templateVersion: template.version,
        status,
        contentHash: stored.checksum,
        pdfObjectKey: stored.objectKey,
        pdfSizeBytes: stored.sizeBytes,
        validationWarnings: validationWarnings as any,
        metadata: {
          sourceTitle: source.title,
          sourceStatus: source.documentStatus,
          validationReport: validationWarnings.length > 0,
          sourceUrl: template.sourceUrl,
          visibleOrgIds: source.visibleOrgIds ?? [],
          publicVisible: Boolean(source.publicVisible)
        } as any,
        generatedAt
      }
    });
    await this.createOfficialAuditEvent('documents.official.generated', version, context, {
      templateCode: template.code,
      validationWarningCount: validationWarnings.length
    });

    return {
      document: this.officialVersionDto(version, template.code),
      validationWarnings
    };
  }

  async getOfficialDocumentFile(id: string, context: DocumentRequestContext): Promise<OfficialDocumentFile> {
    const version = await this.findOfficialVersionForAccess(id, context);
    return {
      filename: `${safeOfficialFilename(`${version.reference}-v${version.versionNo}-${version.documentType}`)}.pdf`,
      contentType: 'application/pdf',
      body: await readOfficialPdf(version.pdfObjectKey)
    };
  }

  async listOfficialVersions(id: string, context: DocumentRequestContext): Promise<OfficialDocumentVersionDto[]> {
    const version = await this.findOfficialVersionForAccess(id, context);
    const versions = await this.db.officialDocumentVersion.findMany({
      where: {
        sourceModule: version.sourceModule,
        sourceEntityType: version.sourceEntityType,
        sourceEntityId: version.sourceEntityId,
        documentType: version.documentType
      },
      orderBy: { versionNo: 'desc' },
      include: { template: true }
    });
    return versions.map((item) => this.officialVersionDto(item, item.template?.code ?? null));
  }

  async approveOfficialDocument(id: string, input: OfficialDocumentActionInput, context: DocumentRequestContext): Promise<OfficialDocumentVersionDto> {
    const existing = await this.findOfficialVersionForAccess(id, context);
    if (!this.canManageOfficialVersion(existing, context)) throw requestError('Permission to approve this official document is required.', 403);
    this.assertCanMarkOfficial(existing);
    const approvedAt = new Date();
    const approvalMetadata = {
      ...objectPayload(existing.approvalMetadata),
      approvedByUserId: context.userId ?? null,
      approvedByOrgId: context.organizationId ?? null,
      approvedAt: approvedAt.toISOString(),
      note: input.note ?? null,
      contentHash: existing.contentHash
    };
    const version = await this.db.officialDocumentVersion.update({
      where: { id },
      data: {
        status: 'OFFICIAL',
        officialAt: approvedAt,
        approvalMetadata: approvalMetadata as any
      },
      include: { template: true }
    });
    await this.createOfficialAuditEvent('documents.official.approved', version, context, { note: input.note ?? null });
    return this.officialVersionDto(version, version.template?.code ?? null);
  }

  async signOfficialDocument(id: string, input: OfficialDocumentActionInput, context: DocumentRequestContext): Promise<OfficialDocumentVersionDto> {
    const existing = await this.findOfficialVersionForAccess(id, context);
    if (!this.canManageOfficialVersion(existing, context)) throw requestError('Permission to sign this official document is required.', 403);
    this.assertCanMarkOfficial(existing);
    const signedAt = new Date();
    const signaturePayload = {
      versionId: existing.id,
      contentHash: existing.contentHash,
      signerUserId: context.userId ?? null,
      signerOrgId: context.organizationId ?? null,
      signedAt: signedAt.toISOString(),
      keyphraseProof: input.signatureKeyphrase ? sha256(input.signatureKeyphrase) : null
    };
    const signatureMetadata = {
      ...objectPayload(existing.signatureMetadata),
      signerUserId: context.userId ?? null,
      signerOrgId: context.organizationId ?? null,
      signedAt: signedAt.toISOString(),
      note: input.note ?? null,
      contentHash: existing.contentHash,
      signatureHash: sha256(JSON.stringify(signaturePayload))
    };
    const version = await this.db.officialDocumentVersion.update({
      where: { id },
      data: {
        status: 'OFFICIAL',
        officialAt: signedAt,
        signatureMetadata: signatureMetadata as any
      },
      include: { template: true }
    });
    await this.createOfficialAuditEvent('documents.official.signed', version, context, {
      note: input.note ?? null,
      signatureHash: signatureMetadata.signatureHash
    });
    return this.officialVersionDto(version, version.template?.code ?? null);
  }

  private canReadDocument(document: any, context: DocumentRequestContext) {
    if (context.isAdmin) return true;
    const organizationId = context.organizationId;
    if (!organizationId) return false;
    if (document.ownerOrgId === organizationId) return true;

    const tenderDocuments = (document.tenderDocuments ?? []) as Array<{ tender: { buyerOrgId: string } }>;
    if (tenderDocuments.some((row) => row.tender.buyerOrgId === organizationId)) return true;

    const bidDocuments = (document.bidDocuments ?? []) as Array<{ bid: { buyerOrgId: string; supplierOrgId: string } }>;
    if (bidDocuments.some((row) => row.bid.buyerOrgId === organizationId || row.bid.supplierOrgId === organizationId)) return true;

    const contractVersions = (document.contractVersions ?? []) as Array<{ contract: { buyerOrgId: string; supplierOrgId: string | null } }>;
    if (contractVersions.some((row) => row.contract.buyerOrgId === organizationId || row.contract.supplierOrgId === organizationId)) return true;

    const milestoneEvidence = (document.contractMilestoneEvidence ?? []) as Array<{ milestone: { contract: { buyerOrgId: string; supplierOrgId: string | null } } }>;
    if (milestoneEvidence.some((row) => row.milestone.contract.buyerOrgId === organizationId || row.milestone.contract.supplierOrgId === organizationId)) return true;

    const terminationEvidence = (document.terminationEvidence ?? []) as Array<{ termination: { contract: { buyerOrgId: string; supplierOrgId: string | null } } }>;
    return terminationEvidence.some((row) => row.termination.contract.buyerOrgId === organizationId || row.termination.contract.supplierOrgId === organizationId);
  }

  private async upsertOfficialTemplate(template: OfficialTemplateDefinition) {
    return this.db.officialDocumentTemplate.upsert({
      where: { code: template.code },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        documentType: template.documentType,
        procurementType: template.procurementType,
        jurisdiction: template.jurisdiction,
        language: template.language,
        version: template.version,
        status: template.status,
        sourceAuthority: template.sourceAuthority,
        sourceUrl: template.sourceUrl,
        sections: template.sections as any,
        requiredFields: template.requiredFields as any,
        metadata: { staticRegistry: true } as any
      },
      update: {
        name: template.name,
        description: template.description,
        documentType: template.documentType,
        procurementType: template.procurementType,
        jurisdiction: template.jurisdiction,
        language: template.language,
        version: template.version,
        status: template.status,
        sourceAuthority: template.sourceAuthority,
        sourceUrl: template.sourceUrl,
        sections: template.sections as any,
        requiredFields: template.requiredFields as any
      }
    });
  }

  private async nextOfficialVersionNo(input: OfficialDocumentGenerateInput) {
    const latest = await this.db.officialDocumentVersion.findFirst({
      where: {
        sourceModule: input.sourceModule,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        documentType: input.documentType
      },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true }
    });
    return (latest?.versionNo ?? 0) + 1;
  }

  private canAccessOfficialSource(source: OfficialSourceSnapshot, context: DocumentRequestContext) {
    if (context.isAdmin) return true;
    if (source.publicVisible) return true;
    if (!context.organizationId) return false;
    return Boolean(source.visibleOrgIds?.includes(context.organizationId) || source.ownerOrgId === context.organizationId);
  }

  private canAccessOfficialVersion(version: any, context: DocumentRequestContext) {
    if (context.isAdmin) return true;
    if (!context.organizationId) return false;
    const metadata = objectPayload(version.metadata);
    if (metadata.publicVisible) return true;
    const visibleOrgIds = Array.isArray(metadata.visibleOrgIds) ? metadata.visibleOrgIds : [];
    return version.ownerOrgId === context.organizationId || visibleOrgIds.includes(context.organizationId);
  }

  private canManageOfficialVersion(version: any, context: DocumentRequestContext) {
    if (context.isAdmin) return true;
    if (!context.organizationId) return false;
    return version.ownerOrgId === context.organizationId;
  }

  private async findOfficialVersionForAccess(id: string, context: DocumentRequestContext) {
    const version = await this.db.officialDocumentVersion.findUnique({
      where: { id },
      include: { template: true }
    });
    if (!version) throw requestError('Official document version was not found.', 404);
    if (!this.canAccessOfficialVersion(version, context)) throw requestError('Official document version is not visible to this organization.', 403);
    return version;
  }

  private assertCanMarkOfficial(version: any) {
    if (version.status === 'VOID') throw requestError('Voided official document versions cannot be approved or signed.', 409);
    const warnings = Array.isArray(version.validationWarnings) ? version.validationWarnings : [];
    if (warnings.length) throw requestError('This generated PDF is a blocking validation report. Regenerate after completing required fields.', 422);
  }

  private officialVersionDto(version: any, templateCode: string | null): OfficialDocumentVersionDto {
    return {
      id: version.id,
      templateCode,
      documentObjectId: version.documentObjectId ?? null,
      sourceModule: version.sourceModule,
      sourceEntityType: version.sourceEntityType,
      sourceEntityId: version.sourceEntityId,
      documentType: version.documentType,
      procurementType: version.procurementType ?? null,
      title: version.title,
      reference: version.reference,
      versionNo: version.versionNo,
      templateVersion: version.templateVersion,
      status: version.status as OfficialDocumentStatus,
      contentHash: version.contentHash,
      pdfObjectKey: version.pdfObjectKey,
      pdfSizeBytes: version.pdfSizeBytes,
      validationWarnings: arrayPayload<OfficialValidationWarning>(version.validationWarnings),
      approvalMetadata: objectPayload(version.approvalMetadata),
      signatureMetadata: objectPayload(version.signatureMetadata),
      generatedAt: version.generatedAt.toISOString(),
      officialAt: version.officialAt?.toISOString() ?? null,
      voidedAt: version.voidedAt?.toISOString() ?? null,
      openUrl: `/api/documents/official/${version.id}/open`,
      downloadUrl: `/api/documents/official/${version.id}/download`
    };
  }

  private async createOfficialAuditEvent(event: string, version: any, context: DocumentRequestContext, payload: Record<string, unknown>) {
    if (!this.db.auditEvent?.create) return;
    await this.db.auditEvent.create({
      data: {
        ownerOrgId: version.ownerOrgId ?? null,
        actorUserId: context.userId ?? null,
        event,
        entityType: 'official_document_version',
        entityRef: version.id,
        severity: 'INFO',
        payload: {
          documentType: version.documentType,
          sourceModule: version.sourceModule,
          sourceEntityType: version.sourceEntityType,
          sourceEntityId: version.sourceEntityId,
          versionNo: version.versionNo,
          contentHash: version.contentHash,
          ...payload
        } as any
      }
    });
  }
}

function arrayPayload<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
