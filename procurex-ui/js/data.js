// Mock data for the ProcureX application

const mockProductSpecificationStructuralColumns = [
    { id: 'itemNo', label: 'Item No.', required: true, locked: true, instructions: 'Buyer item number from the quantity schedule.' },
    { id: 'productName', label: 'Product Name', required: true, locked: true, instructions: 'Buyer product name from the quantity schedule.' },
    { id: 'quantity', label: 'Quantity', required: true, locked: true, instructions: 'Buyer required quantity from the quantity schedule.' }
];

const mockProductSpecificationDetailColumns = [
    ...mockProductSpecificationStructuralColumns,
    { id: 'specificationName', label: 'Specification', required: true, locked: false, instructions: 'Item-specific requirement.' },
    { id: 'acceptableRequirement', label: 'Specific Detail Required', required: false, locked: false, instructions: 'Optional buyer detail for this item specification.' }
];

function createMockProductSpecificationTemplate(customColumns = [], rows = [], options = {}) {
    return {
        allowSupplierComments: options.allowSupplierComments !== false,
        columns: mockProductSpecificationDetailColumns,
        rows: rows.flatMap((values, index) => customColumns
            .filter(column => String(values[column.id] || '').trim())
            .map(column => ({
                id: `product-spec-quantity-row-${index}-${column.id}`,
                sourceRowId: `quantity-row-${index}`,
                values: {
                    itemNo: String(index + 1),
                    productName: values.productName,
                    quantity: values.quantity,
                    specificationName: column.label,
                    acceptableRequirement: values[column.id]
                }
            })))
    };
}

const procurexSeedOwnerProfiles = {
    company: {
        userId: 'usr-company-kilimanjaro',
        email: 'company@procurex.test',
        displayName: 'Kilimanjaro Supplies Limited',
        organization: 'Kilimanjaro Supplies Limited',
        entityType: 'company',
        canCreateTender: true
    },
    business: {
        userId: 'usr-business-zahra',
        email: 'business@procurex.test',
        displayName: 'Zahra Omari Business Services',
        organization: 'Zahra Omari Business Services',
        entityType: 'business',
        canCreateTender: true
    },
    individual: {
        userId: 'usr-individual-asha',
        email: 'individual@procurex.test',
        displayName: 'Asha Mwinyi',
        organization: 'Asha Mwinyi',
        entityType: 'individual',
        canCreateTender: false
    },
    legacyCompany: {
        userId: 'usr-company-legacy',
        email: 'user@company.tz',
        displayName: 'Kilimanjaro Supplies Limited',
        organization: 'Kilimanjaro Supplies Limited',
        entityType: 'company',
        canCreateTender: true
    }
};

const procurexSeedTenderOwnerMap = {
    'PX-WRK-2026-001': procurexSeedOwnerProfiles.company,
    'PX-WRK-2026-002': procurexSeedOwnerProfiles.company,
    'PX-GDS-2026-002': procurexSeedOwnerProfiles.business,
    'PX-SVC-2026-003': procurexSeedOwnerProfiles.business,
    'PX-CNS-2026-001': procurexSeedOwnerProfiles.legacyCompany
};

function getProcurexCurrentAccount() {
    const email = String(mockData.session?.email || mockData.pendingAccount?.email || '').toLowerCase();
    const account = (mockData.mockAuth?.accounts || []).find(item => String(item.email || '').toLowerCase() === email)
        || mockData.pendingAccount
        || (mockData.mockAuth?.accounts || []).find(item => item.accountType !== 'admin' && item.ekycCompleted)
        || {};
    return {
        ...account,
        userId: account.userId || (account.email ? `usr-${String(account.email).replace(/[^a-z0-9]/gi, '-').toLowerCase()}` : ''),
        entityType: account.entityType || 'company',
        organization: account.organization || account.displayName || account.email || '',
        canCreateTender: account.canCreateTender !== false && account.entityType !== 'individual'
    };
}

function getProcurexCurrentOwnerId() {
    const account = getProcurexCurrentAccount();
    return account.userId || account.email || '';
}

function getProcurexOwnerProfileForTender(tender = {}) {
    const key = tender.id || tender.reference || '';
    return tender.ownerId || tender.ownerEmail
        ? {
            userId: tender.ownerId || '',
            email: tender.ownerEmail || '',
            displayName: tender.ownerName || tender.organization || '',
            organization: tender.ownerOrganization || tender.organization || '',
            entityType: tender.ownerEntityType || ''
        }
        : (procurexSeedTenderOwnerMap[key] || null);
}

function stampProcurexOwnership(target = {}, owner = getProcurexCurrentAccount(), prefix = 'owner') {
    return {
        ...target,
        [`${prefix}Id`]: owner.userId || owner.email || '',
        [`${prefix}Email`]: owner.email || '',
        [`${prefix}Name`]: owner.displayName || owner.organization || owner.email || '',
        [`${prefix}Organization`]: owner.organization || owner.displayName || owner.email || '',
        [`${prefix}EntityType`]: owner.entityType || 'company'
    };
}

function normalizeProcurexTenderOwnership(tender = {}) {
    const seedOwner = getProcurexOwnerProfileForTender(tender);
    const ownerId = tender.ownerId || seedOwner?.userId || '';
    const ownerEmail = tender.ownerEmail || seedOwner?.email || '';
    const ownerName = tender.ownerName || seedOwner?.displayName || tender.organization || '';
    const ownerOrganization = tender.ownerOrganization || seedOwner?.organization || tender.organization || '';
    return {
        ...tender,
        organization: ownerOrganization || tender.organization || '',
        ownerId,
        ownerEmail,
        ownerName,
        ownerOrganization,
        ownerEntityType: tender.ownerEntityType || seedOwner?.entityType || '',
        createdByCurrentUser: Boolean(
            ownerId && ownerId === getProcurexCurrentOwnerId()
            || ownerEmail && ownerEmail.toLowerCase() === String(getProcurexCurrentAccount().email || '').toLowerCase()
            || tender.createdByCurrentUser === true && !ownerId && !ownerEmail
        )
    };
}

function isProcurexTenderOwnedByCurrentUser(tender = {}) {
    return normalizeProcurexTenderOwnership(tender).createdByCurrentUser === true;
}

function isProcurexBidOwnedByCurrentUser(bid = {}) {
    const account = getProcurexCurrentAccount();
    const ownerId = bid.supplierOwnerId || bid.ownerId || bid.userId || '';
    const ownerEmail = String(bid.supplierEmail || bid.ownerEmail || bid.email || '').toLowerCase();
    if (ownerId) return ownerId === getProcurexCurrentOwnerId();
    if (ownerEmail) return ownerEmail === String(account.email || '').toLowerCase();
    const supplier = String(bid.supplier || bid.draft?.supplier || bid.draft?.supplierName || '').toLowerCase();
    return Boolean(supplier && [account.organization, account.displayName, mockData.users?.supplier?.organization].filter(Boolean).map(value => String(value).toLowerCase()).includes(supplier));
}

function readProcurexStoredObject(key, fallback = null) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return parsed === null ? fallback : parsed;
    } catch (error) {
        return fallback;
    }
}

function getProcurexMyTenderRows() {
    const tenders = (typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : (mockData.tenders || []))
        .map(normalizeProcurexTenderOwnership)
        .filter(isProcurexTenderOwnedByCurrentUser);
    const draft = readProcurexStoredObject('procurex.createTender.v2.savedDraft', null);
    const draftOwnerId = draft?.ownerId || '';
    const draftOwnerEmail = String(draft?.ownerEmail || '').toLowerCase();
    const currentEmail = String(getProcurexCurrentAccount().email || '').toLowerCase();
    const rows = tenders.map(tender => ({
        id: tender.id || tender.reference,
        tender,
        title: tender.title || 'Tender',
        type: tender.type || tender.procurementTypeId || 'Tender',
        status: tender.status || 'Published',
        section: /closed|completed|cancelled|awarded/i.test(tender.status || '') ? 'completed' : 'posted',
        lastActivity: tender.publishedAt || tender.createdAt || tender.closingDate || '',
        actionLabel: 'View My Tender',
        nav: 'tender-details'
    }));
    if (draft && Object.keys(draft).length && (!draftOwnerId && !draftOwnerEmail || draftOwnerId === getProcurexCurrentOwnerId() || draftOwnerEmail === currentEmail)) {
        rows.unshift({
            id: 'current-tender-draft',
            tender: draft,
            title: draft.title || draft.mainDetails?.title || 'Tender creation draft',
            type: draft.type || draft.procurementTypeId || 'Tender draft',
            status: draft.status || 'Saved as draft',
            section: 'draft',
            lastActivity: draft.savedAt || '',
            actionLabel: 'Continue Draft',
            nav: 'create-tender'
        });
    }
    return rows.sort((a, b) => Date.parse(b.lastActivity || 0) - Date.parse(a.lastActivity || 0));
}

function getProcurexMyBidRows() {
    const tenders = typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : (mockData.tenders || []);
    const rows = [];
    const draftPrefix = 'procurex.supplierBidDraft.v1.';
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(draftPrefix)) continue;
        const draft = readProcurexStoredObject(key, null);
        if (!draft || !Object.keys(draft).length || !isProcurexBidOwnedByCurrentUser(draft)) continue;
        const tenderId = key.slice(draftPrefix.length);
        const tender = tenders.find(item => String(item.id || item.reference) === String(tenderId)) || {};
        rows.push({
            id: `bid-draft-${tenderId}`,
            tenderId,
            tender,
            bid: draft,
            title: tender.title || draft.title || 'Bid draft',
            status: 'Draft',
            section: 'draft',
            lastActivity: draft.savedAt || '',
            amount: draft.total || '',
            actionLabel: 'Continue Bid',
            nav: 'bidding-workspace'
        });
    }
    ['procurex.bidWorkspaceSubmitted.v1', 'procurex.supplierSubmittedBids.v1'].forEach(key => {
        const submitted = readProcurexStoredObject(key, []);
        (Array.isArray(submitted) ? submitted : []).forEach((bid, index) => {
            if (!isProcurexBidOwnedByCurrentUser(bid)) return;
            const tender = tenders.find(item => String(item.id || item.reference) === String(bid.tenderId || '')) || {};
            rows.push({
                id: `submitted-bid-${bid.tenderId || index}`,
                tenderId: bid.tenderId,
                tender,
                bid,
                title: tender.title || bid.tenderTitle || bid.tenderId || 'Submitted bid',
                status: 'Submitted',
                section: 'submitted',
                lastActivity: bid.submittedAt || '',
                amount: bid.draft?.total || bid.total || '',
                receiptHash: bid.receiptHash || '',
                actionLabel: 'View Receipt',
                nav: 'bidding-workspace'
            });
        });
    });
    return rows.sort((a, b) => Date.parse(b.lastActivity || 0) - Date.parse(a.lastActivity || 0));
}

if (typeof window !== 'undefined') {
    window.getProcurexCurrentAccount = getProcurexCurrentAccount;
    window.getProcurexCurrentOwnerId = getProcurexCurrentOwnerId;
    window.stampProcurexOwnership = stampProcurexOwnership;
    window.normalizeProcurexTenderOwnership = normalizeProcurexTenderOwnership;
    window.isProcurexTenderOwnedByCurrentUser = isProcurexTenderOwnedByCurrentUser;
    window.isProcurexBidOwnedByCurrentUser = isProcurexBidOwnedByCurrentUser;
    window.getProcurexMyTenderRows = getProcurexMyTenderRows;
    window.getProcurexMyBidRows = getProcurexMyBidRows;
}

