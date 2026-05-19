// Tender Marketplace. One user account can create tenders and bid on tenders posted by others.

function escapeMarketplaceHtml(value = '') {
    return String(value)
        .replace(/and/g, 'andamp;')
        .replace(/</g, 'andlt;')
        .replace(/>/g, 'andgt;')
        .replace(/"/g, 'andquot;')
        .replace(/'/g, 'and#039;');
}

function getMarketplaceBudgetBand(value = 0) {
    const budget = Number(value || 0);
    if (budget >= 1000000000) return 'billion-plus';
    if (budget >= 100000000) return 'hundred-million-plus';
    return 'under-hundred-million';
}

function getMarketplaceDaysRemaining(tender = {}) {
    const closingTime = Date.parse(`${tender.closingDate}T23:59:59`);
    if (!Number.isFinite(closingTime)) return null;
    return Math.ceil((closingTime - Date.now()) / 86400000);
}

function renderSupplierMarketplace() {
    const tenders = typeof getProcurexMarketplaceTenders === 'function' ? getProcurexMarketplaceTenders() : (mockData.tenders || []);
    const openCount = tenders.filter(tender => tender.status === 'Open').length;
    const totalBudget = tenders.reduce((sum, tender) => sum + Number(tender.budget || 0), 0);
    const categoryCounts = tenders.reduce((map, tender) => {
        const key = tender.type || tender.procurementTypeId || 'Other';
        map[key] = (map[key] || 0) + 1;
        return map;
    }, {});

    return `
        <div class="procurement-app-page" data-marketplace-root>
            <main class="procurement-market-shell">
                <section class="procurement-market-hero">
                    <div>
                        <span class="section-kicker">Tender Marketplace</span>
                        <h1>Marketplace</h1>
                        <p>Search open tenders, create your own tender, and avoid self-bidding conflicts with clear ownership badges.</p>
                    </div>
                    <div class="procurement-market-actions">
                        <button class="btn btn-primary" data-navigate="create-tender">Create Tender</button>
                    </div>
                </section>

                <section class="procurement-search-panel" data-marketplace-filters>
                    <div class="market-search-field">
                        <input type="search" data-marketplace-search placeholder="Search title, buyer, reference, sector, location">
                    </div>
                    <select class="form-input" data-marketplace-type>
                        <option value="">All tender types</option>
                        <option>Goods</option>
                        <option>Works</option>
                        <option>Services</option>
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

                <section class="marketplace-category-grid" aria-label="Browse categories">
                    ${Object.entries(categoryCounts).map(([category, count]) => `
                        <button class="marketplace-category-card" type="button" data-marketplace-category="${escapeMarketplaceHtml(category)}">
                            <strong>${escapeMarketplaceHtml(category)}</strong>
                            <span>${count} ${count === 1 ? 'tender' : 'tenders'}</span>
                        </button>
                    `).join('')}
                </section>

                <section class="procurement-market-summary">
                    <div class="kpi-card"><div class="kpi-value">${openCount}</div><div class="kpi-label">Open tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${mockData.kpis.supplier.bidsInProgress}</div><div class="kpi-label">Draft bids</div></div>
                    <div class="kpi-card"><div class="kpi-value">${Math.min(mockData.kpis.supplier.closing48h, openCount)}</div><div class="kpi-label">Closing soon</div></div>
                    <div class="kpi-card"><div class="kpi-value">TZS ${(totalBudget / 1000000000).toFixed(1)}B</div><div class="kpi-label">Total budget value</div></div>
                </section>

                <section class="procurement-list-panel">
                    <div class="panel-heading">
                        <div>
                            <span class="section-kicker">Tender list</span>
                            <h2>Available tenders</h2>
                        </div>
                        <span class="badge badge-success" data-marketplace-count>${openCount} open</span>
                    </div>

                    <div class="procurement-tender-list market-list" data-marketplace-list>
                        ${tenders.map(tender => {
                            const searchable = [
                                tender.id,
                                tender.title,
                                tender.organization,
                                tender.type,
                                tender.category,
                                tender.description,
                                tender.location
                            ].join(' ').toLowerCase();
                            const daysRemaining = getMarketplaceDaysRemaining(tender);
                            return `
                                <article class="procurement-tender-row market-row ${tender.createdByCurrentUser ? 'is-owned' : ''}"
                                    data-marketplace-row
                                    data-search="${escapeMarketplaceHtml(searchable)}"
                                    data-type="${escapeMarketplaceHtml(tender.type || '')}"
                                    data-status="${escapeMarketplaceHtml(tender.status || '')}"
                                    data-budget-band="${getMarketplaceBudgetBand(tender.budget)}"
                                    data-budget="${Number(tender.budget || 0)}"
                                    data-closing="${escapeMarketplaceHtml(tender.closingDate || '')}"
                                    data-created="${escapeMarketplaceHtml(tender.publishedAt || tender.closingDate || '')}">
                                    <div>
                                        <div class="tender-row-title">
                                            <strong>${escapeMarketplaceHtml(tender.title)}</strong>
                                            <span class="badge badge-${tender.status === 'Open' ? 'success' : tender.status === 'Evaluation' ? 'warning' : 'info'}">${escapeMarketplaceHtml(tender.status)}</span>
                                            ${tender.createdByCurrentUser ? '<span class="badge badge-info">Posted by you</span>' : ''}
                                        </div>
                                        <p>${escapeMarketplaceHtml(tender.organization)} / ${escapeMarketplaceHtml(tender.type)} / Budget: TZS ${Number(tender.budget || 0).toLocaleString()}</p>
                                        <span>${escapeMarketplaceHtml(tender.description)}</span>
                                        <div class="market-row-meta">
                                            <em>${escapeMarketplaceHtml(tender.location || 'Location not set')}</em>
                                            <em>${daysRemaining === null ? 'Deadline not set' : daysRemaining < 0 ? 'Closed' : `${daysRemaining} days remaining`}</em>
                                        </div>
                                    </div>
                                    <div class="tender-row-actions">
                                        <button class="btn btn-secondary" type="button" data-marketplace-save>Save</button>
                                        <button class="btn btn-secondary" data-select-tender="${escapeMarketplaceHtml(tender.id)}" data-navigate="${tender.createdByCurrentUser ? 'tender-details' : 'tender-detail'}">View Tender</button>
                                        <button class="btn btn-primary" data-select-tender="${escapeMarketplaceHtml(tender.id)}" ${tender.status === 'Open' && !tender.createdByCurrentUser ? 'data-navigate="tender-detail"' : 'disabled'}>${tender.createdByCurrentUser ? 'Your Tender' : 'Bid'}</button>
                                    </div>
                                </article>
                            `;
                        }).join('') || '<div class="scope-empty">No active marketplace tenders right now. Create a tender to start a compliant procurement.</div>'}
                    </div>
                </section>
            </main>
        </div>
    `;
}

function initializeProcurexMarketplace() {
    const root = document.querySelector('[data-marketplace-root]');
    if (!root || root.dataset.ready === 'true') return;

    const rows = Array.from(root.querySelectorAll('[data-marketplace-row]'));
    const count = root.querySelector('[data-marketplace-count]');
    const search = root.querySelector('[data-marketplace-search]');
    const type = root.querySelector('[data-marketplace-type]');
    const budget = root.querySelector('[data-marketplace-budget]');
    const status = root.querySelector('[data-marketplace-status]');
    const sort = root.querySelector('[data-marketplace-sort]');
    const list = root.querySelector('[data-marketplace-list]');

    const applyFilters = () => {
        const query = (search?.value || '').trim().toLowerCase();
        const activeType = type?.value || '';
        const activeBudget = budget?.value || '';
        const activeStatus = status?.value || '';
        let visible = rows.filter(row => {
            const matchesQuery = !query || row.dataset.search.includes(query);
            const matchesType = !activeType || row.dataset.type === activeType;
            const matchesBudget = !activeBudget || row.dataset.budgetBand === activeBudget;
            const matchesStatus = !activeStatus || row.dataset.status === activeStatus;
            return matchesQuery && matchesType && matchesBudget && matchesStatus;
        });

        visible.sort((a, b) => {
            if (sort?.value === 'budget-desc') return Number(b.dataset.budget) - Number(a.dataset.budget);
            if (sort?.value === 'budget-asc') return Number(a.dataset.budget) - Number(b.dataset.budget);
            if (sort?.value === 'newest') return Date.parse(b.dataset.created || 0) - Date.parse(a.dataset.created || 0);
            return Date.parse(a.dataset.closing || 0) - Date.parse(b.dataset.closing || 0);
        });

        rows.forEach(row => row.hidden = !visible.includes(row));
        visible.forEach(row => list.appendChild(row));
        if (count) count.textContent = `${visible.length} matching`;
    };

    root.addEventListener('input', event => {
        if (event.target.matches('[data-marketplace-search]')) applyFilters();
    });
    root.addEventListener('change', event => {
        if (event.target.matches('select')) applyFilters();
    });
    root.addEventListener('click', event => {
        const categoryButton = event.target.closest('[data-marketplace-category]');
        if (categoryButton && type) {
            type.value = categoryButton.dataset.marketplaceCategory;
            applyFilters();
            return;
        }
        const saveButton = event.target.closest('[data-marketplace-save]');
        if (saveButton) {
            saveButton.textContent = saveButton.textContent === 'Saved' ? 'Save' : 'Saved';
        }
    });

    applyFilters();
    root.dataset.ready = 'true';
}

window.initializeProcurexMarketplace = initializeProcurexMarketplace;

if (window.app) {
    window.app.renderSupplierMarketplace = renderSupplierMarketplace;
}
