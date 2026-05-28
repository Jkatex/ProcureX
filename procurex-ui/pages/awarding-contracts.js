// Awarding and Contracts dashboard. Hybrid hub: urgent actions plus role-aware lifecycle queues.

const PXAwardingUtils = window.ProcureXShared || {};
const escapeAwardingContractsHtml = PXAwardingUtils.escapeHtml || ((value = '') => String(value));
const formatAwardingContractsMoney = PXAwardingUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const formatAwardingContractsDate = PXAwardingUtils.formatDate || ((value = '') => value || 'Not saved');
const renderAwardingContractsBadge = PXAwardingUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapeAwardingContractsHtml(value)}</span>`);

function renderAwardingContractsAction(label, nav, tenderId = '') {
    return `<button class="btn btn-primary btn-sm" type="button" ${tenderId ? `data-select-tender="${escapeAwardingContractsHtml(tenderId)}"` : ''} data-navigate="${escapeAwardingContractsHtml(nav || 'award-recommendation')}">${escapeAwardingContractsHtml(label || 'Open')}</button>`;
}

function renderAwardingContractsTable(headers = [], rows = []) {
    if (PXAwardingUtils.renderDataTable) return PXAwardingUtils.renderDataTable(headers, rows, 'awarding-contracts-table');
    return `
        <div class="data-table evaluation-table-scroll awarding-contracts-table">
            <table>
                <thead><tr>${headers.map(header => `<th>${escapeAwardingContractsHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `;
}

function getAwardingContractsDraftForTender(tender = {}) {
    if (typeof loadAwardContractDraft !== 'function') return null;
    const tenderId = typeof getAwardContractTenderId === 'function' ? getAwardContractTenderId(tender) : (tender.tenderId || tender.id || tender.reference);
    return tenderId ? loadAwardContractDraft(tenderId, tender) : null;
}

function buildAwardingContractsBuyerRows(lifecycle = {}) {
    const tenders = typeof getAwardContractTenders === 'function' ? getAwardContractTenders() : [];
    const buyerTenders = tenders.filter(tender => tender.createdByCurrentUser);
    const sourceRows = buyerTenders.length ? buyerTenders : (lifecycle.pendingAwarding || []);
    return sourceRows.map((tender, index) => {
        const tenderId = tender.tenderId || (typeof getAwardContractTenderId === 'function' ? getAwardContractTenderId(tender) : tender.id) || `pending-award-${index + 1}`;
        const draft = getAwardingContractsDraftForTender({ ...tender, id: tenderId, createdByCurrentUser: true });
        return {
            tenderId,
            role: 'Buyer',
            title: tender.title,
            reference: tender.reference || tender.id || tenderId,
            procurementType: draft?.procurementType || tender.type || tender.procurementType || tender.procurementTypeId || 'Tender',
            evaluationStatus: tender.evaluationStatus || (/evaluation|award/i.test(tender.status || '') ? 'Completed' : 'Ready'),
            recommendedSupplier: draft?.awardDecision?.selectedSupplier || tender.recommendedSupplier || lifecycle.award?.selectedSupplier || 'Recommended supplier',
            awardStatus: draft?.awardStatus || tender.awardStatus || 'Pending Award Decision',
            contractStatus: draft?.contract?.status || draft?.contractStatus || tender.contractStatus || 'Not Created',
            currentStep: draft?.currentStep || 'evaluation-result',
            requiredAction: draft?.requiredAction || tender.action || 'Continue Award',
            draftSaved: draft?.draftSaved,
            lastEditedAt: draft?.lastEditedAt,
            action: draft?.requiredAction || tender.action || 'Continue Award',
            nav: tender.nav || 'award-recommendation',
            dueDate: tender.dueDate || lifecycle.award?.standstillEnd || '2026-07-05'
        };
    });
}

function buildAwardingContractsSupplierRows(lifecycle = {}) {
    return (lifecycle.awardedToUs || []).map((row, index) => {
        const tenderId = row.tenderId || `supplier-award-${index + 1}`;
        const draft = typeof loadAwardContractDraft === 'function' ? loadAwardContractDraft(tenderId, {
            id: tenderId,
            title: row.title,
            type: row.procurementType || 'services',
            organization: row.buyer,
            createdByCurrentUser: false,
            budget: row.awardValue,
            currency: row.currency
        }) : null;
        return {
            ...row,
            tenderId,
            role: 'Supplier',
            procurementType: draft?.procurementType || row.procurementType || 'Tender',
            currentStep: draft?.currentStep || 'award-notification',
            requiredAction: draft?.requiredAction || row.requiredAction,
            draftSaved: draft?.draftSaved,
            lastEditedAt: draft?.lastEditedAt,
            contractStatus: draft?.contract?.status || row.contractStatus,
            dueDate: row.dueDate || '2026-07-04'
        };
    });
}

function buildAwardingContractsUrgentRows(lifecycle, pendingAwarding, awardedToUs) {
    const execution = lifecycle.execution || {};
    const invoiceActions = (execution.invoices || [])
        .filter(row => /pending|blocked/i.test(row.status || ''))
        .map(row => ({
            item: row.invoice,
            role: 'Buyer',
            otherParty: execution.supplier,
            status: row.status,
            requiredAction: row.matchStatus && Object.values(row.matchStatus).every(Boolean) ? 'Approve invoice' : 'Resolve 3-way match',
            dueDate: 'Finance review',
            nav: 'post-award-tracking'
        }));
    const variationActions = (execution.variations || []).map(row => ({
        item: row.title,
        role: row.awaitingApprovalFrom || 'Buyer',
        otherParty: row.requestedBy,
        status: row.status,
        requiredAction: row.requiredAction,
        dueDate: row.timelineImpact,
        nav: 'post-award-tracking'
    }));
    return [
        ...pendingAwarding.filter(row => /pending|draft|continue|required/i.test(`${row.awardStatus} ${row.requiredAction}`)).map(row => ({
            item: row.title,
            role: row.role,
            otherParty: row.recommendedSupplier,
            status: row.awardStatus,
            requiredAction: row.requiredAction,
            dueDate: row.dueDate,
            nav: row.nav,
            tenderId: row.tenderId
        })),
        ...awardedToUs.filter(row => /awaiting|review|sign|accept/i.test(`${row.awardStatus} ${row.requiredAction}`)).map(row => ({
            item: row.title,
            role: row.role,
            otherParty: row.buyer,
            status: row.contractStatus || row.awardStatus,
            requiredAction: row.requiredAction,
            dueDate: row.dueDate,
            nav: row.nav,
            tenderId: row.tenderId
        })),
        ...(lifecycle.pendingActions || []).map(row => ({
            item: row.contract,
            role: row.role,
            otherParty: row.otherParty,
            status: row.status,
            requiredAction: row.requiredAction,
            dueDate: row.dueDate,
            nav: row.nav
        })),
        ...invoiceActions,
        ...variationActions
    ];
}

function renderAwardingSummaryCard(item) {
    return `
        <button class="awarding-summary-card" type="button" data-awarding-tab-jump="${escapeAwardingContractsHtml(item.tab)}" aria-label="Go to ${escapeAwardingContractsHtml(item.label)} tab">
            <span class="summary-trend" aria-hidden="true">${escapeAwardingContractsHtml(item.trend || '↗')}</span>
            <strong>${escapeAwardingContractsHtml(item.value)}</strong>
            <span>${escapeAwardingContractsHtml(item.label)} <em class="summary-view">View</em></span>
            <em>${escapeAwardingContractsHtml(item.detail)}</em>
        </button>
    `;
}

function renderAwardingContracts() {
    const lifecycle = mockData.awardingContracts || {};
    const pendingAwarding = buildAwardingContractsBuyerRows(lifecycle);
    const awardedToUs = buildAwardingContractsSupplierRows(lifecycle);
    const pendingActions = lifecycle.pendingActions || [];
    const activeContracts = lifecycle.activeContracts || [];
    const closedContracts = lifecycle.closedContracts || [];
    const urgentRows = buildAwardingContractsUrgentRows(lifecycle, pendingAwarding, awardedToUs);
    const summary = [
        { label: 'My Urgent Actions', value: urgentRows.length, detail: 'All buyer and supplier actions needing attention', tab: 'my-urgent-actions', trend: '!' },
        { label: 'Pending Awarding', value: pendingAwarding.length, detail: 'Buyer-side tenders ready for award or contract action', tab: 'pending-awarding', trend: '↗' },
        { label: 'Awarded to you', value: awardedToUs.length, detail: 'Supplier-side awards awaiting response, review, or signature', tab: 'awarded-to-us', trend: '→' },
        { label: 'Pending Action', value: pendingActions.length, detail: 'Contracts needing buyer or supplier action', tab: 'pending-action', trend: '↘' },
        { label: 'Active Contracts', value: activeContracts.length, detail: 'Signed contracts under delivery and payment tracking', tab: 'active-contracts', trend: '→' },
        { label: 'Closed Contracts', value: closedContracts.length, detail: 'Completed, terminated, or archived contract records', tab: 'closed-contracts', trend: '→' }
    ];

    return `
        <div class="main-layout procurement-layout awarding-contracts-page">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Awarding and Contracts</h3>
                    <span>Relationship based workspace</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="awarding-contracts" class="active">Dashboard</a></li>
                    <li><a href="#" data-navigate="award-recommendation">Award Decision</a></li>
                    <li><a href="#" data-navigate="contract-negotiation">Contract Workspace</a></li>
                    <li><a href="#" data-navigate="post-award-tracking">Post-Award Tracking</a></li>
                    <li><a href="#" data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content awarding-contracts-workspace">
                <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                    <div>
                        <span class="section-kicker">Awarding and Contracts</span>
                        <h1>Your awarding and contracts — in every role you play</h1>
                        <p>Your company can be a buyer on tenders you created and a supplier on tenders you won. Both roles are shown below with clear next actions.</p>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${urgentRows.length}</strong><span>Urgent actions</span></div>
                        <div><strong>${pendingAwarding.length + awardedToUs.length}</strong><span>Award queues</span></div>
                        <div><strong>${pendingActions.length}</strong><span>Contract actions</span></div>
                    </div>
                </section>

                <div class="award-info-banner">
                    <strong>Role context</strong>
                    <span>Buyer rows are tenders your organization created. Supplier rows are awards your organization won from another buyer.</span>
                </div>

                <section class="awarding-summary-grid">
                    ${summary.map(renderAwardingSummaryCard).join('')}
                </section>

                <section class="procurement-panel evaluation-panel awarding-tabs-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Lifecycle queues</span>
                            <h2>Work is sorted by required action, with role shown inside each row</h2>
                            <p class="panel-note">The dashboard keeps buyer and supplier responsibilities visible without forcing separate accounts.</p>
                        </div>
                    </div>

                    <div class="tabs awarding-contract-tabs">
                        <div class="tab active" data-tab="my-urgent-actions">My Urgent Actions</div>
                        <div class="tab" data-tab="pending-awarding">Pending Awarding</div>
                        <div class="tab" data-tab="awarded-to-us">Awarded to you</div>
                        <div class="tab" data-tab="pending-action">Contracts Pending Action</div>
                        <div class="tab" data-tab="active-contracts">Active Contracts</div>
                        <div class="tab" data-tab="closed-contracts">Closed Contracts</div>
                    </div>

                    <div class="awarding-tab-content">
                        <div class="tab-content tab-content--visible" data-tab="my-urgent-actions">
                            <p class="awarding-tab-note">This queue aggregates buyer and supplier work that needs attention across awards, contracts, invoices, variations, and closure.</p>
                            ${renderAwardingContractsTable(
                                ['Item', 'Your Role', 'Other Party', 'Status', 'Required Action', 'Due / Impact'],
                                urgentRows.map(row => `
                                    <tr>
                                        <td><strong>${escapeAwardingContractsHtml(row.item)}</strong></td>
                                        <td>${renderAwardingContractsBadge(row.role)}</td>
                                        <td>${escapeAwardingContractsHtml(row.otherParty || '-')}</td>
                                        <td>${renderAwardingContractsBadge(row.status)}</td>
                                        <td>${renderAwardingContractsAction(row.requiredAction, row.nav, row.tenderId)}</td>
                                        <td>${escapeAwardingContractsHtml(row.dueDate || '-')}</td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="pending-awarding">
                            <div class="queue-toolbar">
                                <label>Search <input class="form-input" placeholder="Tender name or reference" aria-label="Search pending awarding tenders"></label>
                                <span>Showing 1-${Math.min(10, pendingAwarding.length)} of ${pendingAwarding.length} • 10 per page</span>
                            </div>
                            ${renderAwardingContractsTable(
                                ['Tender Title', 'Role', 'Type', 'Evaluation', 'Recommended Supplier', 'Award Status', 'Contract Status', 'Progress', 'Action'],
                                pendingAwarding.map(row => `
                                    <tr>
                                        <td><strong>${escapeAwardingContractsHtml(row.title)}</strong><span>${escapeAwardingContractsHtml(row.reference)}</span></td>
                                        <td>${renderAwardingContractsBadge(row.role)}</td>
                                        <td>${escapeAwardingContractsHtml(row.procurementType)}</td>
                                        <td>${renderAwardingContractsBadge(row.evaluationStatus)}</td>
                                        <td>${escapeAwardingContractsHtml(row.recommendedSupplier)}</td>
                                        <td>${renderAwardingContractsBadge(row.awardStatus)}</td>
                                        <td>${renderAwardingContractsBadge(row.contractStatus)}</td>
                                        <td>${renderAwardingContractsBadge(row.draftSaved ? 'Draft saved' : 'Not saved')}<span>${escapeAwardingContractsHtml(row.currentStep)}</span><small>${formatAwardingContractsDate(row.lastEditedAt)}</small></td>
                                        <td>${renderAwardingContractsAction(row.action, row.nav, row.tenderId)}</td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="awarded-to-us">
                            ${renderAwardingContractsTable(
                                ['Tender Title', 'Role', 'Buyer', 'Type', 'Award Value', 'Award Status', 'Contract Status', 'Progress', 'Required Action'],
                                awardedToUs.map(row => `
                                    <tr>
                                        <td><strong>${escapeAwardingContractsHtml(row.title)}</strong></td>
                                        <td>${renderAwardingContractsBadge(row.role)}</td>
                                        <td>${escapeAwardingContractsHtml(row.buyer)}</td>
                                        <td>${escapeAwardingContractsHtml(row.procurementType)}</td>
                                        <td>${formatAwardingContractsMoney(row.awardValue, row.currency)}</td>
                                        <td>${renderAwardingContractsBadge(row.awardStatus)}</td>
                                        <td>${renderAwardingContractsBadge(row.contractStatus)}</td>
                                        <td>${renderAwardingContractsBadge(row.draftSaved ? 'Draft saved' : 'Not saved')}<span>${escapeAwardingContractsHtml(row.currentStep)}</span><small>${formatAwardingContractsDate(row.lastEditedAt)}</small></td>
                                        <td>${renderAwardingContractsAction(row.requiredAction, row.nav, row.tenderId)}</td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="pending-action">
                            ${renderAwardingContractsTable(
                                ['Contract', 'Your Role', 'Other Party', 'Current Status', 'Required Action', 'Due Date'],
                                pendingActions.map(row => `
                                    <tr>
                                        <td><strong>${escapeAwardingContractsHtml(row.contract)}</strong></td>
                                        <td>${renderAwardingContractsBadge(row.role)}</td>
                                        <td>${escapeAwardingContractsHtml(row.otherParty)}</td>
                                        <td>${renderAwardingContractsBadge(row.status)}</td>
                                        <td>${renderAwardingContractsAction(row.requiredAction, row.nav)}</td>
                                        <td>${escapeAwardingContractsHtml(row.dueDate)}</td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="active-contracts">
                            ${renderAwardingContractsTable(
                                ['Contract', 'Your Role', 'Other Party', 'Progress', 'Next Milestone', 'Payment Status', 'Action'],
                                activeContracts.map(row => `
                                    <tr>
                                        <td><strong>${escapeAwardingContractsHtml(row.title)}</strong></td>
                                        <td>${renderAwardingContractsBadge(row.role)}</td>
                                        <td>${escapeAwardingContractsHtml(row.otherParty)}</td>
                                        <td><div class="awarding-mini-progress"><span style="width: ${Number(row.progress || 0)}%"></span></div><small>${escapeAwardingContractsHtml(row.progress)}% ${escapeAwardingContractsHtml(row.status)}</small></td>
                                        <td>${escapeAwardingContractsHtml(row.nextMilestone)}</td>
                                        <td>${renderAwardingContractsBadge(row.paymentStatus)}</td>
                                        <td>${renderAwardingContractsAction('Track', row.nav)}</td>
                                    </tr>
                                `)
                            )}
                        </div>

                        <div class="tab-content tab-content--hidden" data-tab="closed-contracts">
                            ${renderAwardingContractsTable(
                                ['Contract', 'Your Role', 'Other Party', 'Final Value', 'Completion Date', 'Performance', 'Status'],
                                closedContracts.map(row => `
                                    <tr>
                                        <td><strong>${escapeAwardingContractsHtml(row.title)}</strong></td>
                                        <td>${renderAwardingContractsBadge(row.role)}</td>
                                        <td>${escapeAwardingContractsHtml(row.otherParty)}</td>
                                        <td>${formatAwardingContractsMoney(row.finalValue, row.currency)}</td>
                                        <td>${escapeAwardingContractsHtml(row.completionDate)}</td>
                                        <td>${escapeAwardingContractsHtml(row.performanceRating)}</td>
                                        <td>${renderAwardingContractsBadge(row.status)}</td>
                                    </tr>
                                `)
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    `;
}

function initializeAwardingContracts() {
    document.querySelectorAll('[data-awarding-tab-jump]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-awarding-tab-jump');
            const tab = document.querySelector(`.awarding-contract-tabs .tab[data-tab="${target}"]`);
            if (tab) tab.click();
        });
    });
}

if (window.app) {
    window.app.renderAwardingContracts = renderAwardingContracts;
}

window.initializeAwardingContracts = initializeAwardingContracts;
