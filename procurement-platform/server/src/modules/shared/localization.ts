import type { Request } from 'express';
import { resolveSupportedLanguage, type SupportedLanguage } from '@procurex/shared';

export type LocalizedAuditContext = {
  language?: SupportedLanguage;
};

const apiMessageTranslations: Record<string, Record<SupportedLanguage, string>> = {
  'Unexpected server error.': {
    en: 'Unexpected server error.',
    sw: 'Hitilafu isiyotarajiwa ya seva imetokea.'
  },
  'Request failed.': {
    en: 'Request failed.',
    sw: 'Ombi halikufanikiwa.'
  },
  'Security check failed. Please refresh the page and try again.': {
    en: 'Security check failed. Please refresh the page and try again.',
    sw: 'Ukaguzi wa usalama haukufanikiwa. Tafadhali pakia ukurasa upya kisha ujaribu tena.'
  },
  'Too many auth requests. Please wait and try again.': {
    en: 'Too many auth requests. Please wait and try again.',
    sw: 'Maombi mengi ya uthibitishaji yametumwa. Tafadhali subiri kisha ujaribu tena.'
  },
  'Authentication is required.': {
    en: 'Authentication is required.',
    sw: 'Unahitaji kuingia kwanza.'
  },
  'Permission to approve this official document is required.': {
    en: 'Permission to approve this official document is required.',
    sw: 'Ruhusa ya kuidhinisha waraka huu rasmi inahitajika.'
  },
  'Support ticket was not found.': {
    en: 'Support ticket was not found.',
    sw: 'Ombi la msaada halikupatikana.'
  },
  'Support ticket access is not allowed.': {
    en: 'Support ticket access is not allowed.',
    sw: 'Huruhusiwi kufikia ombi hili la msaada.'
  },
  'Invalid support ticket payload.': {
    en: 'Invalid support ticket payload.',
    sw: 'Taarifa za ombi la msaada si sahihi.'
  },
  'Invalid contact support payload.': {
    en: 'Invalid contact support payload.',
    sw: 'Taarifa za mawasiliano ya msaada si sahihi.'
  },
  'Password reset request was not found.': {
    en: 'Password reset request was not found.',
    sw: 'Ombi la kuweka upya nenosiri halikupatikana.'
  },
  'Password reset request is no longer valid.': {
    en: 'Password reset request is no longer valid.',
    sw: 'Ombi la kuweka upya nenosiri halitumiki tena.'
  },
  'Could not send password reset email. Please try again later.': {
    en: 'Could not send password reset email. Please try again later.',
    sw: 'Hatukuweza kutuma barua pepe ya kuweka upya nenosiri. Tafadhali jaribu tena baadaye.'
  },
  'Could not send keyphrase recovery email. Please try again later.': {
    en: 'Could not send keyphrase recovery email. Please try again later.',
    sw: 'Hatukuweza kutuma barua pepe ya kurejesha kaulisiri ya saini. Tafadhali jaribu tena baadaye.'
  },
  'Signing keyphrase recovered. Please sign in again.': {
    en: 'Signing keyphrase recovered. Please sign in again.',
    sw: 'Kaulisiri ya saini imerejeshwa. Tafadhali ingia tena.'
  },
  'Document was not found.': {
    en: 'Document was not found.',
    sw: 'Waraka haukupatikana.'
  },
  'Document is not visible to this organization.': {
    en: 'Document is not visible to this organization.',
    sw: 'Waraka hauonekani kwa shirika hili.'
  },
  'No official document template matches the requested document type and procurement type.': {
    en: 'No official document template matches the requested document type and procurement type.',
    sw: 'Hakuna kiolezo cha waraka rasmi kinacholingana na aina ya waraka na aina ya ununuzi ulioombwa.'
  }
};

export function requestLanguage(req: Request): SupportedLanguage {
  return resolveSupportedLanguage(req.header('x-procurex-language') || req.header('accept-language'));
}

export function localizedMessage(message: string, language: SupportedLanguage): string {
  return apiMessageTranslations[message]?.[language] ?? message;
}
