// User-side Records and History app for procurement records, reporting, and exports.

const RECORDS_HISTORY_PAGE_SIZE = 8;
const RECORDS_HISTORY_TYPES = ['Tender', 'Bid', 'Contract', 'Award', 'Amendment', 'Clarification', 'Cancellation', 'Compliance', 'Report'];
const RECORDS_HISTORY_STATUSES = ['Draft', 'Open', 'Closed', 'Evaluation', 'Awarded', 'Contracted', 'Cancelled', 'Archived', 'Submitted', 'Completed'];

function escapeRecordsHistoryHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatRecordsHistoryDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value || 'Not recorded';
    return new Date(parsed).toLocaleDateString('en-US', options);
}

function formatRecordsHistoryValue(value) {
    const amount = Number(value || 0);
    if (!amount) return 'Not recorded';
    return `TZS ${amount.toLocaleString()}`;
}

function formatRecordsHistoryCompactValue(value) {
    const amount = Number(value || 0);
    if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(0)}M`;
    return formatRecordsHistoryValue(amount);
}

function getRecordsHistoryStoredArray(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function getRecordsHistoryCurrentUser() {
    const account = mockData.pendingAccount || {};
    const session = mockData.session || {};
    const profile = mockData.eKycProfile || {};
    const registryRecord = profile.registryRecord || {};
    const roleSource = String(profile.role || account.role || session.role || '').toLowerCase();
    const ownerRole = roleSource.includes('buyer') || roleSource.includes('procur') ? 'buyer' : 'supplier';
    const fallbackOrganization = ownerRole === 'buyer'
        ? mockData.users?.buyer?.organization
        : mockData.users?.current?.organization || mockData.users?.supplier?.organization;

    return {
        role: ownerRole,
        organization: registryRecord.name || account.organization || fallbackOrganization || account.displayName || 'Kilimanjaro Supplies Limited'
    };
}

function recordsHistoryTimeline(items) {
    return items.map(item => ({
        title: item.title,
        date: item.date,
        role: item.role
    }));
}

function buildProcurementRecord(record) {
    const timeline = recordsHistoryTimeline(record.timeline || []);
    const history = record.procurementActivityHistory || timeline.map(item => ({
        time: item.date,
        action: item.title,
        role: item.role
    }));
    const party = record.ownerRole === 'buyer' ? (record.supplier || 'Multiple suppliers') : record.buyer;

    return {
        ...record,
        value: Number(record.value || 0),
        evidenceItems: record.evidenceItems || ['Details'],
        timeline,
        documents: record.documents || [],
        procurementActivityHistory: history,
        party,
        searchText: [
            record.reference,
            record.title,
            record.buyer,
            record.supplier,
            record.category,
            record.type,
            record.status,
            record.evidenceItems?.join(' ')
        ].join(' ').toLowerCase()
    };
}

function getRecordsHistoryBaseRecords() {
    return [
        buildProcurementRecord({
            id: 'rec-001',
            ownerRole: 'buyer',
            ownerOrganization: 'Ministry of Health',
            date: '2026-07-17',
            type: 'Tender',
            title: 'District Maternal Health Wing Construction',
            reference: 'PX-WRK-2026-003',
            buyer: 'Ministry of Health',
            supplier: null,
            category: 'Works',
            status: 'Open',
            value: 4980000000,
            evidenceItems: ['Details', 'Bids', 'Opening', 'Award', 'Contract', 'Compliance'],
            timeline: [
                { title: 'Tender created', date: 'Jul 17, 2026 09:15', role: 'Procurement Officer' },
                { title: 'Tender published', date: 'Jul 17, 2026 10:00', role: 'Procurement Manager' },
                { title: 'Clarification answered', date: 'Jul 20, 2026 14:30', role: 'Procurement Officer' }
            ],
            documents: [
                { name: 'Tender notice', type: 'PDF', date: 'Jul 17, 2026' },
                { name: 'Clarification response', type: 'PDF', date: 'Jul 20, 2026' },
                { name: 'Bid opening report', type: 'PDF', date: 'Aug 05, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-002',
            ownerRole: 'buyer',
            ownerOrganization: 'Ministry of Health',
            date: '2026-08-05',
            type: 'Bid',
            title: 'Bids received for maternal health wing construction',
            reference: 'PX-BID-2026-014',
            buyer: 'Ministry of Health',
            supplier: 'ABC Construction Ltd',
            category: 'Works',
            status: 'Evaluation',
            value: 4875000000,
            evidenceItems: ['Bids', 'Opening', 'Evaluation', 'Compliance'],
            timeline: [
                { title: 'Bid submitted', date: 'Aug 04, 2026 16:42', role: 'Supplier' },
                { title: 'Bid opening completed', date: 'Aug 05, 2026 17:30', role: 'Evaluation Committee' },
                { title: 'Evaluation completed', date: 'Aug 12, 2026 11:20', role: 'Evaluation Committee' }
            ],
            documents: [
                { name: 'Bid submission receipt', type: 'PDF', date: 'Aug 04, 2026' },
                { name: 'Bid opening report', type: 'PDF', date: 'Aug 05, 2026' },
                { name: 'Evaluation summary', type: 'PDF', date: 'Aug 12, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-003',
            ownerRole: 'buyer',
            ownerOrganization: 'Ministry of Health',
            date: '2026-08-15',
            type: 'Award',
            title: 'Award for maternal health wing construction',
            reference: 'PX-AWD-2026-009',
            buyer: 'Ministry of Health',
            supplier: 'ABC Construction Ltd',
            category: 'Works',
            status: 'Awarded',
            value: 4875000000,
            evidenceItems: ['Award', 'Evaluation', 'Contract'],
            timeline: [
                { title: 'Evaluation completed', date: 'Aug 12, 2026 11:20', role: 'Evaluation Committee' },
                { title: 'Award issued', date: 'Aug 15, 2026 15:10', role: 'Procurement Committee' },
                { title: 'Report generated', date: 'Aug 15, 2026 16:25', role: 'Procurement Officer' }
            ],
            documents: [
                { name: 'Award notice', type: 'PDF', date: 'Aug 15, 2026' },
                { name: 'Generated report', type: 'PDF', date: 'Aug 15, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-004',
            ownerRole: 'buyer',
            ownerOrganization: 'Ministry of Health',
            date: '2026-08-22',
            type: 'Contract',
            title: 'Construction contract for maternal health wing',
            reference: 'PX-CON-2026-006',
            buyer: 'Ministry of Health',
            supplier: 'ABC Construction Ltd',
            category: 'Works',
            status: 'Contracted',
            value: 4875000000,
            evidenceItems: ['Contract', 'Award', 'Compliance'],
            timeline: [
                { title: 'Award issued', date: 'Aug 15, 2026 15:10', role: 'Procurement Committee' },
                { title: 'Contract created', date: 'Aug 22, 2026 10:05', role: 'Contract Officer' },
                { title: 'Compliance document uploaded', date: 'Aug 23, 2026 09:50', role: 'Supplier' }
            ],
            documents: [
                { name: 'Contract document', type: 'PDF', date: 'Aug 22, 2026' },
                { name: 'Compliance evidence', type: 'PDF', date: 'Aug 23, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-005',
            ownerRole: 'buyer',
            ownerOrganization: 'Ministry of Health',
            date: '2026-09-02',
            type: 'Amendment',
            title: 'Amendment to clinic equipment delivery schedule',
            reference: 'PX-AMD-2026-011',
            buyer: 'Ministry of Health',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Goods',
            status: 'Completed',
            value: 640000000,
            evidenceItems: ['Details', 'Amendment', 'Contract'],
            timeline: [
                { title: 'Amendment issued', date: 'Sep 02, 2026 12:15', role: 'Contract Officer' },
                { title: 'Compliance document uploaded', date: 'Sep 03, 2026 08:40', role: 'Supplier' }
            ],
            documents: [
                { name: 'Amendment notice', type: 'PDF', date: 'Sep 02, 2026' },
                { name: 'Contract addendum', type: 'PDF', date: 'Sep 02, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-006',
            ownerRole: 'buyer',
            ownerOrganization: 'Ministry of Health',
            date: '2026-09-11',
            type: 'Cancellation',
            title: 'Cancelled procurement for temporary laboratory furniture',
            reference: 'PX-CAN-2026-004',
            buyer: 'Ministry of Health',
            supplier: null,
            category: 'Goods',
            status: 'Cancelled',
            value: 280000000,
            evidenceItems: ['Details', 'Cancellation', 'Approval'],
            timeline: [
                { title: 'Tender created', date: 'Sep 06, 2026 09:30', role: 'Procurement Officer' },
                { title: 'Cancellation recorded', date: 'Sep 11, 2026 13:05', role: 'Procurement Manager' }
            ],
            documents: [
                { name: 'Tender notice', type: 'PDF', date: 'Sep 06, 2026' },
                { name: 'Cancellation notice', type: 'PDF', date: 'Sep 11, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-101',
            ownerRole: 'supplier',
            ownerOrganization: 'Kilimanjaro Supplies Limited',
            date: '2026-07-19',
            type: 'Tender',
            title: 'Solar Mini-Grid Civil Works and Distribution Network',
            reference: 'PX-WRK-2026-003',
            buyer: 'Rural Energy Agency',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Works',
            status: 'Open',
            value: 4980000000,
            evidenceItems: ['Details', 'Clarification', 'Bids', 'Opening'],
            timeline: [
                { title: 'Tender viewed', date: 'Jul 19, 2026 08:25', role: 'Supplier' },
                { title: 'Clarification answered', date: 'Jul 20, 2026 14:30', role: 'Procurement Officer' },
                { title: 'Bid submitted', date: 'Aug 04, 2026 16:42', role: 'Supplier' }
            ],
            documents: [
                { name: 'Tender notice', type: 'PDF', date: 'Jul 17, 2026' },
                { name: 'Clarification response', type: 'PDF', date: 'Jul 20, 2026' },
                { name: 'Bid submission receipt', type: 'PDF', date: 'Aug 04, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-102',
            ownerRole: 'supplier',
            ownerOrganization: 'Kilimanjaro Supplies Limited',
            date: '2026-08-04',
            type: 'Bid',
            title: 'Bid submission for solar mini-grid civil works',
            reference: 'PX-BID-2026-021',
            buyer: 'Rural Energy Agency',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Works',
            status: 'Submitted',
            value: 4720000000,
            evidenceItems: ['Details', 'Bids', 'Compliance', 'Receipt'],
            timeline: [
                { title: 'Bid submitted', date: 'Aug 04, 2026 16:42', role: 'Supplier' },
                { title: 'Bid opening completed', date: 'Aug 05, 2026 17:30', role: 'Evaluation Committee' }
            ],
            documents: [
                { name: 'Bid submission receipt', type: 'PDF', date: 'Aug 04, 2026' },
                { name: 'Compliance evidence', type: 'PDF', date: 'Aug 04, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-103',
            ownerRole: 'supplier',
            ownerOrganization: 'Kilimanjaro Supplies Limited',
            date: '2026-08-15',
            type: 'Award',
            title: 'Award result for solar mini-grid civil works',
            reference: 'PX-AWD-2026-012',
            buyer: 'Rural Energy Agency',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Works',
            status: 'Awarded',
            value: 4720000000,
            evidenceItems: ['Award', 'Opening', 'Contract'],
            timeline: [
                { title: 'Evaluation completed', date: 'Aug 12, 2026 11:20', role: 'Evaluation Committee' },
                { title: 'Award issued', date: 'Aug 15, 2026 15:10', role: 'Procurement Committee' }
            ],
            documents: [
                { name: 'Award notice', type: 'PDF', date: 'Aug 15, 2026' },
                { name: 'Generated report', type: 'PDF', date: 'Aug 15, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-104',
            ownerRole: 'supplier',
            ownerOrganization: 'Kilimanjaro Supplies Limited',
            date: '2026-08-26',
            type: 'Contract',
            title: 'Solar mini-grid implementation contract',
            reference: 'PX-CON-2026-010',
            buyer: 'Rural Energy Agency',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Works',
            status: 'Contracted',
            value: 4720000000,
            evidenceItems: ['Contract', 'Award', 'Compliance'],
            timeline: [
                { title: 'Contract created', date: 'Aug 26, 2026 10:35', role: 'Contract Officer' },
                { title: 'Compliance document uploaded', date: 'Aug 27, 2026 12:05', role: 'Supplier' }
            ],
            documents: [
                { name: 'Contract document', type: 'PDF', date: 'Aug 26, 2026' },
                { name: 'Compliance evidence', type: 'PDF', date: 'Aug 27, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-105',
            ownerRole: 'supplier',
            ownerOrganization: 'Kilimanjaro Supplies Limited',
            date: '2026-09-03',
            type: 'Compliance',
            title: 'Tax clearance and business registration upload',
            reference: 'PX-CMP-2026-018',
            buyer: 'Ministry of Health',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Goods',
            status: 'Completed',
            value: 0,
            evidenceItems: ['Compliance', 'Details'],
            timeline: [
                { title: 'Compliance document uploaded', date: 'Sep 03, 2026 08:40', role: 'Supplier' },
                { title: 'Report generated', date: 'Sep 03, 2026 09:15', role: 'Supplier' }
            ],
            documents: [
                { name: 'Compliance evidence', type: 'PDF', date: 'Sep 03, 2026' },
                { name: 'Generated report', type: 'PDF', date: 'Sep 03, 2026' }
            ]
        }),
        buildProcurementRecord({
            id: 'rec-106',
            ownerRole: 'supplier',
            ownerOrganization: 'Kilimanjaro Supplies Limited',
            date: '2026-09-13',
            type: 'Report',
            title: 'Supplier participation report for submitted bids',
            reference: 'PX-RPT-2026-027',
            buyer: 'Rural Energy Agency',
            supplier: 'Kilimanjaro Supplies Limited',
            category: 'Reporting',
            status: 'Completed',
            value: 0,
            evidenceItems: ['Report', 'Bids', 'Award'],
            timeline: [
                { title: 'Report generated', date: 'Sep 13, 2026 10:10', role: 'Supplier' }
            ],
            documents: [
                { name: 'Generated report', type: 'PDF', date: 'Sep 13, 2026' }
            ]
        })
    ];
}

function getRecordsHistoryRows() {
    const user = getRecordsHistoryCurrentUser();
    const baseRecords = getRecordsHistoryBaseRecords();
    const storedBids = getRecordsHistoryStoredArray('procurex.supplierSubmittedBids.v1')
        .map((bid, index) => buildProcurementRecord({
            id: `stored-bid-${bid.id || index}`,
            ownerRole: 'supplier',
            ownerOrganization: user.organization,
            date: bid.submittedAt || bid.savedAt || new Date().toISOString().slice(0, 10),
            type: 'Bid',
            title: bid.title || bid.tenderTitle || 'Submitted bid',
            reference: bid.tenderId || `PX-BID-2026-${String(index + 31).padStart(3, '0')}`,
            buyer: bid.buyer || bid.organization || 'Buyer',
            supplier: user.organization,
            category: bid.category || 'Bid submission',
            status: bid.status || 'Submitted',
            value: Number(bid.amount || bid.total || 0),
            evidenceItems: ['Details', 'Bids', 'Receipt', 'Compliance'],
            timeline: [
                { title: 'Bid submitted', date: formatRecordsHistoryDate(bid.submittedAt || bid.savedAt || new Date()), role: 'Supplier' }
            ],
            documents: [
                { name: 'Bid submission receipt', type: 'PDF', date: formatRecordsHistoryDate(bid.submittedAt || bid.savedAt || new Date()) }
            ]
        }));

    return [...baseRecords, ...storedBids]
        .filter(record => record.ownerRole === user.role && record.ownerOrganization === user.organization)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function getRecordsStatusBadge(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'draft') return 'records-status-draft';
    if (normalized === 'open') return 'records-status-open';
    if (normalized === 'closed') return 'records-status-closed';
    if (normalized === 'evaluation') return 'records-status-evaluation';
    if (normalized === 'awarded') return 'records-status-awarded';
    if (normalized === 'contracted') return 'records-status-contracted';
    if (normalized === 'cancelled') return 'records-status-cancelled';
    if (normalized === 'submitted') return 'records-status-submitted';
    if (normalized === 'completed') return 'records-status-completed';
    return 'records-status-archived';
}

function renderRecordsEvidence(items = []) {
    if (items.length > 5) return `<span class="records-evidence-count">${items.length} evidence items</span>`;
    const visible = items.slice(0, 4).map(item => `<span class="records-evidence-chip">${escapeRecordsHistoryHtml(item)}</span>`).join('');
    const remaining = items.length > 4 ? `<span class="records-evidence-chip muted">+${items.length - 4} more</span>` : '';
    return `<div class="records-evidence-list">${visible}${remaining}</div>`;
}

function getRecordsHistorySummary(records) {
    return {
        tenders: records.filter(record => record.type === 'Tender').length,
        bids: records.filter(record => record.type === 'Bid').length,
        contracts: records.filter(record => record.type === 'Contract').length,
        reports: records.filter(record => record.type === 'Report').length,
        compliance: records.filter(record => record.type === 'Compliance' || record.evidenceItems.includes('Compliance')).length,
        awarded: records.filter(record => record.status === 'Awarded').length,
        cancelled: records.filter(record => record.status === 'Cancelled').length,
        totalValue: records.reduce((sum, record) => sum + Number(record.value || 0), 0)
    };
}

function renderRecordsHistoryOptions(values, label) {
    return [`<option value="">${escapeRecordsHistoryHtml(label)}</option>`]
        .concat(values.map(value => `<option value="${escapeRecordsHistoryHtml(value)}">${escapeRecordsHistoryHtml(value)}</option>`))
        .join('');
}

function renderRecordsHistory() {
    const records = getRecordsHistoryRows();
    const user = getRecordsHistoryCurrentUser();
    const summary = getRecordsHistorySummary(records);

    window.recordsHistoryData = records;

    return `
        <div class="main-layout records-history-page" data-records-history-root>
            <aside class="sidebar">
                <div class="sidebar-heading">
                    <h3>Records and History</h3>
                    <div>${escapeRecordsHistoryHtml(user.organization)}</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="records-history" class="active">Records and History</a></li>
                    <li><a href="#" data-navigate="workspace-dashboard">Dashboard</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                </ul>
            </aside>

            <main class="main-content">
                <div class="journey-page records-history-shell">
                    <section class="journey-hero compact records-history-hero">
                        <div>
                            <span class="badge badge-info">${user.role === 'buyer' ? 'Buyer procurement records' : 'Supplier procurement records'}</span>
                            <h1>Records and History</h1>
                            <p>View past procurement activities, tender records, bid history, contract records, reports, and compliance evidence from your platform activity.</p>
                        </div>
                    </section>

                    <nav class="records-history-tabs" aria-label="Records and History tabs">
                        <button class="active" type="button" data-records-tab="records">Procurement Records</button>
                        <button type="button" data-records-tab="reporting">Charts &amp; Insights</button>
                    </nav>

                    <section class="records-tab-panel" data-records-panel="records">
                        <section class="journey-grid four-col records-summary-grid">
                            <div class="kpi-card"><div class="kpi-value">${summary.tenders}</div><div class="kpi-label">Tender records</div></div>
                            <div class="kpi-card"><div class="kpi-value">${summary.bids}</div><div class="kpi-label">Bid records</div></div>
                            <div class="kpi-card"><div class="kpi-value">${summary.contracts}</div><div class="kpi-label">Contracts</div></div>
                            <div class="kpi-card"><div class="kpi-value">${formatRecordsHistoryCompactValue(summary.totalValue)}</div><div class="kpi-label">Recorded value</div></div>
                        </section>

                        <section class="journey-panel records-filter-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Search and filter</span>
                                    <h2>Procurement records archive</h2>
                                </div>
                                <div class="records-heading-actions">
                                    <span class="badge badge-info" data-records-count>${records.length} records</span>
                                    <button class="btn btn-secondary" type="button" data-records-export="csv">Export CSV</button>
                                    <button class="btn btn-primary" type="button" data-records-export="records-pdf">Export PDF</button>
                                </div>
                            </div>
                            <div class="records-filter-grid">
                                <input class="form-input records-filter-search" type="search" data-records-search placeholder="Search by reference, title, buyer, supplier, or category">
                                <select class="form-input" data-records-type>${renderRecordsHistoryOptions(RECORDS_HISTORY_TYPES, 'All record types')}</select>
                                <select class="form-input" data-records-status>${renderRecordsHistoryOptions(RECORDS_HISTORY_STATUSES, 'All statuses')}</select>
                                <input class="form-input" type="date" data-records-from aria-label="From date">
                                <input class="form-input" type="date" data-records-to aria-label="To date">
                                <button class="btn btn-primary" type="button" data-records-apply>Apply filters</button>
                                <button class="btn btn-secondary" type="button" data-records-reset>Reset</button>
                            </div>
                        </section>

                        <section class="journey-panel records-table-panel">
                            <div class="data-table records-history-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th><button type="button" data-records-sort="date">Date</button></th>
                                            <th><button type="button" data-records-sort="title">Procurement Record</button></th>
                                            <th><button type="button" data-records-sort="type">Type</button></th>
                                            <th><button type="button" data-records-sort="status">Status</button></th>
                                            <th><button type="button" data-records-sort="value">Value</button></th>
                                            <th>Evidence</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody data-records-body></tbody>
                                </table>
                            </div>
                            <div class="records-pagination" data-records-pagination></div>
                        </section>
                    </section>

                    <section class="records-tab-panel" data-records-panel="reporting" hidden>
                        <section class="journey-panel records-filter-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Charts &amp; Insights</span>
                                    <h2>Procurement activity analysis</h2>
                                    <p>Visualize trends, participation, values, compliance, and award performance from your procurement records.</p>
                                </div>
                                <div class="records-heading-actions">
                                    <button class="btn btn-secondary" type="button" data-records-export="charts-pdf">Export Charts Report</button>
                                </div>
                            </div>
                            <div class="records-report-filter-grid">
                                <select class="form-input" data-report-type>${renderRecordsHistoryOptions(RECORDS_HISTORY_TYPES, 'All record types')}</select>
                                <select class="form-input" data-report-status>${renderRecordsHistoryOptions(RECORDS_HISTORY_STATUSES, 'All statuses')}</select>
                                <select class="form-input" data-report-category>${renderRecordsHistoryOptions(Array.from(new Set(records.map(record => record.category))).sort(), 'All categories')}</select>
                                <input class="form-input" type="date" data-report-from aria-label="Report from date">
                                <input class="form-input" type="date" data-report-to aria-label="Report to date">
                                <button class="btn btn-primary" type="button" data-report-apply>Apply</button>
                                <button class="btn btn-secondary" type="button" data-report-reset>Reset</button>
                            </div>
                        </section>

                        <section class="records-insight-grid" data-report-summary></section>
                        <section class="records-report-grid" data-report-charts></section>
                    </section>
                </div>
            </main>
            <div class="records-detail-backdrop" data-records-detail hidden></div>
        </div>
    `;
}

function initializeRecordsHistory() {
    const root = document.querySelector('[data-records-history-root]');
    if (!root || root.dataset.ready === 'true') return;

    const records = window.recordsHistoryData || getRecordsHistoryRows();
    const state = {
        query: '',
        type: '',
        status: '',
        from: '',
        to: '',
        reportType: '',
        reportStatus: '',
        reportCategory: '',
        reportFrom: '',
        reportTo: '',
        sortBy: 'date',
        sortDirection: 'desc',
        page: 1,
        filtered: records,
        reportRecords: records,
        reportCharts: []
    };

    const body = root.querySelector('[data-records-body]');
    const count = root.querySelector('[data-records-count]');
    const pagination = root.querySelector('[data-records-pagination]');
    const detail = root.querySelector('[data-records-detail]');

    const controls = {
        search: root.querySelector('[data-records-search]'),
        type: root.querySelector('[data-records-type]'),
        status: root.querySelector('[data-records-status]'),
        from: root.querySelector('[data-records-from]'),
        to: root.querySelector('[data-records-to]'),
        reportType: root.querySelector('[data-report-type]'),
        reportStatus: root.querySelector('[data-report-status]'),
        reportCategory: root.querySelector('[data-report-category]'),
        reportFrom: root.querySelector('[data-report-from]'),
        reportTo: root.querySelector('[data-report-to]')
    };

    const filterRecords = (source, filter) => {
        const fromTime = filter.from ? Date.parse(filter.from) : null;
        const toTime = filter.to ? Date.parse(`${filter.to}T23:59:59`) : null;
        return source.filter(record => {
            const rowTime = Date.parse(record.date);
            return (!filter.query || record.searchText.includes(filter.query))
                && (!filter.type || record.type === filter.type)
                && (!filter.status || record.status === filter.status)
                && (!filter.category || record.category === filter.category)
                && (!fromTime || rowTime >= fromTime)
                && (!toTime || rowTime <= toTime);
        });
    };

    const getFilteredRecords = () => filterRecords(records, state).sort((a, b) => {
        let aValue = a[state.sortBy];
        let bValue = b[state.sortBy];
        if (state.sortBy === 'date') {
            aValue = Date.parse(a.date) || 0;
            bValue = Date.parse(b.date) || 0;
        }
        if (state.sortBy === 'value') {
            aValue = Number(a.value || 0);
            bValue = Number(b.value || 0);
        }
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = String(bValue || '').toLowerCase();
        }
        if (aValue < bValue) return state.sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const getReportRecords = () => filterRecords(records, {
        type: state.reportType,
        status: state.reportStatus,
        category: state.reportCategory,
        from: state.reportFrom,
        to: state.reportTo
    });

    const renderPagination = () => {
        const total = state.filtered.length;
        const pageCount = Math.max(1, Math.ceil(total / RECORDS_HISTORY_PAGE_SIZE));
        const start = total ? (state.page - 1) * RECORDS_HISTORY_PAGE_SIZE + 1 : 0;
        const end = Math.min(total, state.page * RECORDS_HISTORY_PAGE_SIZE);
        const pages = Array.from({ length: pageCount }, (_, index) => index + 1).map(page => (
            `<button class="records-page-button ${page === state.page ? 'active' : ''}" type="button" data-records-page="${page}">${page}</button>`
        )).join('');
        pagination.innerHTML = `
            <span>Showing ${start}-${end} of ${total} records</span>
            <div>
                <button class="records-page-button" type="button" data-records-page="prev" ${state.page === 1 ? 'disabled' : ''}>Previous</button>
                ${pages}
                <button class="records-page-button" type="button" data-records-page="next" ${state.page === pageCount ? 'disabled' : ''}>Next</button>
            </div>
        `;
    };

    const renderTable = () => {
        const start = (state.page - 1) * RECORDS_HISTORY_PAGE_SIZE;
        const visibleRecords = state.filtered.slice(start, start + RECORDS_HISTORY_PAGE_SIZE);
        body.innerHTML = visibleRecords.length ? visibleRecords.map(record => `
            <tr>
                <td>${escapeRecordsHistoryHtml(formatRecordsHistoryDate(record.date))}</td>
                <td class="records-record-cell">
                    <strong>${escapeRecordsHistoryHtml(record.title)}</strong>
                    <span>${escapeRecordsHistoryHtml(record.reference)} &bull; ${escapeRecordsHistoryHtml(record.buyer || 'Buyer not recorded')} &bull; ${escapeRecordsHistoryHtml(record.supplier || record.category)}</span>
                </td>
                <td>${escapeRecordsHistoryHtml(record.type)}</td>
                <td><span class="records-status-badge ${getRecordsStatusBadge(record.status)}">${escapeRecordsHistoryHtml(record.status)}</span></td>
                <td>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</td>
                <td>${renderRecordsEvidence(record.evidenceItems)}</td>
                <td>
                    <div class="records-row-actions">
                        <button class="btn btn-secondary records-view-button" type="button" data-records-view="${escapeRecordsHistoryHtml(record.id)}">View</button>
                        <button class="btn btn-secondary records-view-button" type="button" data-records-export-record="${escapeRecordsHistoryHtml(record.id)}" data-records-export-kind="record">Export</button>
                    </div>
                </td>
            </tr>
        `).join('') : `
            <tr><td colspan="7" class="records-empty-state">No procurement records match the selected filters.</td></tr>
        `;
        if (count) count.textContent = `${state.filtered.length} records`;
        renderPagination();
    };

    const countBy = (source, key) => {
        const map = new Map();
        source.forEach(record => {
            const label = record[key] || 'Not recorded';
            map.set(label, (map.get(label) || 0) + 1);
        });
        return Array.from(map, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };

    const valueBy = (source, key) => {
        const map = new Map();
        source.forEach(record => {
            const label = record[key] || 'Not recorded';
            map.set(label, (map.get(label) || 0) + Number(record.value || 0));
        });
        return Array.from(map, ([label, value]) => ({ label, value, display: formatRecordsHistoryCompactValue(value) })).sort((a, b) => b.value - a.value);
    };

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartColors = ['#2f80ed', '#f5b82e', '#21a67a', '#008080', '#ef4444', '#8b5cf6'];

    const getMonthlyCounts = source => monthLabels.map((label, index) => ({
        label,
        value: source.filter(record => {
            const parsed = new Date(record.date);
            return !Number.isNaN(parsed.getTime()) && parsed.getMonth() === index;
        }).length
    }));

    const getMonthlyValue = source => monthLabels.map((label, index) => ({
        label,
        value: source.reduce((sum, record) => {
            const parsed = new Date(record.date);
            return !Number.isNaN(parsed.getTime()) && parsed.getMonth() === index ? sum + Number(record.value || 0) : sum;
        }, 0)
    }));

    const getTimelineDurationDays = record => {
        const times = (record.timeline || [])
            .map(item => Date.parse(item.date))
            .filter(time => Number.isFinite(time));
        if (times.length < 2) return null;
        return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86400000));
    };

    const getAverageTenderDuration = source => {
        const durations = source
            .filter(record => record.type === 'Tender')
            .map(getTimelineDurationDays)
            .filter(value => Number.isFinite(value));
        if (!durations.length) return 'Not enough data';
        return `${Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)} days`;
    };

    const renderInsightCard = (label, value, detail) => `
        <article class="records-insight-card">
            <span>${escapeRecordsHistoryHtml(label)}</span>
            <strong>${escapeRecordsHistoryHtml(value)}</strong>
            <em>${escapeRecordsHistoryHtml(detail)}</em>
        </article>
    `;

    const destroyReportCharts = () => {
        (state.reportCharts || []).forEach(chart => chart?.destroy?.());
        state.reportCharts = [];
    };

    const makeChart = (selector, config) => {
        const canvas = root.querySelector(selector);
        if (!canvas || typeof Chart !== 'function') return null;
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
        return new Chart(canvas, config);
    };

    const getChartBaseOptions = () => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    boxWidth: 9,
                    boxHeight: 9,
                    color: '#334155',
                    font: { size: 11, weight: 700 }
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                titleFont: { size: 12, weight: 800 },
                bodyFont: { size: 12 }
            }
        }
    });

    const renderChartFallback = (selector, rows, formatter = value => value) => {
        const host = root.querySelector(selector)?.closest('.records-chart-visual');
        if (!host) return;
        const max = Math.max(1, ...rows.map(row => row.value));
        host.innerHTML = `
            <div class="records-bar-list">
                ${rows.map(row => `
                    <div class="records-bar-row">
                        <span>${escapeRecordsHistoryHtml(row.label)}</span>
                        <div><i style="width: ${Math.max(8, (row.value / max) * 100)}%"></i></div>
                        <strong>${escapeRecordsHistoryHtml(formatter(row.value))}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    };

    const drawReportingCharts = (reportRecords, attempt = 0) => {
        destroyReportCharts();
        const statusRows = countBy(reportRecords, 'status');
        const categoryRows = valueBy(reportRecords.filter(record => record.value), 'category');
        const monthlyRows = getMonthlyCounts(reportRecords);
        const monthlyValueRows = getMonthlyValue(reportRecords.filter(record => record.value));
        const supplierRows = countBy(reportRecords.filter(record => record.supplier).map(record => ({ ...record, participant: record.supplier })), 'participant').slice(0, 5);
        const awardRows = getMonthlyCounts(reportRecords.filter(record => record.type === 'Award' || record.status === 'Awarded'));
        const cancellationRows = getMonthlyCounts(reportRecords.filter(record => record.type === 'Cancellation' || record.status === 'Cancelled'));
        const complianceCompleted = reportRecords.filter(record => record.type === 'Compliance' || record.evidenceItems.includes('Compliance')).length;
        const complianceRows = [
            { label: 'Completed evidence', value: complianceCompleted },
            { label: 'Pending or not applicable', value: Math.max(0, reportRecords.length - complianceCompleted) }
        ];

        if (typeof Chart !== 'function' && attempt < 20) {
            window.setTimeout(() => drawReportingCharts(reportRecords, attempt + 1), 150);
            return;
        }

        if (typeof Chart !== 'function') {
            renderChartFallback('[data-chart="status"]', statusRows);
            renderChartFallback('[data-chart="monthly"]', monthlyRows);
            renderChartFallback('[data-chart="category"]', categoryRows, formatRecordsHistoryCompactValue);
            renderChartFallback('[data-chart="suppliers"]', supplierRows);
            renderChartFallback('[data-chart="trends"]', awardRows);
            renderChartFallback('[data-chart="compliance"]', complianceRows);
            return;
        }

        const baseOptions = getChartBaseOptions();
        state.reportCharts = [
            makeChart('[data-chart="status"]', {
                type: 'doughnut',
                data: {
                    labels: statusRows.map(row => row.label),
                    datasets: [{ data: statusRows.map(row => row.value), backgroundColor: chartColors, borderWidth: 0 }]
                },
                options: { ...baseOptions, cutout: '58%' }
            }),
            makeChart('[data-chart="monthly"]', {
                type: 'bar',
                data: {
                    labels: monthLabels,
                    datasets: [
                        { label: 'Records', data: monthlyRows.map(row => row.value), backgroundColor: '#008080', borderRadius: 4 },
                        { label: 'Value activity', data: monthlyValueRows.map(row => row.value ? Math.max(1, Math.round(row.value / 1000000000)) : 0), backgroundColor: 'rgba(47, 128, 237, 0.28)', borderRadius: 4 }
                    ]
                },
                options: {
                    ...baseOptions,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11, weight: 700 } } },
                        y: { beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { precision: 0, color: '#64748b' } }
                    }
                }
            }),
            makeChart('[data-chart="category"]', {
                type: 'doughnut',
                data: {
                    labels: categoryRows.map(row => row.label),
                    datasets: [{ data: categoryRows.map(row => row.value), backgroundColor: ['#2f80ed', '#3bb6a9', '#8b5cf6', '#f5b82e'], borderWidth: 0 }]
                },
                options: { ...baseOptions, cutout: '62%' }
            }),
            makeChart('[data-chart="suppliers"]', {
                type: 'bar',
                data: {
                    labels: supplierRows.map(row => row.label),
                    datasets: [{ label: 'Participation', data: supplierRows.map(row => row.value), backgroundColor: '#008080', borderRadius: 4 }]
                },
                options: {
                    ...baseOptions,
                    indexAxis: 'y',
                    plugins: { ...baseOptions.plugins, legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { precision: 0, color: '#64748b' } },
                        y: { grid: { display: false }, ticks: { color: '#334155', font: { size: 11, weight: 700 } } }
                    }
                }
            }),
            makeChart('[data-chart="trends"]', {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [
                        { label: 'Awards', data: awardRows.map(row => row.value), borderColor: '#008080', backgroundColor: 'rgba(0, 128, 128, 0.12)', tension: 0.35, fill: true },
                        { label: 'Cancellations', data: cancellationRows.map(row => row.value), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.35, fill: true }
                    ]
                },
                options: {
                    ...baseOptions,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11, weight: 700 } } },
                        y: { beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { precision: 0, color: '#64748b' } }
                    }
                }
            }),
            makeChart('[data-chart="compliance"]', {
                type: 'doughnut',
                data: {
                    labels: complianceRows.map(row => row.label),
                    datasets: [{ data: complianceRows.map(row => row.value), backgroundColor: ['#21a67a', '#dbe4ea'], borderWidth: 0 }]
                },
                options: { ...baseOptions, cutout: '64%' }
            })
        ].filter(Boolean);
    };

    const renderReporting = () => {
        state.reportRecords = getReportRecords();
        const summary = getRecordsHistorySummary(state.reportRecords);
        const complianceCompleted = state.reportRecords.filter(record => record.type === 'Compliance' || record.evidenceItems.includes('Compliance')).length;
        const complianceRate = state.reportRecords.length ? Math.round((complianceCompleted / state.reportRecords.length) * 100) : 0;
        const categoryValue = valueBy(state.reportRecords.filter(record => record.value), 'category').reduce((sum, row) => sum + row.value, 0);
        const categoryRows = countBy(state.reportRecords, 'category');
        const highestValueRecord = state.reportRecords.reduce((best, record) => Number(record.value || 0) > Number(best?.value || 0) ? record : best, null);
        const supplierRows = countBy(state.reportRecords.filter(record => record.supplier).map(record => ({ ...record, participant: record.supplier })), 'participant');
        const decisions = summary.awarded + summary.cancelled;
        const awardSuccessRate = decisions ? Math.round((summary.awarded / decisions) * 100) : 0;
        const hasChartData = state.reportRecords.length > 0;

        root.querySelector('[data-report-summary]').innerHTML = `
            ${renderInsightCard('Most active category', categoryRows[0]?.label || 'No activity', categoryRows[0] ? `${categoryRows[0].value} matching records` : 'Adjust filters to compare categories')}
            ${renderInsightCard('Highest value record', highestValueRecord?.title || 'No valued record', highestValueRecord ? formatRecordsHistoryCompactValue(highestValueRecord.value) : 'No value captured')}
            ${renderInsightCard('Best supplier participation', supplierRows[0]?.label || 'No supplier activity', supplierRows[0] ? `${supplierRows[0].value} linked records` : 'No supplier-linked records')}
            ${renderInsightCard('Compliance completion', `${complianceRate}%`, `${complianceCompleted} records include compliance evidence`)}
            ${renderInsightCard('Award success rate', decisions ? `${awardSuccessRate}%` : 'Not enough data', decisions ? `${summary.awarded} awards from ${decisions} decisions` : 'No award/cancellation decisions')}
            ${renderInsightCard('Average tender duration', getAverageTenderDuration(state.reportRecords), 'Based on visible tender timelines')}
        `;

        if (!hasChartData) {
            destroyReportCharts();
            root.querySelector('[data-report-charts]').innerHTML = `
                <article class="records-chart-empty">
                    <strong>No chart data available for the selected filters.</strong>
                    <span>Reset filters or widen the date range to visualize procurement activity.</span>
                </article>
            `;
            return;
        }

        root.querySelector('[data-report-charts]').innerHTML = `
            <article class="records-chart-card">
                <div class="records-chart-heading">
                    <h3>Tenders by Status</h3>
                    <span>${state.reportRecords.length} records</span>
                </div>
                <div class="records-chart-visual records-chart-doughnut"><canvas data-chart="status"></canvas></div>
            </article>
            <article class="records-chart-card records-chart-card-wide">
                <div class="records-chart-heading">
                    <h3>Procurement Records by Month</h3>
                    <span>Records and value activity</span>
                </div>
                <div class="records-chart-visual"><canvas data-chart="monthly"></canvas></div>
            </article>
            <article class="records-chart-card">
                <div class="records-chart-heading">
                    <h3>Contract Value by Category</h3>
                    <span>${formatRecordsHistoryCompactValue(categoryValue)}</span>
                </div>
                <div class="records-chart-visual records-chart-doughnut records-chart-with-center">
                    <canvas data-chart="category"></canvas>
                    <strong>${formatRecordsHistoryCompactValue(categoryValue)}</strong>
                </div>
            </article>
            <article class="records-chart-card">
                <div class="records-chart-heading">
                    <h3>Supplier Participation</h3>
                    <span>Top visible parties</span>
                </div>
                <div class="records-chart-visual"><canvas data-chart="suppliers"></canvas></div>
            </article>
            <article class="records-chart-card">
                <div class="records-chart-heading">
                    <h3>Award vs Cancellation Trend</h3>
                    <span>Monthly movement</span>
                </div>
                <div class="records-chart-visual"><canvas data-chart="trends"></canvas></div>
            </article>
            <article class="records-chart-card">
                <div class="records-chart-heading">
                    <h3>Compliance Completion Summary</h3>
                    <span>${complianceCompleted} completed</span>
                </div>
                <div class="records-chart-visual records-chart-doughnut"><canvas data-chart="compliance"></canvas></div>
            </article>
        `;

        window.setTimeout(() => drawReportingCharts(state.reportRecords), 0);
    };

    const applyFilters = () => {
        state.query = (controls.search?.value || '').trim().toLowerCase();
        state.type = controls.type?.value || '';
        state.status = controls.status?.value || '';
        state.from = controls.from?.value || '';
        state.to = controls.to?.value || '';
        state.page = 1;
        state.filtered = getFilteredRecords();
        renderTable();
    };

    const resetFilters = () => {
        [controls.search, controls.type, controls.status, controls.from, controls.to].forEach(control => {
            if (control) control.value = '';
        });
        state.sortBy = 'date';
        state.sortDirection = 'desc';
        applyFilters();
    };

    const applyReportFilters = () => {
        state.reportType = controls.reportType?.value || '';
        state.reportStatus = controls.reportStatus?.value || '';
        state.reportCategory = controls.reportCategory?.value || '';
        state.reportFrom = controls.reportFrom?.value || '';
        state.reportTo = controls.reportTo?.value || '';
        renderReporting();
    };

    const resetReportFilters = () => {
        [controls.reportType, controls.reportStatus, controls.reportCategory, controls.reportFrom, controls.reportTo].forEach(control => {
            if (control) control.value = '';
        });
        applyReportFilters();
    };

    const switchTab = tab => {
        root.querySelectorAll('[data-records-tab]').forEach(button => button.classList.toggle('active', button.dataset.recordsTab === tab));
        root.querySelectorAll('[data-records-panel]').forEach(panel => {
            panel.hidden = panel.dataset.recordsPanel !== tab;
        });
        if (tab === 'reporting') renderReporting();
    };

    const describeFilters = () => [
        state.query ? `Search: ${state.query}` : 'Search: All',
        state.type ? `Type: ${state.type}` : 'Type: All record types',
        state.status ? `Status: ${state.status}` : 'Status: All statuses',
        state.from ? `From: ${state.from}` : 'From: Any',
        state.to ? `To: ${state.to}` : 'To: Any'
    ];

    const describeReportFilters = () => [
        state.reportType ? `Type: ${state.reportType}` : 'Type: All record types',
        state.reportStatus ? `Status: ${state.reportStatus}` : 'Status: All statuses',
        state.reportCategory ? `Category: ${state.reportCategory}` : 'Category: All categories',
        state.reportFrom ? `From: ${state.reportFrom}` : 'From: Any',
        state.reportTo ? `To: ${state.reportTo}` : 'To: Any'
    ];

    const renderReportTableRows = source => source.map(record => `
        <tr>
            <td>${escapeRecordsHistoryHtml(formatRecordsHistoryDate(record.date))}</td>
            <td>${escapeRecordsHistoryHtml(record.title)}</td>
            <td>${escapeRecordsHistoryHtml(record.reference)}</td>
            <td>${escapeRecordsHistoryHtml(record.buyer || '')}</td>
            <td>${escapeRecordsHistoryHtml(record.supplier || '')}</td>
            <td>${escapeRecordsHistoryHtml(record.category)}</td>
            <td>${escapeRecordsHistoryHtml(record.type)}</td>
            <td>${escapeRecordsHistoryHtml(record.status)}</td>
            <td>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</td>
            <td>${escapeRecordsHistoryHtml(record.evidenceItems.join(', '))}</td>
        </tr>
    `).join('');

    const renderDocumentRows = record => record.documents.map(doc => `
        <tr>
            <td>${escapeRecordsHistoryHtml(doc.name)}</td>
            <td>${escapeRecordsHistoryHtml(doc.type)}</td>
            <td>${escapeRecordsHistoryHtml(doc.date)}</td>
            <td>${escapeRecordsHistoryHtml(record.reference)}</td>
        </tr>
    `).join('');

    const renderActivityRows = record => record.procurementActivityHistory.map(item => `
        <tr>
            <td>${escapeRecordsHistoryHtml(item.time)}</td>
            <td>${escapeRecordsHistoryHtml(item.action)}</td>
            <td>${escapeRecordsHistoryHtml(item.role)}</td>
        </tr>
    `).join('');

    const renderTimelineRows = record => record.timeline.map(item => `
        <tr>
            <td>${escapeRecordsHistoryHtml(item.date)}</td>
            <td>${escapeRecordsHistoryHtml(item.title)}</td>
            <td>${escapeRecordsHistoryHtml(item.role)}</td>
        </tr>
    `).join('');

    const renderRecordSummaryTable = record => `
        <table>
            <tbody>
                <tr><th>Title</th><td>${escapeRecordsHistoryHtml(record.title)}</td></tr>
                <tr><th>Reference number</th><td>${escapeRecordsHistoryHtml(record.reference)}</td></tr>
                <tr><th>Buyer</th><td>${escapeRecordsHistoryHtml(record.buyer || '')}</td></tr>
                <tr><th>Supplier</th><td>${escapeRecordsHistoryHtml(record.supplier || '')}</td></tr>
                <tr><th>Category</th><td>${escapeRecordsHistoryHtml(record.category)}</td></tr>
                <tr><th>Status</th><td>${escapeRecordsHistoryHtml(record.status)}</td></tr>
                <tr><th>Value</th><td>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</td></tr>
                <tr><th>Created date</th><td>${escapeRecordsHistoryHtml(formatRecordsHistoryDate(record.date))}</td></tr>
            </tbody>
        </table>
    `;

    const exportCsv = () => {
        const header = ['Date', 'Procurement Record', 'Reference', 'Buyer', 'Supplier', 'Category', 'Type', 'Status', 'Value', 'Evidence items'];
        const lines = state.filtered.map(record => [
            formatRecordsHistoryDate(record.date),
            record.title,
            record.reference,
            record.buyer || '',
            record.supplier || '',
            record.category,
            record.type,
            record.status,
            formatRecordsHistoryValue(record.value),
            record.evidenceItems.join('; ')
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'procurex-procurement-records.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportPdf = async (kind = 'records', selectedRecord = null) => {
        const source = selectedRecord ? [selectedRecord] : (kind === 'charts' ? state.reportRecords : state.filtered);
        const summary = getRecordsHistorySummary(source);
        const title = selectedRecord
            ? kind === 'evidence' ? 'Evidence Summary' : kind === 'activity' ? 'Procurement Activity History' : 'Procurement Record History'
            : kind === 'charts' ? 'Charts & Insights Report' : 'Procurement Records Archive';
        const categoryRows = countBy(source, 'category');
        const statusRows = countBy(source, 'status');
        const supplierRows = countBy(source.filter(record => record.supplier).map(record => ({ ...record, participant: record.supplier })), 'participant');
        const complianceCompleted = source.filter(record => record.type === 'Compliance' || record.evidenceItems.includes('Compliance')).length;
        const report = document.createElement('div');
        report.className = 'records-pdf-report';

        if (selectedRecord && kind === 'evidence') {
            report.innerHTML = `
                <h1>Evidence Summary</h1>
                <p>Generated date: ${escapeRecordsHistoryHtml(new Date().toLocaleString('en-US'))}</p>
                <h2>${escapeRecordsHistoryHtml(selectedRecord.title)}</h2>
                <p>${escapeRecordsHistoryHtml(selectedRecord.reference)}</p>
                <table>
                    <thead><tr><th>Document name</th><th>Document type</th><th>Date</th><th>Related record reference</th></tr></thead>
                    <tbody>${renderDocumentRows(selectedRecord)}</tbody>
                </table>
            `;
        } else if (selectedRecord && kind === 'activity') {
            report.innerHTML = `
                <h1>Procurement Activity History</h1>
                <p>Generated date: ${escapeRecordsHistoryHtml(new Date().toLocaleString('en-US'))}</p>
                <h2>${escapeRecordsHistoryHtml(selectedRecord.title)}</h2>
                <p>${escapeRecordsHistoryHtml(selectedRecord.reference)}</p>
                <table>
                    <thead><tr><th>Time</th><th>Procurement Action</th><th>Role</th></tr></thead>
                    <tbody>${renderActivityRows(selectedRecord)}</tbody>
                </table>
            `;
        } else if (selectedRecord) {
            report.innerHTML = `
                <h1>Procurement Record History</h1>
                <p>Generated date: ${escapeRecordsHistoryHtml(new Date().toLocaleString('en-US'))}</p>
                <h2>Record Summary</h2>
                ${renderRecordSummaryTable(selectedRecord)}
                <h2>Procurement Timeline</h2>
                <table>
                    <thead><tr><th>Date/time</th><th>Event</th><th>Role</th></tr></thead>
                    <tbody>${renderTimelineRows(selectedRecord)}</tbody>
                </table>
                <h2>Evidence/Documents</h2>
                <table>
                    <thead><tr><th>Document name</th><th>Document type</th><th>Date</th><th>Related record reference</th></tr></thead>
                    <tbody>${renderDocumentRows(selectedRecord)}</tbody>
                </table>
                <h2>Procurement Activity History</h2>
                <table>
                    <thead><tr><th>Time</th><th>Procurement Action</th><th>Role</th></tr></thead>
                    <tbody>${renderActivityRows(selectedRecord)}</tbody>
                </table>
            `;
        } else if (kind === 'charts') {
            report.innerHTML = `
                <h1>Charts &amp; Insights Report</h1>
                <p>Generated date: ${escapeRecordsHistoryHtml(new Date().toLocaleString('en-US'))}</p>
                <h2>Applied chart filters</h2>
                <ul>${describeReportFilters().map(filter => `<li>${escapeRecordsHistoryHtml(filter)}</li>`).join('')}</ul>
                <h2>Procurement analysis summary</h2>
                <p>${source.length} records analyzed | ${summary.awarded} awarded | ${summary.cancelled} cancelled | ${complianceCompleted} compliance-linked records | ${formatRecordsHistoryValue(summary.totalValue)}</p>
                <h2>Tenders by status</h2>
                <table><thead><tr><th>Status</th><th>Records</th></tr></thead><tbody>${statusRows.map(row => `<tr><td>${escapeRecordsHistoryHtml(row.label)}</td><td>${row.value}</td></tr>`).join('')}</tbody></table>
                <h2>Contract value by category</h2>
                <table><thead><tr><th>Category</th><th>Value</th></tr></thead><tbody>${valueBy(source.filter(record => record.value), 'category').map(row => `<tr><td>${escapeRecordsHistoryHtml(row.label)}</td><td>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(row.value))}</td></tr>`).join('')}</tbody></table>
                <h2>Supplier participation</h2>
                <table><thead><tr><th>Supplier</th><th>Linked records</th></tr></thead><tbody>${supplierRows.map(row => `<tr><td>${escapeRecordsHistoryHtml(row.label)}</td><td>${row.value}</td></tr>`).join('')}</tbody></table>
            `;
        } else {
            report.innerHTML = `
                <h1>Procurement Records Archive</h1>
                <p>Generated date: ${escapeRecordsHistoryHtml(new Date().toLocaleString('en-US'))}</p>
                <h2>Applied filters</h2>
                <ul>${describeFilters().map(filter => `<li>${escapeRecordsHistoryHtml(filter)}</li>`).join('')}</ul>
                <h2>Summary totals</h2>
                <p>Total records exported: ${source.length} | Tenders: ${summary.tenders} | Bids: ${summary.bids} | Contracts: ${summary.contracts} | Recorded value: ${formatRecordsHistoryValue(summary.totalValue)}</p>
                <h2>Records table</h2>
                <table>
                    <thead><tr><th>Date</th><th>Procurement Record</th><th>Reference</th><th>Buyer</th><th>Supplier</th><th>Category</th><th>Type</th><th>Status</th><th>Value</th><th>Evidence items</th></tr></thead>
                    <tbody>${renderReportTableRows(source)}</tbody>
                </table>
            `;
        }

        document.body.appendChild(report);
        if (typeof html2pdf === 'function') {
            await html2pdf().set({
                margin: 10,
                filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            }).from(report).save();
        } else {
            window.print();
        }
        report.remove();
    };

    const renderDetail = record => {
        detail.hidden = false;
        detail.innerHTML = `
            <section class="records-detail-modal" role="dialog" aria-modal="true" aria-label="Procurement record details">
                <div class="records-detail-header">
                    <div>
                        <span class="records-status-badge ${getRecordsStatusBadge(record.status)}">${escapeRecordsHistoryHtml(record.status)}</span>
                        <h2>${escapeRecordsHistoryHtml(record.title)}</h2>
                        <p>${escapeRecordsHistoryHtml(record.reference)} &bull; ${escapeRecordsHistoryHtml(record.buyer)} &bull; ${escapeRecordsHistoryHtml(record.supplier || record.category)}</p>
                    </div>
                    <div class="records-detail-actions">
                        <button class="btn btn-primary" type="button" data-records-export-record="${escapeRecordsHistoryHtml(record.id)}" data-records-export-kind="record">Export Record PDF</button>
                        <button class="btn btn-secondary" type="button" data-records-export-record="${escapeRecordsHistoryHtml(record.id)}" data-records-export-kind="evidence">Export Evidence Summary</button>
                        <button class="btn btn-secondary" type="button" data-records-export-record="${escapeRecordsHistoryHtml(record.id)}" data-records-export-kind="activity">Export Activity History</button>
                        <button class="btn btn-secondary" type="button" data-records-close>Close</button>
                    </div>
                </div>
                <div class="records-detail-grid">
                    <article class="records-detail-section records-summary-section">
                        <h3>Record Summary</h3>
                        <dl>
                            <div><dt>Title</dt><dd>${escapeRecordsHistoryHtml(record.title)}</dd></div>
                            <div><dt>Reference number</dt><dd>${escapeRecordsHistoryHtml(record.reference)}</dd></div>
                            <div><dt>${record.ownerRole === 'buyer' ? 'Supplier' : 'Buyer'}</dt><dd>${escapeRecordsHistoryHtml(record.ownerRole === 'buyer' ? (record.supplier || 'Multiple suppliers') : record.buyer)}</dd></div>
                            <div><dt>Procurement classification</dt><dd>${escapeRecordsHistoryHtml(record.category)}</dd></div>
                            <div><dt>Status</dt><dd>${escapeRecordsHistoryHtml(record.status)}</dd></div>
                            <div><dt>Value</dt><dd>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</dd></div>
                            <div><dt>Created date</dt><dd>${escapeRecordsHistoryHtml(formatRecordsHistoryDate(record.date))}</dd></div>
                        </dl>
                    </article>
                    <article class="records-detail-section">
                        <h3>Procurement Timeline</h3>
                        <ol class="records-timeline">
                            ${record.timeline.map(item => `<li><strong>${escapeRecordsHistoryHtml(item.title)}</strong><span>${escapeRecordsHistoryHtml(item.date)} &bull; ${escapeRecordsHistoryHtml(item.role)}</span></li>`).join('')}
                        </ol>
                    </article>
                    <article class="records-detail-section">
                        <h3>Evidence/Documents</h3>
                        <div class="data-table records-detail-table">
                            <table>
                                <thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Action</th></tr></thead>
                                <tbody>${record.documents.map(doc => `<tr><td>${escapeRecordsHistoryHtml(doc.name)}</td><td>${escapeRecordsHistoryHtml(doc.type)}</td><td>${escapeRecordsHistoryHtml(doc.date)}</td><td><button class="btn btn-secondary records-view-button" type="button">View</button></td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </article>
                    <article class="records-detail-section">
                        <h3>Procurement Activity History</h3>
                        <div class="data-table records-detail-table">
                            <table>
                                <thead><tr><th>Time</th><th>Procurement Action</th><th>Role</th></tr></thead>
                                <tbody>${record.procurementActivityHistory.map(item => `<tr><td>${escapeRecordsHistoryHtml(item.time)}</td><td>${escapeRecordsHistoryHtml(item.action)}</td><td>${escapeRecordsHistoryHtml(item.role)}</td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </article>
                </div>
            </section>
        `;
    };

    root.addEventListener('click', event => {
        const tabButton = event.target.closest('[data-records-tab]');
        const applyButton = event.target.closest('[data-records-apply]');
        const resetButton = event.target.closest('[data-records-reset]');
        const reportApply = event.target.closest('[data-report-apply]');
        const reportReset = event.target.closest('[data-report-reset]');
        const sortButton = event.target.closest('[data-records-sort]');
        const pageButton = event.target.closest('[data-records-page]');
        const viewButton = event.target.closest('[data-records-view]');
        const closeButton = event.target.closest('[data-records-close]');
        const exportButton = event.target.closest('[data-records-export]');
        const recordExportButton = event.target.closest('[data-records-export-record]');

        if (tabButton) switchTab(tabButton.dataset.recordsTab);
        if (applyButton) applyFilters();
        if (resetButton) resetFilters();
        if (reportApply) applyReportFilters();
        if (reportReset) resetReportFilters();
        if (sortButton) {
            const sortBy = sortButton.dataset.recordsSort;
            state.sortDirection = state.sortBy === sortBy && state.sortDirection === 'asc' ? 'desc' : 'asc';
            state.sortBy = sortBy;
            state.filtered = getFilteredRecords();
            renderTable();
        }
        if (pageButton) {
            const pageCount = Math.max(1, Math.ceil(state.filtered.length / RECORDS_HISTORY_PAGE_SIZE));
            if (pageButton.dataset.recordsPage === 'prev') state.page = Math.max(1, state.page - 1);
            else if (pageButton.dataset.recordsPage === 'next') state.page = Math.min(pageCount, state.page + 1);
            else state.page = Number(pageButton.dataset.recordsPage);
            renderTable();
        }
        if (viewButton) {
            const record = records.find(item => item.id === viewButton.dataset.recordsView);
            if (record) renderDetail(record);
        }
        if (recordExportButton) {
            const record = records.find(item => item.id === recordExportButton.dataset.recordsExportRecord);
            if (record) exportPdf(recordExportButton.dataset.recordsExportKind || 'record', record);
        }
        if (closeButton || event.target === detail) {
            detail.hidden = true;
            detail.innerHTML = '';
        }
        if (exportButton?.dataset.recordsExport === 'csv') exportCsv();
        if (exportButton?.dataset.recordsExport === 'records-pdf') exportPdf('records');
        if (exportButton?.dataset.recordsExport === 'charts-pdf') exportPdf('charts');
    });

    root.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('[data-records-search]')) applyFilters();
        if (event.key === 'Escape' && !detail.hidden) {
            detail.hidden = true;
            detail.innerHTML = '';
        }
    });

    applyFilters();
    renderReporting();
    root.dataset.ready = 'true';
}

window.initializeRecordsHistory = initializeRecordsHistory;

if (window.app) {
    window.app.renderRecordsHistory = renderRecordsHistory;
}
