// Contact ProcureX Page Component

function renderContactIcon(paths, className = 'contact-icon') {
    return `
        <svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${paths}
        </svg>
    `;
}

function renderContactPage() {
    const contactCards = [
        {
            icon: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
            title: 'Platform Support',
            text: 'Get help with accounts, tender access, bid submission, contracts, and general ProcureX usage.'
        },
        {
            icon: '<path d="M12 3l8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7z"/><path d="m9 12 2 2 4-4"/>',
            title: 'Privacy and Security',
            text: 'Ask questions about privacy requests, account security, document protection, or suspicious activity.'
        },
        {
            icon: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="M9 12h6"/><path d="M9 16h5"/>',
            title: 'Legal and Terms',
            text: 'Contact us about Terms and Conditions, procurement records, disputes, or policy questions.'
        }
    ];

    const responseSteps = [
        ['1', 'Send your request', 'Choose a request type and include the key details ProcureX needs to understand the issue.'],
        ['2', 'We review the context', 'The appropriate support team reviews your message and any supporting document you provide.'],
        ['3', 'You receive guidance', 'ProcureX responds with next steps, clarification, or support instructions.']
    ];

    return `
        <div class="contact-page">
            <header class="contact-nav">
                <div class="contact-container contact-nav-inner">
                    <a class="brand contact-brand" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <nav class="contact-nav-links" aria-label="Contact page navigation">
                        <a href="#" data-navigate="guest-marketplace">Open Tenders</a>
                        <a href="#" data-navigate="about-procurex">About</a>
                        <a href="#" data-navigate="privacy-policy">Privacy</a>
                        <a href="#" data-navigate="terms-and-conditions">Terms</a>
                        <a class="active" href="#" data-navigate="contact">Contact</a>
                    </nav>
                    <div class="contact-nav-actions">
                        <a href="#" data-navigate="sign-in">Sign In</a>
                        <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                    </div>
                </div>
            </header>

            <main>
                <section class="contact-hero">
                    <div class="contact-container contact-hero-grid">
                        <div class="contact-hero-copy animate-fade-in">
                            <span class="contact-eyebrow">Contact ProcureX</span>
                            <h1>How can we help you?</h1>
                            <p class="contact-lead">Reach ProcureX for platform support, privacy questions, legal requests, security concerns, and procurement workflow assistance.</p>
                            <p>Use this contact page for questions about accounts, tenders, bids, contracts, privacy, terms, or support needs. Your request is sent securely to ProcureX support.</p>
                            <div class="contact-actions">
                                <a class="btn btn-primary" href="#contact-form">Send a Request</a>
                                <a class="btn btn-secondary" href="mailto:support@procurex.com">Email Support</a>
                            </div>
                        </div>

                        <div class="contact-visual animate-fade-in delay-1" aria-label="ProcureX support workspace illustration">
                            <article class="contact-message-card">
                                <span>Support inbox</span>
                                <strong>New request</strong>
                                <p>Privacy question, tender issue, security report, or legal support.</p>
                            </article>
                            <article class="contact-channel-card">
                                ${renderContactIcon('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>')}
                                <strong>Priority routing</strong>
                                <span>Support, privacy, legal, or security</span>
                            </article>
                            <article class="contact-status-card">
                                <span>Response status</span>
                                <strong>Request sent</strong>
                                <div><i></i></div>
                            </article>
                        </div>
                    </div>
                </section>

                <section class="contact-summary-band">
                    <div class="contact-container contact-card-grid">
                        ${contactCards.map(card => `
                            <article>
                                <span>${renderContactIcon(card.icon)}</span>
                                <h3>${card.title}</h3>
                                <p>${card.text}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>

                <section class="contact-section">
                    <div class="contact-container contact-layout">
                        <div>
                            <span class="contact-section-label">Contact Details</span>
                            <h2>Reach the right ProcureX team.</h2>
                            <p>For urgent account or security concerns, include enough detail for the support team to identify the issue and respond appropriately.</p>
                            <div class="contact-details">
                                <span><strong>Platform</strong> ProcureX</span>
                                <span><strong>Support Email</strong> <a href="mailto:support@procurex.com">support@procurex.com</a></span>
                                <span><strong>Privacy Email</strong> <a href="mailto:privacy@procurex.com">privacy@procurex.com</a></span>
                                <span><strong>Legal Email</strong> <a href="mailto:legal@procurex.com">legal@procurex.com</a></span>
                                <span><strong>Location</strong> Tanzania</span>
                            </div>

                            <div class="contact-steps">
                                ${responseSteps.map(([number, title, text]) => `
                                    <article>
                                        <span>${number}</span>
                                        <div>
                                            <h3>${title}</h3>
                                            <p>${text}</p>
                                        </div>
                                    </article>
                                `).join('')}
                            </div>
                        </div>

                        <form id="contact-form" class="contact-form" data-action="contact-support" novalidate>
                            <label>
                                <span>Full name</span>
                                <input class="form-input" type="text" name="fullName" autocomplete="name" required>
                            </label>
                            <label>
                                <span>Email address</span>
                                <input class="form-input" type="email" name="email" autocomplete="email" required>
                            </label>
                            <label>
                                <span>Phone number</span>
                                <input class="form-input" type="tel" name="phone" autocomplete="tel">
                            </label>
                            <label>
                                <span>Organization name</span>
                                <input class="form-input" type="text" name="organization" autocomplete="organization">
                            </label>
                            <label class="contact-form-wide">
                                <span>Request type</span>
                                <select class="form-input" name="requestType">
                                    <option>General support</option>
                                    <option>Account question</option>
                                    <option>Tender issue</option>
                                    <option>Bid issue</option>
                                    <option>Contract issue</option>
                                    <option>Privacy request</option>
                                    <option>Terms and Conditions question</option>
                                    <option>Report security issue</option>
                                    <option>Report misconduct</option>
                                    <option>Other</option>
                                </select>
                            </label>
                            <label class="contact-form-wide">
                                <span>Message</span>
                                <textarea class="form-input" name="message" rows="6" required></textarea>
                            </label>
                            <label class="contact-form-wide">
                                <span>Upload supporting document, if needed</span>
                                <input class="form-input" type="file" name="supportingDocument">
                            </label>
                            <label class="contact-consent contact-form-wide">
                                <input type="checkbox" name="contactConsent" required>
                                <span>I confirm ProcureX may use these details to respond to my request.</span>
                            </label>
                            <div class="contact-form-actions contact-form-wide">
                                <button class="btn btn-primary" type="submit">Submit Request</button>
                                <p data-contact-form-status aria-live="polite"></p>
                            </div>
                        </form>
                    </div>
                </section>
            </main>

            <footer class="contact-footer">
                <div class="contact-container contact-footer-grid">
                    <div>
                        <strong>ProcureX</strong>
                        <p>Support for buyers, suppliers, and organizations using smarter digital procurement.</p>
                    </div>
                    <nav aria-label="Contact footer links">
                        <a href="#" data-navigate="about-procurex">About</a>
                        <a href="#" data-navigate="privacy-policy">Privacy Policy</a>
                        <a href="#" data-navigate="terms-and-conditions">Terms and Conditions</a>
                    </nav>
                </div>
            </footer>
        </div>
    `;
}

function renderContact() {
    return renderContactPage();
}

if (window.app) {
    window.app.renderContact = renderContact;
}
