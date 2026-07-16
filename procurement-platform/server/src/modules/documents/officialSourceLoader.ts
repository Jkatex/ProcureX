import { compactRows, formatValue, money, row, type OfficialSourceSnapshot } from './officialDocumentBuilder.js';
import type { OfficialDocumentGenerateInput, OfficialProcurementType } from './types.js';
import { requestError } from '../shared/apiErrors.js';

type OfficialSourceDb = Record<string, any>;

export async function loadOfficialSource(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const key = normalizeEntityType(input.sourceEntityType);
  if (key === 'tender') return loadTender(db, input);
  if (key === 'tenderamendment' || key === 'amendment') return loadTenderAmendment(db, input);
  if (key === 'procurementplan' || key === 'plan') return loadProcurementPlan(db, input);
  if (key === 'procurementplanline' || key === 'planline') return loadProcurementPlanLine(db, input);
  if (key === 'bid') return loadBid(db, input);
  if (key === 'evaluationworkspace' || key === 'evaluation') return loadEvaluationWorkspace(db, input);
  if (key === 'awardrecommendation' || key === 'recommendation') return loadAwardRecommendation(db, input);
  if (key === 'awardnotice' || key === 'notice') return loadAwardNotice(db, input);
  if (key === 'awardresponse' || key === 'response') return loadAwardResponse(db, input);
  if (key === 'contract') return loadContract(db, input);
  if (key === 'purchaseorder' || key === 'po') return loadPurchaseOrder(db, input);
  if (key === 'invoice') return loadInvoice(db, input);
  if (key === 'documentobject' || key === 'document') return loadDocumentObject(db, input);
  throw requestError(`Official document source type "${input.sourceEntityType}" is not supported yet.`, 400);
}

async function loadTender(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const tender = await db.tender.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: {
      buyerOrg: { select: { id: true, name: true } },
      categories: true,
      requirementRows: true,
      milestones: true,
      commercialItems: true,
      documents: { include: { document: true } },
      amendments: true
    }
  });
  if (!tender) throw requestError('Tender was not found.', 404);
  const procurementType = input.procurementType ?? tenderTypeToProcurementType(tender.type);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: tender.buyerOrgId,
    visibleOrgIds: [tender.buyerOrgId],
    publicVisible: tender.visibility !== 'PRIVATE',
    ownerName: tender.buyerOrg?.name,
    title: tender.title,
    reference: tender.reference,
    documentStatus: tender.status,
    procurementType,
    closingDate: tender.closingDate,
    tenderReference: tender.reference,
    amount: tender.budget,
    currency: tender.currency,
    description: tender.description,
    method: tender.method,
    location: tender.location,
    items: compactRows([
      ...tender.commercialItems.map((item: any, index: number) =>
        row(item.itemNo || `Commercial item ${index + 1}`, `${item.description}; quantity ${formatValue(item.quantity)} ${formatValue(item.unit)}; rate ${money(item.rate, tender.currency)}; total ${money(item.total, tender.currency)}`)
      ),
      ...tender.requirementRows.map((requirement: any) => row(requirement.section, requirement.payload))
    ]),
    documents: tender.documents.map((documentLink: any) =>
      row(documentLink.label || documentLink.document?.documentType || 'Tender document', `${documentLink.document?.name || 'Document'}; checksum ${documentLink.document?.checksum || 'not recorded'}`)
    ),
    timeline: compactRows([
      row('Published at', tender.publishedAt),
      row('Closing date', tender.closingDate),
      ...tender.milestones.map((milestone: any) => row(milestone.name, `${formatValue(milestone.dueDate)}; ${formatValue(milestone.payload)}`)),
      ...tender.amendments.map((amendment: any) => row(`Amendment ${amendment.reference}`, `${amendment.title}; ${amendment.status}; ${formatValue(amendment.publishedAt)}`))
    ]),
    workflow: compactRows([
      row('Visibility', tender.visibility),
      row('Contract type', tender.contractType),
      row('Categories', tender.categories.map((category: any) => category.name || category.type))
    ]),
    criteria: jsonRows('Tender requirement', tender.requirements),
    raw: objectSummary(tender, ['requirements', 'metadata'])
  };
}

