// Bidding Workspace Page Component (Supplier sealed bid flow)

const bidWorkspaceDraftStoragePrefix = 'procurex.supplierBidDraft.v1.';
const bidWorkspaceSubmittedStorageKey = 'procurex.bidWorkspaceSubmitted.v1';
const bidWorkspaceLegacySubmittedStorageKey = 'procurex.supplierSubmittedBids.v1';
const bidWorkspaceContractClauseFieldPattern = /contractclausecards$/i;
const bidWorkspaceUploadPreviewMaxBytes = 3 * 1024 * 1024;

function escapeBidWorkspaceHtml(value = '') {
    return String(value)
        .replace(/and/g, 'and')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function parseBidWorkspaceNumber(value) {
    if (typeof parseCreateTenderNumber === 'function') return parseCreateTenderNumber(value);
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatBidWorkspaceMoney(value) {
    if (typeof formatCreateTenderMoney === 'function') return formatCreateTenderMoney(value);
    return `TZS ${Math.round(parseBidWorkspaceNumber(value)).toLocaleString('en-US')}`;
}

function formatBidWorkspaceFileSize(value = 0) {
    const size = Number(value || 0);
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
}

function getBidWorkspaceTypeId(tender = {}) {
    if (typeof getCreateTenderTypeId === 'function') {
        return getCreateTenderTypeId(tender.procurementTypeId || tender.id || tender.type || tender.label);
    }
    const raw = String(tender.procurementTypeId || tender.type || 'works').toLowerCase();
    if (raw.includes('good')) return 'goods';
    if (raw.includes('consult')) return 'consultancy';
    if (raw.includes('service')) return 'services';
    return 'works';
}

function getBidWorkspaceTender() {
    const selectedTender = typeof getProcurexSelectedTender === 'function'
        ? getProcurexSelectedTender()
        : mockData.tenders[0];
    if (selectedTender && !selectedTender.createdByCurrentUser) return selectedTender;

    const marketplaceTender = typeof getProcurexMarketplaceTenders === 'function'
        ? getProcurexMarketplaceTenders().find(tender => !tender.createdByCurrentUser)
        : null;
    return marketplaceTender || selectedTender || mockData.tenders[0];
}

function getBidWorkspaceProfile(tender) {
    if (typeof getCreateTenderTypeProfile === 'function') return getCreateTenderTypeProfile(tender);
    return {
        id: getBidWorkspaceTypeId(tender),
        commercialName: 'Pricing Schedule',
        commercialTitle: 'Pricing Schedule',
        reviewLabel: 'Bid value',
        responseTitle: 'Technical Response',
        responseFields: ['Technical response', 'Delivery approach'],
        bidderPreparation: ['Technical response', 'Pricing schedule', 'Evidence documents'],
        submissionDocuments: ['Registration certificate', 'Tax clearance', 'Technical proposal'],
        defaultItems: [{ item: '1.1', description: 'Tender line item', qty: 1, unit: 'Lot', rate: 0 }],
        evaluationCriteria: [['Technical compliance', 40, 'Responsiveness'], ['Financial proposal', 60, 'Price']]
    };
}

function getBidWorkspaceCommercialItems(tender, profile) {
    const items = tender.commercialItems || tender.boqItems || profile.defaultItems || [];
    return items.length ? items : [{ item: '1.1', description: 'Tender requirement', qty: 1, unit: 'Lot', rate: tender.budget || 0 }];
}

function getBidWorkspaceAmount(items) {
    return items.reduce((total, item) => total + (parseBidWorkspaceNumber(item.qty) * parseBidWorkspaceNumber(item.rate)), 0);
}

function humanizeBidWorkspaceKey(value = '') {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, letter => letter.toUpperCase());
}

function getBidWorkspaceRequirementId(title = '', category = '', index = 0) {
    const base = `${category}-${title}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return base || `requirement-${index}`;
}

function isBidWorkspaceMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.values(value).some(isBidWorkspaceMeaningfulValue);
    return String(value).trim() !== '';
}

function normalizeBidWorkspaceFlag(value) {
    if (value === true) return true;
    if (value === false) return false;
    const raw = String(value ?? '').trim().toLowerCase();
    if (['true', 'yes', 'mandatory', 'required'].includes(raw)) return true;
    if (['false', 'no', 'not mandatory', 'optional'].includes(raw)) return false;
    return false;
}

function isBidWorkspaceRequiredConfig(value) {
    if (value === true) return true;
    const raw = String(value ?? '').trim().toLowerCase();
    return ['true', 'yes', 'mandatory', 'required', 'required if configured'].includes(raw);
}

function isBidWorkspaceCommercialLineNotBid(row) {
    const lineRow = row?.matches?.('tr') ? row : row?.closest?.('tr');
    const sourceRow = lineRow?.matches?.('.service-price-detail-row, .works-cost-detail-row')
        ? lineRow.previousElementSibling
        : lineRow;
    const status = sourceRow?.querySelector?.('[data-bid-line-status]');
    return String(status?.value || '').trim().toLowerCase() === 'not bid';
}

function getBidWorkspaceRequirementTitle(item = {}, fallback = 'Tender requirement') {
    const titleFields = [
        'requirementName',
        'documentTitle',
        'deliverableName',
        'positionTitle',
        'activityTitle',
        'responsibilityTitle',
        'responsibility',
        'staffRole',
        'reportType',
        'regulatoryBody',
        'registrationType',
        'itemDescription',
        'workItem',
        'productDescription',
        'serviceTask',
        'objectiveTitle',
        'clauseTitle',
        'milestone'
    ];
    const title = titleFields.map(field => item[field]).find(isBidWorkspaceMeaningfulValue);
    return String(title || fallback);
}

function getBidWorkspaceRequirementDescription(item = {}) {
    if (!item || typeof item !== 'object') return '';
    const skip = new Set(['id', 'mandatory', 'mandatoryActivity', 'required', 'requiresUpload', 'sampleRequired', 'file', 'upload']);
    const pairs = Object.entries(item)
        .filter(([key, value]) => !skip.has(key) && isBidWorkspaceMeaningfulValue(value))
        .slice(0, 4)
        .map(([key, value]) => {
            const formatted = Array.isArray(value)
                ? value.map(entry => typeof entry === 'object' ? getBidWorkspaceRequirementTitle(entry, '') : entry).filter(Boolean).join(', ')
                : typeof value === 'object'
                    ? getBidWorkspaceRequirementTitle(value, '')
                    : String(value);
            return `${humanizeBidWorkspaceKey(key)}: ${formatted}`;
        });
    return pairs.join(' / ');
}

function getBidWorkspaceResponseType(requirement = {}) {
    const text = `${requirement.title || ''} ${requirement.description || ''} ${requirement.category || ''}`.toLowerCase();
    if (requirement.responseType) return requirement.responseType;
    if (/upload|file|certificate|license|registration|tax|bank|statement|audited|authorization|cv|evidence|security|insurance|proof/.test(text)) return 'upload';
    if (/declaration|acknowledge|confirm|eligibility|conflict|confidentiality|anti-corruption|anti corruption/.test(text)) return 'checkbox';
    if (/price|financial|fee|rate|cost|boq|quantity schedule/.test(text)) return 'financial';
    return 'text';
}

function getBidWorkspaceRequirementSet(tender = {}, profile = getBidWorkspaceProfile(tender)) {
    const mandatory = [];
    const optional = [];
    const seen = new Set();
    let count = 0;

    const addRequirement = (requirement = {}) => {
        const title = String(requirement.title || '').trim();
        if (!title) return;
        const category = String(requirement.category || 'Tender requirement');
        const dedupeKey = `${category.toLowerCase()}::${title.toLowerCase()}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        const normalized = {
            id: requirement.id || getBidWorkspaceRequirementId(title, category, count),
            title,
            category,
            description: String(requirement.description || '').trim(),
            mandatory: requirement.mandatory !== false,
            responseType: getBidWorkspaceResponseType(requirement),
            source: requirement.source || 'buyer'
        };
        count += 1;
        (normalized.mandatory ? mandatory : optional).push(normalized);
    };

    (tender.regulatoryLicenses || []).forEach((license, index) => addRequirement({
        id: `regulatory-license-${index}`,
        title: license.license || license.registrationType || license.regulatoryBody || 'Regulatory license',
        category: 'Regulatory license',
        description: license.body || license.group || 'Upload current license evidence and expiry details where applicable.',
        mandatory: license.mandatory !== false,
        responseType: 'upload'
    }));

    addRequirement({
        title: 'Confirm eligibility to participate',
        category: 'Administrative compliance',
        description: tender.eligibility || 'Confirm that the supplier meets the eligibility rules defined by the buyer.',
        mandatory: true,
        responseType: 'checkbox',
        source: 'system'
    });

    const fields = tender.requirements?.fields || {};
    Object.entries(fields).forEach(([key, value]) => {
        if (bidWorkspaceContractClauseFieldPattern.test(key)) return;
        if (!isBidWorkspaceMeaningfulValue(value)) return;

        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (!isBidWorkspaceMeaningfulValue(item)) return;
                const objectItem = typeof item === 'object' ? item : { text: item };
                const hasMandatorySignal = ['mandatory', 'mandatoryActivity', 'required', 'sampleRequired', 'requiresUpload']
                    .some(field => Object.prototype.hasOwnProperty.call(objectItem, field));
                const title = getBidWorkspaceRequirementTitle(objectItem, `${humanizeBidWorkspaceKey(key)} ${index + 1}`);
                const description = getBidWorkspaceRequirementDescription(objectItem);
                addRequirement({
                    title,
                    category: humanizeBidWorkspaceKey(key),
                    description,
                    mandatory: hasMandatorySignal
                        ? ['mandatory', 'mandatoryActivity', 'required', 'sampleRequired'].some(field => normalizeBidWorkspaceFlag(objectItem[field]))
                        : false,
                    responseType: normalizeBidWorkspaceFlag(objectItem.requiresUpload) ? 'upload' : undefined
                });
            });
            return;
        }

        if (typeof value === 'boolean') {
            if (!value || !/required|mandatory|need|upload|cv|certificate|statement|license/i.test(key)) return;
            addRequirement({
                title: humanizeBidWorkspaceKey(key).replace(/\s+Required$/i, ''),
                category: 'Buyer requirement',
                description: 'Buyer marked this evidence as required for bid responsiveness.',
                mandatory: true
            });
            return;
        }

        if (/required|mandatory/i.test(key)) {
            addRequirement({
                title: humanizeBidWorkspaceKey(key),
                category: 'Buyer requirement',
                description: String(value),
                mandatory: true
            });
        }
    });

    Object.entries(tender.requirements?.lists || {}).forEach(([key, items]) => {
        (items || []).forEach((item, index) => {
            const text = typeof item === 'object' ? item.text : item;
            if (!String(text || '').trim()) return;
            addRequirement({
                title: String(text),
                category: humanizeBidWorkspaceKey(key),
                description: 'Respond to this buyer-defined tender item.',
                mandatory: /mandatory|required/i.test(key),
                responseType: 'text'
            });
        });
    });

    (profile.submissionDocuments || []).forEach((documentName, index) => {
        const text = String(documentName || '').toLowerCase();
        const conditionalProfileDocument = /vat|osha|safety|insurance|hse|method statement|gantt|work program|service methodology|signed financial|staff qualification/.test(text);
        const vatRequired = /vat/.test(text) && [fields.vatRequired, fields.requireVatCertificate, fields.vatRegistrationRequired].some(isBidWorkspaceRequiredConfig);
        const consultancyProfileDocument = profile.id === 'consultancy';
        addRequirement({
            id: `submission-document-${index}`,
            title: documentName,
            category: 'Submission document',
            description: conditionalProfileDocument
                ? 'Required only when the tender configuration makes this evidence applicable.'
                : 'Attach or describe the evidence required for this bid.',
            mandatory: consultancyProfileDocument ? false : (vatRequired || (index < 3 && !conditionalProfileDocument)),
            responseType: 'upload',
            source: 'profile'
        });
    });

    addRequirement({
        title: `Complete ${profile.commercialName || 'pricing schedule'}`,
        category: 'Financial offer',
        description: 'Enter rates, fees, or offer values for the commercial schedule defined in this tender.',
        mandatory: false,
        responseType: 'financial',
        source: 'system'
    });

    (profile.bidderPreparation || []).forEach((item, index) => addRequirement({
        id: `bidder-preparation-${index}`,
        title: item,
        category: 'Bid preparation',
        description: 'Complete this response inside the bid submission wizard.',
        mandatory: false,
        responseType: getBidWorkspaceResponseType({ title: item })
    }));

    return { mandatory, optional };
}

function getBidWorkspaceRawValueSummary(value) {
    if (!isBidWorkspaceMeaningfulValue(value)) return '';
    if (Array.isArray(value)) {
        return value
            .map(item => typeof item === 'object' ? getBidWorkspaceRequirementTitle(item, '') : item)
            .filter(Boolean)
            .join(', ');
    }
    if (typeof value === 'object') return getBidWorkspaceRequirementDescription(value);
    return String(value);
}

function getBidWorkspaceRawRequirementResponseType(key = '', item = {}) {
    if (/quantityScheduleRows|boqRows|lumpSumPricingRows|commercial|pricingRows/i.test(key)) return 'view';
    if (item && typeof item === 'object') {
        if (normalizeBidWorkspaceFlag(item.requiresUpload) || normalizeBidWorkspaceFlag(item.cvRequired)) return 'upload';
        if (normalizeBidWorkspaceFlag(item.mandatory) || normalizeBidWorkspaceFlag(item.required) || normalizeBidWorkspaceFlag(item.sampleRequired)) {
            return getBidWorkspaceResponseType({
                title: getBidWorkspaceRequirementTitle(item, key),
                description: getBidWorkspaceRequirementDescription(item),
                category: humanizeBidWorkspaceKey(key)
            });
        }
    }
    if (/required|mandatory|upload|cv|certificate|statement|license|evidence|declaration|confirm/i.test(key)) {
        return getBidWorkspaceResponseType({ title: humanizeBidWorkspaceKey(key), category: humanizeBidWorkspaceKey(key) });
    }
    return 'view';
}

function isBidWorkspaceRawRequirementMandatory(key = '', item = {}) {
    if (/quantityScheduleRows|boqRows|lumpSumPricingRows|commercial|pricingRows/i.test(key)) return false;
    if (item && typeof item === 'object') {
        return ['mandatory', 'mandatoryActivity', 'required', 'sampleRequired', 'requiresUpload', 'cvRequired']
            .some(field => normalizeBidWorkspaceFlag(item[field]));
    }
    return /required|mandatory/i.test(key);
}

function getBidWorkspaceRawTenderRequirements(tender = {}) {
    const items = [];
    let count = 0;

    const addRawRequirement = (key, value, item = value, suffix = '') => {
        if (bidWorkspaceContractClauseFieldPattern.test(key)) return;
        if (!isBidWorkspaceMeaningfulValue(value)) return;
        const category = humanizeBidWorkspaceKey(key);
        const objectItem = item && typeof item === 'object' ? item : { text: item };
        const title = typeof item === 'object'
            ? getBidWorkspaceRequirementTitle(objectItem, `${category}${suffix ? ` ${suffix}` : ''}`)
            : category;
        const description = typeof item === 'object'
            ? getBidWorkspaceRequirementDescription(objectItem)
            : getBidWorkspaceRawValueSummary(value);
        const responseType = getBidWorkspaceRawRequirementResponseType(key, objectItem);
        items.push({
            id: `raw-${getBidWorkspaceRequirementId(title, category, count)}`,
            title,
            category,
            description: description || getBidWorkspaceRawValueSummary(value) || 'Buyer-defined tender requirement.',
            mandatory: isBidWorkspaceRawRequirementMandatory(key, objectItem),
            responseType,
            source: responseType === 'view' ? 'tender-info' : 'tender-field'
        });
        count += 1;
    };

    Object.entries(tender.requirements?.fields || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item, index) => addRawRequirement(key, item, item, `${index + 1}`));
            return;
        }
        addRawRequirement(key, value, value);
    });

    Object.entries(tender.requirements?.lists || {}).forEach(([key, values]) => {
        (values || []).forEach((item, index) => addRawRequirement(key, item, item, `${index + 1}`));
    });

    return items;
}

function mergeBidWorkspaceRequirements(baseRequirements = [], rawRequirements = []) {
    const merged = [];
    const seen = new Set();
    [...baseRequirements, ...rawRequirements].forEach(requirement => {
        if (!requirement?.title) return;
        const key = getBidWorkspaceRequirementDedupeKey(requirement);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(requirement);
    });
    return merged;
}

function getBidWorkspaceRequirementDedupeKey(requirement = {}) {
    return `${String(requirement.category || '').trim().toLowerCase()}::${String(requirement.title || '').trim().toLowerCase()}`;
}

function getBidWorkspaceCompleteDynamicRequirements(tender = {}, baseRequirements = []) {
    return mergeBidWorkspaceRequirements(baseRequirements, getBidWorkspaceRawTenderRequirements(tender))
        .filter(requirement => !(requirement.source === 'system' && /financial offer/i.test(requirement.category || requirement.title || '')));
}

function getBidWorkspaceRequirementPriority(requirement = {}) {
    const category = String(requirement.category || '').toLowerCase();
    if (category.includes('regulatory license')) return 0;
    if (requirement.responseType === 'upload') return 1;
    if (category.includes('administrative')) return 2;
    return 3;
}

function sortBidWorkspaceRequirements(requirements = []) {
    return [...requirements].sort((first, second) => (
        getBidWorkspaceRequirementPriority(first) - getBidWorkspaceRequirementPriority(second)
        || String(first.category || '').localeCompare(String(second.category || ''))
        || String(first.title || '').localeCompare(String(second.title || ''))
    ));
}

function isBidWorkspaceGateRequirement(requirement = {}) {
    const category = String(requirement.category || '').toLowerCase();
    const title = String(requirement.title || '').toLowerCase();
    const text = `${category} ${title} ${requirement.description || ''}`.toLowerCase();
    if (category.includes('regulatory license')) return true;
    if (category.includes('administrative compliance')) return true;
    if (/technical proposal|methodology|work plan|cv|curriculum|key expert|team composition|experience matrix|commercial|financial proposal|priced|boq|schedule pricing|deliverable|reporting|staffing|equipment|sample|tor understanding/i.test(text)) return false;
    return /business license|certificate of incorporation|tax clearance|vat registration|registration certificate|audited financial statement|bank statement|bank letter|anti-corruption|conflict of interest|eligibility declaration/i.test(text);
}

function splitBidWorkspaceGateRequirements(requirements = []) {
    return {
        gate: sortBidWorkspaceRequirements(requirements.filter(isBidWorkspaceGateRequirement)),
        later: sortBidWorkspaceRequirements(requirements.filter(requirement => !isBidWorkspaceGateRequirement(requirement)))
    };
}

function isBidWorkspaceStepOneRequirement(requirement = {}) {
    return isBidWorkspaceGateRequirement(requirement);
}

function getBidWorkspaceStepOneRequirements(requirementSet = {}) {
    return sortBidWorkspaceRequirements([
        ...(requirementSet.mandatory || []),
        ...(requirementSet.optional || [])
    ].filter(isBidWorkspaceStepOneRequirement));
}

function renderBidWorkspaceRequirementSummary(requirements = []) {
    return requirements.map(requirement => `
        <article class="bid-requirement-summary-card">
            <span>${escapeBidWorkspaceHtml(requirement.category)}</span>
            <strong>${escapeBidWorkspaceHtml(requirement.title)}</strong>
            <small>${escapeBidWorkspaceHtml(requirement.description || 'Supplier response required.')}</small>
        </article>
    `).join('');
}

function getBidWorkspaceDraft(tenderId = 'selected') {
    try {
        const parsed = JSON.parse(localStorage.getItem(`${bidWorkspaceDraftStoragePrefix}${tenderId}`) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function saveBidWorkspaceDraft(tenderId = 'selected', draft = {}) {
    const payload = {
        ...draft,
        savedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(`${bidWorkspaceDraftStoragePrefix}${tenderId}`, JSON.stringify(payload));
    } catch (error) {
        const compactUploads = Object.fromEntries(Object.entries(payload.uploadedFiles || {}).map(([key, file]) => [key, {
            name: file?.name || '',
            type: file?.type || '',
            size: file?.size || 0,
            uploadedAt: file?.uploadedAt || '',
            sha256: file?.sha256 || file?.hash || ''
        }]));
        try {
            localStorage.setItem(`${bidWorkspaceDraftStoragePrefix}${tenderId}`, JSON.stringify({
                ...payload,
                uploadedFiles: compactUploads
            }));
        } catch (compactError) {
            console.warn('Unable to save full bid draft after upload preview was compacted.', compactError);
        }
    }
}

function getBidWorkspaceSavedResponse(draft = {}, requirementId = '') {
    return draft.responses?.[requirementId] ?? '';
}

function getBidWorkspaceUploadAccept(requirement = {}) {
    const text = `${requirement.title || ''} ${requirement.category || ''} ${requirement.description || ''}`.toLowerCase();
    if (/license|certificate|permit|registration|tax|bank|statement|audited|cv|evidence|authorization|policy|insurance/.test(text)) {
        return '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    }
    return '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
}

function renderBidWorkspaceRequirementInput(requirement, draft, required = false, workflowRequired = false) {
    const value = getBidWorkspaceSavedResponse(draft, requirement.id);
    const attrs = `data-bid-response="${escapeBidWorkspaceHtml(requirement.id)}" ${required ? 'data-bid-required-response="true"' : ''} ${workflowRequired ? 'data-bid-workflow-required-response="true"' : ''}`;
    const label = required ? 'Required response' : 'Optional response';

    if (requirement.responseType === 'checkbox') {
        return `
            <label class="bid-response-check">
                <input type="checkbox" ${attrs} ${value === true || value === 'true' ? 'checked' : ''}>
                <span>I confirm and accept this requirement.</span>
            </label>
        `;
    }

    if (requirement.responseType === 'upload') {
        return `
            <div class="bid-upload-response" data-bid-upload-control>
                <span>${required ? 'Upload mandatory evidence' : 'Upload evidence'}</span>
                <input class="form-input" type="file" data-bid-file-input accept="${getBidWorkspaceUploadAccept(requirement)}" aria-label="${label}">
                <input type="hidden" ${attrs} value="${escapeBidWorkspaceHtml(value)}">
                <small data-bid-file-name>${value ? `Selected: ${escapeBidWorkspaceHtml(value)}` : 'No file selected yet.'}</small>
            </div>
        `;
    }

    if (requirement.responseType === 'financial') {
        return `
            <input class="form-input" type="number" min="0" step="1000" ${attrs} value="${escapeBidWorkspaceHtml(value)}" placeholder="Enter amount or confirm pricing schedule" aria-label="${label}">
        `;
    }

    return `
        <textarea class="form-input" rows="3" ${attrs} placeholder="Write your response" aria-label="${label}">${escapeBidWorkspaceHtml(value)}</textarea>
    `;
}

function isBidWorkspaceResponseRequirement(requirement = {}) {
    const category = String(requirement.category || '').toLowerCase();
    const title = String(requirement.title || '').toLowerCase();
    const text = `${category} ${title} ${requirement.description || ''}`.toLowerCase();
    if (/financial offer|quantity schedule|boq|bill of quantities|pricing schedule|commercial schedule|lump sum pricing/.test(text)) return false;
    if (requirement.mandatory) return true;
    if (['upload', 'financial', 'checkbox'].includes(requirement.responseType)) return true;
    if (['profile', 'system'].includes(requirement.source)) return true;
    if (/bid preparation|submission document|financial offer|personnel|staffing|key expert|equipment|supporting document|insurance|sample|environmental|social|deliverable|reporting/i.test(category)) return true;
    if (/proposal|methodology|work plan|cv|certificate|upload|attach|respond|response|price|rate|fee|declaration|confirm/i.test(text)) return true;
    return false;
}

function groupBidWorkspaceRequirementsByCategory(requirements = []) {
    return sortBidWorkspaceRequirements(requirements).reduce((groups, requirement) => {
        const category = requirement.category || 'Tender requirement';
        if (!groups[category]) groups[category] = [];
        groups[category].push(requirement);
        return groups;
    }, {});
}

function renderBidWorkspaceResponseRequirementCard(requirement, draft) {
    const workflowRequired = requirement.mandatory || requirement.source === 'profile' || requirement.responseType === 'upload';
    return `
        <article class="bid-requirement-card response-card" data-bid-requirement-card="${escapeBidWorkspaceHtml(requirement.id)}" data-bid-requirement-category="${escapeBidWorkspaceHtml(requirement.category)}" data-bid-requirement-response-type="${escapeBidWorkspaceHtml(requirement.responseType)}">
            <div class="bid-response-card-heading">
                <div>
                    <span class="section-kicker">${escapeBidWorkspaceHtml(requirement.category)}</span>
                    <h3>${escapeBidWorkspaceHtml(requirement.title)}</h3>
                    <p>${escapeBidWorkspaceHtml(requirement.description || 'Supplier response required.')}</p>
                </div>
                <em class="badge ${workflowRequired ? 'badge-warning' : 'badge-info'}">${workflowRequired ? 'Response required' : 'Optional response'}</em>
            </div>
            ${renderBidWorkspaceRequirementInput(requirement, draft, false, workflowRequired)}
        </article>
    `;
}

function renderBidWorkspaceReadOnlyRequirementCard(requirement) {
    return `
        <article class="bid-requirement-card view-only-card">
            <div class="bid-response-card-heading">
                <div>
                    <span class="section-kicker">${escapeBidWorkspaceHtml(requirement.category)}</span>
                    <h3>${escapeBidWorkspaceHtml(requirement.title)}</h3>
                    <p>${escapeBidWorkspaceHtml(requirement.description || 'Review this buyer requirement while preparing your response.')}</p>
                </div>
                <em class="badge badge-info">For review</em>
            </div>
        </article>
    `;
}

function renderBidWorkspaceRequirementGroups(requirements = [], draft = {}, responseMode = true) {
    const groups = groupBidWorkspaceRequirementsByCategory(requirements);
    const entries = Object.entries(groups);
    if (!entries.length) return '<div class="scope-empty">No requirements configured for this section.</div>';
    return entries.map(([category, items]) => `
        <section class="bid-dynamic-group">
            <div class="bid-dynamic-group-heading">
                <h3>${escapeBidWorkspaceHtml(category)}</h3>
                <span class="badge badge-info">${items.length} item${items.length === 1 ? '' : 's'}</span>
            </div>
            <div class="bid-requirement-list">
                ${items.map(requirement => responseMode
                    ? renderBidWorkspaceResponseRequirementCard(requirement, draft)
                    : renderBidWorkspaceReadOnlyRequirementCard(requirement)
                ).join('')}
            </div>
        </section>
    `).join('');
}

function renderBidWorkspaceDynamicResponses(requirements = [], draft = {}, responseFields = [], tender = {}, profile = {}) {
    const responseRequirements = sortBidWorkspaceRequirements(requirements.filter(isBidWorkspaceResponseRequirement));
    const viewOnlyRequirements = sortBidWorkspaceRequirements(requirements.filter(requirement => !isBidWorkspaceResponseRequirement(requirement)));
    return `
        <div class="bid-dynamic-summary">
            <div><span>Response required</span><strong>${responseRequirements.length}</strong></div>
            <div><span>For review</span><strong>${viewOnlyRequirements.length}</strong></div>
            <div><span>Generated from</span><strong>${escapeBidWorkspaceHtml(tender.type || 'Tender')}</strong></div>
        </div>
        <section class="bid-dynamic-group">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Core technical response</h3>
                    <p>Respond to the primary buyer response fields for this tender type.</p>
                </div>
                <span class="badge badge-warning">Response required</span>
            </div>
            <div class="form-grid two">
                <div class="form-group"><label class="form-label">${escapeBidWorkspaceHtml(responseFields[0] || 'Technical response')}</label><textarea class="form-input" rows="5" data-bid-free-response="technical">${escapeBidWorkspaceHtml(draft.freeResponses?.technical || `Response aligned to ${tender.description || tender.title}.`)}</textarea></div>
                <div class="form-group"><label class="form-label">${escapeBidWorkspaceHtml(responseFields[1] || 'Delivery approach')}</label><textarea class="form-input" rows="5" data-bid-free-response="approach">${escapeBidWorkspaceHtml(draft.freeResponses?.approach || `Approach for ${String(tender.type || '').toLowerCase()}, including resources, controls, timing, and handover.`)}</textarea></div>
            </div>
        </section>
        ${renderBidWorkspaceRequirementGroups(responseRequirements, draft, true)}
        ${viewOnlyRequirements.length ? `
            <section class="bid-dynamic-group view-only">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Buyer requirements for review</h3>
                        <p>These define scope, context, or constraints. No direct response is required in this step.</p>
                    </div>
                    <span class="badge badge-info">${viewOnlyRequirements.length} review</span>
                </div>
                ${renderBidWorkspaceRequirementGroups(viewOnlyRequirements, draft, false)}
            </section>
        ` : ''}
    `;
}

function renderBidWorkspaceRequirementCards(requirements = [], draft = {}, required = null) {
    if (!requirements.length) {
        return '<div class="scope-empty">No requirements were configured for this group.</div>';
    }
    return sortBidWorkspaceRequirements(requirements).map(requirement => {
        const isRequired = required === null ? Boolean(requirement.mandatory) : Boolean(required);
        return `
            <article class="bid-requirement-card" data-bid-requirement-card="${escapeBidWorkspaceHtml(requirement.id)}" data-bid-requirement-category="${escapeBidWorkspaceHtml(requirement.category)}" data-bid-requirement-response-type="${escapeBidWorkspaceHtml(requirement.responseType)}">
                <div class="bid-response-card-heading">
                    <div>
                        <span class="section-kicker">${escapeBidWorkspaceHtml(requirement.category)}</span>
                        <h3>${escapeBidWorkspaceHtml(requirement.title)}</h3>
                        <p>${escapeBidWorkspaceHtml(requirement.description || 'Supplier response required.')}</p>
                    </div>
                    <em class="badge ${isRequired ? 'badge-warning' : 'badge-info'}">${isRequired ? 'Mandatory' : 'Optional'}</em>
                </div>
                ${renderBidWorkspaceRequirementInput(requirement, draft, isRequired)}
            </article>
        `;
    }).join('');
}

function getBidWorkspaceRequirementSearchText(requirement = {}) {
    return `${requirement.category || ''} ${requirement.title || ''} ${requirement.description || ''}`.toLowerCase();
}

function isBidWorkspaceLicenseDocumentRequirement(requirement = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    return getBidWorkspaceRequirementPriority(requirement) === 0
        || /license|licence|certificate|certification|registration|incorporation|permit|tax clearance|vat|tin|regulatory/.test(text);
}

function isBidWorkspaceSubmissionDocumentRequirement(requirement = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    return /submission document|bid submission|tender submission|bid form|letter of bid|form of tender|power of attorney|authorization|authorisation|signed form/.test(text);
}

function isBidWorkspacePlanDocumentRequirement(requirement = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    return /technical proposal|methodology|method statement|work plan|delivery plan|implementation plan|project plan|quality plan|hse|health and safety|environmental|staffing|personnel|equipment|schedule|timeline|mobilization|mobilisation|approach/.test(text);
}

function isBidWorkspaceFinancialCapacityUploadRequirement(requirement = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    return /bank statement|bank statements|credit facility|financial capacity/.test(text);
}

function isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    return isBidWorkspaceFinancialCapacityUploadRequirement(requirement)
        || /financial proposal|financial offer|commercial offer|commercial schedule|priced|boq|bill of quantities|quantity schedule|pricing schedule|price schedule|rate schedule|service rate|monthly rate|signed financial/.test(text);
}

function isBidWorkspaceTechnicalEvidenceRequirement(requirement = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    return /technical proposal|technical response|methodology|method statement|work plan|delivery plan|implementation plan|project plan|quality plan|hse|health and safety|environmental|schedule|timeline|mobilization|mobilisation|approach|sample|catalogue|catalog|brochure|specification|warranty|inspection|testing|reporting|deliverable|tor understanding|staffing|personnel|cv|curriculum|key expert|team composition|experience matrix|equipment|proof/.test(text);
}

function isBidWorkspaceAdministrativeSubmissionUploadRequirement(requirement = {}) {
    if (!isBidWorkspaceSubmissionDocumentRequirement(requirement)) return false;
    return !isBidWorkspaceTechnicalEvidenceRequirement(requirement)
        && !isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement);
}

function isBidWorkspaceTechnicalUploadAlreadyStructured(requirement = {}, profile = {}) {
    const text = getBidWorkspaceRequirementSearchText(requirement);
    if (profile.id === 'works') {
        return /similar completed projects|completed projects|experience|key personnel cv|personnel|staffing|equipment proof|equipment|hse|health and safety|work methodology|construction schedule|technical proposal|method statement|gantt|work program|work programme|drawing|site visit/.test(text);
    }
    if (profile.id === 'services') {
        return /personnel|staffing|staff qualification|cv|equipment|service equipment|service locations|service deliverables|service milestones|service schedule|supporting document rows|sla|reporting template|environmental|labor|labour|worker safety/.test(text);
    }
    if (profile.id === 'goods') {
        return /product specification|quantity schedule|sample requirement rows/.test(text);
    }
    return false;
}

function getBidWorkspaceRequirementTitleDedupeKey(requirement = {}) {
    return String(requirement.title || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function dedupeBidWorkspaceRequirementsByTitle(requirements = []) {
    const seen = new Map();
    requirements.forEach(requirement => {
        const key = getBidWorkspaceRequirementTitleDedupeKey(requirement);
        if (!key) return;
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, requirement);
            return;
        }
        if (!existing.mandatory && requirement.mandatory) {
            seen.set(key, requirement);
            return;
        }
        if (!existing.description && requirement.description) {
            seen.set(key, { ...existing, description: requirement.description });
        }
    });
    return Array.from(seen.values());
}

function getBidWorkspaceTechnicalUploadRequirements(requirements = [], profile = {}) {
    return dedupeBidWorkspaceRequirementsByTitle(requirements.filter(requirement => (
        requirement.responseType === 'upload'
        && !isBidWorkspaceLicenseDocumentRequirement(requirement)
        && !isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement)
        && !isBidWorkspaceAdministrativeSubmissionUploadRequirement(requirement)
        && !isBidWorkspaceTechnicalUploadAlreadyStructured(requirement, profile)
    ))).map(requirement => ({
        ...requirement,
        category: isBidWorkspaceSubmissionDocumentRequirement(requirement)
            ? 'Technical requirement'
            : requirement.category,
        description: requirement.description || `Upload ${requirement.title} requested by the buyer for the technical response.`
    }));
}

function renderBidWorkspaceTechnicalUploadSection(requirements = [], draft = {}, title = 'Technical supporting uploads', description = 'Upload buyer-required technical evidence that is not a license, certificate, administrative submission document, or financial capacity document.') {
    const technicalRequirements = sortBidWorkspaceRequirements(requirements);
    if (!technicalRequirements.length) return '';
    const mandatoryCount = technicalRequirements.filter(requirement => Boolean(requirement.mandatory)).length;
    const optionalCount = Math.max(technicalRequirements.length - mandatoryCount, 0);
    return `
        <section class="bid-dynamic-group technical-upload-group">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>${escapeBidWorkspaceHtml(title)}</h3>
                    <p>${escapeBidWorkspaceHtml(description)}</p>
                </div>
                <span class="badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}">${mandatoryCount} mandatory / ${optionalCount} optional</span>
            </div>
            <div class="bid-requirement-list">
                ${renderBidWorkspaceRequirementCards(technicalRequirements, draft)}
            </div>
        </section>
    `;
}

function renderBidWorkspaceGateDocumentSection(index, kicker, title, description, requirements = [], draft = {}, emptyMessage = 'No documents were configured for this section.') {
    const mandatoryCount = requirements.filter(requirement => Boolean(requirement.mandatory)).length;
    const optionalCount = Math.max(requirements.length - mandatoryCount, 0);
    const badgeText = requirements.length
        ? `${mandatoryCount} mandatory / ${optionalCount} optional`
        : '0 documents';
    return `
        <div class="bid-gate-group">
            <div class="bid-gate-group-heading">
                <div>
                    <span class="section-kicker">${index}. ${escapeBidWorkspaceHtml(kicker)}</span>
                    <h3>${escapeBidWorkspaceHtml(title)}</h3>
                    <p>${escapeBidWorkspaceHtml(description)}</p>
                </div>
                <span class="badge ${mandatoryCount ? 'badge-warning' : 'badge-info'}">${badgeText}</span>
            </div>
            <div class="bid-requirement-list">
                ${requirements.length ? renderBidWorkspaceRequirementCards(requirements, draft) : `<div class="scope-empty">${escapeBidWorkspaceHtml(emptyMessage)}</div>`}
            </div>
        </div>
    `;
}

function renderBidWorkspaceMandatoryGate(requirements = [], draft = {}, tender = {}) {
    const sorted = sortBidWorkspaceRequirements(requirements);
    const uploadRequirements = sorted.filter(requirement => (
        requirement.responseType === 'upload'
        && !isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement)
    ));
    const matrixLicenseRows = getBidWorkspaceRegulatoryLicenseRows(tender);
    const hasLicenseMatrix = matrixLicenseRows.length > 0;
    const licenseRequirements = hasLicenseMatrix
        ? []
        : uploadRequirements.filter(isBidWorkspaceLicenseDocumentRequirement);
    const submissionRequirements = uploadRequirements.filter(requirement => (
        !isBidWorkspaceLicenseDocumentRequirement(requirement) && isBidWorkspaceAdministrativeSubmissionUploadRequirement(requirement)
    ));
    const otherDocumentRequirements = uploadRequirements.filter(requirement => (
        !isBidWorkspaceLicenseDocumentRequirement(requirement)
        && !submissionRequirements.includes(requirement)
        && !isBidWorkspaceTechnicalEvidenceRequirement(requirement)
    ));
    const declarationRequirements = sorted.filter(requirement => requirement.responseType !== 'upload');
    const mandatoryDeclarationCount = declarationRequirements.filter(requirement => Boolean(requirement.mandatory)).length;
    const documentSectionOffset = 2;
    const documentSections = [
        submissionRequirements.length ? renderBidWorkspaceGateDocumentSection(documentSectionOffset, 'Submission documents', 'Bid submission documents', 'Tender submission forms, signed bid documents, authorization letters, and buyer-required administrative submission files.', submissionRequirements, draft) : '',
        otherDocumentRequirements.length ? renderBidWorkspaceGateDocumentSection(documentSectionOffset + (submissionRequirements.length ? 1 : 0), 'Other documents', 'Other administrative supporting documents', 'Additional administrative evidence that is not a license, certification, technical upload, or financial capacity document.', otherDocumentRequirements, draft) : ''
    ].filter(Boolean).join('');
    const declarationIndex = documentSectionOffset + (submissionRequirements.length ? 1 : 0) + (otherDocumentRequirements.length ? 1 : 0);

    return `
        <div class="bid-prequalification-note">
            <strong>Eligibility and document requirements</strong>
            <span>Upload administrative eligibility documents and complete required confirmations before moving forward. Technical uploads are completed in the technical response steps, and financial capacity uploads are completed in the financial offer.</span>
        </div>
        ${renderBidWorkspaceLicenseEvidenceSection(licenseRequirements, draft, tender)}
        ${documentSections}
        <div class="bid-gate-group">
            <div class="bid-gate-group-heading">
                <div>
                    <span class="section-kicker">${declarationIndex}. Eligibility declarations/confirmations</span>
                    <h3>Administrative confirmations</h3>
                </div>
                <span class="badge ${mandatoryDeclarationCount ? 'badge-warning' : 'badge-info'}">${mandatoryDeclarationCount} mandatory</span>
            </div>
            <div class="bid-requirement-list">
                ${declarationRequirements.length ? renderBidWorkspaceRequirementCards(declarationRequirements, draft) : '<div class="scope-empty">No additional confirmations are required.</div>'}
            </div>
        </div>
    `;
}

