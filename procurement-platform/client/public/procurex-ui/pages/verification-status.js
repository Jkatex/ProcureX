// IAM registration, identity verification review, and entity-specific profile editor.

function escapeIamProfileHtml(value = '') {
    if (typeof window.ProcureXShared?.escapeHtml === 'function') return window.ProcureXShared.escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getIamProfileValue(data, key, fallback = '') {
    const value = data?.[key];
    return value === undefined || value === null ? fallback : value;
}

function getIamProfileDefaults(profile = {}, account = {}) {
    const registryRecord = profile.registryRecord || {};
    const entityType = profile.entityType || 'individual';
    const isOrganization = entityType === 'company' || entityType === 'business';
    return {
        fullName: account.displayName || profile.signatureName || registryRecord.name || '',
        emailAddress: mockData.session?.email || account.email || registryRecord.email || '',
        phoneNumber: account.phone || mockData.registrationDraft?.phone || registryRecord.mobileNumber || '',
        country: 'Tanzania',
        preferredLanguage: 'English',
        companyName: isOrganization ? (profile.verifiedName || registryRecord.name || '') : '',
        individualDisplayName: !isOrganization ? (profile.verifiedName || registryRecord.name || profile.signatureName || '') : '',
        companyType: entityType === 'company' ? 'Private limited company' : entityType === 'business' ? 'Sole proprietorship' : '',
        registrationNumber: profile.brelaNumber || profile.businessNumber || registryRecord.reference || '',
        tinNumber: profile.tinNumber || registryRecord.tin || '',
        businessDescription: '',
        physicalAddress: registryRecord.physicalAddress || registryRecord.location || '',
        postalAddress: registryRecord.postalAddress || '',
        entityCountry: 'Tanzania',
        regionDistrict: registryRecord.taxRegion || registryRecord.location || '',
        contactPerson: profile.signatureName || account.displayName || '',
        position: profile.signatureTitle || '',
        officialEmail: account.email || registryRecord.email || '',
        officialPhone: account.phone || registryRecord.mobileNumber || '',
        canCreateTender: entityType !== 'individual',
        canSubmitBid: true,
        notificationsEnabled: true,
        autoMatchTenders: true
    };
}

function getIamEntityLabel(entityType = 'individual') {
    return entityType === 'company' ? 'Company' : entityType === 'business' ? 'Business' : 'Individual';
}

function getIamVisibleEntityTypes(entityType = 'individual') {
    return entityType === 'individual' ? ['all', 'individual'] : ['all', 'organization', entityType];
}

function renderIamField(data, options) {
    const {
        section,
        name,
        label,
        type = 'text',
        required = false,
        entity = 'all',
        placeholder = '',
        options: selectOptions = [],
        rows = 3,
        hint = '',
        readonly = false,
        wide = false
    } = options;
    const value = getIamProfileValue(data, name, '');
    const attrs = [
        `name="${escapeIamProfileHtml(name)}"`,
        `data-iam-section="${escapeIamProfileHtml(section)}"`,
        `data-iam-field="${escapeIamProfileHtml(name)}"`,
        `data-iam-entity="${escapeIamProfileHtml(entity)}"`,
        required ? 'data-iam-required="true"' : '',
        readonly ? 'readonly' : '',
        placeholder ? `placeholder="${escapeIamProfileHtml(placeholder)}"` : ''
    ].filter(Boolean).join(' ');
    const requiredMark = required ? ' *' : '';
    let control = '';

    if (type === 'textarea' || type === 'tags' || type === 'repeater') {
        const rowsCount = type === 'repeater' ? 4 : rows;
        control = `<textarea class="form-input" rows="${rowsCount}" ${attrs}>${escapeIamProfileHtml(value)}</textarea>`;
    } else if (type === 'select') {
        const values = [String(value || '')];
        control = `
            <select class="form-input" ${attrs}>
                <option value="">Select</option>
                ${selectOptions.map(option => `<option value="${escapeIamProfileHtml(option)}" ${values.includes(option) ? 'selected' : ''}>${escapeIamProfileHtml(option)}</option>`).join('')}
            </select>
        `;
    } else if (type === 'multiselect') {
        const values = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
        control = `
            <div class="iam-multi-list" role="group" aria-label="${escapeIamProfileHtml(label)}">
                ${selectOptions.map(option => `
                    <label class="iam-multi-option">
                        <input type="checkbox" ${attrs} value="${escapeIamProfileHtml(option)}" ${values.includes(option) ? 'checked' : ''}>
                        <span>${escapeIamProfileHtml(option)}</span>
                    </label>
                `).join('')}
            </div>
        `;
    } else if (type === 'toggle') {
        const checked = value === true || value === 'true' || value === 'on';
        control = `
            <label class="iam-toggle">
                <input type="checkbox" ${attrs} ${checked ? 'checked' : ''}>
                <span></span>
                <em>${checked ? 'Enabled' : 'Optional'}</em>
            </label>
        `;
    } else if (type === 'upload') {
        control = `
            <div class="iam-upload-control">
                <input class="form-input" type="file" data-iam-upload-input="${escapeIamProfileHtml(name)}">
                <input type="hidden" ${attrs} value="${escapeIamProfileHtml(value)}">
                <small data-iam-upload-name="${escapeIamProfileHtml(name)}">${value ? `Selected: ${escapeIamProfileHtml(value)}` : 'No file selected yet.'}</small>
            </div>
        `;
    } else {
        control = `<input class="form-input" type="${escapeIamProfileHtml(type)}" value="${escapeIamProfileHtml(value)}" ${attrs}>`;
    }

    return `
        <div class="form-group iam-profile-field ${wide ? 'wide' : ''}" data-iam-field-wrap data-iam-entity="${escapeIamProfileHtml(entity)}">
            <label class="form-label">${escapeIamProfileHtml(label)}${requiredMark}</label>
            ${control}
            ${hint ? `<small class="form-hint">${escapeIamProfileHtml(hint)}</small>` : ''}
        </div>
    `;
}

function renderIamReadonlyRows(rows) {
    return rows.map(([label, value]) => `
        <div class="iam-readonly-row">
            <span>${escapeIamProfileHtml(label)}</span>
            <strong>${escapeIamProfileHtml(value || 'Not generated')}</strong>
        </div>
    `).join('');
}

function renderVerificationStatus() {
    const user = mockData.users.buyer || {};
    const profile = mockData.eKycProfile || {};
    const account = mockData.pendingAccount || {};
    const registryRecord = profile.registryRecord || {};
    const entityType = profile.entityType || 'individual';
    const entityLabel = getIamEntityLabel(entityType);
    const isComplete = profile.status === 'completed' || account.ekycCompleted || mockData.session?.isNewUser === false;
    const defaults = getIamProfileDefaults(profile, account);
    const iamData = { ...defaults, ...(profile.iamProfile || {}) };
    const visibleTypes = getIamVisibleEntityTypes(entityType);
    const completion = window.app?.computeIamProfileCompletion
        ? window.app.computeIamProfileCompletion(entityType, iamData)
        : { completed: 0, total: 1, percent: 0, sectionStatus: {} };
    const sectionStatus = completion.sectionStatus || {};

    const countries = ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'South Africa', 'United Arab Emirates'];
    const languages = ['English', 'Swahili', 'French', 'Arabic'];
    const companyTypes = ['Private limited company', 'Public company', 'Partnership', 'NGO', 'Government agency', 'Sole proprietorship'];
    const industries = ['Construction', 'Health', 'ICT', 'Education', 'Transport', 'Manufacturing', 'Agriculture', 'Consulting', 'Supplies'];
    const categories = ['Goods', 'Works', 'Non Consultancy', 'Consultancy', 'Medical Supplies', 'ICT Equipment', 'Construction Works', 'Office Supplies', 'Vehicle Maintenance'];
    const sizes = ['Micro', 'Small', 'Medium', 'Large', 'Enterprise'];
    const locations = ['Local', 'International', 'Both'];
    const capacityRanges = ['Below TZS 100M', 'TZS 100M - 500M', 'TZS 500M - 1B', 'TZS 1B - 5B', 'Above TZS 5B'];
    const regions = ['Dar es Salaam', 'Arusha', 'Dodoma', 'Mwanza', 'Mbeya', 'Morogoro', 'Tanga', 'Zanzibar', 'Nationwide'];

    const requiredByEntity = (fieldEntity = 'all') => visibleTypes.includes(fieldEntity);
    const sectionBadge = (key) => {
        const status = sectionStatus[key] || { completed: 0, total: 0, percent: 100 };
        const done = status.total === 0 || status.completed >= status.total;
        return `<span class="badge ${done ? 'badge-success' : 'badge-warning'}">${status.completed}/${status.total} required</span>`;
    };

    return `
        <div class="main-layout">
            <div class="main-content">
                <form class="iam-profile-page" data-iam-profile-form>
                    <section class="iam-profile-hero">
                        <div>
                            <span class="badge ${isComplete ? 'badge-success' : 'badge-warning'}">${isComplete ? 'Identity verified' : 'Identity verification pending'}</span>
                            <h1>Account Profile Workspace</h1>
                            <p>${entityLabel} profile details can be completed over time. ProcureX keeps verification data read-only while allowing account, classification, documents, financial, capacity, and procurement settings to be updated as needed.</p>
                            <div class="iam-hero-actions">
                                <button class="btn btn-primary" type="button" data-iam-save-profile>Save Draft</button>
                                <button class="btn btn-secondary" type="button" data-navigate="identity-verification">Update Identity Verification</button>
                            </div>
                            <small class="iam-save-status" data-iam-save-status>Draft changes stay available during this ProcureX session.</small>
                        </div>
                        <div class="iam-profile-score">
                            <div class="iam-score-copy">
                                <span>Profile completion</span>
                                <strong data-iam-completion-percent>${completion.percent}%</strong>
                                <div class="progress-bar"><div class="progress-fill" data-iam-completion-fill style="width: ${completion.percent}%;"></div></div>
                                <small data-iam-completion-copy>${completion.completed} of ${completion.total} required entity fields complete</small>
                            </div>
                        </div>
                    </section>

                    <nav class="iam-profile-tabs" aria-label="account profile sections">
                        ${[
                            ['overview', 'Overview'],
                            ['account', 'Account'],
                            ['entity', entityType === 'individual' ? 'Individual' : 'Entity'],
                            ['classification', 'Classification'],
                            ['contacts', 'Contacts'],
                            ['documents', 'Documents'],
                            ['financial', 'Financial'],
                            ['capacity', 'Capacity'],
                            ['settings', 'Settings'],
                            ['system', 'System']
                        ].map(([key, label], index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-iam-tab="${key}">${label}</button>`).join('')}
                    </nav>

                    <section class="iam-profile-section active" data-iam-panel="overview">
                        <div class="iam-section-heading">
                            <div><span class="section-kicker">Overview</span><h2>${entityLabel} verification record</h2></div>
                            <span class="badge badge-info">${entityType}</span>
                        </div>
                        <div class="iam-overview-grid">
                            ${renderIamReadonlyRows([
                                ['Applicant type', entityLabel],
                                ['Verified name', profile.verifiedName || registryRecord.name || account.displayName || 'Existing user account'],
                                ['Registry source', profile.registrySource || registryRecord.source || 'TRA / BRELA'],
                                ['Registry reference', profile.tinNumber || profile.brelaNumber || profile.businessNumber || registryRecord.reference || 'Stored on account'],
                                ['Digital signature', profile.signatureName || 'Stored digital signature'],
                                ['Profile status', `${completion.percent}% complete`]
                            ])}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="account">
                        <div class="iam-section-heading"><div><span class="section-kicker">Account Holder</span><h2>Account Information</h2></div>${sectionBadge('account')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'account', name: 'fullName', label: 'Full Name', required: true })}
                            ${renderIamField(iamData, { section: 'account', name: 'emailAddress', label: 'Email Address', type: 'email', required: true })}
                            ${renderIamField(iamData, { section: 'account', name: 'phoneNumber', label: 'Phone Number', type: 'tel', required: true })}
                            ${renderIamField(iamData, { section: 'account', name: 'passwordNote', label: 'Password', readonly: true, placeholder: 'Managed during sign-in and registration' })}
                            ${renderIamField(iamData, { section: 'account', name: 'profilePhoto', label: 'Profile Photo', type: 'upload' })}
                            ${renderIamField(iamData, { section: 'account', name: 'country', label: 'Country', type: 'select', options: countries, required: true })}
                            ${renderIamField(iamData, { section: 'account', name: 'preferredLanguage', label: 'Preferred Language', type: 'select', options: languages })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="entity">
                        <div class="iam-section-heading"><div><span class="section-kicker">Legal identity</span><h2>${entityType === 'individual' ? 'Individual Information' : 'Company / Business Information'}</h2></div>${sectionBadge('entity')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'entity', name: 'individualDisplayName', label: 'Professional / Display Name', required: requiredByEntity('individual'), entity: 'individual' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'professionalTitle', label: 'Professional Title', entity: 'individual' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'nationalId', label: 'National ID / Passport', entity: 'individual' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'companyName', label: 'Company / Business Name', required: requiredByEntity('organization'), entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'tradingName', label: 'Trading Name', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'companyType', label: 'Company Type', type: 'select', options: companyTypes, required: requiredByEntity('organization'), entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'registrationNumber', label: 'Registration Number', required: entityType === 'company', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'tinNumber', label: 'TIN Number', required: true })}
                            ${renderIamField(iamData, { section: 'entity', name: 'vatNumber', label: 'VAT Number', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'yearEstablished', label: 'Year Established', type: 'number', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'numberOfEmployees', label: 'Number of Employees', type: 'number', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'website', label: 'Website', type: 'url', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'companyLogo', label: 'Company Logo', type: 'upload', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'businessDescription', label: entityType === 'individual' ? 'Professional Description' : 'Business Description', type: 'textarea', required: true, wide: true })}
                            ${renderIamField(iamData, { section: 'entity', name: 'physicalAddress', label: 'Physical Address', required: true })}
                            ${renderIamField(iamData, { section: 'entity', name: 'postalAddress', label: 'Postal Address' })}
                            ${renderIamField(iamData, { section: 'entity', name: 'entityCountry', label: 'Entity Country', type: 'select', options: countries, required: true })}
                            ${renderIamField(iamData, { section: 'entity', name: 'regionDistrict', label: 'Region / District', type: 'select', options: regions, required: true })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="classification">
                        <div class="iam-section-heading"><div><span class="section-kicker">Procurement Categories</span><h2>Business Classification</h2></div>${sectionBadge('classification')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'classification', name: 'industry', label: 'Industry', type: 'select', options: industries, required: true })}
                            ${renderIamField(iamData, { section: 'classification', name: 'procurementCategories', label: 'Procurement Categories', type: 'multiselect', options: categories, required: true })}
                            ${renderIamField(iamData, { section: 'classification', name: 'goodsOffered', label: 'Goods Offered', type: 'tags', hint: 'Separate tags with commas.' })}
                            ${renderIamField(iamData, { section: 'classification', name: 'servicesOffered', label: 'Services Offered', type: 'tags', hint: 'Separate tags with commas.' })}
                            ${renderIamField(iamData, { section: 'classification', name: 'worksCapability', label: 'Works Capability', type: 'tags', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'classification', name: 'consultancyAreas', label: 'Consultancy Areas', type: 'tags' })}
                            ${renderIamField(iamData, { section: 'classification', name: 'businessSize', label: 'Business Size', type: 'select', options: sizes, entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'classification', name: 'localInternational', label: 'Local or International', type: 'select', options: locations, required: true })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="contacts">
                        <div class="iam-section-heading"><div><span class="section-kicker">Procurement communication</span><h2>Contact Information</h2></div>${sectionBadge('contacts')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'contacts', name: 'contactPerson', label: 'Contact Person', required: true })}
                            ${renderIamField(iamData, { section: 'contacts', name: 'position', label: 'Position' })}
                            ${renderIamField(iamData, { section: 'contacts', name: 'officialEmail', label: 'Official Email', type: 'email', required: true })}
                            ${renderIamField(iamData, { section: 'contacts', name: 'officialPhone', label: 'Official Phone Number', type: 'tel', required: true })}
                            ${renderIamField(iamData, { section: 'contacts', name: 'alternativePhone', label: 'Alternative Phone', type: 'tel' })}
                            ${renderIamField(iamData, { section: 'contacts', name: 'supportEmail', label: 'Support Email', type: 'email' })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="documents">
                        <div class="iam-section-heading"><div><span class="section-kicker">Reusable documents</span><h2>Legal and Compliance Documents</h2></div>${sectionBadge('documents')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'documents', name: 'certificateOfIncorporation', label: 'Certificate of Incorporation', type: 'upload', entity: 'organization', required: entityType === 'company' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'businessLicense', label: 'Business License', type: 'upload', entity: 'organization', required: entityType === 'business' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'tinCertificate', label: 'TIN Certificate', type: 'upload', required: true })}
                            ${renderIamField(iamData, { section: 'documents', name: 'vatCertificate', label: 'VAT Certificate', type: 'upload', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'taxClearanceCertificate', label: 'Tax Clearance Certificate', type: 'upload' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'professionalLicenses', label: 'Professional Licenses', type: 'upload' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'insuranceDocuments', label: 'Insurance Documents', type: 'upload', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'complianceCertificates', label: 'Compliance Certificates', type: 'upload' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'companyProfilePdf', label: 'Company / Professional Profile PDF', type: 'upload' })}
                            ${renderIamField(iamData, { section: 'documents', name: 'organizationStamp', label: 'Organization Stamp', type: 'upload', entity: 'organization' })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="financial">
                        <div class="iam-section-heading"><div><span class="section-kicker">Financial Qualification</span><h2>Financial Information</h2></div>${sectionBadge('financial')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'financial', name: 'bankName', label: 'Bank Name' })}
                            ${renderIamField(iamData, { section: 'financial', name: 'accountName', label: 'Account Name' })}
                            ${renderIamField(iamData, { section: 'financial', name: 'accountNumber', label: 'Account Number' })}
                            ${renderIamField(iamData, { section: 'financial', name: 'annualTurnover', label: 'Annual Turnover', type: 'number', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'financial', name: 'auditedFinancialStatements', label: 'Audited Financial Statements', type: 'upload', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'financial', name: 'financialCapacityRange', label: 'Financial Capacity Range', type: 'select', options: capacityRanges })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="capacity">
                        <div class="iam-section-heading"><div><span class="section-kicker">Experience and Capacity</span><h2>Experience and Technical Capacity</h2></div>${sectionBadge('capacity')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'capacity', name: 'yearsOfExperience', label: 'Years of Experience', type: 'number' })}
                            ${renderIamField(iamData, { section: 'capacity', name: 'pastProjects', label: 'Past Projects', type: 'repeater', wide: true, hint: 'One project per line.' })}
                            ${renderIamField(iamData, { section: 'capacity', name: 'clientReferences', label: 'Client References', type: 'repeater', wide: true })}
                            ${renderIamField(iamData, { section: 'capacity', name: 'technicalStaff', label: 'Technical Staff', type: 'repeater', wide: true, entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'capacity', name: 'keyPersonnel', label: 'Key Personnel', type: 'repeater', wide: true })}
                            ${renderIamField(iamData, { section: 'capacity', name: 'equipmentList', label: 'Equipment List', type: 'repeater', wide: true, entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'capacity', name: 'certifications', label: 'Certifications', type: 'repeater', wide: true })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="settings">
                        <div class="iam-section-heading"><div><span class="section-kicker">Notification Preferences</span><h2>Procurement Operation Settings</h2></div>${sectionBadge('settings')}</div>
                        <div class="iam-form-grid">
                            ${renderIamField(iamData, { section: 'settings', name: 'canCreateTender', label: 'Can Create Tender', type: 'toggle', entity: 'organization' })}
                            ${renderIamField(iamData, { section: 'settings', name: 'canSubmitBid', label: 'Can Submit Bid', type: 'toggle' })}
                            ${renderIamField(iamData, { section: 'settings', name: 'preferredTenderCategories', label: 'Preferred Tender Categories', type: 'multiselect', options: categories })}
                            ${renderIamField(iamData, { section: 'settings', name: 'regionsOfOperation', label: 'Regions of Operation', type: 'multiselect', options: regions })}
                            ${renderIamField(iamData, { section: 'settings', name: 'notificationsEnabled', label: 'Notification Preferences', type: 'toggle' })}
                            ${renderIamField(iamData, { section: 'settings', name: 'autoMatchTenders', label: 'Auto-Match Tenders', type: 'toggle' })}
                        </div>
                    </section>

                    <section class="iam-profile-section" data-iam-panel="system">
                        <div class="iam-section-heading"><div><span class="section-kicker">System Verification Record</span><h2>Verification and System Information</h2></div><span class="badge badge-info">System generated</span></div>
                        <div class="iam-overview-grid">
                            ${renderIamReadonlyRows([
                                ['Verification Status', isComplete ? 'Verified' : 'Pending'],
                                ['KYC Status', profile.status || 'not_started'],
                                ['Verification Score', `${completion.percent}/100 profile score`],
                                ['Verified Badge', isComplete ? 'Eligible' : 'Pending identity verification'],
                                ['Verification Notes', isComplete ? 'Registry details and signature confirmed.' : 'Complete Identity Verification first.'],
                                ['Company ID', profile.companyId || `VER-${String(account.email || 'account').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'ACCOUNT'}`],
                                ['User ID', profile.userId || `USR-${String(mockData.session?.email || account.email || 'account').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`],
                                ['Registration Date', profile.registrationDate || new Date().toISOString().slice(0, 10)],
                                ['Tender History', 'Tracked by procurement modules'],
                                ['Submitted Bids', 'Tracked by bid workspace'],
                                ['Awarded Contracts', 'Tracked by contract modules'],
                                ['Activity Logs', 'Available in audit views'],
                                ['Audit Trail', 'System maintained'],
                                ['Login History', 'System maintained'],
                                ['Document Expiry Tracker', 'Pending document dates']
                            ])}
                        </div>
                    </section>
                </form>
            </div>
        </div>
    `;
}

if (window.app) {
    window.app.renderVerificationStatus = renderVerificationStatus;
}
