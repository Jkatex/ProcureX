import { apiClient } from '@/shared/api/http';
import { generateTenderPackPdfBlob, generatedTenderPackFilename } from './tenderPdfPack';
import type { TenderDetail, TenderDetailDocument } from './types';

type BlobAction = 'open' | 'download';

export async function downloadTenderDocument(tender: TenderDetail, document?: TenderDetailDocument) {
  if (document) {
    const response = await fetchTenderDocumentBlob(tender, document, 'download');
    triggerBrowserDownload(response.blob, response.filename || document.name || generatedTenderPackFilename(tender));
    return;
  }

  const blob = await generateTenderPackPdfBlob(tender);
  triggerBrowserDownload(blob, generatedTenderPackFilename(tender));
}

export async function openTenderDocument(tender: TenderDetail, document?: TenderDetailDocument, fallbackTargetId = 'documents') {
  if (document) {
    const response = await fetchTenderDocumentBlob(tender, document, 'open');
    openBlobInNewTab(response.blob);
    return;
  }

  const blob = await generateTenderPackPdfBlob(tender);
  openBlobInNewTab(blob);
  void fallbackTargetId;
}

export function hasBackendTenderDocument(document: TenderDetailDocument | undefined) {
  return Boolean(document?.openUrl || document?.downloadUrl || document?.id);
}

async function fetchTenderDocumentBlob(tender: TenderDetail, document: TenderDetailDocument, action: BlobAction) {
  const response = await apiClient.get<Blob>(documentActionUrl(tender, document, action), {
    responseType: 'blob'
  });

  return {
    blob: response.data,
    filename: filenameFromDisposition(response.headers['content-disposition']) || document.name
  };
}

function documentActionUrl(tender: TenderDetail, document: TenderDetailDocument, action: BlobAction) {
  const explicitUrl = action === 'download' ? document.downloadUrl : document.openUrl;
  if (explicitUrl) return explicitUrl;
  return `/api/procurement/tenders/${encodeURIComponent(tender.id)}/documents/${encodeURIComponent(document.id)}/${action}`;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = sanitizeFilename(filename) || 'tender-document.pdf';
  link.style.display = 'none';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function openBlobInNewTab(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

function filenameFromDisposition(disposition: string | undefined) {
  if (!disposition) return undefined;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].trim());
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1]?.trim();
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
}
