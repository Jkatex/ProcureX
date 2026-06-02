function renderTenderPlanning() {
    return `
        <div class="main-layout tender-planning-page">
            <aside class="sidebar tender-planning-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Tender Planning</h3>
                    <span>Pre-award planning workspace</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#planning-dashboard" class="active">Dashboard</a></li>
                    <li><a href="#app-plan">Annual Procurement Plan</a></li>
                    <li><a href="#spp-plan">Specific Procurement Plan</a></li>
                    <li><a href="#budget-confirmation">Budget Confirmation</a></li>
                    <li><a href="#plan-approvals">Plan Approvals</a></li>
                    <li><a href="#planning-documents">Documents</a></li>
                    <li><a href="#planning-reports">Reports</a></li>
                    <li><a href="#" data-navigate="create-tender">Tender/RFQ</a></li>
                    <li><a href="#" data-navigate="awarding-contracts">Award and Contract</a></li>
                </ul>
            </aside>

            <main class="main-content tender-planning-content">
                <section class="procurement-hero tender-planning-hero planning-command-hero" id="planning-dashboard">
                    <div>
                        <span class="section-kicker">Planning before tendering</span>
                        <h1>Tender Planning</h1>
                        <p>Manage APP and SPP records before Tender/RFQ, Evaluation, Award and Contract, Delivery, Inspection, Payment, and Closeout.</p>
                        <div class="inline-actions">
                            <button class="btn btn-primary" type="button">New APP Item</button>
                            <button class="btn btn-secondary" type="button">Upload Plan Documents</button>
                        </div>
                    </div>
                    <div class="planning-command-panel">
                        <div class="planning-command-panel-head">
                            <span>Portfolio readiness</span>
                            <strong>73%</strong>
                        </div>
                        <div class="planning-readiness-meter" aria-hidden="true"><i style="width: 73%"></i></div>
                        <div class="planning-command-list">
                            <div><strong>42</strong><span>APP items captured</span></div>
                            <div><strong>18</strong><span>SPP schedules active</span></div>
                            <div><strong>7</strong><span>Activities need attention</span></div>
                        </div>
                    </div>
                </section>

                <div class="award-info-banner tender-planning-flow">
                    <strong>Workflow</strong>
                    <span>APP &rarr; SPP &rarr; Budget Confirmation &rarr; Approval &rarr; Tender/RFQ &rarr; Evaluation &rarr; Award and Contract &rarr; Delivery &rarr; Inspection &rarr; Payment &rarr; Closeout</span>
                </div>

                <div class="planning-workflow-stepper" aria-label="Tender planning workflow">
                    <span class="complete">APP</span>
                    <span class="complete">SPP</span>
                    <span class="active">Budget</span>
                    <span>Approval</span>
                    <span>Tender/RFQ</span>
                    <span>Evaluation</span>
                    <span>Award</span>
                    <span>Delivery</span>
                    <span>Inspection</span>
                    <span>Payment</span>
                    <span>Closeout</span>
                </div>

                <section class="awarding-summary-grid">
                    <article class="awarding-summary-card"><span class="summary-trend">!</span><strong>9</strong><span>Budget checks</span><em>Finance confirmations awaiting action</em></article>
                    <article class="awarding-summary-card"><span class="summary-trend">+</span><strong>6</strong><span>Approved APP</span><em>Items ready to create SPP</em></article>
                    <article class="awarding-summary-card"><span class="summary-trend">%</span><strong>73%</strong><span>Average progress</span><em>SPP activity completion</em></article>
                    <article class="awarding-summary-card"><span class="summary-trend">#</span><strong>24</strong><span>Documents</span><em>Plans, specs, budget notes, approvals</em></article>
                </section>

                <section class="planning-executive-grid">
                    <article class="planning-premium-card planning-readiness-card">
                        <div>
                            <span class="section-kicker">Executive snapshot</span>
                            <h3>Planning readiness</h3>
                            <p>Approved demand, confirmed budget, and SPP activities are tracking toward tender handoff.</p>
                        </div>
                        <div class="planning-ring" aria-hidden="true"><strong>73%</strong><span>ready</span></div>
                    </article>
                    <article class="planning-premium-card">
                        <span class="section-kicker">Next milestone</span>
                        <h3>Tender/RFQ preparation</h3>
                        <p>6 approved APP items can be converted into SPP schedules this week.</p>
                        <div class="planning-card-foot"><span class="badge badge-success">On track</span><strong>Jun 7</strong></div>
                    </article>
                    <article class="planning-premium-card">
                        <span class="section-kicker">Risk watch</span>
                        <h3>Budget shortfalls</h3>
                        <p>Fleet maintenance and two works packages need finance clearance before approval.</p>
                        <div class="planning-card-foot"><span class="badge badge-warning">3 risks</span><strong>TZS 94M</strong></div>
                    </article>
                    <article class="planning-premium-card">
                        <span class="section-kicker">Handoff quality</span>
                        <h3>Document completeness</h3>
                        <p>Needs assessment, specifications, approval memo, and budget note coverage.</p>
                        <div class="planning-card-foot"><span class="badge badge-info">24 files</span><strong>88%</strong></div>
                    </article>
                </section>

                <section class="procurement-panel evaluation-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Search and filters</span>
                            <h2>Planning control center</h2>
                            <p class="panel-note">APP and SPP stay in Tender Planning, then hand off to Tender/RFQ and Award and Contract.</p>
                        </div>
                        <div class="inline-actions">
                            <button class="btn btn-secondary btn-sm" type="button">Export Excel</button>
                            <button class="btn btn-secondary btn-sm" type="button">Export PDF</button>
                        </div>
                    </div>
                    <div class="planning-filter-bar">
                        <label>Search <input class="form-input" placeholder="APP item, SPP code, department"></label>
                        <label>Department <select class="form-input"><option>All departments</option><option>ICT</option><option>Health Services</option><option>Operations</option></select></label>
                        <label>Status <select class="form-input"><option>All statuses</option><option>Draft</option><option>Budget confirmed</option><option>Approved</option><option>Delayed</option></select></label>
                        <button class="btn btn-secondary btn-sm" type="button">Apply filters</button>
                    </div>
                </section>

                <section class="procurement-panel evaluation-panel" id="app-plan">
                    <div class="panel-heading"><div><span class="section-kicker">Annual Procurement Plan</span><h2>APP item details</h2></div><span class="badge badge-info">Draft APP</span></div>
                    <form class="planning-form-grid">
                        <label>Financial year <input class="form-input" value="2026/2027"></label>
                        <label>Department <input class="form-input" value="Health Services"></label>
                        <label>Procurement item <input class="form-input" value="Hospital theatre equipment"></label>
                        <label>Category <select class="form-input"><option>Goods</option><option>Works</option><option>Services</option><option>Consultancy</option></select></label>
                        <label>Estimated budget <input class="form-input" value="TZS 480,000,000"></label>
                        <label>Funding source <input class="form-input" value="Development budget"></label>
                        <label>Procurement method <select class="form-input"><option>National competitive tendering</option><option>RFQ</option><option>Framework agreement</option></select></label>
                        <label>Planned dates <input class="form-input" value="Jul 2026 - Nov 2026"></label>
                        <label>Responsible officer <input class="form-input" value="Amina Yusuf"></label>
                        <label>Priority <select class="form-input"><option>High</option><option>Medium</option><option>Low</option></select></label>
                        <label>Status <select class="form-input"><option>Draft</option><option>Submitted</option><option>Approved</option><option>Returned</option></select></label>
                        <div class="inline-actions"><button class="btn btn-primary" type="button">Save APP Item</button><button class="btn btn-secondary" type="button">Submit for Review</button></div>
                    </form>
                    <div class="data-table planning-table">
                        <table>
                            <thead><tr><th>APP item</th><th>FY</th><th>Department</th><th>Budget</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                <tr><td><strong>Hospital theatre equipment</strong><span>APP-2026-014</span></td><td>2026/2027</td><td>Health Services</td><td>TZS 480,000,000</td><td>NCT</td><td><span class="badge badge-success">Approved</span></td><td><button class="btn btn-primary btn-sm" type="button">Create SPP</button></td></tr>
                                <tr><td><strong>Fleet maintenance framework</strong><span>APP-2026-021</span></td><td>2026/2027</td><td>Operations</td><td>TZS 125,000,000</td><td>Framework</td><td><span class="badge badge-warning">Budget review</span></td><td><button class="btn btn-secondary btn-sm" type="button">Review</button></td></tr>
                                <tr><td><strong>Ward renovation works</strong><span>APP-2026-027</span></td><td>2026/2027</td><td>Infrastructure</td><td>TZS 760,000,000</td><td>NCT</td><td><span class="badge badge-success">Approved</span></td><td><button class="btn btn-primary btn-sm" type="button">Create SPP</button></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="planning-two-col" id="spp-plan">
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Specific Procurement Plan</span><h2>SPP activity schedule</h2></div><span class="badge badge-info">SPP-2026-006</span></div>
                        <div class="planning-timeline-list">
                            ${['Specifications/TOR', 'Budget confirmation', 'Tender/RFQ preparation', 'Supplier invitation/publication', 'Bid submission', 'Evaluation', 'Award recommendation', 'Contract preparation', 'Delivery', 'Inspection', 'Payment', 'Closeout'].map((step, index) => `
                                <div><strong>${step}</strong><span>${index < 2 ? 'In progress' : 'Planned activity'}</span><em class="badge ${index === 0 ? 'badge-success' : index === 1 ? 'badge-warning' : 'badge-info'}">${index === 0 ? 'Complete' : index === 1 ? 'Due today' : 'Planned'}</em></div>
                            `).join('')}
                        </div>
                    </article>
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Role-based access</span><h2>Planning permissions</h2></div></div>
                        <div class="data-table planning-table">
                            <table>
                                <thead><tr><th>Role</th><th>Access</th><th>Approval rights</th></tr></thead>
                                <tbody>
                                    <tr><td>Requesting department</td><td>Create needs and specs</td><td>Submit requisition</td></tr>
                                    <tr><td>Procurement officer</td><td>Manage APP/SPP and handoff</td><td>Recommend plan</td></tr>
                                    <tr><td>Finance officer</td><td>Budget checks</td><td>Confirm budget</td></tr>
                                    <tr><td>Tender board/approver</td><td>Review plans</td><td>Approve or return</td></tr>
                                    <tr><td>Auditor</td><td>Read-only audit trail</td><td>None</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </article>
                </section>

                <section class="planning-two-col" id="budget-confirmation">
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Budget Confirmation</span><h2>Finance checks</h2></div><span class="badge badge-warning">9 pending</span></div>
                        <div class="data-table planning-table">
                            <table>
                                <thead><tr><th>Plan item</th><th>Funding source</th><th>Budget</th><th>Status</th><th>Action</th></tr></thead>
                                <tbody>
                                    <tr><td>Hospital theatre equipment</td><td>Development budget</td><td>TZS 480,000,000</td><td><span class="badge badge-success">Confirmed</span></td><td><button class="btn btn-secondary btn-sm">View</button></td></tr>
                                    <tr><td>Fleet maintenance framework</td><td>Operational budget</td><td>TZS 125,000,000</td><td><span class="badge badge-warning">Shortfall</span></td><td><button class="btn btn-primary btn-sm">Resolve</button></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </article>
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Reminders and alerts</span><h2>Delayed activities</h2></div></div>
                        <div class="dashboard-action-queue planning-alert-list">
                            <button class="dashboard-action-row critical" type="button"><span class="dashboard-action-count">3</span><div><strong>Budget confirmation overdue</strong><span>Finance officer action required today</span></div><em>Critical</em><b>Remind</b></button>
                            <button class="dashboard-action-row attention" type="button"><span class="dashboard-action-count">4</span><div><strong>Specifications delayed</strong><span>Requesting departments have pending uploads</span></div><em>Attention</em><b>Notify</b></button>
                        </div>
                    </article>
                </section>

                <section class="planning-two-col" id="plan-approvals">
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Plan Approvals</span><h2>Approval queue</h2></div><span class="badge badge-warning">11 pending</span></div>
                        <div class="status-section-list dashboard-account-compliance">
                            <div class="status-section attention"><strong>SPP-2026-006</strong><span>Head of procurement approval required</span><button class="btn btn-primary btn-sm" type="button">Approve</button></div>
                            <div class="status-section attention"><strong>APP-2026-021</strong><span>Finance returned budget shortfall</span><button class="btn btn-secondary btn-sm" type="button">Return</button></div>
                        </div>
                    </article>
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Audit trail</span><h2>Recent planning events</h2></div><span class="badge badge-info">Auditor view</span></div>
                        <div class="dashboard-activity-feed">
                            <button class="dashboard-activity-item" type="button"><div><strong>Finance confirmed budget</strong><span>Hospital theatre equipment / Fatma M.</span></div><time>Jun 2, 2026</time></button>
                            <button class="dashboard-activity-item" type="button"><div><strong>SPP generated from approved APP</strong><span>SPP-2026-006 / Amina Yusuf</span></div><time>Jun 1, 2026</time></button>
                        </div>
                    </article>
                </section>

                <section class="planning-two-col" id="planning-documents">
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Documents</span><h2>Planning document register</h2></div><span class="badge badge-warning">5 pending review</span></div>
                        <div class="planning-upload-box"><div><strong>Attach APP/SPP evidence</strong><span>Needs assessment, specifications/TOR, budget confirmation, approval memo, board minutes, and handoff notes</span></div><button class="btn btn-primary btn-sm" type="button">Upload documents</button></div>
                        <div class="data-table planning-table"><table><thead><tr><th>Document</th><th>Linked record</th><th>Owner</th><th>Status</th></tr></thead><tbody><tr><td>Needs assessment</td><td>APP-2026-014</td><td>Requesting department</td><td><span class="badge badge-success">Accepted</span></td></tr><tr><td>Specifications/TOR</td><td>SPP-2026-006</td><td>Procurement officer</td><td><span class="badge badge-warning">Review</span></td></tr></tbody></table></div>
                    </article>
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading"><div><span class="section-kicker">Reports</span><h2>Export planning reports</h2></div></div>
                        <div class="planning-report-grid" id="planning-reports">
                            <article class="analytics-card"><span>APP by department</span><strong>42 items</strong><p>Grouped by financial year, department, category, method, priority, and status.</p><button class="btn btn-secondary btn-sm" type="button">Export Excel</button></article>
                            <article class="analytics-card"><span>SPP progress</span><strong>73%</strong><p>Activity completion, delayed activity alerts, and responsible officer workload.</p><button class="btn btn-secondary btn-sm" type="button">Export PDF</button></article>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    `;
}

window.renderTenderPlanning = renderTenderPlanning;
