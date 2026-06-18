import { AwardResponseAction, ContractMilestoneStatus, ContractPartyRole, ContractStatus, RecommendationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeAccessContext } from '../../security/accessPolicy.js';
import { createEncryptedSigningCredential } from '../identity/signing.js';
import { ModuleRepository } from './repository.js';
import { ModuleService } from './service.js';
import {
  awardNoticeResponseBodySchema,
  awardRecommendationQuerySchema,
  contractMilestonePatchBodySchema,
  contractSignatureRequestBodySchema,
  contractStatusPatchBodySchema
} from './validators.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

function makeContractSigningService(credential: any) {
  const updates: any[] = [];
  const contractUpdates: any[] = [];
  const auditEvents: any[] = [];
  const signature = {
    id: '33333333-3333-4333-8333-333333333333',
    contractId: '44444444-4444-4444-8444-444444444444',
    signerOrgId: organizationId,
    role: ContractPartyRole.BUYER,
    status: 'PENDING',
    contract: {
      id: '44444444-4444-4444-8444-444444444444',
      buyerOrgId: organizationId,
      supplierOrgId: '55555555-5555-4555-8555-555555555555'
    }
  };
  const tx = {
    contractSignature: {
      findUnique: async () => signature,
      update: async ({ data }: any) => {
        updates.push(data);
        Object.assign(signature, data);
        return signature;
      },
      count: async () => 0
    },
    signingCredential: {
      findFirst: async () => credential
    },
    contract: {
      update: async (input: any) => {
        contractUpdates.push(input);
        return input;
      }
    },
    auditEvent: {
      create: async (input: any) => {
        auditEvents.push(input);
        return input;
      }
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).getContract = async () => ({ id: signature.contractId, signatures: [signature] });

  return {
    service: new ModuleService(repository),
    updates,
    contractUpdates,
    auditEvents,
    signature
  };
}

function contractSignInput(keyphrase: string) {
  return {
    signerName: 'Contract Signer',
    signerTitle: 'Director',
    signatureKeyphrase: keyphrase,
    payload: { accepted: true }
  };
}

const contractContext = {
  organizationId,
  userId,
  isAdmin: false
};

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

  it('requires a signing keyphrase credential for pending contract signatures', async () => {
    const { service } = makeContractSigningService(null);

    await expect(
      service.signContractSignature('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', contractSignInput('Signing123'), contractContext)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a wrong contract signing keyphrase', async () => {
    const credential = {
      id: 'credential-1',
      userId,
      status: 'ACTIVE',
      ...(await createEncryptedSigningCredential('Signing123'))
    };
    const { service } = makeContractSigningService(credential);

    await expect(
      service.signContractSignature('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', contractSignInput('Wrong123'), contractContext)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('signs pending contract signatures with the keyphrase credential', async () => {
    const credential = {
      id: 'credential-1',
      userId,
      status: 'ACTIVE',
      ...(await createEncryptedSigningCredential('Signing123'))
    };
    const { service, updates, contractUpdates, auditEvents } = makeContractSigningService(credential);

    await expect(
      service.signContractSignature('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', contractSignInput('Signing123'), contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444' });

    expect(updates[0]).toMatchObject({
      status: 'SIGNED',
      signerUserId: userId,
      signerName: 'Contract Signer',
      providerMetadata: {
        provider: 'procurex-keyphrase-ed25519-v1',
        algorithm: 'Ed25519',
        signatureCredentialId: 'credential-1'
      }
    });
    expect(updates[0].signatureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(contractUpdates[0]).toMatchObject({ data: { status: ContractStatus.ACTIVE } });
    expect(auditEvents[0].data.event).toBe('contract.signature.signed');
  });
});
