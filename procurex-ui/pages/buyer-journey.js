// Procurement Process Guide Page Component

function renderBuyerJourney() {
    const journeyStages = [
        ['Onboarding', 'Approved procurement account', 'Register, verify OTP, sign in, upload verification documents, receive approval.', 'verification-status', 'Approved'],
        ['Tender Design', 'Tender ready to publish', 'Create the tender, scope, attachments, BOQ, evaluation criteria, timeline, and procuring entity review.', 'create-tender', 'In progress'],
        ['Publication', 'Active tender detail', 'Reviewed tender goes live in the marketplace with procuring entity detail controls.', 'marketplace', 'Next'],
        ['Clarifications', 'Tenderer QandA handled', 'Review inbox, answer questions, create amendments, and update tender documents.', 'tender-details', '3 open'],
        ['Evaluation', 'Oversight dashboard', 'Monitor evaluator progress, score variance, conflicts, and bid ranking intelligence.', 'bid-evaluation', '72%'],
        ['Award Approval', 'Approved recommendation', 'Submit award recommendation, route approvals, and notify successful bidder.', 'award-recommendation', 'Pending'],
        ['Standstill', 'No unresolved challenge', 'Run standstill period, review challenges, resolve outcomes, and continue contracting.', 'award-recommendation', '14 days'],
        ['Contracting', 'Active signed contract', 'Draft contract, negotiate changes, digitally sign, and activate contract summary.', 'contract-negotiation', 'Draft'],
        ['Execution', 'Accepted delivery and matched invoice', 'Track milestones, accept delivery, perform 3-way match, and release payments.', 'post-award-tracking', '65%'],
        ['Closure', 'Contract closed', 'Complete performance review, archive evidence, and close the procurement record.', 'post-award-tracking', 'Final']
    ];

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Procurement Process Guide</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Start to contract completion</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="procurement-dashboard">Procurement Dashboard</a></li>
                    <li><a href="#" data-navigate="procurement-guide" class="active">Journey</a></li>
                    <li><a href="#" data-navigate="create-tender">Create Tender</a></li>
                    <li><a href="#" data-navigate="bid-evaluation">Evaluation</a></li>
                    <li><a href="#" data-navigate="contract-negotiation">Contract</a></li>
                    <li><a href="#" data-navigate="post-award-tracking">Execution</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page">
                    <section class="journey-hero">
                        <div>
                            <span class="badge badge-info">Procurement process guide</span>
                            <h1>Procurement Process: Start to Contract Completion</h1>
                            <p>A single operational workspace for the procurement officer to move from onboarding through tender design, publication, evaluation, award, contracting, execution, payment, and closure.</p>
                        </div>
                        <div class="journey-scorecard">
                            <div><strong>11</strong><span>Journey stages</span></div>
                            <div><strong>6</strong><span>Approvals and controls</span></div>
                            <div><strong>1</strong><span>Active contract</span></div>
                        </div>
                    </section>

                    <section class="journey-map">
                        ${journeyStages.map((stage, index) => `
                            <article class="journey-stage ${index < 1 ? 'done' : index === 1 ? 'current' : ''}">
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

                    <section class="journey-grid two-col">
                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Tender workbench</span>
                                    <h2>Current Tender Draft</h2>
                                </div>
                                <span class="badge badge-warning">Draft</span>
                            </div>
                            <div class="record-summary">
                                <div><span>Tender</span><strong>Construction of Rural Health Centers</strong></div>
                                <div><span>Procurement type</span><strong>Works / Healthcare infrastructure</strong></div>
                                <div><span>Publication path</span><strong>Submit and publish to marketplace</strong></div>
                                <div><span>Procuring entity review</span><strong>Ready before publication</strong></div>
                            </div>
                            <div class="inline-actions">
                                <button class="btn btn-primary" data-navigate="create-tender">Continue Wizard</button>
                                <button class="btn btn-secondary" data-navigate="marketplace">Open Marketplace</button>
                            </div>
                        </div>

                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Marketplace interaction</span>
                                    <h2>Clarifications and Amendments</h2>
                                </div>
                                <span class="badge badge-warning">3 open</span>
                            </div>
                            <div class="inbox-list">
                                <div class="inbox-item"><strong>Scope boundary question</strong><span>Tenderer asks whether solar backup is included.</span><button class="btn btn-secondary">Answer</button></div>
                                <div class="inbox-item"><strong>Site visit logistics</strong><span>Request for coordinated visit windows.</span><button class="btn btn-secondary">Answer</button></div>
                                <div class="inbox-item"><strong>BOQ unit mismatch</strong><span>Potential amendment for item 3.1 unit label.</span><button class="btn btn-secondary">Amend</button></div>
                            </div>
                        </div>
                    </section>

                    <section class="journey-grid three-col">
                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Evaluation oversight</span>
                            <h2>Evaluator Progress</h2>
                            <div class="progress-stack">
                                <div><span>Technical</span><strong>82%</strong></div>
                                <div class="progress-bar"><div class="progress-fill" style="width: 82%"></div></div>
                                <div><span>Financial</span><strong>64%</strong></div>
                                <div class="progress-bar"><div class="progress-fill" style="width: 64%"></div></div>
                            </div>
                            <button class="btn btn-secondary" data-navigate="bid-evaluation">Monitor</button>
                        </div>

                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Award approval</span>
                            <h2>Approval Queue</h2>
                            <div class="record-summary compact">
                                <div><span>Recommended tenderer</span><strong>ABC Construction Ltd</strong></div>
                                <div><span>Approval status</span><strong>Department head pending</strong></div>
                            </div>
                            <button class="btn btn-primary" data-navigate="award-recommendation">Review</button>
                        </div>
                    </section>

                    <section class="journey-grid two-col">
                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Contracting</span>
                                    <h2>Draft, Negotiate, Sign</h2>
                                </div>
                                <span class="badge badge-info">Version 2.1</span>
                            </div>
                            <div class="contract-flow">
                                ${['Contract Draft', 'Change Requests', 'Digital Signing', 'Active Contract Summary'].map((item, index) => `
                                    <div class="${index < 2 ? 'done' : ''}">${item}</div>
                                `).join('')}
                            </div>
                            <button class="btn btn-primary" data-navigate="contract-negotiation">Open Contract</button>
                        </div>

                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Execution and closure</span>
                                    <h2>Milestones, GRN, Invoice, Payment</h2>
                                </div>
                                <span class="badge badge-warning">Invoice pending</span>
                            </div>
                            <div class="execution-lane">
                                <div><strong>Delivery submission</strong><span>Milestone 2 under review</span></div>
                                <div><strong>Delivery acceptance (GRN)</strong><span>GRN-2026-002 awaiting procuring entity acceptance</span></div>
                                <div><strong>Invoice review</strong><span>3-way match: PO, GRN, invoice</span></div>
                                <div><strong>Payment</strong><span>Finance release after match approval</span></div>
                                <div><strong>Performance review</strong><span>Complete scorecard before close</span></div>
                            </div>
                            <button class="btn btn-primary" data-navigate="post-award-tracking">Track Execution</button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `;
}

if (window.app) {
    window.app.renderBuyerJourney = renderBuyerJourney;
}
