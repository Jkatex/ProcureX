// Create Tender Page Component (Buyer procurement design wizard)

function getCreateTenderSetup() {
    const fallbackTypes = [
        {
            id: 'works',
            label: 'Works',
            description: 'Construction and infrastructure projects.',
            categories: ['Healthcare infrastructure']
        }
    ];
    const setup = mockData.procurementSetup || {};
    const types = Array.isArray(setup.types) && setup.types.length ? setup.types : fallbackTypes;
    const methods = ['Open Tender', 'Invited Tender'];
    const defaultType = types.find(type => type.id === setup.defaultType) || types[0];

    return { types, methods, defaultType };
}

const createTenderOtherCategoryLabel = 'Other';
const createTenderOpenMethod = 'Open Tender';
const createTenderClosedMethod = 'Invited Tender';

function renderCreateTenderOptions(options, selectedValue = '') {
    const blankOption = selectedValue ? '' : '<option value="" selected></option>';
    return blankOption + options
        .map(option => `<option ${option === selectedValue ? 'selected' : ''}>${escapeCreateTenderHtml(option)}</option>`)
        .join('');
}

function isCreateTenderOtherCategory(value) {
    return String(value || '').trim().toLowerCase() === createTenderOtherCategoryLabel.toLowerCase();
}

function getCreateTenderCategoryOptions(categories = []) {
    const options = Array.isArray(categories) ? categories.filter(Boolean) : [];
    return options.some(isCreateTenderOtherCategory) ? options : [...options, createTenderOtherCategoryLabel];
}

function normalizeCreateTenderCategories(value = []) {
    const rawItems = Array.isArray(value)
        ? value
        : String(value || '').split(',').map(item => item.trim());
    const seen = new Set();

    return rawItems
        .map(item => String(item || '').trim())
        .filter(item => item && !isCreateTenderOtherCategory(item))
        .filter(item => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getCreateTenderSelectedCategories(mainDraft = {}) {
    const fromList = normalizeCreateTenderCategories(mainDraft.categories);
    return fromList.length ? fromList : normalizeCreateTenderCategories(mainDraft.category);
}

function renderCreateTenderSelectedCategoryRows(categories = []) {
    if (!categories.length) {
        return '<div class="scope-empty">No categories added yet.</div>';
    }

    return categories.map(category => `
        <div class="selected-category-row" data-selected-category="${escapeCreateTenderHtml(category)}">
            <span>${escapeCreateTenderHtml(category)}</span>
            <button class="boq-row-action icon-delete-btn" type="button" data-category-remove="${escapeCreateTenderHtml(category)}" aria-label="Remove ${escapeCreateTenderHtml(category)}" title="Remove category">${renderCreateTenderTrashIcon()}</button>
        </div>
    `).join('');
}

function getCreateTenderWizardCategories(wizard) {
    return normalizeCreateTenderCategories(Array.from(wizard?.querySelectorAll('[data-selected-category]') || [])
        .map(item => item.dataset.selectedCategory));
}

function getCreateTenderWizardCategoryValue(wizard, fallbackCategory = '') {
    return getCreateTenderWizardCategories(wizard).join(', ') || fallbackCategory;
}

const createTenderBoqStorageKey = 'procurex.createTender.v2.boqItems';
const createTenderCommercialTypeStorageKey = 'procurex.createTender.v2.commercialType';
const createTenderMilestoneStorageKey = 'procurex.createTender.v2.milestones';
const createTenderDeliverableStorageKey = 'procurex.createTender.v2.deliverables';
const createTenderDeliverableTypeStorageKey = 'procurex.createTender.v2.deliverableType';
const createTenderLicenseStorageKey = 'procurex.createTender.v2.regulatoryLicenses';
const createTenderLicenseTypeStorageKey = 'procurex.createTender.v2.regulatoryLicenseType';
const createTenderAttachmentStorageKey = 'procurex.createTender.v2.requiredAttachments';
const createTenderAttachmentTypeStorageKey = 'procurex.createTender.v2.attachmentType';
const createTenderContactStorageKey = 'procurex.createTender.v2.contactDetails';
const createTenderDraftStorageKey = 'procurex.createTender.v2.savedDraft';
const createTenderPublishedStorageKey = 'procurex.marketplace.publishedTenders';
const createTenderSelectedTenderStorageKey = 'procurex.marketplace.selectedTenderId';
const createTenderLegacyContractClauseFieldIds = new Set([
    'goodsContractClauseCards',
    'worksContractClauseCards',
    'servicesContractClauseCards',
    'consultancyContractClauseCards'
]);
const createTenderLegacyConsultancyRequirementFieldIds = new Set([
    'consultancyGeographicCoverage',
    'consultancyCounterpartStaff',
    'consultancyWorkSchedule',
    'consultancyEthicalRequirements',
    'consultancyKnowledgeTransfer',
    'consultancyIpDataOwnership',
    'consultancyProfessionalRegistration',
    'consultancyStaffingRequirements'
]);

const createTenderFixedConsultancyCardControlIds = new Set([
    'consultancyIndividualQualifications',
    'consultancyFirmExperience',
    'consultancyReportingStructure',
    'consultancyCoordinationArrangements',
    'consultancyAdministrativeArrangements'
]);

const createTenderProfessionalRegistrationCertificationOptions = [
    'ERB',
    'PSPTB',
    'NBAA',
    'Tanganyika Law Society',
    'Medical Council of Tanganyika',
    'Architects and Quantity Surveyors Registration Board',
    'ISO 9001',
    'ISO 14001',
    'OSHA',
    'Project Management Professional (PMP)',
    'Certified Public Accountant (CPA)',
    'Professional Engineer',
    'Other'
];

const defaultCreateTenderBoqItems = [];

const defaultCreateTenderMilestones = [
    { id: 'milestone-publication', name: 'Publication', date: '' },
    { id: 'milestone-clarification', name: 'Clarification deadline', date: '' },
    { id: 'milestone-closing', name: 'Bid closing', date: '' },
    { id: 'milestone-opening', name: 'Bid opening', date: '' },
    { id: 'milestone-evaluation', name: 'Evaluation complete', date: '' },
    { id: 'milestone-award', name: 'Award target', date: '' }
];

const defaultCreateTenderDeliverables = [];

const defaultCreateTenderAttachments = [];

const createTenderRegulatoryLicenseCatalog = [
    { group: 'Food, Drugs and Cosmetics', license: 'Food Business Permit / Food Handling License', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
    { group: 'Food, Drugs and Cosmetics', license: 'Pharmaceutical Business License', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
    { group: 'Food, Drugs and Cosmetics', license: 'Medical Devices Registration Permit', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
    { group: 'Food, Drugs and Cosmetics', license: 'Cosmetics Registration Certificate', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
    { group: 'Energy and Water (EWURA)', license: 'Petroleum Retail Outlet License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
    { group: 'Energy and Water (EWURA)', license: 'Petroleum Wholesale License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
    { group: 'Energy and Water (EWURA)', license: 'Electricity Generation License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
    { group: 'Energy and Water (EWURA)', license: 'Electricity Distribution and Supply License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
    { group: 'Energy and Water (EWURA)', license: 'Water Supply and Sanitation Services License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
    { group: 'Communications and Transport', license: 'Content Services License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
    { group: 'Communications and Transport', license: 'Network Facilities License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
    { group: 'Communications and Transport', license: 'Application Services License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
    { group: 'Communications and Transport', license: 'Electronic Communications Service License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
    { group: 'Communications and Transport', license: 'Shipping Agency License', body: 'Tanzania Shipping Agencies Corporation (TASAC)' },
    { group: 'Communications and Transport', license: 'Port Services License', body: 'Tanzania Shipping Agencies Corporation (TASAC)' },
    { group: 'Mining and Natural Resources', license: 'Reconnaissance License', body: 'Ministry of Minerals' },
    { group: 'Mining and Natural Resources', license: 'Prospecting License', body: 'Ministry of Minerals' },
    { group: 'Mining and Natural Resources', license: 'Primary Mining License', body: 'Ministry of Minerals' },
    { group: 'Mining and Natural Resources', license: 'Mining License', body: 'Ministry of Minerals' },
    { group: 'Mining and Natural Resources', license: 'Special Mining License', body: 'Ministry of Minerals' },
    { group: 'Mining and Natural Resources', license: "Explosives Dealer's License", body: 'Ministry of Minerals' },
    { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'Contractors Registration Board (CRB) and Local Government Authorities' },
    { group: 'Construction and Real Estate', license: 'Building Permit', body: 'Contractors Registration Board (CRB) and Local Government Authorities' },
    { group: 'Construction and Real Estate', license: 'Environmental Building Approval', body: 'Contractors Registration Board (CRB) and Local Government Authorities' },
    { group: 'Environmental and Safety', license: 'Environmental Impact Assessment Certificate', body: 'National Environment Management Council (NEMC)' },
    { group: 'Environmental and Safety', license: 'Environmental Compliance Certificate', body: 'National Environment Management Council (NEMC)' },
    { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)' },
    { group: 'Finance and Banking', license: 'Banking Business License', body: 'Bank of Tanzania (BOT)' },
    { group: 'Finance and Banking', license: 'Financial Institution License', body: 'Bank of Tanzania (BOT)' },
    { group: 'Finance and Banking', license: 'Microfinance Business License', body: 'Bank of Tanzania (BOT)' },
    { group: 'Finance and Banking', license: 'Foreign Exchange Bureau License', body: 'Bank of Tanzania (BOT)' },
    { group: 'Finance and Banking', license: 'Capital Markets and Securities Dealer License', body: 'Capital Markets and Securities Authority (CMSA)' },
    { group: 'Finance and Banking', license: 'Investment Adviser License', body: 'Capital Markets and Securities Authority (CMSA)' },
    { group: 'Finance and Banking', license: 'Fund Manager License', body: 'Capital Markets and Securities Authority (CMSA)' },
    { group: 'Specialized Services', license: 'Hazardous Chemicals Handling Certificate', body: 'Government Chemist Laboratory Authority (GCLA)' },
    { group: 'Specialized Services', license: 'Weights and Measures Inspection Certificate', body: 'Weights and Measures Agency (WMA)' },
    { group: 'Specialized Services', license: 'Calibration Certificate', body: 'Weights and Measures Agency (WMA)' }
];

const defaultCreateTenderRegulatoryLicenses = [];

const createTenderRequirementOptions = {
    currencies: ['TZS', 'USD', 'EUR', 'GBP'],
    fundingSources: ['Government of Tanzania', 'Own Source', 'Donor Funded', 'Development Partner', 'Loan', 'Grant', 'Other'],
    procurementMethods: ['Open Tender', 'Invited Tender'],
    worksContractTypes: ['Lump Sum Contract', 'Unit Price Contract', 'Fixed Price Contract', 'Framework Contract', 'Consultancy / Time-Based Contract', 'Other'],
    worksDocumentTypes: ['Architectural drawings', 'Structural drawings', 'Electrical drawings', 'Mechanical drawings', 'Geotechnical report', 'Environmental report', 'Other'],
    worksTechnicalSpecificationTitles: ['Applicable standards / codes', 'Material specifications', 'Workmanship standards', 'Engineering requirements', 'Equipment requirements', 'Others'],
    serviceTypes: ['Security', 'Cleaning', 'Vehicle maintenance', 'Generator maintenance', 'Catering', 'IT Support', 'Consultancy', 'Internet services', 'Transport / logistics', 'Maintenance', 'Training', 'Other'],
    serviceTemplates: ['Cleaning Services Template', 'Security Services Template', 'Consultancy Services Template', 'Waste Management Template', 'ICT Support Services Template'],
    financialRequirementTypes: ['Minimum Annual Turnover', 'Average Annual Turnover', 'Positive Net Worth', 'Working Capital', 'Access to Credit', 'Bank Statement Requirement', 'Audited Financial Statements'],
    financialPeriods: ['Annual', 'Current', 'Last 12 Months', 'Last 3 Years', 'Last 5 Years'],
    financialEvidence: ['Audited accounts', 'Bank statement', 'Bank letter', 'Credit facility letter', 'Tax clearance', 'Management accounts'],
    serviceCategories: ['Security', 'Cleaning', 'Maintenance', 'Transport', 'Catering', 'IT Support', 'Consultancy', 'Training', 'Waste Management', 'Other'],
    educationLevels: ['Certificate', 'Diploma', 'Bachelor Degree', 'Postgraduate Diploma', 'Masters Degree', 'Professional Qualification'],
    ownershipTypes: ['Owned', 'Leased', 'Either'],
    equipmentEvidence: ['Logbook', 'Lease agreement', 'Purchase receipt', 'Photos', 'Inspection certificate', 'Availability declaration'],
    esCategories: ['Worker Safety', 'Gender and SEA/SH', 'Environmental Protection', 'Labor Compliance', 'Other'],
    esEvidence: ['Policy document', 'Certificate', 'Training records', 'Environmental plan', 'Compliance report', 'Procedure manual'],
    evaluationMethods: ['Pass/Fail', 'Scored', 'Compliance Review'],
    responseTypes: ['Upload', 'Text response', 'Yes/No', 'Upload + Text'],
    units: ['Pcs', 'Unit', 'Set', 'Lot', 'Kg', 'Litre', 'Meter', 'Sqm', 'Day', 'Month'],
    materialQualities: ['Standard', 'Premium', 'Certified', 'Industrial grade', 'Food grade', 'Medical grade'],
    standards: ['ISO', 'TBS', 'CE', 'UL', 'Energy Star', 'Manufacturer certificate'],
    certifications: ['ISO 9001', 'ISO 14001', 'OSHA', 'Professional registration', 'Manufacturer certification'],
    frequency: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On demand'],
    serviceLevels: ['Basic', 'Standard', 'Premium', 'Critical'],
    yesNo: ['Yes', 'No']
};

const createTenderWorksContractTypeDescriptions = {
    'Lump Sum Contract': 'A single total price is agreed for the whole work or project.',
    'Unit Price Contract': 'Payment is based on measured quantities completed.',
    'Fixed Price Contract': 'The supplier agrees to deliver goods or services at a fixed agreed price.',
    'Framework Contract': 'Used for repeated or recurring procurement over a defined period.',
    'Consultancy / Time-Based Contract': 'Payment is based on consultant time, milestones, or agreed service duration.'
};

function createTenderFinancialCapacitySection() {
    return {
        id: 'financialCapacity',
        title: 'Financial Capacity Requirements',
        hint: 'Structured financial rules used to verify whether bidders can sustain the contract.',
        controls: [
            {
                id: 'financialRequirementRows',
                label: 'Financial requirements',
                type: 'table',
                addLabel: 'Add Financial Requirement',
                emptyText: 'No financial requirements added yet.',
                columns: [
                    { id: 'requirementType', label: 'Requirement type', type: 'select', options: createTenderRequirementOptions.financialRequirementTypes },
                    { id: 'minimumValue', label: 'Minimum value', type: 'number' },
                    { id: 'period', label: 'Period', type: 'select', options: createTenderRequirementOptions.financialPeriods },
                    { id: 'evidenceRequired', label: 'Evidence required', type: 'tag-select', options: createTenderRequirementOptions.financialEvidence },
                    { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
                ]
            }
        ]
    };
}

const createTenderRequirementTemplates = {
    goods: {
        title: 'Goods Tender Requirements',
        sections: [
           {
                id: 'quantitySchedule',
                title: 'Quantity Schedule / BOQ',
                hint: 'Editable table with row numbering and calculated totals.',
                controls: [
                    {
                        id: 'quantityScheduleRows',
                        label: 'Quantity lines',
                        type: 'table',
                        addLabel: 'Add Item',
                        importLabel: 'Import Excel',
                        emptyText: 'No items added yet.',
                        columns: [
                            { id: 'itemNumber', label: 'Item', type: 'index' },
                            { id: 'itemDescription', label: 'Description', type: 'text' },
                            { id: 'unitOfMeasure', label: 'Unit', type: 'select', options: createTenderRequirementOptions.units },
                            { id: 'quantity', label: 'Qty', type: 'number' },
                            { id: 'unitPrice', label: 'Unit price', type: 'currency' },
                            { id: 'totalPrice', label: 'Total', type: 'calculated', formula: 'quantity*unitPrice' }
                        ]
                    }
                ]
            },
            {
                id: 'technicalSpecifications',
                title: 'Product Specification Builder',
                hint: 'specification that suppliers must respond to.',
                controls: [
                    {
                        id: 'productSpecificationTemplate',
                        label: 'Product specification table',
                        type: 'product-spec-builder'
                    }
                ]
            },
            {
                id: 'sampleRequirements',
                title: 'Sample Requirements',
                hint: 'Enable samples only when buyers need physical samples before evaluation or award.',
                controls: [
                    { id: 'requireSamples', label: 'Require Samples?', type: 'yesno' },
                    {
                        id: 'sampleRequirementRows',
                        label: 'Sample requirement design',
                        type: 'table',
                        addLabel: 'Add Sample Requirement',
                        emptyText: 'No sample requirements added yet.',
                        requiresSourceOptions: true,
                        sourceEmptyText: 'Add at least one quantity item before adding sample requirements.',
                        showWhen: { field: 'requireSamples', value: 'Yes' },
                        columns: [
                            { id: 'relatedBoqItem', label: 'Related BOQ Item', type: 'source-select', sourceControlId: 'quantityScheduleRows', sourceLabelField: 'itemDescription' },
                            { id: 'sampleRequired', label: 'Sample Required', type: 'toggle' },
                            { id: 'numberOfSamples', label: 'Number of Samples', type: 'number' },
                            { id: 'sampleDescription', label: 'Sample Description', type: 'textarea' },
                            { id: 'deliveryLocation', label: 'Delivery Location', type: 'text' },
                            { id: 'deliveryDeadline', label: 'Delivery Deadline', type: 'date' },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' },
                            { id: 'returnableSample', label: 'Returnable Sample?', type: 'toggle' }
                        ]
                    }
                ]
            },
            createTenderFinancialCapacitySection(),
            
            {
                id: 'eligibilityRequirements',
                title: 'Other Eligibility Requirements',
                hint: 'Use add/remove requirement cards for supplier eligibility documents and notes.',
                controls: [
                    {
                        id: 'otherEligibilityRequirements',
                        label: 'Other requirements',
                        type: 'cards',
                        addLabel: 'Add Requirement',
                        emptyText: 'No other eligibility requirements added yet.',
                        fields: [
                            { id: 'requirementName', label: 'Requirement name', type: 'text' },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' },
                            { id: 'requiresUpload', label: 'Requires upload', type: 'toggle' },
                            { id: 'notes', label: 'Notes', type: 'textarea' }
                        ],
                        presets: ['Certificate of incorporation', 'Tax clearance certificate', 'VAT registration', 'Manufacturer authorization', 'Past supply contracts', 'Audited financial statements']
                    }
                ]
            }
        ]
    },
    works: {
        title: 'Works Tender Requirements',
        sections: [
            {
                id: 'generalInformation',
                title: '1. Project Overview',
                hint: 'Capture the purpose, buyer context, objective, and location of the works.',
                controls: [
                    { id: 'projectName', label: 'Project title', type: 'text' },
                    { id: 'procuringEntity', label: 'Procuring entity', type: 'text' },
                    { id: 'location', label: 'Project location', type: 'text' },
                    {
                        id: 'contractType',
                        label: 'Contract type',
                        type: 'select-custom-prompt',
                        options: createTenderRequirementOptions.worksContractTypes,
                        required: true,
                        helperDescriptions: createTenderWorksContractTypeDescriptions,
                        helperText: 'Select Other to type a contract type that is not listed.'
                    },
                    { id: 'completionPeriod', label: 'Completion period', type: 'text' }
                ]
            },
            {
                id: 'scopeDescription',
                title: '2. Scope Description',
                hint: 'Summarize the works, major construction activities, and any project notes.',
                controls: [
                    {
                        id: 'scopeSummary',
                        label: 'Scope Summary *',
                        type: 'textarea',
                        required: true,
                        maxLength: 1000,
                        rows: 6,
                        placeholder: 'Example: Construction of a 3-floor academic building including structural works, electrical installation, plumbing, roofing, doors and windows, finishing works and external works.',
                        helperText: 'Summarize the overall scope of the project including what the contractor is expected to do.'
                    },
                    {
                        id: 'mainConstructionActivities',
                        label: 'Main Activities *',
                        type: 'list',
                        required: true,
                        defaultValue: [
                            { text: 'Site preparation' },
                            { text: 'Foundation works' },
                            { text: 'Structural works' },
                            { text: 'Roofing works' },
                            { text: 'Electrical installation' }
                        ],
                        addLabel: '+ Add Activity',
                        emptyText: 'No activities added yet.',
                        helperText: 'List the major construction activities to be carried out.'
                    },
                ]
            },
            {
                id: 'technicalSpecifications',
                title: '3. Technical Specifications',
                hint: 'Detailed technical requirements and mandatory specification documents.',
                controls: [
                    {
                        id: 'technicalSpecificationDocuments',
                        label: 'Technical specification documents',
                        type: 'table',
                        addLabel: 'Add Specification Document',
                        emptyText: 'No specification documents added yet.',
                        columns: [
                            { id: 'documentTitle', label: 'Document title', type: 'select-custom-prompt', options: createTenderRequirementOptions.worksTechnicalSpecificationTitles },
                            { id: 'documentUpload', label: 'Upload document', type: 'file', accept: '.pdf,.doc,.docx,.xls,.xlsx' }
                        ]
                    }
                ]
            },
            {
                id: 'drawingsDesignDocuments',
                title: '4. Drawings and Design Documents',
                hint: 'Reference drawings, revisions, design consultants, and CAD/PDF uploads.',
                controls: [
                    {
                        id: 'drawingDesignRows',
                        label: 'Drawings and design documents',
                        type: 'table',
                        addLabel: 'Add Drawing',
                        emptyText: 'No drawings or design documents added yet.',
                        columns: [
                            { id: 'documentType', label: 'Document type', type: 'select', options: createTenderRequirementOptions.worksDocumentTypes },
                            { id: 'otherDocumentName', label: 'Other document name', type: 'text', showWhen: { field: 'documentType', value: 'Other' }, hideColumnUntilMatch: true, placeholder: 'Write document name' },
                            { id: 'buyerDocumentUpload', label: 'CAD / PDF upload', type: 'file', accept: '.pdf,.dwg,.dxf,.jpg,.jpeg,.png' }
                        ]
                    }
                ]
            },
            {
                id: 'boqRequirements',
                title: '5. Bill of Quantities (BoQ) / Pricing Schedule',
                hint: 'Commercial breakdown of works. Lump Sum uses summary pricing; Unit Price uses detailed measured items.',
                controls: [
                    {
                        id: 'lumpSumPricingRows',
                        label: 'Summary pricing schedule',
                        type: 'table',
                        addLabel: 'Add Pricing Section',
                        emptyText: 'No summary pricing sections added yet.',
                        showWhen: { field: 'contractType', value: 'Lump Sum Contract' },
                        columns: [
                            { id: 'section', label: 'Section', type: 'text' },
                            { id: 'description', label: 'Description', type: 'textarea' },
                            { id: 'amount', label: 'Amount', type: 'currency' }
                        ]
                    },
                    {
                        id: 'boqRows',
                        label: 'Bill of Quantities table',
                        type: 'table',
                        addLabel: 'Add BOQ Line',
                        importLabel: 'Import Excel',
                        emptyText: 'No BOQ lines added yet.',
                        columns: [
                            { id: 'workItem', label: 'Work item', type: 'text' },
                            { id: 'quantity', label: 'Qty', type: 'number' },
                            { id: 'unit', label: 'Unit', type: 'select', options: createTenderRequirementOptions.units },
                            { id: 'laborCost', label: 'Labor', type: 'currency' },
                            { id: 'materialCost', label: 'Materials', type: 'currency' },
                            { id: 'equipmentCost', label: 'Equipment', type: 'currency' },
                            { id: 'totalCost', label: 'Total', type: 'calculated', formula: 'laborCost+materialCost+equipmentCost' }
                        ]
                    }
                ]
            },
            {
                id: 'timeScheduleMilestones',
                title: '6. Time Schedule and Milestones',
                hint: 'Capture expected timelines, milestone triggers, and optional work program uploads.',
                controls: [
                    { id: 'commencementDate', label: 'Commencement date', type: 'date' },
                    { id: 'worksCompletionPeriod', label: 'Completion period', type: 'text' },
                    {
                        id: 'worksMilestoneRows',
                        label: 'Works milestones',
                        type: 'table',
                        addLabel: 'Add Milestone',
                        emptyText: 'No works milestones added yet.',
                        columns: [
                            { id: 'milestone', label: 'Milestone', type: 'text' },
                            { id: 'targetDate', label: 'Target date', type: 'date' },
                            { id: 'liquidatedDamagesTrigger', label: 'LD trigger', type: 'toggle' }
                        ]
                    }
                ]
            },
            {
                id: 'siteInformation',
                title: '7. Site Visit',
                hint: 'Important works-procurement context for access, utilities, infrastructure, and ground conditions.',
                controls: [
                    {
                        id: 'siteVisitRequirement',
                        label: 'Site visit requirement',
                        type: 'choice',
                        defaultValue: 'Not mandatory',
                        options: ['Mandatory', 'Not mandatory']
                    },
                    { id: 'siteSurveyUpload', label: 'Site survey', type: 'upload-button', buttonLabel: 'Upload Site survey', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.dwg,.dxf', showWhen: { field: 'siteVisitRequirement', value: 'Not mandatory' } }
                ]
            },
            {
                id: 'technicalCapacity',
                title: 'Technical Capacity',
                hint: 'Turn each technical capacity evidence requirement on or off.',
                controls: [
                    { id: 'similarCompletedProjectsRequired', label: 'Similar completed projects', type: 'toggle', helperText: 'Require bidders to submit evidence of similar completed works.' },
                    { id: 'keyPersonnelCvsRequired', label: 'Key personnel CVs', type: 'toggle', helperText: 'Require CVs for proposed key personnel.' },
                    { id: 'bankStatementsRequired', label: 'Bank statements', type: 'toggle', helperText: 'Require bank statements as financial capacity evidence.' },
                    {
                        id: 'bankStatementPeriod',
                        label: 'Bank statement period',
                        type: 'textarea',
                        placeholder: 'Example: Submit bank statements covering the last 6 months.',
                        helperText: 'Describe how far back the bank statements should cover.',
                        showWhen: { field: 'bankStatementsRequired', value: true }
                    }
                ]
            },
            createTenderFinancialCapacitySection()
        ]
    },
    services: {
        title: 'Service Tender Requirements',
        sections: [
            {
                id: 'serviceDefinition',
                title: 'Service Definition',
                hint: 'Core mandatory details for the service being procured.',
                controls: [
                    { id: 'scopeOfServices', label: 'Scope of services', type: 'textarea' },
                    { id: 'serviceLocations', label: 'Service locations', type: 'list', addLabel: 'Add Service Location', emptyText: 'No service locations added yet.' },
                    { id: 'duration', label: 'Duration', type: 'text' }
                ]
            },
            createTenderFinancialCapacitySection(),
            {
                id: 'staffingRequirements',
                title: 'Personnel Requirements',
                hint: 'Position-based personnel requirements for labor-based and professional services.',
                controls: [
                    {
                        id: 'personnelRequirementRows',
                        label: 'Personnel table',
                        type: 'table',
                        addLabel: 'Add Personnel Requirement',
                        emptyText: 'No personnel requirements added yet.',
                        columns: [
                            { id: 'position', label: 'Role / position', type: 'text' },
                            { id: 'minimumEducation', label: 'Minimum education', type: 'select', options: createTenderRequirementOptions.educationLevels },
                            { id: 'minimumYearsExperience', label: 'Experience(Years)', type: 'number' },
                            { id: 'cvRequired', label: 'CV required', type: 'toggle' },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
                        ]
                    }
                ]
            },
            {
                id: 'securityRequirements',
                title: 'Security Service Requirements',
                hint: 'Shown for security tenders: guards, shifts, patrols, weapons, and control room requirements.',
                showWhen: { field: 'serviceCategory', value: 'Security' },
                controls: [
                    { id: 'numberOfGuards', label: 'Number of guards', type: 'number' },
                    { id: 'shiftSchedule', label: 'Shift schedule', type: 'text' },
                    { id: 'patrolFrequency', label: 'Patrol frequency', type: 'select', options: createTenderRequirementOptions.frequency },
                    { id: 'weaponRequirement', label: 'Weapons requirement', type: 'textarea' },
                    { id: 'controlRoomRequirement', label: 'Control room requirement', type: 'textarea' }
                ]
            },
            {
                id: 'cleaningRequirements',
                title: 'Cleaning Service Requirements',
                hint: 'Shown for cleaning tenders: schedules, materials, areas, and waste disposal.',
                showWhen: { field: 'serviceCategory', value: 'Cleaning' },
                controls: [
                    { id: 'cleaningAreas', label: 'Cleaning areas', type: 'textarea' },
                    { id: 'cleaningFrequency', label: 'Cleaning frequency', type: 'select', options: createTenderRequirementOptions.frequency },
                    { id: 'cleaningMaterials', label: 'Cleaning materials', type: 'textarea' },
                    { id: 'wasteDisposalRequirements', label: 'Waste disposal requirements', type: 'textarea' }
                ]
            },
            {
                id: 'deliverablesSection',
                title: 'Deliverables and Reports',
                hint: 'Shown for consultancy, IT implementation, research, audits, and training services.',
                showWhen: { field: 'serviceCategory', values: ['Consultancy', 'IT Support', 'Training', 'Other'] },
                controls: [
                    { id: 'serviceDeliverables', label: 'Deliverables', type: 'list', addLabel: 'Add Deliverable', emptyText: 'No deliverables added yet.' },
                    { id: 'serviceMilestones', label: 'Milestones', type: 'list', addLabel: 'Add Milestone', emptyText: 'No milestones added yet.' },
                    { id: 'reportingRequirements', label: 'Reporting requirements', type: 'textarea' }
                ]
            },
            {
                id: 'itSupportRequirements',
                title: 'IT Support / Internet Requirements',
                hint: 'Shown for IT support and internet services: SLA, uptime, and response requirements.',
                showWhen: { field: 'serviceCategory', values: ['IT Support', 'Internet services'] },
                controls: [
                    { id: 'slaRequirement', label: 'SLA requirement', type: 'textarea' },
                    { id: 'uptimeRequirement', label: 'Uptime requirement', type: 'text' },
                    { id: 'responseTime', label: 'Response time', type: 'text' },
                    { id: 'supportHours', label: 'Support hours', type: 'text' }
                ]
            },
            {
                id: 'maintenanceRequirements',
                title: 'Maintenance Requirements',
                hint: 'Shown for maintenance tenders: tools, spare parts, technicians, and service schedule.',
                showWhen: { field: 'serviceCategory', values: ['Vehicle maintenance', 'Generator maintenance', 'Maintenance'] },
                controls: [
                    { id: 'maintenanceSchedule', label: 'Maintenance schedule', type: 'textarea' },
                    { id: 'sparePartsRequirement', label: 'Spare parts requirement', type: 'textarea' },
                    { id: 'technicianRequirements', label: 'Technician requirements', type: 'textarea' }
                ]
            },
            {
                id: 'cateringRequirements',
                title: 'Catering Requirements',
                hint: 'Shown for catering tenders: menus, hygiene, and food certifications.',
                showWhen: { field: 'serviceCategory', value: 'Catering' },
                controls: [
                    { id: 'menuRequirements', label: 'Menu requirements', type: 'textarea' },
                    { id: 'hygieneRequirements', label: 'Hygiene requirements', type: 'textarea' },
                    { id: 'foodCertifications', label: 'Food certifications', type: 'list', addLabel: 'Add Certification', emptyText: 'No food certifications added yet.' }
                ]
            },
            {
                id: 'transportRequirements',
                title: 'Transport / Logistics Requirements',
                hint: 'Shown for transport and logistics tenders: fleet, insurance, and driver licenses.',
                showWhen: { field: 'serviceCategory', value: 'Transport / logistics' },
                controls: [
                    { id: 'fleetRequirements', label: 'Fleet requirements', type: 'textarea' },
                    { id: 'driverLicenseRequirements', label: 'Driver license requirements', type: 'textarea' },
                    { id: 'routeCoverage', label: 'Route / coverage requirements', type: 'textarea' }
                ]
            },
            {
                id: 'equipmentRequirements',
                title: 'Equipment Requirements',
                hint: 'Shown only for service categories where equipment is normally needed.',
                showWhen: { field: 'serviceCategory', values: ['Security', 'Cleaning', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Catering', 'Transport / logistics'] },
                controls: [
                    {
                        id: 'equipmentRequirementRows',
                        label: 'Equipment schedule',
                        type: 'table',
                        addLabel: 'Add Equipment',
                        emptyText: 'No equipment requirements added yet.',
                        columns: [
                            { id: 'equipmentName', label: 'Equipment name', type: 'text' },
                            { id: 'quantity', label: 'Minimum qty', type: 'number' },
                            { id: 'ownershipRequirement', label: 'Ownership type', type: 'select', options: createTenderRequirementOptions.ownershipTypes },
                            { id: 'technicalSpecification', label: 'Technical specification', type: 'textarea' },
                            { id: 'evidenceRequired', label: 'Evidence required', type: 'multiselect', options: createTenderRequirementOptions.equipmentEvidence },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' },
                            { id: 'evaluationMethod', label: 'Evaluation method', type: 'select', options: createTenderRequirementOptions.evaluationMethods },
                            { id: 'supplierResponseType', label: 'Response type', type: 'select', options: createTenderRequirementOptions.responseTypes }
                        ]
                    }
                ]
            },
            {
                id: 'environmentalSocialRequirements',
                title: 'Environmental and Social Requirements',
                hint: 'Categorized compliance requirements for worker safety, SEA/SH, environment, and labor compliance.',
                controls: [
                    {
                        id: 'esRequirementCards',
                        label: 'ES requirements',
                        type: 'cards',
                        addLabel: 'Add ES Requirement',
                        emptyText: 'No environmental or social requirements added yet.',
                        cardTitleField: 'category',
                        cardTitlePrefix: 'ES requirement for',
                        fields: [
                            { id: 'category', label: 'Category', type: 'select', options: createTenderRequirementOptions.esCategories },
                            { id: 'description', label: 'Description', type: 'textarea' },
                            { id: 'evidenceRequired', label: 'Evidence required', type: 'tag-select', options: createTenderRequirementOptions.esEvidence },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
                        ]
                    }
                ]
            },
            {
                id: 'supportingDocuments',
                title: 'Supporting Documents',
                hint: 'Define submission documents suppliers must upload or respond to.',
                controls: [
                    {
                        id: 'supportingDocumentRows',
                        label: 'Required documents',
                        type: 'table',
                        addLabel: 'Add Required Document',
                        emptyText: 'No supporting documents added yet.',
                        columns: [
                            { id: 'documentName', label: 'Document name', type: 'text' },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
                        ]
                    }
                ]
            },
            {
                id: 'insuranceRequirements',
                title: 'Insurance Requirements',
                hint: 'Shown for higher-risk services where insurance evidence is important.',
                showWhen: { field: 'serviceCategory', values: ['Security', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Transport / logistics'] },
                controls: [
                    { id: 'insuranceCovers', label: 'Required insurance covers', type: 'list', addLabel: 'Add Insurance Cover', emptyText: 'No insurance covers added yet.' },
                    { id: 'insuranceNotes', label: 'Insurance notes', type: 'textarea' }
                ]
            },
            {
                id: 'riskSafetyRequirements',
                title: 'Risk and Safety Requirements',
                hint: 'Shown for technical, field, maintenance, transport, and security services.',
                showWhen: { field: 'serviceCategory', values: ['Security', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Transport / logistics'] },
                controls: [
                    { id: 'riskAssessmentRequirement', label: 'Risk assessment requirement', type: 'textarea' },
                    { id: 'safetyPlanRequirement', label: 'Safety plan requirement', type: 'textarea' },
                    { id: 'ppeRequirements', label: 'PPE requirements', type: 'textarea' }
                ]
            }
        ]
    },
    consultancy: {
        title: 'Consultancy Tender Requirements',
        sections: [
            {
                id: 'consultancyIntroduction',
                title: '1. Introduction',
                hint: 'Provides assignment background, procuring entity context, project background, and the problem statement.',
                controls: [
                    {
                        id: 'consultancyEntityBackground',
                        label: '1.1 Procuring Entity Background',
                        type: 'cards',
                        addLabel: 'Add Entity Background',
                        emptyText: 'No procuring entity background captured yet.',
                        cardTitle: 'Procuring entity background',
                        fields: [
                            { id: 'organizationBackground', label: 'Organization Background', type: 'richtext' },
                            { id: 'departmentUnit', label: 'Department / Unit', type: 'select-custom-prompt', options: ['Procurement Management Unit', 'Finance', 'Planning', 'ICT', 'Engineering', 'Legal', 'User Department', 'Other'] }
                        ],
                        defaultValue: []
                    },
                    {
                        id: 'consultancyProjectBackground',
                        label: '1.2 Project Background',
                        type: 'accordion',
                        panels: [
                            { id: 'projectName', label: 'Project Name', type: 'text' },
                            { id: 'backgroundNarrative', label: 'Background Narrative' },
                            { id: 'existingChallenges', label: 'Existing Challenges' },
                            { id: 'currentSituation', label: 'Current Situation' },
                            { id: 'relatedInitiatives', label: 'Related Initiatives' }
                        ]
                    },
                    {
                        id: 'consultancyProblemStatement',
                        label: '1.3 Problem Statement',
                        type: 'accordion',
                        panels: [
                            { id: 'mainProblemDescription', label: 'Main Problem Description' },
                            { id: 'expectedImpact', label: 'Expected Impact' }
                        ]
                    }
                ]
            },
            {
                id: 'consultancyObjectives',
                title: '2. Objectives of the Consultancy',
                hint: 'Defines the general objective and specific outcomes expected from the assignment.',
                controls: [
                    { id: 'consultancyGeneralObjective', label: '2.1 General Objective', type: 'richtext' },
                    {
                        id: 'consultancySpecificObjectives',
                        label: '2.2 Specific Objectives',
                        type: 'cards',
                        addLabel: 'Add Objective',
                        emptyText: 'No specific objectives added yet.',
                        cardTitleField: 'objectiveTitle',
                        fields: [
                            { id: 'objectiveTitle', label: 'Objective Title', type: 'text' },
                            { id: 'objectiveDescription', label: 'Objective Description', type: 'textarea' },
                            { id: 'priorityLevel', label: 'Priority Level', type: 'select', options: ['High', 'Medium', 'Low'] }
                        ],
                        defaultValue: []
                    }
                ]
            },
            {
                id: 'consultancyScopeServices',
                title: '3. Scope of Consultancy Services',
                hint: 'Defines assignment activities and assignment boundaries.',
                controls: [
                    {
                        id: 'consultancyAssignmentActivities',
                        label: '3.1 Assignment Activities',
                        type: 'table',
                        addLabel: 'Add Activity',
                        emptyText: 'No assignment activities added yet.',
                        columns: [
                            { id: 'activityTitle', label: 'Activity Title', type: 'text' },
                            { id: 'detailedDescription', label: 'Detailed Description', type: 'richtext' },
                            { id: 'expectedOutput', label: 'Expected Output', type: 'text' },
                            { id: 'location', label: 'Location', type: 'text' },
                            { id: 'duration', label: 'Duration', type: 'number', suffix: 'days' }
                        ]
                    },
                    {
                        id: 'consultancyAssignmentBoundaries',
                        label: '3.2 Assignment Boundaries',
                        type: 'accordion',
                        panels: [
                            { id: 'outOfScopeActivities', label: 'Out-of-Scope Activities' }
                        ]
                    }
                ]
            },
            {
                id: 'consultancyResponsibilities',
                title: '4. Duties and Responsibilities of the Parties',
                hint: 'Defines obligations of the client and consultant.',
                controls: [
                    {
                        id: 'consultancyClientResponsibilities',
                        label: '4.1 Client Responsibilities',
                        type: 'cards',
                        addLabel: 'Add Client Responsibility',
                        emptyText: 'No client responsibilities added yet.',
                        cardTitleField: 'responsibilityTitle',
                        fields: [
                            { id: 'responsibilityTitle', label: 'Responsibility Title', type: 'text' },
                            { id: 'description', label: 'Description', type: 'textarea' },
                            { id: 'supportType', label: 'Support Type', type: 'select', options: ['Office access', 'Document access', 'Meeting coordination', 'Counterpart staff', 'Logistics', 'Data access', 'Other'] }
                        ],
                        defaultValue: []
                    },
                    {
                        id: 'consultancyConsultantResponsibilities',
                        label: '4.2 Consultant Responsibilities',
                        type: 'cards',
                        addLabel: 'Add Consultant Responsibility',
                        emptyText: 'No consultant responsibilities added yet.',
                        cardTitleField: 'responsibility',
                        fields: [
                            { id: 'responsibility', label: 'Responsibility', type: 'text' },
                            { id: 'description', label: 'Description', type: 'richtext' },
                            { id: 'reportingFrequency', label: 'Reporting Frequency', type: 'select', options: createTenderRequirementOptions.frequency }
                        ],
                        defaultValue: []
                    }
                ]
            },
            {
                id: 'consultancyDeliverablesTimeline',
                title: '5. Deliverables and Timeline',
                hint: 'Defines expected outputs and reporting requirements.',
                controls: [
                    {
                        id: 'consultancyDeliverables',
                        label: '5.1 Deliverables',
                        type: 'table',
                        addLabel: 'Add Deliverable',
                        emptyText: 'No deliverables added yet.',
                        columns: [
                            { id: 'deliverableName', label: 'Deliverable Name', type: 'text' },
                            { id: 'description', label: 'Description', type: 'richtext' },
                            { id: 'submissionTimeline', label: 'Submission Timeline', type: 'text', placeholder: 'e.g. 2 weeks or 2026-06-30' },
                            { id: 'formatRequired', label: 'Format Required', type: 'select', options: ['PDF', 'Word', 'Excel', 'PowerPoint', 'Hard copy', 'Soft copy', 'Other'] },
                            { id: 'reviewer', label: 'Reviewer', type: 'select-custom-prompt', options: ['Project Manager', 'Supervising Officer', 'Accounting Officer', 'Evaluation Committee', 'User Department', 'Other'] },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
                        ]
                    },
                    {
                        id: 'consultancyReportingRequirements',
                        label: '5.2 Reporting Requirements',
                        type: 'table',
                        addLabel: 'Add Reporting Requirement',
                        emptyText: 'No reporting requirements added yet.',
                        columns: [
                            { id: 'reportType', label: 'Report Type', type: 'select', options: ['Weekly progress report', 'Monthly report', 'Inception report', 'Draft report', 'Final report', 'Ad hoc report'] },
                            { id: 'frequency', label: 'Frequency', type: 'select', options: createTenderRequirementOptions.frequency },
                            { id: 'submissionFormat', label: 'Submission Format', type: 'select', options: ['PDF', 'Word', 'Excel', 'PowerPoint', 'Hard copy', 'Soft copy'] },
                            { id: 'submissionChannel', label: 'Submission Channel', type: 'select', options: ['Procurement portal', 'Email', 'Physical submission', 'Project meeting', 'Other'] }
                        ]
                    }
                ]
            },
            {
                id: 'consultancyQualificationsExperience',
                title: '6. Required Qualifications and Experience',
                hint: 'Separates requirements for individual consultants or sole proprietors from consulting firms.',
                controls: [
                    {
                        id: 'consultancyIndividualQualifications',
                        label: '6.1 Individual / Sole Proprietor',
                        type: 'cards',
                        hideAdd: true,
                        hideDelete: true,
                        emptyText: 'No individual or sole proprietor requirements added yet.',
                        cardTitle: 'Individual / sole proprietor requirement',
                        fields: [
                            { id: 'professionalRegistrationsCertifications', label: 'Professional Registration / Certifications', type: 'repeatable-certification', options: createTenderProfessionalRegistrationCertificationOptions },
                            { id: 'cvRequired', label: 'CV', type: 'choice', defaultValue: 'Required', options: ['Required', 'Not required'], wide: true },
                            { id: 'yearsOfExperience', label: 'Years of Experience', type: 'number' },
                            { id: 'similarAssignmentsCount', label: 'Number of Similar Assignments', type: 'number' },
                            { id: 'similarAssignmentsEvidenceRequired', label: 'Similar Assignment Evidence', type: 'choice', defaultValue: 'Required', options: ['Required', 'Not required'] }
                        ],
                        defaultValue: [{ id: 'requirement-consultancyIndividualQualifications-fixed', professionalRegistrationsCertifications: [], cvRequired: 'Required', similarAssignmentsEvidenceRequired: 'Required' }]
                    },
                    {
                        id: 'consultancyFirmExperience',
                        label: '6.2 Consulting Firm - Firm Experience',
                        type: 'cards',
                        hideAdd: true,
                        hideDelete: true,
                        emptyText: 'No firm experience requirements added yet.',
                        cardTitle: 'Firm experience',
                        fields: [
                            { id: 'minimumYearsExperience', label: 'Minimum Years Experience', type: 'number' },
                            { id: 'requiredSimilarAssignments', label: 'Number of Similar Assignments', type: 'number' },
                            { id: 'sectorExperience', label: 'Sector Experience', type: 'tag-select', placeholder: 'Choose sector', emptyText: '', options: ['Public sector', 'Health', 'Education', 'Infrastructure', 'ICT', 'Finance', 'Environment', 'Energy', 'Water', 'Transport', 'Agriculture', 'Research'] },
                            { id: 'requiredEvidence', label: 'Similar Assignments Evidence', type: 'choice', defaultValue: 'Required', options: ['Required', 'Not required'] }
                        ],
                        defaultValue: [{ id: 'requirement-consultancyFirmExperience-fixed', sectorExperience: [], requiredEvidence: 'Required' }]
                    },
                    {
                        id: 'consultancyKeyExperts',
                        label: 'Consulting Firm - Key Personnel',
                        type: 'table',
                        addLabel: 'Add Key Personnel',
                        emptyText: 'No key personnel added yet.',
                        columns: [
                            { id: 'positionTitle', label: 'Position Title', type: 'text' },
                            { id: 'minimumQualification', label: 'Minimum Qualification', type: 'select-custom-prompt', options: createTenderRequirementOptions.educationLevels },
                            { id: 'yearsOfExperience', label: 'Years of Experience', type: 'number' },
                            { id: 'certifications', label: 'Certifications', type: 'text' },
                            { id: 'quantityRequired', label: 'Quantity Required', type: 'number' },
                            { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
                        ]
                    },
                    {
                        id: 'consultancyRegulatoryLicenses',
                        label: '',
                        type: 'regulatory-licenses'
                    }
                ]
            },
            createTenderFinancialCapacitySection(),
            {
                id: 'consultancyInstitutionalArrangements',
                title: '7. Institutional and Organizational Arrangements',
                hint: 'Defines reporting hierarchy, coordination arrangements, and administrative support.',
                controls: [
                    {
                        id: 'consultancyReportingStructure',
                        label: '7.1 Reporting Structure',
                        type: 'cards',
                        hideAdd: true,
                        hideDelete: true,
                        emptyText: 'No reporting structure added yet.',
                        cardTitle: 'Reporting structure',
                        fields: [
                            { id: 'consultantReportsTo', label: 'Consultant Reports To', type: 'select-custom-prompt', options: ['Project Manager', 'Supervising Officer', 'Accounting Officer', 'User Department', 'Steering Committee', 'Other'] },
                            { id: 'supervisingOfficer', label: 'Supervising Officer', type: 'select-custom-prompt', options: ['Project Manager', 'Head of Department', 'Director', 'Procurement Officer', 'Other'] },
                            { id: 'approvalAuthority', label: 'Approval Authority', type: 'select-custom-prompt', options: ['Accounting Officer', 'Tender Board', 'Project Steering Committee', 'User Department', 'Other'] }
                        ],
                        defaultValue: [{ id: 'requirement-consultancyReportingStructure-fixed' }]
                    },
                    {
                        id: 'consultancyCoordinationArrangements',
                        label: '7.2 Coordination Arrangements',
                        type: 'cards',
                        hideAdd: true,
                        hideDelete: true,
                        emptyText: 'No coordination arrangements added yet.',
                        cardTitle: 'Coordination arrangement',
                        fields: [
                            { id: 'meetingFrequency', label: 'Meeting Frequency', type: 'select', options: createTenderRequirementOptions.frequency },
                            { id: 'coordinationMechanism', label: 'Coordination Mechanism', type: 'richtext' },
                            { id: 'communicationMethod', label: 'Communication Method', type: 'multiselect', options: ['Email', 'Procurement portal', 'Physical meetings', 'Virtual meetings', 'Phone', 'Official letters'] }
                        ],
                        defaultValue: [{ id: 'requirement-consultancyCoordinationArrangements-fixed', communicationMethod: [] }]
                    },
                    {
                        id: 'consultancyAdministrativeArrangements',
                        label: '7.3 Administrative Arrangements',
                        type: 'cards',
                        hideAdd: true,
                        hideDelete: true,
                        emptyText: 'No administrative arrangements added yet.',
                        cardTitle: 'Administrative arrangements',
                        fields: [
                            { id: 'officeSpaceProvided', label: 'Office Space Provided', type: 'toggle' },
                            { id: 'accessToFacilities', label: 'Access to Facilities', type: 'toggle' },
                            { id: 'accessToDocuments', label: 'Access to Documents', type: 'toggle' }
                        ],
                        defaultValue: [{ id: 'requirement-consultancyAdministrativeArrangements-fixed' }]
                    }
                ]
            },
            {
                id: 'consultancyAttachmentsReferences',
                title: '8. Attachments and Reference Documents',
                hint: 'Supports consultants with background materials, policy documents, studies, drawings, and external references.',
                controls: [
                    {
                        id: 'consultancySupportingDocuments',
                        label: '8.1 Supporting Documents',
                        type: 'table',
                        addLabel: 'Add Supporting Document',
                        emptyText: 'No supporting documents added yet.',
                        columns: [
                            { id: 'documentTitle', label: 'Document Title', type: 'text' },
                            { id: 'fileUpload', label: 'File Upload', type: 'file', accept: '.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.jpg,.jpeg,.png' },
                            { id: 'category', label: 'Category', type: 'select', options: ['Existing reports', 'Policy documents', 'Architectural drawings', 'Baseline studies', 'Previous assessments', 'Other'] },
                            { id: 'confidential', label: 'Confidential', type: 'toggle' }
                        ]
                    },
                    {
                        id: 'consultancyExternalReferences',
                        label: '8.2 External References',
                        type: 'cards',
                        addLabel: 'Add External Reference',
                        emptyText: 'No external references added yet.',
                        cardTitleField: 'referenceName',
                        fields: [
                            { id: 'referenceName', label: 'Reference Name', type: 'text' },
                            { id: 'url', label: 'URL', type: 'text' },
                            { id: 'description', label: 'Description', type: 'textarea' }
                        ],
                        defaultValue: []
                    }
                ]
            }
        ]
    }
};

const createTenderTypeProfiles = {
    works: {
        id: 'works',
        commercialName: 'BOQ',
        commercialTitle: 'BOQ Editor',
        commercialDescription: 'Items, units, rates, and construction totals',
        commercialItemName: 'BOQ item',
        commercialEmptyText: 'No BOQ items added yet.',
        importHint: 'Use item, description, quantity, unit, and rate columns.',
        addLabel: 'Add BOQ Item',
        importLabel: 'Import BOQ',
        reviewLabel: 'BOQ estimate',
        scopeTitle: 'Specifications / Scope',
        scopeLabel: 'Scope of work',
        deliverablesTitle: 'Key deliverables',
        deliverablesHint: 'Manage each deliverable as a separate item.',
        attachmentHint: 'Add drawings, specifications, BOQ templates, forms, or declarations suppliers must submit.',
        responseTitle: 'Technical Response',
        responseFields: ['Relevant experience', 'Methodology'],
        assuranceTitle: 'Samples',
        assuranceBadge: 'Optional',
        defaultItems: defaultCreateTenderBoqItems,
        defaultDeliverables: defaultCreateTenderDeliverables,
        defaultAttachments: defaultCreateTenderAttachments,
        documentLabels: ['Engineering designs and drawings', 'Bills of quantities', 'Site reports', 'Material specifications', 'Conditions of contract'],
        keyRequirements: ['Project location and completion period', 'Contractor registration class', 'Key personnel CVs and certificates', 'Equipment ownership or lease proof', 'Insurance, tax certificates, and OSHA compliance'],
        planningDocuments: ['Engineering designs', 'Drawings', 'Environmental studies', 'Feasibility studies', 'Bills of quantities', 'Cost estimates'],
        submissionDocuments: ['Bid security', 'Completed legal forms', 'Work methodology', 'Construction schedule', 'Key personnel CVs', 'Equipment proof', 'Priced BOQ'],
        evaluationFlow: ['Administrative evaluation', 'Technical evaluation', 'Financial evaluation', 'Post qualification'],
        contractRequirements: ['Construction agreement', 'Performance security', 'Advance payment guarantee', 'Retention money', 'Defects liability period', 'Interim payment certificates'],
        evaluationStyle: 'Administrative, technical, financial, and post-qualification review with strong emphasis on methodology, personnel, equipment, experience, and BOQ pricing.',
        bidderPreparation: ['BOQ pricing', 'Work methodology', 'Construction schedule', 'Key personnel CVs', 'Equipment availability', 'Similar project evidence'],
        evaluationCriteria: [
            ['Technical capacity', 30, 'Team, equipment, methodology'],
            ['Relevant experience', 25, 'Healthcare construction history'],
            ['Financial proposal', 25, 'Price and payment realism'],
            ['Delivery schedule', 10, 'Milestone feasibility'],
            ['Compliance and ESG', 10, 'Licenses, safety, local participation']
        ]
    },
    goods: {
        id: 'goods',
        commercialName: 'Quantity Schedule',
        commercialTitle: 'Quantity Schedule / BOQ',
        commercialDescription: 'Item schedule, quantities, unit prices, and totals',
        commercialItemName: 'goods item',
        commercialEmptyText: 'No goods BOQ items added yet.',
        importHint: 'Use item, description, quantity, unit, and unit price columns.',
        addLabel: 'Add Goods Item',
        importLabel: 'Import Quantity Schedule',
        reviewLabel: 'Goods estimate',
        scopeTitle: 'Goods Specifications',
        scopeLabel: 'Goods requirements',
        deliverablesTitle: 'Required goods',
        deliverablesHint: 'List each supply, installation, warranty, or training deliverable.',
        attachmentHint: 'Add specifications, datasheets, delivery forms, warranty templates, and compliance declarations.',
        responseTitle: 'Goods Offer',
        responseFields: ['Technical compliance', 'Delivery and warranty plan'],
        assuranceTitle: 'Samples / Catalogs',
        assuranceBadge: 'If requested',
        defaultItems: [],
        defaultDeliverables: [],
        defaultAttachments: [],
        documentLabels: ['Technical specifications', 'Quantity schedule', 'Delivery requirements', 'Warranty terms', 'Compliance certificates'],
        keyRequirements: ['Product description and standards', 'Quantity and unit of measure', 'Delivery location and timeline', 'Warranty, packaging, shelf-life, and installation requirements', 'Manufacturer authorization where required'],
        planningDocuments: ['Procurement plan', 'Technical specifications document', 'Cost estimates', 'Market survey report'],
        submissionDocuments: ['Business license', 'Certificate of incorporation', 'Tax clearance certificate', 'VAT registration', 'Manufacturer authorization', 'Past supply contracts', 'Audited financial statements'],
        evaluationFlow: ['Preliminary examination', 'Technical evaluation', 'Financial evaluation', 'Award recommendation'],
        contractRequirements: ['Purchase order', 'Supply agreement', 'Delivery schedule', 'Inspection procedures', 'Warranty terms', 'Penalty clauses', 'Payment schedule'],
        evaluationStyle: 'Preliminary compliance, technical specification review, and financial comparison leading to the lowest evaluated responsive bidder.',
        bidderPreparation: ['Technical compliance sheet', 'Quantity schedule pricing', 'Delivery schedule', 'Warranty documents', 'Manufacturer authorization', 'Past supply evidence'],
        evaluationCriteria: [
            ['Specification compliance', 35, 'Mandatory technical conformity'],
            ['Delivery capacity', 20, 'Lead time, logistics, warranty support'],
            ['Financial proposal', 30, 'Unit pricing and lifecycle cost'],
            ['After-sales support', 10, 'Maintenance and spare parts'],
            ['Compliance documents', 5, 'Licenses and certifications']
        ]
    },
    services: {
        id: 'services',
        commercialName: 'Service Schedule',
        commercialTitle: 'Service Requirements',
        commercialDescription: 'Tasks, service levels, durations, and fee estimates',
        commercialItemName: 'service line',
        commercialEmptyText: 'No service requirement lines added yet.',
        importHint: 'Use code, service task, quantity or duration, unit, and fee columns.',
        addLabel: 'Add Service Line',
        importLabel: 'Import Service Schedule',
        reviewLabel: 'Service estimate',
        scopeTitle: 'Service Requirements',
        scopeLabel: 'Service scope',
        deliverablesTitle: 'Service outputs',
        deliverablesHint: 'List each operational output, SLA, report, or handover requirement.',
        attachmentHint: 'Add terms of reference, SLA schedule, reporting templates, and compliance declarations.',
        responseTitle: 'Service Response',
        responseFields: ['Service approach', 'SLA and staffing plan'],
        assuranceTitle: 'SLA Evidence',
        assuranceBadge: 'Required',
        defaultItems: [],
        defaultDeliverables: [],
        defaultAttachments: [],
        documentLabels: ['Scope of services', 'SLA / KPI schedule', 'Staffing requirements', 'Equipment requirements', 'Reporting templates'],
        keyRequirements: ['Tasks, frequency, and service locations', 'Service levels and KPIs', 'Staffing levels and qualifications', 'Equipment and tools', 'Response times, penalties, and reporting frequency'],
        planningDocuments: ['Scope of services', 'Service locations', 'Performance standards', 'Duration and renewal assumptions', 'Budget estimate'],
        submissionDocuments: ['Service methodology', 'Staffing plan', 'Staff qualifications and certifications', 'Equipment list', 'Experience evidence', 'Monthly or service rate schedule'],
        evaluationFlow: ['Technical evaluation', 'Financial evaluation', 'Award recommendation'],
        contractRequirements: ['Service level agreement (SLA)', 'KPIs', 'Reporting obligations', 'Penalty clauses', 'Renewal options', 'Payment schedule'],
        evaluationStyle: 'Technical and financial evaluation focused on methodology, staffing quality, equipment, experience, operational cost, and price competitiveness.',
        bidderPreparation: ['Service methodology', 'Staffing plan', 'SLA response', 'Equipment list', 'Experience evidence', 'Monthly/service rates'],
        evaluationCriteria: [
            ['Service methodology', 30, 'Approach, continuity, and quality controls'],
            ['Team capability', 25, 'Skills, availability, and supervision'],
            ['SLA compliance plan', 20, 'Response times and escalation'],
            ['Financial proposal', 15, 'Fee realism and value'],
            ['Compliance', 10, 'Licenses, references, and safeguards']
        ]
    },
    consultancy: {
        id: 'consultancy',
        commercialName: 'Financial Proposal',
        commercialTitle: 'Consultancy Requirements',
        commercialDescription: 'TOR outputs, expert inputs, reimbursables, and fee estimate',
        commercialItemName: 'consultancy input',
        commercialEmptyText: 'No consultancy requirement lines added yet.',
        importHint: 'Use code, input/output, level of effort, unit, and fee columns.',
        addLabel: 'Add Consultancy Input',
        importLabel: 'Import Financial Proposal',
        reviewLabel: 'Consultancy estimate',
        scopeTitle: 'Terms of Reference',
        scopeLabel: 'TOR summary',
        deliverablesTitle: 'Consultancy deliverables',
        deliverablesHint: 'List inception, draft, final, training, and reporting outputs.',
        attachmentHint: 'Add TOR, CV templates, methodology forms, and financial proposal templates.',
        responseTitle: 'Consultancy Proposal',
        responseFields: ['Technical methodology', 'Key expert plan'],
        assuranceTitle: 'Experts and CVs',
        assuranceBadge: 'Required',
        defaultItems: [],
        defaultDeliverables: [],
        defaultAttachments: [],
        documentLabels: ['Terms of Reference', 'Methodology template', 'Key expert CV template', 'Evaluation criteria', 'Financial proposal template'],
        keyRequirements: ['Background, objectives, scope, and deliverables', 'Methodology and work plan', 'Team composition and CVs', 'Firm and expert experience', 'Professional fees, reimbursables, taxes, and daily rates'],
        planningDocuments: ['Terms of Reference', 'Background and objectives', 'Scope and deliverables', 'Timeline', 'Reporting structure', 'Selection method'],
        submissionDocuments: ['Technical proposal', 'Understanding of assignment', 'Methodology', 'Work plan', 'Team composition', 'CVs', 'Financial proposal'],
        evaluationFlow: ['Technical evaluation', 'Financial evaluation', 'Combined ranking or method-specific selection', 'Award recommendation'],
        contractRequirements: ['Terms of Reference', 'Deliverables', 'Milestones', 'Payment schedule', 'Intellectual property clauses', 'Confidentiality clauses'],
        evaluationStyle: 'Quality-focused technical evaluation followed by financial evaluation using QCBS, QBS, Least Cost, or the configured consultancy selection method.',
        bidderPreparation: ['Technical proposal', 'Understanding of TOR', 'Methodology', 'Work plan', 'Team CVs', 'Relevant experience', 'Separate financial proposal when required'],
        evaluationCriteria: [
            ['Understanding of TOR', 25, 'Problem framing and proposed approach'],
            ['Methodology and work plan', 30, 'Quality, feasibility, and stakeholder plan'],
            ['Key expert qualifications', 25, 'Relevant professional experience'],
            ['Financial proposal', 10, 'Fee realism and value'],
            ['Knowledge transfer', 10, 'Training and sustainability']
        ]
    }
};

const createTenderEvaluationCatalog = {
    goods: [
        {
            id: 'goods-technical-compliance',
            name: 'Technical Compliance',
            category: 'Technical Compliance',
            defaultWeight: 40,
            subcriteria: [
                'Conformity to technical specifications',
                'Compliance with standards (ISO, TBS, etc.)',
                'Brand/model compliance',
                'Product performance characteristics',
                'Sample evaluation / testing results',
                'Compatibility with existing systems/equipment'
            ]
        },
        {
            id: 'goods-financial',
            name: 'Financial',
            category: 'Financial',
            defaultWeight: 30,
            subcriteria: ['Total price', 'Price competitiveness', 'Cost of maintenance']
        },
        {
            id: 'goods-delivery-logistics',
            name: 'Delivery and Logistics',
            category: 'Delivery and Logistics',
            defaultWeight: 15,
            subcriteria: [
                'Delivery time compliance',
                'Availability of stock',
                'Supply chain reliability',
                'Packaging and transportation method',
                'Installation requirement compliance'
            ]
        },
        {
            id: 'goods-quality-assurance',
            name: 'Quality Assurance',
            category: 'Quality Assurance',
            defaultWeight: 10,
            subcriteria: [
                'Warranty period offered',
                'After-sales support availability',
                'Replacement/return policy',
                'Quality certification of manufacturer'
            ]
        },
        {
            id: 'goods-supplier-capability',
            name: 'Supplier Capability',
            category: 'Supplier Capability',
            defaultWeight: 5,
            subcriteria: [
                'Past performance / similar supply experience',
                'Financial capacity of supplier',
                'Local presence / support office',
                'Authorized distributor/manufacturer status'
            ]
        }
    ],
    works: [
        {
            id: 'works-technical-methodology',
            name: 'Technical Methodology',
            category: 'Technical Methodology',
            defaultWeight: 20,
            subcriteria: [
                'Construction methodology',
                'Work execution plan',
                'Site mobilization strategy',
                'Risk management approach',
                'Quality control plan',
                'Environmental management plan'
            ]
        },
        {
            id: 'works-personnel',
            name: 'Personnel',
            category: 'Personnel',
            defaultWeight: 15,
            subcriteria: [
                'Project manager qualification',
                'Site engineer qualifications',
                'Safety officer competence',
                'Key technical staff experience',
                'Availability of required personnel'
            ]
        },
        {
            id: 'works-equipment-resources',
            name: 'Equipment and Resources',
            category: 'Equipment and Resources',
            defaultWeight: 10,
            subcriteria: [
                'Availability of construction equipment',
                'Ownership vs leased equipment',
                'Equipment capacity and suitability',
                'Mobilization timeline for equipment'
            ]
        },
        {
            id: 'works-experience',
            name: 'Experience',
            category: 'Experience',
            defaultWeight: 15,
            subcriteria: [
                'Similar completed projects',
                'Project value history',
                'Experience in similar terrain/environment',
                'Track record of timely completion'
            ]
        },
        {
            id: 'works-schedule-execution',
            name: 'Schedule and Execution',
            category: 'Schedule and Execution',
            defaultWeight: 10,
            subcriteria: [
                'Work program / timeline',
                'Milestone alignment',
                'Project completion duration',
                'Critical path feasibility'
            ]
        },
        {
            id: 'works-hse',
            name: 'Health, Safety and Environment (HSE)',
            category: 'Health, Safety and Environment (HSE)',
            defaultWeight: 10,
            subcriteria: [
                'Safety plan compliance',
                'Environmental mitigation measures',
                'Site safety record',
                'Compliance with regulations'
            ]
        },
        {
            id: 'works-financial',
            name: 'Financial',
            category: 'Financial',
            defaultWeight: 20,
            subcriteria: ['Total BOQ price', 'Unit rate accuracy', 'Price realism', 'Corrected tender sum']
        }
    ],
    services: [
        {
            id: 'services-delivery-approach',
            name: 'Service Delivery Approach',
            category: 'Service Delivery Approach',
            defaultWeight: 20,
            subcriteria: ['Service methodology', 'Operational plan', 'Service execution strategy', 'Workflow design']
        },
        {
            id: 'services-staffing-personnel',
            name: 'Staffing and Personnel',
            category: 'Staffing and Personnel',
            defaultWeight: 20,
            subcriteria: ['Staff qualifications', 'Staff availability', 'Training plan', 'Supervisory structure']
        },
        {
            id: 'services-service-capacity',
            name: 'Service Capacity',
            category: 'Service Capacity',
            defaultWeight: 10,
            subcriteria: [
                'Ability to scale service',
                'Resource availability',
                'Coverage area capability',
                'Backup/contingency resources'
            ]
        },
        {
            id: 'services-sla-performance',
            name: 'SLA and Performance',
            category: 'SLA and Performance',
            defaultWeight: 20,
            subcriteria: [
                'Response time',
                'Resolution time',
                'Service uptime guarantee',
                'Reporting frequency',
                'Escalation procedures'
            ]
        },
        {
            id: 'services-tools-systems',
            name: 'Tools and Systems',
            category: 'Tools and Systems',
            defaultWeight: 10,
            subcriteria: ['Use of technology/tools', 'Service management systems', 'Monitoring and reporting systems']
        },
        {
            id: 'services-experience',
            name: 'Experience',
            category: 'Experience',
            defaultWeight: 10,
            subcriteria: ['Similar service contracts', 'Industry experience', 'Client references', 'Performance history']
        },
        {
            id: 'services-financial',
            name: 'Financial',
            category: 'Financial',
            defaultWeight: 10,
            subcriteria: ['Service pricing model', 'Monthly/annual cost', 'Cost per unit/service', 'Value for money']
        }
    ],
    consultancy: [
        {
            id: 'consultancy-methodology-approach',
            name: 'Methodology and Approach',
            category: 'Methodology and Approach',
            defaultWeight: 30,
            subcriteria: [
                'Understanding of Terms of Reference (ToR)',
                'Methodology clarity',
                'Technical approach quality',
                'Innovation in approach',
                'Risk identification and mitigation',
                'Work plan and timeline'
            ]
        },
        {
            id: 'consultancy-key-experts',
            name: 'Key Experts',
            category: 'Key Experts',
            defaultWeight: 35,
            subcriteria: [
                'Team leader qualification',
                'Relevant academic qualifications',
                'Professional certifications',
                'Years of experience',
                'Similar assignments handled',
                'Role relevance to assignment'
            ]
        },
        {
            id: 'consultancy-firm-experience',
            name: 'Firm Experience',
            category: 'Firm Experience',
            defaultWeight: 15,
            subcriteria: [
                'Similar consultancy assignments',
                'Sector experience',
                'Regional experience',
                'Institutional capacity',
                'Past performance record'
            ]
        },
        {
            id: 'consultancy-work-plan-organization',
            name: 'Work Plan and Organization',
            category: 'Work Plan and Organization',
            defaultWeight: 10,
            subcriteria: [
                'Task allocation clarity',
                'Time schedule realism',
                'Resource allocation efficiency',
                'Deliverable structure'
            ]
        },
        {
            id: 'consultancy-knowledge-transfer',
            name: 'Knowledge Transfer',
            category: 'Knowledge Transfer',
            defaultWeight: 10,
            subcriteria: [
                'Training plan for client staff',
                'Capacity building approach',
                'Documentation quality',
                'Sustainability of results'
            ]
        },
        {
            id: 'consultancy-financial',
            name: 'Financial',
            category: 'Financial',
            defaultWeight: 0,
            subcriteria: [
                'Total consultancy fee',
                'Breakdown of costs',
                'Cost realism',
                'Budget alignment',
                'Price competitiveness'
            ]
        }
    ]
};

const defaultCreateTenderContact = {
    tenderLocation: '',
    contactName: '',
    phone: '',
    email: '',
    phoneVerified: false,
    emailVerified: false
};

const defaultCreateTenderMainDraft = {
    title: '',
    scope: '',
    procurementTypeId: '',
    method: createTenderOpenMethod,
    fundingSource: '',
    category: '',
    categories: [],
    visibility: 'Public marketplace',
    visibilityNote: 'Visible to everyone in the public marketplace.',
    invitedUsers: [],
    evaluation: {},
    systemEvaluation: {},
    requirements: {}
};

function escapeCreateTenderHtml(value = '') {
    return String(value)
        .replace(/and/g, 'andamp;')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function isCreateTenderClosedMethod(method = '') {
    return String(method || '').trim().toLowerCase() === createTenderClosedMethod.toLowerCase();
}

function normalizeCreateTenderMethod(method = '') {
    return isCreateTenderClosedMethod(method) ? createTenderClosedMethod : createTenderOpenMethod;
}

function getCreateTenderVisibilityForMethod(method = '') {
    return isCreateTenderClosedMethod(normalizeCreateTenderMethod(method)) ? 'Invited suppliers only' : 'Public marketplace';
}

function getCreateTenderVisibilityNoteForMethod(method = '', invitedCount = 0) {
    if (isCreateTenderClosedMethod(normalizeCreateTenderMethod(method))) {
        return invitedCount
            ? `Invitation will be sent to ${invitedCount} selected supplier${invitedCount === 1 ? '' : 's'}.`
            : 'Select suppliers to receive the tender invitation.';
    }
    return 'Visible to everyone in the public marketplace.';
}

function normalizeCreateTenderInvitedUser(user = {}, index = 0) {
    const name = String(user.name || user.supplier || user.organization || '').trim();
    const organization = String(user.organization || name).trim();
    return {
        id: String(user.id || name || `supplier-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name,
        organization,
        email: String(user.email || '').trim(),
        trustTier: String(user.trustTier || '').trim(),
        risk: String(user.risk || '').trim()
    };
}

function getCreateTenderInvitableUsers() {
    const sources = [
        mockData.users?.supplier,
        ...(mockData.bidEvaluation?.riskSignals || []),
        ...(mockData.bidEvaluation?.bids || [])
    ];
    const seen = new Set();
    return sources
        .map(normalizeCreateTenderInvitedUser)
        .filter(user => {
            const key = user.name.toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function renderCreateTenderInvitedUserRows(users = []) {
    if (!users.length) {
        return '<div class="scope-empty">No invited suppliers selected yet.</div>';
    }

    return users.map(user => `
        <div class="invited-user-row" data-invited-user="${escapeCreateTenderHtml(user.id)}">
            <div>
                <strong>${escapeCreateTenderHtml(user.name)}</strong>
                <span>${escapeCreateTenderHtml(user.organization || 'Supplier')}</span>
            </div>
            <button class="boq-row-action icon-delete-btn" type="button" data-invited-user-remove="${escapeCreateTenderHtml(user.id)}" aria-label="Remove ${escapeCreateTenderHtml(user.name)}" title="Remove supplier">${renderCreateTenderTrashIcon()}</button>
        </div>
    `).join('');
}

function getCreateTenderRequirementTemplate(profileId = 'works') {
    return createTenderRequirementTemplates[profileId] || createTenderRequirementTemplates.works;
}

function getCreateTenderRequirementDefaultFields(profileId = 'works') {
    return getCreateTenderRequirementTemplate(profileId).sections
        .flatMap(section => section.controls || [])
        .reduce((defaults, control) => {
            if (control.defaultValue !== undefined) {
                defaults[control.id] = Array.isArray(control.defaultValue)
                    ? control.defaultValue.map(item => ({ ...item }))
                    : control.defaultValue && typeof control.defaultValue === 'object'
                        ? { ...control.defaultValue }
                        : control.defaultValue;
            }
            return defaults;
        }, {});
}

function sanitizeCreateTenderRequirementFields(profileId = 'works', fields = {}) {
    const sanitizedFields = { ...(fields || {}) };
    createTenderLegacyContractClauseFieldIds.forEach(fieldId => delete sanitizedFields[fieldId]);
    delete sanitizedFields.fundingSource;

    if (profileId === 'consultancy') {
        createTenderLegacyConsultancyRequirementFieldIds.forEach(fieldId => delete sanitizedFields[fieldId]);
        createTenderFixedConsultancyCardControlIds.forEach(controlId => {
            if (!Array.isArray(sanitizedFields[controlId]) || !sanitizedFields[controlId].length) {
                sanitizedFields[controlId] = getCreateTenderRequirementDefaultFields('consultancy')[controlId] || [{ id: `requirement-${controlId}-fixed` }];
            }
        });

        if (Array.isArray(sanitizedFields.consultancyEntityBackground)) {
            sanitizedFields.consultancyEntityBackground = sanitizedFields.consultancyEntityBackground.map(item => {
                const { procurementReferenceNo, projectName, fundingSource, ...rest } = item || {};
                return rest;
            });
        }

        if (sanitizedFields.consultancyAssignmentBoundaries && typeof sanitizedFields.consultancyAssignmentBoundaries === 'object') {
            const { constraints, ...rest } = sanitizedFields.consultancyAssignmentBoundaries;
            sanitizedFields.consultancyAssignmentBoundaries = rest;
        }

        if (Array.isArray(sanitizedFields.consultancySpecificObjectives)) {
            sanitizedFields.consultancySpecificObjectives = sanitizedFields.consultancySpecificObjectives.map(item => {
                const { mandatory, ...rest } = item || {};
                return rest;
            });
        }

        if (Array.isArray(sanitizedFields.consultancyAssignmentActivities)) {
            sanitizedFields.consultancyAssignmentActivities = sanitizedFields.consultancyAssignmentActivities.map(item => {
                const { mandatoryActivity, ...rest } = item || {};
                return rest;
            });
        }
    }

    return sanitizedFields;
}

function getCreateTenderMainFundingSource(mainDraft = getCreateTenderMainDraft()) {
    const directValue = String(mainDraft.fundingSource || '').trim();
    if (directValue) return directValue;

    const requirements = mainDraft.requirements && typeof mainDraft.requirements === 'object' ? mainDraft.requirements : {};
    const directRequirementValue = ['works', 'services']
        .map(profileId => String(requirements[profileId]?.fields?.fundingSource || '').trim())
        .find(Boolean);
    if (directRequirementValue) return directRequirementValue;

    const entityBackground = requirements.consultancy?.fields?.consultancyEntityBackground;
    if (!Array.isArray(entityBackground)) return '';

    const backgroundFundingSource = entityBackground
        .map(item => String(item?.fundingSource || '').trim())
        .find(Boolean);
    return backgroundFundingSource || '';
}

function getCreateTenderRequirementDraft(profileId = 'works') {
    const mainDraft = getCreateTenderMainDraft();
    const requirements = mainDraft.requirements && typeof mainDraft.requirements === 'object' ? mainDraft.requirements : {};
    const fields = sanitizeCreateTenderRequirementFields(profileId, {
        ...getCreateTenderRequirementDefaultFields(profileId),
        ...(requirements[profileId]?.fields || {})
    });
    return {
        fields,
        lists: { ...(requirements[profileId]?.lists || {}) }
    };
}

function saveCreateTenderRequirementDraft(profileId, requirementDraft) {
    const mainDraft = getCreateTenderMainDraft();
    saveCreateTenderMainDraft({
        requirements: {
            ...(mainDraft.requirements || {}),
            [profileId]: {
                fields: { ...(requirementDraft.fields || {}) },
                lists: { ...(requirementDraft.lists || {}) }
            }
        }
    });
}

function normalizeCreateTenderRequirementItem(item = {}, index = 0) {
    return {
        id: String(item.id || `requirement-${Date.now()}-${index}`),
        text: String(item.text || '').trim()
    };
}

function normalizeCreateTenderRequirementTextItems(items = [], controlId = 'item') {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
        if (typeof item === 'string') {
            return {
                id: `requirement-${controlId}-${Date.now()}-${index}`,
                text: item
            };
        }
        return {
            id: String(item.id || `requirement-${controlId}-${Date.now()}-${index}`),
            text: String(item.text || '')
        };
    });
}

function normalizeCreateTenderRequirementTableRows(rows = [], columns = [], controlId = 'table') {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => {
        const normalizedRow = {
            id: String(row?.id || `requirement-${controlId}-${Date.now()}-${index}`)
        };
        columns.forEach(column => {
            if (column.type === 'multiselect' || column.type === 'tag-select' || column.type === 'repeatable-text') {
                normalizedRow[column.id] = Array.isArray(row?.[column.id]) ? row[column.id].map(String) : [];
                return;
            }
            if (column.type === 'repeatable-certification') {
                normalizedRow[column.id] = normalizeCreateTenderCertificationItems(row?.[column.id]);
                return;
            }
            if (column.type === 'toggle') {
                normalizedRow[column.id] = Boolean(row?.[column.id]);
                return;
            }
            if (column.type !== 'index' && column.type !== 'calculated') {
                normalizedRow[column.id] = String(row?.[column.id] || '');
            }
        });
        return normalizedRow;
    });
}

function normalizeCreateTenderRequirementObjectRows(rows = [], fields = [], controlId = 'card') {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => {
        const normalizedRow = {
            id: String(row?.id || `requirement-${controlId}-${Date.now()}-${index}`)
        };
        fields.forEach(field => {
            if (field.type === 'multiselect' || field.type === 'tag-select' || field.type === 'repeatable-text') {
                normalizedRow[field.id] = Array.isArray(row?.[field.id]) ? row[field.id].map(String) : [];
                return;
            }
            if (field.type === 'repeatable-certification') {
                normalizedRow[field.id] = normalizeCreateTenderCertificationItems(row?.[field.id]);
                return;
            }
            if (field.type === 'toggle') {
                normalizedRow[field.id] = Boolean(row?.[field.id]);
                return;
            }
            normalizedRow[field.id] = String(row?.[field.id] || '');
        });
        return normalizedRow;
    });
}

function getCreateTenderRequirementControl(profileId = 'works', controlId = '') {
    const template = getCreateTenderRequirementTemplate(profileId);
    return template.sections
        .flatMap(section => section.controls || [])
        .find(control => control.id === controlId);
}

function renderCreateTenderRequirementSelectOptions(options = [], selectedValue = '') {
    return '<option value=""></option>' + options.map(option => {
        const optionValue = typeof option === 'object' && option !== null ? String(option.value || '') : String(option);
        const optionLabel = typeof option === 'object' && option !== null ? String(option.label || option.value || '') : String(option);
        return `<option value="${escapeCreateTenderHtml(optionValue)}" ${optionValue === String(selectedValue || '') ? 'selected' : ''}>${escapeCreateTenderHtml(optionLabel)}</option>`;
    }).join('');
}

function getCreateTenderRequirementSourceOptions(profileId = '', field = {}) {
    const sourceControlId = field.sourceControlId;
    if (!sourceControlId) return [];

    const sourceControl = getCreateTenderRequirementControl(profileId, sourceControlId);
    if (!sourceControl || sourceControl.type !== 'table') return [];

    const requirementDraft = getCreateTenderRequirementDraft(profileId);
    const rows = normalizeCreateTenderRequirementTableRows(
        requirementDraft.fields?.[sourceControlId],
        sourceControl.columns || [],
        sourceControlId
    );
    const labelField = field.sourceLabelField || 'label';

    return rows.map((row, index) => {
        const label = row[labelField] || `Item ${index + 1}`;
        return {
            value: row.id,
            label: `${index + 1}. ${label}`
        };
    });
}

function resolveCreateTenderRequirementFields(control, profileId = '') {
    return (control.fields || []).map(field => {
        if (field.type !== 'source-select') return field;
        return {
            ...field,
            type: 'select',
            options: getCreateTenderRequirementSourceOptions(profileId, field)
        };
    });
}

function resolveCreateTenderRequirementColumns(control, profileId = '') {
    return (control.columns || []).map(column => {
        if (column.type !== 'source-select') return column;
        return {
            ...column,
            type: 'select',
            options: getCreateTenderRequirementSourceOptions(profileId, column)
        };
    });
}

function getCreateTenderVisibleRequirementColumns(columns = [], rows = []) {
    return columns.filter(column => {
        if (!column.hideColumnUntilMatch || !column.showWhen) return true;
        return rows.some(row => String(row?.[column.showWhen.field] || '') === String(column.showWhen.value));
    });
}

function getCreateTenderRequirementCardTitle(control, card, cardIndex, fields = []) {
    const titleFieldId = control.cardTitleField;
    const titleField = fields.find(field => field.id === titleFieldId);
    const selectedValue = titleFieldId ? String(card[titleFieldId] || '') : '';
    const selectedOption = (titleField?.options || []).find(option => {
        const optionValue = typeof option === 'object' && option !== null ? String(option.value || '') : String(option);
        return optionValue === selectedValue;
    });
    const selectedLabel = selectedOption
        ? (typeof selectedOption === 'object' && selectedOption !== null ? String(selectedOption.label || selectedOption.value || '') : String(selectedOption))
        : '';

    if (selectedValue && !selectedOption) {
        return control.cardTitlePrefix ? `${control.cardTitlePrefix} ${selectedValue}` : selectedValue;
    }

    if (selectedLabel && control.cardTitlePrefix) {
        return `${control.cardTitlePrefix} ${selectedLabel}`;
    }

    return control.cardTitle || `${control.label} ${cardIndex + 1}`;
}

function renderCreateTenderRequirementMultiSelect(options = [], selectedValues = [], attributes = '') {
    const selectedSet = new Set(Array.isArray(selectedValues) ? selectedValues.map(String) : []);
    return `
        <div class="requirement-multi-select">
            ${options.map(option => {
                const optionValue = String(option);
                return `
                    <label class="requirement-check-option">
                        <input type="checkbox" value="${escapeCreateTenderHtml(optionValue)}" ${selectedSet.has(optionValue) ? 'checked' : ''} ${attributes}>
                        <span>${escapeCreateTenderHtml(optionValue)}</span>
                    </label>
                `;
            }).join('')}
        </div>
    `;
}

function renderCreateTenderRequirementTagSelect(field, value, attributes = '') {
    const selectedValues = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    const selectedSet = new Set(selectedValues);
    const availableOptions = (field.options || [])
        .map(getCreateTenderRequirementOptionValue)
        .filter(option => option && !selectedSet.has(option));
    const emptyText = field.emptyText === undefined ? 'No evidence selected' : field.emptyText;
    const placeholder = field.placeholder || 'Choose evidence';

    return `
        <div class="requirement-tag-select">
            <div class="requirement-tag-list">
                ${selectedValues.length
                    ? selectedValues.map(option => `
                        <span class="requirement-tag">
                            ${escapeCreateTenderHtml(option)}
                            <button type="button" data-requirement-tag-remove="${escapeCreateTenderHtml(option)}" aria-label="Remove ${escapeCreateTenderHtml(option)}">x</button>
                        </span>
                    `).join('')
                    : (emptyText ? `<span class="requirement-tag-empty">${escapeCreateTenderHtml(emptyText)}</span>` : '')}
            </div>
            <select class="form-input requirement-tag-picker" ${attributes}>
                <option value="">${escapeCreateTenderHtml(placeholder)}</option>
                ${availableOptions.map(option => `<option value="${escapeCreateTenderHtml(option)}">${escapeCreateTenderHtml(option)}</option>`).join('')}
            </select>
        </div>
    `;
}

function normalizeCreateTenderCertificationItems(value = []) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (typeof item === 'string') {
                return { name: item, mandatory: false };
            }
            return {
                name: String(item?.name || item?.certification || '').trim(),
                mandatory: Boolean(item?.mandatory)
            };
        })
        .filter(item => item.name);
}

function renderCreateTenderRequirementRepeatableText(field, value) {
    const selectedValues = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    return `
        <div class="requirement-tag-select requirement-repeatable-text" data-requirement-repeatable-field="${escapeCreateTenderHtml(field.id)}">
            <div class="requirement-tag-list">
                ${selectedValues.length
                    ? selectedValues.map(option => `
                        <span class="requirement-tag">
                            ${escapeCreateTenderHtml(option)}
                            <button type="button" data-requirement-repeatable-remove="${escapeCreateTenderHtml(option)}" aria-label="Remove ${escapeCreateTenderHtml(option)}">x</button>
                        </span>
                    `).join('')
                    : '<span class="requirement-tag-empty">No certifications added</span>'}
            </div>
            <div class="requirement-repeatable-add-row">
                <input class="form-input" type="text" data-requirement-repeatable-input placeholder="${escapeCreateTenderHtml(field.placeholder || 'Add item')}" aria-label="${escapeCreateTenderHtml(field.label)}">
                <button class="btn btn-secondary" type="button" data-requirement-repeatable-add>Add</button>
            </div>
        </div>
    `;
}

function renderCreateTenderRequirementRepeatableCertification(field, value) {
    const selectedItems = normalizeCreateTenderCertificationItems(value);
    return `
        <div class="requirement-tag-select requirement-repeatable-certification" data-requirement-repeatable-field="${escapeCreateTenderHtml(field.id)}">
            <div class="requirement-tag-list">
                ${selectedItems.length
                    ? selectedItems.map(item => {
                        const itemKey = `${item.name}::${item.mandatory ? 'mandatory' : 'optional'}`;
                        return `
                            <span class="requirement-tag">
                                ${escapeCreateTenderHtml(item.name)} - ${item.mandatory ? 'Mandatory' : 'Optional'}
                                <button type="button" data-requirement-repeatable-remove="${escapeCreateTenderHtml(itemKey)}" aria-label="Remove ${escapeCreateTenderHtml(item.name)}">x</button>
                            </span>
                        `;
                    }).join('')
                    : '<span class="requirement-tag-empty">No certifications or registrations added</span>'}
            </div>
            <div class="requirement-repeatable-certification-row">
                <select class="form-input" data-requirement-repeatable-input aria-label="${escapeCreateTenderHtml(field.label)}">
                    <option value="">Select certification / registration</option>
                    ${(field.options || []).map(option => `<option value="${escapeCreateTenderHtml(getCreateTenderRequirementOptionValue(option))}">${escapeCreateTenderHtml(getCreateTenderRequirementOptionValue(option))}</option>`).join('')}
                </select>
                <label class="requirement-toggle-cell">
                    <span>Mandatory</span>
                    <span class="requirement-toggle">
                        <input type="checkbox" data-requirement-repeatable-mandatory>
                        <span></span>
                    </span>
                </label>
            </div>
            <button class="btn btn-secondary scope-add" type="button" data-requirement-repeatable-add>Add Certification / Registration</button>
        </div>
    `;
}

function parseCreateTenderRequirementAmount(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function calculateCreateTenderRequirementFormula(formula = '', row = {}) {
    if (formula.includes('*')) {
        return formula.split('*').map(part => parseCreateTenderRequirementAmount(row[part.trim()])).reduce((total, value) => total * value, 1);
    }
    if (formula.includes('+')) {
        return formula.split('+').map(part => parseCreateTenderRequirementAmount(row[part.trim()])).reduce((total, value) => total + value, 0);
    }
    return parseCreateTenderRequirementAmount(row[formula.trim()]);
}

function formatCreateTenderRequirementCalculatedValue(value) {
    return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function renderCreateTenderRequirementField(field, value, attributes = '') {
    const requiredAttribute = field.required ? 'required' : '';
    const placeholderAttribute = field.placeholder ? `placeholder="${escapeCreateTenderHtml(field.placeholder)}"` : '';
    const maxLengthAttribute = field.maxLength ? `maxlength="${escapeCreateTenderHtml(field.maxLength)}"` : '';
    if (field.type === 'select') {
        return `<select class="form-input" ${requiredAttribute} ${attributes}>${renderCreateTenderRequirementSelectOptions(field.options || [], value)}</select>`;
    }
    if (field.type === 'select-custom-prompt') {
        const optionValues = (field.options || []).map(getCreateTenderRequirementOptionValue);
        const selectedValue = String(value || '');
        if (selectedValue === 'Other' || selectedValue === 'Others' || (selectedValue && !optionValues.includes(selectedValue))) {
            return `
                <div class="requirement-custom-select-field">
                    <input class="form-input" type="text" value="${selectedValue === 'Other' || selectedValue === 'Others' ? '' : escapeCreateTenderHtml(selectedValue)}" ${requiredAttribute} placeholder="${escapeCreateTenderHtml(field.customPlaceholder || 'Type value')}" ${attributes}>
                    <button class="btn btn-secondary" type="button" data-requirement-reset-select="${escapeCreateTenderHtml(field.id)}">Choose from list</button>
                </div>
            `;
        }
        return `<select class="form-input" ${requiredAttribute} ${attributes}>${renderCreateTenderRequirementSelectOptions(field.options || [], value)}</select>`;
    }
    if (field.type === 'combobox') {
        const listId = `requirement-${field.id}-options`;
        return `
            <input class="form-input" type="text" list="${escapeCreateTenderHtml(listId)}" value="${escapeCreateTenderHtml(value || '')}" ${requiredAttribute} ${placeholderAttribute} ${maxLengthAttribute} ${attributes}>
            <datalist id="${escapeCreateTenderHtml(listId)}">
                ${(field.options || []).map(option => `<option value="${escapeCreateTenderHtml(getCreateTenderRequirementOptionValue(option))}"></option>`).join('')}
            </datalist>
        `;
    }
    if (field.type === 'yesno') {
        const radioAttributes = attributes.replace(/\bid="[^"]*"\s*/g, '');
        const selectedValue = String(value || 'No');
        const name = `requirement-${field.id}`;
        return `
            <div class="requirement-choice-group" role="radiogroup" aria-label="${escapeCreateTenderHtml(field.label)}">
                ${['Yes', 'No'].map(option => `
                    <label class="requirement-choice-option">
                        <input type="radio" name="${escapeCreateTenderHtml(name)}" value="${option}" ${selectedValue === option ? 'checked' : ''} ${radioAttributes}>
                        <span>${option}</span>
                    </label>
                `).join('')}
            </div>
        `;
    }
    if (field.type === 'choice') {
        const radioAttributes = attributes.replace(/\bid="[^"]*"\s*/g, '');
        const selectedValue = String(value || field.defaultValue || '');
        const name = `requirement-${field.id}`;
        return `
            <div class="requirement-choice-group" role="radiogroup" aria-label="${escapeCreateTenderHtml(field.label)}">
                ${(field.options || []).map(option => {
                    const optionValue = typeof option === 'object' && option !== null ? String(option.value || '') : String(option);
                    const optionLabel = typeof option === 'object' && option !== null ? String(option.label || option.value || '') : String(option);
                    return `
                        <label class="requirement-choice-option">
                            <input type="radio" name="${escapeCreateTenderHtml(name)}" value="${escapeCreateTenderHtml(optionValue)}" ${selectedValue === optionValue ? 'checked' : ''} ${radioAttributes}>
                            <span>${escapeCreateTenderHtml(optionLabel)}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        `;
    }
    if (field.type === 'multiselect') {
        return renderCreateTenderRequirementMultiSelect(field.options || [], value, attributes);
    }
    if (field.type === 'tag-select') {
        return renderCreateTenderRequirementTagSelect(field, value, attributes);
    }
    if (field.type === 'repeatable-text') {
        return renderCreateTenderRequirementRepeatableText(field, value);
    }
    if (field.type === 'repeatable-certification') {
        return renderCreateTenderRequirementRepeatableCertification(field, value);
    }
    if (field.type === 'toggle') {
        return `
            <label class="requirement-toggle">
                <input type="checkbox" ${value ? 'checked' : ''} ${attributes}>
                <span></span>
            </label>
        `;
    }
    if (field.type === 'textarea' || field.type === 'richtext') {
        return `<textarea class="form-input requirement-rich-input" rows="${escapeCreateTenderHtml(field.rows || 3)}" ${requiredAttribute} ${placeholderAttribute} ${maxLengthAttribute} ${attributes}>${escapeCreateTenderHtml(value || '')}</textarea>`;
    }
    if (field.type === 'file') {
        return `
            <div class="requirement-file-field">
                <input class="form-input" type="file" ${field.accept ? `accept="${escapeCreateTenderHtml(field.accept)}"` : ''} ${attributes}>
                <span>${value ? escapeCreateTenderHtml(value) : 'No file selected'}</span>
            </div>
        `;
    }
    if (field.type === 'upload-button') {
        const fileAttributes = attributes.replace(/\bid="[^"]*"\s*/g, '');
        return `
            <div class="requirement-upload-button-field">
                <button class="btn btn-secondary" type="button" data-upload-button-trigger="${escapeCreateTenderHtml(field.id)}">${escapeCreateTenderHtml(field.buttonLabel || 'Upload file')}</button>
                <input type="file" ${field.accept ? `accept="${escapeCreateTenderHtml(field.accept)}"` : ''} ${fileAttributes} hidden>
                <span class="form-hint">${value ? escapeCreateTenderHtml(value) : 'No file selected'}</span>
            </div>
        `;
    }
    if (field.type === 'currency') {
        return `<input class="form-input requirement-currency-input" type="number" min="0" step="0.01" value="${escapeCreateTenderHtml(value || '')}" ${attributes}>`;
    }
    const inputMarkup = `<input class="form-input" type="${escapeCreateTenderHtml(field.type || 'text')}" value="${escapeCreateTenderHtml(value || '')}" ${requiredAttribute} ${placeholderAttribute} ${maxLengthAttribute} ${attributes}>`;
    if (field.suffix) {
        return `<div class="requirement-input-affix">${inputMarkup}<span>${escapeCreateTenderHtml(field.suffix)}</span></div>`;
    }
    return inputMarkup;
}

function getCreateTenderRequirementHelperText(control = {}, value = '') {
    const selectedValue = String(value || '');
    if (control.helperDescriptions && selectedValue && control.helperDescriptions[selectedValue]) {
        return control.helperDescriptions[selectedValue];
    }
    return control.helperText || '';
}

function isCreateTenderShowWhenMatched(showWhen = {}, fields = {}) {
    if (!showWhen.field) return true;
    const actualValue = fields?.[showWhen.field];
    if (Array.isArray(showWhen.values)) {
        return showWhen.values.map(String).includes(String(actualValue || ''));
    }
    return String(actualValue || '') === String(showWhen.value);
}

function renderCreateTenderRequirementCounter(control = {}, value = '') {
    if (!control.maxLength) return '';
    const currentLength = String(value || '').length;
    return `<span class="form-hint requirement-character-counter" data-requirement-counter="${escapeCreateTenderHtml(control.id)}">${currentLength}/${escapeCreateTenderHtml(control.maxLength)}</span>`;
}

function renderCreateTenderRequirementListRows(items = [], listId = '') {
    const normalizedItems = normalizeCreateTenderRequirementTextItems(items, listId);
    if (!normalizedItems.length) {
        return '<div class="scope-empty">No requirements added yet.</div>';
    }

    return normalizedItems.map(item => `
        <div class="requirement-list-row" data-requirement-row="${escapeCreateTenderHtml(item.id)}" data-requirement-list="${escapeCreateTenderHtml(listId)}">
            <input class="form-input requirement-list-input" value="${escapeCreateTenderHtml(item.text)}" data-requirement-list-input aria-label="Requirement item">
            <button class="boq-row-action icon-delete-btn" type="button" data-requirement-delete aria-label="Remove requirement" title="Remove requirement">${renderCreateTenderTrashIcon()}</button>
        </div>
    `).join('');
}

function renderCreateTenderRequirementControlList(control, value) {
    return `
        <div class="requirement-control-list" data-requirement-list-items="${escapeCreateTenderHtml(control.id)}">
            ${renderCreateTenderRequirementControlListItems(control, value)}
        </div>
        <button class="btn btn-secondary scope-add" type="button" data-requirement-control-add="${escapeCreateTenderHtml(control.id)}">${escapeCreateTenderHtml(control.addLabel || `Add ${control.label}`)}</button>
    `;
}

function renderCreateTenderRequirementControlListItems(control, value) {
    const items = normalizeCreateTenderRequirementTextItems(value, control.id);
    if (!items.length) {
        return `<div class="scope-empty">${escapeCreateTenderHtml(control.emptyText || 'No items added yet.')}</div>`;
    }

    return items.map(item => `
        <div class="requirement-control-row" data-requirement-control-row="${escapeCreateTenderHtml(item.id)}" data-requirement-control="${escapeCreateTenderHtml(control.id)}">
            <input class="form-input requirement-list-input" value="${escapeCreateTenderHtml(item.text)}" data-requirement-list-item aria-label="${escapeCreateTenderHtml(control.label)} item">
            <button class="boq-row-action icon-delete-btn" type="button" data-requirement-control-delete="${escapeCreateTenderHtml(control.id)}" aria-label="Remove ${escapeCreateTenderHtml(control.label)}" title="Remove item">${renderCreateTenderTrashIcon()}</button>
        </div>
    `).join('');
}

function renderCreateTenderScopeActivityRows(control, value) {
    const items = normalizeCreateTenderRequirementTextItems(value, control.id);
    if (!items.length) {
        return `<div class="scope-empty">${escapeCreateTenderHtml(control.emptyText || 'No activities added yet.')}</div>`;
    }

    return items.map(item => `
        <div class="scope-activity-row" data-requirement-control-row="${escapeCreateTenderHtml(item.id)}" data-requirement-control="${escapeCreateTenderHtml(control.id)}">
            <span class="scope-activity-handle" aria-hidden="true">::</span>
            <input class="scope-activity-input" value="${escapeCreateTenderHtml(item.text)}" data-requirement-list-item aria-label="${escapeCreateTenderHtml(control.label)} item">
            <button class="boq-row-action icon-delete-btn scope-activity-delete" type="button" data-requirement-control-delete="${escapeCreateTenderHtml(control.id)}" aria-label="Remove ${escapeCreateTenderHtml(control.label)}" title="Remove activity">${renderCreateTenderTrashIcon()}</button>
        </div>
    `).join('');
}

function renderCreateTenderScopeDescriptionSection(section, requirementDraft, profileId = '') {
    const controls = section.controls || [];
    const scopeSummary = controls.find(control => control.id === 'scopeSummary');
    const activities = controls.find(control => control.id === 'mainConstructionActivities');
    const dependencies = controls.find(control => control.id === 'dependenciesNotes');

    return `
        <article class="requirement-block scope-description-block">
            <div class="scope-description-heading">
                <h4>${escapeCreateTenderHtml(section.title)}</h4>
                <p>${escapeCreateTenderHtml(section.hint)}</p>
            </div>
            ${scopeSummary ? `
                <div class="scope-field-group">
                    <span class="form-label">${escapeCreateTenderHtml(scopeSummary.label)}</span>
                    <span class="form-hint">${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(scopeSummary, requirementDraft.fields?.[scopeSummary.id]))}</span>
                    ${renderCreateTenderRequirementControl(scopeSummary, requirementDraft.fields?.[scopeSummary.id], profileId)}
                    ${renderCreateTenderRequirementCounter(scopeSummary, requirementDraft.fields?.[scopeSummary.id])}
                </div>
            ` : ''}
            ${activities ? `
                <div class="scope-field-group scope-activity-group">
                    <div class="scope-activity-heading">
                        <div>
                            <span class="form-label">${escapeCreateTenderHtml(activities.label)}</span>
                            <span class="form-hint">${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(activities, requirementDraft.fields?.[activities.id]))}</span>
                        </div>
                        <button class="btn btn-secondary scope-add scope-activity-add" type="button" data-requirement-control-add="${escapeCreateTenderHtml(activities.id)}">${escapeCreateTenderHtml(activities.addLabel || '+ Add Activity')}</button>
                    </div>
                    <div class="scope-activity-list" data-requirement-list-items="${escapeCreateTenderHtml(activities.id)}">
                        ${renderCreateTenderScopeActivityRows(activities, requirementDraft.fields?.[activities.id])}
                    </div>
                </div>
            ` : ''}
            ${dependencies ? `
                <div class="scope-field-group">
                    <span class="form-label">${escapeCreateTenderHtml(dependencies.label)}</span>
                    <span class="form-hint">${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(dependencies, requirementDraft.fields?.[dependencies.id]))}</span>
                    ${renderCreateTenderRequirementControl(dependencies, requirementDraft.fields?.[dependencies.id], profileId)}
                </div>
            ` : ''}
        </article>
    `;
}

function renderCreateTenderTechnicalCapacitySection(section, requirementDraft, profileId = '') {
    const visibleControls = (section.controls || []).filter(control => {
        if (!control.showWhen) return true;
        return isCreateTenderShowWhenMatched(control.showWhen, requirementDraft.fields);
    });

    return `
        <article class="requirement-block technical-capacity-block">
            <div>
                <h4>${escapeCreateTenderHtml(section.title)}</h4>
                <span class="form-hint">${escapeCreateTenderHtml(section.hint)}</span>
            </div>
            <div class="technical-capacity-list">
                ${visibleControls.map(control => {
                    const value = Boolean(requirementDraft.fields?.[control.id]);
                    if (control.type !== 'toggle') {
                        return `
                            <div class="technical-capacity-detail-row">
                                <span class="form-label">${escapeCreateTenderHtml(control.label)}</span>
                                <span class="form-hint">${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(control, requirementDraft.fields?.[control.id]))}</span>
                                ${renderCreateTenderRequirementControl(control, requirementDraft.fields?.[control.id], profileId)}
                            </div>
                        `;
                    }
                    return `
                        <div class="technical-capacity-row">
                            <div>
                                <strong>${escapeCreateTenderHtml(control.label)}</strong>
                                <span>${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(control, value))}</span>
                            </div>
                            ${renderCreateTenderRequirementControl(control, value, profileId)}
                        </div>
                    `;
                }).join('')}
            </div>
        </article>
    `;
}

function renderCreateTenderRequirementTableRows(rows = [], control, profileId = '') {
    const columns = resolveCreateTenderRequirementColumns(control, profileId);
    const normalizedRows = normalizeCreateTenderRequirementTableRows(rows, columns, control.id);
    const visibleColumns = getCreateTenderVisibleRequirementColumns(columns, normalizedRows);
    if (!normalizedRows.length) {
        return `
            <tr>
                <td colspan="${visibleColumns.length + 1}">
                    <div class="scope-empty">${escapeCreateTenderHtml(control.emptyText || 'No rows added yet.')}</div>
                </td>
            </tr>
        `;
    }

    return normalizedRows.map((row, rowIndex) => `
        <tr data-requirement-table-row="${escapeCreateTenderHtml(row.id)}" data-requirement-control="${escapeCreateTenderHtml(control.id)}" data-requirement-table-row-index="${rowIndex}">
            ${visibleColumns.map(column => {
                if (column.type === 'index') {
                    return `<td><span class="requirement-auto-value">${rowIndex + 1}</span></td>`;
                }
                if (column.type === 'calculated') {
                    const calculatedValue = calculateCreateTenderRequirementFormula(column.formula, row);
                    return `<td><span class="requirement-auto-value" data-requirement-calculated-field="${escapeCreateTenderHtml(column.id)}">${formatCreateTenderRequirementCalculatedValue(calculatedValue)}</span></td>`;
                }
                const shouldShow = !column.showWhen || String(row[column.showWhen.field] || '') === String(column.showWhen.value);
                return `
                    <td ${shouldShow ? '' : 'class="requirement-conditional-cell muted"'}>
                        ${shouldShow
                            ? renderCreateTenderRequirementField(column, row[column.id], `data-requirement-table-field="${escapeCreateTenderHtml(column.id)}" aria-label="${escapeCreateTenderHtml(column.label)}"`)
                            : `<span class="requirement-auto-value">-</span>`}
                    </td>
                `;
            }).join('')}
            <td class="requirement-table-action-cell">
                <button class="boq-row-action icon-delete-btn" type="button" data-requirement-control-delete="${escapeCreateTenderHtml(control.id)}" aria-label="Remove row" title="Remove row">${renderCreateTenderTrashIcon()}</button>
            </td>
        </tr>
    `).join('');
}

function renderCreateTenderRequirementControlTable(control, value, profileId = '') {
    const columns = resolveCreateTenderRequirementColumns(control, profileId);
    const normalizedRows = normalizeCreateTenderRequirementTableRows(value, columns, control.id);
    const visibleColumns = getCreateTenderVisibleRequirementColumns(columns, normalizedRows);
    const sourceField = columns.find(column => column.sourceControlId);
    const sourceOptions = sourceField?.options || [];
    const shouldDisableAdd = Boolean(control.requiresSourceOptions && !sourceOptions.length);
    const shouldShowTemplate = control.importLabel || isCreateTenderBoqTemplateControl(control.id);

    return `
        <div class="requirement-table-wrap" data-requirement-table-wrap="${escapeCreateTenderHtml(control.id)}">
            <table class="requirement-table" data-requirement-table="${escapeCreateTenderHtml(control.id)}">
                <thead>
                    <tr>
                        ${visibleColumns.map(column => `<th>${escapeCreateTenderHtml(column.label)}</th>`).join('')}
                        <th aria-label="Actions"></th>
                    </tr>
                </thead>
                <tbody data-requirement-table-body="${escapeCreateTenderHtml(control.id)}">
                    ${renderCreateTenderRequirementTableRows(value, control, profileId)}
                </tbody>
            </table>
        </div>
        ${shouldDisableAdd ? `<span class="form-hint">${escapeCreateTenderHtml(control.sourceEmptyText || 'Add a source item first.')}</span>` : ''}
        <div class="requirement-table-actions">
            ${control.importLabel ? `<button class="btn btn-secondary scope-add" type="button" data-requirement-import="${escapeCreateTenderHtml(control.id)}">${escapeCreateTenderHtml(control.importLabel)}</button>` : ''}
            ${shouldShowTemplate ? `<button class="btn btn-secondary scope-add" type="button" data-requirement-template="${escapeCreateTenderHtml(control.id)}">Download Excel Template</button>` : ''}
            <button class="btn btn-secondary scope-add" type="button" data-requirement-control-add="${escapeCreateTenderHtml(control.id)}" ${shouldDisableAdd ? 'disabled' : ''}>${escapeCreateTenderHtml(control.addLabel || `Add ${control.label}`)}</button>
        </div>
    `;
}

const createTenderProductSpecStructuralColumns = [
    { id: 'itemNo', label: 'Item No.', required: true, locked: true, instructions: 'Buyer item number. Suppliers cannot edit this field.' },
    { id: 'productName', label: 'Product Name', required: true, locked: true, instructions: 'Name of the goods item being procured.' },
    { id: 'quantity', label: 'Quantity', required: true, locked: true, instructions: 'Quantity required by the buyer.' }
];

const createTenderProductSpecDetailColumns = [
    ...createTenderProductSpecStructuralColumns,
    { id: 'specificationName', label: 'Specification', required: true, locked: false, instructions: 'Name of the item-specific requirement.' },
    { id: 'acceptableRequirement', label: 'Specific Detail Required', required: false, locked: false, instructions: 'Optional buyer detail for this item specification.' }
];

function slugCreateTenderProductSpecColumnId(label = 'column') {
    return String(label || 'column')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'column';
}

function getCreateTenderProductSpecDefaultTemplate() {
    return {
        allowSupplierComments: true,
        columns: createTenderProductSpecDetailColumns,
        rows: []
    };
}

function getCreateTenderProductSpecQuantityRows(profileId = '') {
    if (typeof getCreateTenderRequirementDraft !== 'function') return [];
    const draft = getCreateTenderRequirementDraft(profileId);
    return Array.isArray(draft.fields?.quantityScheduleRows) ? draft.fields.quantityScheduleRows : [];
}

function getCreateTenderProductSpecItemValues(item = {}, index = 0) {
    return {
        itemNo: item.itemNumber || item.item || String(index + 1),
        productName: item.itemDescription || item.description || item.productName || `Product item ${index + 1}`,
        quantity: item.quantity || item.qty || ''
    };
}

function findCreateTenderProductSpecExistingRow(existingRows = [], sourceValues = {}, sourceRowId = '') {
    return existingRows.find(row => row.sourceRowId === sourceRowId)
        || existingRows.find(row => row.id === `product-spec-${sourceRowId}`)
        || existingRows.find(row => String(row.values?.itemNo || '') === String(sourceValues.itemNo || ''))
        || existingRows.find(row => String(row.values?.productName || '').toLowerCase() === String(sourceValues.productName || '').toLowerCase())
        || null;
}

function getCreateTenderProductSpecSourceMap(quantityRows = []) {
    return new Map((Array.isArray(quantityRows) ? quantityRows : []).map((item, index) => {
        const sourceRowId = item.id || `quantity-row-${index}`;
        return [sourceRowId, {
            sourceRowId,
            index,
            values: getCreateTenderProductSpecItemValues(item, index)
        }];
    }));
}

function isCreateTenderProductSpecDetailTemplate(value = {}) {
    const ids = new Set((value?.columns || []).map(column => column?.id));
    return ids.has('specificationName') || ids.has('acceptableRequirement');
}

function normalizeCreateTenderProductSpecRow(row = {}, rowIndex = 0, sourceMap = new Map()) {
    const rawValues = row?.values && typeof row.values === 'object' ? row.values : row || {};
    const sourceRowId = row?.sourceRowId || '';
    const source = sourceMap.get(sourceRowId)
        || Array.from(sourceMap.values()).find(item => (
            String(item.values.itemNo || '') === String(rawValues.itemNo || '')
            || String(item.values.productName || '').toLowerCase() === String(rawValues.productName || '').toLowerCase()
        ))
        || null;
    const itemValues = source?.values || {
        itemNo: rawValues.itemNo || String(rowIndex + 1),
        productName: rawValues.productName || `Product item ${rowIndex + 1}`,
        quantity: rawValues.quantity || ''
    };
    return {
        id: row?.id || `product-spec-row-${Date.now()}-${rowIndex}`,
        sourceRowId: source?.sourceRowId || sourceRowId,
        values: {
            ...itemValues,
            specificationName: rawValues.specificationName || '',
            acceptableRequirement: rawValues.acceptableRequirement || rawValues.requiredSpecification || ''
        }
    };
}

function convertCreateTenderLegacyProductSpecRows(value = {}, quantityRows = []) {
    const sourceMap = getCreateTenderProductSpecSourceMap(quantityRows);
    const structuralIds = new Set(createTenderProductSpecStructuralColumns.map(column => column.id));
    const detailIds = new Set(createTenderProductSpecDetailColumns.map(column => column.id));
    const legacyColumns = (value?.columns || [])
        .filter(column => column && !structuralIds.has(column.id) && !detailIds.has(column.id));
    const rawRows = Array.isArray(value?.rows) ? value.rows : [];
    return rawRows.flatMap((row, rowIndex) => {
        const rawValues = row?.values && typeof row.values === 'object' ? row.values : row || {};
        const sourceRowId = row?.sourceRowId || `quantity-row-${rowIndex}`;
        const source = sourceMap.get(sourceRowId)
            || Array.from(sourceMap.values()).find(item => (
                String(item.values.itemNo || '') === String(rawValues.itemNo || '')
                || String(item.values.productName || '').toLowerCase() === String(rawValues.productName || '').toLowerCase()
            ))
            || null;
        const itemValues = source?.values || {
            itemNo: rawValues.itemNo || String(rowIndex + 1),
            productName: rawValues.productName || `Product item ${rowIndex + 1}`,
            quantity: rawValues.quantity || ''
        };
        return legacyColumns
            .filter(column => String(rawValues[column.id] || '').trim())
            .map(column => ({
                id: `${row?.id || `product-spec-row-${rowIndex}`}-${column.id}`,
                sourceRowId: source?.sourceRowId || sourceRowId,
                values: {
                    ...itemValues,
                    specificationName: column.label || 'Specification',
                    acceptableRequirement: rawValues[column.id] || ''
                }
            }));
    });
}

function normalizeCreateTenderProductSpecTemplate(value = {}, quantityRows = null) {
    const fallback = getCreateTenderProductSpecDefaultTemplate();
    const sourceMap = getCreateTenderProductSpecSourceMap(quantityRows || []);
    const rawRows = Array.isArray(value?.rows) ? value.rows : fallback.rows;
    const rowSource = isCreateTenderProductSpecDetailTemplate(value)
        ? rawRows
        : convertCreateTenderLegacyProductSpecRows(value, quantityRows || []);
    const rows = rowSource
        .map((row, rowIndex) => normalizeCreateTenderProductSpecRow(row, rowIndex, sourceMap))
        .filter(row => !sourceMap.size || sourceMap.has(row.sourceRowId));
    return {
        allowSupplierComments: value?.allowSupplierComments !== false,
        columns: createTenderProductSpecDetailColumns,
        rows
    };
}

function renderCreateTenderProductSpecificationBuilder(control, value, profileId = '') {
    const quantityRows = getCreateTenderProductSpecQuantityRows(profileId);
    const template = normalizeCreateTenderProductSpecTemplate(value, quantityRows);
    const itemOptions = Array.from(getCreateTenderProductSpecSourceMap(quantityRows).values());
    return `
        <div class="product-spec-builder" data-product-spec-builder="${escapeCreateTenderHtml(control.id)}">
            <div class="product-spec-toolbar">
                <button class="btn btn-secondary scope-add" type="button" data-product-spec-import="${escapeCreateTenderHtml(control.id)}">Import CSV</button>
                <button class="btn btn-secondary scope-add" type="button" data-product-spec-download="${escapeCreateTenderHtml(control.id)}">Download CSV Template</button>
            </div>
            <div class="product-spec-item-grid">
                ${itemOptions.length ? itemOptions.map((item) => {
                    const itemRows = template.rows.filter(row => row.sourceRowId === item.sourceRowId);
                    return `
                        <article class="product-spec-item-card">
                            <div class="product-spec-item-header">
                                <div>
                                    <span class="section-kicker">Quantity schedule item ${escapeCreateTenderHtml(item.values.itemNo)}</span>
                                    <h4>${escapeCreateTenderHtml(item.values.productName)}</h4>
                                    <p>${escapeCreateTenderHtml(item.values.quantity || 0)} unit${Number(item.values.quantity) === 1 ? '' : 's'} required</p>
                                </div>
                                <button class="btn btn-secondary scope-add" type="button" data-product-spec-open-modal="${escapeCreateTenderHtml(control.id)}" data-product-spec-source="${escapeCreateTenderHtml(item.sourceRowId)}">Add Specification</button>
                            </div>
                            <div class="product-spec-sheet-wrap">
                                <table class="product-spec-sheet product-spec-item-sheet">
                                    <thead>
                                        <tr>
                                            <th>Specification <span class="required-dot">*</span></th>
                                            <th>Specific detail required</th>
                                            <th aria-label="Actions"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${itemRows.length ? itemRows.map((row, rowIndex) => `
                                            <tr data-product-spec-row="${escapeCreateTenderHtml(row.id)}" data-product-spec-control="${escapeCreateTenderHtml(control.id)}">
                                                <td><input class="form-input" type="text" value="${escapeCreateTenderHtml(row.values?.specificationName || '')}" data-product-spec-cell="specificationName" aria-label="Specification name ${rowIndex + 1}"></td>
                                                <td><textarea class="form-input" rows="3" data-product-spec-cell="acceptableRequirement" aria-label="Specific detail required ${rowIndex + 1}">${escapeCreateTenderHtml(row.values?.acceptableRequirement || '')}</textarea></td>
                                                <td>
                                                    <button class="boq-row-action icon-delete-btn" type="button" data-product-spec-delete-row="${escapeCreateTenderHtml(row.id)}" aria-label="Delete specification" title="Delete specification">${renderCreateTenderTrashIcon()}</button>
                                                </td>
                                            </tr>
                                        `).join('') : `
                                            <tr>
                                                <td colspan="3">
                                                    <div class="scope-empty">No specifications added for this item yet.</div>
                                                </td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    `;
                }).join('') : `<div class="scope-empty">Add goods items in the Quantity Schedule first. Each item will get its own specification table here.</div>`}
            </div>
            <div class="product-spec-modal" data-product-spec-modal="${escapeCreateTenderHtml(control.id)}" role="dialog" aria-modal="true" aria-labelledby="product-spec-modal-title-${escapeCreateTenderHtml(control.id)}" hidden>
                <div class="product-spec-modal-card">
                    <div class="product-spec-modal-heading">
                        <div>
                            <span class="section-kicker">Item specification</span>
                            <h4 id="product-spec-modal-title-${escapeCreateTenderHtml(control.id)}">Add Specification</h4>
                            <p data-product-spec-modal-item></p>
                        </div>
                        <button class="boq-row-action icon-delete-btn" type="button" data-product-spec-modal-cancel aria-label="Cancel add specification" title="Cancel">x</button>
                    </div>
                    <label>
                        <span class="form-label">Specification name</span>
                        <input class="form-input" type="text" data-product-spec-modal-name placeholder="Example: Brand, Processor, Warranty">
                    </label>
                    <label>
                        <span class="form-label">Specific detail required</span>
                        <textarea class="form-input" rows="4" data-product-spec-modal-detail placeholder="Optional, e.g. HP/Dell/Lenovo or equivalent, Core i5 or above"></textarea>
                    </label>
                    <span class="form-hint" data-product-spec-modal-error hidden>Specification name is required.</span>
                    <div class="product-spec-modal-actions">
                        <button class="btn btn-secondary" type="button" data-product-spec-modal-cancel>Cancel</button>
                        <button class="btn btn-primary" type="button" data-product-spec-modal-save>Save Specification</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCreateTenderRequirementCards(control, value, profileId = '') {
    const fields = resolveCreateTenderRequirementFields(control, profileId);
    const cards = normalizeCreateTenderRequirementObjectRows(value, fields, control.id);
    const sourceField = fields.find(field => field.sourceControlId);
    const sourceOptions = sourceField?.options || [];
    const shouldDisableAdd = Boolean(control.requiresSourceOptions && !sourceOptions.length);
    return `
        <div class="requirement-card-list" data-requirement-card-list="${escapeCreateTenderHtml(control.id)}">
            ${cards.length ? cards.map((card, cardIndex) => `
                <article class="requirement-repeater-card" data-requirement-card-row="${escapeCreateTenderHtml(card.id)}" data-requirement-control="${escapeCreateTenderHtml(control.id)}">
                    <div class="requirement-card-heading">
                        <strong>${escapeCreateTenderHtml(getCreateTenderRequirementCardTitle(control, card, cardIndex, fields))}</strong>
                        ${control.hideDelete ? '' : `<button class="boq-row-action icon-delete-btn" type="button" data-requirement-control-delete="${escapeCreateTenderHtml(control.id)}" aria-label="Remove ${escapeCreateTenderHtml(control.label)}" title="Remove">${renderCreateTenderTrashIcon()}</button>`}
                    </div>
                    <div class="requirement-card-grid">
                        ${fields.map(field => {
                            const shouldShow = !field.showWhen || String(card[field.showWhen.field] || '') === String(field.showWhen.value);
                            return `
                                <label class="requirement-card-field ${field.wide || field.type === 'textarea' || field.type === 'richtext' ? 'requirement-control-wide' : ''}" ${shouldShow ? '' : 'hidden'}>
                                    <span class="form-label">${escapeCreateTenderHtml(field.label)}</span>
                                    ${renderCreateTenderRequirementField(field, card[field.id], `data-requirement-card-field="${escapeCreateTenderHtml(field.id)}" aria-label="${escapeCreateTenderHtml(field.label)}"`)}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </article>
            `).join('') : `<div class="scope-empty">${escapeCreateTenderHtml(control.emptyText || 'No items added yet.')}</div>`}
        </div>
        ${shouldDisableAdd ? `<span class="form-hint">${escapeCreateTenderHtml(control.sourceEmptyText || 'Add a source item first.')}</span>` : ''}
        ${control.hideAdd ? '' : `<button class="btn btn-secondary scope-add" type="button" data-requirement-control-add="${escapeCreateTenderHtml(control.id)}" ${shouldDisableAdd ? 'disabled' : ''}>${escapeCreateTenderHtml(control.addLabel || `Add ${control.label}`)}</button>`}
    `;
}

function renderCreateTenderRequirementAccordion(control, value = {}) {
    const values = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return `
        <div class="requirement-accordion" data-requirement-accordion="${escapeCreateTenderHtml(control.id)}">
            ${(control.panels || []).map((panel, index) => `
                <details class="requirement-accordion-item" ${index === 0 ? 'open' : ''}>
                    <summary>${escapeCreateTenderHtml(panel.label)}</summary>
                    ${panel.type === 'text'
                        ? `<input class="form-input" value="${escapeCreateTenderHtml(values[panel.id] || '')}" data-requirement-accordion-field="${escapeCreateTenderHtml(panel.id)}" aria-label="${escapeCreateTenderHtml(panel.label)}">`
                        : `<textarea class="form-input requirement-rich-input" rows="5" data-requirement-accordion-field="${escapeCreateTenderHtml(panel.id)}" aria-label="${escapeCreateTenderHtml(panel.label)}">${escapeCreateTenderHtml(values[panel.id] || '')}</textarea>`}
                </details>
            `).join('')}
        </div>
    `;
}

function renderCreateTenderRequirementControl(control, value, profileId = '') {
    if (control.type === 'regulatory-licenses') {
        return renderCreateTenderRegulatoryLicensePanel(getCreateTenderTypeProfile({ id: profileId }), {
            title: control.title || 'Regulatory license requirements',
            hint: 'Search and select the licenses required for consulting firms. The issuing body is filled automatically.'
        });
    }

    if (control.type === 'list') {
        return renderCreateTenderRequirementControlList(control, value);
    }

    if (control.type === 'table') {
        return renderCreateTenderRequirementControlTable(control, value, profileId);
    }

    if (control.type === 'product-spec-builder') {
        return renderCreateTenderProductSpecificationBuilder(control, value, profileId);
    }

    if (control.type === 'cards') {
        return renderCreateTenderRequirementCards(control, value, profileId);
    }

    if (control.type === 'accordion') {
        return renderCreateTenderRequirementAccordion(control, value);
    }

    return renderCreateTenderRequirementField(control, value, `id="requirement-${escapeCreateTenderHtml(control.id)}" data-requirement-input="${escapeCreateTenderHtml(control.id)}"`);
}

function getCreateTenderPostLicenseRequirementSectionIds(profile = {}) {
    if (profile.id === 'goods') return ['eligibilityRequirements'];
    return [];
}

function renderCreateTenderRequirementSectionBlock(section, requirementDraft, profileId = '') {
    return `
        <article class="requirement-block" id="requirement-section-${escapeCreateTenderHtml(section.id)}" data-consultancy-tor-section="${escapeCreateTenderHtml(section.id)}">
            <div>
                <h4>${escapeCreateTenderHtml(section.title)}</h4>
                <span class="form-hint">${escapeCreateTenderHtml(section.hint)}</span>
            </div>
            <div class="requirement-control-grid">
                ${(section.controls || []).filter(control => {
                    if (!control.showWhen) return true;
                    return isCreateTenderShowWhenMatched(control.showWhen, requirementDraft.fields);
                }).map(control => `
                    <div class="requirement-control ${['table', 'cards', 'accordion', 'textarea', 'richtext', 'regulatory-licenses', 'product-spec-builder'].includes(control.type) ? 'requirement-control-wide' : ''}">
                        ${control.label ? `<span class="form-label">${escapeCreateTenderHtml(control.label)}</span>` : ''}
                        ${renderCreateTenderRequirementControl(control, requirementDraft.fields?.[control.id], profileId)}
                        ${getCreateTenderRequirementHelperText(control, requirementDraft.fields?.[control.id])
                            ? `<span class="form-hint" data-requirement-helper="${escapeCreateTenderHtml(control.id)}">${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(control, requirementDraft.fields?.[control.id]))}</span>`
                            : ''}
                        ${renderCreateTenderRequirementCounter(control, requirementDraft.fields?.[control.id])}
                    </div>
                `).join('')}
            </div>
        </article>
    `;
}

function renderCreateTenderConsultancyTorWorkspace(sections = [], requirementDraft, profile = {}) {
    return `
        <div class="consultancy-tor-workspace">
            <div class="consultancy-tor-main">
                <div class="consultancy-tor-header">
                    <div>
                        <span class="section-kicker">Structured assignment-definition workspace</span>
                        <h3>Consultancy Procurement TOR</h3>
                    </div>
                    <span class="badge badge-info">${escapeCreateTenderHtml(profile.commercialName)}</span>
                </div>
                <div class="requirement-section-grid">
                    ${sections.map(section => renderCreateTenderRequirementSectionBlock(section, requirementDraft, profile.id)).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderCreateTenderRequirementSections(profile, mainDraft = getCreateTenderMainDraft(), options = {}) {
    const template = getCreateTenderRequirementTemplate(profile.id);
    const requirementDraft = getCreateTenderRequirementDraft(profile.id);
    const includeSectionIds = Array.isArray(options.includeSectionIds) ? new Set(options.includeSectionIds) : null;
    const excludeSectionIds = new Set(Array.isArray(options.excludeSectionIds) ? options.excludeSectionIds : []);
    const sections = template.sections.filter(section => {
        if (includeSectionIds && !includeSectionIds.has(section.id)) return false;
        if (section.showWhen && !isCreateTenderShowWhenMatched(section.showWhen, requirementDraft.fields)) return false;
        return !excludeSectionIds.has(section.id);
    });

    if (!sections.length) return '';

    if (profile.id === 'consultancy' && !includeSectionIds) {
        return renderCreateTenderConsultancyTorWorkspace(sections, requirementDraft, profile);
    }

    return `
        ${options.showHeader === false ? '' : `
            <div class="requirement-type-header">
                <div>
                    <span class="section-kicker">Tender requirements</span>
                    <h3>${escapeCreateTenderHtml(template.title)}</h3>
                </div>
                <span class="badge badge-info">${escapeCreateTenderHtml(profile.commercialName)}</span>
            </div>
        `}
        <div class="requirement-section-grid">
            ${sections.map(section => section.id === 'scopeDescription'
                ? renderCreateTenderScopeDescriptionSection(section, requirementDraft, profile.id)
                : section.id === 'technicalCapacity'
                    ? renderCreateTenderTechnicalCapacitySection(section, requirementDraft, profile.id)
                : renderCreateTenderRequirementSectionBlock(section, requirementDraft, profile.id)
            ).join('')}
        </div>
    `;
}

function isCreateTenderRequirementValueFilled(value) {
    if (Array.isArray(value)) {
        return value.some(item => {
            if (typeof item === 'string') return item.trim();
            if (!item || typeof item !== 'object') return false;
            return Object.entries(item).some(([key, entryValue]) => key !== 'id' && String(entryValue || '').trim());
        });
    }

    return String(value || '').trim().length > 0;
}

function getCreateTenderRequirementOptionValue(option) {
    return typeof option === 'object' && option !== null ? String(option.value || '') : String(option);
}

function isCreateTenderRequirementControlValid(control = {}, value = '') {
    if (!isCreateTenderRequirementValueFilled(value)) return false;
    if (control.type === 'select-custom-prompt') return !['Other', 'Others'].includes(String(value || '').trim());
    if (control.type !== 'select') return true;
    const allowedValues = new Set((control.options || []).map(getCreateTenderRequirementOptionValue));
    return allowedValues.has(String(value || ''));
}

function getCreateTenderRequirementSummary(profile, mainDraft = getCreateTenderMainDraft()) {
    const template = getCreateTenderRequirementTemplate(profile.id);
    const fields = mainDraft.requirements?.[profile.id]?.fields || {};
    const controls = template.sections.flatMap(section => section.controls || []);
    const filledControls = controls.filter(control => isCreateTenderRequirementValueFilled(fields[control.id])).length;

    return {
        title: template.title,
        totalControls: controls.length,
        filledControls
    };
}

function getCreateTenderMissingRequiredRequirements(profile, mainDraft = getCreateTenderMainDraft()) {
    const template = getCreateTenderRequirementTemplate(profile.id);
    const fields = mainDraft.requirements?.[profile.id]?.fields || {};
    return template.sections
        .flatMap(section => section.controls || [])
        .filter(control => control.required)
        .filter(control => !control.showWhen || String(fields[control.showWhen.field] || '') === String(control.showWhen.value))
        .filter(control => !isCreateTenderRequirementControlValid(control, fields[control.id]));
}

function getCreateTenderEffectiveContractType(profileId = 'works') {
    const fields = getCreateTenderRequirementDraft(profileId).fields || {};
    return String(fields.contractType || '').trim();
}

function renderCreateTenderTrashIcon() {
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

function getCreateTenderTypeId(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'goods' || raw === 'works' || raw === 'services' || raw === 'consultancy') return raw;
    if (raw === 'service' || raw === 'non consultancy' || raw === 'non-consultancy services' || raw === 'non consultancy services') return 'services';
    if (raw === 'consulting' || raw === 'consultant' || raw === 'consultancy services') return 'consultancy';
    return 'works';
}

function getCreateTenderTypeProfile(typeOrTender = 'works') {
    const typeId = typeof typeOrTender === 'object'
        ? getCreateTenderTypeId(typeOrTender.procurementTypeId || typeOrTender.id || typeOrTender.type || typeOrTender.label)
        : getCreateTenderTypeId(typeOrTender);
    return createTenderTypeProfiles[typeId] || createTenderTypeProfiles.works;
}

function getCreateTenderCurrentTypeProfile() {
    return getCreateTenderTypeProfile(getCreateTenderMainDraft().procurementTypeId || getCreateTenderSetup().defaultType.id);
}

function getCreateTenderCategoryFromWizard(wizard, selectedType) {
    return getCreateTenderWizardCategoryValue(wizard, '');
}

function parseCreateTenderNumber(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCreateTenderMoney(value) {
    return `TZS ${Math.round(parseCreateTenderNumber(value)).toLocaleString('en-US')}`;
}

function formatCreateTenderCompactMoney(value) {
    const amount = parseCreateTenderNumber(value);
    if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1).replace(/\.0$/, '')}B estimate`;
    if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}M estimate`;
    return `${formatCreateTenderMoney(amount)} estimate`;
}

function clampCreateTenderEvaluationWeight(value) {
    return Math.min(Math.max(parseCreateTenderNumber(value), 0), 100);
}

function getCreateTenderEvaluationCatalog(profileId = 'works') {
    const typeId = getCreateTenderTypeId(profileId);
    return createTenderEvaluationCatalog[typeId] || createTenderEvaluationCatalog.works;
}

function normalizeCreateTenderEvaluationSubcriteria(value = []) {
    if (Array.isArray(value)) {
        return value.map(item => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}

function getCreateTenderEvaluationCriterionCatalogItem(profileId = 'works', criterion = {}) {
    return getCreateTenderEvaluationCatalog(profileId)
        .find(entry => entry.id === criterion.id || entry.name === criterion.name || entry.category === criterion.category);
}

function getCreateTenderAvailableEvaluationSubcriteria(profileId = 'works', criterion = {}) {
    const catalogItem = getCreateTenderEvaluationCriterionCatalogItem(profileId, criterion);
    return normalizeCreateTenderEvaluationSubcriteria(catalogItem?.subcriteria || []);
}

function normalizeCreateTenderEvaluationCriterion(item = {}, index = 0, profileId = 'works') {
    const catalogItem = getCreateTenderEvaluationCatalog(profileId).find(entry => entry.id === item.id || entry.name === item.name);
    const fallback = catalogItem || {};

    return {
        id: String(item.id || fallback.id || `evaluation-${profileId}-${Date.now()}-${index}`),
        name: String(item.name || fallback.name || `Criterion ${index + 1}`),
        category: String(item.category || fallback.category || item.name || `Criterion ${index + 1}`),
        weight: clampCreateTenderEvaluationWeight(item.weight ?? fallback.defaultWeight ?? 0),
        subcriteria: normalizeCreateTenderEvaluationSubcriteria(item.subcriteria || fallback.subcriteria || []),
        custom: Boolean(item.custom)
    };
}

function getCreateTenderDefaultEvaluationDraft(profileId = 'works') {
    const criteria = getCreateTenderEvaluationCatalog(profileId)
        .filter(item => parseCreateTenderNumber(item.defaultWeight) > 0)
        .map((item, index) => normalizeCreateTenderEvaluationCriterion({
            ...item,
            weight: item.defaultWeight
        }, index, profileId));

    return {
        mode: 'manual',
        criteria
    };
}

function normalizeCreateTenderEvaluationDraft(profileId = 'works', draft = {}) {
    const mode = ['manual', 'auto'].includes(draft?.mode) ? draft.mode : 'manual';
    const criteria = Array.isArray(draft?.criteria)
        ? draft.criteria.map((item, index) => normalizeCreateTenderEvaluationCriterion(item, index, profileId))
        : getCreateTenderDefaultEvaluationDraft(profileId).criteria;

    return { mode, criteria };
}

function getCreateTenderEvaluationDraft(profileId = 'works', mainDraft = getCreateTenderMainDraft()) {
    const typeId = getCreateTenderTypeId(profileId);
    return normalizeCreateTenderEvaluationDraft(typeId, mainDraft.evaluation?.[typeId]);
}

function saveCreateTenderEvaluationDraft(profileId = 'works', evaluationDraft = {}) {
    const typeId = getCreateTenderTypeId(profileId);
    const mainDraft = getCreateTenderMainDraft();
    const normalizedDraft = normalizeCreateTenderEvaluationDraft(typeId, evaluationDraft);
    saveCreateTenderMainDraft({
        evaluation: {
            ...(mainDraft.evaluation || {}),
            [typeId]: normalizedDraft
        }
    });
    return normalizedDraft;
}

function getCreateTenderEvaluationSummary(evaluationDraft = {}) {
    const criteria = Array.isArray(evaluationDraft.criteria) ? evaluationDraft.criteria : [];
    const total = criteria.reduce((sum, item) => sum + clampCreateTenderEvaluationWeight(item.weight), 0);
    const roundedTotal = Math.round(total * 100) / 100;
    const remaining = Math.round((100 - roundedTotal) * 100) / 100;
    const hasCriteria = criteria.length > 0;
    const hasMissingWeight = criteria.some(item => clampCreateTenderEvaluationWeight(item.weight) <= 0);
    const state = !hasCriteria ? 'empty' : remaining === 0 && hasMissingWeight ? 'incomplete' : remaining === 0 ? 'balanced' : remaining > 0 ? 'under' : 'over';
    const message = state === 'incomplete'
        ? 'Set all weights'
        : state === 'balanced'
        ? 'Balanced'
        : state === 'over'
            ? `Reduce by ${Math.abs(remaining)}%`
            : `Add ${remaining}% remaining`;

    return {
        total: roundedTotal,
        remaining,
        state,
        message,
        hasCriteria,
        hasMissingWeight,
        isBalanced: hasCriteria && remaining === 0 && !hasMissingWeight
    };
}

function createTenderEvaluationCriterionFromCatalog(profileId, suggestionId) {
    const suggestion = getCreateTenderEvaluationCatalog(profileId).find(item => item.id === suggestionId);
    if (!suggestion) return null;
    return normalizeCreateTenderEvaluationCriterion({
        ...suggestion,
        weight: suggestion.defaultWeight || 0
    }, Date.now(), profileId);
}

function distributeCreateTenderEvaluationRemaining(evaluationDraft = {}) {
    const criteria = Array.isArray(evaluationDraft.criteria) ? evaluationDraft.criteria.map(item => ({ ...item })) : [];
    if (!criteria.length) return evaluationDraft;
    const summary = getCreateTenderEvaluationSummary({ criteria });
    if (summary.remaining <= 0) return { ...evaluationDraft, criteria };
    const increment = summary.remaining / criteria.length;
    return {
        ...evaluationDraft,
        criteria: criteria.map(item => ({
            ...item,
            weight: Math.round((clampCreateTenderEvaluationWeight(item.weight) + increment) * 100) / 100
        }))
    };
}

function balanceCreateTenderEvaluationWeights(evaluationDraft = {}) {
    const criteria = Array.isArray(evaluationDraft.criteria) ? evaluationDraft.criteria.map(item => ({ ...item })) : [];
    if (!criteria.length) return evaluationDraft;
    const total = criteria.reduce((sum, item) => sum + clampCreateTenderEvaluationWeight(item.weight), 0);
    const hasMissingWeight = criteria.some(item => clampCreateTenderEvaluationWeight(item.weight) <= 0);
    if (!total || hasMissingWeight) {
        const base = Math.floor((100 / criteria.length) * 100) / 100;
        let used = 0;
        return {
            ...evaluationDraft,
            criteria: criteria.map((item, index) => {
                const weight = index === criteria.length - 1 ? Math.round((100 - used) * 100) / 100 : base;
                used += weight;
                return { ...item, weight };
            })
        };
    }
    let used = 0;
    return {
        ...evaluationDraft,
        criteria: criteria.map((item, index) => {
            const weight = index === criteria.length - 1
                ? Math.round((100 - used) * 100) / 100
                : Math.round((clampCreateTenderEvaluationWeight(item.weight) / total) * 10000) / 100;
            used += weight;
            return { ...item, weight: clampCreateTenderEvaluationWeight(weight) };
        })
    };
}

function autoBalanceCreateTenderEvaluationWeights(evaluationDraft = {}, changedCriterionId = '') {
    const criteria = Array.isArray(evaluationDraft.criteria) ? evaluationDraft.criteria.map(item => ({ ...item })) : [];
    if (criteria.length < 2 || !changedCriterionId) return balanceCreateTenderEvaluationWeights(evaluationDraft);
    const changed = criteria.find(item => item.id === changedCriterionId);
    const others = criteria.filter(item => item.id !== changedCriterionId);
    if (!changed || !others.length) return evaluationDraft;
    const changedWeight = clampCreateTenderEvaluationWeight(changed.weight);
    const remaining = Math.max(100 - changedWeight, 0);
    const otherTotal = others.reduce((sum, item) => sum + clampCreateTenderEvaluationWeight(item.weight), 0);
    let used = 0;
    const nextOthers = others.map((item, index) => {
        const weight = index === others.length - 1
            ? Math.round((remaining - used) * 100) / 100
            : Math.round(((otherTotal ? clampCreateTenderEvaluationWeight(item.weight) / otherTotal : 1 / others.length) * remaining) * 100) / 100;
        used += weight;
        return { ...item, weight: clampCreateTenderEvaluationWeight(weight) };
    });
    return {
        ...evaluationDraft,
        criteria: criteria.map(item => item.id === changedCriterionId ? { ...changed, weight: changedWeight } : nextOthers.shift())
    };
}

function normalizeCreateTenderBoqItem(item, index = 0) {
    return {
        id: item.id || `boq-${Date.now()}-${index}`,
        item: String(item.item || `${index + 1}.1`),
        description: String(item.description || ''),
        qty: parseCreateTenderNumber(item.qty),
        unit: String(item.unit || ''),
        rate: parseCreateTenderNumber(item.rate)
    };
}

function normalizeCreateTenderScopeItem(item, index = 0, prefix = 'item') {
    return {
        id: item.id || `${prefix}-${Date.now()}-${index}`,
        text: String(item.text || '')
    };
}

function getCreateTenderRegulatoryLicenseByName(licenseName) {
    return createTenderRegulatoryLicenseCatalog.find(item => item.license === licenseName)
        || createTenderRegulatoryLicenseCatalog[0];
}

function normalizeCreateTenderRegulatoryLicense(item, index = 0) {
    const catalogItem = getCreateTenderRegulatoryLicenseByName(item.license);
    return {
        id: item.id || `license-${Date.now()}-${index}`,
        license: String(item.license || catalogItem.license),
        body: String(item.body || catalogItem.body),
        mandatory: item.mandatory !== undefined ? Boolean(item.mandatory) : true,
        expiryRequired: item.expiryRequired !== undefined ? Boolean(item.expiryRequired) : true
    };
}

function normalizeCreateTenderContactDetails(details = {}) {
    return {
        tenderLocation: String(details.tenderLocation || defaultCreateTenderContact.tenderLocation),
        contactName: String(details.contactName || defaultCreateTenderContact.contactName),
        phone: String(details.phone || defaultCreateTenderContact.phone),
        email: String(details.email || defaultCreateTenderContact.email),
        phoneVerified: Boolean(details.phoneVerified),
        emailVerified: Boolean(details.emailVerified)
    };
}

function coerceCreateTenderFixedMilestones(items = []) {
    return defaultCreateTenderMilestones.map((fixedItem) => {
        const savedItem = items.find(item => item.id === fixedItem.id || item.name === fixedItem.name);
        return {
            ...fixedItem,
            date: String(savedItem?.date || fixedItem.date)
        };
    });
}

function ensureCreateTenderDraft() {
    if (!mockData.createTenderDraft) {
        mockData.createTenderDraft = {};
    }
    return mockData.createTenderDraft;
}

function getCreateTenderStoredItems(storageKey, fallback = []) {
    try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue === null) return fallback;
        const parsed = JSON.parse(storedValue);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
        localStorage.removeItem(storageKey);
        return fallback;
    }
}

function getCreateTenderStoredObject(storageKey, fallback = {}) {
    try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue === null) return fallback;
        const parsed = JSON.parse(storedValue);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
        localStorage.removeItem(storageKey);
        return fallback;
    }
}

function getCreateTenderMainDraft() {
    const draft = ensureCreateTenderDraft();
    if (draft.mainDetails) return draft.mainDetails;

    draft.mainDetails = {
        ...defaultCreateTenderMainDraft,
        ...getCreateTenderStoredObject(createTenderDraftStorageKey, {})
    };
    draft.mainDetails.method = normalizeCreateTenderMethod(draft.mainDetails.method);
    draft.mainDetails.categories = getCreateTenderSelectedCategories(draft.mainDetails);
    draft.mainDetails.category = draft.mainDetails.categories.join(', ');
    return draft.mainDetails;
}

function saveCreateTenderMainDraft(details = {}) {
    const draft = ensureCreateTenderDraft();
    draft.mainDetails = {
        ...defaultCreateTenderMainDraft,
        ...draft.mainDetails,
        ...details
    };
    draft.mainDetails.method = normalizeCreateTenderMethod(draft.mainDetails.method);
    draft.mainDetails.categories = getCreateTenderSelectedCategories(draft.mainDetails);
    draft.mainDetails.category = draft.mainDetails.categories.join(', ');
    localStorage.setItem(createTenderDraftStorageKey, JSON.stringify(draft.mainDetails));
    return draft.mainDetails;
}

function hasCreateTenderMeaningfulPostSelectionValue(value) {
    if (Array.isArray(value)) return value.some(item => hasCreateTenderMeaningfulPostSelectionValue(item));
    if (value && typeof value === 'object') {
        return Object.entries(value).some(([key, entryValue]) => {
            if (['id', 'item', 'name', 'group', 'body'].includes(key)) return false;
            return hasCreateTenderMeaningfulPostSelectionValue(entryValue);
        });
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return String(value ?? '').trim().length > 0;
}

function hasCreateTenderStoredArrayData(storageKey) {
    return getCreateTenderStoredItems(storageKey).some(item => hasCreateTenderMeaningfulPostSelectionValue(item));
}

function hasCreateTenderPostSelectionData(typeId = getCreateTenderCurrentTypeProfile().id) {
    const mainDraft = getCreateTenderMainDraft();
    const normalizedTypeId = getCreateTenderTypeProfile(typeId).id;
    const categories = getCreateTenderSelectedCategories(mainDraft);
    if (categories.length) return true;
    if (normalizeCreateTenderMethod(mainDraft.method) !== createTenderOpenMethod) return true;
    if ((mainDraft.invitedUsers || []).length) return true;
    if (hasCreateTenderMeaningfulPostSelectionValue(mainDraft.requirements?.[normalizedTypeId])) return true;
    if (hasCreateTenderMeaningfulPostSelectionValue(mainDraft.evaluation?.[normalizedTypeId])) return true;
    if (hasCreateTenderMeaningfulPostSelectionValue(mainDraft.systemEvaluation?.[normalizedTypeId])) return true;

    if (localStorage.getItem(createTenderCommercialTypeStorageKey) === normalizedTypeId && hasCreateTenderStoredArrayData(createTenderBoqStorageKey)) return true;
    if (localStorage.getItem(createTenderDeliverableTypeStorageKey) === normalizedTypeId && hasCreateTenderStoredArrayData(createTenderDeliverableStorageKey)) return true;
    if (localStorage.getItem(createTenderAttachmentTypeStorageKey) === normalizedTypeId && hasCreateTenderStoredArrayData(createTenderAttachmentStorageKey)) return true;
    if (localStorage.getItem(createTenderLicenseTypeStorageKey) === normalizedTypeId && hasCreateTenderStoredArrayData(createTenderLicenseStorageKey)) return true;
    return getCreateTenderStoredItems(createTenderMilestoneStorageKey).some(item => String(item.date || '').trim());
}

function resetCreateTenderPostSelectionData(nextTypeId) {
    const draft = ensureCreateTenderDraft();
    draft.invitedUsers = [];
    delete draft.boqItems;
    delete draft.commercialType;
    delete draft.milestones;
    delete draft.deliverables;
    delete draft.deliverableType;
    delete draft.requiredAttachments;
    delete draft.attachmentType;
    delete draft.regulatoryLicenses;
    delete draft.regulatoryLicenseType;

    [
        createTenderBoqStorageKey,
        createTenderCommercialTypeStorageKey,
        createTenderMilestoneStorageKey,
        createTenderDeliverableStorageKey,
        createTenderDeliverableTypeStorageKey,
        createTenderLicenseStorageKey,
        createTenderLicenseTypeStorageKey,
        createTenderAttachmentStorageKey,
        createTenderAttachmentTypeStorageKey
    ].forEach(key => localStorage.removeItem(key));

    saveCreateTenderMainDraft({
        procurementTypeId: nextTypeId,
        method: createTenderOpenMethod,
        category: '',
        categories: [],
        visibility: getCreateTenderVisibilityForMethod(createTenderOpenMethod),
        visibilityNote: getCreateTenderVisibilityNoteForMethod(createTenderOpenMethod, 0),
        invitedUsers: [],
        evaluation: {},
        systemEvaluation: {},
        requirements: {}
    });
}

function getCreateTenderInvitedUsers() {
    const draft = ensureCreateTenderDraft();
    const mainDetails = getCreateTenderMainDraft();
    if (Array.isArray(draft.invitedUsers)) return draft.invitedUsers;
    draft.invitedUsers = Array.isArray(mainDetails.invitedUsers)
        ? mainDetails.invitedUsers.map(normalizeCreateTenderInvitedUser).filter(user => user.name)
        : [];
    return draft.invitedUsers;
}

function saveCreateTenderInvitedUsers(users = []) {
    const draft = ensureCreateTenderDraft();
    draft.invitedUsers = users.map(normalizeCreateTenderInvitedUser).filter(user => user.name);
    saveCreateTenderMainDraft({ invitedUsers: draft.invitedUsers });
    return draft.invitedUsers;
}

function getCreateTenderSavedDraft() {
    const savedDraft = getCreateTenderStoredObject(createTenderDraftStorageKey, null);
    return savedDraft?.status === 'Saved as draft' ? savedDraft : null;
}

function getCreateTenderContactDetails() {
    const draft = ensureCreateTenderDraft();
    if (draft.contactDetails) return draft.contactDetails;

    const storedDetails = getCreateTenderStoredObject(createTenderContactStorageKey, defaultCreateTenderContact);
    draft.contactDetails = normalizeCreateTenderContactDetails(storedDetails);
    return draft.contactDetails;
}

function saveCreateTenderContactDetails(details) {
    const draft = ensureCreateTenderDraft();
    draft.contactDetails = normalizeCreateTenderContactDetails(details);
    localStorage.setItem(createTenderContactStorageKey, JSON.stringify(draft.contactDetails));
}

function getCreateTenderBoqItems(profile = getCreateTenderCurrentTypeProfile()) {
    const draft = ensureCreateTenderDraft();
    const profileId = profile.id;
    if (Array.isArray(draft.boqItems) && draft.commercialType === profileId) return draft.boqItems;

    const storedItems = getCreateTenderStoredItems(createTenderBoqStorageKey);
    const storedType = localStorage.getItem(createTenderCommercialTypeStorageKey);
    draft.commercialType = profileId;
    draft.boqItems = (storedItems.length && storedType === profileId ? storedItems : profile.defaultItems).map(normalizeCreateTenderBoqItem);
    return draft.boqItems;
}

function saveCreateTenderBoqItems(items, profile = getCreateTenderCurrentTypeProfile()) {
    const draft = ensureCreateTenderDraft();
    draft.commercialType = profile.id;
    draft.boqItems = items.map(normalizeCreateTenderBoqItem);
    localStorage.setItem(createTenderCommercialTypeStorageKey, profile.id);
    localStorage.setItem(createTenderBoqStorageKey, JSON.stringify(draft.boqItems));
}

function getCreateTenderMilestones() {
    const draft = ensureCreateTenderDraft();
    if (Array.isArray(draft.milestones)) {
        draft.milestones = coerceCreateTenderFixedMilestones(draft.milestones);
        return draft.milestones;
    }

    const storedMilestones = getCreateTenderStoredItems(createTenderMilestoneStorageKey);
    draft.milestones = coerceCreateTenderFixedMilestones(storedMilestones.length ? storedMilestones : defaultCreateTenderMilestones);
    return draft.milestones;
}

function saveCreateTenderMilestones(items) {
    const draft = ensureCreateTenderDraft();
    draft.milestones = coerceCreateTenderFixedMilestones(items);
    localStorage.setItem(createTenderMilestoneStorageKey, JSON.stringify(draft.milestones));
}

function getCreateTenderScopeItems(draftKey, storageKey, defaultItems, prefix, typeKey, typeStorageKey, profile = getCreateTenderCurrentTypeProfile()) {
    const draft = ensureCreateTenderDraft();
    const profileId = profile.id;
    if (Array.isArray(draft[draftKey]) && draft[typeKey] === profileId) return draft[draftKey];

    const storedItems = getCreateTenderStoredItems(storageKey);
    const storedType = localStorage.getItem(typeStorageKey);
    draft[typeKey] = profileId;
    draft[draftKey] = (storedItems.length && storedType === profileId ? storedItems : defaultItems)
        .map((item, index) => normalizeCreateTenderScopeItem(item, index, prefix));
    return draft[draftKey];
}

function getCreateTenderDeliverables(profile = getCreateTenderCurrentTypeProfile()) {
    return getCreateTenderScopeItems('deliverables', createTenderDeliverableStorageKey, profile.defaultDeliverables, 'deliverable', 'deliverableType', createTenderDeliverableTypeStorageKey, profile);
}

function getCreateTenderRequiredAttachments(profile = getCreateTenderCurrentTypeProfile()) {
    return getCreateTenderScopeItems('requiredAttachments', createTenderAttachmentStorageKey, profile.defaultAttachments, 'attachment', 'attachmentType', createTenderAttachmentTypeStorageKey, profile);
}

function saveCreateTenderScopeItems(draftKey, storageKey, items, prefix, typeKey, typeStorageKey, profile = getCreateTenderCurrentTypeProfile()) {
    const draft = ensureCreateTenderDraft();
    draft[typeKey] = profile.id;
    draft[draftKey] = items.map((item, index) => normalizeCreateTenderScopeItem(item, index, prefix));
    localStorage.setItem(typeStorageKey, profile.id);
    localStorage.setItem(storageKey, JSON.stringify(draft[draftKey]));
}

function saveCreateTenderDeliverables(items, profile = getCreateTenderCurrentTypeProfile()) {
    saveCreateTenderScopeItems('deliverables', createTenderDeliverableStorageKey, items, 'deliverable', 'deliverableType', createTenderDeliverableTypeStorageKey, profile);
}

function saveCreateTenderRequiredAttachments(items, profile = getCreateTenderCurrentTypeProfile()) {
    saveCreateTenderScopeItems('requiredAttachments', createTenderAttachmentStorageKey, items, 'attachment', 'attachmentType', createTenderAttachmentTypeStorageKey, profile);
}

function getCreateTenderRegulatoryLicenses(profile = getCreateTenderCurrentTypeProfile()) {
    const draft = ensureCreateTenderDraft();
    const profileId = profile.id;
    if (Array.isArray(draft.regulatoryLicenses) && draft.regulatoryLicenseType === profileId) return draft.regulatoryLicenses;

    const storedItems = getCreateTenderStoredItems(createTenderLicenseStorageKey);
    const storedType = localStorage.getItem(createTenderLicenseTypeStorageKey);
    draft.regulatoryLicenseType = profileId;
    draft.regulatoryLicenses = (storedItems.length && storedType === profileId ? storedItems : defaultCreateTenderRegulatoryLicenses)
        .map(normalizeCreateTenderRegulatoryLicense);
    return draft.regulatoryLicenses;
}

function saveCreateTenderRegulatoryLicenses(items, profile = getCreateTenderCurrentTypeProfile()) {
    const draft = ensureCreateTenderDraft();
    draft.regulatoryLicenseType = profile.id;
    draft.regulatoryLicenses = items.map(normalizeCreateTenderRegulatoryLicense);
    localStorage.setItem(createTenderLicenseTypeStorageKey, profile.id);
    localStorage.setItem(createTenderLicenseStorageKey, JSON.stringify(draft.regulatoryLicenses));
}

function getCreateTenderBoqTotal(items = getCreateTenderBoqItems()) {
    return items.reduce((total, item) => total + (parseCreateTenderNumber(item.qty) * parseCreateTenderNumber(item.rate)), 0);
}

function isCreateTenderValidPhone(value) {
    return /^\+?[0-9\s().-]{7,}$/.test(String(value || '').trim());
}

function isCreateTenderValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getCreateTenderContactSummary(contact = getCreateTenderContactDetails()) {
    const phoneValid = isCreateTenderValidPhone(contact.phone);
    const emailValid = isCreateTenderValidEmail(contact.email);
    const verifiedCount = [contact.phoneVerified && phoneValid, contact.emailVerified && emailValid].filter(Boolean).length;
    const providedCount = [contact.phone.trim(), contact.email.trim()].filter(Boolean).length;

    return {
        phoneValid,
        emailValid,
        verifiedCount,
        providedCount,
        complete: Boolean(contact.tenderLocation.trim() && contact.contactName.trim() && verifiedCount)
    };
}

function getCreateTenderDateValue(date) {
    const time = Date.parse(`${date}T00:00:00`);
    return Number.isFinite(time) ? time : null;
}

function formatCreateTenderDate(date) {
    const time = typeof date === 'number' ? date : getCreateTenderDateValue(date);
    if (!Number.isFinite(time)) return 'No date set';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(time));
}

function getCreateTenderMilestoneSummary(items = getCreateTenderMilestones()) {
    const datedItems = items
        .map(item => getCreateTenderDateValue(item.date))
        .filter(time => Number.isFinite(time))
        .sort((first, second) => first - second);
    const start = datedItems[0] || null;
    const end = datedItems[datedItems.length - 1] || null;
    const days = start && end ? Math.round((end - start) / 86400000) : 0;

    return {
        count: items.length,
        datedCount: datedItems.length,
        start,
        end,
        days
    };
}

function getProcurexStoredPublishedTenders() {
    try {
        const parsed = JSON.parse(localStorage.getItem(createTenderPublishedStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        localStorage.removeItem(createTenderPublishedStorageKey);
        return [];
    }
}

function saveProcurexPublishedTenders(items) {
    localStorage.setItem(createTenderPublishedStorageKey, JSON.stringify(items));
}

function mergeProcurexTenders(baseTenders = mockData.tenders || []) {
    const published = getProcurexStoredPublishedTenders();
    const publishedIds = new Set(published.map(tender => tender.id));
    return [
        ...published,
        ...baseTenders.filter(tender => !publishedIds.has(tender.id))
    ];
}

function isProcurexTenderPast(tender) {
    const closingTime = Date.parse(`${tender.closingDate}T23:59:59`);
    return Number.isFinite(closingTime) && closingTime < Date.now();
}

function isProcurexTenderVisibleToCurrentUser(tender) {
    if (tender.visibility !== 'Invited suppliers only') return true;
    if (tender.createdByCurrentUser) return true;

    const supplier = mockData.users?.supplier || {};
    const currentSupplierNames = new Set([supplier.name, supplier.organization].filter(Boolean).map(value => value.toLowerCase()));
    return (tender.invitedUsers || []).some(user => (
        currentSupplierNames.has(String(user.name || '').toLowerCase())
        || currentSupplierNames.has(String(user.organization || '').toLowerCase())
    ));
}

function getProcurexMarketplaceTenders() {
    return mergeProcurexTenders().filter(tender => (
        tender.status === 'Open'
        && !isProcurexTenderPast(tender)
        && isProcurexTenderVisibleToCurrentUser(tender)
    ));
}

function getProcurexAllTenders() {
    return mergeProcurexTenders();
}

function getProcurexBuyerActiveTenders() {
    return mergeProcurexTenders().filter(tender => tender.createdByCurrentUser && !['Awarded', 'Cancelled'].includes(tender.status) && !isProcurexTenderPast(tender));
}

function getProcurexTenderHistoryRecords() {
    return mergeProcurexTenders().filter(tender => tender.status !== 'Open' || isProcurexTenderPast(tender));
}

function selectProcurexTender(tenderId) {
    if (!tenderId) return;
    mockData.selectedTenderId = tenderId;
    localStorage.setItem(createTenderSelectedTenderStorageKey, tenderId);
}

function getProcurexSelectedTender() {
    const tenders = mergeProcurexTenders();
    const selectedId = mockData.selectedTenderId || localStorage.getItem(createTenderSelectedTenderStorageKey);
    return tenders.find(tender => tender.id === selectedId)
        || getProcurexBuyerActiveTenders()[0]
        || tenders[0];
}

function getCreateTenderWizardFundingSource(wizard) {
    const sourceSelect = wizard?.querySelector?.('[data-tender-funding-source-select]');
    const customInput = wizard?.querySelector?.('[data-tender-funding-source-custom]');
    if (!sourceSelect) return getCreateTenderMainFundingSource(getCreateTenderMainDraft());
    if (sourceSelect.value !== 'Other') return sourceSelect.value;
    return customInput?.value.trim() || 'Other';
}

function publishCreateTenderToMarketplace(wizard) {
    const setup = getCreateTenderSetup();
    const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
    const selectedType = setup.types.find(type => type.id === selectedTypeId) || setup.defaultType;
    const title = wizard.querySelector('[data-tender-title]')?.value.trim() || '';
    const method = normalizeCreateTenderMethod(wizard.querySelector('[data-procurement-method]')?.value);
    const categories = getCreateTenderWizardCategories(wizard);
    const category = categories.join(', ');
    const invitedUsers = getCreateTenderInvitedUsers();
    const fundingSource = getCreateTenderWizardFundingSource(wizard);
    const visibility = getCreateTenderVisibilityForMethod(method);
    const visibilityNote = getCreateTenderVisibilityNoteForMethod(method, invitedUsers.length);
    const contact = getCreateTenderContactDetails();
    const milestones = getCreateTenderMilestones();
    const closingDate = milestones.find(item => item.id === 'milestone-closing')?.date || milestones[milestones.length - 1]?.date || '';
    const profile = getCreateTenderTypeProfile(selectedType);
    const evaluationDraft = getCreateTenderEvaluationDraft(profile.id);
    const evaluationSummary = getCreateTenderEvaluationSummary(evaluationDraft);
    if (!evaluationSummary.isBalanced) return null;
    const systemEvaluation = getCreateTenderSavedSystemEvaluation(profile.id);
    if (!isCreateTenderSavedSystemEvaluationCurrent(profile)) return null;
    const requirementSummary = getCreateTenderRequirementSummary(profile, getCreateTenderMainDraft());
    const boqItems = getCreateTenderBoqItems(profile);
    const budget = getCreateTenderBoqTotal(boqItems);
    const requiredSubmissionDocuments = getCreateTenderRequiredAttachments(profile).map(item => item.text).filter(Boolean);
    const documents = profile.documentLabels || [];
    const now = new Date();
    const tenderId = `TP-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
    const publishedTender = {
        id: tenderId,
        title,
        type: selectedType.label,
        procurementTypeId: profile.id,
        status: 'Pending Admin Review',
        complianceStatus: 'Awaiting publication review',
        budget,
        closingDate,
        organization: mockData.users?.buyer?.organization || 'Buyer organization',
        description: requirementSummary.filledControls
            ? `${requirementSummary.filledControls} structured requirement fields configured.`
            : 'Structured tender requirements pending.',
        eligibility: `${method} / ${category}`,
        documents,
        requiredSubmissionDocuments,
        requirements: getCreateTenderRequirementDraft(profile.id),
        evaluation: evaluationDraft,
        systemEvaluation,
        regulatoryLicenses: getCreateTenderRegulatoryLicenses(profile),
        category,
        categories,
        method,
        fundingSource,
        visibility,
        visibilityNote,
        invitedUsers,
        location: contact.tenderLocation,
        contactName: contact.contactName,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        createdByCurrentUser: true,
        publishedAt: now.toISOString(),
        boqItems,
        commercialItems: boqItems,
        commercialModel: profile.commercialName,
        commercialLabel: profile.reviewLabel,
        contractType: getCreateTenderEffectiveContractType(profile.id),
        deliverables: getCreateTenderDeliverables(profile).map(item => item.text).filter(Boolean),
        milestones,
        amendments: [
            { title: 'No amendments published', status: 'Ready', detail: `Create an amendment if scope, ${profile.commercialName}, or timeline changes.` }
        ],
        clarifications: [],
        interestedSuppliers: []
    };
    const stored = getProcurexStoredPublishedTenders().filter(tender => tender.id !== publishedTender.id);
    saveProcurexPublishedTenders([publishedTender, ...stored]);
    mockData.tenders = mergeProcurexTenders(mockData.tenders || []);
    localStorage.removeItem(createTenderDraftStorageKey);
    delete ensureCreateTenderDraft().mainDetails;
    selectProcurexTender(publishedTender.id);
    return publishedTender;
}

function buildCreateTenderDocumentPreview(wizard) {
    const setup = getCreateTenderSetup();
    const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
    const selectedType = setup.types.find(type => type.id === selectedTypeId) || setup.defaultType;
    const title = wizard.querySelector('[data-tender-title]')?.value.trim() || getCreateTenderMainDraft().title || 'Draft tender';
    const method = normalizeCreateTenderMethod(wizard.querySelector('[data-procurement-method]')?.value || getCreateTenderMainDraft().method);
    const categories = getCreateTenderWizardCategories(wizard);
    const category = categories.join(', ') || getCreateTenderMainDraft().category || selectedType.label;
    const invitedUsers = getCreateTenderInvitedUsers();
    const fundingSource = getCreateTenderWizardFundingSource(wizard);
    const visibility = getCreateTenderVisibilityForMethod(method);
    const visibilityNote = getCreateTenderVisibilityNoteForMethod(method, invitedUsers.length);
    const contact = getCreateTenderContactDetails();
    const milestones = getCreateTenderMilestones();
    const closingDate = milestones.find(item => item.id === 'milestone-closing')?.date || milestones[milestones.length - 1]?.date || '';
    const profile = getCreateTenderTypeProfile(selectedType);
    const requirementSummary = getCreateTenderRequirementSummary(profile, getCreateTenderMainDraft());
    const boqItems = getCreateTenderBoqItems(profile);

    return {
        id: 'DRAFT-TENDER',
        title,
        type: selectedType.label,
        procurementTypeId: profile.id,
        status: 'Draft',
        budget: getCreateTenderBoqTotal(boqItems),
        closingDate,
        organization: mockData.users?.buyer?.organization || 'Buyer organization',
        description: requirementSummary.filledControls
            ? `${requirementSummary.filledControls} structured requirement fields configured.`
            : 'Structured tender requirements pending.',
        eligibility: `${method} / ${category}`,
        documents: profile.documentLabels || [],
        requiredSubmissionDocuments: getCreateTenderRequiredAttachments(profile).map(item => item.text).filter(Boolean),
        requirements: getCreateTenderRequirementDraft(profile.id),
        evaluation: getCreateTenderEvaluationDraft(profile.id),
        systemEvaluation: getCreateTenderSavedSystemEvaluation(profile.id),
        regulatoryLicenses: getCreateTenderRegulatoryLicenses(profile),
        category,
        categories,
        method,
        fundingSource,
        visibility,
        visibilityNote,
        invitedUsers,
        location: contact.tenderLocation,
        contactName: contact.contactName,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        createdByCurrentUser: true,
        publishedAt: '',
        boqItems,
        commercialItems: boqItems,
        commercialModel: profile.commercialName,
        commercialLabel: profile.reviewLabel,
        contractType: getCreateTenderEffectiveContractType(profile.id),
        deliverables: getCreateTenderDeliverables(profile).map(item => item.text).filter(Boolean),
        milestones,
        amendments: [],
        clarifications: [],
        interestedSuppliers: []
    };
}

function saveCreateTenderDraftFromWizard(wizard) {
    const setup = getCreateTenderSetup();
    const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
    const selectedType = setup.types.find(type => type.id === selectedTypeId) || setup.defaultType;
    const profile = getCreateTenderTypeProfile(selectedType);
    const title = wizard.querySelector('[data-tender-title]')?.value.trim() || '';
    const currentDraft = getCreateTenderMainDraft();
    const details = saveCreateTenderMainDraft({
        title,
        scope: currentDraft.scope || defaultCreateTenderMainDraft.scope,
        procurementTypeId: selectedType.id,
        method: normalizeCreateTenderMethod(wizard.querySelector('[data-procurement-method]')?.value),
        fundingSource: getCreateTenderWizardFundingSource(wizard),
        category: getCreateTenderWizardCategoryValue(wizard, ''),
        categories: getCreateTenderWizardCategories(wizard),
        visibility: getCreateTenderVisibilityForMethod(wizard.querySelector('[data-procurement-method]')?.value),
        visibilityNote: getCreateTenderVisibilityNoteForMethod(wizard.querySelector('[data-procurement-method]')?.value, getCreateTenderInvitedUsers().length),
        invitedUsers: getCreateTenderInvitedUsers(),
        status: 'Saved as draft',
        savedAt: new Date().toISOString(),
        attachmentCount: getCreateTenderRequiredAttachments(profile).length,
        deliverableCount: getCreateTenderDeliverables(profile).length,
        licenseCount: getCreateTenderRegulatoryLicenses(profile).length,
        budget: getCreateTenderBoqTotal(getCreateTenderBoqItems(profile)),
        commercialModel: profile.commercialName
    });
    return details;
}

function renderCreateTenderCommercialTableHead(profile = getCreateTenderCurrentTypeProfile()) {
    return '<tr><th>Code</th><th>Requirement</th><th>Qty / Duration</th><th>Unit</th><th>Rate / Fee</th><th>Amount</th><th></th></tr>';
}

function renderCreateTenderBoqRows(items = getCreateTenderBoqItems(), profile = getCreateTenderCurrentTypeProfile()) {
    if (!items.length) {
        return `
            <tr class="boq-empty-row">
                <td colspan="7">${profile.commercialEmptyText}</td>
            </tr>
        `;
    }

    return items.map((item) => {
        const amount = parseCreateTenderNumber(item.qty) * parseCreateTenderNumber(item.rate);
        return `
            <tr data-boq-row="${escapeCreateTenderHtml(item.id)}">
                <td><input class="form-input boq-input boq-code" value="${escapeCreateTenderHtml(item.item)}" data-boq-field="item" aria-label="${profile.commercialName} line code"></td>
                <td><input class="form-input boq-input boq-description" value="${escapeCreateTenderHtml(item.description)}" data-boq-field="description" aria-label="${profile.commercialName} requirement"></td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="0.01" value="${escapeCreateTenderHtml(item.qty)}" data-boq-field="qty" aria-label="${profile.commercialName} quantity or duration"></td>
                <td><input class="form-input boq-input boq-unit" value="${escapeCreateTenderHtml(item.unit)}" data-boq-field="unit" aria-label="${profile.commercialName} unit"></td>
                <td><input class="form-input boq-input boq-number" type="number" min="0" step="1000" value="${escapeCreateTenderHtml(item.rate)}" data-boq-field="rate" aria-label="${profile.commercialName} rate or fee"></td>
                <td class="boq-amount" data-boq-amount>${formatCreateTenderMoney(amount)}</td>
                <td><button class="boq-row-action icon-delete-btn" type="button" data-boq-delete aria-label="Delete ${profile.commercialItemName}" title="Delete ${profile.commercialItemName}">${renderCreateTenderTrashIcon()}</button></td>
            </tr>
        `;
    }).join('');
}

function isCreateTenderBoqTemplateControl(controlId = '') {
    return ['quantityScheduleRows', 'boqRows'].includes(String(controlId || ''));
}

function getCreateTenderBoqTemplateControlId(profile = getCreateTenderCurrentTypeProfile()) {
    if (profile.id === 'goods') return 'quantityScheduleRows';
    if (profile.id === 'works') return 'boqRows';
    return '';
}

function formatCreateTenderCsvCell(value = '') {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getCreateTenderBoqTemplateRows(profile = getCreateTenderCurrentTypeProfile(), controlId = '') {
    const templateControlId = controlId || getCreateTenderBoqTemplateControlId(profile);
    const control = templateControlId ? getCreateTenderRequirementControl(profile.id, templateControlId) : null;
    const columns = control?.type === 'table'
        ? resolveCreateTenderRequirementColumns(control, profile.id)
        : [];

    if (columns.length) {
        const examples = {
            quantityScheduleRows: [
                ['1', 'Laptop computer, business grade', 'Pcs', '20', '1800000', '=D2*E2'],
                ['2', 'Printer toner cartridge', 'Pcs', '50', '95000', '=D3*E3']
            ],
            boqRows: [
                ['Foundation excavation', '120', 'm3', '1500000', '3200000', '800000', '=D2+E2+F2'],
                ['Concrete works', '40', 'm3', '2200000', '5400000', '1200000', '=D3+E3+F3']
            ]
        };
        return [
            columns.map(column => column.label),
            ...(examples[templateControlId] || [])
        ];
    }

    const examples = {
        works: [
            ['1.1', 'Excavation and earthworks', '1', 'Lot', '2500000', '=C2*E2'],
            ['1.2', 'Concrete works', '40', 'm3', '180000', '=C3*E3']
        ],
        goods: [
            ['1.1', 'Laptop computer, business grade', '20', 'Pcs', '1800000', '=C2*E2'],
            ['1.2', 'Printer toner cartridge', '50', 'Pcs', '95000', '=C3*E3']
        ],
        services: [
            ['1.1', 'Monthly cleaning service', '12', 'Month', '650000', '=C2*E2'],
            ['1.2', 'Deep cleaning service', '4', 'Quarter', '1200000', '=C3*E3']
        ],
        consultancy: [
            ['1.1', 'Team leader professional fee', '30', 'Day', '450000', '=C2*E2'],
            ['1.2', 'Draft report preparation', '1', 'Lot', '1800000', '=C3*E3']
        ]
    };
    return [
        ['Code', 'Requirement', 'Qty / Duration', 'Unit', 'Rate / Fee', 'Amount'],
        ...(examples[profile.id] || examples.works)
    ];
}

function downloadCreateTenderBoqTemplate(profile = getCreateTenderCurrentTypeProfile(), controlId = '') {
    const rows = getCreateTenderBoqTemplateRows(profile, controlId);
    const csv = `\uFEFF${rows.map(row => row.map(formatCreateTenderCsvCell).join(',')).join('\r\n')}\r\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const controlLabel = controlId || getCreateTenderBoqTemplateControlId(profile) || profile.commercialName || 'boq';
    const fileLabel = String(controlLabel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'boq';
    link.href = url;
    link.download = `${fileLabel}-import-template.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function renderCreateTenderMilestoneRows(items = getCreateTenderMilestones()) {
    return items.map((item) => `
        <div class="timeline-tile milestone-tile" data-milestone-row="${escapeCreateTenderHtml(item.id)}">
            <div class="fixed-milestone-name">
                <span>Milestone</span>
                <strong>${escapeCreateTenderHtml(item.name)}</strong>
            </div>
            <label>
                <span>Date</span>
                <input class="form-input milestone-input" type="date" value="${escapeCreateTenderHtml(item.date)}" data-milestone-field="date" aria-label="Milestone date">
            </label>
        </div>
    `).join('');
}

function renderCreateTenderScopeRows(items, type, emptyText) {
    if (!items.length) {
        return `<div class="scope-empty" data-scope-empty="${type}">${emptyText}</div>`;
    }

    const label = type === 'deliverables' ? 'Deliverable item' : 'Attachment item';
    return items.map((item) => `
        <div class="scope-item-row" data-scope-row="${escapeCreateTenderHtml(item.id)}" data-scope-type="${type}">
            <input class="form-input scope-item-input" value="${escapeCreateTenderHtml(item.text)}" data-scope-item-input aria-label="${label}">
            <button class="boq-row-action icon-delete-btn scope-delete" type="button" data-scope-delete aria-label="Delete ${label.toLowerCase()}" title="Delete ${label.toLowerCase()}">${renderCreateTenderTrashIcon()}</button>
        </div>
    `).join('');
}

function renderCreateTenderRegulatoryLicenseRows(items = []) {
    if (!items.length) {
        return '<div class="scope-empty">No regulatory license requirements added yet.</div>';
    }

    return items.map(item => {
        const selectedLicense = getCreateTenderRegulatoryLicenseByName(item.license);
        const body = item.body || selectedLicense.body;
        return `
            <div class="license-requirement-row" data-license-row="${escapeCreateTenderHtml(item.id)}">
                <div class="license-summary">
                    <span>License</span>
                    <strong>${escapeCreateTenderHtml(selectedLicense.license)}</strong>
                    <small>${escapeCreateTenderHtml(body)}</small>
                    <div class="license-picker" data-license-picker hidden>
                        <input class="form-input" type="search" data-license-search autocomplete="off" placeholder="Search license" aria-label="Search regulatory license">
                        <div class="license-results" data-license-results role="listbox" aria-label="Matching licenses"></div>
                    </div>
                </div>
                <div class="license-toggle-cell">
                    <span>Mandatory</span>
                    <label class="requirement-toggle">
                        <input type="checkbox" data-license-field="mandatory" ${item.mandatory ? 'checked' : ''}>
                        <span></span>
                    </label>
                </div>
                <div class="license-toggle-cell">
                    <span>Expiry required</span>
                    <label class="requirement-toggle">
                        <input type="checkbox" data-license-field="expiryRequired" ${item.expiryRequired ? 'checked' : ''}>
                        <span></span>
                    </label>
                </div>
                <div class="license-row-actions">
                    <button class="btn btn-secondary" type="button" data-license-change>Change</button>
                    <button class="boq-row-action icon-delete-btn" type="button" data-license-delete aria-label="Remove license requirement" title="Remove license requirement">${renderCreateTenderTrashIcon()}</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderCreateTenderRegulatoryLicensePanel(profile = getCreateTenderCurrentTypeProfile(), options = {}) {
    const regulatoryLicenses = getCreateTenderRegulatoryLicenses(profile);
    const title = options.title || 'Regulatory license requirements';
    const hint = options.hint || 'Search and select the licenses suppliers must hold for this tender. The issuing body is filled automatically.';

    return `
        <div class="scope-list-panel license-requirements-panel" ${options.standalone ? 'data-standalone-license-panel' : ''}>
            <div class="scope-list-heading">
                <div>
                    <h3>${escapeCreateTenderHtml(title)}</h3>
                    <span class="form-hint">${escapeCreateTenderHtml(hint)}</span>
                </div>
                <span class="badge badge-info" data-license-count>${regulatoryLicenses.length}</span>
            </div>
            <div class="license-requirement-list" data-license-list>
                ${renderCreateTenderRegulatoryLicenseRows(regulatoryLicenses)}
            </div>
            <button class="btn btn-secondary scope-add" type="button" data-license-add>Add License Requirement</button>
            <div class="license-add-picker" data-license-add-picker hidden>
                <input class="form-input" type="search" data-license-add-search autocomplete="off" placeholder="Search all licenses" aria-label="Search all regulatory licenses">
                <div class="license-results" data-license-add-results role="listbox" aria-label="Available regulatory licenses"></div>
            </div>
        </div>
    `;
}

function renderCreateTenderProfileCard(title, items = []) {
    if (!items.length) return '';
    return `
        <article class="review-card">
            <span>${escapeCreateTenderHtml(title)}</span>
            <strong>${escapeCreateTenderHtml(items[0])}</strong>
            <small>${items.slice(1).map(escapeCreateTenderHtml).join(', ')}</small>
        </article>
    `;
}

function renderCreateTenderProfileCards(profile) {
    return `
        <div class="review-summary-grid" style="margin-bottom: 20px;">
            ${renderCreateTenderProfileCard('Planning documents', profile.planningDocuments)}
            ${renderCreateTenderProfileCard('Tender documents', profile.documentLabels)}
            ${renderCreateTenderProfileCard('Key requirements', profile.keyRequirements)}
            ${renderCreateTenderProfileCard('Submission documents', profile.submissionDocuments)}
            ${renderCreateTenderProfileCard('Evaluation flow', profile.evaluationFlow)}
            ${renderCreateTenderProfileCard('Contract structure', profile.contractRequirements)}
            <article class="review-card">
                <span>Evaluation style</span>
                <strong>${escapeCreateTenderHtml(profile.evaluationStyle.split(',')[0])}</strong>
                <small>${escapeCreateTenderHtml(profile.evaluationStyle)}</small>
            </article>
        </div>
    `;
}

function renderCreateTenderEvaluationStatus(summary = getCreateTenderEvaluationSummary()) {
    const statusClass = summary.state === 'balanced' ? 'balanced' : summary.state === 'over' ? 'over' : 'under';
    return `
        <div class="evaluation-weight-panel ${statusClass}" data-evaluation-status-panel>
            <div class="evaluation-weight-status">
                <span>Total Weight: <strong data-evaluation-total>${escapeCreateTenderHtml(summary.total)}%</strong></span>
                <span data-evaluation-remaining>${escapeCreateTenderHtml(summary.message)}</span>
            </div>
            <div class="evaluation-progress-track" aria-hidden="true">
                <span style="width: ${Math.min(summary.total, 100)}%"></span>
            </div>
        </div>
    `;
}

function renderCreateTenderEvaluationSubcriteriaControl(profile, criterion) {
    const selectedSubcriteria = normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria);
    const availableSubcriteria = getCreateTenderAvailableEvaluationSubcriteria(profile.id, criterion);
    return `
        <div class="evaluation-subcriteria-control">
            <span class="form-label">Subcriteria</span>
            <div class="evaluation-subcriteria-list">
                ${selectedSubcriteria.length ? selectedSubcriteria.map(item => `
                    <span class="evaluation-subcriterion-chip">
                        ${escapeCreateTenderHtml(item)}
                        <button type="button" data-evaluation-remove-subcriterion="${escapeCreateTenderHtml(item)}" aria-label="Remove ${escapeCreateTenderHtml(item)}">x</button>
                    </span>
                `).join('') : '<span class="requirement-tag-empty">No subcriteria selected</span>'}
            </div>
            <div class="evaluation-subcriteria-add-row">
                <select class="form-input" data-evaluation-subcriteria-picker aria-label="Select subcriterion" ${availableSubcriteria.length ? '' : 'disabled'}>
                    <option value="">Choose subcriterion</option>
                    ${availableSubcriteria.map(item => `<option value="${escapeCreateTenderHtml(item)}">${escapeCreateTenderHtml(item)}</option>`).join('')}
                </select>
                <button class="btn btn-secondary" type="button" data-evaluation-add-subcriterion ${availableSubcriteria.length ? '' : 'disabled'}>Add</button>
            </div>
            <div class="evaluation-subcriteria-add-row">
                <input class="form-input" data-evaluation-custom-subcriterion placeholder="Custom subcriterion" aria-label="Custom subcriterion">
                <button class="btn btn-secondary" type="button" data-evaluation-add-custom-subcriterion>Add Custom</button>
            </div>
        </div>
    `;
}

function renderCreateTenderEvaluationSelectedCriteria(profile, evaluationDraft = {}) {
    const criteria = Array.isArray(evaluationDraft.criteria) ? evaluationDraft.criteria : [];
    if (!criteria.length) {
        return '<div class="scope-empty">No evaluation criteria selected yet.</div>';
    }

    return criteria.map(criterion => {
        const subcriteria = normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria);
        return `
            <article class="evaluation-selected-card" data-evaluation-criterion="${escapeCreateTenderHtml(criterion.id)}">
                <div class="evaluation-selected-main">
                    <div class="evaluation-selected-copy">
                        <strong>${escapeCreateTenderHtml(criterion.name)}</strong>
                        <div class="evaluation-subcriteria-preview">
                            ${subcriteria.length
                                ? subcriteria.map(item => `<span class="evaluation-subcriterion-chip">${escapeCreateTenderHtml(item)}</span>`).join('')
                                : '<span class="requirement-tag-empty">No subcriteria selected</span>'}
                        </div>
                    </div>
                    <div class="evaluation-selected-actions">
                        <div class="requirement-input-affix evaluation-weight-cell">
                            <input class="form-input evaluation-weight-input" type="number" min="0" max="100" step="0.01" value="${escapeCreateTenderHtml(criterion.weight)}" data-evaluation-field="weight" aria-label="Criterion weight">
                            <span>%</span>
                        </div>
                        <div class="evaluation-card-action-stack">
                            <button class="btn btn-secondary" type="button" data-evaluation-edit>Edit</button>
                            <button class="boq-row-action icon-delete-btn" type="button" data-evaluation-delete="${escapeCreateTenderHtml(criterion.id)}" aria-label="Delete criteria" title="Delete criteria">${renderCreateTenderTrashIcon()}</button>
                        </div>
                    </div>
                </div>
                <div class="evaluation-edit-menu" data-evaluation-edit-menu hidden>
                    <button class="boq-row-action evaluation-edit-close" type="button" data-evaluation-cancel-edit aria-label="Close edit menu" title="Close">x</button>
                    <div class="evaluation-edit-grid">
                        <label>
                            <span class="form-label">Criterion name</span>
                            <input class="form-input" value="${escapeCreateTenderHtml(criterion.name)}" data-evaluation-field="name" aria-label="Criterion name">
                        </label>
                        <label>
                            <span class="form-label">Category</span>
                            <input class="form-input" value="${escapeCreateTenderHtml(criterion.category)}" data-evaluation-field="category" aria-label="Criterion category">
                        </label>
                    </div>
                    ${renderCreateTenderEvaluationSubcriteriaControl(profile, criterion)}
                    <div class="evaluation-edit-actions">
                        <button class="btn btn-secondary" type="button" data-evaluation-cancel-edit>Cancel</button>
                        <button class="btn btn-primary" type="button" data-evaluation-save-edit>Save Changes</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function renderCreateTenderEvaluationSuggestions(profile, evaluationDraft = {}) {
    const selectedIds = new Set((evaluationDraft.criteria || []).map(item => item.id));
    const suggestions = getCreateTenderEvaluationCatalog(profile.id).filter(item => !selectedIds.has(item.id));
    if (!suggestions.length) {
        return '<div class="scope-empty">All suggested criteria have been added.</div>';
    }

    return suggestions.map(suggestion => `
        <button class="evaluation-suggestion" type="button" data-evaluation-add-suggestion="${escapeCreateTenderHtml(suggestion.id)}">
            <span>+</span>
            <strong>${escapeCreateTenderHtml(suggestion.name)}</strong>
            <small>${escapeCreateTenderHtml((suggestion.subcriteria || []).slice(0, 3).join(', '))}</small>
        </button>
    `).join('');
}

function renderCreateTenderEvaluationBuilder(profile, mainDraft = getCreateTenderMainDraft()) {
    const evaluationDraft = getCreateTenderEvaluationDraft(profile.id, mainDraft);
    const summary = getCreateTenderEvaluationSummary(evaluationDraft);
    const badgeClass = summary.state === 'balanced' ? 'badge-success' : summary.state === 'over' ? 'badge-error' : 'badge-warning';
    return `
        <div class="evaluation-builder" data-evaluation-builder>
            <div class="evaluation-builder-header">
                <div>
                    <span class="section-kicker">Evaluation setup</span>
                    <h3>Criteria suggestion library</h3>
                </div>
                <span class="badge ${badgeClass}" data-evaluation-status-badge>${escapeCreateTenderHtml(summary.message)}</span>
            </div>
            ${renderCreateTenderEvaluationStatus(summary)}
            <div class="evaluation-toolbar">
                <label>
                    <span class="form-label">Balancing mode</span>
                    <select class="form-input" data-evaluation-mode>
                        <option value="manual" ${evaluationDraft.mode === 'manual' ? 'selected' : ''}>Manual</option>
                        <option value="auto" ${evaluationDraft.mode === 'auto' ? 'selected' : ''}>Auto-balance</option>
                    </select>
                </label>
                <button class="btn btn-primary" type="button" data-evaluation-add-custom>Add Custom Criterion</button>
            </div>
            <div class="evaluation-builder-grid">
                <section class="evaluation-selected-panel">
                    <div class="scope-list-heading">
                        <div>
                            <h3>Selected criteria</h3>
                            <span class="form-hint">Buyer-controlled labels, weights, and selectable subcriteria.</span>
                        </div>
                        <div class="evaluation-selected-heading-meta">
                            <span>Weight</span>
                            <span class="badge badge-info">${escapeCreateTenderHtml(evaluationDraft.criteria.length)} criteria</span>
                        </div>
                    </div>
                    <div class="evaluation-criteria-list" data-evaluation-criteria-list>
                        ${renderCreateTenderEvaluationSelectedCriteria(profile, evaluationDraft)}
                    </div>
                </section>
            </div>
            <div class="evaluation-suggestions-row">
                <section class="evaluation-suggestions-panel">
                    <div class="scope-list-heading">
                        <div>
                            <h3>Suggested criteria</h3>
                            <span class="form-hint">Suggestions are guidance only and can be removed after adding.</span>
                        </div>
                    </div>
                    <div class="evaluation-suggestion-list" data-evaluation-suggestion-list>
                        ${renderCreateTenderEvaluationSuggestions(profile, evaluationDraft)}
                    </div>
                </section>
            </div>
        </div>
    `;
}

function isCreateTenderReviewValueEmpty(value) {
    if (Array.isArray(value)) return !value.length;
    if (value && typeof value === 'object') return !Object.keys(value).length;
    return String(value ?? '').trim() === '';
}

function formatCreateTenderReviewValue(value) {
    if (Array.isArray(value)) {
        return value.length
            ? value.map(item => escapeCreateTenderHtml(item)).join(', ')
            : 'Not provided';
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value && typeof value === 'object') return Object.values(value).filter(item => !isCreateTenderReviewValueEmpty(item)).map(escapeCreateTenderHtml).join(', ') || 'Not provided';
    return escapeCreateTenderHtml(value || 'Not provided');
}

function renderCreateTenderReviewField(label, value) {
    return `
        <div class="tender-review-field">
            <span>${escapeCreateTenderHtml(label)}</span>
            <strong>${formatCreateTenderReviewValue(value)}</strong>
        </div>
    `;
}

function renderCreateTenderReviewTextList(items = [], emptyText = 'No items added yet.') {
    const values = (items || []).map(item => item.text || item.name || item.title || '').filter(Boolean);
    if (!values.length) return `<div class="scope-empty">${escapeCreateTenderHtml(emptyText)}</div>`;
    return `
        <ul class="tender-review-bullet-list">
            ${values.map(item => `<li>${escapeCreateTenderHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderCreateTenderReviewObjectRows(rows = [], fields = []) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (!normalizedRows.length) return '<div class="scope-empty">No records added yet.</div>';
    return `
        <div class="tender-review-record-list">
            ${normalizedRows.map((row, index) => `
                <article class="tender-review-record">
                    <strong>Item ${index + 1}</strong>
                    <div class="tender-review-field-grid">
                        ${fields.filter(field => field.type !== 'index' && field.type !== 'calculated').map(field => renderCreateTenderReviewField(field.label, row[field.id])).join('')}
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function renderCreateTenderReviewControl(control, value, profileId = 'works') {
    if (control.type === 'list') {
        return renderCreateTenderReviewTextList(normalizeCreateTenderRequirementTextItems(value, control.id), control.emptyText);
    }
    if (control.type === 'table') {
        const columns = resolveCreateTenderRequirementColumns(control, profileId);
        return renderCreateTenderReviewObjectRows(normalizeCreateTenderRequirementTableRows(value, columns, control.id), columns);
    }
    if (control.type === 'cards') {
        const fields = resolveCreateTenderRequirementFields(control, profileId);
        return renderCreateTenderReviewObjectRows(normalizeCreateTenderRequirementObjectRows(value, fields, control.id), fields);
    }
    if (control.type === 'accordion') {
        const values = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        return `
            <div class="tender-review-field-grid">
                ${(control.panels || []).map(panel => renderCreateTenderReviewField(panel.label, values[panel.id])).join('')}
            </div>
        `;
    }
    if (control.type === 'regulatory-licenses') {
        const licenses = getCreateTenderRegulatoryLicenses(getCreateTenderTypeProfile(profileId));
        return licenses.length ? renderCreateTenderReviewObjectRows(licenses, [
            { id: 'license', label: 'License' },
            { id: 'body', label: 'Issuing body' },
            { id: 'mandatory', label: 'Mandatory' },
            { id: 'expiryRequired', label: 'Expiry validation' }
        ]) : '<div class="scope-empty">No regulatory licenses selected.</div>';
    }
    return renderCreateTenderReviewField(control.label, value);
}

function renderCreateTenderReviewRequirements(profile, mainDraft = getCreateTenderMainDraft()) {
    const template = getCreateTenderRequirementTemplate(profile.id);
    const requirementDraft = getCreateTenderRequirementDraft(profile.id);
    return `
        <div class="tender-review-section-stack">
            ${template.sections.map(section => `
                <article class="tender-review-section">
                    <div>
                        <h4>${escapeCreateTenderHtml(section.title)}</h4>
                        <span class="form-hint">${escapeCreateTenderHtml(section.hint || '')}</span>
                    </div>
                    ${(section.controls || []).map(control => `
                        <div class="tender-review-control">
                            <span class="form-label">${escapeCreateTenderHtml(control.label)}</span>
                            ${renderCreateTenderReviewControl(control, requirementDraft.fields?.[control.id], profile.id)}
                        </div>
                    `).join('')}
                </article>
            `).join('')}
        </div>
    `;
}

function renderCreateTenderReviewEvaluation(evaluationDraft = {}) {
    const criteria = Array.isArray(evaluationDraft.criteria) ? evaluationDraft.criteria : [];
    if (!criteria.length) return '<div class="scope-empty">No evaluation criteria configured.</div>';
    return `
        <div class="tender-review-record-list">
            ${criteria.map(criterion => `
                <article class="tender-review-record">
                    <div class="tender-review-record-heading">
                        <strong>${escapeCreateTenderHtml(criterion.name)}</strong>
                        <span>${escapeCreateTenderHtml(criterion.weight)}%</span>
                    </div>
                    ${renderCreateTenderReviewTextList((criterion.subcriteria || []).map(text => ({ text })), 'No subcriteria selected.')}
                </article>
            `).join('')}
        </div>
    `;
}

function renderCreateTenderReviewWorkspace(profile, mainDraft = getCreateTenderMainDraft()) {
    const setup = getCreateTenderSetup();
    const selectedType = setup.types.find(type => type.id === profile.id) || setup.defaultType;
    const contact = getCreateTenderContactDetails();
    const categories = getCreateTenderSelectedCategories(mainDraft);
    const method = normalizeCreateTenderMethod(mainDraft.method);
    const licenses = getCreateTenderRegulatoryLicenses(profile);
    const boqItems = getCreateTenderBoqItems(profile);
    const deliverables = getCreateTenderDeliverables(profile);
    const attachments = getCreateTenderRequiredAttachments(profile);
    const milestones = getCreateTenderMilestones();
    const milestoneSummary = getCreateTenderMilestoneSummary(milestones);
    const evaluationDraft = getCreateTenderEvaluationDraft(profile.id, mainDraft);
    const evaluationSummary = getCreateTenderEvaluationSummary(evaluationDraft);
    const requirementSummary = getCreateTenderRequirementSummary(profile, mainDraft);
    const invitedUsers = getCreateTenderInvitedUsers();
    const fundingSource = getCreateTenderMainFundingSource(mainDraft);

    return `
        <div class="tender-review-workspace">
            <section class="tender-review-panel">
                <div class="scope-list-heading">
                    <div>
                        <h3>Tender information</h3>
                        <span class="form-hint">Basic details, contact, procurement type, category, method, and visibility.</span>
                    </div>
                </div>
                <div class="tender-review-field-grid">
                    ${renderCreateTenderReviewField('Tender title', mainDraft.title)}
                    ${renderCreateTenderReviewField('Procurement type', selectedType.label)}
                    ${renderCreateTenderReviewField('Categories', categories)}
                    ${renderCreateTenderReviewField('Procurement method', method)}
                    ${renderCreateTenderReviewField('Funding source', fundingSource)}
                    ${renderCreateTenderReviewField('Visibility', getCreateTenderVisibilityForMethod(method))}
                    ${renderCreateTenderReviewField('Invited suppliers', invitedUsers.map(user => user.name))}
                    ${renderCreateTenderReviewField('Location', contact.tenderLocation)}
                    ${renderCreateTenderReviewField('Contact person / department', contact.contactName)}
                    ${renderCreateTenderReviewField('Phone', contact.phone)}
                    ${renderCreateTenderReviewField('Email', contact.email)}
                </div>
            </section>

            <section class="tender-review-panel">
                <div class="scope-list-heading">
                    <div>
                        <h3>Tender requirements</h3>
                        <span class="form-hint">${escapeCreateTenderHtml(requirementSummary.filledControls)} of ${escapeCreateTenderHtml(requirementSummary.totalControls)} structured fields started.</span>
                    </div>
                </div>
                ${renderCreateTenderReviewRequirements(profile, mainDraft)}
            </section>

            ${profile.id === 'consultancy' ? '' : `
                <section class="tender-review-panel">
                    <div class="scope-list-heading">
                        <div>
                            <h3>Regulatory license requirements</h3>
                            <span class="form-hint">Licenses required for supplier eligibility.</span>
                        </div>
                    </div>
                    ${licenses.length ? renderCreateTenderReviewObjectRows(licenses, [
                        { id: 'license', label: 'License' },
                        { id: 'body', label: 'Issuing body' },
                        { id: 'mandatory', label: 'Mandatory' },
                        { id: 'expiryRequired', label: 'Expiry validation' }
                    ]) : '<div class="scope-empty">No regulatory licenses selected.</div>'}
                </section>
            `}

            <section class="tender-review-panel">
                <div class="scope-list-heading">
                    <div>
                        <h3>${escapeCreateTenderHtml(profile.commercialTitle)}</h3>
                        <span class="form-hint">Commercial schedule and estimated amount.</span>
                    </div>
                    <span class="badge badge-info">${formatCreateTenderMoney(getCreateTenderBoqTotal(boqItems))}</span>
                </div>
                ${boqItems.length ? renderCreateTenderReviewObjectRows(boqItems, [
                    { id: 'item', label: 'Code' },
                    { id: 'description', label: 'Requirement' },
                    { id: 'qty', label: 'Qty / Duration' },
                    { id: 'unit', label: 'Unit' },
                    { id: 'rate', label: 'Rate / Fee' }
                ]) : `<div class="scope-empty">${escapeCreateTenderHtml(profile.commercialEmptyText)}</div>`}
            </section>

            <section class="tender-review-panel">
                <div class="scope-list-heading">
                    <div>
                        <h3>Deliverables and attachments</h3>
                        <span class="form-hint">Outputs and required supporting documents.</span>
                    </div>
                </div>
                <div class="tender-review-two-column">
                    <div>
                        <h4>${escapeCreateTenderHtml(profile.deliverablesTitle)}</h4>
                        ${renderCreateTenderReviewTextList(deliverables, 'No deliverables added yet.')}
                    </div>
                    <div>
                        <h4>Required attachments</h4>
                        ${renderCreateTenderReviewTextList(attachments, 'No required attachments added yet.')}
                    </div>
                </div>
            </section>

            <section class="tender-review-panel">
                <div class="scope-list-heading">
                    <div>
                        <h3>Evaluation criteria and timeline</h3>
                        <span class="form-hint">Evaluation weights and publication milestones.</span>
                    </div>
                    <span class="badge ${evaluationSummary.isBalanced ? 'badge-success' : 'badge-warning'}">${escapeCreateTenderHtml(evaluationSummary.message)}</span>
                </div>
                <div class="tender-review-two-column">
                    <div>
                        <h4>Evaluation criteria</h4>
                        ${renderCreateTenderReviewEvaluation(evaluationDraft)}
                    </div>
                    <div>
                        <h4>Timeline</h4>
                        <div class="tender-review-field-grid">
                            ${milestones.map(item => renderCreateTenderReviewField(item.name, item.date ? formatCreateTenderDate(item.date) : '')).join('')}
                            ${renderCreateTenderReviewField('Window', milestoneSummary.days ? `${milestoneSummary.days} days` : '')}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function collectCreateTenderSystemEvaluationText(profile, mainDraft = getCreateTenderMainDraft()) {
    const requirementDraft = getCreateTenderRequirementDraft(profile.id);
    const fields = requirementDraft.fields || {};
    const values = [];
    const collect = (value) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) {
            value.forEach(collect);
            return;
        }
        if (typeof value === 'object') {
            Object.entries(value).forEach(([key, entry]) => {
                if (key !== 'id') collect(entry);
            });
            return;
        }
        const text = String(value || '').trim();
        if (text) values.push(text);
    };

    collect(mainDraft.title);
    collect(mainDraft.category);
    collect(fields);
    collect(getCreateTenderDeliverables(profile));
    collect(getCreateTenderRequiredAttachments(profile));
    collect(getCreateTenderBoqItems(profile));
    return values.join(' ');
}

function getCreateTenderGrammarIssues(text = '') {
    const issues = [];
    const normalizedText = String(text || '').trim();
    if (!normalizedText) {
        return ['Tender content is too limited for a language check.'];
    }
    if (/\s{2,}/.test(normalizedText)) {
        issues.push('Remove repeated spaces.');
    }
    if (/\b(teh|recieve|seperate|adress|definately|occured|untill|wich)\b/i.test(normalizedText)) {
        issues.push('Correct common spelling mistakes.');
    }
    const sentences = normalizedText
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 12);
    const missingPunctuation = sentences.filter(sentence => !/[.!?]$/.test(sentence)).length;
    if (sentences.length && missingPunctuation > Math.max(1, Math.floor(sentences.length * 0.25))) {
        issues.push('Add punctuation to long sentences.');
    }
    const weakStarts = sentences.filter(sentence => /^[a-z]/.test(sentence)).length;
    if (weakStarts > Math.max(1, Math.floor(sentences.length * 0.25))) {
        issues.push('Start sentences with capital letters.');
    }
    if (normalizedText.length < 250) {
        issues.push('Add more descriptive tender content for a clearer review.');
    }
    return issues;
}

function getCreateTenderSystemEvaluationSignature(profile, mainDraft = getCreateTenderMainDraft()) {
    const evaluationDraft = getCreateTenderEvaluationDraft(profile.id, mainDraft);
    const milestones = getCreateTenderMilestones().map(item => `${item.id}:${item.date}`).join('|');
    return JSON.stringify({
        title: mainDraft.title || '',
        categories: getCreateTenderSelectedCategories(mainDraft),
        requirements: collectCreateTenderSystemEvaluationText(profile, mainDraft),
        commercialCount: getCreateTenderBoqItems(profile).length,
        commercialTotal: getCreateTenderBoqTotal(getCreateTenderBoqItems(profile)),
        evaluation: evaluationDraft.criteria.map(item => ({
            name: item.name,
            weight: item.weight,
            subcriteria: item.subcriteria
        })),
        milestones
    });
}

function getCreateTenderSystemEvaluation(profile, mainDraft = getCreateTenderMainDraft()) {
    const requirementSummary = getCreateTenderRequirementSummary(profile, mainDraft);
    const evaluationDraft = getCreateTenderEvaluationDraft(profile.id, mainDraft);
    const evaluationSummary = getCreateTenderEvaluationSummary(evaluationDraft);
    const text = collectCreateTenderSystemEvaluationText(profile, mainDraft);
    const grammarIssues = getCreateTenderGrammarIssues(text);
    const hasTitle = String(mainDraft.title || '').trim().length >= 8;
    const hasCategory = getCreateTenderSelectedCategories(mainDraft).length > 0;
    const hasRequirements = requirementSummary.filledControls >= Math.max(1, Math.ceil(requirementSummary.totalControls * 0.2));
    const hasCommercial = getCreateTenderBoqItems(profile).length > 0;
    const hasTimeline = getCreateTenderMilestoneSummary(getCreateTenderMilestones()).datedCount >= 2;
    const hasEvaluation = evaluationSummary.isBalanced;
    const understandingChecks = [
        { label: 'Tender title is clear', passed: hasTitle },
        { label: 'Procurement category is selected', passed: hasCategory },
        { label: 'Tender requirements contain enough detail', passed: hasRequirements },
        { label: `${profile.commercialName} has at least one line`, passed: hasCommercial },
        { label: 'Key timeline dates are set', passed: hasTimeline },
        { label: 'Evaluation weights are balanced', passed: hasEvaluation }
    ];
    const passedUnderstanding = understandingChecks.filter(item => item.passed).length;
    const grammarScore = Math.max(0, 100 - (grammarIssues.length * 18));
    const understandingScore = Math.round((passedUnderstanding / understandingChecks.length) * 100);
    const overallScore = Math.round((understandingScore * 0.65) + (grammarScore * 0.35));
    const passed = overallScore >= 70 && grammarIssues.length <= 3 && passedUnderstanding >= 4 && hasEvaluation;

    return {
        status: passed ? 'passed' : 'needs_attention',
        completed: passed,
        overallScore,
        understandingScore,
        grammarScore,
        grammarIssues,
        understandingChecks,
        signature: getCreateTenderSystemEvaluationSignature(profile, mainDraft),
        evaluatedAt: new Date().toISOString()
    };
}

function getCreateTenderSavedSystemEvaluation(profileId = 'works', mainDraft = getCreateTenderMainDraft()) {
    const typeId = getCreateTenderTypeId(profileId);
    const evaluations = mainDraft.systemEvaluation || {};
    const savedEvaluation = evaluations[typeId];
    return savedEvaluation && typeof savedEvaluation === 'object' ? savedEvaluation : null;
}

function isCreateTenderSavedSystemEvaluationCurrent(profile, mainDraft = getCreateTenderMainDraft()) {
    const savedEvaluation = getCreateTenderSavedSystemEvaluation(profile.id, mainDraft);
    return Boolean(savedEvaluation?.completed && savedEvaluation.signature === getCreateTenderSystemEvaluationSignature(profile, mainDraft));
}

function saveCreateTenderSystemEvaluation(profileId = 'works', result = {}) {
    const typeId = getCreateTenderTypeId(profileId);
    const mainDraft = getCreateTenderMainDraft();
    saveCreateTenderMainDraft({
        systemEvaluation: {
            ...(mainDraft.systemEvaluation || {}),
            [typeId]: result
        }
    });
    return result;
}

function getCreateTenderEvaluationReturnMessages(result = {}) {
    const informationChanges = (result.understandingChecks || [])
        .filter(check => !check.passed)
        .map(check => check.label);
    const grammarChanges = Array.isArray(result.grammarIssues) ? result.grammarIssues : [];
    const changes = [...informationChanges, ...grammarChanges];
    return changes.length ? changes : ['Review the tender information, grammar, and formality before submitting again.'];
}

function renderCreateTenderSystemEvaluationPanel(profile, mainDraft = getCreateTenderMainDraft()) {
    const isCurrent = isCreateTenderSavedSystemEvaluationCurrent(profile, mainDraft);
    const badgeClass = isCurrent ? 'badge-success' : 'badge-info';
    return `
        <div class="system-evaluation-workspace system-evaluation-submit-flow" data-system-evaluation-wrap>
            <section class="system-evaluation-submit-card">
                <div class="system-evaluation-submit-header">
                    <div>
                        <span class="section-kicker">Evaluation submission</span>
                        <h3>Submit Tender for Evaluation</h3>
                    </div>
                    <span class="badge ${badgeClass}" data-system-evaluation-status>${isCurrent ? 'Evaluation completed' : 'Ready to submit'}</span>
                </div>
                <div class="system-evaluation-description">
                    <strong>Description</strong>
                    <p>Your tender will be reviewed by the system evaluator for grammar, professionalism, clarity, and completeness before publication.</p>
                </div>
                <div class="system-evaluation-outcome-grid">
                    <article class="system-evaluation-outcome-card outcome-pass">
                        <h4>If the tender passes evaluation:</h4>
                        <ul>
                            <li>It will be published automatically to the marketplace.</li>
                            <li>You will receive a success notification.</li>
                        </ul>
                    </article>
                    <article class="system-evaluation-outcome-card outcome-return">
                        <h4>If the tender does not pass:</h4>
                        <ul>
                            <li>It will return to your dashboard as a draft.</li>
                            <li>You will receive comments and required changes from the evaluator.</li>
                        </ul>
                    </article>
                </div>
                <div class="system-evaluation-confirmations">
                    <label>
                        <input type="checkbox" data-evaluation-confirmation>
                        <span>I confirm the tender information is complete and accurate.</span>
                    </label>
                    <label>
                        <input type="checkbox" data-evaluation-confirmation>
                        <span>I understand the tender will be reviewed before publication.</span>
                    </label>
                    <label>
                        <input type="checkbox" data-evaluation-confirmation>
                        <span>I understand rejected tenders will return as draft with comments.</span>
                    </label>
                </div>
                <div class="submit-strip buyer-review-submit system-evaluation-publish">
                    <div style="color: #ffffff !important;">
                        <strong style="color: #ffffff !important;">Actions</strong>
                        <span data-system-publish-note style="color: rgba(255, 255, 255, 0.78) !important;">Submit the tender to the evaluator. The creation wizard will close after submission.</span>
                    </div>
                    <div class="system-evaluation-action-buttons">
                        <button class="btn btn-secondary" type="button" data-download-draft-tender-pdf>Download Tender PDF</button>
                        <button class="btn btn-primary" type="button" data-run-system-evaluation disabled>Submit Tender for Evaluation</button>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function renderCreateTender() {
    const procurementSetup = getCreateTenderSetup();
    const mainDraft = getCreateTenderMainDraft();
    const selectedType = procurementSetup.types.find(type => type.id === mainDraft.procurementTypeId) || procurementSetup.defaultType;
    const selectedCategories = getCreateTenderSelectedCategories(mainDraft);
    const categorySummary = selectedCategories.join(', ');
    const selectedProfile = getCreateTenderTypeProfile(selectedType);
    const contactDetails = getCreateTenderContactDetails();
    const contactSummary = getCreateTenderContactSummary(contactDetails);
    const boqItems = getCreateTenderBoqItems(selectedProfile);
    const boqTotal = getCreateTenderBoqTotal(boqItems);
    const milestones = getCreateTenderMilestones();
    const milestoneSummary = getCreateTenderMilestoneSummary(milestones);
    const deliverables = getCreateTenderDeliverables(selectedProfile);
    const requiredAttachments = getCreateTenderRequiredAttachments(selectedProfile);
    const regulatoryLicenses = getCreateTenderRegulatoryLicenses(selectedProfile);
    const requirementSummary = getCreateTenderRequirementSummary(selectedProfile, mainDraft);
    const evaluationDraft = getCreateTenderEvaluationDraft(selectedProfile.id, mainDraft);
    const evaluationSummary = getCreateTenderEvaluationSummary(evaluationDraft);
    const tenderMethod = normalizeCreateTenderMethod(mainDraft.method);
    const fundingSourceValue = getCreateTenderMainFundingSource(mainDraft);
    const fundingSourceIsCustom = Boolean(fundingSourceValue && !createTenderRequirementOptions.fundingSources.includes(fundingSourceValue));
    const fundingSourceSelectValue = fundingSourceIsCustom ? 'Other' : fundingSourceValue;
    const fundingSourceCustomValue = fundingSourceIsCustom ? fundingSourceValue : '';
    const invitedUsers = getCreateTenderInvitedUsers();
    const isClosedTender = isCreateTenderClosedMethod(tenderMethod);
    const steps = [
        ['01', 'Basic Information', 'Tender location and contact'],
        ['02', 'Tender Planning', 'Type, category, method, invitations'],
        ['03', 'Tender Requirements', `${requirementSummary.title}, licenses`],
        ['04', 'Evaluation Criteria and Weights', 'Criteria, weights, pass marks'],
        ['05', 'Review Tender', 'All entries'],
        ['06', 'Evaluation', 'Submit to evaluator']
    ];

    return `
        <div class="main-layout">
            <div class="sidebar">
                <div style="padding: 0 16px 20px;">
                    <h3>Create Tender</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Design and publication package</div>
                </div>

                <ul class="sidebar-nav">
                    <li><a href="#" data-navigate="procurement-dashboard">Procurement Dashboard</a></li>
                    <li><a href="#" data-navigate="procurement-guide">Procurement Process Guide</a></li>
                    <li><a href="#" data-navigate="communication-center">Communication Center</a></li>
                    <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                    <li><a href="#" data-navigate="records-history">Records and History</a></li>
                    <li><a href="#" data-navigate="welcome">Logout</a></li>
                </ul>
            </div>

            <div class="main-content">
                <div class="journey-page tender-wizard-page">
                    <section class="journey-hero compact">
                        <div>
                            <span class="badge badge-info">Procurement design</span>
                            <h1>Create Tender Wizard</h1>
                            <p>Build a tender package that matches the procurement nature, then publish it directly to the marketplace.</p>
                        </div>
                        <div class="hero-action-stack">
                            <button class="btn btn-secondary" type="button" data-save-tender-draft>Save Draft</button>
                        </div>
                    </section>

                    <div class="wizard-shell" data-create-tender-wizard>
                        <nav class="wizard-step-progress" aria-label="Create tender progress">
                            ${steps.map((step, index) => `
                                <button type="button" class="wizard-progress-step ${index === 0 ? 'active' : ''}" data-wizard-step-index="${index}">
                                    <strong>${step[0]}</strong>
                                    <span>${step[1]}</span>
                                </button>
                            `).join('')}
                        </nav>

                        <aside class="wizard-rail">
                            ${steps.map((step, index) => `
                                <a href="#wizard-step-${index + 1}" class="wizard-rail-step ${index === 0 ? 'active' : ''}" data-wizard-step-index="${index}">
                                    <strong>${step[0]}</strong>
                                    <span>${step[1]}</span>
                                </a>
                            `).join('')}
                        </aside>

                        <div class="wizard-workspace">
                            <section class="journey-panel active" id="wizard-step-1">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 1</span>
                                        <h2>Basic Information</h2>
                                    </div>
                                    <span class="badge ${contactSummary.complete ? 'badge-success' : 'badge-warning'}" data-contact-status-badge>${contactSummary.complete ? 'Contact verified' : 'Verify contact'}</span>
                                </div>
                                <div class="contact-detail-grid">
                                    <div class="form-group">
                                        <label class="form-label">Delivery Point </label>
                                        <input class="form-input" value="${escapeCreateTenderHtml(contactDetails.tenderLocation)}" data-contact-field="tenderLocation" aria-label="Delivery Point ">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Contact person or department</label>
                                        <input class="form-input" value="${escapeCreateTenderHtml(contactDetails.contactName)}" data-contact-field="contactName" aria-label="Contact person or department">
                                    </div>
                                    <div class="form-group contact-verify-field">
                                        <label class="form-label">Contact phone number</label>
                                        <div class="contact-verify-row">
                                            <input class="form-input" value="${escapeCreateTenderHtml(contactDetails.phone)}" data-contact-field="phone" aria-label="Contact phone number">
                                            <button class="btn btn-secondary" type="button" data-contact-verify="phone">Verify</button>
                                        </div>
                                        <span class="form-hint" data-contact-status="phone">${contactDetails.phoneVerified && contactSummary.phoneValid ? 'Phone verified' : contactSummary.phoneValid ? 'Phone ready to verify' : 'Enter a valid phone number'}</span>
                                    </div>
                                    <div class="form-group contact-verify-field">
                                        <label class="form-label">Contact email</label>
                                        <div class="contact-verify-row">
                                            <input class="form-input" type="email" value="${escapeCreateTenderHtml(contactDetails.email)}" data-contact-field="email" aria-label="Contact email">
                                            <button class="btn btn-secondary" type="button" data-contact-verify="email">Verify</button>
                                        </div>
                                        <span class="form-hint" data-contact-status="email">${contactDetails.emailVerified && contactSummary.emailValid ? 'Email verified' : contactSummary.emailValid ? 'Email ready to verify' : 'Enter a valid email address'}</span>
                                    </div>
                                </div>
                                           <div class="planning-section">
                                    <div class="scope-list-heading">
                                        <div>
                                            <h3>Tender details</h3>
                                            <span class="form-hint">Enter the tender title and key dates before preparing documents.</span>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <div class="form-group">
                                            <label class="form-label">Tender title</label>
                                            <input class="form-input" value="${escapeCreateTenderHtml(mainDraft.title)}" aria-label="Tender title" data-tender-title>
                                        </div>
                                        <div class="form-grid two">
                                        <div class="form-group">
                                            <label class="form-label">Funding source</label>
                                            <select class="form-input" data-tender-funding-source-select aria-label="Funding source">
                                                ${renderCreateTenderOptions(createTenderRequirementOptions.fundingSources, fundingSourceSelectValue)}
                                            </select>
                                            <input class="form-input" style="margin-top: 8px;" value="${escapeCreateTenderHtml(fundingSourceCustomValue)}" data-tender-funding-source-custom aria-label="Custom funding source" placeholder="Type funding source" ${fundingSourceSelectValue === 'Other' ? '' : 'hidden'}>
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">Submission deadline</label>
                                            <input class="form-input" type="date" value="${escapeCreateTenderHtml(milestones.find(item => item.id === 'milestone-closing')?.date || '')}" data-milestone-field="date" data-milestone-row-proxy="milestone-closing" aria-label="Submission deadline">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">Opening date</label>
                                            <input class="form-input" type="date" value="${escapeCreateTenderHtml(milestones.find(item => item.id === 'milestone-opening')?.date || '')}" data-milestone-field="date" data-milestone-row-proxy="milestone-opening" aria-label="Opening date">
                                        </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="journey-panel" id="wizard-step-2">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 2</span>
                                        <h2>Tender Planning</h2>
                                    </div>
                                    <span class="badge badge-success">Method valid</span>
                                </div>
                                <div class="planning-section">
                                    <div class="scope-list-heading">
                                        <div>
                                            <h3>Procurement classification</h3>
                                            <span class="form-hint">Choose the procurement type, then search and select the matching category.</span>
                                        </div>
                                    </div>
                                    <div class="option-grid four" data-procurement-type-grid>
                                        ${procurementSetup.types.map(type => `
                                            <label class="option-card ${type.id === selectedType.id ? 'selected' : ''}" data-procurement-type-card>
                                                <input type="radio" name="procurementType" value="${type.id}" ${type.id === selectedType.id ? 'checked' : ''}>
                                                <strong>${type.label}</strong>
                                                <span>${type.description}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                    <div class="form-group category-selector-panel">
                                        <label class="form-label">Category</label>
                                        <div class="category-picker" data-category-picker>
                                            <input class="form-input" data-procurement-category-search aria-label="Search procurement categories" placeholder="Search categories">
                                            <div class="category-results" data-category-results role="listbox"></div>
                                        </div>
                                        <div class="custom-category-field" data-custom-category-group hidden>
                                            <label class="form-label">Custom category</label>
                                            <div class="custom-category-add-row">
                                                <input class="form-input" data-custom-category aria-label="Custom category" placeholder="Write custom category" disabled>
                                                <button class="btn btn-secondary" type="button" data-custom-category-add>Add</button>
                                            </div>
                                        </div>
                                        <div class="selected-category-list single-category-mode" data-selected-category-list>
                                            ${renderCreateTenderSelectedCategoryRows(selectedCategories)}
                                        </div>
                                    </div>
                                </div>
                                <div class="planning-section tender-method-section">
                                    <div class="scope-list-heading">
                                        <div>
                                            <h3>Procurement method</h3>
                                            <span class="form-hint">Open tenders go to the public marketplace. Invited tenders are sent only to selected suppliers.</span>
                                        </div>
                                    </div>
                                    <div class="method-inner-panel">
                                        <div class="form-group">
                                            <label class="form-label">Method</label>
                                            <select class="form-input" name="procurementMethod" data-procurement-method>
                                                ${renderCreateTenderOptions(procurementSetup.methods, tenderMethod)}
                                            </select>
                                            <span class="form-hint" data-method-visibility-note>${escapeCreateTenderHtml(getCreateTenderVisibilityNoteForMethod(tenderMethod, invitedUsers.length))}</span>
                                        </div>
                                        <div class="closed-tender-invitations" data-closed-tender-panel ${isClosedTender ? '' : 'hidden'}>
                                            <div class="scope-list-heading">
                                                <div>
                                                    <h3>Invited suppliers</h3>
                                                    <span class="form-hint">Search users, add preferred suppliers to the invite list, and remove them anytime.</span>
                                                </div>
                                                <span class="badge badge-info" data-invited-user-count>${invitedUsers.length}</span>
                                            </div>
                                            <div class="invite-picker">
                                                <input class="form-input" data-invite-search aria-label="Search suppliers to invite" placeholder="Search supplier users">
                                                <div class="invite-results" data-invite-results role="listbox"></div>
                                            </div>
                                            <div class="invited-user-list" data-invited-user-list>
                                                ${renderCreateTenderInvitedUserRows(invitedUsers)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="journey-panel" id="wizard-step-3">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 3</span>
                                        <h2 data-profile-requirement-title>Tender Requirements</h2>
                                    </div>
                                    <span class="badge badge-warning" data-requirement-type-badge>${escapeCreateTenderHtml(requirementSummary.title)}</span>
                                </div>
                                <div data-requirement-sections>
                                    ${renderCreateTenderRequirementSections(selectedProfile, mainDraft, {
                                        excludeSectionIds: getCreateTenderPostLicenseRequirementSectionIds(selectedProfile)
                                    })}
                                </div>
                                <div data-license-panel-slot>
                                    ${selectedProfile.id === 'consultancy'
                                        ? ''
                                        : renderCreateTenderRegulatoryLicensePanel(selectedProfile, { standalone: true })}
                                </div>
                                <div data-post-license-requirement-sections>
                                    ${renderCreateTenderRequirementSections(selectedProfile, mainDraft, {
                                        includeSectionIds: getCreateTenderPostLicenseRequirementSectionIds(selectedProfile),
                                        showHeader: false
                                    })}
                                </div>
                            </section>

                            <section class="journey-panel" id="wizard-step-4">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 4</span>
                                        <h2>Evaluation Criteria and Weights</h2>
                                    </div>
                                    <span class="badge ${evaluationSummary.state === 'balanced' ? 'badge-success' : evaluationSummary.state === 'over' ? 'badge-error' : 'badge-warning'}" data-evaluation-header-badge>${escapeCreateTenderHtml(evaluationSummary.message)}</span>
                                </div>
                                <div data-evaluation-builder-wrap>
                                    ${renderCreateTenderEvaluationBuilder(selectedProfile, mainDraft)}
                                </div>
                            </section>

                            <section class="journey-panel" id="wizard-step-5">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 5</span>
                                        <h2>Review Tender</h2>
                                    </div>
                                    <span class="badge badge-info">Buyer preview</span>
                                </div>
                                <div data-tender-review-wrap>
                                    ${renderCreateTenderReviewWorkspace(selectedProfile, mainDraft)}
                                </div>
                            </section>

                            <section class="journey-panel review-panel" id="wizard-step-6">
                                <div class="panel-heading">
                                    <div>
                                        <span class="section-kicker">Step 6</span>
                                        <h2>Evaluation Submission</h2>
                                    </div>
                                    <span class="badge ${isCreateTenderSavedSystemEvaluationCurrent(selectedProfile, mainDraft) ? 'badge-success' : 'badge-warning'}" data-system-evaluation-header-badge>${isCreateTenderSavedSystemEvaluationCurrent(selectedProfile, mainDraft) ? 'Evaluation complete' : 'Evaluation required'}</span>
                                </div>
                                ${renderCreateTenderSystemEvaluationPanel(selectedProfile, mainDraft)}
                            </section>

                            <div class="wizard-flow-controls" data-wizard-flow-controls>
                                <button class="btn btn-secondary" type="button" data-wizard-prev>Back</button>
                                <div class="wizard-flow-progress">
                                    <strong data-wizard-progress>Step 1 of ${steps.length}</strong>
                                    <span data-wizard-step-title>${steps[0][1]}</span>
                                </div>
                                <button class="btn btn-primary" type="button" data-wizard-next>Continue</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initializeCreateTenderWizard() {
    const wizard = document.querySelector('[data-create-tender-wizard]');
    if (!wizard || wizard.dataset.ready === 'true') return;

    const setup = getCreateTenderSetup();
    const methodSelect = wizard.querySelector('[data-procurement-method]');
    const customCategoryGroup = wizard.querySelector('[data-custom-category-group]');
    const customCategoryInput = wizard.querySelector('[data-custom-category]');
    const customCategoryAddButton = wizard.querySelector('[data-custom-category-add]');
    const categorySearchInput = wizard.querySelector('[data-procurement-category-search]');
    const categoryResults = wizard.querySelector('[data-category-results]');
    const categoryPicker = wizard.querySelector('[data-category-picker]');
    const customCategoryWrap = customCategoryGroup;
    const selectedCategoryList = wizard.querySelector('[data-selected-category-list]');
    const closedTenderPanel = wizard.querySelector('[data-closed-tender-panel]');
    const inviteSearchInput = wizard.querySelector('[data-invite-search]');
    const inviteResults = wizard.querySelector('[data-invite-results]');
    const invitedUserList = wizard.querySelector('[data-invited-user-list]');
    const invitedUserCount = wizard.querySelector('[data-invited-user-count]');
    const methodVisibilityNote = wizard.querySelector('[data-method-visibility-note]');
    const panels = Array.from(wizard.querySelectorAll('.wizard-workspace > .journey-panel'));
    const railSteps = Array.from(wizard.querySelectorAll('[data-wizard-step-index]'));
    const previousButton = wizard.querySelector('[data-wizard-prev]');
    const nextButton = wizard.querySelector('[data-wizard-next]');
    const progressOutput = wizard.querySelector('[data-wizard-progress]');
    const stepTitleOutput = wizard.querySelector('[data-wizard-step-title]');
    let activeStepIndex = 0;
    let pendingRequirementImportControlId = '';
    let pendingProductSpecImportControlId = '';

    const renderOptions = (select, options, selectedValue = '') => {
        if (!select) return;
        select.innerHTML = renderCreateTenderOptions(options, selectedValue);
    };

    const syncCustomCategoryField = () => {
        if (!customCategoryGroup || !customCategoryInput) return;

        const showCustomCategory = customCategoryGroup?.dataset.visible === 'true';
        customCategoryGroup.hidden = !showCustomCategory;
        customCategoryGroup.setAttribute('aria-hidden', showCustomCategory ? 'false' : 'true');
        customCategoryGroup.classList.toggle('visible', showCustomCategory);
        customCategoryInput.disabled = !showCustomCategory;
    };

    const getSelectedProfile = () => {
        const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
        return getCreateTenderTypeProfile(selectedTypeId);
    };

    const getSelectedEvaluationDraft = () => getCreateTenderEvaluationDraft(getSelectedProfile().id);

    const saveSelectedEvaluationDraft = (evaluationDraft) => saveCreateTenderEvaluationDraft(getSelectedProfile().id, evaluationDraft);

    const syncEvaluationStatus = () => {
        const profile = getSelectedProfile();
        const evaluationDraft = getCreateTenderEvaluationDraft(profile.id);
        const summary = getCreateTenderEvaluationSummary(evaluationDraft);
        const statusClass = summary.state === 'balanced' ? 'balanced' : summary.state === 'over' ? 'over' : 'under';
    const badgeClass = summary.state === 'balanced' ? 'badge-success' : summary.state === 'over' ? 'badge-error' : 'badge-warning';
        const panel = wizard.querySelector('[data-evaluation-status-panel]');
        const headerBadge = wizard.querySelector('[data-evaluation-header-badge]');
        const builderBadge = wizard.querySelector('[data-evaluation-status-badge]');
        const totalOutput = wizard.querySelector('[data-evaluation-total]');
        const remainingOutput = wizard.querySelector('[data-evaluation-remaining]');
        const progress = wizard.querySelector('.evaluation-progress-track span');

        if (panel) {
            panel.classList.toggle('balanced', statusClass === 'balanced');
            panel.classList.toggle('under', statusClass === 'under');
            panel.classList.toggle('over', statusClass === 'over');
        }
        [headerBadge, builderBadge].forEach(badge => {
            if (!badge) return;
            badge.textContent = summary.message;
            badge.classList.toggle('badge-success', badgeClass === 'badge-success');
            badge.classList.toggle('badge-warning', badgeClass === 'badge-warning');
            badge.classList.toggle('badge-error', badgeClass === 'badge-error');
        });
        if (totalOutput) totalOutput.textContent = `${summary.total}%`;
        if (remainingOutput) remainingOutput.textContent = summary.message;
        if (progress) progress.style.width = `${Math.min(summary.total, 100)}%`;
        refreshTenderReview();
    };

    const renderEvaluationBuilder = () => {
        const wrap = wizard.querySelector('[data-evaluation-builder-wrap]');
        if (!wrap) return;
        wrap.innerHTML = renderCreateTenderEvaluationBuilder(getSelectedProfile(), getCreateTenderMainDraft());
        syncEvaluationStatus();
    };

    const openEvaluationEditMenu = (criterionId) => {
        const row = wizard.querySelector(`[data-evaluation-criterion="${CSS.escape(criterionId)}"]`);
        const menu = row?.querySelector('[data-evaluation-edit-menu]');
        if (!menu) return;
        menu.hidden = false;
        menu.querySelector('[data-evaluation-field="name"]')?.focus();
    };

    const renderTenderReviewWorkspace = () => {
        const wrap = wizard.querySelector('[data-tender-review-wrap]');
        if (!wrap) return;
        wrap.innerHTML = renderCreateTenderReviewWorkspace(getSelectedProfile(), getCreateTenderMainDraft());
    };

    const renderSystemEvaluationPanel = () => {
        const wrap = wizard.querySelector('[data-system-evaluation-wrap]');
        if (!wrap) return;
        const profile = getSelectedProfile();
        wrap.outerHTML = renderCreateTenderSystemEvaluationPanel(profile, getCreateTenderMainDraft());
        const headerBadge = wizard.querySelector('[data-system-evaluation-header-badge]');
        const savedEvaluation = getCreateTenderSavedSystemEvaluation(profile.id);
        const isCurrent = isCreateTenderSavedSystemEvaluationCurrent(profile);
        if (headerBadge) {
            headerBadge.textContent = isCurrent ? 'Evaluation complete' : 'Evaluation required';
            headerBadge.classList.toggle('badge-success', isCurrent);
            headerBadge.classList.toggle('badge-warning', !isCurrent);
        }
        syncSystemEvaluationSubmitState();
    };

    const syncSystemEvaluationSubmitState = () => {
        const confirmations = Array.from(wizard.querySelectorAll('[data-evaluation-confirmation]'));
        const submitButton = wizard.querySelector('[data-run-system-evaluation]');
        if (!submitButton) return;
        submitButton.disabled = !confirmations.length || confirmations.some(input => !input.checked);
    };

    const getSelectedProcurementType = () => {
        const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
        return setup.types.find(type => type.id === selectedTypeId) || setup.defaultType;
    };

    const setCategoryResultsOpen = (isOpen) => {
        if (!categoryResults) return;
        categoryResults.classList.toggle('open', Boolean(isOpen));
    };

    const getSelectedCategories = () => getCreateTenderWizardCategories(wizard);

    const saveSelectedCategories = (categories = getSelectedCategories()) => {
        const normalizedCategories = normalizeCreateTenderCategories(categories);
        saveCreateTenderMainDraft({
            categories: normalizedCategories,
            category: normalizedCategories.join(', ')
        });
        return normalizedCategories;
    };

    const renderSelectedCategories = (categories = getSelectedCategories()) => {
        const normalizedCategories = normalizeCreateTenderCategories(categories);
        if (selectedCategoryList) {
            selectedCategoryList.innerHTML = renderCreateTenderSelectedCategoryRows(normalizedCategories);
        }
        const summary = normalizedCategories.join(', ');
        const summaryInput = wizard.querySelector('[data-tender-category-summary]');
        if (summaryInput) summaryInput.value = summary;
        return normalizedCategories;
    };

    const setCustomCategoryVisible = (isVisible) => {
        if (!customCategoryGroup || !customCategoryInput) return;
        customCategoryGroup.dataset.visible = isVisible ? 'true' : 'false';
        syncCustomCategoryField();
        if (isVisible) {
            if (customCategoryAddButton) customCategoryAddButton.disabled = !customCategoryInput.value.trim();
            customCategoryInput.focus();
        } else {
            customCategoryInput.value = '';
            if (customCategoryAddButton) customCategoryAddButton.disabled = true;
        }
    };

    const addSelectedCategory = (category) => {
        const normalizedCategory = String(category || '').trim();
        if (!normalizedCategory || isCreateTenderOtherCategory(normalizedCategory)) return;
        const categories = saveSelectedCategories([normalizedCategory]);
        renderSelectedCategories(categories);
        if (categorySearchInput) categorySearchInput.value = '';
        setCategoryResultsOpen(false);
        setCustomCategoryVisible(false);
        refreshTenderReview();
    };

    const removeSelectedCategory = (category) => {
        const categories = saveSelectedCategories(getSelectedCategories().filter(item => item !== category));
        renderSelectedCategories(categories);
        renderCategoryResults(categorySearchInput?.value || '');
        refreshTenderReview();
    };

    const renderCategoryResults = (query = '') => {
        if (!categoryResults) return;
        const selectedType = getSelectedProcurementType();
        const selectedCategoryKeys = new Set(getSelectedCategories().map(category => category.toLowerCase()));
        const terms = String(query || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const matches = selectedType.categories
            .filter(category => !selectedCategoryKeys.has(category.toLowerCase()))
            .filter(category => terms.every(term => category.toLowerCase().includes(term)))
            .slice(0, 12);
        const matchText = matches.length
            ? matches.map(category => `
                <button type="button" class="category-result-option" data-category-option="${escapeCreateTenderHtml(category)}" role="option">
                    ${escapeCreateTenderHtml(category)}
                </button>
            `).join('')
            : '<div class="category-result-empty">No matching listed category</div>';

        categoryResults.innerHTML = `
            ${matchText}
            <button type="button" class="category-result-option other" data-category-other role="option">Other</button>
        `;
        setCategoryResultsOpen(true);
    };

    const selectCategoryOption = (value) => {
        if (isCreateTenderOtherCategory(value)) {
            setCustomCategoryVisible(true);
            setCategoryResultsOpen(false);
            return;
        }
        addSelectedCategory(value);
    };

    const selectOtherCategory = () => {
        setCustomCategoryVisible(true);
        setCategoryResultsOpen(false);
    };

    const getCurrentMethod = () => normalizeCreateTenderMethod(methodSelect?.value);

    const renderInvitedUsers = () => {
        const invitedUsers = getCreateTenderInvitedUsers();
        if (invitedUserList) invitedUserList.innerHTML = renderCreateTenderInvitedUserRows(invitedUsers);
        if (invitedUserCount) invitedUserCount.textContent = String(invitedUsers.length);
        if (methodVisibilityNote) {
            methodVisibilityNote.textContent = getCreateTenderVisibilityNoteForMethod(getCurrentMethod(), invitedUsers.length);
        }
    };

    const renderInviteResults = (query = '') => {
        if (!inviteResults) return;
        const terms = String(query || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const invitedIds = new Set(getCreateTenderInvitedUsers().map(user => user.id));
        const matches = getCreateTenderInvitableUsers()
            .filter(user => !invitedIds.has(user.id))
            .filter(user => {
                const searchable = `${user.name} ${user.organization} ${user.email} ${user.trustTier} ${user.risk}`.toLowerCase();
                return terms.every(term => searchable.includes(term));
            })
            .slice(0, 8);

        inviteResults.innerHTML = matches.length
            ? matches.map(user => `
                <button type="button" class="invite-result-option" data-invite-user="${escapeCreateTenderHtml(user.id)}" role="option">
                    <strong>${escapeCreateTenderHtml(user.name)}</strong>
                    <span>${escapeCreateTenderHtml(user.organization || 'Supplier')}</span>
                </button>
            `).join('')
            : '<div class="invite-result-empty">No matching supplier users</div>';
        inviteResults.classList.toggle('open', true);
    };

    const setInviteResultsOpen = (isOpen) => {
        inviteResults?.classList.toggle('open', Boolean(isOpen));
    };

    const addInvitedUser = (userId) => {
        const user = getCreateTenderInvitableUsers().find(item => item.id === userId);
        if (!user) return;
        const invitedUsers = getCreateTenderInvitedUsers();
        if (!invitedUsers.some(item => item.id === user.id)) {
            saveCreateTenderInvitedUsers([...invitedUsers, user]);
        }
        if (inviteSearchInput) inviteSearchInput.value = '';
        renderInvitedUsers();
        renderInviteResults('');
        saveMainDetailsFromInputs();
        refreshTenderReview();
    };

    const removeInvitedUser = (userId) => {
        saveCreateTenderInvitedUsers(getCreateTenderInvitedUsers().filter(user => user.id !== userId));
        renderInvitedUsers();
        renderInviteResults(inviteSearchInput?.value || '');
        saveMainDetailsFromInputs();
        refreshTenderReview();
    };

    const syncTenderMethod = () => {
        const method = getCurrentMethod();
        const invitedCount = getCreateTenderInvitedUsers().length;
        const closed = isCreateTenderClosedMethod(method);
        if (closedTenderPanel) {
            closedTenderPanel.hidden = !closed;
            closedTenderPanel.setAttribute('aria-hidden', closed ? 'false' : 'true');
        }
        if (methodVisibilityNote) {
            methodVisibilityNote.textContent = getCreateTenderVisibilityNoteForMethod(method, invitedCount);
        }
        renderInvitedUsers();
    };

    const refreshProfileText = () => {
        const profile = getSelectedProfile();
        const requirementSummary = getCreateTenderRequirementSummary(profile, getCreateTenderMainDraft());
        const updateText = (selector, value) => {
            const node = wizard.querySelector(selector);
            if (node) node.textContent = value;
        };
        updateText('[data-profile-requirement-title]', 'Tender Requirements');
        updateText('[data-requirement-type-badge]', requirementSummary.title);
        updateText('[data-profile-attachment-hint]', profile.attachmentHint);
        updateText('[data-commercial-title]', profile.commercialTitle);
        updateText('[data-commercial-count-label]', `${profile.commercialItemName}s`);
        updateText('[data-review-commercial-label]', profile.reviewLabel);
        updateText('[data-review-confirmation]', `Review requirements, licenses, ${profile.commercialName}, timeline, evaluation, and visibility before publishing.`);
        const requirementSections = wizard.querySelector('[data-requirement-sections]');
        const postLicenseSectionIds = getCreateTenderPostLicenseRequirementSectionIds(profile);
        if (requirementSections) {
            requirementSections.innerHTML = renderCreateTenderRequirementSections(profile, getCreateTenderMainDraft(), {
                excludeSectionIds: postLicenseSectionIds
            });
        }
        const postLicenseRequirementSections = wizard.querySelector('[data-post-license-requirement-sections]');
        if (postLicenseRequirementSections) {
            postLicenseRequirementSections.innerHTML = renderCreateTenderRequirementSections(profile, getCreateTenderMainDraft(), {
                includeSectionIds: postLicenseSectionIds,
                showHeader: false
            });
        }
        const licensePanelSlot = wizard.querySelector('[data-license-panel-slot]');
        if (licensePanelSlot) {
            licensePanelSlot.innerHTML = profile.id === 'consultancy'
                ? ''
                : renderCreateTenderRegulatoryLicensePanel(profile, { standalone: true });
        }

        const evaluationRail = railSteps[3]?.querySelector('span');
        if (evaluationRail) evaluationRail.textContent = 'Evaluation Criteria and Weights';
        renderEvaluationBuilder();
        renderTenderReviewWorkspace();
        const commercialHead = wizard.querySelector('[data-boq-editor] thead');
        if (commercialHead) commercialHead.innerHTML = renderCreateTenderCommercialTableHead(profile);
        const importButton = wizard.querySelector('[data-boq-import]');
        if (importButton) importButton.textContent = profile.importLabel;
        const addButton = wizard.querySelector('[data-boq-add]');
        if (addButton) addButton.textContent = profile.addLabel;
        if (stepTitleOutput) stepTitleOutput.textContent = railSteps[activeStepIndex]?.querySelector('span')?.textContent || '';
    };

    const syncProcurementTypeCards = (typeId) => {
        const selectedType = setup.types.find(type => type.id === typeId) || setup.defaultType;
        wizard.querySelectorAll('[data-procurement-type-card]').forEach(card => {
            const input = card.querySelector('input[name="procurementType"]');
            card.classList.toggle('selected', input?.value === selectedType.id);
        });
    };

    const syncProcurementType = (typeId, options = {}) => {
        const selectedType = setup.types.find(type => type.id === typeId) || setup.defaultType;
        syncProcurementTypeCards(selectedType.id);
        if (options.resetPostSelection) {
            resetCreateTenderPostSelectionData(selectedType.id);
            if (methodSelect) methodSelect.value = createTenderOpenMethod;
        }
        renderOptions(methodSelect, setup.methods, getCurrentMethod());
        renderSelectedCategories([]);
        if (customCategoryInput) customCategoryInput.value = '';
        setCustomCategoryVisible(false);
        syncCustomCategoryField();
        saveCreateTenderMainDraft({
            procurementTypeId: selectedType.id,
            category: '',
            categories: []
        });
        renderBoqTable();
        renderScopeList('deliverables');
        renderScopeList('attachments');
        refreshProfileText();
        renderLicenseList();
        syncTenderMethod();
    };

    const syncFundingSourceCustomField = () => {
        const sourceSelect = wizard.querySelector('[data-tender-funding-source-select]');
        const customInput = wizard.querySelector('[data-tender-funding-source-custom]');
        if (!sourceSelect || !customInput) return;

        const isCustom = sourceSelect.value === 'Other';
        customInput.hidden = !isCustom;
        if (!isCustom) customInput.value = '';
    };

    const getFundingSourceFromInputs = () => {
        return getCreateTenderWizardFundingSource(wizard);
    };

    const saveMainDetailsFromInputs = () => {
        const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
        const selectedType = setup.types.find(type => type.id === selectedTypeId) || setup.defaultType;
        const currentDraft = getCreateTenderMainDraft();
        saveCreateTenderMainDraft({
            title: wizard.querySelector('[data-tender-title]')?.value.trim() || defaultCreateTenderMainDraft.title,
            scope: currentDraft.scope || defaultCreateTenderMainDraft.scope,
            procurementTypeId: selectedType.id,
            method: normalizeCreateTenderMethod(methodSelect?.value),
            fundingSource: getFundingSourceFromInputs(),
            category: getCreateTenderWizardCategoryValue(wizard, ''),
            categories: getSelectedCategories(),
            visibility: getCreateTenderVisibilityForMethod(methodSelect?.value),
            visibilityNote: getCreateTenderVisibilityNoteForMethod(methodSelect?.value, getCreateTenderInvitedUsers().length),
            invitedUsers: getCreateTenderInvitedUsers()
        });
    };

    const refreshContactSummary = () => {
        const contact = getCreateTenderContactDetails();
        const summary = getCreateTenderContactSummary(contact);
        const badge = wizard.querySelector('[data-contact-status-badge]');
        const phoneStatus = wizard.querySelector('[data-contact-status="phone"]');
        const emailStatus = wizard.querySelector('[data-contact-status="email"]');
        const verifiedCount = wizard.querySelector('[data-contact-verified-count]');

        if (badge) {
            badge.textContent = summary.complete ? 'Contact verified' : 'Verify contact';
            badge.classList.toggle('badge-success', summary.complete);
            badge.classList.toggle('badge-warning', !summary.complete);
        }
        if (phoneStatus) {
            phoneStatus.textContent = contact.phoneVerified && summary.phoneValid
                ? 'Phone verified'
                : summary.phoneValid
                    ? 'Phone ready to verify'
                    : 'Enter a valid phone number';
        }
        if (emailStatus) {
            emailStatus.textContent = contact.emailVerified && summary.emailValid
                ? 'Email verified'
                : summary.emailValid
                    ? 'Email ready to verify'
                    : 'Enter a valid email address';
        }
        if (verifiedCount) verifiedCount.textContent = String(summary.verifiedCount);
    };

    const updateContactField = (input) => {
        const field = input.dataset.contactField;
        if (!field) return;

        const contact = getCreateTenderContactDetails();
        contact[field] = input.value;
        if (field === 'phone') contact.phoneVerified = false;
        if (field === 'email') contact.emailVerified = false;
        saveCreateTenderContactDetails(contact);
        refreshContactSummary();
    };

    const verifyContactChannel = (channel) => {
        const contact = getCreateTenderContactDetails();
        if (channel === 'phone') {
            contact.phoneVerified = isCreateTenderValidPhone(contact.phone);
        }
        if (channel === 'email') {
            contact.emailVerified = isCreateTenderValidEmail(contact.email);
        }
        saveCreateTenderContactDetails(contact);
        refreshContactSummary();
    };

    const refreshBoqSummary = () => {
        const profile = getSelectedProfile();
        const items = getCreateTenderBoqItems(profile);
        const total = getCreateTenderBoqTotal(items);
        const average = items.length ? total / items.length : 0;
        const itemCount = wizard.querySelector('[data-boq-item-count]');
        const totalOutput = wizard.querySelector('[data-boq-total]');
        const averageOutput = wizard.querySelector('[data-boq-average]');
        const estimateBadge = wizard.querySelector('[data-boq-estimate-badge]');

        if (itemCount) itemCount.textContent = String(items.length);
        if (totalOutput) totalOutput.textContent = formatCreateTenderMoney(total);
        if (averageOutput) averageOutput.textContent = formatCreateTenderMoney(average);
        if (estimateBadge) estimateBadge.textContent = formatCreateTenderCompactMoney(total);
    };

    const renderBoqTable = () => {
        const body = wizard.querySelector('[data-boq-table-body]');
        if (!body) return;
        const profile = getSelectedProfile();
        body.innerHTML = renderCreateTenderBoqRows(getCreateTenderBoqItems(profile), profile);
        refreshProfileText();
        refreshBoqSummary();
    };

    const refreshMilestoneSummary = () => {
        const milestones = getCreateTenderMilestones();
        const summary = getCreateTenderMilestoneSummary(milestones);
        const badge = wizard.querySelector('[data-milestone-badge]');
        const count = wizard.querySelector('[data-milestone-count]');
        const start = wizard.querySelector('[data-milestone-start]');
        const end = wizard.querySelector('[data-milestone-end]');
        const windowOutput = wizard.querySelector('[data-milestone-window]');

        if (badge) badge.textContent = summary.datedCount < summary.count ? 'Dates pending' : `${summary.count} milestones`;
        if (count) count.textContent = String(summary.count);
        if (start) start.textContent = formatCreateTenderDate(summary.start);
        if (end) end.textContent = formatCreateTenderDate(summary.end);
        if (windowOutput) windowOutput.textContent = summary.days ? `${summary.days} days` : 'Set dates';
    };

    const getScopeItemsByType = (type) => (
        type === 'attachments' ? getCreateTenderRequiredAttachments(getSelectedProfile()) : getCreateTenderDeliverables(getSelectedProfile())
    );

    const saveScopeItemsByType = (type, items) => {
        if (type === 'attachments') {
            saveCreateTenderRequiredAttachments(items, getSelectedProfile());
            return;
        }
        saveCreateTenderDeliverables(items, getSelectedProfile());
    };

    const refreshLicenseSummary = () => {
        const count = wizard.querySelector('[data-license-count]');
        if (count) count.textContent = String(getCreateTenderRegulatoryLicenses(getSelectedProfile()).length);
    };

    const renderLicenseList = () => {
        const list = wizard.querySelector('[data-license-list]');
        if (!list) return;
        list.innerHTML = renderCreateTenderRegulatoryLicenseRows(getCreateTenderRegulatoryLicenses(getSelectedProfile()));
        refreshLicenseSummary();
    };

    const setLicenseResultsOpen = (row, isOpen) => {
        row?.querySelector('[data-license-results]')?.classList.toggle('open', Boolean(isOpen));
    };

    const setLicensePickerOpen = (row, isOpen) => {
        const picker = row?.querySelector('[data-license-picker]');
        if (!picker) return;
        picker.hidden = !isOpen;
        picker.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        setLicenseResultsOpen(row, isOpen);
    };

    const setLicenseAddPickerOpen = (isOpen) => {
        const picker = wizard.querySelector('[data-license-add-picker]');
        if (!picker) return;
        picker.hidden = !isOpen;
        picker.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        picker.querySelector('[data-license-add-results]')?.classList.toggle('open', Boolean(isOpen));
    };

    const renderLicenseResultsInto = (results, query = '', optionAttribute = 'data-license-option') => {
        if (!results) return;

        const terms = String(query || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const matches = createTenderRegulatoryLicenseCatalog
            .filter(item => {
                const searchable = `${item.group} ${item.license} ${item.body}`.toLowerCase();
                return terms.every(term => searchable.includes(term));
            });

        results.innerHTML = matches.length
            ? matches.map(item => `
                <button type="button" class="license-result-option" ${optionAttribute}="${escapeCreateTenderHtml(item.license)}" role="option">
                    <strong>${escapeCreateTenderHtml(item.license)}</strong>
                    <span>${escapeCreateTenderHtml(item.body)}</span>
                </button>
            `).join('')
            : '<div class="license-result-empty">No matching license</div>';
        results.classList.toggle('open', true);
    };

    const renderLicenseResults = (row, query = '') => {
        const results = row?.querySelector('[data-license-results]');
        renderLicenseResultsInto(results, query);
        setLicenseResultsOpen(row, true);
    };

    const renderLicenseAddResults = (query = '') => {
        renderLicenseResultsInto(wizard.querySelector('[data-license-add-results]'), query, 'data-license-add-option');
    };

    const selectLicenseRequirement = (row, licenseName) => {
        if (!row) return;
        const catalogItem = getCreateTenderRegulatoryLicenseByName(licenseName);
        const profile = getSelectedProfile();
        const items = getCreateTenderRegulatoryLicenses(profile);
        const item = items.find(entry => entry.id === row.dataset.licenseRow);
        if (!item) return;

        item.license = catalogItem.license;
        item.body = catalogItem.body;

        saveCreateTenderRegulatoryLicenses(items, profile);
        renderLicenseList();
        setLicensePickerOpen(row, false);
        refreshLicenseSummary();
        refreshTenderReview();
    };

    const addLicenseRequirement = (licenseName) => {
        const catalogItem = getCreateTenderRegulatoryLicenseByName(licenseName);
        const profile = getSelectedProfile();
        const items = getCreateTenderRegulatoryLicenses(profile);
        if (items.some(item => item.license === catalogItem.license)) {
            setLicenseAddPickerOpen(false);
            return;
        }

        items.push(normalizeCreateTenderRegulatoryLicense({
            id: `license-${Date.now()}`,
            license: catalogItem.license,
            body: catalogItem.body,
            mandatory: true,
            expiryRequired: true
        }, items.length));
        saveCreateTenderRegulatoryLicenses(items, profile);
        renderLicenseList();
        refreshScopeSummary();
        refreshTenderReview();
        setLicenseAddPickerOpen(false);
    };

    const refreshScopeSummary = () => {
        const deliverableCount = wizard.querySelector('[data-scope-count="deliverables"]');
        const attachmentCount = wizard.querySelector('[data-scope-count="attachments"]');

        if (deliverableCount) deliverableCount.textContent = String(getCreateTenderDeliverables(getSelectedProfile()).length);
        if (attachmentCount) attachmentCount.textContent = String(getCreateTenderRequiredAttachments(getSelectedProfile()).length);
        refreshLicenseSummary();
    };

    const renderScopeList = (type) => {
        const list = wizard.querySelector(`[data-scope-list="${type}"]`);
        if (!list) return;
        const items = getScopeItemsByType(type);
        const emptyText = type === 'attachments' ? 'No required attachments added yet.' : 'No deliverables added yet.';
        list.innerHTML = renderCreateTenderScopeRows(items, type, emptyText);
        refreshScopeSummary();
    };

    const setReviewText = (selector, value) => {
        const output = wizard.querySelector(selector);
        if (!output) return;
        if ('value' in output) {
            output.value = value;
            return;
        }
        output.textContent = value;
    };

    const refreshTenderReview = () => {
        const title = wizard.querySelector('[data-tender-title]')?.value.trim() || 'Untitled tender';
        const contact = getCreateTenderContactDetails();
        const contactSummary = getCreateTenderContactSummary(contact);
        const selectedTypeId = wizard.querySelector('input[name="procurementType"]:checked')?.value || setup.defaultType.id;
        const selectedType = setup.types.find(type => type.id === selectedTypeId) || setup.defaultType;
        const selectedCategory = getCreateTenderWizardCategoryValue(wizard, '');
        const profile = getCreateTenderTypeProfile(selectedType);
        const licenses = getCreateTenderRegulatoryLicenses(profile);
        const requirementSummary = getCreateTenderRequirementSummary(profile, getCreateTenderMainDraft());
        const requirementPreview = requirementSummary.filledControls
            ? `${requirementSummary.filledControls} of ${requirementSummary.totalControls} requirement fields started`
            : 'Requirements not started';
        const boqItems = getCreateTenderBoqItems(profile);
        const boqTotal = getCreateTenderBoqTotal(boqItems);
        const method = normalizeCreateTenderMethod(methodSelect?.value);
        const invitedUsers = getCreateTenderInvitedUsers();
        const milestoneSummary = getCreateTenderMilestoneSummary(getCreateTenderMilestones());
        const evaluationDraft = getCreateTenderEvaluationDraft(profile.id);
        const evaluationSummary = getCreateTenderEvaluationSummary(evaluationDraft);
        const readiness = title !== 'Untitled tender'
            && contactSummary.complete
            && boqItems.length
            && milestoneSummary.datedCount === milestoneSummary.count
            && evaluationSummary.isBalanced
            && (!isCreateTenderClosedMethod(method) || invitedUsers.length);
        const reviewBadge = wizard.querySelector('[data-review-readiness]');

        setReviewText('[data-review-title]', title);
        setReviewText('[data-review-scope]', requirementPreview);
        setReviewText('[data-review-contact]', contact.tenderLocation || 'Location not set');
        setReviewText('[data-review-contact-status]', contact.contactName || 'Contact not set');
        setReviewText('[data-review-procurement]', `${selectedType.label} - ${method || 'Method not set'}`);
        setReviewText('[data-review-category]', selectedCategory || 'Category not set');
        setReviewText('[data-tender-category-summary]', selectedCategory || 'Category not set');
        setReviewText('[data-review-visibility]', getCreateTenderVisibilityForMethod(method));
        setReviewText('[data-review-visibility-note]', getCreateTenderVisibilityNoteForMethod(method, invitedUsers.length));
        setReviewText('[data-publish-visibility]', getCreateTenderVisibilityForMethod(method));
        setReviewText('[data-publish-visibility-note]', getCreateTenderVisibilityNoteForMethod(method, invitedUsers.length));
        setReviewText('[data-review-scope-count]', `${requirementSummary.filledControls + licenses.length} items`);
        setReviewText('[data-review-scope-breakdown]', `${requirementSummary.filledControls} requirement fields, ${licenses.length} licenses`);
        setReviewText('[data-review-commercial-label]', profile.reviewLabel);
        setReviewText('[data-review-boq-total]', formatCreateTenderMoney(boqTotal));
        setReviewText('[data-review-boq-count]', `${boqItems.length} ${profile.commercialItemName}${boqItems.length === 1 ? '' : 's'}`);
        setReviewText(
            '[data-review-timeline]',
            milestoneSummary.start && milestoneSummary.end
                ? `${formatCreateTenderDate(milestoneSummary.start)} to ${formatCreateTenderDate(milestoneSummary.end)}`
                : 'Milestone dates pending'
        );
        setReviewText('[data-review-window]', milestoneSummary.days ? `${milestoneSummary.days} days` : 'Set milestone dates');
        setReviewText('[data-review-evaluation]', `${evaluationSummary.total}% ${evaluationSummary.isBalanced ? 'balanced' : 'configured'}`);
        setReviewText('[data-review-evaluation-count]', `${evaluationDraft.criteria.length} weighted criteria`);

        if (reviewBadge) {
            reviewBadge.textContent = readiness ? 'Ready to publish' : 'Review gaps';
            reviewBadge.classList.toggle('badge-success', Boolean(readiness));
            reviewBadge.classList.toggle('badge-info', !readiness);
        }
    };

    const refreshRequirementHelper = (controlId) => {
        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        const helper = wizard.querySelector(`[data-requirement-helper="${CSS.escape(controlId)}"]`);
        if (!control || !helper) return;
        helper.textContent = getCreateTenderRequirementHelperText(control, getRequirementControlValue(controlId));
    };

    const refreshRequirementCounter = (controlId) => {
        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        const counter = wizard.querySelector(`[data-requirement-counter="${CSS.escape(controlId)}"]`);
        if (!control?.maxLength || !counter) return;
        counter.textContent = `${String(getRequirementControlValue(controlId) || '').length}/${control.maxLength}`;
    };

    const validateActiveStep = () => {
        const activePanel = panels[activeStepIndex];
        if (!activePanel) return true;

        const requiredFields = Array.from(activePanel.querySelectorAll('[required]'))
            .filter(field => !field.disabled && field.offsetParent !== null);
        const firstInvalidField = requiredFields.find(field => !field.checkValidity());

        requiredFields.forEach(field => field.classList.toggle('error', !field.checkValidity()));
        if (!firstInvalidField) return true;

        firstInvalidField.reportValidity();
        firstInvalidField.focus();
        return false;
    };

    const validateRequirementsBeforeLeavingStep = () => {
        const missingRequiredControls = getCreateTenderMissingRequiredRequirements(getSelectedProfile(), getCreateTenderMainDraft());
        if (!missingRequiredControls.length) return true;

        const firstMissingControl = missingRequiredControls[0];
        if (activeStepIndex !== 2) {
            setActiveStep(2);
        }

        const field = wizard.querySelector(`[data-requirement-input="${CSS.escape(firstMissingControl.id)}"]`);
        field?.classList.add('error');
        const invalidField = field?.matches?.('[required]') && !field.checkValidity()
            ? field
            : field?.querySelector?.('[required]:invalid');
        invalidField?.reportValidity?.();
        (invalidField || field)?.focus?.();
        return false;
    };

    const validateEvaluationBeforeLeavingStep = () => {
        const evaluationDraft = getSelectedEvaluationDraft();
        const summary = getCreateTenderEvaluationSummary(evaluationDraft);
        if (summary.isBalanced) return true;

        if (activeStepIndex !== 3) {
            setActiveStep(3);
        }
        syncEvaluationStatus();
        const firstWeight = Array.from(wizard.querySelectorAll('[data-evaluation-field="weight"]'))
            .find(input => parseCreateTenderNumber(input.value) <= 0)
            || wizard.querySelector('[data-evaluation-field="weight"]');
        firstWeight?.classList.add('error');
        firstWeight?.focus();
        alert(`Evaluation weights must total 100% before continuing. ${summary.message}.`);
        return false;
    };

    const setActiveStep = (index) => {
        const boundedIndex = Math.min(Math.max(index, 0), panels.length - 1);
        activeStepIndex = boundedIndex;

        panels.forEach((panel, panelIndex) => {
            const isActive = panelIndex === activeStepIndex;
            panel.classList.toggle('active', isActive);
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });

        railSteps.forEach((step) => {
            const stepIndex = Number(step.dataset.wizardStepIndex);
            const isActive = stepIndex === activeStepIndex;
            step.classList.toggle('active', isActive);
            step.classList.toggle('completed', stepIndex < activeStepIndex);
            step.setAttribute('aria-current', isActive ? 'step' : 'false');
        });
        wizard.style.setProperty('--wizard-progress-ratio', panels.length > 1 ? String(activeStepIndex / (panels.length - 1)) : '1');

        if (previousButton) previousButton.disabled = activeStepIndex === 0;
        if (nextButton) nextButton.hidden = activeStepIndex === panels.length - 1;
        if (progressOutput) progressOutput.textContent = `Step ${activeStepIndex + 1} of ${panels.length}`;
        if (stepTitleOutput) stepTitleOutput.textContent = railSteps.find(step => Number(step.dataset.wizardStepIndex) === activeStepIndex)?.querySelector('span')?.textContent || '';

        if (activeStepIndex === 3) syncEvaluationStatus();
        if (activeStepIndex === 4) renderTenderReviewWorkspace();
        if (activeStepIndex === panels.length - 1) {
            renderSystemEvaluationPanel();
            refreshTenderReview();
        }
    };

    const nextBoqItemCode = (items) => {
        const lastMajor = items.reduce((largest, item) => {
            const major = Number(String(item.item || '').split('.')[0]);
            return Number.isFinite(major) ? Math.max(largest, major) : largest;
        }, 0);
        return `${lastMajor + 1}.1`;
    };

    const updateBoqRow = (input) => {
        const row = input.closest('[data-boq-row]');
        const field = input.dataset.boqField;
        if (!row || !field) return;

        const profile = getSelectedProfile();
        const items = getCreateTenderBoqItems(profile);
        const item = items.find(entry => entry.id === row.dataset.boqRow);
        if (!item) return;

        item[field] = ['qty', 'rate'].includes(field) ? parseCreateTenderNumber(input.value) : input.value;
        saveCreateTenderBoqItems(items, profile);

        const rowAmount = parseCreateTenderNumber(item.qty) * parseCreateTenderNumber(item.rate);
        const amountCell = row.querySelector('[data-boq-amount]');
        if (amountCell) amountCell.textContent = formatCreateTenderMoney(rowAmount);
        refreshBoqSummary();
    };

    const updateMilestoneRow = (input) => {
        const row = input.closest('[data-milestone-row]');
        const proxyId = input.dataset.milestoneRowProxy;
        const field = input.dataset.milestoneField;
        if ((!row && !proxyId) || field !== 'date') return;

        const milestones = getCreateTenderMilestones();
        const milestone = milestones.find(entry => entry.id === (row?.dataset.milestoneRow || proxyId));
        if (!milestone) return;

        milestone.date = input.value;
        saveCreateTenderMilestones(milestones);
        refreshMilestoneSummary();
    };

    const updateScopeItem = (input) => {
        const row = input.closest('[data-scope-row]');
        const type = row?.dataset.scopeType;
        if (!row || !type) return;

        const items = getScopeItemsByType(type);
        const item = items.find(entry => entry.id === row.dataset.scopeRow);
        if (!item) return;

        item.text = input.value;
        saveScopeItemsByType(type, items);
        refreshScopeSummary();
    };

    const updateEvaluationField = (input) => {
        const row = input.closest('[data-evaluation-criterion]');
        const field = input.dataset.evaluationField;
        if (!row || !field) return;

        const evaluationDraft = getSelectedEvaluationDraft();
        const criterion = evaluationDraft.criteria.find(item => item.id === row.dataset.evaluationCriterion);
        if (!criterion) return;

        if (field === 'weight') {
            const shouldKeepBlank = input.value === '';
            const clampedWeight = clampCreateTenderEvaluationWeight(input.value);
            criterion.weight = clampedWeight;
            if (!shouldKeepBlank && String(clampedWeight) !== input.value) input.value = clampedWeight;
            input.classList.toggle('error', shouldKeepBlank || clampedWeight <= 0 || clampedWeight > 100);
            const nextDraft = evaluationDraft.mode === 'auto'
                ? autoBalanceCreateTenderEvaluationWeights(evaluationDraft, criterion.id)
                : evaluationDraft;
            saveSelectedEvaluationDraft(nextDraft);
            if (evaluationDraft.mode === 'auto') {
                renderEvaluationBuilder();
                return;
            }
            syncEvaluationStatus();
            return;
        }

        if (field !== 'weight') {
            criterion[field] = input.value;
        }
        saveSelectedEvaluationDraft(evaluationDraft);
        syncEvaluationStatus();
    };

    const updateEvaluationMode = (select) => {
        const evaluationDraft = getSelectedEvaluationDraft();
        evaluationDraft.mode = ['manual', 'auto'].includes(select.value) ? select.value : 'manual';
        const nextDraft = evaluationDraft.mode === 'auto' ? balanceCreateTenderEvaluationWeights(evaluationDraft) : evaluationDraft;
        saveSelectedEvaluationDraft(nextDraft);
        renderEvaluationBuilder();
    };

    const getRequirementListItems = (listId) => {
        const profile = getSelectedProfile();
        const requirementDraft = getCreateTenderRequirementDraft(profile.id);
        return Array.isArray(requirementDraft.lists?.[listId])
            ? requirementDraft.lists[listId].map(normalizeCreateTenderRequirementItem)
            : [];
    };

    const saveRequirementListItems = (listId, items) => {
        const profile = getSelectedProfile();
        const requirementDraft = getCreateTenderRequirementDraft(profile.id);
        requirementDraft.lists = {
            ...(requirementDraft.lists || {}),
            [listId]: items.map(normalizeCreateTenderRequirementItem)
        };
        saveCreateTenderRequirementDraft(profile.id, requirementDraft);
        return requirementDraft.lists[listId];
    };

    const renderRequirementList = (listId) => {
        const profile = getSelectedProfile();
        const template = getCreateTenderRequirementTemplate(profile.id);
        const listTemplate = (template.lists || []).find(item => item.id === listId);
        const items = getRequirementListItems(listId);
        const listNode = wizard.querySelector(`[data-requirement-list-items="${CSS.escape(listId)}"]`);
        const countNode = wizard.querySelector(`[data-requirement-list-count="${CSS.escape(listId)}"]`);
        if (listNode) {
            listNode.innerHTML = renderCreateTenderRequirementListRows(items, listId)
                .replace('No requirements added yet.', escapeCreateTenderHtml(listTemplate?.emptyText || 'No requirements added yet.'));
        }
        if (countNode) countNode.textContent = String(items.length);
    };

    const updateRequirementField = (input) => {
        const field = input.dataset.requirementField;
        if (!field) return;
        const profile = getSelectedProfile();
        const requirementDraft = getCreateTenderRequirementDraft(profile.id);
        requirementDraft.fields = {
            ...(requirementDraft.fields || {}),
            [field]: input.value
        };
        saveCreateTenderRequirementDraft(profile.id, requirementDraft);
    };

    const updateRequirementListItem = (input) => {
        const row = input.closest('[data-requirement-row]');
        const listId = row?.dataset.requirementList;
        if (!row || !listId) return;
        const items = getRequirementListItems(listId);
        const item = items.find(entry => entry.id === row.dataset.requirementRow);
        if (!item) return;
        item.text = input.value;
        saveRequirementListItems(listId, items);
        renderRequirementList(listId);
    };

    const getRequirementControlValue = (controlId) => {
        const profile = getSelectedProfile();
        const requirementDraft = getCreateTenderRequirementDraft(profile.id);
        return requirementDraft.fields?.[controlId];
    };

    const saveRequirementControlValue = (controlId, value) => {
        const profile = getSelectedProfile();
        const requirementDraft = getCreateTenderRequirementDraft(profile.id);
        requirementDraft.fields = {
            ...(requirementDraft.fields || {}),
            [controlId]: value
        };
        saveCreateTenderRequirementDraft(profile.id, requirementDraft);
    };

    const getProductSpecTemplateValue = (controlId = 'productSpecificationTemplate') => (
        normalizeCreateTenderProductSpecTemplate(getRequirementControlValue(controlId), getRequirementControlValue('quantityScheduleRows') || [])
    );

    const saveProductSpecTemplateValue = (controlId, template) => {
        saveRequirementControlValue(controlId, normalizeCreateTenderProductSpecTemplate(template, getRequirementControlValue('quantityScheduleRows') || []));
    };

    const downloadProductSpecTemplateCsv = (controlId = 'productSpecificationTemplate') => {
        const template = getProductSpecTemplateValue(controlId);
        const csvRows = [
            template.columns.map(column => column.label),
            ...template.rows.map(row => template.columns.map(column => row.values?.[column.id] || ''))
        ];
        const csv = `\uFEFF${csvRows.map(row => row.map(formatCreateTenderCsvCell).join(',')).join('\r\n')}\r\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = 'product-specification-template.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const parseProductSpecTemplateCsv = (text) => {
        const rows = parseDelimitedRows(text);
        if (!rows.length) return null;
        const headerCells = rows[0].map(cell => String(cell || '').trim()).filter(Boolean);
        if (headerCells.length < 3) return null;
        const normalizeHeaderId = (label, index) => {
            const lower = label.toLowerCase();
            if (/^item\s*(no|number|#)?\.?$/i.test(label)) return 'itemNo';
            if (/product\s*name|description/i.test(lower)) return 'productName';
            if (/quantity|qty/i.test(lower)) return 'quantity';
            if (/specification\s*name|^specification$/i.test(label)) return 'specificationName';
            if (/specific\s*detail|acceptable|required\s*(requirement|value)|buyer\s*requirement|instruction|guidance|note/i.test(lower)) return 'acceptableRequirement';
            return slugCreateTenderProductSpecColumnId(label) || `column-${index + 1}`;
        };
        const columns = headerCells.map((label, index) => ({ id: normalizeHeaderId(label, index), label }));
        const dataRows = rows.slice(1).filter(cells => cells.some(cell => String(cell || '').trim()));
        if (!dataRows.length) return null;
        const importedRows = dataRows.map((cells, rowIndex) => ({
            id: `product-spec-import-${Date.now()}-${rowIndex}`,
            values: Object.fromEntries(columns.map((column, columnIndex) => [column.id, cells[columnIndex] || '']))
        }));
        const quantityRows = getRequirementControlValue('quantityScheduleRows') || [];
        return normalizeCreateTenderProductSpecTemplate({
            allowSupplierComments: true,
            columns,
            rows: importedRows
        }, Array.isArray(quantityRows) ? quantityRows : []);
    };

    const updateProductSpecColumnField = (input) => {
        const card = input.closest('[data-product-spec-column]');
        const controlId = card?.dataset.productSpecControl;
        const columnId = card?.dataset.productSpecColumn;
        if (!controlId || !columnId) return;
        const template = getProductSpecTemplateValue(controlId);
        const column = template.columns.find(item => item.id === columnId);
        if (!column || column.locked) return;
        if (input.matches('[data-product-spec-column-label]')) {
            column.label = input.value.trim() || column.label;
        } else if (input.matches('[data-product-spec-column-required]')) {
            column.required = input.checked;
        } else if (input.matches('[data-product-spec-column-instructions]')) {
            column.instructions = input.value;
        }
        saveProductSpecTemplateValue(controlId, template);
    };

    const updateProductSpecCell = (input) => {
        const row = input.closest('[data-product-spec-row]');
        const controlId = row?.dataset.productSpecControl;
        const rowId = row?.dataset.productSpecRow;
        const columnId = input.dataset.productSpecCell;
        if (!controlId || !rowId || !columnId) return;
        const template = getProductSpecTemplateValue(controlId);
        const templateRow = template.rows.find(item => item.id === rowId);
        if (!templateRow) return;
        const column = template.columns.find(item => item.id === columnId);
        if (column?.locked) return;
        templateRow.values = {
            ...(templateRow.values || {}),
            [columnId]: input.value
        };
        saveProductSpecTemplateValue(controlId, template);
    };

    const openProductSpecModal = (controlId = 'productSpecificationTemplate', sourceRowId = '') => {
        const modal = wizard.querySelector(`[data-product-spec-modal="${CSS.escape(controlId)}"]`);
        const quantityRows = getRequirementControlValue('quantityScheduleRows') || [];
        const sourceMap = getCreateTenderProductSpecSourceMap(Array.isArray(quantityRows) ? quantityRows : []);
        const source = sourceMap.get(sourceRowId);
        if (!modal || !source) return;

        modal.dataset.productSpecControl = controlId;
        modal.dataset.productSpecSource = source.sourceRowId;
        modal.querySelector('[data-product-spec-modal-item]').textContent = `${source.values.itemNo}. ${source.values.productName}`;
        modal.querySelector('[data-product-spec-modal-name]').value = '';
        modal.querySelector('[data-product-spec-modal-detail]').value = '';
        modal.querySelector('[data-product-spec-modal-error]')?.setAttribute('hidden', '');
        modal.querySelectorAll('.error').forEach(input => input.classList.remove('error'));
        modal.hidden = false;
        modal.querySelector('[data-product-spec-modal-name]')?.focus();
    };

    const closeProductSpecModal = (modal) => {
        if (!modal) return;
        modal.hidden = true;
        delete modal.dataset.productSpecControl;
        delete modal.dataset.productSpecSource;
    };

    const saveProductSpecModal = (modal) => {
        const controlId = modal?.dataset.productSpecControl || 'productSpecificationTemplate';
        const sourceRowId = modal?.dataset.productSpecSource || '';
        const nameInput = modal?.querySelector('[data-product-spec-modal-name]');
        const detailInput = modal?.querySelector('[data-product-spec-modal-detail]');
        const specificationName = nameInput?.value.trim() || '';
        const acceptableRequirement = detailInput?.value.trim() || '';
        const errorNode = modal?.querySelector('[data-product-spec-modal-error]');
        const isValid = Boolean(specificationName);

        nameInput?.classList.toggle('error', !specificationName);
        if (errorNode) errorNode.hidden = isValid;
        if (!isValid) {
            nameInput?.focus();
            return;
        }

        const quantityRows = getRequirementControlValue('quantityScheduleRows') || [];
        const sourceMap = getCreateTenderProductSpecSourceMap(Array.isArray(quantityRows) ? quantityRows : []);
        const source = sourceMap.get(sourceRowId);
        if (!source) return;

        const template = getProductSpecTemplateValue(controlId);
        const nextId = `product-spec-${source.sourceRowId}-${Date.now()}`;
        template.rows.push({
            id: nextId,
            sourceRowId: source.sourceRowId,
            values: {
                ...source.values,
                specificationName,
                acceptableRequirement
            }
        });
        saveProductSpecTemplateValue(controlId, template);
        renderRequirementControl(controlId);
        wizard.querySelector(`[data-product-spec-row="${CSS.escape(nextId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const renderRequirementControl = (controlId) => {
        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        if (!control) return;

        if (control.type === 'list') {
            const listNode = wizard.querySelector(`[data-requirement-list-items="${CSS.escape(controlId)}"]`);
            if (listNode) {
                listNode.innerHTML = listNode.classList.contains('scope-activity-list')
                    ? renderCreateTenderScopeActivityRows(control, getRequirementControlValue(controlId))
                    : renderCreateTenderRequirementControlListItems(control, getRequirementControlValue(controlId));
            }
            return;
        }

        if (control.type === 'table') {
            const tableBody = wizard.querySelector(`[data-requirement-table-body="${CSS.escape(controlId)}"]`);
            if (tableBody) {
                const controlNode = tableBody.closest('.requirement-control');
                if (controlNode) {
                    controlNode.innerHTML = `
                        <span class="form-label">${escapeCreateTenderHtml(control.label)}</span>
                        ${renderCreateTenderRequirementControlTable(control, getRequirementControlValue(controlId), profile.id)}
                    `;
                } else {
                    tableBody.innerHTML = renderCreateTenderRequirementTableRows(getRequirementControlValue(controlId), control, profile.id);
                }
            }
            return;
        }

        if (control.type === 'product-spec-builder') {
            const builder = wizard.querySelector(`[data-product-spec-builder="${CSS.escape(controlId)}"]`);
            const controlNode = builder?.closest('.requirement-control');
            if (controlNode) {
                controlNode.innerHTML = `
                    <span class="form-label">${escapeCreateTenderHtml(control.label)}</span>
                    ${renderCreateTenderProductSpecificationBuilder(control, getRequirementControlValue(controlId), profile.id)}
                `;
            }
            return;
        }

        if (control.type === 'cards') {
            const cardList = wizard.querySelector(`[data-requirement-card-list="${CSS.escape(controlId)}"]`);
            if (cardList) {
                const controlNode = cardList.closest('.requirement-control');
                if (controlNode) {
                    controlNode.innerHTML = `
                        <span class="form-label">${escapeCreateTenderHtml(control.label)}</span>
                        ${renderCreateTenderRequirementCards(control, getRequirementControlValue(controlId), profile.id)}
                    `;
                }
            }
            return;
        }

        const inputNode = wizard.querySelector(`[data-requirement-input="${CSS.escape(controlId)}"]`);
        const controlNode = inputNode?.closest('.requirement-control');
        if (controlNode) {
            controlNode.innerHTML = `
                <span class="form-label">${escapeCreateTenderHtml(control.label)}</span>
                ${renderCreateTenderRequirementControl(control, getRequirementControlValue(controlId), profile.id)}
                ${getCreateTenderRequirementHelperText(control, getRequirementControlValue(controlId))
                    ? `<span class="form-hint" data-requirement-helper="${escapeCreateTenderHtml(control.id)}">${escapeCreateTenderHtml(getCreateTenderRequirementHelperText(control, getRequirementControlValue(controlId)))}</span>`
                    : ''}
                ${renderCreateTenderRequirementCounter(control, getRequirementControlValue(controlId))}
            `;
        }
    };

    const updateRequirementInput = (input) => {
        const controlId = input.dataset.requirementInput;
        if (!controlId) return;
        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        let nextValue = input.type === 'checkbox' ? input.checked : input.value;
        saveRequirementControlValue(controlId, nextValue);
        input.classList.toggle('error', input.required && !input.checkValidity());
        refreshRequirementHelper(controlId);
        refreshRequirementCounter(controlId);
        const shouldRefreshContractTypeControl = controlId === 'contractType' && input.tagName === 'SELECT';
        if (shouldRefreshContractTypeControl || controlId === 'serviceCategory' || controlId === 'requireSamples' || controlId === 'siteVisitRequirement' || controlId === 'bankStatementsRequired') {
            refreshProfileText();
            wizard.querySelector(`[data-requirement-input="${CSS.escape(controlId)}"]`)?.focus();
        }
    };

    const updateRequirementControlListItem = (input) => {
        const row = input.closest('[data-requirement-control-row]');
        const controlId = row?.dataset.requirementControl;
        if (!row || !controlId) return;

        const items = normalizeCreateTenderRequirementTextItems(getRequirementControlValue(controlId), controlId);
        const item = items.find(entry => entry.id === row.dataset.requirementControlRow);
        if (!item) return;

        item.text = input.value;
        saveRequirementControlValue(controlId, items);
    };

    const updateRequirementTableField = (input) => {
        const row = input.closest('[data-requirement-table-row]');
        const controlId = row?.dataset.requirementControl;
        const field = input.dataset.requirementTableField;
        if (!row || !controlId || !field) return;

        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        if (!control) return;

        const columns = resolveCreateTenderRequirementColumns(control, profile.id);
        const rows = normalizeCreateTenderRequirementTableRows(getRequirementControlValue(controlId), columns, controlId);
        const tableRow = rows.find(entry => entry.id === row.dataset.requirementTableRow);
        const column = columns.find(item => item.id === field);
        if (!tableRow) return;

        if (column?.type === 'multiselect') {
            tableRow[field] = Array.from(row.querySelectorAll(`[data-requirement-table-field="${CSS.escape(field)}"]:checked`)).map(item => item.value);
        } else if (column?.type === 'tag-select') {
            tableRow[field] = input.value
                ? Array.from(new Set([...(Array.isArray(tableRow[field]) ? tableRow[field] : []), input.value]))
                : (Array.isArray(tableRow[field]) ? tableRow[field] : []);
            input.value = '';
        } else if (column?.type === 'file') {
            tableRow[field] = input.files?.[0]?.name || tableRow[field] || '';
        } else if (input.type === 'checkbox') {
            tableRow[field] = input.checked;
        } else {
            tableRow[field] = input.value;
        }
        saveRequirementControlValue(controlId, rows);

        const rowIndex = Number(row.dataset.requirementTableRowIndex || 0);
        columns
            .filter(column => column.type === 'calculated')
            .forEach(column => {
                const output = row.querySelector(`[data-requirement-calculated-field="${CSS.escape(column.id)}"]`);
                if (output) output.textContent = formatCreateTenderRequirementCalculatedValue(calculateCreateTenderRequirementFormula(column.formula, tableRow));
            });
        if (columns.some(column => column.showWhen?.field === field)) {
            renderRequirementControl(controlId);
        }
        if (column?.type === 'select-custom-prompt' && input.tagName === 'SELECT') {
            renderRequirementControl(controlId);
        }
        if (column?.type === 'tag-select') {
            renderRequirementControl(controlId);
        }
        if (controlId === 'quantityScheduleRows') {
            renderRequirementControl('productSpecificationTemplate');
            renderRequirementControl('sampleRequirementRows');
        }
    };

    const updateRequirementCardField = (input) => {
        const row = input.closest('[data-requirement-card-row]');
        const controlId = row?.dataset.requirementControl;
        const fieldId = input.dataset.requirementCardField;
        if (!row || !controlId || !fieldId) return;

        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        if (!control) return;

        const fields = resolveCreateTenderRequirementFields(control, profile.id);
        const cards = normalizeCreateTenderRequirementObjectRows(getRequirementControlValue(controlId), fields, controlId);
        const card = cards.find(entry => entry.id === row.dataset.requirementCardRow);
        const field = fields.find(item => item.id === fieldId);
        if (!card || !field) return;

        if (field.type === 'multiselect') {
            card[fieldId] = Array.from(row.querySelectorAll(`[data-requirement-card-field="${CSS.escape(fieldId)}"]:checked`)).map(item => item.value);
        } else if (field.type === 'tag-select') {
            card[fieldId] = input.value
                ? Array.from(new Set([...(Array.isArray(card[fieldId]) ? card[fieldId] : []), input.value]))
                : (Array.isArray(card[fieldId]) ? card[fieldId] : []);
            input.value = '';
        } else if (field.type === 'file') {
            card[fieldId] = input.files?.[0]?.name || card[fieldId] || '';
        } else if (input.type === 'checkbox') {
            card[fieldId] = input.checked;
        } else {
            card[fieldId] = input.value;
        }
        saveRequirementControlValue(controlId, cards);
        if (fields.some(item => item.showWhen?.field === fieldId) || field.sourceControlId || field.type === 'tag-select') {
            renderRequirementControl(controlId);
        }
    };

    const updateRequirementAccordionField = (input) => {
        const wrapper = input.closest('[data-requirement-accordion]');
        const controlId = wrapper?.dataset.requirementAccordion;
        const fieldId = input.dataset.requirementAccordionField;
        if (!controlId || !fieldId) return;

        const value = getRequirementControlValue(controlId);
        saveRequirementControlValue(controlId, {
            ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
            [fieldId]: input.value
        });
    };

    const updateLicenseRequirement = (input) => {
        const row = input.closest('[data-license-row]');
        const field = input.dataset.licenseField;
        if (!row || !field) return;

        const profile = getSelectedProfile();
        const items = getCreateTenderRegulatoryLicenses(profile);
        const item = items.find(entry => entry.id === row.dataset.licenseRow);
        if (!item) return;

        if (field === 'license') {
            const catalogItem = getCreateTenderRegulatoryLicenseByName(input.value);
            item.license = catalogItem.license;
            item.body = catalogItem.body;
            const bodyInput = row.querySelector('[data-license-body]');
            if (bodyInput) bodyInput.value = catalogItem.body;
        }
        if (field === 'mandatory' || field === 'expiryRequired') {
            item[field] = input.checked;
        }

        saveCreateTenderRegulatoryLicenses(items, profile);
        refreshLicenseSummary();
        refreshTenderReview();
    };

    const parseDelimitedRows = (text) => {
        const splitLine = (line) => {
            if (line.includes('\t')) {
                return line.split('\t').map(cell => cell.trim().replace(/^"|"$/g, ''));
            }

            const cells = [];
            let current = '';
            let quoted = false;

            for (let index = 0; index < line.length; index += 1) {
                const char = line[index];
                const nextChar = line[index + 1];

                if (char === '"' && quoted && nextChar === '"') {
                    current += '"';
                    index += 1;
                    continue;
                }

                if (char === '"') {
                    quoted = !quoted;
                    continue;
                }

                if (char === ',' && !quoted) {
                    cells.push(current.trim());
                    current = '';
                    continue;
                }

                current += char;
            }

            cells.push(current.trim());
            return cells;
        };

        return text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(splitLine);
    };

    const isHeaderRow = (cells, labels = []) => {
        const normalizedCells = cells.map(cell => String(cell || '').trim().toLowerCase());
        const normalizedLabels = labels.map(label => String(label || '').trim().toLowerCase());
        return normalizedLabels.length && normalizedLabels.every((label, index) => normalizedCells[index] === label);
    };

    const parseBoqDelimitedText = (text) => {
        return parseDelimitedRows(text)
            .filter(cells => cells.length >= 5)
            .filter((cells, index) => index !== 0 || !/item|description|qty|quantity/i.test(cells.join(' ')))
            .map((cells, index) => normalizeCreateTenderBoqItem({
                id: `boq-import-${Date.now()}-${index}`,
                item: cells[0],
                description: cells[1],
                qty: cells[2],
                unit: cells[3],
                rate: cells[4]
            }, index));
    };

    const parseRequirementTableDelimitedText = (controlId, text) => {
        const profile = getSelectedProfile();
        const control = getCreateTenderRequirementControl(profile.id, controlId);
        if (!control || control.type !== 'table') return [];

        const columns = resolveCreateTenderRequirementColumns(control, profile.id);
        const labels = columns.map(column => column.label);
        return parseDelimitedRows(text)
            .filter(cells => cells.length)
            .filter((cells, index) => index !== 0 || !isHeaderRow(cells, labels))
            .map((cells, rowIndex) => {
                const row = { id: `requirement-${controlId}-import-${Date.now()}-${rowIndex}` };
                columns.forEach((column, columnIndex) => {
                    if (column.type === 'index' || column.type === 'calculated') return;
                    const cellValue = cells[columnIndex] || '';
                    if (column.type === 'toggle') {
                        row[column.id] = /^(yes|true|1)$/i.test(String(cellValue).trim());
                        return;
                    }
                    if (column.type === 'multiselect' || column.type === 'tag-select') {
                        row[column.id] = String(cellValue || '').split(/[;,]/).map(item => item.trim()).filter(Boolean);
                        return;
                    }
                    row[column.id] = cellValue;
                });
                return row;
            })
            .filter(row => Object.entries(row).some(([key, value]) => key !== 'id' && String(value || '').trim()));
    };

    wizard.addEventListener('change', (event) => {
        if (event.target?.matches('input[name="procurementType"]')) {
            const nextTypeId = event.target.value;
            const currentTypeId = getCreateTenderMainDraft().procurementTypeId || setup.defaultType.id;
            if (nextTypeId !== currentTypeId && hasCreateTenderPostSelectionData(currentTypeId)) {
                const currentType = setup.types.find(type => type.id === currentTypeId) || setup.defaultType;
                const nextType = setup.types.find(type => type.id === nextTypeId) || setup.defaultType;
                const confirmed = window.confirm(
                    `Changing tender type from ${currentType.label} to ${nextType.label} will clear the tender category, method/invitations, requirements, commercial items, deliverables, attachments, licenses, milestones, and evaluation setup already filled after type selection.\n\nDo you want to continue and start those sections again?`
                );
                if (!confirmed) {
                    const previousInput = wizard.querySelector(`input[name="procurementType"][value="${CSS.escape(currentTypeId)}"]`);
                    if (previousInput) previousInput.checked = true;
                    syncProcurementTypeCards(currentTypeId);
                    return;
                }
                syncProcurementType(nextTypeId, { resetPostSelection: true });
                refreshTenderReview();
                return;
            }
            syncProcurementType(nextTypeId);
            refreshTenderReview();
        }
        if (event.target?.matches('[data-contact-field]')) {
            updateContactField(event.target);
        }
        if (event.target?.matches('[data-milestone-field]')) {
            updateMilestoneRow(event.target);
        }
        if (event.target?.matches('[data-scope-item-input]')) {
            updateScopeItem(event.target);
        }
        if (event.target?.matches('[data-requirement-field]')) {
            updateRequirementField(event.target);
        }
        if (event.target?.matches('[data-requirement-input]')) {
            updateRequirementInput(event.target);
        }
        if (event.target?.matches('[data-requirement-list-input]')) {
            updateRequirementListItem(event.target);
        }
        if (event.target?.matches('[data-requirement-list-item]')) {
            updateRequirementControlListItem(event.target);
        }
        if (event.target?.matches('[data-requirement-table-field]')) {
            updateRequirementTableField(event.target);
        }
        if (event.target?.matches('[data-requirement-card-field]')) {
            updateRequirementCardField(event.target);
        }
        if (event.target?.matches('[data-requirement-accordion-field]')) {
            updateRequirementAccordionField(event.target);
        }
        if (event.target?.matches('[data-license-field]')) {
            updateLicenseRequirement(event.target);
        }
        if (event.target?.matches('[data-evaluation-field]')) {
            updateEvaluationField(event.target);
        }
        if (event.target?.matches('[data-evaluation-mode]')) {
            updateEvaluationMode(event.target);
        }
        if (event.target?.matches('[data-evaluation-confirmation]')) {
            syncSystemEvaluationSubmitState();
        }
        if (event.target?.matches('[data-procurement-method]')) {
            syncTenderMethod();
        }
        if (event.target?.matches('[data-tender-funding-source-select]')) {
            syncFundingSourceCustomField();
        }
        if (event.target?.matches('[data-tender-title], [data-tender-funding-source-select], [data-tender-funding-source-custom], [data-procurement-method], [data-evaluation-field]')) {
            saveMainDetailsFromInputs();
            refreshTenderReview();
        }
    });

    wizard.addEventListener('input', (event) => {
        if (event.target?.matches('[data-procurement-category-search]')) {
            const typedCategory = event.target.value.trim();
            renderCategoryResults(typedCategory);

            if (typedCategory.toLowerCase() === 'other') {
                selectOtherCategory();
            }
        }
        if (event.target?.matches('[data-custom-category]')) {
            if (customCategoryAddButton) customCategoryAddButton.disabled = !event.target.value.trim();
        }
        if (event.target?.matches('[data-invite-search]')) {
            renderInviteResults(event.target.value);
        }
        if (event.target?.matches('[data-license-add-search]')) {
            renderLicenseAddResults(event.target.value);
        }
        if (event.target?.matches('[data-license-search]')) {
            const row = event.target.closest('[data-license-row]');
            renderLicenseResults(row, event.target.value);
        }
        if (event.target?.matches('[data-contact-field]')) {
            updateContactField(event.target);
        }
        if (event.target?.matches('[data-boq-field]')) {
            updateBoqRow(event.target);
        }
        if (event.target?.matches('[data-milestone-field]')) {
            updateMilestoneRow(event.target);
        }
        if (event.target?.matches('[data-scope-item-input]')) {
            updateScopeItem(event.target);
        }
        if (event.target?.matches('[data-requirement-field]')) {
            updateRequirementField(event.target);
        }
        if (event.target?.matches('[data-requirement-input]')) {
            updateRequirementInput(event.target);
        }
        if (event.target?.matches('[data-requirement-list-input]')) {
            updateRequirementListItem(event.target);
        }
        if (event.target?.matches('[data-requirement-list-item]')) {
            updateRequirementControlListItem(event.target);
        }
        if (event.target?.matches('[data-requirement-table-field]')) {
            updateRequirementTableField(event.target);
        }
        if (event.target?.matches('[data-requirement-card-field]')) {
            updateRequirementCardField(event.target);
        }
        if (event.target?.matches('[data-product-spec-cell]')) {
            updateProductSpecCell(event.target);
        }
        if (event.target?.matches('[data-product-spec-column-label], [data-product-spec-column-instructions]')) {
            updateProductSpecColumnField(event.target);
        }
        if (event.target?.matches('[data-requirement-accordion-field]')) {
            updateRequirementAccordionField(event.target);
        }
        if (event.target?.matches('[data-license-field]')) {
            updateLicenseRequirement(event.target);
        }
        if (event.target?.matches('[data-evaluation-field]')) {
            updateEvaluationField(event.target);
        }
        if (event.target?.matches('[data-tender-title], [data-tender-funding-source-custom], [data-evaluation-field]')) {
            saveMainDetailsFromInputs();
            refreshTenderReview();
        }
    });

    wizard.addEventListener('click', (event) => {
        const railStep = event.target?.closest('[data-wizard-step-index]');
        if (railStep) {
            event.preventDefault();
            const requestedStepIndex = Number(railStep.dataset.wizardStepIndex);
            if (requestedStepIndex > activeStepIndex && !validateActiveStep()) return;
            if (requestedStepIndex > 2 && !validateRequirementsBeforeLeavingStep()) return;
            if (requestedStepIndex > 3 && !validateEvaluationBeforeLeavingStep()) return;
            setActiveStep(requestedStepIndex);
            return;
        }

        const target = event.target?.closest('button');
        if (!target) return;

        if (target.matches('[data-category-option]')) {
            selectCategoryOption(target.dataset.categoryOption);
            return;
        }

        if (target.matches('[data-requirement-reset-select]')) {
            const controlId = target.dataset.requirementResetSelect;
            if (target.closest('[data-requirement-table-row]')) {
                const row = target.closest('[data-requirement-table-row]');
                const input = row?.querySelector(`[data-requirement-table-field="${CSS.escape(controlId)}"]`);
                if (input) {
                    input.value = '';
                    updateRequirementTableField(input);
                    renderRequirementControl(row?.dataset.requirementControl);
                    input.focus();
                }
                return;
            }
            saveRequirementControlValue(controlId, '');
            renderRequirementControl(controlId);
            refreshRequirementHelper(controlId);
            wizard.querySelector(`[data-requirement-input="${CSS.escape(controlId)}"]`)?.focus();
            return;
        }

        if (target.matches('[data-product-spec-open-modal]')) {
            openProductSpecModal(target.dataset.productSpecOpenModal || 'productSpecificationTemplate', target.dataset.productSpecSource || '');
            return;
        }

        if (target.matches('[data-product-spec-modal-cancel]')) {
            closeProductSpecModal(target.closest('[data-product-spec-modal]'));
            return;
        }

        if (target.matches('[data-product-spec-modal-save]')) {
            saveProductSpecModal(target.closest('[data-product-spec-modal]'));
            return;
        }

        if (target.matches('[data-product-spec-delete-row]')) {
            const row = target.closest('[data-product-spec-row]');
            const controlId = row?.dataset.productSpecControl || 'productSpecificationTemplate';
            const rowId = target.dataset.productSpecDeleteRow;
            const template = getProductSpecTemplateValue(controlId);
            template.rows = template.rows.filter(item => item.id !== rowId);
            saveProductSpecTemplateValue(controlId, template);
            renderRequirementControl(controlId);
            return;
        }

        if (target.matches('[data-product-spec-import]')) {
            pendingProductSpecImportControlId = target.dataset.productSpecImport || 'productSpecificationTemplate';
            wizard.querySelector('[data-boq-file]')?.click();
            return;
        }

        if (target.matches('[data-product-spec-download]')) {
            downloadProductSpecTemplateCsv(target.dataset.productSpecDownload || 'productSpecificationTemplate');
            return;
        }

        if (target.matches('[data-requirement-import]')) {
            pendingRequirementImportControlId = target.dataset.requirementImport || '';
            wizard.querySelector('[data-boq-file]')?.click();
            return;
        }

        if (target.matches('[data-requirement-template]')) {
            downloadCreateTenderBoqTemplate(getSelectedProfile(), target.dataset.requirementTemplate);
            return;
        }

        if (target.matches('[data-upload-button-trigger]')) {
            const controlId = target.dataset.uploadButtonTrigger;
            target.closest('.requirement-control')?.querySelector(`[data-requirement-input="${CSS.escape(controlId)}"]`)?.click();
            return;
        }

        if (target.matches('[data-requirement-tag-remove]')) {
            const row = target.closest('[data-requirement-table-row]');
            const cardRow = target.closest('[data-requirement-card-row]');
            const controlId = row?.dataset.requirementControl || cardRow?.dataset.requirementControl;
            const tagSelect = target.closest('.requirement-tag-select');
            const picker = tagSelect?.querySelector('[data-requirement-table-field], [data-requirement-card-field]');
            const field = picker?.dataset.requirementTableField || picker?.dataset.requirementCardField;
            if (!controlId || !field) return;

            const profile = getSelectedProfile();
            const control = getCreateTenderRequirementControl(profile.id, controlId);
            if (row) {
                const columns = resolveCreateTenderRequirementColumns(control, profile.id);
                const rows = normalizeCreateTenderRequirementTableRows(getRequirementControlValue(controlId), columns, controlId);
                const tableRow = rows.find(entry => entry.id === row.dataset.requirementTableRow);
                if (!tableRow) return;
                tableRow[field] = (Array.isArray(tableRow[field]) ? tableRow[field] : [])
                    .filter(item => item !== target.dataset.requirementTagRemove);
                saveRequirementControlValue(controlId, rows);
            }
            if (cardRow) {
                const fields = resolveCreateTenderRequirementFields(control, profile.id);
                const cards = normalizeCreateTenderRequirementObjectRows(getRequirementControlValue(controlId), fields, controlId);
                const card = cards.find(entry => entry.id === cardRow.dataset.requirementCardRow);
                if (!card) return;
                card[field] = (Array.isArray(card[field]) ? card[field] : [])
                    .filter(item => item !== target.dataset.requirementTagRemove);
                saveRequirementControlValue(controlId, cards);
            }
            renderRequirementControl(controlId);
            return;
        }

        if (target.matches('[data-requirement-repeatable-add]')) {
            const cardRow = target.closest('[data-requirement-card-row]');
            const repeatable = target.closest('[data-requirement-repeatable-field]');
            const input = repeatable?.querySelector('[data-requirement-repeatable-input]');
            const controlId = cardRow?.dataset.requirementControl;
            const field = repeatable?.dataset.requirementRepeatableField;
            const nextValue = String(input?.value || '').trim();
            if (!cardRow || !controlId || !field || !nextValue) return;

            const profile = getSelectedProfile();
            const control = getCreateTenderRequirementControl(profile.id, controlId);
            const fields = resolveCreateTenderRequirementFields(control, profile.id);
            const cards = normalizeCreateTenderRequirementObjectRows(getRequirementControlValue(controlId), fields, controlId);
            const card = cards.find(entry => entry.id === cardRow.dataset.requirementCardRow);
            if (!card) return;
            const fieldDefinition = fields.find(item => item.id === field);
            if (fieldDefinition?.type === 'repeatable-certification') {
                const nextItem = {
                    name: nextValue,
                    mandatory: Boolean(repeatable.querySelector('[data-requirement-repeatable-mandatory]')?.checked)
                };
                const existing = normalizeCreateTenderCertificationItems(card[field]);
                const exists = existing.some(item => item.name === nextItem.name && item.mandatory === nextItem.mandatory);
                card[field] = exists ? existing : [...existing, nextItem];
            } else {
                card[field] = Array.from(new Set([...(Array.isArray(card[field]) ? card[field] : []), nextValue]));
            }
            saveRequirementControlValue(controlId, cards);
            renderRequirementControl(controlId);
            return;
        }

        if (target.matches('[data-requirement-repeatable-remove]')) {
            const cardRow = target.closest('[data-requirement-card-row]');
            const repeatable = target.closest('[data-requirement-repeatable-field]');
            const controlId = cardRow?.dataset.requirementControl;
            const field = repeatable?.dataset.requirementRepeatableField;
            if (!cardRow || !controlId || !field) return;

            const profile = getSelectedProfile();
            const control = getCreateTenderRequirementControl(profile.id, controlId);
            const fields = resolveCreateTenderRequirementFields(control, profile.id);
            const cards = normalizeCreateTenderRequirementObjectRows(getRequirementControlValue(controlId), fields, controlId);
            const card = cards.find(entry => entry.id === cardRow.dataset.requirementCardRow);
            if (!card) return;
            const fieldDefinition = fields.find(item => item.id === field);
            if (fieldDefinition?.type === 'repeatable-certification') {
                card[field] = normalizeCreateTenderCertificationItems(card[field])
                    .filter(item => `${item.name}::${item.mandatory ? 'mandatory' : 'optional'}` !== target.dataset.requirementRepeatableRemove);
            } else {
                card[field] = (Array.isArray(card[field]) ? card[field] : [])
                    .filter(item => item !== target.dataset.requirementRepeatableRemove);
            }
            saveRequirementControlValue(controlId, cards);
            renderRequirementControl(controlId);
            return;
        }

        if (target.matches('[data-category-other]')) {
            selectOtherCategory();
            return;
        }

        if (target.matches('[data-custom-category-add]')) {
            addSelectedCategory(customCategoryInput?.value);
            return;
        }

        if (target.matches('[data-category-remove]')) {
            removeSelectedCategory(target.dataset.categoryRemove);
            return;
        }

        if (target.matches('[data-license-option]')) {
            selectLicenseRequirement(target.closest('[data-license-row]'), target.dataset.licenseOption);
            return;
        }

        if (target.matches('[data-license-add-option]')) {
            addLicenseRequirement(target.dataset.licenseAddOption);
            return;
        }

        if (target.matches('[data-license-change]')) {
            const row = target.closest('[data-license-row]');
            const searchInput = row?.querySelector('[data-license-search]');
            setLicensePickerOpen(row, true);
            if (searchInput) {
                searchInput.value = '';
                renderLicenseResults(row, '');
                searchInput.focus();
            }
            return;
        }

        if (target.matches('[data-invite-user]')) {
            addInvitedUser(target.dataset.inviteUser);
            return;
        }

        if (target.matches('[data-invited-user-remove]')) {
            removeInvitedUser(target.dataset.invitedUserRemove);
            return;
        }

        if (target.matches('[data-evaluation-add-subcriterion]')) {
            const row = target.closest('[data-evaluation-criterion]');
            const picker = row?.querySelector('[data-evaluation-subcriteria-picker]');
            const selectedValue = String(picker?.value || '').trim();
            if (!row || !selectedValue) return;
            const evaluationDraft = getSelectedEvaluationDraft();
            const criterion = evaluationDraft.criteria.find(item => item.id === row.dataset.evaluationCriterion);
            if (!criterion) return;
            const existing = new Set(normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria).map(item => item.toLowerCase()));
            if (!existing.has(selectedValue.toLowerCase())) {
                criterion.subcriteria = [...normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria), selectedValue];
                saveSelectedEvaluationDraft(evaluationDraft);
                renderEvaluationBuilder();
            }
            return;
        }

        if (target.matches('[data-evaluation-add-custom-subcriterion]')) {
            const row = target.closest('[data-evaluation-criterion]');
            const input = row?.querySelector('[data-evaluation-custom-subcriterion]');
            const selectedValue = String(input?.value || '').trim();
            if (!row || !selectedValue) return;
            const evaluationDraft = getSelectedEvaluationDraft();
            const criterion = evaluationDraft.criteria.find(item => item.id === row.dataset.evaluationCriterion);
            if (!criterion) return;
            const existing = new Set(normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria).map(item => item.toLowerCase()));
            if (!existing.has(selectedValue.toLowerCase())) {
                criterion.subcriteria = [...normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria), selectedValue];
                saveSelectedEvaluationDraft(evaluationDraft);
                renderEvaluationBuilder();
            }
            return;
        }

        if (target.matches('[data-evaluation-remove-subcriterion]')) {
            const row = target.closest('[data-evaluation-criterion]');
            if (!row) return;
            const evaluationDraft = getSelectedEvaluationDraft();
            const criterion = evaluationDraft.criteria.find(item => item.id === row.dataset.evaluationCriterion);
            if (!criterion) return;
            const removeValue = String(target.dataset.evaluationRemoveSubcriterion || '').toLowerCase();
            criterion.subcriteria = normalizeCreateTenderEvaluationSubcriteria(criterion.subcriteria)
                .filter(item => item.toLowerCase() !== removeValue);
            saveSelectedEvaluationDraft(evaluationDraft);
            renderEvaluationBuilder();
            return;
        }

        if (target.matches('[data-evaluation-edit]')) {
            const row = target.closest('[data-evaluation-criterion]');
            if (!row) return;
            openEvaluationEditMenu(row.dataset.evaluationCriterion);
            return;
        }

        if (target.matches('[data-evaluation-save-edit]')) {
            const row = target.closest('[data-evaluation-criterion]');
            const menu = row?.querySelector('[data-evaluation-edit-menu]');
            if (!menu) return;
            menu.hidden = true;
            renderEvaluationBuilder();
            return;
        }

        if (target.matches('[data-evaluation-cancel-edit]')) {
            const row = target.closest('[data-evaluation-criterion]');
            const menu = row?.querySelector('[data-evaluation-edit-menu]');
            if (!menu) return;
            menu.hidden = true;
            return;
        }

        if (target.matches('[data-evaluation-add-suggestion]')) {
            const profile = getSelectedProfile();
            const evaluationDraft = getSelectedEvaluationDraft();
            const nextCriterion = createTenderEvaluationCriterionFromCatalog(profile.id, target.dataset.evaluationAddSuggestion);
            if (!nextCriterion) return;
            evaluationDraft.criteria.push(nextCriterion);
            const nextDraft = evaluationDraft.mode === 'auto' ? balanceCreateTenderEvaluationWeights(evaluationDraft) : evaluationDraft;
            saveSelectedEvaluationDraft(nextDraft);
            renderEvaluationBuilder();
            return;
        }

        if (target.matches('[data-evaluation-add-custom]')) {
            const evaluationDraft = getSelectedEvaluationDraft();
            const criterion = normalizeCreateTenderEvaluationCriterion({
                id: `evaluation-custom-${Date.now()}`,
                name: 'Custom criterion',
                category: 'Custom',
                weight: 0,
                subcriteria: [],
                custom: true
            }, evaluationDraft.criteria.length, getSelectedProfile().id);
            evaluationDraft.criteria.push(criterion);
            const nextDraft = evaluationDraft.mode === 'auto' ? balanceCreateTenderEvaluationWeights(evaluationDraft) : evaluationDraft;
            saveSelectedEvaluationDraft(nextDraft);
            renderEvaluationBuilder();
            openEvaluationEditMenu(criterion.id);
            return;
        }

        if (target.matches('[data-evaluation-delete]')) {
            const evaluationDraft = getSelectedEvaluationDraft();
            evaluationDraft.criteria = evaluationDraft.criteria.filter(item => item.id !== target.dataset.evaluationDelete);
            const nextDraft = evaluationDraft.mode === 'auto' ? balanceCreateTenderEvaluationWeights(evaluationDraft) : evaluationDraft;
            saveSelectedEvaluationDraft(nextDraft);
            renderEvaluationBuilder();
            return;
        }

        if (target.matches('[data-evaluation-distribute]')) {
            saveSelectedEvaluationDraft(distributeCreateTenderEvaluationRemaining(getSelectedEvaluationDraft()));
            renderEvaluationBuilder();
            return;
        }

        if (target.matches('[data-evaluation-balance]')) {
            saveSelectedEvaluationDraft(balanceCreateTenderEvaluationWeights(getSelectedEvaluationDraft()));
            renderEvaluationBuilder();
            return;
        }

        if (target.matches('[data-run-system-evaluation]')) {
            const confirmations = Array.from(wizard.querySelectorAll('[data-evaluation-confirmation]'));
            if (confirmations.some(input => !input.checked)) {
                alert('Please complete all confirmation checks before submitting the tender for evaluation.');
                syncSystemEvaluationSubmitState();
                return;
            }
            saveMainDetailsFromInputs();
            if (!validateEvaluationBeforeLeavingStep()) return;
            const profile = getSelectedProfile();
            const result = getCreateTenderSystemEvaluation(profile, getCreateTenderMainDraft());
            saveCreateTenderSystemEvaluation(profile.id, result);
            if (result.completed) {
                const publishedTender = publishCreateTenderToMarketplace(wizard);
                if (publishedTender) {
                    window.addProcurexCommunicationItem?.({
                        kind: 'notification',
                        category: 'Tender Publication',
                        subject: 'Tender Published Successfully',
                        body: `Your tender ${publishedTender.title} has passed evaluation and has been published to the marketplace.`,
                        senderType: 'System',
                        senderName: 'ProcureX System',
                        recipientType: 'Buyer',
                        recipientName: mockData.users?.buyer?.organization || 'Buyer organization',
                        tenderId: publishedTender.id,
                        tenderReference: publishedTender.id,
                        tenderTitle: publishedTender.title,
                        priority: 'Normal',
                        status: 'Unread',
                        read: false,
                        actionLabel: 'View Tender',
                        actionPage: 'tender-details',
                        audience: ['buyer', 'all']
                    });
                    window.addProcurexCommunicationItem?.({
                        kind: 'notification',
                        category: publishedTender.method === createTenderClosedMethod ? 'Supplier Invitation' : 'Tender Publication',
                        subject: publishedTender.method === createTenderClosedMethod ? 'New Tender Invitation' : 'New Tender Invitation',
                        body: publishedTender.method === createTenderClosedMethod
                            ? `You have been invited to participate in tender ${publishedTender.id}: ${publishedTender.title}.`
                            : `A new tender matching your profile is available: ${publishedTender.id}: ${publishedTender.title}.`,
                        senderType: 'System',
                        senderName: 'ProcureX System',
                        recipientType: 'Supplier',
                        recipientName: 'Eligible suppliers',
                        tenderId: publishedTender.id,
                        tenderReference: publishedTender.id,
                        tenderTitle: publishedTender.title,
                        priority: 'Normal',
                        status: 'Unread',
                        read: false,
                        actionRequired: true,
                        actionLabel: 'Start Submission',
                        actionPage: 'bidding-workspace',
                        audience: ['supplier', 'all']
                    });
                    alert(`Tender passed evaluation and has been published to the marketplace.\n\nTender: ${publishedTender.title}`);
                    window.app?.navigateTo('marketplace');
                }
                return;
            }

            saveCreateTenderDraftFromWizard(wizard);
            const changes = getCreateTenderEvaluationReturnMessages(result)
                .map((item, index) => `${index + 1}. ${item}`)
                .join('\n');
            window.addProcurexCommunicationItem?.({
                kind: 'alert',
                category: 'Tender Rejection',
                subject: 'Tender Returned for Correction',
                body: `Your tender was reviewed and returned for correction. Required changes: ${changes.replace(/\n/g, ' ')}`,
                senderType: 'Evaluator',
                senderName: 'Evaluation Panel',
                recipientType: 'Buyer',
                recipientName: mockData.users?.buyer?.organization || 'Buyer organization',
                tenderId: getCreateTenderMainDraft().id || 'Draft tender',
                tenderReference: getCreateTenderMainDraft().id || 'Draft tender',
                tenderTitle: getCreateTenderMainDraft().title || 'Untitled tender',
                priority: 'High',
                status: 'Action Required',
                read: false,
                actionRequired: true,
                actionLabel: 'Edit Tender',
                actionPage: 'create-tender',
                audience: ['buyer', 'admin', 'all']
            });
            alert(`Tender did not pass evaluation and has been returned to your dashboard as a draft.\n\nRequired changes:\n${changes}`);
            window.app?.navigateTo('workspace-dashboard');
            return;
        }

        if (target.matches('[data-download-draft-tender-pdf]')) {
            saveMainDetailsFromInputs();
            const previewTender = buildCreateTenderDocumentPreview(wizard);
            if (typeof window.downloadProcurexTenderPdfPreview === 'function') {
                window.downloadProcurexTenderPdfPreview(previewTender, { audience: 'buyer' });
            } else {
                alert('Tender PDF generator is still loading. Please try again in a moment.');
            }
            return;
        }

        if (target.matches('[data-wizard-prev]')) {
            setActiveStep(activeStepIndex - 1);
            return;
        }

        if (target.matches('[data-wizard-next]')) {
            if (!validateActiveStep()) return;
            if (activeStepIndex === 2 && !validateRequirementsBeforeLeavingStep()) return;
            if (activeStepIndex === 3 && !validateEvaluationBeforeLeavingStep()) return;
            setActiveStep(activeStepIndex + 1);
            return;
        }

        if (target.matches('[data-boq-import]')) {
            pendingRequirementImportControlId = '';
            wizard.querySelector('[data-boq-file]')?.click();
            return;
        }

        if (target.matches('[data-boq-template]')) {
            downloadCreateTenderBoqTemplate(getSelectedProfile());
            return;
        }

        if (target.matches('[data-contact-verify]')) {
            verifyContactChannel(target.dataset.contactVerify);
            return;
        }

        if (target.matches('[data-boq-add]')) {
            const profile = getSelectedProfile();
            const items = getCreateTenderBoqItems(profile);
            items.push(normalizeCreateTenderBoqItem({
                id: `boq-${Date.now()}`,
                item: nextBoqItemCode(items),
                description: '',
                qty: 1,
                unit: 'Unit',
                rate: 0
            }, items.length));
            saveCreateTenderBoqItems(items, profile);
            renderBoqTable();
            wizard.querySelector('[data-boq-table-body] tr:last-child [data-boq-field="description"]')?.focus();
            return;
        }

        if (target.matches('[data-boq-recalculate]')) {
            renderBoqTable();
            return;
        }

        if (target.matches('[data-boq-delete]')) {
            const row = target.closest('[data-boq-row]');
            const profile = getSelectedProfile();
            const items = getCreateTenderBoqItems(profile).filter(item => item.id !== row?.dataset.boqRow);
            saveCreateTenderBoqItems(items, profile);
            renderBoqTable();
            return;
        }

        if (target.matches('[data-scope-add]')) {
            const type = target.dataset.scopeAdd;
            const items = getScopeItemsByType(type);
            const prefix = type === 'attachments' ? 'attachment' : 'deliverable';
            const label = type === 'attachments' ? 'Required attachment' : 'Deliverable';
            items.push(normalizeCreateTenderScopeItem({
                id: `${prefix}-${Date.now()}`,
                text: `${label} ${items.length + 1}`
            }, items.length, prefix));
            saveScopeItemsByType(type, items);
            renderScopeList(type);
            refreshTenderReview();
            wizard.querySelector(`[data-scope-list="${type}"] [data-scope-row]:last-child [data-scope-item-input]`)?.focus();
            return;
        }

        if (target.matches('[data-scope-delete]')) {
            const row = target.closest('[data-scope-row]');
            const type = row?.dataset.scopeType;
            if (!type) return;

            const items = getScopeItemsByType(type).filter(item => item.id !== row?.dataset.scopeRow);
            saveScopeItemsByType(type, items);
            renderScopeList(type);
            refreshTenderReview();
            return;
        }

        if (target.matches('[data-requirement-control-add]')) {
            const controlId = target.dataset.requirementControlAdd;
            const profile = getSelectedProfile();
            const control = getCreateTenderRequirementControl(profile.id, controlId);
            if (!control) return;

            if (control.type === 'list') {
                const items = normalizeCreateTenderRequirementTextItems(getRequirementControlValue(controlId), controlId);
                items.push({ id: `requirement-${controlId}-${Date.now()}`, text: '' });
                saveRequirementControlValue(controlId, items);
                renderRequirementControl(controlId);
                wizard.querySelector(`[data-requirement-list-items="${CSS.escape(controlId)}"] [data-requirement-control-row]:last-child [data-requirement-list-item]`)?.focus();
                return;
            }

            if (control.type === 'table') {
                const columns = resolveCreateTenderRequirementColumns(control, profile.id);
                const sourceField = columns.find(column => column.sourceControlId);
                const sourceOptions = sourceField?.options || [];
                if (control.requiresSourceOptions && !sourceOptions.length) return;

                const rows = normalizeCreateTenderRequirementTableRows(getRequirementControlValue(controlId), columns, controlId);
                const nextRow = { id: `requirement-${controlId}-${Date.now()}` };
                columns.forEach(column => {
                    if (column.type === 'index' || column.type === 'calculated') return;
                    if (column.type === 'multiselect') {
                        nextRow[column.id] = [];
                        return;
                    }
                    if (column.type === 'toggle') {
                        nextRow[column.id] = false;
                        return;
                    }
                    if (column.sourceControlId) {
                        nextRow[column.id] = column.options?.[0]?.value || '';
                        return;
                    }
                    nextRow[column.id] = '';
                });
                rows.push(nextRow);
                saveRequirementControlValue(controlId, rows);
                renderRequirementControl(controlId);
                if (controlId === 'quantityScheduleRows') {
                    renderRequirementControl('productSpecificationTemplate');
                    renderRequirementControl('sampleRequirementRows');
                }
                wizard.querySelector(`[data-requirement-table-body="${CSS.escape(controlId)}"] [data-requirement-table-row]:last-child input`)?.focus();
                return;
            }

            if (control.type === 'cards') {
                const fields = resolveCreateTenderRequirementFields(control, profile.id);
                const sourceField = fields.find(field => field.sourceControlId);
                const sourceOptions = sourceField?.options || [];
                if (control.requiresSourceOptions && !sourceOptions.length) return;

                const cards = normalizeCreateTenderRequirementObjectRows(getRequirementControlValue(controlId), fields, controlId);
                const nextCard = { id: `requirement-${controlId}-${Date.now()}` };
                fields.forEach(field => {
                    if (field.type === 'multiselect') nextCard[field.id] = [];
                    else if (field.type === 'toggle') nextCard[field.id] = false;
                    else if (field.sourceControlId) nextCard[field.id] = sourceOptions[0]?.value || '';
                    else nextCard[field.id] = '';
                });
                if (control.presets?.length && !cards.length) nextCard[(fields || [])[0]?.id] = control.presets[0] || '';
                cards.push(nextCard);
                saveRequirementControlValue(controlId, cards);
                renderRequirementControl(controlId);
                wizard.querySelector(`[data-requirement-card-list="${CSS.escape(controlId)}"] [data-requirement-card-row]:last-child input, [data-requirement-card-list="${CSS.escape(controlId)}"] [data-requirement-card-row]:last-child textarea, [data-requirement-card-list="${CSS.escape(controlId)}"] [data-requirement-card-row]:last-child select`)?.focus();
            }
            return;
        }

        if (target.matches('[data-requirement-control-delete]')) {
            const controlId = target.dataset.requirementControlDelete;
            const profile = getSelectedProfile();
            const control = getCreateTenderRequirementControl(profile.id, controlId);
            if (!control) return;

            if (control.type === 'list') {
                const row = target.closest('[data-requirement-control-row]');
                const items = normalizeCreateTenderRequirementTextItems(getRequirementControlValue(controlId), controlId)
                    .filter(item => item.id !== row?.dataset.requirementControlRow);
                saveRequirementControlValue(controlId, items);
                renderRequirementControl(controlId);
                return;
            }

            if (control.type === 'table') {
                const row = target.closest('[data-requirement-table-row]');
                const columns = resolveCreateTenderRequirementColumns(control, profile.id);
                const rows = normalizeCreateTenderRequirementTableRows(getRequirementControlValue(controlId), columns, controlId)
                    .filter(item => item.id !== row?.dataset.requirementTableRow);
                saveRequirementControlValue(controlId, rows);
                renderRequirementControl(controlId);
                if (controlId === 'quantityScheduleRows') {
                    renderRequirementControl('productSpecificationTemplate');
                    renderRequirementControl('sampleRequirementRows');
                }
                return;
            }

            if (control.type === 'cards') {
                const row = target.closest('[data-requirement-card-row]');
                const cards = normalizeCreateTenderRequirementObjectRows(getRequirementControlValue(controlId), control.fields || [], controlId)
                    .filter(item => item.id !== row?.dataset.requirementCardRow);
                saveRequirementControlValue(controlId, cards);
                renderRequirementControl(controlId);
            }
            return;
        }

        if (target.matches('[data-requirement-add]')) {
            const listId = target.dataset.requirementAdd;
            const items = getRequirementListItems(listId);
            const profile = getSelectedProfile();
            const requirementDraft = getCreateTenderRequirementDraft(profile.id);
            requirementDraft.lists = {
                ...(requirementDraft.lists || {}),
                [listId]: [
                    ...items,
                    normalizeCreateTenderRequirementItem({ id: `requirement-${listId}-${Date.now()}`, text: '' }, items.length)
                ]
            };
            saveCreateTenderRequirementDraft(profile.id, requirementDraft);
            renderRequirementList(listId);
            wizard.querySelector(`[data-requirement-list-items="${CSS.escape(listId)}"] [data-requirement-row]:last-child [data-requirement-list-input]`)?.focus();
            return;
        }

        if (target.matches('[data-requirement-delete]')) {
            const row = target.closest('[data-requirement-row]');
            const listId = row?.dataset.requirementList;
            if (!listId) return;
            saveRequirementListItems(listId, getRequirementListItems(listId).filter(item => item.id !== row.dataset.requirementRow));
            renderRequirementList(listId);
            return;
        }

        if (target.matches('[data-license-add]')) {
            setLicenseAddPickerOpen(true);
            renderLicenseAddResults('');
            const addSearch = wizard.querySelector('[data-license-add-search]');
            if (addSearch) {
                addSearch.value = '';
                addSearch.focus();
            }
            return;
        }

        if (target.matches('[data-license-delete]')) {
            const row = target.closest('[data-license-row]');
            const profile = getSelectedProfile();
            const items = getCreateTenderRegulatoryLicenses(profile).filter(item => item.id !== row?.dataset.licenseRow);
            saveCreateTenderRegulatoryLicenses(items, profile);
            renderLicenseList();
            refreshScopeSummary();
            refreshTenderReview();
        }
    });

    wizard.querySelector('[data-boq-file]')?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const profile = getSelectedProfile();
            if (pendingProductSpecImportControlId) {
                const controlId = pendingProductSpecImportControlId;
                const importedTemplate = parseProductSpecTemplateCsv(String(reader.result || ''));
                if (!importedTemplate || !importedTemplate.rows.length) {
                    alert('No valid product specification rows found. Use the downloaded CSV template for this table.');
                    event.target.value = '';
                    pendingProductSpecImportControlId = '';
                    return;
                }
                saveProductSpecTemplateValue(controlId, importedTemplate);
                renderRequirementControl(controlId);
                event.target.value = '';
                pendingProductSpecImportControlId = '';
                return;
            }

            if (pendingRequirementImportControlId) {
                const controlId = pendingRequirementImportControlId;
                const importedRows = parseRequirementTableDelimitedText(controlId, String(reader.result || ''));
                if (!importedRows.length) {
                    alert('No valid rows found. Use the downloaded template for this table.');
                    event.target.value = '';
                    pendingRequirementImportControlId = '';
                    return;
                }

                saveRequirementControlValue(controlId, importedRows);
                renderRequirementControl(controlId);
                if (controlId === 'quantityScheduleRows') {
                    renderRequirementControl('productSpecificationTemplate');
                    renderRequirementControl('sampleRequirementRows');
                }
                event.target.value = '';
                pendingRequirementImportControlId = '';
                return;
            }

            const importedItems = parseBoqDelimitedText(String(reader.result || ''));
            if (!importedItems.length) {
                alert(`No valid rows found. ${profile.importHint}`);
                event.target.value = '';
                return;
            }

            saveCreateTenderBoqItems(importedItems, profile);
            renderBoqTable();
            event.target.value = '';
        };
        reader.readAsText(file);
    });

    categorySearchInput?.addEventListener('focus', () => {
        renderCategoryResults(categorySearchInput.value);
    });

    categorySearchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setCategoryResultsOpen(false);
        }
    });

    customCategoryInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addSelectedCategory(customCategoryInput.value);
        }
    });

    categoryPicker?.addEventListener('focusout', (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setCategoryResultsOpen(false);
        }
    });

    inviteSearchInput?.addEventListener('focus', () => {
        renderInviteResults(inviteSearchInput.value);
    });

    inviteSearchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setInviteResultsOpen(false);
        }
    });

    wizard.querySelector('.invite-picker')?.addEventListener('focusout', (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setInviteResultsOpen(false);
        }
    });

    wizard.querySelector('[data-license-add-picker]')?.addEventListener('focusout', (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setLicenseAddPickerOpen(false);
        }
    });

    wizard.querySelector('[data-license-add-search]')?.addEventListener('focus', (event) => {
        renderLicenseAddResults(event.target.value);
    });

    wizard.querySelector('[data-license-add-search]')?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setLicenseAddPickerOpen(false);
        }
    });

    wizard.addEventListener('focusin', (event) => {
        if (event.target?.matches('[data-license-search]')) {
            const row = event.target.closest('[data-license-row]');
            renderLicenseResults(row, event.target.value);
        }
    });

    wizard.addEventListener('focusout', (event) => {
        const row = event.target?.closest?.('[data-license-row]');
        if (row && !row.contains(event.relatedTarget)) {
            setLicensePickerOpen(row, false);
        }
    });

    renderSelectedCategories(getCreateTenderSelectedCategories(getCreateTenderMainDraft()));
    refreshContactSummary();
    refreshBoqSummary();
    refreshMilestoneSummary();
    refreshScopeSummary();
    refreshProfileText();
    syncTenderMethod();
    syncCustomCategoryField();
    syncFundingSourceCustomField();
    refreshTenderReview();
    setActiveStep(0);
    wizard.dataset.ready = 'true';

    document.querySelector('[data-save-tender-draft]')?.addEventListener('click', () => {
        const draft = saveCreateTenderDraftFromWizard(wizard);
        window.addProcurexCommunicationItem?.({
            kind: 'notification',
            category: 'System Notification',
            subject: 'Tender Draft Saved',
            body: `Tender draft ${draft.title || 'Untitled tender'} was saved and can be resumed from your dashboard.`,
            senderType: 'System',
            senderName: 'ProcureX System',
            recipientType: 'Buyer',
            recipientName: mockData.users?.buyer?.organization || 'Buyer organization',
            tenderId: draft.id || 'Draft tender',
            tenderReference: draft.id || 'Draft tender',
            tenderTitle: draft.title || 'Untitled tender',
            priority: 'Low',
            status: 'Unread',
            read: false,
            actionLabel: 'Open Draft',
            actionPage: 'create-tender',
            audience: ['buyer', 'all']
        });
        alert('Tender saved as draft.');
        window.app?.navigateTo('procurement-dashboard');
    });
}

if (window.app) {
    window.app.renderCreateTender = renderCreateTender;
}

window.initializeCreateTenderWizard = initializeCreateTenderWizard;
window.getCreateTenderTypeProfile = getCreateTenderTypeProfile;
