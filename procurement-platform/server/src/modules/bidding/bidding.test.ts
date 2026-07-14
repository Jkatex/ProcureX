import { BidSampleStatus, BidStatus, EvaluationStage, TenderStatus, Visibility } from '@prisma/client';
import { createDecipheriv } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson, resolveBidEncryptionKey, sealBidPackage, sha256Hex, type CanonicalBidPackage } from './bidEncryption.service.js';
import { parseAndStoreBidDocuments } from './bidDocumentUpload.service.js';
import { buildBidSubmissionSchema } from './bidSubmissionSchema.service.js';
import { validateBidDraft } from './bidValidation.service.js';
import { ModuleController } from './controller.js';
import { ModuleRepository, tenderAcceptsBids, toBidDto } from './repository.js';
import { createModuleRouter } from './routes.js';
import { ModuleService } from './service.js';
import { ModuleService as EvaluationService } from '../evaluation/service.js';

const originalBidEncryptionKey = process.env.BID_ENCRYPTION_KEY;
const originalBidDocumentUploadDir = process.env.BID_DOCUMENT_UPLOAD_DIR;
const originalBidDocumentStorageDriver = process.env.BID_DOCUMENT_STORAGE_DRIVER;
const originalBidDocumentMaxBytes = process.env.BID_DOCUMENT_MAX_BYTES;

afterEach(() => {
  if (originalBidEncryptionKey === undefined) delete process.env.BID_ENCRYPTION_KEY;
  else process.env.BID_ENCRYPTION_KEY = originalBidEncryptionKey;
  if (originalBidDocumentUploadDir === undefined) delete process.env.BID_DOCUMENT_UPLOAD_DIR;
  else process.env.BID_DOCUMENT_UPLOAD_DIR = originalBidDocumentUploadDir;
  if (originalBidDocumentStorageDriver === undefined) delete process.env.BID_DOCUMENT_STORAGE_DRIVER;
  else process.env.BID_DOCUMENT_STORAGE_DRIVER = originalBidDocumentStorageDriver;
  if (originalBidDocumentMaxBytes === undefined) delete process.env.BID_DOCUMENT_MAX_BYTES;
  else process.env.BID_DOCUMENT_MAX_BYTES = originalBidDocumentMaxBytes;
});

describe('bidding encryption helpers', () => {
  it('generates stable canonical JSON and SHA-256 hashes for reordered objects', () => {
    const left = { b: 2, a: { d: 4, c: 3 } };
    const right = { a: { c: 3, d: 4 }, b: 2 };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(sha256Hex(canonicalJson(left))).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts 32-byte raw and base64 bid encryption keys', () => {
    const rawKey = '12345678901234567890123456789012';
    const base64Key = Buffer.from(rawKey, 'utf8').toString('base64');

    expect(resolveBidEncryptionKey(rawKey)?.toString('utf8')).toBe(rawKey);
    expect(resolveBidEncryptionKey(base64Key)?.toString('utf8')).toBe(rawKey);
  });

  it('rejects invalid bid encryption key lengths clearly', () => {
    expect(() => resolveBidEncryptionKey('short-key')).toThrow('BID_ENCRYPTION_KEY must be 32 bytes or base64-decode to 32 bytes.');
  });

  it('encrypts bid packages with AES-256-GCM metadata when a key is configured', () => {
    const key = '12345678901234567890123456789012';
    process.env.BID_ENCRYPTION_KEY = key;

    const sealed = sealBidPackage(canonicalBidPackageFixture(), 'COMBINED');

    expect(sealed).toMatchObject({
      version: 'bid-seal-v1',
      envelope: 'COMBINED',
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      sealedHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      encryption: {
        enabled: true,
        algorithm: 'aes-256-gcm',
        iv: expect.any(String),
        authTag: expect.any(String),
        keyRef: expect.stringMatching(/^bid-key:[a-f0-9]{16}$/)
      },
      sealedPayload: expect.any(String)
    });

    if (!sealed.encryption.enabled) throw new Error('expected encryption to be enabled');
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), Buffer.from(sealed.encryption.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(sealed.encryption.authTag, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(sealed.sealedPayload ?? '', 'base64')), decipher.final()]).toString('utf8');
    expect(decrypted).toBe(canonicalJson(canonicalBidPackageFixture()));
  });

  it('seals bid packages without raw payload when encryption is disabled', () => {
    delete process.env.BID_ENCRYPTION_KEY;

    const sealed = sealBidPackage(canonicalBidPackageFixture(), 'COMBINED');

    expect(sealed).toMatchObject({
      version: 'bid-seal-v1',
      encryption: { enabled: false },
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      sealedHash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    expect(sealed).not.toHaveProperty('sealedPayload');
    expect(JSON.stringify(sealed)).not.toContain('Medical equipment');
  });
});

describe('bidding document upload helpers', () => {
  it('stores multipart PDF uploads with checksum and safe local-dev metadata', async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), 'procurex-bid-docs-'));
    process.env.BID_DOCUMENT_UPLOAD_DIR = uploadDir;
    process.env.BID_DOCUMENT_STORAGE_DRIVER = 'local';
    const app = uploadParserApp();

    const response = await request(app)
      .post('/upload')
      .field('documentType', 'TECHNICAL_PRODUCT_SPEC')
      .field('envelope', 'TECHNICAL')
      .attach('file', Buffer.from('%PDF-1.4\nsecure document'), {
        filename: 'technical-proposal.pdf',
        contentType: 'application/pdf'
      })
      .expect(201);

    expect(response.body).toEqual([
      expect.objectContaining({
        name: 'technical-proposal.pdf',
        documentType: 'TECHNICAL_PRODUCT_SPEC',
        envelope: 'TECHNICAL',
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        objectKey: expect.stringContaining('bids/bid-1/'),
        metadata: expect.objectContaining({
          mimeType: 'application/pdf',
          size: 24,
          storage: 'local-dev'
        })
      })
    ]);
    expect(JSON.stringify(response.body)).not.toContain(uploadDir);
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('accepts repeated multipart files with shared metadata', async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), 'procurex-bid-docs-'));
    process.env.BID_DOCUMENT_UPLOAD_DIR = uploadDir;
    const app = uploadParserApp();

    const response = await request(app)
      .post('/upload')
      .field('documentType', 'BID_EVIDENCE')
      .field('envelope', 'COMBINED')
      .attach('files', Buffer.from('%PDF-1.4\none'), { filename: 'one.pdf', contentType: 'application/pdf' })
      .attach('files', Buffer.from('%PDF-1.4\ntwo'), { filename: 'two.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'one.pdf', documentType: 'BID_EVIDENCE', envelope: 'COMBINED' }),
        expect.objectContaining({ name: 'two.pdf', documentType: 'BID_EVIDENCE', envelope: 'COMBINED' })
      ])
    );
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('accepts schema-generated multipart document types', async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), 'procurex-bid-docs-'));
    process.env.BID_DOCUMENT_UPLOAD_DIR = uploadDir;
    const app = uploadParserApp();

    const response = await request(app)
      .post('/upload')
      .field('documentType', 'ADMIN_MANUFACTURER_AUTHORIZATION')
      .field('envelope', 'ADMINISTRATIVE')
      .field('metadata', JSON.stringify({ requirementKey: 'supportingDocumentRows.doc-1' }))
      .attach('file', Buffer.from('%PDF-1.4\nmanufacturer authorization'), {
        filename: 'manufacturer-authorization.pdf',
        contentType: 'application/pdf'
      })
      .expect(201);

    expect(response.body).toEqual([
      expect.objectContaining({
        name: 'manufacturer-authorization.pdf',
        documentType: 'ADMIN_MANUFACTURER_AUTHORIZATION',
        envelope: 'ADMINISTRATIVE',
        metadata: expect.objectContaining({ requirementKey: 'supportingDocumentRows.doc-1' })
      })
    ]);
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('rejects unsafe file extensions, spoofed PDF content, oversized files, and unknown document types', async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), 'procurex-bid-docs-'));
    process.env.BID_DOCUMENT_UPLOAD_DIR = uploadDir;
    const app = uploadParserApp();

    await request(app)
      .post('/upload')
      .field('documentType', 'TECHNICAL_PRODUCT_SPEC')
      .field('envelope', 'TECHNICAL')
      .attach('file', Buffer.from('MZ executable'), { filename: 'run.exe', contentType: 'application/x-msdownload' })
      .expect(400, { message: 'Unsupported bid document file type.' });

    await request(app)
      .post('/upload')
      .field('documentType', 'TECHNICAL_PRODUCT_SPEC')
      .field('envelope', 'TECHNICAL')
      .attach('file', Buffer.from('MZ not a pdf'), { filename: 'fake.pdf', contentType: 'application/pdf' })
      .expect(400, { message: 'Unsupported bid document file type.' });

    process.env.BID_DOCUMENT_MAX_BYTES = '8';
    await request(app)
      .post('/upload')
      .field('documentType', 'TECHNICAL_PRODUCT_SPEC')
      .field('envelope', 'TECHNICAL')
      .attach('file', Buffer.from('%PDF-1.4\nlarge'), { filename: 'large.pdf', contentType: 'application/pdf' })
      .expect(413, { message: 'Bid document exceeds the maximum upload size.' });
    process.env.BID_DOCUMENT_MAX_BYTES = originalBidDocumentMaxBytes;

    await request(app)
      .post('/upload')
      .field('documentType', 'UNKNOWN')
      .field('envelope', 'TECHNICAL')
      .attach('file', Buffer.from('%PDF-1.4\nsafe'), { filename: 'safe.pdf', contentType: 'application/pdf' })
      .expect(400, { message: 'Unsupported bid document type.' });

    await rm(uploadDir, { recursive: true, force: true });
  });
});

