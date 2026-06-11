// Admin deep search. Static visual prototype using the shared derived admin index.
(function () {
    function renderKpi(label, value) {
        return `
            <article class="admin-kpi-card">
                <span>${window.ProcureXAdmin.escapeHtml(label)}</span>
                <strong>${window.ProcureXAdmin.escapeHtml(value)}</strong>
                <em>Indexed records</em>
            </article>
        `;
    }

    function renderRow(row) {
        return `
            <tr>
                <td><span class="badge badge-info">${window.ProcureXAdmin.escapeHtml(row.type)}</span></td>
                <td>
                    <strong>${window.ProcureXAdmin.escapeHtml(row.title)}</strong>
                    <span>${window.ProcureXAdmin.escapeHtml(row.reference)} / ${window.ProcureXAdmin.escapeHtml(row.party)}</span>
                </td>
                <td>${window.ProcureXAdmin.renderStatusBadge(row.status)}</td>
                <td>${window.ProcureXAdmin.escapeHtml(row.stage)}</td>
                <td>${window.ProcureXAdmin.escapeHtml(row.party || '-')}</td>
                <td>${row.amount ? window.ProcureXAdmin.formatMoney(row.amount) : '-'}</td>
                <td>${window.ProcureXAdmin.escapeHtml(row.summary)}</td>
                <td><button class="btn btn-secondary btn-sm" type="button">View</button></td>
            </tr>
        `;
    }

    function renderAdminSearch() {
        const rows = window.ProcureXAdmin.getAdminSearchRows();
        const stats = window.ProcureXAdmin.getAdminStats();
        const types = [...new Set(rows.map(row => row.type))].sort();
        const statuses = [...new Set(rows.map(row => row.status).filter(Boolean))].sort();
        const stages = [...new Set(rows.map(row => row.stage).filter(Boolean))].sort();

        return `
            <div class="main-layout admin-page admin-search-page">
                ${window.renderAdminSidebar('admin-search')}
                <main class="main-content">
                    <div class="journey-page">
                        <section class="journey-hero compact admin-hero">
                            <div>
                                <span class="badge badge-info">System-wide index</span>
                                <h1>Deep Search</h1>
                                <p>Search and inspect procurement records, submitted bids, buyer evaluation drafts, award packets, documents, accounts, contracts, and audit events from one admin oversight surface.</p>
                            </div>
                            <div class="hero-action-stack">
                                <button class="btn btn-secondary" type="button">Export CSV</button>
                                <button class="btn btn-primary" type="button">Export PDF</button>
                            </div>
                        </section>

                        <section class="admin-kpi-grid six-col">
                            ${renderKpi('Tenders', stats.tenders)}
                            ${renderKpi('Bids', stats.bids)}
                            ${renderKpi('Evaluations', stats.evaluations)}
                            ${renderKpi('Flags', stats.flags)}
                            ${renderKpi('Documents', stats.documents)}
                            ${renderKpi('Audits', stats.audits)}
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Filters</span>
                                    <h2>Indexed records</h2>
                                </div>
                                <span class="badge badge-info">${rows.length} records</span>
                            </div>
                            <div class="admin-filter-bar">
                                <input class="form-input" type="search" placeholder="Search title, reference, party, status, or summary">
                                <select class="form-input">
                                    <option>All record types</option>
                                    ${types.map(type => `<option>${window.ProcureXAdmin.escapeHtml(type)}</option>`).join('')}
                                </select>
                                <select class="form-input">
                                    <option>All statuses</option>
                                    ${statuses.map(status => `<option>${window.ProcureXAdmin.escapeHtml(status)}</option>`).join('')}
                                </select>
                                <select class="form-input">
                                    <option>All stages</option>
                                    ${stages.map(stage => `<option>${window.ProcureXAdmin.escapeHtml(stage)}</option>`).join('')}
                                </select>
                                <input class="form-input" type="date" aria-label="From date">
                                <input class="form-input" type="date" aria-label="To date">
                                <input class="form-input" type="number" min="0" placeholder="Min amount">
                                <input class="form-input" type="number" min="0" placeholder="Max amount">
                            </div>
                            <div class="admin-quick-row">
                                <button class="btn btn-secondary btn-sm" type="button">Flagged</button>
                                <button class="btn btn-secondary btn-sm" type="button">Evaluations</button>
                                <button class="btn btn-secondary btn-sm" type="button">Documents</button>
                                <button class="btn btn-secondary btn-sm" type="button">Audit</button>
                                <button class="btn btn-secondary btn-sm" type="button">Clear</button>
                            </div>
                        </section>

                        <section class="journey-panel">
                            ${window.ProcureXShared.renderDataTable(
                                ['Type', 'Record', 'Status', 'Stage', 'Party', 'Amount', 'Summary', ''],
                                rows.map(renderRow),
                                'admin-data-table'
                            )}
                        </section>
                    </div>
                </main>
            </div>
        `;
    }

    window.renderAdminSearch = renderAdminSearch;
    window.initializeAdminSearch = function initializeAdminSearch() {};
    if (window.app) window.app.renderAdminSearch = renderAdminSearch;
})();
