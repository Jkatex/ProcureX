const procurementPlanningStorageKey = 'procurex.procurementPlans.v4';
const procurementPlanningSelectedTenderKey = 'procurex.planning.selectedTenderPlan';
const procurementPlanningCreateTenderDraftKey = 'procurex.createTender.v2.savedDraft';
const procurementPlanningMilestoneKey = 'procurex.createTender.v2.milestones';
const procurementPlanningCommunicationStorageKey = 'procurex.communicationCenter.v2.items';

const procurementPlanningDefaultColumns = [
    { id: 'tenderTitle', label: 'Tender Title', type: 'text' },
    { id: 'category', label: 'Category', type: 'select', options: ['Goods', 'Works', 'Non Consultancy', 'Consultancy'] },
    { id: 'procurementMethod', label: 'Procurement Method', type: 'select', options: ['Open Tender', 'Invited Tender', 'RFQ', 'Framework', 'Single Source'] },
    { id: 'openingDate', label: 'Opening Date', type: 'date' },
    { id: 'closingDate', label: 'Closing Date', type: 'date' },
    { id: 'sourceOfFunds', label: 'Source of Funds', type: 'select', options: ['Government of Tanzania', 'Own Source', 'Donor Funded', 'Development Partner', 'Loan', 'Grant', 'Other'] },
    { id: 'budget', label: 'Budget', type: 'number' },
    { id: 'expectedCompletionDate', label: 'Expected Completion Date', type: 'date' }
];

const procurementPlanningCreateColumns = procurementPlanningDefaultColumns.filter(column => ['tenderTitle', 'category', 'procurementMethod', 'openingDate', 'closingDate'].includes(column.id));

const procurementPlanningStatuses = [
    { value: 'Inactive', label: 'Not Open', description: 'This tender has not opened yet.', page: '', tone: 'info' },
    { value: 'Draft planning', label: 'Not Open', description: 'Tender details are still being prepared from the plan.', page: 'create-tender', tone: 'warning' },
    { value: 'Opened', label: 'Marketplace', description: 'This tender is open in the marketplace.', page: 'marketplace', tone: 'success' },
    { value: 'In evaluation', label: 'Evaluation', description: 'This tender is in bid evaluation.', page: 'bid-evaluation', tone: 'warning' },
    { value: 'Contract management', label: 'Contract', description: 'This tender is in contract negotiation.', page: 'contract-negotiation', tone: 'info' },
    { value: 'Awarded', label: 'Awarding', description: 'This tender is in award and contract processing.', page: 'awarding-contracts', tone: 'success' },
    { value: 'Finished', label: 'Records', description: 'This tender is closed and archived in records.', page: 'records-history', tone: 'success' }
];

const procurementPlanningSeedRecords = [
    {
        id: 'plan-2026-well',
        financialYear: '2026/2027',
        tenderTitle: 'Construction of community water wells',
        openingDate: '2026-08-01',
        closingDate: '2026-08-30',
        category: 'Works',
        budget: 480000000,
        procurementMethod: 'Open Tender',
        sourceOfFunds: 'Development budget',
        expectedCompletionDate: '2026-12-15',
        status: 'Draft planning',
        planState: 'Planning begun',
        notes: 'Specifications cleared for tender creation'
    },
    {
        id: 'plan-2026-fleet',
        financialYear: '2026/2027',
        tenderTitle: 'Fleet maintenance framework agreement',
        openingDate: '2026-07-20',
        closingDate: '2026-08-12',
        category: 'Non Consultancy',
        budget: 125000000,
        procurementMethod: 'Framework',
        sourceOfFunds: 'Operational budget',
        expectedCompletionDate: '2026-09-18',
        status: 'Inactive',
        planState: 'Not started',
        notes: 'Funding shortfall under finance review'
    },
    {
        id: 'plan-2026-renovation',
        financialYear: '2026/2027',
        tenderTitle: 'Ward renovation works',
        openingDate: '2026-09-04',
        closingDate: '2026-10-03',
        category: 'Works',
        budget: 760000000,
        procurementMethod: 'Open Tender',
        sourceOfFunds: 'Capital projects',
        expectedCompletionDate: '2027-01-20',
        status: 'In evaluation',
        planState: 'Planning ended',
        notes: 'Board minutes pending'
    },
    {
        id: 'plan-2025-helpdesk',
        financialYear: '2025/2026',
        tenderTitle: 'ICT helpdesk support services',
        openingDate: '2025-08-10',
        closingDate: '2025-08-24',
        category: 'Non Consultancy',
        budget: 94000000,
        procurementMethod: 'RFQ',
        sourceOfFunds: 'Operational budget',
        expectedCompletionDate: '2025-09-21',
        status: 'Finished',
        planState: 'Done',
        notes: 'Contract issued and archived'
    }
];

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
    localStorage.setItem(procurementPlanningStorageKey, JSON.stringify(records));
}

