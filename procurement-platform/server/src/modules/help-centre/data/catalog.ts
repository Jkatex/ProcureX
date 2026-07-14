import type { HelpFaq } from '@procurex/shared';
import { helpCategories } from '../constants.js';
import { awardsFaqs } from './awards.faqs.js';
import { bidPreparationFaqs } from './bid-preparation.faqs.js';
import { bidSubmissionFaqs } from './bid-submission.faqs.js';
import { clarificationsFaqs } from './clarifications.faqs.js';
import { communicationFaqs } from './communication.faqs.js';
import { companyProfileFaqs } from './company-profile.faqs.js';
import { companyVerificationFaqs } from './company-verification.faqs.js';
import { complaintsDisputesFaqs } from './complaints-disputes.faqs.js';
import { consultancyTenderFaqs } from './consultancy-tenders.faqs.js';
import { contractFormationFaqs } from './contract-formation.faqs.js';
import { contractManagementFaqs } from './contract-management.faqs.js';
import { dashboardFaqs } from './dashboard.faqs.js';
import { evaluationFaqs } from './evaluation.faqs.js';
import { gettingStartedFaqs } from './getting-started.faqs.js';
import { goodsTenderFaqs } from './goods-tenders.faqs.js';
import { invoicesFaqs } from './invoices.faqs.js';
import { loginSecurityFaqs } from './login-security.faqs.js';
import { marketplaceFaqs } from './marketplace.faqs.js';
import { notificationsFaqs } from './notifications.faqs.js';
import { paymentsFaqs } from './payments.faqs.js';
import { postAwardFaqs } from './post-award.faqs.js';
import { privacySecurityFaqs } from './privacy-security.faqs.js';
import { procurementPlanningFaqs } from './procurement-planning.faqs.js';
import { recordsFaqs } from './records.faqs.js';
import { registrationFaqs } from './registration.faqs.js';
import { servicesTenderFaqs } from './services-tenders.faqs.js';
import { technicalSupportFaqs } from './technical-support.faqs.js';
import { tenderCreationFaqs } from './tender-creation.faqs.js';
import { tenderPublicationFaqs } from './tender-publication.faqs.js';
import { worksTenderFaqs } from './works-tenders.faqs.js';

export const allHelpFaqs: HelpFaq[] = [
  ...gettingStartedFaqs,
  ...registrationFaqs,
  ...loginSecurityFaqs,
  ...companyVerificationFaqs,
  ...companyProfileFaqs,
  ...dashboardFaqs,
  ...procurementPlanningFaqs,
  ...tenderCreationFaqs,
  ...goodsTenderFaqs,
  ...worksTenderFaqs,
  ...servicesTenderFaqs,
  ...consultancyTenderFaqs,
  ...tenderPublicationFaqs,
  ...marketplaceFaqs,
  ...bidPreparationFaqs,
  ...bidSubmissionFaqs,
  ...clarificationsFaqs,
  ...communicationFaqs,
  ...evaluationFaqs,
  ...awardsFaqs,
  ...contractFormationFaqs,
  ...contractManagementFaqs,
  ...postAwardFaqs,
  ...invoicesFaqs,
  ...paymentsFaqs,
  ...complaintsDisputesFaqs,
  ...recordsFaqs,
  ...notificationsFaqs,
  ...technicalSupportFaqs,
  ...privacySecurityFaqs
];

export { helpCategories };

