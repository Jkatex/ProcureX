// Bidding Workspace Page Component (Supplier sealed bid flow)

const bidWorkspaceDraftStoragePrefix = 'procurex.supplierBidDraft.v1.';
const bidWorkspaceSubmittedStorageKey = 'procurex.supplierSubmittedBids.v1';
const bidWorkspaceContractClauseFieldPattern = /contractclausecards$/i;
const bidWorkspaceUploadPreviewMaxBytes = 3 * 1024 * 1024;

function escapeBidWorkspaceHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

    (profile.submissionDocuments || []).forEach((documentName, index) => addRequirement({
        id: `submission-document-${index}`,
        title: documentName,
        category: 'Submission document',
        description: 'Attach or describe the evidence required for this bid.',
        mandatory: index < 3,
        responseType: 'upload',
        source: 'profile'
    }));

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
    return requirement.responseType === 'upload' || isBidWorkspaceGateRequirement(requirement);
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
            size: file?.size || 0
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

function renderBidWorkspaceMandatoryGate(requirements = [], draft = {}) {
    const sorted = sortBidWorkspaceRequirements(requirements);
    const uploadRequirements = sorted.filter(requirement => requirement.responseType === 'upload');
    const licenseRequirements = uploadRequirements.filter(isBidWorkspaceLicenseDocumentRequirement);
    const submissionRequirements = uploadRequirements.filter(requirement => (
        !licenseRequirements.includes(requirement) && isBidWorkspaceSubmissionDocumentRequirement(requirement)
    ));
    const planRequirements = uploadRequirements.filter(requirement => (
        !licenseRequirements.includes(requirement)
        && !submissionRequirements.includes(requirement)
        && isBidWorkspacePlanDocumentRequirement(requirement)
    ));
    const otherDocumentRequirements = uploadRequirements.filter(requirement => (
        !licenseRequirements.includes(requirement)
        && !submissionRequirements.includes(requirement)
        && !planRequirements.includes(requirement)
    ));
    const declarationRequirements = sorted.filter(requirement => requirement.responseType !== 'upload');
    const mandatoryDeclarationCount = declarationRequirements.filter(requirement => Boolean(requirement.mandatory)).length;

    return `
        <div class="bid-prequalification-note">
            <strong>Eligibility and document requirements</strong>
            <span>Upload mandatory eligibility documents and complete required confirmations before moving forward. Documents are grouped so licenses and certifications are separate from plans and other supporting files.</span>
        </div>
        ${renderBidWorkspaceGateDocumentSection(1, 'Licenses and certifications', 'License and certification documents', 'Business licenses, regulatory permits, registration certificates, tax/VAT evidence, and other eligibility certificates.', licenseRequirements, draft, 'No license or certification document is required for this tender.')}
        ${renderBidWorkspaceGateDocumentSection(2, 'Submission documents', 'Bid submission documents', 'Tender submission forms, signed bid documents, authorization letters, and buyer-required submission files.', submissionRequirements, draft, 'No separate submission document upload was configured for this tender.')}
        ${renderBidWorkspaceGateDocumentSection(3, 'Other documents', 'Other supporting documents', 'Additional evidence or supporting uploads that are not licenses, certifications, submission files, or plan documents.', otherDocumentRequirements, draft, 'No other supporting document upload was configured for this tender.')}
        ${renderBidWorkspaceGateDocumentSection(4, 'Plan documents', 'Technical and delivery plan documents', 'Methodology, work plan, delivery plan, quality/HSE plan, staffing, equipment, schedule, and other planning documents.', planRequirements, draft, 'No plan document upload was configured for this tender.')}
        <div class="bid-gate-group">
            <div class="bid-gate-group-heading">
                <div>
                    <span class="section-kicker">5. Eligibility declarations/confirmations</span>
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
        return fallbackSpecs.map((row, specIndex) => ({
            id: item.id || spec.id ? `${item.id || spec.id}-${specIndex}` : `product-spec-fallback-${index}-${specIndex}`,
            values: {
                ...itemValues,
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

    return `
        <section class="product-spec-response">
            <div class="product-spec-response-actions">
                <button class="btn btn-secondary" type="button" data-bid-download-product-spec-template>Download Buyer Specification CSV</button>
                <span class="badge badge-warning">${template.rows.length} item specification${template.rows.length === 1 ? '' : 's'}</span>
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
    return {
        hasBuyerSpecificationRows: template.rows.length > 0,
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
                <button class="btn btn-secondary" type="button" data-bid-download-tenderer-csv-template>Download CSV Template</button>
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

function downloadBidWorkspaceProductSpecificationCsv(tender = {}) {
    const template = normalizeBidWorkspaceProductSpecificationTemplate(tender);
    const rows = [
        template.columns.map(column => column.label),
        ...template.rows.map(row => template.columns.map(column => row.values?.[column.id] || ''))
    ];
    downloadBidWorkspaceCsv(rows, 'buyer-product-specification-template.csv');
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

function formatBidWorkspaceReviewValue(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    const text = String(value ?? '').trim();
    return text || 'Pending';
}

function renderBidWorkspaceResponseReviewPlaceholder() {
    return `
        <div class="bid-response-document">
            <header class="bid-response-document-cover">
                <div>
                    <span class="section-kicker">Bid response document</span>
                    <h3>Responses entered so far</h3>
                    <p>Responses will be compiled here as a bid document before submission.</p>
                </div>
                <div class="bid-response-document-stamp">
                    <strong>Draft</strong>
                    <span>Live preview</span>
                </div>
            </header>
            <div class="scope-empty">Responses will appear here after the bidder completes earlier sections.</div>
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
        return `
            <tr class="goods-offer-row">
                <td>${index + 1}</td>
                <td><strong>${escapeBidWorkspaceHtml(getGoodsBidItemDescription(item, index))}</strong><small>${qty} ${escapeBidWorkspaceHtml(unit)} requested</small></td>
                <td data-bid-line-qty>${qty}</td>
                <td>${escapeBidWorkspaceHtml(unit)}</td>
                <td>
                    <select class="form-input" data-bid-response="${baseId}-status" data-bid-workflow-required-response="true">
                        <option value="" ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) ? '' : 'selected'}>Select</option>
                        ${['Bid', 'Not Bid'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" data-bid-rate data-bid-response="${baseId}-unit-price" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(bidderRate)}" placeholder="Unit price"></td>
                <td><select class="form-input" data-bid-response="${baseId}-tax-included" data-bid-workflow-required-response="true"><option value="" ${getBidWorkspaceSavedResponse(draft, `${baseId}-tax-included`) ? '' : 'selected'}>Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-tax-included`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                <td><input class="form-input" data-bid-response="${baseId}-discount" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-discount`))}" placeholder="Amount or %"></td>
                <td data-bid-line-amount>${formatBidWorkspaceMoney(qty * parseBidWorkspaceNumber(bidderRate))}</td>
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
                        <p>Destination: ${escapeBidWorkspaceHtml(sample.deliveryLocation || 'Buyer location')} / Deadline: ${escapeBidWorkspaceHtml(sample.deliveryDeadline || 'Not set')}</p>
                        <div class="form-grid two">
                            <div class="form-group"><label class="form-label">Sample Submission Status</label><select class="form-input" data-bid-response="${baseId}-status" data-bid-workflow-required-response="true"><option value="" ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) ? '' : 'selected'}>Select status</option>${['Prepared', 'Dispatched', 'Not applicable'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                            <div class="form-group"><label class="form-label">Number Submitted</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-number" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-number`) || sample.numberOfSamples || '')}"></div>
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

function renderBidWorkspaceUploadControl(responseId, draft = {}, label = 'Upload evidence', accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png', workflowRequired = false) {
    const value = getBidWorkspaceSavedResponse(draft, responseId);
    return `
        <div class="bid-upload-response" data-bid-upload-control>
            <span>${escapeBidWorkspaceHtml(label)}</span>
            <input class="form-input" type="file" data-bid-file-input accept="${escapeBidWorkspaceHtml(accept)}" aria-label="${escapeBidWorkspaceHtml(label)}">
            <input type="hidden" data-bid-response="${escapeBidWorkspaceHtml(responseId)}" ${workflowRequired ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(value)}">
            <small data-bid-file-name>${value ? `Selected: ${escapeBidWorkspaceHtml(value)}` : 'No file selected yet.'}</small>
        </div>
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

function renderWorksBidExperienceCards(tender = {}, draft = {}) {
    const required = normalizeBidWorkspaceFlag(tender.requirements?.fields?.similarCompletedProjectsRequired);
    const count = required ? 3 : 1;
    return `
        <section class="works-response-section">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Similar completed projects</h3>
                    <p>Provide comparable works references, completion proof, and client contacts.</p>
                </div>
                <span class="badge ${required ? 'badge-warning' : 'badge-info'}">${required ? 'Required' : 'Optional'}</span>
            </div>
            <div class="works-card-grid">
                ${Array.from({ length: count }, (_, index) => {
                    const baseId = `works-experience-${index}`;
                    return `
                        <article class="works-capacity-card">
                            <span class="section-kicker">Project ${index + 1}</span>
                            <div class="form-grid two">
                                <div class="form-group"><label class="form-label">Project Name</label><input class="form-input" data-bid-response="${baseId}-project-name" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-project-name`))}"></div>
                                <div class="form-group"><label class="form-label">Client Name</label><input class="form-input" data-bid-response="${baseId}-client-name" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-client-name`))}"></div>
                                <div class="form-group"><label class="form-label">Project Location</label><input class="form-input" data-bid-response="${baseId}-location" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-location`))}"></div>
                                <div class="form-group"><label class="form-label">Contract Value</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="${baseId}-value" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-value`))}"></div>
                                <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" data-bid-response="${baseId}-start" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-start`))}"></div>
                                <div class="form-group"><label class="form-label">Completion Date</label><input class="form-input" type="date" data-bid-response="${baseId}-completion" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-completion`))}"></div>
                                <div class="form-group"><label class="form-label">Completion Status</label><select class="form-input" data-bid-response="${baseId}-status"><option value="">Select</option>${['Completed', 'Substantially complete', 'Ongoing'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                <div class="form-group"><label class="form-label">Reference Contact</label><input class="form-input" data-bid-response="${baseId}-reference" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-reference`))}"></div>
                                <div class="form-group wide"><label class="form-label">Scope of Works</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-scope">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-scope`))}</textarea></div>
                                <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-completion-certificate`, draft, 'Upload completion certificate', '.pdf,.doc,.docx,.jpg,.jpeg,.png', required)}</div>
                                <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-contract-copy`, draft, 'Upload contract copy', '.pdf,.doc,.docx', false)}</div>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderWorksBidPersonnelCards(tender = {}, draft = {}) {
    const required = normalizeBidWorkspaceFlag(tender.requirements?.fields?.keyPersonnelCvsRequired);
    const roles = getWorksBidPersonnelRoles(tender);
    return `
        <section class="works-response-section">
            <div class="bid-dynamic-group-heading">
                <div>
                    <h3>Key personnel</h3>
                    <p>Nominate the construction team, qualifications, registrations, availability, and CV evidence.</p>
                </div>
                <span class="badge ${required ? 'badge-warning' : 'badge-info'}">${roles.length} profiles</span>
            </div>
            <div class="works-personnel-grid">
                ${roles.map((role, index) => {
                    const baseId = `works-personnel-${index}`;
                    return `
                        <article class="works-person-card">
                            <div class="works-person-avatar">${escapeBidWorkspaceHtml(String(role).slice(0, 1).toUpperCase())}</div>
                            <div>
                                <span class="section-kicker">${escapeBidWorkspaceHtml(role)}</span>
                                <div class="form-grid two">
                                    <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" data-bid-response="${baseId}-name" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-name`))}"></div>
                                    <div class="form-group"><label class="form-label">Qualification</label><input class="form-input" data-bid-response="${baseId}-qualification" ${required ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-qualification`))}"></div>
                                    <div class="form-group"><label class="form-label">Years of Experience</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-experience" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-experience`))}"></div>
                                    <div class="form-group"><label class="form-label">Registration No.</label><input class="form-input" data-bid-response="${baseId}-registration" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-registration`))}"></div>
                                    <div class="form-group"><label class="form-label">Availability Status</label><select class="form-input" data-bid-response="${baseId}-availability" ${required ? 'data-bid-workflow-required-response="true"' : ''}><option value="">Select</option>${['Available full time', 'Available part time', 'Replacement proposed'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-availability`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                    <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-cv`, draft, 'CV upload', '.pdf,.doc,.docx', required)}</div>
                                    <div class="form-group wide">${renderBidWorkspaceUploadControl(`${baseId}-certifications`, draft, 'Certifications upload', '.pdf,.doc,.docx,.jpg,.jpeg,.png', false)}</div>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
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
            <div class="works-equipment-grid">
                ${equipmentRows.map((equipment, index) => {
                    const baseId = `works-equipment-${index}`;
                    return `
                        <article class="works-capacity-card">
                            <span class="section-kicker">${escapeBidWorkspaceHtml(equipment.equipmentName || `Equipment ${index + 1}`)}</span>
                            <p>${escapeBidWorkspaceHtml(`Requested quantity/access: ${equipment.quantity || 1} / ${equipment.ownershipRequirement || 'Evidence required'}`)}</p>
                            <div class="form-grid two">
                                <div class="form-group"><label class="form-label">Model</label><input class="form-input" data-bid-response="${baseId}-model" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-model`))}"></div>
                                <div class="form-group"><label class="form-label">Quantity Available</label><input class="form-input" type="number" min="0" data-bid-response="${baseId}-quantity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-quantity`))}"></div>
                                <div class="form-group"><label class="form-label">Ownership Status</label><select class="form-input" data-bid-response="${baseId}-ownership" data-bid-workflow-required-response="true"><option value="">Select</option>${['Owned', 'Leased', 'Hire agreement', 'Subcontractor provided'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-ownership`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                <div class="form-group"><label class="form-label">Condition</label><select class="form-input" data-bid-response="${baseId}-condition"><option value="">Select</option>${['Excellent', 'Good', 'Serviceable', 'Requires mobilization'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-condition`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                                <div class="form-group"><label class="form-label">Availability Date</label><input class="form-input" type="date" data-bid-response="${baseId}-availability-date" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-availability-date`))}"></div>
                                <div class="form-group">${renderBidWorkspaceUploadControl(`${baseId}-ownership-proof`, draft, 'Ownership proof', '.pdf,.doc,.docx,.jpg,.jpeg,.png', false)}</div>
                                <div class="form-group wide">${renderBidWorkspaceUploadControl(`${baseId}-lease-proof`, draft, 'Lease / access agreement', '.pdf,.doc,.docx,.jpg,.jpeg,.png', false)}</div>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderWorksBidCapacityResponse(tender = {}, draft = {}) {
    const bankRequired = normalizeBidWorkspaceFlag(tender.requirements?.fields?.bankStatementsRequired);
    return `
        <div class="works-capacity-workbook">
            ${renderWorksBidExperienceCards(tender, draft)}
            ${renderWorksBidPersonnelCards(tender, draft)}
            ${renderWorksBidEquipmentCards(tender, draft)}
            <section class="works-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Financial capacity</h3>
                        <p>${escapeBidWorkspaceHtml(tender.requirements?.fields?.bankStatementPeriod || 'Provide turnover, credit facility, bank statements, and audited accounts if required by the buyer.')}</p>
                    </div>
                    <span class="badge ${bankRequired ? 'badge-warning' : 'badge-info'}">${bankRequired ? 'Required' : 'Conditional'}</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Annual Turnover</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="works-financial-turnover" ${bankRequired ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-financial-turnover'))}"></div>
                    <div class="form-group"><label class="form-label">Available Credit Facility</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="works-financial-credit" ${bankRequired ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-financial-credit'))}"></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-financial-bank-statements', draft, 'Upload bank statements', '.pdf,.doc,.docx,.xls,.xlsx', bankRequired)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-financial-audited-accounts', draft, 'Upload audited financial statements', '.pdf,.doc,.docx,.xls,.xlsx', bankRequired)}</div>
                    <div class="form-group wide"><label class="form-label">Financial Capacity Notes</label><textarea class="form-input" rows="3" data-bid-response="works-financial-notes">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-financial-notes'))}</textarea></div>
                </div>
            </section>
            <section class="works-response-section">
                <div class="bid-dynamic-group-heading">
                    <div>
                        <h3>Health, Safety & Environmental Response</h3>
                        <p>Provide site-specific safety, environmental, incident, PPE, and waste management controls.</p>
                    </div>
                    <span class="badge badge-warning">Response required</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Safety Policy Available</label><select class="form-input" data-bid-response="works-hse-safety-policy" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-hse-safety-policy') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Environmental Policy Available</label><select class="form-input" data-bid-response="works-hse-environmental-policy" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-hse-environmental-policy') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Safety Officer Assigned</label><select class="form-input" data-bid-response="works-hse-safety-officer" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-hse-safety-officer') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-hse-documents', draft, 'Upload HSE documents', '.pdf,.doc,.docx,.jpg,.jpeg,.png', true)}</div>
                    <div class="form-group wide"><label class="form-label">PPE Plan</label><textarea class="form-input" rows="2" data-bid-response="works-hse-ppe-plan" data-bid-workflow-required-response="true">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-hse-ppe-plan'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Incident Management Plan</label><textarea class="form-input" rows="2" data-bid-response="works-hse-incident-plan">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-hse-incident-plan'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Waste Management Plan</label><textarea class="form-input" rows="2" data-bid-response="works-hse-waste-plan">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-hse-waste-plan'))}</textarea></div>
                </div>
            </section>
        </div>
    `;
}

function renderWorksBidTechnicalProposal(tender = {}, draft = {}) {
    const proposalSections = [
        ['understanding', 'Project Understanding', 'Understanding of buyer scope, site conditions, drawings, constraints, and deliverables.'],
        ['methodology', 'Construction Methodology', 'Construction sequence, methods, supervision controls, testing, and handover approach.'],
        ['work-plan', 'Proposed Work Plan', 'Work breakdown, sequencing, mobilization, subcontractors, materials, and site logistics.'],
        ['site-strategy', 'Site Execution Strategy', 'Site establishment, access, hoarding, storage, utilities, and coordination.'],
        ['risk-plan', 'Risk Mitigation Plan', 'Technical, schedule, safety, environmental, and commercial risk controls.'],
        ['quality-plan', 'Quality Assurance Approach', 'Inspection test plans, material approvals, workmanship control, and QA/QC records.'],
        ['environment-safety', 'Environmental & Safety Measures', 'Worker safety, public safety, environmental safeguards, and incident response.']
    ];
    const milestones = getWorksBidMilestoneRows(tender);
    const drawings = getWorksBidDrawingRows(tender);
    const siteVisitMandatory = /mandatory|required/i.test(String(tender.requirements?.fields?.siteVisitRequirement || ''));
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
                    <div class="form-group wide"><label class="form-label">Assumptions & Clarifications</label><textarea class="form-input" rows="3" data-bid-response="works-proposal-assumptions">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-proposal-assumptions'))}</textarea></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-proposal-upload', draft, 'Technical proposal upload', '.pdf,.doc,.docx', true)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-method-statement-upload', draft, 'Method statement upload', '.pdf,.doc,.docx', true)}</div>
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
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-gantt-chart-upload', draft, 'Upload Gantt chart', '.pdf,.doc,.docx,.xls,.xlsx,.mpp', true)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-program-upload', draft, 'Upload work program', '.pdf,.doc,.docx,.xls,.xlsx,.mpp', true)}</div>
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
                    <div class="form-group">${renderBidWorkspaceUploadControl('works-site-visit-evidence', draft, 'Upload site visit evidence', '.pdf,.doc,.docx,.jpg,.jpeg,.png', siteVisitMandatory)}</div>
                    <div class="form-group wide"><label class="form-label">Site Constraints Identified</label><textarea class="form-input" rows="2" data-bid-response="works-site-constraints">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-constraints'))}</textarea></div>
                    <div class="form-group wide"><label class="form-label">Site Understanding Notes</label><textarea class="form-input" rows="2" data-bid-response="works-site-notes">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-site-notes'))}</textarea></div>
                </div>
            </section>
        </div>
    `;
}

