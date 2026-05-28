// Buyer-side award workflow after evaluation completion.

const PXAwardUtils = window.ProcureXShared || {};
const escapeAwardRecommendationHtml = PXAwardUtils.escapeHtml || ((value = '') => String(value));
const formatAwardRecommendationMoney = PXAwardUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const formatAwardRecommendationDate = PXAwardUtils.formatDate || ((value = '') => value || '-');
const renderAwardRecommendationBadge = PXAwardUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapeAwardRecommendationHtml(value)}</span>`);

function renderAwardRecommendationRows(rows = []) {
    return rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
}

function getAwardRecommendationStepState(stepId, currentStep) {
    const order = ['evaluation-result', 'award-decision', 'award-notification', 'standstill-period', 'supplier-acceptance', 'draft-contract'];
    const currentIndex = Math.max(0, order.indexOf(currentStep || 'award-decision'));
    const index = order.indexOf(stepId);
    if (index < currentIndex) return 'complete';
    if (index === currentIndex) return 'current';
    return 'upcoming';
}

function renderAwardWorkflowStepper(steps, currentStep) {
    return `
        <div class="award-stepper" role="list" aria-label="Award workflow progress">
            ${steps.map((step, index) => {
                const state = getAwardRecommendationStepState(step.id, currentStep);
                const marker = state === 'complete' ? '✓' : String(index + 1).padStart(2, '0');
                return `
                    <button class="award-stepper-item ${state}" type="button" role="listitem" ${state === 'upcoming' ? 'disabled aria-disabled="true"' : `data-scroll-target="${escapeAwardRecommendationHtml(step.target)}"`} aria-label="${escapeAwardRecommendationHtml(step.title)}. Status: ${escapeAwardRecommendationHtml(state)}">
                        <strong>${marker}</strong>
                        <span>${escapeAwardRecommendationHtml(step.title)}</span>
                        <em>${escapeAwardRecommendationHtml(step.meta)}</em>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function getStandstillStatus(award = {}) {
    const now = new Date();
    const start = award.standstillStart ? new Date(award.standstillStart) : null;
    const end = award.standstillEnd ? new Date(award.standstillEnd) : null;
    const unresolvedComplaint = award.complaintsReceived && award.complaintsReceived !== 'None' && !award.complaintsResolved;
    const active = Boolean(end && now <= end);
    const blocked = active || unresolvedComplaint;
    const daysRemaining = end && !Number.isNaN(end.getTime()) ? Math.max(0, Math.ceil((end - now) / 86400000)) : 0;
    return { start, end, active, blocked, unresolvedComplaint, daysRemaining };
}

function renderAwardFieldError(message) {
    return `<small class="field-error" aria-live="polite">${escapeAwardRecommendationHtml(message)}</small>`;
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
        approval: {
            ...(lifecycle.award?.approval || {}),
            approver: draft.awardDecision?.approver || lifecycle.award?.approval?.approver,
            date: draft.awardDecision?.awardDate || lifecycle.award?.approval?.date,
            status: draft.awardDecision?.approvalConfirmed ? 'Approved' : 'Pending'
        },
        notices: lifecycle.award?.notices || [],
        supplierResponses: lifecycle.award?.supplierResponses || []
    };
    const evaluation = mockData.bidEvaluation || {};
    const bids = evaluation.bids || [];
    const recommendation = evaluation.recommendation || {};
    const criteria = (evaluation.technicalCriteria || []).filter(criterion => !/financial|price/i.test(String(criterion.name || criterion.label || '')));
    const technicalTotal = bid => criteria.reduce((sum, criterion) => sum + Number(bid.technicalScores?.[criterion.id] || 0), 0);
    const rankedBids = bids.slice().sort((a, b) => (a.financial?.ranking || 99) - (b.financial?.ranking || 99));
    const selectedSupplier = award.selectedSupplier || recommendation.supplier || rankedBids[0]?.supplier || 'Recommended supplier';
    const nextRankedSupplier = rankedBids.find(bid => bid.supplier !== selectedSupplier)?.supplier || 'Next ranked responsive bidder';
    const approved = Boolean(draft.awardDecision?.approvalConfirmed);
    const standstill = getStandstillStatus(award);
    const currentStep = draft.currentStep || 'award-decision';
    const responseDeadline = draft.notification?.responseDeadline || award.notices?.find(row => /award notification/i.test(row.type || ''))?.deadline || award.standstillEnd || '';
    const steps = [
        { id: 'evaluation-result', title: 'Evaluation', meta: 'Complete', target: 'ranked-bidders' },
        { id: 'award-decision', title: 'Award Decision', meta: 'Required fields and COI', target: 'award-approval' },
        { id: 'award-notification', title: 'Notice', meta: 'Send and notify bidders', target: 'award-notification' },
        { id: 'standstill-period', title: 'Standstill', meta: standstill.blocked ? `${standstill.daysRemaining} days remaining` : 'Window clear', target: 'standstill-period' },
        { id: 'supplier-acceptance', title: 'Acceptance', meta: 'Supplier response', target: 'award-notification' },
        { id: 'draft-contract', title: 'Draft Contract', meta: standstill.blocked ? 'Blocked' : 'Ready when accepted', target: 'contract-unlock' }
    ];
    const readonly = approved ? 'readonly aria-readonly="true"' : '';

    return `
        <div class="main-layout procurement-layout evaluation-app-layout award-page" data-award-contract-workspace data-award-current-step="${escapeAwardRecommendationHtml(currentStep)}" data-award-tender-id="${escapeAwardRecommendationHtml(draft.tenderId || tender.id || '')}">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Award Decision</h3>
                    <span>${escapeAwardRecommendationHtml(award.reference || 'Evaluation report')}</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-award-guard-navigate data-navigate="awarding-contracts">Awarding Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="bid-evaluation">Back to Evaluation</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="contract-negotiation">Contract Workspace</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content evaluation-workspace">
                <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                    <div>
                        <span class="section-kicker">Buyer / awarder path</span>
                        <h1>${escapeAwardRecommendationHtml(award.tenderTitle || 'Award Decision')}</h1>
                        <p>${escapeAwardRecommendationHtml(award.reason || 'Award package is compiled from the finalized evaluation report, ranking table, corrections, conditions, and audit trail.')}</p>
                        <div class="award-recommended-callout">${renderAwardRecommendationBadge(`Recommended winner: ${selectedSupplier}`)}<span>Supplier response deadline: ${escapeAwardRecommendationHtml(responseDeadline || 'Not set')}</span></div>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${formatAwardRecommendationMoney(award.awardAmount || recommendation.amount, award.currency || recommendation.currency || 'TZS')}</strong><span>Award amount</span></div>
                        <div><strong>${escapeAwardRecommendationHtml(award.procurementType || 'Tender')}</strong><span>Procurement type</span></div>
                        <div><strong>${standstill.blocked ? `${standstill.daysRemaining} days` : 'Clear'}</strong><span>Standstill</span></div>
                    </div>
                </section>

                ${draft.hasRestorableDraft ? `<div class="draft-restore-banner"><strong>Draft from ${escapeAwardRecommendationHtml(draft.lastEditedAt ? new Date(draft.lastEditedAt).toLocaleString() : 'previous session')}</strong><span>Restored from local draft storage for this tender.</span></div>` : ''}

                <section class="evaluation-top-summary">
                    <div><span>Tender</span><strong>${escapeAwardRecommendationHtml(award.tenderTitle || '')}</strong></div>
                    <div><span>Reference</span><strong>${escapeAwardRecommendationHtml(award.reference || '')}</strong></div>
                    <div><span>Buyer</span><strong>${escapeAwardRecommendationHtml(award.buyer || '')}</strong></div>
                    <div><span>Evaluation</span>${renderAwardRecommendationBadge(award.evaluationStatus || 'Completed')}</div>
                    <div><span>Supplier</span><strong>${escapeAwardRecommendationHtml(selectedSupplier)}</strong></div>
                </section>

                <section class="procurement-panel evaluation-panel award-draft-control-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Resumable workspace</span>
                            <h2>Save this tender and return to the start page any time</h2>
                        </div>
                        ${renderAwardRecommendationBadge(draft.draftSaved ? 'Draft saved' : 'Unsaved draft')}
                    </div>
                    <div class="award-control-grid">
                        <article><strong>Current step</strong><span>${escapeAwardRecommendationHtml(currentStep)}</span></article>
                        <article><strong>Required action</strong><span>${escapeAwardRecommendationHtml(draft.requiredAction || 'Continue Award')}</span></article>
                        <article><strong>Last edited</strong><span>${escapeAwardRecommendationHtml(draft.lastEditedAt ? new Date(draft.lastEditedAt).toLocaleString() : 'Not saved')}</span></article>
                    </div>
                    <div class="inline-actions">
                        <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-decision">Save Draft</button>
                        <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="award-decision">Save Draft & Exit</button>
                        <button class="btn btn-secondary" type="button" data-award-guard-navigate data-navigate="awarding-contracts">Open Another Tender</button>
                    </div>
                </section>

                <section class="award-workflow-map">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Awarding controls</span>
                            <h2>Evaluation result to accepted award</h2>
                        </div>
                        ${renderAwardRecommendationBadge('Pre-contract')}
                    </div>
                    ${renderAwardWorkflowStepper(steps, currentStep)}
                </section>

                <section class="procurement-panel evaluation-panel" id="ranked-bidders">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Final ranked bidders</span>
                            <h2>Buyer confirms the recommended winner</h2>
                        </div>
                        ${renderAwardRecommendationBadge(`Recommended: ${selectedSupplier}`)}
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
                </section>

                <section class="procurement-panel evaluation-panel" id="award-approval">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Award approval</span>
                            <h2>Authorized representative confirmation</h2>
                        </div>
                        ${renderAwardRecommendationBadge(award.approval?.status || 'Pending')}
                    </div>
                    <div class="award-control-grid">
                        <article><strong>Selected supplier</strong><span>${escapeAwardRecommendationHtml(selectedSupplier)}</span></article>
                        <article><strong>Award value</strong><span>${formatAwardRecommendationMoney(award.awardAmount, award.currency)}</span></article>
                        <article><strong>Approver</strong><span>${escapeAwardRecommendationHtml(award.approval?.approver || 'Authorized representative')}</span></article>
                        <article><strong>Approval date</strong><span>${escapeAwardRecommendationHtml(award.approval?.date || 'Pending')}</span></article>
                    </div>
                    <div class="evaluation-form-grid recommendation-form award-decision-form" data-award-validation-form>
                        <label>Selected supplier <input class="form-input" required ${readonly} data-award-required="Selected supplier" data-award-draft-field="awardDecision.selectedSupplier" value="${escapeAwardRecommendationHtml(selectedSupplier)}">${renderAwardFieldError('Required before approval')}</label>
                        <label>Award amount <input class="form-input" required ${readonly} type="number" data-award-required="Award amount" data-award-draft-field="awardDecision.awardAmount" value="${escapeAwardRecommendationHtml(award.awardAmount || '')}">${renderAwardFieldError('Required before approval')}</label>
                        <label>Currency <input class="form-input" required ${readonly} data-award-required="Currency" data-award-draft-field="awardDecision.currency" value="${escapeAwardRecommendationHtml(award.currency || 'TZS')}">${renderAwardFieldError('Required before approval')}</label>
                        <label>Award decision date <input class="form-input" required ${readonly} type="date" data-award-required="Award decision date" data-award-draft-field="awardDecision.awardDate" value="${escapeAwardRecommendationHtml(draft.awardDecision?.awardDate || '')}">${renderAwardFieldError('Required before approval')}</label>
                        <label>Award reason <textarea class="form-input" required ${readonly} rows="4" data-award-required="Award reason" data-award-draft-field="awardDecision.reason">${escapeAwardRecommendationHtml(award.reason || '')}</textarea>${renderAwardFieldError('Required before approval')}</label>
                        <label>Award conditions <textarea class="form-input" ${readonly} rows="4" data-award-draft-field="awardDecision.conditions">${escapeAwardRecommendationHtml(draft.awardDecision?.conditions || '')}</textarea></label>
                        <label>Negotiation required <select class="form-input" ${approved ? 'disabled aria-disabled="true"' : ''} data-award-draft-field="awardDecision.negotiationRequired"><option ${draft.awardDecision?.negotiationRequired === 'Yes' ? 'selected' : ''}>Yes</option><option ${draft.awardDecision?.negotiationRequired === 'No' ? 'selected' : ''}>No</option></select></label>
                        <label>Authorized representative <input class="form-input" required ${readonly} data-award-required="Authorized representative" data-award-draft-field="awardDecision.approver" value="${escapeAwardRecommendationHtml(award.approval?.approver || '')}">${renderAwardFieldError('Required before approval')}</label>
                        <fieldset class="award-coi-panel">
                            <legend>Conflict of Interest Declaration</legend>
                            <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.coiDeclared" ${draft.awardDecision?.coiDeclared ? 'checked' : ''} ${approved ? 'disabled' : ''}> I confirm that I have no personal or financial interest in the recommended supplier.</label>
                            <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.basedOnEvaluation" ${draft.awardDecision?.basedOnEvaluation ? 'checked' : ''} ${approved ? 'disabled' : ''}> I confirm that the award is based solely on the evaluation results.</label>
                            <label>Declaration by <input class="form-input" ${readonly} data-award-draft-field="awardDecision.coiDeclaredBy" value="${escapeAwardRecommendationHtml(draft.awardDecision?.coiDeclaredBy || award.approval?.approver || '')}"></label>
                        </fieldset>
                        <label class="confirm-inline"><input type="checkbox" data-award-required-checkbox data-award-draft-field="awardDecision.approvalConfirmed" ${draft.awardDecision?.approvalConfirmed ? 'checked' : ''} ${approved ? 'disabled' : ''}> I confirm that this award decision is based on the approved evaluation results.</label>
                    </div>
                    <div class="evaluation-notice success">${escapeAwardRecommendationHtml(award.approval?.note || 'Approval record will be stored in the award audit trail.')}</div>
                    <div class="inline-actions">
                        <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-decision">Save Draft</button>
                        <button class="btn btn-primary" type="button" data-award-approval-button data-award-save-continue data-award-next-step="award-notification" data-award-required-action="Send Award Notification" ${approved ? 'disabled aria-disabled="true"' : 'disabled aria-disabled="true"'}>Approve Award Decision</button>
                    </div>
                </section>

                <section class="procurement-panel evaluation-panel" id="award-notification">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Notices and supplier response</span>
                            <h2>Notification before contracting</h2>
                        </div>
                        ${renderAwardRecommendationBadge('Awaiting supplier acceptance')}
                    </div>
                    <div class="data-table evaluation-table-scroll">
                        <table>
                            <thead><tr><th>Notice</th><th>Recipient</th><th>Status</th><th>Deadline</th></tr></thead>
                            <tbody>${renderAwardRecommendationRows((award.notices || []).map(row => [escapeAwardRecommendationHtml(row.type), escapeAwardRecommendationHtml(row.recipient), renderAwardRecommendationBadge(row.status), escapeAwardRecommendationHtml(row.deadline)]))}</tbody>
                        </table>
                    </div>
                    <div class="evaluation-form-grid recommendation-form">
                        <label>Notification subject <input class="form-input" data-award-draft-field="notification.subject" value="${escapeAwardRecommendationHtml(draft.notification?.subject || '')}"></label>
                        <label>Response deadline <input class="form-input" type="date" data-award-draft-field="notification.responseDeadline" value="${escapeAwardRecommendationHtml(draft.notification?.responseDeadline || '')}"></label>
                        <label>Notify unsuccessful bidders <select class="form-input" data-award-draft-field="notification.notifyUnsuccessful"><option ${draft.notification?.notifyUnsuccessful === 'Yes' ? 'selected' : ''}>Yes</option><option ${draft.notification?.notifyUnsuccessful === 'No' ? 'selected' : ''}>No</option></select></label>
                        <label>Message to awarded supplier <textarea class="form-input" rows="4" data-award-draft-field="notification.message">${escapeAwardRecommendationHtml(draft.notification?.message || '')}</textarea></label>
                    </div>
                    <div class="award-control-grid">
                        ${(award.supplierResponses || []).map(row => `
                            <article>
                                <strong>${escapeAwardRecommendationHtml(row.action)}</strong>
                                <span>${escapeAwardRecommendationHtml(row.detail)}</span>
                                ${renderAwardRecommendationBadge(row.status)}
                            </article>
                        `).join('')}
                    </div>
                    <div class="award-fallback-panel">
                        <strong>Supplier decline fallback</strong>
                        <span>If the winning supplier declines, this prototype can prefill the next-ranked responsive bidder and preview the re-award audit entry.</span>
                        <div class="inline-actions">
                            <button class="btn btn-secondary" type="button">Award to Next Ranked Bidder: ${escapeAwardRecommendationHtml(nextRankedSupplier)}</button>
                            <button class="btn btn-secondary" type="button">Cancel Award Process</button>
                        </div>
                        <small>Audit preview: decline reason and re-award timestamp will be recorded before a new approval cycle starts.</small>
                    </div>
                    <div class="inline-actions">
                        <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="award-notification">Save Draft</button>
                        <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="standstill-period" data-award-required-action="Monitor Standstill Period">Send Award Notification</button>
                    </div>
                </section>

                <section class="procurement-panel evaluation-panel" id="standstill-period">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Standstill Period</span>
                            <h2>Complaint window before contracting</h2>
                        </div>
                        ${renderAwardRecommendationBadge(standstill.blocked ? 'Contract blocked' : 'Window clear')}
                    </div>
                    <div class="award-control-grid">
                        <article><strong>Notice date</strong><span>${formatAwardRecommendationDate(award.noticeDate, 'Not sent')}</span></article>
                        <article><strong>Standstill start</strong><span>${formatAwardRecommendationDate(award.standstillStart, 'Not set')}</span></article>
                        <article><strong>Standstill end</strong><span>${formatAwardRecommendationDate(award.standstillEnd, 'Not set')}</span></article>
                        <article><strong>Complaints</strong><span>${escapeAwardRecommendationHtml(award.complaintsReceived || 'None')}</span>${renderAwardRecommendationBadge(award.complaintsResolved ? 'Resolved' : 'Unresolved')}</article>
                    </div>
                    <div class="evaluation-notice ${standstill.blocked ? 'warning' : 'success'}">${standstill.blocked ? 'Draft contract generation is blocked until the standstill window closes and any complaints are resolved.' : 'Standstill and complaint conditions are clear for contract generation.'}</div>
                </section>

                <section class="procurement-panel evaluation-panel" id="contract-unlock">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Contract unlock rule</span>
                            <h2>Awarding chooses the winner, contracting agrees the final terms</h2>
                        </div>
                    </div>
                    <div class="evaluation-notice ${standstill.blocked ? 'warning' : 'success'}">Contract negotiation opens only after award approval, notice controls, standstill/complaint handling, and supplier acceptance are satisfied.</div>
                    <div class="inline-actions">
                        <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="supplier-acceptance">Save Draft & Exit</button>
                        <button class="btn btn-secondary" type="button" data-award-guard-navigate data-navigate="bid-evaluation">Preview Evaluation Report</button>
                        <button class="btn btn-primary" type="button" ${standstill.blocked ? 'disabled aria-disabled="true"' : ''} data-award-save-continue data-award-next-step="draft-contract" data-award-required-action="Generate Draft Contract" data-navigate="contract-negotiation">Generate Draft Contract</button>
                    </div>
                </section>
            </main>
        </div>
    `;
}

function initializeAwardRecommendation() {
    document.querySelectorAll('[data-scroll-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = document.getElementById(button.getAttribute('data-scroll-target'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    const form = document.querySelector('[data-award-validation-form]');
    const button = document.querySelector('[data-award-approval-button]');
    if (!form || !button) return;

    const sync = () => {
        const fieldsValid = [...form.querySelectorAll('[data-award-required]')].every(field => String(field.value || '').trim());
        const checksValid = [...form.querySelectorAll('[data-award-required-checkbox]')].every(field => field.checked);
        const valid = fieldsValid && checksValid;
        button.disabled = !valid;
        button.setAttribute('aria-disabled', String(!valid));
        form.classList.toggle('is-valid', valid);
    };

    form.querySelectorAll('input, textarea, select').forEach(field => {
        field.addEventListener('input', sync);
        field.addEventListener('change', sync);
    });
    sync();
}

if (window.app) {
    window.app.renderAwardRecommendation = renderAwardRecommendation;
}

window.initializeAwardRecommendation = initializeAwardRecommendation;
