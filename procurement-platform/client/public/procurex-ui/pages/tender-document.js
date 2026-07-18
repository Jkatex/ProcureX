// Tender document PDF generation and print fallback.

const procurexTenderPdfDefaults = {
    margin: [8, 8, 10, 8],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
};

function escapeProcurexTenderPdfHtml(value = '') {
    if (typeof window.ProcureXShared?.escapeHtml === 'function') return window.ProcureXShared.escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isProcurexTenderPdfMeaningful(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(isProcurexTenderPdfMeaningful);
    if (typeof value === 'object') return Object.values(value).some(isProcurexTenderPdfMeaningful);
    return String(value).trim() !== '';
}

function humanizeProcurexTenderPdfKey(value = '') {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, letter => letter.toUpperCase());
}

function formatProcurexTenderPdfMoney(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || !amount) return 'Supplier priced';
    return `TZS ${Math.round(amount).toLocaleString('en-US')}`;
}

function formatProcurexTenderPdfDate(value) {
    if (!value) return 'Not set';
    const time = Date.parse(`${value}T00:00:00`);
    if (!Number.isFinite(time)) return String(value);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(time));
}

function getProcurexTenderPdfFilename(tender = {}) {
    const id = String(tender.id || 'Tender').replace(/[^\w-]+/g, '-');
    const title = String(tender.title || 'document')
        .trim()
        .replace(/[^\w\s-]+/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 70) || 'document';
    return `Tender-${id}-${title}.pdf`;
}