describe('bidding route registration smoke', () => {
  it.each([
    ['GET', '/tenders/not-a-uuid/schema'],
    ['GET', '/tenders/not-a-uuid/draft'],
    ['POST', '/tenders/not-a-uuid/draft'],
    ['PATCH', '/not-a-uuid'],
    ['POST', '/not-a-uuid/documents'],
    ['POST', '/not-a-uuid/submit'],
    ['POST', '/not-a-uuid/withdraw'],
    ['GET', '/not-a-uuid/samples'],
    ['POST', '/not-a-uuid/samples'],
    ['PATCH', '/not-a-uuid/samples/not-a-uuid']
  ])('%s %s reaches the bidding router', async (method, path) => {
    const response = await request(biddingRouterApp())[method.toLowerCase() as 'get' | 'post' | 'patch'](`/api/bidding${path}`).send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Invalid (bid|tender)/);
  });

  it('wraps tender schema responses in the public success envelope', async () => {
    const schema = buildBidSubmissionSchema(schemaTender({ id: '11111111-1111-4111-8111-111111111111' }));
    const service = {
      getTenderSchema: vi.fn().mockResolvedValue(schema)
    };
    const controller = new ModuleController(service as any);
    const req = {
      params: { tenderId: '11111111-1111-4111-8111-111111111111' },
      header: vi.fn().mockReturnValue('Bearer token-1')
    };
    const res = {
      json: vi.fn()
    };
    const next = vi.fn();

    await controller.getTenderSchema(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(service.getTenderSchema).toHaveBeenCalledWith('token-1', '11111111-1111-4111-8111-111111111111');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: schema });
  });
});

describe('bid submission schema builder', () => {
  it('derives a goods schema from normalized items and tender JSON requirements', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'GOODS',
        requirements: {
          goods: {
            fields: {
              productSpecificationTemplate: { rows: [{ id: 'spec-1', specificationName: 'Mattress size', mandatory: true }] },
              supportingDocumentRows: [{ id: 'doc-1', documentName: 'Manufacturer authorization', mandatory: true }],
              sampleRequirementRows: [{ id: 'sample-1', sampleDescription: 'Hospital bed sample', relatedBoqItemId: 'item-1', numberOfSamples: '2', deliveryLocation: 'PMU office', mandatory: true }]
            }
          },
          sampleRequirements: [{ id: 'sample-top', sampleName: 'Top-level sample', quantity: 1 }],
          summary: { requireSamples: 'Yes' }
        },
        metadata: { evaluationCriteria: [{ id: 'criteria-1', name: 'Technical compliance', weight: 70 }] },
        commercialItems: [
          { id: 'item-1', itemNo: '1', description: 'Hospital bed', quantity: 10, unit: 'Each', rate: 100, total: 1000, payload: { source: 'boq' } }
        ],
        documents: [{ label: 'Tender document', document: { id: 'doc-tender', name: 'beds.pdf', documentType: 'PDF' } }]
      })
    );

    expect(schema).toMatchObject({
      tenderId: 'tender-1',
      tenderReference: 'PX-2026-001',
      tenderTitle: 'Supply of medical equipment',
      tenderType: 'GOODS',
      schemaVersion: 'bid-submission-schema-v1'
    });
    expect(schema.steps.map((step) => step.id)).toEqual(['administrative', 'goodsTechnical', 'goodsFinancial', 'goodsSamples', 'goodsReview', 'goodsDeclaration']);
    expect(stepFields(schema, 'administrative')).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Manufacturer authorization', type: 'file', envelope: 'ADMINISTRATIVE', required: true })])
    );
    expect(stepFields(schema, 'technical')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Mattress size', envelope: 'TECHNICAL', responseType: 'text' }),
        expect.objectContaining({ requirementKey: 'evaluationCriteria.criteria-1', label: 'Response for Technical compliance' })
      ])
    );
    expect(stepFields(schema, 'financial')).toEqual([
      expect.objectContaining({ requirementKey: 'commercialItems.item-1.unitRate', label: 'Unit rate for Hospital bed', responseType: 'money' })
    ]);
    expect(stepFields(schema, 'samples')).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Top-level sample', required: true })]));
  });

  it('derives works capacity, technical, BOQ, and document fields', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'WORKS',
        requirements: {
          works: {
            fields: {
              boqRows: [{ id: 'boq-1', itemDescription: 'Partition works', quantity: 1, unitOfMeasure: 'Lot' }],
              similarCompletedProjectsRequired: true,
              personnelRequirementRows: [{ id: 'personnel-1', role: 'Site engineer', mandatory: true }],
              equipmentRequirementRows: [{ id: 'equipment-1', equipmentName: 'Concrete mixer', mandatory: true }],
              supportingDocumentRows: [{ id: 'doc-1', documentName: 'Contractor registration', mandatory: true }]
            }
          }
        }
      })
    );

    expect(schema.tenderType).toBe('WORKS');
    expect(schema.steps.map((step) => step.id)).toEqual(['administrative', 'worksCapacity', 'worksTechnicalProposal', 'worksFinancial', 'worksReview', 'worksDeclaration']);
    expect(stepFields(schema, 'technical').map((field) => field.label)).toEqual(expect.arrayContaining(['Similar completed project evidence', 'Site engineer', 'Concrete mixer']));
    const worksTechnicalFields = stepFields(schema, 'worksTechnicalProposal');
    expect(worksTechnicalFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementKey: 'works.proposal.understanding', label: 'Project Understanding' }),
        expect.objectContaining({ requirementKey: 'works.schedule.workProgramUpload', label: 'Upload work program', type: 'file' }),
        expect.objectContaining({ requirementKey: 'works.drawings.reviewedAcknowledgement', label: 'Drawing reviewed acknowledgement' }),
        expect.objectContaining({ requirementKey: 'works.design.alternativeProposed', label: 'Alternative Design Proposed?' })
      ])
    );
    const worksFinancialFields = stepFields(schema, 'financial');
    expect(worksFinancialFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirementKey: 'commercialItems.boq-1.unitRate',
        label: 'Unit rate for Partition works',
        validation: expect.objectContaining({ control: 'worksBoqCostBreakdown', itemId: 'boq-1', itemNo: '1', description: 'Partition works', quantity: 1, unit: 'Lot' })
      }),
      expect.objectContaining({ requirementKey: 'works.commercial.bidValidity', label: 'Bid Validity Period (days)' }),
      expect.objectContaining({ requirementKey: 'works.commercial.currency', label: 'Currency' }),
      expect.objectContaining({ requirementKey: 'works.commercial.bidSecurityDocument', label: 'Bid security document', type: 'file' })
    ]));
    const worksDeclarationFields = stepFields(schema, 'worksDeclaration');
    expect(worksDeclarationFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementKey: 'works.declaration.signatoryName', label: 'Authorized Signatory Name', type: 'text', required: true }),
        expect.objectContaining({ requirementKey: 'works.declaration.position', label: 'Position', type: 'text', required: true }),
        expect.objectContaining({
          requirementKey: 'works.declaration.companyStamp',
          label: 'Company stamp upload',
          type: 'file',
          required: false,
          validation: expect.objectContaining({ control: 'worksDeclaration', accept: '.pdf,.jpg,.jpeg,.png', documentType: 'DECLARATION_COMPANY_STAMP' })
        }),
        expect.objectContaining({ requirementKey: 'works.declaration.digitalSignature', label: 'Digital Signature', type: 'text', required: true, validation: expect.objectContaining({ placeholder: 'Type authorized digital signature' }) }),
        expect.objectContaining({ requirementKey: 'works.declaration.final', label: 'I confirm this works bid is complete, accurate, and authorized.', type: 'boolean', required: true }),
        expect.objectContaining({ requirementKey: 'works.declaration.conflict', label: 'I declare no conflict of interest.', type: 'boolean', required: true }),
        expect.objectContaining({ requirementKey: 'works.declaration.antiCorruption', label: 'I accept anti-corruption declarations.', type: 'boolean', required: true })
      ])
    );
    const administrativeFields = stepFields(schema, 'administrative');
    expect(administrativeFields).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Contractor registration', type: 'file' })]));
    expect(administrativeFields.map((field) => field.label)).not.toEqual(expect.arrayContaining(['Confirm authorized representative', 'Confirm similar project evidence']));
  });

  it('derives service BOQ rows when top-level commercial items are empty', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'SERVICE',
        commercialItems: [],
        requirements: {
          services: {
            fields: {
              serviceBoqRows: [{ id: 'service-boq-1', description: 'Monthly cleaning service', quantity: 12, unit: 'Month' }]
            }
          },
          commercialItems: []
        }
      })
    );

    expect(stepFields(schema, 'financial')).toEqual([
      expect.objectContaining({
        requirementKey: 'commercialItems.service-boq-1.unitRate',
        label: 'Unit rate for Monthly cleaning service',
        validation: expect.objectContaining({ itemId: 'service-boq-1', itemNo: '1', description: 'Monthly cleaning service', quantity: 12, unit: 'Month' })
      })
    ]);
  });

  it('derives service schedule, staffing, SLA, and commercial pricing sections', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'SERVICE',
        requirements: {
          services: {
            fields: {
              serviceScheduleRows: [{ id: 'schedule-1', name: 'Daily cleaning schedule', mandatory: true }],
              personnelRequirementRows: [{ id: 'staff-1', role: 'Supervisor', mandatory: true }],
              slaRows: [{ id: 'sla-1', name: 'Response time KPI', mandatory: true }],
              commercialPricingRows: [{ id: 'price-1', description: 'Monthly cleaning', quantity: 12, unit: 'Month' }]
            }
          },
          commercialItems: [{ id: 'service-line-1', description: 'Monthly cleaning', quantity: 12, unit: 'Month' }]
        }
      })
    );

    expect(schema.tenderType).toBe('SERVICE');
    expect(schema.steps.map((step) => step.id)).toEqual(['administrative', 'servicesMethodology', 'servicesDeliveryPlan', 'servicesStaffing', 'servicesSla', 'servicesCommercial', 'servicesReview']);
    expect(stepFields(schema, 'technical')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Supervisor' }),
        expect.objectContaining({ label: 'Response time KPI' })
      ])
    );
    expect(stepFields(schema, 'financial')).toEqual([expect.objectContaining({ label: 'Unit rate for Monthly cleaning' })]);
  });

  it('derives consultancy TOR, financial proposal, and evaluation criteria', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'CONSULTANCY',
        requirements: {
          consultancy: {
            fields: {
              torRows: [{ id: 'tor-1', title: 'TOR understanding', mandatory: true }],
              deliverableRows: [{ id: 'deliverable-1', title: 'Inception report', mandatory: true }]
            }
          }
        },
        metadata: { evaluationCriteria: [{ name: 'Consultant methodology', weight: 80 }] }
      })
    );

    expect(schema.tenderType).toBe('CONSULTANCY');
    expect(schema.steps.map((step) => step.id)).toEqual(['administrative', 'consultancyTechnical', 'consultancyFinancial', 'consultancyReview']);
    expect(stepFields(schema, 'technical').map((field) => field.label)).toEqual(expect.arrayContaining(['TOR understanding', 'Inception report', 'Response for Consultant methodology']));
    expect(stepFields(schema, 'financial')).toEqual([expect.objectContaining({ label: 'Financial proposal', envelope: 'FINANCIAL' })]);
  });

  it('falls back to JSON commercial items when normalized commercial items are absent', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'GOODS',
        commercialItems: [],
        requirements: {
          commercialItems: [{ id: 'json-line-1', description: 'Desktop computer', quantity: 5, unit: 'Each', unitPrice: 2000 }]
        }
      })
    );

    expect(stepFields(schema, 'financial')).toEqual([
      expect.objectContaining({
        requirementKey: 'commercialItems.json-line-1.unitRate',
        label: 'Unit rate for Desktop computer',
        validation: expect.objectContaining({ quantity: 5, unit: 'Each' })
      })
    ]);
  });

  it('sweeps dynamic tender requirement fields into the supplier submission schema', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'WORKS',
        requirements: {
          works: {
            fields: {
              hsePolicyRequired: true,
              customMethodologyRows: [{ id: 'method-1', requirementName: 'Traffic management methodology', mandatory: true }],
              regulatoryLicenseRows: [{ id: 'license-1', license: 'Contractor registration certificate', requiresUpload: true, mandatory: true }]
            },
            lists: {
              mandatorySiteResponses: ['Confirm site access plan']
            }
          }
        }
      })
    );

    expect(stepFields(schema, 'administrative')).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Contractor registration certificate', type: 'file', required: true })])
    );
    expect(stepFields(schema, 'technical')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Traffic management methodology', responseType: 'text', required: true }),
        expect.objectContaining({ label: 'Hse Policy', responseType: 'boolean', required: true }),
        expect.objectContaining({ label: 'Confirm site access plan', responseType: 'boolean', required: true })
      ])
    );
  });

  it('does not expose buyer-only or internal metadata in generated fields', () => {
    const schema = buildBidSubmissionSchema(
      schemaTender({
        type: 'GOODS',
        requirements: {
          goods: {
            fields: {
              productSpecificationTemplate: {
                rows: [
                  {
                    id: 'spec-1',
                    specificationName: 'Processor speed',
                    mandatory: true,
                    description: 'Supplier-facing response prompt',
                    buyerOnlyNotes: 'Do not show this',
                    internalScoringHint: 'Do not show this either'
                  }
                ]
              }
            }
          }
        },
        metadata: {
          evaluationCriteria: [{ id: 'criteria-1', name: 'Technical quality', weight: 100, privateNotes: 'Buyer scoring note' }]
        }
      })
    );

    const serialized = JSON.stringify(schema);
    expect(serialized).toContain('Supplier-facing response prompt');
    expect(serialized).not.toContain('Do not show this');
    expect(serialized).not.toContain('internalScoringHint');
    expect(serialized).not.toContain('Buyer scoring note');
  });
});

