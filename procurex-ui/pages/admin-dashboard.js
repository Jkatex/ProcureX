// Admin Evaluator compliance dashboard. Admin oversees procedures; users create, bid, evaluate, and award.

function escapeAdminDashboardHtml(value = '') {
    return String(value)
        .replace(/and/g, 'andamp;')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function getAdminDashboardTenders() {
    if (typeof getProcurexAllTenders === 'function') return getProcurexAllTenders();
    return mockData.tenders || [];
}

function getAdminComplianceQueue() {
    const tenders = getAdminDashboardTenders();
    const queue = [
        ...tenders.slice(0, 4).map((tender, index) => ({
            id: tender.id,
            title: tender.title,
            stage: index % 2 === 0 ? 'Tender publication' : 'Evaluation report',
            status: tender.complianceStatus || (index === 1 ? 'Returned for correction' : 'Awaiting review'),
            owner: tender.organization,
            value: tender.budget || 0,
            type: tender.type,
            urgency: 96 - (index * 7),
            issue: index === 1 ? 'Evaluation criteria weights need evidence notes.' : 'Confirm method, budget, and minimum bidding period.'
        })),
        {
            id: 'AWD-PX-2026-004',
            title: 'Award recommendation for Road Maintenance Framework',
            stage: 'Award',
            status: 'Awaiting review',
            owner: 'Dodoma City Council',
            value: 1280000000,
            type: 'Services',
            urgency: 82,
            issue: 'Confirm award follows ranked bidder and standstill period.'
        }
    ];
    return queue.sort((a, b) => b.urgency - a.urgency);
}

function renderAdminQueueItem(item) {
    const badge = /return|issue/i.test(item.status) ? 'badge-error' : /hold|await|pending/i.test(item.status) ? 'badge-warning' : 'badge-success';
    return `
        <article class="admin-review-card">
            <div>
                <span class="section-kicker">${escapeAdminDashboardHtml(item.stage)}</span>
                <h3>${escapeAdminDashboardHtml(item.title)}</h3>
                <p>${escapeAdminDashboardHtml(item.owner)} / ${escapeAdminDashboardHtml(item.type)} / TZS ${Number(item.value || 0).toLocaleString()}</p>
                <small>${escapeAdminDashboardHtml(item.issue)}</small>
            </div>
            <div class="admin-review-actions">
                <span class="badge ${badge}">${escapeAdminDashboardHtml(item.status)}</span>
                <button class="btn btn-secondary" type="button" data-select-tender="${escapeAdminDashboardHtml(item.id)}" data-navigate="tender-details">Review</button>
                <button class="btn btn-primary" type="button">Approve</button>
                <button class="btn btn-secondary" type="button">Flag Issue</button>
                <button class="btn btn-secondary" type="button">Return</button>
            </div>
        </article>
    `;
}

function renderAdminDashboard() {
    const queue = getAdminComplianceQueue();
    const tenders = getAdminDashboardTenders();
    const active = tenders.filter(tender => tender.status === 'Open').length;
    const flagged = queue.filter(item => /return|issue|flag/i.test(item.status)).length;
    const complianceRate = Math.max(87, 98 - flagged);
    const auditTrail = mockData.platformOps?.auditTrail || [];

    return `
        <div class="main-layout">
            <aside class="sidebar">
                <div class="sidebar-heading">
                    <h3>Admin Evaluator</h3>
                    <div>Compliance oversight only</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="admin-dashboard" class="active">Compliance Dashboard</a></li>
                    <li><a href="#" data-navigate="communication-center">Compliance Notices</a></li>
                    <li><a href="#" data-navigate="records-history">Audit Records</a></li>
                    <li><a href="#" data-navigate="account-profile">Admin Profile</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content">
                <div class="journey-page admin-compliance-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-info">Platform compliance</span>
                            <h1>Admin Compliance Dashboard</h1>
                            <p>Review procurement procedures, flag violations, hold risky stages, return corrections, and keep a platform-wide audit trail. Admin does not create tenders, bid, evaluate as owner, or award.</p>
                        </div>
                        <div class="journey-scorecard">
                            <div><strong>${active}</strong><span>Active tenders</span></div>
                            <div><strong>${queue.length}</strong><span>Pending review</span></div>
                            <div><strong>${flagged}</strong><span>Flagged issues</span></div>
                            <div><strong>${complianceRate}%</strong><span>Compliance</span></div>
                        </div>
                    </section>

                    <section class="journey-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Pending reviews</span>
                                <h2>Sorted by urgency</h2>
                            </div>
                            <span class="badge badge-warning">${queue.length} awaiting action</span>
                        </div>
                        <div class="admin-review-list">
                            ${queue.map(renderAdminQueueItem).join('')}
                        </div>
                    </section>

                    <section class="journey-grid two-col">
                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Checklist</span>
                                    <h2>Compliance checks</h2>
                                </div>
                                <span class="badge badge-info">Per procurement</span>
                            </div>
                            <div class="compliance-check-list">
                                <div class="status-section done"><strong>Procurement method matches threshold</strong><span>Open tender is aligned with estimated value.</span></div>
                                <div class="status-section done"><strong>Minimum bidding period observed</strong><span>Publication-to-closing period meets the expected window.</span></div>
                                <div class="status-section attention"><strong>Evaluation weights total 100%</strong><span>One evaluation report needs supporting notes.</span></div>
                                <div class="status-section attention"><strong>Conflict declarations complete</strong><span>Missing declaration must be returned before award.</span></div>
                            </div>
                        </div>

                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Platform health</span>
                                    <h2>Processing indicators</h2>
                                </div>
                                <button class="btn btn-secondary" type="button" data-navigate="records-history">Open Audit</button>
                            </div>
                            <div class="record-summary">
                                <div><span>Average processing time</span><strong>18 days</strong></div>
                                <div><span>Compliance rate</span><strong>${complianceRate}%</strong></div>
                                <div><span>Open disputes</span><strong>1</strong></div>
                                <div><span>Returned procurements</span><strong>${flagged}</strong></div>
                            </div>
                        </div>
                    </section>

                    <section class="journey-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Audit trail</span>
                                <h2>Recent admin actions</h2>
                            </div>
                            <button class="btn btn-primary" type="button">Generate Compliance Report</button>
                        </div>
                        <div class="execution-lane">
                            ${auditTrail.map(item => `
                                <div>
                                    <strong>${escapeAdminDashboardHtml(item.time)}</strong>
                                    <span>${escapeAdminDashboardHtml(item.event)} (${escapeAdminDashboardHtml(item.ref)})</span>
                                </div>
                            `).join('') || '<div><strong>No audit actions yet</strong><span>Admin actions will appear here with timestamps.</span></div>'}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    `;
}

if (window.app) {
    window.app.renderAdminDashboard = renderAdminDashboard;
}
