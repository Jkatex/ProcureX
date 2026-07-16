import { describe, expect, it, vi } from 'vitest';
import { ModuleController } from './controller.js';
import { MARKETPLACE_UNAVAILABLE_CODE, MARKETPLACE_UNAVAILABLE_MESSAGE, PUBLISH_VALIDATION_FAILED_CODE } from './service.js';

const validTenderId = '11111111-1111-4111-8111-111111111111';

function mockResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    type: vi.fn(),
    send: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.type.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
}

function mockRequest(input: { query?: unknown; body?: unknown; params?: unknown; token?: string }) {
  return {
    query: input.query ?? {},
    body: input.body,
    params: input.params ?? {},
    header: vi.fn((name: string) => (name.toLowerCase() === 'authorization' && input.token ? `Bearer ${input.token}` : undefined))
  };
}

function expectValidationResponse(res: ReturnType<typeof mockResponse>, next: ReturnType<typeof vi.fn>) {
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      message: 'Validation failed',
      errors: expect.any(Array)
    })
  );
  expect(next).not.toHaveBeenCalled();
}

describe('procurement controller validation responses', () => {
  it('returns procurement master data from the service', async () => {
    const payload = { success: true, data: { groups: [{ group: 'tender-types', items: [] }] } };
    const service = { masterData: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.masterData(mockRequest({ query: {} }) as any, res as any, next);

    expect(service.masterData).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a master data group from the service', async () => {
    const payload = { success: true, data: { group: 'tender-types', items: [] } };
    const service = { masterDataGroup: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.masterDataGroup(mockRequest({ params: { group: 'tender-types' } }) as any, res as any, next);

    expect(service.masterDataGroup).toHaveBeenCalledWith('tender-types');
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found for unknown master data groups', async () => {
    const service = { masterDataGroup: vi.fn().mockResolvedValue(null) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.masterDataGroup(mockRequest({ params: { group: 'unknown-group' } }) as any, res as any, next);

    expect(service.masterDataGroup).toHaveBeenCalledWith('unknown-group');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, message: 'Master data group was not found.' }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns procurement design form schemas from the service', async () => {
    const payload = { success: true, data: { schemaVersion: 'procurement-design-v1', schemas: [] } };
    const service = { designFormSchemas: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.designFormSchemas(mockRequest({ query: {} }) as any, res as any, next);

    expect(service.designFormSchemas).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns one procurement design form schema from the service', async () => {
    const payload = { success: true, data: { schemaVersion: 'procurement-design-v1', type: 'goods', sections: [] } };
    const service = { designFormSchema: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.designFormSchema(mockRequest({ params: { type: 'Goods' } }) as any, res as any, next);

    expect(service.designFormSchema).toHaveBeenCalledWith('goods');
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found for unknown procurement design form schema types', async () => {
    const service = { designFormSchema: vi.fn().mockResolvedValue(null) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.designFormSchema(mockRequest({ params: { type: 'lease' } }) as any, res as any, next);

    expect(service.designFormSchema).toHaveBeenCalledWith('lease');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, message: 'Form schema type was not found.' }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns a tender language scan from the service', async () => {
    const payload = { success: true, data: { riskLevel: 'Low', score: 0, issues: [] } };
    const service = { scanTenderLanguage: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.scanLanguage(
      mockRequest({
        token: 'token-1',
        body: {
          title: 'Supply of ICT equipment',
          description: 'Open and measurable specifications.',
          requirements: {},
          evaluationCriteria: {},
          metadata: {}
        }
      }) as any,
      res as any,
      next
    );

    expect(service.scanTenderLanguage).toHaveBeenCalledWith('token-1', expect.objectContaining({ title: 'Supply of ICT equipment' }));
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns the procurement taxonomy from the service', async () => {
    const payload = { success: true, data: { taxonomyVersion: 'procurement-taxonomy-v1', categories: [] } };
    const service = { taxonomy: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.taxonomy(mockRequest({ query: {} }) as any, res as any, next);

    expect(service.taxonomy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns standardized category results from the service', async () => {
    const payload = { success: true, data: { rawCategory: 'laptops', standardCategory: 'ICT Equipment', type: 'Goods', confidence: 0.98, synonymsMatched: ['laptops'] } };
    const service = { standardizeCategory: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.standardizeCategory(mockRequest({ body: { rawCategory: 'laptops', type: 'Goods' } }) as any, res as any, next);

    expect(service.standardizeCategory).toHaveBeenCalledWith(expect.objectContaining({ rawCategory: 'laptops' }));
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid marketplace queries', async () => {
    const service = { marketplace: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.marketplace(mockRequest({ query: { search: 'x'.repeat(101), limit: '101' } }) as any, res as any, next);

    expectValidationResponse(res, next);
    expect(service.marketplace).not.toHaveBeenCalled();
  });

  it('returns a sanitized marketplace outage response without raw database details', async () => {
    const error = new Error(MARKETPLACE_UNAVAILABLE_MESSAGE) as Error & { status?: number; code?: string; cause?: Error };
    error.status = 503;
    error.code = MARKETPLACE_UNAVAILABLE_CODE;
    error.cause = new Error("Can't reach database server at db.internal");
    const service = {
      marketplace: vi.fn(async () => {
        throw error;
      })
    };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.marketplace(mockRequest({ query: {} }) as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: MARKETPLACE_UNAVAILABLE_MESSAGE
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("Can't reach database");
    expect(next).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid tender creation payloads', async () => {
    const service = { createTender: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.createTender(
      mockRequest({
        body: {
          title: 'Bad',
          description: 'Short',
          type: 'Lease',
          location: '',
          metadata: []
        }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.createTender).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid tender update payloads', async () => {
    const service = { updateTender: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.updateTender(
      mockRequest({
        params: { tenderId: validTenderId },
        body: { title: 'Bad', reference: 'PX-NEW' }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.updateTender).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid tender draft delete params', async () => {
    const service = { deleteTenderDraft: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.deleteTenderDraft(
      mockRequest({
        params: { tenderId: 'not-a-valid-id' }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.deleteTenderDraft).not.toHaveBeenCalled();
  });

  it('deletes draft tenders through the service', async () => {
    const payload = {
      success: true,
      message: 'Tender draft deleted successfully',
      data: {
        id: validTenderId,
        reference: 'PX-DRAFT-001',
        title: 'Draft tender'
      }
    };
    const service = { deleteTenderDraft: vi.fn().mockResolvedValue(payload) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.deleteTenderDraft(
      mockRequest({
        params: { tenderId: validTenderId },
        token: 'token-1'
      }) as any,
      res as any,
      next
    );

    expect(service.deleteTenderDraft).toHaveBeenCalledWith(validTenderId, 'token-1');
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid buyer logo tender params', async () => {
    const service = { tenderBuyerLogo: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.tenderBuyerLogo(
      mockRequest({
        params: { tenderId: 'not-a-valid-id' }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.tenderBuyerLogo).not.toHaveBeenCalled();
  });

  it('streams buyer logos through the service', async () => {
    const image = {
      filename: 'buyer-logo.png',
      contentType: 'image/png',
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    };
    const service = { tenderBuyerLogo: vi.fn().mockResolvedValue(image) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.tenderBuyerLogo(
      mockRequest({
        params: { tenderId: validTenderId },
        token: 'token-1'
      }) as any,
      res as any,
      next
    );

    expect(service.tenderBuyerLogo).toHaveBeenCalledWith(validTenderId, 'token-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="buyer-logo.png"');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.type).toHaveBeenCalledWith('image/png');
    expect(res.send).toHaveBeenCalledWith(image.body);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found when a buyer logo is unavailable', async () => {
    const service = { tenderBuyerLogo: vi.fn().mockResolvedValue(null) };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.tenderBuyerLogo(
      mockRequest({
        params: { tenderId: validTenderId }
      }) as any,
      res as any,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, message: 'Buyer logo was not found.' }));
    expect(res.send).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid buyer notice payloads', async () => {
    const service = { updateTenderBuyerNotice: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.updateTenderBuyerNotice(
      mockRequest({
        params: { tenderId: validTenderId },
        body: { buyerNotice: 'x'.repeat(5001) }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.updateTenderBuyerNotice).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for publish bodies without a signing keyphrase', async () => {
    const service = { publishTender: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.publishTender(
      mockRequest({
        params: { tenderId: validTenderId },
        body: {}
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.publishTender).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for unexpected publish body fields', async () => {
    const service = { publishTender: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.publishTender(
      mockRequest({
        params: { tenderId: validTenderId },
        body: { signatureKeyphrase: 'Signing123', status: 'OPEN' }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.publishTender).not.toHaveBeenCalled();
  });

  it('returns publish validation failures with the production publish envelope', async () => {
    const error = Object.assign(new Error('Tender cannot be published'), {
      status: 400,
      code: PUBLISH_VALIDATION_FAILED_CODE,
      errors: [{ step: 'basic-fields', field: 'budget', message: 'Tender budget is required before publishing.', severity: 'error' }]
    });
    const service = {
      publishTender: vi.fn(async () => {
        throw error;
      })
    };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.publishTender(
      mockRequest({ params: { tenderId: validTenderId }, body: { signatureKeyphrase: 'Signing123' }, token: 'token-1' }) as any,
      res as any,
      next
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Tender cannot be published',
      errors: error.errors
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns structured validation errors for invalid save tender ids', async () => {
    const service = { saveTender: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.saveTender(mockRequest({ params: { tenderId: 'not-a-valid-id' } }) as any, res as any, next);

    expectValidationResponse(res, next);
    expect(service.saveTender).not.toHaveBeenCalled();
  });
});
