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
    const savingTenderIds = new Set();

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

    function buildTenderSaveUrl(tenderId = '') {
        return `${getApiBaseUrl()}/api/procurement/tenders/${encodeURIComponent(tenderId)}/save`;
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

    function notifyUser(message = '', tone = 'info') {
        if (!message) return;
        if (typeof window.app?.showNotification === 'function') {
            window.app.showNotification(message, { tone });
            return;
        }
        if (typeof window.alert === 'function') {
            window.alert(message);
        }
    }

    function navigateToSignIn() {
        if (typeof window.app?.navigateTo === 'function') {
            window.app.navigateTo('sign-in');
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('page', 'sign-in');
        window.location.href = url.toString();
    }

    function createUserNotifiedError(message = 'Sign in to save tenders.') {
        const error = new Error(message);
        error.userNotified = true;
        return error;
    }

    function requireAuthToken() {
        const token = getStoredAuthToken();
        if (token) return token;
        notifyUser('Sign in to save tenders to your watchlist.', 'warning');
        navigateToSignIn();
        throw createUserNotifiedError();
    }

    function rerenderMarketplacePage() {
        const page = window.app?.currentPage || '';
        if (!['marketplace', 'supplier-marketplace', 'guest-marketplace', 'tender-detail'].includes(page)) return;
        if (typeof window.app?.renderPage === 'function') {
            window.app.renderPage();
        }
    }

    function normalizeTenderId(value = '') {
        return String(value || '').trim();
    }

    function tenderMatchesId(tender = {}, tenderId = '') {
        const target = normalizeTenderId(tenderId);
        return [tender.id, tender.tenderId, tender.reference]
            .map(normalizeTenderId)
            .some(value => value && value === target);
    }

    function updateTenderSavedFlag(tender = {}, tenderId = '', isSaved = false) {
        if (!tender || typeof tender !== 'object') return tender;
        if (!tenderMatchesId(tender, tenderId)) return tender;
        return { ...tender, isSaved };
    }

    function applyTenderSavedState(tenderId = '', isSaved = false) {
        state.marketplaceTenders = state.marketplaceTenders.map(tender => updateTenderSavedFlag(tender, tenderId, isSaved));
        state.myTenderRows = state.myTenderRows.map(row => ({
            ...row,
            tender: updateTenderSavedFlag(row.tender, tenderId, isSaved)
        }));
        state.myBidRows = state.myBidRows.map(row => ({
            ...row,
            tender: updateTenderSavedFlag(row.tender, tenderId, isSaved)
        }));

        dispatchMarketplaceEvent('procurex:marketplace-data', {
            state,
            tenderId,
            isSaved
        });
        rerenderMarketplacePage();
    }

    async function readResponseBody(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch (error) {
                return {};
            }
        }
        try {
            return { message: await response.text() };
        } catch (error) {
            return {};
        }
    }

    function getResponseMessage(payload = {}, fallback = 'Unable to update saved tender.') {
        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
        if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (Array.isArray(payload.errors) && payload.errors[0]?.message) return String(payload.errors[0].message);
        return fallback;
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

    async function toggleProcurexTenderSave(tenderId = '', shouldSave = true) {
        const normalizedTenderId = normalizeTenderId(tenderId);
        if (!normalizedTenderId) {
            throw new Error('Tender id is required before saving.');
        }

        if (savingTenderIds.has(normalizedTenderId)) {
            throw new Error('This tender save request is already in progress.');
        }

        const token = requireAuthToken();
        savingTenderIds.add(normalizedTenderId);
        dispatchMarketplaceEvent('procurex:marketplace-save-loading', {
            tenderId: normalizedTenderId,
            isSaved: shouldSave
        });

        try {
            const response = await fetch(buildTenderSaveUrl(normalizedTenderId), {
                method: shouldSave ? 'POST' : 'DELETE',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
            const payload = await readResponseBody(response);

            if (!response.ok) {
                throw new Error(getResponseMessage(payload));
            }

            applyTenderSavedState(normalizedTenderId, shouldSave);
            notifyUser(shouldSave ? 'Tender saved.' : 'Tender removed from saved tenders.', 'success');
            return {
                success: true,
                isSaved: shouldSave,
                tenderId: normalizedTenderId,
                payload
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update saved tender.';
            state.error = message;
            dispatchMarketplaceEvent('procurex:marketplace-error', {
                tenderId: normalizedTenderId,
                error: message,
                state
            });
            notifyUser(message, 'error');
            const forwarded = error instanceof Error ? error : new Error(message);
            forwarded.userNotified = true;
            throw forwarded;
        } finally {
            savingTenderIds.delete(normalizedTenderId);
        }
    }

    function saveProcurexTender(tenderId = '') {
        return toggleProcurexTenderSave(tenderId, true);
    }

    function unsaveProcurexTender(tenderId = '') {
        return toggleProcurexTenderSave(tenderId, false);
    }

    function exposeMarketplaceGlobals() {
        window.refreshProcurexMarketplaceData = refreshProcurexMarketplaceData;
        window.getProcurexMarketplaceTenders = getProcurexMarketplaceTenders;
        window.getProcurexMyTenderRows = getProcurexMyTenderRows;
        window.getProcurexMyBidRows = getProcurexMyBidRows;
        window.isProcurexTenderOwnedByCurrentUser = isProcurexTenderOwnedByCurrentUser;
        window.getProcurexCurrentAccount = getProcurexCurrentAccount;
        window.saveProcurexTender = saveProcurexTender;
        window.unsaveProcurexTender = unsaveProcurexTender;
        window.toggleProcurexTenderSave = toggleProcurexTenderSave;
    }

    exposeMarketplaceGlobals();

    document.addEventListener('DOMContentLoaded', () => {
        exposeMarketplaceGlobals();
        refreshProcurexMarketplaceData();
    });
})();
