// ProcureX marketplace API adapter for the static marketplace pages.
(function () {
    const authTokenKey = 'procurex.authToken';
    const endpointPath = '/api/procurement/marketplace';
    const fallbackGetMarketplaceTenders = window.getProcurexMarketplaceTenders;
    const fallbackGetMyTenderRows = window.getProcurexMyTenderRows;
    const fallbackGetMyBidRows = window.getProcurexMyBidRows;
    const fallbackTenderOwnership = window.isProcurexTenderOwnedByCurrentUser;
    const fallbackGetCurrentAccount = window.getProcurexCurrentAccount;

    const state = sanitizeMarketplaceState(window.procurexMarketplaceState);
    window.procurexMarketplaceState = state;

    let latestRequestId = 0;
    let hasBackendData = false;

    function sanitizeMarketplacePayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        return {
            marketplaceTenders: Array.isArray(source.tenders) ? source.tenders : [],
            myTenderRows: Array.isArray(source.myTenders) ? source.myTenders : [],
            myBidRows: Array.isArray(source.myBids) ? source.myBids : [],
            summary: source.summary && typeof source.summary === 'object' ? source.summary : {}
        };
    }

    function sanitizeMarketplaceState(source) {
        const current = source && typeof source === 'object' ? source : {};
        return {
            marketplaceTenders: Array.isArray(current.marketplaceTenders) ? current.marketplaceTenders : [],
            myTenderRows: Array.isArray(current.myTenderRows) ? current.myTenderRows : [],
            myBidRows: Array.isArray(current.myBidRows) ? current.myBidRows : [],
            summary: current.summary && typeof current.summary === 'object' ? current.summary : {},
            loading: current.loading === true,
            error: typeof current.error === 'string' ? current.error : null
        };
    }

    function applyMarketplacePayload(payload) {
        const sanitized = sanitizeMarketplacePayload(payload);
        state.marketplaceTenders = sanitized.marketplaceTenders;
        state.myTenderRows = sanitized.myTenderRows;
        state.myBidRows = sanitized.myBidRows;
        state.summary = sanitized.summary;
    }

    function getStoredAuthToken() {
        try {
            return localStorage.getItem(authTokenKey) || '';
        } catch (error) {
            return '';
        }
    }

    function getApiBaseUrl() {
        if (typeof window.PROCUREX_API_BASE_URL === 'string' && window.PROCUREX_API_BASE_URL.trim()) {
            return window.PROCUREX_API_BASE_URL.trim().replace(/\/$/, '');
        }

        const { protocol, hostname, port } = window.location;
        const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
        if (protocol === 'file:' || (localHost && port && port !== '4000')) {
            return 'http://localhost:4000';
        }

        return '';
    }

    function buildMarketplaceUrl(options = {}) {
        const base = getApiBaseUrl();
        const url = `${base}${endpointPath}`;
        const query = options.query && typeof options.query === 'object' ? options.query : {};
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && String(value) !== '') {
                params.set(key, String(value));
            }
        });
        const search = params.toString();
        return search ? `${url}?${search}` : url;
    }

    function fallbackMarketplaceTenders() {
        if (typeof fallbackGetMarketplaceTenders === 'function') {
            return fallbackGetMarketplaceTenders();
        }
        const sourceMockData = typeof mockData !== 'undefined' ? mockData : window.mockData;
        const tenders = Array.isArray(sourceMockData?.tenders) ? sourceMockData.tenders : [];
        if (typeof window.normalizeProcurexTenderOwnership === 'function') {
            return tenders.map(window.normalizeProcurexTenderOwnership);
        }
        return tenders;
    }

    function fallbackMyTenderRowsValue() {
        return typeof fallbackGetMyTenderRows === 'function' ? fallbackGetMyTenderRows() : [];
    }

    function fallbackMyBidRowsValue() {
        return typeof fallbackGetMyBidRows === 'function' ? fallbackGetMyBidRows() : [];
    }

    function dispatchMarketplaceEvent(name, detail = {}) {
        window.dispatchEvent(new CustomEvent(name, {
            detail: {
                state,
                ...detail
            }
        }));
    }

    function rerenderMarketplacePage() {
        const page = window.app?.currentPage || '';
        if (!['marketplace', 'supplier-marketplace', 'guest-marketplace'].includes(page)) return;
        if (typeof window.app?.renderPage === 'function') {
            window.app.renderPage();
        }
    }

    async function refreshProcurexMarketplaceData(options = {}) {
        const requestId = latestRequestId + 1;
        latestRequestId = requestId;
        state.loading = true;
        state.error = null;
        dispatchMarketplaceEvent('procurex:marketplace-loading', { requestId });

        try {
            const token = getStoredAuthToken();
            const headers = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(buildMarketplaceUrl(options), {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`Marketplace request failed with status ${response.status}.`);
            }

            const payload = await response.json();
            if (latestRequestId !== requestId) return state;

            applyMarketplacePayload(payload);
            hasBackendData = true;
            state.loading = false;
            state.error = null;
            dispatchMarketplaceEvent('procurex:marketplace-data', { requestId, payload, state });
            rerenderMarketplacePage();
            return state;
        } catch (error) {
            if (latestRequestId !== requestId) return state;

            state.loading = false;
            state.error = error instanceof Error ? error.message : 'Unable to load marketplace data.';
            dispatchMarketplaceEvent('procurex:marketplace-error', { requestId, error: state.error, state });
            rerenderMarketplacePage();
            return state;
        }
    }

    function getProcurexMarketplaceTenders() {
        return hasBackendData ? state.marketplaceTenders : fallbackMarketplaceTenders();
    }

    function getProcurexMyTenderRows() {
        return hasBackendData ? state.myTenderRows : fallbackMyTenderRowsValue();
    }

    function getProcurexMyBidRows() {
        return hasBackendData ? state.myBidRows : fallbackMyBidRowsValue();
    }

    function isProcurexTenderOwnedByCurrentUser(tender = {}) {
        if (Object.prototype.hasOwnProperty.call(tender, 'createdByCurrentUser')) {
            return tender.createdByCurrentUser === true;
        }
        return typeof fallbackTenderOwnership === 'function' ? fallbackTenderOwnership(tender) : false;
    }

    function getProcurexCurrentAccount() {
        return typeof fallbackGetCurrentAccount === 'function' ? fallbackGetCurrentAccount() || {} : {};
    }

    window.refreshProcurexMarketplaceData = refreshProcurexMarketplaceData;
    window.getProcurexMarketplaceTenders = getProcurexMarketplaceTenders;
    window.getProcurexMyTenderRows = getProcurexMyTenderRows;
    window.getProcurexMyBidRows = getProcurexMyBidRows;
    window.isProcurexTenderOwnedByCurrentUser = isProcurexTenderOwnedByCurrentUser;
    window.getProcurexCurrentAccount = getProcurexCurrentAccount;

    document.addEventListener('DOMContentLoaded', () => {
        refreshProcurexMarketplaceData();
    });
})();
