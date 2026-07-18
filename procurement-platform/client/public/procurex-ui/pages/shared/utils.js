// Shared page utilities for the static ProcureX prototype.
(function () {
    const BADGE_TONE_MAP = {
        success: ['active', 'accepted', 'complete', 'completed', 'paid', 'verified', 'signed', 'agreed', 'resolved', 'current', 'matched', 'confirmed', 'ready'],
        warning: ['pending', 'review', 'awaiting', 'required', 'counter', 'draft', 'progress', 'action', 'under', 'open', 'mismatch'],
        error: ['closed', 'terminated', 'blocked', 'rejected', 'declined', 'high', 'failed', 'cancelled', 'expired'],
        info: []
    };

    function escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function sanitizeDraftField(value = '', maxLength = 1500) {
        return String(value ?? '')
            .replace(/[<>]/g, ' ')
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .slice(0, maxLength);
    }

    function formatMoney(value, currency = 'TZS') {
        const amount = Number(value || 0);
        return Number.isFinite(amount) ? `${escapeHtml(currency)} ${amount.toLocaleString()}` : escapeHtml(value || '-');
    }

    function formatDate(value = '', fallback = 'Not saved') {
        if (!value) return fallback;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getBadgeTone(value = '') {
        const lower = String(value || '').toLowerCase();
        for (const [tone, words] of Object.entries(BADGE_TONE_MAP)) {
            if (words.some(word => lower.includes(word))) return tone;
        }
        return 'info';
    }

    function renderStatusBadge(value = '', extraClass = '') {
        const text = String(value || 'Info');
        const tone = getBadgeTone(text);
        return `<span class="badge badge-${tone} ${escapeHtml(extraClass)}" aria-label="Status: ${escapeHtml(text)}">${escapeHtml(text)}</span>`;
    }

    function renderDataTable(headers = [], rows = [], className = '') {
        return `
            <div class="data-table evaluation-table-scroll ${escapeHtml(className)}">
                <table>
                    <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        `;
    }

    window.ProcureXShared = {
        BADGE_TONE_MAP,
        escapeHtml,
        sanitizeDraftField,
        formatMoney,
        formatDate,
        renderStatusBadge,
        renderDataTable
    };
})();
