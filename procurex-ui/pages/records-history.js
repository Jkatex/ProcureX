// Records and History app for tenders, bids, contracts, and compliance-grade audit exports.

const RECORDS_HISTORY_PAGE_SIZE = 10;

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

function getRecordsHistoryStoredBids() {
    try {
        const parsed = JSON.parse(localStorage.getItem('procurex.supplierSubmittedBids.v1') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function createRecordsTimeline(date, status, type) {
    const baseDate = Date.parse(date) || Date.parse('2026-05-01');
    const addDays = days => new Date(baseDate + days * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const events = [
        { title: `${type} created`, date: `${addDays(0)} 09:15`, user: 'Procurement Officer' },
        { title: `${type} reviewed`, date: `${addDays(1)} 11:30`, user: 'Procurement Manager' }
    ];
    if (/Tender/i.test(type)) {
        events.push(
            { title: 'Tender published', date: `${addDays(2)} 10:00`, user: 'Publishing Officer' },
            { title: 'Clarification added', date: `${addDays(8)} 14:20`, user: 'Evaluation Secretary' },
            { title: 'Bid opening completed', date: `${addDays(18)} 09:00`, user: 'Opening Committee' }
        );
    }
    if (/Awarded|Contracted|Archived/i.test(status)) {
        events.push({ title: 'Award decision made', date: `${addDays(24)} 15:45`, user: 'Tender Board' });
    }
    if (/Contract|Contracted/i.test(type) || /Contracted/i.test(status)) {
        events.push({ title: 'Contract created', date: `${addDays(30)} 10:10`, user: 'Contract Manager' });
    }
    if (/Cancelled/i.test(status)) {
        events.push({ title: 'Cancellation recorded', date: `${addDays(16)} 16:05`, user: 'Accounting Officer' });
    }
    return events;
}

function createRecordsDocuments(date, type, status) {
    const formattedDate = formatRecordsHistoryDate(date);
    const docs = [
        { name: `${type} details`, type: 'PDF', date: formattedDate },
        { name: 'Compliance evidence', type: 'PDF', date: formattedDate }
    ];
    if (/Tender/i.test(type)) docs.push({ name: 'Tender notice', type: 'PDF', date: formattedDate }, { name: 'Bid opening report', type: 'PDF', date: formattedDate });
    if (/Awarded|Contracted|Archived/i.test(status)) docs.push({ name: 'Award notice', type: 'PDF', date: formattedDate });
    if (/Contract|Contracted/i.test(type) || /Contracted/i.test(status)) docs.push({ name: 'Contract document', type: 'PDF', date: formattedDate });
    if (/Cancelled/i.test(status)) docs.push({ name: 'Cancellation note', type: 'PDF', date: formattedDate });
    return docs;
}

function buildRecordsHistoryRecord(record) {
    const party = record.buyer || record.supplier || record.owner || 'Not recorded';
    const evidenceItems = record.evidenceItems || ['Details', 'Bids', 'Opening', 'Award', 'Contract', 'Compliance'];
    const timeline = record.timeline || createRecordsTimeline(record.date, record.status, record.type);
    return {
        id: record.id,
        date: record.date,
        type: record.type,
        title: record.title,
        reference: record.reference,
        buyer: record.buyer || party,
        supplier: record.supplier || '',
        status: record.status,
        value: Number(record.value || record.amount || 0),
        classification: record.classification || record.category || record.type,
        evidenceItems,
        timeline,
        documents: record.documents || createRecordsDocuments(record.date, record.type, record.status),
        activityLog: record.activityLog || timeline.map(item => ({ time: item.date, action: item.title, user: item.user })),
        searchText: [
            record.reference,
            record.title,
            party,
            record.type,
            record.status,
            record.classification || record.category,
            evidenceItems.join(' ')
        ].join(' ').toLowerCase()
    };
}

function getRecordsHistorySeedRecords(count = 51) {
    const buyers = [
        'Rural Energy Agency',
        'Ministry of Health',
        'Dar es Salaam Water Authority',
        'Tanzania Ports Authority',
        'National Roads Agency',
        'Public Procurement Office',
        'Regional Medical Stores',
        'Municipal Education Board'
    ];
    const titles = [
        'Solar Mini-Grid Civil Works and Distribution Network',
        'District Maternal Health Wing Construction',
        'Framework Supply of Medical Consumables',
        'Port Access Control Upgrade',
        'Feeder Road Rehabilitation Package',
        'Procurement Compliance Evidence Review',
        'School Connectivity Equipment Supply',
        'Water Treatment Plant Maintenance'
    ];
    const types = ['Tender', 'Bid', 'Contract', 'Amendment', 'Award', 'Cancellation', 'Clarification', 'Compliance'];
    const statuses = ['Draft', 'Open', 'Closed', 'Evaluation', 'Awarded', 'Contracted', 'Cancelled', 'Archived'];
    const evidenceSets = [
        ['Details', 'Bids', 'Opening', 'Award', 'Contract', 'Compliance'],
        ['Details', 'Clarification', 'Amendment', 'Opening'],
        ['Notice', 'Evaluation', 'Award', 'Contract'],
        ['Details', 'Cancellation', 'Approval'],
        ['Details', 'Compliance', 'Review', 'Attachments']
    ];

    return Array.from({ length: count }, (_, index) => {
        const type = types[index % types.length];
        const status = statuses[index % statuses.length];
        const date = new Date(Date.UTC(2026, 4 - Math.floor(index / 12), 22 - (index % 24))).toISOString().slice(0, 10);
        const buyer = buyers[index % buyers.length];
        const title = titles[index % titles.length];
        const referencePrefix = type.slice(0, 3).toUpperCase();
        return buildRecordsHistoryRecord({
            id: `rec-${String(index + 1).padStart(3, '0')}`,
            date,
            type,
            title,
            reference: `PX-${referencePrefix}-2026-${String(index + 1).padStart(3, '0')}`,
            buyer,
            status,
            value: index % 6 === 0 ? 0 : 240000000 + (index + 1) * 87500000,
            classification: type === 'Contract' ? 'Works contract' : type === 'Bid' ? 'Bid submission' : `${type} record`,
            evidenceItems: evidenceSets[index % evidenceSets.length]
        });
    });
}

function getRecordsHistoryRows() {
    const tenders = typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : (mockData.tenders || []);
    const tenderRows = tenders.map((tender, index) => buildRecordsHistoryRecord({
        id: `tender-${tender.id || index}`,
        date: tender.publishedAt || tender.closingDate || '2026-05-18',
        type: 'Tender',
        reference: tender.id || `PX-TDR-2026-${String(index + 1).padStart(3, '0')}`,
        title: tender.title || 'Tender record',
        status: tender.status === 'Open' && Date.parse(`${tender.closingDate}T23:59:59`) < Date.now() ? 'Closed' : (tender.status || 'Draft'),
        classification: tender.type || tender.category || 'Tender',
        value: Number(tender.budget || 0),
        buyer: tender.organization || 'Not recorded',
        evidenceItems: ['Details', 'Bids', 'Opening', 'Award', 'Contract', 'Compliance']
    }));

    const bidRows = getRecordsHistoryStoredBids().map((bid, index) => buildRecordsHistoryRecord({
        id: `bid-${bid.id || index}`,
        date: bid.submittedAt || bid.savedAt || new Date().toISOString().slice(0, 10),
        type: 'Bid',
        reference: bid.tenderId || `BID-${String(index + 1).padStart(3, '0')}`,
        title: bid.title || bid.tenderTitle || 'Submitted bid',
        status: bid.status === 'Submitted' ? 'Closed' : (bid.status || 'Closed'),
        classification: 'Bid submission',
        value: Number(bid.amount || bid.total || 0),
        supplier: mockData.users?.current?.organization || mockData.pendingAccount?.displayName || 'Current account',
        evidenceItems: ['Response', 'Receipt', 'Attachments', 'Clarifications']
    }));

    const merged = [...tenderRows, ...bidRows];
    const unique = new Map();
    merged.forEach(record => unique.set(record.id, record));
    getRecordsHistorySeedRecords(Math.max(0, 51 - unique.size)).forEach(record => unique.set(record.id, record));
    return Array.from(unique.values()).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
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
    if (normalized === 'archived') return 'records-status-archived';
    return 'records-status-archived';
}

function renderRecordsEvidence(items = []) {
    const visible = items.slice(0, 3).map(item => `<span class="records-evidence-chip">${escapeRecordsHistoryHtml(item)}</span>`).join('');
    const remaining = items.length > 3 ? `<span class="records-evidence-chip muted">+${items.length - 3} more</span>` : '';
    return `<div class="records-evidence-list">${visible}${remaining}</div>`;
}

function renderRecordsHistory() {
    const records = getRecordsHistoryRows();
    const tenders = records.filter(record => record.type === 'Tender').length;
    const bids = records.filter(record => record.type === 'Bid').length;
    const contracts = records.filter(record => record.type === 'Contract').length;
    const totalAmount = records.reduce((sum, record) => sum + Number(record.value || 0), 0);
    const isAdmin = mockData.pendingAccount?.accountType === 'admin' || mockData.session?.accountType === 'admin';

    window.recordsHistoryData = records;

    return `
        <div class="main-layout records-history-page" data-records-history-root>
            <aside class="sidebar">
                <div class="sidebar-heading">
                    <h3>Records and History</h3>
                    <div>${isAdmin ? 'Platform-wide audit' : 'Account archive'}</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="records-history" class="active">Records</a></li>
                    <li><a href="#" data-navigate="${isAdmin ? 'admin-dashboard' : 'workspace-dashboard'}">${isAdmin ? 'Compliance Dashboard' : 'Dashboard'}</a></li>
                    ${isAdmin ? '<li><a href="#" data-navigate="admin-search">Admin Deep Search</a></li>' : ''}
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                </ul>
            </aside>

            <main class="main-content">
                <div class="journey-page">
                    <section class="journey-hero compact records-history-hero">
                        <div>
                            <span class="badge badge-info">${isAdmin ? 'Audit records' : 'Records app'}</span>
                            <h1>Records and History</h1>
                            <p>Track procurement activity, tender decisions, bid submissions, awards, contracts, and audit evidence in one searchable archive.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-records-export="csv">Export CSV</button>
                            <button class="btn btn-primary" type="button" data-records-export="pdf">Export PDF</button>
                        </div>
                    </section>

                    <section class="journey-grid four-col records-summary-grid">
                        <div class="kpi-card"><div class="kpi-value">${tenders}</div><div class="kpi-label">Tender records</div></div>
                        <div class="kpi-card"><div class="kpi-value">${bids}</div><div class="kpi-label">Bid records</div></div>
                        <div class="kpi-card"><div class="kpi-value">${contracts}</div><div class="kpi-label">Contracts</div></div>
                        <div class="kpi-card"><div class="kpi-value">TZS ${(totalAmount / 1000000000).toFixed(1)}B</div><div class="kpi-label">Recorded value</div></div>
                    </section>

                    <section class="journey-panel records-filter-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Search and filter</span>
                                <h2>Audit archive</h2>
                            </div>
                            <span class="badge badge-info" data-records-count>${records.length} records</span>
                        </div>
                        <div class="records-filter-grid">
                            <input class="form-input records-filter-search" type="search" data-records-search placeholder="Search by reference, title, buyer, or supplier">
                            <select class="form-input" data-records-type>
                                <option value="">All record types</option>
                                ${Array.from(new Set(records.map(record => record.type))).sort().map(type => `<option>${escapeRecordsHistoryHtml(type)}</option>`).join('')}
                            </select>
                            <select class="form-input" data-records-status>
                                <option value="">All statuses</option>
                                ${['Draft', 'Open', 'Closed', 'Evaluation', 'Awarded', 'Contracted', 'Cancelled', 'Archived'].map(status => `<option>${status}</option>`).join('')}
                            </select>
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
                                        <th><button type="button" data-records-sort="title">Record</button></th>
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
        sortBy: 'date',
        sortDirection: 'desc',
        page: 1,
        filtered: records
    };

    const body = root.querySelector('[data-records-body]');
    const count = root.querySelector('[data-records-count]');
    const pagination = root.querySelector('[data-records-pagination]');
    const search = root.querySelector('[data-records-search]');
    const type = root.querySelector('[data-records-type]');
    const status = root.querySelector('[data-records-status]');
    const from = root.querySelector('[data-records-from]');
    const to = root.querySelector('[data-records-to]');
    const detail = root.querySelector('[data-records-detail]');

    const getFilteredRecords = () => {
        const fromTime = state.from ? Date.parse(state.from) : null;
        const toTime = state.to ? Date.parse(`${state.to}T23:59:59`) : null;
        return records.filter(record => {
            const rowTime = Date.parse(record.date);
            return (!state.query || record.searchText.includes(state.query))
                && (!state.type || record.type === state.type)
                && (!state.status || record.status === state.status)
                && (!fromTime || rowTime >= fromTime)
                && (!toTime || rowTime <= toTime);
        }).sort((a, b) => {
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
    };

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
                    <span>${escapeRecordsHistoryHtml(record.reference)} &bull; ${escapeRecordsHistoryHtml(record.buyer || record.supplier)}</span>
                </td>
                <td>${escapeRecordsHistoryHtml(record.type)}</td>
                <td><span class="records-status-badge ${getRecordsStatusBadge(record.status)}">${escapeRecordsHistoryHtml(record.status)}</span></td>
                <td>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</td>
                <td>${renderRecordsEvidence(record.evidenceItems)}</td>
                <td><button class="btn btn-secondary records-view-button" type="button" data-records-view="${escapeRecordsHistoryHtml(record.id)}">View</button></td>
            </tr>
        `).join('') : `
            <tr><td colspan="7" class="records-empty-state">No records match the selected filters.</td></tr>
        `;
        if (count) count.textContent = `${state.filtered.length} records`;
        renderPagination();
    };

    const applyFilters = () => {
        state.query = (search?.value || '').trim().toLowerCase();
        state.type = type?.value || '';
        state.status = status?.value || '';
        state.from = from?.value || '';
        state.to = to?.value || '';
        state.page = 1;
        state.filtered = getFilteredRecords();
        renderTable();
    };

    const resetFilters = () => {
        [search, type, status, from, to].forEach(control => {
            if (control) control.value = '';
        });
        state.sortBy = 'date';
        state.sortDirection = 'desc';
        applyFilters();
    };

    const renderDetail = record => {
        detail.hidden = false;
        detail.innerHTML = `
            <section class="records-detail-modal" role="dialog" aria-modal="true" aria-label="Record details">
                <div class="records-detail-header">
                    <div>
                        <span class="records-status-badge ${getRecordsStatusBadge(record.status)}">${escapeRecordsHistoryHtml(record.status)}</span>
                        <h2>${escapeRecordsHistoryHtml(record.title)}</h2>
                        <p>${escapeRecordsHistoryHtml(record.reference)} &bull; ${escapeRecordsHistoryHtml(record.buyer || record.supplier)}</p>
                    </div>
                    <button class="btn btn-secondary" type="button" data-records-close>Close</button>
                </div>
                <div class="records-detail-grid">
                    <article class="records-detail-section records-summary-section">
                        <h3>Record Summary</h3>
                        <dl>
                            <div><dt>Reference number</dt><dd>${escapeRecordsHistoryHtml(record.reference)}</dd></div>
                            <div><dt>Buyer/supplier</dt><dd>${escapeRecordsHistoryHtml(record.buyer || record.supplier)}</dd></div>
                            <div><dt>Procurement type</dt><dd>${escapeRecordsHistoryHtml(record.classification)}</dd></div>
                            <div><dt>Status</dt><dd>${escapeRecordsHistoryHtml(record.status)}</dd></div>
                            <div><dt>Value</dt><dd>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</dd></div>
                            <div><dt>Created date</dt><dd>${escapeRecordsHistoryHtml(formatRecordsHistoryDate(record.date))}</dd></div>
                        </dl>
                    </article>
                    <article class="records-detail-section">
                        <h3>Timeline</h3>
                        <ol class="records-timeline">
                            ${record.timeline.map(item => `<li><strong>${escapeRecordsHistoryHtml(item.title)}</strong><span>${escapeRecordsHistoryHtml(item.date)} &bull; ${escapeRecordsHistoryHtml(item.user)}</span></li>`).join('')}
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
                        <h3>Activity Log</h3>
                        <div class="data-table records-detail-table">
                            <table>
                                <thead><tr><th>Time</th><th>Action</th><th>User</th></tr></thead>
                                <tbody>${record.activityLog.map(item => `<tr><td>${escapeRecordsHistoryHtml(item.time)}</td><td>${escapeRecordsHistoryHtml(item.action)}</td><td>${escapeRecordsHistoryHtml(item.user)}</td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </article>
                </div>
            </section>
        `;
    };

    const describeFilters = () => [
        state.query ? `Search: ${state.query}` : 'Search: All',
        state.type ? `Type: ${state.type}` : 'Type: All record types',
        state.status ? `Status: ${state.status}` : 'Status: All statuses',
        state.from ? `From: ${state.from}` : 'From: Any',
        state.to ? `To: ${state.to}` : 'To: Any'
    ];

    const exportCsv = () => {
        const header = ['Date', 'Record', 'Type', 'Status', 'Value', 'Evidence'];
        const lines = state.filtered.map(record => [
            formatRecordsHistoryDate(record.date),
            `${record.title} (${record.reference}) - ${record.buyer || record.supplier}`,
            record.type,
            record.status,
            formatRecordsHistoryValue(record.value),
            record.evidenceItems.join('; ')
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'procurex-records-history.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportPdf = async () => {
        const report = document.createElement('div');
        report.className = 'records-pdf-report';
        report.innerHTML = `
            <h1>Records and History</h1>
            <p>Procurement audit archive report</p>
            <h2>Applied filters</h2>
            <ul>${describeFilters().map(filter => `<li>${escapeRecordsHistoryHtml(filter)}</li>`).join('')}</ul>
            <h2>Summary totals</h2>
            <p>${state.filtered.length} records | ${state.filtered.filter(record => record.type === 'Tender').length} tenders | ${state.filtered.filter(record => record.type === 'Bid').length} bids | ${state.filtered.filter(record => record.type === 'Contract').length} contracts | ${formatRecordsHistoryValue(state.filtered.reduce((sum, record) => sum + Number(record.value || 0), 0))}</p>
            <h2>Filtered records</h2>
            <table>
                <thead><tr><th>Date</th><th>Record</th><th>Type</th><th>Status</th><th>Value</th><th>Evidence</th></tr></thead>
                <tbody>${state.filtered.map(record => `<tr><td>${escapeRecordsHistoryHtml(formatRecordsHistoryDate(record.date))}</td><td><strong>${escapeRecordsHistoryHtml(record.title)}</strong><br>${escapeRecordsHistoryHtml(record.reference)} &bull; ${escapeRecordsHistoryHtml(record.buyer || record.supplier)}</td><td>${escapeRecordsHistoryHtml(record.type)}</td><td>${escapeRecordsHistoryHtml(record.status)}</td><td>${escapeRecordsHistoryHtml(formatRecordsHistoryValue(record.value))}</td><td>${escapeRecordsHistoryHtml(record.evidenceItems.length)} items</td></tr>`).join('')}</tbody>
            </table>
        `;
        document.body.appendChild(report);
        if (typeof html2pdf === 'function') {
            await html2pdf().set({
                margin: 10,
                filename: 'procurex-records-history.pdf',
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            }).from(report).save();
        } else {
            window.print();
        }
        report.remove();
    };

    root.addEventListener('click', event => {
        const applyButton = event.target.closest('[data-records-apply]');
        const resetButton = event.target.closest('[data-records-reset]');
        const sortButton = event.target.closest('[data-records-sort]');
        const pageButton = event.target.closest('[data-records-page]');
        const viewButton = event.target.closest('[data-records-view]');
        const closeButton = event.target.closest('[data-records-close]');
        const exportButton = event.target.closest('[data-records-export]');

        if (applyButton) applyFilters();
        if (resetButton) resetFilters();
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
        if (closeButton || event.target === detail) {
            detail.hidden = true;
            detail.innerHTML = '';
        }
        if (exportButton?.dataset.recordsExport === 'csv') exportCsv();
        if (exportButton?.dataset.recordsExport === 'pdf') exportPdf();
    });

    root.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('[data-records-search]')) applyFilters();
        if (event.key === 'Escape' && !detail.hidden) {
            detail.hidden = true;
            detail.innerHTML = '';
        }
    });

    applyFilters();
    root.dataset.ready = 'true';
}

window.initializeRecordsHistory = initializeRecordsHistory;

if (window.app) {
    window.app.renderRecordsHistory = renderRecordsHistory;
}
