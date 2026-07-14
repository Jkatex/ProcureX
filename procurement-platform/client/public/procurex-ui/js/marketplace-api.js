// ProcureX marketplace API adapter for the static marketplace pages.
(function () {
    const authTokenKey = 'procurex.authToken';
    const endpointPath = '/api/procurement/marketplace';
    const fallbackGetMarketplaceTenders = window.getProcurexMarketplaceTenders;
    const fallbackGetMyTenderRows = window.getProcurexMyTenderRows;
    const fallbackGetMyBidRows = window.getProcurexMyBidRows;
    const fallbackTenderOwnership = window.isProcurexTenderOwnedByCurrentUser;

    const emptyPayload = () => ({
        tenders: [],
        myTenders: [],
        myBids: [],
        summary: null
    });

    const state = window.procurexMarketplaceState || {
        loading: false,
        error: null,
        payload: emptyPayload(),
        loadedAt: null,
        requestId: 0
    };

    state.payload = sanitizeMarketplacePayload(state.payload);
    window.procurexMarketplaceState = state;

    function sanitizeMarketplacePayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        return {
            tenders: Array.isArray(source.tenders) ? source.tenders : [],
            myTenders: Array.isArray(source.myTenders) ? source.myTenders : [],
            myBids: Array.isArray(source.myBids) ? source.myBids : [],
            summary: source.summary && typeof source.summary === 'object' ? source.summary : null
        };
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

    function shouldUsePayload() {
        return Boolean(state.loadedAt);
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
        const requestId = state.requestId + 1;
        state.requestId = requestId;
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

            const payload = sanitizeMarketplacePayload(await response.json());
            if (state.requestId !== requestId) return state;

            state.payload = payload;
            state.loading = false;
            state.error = null;
            state.loadedAt = new Date().toISOString();
            dispatchMarketplaceEvent('procurex:marketplace-data', { requestId, payload });
            rerenderMarketplacePage();
            return state;
        } catch (error) {
            if (state.requestId !== requestId) return state;

            state.loading = false;
            state.error = error instanceof Error ? error.message : 'Unable to load marketplace data.';
            dispatchMarketplaceEvent('procurex:marketplace-error', { requestId, error: state.error });
            rerenderMarketplacePage();
            return state;
        }
    }

    function getProcurexMarketplaceTenders() {
        return shouldUsePayload() ? state.payload.tenders : fallbackMarketplaceTenders();
    }

    function getProcurexMyTenderRows() {
        return shouldUsePayload() ? state.payload.myTenders : fallbackMyTenderRowsValue();
    }

    function getProcurexMyBidRows() {
        return shouldUsePayload() ? state.payload.myBids : fallbackMyBidRowsValue();
    }

    function isProcurexTenderOwnedByCurrentUser(tender = {}) {
        if (Object.prototype.hasOwnProperty.call(tender, 'createdByCurrentUser')) {
            return tender.createdByCurrentUser === true;
        }
        return typeof fallbackTenderOwnership === 'function' ? fallbackTenderOwnership(tender) : false;
    }

    window.refreshProcurexMarketplaceData = refreshProcurexMarketplaceData;
    window.getProcurexMarketplaceTenders = getProcurexMarketplaceTenders;
    window.getProcurexMyTenderRows = getProcurexMyTenderRows;
    window.getProcurexMyBidRows = getProcurexMyBidRows;
    window.isProcurexTenderOwnedByCurrentUser = isProcurexTenderOwnedByCurrentUser;

    document.addEventListener('DOMContentLoaded', () => {
        refreshProcurexMarketplaceData();
    });
})();