function getProcurexTenderAnnexFilename(tender = {}, annexName = 'annex') {
    const id = String(tender.id || 'Tender').replace(/[^\w-]+/g, '-');
    const annex = String(annexName || 'annex')
        .trim()
        .replace(/\.[a-z0-9]{2,6}$/i, '')
        .replace(/[^\w\s-]+/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'annex';
    return `Tender-${id}-${annex}.pdf`;
}

function getProcurexTenderPdfProfile(tender = {}) {
    if (typeof getCreateTenderTypeProfile === 'function') return getCreateTenderTypeProfile(tender);
    return {
        id: tender.procurementTypeId || 'works',
        commercialName: tender.commercialModel || 'Commercial Schedule',
        documentLabels: tender.documents || ['Tender document'],
        keyRequirements: [],
        planningDocuments: [],
        submissionDocuments: [],
        contractRequirements: [],
        evaluationFlow: [],
        bidderPreparation: [],
        evaluationCriteria: []
    };
}

function getProcurexTenderPdfTypeStandard(profile = {}) {
    const standards = {
        works: {
            invitation: 'Tenderers are invited to submit responsive bids for the works described in this document, including methodology, programme, personnel, equipment, compliance documents, and a priced BOQ.',
            scopeTitle: 'Works Scope, Specifications, and Drawings',
            commercialTitle: 'Bill of Quantities (BOQ)',
            responseFocus: 'construction methodology, site organization, safety controls, programme, key personnel, equipment availability, and contractor qualification evidence'
        },
        goods: {
            invitation: 'Tenderers are invited to supply goods that meet the stated technical specifications, quantities, delivery requirements, warranty terms, and compliance obligations.',
            scopeTitle: 'Goods Specifications and Delivery Requirements',
            commercialTitle: 'Quantity Schedule',
            responseFocus: 'technical compliance, product standards, delivery capacity, warranty support, manufacturer authorization, and quantity schedule pricing'
        },
        services: {
            invitation: 'Tenderers are invited to provide the required services in line with the scope, service levels, staffing, equipment, reporting, and performance standards in this document.',
            scopeTitle: 'Scope of Services and Service Levels',
            commercialTitle: 'Service Schedule',
            responseFocus: 'service methodology, staffing plan, SLA response, equipment readiness, experience evidence, reporting approach, and service rate schedule'
        },
        consultancy: {
            invitation: 'Tenderers are invited to submit consultancy proposals responding to the terms of reference, methodology requirements, key expert inputs, deliverables, and financial proposal structure.',
            scopeTitle: 'Terms of Reference',
            commercialTitle: 'Financial Proposal',
            responseFocus: 'understanding of the assignment, methodology, work plan, team composition, CVs, relevant experience, deliverables, and financial proposal'
        }
    };
    return standards[profile.id] || standards.works;
}

function getProcurexTenderPdfById(tenderId = '') {
    const selected = typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : null;
    const applyEffectiveTender = tender => (tender && typeof getEffectiveTender === 'function') ? getEffectiveTender(tender) : tender;
    if (!tenderId) return applyEffectiveTender(selected || (typeof mockData !== 'undefined' ? mockData.tenders?.[0] : null));

    const tenders = typeof getProcurexAllTenders === 'function'
        ? getProcurexAllTenders()
        : (typeof mockData !== 'undefined' ? mockData.tenders || [] : []);
    const tender = tenders.find(item => String(item.id) === String(tenderId));
    if (tender) return applyEffectiveTender(tender);

    if (typeof selectProcurexTender === 'function') selectProcurexTender(tenderId);
    return applyEffectiveTender(typeof getProcurexSelectedTender === 'function' ? getProcurexSelectedTender() : selected);
}

function getProcurexTenderPdfValueTitle(value, fallback = 'Item') {
    if (!value || typeof value !== 'object') return fallback;
    return [
        value.title,
        value.name,
        value.documentTitle,
        value.requirementName,
        value.deliverableName,
        value.activityTitle,
        value.positionTitle,
        value.workItem,
        value.itemDescription,
        value.productDescription,
        value.equipmentName,
        value.serviceTask,
        value.objectiveTitle,
        value.reportType,
        value.license,
        value.text
    ].find(isProcurexTenderPdfMeaningful) || fallback;
}

function renderProcurexTenderPdfList(items = [], emptyText = 'Not specified') {
    const values = (Array.isArray(items) ? items : String(items || '').split(','))
        .map(item => typeof item === 'object' ? getProcurexTenderPdfValueTitle(item, '') : String(item || '').trim())
        .filter(Boolean);
    if (!values.length) return `<p class="procurex-pdf-empty">${escapeProcurexTenderPdfHtml(emptyText)}</p>`;
    return `<ul class="procurex-pdf-list">${values.map(item => `<li>${escapeProcurexTenderPdfHtml(item)}</li>`).join('')}</ul>`;
}

function getProcurexTenderPdfSubmissionDocuments(tender = {}, profile = {}) {
    const seen = new Set();
    return [
        ...(profile.submissionDocuments || []),
        ...(tender.requiredSubmissionDocuments || [])
    ]
        .map(item => typeof item === 'object' ? getProcurexTenderPdfValueTitle(item, '') : String(item || '').trim())
        .filter(Boolean)
        .filter(item => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getProcurexTenderPdfEligibilityComplianceItems(tender = {}, profile = {}) {
    const seen = new Set();
    return [
        ...(tender.regulatoryLicenses || []).map(license => [
            license.license || license.registrationType || license.regulatoryBody || 'Regulatory license',
            license.body || license.group || ''
        ].filter(Boolean).join(' - ')),
        ...getProcurexTenderPdfSubmissionDocuments(tender, profile)
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

function renderProcurexTenderPdfValue(value) {
    if (!isProcurexTenderPdfMeaningful(value)) return '<span class="procurex-pdf-muted">Not specified</span>';
    if (Array.isArray(value)) {
        if (value.every(item => typeof item !== 'object')) return renderProcurexTenderPdfList(value);
        return renderProcurexTenderPdfObjectTable(value);
    }
    if (typeof value === 'object') return renderProcurexTenderPdfObjectTable([value]);
    return `<span>${escapeProcurexTenderPdfHtml(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value)}</span>`;
}

function renderProcurexTenderPdfObjectTable(items = []) {
    const meaningfulItems = items.filter(isProcurexTenderPdfMeaningful);
    if (!meaningfulItems.length) return '<p class="procurex-pdf-empty">No information configured.</p>';

    const keys = [...new Set(meaningfulItems.flatMap(item => Object.keys(item).filter(key => isProcurexTenderPdfMeaningful(item[key]))))].slice(0, 6);
    if (!keys.length) return '<p class="procurex-pdf-empty">No information configured.</p>';

    return `
        <table class="procurex-pdf-table">
            <thead><tr>${keys.map(key => `<th>${escapeProcurexTenderPdfHtml(humanizeProcurexTenderPdfKey(key))}</th>`).join('')}</tr></thead>
            <tbody>
                ${meaningfulItems.map(item => `
                    <tr>
                        ${keys.map(key => {
                            const value = item[key];
                            const display = typeof value === 'object'
                                ? (Array.isArray(value)
                                    ? value.map(entry => typeof entry === 'object' ? getProcurexTenderPdfValueTitle(entry, '') : entry).filter(Boolean).join(', ')
                                    : getProcurexTenderPdfValueTitle(value, 'Configured'))
                                : (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value ?? '');
                            return `<td>${escapeProcurexTenderPdfHtml(display)}</td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderProcurexTenderPdfInfoTable(rows = []) {
    const visibleRows = rows.filter(row => isProcurexTenderPdfMeaningful(row.value));
    if (!visibleRows.length) return '';
    return `
        <table class="procurex-pdf-info-table">
            <tbody>
                ${visibleRows.map(row => `
                    <tr>
                        <th>${escapeProcurexTenderPdfHtml(row.label)}</th>
                        <td>${escapeProcurexTenderPdfHtml(row.value)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderProcurexTenderPdfSection(number, title, content) {
    return `
        <section class="procurex-pdf-section">
            <div class="procurex-pdf-section-title">
                <span>${escapeProcurexTenderPdfHtml(number)}</span>
                <h2>${escapeProcurexTenderPdfHtml(title)}</h2>
            </div>
            <div class="procurex-pdf-section-body">${content}</div>
        </section>
    `;
}

function renderProcurexTenderPdfRequirements(tender = {}) {
    const fields = tender.requirements?.fields || {};
    const lists = tender.requirements?.lists || {};
    const fieldRows = Object.entries(fields).filter(([, value]) => isProcurexTenderPdfMeaningful(value));
    const listRows = Object.entries(lists).filter(([, value]) => isProcurexTenderPdfMeaningful(value));

    if (!fieldRows.length && !listRows.length) {
        return '<p class="procurex-pdf-empty">No structured requirement fields were configured.</p>';
    }

    return `
        ${fieldRows.length ? `
            <table class="procurex-pdf-info-table">
                <tbody>
                    ${fieldRows.map(([key, value]) => `
                        <tr>
                            <th>${escapeProcurexTenderPdfHtml(humanizeProcurexTenderPdfKey(key))}</th>
                            <td>${renderProcurexTenderPdfValue(value)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : ''}
        ${listRows.map(([key, value]) => `
            <h3>${escapeProcurexTenderPdfHtml(humanizeProcurexTenderPdfKey(key))}</h3>
            ${renderProcurexTenderPdfValue(value)}
        `).join('')}
    `;
}

function renderProcurexTenderPdfLicenses(tender = {}) {
    const licenses = tender.regulatoryLicenses || [];
    if (!licenses.length) return '<p class="procurex-pdf-empty">No regulatory licenses configured for this tender.</p>';
    return renderProcurexTenderPdfObjectTable(licenses);
}

function renderProcurexTenderPdfEvaluation(tender = {}, profile = {}) {
    const criteria = tender.evaluation?.criteria?.length
        ? tender.evaluation.criteria.map(item => ({
            criterion: item.name,
            weight: `${item.weight || 0}%`,
            focus: (item.subcriteria || []).join(', ') || 'Buyer-defined scoring focus'
        }))
        : (profile.evaluationCriteria || []).map(item => ({
            criterion: item[0],
            weight: `${item[1] || 0}%`,
            focus: item[2] || 'Buyer-defined scoring focus'
        }));
    if (!criteria.length) return '<p class="procurex-pdf-empty">No evaluation criteria configured.</p>';
    return renderProcurexTenderPdfObjectTable(criteria);
}

function renderProcurexTenderPdfTimeline(tender = {}) {
    const milestones = Array.isArray(tender.milestones) && tender.milestones.length
        ? tender.milestones
        : [
            { name: 'Clarification deadline', date: 'Before closing' },
            { name: 'Bid closing', date: tender.closingDate || 'Not set' },
            { name: 'Bid opening', date: tender.closingDate || 'After closing' },
            { name: 'Evaluation', date: 'After bid opening' }
        ];
    return renderProcurexTenderPdfObjectTable(milestones.map(item => ({
        milestone: item.name || item.title || 'Milestone',
        date: formatProcurexTenderPdfDate(item.date || item.targetDate)
    })));
}

function renderProcurexTenderPdfCommercial(tender = {}, profile = {}) {
    const items = typeof getBidWorkspaceCommercialItems === 'function'
        ? getBidWorkspaceCommercialItems(tender, profile)
        : (tender.commercialItems || tender.boqItems || []);
    if (!items.length) return '<p class="procurex-pdf-empty">No commercial schedule configured.</p>';

    return `
        <table class="procurex-pdf-table procurex-pdf-commercial-table">
            <thead><tr><th>Code</th><th>Requirement</th><th>Qty / Duration</th><th>Unit</th><th>Rate / Estimate</th><th>Total</th></tr></thead>
            <tbody>
                ${items.map((item, index) => {
                    const qty = Number(item.qty ?? item.quantity ?? 1) || 0;
                    const rate = Number(item.rate ?? item.unitPrice ?? 0) || 0;
                    const total = Number(item.total ?? item.totalPrice ?? (qty * rate)) || 0;
                    return `
                        <tr>
                            <td>${escapeProcurexTenderPdfHtml(item.item || item.itemNumber || `${index + 1}.1`)}</td>
                            <td>${escapeProcurexTenderPdfHtml(item.description || item.itemDescription || item.workItem || item.serviceTask || 'Tender requirement')}</td>
                            <td>${escapeProcurexTenderPdfHtml(qty || item.qty || item.quantity || 1)}</td>
                            <td>${escapeProcurexTenderPdfHtml(item.unit || item.unitOfMeasure || 'Lot')}</td>
                            <td>${escapeProcurexTenderPdfHtml(rate ? formatProcurexTenderPdfMoney(rate) : 'Supplier priced')}</td>
                            <td>${escapeProcurexTenderPdfHtml(total ? formatProcurexTenderPdfMoney(total) : 'Supplier priced')}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderProcurexTenderPdfActivity(tender = {}) {
    const clarifications = typeof getSupplierTenderClarifications === 'function'
        ? getSupplierTenderClarifications(tender)
        : (tender.clarifications || []);
    const amendments = tender.amendments || [];
    const rows = [
        ...clarifications.map(item => ({
            type: 'Clarification',
            title: item.title || item.question || 'Clarification',
            detail: item.question || item.detail || item.answer || item.status || 'Pending procuring entity response',
            status: item.status || 'Pending'
        })),
        ...amendments.map(item => ({
            type: 'Amendment',
            title: item.title || 'Amendment',
            detail: item.detail || item.status || 'No details provided',
            status: item.status || 'Published'
        }))
    ];
    if (!rows.length) return '<p class="procurex-pdf-empty">No clarifications or amendments have been published.</p>';
    return renderProcurexTenderPdfObjectTable(rows);
}

function renderProcurexTenderPdfResponseInstructions(tender = {}, profile = {}) {
    const requiredDocs = tender.requiredSubmissionDocuments?.length
        ? tender.requiredSubmissionDocuments
        : (profile.submissionDocuments || []);
    return `
        <p>Tenderers must structure the bid submission as the following steps. Each step should be complete, clearly labelled, and supported by uploaded evidence where required.</p>
        <table class="procurex-pdf-table">
            <thead><tr><th>Step</th><th>Contents</th><th>Primary evidence</th></tr></thead>
            <tbody>
                <tr><td>Step 1</td><td>Administrative Compliance</td><td>Bid submission letter, registrations, tax compliance, licenses, bid security, and authorizations.</td></tr>
                <tr><td>Step 2</td><td>Technical Response</td><td>Specification compliance matrix, methodology, personnel, equipment, experience, quality plan, and delivery approach.</td></tr>
                <tr><td>Step 3</td><td>Financial Offer</td><td>${escapeProcurexTenderPdfHtml(profile.commercialName || tender.commercialModel || 'Commercial schedule')}, price summary, taxes, currency, and bid validity.</td></tr>
                <tr><td>Step 4</td><td>Declarations and Contract Terms</td><td>Clause acknowledgements, deviation log, anti-corruption declaration, and authorized signatory confirmation.</td></tr>
                <tr><td>Annex</td><td>Uploaded Evidence Files</td><td>File manifest with names, sizes, upload timestamps, and integrity hashes.</td></tr>
            </tbody>
        </table>
        <h3>Required submission documents</h3>
        ${renderProcurexTenderPdfList(requiredDocs, 'No separate submission documents configured.')}
    `;
}

function renderProcurexTenderPdfDocument(tender = {}, options = {}) {
    const profile = getProcurexTenderPdfProfile(tender);
    const standard = getProcurexTenderPdfTypeStandard(profile);
    const documents = tender.documents?.length ? tender.documents : profile.documentLabels || ['Tender document'];
    const categories = tender.categories?.length ? tender.categories : [tender.category || tender.type].filter(Boolean);
    const eligibilityComplianceItems = getProcurexTenderPdfEligibilityComplianceItems(tender, profile);
    const requirementSet = typeof getSupplierTenderRequirementSet === 'function'
        ? getSupplierTenderRequirementSet(tender, profile)
        : { mandatory: [], optional: [] };
    const generatedAt = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date());

    return `
        <article class="procurex-tender-pdf" data-document-audience="${escapeProcurexTenderPdfHtml(options.audience || 'tenderer')}">
            <header class="procurex-pdf-cover">
                <div>
                    <span class="procurex-pdf-kicker">ProcureX Standard Tender Document</span>
                    <h1>${escapeProcurexTenderPdfHtml(tender.title || 'Tender document')}</h1>
                    <p>${escapeProcurexTenderPdfHtml(tender.organization || 'Procuring entity')}</p>
                </div>
                <div class="procurex-pdf-stamp">
                    <strong>${escapeProcurexTenderPdfHtml(tender.status || 'Open')}</strong>
                    <span>${escapeProcurexTenderPdfHtml(tender.type || profile.id || 'Tender')}</span>
                </div>
            </header>

            ${renderProcurexTenderPdfInfoTable([
                { label: 'Tender ID', value: tender.id },
                { label: 'Procuring entity', value: tender.organization },
                { label: 'Procurement type', value: tender.type || profile.id },
                { label: 'Procurement method', value: tender.method },
                { label: 'Visibility', value: tender.visibility },
                { label: 'Categories', value: categories.join(', ') },
                { label: 'Budget estimate', value: formatProcurexTenderPdfMoney(tender.budget) },
                { label: 'Closing date', value: formatProcurexTenderPdfDate(tender.closingDate) },
                { label: 'Location', value: tender.location },
                { label: 'Commercial model', value: tender.commercialModel || profile.commercialName },
                { label: 'Contract type', value: tender.contractType },
                { label: 'Generated', value: generatedAt }
            ])}

            ${renderProcurexTenderPdfSection('1', 'Invitation and Instructions to Tenderers', `
                <p>${escapeProcurexTenderPdfHtml(standard.invitation)}</p>
                <p>Tenderers must review the complete document, prepare all required responses, and submit a compliant bid before the closing deadline. The expected response focus is ${escapeProcurexTenderPdfHtml(standard.responseFocus)}.</p>
            `)}

            ${renderProcurexTenderPdfSection('2', standard.scopeTitle, `
                <p>${escapeProcurexTenderPdfHtml(tender.description || 'Review the structured scope and requirements configured by the procuring entity.')}</p>
                ${renderProcurexTenderPdfRequirements(tender)}
                <h3>Key requirements</h3>
                ${renderProcurexTenderPdfList(profile.keyRequirements || [])}
            `)}

            ${renderProcurexTenderPdfSection('3', 'Eligibility and Compliance Requirements', `
                ${renderProcurexTenderPdfList(eligibilityComplianceItems, 'No eligibility and compliance items configured.')}
            `)}

            ${renderProcurexTenderPdfSection('4', 'Documents and Annexes', `
                <h3>Tender pack</h3>
                ${renderProcurexTenderPdfList(documents)}
                <h3>Planning documents</h3>
                ${renderProcurexTenderPdfList(profile.planningDocuments || [])}
            `)}

            ${renderProcurexTenderPdfSection('5', 'Evaluation Criteria and Submission Responses', `
                ${renderProcurexTenderPdfEvaluation(tender, profile)}
            `)}

            ${renderProcurexTenderPdfSection('5A', 'Bid Response Instructions', renderProcurexTenderPdfResponseInstructions(tender, profile))}

            ${renderProcurexTenderPdfSection('6', 'Programme and Key Dates', renderProcurexTenderPdfTimeline(tender))}

            ${renderProcurexTenderPdfSection('7', standard.commercialTitle || profile.commercialName || 'Commercial Schedule', renderProcurexTenderPdfCommercial(tender, profile))}

            ${renderProcurexTenderPdfSection('8', 'Deliverables and Contract Outputs', `
                ${renderProcurexTenderPdfList(tender.deliverables || [], 'No deliverables configured.')}
                <h3>Contract structure</h3>
                ${renderProcurexTenderPdfList(profile.contractRequirements || [])}
            `)}

            ${renderProcurexTenderPdfSection('9', 'Clarifications and Amendments', renderProcurexTenderPdfActivity(tender))}

            ${tender.amendmentAddendumText?.length ? renderProcurexTenderPdfSection('10', 'Published Addendum Text', renderProcurexTenderPdfList(tender.amendmentAddendumText)) : ''}
        </article>
    `;
}

function renderProcurexTenderAnnexDocument(tender = {}, annexName = '') {
    const profile = getProcurexTenderPdfProfile(tender);
    const generatedAt = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date());

    return `
        <article class="procurex-tender-pdf procurex-annex-pdf">
            <header class="procurex-pdf-cover">
                <div>
                    <span class="procurex-pdf-kicker">ProcureX Tender Annex</span>
                    <h1>${escapeProcurexTenderPdfHtml(annexName || 'Tender annex')}</h1>
                    <p>${escapeProcurexTenderPdfHtml(tender.title || 'Tender document')}</p>
                </div>
                <div class="procurex-pdf-stamp">
                    <strong>${escapeProcurexTenderPdfHtml(tender.id || 'Tender')}</strong>
                    <span>${escapeProcurexTenderPdfHtml(tender.type || profile.id || 'Annex')}</span>
                </div>
            </header>

            ${renderProcurexTenderPdfInfoTable([
                { label: 'Tender ID', value: tender.id },
                { label: 'Tender title', value: tender.title },
                { label: 'Procuring entity', value: tender.organization },
                { label: 'Procurement type', value: tender.type || profile.id },
                { label: 'Document name', value: annexName },
                { label: 'Status', value: 'Available to tenderers' },
                { label: 'Generated', value: generatedAt }
            ])}

            ${renderProcurexTenderPdfSection('1', 'Document Preview', `
                <p>This annex is part of the tender pack for tenderer review and download. In the production workflow this action opens the procuring entity-uploaded source file from secure document storage.</p>
                <p>Use this preview with the full tender document, commercial schedule, clarifications, and amendments before preparing a bid.</p>
            `)}

            ${renderProcurexTenderPdfSection('2', 'Tender Context', `
                <p>${escapeProcurexTenderPdfHtml(tender.description || 'Review this annex together with the tender scope and submission instructions.')}</p>
                <h3>Commercial model</h3>
                <p>${escapeProcurexTenderPdfHtml(tender.commercialModel || profile.commercialName || 'Commercial schedule')}</p>
            `)}
        </article>
    `;
}

function createProcurexTenderPdfContainer(tender = {}, options = {}) {
    const container = document.createElement('div');
    container.className = 'procurex-pdf-render-root';
    container.innerHTML = renderProcurexTenderPdfDocument(tender, options);
    document.body.appendChild(container);
    return container;
}

function createProcurexTenderAnnexContainer(tender = {}, annexName = '') {
    const container = document.createElement('div');
    container.className = 'procurex-pdf-render-root';
    container.innerHTML = renderProcurexTenderAnnexDocument(tender, annexName);
    document.body.appendChild(container);
    return container;
}

function openProcurexTenderPdfPrintFallback(tender = {}, options = {}) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('The PDF generator is unavailable and the browser blocked the print preview window.');
        return;
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => `<link rel="stylesheet" href="${escapeProcurexTenderPdfHtml(link.getAttribute('href'))}">`)
        .join('');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${escapeProcurexTenderPdfHtml(getProcurexTenderPdfFilename(tender))}</title>
                ${styles}
            </head>
            <body class="procurex-pdf-print-window">
                ${renderProcurexTenderPdfDocument(tender, options)}
            </body>
        </html>
    `);
    printWindow.document.close();
    alert('PDF generator is unavailable. A print-ready tender document opened; use the browser Save as PDF option.');
}

async function generateProcurexTenderPdf(tender = {}, options = {}) {
    if (typeof html2pdf !== 'function') {
        openProcurexTenderPdfPrintFallback(tender, options);
        return null;
    }

    const filename = getProcurexTenderPdfFilename(tender);
    const container = createProcurexTenderPdfContainer(tender, options);
    const pdfOptions = { ...procurexTenderPdfDefaults, filename };

    try {
        if (options.mode === 'download') {
            await html2pdf().set(pdfOptions).from(container.firstElementChild).save();
            return null;
        }
        const blob = await html2pdf().set(pdfOptions).from(container.firstElementChild).outputPdf('blob');
        return blob;
    } finally {
        container.remove();
    }
}

function openProcurexTenderAnnexPrintFallback(tender = {}, annexName = '') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('The annex viewer is unavailable and the browser blocked the preview window.');
        return;
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => `<link rel="stylesheet" href="${escapeProcurexTenderPdfHtml(link.getAttribute('href'))}">`)
        .join('');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${escapeProcurexTenderPdfHtml(getProcurexTenderAnnexFilename(tender, annexName))}</title>
                ${styles}
            </head>
            <body class="procurex-pdf-print-window">
                ${renderProcurexTenderAnnexDocument(tender, annexName)}
            </body>
        </html>
    `);
    printWindow.document.close();
    alert('PDF generator is unavailable. A print-ready annex opened; use the browser Save as PDF option.');
}

async function generateProcurexTenderAnnexPdf(tender = {}, annexName = '', options = {}) {
    if (typeof html2pdf !== 'function') {
        openProcurexTenderAnnexPrintFallback(tender, annexName);
        return null;
    }

    const filename = getProcurexTenderAnnexFilename(tender, annexName);
    const container = createProcurexTenderAnnexContainer(tender, annexName);
    const pdfOptions = { ...procurexTenderPdfDefaults, filename };

    try {
        if (options.mode === 'download') {
            await html2pdf().set(pdfOptions).from(container.firstElementChild).save();
            return null;
        }
        const blob = await html2pdf().set(pdfOptions).from(container.firstElementChild).outputPdf('blob');
        return blob;
    } finally {
        container.remove();
    }
}

async function openProcurexTenderPdf(tenderId = '', options = {}) {
    const tender = getProcurexTenderPdfById(tenderId);
    if (!tender) {
        alert('Tender document could not be found.');
        return;
    }

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
        pdfWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Preparing tender PDF...</p>');
    }

    const blob = await generateProcurexTenderPdf(tender, {
        ...options,
        audience: options.audience || (window.app?.currentPage === 'tender-details' ? 'owner' : 'tenderer'),
        mode: 'open'
    });
    if (!blob) {
        pdfWindow?.close();
        return;
    }

    const url = URL.createObjectURL(blob);
    if (pdfWindow) {
        pdfWindow.location.href = url;
    } else {
        window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function openProcurexTenderAnnex(tenderId = '', annexName = '') {
    const tender = getProcurexTenderPdfById(tenderId);
    if (!tender) {
        alert('Tender document could not be found.');
        return;
    }

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
        pdfWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Preparing annex preview...</p>');
    }

    const blob = await generateProcurexTenderAnnexPdf(tender, annexName, { mode: 'open' });
    if (!blob) {
        pdfWindow?.close();
        return;
    }

    const url = URL.createObjectURL(blob);
    if (pdfWindow) {
        pdfWindow.location.href = url;
    } else {
        window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadProcurexTenderPdf(tenderId = '', options = {}) {
    const tender = getProcurexTenderPdfById(tenderId);
    if (!tender) {
        alert('Tender document could not be found.');
        return;
    }
    await generateProcurexTenderPdf(tender, {
        ...options,
        audience: options.audience || (window.app?.currentPage === 'tender-details' ? 'owner' : 'tenderer'),
        mode: 'download'
    });
}

async function downloadProcurexTenderPdfPreview(tender = {}, options = {}) {
    if (!tender || typeof tender !== 'object') {
        alert('Tender document preview could not be prepared.');
        return;
    }
    await generateProcurexTenderPdf(tender, {
        ...options,
        audience: options.audience || 'owner',
        mode: 'download'
    });
}

async function downloadProcurexTenderAnnex(tenderId = '', annexName = '') {
    const tender = getProcurexTenderPdfById(tenderId);
    if (!tender) {
        alert('Tender document could not be found.');
        return;
    }
    await generateProcurexTenderAnnexPdf(tender, annexName, { mode: 'download' });
}

document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tender-pdf]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const tenderId = button.dataset.tenderId || '';
    const options = { audience: button.dataset.documentAudience || '' };
    if (button.dataset.tenderPdf === 'open') {
        openProcurexTenderPdf(tenderId, options);
    } else {
        downloadProcurexTenderPdf(tenderId, options);
    }
});

document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tender-annex-action]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const tenderId = button.dataset.tenderId || '';
    const annexName = button.dataset.annexName || 'Tender annex';
    if (button.dataset.tenderAnnexAction === 'view') {
        openProcurexTenderAnnex(tenderId, annexName);
    } else {
        downloadProcurexTenderAnnex(tenderId, annexName);
    }
});

window.openProcurexTenderPdf = openProcurexTenderPdf;
window.downloadProcurexTenderPdf = downloadProcurexTenderPdf;
window.downloadProcurexTenderPdfPreview = downloadProcurexTenderPdfPreview;
window.openProcurexTenderAnnex = openProcurexTenderAnnex;
window.downloadProcurexTenderAnnex = downloadProcurexTenderAnnex;
window.renderProcurexTenderPdfDocument = renderProcurexTenderPdfDocument;