async function loadTenderAmendment(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const amendment = await db.tenderAmendment.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: { tender: { include: { buyerOrg: { select: { id: true, name: true } } } }, buyerOrg: { select: { id: true, name: true } } }
  });
  if (!amendment) throw requestError('Tender amendment was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: amendment.buyerOrgId,
    visibleOrgIds: [amendment.buyerOrgId],
    publicVisible: amendment.tender?.visibility !== 'PRIVATE',
    ownerName: amendment.buyerOrg?.name ?? amendment.tender?.buyerOrg?.name,
    title: amendment.title,
    reference: amendment.reference,
    documentStatus: amendment.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(amendment.tender?.type),
    tenderReference: amendment.tender?.reference,
    description: amendment.summary,
    timeline: compactRows([row('Published at', amendment.publishedAt), row('Created at', amendment.createdAt), row('Updated at', amendment.updatedAt)]),
    workflow: jsonRows('Amendment payload', amendment.payload),
    raw: objectSummary(amendment, ['payload'])
  };
}

async function loadProcurementPlan(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const plan = await db.procurementPlan.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId, 'name'),
    include: { ownerOrg: { select: { id: true, name: true } }, lines: { include: { tender: true } } }
  });
  if (!plan) throw requestError('Procurement plan was not found.', 404);
  const reference = `${plan.financialYear}-${plan.name}`.replace(/\s+/g, '-');
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: plan.ownerOrgId,
    visibleOrgIds: [plan.ownerOrgId],
    ownerName: plan.ownerOrg?.name,
    title: plan.name,
    reference,
    documentStatus: plan.status,
    procurementType: 'NOT_APPLICABLE',
    financialYear: plan.financialYear,
    currency: plan.currency,
    items: plan.lines.map((line: any, index: number) =>
      row(`${index + 1}. ${line.tenderTitle}`, `Category: ${line.category}; method: ${line.procurementMethod}; budget: ${money(line.budget, plan.currency)}; source of funds: ${line.sourceOfFunds}; status: ${line.status}; state: ${line.planState}`)
    ),
    timeline: plan.lines.flatMap((line: any, index: number) => [
      row(`Line ${index + 1} opening`, line.openingDate),
      row(`Line ${index + 1} closing`, line.closingDate),
      row(`Line ${index + 1} expected completion`, line.expectedCompletionDate)
    ]),
    workflow: jsonRows('Plan metadata', plan.metadata),
    raw: objectSummary(plan, ['metadata'])
  };
}

async function loadProcurementPlanLine(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const line = await db.procurementPlanLine.findFirst({
    where: idWhere(input.sourceEntityId),
    include: { plan: { include: { ownerOrg: { select: { id: true, name: true } } } }, tender: true }
  });
  if (!line) throw requestError('Procurement plan line was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: line.plan.ownerOrgId,
    visibleOrgIds: [line.plan.ownerOrgId],
    ownerName: line.plan.ownerOrg?.name,
    title: line.tenderTitle,
    reference: line.tender?.reference ?? line.id,
    documentStatus: line.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(line.tender?.type),
    financialYear: line.plan.financialYear,
    tenderReference: line.tender?.reference,
    amount: line.budget,
    currency: line.plan.currency,
    description: line.notes,
    method: line.procurementMethod,
    items: compactRows([
      row('Category', line.category),
      row('Source of funds', line.sourceOfFunds),
      row('Planning state', line.planState),
      ...jsonRows('Custom value', line.customValues)
    ]),
    timeline: compactRows([row('Opening date', line.openingDate), row('Closing date', line.closingDate), row('Expected completion', line.expectedCompletionDate)]),
    raw: objectSummary(line, ['metadata'])
  };
}

