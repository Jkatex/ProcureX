// Admin platform analytics. Static visual prototype with CSS fallbacks.
(function () {
    function sum(values) {
        return values.reduce((total, value) => total + Number(value || 0), 0);
    }

    function getCategoryRows() {
        const grouped = new Map();
        window.ProcureXAdmin.getAdminTenders().forEach(tender => {
            const key = tender.type || tender.category || tender.procurementMethod || 'General Procurement';
            const item = grouped.get(key) || { type: key, count: 0, total: 0, bids: 0, days: 0 };
            item.count += 1;
            item.total += Number(tender.budget || tender.estimatedValue || 0);
            item.bids += Number(tender.bidsReceived || tender.bids || 4);
            item.days += Number(tender.evaluationDays || 18);
            grouped.set(key, item);
        });
        return [...grouped.values()].slice(0, 6);
    }

    function renderBars() {
        const rows = getCategoryRows();
        const max = Math.max(...rows.map(row => row.total), 1);
        return `
            <div class="admin-horizontal-bars">
                ${rows.map(row => `
                    <div>
                        <span>${window.ProcureXAdmin.escapeHtml(row.type)}</span>
                        <strong>${window.ProcureXAdmin.formatMoney(row.total)}</strong>
                        <i style="width: ${Math.max(12, Math.round((row.total / max) * 100))}%"></i>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderDonutLegend() {
        const stats = window.ProcureXAdmin.getAdminStats();
        return `
            <div class="admin-donut-fallback">
                <div class="admin-stat-ring"><strong>${stats.complianceRate}%</strong><span>Compliance</span></div>
                <ul>
                    <li><span class="dot success"></span>Active records <strong>${stats.activeTenders}</strong></li>
                    <li><span class="dot warning"></span>Pending reviews <strong>${stats.pendingReviews}</strong></li>
                    <li><span class="dot error"></span>Flagged issues <strong>${stats.flaggedIssues}</strong></li>
                </ul>
            </div>
        `;
    }

    function renderAdminAnalytics() {
        const tenders = window.ProcureXAdmin.getAdminTenders();
        const categoryRows = getCategoryRows();
        const totalValue = sum(tenders.map(tender => tender.budget || tender.estimatedValue));
        const accounts = window.ProcureXAdmin.getAdminAccounts();
        const suppliers = accounts.filter(account => /supplier/i.test(account.role)).slice(0, 4);
        const buyers = accounts.filter(account => /buyer|admin/i.test(account.role)).slice(0, 4);

        return `
            <div class="main-layout admin-page admin-analytics-page">
                ${window.renderAdminSidebar('admin-analytics')}
                <main class="main-content">
                    <div class="journey-page">
                        <section class="journey-hero compact admin-hero">
                            <div>
                                <span class="badge badge-info">Procurement intelligence</span>
                                <h1>Platform Analytics</h1>
                                <p>High-level platform metrics for procurement volume, evaluation cycle time, award readiness, account activity, supplier participation, and compliance trends.</p>
                            </div>
                            <div class="hero-action-stack">
                                <input class="form-input admin-date-range" value="May 2026 - Jun 2026" aria-label="Date range">
                                <button class="btn btn-secondary" type="button">Export CSV</button>
                                <button class="btn btn-primary" type="button">Export PDF</button>
                            </div>
                        </section>

                        <section class="admin-kpi-grid four-col">
                            <article class="admin-kpi-card"><span>Total Procurement Value</span><strong>${window.ProcureXAdmin.formatCompactMoney(totalValue)}</strong><em>All indexed tenders</em></article>
                            <article class="admin-kpi-card"><span>Tenders Published</span><strong>${tenders.length}</strong><em>Current registry</em></article>
                            <article class="admin-kpi-card"><span>Avg Evaluation Duration</span><strong>18 days</strong><em>Static benchmark</em></article>
                            <article class="admin-kpi-card"><span>Avg Award Cycle Time</span><strong>24 days</strong><em>Static benchmark</em></article>
                        </section>

                        <section class="journey-grid two-col">
                            <div class="journey-panel admin-chart-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Volume</span>
                                        <h2>Procurement volume by category</h2>
                                    </div>
                                </div>
                                ${renderBars()}
                            </div>
                            <div class="journey-panel admin-chart-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Distribution</span>
                                        <h2>Tender status mix</h2>
                                    </div>
                                </div>
                                ${renderDonutLegend()}
                            </div>
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Categories</span>
                                    <h2>Procurement breakdown</h2>
                                </div>
                            </div>
                            ${window.ProcureXShared.renderDataTable(
                                ['Procurement Type', 'Tenders', 'Total Value', 'Avg Bids / Tender', 'Avg Days to Award'],
                                categoryRows.map(row => `
                                    <tr>
                                        <td>${window.ProcureXAdmin.escapeHtml(row.type)}</td>
                                        <td>${row.count}</td>
                                        <td>${window.ProcureXAdmin.formatMoney(row.total)}</td>
                                        <td>${(row.bids / row.count).toFixed(1)}</td>
                                        <td>${Math.round(row.days / row.count)}</td>
                                    </tr>
                                `),
                                'admin-data-table'
                            )}
                        </section>

                        <section class="journey-grid two-col">
                            <div class="journey-panel">
                                <div class="panel-heading"><div><span class="section-kicker">Buyers</span><h2>Top buyer organizations</h2></div></div>
                                <div class="admin-mini-list">
                                    ${buyers.map((account, index) => `<article class="admin-mini-record"><div><span>#${index + 1}</span><strong>${window.ProcureXAdmin.escapeHtml(account.organization)}</strong><em>${window.ProcureXAdmin.escapeHtml(account.role)}</em></div><span class="badge badge-success">${90 - index * 3}%</span></article>`).join('')}
                                </div>
                            </div>
                            <div class="journey-panel">
                                <div class="panel-heading"><div><span class="section-kicker">Suppliers</span><h2>Top supplier organizations</h2></div></div>
                                <div class="admin-mini-list">
                                    ${suppliers.map((account, index) => `<article class="admin-mini-record"><div><span>#${index + 1}</span><strong>${window.ProcureXAdmin.escapeHtml(account.organization)}</strong><em>${window.ProcureXAdmin.escapeHtml(account.role)}</em></div><span class="badge badge-info">${85 - index * 2}%</span></article>`).join('')}
                                </div>
                            </div>
                        </section>

                        <section class="journey-panel admin-chart-panel">
                            <div class="panel-heading"><div><span class="section-kicker">Trend</span><h2>Compliance rate trend</h2></div><span class="badge badge-success">Improving</span></div>
                            <div class="admin-trend-line">
                                ${[84, 86, 87, 89, 91, 92, 94].map((value, index) => `<span style="height:${value}%"><em>${index + 1}</em><strong>${value}%</strong></span>`).join('')}
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        `;
    }

    window.renderAdminAnalytics = renderAdminAnalytics;
    if (window.app) window.app.renderAdminAnalytics = renderAdminAnalytics;
})();