describe('bidding tender schema service', () => {
  it('returns a schema for a supplier-accessible tender', async () => {
    const service = new ModuleService(
      { health: vi.fn(), findTenderForSchema: vi.fn().mockResolvedValue(schemaTender()) } as any,
      identityFor('supplier-org-1') as any
    );

    await expect(service.getTenderSchema('token-1', 'tender-1')).resolves.toMatchObject({
      tenderId: 'tender-1',
      tenderType: 'GOODS',
      schemaVersion: 'bid-submission-schema-v1'
    });
  });

  it('rejects buyer-owned and closed tenders', async () => {
    const buyerService = new ModuleService(
      { health: vi.fn(), findTenderForSchema: vi.fn().mockResolvedValue(schemaTender({ buyerOrgId: 'supplier-org-1' })) } as any,
      identityFor('supplier-org-1') as any
    );
    await expect(buyerService.getTenderSchema('token-1', 'tender-1')).rejects.toMatchObject({
      status: 403,
      message: 'Buyers cannot bid on their own tenders.'
    });

    const closedService = new ModuleService(
      { health: vi.fn(), findTenderForSchema: vi.fn().mockResolvedValue(schemaTender({ status: TenderStatus.CLOSED })) } as any,
      identityFor('supplier-org-1') as any
    );
    await expect(closedService.getTenderSchema('token-1', 'tender-1')).rejects.toMatchObject({
      status: 409,
      message: 'This tender is not open for bid submission.'
    });
  });
});

describe('bidding tender guards', () => {
  it('accepts public open tenders before close', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  it('accepts published invited tenders before close', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.PUBLISHED,
        visibility: Visibility.INVITED,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  it('rejects closed, private, missing deadline, or expired tenders', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.CLOSED,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PRIVATE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: null
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() - 86400000)
      })
    ).toBe(false);
  });

  it('keeps withdrawn bids separate from active draft and submission states', () => {
    const activeStatuses = [BidStatus.DRAFT, BidStatus.SUBMITTED];
    expect(activeStatuses).not.toContain(BidStatus.WITHDRAWN);
  });
});

