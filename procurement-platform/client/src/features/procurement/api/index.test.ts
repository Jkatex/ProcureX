import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { createEmptyTenderDraft } from '../createTenderConfig';
import { mergeSessionMarketplaceData, procurementApi } from '.';
import type { MarketplacePayload } from '../types';

describe('procurementApi runtime data access', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not return fixture tenders when tender detail cannot be loaded', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));

    await expect(procurementApi.getTenderDetail('session-draft-178333411768')).rejects.toThrow('offline');
  });

  it('does not return fixture marketplace data when marketplace cannot be loaded', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));

    await expect(procurementApi.getMarketplace()).rejects.toThrow('offline');
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
            openingDate: '2026-08-01',
            closingDate: '2026-08-30',
            location: 'Dar es Salaam',
            description: 'Diagnostic equipment package',
            createdByCurrentUser: false,
            isSaved: true
          }
        ],
        recommendedTenders: [
          {
            id: 'invited-tender-1',
            reference: 'PX-INV-001',
            title: 'Invited diagnostic maintenance',
            organization: 'Medical Stores Department',
            ownerOrganization: 'Medical Stores Department',
            type: 'Service',
            category: 'Maintenance',
            status: 'Open',
            visibility: 'INVITED',
            budget: 100000000,
            closingDate: '2026-08-25',
            location: 'Dar es Salaam',
            description: 'Invited maintenance package',
            createdByCurrentUser: false
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
      openingDate: '2026-08-01',
      isSaved: true
    });
    expect(result.recommendedTenders?.[0]).toMatchObject({
      id: 'invited-tender-1',
      visibility: 'INVITED',
      categories: ['Maintenance']
    });
  });

  it('does not synthesize recommendations from all marketplace tenders when the backend omits recommendations', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        tenders: [
          {
            id: 'tender-1',
            reference: 'PX-2026-001',
            title: 'Supply of unrelated furniture',
            organization: 'Buyer',
            ownerOrganization: 'Buyer',
            type: 'Goods',
            category: 'Furniture',
            status: 'Open',
            budget: 1000000,
            closingDate: '2026-08-30',
            location: 'Dar es Salaam',
            description: 'Office furniture package',
            createdByCurrentUser: false
          }
        ],
        myTenders: [],
        myBids: [],
        summary: {},
        pagination: { page: 1, limit: 20, matching: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
      }
    });

    const result = await procurementApi.getMarketplace();

    expect(result.tenders).toHaveLength(1);
    expect(result.recommendedTenders).toEqual([]);
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
    expect(result.clarificationInquiries).toEqual([]);
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

  it('updates buyer notices through the procurement endpoint', async () => {
    vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Buyer notice saved successfully',
        data: {
          id: 'tender-1',
          buyerNotice: 'Updated bidder instruction',
          updatedAt: '2099-08-01T10:00:00.000Z'
        }
      }
    });

    await expect(procurementApi.updateBuyerNotice('tender-1', 'Updated bidder instruction')).resolves.toMatchObject({
      success: true,
      data: { buyerNotice: 'Updated bidder instruction' }
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/api/procurement/tenders/tender-1/buyer-notice', { buyerNotice: 'Updated bidder instruction' });
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
    expect(result.myTenders[0].actionLabel).toBe('View tender');
  });
});
