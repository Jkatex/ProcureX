// Dashboard Page Component

function renderBuyerDashboard() {
    const kpis = mockData.kpis.buyer;
    const tenders = mockData.tenders.slice(0, 3); // Recent tenders
    const savedTenderDraft = typeof getCreateTenderSavedDraft === 'function' ? getCreateTenderSavedDraft() : null;
    const draftTenderCount = kpis.draftTenders + (savedTenderDraft ? 1 : 0);

    return `
        <div class="main-layout">
            <!-- Sidebar -->
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>ProcureX Buyer</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${mockData.users.buyer.organization}</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="workspace-dashboard" class="active">Dashboard</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="create-tender">New Tender</a></li>
                    <li><a href="#" data-navigate="bid-evaluation">Evaluation</a></li>
                    <li><a href="#" data-navigate="contract-negotiation">Contracts</a></li>
                    <li><a href="#" data-navigate="post-award-tracking">Post-Award</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <!-- Main Content -->
            <div class="main-content">
                <div class="header">
                    <h1>Dashboard</h1>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <span>Welcome, ${mockData.users.buyer.name}</span>
                        <button class="btn btn-secondary" data-navigate="procurement-guide">Open Journey</button>
                        <button class="btn btn-primary" data-navigate="create-tender">Create Tender</button>
                    </div>
                </div>

                <!-- KPI Row -->
                <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 24px;">
                    <div class="kpi-card">
                        <div class="kpi-value">${kpis.activeTenders}</div>
                        <div class="kpi-label">ACTIVE TENDERS</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${draftTenderCount}</div>
                        <div class="kpi-label">DRAFT TENDERS</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${kpis.approvalsNeeded}</div>
                        <div class="kpi-label">APPROVALS NEEDED</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${(kpis.totalSpend / 1000000).toFixed(0)}M</div>
                        <div class="kpi-label">TOTAL SPEND</div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <!-- Main Content -->
                    <div class="dashboard-main">
                        <!-- Monthly Spend Chart -->
                        <div class="chart-container">
                            <h3 style="margin-bottom: 16px;">Monthly Procurement Spend</h3>
                            <div class="chart-canvas-frame">
                                <canvas id="buyer-spend-chart"></canvas>
                            </div>
                        </div>

                        <!-- Recent Tenders -->
                        <div class="card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h3>Recent Tenders</h3>
                                <button class="btn btn-secondary" style="font-size: 12px;" data-navigate="marketplace">View All</button>
                            </div>
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Tender ID</th>
                                            <th>Title</th>
                                            <th>Status</th>
                                            <th>Closing Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tenders.map(tender => `
                                            <tr>
                                                <td>${tender.id}</td>
                                                <td>${tender.title}</td>
                                                <td><span class="badge badge-${tender.status === 'Open' ? 'success' : tender.status === 'Evaluation' ? 'warning' : 'info'}">${tender.status}</span></td>
                                                <td>${tender.closingDate}</td>
                                                <td>
                                                    <button class="btn btn-primary" style="font-size: 12px; padding: 4px 8px;" data-navigate="tender-details">View</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar -->
                    <div class="dashboard-sidebar">
                        <!-- Quick Actions -->
                        <div style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 12px;">Quick Actions</h4>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${savedTenderDraft ? `<button class="btn btn-secondary" data-navigate="create-tender">${savedTenderDraft.title || 'Untitled tender'} - saved as draft</button>` : ''}
                                <button class="btn btn-secondary" data-navigate="procurement-guide">Continue Procurement Process Guide</button>
                                <button class="btn btn-primary" data-navigate="create-tender">Create New Tender</button>
                                <button class="btn btn-secondary" data-navigate="communication-center">Clarifications Inbox</button>
                                <button class="btn btn-secondary" data-navigate="award-recommendation">Award Approval</button>
                            </div>
                        </div>

                        <!-- Risk and Compliance -->
                        <div style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 12px;">Risk and Compliance</h4>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <span style="font-size: 14px;">Performance Rating</span>
                                <span class="badge badge-success">${mockData.users.buyer.riskScore}/100</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 14px;">Compliance</span>
                                <span class="badge badge-success">Verified</span>
                            </div>
                        </div>

                        <!-- Recent Notifications -->
                        <div>
                            <h4 style="margin-bottom: 12px;">Recent Notifications</h4>
                            <div style="space-y: 8px;">
                                <div style="padding: 8px; background: var(--background); border-radius: 4px; font-size: 12px;">
                                    Tender T001 evaluation completed
                                </div>
                                <div style="padding: 8px; background: var(--background); border-radius: 4px; font-size: 12px;">
                                    New supplier verification request
                                </div>
                                <div style="padding: 8px; background: var(--background); border-radius: 4px; font-size: 12px;">
                                    Contract PX-2026-0892 signed
                                </div>
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
    window.app.renderBuyerDashboard = renderBuyerDashboard;
}
