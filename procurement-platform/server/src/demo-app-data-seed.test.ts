import { describe, expect, it } from 'vitest';
import { AccountType, VerificationStatus } from '@prisma/client';
import {
  assertBaseDemoUser,
  assertDemoAppSeedRuntime,
  DEMO_APP_DATASET,
  DEMO_APP_REFERENCE_PREFIX,
  DEMO_APP_USER_EMAIL,
  demoAppPayload
} from '../prisma/seed-demo-app-data.js';

describe('temporary demo app data seed safety', () => {
  it('refuses production-like environments', () => {
    for (const environment of ['production', 'prod', 'staging', 'uat', 'preview']) {
      expect(() => assertDemoAppSeedRuntime(environment)).toThrow(/Refusing to run temporary demo app seed/);
    }
  });

  it('allows local test and development environments', () => {
    for (const environment of ['development', 'test', 'local']) {
      expect(() => assertDemoAppSeedRuntime(environment)).not.toThrow();
    }
  });

  it('marks records with cleanup-safe dataset metadata', () => {
    expect(demoAppPayload({ module: 'workspace' })).toMatchObject({
      dataset: DEMO_APP_DATASET,
      demoDataset: DEMO_APP_DATASET,
      temporary: true,
      referencePrefix: DEMO_APP_REFERENCE_PREFIX,
      module: 'workspace'
    });
  });

  it('keeps the base demo user verified and non-admin', () => {
    expect(() =>
      assertBaseDemoUser({
        email: DEMO_APP_USER_EMAIL,
        accountType: AccountType.USER,
        verificationStatus: VerificationStatus.APPROVED
      })
    ).not.toThrow();

    expect(() =>
      assertBaseDemoUser({
        email: DEMO_APP_USER_EMAIL,
        accountType: AccountType.ADMIN,
        verificationStatus: VerificationStatus.APPROVED
      })
    ).toThrow(/normal USER account/);
  });
});
