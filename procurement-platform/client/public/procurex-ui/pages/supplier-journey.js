// Procurement Process Guide Page Component

function renderSupplierJourney() {
    const stages = [
        ['Onboarding', 'Verification approved', 'Register as account, verify OTP, upload KYC/KYB, receive approval, then log in.', 'verification-status', 'Done'],
        ['Tender Search', 'Tender selected', 'Open dashboard, browse marketplace, view tender detail.', 'marketplace', 'Active'],
        ['Clarifications', 'Questions managed', 'Watchlist the tender, ask clarifications, and review buyer answers or amendments.', 'tender-detail', 'Open'],
        ['Bid Submission', 'Sealed bid submitted', 'Choose bid type, complete technical and financial responses, upload documents and samples, validate, review, and submit.', 'bidding-workspace', 'Draft'],
        ['Receipt and My Bids', 'Hash receipt stored', 'View bid receipt, sealed hash, submitted status, and withdraw or resubmit before deadline.', 'bidding-workspace', 'Submitted'],
        ['Award Outcome', 'Results reviewed', 'Open award notifications center, view score breakdown, exit if lost or continue if won.', 'procurement-guide', 'Won'],
        ['Contracting', 'Contract signed', 'Review draft contract, negotiate changes, and digitally sign.', 'contract-negotiation', 'Pending'],
        ['Execution', 'Delivery accepted', 'Submit delivery evidence, buyer accepts and issues GRN.', 'post-award-tracking', '65%'],
        ['Invoice and Payment', 'Payment received', 'Submit invoice, track status, and confirm payment received.', 'post-award-tracking', 'Pending'],
        ['Closure', 'Performance dashboard', 'Review tenderer performance, scorecard, and contract history.', 'post-award-tracking', 'Final']
    ];

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Procurement Process Guide</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Tender to payment</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="procurement-dashboard">Procurement Dashboard</a></li>
                    <li><a href="#" data-navigate="procurement-guide" class="active">Journey</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="bidding-workspace">My Bids</a></li>
                    <li><a href="#" data-navigate="contract-negotiation">Contract</a></li>
                    <li><a href="#" data-navigate="post-award-tracking">Payment</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page">
                    <section class="journey-hero">
                        <div>
                            <span class="badge badge-info">Bidder process guide</span>
                            <h1>Procurement Process: Tender to Payment</h1>
                            <p>One place to understand and enter every bidder workflow: discovery, clarifications, sealed bid submission, award outcome, contracting, delivery, invoicing, payment, and performance closure.</p>
                        </div>
                        <div class="journey-scorecard">
                            <div><strong>10</strong><span>Bidder stages</span></div>
                            <div><strong>1</strong><span>Submitted bid</span></div>
                            <div><strong>87%</strong><span>Performance score</span></div>
                        </div>
                    </section>

                    <section class="journey-map">
                        ${stages.map((stage, index) => `
                            <article class="journey-stage ${index === 1 ? 'current' : index < 1 ? 'done' : ''}">
                                <div class="stage-index">${String(index + 1).padStart(2, '0')}</div>
                                <div>
                                    <div class="stage-title-row">
                                        <h2>${stage[0]}</h2>
                                        <span class="badge ${index < 1 ? 'badge-success' : index === 1 ? 'badge-warning' : 'badge-info'}">${stage[4]}</span>
                                    </div>
                                    <strong>${stage[1]}</strong>
                                    <p>${stage[2]}</p>
                                    <button class="btn btn-secondary" data-navigate="${stage[3]}">Open</button>
                                </div>
                            </article>
                        `).join('')}
                    </section>

                    <section class="journey-grid three-col">
                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Award notifications</span>
                            <h2>Outcome Center</h2>
                            <div class="record-summary compact">
                                <div><span>Result</span><strong>Won, intent to award issued</strong></div>
                                <div><span>Total score</span><strong>87.5 / 100</strong></div>
                            </div>
                            <button class="btn btn-primary" data-navigate="contract-negotiation">Continue to Contract</button>
                        </div>

                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Invoice status</span>
                            <h2>Payment Tracker</h2>
                            <div class="execution-lane">
                                <div><strong>Delivery submission</strong><span>Submitted for Milestone 2</span></div>
                                <div><strong>GRN</strong><span>Procuring entity acceptance pending</span></div>
                                <div><strong>Invoice</strong><span>Draft ready after GRN</span></div>
                                <div><strong>Payment</strong><span>Awaiting finance release</span></div>
                            </div>
                            <button class="btn btn-secondary" data-navigate="post-award-tracking">Track Payment</button>
                        </div>

                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Closure</span>
                            <h2>Performance Dashboard</h2>
                            <div class="progress-stack">
                                <div><span>Delivery</span><strong>85%</strong></div>
                                <div class="progress-bar"><div class="progress-fill" style="width: 85%"></div></div>
                                <div><span>Quality</span><strong>90%</strong></div>
                                <div class="progress-bar"><div class="progress-fill" style="width: 90%"></div></div>
                            </div>
                            <button class="btn btn-secondary" data-navigate="post-award-tracking">View Performance</button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `;
}

if (window.app) {
    window.app.renderSupplierJourney = renderSupplierJourney;
}
