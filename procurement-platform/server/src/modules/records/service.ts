import { ModuleRepository } from './repository.js';
import {
  moduleDefinition,
  type ProcurementRecordDto,
  type RecordsChartsDto,
  type RecordsDashboardDto,
  type RecordsInsightsDto,
  type RecordsListDto,
  type RecordsQuery,
  type ModuleStatus
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

  async dashboard(): Promise<RecordsDashboardDto> {
    try {
      return await this.repository.getDashboardData();
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyDashboard;
      throw error;
    }
  }

  async records(query: RecordsQuery): Promise<RecordsListDto> {
    try {
      const data = await this.repository.listRecords(query);

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

  async charts(query: RecordsQuery): Promise<RecordsChartsDto> {
    try {
      return await this.repository.getCharts(query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyCharts;
      throw error;
    }
  }

  async insights(query: RecordsQuery): Promise<RecordsInsightsDto> {
    try {
      return await this.repository.getInsights(query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyInsights;
      throw error;
    }
  }

  async exportCsv(query: RecordsQuery) {
    try {
      const records = (await this.repository.listAllRecords(query)).map(toDto);
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

  async exportPdf(query: RecordsQuery) {
    try {
      const records = (await this.repository.listAllRecords(query)).map(toDto);
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
}

const emptyDashboard: RecordsDashboardDto = {
  tenderRecords: 0,
  bidRecords: 0,
  contractRecords: 0,
  evidenceFiles: 0,
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

