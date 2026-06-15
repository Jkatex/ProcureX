import { AwardResponseAction, ContractMilestoneStatus, ContractPartyRole, ContractStatus, RecommendationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeAccessContext } from '../../security/accessPolicy.js';
import { ModuleService } from './service.js';
import {
  awardNoticeResponseBodySchema,
  awardRecommendationQuerySchema,
  contractMilestonePatchBodySchema,
  contractSignatureRequestBodySchema,
  contractStatusPatchBodySchema
} from './validators.js';

const organizationId = '11111111-1111-4111-8111-111111111111';

describe('award-contract module', () => {
  it('normalizes award recommendation query defaults', () => {
    expect(awardRecommendationQuerySchema.parse({})).toEqual({
      organizationId: '',
      status: 'all',
      search: '',
      page: 1,
      pageSize: 20
    });

    expect(
      awardRecommendationQuerySchema.parse({
        organizationId,
        status: RecommendationStatus.APPROVED,
        search: 'water',
        page: '2'
      })
    ).toMatchObject({
      organizationId,
      status: RecommendationStatus.APPROVED,
      search: 'water',
      page: 2
    });
  });

  it('validates supplier response and contract workflow payloads', () => {
    expect(
      awardNoticeResponseBodySchema.parse({
        action: AwardResponseAction.ACCEPT,
        note: 'Accepted for contract preparation.',
        payload: { acceptedBy: 'supplier' }
      })
    ).toEqual({
      action: AwardResponseAction.ACCEPT,
      note: 'Accepted for contract preparation.',
      payload: { acceptedBy: 'supplier' }
    });

    expect(contractSignatureRequestBodySchema.parse({})).toEqual({
      roles: [ContractPartyRole.BUYER, ContractPartyRole.SUPPLIER]
    });

    expect(contractMilestonePatchBodySchema.parse({ status: ContractMilestoneStatus.SUBMITTED })).toEqual({
      status: ContractMilestoneStatus.SUBMITTED
    });

    expect(contractStatusPatchBodySchema.parse({ status: ContractStatus.ACTIVE, note: 'All signatures received.' })).toEqual({
      status: ContractStatus.ACTIVE,
      note: 'All signatures received.'
    });

    expect(() => awardNoticeResponseBodySchema.parse({ action: 'MAYBE' })).toThrow();
    expect(() => contractMilestonePatchBodySchema.parse({})).toThrow();
  });

  it('exposes award and contract permissions through access policy', () => {
    const adminAccess = computeAccessContext({
      accountType: 'ADMIN',
      verificationStatus: 'APPROVED',
      capabilities: []
    });
    expect(adminAccess.permissions).toEqual(expect.arrayContaining(['award.manage', 'award.respond', 'contract.manage', 'contract.sign', 'contract.track']));

    const userAccess = computeAccessContext({
      accountType: 'USER',
      verificationStatus: 'APPROVED',
      capabilities: ['BUYER', 'SUPPLIER'],
      trustTier: 'BRONZE',
      screeningStatus: 'CLEAR'
    });
    expect(userAccess.featureGates).toMatchObject({
      awardManagement: true,
      awardResponse: true,
      contractManagement: true,
      contractSigning: true,
      contractTracking: true
    });
  });

  it('returns module status through the service contract', async () => {
    const service = new ModuleService({
      health: async () => ({ ready: true })
    } as any);

    await expect(service.status()).resolves.toMatchObject({
      key: 'award-contract',
      status: 'ready'
    });
  });
});
