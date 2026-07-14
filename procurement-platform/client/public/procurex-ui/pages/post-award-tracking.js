// Post-award execution workspace for delivery, payments, issues, variations, closure, and performance.

const PXPostAwardUtils = window.ProcureXShared || {};
const escapePostAwardHtml = PXPostAwardUtils.escapeHtml || ((value = '') => String(value));
const formatPostAwardMoney = PXPostAwardUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const renderPostAwardBadge = PXPostAwardUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapePostAwardHtml(value)}</span>`);

function renderPostAwardTable(headers = [], rows = []) {
    if (PXPostAwardUtils.renderDataTable) return PXPostAwardUtils.renderDataTable(headers, rows);
    return `
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr>${headers.map(header => `<th>${escapePostAwardHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `;
}

function renderPostAwardQueueNavLink(label, queue, active = false) {
    return `<li><a href="#" data-award-guard-navigate data-navigate="awarding-contracts" data-route-search="queue=${escapePostAwardHtml(queue)}" class="${active ? 'active' : ''}">${escapePostAwardHtml(label)}</a></li>`;
}

function renderMatchStatus(matchStatus = {}) {
    const parts = [
        ['PO', matchStatus.po],
        ['Certificate', matchStatus.certificate],
        ['Invoice', matchStatus.invoice]
    ];
    return `<div class="match-status">${parts.map(([label, ok]) => `<span class="${ok ? 'matched' : 'mismatch'}">${escapePostAwardHtml(label)} ${ok ? '✓' : '!'}</span>`).join('')}</div>`;
}

function parseVariationMoney(value = '') {
    const amount = String(value).replace(/[^\d.-]/g, '');
    return Number(amount || 0);
}

function parseVariationDays(value = '') {
    const amount = String(value).match(/-?\d+/);
    return amount ? Number(amount[0]) : 0;
}

function renderStars(rating = 0, label = '') {
    const count = Number(rating || 0);
    return `
        <div class="star-rating" role="radiogroup" aria-label="${escapePostAwardHtml(label)} rating">
            ${[1, 2, 3, 4, 5].map(value => `<button type="button" role="radio" aria-checked="${value === count ? 'true' : 'false'}" class="${value <= count ? 'active' : ''}">★</button>`).join('')}
        </div>
    `;
}

function renderClosedContractPanels(closedContracts = []) {
    return `
        <section class="procurement-panel evaluation-panel post-award-closed-panel" data-post-award-mode-panel="closed" style="display: none;">
            <div class="panel-heading">
                <div><span class="section-kicker">Closed contracts</span><h2>Read-only closure records</h2></div>
                ${renderPostAwardBadge(`${closedContracts.length} archived`)}
            </div>
            <div class="data-table evaluation-table-scroll">
                <table>
                    <thead><tr><th>Contract</th><th>Role</th><th>Other Party</th><th>Final Value</th><th>Completion Date</th><th>Performance</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                        ${closedContracts.map((row, index) => `
                            <tr>
                                <td><strong>${escapePostAwardHtml(row.title)}</strong></td>
                                <td>${renderPostAwardBadge(row.role)}</td>
                                <td>${escapePostAwardHtml(row.otherParty)}</td>
                                <td>${formatPostAwardMoney(row.finalValue, row.currency)}</td>
                                <td>${escapePostAwardHtml(row.completionDate)}</td>
                                <td>${escapePostAwardHtml(row.performanceRating)}</td>
                                <td>${renderPostAwardBadge(row.status)}</td>
                                <td><button class="btn btn-secondary btn-sm" type="button" data-closed-contract-jump="closed-contract-${index + 1}">View Closure</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="closed-contract-detail-stack">
                ${closedContracts.map((row, index) => `
                    <article class="closed-contract-detail ${index === 0 ? 'active' : ''}" data-closed-contract-panel="closed-contract-${index + 1}" style="${index === 0 ? '' : 'display: none;'}">
                        <div class="panel-heading">
                            <div><span class="section-kicker">Closure detail</span><h3>${escapePostAwardHtml(row.title)}</h3></div>
                            ${renderPostAwardBadge(row.status)}
                        </div>
                        <section class="contract-overview-grid">
                            <article><span>Final value</span><strong>${formatPostAwardMoney(row.finalValue, row.currency)}</strong></article>
                            <article><span>Completion date</span><strong>${escapePostAwardHtml(row.completionDate)}</strong></article>
                            <article><span>Performance</span><strong>${escapePostAwardHtml(row.performanceRating)}</strong></article>
                            <article><span>Record state</span><strong>Read-only archive</strong></article>
                        </section>
                        <div class="award-control-grid">
                            <article><strong>Deliverables</strong><span>Completed and accepted</span></article>
                            <article><strong>Inspections</strong><span>Final inspection recorded</span></article>
                            <article><strong>Invoices</strong><span>Processed or reconciled</span></article>
                            <article><strong>Disputes</strong><span>Resolved before closure</span></article>
                            <article><strong>Performance security</strong><span>Release decision recorded</span></article>
                            <article><strong>Supplier rating</strong><span>${escapePostAwardHtml(row.performanceRating)}</span></article>
                        </div>
                        <div class="evaluation-notice success">This closure record is archived. Changes require a formal reopening or amendment workflow.</div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function renderPostAwardTracking() {
    const context = typeof getAwardContractLifecycleContext === 'function' ? getAwardContractLifecycleContext() : null;
    const draft = context?.draft || {};
    const contract = context?.contract || {};
    const execution = {
        ...(mockData.awardingContracts?.execution || {}),
        contractId: contract.contractId || mockData.awardingContracts?.execution?.contractId,
        title: contract.title || mockData.awardingContracts?.execution?.title,
        supplier: contract.supplier || mockData.awardingContracts?.execution?.supplier,
        buyer: contract.buyer || mockData.awardingContracts?.execution?.buyer,
        contractValue: contract.value || mockData.awardingContracts?.execution?.contractValue,
        currency: contract.currency || mockData.awardingContracts?.execution?.currency,
        status: draft.currentStep === 'execution' ? 'In Progress' : (mockData.awardingContracts?.execution?.status || 'In Progress')
    };
    const closedContracts = mockData.awardingContracts?.closedContracts || [];
    const paid = (execution.invoices || []).filter(invoice => /paid/i.test(invoice.status || '')).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const invoiced = (execution.invoices || []).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const averagePerformance = (execution.performance || []).length
        ? ((execution.performance || []).reduce((sum, row) => sum + Number(row.rating || 0), 0) / execution.performance.length).toFixed(1)
        : '0.0';
    const mandatoryClosure = (execution.closureChecklist || []).filter(row => row.mandatory !== false);
    const completeClosure = mandatoryClosure.filter(row => row.complete || /complete|resolved|processed|rated/i.test(row.status || '')).length;
    const closureReady = mandatoryClosure.length > 0 && completeClosure === mandatoryClosure.length;
    const totalVariationValue = (execution.variations || []).reduce((sum, row) => sum + parseVariationMoney(row.priceImpact), 0);
    const totalVariationDays = (execution.variations || []).reduce((sum, row) => sum + parseVariationDays(row.timelineImpact), 0);

    return `
        <div class="main-layout procurement-layout evaluation-app-layout post-award-page" data-award-contract-workspace data-award-current-step="execution" data-award-tender-id="${escapePostAwardHtml(draft.tenderId || '')}">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head"><h3>Post-Award Tracking</h3><span>Contract #${escapePostAwardHtml(execution.contractId || 'Active')}</span></div>
                <ul class="sidebar-nav">
                    ${renderPostAwardQueueNavLink('My Urgent Actions', 'my-urgent-actions')}
                    ${renderPostAwardQueueNavLink('Awarding in Progress', 'awarding-in-progress')}
                    ${renderPostAwardQueueNavLink('Awards Received', 'awards-received')}
                    ${renderPostAwardQueueNavLink('Contract Negotiation', 'contracts-in-progress')}
                    ${renderPostAwardQueueNavLink('Active Contracts', 'active-contracts', true)}
                    ${renderPostAwardQueueNavLink('Closed Contracts', 'closed-contracts')}
                    <li><a href="#" data-award-guard-navigate data-navigate="contract-negotiation" data-route-search="tab=signatures">Back to Contract</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content post-award-workspace">
                <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                    <div>
                        <span class="section-kicker">Contract execution and monitoring</span>
                        <h1>${escapePostAwardHtml(execution.title || 'Active contract')}</h1>
                        <p>After signing, delivery, inspection, invoices, issues, variations, closure, and supplier performance are managed here.</p>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${execution.progress || 0}%</strong><span>Delivery progress</span></div>
                        <div><strong>${formatPostAwardMoney(paid, execution.currency)}</strong><span>Paid</span></div>
                        <div><strong>${averagePerformance}/5</strong><span>Performance</span></div>
                    </div>
                </section>

                <section class="evaluation-top-summary">
                    <div><span>Buyer</span><strong>${escapePostAwardHtml(execution.buyer)}</strong></div>
                    <div><span>Supplier</span><strong>${escapePostAwardHtml(execution.supplier)}</strong></div>
                    <div><span>Value</span><strong>${formatPostAwardMoney(execution.contractValue, execution.currency)}</strong></div>
                    <div><span>Status</span>${renderPostAwardBadge(execution.status)}</div>
                    <div><span>Balance</span><strong>${formatPostAwardMoney(Number(execution.contractValue || 0) - paid, execution.currency)}</strong></div>
                </section>

                <section class="procurement-panel evaluation-panel award-draft-control-panel" data-post-award-mode-panel="active">
                    <div class="panel-heading">
                        <div><span class="section-kicker">Execution draft</span><h2>Leave execution tracking and return to another tender</h2></div>
                        ${renderPostAwardBadge(draft.draftSaved ? 'Draft saved' : 'Execution active')}
                    </div>
                    <div class="inline-actions">
                        <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="execution">Save Draft</button>
                        <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="execution">Save Draft & Exit</button>
                        <button class="btn btn-secondary" type="button" data-award-guard-navigate data-navigate="awarding-contracts">Open Another Tender</button>
                    </div>
                </section>

                <section class="procurement-panel evaluation-panel post-award-panel" data-post-award-mode-panel="active">
                    <div class="panel-heading">
                        <div><span class="section-kicker">Execution workspace</span><h2>Milestones, payments, issues, variations, closure, and performance</h2></div>
                        ${renderPostAwardBadge(`${execution.progress || 0}% complete`)}
                    </div>

                    <div class="tabs post-award-tabs">
                        <div class="tab active" data-tab="milestones">Delivery / Milestones</div>
                        <div class="tab" data-tab="payments">Invoices & Payments</div>
                        <div class="tab" data-tab="issues">Issues</div>
                        <div class="tab" data-tab="variations">Variations</div>
                        <div class="tab" data-tab="closure">Closure</div>
                        <div class="tab" data-tab="performance">Performance</div>
                    </div>

                    <div class="post-award-tab-content">
                        <div class="tab-content tab-content--visible" data-tab="milestones">
                            <div class="post-award-progress-card">
                                <div><strong>Overall Progress</strong><span>${execution.progress || 0}%</span></div>
                                <div class="progress-bar"><div class="progress-fill" style="width: ${Number(execution.progress || 0)}%"></div></div>
                            </div>
                            ${renderPostAwardTable(
                                ['Milestone', 'Description', 'Scheduled', 'Actual', 'Status', 'Evidence', 'Payment %', 'Action'],
                                (execution.milestones || []).map(row => `
                                    <tr>
                                        <td><strong>${escapePostAwardHtml(row.name)}</strong></td>
                                        <td>${escapePostAwardHtml(row.description)}</td>
                                        <td>${escapePostAwardHtml(row.scheduled)}</td>
                                        <td>${escapePostAwardHtml(row.actual)}</td>
                                        <td>${renderPostAwardBadge(row.status)}</td>
                                        <td>${escapePostAwardHtml(row.evidence)}</td>
                                        <td>${escapePostAwardHtml(row.paymentPercent)}%</td>
                                        <td><button class="btn btn-secondary btn-sm" type="button">${/pending/i.test(row.status) ? 'Schedule' : 'Review'}</button></td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="payments">
                            <section class="post-award-metric-grid">
                                <article><span>Contract amount</span><strong>${formatPostAwardMoney(execution.contractValue, execution.currency)}</strong></article>
                                <article><span>Amount invoiced</span><strong>${formatPostAwardMoney(invoiced, execution.currency)}</strong></article>
                                <article><span>Amount paid</span><strong>${formatPostAwardMoney(paid, execution.currency)}</strong></article>
                                <article><span>Balance remaining</span><strong>${formatPostAwardMoney(Number(execution.contractValue || 0) - paid, execution.currency)}</strong></article>
                            </section>
                            ${renderPostAwardTable(
                                ['Invoice', 'Milestone', 'Amount', 'Status', '3-way Match', 'Action'],
                                (execution.invoices || []).map(row => {
                                    const matchOk = row.matchStatus && Object.values(row.matchStatus).every(Boolean);
                                    const approve = /pending/i.test(row.status || '');
                                    return `
                                        <tr>
                                            <td><strong>${escapePostAwardHtml(row.invoice)}</strong><span>${escapePostAwardHtml(row.match)}</span></td>
                                            <td>${escapePostAwardHtml(row.milestone)}</td>
                                            <td>${formatPostAwardMoney(row.amount, execution.currency)}</td>
                                            <td>${renderPostAwardBadge(row.status)}</td>
                                            <td>${renderMatchStatus(row.matchStatus)}</td>
                                            <td><button class="btn btn-secondary btn-sm" type="button" ${approve && !matchOk ? 'disabled aria-disabled="true" title="Resolve 3-way match before buyer payment review"' : ''}>${approve ? 'Review' : 'View'}</button></td>
                                        </tr>
                                    `;
                                })
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="issues">
                            ${renderPostAwardTable(
                                ['Issue', 'Raised By', 'Priority', 'Responsible Party', 'Status', 'Required Action'],
                                (execution.issues || []).map(row => `
                                    <tr>
                                        <td><strong>${escapePostAwardHtml(row.id)}: ${escapePostAwardHtml(row.title)}</strong></td>
                                        <td>${escapePostAwardHtml(row.raisedBy)}</td>
                                        <td>${renderPostAwardBadge(row.priority)}</td>
                                        <td>${escapePostAwardHtml(row.responsibleParty)}</td>
                                        <td>${renderPostAwardBadge(row.status)}</td>
                                        <td>${escapePostAwardHtml(row.requiredAction)}</td>
                                    </tr>
                                `)
                            )}
                            <div class="inline-actions"><button class="btn btn-primary" type="button">Raise Issue</button><button class="btn btn-secondary" type="button">Upload Evidence</button></div>
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="variations">
                            <section class="post-award-metric-grid">
                                <article><span>Total price impact</span><strong>${formatPostAwardMoney(totalVariationValue, execution.currency)}</strong></article>
                                <article><span>Total timeline impact</span><strong>${escapePostAwardHtml(totalVariationDays)} days</strong></article>
                                <article><span>Open variations</span><strong>${escapePostAwardHtml((execution.variations || []).length)}</strong></article>
                            </section>
                            <div class="evaluation-notice warning">After signing, changes are managed as formal amendments, variation requests, extensions of time, or change orders.</div>
                            ${renderPostAwardTable(
                                ['Variation', 'Requested By', 'Impact', 'Status', 'Awaiting', 'Actions'],
                                (execution.variations || []).map(row => `
                                    <tr>
                                        <td><strong>${escapePostAwardHtml(row.title)}</strong><span>${escapePostAwardHtml(row.document)}</span></td>
                                        <td>${escapePostAwardHtml(row.requestedBy)}</td>
                                        <td>${escapePostAwardHtml(row.priceImpact)} / ${escapePostAwardHtml(row.timelineImpact)}</td>
                                        <td>${renderPostAwardBadge(row.status)}</td>
                                        <td><strong>${escapePostAwardHtml(row.awaitingApprovalFrom)}</strong><span>${escapePostAwardHtml(row.requiredAction)}</span></td>
                                        <td><div class="inline-actions"><button class="btn btn-secondary btn-sm" type="button">Approve</button><button class="btn btn-secondary btn-sm" type="button">Reject</button><button class="btn btn-primary btn-sm" type="button">Request More Info</button></div></td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="closure">
                            <div class="closure-counter">${completeClosure} of ${mandatoryClosure.length} mandatory items complete</div>
                            <ul class="closure-checklist" role="list">
                                ${(execution.closureChecklist || []).map((row, index) => {
                                    const checked = row.complete || /complete|resolved|processed|rated/i.test(row.status || '');
                                    return `
                                        <li>
                                            <label>
                                                <input type="checkbox" ${checked ? 'checked' : ''} ${row.mandatory === false ? '' : 'required'}>
                                                <span><strong>${escapePostAwardHtml(row.item)}</strong>${renderPostAwardBadge(row.status)}</span>
                                            </label>
                                        </li>
                                    `;
                                }).join('')}
                            </ul>
                            <section class="defect-liability-panel">
                                <div class="panel-heading"><div><span class="section-kicker">Defect liability</span><h3>Post-handover warranty period</h3></div>${renderPostAwardBadge(execution.defectLiability?.status || 'Not Started')}</div>
                                <div class="award-control-grid">
                                    <article><strong>Period</strong><span>${escapePostAwardHtml(execution.defectLiability?.period || '-')}</span></article>
                                    <article><strong>Start</strong><span>${escapePostAwardHtml(execution.defectLiability?.startDate || '-')}</span></article>
                                    <article><strong>End</strong><span>${escapePostAwardHtml(execution.defectLiability?.endDate || '-')}</span></article>
                                    <article><strong>Retention release</strong><span>${escapePostAwardHtml(execution.defectLiability?.retentionRelease || '-')}</span></article>
                                </div>
                            </section>
                            <div class="inline-actions"><button class="btn btn-primary" type="button" ${closureReady ? '' : 'disabled aria-disabled="true"'}>Submit Completion Request</button><button class="btn btn-secondary" type="button">Issue Completion Certificate</button></div>
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="performance">
                            <section class="post-award-metric-grid">
                                <article><span>Current average</span><strong>${averagePerformance}/5</strong></article>
                                <article><span>Predicted final score</span><strong>${Math.min(5, Number(averagePerformance) + 0.1).toFixed(1)}/5</strong></article>
                            </section>
                            <dl class="post-award-performance-grid">
                                ${(execution.performance || []).map(row => `
                                    <div>
                                        <dt>${escapePostAwardHtml(row.criteria)}</dt>
                                        <dd>${renderStars(row.rating, row.criteria)}<span>${escapePostAwardHtml(row.rating)}/5</span></dd>
                                        <label>Notes <textarea class="form-input" rows="3">${escapePostAwardHtml(row.notes || '')}</textarea></label>
                                    </div>
                                `).join('')}
                            </dl>
                            <div class="inline-actions"><button class="btn btn-primary" type="button">Submit Interim Performance Assessment</button></div>
                            ${renderPostAwardTable(['Date', 'Contract History'], (execution.history || []).map(row => `<tr><td>${escapePostAwardHtml(row.date)}</td><td>${escapePostAwardHtml(row.event)}</td></tr>`))}
                        </div>
                    </div>
                </section>

                ${renderClosedContractPanels(closedContracts)}
            </main>
        </div>
    `;
}

function initializePostAwardTracking() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || 'active';
    const tab = params.get('tab') || (mode === 'closed' ? 'closure' : 'milestones');
    const contract = params.get('contract') || 'closed-contract-1';

    document.querySelectorAll('[data-post-award-mode-panel]').forEach(panel => {
        panel.style.display = panel.getAttribute('data-post-award-mode-panel') === mode ? '' : 'none';
    });

    const targetTab = document.querySelector(`.post-award-tabs .tab[data-tab="${tab}"]`);
    if (targetTab) targetTab.click();

    document.querySelectorAll('[data-closed-contract-panel]').forEach(panel => {
        const isActive = panel.getAttribute('data-closed-contract-panel') === contract;
        panel.classList.toggle('active', isActive);
        panel.style.display = isActive ? '' : 'none';
    });

    document.querySelectorAll('[data-closed-contract-jump]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-closed-contract-jump') || 'closed-contract-1';
            document.querySelectorAll('[data-closed-contract-panel]').forEach(panel => {
                const isActive = panel.getAttribute('data-closed-contract-panel') === target;
                panel.classList.toggle('active', isActive);
                panel.style.display = isActive ? '' : 'none';
            });
        });
    });
}

if (window.app) {
    window.app.renderPostAwardTracking = renderPostAwardTracking;
}

window.initializePostAwardTracking = initializePostAwardTracking;
