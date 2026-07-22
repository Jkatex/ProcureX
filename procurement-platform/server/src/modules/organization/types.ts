/* Defines organization TypeScript contracts that keep API payloads, state, and UI props aligned. */
export const moduleDefinition = {
  key: 'organization',
  name: 'Organization',
  description: 'Company membership, buyer/supplier capabilities, buyer profiles, and supplier profiles.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

