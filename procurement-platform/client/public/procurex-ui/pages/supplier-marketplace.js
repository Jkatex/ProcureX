// Tender Marketplace. One user account can create tenders and bid on tenders posted by others.

function escapeMarketplaceHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function getMarketplaceStatusBadgeClass(status = '') {
    const raw = String(status || '').toLowerCase();
    if (/open|published|posted/.test(raw)) return 'badge-success';
    if (/draft|pending|evaluation|review/.test(raw)) return 'badge-warning';
    if (/closed|completed|submitted|awarded/.test(raw)) return 'badge-info';
    return 'badge-info';
}

function getMarketplaceTenderId(tender = {}) {
    return String(tender.id || tender.reference || tender.tenderId || '');
}

function hasMarketplaceBidState(tender = {}, section = '') {
    const tenderId = getMarketplaceTenderId(tender);
    const rows = typeof getProcurexMyBidRows === 'function' ? getProcurexMyBidRows() : [];
    return rows.some(row => String(row.tenderId || row.tender?.id || row.tender?.reference || '') === tenderId && (!section || row.section === section));
}

function renderMarketplaceTabButtons(tabs = [], activeId = '') {
    return `
        <div class="supplier-detail-tabs marketplace-tabs" role="tablist">
            ${tabs.map(tab => `
                <button class="supplier-detail-tab ${tab.id === activeId ? 'active' : ''}" type="button" role="tab" aria-selected="${tab.id === activeId ? 'true' : 'false'}" data-marketplace-tab="${escapeMarketplaceHtml(tab.id)}">
                    ${escapeMarketplaceHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

function renderMarketplaceTabPanels(tabs = [], activeId = '') {
    return `
        <div class="supplier-detail-tab-panels marketplace-tab-panels">
            ${tabs.map(tab => `
                <section class="supplier-detail-tab-panel" role="tabpanel" data-marketplace-tab-panel="${escapeMarketplaceHtml(tab.id)}" style="display: ${tab.id === activeId ? 'grid' : 'none'};">
                    ${tab.content}
                </section>
            `).join('')}
        </div>
    `;
}

function renderMarketplaceTenderRow(tender = {}) {
    const owned = typeof isProcurexTenderOwnedByCurrentUser === 'function' ? isProcurexTenderOwnedByCurrentUser(tender) : tender.createdByCurrentUser;
    const tenderId = getMarketplaceTenderId(tender);
    const daysRemaining = getMarketplaceDaysRemaining(tender);
    const hasSubmittedBid = hasMarketplaceBidState(tender, 'submitted');
    const hasDraftBid = hasMarketplaceBidState(tender, 'draft');
    const canBid = tender.status === 'Open' && !owned && !hasSubmittedBid;
    const isSaved = tender.isSaved === true;
    const searchable = [
        tender.id,
        tender.title,
        tender.organization,
        tender.type,
        tender.category,
        tender.description,
        tender.location
    ].join(' ').toLowerCase();

    return `
        <article class="procurement-tender-row market-row ${owned ? 'is-owned' : ''}"
            data-marketplace-row
            data-search="${escapeMarketplaceHtml(searchable)}"
            data-type="${escapeMarketplaceHtml(tender.type || '')}"
            data-status="${escapeMarketplaceHtml(tender.status || '')}"
            data-budget-band="${getMarketplaceBudgetBand(tender.budget)}"
            data-budget="${Number(tender.budget || 0)}"
            data-closing="${escapeMarketplaceHtml(tender.closingDate || '')}"
            data-created="${escapeMarketplaceHtml(tender.publishedAt || tender.closingDate || '')}"
            data-tender-id="${escapeMarketplaceHtml(tenderId)}">
            <div>
                <div class="tender-row-title">
                    <strong>${escapeMarketplaceHtml(tender.title)}</strong>
                    <span class="badge ${getMarketplaceStatusBadgeClass(tender.status)}">${escapeMarketplaceHtml(tender.status || 'Open')}</span>
                    ${owned ? '<span class="badge badge-info">Created by you</span>' : ''}
                    ${hasSubmittedBid ? '<span class="badge badge-success">You already bid</span>' : ''}
                    ${hasDraftBid && !hasSubmittedBid ? '<span class="badge badge-warning">Draft bid saved</span>' : ''}
                </div>
                <p>${escapeMarketplaceHtml(tender.organization || tender.ownerOrganization || 'Buyer')} / ${escapeMarketplaceHtml(tender.type || 'Tender')} / Budget: TZS ${Number(tender.budget || 0).toLocaleString()}</p>
                <span>${escapeMarketplaceHtml(tender.description || 'Tender details available for review.')}</span>
                <div class="market-row-meta">
                    <em>${escapeMarketplaceHtml(tender.location || 'Location not set')}</em>
                    <em>${daysRemaining === null ? 'Deadline not set' : daysRemaining < 0 ? 'Closed' : `${daysRemaining} days remaining`}</em>
                </div>
            </div>
            <div class="tender-row-actions">
                <button class="btn btn-secondary" type="button" data-marketplace-save data-select-tender="${escapeMarketplaceHtml(tenderId)}" data-marketplace-saved="${isSaved ? 'true' : 'false'}" ${owned ? 'disabled title="You cannot save your own tender."' : ''}>${owned ? 'Own Tender' : isSaved ? 'Saved' : 'Save'}</button>
                ${owned
                    ? `<button class="btn btn-primary" type="button" data-select-tender="${escapeMarketplaceHtml(tenderId)}" data-navigate="tender-details">View My Tender</button>`
                    : `
                        <button class="btn btn-secondary" type="button" data-select-tender="${escapeMarketplaceHtml(tenderId)}" data-navigate="tender-detail">View Tender</button>
                        <button class="btn btn-primary" type="button" data-select-tender="${escapeMarketplaceHtml(tenderId)}" ${canBid ? `data-navigate="${hasDraftBid ? 'bidding-workspace' : 'tender-detail'}"` : 'disabled'}>${hasSubmittedBid ? 'Already Bid' : hasDraftBid ? 'Continue Bid' : 'Bid'}</button>
                    `}
            </div>
        </article>
    `;
}

function renderMarketplaceMyTenderRow(row = {}) {
    const tender = row.tender || {};
    const tenderId = getMarketplaceTenderId(tender) || row.id;
    return `
        <article class="procurement-tender-row market-row is-owned">
            <div>
                <div class="tender-row-title">
                    <strong>${escapeMarketplaceHtml(row.title || tender.title || 'Tender')}</strong>
                    <span class="badge ${getMarketplaceStatusBadgeClass(row.status)}">${escapeMarketplaceHtml(row.status || 'Draft')}</span>
                    <span class="badge badge-info">Created by you</span>
                </div>
                <p>${escapeMarketplaceHtml(row.type || tender.type || 'Tender')} / ${escapeMarketplaceHtml(tender.organization || tender.ownerOrganization || 'Your organization')}</p>
                <span>${escapeMarketplaceHtml(tender.description || 'Tender record owned by the current user.')}</span>
                <div class="market-row-meta">
                    <em>${escapeMarketplaceHtml(tender.closingDate ? `Closing ${tender.closingDate}` : 'No closing date set')}</em>
                    <em>${escapeMarketplaceHtml(row.lastActivity ? `Updated ${new Date(row.lastActivity).toLocaleDateString()}` : 'Recently updated')}</em>
                </div>
            </div>
            <div class="tender-row-actions">
                <button class="btn btn-primary" type="button" ${row.nav === 'create-tender' ? 'data-navigate="create-tender"' : `data-select-tender="${escapeMarketplaceHtml(tenderId)}" data-navigate="${escapeMarketplaceHtml(row.nav || 'tender-details')}"`}>${escapeMarketplaceHtml(row.actionLabel || 'Open')}</button>
            </div>
        </article>
    `;
}

function renderMarketplaceMyBidRow(row = {}) {
    const tender = row.tender || {};
    const tenderId = row.tenderId || getMarketplaceTenderId(tender);
    return `
        <article class="procurement-tender-row market-row">
            <div>
                <div class="tender-row-title">
                    <strong>${escapeMarketplaceHtml(row.title || tender.title || 'Bid')}</strong>
                    <span class="badge ${row.section === 'submitted' ? 'badge-success' : 'badge-warning'}">${escapeMarketplaceHtml(row.status || 'Draft')}</span>
                    ${row.receiptHash ? `<span class="badge badge-info">${escapeMarketplaceHtml(row.receiptHash)}</span>` : ''}
                </div>
                <p>${escapeMarketplaceHtml(tender.organization || 'Marketplace buyer')} / ${escapeMarketplaceHtml(tender.type || 'Tender')} ${row.amount ? `/ ${escapeMarketplaceHtml(row.amount)}` : ''}</p>
                <span>${row.section === 'submitted' ? 'Submitted bid package is sealed and recorded.' : 'Draft bid submission saved for completion.'}</span>
                <div class="market-row-meta">
                    <em>${escapeMarketplaceHtml(tender.closingDate ? `Closing ${tender.closingDate}` : 'Deadline not set')}</em>
                    <em>${escapeMarketplaceHtml(row.lastActivity ? `Updated ${new Date(row.lastActivity).toLocaleDateString()}` : 'Recently updated')}</em>
                </div>
            </div>
            <div class="tender-row-actions">
                <button class="btn btn-primary" type="button" data-select-tender="${escapeMarketplaceHtml(tenderId)}" data-navigate="${escapeMarketplaceHtml(row.nav || 'bidding-workspace')}">${escapeMarketplaceHtml(row.actionLabel || 'Open Bid')}</button>
            </div>
        </article>
    `;
}

function renderMarketplaceSection(title = '', kicker = '', rows = [], renderer = renderMarketplaceTenderRow, empty = 'No records yet.') {
    return `
        <section class="procurement-list-panel marketplace-work-section">
            <div class="panel-heading">
                <div>
                    <span class="section-kicker">${escapeMarketplaceHtml(kicker)}</span>
                    <h2>${escapeMarketplaceHtml(title)}</h2>
                </div>
                <span class="badge badge-info">${rows.length} record${rows.length === 1 ? '' : 's'}</span>
            </div>
            <div class="procurement-tender-list market-list">
                ${rows.length ? rows.map(renderer).join('') : `<div class="scope-empty">${escapeMarketplaceHtml(empty)}</div>`}
            </div>
        </section>
    `;
}

function renderMarketplaceBrowseTab(tenders = [], categoryCounts = {}, openCount = 0) {
    return `
        <section class="procurement-search-panel" data-marketplace-filters>
            <div class="market-search-field">
                <input type="search" data-marketplace-search placeholder="Search title, buyer, reference, sector, location">
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

        <section class="marketplace-category-grid" aria-label="Browse categories">
            ${Object.entries(categoryCounts).map(([category, count]) => `
                <button class="marketplace-category-card" type="button" data-marketplace-category="${escapeMarketplaceHtml(category)}">
                    <strong>${escapeMarketplaceHtml(category)}</strong>
                    <span>${count} ${count === 1 ? 'tender' : 'tenders'}</span>
                </button>
            `).join('')}
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
                ${tenders.map(renderMarketplaceTenderRow).join('') || '<div class="scope-empty">No active marketplace tenders right now. Create a tender to start a compliant procurement.</div>'}
            </div>
        </section>
    `;
}

function renderSupplierMarketplace() {
    const account = typeof getProcurexCurrentAccount === 'function' ? getProcurexCurrentAccount() : {};
    const tenders = typeof getProcurexMarketplaceTenders === 'function' ? getProcurexMarketplaceTenders() : (mockData.tenders || []);
    const myTenderRows = typeof getProcurexMyTenderRows === 'function' ? getProcurexMyTenderRows() : [];
    const myBidRows = typeof getProcurexMyBidRows === 'function' ? getProcurexMyBidRows() : [];
    const openCount = tenders.filter(tender => tender.status === 'Open').length;
    const totalBudget = tenders.reduce((sum, tender) => sum + Number(tender.budget || 0), 0);
    const categoryCounts = tenders.reduce((map, tender) => {
        const key = tender.type || tender.procurementTypeId || 'Other';
        map[key] = (map[key] || 0) + 1;
        return map;
    }, {});
    const tabs = [
        { id: 'marketplace', label: 'Marketplace', content: renderMarketplaceBrowseTab(tenders, categoryCounts, openCount) },
        {
            id: 'my-tenders',
            label: 'My Tenders',
            content: `
                ${renderMarketplaceSection('Draft Tenders', 'Tender creation', myTenderRows.filter(row => row.section === 'draft'), renderMarketplaceMyTenderRow, 'No tender creation drafts for this account.')}
                ${renderMarketplaceSection('Completed / Posted Tenders', 'Published by you', myTenderRows.filter(row => row.section === 'posted'), renderMarketplaceMyTenderRow, 'No posted tenders for this account.')}
                ${renderMarketplaceSection('Closed / Completed Tenders', 'Tender history', myTenderRows.filter(row => row.section === 'completed'), renderMarketplaceMyTenderRow, 'No closed or completed tenders for this account.')}
            `
        },
        {
            id: 'my-bids',
            label: 'My Bids',
            content: `
                ${renderMarketplaceSection('Draft Bid Submissions', 'Bid preparation', myBidRows.filter(row => row.section === 'draft'), renderMarketplaceMyBidRow, 'No draft bid submissions for this account.')}
                ${renderMarketplaceSection('Submitted / Completed Bid Submissions', 'Bid records', myBidRows.filter(row => row.section === 'submitted'), renderMarketplaceMyBidRow, 'No submitted bid records for this account.')}
            `
        }
    ];

    return `
        <div class="procurement-app-page" data-marketplace-root>
            <main class="procurement-market-shell">
                <section class="procurement-market-hero">
                    <div>
                        <span class="section-kicker">Tender Marketplace</span>
                        <h1>Marketplace</h1>
                        <p>Search open tenders, manage tenders created by ${escapeMarketplaceHtml(account.organization || 'your account')}, and track bid drafts and submitted bid records.</p>
                    </div>
                    <div class="procurement-market-actions">
                        ${account.canCreateTender === false ? '<span class="badge badge-info">Individual account</span>' : '<button class="btn btn-primary" data-navigate="create-tender">Create Tender</button>'}
                    </div>
                </section>

                <section class="procurement-market-summary">
                    <div class="kpi-card"><div class="kpi-value">${openCount}</div><div class="kpi-label">Open tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${myTenderRows.length}</div><div class="kpi-label">My tenders</div></div>
                    <div class="kpi-card"><div class="kpi-value">${myBidRows.length}</div><div class="kpi-label">My bids</div></div>
                    <div class="kpi-card"><div class="kpi-value">TZS ${(totalBudget / 1000000000).toFixed(1)}B</div><div class="kpi-label">Total budget value</div></div>
                </section>

                <section class="supplier-detail-tabbed-view marketplace-tabbed-view">
                    ${renderMarketplaceTabButtons(tabs, 'marketplace')}
                    ${renderMarketplaceTabPanels(tabs, 'marketplace')}
                </section>
            </main>
        </div>
    `;
}

function initializeProcurexMarketplace() {
    const root = document.querySelector('[data-marketplace-root]');
    if (!root || root.dataset.ready === 'true') return;

    const getRows = () => Array.from(root.querySelectorAll('[data-marketplace-row]'));
    const count = root.querySelector('[data-marketplace-count]');
    const search = root.querySelector('[data-marketplace-search]');
    const type = root.querySelector('[data-marketplace-type]');
    const budget = root.querySelector('[data-marketplace-budget]');
    const status = root.querySelector('[data-marketplace-status]');
    const sort = root.querySelector('[data-marketplace-sort]');
    const list = root.querySelector('[data-marketplace-list]');

    const applyFilters = () => {
        const rows = getRows();
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
        visible.forEach(row => list?.appendChild(row));
        if (count) count.textContent = `${visible.length} matching`;
    };

    root.addEventListener('input', event => {
        if (event.target.matches('[data-marketplace-search]')) applyFilters();
    });
    root.addEventListener('change', event => {
        if (event.target.matches('select')) applyFilters();
    });
    root.addEventListener('click', event => {
        const tabButton = event.target.closest('[data-marketplace-tab]');
        if (tabButton) {
            event.preventDefault();
            const target = tabButton.dataset.marketplaceTab;
            root.querySelectorAll('[data-marketplace-tab]').forEach(button => {
                const active = button.dataset.marketplaceTab === target;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            root.querySelectorAll('[data-marketplace-tab-panel]').forEach(panel => {
                panel.style.display = panel.dataset.marketplaceTabPanel === target ? 'grid' : 'none';
            });
            return;
        }

        const categoryButton = event.target.closest('[data-marketplace-category]');
        if (categoryButton && type) {
            type.value = categoryButton.dataset.marketplaceCategory;
            applyFilters();
            return;
        }
        const saveButton = event.target.closest('[data-marketplace-save]');
        if (saveButton) {
            event.preventDefault();
            const tenderId = saveButton.dataset.selectTender || saveButton.closest('[data-marketplace-row]')?.dataset.tenderId || saveButton.dataset.marketplaceSave || '';
            const nextSaved = saveButton.dataset.marketplaceSaved !== 'true';
            const previousText = saveButton.textContent;
            const previousDisabled = saveButton.disabled;
            saveButton.disabled = true;
            saveButton.textContent = nextSaved ? 'Saving...' : 'Removing...';

            Promise.resolve()
                .then(() => {
                    if (typeof window.toggleProcurexTenderSave !== 'function') {
                        throw new Error('Saved tender service is unavailable.');
                    }
                    return window.toggleProcurexTenderSave(tenderId, nextSaved);
                })
                .then(() => {
                    if (!saveButton.isConnected) return;
                    saveButton.dataset.marketplaceSaved = nextSaved ? 'true' : 'false';
                    saveButton.textContent = nextSaved ? 'Saved' : 'Save';
                })
                .catch(error => {
                    if (saveButton.isConnected) {
                        saveButton.textContent = previousText;
                    }
                    if (!error?.userNotified) {
                        alert(error instanceof Error ? error.message : 'Unable to update saved tender.');
                    }
                })
                .finally(() => {
                    if (saveButton.isConnected) {
                        saveButton.disabled = previousDisabled;
                    }
                });
        }
    });

    applyFilters();
    root.dataset.ready = 'true';
}

window.initializeProcurexMarketplace = initializeProcurexMarketplace;

if (window.app) {
    window.app.renderSupplierMarketplace = renderSupplierMarketplace;
}
