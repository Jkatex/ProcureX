// Contract Negotiation Page Component

const contractNegotiationClauseCatalog = {
    goods: {
        label: 'Goods',
        clauses: [
            ['Delivery Clause', 'Delivery location, delivery timeline, and partial vs full delivery.'],
            ['Payment Terms', 'Payment after delivery or inspection, invoice requirements, and payment timeline.'],
            ['Inspection and Acceptance Clause', 'Inspection process, rejection conditions, and replacement rules.'],
            ['Warranty Clause', 'Warranty period, repair or replacement obligations, and defect handling.'],
            ['Penalty for Delay', 'Liquidated damages per day or week and maximum penalty cap.'],
            ['Risk and Ownership Transfer', 'When risk passes to the buyer, usually upon delivery or acceptance.'],
            ['Packaging and Transport Clause', 'Packaging standards and transport responsibility, including Incoterms where applicable.'],
            ['Termination Clause', 'Breach conditions and cancellation rights.']
        ]
    },
    works: {
        label: 'Works',
        clauses: [
            ['Scope of Works Clause', 'Project scope, drawings or specifications reference, and bill of quantities.'],
            ['Contract Price and Payment Schedule', 'Milestone-based payments, interim certificates, and retention money.'],
            ['Time for Completion Clause', 'Project duration, start date, and completion deadline.'],
            ['Liquidated Damages Clause', 'Penalty per delay day or week and maximum cap, often 10% of contract value.'],
            ['Defects Liability Clause', 'Post-completion defect period and contractor responsibility for repairs.'],
            ['Variation Clause', 'How changes to works are approved and how price adjustments are handled.'],
            ['Site and Access Clause', 'Site handover rules, access rights, and utility responsibilities.'],
            ['Health, Safety and Environment Clause', 'Safety compliance, environmental protection, and worker safety obligations.'],
            ['Performance Security Clause', 'Bank guarantee requirement and percentage such as 5-10%.']
        ]
    },
    services: {
        label: 'Services',
        clauses: [
            ['Service Scope Clause', 'Detailed service description and service boundaries.'],
            ['Service Level Agreement (SLA)', 'Performance standards, uptime or response time, and service quality metrics.'],
            ['KPI and Performance Monitoring Clause', 'KPIs, measurement method, and reporting mechanism.'],
            ['Payment Terms Clause', 'Monthly or periodic payments and deductions for poor performance.'],
            ['Penalty Clause', 'SLA breach penalties, service credit deductions, and escalation rules.'],
            ['Staffing and Personnel Clause', 'Required staff, qualifications, and replacement rules.'],
            ['Equipment and Resources Clause', 'Tools or equipment required and ownership responsibilities.'],
            ['Reporting Requirements Clause', 'Reporting frequency, format, and submission channels.'],
            ['Termination Clause', 'Poor performance termination, notice period, and breach triggers.'],
            ['Renewal Clause', 'Extension conditions and performance-based renewal.'],
            ['Confidentiality Clause', 'Data protection and non-disclosure obligations.']
        ]
    },
    consultancy: {
        label: 'Consultancy',
        clauses: [
            ['Scope of Services Clause', 'Deliverables such as reports, studies, designs, and methodology boundaries.'],
            ['Deliverables and Milestones Clause', 'Outputs required, submission timeline, and approval process.'],
            ['Payment Terms Clause', 'Milestone-based and acceptance-linked payments.'],
            ['Personnel Clause', 'Key experts, CV approval requirement, and substitution restrictions.'],
            ['Performance and Evaluation Clause', 'Quality evaluation of deliverables and acceptance criteria.'],
            ['Intellectual Property Clause', 'Ownership of reports or data and usage rights.'],
            ['Confidentiality Clause', 'Data protection and non-disclosure obligations.'],
            ['Time Schedule Clause', 'Assignment duration and submission deadlines.'],
            ['Termination Clause', 'Termination for unsatisfactory performance and withdrawal rules.'],
            ['Conflict of Interest Clause', 'Disclosure obligations and restrictions on bias.']
        ]
    }
};

