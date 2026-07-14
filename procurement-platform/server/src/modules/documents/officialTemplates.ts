import type {
  OfficialDocumentType,
  OfficialProcurementType,
  OfficialTemplateDto,
  OfficialTemplateField,
  OfficialTemplateSection
} from './types.js';

const ppraPublicationsUrl = 'https://www.ppra.go.tz/publications';
const ppraFormsUrl = 'https://www.ppra.go.tz/publications/procedural-forms-english';

export type OfficialTemplateDefinition = OfficialTemplateDto & {
  status: 'ACTIVE';
};

type TemplateInput = {
  code: string;
  name: string;
  description: string;
  documentType: OfficialDocumentType;
  procurementType?: OfficialProcurementType | null;
  sections: OfficialTemplateSection[];
  requiredFields?: OfficialTemplateField[];
  sourceUrl?: string;
};

const required = {
  title: field('title', 'Document title'),
  reference: field('reference', 'Reference number'),
  ownerName: field('ownerName', 'Procuring entity'),
  procurementType: field('procurementType', 'Procurement type'),
  closingDate: field('closingDate', 'Submission closing date'),
  financialYear: field('financialYear', 'Financial year'),
  items: field('items', 'Schedule lines or items'),
  supplierName: field('supplierName', 'Supplier or bidder name'),
  amount: field('amount', 'Amount'),
  contractRef: field('contractReference', 'Contract reference'),
  tenderRef: field('tenderReference', 'Tender reference')
};

const baseRequired = [required.title, required.reference, required.ownerName];
const tenderRequired = [...baseRequired, required.procurementType, required.closingDate];
const contractRequired = [...baseRequired, required.contractRef];