function formatProcurementPlanningMoney(value) {
    const amount = Number(String(value || '0').replace(/[^0-9.]/g, '')) || 0;
    if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(0)}M`;
    return `TZS ${amount.toLocaleString()}`;
}

function formatProcurementPlanningDate(value) {
    if (!value) return 'Not set';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeProcurementPlanningRecord(record = {}, index = 0) {
    const legacyTitle = record.tenderTitle || record.itemDescription || 'Untitled tender';
    const legacyOpening = record.openingDate || record.schedule?.tenderInvitation || '';
    const legacyClosing = record.closingDate || record.schedule?.tenderClosingOpening || '';
    const id = record.id || `plan-${Date.now()}-${index}`;
    return {
        id,
        financialYear: String(record.financialYear || '2026/2027'),
        tenderTitle: String(legacyTitle),
        openingDate: String(legacyOpening),
        closingDate: String(legacyClosing),
        category: String(record.category || record.procurementCategory || 'Goods'),
        budget: Number(record.budget || record.estimatedBudget || 0),
        procurementMethod: String(record.procurementMethod || 'Open Tender'),
        sourceOfFunds: String(record.sourceOfFunds || record.fundingSource || 'Approved budget'),
        expectedCompletionDate: String(record.expectedCompletionDate || record.schedule?.contractSigning || ''),
        status: String(record.status || 'Inactive'),
        planState: String(record.planState || (/complete|finished/i.test(record.status || '') ? 'Done' : 'Not started')),
        customValues: record.customValues || {},
        notes: String(record.notes || record.remarks || '')
    };
}

function getProcurementPlanningYears(records) {
    return [...new Set(records.map(record => record.financialYear).filter(Boolean))].sort().reverse();
}

function getProcurementPlanningStatusMeta(status = '') {
    return procurementPlanningStatuses.find(item => item.value.toLowerCase() === String(status).toLowerCase())
        || procurementPlanningStatuses[0];
}

function getProcurementPlanningBadgeClass(status = '') {
    const meta = getProcurementPlanningStatusMeta(status);
    return meta.tone === 'success' ? 'badge-success' : meta.tone === 'warning' ? 'badge-warning' : 'badge-info';
}

function getProcurementPlanningTemplateCsv() {
    return [
        ['Tender Title', 'Category', 'Procurement Method', 'Opening Date', 'Closing Date', 'Source of Funds', 'Budget', 'Expected Completion Date', 'Notes'].join(','),
        ['Construction of community water wells', 'Works', 'Open Tender', '2026-08-01', '2026-08-30', 'Development budget', '480000000', '2026-12-15', ''].join(',')
    ].join('\n');
}

function downloadProcurementPlanningCsv(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function renderProcurementPlanningActionIcon(kind) {
    const icons = {
        upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
        view: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
        back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        create: '<path d="M12 5v14"/><path d="M5 12h14"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind] || icons.create}</svg>`;
}

function renderProcurementPlanningSummary(records, selectedYear) {
    const yearRecords = records.filter(item => item.financialYear === selectedYear);
    const totalValue = yearRecords.reduce((sum, item) => sum + Number(item.budget || 0), 0);
    return [
        ['Financial Year', selectedYear, 'Active plan view', 'info'],
        ['Planned Value', formatProcurementPlanningMoney(totalValue), 'Estimated procurement value', 'success']
    ].map(([label, value, note, tone]) => `
        <article class="planning-kpi-card ${tone}">
            <span>${escapeProcurementPlanningHtml(label)}</span>
            <strong>${escapeProcurementPlanningHtml(value)}</strong>
            <em>${escapeProcurementPlanningHtml(note)}</em>
        </article>
    `).join('');
}

function renderProcurementPlanningStatusButton(record) {
    const meta = getProcurementPlanningStatusMeta(record.status);
    const label = meta.label || record.status;
    if (!meta.page || /^not open$/i.test(label)) {
        const badgeClass = /^not open$/i.test(label) ? 'badge-info' : getProcurementPlanningBadgeClass(record.status);
        return `<span class="planning-status-label ${badgeClass}">${escapeProcurementPlanningHtml(label)}</span>`;
    }
    return `
        <button class="btn btn-secondary btn-sm planning-status-button ${getProcurementPlanningBadgeClass(record.status)}" type="button" data-status-navigate="${escapeProcurementPlanningHtml(meta.page)}">
            ${escapeProcurementPlanningHtml(label)}
        </button>
    `;
}