function renderBidWorkspaceCommercialRows(items) {
    return items.map((item, index) => {
        const qty = parseBidWorkspaceNumber(item.qty || item.quantity) || 1;
        const rate = parseBidWorkspaceNumber(item.rate || item.unitPrice || item.amount);
        const bidderRate = Math.round(rate ? rate * 0.98 : 0);
        const description = item.description || item.itemDescription || item.workItem || item.serviceTask || item.deliverableName || 'Tender requirement';
        return `
            <tr>
                <td>${escapeBidWorkspaceHtml(item.item || item.itemNumber || `${index + 1}.1`)}</td>
                <td>${escapeBidWorkspaceHtml(description)}</td>
                <td>${escapeBidWorkspaceHtml(item.qty || item.quantity || 1)} ${escapeBidWorkspaceHtml(item.unit || item.unitOfMeasure || 'Lot')}</td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" value="${bidderRate}" data-bid-rate aria-label="Bid rate or fee"></td>
                <td data-bid-line-amount>${formatBidWorkspaceMoney(qty * bidderRate)}</td>
            </tr>
        `;
    }).join('');
}

function renderBidWorkspaceEvaluationRows(tender, profile) {
    const criteria = tender.evaluation?.criteria?.length
        ? tender.evaluation.criteria.map(item => [item.name, item.weight, (item.subcriteria || []).join(', ')])
        : (profile.evaluationCriteria || []);
    return criteria.map(item => `
        <tr>
            <td>${escapeBidWorkspaceHtml(item[0] || item.name || 'Criterion')}</td>
            <td>${escapeBidWorkspaceHtml(item[1] || item.weight || 0)}%</td>
            <td>${escapeBidWorkspaceHtml(item[2] || item.description || 'Buyer-defined evaluation requirement')}</td>
        </tr>
    `).join('');
}

function renderBidWorkspaceClarificationPrompt(label, category, context) {
    return `
        <div class="contextual-clarification-prompt">
            <span>${escapeBidWorkspaceHtml(label)}</span>
            <button class="btn btn-secondary" type="button" data-bid-ask-clarification data-clarification-category="${escapeBidWorkspaceHtml(category)}" data-clarification-context="${escapeBidWorkspaceHtml(context || label)}">Ask Buyer</button>
        </div>
    `;
}

function renderBidWorkspaceAssistancePanel(documents = []) {
    const primaryDocument = documents[0] || 'Tender document';
    return `
        <aside class="bid-assistance-panel">
            <span class="section-kicker">Bid Assistance</span>
            <button class="btn btn-secondary" type="button" data-bid-view-tender-detail>View Tender Details</button>
            <button class="btn btn-secondary" type="button" data-bid-ask-clarification data-clarification-category="Technical" data-clarification-context="General bid workspace question">Ask Clarification</button>
            <button class="btn btn-secondary" type="button">${escapeBidWorkspaceHtml(`Download ${primaryDocument}`)}</button>
            <button class="btn btn-secondary" type="button">Contact Procurement Office</button>
        </aside>
    `;
}

function getGoodsBidQuantityRows(tender = {}) {
    return tender.requirements?.fields?.quantityScheduleRows?.length
        ? tender.requirements.fields.quantityScheduleRows
        : (tender.commercialItems || tender.boqItems || []);
}

function getGoodsBidSpecificationCards(tender = {}) {
    return tender.requirements?.fields?.specificationCards || [];
}

function getGoodsBidSampleRows(tender = {}) {
    return tender.requirements?.fields?.sampleRequirementRows || [];
}

function getGoodsBidEligibilityRows(tender = {}) {
    return tender.requirements?.fields?.otherEligibilityRequirements || [];
}

function isGoodsBidSamplesRequired(tender = {}) {
    return String(tender.requirements?.fields?.requireSamples || '').toLowerCase() === 'yes'
        || getGoodsBidSampleRows(tender).length > 0;
}

function getGoodsBidItemDescription(item = {}, index = 0) {
    return item.itemDescription || item.description || item.workItem || item.serviceTask || item.productDescription || `Goods item ${index + 1}`;
}

const bidWorkspaceProductSpecStructuralColumns = [
    { id: 'itemNo', label: 'Item No.', required: true, locked: true, instructions: 'Buyer item number.' },
    { id: 'productName', label: 'Product Name', required: true, locked: true, instructions: 'Buyer product name.' },
    { id: 'quantity', label: 'Quantity', required: true, locked: true, instructions: 'Buyer required quantity.' }
];

const bidWorkspaceProductSpecDetailColumns = [
    ...bidWorkspaceProductSpecStructuralColumns,
    { id: 'specificationName', label: 'Specification', required: true, locked: false, instructions: 'Item-specific requirement.' },
    { id: 'acceptableRequirement', label: 'Specific Detail Required', required: false, locked: false, instructions: 'Optional buyer detail for this item specification.' }
];

function getBidWorkspaceProductSpecDraftRow(draft = {}, rowId = '') {
    return (draft.productSpecificationResponses || []).find(row => row.rowId === rowId) || {};
}

function isBidWorkspaceProductSpecDetailTemplate(template = {}) {
    const ids = new Set((template?.columns || []).map(column => column?.id));
    return ids.has('specificationName') || ids.has('acceptableRequirement');
}

function normalizeBidWorkspaceProductSpecDetailRow(row = {}, rowIndex = 0) {
    const values = row.values && typeof row.values === 'object' ? row.values : row;
    return {
        id: row.id || `product-spec-row-${rowIndex}`,
        sourceRowId: row.sourceRowId || '',
        values: {
            itemNo: values?.itemNo ?? String(rowIndex + 1),
            productName: values?.productName || `Product item ${rowIndex + 1}`,
            quantity: values?.quantity || '',
            specificationName: values?.specificationName || '',
            acceptableRequirement: values?.acceptableRequirement || values?.requiredSpecification || ''
        }
    };
}

function groupBidWorkspaceProductSpecRowsByItem(rows = []) {
    const groups = [];
    const groupMap = new Map();
    rows.forEach((row, index) => {
        const values = row.values || {};
        const key = row.sourceRowId || `${values.itemNo || index}::${values.productName || ''}::${values.quantity || ''}`;
        if (!groupMap.has(key)) {
            const group = {
                key,
                itemNo: values.itemNo || String(groups.length + 1),
                productName: values.productName || `Product item ${groups.length + 1}`,
                quantity: values.quantity || '',
                rows: []
            };
            groupMap.set(key, group);
            groups.push(group);
        }
        groupMap.get(key).rows.push(row);
    });
    return groups;
}

function getBidWorkspaceProductSpecItemResponseId(group = {}, suffix = '') {
    const base = String(group.key || `${group.itemNo || ''}-${group.productName || ''}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'item';
    return `goods-product-spec-item-${base}-${suffix}`;
}

function convertBidWorkspaceLegacyProductSpecRows(template = {}) {
    const structuralIds = new Set(bidWorkspaceProductSpecStructuralColumns.map(column => column.id));
    const detailIds = new Set(bidWorkspaceProductSpecDetailColumns.map(column => column.id));
    const legacyColumns = (template?.columns || []).filter(column => (
        column && !structuralIds.has(column.id) && !detailIds.has(column.id)
    ));
    return (template?.rows || []).flatMap((row, rowIndex) => {
        const values = row.values && typeof row.values === 'object' ? row.values : row;
        return legacyColumns
            .filter(column => String(values?.[column.id] || '').trim())
            .map(column => ({
                id: `${row.id || `product-spec-row-${rowIndex}`}-${column.id}`,
                values: {
                    itemNo: values?.itemNo ?? String(rowIndex + 1),
                    productName: values?.productName || `Product item ${rowIndex + 1}`,
                    quantity: values?.quantity || '',
                    specificationName: column.label || 'Specification',
                    acceptableRequirement: values?.[column.id] || ''
                }
            }));
    });
}

function normalizeBidWorkspaceProductSpecificationTemplate(tender = {}) {
    const template = tender.requirements?.fields?.productSpecificationTemplate;
    if (template?.columns?.length && template?.rows?.length) {
        return {
            allowSupplierComments: template.allowSupplierComments !== false,
            columns: bidWorkspaceProductSpecDetailColumns,
            rows: (isBidWorkspaceProductSpecDetailTemplate(template)
                ? template.rows
                : convertBidWorkspaceLegacyProductSpecRows(template)
            ).map((row, rowIndex) => normalizeBidWorkspaceProductSpecDetailRow(row, rowIndex))
        };
    }

    const quantityRows = getGoodsBidQuantityRows(tender);
    const specificationCards = getGoodsBidSpecificationCards(tender);
    const rows = (quantityRows.length ? quantityRows : specificationCards).flatMap((item, index) => {
        const spec = specificationCards[index] || {};
        const itemValues = {
                itemNo: item.itemNumber || item.item || String(index + 1),
                productName: getGoodsBidItemDescription(item, index),
                quantity: item.quantity || item.qty || '',
        };
        const fallbackSpecs = [
            { specificationName: 'Required Specification', acceptableRequirement: [spec.productDescription, spec.performanceSpecifications, spec.dimensions, spec.materialQuality, spec.installationRequirements].filter(Boolean).join(' / '), instructions: 'Buyer technical requirement.' },
            { specificationName: 'Brand/Equivalent', acceptableRequirement: spec.brandRequirements || '', instructions: 'Accepted brand or equivalent.' },
            { specificationName: 'Warranty', acceptableRequirement: spec.warrantyRequirements || '', instructions: 'Required warranty.' }
        ].filter(row => String(row.acceptableRequirement || '').trim());
        const responseRows = fallbackSpecs.length ? fallbackSpecs : [{
            specificationName: 'Supplier technical comments',
            acceptableRequirement: '',
            instructions: 'No buyer specification detail was provided for this item. Supplier can describe the offered item and note any assumptions.'
        }];
        return responseRows.map((row, specIndex) => ({
            id: item.id || spec.id ? `${item.id || spec.id}-${specIndex}` : `product-spec-fallback-${index}-${specIndex}`,
            values: {
                ...itemValues,
                unit: item.unitOfMeasure || item.unit || '',
                ...row
            }
        }));
    });
    return {
        allowSupplierComments: true,
        columns: bidWorkspaceProductSpecDetailColumns,
        rows
    };
}

function renderGoodsBidProductSpecificationResponse(tender = {}, draft = {}) {
    const template = normalizeBidWorkspaceProductSpecificationTemplate(tender);
    if (!template.rows.length) {
        return '<div class="scope-empty">No buyer product specification template was configured for this goods tender.</div>';
    }
    const itemGroups = groupBidWorkspaceProductSpecRowsByItem(template.rows);
    const templateStats = getBidWorkspaceTendererCsvTemplateStats(tender);

    return `
        <section class="product-spec-response">
            <div class="product-spec-response-actions">
                <button class="btn btn-secondary" type="button" data-bid-download-product-spec-template>${templateStats.hasBuyerSpecificationRows ? 'Download Buyer Specification CSV' : 'Download Item Response CSV'}</button>
                <span class="badge badge-warning">${template.rows.length} item ${templateStats.hasBuyerSpecificationRows ? 'specification' : 'response'}${template.rows.length === 1 ? '' : 's'}</span>
            </div>
            <div class="product-spec-item-grid">
                ${itemGroups.map((group, groupIndex) => `
                    <article class="product-spec-item-card product-spec-response-item">
                        <div class="product-spec-item-header">
                            <div>
                                <span class="section-kicker">Item ${escapeBidWorkspaceHtml(group.itemNo)}</span>
                                <h4>${escapeBidWorkspaceHtml(group.productName)}</h4>
                                <p>${escapeBidWorkspaceHtml(group.quantity || 0)} unit${Number(group.quantity) === 1 ? '' : 's'} required</p>
                            </div>
                            <span class="badge badge-info">${group.rows.length} specification${group.rows.length === 1 ? '' : 's'}</span>
                        </div>
                        <div class="product-spec-response-table-wrap">
                            <table class="product-spec-response-table product-spec-item-sheet">
                                <thead>
                                    <tr>
                                        ${group.rows.map(row => `
                                            <th>
                                                ${escapeBidWorkspaceHtml(row.values?.specificationName || 'Specification')}
                                                <small>${escapeBidWorkspaceHtml(row.values?.acceptableRequirement || 'No specific detail required')}</small>
                                            </th>
                                        `).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${group.rows.map((row, rowIndex) => {
                                            const response = getBidWorkspaceProductSpecDraftRow(draft, row.id);
                                            const absoluteRowIndex = `${groupIndex + 1}.${rowIndex + 1}`;
                                            const currentValue = response.complianceStatus === 'Compliant' || response.complianceStatus === true || response.complianceStatus === 'true' ? 'Compliant' : (response.complianceStatus === 'Not Compliant' || response.complianceStatus === false || response.complianceStatus === 'false' ? 'Not Compliant' : '');
                                            return `
                                                <td data-bid-product-spec-row="${escapeBidWorkspaceHtml(row.id)}">
                                                    <select class="form-input product-spec-compliance-dropdown" data-bid-product-spec-field="complianceStatus" aria-label="Compliance status for specification ${absoluteRowIndex}">
                                                        <option value="" ${currentValue === '' ? 'selected' : ''}>Select status</option>
                                                        <option value="Compliant" ${currentValue === 'Compliant' ? 'selected' : ''}>Comply</option>
                                                        <option value="Not Compliant" ${currentValue === 'Not Compliant' ? 'selected' : ''}>Not Comply</option>
                                                    </select>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="product-spec-item-response-fields">
                            <label class="form-group wide">
                                <span class="form-label">Supplier Short Specification</span>
                                <textarea class="form-input" rows="3" data-bid-response="${escapeBidWorkspaceHtml(getBidWorkspaceProductSpecItemResponseId(group, 'short-specification'))}" aria-label="Supplier short specification for ${escapeBidWorkspaceHtml(group.productName)}" placeholder="Optional short offered specification for this item">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, getBidWorkspaceProductSpecItemResponseId(group, 'short-specification')))}</textarea>
                            </label>
                            <div class="form-group">
                                ${renderBidWorkspaceUploadControl(getBidWorkspaceProductSpecItemResponseId(group, 'attachment'), draft, 'Attach item evidence', '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', false)}
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function getBidWorkspaceTendererCsvTemplateStats(tender = {}) {
    const template = normalizeBidWorkspaceProductSpecificationTemplate(tender);
    const quantityRows = getGoodsBidQuantityRows(tender);
    const configuredTemplate = tender.requirements?.fields?.productSpecificationTemplate;
    const hasConfiguredTemplateRows = Array.isArray(configuredTemplate?.rows) && configuredTemplate.rows.length > 0;
    const hasConfiguredSpecificationCards = getGoodsBidSpecificationCards(tender).some(spec => [
        spec.productDescription,
        spec.performanceSpecifications,
        spec.dimensions,
        spec.materialQuality,
        spec.installationRequirements,
        spec.brandRequirements,
        spec.warrantyRequirements
    ].some(value => String(value || '').trim()));
    return {
        hasBuyerSpecificationRows: hasConfiguredTemplateRows || hasConfiguredSpecificationCards,
        rowCount: template.rows.length || quantityRows.length
    };
}

function renderBidWorkspaceTendererCsvTemplatePanel(tender = {}) {
    const stats = getBidWorkspaceTendererCsvTemplateStats(tender);
    const description = stats.hasBuyerSpecificationRows
        ? 'Download the supplier response CSV with the buyer specification lines already prepared.'
        : 'Download a supplier response CSV using the goods line items while no buyer specification table is configured.';

    return `
        <section class="tenderer-template-download">
            <div>
                <span class="section-kicker">Tenderer template</span>
                <h3>Download CSV response template</h3>
                <p>${description}</p>
            </div>
            <div class="tenderer-template-actions">
                <span class="badge badge-info">${stats.rowCount} template row${stats.rowCount === 1 ? '' : 's'}</span>
                <button class="btn btn-secondary" type="button" data-bid-download-tenderer-csv-template>${stats.hasBuyerSpecificationRows ? 'Download CSV Template' : 'Download Item Response CSV'}</button>
                <label class="btn btn-secondary bid-csv-import-control">
                    Import CSV
                    <input type="file" accept=".csv,text/csv" data-bid-import-tenderer-csv>
                </label>
            </div>
            <p class="bid-csv-import-status" data-bid-import-tenderer-csv-status></p>
        </section>
    `;
}

function normalizeBidWorkspaceArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        return value.split(/\r?\n|;/).map(item => item.trim()).filter(Boolean);
    }
    return [];
}

function getBidWorkspaceContractClauses(tender = {}) {
    const fields = tender.requirements?.fields || {};
    const clauseGroups = Object.entries(fields)
        .filter(([key]) => bidWorkspaceContractClauseFieldPattern.test(key))
        .flatMap(([key, value]) => normalizeBidWorkspaceArray(value).map((item, index) => ({ key, item, index })));
    const tenderClauses = normalizeBidWorkspaceArray(tender.contractClauses).map((item, index) => ({ key: 'contractClauses', item, index }));
    return [...clauseGroups, ...tenderClauses].map((entry, index) => {
        const item = entry.item;
        if (typeof item === 'string') {
            return {
                id: `contract-clause-${index}`,
                title: item,
                description: 'Tender contract clause requiring bidder acknowledgment.'
            };
        }
        return {
            id: item.id || `contract-clause-${index}`,
            title: item.clauseTitle || item.title || item.clause || item.name || humanizeBidWorkspaceKey(entry.key),
            description: getBidWorkspaceRequirementDescription(item) || item.description || item.requirement || 'Tender contract clause requiring bidder acknowledgment.',
            mandatory: item.mandatory !== false
        };
    });
}

