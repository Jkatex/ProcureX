import { describe, expect, it } from 'vitest';
import { moduleStatusQuerySchema as identitySchema } from '../modules/identity/validators.js';
import { moduleStatusQuerySchema as organizationSchema } from '../modules/organization/validators.js';
import { moduleStatusQuerySchema as procurementSchema } from '../modules/procurement/validators.js';
import { moduleStatusQuerySchema as biddingSchema } from '../modules/bidding/validators.js';
import {
  adminActionSchema,
  dataStoreCreateSchema,
  dataStoreDeleteSchema,
  dataStoreEntryQuerySchema,
  dataStoreUpdateSchema,
  moduleStatusQuerySchema as complianceAdminSchema,
  ruleCreateSchema,
  ruleUpdateSchema
} from '../modules/compliance-admin/validators.js';
import { saveWorkspaceBodySchema, workspaceParamsSchema } from '../modules/evaluation/validators.js';

describe('module validators', () => {
  it('accepts status query passthrough for priority modules', () => {
    for (const schema of [identitySchema, organizationSchema, procurementSchema, biddingSchema, complianceAdminSchema]) {
      expect(schema.parse({ trace: 'yes' })).toEqual({ trace: 'yes' });
    }
  });

  it('validates evaluation workspace route params and save payloads', () => {
    const tenderId = '11111111-1111-4111-8111-111111111111';
    const bidId = '22222222-2222-4222-8222-222222222222';
    const criterionId = '33333333-3333-4333-8333-333333333333';

    expect(workspaceParamsSchema.parse({ tenderId })).toEqual({ tenderId });
    expect(() => workspaceParamsSchema.parse({ tenderId: 'not-a-uuid' })).toThrow();

    expect(
      saveWorkspaceBodySchema.parse({
        scores: [{ bidId, criterionId, score: '87.5', comment: 'Responsive technical bid.' }],
        decisions: [{ bidId, status: 'PASSED', comment: 'Eligible.' }],
        activeStageId: 'tor',
        sectionDraft: { tor: { [bidId]: { methodology: { decision: 'Pass', remark: 'Responsive.' } } } },
        complete: true,
        signatureKeyphrase: 'committee-signature'
      })
    ).toEqual({
      scores: [{ bidId, criterionId, score: 87.5, comment: 'Responsive technical bid.' }],
      decisions: [{ bidId, status: 'PASSED', comment: 'Eligible.' }],
      activeStageId: 'tor',
      sectionDraft: { tor: { [bidId]: { methodology: { decision: 'Pass', remark: 'Responsive.' } } } },
      complete: true,
      signatureKeyphrase: 'committee-signature'
    });
    expect(() => saveWorkspaceBodySchema.parse({ complete: true })).toThrow();
    expect(() => saveWorkspaceBodySchema.parse({ scores: [{ bidId, criterionId, score: -1 }] })).toThrow();
    expect(() => saveWorkspaceBodySchema.parse({ decisions: [{ bidId, status: 'AWARDED' }] })).toThrow();
    expect(() => saveWorkspaceBodySchema.parse({ extra: true })).toThrow();
  });

  it('validates compliance admin rule and action payloads', () => {
    expect(
      ruleCreateSchema.parse({
        code: 'KYC.DUPLICATE_REGISTRY',
        title: 'Duplicate registry number',
        severity: 'WARNING',
        condition: { field: 'registryNumber', operator: 'duplicate' }
      })
    ).toEqual({
      code: 'KYC.DUPLICATE_REGISTRY',
      title: 'Duplicate registry number',
      severity: 'WARNING',
      status: 'ACTIVE',
      condition: { field: 'registryNumber', operator: 'duplicate' },
      payload: {}
    });

    expect(ruleUpdateSchema.parse({ status: 'DISABLED' })).toEqual({ status: 'DISABLED' });
    expect(() => ruleCreateSchema.parse({ code: 'bad code', title: 'Bad' })).toThrow();
    expect(() => ruleUpdateSchema.parse({})).toThrow();
    expect(
      adminActionSchema.parse({
        actionType: 'FLAG',
        entityType: 'verification_profile',
        entityRef: 'abc',
        summary: 'Needs second review.'
      })
    ).toEqual({
      actionType: 'FLAG',
      entityType: 'verification_profile',
      entityRef: 'abc',
      summary: 'Needs second review.'
    });
  });

  it('validates compliance admin datastore payloads', () => {
    const ownerUserId = '11111111-1111-4111-8111-111111111111';
    expect(dataStoreEntryQuerySchema.parse({ q: 'admin.settings#theme', page: '2', pageSize: '10' })).toEqual({
      q: 'admin.settings#theme',
      page: 2,
      pageSize: 10
    });
    expect(dataStoreCreateSchema.parse({ scope: 'GLOBAL', namespace: 'admin.settings', key: 'theme', value: { mode: 'admin' } })).toEqual({
      scope: 'GLOBAL',
      namespace: 'admin.settings',
      key: 'theme',
      value: { mode: 'admin' },
      encrypted: false
    });
    expect(dataStoreCreateSchema.parse({ scope: 'USER', ownerUserId, namespace: 'user.preferences', key: 'layout', value: ['compact'] })).toEqual({
      scope: 'USER',
      ownerUserId,
      namespace: 'user.preferences',
      key: 'layout',
      value: ['compact'],
      encrypted: false
    });
    expect(dataStoreUpdateSchema.parse({ value: false })).toEqual({ value: false });
    expect(dataStoreDeleteSchema.parse({ confirm: 'DELETE' })).toEqual({ confirm: 'DELETE' });
    expect(() => dataStoreCreateSchema.parse({ scope: 'USER', namespace: 'bad space', key: 'theme', value: {} })).toThrow();
    expect(() => dataStoreCreateSchema.parse({ scope: 'GLOBAL', ownerUserId, namespace: 'admin.settings', key: 'theme', value: {} })).toThrow();
    expect(() => dataStoreUpdateSchema.parse({})).toThrow();
    expect(() => dataStoreDeleteSchema.parse({ confirm: 'delete' })).toThrow();
  });
});