function renderProcurementPlanningRow(record) {
    const done = /done|finished/i.test(`${record.planState} ${record.status}`);
    const meta = getProcurementPlanningStatusMeta(record.status);
    return `
        <tr data-financial-year="${escapeProcurementPlanningHtml(record.financialYear)}">
            <td><strong>${escapeProcurementPlanningHtml(record.tenderTitle)}</strong><span>${escapeProcurementPlanningHtml(record.sourceOfFunds)}</span></td>
            <td>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.openingDate))}</td>
            <td>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.closingDate))}</td>
            <td>${escapeProcurementPlanningHtml(record.category)}</td>
            <td>${escapeProcurementPlanningHtml(formatProcurementPlanningMoney(record.budget))}</td>
            <td>${escapeProcurementPlanningHtml(record.procurementMethod)}</td>
            <td>${renderProcurementPlanningStatusButton(record)}</td>
            <td>${escapeProcurementPlanningHtml(meta.description || record.notes || '')}</td>
            <td>
                <div class="planning-table-actions">
                    <button class="btn btn-primary btn-sm" type="button" data-plan-tender="${escapeProcurementPlanningHtml(record.id)}">${done ? 'View' : record.planState === 'Not started' ? 'Plan' : 'Amend'}</button>
                    <button class="btn btn-secondary btn-sm" type="button" data-plan-details="${escapeProcurementPlanningHtml(record.id)}">Details</button>
                </div>
            </td>
        </tr>
    `;
}

function renderProcurementPlanningTable(records, selectedYear) {
    const yearRecords = records.filter(record => record.financialYear === selectedYear);
    const rows = yearRecords.length
        ? yearRecords.map(renderProcurementPlanningRow).join('')
        : `<tr><td colspan="9" class="planning-empty-row">No plan lines found for ${escapeProcurementPlanningHtml(selectedYear)}.</td></tr>`;
    return `
        <div class="data-table planning-records-table procurement-plan-table procurement-plan-quick-table">
            <table>
                <thead>
                    <tr>
                        <th>Tender</th>
                        <th>Opening</th>
                        <th>Closing</th>
                        <th>Category</th>
                        <th>Budget</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th>Plan</th>
                    </tr>
                </thead>
                <tbody data-planning-table-body>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderProcurementPlanningFullPlan(records, selectedYear) {
    const yearRecords = records.filter(record => record.financialYear === selectedYear);
    const rows = yearRecords.map(record => `
        <tr>
            ${procurementPlanningDefaultColumns.map(column => `
                <td data-plan-column="${escapeProcurementPlanningHtml(column.id)}">${escapeProcurementPlanningHtml(column.id === 'budget' ? formatProcurementPlanningMoney(record[column.id]) : column.type === 'date' ? formatProcurementPlanningDate(record[column.id]) : record[column.id])}</td>
            `).join('')}
            <td data-plan-column="status">${escapeProcurementPlanningHtml(record.status)}</td>
            <td data-plan-column="planState">${escapeProcurementPlanningHtml(record.planState)}</td>
            <td data-plan-column="notes">${escapeProcurementPlanningHtml(record.notes || '')}</td>
        </tr>
    `).join('');
    return `
        <section class="procurement-panel evaluation-panel planning-full-plan planning-route-page" data-plan-full-view hidden>
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Full plan</span>
                    <h2>${escapeProcurementPlanningHtml(selectedYear)} annual procurement plan</h2>
                </div>
            </div>
            <div class="data-table procurement-plan-create-table">
                <table class="procurement-plan-full-table">
                    <thead>
                        <tr>
                            ${procurementPlanningDefaultColumns.map(column => `<th data-plan-column="${escapeProcurementPlanningHtml(column.id)}">${escapeProcurementPlanningHtml(column.label)}</th>`).join('')}
                            <th data-plan-column="status">Status</th><th data-plan-column="planState">Plan State</th><th data-plan-column="notes">Notes</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="11" class="planning-empty-row">No records.</td></tr>'}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderProcurementPlanningInput(column, value = '') {
    if (column.type === 'select') {
        return `<select class="form-input" name="${escapeProcurementPlanningHtml(column.id)}">${(column.options || []).map(option => `<option ${option === value ? 'selected' : ''}>${escapeProcurementPlanningHtml(option)}</option>`).join('')}</select>`;
    }
    return `<input class="form-input" type="${column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}" name="${escapeProcurementPlanningHtml(column.id)}" value="${escapeProcurementPlanningHtml(value)}">`;
}

function renderProcurementPlanningFormRow(index, columns) {
    const defaults = index === 0 ? {
        tenderTitle: '',
        openingDate: '2026-08-01',
        closingDate: '2026-08-30',
        category: 'Works',
        budget: '480000000',
        procurementMethod: 'Open Tender',
        sourceOfFunds: 'Development budget',
        expectedCompletionDate: '2026-12-15'
    } : {};
    return `
        <tr data-plan-create-row>
            ${columns.map(column => `<td data-column-id="${escapeProcurementPlanningHtml(column.id)}">${renderProcurementPlanningInput(column, defaults[column.id] || '')}</td>`).join('')}
            <td><button class="btn btn-secondary btn-sm planning-remove-control" type="button" data-plan-remove-row>Remove</button></td>
        </tr>
    `;
}

