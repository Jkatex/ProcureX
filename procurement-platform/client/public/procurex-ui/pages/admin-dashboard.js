// Admin command center. Static oversight prototype; operational decisions remain buyer-owned.
(function () {
    function renderKpi(label, value, note = '') {
        return `
            <article class="admin-kpi-card">
                <span>${window.ProcureXAdmin.escapeHtml(label)}</span>
                <strong>${window.ProcureXAdmin.escapeHtml(value)}</strong>
                <em>${window.ProcureXAdmin.escapeHtml(note)}</em>
            </article>
        `;
    }

    function renderActivityBars() {
        const series = window.ProcureXAdmin.getActivitySeries();
        const max = Math.max(...series.map(item => item.value));
        return `
            <div class="admin-bar-chart" aria-label="Daily compliance actions this week">
                ${series.map(item => `
                    <div>
                        <span>${window.ProcureXAdmin.escapeHtml(item.label)}</span>
                        <i style="height: ${Math.round((item.value / max) * 100)}%"></i>
                        <strong>${item.value}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderQueueItem(item) {
        return `
            <article class="admin-urgency-card urgency-${window.ProcureXAdmin.escapeHtml(item.urgency)}">
                <div>
                    <div class="admin-card-meta">
                        <span class="admin-urgency-dot"></span>
                        <span>${window.ProcureXAdmin.escapeHtml(item.stage)}</span>
                        ${window.ProcureXAdmin.renderStatusBadge(item.status)}
                    </div>
                    <h3>${window.ProcureXAdmin.escapeHtml(item.title)}</h3>
                    <p>${window.ProcureXAdmin.escapeHtml(item.owner)} / ${window.ProcureXAdmin.formatMoney(item.value)}</p>
                    <small>${window.ProcureXAdmin.escapeHtml(item.issue)}</small>
                </div>
                <div class="admin-action-row" aria-label="Compliance actions">
                    <button class="btn btn-primary btn-sm" type="button">Approve</button>
                    <button class="btn btn-secondary btn-sm" type="button">Flag Issue</button>
                    <button class="btn btn-secondary btn-sm" type="button">Hold</button>
                    <button class="btn btn-secondary btn-sm" type="button">Return</button>
                </div>
            </article>
        `;
    }

    function renderMiniRecord(row) {
        return `
            <article class="admin-mini-record">
                <div>
                    <span>${window.ProcureXAdmin.escapeHtml(row.type || row.stage)}</span>
                    <strong>${window.ProcureXAdmin.escapeHtml(row.title)}</strong>
                    <em>${window.ProcureXAdmin.escapeHtml(row.reference || row.party || '')}</em>
                </div>
                ${window.ProcureXAdmin.renderStatusBadge(row.status)}
            </article>
        `;
    }

    function renderAdminDashboard() {
        const stats = window.ProcureXAdmin.getAdminStats();
        const rows = window.ProcureXAdmin.getAdminSearchRows();
        const queue = window.ProcureXAdmin.getComplianceQueue();
        const evaluations = rows.filter(row => row.type === 'Evaluation').slice(0, 4);
        const exceptions = rows.filter(row => /flag|risk|hold|return|warning|critical|issue|pending/i.test(`${row.status} ${row.summary}`)).slice(0, 5);
        const audit = window.ProcureXAdmin.getAdminAuditTrail().slice(0, 6);

        return `
            <div class="main-layout admin-page admin-command-page">
                ${window.renderAdminSidebar('admin-dashboard')}
                <main class="main-content">
                    <div class="journey-page">
                        <section class="journey-hero compact admin-hero">
                            <div>
                                <span class="badge badge-info">System Administrator</span>
                                <h1>Admin Command Center</h1>
                                <p>Compliance oversight for procurement records, buyer evaluation visibility, account verification, and audit evidence. Admin tools inspect and route issues without changing scores, rankings, awards, tenders, or bids.</p>
                            </div>
                            <div class="hero-action-stack">
                                <button class="btn btn-primary" type="button" data-navigate="admin-audit">Audit Trail</button>
                            </div>
                        </section>

                        <section class="admin-kpi-grid six-col">
                            ${renderKpi('Active Tenders', stats.activeTenders, 'Published or in-flight')}
                            ${renderKpi('Pending Compliance Reviews', stats.pendingReviews, 'Need admin inspection')}
                            ${renderKpi('Flagged Issues', stats.flaggedIssues, 'Warnings and returns')}
                            ${renderKpi('Compliance Rate', `${stats.complianceRate}%`, 'Current platform signal')}
                            ${renderKpi('Evaluation Drafts', stats.evaluationDrafts, 'Read-only to admin')}
                            ${renderKpi('Audit Events Today', stats.auditEventsToday, 'Recorded oversight')}
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Compliance queue</span>
                                    <h2>Prioritized admin actions</h2>
                                </div>
                                <span class="badge badge-warning">${queue.length} items</span>
                            </div>
                            <div class="admin-queue-list">
                                ${queue.map(renderQueueItem).join('')}
                            </div>
                        </section>

                        <section class="journey-panel admin-chart-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Platform activity</span>
                                    <h2>Compliance actions this week</h2>
                                </div>
                                <span class="badge badge-info">Platform overview</span>
                            </div>
                            ${renderActivityBars()}
                        </section>

                        <section class="journey-grid two-col">
                            <div class="journey-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Evaluation oversight</span>
                                        <h2>Buyer drafts visible to admin</h2>
                                    </div>
                                    <button class="btn btn-secondary btn-sm" type="button" data-navigate="admin-analytics">Inspect</button>
                                </div>
                                <div class="admin-mini-list">
                                    ${evaluations.map(renderMiniRecord).join('') || '<div class="scope-empty">No buyer evaluation drafts found.</div>'}
                                </div>
                            </div>
                            <div class="journey-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Exception log</span>
                                        <h2>Flags, holds, and risks</h2>
                                    </div>
                                    <button class="btn btn-secondary btn-sm" type="button" data-navigate="admin-audit">Open log</button>
                                </div>
                                <div class="admin-mini-list">
                                    ${exceptions.map(renderMiniRecord).join('') || '<div class="scope-empty">No exceptions are currently flagged.</div>'}
                                </div>
                            </div>
                        </section>

                        <section class="journey-grid two-col">
                            <div class="journey-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Compliance controls</span>
                                        <h2>Checklist preview</h2>
                                    </div>
                                    <span class="badge badge-info">Per procurement</span>
                                </div>
                                <ul class="admin-checklist">
                                    <li><span class="badge badge-success">Pass</span><strong>Procurement method threshold</strong><em>Budget and method are aligned before publication.</em></li>
                                    <li><span class="badge badge-success">Pass</span><strong>Minimum bidding period</strong><em>Publication window is checked against method settings.</em></li>
                                    <li><span class="badge badge-warning">Warn</span><strong>Evaluation traceability</strong><em>Buyer notes must reference published criteria and submitted evidence.</em></li>
                                    <li><span class="badge badge-warning">Warn</span><strong>Conflict declarations</strong><em>Missing declarations are returned before award routing.</em></li>
                                </ul>
                            </div>
                            <div class="journey-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Audit trail</span>
                                        <h2>Last admin actions</h2>
                                    </div>
                                    <button class="btn btn-secondary btn-sm" type="button" data-navigate="admin-audit">View all</button>
                                </div>
                                <div class="admin-timeline">
                                    ${audit.map(item => `
                                        <div>
                                            <strong>${window.ProcureXAdmin.escapeHtml(item.action)}</strong>
                                            <span>${window.ProcureXAdmin.escapeHtml(item.entityRef)} / ${window.ProcureXAdmin.escapeHtml(item.time)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        `;
    }

    window.renderAdminDashboard = renderAdminDashboard;
    if (window.app) window.app.renderAdminDashboard = renderAdminDashboard;
})();
