export type RegistryLookupRequest = {
  source: 'TRA' | 'BRELA';
  entityType: 'individual' | 'company' | 'business';
  registryNumber: string;
  businessRegistrationSource?: 'tin' | 'brela';
};

export type RegistryProviderRecord = {
  source: 'TRA' | 'BRELA';
  registryNumber: string;
  entityType: 'individual' | 'company' | 'business';
  name: string;
  status: string;
  confidence: number;
  payload: Record<string, unknown>;
};

export interface RegistryProvider {
  lookup(input: RegistryLookupRequest): Promise<RegistryProviderRecord | null>;
}

function providerError(message: string) {
  const error = new Error(message) as Error & { providerFailure?: true };
  error.providerFailure = true;
  return error;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProviderPayload(source: 'TRA' | 'BRELA', input: RegistryLookupRequest, payload: Record<string, unknown>): RegistryProviderRecord | null {
  const found = payload.found !== false && payload.status !== 'NOT_FOUND';
  if (!found) return null;

  const registryNumber = stringValue(payload.registryNumber) || stringValue(payload.tin) || stringValue(payload.registrationNumber) || input.registryNumber;
  const name = stringValue(payload.name) || stringValue(payload.legalName) || stringValue(payload.companyName) || stringValue(payload.businessName);
  if (!name) return null;

  return {
    source,
    registryNumber,
    entityType: input.entityType,
    name,
    status: stringValue(payload.matchStatus) || stringValue(payload.status) || 'MATCHED',
    confidence: Math.min(100, Math.max(0, numberValue(payload.confidence, 95))),
    payload
  };
}

class HttpRegistryProvider {
  constructor(
    private readonly source: 'TRA' | 'BRELA',
    private readonly baseUrl?: string,
    private readonly apiKey?: string
  ) {}

  async lookup(input: RegistryLookupRequest): Promise<RegistryProviderRecord | null> {
    if (!this.baseUrl) return null;

    const url = new URL('/registry/lookup', this.baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        registryNumber: input.registryNumber,
        entityType: input.entityType,
        businessRegistrationSource: input.businessRegistrationSource
      })
    }).catch((error: unknown) => {
      throw providerError(error instanceof Error ? error.message : 'Registry provider request failed.');
    });

    if (response.status === 404) return null;
    if (!response.ok) throw providerError(`${this.source} registry provider returned ${response.status}.`);

    const body = (await response.json().catch(() => {
      throw providerError(`${this.source} registry provider returned invalid JSON.`);
    })) as Record<string, unknown>;

    return normalizeProviderPayload(this.source, input, body);
  }
}

export class TraRegistryProvider extends HttpRegistryProvider {
  constructor(config = process.env) {
    super('TRA', config.TRA_REGISTRY_BASE_URL, config.TRA_REGISTRY_API_KEY);
  }
}

export class BrelaRegistryProvider extends HttpRegistryProvider {
  constructor(config = process.env) {
    super('BRELA', config.BRELA_REGISTRY_BASE_URL, config.BRELA_REGISTRY_API_KEY);
  }
}

export class ProductionRegistryProvider implements RegistryProvider {
  constructor(
    private readonly traProvider: RegistryProvider = new TraRegistryProvider(),
    private readonly brelaProvider: RegistryProvider = new BrelaRegistryProvider()
  ) {}

  lookup(input: RegistryLookupRequest) {
    return input.source === 'BRELA' ? this.brelaProvider.lookup(input) : this.traProvider.lookup(input);
  }
}

export function isRegistryProviderFailure(error: unknown) {
  return Boolean((error as Error & { providerFailure?: true }).providerFailure);
}
