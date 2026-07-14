// Buyer-side award workflow after evaluation completion.

const PXAwardUtils = window.ProcureXShared || {};
const escapeAwardRecommendationHtml = PXAwardUtils.escapeHtml || ((value = '') => String(value));
const formatAwardRecommendationMoney = PXAwardUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const formatAwardRecommendationDate = PXAwardUtils.formatDate || ((value = '') => value || '-');
const renderAwardRecommendationBadge = PXAwardUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapeAwardRecommendationHtml(value)}</span>`);

const awardWorkflowSteps = [
    { id: 'evaluation-result', title: 'Recommendation', shortTitle: 'Recommendation', meta: 'Recommended supplier, source documents, and ranked bids' },
    { id: 'award-decision', title: 'Award details', shortTitle: 'Award details', meta: 'Supplier, amount, reason, and confirmation' },
    { id: 'award-notification', title: 'Send notices', shortTitle: 'Notices', meta: 'Messages and bidder deadlines' },
    { id: 'standstill-period', title: 'Waiting period and complaints', shortTitle: 'Waiting period', meta: 'Dates and complaint status' },
    { id: 'supplier-acceptance', title: 'Supplier response', shortTitle: 'Response', meta: 'Accept, decline, or edit decision' },
    { id: 'pre-contract-documents', title: 'Required documents', shortTitle: 'Documents', meta: 'Uploads needed before signing' },
    { id: 'draft-contract', title: 'Contract readiness', shortTitle: 'Contract', meta: 'Generate only after blockers clear' }
];

function normalizeAwardStep(step = '') {
    if (step === 'notice') return 'award-notification';
    if (step === 'evaluation-results') return 'evaluation-result';
    if (step === 'approval') return 'award-decision';
    return awardWorkflowSteps.some(item => item.id === step) ? step : 'evaluation-result';
}

function getAwardRecommendationStepState(stepId, currentStep) {
    const order = awardWorkflowSteps.map(step => step.id);
    const currentIndex = Math.max(0, order.indexOf(normalizeAwardStep(currentStep)));
    const index = order.indexOf(stepId);
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
}

function renderAwardWizardProgress(steps, currentStep) {
    return `
        <nav class="wizard-step-progress award-step-progress" aria-label="Award workflow progress">
            ${steps.map((step, index) => {
                const state = getAwardRecommendationStepState(step.id, currentStep);
                return `
                    <button class="wizard-progress-step ${state === 'active' ? 'active' : ''} ${state === 'completed' ? 'completed' : ''}" type="button" data-award-step-index="${index}" aria-current="${state === 'active' ? 'step' : 'false'}">
                        <strong>${String(index + 1).padStart(2, '0')}</strong>
                        <span>${escapeAwardRecommendationHtml(step.shortTitle)}</span>
                    </button>
                `;
            }).join('')}
        </nav>
    `;
}

function renderAwardRecommendationRows(rows = []) {
    return rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
}

function getStandstillStatus(award = {}) {
    const now = new Date();
    const start = award.standstillStart ? new Date(award.standstillStart) : null;
    const end = award.standstillEnd ? new Date(award.standstillEnd) : null;
    const unresolvedComplaint = award.complaintsReceived && award.complaintsReceived !== 'None' && !award.complaintsResolved;
    const hasValidWindow = Boolean(start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));
    const durationDays = hasValidWindow ? Math.max(0, Math.ceil((end - start) / 86400000)) : 0;
    const active = hasValidWindow && now >= start && now <= end;
    const completed = hasValidWindow && now > end;
    const daysRemaining = hasValidWindow
        ? active
            ? Math.max(0, Math.ceil((end - now) / 86400000))
            : completed
                ? 0
                : durationDays
        : 0;
    const blocked = !completed || unresolvedComplaint;
    return { start, end, active, completed, blocked, unresolvedComplaint, durationDays, daysRemaining };
}

function renderAwardFieldError(message) {
    return `<small class="field-error" aria-live="polite">${escapeAwardRecommendationHtml(message)}</small>`;
}

function renderAwardFieldHint(message) {
    return `<small class="field-hint">${escapeAwardRecommendationHtml(message)}</small>`;
}

function renderAwardRequiredMarker() {
    return '<em class="required-marker" aria-label="required">*</em>';
}

function renderAwardCheck(label, complete) {
    return `
        <li class="${complete ? 'complete' : 'blocked'}">
            <span>${complete ? 'OK' : '!'}</span>
            <strong>${escapeAwardRecommendationHtml(label)}</strong>
        </li>
    `;
}

function renderDocumentStatusBadge(status = '') {
    return renderAwardRecommendationBadge(status || 'Missing');
}

function getAwardNoticeDrafts(draft = {}, award = {}, tender = {}, selectedSupplier = '') {
    const source = draft.notices?.length ? draft.notices : (award.notices?.length ? award.notices : []);
    if (source.length) {
        return source.map((row, index) => ({
            id: row.id || `notice-${index + 1}`,
            type: row.type || 'Award Notice',
            recipient: row.recipient || row.recipientScope || 'Supplier',
            recipientScope: row.recipientScope || row.recipient || 'Supplier',
            recipientId: row.recipientId || '',
            status: row.status || 'Ready for Communication Center',
            deadline: row.deadline || draft.notification?.responseDeadline || '',
            subject: row.subject || `${row.type || 'Award Notice'} - ${award.reference || draft.tenderReference || tender.reference || ''}`,
            body: row.body || draft.notification?.message || `Notice for ${award.tenderTitle || draft.title || 'this tender'}.`
        }));
    }

    const reference = award.reference || draft.tenderReference || tender.reference || tender.id || 'Tender';
    const title = award.tenderTitle || draft.title || tender.title || reference;
    return [
        {
            id: 'award-notification-selected-supplier',
            type: 'Award Notification',
            recipient: selectedSupplier || 'Selected supplier',
            recipientScope: 'Selected supplier',
            recipientId: 'supplier',
            status: 'Ready for Communication Center',
            deadline: draft.notification?.responseDeadline || '',
            subject: `Award Notification - ${reference}`,
            body: `Your company has been selected for award for ${title}. Please review and respond through ProcureX.`
        },
        {
            id: 'unsuccessful-bidder-notice',
            type: 'Unsuccessful Bidder Notice',
            recipient: 'Unsuccessful bidders',
            recipientScope: 'Unsuccessful bidders',
            recipientId: '',
            status: 'Ready for Communication Center',
            deadline: draft.standstill?.complaintDeadline || award.standstillEnd || '',
            subject: `Tender Result Notice - ${reference}`,
            body: `The buyer has completed evaluation for ${title}. This notice shares the tender result and available next steps.`
        },
        {
            id: 'standstill-intention-notice',
            type: 'Notice of Intention and Standstill',
            recipient: 'All bidders',
            recipientScope: 'All bidders',
            recipientId: '',
            status: 'Ready for Communication Center',
            deadline: draft.standstill?.complaintDeadline || award.standstillEnd || '',
            subject: `Notice of Intention to Award - ${reference}`,
            body: `The buyer intends to award ${title}. Any complaint must be submitted before the buyer-set standstill deadline.`
        }
    ];
}

function renderAwardNoticeComposeButton(row, tenderId = '', reference = '', title = '') {
    const sent = /sent|awaiting response/i.test(row.status || '');
    return `
        <button class="btn ${sent ? 'btn-secondary' : 'btn-primary'} btn-sm" type="button"
            data-award-notice-compose
            data-award-notice-id="${escapeAwardRecommendationHtml(row.id || '')}"
            data-award-notice-type="${escapeAwardRecommendationHtml(row.type || 'Award Notice')}"
            data-award-notice-recipient="${escapeAwardRecommendationHtml(row.recipient || '')}"
            data-award-notice-recipient-id="${escapeAwardRecommendationHtml(row.recipientId || '')}"
            data-award-notice-subject="${escapeAwardRecommendationHtml(row.subject || '')}"
            data-award-notice-body="${escapeAwardRecommendationHtml(row.body || '')}"
            data-award-notice-tender-id="${escapeAwardRecommendationHtml(tenderId || '')}"
            data-award-notice-reference="${escapeAwardRecommendationHtml(reference || '')}"
            data-award-notice-title="${escapeAwardRecommendationHtml(title || '')}">
            ${sent ? 'View in Communication Center' : 'Prepare in Communication Center'}
        </button>
    `;
}

function normalizeAwardDocumentRows(rows = []) {
    return rows.map((row, index) => ({
        id: row.id || `buyer-document-${index + 1}`,
        name: row.name || 'Pre-contract document',
        type: row.type || 'Pre-contract Document',
        owner: row.owner || 'Buyer',
        required: row.required !== false,
        status: row.status || 'Pending Buyer Upload',
        fileName: row.fileName || row.file || '',
        expiryDate: row.expiryDate || ''
    }));
}

function getAwardSourceTenderId(tender = {}, draft = {}, award = {}) {
    if (typeof getAwardContractTenderId === 'function') return getAwardContractTenderId(tender);
    return tender.id || draft.tenderId || draft.tenderReference || award.reference || '';
}

function getAwardEvaluationReference(tender = {}, award = {}, evaluation = {}) {
    return tender.reference || tender.id || award.reference || evaluation.activeTender?.reference || '';
}

function getAwardSafeFilename(value = 'award-document', extension = '.html') {
    const clean = String(value || 'award-document')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'award-document';
    return extension && !clean.toLowerCase().endsWith(extension) ? `${clean}${extension}` : clean;
}

function downloadAwardDocumentHtml(content = '', filename = 'award-document.html') {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openAwardDocumentHtml(content = '', title = 'Award document') {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
        alert('Allow pop-ups to open the document preview.');
        return;
    }
    previewWindow.document.open();
    previewWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeAwardRecommendationHtml(title)}</title></head><body>${content}</body></html>`);
    previewWindow.document.close();
}

function buildAwardBidPreviewHtml(reference = '', bid = {}, index = 0) {
    const rows = [
        ['Tender reference', reference || '-'],
        ['Bidder', bid.supplier || `Bidder ${index + 1}`],
        ['Preliminary result', bid.preliminaryResult || '-'],
        ['Eligibility result', bid.eligibilityResult || '-'],
        ['Final result', bid.finalResult || '-'],
        ['Corrected price', formatAwardRecommendationMoney(bid.financial?.correctedPrice, bid.financial?.currency || 'TZS')],
        ['Submitted documents', (bid.documents || []).join(', ') || 'Submission documents recorded in the evaluation workspace']
    ];
    return `
        <main style="max-width: 820px; margin: 32px auto; font-family: Arial, sans-serif; color: #0f172a;">
            <h1>Submitted Bid Package</h1>
            <p>This preview summarizes the submitted bid information available to the award workflow.</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${rows.map(([label, value]) => `<tr><th style="width: 220px; text-align: left; border: 1px solid #cbd5e1; padding: 10px;">${escapeAwardRecommendationHtml(label)}</th><td style="border: 1px solid #cbd5e1; padding: 10px;">${escapeAwardRecommendationHtml(value)}</td></tr>`).join('')}
                </tbody>
            </table>
        </main>
    `;
}

