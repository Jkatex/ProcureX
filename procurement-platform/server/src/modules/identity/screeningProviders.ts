import type { ScreeningStatus } from '@procurex/shared';

export type ScreeningProviderInput = {
  userId: string;
  registrySource: string;
  registryNumber: string;
  entityType: string;
  name: string;
  registryStatus: string;
  registryConfidence: number;
  duplicateApprovedRegistryCount: number;
  payload: Record<string, unknown>;
};

export type ScreeningProviderResult = {
  provider: string;
  status: ScreeningStatus;
  reasons: string[];
  providerMetadata: Record<string, unknown>;
};

export interface ScreeningProvider {
  screen(input: ScreeningProviderInput): Promise<ScreeningProviderResult>;
}

function envList(name: string, fallback: string[]) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function payloadFlag(payload: Record<string, unknown>, key: string) {
  return payload[key] === true || String(payload[key]).toLowerCase() === 'true';
}

export class DeterministicScreeningProvider implements ScreeningProvider {
  async screen(input: ScreeningProviderInput): Promise<ScreeningProviderResult> {
    const reasons: string[] = [];
    const blockedTerms = envList('PROCUREX_SANCTIONS_WATCHLIST', ['sanctioned', 'blocked', 'debarred', 'terror', 'fraud watch']);
    const reviewTerms = envList('PROCUREX_KYC_REVIEW_WATCHLIST', ['pep', 'politically exposed', 'adverse media', 'watchlist']);
    const searchable = `${input.name} ${input.registrySource} ${input.registryNumber} ${JSON.stringify(input.payload)}`.toLowerCase();

    if (blockedTerms.some((term) => searchable.includes(term))) {
      reasons.push('Potential sanctions or debarment match found in local watchlist.');
    }
    if (['BLOCKED', 'SANCTIONED', 'DEBARRED'].includes(input.registryStatus.toUpperCase())) {
      reasons.push(`Registry status is ${input.registryStatus}.`);
    }

    const blocked = reasons.length > 0;
    if (!blocked) {
      if (reviewTerms.some((term) => searchable.includes(term)) || payloadFlag(input.payload, 'pep') || payloadFlag(input.payload, 'adverseMedia')) {
        reasons.push('Potential PEP, watchlist, or adverse media indicator requires review.');
      }
      if (input.registryConfidence < 90) {
        reasons.push('Registry confidence is below the auto-approval threshold.');
      }
      if (input.duplicateApprovedRegistryCount > 0) {
        reasons.push('Another approved account already uses this registry number.');
      }
    }

    return {
      provider: 'deterministic-local-v1',
      status: blocked ? 'BLOCKED' : reasons.length > 0 ? 'REVIEW' : 'CLEAR',
      reasons,
      providerMetadata: {
        registrySource: input.registrySource,
        registryNumber: input.registryNumber,
        entityType: input.entityType,
        confidence: input.registryConfidence,
        rulesVersion: '2026.06.11'
      }
    };
  }
}
