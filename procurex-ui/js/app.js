// ProcureX SPA Application

const PLATFORM_LOGO_SRC = 'assets/logo.svg';
const PROCUREX_LOTTIE_SRC = 'assets/ProcureX.json';

function renderPlatformLogo(className = 'platform-logo') {
    return `
        <span class="${className}">
            <img class="platform-logo-image" src="${PLATFORM_LOGO_SRC}" alt="ProcureX">
        </span>
    `;
}

function renderProcureXLottie(className = 'procurex-lottie', label = 'ProcureX animation') {
    return `
        <dotlottie-player class="${className}" src="${PROCUREX_LOTTIE_SRC}" background="transparent" speed="1" loop autoplay aria-label="${label}"></dotlottie-player>
    `;
}

class ProcureXApp {
    constructor() {
        this.currentPage = 'welcome';
        this.pages = {};
        this.registrationTimer = null;
        this.procurementFeedTimer = null;
        this.init();
    }

    init() {
        this.setupRouting();
        this.loadAllPages();
        this.renderPage();
        this.setupEventListeners();
    }

    setupRouting() {
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const urlParams = new URLSearchParams(window.location.search);
            const page = e.state?.page || urlParams.get('page') || 'welcome';
            this.navigateTo(page, false);
        });

        // Handle initial load
        const urlParams = new URLSearchParams(window.location.search);
        const initialPage = urlParams.get('page') || 'welcome';

        this.navigateTo(initialPage, false);
        history.replaceState({ page: this.currentPage }, '', window.location.href);
    }

    setupEventListeners() {
        // Handle all navigation clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-navigate]');
            if (link) {
                e.preventDefault();
                const tenderId = link.getAttribute('data-select-tender');
                if (tenderId && typeof window.selectProcurexTender === 'function') {
                    window.selectProcurexTender(tenderId);
                }
                const page = link.getAttribute('data-navigate');
                this.navigateTo(page);
            }
        });

        // Handle form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const action = form.getAttribute('data-action');
            if (action) {
                e.preventDefault();
                this.handleFormAction(action, form);
            }
        });
    }

    navigateTo(page, updateHistory = true) {
        const pageAliases = {
            'buyer-dashboard': 'workspace-dashboard',
            'supplier-dashboard': 'workspace-dashboard',
            'procurement-dashboard': 'workspace-dashboard',
            'supplier-marketplace': 'marketplace',
            'supplier-tender-detail': 'tender-detail',
            'supplier-journey': 'procurement-guide',
            'buyer-journey': 'procurement-guide',
            'iam-verification': 'identity-verification',
            'verification-status': 'account-profile'
        };
        page = pageAliases[page] || page;
        if (page === 'bid-evaluation') {
            this.clearEvaluationEntrySelection();
        }
        const previousPage = this.currentPage;
        this.currentPage = page;
        if (updateHistory && page !== previousPage) {
            const url = `?page=${page}`;
            history.pushState({ page }, '', url);
        }
        this.renderPage();
    }

    clearEvaluationEntrySelection() {
        if (typeof window.clearProcurexEvaluationSelection === 'function') {
            window.clearProcurexEvaluationSelection();
            return;
        }

        try {
            localStorage.removeItem('procurex.selectedEvaluationTender');
            localStorage.removeItem('procurex.selectedEvaluationReport');
        } catch (error) {
            window.procurexSelectedEvaluationTender = '';
            window.procurexSelectedEvaluationReport = '';
        }
    }

    isAdminSession() {
        return mockData.pendingAccount?.accountType === 'admin' || mockData.session?.accountType === 'admin';
    }

    getNavigationHeader() {
        const pagesWithoutAppBar = ['welcome', 'register', 'sign-in', 'identity-verification', 'iam-verification', 'guest-marketplace', 'about-procurex', 'privacy-policy', 'terms-and-conditions', 'contact'];
        if (pagesWithoutAppBar.includes(this.currentPage)) return '';

        const currentAppName = this.getCurrentAppName();
        const isAdmin = this.isAdminSession();
        const homePage = isAdmin ? 'admin-dashboard' : 'workspace-dashboard';
        const userApps = `
            <button class="app-menu-card app-menu-iam" data-navigate="account-profile">
                <span class="app-menu-icon">${this.getAppMenuIcon('iam')}</span>
                <span><strong>Registration and Verification</strong><em>Account and identity verification</em></span>
            </button>
            <button class="app-menu-card app-menu-procurement" data-navigate="tender-planning">
                <span class="app-menu-icon">${this.getAppMenuIcon('planning')}</span>
                <span><strong>Tender Planning</strong><em>APP, SPP, budgets, approvals</em></span>
            </button>
            <button class="app-menu-card app-menu-procurement" data-navigate="marketplace">
                <span class="app-menu-icon">${this.getAppMenuIcon('procurement')}</span>
                <span><strong>Procurement</strong><em>Marketplace, create tender, bid</em></span>
            </button>
            <button class="app-menu-card app-menu-communication" data-navigate="communication-center">
                <span class="app-menu-icon">${this.getAppMenuIcon('communication')}</span>
                <span><strong>Communication Center</strong><em>Messages, clarifications, alerts</em></span>
            </button>
            <button class="app-menu-card app-menu-evaluation" data-navigate="bid-evaluation">
                <span class="app-menu-icon">${this.getAppMenuIcon('evaluation')}</span>
                <span><strong>Evaluation</strong><em>Evaluate bids on your tenders</em></span>
            </button>
            <button class="app-menu-card app-menu-awarding" data-navigate="awarding-contracts">
                <span class="app-menu-icon">${this.getAppMenuIcon('awarding')}</span>
                <span><strong>Awarding and Contract</strong><em>Awards, negotiations, signatures</em></span>
            </button>
            <button class="app-menu-card app-menu-contracts" data-navigate="records-history">
                <span class="app-menu-icon">${this.getAppMenuIcon('contracts')}</span>
                <span><strong>Records and History</strong><em>Past tenders, bids, awards</em></span>
            </button>
        `;
        const adminApps = `
            <button class="app-menu-card app-menu-insights" data-navigate="admin-dashboard">
                <span class="app-menu-icon">${this.getAppMenuIcon('insights')}</span>
                <span><strong>Command Center</strong><em>Admin KPIs, queues, and oversight</em></span>
            </button>
            <button class="app-menu-card app-menu-procurement" data-navigate="admin-search">
                <span class="app-menu-icon">${this.getAppMenuIcon('search')}</span>
                <span><strong>Admin Deep Search</strong><em>Tenders, bids, users, evidence, evaluations</em></span>
            </button>
            <button class="app-menu-card app-menu-iam" data-navigate="admin-users">
                <span class="app-menu-icon">${this.getAppMenuIcon('iam')}</span>
                <span><strong>User Management</strong><em>Accounts, roles, and verification</em></span>
            </button>
            <button class="app-menu-card app-menu-evaluation" data-navigate="admin-compliance">
                <span class="app-menu-icon">${this.getAppMenuIcon('evaluation')}</span>
                <span><strong>Compliance Rules</strong><em>Thresholds, checklists, and alerts</em></span>
            </button>
            <button class="app-menu-card app-menu-insights" data-navigate="admin-analytics">
                <span class="app-menu-icon">${this.getAppMenuIcon('insights')}</span>
                <span><strong>Platform Analytics</strong><em>Procurement metrics and trends</em></span>
            </button>
            <button class="app-menu-card app-menu-contracts" data-navigate="admin-audit">
                <span class="app-menu-icon">${this.getAppMenuIcon('contracts')}</span>
                <span><strong>Full Audit Trail</strong><em>System-wide action history</em></span>
            </button>
            <button class="app-menu-card app-menu-iam" data-navigate="account-profile">
                <span class="app-menu-icon">${this.getAppMenuIcon('iam')}</span>
                <span><strong>Admin Profile</strong><em>Platform compliance identity and verification</em></span>
            </button>
            <button class="app-menu-card app-menu-communication" data-navigate="communication-center">
                <span class="app-menu-icon">${this.getAppMenuIcon('communication')}</span>
                <span><strong>Communication Center</strong><em>Compliance notices and comments</em></span>
            </button>
            <button class="app-menu-card app-menu-contracts" data-navigate="records-history">
                <span class="app-menu-icon">${this.getAppMenuIcon('contracts')}</span>
                <span><strong>Platform Audit Records</strong><em>Platform-wide history and evidence</em></span>
            </button>
        `;

        return `
            <header class="app-topbar">
                <div class="app-topbar-left">
                    <button class="app-brand-button" type="button" data-navigate="${homePage}">
                        ${renderPlatformLogo()}
                        <span>${currentAppName}</span>
                    </button>
                </div>

                <div class="app-topbar-actions">
                      <button class="icon-menu-btn" type="button" data-app-menu-toggle aria-label="Open apps" aria-expanded="false">
                        <span></span><span></span><span></span>
                        <span></span><span></span><span></span>
                        <span></span><span></span><span></span>
                    </button>
                    <div class="profile-menu-wrap">
                        <button class="profile-button" type="button" data-profile-menu-toggle aria-label="Open profile menu" aria-expanded="false">
                            <span>AU</span>
                        </button>
                    </div>
                </div>

                <div class="app-drawer-menu" data-app-menu>
                    <div class="app-menu-header">
                        <div class="app-menu-brand">
                            ${renderPlatformLogo('platform-logo platform-logo-sm')}
                            <strong>ProcureX Apps</strong>
                        </div>
                        <span>${isAdmin ? 'Platform admin tools' : 'Company account tools'}</span>
                    </div>
                    ${isAdmin ? adminApps : userApps}
                </div>

                <div class="profile-menu" data-profile-menu>
                    <button type="button" data-navigate="account-profile">Profile</button>
                    <button type="button" data-navigate="communication-center">Messages</button>
                    <button type="button">Help</button>
                    <button type="button">Language</button>
                    <button type="button" data-navigate="sign-in">Logout</button>
                </div>
            </header>
        `;
    }

    getAppMenuIcon(type) {
        const icons = {
            iam: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/>',
            planning: '<path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
            procurement: '<path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/><path d="M9 17h4"/>',
            evaluation: '<path d="M9 11l2 2 4-4"/><path d="M8 4h8"/><path d="M8 20h8"/><path d="M5 7h14v10H5z"/>',
            awarding: '<circle cx="12" cy="8" r="4"/><path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5"/><path d="M10.5 8l1 1 2-2"/>',
            contracts: '<path d="M8 3h8l3 3v15H5V3z"/><path d="M15 3v4h4"/><path d="M8 12h8"/><path d="M8 16h6"/>',
            communication: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
            insights: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/>',
            search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><path d="M8 11h6"/><path d="M11 8v6"/>'
        };

        return `
            <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                ${icons[type] || icons.procurement}
            </svg>
        `;
    }

    getCurrentAppName() {
        const pageAppNames = {
            'app-launcher': 'Apps',
            'workspace-dashboard': 'Dashboard',
            'admin-dashboard': 'Admin',
            'admin-search': 'Admin Deep Search',
            'admin-users': 'Admin User Management',
            'admin-compliance': 'Admin Compliance Rules',
            'admin-analytics': 'Admin Analytics',
            'admin-audit': 'Admin Audit Trail',
            'account-profile': 'Registration and Verification',
            'verification-status': 'Registration and Verification',
            'about-procurex': 'About ProcureX',
            'privacy-policy': 'Privacy Policy',
            'terms-and-conditions': 'Terms and Conditions',
            'contact': 'Contact ProcureX',
            'tender-planning': 'Tender Planning',
            'supplier-journey': 'Procurement',
            'buyer-journey': 'Procurement',
            'procurement-guide': 'Procurement',
            'marketplace': 'Procurement',
            'tender-detail': 'Procurement',
            'supplier-marketplace': 'Procurement',
            'supplier-tender-detail': 'Procurement',
            'communication-center': 'Communication Center',
            'create-tender': 'Procurement',
            'tender-publication': 'Procurement',
            'tender-details': 'Procurement',
            'records-history': 'Records and History',
            'bidding-workspace': 'Procurement',
            'bid-evaluation': 'Evaluation',
            'awarding-contracts': 'Awarding and Contract',
            'award-recommendation': 'Awarding and Contract',
            'contract-negotiation': 'Awarding and Contract',
            'post-award-tracking': 'Awarding and Contract'
        };

        return pageAppNames[this.currentPage] || this.getPageTitle();
    }

    getBackPage() {
        const navigationFlow = {
            'register': 'welcome',
            'sign-in': 'register',
            'role-selection': 'welcome',
            'identity-verification': 'sign-in',
            'iam-verification': 'sign-in',
            'account-profile': 'app-launcher',
            'verification-status': 'app-launcher',
            'app-launcher': null,
            'workspace-dashboard': 'app-launcher',
            'procurement-dashboard': 'workspace-dashboard',
            'admin-dashboard': null,
            'admin-search': 'admin-dashboard',
            'admin-users': 'admin-dashboard',
            'admin-compliance': 'admin-dashboard',
            'admin-analytics': 'admin-dashboard',
            'admin-audit': 'admin-dashboard',
            'buyer-dashboard': 'workspace-dashboard',
            'buyer-journey': 'workspace-dashboard',
            'procurement-guide': 'workspace-dashboard',
            'supplier-dashboard': 'workspace-dashboard',
            'supplier-journey': 'workspace-dashboard',
            'marketplace': 'workspace-dashboard',
            'tender-detail': 'marketplace',
            'supplier-marketplace': 'marketplace',
            'supplier-tender-detail': 'tender-detail',
            'communication-center': 'workspace-dashboard',
            'guest-marketplace': 'welcome',
            'about-procurex': 'welcome',
            'privacy-policy': 'welcome',
            'terms-and-conditions': 'welcome',
            'contact': 'welcome',
            'create-tender': 'workspace-dashboard',
            'tender-publication': 'create-tender',
            'tender-details': 'marketplace',
            'records-history': 'workspace-dashboard',
            'bidding-workspace': 'tender-detail',
            'bid-evaluation': 'workspace-dashboard',
            'awarding-contracts': 'workspace-dashboard',
            'award-recommendation': 'awarding-contracts',
            'contract-negotiation': 'awarding-contracts',
            'post-award-tracking': 'contract-negotiation'
        };
        return navigationFlow[this.currentPage] || null;
    }

    getPageTitle() {
        const titles = {
            'register': 'Create Account',
            'sign-in': 'Sign In',
            'role-selection': 'Start Registration',
            'identity-verification': 'Identity Verification',
            'iam-verification': 'Identity Verification',
            'account-profile': 'Account Profile',
            'verification-status': 'Account Profile',
            'app-launcher': 'App Launcher',
            'workspace-dashboard': 'Dashboard',
            'procurement-dashboard': 'Dashboard',
            'admin-dashboard': 'Admin Dashboard',
            'admin-search': 'Admin Deep Search',
            'admin-users': 'User Management',
            'admin-compliance': 'Compliance Rules',
            'admin-analytics': 'Platform Analytics',
            'admin-audit': 'Full Audit Trail',
            'buyer-dashboard': 'Dashboard',
            'buyer-journey': 'Procurement Process Guide',
            'procurement-guide': 'Procurement Process Guide',
            'supplier-dashboard': 'Dashboard',
            'supplier-journey': 'Procurement Process Guide',
            'marketplace': 'Tender Marketplace',
            'supplier-marketplace': 'Tender Marketplace',
            'tender-detail': 'Tender Detail',
            'supplier-tender-detail': 'Tender Detail',
            'communication-center': 'Communication Center',
            'guest-marketplace': 'ProcureX Marketplace',
            'about-procurex': 'About ProcureX',
            'privacy-policy': 'Privacy Policy',
            'terms-and-conditions': 'Terms and Conditions',
            'contact': 'Contact ProcureX',
            'create-tender': 'Create Tender',
            'tender-publication': 'Tender Draft Detail',
            'tender-details': 'Tender Detail',
            'records-history': 'Records and History',
            'bidding-workspace': 'Bidding Workspace',
            'bid-evaluation': 'Bid Evaluation',
            'awarding-contracts': 'Awarding and Contracts',
            'award-recommendation': 'Award Recommendation',
            'contract-negotiation': 'Contract Negotiation',
            'post-award-tracking': 'Post-Award Tracking'
        };
        return titles[this.currentPage] || this.currentPage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    renderPage() {
        const pageContent = document.getElementById('page-content');
        document.body.dataset.page = this.currentPage;
        this.clearProcurementFeedTimer();
        if (this.pages[this.currentPage]) {
            const pageHtml = this.pages[this.currentPage]();
            const navHeader = this.getNavigationHeader();
            pageContent.setAttribute('aria-live', 'polite');
            pageContent.innerHTML = navHeader + pageHtml;
            this.initializePageComponents();
        } else {
            pageContent.innerHTML = this.renderComingSoon();
        }
    }

    initializePageComponents() {
        // Initialize charts if Chart.js is available. The page should still render if the CDN is blocked.
        if (typeof window.createChart === 'function' && typeof window.Chart !== 'undefined') {
            if (document.getElementById('admin-activity-chart')) {
                createChart('admin-activity-chart', 'adminActivity');
            }
            if (document.getElementById('buyer-spend-chart')) {
                createChart('buyer-spend-chart', 'buyerSpend');
            }
        }
        this.initializeDashboardAnalytics();

        // Initialize any interactive components
        this.initializeTabs();
        this.initializeForms();
        document.querySelectorAll('.form-error-new, .form-error').forEach((error) => {
            error.setAttribute('role', 'alert');
            error.setAttribute('aria-live', 'polite');
        });
        this.initializeConfirmControls();
        this.initializeWorkspaceMenus();
        this.initializeAuthPage();
        this.initializeRegistrationPage();
        this.initializeEkycPage();
        this.initializeIamProfilePage();
        if (typeof window.initializeCreateTenderWizard === 'function') {
            window.initializeCreateTenderWizard();
        }
        if (typeof window.initializeBiddingWorkspace === 'function') {
            window.initializeBiddingWorkspace();
        }
        if (typeof window.initializeSupplierTenderDetail === 'function') {
            window.initializeSupplierTenderDetail();
        }
        if (typeof window.initializeCommunicationCenter === 'function') {
            window.initializeCommunicationCenter();
        }
        if (typeof window.initializeAwardingContracts === 'function') {
            window.initializeAwardingContracts();
        }
        if (typeof window.initializeAwardRecommendation === 'function') {
            window.initializeAwardRecommendation();
        }
        if (typeof window.initializeAwardContractDraftControls === 'function') {
            window.initializeAwardContractDraftControls();
        }
        if (typeof window.initializeProcurexMarketplace === 'function') {
            window.initializeProcurexMarketplace();
        }
        if (typeof window.initializeRecordsHistory === 'function') {
            window.initializeRecordsHistory();
        }
        if (typeof window.initializeBidEvaluation === 'function') {
            window.initializeBidEvaluation();
        }
        if (typeof window.initializeAdminSearch === 'function') {
            window.initializeAdminSearch();
        }
        if (typeof window.initializeWorkspaceDashboard === 'function') {
            window.initializeWorkspaceDashboard();
        }
        this.initializeProcurementLiveFeed();
    }

    clearProcurementFeedTimer() {
        if (this.procurementFeedTimer) {
            clearInterval(this.procurementFeedTimer);
            this.procurementFeedTimer = null;
        }
    }

    initializeProcurementLiveFeed() {
        const feed = document.querySelector('[data-procurement-feed]');
        if (!feed) return;

        const cards = Array.from(feed.querySelectorAll('[data-feed-card]'));
        const dots = Array.from(feed.querySelectorAll('[data-feed-dot]'));
        if (cards.length <= 1) return;

        let activeIndex = 0;
        const setActiveCard = (nextIndex) => {
            activeIndex = nextIndex % cards.length;
            cards.forEach((card, index) => {
                const isActive = index === activeIndex;
                card.classList.toggle('active', isActive);
                card.setAttribute('aria-hidden', String(!isActive));
            });
            dots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
        };

        this.procurementFeedTimer = setInterval(() => {
            setActiveCard(activeIndex + 1);
        }, 3600);
    }

    initializeDashboardAnalytics() {
        const activityCanvas = document.getElementById('user-activity-chart');
        const valueCanvas = document.getElementById('user-value-chart');
        const buttons = document.querySelectorAll('[data-dashboard-period]');
        if (!activityCanvas || !valueCanvas || !buttons.length || typeof window.getWorkspaceDashboardModel !== 'function') return;

        const dashboard = window.getWorkspaceDashboardModel();
        const fallback = document.querySelector('.dashboard-chart-fallback');
        const periodBadge = document.querySelector('[data-dashboard-period-badge]');
        const charts = {};
        let chartRetryCount = 0;
        let chartRetryTimer = null;

        const renderFallbackBars = (period) => {
            if (!fallback) return;
            const maxValue = Math.max(...period.value);
            fallback.innerHTML = period.labels.map((label, index) => {
                const width = Math.max(8, Math.round((period.value[index] / maxValue) * 100));
                return `
                    <div>
                        <span>${label}</span>
                        <strong>${period.activity[index]}</strong>
                        <div class="analytics-bar"><i style="width: ${width}%"></i></div>
                    </div>
                `;
            }).join('');
        };

        const renderChart = (key) => {
            const period = dashboard.periods[key] || dashboard.periods.monthly;
            buttons.forEach(button => button.classList.toggle('active', button.dataset.dashboardPeriod === key));
            if (periodBadge) periodBadge.textContent = period.badge;
            renderFallbackBars(period);

            if (typeof window.Chart === 'undefined') {
                activityCanvas.closest('.dashboard-chart-grid')?.classList.add('is-hidden');
                fallback?.classList.add('is-visible');
                if (chartRetryCount < 20) {
                    chartRetryCount += 1;
                    clearTimeout(chartRetryTimer);
                    chartRetryTimer = setTimeout(() => renderChart(key), 250);
                }
                return;
            }

            clearTimeout(chartRetryTimer);
            activityCanvas.closest('.dashboard-chart-grid')?.classList.remove('is-hidden');
            fallback?.classList.remove('is-visible');

            const sharedOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.18)' } },
                    x: { grid: { display: false } }
                }
            };

            charts.activity?.destroy();
            charts.value?.destroy();

            charts.activity = new Chart(activityCanvas, {
                type: 'bar',
                data: {
                    labels: period.labels,
                    datasets: [{
                        label: `${period.label} user activity`,
                        data: period.activity,
                        backgroundColor: '#008080',
                        borderRadius: 8
                    }]
                },
                options: sharedOptions
            });

            charts.value = new Chart(valueCanvas, {
                type: 'line',
                data: {
                    labels: period.labels,
                    datasets: [{
                        label: `${period.label} user value`,
                        data: period.value,
                        borderColor: '#008080',
                        backgroundColor: 'rgba(0, 128, 128, 0.10)',
                        fill: true,
                        tension: 0.35
                    }]
                },
                options: {
                    ...sharedOptions,
                    scales: {
                        ...sharedOptions.scales,
                        y: {
                            ...sharedOptions.scales.y,
                            ticks: {
                                callback: value => `${Math.round(value / 1000000)}M`
                            }
                        }
                    }
                }
            });
        };

        buttons.forEach(button => {
            button.addEventListener('click', () => renderChart(button.dataset.dashboardPeriod));
        });

        renderChart('weekly');
    }

    initializeWorkspaceMenus() {
        const appButton = document.querySelector('[data-app-menu-toggle]');
        const appMenu = document.querySelector('[data-app-menu]');
        const profileButton = document.querySelector('[data-profile-menu-toggle]');
        const profileMenu = document.querySelector('[data-profile-menu]');

        const closeMenus = () => {
            appMenu?.classList.remove('open');
            profileMenu?.classList.remove('open');
            appButton?.setAttribute('aria-expanded', 'false');
            profileButton?.setAttribute('aria-expanded', 'false');
        };

        appButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = !appMenu?.classList.contains('open');
            closeMenus();
            appMenu?.classList.toggle('open', willOpen);
            appButton.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) {
                setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
            }
        });

        profileButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = !profileMenu?.classList.contains('open');
            closeMenus();
            profileMenu?.classList.toggle('open', willOpen);
            profileButton.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) {
                setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
            }
        });
    }

    initializeConfirmControls() {
        document.querySelectorAll('[data-confirm-control]').forEach((control) => {
            const input = control.querySelector('input[type="checkbox"]');
            const button = control.querySelector('[data-confirm-toggle]');
            if (!input || !button || button.dataset.confirmReady === 'true') return;

            const sync = () => {
                const isConfirmed = input.checked;
                control.classList.toggle('confirmed', isConfirmed);
                button.classList.toggle('confirmed', isConfirmed);
                button.setAttribute('aria-pressed', String(isConfirmed));
            };

            button.dataset.confirmReady = 'true';
            button.addEventListener('click', () => {
                input.checked = !input.checked;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                sync();
            });

            input.addEventListener('change', sync);
            sync();
        });
    }

    initializeTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            const tabGroup = tab.closest('.tabs');
            const tabContent = tabGroup?.nextElementSibling;
            if (tab.classList.contains('active') && tabContent) {
                const activeTab = tab.getAttribute('data-tab');
                tabContent.querySelectorAll('.tab-content').forEach(content => {
                    const isActive = content.getAttribute('data-tab') === activeTab;
                    content.classList.toggle('tab-content--visible', isActive);
                    content.classList.toggle('tab-content--hidden', !isActive);
                });
            }

            tab.addEventListener('click', () => {
                const tabGroup = tab.closest('.tabs');
                const tabContent = tabGroup.nextElementSibling;
                const targetTab = tab.getAttribute('data-tab');

                // Update tab states
                tabGroup.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update content
                if (tabContent) {
                    tabContent.querySelectorAll('.tab-content').forEach(content => {
                        const isActive = content.getAttribute('data-tab') === targetTab;
                        content.classList.toggle('tab-content--visible', isActive);
                        content.classList.toggle('tab-content--hidden', !isActive);
                    });
                }
            });
        });
    }

    initializeForms() {
        // Initialize OTP inputs
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });
        });

        // Initialize file uploads
        const uploadAreas = document.querySelectorAll('.upload-area');
        uploadAreas.forEach(area => {
            area.addEventListener('click', () => {
                const input = area.querySelector('input[type="file"]');
                if (input && area.tagName !== 'LABEL') input.click();
            });

            const fileInput = area.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.addEventListener('change', () => {
                    this.updateUploadLabel(area, fileInput.files?.[0]?.name);
                });
            }

            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('dragover');
            });

            area.addEventListener('dragleave', () => {
                area.classList.remove('dragover');
            });

            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('dragover');
                const files = e.dataTransfer.files;
                const input = area.querySelector('input[type="file"]');
                if (input && files.length) {
                    this.updateUploadLabel(area, files[0].name);
                }
            });
        });
    }

    updateUploadLabel(area, fileName) {
        const fileNameEl = area.querySelector('.file-name');
        if (fileNameEl && fileName) {
            fileNameEl.textContent = fileName;
            area.classList.add('has-file');
        }
    }

    initializeAuthPage() {
        document.querySelectorAll('.password-toggle-new').forEach((button) => {
            button.addEventListener('click', () => {
                const input = button.closest('.password-input-wrapper-new')?.querySelector('input');
                if (input) input.type = input.type === 'password' ? 'text' : 'password';
            });
        });

        document.querySelectorAll('.demo-account').forEach((button) => {
            button.addEventListener('click', () => {
                const form = button.closest('.screens-container-new')?.querySelector('form[data-action="sign-in"]');
                const emailInput = form?.querySelector('input[name="email"]');
                const passwordInput = form?.querySelector('input[name="password"]');
                if (emailInput) emailInput.value = button.getAttribute('data-demo-email') || '';
                if (passwordInput) passwordInput.value = button.getAttribute('data-demo-password') || '';
                passwordInput?.focus();
            });
        });
    }

    initializeRegistrationPage() {
        const registration = document.querySelector('.screens-container-new .register-screen-new');
        if (!registration) return;

        const otpInputs = Array.from(document.querySelectorAll('.otp-input-new'));
        const verifyButton = document.querySelector('form[data-action="register-step2"] .btn-continue-new');

        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 1);
                if (e.target.value && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
                if (verifyButton) {
                    verifyButton.disabled = !otpInputs.every(field => field.value);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });
        });

        document.querySelector('.btn-continue-to-password-new')?.addEventListener('click', () => {
            this.showRegistrationScreen(4);
        });

        document.querySelector('[data-fill-signup]')?.addEventListener('click', () => {
            const example = mockData.mockAuth?.signupExample;
            const form = document.querySelector('form[data-action="register-step1"]');
            if (!example || !form) return;

            const emailInput = form.querySelector('input[name="email"]');
            const phoneInput = form.querySelector('input[name="phone"]');
            if (emailInput) emailInput.value = example.email;
            if (phoneInput) phoneInput.value = example.phone;
        });

        const passwordInput = document.querySelector('.password-input-new');
        const confirmInput = document.querySelector('.confirm-password-new');
        const termsInput = document.querySelector('input[name="termsAccepted"]');
        [passwordInput, confirmInput, termsInput].forEach((input) => {
            input?.addEventListener('input', () => this.updateRegistrationPasswordState());
            input?.addEventListener('change', () => this.updateRegistrationPasswordState());
        });
    }

    initializeEkycPage() {
        const ekycForm = document.querySelector('.ekyc-form');
        if (!ekycForm) return;

        const savedProfile = mockData.eKycProfile || {};
        const isUpdateMode = ekycForm.dataset.ekycMode === 'update';
        if (isUpdateMode && savedProfile.registryRecord && ekycForm.dataset.registryFetched === 'true') {
            mockData.eKycRegistryRecord = savedProfile.registryRecord;
        }

        const getEntityType = () => ekycForm.querySelector('input[name="entityType"]:checked')?.value || 'individual';
        const getBusinessRegistrationSource = () => ekycForm.querySelector('input[name="businessRegistrationSource"]:checked')?.value || 'tin';

        const showEkycStep = (stepNumber) => {
            ekycForm.querySelectorAll('[data-ekyc-step]').forEach((panel) => {
                panel.classList.toggle('active', panel.getAttribute('data-ekyc-step') === String(stepNumber));
            });

            document.querySelectorAll('[data-step-indicator]').forEach((indicator) => {
                const indicatorStep = Number(indicator.getAttribute('data-step-indicator'));
                indicator.classList.toggle('active', indicatorStep === stepNumber);
                indicator.classList.toggle('completed', indicatorStep < stepNumber);
            });

            if (stepNumber === 4) this.updateEkycCompleteSummary(ekycForm);
            document.querySelector('.ekyc-main')?.scrollTo({ top: 0, behavior: 'smooth' });
        };

        const syncEntityFields = () => {
            const entityType = getEntityType();
            const businessSource = getBusinessRegistrationSource();
            const usesBusinessTin = entityType === 'business' && businessSource === 'tin';
            const usesBusinessBrela = entityType === 'business' && businessSource === 'brela';
            const config = this.getEkycRegistryConfig(entityType, ekycForm);
            ekycForm.querySelectorAll('.business-registry-fields').forEach(field => field.classList.toggle('ekyc-hidden', entityType !== 'business'));
            ekycForm.querySelectorAll('.individual-fields').forEach(field => field.classList.toggle('ekyc-hidden', entityType !== 'individual' && !usesBusinessTin));
            ekycForm.querySelectorAll('.company-fields').forEach(field => field.classList.toggle('ekyc-hidden', entityType !== 'company'));
            ekycForm.querySelectorAll('.business-fields').forEach(field => field.classList.toggle('ekyc-hidden', !usesBusinessBrela));

            const title = document.querySelector('[data-registry-title]');
            const copy = document.querySelector('[data-registry-copy]');
            const source = document.querySelector('[data-registry-source]');
            const hint = document.querySelector('[data-registry-hint]');
            if (title) title.textContent = config.title;
            if (copy) copy.textContent = config.copy;
            if (source) source.textContent = config.sourceLabel;
            if (hint) hint.textContent = `The lookup is mocked in this UI. Click fetch to show the ${config.source} record the user must verify.`;
        };

        const resetRegistryReview = () => {
            const review = ekycForm.querySelector('[data-registry-review]');
            const registryVerified = ekycForm.querySelector('input[name="registryVerified"]');
            review?.classList.add('ekyc-hidden');
            ekycForm.dataset.registryFetched = '';
            mockData.eKycRegistryRecord = null;
            if (registryVerified) registryVerified.checked = false;
            registryVerified?.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const restoreSavedRegistryReview = () => {
            const registryVerified = ekycForm.querySelector('input[name="registryVerified"]');
            const savedRecord = savedProfile.registryRecord;
            if (!savedRecord) return;
            mockData.eKycRegistryRecord = savedRecord;
            ekycForm.dataset.registryFetched = 'true';
            if (registryVerified) registryVerified.checked = Boolean(savedProfile.registryVerified || savedRecord.reference);
            registryVerified?.dispatchEvent(new Event('change', { bubbles: true }));
            ekycForm.querySelector('[data-registry-review]')?.classList.remove('ekyc-hidden');
        };

        ekycForm.querySelectorAll('.ekyc-role-card').forEach((card) => {
            card.addEventListener('click', () => {
                const input = card.querySelector('input[type="radio"]');
                if (!input) return;
                input.checked = true;
                const groupCards = ekycForm.querySelectorAll(`input[name="${input.name}"]`);
                groupCards.forEach(item => item.closest('.ekyc-role-card')?.classList.remove('selected'));
                card.classList.add('selected');

                if (input.name === 'entityType') {
                    syncEntityFields();
                    resetRegistryReview();
                }

                if (input.name === 'businessRegistrationSource') {
                    syncEntityFields();
                    resetRegistryReview();
                }
            });
        });

        syncEntityFields();

        ekycForm.querySelectorAll('input[name="tinNumber"], input[name="brelaNumber"], input[name="businessNumber"]').forEach((input) => {
            input.addEventListener('input', () => {
                const verifiedValue = input.dataset.verifiedValue || '';
                if (isUpdateMode && verifiedValue && input.value.trim() === verifiedValue) {
                    restoreSavedRegistryReview();
                    return;
                }
                resetRegistryReview();
            });
        });

        ekycForm.querySelector('[data-fetch-registry]')?.addEventListener('click', () => {
            this.fetchMockRegistryRecord(ekycForm);
        });

        ekycForm.querySelectorAll('[data-ekyc-next]').forEach((button) => {
            button.addEventListener('click', () => {
                const panel = button.closest('[data-ekyc-step]');
                const currentStep = Number(panel?.getAttribute('data-ekyc-step') || 1);
                if (this.validateEkycStep(ekycForm, currentStep)) {
                    showEkycStep(Math.min(currentStep + 1, 4));
                }
            });
        });

        ekycForm.querySelectorAll('[data-ekyc-prev]').forEach((button) => {
            button.addEventListener('click', () => {
                const panel = button.closest('[data-ekyc-step]');
                const currentStep = Number(panel?.getAttribute('data-ekyc-step') || 1);
                showEkycStep(Math.max(currentStep - 1, 1));
            });
        });

        const signatureName = ekycForm.querySelector('input[name="signatureName"]');
        const signatureTitle = ekycForm.querySelector('input[name="signatureTitle"]');
        const signaturePreview = document.getElementById('signature-preview');
        const resetSignatureConfirmationIfChanged = () => {
            if (!isUpdateMode) return;
            const nameChanged = (signatureName?.value.trim() || '') !== (signatureName?.dataset.verifiedValue || '');
            const titleChanged = (signatureTitle?.value.trim() || '') !== (signatureTitle?.dataset.verifiedValue || '');
            if (!nameChanged && !titleChanged) return;

            const signatureConsent = ekycForm.querySelector('input[name="signatureConsent"]');
            if (signatureConsent?.checked) {
                signatureConsent.checked = false;
                signatureConsent.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        signatureName?.addEventListener('input', () => {
            const value = signatureName.value.trim();
            signaturePreview.innerHTML = value
                ? `<strong>${value}</strong><span>Digitally signed on ProcureX</span>`
                : '<span>Typed signature preview</span>';
            resetSignatureConfirmationIfChanged();
        });

        signatureTitle?.addEventListener('input', resetSignatureConfirmationIfChanged);

        document.getElementById('save-ekyc-draft')?.addEventListener('click', () => {
            this.saveEkycProfile(ekycForm, 'draft');
            alert('Identity verification draft saved.');
        });
    }

    initializeIamProfilePage() {
        const form = document.querySelector('[data-iam-profile-form]');
        if (!form || form.dataset.ready === 'true') return;

        const profile = mockData.eKycProfile || {};
        const entityType = profile.entityType || 'individual';

        const syncEntityVisibility = () => {
            const allowed = entityType === 'individual'
                ? ['all', 'individual']
                : ['all', 'organization', entityType];
            form.querySelectorAll('[data-iam-field-wrap]').forEach((field) => {
                const fieldEntity = field.dataset.iamEntity || 'all';
                field.classList.toggle('iam-hidden', !allowed.includes(fieldEntity));
            });
        };

        const syncCompletion = () => {
            const completion = this.computeIamProfileCompletion(entityType, this.collectIamProfileData(form));
            const percentOutput = form.querySelector('[data-iam-completion-percent]');
            const fill = form.querySelector('[data-iam-completion-fill]');
            const copy = form.querySelector('[data-iam-completion-copy]');
            if (percentOutput) percentOutput.textContent = `${completion.percent}%`;
            if (fill) fill.style.width = `${completion.percent}%`;
            if (copy) copy.textContent = `${completion.completed} of ${completion.total} required entity fields complete`;
            Object.entries(completion.sectionStatus).forEach(([section, status]) => {
                const panel = form.querySelector(`[data-iam-panel="${section}"]`);
                const badge = panel?.querySelector('.iam-section-heading > .badge');
                if (!badge) return;
                const done = status.total === 0 || status.completed >= status.total;
                badge.className = `badge ${done ? 'badge-success' : 'badge-warning'}`;
                badge.textContent = `${status.completed}/${status.total} required`;
            });
        };

        form.querySelectorAll('[data-iam-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                const target = button.dataset.iamTab;
                form.querySelectorAll('[data-iam-tab]').forEach(item => item.classList.toggle('active', item === button));
                form.querySelectorAll('[data-iam-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.iamPanel === target));
            });
        });

        form.querySelectorAll('[data-iam-upload-input]').forEach((input) => {
            input.addEventListener('change', () => {
                const fieldName = input.dataset.iamUploadInput;
                const fileName = input.files?.[0]?.name || '';
                const hidden = form.querySelector(`input[type="hidden"][name="${CSS.escape(fieldName)}"]`);
                const output = form.querySelector(`[data-iam-upload-name="${CSS.escape(fieldName)}"]`);
                if (hidden) hidden.value = fileName;
                if (output) output.textContent = fileName ? `Selected: ${fileName}` : 'No file selected yet.';
                syncCompletion();
            });
        });

        form.querySelectorAll('[data-iam-field]').forEach((field) => {
            field.addEventListener('input', syncCompletion);
            field.addEventListener('change', syncCompletion);
        });

        form.querySelector('[data-iam-save-profile]')?.addEventListener('click', () => {
            this.saveIamProfileData(form);
            syncCompletion();
            const saveStatus = form.querySelector('[data-iam-save-status]');
            if (saveStatus) {
                saveStatus.textContent = `Draft saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                saveStatus.classList.add('saved');
                window.setTimeout(() => saveStatus.classList.remove('saved'), 2200);
            }
        });

        syncEntityVisibility();
        syncCompletion();
        form.dataset.ready = 'true';
    }

    collectIamProfileData(form) {
        const data = {};
        form.querySelectorAll('[data-iam-field]').forEach((field) => {
            const name = field.getAttribute('name');
            if (!name) return;
            if (field.type === 'checkbox' && field.closest('.iam-multi-list')) {
                if (!Object.prototype.hasOwnProperty.call(data, name)) data[name] = [];
                if (field.checked) data[name].push(field.value);
            } else if (field.matches('select[multiple]')) {
                data[name] = Array.from(field.selectedOptions).map(option => option.value).join(', ');
            } else if (field.type === 'checkbox') {
                data[name] = field.checked;
            } else {
                data[name] = field.value;
            }
        });
        Object.keys(data).forEach((key) => {
            if (Array.isArray(data[key])) data[key] = data[key].join(', ');
        });
        return data;
    }

    saveIamProfileData(form) {
        const profile = mockData.eKycProfile || {};
        mockData.eKycProfile = {
            ...profile,
            iamProfile: {
                ...(profile.iamProfile || {}),
                ...this.collectIamProfileData(form),
                savedAt: new Date().toISOString()
            }
        };
    }

    computeIamProfileCompletion(entityType = 'individual', data = {}) {
        const visibleEntities = entityType === 'individual'
            ? ['all', 'individual']
            : ['all', 'organization', entityType];
        const requiredFields = [
            ['account', 'fullName', 'all'],
            ['account', 'emailAddress', 'all'],
            ['account', 'phoneNumber', 'all'],
            ['account', 'country', 'all'],
            ['entity', 'individualDisplayName', 'individual'],
            ['entity', 'companyName', 'organization'],
            ['entity', 'companyType', 'organization'],
            ['entity', 'registrationNumber', 'company'],
            ['entity', 'tinNumber', 'all'],
            ['entity', 'businessDescription', 'all'],
            ['entity', 'physicalAddress', 'all'],
            ['entity', 'entityCountry', 'all'],
            ['entity', 'regionDistrict', 'all'],
            ['classification', 'industry', 'all'],
            ['classification', 'procurementCategories', 'all'],
            ['classification', 'localInternational', 'all'],
            ['contacts', 'contactPerson', 'all'],
            ['contacts', 'officialEmail', 'all'],
            ['contacts', 'officialPhone', 'all'],
            ['documents', 'certificateOfIncorporation', 'company'],
            ['documents', 'businessLicense', 'business'],
            ['documents', 'tinCertificate', 'all']
        ].filter(([, , fieldEntity]) => visibleEntities.includes(fieldEntity));

        const sectionStatus = {};
        requiredFields.forEach(([section, name]) => {
            if (!sectionStatus[section]) sectionStatus[section] = { completed: 0, total: 0, percent: 0 };
            sectionStatus[section].total += 1;
            const value = data[name];
            const complete = typeof value === 'boolean' ? value : String(value || '').trim().length > 0;
            if (complete) sectionStatus[section].completed += 1;
        });

        ['account', 'entity', 'classification', 'contacts', 'documents', 'financial', 'capacity', 'settings'].forEach((section) => {
            if (!sectionStatus[section]) sectionStatus[section] = { completed: 0, total: 0, percent: 100 };
            const status = sectionStatus[section];
            status.percent = status.total ? Math.round((status.completed / status.total) * 100) : 100;
        });

        const completed = requiredFields.reduce((count, [, name]) => {
            const value = data[name];
            const complete = typeof value === 'boolean' ? value : String(value || '').trim().length > 0;
            return count + (complete ? 1 : 0);
        }, 0);
        const total = Math.max(requiredFields.length, 1);
        return {
            completed,
            total,
            percent: Math.round((completed / total) * 100),
            sectionStatus
        };
    }

    handleFormAction(action, form) {
        switch (action) {
            case 'register-step1':
                this.handleRegisterStep1(form);
                break;
            case 'register-step2':
                this.handleRegisterStep2(form);
                break;
            case 'register-step4':
                this.handleRegisterStep4(form);
                break;
            case 'sign-in':
                this.handleSignIn(form);
                break;
            case 'complete-ekyc':
                this.handleEkycCompletion(form);
                break;
            case 'register-account':
                this.handleAccountRegistration(form);
                break;
            case 'verify-otp':
                this.handleOTPVerification(form);
                break;
            case 'upload-documents':
                this.handleDocumentUpload(form);
                break;
            case 'create-tender':
                this.handleTenderCreation(form);
                break;
            case 'submit-bid':
                this.handleBidSubmission(form);
                break;
            case 'contact-support':
                this.handleContactSupport(form);
                break;
            default:
                console.log('Unknown action:', action);
        }
    }

    handleRegisterStep1(form) {
        const email = form.querySelector('input[name="email"]')?.value.trim();
        const phone = form.querySelector('input[name="phone"]')?.value.trim();

        if (!this.isValidEmail(email)) {
            this.showFormError(form.querySelector('input[name="email"]'), 'Enter a valid email address.');
            return;
        }

        if (!phone || phone.replace(/\D/g, '').length < 9) {
            this.showFormError(form.querySelector('input[name="phone"]'), 'Enter a valid mobile number.');
            return;
        }

        mockData.registrationDraft = { email, phone };
        this.clearFormErrors(form);
        this.showRegistrationScreen(2);
        this.startRegistrationTimer();

        const phoneDisplay = document.getElementById('phone-display');
        if (phoneDisplay) phoneDisplay.textContent = phone;
        document.querySelector('.otp-input-new')?.focus();
    }

    handleRegisterStep2(form) {
        const otpInputs = Array.from(form.querySelectorAll('.otp-input-new'));
        const otp = otpInputs.map(input => input.value).join('');

        if (otp.length !== 6) {
            this.showFormError(form.querySelector('.otp-container-new'), 'Enter all 6 digits.');
            return;
        }

        this.clearFormErrors(form);
        if (this.registrationTimer) clearInterval(this.registrationTimer);
        this.showRegistrationScreen(3);

        const emailDisplay = document.getElementById('email-display');
        if (emailDisplay) emailDisplay.textContent = mockData.registrationDraft.email;
    }

    handleRegisterStep4(form) {
        const password = form.querySelector('input[name="password"]')?.value;
        const confirmPassword = form.querySelector('input[name="confirmPassword"]')?.value;
        const termsAccepted = form.querySelector('input[name="termsAccepted"]')?.checked;

        if (!this.isRegistrationPasswordValid(password)) {
            alert('Password must meet all strength requirements.');
            return;
        }

        if (password !== confirmPassword) {
            this.showFormError(form.querySelector('input[name="confirmPassword"]'), 'Passwords do not match.');
            return;
        }

        if (!termsAccepted) {
            alert('Please accept the terms before creating the account.');
            return;
        }

        mockData.pendingAccount = {
            email: mockData.registrationDraft.email,
            phone: mockData.registrationDraft.phone,
            password,
            role: null,
            accountType: 'new user',
            isNewUser: true,
            ekycCompleted: false
        };

        this.upsertMockAuthAccount(mockData.pendingAccount);

        mockData.session = {
            isAuthenticated: false,
            isNewUser: true,
            email: mockData.pendingAccount.email
        };
        mockData.eKycProfile = { status: 'not_started', role: null };

        this.showRegistrationScreen(5);
    }

    handleSignIn(form) {
        const email = form.querySelector('input[name="email"]')?.value.trim();
        const password = form.querySelector('input[name="password"]')?.value;
        const account = this.findMockAuthAccount(email);

        if (!this.isValidEmail(email) || !password) {
            alert('Enter your email and password.');
            return;
        }

        if (!account || account.password !== password) {
            alert('These credentials do not match any mock account.');
            return;
        }

        mockData.pendingAccount = account;
        mockData.session = {
            isAuthenticated: true,
            isNewUser: !account.ekycCompleted,
            email,
            accountType: account.accountType || 'user'
        };

        if (account.accountType === 'admin' || account.role === 'admin') {
            this.navigateTo('admin-dashboard');
            return;
        }

        if (mockData.session.isNewUser) {
            this.navigateTo('identity-verification');
            return;
        }

        this.navigateTo('workspace-dashboard');
    }

    handleEkycCompletion(form) {
        const isUpdateMode = form.dataset.ekycMode === 'update';
        for (let step = 1; step <= 3; step += 1) {
            if (!this.validateEkycStep(form, step)) {
                const targetPanel = form.querySelector(`[data-ekyc-step="${step}"]`);
                form.querySelectorAll('[data-ekyc-step]').forEach((panel) => {
                    panel.classList.toggle('active', panel === targetPanel);
                });
                document.querySelectorAll('[data-step-indicator]').forEach((indicator) => {
                    const indicatorStep = Number(indicator.getAttribute('data-step-indicator'));
                    indicator.classList.toggle('active', indicatorStep === step);
                    indicator.classList.toggle('completed', indicatorStep < step);
                });
                targetPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }

        if (!mockData.eKycRegistryRecord) {
            alert('Fetch and verify registry information before completing identity verification.');
            return;
        }

        this.saveEkycProfile(form, 'completed');
        mockData.pendingAccount = {
            ...(mockData.pendingAccount || {}),
            role: null,
            accountType: 'existing user',
            isNewUser: false,
            ekycCompleted: true,
            displayName: mockData.eKycProfile.verifiedName || mockData.pendingAccount?.displayName
        };
        this.upsertMockAuthAccount(mockData.pendingAccount);
        mockData.session.isNewUser = false;

        this.navigateTo(isUpdateMode ? 'account-profile' : 'app-launcher');
    }

    getEkycRegistryConfig(entityType, form = null) {
        if (entityType === 'company') {
            return {
                applicantLabel: 'Company',
                source: 'BRELA',
                sourceLabel: 'BRELA company lookup',
                title: 'Enter BRELA company number',
                copy: 'Company details will be fetched from BRELA and shown here for user confirmation.',
                inputSelector: 'input[name="brelaNumber"]',
                missingMessage: 'Enter the BRELA company number.'
            };
        }

        if (entityType === 'business') {
            const root = form || (typeof document !== 'undefined' ? document : null);
            const businessSource = root?.querySelector('input[name="businessRegistrationSource"]:checked')?.value || 'tin';

            if (businessSource === 'brela') {
                return {
                    applicantLabel: 'Business',
                    registrationMethod: 'BRELA number',
                    source: 'BRELA',
                    sourceLabel: 'BRELA business lookup',
                    title: 'Enter BRELA business number',
                    copy: 'Business registration details will be fetched from BRELA and shown here for user confirmation.',
                    inputSelector: 'input[name="businessNumber"]',
                    missingMessage: 'Enter the BRELA business number.'
                };
            }

            return {
                applicantLabel: 'Business',
                registrationMethod: 'Local Government / TIN',
                source: 'TRA',
                sourceLabel: 'Local Government / TIN lookup',
                title: 'Enter registered TIN number',
                copy: 'Local government business registration will be verified through the registered TIN number and shown here for confirmation.',
                inputSelector: 'input[name="tinNumber"]',
                missingMessage: 'Enter the registered TIN number.'
            };
        }

        return {
            applicantLabel: 'Individual',
            source: 'TRA',
            sourceLabel: 'TRA lookup',
            title: 'Enter TIN number',
            copy: 'TRA details will be fetched for the individual and shown here for confirmation.',
            inputSelector: 'input[name="tinNumber"]',
            missingMessage: 'Enter the TIN number.'
        };
    }

    saveEkycProfile(form, status) {
        const formData = new FormData(form);
        const previousProfile = mockData.eKycProfile || {};
        const entityType = formData.get('entityType') || 'individual';
        const registryConfig = this.getEkycRegistryConfig(entityType, form);
        const registryRecord = mockData.eKycRegistryRecord || mockData.eKycProfile?.registryRecord || {};

        mockData.eKycProfile = {
            status,
            role: null,
            entityType,
            businessRegistrationSource: entityType === 'business' ? (formData.get('businessRegistrationSource') || 'tin') : '',
            businessRegistrationMethod: entityType === 'business' ? (registryConfig.registrationMethod || registryConfig.sourceLabel) : '',
            tinNumber: formData.get('tinNumber') || '',
            brelaNumber: formData.get('brelaNumber') || '',
            businessNumber: formData.get('businessNumber') || '',
            registrySource: registryConfig.source,
            registryVerified: formData.get('registryVerified') === 'on',
            registryRecord,
            verifiedName: registryRecord.name || '',
            verifiedStatus: registryRecord.status || '',
            signatureName: formData.get('signatureName') || '',
            signatureTitle: formData.get('signatureTitle') || '',
            signatureConsent: formData.get('signatureConsent') === 'on',
            signatureAnchor: 'pending_blockchain_anchor',
            iamProfile: previousProfile.iamProfile || {}
        };
    }

    validateEkycStep(form, step) {
        this.clearFormErrors(form);

        if (step === 1) {
            const entityType = form.querySelector('input[name="entityType"]:checked');
            if (!entityType) {
                alert('Choose whether the applicant is an individual, company, or business.');
                return false;
            }
            return true;
        }

        if (step === 2) {
            const entityType = form.querySelector('input[name="entityType"]:checked')?.value || 'individual';
            const registryConfig = this.getEkycRegistryConfig(entityType, form);
            const registryInput = form.querySelector(registryConfig.inputSelector);
            const registryValue = registryInput?.value.trim();
            const registryVerified = form.querySelector('input[name="registryVerified"]')?.checked;

            if (!registryValue) {
                this.showFormError(registryInput, registryConfig.missingMessage);
                registryInput?.focus();
                return false;
            }

            if (form.dataset.registryFetched !== 'true') {
                alert('Fetch the registry information before continuing.');
                return false;
            }

            if (!registryVerified) {
                alert('Confirm that the fetched registry information is correct.');
                return false;
            }

            return true;
        }

        if (step === 3) {
            const signatureName = form.querySelector('input[name="signatureName"]');
            const signatureConsent = form.querySelector('input[name="signatureConsent"]')?.checked;

            if (!signatureName?.value.trim()) {
                this.showFormError(signatureName, 'Enter the signer full name.');
                signatureName?.focus();
                return false;
            }

            if (!signatureConsent) {
                alert('Confirm the digital signature authorization.');
                return false;
            }

            return true;
        }

        return true;
    }

    renderEkycRegistrySummary(record = {}) {
        const rows = Array.isArray(record.summaryRows) && record.summaryRows.length
            ? record.summaryRows
            : [
                ['Source', record.source],
                ['Reference', record.reference],
                ['Status', record.status],
                ['Registered', record.registeredOn],
                ['Location', record.location]
            ];

        return rows
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
            .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
            .join('');
    }

    createTraRegistryRecord(reference, overrides = {}) {
        const record = {
            source: 'TRA',
            reference,
            tin: reference,
            name: 'Mariam Saidi Nyoni',
            email: 'mariam.nyoni@example.co.tz',
            mobileNumber: '0718 462 390',
            physicalAddress: 'Plot 24, Mbezi Beach, Dar es Salaam',
            postalAddress: 'P.O. Box 20418',
            firstName: 'Mariam',
            middleName: 'Saidi',
            lastName: 'Nyoni',
            title: 'MS',
            gender: 'Female',
            dateOfBirth: '12/09/1991',
            businessType: 'Sole Proprietor',
            entityType: 'Individual',
            status: 'CER',
            taxRegion: 'DSM',
            registeredOn: '18/05/2022 09:34:21',
            numberOfEmployees: '1',
            location: 'Dar es Salaam, Tanzania',
            ...overrides
        };

        record.summaryRows = [
            ['Name', record.name],
            ["Taxpayer's Identification Number (TIN)", record.tin || record.reference],
            ['Email', record.email],
            ['Mobile Number', record.mobileNumber],
            ['Physical Address', record.physicalAddress],
            ['Postal Address', record.postalAddress],
            ['First Name', record.firstName],
            ['Middle Name', record.middleName],
            ['Last Name', record.lastName],
            ['Title', record.title],
            ['Gender', record.gender],
            ['Date of Birth', record.dateOfBirth],
            ['Business Type', record.businessType],
            ['Entity Type', record.entityType],
            ['TIN Status', record.status],
            ['Tax Region', record.taxRegion],
            ['Registration Date', record.registeredOn],
            ['Number of Employees', record.numberOfEmployees]
        ];

        return record;
    }

    fetchMockRegistryRecord(form) {
        const entityType = form.querySelector('input[name="entityType"]:checked')?.value || 'individual';
        const registryConfig = this.getEkycRegistryConfig(entityType, form);
        const input = form.querySelector(registryConfig.inputSelector);
        const reference = input?.value.trim();

        if (!reference) {
            this.showFormError(input, registryConfig.missingMessage.replace('.', ' first.'));
            input?.focus();
            return;
        }

        const recordKey = entityType === 'business' && registryConfig.source === 'TRA' ? 'businessTin' : entityType;
        const mockRecords = {
            individual: this.createTraRegistryRecord(reference),
            company: {
                source: 'BRELA',
                reference,
                name: 'Kilimanjaro Supplies Limited',
                status: 'Active company',
                registeredOn: '2021-08-14',
                location: 'Dar es Salaam, Tanzania'
            },
            business: {
                source: 'BRELA',
                reference,
                name: 'Mwanza Office Traders',
                status: 'Active business name',
                registeredOn: '2022-11-03',
                location: 'Mwanza, Tanzania'
            },
            businessTin: this.createTraRegistryRecord(reference, {
                name: 'Zahra Omari Trading',
                email: 'accounts@zahraomari.example.co.tz',
                mobileNumber: '0764 210 558',
                physicalAddress: 'Shop 8, Sokoine Road, Arusha',
                postalAddress: 'P.O. Box 6112',
                firstName: 'Zahra',
                middleName: 'Omari',
                lastName: 'Msuya',
                title: 'MRS',
                gender: 'Female',
                dateOfBirth: '03/02/1988',
                businessType: 'Sole Proprietor',
                entityType: 'Business',
                taxRegion: 'ARU',
                registeredOn: '22/11/2020 14:16:08',
                numberOfEmployees: '4',
                location: 'Arusha, Tanzania'
            })
        };

        const record = mockRecords[recordKey] || mockRecords.individual;

        mockData.eKycRegistryRecord = record;
        form.dataset.registryFetched = 'true';

        const review = form.querySelector('[data-registry-review]');
        const kicker = form.querySelector('[data-registry-kicker]');
        const name = form.querySelector('[data-registry-name]');
        const summary = form.querySelector('[data-registry-summary]');
        if (kicker) kicker.textContent = record.source === 'TRA' ? 'TRA Information (Fetched)' : 'Fetched information';
        if (name) name.textContent = record.name;
        if (summary) summary.innerHTML = this.renderEkycRegistrySummary(record);
        review?.classList.remove('ekyc-hidden');
    }

    updateEkycCompleteSummary(form) {
        const entityType = form.querySelector('input[name="entityType"]:checked')?.value || 'individual';
        const registryConfig = this.getEkycRegistryConfig(entityType, form);
        const signatureName = form.querySelector('input[name="signatureName"]')?.value.trim() || 'Prepared';
        const registryRecord = mockData.eKycRegistryRecord;
        const summary = form.querySelector('[data-ekyc-complete-summary]');
        if (!summary) return;

        summary.innerHTML = `
            <div><span>Applicant type</span><strong>${registryConfig.applicantLabel}</strong></div>
            ${registryConfig.registrationMethod ? `<div><span>Registration method</span><strong>${registryConfig.registrationMethod}</strong></div>` : ''}
            <div><span>Registry source</span><strong>${registryConfig.source}</strong></div>
            <div><span>Verified name</span><strong>${registryRecord?.name || 'Pending review'}</strong></div>
            <div><span>Signature</span><strong>${signatureName}</strong></div>
            <div><span>Blockchain anchor</span><strong>Pending implementation</strong></div>
        `;
    }

    showRegistrationScreen(screenNumber) {
        document.querySelectorAll('.register-screen-new').forEach((screen) => {
            screen.classList.toggle('active', screen.getAttribute('data-screen') === String(screenNumber));
        });

        document.querySelectorAll('.progress-step-new').forEach((step) => {
            const stepNumber = Number(step.getAttribute('data-step'));
            step.classList.toggle('active', stepNumber === screenNumber);
            step.classList.toggle('completed', stepNumber < screenNumber || screenNumber === 5);
        });
    }

    startRegistrationTimer() {
        if (this.registrationTimer) clearInterval(this.registrationTimer);

        let remaining = 30;
        const timer = document.getElementById('timer');
        const resendButton = document.getElementById('resend-otp-btn');
        if (timer) timer.textContent = remaining;
        if (resendButton) resendButton.disabled = true;

        this.registrationTimer = setInterval(() => {
            remaining -= 1;
            if (timer) timer.textContent = Math.max(remaining, 0);

            if (remaining <= 0) {
                clearInterval(this.registrationTimer);
                if (resendButton) resendButton.disabled = false;
            }
        }, 1000);
    }

    updateRegistrationPasswordState() {
        const password = document.querySelector('.password-input-new')?.value || '';
        const confirmPassword = document.querySelector('.confirm-password-new')?.value || '';
        const termsAccepted = document.querySelector('input[name="termsAccepted"]')?.checked;
        const submitButton = document.querySelector('.btn-create-new');

        const checks = {
            length: password.length >= 8 && password.length <= 12,
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^and*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
        };

        Object.entries(checks).forEach(([name, isMet]) => {
            const item = document.querySelector(`[data-requirement="${name}"]`);
            if (!item) return;
            item.classList.toggle('met', isMet);
            const icon = item.querySelector('.requirement-icon-new');
            if (icon) icon.textContent = isMet ? 'OK' : 'o';
        });

        const metCount = Object.values(checks).filter(Boolean).length;
        const strengthFill = document.querySelector('.strength-fill-new');
        const strengthText = document.querySelector('.strength-text-new strong');
        if (strengthFill) strengthFill.style.width = `${(metCount / 4) * 100}%`;
        if (strengthText) {
            strengthText.textContent = metCount <= 1 ? 'Weak' : metCount < 4 ? 'Medium' : 'Strong';
        }

        if (submitButton) {
            submitButton.disabled = !this.isRegistrationPasswordValid(password) || password !== confirmPassword || !termsAccepted;
        }
    }

    isRegistrationPasswordValid(password) {
        return Boolean(
            password &&
            password.length >= 8 &&
            password.length <= 12 &&
            /[A-Z]/.test(password) &&
            /\d/.test(password) &&
            /[!@#$%^and*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
        );
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
    }

    findMockAuthAccount(email) {
        const normalizedEmail = (email || '').toLowerCase();
        const accounts = mockData.mockAuth?.accounts || [];
        return accounts.find(account => account.email.toLowerCase() === normalizedEmail) || null;
    }

    upsertMockAuthAccount(account) {
        if (!account?.email || !mockData.mockAuth?.accounts) return;

        const accounts = mockData.mockAuth.accounts;
        const index = accounts.findIndex(item => item.email.toLowerCase() === account.email.toLowerCase());
        const nextAccount = {
            displayName: account.displayName || account.email,
            phone: account.phone || '',
            password: account.password,
            role: account.role || null,
            accountType: account.accountType || (account.role === 'admin' ? 'admin' : account.ekycCompleted ? 'existing user' : 'new user'),
            isNewUser: account.isNewUser ?? !account.ekycCompleted,
            ekycCompleted: Boolean(account.ekycCompleted),
            email: account.email
        };

        if (index >= 0) {
            accounts[index] = { ...accounts[index], ...nextAccount };
            return;
        }

        accounts.unshift(nextAccount);
    }

    showFormError(target, message) {
        const wrapper = target?.closest('.form-group-new, .form-group');
        const error = wrapper?.querySelector('.form-error-new, .form-error');
        if (error) {
            error.textContent = message;
            error.classList.add('show');
            error.style.display = 'block';
        }
    }

    clearFormErrors(form) {
        form.querySelectorAll('.form-error-new, .form-error').forEach((error) => {
            error.textContent = '';
            error.classList.remove('show');
            error.style.display = '';
        });
    }

    handleAccountRegistration(form) {
        // Validate form
        const fullName = form.querySelector('input[name="fullName"]').value;
        const email = form.querySelector('input[name="email"]').value;
        const phone = form.querySelector('input[name="phone"]').value;
        const password = form.querySelector('input[name="password"]').value;
        const confirmPassword = form.querySelector('input[name="confirmPassword"]').value;
        const termsAccepted = form.querySelector('input[name="termsAccepted"]').checked;

        // Basic validation
        if (!fullName || !email || !phone || !password || !confirmPassword) {
            alert('Please fill in all required fields');
            return;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (!termsAccepted) {
            alert('Please accept the Terms of Service and Privacy Policy');
            return;
        }

        // Simulate account registration
        console.log('Registering account:', {
            fullName,
            email,
            phone,
            accountType: 'user'
        });

        setTimeout(() => {
            // Navigate to identity verification after successful registration
            this.navigateTo('identity-verification');
        }, 1000);
    }

    handleOTPVerification(form) {
        const otp = Array.from(form.querySelectorAll('.otp-input')).map(input => input.value).join('');
        if (otp.length === 6) {
            // Simulate verification
            setTimeout(() => {
                this.navigateTo('account-profile');
            }, 1000);
        }
    }

    handleDocumentUpload(form) {
        // Simulate upload
        setTimeout(() => {
            this.navigateTo('account-profile');
        }, 1000);
    }

    handleTenderCreation(form) {
        // Simulate tender creation
        setTimeout(() => {
            this.navigateTo('tender-publication');
        }, 1000);
    }

    handleBidSubmission(form) {
        // Simulate bid submission
        setTimeout(() => {
            alert('Bid submitted successfully!');
        }, 1000);
    }

    handleContactSupport(form) {
        const email = form.querySelector('input[name="email"]')?.value.trim();
        const message = form.querySelector('textarea[name="message"]')?.value.trim();
        const consent = form.querySelector('input[name="contactConsent"]')?.checked;
        const status = form.querySelector('[data-contact-form-status]');
        status?.classList.remove('success');

        if (!this.isValidEmail(email)) {
            if (status) status.textContent = 'Enter a valid email address before submitting your request.';
            form.querySelector('input[name="email"]')?.focus();
            return;
        }

        if (!message) {
            if (status) status.textContent = 'Add a short message describing your request.';
            form.querySelector('textarea[name="message"]')?.focus();
            return;
        }

        if (!consent) {
            if (status) status.textContent = 'Confirm that ProcureX may use these details to respond to your request.';
            form.querySelector('input[name="contactConsent"]')?.focus();
            return;
        }

        if (status) {
            status.textContent = 'Request captured in this prototype. No information was sent.';
            status.classList.add('success');
        }
        form.reset();
    }

    loadAllPages() {
        // Load all page modules - render functions are registered by individual page files or available globally
        const pageNames = [
            'welcome',
            'register',
            'sign-in',
            'role-selection',
            'identity-verification',
            'account-profile',
            'app-launcher',
            'workspace-dashboard',
            'tender-planning',
            'admin-dashboard',
            'admin-search',
            'admin-users',
            'admin-compliance',
            'admin-analytics',
            'admin-audit',
            'procurement-guide',
            'guest-marketplace',
            'about-procurex',
            'privacy-policy',
            'terms-and-conditions',
            'contact',
            'marketplace',
            'tender-detail',
            'communication-center',
            'create-tender',
            'tender-publication',
            'tender-details',
            'records-history',
            'bidding-workspace',
            'bid-evaluation',
            'awarding-contracts',
            'award-recommendation',
            'contract-negotiation',
            'post-award-tracking'
        ];

        this.pages = {};
        pageNames.forEach((page) => {
            this.pages[page] = () => this.getPageRenderFunction(page);
        });
    }

    getPageRenderFunction(pageName) {
        const renderAliases = {
            'identity-verification': 'renderIamVerification',
            'account-profile': 'renderVerificationStatus',
            'marketplace': 'renderSupplierMarketplace',
            'tender-detail': 'renderSupplierTenderDetail',
            'procurement-guide': 'renderSupplierJourney'
        };
        const renderFnName = renderAliases[pageName] || 'render' + pageName.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        if (typeof window[renderFnName] === 'function') {
            return window[renderFnName]();
        }
        if (typeof window.app?.[renderFnName] === 'function' && !this.isPlaceholderRenderer(renderFnName, window.app[renderFnName])) {
            return window.app[renderFnName]();
        }
        return this.renderComingSoon();
    }

    isPlaceholderRenderer(renderFnName, renderFn) {
        return ProcureXApp.prototype[renderFnName] === renderFn;
    }

    renderComingSoon() {
        return `
            <div class="coming-soon">
                ${renderProcureXLottie('procurex-lottie procurex-lottie-md', 'ProcureX page preparation animation')}
                <h2 class="coming-soon-title">Coming Soon</h2>
                <p class="coming-soon-text">This feature is currently under development and will be available soon.</p>
                <button class="btn btn-primary" data-navigate="welcome">Back to Home</button>
            </div>
        `;
    }

    // Page render methods will be implemented in separate files
    getLoadingSpinner(pageName) {
        return `<div class="loading-container">
            <div class="loading-animation-shell">
                ${renderProcureXLottie('procurex-lottie procurex-lottie-lg', `Loading ${pageName}`)}
            </div>
            <p>Loading ${pageName}...</p>
        </div>`;
    }

    renderWelcome() { return this.getLoadingSpinner('welcome page'); }
    renderSignIn() { return this.getLoadingSpinner('sign in'); }
    renderRoleSelection() { return this.getLoadingSpinner('role selection'); }
    renderIamVerification() { return this.getLoadingSpinner('identity verification'); }
    renderIAMVerification() { return this.getLoadingSpinner('identity verification'); }
    renderVerificationStatus() { return this.getLoadingSpinner('account profile'); }
    renderWorkspaceDashboard() { return this.getLoadingSpinner('dashboard'); }
    renderTenderPlanning() { return this.getLoadingSpinner('tender planning'); }
    renderAdminDashboard() { return this.getLoadingSpinner('admin dashboard'); }
    renderAdminSearch() { return this.getLoadingSpinner('admin search'); }
    renderAdminUsers() { return this.getLoadingSpinner('admin users'); }
    renderAdminCompliance() { return this.getLoadingSpinner('admin compliance'); }
    renderAdminAnalytics() { return this.getLoadingSpinner('admin analytics'); }
    renderAdminAudit() { return this.getLoadingSpinner('admin audit'); }
    renderBuyerDashboard() { return this.getLoadingSpinner('dashboard'); }
    renderSupplierDashboard() { return this.getLoadingSpinner('dashboard'); }
    renderSupplierJourney() { return this.getLoadingSpinner('procurement process guide'); }
    renderGuestMarketplace() { return this.getLoadingSpinner('guest marketplace'); }
    renderSupplierMarketplace() { return this.getLoadingSpinner('tender marketplace'); }
    renderSupplierTenderDetail() { return this.getLoadingSpinner('tender detail'); }
    renderCommunicationCenter() { return this.getLoadingSpinner('communication center'); }
    renderCreateTender() { return this.getLoadingSpinner('create tender'); }
    renderTenderPublication() { return this.getLoadingSpinner('tender publication'); }
    renderTenderDetails() { return this.getLoadingSpinner('tender details'); }
    renderRecordsHistory() { return this.getLoadingSpinner('records history'); }
    renderBiddingWorkspace() { return this.getLoadingSpinner('bidding workspace'); }
    renderBidEvaluation() { return this.getLoadingSpinner('bid evaluation'); }
    renderAwardRecommendation() { return this.getLoadingSpinner('award recommendation'); }
    renderContractNegotiation() { return this.getLoadingSpinner('contract negotiation'); }
    renderPostAwardTracking() { return this.getLoadingSpinner('post-award tracking'); }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProcureXApp();
});