function renderWorksBidFinancialRows(tender = {}, draft = {}) {
    const rows = getWorksBidBoqRows(tender);
    if (!rows.length) return '<tr><td colspan="8">No works BOQ configured.</td></tr>';
    return rows.map((item, index) => {
        const baseId = `works-boq-${index}`;
        const qty = parseBidWorkspaceNumber(item.quantity || item.qty) || 1;
        const unit = item.unit || item.unitOfMeasure || 'Lot';
        const labor = getBidWorkspaceSavedResponse(draft, `${baseId}-labor`) || Math.round(parseBidWorkspaceNumber(item.laborCost || item.rate || item.amount) * (item.laborCost ? 1 : 0.28));
        const material = getBidWorkspaceSavedResponse(draft, `${baseId}-material`) || Math.round(parseBidWorkspaceNumber(item.materialCost || item.rate || item.amount) * (item.materialCost ? 1 : 0.54));
        const equipment = getBidWorkspaceSavedResponse(draft, `${baseId}-equipment`) || Math.round(parseBidWorkspaceNumber(item.equipmentCost || item.rate || item.amount) * (item.equipmentCost ? 1 : 0.12));
        const overheads = getBidWorkspaceSavedResponse(draft, `${baseId}-overheads`) || Math.round(parseBidWorkspaceNumber(item.totalCost || item.rate || item.amount) * 0.04);
        const profit = getBidWorkspaceSavedResponse(draft, `${baseId}-profit`) || 6;
        const direct = parseBidWorkspaceNumber(labor) + parseBidWorkspaceNumber(material) + parseBidWorkspaceNumber(equipment) + parseBidWorkspaceNumber(overheads);
        const lineTotal = Math.round(direct * (1 + (parseBidWorkspaceNumber(profit) / 100)));
        const unitRate = Math.round(lineTotal / qty);
        return `
            <tr class="works-boq-row" data-works-boq-row>
                <td>${escapeBidWorkspaceHtml(item.item || item.section || `${index + 1}.1`)}</td>
                <td><strong>${escapeBidWorkspaceHtml(item.workItem || item.description || `Work item ${index + 1}`)}</strong><small>${escapeBidWorkspaceHtml(item.description || tender.contractType || 'Works BOQ item')}</small></td>
                <td data-bid-line-qty>${qty}</td>
                <td>${escapeBidWorkspaceHtml(unit)}</td>
                <td><select class="form-input" data-bid-response="${baseId}-status" data-bid-workflow-required-response="true"><option value="">Select</option>${['Bid', 'Not Bid'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-status`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                <td data-works-unit-rate>${formatBidWorkspaceMoney(unitRate)}<input type="hidden" data-bid-rate data-bid-response="${baseId}-unit-rate" value="${unitRate}"></td>
                <td data-bid-line-amount>${formatBidWorkspaceMoney(lineTotal)}</td>
            </tr>
            <tr class="works-cost-detail-row">
                <td></td>
                <td colspan="6">
                    <div class="works-cost-grid">
                        <div class="form-group"><label class="form-label">Labor Cost</label><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-labor" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(labor)}"></div>
                        <div class="form-group"><label class="form-label">Material Cost</label><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-material" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(material)}"></div>
                        <div class="form-group"><label class="form-label">Equipment Cost</label><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-equipment" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(equipment)}"></div>
                        <div class="form-group"><label class="form-label">Overheads</label><input class="form-input" type="number" min="0" step="1000" data-works-cost data-bid-response="${baseId}-overheads" value="${escapeBidWorkspaceHtml(overheads)}"></div>
                        <div class="form-group"><label class="form-label">Profit Margin (%)</label><input class="form-input" type="number" min="0" max="100" step="0.5" data-works-cost data-bid-response="${baseId}-profit" value="${escapeBidWorkspaceHtml(profit)}"></div>
                        <div class="form-group wide"><label class="form-label">Alternative Proposal</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-alternative">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-alternative`))}</textarea></div>
                        <div class="form-group wide"><label class="form-label">Remarks</label><textarea class="form-input" rows="2" data-bid-response="${baseId}-remarks">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-remarks`))}</textarea></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderWorksBidCommercialTerms(draft = {}) {
    return `
        <div class="goods-commercial-terms works-commercial-terms">
            <div class="form-grid two">
                <div class="form-group"><label class="form-label">Bid Validity Period (days)</label><input class="form-input" type="number" min="1" data-bid-response="works-commercial-bid-validity" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-commercial-bid-validity') || 120)}"></div>
                <div class="form-group"><label class="form-label">Advance Payment Requested</label><select class="form-input" data-bid-response="works-commercial-advance-requested"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-commercial-advance-requested') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Proposed Advance Percentage</label><input class="form-input" type="number" min="0" max="100" data-bid-response="works-commercial-advance-percent" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-commercial-advance-percent'))}"></div>
                <div class="form-group"><label class="form-label">Performance Guarantee Availability</label><select class="form-input" data-bid-response="works-commercial-performance-guarantee" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'works-commercial-performance-guarantee') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Defects Liability / Warranty Period</label><input class="form-input" data-bid-response="works-commercial-defects-period" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'works-commercial-defects-period'))}" placeholder="e.g. 12 months"></div>
                <label class="bid-response-check"><input type="checkbox" data-bid-response="works-commercial-retention-acceptance" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'works-commercial-retention-acceptance') === true || getBidWorkspaceSavedResponse(draft, 'works-commercial-retention-acceptance') === 'true' ? 'checked' : ''}><span>I accept retention provisions.</span></label>
                <label class="bid-response-check"><input type="checkbox" data-bid-response="works-commercial-liquidated-damages" data-bid-workflow-required-response="true" ${getBidWorkspaceSavedResponse(draft, 'works-commercial-liquidated-damages') === true || getBidWorkspaceSavedResponse(draft, 'works-commercial-liquidated-damages') === 'true' ? 'checked' : ''}><span>I accept liquidated damages provisions.</span></label>
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
    return rows.length ? rows : [
        { position: 'Service Manager', minimumEducation: 'Diploma', minimumYearsExperience: 5, cvRequired: true, mandatory: true },
        { position: 'Service Supervisor', minimumEducation: 'Certificate', minimumYearsExperience: 3, cvRequired: true, mandatory: true },
        { position: 'Field Officer / Technician', minimumEducation: 'Certificate', minimumYearsExperience: 2, cvRequired: true, mandatory: true }
    ];
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

