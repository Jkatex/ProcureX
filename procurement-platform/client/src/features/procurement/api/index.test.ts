import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { createEmptyTenderDraft } from '../createTenderConfig';
import { mergeSessionMarketplaceData, procurementApi } from '.';
import type { MarketplacePayload } from '../types';

describe('procurementApi tender detail fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not return the first fixture when a requested tender id is missing', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));

    await expect(procurementApi.getTenderDetail('session-draft-178333411768')).rejects.toThrow('Tender not found');
  });

  it('normalizes backend marketplace rows with singular category for the React UI', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        tenders: [
          {
            id: 'tender-1',
            reference: 'PX-2026-001',
            title: 'Supply of medical equipment',
            organization: 'Medical Stores Department',
            ownerOrganization: 'Medical Stores Department',
            type: 'Goods',
            category: 'Medical Equipment',
            status: 'Open',
            budget: 250000000,
            closingDate: '2026-08-30',
            location: 'Dar es Salaam',
            description: 'Diagnostic equipment package',
            createdByCurrentUser: false,
            isSaved: true
          }
        ],
        myTenders: [],
        myBids: [],
        summary: {},
        pagination: { page: 1, limit: 20, matching: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
      }
    });

    const result = await procurementApi.getMarketplace();

    expect(result.tenders[0]).toMatchObject({
      category: 'Medical Equipment',
      categories: ['Medical Equipment'],
      currency: 'TZS',
      isSaved: true
    });
  });

  it('normalizes backend tender detail category before detail pages render it', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        id: 'tender-1',
        reference: 'PX-2026-001',
        title: 'Supply of medical equipment',
        organization: 'Medical Stores Department',
        ownerOrganization: 'Medical Stores Department',
        type: 'Goods',
        category: 'Medical Equipment',
        status: 'Open',
        budget: 250000000,
        currency: 'TZS',
        closingDate: '2026-08-30',
        location: 'Dar es Salaam',
        description: 'Diagnostic equipment package',
        createdByCurrentUser: false,
        ownedByCurrentOrganization: false,
        canBid: true,
        hasDraftBid: false,
        hasSubmittedBid: false,
        visibility: 'PUBLIC_MARKETPLACE',
        publishedAt: '2026-07-01T08:00:00.000Z',
        requirements: {},
        activity: { marketplaceViews: 9, documentDownloads: 2, clarifications: 0 }
      }
    });

    const result = await procurementApi.getTenderDetail('tender-1');

    expect(result.categories).toEqual(['Medical Equipment']);
    expect(result.requirementRows).toEqual([]);
    expect(result.bidSummary).toEqual({ total: 0, draft: 0, submitted: 0, withdrawn: 0 });
    expect(result.activity).toEqual({ marketplaceViews: 9, documentDownloads: 2, clarifications: 0 });
  });

  it('records tender document downloads through the procurement endpoint', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { success: true, message: 'Document download recorded' }
    });

    await expect(procurementApi.recordTenderDocumentDownload('tender-1', 'doc-1')).resolves.toEqual({
      success: true,
      message: 'Document download recorded'
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/procurement/tenders/tender-1/documents/doc-1/download', {});
  });

  it('keeps persisted ids in session-published My Tenders links', () => {
    const draft = {
      ...createEmptyTenderDraft(),
      id: '11111111-1111-4111-8111-111111111111',
      status: 'PUBLISHED' as const,
      title: 'Supply of 10 Desktop Computers',
      reference: 'PX-GDS-2026-101',
      publishedAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z'
    };
    const payload: MarketplacePayload = { tenders: [], myTenders: [], myBids: [] };

    const result = mergeSessionMarketplaceData(payload, [draft], [draft], 'Komba Building Materials');

    expect(result.tenders[0].id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.myTenders[0].nav).toBe('/procurement/tender-details?tenderId=11111111-1111-4111-8111-111111111111');
    expect(result.myTenders[0].nav).not.toContain('session-');
  });
});
