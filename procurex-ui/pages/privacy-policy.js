// Privacy Policy Page Component

function renderPrivacyIcon(paths, className = 'privacy-icon') {
    return `
        <svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${paths}
        </svg>
    `;
}

function renderPrivacyList(items = []) {
    return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function renderPrivacyDetails(items = []) {
    return `
        <div class="privacy-accordion">
            ${items.map((item, index) => `
                <details ${index === 0 ? 'open' : ''}>
                    <summary>${item.title}</summary>
                    <div>
                        ${item.text ? `<p>${item.text}</p>` : ''}
                        ${item.items ? renderPrivacyList(item.items) : ''}
                    </div>
                </details>
            `).join('')}
        </div>
    `;
}

function renderPrivacyPolicy() {
    const summaryCards = [
        {
            icon: '<path d="M12 3l8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7z"/><path d="m9 12 2 2 4-4"/>',
            title: 'We Collect Data Responsibly',
            text: 'We collect information needed to operate the procurement platform and support user activities.'
        },
        {
            icon: '<path d="M8 11V7a4 4 0 0 1 8 0v4"/><rect x="5" y="11" width="14" height="10" rx="2"/>',
            title: 'We Protect Procurement Records',
            text: 'Tender, bid, contract, and negotiation records are handled with security and access controls.'
        },
        {
            icon: '<path d="M3 12h18"/><path d="M12 3v18"/><path d="m5 5 14 14"/>',
            title: 'We Do Not Sell Personal Data',
            text: 'ProcureX does not sell users\' personal information to third parties.'
        },
        {
            icon: '<path d="M9 11l2 2 4-4"/><path d="M21 12a9 9 0 1 1-9-9"/>',
            title: 'You Have Privacy Rights',
            text: 'Users may contact ProcureX to access, correct, update, or request deletion of certain information.'
        }
    ];

    const glanceItems = [
        'Create and manage user accounts',
        'Support tender creation and publication',
        'Enable bid submission',
        'Manage evaluation and awarding',
        'Support contract negotiation and execution',
        'Improve platform security and performance',
        'Communicate important updates',
        'Maintain platform trust and accountability'
    ];

    const scopeItems = [
        ['Website', '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>'],
        ['Account', '<circle cx="12" cy="7" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>'],
        ['Tender', '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="M9 12h6"/><path d="M9 16h5"/>'],
        ['Bid', '<path d="M4 6h16v12H4z"/><path d="M8 10h8"/><path d="M8 14h5"/>'],
        ['Contract', '<path d="M7 3h10v18H7z"/><path d="M10 8h4"/><path d="M10 12h4"/><path d="M10 16h2"/>'],
        ['Support', '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>'],
        ['Notifications', '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>']
    ];

    const collectedInfo = [
        {
            title: 'Account Registration Information',
            text: 'When users create an account on ProcureX, we may collect details needed to create accounts, identify users, support secure login, and provide access to procurement features.',
            items: ['Full name', 'Email address', 'Phone number', 'Password or authentication details', 'User role or account type', 'Organization or company name', 'Business category', 'Country, region, or location', 'Profile picture or logo, where applicable', 'Account verification details']
        },
        {
            title: 'Business and Organization Information',
            text: 'For users representing companies, organizations, institutions, or businesses, ProcureX may collect information that helps buyers and suppliers present accurate business identities.',
            items: ['Business name', 'Business registration details', 'Tax identification details, where required', 'Business license information, where required', 'Organization address', 'Business sector or industry', 'Company profile', 'Contact person details', 'Supplier profile information', 'Buyer profile information', 'Uploaded company documents']
        },
        {
            title: 'Tender Information',
            text: 'When buyers create tenders, ProcureX may collect and store information that allows the platform to publish and manage procurement opportunities.',
            items: ['Tender title', 'Tender category', 'Procurement type', 'Tender description', 'Scope of supply or work', 'Tender requirements', 'Eligibility criteria', 'Evaluation criteria', 'Submission deadline', 'Delivery requirements', 'Payment terms', 'Contract terms', 'Uploaded tender documents', 'Clarification questions and answers', 'Tender publishing status']
        },
        {
            title: 'Bid Submission Information',
            text: 'When suppliers submit bids, ProcureX may collect information that allows buyers to review supplier submissions and make procurement decisions.',
            items: ['Technical proposal details', 'Financial proposal details', 'Pricing information', 'Delivery schedule', 'Methodology', 'Work plan', 'Team composition', 'Supplier qualifications', 'Compliance responses', 'Uploaded bid documents', 'Certificates and licenses', 'Product brochures', 'Drawings, specifications, or supporting files', 'Clarification responses', 'Bid submission timestamp']
        },
        {
            title: 'Evaluation and Award Information',
            text: 'During tender evaluation and awarding, ProcureX may process information that supports transparent and organized procurement decision-making.',
            items: ['Evaluation scores', 'Buyer comments', 'Evaluation status', 'Bid comparison information', 'Award recommendations', 'Award decisions', 'Rejection reasons', 'Supplier ranking', 'Evaluation history', 'Award notification records']
        },
        {
            title: 'Contract and Negotiation Information',
            text: 'When a tender is awarded and moves into contracting, ProcureX may collect information that supports preparation, negotiation, acceptance, implementation, and closure.',
            items: ['Draft contract terms', 'Contract clauses', 'Contract value', 'Payment terms', 'Delivery milestones', 'Negotiation messages', 'Clause revision history', 'Acceptance status', 'Contract documents', 'Contract start and end dates', 'Sign-off or approval records', 'Post-award performance records']
        },
        {
            title: 'Communication Information',
            text: 'ProcureX may collect communication records created through the platform to maintain clear procurement communication and support dispute resolution where necessary.',
            items: ['Messages between buyers and suppliers', 'Tender clarification questions', 'Support requests', 'Notification responses', 'Negotiation comments', 'Platform support communications', 'Dispute or complaint messages']
        },
        {
            title: 'Technical and Usage Information',
            text: 'When users access ProcureX, we may automatically collect technical information to improve performance, detect misuse, prevent fraud, and maintain security.',
            items: ['IP address', 'Browser type', 'Device type', 'Operating system', 'Login date and time', 'Pages visited', 'Actions performed', 'Session duration', 'Error logs', 'Security logs', 'Cookies and similar tracking information']
        }
    ];

    const useCases = [
        ['Create and Manage Accounts', 'Register users, verify identity, manage login access, and maintain user profiles.'],
        ['Provide Procurement Services', 'Support tender creation, bid submission, evaluation, awarding, contracting, negotiation, and post-award management.'],
        ['Connect Buyers and Suppliers', 'Use business and profile information to help buyers identify suppliers and help suppliers participate in opportunities.'],
        ['Process Tender and Bid Activities', 'Allow buyers to publish opportunities and suppliers to submit structured proposals.'],
        ['Support Contract Management', 'Manage award acceptance, negotiation, contract preparation, milestones, and closure.'],
        ['Communicate With Users', 'Send account updates, tender alerts, bid status updates, award notifications, security alerts, and support responses.'],
        ['Improve the Platform', 'Understand usage patterns and improve design, performance, features, and user experience.'],
        ['Protect the Platform', 'Detect fraud, unauthorized access, suspicious behavior, misuse, or violations of platform rules.'],
        ['Comply With Requirements', 'Process or retain information where required by applicable laws, regulations, court orders, or lawful authority requests.'],
        ['Maintain Records', 'Keep digital records of tenders, bids, awards, contracts, negotiations, and actions performed on the platform.']
    ];

    const legalBases = [
        ['User Consent', 'Where users voluntarily provide information or agree to specific processing activities.'],
        ['Contractual Necessity', 'Where information is needed to provide ProcureX services, manage accounts, process bids, or support procurement workflows.'],
        ['Legal Obligation', 'Where information must be processed or retained to comply with laws, regulations, or official requirements.'],
        ['Legitimate Business Interest', 'Where processing is necessary to operate the platform, improve services, prevent fraud, protect users, and maintain procurement integrity.'],
        ['Public or Regulatory Interest', 'Where applicable, certain procurement-related records may need to be retained or disclosed for lawful accountability, audit, or regulatory purposes.']
    ];

    const sharing = [
        ['Between Buyers and Suppliers', 'Information may be shared when necessary for tender participation, bid evaluation, contract negotiation, award communication, and post-award management. For example, a supplier bid may be visible to the buyer who published the tender, buyer requirements may be visible to suppliers, and contract terms may be visible to both awarded parties.'],
        ['With Organization Representatives', 'Where an account belongs to a company or organization, authorized representatives may access procurement records related to that organization.'],
        ['With Service Providers', 'ProcureX may use trusted service providers for hosting, cloud storage, email delivery, analytics, security monitoring, payment processing, or technical support. These providers should only access information needed to perform their services.'],
        ['With Legal or Regulatory Authorities', 'ProcureX may disclose information where required by law, court order, regulatory request, investigation, or lawful government authority.'],
        ['During Business Transfers', 'If ProcureX is involved in a merger, acquisition, restructuring, or transfer of business assets, user information may be transferred as part of that process, subject to appropriate safeguards.'],
        ['To Protect Rights and Safety', 'We may share information where necessary to protect ProcureX, users, organizations, platform security, or the rights and safety of others.']
    ];

    const visibilityRows = [
        ['Buyer Information Visible to Suppliers', ['Buyer organization name', 'Tender title', 'Tender description', 'Tender requirements', 'Submission deadline', 'Contact or clarification channel', 'Published procurement documents', 'Award or contract details where applicable']],
        ['Supplier Information Visible to Buyers', ['Supplier name', 'Supplier profile', 'Submitted bid details', 'Uploaded documents', 'Financial proposal', 'Technical proposal', 'Compliance responses', 'Delivery or service approach', 'Contract acceptance or negotiation responses']],
        ['Authorized Internal Access', ['User support', 'System monitoring', 'Compliance review', 'Dispute handling', 'Security checks', 'Platform improvement']]
    ];

    const cookies = [
        ['Essential Cookies', 'Required for login, authentication, security, and basic platform functionality.'],
        ['Performance Cookies', 'Help us understand how users interact with the platform and identify areas for improvement.'],
        ['Preference Cookies', 'Remember user preferences such as language, display settings, or saved filters.'],
        ['Security Cookies', 'Help detect suspicious login attempts, unauthorized access, or unusual activity.']
    ];

    const securityControls = ['Password protection', 'Secure login systems', 'Data encryption where appropriate', 'Access control by role', 'Secure document storage', 'Activity logging', 'System monitoring', 'Regular security reviews', 'Backup and recovery controls', 'Internal permission management', 'Protection against unauthorized access'];

    const responsibilities = ['Provide accurate account and business information', 'Keep login credentials confidential', 'Avoid sharing passwords with unauthorized persons', 'Upload only documents they are allowed to share', 'Avoid submitting false or misleading procurement information', 'Review tender and bid documents before submission', 'Report suspicious activity immediately', 'Use the platform according to applicable laws and platform rules'];

    const retention = [
        ['Account Information', 'Kept while the account is active and for a reasonable period after account closure where necessary.'],
        ['Tender and Bid Records', 'May be retained for procurement history, audit, dispute resolution, compliance, and record-keeping purposes.'],
        ['Contract Records', 'May be retained for the duration of the contract and after completion where necessary for legal, financial, or operational reasons.'],
        ['Communication Records', 'May be retained to support clarification history, negotiations, disputes, support requests, and platform accountability.'],
        ['Technical Logs', 'May be retained for security, fraud detection, troubleshooting, and system improvement.']
    ];

    const rights = [
        ['Access Their Information', 'Users may request a copy of certain personal information held by ProcureX.'],
        ['Correct Information', 'Users may request correction of inaccurate or incomplete information.'],
        ['Update Account Details', 'Users may update profile, business, and contact information through account settings where available.'],
        ['Delete Certain Information', 'Users may request deletion of certain personal information, subject to legal, contractual, procurement, or record-keeping requirements.'],
        ['Restrict Processing', 'Users may request that certain processing activities be limited where applicable.'],
        ['Object to Processing', 'Users may object to certain uses of their information where applicable.'],
        ['Withdraw Consent', 'Where processing is based on consent, users may withdraw consent, although this may affect access to some platform services.'],
        ['Request Support', 'Users may contact ProcureX for privacy-related questions, complaints, or requests.']
    ];

    const retainedAfterDeletion = ['Tender records', 'Bid submission records', 'Award decisions', 'Contract records', 'Payment-related records', 'Dispute history', 'Compliance documents', 'Security logs', 'Records required by law'];
    const sensitiveDocuments = ['Financial proposals', 'Tax documents', 'Business registration certificates', 'Technical drawings', 'Contract drafts', 'Legal documents', 'Pricing schedules', 'Supplier qualifications', 'Evaluation records', 'Negotiation records'];
    const supplierData = ['Supplier profile', 'Business documents', 'Bid submissions', 'Pricing information', 'Compliance information', 'Contract performance records', 'Award history', 'Communication records'];
    const buyerData = ['Buyer profile', 'Tender creation records', 'Evaluation criteria', 'Award decisions', 'Contract documents', 'Supplier communication', 'Procurement history'];
    const notifications = ['Account verification messages', 'Password reset messages', 'Tender publication alerts', 'Bid submission confirmations', 'Clarification updates', 'Evaluation status updates', 'Award notifications', 'Contract negotiation updates', 'Contract acceptance notifications', 'Security alerts', 'Platform updates', 'Support responses'];

    const toc = [
        ['Introduction', 'privacy-introduction'],
        ['Scope', 'privacy-scope'],
        ['Information We Collect', 'privacy-collect'],
        ['How We Use Information', 'privacy-use'],
        ['How We Share Information', 'privacy-share'],
        ['Cookies', 'privacy-cookies'],
        ['Data Security', 'privacy-security'],
        ['User Responsibilities', 'privacy-responsibilities'],
        ['Data Retention', 'privacy-retention'],
        ['User Rights', 'privacy-rights'],
        ['Account Deletion', 'privacy-deletion'],
        ['Confidentiality', 'privacy-confidentiality'],
        ['Third-Party Services', 'privacy-third-party'],
        ['Policy Updates', 'privacy-updates'],
        ['Contact Us', 'privacy-contact']
    ];

    return `
        <div class="privacy-page">
            <header class="privacy-nav">
                <div class="privacy-container privacy-nav-inner">
                    <a class="brand privacy-brand" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <nav class="privacy-nav-links" aria-label="Privacy page navigation">
                        <a href="#" data-navigate="guest-marketplace">Open Tenders</a>
                        <a href="#" data-navigate="about-procurex">About</a>
                        <a class="active" href="#" data-navigate="privacy-policy">Privacy</a>
                        <a href="#" data-navigate="contact">Contact</a>
                    </nav>
                    <div class="privacy-nav-actions">
                        <a href="#" data-navigate="sign-in">Sign In</a>
                        <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                    </div>
                </div>
            </header>

            <main>
                <section class="privacy-hero">
                    <div class="privacy-container privacy-hero-grid">
                        <div class="privacy-hero-copy animate-fade-in">
                            <span class="privacy-eyebrow">Privacy Policy</span>
                            <h1>Your Privacy Matters at ProcureX</h1>
                            <p class="privacy-lead">ProcureX is committed to protecting the personal, business, procurement, and account information shared by buyers, suppliers, authorized internal teams, and other platform users.</p>
                            <p>This Privacy Policy explains how ProcureX collects, uses, stores, protects, and shares information when users access the platform, create accounts, publish tenders, submit bids, manage contracts, communicate with other users, or use any ProcureX services.</p>
                            <p>ProcureX is built on trust. Because procurement involves sensitive business information, supplier documents, tender records, financial proposals, compliance documents, and contract data, we take privacy seriously and aim to handle all information responsibly, transparently, and securely.</p>
                            <div class="privacy-actions">
                                <a class="btn btn-primary" href="#privacy-rights">View Your Privacy Rights</a>
                                <button class="btn btn-secondary" type="button" data-navigate="contact">Contact Support</button>
                            </div>
                        </div>

                        <div class="privacy-security-visual animate-fade-in delay-1" aria-label="Secure procurement data illustration">
                            <div class="privacy-shield">${renderPrivacyIcon('<path d="M12 3l8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7z"/><path d="m9 12 2 2 4-4"/>', 'privacy-shield-icon')}</div>
                            <div class="privacy-secure-window">
                                <div><span>Secure data flow</span><strong>Protected workspace</strong></div>
                                <article><strong>Tender Records</strong><span>Encrypted storage</span></article>
                                <article><strong>User Profiles</strong><span>Role access</span></article>
                                <article><strong>Contract Files</strong><span>Locked documents</span></article>
                                <article><strong>Bid Submissions</strong><span>Tracked actions</span></article>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="privacy-summary-band" aria-label="Privacy summary">
                    <div class="privacy-container privacy-summary-grid">
                        ${summaryCards.map(card => `
                            <article>
                                <span>${renderPrivacyIcon(card.icon)}</span>
                                <h3>${card.title}</h3>
                                <p>${card.text}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>

                <div class="privacy-container privacy-layout">
                    <aside class="privacy-toc" aria-label="Privacy Policy sections">
                        <strong>Policy sections</strong>
                        <nav>
                            ${toc.map(([label, id]) => `<a href="#${id}">${label}</a>`).join('')}
                        </nav>
                    </aside>

                    <div class="privacy-content">
                        <section id="privacy-introduction" class="privacy-section">
                            <div class="privacy-two-col">
                                <div>
                                    <span class="privacy-section-label">Introduction</span>
                                    <h2>Introduction</h2>
                                    <p>ProcureX is a digital procurement platform that connects buyers and suppliers through structured tendering, bidding, evaluation, awarding, contracting, negotiation, and post-award management workflows.</p>
                                    <p>To provide these services, ProcureX may collect and process certain information from users. This may include personal information, business information, account details, procurement documents, communication records, bid submissions, and platform activity data.</p>
                                    <p>This Privacy Policy explains what information we collect, why we collect it, how we use it, how we protect it, and what choices users have regarding their information. By using ProcureX, users agree to the collection and use of information as described in this Privacy Policy.</p>
                                </div>
                                <article class="privacy-glance-card">
                                    <h3>Privacy at a Glance</h3>
                                    <p>We collect information to:</p>
                                    ${renderPrivacyList(glanceItems)}
                                </article>
                            </div>
                        </section>

                        <section id="privacy-scope" class="privacy-section">
                            <span class="privacy-section-label">Scope</span>
                            <h2>Scope of This Privacy Policy</h2>
                            <p>This Privacy Policy applies to all users of ProcureX, including buyers, suppliers, organizations, business representatives, individual users, evaluators, authorized internal personnel, and any person who accesses or interacts with the platform.</p>
                            <p>It applies to information collected through the ProcureX website, web application, responsive platform interfaces, account registration forms, tender creation workflows, bid submission workflows, contract management tools, messaging and notification systems, customer support interactions, platform analytics, and activity logs.</p>
                            <p>This Privacy Policy does not apply to third-party websites, external links, or services that are not owned or controlled by ProcureX.</p>
                            <div class="privacy-scope-grid">
                                ${scopeItems.map(([label, icon]) => `<article>${renderPrivacyIcon(icon)}<strong>${label}</strong></article>`).join('')}
                            </div>
                        </section>

                        <section id="privacy-collect" class="privacy-section">
                            <span class="privacy-section-label">Information We Collect</span>
                            <h2>Information We Collect</h2>
                            <p>ProcureX collects different types of information depending on how users interact with the platform.</p>
                            ${renderPrivacyDetails(collectedInfo)}
                        </section>

                        <section id="privacy-use" class="privacy-section">
                            <span class="privacy-section-label">Use of Information</span>
                            <h2>How We Use Your Information</h2>
                            <p>ProcureX uses collected information to operate, improve, secure, and personalize the procurement platform.</p>
                            <div class="privacy-card-grid two">
                                ${useCases.map(([title, text]) => `<article><h3>${title}</h3><p>${text}</p></article>`).join('')}
                            </div>
                        </section>

                        <section class="privacy-section">
                            <span class="privacy-section-label">Legal Basis</span>
                            <h2>Why ProcureX Is Allowed to Process Your Information</h2>
                            <p>ProcureX processes user information only where there is a valid reason to do so.</p>
                            <div class="privacy-card-grid">
                                ${legalBases.map(([title, text]) => `<article><h3>${title}</h3><p>${text}</p></article>`).join('')}
                            </div>
                        </section>

                        <section id="privacy-share" class="privacy-section">
                            <span class="privacy-section-label">Sharing</span>
                            <h2>How Information May Be Shared</h2>
                            <p>ProcureX does not sell users' personal information. However, some information may be shared where necessary to operate the platform.</p>
                            ${renderPrivacyDetails(sharing.map(([title, text]) => ({ title, text })))}
                        </section>

                        <section class="privacy-section">
                            <span class="privacy-section-label">Visibility</span>
                            <h2>What Other Users Can See</h2>
                            <p>Because ProcureX is a procurement platform, some information is intentionally visible to other users depending on the workflow. ProcureX should apply role-based access controls so users only access information relevant to their permissions and activities.</p>
                            <div class="privacy-visibility-table">
                                ${visibilityRows.map(([title, items]) => `
                                    <article>
                                        <h3>${title}</h3>
                                        ${renderPrivacyList(items)}
                                    </article>
                                `).join('')}
                            </div>
                        </section>

                        <section id="privacy-cookies" class="privacy-section">
                            <span class="privacy-section-label">Cookies</span>
                            <h2>Cookies and Similar Technologies</h2>
                            <p>ProcureX may use cookies and similar technologies to improve user experience, remember login sessions, protect accounts, understand platform usage, and improve performance. Users may adjust browser settings to block or delete cookies, although disabling some cookies may affect platform functionality.</p>
                            <div class="privacy-card-grid">
                                ${cookies.map(([title, text]) => `<article><h3>${title}</h3><p>${text}</p></article>`).join('')}
                            </div>
                        </section>

                        <section id="privacy-security" class="privacy-section privacy-security-section">
                            <span class="privacy-section-label">Data Security</span>
                            <h2>How We Protect Your Information</h2>
                            <p>ProcureX is designed to protect user information from unauthorized access, misuse, loss, alteration, or disclosure. However, no digital system is completely risk-free. Users are also responsible for protecting their account login details and ensuring uploaded documents do not contain unnecessary sensitive information.</p>
                            <div class="privacy-chip-grid">
                                ${securityControls.map(item => `<span>${item}</span>`).join('')}
                            </div>
                        </section>

                        <section id="privacy-responsibilities" class="privacy-section">
                            <span class="privacy-section-label">User Responsibilities</span>
                            <h2>Your Responsibilities as a User</h2>
                            <p>Users are responsible for using ProcureX safely and lawfully. If a user believes their account has been accessed without permission, they should contact ProcureX support immediately.</p>
                            ${renderPrivacyList(responsibilities)}
                        </section>

                        <section id="privacy-retention" class="privacy-section">
                            <span class="privacy-section-label">Data Retention</span>
                            <h2>How Long We Keep Information</h2>
                            <p>ProcureX may retain user information for as long as necessary to provide services, manage procurement records, comply with legal obligations, resolve disputes, enforce agreements, and maintain platform integrity. When information is no longer needed, ProcureX may delete, anonymize, or securely archive it.</p>
                            <div class="privacy-card-grid">
                                ${retention.map(([title, text]) => `<article><h3>${title}</h3><p>${text}</p></article>`).join('')}
                            </div>
                        </section>

                        <section id="privacy-rights" class="privacy-section">
                            <span class="privacy-section-label">Your Privacy Rights</span>
                            <h2>Your Privacy Rights</h2>
                            <p>Subject to applicable laws and platform requirements, users may have rights regarding their personal information.</p>
                            ${renderPrivacyDetails(rights.map(([title, text]) => ({ title, text })))}
                        </section>

                        <section id="privacy-deletion" class="privacy-section">
                            <span class="privacy-section-label">Account Deletion</span>
                            <h2>Account Deactivation and Deletion</h2>
                            <p>Users may request to deactivate or delete their ProcureX account. Because procurement platforms involve legal, financial, contractual, and audit-related records, some information may need to be retained even after account deletion.</p>
                            <p>Where possible, ProcureX may restrict, archive, anonymize, or remove information that is no longer required.</p>
                            ${renderPrivacyList(retainedAfterDeletion)}
                        </section>

                        <section id="privacy-confidentiality" class="privacy-section">
                            <span class="privacy-section-label">Confidentiality</span>
                            <h2>Procurement Documents and Confidentiality</h2>
                            <p>ProcureX may store sensitive procurement documents such as tender documents, financial proposals, technical proposals, certificates, licenses, contracts, drawings, specifications, and negotiation records.</p>
                            <p>Users should only upload documents that are relevant to procurement activities and that they are authorized to share. ProcureX aims to protect procurement documents through access controls and secure storage.</p>
                            <p><strong>Confidentiality principle:</strong> ProcureX should ensure that documents submitted by suppliers are only accessible to authorized buyer representatives, authorized internal personnel, or other permitted parties involved in the procurement process.</p>
                            <div class="privacy-chip-grid">
                                ${sensitiveDocuments.map(item => `<span>${item}</span>`).join('')}
                            </div>
                        </section>

                        <section class="privacy-section">
                            <span class="privacy-section-label">Supplier and Buyer Data</span>
                            <h2>Supplier and Buyer Data</h2>
                            <p>ProcureX may process both supplier and buyer information to support procurement activities. Both buyer and supplier data should be handled carefully because procurement information can be commercially sensitive.</p>
                            <div class="privacy-card-grid two">
                                <article><h3>Supplier Data</h3>${renderPrivacyList(supplierData)}</article>
                                <article><h3>Buyer Data</h3>${renderPrivacyList(buyerData)}</article>
                            </div>
                        </section>

                        <section class="privacy-section">
                            <span class="privacy-section-label">Children's Privacy</span>
                            <h2>Children's Privacy</h2>
                            <p>ProcureX is intended for business, professional, organizational, and procurement-related use. The platform is not designed for children. Users should not create accounts or submit information if they are below the legal age required to enter into business or contractual activities.</p>
                            <p>If ProcureX becomes aware that it has collected information from a child without appropriate consent, it may take steps to delete the information.</p>
                        </section>

                        <section class="privacy-section">
                            <span class="privacy-section-label">International Transfers</span>
                            <h2>International Data Transfers</h2>
                            <p>ProcureX may use technology providers, hosting services, or cloud infrastructure that stores or processes information in different locations. Where information is transferred outside the user's country, ProcureX should take reasonable steps to ensure that appropriate safeguards are in place.</p>
                            <p>These safeguards may include contractual protections, security controls, access restrictions, and compliance with applicable data protection requirements.</p>
                        </section>

                        <section id="privacy-third-party" class="privacy-section">
                            <span class="privacy-section-label">Third-Party Services</span>
                            <h2>Third-Party Services and Links</h2>
                            <p>ProcureX may contain links to third-party websites or services, such as payment providers, map services, document verification providers, communication tools, or external resources.</p>
                            <p>ProcureX is not responsible for the privacy practices, content, or security of third-party websites or services. Users should review the privacy policies of any third-party services they access through ProcureX.</p>
                        </section>

                        <section class="privacy-section">
                            <span class="privacy-section-label">Notifications</span>
                            <h2>Platform Notifications and Communications</h2>
                            <p>ProcureX may send users important notifications related to their accounts and procurement activities. Some communications are essential for platform operation and may not be disabled. Marketing or promotional messages, where used, should provide an option to unsubscribe.</p>
                            <div class="privacy-chip-grid">
                                ${notifications.map(item => `<span>${item}</span>`).join('')}
                            </div>
                        </section>

                        <section id="privacy-updates" class="privacy-section">
                            <span class="privacy-section-label">Policy Updates</span>
                            <h2>Changes to This Privacy Policy</h2>
                            <p>ProcureX may update this Privacy Policy from time to time to reflect changes in platform features, legal requirements, security practices, or business operations. When the policy is updated, ProcureX may notify users through the platform, email, or other appropriate communication channels.</p>
                            <p>The updated policy will include a new effective date. Continued use of ProcureX after changes are made means users accept the updated Privacy Policy.</p>
                        </section>

                        <section id="privacy-contact" class="privacy-section privacy-contact-section">
                            <div>
                                <span class="privacy-section-label">Contact Us</span>
                                <h2>Contact ProcureX About Privacy</h2>
                                <p>Users may contact ProcureX for questions, requests, complaints, or concerns about this Privacy Policy or the handling of their information.</p>
                                <div class="privacy-contact-details">
                                    <span><strong>Platform</strong> ProcureX</span>
                                    <span><strong>Email</strong> <a href="mailto:support@procurex.com">support@procurex.com</a></span>
                                    <span><strong>Privacy Contact</strong> <a href="mailto:privacy@procurex.com">privacy@procurex.com</a></span>
                                    <span><strong>Location</strong> Tanzania</span>
                                </div>
                            </div>

                            <article class="privacy-contact-panel">
                                ${renderPrivacyIcon('<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>')}
                                <h3>Use the dedicated contact page</h3>
                                <p>Privacy requests and support messages are now handled through one separate ProcureX contact form.</p>
                                <button class="btn btn-primary" type="button" data-navigate="contact">Open Contact Page</button>
                            </article>
                        </section>
                    </div>
                </div>

                <section class="privacy-final-cta">
                    <div class="privacy-container privacy-final-panel">
                        <div>
                            <span class="privacy-section-label">Have Questions About Your Privacy?</span>
                            <h2>Contact our privacy support team.</h2>
                            <p>If you have questions about how ProcureX collects, uses, stores, or protects your information, contact our privacy support team.</p>
                        </div>
                        <div class="privacy-actions">
                            <button class="btn btn-primary" type="button" data-navigate="contact">Contact Privacy Support</button>
                            <button class="btn btn-secondary" type="button" data-navigate="sign-in">Manage Account Settings</button>
                        </div>
                    </div>
                </section>
            </main>

            <footer class="privacy-footer">
                <div class="privacy-container">
                    <strong>ProcureX</strong>
                    <p>ProcureX is committed to building a trusted digital procurement environment where buyers and suppliers can participate with confidence.</p>
                </div>
            </footer>
        </div>
    `;
}

if (window.app) {
    window.app.renderPrivacyPolicy = renderPrivacyPolicy;
}