export const officialTemplateDefinitions: OfficialTemplateDefinition[] = [
  template({
    code: 'TZ-PPRA-APP-EN-1',
    name: 'Annual Procurement Plan',
    description: 'Official-ready annual procurement plan covering planned procurements, budget estimates, methods, timing, funding sources, and approval trace.',
    documentType: 'ANNUAL_PROCUREMENT_PLAN',
    procurementType: 'NOT_APPLICABLE',
    requiredFields: [required.title, required.reference, required.ownerName, required.financialYear, required.items],
    sections: [
      section('cover', 'Cover and Approval Status', 'States the procuring entity, financial year, plan reference, preparation basis, version status, and unsigned draft notice until approval is completed.'),
      section('authority', 'Legal and Institutional Basis', 'Records that the plan is prepared for structured public procurement planning and is intended to align with PPRA and NeST terminology.'),
      section('summary', 'Plan Summary', 'Summarises total planned procurement, currency, estimated budget, number of lines, procurement methods, and high-level implementation priorities.'),
      section('lines', 'Procurement Plan Schedule', 'Lists each planned procurement with title, category, procurement method, source of funds, opening date, closing date, expected completion date, and current planning state.'),
      section('funding', 'Budget and Source of Funds', 'Identifies budget estimates and funding source declarations for planned activities.'),
      section('methods', 'Procurement Method Justification', 'Records the proposed method for each plan line and supporting justification where available.'),
      section('risk', 'Planning Risks and Dependencies', 'Captures known procurement risks, dependencies, market constraints, and schedule sensitivity.'),
      section('approvals', 'Review, Approval, and Audit Trail', 'Provides approval placeholders, generated version details, content hash, and audit references.')
    ]
  }),
  template({
    code: 'TZ-PPRA-PLAN-EXTRACT-EN-1',
    name: 'Procurement Plan Extract',
    description: 'Official-ready extract for one procurement plan line or a related tender planning record.',
    documentType: 'PROCUREMENT_PLAN_EXTRACT',
    procurementType: 'NOT_APPLICABLE',
    requiredFields: [...baseRequired, required.financialYear],
    sections: [
      section('cover', 'Extract Identification', 'Identifies the plan, financial year, procuring entity, extract reference, and current approval status.'),
      section('line', 'Procurement Activity Details', 'Sets out the title, category, budget, procurement method, source of funds, timing, and current state of the selected plan activity.'),
      section('linkage', 'Tender or Workflow Linkage', 'Records the linked tender, requisition, or internal workflow record when available.'),
      section('schedule', 'Implementation Schedule', 'Shows planned opening, closing, award, contract, and completion dates where the workflow has captured them.'),
      section('approval', 'Certification and Audit Trail', 'Provides certification wording, signature placeholders, generated version details, and hash evidence.')
    ]
  }),
  tenderTemplate(
    'TZ-PPRA-TENDER-GOODS-EN-1',
    'Goods Tender Document',
    'GOODS',
    [
      section('cover', 'Cover Page and Invitation', 'Identifies the procuring entity, tender title, tender number, procurement method, submission deadline, and draft or official status.'),
      section('instructions', 'Instructions to Tenderers', 'Sets out how tenderers are expected to prepare, submit, clarify, modify, and secure bids through the platform.'),
      section('dataSheet', 'Tender Data Sheet', 'Provides tender-specific instructions, communication channels, submission deadline, bid validity, currency, and evaluation method details.'),
      section('requirements', 'Schedule of Requirements', 'Lists goods, quantities, units, delivery locations, delivery periods, inspection requirements, and acceptance basis.'),
      section('technical', 'Technical Specifications', 'States required technical characteristics, standards, performance requirements, warranty expectations, and documentary evidence.'),
      section('delivery', 'Delivery and Completion Schedule', 'Sets out delivery milestones, completion period, destination, packaging, installation, commissioning, and handover expectations where applicable.'),
      section('pricing', 'Price Schedule', 'Defines how prices are to be quoted, including item rates, taxes, duties, transport, installation, discounts, and total tender price.'),
      section('eligibility', 'Eligibility and Qualification Requirements', 'Records registration, tax, experience, financial capacity, manufacturer authorisation, after-sales support, and compliance documents.'),
      section('evaluation', 'Evaluation and Award Criteria', 'Describes preliminary examination, technical responsiveness, financial comparison, preference or margin rules if applicable, and award recommendation basis.'),
      section('conditions', 'General and Special Conditions of Contract', 'References standard contract obligations and records special conditions captured for this procurement.'),
      section('forms', 'Tender Forms and Declarations', 'Provides placeholders for tender submission form, price schedule, bidder declaration, power of attorney, bid security, and integrity declaration.'),
      section('annexes', 'Annexes and Attachments', 'Lists uploaded tender documents, specifications, schedules, clarifications, and supporting annexes.')
    ]
  ),
  tenderTemplate(
    'TZ-PPRA-TENDER-WORKS-EN-1',
    'Works Tender Document',
    'WORKS',
    [
      section('cover', 'Cover Page and Invitation', 'Identifies the procuring entity, works title, tender number, method, location, completion period, site visit arrangements, and status.'),
      section('instructions', 'Instructions to Tenderers', 'Sets out preparation, submission, clarification, bid security, alternative bids, site information, and bid validity requirements.'),
      section('dataSheet', 'Tender Data Sheet', 'Provides project-specific tender data, communication channels, deadline, opening arrangements, qualification thresholds, and evaluation method.'),
      section('scope', 'Scope of Works', 'Defines the works, location, employer requirements, expected outputs, construction constraints, environmental and social obligations, and completion requirements.'),
      section('drawings', 'Drawings, Specifications, and Site Information', 'Lists drawings, technical specifications, standards, geotechnical or site information, and responsibility for verifying site conditions.'),
      section('boq', 'Bill of Quantities and Pricing Schedule', 'Sets out BOQ items, quantities, units, rates, provisional sums, taxes, currency, and pricing instructions.'),
      section('programme', 'Programme, Milestones, and Completion Period', 'Records mobilisation, key milestones, sectional completion, defects liability period, reporting, and progress measurement.'),
      section('resources', 'Personnel, Plant, Equipment, and Methodology', 'Specifies key personnel, equipment, work plan, methodology, quality control, safety, and subcontracting requirements.'),
      section('eligibility', 'Eligibility and Qualification Requirements', 'Records registration, contractor class, experience, financial capacity, litigation history, tax compliance, and similar works evidence.'),
      section('evaluation', 'Evaluation and Award Criteria', 'Describes responsiveness checks, technical qualification, arithmetic correction, financial comparison, and award recommendation basis.'),
      section('conditions', 'General and Special Conditions of Contract', 'References GCC/SCC clauses, insurances, securities, payment terms, variations, claims, dispute resolution, and performance security.'),
      section('forms', 'Tender Forms and Declarations', 'Provides tender submission form, BOQ summary, bid security, integrity declaration, qualification forms, and power of attorney placeholders.'),
      section('annexes', 'Annexes and Attachments', 'Lists drawings, BOQ files, specifications, site visit minutes, addenda, and other uploaded tender documents.')
    ]
  ),
  tenderTemplate(
    'TZ-PPRA-TENDER-NONCONSULTANCY-EN-1',
    'Non-Consultancy Services Tender Document',
    'NON_CONSULTANCY',
    [
      section('cover', 'Cover Page and Invitation', 'Identifies the procuring entity, service title, tender number, method, service locations, submission deadline, and status.'),
      section('instructions', 'Instructions to Tenderers', 'Sets out bid preparation, submission, clarification, bid validity, service mobilisation, and responsiveness requirements.'),
      section('dataSheet', 'Tender Data Sheet', 'Provides tender-specific data, communication channels, deadline, qualification thresholds, contract period, and evaluation method.'),
      section('scope', 'Scope of Services', 'Defines required services, service locations, operating hours, standards, exclusions, interfaces, and required deliverables.'),
      section('levels', 'Service Levels and Performance Standards', 'States service level requirements, response times, quality measures, reporting obligations, deductions, and acceptance criteria.'),
      section('resources', 'Personnel, Equipment, and Mobilisation', 'Specifies key personnel, equipment, tools, materials, mobilisation plan, health and safety, and supervisory arrangements.'),
      section('deliverables', 'Deliverables, Reporting, and Records', 'Lists recurring reports, logs, service records, performance evidence, and submission frequency.'),
      section('pricing', 'Pricing Schedule', 'Defines how bidders price monthly, activity-based, output-based, reimbursable, or lump sum service components.'),
      section('eligibility', 'Eligibility and Qualification Requirements', 'Records registration, licensing, experience, financial capacity, references, staffing, and compliance documents.'),
      section('evaluation', 'Evaluation and Award Criteria', 'Describes preliminary examination, technical responsiveness, service capability assessment, financial comparison, and award basis.'),
      section('conditions', 'General and Special Conditions of Contract', 'References standard service contract terms, service credits, insurance, confidentiality, termination, and payment conditions.'),
      section('forms', 'Tender Forms and Declarations', 'Provides tender submission form, price schedule, method statement, staffing forms, and bidder declarations.'),
      section('annexes', 'Annexes and Attachments', 'Lists uploaded schedules, service maps, specifications, addenda, and supporting documents.')
    ]
  ),
  tenderTemplate(
    'TZ-PPRA-TENDER-CONSULTANCY-EN-1',
    'Consultancy Services Request for Proposals',
    'CONSULTANCY',
    [
      section('cover', 'Cover Page and Letter of Invitation', 'Identifies the procuring entity, assignment title, reference, selection method, proposal submission deadline, and status.'),
      section('instructions', 'Instructions to Consultants', 'Sets out proposal preparation, clarification, association or joint venture rules, conflict of interest, validity, and submission instructions.'),
      section('dataSheet', 'Proposal Data Sheet', 'Provides assignment-specific data, communication channels, deadline, technical and financial proposal requirements, and evaluation weights.'),
      section('tor', 'Terms of Reference', 'Defines background, objectives, scope, expected methodology, tasks, deliverables, location, timeline, and reporting arrangements.'),
      section('expertise', 'Key Experts and Staffing Requirements', 'Specifies required experts, qualifications, person-months, roles, CV requirements, and replacement conditions.'),
      section('technicalProposal', 'Technical Proposal Structure', 'States required technical proposal contents including understanding, methodology, work plan, staffing, deliverables, and organisation.'),
      section('financialProposal', 'Financial Proposal Structure', 'Defines financial forms, currencies, reimbursable expenses, taxes, fee breakdown, and total proposal price.'),
      section('evaluation', 'Technical and Financial Evaluation Criteria', 'Describes minimum technical score, criteria, weighting, financial opening, combined scoring method, and negotiation basis.'),
      section('negotiation', 'Negotiation and Award Process', 'Records intended negotiation topics, contract finalisation steps, and award recommendation basis.'),
      section('conditions', 'Draft Contract Conditions', 'References standard consultancy contract conditions, special conditions, payment schedule, intellectual property, reporting, and confidentiality.'),
      section('forms', 'Proposal Forms and Declarations', 'Provides technical proposal forms, financial proposal forms, CV form, declaration forms, and power of attorney placeholders.'),
      section('annexes', 'Annexes and Background Documents', 'Lists TOR attachments, reports, baseline studies, policy documents, drawings, and uploaded support materials.')
    ]
  ),
  template({
    code: 'TZ-PPRA-TENDER-NOTICE-EN-1',
    name: 'Specific Tender Notice',
    description: 'Official-ready notice inviting tenderers or consultants to participate in a specific opportunity.',
    documentType: 'SPECIFIC_TENDER_NOTICE',
    procurementType: 'MIXED',
    requiredFields: tenderRequired,
    sections: noticeSections('Notice Text', 'Tender Information', 'Submission and Opening Information')
  }),
  template({
    code: 'TZ-PPRA-TENDER-AMENDMENT-EN-1',
    name: 'Tender Addendum or Amendment',
    description: 'Official-ready addendum documenting changes, clarifications, extended deadlines, replacement schedules, or revised tender instructions.',
    documentType: 'TENDER_AMENDMENT',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: [
      section('cover', 'Addendum Identification', 'Identifies the tender, addendum reference, issuing authority, date, and whether the tender deadline is affected.'),
      section('background', 'Background and Reason for Amendment', 'Explains the need for the addendum, clarification, correction, or change.'),
      section('changes', 'Detailed Amendments', 'Lists each amended clause, document, schedule, specification, BOQ item, TOR item, deadline, or instruction.'),
      section('effect', 'Effect on Tender Documents', 'States that unchanged provisions remain in force and explains how tenderers should treat replaced text or attachments.'),
      section('submission', 'Submission Instructions After Addendum', 'Records new submission, clarification, validity, or acknowledgement requirements.'),
      section('acknowledgement', 'Tenderer Acknowledgement', 'Provides a space for tenderers to acknowledge receipt where required.'),
      section('approval', 'Approval and Audit Trail', 'Records approval placeholders, generated version details, and content hash evidence.')
    ]
  }),
  template({
    code: 'TZ-PPRA-BID-RECEIPT-EN-1',
    name: 'Bid Submission Receipt',
    description: 'Official-ready receipt confirming submission metadata, sealed hash, submission time, bidder, tender, and document manifest.',
    documentType: 'BID_SUBMISSION_RECEIPT',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.supplierName, required.tenderRef],
    sections: recordSections('Receipt Confirmation', 'Submission Manifest', 'Hash and Timestamp Record')
  }),
  template({
    code: 'TZ-PPRA-SEALED-BID-RECORD-EN-1',
    name: 'Sealed Bid Record',
    description: 'Official-ready sealed bid record documenting envelope status, version hash, access controls, and custody trail before bid opening.',
    documentType: 'SEALED_BID_RECORD',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.supplierName, required.tenderRef],
    sections: recordSections('Sealed Bid Identification', 'Envelope and Custody Details', 'Integrity Controls')
  }),
  template({
    code: 'TZ-PPRA-BID-OPENING-EN-1',
    name: 'Bid Opening Record',
    description: 'Official-ready bid opening record with tender, bidders, opening date, submitted prices where available, and committee acknowledgement placeholders.',
    documentType: 'BID_OPENING_RECORD',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: recordSections('Opening Session Details', 'Bids Received and Read Out', 'Committee Certification')
  }),
  template({
    code: 'TZ-PPRA-EVALUATION-REPORT-EN-1',
    name: 'Evaluation Report',
    description: 'Official-ready evaluation report for goods, works, and non-consultancy services using responsiveness, technical, qualification, and financial comparison sections.',
    documentType: 'EVALUATION_REPORT',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: evaluationSections('Evaluation Methodology', 'Responsiveness and Qualification Review', 'Financial Comparison and Recommendation')
  }),
  template({
    code: 'TZ-PPRA-CONSULTANCY-EVALUATION-EN-1',
    name: 'Consultancy Technical and Financial Evaluation Report',
    description: 'Official-ready consultancy evaluation report covering technical scoring, minimum score threshold, financial opening, combined ranking, and negotiation recommendation.',
    documentType: 'CONSULTANCY_EVALUATION_REPORT',
    procurementType: 'CONSULTANCY',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: evaluationSections('Technical Evaluation', 'Financial Evaluation', 'Combined Ranking and Negotiation Recommendation')
  }),
  template({
    code: 'TZ-PPRA-AWARD-RECOMMENDATION-EN-1',
    name: 'Award Recommendation',
    description: 'Official-ready award recommendation summarising evaluation outcome, recommended supplier, amount, reasons, and approval path.',
    documentType: 'AWARD_RECOMMENDATION',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: awardSections('Recommendation Summary', 'Recommended Award and Justification')
  }),
  template({
    code: 'TZ-PPRA-AWARD-APPROVAL-REQUEST-EN-1',
    name: 'Request for Approval of Award',
    description: 'Official-ready approval request package for award decision review and authorisation.',
    documentType: 'AWARD_APPROVAL_REQUEST',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: awardSections('Approval Request', 'Decision Required')
  }),
  template({
    code: 'TZ-PPRA-NOTICE-INTENTION-AWARD-EN-1',
    name: 'Intention or Notice of Award',
    description: 'Official-ready notice communicating intended or approved award decision to relevant parties.',
    documentType: 'NOTICE_OF_INTENTION_TO_AWARD',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.tenderRef],
    sections: noticeSections('Award Notice Text', 'Award Decision Information', 'Response or Standstill Information')
  }),
  template({
    code: 'TZ-PPRA-AWARD-RESPONSE-EN-1',
    name: 'Award Response Record',
    description: 'Official-ready record of supplier response to an award notice, including acceptance, clarification, rejection, or expiry.',
    documentType: 'AWARD_RESPONSE_RECORD',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.supplierName],
    sections: recordSections('Response Identification', 'Supplier Response', 'Next Action Record')
  }),
  template({
    code: 'TZ-PPRA-NEGOTIATION-PLAN-EN-1',
    name: 'Negotiation Plan',
    description: 'Official-ready plan for permitted procurement or contract negotiations after evaluation or award stage.',
    documentType: 'NEGOTIATION_PLAN',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: negotiationSections('Negotiation Objectives', 'Mandate and Limits', 'Negotiation Agenda')
  }),
  template({
    code: 'TZ-PPRA-NEGOTIATION-RECORD-EN-1',
    name: 'Negotiation Record',
    description: 'Official-ready minutes and outcome record for negotiation meetings.',
    documentType: 'NEGOTIATION_RECORD',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: negotiationSections('Meeting Record', 'Agreed Changes', 'Unresolved Matters')
  }),
  template({
    code: 'TZ-PPRA-CONTRACT-EN-1',
    name: 'Draft or Final Contract',
    description: 'Official-ready contract document covering parties, scope, price, conditions, deliverables, payment, signatures, and version integrity.',
    documentType: 'CONTRACT_DOCUMENT',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: contractSections('Agreement', 'Scope, Price, and Deliverables', 'Conditions and Signatures')
  }),
  template({
    code: 'TZ-PPRA-CONTRACT-VERSION-CERT-EN-1',
    name: 'Contract Version Certificate',
    description: 'Official-ready certificate identifying a contract version, hash, source workflow, and change history.',
    documentType: 'CONTRACT_VERSION_CERTIFICATE',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: recordSections('Version Identification', 'Version Content Summary', 'Integrity Certificate')
  }),
  template({
    code: 'TZ-PPRA-CONTRACT-SIGNATURE-CERT-EN-1',
    name: 'Contract Signature Certificate',
    description: 'Official-ready certificate for contract signing events, signatories, timestamps, signature hashes, and official status.',
    documentType: 'CONTRACT_SIGNATURE_CERTIFICATE',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: recordSections('Signature Identification', 'Signatory Record', 'Digital Integrity Certificate')
  }),
  template({
    code: 'TZ-PPRA-PURCHASE-ORDER-EN-1',
    name: 'Purchase Order',
    description: 'Official-ready purchase order linked to a contract or procurement decision, including supplier, items, amount, delivery, and payment terms.',
    documentType: 'PURCHASE_ORDER',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.amount],
    sections: postAwardSections('Purchase Order Details', 'Items and Delivery', 'Financial and Approval Controls')
  }),
  template({
    code: 'TZ-PPRA-DELIVERY-ACCEPTANCE-EN-1',
    name: 'Delivery, Inspection, and Acceptance Certificate',
    description: 'Official-ready certificate for delivery, inspection, acceptance, rejection, or conditional acceptance.',
    documentType: 'DELIVERY_ACCEPTANCE_CERTIFICATE',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: postAwardSections('Delivery Record', 'Inspection and Acceptance Findings', 'Certification')
  }),
  template({
    code: 'TZ-PPRA-INVOICE-PAYMENT-CERT-EN-1',
    name: 'Invoice and Payment Certificate',
    description: 'Official-ready payment certificate linking invoice, contract, purchase order, acceptance evidence, amount, and approval status.',
    documentType: 'INVOICE_PAYMENT_CERTIFICATE',
    procurementType: 'MIXED',
    requiredFields: [...baseRequired, required.amount],
    sections: postAwardSections('Invoice Identification', 'Payment Verification', 'Payment Approval Certificate')
  }),
  template({
    code: 'TZ-PPRA-CONTRACT-VARIATION-EN-1',
    name: 'Variation or Amendment Request',
    description: 'Official-ready request and justification for contract variation, amendment, or change control.',
    documentType: 'CONTRACT_VARIATION_REQUEST',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: contractSections('Variation Request', 'Justification and Impact', 'Approval Recommendation')
  }),
  template({
    code: 'TZ-PPRA-CLOSEOUT-CERT-EN-1',
    name: 'Closeout and Final Acceptance Certificate',
    description: 'Official-ready closeout certificate confirming completion, final acceptance, payments, outstanding issues, and archive readiness.',
    documentType: 'CONTRACT_CLOSEOUT_CERTIFICATE',
    procurementType: 'MIXED',
    requiredFields: contractRequired,
    sections: postAwardSections('Closeout Summary', 'Final Acceptance and Outstanding Matters', 'Archive and Certification')
  }),
  template({
    code: 'TZ-PPRA-RECORD-ARCHIVE-EN-1',
    name: 'Procurement Record Archive Report',
    description: 'Official-ready archive report for the complete procurement record, version list, documents, audit events, and lifecycle summary.',
    documentType: 'PROCUREMENT_RECORD_ARCHIVE_REPORT',
    procurementType: 'MIXED',
    requiredFields: baseRequired,
    sections: recordArchiveSections('Archive Scope', 'Lifecycle Record Index', 'Retention and Integrity Statement')
  }),
  template({
    code: 'TZ-PPRA-OFFICIAL-RECORD-CERT-EN-1',
    name: 'Official Record Certificate',
    description: 'Official-ready certificate attesting to the generated official record version, hash, status, source workflow, and sign-off trail.',
    documentType: 'OFFICIAL_RECORD_CERTIFICATE',
    procurementType: 'MIXED',
    requiredFields: baseRequired,
    sections: recordArchiveSections('Record Certificate', 'Certified Version Details', 'Official Status and Hash')
  })
];