async function loadBid(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const bid = await db.bid.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: {
      tender: { include: { buyerOrg: { select: { id: true, name: true } } } },
      buyerOrg: { select: { id: true, name: true } },
      supplierOrg: { select: { id: true, name: true } },
      versions: true,
      documents: { include: { document: true } },
      responses: true,
      samples: true,
      receipt: true
    }
  });
  if (!bid) throw requestError('Bid was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: bid.buyerOrgId,
    visibleOrgIds: [bid.buyerOrgId, bid.supplierOrgId],
    ownerName: bid.buyerOrg?.name ?? bid.tender?.buyerOrg?.name,
    title: `${humanDocumentName(input.documentType)} - ${bid.reference}`,
    reference: bid.receipt?.receiptRef ?? bid.reference,
    documentStatus: bid.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(bid.tender?.type),
    tenderReference: bid.tender?.reference,
    supplierName: bid.supplierOrg?.name,
    amount: bid.totalAmount,
    currency: bid.currency,
    closingDate: bid.tender?.closingDate,
    description: bid.tender?.title,
    items: compactRows([
      ...bid.responses.map((response: any) => row(response.requirementKey, response.response)),
      ...bid.samples.map((sample: any) => row(sample.sampleName, `Related item: ${formatValue(sample.relatedItem)}; quantity: ${formatValue(sample.quantity)}; status: ${sample.trackingStatus}`))
    ]),
    documents: bid.documents.map((documentLink: any) =>
      row(documentLink.envelope, `${documentLink.document?.name || 'Bid document'}; review ${documentLink.reviewStatus}; checksum ${documentLink.document?.checksum || 'not recorded'}`)
    ),
    timeline: compactRows([row('Submitted at', bid.submittedAt), row('Created at', bid.createdAt), row('Updated at', bid.updatedAt)]),
    workflow: compactRows([
      row('Receipt hash', bid.receipt?.receiptHash),
      ...bid.versions.map((version: any) => row(`Version ${version.versionNo} ${version.envelope}`, version.sealedHash || version.payload))
    ]),
    raw: objectSummary(bid, ['payload'])
  };
}

async function loadEvaluationWorkspace(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const workspace = await db.evaluationWorkspace.findFirst({
    where: idWhere(input.sourceEntityId, 'tenderId'),
    include: {
      buyerOrg: { select: { id: true, name: true } },
      tender: { include: { buyerOrg: { select: { id: true, name: true } }, bids: { include: { supplierOrg: { select: { id: true, name: true } } } } } },
      criteria: true,
      scores: { include: { criterion: true, bid: { include: { supplierOrg: { select: { id: true, name: true } } } } } },
      recommendations: true
    }
  });
  if (!workspace) throw requestError('Evaluation workspace was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: workspace.buyerOrgId,
    visibleOrgIds: [workspace.buyerOrgId],
    ownerName: workspace.buyerOrg?.name ?? workspace.tender?.buyerOrg?.name,
    title: `${humanDocumentName(input.documentType)} - ${workspace.tender?.title ?? workspace.id}`,
    reference: workspace.tender?.reference ?? workspace.id,
    documentStatus: workspace.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(workspace.tender?.type),
    tenderReference: workspace.tender?.reference,
    closingDate: workspace.tender?.closingDate,
    description: workspace.tender?.description,
    criteria: workspace.criteria.map((criterion: any) => row(`${criterion.stage} - ${criterion.name}`, `Weight ${formatValue(criterion.weight)}; max score ${formatValue(criterion.maxScore)}; ${formatValue(criterion.payload)}`)),
    items: workspace.scores.map((score: any) =>
      row(score.bid?.supplierOrg?.name || score.bid?.reference || 'Bid score', `${score.criterion?.name || 'Criterion'}: ${formatValue(score.score)}; ${formatValue(score.comment)}`)
    ),
    workflow: compactRows([
      row('Current stage', workspace.currentStage),
      row('Progress', `${workspace.progress}%`),
      row('Bids received', workspace.tender?.bids?.length),
      ...workspace.recommendations.map((recommendation: any) => row(`Recommendation ${recommendation.reference}`, `${recommendation.status}; ${money(recommendation.amount, recommendation.currency)}; ${formatValue(recommendation.reason)}`))
    ]),
    raw: objectSummary(workspace, ['payload'])
  };
}

