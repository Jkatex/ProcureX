import type { AwardContractActionDefinition } from '../../types';

export const awardContractActionCatalogue: AwardContractActionDefinition[] = [
  { key: 'approve-award', label: 'Approve award', owner: 'BUYER', group: 'Awarding', targetRecordType: 'awardRecommendation' },
  { key: 'return-award', label: 'Return award', owner: 'BUYER', group: 'Awarding', targetRecordType: 'awardRecommendation' },
  { key: 'supplier-award-response', label: 'Respond to award', owner: 'SUPPLIER', group: 'Awarding', targetRecordType: 'awardNotice' },
  { key: 'contract-draft', label: 'Update contract draft', owner: 'BUYER', group: 'Formation', targetRecordType: 'contractVersion' },
  { key: 'clause-review', label: 'Review clause', owner: 'ANY', group: 'Formation', targetRecordType: 'contractClause' },
  { key: 'negotiation', label: 'Create negotiation point', owner: 'ANY', group: 'Formation', targetRecordType: 'contractNegotiation' },
  { key: 'owner-approval', label: 'Complete owner approval', owner: 'BUYER', group: 'Formation', targetRecordType: 'workflowApproval' },
  { key: 'signature-request', label: 'Signature request', owner: 'BUYER', group: 'Formation', targetRecordType: 'contractSignature' },
  { key: 'sign-buyer', label: 'Sign BUYER', owner: 'BUYER', group: 'Formation', targetRecordType: 'contractSignature' },
  { key: 'sign-supplier', label: 'Sign SUPPLIER', owner: 'SUPPLIER', group: 'Formation', targetRecordType: 'contractSignature' },
  { key: 'cmp', label: 'Maintain CMP', owner: 'BUYER', group: 'Post-award', targetRecordType: 'contractManagementPlan' },
  { key: 'deliverable', label: 'Submit deliverable', owner: 'SUPPLIER', group: 'Delivery', targetRecordType: 'contractDeliverable' },
  { key: 'inspection', label: 'Record inspection', owner: 'BUYER', group: 'Inspections', targetRecordType: 'contractInspection' },
  { key: 'invoice', label: 'Submit invoice', owner: 'SUPPLIER', group: 'Payments', targetRecordType: 'invoice' },
  { key: 'payment-approval', label: 'Approve payment', owner: 'BUYER', group: 'Payments', targetRecordType: 'paymentApproval' },
  { key: 'variation', label: 'Record variation', owner: 'ANY', group: 'Changes', targetRecordType: 'contractVariation' },
  { key: 'termination', label: 'Manage termination', owner: 'BUYER', group: 'Termination', targetRecordType: 'contractTermination' },
  { key: 'closeout', label: 'Close out contract', owner: 'BUYER', group: 'Close-out', targetRecordType: 'contractCloseout' },
  { key: 'performance', label: 'Score supplier performance', owner: 'BUYER', group: 'Performance', targetRecordType: 'supplierPerformance' },
  { key: 'risk-forecast', label: 'Record risk forecast', owner: 'BUYER', group: 'Risk oversight', targetRecordType: 'riskForecast' },
  { key: 'admin-supplier-risk-profile', label: 'Maintain admin supplier risk profile', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'supplierRiskProfile' },
  { key: 'supplier-risk-profile', label: 'Update supplier risk profile', owner: 'BUYER', group: 'Performance', targetRecordType: 'supplierRiskProfile' },
  { key: 'collusion-alert', label: 'Record collusion alert', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'collusionAlert' },
  { key: 'compliance-review', label: 'Open compliance review', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'complianceReview' },
  { key: 'violation-case', label: 'Record violation case', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'violationCase' },
  { key: 'violation-evidence', label: 'Attach violation evidence', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'violationEvidence' },
  { key: 'enforcement-record', label: 'Record enforcement action', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'enforcementRecord' },
  { key: 'appeal-record', label: 'Record appeal', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'appealRecord' },
  { key: 'trust-tier-adjustment', label: 'Adjust trust tier', owner: 'ADMIN', group: 'Compliance oversight', targetRecordType: 'trustTierAdjustment' }
];

export function actionDefinitionForTitle(title: string) {
  const normalized = title.toLowerCase();
  return awardContractActionCatalogue.find((item) => normalized.includes(item.key.replace(/-/g, ' ')) || normalized.includes(item.label.toLowerCase()));
}
