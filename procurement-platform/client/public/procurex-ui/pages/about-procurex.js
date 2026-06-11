// About ProcureX Page Component

function renderAboutIcon(paths, className = 'about-icon') {
    return `
        <svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${paths}
        </svg>
    `;
}

function renderAboutList(items = []) {
    return `
        <ul>
            ${items.map(item => `<li>${item}</li>`).join('')}
        </ul>
    `;
}

function renderAboutCard(item = {}, className = 'about-card') {
    return `
        <article class="${className}">
            <span class="about-card-icon">${renderAboutIcon(item.icon)}</span>
            <h3>${item.title}</h3>
            <p>${item.text}</p>
        </article>
    `;
}

function renderAboutProcurex() {
    const stats = [
        ['Tenders Created', '2,400+'],
        ['Suppliers Connected', '8,000+'],
        ['Procurement Categories', '4'],
        ['Digital Workflow Steps', '9']
    ];

    const glanceCards = [
        {
            icon: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h10"/>',
            title: 'One Connected Workspace',
            text: 'Tender planning, publishing, submissions, evaluation, awards, contracting, and records stay organized in one flow.'
        },
        {
            icon: '<path d="M12 3l8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7z"/><path d="m9 12 2 2 4-4"/>',
            title: 'Built for Trust',
            text: 'Structured records, status tracking, document history, and contract activity make procurement easier to follow.'
        },
        {
            icon: '<path d="M7 11h10"/><path d="M7 15h6"/><path d="M5 3h14a2 2 0 0 1 2 2v14l-4-3H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/>',
            title: 'Fairer Participation',
            text: 'Suppliers can understand requirements clearly and buyers can receive comparable, structured bid submissions.'
        },
        {
            icon: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-4"/><path d="M12 15V8"/><path d="M16 15V6"/>',
            title: 'Decision Ready',
            text: 'Evaluation criteria, bid comparisons, award decisions, and contract status sit beside the original tender context.'
        }
    ];

    const sectionLinks = [
        ['Who We Are', '#about-who-we-are'],
        ['Purpose', '#about-purpose'],
        ['What ProcureX Does', '#about-capabilities'],
        ['Categories', '#about-categories'],
        ['How It Works', '#about-how-it-works'],
        ['Trust', '#about-trust'],
        ['Mission', '#about-mission'],
        ['CTA', '#about-final-cta']
    ];

    const workflowCards = [
        ['Buyer account', 'Creates tenders and manages requirements'],
        ['Supplier account', 'Discovers opportunities and submits bids'],
        ['Tender marketplace', 'Publishes structured opportunities'],
        ['Bid submission', 'Collects technical, financial, and compliance data'],
        ['Award and contract stage', 'Moves decisions into agreements']
    ];

    const purposeCards = [
        {
            icon: '<path d="M4 5h16"/><path d="M4 12h10"/><path d="M4 19h7"/><path d="M17 14l3 3-3 3"/>',
            title: 'Simplify Procurement',
            text: 'We reduce the complexity of procurement by breaking every process into clear steps, from tender creation to contract management.'
        },
        {
            icon: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
            title: 'Improve Transparency',
            text: 'ProcureX helps users track actions, documents, submissions, evaluations, awards, and contract decisions in a visible digital environment.'
        },
        {
            icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
            title: 'Support Fair Participation',
            text: 'Suppliers can discover relevant opportunities and submit bids through a structured and consistent process.'
        },
        {
            icon: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-4"/><path d="M12 15V8"/><path d="M16 15V6"/>',
            title: 'Strengthen Decision-Making',
            text: 'Buyers can define their own evaluation criteria and review bids based on the requirements they created during tender setup.'
        }
    ];

    const features = [
        ['Tender Creation', 'Buyers can create structured tender packages based on the nature of procurement. The platform guides them through basic information, planning, requirements, evaluation criteria, review, and publishing.'],
        ['Tender Marketplace', 'Published tenders can appear in a marketplace where suppliers can browse opportunities, view requirements, and decide whether to participate.'],
        ['Bid Submission', 'Suppliers can submit bids according to the tender type, including technical proposals, financial proposals, delivery details, compliance documents, work plans, and uploads.'],
        ['Evaluation Management', 'Buyers can evaluate submitted bids based on the criteria they defined during tender creation, keeping evaluation flexible and structured.'],
        ['Awarding and Contracting', 'After evaluation, buyers can award tenders, initiate contract preparation, and manage contract acceptance or negotiation between both parties.'],
        ['Contract Negotiation', 'ProcureX supports negotiation of contract terms, clauses, deliverables, milestones, payment terms, and other important contract details.'],
        ['Post-Award Management', 'After contract acceptance, users can manage progress, deliverables, milestones, supplier performance, completion evidence, and closure.']
    ];

    const audiences = [
        {
            title: 'Buyers',
            text: 'ProcureX helps buyers create tenders, define requirements, publish opportunities, receive bids, evaluate submissions, award suppliers, and manage contracts.',
            benefits: ['Create professional tender documents', 'Define custom evaluation criteria', 'Receive structured supplier submissions', 'Compare bids more easily', 'Manage awards and contracts digitally', 'Reduce manual procurement workload']
        },
        {
            title: 'Suppliers',
            text: 'ProcureX helps suppliers discover tender opportunities, prepare bid responses, upload required documents, submit proposals, receive award notifications, and manage contract obligations.',
            benefits: ['Find procurement opportunities', 'Understand tender requirements clearly', 'Submit technical and financial proposals', 'Track bid status', 'Manage awarded contracts', 'Participate in negotiations']
        }
    ];

    const categories = [
        {
            title: 'Goods Procurement',
            text: 'For purchasing physical items, equipment, materials, supplies, inventory, or products.',
            examples: ['Office equipment', 'ICT hardware', 'Construction materials', 'Medical supplies', 'Furniture', 'Vehicles and spare parts'],
            requirements: ['Item specifications', 'Quantity and unit pricing', 'Delivery schedule', 'Warranty information', 'Product brochures', 'Compliance certificates', 'Financial quotation']
        },
        {
            title: 'Works Procurement',
            text: 'For construction, renovation, installation, repair, maintenance, and infrastructure-related projects.',
            examples: ['Building construction', 'Road works', 'Electrical installation', 'Plumbing works', 'Renovation projects', 'Civil works', 'Maintenance works'],
            requirements: ['Methodology', 'Work program', 'Site execution plan', 'Health, safety, and environmental measures', 'Quality assurance approach', 'Equipment and personnel plan', 'Bill of quantities', 'Drawings acknowledgement', 'Completion schedule']
        },
        {
            title: 'Services Procurement',
            text: 'For non-physical service delivery where the supplier provides operational, professional, technical, or support services.',
            examples: ['Cleaning services', 'Security services', 'IT support', 'Event management', 'Maintenance services', 'Logistics services', 'Training services'],
            requirements: ['Service methodology', 'Staffing plan', 'Service schedule', 'Quality assurance plan', 'Risk management plan', 'Reporting approach', 'Service level commitments', 'Financial proposal']
        },
        {
            title: 'Consultancy Procurement',
            text: 'For professional advisory, expert studies, research, design, audits, and specialist assignments.',
            examples: ['Feasibility studies', 'Engineering consultancy', 'Legal consultancy', 'Financial advisory', 'ICT consultancy', 'Environmental assessment', 'Research assignments', 'Training consultancy'],
            requirements: ['Technical proposal', 'Understanding of assignment', 'Methodology and approach', 'Team composition', 'Consultant CVs', 'Work plan', 'Deliverables', 'Financial proposal', 'Terms of reference response']
        }
    ];

    const differences = [
        ['One Account, Multiple Roles', 'Users can act as both buyers and suppliers when needed, reflecting how real businesses buy and supply.'],
        ['Dynamic Tender Requirements', 'Buyers can define requirements based on the procurement category and the nature of the tender.'],
        ['Buyer-Defined Evaluation Criteria', 'Evaluation remains flexible while staying connected to the original tender setup.'],
        ['Structured Bid Submission', 'Suppliers are guided to submit the right information for goods, works, services, or consultancy.'],
        ['Awarding and Contracting Flow', 'Evaluation results connect directly to award decisions and contract management.'],
        ['Negotiation Support', 'Buyers and awarded suppliers can negotiate key terms and clauses in a controlled environment.'],
        ['Digital Procurement Records', 'Tender creation, submissions, evaluations, awards, negotiations, and progress are kept in one record trail.']
    ];

    const values = [
        ['Transparency', 'We believe procurement should be clear, traceable, and easy to monitor.'],
        ['Fairness', 'We support equal access to opportunities and structured participation for suppliers.'],
        ['Efficiency', 'We help users reduce delays, paperwork, and repetitive manual tasks.'],
        ['Accountability', 'We promote responsible procurement decisions by keeping digital records of key actions.'],
        ['Innovation', 'We use technology to improve how tenders, bids, contracts, and supplier relationships are managed.'],
        ['Trust', 'We aim to create a platform where buyers and suppliers can interact professionally and confidently.']
    ];

    const steps = [
        'Buyer Creates a Tender',
        'Tender Is Published',
        'Supplier Submits a Bid',
        'Buyer Evaluates Bids',
        'Buyer Awards the Tender',
        'Contract Is Prepared',
        'Negotiation Happens if Needed',
        'Contract Is Accepted',
        'Post-Award Activities Begin'
    ];

    const stepText = [
        'The buyer selects the category, enters tender details, defines requirements, sets evaluation criteria, and reviews the tender before publishing.',
        'The tender becomes available for eligible suppliers to view, understand, and prepare their submissions.',
        'The supplier follows a structured bid submission form and provides technical, financial, compliance, and supporting documents.',
        'The buyer reviews submitted bids using the criteria created during tender setup.',
        'The buyer selects the successful supplier and issues an award decision.',
        'The platform moves the awarded tender into the contracting stage where both parties review terms.',
        'The buyer and awarded supplier can negotiate clauses, deliverables, timelines, payment terms, and other conditions.',
        'Once both parties agree, the contract becomes active.',
        'The parties manage delivery, milestones, performance, evidence, payments, and completion records.'
    ];

    const benefitGroups = [
        ['For Buyers', ['Faster tender preparation', 'Better procurement organization', 'Clear supplier submissions', 'Flexible evaluation criteria', 'Easier award management', 'Improved contract tracking', 'Reduced paperwork', 'Better procurement visibility']],
        ['For Suppliers', ['Easier access to tender opportunities', 'Clear bid submission requirements', 'Better understanding of buyer expectations', 'Ability to track bid progress', 'Digital contract participation', 'Improved opportunity management', 'Professional supplier profile presence']],
        ['For Organizations', ['Stronger procurement control', 'Better record keeping', 'Improved compliance support', 'Reduced procurement delays', 'More transparent decision-making', 'Better supplier relationship management']]
    ];

    const trustFeatures = ['Digital tender records', 'Bid submission history', 'Evaluation tracking', 'Award decision records', 'Contract negotiation history', 'Document uploads', 'User activity logs', 'Status-based workflow tracking'];

    const commitments = [
        ['We Commit to Simplicity', 'ProcureX should be easy to use, even for users who are not procurement experts.'],
        ['We Commit to Professionalism', 'The platform should support serious procurement activities with structured workflows and proper documentation.'],
        ['We Commit to Growth', 'ProcureX should help businesses access opportunities and help buyers find capable suppliers.'],
        ['We Commit to Continuous Improvement', 'The platform should keep evolving based on user needs, procurement practices, and technology improvements.']
    ];

    return `
        <div class="about-page">
            <header class="about-nav">
                <div class="about-container about-nav-inner">
                    <a class="brand about-brand" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <nav class="about-nav-links" aria-label="About page navigation">
                        <a href="#" data-navigate="guest-marketplace">Open Tenders</a>
                        <a href="#about-how-it-works">How It Works</a>
                        <a class="active" href="#" data-navigate="about-procurex">About</a>
                        <a href="#" data-navigate="privacy-policy">Privacy</a>
                        <a href="#" data-navigate="terms-and-conditions">Terms</a>
                        <a href="#" data-navigate="contact">Contact</a>
                    </nav>
                    <div class="about-nav-actions">
                        <a href="#" data-navigate="sign-in">Sign In</a>
                        <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                    </div>
                </div>
            </header>

            <main>
                <section class="about-hero">
                    <div class="about-container about-hero-grid">
                        <div class="about-hero-copy animate-fade-in">
                            <span class="about-eyebrow">About ProcureX</span>
                            <h1>Building a Smarter, Fairer, and More Transparent Procurement Future</h1>
                            <p class="about-lead">ProcureX is a digital procurement platform designed to simplify tender creation, supplier participation, bid evaluation, contract management, and post-award procurement activities in one unified workspace.</p>
                            <p>ProcureX helps buyers and suppliers connect through a structured, transparent, and professional procurement process. Whether an organization is purchasing goods, works, services, or consultancy assignments, ProcureX provides a modern platform where tenders can be created, published, submitted, evaluated, awarded, negotiated, and managed efficiently.</p>
                            <div class="about-actions">
                                <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                                <a class="btn btn-secondary" href="#about-how-it-works">Explore How ProcureX Works</a>
                            </div>
                        </div>

                        <div class="about-dashboard-mockup about-os-dashboard animate-fade-in delay-1" aria-label="ProcureX dashboard illustration">
                            <div class="about-window-top">
                                <span>ProcureX operating system</span>
                                <strong>Live procurement command center</strong>
                            </div>
                            <div class="about-mockup-grid">
                                <article class="about-os-pipeline">
                                    <div>
                                        <span>Draft</span>
                                        <i></i>
                                    </div>
                                    <div>
                                        <span>Published</span>
                                        <i></i>
                                    </div>
                                    <div>
                                        <span>Evaluation</span>
                                        <i></i>
                                    </div>
                                    <div>
                                        <span>Award</span>
                                        <i></i>
                                    </div>
                                    <div>
                                        <span>Contract</span>
                                        <i></i>
                                    </div>
                                </article>
                                <article class="about-tender-card about-os-tender">
                                    <span>Active tender</span>
                                    <strong>Medical Supply Framework</strong>
                                    <em>Open marketplace / 12 bids received</em>
                                    <small>Requirements, eligibility, documents, and deadlines synced</small>
                                </article>
                                <article class="about-status-card success">
                                    <span>Award notification</span>
                                    <strong>Ready for approval</strong>
                                    <small>Supplier selection can move into contract preparation.</small>
                                </article>
                                <article class="about-progress-card">
                                    <span>Evaluation progress</span>
                                    <strong>78%</strong>
                                    <div><i style="width:78%"></i></div>
                                </article>
                                <article class="about-bid-list">
                                    <span>Supplier bids</span>
                                    <p><strong>Alpha Medics</strong><em>Technical complete</em></p>
                                    <p><strong>Dar Health Ltd</strong><em>Financial review</em></p>
                                    <p><strong>Kibo Supply</strong><em>Clarification sent</em></p>
                                </article>
                                <article class="about-contract-card">
                                    <span>Contract status</span>
                                    <strong>Negotiation</strong>
                                    <small>Payment terms and milestones under review</small>
                                </article>
                                <article class="about-records-card">
                                    <span>Digital records</span>
                                    <strong>Complete audit trail</strong>
                                    <small>Creation, bid, evaluation, award, negotiation, and delivery history.</small>
                                </article>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="about-stat-band" aria-label="ProcureX platform highlights">
                    <div class="about-container about-stat-grid">
                        ${stats.map(([label, value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}
                    </div>
                </section>

                <section class="about-glance-band" aria-label="About ProcureX at a glance">
                    <div class="about-container">
                        <div class="about-section-heading compact">
                            <span class="about-section-label">About at a Glance</span>
                            <h2>A practical procurement platform for modern teams.</h2>
                        </div>
                        <div class="about-glance-grid">
                            ${glanceCards.map(card => renderAboutCard(card, 'about-glance-card')).join('')}
                        </div>
                    </div>
                </section>

                <section class="about-toc-band" aria-label="About page sections">
                    <div class="about-container about-toc">
                        <strong>Explore About ProcureX</strong>
                        <nav>
                            ${sectionLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
                        </nav>
                    </div>
                </section>

                <section id="about-who-we-are" class="about-section">
                    <div class="about-container about-two-col">
                        <div>
                            <span class="about-section-label">Who We Are</span>
                            <h2>Procurement technology built for clarity, speed, and accountability.</h2>
                            <p>ProcureX is a procurement technology platform built to support organizations, businesses, and suppliers in managing procurement activities with clarity, speed, and accountability.</p>
                            <p>The platform is designed for buyers who need to create and manage tenders, and for suppliers who want to discover opportunities, submit bids, and manage awarded contracts. ProcureX brings both sides into a single digital environment where procurement activities are easier to track, easier to understand, and easier to manage.</p>
                            <p>Unlike traditional procurement processes that depend heavily on paperwork, scattered communication, and manual evaluation, ProcureX provides a structured digital flow that guides users from procurement planning to contract completion.</p>
                        </div>
                        <div class="about-role-stack">
                            ${workflowCards.map(([title, text], index) => `
                                <article>
                                    <span>${String(index + 1).padStart(2, '0')}</span>
                                    <div>
                                        <strong>${title}</strong>
                                        <p>${text}</p>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-purpose" class="about-section about-soft-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Our Purpose</span>
                            <h2>Our purpose is to make procurement more accessible, transparent, organized, and efficient for every user.</h2>
                            <p>Procurement is an important part of business growth, project delivery, and public or private sector operations. ProcureX was created to give users a clear digital process that reduces unnecessary complexity.</p>
                            <p>Through ProcureX, buyers can prepare better tender documents, suppliers can submit stronger bids, and both parties can manage procurement decisions with better visibility.</p>
                        </div>
                        <div class="about-card-grid four">
                            ${purposeCards.map(card => renderAboutCard(card)).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-capabilities" class="about-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">What ProcureX Does</span>
                            <h2>A complete procurement workflow from opportunity creation to contract execution.</h2>
                            <p>ProcureX supports the major stages of procurement in one connected platform. It is designed to handle goods, works, services, and consultancy.</p>
                        </div>
                        <div class="about-feature-grid">
                            ${features.map(([title, text], index) => `
                                <article class="about-feature-card">
                                    <span>${String(index + 1).padStart(2, '0')}</span>
                                    <h3>${title}</h3>
                                    <p>${text}</p>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section class="about-section about-dark-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Who ProcureX Serves</span>
                            <h2>Built for organizations, suppliers, and procurement teams of different sizes.</h2>
                        </div>
                        <div class="about-audience-grid two">
                            ${audiences.map(audience => `
                                <article class="about-audience-card">
                                    <h3>${audience.title}</h3>
                                    <p>${audience.text}</p>
                                    ${renderAboutList(audience.benefits)}
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-categories" class="about-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Procurement Categories</span>
                            <h2>Flexible workflows for different types of procurement.</h2>
                        </div>
                        <div class="about-category-grid">
                            ${categories.map(category => `
                                <article class="about-category-card">
                                    <h3>${category.title}</h3>
                                    <p>${category.text}</p>
                                    <div class="about-category-columns">
                                        <div>
                                            <strong>Examples</strong>
                                            ${renderAboutList(category.examples)}
                                        </div>
                                        <div>
                                            <strong>Typical Bid Requirements</strong>
                                            ${renderAboutList(category.requirements)}
                                        </div>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section class="about-section about-soft-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Why ProcureX Is Different</span>
                            <h2>ProcureX is not just a tender listing platform. It is a complete procurement operating system.</h2>
                        </div>
                        <div class="about-difference-grid">
                            ${differences.map(([title, text], index) => `
                                <article>
                                    <span>${index + 1}</span>
                                    <h3>${title}</h3>
                                    <p>${text}</p>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-mission" class="about-section">
                    <div class="about-container about-mission-grid">
                        <article>
                            <span class="about-section-label">Our Mission</span>
                            <h2>To transform procurement into a more transparent, efficient, and accessible digital process for buyers, suppliers, and organizations of all sizes.</h2>
                            <p>Our mission is to remove unnecessary barriers from procurement. We want buyers to create better tenders, suppliers to participate more confidently, and organizations to manage procurement activities with better control.</p>
                            <p>ProcureX is designed to support fairness, accountability, and professionalism throughout the procurement journey.</p>
                        </article>
                        <article>
                            <span class="about-section-label">Our Vision</span>
                            <h2>To become a leading digital procurement platform that connects opportunities, suppliers, and organizations through trusted technology.</h2>
                            <p>We envision a procurement environment where opportunities are easier to access, processes are easier to follow, and decisions are easier to justify.</p>
                            <p>Our long-term vision is to support local, regional, and international procurement activities while helping businesses grow through fair opportunity access.</p>
                        </article>
                    </div>
                </section>

                <section class="about-section about-values-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Our Core Values</span>
                            <h2>The principles behind the ProcureX platform.</h2>
                        </div>
                        <div class="about-values-grid">
                            ${values.map(([title, text]) => `
                                <article>
                                    <span class="about-value-icon">${renderAboutIcon('<path d="M20 6 9 17l-5-5"/>')}</span>
                                    <h3>${title}</h3>
                                    <p>${text}</p>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-how-it-works" class="about-section about-soft-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">How ProcureX Works</span>
                            <h2>A clear procurement journey from start to finish.</h2>
                        </div>
                        <div class="about-timeline">
                            ${steps.map((step, index) => `
                                <article>
                                    <span>${index + 1}</span>
                                    <div>
                                        <h3>${step}</h3>
                                        <p>${stepText[index]}</p>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section class="about-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Benefits of Using ProcureX</span>
                            <h2>Better workflows for buyers, suppliers, and organizations.</h2>
                        </div>
                        <div class="about-benefit-grid">
                            ${benefitGroups.map(([title, benefits]) => `
                                <article>
                                    <h3>${title}</h3>
                                    ${renderAboutList(benefits)}
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-trust" class="about-section about-trust-section">
                    <div class="about-container about-trust-grid">
                        <div>
                            <span class="about-section-label">Designed for Trust and Transparency</span>
                            <h2>Every major step should have a clear record.</h2>
                            <p>ProcureX is built around the idea that procurement should be traceable and professional. Every major step in the procurement process should have a clear record, from tender creation to bid submission, evaluation, award, contracting, and completion.</p>
                            <p>This helps reduce confusion, improves accountability, and gives both buyers and suppliers a better understanding of where they stand in the process.</p>
                        </div>
                        <div class="about-trust-list">
                            ${trustFeatures.map(feature => `<span>${feature}</span>`).join('')}
                        </div>
                    </div>
                </section>

                <section class="about-section">
                    <div class="about-container about-two-col about-transform-section">
                        <div>
                            <span class="about-section-label">Digital Transformation</span>
                            <h2>Supporting Digital Transformation in Procurement</h2>
                            <p>Procurement is changing. Organizations are moving away from manual, paper-based processes toward digital systems that are faster, more reliable, and easier to manage.</p>
                            <p>ProcureX supports this transformation by connecting procurement planning, tender publishing, supplier participation, bid evaluation, contract formation, and post-award monitoring.</p>
                        </div>
                        <div class="about-transform-panel">
                            <strong>From fragmented manual work</strong>
                            <span>to a connected procurement ecosystem</span>
                            <p>The platform helps organizations become more organized while giving suppliers a better way to participate in business opportunities.</p>
                        </div>
                    </div>
                </section>

                <section class="about-section about-soft-section">
                    <div class="about-container">
                        <div class="about-section-heading">
                            <span class="about-section-label">Our Commitment</span>
                            <h2>Practical, professional, and useful for real procurement activities.</h2>
                            <p>We are committed to building a procurement platform that is practical, professional, and useful for real procurement activities. ProcureX is designed with the needs of buyers, suppliers, and organizations in mind.</p>
                            <p>Our commitment is to continue improving the platform so that procurement becomes easier, faster, more transparent, and more inclusive.</p>
                        </div>
                        <div class="about-card-grid four">
                            ${commitments.map(([title, text]) => renderAboutCard({ title, text, icon: '<path d="M12 3l8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7z"/><path d="m9 12 2 2 4-4"/>' })).join('')}
                        </div>
                    </div>
                </section>

                <section id="about-final-cta" class="about-final-cta">
                    <div class="about-container about-final-panel">
                        <div>
                            <span class="about-section-label">Ready to Transform the Way You Procure?</span>
                            <h2>Join ProcureX and experience a smarter way to manage procurement from beginning to end.</h2>
                            <p>Create tenders, submit bids, evaluate suppliers, award contracts, and manage procurement in one connected workspace.</p>
                        </div>
                        <div class="about-actions">
                            <button class="btn btn-primary" type="button" data-navigate="register">Create Your Account</button>
                            <button class="btn btn-secondary" type="button" data-navigate="guest-marketplace">View Tender Opportunities</button>
                        </div>
                    </div>
                </section>
            </main>

            <footer id="about-help-center" class="about-footer">
                <div class="about-container about-footer-grid">
                    <div>
                        <strong>ProcureX</strong>
                        <p>ProcureX - Connecting buyers and suppliers through smarter digital procurement.</p>
                    </div>
                    <nav aria-label="About footer company links">
                        <span>Company</span>
                        <a href="#" data-navigate="about-procurex">About</a>
                        <a href="#" data-navigate="privacy-policy">Privacy Policy</a>
                        <a href="#" data-navigate="terms-and-conditions">Terms and Conditions</a>
                    </nav>
                    <nav aria-label="About footer platform links">
                        <span>Platform</span>
                        <a href="#" data-navigate="guest-marketplace">Open Tenders</a>
                        <a href="#" data-navigate="register">Create Account</a>
                        <a href="#" data-navigate="sign-in">Sign In</a>
                        <a href="#" data-navigate="contact">Contact Support</a>
                    </nav>
                </div>
            </footer>
        </div>
    `;
}

if (window.app) {
    window.app.renderAboutProcurex = renderAboutProcurex;
}
