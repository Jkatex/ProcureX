// Guest Marketplace Page Component

function renderGuestMarketplace() {
    const tenders = typeof getProcurexMarketplaceTenders === 'function' ? getProcurexMarketplaceTenders() : mockData.tenders;
    const openCount = tenders.filter(tender => tender.status === 'Open').length;

    return `
        <div class="guest-marketplace-v2">
            <header class="app-topbar-public">
                <div class="app-topbar-public-inner">
                    <a class="brand" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <button class="btn btn-primary" type="button" data-navigate="sign-in">Sign In to Bid</button>
                </div>
            </header>

            <main class="guest-market-shell-v2">
                <section class="marketplace-hero">
                    <div>
                        <span class="section-kicker">Public marketplace</span>
                        <h2>Browse published tenders.</h2>
                        <p>Browse active tenders, compare buyer needs, and sign in when you are ready to submit a secure bid.</p>
                    </div>
                </section>

                <section class="guest-search-panel-v2">
                    <div class="market-search-field">
                        <input type="text" placeholder="Search tenders, buyer, sector, or category">
                    </div>
                    <select class="form-input">
                        <option>All sectors</option>
                        <option>Health</option>
                        <option>Education</option>
                        <option>Infrastructure</option>
                        <option>ICT</option>
                    </select>
                    <select class="form-input">
                        <option>All tender types</option>
                        <option>Goods</option>
                        <option>Works</option>
                        <option>Service</option>
                        <option>Consultancy</option>
                    </select>
                    <select class="form-input">
                        <option>All budgets</option>
                        <option>Under 1M TZS</option>
                        <option>1M - 10M TZS</option>
                        <option>10M - 50M TZS</option>
                        <option>Over 50M TZS</option>
                    </select>
                    <button class="btn btn-primary" type="button">Search</button>
                </section>

                <section class="procurement-market-summary">
                    <div class="kpi-card"><div class="kpi-value">${openCount}</div><div class="kpi-label">Open tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${tenders.length}</div><div class="kpi-label">Published Tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${Math.min(mockData.kpis.supplier.closing48h, openCount)}</div><div class="kpi-label">Closing soon</div></div>
                </section>

                <section class="procurement-list-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Tender list</span>
                            <h2>Latest tenders</h2>
                        </div>
                        <span class="badge badge-success">${openCount} open</span>
                    </div>

                    <div class="guest-tender-grid-v2">
                        ${tenders.map(tender => `
                            <article class="tender-card guest-tender-card-v2">
                                <div class="flex justify-between items-center gap-4">
                                    <span class="badge badge-${tender.status === 'Open' ? 'success' : tender.status === 'Evaluation' ? 'warning' : 'info'}">${tender.status}</span>
                                    <span class="text-sm text-secondary">${tender.type}</span>
                                </div>
                                <h4 class="tender-title">${tender.title}</h4>
                                <div class="tender-meta">
                                    <div>${tender.organization}</div>
                                    <div>Budget: TZS ${tender.budget.toLocaleString()}</div>
                                    <div>Closes: ${tender.closingDate}</div>
                                </div>
                                <p class="tender-description">${tender.description}</p>
                                <button class="btn btn-primary" type="button" data-navigate="sign-in">Sign In to Bid</button>
                            </article>
                        `).join('')}
                    </div>
                </section>

                <section class="guest-value-panel-v2">
                    <div>
                        <span class="section-kicker">Why ProcureX</span>
                        <h2>Fair discovery, secure bidding, better records.</h2>
                    </div>
                    <div class="guest-value-grid-v2">
                            <article>
                                <h3>Transparent Process</h3>
                                <p>Every bid and evaluation is recorded on blockchain for complete transparency</p>
                            </article>
                            <article>
                                <h3>SME Friendly</h3>
                                <p>Smart matching algorithms ensure fair access to tenders for small businesses</p>
                            </article>
                            <article>
                                <h3>Secure and Compliant</h3>
                                <p>Bank-grade security with full regulatory compliance</p>
                            </article>
                    </div>
                </section>
            </main>
        </div>
    `;
}

// Register the page render function
if (window.app) {
    window.app.renderGuestMarketplace = renderGuestMarketplace;
}
