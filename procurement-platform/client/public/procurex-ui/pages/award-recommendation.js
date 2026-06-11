// Buyer-side award workflow after evaluation completion.

const PXAwardUtils = window.ProcureXShared || {};
const escapeAwardRecommendationHtml = PXAwardUtils.escapeHtml || ((value = '') => String(value));
const formatAwardRecommendationMoney = PXAwardUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const formatAwardRecommendationDate = PXAwardUtils.formatDate || ((value = '') => value || '-');
const renderAwardRecommendationBadge = PXAwardUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapeAwardRecommendationHtml(value)}</span>`);

const awardWorkflowSteps = [
    { id: 'evaluation-result', title: 'Evaluation Results', shortTitle: 'Evaluation Results', meta: 'Report and ranked bidders' },
    { id: 'award-decision', title: 'Award Decision', shortTitle: 'Award Decision', meta: 'Supplier, amount, reason, and confirmation' },
    { id: 'award-notification', title: 'Notice Preparation', shortTitle: 'Notices', meta: 'Communication Center notices' },
    { id: 'standstill-period', title: 'Standstill & Complaints', shortTitle: 'Standstill', meta: 'Contracting lock window' },
    { id: 'supplier-acceptance', title: 'Supplier Acceptance', shortTitle: 'Acceptance', meta: 'Accept, decline, or clarify' },
    { id: 'pre-contract-documents', title: 'Pre-Contract Documents', shortTitle: 'Documents', meta: 'Buyer document set' },
    { id: 'draft-contract', title: 'Draft Contract', shortTitle: 'Draft Contract', meta: 'Generate only after blockers clear' }
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

function renderAwardWizardRail(steps, currentStep) {
    return `
        <aside class="wizard-rail award-wizard-rail">
            ${steps.map((step, index) => {
                const state = getAwardRecommendationStepState(step.id, currentStep);
                return `
                    <button class="wizard-rail-step ${state === 'active' ? 'active' : ''} ${state === 'completed' ? 'completed' : ''}" type="button" data-award-step-index="${index}">
                        <strong>${String(index + 1).padStart(2, '0')}</strong>
                        <span>${escapeAwardRecommendationHtml(step.title)}</span>
                    </button>
                `;
            }).join('')}
        </aside>
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

function renderAwardCheck(label, complete) {
    return `
        <li class="${complete ? 'complete' : 'blocked'}">
            <span>${complete ? 'OK' : '!'}</span>
            <strong>${escapeAwardRecommendationHtml(label)}</strong>
        </li>
    `;
}

function renderAwardStatusPanel(statusItems = [], blockers = []) {
    const nextBlocker = blockers.find(item => !item.complete);
    return `
        <aside class="award-status-panel" aria-label="Award workflow status">
            <div>
                <span class="section-kicker">Status panel</span>
                <h3>${escapeAwardRecommendationHtml(nextBlocker ? 'Contract blocked' : 'Ready for draft contract')}</h3>
                <p>${escapeAwardRecommendationHtml(nextBlocker ? nextBlocker.label : 'All pre-contract conditions are clear.')}</p>
            </div>
            <div class="award-status-grid">
                ${statusItems.map(item => `
                    <article>
                        <span>${escapeAwardRecommendationHtml(item.label)}</span>
                        <strong>${item.value}</strong>
                    </article>
                `).join('')}
            </div>
            <div class="award-blocker-list">
                <strong>Contract unlock checklist</strong>
                <ul>
                    ${blockers.map(item => renderAwardCheck(item.label, item.complete)).join('')}
                </ul>
            </div>
        </aside>
    `;
}

