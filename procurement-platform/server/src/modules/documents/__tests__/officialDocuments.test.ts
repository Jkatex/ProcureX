import { describe, expect, it } from 'vitest';
import { buildOfficialPdfSections, validateOfficialSource, type OfficialSourceSnapshot } from '../officialDocumentBuilder.js';
import { renderOfficialPdf } from '../officialPdfRenderer.js';
import { sha256 } from '../officialStorage.js';
import { findOfficialTemplate, officialTemplateDefinitions } from '../officialTemplates.js';
import { officialDocumentTypes, type OfficialProcurementType } from '../types.js';

describe('official document templates', () => {
  it('selects the correct tender template for each procurement type', () => {
    const cases: Array<[OfficialProcurementType, string]> = [
      ['GOODS', 'TZ-PPRA-TENDER-GOODS-EN-1'],
      ['WORKS', 'TZ-PPRA-TENDER-WORKS-EN-1'],
      ['NON_CONSULTANCY', 'TZ-PPRA-TENDER-NONCONSULTANCY-EN-1'],
      ['CONSULTANCY', 'TZ-PPRA-TENDER-CONSULTANCY-EN-1']
    ];

    for (const [procurementType, code] of cases) {
      expect(findOfficialTemplate({ documentType: 'TENDER_DOCUMENT', procurementType })?.code).toBe(code);
    }
  });

  it('selects Swahili template variants when requested', () => {
    const template = findOfficialTemplate({ documentType: 'TENDER_DOCUMENT', procurementType: 'GOODS', language: 'sw' });

    expect(template?.code).toBe('TZ-PPRA-TENDER-GOODS-SW-1');
    expect(template?.name).toBe('Waraka wa Zabuni ya Bidhaa');
    expect(template?.language).toBe('sw');
  });

  it('has at least one template for every official document type', () => {
    for (const documentType of officialDocumentTypes) {
      expect(officialTemplateDefinitions.some((template) => template.documentType === documentType)).toBe(true);
    }
  });
});

describe('official document validation and rendering', () => {
  it('reports missing required tender fields before official-ready generation', () => {
    const template = findOfficialTemplate({ documentType: 'TENDER_DOCUMENT', procurementType: 'GOODS' });
    expect(template).not.toBeNull();

    const warnings = validateOfficialSource(template!, {
      sourceModule: 'procurement',
      sourceEntityType: 'tender',
      sourceEntityId: 'tender-1',
      title: 'Supply of ICT equipment',
      reference: 'TDR-001'
    });

    expect(warnings.map((warning) => warning.path)).toEqual(expect.arrayContaining(['ownerName', 'procurementType', 'closingDate']));
  });

  it('renders a hashable official-ready PDF buffer', async () => {
    const template = findOfficialTemplate({ documentType: 'TENDER_DOCUMENT', procurementType: 'GOODS' });
    expect(template).not.toBeNull();
    const source: OfficialSourceSnapshot = {
      sourceModule: 'procurement',
      sourceEntityType: 'tender',
      sourceEntityId: 'tender-1',
      ownerOrgId: 'org-1',
      ownerName: 'Sample Procuring Entity',
      title: 'Supply of ICT equipment',
      reference: 'TDR-001',
      procurementType: 'GOODS',
      closingDate: new Date('2026-08-30T10:00:00.000Z'),
      items: [{ label: 'Item 1', value: 'Laptop computers, quantity 10, delivery Dar es Salaam' }]
    };

    const pdf = await renderOfficialPdf({
      title: `${template!.name} - ${source.title}`,
      subtitle: 'Official-ready procurement lifecycle document',
      reference: source.reference,
      status: 'DRAFT - UNSIGNED',
      generatedAt: new Date('2026-07-14T00:00:00.000Z'),
      metadataRows: [{ label: 'Template code', value: template!.code }],
      sections: buildOfficialPdfSections(template!, source),
      watermark: 'DRAFT'
    });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(sha256(pdf)).toMatch(/^[a-f0-9]{64}$/);
  });
});
