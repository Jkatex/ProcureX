import { describe, expect, it } from 'vitest';
import { moduleStatusQuerySchema as identitySchema } from '../modules/identity/validators.js';
import { moduleStatusQuerySchema as organizationSchema } from '../modules/organization/validators.js';
import { moduleStatusQuerySchema as procurementSchema } from '../modules/procurement/validators.js';
import { moduleStatusQuerySchema as biddingSchema } from '../modules/bidding/validators.js';
import { moduleStatusQuerySchema as complianceAdminSchema } from '../modules/compliance-admin/validators.js';
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
        complete: true
      })
    ).toEqual({
      scores: [{ bidId, criterionId, score: 87.5, comment: 'Responsive technical bid.' }],
      decisions: [{ bidId, status: 'PASSED', comment: 'Eligible.' }],
      complete: true
    });
    expect(() => saveWorkspaceBodySchema.parse({ scores: [{ bidId, criterionId, score: -1 }] })).toThrow();
    expect(() => saveWorkspaceBodySchema.parse({ decisions: [{ bidId, status: 'AWARDED' }] })).toThrow();
    expect(() => saveWorkspaceBodySchema.parse({ extra: true })).toThrow();
  });
});

