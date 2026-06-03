const procurementPlanningSections = {
    details: {
        number: '01',
        title: 'Procurement details',
        kicker: 'Overview and readiness',
        summary: 'View the plan identity, readiness score, owners, dates, and current pipeline status before the procurement moves to tendering.',
        badge: '73% ready',
        metrics: [
            ['APP items', '42', 'Captured in this financial year'],
            ['SPP schedules', '18', 'Active schedules under monitoring'],
            ['Actions due', '7', 'Items need officer attention']
        ],
        tableTitle: 'Planning pipeline',
        headers: ['Plan item', 'Reference', 'Owner', 'Stage', 'Next action'],
        rows: [
            ['Hospital theatre equipment', 'APP-2026-014 / SPP-2026-006', 'Amina Yusuf', 'Approved', 'Create Tender/RFQ'],
            ['Fleet maintenance framework', 'APP-2026-021', 'Operations', 'Budget review', 'Resolve finance shortfall'],
            ['Ward renovation works', 'APP-2026-027 / SPP-2026-011', 'Infrastructure', 'Approval', 'Tender board review']
        ],
        checklist: ['Confirm the procurement method and category.', 'Validate planned dates against the SPP schedule.', 'Check that approvals are complete before handoff.']
    },
    questions: {
        number: '02',
        title: 'Questions and requirements',
        kicker: 'SPP schedule and permissions',
        summary: 'Review requirements, clarifications, responsible roles, and SPP milestones that must be ready before publication.',
        badge: 'SPP-2026-006',
        metrics: [
            ['Requirements', '12', 'Technical and eligibility items'],
            ['Clarifications', '4', 'Open buyer questions'],
            ['Roles', '6', 'Access profiles involved']
        ],
        tableTitle: 'Requirement tracker',
        headers: ['Requirement', 'Responsible role', 'Status', 'Due date', 'Action'],
        rows: [
            ['Specifications/TOR', 'Requesting department', 'Complete', 'Jun 2, 2026', 'View'],
            ['Budget confirmation', 'Finance officer', 'Due today', 'Jun 2, 2026', 'Remind'],
            ['Eligibility requirements', 'Procurement officer', 'Draft', 'Jun 5, 2026', 'Review']
        ],
        checklist: ['Confirm mandatory requirements and evaluation pass marks.', 'Publish clarification responses before bid submission opens.', 'Keep role permissions aligned with approvals.']
    },
    complaints: {
        number: '03',
        title: 'Complaints',
        kicker: 'Risks, alerts, and actions',
        summary: 'Track procurement complaints, overdue actions, risk responses, and responsible officers before the tender stage proceeds.',
        badge: '3 risks',
        metrics: [
            ['Open complaints', '2', 'Awaiting procurement response'],
            ['Critical alerts', '3', 'Budget and specification delays'],
            ['Resolved', '9', 'Closed planning issues']
        ],
        tableTitle: 'Complaint and risk log',
        headers: ['Issue', 'Raised by', 'Severity', 'Status', 'Next action'],
        rows: [
            ['Budget shortfall on fleet framework', 'Finance officer', 'High', 'Open', 'Resolve funding gap'],
            ['Specification upload delay', 'Requesting department', 'Medium', 'In progress', 'Notify owner'],
            ['Approval memo missing attachment', 'Auditor', 'Medium', 'Returned', 'Attach evidence']
        ],
        checklist: ['Assign an owner for every complaint or risk.', 'Record response history for audit review.', 'Escalate critical blockers before plan approval.']
    },
    monitoring: {
        number: '04',
        title: 'Monitoring and reporting',
        kicker: 'APP and SPP exports',
        summary: 'Monitor plan performance, export APP and SPP reports, and review approval, budget, and document readiness indicators.',
        badge: '5 reports',
        metrics: [
            ['APP items', '42', 'Grouped by department'],
            ['Average progress', '73%', 'Across active SPP schedules'],
            ['Approval cycle', '2.8 days', 'Average role turnaround']
        ],
        tableTitle: 'Available reports',
        headers: ['Report', 'Coverage', 'Format', 'Owner', 'Action'],
        rows: [
            ['APP by department', 'Financial year, category, priority', 'Excel', 'Procurement unit', 'Export'],
            ['SPP progress', 'Activities, delays, owners', 'PDF', 'Planning officer', 'Open'],
            ['Document readiness', 'Required evidence and review aging', 'PDF', 'Records officer', 'Export']
        ],
        checklist: ['Export reports before review meetings.', 'Monitor delayed activities by owner.', 'Use report outputs for management and audit evidence.']
    },
    customer: {
        number: '05',
        title: 'Customer information',
        kicker: 'APP item and department data',
        summary: 'Review the requesting department, internal customer, officer contacts, need statement, and service expectations.',
        badge: 'Health Services',
        metrics: [
            ['Department', 'Health', 'Requesting unit'],
            ['Owner', 'Amina', 'Responsible officer'],
            ['Priority', 'High', 'Service criticality']
        ],
        tableTitle: 'Customer profile',
        headers: ['Field', 'Current value', 'Source', 'Status', 'Action'],
        rows: [
            ['Requesting department', 'Health Services', 'APP item', 'Confirmed', 'View'],
            ['Responsible officer', 'Amina Yusuf', 'User profile', 'Active', 'Message'],
            ['Need statement', 'Hospital theatre equipment', 'Needs assessment', 'Accepted', 'Open']
        ],
        checklist: ['Confirm the requesting department and officer contacts.', 'Attach the needs assessment to the APP item.', 'Verify priority and service impact before approval.']
    },
    purchase: {
        number: '06',
        title: 'Purchase information',
        kicker: 'Budget and funding checks',
        summary: 'Review procurement value, funding source, budget confirmation, procurement method, and finance clearance.',
        badge: 'TZS 480M',
        metrics: [
            ['Budget', '480M', 'Estimated APP value'],
            ['Committed', '480M', 'Finance confirmed'],
            ['Method', 'NCT', 'National competitive tendering']
        ],
        tableTitle: 'Purchase and finance checks',
        headers: ['Purchase item', 'Funding source', 'Budget', 'Finance status', 'Action'],
        rows: [
            ['Hospital theatre equipment', 'Development budget', 'TZS 480,000,000', 'Confirmed', 'View confirmation'],
            ['Fleet maintenance framework', 'Operational budget', 'TZS 125,000,000', 'Shortfall', 'Resolve'],
            ['Ward renovation works', 'Capital projects', 'TZS 760,000,000', 'Pending', 'Confirm']
        ],
        checklist: ['Confirm budget availability before SPP approval.', 'Check procurement method threshold compliance.', 'Record funding source and finance officer decision.']
    },
    tenderDocs: {
        number: '07',
        title: 'Tender documentation',
        kicker: 'Evidence and approvals',
        summary: 'Manage specifications, TOR, approval memo, board minutes, handoff notes, and required tender package evidence.',
        badge: '88% complete',
        metrics: [
            ['Evidence files', '24', 'Attached documents'],
            ['Review pending', '5', 'Need officer action'],
            ['Accepted', '19', 'Approved evidence']
        ],
        tableTitle: 'Tender documentation checklist',
        headers: ['Document', 'Linked record', 'Owner', 'Status', 'Action'],
        rows: [
            ['Specifications/TOR', 'SPP-2026-006', 'Procurement officer', 'Review', 'Approve'],
            ['Approval memo', 'APP-2026-014', 'Head of department', 'Accepted', 'View'],
            ['Tender board minutes', 'SPP-2026-011', 'Board secretary', 'Missing signature', 'Request update']
        ],
        checklist: ['Attach all evidence required for tender creation.', 'Review documents before Tender/RFQ handoff.', 'Keep approval evidence available for audit.']
    },
    documents: {
        number: '08',
        title: 'Documents',
        kicker: 'Register and review status',
        summary: 'Open the planning document register, review file status, and track accepted, pending, returned, or missing attachments.',
        badge: '24 files',
        metrics: [
            ['Accepted', '19', 'Documents cleared'],
            ['Pending', '3', 'Awaiting review'],
            ['Returned', '2', 'Need correction']
        ],
        tableTitle: 'Document register',
        headers: ['Document', 'Type', 'Linked record', 'Status', 'Action'],
        rows: [
            ['Needs assessment', 'PDF / 1.8 MB', 'APP-2026-014', 'Accepted', 'View'],
            ['Budget confirmation note', 'PDF / finance signed', 'APP-2026-021', 'Pending', 'Remind'],
            ['Specifications/TOR', 'DOCX / version 3', 'SPP-2026-006', 'Review', 'Approve']
        ],
        checklist: ['Upload documents against the correct APP or SPP record.', 'Use review status to find pending action quickly.', 'Keep returned documents visible until corrected.']
    }
};

