import { AccountType, AdminActionType, AuditSeverity, ComplianceCaseStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleService } from './service.js';
import { supplierRiskProfileBodySchema } from './validators.js';

vi.mock('../../db/context.js', () => ({
  withDbContext: vi.fn((_context, work) => work({}))
}));

const adminSession = {
  id: 'session-1',
  tokenHash: 'hash',
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() + 60000),
  createdAt: new Date(),
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: null,
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    accountType: AccountType.ADMIN,
    displayName: 'Platform Admin',
    email: 'admin@example.test'
  },
  organization: null
};

const nonAdminSession = {
  ...adminSession,
  user: { ...adminSession.user, accountType: AccountType.USER }
};

const dataStoreEntry = {
  id: '33333333-3333-4333-8333-333333333333',
  scope: 'GLOBAL',
  ownerUserId: null,
  ownerUser: null,
  namespace: 'admin.settings',
  key: 'theme',
  value: { mode: 'admin' },
  encrypted: false,
  createdByUserId: adminSession.user.id,
  updatedByUserId: adminSession.user.id,
  createdByUser: { id: adminSession.user.id, displayName: 'Platform Admin', email: 'admin@example.test' },
  updatedByUser: { id: adminSession.user.id, displayName: 'Platform Admin', email: 'admin@example.test' },
  createdAt: new Date('2026-06-19T00:00:00.000Z'),
  updatedAt: new Date('2026-06-19T00:00:00.000Z')
};

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    health: vi.fn().mockResolvedValue({ ready: true }),
    findActiveSession: vi.fn().mockResolvedValue(adminSession),
    dashboard: vi.fn().mockResolvedValue({
      counts: { users: 1, admins: 1, organizations: 1, tenders: 0, bids: 0, contracts: 0, openCases: 1, criticalCases: 0, riskSignals: 0, auditEvents: 0, rules: 0 },
      riskGroups: [{ riskLevel: 'LOW', _count: { _all: 2 } }],
      openComplianceItems: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Missing evidence',
          severity: AuditSeverity.WARNING,
          status: ComplianceCaseStatus.OPEN,
          owner: 'Compliance team',
          ownerOrgId: null,
          ownerOrg: null,
          payload: {},
          createdAt: new Date()
        }
      ],
      recentActions: []
    }),
    search: vi.fn().mockResolvedValue({ users: [], organizations: [], tenders: [], bids: [], contracts: [], auditEvents: [], records: [] }),
    auditEvents: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    rules: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    cases: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    dataStoreNamespaces: vi.fn().mockResolvedValue([{ namespace: 'admin.settings', scope: 'GLOBAL', _count: { _all: 1 }, _max: { updatedAt: dataStoreEntry.updatedAt } }]),
    dataStoreEntries: vi.fn().mockResolvedValue({ items: [dataStoreEntry], total: 1 }),
    dataStoreEntry: vi.fn().mockResolvedValue(dataStoreEntry),
    dataStoreEntryVersions: vi.fn().mockResolvedValue([]),
    createDataStoreEntry: vi.fn().mockResolvedValue(dataStoreEntry),
    updateDataStoreEntry: vi.fn().mockResolvedValue(dataStoreEntry),
    softDeleteDataStoreEntry: vi.fn().mockResolvedValue({ ...dataStoreEntry, deletedAt: new Date('2026-06-19T01:00:00.000Z'), deletedByUser: { id: adminSession.user.id, displayName: 'Platform Admin', email: 'admin@example.test' } }),
    restoreDataStoreEntry: vi.fn().mockResolvedValue(dataStoreEntry),
    restoreDataStoreVersion: vi.fn().mockResolvedValue(dataStoreEntry),
    createAdminAction: vi.fn().mockResolvedValue({}),
    createAuditEvent: vi.fn().mockResolvedValue({}),
    ...overrides
  };
}

