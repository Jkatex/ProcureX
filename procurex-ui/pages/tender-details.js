// Tender Detail Page Component (Buyer View)

function escapeTenderDetailsHtml(value = '') {
    if (typeof escapeSupplierTenderDetailHtml === 'function') return escapeSupplierTenderDetailHtml(value);
    return String(value)
        .replace(/and/g, 'andamp;')
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

function renderTenderDetails() {
    const tender = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : mockData.tenders[0];
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
                <div class="journey-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge ${isPast ? 'badge-info' : 'badge-success'}">${isPast ? 'Archived tender' : 'Active tender'}</span>
                            <h1>${tender.title}</h1>
                            <p>${tender.id} / ${tender.organization}. Manage live tender interactions, amendments, supplier clarifications, and evaluation readiness.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-tender-pdf="open" data-tender-id="${escapeTenderDetailsHtml(tender.id)}" data-document-audience="buyer">Open Document</button>
                            <button class="btn btn-secondary" type="button" data-tender-pdf="download" data-tender-id="${escapeTenderDetailsHtml(tender.id)}" data-document-audience="buyer">Download Document</button>
                            <button class="btn btn-secondary">Create Amendment</button>
                            <button class="btn btn-primary" data-navigate="bid-evaluation">Open Evaluation</button>
                        </div>
                    </section>

                    <section class="journey-grid three-col">
                        <div class="kpi-card"><div class="kpi-value">${180 + interestedSuppliers.length * 22}</div><div class="kpi-label">Marketplace views</div></div>
                        <div class="kpi-card"><div class="kpi-value">${45 + interestedSuppliers.length * 11}</div><div class="kpi-label">Document downloads</div></div>
                        <div class="kpi-card"><div class="kpi-value">${isPast ? 'Closed' : `${daysToClose}d`}</div><div class="kpi-label">Time to close</div></div>
                    </section>

                    ${typeof renderProcurexTenderDetailFullSections === 'function'
                        ? renderProcurexTenderDetailFullSections(tender, profile, { clarifications, amendments, interestedSuppliers, showActivity: false, showMarketplaceActivity: true, showSupplierInterest: true })
                        : ''}

                    <section class="journey-grid two-col">
                        <div class="journey-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Clarifications inbox</span>
                                    <h2>Questions and Answers</h2>
                                </div>
                                <span class="badge badge-warning">${clarifications.length} open</span>
                            </div>
                            <div class="inbox-list">
                                ${clarifications.map(item => `
                                    <div class="inbox-item clarification-buyer-item">
                                        <div>
                                            <strong>${escapeTenderDetailsHtml(item.title || item.question || 'Clarification request')}</strong>
                                            <span>${escapeTenderDetailsHtml(item.category || 'Technical')} / ${escapeTenderDetailsHtml(item.question || item.detail || item.answer || 'No question text captured')}</span>
                                        </div>
                                        <em class="badge ${getTenderDetailsClarificationStatusClass(item.status)}">${escapeTenderDetailsHtml(item.status || 'Pending')}</em>
                                        <div class="inline-actions">
                                            <button class="btn btn-secondary">Answer Only</button>
                                            <button class="btn btn-primary">Issue Amendment</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Tender Addenda</span>
                            <h2>${amendments[0]?.title || 'Create amendment'}</h2>
                            <p>${amendments[0]?.detail || 'Create amendment, notify all watchers, and retain the previous version in the audit log.'}</p>
                            <button class="btn btn-secondary">Create Amendment</button>
                        </div>
                    </section>

                    <section class="journey-grid two-col">
                        <div class="journey-panel control-panel">
                            <span class="section-kicker">Bid Evaluation</span>
                            <h2>Ready for Review</h2>
                            <p>Move to scoring, tenderer questions, and award preparation when the tender reaches evaluation.</p>
                            <button class="btn btn-primary" data-navigate="bid-evaluation">Open Evaluation</button>
                        </div>
                        <div class="journey-panel">
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
                            </div>
                            <button class="btn btn-secondary" data-navigate="records-history">Open Records and History</button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `;
}

if (window.app) {
    window.app.renderTenderDetails = renderTenderDetails;
}
