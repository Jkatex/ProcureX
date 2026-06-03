const procurementPlanningStorageKey = 'procurex.procurementPlans.v1';

const procurementPlanningSeedRecords = [
    {
        id: 'app-2026-014',
        financialYear: '2026/2027',
        appCode: 'APP-2026-014',
        department: 'Health Services',
        itemDescription: 'Supply and installation of hospital theatre equipment',
        procurementCategory: 'Goods',
        tenderNumber: 'PX-GDS-2026-014',
        lotNumber: 'LOT-01',
        procurementMethod: 'NCT',
        procurementCycle: 'First Cycle',
        estimatedBudget: 480000000,
        fundingSource: 'Development budget',
        budgetStatus: 'Confirmed',
        status: 'Ready for Tender',
        readiness: 92,
        owner: 'Amina Yusuf',
        priority: 'High',
        schedule: {
            tenderInvitation: '2026-08-01',
            tenderClosingOpening: '2026-08-30',
            noticeOfIntention: '2026-09-12',
            vettingRatification: '2026-09-20',
            notificationOfAward: '2026-09-25',
            contractSigning: '2026-10-04'
        },
        documents: [
            { type: 'APP Template', name: 'APP-2026-014 template.xlsx', status: 'Accepted' },
            { type: 'Needs Assessment', name: 'Health needs assessment.pdf', status: 'Accepted' },
            { type: 'Specifications / TOR', name: 'Theatre equipment TOR.docx', status: 'Review' },
            { type: 'Budget Confirmation', name: 'Finance confirmation.pdf', status: 'Accepted' },
            { type: 'Approval Memo', name: 'Approval memo.pdf', status: 'Accepted' }
        ],
        approvalSteps: [
            { role: 'Requester', actor: 'Amina Yusuf', status: 'Approved', date: '2026-06-12' },
            { role: 'Finance Review', actor: 'Fatma Mhando', status: 'Approved', date: '2026-06-17' },
            { role: 'Procurement Review', actor: 'Head of Procurement', status: 'Approved', date: '2026-06-20' },
            { role: 'Tender Board', actor: 'Board Secretary', status: 'Approved', date: '2026-06-25' }
        ],
        activityHistory: [
            'APP item created by Health Services',
            'Budget confirmed by Finance',
            'Procurement review completed',
            'Ready for tender creation'
        ]
    },
    {
        id: 'app-2026-021',
        financialYear: '2026/2027',
        appCode: 'APP-2026-021',
        department: 'Operations',
        itemDescription: 'Fleet maintenance framework agreement',
        procurementCategory: 'Services',
        tenderNumber: 'PX-SRV-2026-021',
        lotNumber: 'LOT-02',
        procurementMethod: 'Framework',
        procurementCycle: 'First Cycle',
        estimatedBudget: 125000000,
        fundingSource: 'Operational budget',
        budgetStatus: 'Shortfall',
        status: 'Returned',
        readiness: 54,
        owner: 'John Mrema',
        priority: 'Medium',
        schedule: {
            tenderInvitation: '2026-07-20',
            tenderClosingOpening: '2026-08-12',
            noticeOfIntention: '2026-08-25',
            vettingRatification: '2026-09-03',
            notificationOfAward: '2026-09-09',
            contractSigning: '2026-09-18'
        },
        documents: [
            { type: 'APP Template', name: 'Fleet APP worksheet.xlsx', status: 'Accepted' },
            { type: 'Needs Assessment', name: 'Fleet service need.pdf', status: 'Accepted' },
            { type: 'Budget Confirmation', name: 'Finance shortfall note.pdf', status: 'Returned' },
            { type: 'Market Survey', name: 'Garage supplier survey.xlsx', status: 'Pending' }
        ],
        approvalSteps: [
            { role: 'Requester', actor: 'John Mrema', status: 'Submitted', date: '2026-06-08' },
            { role: 'Finance Review', actor: 'Fatma Mhando', status: 'Returned', date: '2026-06-15' },
            { role: 'Procurement Review', actor: 'Head of Procurement', status: 'Waiting', date: '' },
            { role: 'Tender Board', actor: 'Board Secretary', status: 'Waiting', date: '' }
        ],
        activityHistory: [
            'Framework item captured',
            'Finance identified TZS 28M shortfall',
            'Returned for funding action'
        ]
    },
    {
        id: 'app-2026-027',
        financialYear: '2026/2027',
        appCode: 'APP-2026-027',
        department: 'Infrastructure',
        itemDescription: 'Ward renovation works',
        procurementCategory: 'Works',
        tenderNumber: 'PX-WRK-2026-027',
        lotNumber: 'LOT-01',
        procurementMethod: 'NCT',
        procurementCycle: 'Second Cycle',
        estimatedBudget: 760000000,
        fundingSource: 'Capital projects',
        budgetStatus: 'Confirmed',
        status: 'Procurement Review',
        readiness: 79,
        owner: 'Daniel Komba',
        priority: 'High',
        schedule: {
            tenderInvitation: '2026-09-04',
            tenderClosingOpening: '2026-10-03',
            noticeOfIntention: '2026-10-18',
            vettingRatification: '2026-10-30',
            notificationOfAward: '2026-11-05',
            contractSigning: '2026-11-14'
        },
        documents: [
            { type: 'APP Template', name: 'Infrastructure APP item.xlsx', status: 'Accepted' },
            { type: 'Specifications / TOR', name: 'Ward renovation BOQ.docx', status: 'Review' },
            { type: 'Budget Confirmation', name: 'Capital projects confirmation.pdf', status: 'Accepted' },
            { type: 'Board Minutes', name: 'Tender board extract.pdf', status: 'Missing' }
        ],
        approvalSteps: [
            { role: 'Requester', actor: 'Daniel Komba', status: 'Approved', date: '2026-06-21' },
            { role: 'Finance Review', actor: 'Fatma Mhando', status: 'Approved', date: '2026-06-24' },
            { role: 'Procurement Review', actor: 'Head of Procurement', status: 'Pending', date: '2026-06-27' },
            { role: 'Tender Board', actor: 'Board Secretary', status: 'Waiting', date: '' }
        ],
        activityHistory: [
            'Works package captured',
            'Budget confirmed',
            'Procurement review in progress'
        ]
    },
    {
        id: 'app-2026-032',
        financialYear: '2026/2027',
        appCode: 'APP-2026-032',
        department: 'ICT',
        itemDescription: 'ICT helpdesk support services',
        procurementCategory: 'Services',
        tenderNumber: 'PX-SRV-2026-032',
        lotNumber: 'LOT-01',
        procurementMethod: 'RFQ',
        procurementCycle: 'Second Cycle',
        estimatedBudget: 94000000,
        fundingSource: 'Operational budget',
        budgetStatus: 'Pending',
        status: 'Draft',
        readiness: 36,
        owner: 'Neema Paul',
        priority: 'Medium',
        schedule: {
            tenderInvitation: '2026-10-10',
            tenderClosingOpening: '2026-10-24',
            noticeOfIntention: '2026-11-02',
            vettingRatification: '2026-11-09',
            notificationOfAward: '2026-11-13',
            contractSigning: '2026-11-21'
        },
        documents: [
            { type: 'APP Template', name: 'ICT APP draft.xlsx', status: 'Draft' },
            { type: 'Needs Assessment', name: 'ICT support need.docx', status: 'Draft' },
            { type: 'Specifications / TOR', name: 'Helpdesk TOR.docx', status: 'Missing' }
        ],
        approvalSteps: [
            { role: 'Requester', actor: 'Neema Paul', status: 'Draft', date: '' },
            { role: 'Finance Review', actor: 'Finance Officer', status: 'Waiting', date: '' },
            { role: 'Procurement Review', actor: 'Head of Procurement', status: 'Waiting', date: '' },
            { role: 'Tender Board', actor: 'Board Secretary', status: 'Waiting', date: '' }
        ],
        activityHistory: [
            'Draft APP item started',
            'Needs assessment in progress'
        ]
    }
];

