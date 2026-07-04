import { describe, expect, it, vi } from 'vitest';
import { ModuleController } from './controller.js';
import { MARKETPLACE_UNAVAILABLE_CODE, MARKETPLACE_UNAVAILABLE_MESSAGE } from './service.js';

const validTenderId = '11111111-1111-4111-8111-111111111111';

function mockResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
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

  it('returns structured validation errors for non-empty publish bodies', async () => {
    const service = { publishTender: vi.fn() };
    const controller = new ModuleController(service as any);
    const res = mockResponse();
    const next = vi.fn();

    await controller.publishTender(
      mockRequest({
        params: { tenderId: validTenderId },
        body: { status: 'OPEN' }
      }) as any,
      res as any,
      next
    );

    expectValidationResponse(res, next);
    expect(service.publishTender).not.toHaveBeenCalled();
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
