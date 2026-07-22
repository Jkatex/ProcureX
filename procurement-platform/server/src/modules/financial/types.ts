/* Defines financial TypeScript contracts that keep API payloads, state, and UI props aligned. */
export const moduleDefinition = {
  key: 'financial',
  name: 'Financial',
  description: 'Purchase orders, invoices, matching checks, payment review, and financial records.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

