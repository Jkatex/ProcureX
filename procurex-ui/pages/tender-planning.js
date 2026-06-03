const procurementPlanningStorageKey = 'procurex.procurementPlans.v4';
const procurementPlanningSelectedTenderKey = 'procurex.planning.selectedTenderPlan';
const procurementPlanningCreateTenderDraftKey = 'procurex.createTender.v2.savedDraft';
const procurementPlanningMilestoneKey = 'procurex.createTender.v2.milestones';

const procurementPlanningDefaultColumns = [
    { id: 'tenderTitle', label: 'Tender Title', type: 'text' },
    { id: 'openingDate', label: 'Opening Date', type: 'date' },
    { id: 'closingDate', label: 'Closing Date', type: 'date' },
    { id: 'category', label: 'Category', type: 'select', options: ['Goods', 'Works', 'Services', 'Consultancy'] },
    { id: 'budget', label: 'Budget', type: 'number' },
    { id: 'procurementMethod', label: 'Procurement Method', type: 'select', options: ['Open Tender', 'Invited Tender', 'RFQ', 'Framework', 'Single Source'] },
    { id: 'sourceOfFunds', label: 'Source of Funds', type: 'select', options: ['Government of Tanzania', 'Own Source', 'Donor Funded', 'Development Partner', 'Loan', 'Grant', 'Other'] },
    { id: 'expectedCompletionDate', label: 'Expected Completion Date', type: 'date' }
];

const procurementPlanningStatuses = [
    { value: 'Inactive', page: '', tone: 'info' },
    { value: 'Draft planning', page: 'create-tender', tone: 'warning' },
    { value: 'Opened', page: 'marketplace', tone: 'success' },
    { value: 'In evaluation', page: 'bid-evaluation', tone: 'warning' },
    { value: 'Contract management', page: 'contract-negotiation', tone: 'info' },
    { value: 'Awarded', page: 'awarding-contracts', tone: 'success' },
    { value: 'Finished', page: 'records-history', tone: 'success' }
];

