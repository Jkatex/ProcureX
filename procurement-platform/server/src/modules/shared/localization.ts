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
  'Some submitted information is incomplete or invalid.': {
    en: 'Some submitted information is incomplete or invalid.',
    sw: 'Baadhi ya taarifa ulizowasilisha hazijakamilika au si sahihi.'
  },
  'Review the highlighted fields and try again.': {
    en: 'Review the highlighted fields and try again.',
    sw: 'Kagua sehemu zilizoonyeshwa kisha ujaribu tena.'
  },
  'Your session is no longer valid for this request.': {
    en: 'Your session is no longer valid for this request.',
    sw: 'Kipindi chako hakitumiki tena kwa ombi hili.'
  },
  'Your account, permission, or security check does not allow this action right now.': {
    en: 'Your account, permission, or security check does not allow this action right now.',
    sw: 'Akaunti, ruhusa, au ukaguzi wa usalama haukuruhusu kitendo hiki kwa sasa.'
  },
  'The requested record could not be found.': {
    en: 'The requested record could not be found.',
    sw: 'Rekodi iliyoombwa haikupatikana.'
  },
  'The request conflicts with an existing record or the current workflow state.': {
    en: 'The request conflicts with an existing record or the current workflow state.',
    sw: 'Ombi linakinzana na rekodi iliyopo au hali ya sasa ya mtiririko wa kazi.'
  },
  'The code, link, or request has expired.': {
    en: 'The code, link, or request has expired.',
    sw: 'Msimbo, kiungo, au ombi limeisha muda.'
  },
  'This action was attempted too many times in a short period.': {
    en: 'This action was attempted too many times in a short period.',
    sw: 'Kitendo hiki kimejaribiwa mara nyingi ndani ya muda mfupi.'
  },
  'A required service is temporarily unavailable.': {
    en: 'A required service is temporarily unavailable.',
    sw: 'Huduma inayohitajika haipatikani kwa muda.'
  },
  'ProcureX could not complete this action.': {
    en: 'ProcureX could not complete this action.',
    sw: 'ProcureX haikuweza kukamilisha kitendo hiki.'
  },
  'ProcureX could not complete this request.': {
    en: 'ProcureX could not complete this request.',
    sw: 'ProcureX haikuweza kukamilisha ombi hili.'
  },
  'This browser origin is not allowed.': {
    en: 'This browser origin is not allowed.',
    sw: 'Chanzo hiki cha kivinjari hakiruhusiwi.'
  },
  'ProcureX blocked a request from an unapproved origin.': {
    en: 'ProcureX blocked a request from an unapproved origin.',
    sw: 'ProcureX imezuia ombi kutoka chanzo kisichoidhinishwa.'
  },
  'The requested ProcureX endpoint was not found.': {
    en: 'The requested ProcureX endpoint was not found.',
    sw: 'Njia ya ProcureX iliyoombwa haikupatikana.'
  },
  'Check the link or return to the previous page.': {
    en: 'Check the link or return to the previous page.',
    sw: 'Kagua kiungo au rudi kwenye ukurasa uliopita.'
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
