// Tender Draft Detail and Publication Page Component

function renderTenderPublication() {
    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Tender Draft Detail</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Pending approval to active publication</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="create-tender">Back to Create</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="procurement-dashboard">Procurement Dashboard</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-warning">Pending approval</span>
                            <h1>Tender Draft Detail</h1>
                            <p>Review the submitted tender package, approval route, risk checks, and publication readiness before it becomes active in the marketplace.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" data-navigate="create-tender">Edit Draft</button>
                            <button class="btn btn-primary" data-navigate="tender-details">Approve and Publish</button>
                        </div>
                    </section>

                    <section class="journey-grid two-col">
                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Tender package</span>
                                    <h2>Construction of Rural Health Centers</h2>
                                </div>
                                <span class="badge badge-warning">Draft</span>
                            </div>
                            <div class="record-summary">
                                <div><span>Tender ID</span><strong>T001</strong></div>
                                <div><span>Procuring entity</span><strong>Ministry of Health</strong></div>
                                <div><span>Type and category</span><strong>Works / Healthcare infrastructure</strong></div>
                                <div><span>Estimated budget</span><strong>TZS 4,800,000,000</strong></div>
                            </div>
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr><th>Timeline event</th><th>Date</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>Publication</td><td>May 12, 2026</td><td><span class="badge badge-info">Ready</span></td></tr>
                                        <tr><td>Clarification deadline</td><td>May 28, 2026</td><td><span class="badge badge-success">Valid</span></td></tr>
                                        <tr><td>Bid closing</td><td>June 12, 2026</td><td><span class="badge badge-success">Valid</span></td></tr>
                                        <tr><td>Award target</td><td>June 30, 2026</td><td><span class="badge badge-info">Planned</span></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Approval Queue</span>
                                    <h2>Routing Status</h2>
                                </div>
                                <span class="badge badge-warning">2 pending</span>
                            </div>
                            <div class="inbox-list">
                                <div class="inbox-item"><strong>Procurement Officer</strong><span>Creator attestation complete.</span><span class="badge badge-success">Approved</span></div>
                                <div class="inbox-item"><strong>Department Head</strong><span>Budget and scope approval pending.</span><button class="btn btn-secondary">Remind</button></div>
                                <div class="inbox-item"><strong>Chief Procurement Officer</strong><span>Final publication authorization waiting.</span><button class="btn btn-secondary">Preview</button></div>
                            </div>
                        </div>
                    </section>

                    <section class="journey-grid three-col">
                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Publication Settings</span>
                            <h2>Public Tender</h2>
                            <p>Approved suppliers can discover this tender in the active marketplace list after publication.</p>
                            <button class="btn btn-secondary" data-navigate="tender-details">Buyer View</button>
                        </div>

                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Pre-Publication Review</span>
                            <h2>Risk Check</h2>
                            <div class="risk-list">
                                <div class="risk-item success"><strong>Budget linked</strong><span>Funds reserved.</span></div>
                                <div class="risk-item warning"><strong>Unsigned attachment</strong><span>Draft contract needs sign-off.</span></div>
                            </div>
                        </div>

                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Publication</span>
                            <h2>Approve and Go Active</h2>
                            <p>Publishing moves the tender to the active list and opens clarifications management.</p>
                            <button class="btn btn-primary" data-navigate="tender-details">Approve and Publish Tender</button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `;
}

if (window.app) {
    window.app.renderTenderPublication = renderTenderPublication;
}