function renderProcurementPlanningCreateSection(selectedYear) {
    const columns = procurementPlanningCreateColumns;
    return `
        <section class="planning-editor-page" data-planning-editor hidden>
            <form class="procurement-plan-create-form" data-procurement-plan-form novalidate>
                <div class="planning-editor-header">
                    <div>
                        <span class="section-kicker">Create plan</span>
                        <h1>Procurement Plan Worksheet</h1>
                        <p>Add rows, delete or rename columns, and add any other plan columns your team needs.</p>
                    </div>
                    <button class="btn btn-primary" type="submit">Save Plan</button>
                </div>
                <div class="procurement-panel planning-editor-settings">
                    <label class="planning-field">
                        <span>Financial Year</span>
                        <input class="form-input" name="financialYear" value="${escapeProcurementPlanningHtml(selectedYear)}">
                    </label>
                    <div class="planning-editor-tools">
                        <button class="btn btn-secondary btn-sm" type="button" data-plan-add-row>Add Row</button>
                        <button class="btn btn-secondary btn-sm" type="button" data-plan-add-column>Add Column</button>
                    </div>
                </div>
                <div class="data-table procurement-plan-create-table planning-editor-table">
                    <table>
                        <thead><tr data-plan-create-head>
                            ${columns.map(column => `<th data-column-id="${escapeProcurementPlanningHtml(column.id)}"><span data-plan-column-label>${escapeProcurementPlanningHtml(column.label)}</span><button class="planning-column-remove" type="button" data-plan-remove-column="${escapeProcurementPlanningHtml(column.id)}">Remove</button></th>`).join('')}
                            <th></th>
                        </tr></thead>
                        <tbody data-plan-create-body>
                            ${[0, 1, 2].map(index => renderProcurementPlanningFormRow(index, columns)).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="form-status app-form-status" data-plan-form-status aria-live="polite"></div>
            </form>
        </section>
    `;
}

function renderProcurementPlanningUploadSection() {
    return `
        <section class="procurement-panel evaluation-panel planning-upload-section" id="planning-upload" hidden>
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Upload plan</span>
                    <h2>Import Excel plan</h2>
                    <p class="panel-note">Upload an Excel or CSV plan using the same worksheet-style columns as the downloadable template.</p>
                </div>
                <span class="badge badge-info">Excel / CSV</span>
            </div>
            <div class="planning-upload-box procurement-plan-upload-box">
                <div>
                    <strong>Select annual procurement plan file</strong>
                    <span>Expected columns include tender title, dates, category, budget, method, source of funds, completion date, status, periods, and notes.</span>
                    <em data-plan-upload-status>No file selected.</em>
                </div>
                <input type="file" accept=".xls,.xlsx,.csv" data-plan-upload-input aria-label="Upload annual procurement plan Excel file">
            </div>
        </section>
    `;
}

function renderProcurementPlanDrawer(record) {
    if (!record) return '';
    return `
        <div class="procurement-plan-drawer-content">
            <span class="section-kicker">${escapeProcurementPlanningHtml(record.financialYear)}</span>
            <h2 id="plan-drawer-title">${escapeProcurementPlanningHtml(record.tenderTitle)}</h2>
            <div class="procurement-plan-drawer-status">
                <span class="badge ${getProcurementPlanningBadgeClass(record.status)}">${escapeProcurementPlanningHtml(record.status)}</span>
                <span class="planning-readiness-pill">${escapeProcurementPlanningHtml(record.planState)}</span>
            </div>
            <section>
                <h3>Plan Details</h3>
                <div class="planning-detail-grid procurement-plan-detail-grid">
                    <div><span>Opening Date</span><strong>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.openingDate))}</strong></div>
                    <div><span>Closing Date</span><strong>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.closingDate))}</strong></div>
                    <div><span>Category</span><strong>${escapeProcurementPlanningHtml(record.category)}</strong></div>
                    <div><span>Budget</span><strong>${escapeProcurementPlanningHtml(formatProcurementPlanningMoney(record.budget))}</strong></div>
                    <div><span>Method</span><strong>${escapeProcurementPlanningHtml(record.procurementMethod)}</strong></div>
                    <div><span>Source of Funds</span><strong>${escapeProcurementPlanningHtml(record.sourceOfFunds)}</strong></div>
                    <div><span>Expected Completion</span><strong>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.expectedCompletionDate))}</strong></div>
                    <div><span>Notes</span><strong>${escapeProcurementPlanningHtml(record.notes || '')}</strong></div>
                </div>
            </section>
            <section>
                <h3>Notes</h3>
                <div class="procurement-plan-drawer-list">
                    <div><span>Description</span><strong>${escapeProcurementPlanningHtml(record.notes || 'No additional notes captured.')}</strong></div>
                </div>
            </section>
        </div>
    `;
}

function renderProcurementPlanningDetailsPage(records) {
    return `
        <section class="procurement-panel evaluation-panel planning-route-page planning-detail-page" data-plan-detail-view hidden>
            <div data-plan-detail-content>
                ${renderProcurementPlanDrawer(records[0])}
            </div>
        </section>
    `;
}