describe('bidding service rules', () => {
  it('rejects buyer organizations bidding on their own tenders', async () => {
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ buyerOrgId: 'org-1' })),
      saveDraft: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
      status: 403,
      message: 'Buyers cannot bid on their own tenders.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it('allows supplier organizations to bid tenders owned by a different buyer organization', async () => {
    const tender = tenderRecord({ buyerOrgId: 'buyer-org-1', bids: [] });
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tender),
      saveDraft: vi.fn().mockResolvedValue({ id: 'bid-1' })
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).resolves.toMatchObject({ id: 'bid-1' });
    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tender,
        supplierOrgId: 'supplier-org-1',
        userId: 'user-1'
      })
    );
  });

  it('saves incomplete drafts with validation warnings and server-computed totals', async () => {
    const tender = tenderRecord({
      type: 'GOODS',
      buyerOrgId: 'buyer-org-1',
      bids: [],
      requirements: {
        goods: {
          fields: {
            productSpecificationTemplate: { rows: [{ id: 'spec-1', specificationName: 'Processor speed', mandatory: true }] },
            sampleRequirementRows: [{ id: 'sample-1', sampleDescription: 'Laptop sample', mandatory: true }]
          }
        }
      },
      commercialItems: [{ id: 'item-1', itemNo: '1', description: 'Line item', quantity: 2, unit: 'Pcs', rate: 0, total: 0, payload: {} }]
    });
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tender),
      saveDraft: vi.fn().mockResolvedValue({ id: 'bid-1', totalAmount: 20 })
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);
    const draft = {
      ...draftInput(),
      administrative: {},
      technical: {},
      financial: { items: [{ itemId: 'item-1', description: 'Line item', quantity: 2, unit: 'Pcs', rate: 10 }] },
      declarations: {},
      totalAmount: 999999,
      validationIssues: ['frontend:error:fake:Do not trust this']
    };

    const result = await service.saveDraft('token-1', 'tender-1', draft);

    expect(result).toMatchObject({
      id: 'bid-1',
      validation: {
        valid: true,
        computedTotalAmount: 20,
        completeness: expect.objectContaining({
          administrative: false,
          goodsTechnical: false,
          goodsFinancial: true,
          goodsSamples: false,
          goodsDeclaration: false
        }),
        schemaVersion: 'bid-submission-schema-v1',
        missingRequiredFields: expect.arrayContaining([
          expect.objectContaining({ section: 'samples', label: 'Laptop sample', requirementKey: 'sampleRequirements.sample-1' }),
          expect.objectContaining({ section: 'technical', label: 'Processor speed' })
        ])
      }
    });
    expect(result.validation?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: 'technical', field: 'productSpecificationTemplate.spec-1', severity: 'warning' }),
        expect.objectContaining({ section: 'samples', field: 'sampleRequirements.sample-1', severity: 'warning' }),
        expect.objectContaining({ section: 'declarations', field: 'declarations.noConflict', severity: 'warning' })
      ])
    );
    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          totalAmount: 20,
          validationIssues: expect.arrayContaining([expect.stringContaining('warning:technical.productSpecificationTemplate.spec-1')])
        })
      })
    );
    const savedDraft = (repository.saveDraft as any).mock.calls[0][0].draft;
    expect(savedDraft.validationIssues).not.toContain('frontend:error:fake:Do not trust this');
  });

  it.each([
    ['goods', { productCompliance: 'All supplied products meet the specification.', approach: 'All supplied products meet the specification.', deliveryPlan: 'Samples and goods will be delivered to the PMU office.' }],
    ['works', { methodology: 'We will execute the works using the approved method statement.', workPlan: 'The work programme follows the tender milestones.', approach: 'We will execute the works using the approved method statement.', deliveryPlan: 'The work programme follows the tender milestones.' }],
    ['services', { methodology: 'We will provide the managed service using qualified staff.', sla: 'Monthly SLA reporting will be provided.', approach: 'We will provide the managed service using qualified staff.', deliveryPlan: 'Monthly SLA reporting will be provided.' }],
    ['consultancy', { technicalProposal: 'The team will deliver the assignment according to the TOR.', methodology: 'The methodology follows inception, fieldwork, and reporting.', approach: 'The methodology follows inception, fieldwork, and reporting.', deliveryPlan: 'The team will deliver the assignment according to the TOR.' }]
  ] as const)('accepts frontend-compatible %s technical payloads for backend submission validation', (_workflow, technical) => {
    const validation = validateBidDraft({
      draft: {
        ...draftInput(),
        technical
      },
      tender: tenderRecord(),
      mode: 'submit'
    });

    expect(validation.valid).toBe(true);
    expect(validation.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('validates required schema documents against uploaded bid documents', () => {
    const tender = tenderRecord({
      type: 'GOODS',
      requirements: {
        goods: {
          fields: {
            supportingDocumentRows: [{ id: 'doc-1', documentName: 'Manufacturer authorization', mandatory: true }]
          }
        }
      }
    });
    const missing = validateBidDraft({
      draft: { ...draftInput(), documents: [] },
      tender,
      mode: 'submit'
    });
    expect(missing.valid).toBe(false);
    expect(missing.missingRequiredFields).toEqual([expect.objectContaining({ section: 'administrative', label: 'Manufacturer authorization' })]);

    const present = validateBidDraft({
      draft: {
        ...draftInput(),
        documents: [
          {
            name: 'manufacturer-authorization.pdf',
            documentType: 'ADMIN_MANUFACTURER_AUTHORIZATION',
            envelope: 'ADMINISTRATIVE',
            metadata: { requirementKey: 'supportingDocumentRows.doc-1' }
          }
        ]
      },
      tender,
      mode: 'submit'
    });
    expect(present.valid).toBe(true);
  });

  it('requires evidence uploads for required structured technical capacity fields', () => {
    const tender = tenderRecord({
      type: 'WORKS',
      requirements: {
        works: {
          fields: {
            similarCompletedProjectsRequired: true,
            mainConstructionActivities: 'Provide a method statement for the works.'
          }
        }
      }
    });
    const draft = {
      ...draftInput(),
      technical: {
        methodStatement: 'We will deliver the works using the approved method statement.',
        similarProjects: {
          projectName: 'District clinic renovation',
          contractValue: 150000000,
          completionDate: 'Completed in 2025'
        }
      },
      responses: [
        {
          requirementKey: 'works.similarProjects',
          response: {
            value: {
              projectName: 'District clinic renovation',
              contractValue: 150000000,
              completionDate: 'Completed in 2025'
            }
          }
        },
        {
          requirementKey: 'works.methodStatement',
          response: { value: 'We will deliver the works using the approved method statement.' }
        }
      ],
      documents: []
    };

    const missing = validateBidDraft({ draft, tender, mode: 'submit' });

    expect(missing.valid).toBe(false);
    expect(missing.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'works.similarProjects',
          message: 'Required evidence upload is missing: Similar completed project evidence - Upload similar project document.'
        })
      ])
    );

    const present = validateBidDraft({
      draft: {
        ...draft,
        documents: [
          {
            name: 'district-clinic-reference.pdf',
            documentType: 'TECHNICAL_SIMILAR_PROJECT_EVIDENCE',
            envelope: 'TECHNICAL' as const,
            metadata: {
              requirementKey: 'works.similarProjects.referenceEvidence',
              parentRequirementKey: 'works.similarProjects',
              fieldId: 'works.similarProjects',
              evidenceKey: 'referenceEvidence'
            }
          }
        ]
      },
      tender,
      mode: 'submit'
    });
    expect(present.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'works.similarProjects',
          message: expect.stringContaining('Required evidence upload is missing')
        })
      ])
    );
  });

  it('validates BOQ pricing through financial rows and standalone financial criteria through responses', () => {
    const tender = tenderRecord({
      type: 'GOODS',
      metadata: { evaluationCriteria: [{ id: 'financial', name: 'Financial score', weight: 10 }] },
      commercialItems: [{ id: 'item-1', itemNo: '1', description: 'Medical equipment', quantity: 1, unit: 'Lot', rate: 0, total: 0, payload: {} }]
    });
    const pricedDraft = {
      ...draftInput(),
      financial: { items: [{ itemId: 'item-1', description: 'Medical equipment', quantity: 1, unit: 'Lot', rate: 250000000 }] }
    };

    const missingCriterion = validateBidDraft({ draft: pricedDraft, tender, mode: 'submit' });

    expect(missingCriterion.valid).toBe(false);
    expect(missingCriterion.computedTotalAmount).toBe(250000000);
    expect(missingCriterion.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'evaluationCriteria.financial',
          message: expect.stringContaining('Required response is missing')
        })
      ])
    );
    expect(missingCriterion.issues).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          field: 'evaluationCriteria.financial',
          message: expect.stringContaining('Required financial pricing is missing')
        })
      ])
    );

    const presentCriterion = validateBidDraft({
      draft: {
        ...pricedDraft,
        responses: [...pricedDraft.responses, { requirementKey: 'evaluationCriteria.financial', response: { value: 85 } }]
      },
      tender,
      mode: 'submit'
    });

    expect(presentCriterion.valid).toBe(true);
    expect(presentCriterion.computedTotalAmount).toBe(250000000);
  });

  it('rejects non-open or private tenders before draft creation', async () => {
    for (const tender of [
      tenderRecord({ status: TenderStatus.CLOSED }),
      tenderRecord({ visibility: Visibility.PRIVATE })
    ]) {
      const repository = {
        findTenderForBid: vi.fn().mockResolvedValue(tender),
        saveDraft: vi.fn()
      };
      const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

      await expect(service.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
        status: 409,
        message: 'This tender is not open for bid submission.'
      });
      expect(repository.saveDraft).not.toHaveBeenCalled();
    }
  });

  it('rejects draft creation when closing date is missing', async () => {
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ closingDate: null })),
      saveDraft: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'Tender closing date is required before bids can be submitted.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it('rejects draft creation when the submission deadline has passed', async () => {
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ closingDate: new Date(Date.now() - 86400000) })),
      saveDraft: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'The bid submission deadline has passed.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it('continues existing draft bids and rejects submitted bid edits', async () => {
    const draftTender = tenderRecord({ bids: [bidRecord({ status: BidStatus.DRAFT })] });
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(draftTender),
      saveDraft: vi.fn().mockResolvedValue({ id: 'bid-1' })
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).resolves.toMatchObject({ id: 'bid-1' });
    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tender: draftTender,
        supplierOrgId: 'supplier-org-1',
        userId: 'user-1'
      })
    );

    const submittedRepository = {
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ bids: [bidRecord({ status: BidStatus.SUBMITTED })] })),
      saveDraft: vi.fn()
    };
    const submittedService = new ModuleService(submittedRepository as any, identityFor('supplier-org-1') as any);

    await expect(submittedService.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'This bid has already been submitted.'
    });
    expect(submittedRepository.saveDraft).not.toHaveBeenCalled();
  });

  it('does not allow submitted bids to be patched or receive new documents', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord({ status: BidStatus.SUBMITTED })),
      findTenderForBid: vi.fn(),
      saveDraft: vi.fn(),
      addDocuments: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.patchBid('token-1', 'bid-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'Submitted bids cannot be edited.'
    });
    await expect(service.addDocuments('token-1', 'bid-1', [{ name: 'doc.pdf', documentType: 'PDF' }])).rejects.toMatchObject({
      status: 409,
      message: 'Submitted bids cannot be edited.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
    expect(repository.addDocuments).not.toHaveBeenCalled();
  });

  it('rejects draft updates when the submission deadline has passed', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ closingDate: new Date(Date.now() - 86400000) })),
      saveDraft: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.patchBid('token-1', 'bid-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'The bid submission deadline has passed.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it('rejects document uploads when the submission deadline has passed', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord({ tender: tenderRecord({ closingDate: new Date(Date.now() - 86400000) }) })),
      addDocuments: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.addDocuments('token-1', 'bid-1', [{ name: 'doc.pdf', documentType: 'PDF' }])).rejects.toMatchObject({
      status: 409,
      message: 'The bid submission deadline has passed.'
    });
    expect(repository.addDocuments).not.toHaveBeenCalled();
  });

  it('continues to accept JSON document metadata for draft bids', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      addDocuments: vi.fn().mockResolvedValue(bidRecord())
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(
      service.addDocuments('token-1', 'bid-1', [
        {
          name: 'technical-proposal.pdf',
          documentType: 'TECHNICAL_PROPOSAL',
          envelope: 'TECHNICAL',
          checksum: 'a'.repeat(64),
          mimeType: 'application/pdf',
          size: 1200
        }
      ])
    ).resolves.toMatchObject({ id: 'bid-1' });
    expect(repository.addDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [
          expect.objectContaining({
            documentType: 'TECHNICAL_PROPOSAL',
            envelope: 'TECHNICAL'
          })
        ]
      })
    );
  });

  it('rejects unsafe JSON document metadata before persistence', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      addDocuments: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(
      service.addDocuments('token-1', 'bid-1', [{ name: 'payload.exe', documentType: 'TECHNICAL_PROPOSAL', envelope: 'TECHNICAL', mimeType: 'application/x-msdownload' }])
    ).rejects.toMatchObject({
      status: 400,
      message: 'Unsupported bid document file type.'
    });
    expect(repository.addDocuments).not.toHaveBeenCalled();
  });

  it('rejects JSON document metadata with user-supplied storage or encryption fields', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      addDocuments: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(
      service.addDocuments('token-1', 'bid-1', [
        {
          name: 'technical-proposal.pdf',
          documentType: 'TECHNICAL_PROPOSAL',
          envelope: 'TECHNICAL',
          checksum: 'a'.repeat(64),
          mimeType: 'application/pdf',
          size: 1200,
          metadata: { storage: 'user-storage', path: 'C:/secret/doc.pdf', sealedPayload: 'hidden', encryptionKeyRef: 'key-1' }
        }
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: 'Invalid bid document payload.'
    });
    expect(repository.addDocuments).not.toHaveBeenCalled();
  });

  it('requires a checksum for JSON document metadata uploads', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      addDocuments: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(
      service.addDocuments('token-1', 'bid-1', [
        {
          name: 'technical-proposal.pdf',
          documentType: 'TECHNICAL_PROPOSAL',
          envelope: 'TECHNICAL',
          mimeType: 'application/pdf',
          size: 1200
        }
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: 'Bid document checksum is required.'
    });
    expect(repository.addDocuments).not.toHaveBeenCalled();
  });

  it('deletes draft bid documents for the owning supplier before the deadline', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      deleteDocument: vi.fn().mockResolvedValue({ bid: bidRecord(), removedDocument: { objectKey: 'bids/bid-1/doc.pdf', metadata: { storage: 'local-dev' } } })
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.deleteDocument('token-1', 'bid-1', 'doc-1')).resolves.toMatchObject({ id: 'bid-1' });
    expect(repository.deleteDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-1', userId: 'user-1' }));
  });

  it('allows a supplier to create a sample for its own draft bid before the deadline', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      createSample: vi.fn().mockResolvedValue(sampleDto())
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);
    const input = sampleInput();

    await expect(service.createSample('token-1', 'bid-1', input)).resolves.toMatchObject({ trackingStatus: BidSampleStatus.PENDING_SUBMISSION });
    expect(repository.createSample).toHaveBeenCalledWith(expect.objectContaining({ sample: input, userId: 'user-1' }));
  });

  it.each([
    ['wrong supplier', bidRecord({ supplierOrgId: 'other-supplier-org' }), { status: 403, message: 'Bid access is not allowed.' }],
    ['submitted bid', bidRecord({ status: BidStatus.SUBMITTED }), { status: 409, message: 'Submitted bids cannot be edited.' }],
    ['missing deadline', bidRecord({ tender: tenderRecord({ closingDate: null }) }), { status: 409, message: 'Tender closing date is required before bids can be submitted.' }],
    ['expired deadline', bidRecord({ tender: tenderRecord({ closingDate: new Date(Date.now() - 86400000) }) }), { status: 409, message: 'The bid submission deadline has passed.' }]
  ])('rejects supplier sample creation for %s', async (_label, bid, expected) => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bid),
      createSample: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.createSample('token-1', 'bid-1', sampleInput())).rejects.toMatchObject(expected);
    expect(repository.createSample).not.toHaveBeenCalled();
  });

  it('rejects sample delivery deadlines after tender closing unless explicitly allowed', async () => {
    const closingDate = new Date(Date.now() + 86400000);
    const sample = sampleInput({ relatedItem: 'Laptop', deliveryDeadline: new Date(closingDate.getTime() + 86400000).toISOString() });
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord({ tender: tenderRecord({ closingDate }) })),
      createSample: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.createSample('token-1', 'bid-1', sample)).rejects.toMatchObject({
      status: 400,
      message: 'Sample delivery deadline cannot be after the tender closing date.'
    });

    repository.findBidForAccess.mockResolvedValue(
      bidRecord({
        tender: tenderRecord({
          closingDate,
          requirements: {
            sampleRequirementRows: [{ relatedBoqItem: 'Laptop', allowSampleDeliveryAfterClosing: true }]
          }
        })
      })
    );
    repository.createSample.mockResolvedValue(sampleDto({ deliveryDeadline: sample.deliveryDeadline }));
    await expect(service.createSample('token-1', 'bid-1', sample)).resolves.toMatchObject({ id: 'sample-1' });
  });

  it('allows buyer organizations to list samples only after bid submission', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord({ status: BidStatus.SUBMITTED })),
      listSamples: vi.fn().mockResolvedValue([sampleDto()])
    };
    const service = new ModuleService(repository as any, identityFor('buyer-org-1') as any);

    await expect(service.listSamples('token-1', 'bid-1')).resolves.toEqual([sampleDto()]);
    expect(repository.listSamples).toHaveBeenCalledWith({ bidId: 'bid-1' });

    repository.findBidForAccess.mockResolvedValue(bidRecord({ status: BidStatus.DRAFT }));
    await expect(service.listSamples('token-1', 'bid-1')).rejects.toMatchObject({
      status: 409,
      message: 'Bid samples are only visible to buyers after bid submission.'
    });
  });

  it('enforces supplier and buyer sample patch field ownership', async () => {
    const supplierRepository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      patchSample: vi.fn()
    };
    const supplierService = new ModuleService(supplierRepository as any, identityFor('supplier-org-1') as any);

    await expect(supplierService.patchSample('token-1', 'bid-1', 'sample-1', { receivedAt: new Date().toISOString() })).rejects.toMatchObject({
      status: 403,
      message: 'Suppliers cannot update buyer sample tracking fields.'
    });
    await expect(supplierService.patchSample('token-1', 'bid-1', 'sample-1', { trackingStatus: BidSampleStatus.RECEIVED })).rejects.toMatchObject({
      status: 409,
      message: 'Invalid sample tracking status transition.'
    });

    const buyerRepository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord({ status: BidStatus.SUBMITTED })),
      patchSample: vi.fn()
    };
    const buyerService = new ModuleService(buyerRepository as any, identityFor('buyer-org-1') as any);
    await expect(buyerService.patchSample('token-1', 'bid-1', 'sample-1', { courier: 'DHL' })).rejects.toMatchObject({
      status: 403,
      message: 'Buyer cannot change supplier-owned sample fields.'
    });
  });

  it('delegates submit using only bid id, supplier organization id, and user id', async () => {
    const receipt = receiptDto();
    const repository = {
      submit: vi.fn().mockResolvedValue(receipt)
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.submit('token-1', 'bid-1')).resolves.toBe(receipt);
    expect(repository.submit).toHaveBeenCalledWith({
      bidId: 'bid-1',
      supplierOrgId: 'supplier-org-1',
      userId: 'user-1'
    });
  });

  it('keeps the submitted bid receipt response shape compatible', async () => {
    const receipt = receiptDto();
    const repository = {
      submit: vi.fn().mockResolvedValue(receipt)
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.submit('token-1', 'bid-1')).resolves.toMatchObject({
      receiptRef: 'BID-PX-BID-2026-000001-01',
      receiptHash: 'hash-123',
      createdAt: '2026-07-01T08:00:01.000Z',
      bid: {
        id: 'bid-1',
        reference: 'PX-BID-2026-000001',
        status: BidStatus.SUBMITTED,
        submittedAt: '2026-07-01T08:00:00.000Z',
        totalAmount: 250000000,
        currency: 'TZS'
      }
    });
  });
});

