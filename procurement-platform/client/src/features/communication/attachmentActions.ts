import { notificationFromApiError } from '@/shared/api/errors';
import { communicationApi } from './api';
import type { CommunicationAttachment } from './types';

export async function openCommunicationAttachment(messageId: string, attachment: CommunicationAttachment) {
  try {
    const blob = await communicationApi.getAttachment(messageId, attachment.id, 'open');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    notifyAttachmentError(error, 'Attachment could not open', `Could not open ${attachment.name}.`);
  }
}

export async function downloadCommunicationAttachment(messageId: string, attachment: CommunicationAttachment) {
  try {
    const blob = await communicationApi.getAttachment(messageId, attachment.id, 'download');
    const url = URL.createObjectURL(blob);
    triggerAttachmentDownload(url, attachment.name);
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    notifyAttachmentError(error, 'Attachment could not download', `Could not download ${attachment.name}.`);
  }
}

function notifyAttachmentError(error: unknown, title: string, fallback: string) {
  window.dispatchEvent(
    new CustomEvent('procurex:notify', {
      detail: notificationFromApiError(error, { title, fallback })
    })
  );
}

function triggerAttachmentDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'attachment';
  document.body.append(link);
  link.click();
  link.remove();
}