export function listOfficialTemplateDtos() {
  return officialTemplateDefinitions.map(toTemplateDto);
}

export function findOfficialTemplate(input: {
  templateCode?: string;
  documentType: OfficialDocumentType;
  procurementType?: OfficialProcurementType | null;
}) {
  if (input.templateCode) {
    return officialTemplateDefinitions.find((templateDefinition) => templateDefinition.code === input.templateCode) ?? null;
  }

  const requestedType = input.procurementType ?? null;
  return (
    officialTemplateDefinitions.find(
      (templateDefinition) => templateDefinition.documentType === input.documentType && templateDefinition.procurementType === requestedType
    ) ??
    officialTemplateDefinitions.find(
      (templateDefinition) => templateDefinition.documentType === input.documentType && templateDefinition.procurementType === 'MIXED'
    ) ??
    officialTemplateDefinitions.find(
      (templateDefinition) => templateDefinition.documentType === input.documentType && templateDefinition.procurementType === 'NOT_APPLICABLE'
    ) ??
    null
  );
}

export function toTemplateDto(templateDefinition: OfficialTemplateDefinition): OfficialTemplateDto {
  return {
    code: templateDefinition.code,
    name: templateDefinition.name,
    description: templateDefinition.description,
    documentType: templateDefinition.documentType,
    procurementType: templateDefinition.procurementType,
    jurisdiction: templateDefinition.jurisdiction,
    language: templateDefinition.language,
    version: templateDefinition.version,
    sourceAuthority: templateDefinition.sourceAuthority,
    sourceUrl: templateDefinition.sourceUrl,
    sections: templateDefinition.sections,
    requiredFields: templateDefinition.requiredFields
  };
}

