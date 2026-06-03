// Tender Detail Page Component (Buyer View)

function escapeTenderDetailsHtml(value = '') {
    if (typeof escapeSupplierTenderDetailHtml === 'function') return escapeSupplierTenderDetailHtml(value);
    return String(value)
        .replace(/and/g, 'and')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function getTenderDetailsClarificationStatusClass(status = '') {
    const raw = String(status || '').toLowerCase();
    if (raw.includes('amendment')) return 'badge-warning';
    if (raw.includes('answered') || raw.includes('published')) return 'badge-success';
    if (raw.includes('closed')) return 'badge-info';
    return 'badge-warning';
}

function getTenderDetailsAmendmentState() {
    if (!window.procurexTenderDetailsAmendmentState) {
        window.procurexTenderDetailsAmendmentState = {
            open: false,
            amendmentId: '',
            sourceClarificationId: '',
            sourceClarificationText: ''
        };
    }
    return window.procurexTenderDetailsAmendmentState;
}

function formatTenderDetailsInputDate(value = '') {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '';
    const date = new Date(parsed);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTenderDetailsStoredAmendment(tenderId = '', amendmentId = '') {
    if (!amendmentId || typeof getTenderAmendments !== 'function') return null;
    return getTenderAmendments(tenderId, { includeDrafts: true }).find(item => item.id === amendmentId) || null;
}

function getTenderDetailsAmendmentChangesFromForm(form) {
    const data = new FormData(form);
    return {
        closingDate: String(data.get('closingDate') || '').trim(),
        documentName: String(data.get('documentName') || '').trim(),
        requirementNote: String(data.get('requirementNote') || '').trim(),
        commercialItemCode: String(data.get('commercialItemCode') || '').trim(),
        commercialItemDescription: String(data.get('commercialItemDescription') || '').trim(),
        commercialItemQty: String(data.get('commercialItemQty') || '').trim(),
        commercialItemUnit: String(data.get('commercialItemUnit') || '').trim(),
        commercialItemRate: String(data.get('commercialItemRate') || '').trim(),
        commercialNote: String(data.get('commercialNote') || '').trim(),
        evaluationCriterionName: String(data.get('evaluationCriterionName') || '').trim(),
        evaluationCriterionWeight: String(data.get('evaluationCriterionWeight') || '').trim(),
        evaluationNote: String(data.get('evaluationNote') || '').trim(),
        generalText: String(data.get('generalText') || '').trim()
    };
}

function getTenderDetailsAffectedSections(form, changes = {}) {
    const checked = Array.from(form.querySelectorAll('[name="affectedSections"]:checked')).map(item => item.value);
    const inferred = [
        changes.closingDate ? 'deadline' : '',
        changes.documentName ? 'documents' : '',
        changes.requirementNote ? 'requirements' : '',
        changes.commercialItemDescription || changes.commercialNote ? 'commercial' : '',
        changes.evaluationCriterionName || changes.evaluationNote ? 'evaluation' : '',
        changes.generalText ? 'general' : ''
    ].filter(Boolean);
    return Array.from(new Set([...checked, ...inferred]));
}

function hasTenderDetailsStructuredChange(changes = {}) {
    return Object.values(changes).some(value => String(value || '').trim());
}

function renderTenderDetailsAmendmentBadges(amendment = {}) {
    const affected = amendment.affectedSections?.length ? amendment.affectedSections : ['general'];
    return affected.map(item => `<span class="badge badge-info">${escapeTenderDetailsHtml(item)}</span>`).join('');
}

function renderTenderDetailsAmendmentRows(tender = {}) {
    const stored = typeof getTenderAmendments === 'function' ? getTenderAmendments(tender.id, { includeDrafts: true }) : [];
    if (!stored.length) {
        return '<div class="scope-empty">No amendment drafts or published addenda yet.</div>';
    }
    return stored.map(amendment => `
        <article class="buyer-amendment-row">
            <div>
                <span class="section-kicker">${amendment.status === 'published' ? 'Published amendment' : 'Draft amendment'}</span>
                <strong>${escapeTenderDetailsHtml(amendment.title || 'Untitled amendment')}</strong>
                <p>${escapeTenderDetailsHtml(amendment.summary || amendment.reason || 'No summary captured.')}</p>
                <div class="buyer-amendment-badges">${renderTenderDetailsAmendmentBadges(amendment)}</div>
            </div>
            <div class="inline-actions">
                <span class="badge ${amendment.status === 'published' ? 'badge-success' : 'badge-warning'}">${escapeTenderDetailsHtml(amendment.status)}</span>
                <button class="btn btn-secondary" type="button" data-tender-amendment-edit="${escapeTenderDetailsHtml(amendment.id)}">${amendment.status === 'published' ? 'View' : 'Edit Draft'}</button>
            </div>
        </article>
    `).join('');
}

function renderTenderDetailsAmendmentPreview(amendment = {}, tender = {}) {
    const changes = amendment.changes || {};
    const previewRows = [
        changes.closingDate ? ['Closing date', tender.closingDate || '-', changes.closingDate] : null,
        changes.documentName ? ['Document added', '-', changes.documentName] : null,
        changes.requirementNote ? ['Requirement note', '-', changes.requirementNote] : null,
        changes.commercialItemDescription || changes.commercialNote ? ['Commercial change', changes.commercialItemCode || '-', changes.commercialItemDescription || changes.commercialNote] : null,
        changes.evaluationCriterionName || changes.evaluationNote ? ['Evaluation change', changes.evaluationCriterionName || '-', changes.evaluationNote || `${changes.evaluationCriterionWeight || 0}%`] : null,
        changes.generalText ? ['General addendum', '-', changes.generalText] : null
    ].filter(Boolean);
    return `
        <div class="buyer-amendment-preview">
            <span class="section-kicker">Preview</span>
            ${previewRows.length ? `
                <div class="data-table tender-detail-table">
                    <table>
                        <thead><tr><th>Change</th><th>Current</th><th>New / Added</th></tr></thead>
                        <tbody>
                            ${previewRows.map(row => `<tr><td>${escapeTenderDetailsHtml(row[0])}</td><td>${escapeTenderDetailsHtml(row[1])}</td><td>${escapeTenderDetailsHtml(row[2])}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<div class="scope-empty">Complete at least one structured change to preview the amendment.</div>'}
        </div>
    `;
}

function renderTenderDetailsAmendmentWorkspace(baseTender = {}, clarifications = []) {
    const state = getTenderDetailsAmendmentState();
    if (!state.open) return '';
    const existing = getTenderDetailsStoredAmendment(baseTender.id, state.amendmentId) || {};
    const changes = existing.changes || {};
    const sourceClarification = state.sourceClarificationText || '';
    const recipients = typeof getProcurexInterestedSupplierRecipients === 'function' ? getProcurexInterestedSupplierRecipients(baseTender) : [];
    const affected = new Set(existing.affectedSections || []);
    const readonly = existing.status === 'published';
    const amendmentForPreview = {
        ...existing,
        changes
    };

    return `
        <section class="buyer-amendment-workspace" role="dialog" aria-modal="true" aria-label="Tender amendment workspace">
            <form class="buyer-amendment-card" data-tender-amendment-form>
                <input type="hidden" name="amendmentId" value="${escapeTenderDetailsHtml(existing.id || '')}">
                <input type="hidden" name="sourceClarificationId" value="${escapeTenderDetailsHtml(existing.sourceClarificationId || state.sourceClarificationId || '')}">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Tender amendment</span>
                        <h2>${readonly ? 'Published amendment' : 'Create structured amendment'}</h2>
                    </div>
                    <button class="btn btn-secondary" type="button" data-tender-amendment-close>Close</button>
                </div>

                <div class="buyer-amendment-form-grid">
                    <label><span>Title</span><input class="form-input" name="title" value="${escapeTenderDetailsHtml(existing.title || '')}" placeholder="Amendment 01 - Scope and closing date" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Reason</span><input class="form-input" name="reason" value="${escapeTenderDetailsHtml(existing.reason || sourceClarification)}" placeholder="Why this amendment is being issued" ${readonly ? 'readonly' : ''}></label>
                    <label class="span-2"><span>Summary for suppliers</span><textarea class="form-input" name="summary" rows="3" placeholder="Short notification summary" ${readonly ? 'readonly' : ''}>${escapeTenderDetailsHtml(existing.summary || '')}</textarea></label>
                </div>

                <fieldset class="buyer-amendment-section-picker">
                    <legend>Affected sections</legend>
                    ${[
                        ['deadline', 'Deadline'],
                        ['documents', 'Documents'],
                        ['requirements', 'Requirements'],
                        ['commercial', 'Commercial / BOQ'],
                        ['evaluation', 'Evaluation'],
                        ['general', 'General addendum']
                    ].map(([value, label]) => `
                        <label><input type="checkbox" name="affectedSections" value="${value}" ${affected.has(value) ? 'checked' : ''} ${readonly ? 'disabled' : ''}> <span>${label}</span></label>
                    `).join('')}
                </fieldset>

                <div class="buyer-amendment-form-grid">
                    <label><span>New closing date</span><input class="form-input" type="date" name="closingDate" value="${escapeTenderDetailsHtml(formatTenderDetailsInputDate(changes.closingDate || ''))}" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Add document / addendum file</span><input class="form-input" name="documentName" value="${escapeTenderDetailsHtml(changes.documentName || '')}" placeholder="Addendum_01_Revised_BOQ.pdf" ${readonly ? 'readonly' : ''}></label>
                    <label class="span-2"><span>Requirement change note</span><textarea class="form-input" name="requirementNote" rows="3" placeholder="Add or clarify eligibility, technical, legal, or submission requirements" ${readonly ? 'readonly' : ''}>${escapeTenderDetailsHtml(changes.requirementNote || '')}</textarea></label>
                    <label><span>Commercial item code</span><input class="form-input" name="commercialItemCode" value="${escapeTenderDetailsHtml(changes.commercialItemCode || '')}" placeholder="AMD-1" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Commercial item description</span><input class="form-input" name="commercialItemDescription" value="${escapeTenderDetailsHtml(changes.commercialItemDescription || '')}" placeholder="Revised BOQ item or pricing instruction" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Qty</span><input class="form-input" type="number" min="0" step="0.01" name="commercialItemQty" value="${escapeTenderDetailsHtml(changes.commercialItemQty || '')}" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Unit</span><input class="form-input" name="commercialItemUnit" value="${escapeTenderDetailsHtml(changes.commercialItemUnit || '')}" placeholder="Lot" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Rate / estimate</span><input class="form-input" type="number" min="0" step="1000" name="commercialItemRate" value="${escapeTenderDetailsHtml(changes.commercialItemRate || '')}" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Evaluation criterion</span><input class="form-input" name="evaluationCriterionName" value="${escapeTenderDetailsHtml(changes.evaluationCriterionName || '')}" placeholder="Additional compliance check" ${readonly ? 'readonly' : ''}></label>
                    <label><span>Criterion weight</span><input class="form-input" type="number" min="0" max="100" name="evaluationCriterionWeight" value="${escapeTenderDetailsHtml(changes.evaluationCriterionWeight || '')}" ${readonly ? 'readonly' : ''}></label>
                    <label class="span-2"><span>Evaluation note</span><textarea class="form-input" name="evaluationNote" rows="2" placeholder="How evaluators and suppliers should treat this change" ${readonly ? 'readonly' : ''}>${escapeTenderDetailsHtml(changes.evaluationNote || '')}</textarea></label>
                    <label class="span-2"><span>General addendum text</span><textarea class="form-input" name="generalText" rows="4" placeholder="Any additional amendment text to publish with the tender document" ${readonly ? 'readonly' : ''}>${escapeTenderDetailsHtml(changes.generalText || '')}</textarea></label>
                </div>

                <section class="buyer-amendment-recipients">
                    <span class="section-kicker">Notification audience</span>
                    <div class="tender-detail-chip-list">
                        ${recipients.length ? recipients.map(recipient => `<span>${escapeTenderDetailsHtml(recipient.name)}</span>`).join('') : '<span>No interested suppliers yet</span>'}
                    </div>
                </section>

                ${renderTenderDetailsAmendmentPreview(amendmentForPreview, baseTender)}
                <div class="form-status" data-tender-amendment-status></div>

                <div class="buyer-amendment-actions">
                    ${readonly ? '' : '<button class="btn btn-secondary" type="submit" data-tender-amendment-action="draft">Save Draft</button>'}
                    ${readonly ? '' : '<button class="btn btn-primary" type="submit" data-tender-amendment-action="publish">Publish Amendment</button>'}
                </div>
            </form>
        </section>
    `;
}

function renderBuyerTenderTabButtons(tabs = [], activeId = '') {
    return `
        <div class="supplier-detail-tabs buyer-detail-tabs" role="tablist">
            ${tabs.map(tab => `
                <button class="supplier-detail-tab ${tab.id === activeId ? 'active' : ''}" type="button" role="tab" aria-selected="${tab.id === activeId ? 'true' : 'false'}" data-buyer-tender-tab="${escapeTenderDetailsHtml(tab.id)}">
                    ${escapeTenderDetailsHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

function renderBuyerTenderTabPanels(tabs = [], activeId = '') {
    return `
        <div class="supplier-detail-tab-panels buyer-detail-tab-panels">
            ${tabs.map(tab => `
                <section class="supplier-detail-tab-panel" role="tabpanel" data-buyer-tender-tab-panel="${escapeTenderDetailsHtml(tab.id)}" style="display: ${tab.id === activeId ? 'grid' : 'none'};">
                    ${tab.content}
                </section>
            `).join('')}
        </div>
    `;
}

function renderBuyerTenderQuestionsTab(tender = {}, clarifications = [], amendments = [], storedAmendments = []) {
    return `
        <section class="buyer-tender-detail-rows">
            <article class="journey-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Clarifications inbox</span>
                        <h2>Questions and Answers</h2>
                    </div>
                    <span class="badge badge-warning">${clarifications.length} open</span>
                </div>
                <div class="inbox-list">
                    ${clarifications.length ? clarifications.map(item => `
                        <div class="inbox-item clarification-buyer-item">
                            <div>
                                <strong>${escapeTenderDetailsHtml(item.title || item.question || 'Clarification request')}</strong>
                                <span>${escapeTenderDetailsHtml(item.category || 'Technical')} / ${escapeTenderDetailsHtml(item.question || item.detail || item.answer || 'No question text captured')}</span>
                            </div>
                            <em class="badge ${getTenderDetailsClarificationStatusClass(item.status)}">${escapeTenderDetailsHtml(item.status || 'Pending')}</em>
                            <div class="inline-actions">
                                <button class="btn btn-secondary" type="button">Answer Only</button>
                                <button class="btn btn-primary" type="button" data-tender-amendment-clarification="${clarifications.indexOf(item)}">Issue Amendment</button>
                            </div>
                        </div>
                    `).join('') : '<div class="scope-empty">No supplier clarifications have been submitted yet.</div>'}
                </div>
            </article>

            <article class="journey-panel control-panel">
                <span class="section-kicker">Tender Addenda</span>
                <h2>${storedAmendments.length ? `${storedAmendments.length} amendment record${storedAmendments.length === 1 ? '' : 's'}` : (amendments[0]?.title || 'Create amendment')}</h2>
                <p>${storedAmendments.length ? 'Draft and published amendment records for this tender.' : (amendments[0]?.detail || 'Create amendment, notify all watchers, and retain the previous version in the audit log.')}</p>
                <div class="buyer-amendment-list">${renderTenderDetailsAmendmentRows(tender)}</div>
                <button class="btn btn-secondary" type="button" data-tender-amendment-create>Create Amendment</button>
            </article>
        </section>
    `;
}

function renderBuyerTenderSupplierActivityTab(tender = {}, interestedSuppliers = [], clarifications = [], daysToClose = 0, isPast = false) {
    const supplierCount = interestedSuppliers.length;
    const marketplaceViews = 180 + supplierCount * 22;
    const documentDownloads = 45 + supplierCount * 11;
    return `
        <section class="buyer-tender-detail-rows">
            <article class="journey-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Marketplace activity</span>
                        <h2>Supplier engagement</h2>
                    </div>
                    <span class="badge badge-info">${supplierCount} supplier${supplierCount === 1 ? '' : 's'}</span>
                </div>
                <div class="record-summary">
                    <div><span>Marketplace views</span><strong>${marketplaceViews}</strong></div>
                    <div><span>Document downloads</span><strong>${documentDownloads}</strong></div>
                    <div><span>Time to close</span><strong>${isPast ? 'Closed' : `${daysToClose}d`}</strong></div>
                </div>
                <div class="inbox-list">
                    <div class="inbox-item">
                        <div>
                            <strong>Marketplace engagement</strong>
                            <span>${supplierCount ? `${supplierCount} supplier${supplierCount === 1 ? '' : 's'} have shown aggregate activity.` : 'No supplier engagement recorded yet.'}</span>
                        </div>
                        <em>${marketplaceViews} views</em>
                    </div>
                    <div class="inbox-item">
                        <div>
                            <strong>Document interest</strong>
                            <span>Tender documents have been accessed through the marketplace.</span>
                        </div>
                        <em>${documentDownloads} downloads</em>
                    </div>
                    <div class="inbox-item">
                        <div>
                            <strong>Clarification activity</strong>
                            <span>Supplier questions are summarized without revealing individual supplier identities.</span>
                        </div>
                        <em>${clarifications.length} item${clarifications.length === 1 ? '' : 's'}</em>
                    </div>
                </div>
            </article>

            <article class="journey-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Supplier questions</span>
                        <h2>Activity requiring buyer attention</h2>
                    </div>
                    <span class="badge badge-warning">${clarifications.length} item${clarifications.length === 1 ? '' : 's'}</span>
                </div>
                <div class="record-summary">
                    <div><span>Clarifications</span><strong>${clarifications.length}</strong></div>
                    <div><span>Documents</span><strong>${(tender.documents || []).length}</strong></div>
                </div>
                <button class="btn btn-secondary" type="button" data-tender-amendment-create>Create Amendment</button>
            </article>
        </section>
    `;
}

function renderBuyerTenderEvaluationRecordsTab(tender = {}, amendments = [], clarifications = [], isPast = false) {
    return `
        <section class="buyer-tender-detail-rows">
            <article class="journey-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Audit Trail</span>
                        <h2>Lifecycle archive</h2>
                    </div>
                    <span class="badge ${isPast ? 'badge-info' : 'badge-success'}">${isPast ? 'In records' : 'Active'}</span>
                </div>
                <div class="record-summary">
                    <div><span>Amendments</span><strong>${amendments.length}</strong></div>
                    <div><span>Clarifications</span><strong>${clarifications.length}</strong></div>
                    <div><span>Tender reference</span><strong>${escapeTenderDetailsHtml(tender.id || tender.reference || '-')}</strong></div>
                </div>
                <button class="btn btn-secondary" type="button" data-navigate="records-history">Open Records and History</button>
            </article>
        </section>
    `;
}

function renderBuyerTenderTabbedDetail(tender = {}, profile = {}, options = {}) {
    const clarifications = options.clarifications || [];
    const amendments = options.amendments || [];
    const interestedSuppliers = options.interestedSuppliers || [];
    const storedAmendments = options.storedAmendments || [];
    const daysToClose = options.daysToClose || 0;
    const isPast = Boolean(options.isPast);
    const procurementContent = typeof renderProcurexTenderDetailFullSections === 'function'
        ? renderProcurexTenderDetailFullSections(tender, profile, { clarifications, amendments, interestedSuppliers, showActivity: false, showMarketplaceActivity: true, showSupplierInterest: true })
        : '<div class="scope-empty">Tender detail sections are unavailable.</div>';
    const tabs = [
        { id: 'procurement-details', label: 'Procurement details', content: procurementContent },
        { id: 'questions-amendments', label: 'Questions and amendments', content: renderBuyerTenderQuestionsTab(tender, clarifications, amendments, storedAmendments) },
        { id: 'supplier-activity', label: 'Supplier activity', content: renderBuyerTenderSupplierActivityTab(tender, interestedSuppliers, clarifications, daysToClose, isPast) },
        { id: 'evaluation-records', label: 'Evaluation and records', content: renderBuyerTenderEvaluationRecordsTab(tender, amendments, clarifications, isPast) }
    ];

    return `
        <section class="supplier-detail-tabbed-view buyer-detail-tabbed-view">
            ${renderBuyerTenderTabButtons(tabs, 'procurement-details')}
            ${renderBuyerTenderTabPanels(tabs, 'procurement-details')}
        </section>
    `;
}

function renderTenderDetails() {
    const baseTender = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : mockData.tenders[0];
    const tender = typeof getEffectiveTender === 'function' ? getEffectiveTender(baseTender) : baseTender;
    const profile = typeof getCreateTenderTypeProfile === 'function'
        ? getCreateTenderTypeProfile(tender)
        : { commercialName: 'Pricing schedule', bidderPreparation: [], evaluationCriteria: [] };
    const clarifications = typeof getSupplierTenderClarifications === 'function' ? getSupplierTenderClarifications(tender) : (tender.clarifications || [
        { title: 'Solar backup scope', question: 'Does each health center include solar backup wiring?', status: 'Open' },
        { title: 'Site visit schedule', question: 'Can suppliers attend one consolidated site visit?', status: 'Open' },
        { title: 'BOQ unit mismatch', question: 'Item 3.1 shows centers but description says buildings.', status: 'Amendment candidate' }
    ]);
    const amendments = tender.amendments || [
        { title: 'Amendment 01', status: 'Draft available', detail: 'Update BOQ item 3.1 unit label, notify all watchers, and retain the previous version in the audit log.' }
    ];
    const interestedSuppliers = tender.interestedSuppliers || [
        { name: 'ABC Construction Ltd', status: 'Downloaded documents', lastActivity: 'Today' },
        { name: 'BuildRight Ltd', status: 'Watching tender', lastActivity: 'Today' },
        { name: 'Prime Contractors', status: 'Asked clarification', lastActivity: '1 day ago' }
    ];
    const closingTime = Date.parse(`${tender.closingDate}T23:59:59`);
    const daysToClose = Number.isFinite(closingTime)
        ? Math.max(0, Math.ceil((closingTime - Date.now()) / 86400000))
        : 0;
    const isPast = typeof isProcurexTenderPast === 'function' ? isProcurexTenderPast(tender) : daysToClose === 0 && tender.status !== 'Open';
    const storedAmendments = typeof getTenderAmendments === 'function' ? getTenderAmendments(tender.id, { includeDrafts: true }) : [];

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Tender Detail</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Buyer view and marketplace controls</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="bid-evaluation">Bid Opening</a></li>
                    <li><a href="#" data-navigate="award-recommendation">Award</a></li>
                    <li><a href="#" data-navigate="records-history">Records and History</a></li>
                    <li><a href="#" data-navigate="procurement-dashboard">Procurement Dashboard</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page buyer-tender-detail-page" data-buyer-tender-detail data-tender-id="${escapeTenderDetailsHtml(tender.id)}">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge ${isPast ? 'badge-info' : 'badge-success'}">${isPast ? 'Archived tender' : 'Active tender'}</span>
                            <h1>${tender.title}</h1>
                            <p>${tender.id} / ${tender.organization}. Manage live tender interactions, amendments, supplier clarifications, and evaluation readiness.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-tender-pdf="open" data-tender-id="${escapeTenderDetailsHtml(tender.id)}" data-document-audience="buyer">Open Document</button>
                            <button class="btn btn-secondary" type="button" data-tender-pdf="download" data-tender-id="${escapeTenderDetailsHtml(tender.id)}" data-document-audience="buyer">Download Document</button>
                            <button class="btn btn-secondary" type="button" data-tender-amendment-create>Create Amendment</button>
                            <button class="btn btn-primary" data-navigate="bid-evaluation">Open Evaluation</button>
                        </div>
                    </section>

                    <section class="buyer-tender-status-list" aria-label="Tender activity summary">
                        <article class="buyer-tender-status-row">
                            <span>Marketplace views</span>
                            <strong>${180 + interestedSuppliers.length * 22}</strong>
                        </article>
                        <article class="buyer-tender-status-row">
                            <span>Document downloads</span>
                            <strong>${45 + interestedSuppliers.length * 11}</strong>
                        </article>
                        <article class="buyer-tender-status-row">
                            <span>Time to close</span>
                            <strong>${isPast ? 'Closed' : `${daysToClose}d`}</strong>
                        </article>
                    </section>

                    ${renderBuyerTenderTabbedDetail(tender, profile, { clarifications, amendments, interestedSuppliers, storedAmendments, daysToClose, isPast })}
                    ${renderTenderDetailsAmendmentWorkspace(baseTender, clarifications)}
                </div>
            </div>
        </div>
    `;
}

function collectTenderDetailsAmendment(form, baseTender = {}) {
    const data = new FormData(form);
    const changes = getTenderDetailsAmendmentChangesFromForm(form);
    const affectedSections = getTenderDetailsAffectedSections(form, changes);
    const existing = getTenderDetailsStoredAmendment(baseTender.id, data.get('amendmentId')) || {};
    return {
        ...existing,
        tenderId: baseTender.id,
        title: String(data.get('title') || '').trim(),
        reason: String(data.get('reason') || '').trim(),
        summary: String(data.get('summary') || '').trim(),
        createdBy: baseTender.organization || 'Buyer',
        sourceClarificationId: String(data.get('sourceClarificationId') || '').trim(),
        affectedSections,
        changes,
        recipients: typeof getProcurexInterestedSupplierRecipients === 'function' ? getProcurexInterestedSupplierRecipients(baseTender) : []
    };
}

function rerenderTenderDetailsPage() {
    if (window.app && typeof window.app.renderPage === 'function') {
        window.app.renderPage();
    }
}

function initializeTenderDetails() {
    const root = document.querySelector('.buyer-tender-detail-page');
    if (!root || root.dataset.amendmentsReady === 'true') return;
    root.dataset.amendmentsReady = 'true';

    root.addEventListener('click', (event) => {
        const state = getTenderDetailsAmendmentState();
        const baseTender = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : mockData.tenders[0];
        const tabButton = event.target.closest('[data-buyer-tender-tab]');
        const createButton = event.target.closest('[data-tender-amendment-create]');
        const editButton = event.target.closest('[data-tender-amendment-edit]');
        const clarificationButton = event.target.closest('[data-tender-amendment-clarification]');
        const closeButton = event.target.closest('[data-tender-amendment-close]');

        if (tabButton) {
            event.preventDefault();
            const target = tabButton.dataset.buyerTenderTab;
            root.querySelectorAll('[data-buyer-tender-tab]').forEach(button => {
                const active = button.dataset.buyerTenderTab === target;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            root.querySelectorAll('[data-buyer-tender-tab-panel]').forEach(panel => {
                panel.style.display = panel.dataset.buyerTenderTabPanel === target ? 'grid' : 'none';
            });
            return;
        }

        if (createButton) {
            state.open = true;
            state.amendmentId = '';
            state.sourceClarificationId = '';
            state.sourceClarificationText = '';
            rerenderTenderDetailsPage();
            return;
        }

        if (editButton) {
            state.open = true;
            state.amendmentId = editButton.dataset.tenderAmendmentEdit;
            state.sourceClarificationId = '';
            state.sourceClarificationText = '';
            rerenderTenderDetailsPage();
            return;
        }

        if (clarificationButton) {
            const effectiveTender = typeof getEffectiveTender === 'function' ? getEffectiveTender(baseTender) : baseTender;
            const clarifications = typeof getSupplierTenderClarifications === 'function' ? getSupplierTenderClarifications(effectiveTender) : (effectiveTender.clarifications || []);
            const item = clarifications[Number(clarificationButton.dataset.tenderAmendmentClarification)] || {};
            state.open = true;
            state.amendmentId = '';
            state.sourceClarificationId = item.id || item.title || item.question || '';
            state.sourceClarificationText = item.question || item.detail || item.answer || item.title || 'Clarification requires amendment';
            rerenderTenderDetailsPage();
            return;
        }

        if (closeButton) {
            state.open = false;
            state.amendmentId = '';
            state.sourceClarificationId = '';
            state.sourceClarificationText = '';
            rerenderTenderDetailsPage();
        }
    });

    root.addEventListener('submit', (event) => {
        const form = event.target.closest('[data-tender-amendment-form]');
        if (!form) return;
        event.preventDefault();
        const action = event.submitter?.dataset?.tenderAmendmentAction || 'draft';
        const status = form.querySelector('[data-tender-amendment-status]');
        const baseTender = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : mockData.tenders[0];
        const amendment = collectTenderDetailsAmendment(form, baseTender);

        const hasStructuredChange = hasTenderDetailsStructuredChange(amendment.changes);
        const invalidDraft = action === 'draft' && !amendment.title;
        const invalidPublish = action === 'publish' && (!amendment.title || !amendment.reason || !hasStructuredChange);

        if (invalidDraft || invalidPublish) {
            if (status) {
                status.classList.remove('success');
                status.textContent = action === 'publish'
                    ? 'Add a title, reason, and at least one structured change before publishing.'
                    : 'Add a title before saving this draft.';
            }
            return;
        }

        const saved = saveTenderAmendment(amendment);
        if (action === 'publish') {
            publishTenderAmendment(saved.id);
            getTenderDetailsAmendmentState().open = false;
        } else {
            getTenderDetailsAmendmentState().open = true;
            getTenderDetailsAmendmentState().amendmentId = saved.id;
        }
        rerenderTenderDetailsPage();
    });
}

if (window.app) {
    window.app.renderTenderDetails = renderTenderDetails;
}

window.initializeTenderDetails = initializeTenderDetails;