const contractNegotiationEthicalClauses = [
    ['Conflict of Interest Clause', 'Disclosure duties, conflict restrictions, and remediation steps.'],
    ['Confidentiality Clause', 'Non-disclosure duties for procurement, technical, commercial, and personal data.'],
    ['Anti-Corruption Clause', 'Prohibits bribery, collusion, coercion, and fraudulent conduct during execution.'],
    ['Data Protection Clause', 'Data handling, access control, retention, and incident reporting obligations.']
];

const contractNegotiationConsultancyGovernanceClauses = [
    ['Knowledge Transfer Clause', 'Training, mentorship, manuals, and handover documentation obligations.'],
    ['Intellectual Property Clause', 'Ownership and permitted use of reports, data, designs, methods, and deliverables.'],
    ['Data Ownership Clause', 'Client data usage limits, return obligations, and confidential data handling.']
];

function escapeContractNegotiationHtml(value = '') {
    return String(value)
        .replace(/and/g, 'andamp;')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function getContractNegotiationTender() {
    if (typeof getProcurexSelectedTender === 'function') {
        return getProcurexSelectedTender();
    }
    return mockData.tenders?.[0] || {};
}

function getContractNegotiationTypeId(tender = {}) {
    const raw = String(tender.procurementTypeId || tender.type || tender.label || 'works').toLowerCase();
    if (raw.includes('good')) return 'goods';
    if (raw.includes('consult')) return 'consultancy';
    if (raw.includes('service')) return 'services';
    return 'works';
}

function renderContractNegotiationClauseCards(typeId, activeTypeId) {
    const category = contractNegotiationClauseCatalog[typeId];
    if (!category) return '';
    const isActive = typeId === activeTypeId;

    return `
        <section class="contract-clause-category ${isActive ? 'active' : ''}">
            <div class="contract-clause-category-heading">
                <div>
                    <span class="section-kicker">${isActive ? 'Selected tender category' : 'Contract template'}</span>
                    <h4>${escapeContractNegotiationHtml(category.label)} clauses</h4>
                </div>
                <span class="badge ${isActive ? 'badge-success' : 'badge-info'}">${category.clauses.length} clauses</span>
            </div>
            <div class="contract-clause-grid">
                ${category.clauses.map(([title, detail]) => `
                    <article class="contract-clause-card">
                        <strong>${escapeContractNegotiationHtml(title)}</strong>
                        <span>${escapeContractNegotiationHtml(detail)}</span>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function renderContractNegotiationClauseGroup(title, kicker, clauses = [], badgeText = '') {
    return `
        <section class="contract-clause-category active">
            <div class="contract-clause-category-heading">
                <div>
                    <span class="section-kicker">${escapeContractNegotiationHtml(kicker)}</span>
                    <h4>${escapeContractNegotiationHtml(title)}</h4>
                </div>
                <span class="badge badge-success">${escapeContractNegotiationHtml(badgeText || `${clauses.length} clauses`)}</span>
            </div>
            <div class="contract-clause-grid">
                ${clauses.map(([clauseTitle, detail]) => `
                    <article class="contract-clause-card">
                        <strong>${escapeContractNegotiationHtml(clauseTitle)}</strong>
                        <span>${escapeContractNegotiationHtml(detail)}</span>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function renderContractNegotiationClauseLibrary(tender = {}) {
    const activeTypeId = getContractNegotiationTypeId(tender);
    const orderedTypeIds = [
        activeTypeId,
        ...Object.keys(contractNegotiationClauseCatalog).filter(typeId => typeId !== activeTypeId)
    ];

    return `
        <div class="card contract-clause-library" style="margin-bottom: 32px;">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Contract management</span>
                    <h3>Category Contract Clauses</h3>
                </div>
                <span class="badge badge-info">${escapeContractNegotiationHtml(tender.title || 'Contract template')}</span>
            </div>
            <p class="contract-clause-note">Clause templates are managed after award as part of contract finalization, separate from supplier tender requirements.</p>
            <div class="contract-clause-library-stack">
                ${renderContractNegotiationClauseGroup('Ethical Contract Clauses', 'All procurement types', contractNegotiationEthicalClauses)}
                ${activeTypeId === 'consultancy'
                    ? renderContractNegotiationClauseGroup('Consultancy Knowledge, IP and Data Clauses', 'Consultancy contract controls', contractNegotiationConsultancyGovernanceClauses)
                    : ''}
                ${orderedTypeIds.map(typeId => renderContractNegotiationClauseCards(typeId, activeTypeId)).join('')}
            </div>
        </div>
    `;
}

function renderContractNegotiation() {
    const negotiation = mockData.contractNegotiation;
    const tender = getContractNegotiationTender();

    return `
        <div class="negotiation-layout">
            <!-- Main Content -->
            <div class="contract-content">
                <div style="margin-bottom: 24px;">
                    <h1 style="margin-bottom: 8px;">Contract Negotiation</h1>
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                        <span class="badge badge-info">Draft Version 2.1</span>
                        <span style="font-size: 14px; color: var(--text-secondary);">Contract #${negotiation.contractId}</span>
                    </div>

                    <!-- Status Indicators -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
                        <div style="text-align: center; padding: 16px; background: var(--success-green); color: white; border-radius: 8px;">
                            <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">OK</div>
                            <div style="font-size: 14px;">PO Matched</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: var(--success-green); color: white; border-radius: 8px;">
                            <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">OK</div>
                            <div style="font-size: 14px;">Budget Verified</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: var(--warning-amber); color: white; border-radius: 8px;">
                            <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">⏳</div>
                            <div style="font-size: 14px;">Signature Pending</div>
                        </div>
                    </div>
                </div>

                <!-- Contract Title -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <h2>Contract Finalization</h2>
                    <p style="color: var(--text-secondary);">Formal Agreement for Construction of Rural Health Centers</p>
                </div>

                <!-- Contract Body -->
                <div class="card" style="margin-bottom: 32px;">
                    <h3 style="margin-bottom: 20px;">Formal Contract Agreement</h3>

                    <!-- Section 1 -->
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 12px;">1. Parties to the Agreement</h4>
                        <div style="background: var(--background); padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                            <strong>Employer:</strong> Ministry of Health, United Republic of Tanzania<br>
                            <strong>Contractor:</strong> ABC Construction Ltd<br>
                            <strong>Contract Price:</strong> TZS 4,800,000,000 (Four Billion Eight Hundred Million Only)<br>
                            <strong>Contract Duration:</strong> 12 months from contract signing
                        </div>
                    </div>

                    <!-- Section 2 -->
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 12px;">2. Scope of Works</h4>
                        <div style="background: var(--background); padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                            The Contractor shall construct 5 rural health centers in Dodoma region including:
                            <ul style="margin-top: 8px; margin-left: 20px;">
                                <li>Site preparation and foundation works</li>
                                <li>Structural construction (walls, roof, floors)</li>
                                <li>Electrical and plumbing installations</li>
                                <li>Medical equipment installation</li>
                                <li>Finishing works and landscaping</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Section 3 -->
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 12px;">3. Payment Terms</h4>
                        <div style="background: var(--background); padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                            <div style="display: grid; grid-template-columns: 1fr auto; gap: 16px;">
                                <div>
                                    <strong>Milestone 1:</strong> Foundation completion (20%) - TZS 960,000,000<br>
                                    <strong>Milestone 2:</strong> Structural completion (30%) - TZS 1,440,000,000<br>
                                    <strong>Milestone 3:</strong> MEP completion (25%) - TZS 1,200,000,000<br>
                                    <strong>Milestone 4:</strong> Final completion (25%) - TZS 1,200,000,000
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: var(--success-green); font-weight: 600;">Agreed</div>
                                    <div style="color: var(--text-secondary); font-size: 12px;">Last updated: 2 hours ago</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                ${renderContractNegotiationClauseLibrary(tender)}

                <!-- Digital Signature Panel -->
                <div class="card">
                    <h3 style="margin-bottom: 20px;">Digital Signatures</h3>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        <!-- Buyer Signature -->
                        <div style="border: 2px solid var(--border); border-radius: 8px; padding: 20px; text-align: center;">
                            <h4 style="margin-bottom: 16px;">Procurement Officer</h4>
                            <div style="margin-bottom: 16px;">
                                <div style="width: 120px; height: 60px; border: 1px dashed var(--border); border-radius: 4px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                                    Signature Area
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Click to sign digitally</div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <input type="text" class="form-input" placeholder="Full Name" style="text-align: center;">
                            </div>
                            <div style="margin-bottom: 12px;">
                                <input type="text" class="form-input" placeholder="Position/Title" style="text-align: center;" value="Procurement Officer">
                            </div>
                            <button class="btn btn-primary">Apply Digital Signature</button>
                        </div>

                        <!-- Supplier Signature -->
                        <div style="border: 2px solid var(--border); border-radius: 8px; padding: 20px; text-align: center;">
                            <h4 style="margin-bottom: 16px;">Contractor Representative</h4>
                            <div style="margin-bottom: 16px;">
                                <div style="width: 120px; height: 60px; border: 1px dashed var(--border); border-radius: 4px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                                    Signature Area
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Click to sign digitally</div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <input type="text" class="form-input" placeholder="Full Name" style="text-align: center;">
                            </div>
                            <div style="margin-bottom: 12px;">
                                <input type="text" class="form-input" placeholder="Position/Title" style="text-align: center;" value="Managing Director">
                            </div>
                            <button class="btn btn-secondary" disabled>Waiting for Buyer</button>
                        </div>
                    </div>

                    <div style="margin-top: 24px; padding: 16px; background: var(--primary-blue-light); border-radius: 6px;">
                        <p style="font-size: 14px; color: var(--primary-blue); margin: 0;">
                            <strong>Digital signature audit:</strong> This agreement records signer identity, document hash, timestamp, and certificate metadata once both parties sign.
                            After signatures are complete, the contract moves to post-award milestone tracking.
                        </p>
                    </div>
                    <div class="inline-actions" style="margin-top: 20px;">
                        <button class="btn btn-secondary" data-navigate="award-recommendation">Back to Award</button>
                        <button class="btn btn-primary" data-navigate="post-award-tracking">Activate Contract Tracking</button>
                    </div>
                </div>
            </div>

            <!-- Chat Sidebar -->
            <div class="chat-sidebar">
                <h4 style="margin-bottom: 16px;">Negotiation Chat</h4>

                <!-- Messages -->
                <div class="chat-messages">
                    ${negotiation.messages.map(msg => `
                        <div style="margin-bottom: 16px; padding: 12px; background: ${msg.from === 'buyer' ? 'var(--primary-blue-light)' : 'var(--background)'}; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-weight: 500; font-size: 12px;">${msg.from === 'buyer' ? 'Procurement Officer' : 'ABC Construction'}</span>
                                <span style="font-size: 10px; color: var(--text-secondary);">${msg.timestamp}</span>
                            </div>
                            <p style="font-size: 14px; margin: 0;">${msg.message}</p>
                        </div>
                    `).join('')}
                </div>

                <!-- Input -->
                <div class="chat-input">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" placeholder="Type your message..." style="flex: 1; border: 1px solid var(--border); border-radius: 4px; padding: 8px;">
                        <button class="btn btn-primary" style="padding: 8px 16px;">Send</button>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <h5 style="margin-bottom: 8px; font-size: 14px;">Quick Actions</h5>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">Request Clarification</button>
                        <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">Counter Proposal</button>
                        <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">Accept Terms</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Register the page render function
if (window.app) {
    window.app.renderContractNegotiation = renderContractNegotiation;
}