function tenderTemplate(
  code: string,
  name: string,
  procurementType: OfficialProcurementType,
  sections: OfficialTemplateSection[]
) {
  return template({
    code,
    name,
    description: `${name} with standard tender structure, official static wording, data sheet fields, schedules, criteria, contract references, forms, and annex placeholders.`,
    documentType: 'TENDER_DOCUMENT',
    procurementType,
    requiredFields: tenderRequired,
    sections
  });
}

function template(input: TemplateInput): OfficialTemplateDefinition {
  return {
    code: input.code,
    name: input.name,
    description: input.description,
    documentType: input.documentType,
    procurementType: input.procurementType ?? null,
    jurisdiction: 'TZ',
    language: 'en',
    version: '1.0',
    status: 'ACTIVE',
    sourceAuthority: 'PPRA',
    sourceUrl: input.sourceUrl ?? ppraPublicationsUrl,
    sections: input.sections,
    requiredFields: input.requiredFields ?? baseRequired
  };
}

function field(path: string, label: string): OfficialTemplateField {
  return { path, label };
}

function section(key: string, title: string, description: string): OfficialTemplateSection {
  return { key, title, description };
}

function noticeSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Notice Identification', 'Identifies the procuring entity, notice reference, tender or award reference, issue date, version status, and publication channel.'),
    section('notice', first, 'Provides formal notice wording suitable for publication or communication through the procurement workflow.'),
    section('details', second, 'Summarises the procurement, method, category, location, eligibility, source workflow, and key dates.'),
    section('submission', third, 'States how responses, tenders, acknowledgements, or objections must be submitted and the applicable deadline.'),
    section('contacts', 'Communication and Clarification', 'Records the authorised communication channel, clarification rules, and contact restrictions.'),
    section('integrity', 'Integrity and Audit Statement', 'Records the generated version, checksum, status, and approval/signature placeholders.')
  ];
}

function recordSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Record Identification', 'Identifies the source workflow, parties, reference number, date, generated version, and official status.'),
    section('record', first, 'Records the primary event, decision, submission, certificate, or workflow action represented by this document.'),
    section('details', second, 'Sets out the relevant manifest, participants, items, documents, amounts, timestamps, and workflow data available in the system.'),
    section('integrity', third, 'Captures content hash, source entity, generated-by user, version number, and audit evidence.'),
    section('certification', 'Certification and Signatures', 'Provides formal certification wording and signature placeholders for authorised officers.')
  ];
}

function evaluationSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Evaluation Report Identification', 'Identifies the procurement, evaluation workspace, committee or evaluators, report version, and current approval status.'),
    section('background', 'Procurement Background', 'Summarises the tender, method, key dates, bids received, evaluation stages, and applicable tender document requirements.'),
    section('methodology', first, 'Describes the evaluation procedure, criteria, scoring or pass/fail basis, clarifications, and conflict of interest declarations.'),
    section('responsiveness', second, 'Records administrative responsiveness, technical assessment, qualification checks, deviations, clarifications, and disqualifications.'),
    section('financial', third, 'Records financial comparison, arithmetic checks, ranking, recommended award or negotiation result, and reasons.'),
    section('recommendation', 'Evaluation Committee Recommendation', 'States the recommendation, conditions, dissenting notes where any, and next approval step.'),
    section('annexes', 'Annexes and Audit Trail', 'Lists evaluation scores, bid references, uploaded documents, generated version hash, and approval placeholders.')
  ];
}