describe('bidding repository rules', () => {
  it('scopes tender bid lookup to the current supplier organization', async () => {
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue(tenderRecord())
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.findTenderForBid('tender-1', 'supplier-org-1');

    expect(db.tender.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tender-1' },
        include: expect.objectContaining({
          bids: expect.objectContaining({
            where: { supplierOrgId: 'supplier-org-1' }
          })
        })
      })
    );
  });

  it('checks for another submitted bid by tender and supplier', async () => {
    const db = {
      bid: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bid-2' })
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(
      repository.hasSubmittedBidForTenderSupplier({
        tenderId: 'tender-1',
        supplierOrgId: 'supplier-org-1',
        excludingBidId: 'bid-1'
      })
    ).resolves.toBe(true);
    expect(db.bid.findFirst).toHaveBeenCalledWith({
      where: {
        tenderId: 'tender-1',
        supplierOrgId: 'supplier-org-1',
        status: BidStatus.SUBMITTED,
        id: { not: 'bid-1' }
      },
      select: { id: true }
    });
  });

  it('maps active bid unique conflicts to a clean draft conflict', async () => {
    const repository = new ModuleRepository({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' })
    } as any);

    await expect(
      repository.saveDraft({
        tender: tenderRecord() as any,
        supplierOrgId: 'supplier-org-1',
        supplierName: 'Supplier',
        userId: 'user-1',
        draft: draftInput()
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'A bid already exists for this tender.'
    });
  });

  it('updates an existing draft instead of creating a second active bid', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    const tender = tenderRecord({ bids: [bidRecord({ id: 'bid-existing', status: BidStatus.DRAFT })] });
    tx.bid.update.mockResolvedValue({ id: 'bid-existing' });
    tx.bid.findUniqueOrThrow.mockResolvedValue(bidRecord({ id: 'bid-existing' }));
    const repository = new ModuleRepository(db as any);

    await expect(
      repository.saveDraft({
        tender: tender as any,
        supplierOrgId: 'supplier-org-1',
        supplierName: 'Supplier',
        userId: 'user-1',
        draft: draftInput()
      })
    ).resolves.toMatchObject({ id: 'bid-existing', status: BidStatus.DRAFT });

    expect(tx.bid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bid-existing' }
      })
    );
    expect(tx.bid.create).not.toHaveBeenCalled();
  });

  it('deletes bid document links, document metadata, and audits the deletion', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    tx.bidDocument.findFirst.mockResolvedValue({
      id: 'bid-doc-1',
      documentId: 'doc-1',
      document: {
        id: 'doc-1',
        objectKey: 'bids/bid-1/technical-proposal.pdf',
        metadata: { storage: 'local-dev' }
      }
    });
    tx.bid.findUniqueOrThrow.mockResolvedValue(bidRecord({ documents: [] }));
    const repository = new ModuleRepository(db as any);

    const result = await repository.deleteDocument({ bid: bidRecord() as any, documentId: 'doc-1', userId: 'user-1' });

    expect(tx.bidDocument.delete).toHaveBeenCalledWith({ where: { id: 'bid-doc-1' } });
    expect(tx.documentObject.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'bidding.bid_document_deleted',
          entityRef: 'bid-1'
        })
      })
    );
    expect(result.removedDocument).toEqual({
      objectKey: 'bids/bid-1/technical-proposal.pdf',
      metadata: { storage: 'local-dev' }
    });
    expect(result.bid.documents).toEqual([]);
  });

  it('returns a clean not-found error when deleting an unrelated bid document', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    tx.bidDocument.findFirst.mockResolvedValue(null);
    const repository = new ModuleRepository(db as any);

    await expect(repository.deleteDocument({ bid: bidRecord() as any, documentId: 'doc-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 404,
      message: 'Bid document was not found.'
    });
    expect(tx.bidDocument.delete).not.toHaveBeenCalled();
    expect(tx.documentObject.delete).not.toHaveBeenCalled();
  });

  it('filters financial envelope documents from buyer-facing bid DTOs and sanitizes metadata', () => {
    const bid = bidRecord({
      payload: {
        ...validBidPayload(),
        financial: { items: [{ description: 'Secret price', quantity: 1, unit: 'Lot', rate: 999 }] },
        envelopes: { financial: ['hash-fin'] },
        fileManifest: { checksums: ['hash-fin'] }
      },
      responses: [
        { requirementKey: 'technical-methodology', response: { value: 'Compliant' }, createdAt: new Date('2026-06-26T08:00:00.000Z') },
        { requirementKey: 'financial-price', response: { amount: 999 }, createdAt: new Date('2026-06-26T08:00:00.000Z') }
      ],
      documents: [
        bidDocumentRecord({ id: 'bid-doc-tech', documentId: 'doc-tech', envelope: 'TECHNICAL', document: { id: 'doc-tech', name: 'technical.pdf', documentType: 'TECHNICAL_PROPOSAL', checksum: 'hash-tech', metadata: { storage: 'local-dev', localPath: 'C:/secret/technical.pdf', objectKey: 'bids/bid-1/technical.pdf', encryptionKeyRef: 'key-1' } } }),
        bidDocumentRecord({ id: 'bid-doc-fin', documentId: 'doc-fin', envelope: 'FINANCIAL', document: { id: 'doc-fin', name: 'financial.pdf', documentType: 'FINANCIAL_PROPOSAL', checksum: 'hash-fin', metadata: { storage: 'local-dev', localPath: 'C:/secret/financial.pdf', sealedPayload: 'secret' } } })
      ]
    });

    expect(toBidDto(bid as any).documents.map((document) => document.envelope)).toEqual(['TECHNICAL', 'FINANCIAL']);
    const buyerDto = toBidDto(bid as any, { revealFinancialDocuments: false });
    expect(buyerDto.documents.map((document) => document.envelope)).toEqual(['TECHNICAL']);
    expect(buyerDto.totalAmount).toBe(0);
    expect(buyerDto.payload).not.toHaveProperty('financial');
    expect(buyerDto.payload).not.toHaveProperty('envelopes');
    expect(buyerDto.payload).not.toHaveProperty('fileManifest');
    expect(buyerDto.responses).toEqual([{ requirementKey: 'technical-methodology', response: { value: 'Compliant' } }]);
    expect(JSON.stringify(buyerDto)).not.toContain('C:/secret');
    expect(JSON.stringify(buyerDto)).not.toContain('objectKey');
    expect(JSON.stringify(buyerDto)).not.toContain('sealedPayload');
    expect(JSON.stringify(buyerDto)).not.toContain('encryptionKeyRef');
  });

  it('creates sample records with default pending status and audit', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    tx.bidSample.create.mockResolvedValue(sampleRecord());
    const repository = new ModuleRepository(db as any);

    const result = await repository.createSample({ bid: bidRecord() as any, userId: 'user-1', sample: sampleInput() });

    expect(tx.bidSample.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bidId: 'bid-1',
          tenderId: 'tender-1',
          supplierOrgId: 'supplier-org-1',
          trackingStatus: BidSampleStatus.PENDING_SUBMISSION
        })
      })
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'bidding.bid_sample_created',
          entityRef: 'sample-1'
        })
      })
    );
    expect(result).toMatchObject({ id: 'sample-1', trackingStatus: BidSampleStatus.PENDING_SUBMISSION });
  });

  it('allows supplier sample transition to submitted and audits it', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    tx.bidSample.findFirst.mockResolvedValue(sampleRecord({ trackingStatus: BidSampleStatus.PENDING_SUBMISSION }));
    tx.bidSample.update.mockResolvedValue(sampleRecord({ trackingStatus: BidSampleStatus.SUBMITTED, submittedAt: new Date('2026-07-01T08:00:00.000Z') }));
    const repository = new ModuleRepository(db as any);

    const result = await repository.patchSample({
      bid: bidRecord() as any,
      sampleId: 'sample-1',
      userId: 'user-1',
      actor: 'supplier',
      patch: { trackingStatus: BidSampleStatus.SUBMITTED }
    });

    expect(tx.bidSample.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackingStatus: BidSampleStatus.SUBMITTED,
          submittedAt: expect.any(Date)
        })
      })
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'bidding.bid_sample_submitted' }) }));
    expect(result.trackingStatus).toBe(BidSampleStatus.SUBMITTED);
  });

  it('allows buyer sample tracking transitions through received, inspected, and accepted', async () => {
    const cases = [
      [BidSampleStatus.SUBMITTED, BidSampleStatus.RECEIVED, 'bidding.bid_sample_received'],
      [BidSampleStatus.RECEIVED, BidSampleStatus.INSPECTED, 'bidding.bid_sample_inspected'],
      [BidSampleStatus.INSPECTED, BidSampleStatus.ACCEPTED, 'bidding.bid_sample_accepted'],
      [BidSampleStatus.INSPECTED, BidSampleStatus.REJECTED, 'bidding.bid_sample_rejected']
    ] as const;

    for (const [from, to, event] of cases) {
      const tx = transactionMock();
      const db = {
        $transaction: vi.fn((callback) => callback(tx))
      };
      tx.bidSample.findFirst.mockResolvedValue(sampleRecord({ trackingStatus: from }));
      tx.bidSample.update.mockResolvedValue(sampleRecord({ trackingStatus: to }));
      const repository = new ModuleRepository(db as any);

      await expect(
        repository.patchSample({
          bid: bidRecord() as any,
          sampleId: 'sample-1',
          userId: 'buyer-user-1',
          actor: 'buyer',
          patch: { trackingStatus: to }
        })
      ).resolves.toMatchObject({ trackingStatus: to });
      expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event }) }));
    }
  });

  it('rejects invalid sample status transitions and unrelated sample ids', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    tx.bidSample.findFirst.mockResolvedValue(sampleRecord({ trackingStatus: BidSampleStatus.SUBMITTED }));
    const repository = new ModuleRepository(db as any);

    await expect(
      repository.patchSample({
        bid: bidRecord() as any,
        sampleId: 'sample-1',
        userId: 'buyer-user-1',
        actor: 'buyer',
        patch: { trackingStatus: BidSampleStatus.ACCEPTED }
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Invalid sample tracking status transition.'
    });
    expect(tx.bidSample.update).not.toHaveBeenCalled();

    tx.bidSample.findFirst.mockResolvedValue(null);
    await expect(
      repository.patchSample({
        bid: bidRecord() as any,
        sampleId: 'missing-sample',
        userId: 'buyer-user-1',
        actor: 'buyer',
        patch: { trackingStatus: BidSampleStatus.RECEIVED }
      })
    ).rejects.toMatchObject({
      status: 404,
      message: 'Bid sample was not found.'
    });
  });

  it('submits bids in a transaction by creating a sealed version, receipt, and audit event', async () => {
    delete process.env.BID_ENCRYPTION_KEY;
    const { repository, db, tx } = repositorySubmitFixture();

    const result = await repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.bid.findUnique).toHaveBeenCalledWith({ where: { id: 'bid-1' }, include: expect.any(Object) });
    expect(tx.bid.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenderId: 'tender-1',
          supplierOrgId: 'supplier-org-1',
          status: BidStatus.SUBMITTED,
          id: { not: 'bid-1' }
        })
      })
    );
    expect(tx.bidVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bidId: 'bid-1',
          envelope: 'COMBINED',
          sealedHash: expect.any(String)
        })
      })
    );
    const versionPayload = tx.bidVersion.create.mock.calls[0][0].data.payload;
    expect(versionPayload).toMatchObject({
      version: 'bid-seal-v1',
      envelope: 'COMBINED',
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      sealedHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      encryption: { enabled: false }
    });
    expect(versionPayload).not.toHaveProperty('sealedPayload');
    expect(JSON.stringify(versionPayload)).not.toContain('Medical equipment');
    expect(JSON.stringify(versionPayload)).not.toContain('technical-proposal');
    expect(tx.bid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bid-1' },
        data: expect.objectContaining({
          status: BidStatus.SUBMITTED,
          submittedByUserId: 'user-1',
          totalAmount: 250000000,
          currency: 'TZS'
        })
      })
    );
    expect(tx.bidReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bidId: 'bid-1',
          receiptHash: expect.any(String)
        })
      })
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'bidding.bid_submitted',
          entityRef: 'bid-1'
        })
      })
    );
    expect(result).toMatchObject({
      receiptRef: 'BID-PX-BID-2026-000001-01',
      receiptHash: 'hash-123',
      bid: expect.objectContaining({
        id: 'bid-1',
        status: BidStatus.SUBMITTED,
        totalAmount: 250000000,
        currency: 'TZS'
      })
    });
  });

  it('submits bids with encrypted sealed payloads when BID_ENCRYPTION_KEY is configured', async () => {
    process.env.BID_ENCRYPTION_KEY = '12345678901234567890123456789012';
    const { repository, tx } = repositorySubmitFixture();

    await repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' });

    const versionPayload = tx.bidVersion.create.mock.calls[0][0].data.payload;
    expect(versionPayload).toMatchObject({
      version: 'bid-seal-v1',
      envelope: 'COMBINED',
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      sealedHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      encryption: {
        enabled: true,
        algorithm: 'aes-256-gcm',
        iv: expect.any(String),
        authTag: expect.any(String),
        keyRef: expect.stringMatching(/^bid-key:[a-f0-9]{16}$/)
      },
      sealedPayload: expect.any(String)
    });
    expect(JSON.stringify(versionPayload)).not.toContain('Medical equipment');
    expect(JSON.stringify(versionPayload)).not.toContain('technical-proposal');
  });

  it.each([
    [
      'wrong supplier',
      bidRecord({ supplierOrgId: 'other-supplier-org' }),
      { status: 403, message: 'Bid access is not allowed.' }
    ],
    [
      'submitted bid state',
      bidRecord({ status: BidStatus.SUBMITTED }),
      { status: 409, message: 'This bid has already been submitted.' }
    ],
    [
      'existing receipt',
      bidRecord({ receipt: { receiptRef: 'BID-PX-BID-2026-000001-01', receiptHash: 'hash-123', createdAt: new Date() } }),
      { status: 409, message: 'This bid has already been submitted.' }
    ],
    [
      'non-draft bid state',
      bidRecord({ status: BidStatus.WITHDRAWN }),
      { status: 409, message: 'Only draft bids can be submitted.' }
    ],
    [
      'closed tender',
      bidRecord({ tender: tenderRecord({ status: TenderStatus.CLOSED }) }),
      { status: 409, message: 'This tender is not open for bid submission.' }
    ],
    [
      'missing deadline',
      bidRecord({ tender: tenderRecord({ closingDate: null }) }),
      { status: 409, message: 'Tender closing date is required before bids can be submitted.' }
    ],
    [
      'expired deadline',
      bidRecord({ tender: tenderRecord({ closingDate: new Date(Date.now() - 86400000) }) }),
      { status: 409, message: 'The bid submission deadline has passed.' }
    ],
    [
      'own tender',
      bidRecord({ buyerOrgId: 'supplier-org-1', tender: tenderRecord({ buyerOrgId: 'supplier-org-1' }) }),
      { status: 403, message: 'Buyers cannot bid on their own tenders.' }
    ]
  ])('aborts transactional submit before writes for %s', async (_label, bid, expected) => {
    const { repository, tx } = repositorySubmitFixture({ bid });

    await expect(repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject(expected);
    expect(tx.bid.findFirst).not.toHaveBeenCalled();
    expectNoSubmitWrites(tx);
  });

  it('aborts transactional submit before writes when another submitted bid exists', async () => {
    const { repository, tx } = repositorySubmitFixture();
    tx.bid.findFirst.mockResolvedValue({ id: 'bid-2' });

    await expect(repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 409,
      message: 'A submitted bid already exists for this tender.'
    });
    expectNoSubmitWrites(tx);
  });

  it('aborts transactional submit before writes when production validation fails', async () => {
    const { repository, tx } = repositorySubmitFixture({
      bid: bidRecord({
        payload: {
          ...validBidPayload(),
          declarations: { confirmAccuracy: true, acceptTerms: true, noConflict: false }
        }
      })
    });

    await expect(repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('noConflict')
    });
    expectNoSubmitWrites(tx);
  });

  it('aborts transactional submit before writes when a required sample is missing', async () => {
    const { repository, tx } = repositorySubmitFixture({
      bid: bidRecord({
        tender: tenderRecord({
          type: 'GOODS',
          requirements: {
            goods: {
              fields: {
                sampleRequirementRows: [{ id: 'sample-1', sampleDescription: 'Laptop sample', mandatory: true }]
              }
            }
          }
        }),
        samples: []
      })
    });

    await expect(repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('samples.sampleRequirements.sample-1')
    });
    expectNoSubmitWrites(tx);
  });

  it('aborts transactional submit before writes when a required financial rate is missing', async () => {
    const { repository, tx } = repositorySubmitFixture({
      bid: bidRecord({
        tender: tenderRecord({
          commercialItems: [{ id: 'item-1', itemNo: '1', description: 'Medical equipment', quantity: 1, unit: 'Lot', rate: 0, total: 0, payload: {} }]
        }),
        payload: {
          ...validBidPayload(),
          financial: { items: [{ itemId: 'item-1', description: 'Medical equipment', quantity: 1, unit: 'Lot' }] }
        }
      })
    });

    await expect(repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('financial.commercialItems.item-1.unitRate')
    });
    expectNoSubmitWrites(tx);
  });

  it('maps submit unique conflicts to a clean duplicate submission conflict', async () => {
    const repository = new ModuleRepository({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' })
    } as any);

    await expect(repository.submit({ bidId: 'bid-1', supplierOrgId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 409,
      message: 'A submitted bid already exists for this tender.'
    });
  });
});

