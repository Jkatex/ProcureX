// ProcureX tender evaluation workspace.
// The page starts from published tenders, locks bidder evidence until evaluation is open,
// and evaluates one supplier bid at a time against the tender design.

const procurexEvaluationSelectedTenderKey = 'procurex.selectedEvaluationTender';
const procurexEvaluationSelectedReportKey = 'procurex.selectedEvaluationReport';

function escapeEvaluationHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function slugEvaluationId(value = 'item') {
    return String(value || 'item')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'item';
}

function formatEvaluationMoney(value, currency = 'TZS') {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return escapeEvaluationHtml(value || '-');
    return `${currency} ${amount.toLocaleString()}`;
}

function getEvaluationValueSummary(value = '') {
    if (Array.isArray(value)) {
        return value.map(item => getEvaluationValueSummary(item)).filter(Boolean).slice(0, 3).join('; ');
    }
    if (value && typeof value === 'object') {
        return Object.values(value).map(item => getEvaluationValueSummary(item)).filter(Boolean).slice(0, 3).join('; ');
    }
    return String(value || '').trim();
}

function getEvaluationEvidenceDocumentRegistry() {
    if (typeof window === 'undefined') return {};
    window.procurexEvaluationEvidenceDocuments = window.procurexEvaluationEvidenceDocuments || {};
    return window.procurexEvaluationEvidenceDocuments;
}

function getEvaluationEvidenceDocumentName(row = {}) {
    const file = row.file && typeof row.file === 'object' ? row.file : null;
    const raw = file?.name
        || (typeof row.file === 'string' ? row.file : '')
        || row.fileName
        || row.value
        || row.label
        || 'Submitted evidence';
    return String(raw || 'Submitted evidence').trim();
}

function isEvaluationDocumentEvidence(row = {}) {
    const text = `${row.section || ''} ${row.label || ''} ${row.value || ''} ${row.fileName || ''}`.toLowerCase();
    return Boolean(row.upload || row.file || row.fileKey)
        || /submitted document|document|proposal|license|certificate|registration|tax|form|attachment|upload|evidence|pdf|docx?|xlsx?|jpe?g|png/.test(text);
}

function registerEvaluationEvidenceDocument(row = {}) {
    if (!isEvaluationDocumentEvidence(row)) return '';
    const registry = getEvaluationEvidenceDocumentRegistry();
    const file = row.file && typeof row.file === 'object' ? row.file : {};
    const name = getEvaluationEvidenceDocumentName(row);
    const id = `evidence-${slugEvaluationId(row.fileKey || row.sourceId || row.label || name)}-${Object.keys(registry).length + 1}`;
    registry[id] = {
        id,
        name,
        type: row.type || file.type || 'text/html',
        size: row.size || file.size || 0,
        uploadedAt: row.uploadedAt || file.uploadedAt || '',
        sha256: row.sha256 || row.hash || file.sha256 || file.hash || '',
        dataUrl: row.dataUrl || file.dataUrl || '',
        section: row.section || 'Submitted evidence',
        label: row.label || name,
        value: row.value || name
    };
    return id;
}

function getEvaluationSafeFilename(value = 'submitted-document', extension = '') {
    const clean = String(value || 'submitted-document')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'submitted-document';
    return extension && !clean.toLowerCase().endsWith(extension) ? `${clean}${extension}` : clean;
}