const mockData = {
    // One company account can create tenders, bid, evaluate its tenders, and award. Admin is a separate platform compliance account.
    accountTypes: ['user', 'admin'],
    registrationDraft: {
        email: '',
        phone: ''
    },
    pendingAccount: null,
    session: {
        isAuthenticated: false,
        isNewUser: true,
        email: null,
        accountType: 'user'
    },
    eKycProfile: {
        status: 'not_started',
        role: null
    },
    eKycRegistryRecord: null,
    mockAuth: {
        signupExample: {
            email: 'newuser@procurex.test',
            phone: '+255 712 345 678',
            password: 'Newuser1!'
        },
        accounts: [
            {
                email: 'newuser@procurex.test',
                phone: '+255 712 345 678',
                password: 'Newuser1!',
                userId: 'usr-new-demo',
                role: null,
                accountType: 'new user',
                entityType: 'individual',
                isNewUser: true,
                ekycCompleted: false,
                canCreateTender: false,
                displayName: 'New User Account'
            },
            {
                email: 'company@procurex.test',
                phone: '+255 713 111 222',
                password: 'Procure1!',
                userId: 'usr-company-kilimanjaro',
                role: null,
                accountType: 'user',
                entityType: 'company',
                isNewUser: false,
                ekycCompleted: true,
                canCreateTender: true,
                displayName: 'Kilimanjaro Supplies Limited',
                organization: 'Kilimanjaro Supplies Limited'
            },
            {
                email: 'business@procurex.test',
                phone: '+255 714 222 333',
                password: 'Procure1!',
                userId: 'usr-business-zahra',
                role: null,
                accountType: 'user',
                entityType: 'business',
                isNewUser: false,
                ekycCompleted: true,
                canCreateTender: true,
                displayName: 'Zahra Omari Business Services',
                organization: 'Zahra Omari Business Services'
            },
            {
                email: 'individual@procurex.test',
                phone: '+255 714 333 444',
                password: 'Procure1!',
                userId: 'usr-individual-asha',
                role: null,
                accountType: 'user',
                entityType: 'individual',
                isNewUser: false,
                ekycCompleted: true,
                canCreateTender: false,
                displayName: 'Asha Mwinyi',
                organization: 'Asha Mwinyi'
            },
            {
                email: 'user@company.tz',
                phone: '+255 713 111 222',
                password: 'Procure1!',
                userId: 'usr-company-legacy',
                role: null,
                accountType: 'user',
                entityType: 'company',
                isNewUser: false,
                ekycCompleted: true,
                canCreateTender: true,
                displayName: 'Kilimanjaro Supplies Limited',
                organization: 'Kilimanjaro Supplies Limited'
            },
            {
                email: 'admin@procurex.tz',
                phone: '+255 715 555 666',
                password: 'Admin123!',
                userId: 'usr-admin-platform',
                role: 'admin',
                accountType: 'admin',
                entityType: 'admin',
                isNewUser: false,
                ekycCompleted: true,
                canCreateTender: false,
                displayName: 'Admin User'
            }
        ]
    },

    // User data
    users: {
        buyer: {
            name: 'John Doe',
            organization: 'Ministry of Health',
            trustTier: 'Gold',
            riskScore: 85,
            bidLimit: 5000000
        },
        current: {
            name: 'Kilimanjaro Supplies Limited',
            organization: 'Kilimanjaro Supplies Limited',
            trustTier: 'Verified',
            riskScore: 82,
            bidLimit: 5000000000
        },
        supplier: {
            name: 'ABC Construction Ltd',
            organization: 'ABC Construction Ltd',
            trustTier: 'Silver',
            riskScore: 78,
            bidLimit: 2000000
        },
        admin: {
            name: 'Platform Admin',
            organization: 'ProcureX Platform',
            permissions: ['admin:search', 'admin:users:read', 'admin:audit:read', 'admin:compliance:action', 'evaluation:read', 'compliance:review', 'compliance:approve', 'compliance:hold', 'compliance:flag', 'compliance:return', 'audit:read', 'reports:export']
        }
    },

    // Dashboard KPIs
    kpis: {
        admin: {
            activeUsers: 1247,
            pendingVerifications: 23,
            supportTickets: 8,
            systemUptime: 99.8
        },
        buyer: {
            activeTenders: 12,
            draftTenders: 5,
            approvalsNeeded: 3,
            totalSpend: 25000000
        },
        supplier: {
            matchedTenders: 8,
            bidsInProgress: 3,
            closing48h: 2,
            watchlist: 15
        }
    },

    // Tenders data
    tenders: [
        {
            id: 'PX-WRK-2026-001',
            title: 'Construction of District Maternal Health Wing',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 6850000000,
            closingDate: '2026-07-03',
            organization: 'Ministry of Health',
            description: 'Design review, construction, finishing, medical gas routing, and handover of a two-storey maternal health wing in Dodoma.',
            eligibility: 'Open Tender / Healthcare infrastructure / CRB Class I or II building contractor with OSHA compliance and audited accounts.',
            category: 'Healthcare infrastructure',
            categories: ['Healthcare infrastructure', 'Concrete and cement and plaster', 'Electrical equipment and components and supplies'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dodoma Regional Referral Hospital',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Architectural_Drawings.pdf', 'Structural_Drawings.pdf', 'Priced_BOQ_Template.xlsx', 'Site_Report.pdf', 'Conditions_of_Contract.pdf'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'Contractors Registration Board (CRB) and Local Government Authorities', mandatory: true },
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)', mandatory: true },
                { group: 'Environmental and Safety', license: 'Environmental Compliance Certificate', body: 'National Environment Management Council (NEMC)', mandatory: true }
            ],
            requirements: {
                fields: {
                    projectName: 'District Maternal Health Wing',
                    procuringEntity: 'Ministry of Health',
                    location: 'Dodoma Regional Referral Hospital',
                    contractType: 'Unit Price Contract',
                    completionPeriod: '14 months from site possession',
                    fundingSource: 'Government of Tanzania',
                    scopeSummary: 'Construction of a two-storey maternal health wing including foundations, structural frame, roofing, finishes, plumbing, electrical works, fire safety, medical gas containment routing, external drainage, access ramps, and defects liability support.',
                    mainConstructionActivities: [
                        { text: 'Site establishment and hoarding' },
                        { text: 'Foundation and reinforced concrete frame' },
                        { text: 'Mechanical, electrical, and plumbing installations' },
                        { text: 'Medical gas containment routing and plant room preparation' },
                        { text: 'External works, drainage, and handover testing' }
                    ],
                    technicalSpecificationDocuments: [
                        { documentTitle: 'Applicable standards / codes', documentUpload: 'Building_Standards.pdf', mandatory: true },
                        { documentTitle: 'Material specifications', documentUpload: 'Materials_Schedule.pdf', mandatory: true },
                        { documentTitle: 'Workmanship standards', documentUpload: 'Workmanship_Requirements.pdf', mandatory: true }
                    ],
                    drawingDesignRows: [
                        { documentType: 'Architectural drawings', buyerDocumentUpload: 'Architectural_Set.pdf' },
                        { documentType: 'Structural drawings', buyerDocumentUpload: 'Structural_Set.pdf' },
                        { documentType: 'Electrical drawings', buyerDocumentUpload: 'Electrical_Set.pdf' },
                        { documentType: 'Mechanical drawings', buyerDocumentUpload: 'Mechanical_Set.pdf' }
                    ],
                    boqRows: [
                        { workItem: 'Substructure and foundation works', quantity: 1, unit: 'Lot', laborCost: 220000000, materialCost: 780000000, equipmentCost: 120000000, totalCost: 1120000000, mandatory: true },
                        { workItem: 'Superstructure concrete frame and blockwork', quantity: 1, unit: 'Lot', laborCost: 380000000, materialCost: 1450000000, equipmentCost: 240000000, totalCost: 2070000000, mandatory: true },
                        { workItem: 'MEP installation and fire safety systems', quantity: 1, unit: 'Lot', laborCost: 310000000, materialCost: 1030000000, equipmentCost: 160000000, totalCost: 1500000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Foundation complete', targetDate: '2026-10-15', liquidatedDamagesTrigger: false },
                        { milestone: 'Roofing complete', targetDate: '2027-02-20', liquidatedDamagesTrigger: true },
                        { milestone: 'Practical completion', targetDate: '2027-08-30', liquidatedDamagesTrigger: true }
                    ],
                    siteVisitRequirement: 'Mandatory',
                    similarCompletedProjectsRequired: true,
                    keyPersonnelCvsRequired: true,
                    personnelRequirementRows: [
                        { position: 'Project Manager', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 8, cvRequired: true, mandatory: true },
                        { position: 'Site Engineer', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 6, cvRequired: true, mandatory: true },
                        { position: 'Health and Safety Officer', minimumEducation: 'Diploma', minimumYearsExperience: 5, cvRequired: true, mandatory: true }
                    ],
                    bankStatementsRequired: true,
                    bankStatementPeriod: 'Submit bank statements covering the last 12 months plus audited financial statements for the last 3 years.'
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Confirm acceptance of defects liability and retention provisions.' }
                    ],
                    safetyRequirements: [
                        { text: 'Submit site-specific health and safety plan.' },
                        { text: 'Provide emergency response and incident reporting procedure.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Technical capacity', weight: 30, subcriteria: ['Construction methodology', 'Plant and equipment', 'Quality assurance'] },
                    { name: 'Relevant experience', weight: 25, subcriteria: ['Hospital projects', 'Projects above TZS 3B', 'Completion references'] },
                    { name: 'Financial proposal', weight: 25, subcriteria: ['BOQ completeness', 'Price realism', 'Cashflow reasonableness'] },
                    { name: 'Delivery schedule', weight: 10, subcriteria: ['Milestone feasibility', 'Critical path'] },
                    { name: 'Compliance and ESG', weight: 10, subcriteria: ['OSHA', 'NEMC', 'Local labor plan'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-18' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-19' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-03' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-06' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-24' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-07' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Substructure and foundation works', qty: 1, unit: 'Lot', rate: 1120000000 },
                { item: '2.1', description: 'Superstructure concrete frame and blockwork', qty: 1, unit: 'Lot', rate: 2070000000 },
                { item: '3.1', description: 'MEP installation and fire safety systems', qty: 1, unit: 'Lot', rate: 1500000000 },
                { item: '4.1', description: 'Finishes, external works, testing, and handover', qty: 1, unit: 'Lot', rate: 2160000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Substructure and foundation works', qty: 1, unit: 'Lot', rate: 1120000000 },
                { item: '2.1', description: 'Superstructure concrete frame and blockwork', qty: 1, unit: 'Lot', rate: 2070000000 },
                { item: '3.1', description: 'MEP installation and fire safety systems', qty: 1, unit: 'Lot', rate: 1500000000 },
                { item: '4.1', description: 'Finishes, external works, testing, and handover', qty: 1, unit: 'Lot', rate: 2160000000 }
            ],
            deliverables: ['Completed maternal health wing', 'As-built drawings', 'Commissioning certificates', 'Defects liability support plan'],
            clarifications: [{ title: 'Site visit window', question: 'Mandatory site visit is scheduled for June 3 and June 4, 2026.', status: 'Published notice' }],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Amendment log is open for design or BOQ updates.' }],
            interestedSuppliers: [
                { name: 'ABC Construction Ltd', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'Prime Contractors Tanzania', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-WRK-2026-002',
            title: 'Rehabilitation of Rural Water Supply Network',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 3420000000,
            closingDate: '2026-06-26',
            organization: 'Rural Water Supply and Sanitation Agency',
            description: 'Rehabilitation of boreholes, pumping stations, elevated tanks, distribution lines, chambers, and water kiosks across 12 villages in Singida.',
            eligibility: 'Open Tender / Water infrastructure / CRB civil works registration with EWURA water sector experience.',
            category: 'Water Pumps and Spare Parts',
            categories: ['Water Pumps and Spare Parts', 'Water and Sewer Treatment Equipment and consumables', 'Concrete and cement and plaster'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Ikungi and Manyoni districts, Singida',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Hydraulic_Assessment.pdf', 'Water_Network_Drawings.pdf', 'BOQ_Water_Rehab.xlsx', 'Safeguards_Plan.pdf'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'Contractors Registration Board (CRB) and Local Government Authorities', mandatory: true },
                { group: 'Energy and Water (EWURA)', license: 'Water Supply and Sanitation Services License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)', mandatory: false },
                { group: 'Environmental and Safety', license: 'Environmental Compliance Certificate', body: 'National Environment Management Council (NEMC)', mandatory: true }
            ],
            requirements: {
                fields: {
                    projectName: 'Rural Water Supply Network Rehabilitation',
                    procuringEntity: 'Rural Water Supply and Sanitation Agency',
                    location: 'Singida region',
                    contractType: 'Unit Price Contract',
                    completionPeriod: '10 months',
                    fundingSource: 'Development partner grant',
                    scopeSummary: 'Rehabilitate water production and distribution assets, replace damaged pumps and pipe sections, construct valve chambers, test water quality, and train village water committees.',
                    mainConstructionActivities: [
                        { text: 'Borehole pump replacement and electrical rehabilitation' },
                        { text: 'Pipeline trenching, laying, pressure testing, and reinstatement' },
                        { text: 'Elevated tank repairs and chamber construction' },
                        { text: 'Water kiosk repairs and metering installation' }
                    ],
                    technicalSpecificationDocuments: [
                        { documentTitle: 'Engineering requirements', documentUpload: 'Hydraulic_Design_Requirements.pdf', mandatory: true },
                        { documentTitle: 'Material specifications', documentUpload: 'Pipe_Pump_Material_Specs.pdf', mandatory: true }
                    ],
                    drawingDesignRows: [
                        { documentType: 'Mechanical drawings', buyerDocumentUpload: 'Pump_Station_Details.pdf' },
                        { documentType: 'Other', otherDocumentName: 'Distribution line maps', buyerDocumentUpload: 'Distribution_Maps.pdf' }
                    ],
                    boqRows: [
                        { workItem: 'Submersible pump supply and installation', quantity: 12, unit: 'Set', laborCost: 60000000, materialCost: 840000000, equipmentCost: 90000000, totalCost: 990000000, mandatory: true },
                        { workItem: 'HDPE pipeline replacement', quantity: 48, unit: 'Km', laborCost: 380000000, materialCost: 980000000, equipmentCost: 210000000, totalCost: 1570000000, mandatory: true },
                        { workItem: 'Tank, chamber, and kiosk repairs', quantity: 1, unit: 'Lot', laborCost: 190000000, materialCost: 410000000, equipmentCost: 90000000, totalCost: 690000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Pump station works complete', targetDate: '2026-10-10', liquidatedDamagesTrigger: true },
                        { milestone: 'Distribution pressure testing complete', targetDate: '2027-01-20', liquidatedDamagesTrigger: true },
                        { milestone: 'Community training complete', targetDate: '2027-03-30', liquidatedDamagesTrigger: false }
                    ],
                    siteVisitRequirement: 'Mandatory',
                    similarCompletedProjectsRequired: true,
                    keyPersonnelCvsRequired: true,
                    personnelRequirementRows: [
                        { position: 'Project Manager', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 7, cvRequired: true, mandatory: true },
                        { position: 'Water Works Engineer', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 6, cvRequired: true, mandatory: true },
                        { position: 'Pump Installation Technician', minimumEducation: 'Professional Qualification', minimumYearsExperience: 4, cvRequired: true, mandatory: true }
                    ],
                    bankStatementsRequired: true,
                    bankStatementPeriod: 'Six months of bank statements and evidence of access to credit of at least TZS 600,000,000.'
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Commit to water quality testing after rehabilitation.' },
                        { text: 'Provide traffic and community safety arrangements for trenching works.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Technical capacity', weight: 30, subcriteria: ['Water works methodology', 'Pump installation team', 'Testing plan'] },
                    { name: 'Relevant experience', weight: 25, subcriteria: ['Rural water projects', 'Pump station references'] },
                    { name: 'Financial proposal', weight: 25, subcriteria: ['BOQ pricing', 'Mobilization cashflow'] },
                    { name: 'Delivery schedule', weight: 10, subcriteria: ['Village sequencing', 'Dry season planning'] },
                    { name: 'Compliance and ESG', weight: 10, subcriteria: ['Environmental safeguards', 'Community engagement'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-20' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-12' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-26' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-29' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-17' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-31' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Submersible pump supply and installation', qty: 12, unit: 'Set', rate: 82500000 },
                { item: '2.1', description: 'HDPE pipeline replacement and testing', qty: 48, unit: 'Km', rate: 32708333 },
                { item: '3.1', description: 'Tank, chamber, and kiosk repairs', qty: 1, unit: 'Lot', rate: 690000000 },
                { item: '4.1', description: 'Training, commissioning, and water quality testing', qty: 1, unit: 'Lot', rate: 170000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Submersible pump supply and installation', qty: 12, unit: 'Set', rate: 82500000 },
                { item: '2.1', description: 'HDPE pipeline replacement and testing', qty: 48, unit: 'Km', rate: 32708333 },
                { item: '3.1', description: 'Tank, chamber, and kiosk repairs', qty: 1, unit: 'Lot', rate: 690000000 },
                { item: '4.1', description: 'Training, commissioning, and water quality testing', qty: 1, unit: 'Lot', rate: 170000000 }
            ],
            deliverables: ['Rehabilitated water production facilities', 'Pressure-tested distribution network', 'Water quality test reports', 'Community operator training'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Buyer can issue addenda for route maps or pump specifications.' }],
            interestedSuppliers: [
                { name: 'MajiWorks Engineering Ltd', status: 'Asked clarification', lastActivity: 'Today' },
                { name: 'ABC Construction Ltd', status: 'Watching tender', lastActivity: '2 days ago' }
            ]
        },
        {
            id: 'PX-WRK-2026-003',
            title: 'Solar Mini-Grid Civil Works and Distribution Network',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 4980000000,
            closingDate: '2026-07-17',
            organization: 'Rural Energy Agency',
            description: 'Civil works, mounting structures, distribution poles, service drops, earthing, control room construction, and commissioning support for three solar mini-grid sites.',
            eligibility: 'Invited Tender / Energy infrastructure / CRB contractor with solar or rural electrification project references.',
            category: 'Electrical equipment and components and supplies',
            categories: ['Electrical equipment and components and supplies', 'Concrete poles', 'Batteries and generators and kinetic power transmission'],
            method: 'Invited Tender',
            visibility: 'Invited suppliers only',
            visibilityNote: 'Visible to invited suppliers and buyer users.',
            invitedUsers: [
                { name: 'ABC Construction Ltd', organization: 'ABC Construction Ltd', email: 'supplier@abc.test' },
                { name: 'Kijiji Power Contractors', organization: 'Kijiji Power Contractors Ltd', email: 'bids@kijijipower.test' }
            ],
            location: 'Kigoma, Rukwa, and Katavi regions',
            commercialModel: 'BOQ',
            contractType: 'Lump Sum Contract',
            documents: ['Mini_Grid_Site_Layouts.pdf', 'Electrical_Single_Line_Diagrams.pdf', 'Lump_Sum_Pricing_Schedule.xlsx', 'EHS_Requirements.pdf'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'Contractors Registration Board (CRB) and Local Government Authorities', mandatory: true },
                { group: 'Energy and Water (EWURA)', license: 'Electricity Distribution and Supply License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)', mandatory: false },
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)', mandatory: true }
            ],
            requirements: {
                fields: {
                    projectName: 'Solar Mini-Grid Civil Works and Distribution Network',
                    procuringEntity: 'Rural Energy Agency',
                    location: 'Western Tanzania cluster',
                    contractType: 'Lump Sum Contract',
                    completionPeriod: '8 months',
                    fundingSource: 'Renewable energy fund',
                    scopeSummary: 'Construct mini-grid control rooms, equipment plinths, fencing, pole foundations, LV distribution lines, customer service drops, earthing, lightning protection, and handover support.',
                    mainConstructionActivities: [
                        { text: 'Site clearing and control room construction' },
                        { text: 'PV mounting foundation and equipment plinths' },
                        { text: 'Pole erection and low voltage distribution network' },
                        { text: 'Earthing, lightning protection, and commissioning support' }
                    ],
                    technicalSpecificationDocuments: [
                        { documentTitle: 'Engineering requirements', documentUpload: 'Mini_Grid_Civil_Electrical_Interface.pdf', mandatory: true },
                        { documentTitle: 'Equipment requirements', documentUpload: 'Pole_Mounting_Earthing_Spec.pdf', mandatory: true }
                    ],
                    lumpSumPricingRows: [
                        { section: 'Site A works', description: 'Civil works and distribution network for Site A', amount: 1620000000, mandatory: true },
                        { section: 'Site B works', description: 'Civil works and distribution network for Site B', amount: 1710000000, mandatory: true },
                        { section: 'Site C works', description: 'Civil works and distribution network for Site C', amount: 1650000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Control rooms complete', targetDate: '2026-10-30', liquidatedDamagesTrigger: true },
                        { milestone: 'Distribution network complete', targetDate: '2027-01-15', liquidatedDamagesTrigger: true },
                        { milestone: 'Commissioning support complete', targetDate: '2027-03-12', liquidatedDamagesTrigger: false }
                    ],
                    siteVisitRequirement: 'Mandatory',
                    similarCompletedProjectsRequired: true,
                    keyPersonnelCvsRequired: true,
                    personnelRequirementRows: [
                        { position: 'Project Manager', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 7, cvRequired: true, mandatory: true },
                        { position: 'Electrical Supervisor', minimumEducation: 'Professional Qualification', minimumYearsExperience: 6, cvRequired: true, mandatory: true },
                        { position: 'Site Safety Officer', minimumEducation: 'Diploma', minimumYearsExperience: 4, cvRequired: true, mandatory: true }
                    ],
                    bankStatementsRequired: false
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Confirm availability of certified electrical supervisor.' },
                        { text: 'Confirm acceptance of rural site logistics plan.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Technical capacity', weight: 30, subcriteria: ['Rural electrification method', 'Electrical safety', 'Equipment plan'] },
                    { name: 'Relevant experience', weight: 25, subcriteria: ['Solar mini-grid works', 'Remote logistics'] },
                    { name: 'Financial proposal', weight: 25, subcriteria: ['Lump sum completeness', 'Price realism'] },
                    { name: 'Delivery schedule', weight: 10, subcriteria: ['Parallel site mobilization'] },
                    { name: 'Compliance and ESG', weight: 10, subcriteria: ['Worker safety', 'Community liaison'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-25' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-07-01' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-17' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-20' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-08-07' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-21' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Site A civil and distribution works', qty: 1, unit: 'Lot', rate: 1620000000 },
                { item: '2.1', description: 'Site B civil and distribution works', qty: 1, unit: 'Lot', rate: 1710000000 },
                { item: '3.1', description: 'Site C civil and distribution works', qty: 1, unit: 'Lot', rate: 1650000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Site A civil and distribution works', qty: 1, unit: 'Lot', rate: 1620000000 },
                { item: '2.1', description: 'Site B civil and distribution works', qty: 1, unit: 'Lot', rate: 1710000000 },
                { item: '3.1', description: 'Site C civil and distribution works', qty: 1, unit: 'Lot', rate: 1650000000 }
            ],
            deliverables: ['Completed control rooms', 'Distribution network ready for energization', 'Earthing test records', 'Commissioning support report'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Buyer can issue addenda for site layout updates.' }],
            interestedSuppliers: [
                { name: 'Kijiji Power Contractors', status: 'Downloaded drawings', lastActivity: 'Today' },
                { name: 'ABC Construction Ltd', status: 'Watching tender', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-001',
            title: 'Supply and Installation of Digital X-Ray Systems',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 2380000000,
            closingDate: '2026-06-22',
            organization: 'Medical Stores Department',
            description: 'Supply, installation, commissioning, warranty, and user training for digital X-ray systems for six regional hospitals.',
            eligibility: 'Open Tender / Medical equipment / TMDA medical device registration and manufacturer authorization required.',
            category: 'Medical Equipment and Accessories',
            categories: ['Medical Equipment and Accessories', 'Emergency and field medical services products', 'Computer Equipment and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dar es Salaam, Mwanza, Arusha, Mbeya, Tabora, and Mtwara',
            commercialModel: 'Quantity Schedule',
            documents: ['Product_Specification_Template.csv', 'Quantity_Schedule.xlsx', 'Warranty_Terms.pdf', 'Installation_Requirements.pdf'],
            regulatoryLicenses: [
                { group: 'Food, Drugs and Cosmetics', license: 'Medical Devices Registration Permit', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)', mandatory: true },
                { group: 'Specialized Services', license: 'Calibration Certificate', body: 'Weights and Measures Agency (WMA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Digital X-ray system with flat panel detector', unitOfMeasure: 'Set', quantity: 6, unitPrice: 320000000, totalPrice: 1920000000, mandatory: true },
                        { itemDescription: 'Radiology workstation and diagnostic display', unitOfMeasure: 'Set', quantity: 6, unitPrice: 45000000, totalPrice: 270000000, mandatory: true },
                        { itemDescription: 'User training and commissioning kit', unitOfMeasure: 'Lot', quantity: 1, unitPrice: 190000000, totalPrice: 190000000, mandatory: true }
                    ],
                    productSpecificationTemplate: createMockProductSpecificationTemplate([
                        { id: 'requiredSpecification', label: 'Required Specification', required: true, locked: false, instructions: 'Minimum technical requirement suppliers must meet or exceed.' },
                        { id: 'brandEquivalent', label: 'Required Brand/Equivalent', required: false, locked: false, instructions: 'Accepted brand position or equivalent wording.' },
                        { id: 'standards', label: 'Standards/Certification', required: true, locked: false, instructions: 'Applicable registration, safety, or quality standard.' },
                        { id: 'warranty', label: 'Warranty', required: true, locked: false, instructions: 'Minimum warranty and service support.' },
                        { id: 'installationCommissioning', label: 'Installation/Commissioning', required: true, locked: false, instructions: 'Site installation, testing, training, and handover requirements.' }
                    ], [
                        {
                            productName: 'Digital X-ray system with flat panel detector',
                            quantity: 6,
                            requiredSpecification: 'Floor-mounted digital radiography unit with detector, generator, table, bucky stand, DICOM 3.0, and PACS/RIS integration.',
                            brandEquivalent: 'Brand-neutral or equivalent',
                            standards: 'TMDA registered medical device, ISO, CE',
                            warranty: 'Minimum 3 years comprehensive warranty with spare parts availability commitment.',
                            installationCommissioning: 'Installation, calibration, acceptance testing, radiation safety checks, and user training at each hospital.'
                        },
                        {
                            productName: 'Radiology workstation and diagnostic display',
                            quantity: 6,
                            requiredSpecification: 'Diagnostic workstation with licensed image viewing software, medical-grade display, DICOM viewer, and local storage.',
                            brandEquivalent: 'Brand-neutral or equivalent',
                            standards: 'CE and DICOM compatibility evidence',
                            warranty: 'Minimum 3 years warranty.',
                            installationCommissioning: 'Configured with hospital PACS where available and handed over with user orientation.'
                        },
                        {
                            productName: 'User training and commissioning kit',
                            quantity: 1,
                            requiredSpecification: 'Training materials, calibration records, acceptance forms, safety checklist, and commissioning consumables for all six sites.',
                            brandEquivalent: 'Not applicable',
                            standards: 'Radiation safety and manufacturer commissioning procedures',
                            warranty: 'Training and commissioning support included through warranty period.',
                            installationCommissioning: 'Complete commissioning report and signed training attendance sheets required.'
                        }
                    ]),
                    requireSamples: 'No',
                    otherEligibilityRequirements: [
                        { requirementName: 'Manufacturer authorization', mandatory: true, requiresUpload: true, notes: 'Authorization must name Tanzania and the tender title.' },
                        { requirementName: 'After-sales service plan', mandatory: true, requiresUpload: true, notes: 'Include local engineers, spare parts stock, and response times.' },
                        { requirementName: 'Radiation safety installation references', mandatory: true, requiresUpload: true, notes: 'Provide at least three completed installations.' }
                    ]
                },
                lists: {
                    warrantyObligations: [
                        { text: 'Provide preventive maintenance schedule for warranty period.' },
                        { text: 'Provide spare parts availability commitment for seven years.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Specification compliance', weight: 35, subcriteria: ['Detector performance', 'DICOM compatibility', 'Radiation safety'] },
                    { name: 'Delivery capacity', weight: 20, subcriteria: ['Installation schedule', 'Local support team'] },
                    { name: 'Financial proposal', weight: 30, subcriteria: ['Unit price', 'Lifecycle cost'] },
                    { name: 'After-sales support', weight: 10, subcriteria: ['Warranty', 'Spare parts'] },
                    { name: 'Compliance documents', weight: 5, subcriteria: ['TMDA permit', 'Authorization'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-18' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-08' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-22' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-23' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-10' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-24' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Digital X-ray system with flat panel detector', qty: 6, unit: 'Set', rate: 320000000 },
                { item: '1.2', description: 'Radiology workstation and diagnostic display', qty: 6, unit: 'Set', rate: 45000000 },
                { item: '1.3', description: 'Training, commissioning, and acceptance testing', qty: 1, unit: 'Lot', rate: 190000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Digital X-ray system with flat panel detector', qty: 6, unit: 'Set', rate: 320000000 },
                { item: '1.2', description: 'Radiology workstation and diagnostic display', qty: 6, unit: 'Set', rate: 45000000 },
                { item: '1.3', description: 'Training, commissioning, and acceptance testing', qty: 1, unit: 'Lot', rate: 190000000 }
            ],
            deliverables: ['Installed digital X-ray systems', 'Training certificates', 'Warranty certificates', 'Acceptance test reports'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Buyer can issue technical specification clarifications.' }],
            interestedSuppliers: [
                { name: 'AfyaMed Technologies', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'MedEquip Tanzania Ltd', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-GDS-2026-002',
            title: 'Supply of School Science Laboratory Equipment',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 875000000,
            closingDate: '2026-06-18',
            organization: 'President Office Regional Administration and Local Government',
            description: 'Framework supply of science laboratory benches, glassware, microscopes, safety cabinets, and basic chemistry kits for public secondary schools.',
            eligibility: 'Open Tender / Education supplies / Suppliers with education equipment experience, TBS-compliant products, and delivery capacity.',
            category: 'Developmental and professional teaching aids and materials and accessories and supplies',
            categories: ['Developmental and professional teaching aids and materials and accessories and supplies', 'Classroom and instructional furniture and accessories', 'Laboratory Equipment and Supplies'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Nationwide school delivery points',
            commercialModel: 'Quantity Schedule',
            documents: ['Product_Specification_Template.csv', 'Delivery_Lot_Schedule.xlsx', 'Sample_Submission_Form.pdf', 'Warranty_Form.pdf'],
            regulatoryLicenses: [
                { group: 'Specialized Services', license: 'Weights and Measures Inspection Certificate', body: 'Weights and Measures Agency (WMA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Student microscope, binocular', unitOfMeasure: 'Pcs', quantity: 500, unitPrice: 420000, totalPrice: 210000000, mandatory: true },
                        { itemDescription: 'Chemistry glassware starter kit', unitOfMeasure: 'Set', quantity: 250, unitPrice: 600000, totalPrice: 150000000, mandatory: true },
                        { itemDescription: 'Laboratory safety cabinet', unitOfMeasure: 'Pcs', quantity: 100, unitPrice: 2250000, totalPrice: 225000000, mandatory: true },
                        { itemDescription: 'Laboratory bench with chemical-resistant top', unitOfMeasure: 'Pcs', quantity: 200, unitPrice: 1450000, totalPrice: 290000000, mandatory: true }
                    ],
                    productSpecificationTemplate: createMockProductSpecificationTemplate([
                        { id: 'requiredSpecification', label: 'Required Specification', required: true, locked: false, instructions: 'Minimum item specification required by the buyer.' },
                        { id: 'standards', label: 'Standards/Certification', required: true, locked: false, instructions: 'Quality, safety, or conformity evidence required.' },
                        { id: 'warranty', label: 'Warranty', required: true, locked: false, instructions: 'Minimum warranty or replacement support.' },
                        { id: 'packagingDelivery', label: 'Packaging/Delivery', required: false, locked: false, instructions: 'Packaging and delivery requirements.' },
                        { id: 'sampleRequirement', label: 'Sample Requirement', required: false, locked: false, instructions: 'Whether a physical sample is required before award.' }
                    ], [
                        {
                            productName: 'Student microscope, binocular',
                            quantity: 500,
                            requiredSpecification: 'Durable binocular school microscope with achromatic objectives, mechanical stage, rechargeable LED light, and 40x to 1000x magnification.',
                            standards: 'ISO and TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty.',
                            packagingDelivery: 'Individual shock-resistant box suitable for regional school delivery.',
                            sampleRequirement: 'One fully functional microscope sample required.'
                        },
                        {
                            productName: 'Chemistry glassware starter kit',
                            quantity: 250,
                            requiredSpecification: 'Starter glassware kit for secondary school chemistry practicals with beakers, flasks, test tubes, measuring cylinders, and safety accessories.',
                            standards: 'TBS-compliant laboratory glassware',
                            warranty: 'Replacement of damaged or defective items on delivery.',
                            packagingDelivery: 'Packed per school kit with item checklist and breakage protection.',
                            sampleRequirement: 'One representative starter kit required.'
                        },
                        {
                            productName: 'Laboratory safety cabinet',
                            quantity: 100,
                            requiredSpecification: 'Lockable chemical storage cabinet for school laboratories with ventilation slots, corrosion-resistant shelves, and safety labelling.',
                            standards: 'TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty.',
                            packagingDelivery: 'Flat packed or assembled with protective packaging.',
                            sampleRequirement: 'Catalogue and technical drawing acceptable unless requested during evaluation.'
                        },
                        {
                            productName: 'Laboratory bench with chemical-resistant top',
                            quantity: 200,
                            requiredSpecification: 'Student laboratory bench with chemical-resistant worktop, sturdy frame, service-ready surface, and rounded safety edges.',
                            standards: 'TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty.',
                            packagingDelivery: 'Delivered with installation guidance and damage protection.',
                            sampleRequirement: 'Material swatch or catalogue required.'
                        }
                    ]),
                    requireSamples: 'Yes',
                    sampleRequirementRows: [
                        { relatedBoqItem: 'Student microscope, binocular', sampleRequired: true, numberOfSamples: 1, sampleDescription: 'One fully functional microscope sample.', deliveryLocation: 'Dar es Salaam PMU', deliveryDeadline: '2026-06-07', mandatory: true, returnableSample: true },
                        { relatedBoqItem: 'Chemistry glassware starter kit', sampleRequired: true, numberOfSamples: 1, sampleDescription: 'One representative starter kit.', deliveryLocation: 'Dar es Salaam PMU', deliveryDeadline: '2026-06-07', mandatory: true, returnableSample: false }
                    ],
                    otherEligibilityRequirements: [
                        { requirementName: 'Past supply contracts to schools', mandatory: true, requiresUpload: true, notes: 'At least two contracts completed within the last five years.' },
                        { requirementName: 'Delivery fleet or logistics partnership', mandatory: true, requiresUpload: true, notes: 'Provide delivery plan for all regions.' },
                        { requirementName: 'Product catalogues', mandatory: true, requiresUpload: true, notes: 'Catalogues must match offered items.' }
                    ]
                },
                lists: {
                    deliveryRequirements: [
                        { text: 'Deliver by region using buyer-approved delivery note format.' },
                        { text: 'Replace damaged items within 10 working days.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Specification compliance', weight: 35, subcriteria: ['Sample quality', 'TBS conformity', 'Durability'] },
                    { name: 'Delivery capacity', weight: 20, subcriteria: ['Regional logistics', 'Packaging'] },
                    { name: 'Financial proposal', weight: 30, subcriteria: ['Unit prices', 'Lot pricing'] },
                    { name: 'After-sales support', weight: 10, subcriteria: ['Replacement process', 'Warranty'] },
                    { name: 'Compliance documents', weight: 5, subcriteria: ['Registration', 'Tax clearance'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-19' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-04' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-18' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-19' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-03' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-17' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Student microscope, binocular', qty: 500, unit: 'Pcs', rate: 420000 },
                { item: '1.2', description: 'Chemistry glassware starter kit', qty: 250, unit: 'Set', rate: 600000 },
                { item: '1.3', description: 'Laboratory safety cabinet', qty: 100, unit: 'Pcs', rate: 2250000 },
                { item: '1.4', description: 'Laboratory bench with chemical-resistant top', qty: 200, unit: 'Pcs', rate: 1450000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Student microscope, binocular', qty: 500, unit: 'Pcs', rate: 420000 },
                { item: '1.2', description: 'Chemistry glassware starter kit', qty: 250, unit: 'Set', rate: 600000 },
                { item: '1.3', description: 'Laboratory safety cabinet', qty: 100, unit: 'Pcs', rate: 2250000 },
                { item: '1.4', description: 'Laboratory bench with chemical-resistant top', qty: 200, unit: 'Pcs', rate: 1450000 }
            ],
            deliverables: ['Supplied laboratory equipment', 'Regional delivery notes', 'Warranty cards', 'Sample evaluation records'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Sample submission clarifications can be added here.' }],
            interestedSuppliers: [
                { name: 'ElimuLab Supplies', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'STEM Equip Tanzania', status: 'Saved tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-GDS-2026-003',
            title: 'Supply of Agricultural Seed and Soil Testing Kits',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 640000000,
            closingDate: '2026-06-29',
            organization: 'Ministry of Agriculture',
            description: 'Supply of certified maize and sunflower seed packs, soil testing kits, moisture meters, and farmer extension starter materials.',
            eligibility: 'Open Tender / Agricultural inputs / Certified seed supplier or authorized distributor with traceability records.',
            category: 'Seeds and Seedlings',
            categories: ['Seeds and Seedlings', 'Agricultural seeds treatment, preservation and processing', 'Fertilizers, Plants Nutrients and herbicides'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Morogoro, Dodoma, Manyara, and Simiyu',
            commercialModel: 'Quantity Schedule',
            documents: ['Product_Specification_Template.csv', 'Lot_Delivery_Schedule.xlsx', 'Traceability_Form.pdf', 'Sample_Testing_Form.pdf'],
            regulatoryLicenses: [
                { group: 'Specialized Services', license: 'Weights and Measures Inspection Certificate', body: 'Weights and Measures Agency (WMA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Certified maize seed 10kg packs', unitOfMeasure: 'Pcs', quantity: 18000, unitPrice: 18500, totalPrice: 333000000, mandatory: true },
                        { itemDescription: 'Certified sunflower seed 5kg packs', unitOfMeasure: 'Pcs', quantity: 12000, unitPrice: 13750, totalPrice: 165000000, mandatory: true },
                        { itemDescription: 'Portable soil testing kit', unitOfMeasure: 'Set', quantity: 400, unitPrice: 255000, totalPrice: 102000000, mandatory: true },
                        { itemDescription: 'Digital grain moisture meter', unitOfMeasure: 'Pcs', quantity: 200, unitPrice: 200000, totalPrice: 40000000, mandatory: true }
                    ],
                    productSpecificationTemplate: createMockProductSpecificationTemplate([
                        { id: 'requiredSpecification', label: 'Required Specification', required: true, locked: false, instructions: 'Minimum required product or kit specification.' },
                        { id: 'certificationStandard', label: 'Certification/Standard', required: true, locked: false, instructions: 'Certification, inspection, or conformity evidence required.' },
                        { id: 'shelfLifeTraceability', label: 'Shelf Life/Traceability', required: true, locked: false, instructions: 'Batch traceability or remaining shelf-life requirement.' },
                        { id: 'packaging', label: 'Packaging', required: false, locked: false, instructions: 'Required packaging or delivery condition.' },
                        { id: 'warrantyReplacement', label: 'Warranty/Replacement', required: false, locked: false, instructions: 'Warranty or replacement obligation.' }
                    ], [
                        {
                            productName: 'Certified maize seed 10kg packs',
                            quantity: 18000,
                            requiredSpecification: 'Certified improved maize seed packed in 10kg sealed bags with minimum 85 percent germination.',
                            certificationStandard: 'Official seed certification and TBS/manufacturer certificate where applicable.',
                            shelfLifeTraceability: 'Batch traceability with lot numbers and minimum 12 months remaining shelf life.',
                            packaging: 'Sealed moisture-resistant bags labelled by variety, batch, and expiry date.',
                            warrantyReplacement: 'Replacement for failed certified lots.'
                        },
                        {
                            productName: 'Certified sunflower seed 5kg packs',
                            quantity: 12000,
                            requiredSpecification: 'Certified sunflower seed packed in 5kg sealed bags suitable for target agro-ecological zones.',
                            certificationStandard: 'Official seed certification and variety approval evidence.',
                            shelfLifeTraceability: 'Batch traceability with source and warehouse records.',
                            packaging: 'Sealed moisture-resistant bags labelled by variety, batch, and expiry date.',
                            warrantyReplacement: 'Replacement for failed certified lots.'
                        },
                        {
                            productName: 'Portable soil testing kit',
                            quantity: 400,
                            requiredSpecification: 'Portable field soil testing kit for pH, NPK, and organic matter indicators with reagents, instructions, and carrying case.',
                            certificationStandard: 'ISO or manufacturer quality certificate',
                            shelfLifeTraceability: 'Reagents must have minimum 12 months usable shelf life at delivery.',
                            packaging: 'Field-ready hard case with consumables inventory.',
                            warrantyReplacement: 'Minimum 12 months warranty.'
                        },
                        {
                            productName: 'Digital grain moisture meter',
                            quantity: 200,
                            requiredSpecification: 'Portable digital grain moisture meter suitable for maize and sunflower with clear display and calibration guide.',
                            certificationStandard: 'Manufacturer calibration certificate or inspection certificate.',
                            shelfLifeTraceability: 'Serial-numbered units with calibration record.',
                            packaging: 'Protective case with batteries and user manual.',
                            warrantyReplacement: 'Minimum 12 months warranty.'
                        }
                    ]),
                    requireSamples: 'Yes',
                    sampleRequirementRows: [
                        { relatedBoqItem: 'Certified maize seed 10kg packs', sampleRequired: true, numberOfSamples: 2, sampleDescription: 'Two sealed sample packs with batch certificates.', deliveryLocation: 'Ministry PMU Dodoma', deliveryDeadline: '2026-06-13', mandatory: true, returnableSample: false },
                        { relatedBoqItem: 'Portable soil testing kit', sampleRequired: true, numberOfSamples: 1, sampleDescription: 'One kit sample for field inspection.', deliveryLocation: 'Ministry PMU Dodoma', deliveryDeadline: '2026-06-13', mandatory: true, returnableSample: true }
                    ],
                    otherEligibilityRequirements: [
                        { requirementName: 'Seed certification evidence', mandatory: true, requiresUpload: true, notes: 'Upload certification for each seed variety offered.' },
                        { requirementName: 'Batch traceability plan', mandatory: true, requiresUpload: true, notes: 'Include lot numbers, source farms, and warehouse records.' },
                        { requirementName: 'Regional delivery plan', mandatory: true, requiresUpload: true, notes: 'Show delivery sequence by district.' }
                    ]
                },
                lists: {
                    qualityControls: [
                        { text: 'Buyer may test samples for germination and moisture before award.' },
                        { text: 'Supplier must replace rejected lots within 14 days.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Specification compliance', weight: 35, subcriteria: ['Seed certification', 'Sample test results', 'Kit quality'] },
                    { name: 'Delivery capacity', weight: 20, subcriteria: ['Regional logistics', 'Storage control'] },
                    { name: 'Financial proposal', weight: 30, subcriteria: ['Unit prices', 'Lot totals'] },
                    { name: 'After-sales support', weight: 10, subcriteria: ['Replacement process', 'Extension support'] },
                    { name: 'Compliance documents', weight: 5, subcriteria: ['Registration', 'Tax clearance'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-21' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-13' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-29' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-30' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-14' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-28' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Certified maize seed 10kg packs', qty: 18000, unit: 'Pcs', rate: 18500 },
                { item: '1.2', description: 'Certified sunflower seed 5kg packs', qty: 12000, unit: 'Pcs', rate: 13750 },
                { item: '1.3', description: 'Portable soil testing kit', qty: 400, unit: 'Set', rate: 255000 },
                { item: '1.4', description: 'Digital grain moisture meter', qty: 200, unit: 'Pcs', rate: 200000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Certified maize seed 10kg packs', qty: 18000, unit: 'Pcs', rate: 18500 },
                { item: '1.2', description: 'Certified sunflower seed 5kg packs', qty: 12000, unit: 'Pcs', rate: 13750 },
                { item: '1.3', description: 'Portable soil testing kit', qty: 400, unit: 'Set', rate: 255000 },
                { item: '1.4', description: 'Digital grain moisture meter', qty: 200, unit: 'Pcs', rate: 200000 }
            ],
            deliverables: ['Certified seed packs delivered by district', 'Soil testing kits and meters', 'Batch traceability register', 'Acceptance inspection report'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Buyer can update sample testing instructions if needed.' }],
            interestedSuppliers: [
                { name: 'AgriSeed Tanzania', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'GreenGrow Inputs Ltd', status: 'Watching tender', lastActivity: '2 days ago' }
            ]
        },
        {
            id: 'PX-GDS-2026-004',
            title: 'Framework Supply of Office Furniture and Ergonomic Chairs',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 1120000000,
            closingDate: '2026-07-06',
            organization: 'Tanzania Revenue Authority',
            description: 'Twelve-month framework supply of desks, ergonomic chairs, filing cabinets, reception counters, and meeting tables for TRA offices.',
            eligibility: 'Open Tender / Furniture framework / Supplier must show production or distribution capacity and warranty support.',
            category: 'Accommodation and Office furniture and accessories',
            categories: ['Accommodation and Office furniture and accessories', 'Commercial and industrial furniture and accessories', 'Containers and storage'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'TRA offices nationwide',
            commercialModel: 'Quantity Schedule',
            documents: ['Product_Specification_Template.csv', 'Framework_Quantity_Schedule.xlsx', 'Warranty_Service_Form.pdf'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Ergonomic office chair', unitOfMeasure: 'Pcs', quantity: 1800, unitPrice: 280000, totalPrice: 504000000, mandatory: true },
                        { itemDescription: 'Executive desk with cable management', unitOfMeasure: 'Pcs', quantity: 650, unitPrice: 520000, totalPrice: 338000000, mandatory: true },
                        { itemDescription: 'Steel filing cabinet four drawer', unitOfMeasure: 'Pcs', quantity: 500, unitPrice: 250000, totalPrice: 125000000, mandatory: true },
                        { itemDescription: 'Meeting table for 12 users', unitOfMeasure: 'Pcs', quantity: 90, unitPrice: 1700000, totalPrice: 153000000, mandatory: true }
                    ],
                    productSpecificationTemplate: createMockProductSpecificationTemplate([
                        { id: 'requiredSpecification', label: 'Required Specification', required: true, locked: false, instructions: 'Minimum furniture specification required by the buyer.' },
                        { id: 'materialFinish', label: 'Material/Finish', required: true, locked: false, instructions: 'Required material, colour, or finish details.' },
                        { id: 'standards', label: 'Standards', required: false, locked: false, instructions: 'Applicable furniture or quality standard.' },
                        { id: 'warranty', label: 'Warranty', required: true, locked: false, instructions: 'Minimum warranty and service support.' },
                        { id: 'sampleRequirement', label: 'Sample Requirement', required: false, locked: false, instructions: 'Sample or catalogue evidence required.' }
                    ], [
                        {
                            productName: 'Ergonomic office chair',
                            quantity: 1800,
                            requiredSpecification: 'Adjustable ergonomic task chair with lumbar support, breathable fabric, height adjustment, tilt, and five-star base with minimum 120kg load rating.',
                            materialFinish: 'Premium fabric or mesh finish with buyer-approved colour options.',
                            standards: 'TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty with replacement support.',
                            sampleRequirement: 'One assembled chair for ergonomic inspection.'
                        },
                        {
                            productName: 'Executive desk with cable management',
                            quantity: 650,
                            requiredSpecification: 'Office desk with modesty panel, cable management, durable worktop, and matching pedestal compatibility.',
                            materialFinish: 'Premium laminated board or equivalent with buyer-approved finishes.',
                            standards: 'TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty.',
                            sampleRequirement: 'Catalogue, material swatch, and technical drawing required.'
                        },
                        {
                            productName: 'Steel filing cabinet four drawer',
                            quantity: 500,
                            requiredSpecification: 'Four-drawer steel filing cabinet with central locking, smooth runners, label holders, and anti-rust treatment.',
                            materialFinish: 'Powder-coated steel in buyer-approved colour.',
                            standards: 'TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty.',
                            sampleRequirement: 'Catalogue and finish sample required.'
                        },
                        {
                            productName: 'Meeting table for 12 users',
                            quantity: 90,
                            requiredSpecification: 'Meeting table sized for 12 users with stable frame, cable access, and durable top suitable for office use.',
                            materialFinish: 'Premium board or hardwood equivalent with buyer-approved finish.',
                            standards: 'TBS conformity evidence',
                            warranty: 'Minimum 24 months warranty.',
                            sampleRequirement: 'Catalogue and technical drawing required.'
                        }
                    ]),
                    requireSamples: 'Yes',
                    sampleRequirementRows: [
                        { relatedBoqItem: 'Ergonomic office chair', sampleRequired: true, numberOfSamples: 1, sampleDescription: 'One assembled chair for ergonomic inspection.', deliveryLocation: 'TRA Headquarters Dar es Salaam', deliveryDeadline: '2026-06-20', mandatory: true, returnableSample: true }
                    ],
                    otherEligibilityRequirements: [
                        { requirementName: 'Warranty service arrangement', mandatory: true, requiresUpload: true, notes: 'Include service locations and replacement timelines.' },
                        { requirementName: 'Past framework supply references', mandatory: true, requiresUpload: true, notes: 'At least two framework contracts of similar scale.' },
                        { requirementName: 'Product catalog and finishes', mandatory: true, requiresUpload: true, notes: 'Include color, material, and finish options.' }
                    ]
                },
                lists: {
                    frameworkRules: [
                        { text: 'Call-off orders will be issued based on office demand.' },
                        { text: 'Supplier must maintain framework prices for 12 months.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Specification compliance', weight: 35, subcriteria: ['Sample quality', 'Durability', 'Finish'] },
                    { name: 'Delivery capacity', weight: 20, subcriteria: ['Nationwide delivery', 'Stock availability'] },
                    { name: 'Financial proposal', weight: 30, subcriteria: ['Framework rates', 'Discount structure'] },
                    { name: 'After-sales support', weight: 10, subcriteria: ['Warranty service', 'Replacement timeline'] },
                    { name: 'Compliance documents', weight: 5, subcriteria: ['Registration', 'Tax clearance'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-25' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-20' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-06' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-07' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-21' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-04' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Ergonomic office chair', qty: 1800, unit: 'Pcs', rate: 280000 },
                { item: '1.2', description: 'Executive desk with cable management', qty: 650, unit: 'Pcs', rate: 520000 },
                { item: '1.3', description: 'Steel filing cabinet four drawer', qty: 500, unit: 'Pcs', rate: 250000 },
                { item: '1.4', description: 'Meeting table for 12 users', qty: 90, unit: 'Pcs', rate: 1700000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Ergonomic office chair', qty: 1800, unit: 'Pcs', rate: 280000 },
                { item: '1.2', description: 'Executive desk with cable management', qty: 650, unit: 'Pcs', rate: 520000 },
                { item: '1.3', description: 'Steel filing cabinet four drawer', qty: 500, unit: 'Pcs', rate: 250000 },
                { item: '1.4', description: 'Meeting table for 12 users', qty: 90, unit: 'Pcs', rate: 1700000 }
            ],
            deliverables: ['Framework furniture supply', 'Sample approval report', 'Warranty register', 'Monthly delivery reports'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Buyer can update sample submission or color schedule.' }],
            interestedSuppliers: [
                { name: 'Kiti Bora Furnishers', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'OfficeLine Tanzania', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-SVC-2026-001',
            title: 'Managed Cybersecurity Monitoring Service',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 1480000000,
            closingDate: '2026-07-10',
            organization: 'Tanzania Revenue Authority',
            description: 'Twenty-four month managed security operations center service covering SIEM monitoring, incident response, vulnerability scanning, and monthly reporting.',
            eligibility: 'Open Tender / ICT service / Certified cybersecurity provider with SOC analysts and data protection controls.',
            category: 'IT Support',
            categories: ['IT Support', 'Computer Software', 'Data Voice or Multimedia Network Equipment or Platforms and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dar es Salaam and remote SOC operations',
            commercialModel: 'Service Schedule',
            documents: ['SOC_Service_TOR.pdf', 'SLA_Schedule.pdf', 'Reporting_Template.xlsx', 'Data_Protection_Requirements.pdf'],
            regulatoryLicenses: [
                { group: 'Communications and Transport', license: 'Application Services License', body: 'Tanzania Communications Regulatory Authority (TCRA)', mandatory: false },
                { group: 'Specialized Services', license: 'Calibration Certificate', body: 'Weights and Measures Agency (WMA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'IT Support',
                    scopeOfServices: 'Provide 24/7 SIEM monitoring, incident triage, vulnerability scanning, threat intelligence briefings, quarterly tabletop exercises, and audit-ready monthly service reports.',
                    serviceLocations: [
                        { text: 'TRA data center Dar es Salaam' },
                        { text: 'TRA disaster recovery site' },
                        { text: 'Supplier security operations center' }
                    ],
                    duration: '24 months',
                    fundingSource: 'Own source',
                    financialRequirementRows: [
                        { requirementType: 'Average Annual Turnover', minimumValue: 2500000000, currency: 'TZS', period: 'Last 3 Years', evidenceRequired: ['Audited accounts'], mandatory: true },
                        { requirementType: 'Access to Credit', minimumValue: 300000000, currency: 'TZS', period: 'Current', evidenceRequired: ['Bank letter', 'Credit facility letter'], mandatory: true }
                    ],
                    personnelRequirementRows: [
                        { position: 'SOC Manager', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 8, cvRequired: true, mandatory: true },
                        { position: 'Incident Response Lead', minimumEducation: 'Professional Qualification', minimumYearsExperience: 6, cvRequired: true, mandatory: true },
                        { position: 'Tier 1 SOC Analysts', minimumEducation: 'Diploma', minimumYearsExperience: 3, cvRequired: true, mandatory: true }
                    ],
                    serviceDeliverables: [
                        { text: '24/7 monitoring and incident log' },
                        { text: 'Monthly security posture report' },
                        { text: 'Quarterly vulnerability assessment report' },
                        { text: 'Incident response after-action reports' }
                    ],
                    serviceMilestones: [
                        { text: 'Service onboarding within 30 days' },
                        { text: 'First vulnerability baseline within 45 days' }
                    ],
                    reportingRequirements: 'Monthly performance reports must include incidents, false positives, mean time to respond, vulnerability status, and remediation follow-up.',
                    slaRequirement: 'Critical incidents acknowledged within 15 minutes and escalated within 30 minutes.',
                    uptimeRequirement: '99.9 percent monitoring platform availability',
                    responseTime: 'Critical: 15 minutes, High: 1 hour, Medium: 4 hours',
                    supportHours: '24/7/365',
                    supportingDocumentRows: [
                        { documentName: 'SOC methodology', mandatory: true },
                        { documentName: 'Information security policy', mandatory: true },
                        { documentName: 'Data protection and confidentiality declaration', mandatory: true }
                    ],
                    esRequirementCards: [
                        { category: 'Worker Safety', description: 'Supplier must manage analyst fatigue and shift handover quality.', evidenceRequired: ['Procedure manual'], mandatory: false },
                        { category: 'Labor Compliance', description: 'All assigned staff must be formally employed or contracted.', evidenceRequired: ['Policy document'], mandatory: true }
                    ]
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Sign confidentiality and data processing agreement.' },
                        { text: 'Confirm no offshore data transfer without written buyer approval.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Service methodology', weight: 30, subcriteria: ['SOC process', 'Incident response', 'Threat intelligence'] },
                    { name: 'Team capability', weight: 25, subcriteria: ['Certifications', 'Shift coverage', 'Experience'] },
                    { name: 'SLA compliance plan', weight: 20, subcriteria: ['Response times', 'Escalation', 'Reporting'] },
                    { name: 'Financial proposal', weight: 15, subcriteria: ['Monthly fees', 'Tooling cost transparency'] },
                    { name: 'Compliance', weight: 10, subcriteria: ['Data protection', 'References'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-26' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-24' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-10' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-13' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-31' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-14' }
            ],
            commercialItems: [
                { item: '1.1', description: '24/7 SIEM monitoring and triage', qty: 24, unit: 'Month', rate: 42000000 },
                { item: '1.2', description: 'Vulnerability scanning and reporting', qty: 24, unit: 'Month', rate: 8500000 },
                { item: '1.3', description: 'Incident response retainer', qty: 24, unit: 'Month', rate: 7250000 },
                { item: '1.4', description: 'Onboarding, tuning, and tabletop exercises', qty: 1, unit: 'Lot', rate: 94000000 }
            ],
            boqItems: [
                { item: '1.1', description: '24/7 SIEM monitoring and triage', qty: 24, unit: 'Month', rate: 42000000 },
                { item: '1.2', description: 'Vulnerability scanning and reporting', qty: 24, unit: 'Month', rate: 8500000 },
                { item: '1.3', description: 'Incident response retainer', qty: 24, unit: 'Month', rate: 7250000 },
                { item: '1.4', description: 'Onboarding, tuning, and tabletop exercises', qty: 1, unit: 'Lot', rate: 94000000 }
            ],
            deliverables: ['SOC onboarding plan', 'Monthly security reports', 'Incident response reports', 'Quarterly executive briefings'],
            clarifications: [{ title: 'Tool ownership', question: 'Bidders may propose buyer-owned or supplier-hosted tooling, subject to data residency controls.', status: 'Answered' }],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'SLA clarifications can be issued as addenda.' }],
            interestedSuppliers: [
                { name: 'CyberShield Africa', status: 'Asked clarification', lastActivity: 'Today' },
                { name: 'SecureOps Tanzania', status: 'Downloaded documents', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-SVC-2026-002',
            title: 'Hospital Cleaning, Laundry, and Waste Handling Services',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 920000000,
            closingDate: '2026-06-24',
            organization: 'Muhimbili National Hospital',
            description: 'Twelve-month cleaning, laundry, linen movement, and non-hazardous waste handling service for wards, theatres, offices, and public areas.',
            eligibility: 'Open Tender / Cleaning services / Provider with healthcare cleaning references, trained supervisors, PPE, and insurance cover.',
            category: 'Cleaning',
            categories: ['Cleaning Equipment and Supplies', 'Bedclothes and table and kitchen linen and towels', 'Waste Management'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Muhimbili National Hospital campus',
            commercialModel: 'Service Schedule',
            documents: ['Cleaning_Scope.pdf', 'Area_Schedule.xlsx', 'Infection_Control_Requirements.pdf', 'SLA_Template.pdf'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)', mandatory: true },
                { group: 'Specialized Services', license: 'Hazardous Chemicals Handling Certificate', body: 'Government Chemist Laboratory Authority (GCLA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Cleaning',
                    scopeOfServices: 'Daily cleaning, terminal cleaning, laundry movement, linen sorting, washroom replenishment, waste staging, and quality inspections for clinical and non-clinical spaces.',
                    serviceLocations: [
                        { text: 'Surgical wards' },
                        { text: 'Outpatient department' },
                        { text: 'Administrative offices' },
                        { text: 'Laundry collection points' }
                    ],
                    duration: '12 months with option to extend',
                    fundingSource: 'Own source',
                    financialRequirementRows: [
                        { requirementType: 'Minimum Annual Turnover', minimumValue: 1200000000, currency: 'TZS', period: 'Annual', evidenceRequired: ['Audited accounts', 'Tax clearance'], mandatory: true }
                    ],
                    personnelRequirementRows: [
                        { position: 'Contract Manager', minimumEducation: 'Diploma', minimumYearsExperience: 5, cvRequired: true, mandatory: true },
                        { position: 'Infection Control Supervisor', minimumEducation: 'Professional Qualification', minimumYearsExperience: 4, cvRequired: true, mandatory: true },
                        { position: 'Cleaning Supervisors', minimumEducation: 'Certificate', minimumYearsExperience: 3, cvRequired: true, mandatory: true }
                    ],
                    cleaningAreas: 'Wards, theatres support areas, outpatient waiting rooms, washrooms, corridors, offices, and public access areas.',
                    cleaningFrequency: 'Daily',
                    cleaningMaterials: 'Hospital-grade disinfectants, microfiber systems, color-coded mops, PPE, and consumables.',
                    wasteDisposalRequirements: 'Segregate non-hazardous waste, coordinate with hospital waste team, and record daily collection logs.',
                    equipmentRequirementRows: [
                        { equipmentName: 'Floor scrubber', quantity: 6, ownershipRequirement: 'Owned', technicalSpecification: 'Battery-powered scrubber suitable for hospital floors.', evidenceRequired: ['Photos', 'Purchase receipt'], mandatory: true, evaluationMethod: 'Compliance Review', supplierResponseType: 'Upload + Text' },
                        { equipmentName: 'Laundry carts', quantity: 40, ownershipRequirement: 'Either', technicalSpecification: 'Washable enclosed carts for linen movement.', evidenceRequired: ['Photos'], mandatory: true, evaluationMethod: 'Pass/Fail', supplierResponseType: 'Upload' }
                    ],
                    esRequirementCards: [
                        { category: 'Worker Safety', description: 'Provide PPE, vaccination guidance, and infection prevention training.', evidenceRequired: ['Training records', 'Procedure manual'], mandatory: true },
                        { category: 'Labor Compliance', description: 'Submit staff roster and lawful employment declaration.', evidenceRequired: ['Policy document'], mandatory: true }
                    ],
                    supportingDocumentRows: [
                        { documentName: 'Healthcare cleaning methodology', mandatory: true },
                        { documentName: 'Staff training records', mandatory: true },
                        { documentName: 'Insurance certificate', mandatory: true }
                    ],
                    insuranceCovers: [
                        { text: 'Public liability insurance' },
                        { text: 'Workers compensation cover' }
                    ],
                    riskAssessmentRequirement: 'Submit risk assessment for clinical areas and chemical handling.',
                    safetyPlanRequirement: 'Submit hospital cleaning safety plan and escalation procedure.',
                    ppeRequirements: 'Gloves, masks, aprons, eye protection, and color-coded cleaning tools.'
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Confirm staff will follow hospital infection prevention protocols.' },
                        { text: 'Confirm all cleaning chemicals will be approved before use.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Service methodology', weight: 30, subcriteria: ['Healthcare cleaning plan', 'Quality control'] },
                    { name: 'Team capability', weight: 25, subcriteria: ['Supervision', 'Training', 'Staffing levels'] },
                    { name: 'SLA compliance plan', weight: 20, subcriteria: ['Inspection system', 'Response time'] },
                    { name: 'Financial proposal', weight: 15, subcriteria: ['Monthly fees', 'Consumables realism'] },
                    { name: 'Compliance', weight: 10, subcriteria: ['OSHA', 'Insurance', 'Labor compliance'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-17' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-10' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-24' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-25' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-09' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-23' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Clinical and public area cleaning service', qty: 12, unit: 'Month', rate: 52000000 },
                { item: '1.2', description: 'Laundry movement and linen support', qty: 12, unit: 'Month', rate: 11500000 },
                { item: '1.3', description: 'Consumables and PPE provision', qty: 12, unit: 'Month', rate: 9800000 },
                { item: '1.4', description: 'Mobilization, training, and quality baseline', qty: 1, unit: 'Lot', rate: 40000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Clinical and public area cleaning service', qty: 12, unit: 'Month', rate: 52000000 },
                { item: '1.2', description: 'Laundry movement and linen support', qty: 12, unit: 'Month', rate: 11500000 },
                { item: '1.3', description: 'Consumables and PPE provision', qty: 12, unit: 'Month', rate: 9800000 },
                { item: '1.4', description: 'Mobilization, training, and quality baseline', qty: 1, unit: 'Lot', rate: 40000000 }
            ],
            deliverables: ['Daily cleaning logs', 'Monthly KPI reports', 'Staff training records', 'Incident and corrective action reports'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Buyer can update area schedule before closing.' }],
            interestedSuppliers: [
                { name: 'Hospital CleanCare Ltd', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'Usafi Professional Services', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-SVC-2026-003',
            title: 'Regional Student Meal Catering Services',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 1560000000,
            closingDate: '2026-07-02',
            organization: 'University of Dodoma',
            description: 'Provision of breakfast, lunch, dinner, special diet meals, food safety controls, and monthly reporting for student dining halls.',
            eligibility: 'Invited Tender / Catering services / Food handling permits, demonstrated institutional catering capacity, and hygiene compliance required.',
            category: 'Catering',
            categories: ['Catering', 'Food Beverage and Tobacco Products', 'Domestic kitchenware and kitchen supplies'],
            method: 'Invited Tender',
            visibility: 'Invited suppliers only',
            visibilityNote: 'Visible to invited catering suppliers and buyer users.',
            invitedUsers: [
                { name: 'ABC Construction Ltd', organization: 'ABC Construction Ltd', email: 'supplier@abc.test' },
                { name: 'Campus Meals Tanzania', organization: 'Campus Meals Tanzania Ltd', email: 'bids@campusmeals.test' }
            ],
            location: 'University of Dodoma student dining halls',
            commercialModel: 'Service Schedule',
            documents: ['Catering_TOR.pdf', 'Menu_and_Nutrition_Schedule.xlsx', 'Food_Safety_Requirements.pdf', 'Service_Level_Agreement.pdf'],
            regulatoryLicenses: [
                { group: 'Food, Drugs and Cosmetics', license: 'Food Business Permit / Food Handling License', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)', mandatory: true },
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Catering',
                    scopeOfServices: 'Prepare and serve daily meals, manage queue flow, maintain hygiene records, support special diets, and submit consumption and quality reports.',
                    serviceLocations: [
                        { text: 'Dining Hall A' },
                        { text: 'Dining Hall B' },
                        { text: 'Satellite serving points' }
                    ],
                    duration: 'Academic year 2026/2027',
                    fundingSource: 'Own source',
                    financialRequirementRows: [
                        { requirementType: 'Average Annual Turnover', minimumValue: 1800000000, currency: 'TZS', period: 'Last 3 Years', evidenceRequired: ['Audited accounts', 'Bank statement'], mandatory: true }
                    ],
                    personnelRequirementRows: [
                        { position: 'Catering Manager', minimumEducation: 'Diploma', minimumYearsExperience: 6, cvRequired: true, mandatory: true },
                        { position: 'Nutritionist', minimumEducation: 'Bachelor Degree', minimumYearsExperience: 3, cvRequired: true, mandatory: true },
                        { position: 'Food Safety Supervisor', minimumEducation: 'Professional Qualification', minimumYearsExperience: 4, cvRequired: true, mandatory: true }
                    ],
                    menuRequirements: 'Balanced rotating menu with breakfast, lunch, dinner, vegetarian option, and medically approved special diets.',
                    hygieneRequirements: 'HACCP-aligned food safety controls, daily temperature logs, staff hygiene checks, and pest control coordination.',
                    foodCertifications: [
                        { text: 'Food handling certificates for supervisors' },
                        { text: 'Kitchen inspection clearance' }
                    ],
                    equipmentRequirementRows: [
                        { equipmentName: 'Industrial cooking ranges', quantity: 8, ownershipRequirement: 'Either', technicalSpecification: 'Commercial grade cooking ranges for high volume service.', evidenceRequired: ['Photos', 'Inspection certificate'], mandatory: true, evaluationMethod: 'Compliance Review', supplierResponseType: 'Upload + Text' },
                        { equipmentName: 'Food transport warmers', quantity: 20, ownershipRequirement: 'Owned', technicalSpecification: 'Insulated warmers for satellite serving points.', evidenceRequired: ['Photos'], mandatory: true, evaluationMethod: 'Pass/Fail', supplierResponseType: 'Upload' }
                    ],
                    esRequirementCards: [
                        { category: 'Worker Safety', description: 'Food handling PPE and burn prevention procedure required.', evidenceRequired: ['Procedure manual'], mandatory: true },
                        { category: 'Environmental Protection', description: 'Food waste reduction and disposal plan required.', evidenceRequired: ['Environmental plan'], mandatory: true }
                    ],
                    supportingDocumentRows: [
                        { documentName: 'Menu and nutrition plan', mandatory: true },
                        { documentName: 'Food safety management plan', mandatory: true },
                        { documentName: 'Institutional catering references', mandatory: true }
                    ],
                    insuranceCovers: [
                        { text: 'Public liability insurance' },
                        { text: 'Food contamination liability cover' }
                    ],
                    riskAssessmentRequirement: 'Submit food safety and crowd management risk assessment.',
                    safetyPlanRequirement: 'Submit kitchen fire safety and first aid plan.',
                    ppeRequirements: 'Hairnets, aprons, gloves, closed shoes, and heat-resistant gloves.'
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Confirm buyer right to conduct kitchen inspections.' },
                        { text: 'Confirm acceptance of meal quality deductions under SLA.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Service methodology', weight: 30, subcriteria: ['Meal production plan', 'Food safety controls'] },
                    { name: 'Team capability', weight: 25, subcriteria: ['Catering manager', 'Nutritionist', 'Supervisors'] },
                    { name: 'SLA compliance plan', weight: 20, subcriteria: ['Queue time', 'Meal availability', 'Quality checks'] },
                    { name: 'Financial proposal', weight: 15, subcriteria: ['Meal rates', 'Cost realism'] },
                    { name: 'Compliance', weight: 10, subcriteria: ['Food permit', 'Insurance', 'References'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-24' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-18' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-02' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-03' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-17' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-31' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Student breakfast service', qty: 180000, unit: 'Unit', rate: 2500 },
                { item: '1.2', description: 'Student lunch service', qty: 220000, unit: 'Unit', rate: 3200 },
                { item: '1.3', description: 'Student dinner service', qty: 220000, unit: 'Unit', rate: 3000 },
                { item: '1.4', description: 'Mobilization and food safety setup', qty: 1, unit: 'Lot', rate: 48000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Student breakfast service', qty: 180000, unit: 'Unit', rate: 2500 },
                { item: '1.2', description: 'Student lunch service', qty: 220000, unit: 'Unit', rate: 3200 },
                { item: '1.3', description: 'Student dinner service', qty: 220000, unit: 'Unit', rate: 3000 },
                { item: '1.4', description: 'Mobilization and food safety setup', qty: 1, unit: 'Lot', rate: 48000000 }
            ],
            deliverables: ['Daily meal service', 'Food safety records', 'Monthly consumption reports', 'Special diet register'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Menu or serving point changes can be issued as amendments.' }],
            interestedSuppliers: [
                { name: 'Campus Meals Tanzania', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'Afya Catering Services', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-SVC-2026-004',
            title: 'Fleet Maintenance and Breakdown Recovery Services',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 760000000,
            closingDate: '2026-06-30',
            organization: 'Tanzania Electric Supply Company',
            description: 'Preventive maintenance, minor repairs, emergency breakdown recovery, spare parts management, and monthly fleet condition reporting for utility vehicles.',
            eligibility: 'Open Tender / Vehicle maintenance / Registered garage with qualified technicians, diagnostic equipment, and regional coverage.',
            category: 'Vehicle maintenance',
            categories: ['Vehicle maintenance', 'Motor Vehicles', 'Motor Vehicle Parts and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dar es Salaam, Morogoro, Dodoma, and Coast region',
            commercialModel: 'Service Schedule',
            documents: ['Fleet_Maintenance_TOR.pdf', 'Vehicle_List.xlsx', 'SLA_Response_Times.pdf', 'Spare_Parts_Rules.pdf'],
            regulatoryLicenses: [
                { group: 'Specialized Services', license: 'Weights and Measures Inspection Certificate', body: 'Weights and Measures Agency (WMA)', mandatory: false },
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)', mandatory: true }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Vehicle maintenance',
                    scopeOfServices: 'Provide scheduled preventive maintenance, corrective repairs, diagnostic services, towing coordination, tyre services, battery replacement, and monthly fleet health reporting.',
                    serviceLocations: [
                        { text: 'Dar es Salaam workshop' },
                        { text: 'Morogoro service point' },
                        { text: 'Dodoma service point' },
                        { text: 'Coast region mobile recovery' }
                    ],
                    duration: '18 months',
                    fundingSource: 'Own source',
                    financialRequirementRows: [
                        { requirementType: 'Minimum Annual Turnover', minimumValue: 900000000, currency: 'TZS', period: 'Annual', evidenceRequired: ['Audited accounts', 'Tax clearance'], mandatory: true }
                    ],
                    personnelRequirementRows: [
                        { position: 'Workshop Manager', minimumEducation: 'Diploma', minimumYearsExperience: 7, cvRequired: true, mandatory: true },
                        { position: 'Vehicle Diagnostic Technician', minimumEducation: 'Professional Qualification', minimumYearsExperience: 5, cvRequired: true, mandatory: true },
                        { position: 'Recovery Coordinator', minimumEducation: 'Certificate', minimumYearsExperience: 3, cvRequired: true, mandatory: true }
                    ],
                    maintenanceSchedule: 'Preventive maintenance by mileage and time intervals, with buyer-approved work orders before major repairs.',
                    sparePartsRequirement: 'Use genuine or OEM-equivalent parts with warranty and traceable invoices.',
                    technicianRequirements: 'Technicians must have experience with pickups, trucks, vans, and utility service vehicles.',
                    equipmentRequirementRows: [
                        { equipmentName: 'Vehicle diagnostic scanner', quantity: 4, ownershipRequirement: 'Owned', technicalSpecification: 'OBD and manufacturer-compatible diagnostic tools.', evidenceRequired: ['Photos', 'Purchase receipt'], mandatory: true, evaluationMethod: 'Compliance Review', supplierResponseType: 'Upload + Text' },
                        { equipmentName: 'Recovery tow truck access', quantity: 2, ownershipRequirement: 'Either', technicalSpecification: 'Tow truck or signed recovery partnership.', evidenceRequired: ['Logbook', 'Lease agreement'], mandatory: true, evaluationMethod: 'Pass/Fail', supplierResponseType: 'Upload' }
                    ],
                    supportingDocumentRows: [
                        { documentName: 'Workshop capability statement', mandatory: true },
                        { documentName: 'Technician CVs and certificates', mandatory: true },
                        { documentName: 'Spare parts sourcing plan', mandatory: true }
                    ],
                    insuranceCovers: [
                        { text: 'Garage keeper liability' },
                        { text: 'Public liability insurance' }
                    ],
                    riskAssessmentRequirement: 'Submit workshop risk assessment and recovery operation controls.',
                    safetyPlanRequirement: 'Submit safety plan for workshop operations, lifting equipment, and road recovery.',
                    ppeRequirements: 'Workshop PPE including boots, gloves, eye protection, and reflective wear.'
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Confirm no unauthorized replacement of major parts without buyer approval.' },
                        { text: 'Confirm monthly fleet condition reporting.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Service methodology', weight: 30, subcriteria: ['Maintenance workflow', 'Quality checks'] },
                    { name: 'Team capability', weight: 25, subcriteria: ['Technicians', 'Regional coverage'] },
                    { name: 'SLA compliance plan', weight: 20, subcriteria: ['Breakdown response', 'Repair turnaround'] },
                    { name: 'Financial proposal', weight: 15, subcriteria: ['Labor rates', 'Parts markup'] },
                    { name: 'Compliance', weight: 10, subcriteria: ['Insurance', 'Safety', 'References'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-22' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-14' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-30' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-01' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-15' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-29' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Preventive maintenance service', qty: 18, unit: 'Month', rate: 18000000 },
                { item: '1.2', description: 'Corrective repairs labor allowance', qty: 18, unit: 'Month', rate: 14500000 },
                { item: '1.3', description: 'Breakdown recovery retainer', qty: 18, unit: 'Month', rate: 7000000 },
                { item: '1.4', description: 'Spare parts management allowance', qty: 1, unit: 'Lot', rate: 49000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Preventive maintenance service', qty: 18, unit: 'Month', rate: 18000000 },
                { item: '1.2', description: 'Corrective repairs labor allowance', qty: 18, unit: 'Month', rate: 14500000 },
                { item: '1.3', description: 'Breakdown recovery retainer', qty: 18, unit: 'Month', rate: 7000000 },
                { item: '1.4', description: 'Spare parts management allowance', qty: 1, unit: 'Lot', rate: 49000000 }
            ],
            deliverables: ['Monthly maintenance plan', 'Work order records', 'Breakdown response reports', 'Fleet condition dashboard'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Vehicle list addenda can be published here.' }],
            interestedSuppliers: [
                { name: 'AutoCare Tanzania Ltd', status: 'Downloaded documents', lastActivity: 'Today' },
                { name: 'FleetFix Services', status: 'Watching tender', lastActivity: '2 days ago' }
            ]
        },
        {
            id: 'PX-CNS-2026-001',
            title: 'Consultancy for National e-Procurement Change Management',
            type: 'Consultancy',
            procurementTypeId: 'consultancy',
            status: 'Open',
            budget: 1180000000,
            closingDate: '2026-07-15',
            organization: 'Public Procurement Regulatory Authority',
            description: 'Firm consultancy to design and implement change management, training materials, stakeholder engagement, and adoption monitoring for e-procurement rollout.',
            eligibility: 'Open Tender / Consultancy / Consulting firm with public sector digital transformation and procurement training experience.',
            category: 'Procurement Consultancy',
            categories: ['Procurement Consultancy', 'Training', 'ICT'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dar es Salaam with national stakeholder workshops',
            commercialModel: 'Financial Proposal',
            documents: ['Terms_of_Reference.pdf', 'Technical_Proposal_Template.docx', 'Key_Expert_CV_Template.docx', 'Financial_Proposal_Template.xlsx'],
            regulatoryLicenses: [
                { group: 'Finance and Banking', license: 'Investment Adviser License', body: 'Capital Markets and Securities Authority (CMSA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    consultancyEntityBackground: [
                        { organizationBackground: 'PPRA is coordinating adoption of digital procurement workflows across public procuring entities.', departmentUnit: 'Procurement Management Unit', fundingSource: 'Government of Tanzania' }
                    ],
                    consultancyProjectBackground: {
                        projectName: 'National e-Procurement Change Management',
                        backgroundNarrative: 'The rollout requires consistent training, stakeholder engagement, and support for new digital procurement behaviors.',
                        existingChallenges: 'Variable digital readiness, inconsistent procurement documentation, and resistance to process change.',
                        currentSituation: 'Core platform workflows are available and need adoption acceleration.',
                        relatedInitiatives: 'Procurement reform, digital government, and supplier onboarding programs.'
                    },
                    consultancyProblemStatement: {
                        mainProblemDescription: 'Procuring entities need practical change support to adopt digital tender creation, evaluation, and contract workflows.',
                        expectedImpact: 'Higher adoption, better tender quality, faster supplier onboarding, and improved compliance.'
                    },
                    consultancyGeneralObjective: 'Design and deliver a structured change management program that enables public procuring entities and suppliers to use e-procurement workflows effectively.',
                    consultancySpecificObjectives: [
                        { objectiveTitle: 'Adoption readiness assessment', objectiveDescription: 'Assess readiness across selected procuring entities and supplier groups.', priorityLevel: 'High' },
                        { objectiveTitle: 'Training content design', objectiveDescription: 'Prepare role-based training materials and job aids.', priorityLevel: 'High' },
                        { objectiveTitle: 'Adoption monitoring', objectiveDescription: 'Define KPIs and feedback loops for rollout performance.', priorityLevel: 'Medium' }
                    ],
                    consultancyAssignmentActivities: [
                        { activityTitle: 'Stakeholder mapping and readiness assessment', detailedDescription: 'Map user groups, readiness gaps, and training needs.', expectedOutput: 'Readiness assessment report', location: 'National sample', duration: 25, mandatory: true },
                        { activityTitle: 'Training curriculum and facilitation toolkit', detailedDescription: 'Develop buyer, supplier, and administrator materials.', expectedOutput: 'Training toolkit', location: 'Dar es Salaam', duration: 35, mandatory: true },
                        { activityTitle: 'Pilot workshops and feedback integration', detailedDescription: 'Run pilot sessions and refine materials.', expectedOutput: 'Pilot report', location: 'Four zones', duration: 30, mandatory: true }
                    ],
                    consultancyClientResponsibilities: [
                        { responsibilityTitle: 'Provide platform process documentation', description: 'Share workflow documentation and stakeholder contacts.', supportType: 'Document access' },
                        { responsibilityTitle: 'Coordinate workshop invitations', description: 'Invite selected procuring entities and suppliers.', supportType: 'Meeting coordination' }
                    ],
                    consultancyConsultantResponsibilities: [
                        { responsibility: 'Prepare change management plan', description: 'Develop detailed plan, communications, training approach, and adoption risks.', reportingFrequency: 'Monthly' },
                        { responsibility: 'Facilitate workshops', description: 'Deliver workshops and compile attendance and feedback records.', reportingFrequency: 'Weekly' }
                    ],
                    consultancyDeliverables: [
                        { deliverableName: 'Inception report', description: 'Detailed methodology, work plan, and stakeholder map.', submissionTimeline: '3 weeks from contract start', formatRequired: 'PDF', reviewer: 'Project Manager', mandatory: true },
                        { deliverableName: 'Training toolkit', description: 'Slides, facilitator guide, job aids, and participant exercises.', submissionTimeline: '8 weeks from contract start', formatRequired: 'PowerPoint', reviewer: 'User Department', mandatory: true },
                        { deliverableName: 'Final adoption report', description: 'Adoption results, lessons, and scale-up recommendations.', submissionTimeline: 'End of assignment', formatRequired: 'PDF', reviewer: 'Tender Board', mandatory: true }
                    ],
                    consultancyReportingRequirements: [
                        { reportType: 'Monthly report', frequency: 'Monthly', submissionFormat: 'PDF', submissionChannel: 'Procurement portal' },
                        { reportType: 'Weekly progress report', frequency: 'Weekly', submissionFormat: 'Excel', submissionChannel: 'Email' }
                    ],
                    consultancyIndividualQualifications: [
                        { professionalRegistrationsCertifications: ['Project Management Professional (PMP)'], cvRequired: 'Required', yearsOfExperience: 10, similarAssignmentsCount: 3, similarAssignmentsEvidenceRequired: 'Required' }
                    ],
                    consultancyFirmExperience: [
                        { minimumYearsExperience: 8, requiredSimilarAssignments: 3, sectorExperience: ['Public sector', 'ICT', 'Finance'], requiredEvidence: 'Required' }
                    ],
                    consultancyKeyExperts: [
                        { positionTitle: 'Change Management Lead', minimumQualification: 'Masters Degree', yearsOfExperience: 10, certifications: 'Prosci, PMP, or equivalent', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Procurement Training Specialist', minimumQualification: 'Bachelor Degree', yearsOfExperience: 8, certifications: 'Procurement professional certification', quantityRequired: 2, mandatory: true },
                        { positionTitle: 'Monitoring and Evaluation Specialist', minimumQualification: 'Bachelor Degree', yearsOfExperience: 6, certifications: 'MandE certification desirable', quantityRequired: 1, mandatory: true }
                    ],
                    consultancyReportingStructure: [
                        { consultantReportsTo: 'Project Manager', supervisingOfficer: 'Director', approvalAuthority: 'Tender Board' }
                    ]
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Separate technical and financial proposals are required.' },
                        { text: 'Consultant must transfer editable training materials to the buyer.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Understanding of TOR', weight: 25, subcriteria: ['Problem framing', 'Public procurement context'] },
                    { name: 'Methodology and work plan', weight: 30, subcriteria: ['Change approach', 'Training design', 'Adoption KPIs'] },
                    { name: 'Key expert qualifications', weight: 25, subcriteria: ['Lead consultant', 'Training specialists', 'MandE specialist'] },
                    { name: 'Financial proposal', weight: 10, subcriteria: ['Fee realism', 'Reimbursables'] },
                    { name: 'Knowledge transfer', weight: 10, subcriteria: ['Toolkit handover', 'Training of trainers'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-27' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-29' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-15' },
                { id: 'milestone-opening', name: 'Technical opening', date: '2026-07-16' },
                { id: 'milestone-evaluation', name: 'Technical evaluation complete', date: '2026-08-05' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-28' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Change management lead input', qty: 80, unit: 'Day', rate: 1800000 },
                { item: '1.2', description: 'Procurement training specialists', qty: 160, unit: 'Day', rate: 1250000 },
                { item: '1.3', description: 'MandE specialist input', qty: 60, unit: 'Day', rate: 1100000 },
                { item: '1.4', description: 'Workshops, travel, materials, and reimbursables', qty: 1, unit: 'Lot', rate: 770000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Change management lead input', qty: 80, unit: 'Day', rate: 1800000 },
                { item: '1.2', description: 'Procurement training specialists', qty: 160, unit: 'Day', rate: 1250000 },
                { item: '1.3', description: 'MandE specialist input', qty: 60, unit: 'Day', rate: 1100000 },
                { item: '1.4', description: 'Workshops, travel, materials, and reimbursables', qty: 1, unit: 'Lot', rate: 770000000 }
            ],
            deliverables: ['Inception report', 'Training toolkit', 'Pilot workshop report', 'Final adoption report'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'TOR addenda can be issued if stakeholder list changes.' }],
            interestedSuppliers: [
                { name: 'GovTech Advisory Ltd', status: 'Downloaded TOR', lastActivity: 'Today' },
                { name: 'Procurement Reform Partners', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-CNS-2026-002',
            title: 'Environmental and Social Impact Assessment for Bus Rapid Transit Corridor',
            type: 'Consultancy',
            procurementTypeId: 'consultancy',
            status: 'Open',
            budget: 940000000,
            closingDate: '2026-07-08',
            organization: 'Dar Rapid Transit Agency',
            description: 'Consultancy services for ESIA, stakeholder consultations, resettlement screening, mitigation planning, and disclosure support for a proposed BRT corridor.',
            eligibility: 'Open Tender / Environmental consultancy / NEMC-registered experts and urban transport ESIA references required.',
            category: 'Environmental Consultancy',
            categories: ['Environmental Consultancy', 'Transport', 'Urban planning'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dar es Salaam',
            commercialModel: 'Financial Proposal',
            documents: ['ESIA_Terms_of_Reference.pdf', 'Corridor_Map.pdf', 'Stakeholder_Template.xlsx', 'Financial_Proposal_Template.xlsx'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Environmental Impact Assessment Certificate', body: 'National Environment Management Council (NEMC)', mandatory: true },
                { group: 'Environmental and Safety', license: 'Environmental Compliance Certificate', body: 'National Environment Management Council (NEMC)', mandatory: false }
            ],
            requirements: {
                fields: {
                    consultancyEntityBackground: [
                        { organizationBackground: 'DART plans new BRT infrastructure to improve urban mobility and reduce congestion.', departmentUnit: 'Planning', fundingSource: 'Development Partner' }
                    ],
                    consultancyProjectBackground: {
                        projectName: 'BRT Corridor ESIA',
                        backgroundNarrative: 'The corridor will affect dense urban areas and requires robust environmental and social risk assessment.',
                        existingChallenges: 'Traffic congestion, informal trading impacts, drainage constraints, and construction disruption risks.',
                        currentSituation: 'Pre-feasibility alignment is available and detailed assessment is required.',
                        relatedInitiatives: 'Urban transport master plan and existing BRT phases.'
                    },
                    consultancyProblemStatement: {
                        mainProblemDescription: 'The project must identify, mitigate, and disclose environmental and social impacts before investment approval.',
                        expectedImpact: 'Compliant ESIA package, improved stakeholder confidence, and actionable mitigation measures.'
                    },
                    consultancyGeneralObjective: 'Prepare a compliant ESIA and related environmental and social management instruments for the proposed BRT corridor.',
                    consultancySpecificObjectives: [
                        { objectiveTitle: 'Baseline assessment', objectiveDescription: 'Collect environmental and social baseline data along the corridor.', priorityLevel: 'High' },
                        { objectiveTitle: 'Impact assessment', objectiveDescription: 'Assess construction and operational impacts and propose mitigations.', priorityLevel: 'High' },
                        { objectiveTitle: 'Stakeholder disclosure', objectiveDescription: 'Conduct consultations and document feedback.', priorityLevel: 'High' }
                    ],
                    consultancyAssignmentActivities: [
                        { activityTitle: 'Baseline field surveys', detailedDescription: 'Conduct air, noise, drainage, land use, traffic, and social baseline surveys.', expectedOutput: 'Baseline survey report', location: 'Corridor alignment', duration: 30, mandatory: true },
                        { activityTitle: 'Stakeholder consultations', detailedDescription: 'Plan and conduct consultations with communities, businesses, and institutions.', expectedOutput: 'Consultation report', location: 'Dar es Salaam', duration: 25, mandatory: true },
                        { activityTitle: 'ESMP and disclosure package', detailedDescription: 'Prepare ESMP, monitoring plan, and disclosure documents.', expectedOutput: 'ESMP and disclosure package', location: 'Dar es Salaam', duration: 35, mandatory: true }
                    ],
                    consultancyClientResponsibilities: [
                        { responsibilityTitle: 'Provide corridor design data', description: 'Share maps, design notes, and traffic studies.', supportType: 'Document access' },
                        { responsibilityTitle: 'Facilitate authority meetings', description: 'Coordinate meetings with municipal and environmental authorities.', supportType: 'Meeting coordination' }
                    ],
                    consultancyConsultantResponsibilities: [
                        { responsibility: 'Conduct ESIA fieldwork', description: 'Lead baseline surveys, consultations, and impact analysis.', reportingFrequency: 'Weekly' },
                        { responsibility: 'Prepare approval-ready documents', description: 'Submit ESIA, ESMP, and disclosure documents aligned to NEMC requirements.', reportingFrequency: 'Monthly' }
                    ],
                    consultancyDeliverables: [
                        { deliverableName: 'Inception report', description: 'Methodology, schedule, and stakeholder plan.', submissionTimeline: '2 weeks from contract start', formatRequired: 'PDF', reviewer: 'Project Manager', mandatory: true },
                        { deliverableName: 'Draft ESIA and ESMP', description: 'Full draft assessment and mitigation plan.', submissionTimeline: '10 weeks from contract start', formatRequired: 'PDF', reviewer: 'Buyer', mandatory: true },
                        { deliverableName: 'Final ESIA disclosure package', description: 'Final documents incorporating comments.', submissionTimeline: 'End of assignment', formatRequired: 'PDF', reviewer: 'Accounting Officer', mandatory: true }
                    ],
                    consultancyReportingRequirements: [
                        { reportType: 'Weekly progress report', frequency: 'Weekly', submissionFormat: 'PDF', submissionChannel: 'Email' },
                        { reportType: 'Monthly report', frequency: 'Monthly', submissionFormat: 'PDF', submissionChannel: 'Procurement portal' }
                    ],
                    consultancyFirmExperience: [
                        { minimumYearsExperience: 7, requiredSimilarAssignments: 3, sectorExperience: ['Environment', 'Transport', 'Public sector'], requiredEvidence: 'Required' }
                    ],
                    consultancyKeyExperts: [
                        { positionTitle: 'Lead Environmental Specialist', minimumQualification: 'Masters Degree', yearsOfExperience: 10, certifications: 'NEMC registration', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Social Safeguards Specialist', minimumQualification: 'Masters Degree', yearsOfExperience: 8, certifications: 'Resettlement planning experience', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Urban Transport Planner', minimumQualification: 'Bachelor Degree', yearsOfExperience: 7, certifications: 'Transport planning references', quantityRequired: 1, mandatory: true }
                    ],
                    consultancyReportingStructure: [
                        { consultantReportsTo: 'Project Manager', supervisingOfficer: 'Head of Department', approvalAuthority: 'Accounting Officer' }
                    ]
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Consultant must comply with NEMC review requirements.' },
                        { text: 'Consultation records must include attendance, issues raised, and response matrix.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Understanding of TOR', weight: 25, subcriteria: ['Environmental risks', 'Urban social impacts'] },
                    { name: 'Methodology and work plan', weight: 30, subcriteria: ['Baseline design', 'Consultation plan', 'ESMP quality'] },
                    { name: 'Key expert qualifications', weight: 25, subcriteria: ['Environmental lead', 'Social safeguards', 'Transport planner'] },
                    { name: 'Financial proposal', weight: 10, subcriteria: ['Fee realism', 'Survey costs'] },
                    { name: 'Knowledge transfer', weight: 10, subcriteria: ['Authority engagement', 'Disclosure support'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-23' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-22' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-08' },
                { id: 'milestone-opening', name: 'Technical opening', date: '2026-07-09' },
                { id: 'milestone-evaluation', name: 'Technical evaluation complete', date: '2026-07-29' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-19' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Lead environmental specialist input', qty: 70, unit: 'Day', rate: 1650000 },
                { item: '1.2', description: 'Social safeguards specialist input', qty: 70, unit: 'Day', rate: 1500000 },
                { item: '1.3', description: 'Urban transport planner input', qty: 50, unit: 'Day', rate: 1400000 },
                { item: '1.4', description: 'Field surveys, consultations, and disclosure logistics', qty: 1, unit: 'Lot', rate: 649500000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Lead environmental specialist input', qty: 70, unit: 'Day', rate: 1650000 },
                { item: '1.2', description: 'Social safeguards specialist input', qty: 70, unit: 'Day', rate: 1500000 },
                { item: '1.3', description: 'Urban transport planner input', qty: 50, unit: 'Day', rate: 1400000 },
                { item: '1.4', description: 'Field surveys, consultations, and disclosure logistics', qty: 1, unit: 'Lot', rate: 649500000 }
            ],
            deliverables: ['Inception report', 'Baseline survey report', 'Draft ESIA and ESMP', 'Final disclosure package'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Corridor map revisions can be issued as addenda.' }],
            interestedSuppliers: [
                { name: 'EcoPlan Consultants', status: 'Downloaded TOR', lastActivity: 'Today' },
                { name: 'UrbanSafeguards Africa', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-CNS-2026-003',
            title: 'Technical Audit of Regional Road Maintenance Program',
            type: 'Consultancy',
            procurementTypeId: 'consultancy',
            status: 'Open',
            budget: 720000000,
            closingDate: '2026-06-27',
            organization: 'Tanzania National Roads Agency',
            description: 'Independent technical audit of road maintenance contracts, quality controls, measurement records, payment certificates, and remedial action plans.',
            eligibility: 'Open Tender / Engineering audit consultancy / Registered professional engineers and road maintenance audit experience required.',
            category: 'Engineering Consultancy',
            categories: ['Engineering Consultancy', 'Roads and Bridges', 'Procurement Consultancy'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Mwanza, Geita, Shinyanga, and Simiyu',
            commercialModel: 'Financial Proposal',
            documents: ['Road_Audit_TOR.pdf', 'Contract_Sample_List.xlsx', 'Audit_Report_Template.docx', 'Financial_Proposal_Template.xlsx'],
            regulatoryLicenses: [
                { group: 'Specialized Services', license: 'Calibration Certificate', body: 'Weights and Measures Agency (WMA)', mandatory: false },
                { group: 'Construction and Real Estate', license: 'Building Permit', body: 'Contractors Registration Board (CRB) and Local Government Authorities', mandatory: false }
            ],
            requirements: {
                fields: {
                    consultancyEntityBackground: [
                        { organizationBackground: 'TANROADS manages maintenance and rehabilitation of trunk and regional roads.', departmentUnit: 'Engineering', fundingSource: 'Road fund' }
                    ],
                    consultancyProjectBackground: {
                        projectName: 'Regional Road Maintenance Technical Audit',
                        backgroundNarrative: 'The agency requires independent verification of maintenance quality and payment measurement accuracy.',
                        existingChallenges: 'Variation in quality documentation, measurement records, and remedial follow-up across regions.',
                        currentSituation: 'Maintenance contracts are active and audit sampling is required.',
                        relatedInitiatives: 'Road asset management improvement program.'
                    },
                    consultancyProblemStatement: {
                        mainProblemDescription: 'The buyer needs assurance that road maintenance works meet specifications and payments are supported by verified quantities.',
                        expectedImpact: 'Improved quality control, payment assurance, and corrective action tracking.'
                    },
                    consultancyGeneralObjective: 'Carry out an independent technical audit of selected regional road maintenance contracts.',
                    consultancySpecificObjectives: [
                        { objectiveTitle: 'Quality verification', objectiveDescription: 'Inspect sampled works against specifications.', priorityLevel: 'High' },
                        { objectiveTitle: 'Measurement review', objectiveDescription: 'Review BOQ measurements, site records, and payment certificates.', priorityLevel: 'High' },
                        { objectiveTitle: 'Corrective action planning', objectiveDescription: 'Recommend remedial actions and monitoring controls.', priorityLevel: 'Medium' }
                    ],
                    consultancyAssignmentActivities: [
                        { activityTitle: 'Document and payment review', detailedDescription: 'Review contracts, BOQs, measurement sheets, and certificates.', expectedOutput: 'Document review memo', location: 'Regional offices', duration: 20, mandatory: true },
                        { activityTitle: 'Field inspection and sampling', detailedDescription: 'Inspect roads, structures, drainage, and material quality evidence.', expectedOutput: 'Inspection records', location: 'Four regions', duration: 35, mandatory: true },
                        { activityTitle: 'Audit report and action plan', detailedDescription: 'Prepare findings, risk ratings, and remedial action plan.', expectedOutput: 'Final audit report', location: 'Dar es Salaam', duration: 20, mandatory: true }
                    ],
                    consultancyClientResponsibilities: [
                        { responsibilityTitle: 'Provide contract records', description: 'Share contract files, payment certificates, and site instructions.', supportType: 'Document access' },
                        { responsibilityTitle: 'Facilitate site access', description: 'Coordinate regional engineers and site access.', supportType: 'Logistics' }
                    ],
                    consultancyConsultantResponsibilities: [
                        { responsibility: 'Conduct independent inspections', description: 'Inspect works, collect evidence, and document nonconformities.', reportingFrequency: 'Weekly' },
                        { responsibility: 'Submit audit recommendations', description: 'Prepare prioritized corrective action plan.', reportingFrequency: 'Monthly' }
                    ],
                    consultancyDeliverables: [
                        { deliverableName: 'Inception and sampling plan', description: 'Audit methodology and sampled contracts.', submissionTimeline: '2 weeks from start', formatRequired: 'PDF', reviewer: 'Project Manager', mandatory: true },
                        { deliverableName: 'Draft audit report', description: 'Preliminary findings and evidence annexes.', submissionTimeline: '10 weeks from start', formatRequired: 'PDF', reviewer: 'Engineering', mandatory: true },
                        { deliverableName: 'Final audit and action plan', description: 'Final report with corrective actions and monitoring indicators.', submissionTimeline: 'End of assignment', formatRequired: 'PDF', reviewer: 'Accounting Officer', mandatory: true }
                    ],
                    consultancyReportingRequirements: [
                        { reportType: 'Weekly progress report', frequency: 'Weekly', submissionFormat: 'PDF', submissionChannel: 'Email' },
                        { reportType: 'Final report', frequency: 'On demand', submissionFormat: 'PDF', submissionChannel: 'Procurement portal' }
                    ],
                    consultancyFirmExperience: [
                        { minimumYearsExperience: 8, requiredSimilarAssignments: 4, sectorExperience: ['Infrastructure', 'Transport', 'Public sector'], requiredEvidence: 'Required' }
                    ],
                    consultancyKeyExperts: [
                        { positionTitle: 'Team Leader / Highway Engineer', minimumQualification: 'Masters Degree', yearsOfExperience: 12, certifications: 'Professional Engineer', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Quantity Surveyor', minimumQualification: 'Bachelor Degree', yearsOfExperience: 8, certifications: 'AQRB or equivalent', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Materials Engineer', minimumQualification: 'Bachelor Degree', yearsOfExperience: 8, certifications: 'Materials testing experience', quantityRequired: 1, mandatory: true }
                    ],
                    consultancyReportingStructure: [
                        { consultantReportsTo: 'Project Manager', supervisingOfficer: 'Director', approvalAuthority: 'Accounting Officer' }
                    ]
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Consultant must disclose any past involvement in audited contracts.' },
                        { text: 'All field evidence must be geo-tagged where possible.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Understanding of TOR', weight: 25, subcriteria: ['Audit risks', 'Road maintenance context'] },
                    { name: 'Methodology and work plan', weight: 30, subcriteria: ['Sampling plan', 'Inspection methods', 'Reporting'] },
                    { name: 'Key expert qualifications', weight: 25, subcriteria: ['Highway engineer', 'Quantity surveyor', 'Materials engineer'] },
                    { name: 'Financial proposal', weight: 10, subcriteria: ['Fees', 'Field logistics'] },
                    { name: 'Knowledge transfer', weight: 10, subcriteria: ['Corrective action tools', 'Lessons learned'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-18' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-11' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-27' },
                { id: 'milestone-opening', name: 'Technical opening', date: '2026-06-29' },
                { id: 'milestone-evaluation', name: 'Technical evaluation complete', date: '2026-07-17' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-07' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Team leader / highway engineer input', qty: 65, unit: 'Day', rate: 1600000 },
                { item: '1.2', description: 'Quantity surveyor input', qty: 55, unit: 'Day', rate: 1200000 },
                { item: '1.3', description: 'Materials engineer input', qty: 55, unit: 'Day', rate: 1200000 },
                { item: '1.4', description: 'Field inspections, travel, testing, and reporting costs', qty: 1, unit: 'Lot', rate: 484000000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Team leader / highway engineer input', qty: 65, unit: 'Day', rate: 1600000 },
                { item: '1.2', description: 'Quantity surveyor input', qty: 55, unit: 'Day', rate: 1200000 },
                { item: '1.3', description: 'Materials engineer input', qty: 55, unit: 'Day', rate: 1200000 },
                { item: '1.4', description: 'Field inspections, travel, testing, and reporting costs', qty: 1, unit: 'Lot', rate: 484000000 }
            ],
            deliverables: ['Inception and sampling plan', 'Field inspection records', 'Draft audit report', 'Final corrective action plan'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Contract sample list can be updated before closing.' }],
            interestedSuppliers: [
                { name: 'RoadAudit Associates', status: 'Downloaded TOR', lastActivity: 'Today' },
                { name: 'InfraCheck Consulting', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-CNS-2026-004',
            title: 'Market Study for Pharmaceutical Supply Chain Optimization',
            type: 'Consultancy',
            procurementTypeId: 'consultancy',
            status: 'Open',
            budget: 560000000,
            closingDate: '2026-07-01',
            organization: 'Medical Stores Department',
            description: 'Research consultancy to map medicine demand patterns, warehouse capacity, distribution bottlenecks, and optimization options for public health supply chains.',
            eligibility: 'Open Tender / Research consultancy / Firm or consortium with pharmaceutical logistics, data analysis, and health supply chain experience.',
            category: 'Procurement Consultancy',
            categories: ['Procurement Consultancy', 'Health', 'Research'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Dar es Salaam plus zonal warehouses',
            commercialModel: 'Financial Proposal',
            documents: ['Supply_Chain_Study_TOR.pdf', 'Data_Request_Template.xlsx', 'Report_Template.docx', 'Financial_Proposal_Template.xlsx'],
            regulatoryLicenses: [
                { group: 'Food, Drugs and Cosmetics', license: 'Pharmaceutical Business License', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)', mandatory: false }
            ],
            requirements: {
                fields: {
                    consultancyEntityBackground: [
                        { organizationBackground: 'MSD manages procurement, storage, and distribution of medicines and medical supplies for public health facilities.', departmentUnit: 'Planning', fundingSource: 'Own Source' }
                    ],
                    consultancyProjectBackground: {
                        projectName: 'Pharmaceutical Supply Chain Optimization Study',
                        backgroundNarrative: 'Medicine demand and distribution performance vary by product group and region, creating stock-out and overstock risks.',
                        existingChallenges: 'Demand forecasting gaps, route inefficiencies, warehouse capacity constraints, and fragmented performance data.',
                        currentSituation: 'Historic transaction and warehouse data are available for analysis.',
                        relatedInitiatives: 'Digital inventory improvement and health commodity security initiatives.'
                    },
                    consultancyProblemStatement: {
                        mainProblemDescription: 'The buyer needs evidence-based options to improve forecasting, storage, and distribution of pharmaceutical commodities.',
                        expectedImpact: 'Reduced stock-outs, better inventory turnover, and improved distribution planning.'
                    },
                    consultancyGeneralObjective: 'Conduct a market and operational study that recommends practical optimization options for pharmaceutical supply chains.',
                    consultancySpecificObjectives: [
                        { objectiveTitle: 'Demand pattern analysis', objectiveDescription: 'Analyze historical medicine demand and seasonality.', priorityLevel: 'High' },
                        { objectiveTitle: 'Distribution bottleneck mapping', objectiveDescription: 'Identify warehouse and route constraints.', priorityLevel: 'High' },
                        { objectiveTitle: 'Optimization roadmap', objectiveDescription: 'Recommend actions, systems, and capacity improvements.', priorityLevel: 'Medium' }
                    ],
                    consultancyAssignmentActivities: [
                        { activityTitle: 'Data review and cleaning', detailedDescription: 'Review procurement, inventory, and distribution datasets.', expectedOutput: 'Data quality memo', location: 'Dar es Salaam', duration: 20, mandatory: true },
                        { activityTitle: 'Warehouse and route assessment', detailedDescription: 'Visit selected warehouses and review distribution routes.', expectedOutput: 'Operational assessment report', location: 'Zonal warehouses', duration: 25, mandatory: true },
                        { activityTitle: 'Optimization modeling', detailedDescription: 'Model demand patterns, reorder rules, and route options.', expectedOutput: 'Optimization options paper', location: 'Remote and Dar es Salaam', duration: 30, mandatory: true }
                    ],
                    consultancyClientResponsibilities: [
                        { responsibilityTitle: 'Provide datasets', description: 'Share anonymized inventory, procurement, and distribution records.', supportType: 'Data access' },
                        { responsibilityTitle: 'Coordinate warehouse visits', description: 'Arrange site visits and staff interviews.', supportType: 'Logistics' }
                    ],
                    consultancyConsultantResponsibilities: [
                        { responsibility: 'Protect confidential supply data', description: 'Maintain data confidentiality and secure analysis environment.', reportingFrequency: 'Monthly' },
                        { responsibility: 'Prepare optimization recommendations', description: 'Develop actionable roadmap with cost, risk, and implementation effort.', reportingFrequency: 'Monthly' }
                    ],
                    consultancyDeliverables: [
                        { deliverableName: 'Inception report', description: 'Methodology, work plan, and data request plan.', submissionTimeline: '2 weeks from start', formatRequired: 'PDF', reviewer: 'Project Manager', mandatory: true },
                        { deliverableName: 'Diagnostic report', description: 'Demand, warehouse, and route findings.', submissionTimeline: '8 weeks from start', formatRequired: 'PDF', reviewer: 'User Department', mandatory: true },
                        { deliverableName: 'Optimization roadmap', description: 'Recommendations, implementation plan, and KPIs.', submissionTimeline: 'End of assignment', formatRequired: 'PowerPoint', reviewer: 'Accounting Officer', mandatory: true }
                    ],
                    consultancyReportingRequirements: [
                        { reportType: 'Monthly report', frequency: 'Monthly', submissionFormat: 'PDF', submissionChannel: 'Procurement portal' },
                        { reportType: 'Ad hoc report', frequency: 'On demand', submissionFormat: 'Excel', submissionChannel: 'Email' }
                    ],
                    consultancyFirmExperience: [
                        { minimumYearsExperience: 5, requiredSimilarAssignments: 3, sectorExperience: ['Health', 'Research', 'Public sector'], requiredEvidence: 'Required' }
                    ],
                    consultancyKeyExperts: [
                        { positionTitle: 'Health Supply Chain Specialist', minimumQualification: 'Masters Degree', yearsOfExperience: 10, certifications: 'Supply chain professional certification', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Data Analyst', minimumQualification: 'Bachelor Degree', yearsOfExperience: 6, certifications: 'Analytics or statistics certification', quantityRequired: 1, mandatory: true },
                        { positionTitle: 'Pharmaceutical Logistics Expert', minimumQualification: 'Bachelor Degree', yearsOfExperience: 8, certifications: 'Pharmacy or logistics registration', quantityRequired: 1, mandatory: true }
                    ],
                    consultancyReportingStructure: [
                        { consultantReportsTo: 'Project Manager', supervisingOfficer: 'Head of Department', approvalAuthority: 'Accounting Officer' }
                    ]
                },
                lists: {
                    mandatoryDeclarations: [
                        { text: 'Consultant must sign data confidentiality undertaking.' },
                        { text: 'Final models and editable spreadsheets must be handed over.' }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Understanding of TOR', weight: 25, subcriteria: ['Health supply chain', 'Data constraints'] },
                    { name: 'Methodology and work plan', weight: 30, subcriteria: ['Data approach', 'Field assessment', 'Optimization method'] },
                    { name: 'Key expert qualifications', weight: 25, subcriteria: ['Supply chain lead', 'Data analyst', 'Pharma logistics'] },
                    { name: 'Financial proposal', weight: 10, subcriteria: ['Fees', 'Travel cost realism'] },
                    { name: 'Knowledge transfer', weight: 10, subcriteria: ['Model handover', 'User training'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-20' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-15' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-01' },
                { id: 'milestone-opening', name: 'Technical opening', date: '2026-07-02' },
                { id: 'milestone-evaluation', name: 'Technical evaluation complete', date: '2026-07-22' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-12' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Health supply chain specialist input', qty: 55, unit: 'Day', rate: 1450000 },
                { item: '1.2', description: 'Data analyst input', qty: 70, unit: 'Day', rate: 950000 },
                { item: '1.3', description: 'Pharmaceutical logistics expert input', qty: 45, unit: 'Day', rate: 1300000 },
                { item: '1.4', description: 'Field visits, workshops, and analysis tools', qty: 1, unit: 'Lot', rate: 355250000 }
            ],
            boqItems: [
                { item: '1.1', description: 'Health supply chain specialist input', qty: 55, unit: 'Day', rate: 1450000 },
                { item: '1.2', description: 'Data analyst input', qty: 70, unit: 'Day', rate: 950000 },
                { item: '1.3', description: 'Pharmaceutical logistics expert input', qty: 45, unit: 'Day', rate: 1300000 },
                { item: '1.4', description: 'Field visits, workshops, and analysis tools', qty: 1, unit: 'Lot', rate: 355250000 }
            ],
            deliverables: ['Inception report', 'Diagnostic report', 'Optimization model', 'Final roadmap and training session'],
            clarifications: [],
            amendments: [{ title: 'No amendments published', status: 'Ready', detail: 'Dataset availability updates can be issued before closing.' }],
            interestedSuppliers: [
                { name: 'HealthChain Analytics', status: 'Downloaded TOR', lastActivity: 'Today' },
                { name: 'Supply Optima Consulting', status: 'Watching tender', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-GDS-2026-003',
            title: 'Supply of Office Supplies and Stationery',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 85000000,
            closingDate: '2026-06-15',
            organization: 'District Education Office',
            description: 'Annual framework supply of office stationery, printer consumables, paper, pens, and filing materials for district office.',
            eligibility: 'Open Tender / Local stationery supplier with tax clearance.',
            category: 'Office Supplies',
            categories: ['Office Supplies', 'Computer Equipment and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'District Education Office',
            commercialModel: 'Quantity Schedule',
            documents: ['Stationery_List.xlsx', 'Sample_Submission_Form.pdf'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'A4 paper 80gsm ream 500 sheets', unitOfMeasure: 'Ream', quantity: 2400, unitPrice: 18000, totalPrice: 43200000, mandatory: true },
                        { itemDescription: 'Ballpoint pen blue medium', unitOfMeasure: 'Box/50pcs', quantity: 80, unitPrice: 85000, totalPrice: 6800000, mandatory: true },
                        { itemDescription: 'Pencil wooden HB', unitOfMeasure: 'Box/144pcs', quantity: 40, unitPrice: 45000, totalPrice: 1800000, mandatory: true },
                        { itemDescription: 'Correction fluid 20ml', unitOfMeasure: 'Bottle', quantity: 200, unitPrice: 12000, totalPrice: 2400000, mandatory: true },
                        { itemDescription: 'Envelopes brown A4', unitOfMeasure: 'Box/100pcs', quantity: 300, unitPrice: 28000, totalPrice: 8400000, mandatory: true },
                        { itemDescription: 'Printer ink cartridge black', unitOfMeasure: 'Cartridge', quantity: 150, unitPrice: 42000, totalPrice: 6300000, mandatory: true },
                        { itemDescription: 'Highlighter marker set of 4', unitOfMeasure: 'Set', quantity: 200, unitPrice: 35000, totalPrice: 7000000, mandatory: true },
                        { itemDescription: 'Manila folders A4', unitOfMeasure: 'Box/50pcs', quantity: 200, unitPrice: 52000, totalPrice: 10400000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 70, subcriteria: ['Unit rates', 'Total cost'] },
                    { name: 'Quality assurance', weight: 20, subcriteria: ['Product samples', 'Durability'] },
                    { name: 'Delivery capacity', weight: 10, subcriteria: ['Local availability', 'Call-off response'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-20' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-05' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-15' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-16' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-06-22' },
                { id: 'milestone-award', name: 'Award target', date: '2026-06-29' }
            ],
            commercialItems: [
                { item: '1.1', description: 'A4 paper 80gsm', qty: 2400, unit: 'Ream', rate: 18000 },
                { item: '1.2', description: 'Ballpoint pen blue', qty: 80, unit: 'Box', rate: 85000 },
                { item: '1.3', description: 'Printer cartridge black', qty: 150, unit: 'Cartridge', rate: 42000 }
            ],
            deliverables: ['Office supplies delivered', 'Monthly consumption reports'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Local Stationery Services', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Office Plus Tanzania', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-GDS-2026-004',
            title: 'Supply of Tool Kit and Hand Tools',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 125000000,
            closingDate: '2026-06-28',
            organization: 'Local Government Authority',
            description: 'Supply of basic tool kits and hand tools for maintenance teams including hammers, wrenches, screwdrivers, and power tools.',
            eligibility: 'Open Tender / Tools and equipment supplier with safety certification.',
            category: 'Tools and Equipment',
            categories: ['Tools and Equipment', 'Construction and maintenance support equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'LGA headquarters',
            commercialModel: 'Quantity Schedule',
            documents: ['Tool_Specification.pdf', 'Warranty_Terms.pdf'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Complete tool kit with carrying case', unitOfMeasure: 'Kit', quantity: 25, unitPrice: 2800000, totalPrice: 70000000, mandatory: true },
                        { itemDescription: 'Electric drill 750W', unitOfMeasure: 'Unit', quantity: 15, unitPrice: 1800000, totalPrice: 27000000, mandatory: true },
                        { itemDescription: 'Angle grinder 125mm', unitOfMeasure: 'Unit', quantity: 12, unitPrice: 1500000, totalPrice: 18000000, mandatory: true },
                        { itemDescription: 'Safety helmet with visor', unitOfMeasure: 'Unit', quantity: 50, unitPrice: 350000, totalPrice: 17500000, mandatory: true },
                        { itemDescription: 'Safety gloves leather', unitOfMeasure: 'Pair', quantity: 100, unitPrice: 125000, totalPrice: 12500000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 50, subcriteria: ['Unit rates'] },
                    { name: 'Durability and safety', weight: 30, subcriteria: ['Tool quality', 'Safety standards'] },
                    { name: 'Warranty', weight: 20, subcriteria: ['Warranty period', 'After-sales service'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-25' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-15' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-28' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-29' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-06' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-13' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Complete tool kit', qty: 25, unit: 'Kit', rate: 2800000 },
                { item: '1.2', description: 'Electric drill', qty: 15, unit: 'Unit', rate: 1800000 },
                { item: '1.3', description: 'Safety helmet with visor', qty: 50, unit: 'Unit', rate: 350000 }
            ],
            deliverables: ['Tools delivered and functional', 'Warranty cards', 'Safety training guide'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'BuildCo Tools Ltd', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Equipment Plus Tanzania', status: 'Watching', lastActivity: '2 days ago' }
            ]
        },
        {
            id: 'PX-GDS-2026-005',
            title: 'Supply of Solar Lighting Systems for Community Centers',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 285000000,
            closingDate: '2026-07-05',
            organization: 'Community Development Program',
            description: 'Supply and installation of standalone solar lighting systems for 30 community centers including panels, batteries, charge controllers, and LED lights.',
            eligibility: 'Open Tender / Solar equipment supplier with installation experience.',
            category: 'Electrical equipment and components',
            categories: ['Electrical equipment and components', 'Batteries and generators', 'Lighting Fixtures and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Rural community centers across 6 districts',
            commercialModel: 'Quantity Schedule',
            documents: ['System_Specification.pdf', 'Installation_Requirements.pdf', 'Warranty_Conditions.pdf'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'OSHA', mandatory: false }
            ],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Solar panel 100W monocrystalline', unitOfMeasure: 'Unit', quantity: 30, unitPrice: 3500000, totalPrice: 105000000, mandatory: true },
                        { itemDescription: 'Li-ion battery 10kWh', unitOfMeasure: 'Unit', quantity: 30, unitPrice: 2800000, totalPrice: 84000000, mandatory: true },
                        { itemDescription: 'MPPT charge controller 60A', unitOfMeasure: 'Unit', quantity: 30, unitPrice: 850000, totalPrice: 25500000, mandatory: true },
                        { itemDescription: 'LED light fixture kit per system', unitOfMeasure: 'Kit', quantity: 30, unitPrice: 1200000, totalPrice: 36000000, mandatory: true },
                        { itemDescription: 'Installation, wiring, and commissioning', unitOfMeasure: 'System', quantity: 30, unitPrice: 850000, totalPrice: 25500000, mandatory: true },
                        { itemDescription: 'User training and manual per center', unitOfMeasure: 'Pack', quantity: 30, unitPrice: 200000, totalPrice: 6000000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Specification compliance', weight: 40, subcriteria: ['Panel efficiency', 'Battery capacity'] },
                    { name: 'Price', weight: 30, subcriteria: ['Unit rates', 'Installation cost'] },
                    { name: 'Installation and support', weight: 20, subcriteria: ['Experience', 'Training provided'] },
                    { name: 'Warranty', weight: 10, subcriteria: ['Warranty period'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-22' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-18' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-05' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-06' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-20' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-03' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Solar panel 100W', qty: 30, unit: 'Unit', rate: 3500000 },
                { item: '1.2', description: 'Li-ion battery 10kWh', qty: 30, unit: 'Unit', rate: 2800000 },
                { item: '1.3', description: 'Installation and commissioning', qty: 30, unit: 'System', rate: 850000 }
            ],
            deliverables: ['Installed solar systems', 'User training certificates', 'Warranty registration'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'SolarTech Tanzania', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Green Energy Solutions', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-WRK-2026-004',
            title: 'Renovation of District Health Center Block A',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 245000000,
            closingDate: '2026-06-30',
            organization: 'District Health Office',
            description: 'Interior renovation including repainting, tile replacement, window repairs, plumbing fixes, and electrical upgrades for clinic block.',
            eligibility: 'Local building contractor with experience in health facility renovations.',
            category: 'Healthcare infrastructure',
            categories: ['Healthcare infrastructure', 'Concrete and cement', 'Electrical equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'District Health Center',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Renovation_Drawings.pdf', 'BOQ_Template.xlsx', 'Site_Conditions.pdf'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'CRB', mandatory: true }
            ],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Wall preparation and painting', quantity: 1200, unit: 'Sqm', laborCost: 30000000, materialCost: 48000000, equipmentCost: 6000000, totalCost: 84000000, mandatory: true },
                        { workItem: 'Floor tile replacement and grouting', quantity: 800, unit: 'Sqm', laborCost: 40000000, materialCost: 64000000, equipmentCost: 8000000, totalCost: 112000000, mandatory: true },
                        { workItem: 'Window repair and hardware replacement', quantity: 1, unit: 'Lot', laborCost: 8000000, materialCost: 12000000, equipmentCost: 2000000, totalCost: 22000000, mandatory: true },
                        { workItem: 'Electrical rewiring and circuit upgrades', quantity: 1, unit: 'Lot', laborCost: 12000000, materialCost: 15000000, equipmentCost: 3000000, totalCost: 30000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Preparation and demolition complete', targetDate: '2026-08-15', liquidatedDamagesTrigger: true },
                        { milestone: 'Interior finishes complete', targetDate: '2026-09-15', liquidatedDamagesTrigger: true },
                        { milestone: 'Final handover', targetDate: '2026-09-30', liquidatedDamagesTrigger: true }
                    ],
                    siteVisitRequirement: 'Recommended',
                    similarCompletedProjectsRequired: true,
                    keyPersonnelCvsRequired: true,
                    personnelRequirementRows: [
                        { position: 'Project Manager', minimumEducation: 'Diploma', minimumYearsExperience: 5, cvRequired: true, mandatory: true },
                        { position: 'Site Engineer', minimumEducation: 'Diploma', minimumYearsExperience: 4, cvRequired: true, mandatory: true },
                        { position: 'Site Supervisor', minimumEducation: 'Certificate', minimumYearsExperience: 3, cvRequired: true, mandatory: true }
                    ],
                    bankStatementsRequired: false
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Technical competence', weight: 40, subcriteria: ['Methodology', 'Experience'] },
                    { name: 'Price competitiveness', weight: 40, subcriteria: ['BOQ rates', 'Total cost'] },
                    { name: 'Delivery schedule', weight: 10, subcriteria: ['Milestone feasibility'] },
                    { name: 'Compliance', weight: 10, subcriteria: ['Registration', 'Safety plan'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-24' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-12' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-30' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-01' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-15' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-29' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Wall preparation and painting', qty: 1200, unit: 'Sqm', rate: 70000 },
                { item: '2.1', description: 'Floor tile replacement', qty: 800, unit: 'Sqm', rate: 140000 },
                { item: '3.1', description: 'Window repairs', qty: 1, unit: 'Lot', rate: 22000000 },
                { item: '4.1', description: 'Electrical rewiring', qty: 1, unit: 'Lot', rate: 30000000 }
            ],
            deliverables: ['Renovated health center block', 'Defects-free certificate'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Local Builders Ltd', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Construction Services Tanzania', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-WRK-2026-005',
            title: 'Fence Construction for School Compound',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 180000000,
            closingDate: '2026-07-08',
            organization: 'Regional Education Department',
            description: 'Construction of perimeter fence (2.8m height) with concrete posts and wire mesh for primary school compound.',
            eligibility: 'Registered contractor with fence construction experience.',
            category: 'Construction and infrastructure',
            categories: ['Concrete and cement', 'Construction and maintenance support equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Primary School',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Site_Plan.pdf', 'Fence_Specification.xlsx', 'BOQ_Fence.xlsx'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'CRB', mandatory: true }
            ],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Concrete post installation 2.8m height', quantity: 180, unit: 'Unit', laborCost: 25000000, materialCost: 72000000, equipmentCost: 8000000, totalCost: 105000000, mandatory: true },
                        { workItem: 'Wire mesh fencing 1.2m width', quantity: 720, unit: 'Meter', laborCost: 18000000, materialCost: 28800000, equipmentCost: 3600000, totalCost: 50400000, mandatory: true },
                        { workItem: 'Main gate fabrication and installation', quantity: 1, unit: 'Lot', laborCost: 8000000, materialCost: 12000000, equipmentCost: 2000000, totalCost: 22000000, mandatory: true },
                        { workItem: 'Site cleanup and restoration', quantity: 1, unit: 'Lot', laborCost: 4000000, materialCost: 2000000, equipmentCost: 1000000, totalCost: 7000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Post installation complete', targetDate: '2026-08-30', liquidatedDamagesTrigger: true },
                        { milestone: 'Wire mesh installation complete', targetDate: '2026-09-15', liquidatedDamagesTrigger: true },
                        { milestone: 'Fence final completion', targetDate: '2026-09-30', liquidatedDamagesTrigger: true }
                    ],
                    siteVisitRequirement: 'Recommended'
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 50, subcriteria: ['Unit rates', 'Total cost'] },
                    { name: 'Technical quality', weight: 30, subcriteria: ['Material quality', 'Construction method'] },
                    { name: 'Schedule', weight: 20, subcriteria: ['Timeline feasibility'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-28' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-20' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-08' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-09' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-22' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-05' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Concrete post installation', qty: 180, unit: 'Unit', rate: 583333 },
                { item: '2.1', description: 'Wire mesh fencing', qty: 720, unit: 'Meter', rate: 70000 },
                { item: '3.1', description: 'Main gate fabrication', qty: 1, unit: 'Lot', rate: 22000000 }
            ],
            deliverables: ['Completed fence', 'Maintenance guide'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Fence Builders Tanzania', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Construction Plus', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-WRK-2026-006',
            title: 'Roof Maintenance and Waterproofing',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 95000000,
            closingDate: '2026-06-25',
            organization: 'Municipal Office',
            description: 'Roof leak repair, tile replacement, and waterproofing treatment for office building.',
            eligibility: 'Licensed roofing contractor with warranty.',
            category: 'Building maintenance',
            categories: ['Concrete and cement', 'Construction and maintenance support equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Municipal Office Building',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Roof_Assessment.pdf', 'BOQ_Roof.xlsx'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'CRB', mandatory: false }
            ],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Damaged tile removal and replacement', quantity: 800, unit: 'Unit', laborCost: 12000000, materialCost: 24000000, equipmentCost: 4000000, totalCost: 40000000, mandatory: true },
                        { workItem: 'Crack sealing and waterproofing coating', quantity: 2500, unit: 'Sqm', laborCost: 10000000, materialCost: 20000000, equipmentCost: 5000000, totalCost: 35000000, mandatory: true },
                        { workItem: 'Gutter cleaning and repair', quantity: 1, unit: 'Lot', laborCost: 5000000, materialCost: 8000000, equipmentCost: 2000000, totalCost: 15000000, mandatory: true },
                        { workItem: 'Safety scaffolding and cleanup', quantity: 1, unit: 'Lot', laborCost: 3000000, materialCost: 2000000, equipmentCost: 1000000, totalCost: 6000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Tile replacement complete', targetDate: '2026-07-20', liquidatedDamagesTrigger: true },
                        { milestone: 'Waterproofing complete', targetDate: '2026-08-03', liquidatedDamagesTrigger: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 60, subcriteria: ['Competitive rates'] },
                    { name: 'Quality materials', weight: 25, subcriteria: ['Waterproofing grade'] },
                    { name: 'Warranty', weight: 15, subcriteria: ['2-year warranty'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-22' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-10' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-25' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-26' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-03' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-10' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Tile replacement', qty: 800, unit: 'Unit', rate: 50000 },
                { item: '2.1', description: 'Waterproofing treatment', qty: 2500, unit: 'Sqm', rate: 14000 },
                { item: '3.1', description: 'Gutter repair', qty: 1, unit: 'Lot', rate: 15000000 }
            ],
            deliverables: ['Sealed and waterproof roof', '2-year warranty certificate'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Roof Care Services', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-WRK-2026-007',
            title: 'Installation of Water Harvesting Tanks',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 165000000,
            closingDate: '2026-07-12',
            organization: 'Community Water Project',
            description: 'Supply and installation of 40 x 10,000-liter rainwater harvesting tanks with guttering, pipes, and filtration systems.',
            eligibility: 'Contractor with water systems experience.',
            category: 'Water infrastructure',
            categories: ['Water Pumps and Spare Parts', 'Concrete and cement', 'Water and Sewer Treatment Equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Community centers across 8 villages',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Tank_Specification.pdf', 'Installation_Drawing.pdf', 'BOQ_Tanks.xlsx'],
            regulatoryLicenses: [
                { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'CRB', mandatory: true }
            ],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Plastic tank 10,000L with stand', quantity: 40, unit: 'Unit', laborCost: 8000000, materialCost: 60000000, equipmentCost: 4000000, totalCost: 72000000, mandatory: true },
                        { workItem: 'Gutter, downpipe, and first flush device', quantity: 40, unit: 'Set', laborCost: 6000000, materialCost: 24000000, equipmentCost: 2000000, totalCost: 32000000, mandatory: true },
                        { workItem: 'Sand and gravel filtration installation', quantity: 40, unit: 'Set', laborCost: 4000000, materialCost: 16000000, equipmentCost: 2000000, totalCost: 22000000, mandatory: true },
                        { workItem: 'Foundation, connection, and testing', quantity: 1, unit: 'Lot', laborCost: 18000000, materialCost: 12000000, equipmentCost: 9000000, totalCost: 39000000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Tank foundations and installation complete', targetDate: '2026-09-01', liquidatedDamagesTrigger: true },
                        { milestone: 'Guttering and filtration complete', targetDate: '2026-09-20', liquidatedDamagesTrigger: true },
                        { milestone: 'System commissioning complete', targetDate: '2026-10-05', liquidatedDamagesTrigger: false }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Technical competence', weight: 40, subcriteria: ['Installation method', 'Quality assurance'] },
                    { name: 'Price', weight: 35, subcriteria: ['Competitive rates', 'Total cost'] },
                    { name: 'Schedule', weight: 15, subcriteria: ['Timeline'] },
                    { name: 'Support', weight: 10, subcriteria: ['Training provided'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-29' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-25' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-12' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-13' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-27' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-10' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Plastic tank 10,000L', qty: 40, unit: 'Unit', rate: 1800000 },
                { item: '2.1', description: 'Gutter and filtration set', qty: 40, unit: 'Set', rate: 1375000 },
                { item: '3.1', description: 'Foundation and commissioning', qty: 1, unit: 'Lot', rate: 39000000 }
            ],
            deliverables: ['Installed water tanks', 'Operation manual', 'Maintenance training'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Water Systems Ltd', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Environmental Solutions', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-SRV-2026-003',
            title: 'Office Cleaning and Maintenance Services',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 72000000,
            closingDate: '2026-06-20',
            organization: 'District Administrative Office',
            description: 'Daily office cleaning, waste management, and grounds maintenance for 12 months.',
            eligibility: 'Local cleaning service provider with trained staff.',
            category: 'Cleaning',
            categories: ['Cleaning Equipment and Supplies', 'Waste Management'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'District Office Compound',
            commercialModel: 'Service Schedule',
            documents: ['Cleaning_Scope.pdf', 'SLA_Requirements.pdf'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'OSHA', mandatory: false }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Cleaning',
                    scopeOfServices: 'Daily office cleaning, corridor sanitization, waste removal, grounds maintenance, and quarterly deep cleaning.',
                    serviceLocations: [
                        { text: 'Main office building' },
                        { text: 'Office compound and grounds' }
                    ],
                    duration: '12 months',
                    supportHours: '6 AM - 8 PM Monday to Friday, 7 AM - 12 PM Saturday',
                    responseTime: 'Same day for routine, 4 hours for urgent',
                    commercialItems: [
                        { item: '1.1', description: 'Daily office cleaning', qty: 12, unit: 'Month', rate: 4500000 },
                        { item: '1.2', description: 'Waste removal service', qty: 12, unit: 'Month', rate: 1500000 },
                        { item: '1.3', description: 'Quarterly deep cleaning', qty: 4, unit: 'Service', rate: 2000000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 50, subcriteria: ['Monthly rates', 'Service costs'] },
                    { name: 'Service quality', weight: 30, subcriteria: ['Staff training', 'References'] },
                    { name: 'Response time', weight: 20, subcriteria: ['Availability', 'Responsiveness'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-20' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-05' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-20' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-21' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-06-28' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-05' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Daily cleaning', qty: 12, unit: 'Month', rate: 4500000 },
                { item: '1.2', description: 'Waste removal', qty: 12, unit: 'Month', rate: 1500000 },
                { item: '1.3', description: 'Deep cleaning', qty: 4, unit: 'Service', rate: 2000000 }
            ],
            deliverables: ['Clean office premises', 'Monthly cleaning reports'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Clean Team Services', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-SRV-2026-004',
            title: 'Vehicle Maintenance and Repair Services',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 95000000,
            closingDate: '2026-07-01',
            organization: 'Local Government Authority',
            description: 'Preventive and corrective maintenance service for fleet of 20 vehicles for 12 months.',
            eligibility: 'Registered auto repair shop with qualified mechanics.',
            category: 'Vehicle maintenance',
            categories: ['Motor Vehicles', 'Motor Vehicle Components and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Municipal vehicle depot',
            commercialModel: 'Service Schedule',
            documents: ['Fleet_Details.pdf', 'Maintenance_Schedule.pdf', 'SLA_Template.pdf'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'OSHA', mandatory: false }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Vehicle maintenance',
                    scopeOfServices: 'Oil changes, filter replacement, tire rotation, battery checks, brake inspection, and emergency repair on demand.',
                    duration: '12 months',
                    supportHours: '24/7 for emergency breakdowns',
                    responseTime: 'Emergency: 2 hours, Routine: 24 hours',
                    commercialItems: [
                        { item: '1.1', description: 'Monthly preventive maintenance (20 vehicles)', qty: 12, unit: 'Month', rate: 5000000 },
                        { item: '1.2', description: 'Emergency repair call-out service', qty: 1, unit: 'Year', rate: 8000000 },
                        { item: '1.3', description: 'Spare parts markup', qty: 1, unit: 'Year', rate: 3000000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Monthly rate', weight: 50, subcriteria: ['Maintenance cost'] },
                    { name: 'Emergency response', weight: 25, subcriteria: ['24/7 availability', 'Response time'] },
                    { name: 'Experience', weight: 15, subcriteria: ['Fleet maintenance', 'References'] },
                    { name: 'Warranty', weight: 10, subcriteria: ['Repair warranty period'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-24' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-15' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-01' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-02' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-09' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-16' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Monthly maintenance', qty: 12, unit: 'Month', rate: 5000000 },
                { item: '1.2', description: 'Emergency service', qty: 1, unit: 'Year', rate: 8000000 },
                { item: '1.3', description: 'Parts and consumables', qty: 1, unit: 'Year', rate: 3000000 }
            ],
            deliverables: ['Fleet maintenance reports', 'Service logs', 'Repair invoices'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'AutoCare Services', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Fleet Maintenance Ltd', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-SRV-2026-005',
            title: 'Security Guarding Services for Government Building',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 148000000,
            closingDate: '2026-07-06',
            organization: 'Regional Headquarters',
            description: '24/7 security guarding service including gate management, CCTV monitoring, and incident response.',
            eligibility: 'Licensed security company with trained and vetted security personnel.',
            category: 'Security',
            categories: ['Security services', 'Fire Fighting Equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Regional Government Building',
            commercialModel: 'Service Schedule',
            documents: ['Building_Security_Specification.pdf', 'Guard_Requirements.pdf', 'SLA_Requirements.pdf'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'OSHA', mandatory: true }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Security',
                    scopeOfServices: '24/7 security presence, gate control, visitor management, CCTV monitoring, incident reporting, and emergency response.',
                    duration: '12 months',
                    supportHours: '24/7',
                    personnelRequirementRows: [
                        { position: 'Security supervisor', minimumEducation: 'Diploma', minimumYearsExperience: 5, cvRequired: true, mandatory: true },
                        { position: 'Gate officers', minimumEducation: 'Certificate', minimumYearsExperience: 2, cvRequired: false, mandatory: true },
                        { position: 'Patrol security personnel', minimumEducation: 'Certificate', minimumYearsExperience: 1, cvRequired: false, mandatory: true }
                    ],
                    responseTime: 'Critical incidents: 5 minutes, Normal incidents: 30 minutes',
                    commercialItems: [
                        { item: '1.1', description: 'Supervisor (1 person)', qty: 12, unit: 'Month', rate: 2800000 },
                        { item: '1.2', description: 'Gate officers (2 persons)', qty: 12, unit: 'Month', rate: 3600000 },
                        { item: '1.3', description: 'Patrol personnel (2 persons)', qty: 12, unit: 'Month', rate: 3600000 },
                        { item: '1.4', description: 'Uniforms and equipment provision', qty: 1, unit: 'Year', rate: 2500000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Personnel cost', weight: 50, subcriteria: ['Monthly rates'] },
                    { name: 'Guard quality', weight: 25, subcriteria: ['Training', 'Vetting', 'References'] },
                    { name: 'Response capability', weight: 15, subcriteria: ['24/7 staffing', 'Communication'] },
                    { name: 'Equipment', weight: 10, subcriteria: ['Uniforms', 'Radios'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-27' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-18' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-06' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-07' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-20' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-03' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Supervisor', qty: 12, unit: 'Month', rate: 2800000 },
                { item: '1.2', description: 'Gate officers', qty: 12, unit: 'Month', rate: 3600000 },
                { item: '1.3', description: 'Patrol personnel', qty: 12, unit: 'Month', rate: 3600000 },
                { item: '1.4', description: 'Equipment', qty: 1, unit: 'Year', rate: 2500000 }
            ],
            deliverables: ['Security reports', 'Incident logs', 'Monthly attendance'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'SecureGuard Tanzania', status: 'Downloaded', lastActivity: 'Today' },
                { name: 'Professional Security Services', status: 'Watching', lastActivity: 'Yesterday' }
            ]
        },
        {
            id: 'PX-SRV-2026-006',
            title: 'Transport and Courier Service',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 65000000,
            closingDate: '2026-06-28',
            organization: 'Health Office District',
            description: 'Monthly transport and courier service for document delivery, sample collection, and supplies distribution.',
            eligibility: 'Licensed transport company with fuel-efficient vehicles.',
            category: 'Transport',
            categories: ['Transport and logistics', 'Motor Vehicles'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'District and surrounding areas',
            commercialModel: 'Service Schedule',
            documents: ['Service_Routes.pdf', 'SLA_Conditions.pdf'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    serviceCategory: 'Transport',
                    scopeOfServices: 'Weekly document courier runs, monthly supplies delivery, and emergency transport services.',
                    duration: '12 months',
                    supportHours: '7 AM - 6 PM Monday to Friday',
                    commercialItems: [
                        { item: '1.1', description: 'Weekly courier service (50 km per trip)', qty: 52, unit: 'Trip', rate: 400000 },
                        { item: '1.2', description: 'Monthly bulk supplies transport', qty: 12, unit: 'Trip', rate: 850000 },
                        { item: '1.3', description: 'Emergency transport call-out', qty: 1, unit: 'Year', rate: 1500000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Trip cost', weight: 60, subcriteria: ['Courier rates', 'Transport rates'] },
                    { name: 'Vehicle condition', weight: 20, subcriteria: ['Fleet quality', 'Maintenance'] },
                    { name: 'Reliability', weight: 20, subcriteria: ['On-time delivery', 'References'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-21' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-08' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-28' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-29' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-06' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-13' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Weekly courier trips', qty: 52, unit: 'Trip', rate: 400000 },
                { item: '1.2', description: 'Monthly transport', qty: 12, unit: 'Trip', rate: 850000 },
                { item: '1.3', description: 'Emergency service', qty: 1, unit: 'Year', rate: 1500000 }
            ],
            deliverables: ['Delivery receipts', 'Monthly trip logs'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'FastCourier Services', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-006',
            title: 'Supply of Educational Books and Teaching Materials',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 156000000,
            closingDate: '2026-07-02',
            organization: 'Primary Schools Network',
            description: 'Supply of primary school textbooks, workbooks, exercise books, and teaching aids for 45 schools.',
            eligibility: 'Book distributor with school supply experience.',
            category: 'Educational materials',
            categories: ['Developmental and professional teaching aids', 'Classroom decoratives and supplies'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Nationwide school distribution',
            commercialModel: 'Quantity Schedule',
            documents: ['Book_List.xlsx', 'Sample_Books.pdf', 'Delivery_Schedule.pdf'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'English textbook Primary 4', unitOfMeasure: 'Unit', quantity: 18000, unitPrice: 35000, totalPrice: 630000000, mandatory: true },
                        { itemDescription: 'Mathematics textbook Primary 4', unitOfMeasure: 'Unit', quantity: 18000, unitPrice: 32000, totalPrice: 576000000, mandatory: true },
                        { itemDescription: 'Science workbook Primary 4', unitOfMeasure: 'Unit', quantity: 18000, unitPrice: 18000, totalPrice: 324000000, mandatory: true },
                        { itemDescription: 'Exercise book 100 pages', unitOfMeasure: 'Unit', quantity: 15000, unitPrice: 12000, totalPrice: 180000000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 60, subcriteria: ['Unit rates', 'Total cost'] },
                    { name: 'Book quality', weight: 25, subcriteria: ['Durability', 'Content accuracy'] },
                    { name: 'Delivery', weight: 15, subcriteria: ['Timely delivery', 'Packaging'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-27' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-17' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-02' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-03' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-10' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-17' }
            ],
            commercialItems: [
                { item: '1.1', description: 'English textbook', qty: 18000, unit: 'Unit', rate: 35000 },
                { item: '1.2', description: 'Mathematics textbook', qty: 18000, unit: 'Unit', rate: 32000 },
                { item: '1.3', description: 'Science workbook', qty: 18000, unit: 'Unit', rate: 18000 }
            ],
            deliverables: ['Books delivered to schools', 'Delivery certificates'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Educational Publishers Ltd', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-007',
            title: 'Supply of Kitchen Equipment and Cookware',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 48000000,
            closingDate: '2026-06-26',
            organization: 'Hospital Catering Department',
            description: 'Kitchen pots, pans, cutlery, serving trays, and food containers for hospital kitchen.',
            eligibility: 'Kitchenware supplier with food-grade certification.',
            category: 'Kitchen equipment',
            categories: ['Domestic kitchenware and kitchen supplies', 'Commercial and industrial furniture'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Hospital Kitchen',
            commercialModel: 'Quantity Schedule',
            documents: ['Equipment_List.xlsx'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Stainless steel cooking pot 40L', unitOfMeasure: 'Unit', quantity: 10, unitPrice: 1200000, totalPrice: 12000000, mandatory: true },
                        { itemDescription: 'Stainless steel frying pan 60cm', unitOfMeasure: 'Unit', quantity: 12, unitPrice: 850000, totalPrice: 10200000, mandatory: true },
                        { itemDescription: 'Stainless steel serving trays', unitOfMeasure: 'Unit', quantity: 50, unitPrice: 185000, totalPrice: 9250000, mandatory: true },
                        { itemDescription: 'Food containers with lids 20L', unitOfMeasure: 'Unit', quantity: 40, unitPrice: 425000, totalPrice: 17000000, mandatory: true },
                        { itemDescription: 'Cutlery set serving spoons 12pcs', unitOfMeasure: 'Set', quantity: 8, unitPrice: 285000, totalPrice: 2280000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 50, subcriteria: ['Competitive rates'] },
                    { name: 'Quality (food-grade)', weight: 35, subcriteria: ['Material quality'] },
                    { name: 'Durability', weight: 15, subcriteria: ['Warranty'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-25' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-12' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-26' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-27' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-03' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-10' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Stainless steel cooking pot', qty: 10, unit: 'Unit', rate: 1200000 },
                { item: '1.2', description: 'Frying pan', qty: 12, unit: 'Unit', rate: 850000 },
                { item: '1.3', description: 'Serving trays', qty: 50, unit: 'Unit', rate: 185000 }
            ],
            deliverables: ['Kitchen equipment delivered', 'Certification of food-grade materials'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Kitchen Equipment Supplies', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-008',
            title: 'Supply of Medical Consumables and Supplies',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 78000000,
            closingDate: '2026-06-29',
            organization: 'Health Center',
            description: 'Medical gloves, syringes, cotton, gauze, dressing materials, and basic medical consumables for 6 months.',
            eligibility: 'Medical supplies distributor with TMDA registration.',
            category: 'Medical supplies',
            categories: ['Laboratory and scientific equipment', 'Medical facility products', 'Laboratory supplies and fixtures'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Health Center Store',
            commercialModel: 'Quantity Schedule',
            documents: ['Supplies_List.xlsx', 'TMDA_Certification.pdf'],
            regulatoryLicenses: [
                { group: 'Food, Drugs and Cosmetics', license: 'Medical Devices Registration Permit', body: 'TMDA', mandatory: false }
            ],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Latex medical gloves S/M/L (1000 pairs)', unitOfMeasure: 'Box', quantity: 48, unitPrice: 850000, totalPrice: 40800000, mandatory: true },
                        { itemDescription: 'Plastic syringe 5ml with needle', unitOfMeasure: 'Box/100', quantity: 200, unitPrice: 125000, totalPrice: 25000000, mandatory: true },
                        { itemDescription: 'Cotton wool roll 500g', unitOfMeasure: 'Roll', quantity: 100, unitPrice: 45000, totalPrice: 4500000, mandatory: true },
                        { itemDescription: 'Gauze swabs sterile 7.5x7.5cm', unitOfMeasure: 'Box/100', quantity: 60, unitPrice: 185000, totalPrice: 11100000, mandatory: true },
                        { itemDescription: 'Elastic bandage 10cm x 4.5m', unitOfMeasure: 'Roll', quantity: 120, unitPrice: 35000, totalPrice: 4200000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 55, subcriteria: ['Unit rates'] },
                    { name: 'Quality and standards', weight: 30, subcriteria: ['Medical grade', 'Sterility'] },
                    { name: 'Delivery timeliness', weight: 15, subcriteria: ['Stock availability'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-28' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-15' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-29' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-30' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-07' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-14' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Medical gloves (1000 pairs)', qty: 48, unit: 'Box', rate: 850000 },
                { item: '1.2', description: 'Plastic syringes 5ml', qty: 200, unit: 'Box', rate: 125000 },
                { item: '1.3', description: 'Gauze swabs', qty: 60, unit: 'Box', rate: 185000 }
            ],
            deliverables: ['Medical supplies delivered', 'Quality certificates', 'Expiry date documentation'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Medical Supplies Ltd', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-WRK-2026-008',
            title: 'Desk Repairs and Office Furniture Refurbishment',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 38000000,
            closingDate: '2026-06-22',
            organization: 'Administrative Office',
            description: 'Repair of office furniture including desks, chairs, cabinets, and reupholstering of seating.',
            eligibility: 'Furniture restoration and repair specialist.',
            category: 'Furniture repair',
            categories: ['Accommodation and Office furniture'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Office Building',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Furniture_Assessment.pdf', 'BOQ_Repairs.xlsx'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Office desk repairs and polishing', quantity: 120, unit: 'Unit', laborCost: 8000000, materialCost: 6000000, equipmentCost: 1000000, totalCost: 15000000, mandatory: true },
                        { workItem: 'Office chair reupholstering and repairs', quantity: 80, unit: 'Unit', laborCost: 6000000, materialCost: 8000000, equipmentCost: 800000, totalCost: 14800000, mandatory: true },
                        { workItem: 'Filing cabinet repairs and refinishing', quantity: 40, unit: 'Unit', laborCost: 2400000, materialCost: 2400000, equipmentCost: 600000, totalCost: 5400000, mandatory: true },
                        { workItem: 'Quality inspection and delivery', quantity: 1, unit: 'Lot', laborCost: 1200000, materialCost: 800000, equipmentCost: 1800000, totalCost: 3800000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Assessment and work plan complete', targetDate: '2026-06-29', liquidatedDamagesTrigger: false },
                        { milestone: 'Repairs 50% complete', targetDate: '2026-08-10', liquidatedDamagesTrigger: true },
                        { milestone: 'All repairs complete and delivered', targetDate: '2026-09-05', liquidatedDamagesTrigger: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 55, subcriteria: ['Unit rates', 'Total cost'] },
                    { name: 'Quality of workmanship', weight: 30, subcriteria: ['Finishing', 'Durability'] },
                    { name: 'Timeline', weight: 15, subcriteria: ['Schedule feasibility'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-22' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-08' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-22' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-23' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-06-30' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-07' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Desk repairs and polishing', qty: 120, unit: 'Unit', rate: 125000 },
                { item: '1.2', description: 'Chair reupholstering', qty: 80, unit: 'Unit', rate: 185000 },
                { item: '1.3', description: 'Cabinet refinishing', qty: 40, unit: 'Unit', rate: 135000 }
            ],
            deliverables: ['Repaired and refurbished furniture', 'Quality inspection report'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Furniture Restoration Services', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-WRK-2026-009',
            title: 'Landscaping and Grounds Development',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 72000000,
            closingDate: '2026-07-04',
            organization: 'Municipality',
            description: 'Landscaping, garden beds, turf installation, and pathway paving for municipal office grounds.',
            eligibility: 'Landscaping contractor with garden development experience.',
            category: 'Grounds development',
            categories: ['Construction and maintenance support equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Municipal Office Grounds',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: ['Site_Plan.pdf', 'Landscape_Design.pdf', 'BOQ_Landscaping.xlsx'],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Site clearance and soil preparation', quantity: 4500, unit: 'Sqm', laborCost: 9000000, materialCost: 4500000, equipmentCost: 2250000, totalCost: 15750000, mandatory: true },
                        { workItem: 'Garden beds construction with plants', quantity: 6, unit: 'Lot', laborCost: 6000000, materialCost: 12000000, equipmentCost: 1200000, totalCost: 19200000, mandatory: true },
                        { workItem: 'Turf installation and watering system', quantity: 3000, unit: 'Sqm', laborCost: 9000000, materialCost: 15000000, equipmentCost: 3000000, totalCost: 27000000, mandatory: true },
                        { workItem: 'Concrete pathway laying', quantity: 800, unit: 'Sqm', laborCost: 4800000, materialCost: 4800000, equipmentCost: 800000, totalCost: 10400000, mandatory: true }
                    ],
                    worksMilestoneRows: [
                        { milestone: 'Site preparation complete', targetDate: '2026-07-20', liquidatedDamagesTrigger: true },
                        { milestone: 'Garden beds and turf complete', targetDate: '2026-08-15', liquidatedDamagesTrigger: true },
                        { milestone: 'Pathways and landscaping complete', targetDate: '2026-09-10', liquidatedDamagesTrigger: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Design quality', weight: 40, subcriteria: ['Aesthetic appeal', 'Functionality'] },
                    { name: 'Price', weight: 35, subcriteria: ['Unit rates'] },
                    { name: 'Timeline', weight: 15, subcriteria: ['Schedule'] },
                    { name: 'Maintenance plan', weight: 10, subcriteria: ['Aftercare guide'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-30' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-20' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-07-04' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-05' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-18' },
                { id: 'milestone-award', name: 'Award target', date: '2026-08-01' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Site preparation', qty: 4500, unit: 'Sqm', rate: 3500 },
                { item: '2.1', description: 'Garden beds and plants', qty: 6, unit: 'Lot', rate: 3200000 },
                { item: '3.1', description: 'Turf installation', qty: 3000, unit: 'Sqm', rate: 9000 }
            ],
            deliverables: ['Landscaped grounds', 'Maintenance manual', 'Plant care guide'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Green Landscaping Ltd', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-SRV-2026-007',
            title: 'Waste Management and Garbage Collection Service',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 58000000,
            closingDate: '2026-06-30',
            organization: 'Community Center',
            description: '6-month weekly garbage collection, waste segregation, and proper disposal service.',
            eligibility: 'Waste management service provider with proper disposal licensing.',
            category: 'Waste Management',
            categories: ['Waste Management', 'Environmental Protection'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Community Facilities',
            commercialModel: 'Service Schedule',
            documents: ['Waste_SLA.pdf', 'Disposal_Procedures.pdf'],
            regulatoryLicenses: [
                { group: 'Environmental and Safety', license: 'Environmental Compliance Certificate', body: 'NEMC', mandatory: false }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Waste Management',
                    scopeOfServices: 'Weekly garbage collection, waste segregation into recyclables and organic, and proper disposal at approved sites.',
                    duration: '6 months',
                    supportHours: '6 AM - 6 PM',
                    commercialItems: [
                        { item: '1.1', description: 'Weekly collection service (52 weeks)', qty: 1, unit: 'Package', rate: 35000000 },
                        { item: '1.2', description: 'Waste segregation and recycling', qty: 1, unit: 'Package', rate: 12000000 },
                        { item: '1.3', description: 'Disposal site management', qty: 1, unit: 'Package', rate: 8000000 },
                        { item: '1.4', description: 'Monthly compliance reports', qty: 6, unit: 'Report', rate: 500000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 50, subcriteria: ['Service rates'] },
                    { name: 'Environmental compliance', weight: 30, subcriteria: ['Proper disposal', 'Recycling'] },
                    { name: 'Reliability', weight: 20, subcriteria: ['On-time collection', 'References'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-24' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-12' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-30' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-07-01' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-08' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-15' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Weekly collection', qty: 1, unit: 'Package', rate: 35000000 },
                { item: '1.2', description: 'Waste segregation', qty: 1, unit: 'Package', rate: 12000000 },
                { item: '1.3', description: 'Disposal site management', qty: 1, unit: 'Package', rate: 8000000 }
            ],
            deliverables: ['Waste collection schedules', 'Monthly compliance reports', 'Disposal certificates'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'EcoWaste Services', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-SRV-2026-008',
            title: 'Office Catering and Food Service',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 42000000,
            closingDate: '2026-06-27',
            organization: 'Office Department',
            description: 'Daily lunch provision for office staff with 3 menu options and special diet accommodation.',
            eligibility: 'Registered catering company with food handling licenses.',
            category: 'Catering',
            categories: ['Food Services', 'Beverages'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Office Building',
            commercialModel: 'Service Schedule',
            documents: ['Catering_Menu.pdf', 'Dietary_Requirements.pdf', 'Food_Safety_Standards.pdf'],
            regulatoryLicenses: [
                { group: 'Food, Drugs and Cosmetics', license: 'Food Business Permit', body: 'TMDA', mandatory: true }
            ],
            requirements: {
                fields: {
                    serviceCategory: 'Catering',
                    scopeOfServices: 'Daily lunch (250 persons) including rice, main protein, vegetables, and beverages.',
                    duration: '12 months',
                    supportHours: '11:30 AM - 1:30 PM weekdays',
                    commercialItems: [
                        { item: '1.1', description: 'Standard lunch (200 persons)', qty: 240, unit: 'Day', rate: 125000 },
                        { item: '1.2', description: 'Special diet meals (50 persons)', qty: 240, unit: 'Day', rate: 145000 },
                        { item: '1.3', description: 'Beverages and desserts', qty: 1, unit: 'Year', rate: 12000000 },
                        { item: '1.4', description: 'Kitchen hygiene and food safety audit', qty: 2, unit: 'Audit', rate: 800000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Daily meal cost', weight: 50, subcriteria: ['Per person rate'] },
                    { name: 'Menu variety', weight: 25, subcriteria: ['Options diversity', 'Nutrition'] },
                    { name: 'Food safety', weight: 15, subcriteria: ['Hygiene standards', 'Certifications'] },
                    { name: 'Reliability', weight: 10, subcriteria: ['On-time delivery'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-23' },
                { id: 'milestone-clarification', name: 'Clarification deadline', date: '2026-06-10' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-27' },
                { id: 'milestone-opening', name: 'Bid opening', date: '2026-06-28' },
                { id: 'milestone-evaluation', name: 'Evaluation complete', date: '2026-07-05' },
                { id: 'milestone-award', name: 'Award target', date: '2026-07-12' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Standard lunch per person', qty: 240, unit: 'Day', rate: 125000 },
                { item: '1.2', description: 'Special diet meals', qty: 240, unit: 'Day', rate: 145000 },
                { item: '1.3', description: 'Annual beverages', qty: 1, unit: 'Year', rate: 12000000 }
            ],
            deliverables: ['Daily lunch service', 'Monthly consumption reports', 'Food hygiene compliance'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Quality Catering Services', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-009',
            title: 'Supply of Printer Paper 1000 Reams',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 3600000,
            closingDate: '2026-06-15',
            organization: 'District Office',
            description: 'Supply of A4 printer paper 80gsm 1000 reams.',
            eligibility: 'Local stationery supplier.',
            category: 'Office Supplies',
            categories: ['Office Supplies'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'District Office',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'A4 paper 80gsm 500 sheets', unitOfMeasure: 'Ream', quantity: 1000, unitPrice: 3600, totalPrice: 3600000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-28' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-15' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-22' }
            ],
            commercialItems: [
                { item: '1.1', description: 'A4 paper 80gsm', qty: 1000, unit: 'Ream', rate: 3600 }
            ],
            deliverables: ['Paper delivered'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'Local Stationery Shop', status: 'Watching', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-010',
            title: 'Supply of Cleaning Supplies - 3 Months Stock',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 4800000,
            closingDate: '2026-06-18',
            organization: 'Small Health Center',
            description: 'Cleaning detergent, disinfectant, mops, brooms for 3-month supply.',
            eligibility: 'Local cleaning supplier.',
            category: 'Cleaning Equipment and Supplies',
            categories: ['Cleaning Equipment and Supplies'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Health Center Store',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Detergent floor cleaner 20L', unitOfMeasure: 'Drum', quantity: 4, unitPrice: 450000, totalPrice: 1800000, mandatory: true },
                        { itemDescription: 'Disinfectant spray 500ml', unitOfMeasure: 'Bottle', quantity: 24, unitPrice: 60000, totalPrice: 1440000, mandatory: true },
                        { itemDescription: 'Mops and broom set', unitOfMeasure: 'Set', quantity: 3, unitPrice: 520000, totalPrice: 1560000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 80, subcriteria: ['Total cost'] },
                    { name: 'Quality', weight: 20, subcriteria: ['Product grade'] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-30' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-18' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-25' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Cleaning supplies package', qty: 1, unit: 'Package', rate: 4800000 }
            ],
            deliverables: ['Supplies delivered'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-GDS-2026-011',
            title: 'Supply of 50 School Desks',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 7500000,
            closingDate: '2026-06-20',
            organization: 'Primary School',
            description: 'Supply of 50 school desks with attached chairs.',
            eligibility: 'School furniture supplier.',
            category: 'Classroom and instructional furniture',
            categories: ['Classroom and instructional furniture'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Primary School',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'School desk with attached chair', unitOfMeasure: 'Unit', quantity: 50, unitPrice: 150000, totalPrice: 7500000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 70, subcriteria: [] },
                    { name: 'Quality', weight: 30, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-31' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-20' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-27' }
            ],
            commercialItems: [
                { item: '1.1', description: 'School desk with chair', qty: 50, unit: 'Unit', rate: 150000 }
            ],
            deliverables: ['Desks delivered and functional'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: [
                { name: 'School Furniture Ltd', status: 'Downloaded', lastActivity: 'Today' }
            ]
        },
        {
            id: 'PX-GDS-2026-012',
            title: 'Supply of Basic First Aid Kits',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 2400000,
            closingDate: '2026-06-17',
            organization: 'Community Center',
            description: 'Supply of 20 basic first aid kits for community centers.',
            eligibility: 'Medical supplies vendor.',
            category: 'Medical supplies',
            categories: ['Laboratory and scientific equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Community Centers',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Basic first aid kit', unitOfMeasure: 'Kit', quantity: 20, unitPrice: 120000, totalPrice: 2400000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-01' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-17' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-24' }
            ],
            commercialItems: [
                { item: '1.1', description: 'First aid kit', qty: 20, unit: 'Kit', rate: 120000 }
            ],
            deliverables: ['Kits delivered'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-GDS-2026-013',
            title: 'Supply of LED Light Bulbs 500 Units',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 5750000,
            closingDate: '2026-06-22',
            organization: 'Municipal Office',
            description: 'Supply of 500 LED light bulbs for office lighting replacement.',
            eligibility: 'Electrical supplies vendor.',
            category: 'Lighting Fixtures and Accessories',
            categories: ['Lighting Fixtures and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Municipal Office',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'LED bulb 9W Cool White', unitOfMeasure: 'Unit', quantity: 500, unitPrice: 11500, totalPrice: 5750000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 60, subcriteria: [] },
                    { name: 'Quality', weight: 40, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-03' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-22' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-29' }
            ],
            commercialItems: [
                { item: '1.1', description: 'LED bulb 9W', qty: 500, unit: 'Unit', rate: 11500 }
            ],
            deliverables: ['Bulbs delivered'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-GDS-2026-014',
            title: 'Supply of Mattresses 40 Units',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 12000000,
            closingDate: '2026-06-25',
            organization: 'Student Hostel',
            description: 'Supply of 40 single bed foam mattresses for student hostel.',
            eligibility: 'Furniture supplier.',
            category: 'Bedding and Furniture',
            categories: ['Accommodation and Office furniture'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Student Hostel',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Single foam mattress 6 inch', unitOfMeasure: 'Unit', quantity: 40, unitPrice: 300000, totalPrice: 12000000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 50, subcriteria: [] },
                    { name: 'Comfort and durability', weight: 50, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-04' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-25' },
                { id: 'milestone-award', name: 'Award', date: '2026-07-02' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Foam mattress', qty: 40, unit: 'Unit', rate: 300000 }
            ],
            deliverables: ['Mattresses delivered'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-GDS-2026-015',
            title: 'Supply of Traffic Cones 100 Units',
            type: 'Goods',
            procurementTypeId: 'goods',
            status: 'Open',
            budget: 2500000,
            closingDate: '2026-06-19',
            organization: 'Public Works Department',
            description: 'Supply of 100 orange traffic cones 75cm height.',
            eligibility: 'Safety equipment vendor.',
            category: 'Fire Fighting Equipment',
            categories: ['Fire Fighting Equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Public Works Depot',
            commercialModel: 'Quantity Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    quantityScheduleRows: [
                        { itemDescription: 'Traffic cone 75cm orange', unitOfMeasure: 'Unit', quantity: 100, unitPrice: 25000, totalPrice: 2500000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-02' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-19' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-26' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Traffic cone', qty: 100, unit: 'Unit', rate: 25000 }
            ],
            deliverables: ['Cones delivered'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-WRK-2026-010',
            title: 'Minor Repairs to Water Tap System',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 1800000,
            closingDate: '2026-06-17',
            organization: 'Village Water Kiosk',
            description: 'Repair water tap leakage and valve replacement at village water kiosk.',
            eligibility: 'Local plumber.',
            category: 'Water infrastructure',
            categories: ['Water Pumps and Spare Parts'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Village Water Kiosk',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Tap repair and valve replacement', quantity: 1, unit: 'Lot', laborCost: 600000, materialCost: 900000, equipmentCost: 300000, totalCost: 1800000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-31' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-17' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-24' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Water tap repair', qty: 1, unit: 'Lot', rate: 1800000 }
            ],
            deliverables: ['Repaired water tap system'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-WRK-2026-011',
            title: 'Paint Classroom Walls',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 3200000,
            closingDate: '2026-06-20',
            organization: 'Primary School',
            description: 'Interior repainting of 2 classrooms (approx. 150 sqm).',
            eligibility: 'Painter.',
            category: 'Building maintenance',
            categories: ['Exterior finishing materials'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Primary School',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Wall preparation, priming and painting', quantity: 150, unit: 'Sqm', laborCost: 1200000, materialCost: 1600000, equipmentCost: 400000, totalCost: 3200000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 80, subcriteria: [] },
                    { name: 'Quality finish', weight: 20, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-03' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-20' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-27' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Wall painting', qty: 150, unit: 'Sqm', rate: 21333 }
            ],
            deliverables: ['Painted classrooms'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-WRK-2026-012',
            title: 'Fixing Window Panes 20 Units',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 4200000,
            closingDate: '2026-06-18',
            organization: 'School Building',
            description: 'Replace broken window panes and fix frames in school building (20 windows).',
            eligibility: 'Glass worker.',
            category: 'Building maintenance',
            categories: ['Doors and windows and glass'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'School Building',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Window pane replacement with frame fixing', quantity: 20, unit: 'Unit', laborCost: 800000, materialCost: 2800000, equipmentCost: 600000, totalCost: 4200000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-02' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-18' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-25' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Window pane replacement', qty: 20, unit: 'Unit', rate: 210000 }
            ],
            deliverables: ['Fixed windows'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-WRK-2026-013',
            title: 'Install Door Handles 30 Units',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 3000000,
            closingDate: '2026-06-21',
            organization: 'Office Building',
            description: 'Supply and installation of 30 door handles in office building.',
            eligibility: 'Hardware installer.',
            category: 'Building maintenance',
            categories: ['Doors and windows and glass'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Office Building',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Door handle supply and installation', quantity: 30, unit: 'Unit', laborCost: 600000, materialCost: 2100000, equipmentCost: 300000, totalCost: 3000000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-05' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-21' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-28' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Door handle installation', qty: 30, unit: 'Unit', rate: 100000 }
            ],
            deliverables: ['Installed door handles'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-WRK-2026-014',
            title: 'Gutter Cleaning and Repair',
            type: 'Works',
            procurementTypeId: 'works',
            status: 'Open',
            budget: 2400000,
            closingDate: '2026-06-19',
            organization: 'Community Hall',
            description: 'Cleaning, repair, and maintenance of roof gutters.',
            eligibility: 'Maintenance worker.',
            category: 'Building maintenance',
            categories: ['Construction and maintenance support equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Community Hall',
            commercialModel: 'BOQ',
            contractType: 'Unit Price Contract',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    boqRows: [
                        { workItem: 'Gutter cleaning and minor repairs', quantity: 1, unit: 'Lot', laborCost: 1000000, materialCost: 800000, equipmentCost: 600000, totalCost: 2400000, mandatory: true }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Price', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-01' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-19' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-26' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Gutter maintenance', qty: 1, unit: 'Lot', rate: 2400000 }
            ],
            deliverables: ['Clean and repaired gutters'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-SRV-2026-009',
            title: 'Office Messenger Service - 6 Months',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 3000000,
            closingDate: '2026-06-17',
            organization: 'Small Office',
            description: 'Daily office messenger/runner service for document delivery.',
            eligibility: 'Individual or small service provider.',
            category: 'Office Services',
            categories: ['Transport and logistics'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Office Building',
            commercialModel: 'Service Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    serviceCategory: 'Messenger',
                    duration: '6 months',
                    supportHours: '7 AM - 5 PM weekdays',
                    commercialItems: [
                        { item: '1.1', description: 'Daily messenger service', qty: 6, unit: 'Month', rate: 500000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Monthly cost', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-31' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-17' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-24' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Messenger service', qty: 6, unit: 'Month', rate: 500000 }
            ],
            deliverables: ['Daily document delivery service'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-SRV-2026-010',
            title: 'Gardening and Lawn Maintenance - Monthly',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 4500000,
            closingDate: '2026-06-20',
            organization: 'Residential Office',
            description: 'Monthly lawn mowing, weeding, and basic gardening maintenance.',
            eligibility: 'Gardener or landscaping worker.',
            category: 'Maintenance',
            categories: ['Construction and maintenance support equipment'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Office Grounds',
            commercialModel: 'Service Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    serviceCategory: 'Gardening',
                    duration: '12 months',
                    supportHours: 'Weekdays 8 AM - 4 PM',
                    commercialItems: [
                        { item: '1.1', description: 'Monthly lawn maintenance', qty: 12, unit: 'Month', rate: 375000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Monthly rate', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-03' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-20' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-27' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Lawn maintenance', qty: 12, unit: 'Month', rate: 375000 }
            ],
            deliverables: ['Well-maintained lawn and garden'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-SRV-2026-011',
            title: 'Watchman Service - 3 Months',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 4200000,
            closingDate: '2026-06-18',
            organization: 'Small Storage Facility',
            description: 'Nighttime security watchman for 3-month period.',
            eligibility: 'Security personnel.',
            category: 'Security',
            categories: ['Security services'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Storage Facility',
            commercialModel: 'Service Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    serviceCategory: 'Security',
                    duration: '3 months',
                    supportHours: '6 PM - 6 AM',
                    commercialItems: [
                        { item: '1.1', description: 'Watchman service', qty: 3, unit: 'Month', rate: 1400000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Monthly cost', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-02' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-18' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-25' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Watchman service', qty: 3, unit: 'Month', rate: 1400000 }
            ],
            deliverables: ['24/7 facility security'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-SRV-2026-012',
            title: 'Computer Technical Support - Per Month',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 5400000,
            closingDate: '2026-06-22',
            organization: 'Small Business',
            description: 'On-demand computer troubleshooting and maintenance support for 12 months.',
            eligibility: 'IT technician.',
            category: 'IT Support',
            categories: ['Computer Equipment and Accessories'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Business Office',
            commercialModel: 'Service Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    serviceCategory: 'IT Support',
                    duration: '12 months',
                    supportHours: '8 AM - 6 PM weekdays',
                    commercialItems: [
                        { item: '1.1', description: 'Monthly IT support', qty: 12, unit: 'Month', rate: 450000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Monthly support cost', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-06-04' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-22' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-29' }
            ],
            commercialItems: [
                { item: '1.1', description: 'IT support service', qty: 12, unit: 'Month', rate: 450000 }
            ],
            deliverables: ['Technical support and maintenance'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        },
        {
            id: 'PX-SRV-2026-013',
            title: 'Car Wash Service - Weekly',
            type: 'Service',
            procurementTypeId: 'services',
            status: 'Open',
            budget: 2880000,
            closingDate: '2026-06-16',
            organization: 'Vehicle Owner',
            description: 'Weekly car washing and polishing service for 12 months (2 vehicles).',
            eligibility: 'Auto wash service provider.',
            category: 'Vehicle maintenance',
            categories: ['Motor Vehicles'],
            method: 'Open Tender',
            visibility: 'Public marketplace',
            location: 'Office Parking',
            commercialModel: 'Service Schedule',
            documents: [],
            regulatoryLicenses: [],
            requirements: {
                fields: {
                    serviceCategory: 'Vehicle maintenance',
                    duration: '12 months',
                    supportHours: 'Weekdays 7 AM - 4 PM',
                    commercialItems: [
                        { item: '1.1', description: 'Weekly car wash (2 vehicles)', qty: 52, unit: 'Week', rate: 55000 }
                    ]
                }
            },
            evaluation: {
                criteria: [
                    { name: 'Weekly rate', weight: 100, subcriteria: [] }
                ]
            },
            milestones: [
                { id: 'milestone-publication', name: 'Publication', date: '2026-05-30' },
                { id: 'milestone-closing', name: 'Bid closing', date: '2026-06-16' },
                { id: 'milestone-award', name: 'Award', date: '2026-06-23' }
            ],
            commercialItems: [
                { item: '1.1', description: 'Weekly car wash', qty: 52, unit: 'Week', rate: 55000 }
            ],
            deliverables: ['Clean vehicles'],
            clarifications: [],
            amendments: [],
            interestedSuppliers: []
        }
    ],

    // Procurement setup used by the create tender wizard.
    procurementSetup: {
        methods: ['Open Tender', 'Invited Tender'],
        types: [
            {
                id: 'goods',
                label: 'Goods',
                description: 'Physical items, equipment, stock, and supplies.',
                categories: [
                    'Telecommunication Equipment',
                    'Motor Vehicles',
                    'Water Meters and Spare Parts',
                    'Water Pumps and Spare Parts',
                    'Water Filters',
                    'Water Trucks',
                    'Water and Sewer Treatment Equipment and consumables',
                    'Water Survey Equipment',
                    'Water Well Drilling Equipment',
                    'Animal Feeds',
                    'Animals(Livestock) and Related Products',
                    'Animal Watering Machines',
                    'Veterinary Equipment and Supplies',
                    'Wagons and Coaches',
                    'Wagons and Coaches Spare parts',
                    'Locomotive Engines',
                    'Motor Trolleys',
                    'Rail, Sleepers and Clips',
                    'Railway Machinery',
                    'Railway Cranes',
                    'Rail on Truck Equipment (Tamping machinery, Truck Recording Cars, Railway Relaying Machines)',
                    'Furnaces and Incinerators Equipment',
                    'Mining and Quarrying Equipment',
                    'Abrasives and Smoothing Materials',
                    'Nuclear and Radioactive Products',
                    'Packaging Materials',
                    'Marine Vessels',
                    'Aircraft',
                    'Metal, Aluminium and Glass',
                    'Elevators and Escalators',
                    'Fire Fighting Equipment',
                    'Funeral Supplies',
                    'Land Survey Equipment',
                    'Land Cleaning Equipment',
                    'Land Leveling Equipment',
                    'Accommodation and Office furniture and accessories',
                    'Aerospace systems and components and equipment',
                    'Agents affecting water and electrolytes',
                    'Agricultural and forestry and landscape machinery and equipment',
                    'Anti infective drugs',
                    'Antineoplastic agents drugs/Anticancer drugs',
                    'Arts and crafts equipment and accessories and supplies',
                    'Audio and visual presentation and composing equipment',
                    'Autonomic nervous system drugs',
                    'Bank Notes Canceller/Punching Machines',
                    'Batteries and generators and kinetic power transmission',
                    'Bedclothes and table and kitchen linen and towels',
                    'Beehives and Accessories',
                    'Beverages',
                    'Bread and bakery products',
                    'Camping and outdoor equipment and accessories',
                    'Cardiac supplies and Accessories',
                    'Cardiovascular drugs',
                    'Central nervous system drugs',
                    'Cereal and pulse products',
                    'Chicken processing machinery and equipment',
                    'Chocolate and sugars and sweeteners and confectionary products',
                    'Classroom and instructional furniture and accessories',
                    'Classroom decoratives and supplies',
                    'Cleaning Equipment and Supplies',
                    'Clinical nutrition',
                    'Clothing and Uniforms',
                    'Collectibles and awards',
                    'Commercial and industrial furniture and accessories',
                    'Communications Devices and Accessories',
                    'Components for information technology or broadcasting or telecommunications',
                    'Computer Equipment and Accessories',
                    'Computer Software',
                    'Concrete and cement and plaster',
                    'Concrete poles',
                    'Construction and maintenance support equipment',
                    'Consumer electronics',
                    'Containers and storage',
                    'Dairy products',
                    'Data Voice or Multimedia Network Equipment or Platforms and Accessories',
                    'Dental equipment and supplies',
                    'Developmental and professional teaching aids and materials and accessories and supplies',
                    'Dialysis equipment and supplies',
                    'Domestic Gas',
                    'Domestic appliances',
                    'Domestic kitchenware and kitchen supplies',
                    'Domestic wall treatments',
                    'Doors and windows and glass',
                    'Drugs affecting the ears, eye, nose and skin',
                    'Drugs affecting the gastrointestinal system',
                    'Drugs affecting the respiratory tract',
                    'Earth and stone (Mchanga, Vifusi na Kokoto)',
                    'Edible oils and fats',
                    'Electrical Testing Equipment',
                    'Electrical equipment and components and supplies',
                    'Electrical wire and cable and harness',
                    'Electronic hardware and component parts and accessories',
                    'Electronic manufacturing machinery and equipment and accessories',
                    'Electronic reference material',
                    'Emergency and field medical services products',
                    'Exterior finishing materials',
                    'Fertilizers, Plants Nutrients and herbicides',
                    'Fishing and aquaculture equipment',
                    'Fishing and hunting equipment',
                    'Fitness equipment',
                    'Floor coverings',
                    'Footwear',
                    'Foundry machines and equipment and supplies',
                    'Fruits (Fresh, Organic, Dried, Frozen, Pured, Canned or Jarred)',
                    'Fuels',
                    'Gymnastics and boxing equipment',
                    'Heavy construction machinery and equipment',
                    'Hematolic drugs',
                    'Hormones and hormone antagonists',
                    'Hospital beds and Furnitures',
                    'Immunomodulating drugs',
                    'Independent living aids for the physically challenged',
                    'Industrial food and beverage equipment',
                    'Industrial machine tools',
                    'Industrial process machinery and equipment and supplies',
                    'Industrial refrigeration',
                    'Building Insulation Materials',
                    'Interior finishing materials',
                    'Intravenous and arterial administration products',
                    'Laboratory and scientific equipment',
                    'Laboratory supplies and fixtures',
                    'Lapidary machinery and equipment',
                    'Leatherworking repairing machinery and equipment',
                    'Lighting Fixtures and Accessories',
                    'Lubricants',
                    'Luggage and handbags and packs and cases',
                    'Mass transfer equipment',
                    'Material handling machinery and equipment',
                    'Meat and Poultry Products',
                    'Medical apparel and textiles',
                    'Radiology products',
                    'Medical facility products',
                    'Medical sterilization products',
                    'Medical training and education supplies',
                    'Merchandising furniture and accessories',
                    'Metal cutting machinery and accessories',
                    'Metal forming machinery and accessories',
                    'Metal treatment machinery',
                    'Minerals and ores and metals',
                    'Miscellaneous drug categories',
                    'Mixers and their parts and accessories',
                    'Motor Vehicle Components and Accessories',
                    'Motor vehicle Diagnostic Machines and Working Tools',
                    'Musical Instruments and parts and accessories',
                    'Newspaper',
                    'Non motorized cycles',
                    'Nuts and seeds',
                    'Office Supplies and accessories',
                    'Office machines their supplies and accessories',
                    'Oil and gas drilling and exploration equipment',
                    'Oil and gas drilling and operation materials',
                    'Oil and gas operating and production equipment',
                    'Orthopedic and prosthetic and sports medicine products',
                    'Orthopedic surgical implants',
                    'Packing supplies',
                    'Patient care and treatment products and supplies',
                    'Patient exam and monitoring products',
                    'Permanent structures',
                    'Personal care products',
                    'Safety and security equipment',
                    'Pest control products',
                    'Petroleum processing machinery',
                    'Photographic or filming or video equipment and supplies',
                    'Physical and occupational therapy and rehabilitation products',
                    'Plumbing fixtures',
                    'Portable Structure Building Components',
                    'Portable Structures',
                    'Postmortem and mortuary equipment and supplies',
                    'Power plants and equipment',
                    'Prefabricated structures',
                    'Prepared and preserved foods',
                    'Printed Books, Textbooks and Reading Materials',
                    'Printing and publishing machinery/equipment and accessories',
                    'Railway and tramway machinery and equipment',
                    'Rapid prototyping machinery and accessories',
                    'Raw materials processing machinery',
                    'Recreation and playground and swimming and spa equipment and supplies',
                    'Respiratory and anesthesia and resuscitation products',
                    'Road Testing Kits',
                    'Roads and landscape architecture and construction materials',
                    'Sawmilling and lumber processing machinery and equipment',
                    'Seafood',
                    'Seasonings and preservatives',
                    'Security and surveillance Equipment',
                    'Seeds and Seedlings',
                    'Sewing supplies and accessories',
                    'Spacecraft',
                    'Specimen collection and storage supplies',
                    'Sports equipment and accessories',
                    'Stationery',
                    'Structural building products (Blocks, Bricks, Tiles and Flagstones)',
                    'Structural components and basic shapes',
                    'Structural Metals, Bars and Sheets',
                    'Suptum screening drugs',
                    'Surgical products',
                    'Fabrics and Leather Materials',
                    'Textile and fabric machinery and accessories',
                    'Timber',
                    'Timepieces, Jewellery and Gemstones',
                    'Tobacco and smoking products and substitutes',
                    'Toys and games',
                    'Transportation components and systems',
                    'Transportation services equipment',
                    'Underground mining structures and materials',
                    'Urine Screening Drugs',
                    'Vegetables (Fresh, Organic, Dried, Frozen, Canned or Jarred)',
                    'Vehicle bodies and trailers',
                    'Veterinary nutritional supplement',
                    'Waste collection bags',
                    'Water Pipes and Fittings',
                    'Water Supply Equipment',
                    'Water Treatment Chemicals',
                    'Water Treatment Equipment',
                    'Welding and soldering and brazing machinery and accessories and supplies',
                    'Well drilling and operation equipment',
                    'Window treatments',
                    'Wire machinery and equipment',
                    'Wood Briquette',
                    'Wooden poles',
                    'Wound care products',
                    'Measuring , observing and testing instruments',
                    'Heating, ventilation, air circulation and condition Equipment and Accessories',
                    'Veterinary Pharmaceutical and Vaccines',
                    'Painting Products',
                    'Banknotes and Coins Processing',
                    'Signage and accessories',
                    'Motorized cycles',
                    'Marine Vessels Equipment, Spareparts and Accessories',
                    'Pharmaceuticals',
                    'Laboratory equipment and reagents',
                    'Medical Supplies and Equipment',
                    'Vision correction or cosmetic eyewear (eye glasses/spectacles) and related products',
                    'Floriculture and silviculture products',
                    'Mattresses and Sleep Sets',
                    'Aviation Fuel',
                    'Forensic equipment, supplies and accessories',
                    'Live fish',
                    'Live insects',
                    'Decoration Equipment and Accessories',
                    'Natural Gas Distribution Accessories and Equipment/Machineries',
                    'Firearms, Ammunitions and Accessories',
                    'Heavy Duty Gas Cooking Stoves (for Mass Cooking)',
                    'Sisal and sisal fibers',
                    'Fuel Additives',
                    'Coal',
                    'Fuel pumps and spare parts'
                ]
            },
            {
                id: 'works',
                label: 'Works',
                description: 'Construction, rehabilitation, infrastructure, and civil works.',
                categories: [
                    'Building Contractors',
                    'Civil Contractors',
                    'Mechanical Contractors',
                    'Electrical Contractors',
                    'Specialist Building - Carpentry and Joinery',
                    'Specialist Building - Concreting Works',
                    'Specialist Building - Interior Decoration',
                    'Specialist Building - Concrete Treatment and Repairs',
                    'Specialist Building - Water Proofing Installations',
                    'Specialist Building - Paving',
                    'Specialist Building - Pre Fabricated Buildings',
                    'Specialist Building - Demolition',
                    'Specialist Building - Conservation of Old Building',
                    'Specialist Civil - Pilling',
                    'Specialist Civil - Drilling Works',
                    'Specialist Civil - Labour Based Road Works',
                    'Specialist Civil - Land Scaping and Slope Protections',
                    'Specialist Civil - Treatments Plants and Water Works',
                    'Specialist Civil - Marine Works',
                    'Specialist Civil - Tunneling and Underpinning',
                    'Specialist Civil - Tunneling and Mining Works',
                    'Specialist Electrical - Telecommunications ICT and Security Systems Installations',
                    'Specialist Electrical - Power Generation Equipment Installations and Maintenance',
                    'Specialist Electrical - Electric Power lines and Systems',
                    'Specialist Electrical - Air Conditioning and Refrigeration',
                    'Specialist Mechanical - Heating Ventilation and Air Conditioning',
                    'Specialist Mechanical - Fabrication and Installation of Tanks',
                    'Specialist Mechanical - Repair and Installation of Motor Vehicle',
                    'Specialist Mechanical - Scaffolding and Formwork',
                    'Specialist Mechanical - Marine Vessels - Fabrication and Maintenance',
                    'Specialist Mechanical - Pre Fabrication and Erection of Steel Structures',
                    'Specialist Mechanical - Elevators and Escalators Installation and Maintenance',
                    'Specialist Mechanical - Plumbing and Sanitations',
                    'Specialist Mechanical - Metal, Aluminium and Glass Works',
                    'Specialist Mechanical - Fabrication, Installation and Maintenance of Oil and Gas Infrastructure',
                    'Specialist Civil - Road Marking and Furniture',
                    'Specialist Electrical - Renewable Energy Installation - Solar',
                    'Specialist Mechanical - Air Conditioning and Refrigeration',
                    'Specialist Mechanical - Fire Prevention and Protections',
                    'Specialist Mechanical - Installations and Maintenance of Industrial Plant',
                    'Specialist Mechanical - Marine Structure, Ferries and Boat Building',
                    'Specialist Mechanical- installation of biomedical equipment',
                    'Specialist-Maintenance and Repair of Hospital Equipment'
                ]
            },
            {
                id: 'services',
                label: 'Service',
                description: 'Operational services where advisory expertise is not the main component.',
                categories: [
                    'Auction Services',
                    'Printing Services (Business Stationery, Books, Booklets, Brochures, Leaflets, Cards, Forms, Labels, Manuals and Maps)',
                    'Desktop publishing services',
                    'Digital Printing Services',
                    'Engraving Services',
                    'Mailing Services',
                    'Warehousing and Storage Services',
                    'Catering Services',
                    'Building and Compound Cleaning Services',
                    'Fumigation Services',
                    'Security Services',
                    'Service and Maintenance of ICT Equipment',
                    'Service and Maintenance of Fire Fighting Equipment',
                    'Agricultural products Grinding and Milling Services',
                    'Service and Maintenance of Fire Security System',
                    'Internet Services',
                    'Insurance and Brokerage Services',
                    'Conference and Related Services',
                    'Repair and Maintenance of Air conditioners',
                    'Repair and Maintenance of Gymnastic equipment',
                    'Repair and Maintenance of Electrical equipment',
                    'Repair and Maintenance of Jet Machines',
                    'Repair and Maintenance of Backhoe and Excavator Machines',
                    'Repair and Maintenance of Water Pumps and Water Tanks',
                    'Repair and Maintenance of Gas Export Compressors',
                    'Repair and Maintenance of Mining and Quarrying Equipment',
                    'Repair and Maintenance of Power generation plants and equipment',
                    'Advertising Services',
                    'Real Estate Management Services',
                    'Car hiring services',
                    'Documentary and documentation Services',
                    'Events management',
                    'Graphics design services',
                    'Hiring of Printing and Photocopying Services',
                    'Hiring of equipment and plants',
                    'Hospitality services',
                    'Hotel Reservation Services',
                    'Labour services (Repair and Construction Activities)',
                    'Laundry services',
                    'Material packing and handling services',
                    'Packaging Services',
                    'Repair and Maintenance of Furniture and Fittings',
                    'Repair and Maintenance of Locomotives',
                    'Repair and Maintenance of Motor Vehicles (vehicles and motor cycle)',
                    'Repair and Maintenance of Plumbing systems',
                    'Repair and Maintenance of aircrafts and aviation equipment',
                    'Repair and Maintenance of marine equipment',
                    'Repair and Maintenance of other Office Equipment,',
                    'Service and Maintenance of Elevators, escalators and conveyors',
                    'Tailoring services',
                    'Transportation and Handling Services',
                    'Travel facilitation (Ticketing, Visa, Tours, Hotel bookings)',
                    'Veterinary services',
                    'Clearing and Forwarding Services',
                    'Finance and Banking Services',
                    'Network Services',
                    'Voice and Data Services',
                    'Revenue Collection Agency Services',
                    'Video Production Services',
                    'Audio Production Services',
                    'Radio Broadcasting Services',
                    'Television Broadcasting Services',
                    'Online Media Broadcasting Services',
                    'Agricultural seeds treatment, preservation and processing',
                    'Calibration Services',
                    'Machining Services',
                    'ICT System Maintenance and Support',
                    'Water and Sewer treatment Services',
                    'Non Hazardous Waste Management Services',
                    'Hazardous Waste Management Services',
                    'Metal smelting and refining and forming processes',
                    'Metal finishing services',
                    'Repair and maintenance of Medical Equipment',
                    'Material and/ or  product testing and inspection services',
                    'Geological samples testing services',
                    'Vehicle Tracking and Fleet Management Services',
                    'Labour services (General human resources provision)',
                    'Ground Handling Services for Air Transport',
                    'Operation of Government Recreational Buildings or Facilities (Clubs, stadiums, events venues)',
                    'Operation of Government Food Services Buildings or Facilities (Canteens, Cafeteria)',
                    'Operation of Government Commercial Buildings (Shops, Malls, Marketplaces)',
                    'Operation of Government Accommodation Buildings (Housing Complex, Dormitories or Residential Facilities)',
                    'Operation of Government Office Buildings',
                    'Operation of Government Transportation Buildings or Facilities (Terminals, Parking)',
                    'Operation of Government Power/Energy Buildings or Facilities (Plants, Substations)',
                    'Operation of Government Communication Buildings or Facilities (Broadcasting Towers/Facilities)',
                    'Venues Decoration Services',
                    'Passenger transportation services',
                    'Material treatment Services',
                    'Motor vehicles conversion or modification services',
                    'Forest products harvesting and processing',
                    'Forestry Services',
                    'Land Regularization Services',
                    'Miscellaneous Port Services',
                    'Passenger Air Transportation Services',
                    'Cargo Air Transportation Services',
                    'Aerobics and fitness services',
                    'Vehicle cleaning services',
                    'Crop Cultivation Services',
                    'Flight Data Monitoring Services',
                    'Management and Operation of Airline and Aviation Systems',
                    'Motorcycle hiring services',
                    'Repair and Maintenance of Security and Surveillance Equipment',
                    'Repair and Maintenance of Laboratory Equipment',
                    'Wildlife conservation and protection services',
                    'Wildlife control and monitoring services',
                    'Wildlife products harvesting and processing/taxidermy',
                    'Manual Water Meter Reading Services and Related Services',
                    'Underwater Diving Services',
                    'Medical Laboratory Services'
                ]
            },
            {
                id: 'consultancy',
                label: 'Consultancy',
                description: 'Professional advisory, research, design, audit, and expert assignments.',
                categories: [
                    'Information Technology Consultancy',
                    'Business Process Consultancy',
                    'Software Development',
                    'Systems Operations',
                    'Systems Supports and Administration',
                    'Management Consultancy',
                    'Human Resources Consultancy',
                    'Educational Consultancy',
                    'Legal Services Consultancy',
                    'Environmental Consultancy',
                    'Energy Consultancy',
                    'Health Care Consultancy',
                    'Public Relations Consultancy',
                    'Marketing Consultancy',
                    'Organisation and Change Management Consultancy',
                    'Procurement Consultancy',
                    'Tax Consultancy',
                    'Accountancy and auditing',
                    'Financial and audit Services Consultancy',
                    'Oil and Gas Consultancy',
                    'Research, survey and Development Consultancy',
                    'Structural Design',
                    'Transcription',
                    'Translation',
                    'Strategic Planning Consultancy',
                    'Marine Environment Consultancy',
                    'Quality Management Consultancy',
                    'Maritime Management Consultancy',
                    'Proofreading Services',
                    'Careers Development Services',
                    'Personnel Skills Training Services',
                    'Recreational Development Services',
                    'Adult Education Services',
                    'Child Education Services',
                    'Special Needs Education Services',
                    'Vocational Training Services',
                    'Construction Management Services',
                    'Food and Nutrition Services',
                    'Medical Services',
                    'Programme and Project Management Services',
                    'Architectural services',
                    'Forensic and investigation consultancy services',
                    'Health and safety audit services',
                    'Intelligence security and surveillance services',
                    'Land surveying services',
                    'Urban/Town Planning Services',
                    'Civil Engineering Services',
                    'Building Engineering Services',
                    'Mechanical Engineering Services',
                    'Electrical Engineering Services',
                    'Quantity and Building Surveying Services',
                    'Actuarial Services',
                    'Valuation Consultancy Services',
                    'Geoscience Consultancy Services',
                    'Irrigation Engineering Services'
                ]
            }
        ],
        defaultType: 'works'
    },

    // Compliance documents
    complianceDocs: [
        { name: 'BRELA Registration', status: 'approved', uploaded: true },
        { name: 'TIN Certificate', status: 'approved', uploaded: true },
        ],

    // Bid evaluation data
    bidEvaluation: {
        totalBids: 4,
        validSubmissions: 4,
        priceOutliers: 0,
        buyerEvaluationsActive: 1,
        currentStage: 'technical',
        minimumTechnicalPassMark: 70,
        emptyStates: {
            notStarted: 'No evaluation has started yet. Once the tender closes and submissions are opened, this workspace will display bidder responses for structured evaluation.',
            noBids: 'No bids were received for this tender. You may prepare a no-submission report or follow the applicable procurement procedure for re-advertisement or cancellation.',
            completed: 'Evaluation has been completed. The recommendation report is ready for review and approval.',
            returned: 'The recommendation was returned for review. Address the approver comments before resubmitting.'
        },
        activeTender: {
            title: 'Construction of Rural Health Centers',
            reference: 'PX-WRK-2026-001',
            category: 'Works',
            closingDate: 'June 11, 2026, 16:00 EAT',
            evaluationDeadline: 'June 28, 2026',
            status: 'Technical Evaluation Ongoing',
            stage: 'Technical Evaluation',
            bidders: 4,
            conflictStatus: 'Buyer declaration complete',
            method: 'Lowest evaluated substantially responsive bid',
            buyerReviewer: 'Ministry of Health'
        },
        readyTenders: [
            {
                title: 'Construction of Rural Health Centers',
                reference: 'PX-WRK-2026-001',
                category: 'Works',
                closingDate: 'June 11, 2026',
                bidsReceived: 4,
                status: 'Technical Evaluation Ongoing',
                deadline: 'June 28, 2026',
                buyerReviewer: 'Buyer',
                conflictStatus: 'Complete',
                draftStatus: 'Saved as draft',
                progress: 58
            },
            {
                title: 'Supply of Laboratory Equipment',
                reference: 'PX-GDS-2026-002',
                category: 'Goods',
                closingDate: 'June 14, 2026',
                bidsReceived: 6,
                status: 'Opening Completed',
                deadline: 'July 03, 2026',
                buyerReviewer: 'Buyer',
                conflictStatus: 'Pending',
                draftStatus: 'Not started',
                progress: 18
            }
        ],
        stages: [
            { id: 'overview', label: 'Overview', status: 'current' },
            { id: 'opening', label: 'Bid Opening', status: 'done' },
            { id: 'conflict', label: 'Conflict Declarations', status: 'done' },
            { id: 'preliminary', label: 'Preliminary Evaluation', status: 'done' },
            { id: 'eligibility', label: 'Eligibility Review', status: 'done' },
            { id: 'technical', label: 'Technical Evaluation', status: 'current' },
            { id: 'financial', label: 'Financial Evaluation', status: 'pending' },
            { id: 'clarifications', label: 'Clarifications', status: 'pending' },
            { id: 'comparison', label: 'Comparison Matrix', status: 'pending' },
            { id: 'report', label: 'Evaluation Report', status: 'pending' },
            { id: 'recommendation', label: 'Recommendation', status: 'pending' },
            { id: 'audit', label: 'Audit Trail', status: 'active' }
        ],
        roles: [
            { role: 'Buyer', access: 'Review bids, score criteria, comment, and submit report' },
            { role: 'Procurement Officer', access: 'Maintain tender record and support documentation' },
            { role: 'Approver', access: 'Review final report and approve or reject recommendation' },
            { role: 'Observer / Auditor', access: 'Read-only access' },
            { role: 'System Admin', access: 'Manage access, not change scores' }
        ],
        controls: [
            { control: 'Bid lock after deadline', purpose: 'Prevent changes after submission deadline', status: 'Active' },
            { control: 'Role-based access', purpose: 'Only authorized users can evaluate', status: 'Active' },
            { control: 'Conflict declaration', purpose: 'Protect fairness', status: 'Complete' },
            { control: 'Audit trail', purpose: 'Record every action', status: 'Recording' },
            { control: 'Score locking', purpose: 'Prevent score manipulation after submission', status: 'Pending technical close' },
            { control: 'Clarification tracking', purpose: 'Keep official communication', status: 'Available' }
        ],
        openingReport: {
            openingTime: 'June 12, 2026, 10:00 EAT',
            authorizedBy: ['Ministry of Health buyer account'],
            envelope: 'Technical envelope',
            hashStatus: '4 of 4 verified',
            auditReference: 'AUD-BIDOPEN-2026-014',
            disclosureStatus: 'Financial envelope locked until technical scores are finalized',
            message: 'This tender received 4 submissions before the deadline. All submissions are locked and ready for the buyer evaluation review.',
            submissions: [
                { supplier: 'ABC Construction Ltd', time: 'June 11, 2026, 14:38 EAT', status: 'Submitted', documents: ['Technical proposal', 'Method statement', 'Tax clearance', 'Bid security'], technicalOffer: 'Yes', financialOffer: 'Yes', bidSecurity: 'Submitted', deadline: 'Before deadline', remarks: 'Complete opening record.' },
                { supplier: 'XYZ Builders', time: 'June 11, 2026, 15:21 EAT', status: 'Submitted', documents: ['Technical proposal', 'Company registration', 'Financial offer'], technicalOffer: 'Yes', financialOffer: 'Yes', bidSecurity: 'Submitted', deadline: 'Before deadline', remarks: 'Minor document naming issue.' },
                { supplier: 'BuildRight Ltd', time: 'June 10, 2026, 18:04 EAT', status: 'Submitted', documents: ['Technical proposal', 'Work program', 'BOQ', 'Bid security'], technicalOffer: 'Yes', financialOffer: 'Yes', bidSecurity: 'Submitted', deadline: 'Before deadline', remarks: 'Verified without exception.' },
                { supplier: 'Prime Contractors', time: 'June 11, 2026, 13:17 EAT', status: 'Submitted', documents: ['Technical proposal', 'Financial offer', 'Tax clearance'], technicalOffer: 'Yes', financialOffer: 'Yes', bidSecurity: 'Submitted', deadline: 'Before deadline', remarks: 'Opening remarks captured.' }
            ]
        },
        conflictDeclarations: [
            { buyerUser: 'Ministry of Health buyer account', role: 'Buyer', declaration: 'No conflict of interest', supplier: 'None', action: 'May evaluate', submittedAt: 'June 12, 2026, 10:25 EAT', status: 'Cleared' }
        ],
        technicalCriteria: [
            { id: 'experience', name: 'Relevant experience', maxScore: 20, description: 'Similar completed healthcare works contracts' },
            { id: 'methodology', name: 'Methodology', maxScore: 30, description: 'Construction approach, sequencing, and quality of work plan' },
            { id: 'personnel', name: 'Key personnel', maxScore: 25, description: 'Project manager, engineer, site supervisor qualifications' },
            { id: 'workplan', name: 'Work plan', maxScore: 15, description: 'Realistic schedule and resource plan' },
            { id: 'quality', name: 'Quality assurance', maxScore: 10, description: 'Inspection, health, safety, and environmental controls' }
        ],
        clarifications: [
            { supplier: 'XYZ Builders', subject: 'Clarification on equipment evidence', requirement: 'Equipment capacity', message: 'Please confirm whether the attached lease agreement covers the required concrete mixer for the full contract period.', deadline: 'June 18, 2026, 15:00 EAT', attachment: 'equipment-query.pdf', status: 'Responded', buyerNote: 'Buyer note: response confirms lease validity; no bid substance changed.' },
            { supplier: 'Prime Contractors', subject: 'Key personnel certificate validity', requirement: 'Professional registration', message: 'Please confirm whether the attached professional registration certificate for the proposed site engineer is valid for the current year.', deadline: 'June 19, 2026, 12:00 EAT', attachment: 'personnel-certificate.pdf', status: 'Sent', buyerNote: 'Buyer note: await response before final eligibility close.' }
        ],
        reportSections: [
            'Tender information',
            'Buyer evaluation declaration',
            'Conflict of interest declarations',
            'List of bidders',
            'Bid opening summary',
            'Preliminary evaluation results',
            'Technical evaluation results',
            'Financial evaluation results',
            'Clarifications issued',
            'Evaluation comparison matrix',
            'Recommended bidder',
            'Reasons for recommendation',
            'Buyer notes',
            'Attachments reviewed',
            'Approval section',
            'Audit trail'
        ],
        recommendation: {
            supplier: 'BuildRight Ltd',
            amount: 4670000000,
            currency: 'TZS',
            method: 'Lowest evaluated substantially responsive bid',
            contractDuration: '10 months',
            conditions: 'Verify updated equipment lease and performance guarantee before contract signing.',
            decision: 'Recommended',
            reason: 'BuildRight Ltd passed the preliminary, eligibility, technical, and financial evaluation stages and submitted the lowest evaluated substantially responsive bid.',
            summary: 'Four bids were opened. All were received before the deadline. Three bidders passed the technical threshold; BuildRight Ltd ranks first after corrected price review.'
        },
        approvals: [
            { actor: 'Buyer', status: 'Draft report in progress', date: 'June 24, 2026', action: 'Complete report' },
            { actor: 'Procurement Officer', status: 'Pending recommendation submission', date: 'June 25, 2026', action: 'Route to approver' },
            { actor: 'Approver', status: 'Waiting', date: 'After submission', action: 'Approve or return for review' }
        ],
        auditTrail: [
            { time: '2026-06-12 10:00', event: 'Bid opening authorized by buyer', actor: 'Ministry of Health buyer account', ref: 'AUD-BIDOPEN-2026-014' },
            { time: '2026-06-12 10:01', event: 'Four technical envelopes decrypted and hash verified', actor: 'System', ref: 'HASH-SET-9042' },
            { time: '2026-06-12 10:32', event: 'Buyer conflict declaration recorded', actor: 'Ministry of Health buyer account', ref: 'COI-2026-017' },
            { time: '2026-06-18 09:15', event: 'Clarification sent to XYZ Builders', actor: 'Ministry of Health buyer account', ref: 'CLAR-2026-022' },
            { time: '2026-06-24 16:30', event: 'Buyer score report prepared for locking', actor: 'Ministry of Health buyer account', ref: 'EVAL-LOCK-2026-014' }
        ],
        benchmark: {
            buyerEstimate: 4800000000,
            marketMedian: 4860000000,
            regionalAdjustment: 'Dodoma logistics index +2.8%',
            comparableEconomicCost: 4728000000,
            varianceBand: '-2.7% to +1.9%',
            notes: [
                'All bids sit inside the historical healthcare works price band.',
                'No abnormal discounting pattern detected after logistics normalization.',
                'ABC Construction has the strongest delivery feasibility after capacity adjustment.'
            ]
        },
        riskSignals: [
            { supplier: 'ABC Construction Ltd', risk: 'Low', score: 18, driver: 'Strong delivery history and current capacity headroom.' },
            { supplier: 'XYZ Builders', risk: 'Moderate', score: 41, driver: 'Two late milestones in the last 12 months.' },
            { supplier: 'BuildRight Ltd', risk: 'Moderate', score: 37, driver: 'Best technical score, but equipment utilization is near threshold.' },
            { supplier: 'Prime Contractors', risk: 'Low', score: 24, driver: 'Clean compliance record and balanced delivery load.' }
        ],
        collusionSignals: [
            { signal: 'Submission timing', status: 'Clear', detail: 'Bids submitted across a 17-hour spread.' },
            { signal: 'Price spread', status: 'Clear', detail: 'Normalized prices vary by 6.2%.' },
            { signal: 'Document similarity', status: 'Watch', detail: 'Two method statements share a common template, below escalation threshold.' }
        ],
        bids: [
            {
                supplier: 'ABC Construction Ltd',
                registrationNumber: 'BRELA-45821',
                contactPerson: 'Neema Andrew',
                submissionTime: 'June 11, 2026, 14:38 EAT',
                documents: ['Business registration', 'Tax clearance', 'Method statement', 'Bid security', 'BOQ'],
                preliminaryResult: 'Passed',
                eligibilityResult: 'Eligible',
                technicalScore: 85,
                financialScore: 90,
                totalScore: 87.5,
                integrityHash: '0x1234567890abcdef',
                price: 4800000000,
                preliminaryChecks: [
                    { requirement: 'Bid submitted before deadline', result: 'Pass', comment: 'Submitted before closing time.', document: 'Opening log' },
                    { requirement: 'All mandatory forms submitted', result: 'Pass', comment: 'Forms complete.', document: 'Administrative forms' },
                    { requirement: 'Bid security submitted', result: 'Pass', comment: 'Bank guarantee attached.', document: 'Bid security' },
                    { requirement: 'Tax documents submitted', result: 'Pass', comment: 'Valid tax clearance.', document: 'Tax clearance' }
                ],
                eligibilityChecks: [
                    { requirement: 'Company registration', result: 'Eligible', comment: 'BRELA certificate verified.' },
                    { requirement: 'Professional registration', result: 'Eligible', comment: 'CRB registration valid.' },
                    { requirement: 'Experience requirement', result: 'Eligible', comment: 'Three similar contracts submitted.' },
                    { requirement: 'Financial capacity', result: 'Eligible', comment: 'Audited accounts meet threshold.' }
                ],
                technicalScores: { experience: 17, methodology: 25, personnel: 21, workplan: 13, quality: 9 },
                technicalComment: 'Strong similar projects and acceptable health facility methodology.',
                financial: { currency: 'TZS', taxesIncluded: 'Yes', discount: 'None', arithmeticCorrection: 12000000, correctedPrice: 4812000000, boqStatus: 'Corrected', pricingStatus: 'Fully priced', ranking: 3, correctionNote: 'Minor BOQ subtotal arithmetic corrected according to tender rules.' },
                finalResult: 'Responsive'
            },
            {
                supplier: 'XYZ Builders',
                registrationNumber: 'BRELA-77109',
                contactPerson: 'Peter Said',
                submissionTime: 'June 11, 2026, 15:21 EAT',
                documents: ['Business registration', 'Tax clearance', 'Technical proposal', 'Financial offer'],
                preliminaryResult: 'Passed',
                eligibilityResult: 'Requires Clarification',
                technicalScore: 78,
                financialScore: 95,
                totalScore: 84.3,
                integrityHash: '0xabcdef1234567890',
                price: 4950000000,
                preliminaryChecks: [
                    { requirement: 'Bid submitted before deadline', result: 'Pass', comment: 'Submitted before closing time.', document: 'Opening log' },
                    { requirement: 'All mandatory forms submitted', result: 'Pass', comment: 'Complete.', document: 'Administrative forms' },
                    { requirement: 'Power of attorney submitted', result: 'Not Applicable', comment: 'Not required for this tender.', document: 'Instructions to bidders' },
                    { requirement: 'Bid validity period acceptable', result: 'Pass', comment: 'Valid for required period.', document: 'Bid form' }
                ],
                eligibilityChecks: [
                    { requirement: 'Company registration', result: 'Eligible', comment: 'Registration verified.' },
                    { requirement: 'Equipment capacity', result: 'Requires Clarification', comment: 'Lease duration needs confirmation.' },
                    { requirement: 'No debarment', result: 'Eligible', comment: 'No blacklist match.' },
                    { requirement: 'Financial capacity', result: 'Eligible', comment: 'Bank statement attached.' }
                ],
                technicalScores: { experience: 15, methodology: 23, personnel: 19, workplan: 13, quality: 8 },
                technicalComment: 'Technically acceptable, subject to equipment clarification closure.',
                financial: { currency: 'TZS', taxesIncluded: 'Yes', discount: '1%', arithmeticCorrection: 0, correctedPrice: 4900500000, boqStatus: 'Fully priced', pricingStatus: 'Fully priced', ranking: 4, correctionNote: 'Discount applied as submitted; no arithmetic correction.' },
                finalResult: 'Pending clarification'
            },
            {
                supplier: 'BuildRight Ltd',
                registrationNumber: 'BRELA-90342',
                contactPerson: 'Grace Lema',
                submissionTime: 'June 10, 2026, 18:04 EAT',
                documents: ['Business registration', 'Tax clearance', 'Work program', 'BOQ', 'Bid security'],
                preliminaryResult: 'Passed',
                eligibilityResult: 'Eligible',
                technicalScore: 92,
                financialScore: 82,
                totalScore: 88.4,
                integrityHash: '0x9876543210fedcba',
                price: 4650000000,
                preliminaryChecks: [
                    { requirement: 'Bid submitted before deadline', result: 'Pass', comment: 'Submitted one day before deadline.', document: 'Opening log' },
                    { requirement: 'All mandatory forms submitted', result: 'Pass', comment: 'All forms present.', document: 'Administrative forms' },
                    { requirement: 'Bid signed and stamped where required', result: 'Pass', comment: 'Signed by authorized person.', document: 'Bid form' },
                    { requirement: 'No major document missing', result: 'Pass', comment: 'No omission noted.', document: 'Document checklist' }
                ],
                eligibilityChecks: [
                    { requirement: 'Company registration', result: 'Eligible', comment: 'BRELA certificate verified.' },
                    { requirement: 'Professional registration', result: 'Eligible', comment: 'CRB and key personnel registrations valid.' },
                    { requirement: 'Experience requirement', result: 'Eligible', comment: 'Strong similar works record.' },
                    { requirement: 'Key personnel', result: 'Eligible', comment: 'CVs and licenses acceptable.' }
                ],
                technicalScores: { experience: 19, methodology: 28, personnel: 23, workplan: 14, quality: 8 },
                technicalComment: 'Best technical response with clear methodology and realistic work program.',
                financial: { currency: 'TZS', taxesIncluded: 'Yes', discount: 'None', arithmeticCorrection: 20000000, correctedPrice: 4670000000, boqStatus: 'Corrected', pricingStatus: 'Fully priced', ranking: 1, correctionNote: 'One multiplication error corrected; correction logged for audit.' },
                finalResult: 'Recommended'
            },
            {
                supplier: 'Prime Contractors',
                registrationNumber: 'BRELA-12044',
                contactPerson: 'Hassan Omari',
                submissionTime: 'June 11, 2026, 13:17 EAT',
                documents: ['Technical proposal', 'Financial offer', 'Tax clearance'],
                preliminaryResult: 'Passed',
                eligibilityResult: 'Eligible',
                technicalScore: 88,
                financialScore: 88,
                totalScore: 88.0,
                integrityHash: '0xfedcba0987654321',
                price: 4750000000,
                preliminaryChecks: [
                    { requirement: 'Bid submitted before deadline', result: 'Pass', comment: 'Submitted before closing time.', document: 'Opening log' },
                    { requirement: 'All mandatory forms submitted', result: 'Pass', comment: 'Required forms available.', document: 'Administrative forms' },
                    { requirement: 'Required licenses submitted', result: 'Pass', comment: 'Licenses attached.', document: 'License pack' },
                    { requirement: 'Tax documents submitted', result: 'Pass', comment: 'Valid tax clearance.', document: 'Tax clearance' }
                ],
                eligibilityChecks: [
                    { requirement: 'Company registration', result: 'Eligible', comment: 'Registration verified.' },
                    { requirement: 'No debarment', result: 'Eligible', comment: 'No suspension found.' },
                    { requirement: 'Key personnel', result: 'Requires Clarification', comment: 'Certificate validity requested.' },
                    { requirement: 'Equipment capacity', result: 'Eligible', comment: 'Evidence acceptable.' }
                ],
                technicalScores: { experience: 18, methodology: 26, personnel: 22, workplan: 14, quality: 8 },
                technicalComment: 'Strong technical offer with one key personnel confirmation pending.',
                financial: { currency: 'TZS', taxesIncluded: 'Yes', discount: 'None', arithmeticCorrection: 0, correctedPrice: 4750000000, boqStatus: 'Fully priced', pricingStatus: 'Fully priced', ranking: 2, correctionNote: 'No arithmetic correction recorded.' },
                finalResult: 'Responsive'
            }
        ]
    },

    // Awarding and Contracts lifecycle workspace
    awardingContracts: {
        summary: [
            { label: 'Pending Awarding', value: 3, detail: 'Buyer-side tenders ready for award or contract action', tab: 'pending-awarding' },
            { label: 'Awarded to you', value: 3, detail: 'Supplier-side awards awaiting response, review, or signature', tab: 'awarded-to-us' },
            { label: 'Pending Action', value: 4, detail: 'Contracts needing buyer or supplier action', tab: 'pending-action' },
            { label: 'Active Contracts', value: 2, detail: 'Signed contracts under delivery and payment tracking', tab: 'active-contracts' },
            { label: 'Closed Contracts', value: 2, detail: 'Completed, terminated, or archived contract records', tab: 'closed-contracts' }
        ],
        pendingAwarding: [
            {
                tenderId: 'PX-WRK-2026-001',
                title: 'Construction of Rural Health Centers',
                reference: 'PX-TND-2026-014',
                procurementType: 'Works',
                evaluationStatus: 'Completed',
                recommendedSupplier: 'ABC Construction Ltd',
                awardStatus: 'Pending Award Decision',
                contractStatus: 'Not Created',
                action: 'Continue Award',
                nav: 'award-recommendation'
            },
            {
                tenderId: 'PX-GDS-2026-002',
                title: 'Supply of Office Furniture',
                reference: 'PX-TND-2026-021',
                procurementType: 'Goods',
                evaluationStatus: 'Completed',
                recommendedSupplier: 'Kijani Office Supplies',
                awardStatus: 'Award Approved',
                contractStatus: 'Awaiting Contract Generation',
                action: 'Generate Contract',
                nav: 'contract-negotiation'
            },
            {
                tenderId: 'PX-SVC-2026-003',
                title: 'Cleaning Services Framework',
                reference: 'PX-TND-2026-033',
                procurementType: 'Services',
                evaluationStatus: 'Ready',
                recommendedSupplier: 'Usafi Pro Services',
                awardStatus: 'Notice Drafted',
                contractStatus: 'Not Created',
                action: 'Send Award',
                nav: 'award-recommendation'
            }
        ],
        awardedToUs: [
            {
                tenderId: 'supplier-award-1',
                title: 'Supply of Laptops',
                buyer: 'ABC University',
                awardValue: 25000000,
                currency: 'TZS',
                awardStatus: 'Awaiting Acceptance',
                contractStatus: 'Not Started',
                requiredAction: 'Accept Award',
                nav: 'award-recommendation'
            },
            {
                tenderId: 'supplier-award-2',
                title: 'Maintenance Services',
                buyer: 'City Council',
                awardValue: 8000000,
                currency: 'TZS',
                awardStatus: 'Award Accepted',
                contractStatus: 'Contract Review',
                requiredAction: 'Review Contract',
                nav: 'contract-negotiation'
            },
            {
                tenderId: 'supplier-award-3',
                title: 'Consultancy Assignment',
                buyer: 'Health Project',
                awardValue: 15000000,
                currency: 'TZS',
                awardStatus: 'Terms Agreed',
                contractStatus: 'Awaiting Your Signature',
                requiredAction: 'Sign Contract',
                nav: 'contract-negotiation'
            }
        ],
        pendingActions: [
            { contract: 'Clinic Renovation Works', role: 'Buyer', otherParty: 'ABC Construction Ltd', status: 'Supplier Signed', requiredAction: 'Buyer Signature Required', dueDate: '2026-07-05', nav: 'contract-negotiation' },
            { contract: 'Laptop Supply', role: 'Supplier', otherParty: 'ABC University', status: 'Contract Received', requiredAction: 'Review and Sign', dueDate: '2026-07-04', nav: 'contract-negotiation' },
            { contract: 'Cleaning Services', role: 'Buyer', otherParty: 'Usafi Pro Services', status: 'Award Accepted', requiredAction: 'Generate Contract', dueDate: '2026-07-06', nav: 'contract-negotiation' },
            { contract: 'Rural Health Centers', role: 'Buyer', otherParty: 'ABC Construction Ltd', status: 'Change Requested', requiredAction: 'Review Supplier Request', dueDate: '2026-07-03', nav: 'contract-negotiation' }
        ],
        activeContracts: [
            { title: 'Rural Health Centers', role: 'Buyer', otherParty: 'ABC Construction Ltd', progress: 65, status: 'In Progress', nextMilestone: 'MEP installations inspection', paymentStatus: 'Invoice Review', nav: 'post-award-tracking' },
            { title: 'ICT Equipment Supply', role: 'Supplier', otherParty: 'XYZ College', progress: 20, status: 'Delivery Pending', nextMilestone: 'First batch delivery', paymentStatus: 'Not Invoiced', nav: 'post-award-tracking' }
        ],
        closedContracts: [
            { title: 'Office Stationery Supply', role: 'Buyer', otherParty: 'Tanzania Stationers', finalValue: 12300000, currency: 'TZS', completionDate: '2026-03-15', performanceRating: '4.5/5', status: 'Completed' },
            { title: 'Network Cabling Works', role: 'Supplier', otherParty: 'North District Hospital', finalValue: 9100000, currency: 'TZS', completionDate: '2026-02-28', performanceRating: '4.2/5', status: 'Closed' }
        ],
        award: {
            tenderTitle: 'Construction of Rural Health Centers',
            reference: 'PX-TND-2026-014',
            buyer: 'Dodoma Regional Health Authority',
            procurementType: 'Works',
            closingDate: '2026-06-10',
            noticeDate: '2026-07-01',
            standstillStart: '2026-07-01',
            standstillEnd: '2026-07-15',
            complaintsReceived: 'None',
            complaintsResolved: true,
            evaluationStatus: 'Completed',
            awardStatus: 'Awaiting Supplier Acceptance',
            selectedSupplier: 'ABC Construction Ltd',
            awardAmount: 4670000000,
            currency: 'TZS',
            reason: 'Best evaluated responsive bid with strong methodology, corrected price, and confirmed mobilization plan.',
            approval: {
                approver: 'Authorized Representative',
                date: '2026-06-30',
                note: 'Award package reviewed against final evaluation report and conflict declaration.',
                status: 'Approved'
            },
            notices: [
                { type: 'Notice of Intention to Award', recipient: 'All bidders', status: 'Sent', deadline: '2026-07-14' },
                { type: 'Unsuccessful Bidder Notice', recipient: '2 bidders', status: 'Ready', deadline: '2026-07-14' },
                { type: 'Award Notification', recipient: 'ABC Construction Ltd', status: 'Awaiting Response', deadline: '2026-07-05' }
            ],
            supplierResponses: [
                { action: 'Accept Award', status: 'Primary path', detail: 'Unlocks pre-contract documents and draft contract generation.' },
                { action: 'Request Clarification', status: 'Allowed', detail: 'Buyer can clarify without changing evaluation result or bid substance.' },
                { action: 'Decline Award', status: 'Fallback', detail: 'Buyer may award next ranked responsive bidder or cancel the award process.' }
            ]
        },
        contract: {
            contractId: 'PX-2026-0892',
            title: 'Construction of Rural Health Centers',
            tenderReference: 'PX-TND-2026-014',
            buyer: 'Dodoma Regional Health Authority',
            supplier: 'ABC Construction Ltd',
            value: 4670000000,
            currency: 'TZS',
            duration: '90 days',
            startDate: '2026-07-15',
            endDate: '2026-10-13',
            status: 'Supplier Reviewing Counter-Proposal',
            poMatched: true,
            budgetVerified: true,
            supplierConfirmedTerms: true,
            buyerConfirmedTerms: false,
            lockedForSignature: false,
            clauses: [
                { title: 'Awarded Supplier', text: 'ABC Construction Ltd is the awarded supplier selected through the completed evaluation.', category: 'Award Data', lock: 'Locked', status: 'Agreed', comments: 0, requestedChange: 'Not negotiable after award.' },
                { title: 'Contract Price', text: 'Total contract value is TZS 4,670,000,000 based on the final evaluated bid price.', category: 'Price', lock: 'Locked', status: 'Agreed', comments: 1, requestedChange: 'Only formal arithmetic or tax clarification may be recorded.' },
                { title: 'Scope of Works', text: 'Construct and hand over rural health centers according to the tender scope, drawings, BOQ, and accepted methodology.', category: 'Scope', lock: 'Locked', status: 'Agreed', comments: 1, requestedChange: 'Main scope cannot be materially changed.' },
                { title: 'Delivery Schedule', text: 'Milestones run from mobilization to final handover over a 90 day period.', category: 'Delivery', lock: 'Negotiable', status: 'Countered', comments: 3, requestedChange: 'Supplier requested 21 days for first milestone; buyer countered 18 days.' },
                { title: 'Payment Terms', text: 'Payment follows accepted milestones, interim certificates, inspection, and invoice approval.', category: 'Payment', lock: 'Negotiable', status: 'Pending Buyer Review', comments: 2, requestedChange: 'Supplier requested 30% advance; buyer reviewing retention and security conditions.' },
                { title: 'Inspection and Acceptance', text: 'Buyer inspection, completion certificates, and correction of defects are required before milestone acceptance.', category: 'Acceptance', lock: 'Negotiable', status: 'Agreed', comments: 1, requestedChange: 'Inspection notice period clarified to 3 business days.' },
                { title: 'Performance Security', text: 'Supplier submits performance security equal to 10% of contract value before effectiveness.', category: 'Security', lock: 'Negotiable', status: 'Pending Supplier Document', comments: 1, requestedChange: 'Submission deadline requested within 7 days after signing.' },
                { title: 'Dispute Resolution', text: 'Disputes are first handled through contract notices, then escalation and formal resolution.', category: 'Clause', lock: 'Negotiable', status: 'Agreed', comments: 0, requestedChange: 'Clause wording accepted.' }
            ],
            negotiationRequests: [
                { clause: 'Delivery Schedule', requestBy: 'Supplier', request: 'Extend first milestone from 14 to 21 days due to imported equipment clearance.', status: 'Countered', buyerResponse: 'Counter-proposed 18 days to protect semester opening deadline.' },
                { clause: 'Payment Terms', requestBy: 'Supplier', request: 'Add 30% advance payment against performance security.', status: 'Pending Buyer Review', buyerResponse: 'Finance and budget verification in progress.' },
                { clause: 'Inspection and Acceptance', requestBy: 'Supplier', request: 'Clarify inspection response time after milestone submission.', status: 'Accepted', buyerResponse: 'Inspection response set to 3 business days.' },
                { clause: 'Warranty / Defects Liability', requestBy: 'Buyer', request: 'Defects liability must remain 12 months from completion certificate.', status: 'Accepted', buyerResponse: 'Supplier accepted without change.' }
            ],
            versions: [
                { version: '1.0', changedBy: 'Buyer', date: '2026-07-01 09:00', summary: 'Initial draft contract generated from tender, bid, award, milestones, and payment rules.', previousClause: '-', newClause: 'Draft contract body created.', reason: 'Award accepted and contract drafting opened.' },
                { version: '1.1', changedBy: 'Supplier', date: '2026-07-02 11:15', summary: 'Supplier requested schedule and advance payment changes.', previousClause: '14 day first milestone; no advance payment.', newClause: '21 day first milestone; 30% advance request.', reason: 'Mobilization and cash flow clarification.' },
                { version: '1.2', changedBy: 'Buyer', date: '2026-07-02 14:20', summary: 'Buyer counter-proposed schedule and accepted inspection clarification.', previousClause: '21 day first milestone request.', newClause: '18 day first milestone counter-proposal.', reason: 'Project must complete before semester start.' },
                { version: '2.0', changedBy: 'System', date: 'Pending', summary: 'Final agreed version after both parties confirm terms.', previousClause: 'Negotiable clauses open.', newClause: 'Contract locked for signature.', reason: 'Dual confirmation required.' }
            ],
            documents: [
                { name: 'Draft Contract v1.2', type: 'Contract Draft', status: 'Current', owner: 'Buyer' },
                { name: 'Performance Security Undertaking', type: 'Pre-contract Requirement', status: 'Pending Upload', owner: 'Supplier' },
                { name: 'Tax Clearance', type: 'Supplier Document', status: 'Verified', owner: 'Supplier' },
                { name: 'Award Approval Memo', type: 'Award Record', status: 'Locked', owner: 'Buyer' }
            ],
            signatures: [
                { party: 'Supplier', representative: 'Managing Director', status: 'Ready after terms lock', timestamp: 'Pending' },
                { party: 'Buyer', representative: 'Authorized Representative', status: 'Countersign after supplier', timestamp: 'Pending' }
            ],
            activityLog: [
                { time: '2026-06-30 09:15', actor: 'Buyer', event: 'Award decision approved', status: 'Complete' },
                { time: '2026-07-01 09:00', actor: 'Buyer', event: 'Draft contract generated', status: 'Complete' },
                { time: '2026-07-02 11:15', actor: 'Supplier', event: 'Requested clause changes', status: 'Change Requested' },
                { time: '2026-07-02 14:20', actor: 'Buyer', event: 'Counter-proposal sent', status: 'Counter-Proposal Sent' },
                { time: 'Pending', actor: 'Both Parties', event: 'Confirm terms and lock for signing', status: 'Next' }
            ],
            messages: [
                { from: 'buyer', message: 'Please review the payment terms in section 3.2.', timestamp: '2026-07-02 10:30' },
                { from: 'supplier', message: 'We can accept the revised inspection timeline, but request schedule relief for imported items.', timestamp: '2026-07-02 11:15' },
                { from: 'buyer', message: 'We counter-propose 18 days instead of 21 days for the first milestone.', timestamp: '2026-07-02 14:20' }
            ]
        },
        execution: {
            contractId: 'PX-2026-0892',
            title: 'Construction of Rural Health Centers',
            status: 'In Progress',
            progress: 65,
            contractValue: 4670000000,
            currency: 'TZS',
            startDate: '2026-07-15',
            endDate: '2026-10-13',
            supplier: 'ABC Construction Ltd',
            buyer: 'Dodoma Regional Health Authority',
            milestones: [
                { name: 'Mobilization', description: 'Site handover, work program, and performance security verification.', scheduled: '2026-07-20', actual: '2026-07-18', status: 'Accepted', evidence: 'Site handover memo', paymentPercent: 10 },
                { name: 'MEP Installations', description: 'Mechanical, electrical, and plumbing installations.', scheduled: '2026-08-20', actual: '2026-08-23', status: 'Under Review', evidence: 'Inspection request GRN-2026-002', paymentPercent: 40 },
                { name: 'Final Handover', description: 'Finishing works, completion certificate, and defect list.', scheduled: '2026-09-30', actual: '-', status: 'Pending', evidence: 'Not submitted', paymentPercent: 50 }
            ],
            invoices: [
                { invoice: 'INV-2026-001', milestone: 'Mobilization', amount: 467000000, status: 'Paid', match: 'PO, certificate, and invoice align.', matchStatus: { po: true, certificate: true, invoice: true } },
                { invoice: 'INV-2026-002', milestone: 'MEP Installations', amount: 1868000000, status: 'Pending Approval', match: 'Inspection accepted after original due date; finance review required.', matchStatus: { po: true, certificate: false, invoice: true } },
                { invoice: 'INV-2026-003', milestone: 'Final Handover', amount: 2335000000, status: 'Blocked', match: 'No completion certificate yet.', matchStatus: { po: true, certificate: false, invoice: false } }
            ],
            issues: [
                { id: 'ISS-001', title: 'Delivery delay for Item #5', raisedBy: 'Buyer', priority: 'Medium', responsibleParty: 'Supplier', status: 'Resolved', requiredAction: 'Record accepted revised schedule.' },
                { id: 'ISS-002', title: 'Missing updated insurance document', raisedBy: 'Buyer', priority: 'High', responsibleParty: 'Supplier', status: 'Action Required', requiredAction: 'Upload valid insurance certificate.' }
            ],
            variations: [
                { title: 'Extension of Time for Imported Equipment', requestedBy: 'Supplier', priceImpact: 'None', timelineImpact: '4 days', status: 'Under Review', document: 'Courier notice and customs letter', requiredAction: 'Buyer decision required', awaitingApprovalFrom: 'Buyer' },
                { title: 'Additional Drainage Works', requestedBy: 'Buyer', priceImpact: 'TZS 42,000,000', timelineImpact: '6 days', status: 'Draft Variation', document: 'Site instruction draft', requiredAction: 'Supplier review required', awaitingApprovalFrom: 'Supplier' }
            ],
            closureChecklist: [
                { item: 'All deliverables completed', status: 'Pending', mandatory: true, complete: false },
                { item: 'All inspections completed', status: 'In Progress', mandatory: true, complete: false },
                { item: 'All invoices processed', status: 'Pending', mandatory: true, complete: false },
                { item: 'All disputes resolved', status: 'In Progress', mandatory: true, complete: false },
                { item: 'Performance security release recorded', status: 'Pending', mandatory: true, complete: false },
                { item: 'Supplier performance rated', status: 'Pending', mandatory: true, complete: false }
            ],
            defectLiability: {
                period: '12 months',
                startDate: 'Pending completion certificate',
                endDate: 'Pending',
                status: 'Not Started',
                retentionRelease: 'After defects liability clearance'
            },
            performance: [
                { criteria: 'Delivery timeliness', rating: 4, notes: 'Mobilization finished early; MEP milestone needs closer monitoring.' },
                { criteria: 'Quality of works', rating: 5, notes: 'Accepted work meets inspection standard.' },
                { criteria: 'Communication', rating: 4, notes: 'Supplier responds within agreed window.' },
                { criteria: 'Contract compliance', rating: 5, notes: 'Core contract obligations are on track.' },
                { criteria: 'Issue handling', rating: 4, notes: 'Delay issue resolved with accepted evidence.' }
            ],
            history: [
                { date: '2026-07-01', event: 'Contract signed and activated' },
                { date: '2026-07-18', event: 'Mobilization accepted' },
                { date: '2026-07-25', event: 'Mobilization payment released' },
                { date: '2026-08-22', event: 'Delay issue resolved and schedule memory updated' }
            ],
            supplierHealth: {
                trustScore: 82,
                riskLevel: 'Low',
                lastAudit: '2026-06-30'
            }
        }
    },

    // Governance, intelligence, and integration operations
    platformOps: {
        complianceQueue: [
            { alert: 'Shared device fingerprint', severity: 'High', status: 'Investigation open', owner: 'Compliance Officer' },
            { alert: 'Document template similarity', severity: 'Medium', status: 'False-positive review', owner: 'Audit Team' },
            { alert: 'Late invoice anomaly', severity: 'Medium', status: 'Finance escalated', owner: 'Finance Officer' }
        ],
        auditTrail: [
            { time: '2026-06-12 10:00', event: 'Bid opening authorized by two users', ref: 'AUD-BIDOPEN-2026-014' },
            { time: '2026-06-12 10:01', event: 'Four technical envelopes decrypted', ref: 'HASH-SET-9042' },
            { time: '2026-06-24 16:30', event: 'Consensus score report locked', ref: 'EVAL-LOCK-2026-014' },
            { time: '2026-06-30 09:15', event: 'Award routed for approval', ref: 'APP-AWARD-2026-014' }
        ],
        marketIntelligence: {
            liquidityIndex: 74,
            supplierCoverage: '18 eligible suppliers in healthcare works',
            avgBidsPerTender: 4.6,
            priceTrend: '+3.4% quarter over quarter',
            recommendations: [
                'Extend clarification window by 3 days for high-value works.',
                'Invite two Tier 1 suppliers for SME participation balance.',
                'Use Dodoma logistics uplift in financial normalization.'
            ]
        },
        integration: {
            erpName: 'SAP S/4HANA',
            status: 'Healthy',
            lastSync: '2026-05-05 15:20 EAT',
            inbound: ['Budget lines', 'Vendor master', 'Purchase orders'],
            outbound: ['Award decisions', 'Invoice status', 'Supplier scores'],
            discrepancy: '1 unmatched vendor tax ID awaiting review'
        },
        modules: [
            { name: 'Core Procurement', status: 'Active', version: '1.0.0' },
            { name: 'Risk Forecasting', status: 'Active', version: '0.9.4' },
            { name: 'Supplier Financing', status: 'Available', version: '0.4.0' },
            { name: 'Cross-Border Controls', status: 'Available', version: '0.3.1' }
        ]
    },

    // Communication Center seed data. Runtime workflow events append to localStorage.
    communicationCenter: {
        categories: [
            'General Message',
            'Tender Clarification',
            'System Notification',
            'System Alert',
            'Evaluation Update',
            'Tender Publication',
            'Tender Rejection',
            'Bid Submission',
            'Supplier Invitation',
            'Award Notification',
            'Deadline Reminder',
            'Reporting Documents',
            'Admin Announcement'
        ],
        senderTypes: ['Buyer', 'Supplier', 'System', 'Admin'],
        clarificationCategories: [
            'Technical Specification',
            'BOQ / Pricing',
            'Eligibility Requirement',
            'Submission Document',
            'Tender Deadline',
            'Site Visit / Pre-Bid Meeting',
            'Contract Terms',
            'Other'
        ],
        statuses: ['Unread', 'Read', 'Replied', 'Pending Response', 'Resolved', 'Archived', 'Deleted'],
        clarificationStatuses: ['Submitted', 'Pending Buyer Response', 'Answered', 'Published to All Bidders', 'Resolved', 'Closed'],
        notificationStatuses: ['Unread', 'Read', 'Action Required', 'Completed'],
        priorities: ['Low', 'Normal', 'High', 'Urgent'],
        replyVisibilityOptions: [
            'Reply to this supplier only',
            'Publish answer to all bidders for this tender',
            'Issue addendum'
        ],
        items: [
            {
                id: 'scenario-clarification-pending-buyer',
                kind: 'clarification',
                folder: 'inbox',
                category: 'BOQ / Pricing',
                subject: 'Clarification on BOQ wiring accessories',
                body: 'Please confirm whether the electrical installation BOQ line includes wiring accessories, containment, and termination labels.',
                senderId: 'business-kijiji-power-contractors-ltd',
                senderType: 'Supplier',
                senderName: 'Kijiji Power Contractors Ltd',
                recipientId: 'buyer-001',
                recipientType: 'Buyer',
                recipientName: 'Ministry of Health',
                tenderId: 'PX-WRK-2026-001',
                tenderReference: 'PX-WRK-2026-001',
                tenderTitle: 'Construction of District Maternal Health Wing',
                priority: 'Normal',
                status: 'Pending Buyer Response',
                read: false,
                visibility: 'Private',
                attachments: [{ id: 'att-boq-question', name: 'BOQ-item-4-markup.pdf', fileType: 'application/pdf' }],
                thread: [
                    { senderType: 'Supplier', senderName: 'Kijiji Power Contractors Ltd', body: 'Please confirm whether BOQ Item 4 includes wiring accessories.', createdAt: '2026-05-21T08:20:00' }
                ],
                createdAt: '2026-05-21T08:20:00',
                updatedAt: '2026-05-21T08:20:00',
                audience: ['buyer', 'admin', 'all']
            },
            {
                id: 'scenario-general-reply-needed',
                kind: 'message',
                folder: 'inbox',
                category: 'General Message',
                subject: 'Site access coordination for Friday inspection',
                body: 'Please confirm whether our team can access the maternal wing site this Friday at 09:00 for a pre-mobilization inspection.',
                senderId: 'business-lake-builders-ltd',
                senderType: 'Supplier',
                senderName: 'Lake Builders Ltd',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-WRK-2026-001',
                tenderReference: 'PX-WRK-2026-001',
                tenderTitle: 'Construction of District Maternal Health Wing',
                priority: 'Low',
                status: 'Unread',
                read: false,
                visibility: 'Private',
                createdAt: '2026-05-21T09:10:00',
                updatedAt: '2026-05-21T09:10:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-tender-returned',
                kind: 'alert',
                folder: 'inbox',
                category: 'Tender Rejection',
                subject: 'Tender returned for correction',
                body: 'Your draft tender is missing the bid security validity period and one mandatory eligibility requirement. Update the tender before resubmission.',
                senderId: 'system',
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientId: 'buyer-001',
                recipientType: 'Buyer',
                recipientName: 'Ministry of Health',
                tenderId: 'PX-WRK-2026-002',
                tenderReference: 'PX-WRK-2026-002',
                tenderTitle: 'Rehabilitation of Rural Water Supply Network',
                priority: 'High',
                status: 'Action Required',
                read: false,
                actionRequired: true,
                actionLabel: 'Edit Tender',
                actionPage: 'create-tender',
                visibility: 'Private',
                createdAt: '2026-05-21T10:05:00',
                updatedAt: '2026-05-21T10:05:00',
                audience: ['buyer', 'admin', 'all']
            },
            {
                id: 'scenario-publication-success',
                kind: 'notification',
                folder: 'inbox',
                category: 'Tender Publication',
                subject: 'Tender published successfully',
                body: 'PX-GDS-2026-003 has passed publication checks and is now visible in the marketplace.',
                senderId: 'system',
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientId: 'buyer-001',
                recipientType: 'Buyer',
                recipientName: 'Medical Stores Department',
                tenderId: 'PX-GDS-2026-003',
                tenderReference: 'PX-GDS-2026-003',
                tenderTitle: 'Procurement of Medical Equipment and Supplies',
                priority: 'Normal',
                status: 'Read',
                read: true,
                actionRequired: false,
                actionLabel: 'View Tender',
                actionPage: 'tender-details',
                visibility: 'Public marketplace',
                createdAt: '2026-05-21T11:15:00',
                updatedAt: '2026-05-21T11:15:00',
                audience: ['buyer', 'all']
            },
            {
                id: 'scenario-supplier-invitation',
                kind: 'notification',
                folder: 'inbox',
                category: 'Supplier Invitation',
                subject: 'Invitation to submit catering framework bid',
                body: 'You have been invited to participate in PX-SVC-2026-003. Review the tender and start your submission before the deadline.',
                senderId: 'business-university-of-dodoma',
                senderType: 'Buyer',
                senderName: 'University of Dodoma',
                recipientId: 'supplier-001',
                recipientType: 'Supplier',
                recipientName: 'ABC Construction Ltd',
                tenderId: 'PX-SVC-2026-003',
                tenderReference: 'PX-SVC-2026-003',
                tenderTitle: 'Regional Student Meal Catering Services',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionRequired: true,
                actionLabel: 'Start Submission',
                actionPage: 'bidding-workspace',
                visibility: 'Invited suppliers only',
                createdAt: '2026-05-21T12:30:00',
                updatedAt: '2026-05-21T12:30:00',
                audience: ['supplier', 'all']
            },
            {
                id: 'scenario-bid-signature-alert',
                kind: 'alert',
                folder: 'inbox',
                category: 'System Alert',
                subject: 'Bid submission document missing signature',
                body: 'The uploaded bid form appears unsigned. Upload a signed version before the configured closing deadline.',
                senderId: 'system',
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientId: 'supplier-001',
                recipientType: 'Supplier',
                recipientName: 'ABC Construction Ltd',
                tenderId: 'PX-GDS-2026-003',
                tenderReference: 'PX-GDS-2026-003',
                tenderTitle: 'Procurement of Medical Equipment and Supplies',
                priority: 'Urgent',
                status: 'Action Required',
                read: false,
                actionRequired: true,
                actionLabel: 'Open Bid',
                actionPage: 'bidding-workspace',
                visibility: 'Private',
                attachments: [{ id: 'att-signature-alert', name: 'Unsigned-bid-form-preview.pdf', fileType: 'application/pdf' }],
                createdAt: '2026-05-21T13:45:00',
                updatedAt: '2026-05-21T13:45:00',
                audience: ['supplier', 'all']
            },
            {
                id: 'scenario-sent-delivery-question',
                kind: 'clarification',
                folder: 'sent',
                category: 'Tender Clarification',
                subject: 'Clarification request on delivery schedule',
                body: 'Please confirm whether partial delivery is acceptable for the first equipment batch.',
                senderId: 'supplier-001',
                senderType: 'Supplier',
                senderName: 'ABC Construction Ltd',
                recipientId: 'business-medical-stores-department',
                recipientType: 'Buyer',
                recipientName: 'Medical Stores Department',
                tenderId: 'PX-GDS-2026-003',
                tenderReference: 'PX-GDS-2026-003',
                tenderTitle: 'Procurement of Medical Equipment and Supplies',
                priority: 'Normal',
                status: 'Pending Response',
                read: true,
                visibility: 'Private',
                conversationId: 'conversation-delivery-schedule',
                contextKey: 'conversation-delivery-schedule',
                createdAt: '2026-05-20T14:25:00',
                updatedAt: '2026-05-20T14:25:00',
                audience: ['supplier', 'all']
            },
            {
                id: 'scenario-delivery-answer',
                kind: 'clarification',
                folder: 'inbox',
                category: 'Tender Clarification',
                subject: 'Re: Clarification request on delivery schedule',
                body: 'Partial delivery is acceptable only for the first batch, provided the remaining batch is delivered within 21 calendar days.',
                senderId: 'business-medical-stores-department',
                senderType: 'Buyer',
                senderName: 'Medical Stores Department',
                recipientId: 'supplier-001',
                recipientType: 'Supplier',
                recipientName: 'ABC Construction Ltd',
                tenderId: 'PX-GDS-2026-003',
                tenderReference: 'PX-GDS-2026-003',
                tenderTitle: 'Procurement of Medical Equipment and Supplies',
                priority: 'Normal',
                status: 'Answered',
                read: false,
                actionRequired: false,
                actionLabel: 'Ask Follow-up',
                actionPage: 'communication-center',
                visibility: 'Private',
                relatedMessageId: 'scenario-sent-delivery-question',
                conversationId: 'conversation-delivery-schedule',
                contextKey: 'conversation-delivery-schedule',
                thread: [
                    { senderType: 'Supplier', senderName: 'ABC Construction Ltd', body: 'Please confirm whether partial delivery is acceptable for the first equipment batch.', createdAt: '2026-05-20T14:25:00' },
                    { senderType: 'Buyer', senderName: 'Medical Stores Department', body: 'Partial delivery is acceptable only for the first batch.', createdAt: '2026-05-22T08:00:00' }
                ],
                createdAt: '2026-05-22T08:00:00',
                updatedAt: '2026-05-22T08:00:00',
                audience: ['supplier', 'all']
            },
            {
                id: 'scenario-public-clarification-answer',
                kind: 'clarification',
                folder: 'inbox',
                category: 'Technical Specification',
                subject: 'Published answer on HVAC efficiency rating',
                body: 'The minimum HVAC efficiency rating remains unchanged. All bidders should use Addendum 2 as the controlling specification.',
                senderId: 'business-ministry-of-health',
                senderType: 'Buyer',
                senderName: 'Ministry of Health',
                recipientId: 'supplier-001',
                recipientType: 'Supplier',
                recipientName: 'ABC Construction Ltd',
                tenderId: 'PX-WRK-2026-001',
                tenderReference: 'PX-WRK-2026-001',
                tenderTitle: 'Construction of District Maternal Health Wing',
                priority: 'Normal',
                status: 'Published to All Bidders',
                read: true,
                visibility: 'Public to all bidders',
                attachments: [{ id: 'att-addendum-2', name: 'Addendum-2-HVAC-clarification.pdf', fileType: 'application/pdf' }],
                createdAt: '2026-05-22T09:30:00',
                updatedAt: '2026-05-22T09:30:00',
                audience: ['supplier', 'buyer', 'all']
            },
            {
                id: 'scenario-weekly-report-week-1',
                kind: 'message',
                folder: 'inbox',
                category: 'Reporting Documents',
                subject: 'Weekly progress report Week 1',
                body: 'Week 1 progress report submitted with stakeholder mobilization status and early survey risks.',
                senderId: 'business-dart-environmental-consultants',
                senderType: 'Consultant',
                senderName: 'DART Environmental Consultants',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-CON-2026-002',
                tenderReference: 'PX-CON-2026-002',
                tenderTitle: 'Environmental and Social Impact Assessment for BRT Extension',
                priority: 'Normal',
                status: 'Read',
                read: true,
                actionRequired: false,
                actionLabel: 'Offer Feedback',
                actionPage: 'communication-center',
                visibility: 'Private',
                attachments: [{ id: 'att-week-1', name: 'Week-1-progress-report.pdf', fileType: 'application/pdf' }],
                conversationId: 'conversation-esia-weekly-progress',
                contextKey: 'conversation-esia-weekly-progress',
                createdAt: '2026-05-15T16:10:00',
                updatedAt: '2026-05-15T16:10:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-weekly-report-week-2',
                kind: 'message',
                folder: 'inbox',
                category: 'Reporting Documents',
                subject: 'Weekly progress report Week 2',
                body: 'Week 2 report submitted with field survey coverage, issue log, and pending buyer decisions.',
                senderId: 'business-dart-environmental-consultants',
                senderType: 'Consultant',
                senderName: 'DART Environmental Consultants',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-CON-2026-002',
                tenderReference: 'PX-CON-2026-002',
                tenderTitle: 'Environmental and Social Impact Assessment for BRT Extension',
                priority: 'High',
                status: 'Unread',
                read: false,
                actionRequired: true,
                actionLabel: 'Offer Feedback',
                actionPage: 'communication-center',
                visibility: 'Private',
                attachments: [
                    { id: 'att-week-2', name: 'Week-2-progress-report.pdf', fileType: 'application/pdf' },
                    { id: 'att-week-2-risk', name: 'Week-2-risk-log.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                ],
                conversationId: 'conversation-esia-weekly-progress',
                contextKey: 'conversation-esia-weekly-progress',
                createdAt: '2026-05-22T16:20:00',
                updatedAt: '2026-05-22T16:20:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-weekly-report-week-3',
                kind: 'message',
                folder: 'inbox',
                category: 'Reporting Documents',
                subject: 'Weekly progress report Week 3',
                body: 'Week 3 report submitted with consultations completed, environmental baseline findings, and next-week plan.',
                senderId: 'business-dart-environmental-consultants',
                senderType: 'Consultant',
                senderName: 'DART Environmental Consultants',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-CON-2026-002',
                tenderReference: 'PX-CON-2026-002',
                tenderTitle: 'Environmental and Social Impact Assessment for BRT Extension',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionRequired: true,
                actionLabel: 'Offer Feedback',
                actionPage: 'communication-center',
                visibility: 'Private',
                attachments: [{ id: 'att-week-3', name: 'Week-3-progress-report.pdf', fileType: 'application/pdf' }],
                conversationId: 'conversation-esia-weekly-progress',
                contextKey: 'conversation-esia-weekly-progress',
                createdAt: '2026-05-28T09:15:00',
                updatedAt: '2026-05-28T09:15:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-monthly-implementation-report',
                kind: 'message',
                folder: 'inbox',
                category: 'Reporting Documents',
                subject: 'Monthly implementation report May 2026',
                body: 'Attached are the May implementation report, site attendance summary, and risk register update for your review.',
                senderId: 'business-dart-environmental-consultants',
                senderType: 'Consultant',
                senderName: 'DART Environmental Consultants',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-CON-2026-002',
                tenderReference: 'PX-CON-2026-002',
                tenderTitle: 'Environmental and Social Impact Assessment for BRT Extension',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionRequired: true,
                actionLabel: 'Offer Feedback',
                actionPage: 'communication-center',
                visibility: 'Private',
                attachments: [
                    { id: 'att-monthly-report', name: 'May-implementation-report.pdf', fileType: 'application/pdf' },
                    { id: 'att-risk-register', name: 'Risk-register-update.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                ],
                conversationId: 'conversation-esia-monthly-reports',
                contextKey: 'conversation-esia-monthly-reports',
                createdAt: '2026-05-28T10:40:00',
                updatedAt: '2026-05-28T10:40:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-evaluation-update',
                kind: 'notification',
                folder: 'inbox',
                category: 'Evaluation Update',
                subject: 'Evaluation scoring reopened for consensus comments',
                body: 'Consensus scoring has been reopened for two technical criteria. Complete comments before the evaluation chair locks the report.',
                senderId: 'admin-001',
                senderType: 'Admin',
                senderName: 'ProcureX Platform',
                recipientId: 'buyer-001',
                recipientType: 'Buyer',
                recipientName: 'Ministry of Health',
                tenderId: 'PX-WRK-2026-001',
                tenderReference: 'PX-WRK-2026-001',
                tenderTitle: 'Construction of District Maternal Health Wing',
                priority: 'High',
                status: 'Action Required',
                read: false,
                actionRequired: true,
                actionLabel: 'Open Evaluation',
                actionPage: 'bid-evaluation',
                visibility: 'Evaluation committee',
                createdAt: '2026-05-28T11:05:00',
                updatedAt: '2026-05-28T11:05:00',
                audience: ['buyer', 'admin', 'all']
            },
            {
                id: 'scenario-award-notification',
                kind: 'notification',
                folder: 'inbox',
                category: 'Award Notification',
                subject: 'Notice of intention to award issued',
                body: 'The notice of intention to award has been issued. Review supplier acknowledgement and standstill dates.',
                senderId: 'system',
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientId: 'buyer-001',
                recipientType: 'Buyer',
                recipientName: 'Ministry of Health',
                tenderId: 'PX-WRK-2026-001',
                tenderReference: 'PX-WRK-2026-001',
                tenderTitle: 'Construction of District Maternal Health Wing',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                actionRequired: true,
                actionLabel: 'Open Award',
                actionPage: 'award-recommendation',
                visibility: 'Private',
                createdAt: '2026-05-28T12:00:00',
                updatedAt: '2026-05-28T12:00:00',
                audience: ['buyer', 'admin', 'all']
            },
            {
                id: 'scenario-deadline-reminder',
                kind: 'alert',
                folder: 'inbox',
                category: 'Deadline Reminder',
                subject: 'Tender closes tomorrow',
                body: 'PX-SVC-2026-004 closes tomorrow. Complete your bid submission before the deadline.',
                senderId: 'system',
                senderType: 'System',
                senderName: 'ProcureX System',
                recipientId: 'supplier-001',
                recipientType: 'Supplier',
                recipientName: 'ABC Construction Ltd',
                tenderId: 'PX-SVC-2026-004',
                tenderReference: 'PX-SVC-2026-004',
                tenderTitle: 'Fleet Maintenance and Breakdown Recovery Services',
                priority: 'Urgent',
                status: 'Unread',
                read: false,
                actionRequired: true,
                actionLabel: 'View Tender',
                actionPage: 'supplier-tender-detail',
                visibility: 'Private',
                createdAt: '2026-05-28T13:10:00',
                updatedAt: '2026-05-28T13:10:00',
                audience: ['supplier', 'all']
            },
            {
                id: 'scenario-replied-general',
                kind: 'message',
                folder: 'inbox',
                category: 'General Message',
                subject: 'Re: Delivery gate pass details',
                body: 'Thank you. Gate pass details have been received and forwarded to the site security desk.',
                senderId: 'business-campus-meals-tanzania-ltd',
                senderType: 'Supplier',
                senderName: 'Campus Meals Tanzania Ltd',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-SVC-2026-003',
                tenderReference: 'PX-SVC-2026-003',
                tenderTitle: 'Regional Student Meal Catering Services',
                priority: 'Low',
                status: 'Replied',
                read: true,
                visibility: 'Private',
                conversationId: 'conversation-gate-pass',
                contextKey: 'conversation-gate-pass',
                thread: [
                    { senderType: 'Supplier', senderName: 'Campus Meals Tanzania Ltd', body: 'Please share delivery gate pass details.', createdAt: '2026-05-23T08:10:00' },
                    { senderType: 'Business', senderName: 'Kilimanjaro Supplies Limited', body: 'Gate pass details are attached and copied to site security.', createdAt: '2026-05-23T09:00:00' }
                ],
                createdAt: '2026-05-23T09:15:00',
                updatedAt: '2026-05-23T09:15:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-admin-announcement',
                kind: 'message',
                folder: 'inbox',
                category: 'Admin Announcement',
                subject: 'Portal support hours during fiscal year close',
                body: 'Support hours are extended this week for fiscal year close activities. Reply here if your organization needs a priority support slot.',
                senderId: 'admin-001',
                senderType: 'Admin',
                senderName: 'ProcureX Platform',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: '',
                tenderReference: 'Not linked',
                tenderTitle: 'No tender linked',
                priority: 'Normal',
                status: 'Unread',
                read: false,
                visibility: 'Private',
                createdAt: '2026-05-27T17:30:00',
                updatedAt: '2026-05-27T17:30:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-sent-inception-report',
                kind: 'message',
                folder: 'sent',
                category: 'Reporting Documents',
                subject: 'Submitted inception report',
                body: 'We have submitted the consultancy inception report and supporting workplan for your review.',
                senderId: 'user-001',
                senderType: 'Business',
                senderName: 'Kilimanjaro Supplies Limited',
                recipientId: 'business-dar-rapid-transit-agency',
                recipientType: 'Buyer',
                recipientName: 'Dar Rapid Transit Agency',
                tenderId: 'PX-CON-2026-002',
                tenderReference: 'PX-CON-2026-002',
                tenderTitle: 'Environmental and Social Impact Assessment for BRT Extension',
                priority: 'Normal',
                status: 'Read',
                read: true,
                visibility: 'Private',
                attachments: [
                    { id: 'att-inception-report', name: 'Inception-report.pdf', fileType: 'application/pdf' },
                    { id: 'att-workplan', name: 'Workplan.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                ],
                conversationId: 'conversation-esia-inception',
                contextKey: 'conversation-esia-inception',
                createdAt: '2026-05-24T12:20:00',
                updatedAt: '2026-05-24T12:20:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-archived-maintenance',
                kind: 'message',
                folder: 'archived',
                category: 'Admin Announcement',
                subject: 'Completed platform maintenance notice',
                body: 'The scheduled maintenance window has been completed. All procurement communication services are available.',
                senderId: 'admin-001',
                senderType: 'Admin',
                senderName: 'ProcureX Platform',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: '',
                tenderReference: 'Not linked',
                tenderTitle: 'No tender linked',
                priority: 'Low',
                status: 'Archived',
                read: true,
                visibility: 'Private',
                createdAt: '2026-05-18T17:00:00',
                updatedAt: '2026-05-18T17:00:00',
                audience: ['user', 'all']
            },
            {
                id: 'scenario-trash-superseded',
                kind: 'message',
                folder: 'inbox',
                category: 'General Message',
                subject: 'Superseded document request',
                body: 'This request was superseded by the updated reporting document submission workflow.',
                senderId: 'business-campus-meals-tanzania-ltd',
                senderType: 'Supplier',
                senderName: 'Campus Meals Tanzania Ltd',
                recipientId: 'user-001',
                recipientType: 'Business',
                recipientName: 'Kilimanjaro Supplies Limited',
                tenderId: 'PX-SVC-2026-003',
                tenderReference: 'PX-SVC-2026-003',
                tenderTitle: 'Regional Student Meal Catering Services',
                priority: 'Low',
                status: 'Deleted',
                read: true,
                visibility: 'Private',
                createdAt: '2026-05-19T15:35:00',
                updatedAt: '2026-05-19T15:35:00',
                audience: ['user', 'all']
            }
        ]
    },

    // Chart data
    charts: {
        adminActivity: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            data: [1200, 1350, 1180, 1420, 1380, 1247]
        },
        buyerSpend: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            data: [21000000, 22500000, 21800000, 23500000, 24200000, 25000000]
        }
    },

    // Procurement Dashboard operating data. The dashboard filters, sorts, and counts this per active account.
    userWorkspace: {
        urgentItems: [
            { type: 'Pending approvals', count: 3, urgency: 92, due: 'Today', nav: 'awarding-contracts', audience: ['buyer', 'all'] },
            { type: 'New bids received', count: 7, urgency: 86, due: '2 hours', nav: 'bid-evaluation', audience: ['buyer', 'all'] },
            { type: 'Contracts awaiting signature', count: 2, urgency: 95, due: 'Today', nav: 'awarding-contracts', audience: ['buyer', 'supplier', 'all'] },
            { type: 'Payments overdue', count: 4, urgency: 89, due: 'Overdue', nav: 'awarding-contracts', audience: ['buyer', 'supplier', 'all'] },
            { type: 'Messages requiring reply', count: 5, urgency: 84, due: '1 day', nav: 'communication-center', audience: ['buyer', 'supplier', 'all'] }
        ],
        workflows: [
            { title: 'Office IT Procurement', status: 'Draft', updatedHours: 2, urgency: 78, nav: 'create-tender', audience: ['buyer', 'all'] },
            { title: 'Vehicle Tender', status: 'Evaluation stage', updatedHours: 5, urgency: 88, nav: 'bid-evaluation', audience: ['buyer', 'all'] },
            { title: 'Contract - ABC Ltd', status: 'Execution', updatedHours: 1, urgency: 91, nav: 'awarding-contracts', audience: ['buyer', 'supplier', 'all'] },
            { title: 'Medical Equipment Bid', status: 'Clarification response due', updatedHours: 3, urgency: 87, nav: 'bidding-workspace', audience: ['supplier', 'all'] }
        ],
        quickActions: [
            { title: 'Review approvals', detail: 'Award and budget approvals waiting', nav: 'awarding-contracts', audience: ['buyer', 'all'], signal: 'approvals' },
            { title: 'Evaluate new bids', detail: 'Open technical and financial review', nav: 'bid-evaluation', audience: ['buyer', 'all'], signal: 'bids' },
            { title: 'Sign contract', detail: 'Complete digital signature workflow', nav: 'awarding-contracts', audience: ['buyer', 'supplier', 'all'], signal: 'contracts' },
            { title: 'Reply to messages', detail: 'Clarifications, alerts, and tender workflow messages', nav: 'communication-center', audience: ['buyer', 'supplier', 'all'], signal: 'messages' },
            { title: 'Find tenders', detail: 'Open matching tenders and tenders near closing date', nav: 'marketplace', audience: ['supplier', 'all'], signal: 'tenders' },
            { title: 'Create tender', detail: 'Start a new buyer procurement', nav: 'create-tender', audience: ['buyer', 'all'], signal: 'drafts' }
        ],
        appShortcuts: [
            { app: 'Procurement', detail: 'Marketplace, create tender, bid', usage: 96, nav: 'marketplace', audience: ['buyer', 'supplier', 'all'] },
            { app: 'Communication Center', detail: 'Inbox, clarifications, alerts', usage: 95, nav: 'communication-center', audience: ['buyer', 'supplier', 'all'] },
            { app: 'Evaluation', detail: 'Bid opening, scoring, review', usage: 94, nav: 'bid-evaluation', audience: ['buyer', 'all'] },
            { app: 'Awarding and Contract', detail: 'Awards, approvals, signatures', usage: 92, nav: 'awarding-contracts', audience: ['buyer', 'supplier', 'all'] },
            { app: 'Records and History', detail: 'Past tenders, bids, awards, cancellations', usage: 90, nav: 'records-history', audience: ['buyer', 'supplier', 'all'] },
            { app: 'Registration and Verification', detail: 'Registration and identity verification', usage: 88, nav: 'account-profile', audience: ['buyer', 'supplier', 'all'] },
            { app: 'Dashboard', detail: 'Your work, spend, and insights', usage: 84, nav: 'workspace-dashboard', audience: ['buyer', 'supplier', 'all'] }
        ],
        insights: [
            { type: 'Suggested tenderer', title: '3 tenderers match Office IT Procurement', detail: 'Two have low risk and recent delivery capacity.', urgency: 78, nav: 'marketplace', audience: ['buyer', 'all'] },
            { type: 'Price insight', title: 'Network equipment prices up 4.2%', detail: 'Use the updated benchmark before publishing.', urgency: 72, nav: 'create-tender', audience: ['buyer', 'all'] },
            { type: 'Risk alert', title: 'Buyer conflict declaration needs review', detail: 'Resolve before award recommendation is locked.', urgency: 90, nav: 'awarding-contracts', audience: ['buyer', 'all'] },
            { type: 'Matching tender', title: 'New ICT tender matches your profile', detail: 'Closes soon and accepts digital service providers.', urgency: 84, nav: 'marketplace', audience: ['supplier', 'all'] },
            { type: 'Partnership', title: 'Logistics partner available in Dodoma', detail: 'Could improve bid feasibility for rural delivery.', urgency: 70, nav: 'marketplace', audience: ['supplier', 'all'] },
            { type: 'Market trend', title: 'Healthcare works liquidity is improving', detail: 'Average eligible supplier count rose this month.', urgency: 64, nav: 'workspace-dashboard', audience: ['buyer', 'supplier', 'all'] }
        ]
    }
};

// Export for use in other modules
window.mockData = mockData;

const awardContractDraftStoragePrefix = 'procurex:award-draft:';
const awardContractLegacyDraftStoragePrefix = 'procurex.awardContractDraft.v1.';
const awardContractDraftMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

function getAwardContractTenderId(tender = {}) {
    return String(tender.id || tender.reference || tender.tenderReference || mockData.awardingContracts?.contract?.tenderReference || 'demo-award-contract');
}

function getAwardContractDraftKey(tenderId) {
    return `${awardContractDraftStoragePrefix}${tenderId || 'demo-award-contract'}`;
}

function getAwardContractLegacyDraftKey(tenderId) {
    return `${awardContractLegacyDraftStoragePrefix}${tenderId || 'demo-award-contract'}`;
}

function sanitizeAwardContractDraftValue(value) {
    if (typeof window.ProcureXShared?.sanitizeDraftField === 'function') return window.ProcureXShared.sanitizeDraftField(value);
    return String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 1500);
}

function sanitizeAwardContractDraftObject(value) {
    if (Array.isArray(value)) return value.map(item => sanitizeAwardContractDraftObject(item));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeAwardContractDraftObject(item)]));
    }
    if (typeof value === 'string') return sanitizeAwardContractDraftValue(value);
    return value;
}

function normalizeAwardContractType(tender = {}) {
    const raw = String(tender.procurementTypeId || tender.type || tender.procurementType || tender.category || 'works').toLowerCase();
    if (raw.includes('good')) return 'goods';
    if (raw.includes('consult')) return 'consultancy';
    if (raw.includes('service')) return 'services';
    return 'works';
}

function getAwardContractTypeLabel(typeId) {
    return ({ goods: 'Goods', works: 'Works', services: 'Services', consultancy: 'Consultancy' })[typeId] || 'Works';
}

function getSelectedAwardContractTender() {
    const selectedId = mockData.selectedTenderId || localStorage.getItem('procurex.marketplace.selectedTenderId');
    if (selectedId && String(selectedId).startsWith('supplier-award-')) {
        const index = Number(String(selectedId).replace('supplier-award-', '')) - 1;
        const row = mockData.awardingContracts?.awardedToUs?.[index];
        if (row) {
            return {
                id: selectedId,
                reference: selectedId,
                title: row.title,
                type: row.procurementType || 'Services',
                procurementTypeId: normalizeAwardContractType(row),
                organization: row.buyer,
                createdByCurrentUser: false,
                budget: row.awardValue,
                currency: row.currency || 'TZS',
                status: row.awardStatus || 'Award Received'
            };
        }
    }
    if (typeof getProcurexSelectedTender === 'function') return getProcurexSelectedTender();
    const fallback = mockData.tenders?.[0] || {};
    return fallback;
}

function getAwardContractTenders() {
    if (typeof getProcurexAllTenders === 'function') return getProcurexAllTenders();
    return mockData.tenders || [];
}

function formatAwardContractIsoDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
}

function buildRequiredDocuments(tender = {}) {
    const typeId = normalizeAwardContractType(tender);
    const common = [
        { name: 'Tax Clearance', type: 'Tax Clearance', owner: 'Supplier', status: 'Pending Upload' },
        { name: 'Bank Details', type: 'Bank Details', owner: 'Supplier', status: 'Pending Upload' },
        { name: 'Authorized Signatory Details', type: 'Signed Authorization', owner: 'Supplier', status: 'Pending Upload' }
    ];
    const byType = {
        goods: [
            { name: 'Updated Delivery Schedule', type: 'Delivery Schedule', owner: 'Supplier', status: 'Pending Upload' },
            { name: 'Warranty Certificate Template', type: 'Technical Attachment', owner: 'Supplier', status: 'Pending Upload' }
        ],
        works: [
            { name: 'Performance Security', type: 'Performance Security', owner: 'Supplier', status: 'Pending Upload' },
            { name: 'Insurance Certificate', type: 'Insurance Certificate', owner: 'Supplier', status: 'Pending Upload' },
            { name: 'Work Program', type: 'Work Program', owner: 'Supplier', status: 'Pending Upload' }
        ],
        services: [
            { name: 'Service Delivery Plan', type: 'Technical Attachment', owner: 'Supplier', status: 'Pending Upload' },
            { name: 'SLA Reporting Template', type: 'Contract Attachment', owner: 'Supplier', status: 'Pending Upload' }
        ],
        consultancy: [
            { name: 'Key Expert Availability Confirmation', type: 'Technical Attachment', owner: 'Supplier', status: 'Pending Upload' },
            { name: 'Work Plan and Deliverables Schedule', type: 'Delivery Schedule', owner: 'Supplier', status: 'Pending Upload' }
        ]
    };
    return [...(byType[typeId] || byType.works), ...common];
}

function buildTypeSpecificClauses(tender = {}) {
    const typeId = normalizeAwardContractType(tender);
    const fallbackContract = mockData.awardingContracts?.contract || {};
    const title = tender.title || fallbackContract.title || 'Contract';
    const reference = tender.reference || tender.id || fallbackContract.tenderReference || 'Tender reference';
    const scope = tender.description || tender.requirements?.fields?.scopeSummary || 'Scope follows the awarded tender and accepted bid.';
    const value = Number(tender.budget || fallbackContract.value || 0);
    const currency = tender.currency || fallbackContract.currency || 'TZS';
    const locked = [
        { title: 'Tender Reference', category: 'Award Data', text: reference, lock: 'Locked', status: 'Locked', comments: 0, requestedChange: 'This term cannot be changed because it comes from the awarded tender or evaluation result.' },
        { title: 'Main Tender Scope', category: 'Scope of Contract', text: scope, lock: 'Locked', status: 'Locked', comments: 0, requestedChange: 'Main scope cannot be materially changed after award.' },
        { title: 'Contract Price Basis', category: 'Contract Price', text: value ? `${currency} ${value.toLocaleString()}` : 'Final evaluated bid price from award decision.', lock: 'Locked', status: 'Locked', comments: 0, requestedChange: 'Only formal corrections or approved adjustments may be recorded.' }
    ];
    const byType = {
        goods: [
            ['Delivery Schedule', 'Delivery location, delivery dates, partial delivery rules, handover documents, and replacement timeline.'],
            ['Quantity and Item Acceptance', 'Quantity check, specification check, delivery note, accepted quantity, and rejected quantity.'],
            ['Warranty and Replacement', 'Warranty period, repair or replacement obligations, and defect reporting process.'],
            ['Packaging and Transport', 'Packaging standards, transport responsibility, and delivery risk transfer.']
        ],
        works: [
            ['Site Handover and Access', 'Site possession, access conditions, utilities, and buyer obligations.'],
            ['Work Program and Milestones', 'Milestone dates, work program updates, inspection requests, and payment certificate timing.'],
            ['Health, Safety, and Environment', 'Safety plan, environmental protection, incident reporting, and worker safety obligations.'],
            ['Defects Liability and Variations', 'Defects period, correction obligations, variation request process, and extension of time rules.'],
            ['Performance Security', 'Security value, validity, submission deadline, and release conditions.']
        ],
        services: [
            ['Service Scope and Boundaries', 'Service description, exclusions, deliverables, and acceptance conditions.'],
            ['Service Level Agreement', 'Performance standards, response times, reporting frequency, and remedies.'],
            ['Staffing and Resources', 'Required personnel, replacement approval, equipment, and continuity obligations.'],
            ['Service Renewal and Termination', 'Renewal conditions, poor performance triggers, and notice period.']
        ],
        consultancy: [
            ['Terms of Reference', 'Assignment objectives, methodology, deliverables, and review responsibilities.'],
            ['Key Experts and Substitution', 'Named experts, CV approval, availability, and substitution restrictions.'],
            ['Reports and Deliverables', 'Inception report, draft report, final report, presentation, and acceptance criteria.'],
            ['Intellectual Property and Data', 'Ownership of reports, data, designs, usage rights, and confidentiality.']
        ]
    };
    return [
        ...locked,
        ...(byType[typeId] || byType.works).map(([clauseTitle, text], index) => ({
            title: clauseTitle,
            category: clauseTitle,
            text,
            lock: 'Negotiable',
            status: index === 0 ? 'Change Requested' : 'Pending Review',
            comments: index === 0 ? 1 : 0,
            requestedChange: 'You may comment or request changes before signing.'
        }))
    ];
}

function createAwardContractDraftFromTender(tender = getSelectedAwardContractTender()) {
    const fallback = mockData.awardingContracts || {};
    const fallbackContract = fallback.contract || {};
    const typeId = normalizeAwardContractType(tender);
    const tenderId = getAwardContractTenderId(tender);
    const title = tender.title || fallback.award?.tenderTitle || fallbackContract.title || 'Awarded tender';
    const reference = tender.reference || tender.id || fallback.award?.reference || fallbackContract.tenderReference || tenderId;
    const buyer = tender.organization || fallback.award?.buyer || fallbackContract.buyer || mockData.users?.buyer?.organization || 'Buyer';
    const supplier = fallback.award?.selectedSupplier || fallbackContract.supplier || mockData.users?.supplier?.organization || 'Recommended supplier';
    const amount = Number(tender.budget || fallback.award?.awardAmount || fallbackContract.value || 0);
    const closingDate = tender.closingDate || fallback.award?.closingDate || '';
    const today = new Date().toISOString();
    return {
        tenderId,
        tenderReference: reference,
        title,
        buyer,
        supplier,
        procurementTypeId: typeId,
        procurementType: getAwardContractTypeLabel(typeId),
        role: tender.createdByCurrentUser === false ? 'Supplier' : 'Buyer',
        currentStep: 'evaluation-result',
        requiredAction: tender.createdByCurrentUser === false ? 'Accept Award' : 'Continue Award',
        awardStatus: tender.createdByCurrentUser === false ? 'Award Received' : 'Pending Award Decision',
        contractStatus: 'Draft saved',
        amount,
        currency: tender.currency || fallbackContract.currency || 'TZS',
        closingDate,
        lastEditedAt: today,
        draftSaved: false,
        awardDecision: {
            selectedSupplier: supplier,
            awardAmount: amount,
            currency: tender.currency || fallbackContract.currency || 'TZS',
            awardDate: formatAwardContractIsoDate(today),
            reason: fallback.award?.reason || 'Supplier had the highest evaluated score and met all technical and financial requirements.',
            conditions: 'Supplier must submit required pre-contract documents before signing.',
            negotiationRequired: 'Yes',
            approver: 'Authorized Representative',
            coiDeclared: false,
            basedOnEvaluation: false,
            coiDeclaredBy: '',
            approvalConfirmed: false
        },
        notification: {
            subject: `Notice of Award - ${title}`,
            message: 'Your company has been selected for award subject to acceptance and contract finalization.',
            responseDeadline: '',
            notifyUnsuccessful: 'Yes'
        },
        contract: {
            contractId: fallbackContract.contractId || `CTR-${reference}`,
            startDate: fallbackContract.startDate || '',
            endDate: fallbackContract.endDate || '',
            duration: fallbackContract.duration || 'To confirm',
            status: 'Draft Contract',
            supplierConfirmedTerms: false,
            buyerConfirmedTerms: false,
            lockedForSignature: false
        },
        clauses: buildTypeSpecificClauses(tender),
        documents: buildRequiredDocuments(tender),
        negotiationRequests: fallbackContract.negotiationRequests || [],
        versions: fallbackContract.versions || [],
        activityLog: [
            { time: today.slice(0, 16).replace('T', ' '), actor: 'System', event: 'Awarding and contract draft created', status: 'Draft', version: '1.0' }
        ]
    };
}

function loadAwardContractDraft(tenderId, tender = null) {
    const selectedTender = tender || getSelectedAwardContractTender();
    const id = tenderId || getAwardContractTenderId(selectedTender);
    try {
        const key = getAwardContractDraftKey(id);
        const legacyKey = getAwardContractLegacyDraftKey(id);
        let raw = localStorage.getItem(key);
        if (!raw && localStorage.getItem(legacyKey)) {
            raw = localStorage.getItem(legacyKey);
            localStorage.setItem(key, raw);
            localStorage.removeItem(legacyKey);
        }
        const parsed = JSON.parse(raw || 'null');
        if (parsed && typeof parsed === 'object') {
            const savedAt = parsed.savedAt || parsed.lastEditedAt || parsed.updatedAt;
            if (savedAt && Date.now() - new Date(savedAt).getTime() > awardContractDraftMaxAgeMs) {
                localStorage.removeItem(key);
                return createAwardContractDraftFromTender(selectedTender);
            }
            const sanitized = sanitizeAwardContractDraftObject(parsed);
            const baseDraft = createAwardContractDraftFromTender(selectedTender);
            return {
                ...baseDraft,
                ...sanitized,
                hasRestorableDraft: true,
                awardDecision: { ...baseDraft.awardDecision, ...(sanitized.awardDecision || {}) },
                notification: { ...baseDraft.notification, ...(sanitized.notification || {}) },
                contract: { ...baseDraft.contract, ...(sanitized.contract || {}) },
                clauses: sanitized.clauses?.length ? sanitized.clauses : buildTypeSpecificClauses(selectedTender),
                documents: sanitized.documents?.length ? sanitized.documents : buildRequiredDocuments(selectedTender)
            };
        }
    } catch (error) {
        localStorage.removeItem(getAwardContractDraftKey(id));
    }
    return createAwardContractDraftFromTender(selectedTender);
}

function saveAwardContractDraft(tenderId, patch = {}) {
    const tender = getAwardContractTenders().find(item => getAwardContractTenderId(item) === tenderId) || getSelectedAwardContractTender();
    const current = loadAwardContractDraft(tenderId, tender);
    const next = {
        ...current,
        ...sanitizeAwardContractDraftObject(patch),
        awardDecision: { ...(current.awardDecision || {}), ...(sanitizeAwardContractDraftObject(patch.awardDecision || {})) },
        notification: { ...(current.notification || {}), ...(sanitizeAwardContractDraftObject(patch.notification || {})) },
        contract: { ...(current.contract || {}), ...(sanitizeAwardContractDraftObject(patch.contract || {})) },
        lastEditedAt: new Date().toISOString(),
        savedAt: new Date().toISOString(),
        draftSaved: true
    };
    localStorage.setItem(getAwardContractDraftKey(tenderId), JSON.stringify(next));
    return next;
}

function getAwardContractLifecycleContext() {
    const tender = getSelectedAwardContractTender();
    const draft = loadAwardContractDraft(getAwardContractTenderId(tender), tender);
    const contract = {
        ...(mockData.awardingContracts?.contract || {}),
        contractId: draft.contract?.contractId,
        title: draft.title,
        tenderReference: draft.tenderReference,
        buyer: draft.buyer,
        supplier: draft.awardDecision?.selectedSupplier || draft.supplier,
        value: draft.awardDecision?.awardAmount || draft.amount,
        currency: draft.currency,
        duration: draft.contract?.duration,
        startDate: draft.contract?.startDate,
        endDate: draft.contract?.endDate,
        status: draft.contract?.status || draft.contractStatus,
        clauses: draft.clauses,
        documents: draft.documents,
        negotiationRequests: draft.negotiationRequests,
        versions: draft.versions,
        activityLog: draft.activityLog,
        supplierConfirmedTerms: draft.contract?.supplierConfirmedTerms,
        buyerConfirmedTerms: draft.contract?.buyerConfirmedTerms,
        lockedForSignature: draft.contract?.lockedForSignature
    };
    return { tender, draft, contract };
}

function collectAwardContractDraftFields(root = document) {
    const patch = {};
    root.querySelectorAll('[data-award-draft-field]').forEach(field => {
        const path = field.getAttribute('data-award-draft-field');
        const value = field.type === 'checkbox' ? field.checked : sanitizeAwardContractDraftValue(field.value);
        const parts = path.split('.');
        let cursor = patch;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) cursor[part] = value;
            else {
                cursor[part] = cursor[part] || {};
                cursor = cursor[part];
            }
        });
    });
    return patch;
}

function initializeAwardContractDraftControls() {
    const workspace = document.querySelector('[data-award-contract-workspace]');
    if (!workspace || workspace.dataset.awardDraftReady === 'true') return;
    workspace.dataset.awardDraftReady = 'true';
    const tenderId = workspace.getAttribute('data-award-tender-id') || getAwardContractTenderId(getSelectedAwardContractTender());
    let dirty = false;
    let autoSaveTimer = null;
    const save = (extra = {}) => {
        const saved = saveAwardContractDraft(tenderId, { ...collectAwardContractDraftFields(workspace), ...extra });
        dirty = false;
        workspace.dataset.dirty = 'false';
        return saved;
    };
    const scheduleAutoSave = () => {
        window.clearTimeout(autoSaveTimer);
        autoSaveTimer = window.setTimeout(() => {
            save({ currentStep: workspace.getAttribute('data-award-current-step') || 'draft' });
            workspace.dataset.autoSaved = 'true';
        }, 700);
    };

    workspace.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('input', () => {
            dirty = true;
            workspace.dataset.dirty = 'true';
            scheduleAutoSave();
        });
        input.addEventListener('change', () => {
            dirty = true;
            workspace.dataset.dirty = 'true';
            scheduleAutoSave();
        });
    });

    workspace.querySelectorAll('[data-award-save-draft]').forEach(button => {
        button.addEventListener('click', () => {
            save({ currentStep: button.getAttribute('data-award-step') || workspace.getAttribute('data-award-current-step') || 'draft' });
            alert('Awarding and contract draft saved.');
        });
    });

    workspace.querySelectorAll('[data-award-save-exit]').forEach(button => {
        button.addEventListener('click', () => {
            save({ currentStep: button.getAttribute('data-award-step') || workspace.getAttribute('data-award-current-step') || 'draft' });
            if (typeof window.app?.navigateTo === 'function') window.app.navigateTo('awarding-contracts');
        });
    });

    workspace.querySelectorAll('[data-award-save-continue]').forEach(button => {
        button.addEventListener('click', () => {
            const nextStep = button.getAttribute('data-award-next-step') || workspace.getAttribute('data-award-current-step') || 'draft';
            save({ currentStep: nextStep, requiredAction: button.getAttribute('data-award-required-action') || 'Continue' });
        });
    });

    workspace.querySelectorAll('[data-award-guard-navigate]').forEach(link => {
        link.addEventListener('click', event => {
            if (!dirty) return;
            const decision = window.confirm('Save this awarding/contract draft before leaving? Press OK to save and leave, or Cancel to stay.');
            if (!decision) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            save();
        }, true);
    });
}

window.getAwardContractDraftKey = getAwardContractDraftKey;
window.loadAwardContractDraft = loadAwardContractDraft;
window.saveAwardContractDraft = saveAwardContractDraft;
window.getSelectedAwardContractTender = getSelectedAwardContractTender;
window.buildTypeSpecificClauses = buildTypeSpecificClauses;
window.buildRequiredDocuments = buildRequiredDocuments;
window.getAwardContractLifecycleContext = getAwardContractLifecycleContext;
window.initializeAwardContractDraftControls = initializeAwardContractDraftControls;