describe('bidding financial document exposure in evaluation views', () => {
  it('hides financial envelope documents until the financial evaluation stage', async () => {
    const tender = evaluationTenderRecord(EvaluationStage.TECHNICAL);
    const service = new EvaluationService({
      health: vi.fn(),
      getWorkspaceByTenderId: vi.fn().mockResolvedValue({ tender, auditEvents: [] })
    } as any);

    const workspace = await service.workspace('tender-1', { organizationId: 'buyer-org-1', userId: 'buyer-user-1' });

    expect(workspace.bids[0]?.documents.map((document) => document.documentType)).toEqual(['TECHNICAL_PROPOSAL']);
  });

  it('reveals financial envelope documents at the financial evaluation stage', async () => {
    const tender = evaluationTenderRecord(EvaluationStage.FINANCIAL);
    const service = new EvaluationService({
      health: vi.fn(),
      getWorkspaceByTenderId: vi.fn().mockResolvedValue({ tender, auditEvents: [] })
    } as any);

    const workspace = await service.workspace('tender-1', { organizationId: 'buyer-org-1', userId: 'buyer-user-1' });

    expect(workspace.bids[0]?.documents.map((document) => document.documentType)).toEqual(['TECHNICAL_PROPOSAL', 'FINANCIAL_PROPOSAL']);
  });
});

