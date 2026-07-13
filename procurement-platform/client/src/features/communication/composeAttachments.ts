import type { CommunicationAttachmentUpload } from './types';

export type ComposeAttachmentStatus = 'loading' | 'ready' | 'error';

export type ComposeAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  documentType: string;
  file: File;
  status: ComposeAttachmentStatus;
  progress: number;
  contentBase64?: string;
  error?: string;
};

export function createComposeAttachment(file: File, documentType: string): ComposeAttachment {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    size: file.size,
    type: file.type,
    documentType,
    file,
    status: 'loading',
    progress: 0
  };
}

export function composeAttachmentsReady(attachments: ComposeAttachment[]) {
  return attachments.every((attachment) => attachment.status === 'ready' && attachment.contentBase64 !== undefined);
}

export function composeAttachmentsHaveError(attachments: ComposeAttachment[]) {
  return attachments.some((attachment) => attachment.status === 'error');
}

export function attachmentStatusLabel(attachment: ComposeAttachment) {
  if (attachment.status === 'ready') return 'Ready';
  if (attachment.status === 'error') return attachment.error ?? 'Could not load';
  return `Loading ${Math.max(0, Math.min(99, attachment.progress))}%`;
}

export async function toCommunicationAttachmentUpload(attachment: ComposeAttachment): Promise<CommunicationAttachmentUpload> {
  if (attachment.status !== 'ready' || attachment.contentBase64 === undefined) {
    throw new Error(`${attachment.name} is not ready to send.`);
  }
  return {
    name: attachment.name,
    documentType: attachment.documentType,
    mimeType: attachment.type || undefined,
    size: attachment.size,
    contentBase64: attachment.contentBase64
  };
}

export function readComposeAttachmentContent(file: File, onProgress?: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Attachment could not be read.'));
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        return;
      }
      onProgress?.(50);
    };
    reader.onload = () => {
      onProgress?.(100);
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