function renderAwardQueueNavLink(label, queue, active = false) {
    return `<li><a href="#" data-award-guard-navigate data-navigate="awarding-contracts" data-route-search="queue=${escapeAwardRecommendationHtml(queue)}" class="${active ? 'active' : ''}">${escapeAwardRecommendationHtml(label)}</a></li>`;
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
    const firstRankedBid = rankedBids[0] || {};
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
    const blockers = [
        { label: 'Award decision confirmed', complete: confirmed },
        { label: 'Required notices sent', complete: requiredNoticesSent },
        { label: 'Standstill clear', complete: !standstillRequired || !standstill.blocked },
        { label: 'No unresolved complaints', complete: !standstill.unresolvedComplaint },
        { label: 'Supplier accepted award', complete: Boolean(supplierAccepted) },
        { label: 'Required pre-contract documents uploaded', complete: requiredDocumentsApproved }
    ];
    const statusItems = [
        { label: 'Current status', value: renderAwardRecommendationBadge(confirmed ? 'Award Confirmed' : 'Award Decision Draft') },
        { label: 'Next action', value: `<span>${escapeAwardRecommendationHtml(confirmed ? 'Prepare notices in Communication Center' : 'Confirm award decision')}</span>` },
        { label: 'Contract status', value: renderAwardRecommendationBadge(blockers.some(item => !item.complete) ? 'Blocked' : 'Ready') }
    ];

    return `
        <div class="main-layout procurement-layout evaluation-app-layout award-page" data-award-contract-workspace data-award-current-step="${escapeAwardRecommendationHtml(currentStep)}" data-award-tender-id="${escapeAwardRecommendationHtml(draft.tenderId || tender.id || '')}">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Awarding in Progress</h3>
                    <span>${escapeAwardRecommendationHtml(award.reference || 'Evaluation report')}</span>
                </div>
                <ul class="sidebar-nav">
                    ${renderAwardQueueNavLink('My Urgent Actions', 'my-urgent-actions')}
                    ${renderAwardQueueNavLink('Awarding in Progress', 'awarding-in-progress', true)}
                    ${renderAwardQueueNavLink('Awards Received', 'awards-received')}
                    ${renderAwardQueueNavLink('Contracts in Progress', 'contracts-in-progress')}
                    ${renderAwardQueueNavLink('Active Contracts', 'active-contracts')}
                    ${renderAwardQueueNavLink('Closed Contracts', 'closed-contracts')}
                    <li><a href="#" data-award-guard-navigate data-navigate="bid-evaluation">View Evaluation Report</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content evaluation-workspace">
                <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                    <div>
                        <span class="section-kicker">Buyer / awarder path</span>
                        <h1>${escapeAwardRecommendationHtml(award.tenderTitle || 'Awarding in Progress')}</h1>
                        <p>${escapeAwardRecommendationHtml(award.reason || 'Award package is compiled from the finalized evaluation report, ranking table, corrections, conditions, and audit trail.')}</p>
                        <div class="award-recommended-callout">${renderAwardRecommendationBadge(`Selected supplier: ${selectedSupplier}`)}<span>Supplier response deadline: ${escapeAwardRecommendationHtml(responseDeadline || 'Not set')}</span></div>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${formatAwardRecommendationMoney(awardAmount || recommendation.amount, award.currency || recommendation.currency || 'TZS')}</strong><span>Award amount</span></div>
                        <div><strong>${escapeAwardRecommendationHtml(award.procurementType || 'Tender')}</strong><span>Procurement type</span></div>
                        <div><strong>${standstill.durationDays || 0} days</strong><span>Standstill duration</span></div>
                    </div>
                </section>

                <section class="evaluation-top-summary">
                    <div><span>Tender</span><strong>${escapeAwardRecommendationHtml(award.tenderTitle || '')}</strong></div>
                    <div><span>Reference</span><strong>${escapeAwardRecommendationHtml(award.reference || '')}</strong></div>
                    <div><span>Buyer</span><strong>${escapeAwardRecommendationHtml(award.buyer || '')}</strong></div>
                    <div><span>Evaluation</span>${renderAwardRecommendationBadge(award.evaluationStatus || 'Completed')}</div>
                    <div><span>Supplier</span><strong>${escapeAwardRecommendationHtml(selectedSupplier)}</strong></div>
                </section>

                ${draft.hasRestorableDraft ? `<div class="draft-restore-banner"><strong>Draft from ${escapeAwardRecommendationHtml(draft.lastEditedAt ? new Date(draft.lastEditedAt).toLocaleString() : 'previous session')}</strong><span>Restored from local draft storage for this tender.</span></div>` : ''}

                <section class="award-wizard-page tender-wizard-page">
                    <div class="award-draft-strip">
                        <div>
                            <span class="section-kicker">Resumable workspace</span>
                            <h2>Evaluation Results to Draft Contract</h2>
                        </div>
                        <div class="inline-actions">
                            ${renderAwardRecommendationBadge(draft.draftSaved ? 'Draft saved' : 'Unsaved draft')}
                            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="${escapeAwardRecommendationHtml(currentStep)}">Save Draft</button>
                            <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="${escapeAwardRecommendationHtml(currentStep)}">Save Draft & Exit</button>
                        </div>
                    </div>

                    <div class="wizard-shell award-wizard-shell" data-award-wizard data-award-active-step="${activeStepIndex}">
                        ${renderAwardWizardProgress(awardWorkflowSteps, currentStep)}
                        ${renderAwardWizardRail(awardWorkflowSteps, currentStep)}

                        <div class="award-wizard-main">
                            <div class="wizard-workspace">
                                <section class="journey-panel ${activeStepIndex === 0 ? 'active' : ''}" id="award-step-evaluation-results" data-award-step-panel data-award-step-id="evaluation-result">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 1</span><h2>Evaluation Results</h2></div>
                                        ${renderAwardRecommendationBadge('Evaluation completed')}
                                    </div>
                                    <div class="award-evaluation-summary-grid">
                                        <article><span>Evaluation status</span><strong>Completed</strong></article>
                                        <article><span>Evaluation method</span><strong>${escapeAwardRecommendationHtml(recommendation.method || award.procurementMethod || 'Best evaluated responsive bid')}</strong></article>
                                        <article><span>Procurement type</span><strong>${escapeAwardRecommendationHtml(award.procurementType || 'Tender')}</strong></article>
                                        <article><span>Completion date</span><strong>${escapeAwardRecommendationHtml(evaluation.activeTender?.evaluationDeadline || '2026-06-28')}</strong></article>
                                    </div>
                                    <div class="inline-actions">
                                        <button class="btn btn-secondary" type="button" data-award-guard-navigate data-navigate="bid-evaluation">View Evaluation Report</button>
                                    </div>
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
                                                    <option>First-ranked bidder declined</option>
                                                    <option>First-ranked bidder failed post-qualification</option>
                                                    <option>First-ranked bidder failed clarification</option>
                                                    <option>First-ranked bidder had unresolved compliance issue</option>
                                                    <option>Documented exception</option>
                                                    <option>Other reason</option>
                                                </select>
                                            </label>
                                            <label>Justification for selecting ${escapeAwardRecommendationHtml(selectedSupplier)}
                                                <textarea class="form-input" rows="4" data-award-draft-field="awardDecision.rankJustificationComment" placeholder="Explain why the selected supplier is acceptable for award.">${escapeAwardRecommendationHtml(draft.awardDecision?.rankJustificationComment || '')}</textarea>
                                            </label>
                                        </div>
                                    ` : ''}
                                </section>

                                <section class="journey-panel ${activeStepIndex === 1 ? 'active' : ''}" id="award-step-award-decision" data-award-step-panel data-award-step-id="award-decision">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 2</span><h2>Award Decision</h2></div>
                                        ${renderAwardRecommendationBadge(award.awardStatus || 'Draft')}
                                    </div>
                                    <div class="award-price-comparison">
                                        <article><span>Evaluated corrected price</span><strong>${formatAwardRecommendationMoney(correctedPrice, award.currency || 'TZS')}</strong></article>
                                        <article><span>Entered award amount</span><strong>${formatAwardRecommendationMoney(awardAmount, award.currency || 'TZS')}</strong></article>
                                        <article><span>Difference</span><strong>${formatAwardRecommendationMoney(amountDifference, award.currency || 'TZS')}</strong></article>
                                        <article>${renderAwardRecommendationBadge(amountMismatch ? 'Requires justification' : 'Aligned')}</article>
                                    </div>
                                    <div class="evaluation-form-grid recommendation-form award-decision-form" data-award-validation-form>
                                        <label>Selected supplier <input class="form-input" required ${readonly} data-award-required="Selected supplier" data-award-draft-field="awardDecision.selectedSupplier" value="${escapeAwardRecommendationHtml(selectedSupplier)}">${renderAwardFieldError('Required before confirmation')}</label>
                                        <label>Award amount <input class="form-input" required ${readonly} type="number" data-award-required="Award amount" data-award-draft-field="awardDecision.awardAmount" value="${escapeAwardRecommendationHtml(award.awardAmount || '')}">${renderAwardFieldError('Required before confirmation')}</label>
                                        <label>Currency <input class="form-input" required ${readonly} data-award-required="Currency" data-award-draft-field="awardDecision.currency" value="${escapeAwardRecommendationHtml(award.currency || 'TZS')}">${renderAwardFieldError('Required before confirmation')}</label>
                                        <label>Award decision date <input class="form-input" required ${readonly} type="date" data-award-required="Award decision date" data-award-draft-field="awardDecision.awardDate" value="${escapeAwardRecommendationHtml(draft.awardDecision?.awardDate || '')}">${renderAwardFieldError('Required before confirmation')}</label>
                                        <label>Award reason <textarea class="form-input" required ${readonly} rows="4" data-award-required="Award reason" data-award-draft-field="awardDecision.reason">${escapeAwardRecommendationHtml(award.reason || '')}</textarea>${renderAwardFieldError('Required before confirmation')}</label>
                                        <label>Award conditions <textarea class="form-input" ${readonly} rows="4" data-award-draft-field="awardDecision.conditions">${escapeAwardRecommendationHtml(draft.awardDecision?.conditions || '')}</textarea></label>
                                        <label>Negotiation required <select class="form-input" ${confirmed ? 'disabled aria-disabled="true"' : ''} data-award-draft-field="awardDecision.negotiationRequired"><option ${draft.awardDecision?.negotiationRequired === 'Yes' ? 'selected' : ''}>Yes</option><option ${draft.awardDecision?.negotiationRequired === 'No' ? 'selected' : ''}>No</option></select></label>
                                        <label>Confirmed by <input class="form-input" required ${readonly} data-award-required="Confirmed by" data-award-draft-field="awardDecision.confirmedBy" value="${escapeAwardRecommendationHtml(award.confirmation?.confirmedBy || 'Buyer authority')}">${renderAwardFieldError('Required before confirmation')}</label>
                                        ${amountMismatch ? `
                                            <label>Reason for amount difference <textarea class="form-input" rows="3" data-award-draft-field="awardDecision.amountDifferenceReason">${escapeAwardRecommendationHtml(draft.awardDecision?.amountDifferenceReason || '')}</textarea></label>
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
                                            ['Award reason provided', Boolean(award.reason)],
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
                                        <button class="btn btn-secondary" type="button">Return to Evaluation Results</button>
                                        <button class="btn btn-secondary" type="button">Request Bid Clarification Note</button>
                                        <button class="btn btn-primary" type="button" data-award-confirm-decision data-award-confirm-button data-award-save-continue data-award-next-step="award-notification" data-award-required-action="Prepare Notices" ${confirmed ? '' : 'disabled aria-disabled="true"'}>${confirmed ? 'Award Decision Confirmed' : 'Confirm Award Decision'}</button>
                                    </div>
                                </section>

                                <section class="journey-panel ${activeStepIndex === 2 ? 'active' : ''}" id="award-step-notices" data-award-step-panel data-award-step-id="award-notification">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 3</span><h2>Notice preparation</h2></div>
                                        ${renderAwardRecommendationBadge(requiredNoticesSent ? 'Notices sent' : 'Communication Center pending')}
                                    </div>
                                    <div class="data-table evaluation-table-scroll">
                                        <table>
                                            <thead><tr><th>Notice</th><th>Recipient</th><th>Status</th><th>Deadline</th><th>Action</th></tr></thead>
                                            <tbody data-award-notices-body>${renderAwardRecommendationRows(noticeRows.map(row => [
                                                escapeAwardRecommendationHtml(row.type),
                                                escapeAwardRecommendationHtml(row.recipient),
                                                renderAwardRecommendationBadge(row.status),
                                                escapeAwardRecommendationHtml(row.deadline),
                                                renderAwardNoticeComposeButton(row, draft.tenderId || tender.id || '', award.reference || draft.tenderReference || '', award.tenderTitle || draft.title || '')
                                            ]))}</tbody>
                                        </table>
                                    </div>
                                    ${!requiredNoticesSent ? '<div class="evaluation-notice warning">Contract blocked: prepare and send the selected supplier notice plus bidder/standstill notices through Communication Center.</div>' : ''}
                                    <div class="evaluation-form-grid recommendation-form award-notice-decision-form">
                                        <label>Notice type
                                            <select class="form-input" data-award-draft-field="notification.noticeType">
                                                <option>Notice of Intention to Award</option>
                                                <option>Award Notification</option>
                                                <option>Unsuccessful Bidder Notice</option>
                                            </select>
                                        </label>
                                        <label>Recipient scope
                                            <select class="form-input" data-award-draft-field="notification.recipientScope">
                                                <option>All bidders</option>
                                                <option>Selected supplier only</option>
                                                <option>Unsuccessful bidders only</option>
                                            </select>
                                        </label>
                                        <label>Delivery method
                                            <select class="form-input" data-award-draft-field="notification.deliveryMethod">
                                                <option>ProcureX portal and email</option>
                                                <option>ProcureX portal only</option>
                                                <option>Email and physical letter</option>
                                            </select>
                                        </label>
                                        <label>Response deadline <input class="form-input" type="date" data-award-draft-field="notification.responseDeadline" value="${escapeAwardRecommendationHtml(draft.notification?.responseDeadline || '')}"></label>
                                        <label>Notify unsuccessful bidders <select class="form-input" data-award-draft-field="notification.notifyUnsuccessful"><option ${draft.notification?.notifyUnsuccessful === 'Yes' ? 'selected' : ''}>Yes</option><option ${draft.notification?.notifyUnsuccessful === 'No' ? 'selected' : ''}>No</option></select></label>
                                        <label>Debrief option <select class="form-input" data-award-draft-field="notification.debriefOption"><option>Allow debrief requests</option><option>Do not allow debrief requests</option><option>Debrief by appointment only</option></select></label>
                                        <label>Complaint deadline <input class="form-input" type="date" data-award-draft-field="notification.complaintDeadline" value="${escapeAwardRecommendationHtml(draft.standstill?.complaintDeadline || award.standstillEnd || '')}"></label>
                                        <label>Message to awarded supplier <textarea class="form-input" rows="4" data-award-draft-field="notification.message">${escapeAwardRecommendationHtml(draft.notification?.message || '')}</textarea></label>
                                    </div>
                                    <div class="inline-actions">
                                        <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-notification">Save Draft</button>
                                        <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="standstill-period" data-award-required-action="Monitor Standstill Period">Continue to Standstill</button>
                                    </div>
                                </section>

                                <section class="journey-panel ${activeStepIndex === 3 ? 'active' : ''}" id="award-step-standstill" data-award-step-panel data-award-step-id="standstill-period">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 4</span><h2>Standstill & Complaints</h2></div>
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
                                </section>

                                <section class="journey-panel ${activeStepIndex === 4 ? 'active' : ''}" id="award-step-acceptance" data-award-step-panel data-award-step-id="supplier-acceptance">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 5</span><h2>Supplier Acceptance</h2></div>
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
                                </section>

                                <section class="journey-panel ${activeStepIndex === 5 ? 'active' : ''}" id="award-step-documents" data-award-step-panel data-award-step-id="pre-contract-documents">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 6</span><h2>Pre-Contract Documents</h2></div>
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
                                                `<div class="inline-actions"><label class="btn btn-secondary btn-sm">Upload<input type="file" hidden data-award-document-file data-award-document-id="${escapeAwardRecommendationHtml(row.id)}"></label><button class="btn btn-secondary btn-sm" type="button">${row.fileName ? 'View' : 'View'}</button><button class="btn btn-secondary btn-sm" type="button" data-award-document-remove data-award-document-id="${escapeAwardRecommendationHtml(row.id)}">Remove</button></div>`
                                            ]))}</tbody>
                                        </table>
                                    </div>
                                    ${!requiredDocumentsApproved ? '<div class="evaluation-notice warning">Contract blocked: required buyer pre-contract documents are missing or not uploaded.</div>' : ''}
                                </section>

                                <section class="journey-panel ${activeStepIndex === 6 ? 'active' : ''}" id="award-step-draft-contract" data-award-step-panel data-award-step-id="draft-contract">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 7</span><h2>Draft Contract</h2></div>
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
                                        <button class="btn btn-secondary" type="button" data-award-guard-navigate data-navigate="bid-evaluation">View Evaluation Report</button>
                                        <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="draft-contract">Save Draft & Exit</button>
                                        <button class="btn btn-primary" type="button" ${blockers.some(item => !item.complete) ? 'disabled aria-disabled="true"' : ''} data-award-save-continue data-award-next-step="draft-contract" data-award-required-action="Generate Draft Contract" data-navigate="contract-negotiation" data-route-search="tab=overview">Generate Draft Contract</button>
                                    </div>
                                </section>

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

function initializeAwardRecommendation() {
    const wizard = document.querySelector('[data-award-wizard]');
    const form = document.querySelector('[data-award-validation-form]');
    const button = document.querySelector('[data-award-confirm-button]');

    if (wizard && wizard.dataset.ready !== 'true') {
        wizard.dataset.ready = 'true';
        const panels = Array.from(wizard.querySelectorAll('[data-award-step-panel]'));
        const stepButtons = Array.from(wizard.querySelectorAll('[data-award-step-index]'));
        const previousButton = wizard.querySelector('[data-award-prev]');
        const nextButton = wizard.querySelector('[data-award-next]');
        const progressOutput = wizard.querySelector('[data-award-progress]');
        const stepTitleOutput = wizard.querySelector('[data-award-step-title]');
        let activeStepIndex = Number(wizard.dataset.awardActiveStep || 0);

        const setActiveStep = (index) => {
            activeStepIndex = Math.min(Math.max(index, 0), panels.length - 1);
            panels.forEach((panel, panelIndex) => panel.classList.toggle('active', panelIndex === activeStepIndex));
            stepButtons.forEach(step => {
                const stepIndex = Number(step.dataset.awardStepIndex);
                const active = stepIndex === activeStepIndex;
                step.classList.toggle('active', active);
                step.classList.toggle('completed', stepIndex < activeStepIndex);
                step.setAttribute('aria-current', active ? 'step' : 'false');
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

    if (!form || !button) return;

    const sync = () => {
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
}

if (window.app) {
    window.app.renderAwardRecommendation = renderAwardRecommendation;
}

window.initializeAwardRecommendation = initializeAwardRecommendation;