function getProcurementPlanningReminderEvents(record) {
    return [
        { key: 'opening', label: 'open', date: record.openingDate, actionPage: 'create-tender', actionLabel: 'Create Tender' },
        { key: 'closing', label: 'close', date: record.closingDate, actionPage: 'marketplace', actionLabel: 'Open Marketplace' },
        { key: 'completion', label: 'complete', date: record.expectedCompletionDate, actionPage: 'contract-negotiation', actionLabel: 'Open Contract' }
    ].filter(item => item.date);
}

function syncProcurementPlanningCommunicationReminders(records) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const reminderWindowMs = 7 * 24 * 60 * 60 * 1000;
    const dueItems = records.flatMap(record => getProcurementPlanningReminderEvents(record).map(event => ({ record, event })))
        .filter(({ event }) => {
            const date = new Date(`${event.date}T00:00:00`);
            if (Number.isNaN(date.getTime())) return false;
            const delta = date.getTime() - now.getTime();
            return delta >= 0 && delta <= reminderWindowMs;
        });
    if (!dueItems.length) return;

    try {
        const stored = JSON.parse(localStorage.getItem(procurementPlanningCommunicationStorageKey) || '[]');
        const existing = Array.isArray(stored) ? stored : [];
        const nextItems = dueItems
            .filter(({ record, event }) => !existing.some(item => item.id === `planning-${record.id}-${event.key}`))
            .map(({ record, event }) => ({
                id: `planning-${record.id}-${event.key}`,
                kind: 'notification',
                folder: 'inbox',
                category: 'Annual Plan Reminder',
                subject: `Annual plan action: ${record.tenderTitle}`,
                body: `According to your annual plan, ${record.tenderTitle} should ${event.label} on ${formatProcurementPlanningDate(event.date)}.`,
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientType: 'Buyer',
                recipientName: 'Buyer organization',
                tenderId: record.id,
                tenderReference: record.id,
                tenderTitle: record.tenderTitle,
                priority: 'High',
                status: 'Unread',
                read: false,
                date: new Date().toISOString(),
                actionLabel: event.actionLabel,
                actionPage: event.actionPage,
                audience: ['buyer', 'all']
            }));
        if (nextItems.length) localStorage.setItem(procurementPlanningCommunicationStorageKey, JSON.stringify([...nextItems, ...existing]));
    } catch (error) {
        // Reminder generation should never block the planning page.
    }
}

function renderTenderPlanning() {
    const records = getProcurementPlanningRecords().map(normalizeProcurementPlanningRecord);
    syncProcurementPlanningCommunicationReminders(records);
    const years = getProcurementPlanningYears(records);
    const selectedYear = years[0] || '2026/2027';
    return `
        <div class="main-layout tender-planning-page procurement-planning-control app-planning-control procurement-planning-app">
            <main class="main-content tender-planning-content">
                <div data-planning-front>
                    <section class="planning-dashboard-header app-planning-hero" id="planning-dashboard">
                        <div>
                            <span class="section-kicker">Annual Procurement Plan</span>
                            <h1>Procurement Planning</h1>
                            <p>Create, upload, view, and download procurement plans. Use the Plan action to finish tender requirements before publication.</p>
                            <div class="inline-actions planning-primary-actions">
                                <button class="btn btn-primary planning-action-button" type="button" data-planning-mode="create">${renderProcurementPlanningActionIcon('create')}<span>Create Plan</span></button>
                                <button class="btn btn-secondary planning-action-button" type="button" data-planning-mode="upload">${renderProcurementPlanningActionIcon('upload')}<span>Upload Plan</span></button>
                                <button class="btn btn-secondary planning-action-button" type="button" data-plan-template-download>${renderProcurementPlanningActionIcon('download')}<span>Download Template</span></button>
                            </div>
                        </div>
                        <article class="planning-readiness-summary">
                            <span>Current year</span>
                            <strong data-planning-current-year>${escapeProcurementPlanningHtml(selectedYear)}</strong>
                        </article>
                    </section>
                    ${renderProcurementPlanningUploadSection()}
                    <section class="planning-kpi-grid app-planning-kpis" data-planning-summary aria-label="Procurement planning summary">
                        ${renderProcurementPlanningSummary(records, selectedYear)}
                    </section>
                    <section class="procurement-panel evaluation-panel planning-control-panel" id="planning-register">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Plan by year</span>
                                <h2>Quick procurement plan view</h2>
                                <p class="panel-note">The front table shows essential columns only. Use View Plan for the full worksheet.</p>
                            </div>
                            <div class="planning-register-actions">
                                <label class="planning-field planning-year-filter">
                                    <span>Filter Year</span>
                                    <select class="form-input" data-planning-year-filter>
                                        ${years.map(year => `<option ${year === selectedYear ? 'selected' : ''}>${escapeProcurementPlanningHtml(year)}</option>`).join('')}
                                    </select>
                                </label>
                                <button class="btn btn-secondary btn-sm" type="button" data-plan-view-full>${renderProcurementPlanningActionIcon('view')}<span>View Plan</span></button>
                                <button class="btn btn-secondary btn-sm" type="button" data-plan-download>${renderProcurementPlanningActionIcon('download')}<span>Download Plan</span></button>
                            </div>
                        </div>
                        <div data-planning-year-table>${renderProcurementPlanningTable(records, selectedYear)}</div>
                    </section>
                </div>
                <div data-planning-full-slot>${renderProcurementPlanningFullPlan(records, selectedYear)}</div>
                <div data-planning-detail-slot>${renderProcurementPlanningDetailsPage(records)}</div>
                ${renderProcurementPlanningCreateSection(selectedYear)}
            </main>
        </div>
    `;
}