function renderServiceBidMethodology(tender = {}, draft = {}) {
    const fields = tender.requirements?.fields || {};
    const blocks = [
        ['understanding', 'Understanding of Service', fields.scopeOfServices || tender.description || 'Explain the buyer service need and operational context.'],
        ['methodology', 'Service Delivery Methodology', 'Describe how the service will be delivered, controlled, supervised, and improved.'],
        ['work-plan', 'Approach & Work Plan', 'Describe mobilization, handover, recurring activities, quality checks, and closure.'],
        ['quality', 'Quality Assurance Approach', 'Describe inspection, review, acceptance, and corrective action controls.'],
        ['reporting', 'Reporting Method', fields.reportingRequirements || 'Describe reports, dashboards, data sources, and buyer communication rhythm.'],
        ['risk', 'Risk Management Approach', fields.riskAssessmentRequirement || 'Describe risks, mitigation, escalation, and continuity controls.']
    ];
    const deliverables = fields.serviceDeliverables || tender.deliverables?.map(text => ({ text })) || [];
    return `
        <div class="service-workbook">
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
                    <div class="form-group wide">${renderBidWorkspaceUploadControl('service-methodology-upload', draft, 'Upload methodology document', '.pdf,.doc,.docx', true)}</div>
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
    const financialRows = getServiceBidFinancialRows(tender);
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
            <section class="service-response-section">
                <div class="bid-dynamic-group-heading">
                    <div><h3>Financial capacity</h3><p>Show that service operations can be sustained through the contract period.</p></div>
                    <span class="badge ${financialRows.length ? 'badge-warning' : 'badge-info'}">${financialRows.length ? 'Required' : 'Standard'}</span>
                </div>
                <div class="form-grid two">
                    <div class="form-group"><label class="form-label">Annual Revenue</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="service-financial-revenue" ${financialRows.length ? 'data-bid-workflow-required-response="true"' : ''} value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-financial-revenue'))}"></div>
                    <div class="form-group"><label class="form-label">Cash Flow Availability</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="service-financial-cashflow" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-financial-cashflow'))}"></div>
                    <div class="form-group"><label class="form-label">Credit Facility Available</label><select class="form-input" data-bid-response="service-financial-credit"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, 'service-financial-credit') === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('service-financial-bank-statement', draft, 'Bank statement upload', '.pdf,.doc,.docx,.xls,.xlsx', financialRows.length > 0)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('service-financial-audited', draft, 'Audited financials upload', '.pdf,.doc,.docx,.xls,.xlsx', financialRows.length > 0)}</div>
                    <div class="form-group">${renderBidWorkspaceUploadControl('service-financial-insurance', draft, 'Insurance coverage upload', '.pdf,.doc,.docx', false)}</div>
                    <div class="form-group wide"><label class="form-label">Financial Stability Notes</label><textarea class="form-input" rows="2" data-bid-response="service-financial-notes">${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, 'service-financial-notes'))}</textarea></div>
                </div>
            </section>
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
                    <div><h3>Performance & SLA response</h3><p>Accept SLA requirements, map KPI commitments, penalties, reporting cadence, and escalation controls.</p></div>
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
                    <div><h3>Reporting & communication plan</h3><p>${escapeBidWorkspaceHtml(fields.reportingRequirements || 'Define reporting format, channels, templates, escalation, and meetings.')}</p></div>
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
                        { category: 'Gender & Inclusion', description: 'Inclusion policy and fair treatment.', mandatory: false },
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
        const unit = item.unit || item.unitOfMeasure || 'Unit';
        const buyerRate = parseBidWorkspaceNumber(item.rate || item.unitPrice || item.amount);
        const unitRate = getBidWorkspaceSavedResponse(draft, `${baseId}-unit-rate`) || (buyerRate ? Math.round(buyerRate * 0.98) : '');
        return `
            <tr class="service-pricing-row">
                <td>${escapeBidWorkspaceHtml(item.item || `${index + 1}.1`)}</td>
                <td><strong>${escapeBidWorkspaceHtml(item.description || item.serviceTask || `Service line ${index + 1}`)}</strong><small>${qty} ${escapeBidWorkspaceHtml(unit)}</small></td>
                <td data-bid-line-qty>${qty}</td>
                <td>${escapeBidWorkspaceHtml(unit)}</td>
                <td><select class="form-input" data-bid-response="${baseId}-model" data-bid-workflow-required-response="true"><option value="">Select</option>${['Monthly Retainer', 'Unit Rate', 'Lump Sum', 'Hybrid', 'SLA-based'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-model`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" data-bid-rate data-bid-response="${baseId}-unit-rate" data-bid-workflow-required-response="true" value="${escapeBidWorkspaceHtml(unitRate)}"></td>
                <td><input class="form-input" data-bid-response="${baseId}-discount" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-discount`))}" placeholder="%"></td>
                <td data-bid-line-amount>${formatBidWorkspaceMoney(qty * parseBidWorkspaceNumber(unitRate))}</td>
            </tr>
            <tr class="service-price-detail-row">
                <td></td>
                <td colspan="7">
                    <div class="works-cost-grid service-cost-grid">
                        <div class="form-group"><label class="form-label">Monthly Service Fee</label><input class="form-input" type="number" min="0" step="1000" data-bid-response="${baseId}-monthly-fee" value="${escapeBidWorkspaceHtml(getBidWorkspaceSavedResponse(draft, `${baseId}-monthly-fee`))}"></div>
                        <div class="form-group"><label class="form-label">VAT / Taxes Included</label><select class="form-input" data-bid-response="${baseId}-tax-included" data-bid-workflow-required-response="true"><option value="">Select</option>${['Yes', 'No'].map(option => `<option ${getBidWorkspaceSavedResponse(draft, `${baseId}-tax-included`) === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
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

function renderBiddingWorkspace() {
    const tender = getBidWorkspaceTender();
    const profile = getBidWorkspaceProfile(tender);
    const tenderId = tender.id || 'selected';
    const draft = getBidWorkspaceDraft(tenderId);
    const commercialItems = getBidWorkspaceCommercialItems(tender, profile);
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
    const gateRequirementCount = stepOneRequirements.length;
    const mandatoryGateCount = stepOneRequirements.filter(requirement => requirement.mandatory).length;
    const deferredMandatoryCount = dynamicRequirements.filter(isBidWorkspaceResponseRequirement).length;
    const requiredLicenseCount = stepOneRequirements.filter(requirement => getBidWorkspaceRequirementPriority(requirement) === 0 && requirement.mandatory).length;
    const responseFields = profile.responseFields || ['Technical response', 'Delivery approach'];
    const goodsFlow = profile.id === 'goods';
    const worksFlow = profile.id === 'works';
    const serviceFlow = profile.id === 'services';
    const hasGoodsSamples = goodsFlow && isGoodsBidSamplesRequired(tender);
    const steps = goodsFlow
        ? [
            ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
            ['02', 'Technical Response', 'Fill the buyer product specification table'],
            ['03', 'Financial Offer', 'Quantity schedule, delivery, and commercial terms'],
            ...(hasGoodsSamples ? [['04', 'Samples', 'Sample dispatch and delivery evidence']] : []),
            [hasGoodsSamples ? '05' : '04', 'Review & Validate', 'Check missing responses before declaration'],
            [hasGoodsSamples ? '06' : '05', 'Declaration & Submit', 'Digital declaration and sealed submission']
        ]
        : worksFlow
            ? [
                ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
                ['02', 'Technical Capacity', 'Experience, personnel, equipment, finance, and HSE'],
                ['03', 'Technical Proposal', 'Methodology, schedule, drawings, and site response'],
                ['04', 'Financial Proposal', 'BOQ pricing, cost breakdown, and commercial terms'],
                ['05', 'Review & Validation', 'Check missing contractor response items'],
                ['06', 'Declaration & Submission', 'Digital signing and final submission']
            ]
            : serviceFlow
                ? [
                    ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
                    ['02', 'Methodology', 'Service understanding, workflow, QA, and risk approach'],
                    ['03', 'Delivery Plan', 'Schedule, locations, SLA timers, and milestones'],
                    ['04', 'Staffing & Capacity', 'People, equipment, finance, and service capability'],
                    ['05', 'SLA & Reporting', 'Performance metrics, reporting, ESG, and documents'],
                    ['06', 'Pricing', 'Service schedule, SLA-linked pricing, and commercial terms'],
                    ['07', 'Review & Submit', 'Validate, declare, and submit service bid']
                ]
        : [
        ['01', 'Eligibility and Document Requirements', 'Licenses, certifications, submission files, and document uploads'],
        ['02', 'Dynamic Responses', 'Answer optional and technical tender requirements'],
        ['03', 'Financial Offer', `${profile.commercialName} rates and commercial schedule`],
        ['04', 'Review & Submit', 'Validate, declare, and submit sealed bid'],
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
                    <li><a href="#" data-navigate="supplier-tender-detail">Tender Detail</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                    <li><a href="#" data-navigate="supplier-marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="supplier-journey">Supplier Journey</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page tender-wizard-page bid-flow-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-info">${escapeBidWorkspaceHtml(tender.type)} bid</span>
                            <h1>Bid Submission Workspace</h1>
                            <p>${escapeBidWorkspaceHtml(tender.title)} / ${escapeBidWorkspaceHtml(tender.organization)}. The wizard is generated from the tender requirements, mandatory evidence, evaluation setup, and commercial schedule.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-bid-view-tender-detail>View Tender Details</button>
                            <button class="btn btn-secondary" type="button" data-bid-ask-clarification data-clarification-category="Technical" data-clarification-context="General tender clarification before bid submission">Ask Clarification</button>
                            <button class="btn btn-secondary" type="button" data-bid-save-draft>Save Draft</button>
                            <button class="btn btn-primary" type="button" data-bid-jump-submit>Review Submit</button>
                        </div>
                    </section>

                    ${renderBidWorkspaceAssistancePanel(documents)}

                    <div class="wizard-shell" data-bid-wizard data-bid-tender-id="${escapeBidWorkspaceHtml(tenderId)}">
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
                                ${renderBidWorkspaceMandatoryGate(stepOneRequirements, draft)}
                            </section>

                            ${goodsFlow ? `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Technical Response</h2></div>
                                    <span class="badge badge-warning">${normalizeBidWorkspaceProductSpecificationTemplate(tender).rows.length} product rows</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Complete the buyer's specification table</strong>
                                    <span>Fill in your offered product specification against the buyer's required format. Do not change buyer columns, required rows, or the template structure.</span>
                                </div>
                                ${renderBidWorkspaceTendererCsvTemplatePanel(tender)}
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about product specifications?', 'Technical', 'Question about goods product specifications or compliance')}
                                ${renderGoodsBidProductSpecificationResponse(tender, draft)}
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
                                    <div><span class="section-kicker">Step ${hasGoodsSamples ? '5' : '4'}</span><h2>Review & Validate</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Eligibility gate</span><strong data-bid-gate-summary>Pending validation</strong></div>
                                    <div><span>Product specification response</span><strong>${normalizeBidWorkspaceProductSpecificationTemplate(tender).rows.length} required rows</strong></div>
                                    <div><span>Quantity schedule</span><strong>${getGoodsBidQuantityRows(tender).length} priced lines</strong></div>
                                    <div class="${hasGoodsSamples ? '' : 'not-required'}"><span>Samples</span><strong>${hasGoodsSamples ? `${getGoodsBidSampleRows(tender).length} required` : 'Not required'}</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>System validation</strong>
                                    <span>The system checks missing documents, required compliance responses, missing prices, and mandatory sample evidence before allowing final submission.</span>
                                </div>
                                <section class="bid-response-review" data-bid-response-review>
                                    ${renderBidWorkspaceResponseReviewPlaceholder()}
                                </section>
                            </section>

                            <section class="journey-panel" id="bid-step-${hasGoodsSamples ? '6' : '5'}">
                                <div class="panel-heading"><div><span class="section-kicker">Step ${hasGoodsSamples ? '6' : '5'}</span><h2>Supplier Declaration & Submit</h2></div><span class="badge badge-success">Final step</span></div>
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
                                        <span>The system will validate the structured goods bid and store a receipt.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>
                            ` : worksFlow ? `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Technical Capacity & Experience</h2></div>
                                    <span class="badge badge-warning">Contractor capability</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Project-oriented contractor evidence</strong>
                                    <span>Prove relevant experience, available personnel, equipment capacity, financial capacity, and HSE readiness before writing the execution proposal.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about personnel, equipment, experience, or HSE evidence?', 'Technical', 'Question about works technical capacity requirements')}
                                ${renderWorksBidCapacityResponse(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>Technical Proposal & Work Program</h2></div>
                                    <span class="badge badge-warning">Methodology required</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Explain how the works will be executed</strong>
                                    <span>Complete the methodology, schedule, milestone plan, drawing acknowledgement, and site investigation response as structured sections.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about drawings, site visit, milestones, or methodology?', 'Timeline', 'Question about works methodology, drawings, site visit, or work program')}
                                ${renderWorksBidTechnicalProposal(tender, draft)}
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
                                <div class="data-table works-boq-table">
                                    <table>
                                        <thead><tr><th>Code</th><th>Work Item</th><th>Qty</th><th>Unit</th><th>Status</th><th>Unit Rate</th><th>Total</th></tr></thead>
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
                                    <div><span class="section-kicker">Step 5</span><h2>Review & Validation</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Eligibility gate</span><strong data-bid-gate-summary>Pending validation</strong></div>
                                    <div><span>Experience evidence</span><strong>${normalizeBidWorkspaceFlag(tender.requirements?.fields?.similarCompletedProjectsRequired) ? 'Required' : 'Optional'}</strong></div>
                                    <div><span>Personnel profiles</span><strong>${getWorksBidPersonnelRoles(tender).length} roles</strong></div>
                                    <div><span>Equipment capacity</span><strong>${getWorksBidEquipmentRows(tender).length} items</strong></div>
                                    <div><span>BOQ lines</span><strong>${getWorksBidBoqRows(tender).length} priced lines</strong></div>
                                    <div><span>Milestones</span><strong>${getWorksBidMilestoneRows(tender).length} schedule items</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>System validation</strong>
                                    <span>The system checks missing legal uploads, capacity evidence, methodology narratives, milestone responses, BOQ pricing, commercial confirmations, and final declarations before submission.</span>
                                </div>
                                <section class="bid-response-review" data-bid-response-review>
                                    ${renderBidWorkspaceResponseReviewPlaceholder()}
                                </section>
                            </section>

                            <section class="journey-panel" id="bid-step-6">
                                <div class="panel-heading"><div><span class="section-kicker">Step 6</span><h2>Declaration & Submission</h2></div><span class="badge badge-success">Final step</span></div>
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
                                        <span>The system will validate the structured works bid and store a receipt.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>
                            ` : serviceFlow ? `
                            <section class="journey-panel" id="bid-step-2">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 2</span><h2>Service Understanding & Methodology</h2></div>
                                    <span class="badge badge-warning">Core service response</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>Service delivery model</strong>
                                    <span>Explain who will deliver the service, how the workflow runs, how quality is controlled, and what evidence proves each deliverable.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about service scope, workflow, or deliverables?', 'Technical', 'Question about service methodology, deliverables, or workflow')}
                                ${renderServiceBidMethodology(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>Service Schedule & Delivery Plan</h2></div>
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
                                    <div><span class="section-kicker">Step 4</span><h2>Personnel, Staffing & Capacity</h2></div>
                                    <span class="badge badge-warning">${getServiceBidPersonnelRows(tender).length} staff roles</span>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>People and operational sustainability</strong>
                                    <span>Assign staff, upload CVs, prove tools or systems where required, and show financial capacity to sustain service delivery.</span>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Need clarification about staffing, certifications, equipment, or financial capacity?', 'Technical', 'Question about service staffing, equipment, or financial capacity')}
                                ${renderServiceBidStaffingCapacity(tender, draft)}
                            </section>

                            <section class="journey-panel" id="bid-step-5">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 5</span><h2>Performance, SLA, Reporting & Compliance</h2></div>
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
                                <div class="data-table service-pricing-table">
                                    <table>
                                        <thead><tr><th>Code</th><th>Service Line</th><th>Qty</th><th>Unit</th><th>Pricing Model</th><th>Unit Rate</th><th>Discount</th><th>Total</th></tr></thead>
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
                                    <div><span class="section-kicker">Step 7</span><h2>Review, Declaration & Submit</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Eligibility gate</span><strong data-bid-gate-summary>Pending validation</strong></div>
                                    <div><span>Staffing roles</span><strong>${getServiceBidPersonnelRows(tender).length} roles</strong></div>
                                    <div><span>Service locations</span><strong>${getServiceBidLocationRows(tender).length || 1} covered</strong></div>
                                    <div><span>SLA / KPI controls</span><strong>${(tender.evaluation?.criteria || []).find(item => /sla|performance/i.test(item.name || ''))?.subcriteria?.length || 4} metrics</strong></div>
                                    <div><span>Supporting documents</span><strong>${getServiceBidDocumentRows(tender).length} uploads</strong></div>
                                    <div><span>Pricing lines</span><strong>${getServiceBidCommercialRows(tender, profile).length} service lines</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                </div>
                                <div class="bid-step-intro">
                                    <strong>System validation</strong>
                                    <span>The system checks service methodology, schedule, staff CVs, SLA commitments, ESG documents, supporting uploads, pricing, and final declarations before submission.</span>
                                </div>
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
                                        <span>The system will validate the structured service bid and store a receipt.</span>
                                    </div>
                                    <button class="btn btn-primary" type="button" data-bid-submit>Submit Bid</button>
                                </div>
                            </section>
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
                                ${renderBidWorkspaceDynamicResponses(dynamicRequirements, draft, responseFields, tender, profile)}
                            </section>

                            <section class="journey-panel" id="bid-step-3">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 3</span><h2>${escapeBidWorkspaceHtml(profile.commercialTitle || 'Financial Offer')}</h2></div>
                                    <span class="badge badge-info" data-bid-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="data-table">
                                    <table>
                                        <thead><tr><th>Code</th><th>Requirement</th><th>Qty / Duration</th><th>Bid rate / fee</th><th>Amount</th></tr></thead>
                                        <tbody data-bid-commercial-body>${renderBidWorkspaceCommercialRows(commercialItems)}</tbody>
                                    </table>
                                </div>
                                ${renderBidWorkspaceClarificationPrompt('Question about pricing lines?', 'Commercial Schedule', 'Question about commercial schedule or pricing lines')}
                            </section>

                            <section class="journey-panel" id="bid-step-4">
                                <div class="panel-heading">
                                    <div><span class="section-kicker">Step 4</span><h2>Review & Submit</h2></div>
                                    <span class="badge badge-info" data-bid-review-total>${formatBidWorkspaceMoney(bidAmount)}</span>
                                </div>
                                <div class="record-summary">
                                    <div><span>Bidder</span><strong>${escapeBidWorkspaceHtml(mockData.users?.supplier?.organization || 'Supplier organization')}</strong></div>
                                    <div><span>Mandatory requirements</span><strong data-bid-gate-summary>Pending validation</strong></div>
                                    <div><span>Additional responses</span><strong>${dynamicRequirements.filter(isBidWorkspaceResponseRequirement).length} required / ${dynamicRequirements.length} tender items</strong></div>
                                    <div><span>Deadline</span><strong>${escapeBidWorkspaceHtml(tender.closingDate)}</strong></div>
                                </div>
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
                                    <button class="btn btn-primary" data-navigate="supplier-journey">View Outcome Center</button>
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
    const existingDraft = getBidWorkspaceDraft(tenderId);
    const sessionUploadUrls = {};
    let uploadedFiles = { ...(existingDraft.uploadedFiles || {}) };
    let activeStepIndex = Number(existingDraft.step || 0);

    const getRequiredInputsByPriority = () => {
        const groups = { licenses: [], evidence: [], confirmations: [] };
        wizard.querySelectorAll('[data-bid-required-response]').forEach(input => {
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
        return {
            ...getBidWorkspaceDraft(tenderId),
            step: activeStepIndex,
            responses,
            freeResponses,
            productSpecificationResponses,
            uploadedFiles,
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

    const storeBidUploadPreview = (responseId, file) => {
        if (!responseId || !file) return;
        if (sessionUploadUrls[responseId]) URL.revokeObjectURL(sessionUploadUrls[responseId]);
        sessionUploadUrls[responseId] = URL.createObjectURL(file);
        uploadedFiles[responseId] = {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size || 0
        };

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

    const focusBidWorkspaceInput = (input) => {
        const uploadInput = input?.closest('[data-bid-upload-control]')?.querySelector('[data-bid-file-input]');
        (uploadInput || input)?.focus?.();
    };

    const validateMandatoryGate = (show = false) => {
        const requiredInputs = Array.from(wizard.querySelectorAll('[data-bid-required-response]'));
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
        if (nextButton && activeStepIndex === 0) nextButton.disabled = !valid;
        return valid;
    };

    const markWorkflowInputState = (input, show = false) => {
        const container = input.closest('[data-bid-requirement-card], [data-bid-product-spec-row], .form-group, .bid-response-check, .goods-compliance-card, .goods-offer-row, .goods-sample-card, .works-capacity-card, .works-person-card, .works-accordion-card, .works-boq-row, .works-drawing-card, .service-accordion-card, .service-sla-card, .service-staff-card, .service-pricing-row, .service-document-card, .service-kpi-card');
        const complete = isResponseComplete(input);
        container?.classList.toggle('completed', complete);
        container?.classList.toggle('invalid', show && !complete);
    };

    const validatePanelWorkflowResponses = (panelIndex = activeStepIndex, show = false) => {
        const requiredInputs = Array.from(panels[panelIndex]?.querySelectorAll('[data-bid-workflow-required-response]') || []);
        const incompleteInputs = requiredInputs.filter(input => !isResponseComplete(input));
        requiredInputs.forEach(input => markWorkflowInputState(input, show));
        return {
            valid: incompleteInputs.length === 0,
            remaining: incompleteInputs.length,
            firstIncomplete: incompleteInputs[0] || null
        };
    };

    const validateWorkflowResponses = (show = false) => {
        const requiredInputs = Array.from(wizard.querySelectorAll('[data-bid-workflow-required-response]'));
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

    const shouldIncludeBidReviewInput = (input) => {
        if (input.closest('[data-bid-response-review]')) return false;
        if (input.closest('[data-bid-declaration], .confirm-action')) return false;
        const required = input.matches('[data-bid-required-response], [data-bid-workflow-required-response]');
        const uploadControl = input.closest('[data-bid-upload-control]');
        if (input.type === 'hidden' && !uploadControl) return String(input.value || '').trim().length > 0;
        if (input.type === 'checkbox') return input.checked || required || Boolean(getBidReviewInputLabel(input));
        return Boolean(uploadControl) || Boolean(getBidReviewInputLabel(input)) || String(input.value || '').trim().length > 0 || required;
    };

    const collectBidReviewSections = (reviewPanel) => {
        const reviewIndex = panels.indexOf(reviewPanel);
        return panels.slice(0, Math.max(reviewIndex, 0)).map(panel => {
            const panelTitle = panel.querySelector('.panel-heading h2')?.textContent.trim()
                || panel.querySelector('h2, h3')?.textContent.trim()
                || 'Bid section';
            const seen = new Set();
            const rows = Array.from(panel.querySelectorAll('[data-bid-response], [data-bid-free-response], [data-bid-product-spec-field]'))
                .filter(shouldIncludeBidReviewInput)
                .map(input => {
                    const key = `${input.dataset.bidResponse || input.dataset.bidFreeResponse || input.dataset.bidProductSpecField || ''}::${getBidReviewInputLabel(input)}`;
                    if (seen.has(key)) return null;
                    seen.add(key);
                    return {
                        label: getBidReviewInputLabel(input),
                        value: formatBidWorkspaceReviewValue(getBidReviewInputValue(input)),
                        pending: !isResponseComplete(input)
                    };
                })
                .filter(Boolean);
            return { title: panelTitle, rows };
        }).filter(section => section.rows.length);
    };

    const renderBidReviewSections = (sections = []) => {
        const totalRows = sections.reduce((total, section) => total + section.rows.length, 0);
        const submittedBidder = mockData.users?.supplier?.organization || 'Supplier organization';
        const reviewTotal = wizard.querySelector('[data-bid-review-total]')?.textContent || wizard.querySelector('[data-bid-total]')?.textContent || '';
        const offerLabel = profile.id === 'goods'
            ? 'Goods Offer'
            : profile.id === 'works'
                ? 'Works Offer'
                : profile.id === 'services'
                    ? 'Service Offer'
                    : profile.responseTitle || 'Bid Offer';
        return `
            <div class="bid-response-document">
                <header class="bid-response-document-cover">
                    <div>
                        <span class="section-kicker">Official bid submission preview</span>
                        <h3>${escapeBidWorkspaceHtml(tender.title || 'Tender bid response')}</h3>
                        <p>Generated from the bidder's completed response sections for validation before declaration and submission.</p>
                    </div>
                    <div class="bid-response-document-status">
                        <span class="bid-status-chip draft">Draft</span>
                        <span class="bid-status-chip offer">${escapeBidWorkspaceHtml(offerLabel)}</span>
                    </div>
                </header>
                <div class="bid-response-document-meta">
                    <article><span>Tender ID</span><strong>${escapeBidWorkspaceHtml(tenderId)}</strong><em>Reference</em></article>
                    <article><span>Bidder</span><strong>${escapeBidWorkspaceHtml(submittedBidder)}</strong><em>Supplier</em></article>
                    <article><span>Closing date</span><strong>${escapeBidWorkspaceHtml(tender.closingDate || 'Not set')}</strong><em>Deadline</em></article>
                    <article class="bid-value-card"><span>Bid value</span><strong>${escapeBidWorkspaceHtml(reviewTotal || 'Pending')}</strong><em>Current offer</em></article>
                    <article><span>Responses captured</span><strong>${totalRows}</strong><em>Validation scope</em></article>
                    <article><span>Prepared on</span><strong>${escapeBidWorkspaceHtml(new Date().toISOString().slice(0, 10))}</strong><em>System date</em></article>
                </div>
                ${sections.length ? `
                    <div class="bid-response-document-sections">
                        ${sections.map((section, sectionIndex) => {
                            const pendingCount = section.rows.filter(row => row.pending).length;
                            const complete = pendingCount === 0;
                            return `
                            <article class="bid-response-document-section">
                                <div class="bid-response-document-section-heading">
                                    <span>${String(sectionIndex + 1).padStart(2, '0')}</span>
                                    <div>
                                        <h4>${escapeBidWorkspaceHtml(section.title)}</h4>
                                        <small>${section.rows.length} item${section.rows.length === 1 ? '' : 's'} reviewed</small>
                                    </div>
                                    <em class="bid-section-status ${complete ? 'complete' : 'draft'}">${complete ? 'Complete' : `${pendingCount} pending`}</em>
                                </div>
                                <div class="bid-response-document-table">
                                    <table>
                                        <thead>
                                            <tr><th>Bid content</th><th>Bidder response</th><th>Status</th></tr>
                                        </thead>
                                        <tbody>
                                            ${section.rows.map(row => `
                                                <tr class="${row.pending ? 'pending' : ''}">
                                                    <td>${escapeBidWorkspaceHtml(row.label)}</td>
                                                    <td>${escapeBidWorkspaceHtml(row.value)}</td>
                                                    <td><span class="bid-table-status ${row.pending ? 'draft' : 'captured'}">${row.pending ? 'Draft' : 'Captured'}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        `; }).join('')}
                    </div>
                ` : '<div class="scope-empty">No bidder responses have been entered yet.</div>'}
            </div>
        `;
    };

    const refreshBidResponseReviews = () => {
        panels.forEach(panel => {
            const review = panel.querySelector('[data-bid-response-review]');
            if (!review) return;
            review.innerHTML = renderBidReviewSections(collectBidReviewSections(panel));
        });
    };

    const setActiveStep = (index, force = false) => {
        if (index > 0 && !force && !validateMandatoryGate(true)) {
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
            nextButton.disabled = activeStepIndex === 0 && !validateMandatoryGate(false);
        }
        if (progressOutput) progressOutput.textContent = `Step ${activeStepIndex + 1} of ${panels.length}`;
        if (stepTitleOutput) stepTitleOutput.textContent = railSteps.find(step => Number(step.dataset.bidStepIndex) === activeStepIndex)?.querySelector('span')?.textContent || '';
        refreshBidResponseReviews();
        saveDraft();
    };

    const refreshBidTotals = () => {
        let total = 0;
        wizard.querySelectorAll('[data-bid-commercial-body] tr').forEach((row) => {
            const rateInput = row.querySelector('[data-bid-rate]');
            if (!rateInput) return;
            if (row.matches('[data-works-boq-row]')) {
                const detailRow = row.nextElementSibling?.classList.contains('works-cost-detail-row') ? row.nextElementSibling : null;
                const getCost = (suffix) => parseBidWorkspaceNumber(detailRow?.querySelector(`[data-bid-response$="${suffix}"]`)?.value);
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
            const amount = rate * qty;
            total += amount;
            const output = row.querySelector('[data-bid-line-amount]');
            if (output) output.textContent = formatBidWorkspaceMoney(amount);
        });
        wizard.querySelector('[data-bid-total]')?.replaceChildren(document.createTextNode(formatBidWorkspaceMoney(total)));
        wizard.querySelector('[data-bid-review-total]')?.replaceChildren(document.createTextNode(formatBidWorkspaceMoney(total)));
    };

    const storeSubmittedBid = () => {
        const submitted = (() => {
            try {
                const parsed = JSON.parse(localStorage.getItem(bidWorkspaceSubmittedStorageKey) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        })();
        const hash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
        const draftSnapshot = collectDraft();
        const bid = {
            tenderId,
            submittedAt: new Date().toISOString(),
            receiptHash: hash,
            draft: draftSnapshot
        };
        localStorage.setItem(bidWorkspaceSubmittedStorageKey, JSON.stringify([bid, ...submitted.filter(item => item.tenderId !== tenderId)]));
        if (finalStatus) finalStatus.textContent = 'Submitted and sealed';
        return hash;
    };

    pageRoot.addEventListener('click', (event) => {
        const railStep = event.target?.closest('[data-bid-step-index]');
        if (railStep) {
            event.preventDefault();
            const requestedStep = Number(railStep.dataset.bidStepIndex);
            if (requestedStep > activeStepIndex) {
                if (activeStepIndex === 0 && !validateMandatoryGate(true)) {
                    const incompleteGateInput = Array.from(wizard.querySelectorAll('[data-bid-required-response]')).find(input => !isResponseComplete(input));
                    alert('Upload or confirm every mandatory eligibility document before continuing.');
                    focusBidWorkspaceInput(incompleteGateInput);
                    return;
                }
                if (activeStepIndex > 0) {
                    const panelValidation = validatePanelWorkflowResponses(activeStepIndex, true);
                    if (!panelValidation.valid) {
                        alert(`Complete ${panelValidation.remaining} required response${panelValidation.remaining === 1 ? '' : 's'} in this section before continuing.`);
                        focusBidWorkspaceInput(panelValidation.firstIncomplete);
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
            if (activeStepIndex === 0 && !validateMandatoryGate(true)) {
                const incompleteGateInput = Array.from(wizard.querySelectorAll('[data-bid-required-response]')).find(input => !isResponseComplete(input));
                alert('Upload or confirm every mandatory eligibility document before continuing.');
                focusBidWorkspaceInput(incompleteGateInput);
                return;
            }
            if (activeStepIndex > 0) {
                const panelValidation = validatePanelWorkflowResponses(activeStepIndex, true);
                if (!panelValidation.valid) {
                    alert(`Complete ${panelValidation.remaining} required response${panelValidation.remaining === 1 ? '' : 's'} in this section before continuing.`);
                    focusBidWorkspaceInput(panelValidation.firstIncomplete);
                    return;
                }
            }
            setActiveStep(activeStepIndex + 1);
            return;
        }

        if (target.matches('[data-bid-jump-submit]')) {
            setActiveStep(Math.max(panels.length - 2, 0));
            return;
        }

        if (target.matches('[data-bid-view-tender-detail]')) {
            if (typeof selectProcurexTender === 'function') selectProcurexTender(tenderId);
            const targetUrl = `${window.location.pathname || 'index.html'}#supplier-tender-detail`;
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
            window.app?.navigateTo?.('supplier-tender-detail');
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

        if (target.matches('[data-bid-submit]')) {
            if (!validateMandatoryGate(true)) {
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
            const declaration = wizard.querySelector('[data-bid-declaration]');
            if (declaration && !declaration.checked) {
                alert('Confirm the bid declaration before submitting.');
                return;
            }
            refreshBidTotals();
            const receiptHashValue = storeSubmittedBid();
            window.addProcurexCommunicationItem?.({
                kind: 'notification',
                category: 'Bid Submission',
                subject: 'Bid Submitted Successfully',
                body: `Your sealed bid for ${tenderId} has been submitted successfully. Receipt: ${receiptHashValue}.`,
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientType: 'Supplier',
                recipientName: mockData.users?.supplier?.organization || 'Supplier organization',
                tenderId,
                tenderReference: tenderId,
                tenderTitle: tender?.title || 'Tender',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionLabel: 'View Submission',
                actionPage: 'bidding-workspace',
                audience: ['supplier', 'all']
            });
            window.addProcurexCommunicationItem?.({
                kind: 'notification',
                category: 'Bid Submission',
                subject: 'New Bid Received',
                body: `${mockData.users?.supplier?.organization || 'A supplier'} has submitted a sealed bid for ${tenderId}. Bid details remain locked until the configured opening time.`,
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientType: 'Buyer',
                recipientName: tender?.organization || mockData.users?.buyer?.organization || 'Buyer organization',
                tenderId,
                tenderReference: tenderId,
                tenderTitle: tender?.title || 'Tender',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionLabel: 'Open Evaluation',
                actionPage: 'bid-evaluation',
                audience: ['buyer', 'admin', 'all']
            });
            saveDraft();
            setActiveStep(panels.length - 1, true);
            alert('Bid submitted successfully.');
        }
    });

    wizard.addEventListener('input', (event) => {
        if (event.target?.matches('[data-bid-rate], [data-works-cost]')) refreshBidTotals();
        if (event.target?.matches('[data-bid-response], [data-bid-free-response], [data-bid-product-spec-field]')) {
            validateMandatoryGate(false);
            validateWorkflowResponses(false);
            refreshBidResponseReviews();
            saveDraft();
        }
    });

    wizard.addEventListener('change', (event) => {
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
            refreshBidResponseReviews();
            saveDraft();
            return;
        }

        if (event.target?.matches('[data-bid-response], [data-bid-free-response], [data-bid-product-spec-field]')) {
            validateMandatoryGate(false);
            validateWorkflowResponses(false);
            refreshBidResponseReviews();
            saveDraft();
        }
    });

    refreshBidTotals();
    refreshBidUploadControls();
    validateMandatoryGate(false);
    validateWorkflowResponses(false);
    refreshBidResponseReviews();
    setActiveStep(activeStepIndex);
    wizard.dataset.ready = 'true';
}

if (window.app) {
    window.app.renderBiddingWorkspace = renderBiddingWorkspace;
}

window.getBidWorkspaceRequirementSet = getBidWorkspaceRequirementSet;
window.initializeBiddingWorkspace = initializeBiddingWorkspace;
