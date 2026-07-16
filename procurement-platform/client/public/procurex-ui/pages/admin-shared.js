// Shared admin view helpers. Admin pages are read-only oversight prototypes.
(function () {
    const shared = () => window.ProcureXShared || {};
    const escapeHtml = value => (shared().escapeHtml ? shared().escapeHtml(value) : String(value ?? ''));
    const formatMoney = value => (shared().formatMoney ? shared().formatMoney(value) : `TZS ${Number(value || 0).toLocaleString()}`);
    const formatDate = value => (shared().formatDate ? shared().formatDate(value, '-') : String(value || '-'));
    const renderStatusBadge = value => (shared().renderStatusBadge ? shared().renderStatusBadge(value) : `<span class="badge badge-info">${escapeHtml(value)}</span>`);

    function formatCompactMoney(value) {
        const amount = Number(value || 0);
        if (!Number.isFinite(amount)) return formatMoney(value);
        if (Math.abs(amount) >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1)}B`;
        if (Math.abs(amount) >= 1000000) return `TZS ${(amount / 1000000).toFixed(1)}M`;
        return formatMoney(amount);
    }

    function getAdminTenders() {
        if (typeof getProcurexAllTenders === 'function') return getProcurexAllTenders();
        return mockData.tenders || [];
    }

    function getStoredSubmittedBids() {
        return ['procurex.bidWorkspaceSubmitted.v1', 'procurex.supplierSubmittedBids.v1'].flatMap(key => {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        });
    }

    function getAdminAuditTrail() {
        let stored = [];
        try {
            stored = JSON.parse(localStorage.getItem('procurex.adminAuditTrail.v1') || '[]');
        } catch (error) {
            stored = [];
        }
        return [...stored, ...(mockData.platformOps?.auditTrail || [])]
            .map((item, index) => ({
                id: item.id || `AUD-${index + 1}`,
                time: item.time || item.date || '2026-06-12 10:00',
                actor: item.actor || 'Platform Admin',
                actorRole: item.actorRole || 'System Administrator',
                action: item.action || item.event || 'Audit event',
                entityType: item.entityType || 'Procurement record',
                entityRef: item.entityRef || item.ref || item.reference || `AUD-${index + 1}`,
                severity: item.severity || (/hold|return|flag|risk|issue/i.test(`${item.event || ''} ${item.summary || ''}`) ? 'warning' : 'info'),
                summary: item.summary || item.event || item.action || 'Recorded platform oversight event.'
            }))
            .sort((a, b) => Date.parse(b.time || 0) - Date.parse(a.time || 0));
    }

    function getAdminAccounts() {
        const authAccounts = (mockData.mockAuth?.accounts || []).map((account, index) => ({
            id: `auth-${index}`,
            name: account.displayName || account.name || account.email || `Account ${index + 1}`,
            email: account.email || '-',
            phone: account.phone || '-',
            organization: account.organization || account.displayName || account.email || 'ProcureX account',
            role: account.accountType === 'admin' || account.role === 'admin' ? 'Admin' : account.accountType === 'supplier' ? 'Supplier' : 'Buyer/Supplier',
            verification: account.ekycCompleted === false ? 'Pending Verification' : 'eKYC Complete',
            joined: index % 2 === 0 ? '2026-05-04' : '2026-04-18',
            permissions: account.role === 'admin' ? mockData.users?.admin?.permissions || [] : ['workspace:access', 'procurement:view']
        }));
        const userAccounts = Object.entries(mockData.users || {}).map(([role, user], index) => ({
            id: `user-${role}`,
            name: user.name || user.organization || role,
            email: user.email || `${role}@procurex.local`,
            phone: user.phone || '+255 700 000 000',
            organization: user.organization || user.name || 'ProcureX account',
            role: role === 'admin' ? 'Admin' : role === 'supplier' || role === 'current' ? 'Supplier' : 'Buyer',
            verification: role === 'current' ? 'eKYC Complete' : 'Verified',
            joined: index % 2 === 0 ? '2026-03-12' : '2026-02-21',
            permissions: user.permissions || ['workspace:access', `${role}:read`]
        }));
        const seen = new Set();
        return [...authAccounts, ...userAccounts].filter(account => {
            const key = account.email;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function getAdminSearchRows() {
        const tenders = getAdminTenders();
        const tenderRows = tenders.map((tender, index) => ({
            type: 'Tender',
            title: tender.title || `Tender ${index + 1}`,
            reference: tender.reference || tender.id || `TD-${index + 1}`,
            status: tender.complianceStatus || tender.status || 'Published',
            stage: /award/i.test(tender.status || '') ? 'Award' : /closed|evaluation/i.test(tender.status || '') ? 'Evaluation' : 'Publication',
            party: tender.organization || tender.buyer || 'Buyer',
            amount: tender.budget || tender.estimatedValue || 0,
            summary: 'Tender configuration, publication controls, requirements, clarifications, and lifecycle evidence.',
            date: tender.publishedAt || tender.createdAt || tender.closingDate || '2026-05-20'
        }));
        const bidRows = getStoredSubmittedBids().map((bid, index) => ({
            type: 'Bid',
            title: bid.title || bid.tenderTitle || 'Submitted bid package',
            reference: bid.tenderId || bid.reference || `BID-${index + 1}`,
            status: bid.status || 'Submitted',
            stage: 'Bid submission',
            party: bid.supplier || bid.draft?.supplierName || 'Supplier',
            amount: bid.amount || bid.total || bid.draft?.total || 0,
            summary: 'Submitted response, document evidence, receipt metadata, and financial offer.',
            date: bid.submittedAt || bid.savedAt || '2026-05-24'
        }));
        const documentRows = bidRows.slice(0, 4).map((bid, index) => ({
            type: 'Document',
            title: `Evidence pack - ${bid.title}`,
            reference: bid.reference,
            status: 'Uploaded',
            stage: 'Bid evidence',
            party: bid.party,
            amount: 0,
            summary: 'Technical, financial, and compliance documents available for inspection.',
            date: bid.date
        }));
        const evaluation = mockData.bidEvaluation || {};
        const evaluationRows = [{
            type: 'Evaluation',
            title: evaluation.tenderTitle || 'Buyer evaluation draft',
            reference: evaluation.reference || 'EVAL-PX-2026-014',
            status: evaluation.status || 'Read-only buyer draft',
            stage: 'Evaluation',
            party: mockData.users?.buyer?.organization || 'Buyer',
            amount: evaluation.estimatedValue || getAdminTenders()[0]?.budget || 0,
            summary: 'Buyer scoring, consensus notes, ranked bids, and audit evidence are visible read-only.',
            date: '2026-06-24'
        }];
        const award = mockData.awardingContracts?.award || {};
        const awardRows = [{
            type: 'Award',
            title: award.tenderTitle || 'Award recommendation',
            reference: award.reference || 'AWD-PX-2026-001',
            status: award.approval?.status || award.status || 'Awaiting review',
            stage: 'Award',
            party: award.selectedSupplier || award.recommendedSupplier || 'Recommended supplier',
            amount: award.amount || award.awardAmount || 0,
            summary: 'Award decision packet, standstill status, approval trail, and supplier response.',
            date: award.noticeDate || '2026-07-01'
        }];
        const accountRows = getAdminAccounts().map(account => ({
            type: 'User',
            title: account.name,
            reference: account.email,
            status: account.verification,
            stage: 'Account',
            party: account.organization,
            amount: 0,
            summary: `${account.role} account with ${account.permissions.length} permission marker(s).`,
            date: account.joined
        }));
        const auditRows = getAdminAuditTrail().map(item => ({
            type: 'Audit',
            title: item.action,
            reference: item.entityRef,
            status: item.severity,
            stage: item.entityType,
            party: item.actor,
            amount: 0,
            summary: item.summary,
            date: item.time
        }));
        const contract = mockData.awardingContracts?.contract || {};
        const contractRows = [{
            type: 'Contract',
            title: contract.title || 'Active contract workspace',
            reference: contract.reference || contract.contractNumber || 'CTR-PX-2026-001',
            status: contract.status || 'Active',
            stage: 'Contract management',
            party: contract.supplier || contract.selectedSupplier || 'Supplier',
            amount: contract.value || contract.amount || 0,
            summary: 'Signed contract, negotiation history, documents, signatures, invoices, and execution evidence.',
            date: contract.signedDate || '2026-07-02'
        }];
        return [...tenderRows, ...bidRows, ...documentRows, ...evaluationRows, ...awardRows, ...accountRows, ...auditRows, ...contractRows];
    }

    function getAdminStats() {
        const rows = getAdminSearchRows();
        const tenders = getAdminTenders();
        const audits = getAdminAuditTrail();
        const flaggedRows = rows.filter(row => /flag|risk|hold|return|warning|critical|issue|pending/i.test(`${row.status} ${row.summary}`));
        return {
            activeTenders: tenders.filter(tender => /open|published|active/i.test(tender.status || '')).length || tenders.length,
            pendingReviews: Math.max(3, flaggedRows.length),
            flaggedIssues: flaggedRows.length,
            complianceRate: Math.max(84, 98 - flaggedRows.length),
            evaluationDrafts: rows.filter(row => row.type === 'Evaluation').length,
            auditEventsToday: Math.max(4, audits.length),
            tenders: rows.filter(row => row.type === 'Tender').length,
            bids: rows.filter(row => row.type === 'Bid').length,
            evaluations: rows.filter(row => row.type === 'Evaluation').length,
            flags: flaggedRows.length,
            documents: rows.filter(row => row.type === 'Document').length,
            audits: rows.filter(row => row.type === 'Audit').length
        };
    }

    function getComplianceQueue() {
        const tenders = getAdminTenders().slice(0, 5).map((tender, index) => ({
            urgency: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
            stage: index % 3 === 0 ? 'Publication' : index % 3 === 1 ? 'Evaluation' : 'Award',
            title: tender.title,
            owner: tender.organization || tender.buyer || 'Buyer',
            value: tender.budget || tender.estimatedValue || 0,
            issue: index === 0 ? 'Verify method, threshold, and bidding period before next approval.' : 'Confirm required compliance controls are present.',
            status: index === 0 ? 'Pending Compliance Review' : index === 1 ? 'Return Check Needed' : 'Awaiting Review'
        }));
        return [
            ...tenders,
            {
                urgency: 'high',
                stage: 'Award',
                title: mockData.awardingContracts?.award?.tenderTitle || 'Award recommendation packet',
                owner: mockData.users?.buyer?.organization || 'Buyer',
                value: mockData.awardingContracts?.award?.amount || 0,
                issue: 'Standstill, COI declaration, and approval evidence need admin inspection.',
                status: 'Flag Review'
            }
        ];
    }

    function getActivitySeries() {
        return [
            { label: 'Mon', value: 18 },
            { label: 'Tue', value: 24 },
            { label: 'Wed', value: 21 },
            { label: 'Thu', value: 29 },
            { label: 'Fri', value: 33 },
            { label: 'Sat', value: 14 },
            { label: 'Sun', value: 11 }
        ];
    }

    function renderAdminSidebar(activePage = 'admin-dashboard') {
        const items = [
            ['admin-dashboard', 'Command Center'],
            ['admin-users', 'User Management'],
            ['admin-analytics', 'Platform Analytics'],
            ['admin-audit', 'Full Audit Trail']
        ];
        const secondary = [
            ['communication-center', 'Communication Center'],
            ['account-profile', 'Admin Profile']
        ];
        return `
            <aside class="sidebar admin-sidebar" aria-label="Platform admin navigation">
                <div class="sidebar-heading">
                    <h3>Platform Admin</h3>
                    <div>System oversight</div>
                </div>
                <ul class="sidebar-nav">
                    ${items.map(([page, label]) => `
                        <li><a href="#" data-navigate="${page}" class="${activePage === page ? 'active' : ''}">${escapeHtml(label)}</a></li>
                    `).join('')}
                </ul>
                <div class="admin-sidebar-divider"></div>
                <ul class="sidebar-nav">
                    ${secondary.map(([page, label]) => `<li><a href="#" data-navigate="${page}">${escapeHtml(label)}</a></li>`).join('')}
                </ul>
            </aside>
        `;
    }

    window.ProcureXAdmin = {
        escapeHtml,
        formatMoney,
        formatCompactMoney,
        formatDate,
        renderStatusBadge,
        getAdminTenders,
        getStoredSubmittedBids,
        getAdminAuditTrail,
        getAdminAccounts,
        getAdminSearchRows,
        getAdminStats,
        getComplianceQueue,
        getActivitySeries
    };
    window.renderAdminSidebar = renderAdminSidebar;
    window.renderAdminSearchSidebar = renderAdminSidebar;
    window.getProcurexAdminAuditTrail = getAdminAuditTrail;
    window.buildProcurexAdminSearchRows = getAdminSearchRows;
    window.getAdminSearchStats = getAdminStats;
})();
