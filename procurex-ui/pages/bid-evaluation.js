// Guided Bid Evaluation Workspace

function escapeEvaluationHtml(value = '') {
    return String(value)
        .replace(/and/g, 'andamp;')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function formatEvaluationMoney(value, currency = 'TZS') {
    if (typeof value !== 'number') return escapeEvaluationHtml(value || '-');
    return `${currency} ${value.toLocaleString()}`;
}

function getEvaluationAllTenders() {
    if (typeof getProcurexAllTenders === 'function') return getProcurexAllTenders();
    return mockData.tenders || [];
}

function getEvaluationSourceTender(reference) {
    const tenders = getEvaluationAllTenders();
    return tenders.find(tender => tender.id === reference || tender.reference === reference)
        || tenders.find(tender => tender.title === reference)
        || null;
}

function slugEvaluationId(value = 'criterion') {
    return String(value || 'criterion')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'criterion';
}

function normalizeEvaluationCriterion(criterion = {}, index = 0) {
    const name = criterion.name || criterion.label || `Criterion ${index + 1}`;
    const maxScore = Number(criterion.maxScore || criterion.weight || 0) || 0;
    return {
        id: criterion.id || slugEvaluationId(name),
        name,
        weight: Number(criterion.weight || maxScore || 0),
        maxScore: maxScore || Number(criterion.weight || 0) || 10,
        subcriteria: Array.isArray(criterion.subcriteria) ? criterion.subcriteria : [],
        type: String(name).toLowerCase().includes('financial') || String(name).toLowerCase().includes('price') ? 'financial' : 'technical'
    };
}

function getEvaluationCriteriaForTender(tender, fallbackCriteria = []) {
    const tenderCriteria = tender?.evaluation?.criteria;
    const source = Array.isArray(tenderCriteria) && tenderCriteria.length ? tenderCriteria : fallbackCriteria;
    return source.map((criterion, index) => normalizeEvaluationCriterion(criterion, index));
}

function getEvaluationBadgeClass(value = '') {
    const status = String(value).toLowerCase();
    if (status.includes('fail') || status.includes('rejected') || status.includes('overdue') || status.includes('not eligible') || status.includes('escalate')) return 'badge-error';
    if (status.includes('pending') || status.includes('clarification') || status.includes('review') || status.includes('managed') || status.includes('watch') || status.includes('moderate')) return 'badge-warning';
    if (status.includes('complete') || status.includes('pass') || status.includes('eligible') || status.includes('recommended') || status.includes('cleared') || status.includes('active') || status.includes('submitted') || status.includes('clear') || status.includes('low')) return 'badge-success';
    return 'badge-info';
}

function getEvaluationTechnicalTotal(bid, criteria) {
    return criteria.reduce((sum, criterion) => {
        const raw = bid.technicalScores?.[criterion.id] ?? bid.technicalScores?.[slugEvaluationId(criterion.name)];
        return sum + Number(raw || 0);
    }, 0);
}

function renderEvaluationStatusBadge(value) {
    return `<span class="badge ${getEvaluationBadgeClass(value)}">${escapeEvaluationHtml(value)}</span>`;
}

function getEvaluationSubmittedBidForSupplier(tender = {}, bid = {}, bidderIndex = 0) {
    if (typeof getProcurexSubmittedBidsForTender !== 'function') return null;
    const submitted = getProcurexSubmittedBidsForTender(tender);
    if (!submitted.length) return null;
    const supplierName = String(bid.supplier || '').toLowerCase();
    return submitted.find(item => String(item.supplier || item.draft?.supplier || item.draft?.supplierName || '').toLowerCase() === supplierName)
        || submitted[bidderIndex]
        || (bidderIndex === 0 ? submitted[0] : null);
}

function renderEvaluationSupplierBidDocument(tender = {}, bid = {}, bidderIndex = 0, criteria = []) {
    if (typeof renderProcurexBidPackageDocument !== 'function') {
        return '<div class="scope-empty">Bid document renderer is unavailable.</div>';
    }
    const sourceTender = tender.sourceTender || tender;
    const submittedBid = getEvaluationSubmittedBidForSupplier(sourceTender, bid, bidderIndex);
    const sections = submittedBid && typeof createProcurexBidPackageSectionsFromDraft === 'function'
        ? createProcurexBidPackageSectionsFromDraft(submittedBid.draft || {})
        : (typeof createProcurexBidPackageSectionsFromEvaluationBid === 'function'
            ? createProcurexBidPackageSectionsFromEvaluationBid(bid, criteria)
            : []);
    const supplier = submittedBid
        ? {
            name: bid.supplier || submittedBid.supplier || mockData.users?.supplier?.organization || 'Supplier organization',
            registrationNumber: bid.registrationNumber,
            contactPerson: bid.contactPerson,
            submittedAt: submittedBid.submittedAt ? new Date(submittedBid.submittedAt).toLocaleString() : '',
            receiptHash: submittedBid.receiptHash,
            total: submittedBid.draft?.total || bid.price,
            status: 'Submitted bid'
        }
        : {
            name: bid.supplier || 'Supplier',
            registrationNumber: bid.registrationNumber,
            contactPerson: bid.contactPerson,
            submittedAt: bid.submissionTime,
            receiptHash: bid.integrityHash,
            total: bid.financial?.correctedPrice ? formatEvaluationMoney(bid.financial.correctedPrice, bid.financial?.currency || 'TZS') : formatEvaluationMoney(bid.price, bid.financial?.currency || 'TZS'),
            status: bid.finalResult || bid.preliminaryResult || 'Under Evaluation'
        };

    return renderProcurexBidPackageDocument({
        tender: sourceTender,
        sections,
        supplier,
        editable: false,
        includeActions: false,
        documentLabel: submittedBid ? 'Submitted Tenderer Bid' : 'Reconstructed Evaluation Copy',
        offerLabel: tender.category || sourceTender.type || 'Bid Offer',
        description: submittedBid
            ? 'This evaluation copy is generated from the tenderer submission saved during bid submission.'
            : 'Reconstructed from evaluation data - supplier submission not found in this browser session.'
    });
}

function renderEvaluationChecklist(items = []) {
    return `
        <div class="evaluation-checklist">
            ${items.map(item => `
                <div class="evaluation-check-row">
                    <div>
                        <strong>${escapeEvaluationHtml(item.requirement)}</strong>
                        <span>${escapeEvaluationHtml(item.comment || '')}</span>
                    </div>
                    <div class="evaluation-check-actions">
                        ${renderEvaluationStatusBadge(item.result)}
                        ${item.document ? `<button class="btn btn-secondary" type="button">View Document</button>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getSelectedEvaluationTenderReference(evaluation) {
    const readyTenders = evaluation.readyTenders || [];
    if (readyTenders.length <= 1) return readyTenders[0]?.reference || evaluation.activeTender?.reference || '';
    try {
        return localStorage.getItem('procurex.selectedEvaluationTender') || '';
    } catch (error) {
        return window.procurexSelectedEvaluationTender || '';
    }
}

function getSelectedEvaluationReportReference() {
    try {
        return localStorage.getItem('procurex.selectedEvaluationReport') || '';
    } catch (error) {
        return window.procurexSelectedEvaluationReport || '';
    }
}

function getEvaluationTenderModel(evaluation, selectedReference) {
    const activeTender = evaluation.activeTender || {};
    const selectedTender = (evaluation.readyTenders || []).find(item => item.reference === selectedReference);
    const sourceTender = getEvaluationSourceTender(selectedReference);
    if (!selectedTender && !sourceTender) return activeTender;

    return {
        ...activeTender,
        sourceTender,
        title: sourceTender?.title || selectedTender?.title || activeTender.title,
        reference: sourceTender?.id || selectedTender?.reference || activeTender.reference,
        category: sourceTender?.type || selectedTender?.category || activeTender.category,
        closingDate: selectedTender?.closingDate || sourceTender?.closingDate || activeTender.closingDate,
        evaluationDeadline: selectedTender?.deadline || sourceTender?.milestones?.find(item => item.id === 'milestone-evaluation')?.date || activeTender.evaluationDeadline,
        status: selectedTender?.status || activeTender.status,
        stage: activeTender.stage,
        bidders: selectedTender?.bidsReceived || activeTender.bidders,
        conflictStatus: selectedTender?.conflictStatus === 'Complete' ? activeTender.conflictStatus : (selectedTender?.conflictStatus || activeTender.conflictStatus),
        draftStatus: selectedTender?.draftStatus || 'Draft',
        progress: selectedTender?.progress || 0,
        method: sourceTender?.method || activeTender.method
    };
}

function getEvaluationDraft(reference) {
    if (!reference) return null;
    try {
        const saved = JSON.parse(localStorage.getItem(`procurex.evaluationDraft.${reference}`) || 'null');
        return saved && typeof saved === 'object' ? saved : null;
    } catch (error) {
        return window.procurexEvaluationDrafts?.[reference] || null;
    }
}

function saveEvaluationDraft(reference, payload) {
    if (!reference) return;
    try {
        localStorage.setItem(`procurex.evaluationDraft.${reference}`, JSON.stringify(payload));
    } catch (error) {
        window.procurexEvaluationDrafts = {
            ...(window.procurexEvaluationDrafts || {}),
            [reference]: payload
        };
    }
}

function getEvaluationDraftScore(draft, bidderName, criterionId, field, fallback = '') {
    return draft?.scores?.[bidderName]?.[criterionId]?.[field] ?? fallback;
}

function getDefaultEvaluationScore(bid, criterion) {
    if (criterion.type === 'financial') {
        return bid.financialScore || Math.max(0, Math.min(criterion.maxScore, Math.round((criterion.maxScore || 10) * 0.85)));
    }
    const proportional = bid.technicalScore ? Math.round((Number(bid.technicalScore) / 100) * criterion.maxScore) : Math.round((criterion.maxScore || 10) * 0.8);
    return Math.max(0, Math.min(criterion.maxScore || 10, proportional));
}

function getEvaluationDraftProgress(draft, criteria = [], bids = []) {
    if (draft?.status === 'Completed') return 100;
    const total = Math.max(1, criteria.length * bids.length);
    const completed = criteria.reduce((sum, criterion) => (
        sum + bids.filter(bid => {
            const row = draft?.scores?.[bid.supplier]?.[criterion.id];
            return row && row.result && String(row.comment || '').trim();
        }).length
    ), 0);
    return Math.max(draft?.progress || 0, Math.round((completed / total) * 100));
}

function getEvaluationCriterionTotalForBid(bid, criteria, draft) {
    return criteria.reduce((sum, criterion) => {
        const savedScore = Number(getEvaluationDraftScore(draft, bid.supplier, criterion.id, 'score', NaN));
        const score = Number.isFinite(savedScore) ? savedScore : getDefaultEvaluationScore(bid, criterion);
        return sum + score;
    }, 0);
}

function getEvaluationRecommendedBid(bids, criteria, draft) {
    return bids.slice().sort((a, b) => {
        const bScore = getEvaluationCriterionTotalForBid(b, criteria, draft);
        const aScore = getEvaluationCriterionTotalForBid(a, criteria, draft);
        if (bScore !== aScore) return bScore - aScore;
        return (a.financial?.correctedPrice || a.price || Number.MAX_SAFE_INTEGER) - (b.financial?.correctedPrice || b.price || Number.MAX_SAFE_INTEGER);
    })[0] || bids[0] || {};
}

function renderEvaluationReportDocument(tender, criteria, bids, draft, auditTrail = []) {
    const recommendedBid = getEvaluationRecommendedBid(bids, criteria, draft);
    return `
        <section class="evaluation-report-document" data-evaluation-report-document>
            <header>
                <span>ProcureX Evaluation Report</span>
                <h1>${escapeEvaluationHtml(tender.title || 'Tender Evaluation')}</h1>
                <p>${escapeEvaluationHtml(tender.reference || '')} / ${escapeEvaluationHtml(tender.category || '')}</p>
            </header>
            <div class="evaluation-report-summary">
                <div><span>Status</span><strong>${escapeEvaluationHtml(draft?.status || 'Draft')}</strong></div>
                <div><span>Completed</span><strong>${escapeEvaluationHtml(draft?.completedAt ? new Date(draft.completedAt).toLocaleString() : 'Not completed')}</strong></div>
                <div><span>Recommended bidder</span><strong>${escapeEvaluationHtml(draft?.recommendation?.supplier || recommendedBid.supplier || '-')}</strong></div>
                <div><span>Evaluated amount</span><strong>${formatEvaluationMoney(recommendedBid.financial?.correctedPrice || recommendedBid.price)}</strong></div>
            </div>
            <h2>Criteria Used</h2>
            <table>
                <thead><tr><th>Criterion</th><th>Weight</th><th>Subcriteria</th></tr></thead>
                <tbody>
                    ${criteria.map(item => `
                        <tr>
                            <td>${escapeEvaluationHtml(item.name)}</td>
                            <td>${escapeEvaluationHtml(item.weight || item.maxScore)}%</td>
                            <td>${escapeEvaluationHtml((item.subcriteria || []).join(', ') || 'None')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <h2>Bidder Evaluation Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Bidder</th>
                        ${criteria.map(item => `<th>${escapeEvaluationHtml(item.name)}</th>`).join('')}
                        <th>Total</th>
                        <th>Corrected price</th>
                    </tr>
                </thead>
                <tbody>
                    ${bids.map(bid => `
                        <tr>
                            <td>${escapeEvaluationHtml(bid.supplier)}</td>
                            ${criteria.map(item => {
                                const row = draft?.scores?.[bid.supplier]?.[item.id] || {};
                                const score = row.score ?? getDefaultEvaluationScore(bid, item);
                                return `<td>${escapeEvaluationHtml(row.result || 'Pending')} / ${escapeEvaluationHtml(score)}<br>${escapeEvaluationHtml(row.comment || '')}</td>`;
                            }).join('')}
                            <td>${getEvaluationCriterionTotalForBid(bid, criteria, draft)}</td>
                            <td>${formatEvaluationMoney(bid.financial?.correctedPrice || bid.price)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <h2>Recommendation</h2>
            <p>${escapeEvaluationHtml(draft?.recommendation?.reason || `${recommendedBid.supplier || 'Recommended bidder'} has the highest evaluated result based on the buyer-defined criteria.`)}</p>
            <h2>Audit Trail</h2>
            <ul>
                ${auditTrail.map(item => `<li>${escapeEvaluationHtml(item.time)} - ${escapeEvaluationHtml(item.event)} (${escapeEvaluationHtml(item.ref)})</li>`).join('')}
            </ul>
        </section>
    `;
}

function collectEvaluationDraftFromDom(reference, status = 'Saved as draft') {
    const existing = getEvaluationDraft(reference) || {};
    const panel = document.querySelector('[data-evaluation-step-panel]');
    const scores = { ...(existing.scores || {}) };

    document.querySelectorAll('[data-eval-result], [data-eval-score], [data-eval-comment], [data-eval-evidence]').forEach(field => {
        const bidder = field.getAttribute('data-bidder');
        const criterion = field.getAttribute('data-criterion');
        if (!bidder || !criterion) return;

        scores[bidder] = scores[bidder] || {};
        scores[bidder][criterion] = scores[bidder][criterion] || {};

        if (field.matches('[data-eval-result]')) scores[bidder][criterion].result = field.value;
        if (field.matches('[data-eval-score]')) scores[bidder][criterion].score = Number(field.value || 0);
        if (field.matches('[data-eval-comment]')) scores[bidder][criterion].comment = field.value;
        if (field.matches('[data-eval-evidence]')) scores[bidder][criterion].evidence = field.value;
    });

    const currentCriterionIndex = Number(panel?.getAttribute('data-current-criterion-index') || existing.currentCriterionIndex || 0);
    const currentBidderIndex = Number(panel?.getAttribute('data-current-bidder-index') || existing.currentBidderIndex || 0);
    const totalItems = Number(panel?.getAttribute('data-total-items') || 1);
    const completedItems = Object.values(scores).reduce((sum, bidderScores) => (
        sum + Object.values(bidderScores || {}).filter(row => row?.result && String(row?.comment || '').trim()).length
    ), 0);
    const progress = status === 'Completed' ? 100 : Math.min(99, Math.max(existing.progress || 0, Math.round((completedItems / Math.max(1, totalItems)) * 100)));

    return {
        ...existing,
        reference,
        status,
        currentStage: status === 'Completed' ? 'report' : 'technical',
        currentCriterionIndex,
        currentBidderIndex,
        scores,
        recommendation: existing.recommendation || {},
        progress,
        savedAt: new Date().toISOString(),
        completedAt: status === 'Completed' ? new Date().toISOString() : existing.completedAt
    };
}

function getEvaluationProgress(stages, currentStage) {
    const actionableStages = stages.filter(stage => stage.id !== 'overview' && stage.id !== 'audit');
    const currentIndex = actionableStages.findIndex(stage => stage.id === currentStage);
    if (currentIndex < 0) return 0;
    return Math.round(((currentIndex + 1) / Math.max(1, actionableStages.length)) * 100);
}

function getEvaluationTenderRuntime(item) {
    const saved = getEvaluationDraft(item.reference);
    const progress = saved?.progress ?? item.progress ?? 0;
    const status = saved?.status || item.draftStatus || 'Not started';
    const savedDate = saved?.savedAt || saved?.completedAt || '';
    const savedLabel = savedDate
        ? new Date(savedDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'No browser draft';

    return {
        status,
        progress,
        savedLabel,
        action: status === 'Completed' ? 'Review Evaluation' : status === 'Saved as draft' ? 'Continue Evaluation' : 'Open Evaluation'
    };
}

function renderEvaluationTenderSelection(evaluation) {
    const readyTenders = evaluation.readyTenders || [];

    return `
        <div class="main-layout procurement-layout evaluation-app-layout">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Bid Evaluation</h3>
                    <span>Select tender</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-navigate="bid-evaluation" class="active">Evaluation</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content evaluation-workspace">
                <section class="procurement-hero evaluation-hero-panel evaluation-selection-hero">
                    <div>
                        <span class="section-kicker">Evaluation app</span>
                        <h1>Select Tender for Evaluation</h1>
                        <p>Choose the tender you posted and want to evaluate. Each tender has its own locked submissions, buyer-defined criteria, draft progress, generated report, recommendation, and audit trail.</p>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${readyTenders.length}</strong><span>Ready tenders</span></div>
                        <div><strong>${readyTenders.reduce((sum, item) => sum + Number(item.bidsReceived || 0), 0)}</strong><span>Total bids</span></div>
                    </div>
                </section>

                <section class="procurement-panel evaluation-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Tenders ready for evaluation</span>
                            <h2>Start by opening the correct bid evaluation</h2>
                        </div>
                    </div>
                    <div class="evaluation-ready-grid">
                        ${readyTenders.map(item => {
                            const runtime = getEvaluationTenderRuntime(item);
                            return `
                                <article class="evaluation-ready-card evaluation-select-card">
                                    <div>
                                        <span class="section-kicker">${escapeEvaluationHtml(item.category)}</span>
                                        <h3>${escapeEvaluationHtml(item.title)}</h3>
                                        <p>${escapeEvaluationHtml(item.reference)}</p>
                                    </div>
                                    <div class="evaluation-ready-meta">
                                        <span><strong>${escapeEvaluationHtml(item.closingDate)}</strong> closing date</span>
                                        <span><strong>${item.bidsReceived}</strong> bids received</span>
                                        <span><strong>${escapeEvaluationHtml(item.deadline)}</strong> evaluation deadline</span>
                                        <span><strong>${runtime.progress}%</strong> progress</span>
                                        <span><strong>${escapeEvaluationHtml(runtime.savedLabel)}</strong> last save</span>
                                    </div>
                                    <div class="evaluation-progress-track">
                                        <span style="width: ${Math.min(100, Math.max(0, runtime.progress))}%"></span>
                                    </div>
                                    <div class="evaluation-card-footer">
                                        ${renderEvaluationStatusBadge(item.status)}
                                        ${renderEvaluationStatusBadge(runtime.status)}
                                        ${renderEvaluationStatusBadge(`COI ${item.conflictStatus}`)}
                                    </div>
                                    <div class="evaluation-card-footer">
                                        <button class="btn btn-primary" type="button" data-evaluation-select="${escapeEvaluationHtml(item.reference)}">${escapeEvaluationHtml(runtime.action)}</button>
                                        ${runtime.status === 'Completed' ? `
                                            <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(item.reference)}">View Report</button>
                                            <button class="btn btn-secondary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(item.reference)}">Download Report</button>
                                        ` : ''}
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </section>
            </main>
        </div>
    `;
}

function renderBidEvaluation() {
    const evaluation = mockData.bidEvaluation || {};
    const reportReference = getSelectedEvaluationReportReference();
    const selectedReference = reportReference || getSelectedEvaluationTenderReference(evaluation);
    const hasMultipleTenders = (evaluation.readyTenders || []).length > 1;

    if (hasMultipleTenders && !selectedReference) {
        return renderEvaluationTenderSelection(evaluation);
    }

    const tender = getEvaluationTenderModel(evaluation, selectedReference);
    const bids = evaluation.bids || [];
    const stages = evaluation.stages || [];
    const criteria = getEvaluationCriteriaForTender(tender.sourceTender, evaluation.technicalCriteria || []);
    const opening = evaluation.openingReport || {};
    const benchmark = evaluation.benchmark || {};
    const recommended = evaluation.recommendation || {};
    const stageIndex = Math.max(0, stages.findIndex(stage => stage.id === (evaluation.currentStage || 'technical')));
    const savedDraft = getEvaluationDraft(tender.reference);
    const draftStatus = savedDraft?.status || tender.draftStatus || 'Draft';
    const progress = getEvaluationDraftProgress(savedDraft, criteria, bids) || tender.progress || getEvaluationProgress(stages, evaluation.currentStage || 'technical');
    const lastSaved = savedDraft?.savedAt ? new Date(savedDraft.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not saved in this browser';
    const technicalMax = criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0) || 100;
    const passedTechnical = bids.filter(bid => getEvaluationTechnicalTotal(bid, criteria) >= (evaluation.minimumTechnicalPassMark || 70));
    const topBidRecord = getEvaluationRecommendedBid(bids, criteria, savedDraft);
    const topBid = savedDraft?.recommendation?.supplier || topBidRecord.supplier || recommended.supplier || '-';
    const currentCriterionIndex = criteria.length ? Math.min(criteria.length - 1, Math.max(0, Number(savedDraft?.currentCriterionIndex || 0))) : 0;
    const currentBidderIndex = bids.length ? Math.min(bids.length - 1, Math.max(0, Number(savedDraft?.currentBidderIndex || 0))) : 0;
    const requiredEvaluationItems = criteria.length * bids.length;
    const completedEvaluationItems = criteria.reduce((sum, criterion) => (
        sum + bids.filter(bid => {
            const row = savedDraft?.scores?.[bid.supplier]?.[criterion.id];
            return row?.result && String(row?.comment || '').trim();
        }).length
    ), 0);
    const canCompleteEvaluation = requiredEvaluationItems > 0 && completedEvaluationItems >= requiredEvaluationItems;

    const renderReportPage = () => `
        <div class="main-layout procurement-layout evaluation-app-layout">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Evaluation Report</h3>
                    <span>${escapeEvaluationHtml(tender.reference || '')}</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-evaluation-close-report>Select Tender</a></li>
                    <li><a href="#" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</a></li>
                    <li><a href="#" data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                </ul>
            </aside>
            <main class="main-content procurement-content evaluation-workspace">
                <section class="procurement-hero evaluation-hero-panel">
                    <div>
                        <span class="section-kicker">Generated evaluation report</span>
                        <h1>${escapeEvaluationHtml(tender.title)}</h1>
                        <p>This report was generated from the buyer evaluation draft saved for this tender.</p>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${escapeEvaluationHtml(savedDraft?.status || 'Draft')}</strong><span>Status</span></div>
                        <div><strong>${progress}%</strong><span>Progress</span></div>
                    </div>
                </section>
                <section class="procurement-panel evaluation-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Report preview</span>
                            <h2>View and download evaluation report</h2>
                        </div>
                        <button class="btn btn-primary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</button>
                    </div>
                    ${renderEvaluationReportDocument(tender, criteria, bids, savedDraft, evaluation.auditTrail || [])}
                </section>
            </main>
        </div>
    `;

    if (reportReference) {
        return renderReportPage();
    }

    const renderTenderReadiness = () => `
        <div class="evaluation-ready-grid evaluation-single-tender-grid">
            <article class="evaluation-ready-card">
                <div>
                    <span class="section-kicker">${escapeEvaluationHtml(tender.category)}</span>
                    <h3>${escapeEvaluationHtml(tender.title)}</h3>
                    <p>${escapeEvaluationHtml(tender.reference)}</p>
                </div>
                <div class="evaluation-ready-meta">
                    <span><strong>${escapeEvaluationHtml(tender.closingDate)}</strong> closing date</span>
                    <span><strong>${escapeEvaluationHtml(tender.bidders || bids.length)}</strong> bids received</span>
                    <span><strong>${escapeEvaluationHtml(tender.evaluationDeadline)}</strong> evaluation deadline</span>
                </div>
                <div class="evaluation-card-footer">
                    ${renderEvaluationStatusBadge(tender.status)}
                    ${renderEvaluationStatusBadge(`Draft: ${draftStatus}`)}
                    ${renderEvaluationStatusBadge(`COI ${tender.conflictStatus}`)}
                </div>
                <p class="evaluation-small-note">This evaluation record belongs only to this tender. Scores, comments, clarifications, draft saves, recommendation, and audit trail are not shared with other tenders.</p>
            </article>
            <article class="evaluation-ready-card evaluation-draft-card">
                <div>
                    <span class="section-kicker">Evaluation draft</span>
                    <h3>${progress}% complete</h3>
                    <p>Last saved: ${escapeEvaluationHtml(lastSaved)}</p>
                </div>
                <div class="evaluation-progress-track">
                    <span style="width: ${Math.min(100, Math.max(0, progress))}%"></span>
                </div>
                <div class="evaluation-card-footer">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-primary" type="button" data-tab-jump="recommendation">Continue Evaluation</button>
                </div>
            </article>
        </div>
    `;

    const renderIntelligence = () => `
        <div class="evaluation-intel-grid">
            <article class="evaluation-intel-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Price benchmarking</span>
                        <h3>Market realism check</h3>
                    </div>
                    ${renderEvaluationStatusBadge(evaluation.priceOutliers ? 'Watch' : 'Clear')}
                </div>
                <div class="evaluation-summary-grid">
                    <div><span>Buyer estimate</span><strong>${formatEvaluationMoney(benchmark.buyerEstimate)}</strong></div>
                    <div><span>Market median</span><strong>${formatEvaluationMoney(benchmark.marketMedian)}</strong></div>
                    <div><span>Best Evaluated Bid</span><strong>${formatEvaluationMoney(benchmark.comparableEconomicCost)}</strong></div>
                    <div><span>Variance band</span><strong>${escapeEvaluationHtml(benchmark.varianceBand || '-')}</strong></div>
                </div>
                <div class="evaluation-note-list">
                    ${(benchmark.notes || []).map(note => `<span>${escapeEvaluationHtml(note)}</span>`).join('')}
                </div>
            </article>
            <article class="evaluation-intel-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Risk and compliance</span>
                        <h3>Signals before recommendation</h3>
                    </div>
                    ${renderEvaluationStatusBadge('1 watch item')}
                </div>
                <div class="evaluation-signal-list">
                    ${(evaluation.riskSignals || []).map(signal => `
                        <div>
                            <strong>${escapeEvaluationHtml(signal.supplier)}</strong>
                            <span>${escapeEvaluationHtml(signal.driver)}</span>
                            ${renderEvaluationStatusBadge(`${signal.risk} risk`)}
                        </div>
                    `).join('')}
                    ${(evaluation.collusionSignals || []).map(signal => `
                        <div>
                            <strong>${escapeEvaluationHtml(signal.signal)}</strong>
                            <span>${escapeEvaluationHtml(signal.detail)}</span>
                            ${renderEvaluationStatusBadge(signal.status)}
                        </div>
                    `).join('')}
                </div>
            </article>
        </div>
    `;

    const renderOpening = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Bid opening summary</span>
                    <h2>Submissions are locked and disclosed by stage</h2>
                </div>
                ${renderEvaluationStatusBadge(opening.hashStatus || 'Verified')}
            </div>
            <div class="evaluation-notice success">${escapeEvaluationHtml(opening.message || evaluation.emptyStates?.notStarted || '')}</div>
            <div class="evaluation-summary-grid">
                <div><span>Opening time</span><strong>${escapeEvaluationHtml(opening.openingTime)}</strong></div>
                <div><span>Envelope opened</span><strong>${escapeEvaluationHtml(opening.envelope)}</strong></div>
                <div><span>Authorized by</span><strong>${escapeEvaluationHtml((opening.authorizedBy || []).join(', '))}</strong></div>
                <div><span>Audit reference</span><strong>${escapeEvaluationHtml(opening.auditReference)}</strong></div>
            </div>
            <div class="data-table evaluation-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Supplier</th>
                            <th>Submission time</th>
                            <th>Bid status</th>
                            <th>Documents</th>
                            <th>Technical</th>
                            <th>Financial</th>
                            <th>Bid security</th>
                            <th>Deadline</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(opening.submissions || []).map(row => `
                            <tr>
                                <td>${escapeEvaluationHtml(row.supplier)}</td>
                                <td>${escapeEvaluationHtml(row.time)}</td>
                                <td>${renderEvaluationStatusBadge(row.status)}</td>
                                <td>${escapeEvaluationHtml((row.documents || []).join(', '))}</td>
                                <td>${escapeEvaluationHtml(row.technicalOffer)}</td>
                                <td>${escapeEvaluationHtml(row.financialOffer)}</td>
                                <td>${escapeEvaluationHtml(row.bidSecurity)}</td>
                                <td>${renderEvaluationStatusBadge(row.deadline)}</td>
                                <td>${escapeEvaluationHtml(row.remarks)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const renderConflict = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Conflict of interest declaration</span>
                    <h2>Declaration required before evaluation</h2>
                </div>
                ${renderEvaluationStatusBadge(tender.conflictStatus || 'Pending')}
            </div>
            <p class="evaluation-lead">Before participating in this evaluation, each evaluator must confirm whether they have any personal, financial, professional, or other relationship with any bidder that may affect impartial judgment.</p>
            <div class="evaluation-option-row">
                <label><input type="radio" name="conflict-option" checked> I have no conflict of interest.</label>
                <label><input type="radio" name="conflict-option"> I have a potential conflict of interest.</label>
            </div>
            <div class="evaluation-form-grid">
                <label>Supplier involved <input class="form-input" type="text" value="Prime Contractors"></label>
                <label>Type of conflict <input class="form-input" type="text" value="Professional"></label>
                <label>Recommended action <input class="form-input" type="text" value="Review by chairperson"></label>
                <label>Explanation <textarea class="form-input" rows="3">Prior project relationship disclosed for committee review.</textarea></label>
            </div>
            <div class="data-table">
                <table>
                    <thead><tr><th>Evaluator</th><th>Role</th><th>Declaration</th><th>Supplier</th><th>Action</th><th>Submitted</th><th>Status</th></tr></thead>
                    <tbody>
                        ${(evaluation.conflictDeclarations || []).map(item => `
                            <tr>
                                <td>${escapeEvaluationHtml(item.evaluator)}</td>
                                <td>${escapeEvaluationHtml(item.role)}</td>
                                <td>${escapeEvaluationHtml(item.declaration)}</td>
                                <td>${escapeEvaluationHtml(item.supplier)}</td>
                                <td>${escapeEvaluationHtml(item.action)}</td>
                                <td>${escapeEvaluationHtml(item.submittedAt)}</td>
                                <td>${renderEvaluationStatusBadge(item.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const renderPreliminary = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Preliminary evaluation</span>
                    <h2>Mandatory administrative compliance</h2>
                </div>
                ${renderEvaluationStatusBadge('Opening Completed')}
            </div>
            <p class="evaluation-lead">Confirm that each bidder submitted required documents and complied with basic tender instructions before technical evaluation.</p>
            <div class="evaluation-supplier-grid">
                ${bids.map(bid => `
                    <article class="evaluation-supplier-card">
                        <div class="evaluation-supplier-head">
                            <div>
                                <strong>${escapeEvaluationHtml(bid.supplier)}</strong>
                                <span>${escapeEvaluationHtml(bid.registrationNumber)} / ${escapeEvaluationHtml(bid.contactPerson)}</span>
                            </div>
                            ${renderEvaluationStatusBadge(bid.preliminaryResult)}
                        </div>
                        ${renderEvaluationChecklist(bid.preliminaryChecks)}
                    </article>
                `).join('')}
            </div>
        </section>
    `;

    const renderEligibility = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Eligibility evaluation</span>
                    <h2>Legal, professional, and capacity qualification</h2>
                </div>
                ${renderEvaluationStatusBadge('Eligibility Review')}
            </div>
            <div class="evaluation-supplier-grid">
                ${bids.map(bid => `
                    <article class="evaluation-supplier-card">
                        <div class="evaluation-supplier-head">
                            <div>
                                <strong>${escapeEvaluationHtml(bid.supplier)}</strong>
                                <span>${escapeEvaluationHtml((bid.documents || []).join(', '))}</span>
                            </div>
                            ${renderEvaluationStatusBadge(bid.eligibilityResult)}
                        </div>
                        ${renderEvaluationChecklist(bid.eligibilityChecks)}
                    </article>
                `).join('')}
            </div>
        </section>
    `;

    const renderTechnical = () => {
        const criterion = criteria[currentCriterionIndex] || criteria[0] || {};
        const bid = bids[currentBidderIndex] || bids[0] || {};
        const savedResult = getEvaluationDraftScore(savedDraft, bid.supplier, criterion.id, 'result', 'Pass');
        const savedScore = getEvaluationDraftScore(savedDraft, bid.supplier, criterion.id, 'score', getDefaultEvaluationScore(bid, criterion));
        const savedComment = getEvaluationDraftScore(savedDraft, bid.supplier, criterion.id, 'comment', `${bid.supplier || 'Bidder'} reviewed against ${criterion.name || 'criterion'}.`);
        const savedEvidence = getEvaluationDraftScore(savedDraft, bid.supplier, criterion.id, 'evidence', (criterion.subcriteria || []).slice(0, 2).join(', '));
        const completedCount = criteria.reduce((sum, item) => (
            sum + bids.filter(candidate => savedDraft?.scores?.[candidate.supplier]?.[item.id]?.result).length
        ), 0);
        const totalItems = Math.max(1, criteria.length * bids.length);
        const bidDocument = renderEvaluationSupplierBidDocument(tender, bid, currentBidderIndex, criteria);

        return `
            <section class="procurement-panel evaluation-panel">
                <div class="panel-heading">
                    <div>
                        <span class="section-kicker">Buyer evaluator workspace</span>
                        <h2>Evaluate one criterion and one bidder at a time</h2>
                    </div>
                    ${renderEvaluationStatusBadge(`${completedCount} of ${totalItems} items recorded`)}
                </div>
                <div class="evaluation-notice success">This evaluation follows the criteria defined by the buyer when this tender was created. Complete each bidder against each criterion, save draft as needed, then generate the report.</div>
                <div class="evaluation-bid-document-review">
                    ${bidDocument}
                </div>
                <div class="evaluation-step-grid" data-evaluation-step-panel data-current-criterion-index="${currentCriterionIndex}" data-current-bidder-index="${currentBidderIndex}" data-total-items="${totalItems}">
                    <aside class="evaluation-step-rail">
                        <span class="section-kicker">Criteria from tender</span>
                        ${criteria.map((item, index) => `
                            <button class="evaluation-step-criterion ${index === currentCriterionIndex ? 'active' : ''}" type="button" data-evaluation-jump-criterion="${index}">
                                <strong>${escapeEvaluationHtml(item.name)}</strong>
                                <span>${escapeEvaluationHtml(item.weight || item.maxScore)}% / ${(item.subcriteria || []).length} subcriteria</span>
                            </button>
                        `).join('')}
                    </aside>
                    <section class="evaluation-step-card">
                        <div class="evaluation-step-head">
                            <div>
                                <span class="section-kicker">Criterion ${currentCriterionIndex + 1} of ${criteria.length}</span>
                                <h3>${escapeEvaluationHtml(criterion.name)}</h3>
                                <p>Weight / maximum score: ${escapeEvaluationHtml(criterion.weight || criterion.maxScore)}. Evaluation type: ${criterion.type === 'financial' ? 'Financial / price review' : 'Technical or compliance review'}.</p>
                            </div>
                            <div class="evaluation-bidder-switcher">
                                <span>Bidder ${currentBidderIndex + 1} of ${bids.length}</span>
                                <strong>${escapeEvaluationHtml(bid.supplier)}</strong>
                            </div>
                        </div>

                        <div class="evaluation-subcriteria-panel">
                            <span class="section-kicker">Items to check under this criterion</span>
                            <div class="evaluation-subcriteria-list-readonly">
                                ${(criterion.subcriteria || []).map(item => `<span>${escapeEvaluationHtml(item)}</span>`).join('') || '<span>No subcriteria defined for this criterion.</span>'}
                            </div>
                        </div>

                        ${criterion.type === 'financial' ? `
                            <div class="evaluation-financial-review">
                                <div><span>Quoted price</span><strong>${formatEvaluationMoney(bid.price, bid.financial?.currency || 'TZS')}</strong></div>
                                <div><span>Corrected price</span><strong>${formatEvaluationMoney(bid.financial?.correctedPrice, bid.financial?.currency || 'TZS')}</strong></div>
                                <div><span>BOQ status</span><strong>${escapeEvaluationHtml(bid.financial?.boqStatus || 'Pending')}</strong></div>
                                <div><span>Ranking</span><strong>${escapeEvaluationHtml(bid.financial?.ranking || '-')}</strong></div>
                            </div>
                        ` : ''}

                        <div class="evaluation-entry-grid">
                            <label>Result
                                <select class="form-input" data-eval-result data-bidder="${escapeEvaluationHtml(bid.supplier)}" data-criterion="${escapeEvaluationHtml(criterion.id)}">
                                    ${['Pass', 'Fail', 'Requires Clarification', 'Not Applicable'].map(option => `<option value="${option}" ${option === savedResult ? 'selected' : ''}>${option}</option>`).join('')}
                                </select>
                            </label>
                            <label>Score
                                <input class="form-input" type="number" min="0" max="${escapeEvaluationHtml(criterion.maxScore)}" value="${escapeEvaluationHtml(savedScore)}" data-eval-score data-bidder="${escapeEvaluationHtml(bid.supplier)}" data-criterion="${escapeEvaluationHtml(criterion.id)}">
                            </label>
                            <label>Evidence / document note
                                <input class="form-input" value="${escapeEvaluationHtml(savedEvidence)}" data-eval-evidence data-bidder="${escapeEvaluationHtml(bid.supplier)}" data-criterion="${escapeEvaluationHtml(criterion.id)}">
                            </label>
                            <label>Buyer evaluator comment
                                <textarea class="form-input" rows="4" data-eval-comment data-bidder="${escapeEvaluationHtml(bid.supplier)}" data-criterion="${escapeEvaluationHtml(criterion.id)}">${escapeEvaluationHtml(savedComment)}</textarea>
                            </label>
                        </div>

                        <div class="evaluation-step-actions">
                            <button class="btn btn-secondary" type="button" data-evaluation-move="previous">Previous Item</button>
                            <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                            <button class="btn btn-primary" type="button" data-evaluation-move="next">Save and Next Item</button>
                        </div>
                    </section>
                </div>
            </section>
        `;
    };

    const renderFinancial = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Financial evaluation</span>
                    <h2>Opened only after required technical pass</h2>
                </div>
                ${renderEvaluationStatusBadge(opening.disclosureStatus || 'Locked')}
            </div>
            <div class="evaluation-notice warning">Supplier prices cannot be changed secretly. Every arithmetic correction must include an explanation and remains visible in the audit trail.</div>
            <div class="data-table evaluation-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Supplier</th>
                            <th>Quoted price</th>
                            <th>Taxes</th>
                            <th>Discount</th>
                            <th>Arithmetic correction</th>
                            <th>Corrected price</th>
                            <th>BOQ status</th>
                            <th>Pricing status</th>
                            <th>Ranking</th>
                            <th>Correction note</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bids.map(bid => `
                            <tr>
                                <td>${escapeEvaluationHtml(bid.supplier)}</td>
                                <td>${formatEvaluationMoney(bid.price, bid.financial?.currency || 'TZS')}</td>
                                <td>${escapeEvaluationHtml(bid.financial?.taxesIncluded)}</td>
                                <td>${escapeEvaluationHtml(bid.financial?.discount)}</td>
                                <td>${formatEvaluationMoney(bid.financial?.arithmeticCorrection || 0, bid.financial?.currency || 'TZS')}</td>
                                <td><strong>${formatEvaluationMoney(bid.financial?.correctedPrice, bid.financial?.currency || 'TZS')}</strong></td>
                                <td>${renderEvaluationStatusBadge(bid.financial?.boqStatus || 'Pending')}</td>
                                <td>${escapeEvaluationHtml(bid.financial?.pricingStatus)}</td>
                                <td>${bid.financial?.ranking || '-'}</td>
                                <td>${escapeEvaluationHtml(bid.financial?.correctionNote)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const renderClarifications = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Evaluation clarifications</span>
                    <h2>Official questions and responses</h2>
                </div>
                ${renderEvaluationStatusBadge(`${(evaluation.clarifications || []).length} active`)}
            </div>
            <div class="evaluation-notice warning">Clarification must not be used to allow bidders to change price, replace major documents, or submit a new bid after closing.</div>
            <div class="evaluation-clarification-list">
                ${(evaluation.clarifications || []).map(item => `
                    <article class="evaluation-clarification">
                        <div>
                            <span class="section-kicker">${escapeEvaluationHtml(item.supplier)}</span>
                            <h3>${escapeEvaluationHtml(item.subject)}</h3>
                            <p>${escapeEvaluationHtml(item.message)}</p>
                            <small>${escapeEvaluationHtml(item.requirement)} / Due ${escapeEvaluationHtml(item.deadline)}</small>
                        </div>
                        <div>
                            ${renderEvaluationStatusBadge(item.status)}
                            <p>${escapeEvaluationHtml(item.evaluatorNote)}</p>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;

    const renderComparison = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Evaluation comparison matrix</span>
                    <h2>Side-by-side bidder decision view</h2>
                </div>
                ${renderEvaluationStatusBadge(`Recommended: ${topBid}`)}
            </div>
            <div class="data-table evaluation-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Criteria</th>
                            ${bids.map(bid => `<th>${escapeEvaluationHtml(bid.supplier)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${[
                            ['Preliminary evaluation', bid => bid.preliminaryResult],
                            ['Eligibility', bid => bid.eligibilityResult],
                            ['Buyer evaluation score', bid => `${getEvaluationCriterionTotalForBid(bid, criteria, savedDraft)}/${technicalMax}`],
                            ['Financial offer', bid => formatEvaluationMoney(bid.price)],
                            ['Corrected price', bid => formatEvaluationMoney(bid.financial?.correctedPrice)],
                            ['Final ranking', bid => bid.financial?.ranking || '-'],
                            ['Recommended', bid => bid.supplier === topBid ? 'Yes' : 'No']
                        ].map(row => `
                            <tr>
                                <td><strong>${row[0]}</strong></td>
                                ${bids.map(bid => `<td>${escapeEvaluationHtml(row[1](bid))}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const renderReport = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Evaluation report generator</span>
                    <h2>View and download generated report</h2>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(tender.reference)}">View Report</button>
                    <button class="btn btn-primary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</button>
                </div>
            </div>
            ${renderEvaluationReportDocument(tender, criteria, bids, savedDraft, evaluation.auditTrail || [])}
        </section>
    `;

    const renderRecommendation = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Recommendation for award</span>
                    <h2>Submit the buyer evaluator decision</h2>
                </div>
                ${renderEvaluationStatusBadge(recommended.decision || 'Draft')}
            </div>
            <div class="evaluation-form-grid recommendation-form">
                <label>Recommended tenderer <input class="form-input" value="${escapeEvaluationHtml(savedDraft?.recommendation?.supplier || topBid)}"></label>
                <label>Evaluation method used <input class="form-input" value="${escapeEvaluationHtml(tender.method || recommended.method)}"></label>
                <label>Recommended amount <input class="form-input" value="${formatEvaluationMoney(savedDraft?.recommendation?.amount || topBidRecord.financial?.correctedPrice || topBidRecord.price || recommended.amount, recommended.currency)}"></label>
                <label>Buyer evaluator decision <input class="form-input" value="${escapeEvaluationHtml(recommended.decision)}"></label>
                <label>Reason for recommendation <textarea class="form-input" rows="4">${escapeEvaluationHtml(savedDraft?.recommendation?.reason || `${topBid} is recommended based on the buyer-defined criteria for this tender.`)}</textarea></label>
                <label>Conditions <textarea class="form-input" rows="4">${escapeEvaluationHtml(recommended.conditions)}</textarea></label>
            </div>
            <div class="inline-actions">
                <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                <button class="btn btn-secondary" type="button">Preview Report</button>
                <button class="btn btn-primary" type="button" data-tab-jump="audit">Submit Recommendation</button>
                <button class="btn btn-secondary" type="button">Return for Review</button>
            </div>
        </section>
    `;

    const renderAudit = () => `
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Approvals and audit trail</span>
                    <h2>Traceability, roles, and locked records</h2>
                </div>
                ${renderEvaluationStatusBadge('Audit recording')}
            </div>
            <div class="journey-grid two-col">
                <div class="evaluation-role-list">
                    ${(evaluation.roles || []).map(role => `
                        <div class="evaluation-role-row">
                            <strong>${escapeEvaluationHtml(role.role)}</strong>
                            <span>${escapeEvaluationHtml(role.access)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="evaluation-audit-list">
                    ${(evaluation.auditTrail || []).map(item => `
                        <div class="evaluation-audit-row">
                            <span>${escapeEvaluationHtml(item.time)}</span>
                            <strong>${escapeEvaluationHtml(item.event)}</strong>
                            <p>${escapeEvaluationHtml(item.actor)} / ${escapeEvaluationHtml(item.ref)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="evaluation-finish-panel">
                <div>
                    <span class="section-kicker">Finish evaluation</span>
                    <h3>Complete this tender evaluation</h3>
                    <p>Use this only after all buyer-defined criteria have been evaluated for every bidder. Current completion: ${completedEvaluationItems} of ${requiredEvaluationItems} required evaluation items.</p>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-primary" type="button" data-evaluation-complete="${escapeEvaluationHtml(tender.reference)}" ${canCompleteEvaluation ? '' : 'disabled'}>Complete Evaluation</button>
                </div>
            </div>
        </section>
    `;

    return `
        <div class="main-layout procurement-layout evaluation-app-layout">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>Bid Evaluation</h3>
                    <span>${escapeEvaluationHtml(tender.reference || '')}</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-navigate="bid-evaluation" class="active">Evaluation</a></li>
                    <li><a href="#" data-navigate="award-recommendation">Award Recommendation</a></li>
                    <li><a href="#" data-evaluation-clear-selection>Select Tender</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </aside>

            <main class="main-content procurement-content evaluation-workspace">
                <section class="procurement-hero evaluation-hero-panel">
                    <div>
                        <span class="section-kicker">Evaluation app</span>
                        <h1>${escapeEvaluationHtml(tender.title)}</h1>
                        <p>This workspace is scoped to one tender posted by the buyer. The buyer evaluator can save draft progress, return later, evaluate each criterion for each bidder, generate the report, and complete the tender evaluation.</p>
                    </div>
                    <div class="evaluation-hero-stats">
                        <div><strong>${evaluation.totalBids || bids.length}</strong><span>Total bids</span></div>
                        <div><strong>${evaluation.validSubmissions || bids.length}</strong><span>Valid submissions</span></div>
                        <div><strong>${progress}%</strong><span>Draft progress</span></div>
                        <div><strong>${escapeEvaluationHtml(draftStatus)}</strong><span>Draft status</span></div>
                    </div>
                </section>

                <section class="evaluation-top-summary">
                    <div><span>Tender title</span><strong>${escapeEvaluationHtml(tender.title)}</strong></div>
                    <div><span>Reference</span><strong>${escapeEvaluationHtml(tender.reference)}</strong></div>
                    <div><span>Stage</span><strong>${escapeEvaluationHtml(tender.stage)}</strong></div>
                    <div><span>Bidders</span><strong>${escapeEvaluationHtml(tender.bidders || bids.length)}</strong></div>
                    <div><span>Deadline</span><strong>${escapeEvaluationHtml(tender.evaluationDeadline)}</strong></div>
                    <div><span>Status</span>${renderEvaluationStatusBadge(tender.status || 'In Progress')}</div>
                    <div><span>Draft</span>${renderEvaluationStatusBadge(draftStatus)}</div>
                </section>

                <div class="tabs wizard-step-progress evaluation-stage-tabs" style="--wizard-progress-ratio: ${Math.min(1, Math.max(0, stageIndex / Math.max(1, stages.length - 1)))};">
                    ${stages.map((stage, index) => `
                        <button class="tab wizard-progress-step evaluation-stage-tab ${index < stageIndex ? 'completed' : ''} ${index === 0 ? 'active' : ''} ${stage.status}" type="button" data-tab="${escapeEvaluationHtml(stage.id)}">
                            <strong>${index + 1}</strong>
                            <span>${escapeEvaluationHtml(stage.label)}</span>
                        </button>
                    `).join('')}
                </div>

                <div class="evaluation-stage-content">
                    <div class="tab-content" data-tab="overview" style="display: block;">
                        <section class="procurement-panel evaluation-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Selected tender evaluation</span>
                                    <h2>Draftable evaluation record for this tender only</h2>
                                </div>
                                ${renderEvaluationStatusBadge(tender.conflictStatus || 'COI pending')}
                            </div>
                            ${renderTenderReadiness()}
                            <div class="evaluation-controls-grid">
                                ${(evaluation.controls || []).map(item => `
                                    <article>
                                        <strong>${escapeEvaluationHtml(item.control)}</strong>
                                        <p>${escapeEvaluationHtml(item.purpose)}</p>
                                        ${renderEvaluationStatusBadge(item.status)}
                                    </article>
                                `).join('')}
                            </div>
                            ${renderIntelligence()}
                        </section>
                    </div>
                    <div class="tab-content" data-tab="opening" style="display: none;">${renderOpening()}</div>
                    <div class="tab-content" data-tab="conflict" style="display: none;">${renderConflict()}</div>
                    <div class="tab-content" data-tab="preliminary" style="display: none;">${renderPreliminary()}</div>
                    <div class="tab-content" data-tab="eligibility" style="display: none;">${renderEligibility()}</div>
                    <div class="tab-content" data-tab="technical" style="display: none;">${renderTechnical()}</div>
                    <div class="tab-content" data-tab="financial" style="display: none;">${renderFinancial()}</div>
                    <div class="tab-content" data-tab="clarifications" style="display: none;">${renderClarifications()}</div>
                    <div class="tab-content" data-tab="comparison" style="display: none;">${renderComparison()}</div>
                    <div class="tab-content" data-tab="report" style="display: none;">${renderReport()}</div>
                    <div class="tab-content" data-tab="recommendation" style="display: none;">${renderRecommendation()}</div>
                    <div class="tab-content" data-tab="audit" style="display: none;">${renderAudit()}</div>
                </div>
            </main>
        </div>
    `;
}

// Register the page render function
if (window.app) {
    window.app.renderBidEvaluation = renderBidEvaluation;
}

if (typeof document !== 'undefined' && !window.procurexEvaluationSelectionListenerReady) {
    window.procurexEvaluationSelectionListenerReady = true;
    document.addEventListener('click', (event) => {
        const selectButton = event.target.closest('[data-evaluation-select]');
        const clearButton = event.target.closest('[data-evaluation-clear-selection]');
        const saveDraftButton = event.target.closest('[data-evaluation-save-draft]');
        const completeButton = event.target.closest('[data-evaluation-complete]');
        const tabJumpButton = event.target.closest('[data-tab-jump]');
        const moveButton = event.target.closest('[data-evaluation-move]');
        const criterionJumpButton = event.target.closest('[data-evaluation-jump-criterion]');
        const viewReportButton = event.target.closest('[data-evaluation-view-report]');
        const downloadReportButton = event.target.closest('[data-evaluation-download-report]');
        const closeReportButton = event.target.closest('[data-evaluation-close-report]');

        if (!selectButton && !clearButton && !saveDraftButton && !completeButton && !tabJumpButton && !moveButton && !criterionJumpButton && !viewReportButton && !downloadReportButton && !closeReportButton) return;

        event.preventDefault();

        if (tabJumpButton) {
            const target = tabJumpButton.getAttribute('data-tab-jump');
            const tab = document.querySelector(`.evaluation-stage-tabs .tab[data-tab="${target}"]`);
            tab?.click();
            return;
        }

        if (moveButton || criterionJumpButton) {
            const selected = getSelectedEvaluationTenderReference(mockData.bidEvaluation || {});
            const draft = collectEvaluationDraftFromDom(selected, 'Saved as draft');
            const criteriaCount = document.querySelectorAll('[data-evaluation-jump-criterion]').length || 1;
            const bidderCount = mockData.bidEvaluation?.bids?.length || 1;

            if (criterionJumpButton) {
                draft.currentCriterionIndex = Number(criterionJumpButton.getAttribute('data-evaluation-jump-criterion') || 0);
                draft.currentBidderIndex = 0;
            } else {
                const direction = moveButton.getAttribute('data-evaluation-move');
                const flatIndex = (draft.currentCriterionIndex * bidderCount) + draft.currentBidderIndex + (direction === 'next' ? 1 : -1);
                const boundedIndex = Math.max(0, Math.min((criteriaCount * bidderCount) - 1, flatIndex));
                draft.currentCriterionIndex = Math.floor(boundedIndex / bidderCount);
                draft.currentBidderIndex = boundedIndex % bidderCount;
            }

            saveEvaluationDraft(selected, draft);
            if (window.app?.navigateTo) window.app.navigateTo('bid-evaluation');
            return;
        }

        if (downloadReportButton) {
            const reference = downloadReportButton.getAttribute('data-evaluation-download-report');
            const sourceTender = getEvaluationSourceTender(reference);
            const tender = getEvaluationTenderModel(mockData.bidEvaluation || {}, reference);
            const criteria = getEvaluationCriteriaForTender(sourceTender, mockData.bidEvaluation?.technicalCriteria || []);
            const draft = getEvaluationDraft(reference);
            const html = renderEvaluationReportDocument(tender, criteria, mockData.bidEvaluation?.bids || [], draft, mockData.bidEvaluation?.auditTrail || []);
            const reportNode = document.createElement('div');
            reportNode.innerHTML = html;
            document.body.appendChild(reportNode);
            if (window.html2pdf) {
                window.html2pdf().set({
                    margin: 0.4,
                    filename: `${reference}-evaluation-report.pdf`,
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                }).from(reportNode).save().finally(() => reportNode.remove());
            } else {
                window.print();
                reportNode.remove();
            }
            return;
        }

        try {
            if (selectButton) {
                localStorage.setItem('procurex.selectedEvaluationTender', selectButton.getAttribute('data-evaluation-select'));
                localStorage.removeItem('procurex.selectedEvaluationReport');
            } else if (clearButton) {
                localStorage.removeItem('procurex.selectedEvaluationTender');
                localStorage.removeItem('procurex.selectedEvaluationReport');
            } else if (closeReportButton) {
                localStorage.removeItem('procurex.selectedEvaluationReport');
            } else if (viewReportButton) {
                localStorage.setItem('procurex.selectedEvaluationReport', viewReportButton.getAttribute('data-evaluation-view-report'));
                localStorage.removeItem('procurex.selectedEvaluationTender');
            } else if (saveDraftButton) {
                const reference = saveDraftButton.getAttribute('data-evaluation-save-draft');
                const payload = collectEvaluationDraftFromDom(reference, 'Saved as draft');
                saveEvaluationDraft(reference, payload);
                localStorage.removeItem('procurex.selectedEvaluationTender');
            } else if (completeButton) {
                const reference = completeButton.getAttribute('data-evaluation-complete');
                const payload = collectEvaluationDraftFromDom(reference, 'Completed');
                const sourceTender = getEvaluationSourceTender(reference);
                const criteria = getEvaluationCriteriaForTender(sourceTender, mockData.bidEvaluation?.technicalCriteria || []);
                const recommendedBid = getEvaluationRecommendedBid(mockData.bidEvaluation?.bids || [], criteria, payload);
                payload.recommendation = {
                    supplier: recommendedBid.supplier,
                    amount: recommendedBid.financial?.correctedPrice || recommendedBid.price,
                    reason: `${recommendedBid.supplier} is recommended based on the buyer-defined evaluation criteria and final evaluated price.`
                };
                saveEvaluationDraft(reference, payload);
                localStorage.removeItem('procurex.selectedEvaluationTender');
            }
        } catch (error) {
            if (selectButton) {
                window.procurexSelectedEvaluationTender = selectButton.getAttribute('data-evaluation-select');
                window.procurexSelectedEvaluationReport = '';
            } else if (clearButton) {
                window.procurexSelectedEvaluationTender = '';
                window.procurexSelectedEvaluationReport = '';
            } else if (closeReportButton) {
                window.procurexSelectedEvaluationReport = '';
            } else if (viewReportButton) {
                window.procurexSelectedEvaluationReport = viewReportButton.getAttribute('data-evaluation-view-report');
                window.procurexSelectedEvaluationTender = '';
            } else if (saveDraftButton || completeButton) {
                const isComplete = Boolean(completeButton);
                const reference = (saveDraftButton || completeButton).getAttribute(isComplete ? 'data-evaluation-complete' : 'data-evaluation-save-draft');
                const payload = collectEvaluationDraftFromDom(reference, isComplete ? 'Completed' : 'Saved as draft');
                saveEvaluationDraft(reference, payload);
                window.procurexSelectedEvaluationTender = '';
            }
        }

        if (window.app?.navigateTo) {
            window.app.navigateTo('bid-evaluation');
        }
    });
}
