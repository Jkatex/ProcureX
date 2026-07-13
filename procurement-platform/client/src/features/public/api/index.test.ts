import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { publicApi } from '.';

describe('publicApi runtime data access', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads open tenders from the backend marketplace endpoint', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { tenders: [{ id: 'tender-1', title: 'Live tender' }] } });

    await expect(publicApi.listOpenTenders()).resolves.toEqual([{ id: 'tender-1', title: 'Live tender' }]);
    expect(apiClient.get).toHaveBeenCalledWith('/api/procurement/marketplace');
  });

  it('does not fall back to fixture tenders when the backend is unavailable', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('offline'));

    await expect(publicApi.listOpenTenders()).rejects.toThrow('offline');
  });
});
