import { TenderStatus, Visibility, VerificationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ModuleRepository } from './repository.js';

describe('procurement public welcome repository', () => {
  it('filters featured tenders to public open marketplace opportunities', async () => {
    const db = {
      organization: { count: vi.fn().mockResolvedValue(5) },
      tender: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([])
      },
      user: { count: vi.fn().mockResolvedValue(4) }
    };
    const repository = new ModuleRepository(db as any);

    await repository.getWelcomeData();

    expect(db.tender.count).toHaveBeenCalledWith({
      where: {
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE
      }
    });
    expect(db.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: TenderStatus.OPEN,
          visibility: Visibility.PUBLIC_MARKETPLACE
        },
        take: 3
      })
    );
    expect(db.user.count).toHaveBeenCalledWith({
      where: {
        verificationStatus: VerificationStatus.APPROVED
      }
    });
  });
});
