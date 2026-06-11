// Terms and Conditions Page Component

function renderTermsIcon(paths, className = 'terms-icon') {
    return `
        <svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${paths}
        </svg>
    `;
}

function renderTermsList(items = []) {
    return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function renderTermsSectionBody(section = {}) {
    return `
        ${section.paragraphs?.map(text => `<p>${text}</p>`).join('') || ''}
        ${section.items?.length ? renderTermsList(section.items) : ''}
        ${section.groups?.map(group => `
            <div class="terms-clause-group">
                <h4>${group.title}</h4>
                ${group.text ? `<p>${group.text}</p>` : ''}
                ${group.items?.length ? renderTermsList(group.items) : ''}
            </div>
        `).join('') || ''}
    `;
}

function renderTermsAndConditions() {
    const summaryCards = [
        ['Accurate information', 'Users must provide truthful account, tender, bid, and contract information.', '<path d="M9 11l2 2 4-4"/><path d="M5 5h14v14H5z"/>'],
        ['No fraud or corruption', 'Bribery, collusion, bid rigging, fake documents, and misleading conduct are prohibited.', '<path d="M12 3l8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7z"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/>'],
        ['Protect confidential data', 'Tender, bid, financial, technical, and contract information must be handled responsibly.', '<path d="M8 11V7a4 4 0 0 1 8 0v4"/><rect x="5" y="11" width="14" height="10" rx="2"/>'],
        ['Submit before deadline', 'Users remain responsible for timing, uploads, file accuracy, and final review before submission.', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
        ['Respect platform rules', 'Use ProcureX lawfully, professionally, and according to applicable procurement requirements.', '<path d="M6 3h12v18H6z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>']
    ];

    const workflow = ['Create Tender', 'Publish', 'Submit Bid', 'Evaluate', 'Award', 'Negotiate Contract', 'Accept Contract', 'Manage Post-Award'];

    const buyerResponsibilities = ['Provide accurate tender information', 'Clearly define tender requirements', 'Set realistic submission deadlines', 'Upload correct procurement documents', 'Define fair evaluation criteria', 'Communicate clarifications professionally', 'Review bids responsibly', 'Make award decisions lawfully and fairly', 'Avoid discriminatory, fraudulent, or corrupt practices', 'Manage contracts in good faith'];
    const supplierResponsibilities = ['Submit accurate business information', 'Read tender requirements carefully', 'Submit bids before the deadline', 'Provide truthful technical and financial proposals', 'Upload valid supporting documents', 'Avoid false claims or misleading pricing', 'Honour bid validity periods where applicable', 'Negotiate honestly', 'Perform awarded contracts according to agreed terms', 'Avoid bribery, collusion, bid rigging, or unethical conduct'];

    const prohibitedCards = [
        ['Fraud', 'Submitting false information, fake accounts, misleading identity, or false qualifications.'],
        ['Bribery', 'Offering, requesting, or accepting improper payments, favours, or benefits.'],
        ['Collusion', 'Coordinating bids, sharing confidential evaluation information, or manipulating tender outcomes.'],
        ['Fake documents', 'Uploading fake certificates, false licenses, or inaccurate supporting files.'],
        ['Unauthorized access', 'Hacking, bypassing controls, reverse engineering, or misusing APIs.'],
        ['Harassment', 'Threatening, abusing, spamming, or posting offensive content toward other users.'],
        ['Malware', 'Uploading harmful files, malicious links, or content that disrupts platform operations.']
    ];

    const termsSections = [
        {
            id: 'terms-introduction',
            title: 'Introduction',
            paragraphs: [
                'Welcome to ProcureX. These Terms and Conditions govern your access to and use of the ProcureX platform, including the website, web application, mobile-responsive interfaces, procurement tools, tender marketplace, bid submission features, contract management tools, notifications, support services, and any related features provided by ProcureX.',
                'ProcureX provides a digital environment where buyers and suppliers can participate in procurement activities. The platform is designed to support structured tender creation, supplier participation, bid submission, evaluation, awarding, contract negotiation, and post-award management.',
                'These Terms apply to all users of ProcureX, including buyers, suppliers, companies, organizations, authorized internal personnel, individual users, invited users, evaluators, and any person who accesses the platform.',
                'By creating an account, browsing tenders, submitting bids, publishing procurement opportunities, accepting awards, negotiating contracts, or using any ProcureX service, you agree to be bound by these Terms and Conditions.'
            ]
        },
        {
            id: 'terms-definitions',
            title: 'Definitions',
            groups: [
                { title: 'ProcureX', text: 'The digital procurement platform, including its website, application, tools, services, systems, and related features.' },
                { title: 'Platform', text: 'The ProcureX website, dashboard, tender marketplace, procurement workspace, bid submission system, contract management system, and connected digital services.' },
                { title: 'User', text: 'Any person, company, organization, buyer, supplier, authorized representative, authorized internal user, or visitor who accesses or uses ProcureX.' },
                { title: 'Buyer', text: 'A user, company, institution, or organization that creates tenders, publishes procurement opportunities, receives bids, evaluates submissions, awards tenders, and manages contracts.' },
                { title: 'Supplier', text: 'A user, company, individual, service provider, contractor, consultant, vendor, or organization that views tenders, submits bids, accepts awards, negotiates contracts, and performs procurement obligations.' },
                { title: 'Tender', text: 'A procurement opportunity created by a buyer for goods, works, services, consultancy, or any other procurement category supported by ProcureX.' },
                { title: 'Bid', text: 'A supplier response to a tender, including technical proposals, financial proposals, compliance documents, uploaded files, pricing, methodology, and supporting information.' },
                { title: 'Award', text: 'A buyer decision to select a supplier for a tender, subject to contract formation, negotiation, acceptance, or other requirements.' },
                { title: 'Contract', text: 'The agreement formed between a buyer and a supplier after a tender is awarded and accepted, including negotiated terms, deliverables, milestones, prices, and obligations.' },
                { title: 'Content', text: 'Any information, text, documents, files, images, messages, bids, tenders, contracts, data, comments, uploads, or records submitted, created, posted, or stored on ProcureX.' },
                { title: 'Account', text: 'The user profile or organization profile created to access ProcureX services.' }
            ]
        },
        {
            id: 'terms-acceptance',
            title: 'Acceptance of These Terms',
            paragraphs: [
                'By using ProcureX, you confirm that you have read, understood, and agreed to these Terms and Conditions.',
                'If you are using ProcureX on behalf of a company, organization, institution, partnership, or other legal entity, you confirm that you have authority to accept these Terms on behalf of that entity.',
                'If you do not agree to these Terms, you must stop using ProcureX immediately.'
            ],
            items: ['Create a ProcureX account', 'Log into the platform', 'Publish a tender', 'Submit a bid', 'Upload procurement documents', 'Participate in contract negotiation', 'Accept an award', 'Use messaging or clarification tools', 'Access tender or supplier information', 'Use any feature of the platform']
        },
        {
            id: 'terms-eligibility',
            title: 'Eligibility',
            paragraphs: [
                'To use ProcureX, you must be legally capable of creating an account, entering into platform terms, submitting business information, and participating in procurement activities.',
                'Users must provide accurate information during registration and platform use. ProcureX may require users to verify identity, business information, contact details, licenses, tax details, or other relevant documents before accessing certain features.'
            ],
            items: ['ProcureX may restrict, suspend, or terminate access if a user provides false or misleading information.', 'Uses another person identity without permission.', 'Creates an account without authority.', 'Violates these Terms.', 'Engages in fraud, corruption, collusion, abuse, or unlawful activity.', 'Misuses procurement documents or platform features.', 'Attempts to bypass platform security controls.']
        },
        {
            id: 'terms-accounts',
            title: 'User Accounts',
            paragraphs: [
                'Users may need to create an account to access procurement features on ProcureX.',
                'ProcureX may support accounts for buyers, suppliers, companies, organizations, individual users, and authorized internal admin users.',
                'Where a company or organization uses one account, the person managing that account is responsible for ensuring that only authorized representatives use the account. ProcureX is not responsible for losses caused by unauthorized use where the user failed to protect login credentials.'
            ],
            items: ['Provide accurate and complete information', 'Keep account details updated', 'Use a secure password', 'Keep login credentials confidential', 'Notify ProcureX of unauthorized account access', 'Accept responsibility for all activities performed under their account']
        },
        {
            id: 'terms-roles',
            title: 'Buyer and Supplier Role Flexibility',
            paragraphs: [
                'ProcureX may allow users or organizations to act as both buyers and suppliers depending on their procurement activities.',
                'Users must ensure they do not misuse this flexibility to create conflicts of interest, manipulate procurement outcomes, submit misleading bids, or gain unfair access to confidential information.',
                'ProcureX may monitor role-based activity to protect fairness, transparency, and platform integrity.'
            ],
            items: ['Create tenders as a buyer', 'Submit bids as a supplier', 'Receive bids from other suppliers', 'Participate in other buyers tenders', 'Manage awarded contracts from either side']
        },
        {
            id: 'terms-buyer-responsibilities',
            title: 'Buyer Responsibilities',
            paragraphs: [
                'Buyers are responsible for the tenders they create and publish on ProcureX.',
                'Buyers are responsible for ensuring that their tender requirements, evaluation criteria, award decisions, contract terms, and procurement processes comply with applicable laws, internal policies, and organizational rules.',
                'ProcureX does not guarantee that a buyer tender is legally compliant, commercially reasonable, or suitable for a specific procurement purpose.'
            ],
            items: buyerResponsibilities
        },
        {
            id: 'terms-supplier-responsibilities',
            title: 'Supplier Responsibilities',
            paragraphs: [
                'Suppliers are responsible for the bids, documents, and information they submit through ProcureX.',
                'Suppliers are responsible for verifying that they meet tender requirements before submitting a bid.',
                'Submitting a bid does not guarantee that the supplier will be shortlisted, evaluated positively, awarded, contracted, or paid.'
            ],
            items: supplierResponsibilities
        },
        {
            id: 'terms-tender-creation',
            title: 'Tender Creation and Publication',
            paragraphs: [
                'ProcureX allows buyers to create and publish tenders for different procurement categories, including goods, works, services, and consultancy.',
                'Buyers are responsible for reviewing tender details before publication.',
                'ProcureX does not guarantee that published tenders will receive bids or that submitted bids will meet buyer expectations.'
            ],
            groups: [
                { title: 'A tender may include', items: ['Tender title', 'Procurement category', 'Scope of work or supply', 'Requirements', 'Eligibility criteria', 'Evaluation criteria', 'Submission deadline', 'Delivery requirements', 'Contract terms', 'Payment terms', 'Supporting documents', 'Clarification instructions', 'Bid submission requirements'] },
                { title: 'ProcureX may reject or suspend tenders that', items: ['Contain unlawful content', 'Promote prohibited goods or services', 'Include misleading information', 'Violate platform rules', 'Contain abusive, discriminatory, or harmful language', 'Appear fraudulent or suspicious', 'Create security, legal, or reputational risk'] }
            ]
        },
        {
            id: 'terms-marketplace',
            title: 'Tender Marketplace',
            paragraphs: [
                'The ProcureX tender marketplace allows suppliers to view procurement opportunities published by buyers.',
                'Tender visibility may depend on tender status, buyer settings, supplier eligibility, procurement category, access restrictions, subscription or platform plan, geographic filters, or business category filters.',
                'ProcureX may organize, display, recommend, or rank tenders based on platform logic, user preferences, categories, relevance, or other factors.',
                'Users must not scrape, copy, misuse, resell, or redistribute tender marketplace data without permission.'
            ]
        },
        {
            id: 'terms-bid-submission',
            title: 'Bid Submission',
            paragraphs: [
                'Suppliers may submit bids in response to tenders through ProcureX.',
                'Suppliers are responsible for ensuring that their bids are complete, accurate, and submitted before the deadline. ProcureX may not allow changes after submission or after the deadline unless the platform, buyer, or applicable rules permit it.',
                'ProcureX is not responsible for missed deadlines caused by internet failure, device issues, user mistakes, incomplete uploads, late submission, wrong file format, incorrect information, or failure to review submission before sending. Suppliers should submit bids early enough to avoid technical or timing problems.'
            ],
            items: ['Technical proposal', 'Financial proposal', 'Pricing schedule', 'Delivery plan', 'Methodology', 'Work program', 'Team details', 'Experience and qualifications', 'Compliance documents', 'Licenses and certificates', 'Uploaded supporting files', 'Clarification responses', 'Contract acceptance notes']
        },
        {
            id: 'terms-bid-validity',
            title: 'Bid Validity',
            paragraphs: [
                'A supplier bid may remain valid for the period stated in the tender.',
                'If a supplier needs to withdraw or correct a bid, the supplier must follow the process allowed by the buyer, tender rules, and platform settings.',
                'ProcureX is not responsible for losses arising from a supplier submitting incorrect pricing, wrong documents, or unrealistic commitments.'
            ],
            items: ['Quoted prices', 'Delivery timelines', 'Proposed methodology', 'Technical commitments', 'Warranty terms', 'Staffing commitments', 'Service levels', 'Contract assumptions']
        },
        {
            id: 'terms-clarifications',
            title: 'Clarifications and Communication',
            paragraphs: [
                'ProcureX may allow suppliers to ask clarification questions and buyers to respond through the platform.',
                'Users agree to communicate professionally and respectfully. ProcureX may monitor, restrict, or remove communications that violate these Terms or platform rules.'
            ],
            items: ['Do not harass other users', 'Do not share offensive content', 'Do not request bribes or favours', 'Do not exchange prohibited information', 'Do not manipulate tender outcomes', 'Do not bypass platform procedures', 'Do not share malware, spam, or harmful links', 'Do not conduct unrelated business outside the tender process']
        },
        {
            id: 'terms-evaluation',
            title: 'Evaluation of Bids',
            paragraphs: [
                'ProcureX may provide tools to help buyers evaluate submitted bids. Buyers may define their own evaluation criteria during tender creation.',
                'Buyers are responsible for applying evaluation criteria fairly and consistently.',
                'ProcureX may provide structure, scoring fields, comparison tools, status tracking, and document access, but ProcureX does not make procurement decisions on behalf of buyers unless explicitly stated.',
                'ProcureX is not responsible for buyer evaluation decisions, scoring outcomes, award choices, or rejection of bids.'
            ],
            items: ['Technical compliance', 'Financial proposal', 'Supplier experience', 'Delivery schedule', 'Methodology', 'Quality assurance', 'Risk management', 'Legal compliance', 'Required documents', 'Past performance', 'Price competitiveness']
        },
        {
            id: 'terms-awarding',
            title: 'Awarding',
            paragraphs: [
                'After evaluation, a buyer may decide to award a tender to one or more suppliers, depending on the tender structure.',
                'An award does not always mean that a final contract is already formed. A final contract may depend on supplier acceptance, negotiation, document completion, approvals, due diligence, legal review, payment terms agreement, signature, or final confirmation.',
                'ProcureX is not responsible if a buyer cancels, withdraws, delays, or changes an award where allowed by applicable rules or tender conditions.'
            ],
            items: ['Tender reference', 'Awarded supplier', 'Award status', 'Award date', 'Award amount', 'Next steps', 'Contract preparation instructions', 'Acceptance deadline', 'Buyer comments', 'Conditions of award']
        },
        {
            id: 'terms-contracting',
            title: 'Contracting',
            paragraphs: [
                'After a tender is awarded, ProcureX may support contract preparation and management between the buyer and awarded supplier.',
                'The buyer and supplier are responsible for reviewing, understanding, and accepting contract terms.',
                'ProcureX may provide templates, clause libraries, workflow tools, negotiation records, and digital acceptance features, but ProcureX is not a party to the contract between buyer and supplier unless expressly stated.'
            ],
            items: ['Scope of supply or services', 'Contract value', 'Payment terms', 'Delivery timelines', 'Milestones', 'Service levels', 'Quality standards', 'Penalties', 'Warranties', 'Termination clauses', 'Confidentiality obligations', 'Dispute resolution provisions', 'Applicable law', 'Signatures or approvals']
        },
        {
            id: 'terms-negotiation',
            title: 'Contract Negotiation',
            paragraphs: [
                'ProcureX may allow buyers and awarded suppliers to negotiate contract terms before final acceptance.',
                'Users agree to negotiate in good faith and avoid misleading statements or unfair pressure.',
                'ProcureX may store negotiation history, revised clauses, comments, timestamps, and acceptance records for accountability.',
                'A contract should only be accepted when both parties are satisfied with the final terms.'
            ],
            items: ['Scope adjustments', 'Delivery timelines', 'Payment terms', 'Contract clauses', 'Milestones', 'Performance obligations', 'Warranty terms', 'Risk allocation', 'Termination conditions', 'Reporting requirements']
        },
        {
            id: 'terms-post-award',
            title: 'Post-Award Management',
            paragraphs: [
                'ProcureX may support post-award procurement activities after contract acceptance.',
                'Buyers and suppliers are responsible for performing their obligations under the contract.',
                'ProcureX does not guarantee supplier performance, buyer payment, project completion, product quality, service quality, or contract success.'
            ],
            items: ['Milestone tracking', 'Delivery confirmation', 'Service reporting', 'Work progress updates', 'Uploading completion evidence', 'Performance monitoring', 'Issue reporting', 'Payment milestone tracking', 'Contract amendments', 'Contract closure']
        },
        {
            id: 'terms-payments',
            title: 'Platform Fees and Payments',
            paragraphs: [
                'ProcureX may charge fees for certain services, subscriptions, premium features, transaction support, tender publishing, supplier access, contract tools, or other platform services.',
                'ProcureX will display applicable fees before charging users where required. Users are responsible for paying all applicable fees, taxes, charges, and payment processing costs associated with paid services.',
                'ProcureX may suspend or restrict paid features if payment fails, is reversed, is disputed, or remains unpaid. Unless stated otherwise, platform fees are non-refundable once services have been provided.'
            ],
            items: ['User type', 'Account plan', 'Tender volume', 'Marketplace access', 'Subscription level', 'Contract management features', 'Premium visibility', 'Verification services', 'Platform support services']
        },
        {
            id: 'terms-transactions',
            title: 'Transactions Between Buyers and Suppliers',
            paragraphs: [
                'ProcureX provides technology tools to support procurement interactions, but the actual commercial relationship is between the buyer and supplier.',
                'Unless expressly stated, ProcureX is not the buyer, supplier, contractor, consultant, employer, agent of either party, guarantor of performance, guarantor of payment, or legal representative of either party.',
                'Buyers and suppliers are responsible for reviewing each other information, conducting due diligence, negotiating contract terms, confirming pricing, managing performance, handling payments, resolving disputes, and complying with applicable laws.',
                'ProcureX is not liable for losses arising from a buyer or supplier failure to perform contractual obligations.'
            ]
        },
        {
            id: 'terms-prohibited',
            title: 'Prohibited Activities',
            paragraphs: ['Users must not misuse ProcureX. ProcureX may suspend, restrict, investigate, or terminate accounts involved in prohibited activities.'],
            groups: [
                { title: 'Fraud and Misrepresentation', items: ['Submitting false information', 'Uploading fake documents', 'Misrepresenting business identity', 'Creating fake accounts', 'Pretending to represent another organization', 'Providing false qualifications or certificates'] },
                { title: 'Corruption and Unethical Conduct', items: ['Offering bribes', 'Requesting bribes', 'Colluding with other bidders', 'Manipulating tender outcomes', 'Engaging in bid rigging', 'Sharing confidential evaluation information', 'Using insider information unfairly'] },
                { title: 'Platform Abuse', items: ['Hacking or attempting unauthorized access', 'Uploading malware', 'Scraping platform data', 'Disrupting platform operations', 'Bypassing security controls', 'Reverse engineering platform systems', 'Creating automated fake activity', 'Misusing APIs or integrations'] },
                { title: 'Harmful Conduct', items: ['Harassing users', 'Sending spam', 'Posting offensive content', 'Sharing illegal material', 'Violating intellectual property rights', 'Using the platform for unlawful transactions'] }
            ]
        },
        {
            id: 'terms-content',
            title: 'User Content',
            paragraphs: [
                'Users may upload, submit, create, or share content through ProcureX, including tenders, bids, contracts, documents, messages, images, certificates, drawings, and other files.',
                'Users remain responsible for their content. ProcureX may remove or restrict content that violates these Terms, platform policies, or applicable law.',
                'Users grant ProcureX permission to store, process, display, transmit, and use uploaded content as necessary to operate the platform and provide procurement services.'
            ],
            items: ['Users confirm they have the right to upload the content', 'The content is accurate to the best of their knowledge', 'The content does not violate any law', 'The content does not infringe another party rights', 'The content does not contain harmful software', 'The content is relevant to the procurement activity']
        },
        {
            id: 'terms-confidentiality',
            title: 'Confidentiality',
            paragraphs: [
                'Procurement activities may involve confidential business, technical, financial, legal, and commercial information. Users agree to handle confidential information responsibly.',
                'Users must not disclose confidential information obtained through ProcureX unless authorized, required for the procurement process, required by law, already publicly available, or permitted by the relevant party.',
                'ProcureX may use access controls to restrict confidential information to authorized users.'
            ],
            items: ['Tender documents', 'Bid submissions', 'Financial proposals', 'Technical proposals', 'Evaluation records', 'Contract terms', 'Pricing schedules', 'Negotiation comments', 'Drawings and specifications', 'Supplier documents', 'Buyer internal information']
        },
        {
            id: 'terms-ip',
            title: 'Intellectual Property Rights',
            paragraphs: [
                'ProcureX owns or licenses all rights in the platform, including software, interface design, logos, branding, workflows, features, databases, system architecture, platform content created by ProcureX, documentation, and design components.',
                'Users must not copy, modify, sell, distribute, reverse engineer, or exploit ProcureX intellectual property without permission.',
                'Users retain ownership of their own uploaded content, such as business documents, tender documents, bid files, and contract attachments, subject to the rights granted to ProcureX for platform operation.'
            ]
        },
        {
            id: 'terms-privacy',
            title: 'Privacy and Data Protection',
            paragraphs: [
                'ProcureX collects and processes user information according to its Privacy Policy. By using ProcureX, users agree that ProcureX may collect, process, store, and use information as described in the Privacy Policy.',
                'This may include account information, business information, tender information, bid information, contract information, communication records, platform activity logs, and technical information.',
                'Users must also respect the privacy and data protection rights of other users. Users must not collect, misuse, publish, sell, or disclose personal data obtained through ProcureX unless permitted by law and platform rules.'
            ]
        },
        {
            id: 'terms-availability',
            title: 'Platform Availability',
            paragraphs: [
                'ProcureX aims to provide a reliable digital procurement platform. However, we do not guarantee that the platform will always be available, uninterrupted, error-free, or free from technical issues.',
                'Platform access may be affected by maintenance, updates, internet issues, hosting problems, cybersecurity incidents, third-party service failures, device or browser problems, force majeure events, or system overload.',
                'ProcureX may suspend or limit access temporarily to maintain, improve, protect, or update the platform. Users are responsible for submitting tenders, bids, documents, and responses early enough to avoid deadline risks caused by technical issues.'
            ]
        },
        {
            id: 'terms-security',
            title: 'Security',
            paragraphs: [
                'ProcureX may use security measures to protect the platform and user information. ProcureX may investigate suspicious activity and take action to protect the platform.',
                'Users are responsible for keeping passwords confidential, using secure devices, logging out after use, reporting suspicious activity, avoiding shared or public devices for sensitive actions, and not uploading malware or harmful files.'
            ],
            items: ['Password protection', 'Authentication controls', 'Role-based permissions', 'Secure document storage', 'Activity logs', 'System monitoring', 'Encryption where appropriate', 'Backup procedures', 'Authorized internal access controls']
        },
        {
            id: 'terms-termination',
            title: 'Suspension and Termination of Accounts',
            paragraphs: [
                'ProcureX may suspend, restrict, or terminate a user account if the user violates these Terms, provides false information, misuses the platform, engages in fraud or corruption, uploads harmful content, fails to pay applicable fees, creates legal or security risk, harasses or harms other users, violates procurement rules, attempts unauthorized access, or causes reputational harm to ProcureX.',
                'Users may also request account deactivation or deletion, subject to legal, contractual, procurement, audit, and record-keeping requirements.',
                'Termination of an account does not automatically delete procurement records that must be retained for legal, contractual, dispute, or operational purposes.'
            ]
        },
        {
            id: 'terms-disclaimers',
            title: 'Disclaimers',
            paragraphs: [
                'ProcureX provides a digital platform for procurement management. The platform is provided on an as is and as available basis.',
                'Users should conduct their own due diligence before entering into procurement transactions, awarding tenders, accepting contracts, or making payments.'
            ],
            items: ['ProcureX does not guarantee that every tender will receive bids', 'Every supplier is qualified', 'Every buyer is reliable', 'Bids will be accurate', 'Contracts will be performed successfully', 'Payments will be made on time', 'Users will comply with laws', 'Procurement decisions will be correct', 'Documents uploaded by users are genuine', 'The platform will be uninterrupted or error-free']
        },
        {
            id: 'terms-liability',
            title: 'Limitation of Liability',
            paragraphs: [
                'To the maximum extent permitted by law, ProcureX is not liable for indirect, incidental, special, consequential, punitive, or economic losses arising from use of the platform.',
                'ProcureX total liability, where liability cannot be excluded, may be limited to the amount paid by the user to ProcureX for the relevant service during a defined period, unless applicable law requires otherwise.'
            ],
            items: ['Lost profits', 'Lost business opportunities', 'Failed tenders', 'Rejected bids', 'Contract disputes', 'Payment disputes', 'Supplier non-performance', 'Buyer non-payment', 'Data loss', 'Technical failure', 'Account misuse', 'Unauthorized access', 'User misconduct', 'Incorrect information submitted by users']
        },
        {
            id: 'terms-indemnity',
            title: 'Indemnity',
            paragraphs: ['Users agree to protect and hold ProcureX harmless from claims, losses, damages, liabilities, costs, and expenses arising from user actions or failures.'],
            items: ['User violation of these Terms', 'False or misleading information', 'Uploaded content', 'Procurement disputes', 'Contract disputes', 'Breach of confidentiality', 'Violation of law', 'Infringement of third-party rights', 'Fraud, corruption, or misconduct', 'Unauthorized use of an account', 'Misuse of platform features']
        },
        {
            id: 'terms-disputes',
            title: 'Disputes Between Buyers and Suppliers',
            paragraphs: [
                'ProcureX may provide tools to support communication, issue tracking, negotiation, document history, and dispute records. However, disputes between buyers and suppliers are primarily the responsibility of the parties involved.',
                'Users should first attempt to resolve disputes through professional communication and contract terms.',
                'ProcureX may assist by providing platform records, where appropriate and permitted, but ProcureX is not required to act as a court, arbitrator, mediator, or legal representative unless expressly agreed.'
            ],
            items: ['Bid rejection disputes', 'Award disputes', 'Contract interpretation disputes', 'Delivery disputes', 'Payment disputes', 'Quality disputes', 'Delay claims', 'Termination disputes', 'Confidentiality disputes']
        },
        {
            id: 'terms-law',
            title: 'Governing Law',
            paragraphs: [
                'These Terms and Conditions should be governed by the laws of the jurisdiction where ProcureX is legally registered or operates.',
                'For a Tanzania-based ProcureX platform, the governing law may be the laws of the United Republic of Tanzania, unless otherwise stated in a specific agreement.',
                'Any disputes involving ProcureX may be handled by the courts or dispute resolution bodies specified in these Terms, the user agreement, or applicable law. This section should be reviewed by a lawyer before publication to ensure the correct jurisdiction, court, arbitration, or mediation process is selected.'
            ]
        },
        {
            id: 'terms-changes',
            title: 'Changes to Terms and Conditions',
            paragraphs: [
                'ProcureX may update these Terms and Conditions from time to time to reflect new platform features, legal or regulatory updates, security improvements, business model changes, payment changes, procurement process updates, user feedback, or operational requirements.',
                'When Terms are updated, ProcureX may notify users through platform notification, email, login notice, updated effective date, or public announcement on the website.',
                'Continued use of ProcureX after changes become effective means the user accepts the updated Terms.'
            ]
        },
        {
            id: 'terms-contact',
            title: 'Contact Us',
            paragraphs: [
                'If you have questions about these Terms and Conditions, you may contact ProcureX.',
                'Platform: ProcureX. Email: support@procurex.com. Legal Contact: legal@procurex.com. Location: Tanzania.'
            ]
        },
        {
            id: 'terms-acknowledgement',
            title: 'User Acknowledgement',
            paragraphs: ['By using ProcureX, you confirm the following. If you do not agree with these Terms, you should not use ProcureX.'],
            items: ['You have read these Terms and Conditions', 'You understand your responsibilities', 'You agree to use the platform lawfully', 'You will provide accurate information', 'You will respect other users', 'You will protect confidential information', 'You will comply with applicable procurement rules', 'You accept that ProcureX is a platform provider and not automatically a party to buyer-supplier contracts']
        }
    ];

    const toc = [
        ['Introduction', 'terms-introduction'],
        ['Definitions', 'terms-definitions'],
        ['Acceptance of Terms', 'terms-acceptance'],
        ['User Accounts', 'terms-accounts'],
        ['Buyer Responsibilities', 'terms-buyer-responsibilities'],
        ['Supplier Responsibilities', 'terms-supplier-responsibilities'],
        ['Tender Creation', 'terms-tender-creation'],
        ['Bid Submission', 'terms-bid-submission'],
        ['Evaluation', 'terms-evaluation'],
        ['Awarding', 'terms-awarding'],
        ['Contracting', 'terms-contracting'],
        ['Payments', 'terms-payments'],
        ['Prohibited Activities', 'terms-prohibited'],
        ['Confidentiality', 'terms-confidentiality'],
        ['Privacy', 'terms-privacy'],
        ['Disputes', 'terms-disputes'],
        ['Liability', 'terms-liability'],
        ['Contact', 'terms-contact-form']
    ];

    return `
        <div class="terms-page">
            <header class="terms-nav">
                <div class="terms-container terms-nav-inner">
                    <a class="brand terms-brand" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <nav class="terms-nav-links" aria-label="Terms page navigation">
                        <a href="#" data-navigate="guest-marketplace">Open Tenders</a>
                        <a href="#" data-navigate="about-procurex">About</a>
                        <a href="#" data-navigate="privacy-policy">Privacy</a>
                        <a class="active" href="#" data-navigate="terms-and-conditions">Terms</a>
                        <a href="#" data-navigate="contact">Contact</a>
                    </nav>
                    <div class="terms-nav-actions">
                        <a href="#" data-navigate="sign-in">Sign In</a>
                        <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                    </div>
                </div>
            </header>

            <main>
                <section class="terms-hero">
                    <div class="terms-container terms-hero-grid">
                        <div class="terms-hero-copy animate-fade-in">
                            <span class="terms-eyebrow">Terms and Conditions</span>
                            <h1>Terms and Conditions for Using ProcureX</h1>
                            <p class="terms-lead">These Terms and Conditions explain the rules, responsibilities, rights, and limitations that apply when users access or use the ProcureX procurement platform.</p>
                            <p>ProcureX is a digital procurement platform that allows buyers and suppliers to create accounts, publish tenders, submit bids, evaluate proposals, award tenders, negotiate contracts, manage procurement records, and complete post-award activities.</p>
                            <p>By accessing or using ProcureX, you agree to follow these Terms and Conditions. If you do not agree with these Terms, you should not use the platform.</p>
                            <div class="terms-actions">
                                <button class="btn btn-primary" type="button" data-navigate="register">Accept and Continue</button>
                                <button class="btn btn-secondary" type="button" data-navigate="contact">Contact Support</button>
                            </div>
                        </div>

                        <div class="terms-legal-visual animate-fade-in delay-1" aria-label="Terms acceptance illustration">
                            <article class="terms-document">
                                <span>Digital contract</span>
                                <h2>ProcureX Terms</h2>
                                <p>Platform use agreement</p>
                                <div><i></i><i></i><i></i></div>
                            </article>
                            <article class="terms-approval-card">
                                ${renderTermsIcon('<path d="M20 6 9 17l-5-5"/>')}
                                <strong>Approval badge</strong>
                                <span>Read and accept before account creation</span>
                            </article>
                            <article class="terms-visual-row">
                                <strong>Buyer</strong>
                                <span>creates tender</span>
                            </article>
                            <article class="terms-visual-row">
                                <strong>Supplier</strong>
                                <span>submits bid</span>
                            </article>
                            <article class="terms-folder-card">
                                ${renderTermsIcon('<path d="M3 7h7l2 2h9v10H3z"/><path d="M8 13h8"/>')}
                                <span>Secure document folder</span>
                            </article>
                            <label class="terms-accept-preview">
                                <input type="checkbox" checked aria-label="Accepted preview">
                                <span>Terms acceptance required</span>
                            </label>
                        </div>
                    </div>
                </section>

                <section class="terms-notice-band">
                    <div class="terms-container">
                        <article class="terms-notice">
                            <strong>Important Notice</strong>
                            <p>ProcureX is a digital procurement platform. Unless expressly stated, ProcureX is not a buyer, supplier, contractor, consultant, agent, guarantor, or party to contracts formed between buyers and suppliers. Users are responsible for their own procurement decisions, documents, contracts, payments, and compliance obligations.</p>
                        </article>
                    </div>
                </section>

                <section class="terms-summary-band">
                    <div class="terms-container">
                        <div class="terms-section-heading">
                            <span class="terms-section-label">Terms Summary</span>
                            <h2>A clear platform-use agreement for procurement activity.</h2>
                            <p>These Terms cover account responsibilities, buyer and supplier obligations, tender creation, bid submission, evaluation, awarding, contracting, payments, prohibited conduct, confidentiality, privacy, disputes, and platform limitations.</p>
                        </div>
                        <div class="terms-summary-grid">
                            ${summaryCards.map(([title, text, icon]) => `
                                <article>
                                    <span>${renderTermsIcon(icon)}</span>
                                    <h3>${title}</h3>
                                    <p>${text}</p>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <div class="terms-container terms-layout">
                    <aside class="terms-toc" aria-label="Terms sections">
                        <strong>Terms sections</strong>
                        <nav>
                            ${toc.map(([label, id]) => `<a href="#${id}">${label}</a>`).join('')}
                        </nav>
                    </aside>

                    <div class="terms-content">
                        <section class="terms-section">
                            <span class="terms-section-label">Buyer and Supplier Responsibilities</span>
                            <h2>Responsibilities at a Glance</h2>
                            <div class="terms-comparison">
                                <article>
                                    <h3>Buyer responsibilities</h3>
                                    ${renderTermsList(buyerResponsibilities)}
                                </article>
                                <article>
                                    <h3>Supplier responsibilities</h3>
                                    ${renderTermsList(supplierResponsibilities)}
                                </article>
                            </div>
                        </section>

                        <section class="terms-section">
                            <span class="terms-section-label">Procurement Workflow Terms</span>
                            <h2>How the Terms Follow the Procurement Journey</h2>
                            <div class="terms-workflow">
                                ${workflow.map((item, index) => `
                                    <article>
                                        <span>${index + 1}</span>
                                        <strong>${item}</strong>
                                    </article>
                                `).join('')}
                            </div>
                        </section>

                        <section id="terms-prohibited-cards" class="terms-section terms-warning-section">
                            <span class="terms-section-label">Important Rules</span>
                            <h2>Prohibited Activities</h2>
                            <div class="terms-warning-grid">
                                ${prohibitedCards.map(([title, text]) => `
                                    <article>
                                        ${renderTermsIcon('<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/>')}
                                        <h3>${title}</h3>
                                        <p>${text}</p>
                                    </article>
                                `).join('')}
                            </div>
                        </section>

                        <section class="terms-section">
                            <span class="terms-section-label">Main Terms Content</span>
                            <h2>Full Terms and Conditions</h2>
                            <div class="terms-accordion">
                                ${termsSections.map((section, index) => `
                                    <details id="${section.id}" ${index < 2 ? 'open' : ''}>
                                        <summary>${String(index + 1).padStart(2, '0')} ${section.title}</summary>
                                        <div>${renderTermsSectionBody(section)}</div>
                                    </details>
                                `).join('')}
                            </div>
                        </section>

                        <section id="terms-contact-form" class="terms-section terms-contact-section">
                            <div>
                                <span class="terms-section-label">Contact Us</span>
                                <h2>Contact ProcureX About These Terms</h2>
                                <p>If you have questions about these Terms and Conditions, you may contact ProcureX.</p>
                                <div class="terms-contact-details">
                                    <span><strong>Platform</strong> ProcureX</span>
                                    <span><strong>Email</strong> <a href="mailto:support@procurex.com">support@procurex.com</a></span>
                                    <span><strong>Legal Contact</strong> <a href="mailto:legal@procurex.com">legal@procurex.com</a></span>
                                    <span><strong>Location</strong> Tanzania</span>
                                </div>
                            </div>

                            <article class="terms-contact-panel">
                                ${renderTermsIcon('<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>')}
                                <h3>Use the dedicated contact page</h3>
                                <p>Terms questions and support messages are now handled through one separate ProcureX contact form.</p>
                                <button class="btn btn-primary" type="button" data-navigate="contact">Open Contact Page</button>
                            </article>
                        </section>
                    </div>
                </div>

                <section class="terms-final-cta">
                    <div class="terms-container terms-final-panel">
                        <div>
                            <span class="terms-section-label">Ready to Use ProcureX Responsibly?</span>
                            <h2>Continue with a clear understanding of your responsibilities.</h2>
                            <p>By continuing to use ProcureX, you agree to follow these Terms and Conditions and use the platform in a lawful, fair, and professional manner.</p>
                            <label class="terms-final-check">
                                <input type="checkbox">
                                <span>I have read and agree to the ProcureX Terms and Conditions.</span>
                            </label>
                        </div>
                        <div class="terms-actions">
                            <button class="btn btn-primary" type="button" data-navigate="register">Accept and Continue</button>
                            <button class="btn btn-secondary" type="button" data-navigate="contact">Contact Support</button>
                        </div>
                    </div>
                </section>
            </main>

            <footer class="terms-footer">
                <div class="terms-container">
                    <strong>ProcureX</strong>
                    <p>Use ProcureX lawfully, fairly, and professionally across every tender, bid, contract, and procurement record.</p>
                </div>
            </footer>
        </div>
    `;
}

if (window.app) {
    window.app.renderTermsAndConditions = renderTermsAndConditions;
}