describe('compliance admin service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated admin requests before repository access', async () => {
    const repository = createRepository();
    const service = new ModuleService(repository as never);

    await expect(service.dashboard(undefined)).rejects.toMatchObject({ status: 401 });
    expect(repository.findActiveSession).not.toHaveBeenCalled();
  });

  it('rejects active non-admin sessions', async () => {
    const repository = createRepository({ findActiveSession: vi.fn().mockResolvedValue(nonAdminSession) });
    const service = new ModuleService(repository as never);

    await expect(service.dashboard('token')).rejects.toMatchObject({ status: 403 });
  });

  it('returns the admin app registry for admin sessions', async () => {
    const repository = createRepository();
    const service = new ModuleService(repository as never);

    const result = await service.apps('token');

    expect(result.items.map((item) => item.route)).toEqual([
      '/admin',
      '/admin/users',
      '/admin/analytics',
      '/admin/audit',
      '/admin/tender-review',
      '/admin/communication',
      '/admin/profile'
    ]);
    expect(result.items.every((item) => item.backend.status === 'live')).toBe(true);
    expect(result.generatedAt).toEqual(expect.any(String));
  });

  it('returns database-backed dashboard DTOs for admin sessions', async () => {
    const repository = createRepository();
    const service = new ModuleService(repository as never);

    const result = await service.dashboard('token');

    expect(result.counts.users).toBe(1);
    expect(result.riskSummary.LOW).toBe(2);
    expect(result.openComplianceItems[0]).toEqual(
      expect.objectContaining({
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Missing evidence',
        status: 'OPEN'
      })
    );
    expect(result.generatedAt).toEqual(expect.any(String));
  });

  it('validates supplier risk profile trust tier choices', () => {
    expect(
      supplierRiskProfileBodySchema.parse({
        supplierOrgId: '44444444-4444-4444-8444-444444444444',
        riskLevel: 'LOW',
        trustTier: 'GOLD',
        riskScore: 12,
        summary: 'Reviewed by compliance.',
        payload: {}
      })
    ).toMatchObject({
      supplierOrgId: '44444444-4444-4444-8444-444444444444',
      riskLevel: 'LOW',
      trustTier: 'GOLD'
    });

    expect(() =>
      supplierRiskProfileBodySchema.parse({
        supplierOrgId: '44444444-4444-4444-8444-444444444444',
        trustTier: 'PLATINUM',
        payload: {}
      })
    ).toThrow();
  });

  it('returns paged empty admin search and audit contracts', async () => {
    const repository = createRepository();
    const service = new ModuleService(repository as never);

    await expect(service.search('token', { q: 'none', page: 1, pageSize: 10 })).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0
    });
    await expect(service.auditEvents('token', { page: 1, pageSize: 10 })).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0
    });
  });

  it('returns datastore namespaces and entries for admin sessions', async () => {
    const repository = createRepository();
    const service = new ModuleService(repository as never);

    await expect(service.dataStoreNamespaces('token', {})).resolves.toMatchObject({
      items: [{ namespace: 'admin.settings', scope: 'GLOBAL', total: 1 }]
    });
    await expect(service.dataStoreEntries('token', { page: 1, pageSize: 10 })).resolves.toMatchObject({
      total: 1,
      items: [{ id: dataStoreEntry.id, namespace: 'admin.settings', key: 'theme', value: { mode: 'admin' } }]
    });
  });

  it('audits datastore create update delete and export actions', async () => {
    const repository = createRepository();
    const service = new ModuleService(repository as never);

    await service.createDataStoreEntry('token', { scope: 'GLOBAL', namespace: 'admin.settings', key: 'theme', value: { mode: 'admin' } });
    await service.updateDataStoreEntry('token', dataStoreEntry.id, { value: { mode: 'updated' } });
    await service.deleteDataStoreEntry('token', dataStoreEntry.id, { confirm: 'DELETE' });
    await service.exportDataStoreEntries('token', { page: 1, pageSize: 10 });

    expect(repository.createAdminAction).toHaveBeenCalledWith(adminSession.user.id, expect.objectContaining({ entityType: 'data_store', actionType: AdminActionType.REVIEW }), expect.anything());
    expect(repository.createAdminAction).toHaveBeenCalledWith(adminSession.user.id, expect.objectContaining({ entityType: 'data_store', actionType: AdminActionType.HOLD }), expect.anything());
    expect(repository.createAdminAction).toHaveBeenCalledWith(adminSession.user.id, expect.objectContaining({ entityType: 'data_store', actionType: AdminActionType.EXPORT }), expect.anything());
    expect(repository.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.datastore.exported' }), expect.anything());
  });
});
