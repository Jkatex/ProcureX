export type PhoneValidationRequest = {
  phone: string;
};

export type PhoneValidationResult = {
  provider: string;
  configured: boolean;
  accepted: boolean;
  reasons: string[];
  checks?: {
    valid?: boolean;
    reachable?: boolean;
  };
  providerMetadata?: Record<string, unknown>;
};

export interface PhoneValidationProvider {
  validate(input: PhoneValidationRequest): Promise<PhoneValidationResult>;
}

export class LocalPhoneValidationProvider implements PhoneValidationProvider {
  async validate(input: PhoneValidationRequest): Promise<PhoneValidationResult> {
    const valid = /^\+[1-9]\d{7,14}$/.test(input.phone);
    return {
      provider: 'local-phone-validation',
      configured: false,
      accepted: valid,
      reasons: valid ? [] : ['Phone number must use a valid international format.'],
      checks: { valid },
      providerMetadata: {
        note: 'SMS delivery is handled by the configured provider; no separate number-insight endpoint is configured.'
      }
    };
  }
}

export class BeemPhoneValidationProvider extends LocalPhoneValidationProvider {}

export function isPhoneValidationProviderFailure(error: unknown) {
  return Boolean((error as Error & { providerFailure?: true }).providerFailure);
}
