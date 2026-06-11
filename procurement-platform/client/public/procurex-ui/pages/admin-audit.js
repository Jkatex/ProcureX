// Admin full audit trail. Static visual prototype.
(function () {
    function renderAuditRow(item) {
        return `
            <tr>
                <td>${window.ProcureXAdmin.escapeHtml(item.time)}</td>
                <td><strong>${window.ProcureXAdmin.escapeHtml(item.actor)}</strong><span>${window.ProcureXAdmin.escapeHtml(item.actorRole)}</span></td>
                <td>${window.ProcureXAdmin.escapeHtml(item.action)}</td>
                <td>${window.ProcureXAdmin.escapeHtml(item.entityType)}</td>
                <td>${window.ProcureXAdmin.escapeHtml(item.entityRef)}</td>
                <td>${window.ProcureXAdmin.renderStatusBadge(item.severity)}</td>
                <td>${window.ProcureXAdmin.escapeHtml(item.summary)}</td>
            </tr>
        `;
    }

    function renderAdminAudit() {
        const audit = window.ProcureXAdmin.getAdminAuditTrail();
        const seeded = [
            ...audit,
            {
                time: '2026-06-30 09:18',
                actor: 'Platform Admin',
                actorRole: 'System Administrator',
                action: 'Compliance hold reviewed',
                entityType: 'Award',
                entityRef: 'APP-AWARD-2026-014',
                severity: 'warning',
                summary: 'Award packet marked for standstill and COI evidence inspection.'
            },
            {
                time: '2026-06-28 14:42',
                actor: 'ProcureX System',
                actorRole: 'System',
                action: 'Account verification status changed',
                entityType: 'User',
                entityRef: 'admin@procurex.tz',
                severity: 'info',
                summary: 'Administrative account eKYC status available for review.'
            }
        ];

        return `
            <div class="main-layout admin-page admin-audit-page">
                ${window.renderAdminSidebar('admin-audit')}
                <main class="main-content">
                    <div class="journey-page">
                        <section class="journey-hero compact admin-hero">
                            <div>
                                <span class="badge badge-info">Immutable evidence view</span>
                                <h1>Full Audit Trail</h1>
                                <p>Inspect system events, platform actions, buyer workflow locks, account verification changes, and compliance review history across ProcureX.</p>
                            </div>
                            <div class="hero-action-stack">
                                <input class="form-input admin-date-range" value="Jun 2026" aria-label="Audit date range">
                                <button class="btn btn-secondary" type="button">Export CSV</button>
                                <button class="btn btn-primary" type="button">Export PDF</button>
                            </div>
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Filters</span>
                                    <h2>Audit events</h2>
                                </div>
                                <span class="badge badge-info">${seeded.length} entries</span>
                            </div>
                            <div class="admin-filter-bar">
                                <input class="form-input" type="search" placeholder="Search actor, entity, action, reference, or summary">
                                <select class="form-input"><option>All event types</option><option>Compliance Review</option><option>Bid Opening</option><option>Award</option><option>User</option></select>
                                <select class="form-input"><option>All severities</option><option>info</option><option>warning</option><option>critical</option></select>
                                <select class="form-input"><option>All actor roles</option><option>System Administrator</option><option>Buyer</option><option>Supplier</option><option>System</option></select>
                                <input class="form-input" type="date" aria-label="From date">
                                <input class="form-input" type="date" aria-label="To date">
                            </div>
                        </section>

                        <section class="journey-panel">
                            ${window.ProcureXShared.renderDataTable(
                                ['Timestamp', 'Actor', 'Event / Action', 'Entity Type', 'Entity Reference', 'Severity', 'Summary'],
                                seeded.map(renderAuditRow),
                                'admin-data-table admin-audit-table'
                            )}
                            <div class="admin-pagination">
                                <span>Showing ${Math.min(seeded.length, 10)} of ${seeded.length}</span>
                                <button class="btn btn-secondary btn-sm" type="button">Load More</button>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        `;
    }

    window.renderAdminAudit = renderAdminAudit;
    if (window.app) window.app.renderAdminAudit = renderAdminAudit;
})();