function initializeTenderPlanning() {
    const root = document.querySelector('.procurement-planning-app');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    let records = getProcurementPlanningRecords().map(normalizeProcurementPlanningRecord);
    let editorDirty = false;
    const front = root.querySelector('[data-planning-front]');
    const editor = root.querySelector('[data-planning-editor]');
    const yearFilter = root.querySelector('[data-planning-year-filter]');
    const tableSlot = root.querySelector('[data-planning-year-table]');
    const summarySlot = root.querySelector('[data-planning-summary]');
    const currentYear = root.querySelector('[data-planning-current-year]');
    const fullSlot = root.querySelector('[data-planning-full-slot]');
    const detailSlot = root.querySelector('[data-planning-detail-slot]');
    const uploadPanel = root.querySelector('#planning-upload');

    const selectedYear = () => yearFilter?.value || getProcurementPlanningYears(records)[0] || '2026/2027';

    const setPlanningRoute = (route = 'front', detailId = '') => {
        const fullView = root.querySelector('[data-plan-full-view]');
        const detailView = root.querySelector('[data-plan-detail-view]');
        if (front) front.hidden = route !== 'front';
        if (editor) editor.hidden = route !== 'create';
        if (fullView) fullView.hidden = route !== 'full';
        if (detailView) detailView.hidden = route !== 'detail';
        if (route === 'detail' && detailId) {
            const record = records.find(item => item.id === detailId);
            const content = root.querySelector('[data-plan-detail-content]');
            if (record && content) content.innerHTML = renderProcurementPlanDrawer(record);
        }
        (route === 'full' ? fullView : route === 'detail' ? detailView : route === 'create' ? editor : front)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const pushPlanningRoute = (route, detailId = '') => {
        const params = route === 'front' ? '' : route === 'detail' ? `?view=detail&plan=${encodeURIComponent(detailId)}` : `?view=${encodeURIComponent(route)}`;
        if (window.history?.pushState) window.history.pushState({ planningRoute: route, detailId }, '', params || window.location.pathname);
        setPlanningRoute(route, detailId);
    };

    const applyPlanningRouteFromLocation = () => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view') || 'front';
        setPlanningRoute(view, params.get('plan') || '');
    };

    const refreshYearView = () => {
        const year = selectedYear();
        if (tableSlot) tableSlot.innerHTML = renderProcurementPlanningTable(records, year);
        if (summarySlot) summarySlot.innerHTML = renderProcurementPlanningSummary(records, year);
        if (currentYear) currentYear.textContent = year;
        if (fullSlot) fullSlot.innerHTML = renderProcurementPlanningFullPlan(records, year);
        if (detailSlot) detailSlot.innerHTML = renderProcurementPlanningDetailsPage(records);
        applyPlanningRouteFromLocation();
    };

    const setEditorOpen = (isOpen) => {
        pushPlanningRoute(isOpen ? 'create' : 'front');
    };

    const closeEditor = () => {
        if (editorDirty && !confirm('Save changes before leaving this plan? Press OK to stay and save, or Cancel to leave without saving.')) {
            editorDirty = false;
            setEditorOpen(false);
            return;
        }
        if (!editorDirty) pushPlanningRoute('front');
    };

    const collectPlanCsv = () => {
        const yearRecords = records.filter(record => record.financialYear === selectedYear());
        const header = ['Tender Title', 'Category', 'Procurement Method', 'Opening Date', 'Closing Date', 'Source of Funds', 'Budget', 'Expected Completion Date', 'Status', 'Plan State', 'Notes'];
        const rows = yearRecords.map(record => [
            record.tenderTitle, record.category, record.procurementMethod, record.openingDate, record.closingDate, record.sourceOfFunds, record.budget, record.expectedCompletionDate, record.status, record.planState, record.notes || ''
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
        return [header.join(','), ...rows].join('\n');
    };

    const openTenderPlanner = (recordId) => {
        const record = records.find(item => item.id === recordId);
        if (!record) return;
        const plannedTender = {
            planId: record.id,
            title: record.tenderTitle,
            openingDate: record.openingDate,
            closingDate: record.closingDate,
            category: record.category,
            procurementMethod: record.procurementMethod,
            fundingSource: record.sourceOfFunds,
            budget: record.budget,
            expectedCompletionDate: record.expectedCompletionDate,
            publicationHoldUntil: record.openingDate,
            status: record.status,
            startStep: 2
        };
        localStorage.setItem(procurementPlanningSelectedTenderKey, JSON.stringify(plannedTender));
        try {
            const procurementTypeId = /work/i.test(record.category)
                ? 'works'
                : /consult/i.test(record.category) && !/non/i.test(record.category)
                    ? 'consultancy'
                    : /goods/i.test(record.category)
                        ? 'goods'
                        : 'services';
            const existing = JSON.parse(localStorage.getItem(procurementPlanningCreateTenderDraftKey) || '{}');
            existing.mainDetails = {
                ...(existing.mainDetails || {}),
                title: record.tenderTitle,
                procurementTypeId,
                category: record.category,
                categories: [record.category],
                method: record.procurementMethod === 'Invited Tender' ? 'Invited Tender' : 'Open Tender',
                fundingSource: record.sourceOfFunds,
                status: /finished|done/i.test(`${record.status} ${record.planState}`) ? 'Planning done' : 'Planning draft',
                budget: record.budget,
                planSnapshot: plannedTender
            };
            localStorage.setItem(procurementPlanningCreateTenderDraftKey, JSON.stringify(existing));
            const milestones = [
                { id: 'milestone-publication', name: 'Publication', date: record.openingDate },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: record.closingDate },
                { id: 'milestone-closing', name: 'Bid closing', date: record.closingDate },
                { id: 'milestone-opening', name: 'Bid opening', date: record.openingDate },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '' },
                { id: 'milestone-award', name: 'Award target', date: record.expectedCompletionDate }
            ];
            localStorage.setItem(procurementPlanningMilestoneKey, JSON.stringify(milestones));
        } catch (error) {
            window.procurexPlannedTender = plannedTender;
        }
        window.app?.navigateTo('create-tender');
    };

    root.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest('[data-planning-mode="create"]')) {
            event.preventDefault();
            setEditorOpen(true);
            return;
        }
        if (target.closest('[data-planning-mode="upload"]')) {
            event.preventDefault();
            if (uploadPanel) uploadPanel.hidden = false;
            uploadPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            root.querySelector('[data-plan-upload-input]')?.click();
            return;
        }
        if (target.closest('[data-plan-template-download]')) {
            event.preventDefault();
            downloadProcurementPlanningCsv('procurex-plan-template.csv', getProcurementPlanningTemplateCsv());
            return;
        }
        if (target.closest('[data-plan-download]')) {
            event.preventDefault();
            downloadProcurementPlanningCsv(`procurex-plan-${selectedYear().replace('/', '-')}.csv`, collectPlanCsv());
            return;
        }
        if (target.closest('[data-plan-view-full]')) {
            event.preventDefault();
            pushPlanningRoute('full');
            return;
        }
        const detailsButton = target.closest('[data-plan-details]');
        if (detailsButton) {
            event.preventDefault();
            pushPlanningRoute('detail', detailsButton.getAttribute('data-plan-details'));
            return;
        }
        const tenderButton = target.closest('[data-plan-tender]');
        if (tenderButton) {
            event.preventDefault();
            openTenderPlanner(tenderButton.getAttribute('data-plan-tender'));
            return;
        }
        const statusButton = target.closest('[data-status-navigate]');
        if (statusButton) {
            event.preventDefault();
            window.app?.navigateTo(statusButton.getAttribute('data-status-navigate'));
            return;
        }
        if (target.closest('[data-plan-add-row]')) {
            event.preventDefault();
            const form = root.querySelector('[data-procurement-plan-form]');
            const columns = Array.from(root.querySelectorAll('[data-plan-create-head] [data-column-id]')).map(cell => ({
                id: cell.getAttribute('data-column-id'),
                label: cell.querySelector('[data-plan-column-title-input]')?.value || cell.querySelector('[data-plan-column-label]')?.textContent?.trim() || cell.textContent.trim(),
                type: procurementPlanningDefaultColumns.find(column => column.id === cell.getAttribute('data-column-id'))?.type || 'text',
                options: procurementPlanningDefaultColumns.find(column => column.id === cell.getAttribute('data-column-id'))?.options
            }));
            root.querySelector('[data-plan-create-body]')?.insertAdjacentHTML('beforeend', renderProcurementPlanningFormRow(root.querySelectorAll('[data-plan-create-row]').length, columns));
            editorDirty = true;
            return;
        }
        if (target.closest('[data-plan-remove-row]')) {
            event.preventDefault();
            target.closest('[data-plan-create-row]')?.remove();
            editorDirty = true;
            return;
        }
        if (target.closest('[data-plan-add-column]')) {
            event.preventDefault();
            const id = `custom-${Date.now()}`;
            const label = 'New Column';
            const head = root.querySelector('[data-plan-create-head]');
            const actionHead = head?.querySelector('th:last-child');
            actionHead?.insertAdjacentHTML('beforebegin', `<th data-column-id="${escapeProcurementPlanningHtml(id)}" data-custom-column="true"><span data-plan-column-label>${escapeProcurementPlanningHtml(label)}</span><button class="planning-column-remove" type="button" data-plan-remove-column="${escapeProcurementPlanningHtml(id)}" aria-label="Remove ${escapeProcurementPlanningHtml(label)} column">Remove Column</button></th>`);
            root.querySelectorAll('[data-plan-create-row]').forEach(row => {
                row.querySelector('td:last-child')?.insertAdjacentHTML('beforebegin', `<td data-column-id="${escapeProcurementPlanningHtml(id)}" data-custom-column="true"><input class="form-input" type="text" name="${escapeProcurementPlanningHtml(id)}"></td>`);
            });
            head?.querySelector(`[data-column-id="${CSS.escape(id)}"] [data-plan-column-label]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
            editorDirty = true;
            return;
        }
        const removeColumn = target.closest('[data-plan-remove-column]');
        if (removeColumn) {
            event.preventDefault();
            const id = removeColumn.getAttribute('data-plan-remove-column');
            root.querySelectorAll('[data-column-id]').forEach(cell => {
                if (cell.getAttribute('data-column-id') === id) cell.remove();
            });
            editorDirty = true;
            return;
        }
        const renameColumn = target.closest('[data-plan-column-label]');
        if (renameColumn) {
            if (renameColumn.matches('input, textarea')) {
                editorDirty = true;
                return;
            }
            event.preventDefault();
            const label = prompt('Column name', renameColumn.textContent.trim());
            if (!label) return;
            renameColumn.textContent = label;
            editorDirty = true;
        }
    });

    root.addEventListener('change', (event) => {
        if (event.target.matches('[data-planning-year-filter]')) {
            refreshYearView();
            return;
        }
        if (event.target.matches('[data-plan-upload-input]')) {
            const file = event.target.files?.[0];
            const status = root.querySelector('[data-plan-upload-status]');
            if (status) status.textContent = file ? `${file.name} selected. Import parsing can be connected to the backend or Excel parser.` : 'No file selected.';
            return;
        }
    });

    root.addEventListener('input', (event) => {
        if (event.target.closest('[data-procurement-plan-form]')) editorDirty = true;
    });

    root.querySelector('[data-procurement-plan-form]')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const year = String(new FormData(form).get('financialYear') || selectedYear());
        const rows = Array.from(root.querySelectorAll('[data-plan-create-row]'));
        const newRecords = rows.map((row, index) => {
            const data = new FormData();
            row.querySelectorAll('input, textarea, select').forEach(input => data.set(input.name, input.value));
            const customValues = {};
            row.querySelectorAll('[data-custom-column] input').forEach(input => { customValues[input.name] = input.value; });
            return normalizeProcurementPlanningRecord({
                id: `plan-${Date.now()}-${index}`,
                financialYear: year,
                tenderTitle: data.get('tenderTitle'),
                openingDate: data.get('openingDate'),
                closingDate: data.get('closingDate'),
                category: data.get('category'),
                budget: data.get('budget'),
                procurementMethod: data.get('procurementMethod'),
                sourceOfFunds: data.get('sourceOfFunds'),
                expectedCompletionDate: data.get('expectedCompletionDate'),
                status: 'Draft planning',
                planState: 'Planning begun',
                customValues,
                notes: data.get('notes')
            }, index);
        }).filter(record => record.tenderTitle && record.tenderTitle !== 'Untitled tender');

        if (!newRecords.length) {
            const status = root.querySelector('[data-plan-form-status]');
            if (status) status.textContent = 'Add at least one tender title before saving.';
            return;
        }

        records = [...newRecords, ...records.filter(record => record.financialYear !== year)];
        saveProcurementPlanningRecords(records);
        if (yearFilter && !Array.from(yearFilter.options).some(option => option.value === year)) {
            yearFilter.insertAdjacentHTML('afterbegin', `<option>${escapeProcurementPlanningHtml(year)}</option>`);
        }
        if (yearFilter) yearFilter.value = year;
        refreshYearView();
        editorDirty = false;
        const status = root.querySelector('[data-plan-form-status]');
        if (status) {
            status.textContent = `${newRecords.length} plan row${newRecords.length === 1 ? '' : 's'} saved.`;
            status.classList.add('success');
        }
        pushPlanningRoute('front');
    });

    window.addEventListener('popstate', applyPlanningRouteFromLocation);
    applyPlanningRouteFromLocation();

    window.addEventListener('beforeunload', (event) => {
        if (!editorDirty) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

window.renderTenderPlanning = renderTenderPlanning;
window.initializeTenderPlanning = initializeTenderPlanning;
