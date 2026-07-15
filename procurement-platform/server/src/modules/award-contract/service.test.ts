import { AwardNoticeStatus, AwardResponseAction, ContractLifecycleItemStatus, ContractMilestoneStatus, ContractPartyRole, ContractStatus, ContractTerminationType, InvoiceStatus, RecommendationStatus, TenderStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeAccessContext } from '../../security/accessPolicy.js';
import { createEncryptedSigningCredential } from '../identity/signing.js';
import { ModuleRepository } from './repository.js';
import { ModuleService } from './service.js';
import {
  awardNoticeResponseBodySchema,
  awardRecommendationQuerySchema,
  acceptanceBodySchema,
  boqMeasurementBodySchema,
  boqMeasurementReviewBodySchema,
  clauseBodySchema,
  contractDefectActionBodySchema,
  contractNegotiationDecisionBodySchema,
  contractDocumentUploadBodySchema,
  contractPaymentBodySchema,
  deliverableBodySchema,
  goodsInspectionBodySchema,
  interimPaymentCertificateBodySchema,
  interimPaymentCertificateCertifyBodySchema,
  contractMilestonePatchBodySchema,
  contractSignatureRequestBodySchema,
  contractStatusPatchBodySchema,
  negotiationBodySchema,
  paymentScheduleBodySchema,
  requiredDocumentBodySchema,
  riskBodySchema,
  serviceCreditReviewBodySchema,
  serviceIncidentActionBodySchema,
  serviceIncidentBodySchema,
  serviceReportReviewBodySchema,
  supplierRiskProfileBodySchema,
  terminationBodySchema,
  warrantyBodySchema,
  worksCompletionCertificateBodySchema,
  worksProgressReviewBodySchema,
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

function makeLifecycleNumberRepository() {
  const goodsInspectionUpserts: any[] = [];
  const acceptanceCreates: any[] = [];
  const contract = {
    id: '44444444-4444-4444-8444-444444444444',
    buyerOrgId: organizationId,
    supplierOrgId: '55555555-5555-4555-8555-555555555555',
    status: ContractStatus.ACTIVE
  };
  const tx = {
    goodsInspection: {
      upsert: async (input: any) => {
        goodsInspectionUpserts.push(input);
        return input.create;
      }
    },
    contractGoodsReceipt: {
      findFirst: async () => ({
        id: 'receipt-1',
        contractId: contract.id,
        status: ContractLifecycleItemStatus.APPROVED,
        payload: { acceptedValue: 1000 },
        lines: [{ acceptedQuantity: 10, payload: {} }]
      })
    },
    contractAcceptance: {
      create: async (input: any) => {
        acceptanceCreates.push(input);
        return input.data;
      }
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).requireContract = async () => contract;
  (repository as any).audit = async () => undefined;
  (repository as any).getContract = async () => ({ id: contract.id });
  return { repository, goodsInspectionUpserts, acceptanceCreates };
}

function makeFinalDraftAcceptanceRepository() {
  const acceptanceCreates: any[] = [];
  const contract = {
    id: '44444444-4444-4444-8444-444444444444',
    buyerOrgId: organizationId,
    supplierOrgId: '55555555-5555-4555-8555-555555555555',
    status: ContractStatus.NEGOTIATION
  };
  const tx = {
    contract: {
      findUnique: async ({ where }: any) => where.id === contract.id ? contract : null
    },
    contractAcceptance: {
      create: async (input: any) => {
        acceptanceCreates.push(input);
        return input.data;
      }
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).audit = async () => undefined;
  (repository as any).getContract = async () => ({ id: contract.id });
  return { repository, contract, acceptanceCreates };
}

async function makeAwardNoticeRepository(status: RecommendationStatus) {
  const calls: string[] = [];
  const credential = {
    id: 'credential-1',
    userId,
    status: 'ACTIVE',
    ...(await createEncryptedSigningCredential('Signing123'))
  };
  const recommendation = {
    id: 'recommendation-1',
    status,
    reason: 'Best evaluated bidder.',
    supplierOrgId: '55555555-5555-4555-8555-555555555555',
    bidId: '66666666-6666-4666-8666-666666666666',
    notice: null,
    contracts: [],
    workspace: {
      buyerOrgId: organizationId,
      tenderId: '77777777-7777-4777-8777-777777777777',
      tender: {
        id: '77777777-7777-4777-8777-777777777777',
        reference: 'PX-T-1',
        title: 'Medical supplies'
      }
    }
  };
  const tx = {
    awardRecommendation: {
      findUnique: async () => recommendation,
      update: async (input: any) => {
        calls.push('awardRecommendation.update');
        return input;
      }
    },
    awardClause: {
      count: async () => {
        calls.push('awardClause.count');
        throw new Error('Clause blocker should not run when sending notices.');
      }
    },
    awardNegotiation: {
      count: async () => {
        calls.push('awardNegotiation.count');
        throw new Error('Negotiation blocker should not run when sending notices.');
      }
    },
    awardWinner: {
      findMany: async () => [{
        id: 'winner-1',
        recommendationId: recommendation.id,
        payload: {}
      }],
      update: async (input: any) => {
        calls.push('awardWinner.update');
        return input;
      }
    },
    awardNotice: {
      upsert: async (input: any) => {
        calls.push('awardNotice.upsert');
        return { id: 'notice-1', ...input.create };
      }
    },
    bid: {
      update: async (input: any) => {
        calls.push('bid.update');
        return input;
      }
    },
    tender: {
      update: async (input: any) => {
        calls.push('tender.update');
        return input;
      }
    },
    awardGroup: {
      update: async (input: any) => {
        calls.push('awardGroup.update');
        return input;
      }
    },
    signingCredential: {
      findFirst: async () => credential
    },
    signedAction: {
      create: async (input: any) => {
        calls.push('signedAction.create');
        return input;
      }
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).findOrCreateAwardGroup = async () => ({ id: 'award-group-1', payload: {} });
  (repository as any).generateAwardBidPackRecord = async () => {
    calls.push('generateAwardBidPackRecord');
  };
  (repository as any).audit = async () => {
    calls.push('audit');
  };
  (repository as any).getRecommendation = async () => ({ id: recommendation.id, status });
  return { service: new ModuleService(repository), calls };
}

function makePreAwardDraftRepository(options: {
  tenderStatus?: TenderStatus;
  buyerOrgId?: string;
  existingContract?: { id: string } | null;
} = {}) {
  const contractCreates: any[] = [];
  const auditCreates: any[] = [];
  const tender = {
    id: '77777777-7777-4777-8777-777777777777',
    reference: 'PX-T-1',
    title: 'Medical supplies',
    type: 'GOODS',
    status: options.tenderStatus ?? TenderStatus.PUBLISHED,
    buyerOrgId: options.buyerOrgId ?? organizationId,
    budget: 1000,
    currency: 'TZS',
    contractType: 'SUPPLY'
  };
  const tx = {
    tender: {
      findUnique: async () => tender
    },
    contract: {
      findFirst: async () => options.existingContract ?? null,
      create: async (input: any) => {
        contractCreates.push(input);
        return { id: '44444444-4444-4444-8444-444444444444', ...input.data };
      }
    },
    auditEvent: {
      create: async (input: any) => {
        auditCreates.push(input);
        return input;
      }
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).getContract = async (id: string) => ({
    id,
    tenderId: tender.id,
    buyerOrgId: tender.buyerOrgId,
    awardId: null,
    supplierOrgId: null,
    status: ContractStatus.DRAFT
  });
  return { repository, contractCreates, auditCreates };
}

function makeDraftVersionRepository(options: {
  awardNoticeStatus?: AwardNoticeStatus;
  versionCount?: number;
  status?: ContractStatus;
  payload?: Record<string, unknown>;
} = {}) {
  const contractUpdates: any[] = [];
  const versionCreates: any[] = [];
  const auditCreates: any[] = [];
  const contract = {
    id: '44444444-4444-4444-8444-444444444444',
    buyerOrgId: organizationId,
    supplierOrgId: '55555555-5555-4555-8555-555555555555',
    awardId: '66666666-6666-4666-8666-666666666666',
    status: options.status ?? ContractStatus.DRAFT,
    payload: options.payload ?? {},
    versions: Array.from({ length: options.versionCount ?? 1 }, (_, index) => ({ versionNo: index + 1 })),
    awardNotice: { status: options.awardNoticeStatus ?? AwardNoticeStatus.ACCEPTED }
  };
  const tx = {
    contract: {
      findUnique: async () => contract,
      update: async (input: any) => {
        contractUpdates.push(input);
        Object.assign(contract, input.data);
        return contract;
      }
    },
    contractVersion: {
      count: async () => contract.versions.length,
      create: async (input: any) => {
        versionCreates.push(input);
        contract.versions.unshift({ versionNo: input.data.versionNo });
        return input.data;
      }
    },
    auditEvent: {
      create: async (input: any) => {
        auditCreates.push(input);
        return input;
      }
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).getContract = async () => contract;
  return { repository, contract, contractUpdates, versionCreates, auditCreates };
}

function makeNegotiationDecisionRepository(options: { requestType?: 'AMENDMENT' | 'CLARIFICATION' } = {}) {
  const negotiationUpdates: any[] = [];
  const contractUpdates: any[] = [];
  const negotiation = {
    id: 'negotiation-1',
    contractId: '44444444-4444-4444-8444-444444444444',
    payload: { requestType: options.requestType ?? 'AMENDMENT' },
    contract: {
      id: '44444444-4444-4444-8444-444444444444',
      buyerOrgId: organizationId,
      supplierOrgId: '55555555-5555-4555-8555-555555555555',
      payload: {},
      status: ContractStatus.NEGOTIATION
    }
  };
  const tx = {
    contractNegotiation: {
      findUnique: async () => negotiation,
      update: async (input: any) => {
        negotiationUpdates.push(input);
        Object.assign(negotiation, input.data);
        return negotiation;
      }
    },
    contract: {
      update: async (input: any) => {
        contractUpdates.push(input);
        Object.assign(negotiation.contract, input.data);
        return negotiation.contract;
      }
    },
    auditEvent: {
      create: async (input: any) => input
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).getContract = async () => negotiation.contract;
  return { repository, negotiationUpdates, contractUpdates };
}

function makePreAwardGuardRepository() {
  const contract = {
    id: '44444444-4444-4444-8444-444444444444',
    buyerOrgId: organizationId,
    supplierOrgId: null,
    awardId: null,
    status: ContractStatus.DRAFT
  };
  const tx = {
    contract: {
      findUnique: async () => contract,
      update: async (input: any) => input
    },
    contractSignature: {
      upsert: async (input: any) => input
    },
    auditEvent: {
      create: async (input: any) => input
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).getContract = async () => contract;
  return repository;
}

function makeSignatureReadinessRepository(overrides: Record<string, unknown> = {}) {
  const signatureRequests: any[] = [];
  const contractUpdates: any[] = [];
  const contract = {
    id: '44444444-4444-4444-8444-444444444444',
    buyerOrgId: organizationId,
    supplierOrgId: '55555555-5555-4555-8555-555555555555',
    awardId: '66666666-6666-4666-8666-666666666666',
    status: ContractStatus.NEGOTIATION,
    negotiations: [],
    acceptances: [],
    approvalSteps: [],
    ...overrides
  };
  const tx = {
    contract: {
      findUnique: async () => contract,
      update: async (input: any) => {
        contractUpdates.push(input);
        return input;
      }
    },
    contractSignature: {
      upsert: async (input: any) => {
        signatureRequests.push(input);
        return input;
      }
    },
    auditEvent: {
      create: async (input: any) => input
    }
  };
  const repository = new ModuleRepository({
    $transaction: async (callback: any) => callback(tx)
  } as any);
  (repository as any).getContract = async () => contract;
  return { repository, signatureRequests, contractUpdates };
}

function postAwardContract(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    reference: 'PX-C-1',
    buyerOrgId: organizationId,
    supplierOrgId: '55555555-5555-4555-8555-555555555555',
    status: ContractStatus.ACTIVE,
    ...overrides
  };
}

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    name: 'Evidence.pdf',
    documentType: 'application/pdf',
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    ownerOrgId: organizationId,
    metadata: {},
    ...overrides
  };
}

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
        payload: { acceptedBy: 'supplier' },
        signatureKeyphrase: 'Signing123'
      })
    ).toEqual({
      action: AwardResponseAction.ACCEPT,
      note: 'Accepted for contract preparation.',
      payload: { acceptedBy: 'supplier' },
      signatureKeyphrase: 'Signing123'
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

    expect(
      supplierRiskProfileBodySchema.parse({
        riskLevel: 'LOW',
        trustTier: 'GOLD',
        riskScore: 18,
        summary: 'Supplier risk reviewed.',
        payload: {}
      })
    ).toMatchObject({
      riskLevel: 'LOW',
      trustTier: 'GOLD',
      riskScore: 18
    });

    expect(() => awardNoticeResponseBodySchema.parse({ action: 'MAYBE' })).toThrow();
    expect(() => contractMilestonePatchBodySchema.parse({})).toThrow();
    expect(() => supplierRiskProfileBodySchema.parse({ trustTier: 'PLATINUM', payload: {} })).toThrow();
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

  it('keeps sample procurement dashboard actions limited to required samples', async () => {
    const repository = new ModuleRepository({
      awardRecommendation: {
        findMany: async () => []
      },
      contract: {
        findMany: async () => []
      }
    } as any);
    (repository as any).listSamples = async () => ({
      summary: {
        'awaiting-submission': 1,
        'not-required': 1
      },
      queues: {
        'awaiting-submission': [{
          id: 'required-sample-1',
          sampleRequired: true,
          sampleRequirementStatus: 'MISSING_REQUIRED',
          awardingStatus: 'awaiting-submission',
          buyerOrgId: organizationId,
          supplierName: 'Supplier One',
          tenderId: 'tender-1',
          contractId: null,
          sampleReference: '',
          trackingNumber: '',
          sampleName: 'Laptop sample',
          tenderTitle: 'Laptop tender',
          deliveryDeadline: null
        }],
        'not-required': [{
          id: 'not-required-sample-1',
          sampleRequired: false,
          sampleRequirementStatus: 'NOT_REQUIRED',
          awardingStatus: 'not-required',
          buyerOrgId: organizationId,
          supplierName: 'Supplier Two',
          tenderId: 'tender-2',
          contractId: null,
          sampleReference: '',
          trackingNumber: '',
          sampleName: 'No sample needed',
          tenderTitle: 'Stationery tender',
          deliveryDeadline: null
        }]
      }
    });

    await expect(new ModuleService(repository).dashboard(contractContext)).resolves.toMatchObject({
      summary: { contractActions: 1 },
      queues: {
        'sample-procurement': [
          expect.objectContaining({
            id: 'sample-required-sample-1',
            title: 'Laptop sample',
            requiredAction: 'Manage sample procurement'
          })
        ]
      }
    });
  });

  it('includes signed contracts in the dashboard contract progress queue', async () => {
    const repository = new ModuleRepository({
      awardRecommendation: {
        findMany: async () => []
      },
      contract: {
        findMany: async () => [{
          ...postAwardContract({
            status: ContractStatus.SIGNED,
            tenderId: '77777777-7777-4777-8777-777777777777',
            awardId: '88888888-8888-4888-8888-888888888888',
            title: 'Signed clinic supply contract',
            amount: 1200000,
            currency: 'TZS'
          }),
          buyerOrg: { name: 'Buyer Org' },
          supplierOrg: { name: 'Supplier Org' },
          awardNotice: null,
          mobilizationItems: []
        }]
      }
    } as any);
    (repository as any).listSamples = async () => ({
      summary: {},
      queues: {}
    });

    await expect(new ModuleService(repository).dashboard(contractContext)).resolves.toMatchObject({
      summary: { contractActions: 1 },
      queues: {
        'contracts-in-progress': [
          expect.objectContaining({
            title: 'Signed clinic supply contract',
            status: ContractStatus.SIGNED,
            currentStage: 'Activation setup',
            nextRoute: '/post-award?contract=44444444-4444-4444-8444-444444444444&stage=setup'
          })
        ]
      }
    });
  });

  it('requires award confirmation before sending award notices', async () => {
    const { service } = await makeAwardNoticeRepository(RecommendationStatus.RECOMMENDED);

    await expect(
      service.settleAwardGroup('recommendation-1', { note: 'Send notices', payload: {} }, contractContext)
    ).rejects.toMatchObject({
      status: 409,
      message: 'Confirm the award before sending notices.'
    });
  });

  it('sends award notices without running contract clause or negotiation blockers', async () => {
    const { service, calls } = await makeAwardNoticeRepository(RecommendationStatus.APPROVED);

    await expect(
      service.settleAwardGroup('recommendation-1', { note: 'Send notices', payload: {}, signatureKeyphrase: 'Signing123' }, contractContext)
    ).resolves.toMatchObject({ id: 'recommendation-1', status: RecommendationStatus.APPROVED });

    expect(calls).toEqual(expect.arrayContaining(['awardNotice.upsert', 'awardWinner.update', 'awardGroup.update']));
    expect(calls).not.toContain('awardClause.count');
    expect(calls).not.toContain('awardNegotiation.count');
  });

  it('creates a buyer-owned pre-award contract draft from a published tender', async () => {
    const { repository, contractCreates, auditCreates } = makePreAwardDraftRepository();

    await expect(
      repository.prepareTenderContractDraft('77777777-7777-4777-8777-777777777777', contractContext)
    ).resolves.toMatchObject({
      tenderId: '77777777-7777-4777-8777-777777777777',
      awardId: null,
      supplierOrgId: null,
      status: ContractStatus.DRAFT
    });

    expect(contractCreates[0].data).toMatchObject({
      tenderId: '77777777-7777-4777-8777-777777777777',
      buyerOrgId: organizationId,
      status: ContractStatus.DRAFT,
      amount: null,
      currency: 'TZS'
    });
    expect(contractCreates[0].data).not.toHaveProperty('awardId');
    expect(contractCreates[0].data).not.toHaveProperty('supplierOrgId');
    expect(contractCreates[0].data.clauses.createMany.data.length).toBeGreaterThan(0);
    expect(contractCreates[0].data.requiredDocuments.createMany.data.length).toBeGreaterThan(0);
    expect(auditCreates[0].data.event).toBe('contract.pre_award_draft.created');
  });

  it('returns an existing pre-award contract draft for the same buyer and tender', async () => {
    const { repository, contractCreates } = makePreAwardDraftRepository({
      existingContract: { id: '99999999-9999-4999-8999-999999999999' }
    });

    await expect(
      repository.prepareTenderContractDraft('77777777-7777-4777-8777-777777777777', contractContext)
    ).resolves.toMatchObject({ id: '99999999-9999-4999-8999-999999999999' });

    expect(contractCreates).toHaveLength(0);
  });

  it('blocks pre-award draft creation for non-owner organizations and plain draft tenders', async () => {
    const nonOwner = makePreAwardDraftRepository({ buyerOrgId: '99999999-9999-4999-8999-999999999999' }).repository;
    await expect(
      nonOwner.prepareTenderContractDraft('77777777-7777-4777-8777-777777777777', contractContext)
    ).rejects.toMatchObject({ status: 403 });

    const draftTender = makePreAwardDraftRepository({ tenderStatus: TenderStatus.DRAFT }).repository;
    await expect(
      draftTender.prepareTenderContractDraft('77777777-7777-4777-8777-777777777777', contractContext)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('saves contract draft versions without starting supplier negotiation automatically', async () => {
    const { repository, contractUpdates, versionCreates } = makeDraftVersionRepository({ versionCount: 0 });

    await expect(
      repository.createContractVersion('44444444-4444-4444-8444-444444444444', { payload: { source: 'drafting' } }, contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444', status: ContractStatus.DRAFT });

    expect(versionCreates[0].data).toMatchObject({ contractId: '44444444-4444-4444-8444-444444444444', versionNo: 1 });
    expect(contractUpdates).toHaveLength(0);
  });

  it('sends a saved draft to negotiation only after supplier award notice acceptance', async () => {
    const blockedNotice = makeDraftVersionRepository({ awardNoticeStatus: AwardNoticeStatus.PENDING_RESPONSE });
    await expect(
      blockedNotice.repository.sendContractForNegotiation('44444444-4444-4444-8444-444444444444', contractContext)
    ).rejects.toMatchObject({
      status: 409,
      message: 'Supplier must accept the award notice before contract negotiation starts.'
    });

    const blockedVersion = makeDraftVersionRepository({ versionCount: 0 });
    await expect(
      blockedVersion.repository.sendContractForNegotiation('44444444-4444-4444-8444-444444444444', contractContext)
    ).rejects.toMatchObject({
      status: 409,
      message: 'Generate or save a contract draft version before sending to negotiation.'
    });

    const ready = makeDraftVersionRepository({ versionCount: 1, payload: { redraftRequired: true } });
    await expect(
      ready.repository.sendContractForNegotiation('44444444-4444-4444-8444-444444444444', contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444', status: ContractStatus.NEGOTIATION });

    expect(ready.contractUpdates[0].data).toMatchObject({
      status: ContractStatus.NEGOTIATION,
      payload: expect.objectContaining({ redraftRequired: false, sentVersionNo: 1 })
    });
  });

  it('accepts supplier amendment requests by returning the contract to buyer redraft', async () => {
    const { repository, negotiationUpdates, contractUpdates } = makeNegotiationDecisionRepository({ requestType: 'AMENDMENT' });

    await expect(
      repository.updateNegotiation('44444444-4444-4444-8444-444444444444', 'negotiation-1', {
        status: ContractLifecycleItemStatus.APPROVED,
        reason: 'Payment wording must be revised.',
        payload: { buyerNote: 'Accepted for redraft.' }
      }, contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444', status: ContractStatus.DRAFT });

    expect(negotiationUpdates[0].data).toMatchObject({
      status: ContractLifecycleItemStatus.APPROVED,
      payload: expect.objectContaining({
        decisionReason: 'Payment wording must be revised.',
        redraftRequired: true
      })
    });
    expect(contractUpdates[0].data).toMatchObject({
      status: ContractStatus.DRAFT,
      payload: expect.objectContaining({
        redraftRequired: true,
        redraftReason: 'Payment wording must be revised.',
        redraftNegotiationId: 'negotiation-1'
      })
    });
  });

  it('blocks signatures and signature-pending status before award and supplier are linked', async () => {
    const repository = makePreAwardGuardRepository();

    await expect(
      repository.createSignatureRequests('44444444-4444-4444-8444-444444444444', { roles: [ContractPartyRole.BUYER] }, contractContext)
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      repository.updateContractStatus('44444444-4444-4444-8444-444444444444', { status: ContractStatus.SIGNATURE_PENDING, note: 'Ready for signatures' }, contractContext)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('requires final draft acceptance and outcome communication confirmation before signature requests', async () => {
    const blocked = makeSignatureReadinessRepository();
    await expect(
      blocked.repository.createSignatureRequests('44444444-4444-4444-8444-444444444444', { roles: [ContractPartyRole.BUYER] }, contractContext)
    ).rejects.toMatchObject({ status: 409 });

    const ready = makeSignatureReadinessRepository({
      acceptances: [
        { status: ContractLifecycleItemStatus.APPROVED, payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'BUYER' } },
        { status: ContractLifecycleItemStatus.APPROVED, payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'SUPPLIER' } }
      ],
      approvalSteps: [
        { stepKey: 'outcome-communications', status: ContractLifecycleItemStatus.APPROVED }
      ]
    });

    await expect(
      ready.repository.createSignatureRequests('44444444-4444-4444-8444-444444444444', { roles: [ContractPartyRole.BUYER, ContractPartyRole.SUPPLIER] }, contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444' });
    expect(ready.signatureRequests).toHaveLength(2);
    expect(ready.contractUpdates[0]).toMatchObject({ data: { status: ContractStatus.SIGNATURE_PENDING } });
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

  it('validates post-award contract document upload payloads', () => {
    expect(contractDocumentUploadBodySchema.parse({
      name: 'delivery-note.pdf',
      documentType: 'delivery-note',
      mimeType: 'application/pdf',
      size: '42',
      contentBase64: Buffer.from('proof').toString('base64')
    })).toMatchObject({
      name: 'delivery-note.pdf',
      documentType: 'delivery-note',
      mimeType: 'application/pdf',
      size: 42
    });

    expect(() => contractDocumentUploadBodySchema.parse({ documentType: 'delivery-note' })).toThrow();
  });

  it('uploads post-award contract documents as scoped document objects', async () => {
    const contract = postAwardContract();
    const documentCreates: any[] = [];
    const auditEvents: any[] = [];
    const repository = new ModuleRepository({
      documentObject: {
        create: async (input: any) => {
          documentCreates.push(input);
          return documentRecord({
            id: 'doc-uploaded',
            name: input.data.name,
            documentType: input.data.documentType,
            createdAt: new Date('2026-07-14T10:00:00.000Z')
          });
        }
      }
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async (...args: any[]) => {
      auditEvents.push(args);
    };
    const contentBase64 = Buffer.from('proof').toString('base64');

    await expect(repository.uploadContractDocument(contract.id, {
      name: 'delivery note?.pdf',
      documentType: 'application/pdf',
      mimeType: 'application/pdf',
      contentBase64
    }, contractContext)).resolves.toMatchObject({
      id: 'doc-uploaded',
      name: 'delivery note?.pdf',
      documentType: 'application/pdf',
      contentUrl: '/api/documents/doc-uploaded/content',
      sourceLabel: 'Uploaded evidence'
    });

    expect(documentCreates[0].data).toMatchObject({
      ownerOrgId: organizationId,
      uploadedByUserId: userId,
      name: 'delivery note?.pdf',
      documentType: 'application/pdf',
      checksum: createHash('sha256').update(Buffer.from('proof')).digest('hex'),
      metadata: expect.objectContaining({
        sourceModule: 'award-contract',
        contractId: contract.id,
        contractReference: 'PX-C-1',
        mimeType: 'application/pdf',
        contentBase64
      })
    });
    expect(documentCreates[0].data.objectKey).toMatch(/^award-contract\/44444444-4444-4444-8444-444444444444\/.+\/delivery-note-.pdf$/);
    expect(auditEvents[0]).toEqual(expect.arrayContaining(['contract.document.uploaded', 'contract', contract.id]));
  });

  it('lists visible post-award contract documents with source labels', async () => {
    const contract = postAwardContract();
    const documentFindManyCalls: any[] = [];
    const repository = new ModuleRepository({
      contractVersion: { findMany: async () => [{ documentId: 'doc-version' }] },
      contractMilestoneEvidence: { findMany: async () => [{ documentId: 'doc-milestone' }] },
      paymentConfirmation: { findMany: async () => [] },
      terminationEvidence: { findMany: async () => [] },
      contractSecurity: { findMany: async () => [] },
      contractRequiredDocument: { findMany: async () => [] },
      documentObject: {
        findMany: async (input: any) => {
          documentFindManyCalls.push(input);
          if (input.where?.id) {
            return [
              documentRecord({ id: 'doc-version', name: 'Signed contract.pdf', createdAt: new Date('2026-07-10T00:00:00.000Z') }),
              documentRecord({ id: 'doc-milestone', name: 'Delivery proof.pdf', createdAt: new Date('2026-07-12T00:00:00.000Z') })
            ];
          }
          return [
            documentRecord({ id: 'doc-uploaded', name: 'Uploaded receipt.pdf', createdAt: new Date('2026-07-11T00:00:00.000Z') })
          ];
        }
      }
    } as any);
    (repository as any).requireContract = async () => contract;

    await expect(repository.contractDocuments(contract.id, contractContext)).resolves.toEqual([
      expect.objectContaining({ id: 'doc-milestone', name: 'Delivery proof.pdf', sourceLabel: 'Milestone evidence' }),
      expect.objectContaining({ id: 'doc-uploaded', name: 'Uploaded receipt.pdf', sourceLabel: 'Uploaded evidence' }),
      expect.objectContaining({ id: 'doc-version', name: 'Signed contract.pdf', sourceLabel: 'Contract version' })
    ]);
    expect(documentFindManyCalls[0].where.AND).toEqual(expect.arrayContaining([
      { metadata: { path: ['sourceModule'], equals: 'award-contract' } },
      { metadata: { path: ['contractId'], equals: contract.id } },
      { OR: [{ ownerOrgId: null }, { ownerOrgId: organizationId }] }
    ]));
    expect(documentFindManyCalls[1].where).toEqual({ id: { in: ['doc-version', 'doc-milestone', 'doc-uploaded'] } });
  });

  it('attaches visible uploaded documents to milestone evidence and rejects cross-organization documents', async () => {
    const contract = postAwardContract();
    const evidenceUpserts: any[] = [];
    const tx = {
      contractMilestone: {
        findUnique: async () => ({
          id: 'milestone-1',
          contractId: contract.id,
          contract
        })
      },
      documentObject: {
        findUnique: async ({ where }: any) => ({ ownerOrgId: where.id === 'doc-other-org' ? '99999999-9999-4999-8999-999999999999' : organizationId })
      },
      contractMilestoneEvidence: {
        upsert: async (input: any) => {
          evidenceUpserts.push(input);
          return input.create;
        }
      }
    };
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback(tx)
    } as any);
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => ({ id: contract.id });

    await expect(repository.addMilestoneEvidence(contract.id, 'milestone-1', { documentId: 'doc-visible', note: 'Delivered.' }, contractContext)).resolves.toMatchObject({ id: contract.id });
    expect(evidenceUpserts[0].create).toMatchObject({
      milestoneId: 'milestone-1',
      documentId: 'doc-visible',
      uploadedByUserId: userId,
      uploaderOrgId: organizationId,
      note: 'Delivered.'
    });

    await expect(repository.addMilestoneEvidence(contract.id, 'milestone-1', { documentId: 'doc-other-org', note: '' }, contractContext)).rejects.toMatchObject({
      status: 403,
      message: 'Document is not visible to this organization.'
    });
  });

  it('generates goods inspection and acceptance numbers when omitted', async () => {
    const { repository, goodsInspectionUpserts, acceptanceCreates } = makeLifecycleNumberRepository();

    await expect(
      repository.createGoodsInspection('44444444-4444-4444-8444-444444444444', { goodsDescription: 'Laptop delivery', payload: {} }, contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444' });

    expect(goodsInspectionUpserts[0].where.contractId_inspectionNo.inspectionNo).toMatch(/^PX-GI-\d{4}-[A-F0-9]{8}$/);
    expect(goodsInspectionUpserts[0].create.inspectionNo).toBe(goodsInspectionUpserts[0].where.contractId_inspectionNo.inspectionNo);

    await expect(
      repository.createAcceptance('44444444-4444-4444-8444-444444444444', { goodsReceiptId: 'receipt-1', acceptedValue: 1000, currency: 'TZS', payload: {} }, contractContext)
    ).resolves.toMatchObject({ id: '44444444-4444-4444-8444-444444444444' });

    expect(acceptanceCreates[0].data.certificateNo).toMatch(/^PX-ACPT-\d{4}-[A-F0-9]{8}$/);
    expect(acceptanceCreates[0].data.goodsReceiptId).toBe('receipt-1');
  });

  it('creates buyer and supplier final draft acceptances without execution evidence', async () => {
    const { repository, contract, acceptanceCreates } = makeFinalDraftAcceptanceRepository();
    const supplierContext = { ...contractContext, organizationId: contract.supplierOrgId };

    await expect(repository.createAcceptance(contract.id, {
      status: ContractLifecycleItemStatus.APPROVED,
      currency: 'TZS',
      note: 'Buyer accepts the negotiated final draft.',
      payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'BUYER' }
    }, contractContext)).resolves.toMatchObject({ id: contract.id });

    await expect(repository.createAcceptance(contract.id, {
      status: ContractLifecycleItemStatus.APPROVED,
      currency: 'TZS',
      note: 'Supplier accepts the negotiated final draft.',
      payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'SUPPLIER' }
    }, supplierContext)).resolves.toMatchObject({ id: contract.id });

    expect(acceptanceCreates).toHaveLength(2);
    expect(acceptanceCreates[0].data).toMatchObject({
      contractId: contract.id,
      deliverableId: undefined,
      inspectionId: undefined,
      goodsReceiptId: undefined,
      goodsInspectionId: undefined,
      note: 'Buyer accepts the negotiated final draft.',
      payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'BUYER' }
    });
    expect(acceptanceCreates[1].data).toMatchObject({
      contractId: contract.id,
      note: 'Supplier accepts the negotiated final draft.',
      payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'SUPPLIER' }
    });
  });

  it('still rejects ordinary acceptances without execution evidence', async () => {
    const { repository } = makeFinalDraftAcceptanceRepository();

    await expect(repository.createAcceptance('44444444-4444-4444-8444-444444444444', {
      status: ContractLifecycleItemStatus.APPROVED,
      currency: 'TZS',
      note: 'Generic acceptance without linked execution evidence.',
      payload: {}
    }, contractContext)).rejects.toMatchObject({
      status: 409,
      message: 'Acceptance requires linked deliverable, inspection, goods receipt, or goods inspection evidence.'
    });
  });

  it('blocks supplier service reports without an open service period', async () => {
    const contract = postAwardContract();
    const reportCreates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        contractServicePeriod: {
          findFirst: async () => null
        },
        contractServiceReport: {
          create: async (input: any) => {
            reportCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.createServiceReport(contract.id, {
      reportReference: 'SR-001',
      summary: 'Monthly services completed.',
      status: 'SUBMITTED',
      payload: {}
    }, { ...contractContext, organizationId: contract.supplierOrgId })).rejects.toMatchObject({
      status: 409,
      message: 'Service report requires an open service period.'
    });
    expect(reportCreates).toHaveLength(0);
  });

  it('rejects submitted invoices without an accepted execution reference', async () => {
    const contract = postAwardContract();
    const invoiceCreates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        invoice: {
          create: async (input: any) => {
            invoiceCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.createInvoice(contract.id, {
      amount: 1000,
      currency: 'TZS',
      status: 'SUBMITTED' as any,
      payload: {}
    }, { ...contractContext, organizationId: contract.supplierOrgId })).rejects.toMatchObject({
      status: 409,
      message: 'Invoice requires an accepted execution reference before submission.'
    });
    expect(invoiceCreates).toHaveLength(0);
  });

  it('allows supplier invoices linked to accepted goods receipts', async () => {
    const contract = postAwardContract();
    const invoiceCreates: any[] = [];
    const auditEvents: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        contractGoodsReceipt: {
          findFirst: async () => ({
            id: 'receipt-1',
            contractId: contract.id,
            status: ContractLifecycleItemStatus.APPROVED,
            lines: []
          })
        },
        invoice: {
          create: async (input: any) => {
            invoiceCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async (...args: any[]) => {
      auditEvents.push(args);
    };
    (repository as any).getContract = async () => contract;

    await expect(repository.createInvoice(contract.id, {
      reference: 'INV-GRN-1',
      amount: 1000,
      currency: 'TZS',
      status: 'SUBMITTED' as any,
      executionReferenceType: 'goods_receipt',
      executionReferenceId: 'receipt-1',
      payload: {}
    }, { ...contractContext, organizationId: contract.supplierOrgId })).resolves.toMatchObject({ id: contract.id });

    expect(invoiceCreates[0].data).toMatchObject({
      reference: 'INV-GRN-1',
      contractId: contract.id,
      supplierOrgId: contract.supplierOrgId,
      amount: 1000,
      payload: {
        executionReferenceType: 'goods_receipt',
        executionReferenceId: 'receipt-1'
      }
    });
    expect(auditEvents[0]).toEqual(expect.arrayContaining(['contract.invoice.created', 'contract', contract.id]));
  });

  it('blocks supplier dispatch notices without a delivery schedule', async () => {
    const contract = postAwardContract();
    const dispatchCreates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        contractDispatchNotice: {
          create: async (input: any) => {
            dispatchCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.createDispatchNotice(contract.id, {
      dispatchReference: 'DN-NO-SCHEDULE',
      dispatchedQuantity: 10,
      payload: {}
    }, { ...contractContext, organizationId: contract.supplierOrgId })).rejects.toMatchObject({
      status: 409,
      message: 'Dispatch notice requires an approved delivery schedule.'
    });
    expect(dispatchCreates).toHaveLength(0);
  });

  it('blocks BOQ measurement until works progress is approved', async () => {
    const contract = postAwardContract({ title: 'Road works contract', payload: { procurementType: 'WORKS' } });
    const measurementCreates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        contractWorksProgressReport: {
          findFirst: async () => null
        },
        contractBoqMeasurement: {
          create: async (input: any) => {
            measurementCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.createBoqMeasurement(contract.id, {
      boqItemReference: 'BOQ-1',
      currentQuantity: 20,
      unitRate: 1000,
      payload: {}
    }, contractContext)).rejects.toMatchObject({
      status: 409,
      message: 'BOQ measurement requires an approved works progress report.'
    });
    expect(measurementCreates).toHaveLength(0);
  });

  it('blocks supplier invoices above remaining accepted goods value', async () => {
    const contract = postAwardContract();
    const invoiceCreates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        contractGoodsReceipt: {
          findFirst: async () => ({
            id: 'receipt-1',
            contractId: contract.id,
            status: ContractLifecycleItemStatus.APPROVED,
            payload: { acceptedValue: 1000 },
            lines: []
          })
        },
        invoice: {
          aggregate: async () => ({ _sum: { amount: 800 } }),
          create: async (input: any) => {
            invoiceCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.createInvoice(contract.id, {
      reference: 'INV-OVER',
      amount: 250,
      currency: 'TZS',
      status: InvoiceStatus.SUBMITTED,
      executionReferenceType: 'goods_receipt',
      executionReferenceId: 'receipt-1',
      payload: {}
    }, { ...contractContext, organizationId: contract.supplierOrgId })).rejects.toMatchObject({
      status: 409,
      message: 'Invoice amount exceeds the remaining accepted value for this execution item.'
    });
    expect(invoiceCreates).toHaveLength(0);
  });

  it('records three-way match mismatches and keeps invoices in review', async () => {
    const contract = postAwardContract();
    const matchUpserts: any[] = [];
    const invoiceUpdates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        invoice: {
          findUnique: async () => ({
            id: 'invoice-1',
            contractId: contract.id,
            executionReferenceType: 'goods_receipt',
            executionReferenceId: 'receipt-1',
            status: InvoiceStatus.SUBMITTED,
            amount: 1000
          }),
          update: async (input: any) => {
            invoiceUpdates.push(input);
            return input.data;
          }
        },
        contractGoodsReceipt: {
          findFirst: async () => ({
            id: 'receipt-1',
            contractId: contract.id,
            status: ContractLifecycleItemStatus.APPROVED,
            lines: [{ acceptedQuantity: 10 }]
          })
        },
        threeWayMatchResult: {
          upsert: async (input: any) => {
            matchUpserts.push(input);
            return input.create;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.upsertThreeWayMatch(contract.id, {
      invoiceId: 'invoice-1',
      poMatched: true,
      receiptMatched: false,
      invoiceMatched: true,
      currency: 'TZS',
      payload: {}
    }, contractContext)).resolves.toMatchObject({ id: contract.id });

    expect(matchUpserts[0].create).toMatchObject({
      invoiceId: 'invoice-1',
      goodsReceiptId: 'receipt-1',
      status: InvoiceStatus.REVIEW,
      mismatchType: 'QUANTITY_OR_RECEIPT_MISMATCH'
    });
    expect(invoiceUpdates[0]).toMatchObject({ where: { id: 'invoice-1' }, data: { status: InvoiceStatus.REVIEW } });
  });

  it('blocks payment approval until the invoice is matched', async () => {
    const contract = postAwardContract();
    const paymentApprovalCreates: any[] = [];
    const repository = new ModuleRepository({
      $transaction: async (callback: any) => callback({
        invoice: {
          findUnique: async () => ({
            id: 'invoice-1',
            contractId: contract.id,
            status: InvoiceStatus.SUBMITTED,
            amount: 1000
          })
        },
        paymentApproval: {
          create: async (input: any) => {
            paymentApprovalCreates.push(input);
            return input.data;
          }
        }
      })
    } as any);
    (repository as any).requireContract = async () => contract;
    (repository as any).audit = async () => undefined;
    (repository as any).getContract = async () => contract;

    await expect(repository.createPaymentApproval(contract.id, {
      invoiceId: 'invoice-1',
      stepKey: 'payment-approval',
      role: 'BUYER',
      amountApproved: 1000,
      currency: 'TZS',
      payload: {},
      signatureKeyphrase: 'Approve123'
    }, contractContext)).rejects.toMatchObject({
      status: 409,
      message: 'Invoice must be matched before payment approval.'
    });
    expect(paymentApprovalCreates).toHaveLength(0);
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

    expect(negotiationBodySchema.parse({ raisedByRole: 'Buyer', requestType: 'AMENDMENT', subject: 'Payment terms' })).toMatchObject({
      raisedByRole: 'Buyer',
      requestType: 'AMENDMENT',
      subject: 'Payment terms',
      payload: {}
    });

    expect(contractNegotiationDecisionBodySchema.parse({ status: ContractLifecycleItemStatus.APPROVED, reason: 'Accepted for redraft.', payload: { redraft: true } })).toMatchObject({
      status: ContractLifecycleItemStatus.APPROVED,
      reason: 'Accepted for redraft.',
      payload: { redraft: true }
    });

    expect(deliverableBodySchema.parse({ title: 'Delivery report', status: ContractLifecycleItemStatus.SUBMITTED })).toMatchObject({
      title: 'Delivery report',
      status: ContractLifecycleItemStatus.SUBMITTED,
      payload: {}
    });

    expect(goodsInspectionBodySchema.parse({ goodsDescription: 'Laptop delivery' })).toMatchObject({
      goodsDescription: 'Laptop delivery',
      payload: {}
    });

    expect(worksProgressReviewBodySchema.parse({ status: 'APPROVED', progressPercent: 45 })).toMatchObject({
      status: 'APPROVED',
      progressPercent: 45,
      payload: {}
    });

    expect(boqMeasurementBodySchema.parse({ boqItemReference: 'BOQ-1', currentQuantity: 10, unitRate: 5000, certifiedQuantity: 9 })).toMatchObject({
      boqItemReference: 'BOQ-1',
      currentQuantity: 10,
      unitRate: 5000,
      certifiedQuantity: 9,
      visibilityScope: 'SHARED',
      payload: {}
    });

    expect(boqMeasurementReviewBodySchema.parse({ status: 'CERTIFIED', certifiedAmount: 45000 })).toMatchObject({
      status: 'CERTIFIED',
      certifiedAmount: 45000,
      payload: {}
    });

    expect(interimPaymentCertificateBodySchema.parse({ certificateNumber: 'IPC-1', grossAmount: 100000, retentionAmount: 5000 })).toMatchObject({
      certificateNumber: 'IPC-1',
      grossAmount: 100000,
      retentionAmount: 5000,
      certificateType: 'INTERIM',
      payload: {}
    });

    expect(interimPaymentCertificateCertifyBodySchema.parse({ status: 'CERTIFIED', netAmount: 95000 })).toMatchObject({
      status: 'CERTIFIED',
      netAmount: 95000,
      payload: {}
    });

    expect(worksCompletionCertificateBodySchema.parse({ certificateType: 'FINAL_ACCOUNT', finalAccountAmount: 100000 })).toMatchObject({
      certificateType: 'FINAL_ACCOUNT',
      finalAccountAmount: 100000,
      status: 'ISSUED',
      payload: {}
    });

    expect(contractDefectActionBodySchema.parse({ status: ContractLifecycleItemStatus.SUBMITTED, response: 'Corrected' })).toMatchObject({
      status: ContractLifecycleItemStatus.SUBMITTED,
      response: 'Corrected',
      payload: {}
    });

    expect(serviceReportReviewBodySchema.parse({ status: 'APPROVED', verifiedSlaResult: 'MET', acceptedAmount: 180000 })).toMatchObject({
      status: 'APPROVED',
      verifiedSlaResult: 'MET',
      acceptedAmount: 180000,
      payload: {}
    });

    expect(serviceIncidentBodySchema.parse({ title: 'Missed response target', severity: 'MAJOR', responseDueDate: '2026-07-20' })).toMatchObject({
      title: 'Missed response target',
      severity: 'MAJOR',
      status: ContractLifecycleItemStatus.OPEN,
      payload: {}
    });

    expect(serviceIncidentActionBodySchema.parse({ status: ContractLifecycleItemStatus.SUBMITTED, response: 'Corrective crew assigned' })).toMatchObject({
      status: ContractLifecycleItemStatus.SUBMITTED,
      response: 'Corrective crew assigned',
      payload: {}
    });

    expect(serviceCreditReviewBodySchema.parse({ status: 'APPROVED', decision: 'APPLIED', invoiceImpactAmount: 15000 })).toMatchObject({
      status: 'APPROVED',
      decision: 'APPLIED',
      invoiceImpactAmount: 15000,
      payload: {}
    });

    expect(acceptanceBodySchema.parse({ certificateNo: 'ACC-1', acceptedValue: 1000 })).toMatchObject({
      certificateNo: 'ACC-1',
      acceptedValue: 1000,
      currency: 'TZS',
      payload: {}
    });

    expect(acceptanceBodySchema.parse({ acceptedValue: 1000 })).toMatchObject({
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

    expect(workflowApprovalBodySchema.parse({ stepKey: 'contract-owner-approval', role: 'Contract Owner', status: ContractLifecycleItemStatus.APPROVED })).toMatchObject({
      stepKey: 'contract-owner-approval',
      role: 'Contract Owner',
      status: ContractLifecycleItemStatus.APPROVED,
      payload: {}
    });
  });
});
