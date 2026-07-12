import { prisma } from '../../db/prisma.js';
import type { DocumentContent, DocumentRequestContext } from './types.js';

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
    const rows = [
      ['Document name', document.name],
      ['Document type', document.documentType],
      ['Object key', document.objectKey],
      ['Checksum', document.checksum ?? 'Not recorded'],
      ['Created', document.createdAt.toISOString()],
      ['Metadata', JSON.stringify(metadata)]
    ];
    return {
      filename: `${safeFilename(document.name)}.html`,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
        <html>
          <head><meta charset="utf-8"><title>${escapeHtml(document.name)}</title></head>
          <body style="font-family: Arial, sans-serif; color: #172033; max-width: 820px; margin: 32px auto; line-height: 1.5;">
            <h1>${escapeHtml(document.name)}</h1>
            <p>This secure preview is generated from the ProcureX document record.</p>
            <table style="width:100%;border-collapse:collapse;">
              <tbody>${rows.map(([label, value]) => `<tr><th style="text-align:left;border:1px solid #d8dee8;padding:10px;width:180px;">${escapeHtml(label)}</th><td style="border:1px solid #d8dee8;padding:10px;">${escapeHtml(value)}</td></tr>`).join('')}</tbody>
            </table>
          </body>
        </html>`
    };
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
}
