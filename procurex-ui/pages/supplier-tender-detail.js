// Supplier Tender Detail Page Component

const supplierTenderSavedStorageKey = 'procurex.supplierSavedTenders.v1';
const supplierTenderClarificationStorageKey = 'procurex.supplierClarifications.v1';
const supplierTenderCommunicationDraftStorageKey = 'procurex.communicationCenter.v1.composeDraft';
const supplierTenderClarificationCategories = ['Technical', 'Financial', 'Deliverables', 'Legal', 'Timeline', 'Commercial Schedule'];

function escapeSupplierTenderDetailHtml(value = '') {
    if (typeof escapeBidWorkspaceHtml === 'function') return escapeBidWorkspaceHtml(value);
    return String(value)
        .replace(/and/g, 'and')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function formatSupplierTenderMoney(value) {
    if (typeof formatBidWorkspaceMoney === 'function') return formatBidWorkspaceMoney(value);
    if (typeof formatCreateTenderMoney === 'function') return formatCreateTenderMoney(value);
    return `TZS ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function isProcurexTenderDetailMeaningful(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(isProcurexTenderDetailMeaningful);
    if (typeof value === 'object') return Object.values(value).some(isProcurexTenderDetailMeaningful);
    return String(value).trim() !== '';
}

function humanizeProcurexTenderDetailKey(value = '') {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, letter => letter.toUpperCase());
}

function formatProcurexTenderDetailScalar(value) {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value ?? '');
}

function getProcurexTenderDetailValueTitle(value, fallback = 'Item') {
    if (!value || typeof value !== 'object') return fallback;
    return [
        value.title,
        value.name,
        value.documentTitle,
        value.requirementName,
        value.deliverableName,
        value.activityTitle,
        value.responsibilityTitle,
        value.responsibility,
        value.positionTitle,
        value.position,
        value.milestone,
        value.workItem,
        value.itemDescription,
        value.productDescription,
        value.equipmentName,
        value.serviceTask,
        value.objectiveTitle,
        value.referenceName,
        value.reportType,
        value.license,
        value.text
    ].find(isProcurexTenderDetailMeaningful) || fallback;
}

function renderProcurexTenderDetailBadges(items = [], emptyText = 'Not specified') {
    const values = (Array.isArray(items) ? items : String(items || '').split(','))
        .map(item => typeof item === 'object' ? getProcurexTenderDetailValueTitle(item, '') : String(item || '').trim())
        .filter(Boolean);
    if (!values.length) return `<div class="scope-empty">${escapeSupplierTenderDetailHtml(emptyText)}</div>`;
    return `<div class="tender-detail-chip-list">${values.map(item => `<span>${escapeSupplierTenderDetailHtml(item)}</span>`).join('')}</div>`;
}

function renderProcurexTenderDetailSummary(rows = []) {
    const meaningfulRows = rows.filter(row => isProcurexTenderDetailMeaningful(row?.value));
    if (!meaningfulRows.length) return '<div class="scope-empty">No summary information configured.</div>';
    return `
        <div class="record-summary tender-detail-summary">
            ${meaningfulRows.map(row => `
                <div>
                    <span>${escapeSupplierTenderDetailHtml(row.label)}</span>
                    <strong>${escapeSupplierTenderDetailHtml(row.value)}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

function renderProcurexTenderDetailValue(value) {
    if (!isProcurexTenderDetailMeaningful(value)) return '<span class="tender-detail-muted">Not specified</span>';
    if (Array.isArray(value)) {
        if (value.every(item => typeof item !== 'object')) {
            return renderProcurexTenderDetailBadges(value);
        }
        return renderProcurexTenderDetailObjectList(value);
    }
    if (typeof value === 'object') {
        return renderProcurexTenderDetailObject(value);
    }
    return `<span>${escapeSupplierTenderDetailHtml(formatProcurexTenderDetailScalar(value))}</span>`;
}

function renderProcurexTenderDetailObject(item = {}) {
    const entries = Object.entries(item).filter(([, value]) => isProcurexTenderDetailMeaningful(value));
    if (!entries.length) return '<div class="scope-empty">No information configured.</div>';
    return `
        <div class="tender-detail-object">
            ${entries.map(([key, value]) => `
                <div>
                    <span>${escapeSupplierTenderDetailHtml(humanizeProcurexTenderDetailKey(key))}</span>
                    <strong>${typeof value === 'object'
                        ? escapeSupplierTenderDetailHtml(Array.isArray(value)
                            ? value.map(entry => typeof entry === 'object' ? getProcurexTenderDetailValueTitle(entry, '') : entry).filter(Boolean).join(', ')
                            : getProcurexTenderDetailValueTitle(value, 'Configured'))
                        : escapeSupplierTenderDetailHtml(formatProcurexTenderDetailScalar(value))}
                    </strong>
                </div>
            `).join('')}
        </div>
    `;
}

function renderProcurexTenderDetailObjectList(items = []) {
    const meaningfulItems = items.filter(isProcurexTenderDetailMeaningful);
    if (!meaningfulItems.length) return '<div class="scope-empty">No items configured.</div>';
    if (meaningfulItems.every(item => item && typeof item === 'object')) {
        const keys = [...new Set(meaningfulItems.flatMap(item => Object.keys(item).filter(key => isProcurexTenderDetailMeaningful(item[key]))))].slice(0, 6);
        if (keys.length && meaningfulItems.length > 1) {
            return `
                <div class="data-table tender-detail-table">
                    <table>
                        <thead><tr>${keys.map(key => `<th>${escapeSupplierTenderDetailHtml(humanizeProcurexTenderDetailKey(key))}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${meaningfulItems.map(item => `
                                <tr>
                                    ${keys.map(key => `
                                        <td>${escapeSupplierTenderDetailHtml(typeof item[key] === 'object'
                                            ? (Array.isArray(item[key])
                                                ? item[key].map(entry => typeof entry === 'object' ? getProcurexTenderDetailValueTitle(entry, '') : entry).filter(Boolean).join(', ')
                                                : getProcurexTenderDetailValueTitle(item[key], 'Configured'))
                                            : formatProcurexTenderDetailScalar(item[key] ?? ''))}</td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
    return `
        <div class="tender-detail-card-list">
            ${meaningfulItems.map((item, index) => `
                <article class="supplier-requirement-preview">
                    <span>${escapeSupplierTenderDetailHtml(`Item ${index + 1}`)}</span>
                    <strong>${escapeSupplierTenderDetailHtml(typeof item === 'object' ? getProcurexTenderDetailValueTitle(item, `Item ${index + 1}`) : item)}</strong>
                    ${typeof item === 'object' ? renderProcurexTenderDetailObject(item) : ''}
                </article>
            `).join('')}
        </div>
    `;
}

function renderProcurexTenderDetailFieldCards(fields = {}) {
    const entries = Object.entries(fields || {}).filter(([, value]) => isProcurexTenderDetailMeaningful(value));
    if (!entries.length) return '<div class="scope-empty">No structured requirement fields configured.</div>';
    return `
        <div class="tender-detail-field-grid">
            ${entries.map(([key, value]) => `
                <article class="tender-detail-field-card">
                    <span>${escapeSupplierTenderDetailHtml(humanizeProcurexTenderDetailKey(key))}</span>
                    ${renderProcurexTenderDetailValue(value)}
                </article>
            `).join('')}
        </div>
    `;
}

function renderProcurexTenderDetailListGroups(lists = {}) {
    const entries = Object.entries(lists || {}).filter(([, value]) => isProcurexTenderDetailMeaningful(value));
    if (!entries.length) return '';
    return `
        <div class="tender-detail-list-groups">
            ${entries.map(([key, value]) => `
                <article class="tender-detail-list-group">
                    <span class="section-kicker">${escapeSupplierTenderDetailHtml(humanizeProcurexTenderDetailKey(key))}</span>
                    ${renderProcurexTenderDetailValue(value)}
                </article>
            `).join('')}
        </div>
    `;
}

function renderProcurexTenderDetailCommercial(tender = {}, profile = {}) {
    const items = typeof getBidWorkspaceCommercialItems === 'function'
        ? getBidWorkspaceCommercialItems(tender, profile)
        : (tender.commercialItems || tender.boqItems || []);
    if (!items.length) return '<div class="scope-empty">No commercial schedule configured.</div>';
    return `
        <div class="data-table tender-detail-table">
            <table>
                <thead><tr><th>Code</th><th>Requirement</th><th>Qty / Duration</th><th>Unit</th><th>Rate / Estimate</th><th>Total</th></tr></thead>
                <tbody>
                    ${items.map((item, index) => {
                        const qty = Number(item.qty ?? item.quantity ?? 1) || 0;
                        const rate = Number(item.rate ?? item.unitPrice ?? 0) || 0;
                        const total = Number(item.total ?? item.totalPrice ?? (qty * rate)) || 0;
                        return `
                            <tr>
                                <td>${escapeSupplierTenderDetailHtml(item.item || item.itemNumber || `${index + 1}.1`)}</td>
                                <td>${escapeSupplierTenderDetailHtml(item.description || item.itemDescription || item.workItem || item.serviceTask || 'Tender requirement')}</td>
                                <td>${escapeSupplierTenderDetailHtml(qty || item.qty || item.quantity || 1)}</td>
                                <td>${escapeSupplierTenderDetailHtml(item.unit || item.unitOfMeasure || 'Lot')}</td>
                                <td>${rate ? escapeSupplierTenderDetailHtml(formatSupplierTenderMoney(rate)) : 'Supplier priced'}</td>
                                <td>${total ? escapeSupplierTenderDetailHtml(formatSupplierTenderMoney(total)) : 'Supplier priced'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderProcurexTenderDetailLicenses(tender = {}) {
    const licenses = tender.regulatoryLicenses || [];
    if (!licenses.length) return '<div class="scope-empty">No regulatory licenses configured for this tender.</div>';
    return `
        <div class="tender-detail-card-list">
            ${licenses.map(license => `
                <article class="supplier-requirement-preview">
                    <span>${escapeSupplierTenderDetailHtml(license.group || 'Regulatory license')}</span>
                    <strong>${escapeSupplierTenderDetailHtml(license.license || 'License requirement')}</strong>
                    <small>${escapeSupplierTenderDetailHtml(license.body || 'Issuing body not specified')} / ${license.mandatory === false ? 'Optional' : 'Mandatory'}</small>
                </article>
            `).join('')}
        </div>
    `;
}

function renderProcurexTenderDetailDocuments(documents = [], statusText = 'Available for review', emptyText = 'No tender documents configured.', options = {}) {
    if (!documents.length) return `<div class="scope-empty">${escapeSupplierTenderDetailHtml(emptyText)}</div>`;
    const tenderId = options.tenderId || '';
    const showActions = options.showActions === true;
    return `
        <div class="attachment-grid tender-detail-attachment-grid">
            ${documents.map(doc => `
                <div class="attachment-card">
                    <strong>${escapeSupplierTenderDetailHtml(doc)}</strong>
                    <span>${escapeSupplierTenderDetailHtml(statusText)}</span>
                    ${showActions ? `
                        <div class="attachment-actions">
                            <button class="btn btn-secondary" type="button" data-tender-annex-action="view" data-tender-id="${escapeSupplierTenderDetailHtml(tenderId)}" data-annex-name="${escapeSupplierTenderDetailHtml(doc)}">View</button>
                            <button class="btn btn-secondary" type="button" data-tender-annex-action="download" data-tender-id="${escapeSupplierTenderDetailHtml(tenderId)}" data-annex-name="${escapeSupplierTenderDetailHtml(doc)}">Download</button>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function getProcurexTenderSubmissionDocuments(tender = {}, profile = {}) {
    const seen = new Set();
    return [
        ...(profile.submissionDocuments || []),
        ...(tender.requiredSubmissionDocuments || [])
    ]
        .map(item => typeof item === 'object' ? getProcurexTenderDetailValueTitle(item, '') : String(item || '').trim())
        .filter(Boolean)
        .filter(item => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getProcurexTenderEligibilityComplianceItems(tender = {}, profile = {}) {
    const seen = new Set();
    return [
        ...(tender.regulatoryLicenses || []).map(license => [
            license.license || license.registrationType || license.regulatoryBody || 'Regulatory license',
            license.body || license.group || ''
        ].filter(Boolean).join(' - ')),
        ...getProcurexTenderSubmissionDocuments(tender, profile)
    ]
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter(item => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function renderProcurexTenderDocumentSection(number, title, kicker, content, aside = '', anchorId = '') {
    return `
        <article class="tender-document-section" ${anchorId ? `id="${escapeSupplierTenderDetailHtml(anchorId)}" data-supplier-document-section="${escapeSupplierTenderDetailHtml(anchorId)}"` : ''}>
            <div class="tender-document-section-heading">
                <span>${escapeSupplierTenderDetailHtml(number)}</span>
                <div>
                    <small>${escapeSupplierTenderDetailHtml(kicker)}</small>
                    <h3>${escapeSupplierTenderDetailHtml(title)}</h3>
                </div>
                ${aside}
            </div>
            <div class="tender-document-section-body">
                ${content}
            </div>
        </article>
    `;
}

function renderProcurexTenderDetailFullSections(tender = {}, profile = {}, options = {}) {
    const documents = tender.documents?.length ? tender.documents : profile.documentLabels || ['Tender document'];
    const requirementSet = options.requirementSet || getSupplierTenderRequirementSet(tender, profile);
    const clarifications = options.clarifications || getSupplierTenderClarifications(tender);
    const amendments = options.amendments || tender.amendments || [];
    const interestedSuppliers = options.interestedSuppliers || tender.interestedSuppliers || [];
    const eligibilityComplianceItems = getProcurexTenderEligibilityComplianceItems(tender, profile);
    const showActivity = options.showActivity !== false;
    const showMarketplaceActivity = options.showMarketplaceActivity === true;
    const showSupplierInterest = options.showSupplierInterest === true;

    return `
        <section class="tender-document-view">
            <header class="tender-document-cover">
                <div>
                    <span class="section-kicker">Tender document</span>
                    <h2>${escapeSupplierTenderDetailHtml(tender.title || 'Tender brief')}</h2>
                    <p>${escapeSupplierTenderDetailHtml(tender.description || 'Review the structured tender information before preparing a bid.')}</p>
                </div>
                <div class="tender-document-stamp">
                    <strong>${escapeSupplierTenderDetailHtml(tender.status || 'Open')}</strong>
                    <span>${escapeSupplierTenderDetailHtml(tender.type || 'Tender')}</span>
                </div>
            </header>

            <div class="tender-document-meta-table">
                ${renderProcurexTenderDetailSummary([
                    { label: 'Tender ID', value: tender.id },
                    { label: 'Procuring entity', value: tender.organization },
                    { label: 'Procurement type', value: tender.type },
                    { label: 'Procurement method', value: tender.method },
                    { label: 'Visibility', value: tender.visibility },
                    { label: 'Budget estimate', value: formatSupplierTenderMoney(tender.budget) },
                    { label: 'Closing date', value: tender.closingDate },
                    { label: 'Location', value: tender.location },
                    { label: 'Commercial model', value: tender.commercialModel || profile.commercialName },
                    { label: 'Contract type', value: tender.contractType },
                    { label: 'Eligibility', value: tender.eligibility }
                ])}
                <div class="tender-document-categories">
                    <span>Categories</span>
                    ${renderProcurexTenderDetailBadges(tender.categories?.length ? tender.categories : [tender.category || tender.type])}
                </div>
            </div>

            ${renderProcurexTenderDocumentSection('1', 'Instructions and Tender Scope', 'General information', `
                <p class="tender-document-paragraph">${escapeSupplierTenderDetailHtml(tender.description || 'No narrative description provided.')}</p>
                ${renderProcurexTenderDetailFieldCards(tender.requirements?.fields || {})}
                ${renderProcurexTenderDetailListGroups(tender.requirements?.lists || {})}
                ${renderSupplierTenderClarificationPrompt('Need clarification on these structured requirements?', 'Technical')}
            `)}

            ${renderProcurexTenderDocumentSection('2', 'Eligibility and Compliance Requirements', 'Supplier qualification', `
                ${renderProcurexTenderDetailDocuments(
                    eligibilityComplianceItems,
                    'Required for eligibility and compliance',
                    'No eligibility and compliance items configured.'
                )}
            `, `<span class="badge badge-warning">${eligibilityComplianceItems.length} items</span>`)}

            ${renderProcurexTenderDocumentSection('3', 'Documents and Annexes', 'Tender pack', `
                ${renderProcurexTenderDetailDocuments(documents, 'Available to view or download', 'No tender documents configured.', {
                    showActions: true,
                    tenderId: tender.id
                })}
            `, `<span class="badge badge-info">${documents.length} files</span>`)}

            ${renderProcurexTenderDocumentSection('4', 'Evaluation Criteria and Submission Responses', 'Bid evaluation', `
                <div class="data-table tender-detail-table">
                    <table>
                        <thead><tr><th>Criterion</th><th>Weight</th><th>Supplier focus</th></tr></thead>
                        <tbody>${renderSupplierTenderEvaluationRows(tender, profile)}</tbody>
                    </table>
                </div>
                ${renderSupplierTenderClarificationPrompt('Need clarification about evaluation criteria?', 'Technical')}
            `, '<span class="badge badge-success">Published</span>')}

            ${renderProcurexTenderDocumentSection('5', 'Programme and Key Dates', 'Tender timeline', `
                <div class="supplier-timeline-list">
                    ${renderSupplierTenderTimeline(tender)}
                </div>
                ${renderSupplierTenderClarificationPrompt('Need clarification about milestones or field visit timing?', 'Timeline')}
            `, `<span class="badge badge-info">${(tender.milestones || []).length || 4} milestones</span>`)}

          
            ${renderProcurexTenderDocumentSection('6', 'Deliverables and Required Outputs', 'Contract outputs', `
                ${renderProcurexTenderDetailValue(tender.deliverables || [])}
                ${renderSupplierTenderClarificationPrompt('Need clarification about deliverables?', 'Deliverables')}
            `, `<span class="badge badge-info">${(tender.deliverables || []).length} listed</span>`)}

            ${showMarketplaceActivity ? renderProcurexTenderDocumentSection('7', 'Clarifications and Amendments', 'Marketplace activity', `
                <div class="tender-detail-card-list">
                    ${clarifications.length ? clarifications.map(item => `
                        <article class="supplier-requirement-preview">
                            <span>Clarification</span>
                            <strong>${escapeSupplierTenderDetailHtml(item.title || item.question || 'Clarification')}</strong>
                            <small>${escapeSupplierTenderDetailHtml(item.question || item.detail || item.answer || item.status || 'Pending buyer response')}</small>
                        </article>
                    `).join('') : ''}
                    ${amendments.length ? amendments.map(item => `
                        <article class="supplier-requirement-preview">
                            <span>Amendment</span>
                            <strong>${escapeSupplierTenderDetailHtml(item.title || 'Amendment')}</strong>
                            <small>${escapeSupplierTenderDetailHtml(item.detail || item.status || 'No details provided')}</small>
                        </article>
                    `).join('') : ''}
                    ${!clarifications.length && !amendments.length ? '<div class="scope-empty">No clarifications or amendments yet.</div>' : ''}
                </div>
            `, `<span class="badge badge-info">${clarifications.length + amendments.length} items</span>`) : ''}

            ${showSupplierInterest && interestedSuppliers.length ? renderProcurexTenderDocumentSection('8', 'Supplier Interest', 'Buyer-side signal', `
                ${renderProcurexTenderDetailObjectList(interestedSuppliers)}
            `, `<span class="badge badge-info">${interestedSuppliers.length} suppliers</span>`) : ''}
        </section>
    `;
}

function getSupplierTenderSavedIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(supplierTenderSavedStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function getSupplierTenderStoredClarifications(tenderId = '') {
    try {
        const parsed = JSON.parse(localStorage.getItem(supplierTenderClarificationStorageKey) || '{}');
        return Array.isArray(parsed[tenderId]) ? parsed[tenderId] : [];
    } catch (error) {
        return [];
    }
}

function readSupplierTenderCommunicationItems() {
    const storedItems = (() => {
        try {
            const parsed = JSON.parse(localStorage.getItem('procurex.communicationCenter.v1.items') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    })();
    return [
        ...(mockData.communicationCenter?.items || []),
        ...storedItems
    ];
}

function getSupplierTenderCommunicationClarifications(tender = {}) {
    const tenderKeys = new Set([tender.id, tender.tenderReference].filter(Boolean).map(value => String(value).toLowerCase()));
    if (!tenderKeys.size) return [];

    return readSupplierTenderCommunicationItems()
        .filter(item => String(item.kind || item.type || '').toLowerCase() === 'clarification')
        .filter(item => tenderKeys.has(String(item.tenderId || item.tenderReference || '').toLowerCase()))
        .map(item => {
            const thread = Array.isArray(item.thread) && item.thread.length
                ? item.thread
                : [{ senderType: item.senderType, senderName: item.senderName, body: item.body, createdAt: item.createdAt }];
            const supplierEntry = thread.find(entry => /supplier/i.test(`${entry.senderType || ''} ${entry.senderName || ''}`)) || thread[0] || {};
            const buyerEntry = [...thread].reverse().find(entry => /buyer|procuring/i.test(`${entry.senderType || ''} ${entry.senderName || ''}`));
            const answered = Boolean(buyerEntry?.body) || /answered|published|resolved|replied/i.test(item.status || '');
            if (!answered) return null;

            return {
                title: item.subject || `${item.category || 'Tender'} clarification`,
                category: item.category || 'Tender Clarification',
                question: supplierEntry.body || item.body || item.subject || 'Clarification question',
                answer: buyerEntry?.body || item.answer || item.detail || 'Buyer response published.',
                detail: buyerEntry?.body || item.detail || item.body || '',
                status: item.status || 'Answered',
                context: item.tenderReference || tender.id,
                createdAt: item.createdAt,
                source: 'communication-center'
            };
        })
        .filter(Boolean);
}

function getSupplierTenderClarifications(tender = {}) {
    const seen = new Set();
    return [
        ...(tender.clarifications || []),
        ...getSupplierTenderStoredClarifications(tender.id),
        ...getSupplierTenderCommunicationClarifications(tender)
    ].filter(item => {
        const key = `${item.category || ''}::${item.question || item.detail || item.title || ''}::${item.answer || ''}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getSupplierTenderClarificationDeadline(tender = {}) {
    const milestone = (tender.milestones || []).find(item => /clarification/i.test(`${item.name || item.title || item.id || ''}`));
    return milestone?.date || null;
}

function getSupplierTenderClarificationDeadlineState(tender = {}) {
    const deadline = getSupplierTenderClarificationDeadline(tender);
    const time = Date.parse(`${deadline}T23:59:59`);
    const valid = Number.isFinite(time);
    const days = valid ? Math.ceil((time - Date.now()) / 86400000) : null;
    return {
        deadline,
        valid,
        closed: valid && time < Date.now(),
        daysRemaining: valid ? Math.max(0, days) : null,
        label: valid ? formatSupplierTenderDate(deadline) : 'Not set'
    };
}

function formatSupplierTenderDate(date) {
    const time = Date.parse(`${date}T00:00:00`);
    if (!Number.isFinite(time)) return date || 'Not set';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(time));
}

function getSupplierTenderClarificationStatusClass(status = '') {
    const raw = String(status || '').toLowerCase();
    if (raw.includes('amendment')) return 'badge-warning';
    if (raw.includes('answered') || raw.includes('published') || raw.includes('resolved') || raw.includes('replied')) return 'badge-success';
    if (raw.includes('closed')) return 'badge-info';
    return 'badge-warning';
}

function renderSupplierTenderClarificationDeadline(tender = {}) {
    const state = getSupplierTenderClarificationDeadlineState(tender);
    if (!state.valid) {
        return `
            <div class="clarification-deadline-card">
                <strong>Clarification deadline not set</strong>
                <span>Confirm the buyer's deadline before preparing questions.</span>
            </div>
        `;
    }
    return `
        <div class="clarification-deadline-card ${state.closed ? 'closed' : ''}">
            <strong>${state.closed ? 'Clarification period closed' : `Clarifications close in ${state.daysRemaining} days`}</strong>
            <span>${state.closed ? 'Buyer can no longer respond to pre-bid questions.' : `Deadline: ${escapeSupplierTenderDetailHtml(state.label)}`}</span>
        </div>
    `;
}

function renderSupplierTenderClarificationOptions(selected = '') {
    return supplierTenderClarificationCategories
        .map(category => `<option ${category === selected ? 'selected' : ''}>${escapeSupplierTenderDetailHtml(category)}</option>`)
        .join('');
}

function renderSupplierTenderPublicClarificationFeed(clarifications = []) {
    if (!clarifications.length) return '<div class="scope-empty">No public clarification responses yet.</div>';
    return clarifications.map(item => {
        const question = item.question || item.detail || item.title || 'Clarification question';
        const answer = item.answer || (/answered|published/i.test(item.status || '') ? item.detail : '') || 'Pending buyer response.';
        const status = item.status || (item.answer ? 'Answered' : 'Pending');
        return `
            <article class="public-clarification-item">
                <div class="public-clarification-topline">
                    <span>${escapeSupplierTenderDetailHtml(item.category || 'Technical')}</span>
                    <em class="badge ${getSupplierTenderClarificationStatusClass(status)}">${escapeSupplierTenderDetailHtml(status)}</em>
                </div>
                <p><strong>Q:</strong> ${escapeSupplierTenderDetailHtml(question)}</p>
                <p><strong>A:</strong> ${escapeSupplierTenderDetailHtml(answer)}</p>
                ${item.source === 'communication-center' ? '<small>Buyer response from Communication Center</small>' : ''}
                ${item.context ? `<small>Context: ${escapeSupplierTenderDetailHtml(item.context)}</small>` : ''}
            </article>
        `;
    }).join('');
}

function renderSupplierTenderClarificationPrompt(context = '', category = 'Technical') {
    return `
        <div class="contextual-clarification-prompt">
            <span>${escapeSupplierTenderDetailHtml(context || 'Need clarification on this section?')}</span>
            <button class="btn btn-secondary" type="button" data-supplier-focus-clarification data-clarification-context="${escapeSupplierTenderDetailHtml(context)}" data-clarification-category="${escapeSupplierTenderDetailHtml(category)}">Ask Buyer</button>
        </div>
    `;
}

function getSupplierTenderRequirementSet(tender, profile) {
    if (typeof getBidWorkspaceRequirementSet === 'function') return getBidWorkspaceRequirementSet(tender, profile);
    return {
        mandatory: [
            {
                id: 'eligibility',
                title: 'Confirm eligibility',
                category: 'Administrative compliance',
                description: tender.eligibility || 'Supplier must confirm eligibility before bidding.'
            }
        ],
        optional: profile.bidderPreparation?.map((item, index) => ({
            id: `optional-${index}`,
            title: item,
            category: 'Bid response',
            description: 'Complete during bid submission.'
        })) || []
    };
}

function renderSupplierTenderRequirementList(requirements = [], emptyText = 'No requirements configured.') {
    if (!requirements.length) return `<div class="scope-empty">${escapeSupplierTenderDetailHtml(emptyText)}</div>`;
    return requirements.map(requirement => `
        <article class="supplier-requirement-preview">
            <span>${escapeSupplierTenderDetailHtml(requirement.category || 'Requirement')}</span>
            <strong>${escapeSupplierTenderDetailHtml(requirement.title)}</strong>
            <small>${escapeSupplierTenderDetailHtml(requirement.description || 'Supplier response required.')}</small>
        </article>
    `).join('');
}

function isSupplierTenderTruthy(value) {
    if (value === true) return true;
    const raw = String(value || '').trim().toLowerCase();
    return ['true', 'yes', 'required', 'mandatory'].includes(raw);
}

function getSupplierTenderRequirementText(requirement = {}) {
    return `${requirement.title || ''} ${requirement.description || ''} ${requirement.category || ''}`.toLowerCase();
}

function isSupplierTenderLicenseRequirement(requirement = {}) {
    return /license|licence|permit|regulatory|registration certificate|osha|crb|nemc|tmda|ewura|tcra|wma|gcla/.test(getSupplierTenderRequirementText(requirement));
}

function isSupplierTenderCvRequirement(requirement = {}) {
    return /\bcvs?\b|curriculum vitae|key personnel|staff qualification|personnel evidence/.test(getSupplierTenderRequirementText(requirement));
}

function isSupplierTenderCommercialScheduleRequirement(requirement = {}) {
    const text = getSupplierTenderRequirementText(requirement);
    return /boq rows|quantity schedule|commercial items|commercial schedule|pricing rows|priced boq|boq pricing|price schedule|financial proposal|financial offer|rate schedule/.test(text);
}

function isSupplierTenderTimelineRequirement(requirement = {}) {
    const text = getSupplierTenderRequirementText(requirement);
    return /milestone rows|works milestone|milestone:|target date|liquidated damages|programme and key dates|tender timeline/.test(text);
}

function isSupplierTenderDocumentRequirement(requirement = {}) {
    if (isSupplierTenderCommercialScheduleRequirement(requirement) || isSupplierTenderTimelineRequirement(requirement)) return false;
    return requirement.responseType === 'upload'
        || /document|certificate|clearance|statement|security|authorization|authorisation|evidence|proof|methodology|schedule|plan|boq|form|declaration|policy|insurance|catalogue|catalog/.test(getSupplierTenderRequirementText(requirement));
}

function getSupplierTenderDocumentDescription(title = '', fallback = '') {
    const raw = String(title || '').toLowerCase();
    if (/bid security/.test(raw)) return 'Bid security or bond in the form, amount, and validity period stated by the buyer.';
    if (/legal form|completed form/.test(raw)) return 'Signed statutory and tender forms completed by the authorized representative.';
    if (/methodology|method statement|work methodology/.test(raw)) return 'Method statement explaining approach, sequencing, quality control, health and safety, and site management.';
    if (/construction schedule|work program|gantt|programme/.test(raw)) return 'Work programme showing activities, milestones, sequencing, and completion period.';
    if (/equipment/.test(raw)) return 'Ownership, lease, availability, or inspection evidence for the equipment proposed for the tender.';
    if (/priced boq|boq/.test(raw)) return 'Completed BOQ or price schedule with rates, totals, and any required pricing assumptions.';
    if (/business license/.test(raw)) return 'Current business license matching the supplier legal entity and business activity.';
    if (/incorporation|registration/.test(raw)) return 'Company registration or incorporation certificate proving the supplier legal status.';
    if (/tax clearance/.test(raw)) return 'Current tax clearance certificate issued by the relevant tax authority.';
    if (/manufacturer/.test(raw)) return 'Manufacturer authorization letter or dealership evidence for the offered goods.';
    if (/past supply|similar|experience|reference|completed project/.test(raw)) return 'Evidence of similar completed contracts, such as contracts, completion certificates, or client references.';
    if (/audited|financial statement/.test(raw)) return 'Audited financial statements for the period requested by the buyer.';
    if (/bank statement|bank letter|credit/.test(raw)) return 'Bank statements or bank letter proving financial capacity for the requested period.';
    if (/insurance/.test(raw)) return 'Valid insurance certificate covering the scope requested in the tender.';
    if (/catalog|catalogue|brochure/.test(raw)) return 'Product catalogue or brochure matching the items offered in the tender.';
    if (/safety|hse|health/.test(raw)) return 'Health and safety plan or certificate relevant to the work, service, or supply scope.';
    return fallback || 'Submit the named document as evidence for eligibility, technical responsiveness, or evaluation.';
}

function formatSupplierTenderGuideTitle(value = '') {
    const formatted = String(value || '').trim()
        .replace(/\bCvs\b/g, 'CVs')
        .replace(/\bCv\b/g, 'CV')
        .replace(/\bBoq\b/g, 'BOQ')
        .replace(/\bOsha\b/g, 'OSHA')
        .replace(/\bCrb\b/g, 'CRB');
    if (/similar/i.test(formatted) && /(project|assignment|contract|experience)/i.test(formatted)) {
        return 'Similar completed project evidence';
    }
    return formatted;
}

function getSupplierTenderGuideDedupeKey(value = '') {
    const title = formatSupplierTenderGuideTitle(value);
    if (/similar completed project evidence/i.test(title)) return 'similar completed project evidence';
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function addSupplierTenderGuideItem(items, seen, item = {}) {
    const title = formatSupplierTenderGuideTitle(item.title);
    if (!title) return;
    const key = getSupplierTenderGuideDedupeKey(title);
    if (seen.has(key)) {
        const index = seen.get(key);
        if (Number.isInteger(index) && items[index]) {
            items[index].required = items[index].required || item.required !== false;
            if (!items[index].description && item.description) items[index].description = item.description;
        }
        return;
    }
    seen.set(key, items.length);
    items.push({
        title,
        eyebrow: item.eyebrow || 'Required document',
        description: item.description || getSupplierTenderDocumentDescription(title),
        required: item.required !== false
    });
}

function getSupplierTenderCvGuideItems(tender = {}, requirementSet = {}) {
    const fields = tender.requirements?.fields || {};
    const items = [];
    const seen = new Map();
    const addCv = (title, description, required = true) => addSupplierTenderGuideItem(items, seen, {
        title,
        eyebrow: 'CV / personnel evidence',
        description,
        required
    });

    (fields.personnelRequirementRows || []).forEach(row => {
        if (!isSupplierTenderTruthy(row.cvRequired)) return;
        const position = row.position || row.positionTitle || 'Key personnel';
        const details = [
            row.minimumEducation ? `minimum education: ${row.minimumEducation}` : '',
            row.minimumQualification ? `minimum qualification: ${row.minimumQualification}` : '',
            row.minimumYearsExperience ? `${row.minimumYearsExperience} years experience` : '',
            row.yearsOfExperience ? `${row.yearsOfExperience} years experience` : '',
            row.certifications ? `certification: ${row.certifications}` : ''
        ].filter(Boolean).join(', ');
        addCv(`${position} CV`, details ? `Upload the proposed ${position} CV showing ${details}.` : `Upload the proposed ${position} CV and supporting qualification evidence.`, row.mandatory !== false);
    });

    (fields.consultancyKeyExperts || []).forEach(row => {
        const position = row.positionTitle || 'Key expert';
        const details = [
            row.minimumQualification ? `minimum qualification: ${row.minimumQualification}` : '',
            row.yearsOfExperience ? `${row.yearsOfExperience} years experience` : '',
            row.certifications ? `certification: ${row.certifications}` : ''
        ].filter(Boolean).join(', ');
        addCv(`${position} CV`, details ? `Upload the proposed ${position} CV showing ${details}.` : `Upload the proposed ${position} CV and qualification evidence.`, row.mandatory !== false);
    });

    (fields.consultancyIndividualQualifications || []).forEach(row => {
        if (!isSupplierTenderTruthy(row.cvRequired)) return;
        const registrations = Array.isArray(row.professionalRegistrationsCertifications)
            ? row.professionalRegistrationsCertifications.join(', ')
            : row.professionalRegistrationsCertifications;
        const details = [
            row.yearsOfExperience ? `${row.yearsOfExperience} years experience` : '',
            registrations ? `registration/certification: ${registrations}` : '',
            row.similarAssignmentsCount ? `${row.similarAssignmentsCount} similar assignments` : ''
        ].filter(Boolean).join(', ');
        addCv('Individual consultant CV', details ? `Upload the individual consultant CV showing ${details}.` : 'Upload the individual consultant CV and professional qualification evidence.');
    });

    [...(requirementSet.mandatory || []), ...(requirementSet.optional || [])]
        .filter(isSupplierTenderCvRequirement)
        .filter(requirement => !(isSupplierTenderTruthy(fields.keyPersonnelCvsRequired) && /key personnel/i.test(requirement.title || '')))
        .filter(requirement => !((fields.personnelRequirementRows || []).length && /personnel requirement rows/i.test(`${requirement.title || ''} ${requirement.category || ''}`)))
        .forEach(requirement => {
            addCv(requirement.title, requirement.description || getSupplierTenderDocumentDescription(requirement.title), requirement.mandatory !== false);
        });

    return items;
}

function getSupplierTenderRequiredDocumentGuideItems(tender = {}, profile = {}, requirementSet = {}) {
    const fields = tender.requirements?.fields || {};
    const items = [];
    const seen = new Map();
    const requirementDocuments = [...(requirementSet.mandatory || []), ...(requirementSet.optional || [])]
        .filter(requirement => !isSupplierTenderCommercialScheduleRequirement(requirement))
        .filter(requirement => !isSupplierTenderTimelineRequirement(requirement))
        .filter(requirement => isSupplierTenderDocumentRequirement(requirement))
        .filter(requirement => !isSupplierTenderLicenseRequirement(requirement))
        .filter(requirement => !isSupplierTenderCvRequirement(requirement));

    requirementDocuments.forEach(requirement => addSupplierTenderGuideItem(items, seen, {
            title: requirement.title,
            eyebrow: requirement.mandatory === false ? 'Supporting document' : 'Required document',
            description: requirement.description || getSupplierTenderDocumentDescription(requirement.title),
            required: requirement.mandatory !== false
        }));

    (fields.supportingDocumentRows || []).forEach(row => addSupplierTenderGuideItem(items, seen, {
        title: row.documentName || row.documentTitle || 'Supporting document',
        eyebrow: row.mandatory === false ? 'Supporting document' : 'Required document',
        description: row.description || row.notes || getSupplierTenderDocumentDescription(row.documentName || row.documentTitle),
        required: row.mandatory !== false
    }));

    if (isSupplierTenderTruthy(fields.similarCompletedProjectsRequired)) {
        addSupplierTenderGuideItem(items, seen, {
            title: 'Similar completed project evidence',
            description: 'Submit contracts, completion certificates, or client references showing relevant completed work of similar scope.'
        });
    }

    if (isSupplierTenderTruthy(fields.bankStatementsRequired)) {
        addSupplierTenderGuideItem(items, seen, {
            title: 'Bank statements and financial capacity evidence',
            description: fields.bankStatementPeriod || 'Submit bank statements and financial capacity evidence for the period requested by the buyer.'
        });
    }

    (profile.submissionDocuments || []).forEach(title => {
        if (isSupplierTenderCvRequirement({ title })) return;
        if (isSupplierTenderCommercialScheduleRequirement({ title })) return;
        if (seen.has(getSupplierTenderGuideDedupeKey(title))) return;
        const matchingRequirement = requirementDocuments.find(requirement => getSupplierTenderGuideDedupeKey(requirement.title) === getSupplierTenderGuideDedupeKey(title));
        addSupplierTenderGuideItem(items, seen, {
            title,
            eyebrow: matchingRequirement?.mandatory === false ? 'Supporting document' : 'Required document',
            description: matchingRequirement?.description || getSupplierTenderDocumentDescription(title),
            required: matchingRequirement ? matchingRequirement.mandatory !== false : false
        });
    });

    return items;
}

function getSupplierTenderLicenseGuideItems(tender = {}) {
    const seen = new Map();
    const items = [];
    (tender.regulatoryLicenses || []).forEach(license => addSupplierTenderGuideItem(items, seen, {
        title: license.license || license.registrationType || 'Regulatory license',
        eyebrow: license.group || 'License / certification',
        description: `${license.body || 'Issuing authority not specified'}. Submit current license copy, registration number, validity status, and expiry date where applicable.`,
        required: license.mandatory !== false
    }));
    return items;
}

function getSupplierTenderTemplateGuideItems(tender = {}) {
    const fields = tender.requirements?.fields || {};
    const items = [];
    const seen = new Map();

    if (fields.productSpecificationTemplate) {
        addSupplierTenderGuideItem(items, seen, {
            title: 'Product specification template',
            eyebrow: 'Template',
            description: 'Complete the buyer specification template for each offered item, including standards, warranty, packaging, and sample notes where requested.'
        });
    }

    (fields.technicalSpecificationDocuments || []).forEach(row => addSupplierTenderGuideItem(items, seen, {
        title: row.documentTitle || row.documentType || 'Technical specification document',
        eyebrow: 'Reference document',
        description: row.documentUpload
            ? `Use ${row.documentUpload} when preparing the technical response.`
            : 'Use this buyer technical document when preparing the response.',
        required: row.mandatory !== false
    }));

    (fields.sampleRequirementRows || []).forEach(row => addSupplierTenderGuideItem(items, seen, {
        title: `${row.relatedBoqItem || row.productName || 'Tender item'} sample`,
        eyebrow: 'Sample requirement',
        description: [
            row.sampleDescription || 'Physical sample required where marked by the buyer.',
            row.numberOfSamples ? `${row.numberOfSamples} sample${Number(row.numberOfSamples) === 1 ? '' : 's'}` : '',
            row.deliveryLocation ? `deliver to ${row.deliveryLocation}` : '',
            row.deliveryDeadline ? `by ${row.deliveryDeadline}` : ''
        ].filter(Boolean).join('; '),
        required: row.mandatory !== false
    }));

    return items;
}

function getSupplierTenderOtherResponseGuideItems(tender = {}, requirementSet = {}) {
    const fields = tender.requirements?.fields || {};
    const items = [];
    const seen = new Map();

    (fields.otherEligibilityRequirements || []).forEach(row => addSupplierTenderGuideItem(items, seen, {
        title: row.requirementName || row.title || 'Eligibility requirement',
        eyebrow: 'Eligibility requirement',
        description: row.notes || 'Provide a short response and attach evidence where requested by the buyer.',
        required: row.mandatory !== false
    }));

    [...(requirementSet.mandatory || []), ...(requirementSet.optional || [])]
        .filter(requirement => !isSupplierTenderCommercialScheduleRequirement(requirement))
        .filter(requirement => !isSupplierTenderTimelineRequirement(requirement))
        .filter(requirement => !isSupplierTenderDocumentRequirement(requirement))
        .filter(requirement => !isSupplierTenderLicenseRequirement(requirement))
        .filter(requirement => !isSupplierTenderCvRequirement(requirement))
        .slice(0, 8)
        .forEach(requirement => addSupplierTenderGuideItem(items, seen, {
            title: requirement.title,
            eyebrow: requirement.category || 'Response requirement',
            description: requirement.description || 'Respond to this buyer-defined requirement in the bid workspace.',
            required: requirement.mandatory !== false
        }));

    return items;
}

function renderSupplierTenderGuideCards(items = [], emptyText = 'No items configured.') {
    if (!items.length) return `<div class="scope-empty">${escapeSupplierTenderDetailHtml(emptyText)}</div>`;
    return `
        <div class="supplier-document-guide-card-list">
            ${items.map(item => `
                <article class="supplier-document-guide-card">
                    <div>
                        <span>${escapeSupplierTenderDetailHtml(item.eyebrow || 'Requirement')}</span>
                        <em class="badge ${item.required === false ? 'badge-info' : 'badge-warning'}">${item.required === false ? 'Conditional' : 'Required'}</em>
                    </div>
                    <strong>${escapeSupplierTenderDetailHtml(item.title)}</strong>
                    <p>${escapeSupplierTenderDetailHtml(item.description || 'Submit evidence as requested by the buyer.')}</p>
                </article>
            `).join('')}
        </div>
    `;
}

function renderSupplierTenderDocumentationInnerSection(title, kicker, items, emptyText) {
    return `
        <section class="supplier-document-guide-section">
            <div class="supplier-document-guide-heading">
                <div>
                    <span class="section-kicker">${escapeSupplierTenderDetailHtml(kicker)}</span>
                    <h4>${escapeSupplierTenderDetailHtml(title)}</h4>
                </div>
                <span class="badge badge-info">${items.length} item${items.length === 1 ? '' : 's'}</span>
            </div>
            ${renderSupplierTenderGuideCards(items, emptyText)}
        </section>
    `;
}

function renderSupplierTenderEvaluationRows(tender, profile) {
    const criteria = tender.evaluation?.criteria?.length
        ? tender.evaluation.criteria.map(item => [item.name, item.weight, (item.subcriteria || []).join(', ')])
        : (profile.evaluationCriteria || []);
    return criteria.map(item => `
        <tr>
            <td>${escapeSupplierTenderDetailHtml(item[0] || item.name || 'Criterion')}</td>
            <td>${escapeSupplierTenderDetailHtml(item[1] || item.weight || 0)}%</td>
            <td>${escapeSupplierTenderDetailHtml(item[2] || item.description || 'Buyer-defined scoring focus')}</td>
        </tr>
    `).join('');
}

function renderSupplierTenderCommercialPreview(tender, profile) {
    return renderProcurexTenderDetailCommercial(tender, profile);
}

function renderSupplierTenderTimeline(tender = {}) {
    const milestones = Array.isArray(tender.milestones) && tender.milestones.length
        ? tender.milestones
        : [
            { name: 'Clarification deadline', date: 'Before closing' },
            { name: 'Bid closing', date: tender.closingDate || 'Not set' },
            { name: 'Bid opening', date: tender.closingDate || 'After closing' },
            { name: 'Evaluation', date: 'After bid opening' }
        ];
    return milestones.map(item => `
        <div class="timeline-row">
            <strong>${escapeSupplierTenderDetailHtml(item.name || item.title || 'Milestone')}</strong>
            <span>${escapeSupplierTenderDetailHtml(item.date || item.targetDate || 'Not set')}</span>
        </div>
    `).join('');
}

function renderSupplierTenderTabButtons(tabs = [], group = '', activeId = '') {
    return `
        <div class="supplier-detail-tabs" role="tablist" data-supplier-tab-list="${escapeSupplierTenderDetailHtml(group)}">
            ${tabs.map(tab => `
                <button class="supplier-detail-tab ${tab.id === activeId ? 'active' : ''}" type="button" role="tab" aria-selected="${tab.id === activeId ? 'true' : 'false'}" data-supplier-tab-target="${escapeSupplierTenderDetailHtml(tab.id)}">
                    ${escapeSupplierTenderDetailHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

function renderSupplierTenderTabPanels(tabs = [], activeId = '') {
    return `
        <div class="supplier-detail-tab-panels">
            ${tabs.map(tab => `
                <section class="supplier-detail-tab-panel" role="tabpanel" data-supplier-tab-panel="${escapeSupplierTenderDetailHtml(tab.id)}" style="display: ${tab.id === activeId ? 'block' : 'none'};">
                    ${tab.content}
                </section>
            `).join('')}
        </div>
    `;
}

function renderSupplierTenderSubTabs(tabs = [], activeId = '') {
    return `
        <div class="supplier-detail-subtabs">
            ${renderSupplierTenderTabButtons(tabs, 'sub', activeId)}
            ${renderSupplierTenderTabPanels(tabs, activeId)}
        </div>
    `;
}

function renderSupplierTenderDocumentJumpNav(sections = []) {
    return `
        <div class="supplier-detail-subtabs supplier-detail-document-index">
            <div class="supplier-detail-tabs" data-supplier-jump-list>
                ${sections.map((section, index) => `
                    <button class="supplier-detail-tab ${index === 0 ? 'active' : ''}" type="button" data-supplier-jump-target="${escapeSupplierTenderDetailHtml(section.id)}">
                        ${escapeSupplierTenderDetailHtml(section.label)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderSupplierTenderProcurementDocument(tender = {}, sections = []) {
    return `
        <div class="supplier-detail-procurement-document">
            ${renderSupplierTenderDocumentJumpNav(sections)}
            <section class="tender-document-view supplier-procurement-full-document">
                <header class="tender-document-cover">
                    <div>
                        <span class="section-kicker">Procurement details</span>
                        <h2>${escapeSupplierTenderDetailHtml(tender.title || 'Tender brief')}</h2>
                        <p>${escapeSupplierTenderDetailHtml(tender.description || 'Review the full procurement detail document before preparing a bid.')}</p>
                    </div>
                    <div class="tender-document-stamp">
                        <strong>${escapeSupplierTenderDetailHtml(tender.status || 'Open')}</strong>
                        <span>${escapeSupplierTenderDetailHtml(tender.type || 'Tender')}</span>
                    </div>
                </header>
                ${sections.map(section => section.content).join('')}
            </section>
        </div>
    `;
}

function getSupplierTenderFieldValue(tender = {}, key = '') {
    return tender.requirements?.fields?.[key];
}

function renderSupplierTenderCustomerInformation(tender = {}, profile = {}) {
    return renderProcurexTenderDocumentSection('1', 'Customer Information', 'Procurement details', `
        ${renderProcurexTenderDetailSummary([
            { label: 'Procuring entity', value: tender.organization },
            { label: 'Procurement type', value: tender.type },
            { label: 'Procurement method', value: tender.method },
            { label: 'Visibility', value: tender.visibility },
            { label: 'Location', value: tender.location },
            { label: 'Eligibility summary', value: tender.eligibility }
        ])}
        <div class="tender-document-categories">
            <span>Categories</span>
            ${renderProcurexTenderDetailBadges(tender.categories?.length ? tender.categories : [tender.category || tender.type])}
        </div>
    `, '', 'customer-information');
}

function renderSupplierTenderPurchaseInformation(tender = {}, profile = {}) {
    const deliveryRequirements = tender.requirements?.lists?.deliveryRequirements || getSupplierTenderFieldValue(tender, 'deliveryRequirements') || [];
    const quantitySchedule = getSupplierTenderFieldValue(tender, 'quantityScheduleRows') || tender.boqItems || tender.commercialItems || [];
    return renderProcurexTenderDocumentSection('2', 'Purchase Information', 'Commercial scope', `
        ${renderProcurexTenderDetailSummary([
            { label: 'Tender title', value: tender.title },
            { label: 'Tender ID', value: tender.id },
            { label: 'Budget estimate', value: formatSupplierTenderMoney(tender.budget) },
            { label: 'Commercial model', value: tender.commercialModel || profile.commercialName },
            { label: 'Closing date', value: tender.closingDate }
        ])}
        <div class="supplier-detail-section-block">
            <span class="section-kicker">Quantity schedule</span>
            ${renderProcurexTenderDetailValue(quantitySchedule)}
        </div>
        <div class="supplier-detail-section-block">
            <span class="section-kicker">BOQ / price schedule rows</span>
            ${renderSupplierTenderCommercialPreview(tender, profile)}
        </div>
        <div class="supplier-detail-section-block">
            <span class="section-kicker">Delivery requirements</span>
            ${renderProcurexTenderDetailValue(deliveryRequirements)}
        </div>
    `, '', 'purchase-information');
}

function renderSupplierTenderDocumentation(tender = {}, profile = {}, requirementSet = {}) {
    const licenseItems = getSupplierTenderLicenseGuideItems(tender);
    const documentItems = getSupplierTenderRequiredDocumentGuideItems(tender, profile, requirementSet);
    const cvItems = getSupplierTenderCvGuideItems(tender, requirementSet);
    const templateItems = getSupplierTenderTemplateGuideItems(tender);
    const otherItems = getSupplierTenderOtherResponseGuideItems(tender, requirementSet);
    return renderProcurexTenderDocumentSection('3', 'Tender Documentation', 'Supplier submission requirements', `
        <div class="supplier-document-guide-intro">
            <strong>Submission guide</strong>
            <span>Use these grouped requirements to prepare the bid documents before opening the bidding workspace. Licenses, ordinary documents, CVs, and templates are separated so each upload is clear.</span>
        </div>
        ${renderSupplierTenderDocumentationInnerSection('Licenses and Certifications', 'Separate license evidence', licenseItems, 'No license or certification evidence is required for this tender.')}
        ${renderSupplierTenderDocumentationInnerSection('Required Submission Documents', 'Documents to upload', documentItems, 'No required submission documents are configured.')}
        ${renderSupplierTenderDocumentationInnerSection('CV and Personnel Evidence', 'People evidence', cvItems, 'No CV or personnel evidence is required for this tender.')}
        ${renderSupplierTenderDocumentationInnerSection('Templates, Specifications, and Samples', 'Buyer formats', templateItems, 'No template, specification, or sample requirement is configured.')}
        ${renderSupplierTenderDocumentationInnerSection('Other Response Requirements', 'Bid workspace responses', otherItems, 'No other response requirements are configured.')}
    `, '', 'tender-documentation');
}

function renderSupplierTenderDocumentsTab(tender = {}, profile = {}) {
    const documents = tender.documents?.length ? tender.documents : profile.documentLabels || ['Tender document'];
    return renderProcurexTenderDocumentSection('4', 'Documents', 'Tender pack', `
        ${renderProcurexTenderDetailDocuments(documents, 'Available to view or download', 'No tender documents configured.', {
            showActions: true,
            tenderId: tender.id
        })}
    `, `<span class="badge badge-info">${documents.length} files</span>`, 'documents');
}

function renderSupplierTenderContractsTab(tender = {}, profile = {}) {
    const deliveryRequirements = tender.requirements?.lists?.deliveryRequirements || [];
    const warrantyRows = getSupplierTenderFieldValue(tender, 'productSpecificationTemplate') || [];
    return renderProcurexTenderDocumentSection('5', 'Contracts', 'Award and contract outputs', `
        ${renderProcurexTenderDetailSummary([
            { label: 'Contract type', value: tender.contractType },
            { label: 'Commercial model', value: tender.commercialModel || profile.commercialName }
        ])}
        <div class="supplier-detail-section-block">
            <span class="section-kicker">Contract outputs and deliverables</span>
            ${renderProcurexTenderDetailValue(tender.deliverables || [])}
        </div>
        <div class="supplier-detail-section-block">
            <span class="section-kicker">Warranty requirements</span>
            ${renderProcurexTenderDetailValue(warrantyRows)}
        </div>
        <div class="supplier-detail-section-block">
            <span class="section-kicker">Delivery notes and replacement obligations</span>
            ${renderProcurexTenderDetailValue(deliveryRequirements)}
        </div>
        <div class="supplier-detail-section-block">
            <span class="section-kicker">Contract terms</span>
            ${renderProcurexTenderDetailValue(profile.contractRequirements || [])}
        </div>
    `, '', 'contracts');
}

function renderSupplierTenderQuestionsTab(tender = {}, clarifications = [], clarificationDeadline = {}) {
    return renderSupplierTenderSubTabs([
        {
            id: 'clarifications',
            label: 'Clarifications',
            content: renderProcurexTenderDocumentSection('1', 'Clarifications', 'Questions and requirements', `
                ${renderSupplierTenderClarificationDeadline(tender)}
                <div class="clarification-rule-note">
                    <strong>Pre-bid transparency rule</strong>
                    <span>Questions and buyer answers are public to all suppliers, with supplier identity hidden. After bid submission, evaluation-related clarifications are handled confidentially.</span>
                </div>
            `)
        },
        {
            id: 'ask-buyer',
            label: 'Ask Buyer',
            content: renderProcurexTenderDocumentSection('2', 'Ask the Buyer Before Bidding', 'Clarification request', `
                <div class="clarification-compose enhanced communication-center-cta">
                    <div>
                        <strong>Use Communication Center</strong>
                        <span>Open a dedicated message thread with the buyer, attach files, and keep the tender communication history in one place.</span>
                    </div>
                    <button class="btn btn-primary" type="button" data-supplier-focus-clarification ${clarificationDeadline.closed ? 'disabled' : ''}>Open Communication Center</button>
                </div>
            `)
        },
        {
            id: 'public-responses',
            label: 'Public responses',
            content: renderProcurexTenderDocumentSection('3', 'Public Q&A', 'Published buyer responses', `
                <div class="public-clarification-feed" data-clarification-list>
                    <div class="public-clarification-heading">
                        <span class="section-kicker">Public responses</span>
                        <strong>Supplier identity hidden from public QandA</strong>
                    </div>
                    ${renderSupplierTenderPublicClarificationFeed(clarifications)}
                </div>
            `, `<span class="badge badge-info">${clarifications.length} items</span>`)
        },
        {
            id: 'communication-center',
            label: 'Communication Center',
            content: renderProcurexTenderDocumentSection('4', 'Communication Center', 'Tender messages', `
                <div class="clarification-compose enhanced communication-center-cta">
                    <div>
                        <strong>Open Communication Center</strong>
                        <span>Continue buyer communication, review public clarification history, and keep tender messages in one place.</span>
                    </div>
                    <button class="btn btn-primary" type="button" data-supplier-focus-clarification ${clarificationDeadline.closed ? 'disabled' : ''}>Open Communication Center</button>
                </div>
            `)
        }
    ], 'clarifications');
}

function renderSupplierTenderComplaintsTab() {
    return renderSupplierTenderSubTabs([
        {
            id: 'submit-complaint',
            label: 'Submit complaint',
            content: renderProcurexTenderDocumentSection('1', 'Submit Complaint', 'Supplier remedy', `
                <div class="supplier-detail-empty-state">
                    <strong>No complaints submitted yet.</strong>
                    <span>Complaint submission will be available here when a supplier starts a review request.</span>
                    <button class="btn btn-secondary" type="button">Submit Complaint</button>
                </div>
            `)
        },
        {
            id: 'complaint-history',
            label: 'Complaint history',
            content: renderProcurexTenderDocumentSection('2', 'Complaint History', 'Records', '<div class="scope-empty">No complaints submitted yet.</div>')
        },
        {
            id: 'complaint-status',
            label: 'Complaint status',
            content: renderProcurexTenderDocumentSection('3', 'Complaint Status', 'Buyer/admin response', '<div class="scope-empty">No complaints submitted yet.</div>')
        }
    ], 'submit-complaint');
}

function renderSupplierTenderMonitoringTab(tender = {}, profile = {}, requirementSet = {}, daysRemaining = 0) {
    return renderSupplierTenderSubTabs([
        {
            id: 'timeline',
            label: 'Timeline',
            content: renderProcurexTenderDocumentSection('1', 'Tender Timeline', 'Monitoring', `
                <div class="supplier-timeline-list">
                    ${renderSupplierTenderTimeline(tender)}
                </div>
            `, `<span class="badge badge-info">${(tender.milestones || []).length || 4} milestones</span>`)
        },
        {
            id: 'milestones',
            label: 'Milestones',
            content: renderProcurexTenderDocumentSection('2', 'Milestones', 'Key dates', renderProcurexTenderDetailValue(tender.milestones || []))
        },
        {
            id: 'evaluation-status',
            label: 'Evaluation status',
            content: renderProcurexTenderDocumentSection('3', 'Evaluation Status', 'Published criteria', `
                <div class="data-table tender-detail-table">
                    <table>
                        <thead><tr><th>Criterion</th><th>Weight</th><th>Supplier focus</th></tr></thead>
                        <tbody>${renderSupplierTenderEvaluationRows(tender, profile)}</tbody>
                    </table>
                </div>
            `, '<span class="badge badge-success">Published</span>')
        },
        {
            id: 'award-reporting',
            label: 'Award reporting',
            content: renderProcurexTenderDocumentSection('4', 'Award Reporting', 'Reports', `
                <div class="record-summary tender-detail-summary">
                    <div><span>Submission progress</span><strong>${daysRemaining}d remaining</strong></div>
                    <div><span>Mandatory before bid</span><strong>${requirementSet.mandatory.length} items</strong></div>
                    <div><span>Additional responses</span><strong>${requirementSet.optional.length} items</strong></div>
                    <div><span>Award target</span><strong>${escapeSupplierTenderDetailHtml((tender.milestones || []).find(item => /award/i.test(item.name || item.title || ''))?.date || 'Not set')}</strong></div>
                </div>
            `)
        }
    ], 'timeline');
}

function renderSupplierTenderTabbedDetail(tender = {}, profile = {}, options = {}) {
    const requirementSet = options.requirementSet || getSupplierTenderRequirementSet(tender, profile);
    const clarifications = options.clarifications || getSupplierTenderClarifications(tender);
    const clarificationDeadline = options.clarificationDeadline || getSupplierTenderClarificationDeadlineState(tender);
    const daysRemaining = options.daysRemaining ?? 0;
    const procurementSections = [
        { id: 'customer-information', label: 'Customer information', content: renderSupplierTenderCustomerInformation(tender, profile) },
        { id: 'purchase-information', label: 'Purchase information', content: renderSupplierTenderPurchaseInformation(tender, profile) },
        { id: 'tender-documentation', label: 'Tender documentation', content: renderSupplierTenderDocumentation(tender, profile, requirementSet) },
        { id: 'documents', label: 'Documents', content: renderSupplierTenderDocumentsTab(tender, profile) }
    ];
    const mainTabs = [
        { id: 'procurement-details', label: 'Procurement details', content: renderSupplierTenderProcurementDocument(tender, procurementSections) },
        { id: 'questions-requirements', label: 'Questions and requirements', content: renderSupplierTenderQuestionsTab(tender, clarifications, clarificationDeadline) },
        { id: 'complaints', label: 'Complaints', content: renderSupplierTenderComplaintsTab() },
        { id: 'monitoring-reporting', label: 'Monitoring and reporting', content: renderSupplierTenderMonitoringTab(tender, profile, requirementSet, daysRemaining) }
    ];

    return `
        <section class="supplier-detail-tabbed-view">
            ${renderSupplierTenderTabButtons(mainTabs, 'main', 'procurement-details')}
            ${renderSupplierTenderTabPanels(mainTabs, 'procurement-details')}
        </section>
    `;
}

function renderSupplierTenderDetail() {
    const tender = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : mockData.tenders[0];
    const profile = typeof getCreateTenderTypeProfile === 'function'
        ? getCreateTenderTypeProfile(tender)
        : { commercialName: 'Pricing schedule', bidderPreparation: ['Technical response', 'Pricing'], evaluationCriteria: [] };
    const documents = tender.documents?.length ? tender.documents : profile.documentLabels || ['Tender document'];
    const clarifications = getSupplierTenderClarifications(tender);
    const requirementSet = getSupplierTenderRequirementSet(tender, profile);
    const saved = getSupplierTenderSavedIds().includes(tender.id);
    const daysRemaining = Math.max(0, Math.ceil((Date.parse(`${tender.closingDate}T23:59:59`) - Date.now()) / 86400000)) || 0;
    const clarificationDeadline = getSupplierTenderClarificationDeadlineState(tender);

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Tender Detail</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Supplier view</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                    <li><a href="#" data-navigate="bidding-workspace">Start Bid</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page supplier-tender-detail-page" data-supplier-tender-detail data-tender-id="${escapeSupplierTenderDetailHtml(tender.id)}">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-success">${escapeSupplierTenderDetailHtml(tender.status)}</span>
                            <h1>${escapeSupplierTenderDetailHtml(tender.title)}</h1>
                            <p>${escapeSupplierTenderDetailHtml(tender.organization)}. Review the full tender, save it for later, ask clarifications, then start the bid only when ready.</p>
                        </div>
                        <div class="hero-action-stack supplier-detail-actions">
                            <button class="btn btn-primary supplier-detail-primary-action" data-navigate="bidding-workspace">Start Bid</button>
                            <div class="supplier-detail-action-row">
                                <button class="btn btn-secondary" type="button" data-tender-pdf="open" data-tender-id="${escapeSupplierTenderDetailHtml(tender.id)}" data-document-audience="supplier">Open Document</button>
                                <button class="btn btn-secondary" type="button" data-tender-pdf="download" data-tender-id="${escapeSupplierTenderDetailHtml(tender.id)}" data-document-audience="supplier">Download Document</button>
                            </div>
                            <div class="supplier-detail-action-row">
                                <button class="btn btn-secondary" type="button" data-supplier-save-tender>${saved ? 'Saved' : 'Save Tender'}</button>
                                <button class="btn btn-secondary" type="button" data-supplier-focus-clarification>Ask Buyer</button>
                            </div>
                        </div>
                    </section>

                    <section class="journey-grid four-col">
                        <div class="kpi-card"><div class="kpi-value">${requirementSet.mandatory.length}</div><div class="kpi-label">Mandatory before bid</div></div>
                        <div class="kpi-card"><div class="kpi-value">${requirementSet.optional.length}</div><div class="kpi-label">Additional responses</div></div>
                        <div class="kpi-card"><div class="kpi-value">${daysRemaining}d</div><div class="kpi-label">Time remaining</div></div>
                        <div class="kpi-card"><div class="kpi-value">${clarificationDeadline.closed ? 'Closed' : clarifications.length}</div><div class="kpi-label">Clarifications</div></div>
                    </section>

                    ${renderSupplierTenderTabbedDetail(tender, profile, { requirementSet, clarifications, clarificationDeadline, daysRemaining })}
                </div>
            </div>
        </div>
    `;
}

function initializeSupplierTenderDetail() {
    const root = document.querySelector('[data-supplier-tender-detail]');
    if (!root || root.dataset.ready === 'true') return;
    const tenderId = root.dataset.tenderId;
    const tender = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : mockData.tenders.find(item => item.id === tenderId);

    const openClarificationInCommunicationCenter = (context = '', category = 'Technical') => {
        const normalizedCategory = category || 'Technical';
        const body = [
            context ? `Context: ${context}` : '',
            '',
            'Question:'
        ].join('\n').trim();
        localStorage.setItem(supplierTenderCommunicationDraftStorageKey, JSON.stringify({
            kind: 'clarification',
            category: 'Tender Clarification',
            recipientId: 'buyer-001',
            tenderId,
            tenderReference: tenderId,
            tenderTitle: tender?.title || 'Tender clarification',
            subject: `${normalizedCategory} clarification - ${tenderId}`,
            body
        }));

        const url = new URL(window.location.href);
        url.searchParams.set('page', 'communication-center');
        url.hash = '';
        const opened = window.open(url.toString(), '_blank');
        if (!opened) {
            window.app?.navigateTo?.('communication-center');
        }
    };

    root.addEventListener('click', (event) => {
        const jumpButton = event.target.closest('[data-supplier-jump-target]');
        if (jumpButton) {
            const documentShell = jumpButton.closest('.supplier-detail-procurement-document');
            const targetId = jumpButton.dataset.supplierJumpTarget;
            const targetSection = documentShell?.querySelector(`[data-supplier-document-section="${targetId}"]`);

            jumpButton.closest('[data-supplier-jump-list]')?.querySelectorAll('[data-supplier-jump-target]').forEach(button => {
                button.classList.toggle('active', button === jumpButton);
            });
            targetSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const tabButton = event.target.closest('[data-supplier-tab-target]');
        if (tabButton) {
            const tabList = tabButton.closest('[data-supplier-tab-list]');
            const tabShell = tabList?.parentElement;
            const panelShell = Array.from(tabShell?.children || []).find(child => child.classList.contains('supplier-detail-tab-panels'));
            const target = tabButton.dataset.supplierTabTarget;

            if (tabList && panelShell && target) {
                Array.from(tabList.children).forEach(button => {
                    const active = button === tabButton;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-selected', String(active));
                });
                Array.from(panelShell.children).forEach(panel => {
                    panel.style.display = panel.dataset.supplierTabPanel === target ? 'block' : 'none';
                });
            }
            return;
        }

        const saveButton = event.target.closest('[data-supplier-save-tender]');
        if (saveButton) {
            const saved = new Set(getSupplierTenderSavedIds());
            if (saved.has(tenderId)) {
                saved.delete(tenderId);
                saveButton.textContent = 'Save Tender';
            } else {
                saved.add(tenderId);
                saveButton.textContent = 'Saved';
            }
            localStorage.setItem(supplierTenderSavedStorageKey, JSON.stringify([...saved]));
            return;
        }

        const clarificationButton = event.target.closest('[data-supplier-focus-clarification]');
        if (clarificationButton) {
            openClarificationInCommunicationCenter(clarificationButton.dataset.clarificationContext || '', clarificationButton.dataset.clarificationCategory || 'Technical');
            return;
        }
    });

    root.dataset.ready = 'true';
}

if (window.app) {
    window.app.renderSupplierTenderDetail = renderSupplierTenderDetail;
}

window.initializeSupplierTenderDetail = initializeSupplierTenderDetail;