function renderBidWorkspaceContractTerms(tender = {}, profile = {}, draft = {}) {
    const clauses = getBidWorkspaceContractClauses(tender);
    if (!clauses.length) return '';
    return `
        <section class="bid-dynamic-group contract-terms-review">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Contract clauses deferred to award</h3>
                    <p>Contract clauses, payment schedules, retention, defects liability, performance security, and final execution are not part of bid submission. They are shown here only as tender context.</p>
                </div>
                <span class="badge badge-info">Awarding stage</span>
            </div>
            <div class="contract-clause-list">
                ${clauses.map((clause, index) => {
                    const baseId = `contract-clause-${index}`;
                    return `
                        <article class="contract-clause-card">
                            <span class="section-kicker">${escapeBidWorkspaceHtml(profile.responseTitle || 'Tender context')}</span>
                            <strong>${escapeBidWorkspaceHtml(clause.title)}</strong>
                            <p>${escapeBidWorkspaceHtml(clause.description)}</p>
                            <div class="form-group wide">
                                <label class="form-label">Bid-stage note</label>
                                <textarea class="form-input" rows="2" data-bid-response="${baseId}-bid-note" placeholder="Optional note for your internal review. Contract negotiation happens after award.">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-bid-note`))}</textarea>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function getBidWorkspaceRegulatoryLicenseRows(tender = {}) {
    const directRows = normalizeBidWorkspaceArray(tender.regulatoryLicenses);
    if (directRows.length) return directRows;
    const fields = tender.requirements?.fields || {};
    return [
        ...normalizeBidWorkspaceArray(fields.regulatoryLicenses),
        ...normalizeBidWorkspaceArray(fields.licenseRequirementRows),
        ...normalizeBidWorkspaceArray(fields.licenseRequirements)
    ];
}

function getBidWorkspaceLicenseTitle(item = {}, index = 0) {
    return item.license || item.licenseName || item.permitName || item.registrationType || item.name || item.title || item.requirement || `License ${index + 1}`;
}

function getBidWorkspaceLicenseIssuingBody(item = {}) {
    return item.body || item.issuingBody || item.issuingAuthority || item.regulatoryBody || item.authority || item.group || item.description || item.notes || 'Not specified';
}

function renderBidWorkspaceLicenseComplianceMatrix(tender = {}, draft = {}) {
    const rows = getBidWorkspaceRegulatoryLicenseRows(tender);
    if (!rows.length) return '';
    const consultancyPolicy = getBidWorkspaceTypeId(tender) === 'consultancy';
    const requiredCount = rows.filter(row => consultancyPolicy ? isConsultancyBidRequired(row) : true).length;
    return `
        <div class="bid-gate-group license-compliance-matrix">
            <div class="bid-gate-group-heading">
                <div>
                    <span class="section-kicker">1. Licenses and certifications</span>
                    <h3>Regulatory license evidence</h3>
                    <p>Upload the required license evidence in the table below. Each row shows the license name first and the issuing board or authority below it.</p>
                </div>
                <span class="badge ${requiredCount ? 'badge-warning' : 'badge-info'}">${requiredCount} mandatory / ${Math.max(rows.length - requiredCount, 0)} optional</span>
            </div>
            <div class="data-table">
                <table>
                    <thead><tr><th>Permit / license</th><th>Status</th><th>Evidence</th></tr></thead>
                    <tbody>
                        ${rows.map((row, index) => {
                            const item = typeof row === 'string' ? { licenseName: row } : row;
                            const baseId = `license-compliance-${index}`;
                            const title = getBidWorkspaceLicenseTitle(item, index);
                            const issuingBody = getBidWorkspaceLicenseIssuingBody(item);
                            const required = consultancyPolicy ? isConsultancyBidRequired(item) : true;
                            return `
                                <tr>
                                    <td>
                                        <div class="license-permit-cell">
                                            <strong>${escapeBidWorkspaceHtml(title)}</strong>
                                            <small><span>Issuing body</span>${escapeBidWorkspaceHtml(issuingBody)}</small>
                                        </div>
                                    </td>
                                    <td><select class="form-input" data-bid-response="${baseId}-status"><option value="">Select</option>${['Valid', 'Renewal in progress', 'Not applicable'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                                    <td>${renderBidWorkspaceUploadControl(`${baseId}-copy`, draft, 'Upload license evidence', '.pdf,.jpg,.jpeg,.png', required, required)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderBidWorkspaceLicenseEvidenceSection(licenseRequirements = [], draft = {}, tender = {}) {
    const matrix = renderBidWorkspaceLicenseComplianceMatrix(tender, draft);
    if (matrix) return matrix;
    return renderBidWorkspaceGateDocumentSection(
        1,
        'Licenses and certifications',
        'License and certification documents',
        'Business licenses, regulatory permits, registration certificates, and other eligibility certificates.',
        licenseRequirements,
        draft,
        'No license or certification document is required for this tender.'
    );
}

function getBidWorkspaceFinancialCapacityRows(tender = {}) {
    const fields = tender.requirements?.fields || {};
    const candidates = [
        fields.financialCapacityRows,
        fields.financialCapacityRequirements,
        fields.financialCapacityRequirementRows,
        fields.financialCapacityCards,
        fields.financialRequirementRows
    ].flatMap(normalizeBidWorkspaceArray);
    if (candidates.length) return candidates;
    if (normalizeBidWorkspaceFlag(fields.bankStatementsRequired)) {
        return [{
            requirement: 'Bank statements',
            minimumValue: fields.bankStatementPeriod || 'Buyer-specified period',
            evidence: 'Bank statement upload',
            mandatory: true
        }];
    }
    return [];
}

function renderBidWorkspaceFinancialCapacityMatrix(tender = {}, draft = {}, prefix = 'financial-capacity') {
    const rows = getBidWorkspaceFinancialCapacityRows(tender);
    if (!rows.length) return '';
    const consultancyPolicy = getBidWorkspaceTypeId(tender) === 'consultancy';
    const requiredCount = rows.filter(row => consultancyPolicy ? isConsultancyBidRequired(row) : row?.mandatory !== false).length;
    return `
        <section class="bid-dynamic-group financial-capacity-matrix">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Financial capacity response matrix</h3>
                    <p>Respond to each buyer financial capacity threshold with your value and supporting evidence.</p>
                </div>
                <span class="badge ${requiredCount ? 'badge-warning' : 'badge-info'}">${requiredCount} mandatory / ${Math.max(rows.length - requiredCount, 0)} optional</span>
            </div>
            <div class="data-table">
                <table>
                    <thead><tr><th>Buyer Requirement</th><th>Minimum / Period</th><th>Your Value</th><th>Evidence Note</th><th>Upload</th></tr></thead>
                    <tbody>
                        ${rows.map((row, index) => {
                            const item = typeof row === 'string' ? { requirement: row } : row;
                            const baseId = `${prefix}-${index}`;
                            const required = consultancyPolicy ? isConsultancyBidRequired(item) : item.mandatory !== false;
                            return `
                                <tr>
                                    <td><strong>${escapeBidWorkspaceHtml(item.requirement || item.requirementName || item.description || `Financial requirement ${index + 1}`)}</strong><small>${escapeBidWorkspaceHtml(item.evidence || item.notes || 'Financial capability evidence')}</small></td>
                                    <td>${escapeBidWorkspaceHtml(item.minimumValue || item.minimumAmount || item.period || item.threshold || 'Not specified')}</td>
                                    <td><input class="form-input" type="number" min="0" step="1000" data-bid-response="${baseId}-value" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-value`))}"></td>
                                    <td><textarea class="form-input" rows="2" data-bid-response="${baseId}-note">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-note`))}</textarea></td>
                                    <td>${renderBidWorkspaceUploadControl(`${baseId}-upload`, draft, 'Upload evidence', '.pdf,.doc,.docx,.xls,.xlsx', required)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderBidWorkspaceScoringGuidance(tender = {}, profile = {}, draft = {}, prefix = 'evaluation-guidance') {
    const criteria = tender.evaluation?.criteria?.length
        ? tender.evaluation.criteria
        : (profile.evaluationCriteria || []).map((item, index) => ({
            id: `profile-criterion-${index}`,
            name: item[0] || item.name || `Criterion ${index + 1}`,
            weight: item[1] || item.weight || 0,
            subcriteria: item[2] ? [item[2]] : (item.subcriteria || [])
        }));
    if (!criteria.length) return '';
    return `
        <section class="bid-dynamic-group scoring-guidance-panel">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Evaluation criteria response guide</h3>
                    <p>Use the published scoring criteria to organize evidence and make the evaluator's review traceable.</p>
                </div>
                <span class="badge badge-info">${criteria.length} criteria</span>
            </div>
            <div class="scoring-guidance-grid">
                ${criteria.map((criterion, index) => {
                    const id = `${prefix}-${criterion.id || getBidWorkspaceRequirementId(criterion.name || 'criterion', 'evaluation', index)}`;
                    return `
                        <article class="scoring-guidance-card">
                            <span class="section-kicker">${escapeBidWorkspaceHtml(criterion.weight || 0)}% weight</span>
                            <strong>${escapeBidWorkspaceHtml(criterion.name || `Criterion ${index + 1}`)}</strong>
                            <p>${escapeBidWorkspaceHtml((criterion.subcriteria || []).join(', ') || criterion.description || 'Buyer-defined evaluation criterion.')}</p>
                            <textarea class="form-input" rows="2" data-bid-response="${id}-response" placeholder="Explain where this response is addressed.">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${id}-response`))}</textarea>
                            ${renderBidWorkspaceUploadControl(`${id}-evidence`, draft, 'Attach evidence', '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', false)}
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function formatBidWorkspaceCsvCell(value = '') {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBidWorkspaceCsv(rows = [], filename = 'template.csv') {
    const csv = `\uFEFF${rows.map(row => row.map(formatBidWorkspaceCsvCell).join(',')).join('\r\n')}\r\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function parseBidWorkspaceCsv(text = '') {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const input = String(text || '').replace(/^\uFEFF/, '');
    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];
        const next = input[index + 1];
        if (quoted && char === '"' && next === '"') {
            cell += '"';
            index += 1;
            continue;
        }
        if (char === '"') {
            quoted = !quoted;
            continue;
        }
        if (!quoted && char === ',') {
            row.push(cell);
            cell = '';
            continue;
        }
        if (!quoted && (char === '\n' || char === '\r')) {
            if (char === '\r' && next === '\n') index += 1;
            row.push(cell);
            if (row.some(value => String(value || '').trim())) rows.push(row);
            row = [];
            cell = '';
            continue;
        }
        cell += char;
    }
    row.push(cell);
    if (row.some(value => String(value || '').trim())) rows.push(row);
    return rows;
}

function normalizeBidWorkspaceCsvHeader(value = '') {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function downloadBidWorkspaceBlob(content = '', filename = 'download.html', type = 'text/html;charset=utf-8') {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getBidWorkspaceSafeFilename(value = 'bid-response-document') {
    return String(value || 'bid-response-document')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'bid-response-document';
}

function downloadBidWorkspaceProductSpecificationCsv(tender = {}) {
    const template = normalizeBidWorkspaceProductSpecificationTemplate(tender);
    const stats = getBidWorkspaceTendererCsvTemplateStats(tender);
    const rows = [
        template.columns.map(column => column.label),
        ...template.rows.map(row => template.columns.map(column => row.values?.[column.id] || ''))
    ];
    downloadBidWorkspaceCsv(rows, stats.hasBuyerSpecificationRows ? 'buyer-product-specification-template.csv' : 'goods-item-response-template.csv');
}

function downloadBidWorkspaceTendererTechnicalResponseCsv(tender = {}) {
    const template = normalizeBidWorkspaceProductSpecificationTemplate(tender);
    const columns = [
        'Item No',
        'Requested Product',
        'Quantity',
        'Unit',
        'Buyer Specification',
        'Buyer Requirement',
        'Compliance Status',
        'Supplier Offered Specification',
        'Supporting Evidence File',
        'Remarks'
    ];
    const rows = template.rows.length
        ? template.rows.map(row => ([
            row.values?.itemNo || '',
            row.values?.productName || '',
            row.values?.quantity || '',
            row.values?.unit || '',
            row.values?.specificationName || '',
            row.values?.acceptableRequirement || '',
            '',
            '',
            '',
            ''
        ]))
        : getGoodsBidQuantityRows(tender).map((item, index) => ([
            item.itemNumber || item.item || String(index + 1),
            getGoodsBidItemDescription(item, index),
            item.quantity || item.qty || '',
            item.unitOfMeasure || item.unit || '',
            '',
            '',
            '',
            '',
            '',
            ''
        ]));
    downloadBidWorkspaceCsv([columns, ...rows], 'tenderer-technical-response-template.csv');
}

function formatBidWorkspaceReviewValue(value, options = {}) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (Array.isArray(value)) return value.map(entry => formatBidWorkspaceReviewValue(entry, options)).filter(Boolean).join(', ') || (options.mandatory ? 'Incomplete' : 'Not provided');
    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entryValue]) => isBidWorkspaceMeaningfulValue(entryValue))
            .map(([key, entryValue]) => `${humanizeBidWorkspaceKey(key)}: ${formatBidWorkspaceReviewValue(entryValue, options)}`)
            .join(' / ') || (options.mandatory ? 'Incomplete' : 'Not provided');
    }
    const text = String(value ?? '').trim();
    if (text) return text;
    return options.mandatory ? 'Incomplete' : 'Not provided';
}

function getProcurexBidPackageTenderMeta(tender = {}) {
    return [
        ['Tender ID', tender.id || tender.reference],
        ['Procuring entity', tender.organization],
        ['Procurement type', tender.type || tender.category],
        ['Procurement method', tender.method],
        ['Closing date', tender.closingDate],
        ['Location', tender.location],
        ['Budget estimate', tender.budget ? formatBidWorkspaceMoney(tender.budget) : 'Not stated'],
        ['Commercial model', tender.commercialModel || tender.contractType]
    ].filter(([, value]) => isBidWorkspaceMeaningfulValue(value));
}

function getProcurexBidPackageSupplierMeta(supplier = {}) {
    return [
        ['Supplier', supplier.name || supplier.supplier || mockData.users?.supplier?.organization || 'Supplier organization'],
        ['Registration', supplier.registrationNumber || supplier.registration || mockData.users?.supplier?.registrationNumber],
        ['Contact', supplier.contactPerson || supplier.contact || mockData.users?.supplier?.name],
        ['Submitted', supplier.submittedAt],
        ['Submission Receipt No', supplier.receiptHash],
        ['Bid total', supplier.total],
        ['Status', supplier.status || 'Draft package']
    ].filter(([, value]) => isBidWorkspaceMeaningfulValue(value));
}

function getProcurexBidPackageOfferLabel(tender = {}, profile = {}) {
    const typeId = profile.id || getBidWorkspaceTypeId(tender);
    if (typeId === 'goods') return 'Goods Offer';
    if (typeId === 'works') return 'Works Offer';
    if (typeId === 'services') return 'Service Offer';
    if (typeId === 'consultancy') return 'Consultancy Offer';
    return profile.responseTitle || 'Bid Offer';
}

function getProcurexBidPackageRowCategory(key = '', label = '') {
    const raw = `${key} ${label}`.toLowerCase();
    if (/declaration|confirm|signature|anti-corruption|representative|position/.test(raw)) return 'Declarations';
    if (/sample/.test(raw)) return 'Samples';
    if (/commercial|financial|price|pricing|currency|tax|discount|rate|amount|total|validity|boq|offer/.test(raw)) return 'Financial Offer';
    if (/technical|methodology|workplan|drawing|capacity|personnel|equipment|product|spec|brand|model|origin|warranty|delivery|service|sla|kpi|quality|compliance/.test(raw)) return 'Technical Response';
    if (/eligibility|document|license|certificate|registration|tax|upload|evidence|security|brochure|attachment|proof/.test(raw)) return 'Eligibility and Documents';
    return 'Additional Responses';
}

function getProcurexBidPackageCategoryFromPanel(title = '') {
    const raw = String(title || '').toLowerCase();
    if (/eligibility|document|license|gate|administrative|pre-qualification|prequalification/.test(raw)) return 'Step 1: Administrative Compliance';
    if (/technical|methodology|scope|specification|goods offer|works offer|service response|consultancy response|tor|personnel|equipment|capacity/.test(raw)) return 'Step 2: Technical Response';
    if (/financial|commercial|boq|price|pricing|offer value|quantity schedule/.test(raw)) return 'Step 3: Financial Offer';
    if (/contract|declaration|review|submit|validation|terms/.test(raw)) return 'Step 4: Declarations and Contract Terms';
    return 'Additional Responses';
}

function normalizeProcurexBidPackageCategory(category = '') {
    const raw = String(category || '').toLowerCase();
    if (raw.includes('administrative') || raw.includes('eligibility')) return 'Step 1: Administrative Compliance';
    if (raw.includes('technical')) return 'Step 2: Technical Response';
    if (raw.includes('financial')) return 'Step 3: Financial Offer';
    if (raw.includes('declaration') || raw.includes('contract') || raw.includes('outcome')) return 'Step 4: Declarations and Contract Terms';
    if (raw.includes('sample')) return 'Samples';
    return category || 'Additional Responses';
}

function getProcurexBidPackageCompleteness(sections = []) {
    const rows = sections.flatMap(section => section.rows || []);
    const mandatoryRows = rows.filter(row => row.mandatory);
    const optionalRows = rows.filter(row => !row.mandatory);
    const mandatoryComplete = mandatoryRows.filter(row => !row.pending).length;
    const optionalComplete = optionalRows.filter(row => !row.pending).length;
    const deviations = rows.filter(row => row.deviation).length;
    const percent = mandatoryRows.length
        ? Math.round((mandatoryComplete / mandatoryRows.length) * 100)
        : rows.length
            ? Math.round((rows.filter(row => !row.pending).length / rows.length) * 100)
            : 0;
    return {
        percent,
        mandatoryTotal: mandatoryRows.length,
        mandatoryComplete,
        optionalTotal: optionalRows.length,
        optionalComplete,
        deviations,
        totalRows: rows.length
    };
}

function getProcurexBidReviewRowStatus(row = {}) {
    if (row.pending && row.mandatory) return 'Incomplete';
    if (row.pending) return 'Not provided';
    if (row.deviation) return 'Needs correction';
    return row.mandatory ? 'Complete' : 'Provided';
}

function getProcurexBidReviewAction(row = {}) {
    if (row.action) return row.action;
    const label = String(row.label || 'this requirement').toLowerCase();
    if (row.pending && row.upload) return `Upload missing ${row.label || 'supporting evidence'}.`;
    if (row.pending && row.mandatory) {
        if (/status|compliance|comply/.test(label)) return 'Select compliance status.';
        if (/warranty/.test(label)) return 'Provide warranty period.';
        if (/catalog|brochure/.test(label)) return 'Attach product catalogue or brochure.';
        if (/tax/.test(label)) return 'Confirm tax inclusion.';
        if (/license|certificate|registration|evidence|proof|attachment/.test(label)) return `Upload missing ${row.label || 'document'}.`;
        return `Complete ${row.label || 'the required response'}.`;
    }
    if (row.pending) return 'Add response if applicable, or leave as not provided.';
    if (row.deviation) return 'Review the deviation before final submission.';
    return 'No action required.';
}

function getProcurexBidReviewPriority(row = {}, sectionTitle = '') {
    const title = String(sectionTitle || '').toLowerCase();
    if (row.pending && row.mandatory) return 'High';
    if (row.deviation || (/financial|offer|price|pricing/.test(title) && row.pending)) return 'Medium';
    return 'Low';
}

const procurexBidReviewPriorityOrder = { High: 0, Medium: 1, Low: 2 };

function getProcurexBidPackageActionRows(sections = []) {
    return sections
        .flatMap(section => (section.rows || []).map(row => ({ ...row, sectionTitle: section.title || 'Bid section' })))
        .filter(row => row.pending || row.deviation)
        .map(row => ({
            priority: getProcurexBidReviewPriority(row, row.sectionTitle),
            section: row.sectionTitle,
            issue: row.pending
                ? `${row.label || 'Requirement'} is ${row.mandatory ? 'mandatory and incomplete' : 'not provided'}`
                : `${row.label || 'Requirement'} has a deviation`,
            action: getProcurexBidReviewAction(row)
        }))
        .sort((a, b) => procurexBidReviewPriorityOrder[a.priority] - procurexBidReviewPriorityOrder[b.priority]);
}

function getProcurexBidPackageReadiness(completeness = {}, actionRows = []) {
    const missingMandatory = Math.max((completeness.mandatoryTotal || 0) - (completeness.mandatoryComplete || 0), 0);
    const highPriority = actionRows.filter(row => row.priority === 'High').length;
    return {
        missingMandatory,
        ready: missingMandatory === 0 && highPriority === 0,
        status: missingMandatory === 0 && highPriority === 0 ? 'Ready for final review' : `${missingMandatory || highPriority} required action${(missingMandatory || highPriority) === 1 ? '' : 's'} pending`
    };
}

function getProcurexBidPackageRowValue(sections = [], pattern) {
    const row = sections
        .flatMap(section => section.rows || [])
        .find(item => pattern.test(`${item.label || ''} ${item.requirement || ''}`));
    return row ? row.value : '';
}

function renderProcurexBidPackageActionSummary(actionRows = []) {
    return `
        <section class="bid-response-document-section bid-action-summary">
            <div class="bid-response-document-section-heading">
                <span>RA</span>
                <div>
                    <h4>Required Action Summary</h4>
                    <small>Supplier corrections to complete before final submission</small>
                </div>
            </div>
            ${actionRows.length ? `
                <div class="bid-response-document-table">
                    <table>
                        <thead><tr><th>Priority</th><th>Section</th><th>Issue</th><th>Required action</th></tr></thead>
                        <tbody>
                            ${actionRows.slice(0, 12).map(row => `
                                <tr>
                                    <td><span class="bid-action-priority ${row.priority.toLowerCase()}">${escapeBidWorkspaceHtml(row.priority)}</span></td>
                                    <td>${escapeBidWorkspaceHtml(row.section)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.issue)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.action)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="bid-review-positive-note">No missing mandatory items or supplier deviations are currently flagged. Review the detail sections before submission.</p>'}
        </section>
    `;
}

function renderProcurexBidPackageFinancialSummary(sections = [], supplier = {}) {
    if (sections.some(section => section.financialOfferRows?.length)) return '';
    const financialRows = sections
        .filter(section => /financial|commercial|price|pricing|offer/i.test(section.title || ''))
        .flatMap(section => section.rows || []);
    if (!financialRows.length && !supplier.total) return '';
    const missingPrices = financialRows.filter(row => row.pending && /price|rate|amount|total|boq|financial|commercial/i.test(row.label || '')).length;
    const currency = getProcurexBidPackageRowValue(sections, /currency/i) || 'Not stated';
    const taxStatus = getProcurexBidPackageRowValue(sections, /tax/i) || 'Not confirmed';
    const discount = getProcurexBidPackageRowValue(sections, /discount/i) || 'Not stated';
    const validity = getProcurexBidPackageRowValue(sections, /validity/i) || 'Not stated';
    return `
        <section class="bid-response-document-section bid-financial-summary">
            <div class="bid-response-document-section-heading">
                <span>FS</span>
                <div>
                    <h4>Financial Offer Review</h4>
                    <small>Supplier price schedule summary, not buyer evaluation</small>
                </div>
            </div>
            <div class="bid-financial-summary-grid">
                <article><span>Total bid amount</span><strong>${escapeBidWorkspaceHtml(supplier.total || 'Pending')}</strong></article>
                <article><span>Currency</span><strong>${escapeBidWorkspaceHtml(currency)}</strong></article>
                <article><span>Tax status</span><strong>${escapeBidWorkspaceHtml(taxStatus)}</strong></article>
                <article><span>Discount</span><strong>${escapeBidWorkspaceHtml(discount)}</strong></article>
                <article><span>Bid validity</span><strong>${escapeBidWorkspaceHtml(validity)}</strong></article>
                <article><span>Price schedule status</span><strong>${missingPrices ? `${missingPrices} price item${missingPrices === 1 ? '' : 's'} need action` : 'Complete'}</strong></article>
            </div>
            ${missingPrices ? '<p class="bid-review-warning-note">Some required prices are missing. Complete them or mark the line as Not Bid where the tender allows it.</p>' : ''}
        </section>
    `;
}

function getProcurexFinancialReviewStatusClass(value = '') {
    const raw = String(value || '').toLowerCase();
    if (/complete|accepted|applied|submitted|ready|required|no issues/.test(raw)) return 'complete';
    if (/pending|issue|missing/.test(raw)) return 'pending';
    return 'neutral';
}

function getProcurexFinancialReviewData(section = {}, supplier = {}) {
    const boqRows = section.financialOfferRows || [];
    const total = boqRows.reduce((sum, row) => sum + parseBidWorkspaceNumber(row.total), 0);
    const labor = boqRows.reduce((sum, row) => sum + parseBidWorkspaceNumber(row.labor), 0);
    const material = boqRows.reduce((sum, row) => sum + parseBidWorkspaceNumber(row.material), 0);
    const equipment = boqRows.reduce((sum, row) => sum + parseBidWorkspaceNumber(row.equipment), 0);
    const overheads = boqRows.reduce((sum, row) => sum + parseBidWorkspaceNumber(row.overheads), 0);
    const residual = Math.max(total - labor - material - equipment - overheads, 0);
    const pricedCount = boqRows.filter(row => String(row.status || '').toLowerCase() === 'bid').length;
    const totalCount = boqRows.length;
    const profitValues = boqRows.map(row => parseBidWorkspaceNumber(row.profit)).filter(value => value > 0);
    const commonProfit = profitValues.length ? Math.round(profitValues.reduce((sum, value) => sum + value, 0) / profitValues.length) : 0;
    const totalValue = total ? formatBidWorkspaceMoney(total) : (supplier.total || 'Pending');
    return {
        summaryCards: [
            { label: 'Total Bid Value', value: totalValue, status: total ? 'Complete' : 'Pending' },
            { label: 'Pricing Model', value: 'Fixed Price', status: 'Accepted' },
            { label: 'Profit Margin', value: commonProfit ? `${commonProfit}%` : 'Not stated', status: commonProfit ? 'Applied' : 'Pending' },
            { label: 'BOQ Items Priced', value: `${pricedCount} / ${totalCount} Items`, status: pricedCount === totalCount ? 'Complete' : 'Pending' },
            { label: 'Bid Security', value: 'Submitted', status: 'Required' },
            { label: 'Financial Status', value: pricedCount === totalCount && total ? 'Ready' : 'Pending', status: pricedCount === totalCount && total ? 'No issues found' : 'Review required' }
        ],
        costRows: [
            ['Labour Cost', labor],
            ['Material Cost', material],
            ['Equipment Cost', equipment],
            ['Overheads', overheads],
            ['VAT', residual],
            ['TOTAL BID VALUE', total]
        ],
        boqRows
    };
}

function renderProcurexFinancialOfferReview(section = {}, supplier = {}) {
    const review = getProcurexFinancialReviewData(section, supplier);
    return `
        <div class="financial-review-section">
            <div class="financial-review-copy">
                <strong>Step 3: Financial Offer</strong>
                <span>Review the key financial details of your bid before final submission.</span>
            </div>
            <div class="summary-grid financial-review-summary-grid">
                ${review.summaryCards.map((card, index) => `
                    <article class="summary-card financial-review-summary-card">
                        <span class="financial-review-icon">${index + 1}</span>
                        <div>
                            <small>${escapeBidWorkspaceHtml(card.label)}</small>
                            <strong>${escapeBidWorkspaceHtml(card.value)}</strong>
                            <em class="financial-review-status-text ${getProcurexFinancialReviewStatusClass(card.status)}">${escapeBidWorkspaceHtml(card.status)}</em>
                        </div>
                    </article>
                `).join('')}
            </div>
            <div class="financial-review-block">
                <h5>Cost Breakdown</h5>
                <table class="financial-review-compact-table financial-cost-breakdown-table">
                    <thead><tr><th>Cost Component</th><th>Amount (TZS)</th></tr></thead>
                    <tbody>
                        ${review.costRows.map(([label, value], index) => `
                            <tr class="${index === review.costRows.length - 1 ? 'is-total-row' : ''}">
                                <td>${escapeBidWorkspaceHtml(label)}</td>
                                <td>${escapeBidWorkspaceHtml(formatBidWorkspaceMoney(value))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="financial-review-block">
                <h5>BOQ Line Summary</h5>
                <table class="financial-review-compact-table financial-boq-summary-table">
                    <thead><tr><th>Item</th><th>Work Item</th><th>Qty</th><th>Unit</th><th>Total (TZS)</th></tr></thead>
                    <tbody>
                        ${review.boqRows.map(row => `
                            <tr>
                                <td>${escapeBidWorkspaceHtml(row.item)}</td>
                                <td>${escapeBidWorkspaceHtml(row.workItem)}</td>
                                <td>${escapeBidWorkspaceHtml(row.quantity)}</td>
                                <td>${escapeBidWorkspaceHtml(row.unit)}</td>
                                <td>${escapeBidWorkspaceHtml(row.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn btn-secondary view-full-boq-button no-print" type="button" data-bid-toggle-full-boq>View Full BOQ Breakdown</button>
            <div class="financial-full-boq-panel" data-financial-full-boq hidden>
                <div class="financial-review-block">
                    <h5>Full BOQ Pricing Details</h5>
                    <table class="financial-review-compact-table financial-full-boq-table">
                        <thead><tr><th>Item</th><th>Work Item</th><th>Qty</th><th>Unit</th><th>Status</th><th>Labour</th><th>Material</th><th>Equipment</th><th>Overheads</th><th>Profit %</th><th>Unit Rate</th><th>Total</th></tr></thead>
                        <tbody>
                            ${review.boqRows.map(row => `
                                <tr>
                                    <td>${escapeBidWorkspaceHtml(row.item)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.workItem)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.quantity)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.unit)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.status)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.labor)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.material)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.equipment)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.overheads)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.profit)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.unitRate)}</td>
                                    <td>${escapeBidWorkspaceHtml(row.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function pushProcurexBidPackageRow(groups, category, row = {}) {
    const normalizedCategory = normalizeProcurexBidPackageCategory(category || row.category || 'Additional Responses');
    if (!groups.has(normalizedCategory)) groups.set(normalizedCategory, []);
    const mandatory = Boolean(row.mandatory);
    const pending = row.pending ?? !isBidWorkspaceMeaningfulValue(row.value);
    groups.get(normalizedCategory).push({
        label: row.label || 'Bid response',
        value: formatBidWorkspaceReviewValue(row.value, { mandatory }),
        sourceId: row.sourceId || '',
        editable: row.editable !== false,
        upload: Boolean(row.upload),
        requirement: row.requirement || '',
        action: row.action || '',
        mandatory,
        pending,
        deviation: Boolean(row.deviation),
        file: row.file || null
    });
}

function createProcurexBidPackageSectionsFromRows(rows = []) {
    const groups = new Map();
    rows.forEach(row => {
        pushProcurexBidPackageRow(groups, row.category || getProcurexBidPackageRowCategory(row.key || row.sourceId, row.label), row);
    });
    return Array.from(groups.entries())
        .map(([title, sectionRows]) => ({ title, rows: sectionRows }))
        .filter(section => section.rows.length);
}

function createProcurexBidPackageSectionsFromDraft(draft = {}) {
    if (Array.isArray(draft.reviewSections) && draft.reviewSections.length) {
        return draft.reviewSections;
    }
    const rows = [];
    Object.entries(draft.responses || {}).forEach(([key, value]) => {
        rows.push({ key, label: humanizeBidWorkspaceKey(key), value, sourceId: key });
    });
    Object.entries(draft.freeResponses || {}).forEach(([key, value]) => {
        rows.push({ key, label: humanizeBidWorkspaceKey(key), value, sourceId: key });
    });
    (draft.productSpecificationResponses || []).forEach((row, index) => {
        rows.push({
            key: row.rowId || `product-spec-${index}`,
            label: `Product specification ${index + 1}`,
            value: Object.entries(row)
                .filter(([key]) => key !== 'rowId' && key !== 'attachmentResponseId')
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
            sourceId: row.rowId || '',
            category: 'Technical Response'
        });
    });
    Object.entries(draft.uploadedFiles || {}).forEach(([key, value]) => {
        rows.push({
            key,
            label: humanizeBidWorkspaceKey(key),
            value: value?.name || value,
            sourceId: key,
            upload: true,
            category: 'Step 1: Administrative Compliance',
            file: value
        });
    });
    return createProcurexBidPackageSectionsFromRows(rows);
}

function createProcurexBidPackageSectionsFromEvaluationBid(bid = {}, criteria = []) {
    const sections = [];
    const documents = bid.documents || [];
    sections.push({
        title: 'Eligibility and Documents',
        rows: [
            { label: 'Registration number', value: bid.registrationNumber || 'Not provided', editable: false },
            { label: 'Contact person', value: bid.contactPerson || 'Not provided', editable: false },
            { label: 'Submitted documents', value: documents.length ? documents.join(', ') : 'No documents listed', editable: false },
            ...(bid.preliminaryChecks || []).map(item => ({ label: item.requirement, value: `${item.result || ''}${item.comment ? ` - ${item.comment}` : ''}`, editable: false })),
            ...(bid.eligibilityChecks || []).map(item => ({ label: item.requirement, value: `${item.result || ''}${item.comment ? ` - ${item.comment}` : ''}`, editable: false }))
        ]
    });
    sections.push({
        title: 'Technical Response',
        rows: [
            { label: 'Technical score', value: bid.technicalScore ? `${bid.technicalScore}%` : 'Not scored', editable: false },
            { label: 'Technical comment', value: bid.technicalComment || 'No technical comment recorded', editable: false },
            ...criteria.map(criterion => ({
                label: criterion.name,
                value: bid.technicalScores?.[criterion.id] ?? bid.technicalScores?.[typeof slugEvaluationId === 'function' ? slugEvaluationId(criterion.name) : humanizeBidWorkspaceKey(criterion.name).toLowerCase()] ?? 'Pending score',
                requirement: (criterion.subcriteria || []).join(', '),
                editable: false
            }))
        ]
    });
    sections.push({
        title: 'Financial Offer',
        rows: [
            { label: 'Quoted price', value: bid.price ? formatBidWorkspaceMoney(bid.price) : 'Not provided', editable: false },
            { label: 'Corrected price', value: bid.financial?.correctedPrice ? formatBidWorkspaceMoney(bid.financial.correctedPrice) : 'Not corrected', editable: false },
            { label: 'Taxes included', value: bid.financial?.taxesIncluded || 'Not stated', editable: false },
            { label: 'Discount', value: bid.financial?.discount || 'None', editable: false },
            { label: 'Pricing status', value: bid.financial?.pricingStatus || bid.financial?.boqStatus || 'Pending', editable: false },
            { label: 'Arithmetic note', value: bid.financial?.correctionNote || 'No arithmetic note', editable: false }
        ]
    });
    sections.push({
        title: 'Evaluation Outcome',
        rows: [
            { label: 'Preliminary result', value: bid.preliminaryResult || 'Pending', editable: false },
            { label: 'Eligibility result', value: bid.eligibilityResult || 'Pending', editable: false },
            { label: 'Final result', value: bid.finalResult || 'Pending', editable: false },
            { label: 'Integrity hash', value: bid.integrityHash || 'Not recorded', editable: false }
        ]
    });
    return sections.filter(section => section.rows.some(row => isBidWorkspaceMeaningfulValue(row.value)));
}

function getProcurexSubmittedBidsForTender(tender = {}) {
    const tenderIds = new Set([
        tender.id,
        tender.reference,
        tender.sourceTender?.id,
        tender.sourceTender?.reference
    ].filter(Boolean).map(String));
    try {
        const current = JSON.parse(localStorage.getItem(bidWorkspaceSubmittedStorageKey) || '[]');
        const legacy = JSON.parse(localStorage.getItem(bidWorkspaceLegacySubmittedStorageKey) || '[]');
        const parsed = [
            ...(Array.isArray(current) ? current : []),
            ...(Array.isArray(legacy) ? legacy : [])
        ];
        return parsed.filter(item => tenderIds.has(String(item.tenderId || '')));
    } catch (error) {
        return [];
    }
}

function renderProcurexBidPackageDocument(config = {}) {
    const tender = config.tender || {};
    const profile = config.profile || {};
    const supplier = config.supplier || {};
    const sections = config.sections || [];
    const editable = config.editable !== false;
    const includeActions = config.includeActions !== false;
    const tenderMeta = getProcurexBidPackageTenderMeta(tender);
    const supplierMeta = getProcurexBidPackageSupplierMeta(supplier);
    const offerLabel = config.offerLabel || getProcurexBidPackageOfferLabel(tender, profile);
    const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0);
    const completeness = config.completeness || getProcurexBidPackageCompleteness(sections);
    const fileManifest = config.fileManifest || sections
        .flatMap(section => section.rows || [])
        .map(row => row.file)
        .filter(Boolean);
    const deviationRows = sections
        .flatMap(section => section.rows || [])
        .filter(row => row.deviation);
    const actionRows = getProcurexBidPackageActionRows(sections);
    const readiness = getProcurexBidPackageReadiness(completeness, actionRows);

    return `
        ${includeActions ? `
            <div class="bid-response-download-panel">
                <div>
                    <span class="section-kicker">Supplier submission preview</span>
                    <strong>${escapeBidWorkspaceHtml(config.actionsTitle || 'Bid Submission Review')}</strong>
                    <p>${escapeBidWorkspaceHtml(config.actionsDescription || 'Review completeness, missing items, uploaded evidence, pricing, and declaration checks before submission.')}</p>
                </div>
                <div class="bid-response-download-actions">
                    <button class="btn btn-secondary" type="button" data-bid-download-review-document>Download HTML</button>
                    <button class="btn btn-primary" type="button" data-bid-print-review-document>Print / Save PDF</button>
                </div>
            </div>
        ` : ''}
        <div class="bid-response-document procurex-bid-package-document">
            <div class="bid-response-document-masthead">
                <div class="bid-response-document-mark">PX</div>
                <div>
                    <span>ProcureX e-Procurement</span>
                    <strong>Supplier Bid Submission Review</strong>
                </div>
                <em>${escapeBidWorkspaceHtml(config.documentLabel || 'Review Copy')}</em>
            </div>
            <header class="bid-response-document-cover">
                <div>
                    <span class="section-kicker">Tender Bid Submission Review</span>
                    <h3>${escapeBidWorkspaceHtml(tender.title || config.title || 'Supplier bid package review')}</h3>
                    <p>${escapeBidWorkspaceHtml(config.description || 'This review summarizes supplier responses, completeness status, uploaded evidence, pricing, and final checks before submission. It is not a buyer evaluation document.')}</p>
                </div>
                <div class="bid-response-document-status">
                    <span class="bid-status-chip review">${escapeBidWorkspaceHtml(supplier.status || readiness.status)}</span>
                    ${editable ? '<span class="bid-status-chip editable">Edits enabled</span>' : ''}
                    <span class="bid-status-chip offer">${escapeBidWorkspaceHtml(offerLabel)}</span>
                </div>
            </header>
            <section class="bid-completeness-summary">
                <div>
                    <span class="section-kicker">Submission readiness</span>
                    <strong>${completeness.percent}%</strong>
                    <p>${completeness.mandatoryComplete}/${completeness.mandatoryTotal || 0} mandatory complete / ${completeness.optionalComplete}/${completeness.optionalTotal || 0} optional provided / ${readiness.missingMandatory} missing mandatory / ready for submission: ${readiness.ready ? 'Yes' : 'No'}</p>
                </div>
                <div class="bid-completeness-meter" aria-hidden="true"><span style="width: ${Math.max(0, Math.min(100, completeness.percent))}%"></span></div>
            </section>
            <div class="bid-response-document-meta">
                ${tenderMeta.map(([label, value]) => `
                    <article><span>${escapeBidWorkspaceHtml(label)}</span><strong>${escapeBidWorkspaceHtml(value)}</strong><em>Tender information</em></article>
                `).join('')}
                ${supplierMeta.map(([label, value]) => `
                    <article class="${/total|amount|value/i.test(label) ? 'bid-value-card' : ''}"><span>${escapeBidWorkspaceHtml(label)}</span><strong>${escapeBidWorkspaceHtml(value)}</strong><em>Supplier information</em></article>
                `).join('')}
                <article><span>Responses captured</span><strong>${totalRows}</strong><em>Bid package scope</em></article>
            </div>
            ${renderProcurexBidPackageActionSummary(actionRows)}
            ${renderProcurexBidPackageFinancialSummary(sections, supplier)}
            ${sections.length ? `
                <div class="bid-response-document-sections">
                    ${sections.map((section, sectionIndex) => `
                        <article class="bid-response-document-section">
                            <div class="bid-response-document-section-heading">
                                <span>${String(sectionIndex + 1).padStart(2, '0')}</span>
                                <div>
                                    <h4>${escapeBidWorkspaceHtml(section.title)}</h4>
                                    <small>${section.financialOfferRows?.length || section.rows.length} tender requirement${(section.financialOfferRows?.length || section.rows.length) === 1 ? '' : 's'} and supplier response${(section.financialOfferRows?.length || section.rows.length) === 1 ? '' : 's'}</small>
                                </div>
                            </div>
                            <div class="bid-response-document-table ${section.financialOfferRows?.length ? 'financial-review-table-shell' : ''}">
                                ${section.financialOfferRows?.length ? `
                                    ${renderProcurexFinancialOfferReview(section, supplier)}
                                ` : `
                                    <table>
                                        <thead>
                                            <tr><th>Status</th><th>Requirement</th><th>Supplier response</th><th>Action needed</th></tr>
                                        </thead>
                                        <tbody>
                                            ${section.rows.map(row => `
                                                <tr class="${row.pending ? 'is-incomplete' : ''} ${row.deviation ? 'is-deviation' : ''}">
                                                    <td>
                                                        <span class="bid-requirement-marker ${row.mandatory ? (row.pending ? 'required-incomplete' : 'required-complete') : (row.pending ? 'optional-empty' : 'optional-complete')}">
                                                            ${escapeBidWorkspaceHtml(getProcurexBidReviewRowStatus(row))}
                                                        </span>
                                                        ${row.deviation ? '<span class="bid-deviation-marker">Deviation</span>' : ''}
                                                    </td>
                                                    <td>
                                                        <strong>${escapeBidWorkspaceHtml(row.label)}</strong>
                                                        ${row.requirement ? `<small>${escapeBidWorkspaceHtml(row.requirement)}</small>` : ''}
                                                    </td>
                                                    <td>${escapeBidWorkspaceHtml(row.value)}</td>
                                                    <td>
                                                        <span>${escapeBidWorkspaceHtml(getProcurexBidReviewAction(row))}</span>
                                                        ${editable ? (row.editable === false ? '<span class="bid-review-readonly">Read only</span>' : `
                                                            <button class="bid-review-edit-button" type="button" data-bid-review-edit="${escapeBidWorkspaceHtml(row.sourceId)}">
                                                                ${row.upload ? 'Replace file' : 'Change'}
                                                            </button>
                                                        `) : ''}
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `}
                            </div>
                        </article>
                    `).join('')}
                </div>
            ` : '<div class="scope-empty">No supplier responses have been captured for this bid package yet.</div>'}
            ${deviationRows.length ? `
                <section class="bid-response-document-section bid-deviation-log">
                    <div class="bid-response-document-section-heading">
                        <span>DL</span>
                        <div>
                            <h4>Deviation Log</h4>
                            <small>${deviationRows.length} contract or commercial deviation${deviationRows.length === 1 ? '' : 's'} flagged</small>
                        </div>
                    </div>
                    <div class="bid-response-document-table">
                        <table>
                            <thead><tr><th>Clause / field</th><th>Deviation text</th></tr></thead>
                            <tbody>
                                ${deviationRows.map(row => `<tr><td>${escapeBidWorkspaceHtml(row.label)}</td><td>${escapeBidWorkspaceHtml(row.value)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            ` : ''}
            ${fileManifest.length ? `
                <section class="bid-response-document-section bid-file-manifest">
                    <div class="bid-response-document-section-heading">
                        <span>AN</span>
                        <div>
                            <h4>Annex: Uploaded Evidence Files</h4>
                            <small>${fileManifest.length} uploaded file${fileManifest.length === 1 ? '' : 's'} with integrity metadata</small>
                        </div>
                    </div>
                    <div class="bid-response-document-table">
                        <table>
                            <thead><tr><th>File</th><th>Size</th><th>Uploaded</th><th>SHA-256 hash</th></tr></thead>
                            <tbody>
                                ${fileManifest.map(file => `
                                    <tr>
                                        <td>${escapeBidWorkspaceHtml(file.name || 'Uploaded file')}</td>
                                        <td>${escapeBidWorkspaceHtml(formatBidWorkspaceFileSize(file.size))}</td>
                                        <td>${escapeBidWorkspaceHtml(file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'Current session')}</td>
                                        <td><code>${escapeBidWorkspaceHtml(file.sha256 || file.hash || 'Hash pending')}</code></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            ` : ''}
            <footer class="bid-response-document-footer">
                <span>${escapeBidWorkspaceHtml(config.footerLabel || 'System-Generated Bid Review')}</span>
                <strong>ProcureX</strong>
            </footer>
        </div>
    `;
}

function renderBidWorkspaceResponseReviewPlaceholder() {
    return `
        <div class="bid-response-download-panel">
            <div>
                <span class="section-kicker">Document download</span>
                <strong>Bid response preview</strong>
                <p>Download or print the current generated document preview after corrections are captured.</p>
            </div>
            <div class="bid-response-download-actions">
                <button class="btn btn-secondary" type="button" data-bid-download-review-document>Download HTML</button>
                <button class="btn btn-primary" type="button" data-bid-print-review-document>Print / Save PDF</button>
            </div>
        </div>
        <div class="bid-response-document">
            <div class="bid-response-document-masthead">
                <div class="bid-response-document-mark">PX</div>
                <div>
                    <span>ProcureX e-Procurement</span>
                    <strong>Supplier Bid Submission Review</strong>
                </div>
                <em>Review Copy</em>
            </div>
            <header class="bid-response-document-cover">
                <div>
                    <span class="section-kicker">Supplier Submission Preview</span>
                    <h3>Bid review copy pending</h3>
                    <p>Supplier responses will be compiled here for completeness review before final submission.</p>
                </div>
                <div class="bid-response-document-status">
                    <span class="bid-status-chip review">Ready for final review</span>
                    <span class="bid-status-chip editable">Edits enabled</span>
                    <span class="bid-status-chip submitted">Bid package</span>
                </div>
            </header>
            <div class="scope-empty">Captured supplier responses will appear here as a bid submission review document.</div>
            <footer class="bid-response-document-footer">
                <span>System-Generated Bid Review</span>
                <strong>ProcureX</strong>
            </footer>
        </div>
    `;
}

function renderGoodsBidProductDetailResponse(tender = {}, draft = {}) {
    const rows = getGoodsBidQuantityRows(tender);
    if (!rows.length) {
        return '<div class="scope-empty">No goods line items were configured for supplier technical product details.</div>';
    }

    return `
        <section class="bid-dynamic-group goods-product-detail-response">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Offered product details</h3>
                    <p>Provide the supplier product identity and delivery details for each requested goods line before pricing.</p>
                </div>
                <span class="badge badge-warning">${rows.length} product detail${rows.length === 1 ? '' : 's'}</span>
            </div>
            <div class="bid-requirement-list">
                ${rows.map((item, index) => {
                    const baseId = `goods-line-${index}`;
                    const qty = parseBidWorkspaceNumber(item.quantity || item.qty) || 1;
                    const unit = item.unitOfMeasure || item.unit || 'Unit';
                    return `
                        <article class="bid-requirement-card goods-product-detail-card">
                            <div class="bid-response-card-heading">
                                <div>
                                    <span class="section-kicker">Requested goods line ${index + 1}</span>
                                    <h3>${escapeBidWorkspaceHtml(getGoodsBidItemDescription(item, index))}</h3>
                                    <p>${qty} ${escapeBidWorkspaceHtml(unit)} requested. Confirm the exact offered product and supporting details.</p>
                                </div>
                                <em class="badge badge-warning">Technical details required</em>
                            </div>
                            <div class="goods-line-detail-grid">
                                <div class="form-group"><label class="form-label">Supplier Product</label><input class="form-input" data-bid-response="${baseId}-product-name" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-product-name`))}" placeholder="Product name offered"></div>
                                <div class="form-group"><label class="form-label">Brand</label><input class="form-input" data-bid-response="${baseId}-brand" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-brand`))}"></div>
                                <div class="form-group"><label class="form-label">Model Number</label><input class="form-input" data-bid-response="${baseId}-model" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-model`))}"></div>
                                <div class="form-group"><label class="form-label">Country of Origin</label><input class="form-input" data-bid-response="${baseId}-origin" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-origin`))}" placeholder="Country"></div>
                                <div class="form-group"><label class="form-label">Quantity Offered</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-quantity-offered" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-quantity-offered`) || qty)}"></div>
                                <div class="form-group"><label class="form-label">Delivery Time</label><input class="form-input" data-bid-response="${baseId}-delivery-time" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-delivery-time`))}" placeholder="e.g. 30 days"></div>
                                <div class="form-group"><label class="form-label">Warranty Period</label><input class="form-input" data-bid-response="${baseId}-warranty" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-warranty`))}" placeholder="e.g. 24 months"></div>
                                <div class="form-group wide"><label class="form-label">Deviations / Comments</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-deviations">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-deviations`))}</textarea></div>
                                <div class="form-group"><label class="form-label">Attach Brochure</label><div class="bid-upload-response" data-bid-upload-control><input class="form-input" type="file" data-bid-file-input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"><input type="hidden" data-bid-response="${baseId}-brochure" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-brochure`))}"><small data-bid-file-name>${getBidWorkspaceSavedResponse(draft, `${baseId}-brochure`) ? `Selected: ${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-brochure`))}` : 'No file selected yet.'}</small></div></div>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderGoodsBidTechnicalResponse(tender = {}, draft = {}) {
    const specifications = getGoodsBidSpecificationCards(tender);

    return `
        <div class="goods-compliance-matrix">
            ${specifications.length ? specifications.map((spec, index) => {
                const baseId = `goods-spec-${index}`;
                const buyerRequirement = [
                    spec.productDescription,
                    spec.performanceSpecifications,
                    spec.standards?.length ? `Standards: ${spec.standards.join(', ')}` : '',
                    spec.warrantyRequirements ? `Warranty: ${spec.warrantyRequirements}` : '',
                    spec.installationRequirements ? `Installation: ${spec.installationRequirements}` : ''
                ].filter(Boolean).join(' / ');
                return `
                    <article class="goods-compliance-card">
                        <div class="goods-compliance-buyer">
                            <span class="section-kicker">Buyer requirement</span>
                            <h3>${escapeBidWorkspaceHtml(spec.itemRowId || spec.productDescription || `Specification ${index + 1}`)}</h3>
                            <p>${escapeBidWorkspaceHtml(buyerRequirement || 'Buyer specification details not provided.')}</p>
                            <small>${spec.materialQuality ? `Material quality: ${escapeBidWorkspaceHtml(spec.materialQuality)}` : 'Mandatory compliance response required.'}</small>
                        </div>
                        <div class="goods-compliance-response">
                            <span class="section-kicker">Supplier response</span>
                            <div class="form-grid two">
                                <div class="form-group">
                                    <label class="form-label">Compliance Status</label>
                                    <select class="form-input" data-bid-response="${baseId}-compliance" data-bid-workflow-required-response="true">
                                        <option value="" ${getBidWorkspaceSavedResponse(draft, `${baseId}-compliance`) ? '' : 'selected'}>Select compliance</option>
                                        ${['Comply', 'Partially Comply', 'Does Not Comply'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-compliance`) === option ? 'selected' : ''}>${option}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Supporting Evidence</label>
                                    <div class="bid-upload-response" data-bid-upload-control>
                                        <input class="form-input" type="file" data-bid-file-input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                                        <input type="hidden" data-bid-response="${baseId}-technical-document" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-technical-document`))}">
                                        <small data-bid-file-name>${getBidWorkspaceSavedResponse(draft, `${baseId}-technical-document`) ? `Selected: ${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-technical-document`))}` : 'No file selected yet.'}</small>
                                    </div>
                                </div>
                                <div class="form-group wide">
                                    <label class="form-label">Notes</label>
                                    <textarea class="form-input" rows="3" data-bid-response="${baseId}-notes" placeholder="Add any compliance comments or clarifications">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-notes`))}</textarea>
                                </div>
                            </div>
                        </div>
                    </article>
                `;
            }).join('') : '<div class="scope-empty">No buyer technical specification cards were configured for this goods tender.</div>'}
        </div>
        ${renderGoodsBidProductDetailResponse(tender, draft)}
    `;
}

function renderGoodsBidFinancialRows(tender = {}, draft = {}) {
    const rows = getGoodsBidQuantityRows(tender);
    if (!rows.length) return '<tr><td colspan="9">No quantity schedule configured.</td></tr>';
    return rows.map((item, index) => {
        const baseId = `goods-line-${index}`;
        const qty = parseBidWorkspaceNumber(item.quantity || item.qty) || 1;
        const unit = item.unitOfMeasure || item.unit || 'Unit';
        const buyerRate = parseBidWorkspaceNumber(item.unitPrice || item.rate);
        const savedRate = getBidWorkspaceSavedResponse(draft, `${baseId}-unit-price`);
        const bidderRate = savedRate || (buyerRate ? Math.round(buyerRate * 0.98) : '');
        const savedStatus = getBidWorkspaceSavedResponse(draft, `${baseId}-status`);
        const isNotBid = String(savedStatus || '').toLowerCase() === 'not bid';
        return `
            <tr class="goods-offer-row">
                <td>${index + 1}</td>
                <td><strong>${escapeBidWorkspaceHtml(getGoodsBidItemDescription(item, index))}</strong><small>${qty} ${escapeBidWorkspaceHtml(unit)} requested</small></td>
                <td data-bid-line-qty>${qty}</td>
                <td>${escapeBidWorkspaceHtml(unit)}</td>
                <td>
                    <select class="form-input" data-bid-line-status data-bid-response="${baseId}-status" data-bid-workflow-required-response="true">
                        <option value="" ${savedStatus ? '' : 'selected'}>Select</option>
                        ${['Bid', 'Not Bid'].map(option => `<option ${savedStatus === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" data-bid-rate data-bid-response="${baseId}-unit-price" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(bidderRate)}" placeholder="Unit price"></td>
                <td><select class="form-input" data-bid-response="${baseId}-tax-included" data-bid-workflow-required-response="true"><option value="" ${getBidWorkspaceSavedResponse(draft, `${baseId}-tax-included`) ? '' : 'selected'}>Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-tax-included`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                <td><input class="form-input" data-bid-response="${baseId}-discount" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-discount`))}" placeholder="Amount or %"></td>
                <td data-bid-line-amount>${isNotBid ? formatBidWorkspaceMoney(0) : formatBidWorkspaceMoney(qty * parseBidWorkspaceNumber(bidderRate))}</td>
            </tr>
        `;
    }).join('');
}

function renderGoodsBidSamples(tender = {}, draft = {}) {
    const sampleRows = getGoodsBidSampleRows(tender);
    if (!isGoodsBidSamplesRequired(tender)) {
        return '<div class="scope-empty">Samples are not required for this goods tender.</div>';
    }
    return `
        <div class="goods-sample-grid">
            ${sampleRows.map((sample, index) => {
                const baseId = `goods-sample-${index}`;
                return `
                    <article class="goods-sample-card">
                        <span class="section-kicker">${escapeBidWorkspaceHtml(sample.relatedBoqItem || `Sample ${index + 1}`)}</span>
                        <h3>${escapeBidWorkspaceHtml(sample.sampleDescription || 'Sample submission')}</h3>
                        <p>BOQ link: ${escapeBidWorkspaceHtml(sample.relatedBoqItem || sample.boqItem || 'Buyer sample item')} / Destination: ${escapeBidWorkspaceHtml(sample.deliveryLocation || 'Buyer location')} / Deadline: ${escapeBidWorkspaceHtml(sample.deliveryDeadline || 'Not set')}</p>
                        <div class="form-grid two">
                            <div class="form-group"><label class="form-label">Sample Submission Status</label><select class="form-input" data-bid-response="${baseId}-status" data-bid-workflow-required-response="true"><option value="" ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) ? '' : 'selected'}>Select status</option>${['Prepared', 'Dispatched', 'Not applicable'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                            <div class="form-group"><label class="form-label">Number Submitted</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-number" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-number`) || sample.numberOfSamples || '')}"></div>
                            <div class="form-group"><label class="form-label">Returnable?</label><select class="form-input" data-bid-response="${baseId}-returnable"><option value="">Select</option>${['Yes', 'No', 'Buyer to confirm'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-returnable`) === option || (!getBidWorkspaceSavedResponse(draft, `${baseId}-returnable`) && String(sample.returnable || sample.returnableSample || '') === option) ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                            <div class="form-group"><label class="form-label">Sample Cost</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="${baseId}-cost" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-cost`))}" placeholder="Cost if chargeable"></div>
                            <div class="form-group"><label class="form-label">Batch / Lot Number</label><input class="form-input" data-bid-response="${baseId}-batch-lot" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-batch-lot`))}"></div>
                            <div class="form-group"><label class="form-label">Courier / Delivery Method</label><input class="form-input" data-bid-response="${baseId}-courier" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-courier`))}"></div>
                            <div class="form-group"><label class="form-label">Dispatch Date</label><input class="form-input" type="date" data-bid-response="${baseId}-dispatch-date" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-dispatch-date`))}"></div>
                            <div class="form-group"><label class="form-label">Tracking Number</label><input class="form-input" data-bid-response="${baseId}-tracking" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-tracking`))}"></div>
                            <div class="form-group"><label class="form-label">Delivery Proof</label><div class="bid-upload-response" data-bid-upload-control><input class="form-input" type="file" data-bid-file-input accept=".pdf,.jpg,.jpeg,.png"><input type="hidden" data-bid-response="${baseId}-proof" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-proof`))}"><small data-bid-file-name>${getBidWorkspaceSavedResponse(draft, `${baseId}-proof`) ? `Selected: ${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-proof`))}` : 'No file selected yet.'}</small></div></div>
                            <div class="form-group wide"><label class="form-label">Sample Notes</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-notes">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-notes`))}</textarea></div>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderGoodsBidCommercialTerms(draft = {}) {
    return `
        <div class="goods-commercial-terms">
            <div class="form-grid two">
                <div class="form-group"><label class="form-label">Bid Validity Period (days)</label><input class="form-input" type="number" min="1" data-bid-response="goods-commercial-bid-validity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'goods-commercial-bid-validity') || 90)}"></div>
                <div class="form-group"><label class="form-label">Currency</label><select class="form-input" data-bid-response="goods-commercial-currency" data-bid-workflow-required-response="true">${['TZS', 'USD', 'EUR', 'GBP'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'goods-commercial-currency') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <label class="bid-response-check"><input type="checkbox" data-bid-response="goods-commercial-delivery-terms" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'goods-commercial-delivery-terms') === true || getBidWorkspaceSavedResponse(draft, 'goods-commercial-delivery-terms') === 'true' ? 'checked' : ''}><span>I accept the delivery terms defined in the tender.</span></label>
            </div>
        </div>
    `;
}

function renderBidWorkspaceUploadControl(responseId, draft = {}, label = 'Upload evidence', accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', workflowRequired = false, required = false) {
    const value = getBidWorkspaceSavedResponse(draft, responseId);
    return `
        <div class="bid-upload-response" data-bid-upload-control>
            <span>${escapeBidWorkspaceHtml(label)}</span>
            <input class="form-input" type="file" data-bid-file-input accept="${escapeBidWorkspaceHtml(accept)}" aria-label="${escapeBidWorkspaceHtml(label)}">
            <input type="hidden" data-bid-response="${escapeBidWorkspaceHtml(responseId)}" ${required ? 'data-bid-required-response="true"' : ''} ${workflowRequired ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(value)}">
            <small data-bid-file-name>${value ? `Selected: ${escapeBidWorkspaceHtml(value)}` : 'No file selected yet.'}</small>
        </div>
    `;
}

function renderBidWorkspaceTrashIcon() {
    return `
        <svg class="trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v5"></path>
            <path d="M14 11v5"></path>
        </svg>
    `;
}

