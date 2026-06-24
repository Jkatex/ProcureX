import { AwardResponseAction, ContractLifecycleItemStatus, ContractMilestoneStatus, ContractPartyRole, ContractStatus, ContractTerminationType, RecommendationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeAccessContext } from '../../security/accessPolicy.js';
import { createEncryptedSigningCredential } from '../identity/signing.js';
import { ModuleRepository } from './repository.js';
import { ModuleService } from './service.js';
import {
  awardNoticeResponseBodySchema,
  awardRecommendationQuerySchema,
  acceptanceBodySchema,
  clauseBodySchema,
  contractPaymentBodySchema,
  deliverableBodySchema,
  contractMilestonePatchBodySchema,
  contractSignatureRequestBodySchema,
  contractStatusPatchBodySchema,
  negotiationBodySchema,
  paymentScheduleBodySchema,
  requiredDocumentBodySchema,
  riskBodySchema,
  terminationBodySchema,
  warrantyBodySchema,
  workflowApprovalBodySchema
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

  it('signs pending contract signatures and moves the contract to signed readiness', async () => {
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
    expect(contractUpdates[0]).toMatchObject({ data: { status: ContractStatus.SIGNED } });
    expect(auditEvents[0].data.event).toBe('contract.signature.signed');
  });

  it('validates lifecycle risk and termination payloads', () => {
    expect(
      riskBodySchema.parse({
        title: 'Delivery delay',
        category: 'time',
        likelihood: 3,
        impact: 4,
        mitigationAction: 'Weekly progress review',
        status: ContractLifecycleItemStatus.OPEN
      })
    ).toMatchObject({
      title: 'Delivery delay',
      category: 'time',
      likelihood: 3,
      impact: 4,
      payload: {}
    });

    expect(
      terminationBodySchema.parse({
        terminationType: ContractTerminationType.SUPPLIER_DEFAULT,
        reason: 'Repeated failure to meet accepted milestones.',
        contractClause: 'Default clause'
      })
    ).toMatchObject({
      terminationType: ContractTerminationType.SUPPLIER_DEFAULT,
      reason: 'Repeated failure to meet accepted milestones.',
      payload: {}
    });

    expect(() => terminationBodySchema.parse({ terminationType: 'CANCEL', reason: '' })).toThrow();
  });

  it('validates deep contract lifecycle workflow payloads', () => {
    expect(clauseBodySchema.parse({ clauseKey: 'termination', title: 'Termination', status: ContractLifecycleItemStatus.OPEN })).toMatchObject({
      clauseKey: 'termination',
      title: 'Termination',
      category: 'general',
      payload: {}
    });

    expect(negotiationBodySchema.parse({ raisedByRole: 'Buyer', subject: 'Payment terms' })).toMatchObject({
      raisedByRole: 'Buyer',
      subject: 'Payment terms',
      payload: {}
    });

    expect(deliverableBodySchema.parse({ title: 'Delivery report', status: ContractLifecycleItemStatus.SUBMITTED })).toMatchObject({
      title: 'Delivery report',
      status: ContractLifecycleItemStatus.SUBMITTED,
      payload: {}
    });

    expect(acceptanceBodySchema.parse({ certificateNo: 'ACC-1', acceptedValue: 1000 })).toMatchObject({
      certificateNo: 'ACC-1',
      acceptedValue: 1000,
      currency: 'TZS',
      payload: {}
    });

    expect(paymentScheduleBodySchema.parse({ title: 'Milestone payment', amount: 1000 })).toMatchObject({
      title: 'Milestone payment',
      amount: 1000,
      currency: 'TZS',
      payload: {}
    });

    expect(contractPaymentBodySchema.parse({ status: 'REVIEW', grossAmount: 1000, retentionAmount: 50 })).toMatchObject({
      status: 'REVIEW',
      grossAmount: 1000,
      retentionAmount: 50,
      currency: 'TZS',
      payload: {}
    });

    expect(warrantyBodySchema.parse({ title: 'Defects period', endDate: '2026-12-31' })).toMatchObject({
      title: 'Defects period',
      endDate: '2026-12-31',
      payload: {}
    });

    expect(requiredDocumentBodySchema.parse({ documentType: 'performance-security', title: 'Performance security', ownerRole: 'Supplier' })).toMatchObject({
      documentType: 'performance-security',
      ownerRole: 'Supplier',
      payload: {}
    });

    expect(workflowApprovalBodySchema.parse({ stepKey: 'legal-review', role: 'Legal Officer', status: ContractLifecycleItemStatus.APPROVED })).toMatchObject({
      stepKey: 'legal-review',
      role: 'Legal Officer',
      status: ContractLifecycleItemStatus.APPROVED,
      payload: {}
    });
  });
});