async function loadAwardRecommendation(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const recommendation = await db.awardRecommendation.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: {
      workspace: { include: { tender: { include: { buyerOrg: { select: { id: true, name: true } } } }, buyerOrg: { select: { id: true, name: true } } } },
      awardGroup: { include: { winners: true } },
      bid: { include: { supplierOrg: { select: { id: true, name: true } } } },
      approvals: true,
      notice: true
    }
  });
  if (!recommendation) throw requestError('Award recommendation was not found.', 404);
  const tender = recommendation.workspace?.tender;
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: recommendation.workspace?.buyerOrgId,
    visibleOrgIds: [recommendation.workspace?.buyerOrgId, recommendation.supplierOrgId].filter(Boolean),
    ownerName: recommendation.workspace?.buyerOrg?.name ?? tender?.buyerOrg?.name,
    title: `${humanDocumentName(input.documentType)} - ${recommendation.reference}`,
    reference: recommendation.reference,
    documentStatus: recommendation.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(tender?.type),
    tenderReference: tender?.reference,
    supplierName: recommendation.bid?.supplierOrg?.name,
    amount: recommendation.amount,
    currency: recommendation.currency,
    description: recommendation.reason,
    items: compactRows([
      row('Award group', recommendation.awardGroup?.title),
      ...(recommendation.awardGroup?.winners ?? []).map((winner: any) => row(`Winner ${winner.id}`, `${money(winner.amount, winner.currency)}; status ${winner.status}`))
    ]),
    approvals: recommendation.approvals.map((approval: any) => row(approval.assignment, `${approval.status}; action ${formatValue(approval.action)}; decided ${formatValue(approval.decidedAt)}`)),
    workflow: compactRows([row('Notice reference', recommendation.notice?.reference), row('Notice status', recommendation.notice?.status)]),
    raw: objectSummary(recommendation, ['payload'])
  };
}

async function loadAwardNotice(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const notice = await db.awardNotice.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: {
      buyerOrg: { select: { id: true, name: true } },
      supplierOrg: { select: { id: true, name: true } },
      recommendation: { include: { workspace: { include: { tender: true } } } },
      responses: true,
      contract: true
    }
  });
  if (!notice) throw requestError('Award notice was not found.', 404);
  const tender = notice.recommendation?.workspace?.tender;
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: notice.buyerOrgId,
    visibleOrgIds: [notice.buyerOrgId, notice.supplierOrgId],
    ownerName: notice.buyerOrg?.name,
    title: `${humanDocumentName(input.documentType)} - ${notice.reference}`,
    reference: notice.reference,
    documentStatus: notice.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(tender?.type),
    tenderReference: tender?.reference,
    contractReference: notice.contract?.reference,
    supplierName: notice.supplierOrg?.name,
    description: notice.buyerNote ?? notice.supplierNote,
    timeline: compactRows([row('Issued at', notice.issuedAt), row('Responded at', notice.respondedAt)]),
    workflow: notice.responses.map((response: any) => row(response.action, `${formatValue(response.note)}; created ${formatValue(response.createdAt)}`)),
    raw: objectSummary(notice, ['payload'])
  };
}

async function loadAwardResponse(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const response = await db.awardResponse.findFirst({
    where: idWhere(input.sourceEntityId),
    include: {
      actorOrg: { select: { id: true, name: true } },
      notice: {
        include: {
          buyerOrg: { select: { id: true, name: true } },
          supplierOrg: { select: { id: true, name: true } },
          recommendation: { include: { workspace: { include: { tender: true } } } }
        }
      }
    }
  });
  if (!response) throw requestError('Award response was not found.', 404);
  const tender = response.notice?.recommendation?.workspace?.tender;
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: response.notice?.buyerOrgId,
    visibleOrgIds: [response.notice?.buyerOrgId, response.notice?.supplierOrgId, response.actorOrgId].filter(Boolean),
    ownerName: response.notice?.buyerOrg?.name,
    title: `${humanDocumentName(input.documentType)} - ${response.notice?.reference ?? response.id}`,
    reference: response.notice?.reference ?? response.id,
    documentStatus: response.action,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(tender?.type),
    tenderReference: tender?.reference,
    supplierName: response.notice?.supplierOrg?.name ?? response.actorOrg?.name,
    description: response.note,
    timeline: compactRows([row('Response created', response.createdAt)]),
    workflow: jsonRows('Response payload', response.payload),
    raw: objectSummary(response, ['payload'])
  };
}

