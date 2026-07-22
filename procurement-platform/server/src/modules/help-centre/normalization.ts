/* Supports the help centre server workflow with reusable logic kept close to the module that owns it. */
import { stopWords } from './constants.js';

const variations: Array<[RegExp, string]> = [
  [/\btenders\b/g, 'tender'],
  [/\bbids\b/g, 'bid'],
  [/\bsubmissions\b/g, 'submission'],
  [/\bsubmitted\b/g, 'submit'],
  [/\bsubmitting\b/g, 'submit'],
  [/\bdocuments\b/g, 'document'],
  [/\bpayments\b/g, 'payment'],
  [/\binvoices\b/g, 'invoice'],
  [/\bcontracts\b/g, 'contract'],
  [/\bclarifications\b/g, 'clarification'],
  [/\bnotifications\b/g, 'notification'],
  [/\bregistering\b/g, 'register'],
  [/\bregistered\b/g, 'register'],
  [/\bcreating\b/g, 'create'],
  [/\bcreated\b/g, 'create'],
  [/\bpublishing\b/g, 'publish'],
  [/\bpublished\b/g, 'publish']
];

export function normalizeHelpText(value: string) {
  let normalized = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of variations) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

export function meaningfulWords(value: string) {
  return normalizeHelpText(value)
    .split(' ')
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

