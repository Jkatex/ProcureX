import { communicationApi } from './api';
import type { CommunicationAttachment } from './types';

export async function openCommunicationAttachment(messageId: string, attachment: CommunicationAttachment) {
  try {
    const blob = await communicationApi.getAttachment(messageId, attachment.id, 'open');
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (!opened) triggerAttachmentDownload(url, attachment.name);
  } catch {
    window.alert(`Could not open ${attachment.name}.`);
  }
}

export async function downloadCommunicationAttachment(messageId: string, attachment: CommunicationAttachment) {
  try {
    const blob = await communicationApi.getAttachment(messageId, attachment.id, 'download');
    const url = URL.createObjectURL(blob);
    triggerAttachmentDownload(url, attachment.name);
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    window.alert(`Could not download ${attachment.name}.`);
  }
}

function triggerAttachmentDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'attachment';
  document.body.append(link);
  link.click();
  link.remove();
}