const procurementPlanningScheduleLabels = {
    tenderInvitation: 'Tender invitation',
    tenderClosingOpening: 'Tender closing/opening',
    noticeOfIntention: 'Notice of intention to award',
    vettingRatification: 'Vetting/ratification',
    notificationOfAward: 'Notification of award',
    contractSigning: 'Contract signing'
};

function escapeProcurementPlanningHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getProcurementPlanningRecords() {
    try {
        const parsed = JSON.parse(localStorage.getItem(procurementPlanningStorageKey) || 'null');
        return Array.isArray(parsed) && parsed.length ? parsed : procurementPlanningSeedRecords;
    } catch (error) {
        return procurementPlanningSeedRecords;
    }
}

function saveProcurementPlanningRecords(records) {
    try {
        localStorage.setItem(procurementPlanningStorageKey, JSON.stringify(records));
    } catch (error) {
        window.procurexProcurementPlanningRecords = records;
    }
}

function formatProcurementPlanningMoney(value) {
    const amount = Number(value || 0);
    if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(0)}M`;
    return `TZS ${amount.toLocaleString()}`;
}

function formatProcurementPlanningDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getProcurementPlanningBadgeClass(status = '') {
    const normalized = status.toLowerCase();
    if (normalized.includes('approved') || normalized.includes('accepted') || normalized.includes('ready') || normalized.includes('confirmed')) return 'badge-success';
    if (normalized.includes('returned') || normalized.includes('rejected') || normalized.includes('missing') || normalized.includes('shortfall')) return 'badge-error';
    if (normalized.includes('review') || normalized.includes('pending') || normalized.includes('submitted') || normalized.includes('waiting')) return 'badge-warning';
    return 'badge-info';
}

function getProcurementPlanningNextMilestone(record) {
    const milestone = Object.entries(record.schedule || {})
        .find(([, value]) => value && new Date(value) >= new Date('2026-06-03'));
    if (!milestone) return 'Schedule complete';
    return `${procurementPlanningScheduleLabels[milestone[0]]}: ${formatProcurementPlanningDate(milestone[1])}`;
}

function renderProcurementPlanningSummary(records) {
    const totalValue = records.reduce((sum, item) => sum + Number(item.estimatedBudget || 0), 0);
    const approved = records.filter(item => /approved|ready/i.test(item.status)).length;
    const pendingApprovals = records.filter(item => /review|submitted|pending/i.test(item.status)).length;
    const delayed = records.filter(item => /returned|rejected|shortfall/i.test(`${item.status} ${item.budgetStatus}`)).length;
    const documents = records.reduce((sum, item) => sum + (item.documents || []).length, 0);

    return [
        ['APP Items', records.length, 'Captured for active financial years', 'info'],
        ['Approved / Ready', approved, 'Can move toward tender creation', 'success'],
        ['Pending Approvals', pendingApprovals, 'Finance, procurement, or board action', 'warning'],
        ['Delayed', delayed, 'Returned items or funding blockers', 'warning'],
        ['Documents', documents, 'Evidence files linked to APP records', 'info'],
        ['Planned Value', formatProcurementPlanningMoney(totalValue), 'Total estimated procurement value', 'success']
    ].map(([label, value, note, tone]) => `
        <article class="planning-kpi-card ${tone}">
            <span>${escapeProcurementPlanningHtml(label)}</span>
            <strong>${escapeProcurementPlanningHtml(value)}</strong>
            <em>${escapeProcurementPlanningHtml(note)}</em>
        </article>
    `).join('');
}

function renderProcurementPlanningRow(record) {
    return `
        <tr>
            <td>
                <strong>${escapeProcurementPlanningHtml(record.itemDescription)}</strong>
                <span>${escapeProcurementPlanningHtml(record.appCode)} / ${escapeProcurementPlanningHtml(record.department)}</span>
            </td>
            <td>${escapeProcurementPlanningHtml(record.financialYear)}</td>
            <td>${escapeProcurementPlanningHtml(record.procurementCategory)}</td>
            <td>${escapeProcurementPlanningHtml(record.procurementMethod)}</td>
            <td>${escapeProcurementPlanningHtml(getProcurementPlanningNextMilestone(record))}</td>
            <td><span class="badge ${getProcurementPlanningBadgeClass(record.status)}">${escapeProcurementPlanningHtml(record.status)}</span></td>
            <td><span class="planning-readiness-pill">${Number(record.readiness || 0)}%</span></td>
            <td><button class="btn btn-primary btn-sm" type="button" data-plan-open="${escapeProcurementPlanningHtml(record.id)}">View</button></td>
        </tr>
    `;
}

function renderProcurementPlanningTimeline(records) {
    return records.map(record => `
        <article class="planning-timeline-card">
            <div class="planning-timeline-head">
                <div>
                    <span class="section-kicker">${escapeProcurementPlanningHtml(record.appCode)}</span>
                    <h3>${escapeProcurementPlanningHtml(record.itemDescription)}</h3>
                </div>
                <span class="badge ${getProcurementPlanningBadgeClass(record.status)}">${escapeProcurementPlanningHtml(record.status)}</span>
            </div>
            <div class="planning-milestone-grid">
                ${Object.entries(procurementPlanningScheduleLabels).map(([key, label]) => `
                    <div>
                        <span>${escapeProcurementPlanningHtml(label)}</span>
                        <strong>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.schedule?.[key]))}</strong>
                    </div>
                `).join('')}
            </div>
        </article>
    `).join('');
}

function renderProcurementPlanningDocuments(records) {
    const documents = records.flatMap(record => (record.documents || []).map(document => ({ ...document, appCode: record.appCode, item: record.itemDescription })));
    return documents.map(document => `
        <article class="planning-upload-tile planning-document-register-card">
            <div>
                <strong>${escapeProcurementPlanningHtml(document.type)}</strong>
                <span>${escapeProcurementPlanningHtml(document.name)}</span>
                <em>${escapeProcurementPlanningHtml(document.appCode)} / ${escapeProcurementPlanningHtml(document.item)}</em>
            </div>
            <span class="badge ${getProcurementPlanningBadgeClass(document.status)}">${escapeProcurementPlanningHtml(document.status)}</span>
            <input type="file" aria-label="Attach ${escapeProcurementPlanningHtml(document.type)}">
        </article>
    `).join('');
}

function renderProcurementPlanningApprovals(records) {
    return records.map(record => `
        <article class="planning-approval-card">
            <div class="planning-timeline-head">
                <div>
                    <span class="section-kicker">${escapeProcurementPlanningHtml(record.appCode)}</span>
                    <h3>${escapeProcurementPlanningHtml(record.itemDescription)}</h3>
                </div>
                <span class="badge ${getProcurementPlanningBadgeClass(record.status)}">${escapeProcurementPlanningHtml(record.status)}</span>
            </div>
            <div class="planning-approval-steps">
                ${(record.approvalSteps || []).map(step => `
                    <div>
                        <span>${escapeProcurementPlanningHtml(step.role)}</span>
                        <strong>${escapeProcurementPlanningHtml(step.actor)}</strong>
                        <em class="${getProcurementPlanningBadgeClass(step.status)}">${escapeProcurementPlanningHtml(step.status)}${step.date ? ` / ${escapeProcurementPlanningHtml(formatProcurementPlanningDate(step.date))}` : ''}</em>
                    </div>
                `).join('')}
            </div>
        </article>
    `).join('');
}

function renderProcurementPlanningForm() {
    return `
        <form class="app-planning-form procurement-plan-form" data-procurement-plan-form novalidate>
            <section class="procurement-panel evaluation-panel app-form-section">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Create APP item</span>
                        <h2>Annual Procurement Plan format</h2>
                        <p class="panel-note">Capture the fields required before tender preparation while keeping the saved register compact.</p>
                    </div>
                    <span class="badge badge-info">Draft</span>
                </div>
                <div class="app-form-grid">
                    <label class="planning-field"><span>Financial Year</span><input class="form-input" name="financialYear" value="2026/2027"></label>
                    <label class="planning-field"><span>APP Code</span><input class="form-input" name="appCode" value="APP-2026-040"></label>
                    <label class="planning-field"><span>Department / Requesting Unit</span><input class="form-input" name="department" value="Procurement Unit"></label>
                    <label class="planning-field"><span>Procurement Category</span><select class="form-input" name="procurementCategory"><option>Goods</option><option>Works</option><option>Services</option><option>Consultancy</option></select></label>
                    <label class="planning-field planning-field-wide"><span>Procurement Item Description</span><textarea class="form-input" name="itemDescription" rows="3">Office furniture and fit-out services</textarea></label>
                    <label class="planning-field"><span>Tender Number</span><input class="form-input" name="tenderNumber" value="PX-GDS-2026-040"></label>
                    <label class="planning-field"><span>Lot Number</span><input class="form-input" name="lotNumber" value="LOT-01"></label>
                    <label class="planning-field"><span>Procurement Method</span><select class="form-input" name="procurementMethod"><option>NCT</option><option>RFQ</option><option>Framework</option><option>Single Source</option><option>International Tendering</option></select></label>
                    <label class="planning-field"><span>Procurement Cycle</span><select class="form-input" name="procurementCycle"><option>First Cycle</option><option>Second Cycle</option><option>Third Cycle</option></select></label>
                    <label class="planning-field"><span>Estimated Budget</span><input class="form-input" name="estimatedBudget" value="210000000"></label>
                    <label class="planning-field"><span>Funding Source</span><input class="form-input" name="fundingSource" value="Operational budget"></label>
                    <label class="planning-field"><span>Budget Status</span><select class="form-input" name="budgetStatus"><option>Pending</option><option>Confirmed</option><option>Shortfall</option></select></label>
                    <label class="planning-field"><span>Status</span><select class="form-input" name="status"><option>Draft</option><option>Submitted</option><option>Finance Review</option><option>Procurement Review</option><option>Approved</option><option>Returned</option><option>Rejected</option><option>Ready for Tender</option></select></label>
                </div>
                <div class="app-form-grid app-date-grid procurement-plan-date-grid">
                    ${Object.entries(procurementPlanningScheduleLabels).map(([key, label], index) => `
                        <label class="planning-field">
                            <span>${escapeProcurementPlanningHtml(label)}</span>
                            <input class="form-input" type="date" name="${key}" value="2026-${String(8 + Math.floor(index / 2)).padStart(2, '0')}-${String(1 + (index * 7) % 25).padStart(2, '0')}">
                        </label>
                    `).join('')}
                </div>
                <div class="app-action-bar">
                    <button class="btn btn-primary" type="submit">Save APP Item</button>
                    <button class="btn btn-secondary" type="button" data-planning-scroll="documents">Upload Documents</button>
                    <button class="btn btn-secondary" type="button" data-planning-scroll="approvals">Route Approval</button>
                </div>
                <div class="form-status app-form-status" data-plan-form-status aria-live="polite"></div>
            </section>
        </form>
    `;
}

function renderTenderPlanning() {
    const records = getProcurementPlanningRecords();
    const averageReadiness = Math.round(records.reduce((sum, item) => sum + Number(item.readiness || 0), 0) / Math.max(records.length, 1));

    return `
        <div class="main-layout tender-planning-page procurement-planning-control app-planning-control procurement-planning-app">
            <main class="main-content tender-planning-content">
                <nav class="planning-tabs" aria-label="Procurement planning workspace sections">
                    <a href="#planning-dashboard" class="active">Dashboard</a>
                    <a href="#planning-register">Plan Register</a>
                    <a href="#planning-form">New APP Item</a>
                    <a href="#planning-documents">Documents</a>
                    <a href="#planning-approvals">Approvals</a>
                </nav>

                <section class="planning-dashboard-header app-planning-hero" id="planning-dashboard">
                    <div>
                        <span class="section-kicker">Annual Procurement Plan</span>
                        <h1>Procurement Planning</h1>
                        <p>Create annual procurement plans by financial year, track APP items through funding and approvals, and keep tender schedule dates visible before handoff.</p>
                        <div class="inline-actions">
                            <button class="btn btn-primary" type="button" data-planning-scroll="planning-form">New APP Item</button>
                            <button class="btn btn-secondary" type="button" data-planning-scroll="documents">Upload Document</button>
                            <button class="btn btn-secondary" type="button">Export APP Report</button>
                        </div>
                    </div>
                    <article class="planning-readiness-summary">
                        <span>Portfolio readiness</span>
                        <strong>${averageReadiness}%</strong>
                        <div class="planning-readiness-meter" aria-hidden="true"><i style="width: ${averageReadiness}%"></i></div>
                        <em>${records.filter(item => /ready|approved/i.test(item.status)).length} APP items are approved or ready for tender preparation.</em>
                    </article>
                </section>

                <section class="planning-kpi-grid app-planning-kpis" aria-label="Procurement planning summary">
                    ${renderProcurementPlanningSummary(records)}
                </section>

                <section class="procurement-panel evaluation-panel planning-control-panel" id="planning-register">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Plan register</span>
                            <h2>Annual Procurement Plan items</h2>
                            <p class="panel-note">Key columns stay visible here. Open a drawer for tender numbers, lot details, full schedule dates, documents, approvals, and history.</p>
                        </div>
                        <div class="procurement-planning-segmented" role="tablist" aria-label="Planning views">
                            <button class="active" type="button" data-planning-view="table">Table</button>
                            <button type="button" data-planning-view="timeline">Timeline</button>
                            <button type="button" data-planning-view="documents">Documents</button>
                            <button type="button" data-planning-view="approvals">Approvals</button>
                        </div>
                    </div>

                    <div class="planning-filter-bar app-record-filter">
                        <label>Search <input class="form-input" placeholder="APP item, tender number, department" data-planning-search></label>
                        <label>Financial Year <select class="form-input"><option>2026/2027</option><option>2025/2026</option></select></label>
                        <label>Status <select class="form-input"><option>All statuses</option><option>Draft</option><option>Submitted</option><option>Finance Review</option><option>Procurement Review</option><option>Approved</option><option>Returned</option><option>Rejected</option><option>Ready for Tender</option></select></label>
                        <button class="btn btn-secondary btn-sm" type="button">Apply filters</button>
                    </div>

                    <div class="planning-view-panel active" data-planning-panel="table">
                        <div class="data-table planning-records-table procurement-plan-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Financial Year</th>
                                        <th>Category</th>
                                        <th>Method</th>
                                        <th>Next Milestone</th>
                                        <th>Status</th>
                                        <th>Readiness</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody data-planning-table-body>
                                    ${records.map(renderProcurementPlanningRow).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="planning-view-panel" data-planning-panel="timeline">
                        <div class="planning-timeline-list">${renderProcurementPlanningTimeline(records)}</div>
                    </div>

                    <div class="planning-view-panel" data-planning-panel="documents" id="planning-documents">
                        <div class="planning-upload-box app-upload-panel procurement-plan-upload-box">
                            <div>
                                <strong>Upload APP supporting documents</strong>
                                <span>APP template, needs assessment, specifications/TOR, budget confirmation, market survey, approval memo, and board minutes.</span>
                            </div>
                            <input type="file" multiple aria-label="Upload procurement planning documents">
                        </div>
                        <div class="app-upload-grid procurement-document-grid">${renderProcurementPlanningDocuments(records)}</div>
                    </div>

                    <div class="planning-view-panel" data-planning-panel="approvals" id="planning-approvals">
                        <div class="planning-approval-list">${renderProcurementPlanningApprovals(records)}</div>
                    </div>
                </section>

                <section id="planning-form">
                    ${renderProcurementPlanningForm()}
                </section>

                <aside class="procurement-plan-drawer" data-plan-drawer aria-hidden="true" aria-label="Procurement plan details">
                    <div class="procurement-plan-drawer-backdrop" data-plan-close></div>
                    <div class="procurement-plan-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="plan-drawer-title">
                        <button class="procurement-plan-drawer-close" type="button" data-plan-close aria-label="Close details">x</button>
                        <div data-plan-drawer-content></div>
                        ${records.map(record => `
                            <template data-plan-template="${escapeProcurementPlanningHtml(record.id)}">
                                ${renderProcurementPlanDrawer(record)}
                            </template>
                        `).join('')}
                    </div>
                </aside>
            </main>
        </div>
    `;
}

function renderProcurementPlanDrawer(record) {
    if (!record) return '';
    return `
        <div class="procurement-plan-drawer-content">
            <span class="section-kicker">${escapeProcurementPlanningHtml(record.appCode)} / ${escapeProcurementPlanningHtml(record.financialYear)}</span>
            <h2 id="plan-drawer-title">${escapeProcurementPlanningHtml(record.itemDescription)}</h2>
            <div class="procurement-plan-drawer-status">
                <span class="badge ${getProcurementPlanningBadgeClass(record.status)}">${escapeProcurementPlanningHtml(record.status)}</span>
                <span class="planning-readiness-pill">${Number(record.readiness || 0)}%</span>
            </div>

            <section>
                <h3>Plan Details</h3>
                <div class="planning-detail-grid procurement-plan-detail-grid">
                    <div><span>Department</span><strong>${escapeProcurementPlanningHtml(record.department)}</strong></div>
                    <div><span>Category</span><strong>${escapeProcurementPlanningHtml(record.procurementCategory)}</strong></div>
                    <div><span>Tender Number</span><strong>${escapeProcurementPlanningHtml(record.tenderNumber)}</strong></div>
                    <div><span>Lot Number</span><strong>${escapeProcurementPlanningHtml(record.lotNumber)}</strong></div>
                    <div><span>Method</span><strong>${escapeProcurementPlanningHtml(record.procurementMethod)}</strong></div>
                    <div><span>Cycle</span><strong>${escapeProcurementPlanningHtml(record.procurementCycle)}</strong></div>
                    <div><span>Budget</span><strong>${escapeProcurementPlanningHtml(formatProcurementPlanningMoney(record.estimatedBudget))}</strong></div>
                    <div><span>Funding Source</span><strong>${escapeProcurementPlanningHtml(record.fundingSource)}</strong></div>
                    <div><span>Budget Status</span><strong>${escapeProcurementPlanningHtml(record.budgetStatus)}</strong></div>
                </div>
            </section>

            <section>
                <h3>Schedule Dates</h3>
                <div class="procurement-plan-drawer-list">
                    ${Object.entries(procurementPlanningScheduleLabels).map(([key, label]) => `
                        <div><span>${escapeProcurementPlanningHtml(label)}</span><strong>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.schedule?.[key]))}</strong></div>
                    `).join('')}
                </div>
            </section>

            <section>
                <h3>Documents</h3>
                <div class="procurement-plan-drawer-list">
                    ${(record.documents || []).map(document => `
                        <div><span>${escapeProcurementPlanningHtml(document.type)}</span><strong>${escapeProcurementPlanningHtml(document.name)}</strong><em>${escapeProcurementPlanningHtml(document.status)}</em></div>
                    `).join('')}
                </div>
            </section>

            <section>
                <h3>Approval Workflow</h3>
                <div class="procurement-plan-drawer-list">
                    ${(record.approvalSteps || []).map(step => `
                        <div><span>${escapeProcurementPlanningHtml(step.role)}</span><strong>${escapeProcurementPlanningHtml(step.actor)}</strong><em>${escapeProcurementPlanningHtml(step.status)}${step.date ? ` / ${escapeProcurementPlanningHtml(formatProcurementPlanningDate(step.date))}` : ''}</em></div>
                    `).join('')}
                </div>
            </section>

            <section>
                <h3>Status History</h3>
                <div class="procurement-plan-history">
                    ${(record.activityHistory || []).map(item => `<span>${escapeProcurementPlanningHtml(item)}</span>`).join('')}
                </div>
            </section>
        </div>
    `;
}

function initializeTenderPlanning() {
    const root = document.querySelector('.procurement-planning-app');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    const records = getProcurementPlanningRecords();
    const drawer = root.querySelector('[data-plan-drawer]');
    const drawerContent = root.querySelector('[data-plan-drawer-content]');

    const openDrawer = (recordId) => {
        const record = records.find(item => item.id === recordId);
        if (!record || !drawer || !drawerContent) return;
        const template = root.querySelector(`template[data-plan-template="${CSS.escape(recordId)}"]`);
        drawerContent.innerHTML = template?.innerHTML || renderProcurementPlanDrawer(record);
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
    };

    const closeDrawer = () => {
        if (!drawer) return;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
    };

    root.querySelectorAll('[data-plan-open]').forEach(button => {
        button.addEventListener('click', () => openDrawer(button.getAttribute('data-plan-open')));
    });

    root.querySelectorAll('[data-plan-close]').forEach(button => {
        button.addEventListener('click', closeDrawer);
    });

    root.querySelectorAll('[data-planning-view]').forEach(button => {
        button.addEventListener('click', () => {
            const view = button.getAttribute('data-planning-view');
            root.querySelectorAll('[data-planning-view]').forEach(item => item.classList.toggle('active', item === button));
            root.querySelectorAll('[data-planning-panel]').forEach(panel => {
                panel.classList.toggle('active', panel.getAttribute('data-planning-panel') === view);
            });
        });
    });

    root.querySelectorAll('[data-planning-scroll]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-planning-scroll');
            const element = root.querySelector(`#${target}`) || root.querySelector(`[data-planning-panel="${target}"]`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    const search = root.querySelector('[data-planning-search]');
    const rows = Array.from(root.querySelectorAll('[data-planning-table-body] tr'));
    if (search) {
        search.addEventListener('input', () => {
            const term = search.value.trim().toLowerCase();
            rows.forEach(row => row.hidden = term && !row.textContent.toLowerCase().includes(term));
        });
    }

    const form = root.querySelector('[data-procurement-plan-form]');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const appCode = String(data.get('appCode') || `APP-${Date.now()}`);
            const newRecord = {
                id: appCode.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                financialYear: String(data.get('financialYear') || '2026/2027'),
                appCode,
                department: String(data.get('department') || 'Procurement Unit'),
                itemDescription: String(data.get('itemDescription') || 'Untitled procurement item'),
                procurementCategory: String(data.get('procurementCategory') || 'Goods'),
                tenderNumber: String(data.get('tenderNumber') || ''),
                lotNumber: String(data.get('lotNumber') || ''),
                procurementMethod: String(data.get('procurementMethod') || 'NCT'),
                procurementCycle: String(data.get('procurementCycle') || 'First Cycle'),
                estimatedBudget: Number(String(data.get('estimatedBudget') || '0').replace(/[^0-9.]/g, '')) || 0,
                fundingSource: String(data.get('fundingSource') || ''),
                budgetStatus: String(data.get('budgetStatus') || 'Pending'),
                status: String(data.get('status') || 'Draft'),
                readiness: 28,
                owner: 'Current user',
                priority: 'Medium',
                schedule: Object.keys(procurementPlanningScheduleLabels).reduce((schedule, key) => ({ ...schedule, [key]: String(data.get(key) || '') }), {}),
                documents: [
                    { type: 'APP Template', name: 'Awaiting upload', status: 'Draft' },
                    { type: 'Needs Assessment', name: 'Awaiting upload', status: 'Missing' },
                    { type: 'Budget Confirmation', name: 'Awaiting upload', status: 'Pending' }
                ],
                approvalSteps: [
                    { role: 'Requester', actor: 'Current user', status: 'Draft', date: '' },
                    { role: 'Finance Review', actor: 'Finance Officer', status: 'Waiting', date: '' },
                    { role: 'Procurement Review', actor: 'Head of Procurement', status: 'Waiting', date: '' },
                    { role: 'Tender Board', actor: 'Board Secretary', status: 'Waiting', date: '' }
                ],
                activityHistory: ['APP item captured in prototype']
            };
            saveProcurementPlanningRecords([newRecord, ...records.filter(record => record.id !== newRecord.id)]);
            const status = root.querySelector('[data-plan-form-status]');
            if (status) {
                status.textContent = 'APP item saved in this browser prototype.';
                status.classList.add('success');
            }
            window.setTimeout(() => window.app?.renderPage(), 450);
        });
    }
}

window.renderTenderPlanning = renderTenderPlanning;
window.initializeTenderPlanning = initializeTenderPlanning;
