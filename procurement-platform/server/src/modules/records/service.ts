import { ModuleRepository } from './repository.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import {
  moduleDefinition,
  type ProcurementRecordDto,
  type RecordsAuditDto,
  type RecordsChartsDto,
  type RecordsDashboardDto,
  type RecordsDetailDto,
  type RecordsDocumentDto,
  type RecordsInsightsDto,
  type RecordsListDto,
  type RecordsQuery,
  type RecordsRequestContext,
  type ModuleStatus
} from './types.js';
import { requestError } from '../shared/apiErrors.js';

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly identity = new IdentityService()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async dashboard(context?: RecordsRequestContext): Promise<RecordsDashboardDto> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.getDashboardData(accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyDashboard;
      throw error;
    }
  }

  async records(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsListDto> {
    const accessContext = await this.accessContext(context);
    try {
      const data = await this.repository.listRecords(query, accessContext);

      return {
        ...data,
        records: data.records.map(toDto)
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return {
          records: [],
          totalRecords: 0,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: 1
        };
      }
      throw error;
    }
  }

  async charts(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsChartsDto> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.getCharts(query, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyCharts;
      throw error;
    }
  }

  async insights(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsInsightsDto> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.getInsights(query, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyInsights;
      throw error;
    }
  }

  async detail(recordId: string, context?: RecordsRequestContext): Promise<RecordsDetailDto | null> {
    const accessContext = await this.accessContext(context);
    try {
      const detail = await this.repository.getRecordDetail(recordId, accessContext);
      return detail ? { ...detail, record: toDto(detail.record) } : null;
    } catch (error) {
      if (isDatabaseUnavailable(error)) return null;
      throw error;
    }
  }

  async lifecycle(recordId: string, context?: RecordsRequestContext) {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.getLifecycle(recordId, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async documents(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsDocumentDto[]> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.listDocuments(query, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async recordDocuments(recordId: string, context?: RecordsRequestContext): Promise<RecordsDocumentDto[]> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.getRecordDocuments(recordId, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async audit(query: RecordsQuery, context?: RecordsRequestContext): Promise<RecordsAuditDto[]> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.listAuditEvents(query, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async recordAudit(recordId: string, context?: RecordsRequestContext): Promise<RecordsAuditDto[]> {
    const accessContext = await this.accessContext(context);
    try {
      return await this.repository.getRecordAudit(recordId, accessContext);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return [];
      throw error;
    }
  }

  async exportCsv(query: RecordsQuery, context?: RecordsRequestContext) {
    const accessContext = await this.accessContext(context);
    try {
      const records = (await this.repository.listAllRecords(query, accessContext)).map(toDto);
      return {
        filename: `procurex-records-${dateStamp()}.csv`,
        content: buildCsv(records)
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return {
          filename: `procurex-records-${dateStamp()}.csv`,
          content: buildCsv([])
        };
      }
      throw error;
    }
  }

  async exportPdf(query: RecordsQuery, context?: RecordsRequestContext) {
    const accessContext = await this.accessContext(context);
    try {
      const records = (await this.repository.listAllRecords(query, accessContext)).map(toDto);
      return {
        filename: `procurex-records-${dateStamp()}.pdf`,
        content: buildSimplePdf(records)
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return {
          filename: `procurex-records-${dateStamp()}.pdf`,
          content: buildSimplePdf([])
        };
      }
      throw error;
    }
  }

  private async accessContext(context?: RecordsRequestContext): Promise<RecordsRequestContext> {
    if (context?.token) {
      const session = await this.identity.requireSession(context.token);
      return {
        userId: session.user.id,
        organizationId: session.user.organizationId ?? undefined,
        isAdmin: session.user.accountType === 'ADMIN'
      };
    }

    if (context?.organizationId || context?.userId || context?.isAdmin) return context;
    throw requestError('Authentication is required.', 401);
  }
}

const emptyDashboard: RecordsDashboardDto = {
  tenderRecords: 0,
  bidRecords: 0,
  evaluationRecords: 0,
  awardRecords: 0,
  contractRecords: 0,
  activeContracts: 0,
  evidenceFiles: 0,
  archivedRecords: 0,
  recordedValue: 0,
  currency: 'TZS',
  totalRecords: 0
};

const emptyCharts: RecordsChartsDto = {
  tendersByStatus: [],
  procurementRecordsByMonth: [],
  contractValueByCategory: [],
  supplierParticipation: [],
  awardVsCancellationTrend: [],
  complianceCompletionSummary: [],
  categories: []
};

const emptyInsights: RecordsInsightsDto = {
  mostActiveCategory: null,
  highestValueRecord: null,
  bestSupplierParticipation: null,
  complianceCompletion: 0,
  awardSuccessRate: 0,
  averageTenderDuration: null
};

function toDto(record: Omit<ProcurementRecordDto, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }): ProcurementRecordDto {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function buildCsv(records: ProcurementRecordDto[]) {
  const headers = ['Date', 'Procurement Record', 'Reference', 'Type', 'Status', 'Value', 'Currency', 'Evidence'];
  const rows = records.map((record) => [
    record.createdAt,
    record.title,
    record.referenceNumber ?? '',
    record.recordType,
    record.status,
    record.valueAmount ?? '',
    record.currency,
    record.evidence.join('; ')
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildSimplePdf(records: ProcurementRecordDto[]) {
  const visibleRecords = records.slice(0, 36);
  const lines = [
    'ProcureX Records and History',
    `Generated: ${new Date().toISOString()}`,
    `Records exported: ${records.length}`,
    '',
    ...(visibleRecords.length
      ? visibleRecords.map((record) => `${record.createdAt.slice(0, 10)} | ${record.recordType} | ${record.status} | ${record.title}`)
      : ['No procurement records are available for the selected filters.'])
  ];
  const stream = lines
    .flatMap((line, index) => [
      `BT /F1 ${index === 0 ? 18 : 10} Tf 50 ${780 - index * 18} Td (${pdfText(line).slice(0, 120)}) Tj ET`
    ])
    .join('\n');

  return pdfDocument(stream);
}

function pdfDocument(stream: string) {
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, 'utf8');
}

function pdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function isDatabaseUnavailable(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return code === 'P1001' || code === 'P2024' || message.includes("can't reach database") || message.includes('database_url');
}

