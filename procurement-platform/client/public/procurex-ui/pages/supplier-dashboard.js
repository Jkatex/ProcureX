// Dashboard Page Component

function renderSupplierDashboard() {
    const kpis = mockData.kpis.supplier;

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>ProcureX Supplier</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${mockData.users.supplier.organization}</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="workspace-dashboard" class="active">Dashboard</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="bidding-workspace">My Bids</a></li>
                    <li><a href="#" data-navigate="contract-negotiation">Contracts</a></li>
                    <li><a href="#" data-navigate="post-award-tracking">Performance</a></li>
                    <li><a href="#" data-navigate="sign-in">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-success">Verified supplier</span>
                            <h1>Dashboard</h1>
                            <p>Discover matched tenders, prepare sealed bids, track award outcomes, sign contracts, submit delivery evidence, invoice, and monitor payment.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" data-navigate="procurement-guide">Open Journey</button>
                            <button class="btn btn-primary" data-navigate="marketplace">Find Tenders</button>
                        </div>
                    </section>

                    <section class="journey-grid three-col">
                        <div class="kpi-card"><div class="kpi-value">${kpis.matchedTenders}</div><div class="kpi-label">Matched tenders</div></div>
                        <div class="kpi-card"><div class="kpi-value">${kpis.bidsInProgress}</div><div class="kpi-label">Bids in progress</div></div>
                        <div class="kpi-card"><div class="kpi-value">${kpis.closing48h}</div><div class="kpi-label">Closing in 48h</div></div>
                    </section>

                    <section class="journey-grid two-col">
                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Tender Search</span>
                                    <h2>Matched Tender</h2>
                                </div>
                                <span class="badge badge-success">95% match</span>
                            </div>
                            <div class="record-summary">
                                <div><span>Tender</span><strong>Construction of Rural Health Centers</strong></div>
                                <div><span>Buyer</span><strong>Ministry of Health</strong></div>
                                <div><span>Deadline</span><strong>June 12, 2026</strong></div>
                            </div>
                            <div class="inline-actions">
                                <button class="btn btn-primary" data-navigate="tender-detail">View Tender</button>
                                <button class="btn btn-secondary">Add to Watchlist</button>
                            </div>
                        </div>

                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">My bids</span>
                                    <h2>Submitted Bid Receipt</h2>
                                </div>
                                <span class="badge badge-info">Sealed</span>
                            </div>
                            <div class="record-summary">
                                <div><span>Bid ID</span><strong>BID-PX-2026-014</strong></div>
                                <div><span>Receipt hash</span><strong>0x9f24...a73c</strong></div>
                                <div><span>Status</span><strong>Submitted before deadline</strong></div>
                            </div>
                            <button class="btn btn-secondary" data-navigate="bidding-workspace">Open My Bids</button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `;
}

if (window.app) {
    window.app.renderSupplierDashboard = renderSupplierDashboard;
}
