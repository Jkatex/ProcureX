// Records and History app for tenders, bids, contracts, and compliance-grade audit exports.

function escapeRecordsHistoryHtml(value = '') {
    return String(value)
        .replace(/and/g, 'andamp;')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function getRecordsHistoryStoredBids() {
    try {
        const parsed = JSON.parse(localStorage.getItem('procurex.supplierSubmittedBids.v1') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function getRecordsHistoryRows() {
    const tenders = typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : (mockData.tenders || []);
    const tenderRows = tenders.map(tender => ({
        date: tender.publishedAt || tender.closingDate || '2026-05-18',
        type: 'Tender',
        reference: tender.id,
        title: tender.title,
        status: tender.status === 'Open' && Date.parse(`${tender.closingDate}T23:59:59`) < Date.now() ? 'Closed by timeline' : tender.status,
        category: tender.type || tender.category || 'Tender',
        amount: Number(tender.budget || 0),
        owner: tender.organization || 'Not recorded',
        contents: 'Details, amendments, clarifications, bids, opening report, award or cancellation notes',
        nav: tender.createdByCurrentUser ? 'tender-details' : 'tender-detail'
    }));

    const bidRows = getRecordsHistoryStoredBids().map((bid, index) => ({
        date: bid.submittedAt || bid.savedAt || new Date().toISOString(),
        type: 'Bid',
        reference: bid.tenderId || `BID-${index + 1}`,
        title: bid.title || bid.tenderTitle || 'Submitted bid',
        status: bid.status || 'Submitted',
        category: 'Bid submission',
        amount: Number(bid.amount || bid.total || 0),
        owner: mockData.users?.current?.organization || mockData.pendingAccount?.displayName || 'Current account',
        contents: 'Submitted response, receipt hash, attachments, clarification history',
        nav: 'bidding-workspace'
    }));

    const contractRows = [
        {
            date: '2026-07-02',
            type: 'Contract',
            reference: 'CTR-PX-2026-001',
            title: 'Construction of District Maternal Health Wing',
            status: 'Active',
            category: 'Works contract',
            amount: 6420000000,
            owner: 'BuildRight Ltd',
            contents: 'Signed contract, milestones, GRNs, invoices, performance notes',
            nav: 'post-award-tracking'
        }
    ];

    return [...tenderRows, ...bidRows, ...contractRows].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function getRecordsStatusBadge(status) {
    if (/award|active|completed|submitted/i.test(status)) return 'badge-success';
    if (/cancel|terminat|deleted/i.test(status)) return 'badge-error';
    if (/evaluation|pending|review|closed/i.test(status)) return 'badge-warning';
    return 'badge-info';
}

function renderRecordsHistory() {
    const records = getRecordsHistoryRows();
    const tenders = records.filter(record => record.type === 'Tender').length;
    const bids = records.filter(record => record.type === 'Bid').length;
    const contracts = records.filter(record => record.type === 'Contract').length;
    const totalAmount = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const isAdmin = mockData.pendingAccount?.accountType === 'admin' || mockData.session?.accountType === 'admin';

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
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                </ul>
            </aside>

            <main class="main-content">
                <div class="journey-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-info">${isAdmin ? 'Audit records' : 'Records app'}</span>
                            <h1>Records and History</h1>
                            <p>Search tenders, bids, contracts, amendments, awards, cancellations, and compliance evidence in one exportable archive.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-records-export="csv">Export CSV</button>
                            <button class="btn btn-primary" type="button" data-records-export="pdf">Export PDF</button>
                        </div>
                    </section>

                    <section class="journey-grid four-col">
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
                            <input class="form-input" type="search" data-records-search placeholder="Search reference, title, owner, category">
                            <select class="form-input" data-records-type>
                                <option value="">All record types</option>
                                <option>Tender</option>
                                <option>Bid</option>
                                <option>Contract</option>
                            </select>
                            <select class="form-input" data-records-status>
                                <option value="">All statuses</option>
                                <option>Open</option>
                                <option>Evaluation</option>
                                <option>Awarded</option>
                                <option>Cancelled</option>
                                <option>Submitted</option>
                                <option>Active</option>
                            </select>
                            <input class="form-input" type="date" data-records-from>
                            <input class="form-input" type="date" data-records-to>
                        </div>
                    </section>

                    <section class="journey-panel">
                        <div class="data-table records-history-table">
                            <table>
                                <thead>
                                    <tr><th>Date</th><th>Type</th><th>Reference</th><th>Status</th><th>Amount</th><th>Record contents</th><th></th></tr>
                                </thead>
                                <tbody data-records-body>
                                    ${records.map(record => `
                                        <tr data-record-row
                                            data-date="${escapeRecordsHistoryHtml(record.date)}"
                                            data-type="${escapeRecordsHistoryHtml(record.type)}"
                                            data-status="${escapeRecordsHistoryHtml(record.status)}"
                                            data-search="${escapeRecordsHistoryHtml([record.reference, record.title, record.owner, record.category, record.contents].join(' ').toLowerCase())}">
                                            <td>${escapeRecordsHistoryHtml(new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</td>
                                            <td>${escapeRecordsHistoryHtml(record.type)}</td>
                                            <td><strong>${escapeRecordsHistoryHtml(record.title)}</strong><br><span>${escapeRecordsHistoryHtml(record.reference)} / ${escapeRecordsHistoryHtml(record.owner)}</span></td>
                                            <td><span class="badge ${getRecordsStatusBadge(record.status)}">${escapeRecordsHistoryHtml(record.status)}</span></td>
                                            <td>TZS ${Number(record.amount || 0).toLocaleString()}</td>
                                            <td>${escapeRecordsHistoryHtml(record.contents)}</td>
                                            <td><button class="btn btn-secondary" type="button" data-select-tender="${escapeRecordsHistoryHtml(record.reference)}" data-navigate="${escapeRecordsHistoryHtml(record.nav)}">View</button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    `;
}

function initializeRecordsHistory() {
    const root = document.querySelector('[data-records-history-root]');
    if (!root || root.dataset.ready === 'true') return;

    const rows = Array.from(root.querySelectorAll('[data-record-row]'));
    const count = root.querySelector('[data-records-count]');
    const search = root.querySelector('[data-records-search]');
    const type = root.querySelector('[data-records-type]');
    const status = root.querySelector('[data-records-status]');
    const from = root.querySelector('[data-records-from]');
    const to = root.querySelector('[data-records-to]');

    const getVisibleRows = () => rows.filter(row => !row.hidden);
    const applyFilters = () => {
        const query = (search?.value || '').trim().toLowerCase();
        const activeType = type?.value || '';
        const activeStatus = status?.value || '';
        const fromTime = from?.value ? Date.parse(from.value) : null;
        const toTime = to?.value ? Date.parse(`${to.value}T23:59:59`) : null;

        let visibleCount = 0;
        rows.forEach(row => {
            const rowTime = Date.parse(row.dataset.date);
            const visible = (!query || row.dataset.search.includes(query))
                && (!activeType || row.dataset.type === activeType)
                && (!activeStatus || row.dataset.status === activeStatus)
                && (!fromTime || rowTime >= fromTime)
                && (!toTime || rowTime <= toTime);
            row.hidden = !visible;
            if (visible) visibleCount += 1;
        });
        if (count) count.textContent = `${visibleCount} records`;
    };

    const exportCsv = () => {
        const header = ['Date', 'Type', 'Reference', 'Status', 'Amount', 'Contents'];
        const lines = getVisibleRows().map(row => Array.from(row.children).slice(0, 6).map(cell => `"${cell.textContent.replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'procurex-records.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    root.addEventListener('input', event => {
        if (event.target.matches('[data-records-search]')) applyFilters();
    });
    root.addEventListener('change', event => {
        if (event.target.matches('select, input[type="date"]')) applyFilters();
    });
    root.addEventListener('click', event => {
        const exportButton = event.target.closest('[data-records-export]');
        if (!exportButton) return;
        if (exportButton.dataset.recordsExport === 'csv') exportCsv();
        if (exportButton.dataset.recordsExport === 'pdf') window.print();
    });

    applyFilters();
    root.dataset.ready = 'true';
}

window.initializeRecordsHistory = initializeRecordsHistory;

if (window.app) {
    window.app.renderRecordsHistory = renderRecordsHistory;
}