function identityFor(organizationId?: string) {
  return {
    requirePermission: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        organizationId,
        organization: 'Supplier'
      }
    }),
    requireSession: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        organizationId,
        organization: 'Supplier'
      }
    })
  };
}

function tenderRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tender-1',
    reference: 'PX-2026-001',
    title: 'Supply of medical equipment',
    status: TenderStatus.OPEN,
    visibility: Visibility.PUBLIC_MARKETPLACE,
    closingDate: new Date(Date.now() + 86400000),
    currency: 'TZS',
    requirements: {},
    buyerOrgId: 'buyer-org-1',
    buyerOrg: { id: 'buyer-org-1', name: 'Buyer Org' },
    bids: [],
    ...overrides
  };
}

function schemaTender(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tender-1',
    reference: 'PX-2026-001',
    title: 'Supply of medical equipment',
    type: 'GOODS',
    status: TenderStatus.OPEN,
    visibility: Visibility.PUBLIC_MARKETPLACE,
    closingDate: new Date(Date.now() + 86400000),
    currency: 'TZS',
    requirements: {},
    metadata: {},
    buyerOrgId: 'buyer-org-1',
    buyerOrg: { id: 'buyer-org-1', name: 'Buyer Org' },
    categories: [{ name: 'Medical equipment' }],
    requirementRows: [],
    milestones: [],
    commercialItems: [],
    documents: [],
    ...overrides
  };
}

function stepFields(schema: ReturnType<typeof buildBidSubmissionSchema>, stepId: string) {
  return schema.steps.find((step) => step.id === stepId)?.fields ?? schema.steps.flatMap((step) => step.fields).filter((field) => field.section === stepId);
}

function validBidPayload() {
  return {
    administrative: {
      eligible: true,
      taxCompliant: true
    },
    technical: {
      approach: 'We will deliver according to the tender specifications.',
      deliveryPlan: 'Delivery will be completed within the requested timeline.',
      experience: 'Completed similar supply contracts.'
    },
    financial: {
      items: [{ description: 'Medical equipment', quantity: 1, unit: 'Lot', rate: 250000000 }]
    },
    declarations: {
      confirmAccuracy: true,
      acceptTerms: true,
      noConflict: true
    }
  };
}

function bidRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bid-1',
    tenderId: 'tender-1',
    tenderReference: 'PX-2026-001',
    tenderTitle: 'Supply of medical equipment',
    buyerOrgId: 'buyer-org-1',
    buyerName: 'Buyer Org',
    supplierOrgId: 'supplier-org-1',
    supplierName: 'Supplier Org',
    reference: 'PX-BID-2026-000001',
    status: BidStatus.DRAFT,
    submittedAt: null,
    totalAmount: 250000000,
    currency: 'TZS',
    payload: validBidPayload(),
    responses: [{ requirementKey: 'technical', response: { answer: 'Compliant' }, createdAt: new Date('2026-06-26T08:00:00.000Z') }],
    documents: [
      {
        id: 'bid-doc-1',
        documentId: 'doc-1',
        envelope: 'TECHNICAL',
        reviewStatus: 'UPLOADED',
        createdAt: new Date('2026-06-26T08:00:00.000Z'),
        document: { id: 'doc-1', name: 'technical-proposal.pdf', documentType: 'TECHNICAL_PROPOSAL', checksum: 'hash-doc-1', metadata: {} }
      }
    ],
    receipt: null,
    createdAt: new Date('2026-06-26T08:00:00.000Z'),
    updatedAt: new Date('2026-06-26T08:00:00.000Z'),
    tender: tenderRecord(),
    buyerOrg: { id: 'buyer-org-1', name: 'Buyer Org' },
    supplierOrg: { id: 'supplier-org-1', name: 'Supplier Org' },
    ...overrides
  };
}

function draftInput() {
  const payload = validBidPayload();
  return {
    administrative: payload.administrative,
    technical: payload.technical,
    financial: payload.financial,
    declarations: payload.declarations,
    responses: [{ requirementKey: 'technical', response: { answer: 'Compliant' } }],
    documents: [{ name: 'technical-proposal.pdf', documentType: 'TECHNICAL_PROPOSAL', envelope: 'TECHNICAL' as const, checksum: 'hash-doc-1' }],
    totalAmount: 250000000,
    currency: 'TZS'
  };
}

function bidDocumentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bid-doc-1',
    documentId: 'doc-1',
    envelope: 'TECHNICAL',
    reviewStatus: 'UPLOADED',
    createdAt: new Date('2026-06-26T08:00:00.000Z'),
    document: { id: 'doc-1', name: 'technical-proposal.pdf', documentType: 'TECHNICAL_PROPOSAL', objectKey: 'bids/bid-1/technical-proposal.pdf', checksum: 'hash-doc-1', encryptionKeyRef: null, metadata: {} },
    ...overrides
  };
}

function receiptDto() {
  return {
    receiptRef: 'BID-PX-BID-2026-000001-01',
    receiptHash: 'hash-123',
    createdAt: '2026-07-01T08:00:01.000Z',
    bid: {
      id: 'bid-1',
      reference: 'PX-BID-2026-000001',
      status: BidStatus.SUBMITTED,
      submittedAt: '2026-07-01T08:00:00.000Z',
      totalAmount: 250000000,
      currency: 'TZS'
    }
  };
}

function sampleInput(overrides: Record<string, unknown> = {}) {
  return {
    sampleName: 'Laptop sample unit',
    relatedItem: 'Laptop',
    quantity: 1,
    deliveryLocation: 'Procurement Unit, Dar es Salaam',
    deliveryDeadline: new Date(Date.now() + 3600000).toISOString(),
    courier: 'DHL',
    trackingNumber: 'DHL-123456',
    metadata: { returnable: true },
    ...overrides
  };
}

function sampleDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sample-1',
    bidId: 'bid-1',
    tenderId: 'tender-1',
    supplierOrgId: 'supplier-org-1',
    sampleName: 'Laptop sample unit',
    relatedItem: 'Laptop',
    quantity: 1,
    deliveryLocation: 'Procurement Unit, Dar es Salaam',
    deliveryDeadline: '2026-07-15T12:00:00.000Z',
    trackingStatus: BidSampleStatus.PENDING_SUBMISSION,
    courier: 'DHL',
    trackingNumber: 'DHL-123456',
    submittedAt: null,
    receivedAt: null,
    inspectedAt: null,
    inspectionNotes: null,
    metadata: { returnable: true },
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
    ...overrides
  };
}

function sampleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sample-1',
    bidId: 'bid-1',
    tenderId: 'tender-1',
    supplierOrgId: 'supplier-org-1',
    sampleName: 'Laptop sample unit',
    relatedItem: 'Laptop',
    quantity: 1,
    deliveryLocation: 'Procurement Unit, Dar es Salaam',
    deliveryDeadline: new Date('2026-07-15T12:00:00.000Z'),
    trackingStatus: BidSampleStatus.PENDING_SUBMISSION,
    courier: 'DHL',
    trackingNumber: 'DHL-123456',
    submittedAt: null,
    receivedAt: null,
    inspectedAt: null,
    inspectionNotes: null,
    metadata: { returnable: true },
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
    ...overrides
  };
}

function canonicalBidPackageFixture(): CanonicalBidPackage {
  return {
    bidId: 'bid-1',
    tenderId: 'tender-1',
    supplierOrgId: 'supplier-org-1',
    buyerOrgId: 'buyer-org-1',
    payload: {
      bid: validBidPayload(),
      responses: [{ requirementKey: 'technical', response: { answer: 'Compliant' } }]
    },
    documentChecksums: [{ documentId: 'doc-1', envelope: 'TECHNICAL', checksum: 'hash-doc-1' }],
    computedTotalAmount: 250000000,
    currency: 'TZS',
    submittedAt: '2026-07-01T08:00:00.000Z'
  };
}

function evaluationTenderRecord(currentStage: EvaluationStage) {
  return {
    id: 'tender-1',
    reference: 'PX-2026-001',
    title: 'Supply of medical equipment',
    type: 'OPEN_TENDER',
    status: TenderStatus.EVALUATION,
    closingDate: new Date('2026-06-01T08:00:00.000Z'),
    currency: 'TZS',
    buyerOrg: { id: 'buyer-org-1', name: 'Buyer Org' },
    evaluation: {
      id: 'workspace-1',
      status: 'IN_PROGRESS',
      currentStage,
      progress: 0,
      payload: {},
      updatedAt: new Date('2026-07-01T08:00:00.000Z'),
      criteria: [],
      scores: [],
      recommendations: []
    },
    bids: [
      {
        id: 'bid-1',
        reference: 'PX-BID-2026-000001',
        status: BidStatus.SUBMITTED,
        submittedAt: new Date('2026-07-01T08:00:00.000Z'),
        totalAmount: 250000000,
        currency: 'TZS',
        payload: {},
        supplierOrg: { id: 'supplier-org-1', name: 'Supplier Org' },
        documents: [
          {
            id: 'bid-doc-tech',
            envelope: 'TECHNICAL',
            reviewStatus: 'UPLOADED',
            document: { id: 'doc-tech', name: 'technical.pdf', documentType: 'TECHNICAL_PROPOSAL' }
          },
          {
            id: 'bid-doc-fin',
            envelope: 'FINANCIAL',
            reviewStatus: 'UPLOADED',
            document: { id: 'doc-fin', name: 'financial.pdf', documentType: 'FINANCIAL_PROPOSAL' }
          }
        ],
        responses: []
      }
    ]
  };
}

function uploadParserApp() {
  const app = express();
  app.post('/upload', async (req, res, next) => {
    try {
      res.status(201).json(await parseAndStoreBidDocuments(req, 'bid-1'));
    } catch (error) {
      next(error);
    }
  });
  app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ message: error.message });
  });
  return app;
}

function biddingRouterApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bidding', createModuleRouter());
  app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ message: error.message });
  });
  return app;
}

function repositorySubmitFixture(options: { bid?: ReturnType<typeof bidRecord> } = {}) {
  const tx = transactionMock();
  const db = {
    $transaction: vi.fn((callback) => callback(tx))
  };
  const bid = options.bid ?? bidRecord();
  const submittedBid = bidRecord({
    ...bid,
    status: BidStatus.SUBMITTED,
    submittedAt: new Date('2026-07-01T08:00:00.000Z'),
    receipt: {
      receiptRef: 'BID-PX-BID-2026-000001-01',
      receiptHash: 'hash-123',
      createdAt: new Date('2026-07-01T08:00:01.000Z')
    }
  });
  tx.bid.findUnique.mockResolvedValue(bid);
  tx.bid.findUniqueOrThrow.mockResolvedValue(submittedBid);
  tx.bid.findFirst.mockResolvedValue(null);
  tx.bidVersion.count.mockResolvedValue(0);
  return {
    tx,
    db,
    repository: new ModuleRepository(db as any)
  };
}

function expectNoSubmitWrites(tx: ReturnType<typeof transactionMock>) {
  expect(tx.bidVersion.create).not.toHaveBeenCalled();
  expect(tx.bid.update).not.toHaveBeenCalled();
  expect(tx.bidReceipt.create).not.toHaveBeenCalled();
  expect(tx.auditEvent.create).not.toHaveBeenCalled();
}

function transactionMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'bid-1' }]),
    bid: {
      update: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    bidVersion: {
      count: vi.fn(),
      create: vi.fn()
    },
    bidReceipt: {
      create: vi.fn()
    },
    bidSample: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    bidResponse: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    bidDocument: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      create: vi.fn()
    },
    documentObject: {
      create: vi.fn().mockResolvedValue({ id: 'doc-1' }),
      delete: vi.fn()
    },
    auditEvent: {
      create: vi.fn()
    }
  };
}
