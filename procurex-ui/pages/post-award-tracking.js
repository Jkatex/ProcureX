// Post-Award Tracking Page Component

function renderPostAwardTracking() {
    const tracking = mockData.postAwardTracking;

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Post-Award Tracking</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Contract #${tracking.contractId}</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="contract-negotiation">Back to Negotiation</a></li>
                    <li><a href="#" data-navigate="procurement-dashboard">Procurement Dashboard</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="tracking-content">
                    <div class="tracking-main">
                        <div class="tracking-header">
                            <div class="panel-heading">
                                <div>
                                    <span class="badge badge-info">${tracking.status.replace('_', ' ')}</span>
                                    <h1>Contract #${tracking.contractId}</h1>
                                    <p style="color: var(--text-secondary); margin-top: 4px;">Construction of Rural Health Centers - ABC Construction Ltd</p>
                                </div>
                                <button class="btn btn-secondary">Export Audit Pack</button>
                            </div>

                            <div class="card">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Contract Performance History</span>
                                        <h3>Delivery Fulfillment Progress</h3>
                                    </div>
                                    <span class="badge badge-success">${tracking.progress}% complete</span>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                        <span>Overall Progress</span>
                                        <span style="font-weight: 600;">${tracking.progress}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${tracking.progress}%"></div>
                                    </div>
                                </div>
                                <div class="status-pipeline horizontal">
                                    <div class="done"><strong>Award</strong><span>July 01, 2026</span></div>
                                    <div class="done"><strong>Dispatch</strong><span>July 20, 2026</span></div>
                                    <div class="current"><strong>Delivery</strong><span>August 20, 2026</span></div>
                                    <div><strong>Closure</strong><span>September 30, 2026</span></div>
                                </div>
                            </div>
                        </div>

                        <div class="tabs">
                            <div class="tab active" data-tab="grn">GRN and Acceptance</div>
                            <div class="tab" data-tab="billing">Invoices and Matching</div>
                            <div class="tab" data-tab="disputes">Disputes and Evidence</div>
                        </div>

                        <div class="tab-content" data-tab="grn" style="display: block;">
                            <div class="card">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Delivery and Invoice Verification</span>
                                        <h3>Goods Receipt Notes and Acceptance</h3>
                                    </div>
                                    <span class="badge badge-warning">1 review pending</span>
                                </div>
                                <div class="data-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Milestone</th>
                                                <th>Description</th>
                                                <th>Scheduled Date</th>
                                                <th>Actual Date</th>
                                                <th>Status</th>
                                                <th>GRN #</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Milestone 1</td>
                                                <td>Foundation and structural completion</td>
                                                <td>July 20, 2026</td>
                                                <td>July 18, 2026</td>
                                                <td><span class="badge badge-success">Accepted</span></td>
                                                <td>GRN-2026-001</td>
                                                <td><button class="btn btn-secondary">View</button></td>
                                            </tr>
                                            <tr>
                                                <td>Milestone 2</td>
                                                <td>MEP installations</td>
                                                <td>August 20, 2026</td>
                                                <td>August 23, 2026</td>
                                                <td><span class="badge badge-warning">Under Review</span></td>
                                                <td>GRN-2026-002</td>
                                                <td><button class="btn btn-secondary">Review</button></td>
                                            </tr>
                                            <tr>
                                                <td>Milestone 3</td>
                                                <td>Finishing works and handover</td>
                                                <td>September 30, 2026</td>
                                                <td>-</td>
                                                <td><span class="badge badge-info">Pending</span></td>
                                                <td>-</td>
                                                <td><button class="btn btn-secondary">Schedule</button></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" data-tab="billing" style="display: none;">
                            <div class="journey-grid two-col">
                                <div class="journey-panel">
                                    <div class="panel-heading">
                                        <div>
                                            <span class="section-kicker">Three-Way Invoice Matching</span>
                                            <h2>Three-Way Matching</h2>
                                        </div>
                                        <span class="badge badge-warning">Finance review</span>
                                    </div>
                                    <div class="data-table">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Invoice</th>
                                                    <th>Milestone</th>
                                                    <th>Amount</th>
                                                    <th>PO</th>
                                                    <th>GRN</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>INV-2026-001</td>
                                                    <td>Milestone 1</td>
                                                    <td>TZS 960,000,000</td>
                                                    <td>PO-0892</td>
                                                    <td>GRN-2026-001</td>
                                                    <td><span class="badge badge-success">Paid</span></td>
                                                </tr>
                                                <tr>
                                                    <td>INV-2026-002</td>
                                                    <td>Milestone 2</td>
                                                    <td>TZS 1,440,000,000</td>
                                                    <td>PO-0892</td>
                                                    <td>GRN-2026-002</td>
                                                    <td><span class="badge badge-warning">Pending approval</span></td>
                                                </tr>
                                                <tr>
                                                    <td>INV-2026-003</td>
                                                    <td>Milestone 3</td>
                                                    <td>TZS 1,200,000,000</td>
                                                    <td>PO-0892</td>
                                                    <td>-</td>
                                                    <td><span class="badge badge-error">Blocked</span></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="journey-panel">
                                    <div class="panel-heading">
                                        <div>
                                            <span class="section-kicker">Duplicate and fraud controls</span>
                                            <h2>Validation Results</h2>
                                        </div>
                                        <span class="badge badge-info">${tracking.invoiceChecks.length} checks</span>
                                    </div>
                                    <div class="risk-list">
                                        ${tracking.invoiceChecks.map(check => `
                                            <div class="risk-item ${check.result === 'Matched' ? 'success' : 'warning'}">
                                                <strong>${check.invoice}: ${check.result}</strong>
                                                <span>${check.detail}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div class="inline-actions" style="margin-top: 16px;">
                                        <button class="btn btn-primary">Approve Payment</button>
                                        <button class="btn btn-secondary">Return to Tenderer</button>
                                        <button class="btn btn-secondary">Escalate</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" data-tab="disputes" style="display: none;">
                            <div class="journey-grid two-col">
                                <div class="journey-panel">
                                    <div class="panel-heading">
                                        <div>
                                            <span class="section-kicker">Exception Management</span>
                                            <h2>Dispute Case File</h2>
                                        </div>
                                        <span class="badge badge-warning">${tracking.disputes.length} case</span>
                                    </div>
                                    <div class="inbox-list">
                                        ${tracking.disputes.map(dispute => `
                                            <div class="inbox-item">
                                                <strong>${dispute.id}: ${dispute.title}</strong>
                                                <span>Status: ${dispute.status}. ${dispute.responseDue}</span>
                                                <span class="badge badge-${dispute.priority === 'high' ? 'error' : 'warning'}">${dispute.priority}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <button class="btn btn-secondary" style="margin-top: 16px;">Raise Dispute</button>
                                </div>
                                <div class="journey-panel">
                                    <span class="section-kicker">Evidence and outcome</span>
                                    <h2>Mediator View</h2>
                                    ${tracking.disputes.map(dispute => `
                                        <div class="record-summary">
                                            <div><span>Evidence</span><strong>${dispute.evidence.join(', ')}</strong></div>
                                            <div><span>Outcome</span><strong>${dispute.outcome}</strong></div>
                                            <div><span>Performance impact</span><strong>Contract performance record updated</strong></div>
                                        </div>
                                    `).join('')}
                                    <div class="inline-actions">
                                        <button class="btn btn-primary">Record Resolution</button>
                                        <button class="btn btn-secondary">Assign Mediator</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tracking-sidebar">
                        <div class="card" style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 16px;">Tenderer Performance</h4>
                            ${[
                                ['Delivery', tracking.supplierPerformance.delivery],
                                ['Quality', tracking.supplierPerformance.quality],
                                ['Communication', tracking.supplierPerformance.communication]
                            ].map(item => `
                                <div style="margin-bottom: 14px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                        <span style="font-size: 14px;">${item[0]}</span>
                                        <span style="font-size: 14px; font-weight: 600;">${item[1]}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${item[1]}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                            <div style="text-align: center; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border-soft);">
                                <div style="font-size: 24px; font-weight: 600; color: var(--primary-blue);">${tracking.supplierPerformance.overall}%</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Overall Rating</div>
                            </div>
                        </div>

                        <div class="card" style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 16px;">Tenderer Performance Card</h4>
                            <div class="record-summary compact">
                                <div><span>Performance Rating</span><strong>${tracking.supplierHealth.trustScore}/100</strong></div>
                                <div><span>Risk Level</span><strong>${tracking.supplierHealth.riskLevel}</strong></div>
                                <div><span>Last Audit</span><strong>${tracking.supplierHealth.lastAudit}</strong></div>
                            </div>
                        </div>

                        <div class="card">
                            <h4 style="margin-bottom: 16px;">Contract History</h4>
                            <div class="execution-lane">
                                <div><strong>July 01, 2026</strong><span>Contract signed</span></div>
                                <div><strong>July 18, 2026</strong><span>Milestone 1 accepted</span></div>
                                <div><strong>July 25, 2026</strong><span>Payment released</span></div>
                                <div><strong>August 22, 2026</strong><span>Dispute resolved and recorded</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Register the page render function
if (window.app) {
    window.app.renderPostAwardTracking = renderPostAwardTracking;
}