function renderProcurementPlanningDetailPage(section) {
    const metrics = section.metrics.map(([label, value, note]) => `
        <article class="planning-detail-metric">
            <span>${label}</span>
            <strong>${value}</strong>
            <em>${note}</em>
        </article>
    `).join('');

    const rows = section.rows.map(row => `
        <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
    `).join('');

    return `
        <div class="main-layout tender-planning-page planning-detail-page">
            <main class="main-content tender-planning-content">
                <section class="planning-detail-hero">
                    <div>
                        <span class="section-kicker">${section.kicker}</span>
                        <h1>${section.title}</h1>
                        <p>${section.summary}</p>
                        <div class="planning-detail-summary-strip" aria-label="${section.title} summary">
                            <span>${section.number}</span>
                            <strong>${section.badge}</strong>
                            <em>${section.title}</em>
                        </div>
                        <div class="inline-actions">
                            <button class="btn btn-secondary" type="button" data-navigate="tender-planning">Back to Procurement Planning</button>
                            <button class="btn btn-primary" type="button">Open action queue</button>
                        </div>
                    </div>
                </section>

                <section class="planning-detail-metrics" aria-label="${section.title} summary">
                    ${metrics}
                </section>

                <section class="planning-two-col">
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">${section.kicker}</span>
                                <h2>${section.tableTitle}</h2>
                            </div>
                        </div>
                        <div class="data-table planning-table">
                            <table>
                                <thead><tr>${section.headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </article>
                    <article class="procurement-panel evaluation-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Required checks</span>
                                <h2>What to verify</h2>
                            </div>
                        </div>
                        <div class="planning-detail-checklist">
                            ${section.checklist.map(item => `<div><strong>${item}</strong><span>Linked to Procurement Planning controls and audit readiness.</span></div>`).join('')}
                        </div>
                    </article>
                </section>
            </main>
        </div>
    `;
}

