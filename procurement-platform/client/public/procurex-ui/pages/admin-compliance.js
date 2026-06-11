// Admin compliance rules and settings. Static visual prototype.
(function () {
    function getMethods() {
        const tenders = window.ProcureXAdmin.getAdminTenders();
        const names = [...new Set(tenders.map(tender => tender.procurementMethod || tender.method || tender.type || 'Open Tender'))].slice(0, 5);
        return (names.length ? names : ['Open Tender', 'Restricted Tender', 'Request for Quotations']).map((name, index) => ({
            name,
            ceiling: [5000000000, 1000000000, 250000000, 100000000, 50000000][index] || 100000000,
            period: [30, 21, 14, 10, 7][index] || 14,
            approvals: index === 0 ? 'Accounting Officer + Tender Board' : 'Compliance Officer'
        }));
    }

    function renderAdminCompliance() {
        const methods = getMethods();
        return `
            <div class="main-layout admin-page admin-compliance-page">
                ${window.renderAdminSidebar('admin-compliance')}
                <main class="main-content">
                    <div class="journey-page">
                        <section class="journey-hero compact admin-hero">
                            <div>
                                <span class="badge badge-info">Rules and thresholds</span>
                                <h1>Compliance Rules</h1>
                                <p>Configure-looking controls for procurement method thresholds, checklist templates, standstill periods, and notification events. This prototype shows settings surfaces without changing platform policy.</p>
                            </div>
                            <div class="hero-action-stack">
                                <button class="btn btn-secondary" type="button">Reset</button>
                                <button class="btn btn-primary" type="button">Save Changes</button>
                            </div>
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Thresholds</span>
                                    <h2>Procurement method limits</h2>
                                </div>
                                <span class="badge badge-warning">Prototype settings</span>
                            </div>
                            ${window.ProcureXShared.renderDataTable(
                                ['Method', 'Budget Ceiling', 'Minimum Bidding Period', 'Required Approvals'],
                                methods.map(method => `
                                    <tr>
                                        <td><input class="form-input" value="${window.ProcureXAdmin.escapeHtml(method.name)}"></td>
                                        <td><input class="form-input" value="${window.ProcureXAdmin.formatMoney(method.ceiling)}"></td>
                                        <td><input class="form-input" value="${method.period} days"></td>
                                        <td><input class="form-input" value="${window.ProcureXAdmin.escapeHtml(method.approvals)}"></td>
                                    </tr>
                                `),
                                'admin-data-table'
                            )}
                        </section>

                        <section class="journey-grid two-col">
                            <div class="journey-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Templates</span>
                                        <h2>Compliance checklist templates</h2>
                                    </div>
                                    <button class="btn btn-secondary btn-sm" type="button">Add Item</button>
                                </div>
                                <div class="admin-rule-list">
                                    <article><span>Publication</span><strong>Method and threshold approval</strong><em>Pass required before tender publication.</em><button class="btn btn-secondary btn-sm" type="button">Edit</button></article>
                                    <article><span>Evaluation</span><strong>Published criteria traceability</strong><em>Buyer scoring must reference tender criteria.</em><button class="btn btn-secondary btn-sm" type="button">Edit</button></article>
                                    <article><span>Award</span><strong>COI and standstill evidence</strong><em>Declaration and complaint window must be visible.</em><button class="btn btn-secondary btn-sm" type="button">Edit</button></article>
                                </div>
                            </div>

                            <div class="journey-panel">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Standstill</span>
                                        <h2>Period settings</h2>
                                    </div>
                                    <span class="badge badge-info">14 days default</span>
                                </div>
                                <div class="admin-settings-grid">
                                    ${methods.slice(0, 4).map(method => `
                                        <label>
                                            <span>${window.ProcureXAdmin.escapeHtml(method.name)}</span>
                                            <input class="form-input" value="${method.period === 7 ? 7 : 14} days">
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </section>

                        <section class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Notifications</span>
                                    <h2>Admin alert events</h2>
                                </div>
                                <span class="badge badge-info">Email and in-app</span>
                            </div>
                            <div class="admin-notification-grid">
                                ${['Tender returned for correction', 'Evaluation locked by buyer', 'Award routed for approval', 'Complaint received during standstill', 'Supplier account suspended', 'Critical audit event'].map((label, index) => `
                                    <label class="admin-toggle-row">
                                        <input type="checkbox" ${index < 4 ? 'checked' : ''}>
                                        <span>${window.ProcureXAdmin.escapeHtml(label)}</span>
                                        <em>${index < 4 ? 'Enabled' : 'Available'}</em>
                                    </label>
                                `).join('')}
                            </div>
                            <div class="admin-footer-actions">
                                <button class="btn btn-secondary" type="button">Reset</button>
                                <button class="btn btn-primary" type="button">Save Changes</button>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        `;
    }

    window.renderAdminCompliance = renderAdminCompliance;
    if (window.app) window.app.renderAdminCompliance = renderAdminCompliance;
})();
