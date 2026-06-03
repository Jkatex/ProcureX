// Guest Marketplace Page Component

function escapeGuestMarketplaceHtml(value = '') {
    if (window.ProcureXShared?.escapeHtml) return window.ProcureXShared.escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getGuestMarketplaceBudgetBand(value = 0) {
    const budget = Number(value || 0);
    if (budget >= 1000000000) return 'billion-plus';
    if (budget >= 100000000) return 'hundred-million-plus';
    return 'under-hundred-million';
}

function getGuestMarketplaceDaysRemaining(tender = {}) {
    const closingTime = Date.parse(`${tender.closingDate}T23:59:59`);
    if (!Number.isFinite(closingTime)) return null;
    return Math.ceil((closingTime - Date.now()) / 86400000);
}

function formatGuestMarketplaceMoney(value = 0) {
    if (window.ProcureXShared?.formatMoney) return window.ProcureXShared.formatMoney(value);
    return `TZS ${Number(value || 0).toLocaleString()}`;
}

function renderGuestTenderRow(tender = {}) {
    const daysRemaining = getGuestMarketplaceDaysRemaining(tender);
    const searchable = [
        tender.id,
        tender.title,
        tender.organization,
        tender.type,
        tender.category,
        tender.description,
        tender.location
    ].join(' ').toLowerCase();
    const isOpen = tender.status === 'Open';
    const statusTone = isOpen ? 'success' : tender.status === 'Evaluation' ? 'warning' : 'info';

    return `
        <article class="procurement-tender-row market-row guest-market-row"
            data-marketplace-row
            data-search="${escapeGuestMarketplaceHtml(searchable)}"
            data-type="${escapeGuestMarketplaceHtml(tender.type || '')}"
            data-status="${escapeGuestMarketplaceHtml(tender.status || '')}"
            data-budget-band="${getGuestMarketplaceBudgetBand(tender.budget)}"
            data-budget="${Number(tender.budget || 0)}"
            data-closing="${escapeGuestMarketplaceHtml(tender.closingDate || '')}"
            data-created="${escapeGuestMarketplaceHtml(tender.publishedAt || tender.closingDate || '')}">
            <div>
                <div class="tender-row-title">
                    <strong>${escapeGuestMarketplaceHtml(tender.title)}</strong>
                    <span class="badge badge-${statusTone}">${escapeGuestMarketplaceHtml(tender.status || 'Published')}</span>
                </div>
                <p>${escapeGuestMarketplaceHtml(tender.organization || 'Buyer not listed')} / ${escapeGuestMarketplaceHtml(tender.type || 'Tender')} / ${formatGuestMarketplaceMoney(tender.budget)}</p>
                <span>${escapeGuestMarketplaceHtml(tender.description || 'Tender details available after sign in.')}</span>
                <div class="market-row-meta">
                    <em>${escapeGuestMarketplaceHtml(tender.reference || tender.id || 'Reference pending')}</em>
                    <em>${escapeGuestMarketplaceHtml(tender.location || 'Location not set')}</em>
                    <em>${daysRemaining === null ? 'Deadline not set' : daysRemaining < 0 ? 'Closed' : `${daysRemaining} days remaining`}</em>
                </div>
            </div>
            <div class="tender-row-actions">
                <button class="btn btn-secondary" type="button" data-select-tender="${escapeGuestMarketplaceHtml(tender.id || '')}" data-navigate="sign-in">View Details</button>
                <button class="btn btn-primary" type="button" data-select-tender="${escapeGuestMarketplaceHtml(tender.id || '')}" data-navigate="sign-in" ${isOpen ? '' : 'disabled'}>${isOpen ? 'Sign In to Bid' : 'Closed'}</button>
            </div>
        </article>
    `;
}

function renderGuestMarketplace() {
    const tenders = typeof getProcurexMarketplaceTenders === 'function' ? getProcurexMarketplaceTenders() : (mockData.tenders || []);
    const openCount = tenders.filter(tender => tender.status === 'Open').length;
    const totalBudget = tenders.reduce((sum, tender) => sum + Number(tender.budget || 0), 0);
    const closingSoon = tenders.filter(tender => {
        const days = getGuestMarketplaceDaysRemaining(tender);
        return days !== null && days >= 0 && days <= 7;
    }).length;
    const categoryCounts = tenders.reduce((map, tender) => {
        const key = tender.type || tender.procurementTypeId || 'Other';
        map[key] = (map[key] || 0) + 1;
        return map;
    }, {});

    return `
        <div class="guest-marketplace-v2" data-marketplace-root>
            <header class="app-topbar-public">
                <div class="app-topbar-public-inner">
                    <a class="brand" href="#" data-navigate="welcome" aria-label="ProcureX home">
                        ${renderPlatformLogo()}
                        <span class="brand-text">ProcureX</span>
                    </a>
                    <div class="guest-topbar-actions">
                        <button class="btn btn-secondary" type="button" data-navigate="welcome">Home</button>
                        <button class="btn btn-primary" type="button" data-navigate="sign-in">Sign In</button>
                    </div>
                </div>
            </header>

            <main class="guest-market-shell-v2">
                <section class="marketplace-hero guest-market-hero">
                    <div>
                        <span class="section-kicker">Public marketplace</span>
                        <h2>Find open public tenders.</h2>
                        <p>Browse published opportunities, compare buyer requirements, review deadlines, and sign in when you are ready to view full tender packs or submit a secure bid.</p>
                    </div>
                    <div class="guest-hero-actions">
                        <button class="btn btn-primary" type="button" data-navigate="sign-in">Sign In to Bid</button>
                        <button class="btn btn-secondary" type="button" data-navigate="register">Create Account</button>
                    </div>
                </section>

                <section class="guest-search-panel-v2 procurement-search-panel" data-marketplace-filters>
                    <div class="market-search-field">
                        <input type="search" data-marketplace-search placeholder="Search title, buyer, reference, sector, or location">
                    </div>
                    <select class="form-input" data-marketplace-type>
                        <option value="">All tender types</option>
                        <option>Goods</option>
                        <option>Works</option>
                        <option>Non Consultancy</option>
                        <option>Consultancy</option>
                    </select>
                    <select class="form-input" data-marketplace-budget>
                        <option value="">All budgets</option>
                        <option value="under-hundred-million">Under TZS 100M</option>
                        <option value="hundred-million-plus">TZS 100M to 1B</option>
                        <option value="billion-plus">TZS 1B+</option>
                    </select>
                    <select class="form-input" data-marketplace-status>
                        <option value="">All statuses</option>
                        <option>Open</option>
                        <option>Evaluation</option>
                        <option>Awarded</option>
                    </select>
                    <select class="form-input" data-marketplace-sort>
                        <option value="deadline">Sort by deadline</option>
                        <option value="newest">Newest</option>
                        <option value="budget-desc">Budget high to low</option>
                        <option value="budget-asc">Budget low to high</option>
                    </select>
                </section>

                <section class="marketplace-category-grid guest-category-grid" aria-label="Browse public tender categories">
                    ${Object.entries(categoryCounts).map(([category, count]) => `
                        <button class="marketplace-category-card" type="button" data-marketplace-category="${escapeGuestMarketplaceHtml(category)}">
                            <strong>${escapeGuestMarketplaceHtml(category)}</strong>
                            <span>${count} ${count === 1 ? 'tender' : 'tenders'}</span>
                        </button>
                    `).join('')}
                </section>

                <section class="procurement-market-summary guest-market-summary" aria-label="Marketplace summary">
                    <div class="kpi-card"><div class="kpi-value">${openCount}</div><div class="kpi-label">Open tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${tenders.length}</div><div class="kpi-label">Published tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${closingSoon}</div><div class="kpi-label">Closing in 7 days</div></div>
                    <div class="kpi-card"><div class="kpi-value">TZS ${(totalBudget / 1000000000).toFixed(1)}B</div><div class="kpi-label">Total budget value</div></div>
                </section>

                <section class="procurement-list-panel guest-list-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Tender list</span>
                            <h2>Published opportunities</h2>
                        </div>
                        <span class="badge badge-success" data-marketplace-count>${openCount} open</span>
                    </div>

                    <div class="procurement-tender-list market-list guest-tender-list" data-marketplace-list>
                        ${tenders.map(renderGuestTenderRow).join('') || '<div class="scope-empty">No published marketplace tenders right now.</div>'}
                    </div>
                </section>

                <section class="guest-value-panel-v2">
                    <div>
                        <span class="section-kicker">Why ProcureX</span>
                        <h2>Transparent discovery, secure bidding, better records.</h2>
                        <p>ProcureX keeps public opportunities easy to discover while protecting the full bid process behind verified accounts.</p>
                    </div>
                    <div class="guest-value-grid-v2">
                        <article>
                            <strong>Transparent process</strong>
                            <p>Published tenders show buyer, status, deadline, scope, and budget signals in one place.</p>
                        </article>
                        <article>
                            <strong>Supplier ready</strong>
                            <p>Verified accounts can save tenders, inspect full documents, and submit secure responses.</p>
                        </article>
                        <article>
                            <strong>Audit friendly</strong>
                            <p>Records, clarifications, and bid activity are organized for clean procurement history.</p>
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