async function loadContract(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const contract = await db.contract.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: {
      buyerOrg: { select: { id: true, name: true } },
      supplierOrg: { select: { id: true, name: true } },
      tender: true,
      award: true,
      parties: true,
      clauses: true,
      negotiations: true,
      versions: { include: { document: true } },
      signatures: true,
      milestones: true,
      deliverables: true,
      acceptances: true,
      variations: true,
      purchaseOrders: true,
      invoices: true,
      closeout: true
    }
  });
  if (!contract) throw requestError('Contract was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: contract.buyerOrgId,
    visibleOrgIds: [contract.buyerOrgId, contract.supplierOrgId].filter(Boolean),
    ownerName: contract.buyerOrg?.name,
    title: contract.title,
    reference: contract.reference,
    documentStatus: contract.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(contract.tender?.type),
    tenderReference: contract.tender?.reference,
    contractReference: contract.reference,
    supplierName: contract.supplierOrg?.name,
    amount: contract.amount,
    currency: contract.currency,
    description: contract.tender?.title ?? contract.award?.reason,
    items: compactRows([
      ...contract.parties.map((party: any) => row(`${party.role} party`, `${party.displayName}; contact ${formatValue(party.contactName)}; signatory ${formatValue(party.signatoryName)}`)),
      ...contract.clauses.map((clause: any) => row(clause.title, `${clause.category}; ${clause.status}; ${formatValue(clause.body)}`)),
      ...contract.milestones.map((milestone: any) => row(milestone.title, `${milestone.status}; due ${formatValue(milestone.dueDate)}; amount ${money(milestone.amount, milestone.currency)}`)),
      ...contract.deliverables.map((deliverable: any) => row(deliverable.title, `${deliverable.status}; due ${formatValue(deliverable.dueDate)}`)),
      ...contract.purchaseOrders.map((purchaseOrder: any) => row(`Purchase order ${purchaseOrder.reference}`, money(purchaseOrder.amount, purchaseOrder.currency))),
      ...contract.invoices.map((invoice: any) => row(`Invoice ${invoice.reference}`, `${invoice.status}; ${money(invoice.amount, invoice.currency)}`))
    ]),
    documents: contract.versions.map((version: any) => row(`Contract version ${version.versionNo}`, `${version.document?.name || 'No document object'}; checksum ${version.document?.checksum || 'not recorded'}`)),
    timeline: compactRows([
      row('Created at', contract.createdAt),
      row('Updated at', contract.updatedAt),
      row('Closeout status', contract.closeout?.status),
      row('Closeout updated at', contract.closeout?.updatedAt)
    ]),
    workflow: compactRows([
      ...contract.negotiations.map((negotiation: any) => row(negotiation.subject, `${negotiation.status}; ${formatValue(negotiation.position)}; ${formatValue(negotiation.counterOffer)}`)),
      ...contract.variations.map((variation: any) => row(variation.title || variation.id, `${variation.status}; ${formatValue(variation.reason)}; impact ${money(variation.costImpact, contract.currency)}`)),
      ...contract.acceptances.map((acceptance: any) => row(acceptance.reference || acceptance.id, `${acceptance.status}; accepted ${formatValue(acceptance.acceptedAt)}`))
    ]),
    signatures: contract.signatures.map((signature: any) => row(signature.role, `${signature.status}; signer ${formatValue(signature.signerName)}; signed ${formatValue(signature.signedAt)}; hash ${formatValue(signature.signatureHash)}`)),
    raw: objectSummary(contract, ['payload'])
  };
}

async function loadPurchaseOrder(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const purchaseOrder = await db.purchaseOrder.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: { buyerOrg: { select: { id: true, name: true } }, contract: { include: { buyerOrg: true, supplierOrg: true, tender: true } }, invoices: true }
  });
  if (!purchaseOrder) throw requestError('Purchase order was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: purchaseOrder.buyerOrgId,
    visibleOrgIds: [purchaseOrder.buyerOrgId, purchaseOrder.contract?.supplierOrgId].filter(Boolean),
    ownerName: purchaseOrder.buyerOrg?.name,
    title: `Purchase Order ${purchaseOrder.reference}`,
    reference: purchaseOrder.reference,
    documentStatus: 'ISSUED',
    procurementType: input.procurementType ?? tenderTypeToProcurementType(purchaseOrder.contract?.tender?.type),
    tenderReference: purchaseOrder.contract?.tender?.reference,
    contractReference: purchaseOrder.contract?.reference,
    supplierName: purchaseOrder.contract?.supplierOrg?.name,
    amount: purchaseOrder.amount,
    currency: purchaseOrder.currency,
    items: compactRows([row('Purchase order payload', purchaseOrder.payload), ...purchaseOrder.invoices.map((invoice: any) => row(`Invoice ${invoice.reference}`, `${invoice.status}; ${money(invoice.amount, invoice.currency)}`))]),
    timeline: compactRows([row('Created at', purchaseOrder.createdAt)]),
    raw: objectSummary(purchaseOrder, ['payload'])
  };
}