function awardSections(first: string, second: string) {
  return [
    section('cover', 'Award Document Identification', 'Identifies the tender, award reference, procuring entity, recommended supplier, amount, currency, version, and status.'),
    section('background', 'Evaluation and Procurement Background', 'Summarises tender publication, bid receipt, evaluation completion, and decision context.'),
    section('recommendation', first, 'States the recommended action, supplier, price, lots, scope, conditions, and approval requested.'),
    section('justification', second, 'Explains the evaluation basis, responsiveness, value for money, budget confirmation, and reasons for recommendation.'),
    section('approvals', 'Approval Route and Conditions', 'Records approval steps, required signatories, conditions precedent, and notice requirements.'),
    section('integrity', 'Integrity and Audit Trail', 'Records generated version details, checksum, source workflow, and signature placeholders.')
  ];
}

function negotiationSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Negotiation Document Identification', 'Identifies the contract, award, parties, negotiation reference, meeting date, generated version, and status.'),
    section('mandate', first, 'States the negotiation purpose, authority, permissible subjects, expected outcome, and procurement limits.'),
    section('limits', second, 'Records non-negotiable terms, approved parameters, financial limits, technical safeguards, and compliance controls.'),
    section('agenda', third, 'Sets out agenda items, attendees, issues discussed, agreed positions, pending points, and action owners.'),
    section('outcome', 'Outcome and Contract Impact', 'Records agreed changes, effect on contract documents, price, delivery, risk, and next approvals.'),
    section('certification', 'Certification and Audit Trail', 'Provides signature placeholders, version hash, and audit evidence.')
  ];
}

function contractSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Contract Document Identification', 'Identifies the contract, tender, award, parties, version number, amount, currency, and status.'),
    section('agreement', first, 'States the agreement record, parties, authorised representatives, commencement, duration, and contract documents hierarchy.'),
    section('scope', second, 'Defines scope, deliverables, specifications, BOQ or price schedule, milestones, acceptance criteria, and reporting requirements.'),
    section('price', 'Contract Price and Payment', 'Records price, currency, taxes, payment schedule, invoicing requirements, retention, securities, and financial controls.'),
    section('conditions', third, 'Records general and special conditions, performance obligations, warranties, variations, termination, dispute resolution, and confidentiality.'),
    section('signatures', 'Execution and Signature Blocks', 'Provides signature blocks, witness placeholders, digital signing status, and final approval statement.'),
    section('integrity', 'Version Integrity and Audit Trail', 'Records source workflow, generated version, content hash, and official status history.')
  ];
}

function postAwardSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Post-Award Document Identification', 'Identifies the contract or order, parties, reference number, generated version, and current status.'),
    section('details', first, 'Records the main post-award transaction, request, delivery, invoice, acceptance, or closeout event represented by this document.'),
    section('items', second, 'Sets out items, services, deliverables, inspection findings, payment evidence, quantities, dates, and supporting records.'),
    section('controls', third, 'Records approval route, budget or contract controls, segregation of duties, and required certification.'),
    section('exceptions', 'Exceptions, Reservations, and Follow-up Actions', 'Captures deficiencies, rejected items, pending documentation, corrective action, and due dates.'),
    section('certification', 'Certification and Audit Trail', 'Provides signature placeholders, generated version details, checksum, and official status evidence.')
  ];
}

function recordArchiveSections(first: string, second: string, third: string) {
  return [
    section('cover', 'Official Record Identification', 'Identifies the procurement record, source workflow, procuring entity, reference, generated version, and status.'),
    section('scope', first, 'Defines the procurement lifecycle scope covered by the archive or certificate.'),
    section('index', second, 'Indexes planning, tendering, bidding, evaluation, award, contract, post-award, payment, communication, and document records available in the system.'),
    section('integrity', third, 'Records content hashes, generated versions, immutable references, audit events, retention indicators, and official status.'),
    section('certification', 'Record Certification', 'Provides certification wording and signature placeholders for records or procurement officers.')
  ];
}
