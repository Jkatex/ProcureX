export const moduleDefinition = {
  key: 'documents',
  name: 'Documents',
  description: 'Object storage metadata, checksums, encryption references, and document attachments.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type DocumentRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
};

export type DocumentContent = {
  filename: string;
  contentType: string;
  body: string;
};