async function loadInvoice(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const invoice = await db.invoice.findFirst({
    where: idOrReferenceWhere(input.sourceEntityId),
    include: {
      buyerOrg: { select: { id: true, name: true } },
      supplierOrg: { select: { id: true, name: true } },
      purchaseOrder: true,
      contract: { include: { tender: true, buyerOrg: true, supplierOrg: true } }
    }
  });
  if (!invoice) throw requestError('Invoice was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: invoice.buyerOrgId,
    visibleOrgIds: [invoice.buyerOrgId, invoice.supplierOrgId].filter(Boolean),
    ownerName: invoice.buyerOrg?.name,
    title: `Invoice and Payment Certificate ${invoice.reference}`,
    reference: invoice.reference,
    documentStatus: invoice.status,
    procurementType: input.procurementType ?? tenderTypeToProcurementType(invoice.contract?.tender?.type),
    tenderReference: invoice.contract?.tender?.reference,
    contractReference: invoice.contract?.reference,
    supplierName: invoice.supplierOrg?.name ?? invoice.contract?.supplierOrg?.name,
    amount: invoice.amount,
    currency: invoice.currency,
    items: compactRows([row('Invoice payload', invoice.payload), row('Purchase order', invoice.purchaseOrder?.reference)]),
    timeline: compactRows([row('Created at', invoice.createdAt)]),
    raw: objectSummary(invoice, ['payload'])
  };
}

async function loadDocumentObject(db: OfficialSourceDb, input: OfficialDocumentGenerateInput): Promise<OfficialSourceSnapshot> {
  const document = await db.documentObject.findFirst({ where: idWhere(input.sourceEntityId) });
  if (!document) throw requestError('Document object was not found.', 404);
  return {
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    ownerOrgId: document.ownerOrgId,
    visibleOrgIds: [document.ownerOrgId].filter(Boolean),
    ownerName: 'Recorded organization',
    title: document.name,
    reference: document.objectKey,
    documentStatus: 'RECORDED',
    procurementType: input.procurementType ?? 'MIXED',
    documents: [row(document.documentType, `${document.name}; checksum ${document.checksum || 'not recorded'}`)],
    workflow: jsonRows('Document metadata', document.metadata),
    raw: objectSummary(document, ['metadata'])
  };
}

function tenderTypeToProcurementType(value: unknown): OfficialProcurementType {
  if (value === 'GOODS') return 'GOODS';
  if (value === 'WORKS') return 'WORKS';
  if (value === 'CONSULTANCY') return 'CONSULTANCY';
  if (value === 'SERVICE') return 'NON_CONSULTANCY';
  return 'MIXED';
}

function jsonRows(prefix: string, value: unknown) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => isMeaningful(child))
    .slice(0, 24)
    .map(([key, child]) => row(`${prefix}: ${humanize(key)}`, child));
}

function objectSummary(value: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]).filter(([, child]) => isMeaningful(child)));
}

function idOrReferenceWhere(value: string, referenceField = 'reference') {
  return isUuid(value) ? { OR: [{ id: value }, { [referenceField]: value }] } : { [referenceField]: value };
}

function idWhere(value: string, alternateUuidField?: string) {
  if (!isUuid(value)) throw requestError('Source entity id must be a UUID for this source type.', 400);
  return alternateUuidField ? { OR: [{ id: value }, { [alternateUuidField]: value }] } : { id: value };
}

function normalizeEntityType(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function humanDocumentName(value: string) {
  return humanize(value.toLowerCase());
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (typeof value === 'object' && 'toString' in value && value.constructor?.name === 'Decimal') return String(value).trim() !== '';
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(isMeaningful);
  return String(value).trim() !== '';
}
