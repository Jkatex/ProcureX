import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { biddingApi } from '.';
import type { BidDto, BidSampleDto } from '../types';

describe('biddingApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads bid documents as multipart form data', async () => {
    const bid = bidDto({ documents: [] });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: bid });
    const file = new File(['technical proposal'], 'technical.pdf', { type: 'application/pdf' });

    await expect(
      biddingApi.uploadDocuments('bid-1', {
        files: [file],
        documentType: 'TECHNICAL_PRODUCT_SPEC',
        envelope: 'TECHNICAL',
        metadata: { requirementKey: 'goods-technical' }
      })
    ).resolves.toBe(bid);

    expect(post).toHaveBeenCalledWith('/api/bidding/bid-1/documents', expect.any(FormData), {
      headers: { 'Content-Type': undefined }
    });
    const formData = post.mock.calls[0][1] as FormData;
    expect(formData.get('documentType')).toBe('TECHNICAL_PRODUCT_SPEC');
    expect(formData.get('envelope')).toBe('TECHNICAL');
    expect(formData.get('metadata')).toBe(JSON.stringify({ requirementKey: 'goods-technical' }));
    expect(formData.getAll('files')).toEqual([file]);
  });

  it('gets a tender-driven bid schema', async () => {
    const schema = {
      tenderId: 'tender-1',
      tenderReference: 'PX-2026-001',
      tenderTitle: 'Supply of laptops',
      tenderType: 'GOODS',
      schemaVersion: 'bid-submission-schema-v1' as const,
      steps: []
    };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { success: true, data: schema } });

    await expect(biddingApi.getTenderSchema('tender-1')).resolves.toBe(schema);

    expect(get).toHaveBeenCalledWith('/api/bidding/tenders/tender-1/schema');
  });

  it('lists bid samples', async () => {
    const samples = [sampleDto()];
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: samples });

    await expect(biddingApi.listSamples('bid-1')).resolves.toBe(samples);

    expect(get).toHaveBeenCalledWith('/api/bidding/bid-1/samples');
  });

  it('creates bid samples', async () => {
    const sample = sampleDto();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: sample });
    const payload = {
      sampleName: 'Laptop sample',
      relatedItem: 'line-1',
      quantity: 2,
      deliveryLocation: 'PMU office',
      courier: 'DHL',
      trackingNumber: 'DHL-123',
      trackingStatus: 'SUBMITTED' as const
    };

    await expect(biddingApi.createSample('bid-1', payload)).resolves.toBe(sample);

    expect(post).toHaveBeenCalledWith('/api/bidding/bid-1/samples', payload);
  });

  it('patches bid samples', async () => {
    const sample = sampleDto({ trackingStatus: 'SUBMITTED' });
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ data: sample });
    const payload = { trackingStatus: 'SUBMITTED' as const };

    await expect(biddingApi.patchSample('bid-1', 'sample-1', payload)).resolves.toBe(sample);

    expect(patch).toHaveBeenCalledWith('/api/bidding/bid-1/samples/sample-1', payload);
  });
});

function bidDto(patch: Partial<BidDto> = {}): BidDto {
  return {
    id: 'bid-1',
    tenderId: 'tender-1',
    tenderReference: 'PX-2026-001',
    tenderTitle: 'Supply of laptops',
    buyerOrgId: 'buyer-1',
    buyerName: 'Buyer Org',
    supplierOrgId: 'supplier-1',
    supplierName: 'Supplier Org',
    reference: 'PX-BID-2026-000001',
    status: 'DRAFT',
    submittedAt: null,
    totalAmount: 0,
    currency: 'TZS',
    payload: {},
    responses: [],
    documents: [],
    receipt: null,
    createdAt: '2026-07-09T10:00:00.000Z',
    updatedAt: '2026-07-09T10:00:00.000Z',
    ...patch
  };
}

function sampleDto(patch: Partial<BidSampleDto> = {}): BidSampleDto {
  return {
    id: 'sample-1',
    bidId: 'bid-1',
    tenderId: 'tender-1',
    supplierOrgId: 'supplier-1',
    sampleName: 'Laptop sample',
    relatedItem: 'line-1',
    quantity: 2,
    deliveryLocation: 'PMU office',
    deliveryDeadline: null,
    trackingStatus: 'PENDING_SUBMISSION',
    courier: 'DHL',
    trackingNumber: 'DHL-123',
    submittedAt: null,
    receivedAt: null,
    inspectedAt: null,
    inspectionNotes: null,
    metadata: {},
    createdAt: '2026-07-09T10:00:00.000Z',
    updatedAt: '2026-07-09T10:00:00.000Z',
    ...patch
  };
}
