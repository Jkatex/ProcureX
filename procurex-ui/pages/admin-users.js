// Admin user and account management. Static visual prototype.
(function () {
    function initials(name = '') {
        return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PX';
    }

    function renderAccountRow(account) {
        return `
            <tr>
                <td><span class="admin-avatar">${window.ProcureXAdmin.escapeHtml(initials(account.name))}</span></td>
                <td><strong>${window.ProcureXAdmin.escapeHtml(account.name)}</strong></td>
                <td><span>${window.ProcureXAdmin.escapeHtml(account.email)}</span><em>${window.ProcureXAdmin.escapeHtml(account.phone)}</em></td>
                <td>${window.ProcureXAdmin.escapeHtml(account.organization)}</td>
                <td>${window.ProcureXAdmin.renderStatusBadge(account.role)}</td>
                <td>${window.ProcureXAdmin.renderStatusBadge(account.verification)}</td>
                <td>${window.ProcureXAdmin.formatDate(account.joined)}</td>
                <td class="admin-table-actions">
                    <button class="btn btn-secondary btn-sm" type="button">View</button>
                    <button class="btn btn-secondary btn-sm" type="button">Suspend</button>
                    <button class="btn btn-secondary btn-sm" type="button">Reset</button>
                </td>
            </tr>
        `;
    }

    function renderAdminUsers() {
        const accounts = window.ProcureXAdmin.getAdminAccounts();
        const verified = accounts.filter(account => /complete|verified/i.test(account.verification)).length;
        const pending = accounts.filter(account => /pending/i.test(account.verification)).length;
        const selected = accounts[0] || {};

        return `
            <div class="main-layout admin-page admin-users-page">
                ${window.renderAdminSidebar('admin-users')}
                <main class="main-content">
                    <div class="journey-page">
                        <section class="journey-hero compact admin-hero">
                            <div>
                                <span class="badge badge-info">Identity and access</span>
                                <h1>User Management</h1>
                                <p>Review registered accounts, verification status, role boundaries, submitted account evidence, and account-level audit history. Admins can inspect and route account issues without creating operational procurement actions.</p>
                            </div>
                            <div class="hero-action-stack">
                                <button class="btn btn-secondary" type="button">Invite Account</button>
                                <button class="btn btn-primary" type="button">Export Accounts</button>
                            </div>
                        </section>

                        <section class="admin-kpi-grid four-col">
                            <article class="admin-kpi-card"><span>Total Accounts</span><strong>${accounts.length}</strong><em>Platform users</em></article>
                            <article class="admin-kpi-card"><span>Verified</span><strong>${verified}</strong><em>eKYC complete</em></article>
                            <article class="admin-kpi-card"><span>Pending Verification</span><strong>${pending}</strong><em>Awaiting review</em></article>
                            <article class="admin-kpi-card"><span>Suspended</span><strong>0</strong><em>Prototype state</em></article>
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Search and filters</span>
                                    <h2>Registered accounts</h2>
                                </div>
                                <span class="badge badge-info">Read-only oversight</span>
                            </div>
                            <div class="admin-filter-bar">
                                <input class="form-input" type="search" placeholder="Search name, email, phone, or organization">
                                <select class="form-input"><option>All roles</option><option>Buyer</option><option>Supplier</option><option>Admin</option></select>
                                <select class="form-input"><option>All verification statuses</option><option>eKYC Complete</option><option>Pending Verification</option><option>Suspended</option></select>
                            </div>
                        </section>

                        <section class="admin-split-with-drawer">
                            <div class="journey-panel">
                                ${window.ProcureXShared.renderDataTable(
                                    ['Avatar', 'Name', 'Email / Phone', 'Organization', 'Role', 'Verification', 'Joined', 'Actions'],
                                    accounts.map(renderAccountRow),
                                    'admin-data-table admin-users-table'
                                )}
                            </div>
                            <aside class="admin-drawer admin-drawer-open" aria-label="Account detail preview">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Detail drawer</span>
                                        <h2>${window.ProcureXAdmin.escapeHtml(selected.name || 'Account')}</h2>
                                    </div>
                                    ${window.ProcureXAdmin.renderStatusBadge(selected.verification || 'Verified')}
                                </div>
                                <div class="admin-drawer-profile">
                                    <span class="admin-avatar large">${window.ProcureXAdmin.escapeHtml(initials(selected.name))}</span>
                                    <div>
                                        <strong>${window.ProcureXAdmin.escapeHtml(selected.organization || '-')}</strong>
                                        <span>${window.ProcureXAdmin.escapeHtml(selected.email || '-')}</span>
                                    </div>
                                </div>
                                <dl class="admin-detail-list">
                                    <dt>Role</dt><dd>${window.ProcureXAdmin.escapeHtml(selected.role || '-')}</dd>
                                    <dt>Phone</dt><dd>${window.ProcureXAdmin.escapeHtml(selected.phone || '-')}</dd>
                                    <dt>Documents</dt><dd>Business registration, tax certificate, identity verification</dd>
                                    <dt>Permissions</dt><dd>${window.ProcureXAdmin.escapeHtml((selected.permissions || []).slice(0, 5).join(', ') || 'Standard access')}</dd>
                                </dl>
                                <div class="admin-timeline compact">
                                    <div><strong>Account reviewed</strong><span>Verification evidence available for inspection.</span></div>
                                    <div><strong>Role boundary checked</strong><span>No operational tender or bid creation granted to admin view.</span></div>
                                </div>
                            </aside>
                        </section>
                    </div>
                </main>
            </div>
        `;
    }

    window.renderAdminUsers = renderAdminUsers;
    if (window.app) window.app.renderAdminUsers = renderAdminUsers;
})();
