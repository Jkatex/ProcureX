// Supplier-side award response workspace for awards received.

const PXAwardResponseUtils = window.ProcureXShared || {};
const escapeAwardResponseHtml = PXAwardResponseUtils.escapeHtml || ((value = '') => String(value));
const formatAwardResponseMoney = PXAwardResponseUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const renderAwardResponseBadge = PXAwardResponseUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapeAwardResponseHtml(value)}</span>`);

function renderAwardResponseTable(headers = [], rows = []) {
    if (PXAwardResponseUtils.renderDataTable) return PXAwardResponseUtils.renderDataTable(headers, rows);
    return `
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr>${headers.map(header => `<th>${escapeAwardResponseHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `;
}

function renderAwardResponseQueueNavLink(label, queue, active = false) {
    return `<li><a href="#" data-award-guard-navigate data-navigate="awarding-contracts" data-route-search="queue=${escapeAwardResponseHtml(queue)}" class="${active ? 'active' : ''}">${escapeAwardResponseHtml(label)}</a></li>`;
}

function getAwardResponseDocuments(row = {}, draft = {}) {
    return draft.documents?.length ? draft.documents : (row.requiredDocuments || [
        { name: 'Performance Security Requirement', owner: 'Buyer', status: row.contractStatus === 'Not Started' ? 'Pending Buyer Upload' : 'Provided' },
        { name: 'Insurance Requirement Record', owner: 'Buyer', status: 'Pending Buyer Upload' },
        { name: 'Payment Details Confirmation', owner: 'Buyer', status: 'Provided' },
        { name: 'Authorized Signatory Record', owner: 'Buyer', status: 'Provided' }
    ]);
}

function getAwardResponseHistory(row = {}) {
    return row.history || [
        { time: '2026-07-01 09:00', actor: row.buyer || 'Buyer', event: 'Award notice issued', status: row.awardStatus || 'Award Received' },
        { time: '2026-07-01 09:05', actor: 'ProcureX', event: 'Supplier response task created', status: row.requiredAction || 'Respond' }
    ];
}

function renderAwardResponsePanel(row = {}, index = 0) {
    const awardId = row.tenderId || `supplier-award-${index + 1}`;
    const draft = typeof loadAwardContractDraft === 'function' ? loadAwardContractDraft(awardId, {
        id: awardId,
        title: row.title,
        organization: row.buyer,
        createdByCurrentUser: false,
        budget: row.awardValue,
        currency: row.currency
    }) : {};
    const response = draft.supplierResponse || row.supplierResponse || {};
    const active = index === 0;
    const responseStatus = response.status || row.awardStatus || 'Awaiting Acceptance';

    return `
        <article class="supplier-award-response-panel ${active ? 'active' : ''}" data-award-response-panel="${escapeAwardResponseHtml(awardId)}" style="${active ? '' : 'display: none;'}">
            <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                <div>
                    <span class="section-kicker">Awards Received</span>
                    <h1>${escapeAwardResponseHtml(row.title || 'Award received')}</h1>
                    <p>Review the award notice, respond as the supplier, and track what is needed before contract preparation.</p>
                    <div class="award-recommended-callout">${renderAwardResponseBadge(responseStatus)}<span>Response deadline: ${escapeAwardResponseHtml(row.dueDate || '2026-07-04')}</span></div>
                </div>
                <div class="evaluation-hero-stats">
                    <div><strong>${formatAwardResponseMoney(row.awardValue, row.currency)}</strong><span>Award value</span></div>
                    <div><strong>${escapeAwardResponseHtml(row.procurementType || 'Tender')}</strong><span>Procurement type</span></div>
                    <div><strong>${escapeAwardResponseHtml(row.contractStatus || 'Not Started')}</strong><span>Contract status</span></div>
                </div>
            </section>

            <section class="evaluation-top-summary">
                <div><span>Supplier role</span><strong>Your organization</strong></div>
                <div><span>Buyer</span><strong>${escapeAwardResponseHtml(row.buyer || '-')}</strong></div>
                <div><span>Award ID</span><strong>${escapeAwardResponseHtml(awardId)}</strong></div>
                <div><span>Status</span>${renderAwardResponseBadge(responseStatus)}</div>
                <div><span>Required action</span><strong>${escapeAwardResponseHtml(row.requiredAction || 'Respond')}</strong></div>
            </section>

            <section class="procurement-panel evaluation-panel">
                <div class="panel-heading">
                    <div><span class="section-kicker">Award notice</span><h2>Supplier response</h2></div>
                    ${renderAwardResponseBadge(response.decision || 'No response recorded')}
                </div>
                <div class="award-control-grid">
                    <article><strong>Awarded by</strong><span>${escapeAwardResponseHtml(row.buyer || '-')}</span></article>
                    <article><strong>Award amount</strong><span>${formatAwardResponseMoney(row.awardValue, row.currency)}</span></article>
                    <article><strong>Award status</strong><span>${escapeAwardResponseHtml(row.awardStatus || '-')}</span></article>
                    <article><strong>Contract preparation</strong><span>${escapeAwardResponseHtml(row.contractStatus || '-')}</span></article>
                </div>
                <div class="evaluation-form-grid recommendation-form">
                    <label>Clarification message <textarea class="form-input" rows="4" data-award-response-message>${escapeAwardResponseHtml(response.message || '')}</textarea></label>
                    <label>Decline reason <textarea class="form-input" rows="4" data-award-response-reason>${escapeAwardResponseHtml(response.reason || '')}</textarea></label>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-primary" type="button" data-award-response-action="accept" data-award-id="${escapeAwardResponseHtml(awardId)}">Accept Award</button>
                    <button class="btn btn-secondary" type="button" data-award-response-action="clarify" data-award-id="${escapeAwardResponseHtml(awardId)}">Request Clarification</button>
                    <button class="btn btn-secondary" type="button" data-award-response-action="decline" data-award-id="${escapeAwardResponseHtml(awardId)}">Decline Award</button>
                    <button class="btn btn-secondary" type="button" data-navigate="contract-negotiation" data-route-search="tab=overview" data-select-tender="${escapeAwardResponseHtml(awardId)}">Open Contract Review</button>
                </div>
                <div class="evaluation-notice success" data-award-response-status>Current supplier response: ${escapeAwardResponseHtml(responseStatus)}</div>
            </section>

            <section class="procurement-panel evaluation-panel">
                <div class="panel-heading">
                    <div><span class="section-kicker">Pre-contract documents</span><h2>Buyer-provided document set</h2></div>
                    ${renderAwardResponseBadge('Buyer managed')}
                </div>
                ${renderAwardResponseTable(
                    ['Document', 'Owner', 'Status', 'Action'],
                    getAwardResponseDocuments(row, draft).map(documentRow => `
                        <tr>
                            <td><strong>${escapeAwardResponseHtml(documentRow.name)}</strong></td>
                            <td>${escapeAwardResponseHtml(documentRow.owner || 'Buyer')}</td>
                            <td>${renderAwardResponseBadge(documentRow.status)}</td>
                            <td><button class="btn btn-secondary btn-sm" type="button">${/provided|uploaded|verified|current|locked/i.test(documentRow.status || '') ? 'View' : 'Download'}</button></td>
                        </tr>
                    `)
                )}
            </section>

            <section class="procurement-panel evaluation-panel">
                <div class="panel-heading">
                    <div><span class="section-kicker">Contract preparation</span><h2>Handoff status</h2></div>
                    ${renderAwardResponseBadge(row.contractStatus || 'Not Started')}
                </div>
                <div class="status-pipeline horizontal">
                    <div class="done"><strong>Award Notice</strong><span>Notice received by supplier</span></div>
                    <div class="${/accepted|review|signature/i.test(row.awardStatus || '') ? 'done' : 'current'}"><strong>Supplier Response</strong><span>Accept, clarify, or decline</span></div>
                    <div class="${/review|signature/i.test(row.contractStatus || '') ? 'current' : ''}"><strong>Contract Review</strong><span>Buyer prepares draft terms</span></div>
                    <div><strong>Signature</strong><span>Contract moves to signing</span></div>
                </div>
                ${renderAwardResponseTable(
                    ['Time', 'Actor', 'Event', 'Status'],
                    getAwardResponseHistory(row).map(historyRow => `
                        <tr>
                            <td>${escapeAwardResponseHtml(historyRow.time)}</td>
                            <td>${escapeAwardResponseHtml(historyRow.actor)}</td>
                            <td>${escapeAwardResponseHtml(historyRow.event)}</td>
                            <td>${renderAwardResponseBadge(historyRow.status)}</td>
                        </tr>
                    `)
                )}
            </section>
        </article>
    `;
}

function renderAwardResponse() {
    const awards = mockData.awardingContracts?.awardedToUs || [];
    return `
        <div class="main-layout procurement-layout evaluation-app-layout award-response-page">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head"><h3>Awards Received</h3><span>Supplier response workspace</span></div>
                <ul class="sidebar-nav">
                    ${renderAwardResponseQueueNavLink('My Urgent Actions', 'my-urgent-actions')}
                    ${renderAwardResponseQueueNavLink('Awarding in Progress', 'awarding-in-progress')}
                    ${renderAwardResponseQueueNavLink('Awards Received', 'awards-received', true)}
                    ${renderAwardResponseQueueNavLink('Contract Negotiation', 'contracts-in-progress')}
                    ${renderAwardResponseQueueNavLink('Active Contracts', 'active-contracts')}
                    ${renderAwardResponseQueueNavLink('Closed Contracts', 'closed-contracts')}
                    <li><a href="#" data-award-guard-navigate data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content award-response-workspace">
                <section class="procurement-panel evaluation-panel">
                    <div class="panel-heading">
                        <div><span class="section-kicker">Supplier awards</span><h2>Select an award response</h2></div>
                        ${renderAwardResponseBadge(`${awards.length} awards`)}
                    </div>
                    <div class="supplier-detail-tabs awarding-contract-tabs" role="tablist" aria-label="Supplier awards received">
                        ${awards.map((row, index) => {
                            const awardId = row.tenderId || `supplier-award-${index + 1}`;
                            return `<button class="supplier-detail-tab ${index === 0 ? 'active' : ''}" type="button" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" data-award-response-jump="${escapeAwardResponseHtml(awardId)}">${escapeAwardResponseHtml(row.title)}</button>`;
                        }).join('')}
                    </div>
                </section>
                ${awards.map(renderAwardResponsePanel).join('')}
            </main>
        </div>
    `;
}

function initializeAwardResponse() {
    const params = new URLSearchParams(window.location.search);
    const initialAward = params.get('award') || document.querySelector('[data-award-response-panel]')?.getAttribute('data-award-response-panel') || '';

    const activateAward = (awardId = '') => {
        document.querySelectorAll('[data-award-response-panel]').forEach(panel => {
            const active = panel.getAttribute('data-award-response-panel') === awardId;
            panel.classList.toggle('active', active);
            panel.style.display = active ? '' : 'none';
        });
        document.querySelectorAll('[data-award-response-jump]').forEach(button => {
            const active = button.getAttribute('data-award-response-jump') === awardId;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
    };

    document.querySelectorAll('[data-award-response-jump]').forEach(button => {
        button.addEventListener('click', () => activateAward(button.getAttribute('data-award-response-jump') || ''));
    });

    document.querySelectorAll('[data-award-response-action]').forEach(button => {
        button.addEventListener('click', () => {
            const awardId = button.getAttribute('data-award-id') || '';
            const panel = button.closest('[data-award-response-panel]');
            const action = button.getAttribute('data-award-response-action') || '';
            const message = panel?.querySelector('[data-award-response-message]')?.value || '';
            const reason = panel?.querySelector('[data-award-response-reason]')?.value || '';
            const decisionLabels = {
                accept: 'Award Accepted',
                clarify: 'Clarification Requested',
                decline: 'Award Declined'
            };
            const status = decisionLabels[action] || 'Response Recorded';
            const statusOutput = panel?.querySelector('[data-award-response-status]');
            if (statusOutput) statusOutput.textContent = `Current supplier response: ${status}`;

            if (typeof saveAwardContractDraft === 'function') {
                saveAwardContractDraft(awardId, {
                    currentStep: action === 'accept' ? 'pre-contract-documents' : 'supplier-acceptance',
                    requiredAction: action === 'accept' ? 'Review Buyer Documents' : 'Await Buyer Response',
                    supplierResponse: {
                        decision: action,
                        message,
                        reason,
                        respondedAt: new Date().toISOString(),
                        status
                    }
                });
            }
        });
    });

    activateAward(initialAward);
}

if (window.app) {
    window.app.renderAwardResponse = renderAwardResponse;
}

window.initializeAwardResponse = initializeAwardResponse;