function getAwardEvaluationReportHtml(reference = '') {
    if (typeof renderEvaluationReportDocument === 'function' && typeof getEvaluationTenderModel === 'function' && typeof getEvaluationBidsForTender === 'function') {
        const tender = getEvaluationTenderModel(reference);
        return renderEvaluationReportDocument(tender, getEvaluationBidsForTender(tender), typeof getEvaluationDraft === 'function' ? (getEvaluationDraft(reference) || {}) : {});
    }
    return `
        <main style="max-width: 820px; margin: 32px auto; font-family: Arial, sans-serif;">
            <h1>Evaluation Report</h1>
            <p>The generated evaluation report renderer is unavailable in this view.</p>
        </main>
    `;
}

function renderAwardSourceButton(sourceType, action, label, attrs = '') {
    return `<button class="btn btn-secondary btn-sm" type="button" data-award-source-document="${escapeAwardRecommendationHtml(sourceType)}" data-award-source-action="${escapeAwardRecommendationHtml(action)}" ${attrs}>${escapeAwardRecommendationHtml(label)}</button>`;
}

function renderAwardSourceDocuments(tender = {}, draft = {}, award = {}, evaluation = {}, rankedBids = []) {
    const tenderId = getAwardSourceTenderId(tender, draft, award);
    const reference = getAwardEvaluationReference(tender, award, evaluation);
    return `
        <section class="award-source-documents" aria-labelledby="award-source-documents-title">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Source documents</span>
                    <h2 id="award-source-documents-title">Tender, bid, and evaluation evidence</h2>
                    <p class="panel-note">Open or download the records used to support the recommendation before confirming the award.</p>
                </div>
            </div>
            <div class="award-source-document-list">
                <article class="award-source-document-row">
                    <div>
                        <strong>Tender Document</strong>
                        <span>${escapeAwardRecommendationHtml(award.tenderTitle || draft.title || tender.title || 'Tender document')}</span>
                    </div>
                    <div class="inline-actions">
                        ${renderAwardSourceButton('tender', 'open', 'Open', `data-award-tender-id="${escapeAwardRecommendationHtml(tenderId)}"`)}
                        ${renderAwardSourceButton('tender', 'download', 'Download', `data-award-tender-id="${escapeAwardRecommendationHtml(tenderId)}"`)}
                    </div>
                </article>
                <details class="award-source-document-row award-bid-document-details" open>
                    <summary>
                        <span>
                            <strong>Bid Documents</strong>
                            <em>${rankedBids.length} submitted bid package${rankedBids.length === 1 ? '' : 's'}</em>
                        </span>
                    </summary>
                    <div class="award-bid-document-list">
                        ${rankedBids.map((bid, index) => `
                            <div class="award-bid-document-row">
                                <div>
                                    <strong>${escapeAwardRecommendationHtml(bid.supplier || `Bidder ${index + 1}`)}</strong>
                                    <span>Rank ${escapeAwardRecommendationHtml(bid.financial?.ranking || '-')} - ${escapeAwardRecommendationHtml(bid.finalResult || 'Evaluated')}</span>
                                </div>
                                <div class="inline-actions">
                                    ${renderAwardSourceButton('bid', 'open', 'Open', `data-award-reference="${escapeAwardRecommendationHtml(reference)}" data-award-bid-index="${index}"`)}
                                    ${renderAwardSourceButton('bid', 'download', 'Download', `data-award-reference="${escapeAwardRecommendationHtml(reference)}" data-award-bid-index="${index}"`)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
                <article class="award-source-document-row">
                    <div>
                        <strong>Evaluation Report</strong>
                        <span>${escapeAwardRecommendationHtml(reference || 'Evaluation report')}</span>
                    </div>
                    <div class="inline-actions">
                        ${renderAwardSourceButton('evaluation', 'open', 'Open', `data-award-reference="${escapeAwardRecommendationHtml(reference)}"`)}
                        ${renderAwardSourceButton('evaluation', 'download', 'Download', `data-award-reference="${escapeAwardRecommendationHtml(reference)}"`)}
                    </div>
                </article>
            </div>
        </section>
    `;
}

function renderAwardStepRow(step, index, currentStep, statusHtml, actionLabel, contentHtml) {
    const state = getAwardRecommendationStepState(step.id, currentStep);
    const open = state === 'active';
    return `
        <article class="award-step-row ${open ? 'active' : ''} ${state === 'completed' ? 'completed' : ''}" data-award-step-row data-award-step-id="${escapeAwardRecommendationHtml(step.id)}">
            <button class="award-step-row-toggle" type="button" data-award-step-index="${index}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="award-step-panel-${escapeAwardRecommendationHtml(step.id)}">
                <span class="award-step-number">${String(index + 1).padStart(2, '0')}</span>
                <span class="award-step-title">
                    <strong>${escapeAwardRecommendationHtml(step.title)}</strong>
                    <em>${escapeAwardRecommendationHtml(step.meta)}</em>
                </span>
                <span class="award-step-meta">
                    ${statusHtml}
                    <small>${escapeAwardRecommendationHtml(actionLabel || 'Review')}</small>
                </span>
                <span class="award-step-chevron" aria-hidden="true">v</span>
            </button>
            <section class="journey-panel ${open ? 'active' : ''}" id="award-step-panel-${escapeAwardRecommendationHtml(step.id)}" data-award-step-panel data-award-step-id="${escapeAwardRecommendationHtml(step.id)}">
                ${contentHtml}
            </section>
        </article>
    `;
}

function renderAwardDetailsSection(title, summary, content, open = false) {
    return `
        <details class="award-simple-details" ${open ? 'open' : ''}>
            <summary>
                <span>
                    <strong>${escapeAwardRecommendationHtml(title)}</strong>
                    <em>${escapeAwardRecommendationHtml(summary)}</em>
                </span>
            </summary>
            <div class="award-simple-details-body">
                ${content}
            </div>
        </details>
    `;
}

function renderAwardMainForm({
    award = {},
    draft = {},
    recommendation = {},
    selectedSupplier = '',
    awardAmount = 0,
    confirmed = false
} = {}) {
    const readonly = confirmed ? 'readonly aria-readonly="true"' : '';
    const disabled = confirmed ? 'disabled aria-disabled="true"' : '';
    return `
        <section class="award-simple-form-panel" aria-labelledby="award-decision-title">
            <div class="award-simple-panel-heading">
                <div>
                    <span class="section-kicker">Award decision</span>
                    <h2 id="award-decision-title">Fill the award details</h2>
                    <p>These fields are the main record used to confirm the award and prepare the contract.</p>
                </div>
                ${renderAwardRecommendationBadge(confirmed ? 'Confirmed' : 'Not confirmed')}
            </div>

            <div class="evaluation-form-grid recommendation-form award-simple-form" data-award-validation-form>
                <label>Selected supplier ${renderAwardRequiredMarker()}
                    <input class="form-input" required ${readonly} data-award-required="Selected supplier" data-award-draft-field="awardDecision.selectedSupplier" value="${escapeAwardRecommendationHtml(selectedSupplier)}" placeholder="Supplier name">
                    ${renderAwardFieldHint('The supplier recommended after evaluation.')}
                </label>
                <label>Award amount ${renderAwardRequiredMarker()}
                    <input class="form-input" required ${readonly} type="number" min="0" data-award-required="Award amount" data-award-draft-field="awardDecision.awardAmount" value="${escapeAwardRecommendationHtml(award.awardAmount || recommendation.amount || awardAmount || '')}" placeholder="Enter award amount">
                    ${renderAwardFieldHint('Use the evaluated final price unless there is an approved correction.')}
                </label>
                <label>Currency ${renderAwardRequiredMarker()}
                    <input class="form-input" required ${readonly} data-award-required="Currency" data-award-draft-field="awardDecision.currency" value="${escapeAwardRecommendationHtml(award.currency || recommendation.currency || 'TZS')}" placeholder="TZS">
                    ${renderAwardFieldHint('Example: TZS, USD, EUR.')}
                </label>
                <label>Award date ${renderAwardRequiredMarker()}
                    <input class="form-input" required ${readonly} type="date" data-award-required="Award date" data-award-draft-field="awardDecision.awardDate" value="${escapeAwardRecommendationHtml(draft.awardDecision?.awardDate || '')}">
                    ${renderAwardFieldHint('The date the buyer confirms this award.')}
                </label>
                <label>Award reason ${renderAwardRequiredMarker()}
                    <textarea class="form-input" required ${readonly} rows="4" data-award-required="Award reason" data-award-draft-field="awardDecision.reason" placeholder="Explain why this supplier is being awarded.">${escapeAwardRecommendationHtml(award.reason || recommendation.reason || '')}</textarea>
                    ${renderAwardFieldHint('Keep it short and clear for approvers and audit review.')}
                </label>
                <label>Conditions before signing
                    <textarea class="form-input" ${readonly} rows="4" data-award-draft-field="awardDecision.conditions" placeholder="Example: Supplier must submit performance security before signing.">${escapeAwardRecommendationHtml(draft.awardDecision?.conditions || recommendation.conditions || '')}</textarea>
                    ${renderAwardFieldHint('Optional conditions the supplier must satisfy before the contract is signed.')}
                </label>
                <label>Negotiation needed?
                    <select class="form-input" ${disabled} data-award-draft-field="awardDecision.negotiationRequired">
                        <option ${draft.awardDecision?.negotiationRequired === 'Yes' ? 'selected' : ''}>Yes</option>
                        <option ${draft.awardDecision?.negotiationRequired === 'No' ? 'selected' : ''}>No</option>
                    </select>
                    ${renderAwardFieldHint('Choose Yes only if contract terms still need discussion.')}
                </label>
                <label>Confirmed by ${renderAwardRequiredMarker()}
                    <input class="form-input" required ${readonly} data-award-required="Confirmed by" data-award-draft-field="awardDecision.confirmedBy" value="${escapeAwardRecommendationHtml(award.confirmation?.confirmedBy || draft.awardDecision?.confirmedBy || 'Buyer authority')}" placeholder="Name or office">
                    ${renderAwardFieldHint('The person or office responsible for confirming the award.')}
                </label>
            </div>

            <fieldset class="award-simple-confirmations">
                <legend>Before confirming</legend>
                <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.coiDeclared" ${draft.awardDecision?.coiDeclared ? 'checked' : ''} ${confirmed ? 'disabled' : ''}> I have no conflict of interest with this supplier.</label>
                <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.basedOnEvaluation" ${draft.awardDecision?.basedOnEvaluation ? 'checked' : ''} ${confirmed ? 'disabled' : ''}> This award follows the completed evaluation.</label>
                <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.fairTreatmentConfirmed" ${draft.awardDecision?.fairTreatmentConfirmed ? 'checked' : ''} ${confirmed ? 'disabled' : ''}> All bidders were treated fairly.</label>
                <label>Declaration by
                    <input class="form-input" ${readonly} data-award-draft-field="awardDecision.coiDeclaredBy" value="${escapeAwardRecommendationHtml(draft.awardDecision?.coiDeclaredBy || award.confirmation?.confirmedBy || '')}" placeholder="Name of declarant">
                </label>
            </fieldset>
        </section>
    `;
}

function renderAwardSimpleSourceDocuments(tender = {}, draft = {}, award = {}, evaluation = {}, rankedBids = []) {
    const tenderId = getAwardSourceTenderId(tender, draft, award);
    const reference = getAwardEvaluationReference(tender, award, evaluation);
    return `
        <div class="award-simple-document-list">
            <article class="award-simple-document-row">
                <div>
                    <strong>Tender document</strong>
                    <span>${escapeAwardRecommendationHtml(award.tenderTitle || draft.title || tender.title || 'Tender document')}</span>
                </div>
                <div class="inline-actions">
                    ${renderAwardSourceButton('tender', 'open', 'Open', `data-award-tender-id="${escapeAwardRecommendationHtml(tenderId)}"`)}
                    ${renderAwardSourceButton('tender', 'download', 'Download', `data-award-tender-id="${escapeAwardRecommendationHtml(tenderId)}"`)}
                </div>
            </article>
            <article class="award-simple-document-row">
                <div>
                    <strong>Evaluation report</strong>
                    <span>${escapeAwardRecommendationHtml(reference || 'Evaluation report')}</span>
                </div>
                <div class="inline-actions">
                    ${renderAwardSourceButton('evaluation', 'open', 'Open', `data-award-reference="${escapeAwardRecommendationHtml(reference)}"`)}
                    ${renderAwardSourceButton('evaluation', 'download', 'Download', `data-award-reference="${escapeAwardRecommendationHtml(reference)}"`)}
                </div>
            </article>
            <div class="award-simple-bid-list">
                ${rankedBids.map((bid, index) => `
                    <article class="award-simple-document-row">
                        <div>
                            <strong>${escapeAwardRecommendationHtml(bid.supplier || `Bidder ${index + 1}`)}</strong>
                            <span>Bid document - rank ${escapeAwardRecommendationHtml(bid.financial?.ranking || '-')}</span>
                        </div>
                        <div class="inline-actions">
                            ${renderAwardSourceButton('bid', 'open', 'Open', `data-award-reference="${escapeAwardRecommendationHtml(reference)}" data-award-bid-index="${index}"`)}
                            ${renderAwardSourceButton('bid', 'download', 'Download', `data-award-reference="${escapeAwardRecommendationHtml(reference)}" data-award-bid-index="${index}"`)}
                        </div>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
}

function renderAwardRecommendation() {
    const context = typeof getAwardContractLifecycleContext === 'function' ? getAwardContractLifecycleContext() : null;
    const lifecycle = mockData.awardingContracts || {};
    const tender = context?.tender || {};
    const draft = context?.draft || {};
    const award = {
        ...(lifecycle.award || {}),
        tenderTitle: draft.title || lifecycle.award?.tenderTitle,
        reference: draft.tenderReference || lifecycle.award?.reference,
        buyer: draft.buyer || lifecycle.award?.buyer,
        procurementType: draft.procurementType || lifecycle.award?.procurementType,
        closingDate: draft.closingDate || lifecycle.award?.closingDate,
        selectedSupplier: draft.awardDecision?.selectedSupplier || lifecycle.award?.selectedSupplier,
        awardAmount: draft.awardDecision?.awardAmount || lifecycle.award?.awardAmount,
        currency: draft.awardDecision?.currency || lifecycle.award?.currency,
        reason: draft.awardDecision?.reason || lifecycle.award?.reason,
        awardStatus: draft.awardStatus || lifecycle.award?.awardStatus,
        confirmation: {
            ...(lifecycle.award?.confirmation || {}),
            confirmedBy: draft.awardDecision?.confirmedBy || lifecycle.award?.confirmation?.confirmedBy || 'Buyer authority',
            date: draft.awardDecision?.awardDate || lifecycle.award?.confirmation?.date,
            status: draft.awardDecision?.confirmed ? 'Confirmed' : 'Draft'
        },
        notices: draft.notices?.length ? draft.notices : (lifecycle.award?.notices || []),
        supplierResponses: lifecycle.award?.supplierResponses || []
    };
    const evaluation = mockData.bidEvaluation || {};
    const bids = evaluation.bids || [];
    const recommendation = evaluation.recommendation || {};
    const criteria = (evaluation.technicalCriteria || []).filter(criterion => !/financial|price/i.test(String(criterion.name || criterion.label || '')));
    const technicalTotal = bid => criteria.reduce((sum, criterion) => sum + Number(bid.technicalScores?.[criterion.id] || 0), 0);
    const rankedBids = bids.slice().sort((a, b) => (a.financial?.ranking || 99) - (b.financial?.ranking || 99));
    const selectedSupplier = award.selectedSupplier || recommendation.supplier || rankedBids[0]?.supplier || 'Recommended supplier';
    const selectedBid = rankedBids.find(bid => bid.supplier === selectedSupplier) || rankedBids[0] || {};
    const nextRankedSupplier = rankedBids.find(bid => bid.supplier !== selectedSupplier)?.supplier || 'Next ranked responsive bidder';
    const selectedRank = Number(selectedBid.financial?.ranking || 0);
    const selectedIsFirstRanked = selectedRank === 1;
    const correctedPrice = Number(selectedBid.financial?.correctedPrice || recommendation.amount || 0);
    const awardAmount = Number(award.awardAmount || recommendation.amount || 0);
    const amountDifference = awardAmount - correctedPrice;
    const amountMismatch = correctedPrice > 0 && Math.abs(amountDifference) > 0;
    const confirmed = Boolean(draft.awardDecision?.confirmed || draft.awardDecision?.approvalConfirmed);
    const awardStandstill = {
        ...award,
        standstillStart: draft.standstill?.startDate || award.standstillStart,
        standstillEnd: draft.standstill?.endDate || award.standstillEnd,
        complaintsReceived: draft.standstill?.complaints?.some(row => !/resolved|closed/i.test(row.status || '')) ? 'Yes' : award.complaintsReceived,
        complaintsResolved: draft.standstill?.complaints?.length ? draft.standstill.complaints.every(row => /resolved|closed/i.test(row.status || '')) : award.complaintsResolved
    };
    const standstill = getStandstillStatus(awardStandstill);
    const standstillRequired = draft.standstill?.required !== false && draft.standstill?.required !== 'false';
    const currentStep = normalizeAwardStep(draft.currentStep || 'evaluation-result');
    const activeStepIndex = Math.max(0, awardWorkflowSteps.findIndex(step => step.id === currentStep));
    const responseDeadline = draft.notification?.responseDeadline || award.notices?.find(row => /award notification/i.test(row.type || ''))?.deadline || award.standstillEnd || '';
    const noticeRows = getAwardNoticeDrafts(draft, award, tender, selectedSupplier);
    const requiredNoticesSent = noticeRows.every(row => /sent|awaiting response/i.test(row.status || ''));
    const supplierDecision = draft.supplierResponse?.decision || '';
    const supplierAccepted = /accepted/i.test(draft.supplierResponse?.status || award.awardStatus || '') || supplierDecision === 'accept' || draft.supplierAccepted;
    const supplierDeclined = /declined/i.test(draft.supplierResponse?.status || '') || supplierDecision === 'decline';
    const supplierResponseStatus = draft.supplierResponse?.status || (supplierAccepted ? 'Award Accepted' : supplierDeclined ? 'Award Declined' : 'Awaiting supplier response');
    const requiredDocuments = normalizeAwardDocumentRows(draft.documents || []);
    const requiredDocumentsApproved = requiredDocuments.length > 0 && requiredDocuments
        .filter(row => row.required !== false)
        .every(row => /uploaded|approved|verified|locked|current/i.test(row.status || ''));
    const readonly = confirmed ? 'readonly aria-readonly="true"' : '';
    const disabled = confirmed ? 'disabled aria-disabled="true"' : '';
    const blockers = [
        { label: 'Award decision confirmed', complete: confirmed },
        { label: 'Required notices sent', complete: requiredNoticesSent },
        { label: 'Standstill clear', complete: !standstillRequired || !standstill.blocked },
        { label: 'No unresolved complaints', complete: !standstill.unresolvedComplaint },
        { label: 'Supplier accepted award', complete: Boolean(supplierAccepted) },
        { label: 'Required pre-contract documents uploaded', complete: requiredDocumentsApproved }
    ];
    const tenderId = getAwardSourceTenderId(tender, draft, award);
    const reference = getAwardEvaluationReference(tender, award, evaluation);

    const recommendationContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 1</span><h2>Recommendation</h2><p class="panel-note">Start from the evaluation recommendation, then confirm the award decision in the next row.</p></div>
            ${renderAwardRecommendationBadge('Recommended')}
        </div>
        <div class="award-recommendation-summary">
            <article><span>Recommended supplier</span><strong>${escapeAwardRecommendationHtml(selectedSupplier)}</strong></article>
            <article><span>Recommended amount</span><strong>${formatAwardRecommendationMoney(awardAmount || recommendation.amount, award.currency || recommendation.currency || 'TZS')}</strong></article>
            <article><span>Evaluation method</span><strong>${escapeAwardRecommendationHtml(recommendation.method || award.procurementMethod || 'Best evaluated responsive bid')}</strong></article>
            <article><span>Contract duration</span><strong>${escapeAwardRecommendationHtml(recommendation.contractDuration || draft.contract?.duration || 'To confirm')}</strong></article>
        </div>
        <div class="award-recommendation-reason">
            <strong>Reasons for recommendation</strong>
            <p>${escapeAwardRecommendationHtml(recommendation.reason || award.reason || 'Recommendation reason is available from the evaluation report.')}</p>
            <span>${escapeAwardRecommendationHtml(recommendation.summary || 'Review the ranked bid table and source documents before confirming the award.')}</span>
        </div>
        ${renderAwardSourceDocuments(tender, draft, award, evaluation, rankedBids)}
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr><th>Rank</th><th>Supplier</th><th>Preliminary</th><th>Eligibility</th><th>Technical</th><th>Corrected Price</th><th>Final Result</th><th>Decision</th></tr></thead>
                <tbody>
                    ${rankedBids.map(bid => `
                        <tr>
                            <td>${renderAwardRecommendationBadge(String(bid.financial?.ranking || '-'))}</td>
                            <td><strong>${escapeAwardRecommendationHtml(bid.supplier)}</strong></td>
                            <td>${escapeAwardRecommendationHtml(bid.preliminaryResult)}</td>
                            <td>${escapeAwardRecommendationHtml(bid.eligibilityResult)}</td>
                            <td>${technicalTotal(bid)}%</td>
                            <td>${formatAwardRecommendationMoney(bid.financial?.correctedPrice, bid.financial?.currency || 'TZS')}</td>
                            <td>${renderAwardRecommendationBadge(bid.finalResult)}</td>
                            <td>${bid.supplier === selectedSupplier ? renderAwardRecommendationBadge('Selected') : 'Responsive'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${!selectedIsFirstRanked ? `
            <div class="evaluation-notice warning">Selected supplier is not the first-ranked bidder. Record the buyer justification before confirming the award decision.</div>
            <div class="evaluation-form-grid recommendation-form award-justification-form">
                <label>Justification option
                    <select class="form-input" data-award-draft-field="awardDecision.rankJustification">
                        ${['First-ranked bidder declined', 'First-ranked bidder failed post-qualification', 'First-ranked bidder failed clarification', 'First-ranked bidder had unresolved compliance issue', 'Documented exception', 'Other reason'].map(option => `<option ${draft.awardDecision?.rankJustification === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                    ${renderAwardFieldHint('Required when the selected supplier is not ranked first.')}
                </label>
                <label>Justification for selecting ${escapeAwardRecommendationHtml(selectedSupplier)}
                    <textarea class="form-input" rows="4" data-award-draft-field="awardDecision.rankJustificationComment" placeholder="Explain why the selected supplier is acceptable for award.">${escapeAwardRecommendationHtml(draft.awardDecision?.rankJustificationComment || '')}</textarea>
                </label>
            </div>
        ` : ''}
    `;

    const awardDecisionContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 2</span><h2>Award Decision</h2><p class="panel-note">Editable fields are shown below. Required fields must be filled before the award can be confirmed.</p></div>
            ${renderAwardRecommendationBadge(confirmed ? 'Confirmed' : award.awardStatus || 'Draft')}
        </div>
        <div class="award-price-comparison">
            <article><span>Evaluated corrected price</span><strong>${formatAwardRecommendationMoney(correctedPrice, award.currency || 'TZS')}</strong></article>
            <article><span>Entered award amount</span><strong>${formatAwardRecommendationMoney(awardAmount, award.currency || 'TZS')}</strong></article>
            <article><span>Difference</span><strong>${formatAwardRecommendationMoney(amountDifference, award.currency || 'TZS')}</strong></article>
            <article>${renderAwardRecommendationBadge(amountMismatch ? 'Requires justification' : 'Aligned')}</article>
        </div>
        <div class="evaluation-form-grid recommendation-form award-decision-form" data-award-validation-form>
            <label>Selected supplier ${renderAwardRequiredMarker()}<input class="form-input" required ${readonly} data-award-required="Selected supplier" data-award-draft-field="awardDecision.selectedSupplier" value="${escapeAwardRecommendationHtml(selectedSupplier)}">${renderAwardFieldError('Required before confirmation')}</label>
            <label>Award amount ${renderAwardRequiredMarker()}<input class="form-input" required ${readonly} type="number" data-award-required="Award amount" data-award-draft-field="awardDecision.awardAmount" value="${escapeAwardRecommendationHtml(award.awardAmount || recommendation.amount || '')}">${renderAwardFieldError('Required before confirmation')}</label>
            <label>Currency ${renderAwardRequiredMarker()}<input class="form-input" required ${readonly} data-award-required="Currency" data-award-draft-field="awardDecision.currency" value="${escapeAwardRecommendationHtml(award.currency || recommendation.currency || 'TZS')}">${renderAwardFieldError('Required before confirmation')}</label>
            <label>Award decision date ${renderAwardRequiredMarker()}<input class="form-input" required ${readonly} type="date" data-award-required="Award decision date" data-award-draft-field="awardDecision.awardDate" value="${escapeAwardRecommendationHtml(draft.awardDecision?.awardDate || '')}">${renderAwardFieldError('Required before confirmation')}</label>
            <label>Award reason ${renderAwardRequiredMarker()}<textarea class="form-input" required ${readonly} rows="4" data-award-required="Award reason" data-award-draft-field="awardDecision.reason">${escapeAwardRecommendationHtml(award.reason || recommendation.reason || '')}</textarea>${renderAwardFieldError('Required before confirmation')}</label>
            <label>Award conditions <textarea class="form-input" ${readonly} rows="4" data-award-draft-field="awardDecision.conditions">${escapeAwardRecommendationHtml(draft.awardDecision?.conditions || recommendation.conditions || '')}</textarea>${renderAwardFieldHint('Optional conditions carried into pre-contract checks.')}</label>
            <label>Negotiation required <select class="form-input" ${disabled} data-award-draft-field="awardDecision.negotiationRequired"><option ${draft.awardDecision?.negotiationRequired === 'Yes' ? 'selected' : ''}>Yes</option><option ${draft.awardDecision?.negotiationRequired === 'No' ? 'selected' : ''}>No</option></select></label>
            <label>Confirmed by ${renderAwardRequiredMarker()}<input class="form-input" required ${readonly} data-award-required="Confirmed by" data-award-draft-field="awardDecision.confirmedBy" value="${escapeAwardRecommendationHtml(award.confirmation?.confirmedBy || 'Buyer authority')}">${renderAwardFieldError('Required before confirmation')}</label>
            ${amountMismatch ? `
                <label>Reason for amount difference <textarea class="form-input" rows="3" data-award-draft-field="awardDecision.amountDifferenceReason">${escapeAwardRecommendationHtml(draft.awardDecision?.amountDifferenceReason || '')}</textarea>${renderAwardFieldHint('Explain any difference from the evaluated corrected price.')}</label>
                <label>Supporting buyer note <input class="form-input" data-award-draft-field="awardDecision.amountSupportDocument" placeholder="Reference the note that explains the difference"></label>
            ` : ''}
        </div>
        <ul class="award-checklist">
            ${[
                ['Evaluation report completed', true],
                ['Selected supplier confirmed', Boolean(selectedSupplier)],
                ['Award amount checked', !amountMismatch || Boolean(draft.awardDecision?.amountDifferenceReason)],
                ['COI declaration completed', Boolean(draft.awardDecision?.coiDeclared && draft.awardDecision?.basedOnEvaluation && draft.awardDecision?.fairTreatmentConfirmed)],
                ['Buyer confirmation ready', Boolean(draft.awardDecision?.confirmedBy || award.confirmation?.confirmedBy)],
                ['Award reason provided', Boolean(award.reason || recommendation.reason)],
                ['Standstill setting prepared', Boolean(draft.standstill || award.standstillStart || award.standstillEnd)],
                ['Notice drafts prepared', noticeRows.length > 0]
            ].map(([label, complete]) => renderAwardCheck(label, complete)).join('')}
        </ul>
        <fieldset class="award-coi-panel">
            <legend>Buyer confirmation</legend>
            <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.coiDeclared" ${draft.awardDecision?.coiDeclared ? 'checked' : ''} ${confirmed ? 'disabled' : ''}> I confirm that I have no personal or financial interest in the selected supplier.</label>
            <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.basedOnEvaluation" ${draft.awardDecision?.basedOnEvaluation ? 'checked' : ''} ${confirmed ? 'disabled' : ''}> I confirm that the award is based on the completed evaluation results.</label>
            <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.fairTreatmentConfirmed" ${draft.awardDecision?.fairTreatmentConfirmed ? 'checked' : ''} ${confirmed ? 'disabled' : ''}> I confirm that bidders were treated consistently.</label>
            <label>Declaration by <input class="form-input" ${readonly} data-award-draft-field="awardDecision.coiDeclaredBy" value="${escapeAwardRecommendationHtml(draft.awardDecision?.coiDeclaredBy || award.confirmation?.confirmedBy || '')}"></label>
        </fieldset>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-decision">Save Draft</button>
            <button class="btn btn-secondary" type="button" data-award-step-index="0">Return to Recommendation</button>
            <button class="btn btn-secondary" type="button" data-award-source-document="evaluation" data-award-source-action="open" data-award-reference="${escapeAwardRecommendationHtml(reference)}">Open Evaluation Report</button>
            <button class="btn btn-primary" type="button" data-award-confirm-decision data-award-confirm-button data-award-save-continue data-award-next-step="award-notification" data-award-required-action="Prepare Notices" ${confirmed ? '' : 'disabled aria-disabled="true"'}>${confirmed ? 'Award Decision Confirmed' : 'Confirm Award Decision'}</button>
        </div>
    `;

    const noticesContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 3</span><h2>Notice preparation</h2><p class="panel-note">Select and fill notice details here, then prepare notices through Communication Center.</p></div>
            ${renderAwardRecommendationBadge(requiredNoticesSent ? 'Notices sent' : 'Communication Center pending')}
        </div>
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr><th>Notice</th><th>Recipient</th><th>Status</th><th>Deadline</th><th>Action</th></tr></thead>
                <tbody data-award-notices-body>${renderAwardRecommendationRows(noticeRows.map(row => [
                    escapeAwardRecommendationHtml(row.type),
                    escapeAwardRecommendationHtml(row.recipient),
                    renderAwardRecommendationBadge(row.status),
                    escapeAwardRecommendationHtml(row.deadline || 'Not set'),
                    renderAwardNoticeComposeButton(row, tenderId, award.reference || draft.tenderReference || '', award.tenderTitle || draft.title || '')
                ]))}</tbody>
            </table>
        </div>
        ${!requiredNoticesSent ? '<div class="evaluation-notice warning">Contract blocked: prepare and send the selected supplier notice plus bidder/standstill notices through Communication Center.</div>' : ''}
        <div class="evaluation-form-grid recommendation-form award-notice-decision-form">
            <label>Notice type
                <select class="form-input" data-award-draft-field="notification.noticeType">
                    ${['Notice of Intention to Award', 'Award Notification', 'Unsuccessful Bidder Notice'].map(option => `<option ${draft.notification?.noticeType === option ? 'selected' : ''}>${option}</option>`).join('')}
                </select>
            </label>
            <label>Recipient scope
                <select class="form-input" data-award-draft-field="notification.recipientScope">
                    ${['All bidders', 'Selected supplier only', 'Unsuccessful bidders only'].map(option => `<option ${draft.notification?.recipientScope === option ? 'selected' : ''}>${option}</option>`).join('')}
                </select>
            </label>
            <label>Delivery method
                <select class="form-input" data-award-draft-field="notification.deliveryMethod">
                    ${['ProcureX portal and email', 'ProcureX portal only', 'Email and physical letter'].map(option => `<option ${draft.notification?.deliveryMethod === option ? 'selected' : ''}>${option}</option>`).join('')}
                </select>
            </label>
            <label>Response deadline <input class="form-input" type="date" data-award-draft-field="notification.responseDeadline" value="${escapeAwardRecommendationHtml(draft.notification?.responseDeadline || '')}"></label>
            <label>Notify unsuccessful bidders <select class="form-input" data-award-draft-field="notification.notifyUnsuccessful"><option ${draft.notification?.notifyUnsuccessful === 'Yes' ? 'selected' : ''}>Yes</option><option ${draft.notification?.notifyUnsuccessful === 'No' ? 'selected' : ''}>No</option></select></label>
            <label>Debrief option <select class="form-input" data-award-draft-field="notification.debriefOption"><option ${draft.notification?.debriefOption === 'Allow debrief requests' ? 'selected' : ''}>Allow debrief requests</option><option ${draft.notification?.debriefOption === 'Do not allow debrief requests' ? 'selected' : ''}>Do not allow debrief requests</option><option ${draft.notification?.debriefOption === 'Debrief by appointment only' ? 'selected' : ''}>Debrief by appointment only</option></select></label>
            <label>Complaint deadline <input class="form-input" type="date" data-award-draft-field="notification.complaintDeadline" value="${escapeAwardRecommendationHtml(draft.standstill?.complaintDeadline || award.standstillEnd || '')}"></label>
            <label>Message to awarded supplier <textarea class="form-input" rows="4" data-award-draft-field="notification.message">${escapeAwardRecommendationHtml(draft.notification?.message || '')}</textarea></label>
        </div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-notification">Save Draft</button>
            <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="standstill-period" data-award-required-action="Monitor Standstill Period">Continue to Standstill</button>
        </div>
    `;

    const standstillContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 4</span><h2>Standstill & Complaints</h2><p class="panel-note">Fill the standstill window and complaint deadline so the contract gate can be evaluated.</p></div>
            ${renderAwardRecommendationBadge(!standstillRequired ? 'Not required' : standstill.blocked ? 'Contract blocked' : 'Window clear')}
        </div>
        <div class="evaluation-form-grid recommendation-form award-standstill-form">
            <label>Standstill required
                <select class="form-input" data-award-draft-field="standstill.required">
                    <option value="true" ${standstillRequired ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!standstillRequired ? 'selected' : ''}>No</option>
                </select>
            </label>
            <label>Start date <input class="form-input" type="date" data-award-draft-field="standstill.startDate" value="${escapeAwardRecommendationHtml(draft.standstill?.startDate || award.standstillStart || '')}"></label>
            <label>End date <input class="form-input" type="date" data-award-draft-field="standstill.endDate" value="${escapeAwardRecommendationHtml(draft.standstill?.endDate || award.standstillEnd || '')}"></label>
            <label>Duration days <input class="form-input" type="number" min="0" data-award-draft-field="standstill.durationDays" value="${escapeAwardRecommendationHtml(draft.standstill?.durationDays || standstill.durationDays || 0)}"></label>
            <label>Complaint deadline <input class="form-input" type="date" data-award-draft-field="standstill.complaintDeadline" value="${escapeAwardRecommendationHtml(draft.standstill?.complaintDeadline || award.standstillEnd || '')}"></label>
            <label>Status <input class="form-input" data-award-draft-field="standstill.status" value="${escapeAwardRecommendationHtml(draft.standstill?.status || 'Buyer configured')}"></label>
        </div>
        <div class="award-control-grid">
            <article><strong>Notice date</strong><span>${formatAwardRecommendationDate(award.noticeDate, 'Not sent')}</span></article>
            <article><strong>Standstill duration</strong><span>${standstillRequired ? standstill.durationDays || 0 : 0} days</span></article>
            <article><strong>Standstill start</strong><span>${formatAwardRecommendationDate(draft.standstill?.startDate || award.standstillStart, 'Not set')}</span></article>
            <article><strong>Standstill end</strong><span>${formatAwardRecommendationDate(draft.standstill?.endDate || award.standstillEnd, 'Not set')}</span></article>
            <article><strong>Days remaining</strong><span>${standstill.daysRemaining}</span></article>
            <article><strong>Contract status</strong>${renderAwardRecommendationBadge(standstillRequired && standstill.blocked ? 'Blocked' : 'Clear')}</article>
        </div>
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr><th>Complaint ID</th><th>Bidder</th><th>Date Received</th><th>Issue</th><th>Status</th><th>Deadline</th><th>Action</th></tr></thead>
                <tbody>
                    ${(draft.standstill?.complaints || []).length ? (draft.standstill.complaints || []).map((row, index) => `
                        <tr>
                            <td>${escapeAwardRecommendationHtml(row.id || `CMP-${index + 1}`)}</td>
                            <td>${escapeAwardRecommendationHtml(row.bidder || '-')}</td>
                            <td>${escapeAwardRecommendationHtml(row.receivedDate || '-')}</td>
                            <td>${escapeAwardRecommendationHtml(row.issue || '-')}</td>
                            <td>${renderAwardRecommendationBadge(row.status || 'Open')}</td>
                            <td>${escapeAwardRecommendationHtml(row.deadline || draft.standstill?.complaintDeadline || '-')}</td>
                            <td><button class="btn btn-secondary btn-sm" type="button">Update</button></td>
                        </tr>
                    `).join('') : '<tr><td colspan="7">No complaints recorded for the standstill period.</td></tr>'}
                </tbody>
            </table>
        </div>
        <div class="evaluation-notice ${standstillRequired && standstill.blocked ? 'warning' : 'success'}">${standstillRequired && standstill.blocked ? 'Draft contract generation is blocked until the buyer-set standstill window closes and any complaints are resolved.' : 'Standstill and complaint conditions are clear for contract generation.'}</div>
    `;

    const acceptanceContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 5</span><h2>Supplier Acceptance</h2><p class="panel-note">Track the supplier response and record fallback action only if the selected supplier declines.</p></div>
            ${renderAwardRecommendationBadge(supplierResponseStatus)}
        </div>
        <div class="award-control-grid">
            <article>
                <strong>Actual supplier response</strong>
                <span data-award-supplier-response-detail>${escapeAwardRecommendationHtml(draft.supplierResponse?.message || draft.supplierResponse?.reason || 'No response recorded yet.')}</span>
                ${renderAwardRecommendationBadge(supplierResponseStatus)}
            </article>
            ${(award.supplierResponses || []).map(row => `
                <article>
                    <strong>${escapeAwardRecommendationHtml(row.action)}</strong>
                    <span>${escapeAwardRecommendationHtml(row.detail)}</span>
                    ${renderAwardRecommendationBadge(row.status)}
                </article>
            `).join('')}
        </div>
        <div class="evaluation-notice warning">Clarification is allowed only for award and contract preparation. It cannot change the evaluated bid substance.</div>
        <div class="award-fallback-panel">
            <strong>Supplier decline fallback</strong>
            <span>${escapeAwardRecommendationHtml(supplierDeclined ? 'Selected supplier declined. Record the buyer fallback decision before changing the award path.' : 'Fallback remains available if the selected supplier declines the award.')}</span>
            <div class="inline-actions">
                <button class="btn btn-secondary" type="button" data-award-fallback-action="next-ranked" data-award-next-ranked-supplier="${escapeAwardRecommendationHtml(nextRankedSupplier)}">Award to Next Ranked Bidder: ${escapeAwardRecommendationHtml(nextRankedSupplier)}</button>
                <button class="btn btn-secondary" type="button" data-award-fallback-action="cancel-award">Cancel Award Process</button>
                <button class="btn btn-secondary" type="button" data-award-fallback-action="return-award-decision">Return to Award Decision</button>
            </div>
            <div class="evaluation-notice ${supplierDeclined ? 'warning' : 'success'}" data-award-fallback-status>${escapeAwardRecommendationHtml(draft.fallbackDecision?.status || (supplierDeclined ? 'Fallback decision required.' : 'No fallback action needed.'))}</div>
        </div>
    `;

    const documentsContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 6</span><h2>Pre-Contract Documents</h2><p class="panel-note">Add, upload, or remove buyer-side pre-contract records. Required rows must be uploaded before contract generation.</p></div>
            ${renderAwardRecommendationBadge(requiredDocumentsApproved ? 'Buyer documents uploaded' : 'Buyer documents pending')}
        </div>
        <div class="evaluation-form-grid recommendation-form award-document-builder" data-award-document-builder>
            <label>Document name <input class="form-input" data-award-doc-name placeholder="Document name"></label>
            <label>Document type <input class="form-input" data-award-doc-type placeholder="Pre-contract Document"></label>
            <label>Requirement
                <select class="form-input" data-award-doc-required>
                    <option value="true">Required</option>
                    <option value="false">Optional</option>
                </select>
            </label>
            <label>Expiry date <input class="form-input" type="date" data-award-doc-expiry></label>
            <div class="inline-actions">
                <button class="btn btn-primary" type="button" data-award-document-add>Add Document</button>
            </div>
        </div>
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr><th>Document</th><th>Owner</th><th>Required</th><th>Status</th><th>Expiry Date</th><th>File</th><th>Action</th></tr></thead>
                <tbody data-award-documents-body>${renderAwardRecommendationRows(requiredDocuments.map(row => [
                    `<strong>${escapeAwardRecommendationHtml(row.name)}</strong>`,
                    escapeAwardRecommendationHtml(row.owner || 'Buyer'),
                    row.required === false ? 'No' : 'Yes',
                    renderDocumentStatusBadge(row.status),
                    escapeAwardRecommendationHtml(row.expiryDate || '-'),
                    escapeAwardRecommendationHtml(row.fileName || 'No file recorded'),
                    `<div class="inline-actions"><label class="btn btn-secondary btn-sm">Upload<input type="file" hidden data-award-document-file data-award-document-id="${escapeAwardRecommendationHtml(row.id)}"></label><button class="btn btn-secondary btn-sm" type="button" data-award-document-open data-award-document-id="${escapeAwardRecommendationHtml(row.id)}">${row.fileName ? 'Open' : 'Open'}</button><button class="btn btn-secondary btn-sm" type="button" data-award-document-remove data-award-document-id="${escapeAwardRecommendationHtml(row.id)}">Remove</button></div>`
                ]))}</tbody>
            </table>
        </div>
        ${!requiredDocumentsApproved ? '<div class="evaluation-notice warning">Contract blocked: required buyer pre-contract documents are missing or not uploaded.</div>' : ''}
    `;

    const draftContractContent = `
        <div class="panel-heading">
            <div><span class="section-kicker">Step 7</span><h2>Draft Contract</h2><p class="panel-note">The contract can be generated only after the checklist below is complete.</p></div>
            ${renderAwardRecommendationBadge(blockers.some(item => !item.complete) ? 'Blocked' : 'Ready')}
        </div>
        <div class="evaluation-notice ${blockers.some(item => !item.complete) ? 'warning' : 'success'}">Contract negotiation opens only after award confirmation, Communication Center notices, standstill/complaint handling, supplier acceptance, and buyer document upload are satisfied.</div>
        <div class="award-blocker-list draft-contract-unlock">
            <strong>Contract can be generated only when:</strong>
            <ul>${blockers.map(item => renderAwardCheck(item.label, item.complete)).join('')}</ul>
        </div>
        <div class="award-source-grid">
            <article><strong>From tender</strong><span>Title, reference, procurement type, scope, BOQ, and specifications.</span></article>
            <article><strong>From award</strong><span>Selected supplier, amount, conditions, award date, and recorded reason.</span></article>
            <article><strong>From supplier</strong><span>Supplier response status and contract review path.</span></article>
            <article><strong>From contract settings</strong><span>Start date, duration, payment terms, security, penalties, and dispute resolution.</span></article>
        </div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-source-document="evaluation" data-award-source-action="open" data-award-reference="${escapeAwardRecommendationHtml(reference)}">Open Evaluation Report</button>
            <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="draft-contract">Save Draft & Exit</button>
            <button class="btn btn-primary" type="button" ${blockers.some(item => !item.complete) ? 'disabled aria-disabled="true"' : ''} data-award-save-continue data-award-next-step="draft-contract" data-award-required-action="Generate Draft Contract" data-navigate="contract-negotiation" data-route-search="tab=overview">Generate Draft Contract</button>
        </div>
    `;

    const stepStatus = [
        [renderAwardRecommendationBadge('Recommended'), 'Review source records'],
        [renderAwardRecommendationBadge(confirmed ? 'Confirmed' : 'Needs input'), confirmed ? 'Prepare notices' : 'Fill and confirm'],
        [renderAwardRecommendationBadge(requiredNoticesSent ? 'Sent' : 'Pending'), 'Prepare notices'],
        [renderAwardRecommendationBadge(!standstillRequired ? 'Not required' : standstill.blocked ? 'Blocked' : 'Clear'), 'Set dates'],
        [renderAwardRecommendationBadge(supplierResponseStatus), 'Track response'],
        [renderAwardRecommendationBadge(requiredDocumentsApproved ? 'Uploaded' : 'Needs upload'), 'Upload documents'],
        [renderAwardRecommendationBadge(blockers.some(item => !item.complete) ? 'Blocked' : 'Ready'), 'Generate contract']
    ];
    const contents = [recommendationContent, awardDecisionContent, noticesContent, standstillContent, acceptanceContent, documentsContent, draftContractContent];

    return `
        <div class="main-layout procurement-layout evaluation-app-layout award-page award-page-no-sidebar" data-award-contract-workspace data-award-current-step="${escapeAwardRecommendationHtml(currentStep)}" data-award-tender-id="${escapeAwardRecommendationHtml(tenderId)}">
            <main class="main-content procurement-content evaluation-workspace">
                <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                    <div>
                        <span class="section-kicker">Award recommendation</span>
                        <h1>${escapeAwardRecommendationHtml(selectedSupplier)} is recommended for award</h1>
                        <p>${escapeAwardRecommendationHtml(recommendation.reason || award.reason || 'Award package is compiled from the finalized evaluation report, ranking table, corrections, conditions, and audit trail.')}</p>
                        <div class="award-recommended-callout">${renderAwardRecommendationBadge(`Rank ${selectedRank || 1}`)}<span>${escapeAwardRecommendationHtml(award.tenderTitle || draft.title || 'Tender award')}</span><span>Supplier response deadline: ${escapeAwardRecommendationHtml(responseDeadline || 'Not set')}</span></div>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${formatAwardRecommendationMoney(awardAmount || recommendation.amount, award.currency || recommendation.currency || 'TZS')}</strong><span>Recommended amount</span></div>
                        <div><strong>${escapeAwardRecommendationHtml(recommendation.method || award.procurementType || 'Tender')}</strong><span>Evaluation basis</span></div>
                        <div><strong>${standstill.durationDays || 0} days</strong><span>Standstill duration</span></div>
                    </div>
                </section>

                <section class="evaluation-top-summary">
                    <div><span>Tender</span><strong>${escapeAwardRecommendationHtml(award.tenderTitle || draft.title || '')}</strong></div>
                    <div><span>Reference</span><strong>${escapeAwardRecommendationHtml(award.reference || draft.tenderReference || '')}</strong></div>
                    <div><span>Buyer</span><strong>${escapeAwardRecommendationHtml(award.buyer || draft.buyer || '')}</strong></div>
                    <div><span>Evaluation</span>${renderAwardRecommendationBadge(award.evaluationStatus || 'Completed')}</div>
                    <div><span>Supplier</span><strong>${escapeAwardRecommendationHtml(selectedSupplier)}</strong></div>
                </section>

                ${draft.hasRestorableDraft ? `<div class="draft-restore-banner"><strong>Draft from ${escapeAwardRecommendationHtml(draft.lastEditedAt ? new Date(draft.lastEditedAt).toLocaleString() : 'previous session')}</strong><span>Restored from local draft storage for this tender.</span></div>` : ''}

                <section class="award-wizard-page tender-wizard-page">
                    <div class="award-draft-strip">
                        <div>
                            <span class="section-kicker">Editable award workspace</span>
                            <h2>Recommendation to Draft Contract</h2>
                        </div>
                        <div class="inline-actions">
                            ${renderAwardRecommendationBadge(draft.draftSaved ? 'Draft saved' : 'Unsaved draft')}
                            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="${escapeAwardRecommendationHtml(currentStep)}">Save Draft</button>
                            <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="${escapeAwardRecommendationHtml(currentStep)}">Save Draft & Exit</button>
                        </div>
                    </div>

                    <div class="wizard-shell award-wizard-shell award-expandable-shell" data-award-wizard data-award-active-step="${activeStepIndex}">
                        ${renderAwardWizardProgress(awardWorkflowSteps, currentStep)}
                        <div class="award-wizard-main">
                            <div class="wizard-workspace award-expandable-workflow">
                                ${awardWorkflowSteps.map((step, index) => renderAwardStepRow(step, index, currentStep, stepStatus[index][0], stepStatus[index][1], contents[index])).join('')}
                                <div class="wizard-flow-controls" data-award-flow-controls>
                                    <button class="btn btn-secondary" type="button" data-award-prev>Back</button>
                                    <div class="wizard-flow-progress">
                                        <strong data-award-progress>Step ${activeStepIndex + 1} of ${awardWorkflowSteps.length}</strong>
                                        <span data-award-step-title>${escapeAwardRecommendationHtml(awardWorkflowSteps[activeStepIndex]?.title || awardWorkflowSteps[0].title)}</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-award-next>Continue</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    `;
}

function renderAwardRecommendation() {
    const context = typeof getAwardContractLifecycleContext === 'function' ? getAwardContractLifecycleContext() : null;
    const lifecycle = mockData.awardingContracts || {};
    const tender = context?.tender || {};
    const draft = context?.draft || {};
    const evaluation = mockData.bidEvaluation || {};
    const recommendation = evaluation.recommendation || {};
    const award = {
        ...(lifecycle.award || {}),
        tenderTitle: draft.title || lifecycle.award?.tenderTitle,
        reference: draft.tenderReference || lifecycle.award?.reference,
        buyer: draft.buyer || lifecycle.award?.buyer,
        procurementType: draft.procurementType || lifecycle.award?.procurementType,
        selectedSupplier: draft.awardDecision?.selectedSupplier || lifecycle.award?.selectedSupplier,
        awardAmount: draft.awardDecision?.awardAmount || lifecycle.award?.awardAmount,
        currency: draft.awardDecision?.currency || lifecycle.award?.currency,
        reason: draft.awardDecision?.reason || lifecycle.award?.reason,
        awardStatus: draft.awardStatus || lifecycle.award?.awardStatus,
        confirmation: {
            ...(lifecycle.award?.confirmation || {}),
            confirmedBy: draft.awardDecision?.confirmedBy || lifecycle.award?.confirmation?.confirmedBy || 'Buyer authority',
            date: draft.awardDecision?.awardDate || lifecycle.award?.confirmation?.date,
            status: draft.awardDecision?.confirmed ? 'Confirmed' : 'Draft'
        },
        notices: draft.notices?.length ? draft.notices : (lifecycle.award?.notices || []),
        supplierResponses: lifecycle.award?.supplierResponses || []
    };
    const bids = evaluation.bids || [];
    const criteria = (evaluation.technicalCriteria || []).filter(criterion => !/financial|price/i.test(String(criterion.name || criterion.label || '')));
    const technicalTotal = bid => criteria.reduce((sum, criterion) => sum + Number(bid.technicalScores?.[criterion.id] || 0), 0);
    const rankedBids = bids.slice().sort((a, b) => (a.financial?.ranking || 99) - (b.financial?.ranking || 99));
    const selectedSupplier = award.selectedSupplier || recommendation.supplier || rankedBids[0]?.supplier || 'Recommended supplier';
    const selectedBid = rankedBids.find(bid => bid.supplier === selectedSupplier) || rankedBids[0] || {};
    const nextRankedSupplier = rankedBids.find(bid => bid.supplier !== selectedSupplier)?.supplier || 'Next ranked responsive bidder';
    const selectedRank = Number(selectedBid.financial?.ranking || 0);
    const awardAmount = Number(award.awardAmount || recommendation.amount || 0);
    const correctedPrice = Number(selectedBid.financial?.correctedPrice || recommendation.amount || 0);
    const amountDifference = awardAmount - correctedPrice;
    const amountMismatch = correctedPrice > 0 && Math.abs(amountDifference) > 0;
    const confirmed = Boolean(draft.awardDecision?.confirmed || draft.awardDecision?.approvalConfirmed);
    const awardStandstill = {
        ...award,
        standstillStart: draft.standstill?.startDate || award.standstillStart,
        standstillEnd: draft.standstill?.endDate || award.standstillEnd,
        complaintsReceived: draft.standstill?.complaints?.some(row => !/resolved|closed/i.test(row.status || '')) ? 'Yes' : award.complaintsReceived,
        complaintsResolved: draft.standstill?.complaints?.length ? draft.standstill.complaints.every(row => /resolved|closed/i.test(row.status || '')) : award.complaintsResolved
    };
    const standstill = getStandstillStatus(awardStandstill);
    const standstillRequired = draft.standstill?.required !== false && draft.standstill?.required !== 'false';
    const noticeRows = getAwardNoticeDrafts(draft, award, tender, selectedSupplier);
    const requiredNoticesSent = noticeRows.every(row => /sent|awaiting response/i.test(row.status || ''));
    const supplierDecision = draft.supplierResponse?.decision || '';
    const supplierAccepted = /accepted/i.test(draft.supplierResponse?.status || award.awardStatus || '') || supplierDecision === 'accept' || draft.supplierAccepted;
    const supplierDeclined = /declined/i.test(draft.supplierResponse?.status || '') || supplierDecision === 'decline';
    const supplierResponseStatus = draft.supplierResponse?.status || (supplierAccepted ? 'Award accepted' : supplierDeclined ? 'Award declined' : 'No response yet');
    const requiredDocuments = normalizeAwardDocumentRows(draft.documents || []);
    const requiredDocumentsApproved = requiredDocuments.length > 0 && requiredDocuments
        .filter(row => row.required !== false)
        .every(row => /uploaded|approved|verified|locked|current/i.test(row.status || ''));
    const blockers = [
        { label: 'Award confirmed', complete: confirmed },
        { label: 'Notices sent', complete: requiredNoticesSent },
        { label: 'Waiting period clear', complete: !standstillRequired || !standstill.blocked },
        { label: 'No open complaints', complete: !standstill.unresolvedComplaint },
        { label: 'Supplier accepted', complete: Boolean(supplierAccepted) },
        { label: 'Required documents uploaded', complete: requiredDocumentsApproved }
    ];
    const readyForContract = !blockers.some(item => !item.complete);
    const tenderId = getAwardSourceTenderId(tender, draft, award);
    const reference = getAwardEvaluationReference(tender, award, evaluation);
    const currentStep = normalizeAwardStep(draft.currentStep || (confirmed ? 'award-notification' : 'award-decision'));

    const rankingContent = `
        <div class="award-simple-table-wrap">
            <table>
                <thead><tr><th>Rank</th><th>Supplier</th><th>Technical</th><th>Price</th><th>Result</th></tr></thead>
                <tbody>
                    ${rankedBids.map(bid => `
                        <tr>
                            <td>${escapeAwardRecommendationHtml(bid.financial?.ranking || '-')}</td>
                            <td><strong>${escapeAwardRecommendationHtml(bid.supplier || '-')}</strong></td>
                            <td>${technicalTotal(bid)}%</td>
                            <td>${formatAwardRecommendationMoney(bid.financial?.correctedPrice, bid.financial?.currency || 'TZS')}</td>
                            <td>${escapeAwardRecommendationHtml(bid.supplier === selectedSupplier ? 'Recommended' : bid.finalResult || 'Reviewed')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${amountMismatch ? `<p class="award-simple-note">The award amount is different from the evaluated price by ${formatAwardRecommendationMoney(amountDifference, award.currency || recommendation.currency || 'TZS')}. Add a clear reason in the award form.</p>` : ''}
    `;

    const noticesContent = `
        <div class="award-simple-field-grid">
            <label>Notice type
                <select class="form-input" data-award-draft-field="notification.noticeType">
                    ${['Notice of Intention to Award', 'Award Notification', 'Unsuccessful Bidder Notice'].map(option => `<option ${draft.notification?.noticeType === option ? 'selected' : ''}>${option}</option>`).join('')}
                </select>
            </label>
            <label>Send to
                <select class="form-input" data-award-draft-field="notification.recipientScope">
                    ${['All bidders', 'Selected supplier only', 'Unsuccessful bidders only'].map(option => `<option ${draft.notification?.recipientScope === option ? 'selected' : ''}>${option}</option>`).join('')}
                </select>
            </label>
            <label>Response deadline <input class="form-input" type="date" data-award-draft-field="notification.responseDeadline" value="${escapeAwardRecommendationHtml(draft.notification?.responseDeadline || '')}"></label>
            <label>Complaint deadline <input class="form-input" type="date" data-award-draft-field="notification.complaintDeadline" value="${escapeAwardRecommendationHtml(draft.standstill?.complaintDeadline || award.standstillEnd || '')}"></label>
            <label>Message
                <textarea class="form-input" rows="4" data-award-draft-field="notification.message" placeholder="Write the message to bidders.">${escapeAwardRecommendationHtml(draft.notification?.message || '')}</textarea>
            </label>
        </div>
        <div class="award-simple-document-list">
            ${noticeRows.map(row => `
                <article class="award-simple-document-row">
                    <div>
                        <strong>${escapeAwardRecommendationHtml(row.type)}</strong>
                        <span>${escapeAwardRecommendationHtml(row.recipient)} - ${escapeAwardRecommendationHtml(row.status)}</span>
                    </div>
                    ${renderAwardNoticeComposeButton(row, tenderId, reference, award.tenderTitle || draft.title || '')}
                </article>
            `).join('')}
        </div>
    `;

    const standstillContent = `
        <div class="award-simple-field-grid">
            <label>Waiting period required?
                <select class="form-input" data-award-draft-field="standstill.required">
                    <option value="true" ${standstillRequired ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!standstillRequired ? 'selected' : ''}>No</option>
                </select>
            </label>
            <label>Start date <input class="form-input" type="date" data-award-draft-field="standstill.startDate" value="${escapeAwardRecommendationHtml(draft.standstill?.startDate || award.standstillStart || '')}"></label>
            <label>End date <input class="form-input" type="date" data-award-draft-field="standstill.endDate" value="${escapeAwardRecommendationHtml(draft.standstill?.endDate || award.standstillEnd || '')}"></label>
            <label>Complaint deadline <input class="form-input" type="date" data-award-draft-field="standstill.complaintDeadline" value="${escapeAwardRecommendationHtml(draft.standstill?.complaintDeadline || award.standstillEnd || '')}"></label>
        </div>
        <p class="award-simple-note">${standstillRequired ? `Days remaining: ${standstill.daysRemaining}.` : 'No waiting period is required for this award.'}</p>
    `;

    const supplierContent = `
        <div class="award-simple-document-row">
            <div>
                <strong>Supplier response</strong>
                <span>${escapeAwardRecommendationHtml(draft.supplierResponse?.message || draft.supplierResponse?.reason || 'No response recorded yet.')}</span>
            </div>
            ${renderAwardRecommendationBadge(supplierResponseStatus)}
        </div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-fallback-action="next-ranked" data-award-next-ranked-supplier="${escapeAwardRecommendationHtml(nextRankedSupplier)}">Use next ranked supplier</button>
            <button class="btn btn-secondary" type="button" data-award-fallback-action="cancel-award">Cancel award</button>
            <button class="btn btn-secondary" type="button" data-award-fallback-action="return-award-decision">Edit award decision</button>
        </div>
    `;

    const documentsContent = `
        <div class="evaluation-form-grid recommendation-form award-document-builder award-simple-field-grid" data-award-document-builder>
            <label>Document name <input class="form-input" data-award-doc-name placeholder="Example: Performance security"></label>
            <label>Document type <input class="form-input" data-award-doc-type placeholder="Example: Contract document"></label>
            <label>Required?
                <select class="form-input" data-award-doc-required>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            </label>
            <label>Expiry date <input class="form-input" type="date" data-award-doc-expiry></label>
            <div class="inline-actions"><button class="btn btn-primary" type="button" data-award-document-add>Add document</button></div>
        </div>
        <div class="award-simple-document-list">
            ${requiredDocuments.map(row => `
                <article class="award-simple-document-row">
                    <div>
                        <strong>${escapeAwardRecommendationHtml(row.name)}</strong>
                        <span>${escapeAwardRecommendationHtml(row.required === false ? 'Optional' : 'Required')} - ${escapeAwardRecommendationHtml(row.status || 'Not uploaded')} ${row.fileName ? `- ${escapeAwardRecommendationHtml(row.fileName)}` : ''}</span>
                    </div>
                    <div class="inline-actions">
                        <label class="btn btn-secondary btn-sm">Upload<input type="file" hidden data-award-document-file data-award-document-id="${escapeAwardRecommendationHtml(row.id)}"></label>
                        <button class="btn btn-secondary btn-sm" type="button" data-award-document-open data-award-document-id="${escapeAwardRecommendationHtml(row.id)}">Open</button>
                        <button class="btn btn-secondary btn-sm" type="button" data-award-document-remove data-award-document-id="${escapeAwardRecommendationHtml(row.id)}">Remove</button>
                    </div>
                </article>
            `).join('')}
        </div>
    `;

    const readyContent = `
        <div class="award-simple-ready-list">
            ${blockers.map(item => renderAwardCheck(item.label, item.complete)).join('')}
        </div>
    `;

    return `
        <div class="main-layout procurement-layout evaluation-app-layout award-page award-page-no-sidebar award-simple-page" data-award-contract-workspace data-award-current-step="${escapeAwardRecommendationHtml(currentStep)}" data-award-tender-id="${escapeAwardRecommendationHtml(tenderId)}">
            <main class="main-content procurement-content evaluation-workspace award-simple-workspace">
                <header class="award-simple-header">
                    <span class="section-kicker">Award recommendation</span>
                    <h1>Confirm award for ${escapeAwardRecommendationHtml(selectedSupplier)}</h1>
                    <p>Review the recommendation, fill the award details, then save or confirm the award.</p>
                </header>

                ${renderAwardMainForm({ award, draft, recommendation, selectedSupplier, awardAmount, confirmed })}

                <div class="award-simple-actions">
                    <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-decision">Save</button>
                    <button class="btn btn-primary" type="button" data-award-confirm-decision data-award-next-step="award-notification" data-award-required-action="Send notices">${confirmed ? 'Award confirmed' : 'Confirm award'}</button>
                    <button class="btn btn-secondary" type="button" data-award-send-notices>Send notices</button>
                    <button class="btn btn-primary" type="button" data-award-generate-contract data-award-contract-ready="${readyForContract ? 'true' : 'false'}" data-navigate="contract-negotiation" data-route-search="tab=overview" aria-disabled="${readyForContract ? 'false' : 'true'}">Generate contract</button>
                </div>

                <section class="award-simple-details-stack" aria-label="Supporting award information">
                    ${renderAwardDetailsSection('Documents used for this award', 'Tender document, bid documents, and evaluation report', renderAwardSimpleSourceDocuments(tender, draft, award, evaluation, rankedBids))}
                    ${renderAwardDetailsSection('Bid ranking', 'See why this supplier was recommended', rankingContent)}
                    ${renderAwardDetailsSection('Send notices', 'Set message, deadline, and recipients', noticesContent)}
                    ${renderAwardDetailsSection('Waiting period and complaints', 'Set dates and check complaint status', standstillContent)}
                    ${renderAwardDetailsSection('Supplier response', 'Track acceptance or fallback action', supplierContent)}
                    ${renderAwardDetailsSection('Required documents', 'Upload documents needed before contract signing', documentsContent)}
                    ${renderAwardDetailsSection('Contract readiness', 'Check what is still blocking contract generation', readyContent)}
                </section>
            </main>
        </div>
    `;
}

function handleAwardSourceDocumentAction(button) {
    const source = button.getAttribute('data-award-source-document') || '';
    const action = button.getAttribute('data-award-source-action') || 'open';
    const reference = button.getAttribute('data-award-reference') || '';

    if (source === 'tender') {
        const tenderId = button.getAttribute('data-award-tender-id') || '';
        if (action === 'download' && typeof downloadProcurexTenderPdf === 'function') {
            downloadProcurexTenderPdf(tenderId, { audience: 'owner' });
            return;
        }
        if (typeof openProcurexTenderPdf === 'function') {
            openProcurexTenderPdf(tenderId, { audience: 'owner' });
            return;
        }
        alert('Tender document preview is unavailable.');
        return;
    }

    if (source === 'bid') {
        const bidderIndex = Number(button.getAttribute('data-award-bid-index') || 0);
        if (action === 'download' && typeof downloadEvaluationSubmittedBidReport === 'function') {
            downloadEvaluationSubmittedBidReport(reference, bidderIndex);
            return;
        }
        if (action === 'open' && typeof openEvaluationSubmittedBidReport === 'function') {
            openEvaluationSubmittedBidReport(reference, bidderIndex);
            return;
        }
        const bid = (mockData.bidEvaluation?.bids || [])[bidderIndex] || {};
        const html = buildAwardBidPreviewHtml(reference, bid, bidderIndex);
        if (action === 'download') downloadAwardDocumentHtml(html, getAwardSafeFilename(`${reference || 'tender'}-${bid.supplier || `bid-${bidderIndex + 1}`}`));
        else openAwardDocumentHtml(html, 'Submitted bid package');
        return;
    }

    if (source === 'evaluation') {
        const html = getAwardEvaluationReportHtml(reference);
        if (action === 'download') {
            const reportNode = document.createElement('div');
            reportNode.innerHTML = html;
            document.body.appendChild(reportNode);
            if (window.html2pdf) {
                window.html2pdf().set({
                    margin: 0.4,
                    filename: `${reference || 'evaluation'}-evaluation-report.pdf`,
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                }).from(reportNode).save().finally(() => reportNode.remove());
            } else {
                reportNode.remove();
                downloadAwardDocumentHtml(html, getAwardSafeFilename(`${reference || 'evaluation'}-evaluation-report`));
            }
            return;
        }
        openAwardDocumentHtml(html, 'Evaluation report');
    }
}

function getAwardCurrentDocuments(workspace, tenderId) {
    const draft = typeof loadAwardContractDraft === 'function' ? loadAwardContractDraft(tenderId) : {};
    return normalizeAwardDocumentRows(draft.documents || []).map(row => ({ ...row }));
}

function saveAwardDocuments(workspace, tenderId, documents) {
    if (typeof saveAwardContractDraft !== 'function') return;
    saveAwardContractDraft(tenderId, { documents, currentStep: workspace.getAttribute('data-award-current-step') || 'pre-contract-documents' });
    window.app?.renderPage?.();
}

function isAwardDecisionFormReady(root = document) {
    const form = root.querySelector('[data-award-validation-form]');
    if (!form) return false;
    const fieldsValid = [...form.querySelectorAll('[data-award-required]')].every(field => String(field.value || '').trim());
    const checksValid = [...root.querySelectorAll('[data-award-required-checkbox]')].every(field => field.checked);
    return fieldsValid && checksValid;
}

function showAwardNotification(message, tone = 'warning') {
    if (typeof window.app?.showNotification === 'function') {
        window.app.showNotification(message, { tone });
        return;
    }
    alert(message);
}

function initializeAwardRecommendation() {
    const wizard = document.querySelector('[data-award-wizard]');
    const form = document.querySelector('[data-award-validation-form]');
    const button = document.querySelector('[data-award-confirm-button]');
    const workspace = document.querySelector('[data-award-contract-workspace]');

    if (wizard && wizard.dataset.ready !== 'true') {
        wizard.dataset.ready = 'true';
        const panels = Array.from(wizard.querySelectorAll('[data-award-step-panel]'));
        const stepButtons = Array.from(wizard.querySelectorAll('[data-award-step-index]'));
        const rows = Array.from(wizard.querySelectorAll('[data-award-step-row]'));
        const previousButton = wizard.querySelector('[data-award-prev]');
        const nextButton = wizard.querySelector('[data-award-next]');
        const progressOutput = wizard.querySelector('[data-award-progress]');
        const stepTitleOutput = wizard.querySelector('[data-award-step-title]');
        let activeStepIndex = Number(wizard.dataset.awardActiveStep || 0);

        const setActiveStep = (index) => {
            activeStepIndex = Math.min(Math.max(index, 0), panels.length - 1);
            panels.forEach((panel, panelIndex) => panel.classList.toggle('active', panelIndex === activeStepIndex));
            rows.forEach((row, rowIndex) => {
                row.classList.toggle('active', rowIndex === activeStepIndex);
                row.classList.toggle('completed', rowIndex < activeStepIndex);
            });
            stepButtons.forEach(step => {
                const stepIndex = Number(step.dataset.awardStepIndex);
                const active = stepIndex === activeStepIndex;
                step.classList.toggle('active', active);
                step.classList.toggle('completed', stepIndex < activeStepIndex);
                step.setAttribute('aria-current', active ? 'step' : 'false');
                if (step.classList.contains('award-step-row-toggle')) step.setAttribute('aria-expanded', String(active));
            });
            if (previousButton) previousButton.disabled = activeStepIndex === 0;
            if (nextButton) nextButton.disabled = activeStepIndex === panels.length - 1;
            if (progressOutput) progressOutput.textContent = `Step ${activeStepIndex + 1} of ${panels.length}`;
            if (stepTitleOutput) stepTitleOutput.textContent = awardWorkflowSteps[activeStepIndex]?.title || '';
            wizard.closest('[data-award-contract-workspace]')?.setAttribute('data-award-current-step', panels[activeStepIndex]?.getAttribute('data-award-step-id') || 'evaluation-result');
        };

        stepButtons.forEach(step => {
            step.addEventListener('click', () => setActiveStep(Number(step.dataset.awardStepIndex)));
        });
        previousButton?.addEventListener('click', () => setActiveStep(activeStepIndex - 1));
        nextButton?.addEventListener('click', () => setActiveStep(activeStepIndex + 1));
        setActiveStep(activeStepIndex);
    }

    const sync = () => {
        if (!form || !button) return;
        const fieldsValid = [...form.querySelectorAll('[data-award-required]')].every(field => String(field.value || '').trim());
        const checksValid = [...document.querySelectorAll('[data-award-required-checkbox]')].every(field => field.checked);
        const valid = fieldsValid && checksValid;
        button.disabled = !valid;
        button.setAttribute('aria-disabled', String(!valid));
        form.classList.toggle('is-valid', valid);
    };

    document.querySelectorAll('input, textarea, select').forEach(field => {
        field.addEventListener('input', sync);
        field.addEventListener('change', sync);
    });
    sync();

    if (!workspace || workspace.dataset.awardPageActionsReady === 'true') return;
    workspace.dataset.awardPageActionsReady = 'true';
    const tenderId = workspace.getAttribute('data-award-tender-id') || '';

    workspace.addEventListener('click', event => {
        const sourceButton = event.target.closest('[data-award-source-document]');
        if (sourceButton) {
            event.preventDefault();
            event.stopPropagation();
            handleAwardSourceDocumentAction(sourceButton);
            return;
        }

        const confirmButton = event.target.closest('[data-award-confirm-decision]');
        if (confirmButton && !confirmButton.disabled && typeof saveAwardContractDraft === 'function') {
            if (!isAwardDecisionFormReady(workspace)) {
                event.preventDefault();
                showAwardNotification('Fill the required award fields and tick the three confirmations before confirming the award.');
                return;
            }
            const currentFields = typeof collectAwardContractDraftFields === 'function' ? collectAwardContractDraftFields(workspace) : {};
            saveAwardContractDraft(tenderId, {
                ...currentFields,
                awardDecision: { confirmed: true, approvalConfirmed: true },
                awardStatus: 'Award Confirmed',
                currentStep: confirmButton.getAttribute('data-award-next-step') || 'award-notification',
                requiredAction: confirmButton.getAttribute('data-award-required-action') || 'Prepare Notices'
            });
            showAwardNotification('Award decision confirmed.', 'success');
            window.app?.renderPage?.();
            return;
        }

        const sendNoticesButton = event.target.closest('[data-award-send-notices]');
        if (sendNoticesButton && typeof saveAwardContractDraft === 'function') {
            event.preventDefault();
            const draft = typeof loadAwardContractDraft === 'function' ? loadAwardContractDraft(tenderId) : {};
            const currentFields = typeof collectAwardContractDraftFields === 'function' ? collectAwardContractDraftFields(workspace) : {};
            const notices = (draft.notices || []).map(row => ({ ...row, status: 'Sent', deadline: row.deadline || draft.notification?.responseDeadline || draft.notification?.complaintDeadline || '' }));
            saveAwardContractDraft(tenderId, { ...currentFields, notices, currentStep: 'standstill-period', requiredAction: 'Monitor waiting period' });
            showAwardNotification('Notices marked as sent.', 'success');
            window.app?.renderPage?.();
            return;
        }

        const generateButton = event.target.closest('[data-award-generate-contract]');
        if (generateButton) {
            const ready = generateButton.getAttribute('data-award-contract-ready') === 'true';
            if (!ready) {
                event.preventDefault();
                event.stopPropagation();
                showAwardNotification('The contract is not ready yet. Complete confirmation, notices, waiting period, supplier acceptance, and required documents first.');
                return;
            }
        }

        const addDocumentButton = event.target.closest('[data-award-document-add]');
        if (addDocumentButton) {
            event.preventDefault();
            const builder = addDocumentButton.closest('[data-award-document-builder]');
            const name = builder?.querySelector('[data-award-doc-name]')?.value.trim();
            const type = builder?.querySelector('[data-award-doc-type]')?.value.trim() || 'Pre-contract Document';
            const required = builder?.querySelector('[data-award-doc-required]')?.value !== 'false';
            const expiryDate = builder?.querySelector('[data-award-doc-expiry]')?.value || '';
            if (!name) {
                showAwardNotification('Add a document name before adding it.');
                return;
            }
            const documents = getAwardCurrentDocuments(workspace, tenderId);
            documents.push({
                id: `buyer-document-${Date.now()}`,
                name,
                type,
                owner: 'Buyer',
                required,
                status: 'Pending Buyer Upload',
                fileName: '',
                expiryDate
            });
            saveAwardDocuments(workspace, tenderId, documents);
            return;
        }

        const removeDocumentButton = event.target.closest('[data-award-document-remove]');
        if (removeDocumentButton) {
            event.preventDefault();
            const id = removeDocumentButton.getAttribute('data-award-document-id') || '';
            const documents = getAwardCurrentDocuments(workspace, tenderId).filter(row => row.id !== id);
            saveAwardDocuments(workspace, tenderId, documents);
            return;
        }

        const openDocumentButton = event.target.closest('[data-award-document-open]');
        if (openDocumentButton) {
            event.preventDefault();
            const id = openDocumentButton.getAttribute('data-award-document-id') || '';
            const row = getAwardCurrentDocuments(workspace, tenderId).find(item => item.id === id);
            if (!row?.fileName) {
                showAwardNotification('No uploaded file has been recorded for this document yet.');
                return;
            }
            openAwardDocumentHtml(buildAwardBidPreviewHtml('', { supplier: row.name, documents: [row.fileName] }, 0), row.name);
            return;
        }

        const fallbackButton = event.target.closest('[data-award-fallback-action]');
        if (fallbackButton && typeof saveAwardContractDraft === 'function') {
            event.preventDefault();
            const action = fallbackButton.getAttribute('data-award-fallback-action') || '';
            const nextSupplier = fallbackButton.getAttribute('data-award-next-ranked-supplier') || '';
            const status = action === 'next-ranked'
                ? `Fallback recorded: award may move to ${nextSupplier}.`
                : action === 'cancel-award'
                    ? 'Fallback recorded: award process marked for cancellation review.'
                    : 'Fallback recorded: award decision returned for review.';
            saveAwardContractDraft(tenderId, {
                fallbackDecision: { action, status, decidedAt: new Date().toISOString() },
                currentStep: action === 'return-award-decision' ? 'award-decision' : 'supplier-acceptance',
                ...(action === 'next-ranked' ? { awardDecision: { selectedSupplier: nextSupplier } } : {})
            });
            showAwardNotification(status, 'success');
            window.app?.renderPage?.();
            return;
        }

        const noticeButton = event.target.closest('[data-award-notice-compose]');
        if (noticeButton && typeof saveAwardContractDraft === 'function') {
            const draft = typeof loadAwardContractDraft === 'function' ? loadAwardContractDraft(tenderId) : {};
            const noticeId = noticeButton.getAttribute('data-award-notice-id') || '';
            const notices = (draft.notices || []).map(row => row.id === noticeId ? { ...row, status: 'Sent', deadline: row.deadline || draft.notification?.responseDeadline || '' } : row);
            saveAwardContractDraft(tenderId, { notices, currentStep: 'award-notification', requiredAction: 'Monitor Standstill Period' });
            showAwardNotification('Notice marked as sent.', 'success');
        }
    });

    workspace.addEventListener('change', event => {
        const fileInput = event.target.closest('[data-award-document-file]');
        if (!fileInput) return;
        const id = fileInput.getAttribute('data-award-document-id') || '';
        const file = fileInput.files?.[0];
        if (!file) return;
        const documents = getAwardCurrentDocuments(workspace, tenderId).map(row => row.id === id ? {
            ...row,
            fileName: file.name,
            status: 'Uploaded'
        } : row);
        saveAwardDocuments(workspace, tenderId, documents);
        showAwardNotification('Document uploaded.', 'success');
    });
}

if (window.app) {
    window.app.renderAwardRecommendation = renderAwardRecommendation;
}

window.initializeAwardRecommendation = initializeAwardRecommendation;