function getWorksBidBoqRows(tender = {}) {
    const fields = tender.requirements?.fields || {};
    if (fields.boqRows?.length) return fields.boqRows;
    if (fields.lumpSumPricingRows?.length) {
        return fields.lumpSumPricingRows.map((row, index) => ({
            workItem: row.section || row.description || `Lump sum section ${index + 1}`,
            description: row.description,
            quantity: 1,
            unit: 'Lot',
            laborCost: Math.round(parseBidWorkspaceNumber(row.amount) * 0.28),
            materialCost: Math.round(parseBidWorkspaceNumber(row.amount) * 0.54),
            equipmentCost: Math.round(parseBidWorkspaceNumber(row.amount) * 0.12),
            totalCost: row.amount,
            mandatory: row.mandatory !== false
        }));
    }
    return tender.boqItems?.length ? tender.boqItems : (tender.commercialItems || []);
}

function getWorksBidMilestoneRows(tender = {}) {
    return tender.requirements?.fields?.worksMilestoneRows?.length
        ? tender.requirements.fields.worksMilestoneRows
        : (tender.milestones || []).filter(item => !/publication|clarification|opening|evaluation|award/i.test(item.id || item.name || ''));
}

function getWorksBidDrawingRows(tender = {}) {
    return tender.requirements?.fields?.drawingDesignRows || [];
}

function getWorksBidPersonnelRoles(tender = {}) {
    const rows = tender.requirements?.fields?.personnelRequirementRows || [];
    if (rows.length) return rows.map(row => row.positionTitle || row.staffRole || row.role || 'Key personnel');
    return ['Project Manager', 'Site Engineer', 'Quantity Surveyor', 'Safety Officer', 'Foreman / Works Supervisor'];
}

function getWorksBidPersonnelUploadCount(draft = {}, required = false) {
    const minimumCount = required ? 1 : 1;
    const responseIds = new Set([
        ...Object.keys(draft.responses || {}),
        ...Object.keys(draft.uploadedFiles || {})
    ]);
    const savedIndexes = Array.from(responseIds)
        .map(id => /^works-personnel-(\d+)-(position|cv)$/.exec(id))
        .filter(Boolean)
        .map(match => Number(match[1]))
        .filter(Number.isFinite);
    const savedCount = savedIndexes.length ? Math.max(...savedIndexes) + 1 : 0;
    return Math.max(minimumCount, savedCount);
}

function renderWorksBidPersonnelUploadCard(index = 0, draft = {}, required = false) {
    const baseId = `works-personnel-${index}`;
    return `
        <article class="works-person-card" data-works-personnel-card>
            <div class="works-person-avatar">P</div>
            <div>
                <div class="bid-dynamic-group-heading">
                    <span class="section-kicker">Personnel ${index + 1}</span>
                    ${required ? '' : `<button class="icon-delete-btn" type="button" data-delete-personnel-slot aria-label="Delete personnel slot" title="Delete personnel slot">${renderBidWorkspaceTrashIcon()}</button>`}
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Personnel Position</label><input class="form-input" data-bid-response="${baseId}-position" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-position`))}"></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-cv`, draft, 'CV upload', '.pdf,.doc,.docx', required)}</div>
                </div>
            </div>
        </article>
    `;
}

function getWorksBidEquipmentRows(tender = {}) {
    const rows = tender.requirements?.fields?.equipmentRequirementRows || [];
    if (rows.length) return rows;
    const lower = `${tender.category || ''} ${(tender.categories || []).join(' ')} ${tender.title || ''}`.toLowerCase();
    if (/water|pipeline|borehole|pump|distribution/.test(lower)) {
        return [
            { equipmentName: 'Excavator', quantity: 2, ownershipRequirement: 'Owned or leased' },
            { equipmentName: 'Trenching machine / backhoe', quantity: 2, ownershipRequirement: 'Owned or leased' },
            { equipmentName: 'Pipe fusion machine', quantity: 4, ownershipRequirement: 'Owned' },
            { equipmentName: 'Pressure testing kit', quantity: 3, ownershipRequirement: 'Owned' }
        ];
    }
    if (/solar|electrical|mini-grid|power/.test(lower)) {
        return [
            { equipmentName: 'Crane / lifting equipment', quantity: 1, ownershipRequirement: 'Owned or leased' },
            { equipmentName: 'Concrete mixer', quantity: 3, ownershipRequirement: 'Owned or leased' },
            { equipmentName: 'Electrical testing tools', quantity: 4, ownershipRequirement: 'Owned' },
            { equipmentName: 'Pole erection equipment', quantity: 2, ownershipRequirement: 'Owned or leased' }
        ];
    }
    return [
        { equipmentName: 'Excavator', quantity: 2, ownershipRequirement: 'Owned or leased' },
        { equipmentName: 'Concrete mixer', quantity: 4, ownershipRequirement: 'Owned or leased' },
        { equipmentName: 'Scaffolding and formwork', quantity: 1, ownershipRequirement: 'Owned or leased' },
        { equipmentName: 'Tipper trucks', quantity: 4, ownershipRequirement: 'Owned or leased' }
    ];
}

function getWorksBidSimilarProjectUploadCount(draft = {}, required = false) {
    const minimumCount = 1;
    const responseIds = new Set([
        ...Object.keys(draft.responses || {}),
        ...Object.keys(draft.uploadedFiles || {})
    ]);
    const savedIndexes = Array.from(responseIds)
        .map(id => /^works-similar-projects-document-(\d+)$/.exec(id))
        .filter(Boolean)
        .map(match => Number(match[1]))
        .filter(Number.isFinite);
    const savedCount = savedIndexes.length ? Math.max(...savedIndexes) + 1 : 0;
    return Math.max(minimumCount, savedCount);
}

function renderWorksBidSimilarProjectUploadCard(index = 0, draft = {}, required = false) {
    return `
        <article class="works-capacity-card" data-works-similar-project-card>
            <div class="bid-dynamic-group-heading">
                <span class="section-kicker">Similar project ${index + 1}</span>
                ${required ? '' : `<button class="icon-delete-btn" type="button" data-delete-similar-project-slot aria-label="Delete similar project slot" title="Delete similar project slot">${renderBidWorkspaceTrashIcon()}</button>`}
            </div>
            ${renderBidWorkspaceUploadControl(`works-similar-projects-document-${index}`, draft, 'Upload similar project document', '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', required)}
        </article>
    `;
}

function renderWorksBidExperienceCards(tender = {}, draft = {}) {
    const required = normalizeBidWorkspaceFlag(tender.requirements?.fields?.similarCompletedProjectsRequired);
    const count = getWorksBidSimilarProjectUploadCount(draft, required);
    return `
        <section class="works-response-section">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Similar completed projects</h3>
                    <p>Upload documents explaining previous similar projects, including any completion proof, references, and client details.</p>
                </div>
                <span class="badge ${required ? 'badge-warning' : 'badge-info'}">${required ? 'Required' : 'Optional'}</span>
            </div>
            <div class="works-card-grid" data-works-similar-project-list>
                ${Array.from({ length: count }, (_, index) => renderWorksBidSimilarProjectUploadCard(index, draft, required && index === 0)).join('')}
            </div>
            <button class="btn btn-secondary" type="button" data-add-similar-project style="margin-top: 12px;">Add similar projects</button>
        </section>
    `;
}

function renderWorksBidPersonnelCards(tender = {}, draft = {}) {
    const required = normalizeBidWorkspaceFlag(tender.requirements?.fields?.keyPersonnelCvsRequired);
    const count = getWorksBidPersonnelUploadCount(draft, required);
    return `
        <section class="works-response-section">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Key personnel</h3>
                    <p>Add personnel positions and upload the matching CV for each person.</p>
                </div>
                <span class="badge ${required ? 'badge-warning' : 'badge-info'}">${count} profile${count === 1 ? '' : 's'}</span>
            </div>
            <div class="works-personnel-grid" data-works-personnel-list>
                ${Array.from({ length: count }, (_, index) => renderWorksBidPersonnelUploadCard(index, draft, required && index === 0)).join('')}
            </div>
            <button class="btn btn-secondary" type="button" data-add-personnel style="margin-top: 12px;">Add personnel</button>
        </section>
    `;
}

function renderWorksBidEquipmentCards(tender = {}, draft = {}) {
    const equipmentRows = getWorksBidEquipmentRows(tender);
    return `
        <section class="works-response-section">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Equipment capacity</h3>
                    <p>Confirm ownership or access to plant, tools, transport, and specialized equipment.</p>
                </div>
                <span class="badge badge-warning">${equipmentRows.length} equipment items</span>
            </div>
            <div class="data-table works-equipment-table">
                <table>
                    <thead>
                        <tr>
                            <th>Equipment Name</th>
                            <th>Quantity Available</th>
                            <th>Ownership Status</th>
                            <th>Lease / Access Agreement</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${equipmentRows.map((equipment, index) => {
                            const baseId = `works-equipment-${index}`;
                            return `
                                <tr class="works-equipment-row">
                                    <td class="works-equipment-name">
                                        <strong>${escapeBidWorkspaceHtml(equipment.equipmentName || `Equipment ${index + 1}`)}</strong>
                                        <small>${escapeBidWorkspaceHtml(`Requested: ${equipment.quantity || 1} / ${equipment.ownershipRequirement || 'Evidence required'}`)}</small>
                                    </td>
                                    <td>
                                        <div class="form-group">
                                            <input class="form-input" type="number" min="0" aria-label="Quantity available for ${escapeBidWorkspaceHtml(equipment.equipmentName || `Equipment ${index + 1}`)}" data-bid-response="${baseId}-quantity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-quantity`))}">
                                        </div>
                                    </td>
                                    <td>
                                        <div class="form-group">
                                            <select class="form-input" aria-label="Ownership status for ${escapeBidWorkspaceHtml(equipment.equipmentName || `Equipment ${index + 1}`)}" data-bid-response="${baseId}-ownership" data-bid-workflow-required-response="true"><option value="">Select</option>${['Owned', 'Leased', 'Hire agreement', 'Subcontractor provided'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-ownership`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select>
                                        </div>
                                    </td>
                                    <td>
                                        ${renderBidWorkspaceUploadControl(`${baseId}-lease-proof`, draft, 'Lease / access agreement', '.pdf,.doc,.docx,.jpg,.jpeg,.png', false)}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderWorksBidCapacityResponse(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const hseRequired = [
        fields.hseRequired,
        fields.requireHsePlan,
        fields.healthSafetyRequirements,
        fields.environmentalRequirements,
        fields.occupationalSafetyRequirement
    ].some(isBidWorkspaceRequiredConfig);
    return `
        <div class="works-capacity-workbook">
            ${renderWorksBidExperienceCards(tender, draft)}
            ${renderWorksBidPersonnelCards(tender, draft)}
            ${renderWorksBidEquipmentCards(tender, draft)}
            <section class="works-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Health, Safety and Environmental Response</h3>
                        <p>Provide site-specific safety, environmental, incident, PPE, and waste management controls.</p>
                    </div>
                    <span class="badge ${hseRequired ? 'badge-warning' : 'badge-info'}">${hseRequired ? 'Required if configured' : 'Optional response'}</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Safety Policy Available</label><select class="form-input" data-bid-response="works-hse-safety-policy" ${hseRequired ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-hse-safety-policy') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Environmental Policy Available</label><select class="form-input" data-bid-response="works-hse-environmental-policy" ${hseRequired ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-hse-environmental-policy') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Safety Officer Assigned</label><select class="form-input" data-bid-response="works-hse-safety-officer" ${hseRequired ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-hse-safety-officer') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-hse-documents', draft, 'Upload HSE documents', '.pdf,.doc,.docx,.jpg,.jpeg,.png', hseRequired)}</div>
                    <div class="form-group wide"><label class="form-label">PPE Plan</label><textarea class="form-input" rows="2" data-bid-response="works-hse-ppe-plan" ${hseRequired ? 'data-bid-workflow-required-response="true"' : ''}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-hse-ppe-plan'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Incident Management Plan</label><textarea class="form-input" rows="2" data-bid-response="works-hse-incident-plan">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-hse-incident-plan'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Waste Management Plan</label><textarea class="form-input" rows="2" data-bid-response="works-hse-waste-plan">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-hse-waste-plan'))}</textarea></div>
                </div>
            </section>
        </div>
    `;
}

function renderWorksBidTechnicalProposal(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const methodStatementRequired = [fields.methodStatementRequired, fields.requireMethodStatement, fields.methodStatement].some(isBidWorkspaceRequiredConfig);
    const ganttRequired = [fields.ganttChartRequired, fields.requireGanttChart, fields.workProgramRequired, fields.requireWorkProgram].some(isBidWorkspaceRequiredConfig);
    const proposalSections = [
        ['understanding', 'Project Understanding', 'Understanding of buyer scope, site conditions, drawings, constraints, and deliverables.'],
        ['methodology', 'Construction Methodology', 'Construction sequence, methods, supervision controls, testing, and handover approach.'],
        ['work-plan', 'Proposed Work Plan', 'Work breakdown, sequencing, mobilization, subcontractors, materials, and site logistics.'],
        ['site-strategy', 'Site Execution Strategy', 'Site establishment, access, hoarding, storage, utilities, and coordination.'],
        ['risk-plan', 'Risk Mitigation Plan', 'Technical, schedule, safety, environmental, and commercial risk controls.'],
        ['quality-plan', 'Quality Assurance Approach', 'Inspection test plans, material approvals, workmanship control, and QA/QC records.'],
        ['environment-safety', 'Environmental and Safety Measures', 'Worker safety, public safety, environmental safeguards, and incident response.']
    ];
    const milestones = getWorksBidMilestoneRows(tender);
    const drawings = getWorksBidDrawingRows(tender);
    const siteVisitMandatory = /mandatory|required/i.test(String(fields.siteVisitRequirement || ''));
    return `
        <div class="works-proposal-workbook">
            <section class="works-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Project understanding and methodology</h3>
                        <p>${escapeBidWorkspaceHtml(tender.requirements?.fields?.scopeSummary || tender.description || 'Explain how the contractor will execute and complete the works.')}</p>
                    </div>
                    <span class="badge badge-warning">Narrative required</span>
                </div>
                <div class="works-accordion-list">
                    ${proposalSections.map((section, index) => {
                        const responseId = `works-proposal-${section[0]}`;
                        return `
                            <details class="works-accordion-card" ${index < 2 ? 'open' : ''}>
                                <summary><strong>${section[1]}</strong><span>${section[2]}</span></summary>
                                <textarea class="form-input works-rich-textarea" rows="5" data-bid-response="${responseId}" data-bid-workflow-required-response="true" placeholder="Write the contractor response for ${escapeBidWorkspaceHtml(section[1].toLowerCase())}.">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, responseId))}</textarea>
                            </details>
                        `;
                    }).join('')}
                </div>
                <div class="form-grid two">
                    <div class="form-group wide"><label class="form-label">Traffic / Operational Continuity Plan</label><textarea class="form-input" rows="3" data-bid-response="works-proposal-continuity">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-proposal-continuity'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Assumptions and Clarifications</label><textarea class="form-input" rows="3" data-bid-response="works-proposal-assumptions">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-proposal-assumptions'))}</textarea></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-proposal-upload', draft, 'Technical proposal upload', '.pdf,.doc,.docx', true)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-method-statement-upload', draft, 'Method statement upload', '.pdf,.doc,.docx', methodStatementRequired)}</div>
                </div>
            </section>
            <section class="works-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Construction schedule / work program</h3>
                        <p>Prove milestone feasibility through start date, completion period, critical path, resources, and uploaded program.</p>
                    </div>
                    <span class="badge badge-warning">${milestones.length} milestones</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Proposed Start Date</label><input class="form-input" type="date" data-bid-response="works-schedule-start-date" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-schedule-start-date'))}"></div>
                    <div class="form-group"><label class="form-label">Proposed Completion Period</label><input class="form-input" data-bid-response="works-schedule-completion-period" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-schedule-completion-period') || tender.requirements?.fields?.completionPeriod || '')}" placeholder="e.g. 14 months"></div>
                    <div class="form-group wide"><label class="form-label">Resource Allocation Plan</label><textarea class="form-input" rows="3" data-bid-response="works-schedule-resources" data-bid-workflow-required-response="true">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-schedule-resources'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Shift / Working Hours Plan</label><textarea class="form-input" rows="2" data-bid-response="works-schedule-shifts">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-schedule-shifts'))}</textarea></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-gantt-chart-upload', draft, 'Upload Gantt chart', '.pdf,.doc,.docx,.xls,.xlsx,.mpp', ganttRequired)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-program-upload', draft, 'Upload work program', '.pdf,.doc,.docx,.xls,.xlsx,.mpp', ganttRequired)}</div>
                </div>
                <div class="works-milestone-table">
                    <table>
                        <thead><tr><th>Milestone</th><th>Buyer Target</th><th>Proposed Date</th><th>Duration</th><th>Dependencies</th></tr></thead>
                        <tbody>
                            ${(milestones.length ? milestones : [{ milestone: 'Practical completion', targetDate: tender.closingDate }]).map((milestone, index) => {
                                const baseId = `works-milestone-${index}`;
                                return `
                                    <tr>
                                        <td>${escapeBidWorkspaceHtml(milestone.milestone || milestone.name || `Milestone ${index + 1}`)}</td>
                                        <td>${escapeBidWorkspaceHtml(milestone.targetDate || milestone.date || 'Not set')}</td>
                                        <td><input class="form-input" type="date" data-bid-response="${baseId}-date" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-date`))}"></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-duration" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-duration`))}" placeholder="e.g. 6 weeks"></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-dependencies" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-dependencies`))}"></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
            <section class="works-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Drawings, design, and site investigation</h3>
                        <p>Acknowledge buyer drawings, submit design queries or alternatives, and record site visit evidence.</p>
                    </div>
                    <span class="badge ${siteVisitMandatory ? 'badge-warning' : 'badge-info'}">${siteVisitMandatory ? 'Site visit required' : 'Site visit response'}</span>
                </div>
                ${drawings.length ? `
                    <div class="works-drawing-list">
                        ${drawings.map((drawing, index) => `
                            <article class="works-drawing-card">
                                <strong>${escapeBidWorkspaceHtml(drawing.documentType || drawing.otherDocumentName || `Drawing ${index + 1}`)}</strong>
                                <span>${escapeBidWorkspaceHtml(drawing.buyerDocumentUpload || 'Buyer drawing uploaded')}</span>
                                <label class="bid-response-check"><input type="checkbox" data-bid-response="works-drawing-${index}-reviewed" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, `works-drawing-${index}-reviewed`) === true || getBidWorkspaceSavedResponse(draft, `works-drawing-${index}-reviewed`) === 'true' ? 'checked' : ''}><span>Drawing reviewed</span></label>
                            </article>
                        `).join('')}
                    </div>
                ` : '<div class="scope-empty">No drawing rows were configured by the buyer.</div>'}
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Design Clarification Needed</label><select class="form-input" data-bid-response="works-design-clarification"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-design-clarification') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-alternative-drawings', draft, 'Upload alternative drawings', '.pdf,.dwg,.dxf,.jpg,.jpeg,.png', false)}</div>
                    <div class="form-group wide"><label class="form-label">Proposed Design Alternative</label><textarea class="form-input" rows="2" data-bid-response="works-design-alternative">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-design-alternative'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Technical Queries</label><textarea class="form-input" rows="2" data-bid-response="works-technical-queries">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-technical-queries'))}</textarea></div>
                    <div class="form-group"><label class="form-label">Site Visit Conducted?</label><select class="form-input" data-bid-response="works-site-visit-conducted" ${siteVisitMandatory ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-site-visit-conducted') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Site Visit Date</label><input class="form-input" type="date" data-bid-response="works-site-visit-date" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-visit-date'))}"></div>
                    <div class="form-group"><label class="form-label">Representative Name</label><input class="form-input" data-bid-response="works-site-representative" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-representative'))}"></div>
                    <div class="form-group"><label class="form-label">Representative Position</label><input class="form-input" data-bid-response="works-site-representative-position" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-representative-position'))}"></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-site-visit-evidence', draft, 'Upload site visit evidence', '.pdf,.doc,.docx,.jpg,.jpeg,.png', siteVisitMandatory)}</div>
                    <div class="form-group wide"><label class="form-label">Site Constraints Identified</label><textarea class="form-input" rows="2" data-bid-response="works-site-constraints">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-constraints'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Site Visit Observations</label><textarea class="form-input" rows="2" data-bid-response="works-site-observations">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-observations'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Site Understanding Notes</label><textarea class="form-input" rows="2" data-bid-response="works-site-notes">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-notes'))}</textarea></div>
                </div>
            </section>
        </div>
    `;
}

function renderWorksBidFinancialRows(tender = {}, draft = {}) {
    const rows = getWorksBidBoqRows(tender);
    if (!rows.length) return '<tr><td colspan="12">No works BOQ configured.</td></tr>';
    return rows.map((item, index) => {
        const baseId = `works-boq-${index}`;
        const qty = parseBidWorkspaceNumber(item.quantity || item.qty) || 1;
        const unit = item.unit || item.unitOfMeasure || 'Lot';
        const labor = getBidWorkspaceSavedResponse(draft, `${baseId}-labor`) || Math.round(parseBidWorkspaceNumber(item.laborCost || item.rate || item.amount) * (item.laborCost ? 1 : 0.28));
        const material = getBidWorkspaceSavedResponse(draft, `${baseId}-material`) || Math.round(parseBidWorkspaceNumber(item.materialCost || item.rate || item.amount) * (item.materialCost ? 1 : 0.54));
        const equipment = getBidWorkspaceSavedResponse(draft, `${baseId}-equipment`) || Math.round(parseBidWorkspaceNumber(item.equipmentCost || item.rate || item.amount) * (item.equipmentCost ? 1 : 0.12));
        const overheads = getBidWorkspaceSavedResponse(draft, `${baseId}-overheads`) || Math.round(parseBidWorkspaceNumber(item.totalCost || item.rate || item.amount) * 0.04);
        const profit = getBidWorkspaceSavedResponse(draft, `${baseId}-profit`) || 6;
        const savedStatus = getBidWorkspaceSavedResponse(draft, `${baseId}-status`);
        const isNotBid = String(savedStatus || '').toLowerCase() === 'not bid';
        const direct = parseBidWorkspaceNumber(labor) + parseBidWorkspaceNumber(material) + parseBidWorkspaceNumber(equipment) + parseBidWorkspaceNumber(overheads);
        const lineTotal = Math.round(direct * (1 + (parseBidWorkspaceNumber(profit) / 100)));
        const unitRate = Math.round(lineTotal / qty);
        return `
            <tr class="works-boq-row" data-works-boq-row>
                <td class="financial-review-code">${escapeBidWorkspaceHtml(item.item || item.section || `${index + 1}.1`)}</td>
                <td class="financial-review-work-item"><strong>${escapeBidWorkspaceHtml(item.workItem || item.description || `Work item ${index + 1}`)}</strong><small>${escapeBidWorkspaceHtml(item.description || tender.contractType || 'Works BOQ item')}</small></td>
                <td class="financial-review-qty" data-bid-line-qty>${qty}</td>
                <td class="financial-review-unit">${escapeBidWorkspaceHtml(unit)}</td>
                <td>
                    <select class="form-input financial-review-select" data-bid-line-status data-bid-response="${baseId}-status" data-bid-workflow-required-response="true" aria-label="Bid status for work item ${index + 1}">
                        <option value="">Select</option>
                        ${['Bid', 'Not Bid'].map(option => `<option ${savedStatus === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td><div class="money-edit-field"><span>TZS</span><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-labor" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(labor)}" aria-label="Labor cost for work item ${index + 1}"></div></td>
                <td><div class="money-edit-field"><span>TZS</span><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-material" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(material)}" aria-label="Material cost for work item ${index + 1}"></div></td>
                <td><div class="money-edit-field"><span>TZS</span><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-equipment" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(equipment)}" aria-label="Equipment cost for work item ${index + 1}"></div></td>
                <td><div class="money-edit-field"><span>TZS</span><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-overheads" value="${escapeBidWorkspaceHtml(overheads)}" aria-label="Overheads for work item ${index + 1}"></div></td>
                <td><input class="form-input financial-review-profit" type="number" min="0" max="100" step="0.5" data-works-cost data-bid-response="${baseId}-profit" value="${escapeBidWorkspaceHtml(profit)}" aria-label="Profit margin percentage for work item ${index + 1}"></td>
                <td class="financial-review-total-cell" data-works-unit-rate>${formatBidWorkspaceMoney(unitRate)}<input type="hidden" data-bid-rate data-bid-response="${baseId}-unit-rate" value="${unitRate}"></td>
                <td class="financial-review-grand-total" data-bid-line-amount>${isNotBid ? formatBidWorkspaceMoney(0) : formatBidWorkspaceMoney(lineTotal)}</td>
            </tr>
        `;
    }).join('');
}

function renderWorksBidCommercialTerms(draft = {}) {
    const bidSecuritySubmitted = getBidWorkspaceSavedResponse(draft, 'works-commercial-bid-security-submitted') === true || getBidWorkspaceSavedResponse(draft, 'works-commercial-bid-security-submitted') === 'true';
    return `
        <div class="goods-commercial-terms works-commercial-terms">
            <div class="form-grid two">
                <div class="form-group"><label class="form-label">Bid Validity Period (days)</label><input class="form-input" type="number" min="1" data-bid-response="works-commercial-bid-validity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-commercial-bid-validity') || 120)}"></div>
                <div class="form-group"><label class="form-label">Currency</label><select class="form-input" data-bid-response="works-commercial-currency" data-bid-workflow-required-response="true">${['TZS', 'USD', 'EUR', 'GBP'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-commercial-currency') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group wide"><label class="form-label">Commercial Clarifications</label><textarea class="form-input" rows="2" data-bid-response="works-commercial-clarifications" placeholder="Optional BOQ pricing assumptions only. Contract terms are handled after award.">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-commercial-clarifications'))}</textarea></div>
                <label class="bid-response-check"><input type="checkbox" data-bid-response="works-commercial-bid-security-submitted" data-bid-security-toggle ${bidSecuritySubmitted ? 'checked' : ''}><span>Bid security submitted, if required by this tender.</span></label>
                <div class="form-group wide bid-security-upload-panel" data-bid-security-upload-panel ${bidSecuritySubmitted ? '' : 'hidden'}>
                    ${renderBidWorkspaceUploadControl('works-commercial-bid-security-document', draft, 'Bid security document', '.pdf,.doc,.docx,.jpg,.jpeg,.png', bidSecuritySubmitted)}
                </div>
            </div>
        </div>
    `;
}

function renderWorksBidDeclaration(draft = {}) {
    return `
        <div class="form-grid two">
            <div class="form-group"><label class="form-label">Authorized Signatory Name</label><input class="form-input" data-bid-response="works-declaration-signatory" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-declaration-signatory'))}"></div>
            <div class="form-group"><label class="form-label">Position</label><input class="form-input" data-bid-response="works-declaration-position" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-declaration-position'))}"></div>
            <div class="form-group">${renderBidWorkspaceUploadControl('works-declaration-company-stamp', draft, 'Company stamp upload', '.pdf,.jpg,.jpeg,.png', false)}</div>
            <div class="form-group"><label class="form-label">Digital Signature</label><input class="form-input" data-bid-response="works-declaration-signature" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-declaration-signature'))}" placeholder="Type authorized digital signature"></div>
            <label class="bid-response-check"><input type="checkbox" data-bid-response="works-declaration-final" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'works-declaration-final') === true || getBidWorkspaceSavedResponse(draft, 'works-declaration-final') === 'true' ? 'checked' : ''}><span>I confirm this works bid is complete, accurate, and authorized.</span></label>
            <label class="bid-response-check"><input type="checkbox" data-bid-response="works-declaration-conflict" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'works-declaration-conflict') === true || getBidWorkspaceSavedResponse(draft, 'works-declaration-conflict') === 'true' ? 'checked' : ''}><span>I declare no conflict of interest.</span></label>
            <label class="bid-response-check"><input type="checkbox" data-bid-response="works-declaration-anti-corruption" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'works-declaration-anti-corruption') === true || getBidWorkspaceSavedResponse(draft, 'works-declaration-anti-corruption') === 'true' ? 'checked' : ''}><span>I accept anti-corruption declarations.</span></label>
        </div>
    `;
}

function getServiceBidPersonnelRows(tender = {}) {
    const rows = tender.requirements?.fields?.personnelRequirementRows || [];
    return rows.length ? rows : [];
}

function getServiceBidEquipmentRows(tender = {}) {
    return tender.requirements?.fields?.equipmentRequirementRows || [];
}

function getServiceBidFinancialRows(tender = {}) {
    return tender.requirements?.fields?.financialRequirementRows || [];
}

function getServiceBidDocumentRows(tender = {}) {
    const rows = tender.requirements?.fields?.supportingDocumentRows || [];
    if (rows.length) return rows;
    return (tender.documents || ['Methodology document', 'Company registration', 'Insurance certificate']).map(name => ({ documentName: name, mandatory: true }));
}

function getServiceBidLocationRows(tender = {}) {
    return tender.requirements?.fields?.serviceLocations || [];
}

function getServiceBidMilestoneRows(tender = {}) {
    return tender.requirements?.fields?.serviceMilestones || [];
}

function getServiceBidCommercialRows(tender = {}, profile = {}) {
    return tender.commercialItems?.length ? tender.commercialItems : (tender.boqItems || profile.defaultItems || []);
}

function getServiceBidCategoryConfig(category = '') {
    const key = String(category || '').toLowerCase();
    if (/security|guard/.test(key)) {
        return {
            title: 'Security service category response',
            buyerFields: [
                ['Number of guards', 'numberOfGuards'],
                ['Shift schedule', 'shiftSchedule'],
                ['Patrol frequency', 'patrolFrequency'],
                ['Weapon requirement', 'weaponRequirement'],
                ['Control room requirement', 'controlRoomRequirement']
            ],
            responses: [
                ['guards-available', 'Guards Available', 'number'],
                ['shift-plan', 'Shift Coverage Plan', 'textarea'],
                ['patrol-plan', 'Patrol Method', 'textarea'],
                ['control-room', 'Control Room / Supervision Plan', 'textarea'],
                ['license-evidence', 'Security License Evidence', 'upload']
            ]
        };
    }
    if (/clean/.test(key)) {
        return {
            title: 'Cleaning service category response',
            buyerFields: [
                ['Cleaning areas', 'cleaningAreas'],
                ['Cleaning frequency', 'cleaningFrequency'],
                ['Materials', 'cleaningMaterials'],
                ['Waste disposal', 'wasteDisposalRequirements']
            ],
            responses: [
                ['area-coverage', 'Area Coverage Confirmation', 'textarea'],
                ['schedule', 'Cleaning Schedule', 'textarea'],
                ['materials', 'Materials / Consumables List', 'textarea'],
                ['waste-plan', 'Waste Disposal Approach', 'textarea'],
                ['hygiene-evidence', 'Hygiene / Safety Evidence', 'upload']
            ]
        };
    }
    if (/it|ict|support|internet|software|network/.test(key)) {
        return {
            title: 'IT support service category response',
            buyerFields: [
                ['SLA requirement', 'slaRequirement'],
                ['Uptime requirement', 'uptimeRequirement'],
                ['Response time', 'responseTime'],
                ['Support hours', 'supportHours']
            ],
            responses: [
                ['sla-commitment', 'SLA Commitment', 'textarea'],
                ['uptime-guarantee', 'Uptime Guarantee', 'input'],
                ['response-time', 'Response Time Commitment', 'input'],
                ['support-model', 'Support Model', 'textarea'],
                ['tool-evidence', 'Monitoring / Ticketing Evidence', 'upload']
            ]
        };
    }
    if (/maintenance|repair|generator|vehicle|plant/.test(key)) {
        return {
            title: 'Maintenance service category response',
            buyerFields: [
                ['Maintenance schedule', 'maintenanceSchedule'],
                ['Spare parts requirement', 'sparePartsRequirement'],
                ['Technician requirements', 'technicianRequirements']
            ],
            responses: [
                ['maintenance-plan', 'Maintenance Schedule Response', 'textarea'],
                ['spares', 'Spare Parts Availability', 'textarea'],
                ['technicians', 'Technician Qualifications', 'textarea'],
                ['workshop-evidence', 'Workshop / Tooling Evidence', 'upload']
            ]
        };
    }
    if (/catering|food|meal/.test(key)) {
        return {
            title: 'Catering service category response',
            buyerFields: [
                ['Menu requirements', 'menuRequirements'],
                ['Hygiene requirements', 'hygieneRequirements'],
                ['Food certifications', 'foodCertifications']
            ],
            responses: [
                ['menu-compliance', 'Menu Compliance', 'textarea'],
                ['hygiene-plan', 'Hygiene Plan', 'textarea'],
                ['certifications', 'Food Certification Notes', 'textarea'],
                ['sample-menu', 'Sample Menu / Certification Upload', 'upload']
            ]
        };
    }
    if (/transport|logistics|fleet|driver/.test(key)) {
        return {
            title: 'Transport service category response',
            buyerFields: [
                ['Fleet requirements', 'fleetRequirements'],
                ['Driver license requirements', 'driverLicenseRequirements'],
                ['Route coverage', 'routeCoverage']
            ],
            responses: [
                ['fleet', 'Fleet Availability', 'textarea'],
                ['drivers', 'Driver License Compliance', 'textarea'],
                ['routes', 'Route Coverage Plan', 'textarea'],
                ['insurance', 'Insurance / Vehicle Evidence', 'upload']
            ]
        };
    }
    return null;
}

function renderServiceBidCategoryResponse(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const category = fields.serviceCategory || tender.category || tender.type || '';
    const config = getServiceBidCategoryConfig(category);
    if (!config) return '';
    return `
        <section class="service-response-section service-category-response">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>${escapeBidWorkspaceHtml(config.title)}</h3>
                    <p>Respond directly to the category-specific buyer requirements for ${escapeBidWorkspaceHtml(category)}.</p>
                </div>
                <span class="badge badge-warning">Category response</span>
            </div>
            <div class="service-category-context-grid">
                ${config.buyerFields.map(([label, key]) => `
                    <article>
                        <span>${escapeBidWorkspaceHtml(label)}</span>
                        <strong>${escapeBidWorkspaceHtml(fields[key] || 'Not specified')}</strong>
                    </article>
                `).join('')}
            </div>
            <div class="form-grid two">
                ${config.responses.map(([key, label, type]) => {
                    const responseId = `service-category-${key}`;
                    if (type === 'upload') {
                        return `<div class="form-group wide">${renderBidWorkspaceUploadControl(responseId, draft, label, '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', false)}</div>`;
                    }
                    if (type === 'number') {
                        return `<div class="form-group"><label class="form-label">${escapeBidWorkspaceHtml(label)}</label><input class="form-input" type="number" min="0" data-bid-response="${responseId}" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, responseId))}"></div>`;
                    }
                    if (type === 'input') {
                        return `<div class="form-group"><label class="form-label">${escapeBidWorkspaceHtml(label)}</label><input class="form-input" data-bid-response="${responseId}" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, responseId))}"></div>`;
                    }
                    return `<div class="form-group wide"><label class="form-label">${escapeBidWorkspaceHtml(label)}</label><textarea class="form-input" rows="3" data-bid-response="${responseId}" data-bid-workflow-required-response="true">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, responseId))}</textarea></div>`;
                }).join('')}
            </div>
        </section>
    `;
}

function renderServiceBidMethodology(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const methodologyUploadRequired = [fields.serviceMethodologyDocumentRequired, fields.requireServiceMethodologyDocument, fields.methodologyDocumentRequired].some(isBidWorkspaceRequiredConfig);
    const blocks = [
        ['understanding', 'Understanding of Service', fields.scopeOfServices || tender.description || 'Explain the buyer service need and operational context.'],
        ['methodology', 'Service Delivery Methodology', 'Describe how the service will be delivered, controlled, supervised, and improved.'],
        ['work-plan', 'Approach and Work Plan', 'Describe mobilization, handover, recurring activities, quality checks, and closure.'],
        ['quality', 'Quality Assurance Approach', 'Describe inspection, review, acceptance, and corrective action controls.'],
        ['reporting', 'Reporting Method', fields.reportingRequirements || 'Describe reports, dashboards, data sources, and buyer communication rhythm.'],
        ['risk', 'Risk Management Approach', fields.riskAssessmentRequirement || 'Describe risks, mitigation, escalation, and continuity controls.']
    ];
    const deliverables = fields.serviceDeliverables || tender.deliverables?.map(text => ({ text })) || [];
    return `
        <div class="service-workbook">
            ${renderServiceBidCategoryResponse(tender, draft)}
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Service understanding and methodology</h3>
                        <p>${escapeBidWorkspaceHtml(fields.scopeOfServices || tender.description || 'Explain how the service will be delivered and guaranteed.')}</p>
                    </div>
                    <span class="badge badge-warning">Core response</span>
                </div>
                <div class="service-accordion-list">
                    ${blocks.map((block, index) => {
                        const responseId = `service-method-${block[0]}`;
                        return `
                            <details class="service-accordion-card" ${index < 2 ? 'open' : ''}>
                                <summary><strong>${escapeBidWorkspaceHtml(block[1])}</strong><span>${escapeBidWorkspaceHtml(block[2])}</span></summary>
                                <textarea class="form-input works-rich-textarea" rows="5" data-bid-response="${responseId}" data-bid-workflow-required-response="true">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, responseId))}</textarea>
                            </details>
                        `;
                    }).join('')}
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Tools / Systems Used</label><input class="form-input" data-bid-response="service-method-tools" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-method-tools'))}" placeholder="Systems, software, equipment, or service tools"></div>
                    <div class="form-group"><label class="form-label">Service Frequency</label><select class="form-input" data-bid-response="service-method-frequency" data-bid-workflow-required-response="true"><option value="">Select</option>${['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On demand', fields.cleaningFrequency || 'As required'].filter(Boolean).map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-method-frequency') === option ? 'selected' : ''}>${escapeBidWorkspaceHtml(option)}</option>`).join('')}</select></div>
                    <div class="form-group wide"><label class="form-label">Service Workflow Steps</label><textarea class="form-input" rows="3" data-bid-response="service-method-workflow" data-bid-workflow-required-response="true" placeholder="List the steps from request/intake through delivery, QA, reporting, and closure.">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-method-workflow'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Service Assumptions</label><textarea class="form-input" rows="2" data-bid-response="service-method-assumptions">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-method-assumptions'))}</textarea></div>
                    <div class="form-group wide">${renderBidWorkspaceUploadControl('service-methodology-upload', draft, 'Upload methodology document', '.pdf,.doc,.docx', methodologyUploadRequired)}</div>
                </div>
            </section>
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Deliverables mapping</h3>
                        <p>Map each buyer deliverable to the supplier method, output evidence, and reporting proof.</p>
                    </div>
                    <span class="badge badge-info">${deliverables.length} deliverables</span>
                </div>
                <div class="service-sla-card-grid">
                    ${(deliverables.length ? deliverables : [{ text: 'Service delivery report' }]).map((item, index) => {
                        const baseId = `service-deliverable-${index}`;
                        const label = item.text || item.deliverableName || `Deliverable ${index + 1}`;
                        return `
                            <article class="service-sla-card">
                                <span class="section-kicker">Buyer deliverable</span>
                                <strong>${escapeBidWorkspaceHtml(label)}</strong>
                                <div class="form-grid two">
                                    <div class="form-group"><label class="form-label">Supplier Output Evidence</label><input class="form-input" data-bid-response="${baseId}-evidence" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-evidence`))}"></div>
                                    <div class="form-group"><label class="form-label">Acceptance Method</label><input class="form-input" data-bid-response="${baseId}-acceptance" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-acceptance`))}"></div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </section>
        </div>
    `;
}