function buildEvaluationDocumentPreviewHtml(documentMeta = {}) {
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeEvaluationHtml(documentMeta.name || 'Submitted evidence')}</title>
    <style>
        body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; }
        main { max-width: 760px; margin: 32px auto; border: 1px solid #cbd5e1; background: #fff; padding: 28px; }
        h1 { margin: 0 0 10px; font-size: 24px; }
        dl { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin: 20px 0 0; }
        dt { color: #64748b; font-weight: 700; }
        dd { margin: 0; overflow-wrap: anywhere; }
    </style>
</head>
<body>
    <main>
        <h1>${escapeEvaluationHtml(documentMeta.name || 'Submitted evidence')}</h1>
        <p>This evaluation preview contains the submitted document metadata available in the bid package.</p>
        <dl>
            <dt>Section</dt><dd>${escapeEvaluationHtml(documentMeta.section || '-')}</dd>
            <dt>Evidence row</dt><dd>${escapeEvaluationHtml(documentMeta.label || '-')}</dd>
            <dt>Submitted value</dt><dd>${escapeEvaluationHtml(documentMeta.value || '-')}</dd>
            <dt>File type</dt><dd>${escapeEvaluationHtml(documentMeta.type || '-')}</dd>
            <dt>File size</dt><dd>${escapeEvaluationHtml(documentMeta.size ? `${Number(documentMeta.size).toLocaleString()} bytes` : '-')}</dd>
            <dt>Uploaded at</dt><dd>${escapeEvaluationHtml(documentMeta.uploadedAt || '-')}</dd>
            <dt>SHA-256</dt><dd>${escapeEvaluationHtml(documentMeta.sha256 || '-')}</dd>
        </dl>
    </main>
</body>
</html>`;
}

function downloadEvaluationDocumentContent(content = '', filename = 'submitted-document.html', type = 'text/html;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openEvaluationEvidenceDocument(documentId = '') {
    const documentMeta = getEvaluationEvidenceDocumentRegistry()[documentId];
    if (!documentMeta) return;
    if (documentMeta.dataUrl) {
        window.open(documentMeta.dataUrl, '_blank', 'noopener');
        return;
    }
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
        alert('Allow pop-ups to view the submitted document.');
        return;
    }
    previewWindow.document.open();
    previewWindow.document.write(buildEvaluationDocumentPreviewHtml(documentMeta));
    previewWindow.document.close();
}

function downloadEvaluationEvidenceDocument(documentId = '') {
    const documentMeta = getEvaluationEvidenceDocumentRegistry()[documentId];
    if (!documentMeta) return;
    if (documentMeta.dataUrl) {
        const link = document.createElement('a');
        link.href = documentMeta.dataUrl;
        link.download = getEvaluationSafeFilename(documentMeta.name || 'submitted-document');
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
    }
    downloadEvaluationDocumentContent(
        buildEvaluationDocumentPreviewHtml(documentMeta),
        getEvaluationSafeFilename(documentMeta.name || 'submitted-document', '.html')
    );
}

function renderEvaluationEvidenceDocumentActions(row = {}) {
    const documentId = registerEvaluationEvidenceDocument(row);
    if (!documentId) return '';
    return `
        <div class="evaluation-document-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-evaluation-document-action="view" data-evaluation-document-id="${escapeEvaluationHtml(documentId)}">View</button>
            <button class="btn btn-secondary btn-sm" type="button" data-evaluation-document-action="download" data-evaluation-document-id="${escapeEvaluationHtml(documentId)}">Download</button>
        </div>
    `;
}

function renderEvaluationStatusBadge(value = 'Pending') {
    const text = String(value || 'Pending');
    const status = text.toLowerCase();
    let badgeClass = 'badge-info';
    if (/not eligible|locked|failed|fail|rejected|overdue|blocked/.test(status)) badgeClass = 'badge-error';
    else if (/pending|clarification|review|draft|watch|open/.test(status)) badgeClass = 'badge-warning';
    else if (/eligible|ready|complete|completed|passed|active|submitted|recommended|cleared/.test(status)) badgeClass = 'badge-success';
    return `<span class="badge ${badgeClass}">${escapeEvaluationHtml(text)}</span>`;
}

const procurexEvaluationRecommendationOptions = ['Recommended for award', 'Rejected'];

function normalizeEvaluationRecommendation(value = '') {
    const text = String(value || '').trim();
    if (/recommend/i.test(text)) return 'Recommended for award';
    if (/reject|fail|non-responsive|not qualified|clarification|reserve/i.test(text)) return 'Rejected';
    return '';
}

function renderEvaluationRecommendationOptions(savedValue = '') {
    const normalized = normalizeEvaluationRecommendation(savedValue);
    return ['', ...procurexEvaluationRecommendationOptions]
        .map(option => `<option value="${escapeEvaluationHtml(option)}" ${normalized === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select recommendation')}</option>`)
        .join('');
}

function renderEvaluationStageWorkflow(stages = [], activeStageId = '', dataAttribute = '', label = 'Evaluation stages') {
    const activeIndex = Math.max(0, stages.findIndex(stage => stage.id === activeStageId));
    const ratio = stages.length > 1 ? activeIndex / (stages.length - 1) : 1;
    return `
        <nav class="evaluation-section-rail evaluation-stage-tabs wizard-step-progress" aria-label="${escapeEvaluationHtml(label)}" style="--wizard-progress-ratio: ${ratio}">
            ${stages.map((stage, index) => {
                const isActive = stage.id === activeStageId;
                const isCompleted = index < activeIndex;
                return `
                    <button class="evaluation-section-button evaluation-stage-tab wizard-progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" type="button" ${dataAttribute}="${escapeEvaluationHtml(stage.id)}" aria-current="${isActive ? 'step' : 'false'}">
                        <strong>${String(index + 1).padStart(2, '0')}</strong>
                        <span>${escapeEvaluationHtml(stage.label)}</span>
                    </button>
                `;
            }).join('')}
        </nav>
    `;
}

function renderEvaluationSectionCompletionStatus(isComplete = false) {
    return renderEvaluationStatusBadge(isComplete ? 'Completed' : 'Incomplete');
}

function getEvaluationAllTenders() {
    if (typeof getProcurexAllTenders === 'function') return getProcurexAllTenders();
    return mockData.tenders || [];
}

function getEvaluationSourceTender(reference = '') {
    const tenders = getEvaluationAllTenders();
    return tenders.find(tender => tender.id === reference || tender.reference === reference)
        || tenders.find(tender => tender.title === reference)
        || null;
}

function getEvaluationProfileId(tender = {}) {
    if (typeof getCreateTenderTypeId === 'function') {
        return getCreateTenderTypeId(tender.procurementTypeId || tender.type || tender.category || tender.id || 'works');
    }
    const raw = String(tender.procurementTypeId || tender.type || tender.category || '').toLowerCase();
    if (/non[-\s]?consultancy|service/.test(raw)) return 'services';
    if (/consult/.test(raw)) return 'consultancy';
    if (/goods|supply|equipment|laboratory/.test(raw)) return 'goods';
    return 'works';
}

function getEvaluationProfile(tender = {}) {
    if (typeof getCreateTenderTypeProfile === 'function') return getCreateTenderTypeProfile(tender);
    const id = getEvaluationProfileId(tender);
    return {
        id,
        commercialName: id === 'goods' ? 'Quantity Schedule' : id === 'services' ? 'Service Schedule' : id === 'consultancy' ? 'Financial Proposal' : 'BOQ',
        evaluationFlow: ['Eligibility and Document Requirements', 'Technical Response', 'Financial Offer', 'Declaration'],
        evaluationCriteria: []
    };
}

function normalizeGoodsEvaluationType(value = '') {
    const raw = String(value || '').toLowerCase().replace(/[\s/-]+/g, '_');
    if (['pass_fail', 'price_based', 'document_check', 'specification_compliance', 'sample_based', 'delivery_based', 'warranty_support', 'scored'].includes(raw)) return raw;
    if (/pass.*fail|gate/.test(raw)) return 'pass_fail';
    if (/price|financial|cost|boq|fee/.test(raw)) return 'price_based';
    if (/document|license|certificate|authorization|registration|tax/.test(raw)) return 'document_check';
    if (/spec|technical|brand|model|product/.test(raw)) return 'specification_compliance';
    if (/sample|test/.test(raw)) return 'sample_based';
    if (/delivery|logistic|stock|installation|commission/.test(raw)) return 'delivery_based';
    if (/warranty|support|quality|after_sales|spare|return|replacement/.test(raw)) return 'warranty_support';
    return 'scored';
}

function inferGoodsEvaluationType(criterion = {}) {
    return normalizeGoodsEvaluationType(`${criterion.name || ''} ${criterion.category || ''} ${criterion.description || ''} ${(criterion.subcriteria || []).join(' ')}`);
}

function formatGoodsEvaluationType(value = '') {
    const labels = {
        scored: 'Scored',
        pass_fail: 'Pass / Fail',
        price_based: 'Price-based',
        document_check: 'Document check',
        specification_compliance: 'Specification compliance',
        sample_based: 'Sample-based',
        delivery_based: 'Delivery-based',
        warranty_support: 'Warranty / support'
    };
    return labels[normalizeGoodsEvaluationType(value)] || 'Scored';
}

function normalizeEvaluationCriterion(criterion = {}, index = 0) {
    const sourceName = Array.isArray(criterion) ? criterion[0] : (criterion.name || criterion.label);
    const name = sourceName || `Criterion ${index + 1}`;
    const sourceWeight = Array.isArray(criterion) ? criterion[1] : (criterion.weight || criterion.maxScore);
    const weight = Number(sourceWeight || 0);
    const subcriteria = Array.isArray(criterion)
        ? [criterion[2]].filter(Boolean)
        : (Array.isArray(criterion.subcriteria) ? criterion.subcriteria : [criterion.description].filter(Boolean));
    const evaluationType = normalizeGoodsEvaluationType(criterion.evaluationType || criterion.type || inferGoodsEvaluationType({ ...criterion, name, subcriteria }));
    const passFailGate = Boolean(criterion.passFailGate || /pass_fail|document_check/.test(evaluationType));
    const maxScore = passFailGate ? 0 : 100;
    return {
        id: criterion.id || slugEvaluationId(name),
        name,
        category: criterion.category || name,
        description: criterion.description || '',
        weight,
        maxScore,
        subcriteria,
        evidenceRequired: Array.isArray(criterion.evidenceRequired) ? criterion.evidenceRequired : String(criterion.evidenceRequired || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean),
        scoringGuide: Array.isArray(criterion.scoringGuide) ? criterion.scoringGuide : [],
        evaluationType,
        mandatory: Boolean(criterion.mandatory),
        passFailGate,
        type: /financial|price|cost|boq|fee/i.test(`${name} ${evaluationType}`) ? 'financial' : 'technical'
    };
}

function getEvaluationCriteriaForTender(tender = {}) {
    const profile = getEvaluationProfile(tender);
    const source = tender.evaluation?.criteria?.length
        ? tender.evaluation.criteria
        : (profile.evaluationCriteria || mockData.bidEvaluation?.technicalCriteria || []);
    return source.map(normalizeEvaluationCriterion);
}

function isEvaluationScoredCriterion(criterion = {}) {
    return !criterion.passFailGate && !/pass_fail|document_check/.test(criterion.evaluationType || '') && Number(criterion.maxScore || 0) > 0;
}

function getEvaluationScoredCriteria(criteria = []) {
    return criteria.filter(isEvaluationScoredCriterion);
}

function getEvaluationCriterionWeight(criterion = {}, scoredCriteria = []) {
    const weight = Number(criterion.weight || 0);
    if (Number.isFinite(weight) && weight > 0) return weight;
    return scoredCriteria.length ? 100 / scoredCriteria.length : 0;
}

function getEvaluationWeightedMaxScore(criteria = []) {
    return getEvaluationScoredCriteria(criteria).length ? 100 : 0;
}

function formatEvaluationScore(value = 0) {
    const score = Number(value || 0);
    if (!Number.isFinite(score)) return '0';
    return String(Math.round(score * 100) / 100).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatEvaluationCriterionReportSummary(criterion = {}) {
    return `${criterion.name} (${formatGoodsEvaluationType(criterion.evaluationType)}, weight ${criterion.weight || 0}, max score ${criterion.maxScore || 0})`;
}

function getEvaluationWeightedScore(criteria = [], getSavedRow = () => ({})) {
    const scoredCriteria = getEvaluationScoredCriteria(criteria);
    const totalWeight = scoredCriteria.reduce((sum, criterion) => sum + getEvaluationCriterionWeight(criterion, scoredCriteria), 0);
    if (!totalWeight) return 0;
    const weighted = scoredCriteria.reduce((sum, criterion) => {
        const row = getSavedRow(criterion) || {};
        const score = Math.min(Math.max(Number(row.score || 0) || 0, 0), 100);
        return sum + (score / 100) * getEvaluationCriterionWeight(criterion, scoredCriteria);
    }, 0);
    return Math.round((weighted / totalWeight) * 10000) / 100;
}

function parseEvaluationDate(value = '') {
    if (!value) return null;
    const text = String(value).trim();
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
    const parsed = Date.parse(isoDateOnly ? `${text}T23:59:59` : text);
    return Number.isFinite(parsed) ? parsed : null;
}

function isEvaluationTenderReady(tender = {}, readyMeta = {}) {
    const status = `${readyMeta.status || ''} ${tender.status || ''}`;
    if (/opening|evaluation|evaluat|closed|complete|completed|technical|financial|recommendation/i.test(status)) return true;
    const closingTime = parseEvaluationDate(readyMeta.closingDate || tender.closingDate);
    return Number.isFinite(closingTime) && closingTime <= Date.now();
}

function getSelectedEvaluationTenderReference() {
    try {
        return localStorage.getItem(procurexEvaluationSelectedTenderKey) || '';
    } catch (error) {
        return window.procurexSelectedEvaluationTender || '';
    }
}

function getSelectedEvaluationReportReference() {
    try {
        return localStorage.getItem(procurexEvaluationSelectedReportKey) || '';
    } catch (error) {
        return window.procurexSelectedEvaluationReport || '';
    }
}

function setSelectedEvaluationTender(reference = '') {
    try {
        if (reference) localStorage.setItem(procurexEvaluationSelectedTenderKey, reference);
        else localStorage.removeItem(procurexEvaluationSelectedTenderKey);
        localStorage.removeItem(procurexEvaluationSelectedReportKey);
    } catch (error) {
        window.procurexSelectedEvaluationTender = reference;
        window.procurexSelectedEvaluationReport = '';
    }
}

function setSelectedEvaluationReport(reference = '') {
    try {
        if (reference) localStorage.setItem(procurexEvaluationSelectedReportKey, reference);
        else localStorage.removeItem(procurexEvaluationSelectedReportKey);
        if (reference) localStorage.removeItem(procurexEvaluationSelectedTenderKey);
    } catch (error) {
        window.procurexSelectedEvaluationReport = reference;
        if (reference) window.procurexSelectedEvaluationTender = '';
    }
}

function clearProcurexEvaluationSelection() {
    setSelectedEvaluationTender('');
    setSelectedEvaluationReport('');
}

function getEvaluationDraft(reference = '') {
    if (!reference) return null;
    try {
        const saved = JSON.parse(localStorage.getItem(`procurex.evaluationDraft.${reference}`) || 'null');
        return saved && typeof saved === 'object' ? saved : null;
    } catch (error) {
        return window.procurexEvaluationDrafts?.[reference] || null;
    }
}

function isEvaluationAdminOversightSession() {
    return mockData.session?.accountType === 'admin' || mockData.pendingAccount?.accountType === 'admin';
}

function saveEvaluationDraft(reference = '', payload = {}) {
    if (!reference) return;
    if (isEvaluationAdminOversightSession()) return;
    try {
        localStorage.setItem(`procurex.evaluationDraft.${reference}`, JSON.stringify(payload));
    } catch (error) {
        window.procurexEvaluationDrafts = {
            ...(window.procurexEvaluationDrafts || {}),
            [reference]: payload
        };
    }
}

function getEvaluationReadyMeta(reference = '') {
    return (mockData.bidEvaluation?.readyTenders || []).find(item => item.reference === reference) || {};
}

function getEvaluationTenderList() {
    const readyTenders = mockData.bidEvaluation?.readyTenders || [];
    const readyRefs = new Set(readyTenders.map(item => item.reference));
    const allTenders = getEvaluationAllTenders().map(tender => typeof normalizeProcurexTenderOwnership === 'function' ? normalizeProcurexTenderOwnership(tender) : tender);
    const sourceTenders = allTenders
        .filter(tender => (typeof isProcurexTenderOwnedByCurrentUser === 'function' ? isProcurexTenderOwnedByCurrentUser(tender) : tender.createdByCurrentUser) && !/draft|cancelled|awarded/i.test(String(tender.status || '')));
    const missingReady = readyTenders
        .filter(item => {
            const source = allTenders.find(tender => tender.id === item.reference || tender.reference === item.reference);
            const owned = source && (typeof isProcurexTenderOwnedByCurrentUser === 'function' ? isProcurexTenderOwnedByCurrentUser(source) : source.createdByCurrentUser);
            return owned && !sourceTenders.some(tender => tender.id === item.reference || tender.reference === item.reference);
        })
        .map(item => ({
            id: item.reference,
            reference: item.reference,
            title: item.title,
            type: item.category,
            procurementTypeId: getEvaluationProfileId(item),
            status: item.status,
            closingDate: item.closingDate,
            createdByCurrentUser: true
        }));

    const seen = new Set();
    return [...missingReady, ...sourceTenders]
        .filter(tender => {
            const reference = tender.id || tender.reference || tender.title;
            if (!reference || seen.has(reference)) return false;
            seen.add(reference);
            return true;
        })
        .map(tender => {
            const reference = tender.id || tender.reference;
            const readyMeta = getEvaluationReadyMeta(reference);
            return {
                ...tender,
                id: reference,
                reference,
                status: readyMeta.status || tender.status || 'Published',
                closingDate: readyMeta.closingDate || tender.closingDate || '',
                evaluationDeadline: readyMeta.deadline || tender.milestones?.find(item => item.id === 'milestone-evaluation')?.date || '',
                bidsReceived: readyMeta.bidsReceived || null,
                progress: getEvaluationProgress(reference, tender),
                ready: isEvaluationTenderReady(tender, readyMeta),
                readySeed: readyRefs.has(reference)
            };
        });
}

function getEvaluationTenderModel(reference = '') {
    const sourceTender = getEvaluationSourceTender(reference) || getEvaluationTenderList().find(item => item.reference === reference) || {};
    const readyMeta = getEvaluationReadyMeta(reference);
    return {
        ...sourceTender,
        sourceTender,
        id: sourceTender.id || reference,
        reference: sourceTender.id || sourceTender.reference || reference,
        title: sourceTender.title || readyMeta.title || 'Tender evaluation',
        type: sourceTender.type || readyMeta.category || sourceTender.category || 'Tender',
        status: readyMeta.status || sourceTender.status || 'Published',
        closingDate: readyMeta.closingDate || sourceTender.closingDate || '',
        evaluationDeadline: readyMeta.deadline || sourceTender.milestones?.find(item => item.id === 'milestone-evaluation')?.date || '',
        bidsReceived: readyMeta.bidsReceived || null,
        ready: isEvaluationTenderReady(sourceTender, readyMeta),
        conflictStatus: readyMeta.conflictStatus || mockData.bidEvaluation?.activeTender?.conflictStatus || 'Pending'
    };
}

function getEvaluationSubmittedBidForSupplier(tender = {}, bid = {}, bidderIndex = 0) {
    if (typeof getProcurexSubmittedBidsForTender !== 'function') return null;
    const submitted = getProcurexSubmittedBidsForTender(tender);
    if (!submitted.length) return null;
    const supplier = String(bid.supplier || '').toLowerCase();
    return submitted.find(item => String(item.supplier || item.draft?.supplier || item.draft?.supplierName || '').toLowerCase() === supplier)
        || submitted[bidderIndex]
        || null;
}

function getEvaluationBidsForTender(tender = {}) {
    if (!tender.ready) return [];
    const submitted = typeof getProcurexSubmittedBidsForTender === 'function'
        ? getProcurexSubmittedBidsForTender(tender.sourceTender || tender)
        : [];
    const localBids = submitted.map((item, index) => ({
        supplier: item.supplier || item.draft?.supplier || item.draft?.supplierName || mockData.users?.supplier?.organization || `Supplier ${index + 1}`,
        registrationNumber: item.draft?.registrationNumber || '',
        contactPerson: item.draft?.contactPerson || '',
        submissionTime: item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '',
        integrityHash: item.receiptHash || '',
        price: Number(String(item.draft?.total || '').replace(/[^0-9.]/g, '')) || 0,
        documents: Object.values(item.draft?.uploadedFiles || {}).map(file => file?.name || file).filter(Boolean),
        draft: item.draft,
        submittedBid: item
    }));
    if (localBids.length) return localBids;

    const seededReference = mockData.bidEvaluation?.activeTender?.reference;
    if (tender.reference === seededReference || getEvaluationReadyMeta(tender.reference).reference) {
        return mockData.bidEvaluation?.bids || [];
    }
    return [];
}

function getEvaluationRequirementSet(tender = {}) {
    const profile = getEvaluationProfile(tender);
    if (typeof getBidWorkspaceRequirementSet === 'function') {
        return getBidWorkspaceRequirementSet(tender.sourceTender || tender, profile);
    }
    return { mandatory: [], optional: [] };
}

function getEvaluationTenderRequirementCount(tender = {}) {
    const set = getEvaluationRequirementSet(tender);
    const criteria = getEvaluationCriteriaForTender(tender);
    return (set.mandatory?.length || 0) + (set.optional?.length || 0) + criteria.length;
}

function createEvaluationReviewItem(sectionId, title, options = {}) {
    const id = options.id || `${sectionId}-${slugEvaluationId(title)}`;
    return {
        id,
        sectionId,
        title,
        category: options.category || 'Tender requirement',
        description: options.description || '',
        source: options.source || 'tender design',
        mandatory: options.mandatory !== false,
        maxScore: options.maxScore || 0,
        labels: options.labels || [title],
        evidenceHint: options.evidenceHint || ''
    };
}

function getEvaluationTypeSections(tender = {}) {
    const profileId = getEvaluationProfileId(tender);
    const commonFirst = [{ id: 'supplier-info', label: 'Supplier Information', detail: 'Submission identity, receipt, contact, and offer summary' }];
    const commonLast = [{ id: 'declaration', label: 'Declaration and Recommendation', detail: 'Final buyer declaration and recommendation readiness' }];
    const sections = {
        goods: [
            ...commonFirst,
            { id: 'eligibility', label: 'Eligibility and Documents', detail: 'Licenses, certifications, administrative forms, and submission files' },
            { id: 'technical-compliance', label: 'Technical Specification Compliance', detail: 'Buyer item specifications, standards, samples, and product evidence' },
            { id: 'delivery-warranty', label: 'Delivery, Warranty and Support', detail: 'Lead time, logistics, after-sales support, catalogues, and warranty commitments' },
            { id: 'financial', label: 'Financial Quantity Schedule', detail: 'Unit prices, totals, taxes, arithmetic checks, and price realism' },
            ...commonLast
        ],
        works: [
            ...commonFirst,
            { id: 'eligibility', label: 'Eligibility and Documents', detail: 'Licenses, bid security, administrative forms, and opening compliance' },
            { id: 'technical-capacity', label: 'Technical Capacity', detail: 'Experience, personnel, equipment, financial capacity, HSE, and resources' },
            { id: 'technical-proposal', label: 'Technical Proposal', detail: 'Methodology, work program, drawings, schedule, quality, and site response' },
            { id: 'financial', label: 'Financial BOQ Proposal', detail: 'Priced BOQ, corrected sum, tax, discount, and commercial terms' },
            { id: 'post-qualification', label: 'Post Qualification', detail: 'Confirm capacity, references, equipment, and award readiness' },
            ...commonLast
        ],
        services: [
            ...commonFirst,
            { id: 'eligibility', label: 'Eligibility and Documents', detail: 'Licenses, certifications, administrative forms, and submission files' },
            { id: 'methodology', label: 'Methodology', detail: 'Service understanding, workflow, quality assurance, and risk approach' },
            { id: 'delivery-plan', label: 'Delivery Plan', detail: 'Locations, schedule, SLA timers, milestones, and coverage model' },
            { id: 'staffing-capacity', label: 'Staffing and Capacity', detail: 'People, tools, systems, equipment, finance, and operational capacity' },
            { id: 'sla-reporting', label: 'SLA, Reporting and Compliance', detail: 'KPIs, escalation, reports, ESG, labor, and supporting documents' },
            { id: 'financial', label: 'Pricing', detail: 'Service schedule, rates, assumptions, taxes, and commercial terms' },
            ...commonLast
        ],
        consultancy: [
            ...commonFirst,
            { id: 'eligibility', label: 'Eligibility and Documents', detail: 'Licenses, registrations, administrative forms, and proposal submission files' },
            { id: 'technical-proposal', label: 'Technical Proposal', detail: 'Understanding of TOR, approach, methodology, and evidence' },
            { id: 'tor-response', label: 'TOR Response and Work Plan', detail: 'Activities, deliverables, timeline, reporting, and organization' },
            { id: 'experts-experience', label: 'Key Experts and Experience', detail: 'CVs, qualifications, professional registrations, and firm assignments' },
            { id: 'financial', label: 'Separate Financial Proposal', detail: 'Fees, reimbursables, taxes, validity, and method-specific ranking' },
            { id: 'combined-ranking', label: 'Combined Ranking', detail: 'QCBS, QBS, least-cost, or configured consultancy selection method' },
            ...commonLast
        ]
    };
    return sections[profileId] || sections.works;
}

function getEvaluationSectionForRequirement(requirement = {}, profileId = 'works') {
    const text = `${requirement.title || ''} ${requirement.category || ''} ${requirement.description || ''}`.toLowerCase();
    if (/price|financial|boq|fee|rate|commercial|quantity schedule|pricing/.test(text)) return 'financial';
    if (/license|certificate|registration|tax|bid security|document|eligibility|administrative|declaration/.test(text)) return 'eligibility';
    if (profileId === 'goods') {
        if (/delivery|warranty|support|sample|catalog|manufacturer|stock|logistics/.test(text)) return 'delivery-warranty';
        return 'technical-compliance';
    }
    if (profileId === 'services') {
        if (/staff|personnel|equipment|capacity|tool|system/.test(text)) return 'staffing-capacity';
        if (/sla|kpi|report|compliance|esg|labor|performance/.test(text)) return 'sla-reporting';
        if (/schedule|location|delivery|milestone|coverage|response time/.test(text)) return 'delivery-plan';
        return 'methodology';
    }
    if (profileId === 'consultancy') {
        if (/expert|cv|qualification|experience|assignment|firm|registration/.test(text)) return 'experts-experience';
        if (/tor|deliverable|work plan|timeline|report|activity|methodology/.test(text)) return 'tor-response';
        return 'technical-proposal';
    }
    if (/personnel|equipment|experience|capacity|hse|safety|financial capacity|resource/.test(text)) return 'technical-capacity';
    if (/methodology|schedule|work program|drawing|quality|site|technical/.test(text)) return 'technical-proposal';
    return 'technical-capacity';
}

function getEvaluationReviewSections(tender = {}) {
    const profileId = getEvaluationProfileId(tender);
    const typeSections = getEvaluationTypeSections(tender).map(section => ({ ...section, items: [] }));
    const byId = new Map(typeSections.map(section => [section.id, section]));
    const requirementSet = getEvaluationRequirementSet(tender);
    const allRequirements = [...(requirementSet.mandatory || []), ...(requirementSet.optional || [])];

    allRequirements.forEach(requirement => {
        const sectionId = getEvaluationSectionForRequirement(requirement, profileId);
        const target = byId.get(sectionId) || byId.get('eligibility');
        target?.items.push(createEvaluationReviewItem(sectionId, requirement.title, {
            id: requirement.id || `${sectionId}-${slugEvaluationId(requirement.title)}`,
            category: requirement.category,
            description: requirement.description,
            source: requirement.source || 'tender requirement',
            mandatory: requirement.mandatory,
            labels: [requirement.title, requirement.category, requirement.description].filter(Boolean)
        }));
    });

    getEvaluationCriteriaForTender(tender).forEach(criterion => {
        const sectionId = criterion.type === 'financial'
            ? 'financial'
            : getEvaluationSectionForRequirement({ title: criterion.name, category: criterion.name, description: criterion.subcriteria.join(' ') }, profileId);
        const target = byId.get(sectionId) || byId.get('technical-proposal') || byId.get('technical-compliance');
        target?.items.push(createEvaluationReviewItem(sectionId, criterion.name, {
            id: `criterion-${criterion.id}`,
            category: 'Evaluation criterion',
            description: criterion.subcriteria.join(', ') || 'Buyer-defined criterion',
            source: 'evaluation criteria',
            maxScore: criterion.type === 'financial' ? 0 : criterion.maxScore,
            labels: [criterion.name, ...criterion.subcriteria]
        }));
    });

    const commercialItems = tender.commercialItems || tender.boqItems || [];
    commercialItems.slice(0, 8).forEach((item, index) => {
        byId.get('financial')?.items.push(createEvaluationReviewItem('financial', item.description || item.workItem || item.serviceTask || item.item || `Commercial line ${index + 1}`, {
            id: `financial-line-${index}`,
            category: 'Commercial schedule',
            description: `${item.qty || item.quantity || 1} ${item.unit || ''} / estimate ${formatEvaluationMoney(item.rate || item.totalCost || item.amount || 0)}`,
            source: 'commercial schedule',
            labels: [item.description, item.workItem, item.serviceTask, item.item].filter(Boolean)
        }));
    });

    byId.get('declaration')?.items.push(createEvaluationReviewItem('declaration', 'Buyer confirms all supplier responses were reviewed', {
        id: 'buyer-final-declaration',
        category: 'Buyer declaration',
        description: 'Confirm the evaluation decision is based on the published tender requirements and recorded bid evidence.',
        source: 'system',
        maxScore: 0
    }));

    return typeSections.map(section => {
        if (section.id === 'supplier-info') return section;
        if (!section.items.length) {
            section.items.push(createEvaluationReviewItem(section.id, section.label, {
                id: `${section.id}-general-review`,
                category: 'Section review',
                description: section.detail,
                source: 'procurement type'
            }));
        }
        return section;
    });
}

function getEvaluationBidEvidenceRows(tender = {}, bid = {}, bidderIndex = 0) {
    const submittedBid = getEvaluationSubmittedBidForSupplier(tender.sourceTender || tender, bid, bidderIndex);
    if (submittedBid?.draft && typeof createProcurexBidPackageSectionsFromDraft === 'function') {
        const draft = submittedBid.draft || {};
        const rows = createProcurexBidPackageSectionsFromDraft(draft)
            .flatMap(section => (section.rows || []).map(row => ({
                section: section.title,
                label: row.label || row.requirement || row.key || 'Bid response',
                value: row.value || row.file?.name || 'Provided',
                file: row.file || '',
                fileKey: row.sourceId || row.key || '',
                upload: Boolean(row.upload || row.file),
                type: row.file?.type || '',
                size: row.file?.size || 0,
                uploadedAt: row.file?.uploadedAt || '',
                sha256: row.file?.sha256 || row.file?.hash || '',
                dataUrl: row.file?.dataUrl || ''
            })));
        Object.entries(draft.uploadedFiles || {}).forEach(([key, file]) => {
            const name = file?.name || file || '';
            const alreadyListed = rows.some(row => row.fileKey === key || getEvaluationEvidenceDocumentName(row) === name);
            if (alreadyListed) return;
            const label = typeof humanizeBidWorkspaceKey === 'function'
                ? humanizeBidWorkspaceKey(file?.parentResponseId || key)
                : 'Submitted document';
            rows.push({
                section: 'Submitted documents',
                label,
                value: name || 'Uploaded file',
                file,
                fileKey: key,
                upload: true,
                type: file?.type || '',
                size: file?.size || 0,
                uploadedAt: file?.uploadedAt || '',
                sha256: file?.sha256 || file?.hash || '',
                dataUrl: file?.dataUrl || ''
            });
        });
        return rows;
    }
    const rows = [
        ...(bid.documents || []).map(document => ({ section: 'Submitted documents', label: document, value: 'Submitted', file: document, upload: true })),
        ...(bid.preliminaryChecks || []).map(item => ({ section: 'Preliminary checks', label: item.requirement, value: `${item.result || ''}${item.comment ? ` - ${item.comment}` : ''}` })),
        ...(bid.eligibilityChecks || []).map(item => ({ section: 'Eligibility checks', label: item.requirement, value: `${item.result || ''}${item.comment ? ` - ${item.comment}` : ''}` }))
    ];
    if (bid.technicalComment) rows.push({ section: 'Technical response', label: 'Technical comment', value: bid.technicalComment });
    if (bid.financial) {
        rows.push({ section: 'Financial offer', label: 'Corrected price', value: formatEvaluationMoney(bid.financial.correctedPrice || bid.price, bid.financial.currency || 'TZS') });
        rows.push({ section: 'Financial offer', label: 'Pricing status', value: bid.financial.pricingStatus || bid.financial.boqStatus || 'Provided' });
    }
    return rows;
}

function getEvaluationEvidenceMatchTokens(value = '') {
    const stopWords = new Set([
        'and', 'for', 'the', 'with', 'from', 'this', 'that', 'submitted', 'submit',
        'upload', 'uploaded', 'document', 'documents', 'evidence', 'supporting',
        'required', 'requirement', 'requirements', 'administrative', 'eligibility'
    ]);
    return String(value || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 2 && !stopWords.has(token));
}

function findEvaluationEvidenceForRequirement(rows = [], requirement = {}, options = {}) {
    const haystackRows = rows.map(row => ({
        ...row,
        text: `${row.section || ''} ${row.label || ''} ${row.value || ''} ${row.fileKey || ''}`.toLowerCase()
    }));
    const tokens = getEvaluationEvidenceMatchTokens((requirement.labels || [requirement.title]).join(' '));
    const limit = options.limit || 3;
    if (!tokens.length) return options.strict ? [] : haystackRows.slice(0, 2);
    const minimumMatches = options.strict
        ? (tokens.length === 1 ? 1 : Math.min(tokens.length, 2))
        : 1;
    const matches = haystackRows
        .map(row => ({
            row,
            score: tokens.reduce((sum, token) => sum + (row.text.includes(token) ? 1 : 0), 0)
        }))
        .filter(item => item.score >= minimumMatches)
        .sort((a, b) => b.score - a.score)
        .map(item => item.row);
    if (matches.length) return matches.slice(0, limit);
    return options.strict ? [] : haystackRows.slice(0, 2);
}

function getEvaluationFinancialDocumentRows(tender = {}, bid = {}, bidderIndex = 0) {
    const financialPattern = /bank statement|bank statements|audited financial|financial statement|financial statements|bank letter|credit facility|credit line|financial capacity|cash flow|cashflow|turnover|liquidity|working capital|financial offer|financial proposal|boq|priced schedule|price schedule|quantity schedule/i;
    const rows = getEvaluationBidEvidenceRows(tender, bid, bidderIndex)
        .filter(row => financialPattern.test(`${row.section || ''} ${row.label || ''} ${row.value || ''} ${row.fileKey || ''} ${getEvaluationEvidenceDocumentName(row)}`))
        .map((row, index) => ({
            ...row,
            financialDocumentId: `financial-doc-${slugEvaluationId(row.fileKey || row.sourceId || row.label || getEvaluationEvidenceDocumentName(row) || index)}-${index + 1}`,
            upload: row.upload || row.file || isEvaluationDocumentEvidence(row) || financialPattern.test(`${row.label || ''} ${row.value || ''}`)
        }));
    return rows;
}

function renderEvaluationFinancialDocumentReview(tender = {}, bid = {}, bidderIndex = 0, options = {}) {
    const rows = getEvaluationFinancialDocumentRows(tender, bid, bidderIndex);
    const savedDocuments = options.savedDocuments || {};
    const scope = options.scope || 'evaluation';
    const owner = options.owner || bid.supplier || `Supplier ${bidderIndex + 1}`;
    return `
        <section class="evaluation-section-workspace financial-document-review">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Financial Documents Review</span>
                    <h3>Financial evidence</h3>
                    <p>View uploaded audited accounts, financial statements, bank letters, credit facility evidence, and financial capacity documents before recording the buyer decision.</p>
                </div>
                ${renderEvaluationStatusBadge(`${rows.length} document${rows.length === 1 ? '' : 's'}`)}
            </div>
            <div class="evaluation-table-scroll">
                <table class="goods-evaluation-table financial-document-review-table">
                    <thead><tr><th>Document / evidence</th><th>Submitted detail</th><th>Actions</th><th>Buyer decision</th><th>Remark</th></tr></thead>
                    <tbody>
                        ${rows.length ? rows.map(row => {
                            const documentId = row.financialDocumentId;
                            const saved = savedDocuments[documentId] || {};
                            const actionRow = isEvaluationDocumentEvidence(row) ? row : {
                                ...row,
                                upload: true,
                                fileName: getEvaluationEvidenceDocumentName(row),
                                value: row.value || row.label || 'Financial evidence submitted'
                            };
                            return `
                                <tr data-financial-document-review-row data-financial-document-scope="${escapeEvaluationHtml(scope)}" data-owner="${escapeEvaluationHtml(owner)}" data-document-id="${escapeEvaluationHtml(documentId)}">
                                    <td><strong>${escapeEvaluationHtml(getEvaluationEvidenceDocumentName(row))}</strong><span>${escapeEvaluationHtml(row.section || 'Submitted financial evidence')}</span></td>
                                    <td>${escapeEvaluationHtml(row.label || 'Financial document')}: ${escapeEvaluationHtml(row.value || 'Provided')}</td>
                                    <td>${renderEvaluationEvidenceDocumentActions(actionRow)}</td>
                                    <td><select class="form-input" data-financial-document-decision>${['', 'Accepted', 'Rejected', 'Clarification Required', 'Not Applicable'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-financial-document-remark value="${escapeEvaluationHtml(saved.remark || '')}" placeholder="Buyer remark"></td>
                                </tr>
                            `;
                        }).join('') : '<tr><td colspan="5">No uploaded financial evidence was found in this bid package.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderEvaluationFinancialDocumentReportSection(tender = {}, bids = [], options = {}) {
    const title = options.title || 'Financial Documents Reviewed';
    const getOwner = options.getOwner || ((bid, index) => bid.supplier || `Supplier ${index + 1}`);
    const getSavedDocuments = options.getSavedDocuments || (() => ({}));
    const rows = bids.flatMap((bid, index) => {
        const owner = getOwner(bid, index);
        const savedDocuments = getSavedDocuments(owner) || {};
        return getEvaluationFinancialDocumentRows(tender, bid, index).map(row => {
            const documentId = row.financialDocumentId;
            const saved = savedDocuments[documentId] || {};
            return { owner, row, saved };
        });
    });
    return `
        <section>
            <h2>${escapeEvaluationHtml(title)}</h2>
            <div class="evaluation-table-scroll">
                <table>
                    <thead><tr><th>Supplier</th><th>Document / evidence</th><th>Submitted detail</th><th>Buyer decision</th><th>Remark</th></tr></thead>
                    <tbody>
                        ${rows.length ? rows.map(item => `<tr><td>${escapeEvaluationHtml(item.owner)}</td><td>${escapeEvaluationHtml(getEvaluationEvidenceDocumentName(item.row))}</td><td>${escapeEvaluationHtml(item.row.label || 'Financial document')}: ${escapeEvaluationHtml(item.row.value || 'Provided')}</td><td>${escapeEvaluationHtml(item.saved.decision || 'Pending')}</td><td>${escapeEvaluationHtml(item.saved.remark || '-')}</td></tr>`).join('') : '<tr><td colspan="5">No submitted financial documents were found in the reviewed bid packages.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function collectEvaluationFinancialDocumentReviews(scope = '') {
    const records = {};
    document.querySelectorAll(`[data-financial-document-review-row][data-financial-document-scope="${scope}"]`).forEach(row => {
        const owner = row.getAttribute('data-owner') || '';
        const documentId = row.getAttribute('data-document-id') || '';
        if (!owner || !documentId) return;
        records[owner] = { ...(records[owner] || {}) };
        records[owner][documentId] = {
            decision: row.querySelector('[data-financial-document-decision]')?.value || '',
            remark: row.querySelector('[data-financial-document-remark]')?.value || '',
            updatedAt: new Date().toISOString()
        };
    });
    return records;
}

function renderEvaluationSubmittedBidReportActions(tender = {}, bid = {}, bidderIndex = 0) {
    const reference = tender.reference || tender.id || '';
    const supplier = bid.supplier || `Supplier ${bidderIndex + 1}`;
    return `
        <div class="inline-actions evaluation-bid-report-actions">
            <button class="btn btn-secondary" type="button" data-evaluation-bid-report-action="view" data-evaluation-bid-report-reference="${escapeEvaluationHtml(reference)}" data-evaluation-bid-report-index="${bidderIndex}">View Submitted Bid Report</button>
            <button class="btn btn-secondary" type="button" data-evaluation-bid-report-action="download" data-evaluation-bid-report-reference="${escapeEvaluationHtml(reference)}" data-evaluation-bid-report-index="${bidderIndex}">Download Submitted Bid Report</button>
            <span class="section-kicker">${escapeEvaluationHtml(supplier)}</span>
        </div>
    `;
}

function buildEvaluationSubmittedBidReportHtml(tender = {}, bid = {}, bidderIndex = 0) {
    const rows = getEvaluationBidEvidenceRows(tender, bid, bidderIndex);
    const supplier = bid.supplier || `Supplier ${bidderIndex + 1}`;
    const documents = bid.documents?.length ? bid.documents : rows.filter(isEvaluationDocumentEvidence).map(getEvaluationEvidenceDocumentName);
    const amount = bid.financial?.correctedPrice || bid.price || bid.draft?.total || '';
    const currency = bid.financial?.currency || 'TZS';
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeEvaluationHtml(supplier)} Submitted Bid Report</title>
    <style>
        body { margin: 0; background: #f8fafc; color: #111827; font-family: Arial, sans-serif; }
        main { max-width: 960px; margin: 28px auto; padding: 28px; background: #fff; border: 1px solid #dbe3ee; }
        h1, h2 { margin: 0 0 10px; }
        h1 { font-size: 26px; }
        h2 { margin-top: 26px; font-size: 18px; }
        p { color: #4b5563; }
        .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
        .summary div { border: 1px solid #e5e7eb; padding: 12px; }
        .summary span { display: block; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .summary strong { display: block; margin-top: 4px; font-size: 15px; overflow-wrap: anywhere; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #e5e7eb; padding: 9px; text-align: left; vertical-align: top; font-size: 13px; }
        th { background: #f3f4f6; }
    </style>
</head>
<body>
    <main>
        <h1>Submitted Bid Report</h1>
        <p>${escapeEvaluationHtml(tender.title || 'Tender evaluation')} / ${escapeEvaluationHtml(tender.reference || tender.id || '-')}</p>
        <section class="summary">
            <div><span>Supplier</span><strong>${escapeEvaluationHtml(supplier)}</strong></div>
            <div><span>Submission time</span><strong>${escapeEvaluationHtml(bid.submissionTime || bid.submittedBid?.submittedAt || '-')}</strong></div>
            <div><span>Receipt / hash</span><strong>${escapeEvaluationHtml(bid.integrityHash || bid.submittedBid?.receiptHash || '-')}</strong></div>
            <div><span>Financial offer</span><strong>${amount ? formatEvaluationMoney(amount, currency) : '-'}</strong></div>
            <div><span>Registration number</span><strong>${escapeEvaluationHtml(bid.registrationNumber || '-')}</strong></div>
            <div><span>Contact person</span><strong>${escapeEvaluationHtml(bid.contactPerson || '-')}</strong></div>
        </section>
        <section>
            <h2>Submitted Documents</h2>
            <p>${documents.length ? documents.map(escapeEvaluationHtml).join('; ') : 'No submitted document names were captured.'}</p>
        </section>
        <section>
            <h2>Bid Package Evidence</h2>
            <table>
                <thead><tr><th>Section</th><th>Label</th><th>Submitted value</th><th>Document</th></tr></thead>
                <tbody>
                    ${rows.length ? rows.map(row => `<tr><td>${escapeEvaluationHtml(row.section || '-')}</td><td>${escapeEvaluationHtml(row.label || '-')}</td><td>${escapeEvaluationHtml(row.value || '-')}</td><td>${escapeEvaluationHtml(isEvaluationDocumentEvidence(row) ? getEvaluationEvidenceDocumentName(row) : '-')}</td></tr>`).join('') : '<tr><td colspan="4">No bid package evidence rows were captured for this supplier.</td></tr>'}
                </tbody>
            </table>
        </section>
    </main>
</body>
</html>`;
}

function openEvaluationSubmittedBidReport(reference = '', bidderIndex = 0) {
    const tender = getEvaluationTenderModel(reference);
    const bids = getEvaluationBidsForTender(tender);
    const bid = bids[bidderIndex] || bids[0] || {};
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        alert('Allow pop-ups to view the submitted bid report.');
        return;
    }
    reportWindow.document.open();
    reportWindow.document.write(buildEvaluationSubmittedBidReportHtml(tender, bid, bidderIndex));
    reportWindow.document.close();
}

function downloadEvaluationSubmittedBidReport(reference = '', bidderIndex = 0) {
    const tender = getEvaluationTenderModel(reference);
    const bids = getEvaluationBidsForTender(tender);
    const bid = bids[bidderIndex] || bids[0] || {};
    const supplier = bid.supplier || `Supplier ${Number(bidderIndex || 0) + 1}`;
    downloadEvaluationDocumentContent(
        buildEvaluationSubmittedBidReportHtml(tender, bid, bidderIndex),
        getEvaluationSafeFilename(`${reference}-${supplier}-submitted-bid-report`, '.html')
    );
}

function getEvaluationSupplierDraft(draft = {}, supplier = '') {
    if (!draft || typeof draft !== 'object') return {};
    return draft.requirements?.[supplier] || {};
}

function getEvaluationProgress(reference = '', tender = null) {
    const draft = getEvaluationDraft(reference) || {};
    if (draft?.status === 'Completed') return 100;
    if (!tender || !reference) return Number(draft?.progress || 0);
    const bids = getEvaluationBidsForTender({ ...tender, ready: true, reference });
    const profileId = getEvaluationProfileId(tender);
    if (profileId === 'goods') return getGoodsEvaluationCompletion(tender, bids, draft).percent;
    if (profileId === 'works') return getWorksEvaluationCompletion(tender, bids, draft).percent;
    if (profileId === 'services') return getServiceEvaluationCompletion(tender, bids, draft).percent;
    if (profileId === 'consultancy') return getConsultancyCompletion(tender, bids, draft).percent;
    const sections = getEvaluationReviewSections(tender);
    const rows = sections.flatMap(section => section.id === 'supplier-info' ? [] : section.items);
    const total = rows.length * Math.max(1, bids.length || 1);
    if (!total) return 0;
    const complete = bids.reduce((sum, bid) => {
        const supplierRows = getEvaluationSupplierDraft(draft, bid.supplier || '');
        return sum + rows.filter(row => isEvaluationRequirementComplete(supplierRows[row.id], row)).length;
    }, 0);
    return Math.round((complete / total) * 100);
}

function isEvaluationRequirementComplete(value = {}, requirement = {}) {
    if (!value || !value.decision) return false;
    if (requirement.maxScore && (value.score === undefined || value.score === null || String(value.score).trim() === '')) return false;
    if (/not eligible|clarification/i.test(value.decision) && !String(value.comment || '').trim()) return false;
    return true;
}

function getEvaluationCompletion(tender = {}, bids = [], draft = {}) {
    const rows = getEvaluationReviewSections(tender).flatMap(section => section.id === 'supplier-info' ? [] : section.items);
    const total = rows.length * bids.length;
    const complete = bids.reduce((sum, bid) => {
        const supplierRows = getEvaluationSupplierDraft(draft, bid.supplier || '');
        return sum + rows.filter(row => isEvaluationRequirementComplete(supplierRows[row.id], row)).length;
    }, 0);
    return { complete, total, percent: total ? Math.round((complete / total) * 100) : 0, canComplete: total > 0 && complete >= total };
}

function getEvaluationDraftReferences() {
    const references = new Set();
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) || '';
            if (key.startsWith('procurex.evaluationDraft.')) {
                references.add(key.replace('procurex.evaluationDraft.', ''));
            }
        }
    } catch (error) {
        if (typeof window !== 'undefined') {
            Object.keys(window.procurexEvaluationDrafts || {}).forEach(reference => references.add(reference));
        }
    }
    if (typeof window !== 'undefined') {
        Object.keys(window.procurexEvaluationDrafts || {}).forEach(reference => references.add(reference));
    }
    return Array.from(references).filter(Boolean);
}

function getEvaluationDraftStageLabel(tender = {}, draft = {}) {
    const profileId = getEvaluationProfileId(tender);
    if (profileId === 'goods') {
        const stages = getGoodsEvaluationStages();
        const stageId = draft.goods?.currentStageId || 'opening';
        return (stages.find(stage => stage.id === stageId) || stages[0])?.label || 'Opening Register';
    }
    if (profileId === 'works') {
        const stages = getWorksEvaluationStages();
        const stageId = draft.works?.currentStageId || 'opening';
        return (stages.find(stage => stage.id === stageId) || stages[0])?.label || 'Opening Register';
    }
    if (profileId === 'services') {
        const stages = getServiceEvaluationStages();
        const stageId = draft.services?.currentStageId || 'opening';
        return (stages.find(stage => stage.id === stageId) || stages[0])?.label || 'Opening Register';
    }
    if (profileId === 'consultancy') {
        const stages = getConsultancyEvaluationStages();
        const stageId = draft.consultancy?.currentStageId || 'opening';
        return (stages.find(stage => stage.id === stageId) || stages[0])?.label || 'Opening Register';
    }
    const sections = getEvaluationReviewSections(tender);
    const sectionId = draft.currentSectionId || sections[0]?.id || 'supplier-info';
    return (sections.find(section => section.id === sectionId) || sections[0])?.label || 'Supplier Information';
}

function getEvaluationDraftTenderRows() {
    return getEvaluationDraftReferences()
        .map(reference => {
            const draft = getEvaluationDraft(reference);
            if (!draft || draft.status === 'Completed') return null;
            const tender = getEvaluationTenderModel(reference);
            return {
                reference,
                tender,
                draft,
                progress: getEvaluationProgress(reference, tender),
                stageLabel: getEvaluationDraftStageLabel(tender, draft),
                savedAt: draft.savedAt || ''
            };
        })
        .filter(Boolean)
        .sort((a, b) => Date.parse(b.savedAt || 0) - Date.parse(a.savedAt || 0));
}

function getEvaluationRecommendedBid(tender = {}, bids = []) {
    const seeded = mockData.bidEvaluation?.recommendation?.supplier;
    return bids.find(bid => bid.supplier === seeded)
        || [...bids].sort((a, b) => Number(a.financial?.correctedPrice || a.price || Infinity) - Number(b.financial?.correctedPrice || b.price || Infinity))[0]
        || {};
}

function renderEvaluationShell(content, title = 'Evaluation', subtitle = '') {
    const oversightNotice = isEvaluationAdminOversightSession() ? `
        <section class="evaluation-notice warning">
            System Admin oversight mode: this page is read-only for procurement rule checks. Buyer users enter scores, percentages, rankings, recommendations, and complete the evaluation.
        </section>
    ` : '';
    return `
        <div class="main-layout procurement-layout evaluation-app-layout">
            <aside class="sidebar evaluation-sidebar">
                <div class="evaluation-sidebar-head">
                    <h3>${escapeEvaluationHtml(title)}</h3>
                    <span>${escapeEvaluationHtml(subtitle || 'Tender evaluation')}</span>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
                    <li><a href="#" data-navigate="bid-evaluation" class="active">Evaluation</a></li>
                    <li><a href="#" data-navigate="award-recommendation">Award Recommendation</a></li>
                    <li><a href="#" data-evaluation-clear-selection>Select Tender</a></li>
                    <li><a href="#" data-navigate="sign-in">Logout</a></li>
                </ul>
            </aside>
            <main class="main-content procurement-content evaluation-workspace">
                ${oversightNotice}
                ${content}
            </main>
        </div>
    `;
}

function renderEvaluationTenderList() {
    const tenders = getEvaluationTenderList();
    const draftRows = getEvaluationDraftTenderRows();
    const readyCount = tenders.filter(tender => tender.ready).length;
    const lockedCount = tenders.length - readyCount;

    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel evaluation-selection-hero">
            <div>
                <span class="section-kicker">Evaluation app</span>
                <h1>Tenders for Evaluation</h1>
                <p>Open a published tender after closing to evaluate supplier bids one supplier at a time against the exact requirements and criteria used when the tender was created.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${tenders.length}</strong><span>Published tenders</span></div>
                <div><strong>${readyCount}</strong><span>Ready to evaluate</span></div>
                <div><strong>${draftRows.length}</strong><span>Drafted evaluations</span></div>
                <div><strong>${lockedCount}</strong><span>Locked until closing</span></div>
            </div>
        </section>

        <section class="procurement-panel evaluation-panel records-filter-panel" data-evaluation-tender-filter-panel>
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Evaluation records search</span>
                    <h2>Find tender evaluations</h2>
                </div>
                ${renderEvaluationStatusBadge(`${tenders.length + draftRows.length} records`)}
            </div>
            <div class="records-filter-grid">
                <input class="form-input" type="search" data-evaluation-list-search placeholder="Search tender, buyer, reference, procurement type">
                <select class="form-input" data-evaluation-list-status>
                    <option value="">All evaluation statuses</option>
                    <option value="ready">Ready</option>
                    <option value="locked">Locked</option>
                    <option value="draft">Draft</option>
                </select>
                <select class="form-input" data-evaluation-list-type>
                    <option value="">All procurement types</option>
                    ${[...new Set(tenders.map(tender => getEvaluationProfile(tender).id).filter(Boolean))].sort().map(type => `<option value="${escapeEvaluationHtml(type)}">${escapeEvaluationHtml(type)}</option>`).join('')}
                </select>
            </div>
        </section>

        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Drafted in evaluation</span>
                    <h2>Continue a saved evaluation draft</h2>
                </div>
                ${renderEvaluationStatusBadge(`${draftRows.length} draft${draftRows.length === 1 ? '' : 's'}`)}
            </div>
            <div class="evaluation-tender-list">
                ${draftRows.length ? draftRows.map(item => renderEvaluationDraftTenderRow(item)).join('') : '<div class="scope-empty">No saved evaluation drafts yet. Save an evaluation draft and it will appear here for continuation.</div>'}
            </div>
        </section>

        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Published tenders</span>
                    <h2>Select the tender to evaluate</h2>
                </div>
                ${renderEvaluationStatusBadge(`${readyCount} ready`)}
            </div>
            <div class="evaluation-tender-list">
                ${tenders.map(tender => renderEvaluationTenderRow(tender)).join('')}
            </div>
        </section>
    `, 'Bid Evaluation', 'Tender list');
}

function renderEvaluationDraftTenderRow(item = {}) {
    const tender = item.tender || {};
    const draft = item.draft || {};
    const profile = getEvaluationProfile(tender);
    const savedAt = item.savedAt ? new Date(item.savedAt).toLocaleString() : 'Not recorded';
    const supplierIndex = Number(draft.currentSupplierIndex || draft.goods?.currentSupplierIndex || draft.works?.currentSupplierIndex || draft.services?.currentSupplierIndex || draft.consultancy?.currentSupplierIndex || 0) + 1;
    return `
        <article class="evaluation-tender-row is-ready is-draft" data-evaluation-tender-row data-evaluation-status="draft" data-evaluation-type="${escapeEvaluationHtml(profile.id)}" data-search="${escapeEvaluationHtml([profile.id, tender.title, tender.reference, tender.organization, item.stageLabel, draft.status].filter(Boolean).join(' ').toLowerCase())}">
            <div class="evaluation-tender-row-main">
                <span class="section-kicker">${escapeEvaluationHtml(profile.id)} evaluation draft</span>
                <h3>${escapeEvaluationHtml(tender.title)}</h3>
                <p>${escapeEvaluationHtml(tender.reference)} / Last saved ${escapeEvaluationHtml(savedAt)}</p>
            </div>
            <div class="evaluation-tender-row-meta">
                <div><span>Resume at</span><strong>${escapeEvaluationHtml(item.stageLabel || 'Evaluation')}</strong></div>
                <div><span>Supplier position</span><strong>${escapeEvaluationHtml(String(supplierIndex))}</strong></div>
                <div><span>Status</span><strong>${escapeEvaluationHtml(draft.status || 'Saved as draft')}</strong></div>
                <div><span>Progress</span><strong>${escapeEvaluationHtml(item.progress || 0)}%</strong></div>
            </div>
            <div class="evaluation-tender-row-status">
                ${renderEvaluationStatusBadge('Draft in evaluation')}
                ${renderEvaluationStatusBadge(item.stageLabel || 'Saved stage')}
                <div class="evaluation-progress-track"><span style="width: ${Math.min(100, Math.max(0, Number(item.progress || 0)))}%"></span></div>
            </div>
            <div class="evaluation-tender-row-actions">
                <button class="btn btn-secondary" type="button" data-select-tender="${escapeEvaluationHtml(tender.reference)}" data-navigate="tender-details">View Tender</button>
                <button class="btn btn-primary" type="button" data-evaluation-select="${escapeEvaluationHtml(tender.reference)}">Continue Draft</button>
            </div>
        </article>
    `;
}

function renderEvaluationTenderRow(tender = {}) {
    const profile = getEvaluationProfile(tender);
    const criteriaCount = getEvaluationCriteriaForTender(tender).length;
    const requirementCount = getEvaluationTenderRequirementCount(tender);
    const progress = getEvaluationProgress(tender.reference, tender);
    const lockedText = tender.ready ? 'Evaluation open' : 'Evaluation opens after tender closing';
    return `
        <article class="evaluation-tender-row ${tender.ready ? 'is-ready' : 'is-locked'}" data-evaluation-tender-row data-evaluation-status="${tender.ready ? 'ready' : 'locked'}" data-evaluation-type="${escapeEvaluationHtml(profile.id)}" data-search="${escapeEvaluationHtml([profile.id, tender.title, tender.reference, tender.type, tender.organization, tender.status, lockedText].filter(Boolean).join(' ').toLowerCase())}">
            <div class="evaluation-tender-row-main">
                <span class="section-kicker">${escapeEvaluationHtml(profile.id)} procurement</span>
                <h3>${escapeEvaluationHtml(tender.title)}</h3>
                <p>${escapeEvaluationHtml(tender.reference)} / ${escapeEvaluationHtml(tender.type || profile.id)} / ${escapeEvaluationHtml(tender.organization || 'Buyer tender')}</p>
            </div>
            <div class="evaluation-tender-row-meta">
                <div><span>Closing date</span><strong>${escapeEvaluationHtml(tender.closingDate || '-')}</strong></div>
                <div><span>Requirements</span><strong>${requirementCount}</strong></div>
                <div><span>Criteria</span><strong>${criteriaCount}</strong></div>
                <div><span>Progress</span><strong>${progress}%</strong></div>
            </div>
            <div class="evaluation-tender-row-status">
                ${renderEvaluationStatusBadge(tender.status || 'Published')}
                ${renderEvaluationStatusBadge(lockedText)}
                <div class="evaluation-progress-track"><span style="width: ${Math.min(100, Math.max(0, progress))}%"></span></div>
            </div>
            <div class="evaluation-tender-row-actions">
                <button class="btn btn-secondary" type="button" data-select-tender="${escapeEvaluationHtml(tender.reference)}" data-navigate="tender-details">View Tender</button>
                <button class="btn btn-primary" type="button" data-evaluation-select="${escapeEvaluationHtml(tender.reference)}" ${tender.ready ? '' : 'disabled'}>${tender.ready ? 'Start Evaluation' : 'Locked'}</button>
            </div>
        </article>
    `;
}

function renderEvaluationLockedTender(reference = '') {
    const tender = getEvaluationTenderModel(reference);
    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Evaluation locked</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Evaluation opens after tender closing. Bidder names, bid counts, supplier cards, and bid evidence remain hidden until the tender reaches the allowed evaluation stage.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(tender.closingDate || '-')}</strong><span>Closing date</span></div>
                <div><strong>${escapeEvaluationHtml(tender.type || '-')}</strong><span>Procurement type</span></div>
                <div><strong>${getEvaluationTenderRequirementCount(tender)}</strong><span>Configured checks</span></div>
                <div><strong>Hidden</strong><span>Bidder evidence</span></div>
            </div>
        </section>
        <section class="procurement-panel evaluation-panel">
            <div class="evaluation-locked-panel">
                <div>
                    <span class="section-kicker">Lifecycle control</span>
                    <h2>Evaluation opens after tender closing</h2>
                    <p>This protects fairness by preventing the buyer from seeing supplier identities or bid evidence before the closing date or opening/evaluation workflow status.</p>
                </div>
                <button class="btn btn-secondary" type="button" data-evaluation-clear-selection>Back to Tender List</button>
            </div>
        </section>
    `, 'Bid Evaluation', tender.reference);
}

function renderEvaluationSupplierInfo(tender = {}, bid = {}, bidderIndex = 0) {
    const submitted = getEvaluationSubmittedBidForSupplier(tender.sourceTender || tender, bid, bidderIndex);
    const amount = bid.financial?.correctedPrice || bid.price || submitted?.draft?.total || '';
    return `
        <section class="evaluation-supplier-profile">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Supplier information first</span>
                    <h2>${escapeEvaluationHtml(bid.supplier || 'Supplier')}</h2>
                </div>
                ${renderEvaluationStatusBadge(bid.finalResult || bid.preliminaryResult || 'Under review')}
            </div>
            <div class="evaluation-supplier-info-grid">
                <article><span>Registration</span><strong>${escapeEvaluationHtml(bid.registrationNumber || '-')}</strong></article>
                <article><span>Contact person</span><strong>${escapeEvaluationHtml(bid.contactPerson || '-')}</strong></article>
                <article><span>Submitted</span><strong>${escapeEvaluationHtml(submitted?.submittedAt ? new Date(submitted.submittedAt).toLocaleString() : bid.submissionTime || '-')}</strong></article>
                <article><span>Receipt / hash</span><strong>${escapeEvaluationHtml(submitted?.receiptHash || bid.integrityHash || '-')}</strong></article>
                <article><span>Offer value</span><strong>${typeof amount === 'number' ? formatEvaluationMoney(amount, bid.financial?.currency || 'TZS') : escapeEvaluationHtml(amount || '-')}</strong></article>
                <article><span>Documents</span><strong>${escapeEvaluationHtml((bid.documents || []).length || submitted?.fileManifest?.length || 0)}</strong></article>
            </div>
        </section>
    `;
}

function renderEvaluationSectionRail(sections = [], activeSectionId = '') {
    return `
        <nav class="evaluation-section-rail" aria-label="Evaluation sections">
            ${sections.map((section, index) => `
                <button class="evaluation-section-button ${section.id === activeSectionId ? 'active' : ''}" type="button" data-evaluation-section="${escapeEvaluationHtml(section.id)}">
                    <strong>${String(index + 1).padStart(2, '0')}</strong>
                    <span>${escapeEvaluationHtml(section.label)}</span>
                </button>
            `).join('')}
        </nav>
    `;
}

function renderEvaluationRequirementRow(tender = {}, bid = {}, bidderIndex = 0, requirement = {}, saved = {}) {
    const documentReview = /eligibility|document|administrative|license|certificate|registration|tax|form/.test(`${requirement.sectionId || ''} ${requirement.category || ''} ${requirement.title || ''}`.toLowerCase());
    const evidenceRows = findEvaluationEvidenceForRequirement(
        getEvaluationBidEvidenceRows(tender, bid, bidderIndex),
        requirement,
        documentReview ? { strict: true, limit: 1 } : {}
    );
    const decision = saved.decision || '';
    const score = saved.score ?? '';
    const comment = saved.comment || '';
    const commentRequired = /not eligible|clarification/i.test(decision);
    return `
        <article class="evaluation-requirement-row" data-evaluation-row data-supplier="${escapeEvaluationHtml(bid.supplier || '')}" data-requirement-id="${escapeEvaluationHtml(requirement.id)}" data-section-id="${escapeEvaluationHtml(requirement.sectionId)}">
            <div class="evaluation-requirement-main">
                <span class="section-kicker">${escapeEvaluationHtml(requirement.category)}</span>
                <h3>${escapeEvaluationHtml(requirement.title)}</h3>
                <p>${escapeEvaluationHtml(requirement.description || requirement.evidenceHint || 'Review this response against the tender requirement.')}</p>
                <small>Source: ${escapeEvaluationHtml(requirement.source)}${requirement.mandatory ? ' / Mandatory' : ' / Optional'}</small>
            </div>
            <div class="evaluation-evidence-panel">
                <strong>Supplier response and evidence</strong>
                ${evidenceRows.length ? evidenceRows.map(row => `
                    <article class="evaluation-evidence-item">
                        <span>${escapeEvaluationHtml(row.section || 'Evidence')}</span>
                        <p>${escapeEvaluationHtml(row.label || '')}: ${escapeEvaluationHtml(row.value || row.file || 'Provided')}</p>
                        ${renderEvaluationEvidenceDocumentActions(row)}
                    </article>
                `).join('') : `<p>${documentReview ? 'No specific submitted document was found for this requirement. Record a clarification or not eligible decision if this item is mandatory.' : 'No matching evidence found in the available bid package. Record a clarification or not eligible decision if this item is mandatory.'}</p>`}
            </div>
            <div class="evaluation-decision-panel">
                <label>Decision
                    <select class="form-input" data-evaluation-decision>
                        <option value="">Select decision</option>
                        <option value="Eligible" ${decision === 'Eligible' ? 'selected' : ''}>Eligible</option>
                        <option value="Not eligible" ${decision === 'Not eligible' ? 'selected' : ''}>Not eligible</option>
                        <option value="Clarification required" ${decision === 'Clarification required' ? 'selected' : ''}>Clarification required</option>
                    </select>
                </label>
                ${requirement.maxScore ? `
                    <label>Score / ${escapeEvaluationHtml(requirement.maxScore)}
                        <input class="form-input" type="number" min="0" max="${escapeEvaluationHtml(requirement.maxScore)}" step="0.5" value="${escapeEvaluationHtml(score)}" data-evaluation-score>
                    </label>
                ` : ''}
                <label class="wide">Buyer comment ${commentRequired ? '<span>Required</span>' : ''}
                    <textarea class="form-input" rows="3" data-evaluation-comment placeholder="Record reason, evidence note, or clarification needed.">${escapeEvaluationHtml(comment)}</textarea>
                </label>
                ${commentRequired && !comment ? '<p class="evaluation-field-alert">A comment is required for this decision.</p>' : ''}
            </div>
        </article>
    `;
}

function renderEvaluationEvidenceSearchPanel(tender = {}, bid = {}, bidderIndex = 0) {
    const rows = getEvaluationBidEvidenceRows(tender, bid, bidderIndex);
    if (!rows.length) return '';
    return `
        <section class="evaluation-evidence-search" data-evaluation-evidence-search-root>
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Submitted evidence</span>
                    <h3>Search this supplier package</h3>
                </div>
                <span class="badge badge-info" data-evaluation-evidence-count>${rows.length} evidence row${rows.length === 1 ? '' : 's'}</span>
            </div>
            <div class="records-filter-grid">
                <input class="form-input" type="search" data-evaluation-evidence-search placeholder="Search file, section, response, requirement">
                <select class="form-input" data-evaluation-evidence-section>
                    <option value="">All sections</option>
                    ${[...new Set(rows.map(row => row.section || 'Submitted evidence'))].sort().map(section => `<option>${escapeEvaluationHtml(section)}</option>`).join('')}
                </select>
            </div>
            <div class="evaluation-evidence-search-list">
                ${rows.map(row => `
                    <article class="evaluation-evidence-item" data-evaluation-evidence-row data-section="${escapeEvaluationHtml(row.section || 'Submitted evidence')}" data-search="${escapeEvaluationHtml([row.section, row.label, row.value, row.fileKey, getEvaluationEvidenceDocumentName(row)].filter(Boolean).join(' ').toLowerCase())}">
                        <span>${escapeEvaluationHtml(row.section || 'Submitted evidence')}</span>
                        <p>${escapeEvaluationHtml(row.label || 'Evidence')}: ${escapeEvaluationHtml(row.value || getEvaluationEvidenceDocumentName(row) || 'Provided')}</p>
                        ${renderEvaluationEvidenceDocumentActions(row)}
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function renderEvaluationActiveSection(tender = {}, bid = {}, bidderIndex = 0, section = {}, draft = {}) {
    if (section.id === 'supplier-info') {
        return renderEvaluationSupplierInfo(tender, bid, bidderIndex);
    }
    const supplierRows = getEvaluationSupplierDraft(draft, bid.supplier || '');
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Supplier-by-supplier evaluation</span>
                    <h2>${escapeEvaluationHtml(section.label)}</h2>
                    <p>${escapeEvaluationHtml(section.detail)}</p>
                </div>
                ${renderEvaluationStatusBadge(`${section.items.length} checks`)}
            </div>
            ${renderEvaluationEvidenceSearchPanel(tender, bid, bidderIndex)}
            <div class="evaluation-requirement-list">
                ${section.items.map(item => renderEvaluationRequirementRow(tender, bid, bidderIndex, item, supplierRows[item.id] || {})).join('')}
            </div>
        </section>
    `;
}

function getGoodsEvaluationStages() {
    return [
        { id: 'opening', label: 'Opening Register' },
        { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
        { id: 'criteria', label: 'Custom Evaluation Criteria' },
        { id: 'financial', label: 'Financial Review' },
        { id: 'postqual', label: 'Post-Qualification' },
        { id: 'ranking', label: 'Ranking' },
        { id: 'report', label: 'Evaluation Report' }
    ];
}

function getGoodsEvaluationDraft(draft = {}) {
    return draft.goods && typeof draft.goods === 'object' ? draft.goods : {};
}

function getGoodsEvaluationSupplierKey(bid = {}, index = 0) {
    return bid.supplier || `Supplier ${index + 1}`;
}

function getGoodsEvaluationFinancialAmount(bid = {}) {
    return Number(bid.financial?.correctedPrice || bid.price || 0) || 0;
}

function getGoodsEvaluationCommercialRows(tender = {}) {
    const fields = (tender.sourceTender || tender).requirements?.fields || {};
    return fields.quantityScheduleRows?.length
        ? fields.quantityScheduleRows
        : ((tender.sourceTender || tender).commercialItems || (tender.sourceTender || tender).boqItems || []);
}

function getGoodsEvaluationSampleRows(tender = {}) {
    return (tender.sourceTender || tender).requirements?.fields?.sampleRequirementRows || [];
}

function getGoodsEvaluationAdministrativeItems(tender = {}) {
    const source = tender.sourceTender || tender;
    const requirementSet = getEvaluationRequirementSet(source);
    const licenseItems = (source.regulatoryLicenses || []).map((license, index) => ({
        id: `license-${index}`,
        title: license.license || license.registrationType || license.regulatoryBody || 'Regulatory license',
        mandatory: license.mandatory !== false,
        source: license.body || license.group || 'Regulatory license'
    }));
    const requiredDocs = [
        ...(source.requiredSubmissionDocuments || []),
        ...(source.requirements?.fields?.otherEligibilityRequirements || []).map(item => item.requirementName || item.text || item.name),
        ...(requirementSet.mandatory || [])
            .filter(item => /license|certificate|tax|registration|authorization|eligibility|document|declaration|financial statement|audited/i.test(`${item.title} ${item.category}`))
            .map(item => item.title)
    ].filter(Boolean);
    const docItems = Array.from(new Set(requiredDocs)).map((title, index) => ({
        id: `admin-doc-${slugEvaluationId(title)}-${index}`,
        title,
        mandatory: true,
        source: 'Published tender requirement'
    }));
    return [...licenseItems, ...docItems].length ? [...licenseItems, ...docItems] : [
        { id: 'admin-registration', title: 'Company registration / incorporation', mandatory: true, source: 'Default goods administrative check' },
        { id: 'admin-tax', title: 'Tax clearance certificate', mandatory: true, source: 'Default goods administrative check' },
        { id: 'admin-authorization', title: 'Manufacturer authorization where applicable', mandatory: true, source: 'Default goods administrative check' }
    ];
}

function getGoodsEvaluationPostQualItems(tender = {}) {
    const criteria = getEvaluationCriteriaForTender(tender)
        .filter(criterion => /capability|post|experience|financial capacity|support|authorization|local|stock/i.test(`${criterion.name} ${criterion.category} ${criterion.subcriteria.join(' ')}`));
    if (criteria.length) {
        return criteria.map(criterion => ({
            id: `postqual-${criterion.id}`,
            title: criterion.name,
            source: 'Buyer-defined criterion',
            evidenceRequired: criterion.evidenceRequired || []
        }));
    }
    return [
        { id: 'postqual-deliver', title: 'Supplier can deliver the goods', source: 'Manual post-qualification checklist' },
        { id: 'postqual-documents', title: 'Key documents remain valid', source: 'Manual post-qualification checklist' },
        { id: 'postqual-warranty', title: 'Warranty and after-sales support are realistic', source: 'Manual post-qualification checklist' },
        { id: 'postqual-risk', title: 'No unacceptable supply or authenticity risk', source: 'Manual post-qualification checklist' }
    ];
}

function getGoodsCriterionSaved(goodsDraft = {}, supplier = '', criterionId = '') {
    return goodsDraft.criteriaEvaluation?.[supplier]?.[criterionId] || {};
}

function isGoodsManualDecisionNegative(value = '') {
    return /fail|clarification|required|rejected|non-responsive|not qualified|non-compliant|major deviation/i.test(String(value || ''));
}

function isGoodsCriterionComplete(row = {}, criterion = {}) {
    if (!row.decision) return false;
    if (!/pass_fail|document_check/.test(criterion.evaluationType) && criterion.maxScore > 0 && String(row.score ?? '').trim() === '') return false;
    if (isGoodsManualDecisionNegative(row.decision) && !String(row.comment || '').trim()) return false;
    return true;
}

function isGoodsAdministrativeComplete(row = {}) {
    if (!row.decision) return false;
    if (isGoodsManualDecisionNegative(row.decision) && !String(row.remark || '').trim()) return false;
    return true;
}

function isGoodsRankingDecisionComplete(row = {}) {
    const recommendation = normalizeEvaluationRecommendation(row.recommendation);
    if (!recommendation) return false;
    if (recommendation === 'Rejected' && !String(row.reason || '').trim()) return false;
    return true;
}

function isGoodsFinancialSectionComplete(goodsDraft = {}, supplier = '') {
    const lines = Object.values(goodsDraft.financial?.[supplier] || {});
    return lines.length ? lines.every(line => Boolean(line.check)) : false;
}

function isGoodsPriorSectionsComplete(tender = {}, supplier = '', goodsDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getGoodsEvaluationAdministrativeItems(tender);
    const adminDone = adminItems.every(item => isGoodsAdministrativeComplete(goodsDraft.administrative?.[supplier]?.[item.id] || {}));
    const criteriaDone = criteria.every(criterion => isGoodsCriterionComplete(getGoodsCriterionSaved(goodsDraft, supplier, criterion.id), criterion));
    const financialDone = isGoodsFinancialSectionComplete(goodsDraft, supplier);
    const postDone = Boolean(goodsDraft.postQualification?.[supplier]?.result);
    return adminDone && criteriaDone && financialDone && postDone;
}

function getGoodsEvaluationCompletion(tender = {}, bids = [], draft = {}) {
    const goods = getGoodsEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getGoodsEvaluationAdministrativeItems(tender);
    const total = bids.length * (criteria.length + adminItems.length + 1);
    let hasRecommendation = false;
    const complete = bids.reduce((sum, bid, index) => {
        const supplier = getGoodsEvaluationSupplierKey(bid, index);
        const ranking = goods.ranking?.[supplier] || {};
        if (normalizeEvaluationRecommendation(ranking.recommendation) === 'Recommended for award') hasRecommendation = true;
        const adminDone = adminItems.filter(item => isGoodsAdministrativeComplete(goods.administrative?.[supplier]?.[item.id] || {})).length;
        const criteriaDone = criteria.filter(criterion => isGoodsCriterionComplete(getGoodsCriterionSaved(goods, supplier, criterion.id), criterion)).length;
        return sum + adminDone + criteriaDone + (isGoodsRankingDecisionComplete(ranking) ? 1 : 0);
    }, 0);
    return { total, complete, percent: total ? Math.round((complete / total) * 100) : 0, canComplete: total > 0 && complete >= total && hasRecommendation };
}

function hasGoodsFailedGate(goodsDraft = {}, supplier = '', criteria = []) {
    return criteria.some(criterion => {
        if (!criterion.passFailGate && !criterion.mandatory) return false;
        const row = getGoodsCriterionSaved(goodsDraft, supplier, criterion.id);
        return /fail|rejected|non-responsive/i.test(row.decision || '');
    });
}

function hasGoodsFailedAdministrativeGate(goodsDraft = {}, supplier = '', tender = {}) {
    return getGoodsEvaluationAdministrativeItems(tender).some(item => {
        if (item.mandatory === false) return false;
        const row = goodsDraft.administrative?.[supplier]?.[item.id] || {};
        return /fail|rejected|non-responsive/i.test(row.decision || '');
    });
}

function getGoodsSupplierScore(goodsDraft = {}, supplier = '', criteria = []) {
    return getEvaluationWeightedScore(criteria, criterion => getGoodsCriterionSaved(goodsDraft, supplier, criterion.id));
}

function getGoodsSupplierMaxScore(criteria = []) {
    return getEvaluationWeightedMaxScore(criteria);
}

function getGoodsManualRecommendation(tender = {}, bids = [], draft = {}) {
    const goods = getGoodsEvaluationDraft(draft);
    const recommended = bids.map((bid, index) => {
        const supplier = getGoodsEvaluationSupplierKey(bid, index);
        return { bid, supplier, row: goods.ranking?.[supplier] || {} };
    }).find(item => normalizeEvaluationRecommendation(item.row.recommendation) === 'Recommended for award');
    if (!recommended) return { supplier: '', amount: 0, currency: 'TZS', reason: '' };
    return {
        supplier: recommended.supplier,
        amount: recommended.bid.financial?.correctedPrice || recommended.bid.price || 0,
        currency: recommended.bid.financial?.currency || 'TZS',
        reason: recommended.row.reason || 'Recommended manually by the buyer after completing the goods evaluation record.'
    };
}

function getGoodsCriterionDecisionOptions(criterion = {}) {
    if (criterion.passFailGate || /pass_fail|document_check/.test(criterion.evaluationType)) {
        return ['', 'Pass', 'Fail', 'Clarification Required'];
    }
    if (criterion.evaluationType === 'specification_compliance') {
        return ['', 'Compliant', 'Non-compliant', 'Minor Deviation', 'Major Deviation', 'Clarification Required'];
    }
    if (/sample_based|delivery_based|warranty_support/.test(criterion.evaluationType)) {
        return ['', 'Pass', 'Fail', 'Not Applicable', 'Clarification Required'];
    }
    return ['', 'Accepted', 'Rejected', 'Clarification Required'];
}

function getGoodsEvaluationEvidencePanel(tender = {}, bid = {}, bidderIndex = 0, labels = [], options = {}) {
    const evidence = findEvaluationEvidenceForRequirement(getEvaluationBidEvidenceRows(tender, bid, bidderIndex), { title: labels.join(' '), labels }, options);
    return `
        <aside class="goods-evidence-panel">
            <strong>Supplier Evidence</strong>
            ${evidence.length ? evidence.map(item => `
                <article class="evaluation-evidence-item">
                    <span>${escapeEvaluationHtml(item.section || 'Evidence')}</span>
                    <p>${escapeEvaluationHtml(item.label || '')}: ${escapeEvaluationHtml(item.value || item.file || 'Provided')}</p>
                    ${renderEvaluationEvidenceDocumentActions(item)}
                </article>
            `).join('') : '<p>No matching submitted evidence was found. The buyer must decide manually from the available bid package.</p>'}
        </aside>
    `;
}

function renderGoodsBidderTabs(bids = [], activeIndex = 0) {
    return `
        <div class="goods-bidder-tabs" role="tablist" aria-label="Goods bidders">
            ${bids.map((bid, index) => `
                <button class="goods-bidder-tab ${index === activeIndex ? 'active' : ''}" type="button" data-goods-supplier-index="${index}">
                    <strong>${escapeEvaluationHtml(bid.supplier || `Supplier ${index + 1}`)}</strong>
                    <span>${escapeEvaluationHtml(bid.preliminaryResult || bid.finalResult || 'Under review')}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderGoodsStageRail(stages = [], activeStageId = '') {
    return renderEvaluationStageWorkflow(stages, activeStageId, 'data-goods-stage', 'Goods evaluation stages');
}

function renderGoodsOpeningRegister(tender = {}, bids = [], goodsDraft = {}) {
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Bid opening register</span>
                    <h2>Open submitted goods bids</h2>
                    <p>Record bid opening read-out information. Bid opening does not decide responsiveness.</p>
                </div>
                ${renderEvaluationStatusBadge('Manual buyer record')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="goods-evaluation-table">
                    <thead><tr><th>Supplier</th><th>Submission time</th><th>Receipt no.</th><th>Bid value</th><th>Opening remark</th></tr></thead>
                    <tbody>
                        ${bids.map((bid, index) => {
                            const supplier = getGoodsEvaluationSupplierKey(bid, index);
                            const saved = goodsDraft.opening?.[supplier] || {};
                            return `
                                <tr data-goods-opening-row data-supplier="${escapeEvaluationHtml(supplier)}">
                                    <td>${escapeEvaluationHtml(supplier)}</td>
                                    <td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td>
                                    <td>${escapeEvaluationHtml(bid.integrityHash || bid.submittedBid?.receiptHash || '-')}</td>
                                    <td>${formatEvaluationMoney(getGoodsEvaluationFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td>
                                    <td><input class="form-input" data-goods-opening-remark value="${escapeEvaluationHtml(saved.remark || 'Submitted on time')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderGoodsAdministrativeReview(tender = {}, bid = {}, bidderIndex = 0, goodsDraft = {}) {
    const supplier = getGoodsEvaluationSupplierKey(bid, bidderIndex);
    const items = getGoodsEvaluationAdministrativeItems(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Administrative & Eligibility Evaluation</span>
                    <h2>${escapeEvaluationHtml(supplier)}</h2>
                    <p>Pass/fail review of mandatory eligibility, regulatory, document, and declaration checks.</p>
                </div>
                ${renderEvaluationStatusBadge('Buyer decision required')}
            </div>
            <div class="goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = goodsDraft.administrative?.[supplier]?.[item.id] || {};
                    return `
                        <article class="goods-evaluation-card" data-goods-admin-row data-supplier="${escapeEvaluationHtml(supplier)}" data-admin-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${item.mandatory ? 'Mandatory' : 'Optional'}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                <p>${escapeEvaluationHtml(item.source || 'Published tender requirement')}</p>
                            </div>
                            ${getGoodsEvaluationEvidencePanel(tender, bid, bidderIndex, [item.title], { strict: true, limit: 1 })}
                            <div class="evaluation-decision-panel">
                                <label>Buyer decision
                                    <select class="form-input" data-goods-admin-decision>
                                        ${['', 'Pass', 'Fail', 'Not Applicable', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}
                                    </select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-goods-admin-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderGoodsCriteriaEvaluation(tender = {}, bid = {}, bidderIndex = 0, goodsDraft = {}) {
    const supplier = getGoodsEvaluationSupplierKey(bid, bidderIndex);
    const criteria = getEvaluationCriteriaForTender(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Criteria source: published tender</span>
                    <h2>Custom Evaluation Criteria</h2>
                    <p>These are the exact custom criteria configured for the tender. The system only displays evidence and totals; the buyer records the score or pass/fail decision.</p>
                </div>
                ${renderEvaluationStatusBadge(`${criteria.length} criteria`)}
            </div>
            ${renderEvaluationSubmittedBidReportActions(tender, bid, bidderIndex)}
            <div class="evaluation-notice warning">The system does not create new criteria or decide the winner. Scores and decisions below are manual buyer entries.</div>
            <div class="goods-evaluation-card-list">
                ${criteria.map((criterion, index) => {
                    const saved = getGoodsCriterionSaved(goodsDraft, supplier, criterion.id);
                    const isGate = criterion.passFailGate || /pass_fail|document_check/.test(criterion.evaluationType);
                    const decisionOptions = getGoodsCriterionDecisionOptions(criterion);
                    return `
                        <article class="goods-evaluation-card" data-goods-criterion-row data-supplier="${escapeEvaluationHtml(supplier)}" data-criterion-id="${escapeEvaluationHtml(criterion.id)}" data-criterion-type="${escapeEvaluationHtml(criterion.evaluationType)}">
                            <div>
                                <span class="section-kicker">Criterion ${index + 1} / ${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</span>
                                <h3>${escapeEvaluationHtml(criterion.name)}</h3>
                                <p>${escapeEvaluationHtml(criterion.description || criterion.subcriteria.join(', ') || 'Buyer-defined criterion.')}</p>
                                <div class="goods-criterion-meta">
                                    <span>Weight: ${escapeEvaluationHtml(criterion.weight || 0)}</span>
                                    <span>Max score: ${escapeEvaluationHtml(criterion.maxScore || 0)}</span>
                                    ${criterion.mandatory ? '<span>Mandatory</span>' : ''}
                                    ${criterion.passFailGate ? '<span>Gate</span>' : ''}
                                </div>
                                ${criterion.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(criterion.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getGoodsEvaluationEvidencePanel(tender, bid, bidderIndex, [criterion.name, ...(criterion.subcriteria || []), ...(criterion.evidenceRequired || [])])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer decision
                                    <select class="form-input" data-goods-criterion-decision>
                                        ${decisionOptions.map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}
                                    </select>
                                </label>
                                ${criterion.maxScore > 0 && !isGate ? `
                                    <label>Buyer score / ${escapeEvaluationHtml(criterion.maxScore)}
                                        <input class="form-input" type="number" min="0" max="${escapeEvaluationHtml(criterion.maxScore)}" step="0.5" value="${escapeEvaluationHtml(saved.score ?? '')}" data-goods-criterion-score>
                                    </label>
                                ` : ''}
                                <label class="wide">Buyer comment
                                    <textarea class="form-input" rows="3" data-goods-criterion-comment>${escapeEvaluationHtml(saved.comment || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderGoodsFinancialReview(tender = {}, bid = {}, bidderIndex = 0, goodsDraft = {}) {
    const supplier = getGoodsEvaluationSupplierKey(bid, bidderIndex);
    const rows = getGoodsEvaluationCommercialRows(tender);
    const amount = getGoodsEvaluationFinancialAmount(bid);
    const savedDocuments = goodsDraft.financialDocuments?.[supplier] || {};
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Financial review, not automatic scoring</span>
                    <h2>Quantity schedule and price checks</h2>
                    <p>Review prices, taxes, discounts, missing lines, and arithmetic. Apply score only through custom financial criteria.</p>
                </div>
                ${renderEvaluationStatusBadge(formatEvaluationMoney(amount, bid.financial?.currency || 'TZS'))}
            </div>
            <div class="evaluation-financial-review">
                <div><span>Read-out price</span><strong>${formatEvaluationMoney(bid.price || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Corrected price</span><strong>${formatEvaluationMoney(bid.financial?.correctedPrice || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Discount</span><strong>${escapeEvaluationHtml(bid.financial?.discount || 'None recorded')}</strong></div>
                <div><span>Pricing status</span><strong>${escapeEvaluationHtml(bid.financial?.pricingStatus || bid.financial?.boqStatus || 'Pending buyer review')}</strong></div>
            </div>
            ${renderEvaluationFinancialDocumentReview(tender, bid, bidderIndex, { scope: 'goods', owner: supplier, savedDocuments })}
            <div class="evaluation-table-scroll">
                <table class="goods-evaluation-table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Supplier unit price</th><th>Total</th><th>Buyer check</th><th>Remark</th></tr></thead>
                    <tbody>
                        ${(rows.length ? rows : [{ description: 'Financial offer total', qty: 1, unit: 'Lot', rate: amount }]).map((item, index) => {
                            const saved = goodsDraft.financial?.[supplier]?.[`line-${index}`] || {};
                            const qty = Number(item.quantity || item.qty || 1) || 1;
                            const rate = Number(item.unitPrice || item.rate || item.totalCost || (index === 0 ? amount : 0)) || 0;
                            return `
                                <tr data-goods-financial-row data-supplier="${escapeEvaluationHtml(supplier)}" data-line-id="line-${index}">
                                    <td>${escapeEvaluationHtml(item.itemDescription || item.description || item.workItem || item.item || `Line ${index + 1}`)}</td>
                                    <td>${escapeEvaluationHtml(qty)}</td>
                                    <td>${escapeEvaluationHtml(item.unitOfMeasure || item.unit || 'Unit')}</td>
                                    <td>${formatEvaluationMoney(rate, bid.financial?.currency || 'TZS')}</td>
                                    <td>${formatEvaluationMoney(qty * rate, bid.financial?.currency || 'TZS')}</td>
                                    <td><select class="form-input" data-goods-financial-check>${['', 'Accepted', 'Arithmetic Correction Required', 'Incomplete', 'Clarification Required', 'Abnormally Low Price Review Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.check === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select check')}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-goods-financial-remark value="${escapeEvaluationHtml(saved.remark || '')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderGoodsPostQualification(tender = {}, bid = {}, bidderIndex = 0, goodsDraft = {}) {
    const supplier = getGoodsEvaluationSupplierKey(bid, bidderIndex);
    const items = getGoodsEvaluationPostQualItems(tender);
    const result = goodsDraft.postQualification?.[supplier]?.result || '';
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Supplier capability / post-qualification</span>
                    <h2>${escapeEvaluationHtml(supplier)}</h2>
                    <p>Confirm that the supplier can actually deliver the goods, warranty, support, and documentation accepted during evaluation.</p>
                </div>
                ${renderEvaluationStatusBadge(result || 'Manual review')}
            </div>
            <div class="goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = goodsDraft.postQualification?.[supplier]?.checks?.[item.id] || {};
                    return `
                        <article class="goods-evaluation-card" data-goods-postqual-row data-supplier="${escapeEvaluationHtml(supplier)}" data-postqual-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${escapeEvaluationHtml(item.source)}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                ${item.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(item.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getGoodsEvaluationEvidencePanel(tender, bid, bidderIndex, [item.title, ...(item.evidenceRequired || [])])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer decision
                                    <select class="form-input" data-goods-postqual-decision>${['', 'Pass', 'Fail', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-goods-postqual-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
            <div class="evaluation-form-grid goods-postqual-result" data-goods-postqual-result data-supplier="${escapeEvaluationHtml(supplier)}">
                <label>Final post-qualification result
                    <select class="form-input" data-goods-postqual-final>
                        ${['', 'Qualified', 'Not Qualified', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${result === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select result')}</option>`).join('')}
                    </select>
                </label>
                <label>Overall remark
                    <textarea class="form-input" rows="3" data-goods-postqual-overall>${escapeEvaluationHtml(goodsDraft.postQualification?.[supplier]?.remark || '')}</textarea>
                </label>
            </div>
        </section>
    `;
}

function renderGoodsRanking(tender = {}, bids = [], goodsDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const maxScore = getGoodsSupplierMaxScore(criteria);
    const ranked = bids.map((bid, index) => {
        const supplier = getGoodsEvaluationSupplierKey(bid, index);
        const failedGate = hasGoodsFailedGate(goodsDraft, supplier, criteria) || hasGoodsFailedAdministrativeGate(goodsDraft, supplier, tender);
        return {
            bid,
            supplier,
            failedGate,
            sectionsComplete: isGoodsPriorSectionsComplete(tender, supplier, goodsDraft),
            score: failedGate ? null : getGoodsSupplierScore(goodsDraft, supplier, criteria),
            price: getGoodsEvaluationFinancialAmount(bid),
            saved: goodsDraft.ranking?.[supplier] || {}
        };
    }).sort((a, b) => {
        if (a.failedGate !== b.failedGate) return a.failedGate ? 1 : -1;
        return (b.score || 0) - (a.score || 0) || a.price - b.price;
    });
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Final ranking</span>
                    <h2>Calculated from buyer entries</h2>
                    <p>The system totals buyer-entered scores and shows whether the earlier evaluation sections are complete. The buyer manually confirms award or rejection.</p>
                </div>
                ${renderEvaluationStatusBadge('No automatic winner')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="goods-evaluation-table">
                    <thead><tr><th>Rank</th><th>Supplier</th><th>Sections status</th><th>Buyer score</th><th>Evaluated price</th><th>Recommendation</th><th>Reason / override</th></tr></thead>
                    <tbody>
                        ${ranked.map((row, index) => `
                            <tr data-goods-ranking-row data-supplier="${escapeEvaluationHtml(row.supplier)}">
                                <td>${row.failedGate ? '-' : index + 1}</td>
                                <td>${escapeEvaluationHtml(row.supplier)}</td>
                                <td>${renderEvaluationSectionCompletionStatus(row.sectionsComplete)}</td>
                                <td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td>
                                <td>${formatEvaluationMoney(row.price, row.bid.financial?.currency || 'TZS')}</td>
                                <td><select class="form-input" data-goods-ranking-recommendation>${renderEvaluationRecommendationOptions(row.saved.recommendation)}</select></td>
                                <td><textarea class="form-input" rows="2" data-goods-ranking-reason>${escapeEvaluationHtml(row.saved.reason || '')}</textarea></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderGoodsEvaluationReportDocument(tender = {}, bids = [], draft = {}) {
    const goodsDraft = getGoodsEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getGoodsEvaluationAdministrativeItems(tender);
    const completion = getGoodsEvaluationCompletion(tender, bids, draft);
    const recommendation = draft.recommendation || getGoodsManualRecommendation(tender, bids, draft);
    const rankingRows = bids.map((bid, index) => {
        const supplier = getGoodsEvaluationSupplierKey(bid, index);
        const failedGate = hasGoodsFailedGate(goodsDraft, supplier, criteria) || hasGoodsFailedAdministrativeGate(goodsDraft, supplier, tender);
        return {
            supplier,
            score: failedGate ? null : getGoodsSupplierScore(goodsDraft, supplier, criteria),
            price: getGoodsEvaluationFinancialAmount(bid),
            currency: bid.financial?.currency || 'TZS',
            sectionsStatus: isGoodsPriorSectionsComplete(tender, supplier, goodsDraft) ? 'Completed' : 'Incomplete',
            ranking: goodsDraft.ranking?.[supplier] || {}
        };
    }).sort((a, b) => (b.score || 0) - (a.score || 0) || a.price - b.price);

    return `
        <div class="evaluation-report-document goods-report-document">
            <header>
                <span>ProcureX Goods Evaluation Report</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>${escapeEvaluationHtml(tender.reference)} / Goods procurement / ${escapeEvaluationHtml(draft.status || 'Draft')}</p>
            </header>
            <section class="evaluation-report-summary">
                <div><span>Evaluation method</span><strong>Manual buyer review</strong></div>
                <div><span>Criteria source</span><strong>Published tender</strong></div>
                <div><span>Bidders</span><strong>${bids.length}</strong></div>
                <div><span>Completion</span><strong>${completion.complete}/${completion.total}</strong></div>
            </section>

            <section>
                <h2>1. Tender Information</h2>
                <p>${escapeEvaluationHtml(tender.title)} was evaluated against the published goods requirements, bidder submissions, and custom evaluation criteria.</p>
            </section>

            <section>
                <h2>2. Evaluation Method</h2>
                <p>The system organized submitted documents, specifications, financial schedules, and evidence. The buyer manually recorded all scores, pass/fail decisions, remarks, ranking decisions, and award recommendation.</p>
            </section>

            <section>
                <h2>3. List of Bidders</h2>
                <div class="evaluation-table-scroll">
                    <table>
                        <thead><tr><th>Supplier</th><th>Submission time</th><th>Receipt</th><th>Read-out price</th></tr></thead>
                        <tbody>
                            ${bids.map((bid, index) => {
                                const supplier = getGoodsEvaluationSupplierKey(bid, index);
                                return `<tr><td>${escapeEvaluationHtml(supplier)}</td><td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td><td>${escapeEvaluationHtml(bid.integrityHash || '-')}</td><td>${formatEvaluationMoney(getGoodsEvaluationFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2>4. Bid Opening Register</h2>
                <div class="evaluation-table-scroll">
                    <table>
                        <thead><tr><th>Supplier</th><th>Status</th><th>Opening remark</th></tr></thead>
                        <tbody>
                            ${bids.map((bid, index) => {
                                const supplier = getGoodsEvaluationSupplierKey(bid, index);
                                const row = goodsDraft.opening?.[supplier] || {};
                                return `<tr><td>${escapeEvaluationHtml(supplier)}</td><td>${escapeEvaluationHtml(row.status || 'Opened')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2>5. Administrative & Eligibility Evaluation</h2>
                <div class="evaluation-table-scroll">
                    <table>
                        <thead><tr><th>Supplier</th><th>Requirement</th><th>Decision</th><th>Remark</th></tr></thead>
                        <tbody>
                            ${bids.flatMap((bid, index) => {
                                const supplier = getGoodsEvaluationSupplierKey(bid, index);
                                return adminItems.map(item => {
                                    const row = goodsDraft.administrative?.[supplier]?.[item.id] || {};
                                    return `<tr><td>${escapeEvaluationHtml(supplier)}</td><td>${escapeEvaluationHtml(item.title)}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                                });
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2>6. Custom Evaluation Criteria</h2>
                <div class="evaluation-table-scroll">
                    <table>
                        <thead><tr><th>Supplier</th><th>Criterion</th><th>Type</th><th>Decision</th><th>Score</th><th>Comment</th></tr></thead>
                        <tbody>
                            ${bids.flatMap((bid, index) => {
                                const supplier = getGoodsEvaluationSupplierKey(bid, index);
                                return criteria.map(criterion => {
                                    const row = getGoodsCriterionSaved(goodsDraft, supplier, criterion.id);
                                    return `<tr><td>${escapeEvaluationHtml(supplier)}</td><td>${escapeEvaluationHtml(criterion.name)}</td><td>${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.score || '-')}${criterion.maxScore ? ` / ${escapeEvaluationHtml(criterion.maxScore)}` : ''}</td><td>${escapeEvaluationHtml(row.comment || '-')}</td></tr>`;
                                });
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2>7. Financial Evaluation</h2>
                <p>Financial review records arithmetic checks and evaluated price details separately from scoring. Financial score is only applied where the buyer published a price-based criterion.</p>
            </section>
            ${renderEvaluationFinancialDocumentReportSection(tender, bids, {
                title: '8. Financial Documents Reviewed',
                getOwner: getGoodsEvaluationSupplierKey,
                getSavedDocuments: supplier => goodsDraft.financialDocuments?.[supplier] || {}
            })}

            <section>
                <h2>9. Supplier Capability / Post-Qualification</h2>
                <div class="evaluation-table-scroll">
                    <table>
                        <thead><tr><th>Supplier</th><th>Result</th><th>Remark</th></tr></thead>
                        <tbody>
                            ${bids.map((bid, index) => {
                                const supplier = getGoodsEvaluationSupplierKey(bid, index);
                                const row = goodsDraft.postQualification?.[supplier] || {};
                                return `<tr><td>${escapeEvaluationHtml(supplier)}</td><td>${escapeEvaluationHtml(row.result || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2>10. Final Ranking and Award Recommendation</h2>
                <div class="evaluation-table-scroll">
                    <table>
                        <thead><tr><th>Rank</th><th>Supplier</th><th>Sections status</th><th>Buyer score</th><th>Evaluated price</th><th>Buyer action</th><th>Reason</th></tr></thead>
                        <tbody>
                            ${rankingRows.map((row, index) => `<tr><td>${row.score === null ? '-' : index + 1}</td><td>${escapeEvaluationHtml(row.supplier)}</td><td>${escapeEvaluationHtml(row.sectionsStatus)}</td><td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(getGoodsSupplierMaxScore(criteria))}`}</td><td>${formatEvaluationMoney(row.price, row.currency)}</td><td>${escapeEvaluationHtml(normalizeEvaluationRecommendation(row.ranking.recommendation) || 'Pending')}</td><td>${escapeEvaluationHtml(row.ranking.reason || '-')}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <p><strong>Recommended supplier:</strong> ${escapeEvaluationHtml(recommendation.supplier || 'Pending buyer recommendation')}</p>
            </section>

            <section>
                <h2>11. Buyer Declaration</h2>
                <p>I confirm that the submitted goods bids were reviewed manually against the published tender requirements, product specifications, eligibility requirements, delivery requirements, and evaluation criteria. The system organized the information and calculated totals, but the evaluation decision was made by the buyer.</p>
            </section>
        </div>
    `;
}

function renderGoodsActiveStage(tender = {}, bids = [], supplierIndex = 0, activeStageId = 'opening', draft = {}) {
    const goodsDraft = getGoodsEvaluationDraft(draft);
    const bid = bids[supplierIndex] || {};
    if (activeStageId === 'opening') return renderGoodsOpeningRegister(tender, bids, goodsDraft);
    if (activeStageId === 'administrative') return renderGoodsAdministrativeReview(tender, bid, supplierIndex, goodsDraft);
    if (activeStageId === 'criteria') return renderGoodsCriteriaEvaluation(tender, bid, supplierIndex, goodsDraft);
    if (activeStageId === 'financial') return renderGoodsFinancialReview(tender, bid, supplierIndex, goodsDraft);
    if (activeStageId === 'postqual') return renderGoodsPostQualification(tender, bid, supplierIndex, goodsDraft);
    if (activeStageId === 'ranking') return renderGoodsRanking(tender, bids, goodsDraft);
    return renderGoodsEvaluationReportDocument(tender, bids, draft);
}

function renderGoodsBidEvaluationWorkspace(tender = {}) {
    const bids = getEvaluationBidsForTender(tender);
    const draft = getEvaluationDraft(tender.reference) || {};
    const goodsDraft = getGoodsEvaluationDraft(draft);
    const stages = getGoodsEvaluationStages();
    const activeStageId = goodsDraft.currentStageId || 'opening';
    const supplierIndex = Math.min(Math.max(Number(draft.currentSupplierIndex || goodsDraft.currentSupplierIndex || 0), 0), Math.max(0, bids.length - 1));
    const completion = getGoodsEvaluationCompletion(tender, bids, draft);
    const criteria = getEvaluationCriteriaForTender(tender);

    if (!bids.length) {
        return renderEvaluationShell(`
            <section class="procurement-hero evaluation-hero-panel">
                <div>
                    <span class="section-kicker">Goods Bid Evaluation Workspace</span>
                    <h1>${escapeEvaluationHtml(tender.title)}</h1>
                    <p>No submitted goods bid package is available for this tender in the current browser or mock data.</p>
                </div>
                <div class="evaluation-hero-stats">
                    <div><strong>0</strong><span>Bids available</span></div>
                    <div><strong>${criteria.length}</strong><span>Published criteria</span></div>
                </div>
            </section>
        `, 'Goods Evaluation', tender.reference);
    }

    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Goods Bid Evaluation Workspace</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Manual evaluation using buyer-defined published criteria. The system organizes supplier submissions and calculates totals; the buyer makes every evaluation decision manually.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(tender.reference)}</strong><span>Tender reference</span></div>
                <div><strong>Goods</strong><span>Procurement type</span></div>
                <div><strong>${bids.length}</strong><span>Bids opened</span></div>
                <div><strong>${completion.percent}%</strong><span>Evaluation status</span></div>
            </div>
        </section>

        <section class="evaluation-top-summary">
            <div><span>Evaluation mode</span><strong>Manual Buyer Review</strong></div>
            <div><span>Criteria source</span><strong>Published tender</strong></div>
            <div><span>Buyer criteria</span><strong>${criteria.length}</strong></div>
            <div><span>Readiness</span>${renderEvaluationStatusBadge(tender.status || 'Evaluation open')}</div>
        </section>

        <section class="procurement-panel evaluation-panel goods-evaluation-workspace" data-evaluation-workspace="${escapeEvaluationHtml(tender.reference)}" data-current-supplier-index="${supplierIndex}" data-current-goods-stage="${escapeEvaluationHtml(activeStageId)}">
            ${renderGoodsBidderTabs(bids, supplierIndex)}
            <div class="evaluation-progress-track evaluation-workspace-progress"><span style="width: ${completion.percent}%"></span></div>
            <div class="evaluation-review-grid">
                ${renderGoodsStageRail(stages, activeStageId)}
                <div class="evaluation-review-main">
                    ${renderGoodsActiveStage(tender, bids, supplierIndex, activeStageId, draft)}
                </div>
            </div>
            <div class="evaluation-finish-panel">
                <div>
                    <span class="section-kicker">Complete goods evaluation</span>
                    <h3>${completion.canComplete ? 'Ready for buyer completion' : 'Complete all administrative and criteria decisions'}</h3>
                    <p>${completion.complete} of ${completion.total} required checks are complete. Ranking remains a manual buyer recommendation even after totals are calculated.</p>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(tender.reference)}">Preview Report</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</button>
                    <button class="btn btn-primary" type="button" data-evaluation-complete="${escapeEvaluationHtml(tender.reference)}" ${completion.canComplete ? '' : 'disabled'}>Complete Evaluation</button>
                </div>
            </div>
        </section>
    `, 'Goods Evaluation', tender.reference);
}

function getWorksEvaluationStages() {
    return [
        { id: 'opening', label: 'Opening Register' },
        { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
        { id: 'criteria', label: 'Custom Evaluation Criteria' },
        { id: 'boq', label: 'Financial Review' },
        { id: 'postqual', label: 'Post-Qualification' },
        { id: 'ranking', label: 'Final Ranking' },
        { id: 'report', label: 'Evaluation Report' }
    ];
}

function getWorksEvaluationDraft(draft = {}) {
    return draft.works && typeof draft.works === 'object' ? draft.works : {};
}

function getWorksEvaluationContractorKey(bid = {}, index = 0) {
    return bid.supplier || `Contractor ${index + 1}`;
}

function getWorksEvaluationFinancialAmount(bid = {}) {
    return Number(bid.financial?.correctedPrice || bid.price || 0) || 0;
}

function getWorksEvaluationContractType(tender = {}) {
    const fields = (tender.sourceTender || tender).requirements?.fields || {};
    return fields.contractType || tender.contractType || 'Works contract';
}

function getWorksEvaluationBoqRows(tender = {}, bid = {}) {
    const submittedRows = bid.draft?.financialOfferRows || bid.submittedBid?.draft?.financialOfferRows || [];
    if (submittedRows.length) return submittedRows;
    const fields = (tender.sourceTender || tender).requirements?.fields || {};
    return fields.boqRows?.length
        ? fields.boqRows
        : ((tender.sourceTender || tender).commercialItems || (tender.sourceTender || tender).boqItems || []);
}

function getWorksEvaluationAdministrativeItems(tender = {}) {
    const source = tender.sourceTender || tender;
    const requirementSet = getEvaluationRequirementSet(source);
    const licenseItems = (source.regulatoryLicenses || []).map((license, index) => ({
        id: `works-license-${index}`,
        title: license.license || license.registrationType || license.regulatoryBody || 'Contractor registration / license',
        mandatory: license.mandatory !== false,
        source: license.body || license.group || 'Regulatory license'
    }));
    const fieldDocs = [
        ...(source.requiredSubmissionDocuments || []),
        ...(source.requirements?.fields?.worksDocumentRows || []).map(item => item.documentTitle || item.documentType || item.name),
        ...(source.requirements?.fields?.otherEligibilityRequirements || []).map(item => item.requirementName || item.text || item.name),
        ...(requirementSet.mandatory || [])
            .filter(item => /bid security|license|certificate|tax|registration|contractor|signed|form|power|attorney|osha|safety|insurance|declaration|eligibility|document/i.test(`${item.title} ${item.category}`))
            .map(item => item.title)
    ].filter(Boolean);
    const docItems = Array.from(new Set(fieldDocs)).map((title, index) => ({
        id: `works-admin-${slugEvaluationId(title)}-${index}`,
        title,
        mandatory: true,
        source: 'Published tender requirement'
    }));
    return [...licenseItems, ...docItems].length ? [...licenseItems, ...docItems] : [
        { id: 'works-admin-bid-security', title: 'Bid security', mandatory: true, source: 'Default works responsiveness check' },
        { id: 'works-admin-registration', title: 'Contractor registration certificate', mandatory: true, source: 'Default works responsiveness check' },
        { id: 'works-admin-tax', title: 'Tax clearance certificate', mandatory: true, source: 'Default works responsiveness check' },
        { id: 'works-admin-signed-form', title: 'Signed bid form', mandatory: true, source: 'Default works responsiveness check' },
        { id: 'works-admin-hse', title: 'OSHA / safety compliance', mandatory: true, source: 'Default works responsiveness check' }
    ];
}

function getWorksEvaluationCommercialTerms(tender = {}) {
    const fields = (tender.sourceTender || tender).requirements?.fields || {};
    return [
        { id: 'bid-validity', term: 'Bid validity', requirement: fields.bidValidity || fields.validityPeriod || 'As stated in tender' },
        { id: 'performance-guarantee', term: 'Performance guarantee', requirement: fields.performanceGuarantee || 'As stated in tender' },
        { id: 'retention-money', term: 'Retention money', requirement: fields.retentionMoney || fields.retention || 'As stated in tender' },
        { id: 'defects-liability', term: 'Defects liability period', requirement: fields.defectsLiabilityPeriod || 'As stated in tender' },
        { id: 'liquidated-damages', term: 'Liquidated damages', requirement: fields.liquidatedDamages || 'As stated in tender' },
        { id: 'completion-period', term: 'Completion period', requirement: fields.worksCompletionPeriod || 'As stated in tender' }
    ];
}

function getWorksEvaluationPostQualItems(tender = {}) {
    const criteria = getEvaluationCriteriaForTender(tender)
        .filter(criterion => /post|qualification|capacity|experience|personnel|equipment|mobilization|hse|insurance|contractor|registration|financial capacity/i.test(`${criterion.name} ${criterion.category} ${criterion.subcriteria.join(' ')}`));
    if (criteria.length) {
        return criteria.map(criterion => ({
            id: `works-postqual-${criterion.id}`,
            title: criterion.name,
            source: 'Buyer-defined criterion',
            evidenceRequired: criterion.evidenceRequired || []
        }));
    }
    return [
        { id: 'works-postqual-legal', title: 'Legal status and contractor registration remain valid', source: 'Manual works post-qualification checklist' },
        { id: 'works-postqual-experience', title: 'Similar works experience is verified', source: 'Manual works post-qualification checklist' },
        { id: 'works-postqual-personnel', title: 'Named personnel are available', source: 'Manual works post-qualification checklist' },
        { id: 'works-postqual-equipment', title: 'Owned or leased equipment is available', source: 'Manual works post-qualification checklist' },
        { id: 'works-postqual-hse', title: 'HSE, insurance, and mobilization readiness are acceptable', source: 'Manual works post-qualification checklist' }
    ];
}

function getWorksCriterionSaved(worksDraft = {}, contractor = '', criterionId = '') {
    return worksDraft.criteriaEvaluation?.[contractor]?.[criterionId] || {};
}

function isWorksCriterionComplete(row = {}, criterion = {}) {
    return isGoodsCriterionComplete(row, criterion);
}

function isWorksAdministrativeComplete(row = {}) {
    return isGoodsAdministrativeComplete(row);
}

function isWorksRankingDecisionComplete(row = {}) {
    return isGoodsRankingDecisionComplete(row);
}

function isWorksCommercialTermComplete(row = {}) {
    if (!row.decision) return false;
    if (isGoodsManualDecisionNegative(row.decision) && !String(row.remark || '').trim()) return false;
    return true;
}

function isWorksPriorSectionsComplete(tender = {}, contractor = '', worksDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getWorksEvaluationAdministrativeItems(tender);
    const adminDone = adminItems.every(item => isWorksAdministrativeComplete(worksDraft.administrative?.[contractor]?.[item.id] || {}));
    const criteriaDone = criteria.every(criterion => isWorksCriterionComplete(getWorksCriterionSaved(worksDraft, contractor, criterion.id), criterion));
    const financialDone = Boolean(getWorksFinancialReviewStatus(worksDraft, contractor));
    const postDone = Boolean(worksDraft.postQualification?.[contractor]?.result);
    return adminDone && criteriaDone && financialDone && postDone;
}

function getWorksFinancialReviewStatus(worksDraft = {}, contractor = '') {
    return worksDraft.boqFinancialReview?.[contractor]?.status || '';
}

function hasWorksFailedGate(worksDraft = {}, contractor = '', criteria = []) {
    return criteria.some(criterion => {
        if (!criterion.passFailGate && !criterion.mandatory) return false;
        const row = getWorksCriterionSaved(worksDraft, contractor, criterion.id);
        return /fail|rejected|non-responsive|non-compliant|major deviation/i.test(row.decision || '');
    });
}

function hasWorksFailedAdministrativeGate(worksDraft = {}, contractor = '', tender = {}) {
    return getWorksEvaluationAdministrativeItems(tender).some(item => {
        if (item.mandatory === false) return false;
        const row = worksDraft.administrative?.[contractor]?.[item.id] || {};
        return /fail|rejected|non-responsive/i.test(row.decision || '');
    });
}

function hasWorksBlockingReview(worksDraft = {}, contractor = '', tender = {}) {
    const financialStatus = getWorksFinancialReviewStatus(worksDraft, contractor);
    const postResult = worksDraft.postQualification?.[contractor]?.result || '';
    return /non-responsive|fail|abnormally low/i.test(financialStatus) || /not qualified/i.test(postResult);
}

function getWorksContractorScore(worksDraft = {}, contractor = '', criteria = []) {
    return getEvaluationWeightedScore(criteria, criterion => getWorksCriterionSaved(worksDraft, contractor, criterion.id));
}

function getWorksContractorMaxScore(criteria = []) {
    return getGoodsSupplierMaxScore(criteria);
}

function getWorksManualRecommendation(tender = {}, bids = [], draft = {}) {
    const works = getWorksEvaluationDraft(draft);
    const recommended = bids.map((bid, index) => {
        const contractor = getWorksEvaluationContractorKey(bid, index);
        return { bid, contractor, row: works.ranking?.[contractor] || {} };
    }).find(item => normalizeEvaluationRecommendation(item.row.recommendation) === 'Recommended for award');
    if (!recommended) return { supplier: '', amount: 0, currency: 'TZS', reason: '' };
    return {
        supplier: recommended.contractor,
        amount: recommended.bid.financial?.correctedPrice || recommended.bid.price || 0,
        currency: recommended.bid.financial?.currency || 'TZS',
        reason: recommended.row.reason || 'Recommended manually by the buyer after completing the works evaluation record.'
    };
}

function getWorksEvaluationCompletion(tender = {}, bids = [], draft = {}) {
    const works = getWorksEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getWorksEvaluationAdministrativeItems(tender);
    const total = bids.length * (criteria.length + adminItems.length + 3);
    let hasRecommendation = false;
    const complete = bids.reduce((sum, bid, index) => {
        const contractor = getWorksEvaluationContractorKey(bid, index);
        const ranking = works.ranking?.[contractor] || {};
        if (normalizeEvaluationRecommendation(ranking.recommendation) === 'Recommended for award') hasRecommendation = true;
        const adminDone = adminItems.filter(item => isWorksAdministrativeComplete(works.administrative?.[contractor]?.[item.id] || {})).length;
        const criteriaDone = criteria.filter(criterion => isWorksCriterionComplete(getWorksCriterionSaved(works, contractor, criterion.id), criterion)).length;
        const financialDone = getWorksFinancialReviewStatus(works, contractor) ? 1 : 0;
        const postDone = works.postQualification?.[contractor]?.result ? 1 : 0;
        const rankingDone = isWorksRankingDecisionComplete(ranking) ? 1 : 0;
        return sum + adminDone + criteriaDone + financialDone + postDone + rankingDone;
    }, 0);
    return { total, complete, percent: total ? Math.round((complete / total) * 100) : 0, canComplete: total > 0 && complete >= total && hasRecommendation };
}

function getWorksEvaluationEvidencePanel(tender = {}, bid = {}, bidderIndex = 0, labels = [], options = {}) {
    const evidence = findEvaluationEvidenceForRequirement(getEvaluationBidEvidenceRows(tender, bid, bidderIndex), { title: labels.join(' '), labels }, options);
    return `
        <aside class="works-evidence-panel goods-evidence-panel">
            <strong>Submitted Works Evidence</strong>
            ${evidence.length ? evidence.map(item => `
                <article class="evaluation-evidence-item">
                    <span>${escapeEvaluationHtml(item.section || 'Evidence')}</span>
                    <p>${escapeEvaluationHtml(item.label || '')}: ${escapeEvaluationHtml(item.value || item.file || 'Provided')}</p>
                    ${renderEvaluationEvidenceDocumentActions(item)}
                </article>
            `).join('') : '<p>No matching submitted evidence was found. Review the available works bid package and record the buyer decision manually.</p>'}
        </aside>
    `;
}

function renderWorksContractorTabs(bids = [], activeIndex = 0) {
    return `
        <div class="works-contractor-tabs goods-bidder-tabs" role="tablist" aria-label="Works contractors">
            ${bids.map((bid, index) => `
                <button class="works-contractor-tab goods-bidder-tab ${index === activeIndex ? 'active' : ''}" type="button" data-works-contractor-index="${index}">
                    <strong>${escapeEvaluationHtml(bid.supplier || `Contractor ${index + 1}`)}</strong>
                    <span>${escapeEvaluationHtml(bid.preliminaryResult || bid.finalResult || 'Under review')}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderWorksStageRail(stages = [], activeStageId = '') {
    return renderEvaluationStageWorkflow(stages, activeStageId, 'data-works-stage', 'Works evaluation stages');
}

function renderWorksOpeningRegister(tender = {}, bids = [], worksDraft = {}) {
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Bid opening register</span>
                    <h2>Open submitted works bids</h2>
                    <p>Record read-out price, completion period, and opening remarks. This stage does not decide responsiveness.</p>
                </div>
                ${renderEvaluationStatusBadge('Manual buyer record')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="works-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Contractor</th><th>Submission time</th><th>Receipt no.</th><th>Read-out price</th><th>Completion period</th><th>Opening remark</th></tr></thead>
                    <tbody>
                        ${bids.map((bid, index) => {
                            const contractor = getWorksEvaluationContractorKey(bid, index);
                            const saved = worksDraft.opening?.[contractor] || {};
                            return `
                                <tr data-works-opening-row data-contractor="${escapeEvaluationHtml(contractor)}">
                                    <td>${escapeEvaluationHtml(contractor)}</td>
                                    <td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td>
                                    <td>${escapeEvaluationHtml(bid.integrityHash || bid.submittedBid?.receiptHash || '-')}</td>
                                    <td>${formatEvaluationMoney(getWorksEvaluationFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td>
                                    <td><input class="form-input" data-works-opening-completion value="${escapeEvaluationHtml(saved.completionPeriodOffered || '')}" placeholder="e.g. 10 months"></td>
                                    <td><input class="form-input" data-works-opening-remark value="${escapeEvaluationHtml(saved.remark || 'Opening record captured')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderWorksAdministrativeReview(tender = {}, bid = {}, bidderIndex = 0, worksDraft = {}) {
    const contractor = getWorksEvaluationContractorKey(bid, bidderIndex);
    const items = getWorksEvaluationAdministrativeItems(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Administrative & Eligibility Evaluation</span>
                    <h2>${escapeEvaluationHtml(contractor)}</h2>
                    <p>Check mandatory works documents and basic eligibility. The system can show evidence, but the buyer decides pass, fail, or clarification.</p>
                </div>
                ${renderEvaluationStatusBadge('Buyer Decision')}
            </div>
            <div class="works-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = worksDraft.administrative?.[contractor]?.[item.id] || {};
                    return `
                        <article class="works-evaluation-card goods-evaluation-card" data-works-admin-row data-contractor="${escapeEvaluationHtml(contractor)}" data-admin-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${item.mandatory ? 'Mandatory' : 'Optional'}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                <p>${escapeEvaluationHtml(item.source || 'Published tender requirement')}</p>
                            </div>
                            ${getWorksEvaluationEvidencePanel(tender, bid, bidderIndex, [item.title], { strict: true, limit: 1 })}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-works-admin-decision>${['', 'Pass', 'Fail', 'Not Applicable', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-works-admin-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderWorksCriteriaEvaluation(tender = {}, bid = {}, bidderIndex = 0, worksDraft = {}) {
    const contractor = getWorksEvaluationContractorKey(bid, bidderIndex);
    const criteria = getEvaluationCriteriaForTender(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Criteria from Published Tender</span>
                    <h2>Custom Evaluation Criteria</h2>
                    <p>These criteria are loaded from the tender. Works evidence supports the review, but evidence sections do not become fixed scoring rules.</p>
                </div>
                ${renderEvaluationStatusBadge(`${criteria.length} criteria`)}
            </div>
            ${renderEvaluationSubmittedBidReportActions(tender, bid, bidderIndex)}
            <div class="evaluation-notice warning">The system organizes works evidence and calculates totals only. Buyer Score and Buyer Decision are entered manually.</div>
            <div class="works-evaluation-card-list goods-evaluation-card-list">
                ${criteria.map((criterion, index) => {
                    const saved = getWorksCriterionSaved(worksDraft, contractor, criterion.id);
                    const isGate = criterion.passFailGate || /pass_fail|document_check/.test(criterion.evaluationType);
                    const decisionOptions = getGoodsCriterionDecisionOptions(criterion);
                    return `
                        <article class="works-evaluation-card goods-evaluation-card" data-works-criterion-row data-contractor="${escapeEvaluationHtml(contractor)}" data-criterion-id="${escapeEvaluationHtml(criterion.id)}" data-criterion-type="${escapeEvaluationHtml(criterion.evaluationType)}">
                            <div>
                                <span class="section-kicker">Criterion ${index + 1} / ${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</span>
                                <h3>${escapeEvaluationHtml(criterion.name)}</h3>
                                <p>${escapeEvaluationHtml(criterion.description || criterion.subcriteria.join(', ') || 'Buyer-defined criterion.')}</p>
                                <div class="goods-criterion-meta works-criterion-meta">
                                    <span>Weight: ${escapeEvaluationHtml(criterion.weight || 0)}</span>
                                    <span>Max score: ${escapeEvaluationHtml(criterion.maxScore || 0)}</span>
                                    ${criterion.mandatory ? '<span>Mandatory</span>' : ''}
                                    ${criterion.passFailGate ? '<span>Gate</span>' : ''}
                                </div>
                                ${criterion.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(criterion.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getWorksEvaluationEvidencePanel(tender, bid, bidderIndex, [criterion.name, ...(criterion.subcriteria || []), ...(criterion.evidenceRequired || []), 'methodology', 'work program', 'site visit', 'personnel', 'equipment', 'HSE', 'BOQ'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-works-criterion-decision>${decisionOptions.map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                ${criterion.maxScore > 0 && !isGate ? `
                                    <label>Buyer Score / ${escapeEvaluationHtml(criterion.maxScore)}
                                        <input class="form-input" type="number" min="0" max="${escapeEvaluationHtml(criterion.maxScore)}" step="0.5" value="${escapeEvaluationHtml(saved.score ?? '')}" data-works-criterion-score>
                                    </label>
                                ` : ''}
                                <label class="wide">Buyer comment
                                    <textarea class="form-input" rows="3" data-works-criterion-comment>${escapeEvaluationHtml(saved.comment || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderWorksBoqFinancialReview(tender = {}, bid = {}, bidderIndex = 0, worksDraft = {}) {
    const contractor = getWorksEvaluationContractorKey(bid, bidderIndex);
    const rows = getWorksEvaluationBoqRows(tender, bid);
    const savedReview = worksDraft.boqFinancialReview?.[contractor] || {};
    const amount = getWorksEvaluationFinancialAmount(bid);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Financial review, not automatic scoring</span>
                    <h2>Financial Review</h2>
                    <p>Check priced works items, BOQ rate breakdowns, totals, arithmetic, taxes, discounts, abnormal rates, and financial documents. Financial scoring stays in custom criteria only.</p>
                </div>
                ${renderEvaluationStatusBadge(formatEvaluationMoney(amount, bid.financial?.currency || 'TZS'))}
            </div>
            <div class="evaluation-financial-review">
                <div><span>Read-out price</span><strong>${formatEvaluationMoney(bid.price || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Corrected price</span><strong>${formatEvaluationMoney(bid.financial?.correctedPrice || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>BOQ status</span><strong>${escapeEvaluationHtml(bid.financial?.boqStatus || 'Pending buyer review')}</strong></div>
                <div><span>Correction note</span><strong>${escapeEvaluationHtml(bid.financial?.correctionNote || 'None recorded')}</strong></div>
            </div>
            ${renderEvaluationFinancialDocumentReview(tender, bid, bidderIndex, { scope: 'works', owner: contractor, savedDocuments: savedReview.documents || {} })}
            <div class="evaluation-form-grid works-financial-status" data-works-financial-result data-contractor="${escapeEvaluationHtml(contractor)}">
                <label>Financial review result
                    <select class="form-input" data-works-financial-status>${['', 'Financially Responsive', 'Financially Non-responsive', 'Arithmetic Correction Required', 'Clarification Required', 'Abnormally Low Bid Review Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${savedReview.status === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select result')}</option>`).join('')}</select>
                </label>
                <label>Overall financial remark
                    <textarea class="form-input" rows="3" data-works-financial-overall>${escapeEvaluationHtml(savedReview.remark || '')}</textarea>
                </label>
            </div>
            <div class="evaluation-table-scroll">
                <table class="works-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Item</th><th>Work item</th><th>Qty</th><th>Unit</th><th>Labor</th><th>Material</th><th>Equipment</th><th>Overheads</th><th>Profit %</th><th>Unit rate</th><th>Total</th><th>Buyer check</th><th>Remark</th></tr></thead>
                    <tbody>
                        ${(rows.length ? rows : [{ item: '1', workItem: 'Financial offer total', quantity: 1, unit: 'Lot', unitRate: amount, total: amount }]).map((item, index) => {
                            const saved = savedReview.lines?.[`line-${index}`] || {};
                            return `
                                <tr data-works-boq-row data-contractor="${escapeEvaluationHtml(contractor)}" data-line-id="line-${index}">
                                    <td>${escapeEvaluationHtml(item.item || item.code || index + 1)}</td>
                                    <td>${escapeEvaluationHtml(item.workItem || item.description || item.itemDescription || `Work item ${index + 1}`)}</td>
                                    <td>${escapeEvaluationHtml(item.quantity || item.qty || 1)}</td>
                                    <td>${escapeEvaluationHtml(item.unit || item.unitOfMeasure || 'Lot')}</td>
                                    <td>${escapeEvaluationHtml(item.labor || item.laborCost || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.material || item.materialCost || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.equipment || item.equipmentCost || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.overheads || item.overheadCost || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.profit || item.profitPercent || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.unitRate || item.rate || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.total || item.amount || '-')}</td>
                                    <td><select class="form-input" data-works-boq-check>${['', 'Accepted', 'Correction Required', 'Not Priced', 'Clarification Required', 'Abnormally Low/High Rate Review'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.check === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select check')}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-works-boq-remark value="${escapeEvaluationHtml(saved.remark || '')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderWorksCommercialTerms(tender = {}, bid = {}, bidderIndex = 0, worksDraft = {}) {
    const contractor = getWorksEvaluationContractorKey(bid, bidderIndex);
    const terms = getWorksEvaluationCommercialTerms(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Commercial terms response</span>
                    <h2>${escapeEvaluationHtml(contractor)}</h2>
                    <p>Confirm bid validity, performance guarantee, retention, defects liability, liquidated damages, and completion commitments.</p>
                </div>
                ${renderEvaluationStatusBadge('Buyer Decision')}
            </div>
            <div class="works-evaluation-card-list goods-evaluation-card-list">
                ${terms.map(term => {
                    const saved = worksDraft.commercialTerms?.[contractor]?.[term.id] || {};
                    return `
                        <article class="works-evaluation-card goods-evaluation-card" data-works-commercial-row data-contractor="${escapeEvaluationHtml(contractor)}" data-term-id="${escapeEvaluationHtml(term.id)}">
                            <div>
                                <span class="section-kicker">Contract condition</span>
                                <h3>${escapeEvaluationHtml(term.term)}</h3>
                                <p>Tender requirement: ${escapeEvaluationHtml(term.requirement || '-')}</p>
                            </div>
                            ${getWorksEvaluationEvidencePanel(tender, bid, bidderIndex, [term.term, 'commercial terms', 'bid validity', 'performance guarantee', 'retention', 'defects liability', 'liquidated damages'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-works-commercial-decision>${['', 'Pass', 'Fail', 'Clarification Required', 'Not Applicable'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Supplier response
                                    <input class="form-input" data-works-commercial-response value="${escapeEvaluationHtml(saved.response || '')}" placeholder="Record submitted response">
                                </label>
                                <label class="wide">Remark
                                    <textarea class="form-input" rows="3" data-works-commercial-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderWorksPostQualification(tender = {}, bid = {}, bidderIndex = 0, worksDraft = {}) {
    const contractor = getWorksEvaluationContractorKey(bid, bidderIndex);
    const items = getWorksEvaluationPostQualItems(tender);
    const result = worksDraft.postQualification?.[contractor]?.result || '';
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Contractor capability / post-qualification</span>
                    <h2>${escapeEvaluationHtml(contractor)}</h2>
                    <p>Confirm that the contractor can execute the works, mobilize resources, honor HSE commitments, and accept contract readiness requirements.</p>
                </div>
                ${renderEvaluationStatusBadge(result || 'Manual review')}
            </div>
            <div class="works-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = worksDraft.postQualification?.[contractor]?.checks?.[item.id] || {};
                    return `
                        <article class="works-evaluation-card goods-evaluation-card" data-works-postqual-row data-contractor="${escapeEvaluationHtml(contractor)}" data-postqual-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${escapeEvaluationHtml(item.source)}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                ${item.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(item.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getWorksEvaluationEvidencePanel(tender, bid, bidderIndex, [item.title, ...(item.evidenceRequired || []), 'post qualification', 'experience', 'personnel', 'equipment', 'HSE', 'insurance'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-works-postqual-decision>${['', 'Pass', 'Fail', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-works-postqual-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
            <div class="evaluation-form-grid works-postqual-result" data-works-postqual-result data-contractor="${escapeEvaluationHtml(contractor)}">
                <label>Final post-qualification result
                    <select class="form-input" data-works-postqual-final>${['', 'Qualified', 'Not Qualified', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${result === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select result')}</option>`).join('')}</select>
                </label>
                <label>Overall remark
                    <textarea class="form-input" rows="3" data-works-postqual-overall>${escapeEvaluationHtml(worksDraft.postQualification?.[contractor]?.remark || '')}</textarea>
                </label>
            </div>
        </section>
    `;
}

function renderWorksRanking(tender = {}, bids = [], worksDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const maxScore = getWorksContractorMaxScore(criteria);
    const ranked = bids.map((bid, index) => {
        const contractor = getWorksEvaluationContractorKey(bid, index);
        const failedGate = hasWorksFailedGate(worksDraft, contractor, criteria) || hasWorksFailedAdministrativeGate(worksDraft, contractor, tender) || hasWorksBlockingReview(worksDraft, contractor, tender);
        return {
            bid,
            contractor,
            failedGate,
            sectionsComplete: isWorksPriorSectionsComplete(tender, contractor, worksDraft),
            score: failedGate ? null : getWorksContractorScore(worksDraft, contractor, criteria),
            price: getWorksEvaluationFinancialAmount(bid),
            saved: worksDraft.ranking?.[contractor] || {}
        };
    }).sort((a, b) => {
        if (a.failedGate !== b.failedGate) return a.failedGate ? 1 : -1;
        return (b.score || 0) - (a.score || 0) || a.price - b.price;
    });
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Final ranking</span>
                    <h2>Calculated from buyer entries</h2>
                    <p>The system totals Buyer Scores and shows whether earlier evaluation sections are complete. The buyer manually confirms award or rejection.</p>
                </div>
                ${renderEvaluationStatusBadge('No automatic winner')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="works-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Rank</th><th>Contractor</th><th>Sections status</th><th>Weighted Score</th><th>Evaluated Price</th><th>Recommendation</th><th>Reason / override</th></tr></thead>
                    <tbody>
                        ${ranked.map((row, index) => `
                            <tr data-works-ranking-row data-contractor="${escapeEvaluationHtml(row.contractor)}">
                                <td>${row.failedGate ? '-' : index + 1}</td>
                                <td>${escapeEvaluationHtml(row.contractor)}</td>
                                <td>${renderEvaluationSectionCompletionStatus(row.sectionsComplete)}</td>
                                <td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td>
                                <td>${formatEvaluationMoney(row.price, row.bid.financial?.currency || 'TZS')}</td>
                                <td><select class="form-input" data-works-ranking-recommendation>${renderEvaluationRecommendationOptions(row.saved.recommendation)}</select></td>
                                <td><textarea class="form-input" rows="2" data-works-ranking-reason>${escapeEvaluationHtml(row.saved.reason || '')}</textarea></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderWorksEvaluationReportDocument(tender = {}, bids = [], draft = {}) {
    const worksDraft = getWorksEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getWorksEvaluationAdministrativeItems(tender);
    const completion = getWorksEvaluationCompletion(tender, bids, draft);
    const recommendation = draft.recommendation || getWorksManualRecommendation(tender, bids, draft);
    const maxScore = getWorksContractorMaxScore(criteria);
    const rankingRows = bids.map((bid, index) => {
        const contractor = getWorksEvaluationContractorKey(bid, index);
        const failedGate = hasWorksFailedGate(worksDraft, contractor, criteria) || hasWorksFailedAdministrativeGate(worksDraft, contractor, tender) || hasWorksBlockingReview(worksDraft, contractor, tender);
        return {
            contractor,
            score: failedGate ? null : getWorksContractorScore(worksDraft, contractor, criteria),
            price: getWorksEvaluationFinancialAmount(bid),
            currency: bid.financial?.currency || 'TZS',
            sectionsStatus: isWorksPriorSectionsComplete(tender, contractor, worksDraft) ? 'Completed' : 'Incomplete',
            ranking: worksDraft.ranking?.[contractor] || {}
        };
    }).sort((a, b) => (b.score || 0) - (a.score || 0) || a.price - b.price);

    return `
        <div class="evaluation-report-document works-report-document">
            <header>
                <span>Works Tender Evaluation Report</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>${escapeEvaluationHtml(tender.reference)} / Works procurement / ${escapeEvaluationHtml(getWorksEvaluationContractType(tender))} / ${escapeEvaluationHtml(draft.status || 'Draft')}</p>
            </header>
            <section class="evaluation-report-summary">
                <div><span>Evaluation method</span><strong>Manual buyer review</strong></div>
                <div><span>Criteria source</span><strong>Published tender</strong></div>
                <div><span>Contractors</span><strong>${bids.length}</strong></div>
                <div><span>Completion</span><strong>${completion.complete}/${completion.total}</strong></div>
            </section>

            <section><h2>1. Tender Information</h2><p>${escapeEvaluationHtml(tender.title)} was evaluated against the published works requirements, submitted contractor evidence, BOQ, and custom evaluation criteria.</p></section>
            <section><h2>2. Evaluation Method</h2><p>The system organized submitted works documents, methodology, work program, personnel, equipment, HSE evidence, site response, BOQ, and scoring records. The buyer manually recorded all decisions.</p></section>
            <section><h2>3. Evaluation Criteria Used</h2><p>${criteria.map(formatEvaluationCriterionReportSummary).map(escapeEvaluationHtml).join('; ') || 'No custom evaluation criteria available.'}</p></section>

            <section>
                <h2>4. Bid Opening Register</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Contractor</th><th>Submitted</th><th>Receipt</th><th>Price</th><th>Bid security</th><th>Status</th><th>Remark</th></tr></thead><tbody>
                    ${bids.map((bid, index) => {
                        const contractor = getWorksEvaluationContractorKey(bid, index);
                        const row = worksDraft.opening?.[contractor] || {};
                        return `<tr><td>${escapeEvaluationHtml(contractor)}</td><td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td><td>${escapeEvaluationHtml(bid.integrityHash || '-')}</td><td>${formatEvaluationMoney(getWorksEvaluationFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td><td>${escapeEvaluationHtml(row.bidSecurityStatus || '-')}</td><td>${escapeEvaluationHtml(row.status || 'Opened')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>5. Administrative & Eligibility Evaluation</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Contractor</th><th>Requirement</th><th>Decision</th><th>Remark</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const contractor = getWorksEvaluationContractorKey(bid, index);
                        return adminItems.map(item => {
                            const row = worksDraft.administrative?.[contractor]?.[item.id] || {};
                            return `<tr><td>${escapeEvaluationHtml(contractor)}</td><td>${escapeEvaluationHtml(item.title)}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>6. Custom Evaluation Criteria</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Contractor</th><th>Criterion</th><th>Type</th><th>Buyer Decision</th><th>Buyer Score</th><th>Comment</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const contractor = getWorksEvaluationContractorKey(bid, index);
                        return criteria.map(criterion => {
                            const row = getWorksCriterionSaved(worksDraft, contractor, criterion.id);
                            return `<tr><td>${escapeEvaluationHtml(contractor)}</td><td>${escapeEvaluationHtml(criterion.name)}</td><td>${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.score || '-')}${criterion.maxScore ? ` / ${escapeEvaluationHtml(criterion.maxScore)}` : ''}</td><td>${escapeEvaluationHtml(row.comment || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section><h2>7. Financial Review</h2><p>BOQ checks, arithmetic corrections, abnormal rate review, financial document review, and evaluated price details are recorded separately from scoring. Price is scored only where the buyer published a custom financial criterion.</p></section>
            ${renderEvaluationFinancialDocumentReportSection(tender, bids, {
                title: '8. Financial Documents Reviewed',
                getOwner: getWorksEvaluationContractorKey,
                getSavedDocuments: contractor => worksDraft.boqFinancialReview?.[contractor]?.documents || {}
            })}

            <section>
                <h2>9. Post-Qualification</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Contractor</th><th>Result</th><th>Remark</th></tr></thead><tbody>
                    ${bids.map((bid, index) => {
                        const contractor = getWorksEvaluationContractorKey(bid, index);
                        const row = worksDraft.postQualification?.[contractor] || {};
                        return `<tr><td>${escapeEvaluationHtml(contractor)}</td><td>${escapeEvaluationHtml(row.result || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>10. Final Ranking and Award Recommendation</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Rank</th><th>Contractor</th><th>Sections status</th><th>Weighted Score</th><th>Evaluated Price</th><th>Recommendation</th><th>Reason</th></tr></thead><tbody>
                    ${rankingRows.map((row, index) => `<tr><td>${row.score === null ? '-' : index + 1}</td><td>${escapeEvaluationHtml(row.contractor)}</td><td>${escapeEvaluationHtml(row.sectionsStatus)}</td><td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td><td>${formatEvaluationMoney(row.price, row.currency)}</td><td>${escapeEvaluationHtml(normalizeEvaluationRecommendation(row.ranking.recommendation) || 'Pending')}</td><td>${escapeEvaluationHtml(row.ranking.reason || '-')}</td></tr>`).join('')}
                </tbody></table></div>
                <p><strong>Recommended for award:</strong> ${escapeEvaluationHtml(recommendation.supplier || 'Pending buyer recommendation')}</p>
            </section>

            <section><h2>11. Rejected Bidders and Reasons</h2><p>${rankingRows.filter(row => normalizeEvaluationRecommendation(row.ranking.recommendation) === 'Rejected').map(row => `${row.contractor}: ${row.ranking.reason || 'No reason recorded'}`).map(escapeEvaluationHtml).join('; ') || 'No rejected contractors recorded yet.'}</p></section>
            <section><h2>12. Buyer Declaration</h2><p>I confirm that the submitted works bids were reviewed manually against the published tender requirements and custom evaluation criteria. The system organized the submitted documents, BOQ, technical proposal, and scoring records, but the evaluation decision was made by the buyer.</p></section>
            <section><h2>13. Attachments Reviewed</h2><p>Administrative documents, methodology, work program, drawings acknowledgement, site response, personnel CVs, equipment proof, HSE evidence, financial documents, and BOQ where available in the submitted bid package.</p></section>
        </div>
    `;
}

function renderWorksActiveStage(tender = {}, bids = [], supplierIndex = 0, activeStageId = 'opening', draft = {}) {
    const worksDraft = getWorksEvaluationDraft(draft);
    const bid = bids[supplierIndex] || {};
    if (activeStageId === 'opening') return renderWorksOpeningRegister(tender, bids, worksDraft);
    if (activeStageId === 'administrative') return renderWorksAdministrativeReview(tender, bid, supplierIndex, worksDraft);
    if (activeStageId === 'criteria') return renderWorksCriteriaEvaluation(tender, bid, supplierIndex, worksDraft);
    if (activeStageId === 'boq') return renderWorksBoqFinancialReview(tender, bid, supplierIndex, worksDraft);
    if (activeStageId === 'postqual') return renderWorksPostQualification(tender, bid, supplierIndex, worksDraft);
    if (activeStageId === 'ranking') return renderWorksRanking(tender, bids, worksDraft);
    return renderWorksEvaluationReportDocument(tender, bids, draft);
}

function renderWorksBidEvaluationWorkspace(tender = {}) {
    const bids = getEvaluationBidsForTender(tender);
    const draft = getEvaluationDraft(tender.reference) || {};
    const worksDraft = getWorksEvaluationDraft(draft);
    const stages = getWorksEvaluationStages();
    const savedStageId = worksDraft.currentStageId || 'opening';
    const activeStageId = stages.some(stage => stage.id === savedStageId) ? savedStageId : 'opening';
    const supplierIndex = Math.min(Math.max(Number(draft.currentSupplierIndex || worksDraft.currentSupplierIndex || 0), 0), Math.max(0, bids.length - 1));
    const completion = getWorksEvaluationCompletion(tender, bids, draft);
    const criteria = getEvaluationCriteriaForTender(tender);

    if (!bids.length) {
        return renderEvaluationShell(`
            <section class="procurement-hero evaluation-hero-panel">
                <div>
                    <span class="section-kicker">Works Bid Evaluation Workspace</span>
                    <h1>${escapeEvaluationHtml(tender.title)}</h1>
                    <p>No submitted works bid package is available for this tender in the current browser or mock data.</p>
                </div>
                <div class="evaluation-hero-stats">
                    <div><strong>0</strong><span>Bids available</span></div>
                    <div><strong>${criteria.length}</strong><span>Published criteria</span></div>
                </div>
            </section>
        `, 'Works Evaluation', tender.reference);
    }

    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Works Bid Evaluation Workspace</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Manual evaluation of submitted works bids using the buyer's published criteria, tender requirements, BOQ, drawings, methodology, personnel, and equipment.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(tender.reference)}</strong><span>Reference number</span></div>
                <div><strong>Works</strong><span>Procurement type</span></div>
                <div><strong>${escapeEvaluationHtml(getWorksEvaluationContractType(tender))}</strong><span>Contract type</span></div>
                <div><strong>${completion.percent}%</strong><span>Evaluation status</span></div>
            </div>
        </section>

        <section class="evaluation-top-summary">
            <div><span>Evaluation mode</span><strong>Manual Buyer Review</strong></div>
            <div><span>Criteria source</span><strong>Published Tender Criteria</strong></div>
            <div><span>Buyer criteria</span><strong>${criteria.length}</strong></div>
            <div><span>Bids opened</span><strong>${bids.length}</strong></div>
            <div><span>Current stage</span><strong>${escapeEvaluationHtml((stages.find(stage => stage.id === activeStageId) || stages[0]).label)}</strong></div>
        </section>

        <section class="procurement-panel evaluation-panel works-evaluation-workspace" data-evaluation-workspace="${escapeEvaluationHtml(tender.reference)}" data-current-supplier-index="${supplierIndex}" data-current-works-stage="${escapeEvaluationHtml(activeStageId)}">
            <div class="evaluation-notice warning">This evaluation uses the criteria configured by the buyer during tender creation. The system organizes bid information and calculates totals only. The buyer makes all evaluation decisions manually.</div>
            ${renderWorksContractorTabs(bids, supplierIndex)}
            <div class="evaluation-progress-track evaluation-workspace-progress"><span style="width: ${completion.percent}%"></span></div>
            <div class="evaluation-review-grid">
                ${renderWorksStageRail(stages, activeStageId)}
                <div class="evaluation-review-main">
                    ${renderWorksActiveStage(tender, bids, supplierIndex, activeStageId, draft)}
                </div>
            </div>
            <div class="evaluation-finish-panel">
                <div>
                    <span class="section-kicker">Complete works evaluation</span>
                    <h3>${completion.canComplete ? 'Ready for buyer completion' : 'Complete all works decisions and recommendation'}</h3>
                    <p>${completion.complete} of ${completion.total} required checks are complete. Ranking and award recommendation remain manual buyer decisions.</p>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(tender.reference)}">Preview Report</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</button>
                    <button class="btn btn-primary" type="button" data-evaluation-complete="${escapeEvaluationHtml(tender.reference)}" ${completion.canComplete ? '' : 'disabled'}>Complete Evaluation</button>
                </div>
            </div>
        </section>
    `, 'Works Evaluation', tender.reference);
}

function getServiceEvaluationStages() {
    return [
        { id: 'opening', label: 'Opening Register' },
        { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
        { id: 'criteria', label: 'Custom Evaluation Criteria' },
        { id: 'pricing', label: 'Service Pricing Review' },
        { id: 'sla', label: 'SLA / Performance Review' },
        { id: 'postqual', label: 'Post-Qualification' },
        { id: 'ranking', label: 'Final Ranking' },
        { id: 'report', label: 'Evaluation Report' }
    ];
}

function getServiceEvaluationDraft(draft = {}) {
    return draft.services && typeof draft.services === 'object' ? draft.services : {};
}

function getServiceProviderKey(bid = {}, index = 0) {
    return bid.supplier || `Service Provider ${index + 1}`;
}

function getServiceFinancialAmount(bid = {}) {
    return Number(bid.financial?.correctedPrice || bid.price || 0) || 0;
}

function getServiceCategory(tender = {}) {
    const source = tender.sourceTender || tender;
    return source.requirements?.fields?.serviceCategory || source.category || source.type || 'Non Consultancy';
}

function getServicePricingRows(tender = {}, bid = {}) {
    const submittedRows = bid.draft?.financialOfferRows || bid.submittedBid?.draft?.financialOfferRows || [];
    if (submittedRows.length) return submittedRows;
    const source = tender.sourceTender || tender;
    const fields = source.requirements?.fields || {};
    return fields.serviceBoqRows?.length
        ? fields.serviceBoqRows
        : (fields.commercialItems || source.commercialItems || source.boqItems || []);
}

function getServiceAdministrativeItems(tender = {}) {
    const source = tender.sourceTender || tender;
    const requirementSet = getEvaluationRequirementSet(source);
    const licenseItems = (source.regulatoryLicenses || []).map((license, index) => ({
        id: `service-license-${index}`,
        title: license.license || license.registrationType || license.regulatoryBody || 'Professional / service license',
        mandatory: license.mandatory !== false,
        source: license.body || license.group || 'Regulatory license'
    }));
    const requiredDocs = [
        ...(source.requiredSubmissionDocuments || []),
        ...(source.requirements?.fields?.supportingDocumentRows || []).map(item => item.documentName || item.name),
        ...(source.requirements?.fields?.otherEligibilityRequirements || []).map(item => item.requirementName || item.text || item.name),
        ...(requirementSet.mandatory || [])
            .filter(item => /license|certificate|tax|registration|insurance|professional|permit|signed|form|power|attorney|past service|audited|eligibility|declaration|document/i.test(`${item.title} ${item.category}`))
            .map(item => item.title)
    ].filter(Boolean);
    const docItems = Array.from(new Set(requiredDocs)).map((title, index) => ({
        id: `service-admin-${slugEvaluationId(title)}-${index}`,
        title,
        mandatory: true,
        source: 'Published tender requirement'
    }));
    return [...licenseItems, ...docItems].length ? [...licenseItems, ...docItems] : [
        { id: 'service-admin-license', title: 'Business license', mandatory: true, source: 'Default service responsiveness check' },
        { id: 'service-admin-tax', title: 'Tax clearance certificate', mandatory: true, source: 'Default service responsiveness check' },
        { id: 'service-admin-insurance', title: 'Insurance certificate where applicable', mandatory: true, source: 'Default service responsiveness check' },
        { id: 'service-admin-signed-form', title: 'Signed bid form', mandatory: true, source: 'Default service responsiveness check' }
    ];
}

function getServiceSlaItems(tender = {}) {
    const source = tender.sourceTender || tender;
    const fields = source.requirements?.fields || {};
    const kpis = (fields.serviceKpiRows || fields.kpiRows || []).map((item, index) => ({
        id: `service-kpi-${index}`,
        item: item.kpiName || item.metric || item.text || `KPI ${index + 1}`,
        requirement: item.target || item.requirement || item.description || 'As stated in tender'
    }));
    return kpis.length ? kpis : [
        { id: 'service-sla-response-time', item: 'Response time', requirement: fields.responseTime || fields.slaRequirement || 'As stated in tender' },
        { id: 'service-sla-support-hours', item: 'Support hours', requirement: fields.supportHours || 'As stated in tender' },
        { id: 'service-sla-reporting', item: 'Reporting', requirement: fields.reportingRequirements || 'As stated in tender' },
        { id: 'service-sla-uptime', item: 'Uptime / availability', requirement: fields.uptimeRequirement || 'As stated in tender' }
    ];
}

function getServicePostQualItems(tender = {}) {
    const criteria = getEvaluationCriteriaForTender(tender)
        .filter(criterion => /post|qualification|capacity|experience|staff|personnel|equipment|tools|local|sla|insurance|financial capacity|continuity|support/i.test(`${criterion.name} ${criterion.category} ${criterion.subcriteria.join(' ')}`));
    if (criteria.length) {
        return criteria.map(criterion => ({
            id: `service-postqual-${criterion.id}`,
            title: criterion.name,
            source: 'Buyer-defined criterion',
            evidenceRequired: criterion.evidenceRequired || []
        }));
    }
    return [
        { id: 'service-postqual-legal', title: 'Legal capacity, licenses, and permits remain valid', source: 'Manual service post-qualification checklist' },
        { id: 'service-postqual-experience', title: 'Similar service experience is verified', source: 'Manual service post-qualification checklist' },
        { id: 'service-postqual-staff', title: 'Enough qualified staff are available', source: 'Manual service post-qualification checklist' },
        { id: 'service-postqual-tools', title: 'Equipment, tools, materials, or systems are available', source: 'Manual service post-qualification checklist' },
        { id: 'service-postqual-sla', title: 'SLA, supervision, insurance, and continuity capacity are acceptable', source: 'Manual service post-qualification checklist' }
    ];
}

function getServiceCriterionSaved(serviceDraft = {}, provider = '', criterionId = '') {
    return serviceDraft.criteriaEvaluation?.[provider]?.[criterionId] || {};
}

function getServicePricingStatus(serviceDraft = {}, provider = '') {
    return serviceDraft.pricingReview?.[provider]?.status || '';
}

function isServiceCriterionComplete(row = {}, criterion = {}) {
    return isGoodsCriterionComplete(row, criterion);
}

function isServiceAdministrativeComplete(row = {}) {
    return isGoodsAdministrativeComplete(row);
}

function isServiceRankingDecisionComplete(row = {}) {
    return isGoodsRankingDecisionComplete(row);
}

function isServiceSlaComplete(row = {}) {
    if (!row.decision) return false;
    if (isGoodsManualDecisionNegative(row.decision) && !String(row.remark || '').trim()) return false;
    return true;
}

function isServicePriorSectionsComplete(tender = {}, provider = '', serviceDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getServiceAdministrativeItems(tender);
    const slaItems = getServiceSlaItems(tender);
    const adminDone = adminItems.every(item => isServiceAdministrativeComplete(serviceDraft.administrative?.[provider]?.[item.id] || {}));
    const criteriaDone = criteria.every(criterion => isServiceCriterionComplete(getServiceCriterionSaved(serviceDraft, provider, criterion.id), criterion));
    const pricingDone = Boolean(getServicePricingStatus(serviceDraft, provider));
    const slaDone = slaItems.every(item => isServiceSlaComplete(serviceDraft.slaPerformanceReview?.[provider]?.[item.id] || {}));
    const postDone = Boolean(serviceDraft.postQualification?.[provider]?.result);
    return adminDone && criteriaDone && pricingDone && slaDone && postDone;
}

function hasServiceFailedGate(serviceDraft = {}, provider = '', criteria = []) {
    return criteria.some(criterion => {
        if (!criterion.passFailGate && !criterion.mandatory) return false;
        const row = getServiceCriterionSaved(serviceDraft, provider, criterion.id);
        return /fail|rejected|non-responsive|non-compliant|major deviation/i.test(row.decision || '');
    });
}

function hasServiceFailedAdministrativeGate(serviceDraft = {}, provider = '', tender = {}) {
    return getServiceAdministrativeItems(tender).some(item => {
        if (item.mandatory === false) return false;
        const row = serviceDraft.administrative?.[provider]?.[item.id] || {};
        return /fail|rejected|non-responsive/i.test(row.decision || '');
    });
}

function hasServiceBlockingReview(serviceDraft = {}, provider = {}, tender = {}) {
    const pricingStatus = getServicePricingStatus(serviceDraft, provider);
    const postResult = serviceDraft.postQualification?.[provider]?.result || '';
    const slaFailed = getServiceSlaItems(tender).some(item => /fail|rejected|non-responsive/i.test(serviceDraft.slaPerformanceReview?.[provider]?.[item.id]?.decision || ''));
    return /non-responsive|fail|abnormally low/i.test(pricingStatus) || /not qualified/i.test(postResult) || slaFailed;
}

function getServiceProviderScore(serviceDraft = {}, provider = '', criteria = []) {
    return getEvaluationWeightedScore(criteria, criterion => getServiceCriterionSaved(serviceDraft, provider, criterion.id));
}

function getServiceProviderMaxScore(criteria = []) {
    return getGoodsSupplierMaxScore(criteria);
}

function getServiceManualRecommendation(tender = {}, bids = [], draft = {}) {
    const services = getServiceEvaluationDraft(draft);
    const recommended = bids.map((bid, index) => {
        const provider = getServiceProviderKey(bid, index);
        return { bid, provider, row: services.ranking?.[provider] || {} };
    }).find(item => normalizeEvaluationRecommendation(item.row.recommendation) === 'Recommended for award');
    if (!recommended) return { supplier: '', amount: 0, currency: 'TZS', reason: '' };
    return {
        supplier: recommended.provider,
        amount: recommended.bid.financial?.correctedPrice || recommended.bid.price || 0,
        currency: recommended.bid.financial?.currency || 'TZS',
        reason: recommended.row.reason || 'Recommended manually by the buyer after completing the service evaluation record.'
    };
}

function getServiceEvaluationCompletion(tender = {}, bids = [], draft = {}) {
    const services = getServiceEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getServiceAdministrativeItems(tender);
    const slaItems = getServiceSlaItems(tender);
    const total = bids.length * (criteria.length + adminItems.length + slaItems.length + 3);
    let hasRecommendation = false;
    const complete = bids.reduce((sum, bid, index) => {
        const provider = getServiceProviderKey(bid, index);
        const ranking = services.ranking?.[provider] || {};
        if (normalizeEvaluationRecommendation(ranking.recommendation) === 'Recommended for award') hasRecommendation = true;
        const adminDone = adminItems.filter(item => isServiceAdministrativeComplete(services.administrative?.[provider]?.[item.id] || {})).length;
        const criteriaDone = criteria.filter(criterion => isServiceCriterionComplete(getServiceCriterionSaved(services, provider, criterion.id), criterion)).length;
        const slaDone = slaItems.filter(item => isServiceSlaComplete(services.slaPerformanceReview?.[provider]?.[item.id] || {})).length;
        const pricingDone = getServicePricingStatus(services, provider) ? 1 : 0;
        const postDone = services.postQualification?.[provider]?.result ? 1 : 0;
        const rankingDone = isServiceRankingDecisionComplete(ranking) ? 1 : 0;
        return sum + adminDone + criteriaDone + slaDone + pricingDone + postDone + rankingDone;
    }, 0);
    return { total, complete, percent: total ? Math.round((complete / total) * 100) : 0, canComplete: total > 0 && complete >= total && hasRecommendation };
}

function getServiceEvidencePanel(tender = {}, bid = {}, bidderIndex = 0, labels = [], options = {}) {
    const evidence = findEvaluationEvidenceForRequirement(getEvaluationBidEvidenceRows(tender, bid, bidderIndex), { title: labels.join(' '), labels }, options);
    return `
        <aside class="service-evidence-panel goods-evidence-panel">
            <strong>Submitted Service Evidence</strong>
            ${evidence.length ? evidence.map(item => `
                <article class="evaluation-evidence-item">
                    <span>${escapeEvaluationHtml(item.section || 'Evidence')}</span>
                    <p>${escapeEvaluationHtml(item.label || '')}: ${escapeEvaluationHtml(item.value || item.file || 'Provided')}</p>
                    ${renderEvaluationEvidenceDocumentActions(item)}
                </article>
            `).join('') : '<p>No matching submitted evidence was found. Review the available service bid package and record the buyer decision manually.</p>'}
        </aside>
    `;
}

function renderServiceProviderTabs(bids = [], activeIndex = 0) {
    return `
        <div class="service-provider-tabs goods-bidder-tabs" role="tablist" aria-label="Service providers">
            ${bids.map((bid, index) => `
                <button class="service-provider-tab goods-bidder-tab ${index === activeIndex ? 'active' : ''}" type="button" data-service-provider-index="${index}">
                    <strong>${escapeEvaluationHtml(bid.supplier || `Service Provider ${index + 1}`)}</strong>
                    <span>${escapeEvaluationHtml(bid.preliminaryResult || bid.finalResult || 'Under review')}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderServiceStageRail(stages = [], activeStageId = '') {
    return renderEvaluationStageWorkflow(stages, activeStageId, 'data-service-stage', 'Service evaluation stages');
}

function renderServiceOpeningRegister(tender = {}, bids = [], serviceDraft = {}) {
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Bid opening register</span>
                    <h2>Open submitted service bids</h2>
                    <p>Record read-out price, service duration offered, opening status, and buyer remark. This stage does not evaluate providers.</p>
                </div>
                ${renderEvaluationStatusBadge('Manual Buyer Evaluation')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="service-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Service Provider</th><th>Submitted At</th><th>Receipt No.</th><th>Read-out Price</th><th>Service Duration</th><th>Status</th><th>Opening Remark</th></tr></thead>
                    <tbody>
                        ${bids.map((bid, index) => {
                            const provider = getServiceProviderKey(bid, index);
                            const saved = serviceDraft.opening?.[provider] || {};
                            return `
                                <tr data-service-opening-row data-provider="${escapeEvaluationHtml(provider)}">
                                    <td>${escapeEvaluationHtml(provider)}</td>
                                    <td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td>
                                    <td>${escapeEvaluationHtml(bid.integrityHash || bid.submittedBid?.receiptHash || '-')}</td>
                                    <td>${formatEvaluationMoney(getServiceFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td>
                                    <td><input class="form-input" data-service-opening-duration value="${escapeEvaluationHtml(saved.serviceDurationOffered || '')}" placeholder="e.g. 12 months"></td>
                                    <td><select class="form-input" data-service-opening-status>${['Sealed', 'Opened', 'Late Submission', 'Withdrawn', 'Rejected at Opening', 'Accepted for Evaluation'].map(option => `<option ${String(saved.status || 'Opened') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-service-opening-remark value="${escapeEvaluationHtml(saved.remark || 'Opening record captured')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderServiceAdministrativeReview(tender = {}, bid = {}, bidderIndex = 0, serviceDraft = {}) {
    const provider = getServiceProviderKey(bid, bidderIndex);
    const items = getServiceAdministrativeItems(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Administrative & Eligibility Evaluation</span>
                    <h2>${escapeEvaluationHtml(provider)}</h2>
                    <p>Check mandatory service documents and eligibility. The system can show submitted evidence, but the buyer records every decision manually.</p>
                </div>
                ${renderEvaluationStatusBadge('Buyer Decision')}
            </div>
            <div class="service-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = serviceDraft.administrative?.[provider]?.[item.id] || {};
                    return `
                        <article class="service-evaluation-card goods-evaluation-card" data-service-admin-row data-provider="${escapeEvaluationHtml(provider)}" data-admin-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${item.mandatory ? 'Mandatory' : 'Optional'}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                <p>${escapeEvaluationHtml(item.source || 'Published tender requirement')}</p>
                            </div>
                            ${getServiceEvidencePanel(tender, bid, bidderIndex, [item.title], { strict: true, limit: 1 })}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-service-admin-decision>${['', 'Pass', 'Fail', 'Not Applicable', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-service-admin-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderServiceCriteriaEvaluation(tender = {}, bid = {}, bidderIndex = 0, serviceDraft = {}) {
    const provider = getServiceProviderKey(bid, bidderIndex);
    const criteria = getEvaluationCriteriaForTender(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Criteria from Published Tender</span>
                    <h2>Custom Evaluation Criteria</h2>
                    <p>Evaluation criteria loaded from this tender. Service evidence supports the review but does not become fixed scoring criteria.</p>
                </div>
                ${renderEvaluationStatusBadge(`${criteria.length} criteria`)}
            </div>
            ${renderEvaluationSubmittedBidReportActions(tender, bid, bidderIndex)}
            <div class="evaluation-notice warning">The system organizes service submissions and calculates totals only. Buyer Score and Buyer Decision are entered manually against custom evaluation criteria.</div>
            <div class="service-evaluation-card-list goods-evaluation-card-list">
                ${criteria.map((criterion, index) => {
                    const saved = getServiceCriterionSaved(serviceDraft, provider, criterion.id);
                    const isGate = criterion.passFailGate || /pass_fail|document_check/.test(criterion.evaluationType);
                    const decisionOptions = getGoodsCriterionDecisionOptions(criterion);
                    return `
                        <article class="service-evaluation-card goods-evaluation-card" data-service-criterion-row data-provider="${escapeEvaluationHtml(provider)}" data-criterion-id="${escapeEvaluationHtml(criterion.id)}" data-criterion-type="${escapeEvaluationHtml(criterion.evaluationType)}">
                            <div>
                                <span class="section-kicker">Criterion ${index + 1} / ${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</span>
                                <h3>${escapeEvaluationHtml(criterion.name)}</h3>
                                <p>${escapeEvaluationHtml(criterion.description || criterion.subcriteria.join(', ') || 'Buyer-defined criterion.')}</p>
                                <div class="goods-criterion-meta service-criterion-meta">
                                    <span>Weight: ${escapeEvaluationHtml(criterion.weight || 0)}</span>
                                    <span>Max score: ${escapeEvaluationHtml(criterion.maxScore || 0)}</span>
                                    ${criterion.mandatory ? '<span>Mandatory</span>' : ''}
                                    ${criterion.passFailGate ? '<span>Gate</span>' : ''}
                                </div>
                                ${criterion.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(criterion.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getServiceEvidencePanel(tender, bid, bidderIndex, [criterion.name, ...(criterion.subcriteria || []), ...(criterion.evidenceRequired || []), 'methodology', 'personnel', 'SLA', 'schedule', 'tools', 'equipment', 'reports', 'pricing'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-service-criterion-decision>${decisionOptions.map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                ${criterion.maxScore > 0 && !isGate ? `
                                    <label>Buyer Score / ${escapeEvaluationHtml(criterion.maxScore)}
                                        <input class="form-input" type="number" min="0" max="${escapeEvaluationHtml(criterion.maxScore)}" step="0.5" value="${escapeEvaluationHtml(saved.score ?? '')}" data-service-criterion-score>
                                    </label>
                                ` : ''}
                                <label class="wide">Buyer comment
                                    <textarea class="form-input" rows="3" data-service-criterion-comment>${escapeEvaluationHtml(saved.comment || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderServicePricingReview(tender = {}, bid = {}, bidderIndex = 0, serviceDraft = {}) {
    const provider = getServiceProviderKey(bid, bidderIndex);
    const rows = getServicePricingRows(tender, bid);
    const savedReview = serviceDraft.pricingReview?.[provider] || {};
    const amount = getServiceFinancialAmount(bid);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Financial Review, not automatic scoring</span>
                    <h2>Service Pricing Review</h2>
                    <p>Check service rates, duration, totals, taxes, discounts, completeness, arithmetic, and financial documents. Financial scoring stays in custom criteria.</p>
                </div>
                ${renderEvaluationStatusBadge(formatEvaluationMoney(amount, bid.financial?.currency || 'TZS'))}
            </div>
            <div class="evaluation-financial-review">
                <div><span>Read-out price</span><strong>${formatEvaluationMoney(bid.price || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Corrected price</span><strong>${formatEvaluationMoney(bid.financial?.correctedPrice || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Pricing status</span><strong>${escapeEvaluationHtml(bid.financial?.pricingStatus || 'Pending buyer review')}</strong></div>
                <div><span>Discount</span><strong>${escapeEvaluationHtml(bid.financial?.discount || 'None recorded')}</strong></div>
            </div>
            ${renderEvaluationFinancialDocumentReview(tender, bid, bidderIndex, { scope: 'services', owner: provider, savedDocuments: savedReview.documents || {} })}
            <div class="evaluation-form-grid service-pricing-status" data-service-pricing-result data-provider="${escapeEvaluationHtml(provider)}">
                <label>Financial review result
                    <select class="form-input" data-service-pricing-status>${['', 'Financially Responsive', 'Financially Non-responsive', 'Arithmetic Correction Required', 'Clarification Required', 'Abnormally Low Price Review Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${savedReview.status === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select result')}</option>`).join('')}</select>
                </label>
                <label>Overall pricing remark
                    <textarea class="form-input" rows="3" data-service-pricing-overall>${escapeEvaluationHtml(savedReview.remark || '')}</textarea>
                </label>
            </div>
            <div class="evaluation-table-scroll">
                <table class="service-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Service line</th><th>Unit</th><th>Quantity</th><th>Duration</th><th>Rate</th><th>Tax</th><th>Discount</th><th>Total</th><th>Buyer check</th><th>Remark</th></tr></thead>
                    <tbody>
                        ${(rows.length ? rows : [{ description: 'Service financial offer total', qty: 1, unit: 'Lot', rate: amount, total: amount }]).map((item, index) => {
                            const saved = savedReview.lines?.[`line-${index}`] || {};
                            const qty = Number(item.quantity || item.qty || 1) || 1;
                            const rate = Number(item.rate || item.unitPrice || item.amount || 0) || 0;
                            const total = item.total || item.amount || (rate ? qty * rate : amount);
                            return `
                                <tr data-service-pricing-row data-provider="${escapeEvaluationHtml(provider)}" data-line-id="line-${index}">
                                    <td>${escapeEvaluationHtml(item.description || item.serviceTask || item.itemDescription || `Service line ${index + 1}`)}</td>
                                    <td>${escapeEvaluationHtml(item.unit || item.unitOfMeasure || 'Unit')}</td>
                                    <td>${escapeEvaluationHtml(item.quantity || item.qty || 1)}</td>
                                    <td>${escapeEvaluationHtml(item.duration || item.period || '-')}</td>
                                    <td>${formatEvaluationMoney(rate, bid.financial?.currency || 'TZS')}</td>
                                    <td>${escapeEvaluationHtml(item.tax || '-')}</td>
                                    <td>${escapeEvaluationHtml(item.discount || '-')}</td>
                                    <td>${typeof total === 'number' ? formatEvaluationMoney(total, bid.financial?.currency || 'TZS') : escapeEvaluationHtml(total || '-')}</td>
                                    <td><select class="form-input" data-service-pricing-check>${['', 'Accepted', 'Correction Required', 'Not Priced', 'Clarification Required', 'Abnormally Low/High Price Review'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.check === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select check')}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-service-pricing-remark value="${escapeEvaluationHtml(saved.remark || '')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderServiceSlaReview(tender = {}, bid = {}, bidderIndex = 0, serviceDraft = {}) {
    const provider = getServiceProviderKey(bid, bidderIndex);
    const items = getServiceSlaItems(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">SLA and performance review</span>
                    <h2>${escapeEvaluationHtml(provider)}</h2>
                    <p>Review response time, support hours, reporting, uptime, and service commitments. This is a review area unless the buyer published an SLA criterion.</p>
                </div>
                ${renderEvaluationStatusBadge('Buyer Decision')}
            </div>
            <div class="service-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = serviceDraft.slaPerformanceReview?.[provider]?.[item.id] || {};
                    return `
                        <article class="service-evaluation-card goods-evaluation-card" data-service-sla-row data-provider="${escapeEvaluationHtml(provider)}" data-sla-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">Performance commitment</span>
                                <h3>${escapeEvaluationHtml(item.item)}</h3>
                                <p>Buyer requirement: ${escapeEvaluationHtml(item.requirement || '-')}</p>
                            </div>
                            ${getServiceEvidencePanel(tender, bid, bidderIndex, [item.item, 'SLA', 'response time', 'support hours', 'reporting', 'uptime', 'performance'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-service-sla-decision>${['', 'Pass', 'Fail', 'Clarification Required', 'Not Applicable'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Supplier offer
                                    <input class="form-input" data-service-sla-offer value="${escapeEvaluationHtml(saved.offer || '')}" placeholder="Record submitted offer">
                                </label>
                                <label class="wide">Remark
                                    <textarea class="form-input" rows="3" data-service-sla-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderServicePostQualification(tender = {}, bid = {}, bidderIndex = 0, serviceDraft = {}) {
    const provider = getServiceProviderKey(bid, bidderIndex);
    const items = getServicePostQualItems(tender);
    const result = serviceDraft.postQualification?.[provider]?.result || '';
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Supplier capability / post-qualification</span>
                    <h2>${escapeEvaluationHtml(provider)}</h2>
                    <p>Confirm the provider can deliver the service, staffing, tools, SLA, supervision, insurance, and continuity commitments.</p>
                </div>
                ${renderEvaluationStatusBadge(result || 'Manual review')}
            </div>
            <div class="service-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = serviceDraft.postQualification?.[provider]?.checks?.[item.id] || {};
                    return `
                        <article class="service-evaluation-card goods-evaluation-card" data-service-postqual-row data-provider="${escapeEvaluationHtml(provider)}" data-postqual-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${escapeEvaluationHtml(item.source)}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                ${item.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(item.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getServiceEvidencePanel(tender, bid, bidderIndex, [item.title, ...(item.evidenceRequired || []), 'post qualification', 'staff', 'equipment', 'insurance', 'SLA', 'local presence'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-service-postqual-decision>${['', 'Pass', 'Fail', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-service-postqual-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
            <div class="evaluation-form-grid service-postqual-result" data-service-postqual-result data-provider="${escapeEvaluationHtml(provider)}">
                <label>Final post-qualification result
                    <select class="form-input" data-service-postqual-final>${['', 'Qualified', 'Not Qualified', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${result === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select result')}</option>`).join('')}</select>
                </label>
                <label>Overall remark
                    <textarea class="form-input" rows="3" data-service-postqual-overall>${escapeEvaluationHtml(serviceDraft.postQualification?.[provider]?.remark || '')}</textarea>
                </label>
            </div>
        </section>
    `;
}

function renderServiceRanking(tender = {}, bids = [], serviceDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const maxScore = getServiceProviderMaxScore(criteria);
    const ranked = bids.map((bid, index) => {
        const provider = getServiceProviderKey(bid, index);
        const failedGate = hasServiceFailedGate(serviceDraft, provider, criteria) || hasServiceFailedAdministrativeGate(serviceDraft, provider, tender) || hasServiceBlockingReview(serviceDraft, provider, tender);
        return {
            bid,
            provider,
            failedGate,
            sectionsComplete: isServicePriorSectionsComplete(tender, provider, serviceDraft),
            score: failedGate ? null : getServiceProviderScore(serviceDraft, provider, criteria),
            price: getServiceFinancialAmount(bid),
            saved: serviceDraft.ranking?.[provider] || {}
        };
    }).sort((a, b) => {
        if (a.failedGate !== b.failedGate) return a.failedGate ? 1 : -1;
        return (b.score || 0) - (a.score || 0) || a.price - b.price;
    });
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Final ranking</span>
                    <h2>Calculated from buyer entries</h2>
                    <p>The system totals Buyer Scores and shows whether earlier evaluation sections are complete. The buyer manually confirms award or rejection.</p>
                </div>
                ${renderEvaluationStatusBadge('No automatic winner')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="service-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Rank</th><th>Service Provider</th><th>Sections status</th><th>Weighted Score</th><th>Evaluated Price</th><th>Recommendation</th><th>Reason / override</th></tr></thead>
                    <tbody>
                        ${ranked.map((row, index) => `
                            <tr data-service-ranking-row data-provider="${escapeEvaluationHtml(row.provider)}">
                                <td>${row.failedGate ? '-' : index + 1}</td>
                                <td>${escapeEvaluationHtml(row.provider)}</td>
                                <td>${renderEvaluationSectionCompletionStatus(row.sectionsComplete)}</td>
                                <td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td>
                                <td>${formatEvaluationMoney(row.price, row.bid.financial?.currency || 'TZS')}</td>
                                <td><select class="form-input" data-service-ranking-recommendation>${renderEvaluationRecommendationOptions(row.saved.recommendation)}</select></td>
                                <td><textarea class="form-input" rows="2" data-service-ranking-reason>${escapeEvaluationHtml(row.saved.reason || '')}</textarea></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderServiceEvaluationReportDocument(tender = {}, bids = [], draft = {}) {
    const serviceDraft = getServiceEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getServiceAdministrativeItems(tender);
    const slaItems = getServiceSlaItems(tender);
    const completion = getServiceEvaluationCompletion(tender, bids, draft);
    const recommendation = draft.recommendation || getServiceManualRecommendation(tender, bids, draft);
    const maxScore = getServiceProviderMaxScore(criteria);
    const rankingRows = bids.map((bid, index) => {
        const provider = getServiceProviderKey(bid, index);
        const failedGate = hasServiceFailedGate(serviceDraft, provider, criteria) || hasServiceFailedAdministrativeGate(serviceDraft, provider, tender) || hasServiceBlockingReview(serviceDraft, provider, tender);
        return {
            provider,
            score: failedGate ? null : getServiceProviderScore(serviceDraft, provider, criteria),
            price: getServiceFinancialAmount(bid),
            currency: bid.financial?.currency || 'TZS',
            sectionsStatus: isServicePriorSectionsComplete(tender, provider, serviceDraft) ? 'Completed' : 'Incomplete',
            ranking: serviceDraft.ranking?.[provider] || {}
        };
    }).sort((a, b) => (b.score || 0) - (a.score || 0) || a.price - b.price);

    return `
        <div class="evaluation-report-document service-report-document">
            <header>
                <span>Service Tender Evaluation Report</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>${escapeEvaluationHtml(tender.reference)} / Services procurement / ${escapeEvaluationHtml(getServiceCategory(tender))} / ${escapeEvaluationHtml(draft.status || 'Draft')}</p>
            </header>
            <section class="evaluation-report-summary">
                <div><span>Evaluation method</span><strong>Manual Buyer Evaluation</strong></div>
                <div><span>Criteria source</span><strong>Published tender</strong></div>
                <div><span>Service providers</span><strong>${bids.length}</strong></div>
                <div><span>Completion</span><strong>${completion.complete}/${completion.total}</strong></div>
            </section>

            <section><h2>1. Tender Information</h2><p>${escapeEvaluationHtml(tender.title)} was evaluated against the published service requirements, submitted service responses, pricing schedule, SLA commitments, and custom evaluation criteria.</p></section>
            <section><h2>2. Evaluation Method</h2><p>The system organized submitted documents, service responses, pricing schedules, SLA responses, and scoring records. The buyer manually recorded all decisions.</p></section>
            <section><h2>3. Evaluation Criteria Used</h2><p>${criteria.map(formatEvaluationCriterionReportSummary).map(escapeEvaluationHtml).join('; ') || 'No custom evaluation criteria available.'}</p></section>

            <section>
                <h2>4. Bid Opening Register</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Provider</th><th>Submitted</th><th>Receipt</th><th>Price</th><th>Status</th><th>Remark</th></tr></thead><tbody>
                    ${bids.map((bid, index) => {
                        const provider = getServiceProviderKey(bid, index);
                        const row = serviceDraft.opening?.[provider] || {};
                        return `<tr><td>${escapeEvaluationHtml(provider)}</td><td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td><td>${escapeEvaluationHtml(bid.integrityHash || '-')}</td><td>${formatEvaluationMoney(getServiceFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td><td>${escapeEvaluationHtml(row.status || 'Opened')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>5. Administrative & Eligibility Evaluation</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Provider</th><th>Requirement</th><th>Decision</th><th>Remark</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const provider = getServiceProviderKey(bid, index);
                        return adminItems.map(item => {
                            const row = serviceDraft.administrative?.[provider]?.[item.id] || {};
                            return `<tr><td>${escapeEvaluationHtml(provider)}</td><td>${escapeEvaluationHtml(item.title)}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>6. Custom Evaluation Criteria</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Provider</th><th>Criterion</th><th>Type</th><th>Buyer Decision</th><th>Buyer Score</th><th>Comment</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const provider = getServiceProviderKey(bid, index);
                        return criteria.map(criterion => {
                            const row = getServiceCriterionSaved(serviceDraft, provider, criterion.id);
                            return `<tr><td>${escapeEvaluationHtml(provider)}</td><td>${escapeEvaluationHtml(criterion.name)}</td><td>${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.score || '-')}${criterion.maxScore ? ` / ${escapeEvaluationHtml(criterion.maxScore)}` : ''}</td><td>${escapeEvaluationHtml(row.comment || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section><h2>7. Financial Review</h2><p>Pricing checks, arithmetic corrections, abnormal price review, financial document review, and evaluated price details are recorded separately from scoring. Price is scored only where the buyer published a custom financial criterion.</p></section>
            ${renderEvaluationFinancialDocumentReportSection(tender, bids, {
                title: '8. Financial Documents Reviewed',
                getOwner: getServiceProviderKey,
                getSavedDocuments: provider => serviceDraft.pricingReview?.[provider]?.documents || {}
            })}

            <section>
                <h2>9. SLA and Performance Review</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Provider</th><th>SLA item</th><th>Decision</th><th>Remark</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const provider = getServiceProviderKey(bid, index);
                        return slaItems.map(item => {
                            const row = serviceDraft.slaPerformanceReview?.[provider]?.[item.id] || {};
                            return `<tr><td>${escapeEvaluationHtml(provider)}</td><td>${escapeEvaluationHtml(item.item)}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>10. Post-Qualification / Supplier Capability Review</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Provider</th><th>Result</th><th>Remark</th></tr></thead><tbody>
                    ${bids.map((bid, index) => {
                        const provider = getServiceProviderKey(bid, index);
                        const row = serviceDraft.postQualification?.[provider] || {};
                        return `<tr><td>${escapeEvaluationHtml(provider)}</td><td>${escapeEvaluationHtml(row.result || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>11. Final Ranking</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Rank</th><th>Provider</th><th>Sections status</th><th>Weighted Score</th><th>Evaluated Price</th><th>Recommendation</th><th>Reason</th></tr></thead><tbody>
                    ${rankingRows.map((row, index) => `<tr><td>${row.score === null ? '-' : index + 1}</td><td>${escapeEvaluationHtml(row.provider)}</td><td>${escapeEvaluationHtml(row.sectionsStatus)}</td><td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td><td>${formatEvaluationMoney(row.price, row.currency)}</td><td>${escapeEvaluationHtml(normalizeEvaluationRecommendation(row.ranking.recommendation) || 'Pending')}</td><td>${escapeEvaluationHtml(row.ranking.reason || '-')}</td></tr>`).join('')}
                </tbody></table></div>
            </section>

            <section><h2>12. Award Recommendation</h2><p><strong>Recommended for award:</strong> ${escapeEvaluationHtml(recommendation.supplier || 'Pending buyer recommendation')}</p><p>${escapeEvaluationHtml(recommendation.reason || 'The buyer has not finalized a manual award recommendation yet.')}</p></section>
            <section><h2>13. Rejected Bidders and Reasons</h2><p>${rankingRows.filter(row => normalizeEvaluationRecommendation(row.ranking.recommendation) === 'Rejected').map(row => `${row.provider}: ${row.ranking.reason || 'No reason recorded'}`).map(escapeEvaluationHtml).join('; ') || 'No rejected service providers recorded yet.'}</p></section>
            <section><h2>14. Buyer Declaration</h2><p>I confirm that the submitted service bids were reviewed manually against the published tender requirements and custom evaluation criteria. The system organized the submitted documents, service responses, pricing schedules, and scoring records, but the evaluation decision was made by the buyer.</p></section>
            <section><h2>15. Attachments Reviewed</h2><p>Administrative documents, service methodology, personnel evidence, service schedule, SLA commitments, tools/equipment evidence, financial documents, deliverables, reports, and pricing where available in the submitted bid package.</p></section>
        </div>
    `;
}

function renderServiceActiveStage(tender = {}, bids = [], supplierIndex = 0, activeStageId = 'opening', draft = {}) {
    const serviceDraft = getServiceEvaluationDraft(draft);
    const bid = bids[supplierIndex] || {};
    if (activeStageId === 'opening') return renderServiceOpeningRegister(tender, bids, serviceDraft);
    if (activeStageId === 'administrative') return renderServiceAdministrativeReview(tender, bid, supplierIndex, serviceDraft);
    if (activeStageId === 'criteria') return renderServiceCriteriaEvaluation(tender, bid, supplierIndex, serviceDraft);
    if (activeStageId === 'pricing') return renderServicePricingReview(tender, bid, supplierIndex, serviceDraft);
    if (activeStageId === 'sla') return renderServiceSlaReview(tender, bid, supplierIndex, serviceDraft);
    if (activeStageId === 'postqual') return renderServicePostQualification(tender, bid, supplierIndex, serviceDraft);
    if (activeStageId === 'ranking') return renderServiceRanking(tender, bids, serviceDraft);
    return renderServiceEvaluationReportDocument(tender, bids, draft);
}

function renderServiceBidEvaluationWorkspace(tender = {}) {
    const bids = getEvaluationBidsForTender(tender);
    const draft = getEvaluationDraft(tender.reference) || {};
    const serviceDraft = getServiceEvaluationDraft(draft);
    const stages = getServiceEvaluationStages();
    const activeStageId = serviceDraft.currentStageId || 'opening';
    const supplierIndex = Math.min(Math.max(Number(draft.currentSupplierIndex || serviceDraft.currentSupplierIndex || 0), 0), Math.max(0, bids.length - 1));
    const completion = getServiceEvaluationCompletion(tender, bids, draft);
    const criteria = getEvaluationCriteriaForTender(tender);

    if (!bids.length) {
        return renderEvaluationShell(`
            <section class="procurement-hero evaluation-hero-panel">
                <div>
                    <span class="section-kicker">Service Bid Evaluation Workspace</span>
                    <h1>${escapeEvaluationHtml(tender.title)}</h1>
                    <p>No submitted service bid package is available for this tender in the current browser or mock data.</p>
                </div>
                <div class="evaluation-hero-stats">
                    <div><strong>0</strong><span>Bids available</span></div>
                    <div><strong>${criteria.length}</strong><span>Published criteria</span></div>
                </div>
            </section>
        `, 'Service Evaluation', tender.reference);
    }

    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Service Bid Evaluation Workspace</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Manual evaluation of submitted service bids using the buyer's published criteria, scope of services, personnel requirements, service schedule, service level requirements, and financial offer.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(tender.reference)}</strong><span>Tender reference</span></div>
                <div><strong>Services</strong><span>Procurement type</span></div>
                <div><strong>${escapeEvaluationHtml(getServiceCategory(tender))}</strong><span>Service category</span></div>
                <div><strong>${completion.percent}%</strong><span>Evaluation status</span></div>
            </div>
        </section>

        <section class="evaluation-top-summary">
            <div><span>Evaluation mode</span><strong>Manual Buyer Evaluation</strong></div>
            <div><span>Criteria source</span><strong>Published Tender Criteria</strong></div>
            <div><span>Buyer criteria</span><strong>${criteria.length}</strong></div>
            <div><span>Bids received</span><strong>${bids.length}</strong></div>
            <div><span>Current stage</span><strong>${escapeEvaluationHtml((stages.find(stage => stage.id === activeStageId) || stages[0]).label)}</strong></div>
        </section>

        <section class="procurement-panel evaluation-panel service-evaluation-workspace" data-evaluation-workspace="${escapeEvaluationHtml(tender.reference)}" data-current-supplier-index="${supplierIndex}" data-current-service-stage="${escapeEvaluationHtml(activeStageId)}">
            <div class="evaluation-notice warning">This evaluation uses the criteria configured by the buyer during tender creation. The system organizes service submissions and calculates totals only. The buyer makes all evaluation decisions manually.</div>
            ${renderServiceProviderTabs(bids, supplierIndex)}
            <div class="evaluation-progress-track evaluation-workspace-progress"><span style="width: ${completion.percent}%"></span></div>
            <div class="evaluation-review-grid">
                ${renderServiceStageRail(stages, activeStageId)}
                <div class="evaluation-review-main">
                    ${renderServiceActiveStage(tender, bids, supplierIndex, activeStageId, draft)}
                </div>
            </div>
            <div class="evaluation-finish-panel">
                <div>
                    <span class="section-kicker">Complete service evaluation</span>
                    <h3>${completion.canComplete ? 'Ready for buyer completion' : 'Complete all service decisions and recommendation'}</h3>
                    <p>${completion.complete} of ${completion.total} required checks are complete. Ranking and award recommendation remain manual buyer decisions.</p>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(tender.reference)}">Preview Report</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</button>
                    <button class="btn btn-primary" type="button" data-evaluation-complete="${escapeEvaluationHtml(tender.reference)}" ${completion.canComplete ? '' : 'disabled'}>Complete Evaluation</button>
                </div>
            </div>
        </section>
    `, 'Service Evaluation', tender.reference);
}

function getConsultancyEvaluationStages() {
    return [
        { id: 'opening', label: 'Opening Register' },
        { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
        { id: 'criteria', label: 'Custom Evaluation Criteria' },
        { id: 'tor', label: 'Technical Proposal / TOR Review' },
        { id: 'financial', label: 'Financial Proposal Review' },
        { id: 'ranking', label: 'Selection Method / Ranking' },
        { id: 'postqual', label: 'Post-Qualification' },
        { id: 'report', label: 'Evaluation Report' }
    ];
}

function getConsultancyEvaluationDraft(draft = {}) {
    return draft.consultancy && typeof draft.consultancy === 'object' ? draft.consultancy : {};
}

function getConsultancyKey(bid = {}, index = 0) {
    return bid.supplier || `Consultant ${index + 1}`;
}

function getConsultancyFinancialAmount(bid = {}) {
    return Number(bid.financial?.correctedPrice || bid.price || 0) || 0;
}

function getConsultancySelectionMethod(tender = {}) {
    const source = tender.sourceTender || tender;
    const fields = source.requirements?.fields || {};
    return fields.consultancySelectionMethod || source.selectionMethod || source.evaluation?.method || source.awardMethod || 'Buyer-configured consultancy selection method';
}

function getConsultancyPricingRows(tender = {}, bid = {}) {
    const submittedRows = bid.draft?.financialOfferRows || bid.submittedBid?.draft?.financialOfferRows || [];
    if (submittedRows.length) return submittedRows;
    const source = tender.sourceTender || tender;
    const fields = source.requirements?.fields || {};
    return fields.consultancyPricingRows?.length
        ? fields.consultancyPricingRows
        : (fields.commercialItems || source.commercialItems || source.boqItems || []);
}

function getConsultancyAdministrativeItems(tender = {}) {
    const source = tender.sourceTender || tender;
    const fields = source.requirements?.fields || {};
    const requirementSet = getEvaluationRequirementSet(source);
    const licenseItems = [
        ...(source.regulatoryLicenses || []),
        ...(fields.consultancyRegulatoryLicenses || [])
    ].map((license, index) => ({
        id: `consultancy-license-${index}`,
        title: license.license || license.registrationType || license.regulatoryBody || 'Professional / consultancy registration',
        mandatory: license.mandatory !== false,
        source: license.body || license.group || 'Regulatory license'
    }));
    const requiredDocs = [
        ...(source.requiredSubmissionDocuments || []),
        ...(fields.consultancySupportingDocuments || []).map(item => item.documentName || item.name || item.documentTitle),
        ...(fields.supportingDocumentRows || []).map(item => item.documentName || item.name || item.documentTitle),
        ...(fields.otherEligibilityRequirements || []).map(item => item.requirementName || item.text || item.name),
        ...(requirementSet.mandatory || [])
            .filter(item => /license|certificate|tax|registration|professional|permit|signed|form|power|attorney|cv|eligibility|declaration|document/i.test(`${item.title} ${item.category}`))
            .map(item => item.title)
    ].filter(Boolean);
    const docItems = Array.from(new Set(requiredDocs)).map((title, index) => ({
        id: `consultancy-admin-${slugEvaluationId(title)}-${index}`,
        title,
        mandatory: true,
        source: 'Published tender requirement'
    }));
    return [...licenseItems, ...docItems].length ? [...licenseItems, ...docItems] : [
        { id: 'consultancy-admin-registration', title: 'Professional or firm registration', mandatory: true, source: 'Default consultancy responsiveness check' },
        { id: 'consultancy-admin-tax', title: 'Tax clearance certificate', mandatory: true, source: 'Default consultancy responsiveness check' },
        { id: 'consultancy-admin-technical-proposal', title: 'Signed technical proposal', mandatory: true, source: 'Default consultancy responsiveness check' },
        { id: 'consultancy-admin-financial-envelope', title: 'Separate financial proposal submitted', mandatory: true, source: 'Default consultancy responsiveness check' }
    ];
}

function getConsultancyTorReviewItems(tender = {}) {
    const source = tender.sourceTender || tender;
    const fields = source.requirements?.fields || {};
    return [
        { id: 'tor-understanding', title: 'Understanding of TOR and assignment objectives', requirement: fields.consultancyGeneralObjective || source.description || 'As stated in tender' },
        { id: 'tor-methodology', title: 'Methodology, approach, quality, and risk controls', requirement: getEvaluationValueSummary(fields.consultancyAssignmentActivities) || 'As stated in tender' },
        { id: 'tor-work-plan', title: 'Work plan, activities, deliverables, and timeline', requirement: getEvaluationValueSummary(fields.consultancyDeliverables || fields.consultancyAssignmentBoundaries) || 'As stated in tender' },
        { id: 'tor-reporting', title: 'Reporting, coordination, and knowledge transfer', requirement: getEvaluationValueSummary(fields.consultancyReportingRequirements || fields.consultancyCoordinationArrangements) || 'As stated in tender' },
        { id: 'tor-experts', title: 'Key experts, CVs, qualifications, and similar assignments', requirement: getEvaluationValueSummary(fields.consultancyKeyExperts || fields.consultancyFirmExperience || fields.consultancyIndividualQualifications) || 'As stated in tender' }
    ];
}

function getConsultancyPostQualItems(tender = {}) {
    const criteria = getEvaluationCriteriaForTender(tender)
        .filter(criterion => /post|qualification|capacity|experience|expert|cv|registration|professional|firm|financial capacity|assignment|availability/i.test(`${criterion.name} ${criterion.category} ${criterion.subcriteria.join(' ')}`));
    if (criteria.length) {
        return criteria.map(criterion => ({
            id: `consultancy-postqual-${criterion.id}`,
            title: criterion.name,
            source: 'Buyer-defined criterion',
            evidenceRequired: criterion.evidenceRequired || []
        }));
    }
    return [
        { id: 'consultancy-postqual-legal', title: 'Legal and professional registration remain valid', source: 'Manual consultancy post-qualification checklist' },
        { id: 'consultancy-postqual-experts', title: 'Named experts are available for the assignment', source: 'Manual consultancy post-qualification checklist' },
        { id: 'consultancy-postqual-experience', title: 'Similar assignments and references are verified', source: 'Manual consultancy post-qualification checklist' },
        { id: 'consultancy-postqual-financial', title: 'Financial and operational capacity are acceptable', source: 'Manual consultancy post-qualification checklist' }
    ];
}

function getConsultancyCriterionSaved(consultancyDraft = {}, consultant = '', criterionId = '') {
    return consultancyDraft.criteriaEvaluation?.[consultant]?.[criterionId] || {};
}

function isConsultancyCriterionComplete(row = {}, criterion = {}) {
    return isGoodsCriterionComplete(row, criterion);
}

function isConsultancyAdministrativeComplete(row = {}) {
    return isGoodsAdministrativeComplete(row);
}

function isConsultancyReviewComplete(row = {}) {
    if (!row.status && !row.decision) return false;
    if (isGoodsManualDecisionNegative(row.status || row.decision) && !String(row.remark || '').trim()) return false;
    return true;
}

function isConsultancyRankingDecisionComplete(row = {}, blocked = false) {
    if (!normalizeEvaluationRecommendation(row.recommendation)) return false;
    if (blocked && !String(row.reason || '').trim()) return false;
    return isGoodsRankingDecisionComplete(row);
}

function isConsultancyPriorSectionsComplete(tender = {}, consultant = '', consultancyDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getConsultancyAdministrativeItems(tender);
    const torItems = getConsultancyTorReviewItems(tender);
    const adminDone = adminItems.every(item => isConsultancyAdministrativeComplete(consultancyDraft.administrative?.[consultant]?.[item.id] || {}));
    const criteriaDone = criteria.every(criterion => isConsultancyCriterionComplete(getConsultancyCriterionSaved(consultancyDraft, consultant, criterion.id), criterion));
    const torItemsDone = torItems.every(item => isConsultancyReviewComplete(consultancyDraft.torTechnicalReview?.[consultant]?.items?.[item.id] || {}));
    const torStatusDone = isConsultancyReviewComplete({ status: consultancyDraft.torTechnicalReview?.[consultant]?.status || '', remark: consultancyDraft.torTechnicalReview?.[consultant]?.remark || '' });
    const financialDone = isConsultancyReviewComplete({ status: consultancyDraft.financialProposalReview?.[consultant]?.status || '', remark: consultancyDraft.financialProposalReview?.[consultant]?.remark || '' });
    const postDone = isConsultancyReviewComplete({ status: consultancyDraft.postQualification?.[consultant]?.result || '', remark: consultancyDraft.postQualification?.[consultant]?.remark || '' });
    return adminDone && criteriaDone && torItemsDone && torStatusDone && financialDone && postDone;
}

function hasConsultancyFailedAdministrativeGate(consultancyDraft = {}, consultant = '', tender = {}) {
    return getConsultancyAdministrativeItems(tender).some(item => {
        if (item.mandatory === false) return false;
        const row = consultancyDraft.administrative?.[consultant]?.[item.id] || {};
        return /fail|rejected|non-responsive/i.test(row.decision || '');
    });
}

function hasConsultancyFailedGate(consultancyDraft = {}, consultant = '', criteria = []) {
    return criteria.some(criterion => {
        if (!criterion.passFailGate && !criterion.mandatory) return false;
        const row = getConsultancyCriterionSaved(consultancyDraft, consultant, criterion.id);
        return /fail|rejected|non-responsive|non-compliant|major deviation/i.test(row.decision || '');
    });
}

function hasConsultancyBlockingReview(consultancyDraft = {}, consultant = '', tender = {}) {
    const torStatus = consultancyDraft.torTechnicalReview?.[consultant]?.status || '';
    const financialStatus = consultancyDraft.financialProposalReview?.[consultant]?.status || '';
    const postResult = consultancyDraft.postQualification?.[consultant]?.result || '';
    const torFailed = getConsultancyTorReviewItems(tender).some(item => /fail|rejected|non-responsive/i.test(consultancyDraft.torTechnicalReview?.[consultant]?.items?.[item.id]?.decision || ''));
    return /fail|non-responsive|rejected/i.test(torStatus)
        || /fail|non-responsive|rejected/i.test(financialStatus)
        || /not qualified/i.test(postResult)
        || torFailed;
}

function getConsultancyScore(consultancyDraft = {}, consultant = '', criteria = []) {
    return getEvaluationWeightedScore(criteria, criterion => getConsultancyCriterionSaved(consultancyDraft, consultant, criterion.id));
}

function getConsultancyMaxScore(criteria = []) {
    return getGoodsSupplierMaxScore(criteria);
}

function getConsultancyManualRecommendation(tender = {}, bids = [], draft = {}) {
    const consultancy = getConsultancyEvaluationDraft(draft);
    const recommended = bids.map((bid, index) => {
        const consultant = getConsultancyKey(bid, index);
        return { bid, consultant, row: consultancy.ranking?.[consultant] || {} };
    }).find(item => normalizeEvaluationRecommendation(item.row.recommendation) === 'Recommended for award');
    if (!recommended) return { supplier: '', amount: 0, currency: 'TZS', reason: '' };
    return {
        supplier: recommended.consultant,
        amount: recommended.bid.financial?.correctedPrice || recommended.bid.price || 0,
        currency: recommended.bid.financial?.currency || 'TZS',
        reason: recommended.row.reason || 'Recommended manually by the buyer after completing the consultancy evaluation record.'
    };
}

function getConsultancyCompletion(tender = {}, bids = [], draft = {}) {
    const consultancy = getConsultancyEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getConsultancyAdministrativeItems(tender);
    const torItems = getConsultancyTorReviewItems(tender);
    const total = bids.length * (criteria.length + adminItems.length + torItems.length + 4);
    let hasRecommendation = false;
    const complete = bids.reduce((sum, bid, index) => {
        const consultant = getConsultancyKey(bid, index);
        const ranking = consultancy.ranking?.[consultant] || {};
        const blocked = hasConsultancyFailedAdministrativeGate(consultancy, consultant, tender) || hasConsultancyFailedGate(consultancy, consultant, criteria) || hasConsultancyBlockingReview(consultancy, consultant, tender);
        if (normalizeEvaluationRecommendation(ranking.recommendation) === 'Recommended for award') hasRecommendation = true;
        const adminDone = adminItems.filter(item => isConsultancyAdministrativeComplete(consultancy.administrative?.[consultant]?.[item.id] || {})).length;
        const criteriaDone = criteria.filter(criterion => isConsultancyCriterionComplete(getConsultancyCriterionSaved(consultancy, consultant, criterion.id), criterion)).length;
        const torDone = torItems.filter(item => isConsultancyReviewComplete(consultancy.torTechnicalReview?.[consultant]?.items?.[item.id] || {})).length;
        const torStatusDone = isConsultancyReviewComplete({ status: consultancy.torTechnicalReview?.[consultant]?.status || '', remark: consultancy.torTechnicalReview?.[consultant]?.remark || '' }) ? 1 : 0;
        const financialDone = isConsultancyReviewComplete({ status: consultancy.financialProposalReview?.[consultant]?.status || '', remark: consultancy.financialProposalReview?.[consultant]?.remark || '' }) ? 1 : 0;
        const postDone = isConsultancyReviewComplete({ status: consultancy.postQualification?.[consultant]?.result || '', remark: consultancy.postQualification?.[consultant]?.remark || '' }) ? 1 : 0;
        const rankingDone = isConsultancyRankingDecisionComplete(ranking, blocked) ? 1 : 0;
        return sum + adminDone + criteriaDone + torDone + torStatusDone + financialDone + postDone + rankingDone;
    }, 0);
    return { total, complete, percent: total ? Math.round((complete / total) * 100) : 0, canComplete: total > 0 && complete >= total && hasRecommendation };
}

function getConsultancyEvidencePanel(tender = {}, bid = {}, bidderIndex = 0, labels = [], options = {}) {
    const evidence = findEvaluationEvidenceForRequirement(getEvaluationBidEvidenceRows(tender, bid, bidderIndex), { title: labels.join(' '), labels }, options);
    return `
        <aside class="consultancy-evidence-panel goods-evidence-panel">
            <strong>Submitted Consultancy Evidence</strong>
            ${evidence.length ? evidence.map(item => `
                <article class="evaluation-evidence-item">
                    <span>${escapeEvaluationHtml(item.section || 'Evidence')}</span>
                    <p>${escapeEvaluationHtml(item.label || '')}: ${escapeEvaluationHtml(item.value || item.file || 'Provided')}</p>
                    ${renderEvaluationEvidenceDocumentActions(item)}
                </article>
            `).join('') : '<p>No matching submitted consultancy evidence was found. Review the available proposal package and record the buyer decision manually.</p>'}
        </aside>
    `;
}

function renderConsultancyTabs(bids = [], activeIndex = 0) {
    return `
        <div class="consultancy-consultant-tabs goods-bidder-tabs" role="tablist" aria-label="Consultants">
            ${bids.map((bid, index) => `
                <button class="consultancy-consultant-tab goods-bidder-tab ${index === activeIndex ? 'active' : ''}" type="button" data-consultancy-consultant-index="${index}">
                    <strong>${escapeEvaluationHtml(getConsultancyKey(bid, index))}</strong>
                    <span>${escapeEvaluationHtml(bid.preliminaryResult || bid.finalResult || 'Under review')}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderConsultancyStageRail(stages = [], activeStageId = '') {
    return renderEvaluationStageWorkflow(stages, activeStageId, 'data-consultancy-stage', 'Consultancy evaluation stages');
}

function renderConsultancyOpeningRegister(tender = {}, bids = [], consultancyDraft = {}) {
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Proposal opening register</span>
                    <h2>Open submitted consultancy proposals</h2>
                    <p>Record technical and financial envelope status. This stage records opening only; the buyer evaluates manually in later stages.</p>
                </div>
                ${renderEvaluationStatusBadge('Manual Buyer Evaluation')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="consultancy-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Consultant</th><th>Submitted</th><th>Receipt</th><th>Read-out fee</th><th>Technical proposal</th><th>Financial envelope</th><th>Status</th><th>Opening remark</th></tr></thead>
                    <tbody>
                        ${bids.map((bid, index) => {
                            const consultant = getConsultancyKey(bid, index);
                            const saved = consultancyDraft.opening?.[consultant] || {};
                            return `
                                <tr data-consultancy-opening-row data-consultant="${escapeEvaluationHtml(consultant)}">
                                    <td>${escapeEvaluationHtml(consultant)}</td>
                                    <td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td>
                                    <td>${escapeEvaluationHtml(bid.integrityHash || bid.submittedBid?.receiptHash || '-')}</td>
                                    <td>${formatEvaluationMoney(getConsultancyFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td>
                                    <td><select class="form-input" data-consultancy-opening-technical>${['', 'Opened', 'Not Opened', 'Missing', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.technicalStatus === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select')}</option>`).join('')}</select></td>
                                    <td><select class="form-input" data-consultancy-opening-financial>${['', 'Sealed', 'Opened by Buyer', 'Not Submitted', 'Not Applicable'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${String(saved.financialEnvelopeStatus || 'Sealed') === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select')}</option>`).join('')}</select></td>
                                    <td><select class="form-input" data-consultancy-opening-status>${['Sealed', 'Opened', 'Late Submission', 'Withdrawn', 'Rejected at Opening', 'Accepted for Evaluation'].map(option => `<option ${String(saved.status || 'Opened') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-consultancy-opening-remark value="${escapeEvaluationHtml(saved.remark || 'Opening record captured')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderConsultancyAdministrativeReview(tender = {}, bid = {}, bidderIndex = 0, consultancyDraft = {}) {
    const consultant = getConsultancyKey(bid, bidderIndex);
    const items = getConsultancyAdministrativeItems(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Administrative & Eligibility Evaluation</span>
                    <h2>${escapeEvaluationHtml(consultant)}</h2>
                    <p>Check required registrations, signed forms, proposal files, and eligibility documents. The buyer records all decisions manually.</p>
                </div>
                ${renderEvaluationStatusBadge('Buyer Decision')}
            </div>
            <div class="consultancy-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = consultancyDraft.administrative?.[consultant]?.[item.id] || {};
                    return `
                        <article class="consultancy-evaluation-card goods-evaluation-card" data-consultancy-admin-row data-consultant="${escapeEvaluationHtml(consultant)}" data-admin-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${item.mandatory ? 'Mandatory' : 'Optional'}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                <p>${escapeEvaluationHtml(item.source || 'Published tender requirement')}</p>
                            </div>
                            ${getConsultancyEvidencePanel(tender, bid, bidderIndex, [item.title], { strict: true, limit: 1 })}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-consultancy-admin-decision>${['', 'Pass', 'Fail', 'Not Applicable', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-consultancy-admin-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderConsultancyCriteriaEvaluation(tender = {}, bid = {}, bidderIndex = 0, consultancyDraft = {}) {
    const consultant = getConsultancyKey(bid, bidderIndex);
    const criteria = getEvaluationCriteriaForTender(tender);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Criteria from Published Tender</span>
                    <h2>Custom Evaluation Criteria</h2>
                    <p>These criteria are loaded from the tender. Consultancy evidence supports the review but does not become fixed scoring criteria.</p>
                </div>
                ${renderEvaluationStatusBadge(`${criteria.length} criteria`)}
            </div>
            ${renderEvaluationSubmittedBidReportActions(tender, bid, bidderIndex)}
            <div class="evaluation-notice warning">The system organizes consultancy proposals and calculates totals only. Buyer Score and Buyer Decision are entered manually against custom evaluation criteria.</div>
            <div class="consultancy-evaluation-card-list goods-evaluation-card-list">
                ${criteria.map((criterion, index) => {
                    const saved = getConsultancyCriterionSaved(consultancyDraft, consultant, criterion.id);
                    const isGate = criterion.passFailGate || /pass_fail|document_check/.test(criterion.evaluationType);
                    const decisionOptions = getGoodsCriterionDecisionOptions(criterion);
                    return `
                        <article class="consultancy-evaluation-card goods-evaluation-card" data-consultancy-criterion-row data-consultant="${escapeEvaluationHtml(consultant)}" data-criterion-id="${escapeEvaluationHtml(criterion.id)}" data-criterion-type="${escapeEvaluationHtml(criterion.evaluationType)}">
                            <div>
                                <span class="section-kicker">Criterion ${index + 1} / ${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</span>
                                <h3>${escapeEvaluationHtml(criterion.name)}</h3>
                                <p>${escapeEvaluationHtml(criterion.description || criterion.subcriteria.join(', ') || 'Buyer-defined criterion.')}</p>
                                <div class="goods-criterion-meta consultancy-criterion-meta">
                                    <span>Weight: ${escapeEvaluationHtml(criterion.weight || 0)}</span>
                                    <span>Max score: ${escapeEvaluationHtml(criterion.maxScore || 0)}</span>
                                    ${criterion.mandatory ? '<span>Mandatory</span>' : ''}
                                    ${criterion.passFailGate ? '<span>Gate</span>' : ''}
                                </div>
                                ${criterion.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(criterion.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getConsultancyEvidencePanel(tender, bid, bidderIndex, [criterion.name, ...(criterion.subcriteria || []), ...(criterion.evidenceRequired || []), 'TOR', 'methodology', 'work plan', 'experts', 'CV', 'financial proposal'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-consultancy-criterion-decision>${decisionOptions.map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                ${criterion.maxScore > 0 && !isGate ? `
                                    <label>Buyer Score / ${escapeEvaluationHtml(criterion.maxScore)}
                                        <input class="form-input" type="number" min="0" max="${escapeEvaluationHtml(criterion.maxScore)}" step="0.5" value="${escapeEvaluationHtml(saved.score ?? '')}" data-consultancy-criterion-score>
                                    </label>
                                ` : ''}
                                <label class="wide">Buyer comment
                                    <textarea class="form-input" rows="3" data-consultancy-criterion-comment>${escapeEvaluationHtml(saved.comment || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderConsultancyTorReview(tender = {}, bid = {}, bidderIndex = 0, consultancyDraft = {}) {
    const consultant = getConsultancyKey(bid, bidderIndex);
    const items = getConsultancyTorReviewItems(tender);
    const savedReview = consultancyDraft.torTechnicalReview?.[consultant] || {};
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Technical proposal / TOR review</span>
                    <h2>${escapeEvaluationHtml(consultant)}</h2>
                    <p>Review TOR understanding, methodology, work plan, deliverables, reporting, experts, and experience as supporting evidence. Scoring remains in custom evaluation criteria.</p>
                </div>
                ${renderEvaluationStatusBadge(savedReview.status || 'Buyer Decision')}
            </div>
            <div class="evaluation-form-grid consultancy-review-status" data-consultancy-tor-result data-consultant="${escapeEvaluationHtml(consultant)}">
                <label>Technical / TOR review status
                    <select class="form-input" data-consultancy-tor-status>${['', 'Technically Responsive', 'Technically Non-responsive', 'Clarification Required', 'Accepted with Minor Issues'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${savedReview.status === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select status')}</option>`).join('')}</select>
                </label>
                <label>Overall technical remark
                    <textarea class="form-input" rows="3" data-consultancy-tor-overall>${escapeEvaluationHtml(savedReview.remark || '')}</textarea>
                </label>
            </div>
            <div class="consultancy-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = savedReview.items?.[item.id] || {};
                    return `
                        <article class="consultancy-evaluation-card goods-evaluation-card" data-consultancy-tor-row data-consultant="${escapeEvaluationHtml(consultant)}" data-tor-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">Technical proposal evidence</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                <p>${escapeEvaluationHtml(item.requirement || 'As stated in tender')}</p>
                            </div>
                            ${getConsultancyEvidencePanel(tender, bid, bidderIndex, [item.title, 'TOR', 'methodology', 'work plan', 'deliverable', 'reporting', 'expert', 'CV', 'experience'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-consultancy-tor-decision>${['', 'Pass', 'Fail', 'Clarification Required', 'Not Applicable'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-consultancy-tor-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderConsultancyFinancialReview(tender = {}, bid = {}, bidderIndex = 0, consultancyDraft = {}) {
    const consultant = getConsultancyKey(bid, bidderIndex);
    const rows = getConsultancyPricingRows(tender, bid);
    const savedReview = consultancyDraft.financialProposalReview?.[consultant] || {};
    const amount = getConsultancyFinancialAmount(bid);
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Financial Proposal Review</span>
                    <h2>${escapeEvaluationHtml(getConsultancySelectionMethod(tender))}</h2>
                    <p>Buyer-controlled envelope review. The buyer records opening/review status manually; financial scoring only happens if the tender published a financial criterion.</p>
                </div>
                ${renderEvaluationStatusBadge(formatEvaluationMoney(amount, bid.financial?.currency || 'TZS'))}
            </div>
            <div class="evaluation-financial-review">
                <div><span>Read-out fee</span><strong>${formatEvaluationMoney(bid.price || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Corrected fee</span><strong>${formatEvaluationMoney(bid.financial?.correctedPrice || amount, bid.financial?.currency || 'TZS')}</strong></div>
                <div><span>Selection method</span><strong>${escapeEvaluationHtml(getConsultancySelectionMethod(tender))}</strong></div>
                <div><span>Envelope rule</span><strong>Buyer controlled</strong></div>
            </div>
            ${renderEvaluationFinancialDocumentReview(tender, bid, bidderIndex, { scope: 'consultancy', owner: consultant, savedDocuments: savedReview.documents || {} })}
            <div class="evaluation-form-grid consultancy-financial-status" data-consultancy-financial-result data-consultant="${escapeEvaluationHtml(consultant)}">
                <label>Financial proposal review status
                    <select class="form-input" data-consultancy-financial-status>${['', 'Financially Responsive', 'Financially Non-responsive', 'Arithmetic Correction Required', 'Clarification Required', 'Not Opened / Deferred'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${savedReview.status === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select status')}</option>`).join('')}</select>
                </label>
                <label>Overall financial remark
                    <textarea class="form-input" rows="3" data-consultancy-financial-overall>${escapeEvaluationHtml(savedReview.remark || '')}</textarea>
                </label>
            </div>
            <div class="evaluation-table-scroll">
                <table class="consultancy-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Fee item</th><th>Unit</th><th>Quantity</th><th>Rate</th><th>Tax</th><th>Total</th><th>Buyer check</th><th>Remark</th></tr></thead>
                    <tbody>
                        ${(rows.length ? rows : [{ description: 'Total consultancy financial proposal', qty: 1, unit: 'Lot', rate: amount, total: amount }]).map((item, index) => {
                            const saved = savedReview.lines?.[`line-${index}`] || {};
                            const qty = Number(item.quantity || item.qty || 1) || 1;
                            const rate = Number(item.rate || item.unitPrice || item.amount || 0) || 0;
                            const total = item.total || item.amount || (rate ? qty * rate : amount);
                            return `
                                <tr data-consultancy-financial-row data-consultant="${escapeEvaluationHtml(consultant)}" data-line-id="line-${index}">
                                    <td>${escapeEvaluationHtml(item.description || item.serviceTask || item.itemDescription || `Fee item ${index + 1}`)}</td>
                                    <td>${escapeEvaluationHtml(item.unit || item.unitOfMeasure || 'Unit')}</td>
                                    <td>${escapeEvaluationHtml(item.quantity || item.qty || 1)}</td>
                                    <td>${formatEvaluationMoney(rate, bid.financial?.currency || 'TZS')}</td>
                                    <td>${escapeEvaluationHtml(item.tax || '-')}</td>
                                    <td>${typeof total === 'number' ? formatEvaluationMoney(total, bid.financial?.currency || 'TZS') : escapeEvaluationHtml(total || '-')}</td>
                                    <td><select class="form-input" data-consultancy-financial-check>${['', 'Accepted', 'Correction Required', 'Not Priced', 'Clarification Required', 'Cost Realism Review Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.check === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select check')}</option>`).join('')}</select></td>
                                    <td><input class="form-input" data-consultancy-financial-remark value="${escapeEvaluationHtml(saved.remark || '')}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderConsultancyPostQualification(tender = {}, bid = {}, bidderIndex = 0, consultancyDraft = {}) {
    const consultant = getConsultancyKey(bid, bidderIndex);
    const items = getConsultancyPostQualItems(tender);
    const result = consultancyDraft.postQualification?.[consultant]?.result || '';
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Post-qualification</span>
                    <h2>${escapeEvaluationHtml(consultant)}</h2>
                    <p>Confirm professional registration, expert availability, similar assignments, references, financial capacity, and readiness to perform the assignment.</p>
                </div>
                ${renderEvaluationStatusBadge(result || 'Manual review')}
            </div>
            <div class="consultancy-evaluation-card-list goods-evaluation-card-list">
                ${items.map(item => {
                    const saved = consultancyDraft.postQualification?.[consultant]?.checks?.[item.id] || {};
                    return `
                        <article class="consultancy-evaluation-card goods-evaluation-card" data-consultancy-postqual-row data-consultant="${escapeEvaluationHtml(consultant)}" data-postqual-id="${escapeEvaluationHtml(item.id)}">
                            <div>
                                <span class="section-kicker">${escapeEvaluationHtml(item.source)}</span>
                                <h3>${escapeEvaluationHtml(item.title)}</h3>
                                ${item.evidenceRequired?.length ? `<p>Evidence expected: ${escapeEvaluationHtml(item.evidenceRequired.join(', '))}</p>` : ''}
                            </div>
                            ${getConsultancyEvidencePanel(tender, bid, bidderIndex, [item.title, ...(item.evidenceRequired || []), 'registration', 'expert', 'CV', 'experience', 'financial capacity'])}
                            <div class="evaluation-decision-panel">
                                <label>Buyer Decision
                                    <select class="form-input" data-consultancy-postqual-decision>${['', 'Pass', 'Fail', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${saved.decision === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select decision')}</option>`).join('')}</select>
                                </label>
                                <label>Remark
                                    <textarea class="form-input" rows="3" data-consultancy-postqual-remark>${escapeEvaluationHtml(saved.remark || '')}</textarea>
                                </label>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
            <div class="evaluation-form-grid consultancy-postqual-result" data-consultancy-postqual-result data-consultant="${escapeEvaluationHtml(consultant)}">
                <label>Final post-qualification result
                    <select class="form-input" data-consultancy-postqual-final>${['', 'Qualified', 'Not Qualified', 'Clarification Required'].map(option => `<option value="${escapeEvaluationHtml(option)}" ${result === option ? 'selected' : ''}>${escapeEvaluationHtml(option || 'Select result')}</option>`).join('')}</select>
                </label>
                <label>Overall remark
                    <textarea class="form-input" rows="3" data-consultancy-postqual-overall>${escapeEvaluationHtml(consultancyDraft.postQualification?.[consultant]?.remark || '')}</textarea>
                </label>
            </div>
        </section>
    `;
}

function renderConsultancyRanking(tender = {}, bids = [], consultancyDraft = {}) {
    const criteria = getEvaluationCriteriaForTender(tender);
    const maxScore = getConsultancyMaxScore(criteria);
    const ranked = bids.map((bid, index) => {
        const consultant = getConsultancyKey(bid, index);
        const failedGate = hasConsultancyFailedGate(consultancyDraft, consultant, criteria) || hasConsultancyFailedAdministrativeGate(consultancyDraft, consultant, tender) || hasConsultancyBlockingReview(consultancyDraft, consultant, tender);
        return {
            bid,
            consultant,
            failedGate,
            sectionsComplete: isConsultancyPriorSectionsComplete(tender, consultant, consultancyDraft),
            score: failedGate ? null : getConsultancyScore(consultancyDraft, consultant, criteria),
            price: getConsultancyFinancialAmount(bid),
            saved: consultancyDraft.ranking?.[consultant] || {}
        };
    }).sort((a, b) => {
        if (a.failedGate !== b.failedGate) return a.failedGate ? 1 : -1;
        return (b.score || 0) - (a.score || 0) || a.price - b.price;
    });
    return `
        <section class="evaluation-section-workspace">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Selection Method / Ranking</span>
                    <h2>${escapeEvaluationHtml(getConsultancySelectionMethod(tender))}</h2>
                    <p>The system totals Buyer Scores and shows whether earlier evaluation sections are complete. The buyer manually confirms award or rejection.</p>
                </div>
                ${renderEvaluationStatusBadge('No automatic winner')}
            </div>
            <div class="evaluation-table-scroll">
                <table class="consultancy-evaluation-table goods-evaluation-table">
                    <thead><tr><th>Rank</th><th>Consultant</th><th>Sections status</th><th>Weighted Score</th><th>Evaluated Fee</th><th>Recommendation</th><th>Reason / override</th></tr></thead>
                    <tbody>
                        ${ranked.map((row, index) => `
                            <tr data-consultancy-ranking-row data-consultant="${escapeEvaluationHtml(row.consultant)}" data-blocked="${row.failedGate ? 'true' : 'false'}">
                                <td>${row.failedGate ? '-' : index + 1}</td>
                                <td>${escapeEvaluationHtml(row.consultant)}</td>
                                <td>${renderEvaluationSectionCompletionStatus(row.sectionsComplete)}</td>
                                <td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td>
                                <td>${formatEvaluationMoney(row.price, row.bid.financial?.currency || 'TZS')}</td>
                                <td><select class="form-input" data-consultancy-ranking-recommendation>${renderEvaluationRecommendationOptions(row.saved.recommendation)}</select></td>
                                <td><textarea class="form-input" rows="2" data-consultancy-ranking-reason>${escapeEvaluationHtml(row.saved.reason || '')}</textarea></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderConsultancyEvaluationReportDocument(tender = {}, bids = [], draft = {}) {
    const consultancyDraft = getConsultancyEvaluationDraft(draft);
    const criteria = getEvaluationCriteriaForTender(tender);
    const adminItems = getConsultancyAdministrativeItems(tender);
    const torItems = getConsultancyTorReviewItems(tender);
    const completion = getConsultancyCompletion(tender, bids, draft);
    const recommendation = draft.recommendation || getConsultancyManualRecommendation(tender, bids, draft);
    const maxScore = getConsultancyMaxScore(criteria);
    const rankingRows = bids.map((bid, index) => {
        const consultant = getConsultancyKey(bid, index);
        const failedGate = hasConsultancyFailedGate(consultancyDraft, consultant, criteria) || hasConsultancyFailedAdministrativeGate(consultancyDraft, consultant, tender) || hasConsultancyBlockingReview(consultancyDraft, consultant, tender);
        return {
            consultant,
            score: failedGate ? null : getConsultancyScore(consultancyDraft, consultant, criteria),
            price: getConsultancyFinancialAmount(bid),
            currency: bid.financial?.currency || 'TZS',
            sectionsStatus: isConsultancyPriorSectionsComplete(tender, consultant, consultancyDraft) ? 'Completed' : 'Incomplete',
            ranking: consultancyDraft.ranking?.[consultant] || {}
        };
    }).sort((a, b) => (b.score || 0) - (a.score || 0) || a.price - b.price);

    return `
        <div class="evaluation-report-document consultancy-report-document">
            <header>
                <span>Consultancy Evaluation Report</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>${escapeEvaluationHtml(tender.reference)} / Consultancy / ${escapeEvaluationHtml(getConsultancySelectionMethod(tender))} / ${escapeEvaluationHtml(draft.status || 'Draft')}</p>
            </header>
            <section class="evaluation-report-summary">
                <div><span>Evaluation method</span><strong>Manual Buyer Evaluation</strong></div>
                <div><span>Criteria source</span><strong>Published tender</strong></div>
                <div><span>Consultants</span><strong>${bids.length}</strong></div>
                <div><span>Completion</span><strong>${completion.complete}/${completion.total}</strong></div>
            </section>

            <section><h2>1. Tender Information</h2><p>${escapeEvaluationHtml(tender.title)} was evaluated against the published consultancy TOR, requirements, proposal evidence, financial proposal review, and custom evaluation criteria.</p></section>
            <section><h2>2. Evaluation Method</h2><p>The system organized submitted consultancy proposals and calculated totals from buyer-entered scores only. The buyer manually recorded all decisions and recommendations.</p></section>
            <section><h2>3. Evaluation Criteria Used</h2><p>${criteria.map(formatEvaluationCriterionReportSummary).map(escapeEvaluationHtml).join('; ') || 'No custom evaluation criteria available.'}</p></section>

            <section>
                <h2>4. Proposal Opening Register</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Consultant</th><th>Submitted</th><th>Receipt</th><th>Fee</th><th>Technical</th><th>Financial envelope</th><th>Status</th></tr></thead><tbody>
                    ${bids.map((bid, index) => {
                        const consultant = getConsultancyKey(bid, index);
                        const row = consultancyDraft.opening?.[consultant] || {};
                        return `<tr><td>${escapeEvaluationHtml(consultant)}</td><td>${escapeEvaluationHtml(bid.submissionTime || '-')}</td><td>${escapeEvaluationHtml(bid.integrityHash || '-')}</td><td>${formatEvaluationMoney(getConsultancyFinancialAmount(bid), bid.financial?.currency || 'TZS')}</td><td>${escapeEvaluationHtml(row.technicalStatus || '-')}</td><td>${escapeEvaluationHtml(row.financialEnvelopeStatus || '-')}</td><td>${escapeEvaluationHtml(row.status || 'Opened')}</td></tr>`;
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>5. Administrative & Eligibility Evaluation</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Consultant</th><th>Requirement</th><th>Decision</th><th>Remark</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const consultant = getConsultancyKey(bid, index);
                        return adminItems.map(item => {
                            const row = consultancyDraft.administrative?.[consultant]?.[item.id] || {};
                            return `<tr><td>${escapeEvaluationHtml(consultant)}</td><td>${escapeEvaluationHtml(item.title)}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>6. Custom Evaluation Criteria</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Consultant</th><th>Criterion</th><th>Type</th><th>Buyer Decision</th><th>Buyer Score</th><th>Comment</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const consultant = getConsultancyKey(bid, index);
                        return criteria.map(criterion => {
                            const row = getConsultancyCriterionSaved(consultancyDraft, consultant, criterion.id);
                            return `<tr><td>${escapeEvaluationHtml(consultant)}</td><td>${escapeEvaluationHtml(criterion.name)}</td><td>${escapeEvaluationHtml(formatGoodsEvaluationType(criterion.evaluationType))}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.score || '-')}${criterion.maxScore ? ` / ${escapeEvaluationHtml(criterion.maxScore)}` : ''}</td><td>${escapeEvaluationHtml(row.comment || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section>
                <h2>7. Technical Proposal / TOR Review</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Consultant</th><th>TOR area</th><th>Decision</th><th>Remark</th></tr></thead><tbody>
                    ${bids.flatMap((bid, index) => {
                        const consultant = getConsultancyKey(bid, index);
                        return torItems.map(item => {
                            const row = consultancyDraft.torTechnicalReview?.[consultant]?.items?.[item.id] || {};
                            return `<tr><td>${escapeEvaluationHtml(consultant)}</td><td>${escapeEvaluationHtml(item.title)}</td><td>${escapeEvaluationHtml(row.decision || 'Pending')}</td><td>${escapeEvaluationHtml(row.remark || '-')}</td></tr>`;
                        });
                    }).join('')}
                </tbody></table></div>
            </section>

            <section><h2>8. Financial Proposal Review</h2><p>Financial proposal status, corrections, cost realism checks, financial document review, and buyer remarks are recorded separately from scoring. Price is scored only where the buyer published a custom financial criterion.</p></section>
            ${renderEvaluationFinancialDocumentReportSection(tender, bids, {
                title: '9. Financial Documents Reviewed',
                getOwner: getConsultancyKey,
                getSavedDocuments: consultant => consultancyDraft.financialProposalReview?.[consultant]?.documents || {}
            })}
            <section>
                <h2>10. Selection Method / Final Ranking</h2>
                <div class="evaluation-table-scroll"><table><thead><tr><th>Rank</th><th>Consultant</th><th>Sections status</th><th>Weighted Score</th><th>Evaluated Fee</th><th>Recommendation</th><th>Reason</th></tr></thead><tbody>
                    ${rankingRows.map((row, index) => `<tr><td>${row.score === null ? '-' : index + 1}</td><td>${escapeEvaluationHtml(row.consultant)}</td><td>${escapeEvaluationHtml(row.sectionsStatus)}</td><td>${row.score === null ? '-' : `${escapeEvaluationHtml(formatEvaluationScore(row.score))} / ${escapeEvaluationHtml(maxScore)}`}</td><td>${formatEvaluationMoney(row.price, row.currency)}</td><td>${escapeEvaluationHtml(normalizeEvaluationRecommendation(row.ranking.recommendation) || 'Pending')}</td><td>${escapeEvaluationHtml(row.ranking.reason || '-')}</td></tr>`).join('')}
                </tbody></table></div>
            </section>

            <section><h2>11. Post-Qualification</h2><p>${bids.map((bid, index) => { const consultant = getConsultancyKey(bid, index); const row = consultancyDraft.postQualification?.[consultant] || {}; return `${consultant}: ${row.result || 'Pending'}${row.remark ? ` - ${row.remark}` : ''}`; }).map(escapeEvaluationHtml).join('; ')}</p></section>
            <section><h2>12. Award Recommendation</h2><p><strong>Recommended for award:</strong> ${escapeEvaluationHtml(recommendation.supplier || 'Pending buyer recommendation')}</p><p>${escapeEvaluationHtml(recommendation.reason || 'The buyer has not finalized a manual award recommendation yet.')}</p></section>
            <section><h2>13. Rejected Consultants and Reasons</h2><p>${rankingRows.filter(row => normalizeEvaluationRecommendation(row.ranking.recommendation) === 'Rejected').map(row => `${row.consultant}: ${row.ranking.reason || 'No reason recorded'}`).map(escapeEvaluationHtml).join('; ') || 'No rejected consultants recorded yet.'}</p></section>
            <section><h2>14. Buyer Declaration</h2><p>I confirm that the submitted consultancy proposals were reviewed manually against the published tender requirements and custom evaluation criteria. The system organized the proposal evidence and scoring records, but the evaluation decision was made by the buyer.</p></section>
            <section><h2>15. Attachments Reviewed</h2><p>Administrative documents, TOR response, methodology, work plan, deliverables, reporting arrangements, expert CVs, firm experience, similar assignments, financial documents, and financial proposal where available.</p></section>
        </div>
    `;
}

function renderConsultancyActiveStage(tender = {}, bids = [], supplierIndex = 0, activeStageId = 'opening', draft = {}) {
    const consultancyDraft = getConsultancyEvaluationDraft(draft);
    const bid = bids[supplierIndex] || {};
    if (activeStageId === 'opening') return renderConsultancyOpeningRegister(tender, bids, consultancyDraft);
    if (activeStageId === 'administrative') return renderConsultancyAdministrativeReview(tender, bid, supplierIndex, consultancyDraft);
    if (activeStageId === 'criteria') return renderConsultancyCriteriaEvaluation(tender, bid, supplierIndex, consultancyDraft);
    if (activeStageId === 'tor') return renderConsultancyTorReview(tender, bid, supplierIndex, consultancyDraft);
    if (activeStageId === 'financial') return renderConsultancyFinancialReview(tender, bid, supplierIndex, consultancyDraft);
    if (activeStageId === 'ranking') return renderConsultancyRanking(tender, bids, consultancyDraft);
    if (activeStageId === 'postqual') return renderConsultancyPostQualification(tender, bid, supplierIndex, consultancyDraft);
    return renderConsultancyEvaluationReportDocument(tender, bids, draft);
}

function renderConsultancyBidEvaluationWorkspace(tender = {}) {
    const bids = getEvaluationBidsForTender(tender);
    const draft = getEvaluationDraft(tender.reference) || {};
    const consultancyDraft = getConsultancyEvaluationDraft(draft);
    const stages = getConsultancyEvaluationStages();
    const activeStageId = consultancyDraft.currentStageId || 'opening';
    const supplierIndex = Math.min(Math.max(Number(draft.currentSupplierIndex || consultancyDraft.currentSupplierIndex || 0), 0), Math.max(0, bids.length - 1));
    const completion = getConsultancyCompletion(tender, bids, draft);
    const criteria = getEvaluationCriteriaForTender(tender);

    if (!bids.length) {
        return renderEvaluationShell(`
            <section class="procurement-hero evaluation-hero-panel">
                <div>
                    <span class="section-kicker">Consultancy Proposal Evaluation Workspace</span>
                    <h1>${escapeEvaluationHtml(tender.title)}</h1>
                    <p>No submitted consultancy proposal package is available for this tender in the current browser or mock data.</p>
                </div>
                <div class="evaluation-hero-stats">
                    <div><strong>0</strong><span>Proposals available</span></div>
                    <div><strong>${criteria.length}</strong><span>Published criteria</span></div>
                </div>
            </section>
        `, 'Consultancy Evaluation', tender.reference);
    }

    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Consultancy Proposal Evaluation Workspace</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Manual evaluation of submitted consultancy proposals using the buyer's published criteria, TOR, methodology, work plan, experts, experience, and financial proposal review.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(tender.reference)}</strong><span>Tender reference</span></div>
                <div><strong>Consultancy</strong><span>Procurement type</span></div>
                <div><strong>${escapeEvaluationHtml(getConsultancySelectionMethod(tender))}</strong><span>Selection method</span></div>
                <div><strong>${completion.percent}%</strong><span>Evaluation status</span></div>
            </div>
        </section>

        <section class="evaluation-top-summary">
            <div><span>Evaluation mode</span><strong>Manual Buyer Evaluation</strong></div>
            <div><span>Criteria source</span><strong>Published Tender Criteria</strong></div>
            <div><span>Buyer criteria</span><strong>${criteria.length}</strong></div>
            <div><span>Proposals received</span><strong>${bids.length}</strong></div>
            <div><span>Current stage</span><strong>${escapeEvaluationHtml((stages.find(stage => stage.id === activeStageId) || stages[0]).label)}</strong></div>
        </section>

        <section class="procurement-panel evaluation-panel consultancy-evaluation-workspace" data-evaluation-workspace="${escapeEvaluationHtml(tender.reference)}" data-current-supplier-index="${supplierIndex}" data-current-consultancy-stage="${escapeEvaluationHtml(activeStageId)}">
            <div class="evaluation-notice warning">This evaluation uses the criteria configured by the buyer during tender creation. The system organizes consultancy proposal evidence and calculates totals only. The buyer makes all evaluation decisions manually.</div>
            ${renderConsultancyTabs(bids, supplierIndex)}
            <div class="evaluation-progress-track evaluation-workspace-progress"><span style="width: ${completion.percent}%"></span></div>
            <div class="evaluation-review-grid">
                ${renderConsultancyStageRail(stages, activeStageId)}
                <div class="evaluation-review-main">
                    ${renderConsultancyActiveStage(tender, bids, supplierIndex, activeStageId, draft)}
                </div>
            </div>
            <div class="evaluation-finish-panel">
                <div>
                    <span class="section-kicker">Complete consultancy evaluation</span>
                    <h3>${completion.canComplete ? 'Ready for buyer completion' : 'Complete all consultancy decisions and recommendation'}</h3>
                    <p>${completion.complete} of ${completion.total} required checks are complete. Ranking and award recommendation remain manual buyer decisions.</p>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(tender.reference)}">Preview Report</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(tender.reference)}">Download Report</button>
                    <button class="btn btn-primary" type="button" data-evaluation-complete="${escapeEvaluationHtml(tender.reference)}" ${completion.canComplete ? '' : 'disabled'}>Complete Evaluation</button>
                </div>
            </div>
        </section>
    `, 'Consultancy Evaluation', tender.reference);
}

function renderBidEvaluationWorkspace(reference = '') {
    const tender = getEvaluationTenderModel(reference);
    if (!tender.ready) return renderEvaluationLockedTender(reference);

    if (getEvaluationProfileId(tender) === 'goods') {
        return renderGoodsBidEvaluationWorkspace(tender);
    }

    if (getEvaluationProfileId(tender) === 'works') {
        return renderWorksBidEvaluationWorkspace(tender);
    }

    if (getEvaluationProfileId(tender) === 'services') {
        return renderServiceBidEvaluationWorkspace(tender);
    }

    if (getEvaluationProfileId(tender) === 'consultancy') {
        return renderConsultancyBidEvaluationWorkspace(tender);
    }

    const profile = getEvaluationProfile(tender);
    const bids = getEvaluationBidsForTender(tender);
    const draft = getEvaluationDraft(tender.reference) || {};
    const sections = getEvaluationReviewSections(tender);
    const supplierIndex = Math.min(Math.max(Number(draft.currentSupplierIndex || 0), 0), Math.max(0, bids.length - 1));
    const activeSectionId = draft.currentSectionId || sections[0]?.id || 'supplier-info';
    const activeSection = sections.find(section => section.id === activeSectionId) || sections[0] || {};
    const bid = bids[supplierIndex] || {};
    const completion = getEvaluationCompletion(tender, bids, draft);
    const recommended = getEvaluationRecommendedBid(tender, bids);

    if (!bids.length) {
        return renderEvaluationShell(`
            <section class="procurement-hero evaluation-hero-panel">
                <div>
                    <span class="section-kicker">No submissions</span>
                    <h1>${escapeEvaluationHtml(tender.title)}</h1>
                    <p>No supplier bid package is available for this tender yet.</p>
                </div>
                <div class="evaluation-hero-stats">
                    <div><strong>${escapeEvaluationHtml(profile.id)}</strong><span>Procurement type</span></div>
                    <div><strong>0</strong><span>Bids available</span></div>
                </div>
            </section>
        `, 'Bid Evaluation', tender.reference);
    }

    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Evaluation app</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Evaluate one supplier at a time using the ${escapeEvaluationHtml(profile.id)} procurement flow. Each decision is saved against this tender, supplier, and requirement.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(profile.id)}</strong><span>Procurement type</span></div>
                <div><strong>${supplierIndex + 1} of ${bids.length}</strong><span>Supplier queue</span></div>
                <div><strong>${completion.percent}%</strong><span>Evaluation progress</span></div>
                <div><strong>${escapeEvaluationHtml(draft.status || 'Draft')}</strong><span>Draft status</span></div>
            </div>
        </section>

        <section class="evaluation-top-summary">
            <div><span>Reference</span><strong>${escapeEvaluationHtml(tender.reference)}</strong></div>
            <div><span>Closing date</span><strong>${escapeEvaluationHtml(tender.closingDate || '-')}</strong></div>
            <div><span>Evaluation deadline</span><strong>${escapeEvaluationHtml(tender.evaluationDeadline || '-')}</strong></div>
            <div><span>Configured checks</span><strong>${getEvaluationTenderRequirementCount(tender)}</strong></div>
            <div><span>Completed checks</span><strong>${completion.complete}/${completion.total}</strong></div>
            <div><span>Status</span>${renderEvaluationStatusBadge(tender.status)}</div>
        </section>

        <section class="procurement-panel evaluation-panel" data-evaluation-workspace="${escapeEvaluationHtml(tender.reference)}" data-current-supplier-index="${supplierIndex}" data-current-section-id="${escapeEvaluationHtml(activeSection.id || '')}">
            <div class="evaluation-supplier-queue">
                <button class="btn btn-secondary" type="button" data-evaluation-move-supplier="-1" ${supplierIndex <= 0 ? 'disabled' : ''}>Previous Supplier</button>
                <div>
                    <span class="section-kicker">Current supplier</span>
                    <strong>${escapeEvaluationHtml(bid.supplier || 'Supplier')}</strong>
                    <p>${escapeEvaluationHtml(bid.registrationNumber || bid.contactPerson || 'Bid evidence available for review.')}</p>
                </div>
                <button class="btn btn-secondary" type="button" data-evaluation-move-supplier="1" ${supplierIndex >= bids.length - 1 ? 'disabled' : ''}>Next Supplier</button>
            </div>

            <div class="evaluation-progress-track evaluation-workspace-progress"><span style="width: ${completion.percent}%"></span></div>

            <div class="evaluation-review-grid">
                ${renderEvaluationSectionRail(sections, activeSection.id)}
                <div class="evaluation-review-main">
                    ${renderEvaluationActiveSection(tender, bid, supplierIndex, activeSection, draft)}
                </div>
            </div>

            <div class="evaluation-finish-panel">
                <div>
                    <span class="section-kicker">Finish evaluation</span>
                    <h3>${completion.canComplete ? 'Ready to complete this tender evaluation' : 'Complete all supplier requirement decisions'}</h3>
                    <p>${completion.complete} of ${completion.total} required supplier checks are complete. Not eligible and clarification decisions require buyer comments before completion.</p>
                    ${recommended.supplier ? `<p>Current recommended supplier basis: ${escapeEvaluationHtml(recommended.supplier)} / ${formatEvaluationMoney(recommended.financial?.correctedPrice || recommended.price || mockData.bidEvaluation?.recommendation?.amount || 0, recommended.financial?.currency || mockData.bidEvaluation?.recommendation?.currency || 'TZS')}.</p>` : ''}
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-save-draft="${escapeEvaluationHtml(tender.reference)}">Save Draft</button>
                    <button class="btn btn-secondary" type="button" data-evaluation-view-report="${escapeEvaluationHtml(tender.reference)}">Preview Report</button>
                    <button class="btn btn-primary" type="button" data-evaluation-complete="${escapeEvaluationHtml(tender.reference)}" ${completion.canComplete ? '' : 'disabled'}>Complete Evaluation</button>
                </div>
            </div>
        </section>
    `, 'Bid Evaluation', tender.reference);
}

function collectEvaluationDraftFromDom(reference = '', status = 'Saved as draft') {
    const workspace = document.querySelector(`[data-evaluation-workspace="${CSS.escape(reference)}"]`);
    const existing = getEvaluationDraft(reference) || {};
    const isGoodsWorkspace = Boolean(workspace?.classList?.contains('goods-evaluation-workspace'));
    const isWorksWorkspace = Boolean(workspace?.classList?.contains('works-evaluation-workspace'));
    const isServiceWorkspace = Boolean(workspace?.classList?.contains('service-evaluation-workspace'));
    const isConsultancyWorkspace = Boolean(workspace?.classList?.contains('consultancy-evaluation-workspace'));
    const payload = {
        ...existing,
        status,
        savedAt: new Date().toISOString(),
        currentSupplierIndex: Number(workspace?.dataset.currentSupplierIndex || existing.currentSupplierIndex || 0),
        currentSectionId: workspace?.dataset.currentSectionId || existing.currentSectionId || 'supplier-info',
        requirements: { ...(existing.requirements || {}) }
    };

    document.querySelectorAll('[data-evaluation-row]').forEach(row => {
        const supplier = row.getAttribute('data-supplier') || '';
        const requirementId = row.getAttribute('data-requirement-id') || '';
        if (!supplier || !requirementId) return;
        payload.requirements[supplier] = { ...(payload.requirements[supplier] || {}) };
        payload.requirements[supplier][requirementId] = {
            sectionId: row.getAttribute('data-section-id') || '',
            decision: row.querySelector('[data-evaluation-decision]')?.value || '',
            score: row.querySelector('[data-evaluation-score]')?.value || '',
            comment: row.querySelector('[data-evaluation-comment]')?.value || '',
            updatedAt: new Date().toISOString()
        };
    });

    if (isGoodsWorkspace) {
        const goods = {
            ...(existing.goods || {}),
            currentSupplierIndex: Number(workspace?.dataset.currentSupplierIndex || existing.goods?.currentSupplierIndex || 0),
            currentStageId: workspace?.dataset.currentGoodsStage || existing.goods?.currentStageId || 'opening',
            opening: { ...(existing.goods?.opening || {}) },
            administrative: { ...(existing.goods?.administrative || {}) },
            criteriaEvaluation: { ...(existing.goods?.criteriaEvaluation || {}) },
            financial: { ...(existing.goods?.financial || {}) },
            financialDocuments: { ...(existing.goods?.financialDocuments || {}) },
            postQualification: { ...(existing.goods?.postQualification || {}) },
            ranking: { ...(existing.goods?.ranking || {}) },
            report: {
                ...(existing.goods?.report || {}),
                updatedAt: new Date().toISOString(),
                sections: ['tender_information', 'evaluation_method', 'bidders', 'opening', 'administrative', 'criteria', 'financial', 'post_qualification', 'ranking', 'recommendation', 'declaration']
            }
        };

        document.querySelectorAll('[data-goods-opening-row]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            if (!supplier) return;
            const existingOpening = goods.opening[supplier] || {};
            goods.opening[supplier] = {
                status: row.querySelector('[data-goods-opening-status]')?.value || existingOpening.status || 'Opened',
                remark: row.querySelector('[data-goods-opening-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-goods-admin-row]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            const id = row.getAttribute('data-admin-id') || '';
            if (!supplier || !id) return;
            goods.administrative[supplier] = { ...(goods.administrative[supplier] || {}) };
            goods.administrative[supplier][id] = {
                decision: row.querySelector('[data-goods-admin-decision]')?.value || '',
                remark: row.querySelector('[data-goods-admin-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-goods-criterion-row]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            const id = row.getAttribute('data-criterion-id') || '';
            if (!supplier || !id) return;
            goods.criteriaEvaluation[supplier] = { ...(goods.criteriaEvaluation[supplier] || {}) };
            goods.criteriaEvaluation[supplier][id] = {
                type: row.getAttribute('data-criterion-type') || '',
                decision: row.querySelector('[data-goods-criterion-decision]')?.value || '',
                score: row.querySelector('[data-goods-criterion-score]')?.value || '',
                comment: row.querySelector('[data-goods-criterion-comment]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-goods-financial-row]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            const id = row.getAttribute('data-line-id') || '';
            if (!supplier || !id) return;
            goods.financial[supplier] = { ...(goods.financial[supplier] || {}) };
            goods.financial[supplier][id] = {
                check: row.querySelector('[data-goods-financial-check]')?.value || '',
                remark: row.querySelector('[data-goods-financial-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        Object.entries(collectEvaluationFinancialDocumentReviews('goods')).forEach(([supplier, documents]) => {
            goods.financialDocuments[supplier] = {
                ...(goods.financialDocuments[supplier] || {}),
                ...documents
            };
        });

        document.querySelectorAll('[data-goods-postqual-row]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            const id = row.getAttribute('data-postqual-id') || '';
            if (!supplier || !id) return;
            goods.postQualification[supplier] = {
                ...(goods.postQualification[supplier] || {}),
                checks: { ...(goods.postQualification[supplier]?.checks || {}) }
            };
            goods.postQualification[supplier].checks[id] = {
                decision: row.querySelector('[data-goods-postqual-decision]')?.value || '',
                remark: row.querySelector('[data-goods-postqual-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-goods-postqual-result]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            if (!supplier) return;
            goods.postQualification[supplier] = {
                ...(goods.postQualification[supplier] || {}),
                result: row.querySelector('[data-goods-postqual-final]')?.value || '',
                remark: row.querySelector('[data-goods-postqual-overall]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-goods-ranking-row]').forEach(row => {
            const supplier = row.getAttribute('data-supplier') || '';
            if (!supplier) return;
            goods.ranking[supplier] = {
                recommendation: normalizeEvaluationRecommendation(row.querySelector('[data-goods-ranking-recommendation]')?.value || ''),
                reason: row.querySelector('[data-goods-ranking-reason]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        payload.goods = goods;
    }

    if (isWorksWorkspace) {
        const works = {
            ...(existing.works || {}),
            currentSupplierIndex: Number(workspace?.dataset.currentSupplierIndex || existing.works?.currentSupplierIndex || 0),
            currentStageId: workspace?.dataset.currentWorksStage || existing.works?.currentStageId || 'opening',
            opening: { ...(existing.works?.opening || {}) },
            administrative: { ...(existing.works?.administrative || {}) },
            criteriaEvaluation: { ...(existing.works?.criteriaEvaluation || {}) },
            boqFinancialReview: { ...(existing.works?.boqFinancialReview || {}) },
            commercialTerms: { ...(existing.works?.commercialTerms || {}) },
            postQualification: { ...(existing.works?.postQualification || {}) },
            ranking: { ...(existing.works?.ranking || {}) },
            report: {
                ...(existing.works?.report || {}),
                updatedAt: new Date().toISOString(),
                sections: ['tender_information', 'evaluation_method', 'criteria_used', 'opening', 'administrative', 'criteria', 'boq_financial', 'post_qualification', 'ranking', 'recommendation', 'rejected_bidders', 'declaration', 'attachments_reviewed']
            }
        };

        document.querySelectorAll('[data-works-opening-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            if (!contractor) return;
            const existingOpening = works.opening[contractor] || {};
            works.opening[contractor] = {
                status: row.querySelector('[data-works-opening-status]')?.value || existingOpening.status || 'Opened',
                bidSecurityStatus: row.querySelector('[data-works-opening-bid-security]')?.value || existingOpening.bidSecurityStatus || 'Submitted',
                completionPeriodOffered: row.querySelector('[data-works-opening-completion]')?.value || '',
                remark: row.querySelector('[data-works-opening-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-admin-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            const id = row.getAttribute('data-admin-id') || '';
            if (!contractor || !id) return;
            works.administrative[contractor] = { ...(works.administrative[contractor] || {}) };
            works.administrative[contractor][id] = {
                decision: row.querySelector('[data-works-admin-decision]')?.value || '',
                remark: row.querySelector('[data-works-admin-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-criterion-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            const id = row.getAttribute('data-criterion-id') || '';
            if (!contractor || !id) return;
            works.criteriaEvaluation[contractor] = { ...(works.criteriaEvaluation[contractor] || {}) };
            works.criteriaEvaluation[contractor][id] = {
                type: row.getAttribute('data-criterion-type') || '',
                decision: row.querySelector('[data-works-criterion-decision]')?.value || '',
                score: row.querySelector('[data-works-criterion-score]')?.value || '',
                comment: row.querySelector('[data-works-criterion-comment]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-financial-result]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            if (!contractor) return;
            works.boqFinancialReview[contractor] = {
                ...(works.boqFinancialReview[contractor] || {}),
                status: row.querySelector('[data-works-financial-status]')?.value || '',
                remark: row.querySelector('[data-works-financial-overall]')?.value || '',
                lines: { ...(works.boqFinancialReview[contractor]?.lines || {}) },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-boq-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            const id = row.getAttribute('data-line-id') || '';
            if (!contractor || !id) return;
            works.boqFinancialReview[contractor] = {
                ...(works.boqFinancialReview[contractor] || {}),
                lines: { ...(works.boqFinancialReview[contractor]?.lines || {}) }
            };
            works.boqFinancialReview[contractor].lines[id] = {
                check: row.querySelector('[data-works-boq-check]')?.value || '',
                remark: row.querySelector('[data-works-boq-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        Object.entries(collectEvaluationFinancialDocumentReviews('works')).forEach(([contractor, documents]) => {
            works.boqFinancialReview[contractor] = {
                ...(works.boqFinancialReview[contractor] || {}),
                documents: {
                    ...(works.boqFinancialReview[contractor]?.documents || {}),
                    ...documents
                },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-commercial-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            const id = row.getAttribute('data-term-id') || '';
            if (!contractor || !id) return;
            works.commercialTerms[contractor] = { ...(works.commercialTerms[contractor] || {}) };
            works.commercialTerms[contractor][id] = {
                decision: row.querySelector('[data-works-commercial-decision]')?.value || '',
                response: row.querySelector('[data-works-commercial-response]')?.value || '',
                remark: row.querySelector('[data-works-commercial-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-postqual-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            const id = row.getAttribute('data-postqual-id') || '';
            if (!contractor || !id) return;
            works.postQualification[contractor] = {
                ...(works.postQualification[contractor] || {}),
                checks: { ...(works.postQualification[contractor]?.checks || {}) }
            };
            works.postQualification[contractor].checks[id] = {
                decision: row.querySelector('[data-works-postqual-decision]')?.value || '',
                remark: row.querySelector('[data-works-postqual-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-postqual-result]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            if (!contractor) return;
            works.postQualification[contractor] = {
                ...(works.postQualification[contractor] || {}),
                result: row.querySelector('[data-works-postqual-final]')?.value || '',
                remark: row.querySelector('[data-works-postqual-overall]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-works-ranking-row]').forEach(row => {
            const contractor = row.getAttribute('data-contractor') || '';
            if (!contractor) return;
            works.ranking[contractor] = {
                recommendation: normalizeEvaluationRecommendation(row.querySelector('[data-works-ranking-recommendation]')?.value || ''),
                reason: row.querySelector('[data-works-ranking-reason]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        payload.works = works;
    }

    if (isServiceWorkspace) {
        const services = {
            ...(existing.services || {}),
            currentSupplierIndex: Number(workspace?.dataset.currentSupplierIndex || existing.services?.currentSupplierIndex || 0),
            currentStageId: workspace?.dataset.currentServiceStage || existing.services?.currentStageId || 'opening',
            opening: { ...(existing.services?.opening || {}) },
            administrative: { ...(existing.services?.administrative || {}) },
            criteriaEvaluation: { ...(existing.services?.criteriaEvaluation || {}) },
            pricingReview: { ...(existing.services?.pricingReview || {}) },
            slaPerformanceReview: { ...(existing.services?.slaPerformanceReview || {}) },
            postQualification: { ...(existing.services?.postQualification || {}) },
            ranking: { ...(existing.services?.ranking || {}) },
            report: {
                ...(existing.services?.report || {}),
                updatedAt: new Date().toISOString(),
                sections: ['tender_information', 'evaluation_method', 'criteria_used', 'opening', 'administrative', 'criteria', 'service_pricing', 'sla_performance', 'post_qualification', 'ranking', 'recommendation', 'rejected_bidders', 'declaration', 'attachments_reviewed']
            }
        };

        document.querySelectorAll('[data-service-opening-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            if (!provider) return;
            services.opening[provider] = {
                status: row.querySelector('[data-service-opening-status]')?.value || '',
                serviceDurationOffered: row.querySelector('[data-service-opening-duration]')?.value || '',
                remark: row.querySelector('[data-service-opening-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-admin-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            const id = row.getAttribute('data-admin-id') || '';
            if (!provider || !id) return;
            services.administrative[provider] = { ...(services.administrative[provider] || {}) };
            services.administrative[provider][id] = {
                decision: row.querySelector('[data-service-admin-decision]')?.value || '',
                remark: row.querySelector('[data-service-admin-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-criterion-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            const id = row.getAttribute('data-criterion-id') || '';
            if (!provider || !id) return;
            services.criteriaEvaluation[provider] = { ...(services.criteriaEvaluation[provider] || {}) };
            services.criteriaEvaluation[provider][id] = {
                type: row.getAttribute('data-criterion-type') || '',
                decision: row.querySelector('[data-service-criterion-decision]')?.value || '',
                score: row.querySelector('[data-service-criterion-score]')?.value || '',
                comment: row.querySelector('[data-service-criterion-comment]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-pricing-result]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            if (!provider) return;
            services.pricingReview[provider] = {
                ...(services.pricingReview[provider] || {}),
                status: row.querySelector('[data-service-pricing-status]')?.value || '',
                remark: row.querySelector('[data-service-pricing-overall]')?.value || '',
                lines: { ...(services.pricingReview[provider]?.lines || {}) },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-pricing-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            const id = row.getAttribute('data-line-id') || '';
            if (!provider || !id) return;
            services.pricingReview[provider] = {
                ...(services.pricingReview[provider] || {}),
                lines: { ...(services.pricingReview[provider]?.lines || {}) }
            };
            services.pricingReview[provider].lines[id] = {
                check: row.querySelector('[data-service-pricing-check]')?.value || '',
                remark: row.querySelector('[data-service-pricing-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        Object.entries(collectEvaluationFinancialDocumentReviews('services')).forEach(([provider, documents]) => {
            services.pricingReview[provider] = {
                ...(services.pricingReview[provider] || {}),
                documents: {
                    ...(services.pricingReview[provider]?.documents || {}),
                    ...documents
                },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-sla-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            const id = row.getAttribute('data-sla-id') || '';
            if (!provider || !id) return;
            services.slaPerformanceReview[provider] = { ...(services.slaPerformanceReview[provider] || {}) };
            services.slaPerformanceReview[provider][id] = {
                decision: row.querySelector('[data-service-sla-decision]')?.value || '',
                offer: row.querySelector('[data-service-sla-offer]')?.value || '',
                remark: row.querySelector('[data-service-sla-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-postqual-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            const id = row.getAttribute('data-postqual-id') || '';
            if (!provider || !id) return;
            services.postQualification[provider] = {
                ...(services.postQualification[provider] || {}),
                checks: { ...(services.postQualification[provider]?.checks || {}) }
            };
            services.postQualification[provider].checks[id] = {
                decision: row.querySelector('[data-service-postqual-decision]')?.value || '',
                remark: row.querySelector('[data-service-postqual-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-postqual-result]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            if (!provider) return;
            services.postQualification[provider] = {
                ...(services.postQualification[provider] || {}),
                result: row.querySelector('[data-service-postqual-final]')?.value || '',
                remark: row.querySelector('[data-service-postqual-overall]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-service-ranking-row]').forEach(row => {
            const provider = row.getAttribute('data-provider') || '';
            if (!provider) return;
            services.ranking[provider] = {
                recommendation: normalizeEvaluationRecommendation(row.querySelector('[data-service-ranking-recommendation]')?.value || ''),
                reason: row.querySelector('[data-service-ranking-reason]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        payload.services = services;
    }

    if (isConsultancyWorkspace) {
        const consultancy = {
            ...(existing.consultancy || {}),
            currentSupplierIndex: Number(workspace?.dataset.currentSupplierIndex || existing.consultancy?.currentSupplierIndex || 0),
            currentStageId: workspace?.dataset.currentConsultancyStage || existing.consultancy?.currentStageId || 'opening',
            opening: { ...(existing.consultancy?.opening || {}) },
            administrative: { ...(existing.consultancy?.administrative || {}) },
            criteriaEvaluation: { ...(existing.consultancy?.criteriaEvaluation || {}) },
            torTechnicalReview: { ...(existing.consultancy?.torTechnicalReview || {}) },
            financialProposalReview: { ...(existing.consultancy?.financialProposalReview || {}) },
            postQualification: { ...(existing.consultancy?.postQualification || {}) },
            ranking: { ...(existing.consultancy?.ranking || {}) },
            report: {
                ...(existing.consultancy?.report || {}),
                updatedAt: new Date().toISOString(),
                sections: ['tender_information', 'evaluation_method', 'criteria_used', 'opening', 'administrative', 'criteria', 'tor_technical', 'financial_proposal', 'selection_ranking', 'post_qualification', 'recommendation', 'rejected_consultants', 'declaration', 'attachments_reviewed']
            }
        };

        document.querySelectorAll('[data-consultancy-opening-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            if (!consultant) return;
            consultancy.opening[consultant] = {
                status: row.querySelector('[data-consultancy-opening-status]')?.value || '',
                technicalStatus: row.querySelector('[data-consultancy-opening-technical]')?.value || '',
                financialEnvelopeStatus: row.querySelector('[data-consultancy-opening-financial]')?.value || '',
                remark: row.querySelector('[data-consultancy-opening-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-admin-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            const id = row.getAttribute('data-admin-id') || '';
            if (!consultant || !id) return;
            consultancy.administrative[consultant] = { ...(consultancy.administrative[consultant] || {}) };
            consultancy.administrative[consultant][id] = {
                decision: row.querySelector('[data-consultancy-admin-decision]')?.value || '',
                remark: row.querySelector('[data-consultancy-admin-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-criterion-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            const id = row.getAttribute('data-criterion-id') || '';
            if (!consultant || !id) return;
            consultancy.criteriaEvaluation[consultant] = { ...(consultancy.criteriaEvaluation[consultant] || {}) };
            consultancy.criteriaEvaluation[consultant][id] = {
                type: row.getAttribute('data-criterion-type') || '',
                decision: row.querySelector('[data-consultancy-criterion-decision]')?.value || '',
                score: row.querySelector('[data-consultancy-criterion-score]')?.value || '',
                comment: row.querySelector('[data-consultancy-criterion-comment]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-tor-result]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            if (!consultant) return;
            consultancy.torTechnicalReview[consultant] = {
                ...(consultancy.torTechnicalReview[consultant] || {}),
                status: row.querySelector('[data-consultancy-tor-status]')?.value || '',
                remark: row.querySelector('[data-consultancy-tor-overall]')?.value || '',
                items: { ...(consultancy.torTechnicalReview[consultant]?.items || {}) },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-tor-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            const id = row.getAttribute('data-tor-id') || '';
            if (!consultant || !id) return;
            consultancy.torTechnicalReview[consultant] = {
                ...(consultancy.torTechnicalReview[consultant] || {}),
                items: { ...(consultancy.torTechnicalReview[consultant]?.items || {}) }
            };
            consultancy.torTechnicalReview[consultant].items[id] = {
                decision: row.querySelector('[data-consultancy-tor-decision]')?.value || '',
                remark: row.querySelector('[data-consultancy-tor-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-financial-result]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            if (!consultant) return;
            consultancy.financialProposalReview[consultant] = {
                ...(consultancy.financialProposalReview[consultant] || {}),
                status: row.querySelector('[data-consultancy-financial-status]')?.value || '',
                remark: row.querySelector('[data-consultancy-financial-overall]')?.value || '',
                lines: { ...(consultancy.financialProposalReview[consultant]?.lines || {}) },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-financial-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            const id = row.getAttribute('data-line-id') || '';
            if (!consultant || !id) return;
            consultancy.financialProposalReview[consultant] = {
                ...(consultancy.financialProposalReview[consultant] || {}),
                lines: { ...(consultancy.financialProposalReview[consultant]?.lines || {}) }
            };
            consultancy.financialProposalReview[consultant].lines[id] = {
                check: row.querySelector('[data-consultancy-financial-check]')?.value || '',
                remark: row.querySelector('[data-consultancy-financial-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        Object.entries(collectEvaluationFinancialDocumentReviews('consultancy')).forEach(([consultant, documents]) => {
            consultancy.financialProposalReview[consultant] = {
                ...(consultancy.financialProposalReview[consultant] || {}),
                documents: {
                    ...(consultancy.financialProposalReview[consultant]?.documents || {}),
                    ...documents
                },
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-postqual-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            const id = row.getAttribute('data-postqual-id') || '';
            if (!consultant || !id) return;
            consultancy.postQualification[consultant] = {
                ...(consultancy.postQualification[consultant] || {}),
                checks: { ...(consultancy.postQualification[consultant]?.checks || {}) }
            };
            consultancy.postQualification[consultant].checks[id] = {
                decision: row.querySelector('[data-consultancy-postqual-decision]')?.value || '',
                remark: row.querySelector('[data-consultancy-postqual-remark]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-postqual-result]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            if (!consultant) return;
            consultancy.postQualification[consultant] = {
                ...(consultancy.postQualification[consultant] || {}),
                result: row.querySelector('[data-consultancy-postqual-final]')?.value || '',
                remark: row.querySelector('[data-consultancy-postqual-overall]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        document.querySelectorAll('[data-consultancy-ranking-row]').forEach(row => {
            const consultant = row.getAttribute('data-consultant') || '';
            if (!consultant) return;
            consultancy.ranking[consultant] = {
                recommendation: normalizeEvaluationRecommendation(row.querySelector('[data-consultancy-ranking-recommendation]')?.value || ''),
                reason: row.querySelector('[data-consultancy-ranking-reason]')?.value || '',
                updatedAt: new Date().toISOString()
            };
        });

        payload.consultancy = consultancy;
    }

    return payload;
}

function renderEvaluationReportDocument(tender = {}, bids = [], draft = {}) {
    if (getEvaluationProfileId(tender) === 'goods') {
        return renderGoodsEvaluationReportDocument(tender, bids, draft);
    }
    if (getEvaluationProfileId(tender) === 'works') {
        return renderWorksEvaluationReportDocument(tender, bids, draft);
    }
    if (getEvaluationProfileId(tender) === 'services') {
        return renderServiceEvaluationReportDocument(tender, bids, draft);
    }
    if (getEvaluationProfileId(tender) === 'consultancy') {
        return renderConsultancyEvaluationReportDocument(tender, bids, draft);
    }
    const sections = getEvaluationReviewSections(tender).filter(section => section.id !== 'supplier-info');
    const completion = getEvaluationCompletion(tender, bids, draft);
    const recommended = draft.recommendation || mockData.bidEvaluation?.recommendation || getEvaluationRecommendedBid(tender, bids);
    return `
        <div class="evaluation-report-document">
            <header>
                <span>ProcureX Evaluation Report</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>${escapeEvaluationHtml(tender.reference)} / ${escapeEvaluationHtml(tender.type || getEvaluationProfile(tender).id)} / ${escapeEvaluationHtml(draft.status || 'Draft')}</p>
            </header>
            <section class="evaluation-report-summary">
                <div><span>Suppliers reviewed</span><strong>${bids.length}</strong></div>
                <div><span>Completion</span><strong>${completion.complete}/${completion.total}</strong></div>
                <div><span>Recommendation</span><strong>${escapeEvaluationHtml(recommended.supplier || 'Pending')}</strong></div>
                <div><span>Last saved</span><strong>${escapeEvaluationHtml(draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'Not saved')}</strong></div>
            </section>
            ${sections.map(section => `
                <section>
                    <h2>${escapeEvaluationHtml(section.label)}</h2>
                    <div class="evaluation-table-scroll">
                        <table>
                            <thead><tr><th>Supplier</th><th>Requirement</th><th>Decision</th><th>Score</th><th>Comment</th></tr></thead>
                            <tbody>
                                ${bids.flatMap(bid => section.items.map(item => {
                                    const row = draft.requirements?.[bid.supplier]?.[item.id] || {};
                                    return `
                                        <tr>
                                            <td>${escapeEvaluationHtml(bid.supplier)}</td>
                                            <td>${escapeEvaluationHtml(item.title)}</td>
                                            <td>${escapeEvaluationHtml(row.decision || 'Pending')}</td>
                                            <td>${escapeEvaluationHtml(row.score || '-')}</td>
                                            <td>${escapeEvaluationHtml(row.comment || '-')}</td>
                                        </tr>
                                    `;
                                })).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `).join('')}
        </div>
    `;
}

function renderEvaluationReportPage(reference = '') {
    const tender = getEvaluationTenderModel(reference);
    const bids = getEvaluationBidsForTender(tender);
    const draft = getEvaluationDraft(reference) || {};
    return renderEvaluationShell(`
        <section class="procurement-hero evaluation-hero-panel">
            <div>
                <span class="section-kicker">Report preview</span>
                <h1>${escapeEvaluationHtml(tender.title)}</h1>
                <p>Preview the evaluation record saved for this tender before routing the award recommendation.</p>
            </div>
            <div class="evaluation-hero-stats">
                <div><strong>${escapeEvaluationHtml(draft.status || 'Draft')}</strong><span>Status</span></div>
                <div><strong>${bids.length}</strong><span>Suppliers</span></div>
            </div>
        </section>
        <section class="procurement-panel evaluation-panel">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">Evaluation report</span>
                    <h2>Saved evaluation decisions</h2>
                </div>
                <div class="inline-actions">
                    <button class="btn btn-secondary" type="button" data-evaluation-close-report>Back to Evaluation</button>
                    <button class="btn btn-primary" type="button" data-evaluation-download-report="${escapeEvaluationHtml(reference)}">Download Report</button>
                </div>
            </div>
            ${renderEvaluationReportDocument(tender, bids, draft)}
        </section>
    `, 'Evaluation Report', reference);
}

function completeEvaluation(reference = '') {
    const tender = getEvaluationTenderModel(reference);
    const bids = getEvaluationBidsForTender(tender);
    const payload = collectEvaluationDraftFromDom(reference, 'Completed');
    if (getEvaluationProfileId(tender) === 'goods') {
        payload.recommendation = getGoodsManualRecommendation(tender, bids, payload);
        saveEvaluationDraft(reference, payload);
        setSelectedEvaluationTender('');
        return;
    }
    if (getEvaluationProfileId(tender) === 'works') {
        payload.recommendation = getWorksManualRecommendation(tender, bids, payload);
        saveEvaluationDraft(reference, payload);
        setSelectedEvaluationTender('');
        return;
    }
    if (getEvaluationProfileId(tender) === 'services') {
        payload.recommendation = getServiceManualRecommendation(tender, bids, payload);
        saveEvaluationDraft(reference, payload);
        setSelectedEvaluationTender('');
        return;
    }
    if (getEvaluationProfileId(tender) === 'consultancy') {
        payload.recommendation = getConsultancyManualRecommendation(tender, bids, payload);
        saveEvaluationDraft(reference, payload);
        setSelectedEvaluationTender('');
        return;
    }
    const recommendedBid = getEvaluationRecommendedBid(tender, bids);
    payload.recommendation = {
        supplier: recommendedBid.supplier || mockData.bidEvaluation?.recommendation?.supplier || '',
        amount: recommendedBid.financial?.correctedPrice || recommendedBid.price || mockData.bidEvaluation?.recommendation?.amount || 0,
        currency: recommendedBid.financial?.currency || mockData.bidEvaluation?.recommendation?.currency || 'TZS',
        reason: `${recommendedBid.supplier || 'Recommended supplier'} is recommended from the completed supplier-by-supplier evaluation against the published tender requirements.`
    };
    saveEvaluationDraft(reference, payload);
    setSelectedEvaluationTender('');
}

function renderBidEvaluation() {
    const reportReference = getSelectedEvaluationReportReference();
    if (reportReference) return renderEvaluationReportPage(reportReference);

    const selectedReference = getSelectedEvaluationTenderReference();
    if (!selectedReference) return renderEvaluationTenderList();
    const selectedTender = getEvaluationSourceTender(selectedReference);
    if (selectedTender && typeof isProcurexTenderOwnedByCurrentUser === 'function' && !isProcurexTenderOwnedByCurrentUser(selectedTender)) {
        setSelectedEvaluationTender('');
        return renderEvaluationTenderList();
    }
    return renderBidEvaluationWorkspace(selectedReference);
}

function initializeBidEvaluation() {
    if (!isEvaluationAdminOversightSession()) return;
    document.querySelectorAll('[data-evaluation-workspace] input, [data-evaluation-workspace] select, [data-evaluation-workspace] textarea').forEach(control => {
        control.disabled = true;
    });
    document.querySelectorAll('[data-evaluation-save-draft], [data-evaluation-complete]').forEach(button => {
        button.disabled = true;
        button.title = 'System Admin accounts can monitor only. Buyer users complete scoring and selection.';
    });
}

window.initializeBidEvaluation = initializeBidEvaluation;
window.clearProcurexEvaluationSelection = clearProcurexEvaluationSelection;

if (window.app) {
    window.app.renderBidEvaluation = renderBidEvaluation;
}

if (typeof document !== 'undefined' && !window.procurexEvaluationRedesignListenerReady) {
    window.procurexEvaluationRedesignListenerReady = true;
    document.addEventListener('click', (event) => {
        const selectButton = event.target.closest('[data-evaluation-select]');
        const clearButton = event.target.closest('[data-evaluation-clear-selection]');
        const sectionButton = event.target.closest('[data-evaluation-section]');
        const goodsStageButton = event.target.closest('[data-goods-stage]');
        const goodsSupplierButton = event.target.closest('[data-goods-supplier-index]');
        const worksStageButton = event.target.closest('[data-works-stage]');
        const worksContractorButton = event.target.closest('[data-works-contractor-index]');
        const serviceStageButton = event.target.closest('[data-service-stage]');
        const serviceProviderButton = event.target.closest('[data-service-provider-index]');
        const consultancyStageButton = event.target.closest('[data-consultancy-stage]');
        const consultancyConsultantButton = event.target.closest('[data-consultancy-consultant-index]');
        const moveSupplierButton = event.target.closest('[data-evaluation-move-supplier]');
        const saveButton = event.target.closest('[data-evaluation-save-draft]');
        const completeButton = event.target.closest('[data-evaluation-complete]');
        const viewReportButton = event.target.closest('[data-evaluation-view-report]');
        const closeReportButton = event.target.closest('[data-evaluation-close-report]');
        const downloadReportButton = event.target.closest('[data-evaluation-download-report]');
        const documentActionButton = event.target.closest('[data-evaluation-document-action]');
        const bidReportButton = event.target.closest('[data-evaluation-bid-report-action]');

        if (!selectButton && !clearButton && !sectionButton && !goodsStageButton && !goodsSupplierButton && !worksStageButton && !worksContractorButton && !serviceStageButton && !serviceProviderButton && !consultancyStageButton && !consultancyConsultantButton && !moveSupplierButton && !saveButton && !completeButton && !viewReportButton && !closeReportButton && !downloadReportButton && !documentActionButton && !bidReportButton) return;

        event.preventDefault();

        if (bidReportButton) {
            const reference = bidReportButton.getAttribute('data-evaluation-bid-report-reference') || getSelectedEvaluationTenderReference();
            const bidderIndex = Number(bidReportButton.getAttribute('data-evaluation-bid-report-index') || 0);
            const action = bidReportButton.getAttribute('data-evaluation-bid-report-action') || 'view';
            if (action === 'download') downloadEvaluationSubmittedBidReport(reference, bidderIndex);
            else openEvaluationSubmittedBidReport(reference, bidderIndex);
            if (typeof appendProcurexAdminAudit === 'function') {
                const adminOversight = isEvaluationAdminOversightSession();
                appendProcurexAdminAudit({
                    action: `${adminOversight ? 'System Admin' : 'Buyer'} ${action === 'download' ? 'downloaded' : 'viewed'} submitted bid report`,
                    entityType: 'Submitted Bid Report',
                    entityRef: reference,
                    ref: reference,
                    actorRole: adminOversight ? 'System Admin' : 'Buyer',
                    severity: 'info',
                    summary: `Submitted bid report for supplier ${bidderIndex + 1} was ${action === 'download' ? 'downloaded' : 'viewed'} during evaluation.`
                });
            }
            return;
        }

        if (documentActionButton) {
            const documentId = documentActionButton.getAttribute('data-evaluation-document-id') || '';
            const action = documentActionButton.getAttribute('data-evaluation-document-action') || 'view';
            if (action === 'download') downloadEvaluationEvidenceDocument(documentId);
            else openEvaluationEvidenceDocument(documentId);
            if (typeof appendProcurexAdminAudit === 'function') {
                const adminOversight = isEvaluationAdminOversightSession();
                appendProcurexAdminAudit({
                    action: `${adminOversight ? 'System Admin' : 'Buyer'} ${action === 'download' ? 'downloaded' : 'viewed'} evidence`,
                    entityType: 'Evaluation Evidence',
                    entityRef: getSelectedEvaluationTenderReference(),
                    actorRole: adminOversight ? 'System Admin' : 'Buyer',
                    severity: 'info',
                    summary: `Evidence document ${documentId} was ${action === 'download' ? 'downloaded' : 'viewed'} during evaluation.`
                });
            }
            return;
        }

        if (selectButton) {
            setSelectedEvaluationTender(selectButton.getAttribute('data-evaluation-select') || '');
        } else if (clearButton) {
            setSelectedEvaluationTender('');
            setSelectedEvaluationReport('');
        } else if (sectionButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            draft.currentSectionId = sectionButton.getAttribute('data-evaluation-section') || 'supplier-info';
            saveEvaluationDraft(reference, draft);
        } else if (goodsStageButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            draft.goods = {
                ...(draft.goods || {}),
                currentStageId: goodsStageButton.getAttribute('data-goods-stage') || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (goodsSupplierButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            const nextIndex = Number(goodsSupplierButton.getAttribute('data-goods-supplier-index') || 0);
            draft.currentSupplierIndex = nextIndex;
            draft.goods = {
                ...(draft.goods || {}),
                currentSupplierIndex: nextIndex,
                currentStageId: draft.goods?.currentStageId || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (worksStageButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            draft.works = {
                ...(draft.works || {}),
                currentStageId: worksStageButton.getAttribute('data-works-stage') || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (worksContractorButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            const nextIndex = Number(worksContractorButton.getAttribute('data-works-contractor-index') || 0);
            draft.currentSupplierIndex = nextIndex;
            draft.works = {
                ...(draft.works || {}),
                currentSupplierIndex: nextIndex,
                currentStageId: draft.works?.currentStageId || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (serviceStageButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            draft.services = {
                ...(draft.services || {}),
                currentStageId: serviceStageButton.getAttribute('data-service-stage') || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (serviceProviderButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            const nextIndex = Number(serviceProviderButton.getAttribute('data-service-provider-index') || 0);
            draft.currentSupplierIndex = nextIndex;
            draft.services = {
                ...(draft.services || {}),
                currentSupplierIndex: nextIndex,
                currentStageId: draft.services?.currentStageId || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (consultancyStageButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            draft.consultancy = {
                ...(draft.consultancy || {}),
                currentStageId: consultancyStageButton.getAttribute('data-consultancy-stage') || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (consultancyConsultantButton) {
            const reference = getSelectedEvaluationTenderReference();
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            const nextIndex = Number(consultancyConsultantButton.getAttribute('data-consultancy-consultant-index') || 0);
            draft.currentSupplierIndex = nextIndex;
            draft.consultancy = {
                ...(draft.consultancy || {}),
                currentSupplierIndex: nextIndex,
                currentStageId: draft.consultancy?.currentStageId || 'opening'
            };
            saveEvaluationDraft(reference, draft);
        } else if (moveSupplierButton) {
            const reference = getSelectedEvaluationTenderReference();
            const tender = getEvaluationTenderModel(reference);
            const bids = getEvaluationBidsForTender(tender);
            const draft = collectEvaluationDraftFromDom(reference, 'Saved as draft');
            const delta = Number(moveSupplierButton.getAttribute('data-evaluation-move-supplier') || 0);
            draft.currentSupplierIndex = Math.min(Math.max(Number(draft.currentSupplierIndex || 0) + delta, 0), Math.max(0, bids.length - 1));
            draft.currentSectionId = 'supplier-info';
            saveEvaluationDraft(reference, draft);
        } else if (saveButton) {
            const reference = saveButton.getAttribute('data-evaluation-save-draft') || getSelectedEvaluationTenderReference();
            if (isEvaluationAdminOversightSession()) {
                if (typeof appendProcurexAdminAudit === 'function') {
                    appendProcurexAdminAudit({ action: 'System Admin viewed buyer evaluation draft', entityType: 'Evaluation Oversight', entityRef: reference, ref: reference, actorRole: 'System Admin', summary: `Read-only oversight view opened for ${reference}.` });
                }
                setSelectedEvaluationTender('');
                if (window.app?.navigateTo) window.app.navigateTo('bid-evaluation');
                return;
            }
            saveEvaluationDraft(reference, collectEvaluationDraftFromDom(reference, 'Saved as draft'));
            if (typeof appendProcurexAdminAudit === 'function') {
                appendProcurexAdminAudit({ action: 'Buyer saved evaluation draft', entityType: 'Evaluation', entityRef: reference, ref: reference, actorRole: 'Buyer', summary: `Buyer evaluation draft saved for ${reference}.` });
            }
            setSelectedEvaluationTender('');
        } else if (completeButton) {
            const reference = completeButton.getAttribute('data-evaluation-complete') || getSelectedEvaluationTenderReference();
            if (isEvaluationAdminOversightSession()) {
                if (typeof appendProcurexAdminAudit === 'function') {
                    appendProcurexAdminAudit({ action: 'System Admin attempted read-only evaluation completion', entityType: 'Evaluation Oversight', entityRef: reference, ref: reference, actorRole: 'System Admin', severity: 'warning', summary: `Completion is restricted to buyer users for ${reference}.` });
                }
                return;
            }
            completeEvaluation(reference);
            if (typeof appendProcurexAdminAudit === 'function') {
                appendProcurexAdminAudit({ action: 'Buyer completed evaluation', entityType: 'Evaluation', entityRef: reference, ref: reference, actorRole: 'Buyer', severity: 'info', summary: `Buyer evaluation completed for ${reference}.` });
            }
        } else if (viewReportButton) {
            const reference = viewReportButton.getAttribute('data-evaluation-view-report') || getSelectedEvaluationTenderReference();
            if (!isEvaluationAdminOversightSession()) saveEvaluationDraft(reference, collectEvaluationDraftFromDom(reference, 'Saved as draft'));
            if (typeof appendProcurexAdminAudit === 'function') {
                const adminOversight = isEvaluationAdminOversightSession();
                appendProcurexAdminAudit({ action: `${adminOversight ? 'System Admin previewed buyer evaluation report' : 'Buyer previewed evaluation report'}`, entityType: 'Evaluation Report', entityRef: reference, ref: reference, actorRole: adminOversight ? 'System Admin' : 'Buyer', summary: `Evaluation report preview opened for ${reference}.` });
            }
            setSelectedEvaluationReport(reference);
        } else if (closeReportButton) {
            setSelectedEvaluationReport('');
        } else if (downloadReportButton) {
            const reference = downloadReportButton.getAttribute('data-evaluation-download-report') || getSelectedEvaluationReportReference() || getSelectedEvaluationTenderReference();
            const tender = getEvaluationTenderModel(reference);
            const html = renderEvaluationReportDocument(tender, getEvaluationBidsForTender(tender), getEvaluationDraft(reference) || {});
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
            if (typeof appendProcurexAdminAudit === 'function') {
                const adminOversight = isEvaluationAdminOversightSession();
                appendProcurexAdminAudit({ action: `${adminOversight ? 'System Admin exported buyer evaluation report' : 'Buyer exported evaluation report'}`, entityType: 'Evaluation Report', entityRef: reference, ref: reference, actorRole: adminOversight ? 'System Admin' : 'Buyer', summary: `Evaluation report exported for ${reference}.` });
            }
            return;
        }

        if (window.app?.navigateTo) {
            window.app.navigateTo('bid-evaluation', true, {
                preserveEvaluationSelection: Boolean(getSelectedEvaluationTenderReference() || getSelectedEvaluationReportReference())
            });
        }
    });

    document.addEventListener('input', (event) => {
        if (event.target.matches('[data-evaluation-list-search]')) {
            const panel = event.target.closest('[data-evaluation-tender-filter-panel]');
            const root = panel?.parentElement || document;
            const query = String(event.target.value || '').trim().toLowerCase();
            const status = panel?.querySelector('[data-evaluation-list-status]')?.value || '';
            const type = panel?.querySelector('[data-evaluation-list-type]')?.value || '';
            root.querySelectorAll('[data-evaluation-tender-row]').forEach(row => {
                const visible = (!query || String(row.dataset.search || '').includes(query))
                    && (!status || row.dataset.evaluationStatus === status)
                    && (!type || row.dataset.evaluationType === type);
                row.hidden = !visible;
            });
        }
        if (event.target.matches('[data-evaluation-evidence-search]')) {
            const root = event.target.closest('[data-evaluation-evidence-search-root]');
            const query = String(event.target.value || '').trim().toLowerCase();
            const section = root?.querySelector('[data-evaluation-evidence-section]')?.value || '';
            let count = 0;
            root?.querySelectorAll('[data-evaluation-evidence-row]').forEach(row => {
                const visible = (!query || String(row.dataset.search || '').includes(query))
                    && (!section || row.dataset.section === section);
                row.hidden = !visible;
                if (visible) count += 1;
            });
            const badge = root?.querySelector('[data-evaluation-evidence-count]');
            if (badge) badge.textContent = `${count} evidence row${count === 1 ? '' : 's'}`;
        }
    });

    document.addEventListener('change', (event) => {
        if (event.target.matches('[data-evaluation-list-status], [data-evaluation-list-type]')) {
            const panel = event.target.closest('[data-evaluation-tender-filter-panel]');
            const root = panel?.parentElement || document;
            const query = String(panel?.querySelector('[data-evaluation-list-search]')?.value || '').trim().toLowerCase();
            const status = panel?.querySelector('[data-evaluation-list-status]')?.value || '';
            const type = panel?.querySelector('[data-evaluation-list-type]')?.value || '';
            root.querySelectorAll('[data-evaluation-tender-row]').forEach(row => {
                const visible = (!query || String(row.dataset.search || '').includes(query))
                    && (!status || row.dataset.evaluationStatus === status)
                    && (!type || row.dataset.evaluationType === type);
                row.hidden = !visible;
            });
        }
        if (event.target.matches('[data-evaluation-evidence-section]')) {
            const root = event.target.closest('[data-evaluation-evidence-search-root]');
            const query = String(root?.querySelector('[data-evaluation-evidence-search]')?.value || '').trim().toLowerCase();
            const section = event.target.value || '';
            let count = 0;
            root?.querySelectorAll('[data-evaluation-evidence-row]').forEach(row => {
                const visible = (!query || String(row.dataset.search || '').includes(query))
                    && (!section || row.dataset.section === section);
                row.hidden = !visible;
                if (visible) count += 1;
            });
            const badge = root?.querySelector('[data-evaluation-evidence-count]');
            if (badge) badge.textContent = `${count} evidence row${count === 1 ? '' : 's'}`;
        }
    });
}
