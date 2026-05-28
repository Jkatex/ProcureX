// Unified procurement workspace. A user can act as buyer or supplier from here.

function procurementStatusBadge(status) {
    if (status === 'Open') return 'badge-success';
    if (status === 'Evaluation') return 'badge-warning';
    return 'badge-info';
}

function procurementIcon(type) {
    const icons = {
        dashboard: '<path d="M3 13h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 21h8v-6H3z"/>',
        marketplace: '<path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/>',
        create: '<path d="M12 5v14"/><path d="M5 12h14"/>',
        draft: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 14h6M9 18h4"/>',
        activity: '<path d="M22 12h-4l-3 8-6-16-3 8H2"/>'
    };

    return `
        <svg class="procure-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${icons[type]}
        </svg>
    `;
}

function escapeProcurementDashboardHtml(value = '') {
    return String(value)
        .replace(/and/g, 'and')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function renderProcurementDashboard() {
    const tenders = typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : (mockData.tenders || []);
    const openTenders = typeof getProcurexMarketplaceTenders === 'function'
        ? getProcurexMarketplaceTenders()
        : tenders.filter(tender => tender.status === 'Open');
    const buyerActiveTenders = typeof getProcurexBuyerActiveTenders === 'function' ? getProcurexBuyerActiveTenders() : [];
    const savedTenderDraft = typeof getCreateTenderSavedDraft === 'function' ? getCreateTenderSavedDraft() : null;
    const buyerKpis = mockData.kpis.buyer;
    const supplierKpis = mockData.kpis.supplier;

    const liveUpdates = [
        {
            type: 'Tender',
            title: 'Rural Health Centers closes soon',
            detail: 'Open works tender with TZS 5,000,000,000 budget and tenderer eligibility checks active.',
            meta: 'Closes 2026-06-12',
            tone: 'success',
            nav: 'tender-detail'
        },
        {
            type: 'Alert',
            title: 'Draft tender needs review',
            detail: 'Office ICT Equipment tender still needs attachments and timeline checks before publication.',
            meta: 'Create and Manage',
            tone: 'warning',
            nav: 'create-tender'
        },
        {
            type: 'Activity',
            title: 'Technical envelope in progress',
            detail: 'Bid draft for Rural Health Centers is 60% complete and ready to continue.',
            meta: 'Draft bid',
            tone: 'info',
            nav: 'bidding-workspace'
        },
        {
            type: 'Tender',
            title: 'Medical Equipment in evaluation',
            detail: 'Evaluation team is reviewing submissions and preparing the opening report.',
            meta: 'Evaluation stage',
            tone: 'blue',
            nav: 'bid-evaluation'
        },
        {
            type: 'Alert',
            title: 'Clarification questions received',
            detail: 'The procuring entity received 3 tenderer questions that should be answered before deadline.',
            meta: 'Response needed',
            tone: 'rose',
            nav: 'communication-center'
        }
    ];

    return `
        <div class="main-layout procurement-layout">
            <aside class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Procurement Workspace</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Procurement workspace</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="procurement-dashboard" class="active">Dashboard</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Create Tender Path</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Bid Submission Path</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                    <li><a href="#" data-navigate="bidding-workspace">Draft Bids</a></li>
                    <li><a href="#" data-navigate="records-history">Records and History</a></li>
                    <li><a href="#" data-navigate="app-launcher">All Apps</a></li>
                    <li><a href="#" data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content">
                <section class="procurement-hero">
                    <div>
                        <span class="badge badge-success">Unified procurement</span>
                        <h1>One dashboard for tendering workflows.</h1>
                        <p>Every verified user can create tenders, discover tenders in the marketplace, and submit bids without switching to a separate dashboard.</p>
                    </div>
                    <div class="procurement-hero-actions">
                        <button class="btn btn-primary" data-navigate="procurement-guide">Create Tender</button>
                        <button class="btn btn-secondary" data-navigate="marketplace">View Marketplace</button>
                    </div>
                </section>

                <section class="procurement-action-grid">
                    <article class="procurement-action buyer">
                        <span class="procure-icon">${procurementIcon('create')}</span>
                        <div>
                            <span class="section-kicker">Create and Manage</span>
                            <h2>Create a tender</h2>
                            <p>Start the create tender path for tender design, attachments, BOQ, publication, evaluation, award, and contract tracking.</p>
                        </div>
                        <button class="btn btn-primary" data-navigate="procurement-guide">Start Create Tender Path</button>
                    </article>

                    <article class="procurement-action supplier">
                        <span class="procure-icon">${procurementIcon('marketplace')}</span>
                        <div>
                            <span class="section-kicker">Bid and Respond</span>
                            <h2>Find and bid</h2>
                            <p>Open marketplace tenders, review eligibility, then move into the bid submission path to prepare a bid.</p>
                        </div>
                        <button class="btn btn-primary" data-navigate="marketplace">Open Marketplace</button>
                    </article>
                </section>

                <section class="journey-grid three-col">
                    <div class="kpi-card"><div class="kpi-value">${buyerKpis.activeTenders + buyerActiveTenders.length}</div><div class="kpi-label">Active tenders created</div></div>
                    <div class="kpi-card"><div class="kpi-value">${supplierKpis.bidsInProgress}</div><div class="kpi-label">Draft Bids</div></div>
                    <div class="kpi-card"><div class="kpi-value">${openTenders.length}</div><div class="kpi-label">Open marketplace tenders</div></div>
                </section>

                <section class="procurement-work-grid">
                    <div class="procurement-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Marketplace</span>
                                <h2>Open tenders</h2>
                            </div>
                            <button class="btn btn-secondary" data-navigate="marketplace">View all</button>
                        </div>

                        <div class="procurement-tender-list">
                            ${openTenders.map(tender => `
                                <article class="procurement-tender-row">
                                    <div>
                                        <div class="tender-row-title">
                                            <strong>${tender.title}</strong>
                                            <span class="badge ${procurementStatusBadge(tender.status)}">${tender.status}</span>
                                        </div>
                                        <p>${tender.organization} / ${tender.type} / TZS ${tender.budget.toLocaleString()}</p>
                                        <span>Closes ${tender.closingDate}</span>
                                    </div>
                                    <div class="tender-row-actions">
                                        <button class="btn btn-secondary" data-select-tender="${tender.id}" data-navigate="${tender.createdByCurrentUser ? 'tender-details' : 'tender-detail'}">Review</button>
                                        <button class="btn btn-primary" data-select-tender="${tender.id}" ${tender.status === 'Open' && !tender.createdByCurrentUser ? 'data-navigate="tender-detail"' : 'disabled'}>${tender.createdByCurrentUser ? 'Manage' : 'Apply'}</button>
                                    </div>
                                </article>
                            `).join('') || '<div class="scope-empty">No active marketplace tenders right now.</div>'}
                        </div>
                    </div>

                    <aside class="procurement-side-stack">
                        <section class="procurement-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Draft Bids</span>
                                    <h2>Continue work</h2>
                                </div>
                                <span class="badge badge-warning">${savedTenderDraft ? 'Saved as draft' : '2 drafts'}</span>
                            </div>
                            <div class="record-summary compact">
                                ${savedTenderDraft ? `
                                    <div>
                                        <span>Tender draft</span>
                                        <strong>${escapeProcurementDashboardHtml(savedTenderDraft.title || 'Untitled tender')} / saved as draft</strong>
                                    </div>
                                    <div>
                                        <span>Visibility</span>
                                        <strong>${escapeProcurementDashboardHtml(savedTenderDraft.visibility || 'Not set')}</strong>
                                    </div>
                                ` : ''}
                                <div><span>Bid draft</span><strong>Rural Health Centers bid / 60% complete</strong></div>
                                ${savedTenderDraft ? '' : '<div><span>Tender draft</span><strong>Office ICT Equipment tender / attachments pending</strong></div>'}
                            </div>
                            <button class="btn btn-secondary" data-navigate="${savedTenderDraft ? 'create-tender' : 'bidding-workspace'}">Open Drafts</button>
                        </section>

                        <section class="procurement-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Active Procurements</span>
                                    <h2>Recent updates</h2>
                                </div>
                                <span class="procure-icon small">${procurementIcon('activity')}</span>
                            </div>
                            <div class="procurement-live-feed" data-procurement-feed>
                                ${liveUpdates.map((item, index) => `
                                    <button class="live-feed-card tone-${item.tone} ${index === 0 ? 'active' : ''}" type="button" data-feed-card data-navigate="${item.nav}" aria-hidden="${index === 0 ? 'false' : 'true'}">
                                        <span class="live-feed-type">${item.type}</span>
                                        <strong>${item.title}</strong>
                                        <span>${item.detail}</span>
                                        <em>${item.meta}</em>
                                    </button>
                                `).join('')}
                                <div class="live-feed-dots" aria-label="Recent update position">
                                    ${liveUpdates.map((_, index) => `<span class="${index === 0 ? 'active' : ''}" data-feed-dot></span>`).join('')}
                                </div>
                            </div>
                        </section>
                    </aside>
                </section>
            </main>
        </div>
    `;
}

if (window.app) {
    window.app.renderProcurementDashboard = renderProcurementDashboard;
}