function renderProcurementPlanningDetails() { return renderProcurementPlanningDetailPage(procurementPlanningSections.details); }
function renderProcurementPlanningQuestions() { return renderProcurementPlanningDetailPage(procurementPlanningSections.questions); }
function renderProcurementPlanningComplaints() { return renderProcurementPlanningDetailPage(procurementPlanningSections.complaints); }
function renderProcurementPlanningMonitoring() { return renderProcurementPlanningDetailPage(procurementPlanningSections.monitoring); }
function renderProcurementPlanningCustomer() { return renderProcurementPlanningDetailPage(procurementPlanningSections.customer); }
function renderProcurementPlanningPurchase() { return renderProcurementPlanningDetailPage(procurementPlanningSections.purchase); }
function renderProcurementPlanningTenderDocs() { return renderProcurementPlanningDetailPage(procurementPlanningSections.tenderDocs); }
function renderProcurementPlanningDocuments() { return renderProcurementPlanningDetailPage(procurementPlanningSections.documents); }

const procurementPlanningTabSections = {
    dashboard: {
        ...procurementPlanningSections.details,
        title: 'Planning Dashboard',
        kicker: 'Portfolio control center',
        summary: 'Review total APP demand, active SPP schedules, budget issues, approval blockers, document readiness, and tender handoff progress in one dashboard.',
        tableTitle: 'Dashboard focus areas',
        headers: ['Area', 'Current status', 'Owner', 'Readiness', 'Action'],
        rows: [
            ['APP capture', '42 items recorded', 'Procurement unit', '73%', 'Review records'],
            ['Budget checks', '9 issues pending', 'Finance officer', '61%', 'Open finance queue'],
            ['Tender handoff', '6 items ready', 'Planning officer', '88%', 'Create Tender/RFQ']
        ],
        checklist: ['Review readiness before tender creation.', 'Resolve overdue finance and approval actions.', 'Confirm all required evidence is linked to APP/SPP records.']
    },
    appItems: {
        number: '02',
        title: 'APP Items',
        kicker: 'Annual Procurement Plan',
        summary: 'Manage APP item details including department, budget, procurement method, priority, responsible officer, status, and Create SPP action.',
        badge: '42 APP items',
        metrics: [
            ['Approved', '6', 'Ready to create SPP'],
            ['Draft', '12', 'Need owner completion'],
            ['Budget review', '9', 'Awaiting finance checks']
        ],
        tableTitle: 'APP item register',
        headers: ['APP Code', 'Item', 'Department', 'Budget', 'Action'],
        rows: [
            ['APP-2026-014', 'Hospital theatre equipment', 'Health Services', 'TZS 480M', 'Create SPP'],
            ['APP-2026-021', 'Fleet maintenance framework', 'Operations', 'TZS 125M', 'Edit'],
            ['APP-2026-027', 'Ward renovation works', 'Infrastructure', 'TZS 760M', 'Submit for Approval']
        ],
        checklist: ['Confirm the department and responsible officer.', 'Validate procurement method and priority.', 'Create an SPP only after budget and approval readiness are clear.']
    },
    sppSchedule: {
        number: '03',
        title: 'SPP Schedule',
        kicker: 'Specific Procurement Plan',
        summary: 'Track SPP activities, milestones, due dates, responsible officers, and completion status from specifications to tender preparation.',
        badge: '18 active',
        metrics: [
            ['Complete', '4', 'Activities finished'],
            ['Due today', '2', 'Need action'],
            ['Planned', '12', 'Future milestones']
        ],
        tableTitle: 'SPP milestone schedule',
        headers: ['Milestone', 'Due date', 'Responsible officer', 'Status', 'Action'],
        rows: [
            ['Specifications/TOR', 'Jun 2', 'Amina Yusuf', 'Complete', 'View'],
            ['Budget confirmation', 'Jun 3', 'Fatma M.', 'Due today', 'Remind'],
            ['Tender/RFQ preparation', 'Jun 7', 'Procurement officer', 'Planned', 'Open']
        ],
        checklist: ['Keep milestone owners current.', 'Escalate overdue activities.', 'Confirm completion before Tender/RFQ preparation begins.']
    },
    budgetFunding: {
        ...procurementPlanningSections.purchase,
        title: 'Budget & Funding',
        kicker: 'Finance confirmation',
        summary: 'Review budget availability, funding sources, finance clearance, shortfalls, and purchasing method compliance before approval.',
        tableTitle: 'Budget and funding checks'
    },
    approvals: {
        number: '05',
        title: 'Approvals',
        kicker: 'Approval queue',
        summary: 'Review pending plan approvals, returned APP items, board actions, approval owners, and recent approval decisions.',
        badge: '11 pending',
        metrics: [
            ['Pending', '11', 'Awaiting approvers'],
            ['Returned', '2', 'Need correction'],
            ['Approved', '6', 'Ready for next step']
        ],
        tableTitle: 'Approval worklist',
        headers: ['Record', 'Approver', 'Status', 'Due date', 'Action'],
        rows: [
            ['SPP-2026-006', 'Head of procurement', 'Queued', 'Jun 4', 'Approve'],
            ['APP-2026-021', 'Finance officer', 'Returned', 'Jun 2', 'Review'],
            ['SPP-2026-011', 'Tender board', 'Scheduled', 'Jun 6', 'View details']
        ],
        checklist: ['Keep approval ownership clear.', 'Resolve returned items quickly.', 'Record each approval decision for audit.']
    },
    documentsEvidence: {
        ...procurementPlanningSections.tenderDocs,
        title: 'Documents & Evidence',
        kicker: 'Document readiness',
        summary: 'Manage APP/SPP evidence, specifications, TOR, approval memos, board minutes, budget notes, and handoff documents.',
        tableTitle: 'Evidence register'
    },
    risksAlerts: {
        ...procurementPlanningSections.complaints,
        title: 'Risks & Alerts',
        kicker: 'Delayed activities and blockers',
        summary: 'Track budget blockers, missing documents, overdue activities, complaint records, and required escalation actions.',
        tableTitle: 'Risk and alert log'
    },
    reports: {
        ...procurementPlanningSections.monitoring,
        title: 'Reports',
        kicker: 'Monitoring and exports',
        summary: 'Open planning reports covering APP by department, SPP progress, budget issues, approval performance, document readiness, and audit events.',
        tableTitle: 'Planning report library'
    }
};