function renderServiceBidDeliveryPlan(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const locations = getServiceBidLocationRows(tender);
    const milestones = getServiceBidMilestoneRows(tender);
    return `
        <div class="service-workbook">
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Service schedule and delivery plan</h3>
                        <p>Define when and where the service happens, response windows, coverage, milestones, and availability controls.</p>
                    </div>
                    <span class="badge badge-warning">SLA schedule</span>
                </div>
                <div class="service-sla-timer-grid">
                    <article><span>Buyer SLA</span><strong>${escapeBidWorkspaceHtml(fields.slaRequirement || fields.responseTime || 'SLA not specified')}</strong></article>
                    <article><span>Support hours</span><strong>${escapeBidWorkspaceHtml(fields.supportHours || fields.cleaningFrequency || 'As specified')}</strong></article>
                    <article><span>Duration</span><strong>${escapeBidWorkspaceHtml(fields.duration || 'Not specified')}</strong></article>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Service Start Date</label><input class="form-input" type="date" data-bid-response="service-schedule-start-date" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-start-date'))}"></div>
                    <div class="form-group"><label class="form-label">Service End Date / Duration</label><input class="form-input" data-bid-response="service-schedule-duration" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-duration') || fields.duration || '')}"></div>
                    <div class="form-group"><label class="form-label">Working Hours</label><input class="form-input" data-bid-response="service-schedule-working-hours" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-working-hours') || fields.supportHours || '')}"></div>
                    <div class="form-group"><label class="form-label">Response Time (SLA)</label><input class="form-input" data-bid-response="service-schedule-response-time" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-response-time') || fields.responseTime || '')}"></div>
                    <div class="form-group"><label class="form-label">Turnaround Time</label><input class="form-input" data-bid-response="service-schedule-turnaround" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-turnaround'))}"></div>
                    <div class="form-group"><label class="form-label">Service Locations Covered</label><input class="form-input" data-bid-response="service-schedule-locations" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-locations') || locations.map(item => item.text).filter(Boolean).join(', '))}"></div>
                    <div class="form-group wide"><label class="form-label">Availability Plan</label><textarea class="form-input" rows="3" data-bid-response="service-schedule-availability" data-bid-workflow-required-response="true">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-schedule-availability'))}</textarea></div>
                </div>
                <div class="works-milestone-table service-milestone-table">
                    <table>
                        <thead><tr><th>Milestone</th><th>Supplier Target Date</th><th>Owner</th><th>Acceptance Evidence</th></tr></thead>
                        <tbody>
                            ${(milestones.length ? milestones : [{ text: 'Service mobilization complete' }, { text: 'First monthly performance report' }]).map((item, index) => {
                                const baseId = `service-milestone-${index}`;
                                return `
                                    <tr>
                                        <td>${escapeBidWorkspaceHtml(item.text || item.milestone || `Milestone ${index + 1}`)}</td>
                                        <td><input class="form-input" type="date" data-bid-response="${baseId}-date" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-date`))}"></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-owner" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-owner`))}"></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-evidence" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-evidence`))}"></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    `;
}

function renderServiceBidStaffingCapacity(tender = {}, draft = {}) {
    const personnelRows = getServiceBidPersonnelRows(tender);
    const equipmentRows = getServiceBidEquipmentRows(tender);
    return `
        <div class="service-workbook">
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Personnel / staffing plan</h3>
                        <p>Assign service roles, staff names, qualifications, allocations, CVs, certifications, and replacement plans.</p>
                    </div>
                    <span class="badge badge-warning">${personnelRows.length} roles</span>
                </div>
                ${personnelRows.length ? `
                    <div class="service-staffing-grid">
                        ${personnelRows.map((person, index) => {
                        const baseId = `service-staff-${index}`;
                        const role = person.position || person.role || person.staffRole || `Service role ${index + 1}`;
                        const required = person.mandatory !== false;
                        return `
                            <article class="service-staff-card">
                                <div class="works-person-avatar">${escapeBidWorkspaceHtml(String(role).slice(0, 1).toUpperCase())}</div>
                                <div>
                                    <span class="section-kicker">${escapeBidWorkspaceHtml(role)}</span>
                                    <p>Minimum: ${escapeBidWorkspaceHtml(person.minimumEducation || 'Buyer-defined qualification')} / ${escapeBidWorkspaceHtml(person.minimumYearsExperience || 0)} years</p>
                                    <div class="form-grid two">
                                        <div class="form-group"><label class="form-label">Assigned Staff Name</label><input class="form-input" data-bid-response="${baseId}-name" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-name`))}"></div>
                                        <div class="form-group"><label class="form-label">Qualification</label><input class="form-input" data-bid-response="${baseId}-qualification" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-qualification`))}"></div>
                                        <div class="form-group"><label class="form-label">Experience (Years)</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-experience" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-experience`))}"></div>
                                        <div class="form-group"><label class="form-label">Employment Type</label><select class="form-input" data-bid-response="${baseId}-employment"><option value="">Select</option>${['Full-time', 'Part-time', 'Contract'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-employment`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                        <div class="form-group"><label class="form-label">Availability</label><select class="form-input" data-bid-response="${baseId}-availability" ${required ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Available', 'Available on award', 'Backup proposed'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-availability`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                        <div class="form-group"><label class="form-label">Daily / Monthly Allocation</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-allocation" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-allocation`))}" placeholder="Hours or days"></div>
                                        <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-cv`, draft, 'CV upload', '.pdf,.doc,.docx', required && normalizeBidWorkspaceFlag(person.cvRequired))}</div>
                                        <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-certification`, draft, 'Certification upload', '.pdf,.doc,.docx,.jpg,.jpeg,.png', false)}</div>
                                        <div class="form-group wide"><label class="form-label">Replacement Plan</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-replacement">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-replacement`))}</textarea></div>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                    </div>
                ` : '<div class="scope-empty">No personnel requirements configured for this tender.</div>'}
            </section>
            ${equipmentRows.length ? `
                <section class="service-response-section">
                    <div class="bid-dynamic-group-heading">
                        <div><h3>Tools, systems, and equipment capacity</h3><p>Confirm equipment, systems, and proof required for service delivery.</p></div>
                        <span class="badge badge-warning">${equipmentRows.length} items</span>
                    </div>
                    <div class="works-equipment-grid">
                        ${equipmentRows.map((item, index) => {
                            const baseId = `service-equipment-${index}`;
                            return `
                                <article class="works-capacity-card service-capacity-card">
                                    <span class="section-kicker">${escapeBidWorkspaceHtml(item.equipmentName || `Equipment ${index + 1}`)}</span>
                                    <p>${escapeBidWorkspaceHtml(item.technicalSpecification || item.ownershipRequirement || 'Buyer-required service equipment or tool')}</p>
                                    <div class="form-grid two">
                                        <div class="form-group"><label class="form-label">Quantity Available</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-quantity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-quantity`))}"></div>
                                        <div class="form-group"><label class="form-label">Ownership / Access</label><select class="form-input" data-bid-response="${baseId}-ownership" data-bid-workflow-required-response="true"><option value="">Select</option>${['Owned', 'Leased', 'Subscription', 'Partner provided'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-ownership`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                        <div class="form-group wide">${renderBidWorkspaceUploadControl(`${baseId}-proof`, draft, 'Upload proof', '.pdf,.doc,.docx,.jpg,.jpeg,.png', item.mandatory !== false)}</div>
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </section>
            ` : ''}
        </div>
    `;
}

function renderServiceBidSlaReportingCompliance(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const esCards = fields.esRequirementCards || [];
    const docs = getServiceBidDocumentRows(tender);
    const kpis = (tender.evaluation?.criteria || []).find(item => /sla|performance/i.test(item.name || ''))?.subcriteria || ['Response time', 'Resolution time', 'Task completion rate', 'Customer satisfaction'];
    return `
        <div class="service-workbook">
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Performance and SLA response</h3><p>Accept SLA requirements, map KPI commitments, penalties, reporting cadence, and escalation controls.</p></div>
                    <span class="badge badge-warning">SLA required</span>
                </div>
                <div class="service-sla-timer-grid">
                    <article><span>SLA requirement</span><strong>${escapeBidWorkspaceHtml(fields.slaRequirement || 'Buyer SLA schedule')}</strong></article>
                    <article><span>Response time</span><strong>${escapeBidWorkspaceHtml(fields.responseTime || 'Supplier to propose')}</strong></article>
                    <article><span>Uptime / availability</span><strong>${escapeBidWorkspaceHtml(fields.uptimeRequirement || 'Not specified')}</strong></article>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">SLA Acceptance</label><select class="form-input" data-bid-response="service-sla-acceptance" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No', 'With improvements'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-sla-acceptance') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Reporting Frequency</label><select class="form-input" data-bid-response="service-sla-reporting-frequency" data-bid-workflow-required-response="true"><option value="">Select</option>${['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On demand'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-sla-reporting-frequency') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group wide"><label class="form-label">Proposed SLA Improvement</label><textarea class="form-input" rows="2" data-bid-response="service-sla-improvement">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-sla-improvement'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Escalation Procedure</label><textarea class="form-input" rows="3" data-bid-response="service-sla-escalation" data-bid-workflow-required-response="true">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-sla-escalation'))}</textarea></div>
                    <label class="bid-response-check"><input type="checkbox" data-bid-response="service-sla-penalty-acceptance" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'service-sla-penalty-acceptance') === true || getBidWorkspaceSavedResponse(draft, 'service-sla-penalty-acceptance') === 'true' ? 'checked' : ''}><span>I accept SLA penalties and service credit provisions.</span></label>
                </div>
                <div class="service-kpi-grid">
                    ${kpis.map((kpi, index) => {
                        const baseId = `service-kpi-${index}`;
                        return `
                            <article class="service-kpi-card">
                                <strong>${escapeBidWorkspaceHtml(kpi)}</strong>
                                <label class="form-label">Commitment level</label>
                                <input class="form-input" type="range" min="50" max="100" step="5" data-bid-response="${baseId}-commitment" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-commitment`) || 90)}">
                                <textarea class="form-input" rows="2" data-bid-response="${baseId}-metric" placeholder="Metric definition and evidence">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-metric`))}</textarea>
                            </article>
                        `;
                    }).join('')}
                </div>
            </section>
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Reporting and communication plan</h3><p>${escapeBidWorkspaceHtml(fields.reportingRequirements || 'Define reporting format, channels, templates, escalation, and meetings.')}</p></div>
                    <span class="badge badge-info">Continuous reporting</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Reporting Format</label><select class="form-input" data-bid-response="service-report-format"><option value="">Select</option>${['PDF', 'Excel dashboard', 'Portal dashboard', 'Presentation'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-report-format') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Communication Channels</label><input class="form-input" data-bid-response="service-report-channels" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-report-channels'))}" placeholder="Portal, email, meetings, hotline"></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('service-report-template', draft, 'Client reporting template', '.pdf,.doc,.docx,.xls,.xlsx', false)}</div>
                    <div class="form-group"><label class="form-label">Meeting Schedule</label><input class="form-input" data-bid-response="service-report-meetings" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-report-meetings'))}" placeholder="e.g. Monthly review meeting"></div>
                    <div class="form-group wide"><label class="form-label">Escalation Matrix</label><textarea class="form-input" rows="3" data-bid-response="service-report-escalation-matrix">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-report-escalation-matrix'))}</textarea></div>
                </div>
            </section>
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Environmental, social, and labor compliance</h3><p>Respond to labor, safety, inclusion, environmental, and SEA/SH requirements.</p></div>
                    <span class="badge badge-warning">${esCards.length || 4} checks</span>
                </div>
                <div class="service-sla-card-grid">
                    ${(esCards.length ? esCards : [
                        { category: 'Labor Compliance', description: 'Formal employment and lawful labor practices.', mandatory: true },
                        { category: 'Worker Safety', description: 'Workplace safety measures and PPE.', mandatory: true },
                        { category: 'Gender and Inclusion', description: 'Inclusion policy and fair treatment.', mandatory: false },
                        { category: 'Environmental Policy', description: 'Environmental controls for service delivery.', mandatory: false }
                    ]).map((card, index) => {
                        const baseId = `service-esg-${index}`;
                        return `
                            <article class="service-sla-card">
                                <span class="section-kicker">${escapeBidWorkspaceHtml(card.category || `ESG ${index + 1}`)}</span>
                                <p>${escapeBidWorkspaceHtml(card.description || 'Compliance response required.')}</p>
                                <div class="form-grid two">
                                    <div class="form-group"><label class="form-label">Policy Available</label><select class="form-input" data-bid-response="${baseId}-policy" ${card.mandatory !== false ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Yes', 'No', 'In development'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-policy`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                    <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-document`, draft, 'Upload ESG document', '.pdf,.doc,.docx,.jpg,.jpeg,.png', card.mandatory !== false)}</div>
                                    <div class="form-group wide"><label class="form-label">Measures / Notes</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-notes">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-notes`))}</textarea></div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </section>
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Supporting documents</h3><p>Upload the buyer-required service documents and generic compliance evidence.</p></div>
                    <span class="badge badge-warning">${docs.length} documents</span>
                </div>
                <div class="service-document-grid">
                    ${docs.map((doc, index) => {
                        const baseId = `service-doc-${index}`;
                        const required = doc.mandatory !== false;
                        return `
                            <article class="service-document-card">
                                <span class="section-kicker">${required ? 'Mandatory' : 'Optional'}</span>
                                <strong>${escapeBidWorkspaceHtml(doc.documentName || doc.documentTitle || `Document ${index + 1}`)}</strong>
                                <div class="form-grid two">
                                    <div class="form-group"><label class="form-label">Document Name</label><input class="form-input" data-bid-response="${baseId}-name" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-name`) || doc.documentName || '')}"></div>
                                    <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-upload`, draft, 'Upload file', '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', required)}</div>
                                    <div class="form-group wide"><label class="form-label">Description</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-description">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-description`))}</textarea></div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </section>
        </div>
    `;
}

function renderServiceBidPricingRows(tender = {}, profile = {}, draft = {}) {
    const rows = getServiceBidCommercialRows(tender, profile);
    if (!rows.length) return '<tr><td colspan="8">No service pricing schedule configured.</td></tr>';
    return rows.map((item, index) => {
        const baseId = `service-price-${index}`;
        const qty = parseBidWorkspaceNumber(item.qty || item.quantity) || 1;
        const frequency = item.frequency || item.unit || item.unitOfMeasure || 'Monthly';
        const buyerRate = parseBidWorkspaceNumber(item.rate || item.unitPrice || item.amount);
        const monthlyRate = getBidWorkspaceSavedResponse(draft, `${baseId}-monthly-rate`) || (buyerRate ? Math.round(buyerRate * 0.98) : '');
        const equipmentCost = getBidWorkspaceSavedResponse(draft, `${baseId}-equipment-cost`) || '';
        const staffCount = getBidWorkspaceSavedResponse(draft, `${baseId}-staff-count`) || item.staffCount || '';
        const savedStatus = getBidWorkspaceSavedResponse(draft, `${baseId}-status`);
        const isNotBid = String(savedStatus || '').toLowerCase() === 'not bid';
        return `
            <tr class="service-pricing-row">
                <td>${escapeBidWorkspaceHtml(item.item || item.category || `${index + 1}.1`)}</td>
                <td><strong>${escapeBidWorkspaceHtml(item.description || item.serviceTask || `Service line ${index + 1}`)}</strong><small>${escapeBidWorkspaceHtml(item.slaLink || item.notes || 'Service pricing line')}</small></td>
                <td><select class="form-input" data-bid-line-status data-bid-response="${baseId}-status" data-bid-workflow-required-response="true"><option value="">Select</option>${['Bid', 'Not Bid'].map(option => `<option ${savedStatus === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                <td><input class="form-input" data-bid-response="${baseId}-frequency" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-frequency`) || frequency)}"></td>
                <td><input class="form-input" type="number" min="0" data-bid-line-qty data-bid-response="${baseId}-staff-count" value="${escapeBidWorkspaceHtml(staffCount || qty)}"></td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" data-bid-rate data-bid-response="${baseId}-monthly-rate" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(monthlyRate)}"></td>
                <td><input class="form-input" type="number" min="0" step="1000" data-bid-line-extra-cost data-bid-response="${baseId}-equipment-cost" value="${escapeBidWorkspaceHtml(equipmentCost)}"></td>
                <td data-bid-line-amount>${isNotBid ? formatBidWorkspaceMoney(0) : formatBidWorkspaceMoney(((parseBidWorkspaceNumber(staffCount || qty) || 1) * parseBidWorkspaceNumber(monthlyRate)) + parseBidWorkspaceNumber(equipmentCost))}</td>
            </tr>
            <tr class="service-price-detail-row">
                <td></td>
                <td colspan="7">
                    <div class="works-cost-grid service-cost-grid">
                        <div class="form-group"><label class="form-label">Pricing Model</label><select class="form-input" data-bid-response="${baseId}-model" data-bid-workflow-required-response="true"><option value="">Select</option>${['Monthly Retainer', 'Unit Rate', 'Lump Sum', 'Hybrid', 'SLA-based'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-model`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                        <div class="form-group"><label class="form-label">VAT / Taxes Included</label><select class="form-input" data-bid-response="${baseId}-tax-included" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-tax-included`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                        <div class="form-group"><label class="form-label">Discount</label><input class="form-input" data-bid-response="${baseId}-discount" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-discount`))}" placeholder="%"></div>
                        <div class="form-group"><label class="form-label">SLA Cost Linkage</label><input class="form-input" data-bid-response="${baseId}-sla-link" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-sla-link`))}" placeholder="KPI or SLA metric"></div>
                        <div class="form-group wide"><label class="form-label">Cost Breakdown</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-breakdown">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-breakdown`))}</textarea></div>
                        <div class="form-group wide"><label class="form-label">Payment Milestones</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-payment-milestones">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-payment-milestones`))}</textarea></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderServiceBidCommercialTerms(draft = {}) {
    return `
        <div class="goods-commercial-terms service-commercial-terms">
            <div class="form-grid two">
                <div class="form-group"><label class="form-label">Price Validity Period (days)</label><input class="form-input" type="number" min="1" data-bid-response="service-commercial-validity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-commercial-validity') || 90)}"></div>
                <div class="form-group"><label class="form-label">Currency</label><select class="form-input" data-bid-response="service-commercial-currency" data-bid-workflow-required-response="true">${['TZS', 'USD', 'EUR', 'GBP'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-commercial-currency') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Overall Pricing Model</label><select class="form-input" data-bid-response="service-commercial-model" data-bid-workflow-required-response="true"><option value="">Select</option>${['Lump Sum', 'Unit Rate', 'Monthly Retainer', 'Hybrid', 'SLA-based'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-commercial-model') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Discount Offer</label><input class="form-input" data-bid-response="service-commercial-discount" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-commercial-discount'))}" placeholder="Amount or %"></div>
                <div class="form-group wide"><label class="form-label">Commercial Assumptions</label><textarea class="form-input" rows="2" data-bid-response="service-commercial-assumptions">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-commercial-assumptions'))}</textarea></div>
            </div>
        </div>
    `;
}

function renderServiceBidDeclaration(draft = {}) {
    return `
        <div class="form-grid two">
            <div class="form-group"><label class="form-label">Authorized Person Name</label><input class="form-input" data-bid-response="service-declaration-name" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-declaration-name'))}"></div>
            <div class="form-group"><label class="form-label">Position</label><input class="form-input" data-bid-response="service-declaration-position" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-declaration-position'))}"></div>
            <div class="form-group"><label class="form-label">Digital Signature</label><input class="form-input" data-bid-response="service-declaration-signature" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-declaration-signature'))}" placeholder="Type authorized digital signature"></div>
            <label class="bid-response-check"><input type="checkbox" data-bid-response="service-declaration-final" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'service-declaration-final') === true || getBidWorkspaceSavedResponse(draft, 'service-declaration-final') === 'true' ? 'checked' : ''}><span>I confirm this service bid is complete, accurate, and authorized.</span></label>
            <label class="bid-response-check"><input type="checkbox" data-bid-response="service-declaration-conflict" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'service-declaration-conflict') === true || getBidWorkspaceSavedResponse(draft, 'service-declaration-conflict') === 'true' ? 'checked' : ''}><span>I declare no conflict of interest.</span></label>
            <label class="bid-response-check"><input type="checkbox" data-bid-response="service-declaration-anti-corruption" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'service-declaration-anti-corruption') === true || getBidWorkspaceSavedResponse(draft, 'service-declaration-anti-corruption') === 'true' ? 'checked' : ''}><span>I accept anti-corruption declarations.</span></label>
        </div>
    `;
}

function isConsultancyBidRequired(valueOrRow) {
    if (valueOrRow === true) return true;
    if (valueOrRow === false || valueOrRow === null || valueOrRow === undefined) return false;
    if (typeof valueOrRow === 'string') {
        const raw = valueOrRow.trim().toLowerCase();
        if (!raw || /not required|optional|not mandatory|not applicable/.test(raw)) return false;
        return ['true', 'yes', 'required', 'mandatory', 'required if configured'].includes(raw);
    }
    if (typeof valueOrRow !== 'object') return false;
    return [
        'mandatory',
        'mandatoryActivity',
        'required',
        'requiresUpload',
        'cvRequired',
        'requiredEvidence',
        'similarAssignmentsEvidenceRequired',
        'evidenceRequired',
        'professionalRegistrationRequired',
        'certificateRequired'
    ].some(field => isConsultancyBidRequired(valueOrRow[field]));
}

function getConsultancyRequiredAttr(required = false) {
    return required ? ' data-bid-workflow-required-response="true"' : '';
}

function getConsultancySubmissionType(draft = {}, tender = {}) {
    const saved = getBidWorkspaceSavedResponse(draft, 'consultancy-submission-type');
    return String(saved || tender.requirements?.fields?.consultancySubmissionType || '').trim();
}

function isConsultancyFirmSubmission(type = '') {
    return /firm|company|organization|organisation/i.test(String(type || ''));
}

function isConsultancyIndividualSubmission(type = '') {
    return /individual|sole/i.test(String(type || ''));
}

function isConsultancyCvRequirement(requirement = {}) {
    const text = [
        getBidWorkspaceRequirementSearchText(requirement),
        getBidWorkspaceRequirementTitle(requirement, ''),
        requirement.documentTitle,
        requirement.documentName,
        requirement.name,
        requirement.title,
        requirement.description
    ].filter(Boolean).join(' ');
    return /(^|\b)(cv|cvs|curriculum vitae|resume|expert cv|consultant cv|key expert cv)(\b|$)/i.test(text);
}

function getConsultancyRequirementRows(tender = {}) {
    const fields = tender.requirements?.fields || {};
    return {
        objectiveRows: normalizeBidWorkspaceArray(fields.consultancySpecificObjectives),
        activityRows: normalizeBidWorkspaceArray(fields.consultancyAssignmentActivities),
        deliverableRows: normalizeBidWorkspaceArray(fields.consultancyDeliverables),
        reportingRows: normalizeBidWorkspaceArray(fields.consultancyReportingRequirements),
        individualRows: normalizeBidWorkspaceArray(fields.consultancyIndividualQualifications),
        firmRows: normalizeBidWorkspaceArray(fields.consultancyFirmExperience),
        expertRows: normalizeBidWorkspaceArray(fields.consultancyKeyExperts),
        supportingRows: normalizeBidWorkspaceArray(fields.consultancySupportingDocuments),
        reportingStructureRows: normalizeBidWorkspaceArray(fields.consultancyReportingStructure),
        coordinationRows: normalizeBidWorkspaceArray(fields.consultancyCoordinationArrangements),
        administrativeRows: normalizeBidWorkspaceArray(fields.consultancyAdministrativeArrangements),
        licenseRows: getBidWorkspaceRegulatoryLicenseRows(tender),
        financialCapacityRows: getBidWorkspaceFinancialCapacityRows(tender)
    };
}

function isConsultancyDynamicRequirementRequired(dynamicRequirements = [], pattern = /./) {
    return dynamicRequirements.some(requirement => (
        requirement.mandatory
        && pattern.test(getBidWorkspaceRequirementSearchText(requirement))
    ));
}

function isConsultancyFinancialProposalRequired(tender = {}) {
    return getBidWorkspaceRawTenderRequirements(tender).some(requirement => (
        requirement.mandatory
        && /financial proposal|financial offer|commercial offer|priced|pricing schedule|signed financial/.test(getBidWorkspaceRequirementSearchText(requirement))
    ));
}

function isConsultancyPricingConfigured(tender = {}) {
    const fields = tender.requirements?.fields || {};
    return [
        tender.commercialItems,
        tender.boqItems,
        fields.consultancyPricingRows,
        fields.financialProposalRows,
        fields.quantityScheduleRows,
        fields.boqRows,
        fields.lumpSumPricingRows
    ].some(value => normalizeBidWorkspaceArray(value).length);
}

function renderConsultancyBidTorWorkbook(tender = {}, draft = {}, dynamicRequirements = []) {
    const fields = tender.requirements?.fields || {};
    const {
        objectiveRows,
        activityRows,
        deliverableRows,
        reportingRows,
        individualRows,
        firmRows,
        expertRows,
        supportingRows,
        reportingStructureRows,
        coordinationRows,
        administrativeRows,
        licenseRows,
        financialCapacityRows
    } = getConsultancyRequirementRows(tender);
    const torRequired = isConsultancyDynamicRequirementRequired(dynamicRequirements, /tor|terms of reference|understanding|technical proposal/);
    const methodologyRequired = isConsultancyDynamicRequirementRequired(dynamicRequirements, /methodology|technical approach|approach/);
    const workPlanRequired = isConsultancyDynamicRequirementRequired(dynamicRequirements, /work plan|timeline|gantt|mobilization|mobilisation/);
    const technicalUploadRequired = isConsultancyDynamicRequirementRequired(dynamicRequirements, /technical proposal/);
    const coordinationRequired = [...reportingStructureRows, ...coordinationRows, ...administrativeRows].some(isConsultancyBidRequired);
    const qualificationRequired = [...individualRows, ...firmRows, ...expertRows].some(isConsultancyBidRequired);
    const selectedSubmissionType = getConsultancySubmissionType(draft, tender);
    const firmSubmission = isConsultancyFirmSubmission(selectedSubmissionType);
    const individualSubmission = isConsultancyIndividualSubmission(selectedSubmissionType);
    const expertCvRequired = expertRows.some(item => isConsultancyBidRequired(item) || isConsultancyBidRequired(item.cvRequired));
    const individualCvRequired = individualRows.some(row => isConsultancyBidRequired(row.cvRequired));
    const cvEvidenceRequired = expertCvRequired || individualCvRequired || dynamicRequirements.some(requirement => requirement.mandatory && isConsultancyCvRequirement(requirement));
    const hasStructuredCvControls = expertRows.length > 0 || individualRows.some(row => isConsultancyBidRequired(row.cvRequired));
    const visibleSupportingRows = supportingRows.filter(row => !(hasStructuredCvControls && isConsultancyCvRequirement(row)));
    const technicalUploadRequirements = getBidWorkspaceTechnicalUploadRequirements(dynamicRequirements, { id: 'consultancy' })
        .filter(requirement => !(hasStructuredCvControls && isConsultancyCvRequirement(requirement)));
    const residualDynamicRequirements = dynamicRequirements.filter(requirement => (
        isBidWorkspaceResponseRequirement(requirement)
        && !isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement)
        && !isBidWorkspaceLicenseDocumentRequirement(requirement)
        && !technicalUploadRequirements.some(uploadRequirement => uploadRequirement.id === requirement.id)
        && !(hasStructuredCvControls && isConsultancyCvRequirement(requirement))
    ));
    return `
        <div class="consultancy-tor-workbook">
            <section class="bid-dynamic-group consultancy-tor-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Terms of reference understanding</h3>
                        <p>${escapeBidWorkspaceHtml(getBidWorkspaceRawValueSummary(fields.consultancyGeneralObjective || fields.consultancyEntityBackground || tender.description) || 'Respond to the buyer terms of reference where the tender asks for it.')}</p>
                    </div>
                    <span class="badge ${torRequired || methodologyRequired || workPlanRequired || technicalUploadRequired ? 'badge-warning' : 'badge-info'}">${torRequired || methodologyRequired || workPlanRequired || technicalUploadRequired ? 'Tender-required' : 'Optional response'}</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Submission Type</label><select class="form-input" data-bid-response="consultancy-submission-type"${getConsultancyRequiredAttr(cvEvidenceRequired)}><option value="">Select</option>${['Individual Consultant / Sole Proprietor', 'Consulting Firm'].map(option => `<option ${selectedSubmissionType === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">TOR Acknowledgement</label><select class="form-input" data-bid-response="consultancy-tor-acknowledgement"${getConsultancyRequiredAttr(torRequired)}><option value="">Select</option>${['Read and understood', 'Need clarification'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'consultancy-tor-acknowledgement') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group wide"><label class="form-label">Understanding of Assignment</label><textarea class="form-input works-rich-textarea" rows="5" data-bid-response="consultancy-tor-understanding"${getConsultancyRequiredAttr(torRequired)}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-tor-understanding'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Methodology and Approach</label><textarea class="form-input works-rich-textarea" rows="5" data-bid-response="consultancy-tor-methodology"${getConsultancyRequiredAttr(methodologyRequired)}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-tor-methodology'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Work Plan and Assignment Boundaries</label><textarea class="form-input" rows="3" data-bid-response="consultancy-tor-workplan"${getConsultancyRequiredAttr(workPlanRequired)}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-tor-workplan') || getBidWorkspaceRawValueSummary(fields.consultancyAssignmentBoundaries))}</textarea></div>
                    <div class="form-group wide">${renderBidWorkspaceUploadControl('consultancy-technical-proposal-upload', draft, 'Upload technical proposal', '.pdf,.doc,.docx', technicalUploadRequired)}</div>
                    <div class="form-group wide"><label class="form-label">Clarifications / Exceptions</label><textarea class="form-input" rows="2" data-bid-response="consultancy-clarifications">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-clarifications'))}</textarea></div>
                </div>
            </section>
            ${objectiveRows.length || activityRows.length ? `<section class="bid-dynamic-group consultancy-tor-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Objectives and activities response</h3><p>Map each TOR objective or activity to the proposed response, assumptions, and evidence.</p></div>
                    <span class="badge ${[...objectiveRows, ...activityRows].some(isConsultancyBidRequired) ? 'badge-warning' : 'badge-info'}">${objectiveRows.length + activityRows.length} item${objectiveRows.length + activityRows.length === 1 ? '' : 's'}</span>
                </div>
                <div class="data-table">
                    <table>
                        <thead><tr><th>TOR Item</th><th>Supplier Response</th><th>Evidence / Assumption</th></tr></thead>
                        <tbody>
                            ${[...objectiveRows, ...activityRows].map((item, index) => {
                                const baseId = `consultancy-objective-${index}`;
                                const required = isConsultancyBidRequired(item);
                                const title = typeof item === 'string' ? item : (item.objectiveTitle || item.activityTitle || item.objective || item.activity || item.description || `TOR item ${index + 1}`);
                                return `
                                    <tr>
                                        <td>${escapeBidWorkspaceHtml(title)}</td>
                                        <td><textarea class="form-input" rows="2" data-bid-response="${baseId}-response"${getConsultancyRequiredAttr(required)}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-response`))}</textarea></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-evidence" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-evidence`))}"></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>` : ''}
            ${deliverableRows.length || reportingRows.length ? `<section class="bid-dynamic-group consultancy-tor-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Deliverables and reporting schedule</h3><p>${escapeBidWorkspaceHtml(getBidWorkspaceRawValueSummary(fields.consultancyReportingRequirements) || 'Propose dates, owners, acceptance evidence, and reporting arrangements.')}</p></div>
                    <span class="badge ${[...deliverableRows, ...reportingRows].some(isConsultancyBidRequired) ? 'badge-warning' : 'badge-info'}">${deliverableRows.length} deliverable${deliverableRows.length === 1 ? '' : 's'} / ${reportingRows.length} report${reportingRows.length === 1 ? '' : 's'}</span>
                </div>
                <div class="data-table">
                    <table>
                        <thead><tr><th>Buyer Requirement</th><th>Supplier Confirmation</th><th>Timeline / Frequency</th><th>Responsible Expert</th></tr></thead>
                        <tbody>
                            ${[...deliverableRows, ...reportingRows].map((item, index) => {
                                const baseId = `consultancy-deliverable-${index}`;
                                const required = isConsultancyBidRequired(item);
                                const title = typeof item === 'string' ? item : (item.deliverableName || item.reportType || item.description || `Deliverable ${index + 1}`);
                                return `
                                    <tr>
                                        <td>${escapeBidWorkspaceHtml(title)}</td>
                                        <td><select class="form-input" data-bid-response="${baseId}-confirmation"${getConsultancyRequiredAttr(required)}><option value="">Select</option>${['Confirmed', 'Confirmed with adjustment', 'Not confirmed', 'Needs clarification'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-confirmation`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-timeline" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-timeline`) || item.submissionTimeline || item.frequency || '')}"></td>
                                        <td><input class="form-input" data-bid-response="${baseId}-expert" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-expert`))}"></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>` : ''}
            <section class="bid-dynamic-group consultancy-tor-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Consultant profile, experts, and experience</h3><p>${escapeBidWorkspaceHtml(getBidWorkspaceRawValueSummary(fields.consultancyFirmExperience || fields.consultancyIndividualQualifications) || 'Provide profile, expert CVs, relevant experience, and qualifications where the tender requires them.')}</p></div>
                    <span class="badge ${qualificationRequired ? 'badge-warning' : 'badge-info'}">${qualificationRequired ? 'Tender-required items' : 'Optional qualification response'}</span>
                </div>
                ${!selectedSubmissionType && cvEvidenceRequired ? '<div class="bid-prequalification-note" data-consultancy-mode-prompt><strong>Select submission type</strong><span>Choose Individual Consultant or Consulting Firm to show the correct CV upload fields for this tender.</span></div>' : ''}
                <div class="service-staffing-grid" data-consultancy-mode-panel="firm" ${firmSubmission ? '' : 'hidden'}>
                    ${expertRows.map((item, index) => {
                        const baseId = `consultancy-expert-${index}`;
                        const required = isConsultancyBidRequired(item);
                        const cvRequired = required || isConsultancyBidRequired(item.cvRequired);
                        const title = typeof item === 'string' ? item : (item.positionTitle || item.position || item.role || item.expertRole || `Expert ${index + 1}`);
                        return `
                            <article class="service-staff-card">
                                <div class="works-person-avatar">${escapeBidWorkspaceHtml(String(title).slice(0, 1).toUpperCase())}</div>
                                <div>
                                    <span class="section-kicker">${escapeBidWorkspaceHtml(title)}</span>
                                    <div class="form-grid two">
                                        <div class="form-group"><label class="form-label">Expert Name</label><input class="form-input" data-bid-response="${baseId}-name"${getConsultancyRequiredAttr(required)} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-name`))}"></div>
                                        <div class="form-group"><label class="form-label">Role / Level of Effort</label><input class="form-input" data-bid-response="${baseId}-effort"${getConsultancyRequiredAttr(required)} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-effort`) || item.quantityRequired || '')}"></div>
                                        <div class="form-group"><label class="form-label">Relevant Experience</label><input class="form-input" data-bid-response="${baseId}-experience" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-experience`))}"></div>
                                        <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-cv`, draft, 'Upload CV', '.pdf,.doc,.docx', cvRequired)}</div>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('') || '<div class="scope-empty">No key expert rows were configured. Add profile or CV evidence only if the tender requested it elsewhere.</div>'}
                </div>
                <div class="form-grid two" style="margin-top: 14px;">
                    <div class="form-group wide"><label class="form-label">Professional / Firm Summary</label><textarea class="form-input" rows="3" data-bid-response="consultancy-profile-summary"${getConsultancyRequiredAttr(qualificationRequired && !expertRows.length)}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-profile-summary'))}</textarea></div>
                    ${individualRows.some(row => isConsultancyBidRequired(row.cvRequired)) ? `<div class="form-group" data-consultancy-mode-panel="individual" ${individualSubmission ? '' : 'hidden'}>${renderBidWorkspaceUploadControl('consultancy-individual-cv', draft, 'Individual consultant CV', '.pdf,.doc,.docx', individualCvRequired)}</div>` : ''}
                    ${[...individualRows, ...firmRows].some(row => isConsultancyBidRequired(row.similarAssignmentsEvidenceRequired || row.requiredEvidence)) ? `<div class="form-group">${renderBidWorkspaceUploadControl('consultancy-similar-assignment-evidence', draft, 'Similar assignment evidence', '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', true)}</div>` : ''}
                </div>
            </section>
            ${financialCapacityRows.length ? renderBidWorkspaceFinancialCapacityMatrix(tender, draft, 'consultancy-financial-capacity') : ''}
            ${(reportingStructureRows.length || coordinationRows.length || administrativeRows.length) ? `<section class="bid-dynamic-group consultancy-tor-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Responsibilities and coordination</h3><p>${escapeBidWorkspaceHtml(getBidWorkspaceRawValueSummary(fields.consultancyCoordinationArrangements || fields.consultancyAdministrativeArrangements) || 'Confirm responsibilities, reporting lines, meetings, and client support needs.')}</p></div>
                    <span class="badge ${coordinationRequired ? 'badge-warning' : 'badge-info'}">${coordinationRequired ? 'Tender-required' : 'Optional response'}</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group wide"><label class="form-label">Consultant Responsibilities Response</label><textarea class="form-input" rows="3" data-bid-response="consultancy-responsibilities"${getConsultancyRequiredAttr(coordinationRequired)}>${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-responsibilities') || getBidWorkspaceRawValueSummary(fields.consultancyConsultantResponsibilities))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Procuring Entity Dependencies</label><textarea class="form-input" rows="2" data-bid-response="consultancy-buyer-dependencies">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-buyer-dependencies') || getBidWorkspaceRawValueSummary(fields.consultancyClientResponsibilities))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Reporting Structure</label><textarea class="form-input" rows="2" data-bid-response="consultancy-reporting-structure">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-reporting-structure') || getBidWorkspaceRawValueSummary(fields.consultancyReportingStructure))}</textarea></div>
                </div>
            </section>` : ''}
            ${visibleSupportingRows.length ? `<section class="bid-dynamic-group consultancy-tor-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Buyer-requested supporting documents</h3><p>Upload only the supporting documents requested in this tender.</p></div>
                    <span class="badge ${visibleSupportingRows.some(isConsultancyBidRequired) ? 'badge-warning' : 'badge-info'}">${visibleSupportingRows.length} document${visibleSupportingRows.length === 1 ? '' : 's'}</span>
                </div>
                <div class="form-grid two">
                    ${visibleSupportingRows.map((item, index) => {
                        const required = isConsultancyBidRequired(item);
                        const label = typeof item === 'string' ? item : (item.documentName || item.documentTitle || item.title || `Supporting document ${index + 1}`);
                        return `<div class="form-group">${renderBidWorkspaceUploadControl(`consultancy-supporting-${index}`, draft, label, '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', required)}</div>`;
                    }).join('')}
                </div>
            </section>` : ''}
            ${renderBidWorkspaceTechnicalUploadSection(technicalUploadRequirements, draft, 'Other technical proposal uploads', 'Upload any extra technical evidence that this tender explicitly requested.')}
            ${residualDynamicRequirements.length ? renderBidWorkspaceDynamicResponses(residualDynamicRequirements, draft, ['Supplier response', 'Supporting note'], tender, { id: 'consultancy' }) : ''}
        </div>
    `;
}