const procurementPlanningPeriodPresets = {
    quarter: { label: 'Quarter plan', count: 4, prefix: 'Q' },
    half: { label: 'Half-year plan', count: 2, prefix: 'H' },
    annual: { label: 'Annual plan', count: 1, prefix: 'Annual' },
    custom: { label: 'Custom execution periods', count: 4, prefix: 'Phase' }
};

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
        periodValues: { Q1: 'Design', Q2: 'Tender', Q3: 'Award', Q4: 'Contract' },
        notes: 'Specifications cleared for tender creation'
    },
    {
        id: 'plan-2026-fleet',
        financialYear: '2026/2027',
        tenderTitle: 'Fleet maintenance framework agreement',
        openingDate: '2026-07-20',
        closingDate: '2026-08-12',
        category: 'Services',
        budget: 125000000,
        procurementMethod: 'Framework',
        sourceOfFunds: 'Operational budget',
        expectedCompletionDate: '2026-09-18',
        status: 'Inactive',
        planState: 'Not started',
        periodValues: { Q1: 'Plan', Q2: 'Tender', Q3: 'Review', Q4: '' },
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
        periodValues: { Q1: '', Q2: 'Plan', Q3: 'Tender', Q4: 'Award' },
        notes: 'Board minutes pending'
    },
    {
        id: 'plan-2025-helpdesk',
        financialYear: '2025/2026',
        tenderTitle: 'ICT helpdesk support services',
        openingDate: '2025-08-10',
        closingDate: '2025-08-24',
        category: 'Services',
        budget: 94000000,
        procurementMethod: 'RFQ',
        sourceOfFunds: 'Operational budget',
        expectedCompletionDate: '2025-09-21',
        status: 'Finished',
        planState: 'Done',
        periodValues: { Q1: 'Plan', Q2: 'Tender', Q3: 'Award', Q4: 'Close' },
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
        periodValues: {
            Q1: record.periodValues?.Q1 ?? record.q1 ?? '',
            Q2: record.periodValues?.Q2 ?? record.q2 ?? '',
            Q3: record.periodValues?.Q3 ?? record.q3 ?? '',
            Q4: record.periodValues?.Q4 ?? record.q4 ?? ''
        },
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

function getProcurementPlanningPeriods(planType, customCount) {
    const preset = procurementPlanningPeriodPresets[planType] || procurementPlanningPeriodPresets.quarter;
    const count = Math.max(1, Math.min(12, Number(customCount || preset.count) || preset.count));
    if (planType === 'annual') return ['Annual'];
    return Array.from({ length: count }, (_, index) => `${preset.prefix}${index + 1}`);
}

function getProcurementPlanningTemplateCsv() {
    return [
        ['Tender Title', 'Opening Date', 'Closing Date', 'Category', 'Budget', 'Procurement Method', 'Source of Funds', 'Expected Completion Date', 'Status', 'Q1', 'Q2', 'Q3', 'Q4', 'Notes'].join(','),
        ['Construction of community water wells', '2026-08-01', '2026-08-30', 'Works', '480000000', 'Open Tender', 'Development budget', '2026-12-15', 'Draft planning', 'Design', 'Tender', 'Award', 'Contract', ''].join(',')
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
    const active = yearRecords.filter(item => !/inactive|finished/i.test(item.status)).length;
    return [
        ['Financial Year', selectedYear, 'Active plan view', 'info'],
        ['Plan Lines', yearRecords.length, 'Items in selected year', 'info'],
        ['Active Work', active, 'Items linked to a procurement stage', 'success'],
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
    const disabled = !meta.page;
    return `
        <button class="planning-status-button badge ${getProcurementPlanningBadgeClass(record.status)}" type="button" ${disabled ? 'disabled' : `data-status-navigate="${escapeProcurementPlanningHtml(meta.page)}"`}>
            ${escapeProcurementPlanningHtml(record.status)}
        </button>
    `;
}

function renderProcurementPlanningRow(record) {
    const done = /done|finished/i.test(`${record.planState} ${record.status}`);
    return `
        <tr data-financial-year="${escapeProcurementPlanningHtml(record.financialYear)}">
            <td><strong>${escapeProcurementPlanningHtml(record.tenderTitle)}</strong><span>${escapeProcurementPlanningHtml(record.sourceOfFunds)}</span></td>
            <td>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.openingDate))}</td>
            <td>${escapeProcurementPlanningHtml(formatProcurementPlanningDate(record.closingDate))}</td>
            <td>${escapeProcurementPlanningHtml(record.category)}</td>
            <td>${escapeProcurementPlanningHtml(formatProcurementPlanningMoney(record.budget))}</td>
            <td>${escapeProcurementPlanningHtml(record.procurementMethod)}</td>
            <td>${renderProcurementPlanningStatusButton(record)}</td>
            <td>
                <div class="planning-table-actions">
                    <button class="btn btn-primary btn-sm" type="button" data-plan-tender="${escapeProcurementPlanningHtml(record.id)}">${done ? 'View' : record.planState === 'Not started' ? 'Plan' : 'Amend'}</button>
                    <button class="btn btn-secondary btn-sm" type="button" data-plan-open="${escapeProcurementPlanningHtml(record.id)}">Details</button>
                </div>
            </td>
        </tr>
    `;
}

function renderProcurementPlanningTable(records, selectedYear) {
    const yearRecords = records.filter(record => record.financialYear === selectedYear);
    const rows = yearRecords.length
        ? yearRecords.map(renderProcurementPlanningRow).join('')
        : `<tr><td colspan="8" class="planning-empty-row">No plan lines found for ${escapeProcurementPlanningHtml(selectedYear)}.</td></tr>`;
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
                <td>${escapeProcurementPlanningHtml(column.id === 'budget' ? formatProcurementPlanningMoney(record[column.id]) : column.type === 'date' ? formatProcurementPlanningDate(record[column.id]) : record[column.id])}</td>
            `).join('')}
            <td>${escapeProcurementPlanningHtml(record.status)}</td>
            <td>${escapeProcurementPlanningHtml(record.planState)}</td>
            <td>${escapeProcurementPlanningHtml(record.periodValues?.Q1 || '')}</td>
            <td>${escapeProcurementPlanningHtml(record.periodValues?.Q2 || '')}</td>
            <td>${escapeProcurementPlanningHtml(record.periodValues?.Q3 || '')}</td>
            <td>${escapeProcurementPlanningHtml(record.periodValues?.Q4 || '')}</td>
            <td>${escapeProcurementPlanningHtml(record.notes || '')}</td>
        </tr>
    `).join('');
    return `
        <section class="procurement-panel evaluation-panel planning-full-plan" data-plan-full-view hidden>
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Full plan</span>
                    <h2>${escapeProcurementPlanningHtml(selectedYear)} annual procurement plan</h2>
                </div>
                <button class="btn btn-secondary btn-sm" type="button" data-plan-full-close>Close</button>
            </div>
            <div class="data-table procurement-plan-create-table">
                <table>
                    <thead>
                        <tr>
                            ${procurementPlanningDefaultColumns.map(column => `<th>${escapeProcurementPlanningHtml(column.label)}</th>`).join('')}
                            <th>Status</th><th>Plan State</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="15" class="planning-empty-row">No records.</td></tr>'}</tbody>
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

function renderProcurementPlanningFormRow(index, columns, periods) {
    const defaults = index === 0 ? {
        tenderTitle: 'Construction of community water wells',
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
            <td>
                <select class="form-input" name="status">
                    ${procurementPlanningStatuses.map(item => `<option ${item.value === 'Draft planning' ? 'selected' : ''}>${escapeProcurementPlanningHtml(item.value)}</option>`).join('')}
                </select>
            </td>
            ${periods.map(period => `<td data-period-cell="${escapeProcurementPlanningHtml(period)}"><input class="form-input" name="period:${escapeProcurementPlanningHtml(period)}" value="${index === 0 ? period : ''}"></td>`).join('')}
            <td><input class="form-input" name="notes" value="${index === 0 ? 'Draft line' : ''}" placeholder="Notes"></td>
            <td><button class="boq-row-action icon-delete-btn" type="button" data-plan-remove-row aria-label="Remove row" title="Remove row">x</button></td>
        </tr>
    `;
}

function renderProcurementPlanningCreateSection(selectedYear) {
    const columns = procurementPlanningDefaultColumns;
    const periods = getProcurementPlanningPeriods('quarter', 4);
    return `
        <section class="planning-editor-page" data-planning-editor hidden>
            <form class="procurement-plan-create-form" data-procurement-plan-form novalidate>
                <div class="planning-editor-header">
                    <button class="btn btn-secondary planning-action-button" type="button" data-plan-editor-back>${renderProcurementPlanningActionIcon('back')}<span>Back</span></button>
                    <div>
                        <span class="section-kicker">Create plan</span>
                        <h1>Procurement Plan Worksheet</h1>
                        <p>Choose the plan period, add plan rows, and customize columns before saving the annual procurement plan.</p>
                    </div>
                    <button class="btn btn-primary" type="submit">Save Plan</button>
                </div>
                <div class="procurement-panel planning-editor-settings">
                    <label class="planning-field">
                        <span>Financial Year</span>
                        <input class="form-input" name="financialYear" value="${escapeProcurementPlanningHtml(selectedYear)}">
                    </label>
                    <label class="planning-field">
                        <span>Plan Type</span>
                        <select class="form-input" name="planType" data-plan-type>
                            ${Object.entries(procurementPlanningPeriodPresets).map(([key, preset]) => `<option value="${key}" ${key === 'quarter' ? 'selected' : ''}>${escapeProcurementPlanningHtml(preset.label)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="planning-field">
                        <span>Execution Periods</span>
                        <input class="form-input" name="periodCount" type="number" min="1" max="12" value="4" data-period-count>
                    </label>
                    <div class="planning-editor-tools">
                        <button class="btn btn-secondary btn-sm" type="button" data-plan-add-row>Add Row</button>
                        <button class="btn btn-secondary btn-sm" type="button" data-plan-add-column>Add Column</button>
                        <button class="btn btn-secondary btn-sm" type="button" data-plan-remove-column>Remove Column</button>
                    </div>
                </div>
                <div class="data-table procurement-plan-create-table planning-editor-table">
                    <table>
                        <thead><tr data-plan-create-head>
                            ${columns.map(column => `<th data-column-id="${escapeProcurementPlanningHtml(column.id)}">${escapeProcurementPlanningHtml(column.label)}</th>`).join('')}
                            <th>Status</th>
                            ${periods.map(period => `<th data-period-head="${escapeProcurementPlanningHtml(period)}">${escapeProcurementPlanningHtml(period)}</th>`).join('')}
                            <th>Notes</th><th></th>
                        </tr></thead>
                        <tbody data-plan-create-body>
                            ${[0, 1, 2].map(index => renderProcurementPlanningFormRow(index, columns, periods)).join('')}
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
                <h3>Execution Periods</h3>
                <div class="procurement-plan-drawer-list">
                    ${Object.entries(record.periodValues || {}).map(([key, value]) => `<div><span>${escapeProcurementPlanningHtml(key)}</span><strong>${escapeProcurementPlanningHtml(value || 'Not planned')}</strong></div>`).join('')}
                </div>
            </section>
        </div>
    `;
}

function renderTenderPlanning() {
    const records = getProcurementPlanningRecords().map(normalizeProcurementPlanningRecord);
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
                            <em>${records.filter(record => record.financialYear === selectedYear).length} plan lines in the selected year.</em>
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
                    <div data-planning-full-slot>${renderProcurementPlanningFullPlan(records, selectedYear)}</div>
                </div>
                ${renderProcurementPlanningCreateSection(selectedYear)}
                <aside class="procurement-plan-drawer" data-plan-drawer aria-hidden="true" aria-label="Procurement plan details">
                    <div class="procurement-plan-drawer-backdrop" data-plan-close></div>
                    <div class="procurement-plan-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="plan-drawer-title">
                        <button class="procurement-plan-drawer-close" type="button" data-plan-close aria-label="Close details">x</button>
                        <div data-plan-drawer-content></div>
                    </div>
                </aside>
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
    const uploadPanel = root.querySelector('#planning-upload');
    const drawer = root.querySelector('[data-plan-drawer]');
    const drawerContent = root.querySelector('[data-plan-drawer-content]');

    const selectedYear = () => yearFilter?.value || getProcurementPlanningYears(records)[0] || '2026/2027';

    const refreshYearView = () => {
        const year = selectedYear();
        if (tableSlot) tableSlot.innerHTML = renderProcurementPlanningTable(records, year);
        if (summarySlot) summarySlot.innerHTML = renderProcurementPlanningSummary(records, year);
        if (currentYear) currentYear.textContent = year;
        if (fullSlot) fullSlot.innerHTML = renderProcurementPlanningFullPlan(records, year);
    };

    const setEditorOpen = (isOpen) => {
        if (front) front.hidden = isOpen;
        if (editor) editor.hidden = !isOpen;
        (isOpen ? editor : front)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const closeEditor = () => {
        if (editorDirty && !confirm('Save changes before leaving this plan? Press OK to stay and save, or Cancel to leave without saving.')) {
            editorDirty = false;
            setEditorOpen(false);
            return;
        }
        if (!editorDirty) setEditorOpen(false);
    };

    const collectPlanCsv = () => {
        const yearRecords = records.filter(record => record.financialYear === selectedYear());
        const header = ['Tender Title', 'Opening Date', 'Closing Date', 'Category', 'Budget', 'Procurement Method', 'Source of Funds', 'Expected Completion Date', 'Status', 'Plan State', 'Q1', 'Q2', 'Q3', 'Q4', 'Notes'];
        const rows = yearRecords.map(record => [
            record.tenderTitle, record.openingDate, record.closingDate, record.category, record.budget, record.procurementMethod, record.sourceOfFunds, record.expectedCompletionDate, record.status, record.planState,
            record.periodValues?.Q1 || '', record.periodValues?.Q2 || '', record.periodValues?.Q3 || '', record.periodValues?.Q4 || '', record.notes || ''
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
        return [header.join(','), ...rows].join('\n');
    };

    const openDrawer = (recordId) => {
        const record = records.find(item => item.id === recordId);
        if (!record || !drawer || !drawerContent) return;
        drawerContent.innerHTML = renderProcurementPlanDrawer(record);
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
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
            status: record.status
        };
        localStorage.setItem(procurementPlanningSelectedTenderKey, JSON.stringify(plannedTender));
        try {
            const existing = JSON.parse(localStorage.getItem(procurementPlanningCreateTenderDraftKey) || '{}');
            existing.mainDetails = {
                ...(existing.mainDetails || {}),
                title: record.tenderTitle,
                category: record.category,
                categories: [record.category],
                method: record.procurementMethod === 'Invited Tender' ? 'Invited Tender' : 'Open Tender',
                fundingSource: record.sourceOfFunds,
                status: /finished|done/i.test(`${record.status} ${record.planState}`) ? 'Planning done' : 'Planning draft',
                budget: record.budget
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
            root.querySelector('[data-plan-full-view]')?.removeAttribute('hidden');
            root.querySelector('[data-plan-full-view]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (target.closest('[data-plan-full-close]')) {
            event.preventDefault();
            root.querySelector('[data-plan-full-view]')?.setAttribute('hidden', '');
            return;
        }
        const openButton = target.closest('[data-plan-open]');
        if (openButton) {
            event.preventDefault();
            openDrawer(openButton.getAttribute('data-plan-open'));
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
        if (target.closest('[data-plan-close]')) {
            event.preventDefault();
            drawer?.classList.remove('open');
            drawer?.setAttribute('aria-hidden', 'true');
            return;
        }
        if (target.closest('[data-plan-editor-back]')) {
            event.preventDefault();
            closeEditor();
            return;
        }
        if (target.closest('[data-plan-add-row]')) {
            event.preventDefault();
            const form = root.querySelector('[data-procurement-plan-form]');
            const columns = Array.from(root.querySelectorAll('[data-plan-create-head] [data-column-id]')).map(cell => ({
                id: cell.getAttribute('data-column-id'),
                label: cell.textContent.trim(),
                type: procurementPlanningDefaultColumns.find(column => column.id === cell.getAttribute('data-column-id'))?.type || 'text',
                options: procurementPlanningDefaultColumns.find(column => column.id === cell.getAttribute('data-column-id'))?.options
            }));
            const periods = getProcurementPlanningPeriods(form?.planType?.value, form?.periodCount?.value);
            root.querySelector('[data-plan-create-body]')?.insertAdjacentHTML('beforeend', renderProcurementPlanningFormRow(root.querySelectorAll('[data-plan-create-row]').length, columns, periods));
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
            const label = prompt('Column name');
            if (!label) return;
            const id = `custom-${Date.now()}`;
            const head = root.querySelector('[data-plan-create-head]');
            const notesHead = head?.querySelector('th:nth-last-child(2)');
            notesHead?.insertAdjacentHTML('beforebegin', `<th data-column-id="${escapeProcurementPlanningHtml(id)}" data-custom-column="true">${escapeProcurementPlanningHtml(label)}</th>`);
            root.querySelectorAll('[data-plan-create-row]').forEach(row => {
                row.querySelector('td:nth-last-child(2)')?.insertAdjacentHTML('beforebegin', `<td data-column-id="${escapeProcurementPlanningHtml(id)}" data-custom-column="true"><input class="form-input" name="${escapeProcurementPlanningHtml(id)}"></td>`);
            });
            editorDirty = true;
            return;
        }
        if (target.closest('[data-plan-remove-column]')) {
            event.preventDefault();
            const customHeads = root.querySelectorAll('[data-plan-create-head] [data-custom-column="true"]');
            const last = customHeads[customHeads.length - 1];
            if (!last) {
                alert('Only custom columns can be removed.');
                return;
            }
            const id = last.getAttribute('data-column-id');
            root.querySelectorAll(`[data-column-id="${CSS.escape(id)}"]`).forEach(cell => cell.remove());
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
        if (event.target.matches('[data-plan-type], [data-period-count]')) {
            editorDirty = true;
        }
    });

    root.addEventListener('input', (event) => {
        if (event.target.closest('[data-procurement-plan-form]')) editorDirty = true;
    });

    root.querySelector('[data-procurement-plan-form]')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const year = String(new FormData(form).get('financialYear') || selectedYear());
        const periods = getProcurementPlanningPeriods(form.planType?.value, form.periodCount?.value);
        const rows = Array.from(root.querySelectorAll('[data-plan-create-row]'));
        const newRecords = rows.map((row, index) => {
            const data = new FormData();
            row.querySelectorAll('input, textarea, select').forEach(input => data.set(input.name, input.value));
            const customValues = {};
            row.querySelectorAll('[data-custom-column] input').forEach(input => { customValues[input.name] = input.value; });
            const periodValues = {};
            periods.forEach(period => { periodValues[period] = data.get(`period:${period}`) || ''; });
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
                status: data.get('status') || 'Draft planning',
                planState: 'Planning begun',
                periodValues,
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
        setEditorOpen(false);
    });

    window.addEventListener('beforeunload', (event) => {
        if (!editorDirty) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

window.renderTenderPlanning = renderTenderPlanning;
window.initializeTenderPlanning = initializeTenderPlanning;
