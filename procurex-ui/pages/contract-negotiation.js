// Contract review, clause negotiation, version control, and signature workspace.

const PXContractUtils = window.ProcureXShared || {};
const escapeContractNegotiationHtml = PXContractUtils.escapeHtml || ((value = '') => String(value));
const formatContractNegotiationMoney = PXContractUtils.formatMoney || ((value, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString()}`);
const renderContractNegotiationBadge = PXContractUtils.renderStatusBadge || ((value = '') => `<span class="badge badge-info">${escapeContractNegotiationHtml(value)}</span>`);

function renderContractNegotiationDataTable(headers = [], rows = []) {
    if (PXContractUtils.renderDataTable) return PXContractUtils.renderDataTable(headers, rows);
    return `
        <div class="data-table evaluation-table-scroll">
            <table>
                <thead><tr>${headers.map(header => `<th>${escapeContractNegotiationHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `;
}

function countOpenContractRequests(contract = {}) {
    return (contract.negotiationRequests || []).filter(row => /pending|counter|requested|review/i.test(row.status || '')).length;
}

function countRequiredContractDocuments(contract = {}) {
    return (contract.documents || []).filter(row => /pending|required|upload/i.test(row.status || '')).length;
}

function renderActionRequiredMarker(count) {
    return count ? `<span class="tab-alert" aria-label="${count} action required">${count}</span>` : '';
}

function renderContractOverview(contract) {
    return `
        <div class="contract-overview-grid">
            ${[
                ['Tender title', contract.title],
                ['Buyer', contract.buyer],
                ['Supplier', contract.supplier],
                ['Tender reference', contract.tenderReference],
                ['Procurement type', contract.procurementType],
                ['Your role', contract.role],
                ['Award value', formatContractNegotiationMoney(contract.value, contract.currency)],
                ['Duration', contract.duration],
                ['Start date', contract.startDate],
                ['End date', contract.endDate],
                ['Status', renderContractNegotiationBadge(contract.status)]
            ].map(([label, value]) => `
                <article>
                    <span>${escapeContractNegotiationHtml(label)}</span>
                    <strong>${typeof value === 'string' && value.includes('<span') ? value : escapeContractNegotiationHtml(value || '-')}</strong>
                </article>
            `).join('')}
        </div>
        <div class="evaluation-form-grid recommendation-form contract-draft-form">
            <label>Contract start date <input class="form-input" type="date" data-award-draft-field="contract.startDate" value="${escapeContractNegotiationHtml(contract.startDate || '')}"></label>
            <label>Contract end date <input class="form-input" type="date" data-award-draft-field="contract.endDate" value="${escapeContractNegotiationHtml(contract.endDate || '')}"></label>
            <label>Contract duration <input class="form-input" data-award-draft-field="contract.duration" value="${escapeContractNegotiationHtml(contract.duration || '')}"></label>
            <label>Current status <input class="form-input" data-award-draft-field="contract.status" value="${escapeContractNegotiationHtml(contract.status || '')}"></label>
        </div>
        <div class="contract-rule-banner">
            <strong>Negotiation rule</strong>
            <span>The contract can be negotiated only after award acceptance and before signing. Once both parties agree and the contract is locked for signature, later changes become amendments, variations, extensions of time, or change orders.</span>
        </div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="draft-contract">Save Draft</button>
            <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="draft-contract">Save Draft & Exit</button>
            <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="terms-clauses" data-award-required-action="Review Terms and Clauses">Continue to Terms & Clauses</button>
        </div>
    `;
}

function renderContractClauses(contract) {
    const locked = ['Awarded supplier', 'Final evaluated bid price', 'Main tender scope', 'Core technical requirements', 'Evaluation criteria', 'Procurement method', 'Bid ranking', 'Tender reference'];
    const negotiable = ['Delivery schedule', 'Milestone dates', 'Payment schedule', 'Reporting frequency', 'Acceptance process details', 'Warranty procedure', 'Contract clause wording', 'Performance security deadline'];

    return `
        <div class="contract-boundary-grid">
            <article><h3>Locked after award</h3>${locked.map(item => `<span>${escapeContractNegotiationHtml(item)}</span>`).join('')}</article>
            <article><h3>Negotiable before signing</h3>${negotiable.map(item => `<span>${escapeContractNegotiationHtml(item)}</span>`).join('')}</article>
        </div>
        <div class="contract-clause-grid contract-workspace-clause-grid">
            ${(contract.clauses || []).map(clause => `
                <article class="contract-clause-card ${clause.lock === 'Locked' ? 'locked' : 'negotiable'}">
                    <div class="contract-clause-card-head">
                        <strong>${escapeContractNegotiationHtml(clause.title)}</strong>
                        ${renderContractNegotiationBadge(clause.lock)}
                    </div>
                    <p>${escapeContractNegotiationHtml(clause.text)}</p>
                    <div class="contract-clause-meta">${renderContractNegotiationBadge(clause.status)}<span>${escapeContractNegotiationHtml(clause.comments)} comments</span></div>
                    <em>${escapeContractNegotiationHtml(clause.requestedChange)}</em>
                    ${clause.lock === 'Negotiable' ? `<div class="inline-actions"><button class="btn btn-secondary btn-sm" type="button">Accept</button><button class="btn btn-secondary btn-sm" type="button">Comment</button><button class="btn btn-primary btn-sm" type="button">Request Change</button></div>` : ''}
                </article>
            `).join('')}
        </div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="terms-clauses">Save Draft</button>
            <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="contract-negotiation" data-award-required-action="Negotiate Contract">Send Contract for Review</button>
        </div>
    `;
}

function renderContractNegotiationTab(contract) {
    return `
        ${renderContractNegotiationDataTable(
            ['Clause', 'Requested By', 'Request', 'Status', 'Buyer Response'],
            (contract.negotiationRequests || []).map(row => `
                <tr>
                    <td><strong>${escapeContractNegotiationHtml(row.clause)}</strong></td>
                    <td>${escapeContractNegotiationHtml(row.requestBy)}</td>
                    <td>${escapeContractNegotiationHtml(row.request)}</td>
                    <td>${renderContractNegotiationBadge(row.status)}</td>
                    <td>${escapeContractNegotiationHtml(row.buyerResponse)}</td>
                </tr>
            `)
        )}
        <div class="contract-negotiation-grid compact">
            <section class="contract-chat-panel" aria-label="Clause negotiation conversation">
                <div class="panel-heading">
                    <div><span class="section-kicker">Negotiation comments</span><h3>Clause conversation</h3></div>
                    ${renderContractNegotiationBadge('Round 3')}
                </div>
                <div class="chat-messages" aria-live="polite">
                    ${(contract.messages || []).map(msg => `
                        <article class="contract-chat-message ${msg.from === 'buyer' ? 'buyer' : 'supplier'}">
                            <div><strong>${msg.from === 'buyer' ? 'Buyer' : 'Supplier'}</strong><span>${escapeContractNegotiationHtml(msg.timestamp)}</span></div>
                            <p>${escapeContractNegotiationHtml(msg.message)}</p>
                        </article>
                    `).join('')}
                </div>
                <div class="contract-quick-actions">
                    <button class="btn btn-secondary" type="button">Accept Supplier Request</button>
                    <button class="btn btn-secondary" type="button">Reject Request</button>
                    <button class="btn btn-primary" type="button">Counter-Propose</button>
                </div>
            </section>
            <section class="contract-chat-panel">
                <div class="panel-heading">
                    <div><span class="section-kicker">Final agreement</span><h3>Dual confirmation before signing</h3></div>
                    ${renderContractNegotiationBadge(contract.lockedForSignature ? 'Locked' : 'Not Locked')}
                </div>
                <div class="contract-confirmation-stack">
                    <div><strong>Supplier Confirms Terms</strong>${renderContractNegotiationBadge(contract.supplierConfirmedTerms ? 'Confirmed' : 'Pending')}</div>
                    <div><strong>Buyer Confirms Terms</strong>${renderContractNegotiationBadge(contract.buyerConfirmedTerms ? 'Confirmed' : 'Pending')}</div>
                    <div><strong>Contract Locked for Signing</strong>${renderContractNegotiationBadge(contract.lockedForSignature ? 'Ready for Signature' : 'Awaiting Buyer Confirmation')}</div>
                </div>
                <button class="btn btn-primary" type="button">Confirm Terms and Lock</button>
            </section>
        </div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="contract-negotiation">Save Draft</button>
            <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="final-agreement" data-award-required-action="Confirm Final Terms">Mark Terms Ready for Agreement</button>
        </div>
    `;
}

function renderContractVersions(contract) {
    return renderContractNegotiationDataTable(
        ['Version', 'Changed By', 'Date', 'Summary', 'Previous Clause', 'New Clause', 'Reason'],
        (contract.versions || []).map(row => `
            <tr>
                <td><strong>${escapeContractNegotiationHtml(row.version)}</strong></td>
                <td>${escapeContractNegotiationHtml(row.changedBy)}</td>
                <td>${escapeContractNegotiationHtml(row.date)}</td>
                <td>${escapeContractNegotiationHtml(row.summary)}</td>
                <td>${escapeContractNegotiationHtml(row.previousClause)}</td>
                <td>${escapeContractNegotiationHtml(row.newClause)}</td>
                <td>${escapeContractNegotiationHtml(row.reason)}</td>
            </tr>
        `)
    );
}

function renderContractDocuments(contract) {
    return renderContractNegotiationDataTable(
        ['Document', 'Type', 'Owner', 'Status', 'Action'],
        (contract.documents || []).map(row => `
            <tr>
                <td><strong>${escapeContractNegotiationHtml(row.name)}</strong></td>
                <td>${escapeContractNegotiationHtml(row.type)}</td>
                <td>${escapeContractNegotiationHtml(row.owner)}</td>
                <td>${renderContractNegotiationBadge(row.status)}</td>
                <td><button class="btn btn-secondary btn-sm" type="button">${row.status === 'Pending Upload' ? 'Upload' : 'View'}</button></td>
            </tr>
        `)
    );
}

function renderContractSignatures(contract) {
    const signatures = contract.signatures || [];
    const supplierSigned = /signed/i.test(signatures[0]?.status || '');
    return `
        <div class="contract-signature-grid">
            ${signatures.map((row, index) => {
                const isSupplier = index === 0;
                const disabledReason = !contract.lockedForSignature
                    ? 'Signature unavailable: contract terms are not yet confirmed by both parties.'
                    : (!isSupplier && !supplierSigned ? 'Signature unavailable: waiting for supplier signature first.' : '');
                const disabled = disabledReason ? 'disabled aria-disabled="true"' : '';
                const descId = `signature-reason-${index}`;
                return `
                    <article class="contract-signature-card">
                        <h3>${escapeContractNegotiationHtml(row.party)} Signature</h3>
                        <div class="signature-preview"><strong>${escapeContractNegotiationHtml(row.party)}</strong><span>${escapeContractNegotiationHtml(row.status)}</span></div>
                        <input class="form-input" value="${escapeContractNegotiationHtml(row.representative)}" aria-label="${escapeContractNegotiationHtml(row.party)} representative">
                        <span>${renderContractNegotiationBadge(isSupplier ? 'Supplier signs first' : 'Buyer countersigns')}</span>
                        <small>Timestamp: ${escapeContractNegotiationHtml(row.timestamp)}</small>
                        <div class="certificate-summary">
                            <strong>Certificate summary</strong>
                            <span>Issuer: ProcureX Trust CA • Validity: pending signature • Hash: SHA256 pending</span>
                        </div>
                        <span id="${descId}" class="signature-disabled-reason">${escapeContractNegotiationHtml(disabledReason || 'Signature is available for this party.')}</span>
                        <button class="btn ${isSupplier ? 'btn-primary' : 'btn-secondary'}" type="button" ${disabled} aria-describedby="${descId}">${disabledReason && !isSupplier ? 'Waiting for supplier signature' : 'Apply Digital Signature'}</button>
                    </article>
                `;
            }).join('')}
        </div>
        <div class="status-pipeline horizontal contract-signature-pipeline">
            <div class="${contract.supplierConfirmedTerms && contract.buyerConfirmedTerms ? 'done' : 'current'}"><strong>Terms Agreed</strong><span>Both parties confirm contract terms</span></div>
            <div class="${supplierSigned ? 'done' : contract.lockedForSignature ? 'current' : ''}"><strong>Supplier Signs</strong><span>Supplier signature is first</span></div>
            <div class="${supplierSigned ? 'current' : ''}"><strong>Buyer Signs</strong><span>Buyer countersigns</span></div>
            <div><strong>Contract Active</strong><span>Execution workspace opens</span></div>
        </div>
        <div class="evaluation-notice success">Signature audit records signer identity, document hash, timestamp, certificate metadata, and final signed version hash.</div>
        <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="signature">Save Draft</button>
            <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="signature">Save Draft & Exit</button>
            <button class="btn btn-primary" type="button" data-award-save-continue data-award-next-step="execution" data-award-required-action="Track Execution" data-navigate="post-award-tracking">Activate Contract Tracking</button>
        </div>
    `;
}

function renderContractActivity(contract) {
    return renderContractNegotiationDataTable(
        ['Time', 'Actor', 'Event', 'Status'],
        (contract.activityLog || []).map(row => `
            <tr>
                <td>${escapeContractNegotiationHtml(row.time)}</td>
                <td>${escapeContractNegotiationHtml(row.actor)}</td>
                <td>${escapeContractNegotiationHtml(row.event)}</td>
                <td>${renderContractNegotiationBadge(row.status)}</td>
            </tr>
        `)
    );
}

function renderContractNegotiation() {
    const context = typeof getAwardContractLifecycleContext === 'function' ? getAwardContractLifecycleContext() : null;
    const draft = context?.draft || {};
    const tender = context?.tender || {};
    const contract = context?.contract || mockData.awardingContracts?.contract || {};
    contract.procurementType = draft.procurementType || contract.procurementType || 'Works';
    contract.role = draft.role || 'Buyer';
    const openRequests = countOpenContractRequests(contract);
    const requiredDocuments = countRequiredContractDocuments(contract);

    return `
        <div class="main-layout procurement-layout evaluation-app-layout contract-page" data-award-contract-workspace data-award-current-step="${escapeContractNegotiationHtml(draft.currentStep || 'draft-contract')}" data-award-tender-id="${escapeContractNegotiationHtml(draft.tenderId || tender.id || '')}">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head"><h3>Contract Workspace</h3><span>Contract #${escapeContractNegotiationHtml(contract.contractId || 'Draft')}</span></div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-award-guard-navigate data-navigate="awarding-contracts">Awarding Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="award-recommendation">Award Decision</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="contract-negotiation" class="active">Contract Workspace</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="post-award-tracking">Post-Award Tracking</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-award-guard-navigate data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content contract-negotiation-workspace">
                <section class="procurement-hero evaluation-hero-panel award-hero-panel">
                    <div>
                        <span class="section-kicker">Contract review and negotiation</span>
                        <h1>${escapeContractNegotiationHtml(contract.title || 'Contract finalization')}</h1>
                        <p>Negotiate selected contract terms and clauses after award acceptance and before signing. Locked tender and evaluation fields cannot be reopened.</p>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${formatContractNegotiationMoney(contract.value, contract.currency)}</strong><span>Contract value</span></div>
                        <div><strong>${escapeContractNegotiationHtml(contract.duration || '-')}</strong><span>Duration</span></div>
                        <div><strong>${escapeContractNegotiationHtml(contract.status || 'Draft')}</strong><span>Status</span></div>
                    </div>
                </section>

                <section class="procurement-panel evaluation-panel contract-workspace-panel">
                    <div class="panel-heading">
                        <div><span class="section-kicker">Contract workspace</span><h2>Overview, terms, negotiation, versions, documents, signatures, and activity</h2></div>
                        ${renderContractNegotiationBadge(contract.poMatched && contract.budgetVerified ? 'PO and budget verified' : 'Verification pending')}
                    </div>
                    <div class="contract-rule-banner"><strong>Draft progress</strong><span>Current step: ${escapeContractNegotiationHtml(draft.currentStep || 'draft-contract')} / Required action: ${escapeContractNegotiationHtml(draft.requiredAction || 'Review contract')}. Last saved: ${escapeContractNegotiationHtml(draft.lastEditedAt ? new Date(draft.lastEditedAt).toLocaleString() : 'Not saved')}.</span></div>
                    <div class="inline-actions">
                        <button class="btn btn-secondary" type="button" data-award-save-draft data-award-step="${escapeContractNegotiationHtml(draft.currentStep || 'draft-contract')}">Save Draft</button>
                        <button class="btn btn-secondary" type="button" data-award-save-exit data-award-step="${escapeContractNegotiationHtml(draft.currentStep || 'draft-contract')}">Save Draft & Exit</button>
                        <button class="btn btn-secondary" type="button" data-award-guard-navigate data-navigate="awarding-contracts">Open Another Tender</button>
                    </div>

                    <div class="tabs contract-workspace-tabs">
                        <div class="tab active" data-tab="overview">Overview</div>
                        <div class="tab" data-tab="clauses">Terms & Clauses</div>
                        <div class="tab" data-tab="negotiation">Negotiation ${renderActionRequiredMarker(openRequests)}</div>
                        <div class="tab" data-tab="versions">Version History</div>
                        <div class="tab" data-tab="documents">Documents ${renderActionRequiredMarker(requiredDocuments)}</div>
                        <div class="tab" data-tab="signatures">Signatures ${renderActionRequiredMarker(contract.lockedForSignature ? 0 : 1)}</div>
                        <div class="tab" data-tab="activity">Activity Log</div>
                    </div>

                    <div class="contract-workspace-tab-content">
                        <div class="tab-content tab-content--visible" data-tab="overview">${renderContractOverview(contract)}</div>
                        <div class="tab-content tab-content--hidden" data-tab="clauses">${renderContractClauses(contract)}</div>
                        <div class="tab-content tab-content--hidden" data-tab="negotiation">${renderContractNegotiationTab(contract)}</div>
                        <div class="tab-content tab-content--hidden" data-tab="versions">${renderContractVersions(contract)}</div>
                        <div class="tab-content tab-content--hidden" data-tab="documents">${renderContractDocuments(contract)}</div>
                        <div class="tab-content tab-content--hidden" data-tab="signatures">${renderContractSignatures(contract)}</div>
                        <div class="tab-content tab-content--hidden" data-tab="activity">${renderContractActivity(contract)}</div>
                    </div>
                </section>
            </main>
        </div>
    `;
}

if (window.app) {
    window.app.renderContractNegotiation = renderContractNegotiation;
}