function renderConsultancyBidPricingRows(items = [], draft = {}, pricingRequired = false) {
    if (!items.length) return '<tr><td colspan="8">No consultancy pricing schedule configured.</td></tr>';
    return items.map((item, index) => {
        const baseId = `consultancy-price-${index}`;
        const qty = parseBidWorkspaceNumber(item.qty || item.quantity || item.duration) || 1;
        const rate = getBidWorkspaceSavedResponse(draft, `${baseId}-rate`) || Math.round(parseBidWorkspaceNumber(item.rate || item.unitPrice || item.amount) * 0.98);
        const required = pricingRequired || isConsultancyBidRequired(item);
        return `
            <tr>
                <td>${escapeBidWorkspaceHtml(item.item || `${index + 1}.1`)}</td>
                <td><strong>${escapeBidWorkspaceHtml(item.description || item.deliverableName || item.serviceTask || `Consultancy line ${index + 1}`)}</strong><small>${escapeBidWorkspaceHtml(item.expertRole || item.category || 'Professional fees / reimbursables')}</small></td>
                <td><input class="form-input" type="number" min="0" step="0.5" data-bid-line-qty data-bid-response="${baseId}-person-days"${getConsultancyRequiredAttr(required)} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-person-days`) || qty)}"></td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" data-bid-rate data-bid-response="${baseId}-rate"${getConsultancyRequiredAttr(required)} value="${escapeBidWorkspaceHtml(rate)}"></td>
                <td><input class="form-input" type="number" min="0" step="1000" data-bid-line-extra-cost data-bid-response="${baseId}-reimbursables" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-reimbursables`))}"></td>
                <td><input class="form-input" data-bid-response="${baseId}-tax" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-tax`))}" placeholder="Tax / VAT"></td>
                <td><input class="form-input" data-bid-response="${baseId}-assumption" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-assumption`))}" placeholder="Assumption"></td>
                <td data-bid-line-amount>${formatBidWorkspaceMoney((qty * parseBidWorkspaceNumber(rate)) + parseBidWorkspaceNumber(getBidWorkspaceSavedResponse(draft, `${baseId}-reimbursables`)))}</td>
            </tr>
        `;
    }).join('');
}

function renderConsultancyEnvelopeNotice(tender = {}) {
    const method = String(tender.requirements?.fields?.consultancySelectionMethod || tender.selectionMethod || '').trim();
    const locked = /qcbs|quality|technical/i.test(method) || !method;
    return `
        <section class="bid-dynamic-group consultancy-envelope-notice">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Technical and financial envelopes</h3>
                    <p>${locked ? 'Technical proposal can be opened first. The financial proposal is submitted as a sealed separate step and remains locked until technical evaluation is completed.' : 'Technical and financial proposal steps remain separated in the bid package for evaluation control.'}</p>
                </div>
                <span class="badge ${locked ? 'badge-warning' : 'badge-info'}">${locked ? 'Financial locked' : 'Separate steps'}</span>
            </div>
        </section>
    `;
}

function renderConsultancyBidCommercialTerms(draft = {}, tender = {}, pricingRequired = false) {
    const financialUploadRequired = isConsultancyFinancialProposalRequired(tender);
    const commercialRequired = pricingRequired || financialUploadRequired;
    return `
        <section class="bid-dynamic-group">
            <div class="bid-dynamic-group-heading">
                <div><h3>Consultancy commercial terms</h3><p>Confirm fee basis, expenses, taxes, currency, validity, and signed financial proposal step.</p></div>
                <span class="badge ${commercialRequired ? 'badge-warning' : 'badge-info'}">${commercialRequired ? 'Tender-required pricing' : 'Optional commercial terms'}</span>
            </div>
            <div class="form-grid two">
                <div class="form-group"><label class="form-label">Fee Basis</label><select class="form-input" data-bid-response="consultancy-commercial-fee-basis"${getConsultancyRequiredAttr(commercialRequired)}><option value="">Select</option>${['Time based', 'Lump sum', 'Milestone based', 'Retainer'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'consultancy-commercial-fee-basis') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Price Validity (days)</label><input class="form-input" type="number" min="1" data-bid-response="consultancy-commercial-validity"${getConsultancyRequiredAttr(commercialRequired)} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-commercial-validity') || 90)}"></div>
                <div class="form-group"><label class="form-label">Currency</label><select class="form-input" data-bid-response="consultancy-commercial-currency"${getConsultancyRequiredAttr(commercialRequired)}>${['TZS', 'USD', 'EUR', 'GBP'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'consultancy-commercial-currency') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group">${renderBidWorkspaceUploadControl('consultancy-financial-proposal-upload', draft, 'Signed financial proposal document', '.pdf,.doc,.docx', financialUploadRequired)}</div>
                <div class="form-group wide"><label class="form-label">Financial Proposal Assumptions</label><textarea class="form-input" rows="2" data-bid-response="consultancy-commercial-assumptions">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'consultancy-commercial-assumptions'))}</textarea></div>
                <label class="bid-response-check"><input type="checkbox" data-bid-response="consultancy-commercial-tax-confirm"${getConsultancyRequiredAttr(commercialRequired)} ${getBidWorkspaceSavedResponse(draft, 'consultancy-commercial-tax-confirm') === true || getBidWorkspaceSavedResponse(draft, 'consultancy-commercial-tax-confirm') === 'true' ? 'checked' : ''}><span>I confirm taxes, reimbursables, and professional fees are reflected in the financial offer.</span></label>
            </div>
        </section>
    `;
}

function renderConsultancyTechnicalProposalStep(tender = {}, draft = {}, dynamicRequirements = [], stepNumber = 2) {
    const rows = getConsultancyRequirementRows(tender);
    const requiredTechnicalCount = [
        ...rows.objectiveRows,
        ...rows.activityRows,
        ...rows.deliverableRows,
        ...rows.reportingRows,
        ...rows.individualRows,
        ...rows.firmRows,
        ...rows.expertRows,
        ...rows.supportingRows,
        ...rows.licenseRows,
        ...rows.financialCapacityRows
    ].filter(isConsultancyBidRequired).length + dynamicRequirements.filter(requirement => (
        requirement.mandatory && !isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement)
    )).length;
    return `
        <section class="journey-panel" id="bid-step-${stepNumber}">
            <div class="panel-heading">
                <div><span class="section-kicker">Step ${stepNumber}</span><h2>Technical Proposal</h2></div>
                <span class="badge ${requiredTechnicalCount ? 'badge-warning' : 'badge-info'}">${requiredTechnicalCount ? `${requiredTechnicalCount} required item${requiredTechnicalCount === 1 ? '' : 's'}` : 'Tender-driven'}</span>
            </div>
            <div class="bid-step-intro">
                <strong>Technical envelope</strong>
                <span>Respond to the TOR, methodology, qualifications, evidence, and supporting requirements configured by this tender. Optional fields do not block submission.</span>
            </div>
            ${renderBidWorkspaceClarificationPrompt('Need clarification about methodology, work plan, team CVs, or required evidence?', 'Technical', 'Question about consultancy technical proposal requirements')}
            ${renderConsultancyEnvelopeNotice(tender)}
            ${renderConsultancyBidTorWorkbook(tender, draft, dynamicRequirements)}
        </section>
    `;
}

function renderConsultancyFinancialProposalStep(tender = {}, draft = {}, commercialItems = [], bidAmount = 0, stepNumber = 3) {
    const pricingRequired = isConsultancyPricingConfigured(tender);
    return `
        <section class="journey-panel" id="bid-step-${stepNumber}">
            <div class="panel-heading">
                <div><span class="section-kicker">Step ${stepNumber}</span><h2>Financial Proposal</h2></div>
                <span class="badge badge-info" data-bid-total>${formatBidWorkspaceMoney(bidAmount)}</span>
            </div>
            <div class="bid-step-intro">
                <strong>Separate financial envelope</strong>
                <span>Complete fees, reimbursables, taxes, currency, validity, and financial proposal upload only as required by this tender.</span>
            </div>
            ${renderConsultancyEnvelopeNotice(tender)}
            <div class="data-table">
                <table>
                    <thead><tr><th>Code</th><th>Consultancy Line</th><th>Person Days</th><th>Daily Rate / Fee</th><th>Reimbursables</th><th>Tax</th><th>Assumption</th><th>Amount</th></tr></thead>
                    <tbody data-bid-commercial-body>${renderConsultancyBidPricingRows(commercialItems, draft, pricingRequired)}</tbody>
                </table>
            </div>
            ${renderConsultancyBidCommercialTerms(draft, tender, pricingRequired)}
            ${renderBidWorkspaceClarificationPrompt('Question about consultancy pricing, reimbursables, tax, or payment terms?', 'Financial', 'Question about consultancy financial proposal')}
        </section>
    `;
}

function renderConsultancyReviewSubmitStep(tender = {}, profile = {}, draft = {}, context = {}, stepNumber = 4) {
    const dynamicRequirements = context.dynamicRequirements || [];
    const commercialItems = context.commercialItems || [];
    const technicalRequiredCount = dynamicRequirements.filter(requirement => (
        requirement.mandatory && !isBidWorkspaceFinancialOrCommercialUploadRequirement(requirement)
    )).length;
    const financialRequired = isConsultancyPricingConfigured(tender) || isConsultancyFinancialProposalRequired(tender);
    return `
        <section class="journey-panel" id="bid-step-${stepNumber}">
            <div class="panel-heading">
                <div><span class="section-kicker">Step ${stepNumber}</span><h2>Review and Submit</h2></div>
                <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(context.bidAmount || 0)}</span>
            </div>
            <div class="record-summary submission-readiness-dashboard">
                <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                <div><span>Technical proposal</span><strong>${technicalRequiredCount ? `${technicalRequiredCount} required tender item${technicalRequiredCount === 1 ? '' : 's'}` : 'Optional fields only'}</strong></div>
                <div><span>Financial proposal</span><strong>${financialRequired ? 'Required by tender' : 'Optional unless priced'}</strong></div>
                <div><span>Pricing lines</span><strong>${commercialItems.length} line${commercialItems.length === 1 ? '' : 's'}</strong></div>
                <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                <div class="bid-value-summary"><span>Bid value</span><strong>${formatBidWorkspaceMoney(context.bidAmount || 0)}</strong></div>
                <div class="submission-state"><span>Submission status</span><strong>Ready for final review</strong></div>
            </div>
            <div class="bid-step-intro">
                <strong>Submission readiness dashboard</strong>
                <span>Review required technical and financial responses, confirm the declaration, and submit the consultancy bid package.</span>
            </div>
            ${renderBidWorkspaceContractTerms(tender, profile, draft)}
            ${renderBidWorkspaceCompletenessChecklist(tender, profile, draft, context)}
            <section class="bid-response-review" data-bid-response-review>
                ${renderBidWorkspaceResponseReviewPlaceholder()}
            </section>
            <div class="confirm-action" data-confirm-control>
                <input type="checkbox" class="confirm-action-input" data-bid-declaration>
                <button type="button" class="confirm-action-button" data-confirm-toggle aria-pressed="false">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <span>Confirm consultancy declaration</span>
                </button>
                <p class="confirm-action-note" data-confirm-note>Confirm that this technical and financial proposal is complete, accurate, and authorized for submission.</p>
            </div>
            <div class="submit-strip">
                <div>
                    <strong>Ready to seal</strong>
                    <span>The system will validate only tender-required responses, seal the consultancy proposal, and store a receipt.</span>
                </div>
                <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
            </div>
        </section>
    `;
}

function renderBidWorkspaceCompletenessChecklist(tender = {}, profile = {}, draft = {}, context = {}) {
    const typeId = profile.id || getBidWorkspaceTypeId(tender);
    const stepOneCount = context.stepOneRequirements?.length || 0;
    const dynamicCount = context.dynamicRequirements?.filter(isBidWorkspaceResponseRequirement).length || 0;
    const commercialCount = context.commercialItems?.length || 0;
    const checklist = [
        ['Eligibility documents', stepOneCount ? `${stepOneCount} gate item${stepOneCount === 1 ? '' : 's'} reviewed` : 'No eligibility gate items configured'],
        ['Technical response', dynamicCount ? `${dynamicCount} response item${dynamicCount === 1 ? '' : 's'} plus category workbook` : 'Structured technical workbook reviewed'],
        ['Financial offer', commercialCount ? `${commercialCount} pricing line${commercialCount === 1 ? '' : 's'} reviewed` : 'No pricing lines configured'],
        ['Required supporting evidence', (tender.evaluation?.criteria || []).length ? `${tender.evaluation.criteria.length} evidence area${tender.evaluation.criteria.length === 1 ? '' : 's'} checked` : 'No supporting evidence areas published'],
        ['Financial capacity', getBidWorkspaceFinancialCapacityRows(tender).length ? 'Capacity matrix completed' : 'No financial capacity matrix configured'],
        ['Award-stage terms', getBidWorkspaceContractClauses(tender).length ? 'Contracting terms noted as deferred' : 'No contract clauses configured'],
        ['Samples / site / category extras', typeId === 'goods'
            ? (isGoodsBidSamplesRequired(tender) ? `${getGoodsBidSampleRows(tender).length} sample response${getGoodsBidSampleRows(tender).length === 1 ? '' : 's'} checked` : 'Samples not required')
            : typeId === 'works'
                ? 'Site visit and drawings response checked'
                : typeId === 'services'
                    ? 'Service category, SLA, staffing, and reporting checked'
                    : 'Consultancy TOR and expert response checked']
    ];
    return `
        <section class="bid-dynamic-group bid-validation-checklist">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Bid submission completeness checklist</h3>
                    <p>Confirm the bid package is complete before the declaration and sealed submission.</p>
                </div>
                <span class="badge badge-warning">${checklist.length} checks</span>
            </div>
            <div class="bid-completeness-list">
                ${checklist.map(([label, note]) => `
                    <article class="bid-completeness-item">
                        <strong>${escapeBidWorkspaceHtml(label)}</strong>
                        <span>${escapeBidWorkspaceHtml(note)}</span>
                    </article>
                `).join('')}
            </div>
            <label class="bid-response-check">
                <input type="checkbox" data-bid-response="bid-validation-checklist-confirm" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'bid-validation-checklist-confirm') === true || getBidWorkspaceSavedResponse(draft, 'bid-validation-checklist-confirm') === 'true' ? 'checked' : ''}>
                <span>I have reviewed the completeness checklist and corrected any incomplete bid sections.</span>
            </label>
        </section>
    `;
}

