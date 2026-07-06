import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { createEmptyTenderDraft } from '../createTenderConfig';
import { mergeSessionMarketplaceData, procurementApi } from '.';
import type { MarketplacePayload } from '../types';

describe('procurementApi tender detail fallback', () => {
  it('does not return the first fixture when a requested tender id is missing', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));

    await expect(procurementApi.getTenderDetail('session-draft-178333411768')).rejects.toThrow('Tender not found');
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
