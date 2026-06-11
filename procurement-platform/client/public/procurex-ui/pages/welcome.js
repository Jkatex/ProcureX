// Welcome/Landing Page Component

function renderWelcomeIcon(paths, className = 'welcome-icon') {
    return `
        <svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${paths}
        </svg>
    `;
}

function renderWelcome() {
    const steps = [
        {
            icon: '<path d="M12 8v8"/><path d="M8 12h8"/><circle cx="12" cy="12" r="9"/>',
            title: 'Create Tender',
            text: 'Post goods, services, or consultancy needs to your registered participants.'
        },
        {
            icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
            title: 'Discover Tenders',
            text: 'Browse active procurement requests and find the perfect match for your business capabilities.'
        },
        {
            icon: '<path d="m5 12 14-7-7 14-2-5z"/>',
            title: 'Submit Bid',
            text: 'Prepare and submit professional proposals through our secure and transparent bidding engine.'
        },
        {
            icon: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
            title: 'Track Records',
            text: 'Maintain a clear audit trail of all messages, clarifications, awards, and historical data.'
        }
    ];

    const marketplaceCards = [
        {
            icon: '<path d="M12 3a6 6 0 0 0-6 6c0 4 6 12 6 12s6-8 6-12a6 6 0 0 0-6-6Z"/><circle cx="12" cy="9" r="2"/>',
            title: 'Tenders',
            text: 'Access a global stream of verified procurement requests that match your specific industry and scale.',
            points: ['Verified tender details', 'Direct procuring entity interaction']
        },
        {
            icon: '<path d="M7 11a4 4 0 1 1 8 0"/><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
            title: 'Relationships',
            text: 'Build long-term partnerships through our transparent profile and performance tracking system.',
            points: ['Performance ratings', 'Repeat business alerts']
        },
        {
            icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
            title: 'Records',
            text: 'Maintain a robust, immutable record of every transaction, bid, and contract for compliance and audit.',
            points: ['Immutable audit trails', 'Data-driven insights']
        }
    ];

    return `
        <div class="landing-page welcome-page-v2">
            <header class="landing-nav welcome-nav-v2">
                <div class="landing-nav-inner container">
                    <a class="brand welcome-brand-v2" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <nav class="landing-nav-links welcome-nav-links-v2" aria-label="Welcome navigation">
                        <a class="active" href="#" data-navigate="guest-marketplace">Browse Open Tenders</a>
                        <a href="#how-it-works">How It Works</a>
                        <a href="#" data-navigate="about-procurex">About</a>
                        <a href="#help-center">Help Center</a>
                    </nav>
                    <div class="welcome-nav-actions-v2">
                        <a href="#" data-navigate="sign-in">Sign In</a>
                        <button class="btn btn-secondary" type="button" data-demo-launch>View Demo</button>
                        <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                    </div>
                </div>
            </header>

            <main class="welcome-hero-v2">
                <div class="container welcome-hero-grid-v2">
                    <section class="welcome-hero-copy-v2 animate-fade-in">
                        <span class="eyebrow">Welcome to ProcureX</span>
                        <h1>Buy. Supply. Connect. Grow.</h1>
                        <p>ProcureX is a modern e-procurement marketplace built to make procurement simple, fair, secure, and accessible for everyone.</p>
                        <p>Create tenders, discover tenders, and build a procurement record today.</p>
                        <div class="hero-actions">
                            <button class="btn btn-primary" type="button" data-demo-launch>View ProcureX Demo</button>
                            <button class="btn btn-primary" type="button" data-navigate="register">Get Started</button>
                            <button class="btn btn-secondary" type="button" data-navigate="guest-marketplace">Browse Open Tenders</button>
                        </div>
                        <div class="welcome-proof-v2" aria-label="Trusted business proof">
                            <span class="welcome-proof-avatars-v2" aria-hidden="true">
                                <i></i><i></i><i></i>
                            </span>
                            <span>Used by 2,000+ participants</span>
                        </div>
                    </section>

                    <section class="welcome-product-stage-v2 animate-fade-in delay-1" aria-label="ProcureX marketplace preview">
                        <div class="welcome-product-window-v2">
                            <div class="welcome-product-top-v2">
                                <span>${renderWelcomeIcon('<path d="M7 7h10v10H7z"/><path d="M9 9h6v6H9z"/>', 'welcome-product-mark-v2')} ProcureX Marketplace</span>
                                <em>Active workspace</em>
                            </div>
                            <div class="welcome-product-metrics-v2">
                                <article>
                                    ${renderWelcomeIcon('<path d="M12 8v8"/><path d="M8 12h8"/><circle cx="12" cy="12" r="9"/>')}
                                    <strong>Create tender</strong>
                                    <span>Post goods, services, or consultancy.</span>
                                </article>
                                <article>
                                    ${renderWelcomeIcon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
                                    <strong>Discover tenders</strong>
                                    <span>Find open tenders and bidding.</span>
                                </article>
                            </div>
                            <div class="welcome-product-rate-v2">
                                <div>
                                    <span>Verified Profile</span>
                                    <strong>98.4% Completion Rate</strong>
                                </div>
                                <button class="btn btn-primary" type="button" data-demo-launch>View Demo</button>
                            </div>
                            <figure class="welcome-product-photo-v2">
                                <img src="assets/welcome/procurement-meeting.webp" alt="Procurement team reviewing documents in a meeting" loading="eager">
                            </figure>
                        </div>
                    </section>
                </div>
            </main>

            <section id="how-it-works" class="welcome-section-v2 welcome-steps-section-v2">
                <div class="container">
                    <div class="section-header welcome-centered-v2">
                        <span class="section-label">Streamlined workflow</span>
                        <h2>Four steps to procurement success</h2>
                    </div>
                    <div class="welcome-steps-grid-v2">
                        ${steps.map(step => `
                            <article class="welcome-step-v2">
                                <span class="welcome-step-icon-v2">${renderWelcomeIcon(step.icon)}</span>
                                <h3>${step.title}</h3>
                                <p>${step.text}</p>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </section>

            <section id="about-procurex" class="welcome-section-v2 welcome-gateway-section-v2">
                <div class="container">
                    <div class="section-header welcome-centered-v2">
                        <h2>Your procurement gateway for tendering</h2>
                        <p>ProcureX connects businesses, procuring entities, and tenderers in one secure, digital-first marketplace.</p>
                    </div>
                    <div class="welcome-gateway-grid-v2">
                        <figure class="welcome-story-image-v2">
                            <img src="assets/welcome/opportunity-signing.webp" alt="Procurement documents prepared for review and signing" loading="lazy">
                            <figcaption>
                                <span>From request to decision,</span>
                                <strong>every step has a place.</strong>
                                <small>Centralize your entire procurement workflow. From initial RFP to final contract awarding, keep all data in a single source of truth.</small>
                            </figcaption>
                        </figure>
                        <div class="welcome-assurance-stack-v2">
                            <article>
                                ${renderWelcomeIcon('<path d="M4 7h16v10H4z"/><path d="M8 21h8"/><path d="M12 17v4"/>')}
                                <div>
                                    <h3>No scattered communication</h3>
                                    <p>Messages, clarification requests, and alerts stay in the system so critical data is never lost in email threads.</p>
                                </div>
                            </article>
                            <article>
                                ${renderWelcomeIcon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>')}
                                <div>
                                    <h3>No hidden tenders</h3>
                                    <p>Discover open tenders and service needs in one organized place, ensuring fair competition for all verified partners.</p>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </section>

            <section class="welcome-dark-band-v2">
                <div class="container">
                    <div class="section-header welcome-centered-v2">
                        <h2>A smarter marketplace for everyone</h2>
                        <p>ProcureX creates a shared space where businesses can meet and work together efficiently, whether they are procuring entities, tenderers, or specialized professionals.</p>
                    </div>
                    <div class="welcome-market-grid-v2">
                        ${marketplaceCards.map((card, index) => `
                            <article class="welcome-market-card-v2">
                                <div class="welcome-market-thumb-v2">
                                    <img src="assets/welcome/${['business-collaboration.webp', 'contract-review.webp', 'procurement-meeting.webp'][index]}" alt="" loading="lazy" aria-hidden="true">
                                </div>
                                <span class="welcome-market-icon-v2">${renderWelcomeIcon(card.icon)}</span>
                                <h3>${card.title}</h3>
                                <p>${card.text}</p>
                                <ul>
                                    ${card.points.map(point => `<li>${point}</li>`).join('')}
                                </ul>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </section>

            <section class="welcome-cta-section-v2">
                <div class="container">
                    <div class="welcome-cta-panel-v2">
                        <div>
                            <h2>Join ProcureX today.</h2>
                            <p>Start your procurement journey with one simple account. Create tenders, submit bids, and grow your business today.</p>
                        </div>
                        <div class="cta-actions">
                            <button class="btn btn-secondary" type="button" data-demo-launch>Open Demo</button>
                            <button class="btn btn-primary" type="button" data-navigate="register">Get Started Now</button>
                        </div>
                    </div>
                </div>
            </section>

            <footer id="help-center" class="welcome-footer-v2">
                <div class="container">
                    <div>
                        <strong>ProcureX</strong>
                        <p>2026 ProcureX. All rights reserved. Connecting businesses, tenderers, and professionals through smarter procurement.</p>
                    </div>
                    <nav aria-label="Company links">
                        <h3>Company</h3>
                        <a href="#" data-navigate="about-procurex">About ProcureX</a>
                        <a href="#" data-navigate="privacy-policy">Privacy Policy</a>
                        <a href="#" data-navigate="terms-and-conditions">Terms and Conditions</a>
                    </nav>
                    <nav aria-label="Platform links">
                        <h3>Platform</h3>
                        <a href="#" data-navigate="guest-marketplace">Browse Open Tenders</a>
                        <a href="#help-center">System Status</a>
                    </nav>
                    <nav aria-label="Support links">
                        <h3>Support</h3>
                        <a href="#" data-navigate="contact">Help Center</a>
                        <a href="#" data-navigate="contact">Contact Support</a>
                    </nav>
                </div>
            </footer>
        </div>
    `;
}

// Register the page render function
if (window.app) {
    window.app.renderWelcome = renderWelcome;
}