function renderBiddingWorkspace() {
    const tender = getBidWorkspaceTender();
    const profile = getBidWorkspaceProfile(tender);
    const tenderId = tender.id || 'selected';
    const draft = getBidWorkspaceDraft(tenderId);
    const commercialItems = profile.id === 'consultancy' && !isConsultancyPricingConfigured(tender)
        ? []
        : getBidWorkspaceCommercialItems(tender, profile);
    const bidAmount = getBidWorkspaceAmount(commercialItems.map(item => ({ ...item, rate: Math.round(parseBidWorkspaceNumber(item.rate || item.unitPrice || item.amount) * 0.98) })));
    const documents = tender.documents?.length ? tender.documents : profile.documentLabels || ['Tender document'];
    const requirementSet = getBidWorkspaceRequirementSet(tender, profile);
    const mandatoryCount = requirementSet.mandatory.length;
    const optionalCount = requirementSet.optional.length;
    const stepOneRequirements = getBidWorkspaceStepOneRequirements(requirementSet);
    const stepOneRequirementIds = new Set(stepOneRequirements.map(requirement => requirement.id));
    const stepOneRequirementKeys = new Set(stepOneRequirements.map(getBidWorkspaceRequirementDedupeKey));
    const laterRequirements = [...requirementSet.mandatory, ...requirementSet.optional]
        .filter(requirement => !stepOneRequirementIds.has(requirement.id));
    const dynamicRequirements = getBidWorkspaceCompleteDynamicRequirements(tender, laterRequirements)
        .filter(requirement => (
            !stepOneRequirementIds.has(requirement.id)
            && !stepOneRequirementKeys.has(getBidWorkspaceRequirementDedupeKey(requirement))
        ));
    const technicalUploadRequirements = getBidWorkspaceTechnicalUploadRequirements(dynamicRequirements, profile);
    const gateRequirementCount = stepOneRequirements.length;
    const mandatoryGateCount = stepOneRequirements.filter(requirement => requirement.mandatory).length;
    const deferredMandatoryCount = dynamicRequirements.filter(isBidWorkspaceResponseRequirement).length;
    const requiredLicenseCount = stepOneRequirements.filter(requirement => getBidWorkspaceRequirementPriority(requirement) === 0 && requirement.mandatory).length;
    const responseFields = profile.responseFields || ['Technical response', 'Delivery approach'];
    const goodsFlow = profile.id === 'goods';
    const worksFlow = profile.id === 'works';
    const serviceFlow = profile.id === 'services';
    const consultancyFlow = profile.id === 'consultancy';
    const hasGoodsSamples = goodsFlow && isGoodsBidSamplesRequired(tender);
    const goodsProductSpecStats = goodsFlow
        ? getBidWorkspaceTendererCsvTemplateStats(tender)
        : { hasBuyerSpecificationRows: false, rowCount: 0 };
    const steps = goodsFlow
        ? [
            ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
            ['02', 'Technical Response', 'Fill the buyer product specification table'],
            ['03', 'Financial Offer', 'Quantity schedule, delivery, and commercial terms'],
            ...(hasGoodsSamples ? [['04', 'Samples', 'Sample dispatch and delivery evidence']] : []),
            [hasGoodsSamples ? '05' : '04', 'Review Submission', 'Check missing responses before declaration'],
            [hasGoodsSamples ? '06' : '05', 'Declaration and Submit', 'Digital declaration and sealed submission']
        ]
        : worksFlow
            ? [
                ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
                ['02', 'Technical Capacity', 'Experience, personnel, equipment, finance, and HSE'],
                ['03', 'Technical Proposal', 'Methodology, schedule, drawings, and site response'],
                ['04', 'Financial Proposal', 'BOQ pricing, cost breakdown, and commercial terms'],
                ['05', 'Review Submission', 'Check missing contractor response items'],
                ['06', 'Declaration and Submission', 'Digital signing and final submission']
            ]
            : serviceFlow
                ? [
                    ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
                    ['02', 'Methodology', 'Service understanding, workflow, QA, and risk approach'],
                    ['03', 'Delivery Plan', 'Schedule, locations, SLA timers, and milestones'],
                    ['04', 'Staffing and Capacity', 'People, equipment, finance, and service capability'],
                    ['05', 'SLA and Reporting', 'Performance metrics, reporting, ESG, and documents'],
                    ['06', 'Pricing', 'Service schedule, SLA-linked pricing, and commercial terms'],
                    ['07', 'Review Submission', 'Review, declare, and submit service bid']
                ]
                : consultancyFlow
                    ? [
                        ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
                        ['02', 'Technical Proposal', 'TOR response, methodology, qualifications, evidence, and documents'],
                        ['03', 'Financial Proposal', 'Fees, reimbursables, taxes, validity, and payment terms'],
                        ['04', 'Review and Submit', 'Check tender-required items and submit the sealed proposal']
                    ]
        : [
        ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
        ['02', 'Dynamic Responses', 'Answer optional and technical tender requirements'],
        ['03', 'Financial Offer', `${profile.commercialName} rates and commercial schedule`],
        ['04', 'Review Submission', 'Review, declare, and submit sealed bid'],
        ['05', 'Receipt', 'Bid hash and post-submission actions']
    ];

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>My Bids</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${escapeBidWorkspaceHtml(tender.title)}</div>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="tender-detail">Tender Detail</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page tender-wizard-page bid-flow-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-info">${escapeBidWorkspaceHtml(tender.type)} bid</span>
                            <h1>Bid Submission Workspace</h1>
                            <p>${escapeBidWorkspaceHtml(tender.title)} / ${escapeBidWorkspaceHtml(tender.organization)}. The wizard is generated from the tender requirements, mandatory evidence, supporting evidence requests, and commercial schedule.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-bid-view-tender-detail>View Tender Details</button>
                            <button class="btn btn-secondary" type="button" data-bid-ask-clarification data-clarification-category="Technical" data-clarification-context="General tender clarification before bid submission">Ask Clarification</button>
                            <button class="btn btn-secondary" type="button" data-bid-save-draft>Save Draft</button>
                            <button class="btn btn-primary" type="button" data-bid-jump-submit>Review Submission</button>
                        </div>
                    </section>

                    ${renderBidWorkspaceAssistancePanel(documents)}

                    <div class="wizard-shell" data-bid-wizard data-bid-tender-id="${escapeBidWorkspaceHtml(tenderId)}" data-bid-uses-mandatory-gate="true" data-bid-review-step-index="${consultancyFlow ? steps.length - 1 : Math.max(steps.length - 2, 0)}">
                        <nav class="wizard-step-progress bid-step-progress" aria-label="Bid submission progress">
                            ${steps.map((step, index) => `
                                <button type="button" class="wizard-progress-step ${index === 0 ? 'active' : ''}" data-bid-step-index="${index}">
                                    <strong>${escapeBidWorkspaceHtml(step[0])}</strong>
                                    <span>${escapeBidWorkspaceHtml(step[1])}</span>
                                </button>
                            `).join('')}
                        </nav>

                        <aside class="wizard-rail">
                            ${steps.map((step, index) => `
                                <a href="#bid-step-${index + 1}" class="wizard-rail-step ${index === 0 ? 'active' : ''}" data-bid-step-index="${index}">
                                    <strong>${step[0]}</strong>
                                    <span>${step[1]}</span>
                                </a>
                            `).join('')}
                        </aside>

                        <div class="wizard-workspace">
                            <section class="journey-panel active bid-mandatory-gate" id="bid-step-1">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 1</span>
                                        <h2>Eligibility and Document Requirements</h2>
                                    </div>
                                    <span class="badge ${mandatoryGateCount ? 'badge-warning' : 'badge-info'}" data-bid-gate-badge>${gateRequirementCount} gate items</span>
                                </div>
                                <div class="bid-gate-status" data-bid-gate-status>
                                    ${requiredLicenseCount
                                        ? `Upload ${requiredLicenseCount} required regulatory license${requiredLicenseCount === 1 ? '' : 's'} and complete eligibility evidence to unlock the bid workflow.`
                                        : mandatoryGateCount
                                            ? `Complete ${mandatoryGateCount} mandatory eligibility item${mandatoryGateCount === 1 ? '' : 's'} to unlock the bid workflow.`
                                            : 'No mandatory eligibility upload is required for this tender. Optional documents can be attached here before continuing.'}
                                </div>
                                ${renderBidWorkspaceMandatoryGate(stepOneRequirements, draft, tender)}
                            </section>

                            ${goodsFlow ? `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Technical Response</h2></div>
                                    <span class="badge badge-warning">${goodsProductSpecStats.rowCount} product row${goodsProductSpecStats.rowCount === 1 ? '' : 's'}</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>${goodsProductSpecStats.hasBuyerSpecificationRows ? `Complete the buyer's specification table` : 'Comment on each requested goods item'}</strong>
                                    <span>${goodsProductSpecStats.hasBuyerSpecificationRows ? `Fill in your offered product specification against the buyer's required format. Do not change buyer columns, required rows, or the template structure.` : 'The buyer did not add item-specific specifications, so each quantity schedule item is shown for your offered specification, comments, and supporting evidence.'}</span>
                                </div>
                                ${renderBidWorkspaceTendererCsvTemplatePanel(tender)}
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about product specifications?', 'Technical', 'Question about goods product specifications or compliance')}
                                
                                ${renderGoodsBidProductSpecificationResponse(tender, draft)}
                                ${renderBidWorkspaceTechnicalUploadSection(technicalUploadRequirements, draft, 'Technical requirement uploads', 'Upload goods-related technical evidence requested by the buyer, excluding licenses, administrative submission documents, and financial capacity documents.')}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>Quantity Schedule / Financial Offer</h2></div>
                                    <span class="badge badge-info" data-bid-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Editable supplier pricing table</strong>
                                    <span>For each requested item, confirm whether you bid and complete the commercial price, tax, and discount details.</span>
                                </div>
                                ${renderBidWorkspaceFinancialCapacityMatrix(tender, draft, 'goods-financial-capacity')}
                                <div class="data-table goods-offer-table">
                                    <table>
                                        <thead><tr><th>Item</th><th>Requested Item</th><th>Qty</th><th>Unit</th><th>Status</th><th>Unit Price</th><th>Tax Included?</th><th>Discount</th><th>Total</th></tr></thead>
                                        <tbody data-bid-commercial-body>${renderGoodsBidFinancialRows(tender, draft)}</tbody>
                                    </table>
                                </div>
                                <section class="bid-dynamic-group">
                                    <div class="bid-dynamic-group-heading">
                                        <div>
                                            <h3>Delivery and commercial terms</h3>
                                            <p>Confirm validity, currency, delivery terms, and payment assumptions for this goods offer.</p>
                                        </div>
                                        <span class="badge badge-warning">Response required</span>
                                    </div>
                                    ${renderGoodsBidCommercialTerms(draft)}
                                </section>
                                ${renderBidWorkspaceClarificationPrompt('Question about pricing lines?', 'Commercial Schedule', 'Question about goods quantity schedule, unit prices, tax, discount, or commercial terms')}
                            </section>

                            ${hasGoodsSamples ? `
                                <section class="journey-panel" id="bid-step-4">
                                    <div class="panel-heading">
                                        <div><span class="section-kicker">Step 4</span><h2>Sample Submission Response</h2></div>
                                        <span class="badge badge-warning">${getGoodsBidSampleRows(tender).length} sample items</span>
                                    </div>
                                    <div class="bid-step-intro">
                                        <strong>Sample response checklist</strong>
                                        <span>Confirm preparation, dispatch, tracking, and proof for the samples requested by the buyer.</span>
                                    </div>
                                    ${renderGoodsBidSamples(tender, draft)}
                                </section>
                            ` : ''}

                            <section class="journey-panel" id="bid-step-${hasGoodsSamples ? '5' : '4'}">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step ${hasGoodsSamples ? '5' : '4'}</span><h2>Review Submission</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary submission-readiness-dashboard">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Eligibility readiness</span><strong data-bid-gate-summary>Pending review</strong></div>
                                    <div><span>Product specification status</span><strong>${goodsProductSpecStats.rowCount} response row${goodsProductSpecStats.rowCount === 1 ? '' : 's'}</strong></div>
                                    <div><span>Quantity schedule</span><strong>${getGoodsBidQuantityRows(tender).length} priced lines</strong></div>
                                    <div class="${hasGoodsSamples ? '' : 'not-required'}"><span>Samples</span><strong>${hasGoodsSamples ? `${getGoodsBidSampleRows(tender).length} required` : 'Not required'}</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                    <div class="bid-value-summary"><span>Bid value</span><strong>${formatBidWorkspaceMoney(bidAmount)}</strong></div>
                                    <div class="submission-state"><span>Submission status</span><strong>Ready for final review</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Submission readiness dashboard</strong>
                                    <span>Review completeness, pricing, evidence, samples, and declaration readiness before submitting the bid package.</span>
                                </div>
                                ${renderBidWorkspaceContractTerms(tender, profile, draft)}
                                ${renderBidWorkspaceCompletenessChecklist(tender, profile, draft, { stepOneRequirements, dynamicRequirements, commercialItems })}
                                <section class="bid-response-review" data-bid-response-review>
                                    ${renderBidWorkspaceResponseReviewPlaceholder()}
                                </section>
                            </section>

                            <section class="journey-panel" id="bid-step-${hasGoodsSamples ? '6' : '5'}">
                                <div class="panel-heading"><div><span class="section-kicker">Step ${hasGoodsSamples ? '6' : '5'}</span><h2>Supplier Declaration and Submit</h2></div><span class="badge badge-success">Final step</span></div>
                                <div class="form-grid two">
                                    <div class="form-group"><label class="form-label">Authorized Representative Name</label><input class="form-input" data-bid-response="goods-declaration-representative" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'goods-declaration-representative'))}"></div>
                                    <div class="form-group"><label class="form-label">Position / Title</label><input class="form-input" data-bid-response="goods-declaration-position" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'goods-declaration-position'))}"></div>
                                    <label class="bid-response-check"><input type="checkbox" data-bid-response="goods-declaration-final" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'goods-declaration-final') === true || getBidWorkspaceSavedResponse(draft, 'goods-declaration-final') === 'true' ? 'checked' : ''}><span>I confirm this goods bid is complete, accurate, and authorized.</span></label>
                                    <label class="bid-response-check"><input type="checkbox" data-bid-response="goods-declaration-anti-corruption" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'goods-declaration-anti-corruption') === true || getBidWorkspaceSavedResponse(draft, 'goods-declaration-anti-corruption') === 'true' ? 'checked' : ''}><span>I accept the anti-corruption and conflict of interest declarations.</span></label>
                                </div>
                                <div class="review-summary-grid" style="margin-top: 18px;">
                                    <article class="review-card">
                                        <span>Submission date</span>
                                        <strong>${new Date().toISOString().slice(0, 10)}</strong>
                                        <small>Generated automatically by the system.</small>
                                    </article>
                                    <article class="review-card">
                                        <span>Bid status</span>
                                        <strong data-bid-final-status>Draft until submitted</strong>
                                        <small>Final submission locks the bid package.</small>
                                    </article>
                                </div>
                                <div class="submit-strip">
                                    <div>
                                        <strong>Ready to seal</strong>
                                        <span>The system will check required responses, seal the goods bid, and store a receipt.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>
                            ` : worksFlow ? `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Technical Capacity and Experience</h2></div>
                                    <span class="badge badge-warning">Contractor capability</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Project-oriented contractor evidence</strong>
                                    <span>Prove relevant experience, available personnel, equipment capacity, and HSE readiness before writing the execution proposal.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about personnel, equipment, experience, or HSE evidence?', 'Technical', 'Question about works technical capacity requirements')}
                               
                                ${renderWorksBidCapacityResponse(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>Technical Proposal and Work Program</h2></div>
                                    <span class="badge badge-warning">Methodology required</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Explain how the works will be executed</strong>
                                    <span>Complete the methodology, schedule, milestone plan, drawing acknowledgement, and site investigation response as structured sections.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about drawings, site visit, milestones, or methodology?', 'Timeline', 'Question about works methodology, drawings, site visit, or work program')}
                                ${renderWorksBidTechnicalProposal(tender, draft)}
                                ${renderBidWorkspaceTechnicalUploadSection(technicalUploadRequirements, draft, 'Additional technical uploads', 'Upload any buyer-required works technical evidence that is not already captured in personnel, equipment, HSE, method statement, work program, licenses, or financial capacity.')}
                            </section>

                            <section class="journey-panel" id="bid-step-4">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 4</span><h2>Financial Proposal / BOQ Pricing</h2></div>
                                    <span class="badge badge-info" data-bid-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Editable construction pricing grid</strong>
                                    <span>Price labor, materials, equipment, overheads, and margin for each work item. The unit rate and total are recalculated automatically.</span>
                                </div>
                                ${renderBidWorkspaceFinancialCapacityMatrix(tender, draft, 'works-financial-capacity')}
                                <div class="data-table works-boq-table premium-review-table">
                                    <table class="financial-review-table" aria-label="Editable financial offer review table">
                                        <thead><tr><th>Item</th><th>Work Item</th><th>Qty</th><th>Unit</th><th>Status</th><th>Labor</th><th>Material</th><th>Equipment</th><th>Overheads</th><th>Profit %</th><th>Unit Rate</th><th>Total</th></tr></thead>
                                        <tbody data-bid-commercial-body>${renderWorksBidFinancialRows(tender, draft)}</tbody>
                                    </table>
                                </div>
                                <section class="bid-dynamic-group">
                                    <div class="bid-dynamic-group-heading">
                                        <div>
                                            <h3>Commercial terms response</h3>
                                            <p>Confirm bid validity, retention, liquidated damages, performance guarantee, and defects liability commitments.</p>
                                        </div>
                                        <span class="badge badge-warning">Response required</span>
                                    </div>
                                    ${renderWorksBidCommercialTerms(draft)}
                                </section>
                                ${renderBidWorkspaceClarificationPrompt('Question about BOQ lines, cost breakdown, or commercial terms?', 'Commercial Schedule', 'Question about works BOQ pricing or contract commercial terms')}
                            </section>

                            <section class="journey-panel" id="bid-step-5">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 5</span><h2>Review Submission</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary submission-readiness-dashboard">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Eligibility readiness</span><strong data-bid-gate-summary>Pending review</strong></div>
                                    <div><span>Experience evidence</span><strong>${normalizeBidWorkspaceFlag(tender.requirements?.fields?.similarCompletedProjectsRequired) ? 'Required' : 'Optional'}</strong></div>
                                    <div><span>Personnel profiles</span><strong>${getWorksBidPersonnelUploadCount(draft, normalizeBidWorkspaceFlag(tender.requirements?.fields?.keyPersonnelCvsRequired))} profile${getWorksBidPersonnelUploadCount(draft, normalizeBidWorkspaceFlag(tender.requirements?.fields?.keyPersonnelCvsRequired)) === 1 ? '' : 's'}</strong></div>
                                    <div><span>Equipment capacity</span><strong>${getWorksBidEquipmentRows(tender).length} items</strong></div>
                                    <div><span>BOQ lines</span><strong>${getWorksBidBoqRows(tender).length} priced lines</strong></div>
                                    <div><span>Milestones</span><strong>${getWorksBidMilestoneRows(tender).length} schedule items</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                    <div class="bid-value-summary"><span>Bid value</span><strong>${formatBidWorkspaceMoney(bidAmount)}</strong></div>
                                    <div class="submission-state"><span>Submission status</span><strong>Ready for final review</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Submission readiness dashboard</strong>
                                    <span>Review completeness, pricing, technical evidence, work program details, and declaration readiness before submitting.</span>
                                </div>
                                ${renderBidWorkspaceContractTerms(tender, profile, draft)}
                                ${renderBidWorkspaceCompletenessChecklist(tender, profile, draft, { stepOneRequirements, dynamicRequirements, commercialItems })}
                                <section class="bid-response-review" data-bid-response-review>
                                    ${renderBidWorkspaceResponseReviewPlaceholder()}
                                </section>
                            </section>

                            <section class="journey-panel" id="bid-step-6">
                                <div class="panel-heading"><div><span class="section-kicker">Step 6</span><h2>Declaration and Submission</h2></div><span class="badge badge-success">Final step</span></div>
                                ${renderWorksBidDeclaration(draft)}
                                <div class="review-summary-grid" style="margin-top: 18px;">
                                    <article class="review-card">
                                        <span>Submission date</span>
                                        <strong>${new Date().toISOString().slice(0, 10)}</strong>
                                        <small>Generated automatically by the system.</small>
                                    </article>
                                    <article class="review-card">
                                        <span>Bid status</span>
                                        <strong data-bid-final-status>Draft until submitted</strong>
                                        <small>Final submission locks the contractor bid package.</small>
                                    </article>
                                </div>
                                <div class="submit-strip">
                                    <div>
                                        <strong>Ready to seal</strong>
                                        <span>The system will check required responses, seal the works bid, and store a receipt.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>
                            ` : serviceFlow ? `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Service Understanding and Methodology</h2></div>
                                    <span class="badge badge-warning">Core service response</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Service delivery model</strong>
                                    <span>Explain who will deliver the service, how the workflow runs, how quality is controlled, and what evidence proves each deliverable.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about service scope, workflow, or deliverables?', 'Technical', 'Question about service methodology, deliverables, or workflow')}
                               
                                ${renderServiceBidMethodology(tender, draft)}
                                ${renderBidWorkspaceTechnicalUploadSection(technicalUploadRequirements, draft, 'Service technical uploads', 'Upload service methodology, workflow, deliverable, or other buyer-required technical evidence that is not a license, administrative document, or financial capacity document.')}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>Service Schedule and Delivery Plan</h2></div>
                                    <span class="badge badge-warning">SLA timing</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>When and where services happen</strong>
                                    <span>Set the service dates, coverage locations, working hours, response times, milestones, and availability plan.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about service locations, frequency, or SLA timings?', 'Timeline', 'Question about service schedule, locations, or SLA response times')}
                                ${renderServiceBidDeliveryPlan(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-4">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 4</span><h2>Personnel, Staffing and Capacity</h2></div>
                                    <span class="badge badge-warning">${getServiceBidPersonnelRows(tender).length} staff roles</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>People and operational sustainability</strong>
                                    <span>Assign staff, upload CVs, and prove tools or systems where required.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about staffing, certifications, or equipment?', 'Technical', 'Question about service staffing, certifications, or equipment')}
                                ${renderServiceBidStaffingCapacity(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-5">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 5</span><h2>Performance, SLA, Reporting and Compliance</h2></div>
                                    <span class="badge badge-warning">Performance model</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>SLA-driven service control</strong>
                                    <span>Commit to KPIs, escalation, reporting, ESG/labor compliance, and buyer-required supporting documents.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about SLA, KPIs, reporting, ESG, or supporting documents?', 'Deliverables', 'Question about service SLA, KPIs, reporting, ESG, or documents')}
                                ${renderServiceBidSlaReportingCompliance(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-6">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 6</span><h2>Service Pricing / Commercial Offer</h2></div>
                                    <span class="badge badge-info" data-bid-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Service pricing calculator</strong>
                                    <span>Price the schedule using monthly retainers, unit rates, lump sums, hybrid pricing, or SLA-based assumptions.</span>
                                </div>
                                ${renderBidWorkspaceFinancialCapacityMatrix(tender, draft, 'service-financial-capacity')}
                                <div class="data-table service-pricing-table">
                                    <table>
                                        <thead><tr><th>Code</th><th>Service Line</th><th>Status</th><th>Frequency</th><th>Staff Count</th><th>Monthly Rate</th><th>Equipment Cost</th><th>Total</th></tr></thead>
                                        <tbody data-bid-commercial-body>${renderServiceBidPricingRows(tender, profile, draft)}</tbody>
                                    </table>
                                </div>
                                <section class="bid-dynamic-group">
                                    <div class="bid-dynamic-group-heading">
                                        <div>
                                            <h3>Commercial terms response</h3>
                                            <p>Confirm price validity, payment acceptance, discounts, and commercial assumptions.</p>
                                        </div>
                                        <span class="badge badge-warning">Response required</span>
                                    </div>
                                    ${renderServiceBidCommercialTerms(draft)}
                                </section>
                                ${renderBidWorkspaceClarificationPrompt('Question about service pricing, SLA cost linkage, or payment terms?', 'Financial', 'Question about service pricing or commercial terms')}
                            </section>

                            <section class="journey-panel" id="bid-step-7">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 7</span><h2>Review Submission</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary submission-readiness-dashboard">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Eligibility readiness</span><strong data-bid-gate-summary>Pending review</strong></div>
                                    <div><span>Staffing roles</span><strong>${getServiceBidPersonnelRows(tender).length} roles</strong></div>
                                    <div><span>Service locations</span><strong>${getServiceBidLocationRows(tender).length || 1} covered</strong></div>
                                    <div><span>SLA / KPI controls</span><strong>${(tender.evaluation?.criteria || []).find(item => /sla|performance/i.test(item.name || ''))?.subcriteria?.length || 4} metrics</strong></div>
                                    <div><span>Supporting documents</span><strong>${getServiceBidDocumentRows(tender).length} uploads</strong></div>
                                    <div><span>Pricing lines</span><strong>${getServiceBidCommercialRows(tender, profile).length} service lines</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                    <div class="bid-value-summary"><span>Bid value</span><strong>${formatBidWorkspaceMoney(bidAmount)}</strong></div>
                                    <div class="submission-state"><span>Submission status</span><strong>Ready for final review</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Submission readiness dashboard</strong>
                                    <span>Review completeness, pricing, SLA evidence, documents, and declaration readiness before submitting.</span>
                                </div>
                                ${renderBidWorkspaceContractTerms(tender, profile, draft)}
                                ${renderBidWorkspaceCompletenessChecklist(tender, profile, draft, { stepOneRequirements, dynamicRequirements, commercialItems })}
                                <section class="bid-response-review" data-bid-response-review>
                                    ${renderBidWorkspaceResponseReviewPlaceholder()}
                                </section>
                                ${renderServiceBidDeclaration(draft)}
                                <div class="review-summary-grid" style="margin-top: 18px;">
                                    <article class="review-card">
                                        <span>Submission date</span>
                                        <strong>${new Date().toISOString().slice(0, 10)}</strong>
                                        <small>Generated automatically by the system.</small>
                                    </article>
                                    <article class="review-card">
                                        <span>Bid status</span>
                                        <strong data-bid-final-status>Draft until submitted</strong>
                                        <small>Final submission locks the service bid package.</small>
                                    </article>
                                </div>
                                <div class="submit-strip">
                                    <div>
                                        <strong>Ready to seal</strong>
                                        <span>The system will check required responses, seal the service bid, and store a receipt.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>
                            ` : consultancyFlow ? `
                            ${renderConsultancyTechnicalProposalStep(tender, draft, dynamicRequirements, 2)}
                            ${renderConsultancyFinancialProposalStep(tender, draft, commercialItems, bidAmount, 3)}
                            ${renderConsultancyReviewSubmitStep(tender, profile, draft, { stepOneRequirements, dynamicRequirements, commercialItems, bidAmount }, 4)}
                            ` : `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Dynamic Responses</h2></div>
                                    <span class="badge badge-info">${dynamicRequirements.length} tender items</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Generated response workbook</strong>
                                    <span>Answer the requirements that need supplier input. Requirements marked for review are shown for context only.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt(profile.id === 'consultancy' ? 'Need clarification about methodology, work plan, or team CVs?' : 'Need clarification about your technical response?', profile.id === 'consultancy' ? 'Deliverables' : 'Technical', profile.id === 'consultancy' ? 'Question about methodology, work plan, team CVs, or expert qualifications' : 'Question about technical response requirements')}
                                ${profile.id === 'consultancy' ? renderConsultancyEnvelopeNotice(tender) : ''}
                                
                                ${profile.id === 'consultancy' ? renderConsultancyBidTorWorkbook(tender, draft) : ''}
                                ${renderBidWorkspaceDynamicResponses(dynamicRequirements, draft, responseFields, tender, profile)}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>${escapeBidWorkspaceHtml(profile.commercialTitle || 'Financial Offer')}</h2></div>
                                    <span class="badge badge-info" data-bid-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                ${renderBidWorkspaceFinancialCapacityMatrix(tender, draft, `${profile.id || 'general'}-financial-capacity`)}
                                <div class="data-table">
                                    <table>
                                        ${profile.id === 'consultancy'
                                            ? `<thead><tr><th>Code</th><th>Consultancy Line</th><th>Person Days</th><th>Daily Rate / Fee</th><th>Reimbursables</th><th>Tax</th><th>Assumption</th><th>Amount</th></tr></thead><tbody data-bid-commercial-body>${renderConsultancyBidPricingRows(commercialItems, draft)}</tbody>`
                                            : `<thead><tr><th>Code</th><th>Requirement</th><th>Qty / Duration</th><th>Bid rate / fee</th><th>Amount</th></tr></thead><tbody data-bid-commercial-body>${renderBidWorkspaceCommercialRows(commercialItems)}</tbody>`}
                                    </table>
                                </div>
                                ${profile.id === 'consultancy' ? renderConsultancyEnvelopeNotice(tender) : ''}
                                ${profile.id === 'consultancy' ? renderConsultancyBidCommercialTerms(draft) : ''}
                                ${renderBidWorkspaceClarificationPrompt('Question about pricing lines?', 'Commercial Schedule', 'Question about commercial schedule or pricing lines')}
                            </section>

                            <section class="journey-panel" id="bid-step-4">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 4</span><h2>Review Submission</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary submission-readiness-dashboard">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Mandatory requirements</span><strong data-bid-gate-summary>Pending review</strong></div>
                                    <div><span>Additional responses</span><strong>${dynamicRequirements.filter(isBidWorkspaceResponseRequirement).length} required / ${dynamicRequirements.length} tender items</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                    <div class="bid-value-summary"><span>Bid value</span><strong>${formatBidWorkspaceMoney(bidAmount)}</strong></div>
                                    <div class="submission-state"><span>Submission status</span><strong>Ready for final review</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Submission readiness dashboard</strong>
                                    <span>Review completeness, supporting evidence, financial offer, and declaration readiness before submitting.</span>
                                </div>
                                ${renderBidWorkspaceContractTerms(tender, profile, draft)}
                                ${renderBidWorkspaceCompletenessChecklist(tender, profile, draft, { stepOneRequirements, dynamicRequirements, commercialItems })}
                                <section class="bid-response-review" data-bid-response-review>
                                    ${renderBidWorkspaceResponseReviewPlaceholder()}
                                </section>
                                <div class="confirm-action" data-confirm-control>
                                    <input type="checkbox" class="confirm-action-input" data-bid-declaration>
                                    <button type="button" class="confirm-action-button" data-confirm-toggle aria-pressed="false">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M20 6L9 17l-5-5"/>
                                        </svg>
                                        <span>Confirm bid declaration</span>
                                    </button>
                                    <p class="confirm-action-note" data-confirm-note>Confirm that this sealed bid is complete, accurate, and authorized for submission.</p>
                                </div>
                                <div class="submit-strip">
                                    <div>
                                        <strong>Ready to seal</strong>
                                        <span>The system will store a receipt and lock the bid after the configured closing date.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>

                            <section class="journey-panel" id="bid-step-5">
                                <div class="panel-heading"><div><span class="section-kicker">Step 5</span><h2>Submission Receipt</h2></div><span class="badge badge-success">Receipt ready</span></div>
                                <div class="review-summary-grid">
                                    <article class="review-card">
                                        <span>Deadline lock</span>
                                        <strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong>
                                        <small>No edits are allowed after bid closing.</small>
                                    </article>
                                    <article class="review-card">
                                        <span>Bid status</span>
                                        <strong data-bid-final-status>Draft until submitted</strong>
                                        <small>Withdraw or resubmit only before the deadline.</small>
                                    </article>
                                </div>
                                <div class="inline-actions" style="margin-top: 18px;">
                                    <button class="btn btn-secondary" type="button" data-bid-save-draft>Save Copy</button>
                                    <button class="btn btn-primary" data-navigate="procurement-guide">View Outcome Center</button>
                                </div>
                            </section>
                            `}

                            <div class="wizard-flow-controls" data-bid-flow-controls>
                                <button class="btn btn-secondary" type="button" data-bid-prev>Back</button>
                                <div class="wizard-flow-progress">
                                    <strong data-bid-progress>Step 1 of ${steps.length}</strong>
                                    <span data-bid-step-title>${escapeBidWorkspaceHtml(steps[0][1])}</span>
                                </div>
                                <button class="btn btn-primary" type="button" data-bid-next>Continue</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initializeBiddingWorkspace() {
    const wizard = document.querySelector('[data-bid-wizard]');
    if (!wizard || wizard.dataset.ready === 'true') return;

    const pageRoot = wizard.closest('.bid-flow-page') || wizard;
    const tenderId = wizard.dataset.bidTenderId || 'selected';
    const tender = getBidWorkspaceTender();
    const profile = getBidWorkspaceProfile(tender);
    const panels = Array.from(wizard.querySelectorAll('.wizard-workspace > .journey-panel'));
    const railSteps = Array.from(wizard.querySelectorAll('[data-bid-step-index]'));
    const previousButton = wizard.querySelector('[data-bid-prev]');
    const nextButton = wizard.querySelector('[data-bid-next]');
    const progressOutput = wizard.querySelector('[data-bid-progress]');
    const stepTitleOutput = wizard.querySelector('[data-bid-step-title]');
    const gateStatus = wizard.querySelector('[data-bid-gate-status]');
    const gateBadge = wizard.querySelector('[data-bid-gate-badge]');
    const gateSummary = wizard.querySelector('[data-bid-gate-summary]');
    const finalStatus = wizard.querySelector('[data-bid-final-status]');
    const usesMandatoryGate = wizard.dataset.bidUsesMandatoryGate !== 'false';
    const existingDraft = getBidWorkspaceDraft(tenderId);
    const sessionUploadUrls = {};
    let uploadedFiles = { ...(existingDraft.uploadedFiles || {}) };
    let activeStepIndex = Number(existingDraft.step || 0);
    let bidReviewSourceSequence = 0;

    const getMandatoryGateRoot = () => wizard.querySelector('.bid-mandatory-gate') || wizard;

    const getBidFileManifest = () => Object.entries(uploadedFiles || {}).map(([responseId, file]) => ({
        responseId,
        name: file?.name || responseId,
        type: file?.type || '',
        size: file?.size || 0,
        uploadedAt: file?.uploadedAt || '',
        sha256: file?.sha256 || file?.hash || ''
    }));

    const computeBidWorkspaceFileHash = (responseId, file) => {
        if (!responseId || !file || !window.crypto?.subtle || typeof file.arrayBuffer !== 'function') return;
        file.arrayBuffer()
            .then(buffer => window.crypto.subtle.digest('SHA-256', buffer))
            .then(hashBuffer => {
                const hash = Array.from(new Uint8Array(hashBuffer))
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
                uploadedFiles[responseId] = {
                    ...(uploadedFiles[responseId] || {}),
                    sha256: hash
                };
                refreshBidResponseReviews();
                saveDraft();
            })
            .catch(() => {
                uploadedFiles[responseId] = {
                    ...(uploadedFiles[responseId] || {}),
                    sha256: uploadedFiles[responseId]?.sha256 || 'Hash unavailable'
                };
            });
    };

    const getRequiredInputsByPriority = () => {
        const gateRoot = getMandatoryGateRoot();
        const groups = { licenses: [], evidence: [], confirmations: [] };
        gateRoot.querySelectorAll('[data-bid-required-response]').forEach(input => {
            const card = input.closest('[data-bid-requirement-card]');
            const category = String(card?.dataset.bidRequirementCategory || '').toLowerCase();
            const responseType = String(card?.dataset.bidRequirementResponseType || '').toLowerCase();
            if (category.includes('regulatory license') || category.includes('license')) groups.licenses.push(input);
            else if (responseType === 'upload') groups.evidence.push(input);
            else groups.confirmations.push(input);
        });
        return groups;
    };

    const collectDraft = () => {
        const responses = {};
        wizard.querySelectorAll('[data-bid-response]').forEach(input => {
            responses[input.dataset.bidResponse] = input.type === 'checkbox' ? input.checked : input.value;
        });
        const freeResponses = {};
        wizard.querySelectorAll('[data-bid-free-response]').forEach(input => {
            freeResponses[input.dataset.bidFreeResponse] = input.value;
        });
        const productSpecificationResponses = Array.from(wizard.querySelectorAll('[data-bid-product-spec-row]')).map(row => {
            const rowId = row.dataset.bidProductSpecRow;
            const response = { rowId };
            row.querySelectorAll('[data-bid-product-spec-field]').forEach(input => {
                response[input.dataset.bidProductSpecField] = input.type === 'checkbox'
                    ? (input.checked ? input.value : 'Not Compliant')
                    : input.value;
            });
            const attachment = row.querySelector('[data-bid-response$="-attachment"]');
            if (attachment?.dataset.bidResponse) {
                response.attachmentResponseId = attachment.dataset.bidResponse;
                response.supportingAttachment = attachment.value || '';
            }
            return response;
        });
        const reviewPanel = panels.find(panel => panel.querySelector('[data-bid-response-review]'));
        const reviewSections = typeof collectBidReviewSections === 'function' && reviewPanel ? collectBidReviewSections(reviewPanel) : [];
        return {
            ...getBidWorkspaceDraft(tenderId),
            step: activeStepIndex,
            responses,
            freeResponses,
            productSpecificationResponses,
            uploadedFiles,
            fileManifest: getBidFileManifest(),
            reviewSections,
            completeness: getProcurexBidPackageCompleteness(reviewSections),
            total: wizard.querySelector('[data-bid-review-total]')?.textContent || ''
        };
    };

    const saveDraft = () => saveBidWorkspaceDraft(tenderId, collectDraft());

    const getBidUploadResponseId = (uploadControl) => uploadControl?.querySelector('[data-bid-response]')?.dataset.bidResponse || '';

    const updateBidUploadControlState = (uploadControl) => {
        if (!uploadControl) return;
        const responseInput = uploadControl.querySelector('[data-bid-response]');
        const responseId = getBidUploadResponseId(uploadControl);
        const value = String(responseInput?.value || '').trim();
        let actions = uploadControl.querySelector('[data-bid-upload-actions]');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'bid-upload-actions';
            actions.dataset.bidUploadActions = 'true';
            actions.innerHTML = `
                <button class="btn btn-secondary btn-sm" type="button" data-bid-view-upload>View</button>
                <button class="btn btn-secondary btn-sm" type="button" data-bid-delete-upload>Delete</button>
            `;
            uploadControl.appendChild(actions);
        }
        const viewButton = actions.querySelector('[data-bid-view-upload]');
        const deleteButton = actions.querySelector('[data-bid-delete-upload]');
        const hasUpload = Boolean(value);
        if (viewButton) viewButton.disabled = !hasUpload;
        if (deleteButton) deleteButton.disabled = !hasUpload;
        uploadControl.classList.toggle('has-upload', hasUpload);
        if (responseId && uploadedFiles[responseId]?.dataUrl) {
            uploadControl.dataset.bidUploadPreviewReady = 'true';
        } else {
            delete uploadControl.dataset.bidUploadPreviewReady;
        }
    };

    const refreshBidUploadControls = () => {
        wizard.querySelectorAll('[data-bid-upload-control]').forEach(updateBidUploadControlState);
    };

    const syncBidSecurityUploadPanel = () => {
        const checkbox = wizard.querySelector('[data-bid-security-toggle]');
        const panel = wizard.querySelector('[data-bid-security-upload-panel]');
        const uploadResponse = panel?.querySelector('[data-bid-response]');
        const submitted = Boolean(checkbox?.checked);
        if (panel) panel.hidden = !submitted;
        if (uploadResponse) {
            if (submitted) uploadResponse.setAttribute('data-bid-workflow-required-response', 'true');
            else uploadResponse.removeAttribute('data-bid-workflow-required-response');
        }
    };

    const syncConsultancySubmissionModePanels = () => {
        const submissionType = wizard.querySelector('[data-bid-response="consultancy-submission-type"]')?.value || '';
        const firmSubmission = isConsultancyFirmSubmission(submissionType);
        const individualSubmission = isConsultancyIndividualSubmission(submissionType);
        wizard.querySelectorAll('[data-consultancy-mode-panel]').forEach(panel => {
            const mode = panel.dataset.consultancyModePanel;
            panel.hidden = mode === 'firm'
                ? !firmSubmission
                : mode === 'individual'
                    ? !individualSubmission
                    : !submissionType;
        });
        wizard.querySelectorAll('[data-consultancy-mode-prompt]').forEach(prompt => {
            prompt.hidden = Boolean(submissionType);
        });
    };

    const storeBidUploadPreview = (responseId, file) => {
        if (!responseId || !file) return;
        if (sessionUploadUrls[responseId]) URL.revokeObjectURL(sessionUploadUrls[responseId]);
        sessionUploadUrls[responseId] = URL.createObjectURL(file);
        uploadedFiles[responseId] = {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size || 0,
            uploadedAt: new Date().toISOString(),
            sha256: 'Hash pending'
        };
        computeBidWorkspaceFileHash(responseId, file);

        if (file.size > bidWorkspaceUploadPreviewMaxBytes) {
            saveDraft();
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            uploadedFiles[responseId] = {
                ...uploadedFiles[responseId],
                dataUrl: String(reader.result || '')
            };
            refreshBidUploadControls();
            saveDraft();
        };
        reader.readAsDataURL(file);
    };

    const clearBidUpload = (uploadControl) => {
        const fileInput = uploadControl?.querySelector('[data-bid-file-input]');
        const hiddenInput = uploadControl?.querySelector('[data-bid-response]');
        const fileNameOutput = uploadControl?.querySelector('[data-bid-file-name]');
        const responseId = getBidUploadResponseId(uploadControl);
        if (fileInput) fileInput.value = '';
        if (hiddenInput) hiddenInput.value = '';
        if (fileNameOutput) fileNameOutput.textContent = 'No file selected yet.';
        if (responseId) {
            if (sessionUploadUrls[responseId]) URL.revokeObjectURL(sessionUploadUrls[responseId]);
            delete sessionUploadUrls[responseId];
            delete uploadedFiles[responseId];
        }
        updateBidUploadControlState(uploadControl);
        validateMandatoryGate(false);
        validateWorkflowResponses(false);
        saveDraft();
    };

    const viewBidUpload = (uploadControl) => {
        const responseId = getBidUploadResponseId(uploadControl);
        const fileInput = uploadControl?.querySelector('[data-bid-file-input]');
        const selectedFile = fileInput?.files?.[0];
        if (selectedFile) {
            if (sessionUploadUrls[responseId]) URL.revokeObjectURL(sessionUploadUrls[responseId]);
            sessionUploadUrls[responseId] = URL.createObjectURL(selectedFile);
        }
        const previewUrl = uploadedFiles[responseId]?.dataUrl || sessionUploadUrls[responseId] || '';
        if (!previewUrl) {
            alert('This upload was saved by filename only. Select the file again to preview it, or delete it if it is no longer needed.');
            return;
        }
        window.open(previewUrl, '_blank', 'noopener');
    };

    const isResponseComplete = (input) => {
        if (!input) return false;
        if (input.type === 'checkbox') return input.checked;
        return String(input.value || '').trim().length > 0;
    };

    const getWorkflowCompletion = () => {
        const requiredInputs = Array.from(wizard.querySelectorAll('[data-bid-workflow-required-response]'))
            .filter(input => typeof isWorkflowRequiredInputActive === 'function' ? isWorkflowRequiredInputActive(input) : true);
        const completed = requiredInputs.filter(isResponseComplete).length;
        return {
            completed,
            total: requiredInputs.length,
            percent: requiredInputs.length ? Math.round((completed / requiredInputs.length) * 100) : 100
        };
    };

    const refreshBidProgress = () => {
        if (!progressOutput) return;
        const completion = getWorkflowCompletion();
        progressOutput.textContent = `Step ${activeStepIndex + 1} of ${panels.length} - ${completion.percent}% complete`;
    };

    const markBidSemanticInvalid = (input, invalid, show = false) => {
        const container = input?.closest('[data-bid-requirement-card], [data-bid-product-spec-row], .form-group, .bid-response-check, .goods-compliance-card, .goods-offer-row, .goods-sample-card, .works-capacity-card, .works-person-card, .works-accordion-card, .works-boq-row, .works-drawing-card, .service-accordion-card, .service-staff-card, .service-pricing-row, .service-document-card, .service-kpi-card') || input;
        container?.classList.toggle('invalid', Boolean(show && invalid));
    };

    const validateSemanticResponses = (show = false, root = wizard) => {
        const issues = [];
        const addIssue = (input, message) => {
            if (!input) return;
            issues.push({ input, message });
            markBidSemanticInvalid(input, true, show);
        };
        const clearInput = (input) => markBidSemanticInvalid(input, false, show);

        Array.from(root.querySelectorAll('[data-bid-response$="validity"], [data-bid-response$="bid-validity"]')).forEach(input => {
            const days = parseBidWorkspaceNumber(input.value);
            clearInput(input);
            if (days <= 0 || days > 730) addIssue(input, 'Bid validity period must be between 1 and 730 days.');
        });

        const advanceRequested = root.querySelector('[data-bid-response="works-commercial-advance-requested"]');
        const advancePercent = root.querySelector('[data-bid-response="works-commercial-advance-percent"]');
        if (advancePercent) {
            const requested = String(advanceRequested?.value || '').toLowerCase() === 'yes';
            const value = String(advancePercent.value || '').trim();
            const percent = parseBidWorkspaceNumber(value);
            clearInput(advancePercent);
            if (requested && !value) addIssue(advancePercent, 'Proposed advance percentage is required when advance payment is requested.');
            if (value && (percent < 0 || percent > 100)) addIssue(advancePercent, 'Proposed advance percentage must be between 0 and 100.');
        }

        Array.from(root.querySelectorAll('[data-bid-rate], [data-works-cost], [data-bid-line-qty], [data-bid-line-extra-cost]')).forEach(input => {
            clearInput(input);
            if (isBidWorkspaceCommercialLineNotBid(input)) return;
            if (String(input.value || '').trim() && parseBidWorkspaceNumber(input.value) < 0) {
                addIssue(input, 'Commercial rates, quantities, and extra costs must be non-negative.');
            }
        });

        Array.from(root.querySelectorAll('[data-bid-commercial-body] tr')).forEach(row => {
            const rateInput = row.querySelector('[data-bid-rate]');
            const output = row.querySelector('[data-bid-line-amount]');
            if (!rateInput || !output) return;
            if (isBidWorkspaceCommercialLineNotBid(row)) return;
            const qtyInput = row.querySelector('[data-bid-line-qty]');
            const rate = parseBidWorkspaceNumber(rateInput.value);
            const qty = parseBidWorkspaceNumber(qtyInput?.value || qtyInput?.textContent || row.children[2]?.textContent || '1') || 1;
            const extraCost = Array.from(row.querySelectorAll('[data-bid-line-extra-cost]'))
                .reduce((sum, input) => sum + parseBidWorkspaceNumber(input.value), 0);
            const expectedAmount = Math.round((rate * qty) + extraCost);
            const displayedAmount = parseBidWorkspaceNumber(output.textContent);
            if (Number.isFinite(displayedAmount) && Math.abs(expectedAmount - displayedAmount) > 1) {
                addIssue(rateInput, 'Commercial line total is out of sync with quantity, rate, or extra cost. Recalculate totals before submitting.');
            }
        });

        const performanceGuarantee = root.querySelector('[data-bid-response="works-commercial-performance-guarantee"]');
        if (performanceGuarantee) {
            clearInput(performanceGuarantee);
            if (!String(performanceGuarantee.value || '').trim()) addIssue(performanceGuarantee, 'Performance guarantee availability must be confirmed.');
        }

        return {
            valid: issues.length === 0,
            remaining: issues.length,
            firstIncomplete: issues[0]?.input || null,
            messages: issues.map(issue => issue.message)
        };
    };

    const focusBidWorkspaceInput = (input) => {
        const uploadInput = input?.closest('[data-bid-upload-control]')?.querySelector('[data-bid-file-input]');
        (uploadInput || input)?.focus?.();
    };

    const getBidReviewSourceId = (input) => {
        if (!input) return '';
        if (!input.dataset.bidReviewSourceId) {
            bidReviewSourceSequence += 1;
            input.dataset.bidReviewSourceId = `bid-review-source-${bidReviewSourceSequence}`;
        }
        return input.dataset.bidReviewSourceId;
    };

    const openBidReviewSource = (sourceId) => {
        const input = wizard.querySelector(`[data-bid-review-source-id="${sourceId}"]`);
        if (!input) return;
        const targetPanelIndex = panels.findIndex(panel => panel.contains(input));
        if (targetPanelIndex > -1) setActiveStep(targetPanelIndex, true);
        const container = input.closest('[data-bid-upload-control], [data-bid-requirement-card], [data-bid-product-spec-row], .form-group, .bid-response-check, .goods-compliance-card, .goods-offer-row, .goods-sample-card, .works-capacity-card, .works-person-card, .works-accordion-card, .works-boq-row, .works-drawing-card, .service-accordion-card, .service-sla-card, .service-staff-card, .service-pricing-row, .service-document-card, .service-kpi-card') || input;
        container.classList.add('bid-review-edit-target');
        window.setTimeout(() => container.classList.remove('bid-review-edit-target'), 2200);
        window.setTimeout(() => {
            container.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            const uploadInput = input.closest('[data-bid-upload-control]')?.querySelector('[data-bid-file-input]');
            if (uploadInput) {
                uploadInput.focus?.();
                uploadInput.click?.();
            } else {
                focusBidWorkspaceInput(input);
            }
        }, 80);
    };

    const validateMandatoryGate = (show = false) => {
        const gateRoot = getMandatoryGateRoot();
        const requiredInputs = Array.from(gateRoot.querySelectorAll('[data-bid-required-response]'));
        const completeInputs = requiredInputs.filter(isResponseComplete);
        requiredInputs.forEach(input => {
            const card = input.closest('[data-bid-requirement-card]');
            const complete = isResponseComplete(input);
            card?.classList.toggle('completed', complete);
            card?.classList.toggle('invalid', show && !complete);
        });
        const groups = getRequiredInputsByPriority();
        const pendingLicenses = groups.licenses.filter(input => !isResponseComplete(input)).length;
        const pendingEvidence = groups.evidence.filter(input => !isResponseComplete(input)).length;
        const valid = requiredInputs.length === 0 || completeInputs.length === requiredInputs.length;
        const remaining = Math.max(requiredInputs.length - completeInputs.length, 0);
        if (gateStatus) {
            gateStatus.textContent = valid
                ? 'License and mandatory evidence gate complete. You can continue to the bid workflow.'
                : pendingLicenses
                    ? `${pendingLicenses} required license upload${pendingLicenses === 1 ? '' : 's'} pending before the bid workflow can start.`
                    : pendingEvidence
                        ? `${pendingEvidence} mandatory evidence upload${pendingEvidence === 1 ? '' : 's'} pending before the bid workflow can start.`
                        : `${completeInputs.length} of ${requiredInputs.length} mandatory requirements complete. Complete ${remaining} more to continue.`;
            gateStatus.classList.toggle('balanced', valid);
        }
        if (gateBadge) {
            gateBadge.textContent = valid ? 'Gate complete' : `${remaining} remaining`;
            gateBadge.className = `badge ${valid ? 'badge-success' : 'badge-warning'}`;
        }
        if (gateSummary) gateSummary.textContent = valid ? 'Complete' : `${remaining} pre-qualification item(s) pending`;
        if (nextButton && activeStepIndex === 0 && usesMandatoryGate) nextButton.disabled = !valid;
        return valid;
    };

    const markWorkflowInputState = (input, show = false) => {
        const container = input.closest('[data-bid-requirement-card], [data-bid-product-spec-row], .form-group, .bid-response-check, .goods-compliance-card, .goods-offer-row, .goods-sample-card, .works-capacity-card, .works-person-card, .works-accordion-card, .works-boq-row, .works-drawing-card, .service-accordion-card, .service-sla-card, .service-staff-card, .service-pricing-row, .service-document-card, .service-kpi-card');
        const complete = isResponseComplete(input);
        container?.classList.toggle('completed', complete);
        container?.classList.toggle('invalid', show && !complete);
    };

    const isWorkflowRequiredInputActive = (input) => {
        if (!input?.matches?.('[data-bid-workflow-required-response]')) return false;
        if (input.closest('[hidden]')) return false;
        if (input.matches('[data-bid-line-status]')) return true;
        if (isBidWorkspaceCommercialLineNotBid(input)) return false;
        return true;
    };

    const validatePanelWorkflowResponses = (panelIndex = activeStepIndex, show = false) => {
        const requiredInputs = Array.from(panels[panelIndex]?.querySelectorAll('[data-bid-workflow-required-response]') || [])
            .filter(isWorkflowRequiredInputActive);
        const incompleteInputs = requiredInputs.filter(input => !isResponseComplete(input));
        requiredInputs.forEach(input => markWorkflowInputState(input, show));
        return {
            valid: incompleteInputs.length === 0,
            remaining: incompleteInputs.length,
            firstIncomplete: incompleteInputs[0] || null
        };
    };

    const validateWorkflowResponses = (show = false) => {
        const requiredInputs = Array.from(wizard.querySelectorAll('[data-bid-workflow-required-response]'))
            .filter(isWorkflowRequiredInputActive);
        const incompleteInputs = requiredInputs.filter(input => !isResponseComplete(input));
        requiredInputs.forEach(input => markWorkflowInputState(input, show));
        return {
            valid: incompleteInputs.length === 0,
            remaining: incompleteInputs.length,
            firstIncomplete: incompleteInputs[0] || null
        };
    };

    const getBidReviewCellText = (cell) => {
        if (!cell) return '';
        const controls = Array.from(cell.querySelectorAll('input, select, textarea'))
            .map(input => input.type === 'checkbox' ? (input.checked ? 'Yes' : '') : input.value)
            .filter(Boolean);
        return controls.join(' / ') || cell.textContent.trim();
    };

    const getBidReviewTableLabel = (input) => {
        const cell = input.closest('td, th');
        const row = input.closest('tr');
        const table = input.closest('table');
        if (!cell || !row || !table) return '';
        const cellIndex = Array.from(row.children).indexOf(cell);
        const header = table.querySelectorAll('thead th')[cellIndex]?.textContent.trim() || '';
        const rowContext = Array.from(row.children)
            .slice(0, Math.min(2, row.children.length))
            .filter(item => item !== cell)
            .map(getBidReviewCellText)
            .filter(Boolean)
            .join(' / ');
        return [rowContext, header].filter(Boolean).join(' - ');
    };

    const getBidReviewInputLabel = (input) => {
        const checkboxLabel = input.closest('.bid-response-check')?.querySelector('span')?.textContent.trim();
        if (checkboxLabel) return checkboxLabel;
        const uploadLabel = input.closest('[data-bid-upload-control]')?.querySelector('span, .form-label')?.textContent.trim();
        if (uploadLabel) return uploadLabel;
        const formLabel = input.closest('.form-group')?.querySelector('.form-label, label')?.textContent.trim();
        if (formLabel) return formLabel;
        const tableLabel = getBidReviewTableLabel(input);
        if (tableLabel) return tableLabel;
        return input.getAttribute('aria-label') || humanizeBidWorkspaceKey(input.dataset.bidResponse || input.dataset.bidFreeResponse || input.dataset.bidProductSpecField || 'Response');
    };

    const getBidReviewInputValue = (input) => {
        if (input.type === 'checkbox') return input.checked;
        if (input.tagName === 'SELECT') {
            return input.selectedOptions?.[0]?.textContent.trim() || input.value;
        }
        return input.value;
    };

    const isBidReviewInputMandatory = (input) => input.matches('[data-bid-required-response], [data-bid-workflow-required-response]');

    const isBidReviewDeviationInput = (input) => {
        const key = String(input.dataset.bidResponse || input.dataset.bidFreeResponse || input.dataset.bidProductSpecField || '').toLowerCase();
        const label = getBidReviewInputLabel(input).toLowerCase();
        const value = String(getBidReviewInputValue(input) || '').trim();
        if (!value) return false;
        if (/deviation|exception|alternative/.test(`${key} ${label}`)) return true;
        return Boolean(input.closest('.contract-terms-review') && /deviation|exception|change|not accept|cannot accept/i.test(value));
    };

    const getBidReviewInputFile = (input) => {
        const responseId = input.dataset.bidResponse || '';
        if (!responseId || !input.closest('[data-bid-upload-control]')) return null;
        const file = uploadedFiles[responseId];
        return file ? { responseId, ...file } : null;
    };

    const shouldIncludeBidReviewInput = (input) => {
        if (input.closest('[data-bid-response-review]')) return false;
        if (input.closest('[data-bid-declaration], .confirm-action')) return false;
        if (input.closest('[hidden]')) return false;
        if ((profile.id || getBidWorkspaceTypeId(tender)) === 'works' && input.closest('.works-boq-row, .works-cost-detail-row')) return false;
        const required = input.matches('[data-bid-required-response], [data-bid-workflow-required-response]');
        const uploadControl = input.closest('[data-bid-upload-control]');
        if (input.type === 'hidden' && !uploadControl) return String(input.value || '').trim().length > 0;
        if (input.type === 'checkbox') return input.checked || required || Boolean(getBidReviewInputLabel(input));
        return Boolean(uploadControl) || Boolean(getBidReviewInputLabel(input)) || String(input.value || '').trim().length > 0 || required;
    };

    const getWorksFinancialInputValue = (row, suffix) => {
        const detailRow = row?.nextElementSibling?.classList.contains('works-cost-detail-row') ? row.nextElementSibling : null;
        const input = (detailRow || row)?.querySelector(`[data-bid-response$="${suffix}"]`);
        return input ? formatBidWorkspaceMoney(parseBidWorkspaceNumber(input.value)) : 'Not provided';
    };

    const collectWorksFinancialOfferRows = () => Array.from(wizard.querySelectorAll('[data-works-boq-row]')).map((row, index) => {
        const statusSelect = row.querySelector('[data-bid-line-status]');
        const status = String(statusSelect?.value || '').trim()
            ? (statusSelect?.selectedOptions?.[0]?.textContent.trim() || statusSelect.value)
            : 'Not selected';
        return {
            item: row.children[0]?.textContent.trim() || String(index + 1),
            workItem: row.children[1]?.querySelector('strong')?.textContent.trim() || row.children[1]?.textContent.trim() || `Work item ${index + 1}`,
            quantity: row.querySelector('[data-bid-line-qty]')?.textContent.trim() || row.children[2]?.textContent.trim() || '1',
            unit: row.children[3]?.textContent.trim() || 'Lot',
            status,
            labor: getWorksFinancialInputValue(row, '-labor'),
            material: getWorksFinancialInputValue(row, '-material'),
            equipment: getWorksFinancialInputValue(row, '-equipment'),
            overheads: getWorksFinancialInputValue(row, '-overheads'),
            profit: row.querySelector('[data-bid-response$="-profit"]')?.value || 'Not provided',
            unitRate: row.querySelector('[data-works-unit-rate]')?.childNodes?.[0]?.textContent?.trim() || row.querySelector('[data-bid-rate]')?.value || 'Not calculated',
            total: row.querySelector('[data-bid-line-amount]')?.textContent.trim() || 'Not calculated',
            sourceId: getBidReviewSourceId(statusSelect || row.querySelector('[data-works-cost]') || row.querySelector('[data-bid-rate]'))
        };
    });

    const collectBidReviewSections = (reviewPanel) => {
        const reviewIndex = panels.indexOf(reviewPanel);
        const rows = [];
        panels.slice(0, Math.max(reviewIndex, 0)).forEach(panel => {
            const panelTitle = panel.querySelector('.panel-heading h2')?.textContent.trim()
                || panel.querySelector('h2, h3')?.textContent.trim()
                || 'Bid section';
            const category = getProcurexBidPackageCategoryFromPanel(panelTitle);
            const seen = new Set();
            Array.from(panel.querySelectorAll('[data-bid-response], [data-bid-free-response], [data-bid-product-spec-field]'))
                .filter(shouldIncludeBidReviewInput)
                .forEach(input => {
                    const key = `${input.dataset.bidResponse || input.dataset.bidFreeResponse || input.dataset.bidProductSpecField || ''}::${getBidReviewInputLabel(input)}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    const mandatory = isBidReviewInputMandatory(input);
                    const pending = !isResponseComplete(input);
                    rows.push({
                        label: getBidReviewInputLabel(input),
                        value: formatBidWorkspaceReviewValue(getBidReviewInputValue(input), { mandatory }),
                        pending,
                        sourceId: getBidReviewSourceId(input),
                        editable: true,
                        upload: Boolean(input.closest('[data-bid-upload-control]')),
                        mandatory,
                        category,
                        deviation: isBidReviewDeviationInput(input),
                        file: getBidReviewInputFile(input)
                    });
                });
        });
        const sections = createProcurexBidPackageSectionsFromRows(rows);
        const worksFinancialOfferRows = (profile.id || getBidWorkspaceTypeId(tender)) === 'works'
            ? collectWorksFinancialOfferRows()
            : [];
        if (worksFinancialOfferRows.length) {
            const financialRows = worksFinancialOfferRows.map(row => ({
                label: row.workItem,
                value: row.total,
                mandatory: row.status !== 'Not Bid',
                pending: row.status !== 'Not Bid' && /not provided|not selected|not calculated/i.test(Object.values(row).join(' ')),
                editable: true
            }));
            const existingIndex = sections.findIndex(section => normalizeProcurexBidPackageCategory(section.title) === 'Step 3: Financial Offer');
            const financialSection = {
                title: 'Step 3: Financial Offer',
                rows: existingIndex > -1 ? [...sections[existingIndex].rows, ...financialRows] : financialRows,
                financialOfferRows: worksFinancialOfferRows
            };
            if (existingIndex > -1) sections[existingIndex] = financialSection;
            else sections.push(financialSection);
        }
        return sections;
    };

    const renderBidReviewSections = (sections = []) => {
        const reviewTotal = wizard.querySelector('[data-bid-review-total]')?.textContent || wizard.querySelector('[data-bid-total]')?.textContent || '';
        return renderProcurexBidPackageDocument({
            tender: { ...tender, reference: tenderId },
            profile,
            sections,
            supplier: {
                name: mockData.users?.supplier?.organization || 'Supplier organization',
                contact: mockData.users?.supplier?.name || '',
                total: reviewTotal || 'Pending',
                status: 'Draft package'
            },
            editable: true,
            includeActions: true,
            fileManifest: getBidFileManifest(),
            documentLabel: 'Review Copy',
            actionsTitle: 'Bid submission review preview',
            actionsDescription: 'Download or print the current supplier bid review after required actions are captured.',
            description: 'Bid review copy generated from tender information and supplier responses captured across administrative, technical, financial, samples, and declaration sections.'
        });
    };

    const getExportableBidResponseDocument = (trigger) => {
        const review = trigger?.closest('[data-bid-response-review]');
        const documentNode = review?.querySelector('.bid-response-document') || wizard.querySelector('.wizard-workspace > .journey-panel.active .bid-response-document');
        if (!documentNode) return '';
        const clone = documentNode.cloneNode(true);
        clone.querySelectorAll('.bid-status-chip.editable').forEach(node => node.remove());
        clone.querySelectorAll('.bid-review-edit-button').forEach(button => {
            button.remove();
        });
        return clone.outerHTML;
    };

    const buildBidResponseDocumentExportHtml = (documentHtml = '') => {
        const title = `${tender.title || 'Bid Submission Review'} - ${tenderId}`;
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeBidWorkspaceHtml(title)}</title>
<style>
body { margin: 0; padding: 32px; background: #eef2f7; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
.bid-response-document { max-width: 980px; margin: 0 auto; padding: 46px 52px 34px; border: 1px solid #cbd5e1; background: #fff; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14); }
.bid-response-document-masthead { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 2px solid #071a33; }
.bid-response-document-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 4px; background: #071a33; color: #fff; font-weight: 900; }
.bid-response-document-masthead span, .section-kicker, .bid-response-document-meta span { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.bid-response-document-masthead strong { display: block; color: #071a33; font-size: 18px; }
.bid-response-document-masthead em { justify-self: end; color: #475569; font-size: 11px; font-style: normal; font-weight: 800; text-transform: uppercase; }
.bid-response-document-cover { display: flex; justify-content: space-between; gap: 22px; padding: 24px 0 20px; border-bottom: 1px solid #cbd5e1; }
.bid-response-document-cover h3 { margin: 0; color: #071a33; font-size: 28px; line-height: 1.16; }
.bid-response-document-cover p { margin: 8px 0 0; color: #475569; line-height: 1.5; }
.bid-response-document-status { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.bid-status-chip { display: inline-flex; align-items: center; width: max-content; min-height: 24px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
.bid-status-chip.review { background: #dbeafe; color: #1e40af; }
.bid-status-chip.offer { background: #e0f2fe; color: #075985; }
.bid-response-document-meta { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #cbd5e1; margin: 24px 0; }
.bid-response-document-meta article { padding: 15px 16px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
.bid-response-document-meta strong { display: block; margin-top: 6px; color: #071a33; font-size: 16px; }
.bid-response-document-meta em { display: block; margin-top: 4px; color: #94a3b8; font-size: 12px; font-style: normal; }
.bid-completeness-summary { display: grid; gap: 10px; padding: 14px; border: 1px solid #bbf7d0; background: #f0fdf4; }
.bid-completeness-summary strong { display: block; margin-top: 4px; color: #0d7c3d; font-size: 28px; line-height: 1; }
.bid-completeness-summary p { margin: 6px 0 0; color: #334155; font-size: 13px; }
.bid-completeness-meter { overflow: hidden; height: 8px; border-radius: 999px; background: #dcfce7; }
.bid-completeness-meter span { display: block; height: 100%; border-radius: inherit; background: #0d7c3d; }
.bid-action-summary, .bid-financial-summary { margin: 18px 0; }
.bid-action-priority { display: inline-flex; align-items: center; min-height: 22px; padding: 4px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.bid-action-priority.high { background: #fff1f1; color: #b00020; }
.bid-action-priority.medium { background: #fff8e1; color: #7a4d00; }
.bid-action-priority.low { background: #f1f5f9; color: #475569; }
.bid-review-positive-note, .bid-review-warning-note { margin: 14px 0 0; padding: 12px 14px; border-radius: 8px; font-size: 13px; line-height: 1.45; }
.bid-review-positive-note { border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534; }
.bid-review-warning-note { border: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; }
.bid-financial-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.bid-financial-summary-grid article { min-height: 74px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
.bid-financial-summary-grid span { display: block; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.bid-financial-summary-grid strong { display: block; margin-top: 8px; color: #0f172a; font-size: 14px; line-height: 1.3; }
.financial-review-section { display: grid; gap: 18px; width: 100%; max-width: 100%; padding: 18px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
.bid-response-document-table.financial-review-table-shell { overflow: visible; border: 0; }
.financial-review-copy { display: grid; gap: 4px; }
.financial-review-copy strong { color: #0f172a; font-size: 18px; }
.financial-review-copy span { color: #64748b; font-size: 13px; line-height: 1.5; }
.summary-grid.financial-review-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.summary-card.financial-review-summary-card { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 12px; align-items: center; min-width: 0; padding: 14px; border: 1px solid #dbe7e4; border-radius: 10px; background: #fff; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
.financial-review-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 999px; background: #e0f7f1; color: #047857; font-size: 13px; font-weight: 900; }
.financial-review-summary-card small { display: block; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.financial-review-summary-card strong { display: block; margin-top: 5px; color: #0f172a; font-size: 16px; line-height: 1.25; }
.financial-review-status-text { display: inline-flex; width: max-content; max-width: 100%; margin-top: 8px; padding: 4px 8px; border-radius: 999px; font-size: 10px; font-style: normal; font-weight: 800; line-height: 1; }
.financial-review-status-text.complete { background: #dcfce7; color: #166534; }
.financial-review-status-text.pending { background: #fff7ed; color: #9a3412; }
.financial-review-status-text.neutral { background: #f1f5f9; color: #475569; }
.financial-review-block { display: grid; gap: 10px; min-width: 0; }
.financial-review-block h5 { margin: 0; color: #0f172a; font-size: 14px; }
.financial-review-compact-table { width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #e2e8f0; background: #fff; }
.financial-review-compact-table th, .financial-review-compact-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; text-align: left; vertical-align: top; }
.financial-review-compact-table th { background: #f8fafc; color: #0f172a; font-size: 11px; font-weight: 900; text-transform: uppercase; }
.financial-cost-breakdown-table td:last-child, .financial-boq-summary-table td:last-child { color: #0f172a; font-weight: 800; }
.financial-cost-breakdown-table .is-total-row td { background: #e0f7f1; color: #064e3b; font-weight: 900; }
.view-full-boq-button { justify-self: start; min-height: 38px; padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #0f172a; font-weight: 800; }
.financial-full-boq-panel[hidden] { display: none !important; }
.financial-full-boq-table th, .financial-full-boq-table td { font-size: 11px; padding: 8px; }
@media (max-width: 980px) { .summary-grid.financial-review-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .summary-grid.financial-review-summary-grid { grid-template-columns: 1fr; } .financial-review-section { padding: 14px; } .financial-review-compact-table th, .financial-review-compact-table td { padding: 8px; font-size: 12px; } }
.bid-response-document-sections { display: grid; gap: 22px; }
.bid-response-document-section-heading { display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
.bid-response-document-section-heading > span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 4px; background: #071a33; color: #fff; font-size: 12px; font-weight: 900; }
.bid-response-document-section-heading h4 { margin: 0; color: #071a33; font-size: 17px; }
.bid-response-document-section-heading small { color: #64748b; font-size: 12px; }
.bid-response-document-table { overflow-x: auto; margin-top: 14px; border: 1px solid #e2e8f0; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 13px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; font-size: 14px; line-height: 1.4; }
th { background: #f1f5f9; color: #334155; font-size: 12px; font-weight: 800; text-transform: uppercase; }
td strong { display: block; color: #0f172a; }
td small { display: block; margin-top: 4px; color: #64748b; font-size: 12px; line-height: 1.35; }
.license-permit-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 220px; }
.license-permit-cell strong { color: #0f172a; font-size: 14px; font-weight: 900; line-height: 1.25; }
.license-permit-cell small { margin-top: 0; color: #475569; font-size: 12px; line-height: 1.35; }
.license-permit-cell small span { display: block; margin-bottom: 2px; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.bid-requirement-marker, .bid-deviation-marker { display: inline-flex; width: max-content; max-width: 100%; min-height: 22px; margin: 0 5px 5px 0; padding: 4px 7px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.required-complete { background: #e8f5e9; color: #0d7c3d; }
.required-incomplete { background: #fff1f1; color: #b00020; }
.optional-complete { background: #e0f2fe; color: #075985; }
.optional-empty { background: #f1f5f9; color: #64748b; }
.bid-deviation-marker { background: #fff8e1; color: #7a4d00; }
.is-incomplete td { background: #fffafa; }
.is-deviation td { background: #fffbeb; }
.bid-file-manifest code { white-space: normal; overflow-wrap: anywhere; color: #334155; font-size: 12px; }
.bid-review-readonly { display: inline-flex; align-items: center; min-height: 28px; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.bid-response-document-footer { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 14px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
@page { size: A4 portrait; margin: 16mm; }
@media print { body { padding: 0; background: #fff; } .bid-response-document { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; border: 0; } .bid-response-download-panel, .bid-review-edit-button, .bid-status-chip.editable, .no-print, button, .view-full-boq-button, .edit-button, .action-column { display: none !important; } .financial-review-section { width: 100%; max-width: 100%; box-shadow: none; border: 1px solid #ddd; background: #fff; break-inside: avoid; page-break-inside: avoid; } .summary-grid.financial-review-summary-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } .summary-card.financial-review-summary-card, .bid-response-document-section, .bid-deviation-log, .bid-file-manifest, table, tr { break-inside: avoid; page-break-inside: avoid; box-shadow: none; } .bid-response-document-table { overflow: visible; } table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; } th, td, .financial-review-compact-table th, .financial-review-compact-table td { word-wrap: break-word; overflow-wrap: anywhere; padding: 6px; font-size: 11px; } }
</style>
</head>
<body>${documentHtml}</body>
</html>`;
    };

    const getStoredSubmittedBids = () => {
        try {
            const current = JSON.parse(localStorage.getItem(bidWorkspaceSubmittedStorageKey) || '[]');
            const legacy = JSON.parse(localStorage.getItem(bidWorkspaceLegacySubmittedStorageKey) || '[]');
            return [
                ...(Array.isArray(current) ? current : []),
                ...(Array.isArray(legacy) ? legacy : [])
            ];
        } catch (error) {
            return [];
        }
    };

    const saveStoredSubmittedBids = (items = []) => {
        localStorage.setItem(bidWorkspaceSubmittedStorageKey, JSON.stringify(items));
    };

    const isBidWorkspaceBeforeClosing = () => {
        const timestamp = Date.parse(tender.closingDate || tender.deadline || '');
        return Number.isFinite(timestamp) && Date.now() < timestamp;
    };

    const withdrawSubmittedBid = () => {
        saveStoredSubmittedBids(getStoredSubmittedBids().filter(item => item.tenderId !== tenderId));
        if (finalStatus) finalStatus.textContent = 'Draft until submitted';
        const receiptPanel = panels[panels.length - 1];
        if (receiptPanel) {
            receiptPanel.innerHTML = `
                <div class="panel-heading"><div><span class="section-kicker">Submission withdrawn</span><h2>Draft reopened</h2></div><span class="badge badge-warning">Withdrawn</span></div>
                <section class="bid-submission-confirmation">
                    <div class="bid-submission-confirmation-mark">OK</div>
                    <div>
                        <span class="section-kicker">Pre-deadline withdrawal</span>
                        <h3>Your local submitted bid record was withdrawn</h3>
                        <p>You can update the draft and submit again before the tender closing date.</p>
                    </div>
                    <div class="inline-actions">
                        <button class="btn btn-primary" type="button" data-bid-jump-submit>Return to submission</button>
                    </div>
                </section>
            `;
        }
        setActiveStep(Math.max(Number(wizard.dataset.bidReviewStepIndex || panels.length - 2), 0), true);
        saveDraft();
    };

    const renderBidSubmissionConfirmation = (receipt = {}) => `
        <div class="panel-heading">
            <div><span class="section-kicker">Step ${panels.length}</span><h2>Submission Receipt</h2></div>
            <span class="badge badge-success">Submitted</span>
        </div>
        <section class="bid-submission-confirmation">
            <div class="bid-submission-confirmation-mark">OK</div>
            <div>
                <span class="section-kicker">Bid submitted successfully</span>
                <h3>Submission receipt</h3>
                <p>Your bid is sealed and cannot be modified after submission. Use the Communication Center for any formal modification or withdrawal request before the tender closing rules allow it.</p>
            </div>
            <div class="record-summary">
                <div><span>Tender</span><strong>${escapeBidWorkspaceHtml(receipt.tenderId || tenderId)}</strong></div>
                <div><span>Submitted</span><strong>${escapeBidWorkspaceHtml(receipt.submittedAtLabel || '')}</strong></div>
                <div><span>Submission Receipt No</span><strong>${escapeBidWorkspaceHtml(receipt.receiptHash || '')}</strong></div>
                <div><span>Bid total</span><strong>${escapeBidWorkspaceHtml(receipt.total || '')}</strong></div>
                <div><span>Files</span><strong>${receipt.fileCount || 0} document${receipt.fileCount === 1 ? '' : 's'} uploaded</strong></div>
                <div><span>Completeness</span><strong>${receipt.completeness?.percent || 0}%</strong></div>
            </div>
            <div class="inline-actions">
                <button class="btn btn-secondary" type="button" data-bid-download-review-document>Download Bid Record</button>
                <button class="btn btn-secondary" type="button" data-bid-print-review-document>Print Submission Receipt</button>
                ${isBidWorkspaceBeforeClosing() ? '<button class="btn btn-secondary" type="button" data-bid-withdraw-submission>Withdraw Submission</button>' : ''}
                <button class="btn btn-primary" type="button" data-navigate="workspace-dashboard">Return to Dashboard</button>
            </div>
        </section>
        <section class="bid-response-review" data-bid-response-review>
            ${renderProcurexBidPackageDocument({
                tender: { ...tender, reference: tenderId },
                profile,
                sections: receipt.reviewSections || [],
                supplier: {
                    name: mockData.users?.supplier?.organization || 'Supplier organization',
                    contact: mockData.users?.supplier?.name || '',
                    submittedAt: receipt.submittedAtLabel || '',
                    receiptHash: receipt.receiptHash || '',
                    total: receipt.total || '',
                    status: 'Submitted'
                },
                editable: false,
                includeActions: true,
                fileManifest: receipt.fileManifest || [],
                completeness: receipt.completeness,
                documentLabel: 'Submitted Review Copy',
                actionsTitle: 'Sealed bid review record',
                actionsDescription: 'Download or print the sealed supplier bid submission review and receipt.',
                description: 'System-generated bid record captured at submission with response status, deviations, and uploaded evidence integrity metadata.'
            })}
        </section>
    `;

    const downloadBidResponseDocument = (trigger) => {
        const documentHtml = getExportableBidResponseDocument(trigger);
        if (!documentHtml) return;
        const filename = `${getBidWorkspaceSafeFilename(`${tenderId}-${tender.title || 'bid-submission-review'}`)}.html`;
        downloadBidWorkspaceBlob(buildBidResponseDocumentExportHtml(documentHtml), filename);
    };

    const printBidResponseDocument = (trigger) => {
        const documentHtml = getExportableBidResponseDocument(trigger);
        if (!documentHtml) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Allow pop-ups to print or save the bid response document as PDF.');
            return;
        }
        printWindow.document.open();
        printWindow.document.write(buildBidResponseDocumentExportHtml(documentHtml));
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 250);
    };

    const importTendererTechnicalResponseCsv = (fileInput) => {
        const file = fileInput.files?.[0];
        const status = wizard.querySelector('[data-bid-import-tenderer-csv-status]');
        if (!file) return;
        const setStatus = (message, type = 'info') => {
            if (!status) return;
            status.textContent = message;
            status.dataset.status = type;
        };
        const reader = new FileReader();
        reader.onload = () => {
            const rows = parseBidWorkspaceCsv(reader.result || '');
            const headers = rows[0] || [];
            const normalizedHeaders = headers.map(normalizeBidWorkspaceCsvHeader);
            const requiredHeaders = ['itemno', 'requestedproduct', 'compliancestatus', 'supplierofferedspecification'];
            const hasRequiredShape = requiredHeaders.every(header => normalizedHeaders.includes(header))
                || (normalizedHeaders.includes('itemno') && normalizedHeaders.includes('buyerrequirement') && normalizedHeaders.includes('compliancestatus'));
            if (!hasRequiredShape) {
                setStatus('CSV rejected: use the downloaded tenderer technical response template.', 'error');
                fileInput.value = '';
                return;
            }

            const getCell = (row, header) => row[normalizedHeaders.indexOf(header)] || '';
            const template = normalizeBidWorkspaceProductSpecificationTemplate(tender);
            const itemGroups = groupBidWorkspaceProductSpecRowsByItem(template.rows);
            let imported = 0;
            rows.slice(1).forEach((row, index) => {
                const templateRow = template.rows[index];
                if (!templateRow) return;
                const compliance = getCell(row, 'compliancestatus');
                const offeredSpec = getCell(row, 'supplierofferedspecification');
                const evidenceFile = getCell(row, 'supportingevidencefile');
                const remarks = getCell(row, 'remarks');
                const rowNode = wizard.querySelector(`[data-bid-product-spec-row="${CSS.escape(templateRow.id)}"]`);
                const complianceInput = rowNode?.querySelector('[data-bid-product-spec-field="complianceStatus"]');
                if (complianceInput && /not/i.test(compliance)) {
                    complianceInput.value = 'Not Compliant';
                    imported += 1;
                } else if (complianceInput && /comply|compliant|yes/i.test(compliance)) {
                    complianceInput.value = 'Compliant';
                    imported += 1;
                }
                const group = itemGroups.find(item => (item.rows || []).some(groupRow => groupRow.id === templateRow.id));
                const offeredInput = group ? wizard.querySelector(`[data-bid-response="${CSS.escape(getBidWorkspaceProductSpecItemResponseId(group, 'short-specification'))}"]`) : null;
                if (offeredInput && (offeredSpec || remarks)) {
                    offeredInput.value = [offeredSpec, remarks].filter(Boolean).join('\n');
                    imported += 1;
                }
                const evidenceInput = group ? wizard.querySelector(`[data-bid-response="${CSS.escape(getBidWorkspaceProductSpecItemResponseId(group, 'attachment'))}"]`) : null;
                if (evidenceInput && evidenceFile) {
                    evidenceInput.value = evidenceFile;
                    imported += 1;
                }
            });
            if (!imported) {
                setStatus('CSV parsed, but no matching specification rows were found.', 'warning');
                fileInput.value = '';
                return;
            }
            setStatus(`Imported ${imported} response field${imported === 1 ? '' : 's'} from CSV.`, 'success');
            validateWorkflowResponses(false);
            validateSemanticResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
            fileInput.value = '';
        };
        reader.onerror = () => {
            setStatus('CSV import failed. Select the template again and retry.', 'error');
            fileInput.value = '';
        };
        reader.readAsText(file);
    };

    const refreshBidResponseReviews = () => {
        panels.forEach(panel => {
            const review = panel.querySelector('[data-bid-response-review]');
            if (!review) return;
            review.innerHTML = renderBidReviewSections(collectBidReviewSections(panel));
        });
    };

    const setActiveStep = (index, force = false) => {
        if (usesMandatoryGate && index > 0 && !force && !validateMandatoryGate(true)) {
            activeStepIndex = 0;
        } else {
            activeStepIndex = Math.min(Math.max(index, 0), panels.length - 1);
        }
        panels.forEach((panel, panelIndex) => {
            const active = panelIndex === activeStepIndex;
            panel.classList.toggle('active', active);
            panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
        railSteps.forEach((step) => {
            const stepIndex = Number(step.dataset.bidStepIndex);
            const active = stepIndex === activeStepIndex;
            step.classList.toggle('active', active);
            step.classList.toggle('completed', stepIndex < activeStepIndex);
            step.setAttribute('aria-current', active ? 'step' : 'false');
        });
        wizard.style.setProperty('--wizard-progress-ratio', panels.length > 1 ? String(activeStepIndex / (panels.length - 1)) : '1');
        if (previousButton) previousButton.disabled = activeStepIndex === 0;
        if (nextButton) {
            nextButton.hidden = activeStepIndex === panels.length - 1;
            nextButton.disabled = usesMandatoryGate && activeStepIndex === 0 && !validateMandatoryGate(false);
        }
        refreshBidProgress();
        if (stepTitleOutput) stepTitleOutput.textContent = railSteps.find(step => Number(step.dataset.bidStepIndex) === activeStepIndex)?.querySelector('span')?.textContent || '';
        refreshBidResponseReviews();
        saveDraft();
    };

    const refreshBidTotals = () => {
        let total = 0;
        wizard.querySelectorAll('[data-bid-commercial-body] tr').forEach((row) => {
            const rateInput = row.querySelector('[data-bid-rate]');
            if (!rateInput) return;
            if (isBidWorkspaceCommercialLineNotBid(row)) {
                const output = row.querySelector('[data-bid-line-amount]');
                if (output) output.textContent = formatBidWorkspaceMoney(0);
                return;
            }
            if (row.matches('[data-works-boq-row]')) {
                const detailRow = row.nextElementSibling?.classList.contains('works-cost-detail-row') ? row.nextElementSibling : null;
                const costScope = detailRow || row;
                const getCost = (suffix) => parseBidWorkspaceNumber(costScope?.querySelector(`[data-bid-response$="${suffix}"]`)?.value);
                const directCost = getCost('-labor') + getCost('-material') + getCost('-equipment') + getCost('-overheads');
                const profit = getCost('-profit');
                const qtyInput = row.querySelector('[data-bid-line-qty]');
                const worksQty = parseBidWorkspaceNumber(qtyInput?.value || qtyInput?.textContent || row.children[2]?.textContent || '1') || 1;
                const lineTotal = Math.round(directCost * (1 + (profit / 100)));
                const unitRate = Math.round(lineTotal / worksQty);
                rateInput.value = unitRate;
                const unitOutput = row.querySelector('[data-works-unit-rate]');
                if (unitOutput) {
                    const hidden = rateInput;
                    unitOutput.textContent = formatBidWorkspaceMoney(unitRate);
                    unitOutput.appendChild(hidden);
                }
            }
            const rate = parseBidWorkspaceNumber(rateInput.value);
            const qtyInput = row.querySelector('[data-bid-line-qty]');
            const qty = parseBidWorkspaceNumber(qtyInput?.value || qtyInput?.textContent || row.children[2]?.textContent || '1') || 1;
            const extraCost = Array.from(row.querySelectorAll('[data-bid-line-extra-cost]'))
                .reduce((sum, input) => sum + parseBidWorkspaceNumber(input.value), 0);
            const amount = (rate * qty) + extraCost;
            total += amount;
            const output = row.querySelector('[data-bid-line-amount]');
            if (output) output.textContent = formatBidWorkspaceMoney(amount);
        });
        wizard.querySelector('[data-bid-total]')?.replaceChildren(document.createTextNode(formatBidWorkspaceMoney(total)));
        wizard.querySelector('[data-bid-review-total]')?.replaceChildren(document.createTextNode(formatBidWorkspaceMoney(total)));
    };

    const storeSubmittedBid = () => {
        const submitted = getStoredSubmittedBids();
        const hash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
        const draftSnapshot = collectDraft();
        const compactUploads = Object.fromEntries(Object.entries(draftSnapshot.uploadedFiles || {}).map(([key, file]) => [key, {
            name: file?.name || '',
            type: file?.type || '',
            size: file?.size || 0,
            uploadedAt: file?.uploadedAt || '',
            sha256: file?.sha256 || file?.hash || ''
        }]));
        const submittedAt = new Date().toISOString();
        const procurementType = profile.id || getBidWorkspaceTypeId(tender);
        const consultancySelectionMethod = String(tender.requirements?.fields?.consultancySelectionMethod || tender.selectionMethod || '').trim();
        const sealedFinancialEnvelope = procurementType === 'consultancy' && (/qcbs|quality|technical/i.test(consultancySelectionMethod) || !consultancySelectionMethod);
        const bid = {
            tenderId,
            submittedAt,
            receiptHash: hash,
            supplier: mockData.users?.supplier?.organization || 'Supplier organization',
            procurementType,
            steps: ['Administrative Compliance', 'Technical Response', 'Financial Offer', 'Declarations', 'Annex Evidence Manifest'],
            envelopeControl: {
                technicalCanOpenFirst: sealedFinancialEnvelope,
                financialLockedUntilTechnicalEvaluation: sealedFinancialEnvelope
            },
            draft: {
                ...draftSnapshot,
                uploadedFiles: compactUploads,
                fileManifest: getBidFileManifest()
            }
        };
        saveStoredSubmittedBids([bid, ...submitted.filter(item => item.tenderId !== tenderId)]);
        if (finalStatus) finalStatus.textContent = 'Submitted and sealed';
        return {
            receiptHash: hash,
            submittedAt,
            submittedAtLabel: new Date(submittedAt).toLocaleString(),
            tenderId,
            total: draftSnapshot.total || wizard.querySelector('[data-bid-review-total]')?.textContent || '',
            fileCount: getBidFileManifest().length,
            fileManifest: getBidFileManifest(),
            reviewSections: draftSnapshot.reviewSections || [],
            completeness: draftSnapshot.completeness || getProcurexBidPackageCompleteness(draftSnapshot.reviewSections || [])
        };
    };

    pageRoot.addEventListener('click', (event) => {
        const railStep = event.target?.closest('[data-bid-step-index]');
        if (railStep) {
            event.preventDefault();
            const requestedStep = Number(railStep.dataset.bidStepIndex);
            if (requestedStep > activeStepIndex) {
                if (usesMandatoryGate && activeStepIndex === 0 && !validateMandatoryGate(true)) {
                    const incompleteGateInput = Array.from(getMandatoryGateRoot().querySelectorAll('[data-bid-required-response]')).find(input => !isResponseComplete(input));
                    const card = incompleteGateInput?.closest('[data-bid-requirement-card]');
                    const status = incompleteGateInput?.closest('select') ? ' (License status)' : incompleteGateInput?.type === 'checkbox' ? ' (Confirmation)' : ' (Document upload)';
                    const fieldLabel = card?.querySelector('h3')?.textContent || 'Required field';
                    console.warn('Incomplete field:', fieldLabel, incompleteGateInput);
                    alert(`Complete all mandatory eligibility requirements before continuing.\n\nIncomplete: ${fieldLabel}${status}`);
                    focusBidWorkspaceInput(incompleteGateInput);
                    return;
                }
                if (activeStepIndex > 0 || !usesMandatoryGate) {
                    const panelValidation = validatePanelWorkflowResponses(activeStepIndex, true);
                    if (!panelValidation.valid) {
                        alert(`Complete ${panelValidation.remaining} required response${panelValidation.remaining === 1 ? '' : 's'} in this section before continuing.`);
                        focusBidWorkspaceInput(panelValidation.firstIncomplete);
                        return;
                    }
                    refreshBidTotals();
                    const semanticValidation = validateSemanticResponses(true, panels[activeStepIndex] || wizard);
                    if (!semanticValidation.valid) {
                        alert(semanticValidation.messages[0] || 'Correct the highlighted bid values before continuing.');
                        focusBidWorkspaceInput(semanticValidation.firstIncomplete);
                        return;
                    }
                }
            }
            setActiveStep(requestedStep);
            return;
        }

        const target = event.target?.closest('button');
        if (!target) return;

        if (target.matches('[data-bid-prev]')) {
            setActiveStep(activeStepIndex - 1);
            return;
        }

        if (target.matches('[data-bid-next]')) {
            if (usesMandatoryGate && activeStepIndex === 0 && !validateMandatoryGate(true)) {
                const incompleteGateInput = Array.from(getMandatoryGateRoot().querySelectorAll('[data-bid-required-response]')).find(input => !isResponseComplete(input));
                const card = incompleteGateInput?.closest('[data-bid-requirement-card]');
                const status = incompleteGateInput?.closest('select') ? ' (License status)' : incompleteGateInput?.type === 'checkbox' ? ' (Confirmation)' : ' (Document upload)';
                const fieldLabel = card?.querySelector('h3')?.textContent || 'Required field';
                console.warn('Incomplete field:', fieldLabel, incompleteGateInput);
                alert(`Complete all mandatory eligibility requirements before continuing.\n\nIncomplete: ${fieldLabel}${status}`);
                focusBidWorkspaceInput(incompleteGateInput);
                return;
            }
            if (activeStepIndex > 0 || !usesMandatoryGate) {
                const panelValidation = validatePanelWorkflowResponses(activeStepIndex, true);
                if (!panelValidation.valid) {
                    alert(`Complete ${panelValidation.remaining} required response${panelValidation.remaining === 1 ? '' : 's'} in this section before continuing.`);
                    focusBidWorkspaceInput(panelValidation.firstIncomplete);
                    return;
                }
                refreshBidTotals();
                const semanticValidation = validateSemanticResponses(true, panels[activeStepIndex] || wizard);
                if (!semanticValidation.valid) {
                    alert(semanticValidation.messages[0] || 'Correct the highlighted bid values before continuing.');
                    focusBidWorkspaceInput(semanticValidation.firstIncomplete);
                    return;
                }
            }
            setActiveStep(activeStepIndex + 1);
            return;
        }

        if (target.matches('[data-bid-jump-submit]')) {
            setActiveStep(Math.max(Number(wizard.dataset.bidReviewStepIndex || panels.length - 2), 0));
            return;
        }

        if (target.matches('[data-bid-view-tender-detail]')) {
            if (typeof selectProcurexTender === 'function') selectProcurexTender(tenderId);
            const targetUrl = `${window.location.pathname || 'index.html'}#tender-detail`;
            window.open?.(targetUrl, '_blank', 'noopener');
            return;
        }

        if (target.matches('[data-bid-ask-clarification]')) {
            localStorage.setItem('procurex.supplierClarificationContext.v1', JSON.stringify({
                tenderId,
                category: target.dataset.clarificationCategory || 'Technical',
                context: target.dataset.clarificationContext || 'Bid workspace clarification',
                createdAt: new Date().toISOString()
            }));
            if (typeof selectProcurexTender === 'function') selectProcurexTender(tenderId);
            window.app?.navigateTo?.('tender-detail');
            return;
        }

        if (target.matches('[data-bid-save-draft]')) {
            saveDraft();
            alert('Bid draft saved for later review.');
            return;
        }

        if (target.matches('[data-bid-view-upload]')) {
            viewBidUpload(target.closest('[data-bid-upload-control]'));
            return;
        }

        if (target.matches('[data-bid-delete-upload]')) {
            clearBidUpload(target.closest('[data-bid-upload-control]'));
            validateMandatoryGate(false);
            validateWorkflowResponses(false);
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (target.matches('[data-add-similar-project]')) {
            const list = wizard.querySelector('[data-works-similar-project-list]');
            if (!list) return;
            const existingIndexes = Array.from(list.querySelectorAll('[data-bid-response]'))
                .map(input => /^works-similar-projects-document-(\d+)$/.exec(input.dataset.bidResponse || ''))
                .filter(Boolean)
                .map(match => Number(match[1]))
                .filter(Number.isFinite);
            const nextIndex = existingIndexes.length ? Math.max(...existingIndexes) + 1 : 0;
            list.insertAdjacentHTML('beforeend', renderWorksBidSimilarProjectUploadCard(nextIndex, {}, false));
            const addedCard = list.querySelector('[data-works-similar-project-card]:last-child');
            const uploadControl = addedCard?.querySelector('[data-bid-upload-control]');
            updateBidUploadControlState(uploadControl);
            uploadControl?.querySelector('[data-bid-file-input]')?.focus?.();
            validateWorkflowResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (target.matches('[data-delete-similar-project-slot]')) {
            const card = target.closest('[data-works-similar-project-card]');
            const list = card?.closest('[data-works-similar-project-list]');
            if (!card || !list) return;
            const remainingCards = list.querySelectorAll('[data-works-similar-project-card]').length;
            if (remainingCards <= 1) {
                alert('Keep at least one similar project upload slot.');
                return;
            }
            const uploadControl = card.querySelector('[data-bid-upload-control]');
            if (uploadControl) clearBidUpload(uploadControl);
            card.remove();
            validateWorkflowResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (target.matches('[data-add-personnel]')) {
            const list = wizard.querySelector('[data-works-personnel-list]');
            if (!list) return;
            const existingIndexes = Array.from(list.querySelectorAll('[data-bid-response]'))
                .map(input => /^works-personnel-(\d+)-(position|cv)$/.exec(input.dataset.bidResponse || ''))
                .filter(Boolean)
                .map(match => Number(match[1]))
                .filter(Number.isFinite);
            const nextIndex = existingIndexes.length ? Math.max(...existingIndexes) + 1 : 0;
            list.insertAdjacentHTML('beforeend', renderWorksBidPersonnelUploadCard(nextIndex, {}, false));
            const addedCard = list.querySelector('[data-works-personnel-card]:last-child');
            addedCard?.querySelector('[data-bid-response]')?.focus?.();
            addedCard?.querySelectorAll('[data-bid-upload-control]').forEach(updateBidUploadControlState);
            validateWorkflowResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (target.matches('[data-delete-personnel-slot]')) {
            const card = target.closest('[data-works-personnel-card]');
            const list = card?.closest('[data-works-personnel-list]');
            if (!card || !list) return;
            const remainingCards = list.querySelectorAll('[data-works-personnel-card]').length;
            if (remainingCards <= 1) {
                alert('Keep at least one personnel slot.');
                return;
            }
            const uploadControl = card.querySelector('[data-bid-upload-control]');
            if (uploadControl) clearBidUpload(uploadControl);
            card.remove();
            validateWorkflowResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (target.matches('[data-bid-review-edit]')) {
            openBidReviewSource(target.dataset.bidReviewEdit || '');
            return;
        }

        if (target.matches('[data-bid-download-review-document]')) {
            downloadBidResponseDocument(target);
            return;
        }

        if (target.matches('[data-bid-print-review-document]')) {
            printBidResponseDocument(target);
            return;
        }

        if (target.matches('[data-bid-toggle-full-boq]')) {
            const section = target.closest('.financial-review-section');
            const panel = section?.querySelector('[data-financial-full-boq]');
            if (!panel) return;
            const shouldOpen = panel.hidden;
            panel.hidden = !shouldOpen;
            target.textContent = shouldOpen ? 'Hide Full BOQ Breakdown' : 'View Full BOQ Breakdown';
            return;
        }

        if (target.matches('[data-bid-download-product-spec-template]')) {
            downloadBidWorkspaceProductSpecificationCsv(tender);
            return;
        }

        if (target.matches('[data-bid-download-tenderer-csv-template]')) {
            downloadBidWorkspaceTendererTechnicalResponseCsv(tender);
            return;
        }

        if (target.matches('[data-bid-withdraw-submission]')) {
            if (!isBidWorkspaceBeforeClosing()) {
                alert('This bid can no longer be withdrawn because the tender closing date has passed.');
                return;
            }
            withdrawSubmittedBid();
            return;
        }

        if (target.matches('[data-bid-submit]')) {
            if (usesMandatoryGate && !validateMandatoryGate(true)) {
                setActiveStep(0, true);
                return;
            }
            const workflowValidation = validateWorkflowResponses(true);
            if (!workflowValidation.valid) {
                const firstIncompletePanelIndex = panels.findIndex(panel => panel.contains(workflowValidation.firstIncomplete));
                setActiveStep(firstIncompletePanelIndex > -1 ? firstIncompletePanelIndex : 1, true);
                alert(`Complete ${workflowValidation.remaining} required response${workflowValidation.remaining === 1 ? '' : 's'} before submitting.`);
                focusBidWorkspaceInput(workflowValidation.firstIncomplete);
                return;
            }
            refreshBidTotals();
            const semanticValidation = validateSemanticResponses(true);
            if (!semanticValidation.valid) {
                const firstInvalidPanelIndex = panels.findIndex(panel => panel.contains(semanticValidation.firstIncomplete));
                setActiveStep(firstInvalidPanelIndex > -1 ? firstInvalidPanelIndex : 1, true);
                alert(semanticValidation.messages[0] || 'Correct the highlighted bid values before submitting.');
                focusBidWorkspaceInput(semanticValidation.firstIncomplete);
                return;
            }
            const declaration = wizard.querySelector('[data-bid-declaration]');
            if (declaration && !declaration.checked) {
                alert('Confirm the bid declaration before submitting.');
                return;
            }
            const submissionReceipt = storeSubmittedBid();
            const receiptHashValue = submissionReceipt.receiptHash;
            window.addProcurexCommunicationItem?.({
                kind: 'notification',
                category: 'Bid Submission',
                subject: 'Bid Submitted Successfully',
                body: `Your sealed bid for ${tenderId} has been submitted successfully. Submission Receipt No: ${receiptHashValue}.`,
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientType: 'User',
                recipientName: mockData.users?.current?.organization || mockData.users?.supplier?.organization || 'Supplier organization',
                tenderId,
                tenderReference: tenderId,
                tenderTitle: tender?.title || 'Tender',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionLabel: 'View Submission',
                actionPage: 'bidding-workspace',
                audience: ['user', 'all']
            });
            window.addProcurexCommunicationItem?.({
                kind: 'notification',
                category: 'Bid Submission',
                subject: 'New Bid Received',
                body: `${mockData.users?.current?.organization || mockData.users?.supplier?.organization || 'A tenderer'} has submitted a sealed bid for ${tenderId}. Bid details remain locked until the configured opening time.`,
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientType: 'User',
                recipientName: tender?.organization || 'Tender owner',
                tenderId,
                tenderReference: tenderId,
                tenderTitle: tender?.title || 'Tender',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionLabel: 'Open Evaluation',
                actionPage: 'bid-evaluation',
                audience: ['user', 'admin', 'all']
            });
            saveDraft();
            setActiveStep(panels.length - 1, true);
            const receiptPanel = panels[panels.length - 1];
            if (receiptPanel) {
                receiptPanel.innerHTML = renderBidSubmissionConfirmation(submissionReceipt);
            }
        }
    });

    wizard.addEventListener('input', (event) => {
        if (event.target?.matches('[data-bid-rate], [data-works-cost], [data-bid-line-qty], [data-bid-line-extra-cost]')) refreshBidTotals();
        if (event.target?.matches('[data-bid-response], [data-bid-free-response], [data-bid-product-spec-field]')) {
            if (event.target?.matches('[data-bid-line-status]')) refreshBidTotals();
            validateMandatoryGate(false);
            validateWorkflowResponses(false);
            validateSemanticResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
        }
    });

    wizard.addEventListener('change', (event) => {
        if (event.target?.matches('[data-bid-import-tenderer-csv]')) {
            importTendererTechnicalResponseCsv(event.target);
            return;
        }

        if (event.target?.matches('[data-bid-file-input]')) {
            const uploadControl = event.target.closest('[data-bid-upload-control]');
            const hiddenInput = uploadControl?.querySelector('[data-bid-response]');
            const fileNameOutput = uploadControl?.querySelector('[data-bid-file-name]');
            const file = event.target.files?.[0] || null;
            const fileName = file?.name || '';
            if (hiddenInput) hiddenInput.value = fileName;
            if (fileNameOutput) fileNameOutput.textContent = fileName ? `Selected: ${fileName}` : 'No file selected yet.';
            if (file && hiddenInput?.dataset.bidResponse) {
                storeBidUploadPreview(hiddenInput.dataset.bidResponse, file);
            } else {
                clearBidUpload(uploadControl);
            }
            updateBidUploadControlState(uploadControl);
            validateMandatoryGate(false);
            validateWorkflowResponses(false);
            validateSemanticResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (event.target?.matches('[data-bid-response], [data-bid-free-response], [data-bid-product-spec-field]')) {
            if (event.target?.matches('[data-bid-security-toggle]')) syncBidSecurityUploadPanel();
            if (event.target?.matches('[data-bid-response="consultancy-submission-type"]')) syncConsultancySubmissionModePanels();
            if (event.target?.matches('[data-bid-line-status]')) refreshBidTotals();
            validateMandatoryGate(false);
            validateWorkflowResponses(false);
            validateSemanticResponses(false);
            refreshBidProgress();
            refreshBidResponseReviews();
            saveDraft();
        }
    });

    refreshBidTotals();
    syncBidSecurityUploadPanel();
    syncConsultancySubmissionModePanels();
    refreshBidUploadControls();
    validateMandatoryGate(false);
    validateWorkflowResponses(false);
    validateSemanticResponses(false);
    refreshBidProgress();
    refreshBidResponseReviews();
    setActiveStep(activeStepIndex);
    wizard.dataset.ready = 'true';
}

if (window.app) {
    window.app.renderBiddingWorkspace = renderBiddingWorkspace;
}

window.getBidWorkspaceRequirementSet = getBidWorkspaceRequirementSet;
window.initializeBiddingWorkspace = initializeBiddingWorkspace;
window.renderProcurexBidPackageDocument = renderProcurexBidPackageDocument;
window.createProcurexBidPackageSectionsFromRows = createProcurexBidPackageSectionsFromRows;
window.createProcurexBidPackageSectionsFromDraft = createProcurexBidPackageSectionsFromDraft;
window.createProcurexBidPackageSectionsFromEvaluationBid = createProcurexBidPackageSectionsFromEvaluationBid;
window.getProcurexSubmittedBidsForTender = getProcurexSubmittedBidsForTender;