function renderProcurementPlanningDashboard() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.dashboard); }
function renderProcurementPlanningAppItems() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.appItems); }
function renderProcurementPlanningSppSchedule() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.sppSchedule); }
function renderProcurementPlanningBudgetFunding() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.budgetFunding); }
function renderProcurementPlanningApprovals() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.approvals); }
function renderProcurementPlanningDocumentsEvidence() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.documentsEvidence); }
function renderProcurementPlanningRisksAlerts() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.risksAlerts); }
function renderProcurementPlanningReports() { return renderProcurementPlanningDetailPage(procurementPlanningTabSections.reports); }

window.renderProcurementPlanningDetails = renderProcurementPlanningDetails;
window.renderProcurementPlanningQuestions = renderProcurementPlanningQuestions;
window.renderProcurementPlanningComplaints = renderProcurementPlanningComplaints;
window.renderProcurementPlanningMonitoring = renderProcurementPlanningMonitoring;
window.renderProcurementPlanningCustomer = renderProcurementPlanningCustomer;
window.renderProcurementPlanningPurchase = renderProcurementPlanningPurchase;
window.renderProcurementPlanningTenderDocs = renderProcurementPlanningTenderDocs;
window.renderProcurementPlanningDocuments = renderProcurementPlanningDocuments;
window.renderProcurementPlanningDashboard = renderProcurementPlanningDashboard;
window.renderProcurementPlanningAppItems = renderProcurementPlanningAppItems;
window.renderProcurementPlanningSppSchedule = renderProcurementPlanningSppSchedule;
window.renderProcurementPlanningBudgetFunding = renderProcurementPlanningBudgetFunding;
window.renderProcurementPlanningApprovals = renderProcurementPlanningApprovals;
window.renderProcurementPlanningDocumentsEvidence = renderProcurementPlanningDocumentsEvidence;
window.renderProcurementPlanningRisksAlerts = renderProcurementPlanningRisksAlerts;
window.renderProcurementPlanningReports = renderProcurementPlanningReports;
