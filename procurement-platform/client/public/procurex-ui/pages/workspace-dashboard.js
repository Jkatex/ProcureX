// Main dashboard for the signed-in user. Counts are derived from tenders, drafts,
// submitted bids, contracts, and communication items already available to the UI.

const workspaceDashboardSubmittedBidsKey = 'procurex.supplierSubmittedBids.v1';

function formatDashboardMoney(value) {
    const amount = Number(value || 0);
    if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(0)}M`;
    return `TZS ${amount.toLocaleString()}`;
}

function parseDashboardMoney(value) {
    if (typeof value === 'number') return value;
    const text = String(value || '').toUpperCase().replace(/TZS|,/g, '').trim();
    const parsed = Number(text.replace(/[BMK]/g, ''));
    if (!Number.isFinite(parsed)) return 0;
    if (text.includes('B')) return parsed * 1000000000;
    if (text.includes('M')) return parsed * 1000000;
    if (text.includes('K')) return parsed * 1000;
    return parsed;
}

function getCurrentDashboardUser() {
    const account = mockData.pendingAccount || {};
    const session = mockData.session || {};
    const profile = mockData.eKycProfile || {};
    const registryRecord = profile.registryRecord || {};
    const email = session.email || account.email || 'user@procurex.test';
    const displayName = profile.verifiedName || registryRecord.name || account.displayName || email.split('@')[0] || 'ProcureX User';

    return {
        displayName,
        email,
        phone: account.phone || mockData.registrationDraft?.phone || 'Not captured',
        accountType: account.accountType || (session.isNewUser ? 'new user' : 'user'),
        entityType: profile.entityType || 'Individual, company, or business',
        organization: registryRecord.name || account.displayName || displayName,
        iamStatus: profile.status === 'completed' || account.ekycCompleted || session.isNewUser === false ? 'Verified' : 'Pending verification'
    };
}

function getDashboardGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function escapeWorkspaceDashboardHtml(value = '') {
    if (typeof window.ProcureXShared?.escapeHtml === 'function') return window.ProcureXShared.escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getWorkspaceDashboardStoredObject(key, fallback = null) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
        return fallback;
    }
}

function getWorkspaceDashboardStoredArray(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function formatWorkspaceDashboardDate(value, fallback = 'Date not set') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatWorkspaceDashboardRelative(value) {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

function getWorkspaceDashboardSavedTenderDraft() {
    if (typeof getCreateTenderSavedDraft === 'function') return getCreateTenderSavedDraft();
    const draft = getWorkspaceDashboardStoredObject('procurex.createTender.v2.savedDraft', null);
    return draft?.status === 'Saved as draft' ? draft : null;
}

function getWorkspaceDashboardAllTenders() {
    return typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : (mockData.tenders || []);
}

function getWorkspaceDashboardActiveTenders() {
    return typeof getProcurexBuyerActiveTenders === 'function'
        ? getProcurexBuyerActiveTenders()
        : getWorkspaceDashboardAllTenders().filter(tender => tender.createdByCurrentUser && !['Awarded', 'Cancelled'].includes(tender.status));
}

function getWorkspaceDashboardSavedBidDrafts() {
    const prefix = 'procurex.supplierBidDraft.v1.';
    const tenders = getWorkspaceDashboardAllTenders();
    const drafts = [];

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(prefix)) continue;

        const draft = getWorkspaceDashboardStoredObject(key, null);
        if (!draft || !Object.keys(draft).length) continue;

        const tenderId = key.slice(prefix.length);
        const tender = tenders.find(item => item.id === tenderId);
        drafts.push({
            id: `bid-draft-${tenderId}`,
            tenderId,
            title: tender?.title || draft.title || 'Bid draft',
            type: 'Bid draft',
            status: 'Draft',
            detail: tender ? `${tender.organization || 'Marketplace tender'} / ${tender.type || 'Tender'}` : 'Tenderer bid preparation',
            nextAction: 'Continue bid',
            deadline: tender?.closingDate || '',
            lastActivity: draft.savedAt || '',
            amount: parseDashboardMoney(draft.total),
            nav: 'bidding-workspace'
        });
    }

    return drafts.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
}

function getWorkspaceDashboardSubmittedBids() {
    const tenders = getWorkspaceDashboardAllTenders();
    return getWorkspaceDashboardStoredArray(workspaceDashboardSubmittedBidsKey).map((bid, index) => {
        const tender = tenders.find(item => item.id === bid.tenderId);
        return {
            id: `submitted-bid-${bid.tenderId || index}`,
            tenderId: bid.tenderId,
            title: tender?.title || bid.tenderTitle || bid.tenderId || 'Submitted bid',
            type: 'Submitted bid',
            status: 'Submitted',
            detail: bid.receiptHash ? `Receipt ${bid.receiptHash}` : 'Sealed bid submitted',
            nextAction: 'View receipt',
            deadline: tender?.closingDate || bid.submittedAt || '',
            lastActivity: bid.submittedAt || '',
            amount: parseDashboardMoney(bid.draft?.total || bid.total),
            nav: 'bidding-workspace'
        };
    });
}

function getWorkspaceDashboardUnreadCount() {
    if (typeof getProcurexUnreadCommunicationCount === 'function') return getProcurexUnreadCommunicationCount();
    return (mockData.communicationCenter?.items || []).filter(item => item.read === false).length;
}

function getDashboardSeverity(score = 0) {
    if (score >= 90) return { label: 'Critical', className: 'critical' };
    if (score >= 75) return { label: 'Attention', className: 'attention' };
    return { label: 'Info', className: 'info' };
}

function getDashboardActionLabel(nav = '') {
    const labels = {
        'awarding-contracts': 'Open',
        'award-recommendation': 'Review',
        'bid-evaluation': 'Score',
        'contract-negotiation': 'Sign',
        'post-award-tracking': 'Open',
        'communication-center': 'Open inbox',
        marketplace: 'Find',
        'create-tender': 'Continue'
    };
    return labels[nav] || 'Open';
}

function getWorkspaceDashboardPipeline(tenders = [], bidDrafts = [], submittedBids = []) {
    const tenderDraft = getWorkspaceDashboardSavedTenderDraft();
    const counts = {
        Draft: (tenderDraft ? 1 : 0) + bidDrafts.length,
        Published: tenders.filter(tender => /open|published|pending admin review/i.test(tender.status || '')).length,
        Evaluation: tenders.filter(tender => /evaluation/i.test(tender.status || '')).length,
        Award: tenders.filter(tender => /award/i.test(tender.status || '')).length,
        Contract: mockData.awardingContracts?.execution ? 1 : 0,
        Completed: getWorkspaceDashboardAllTenders().filter(tender => /completed|closed|cancelled/i.test(tender.status || '')).length + submittedBids.length
    };

    return Object.entries(counts).map(([stage, count]) => ({
        stage,
        count,
        nav: stage === 'Draft' ? 'create-tender' : stage === 'Published' ? 'marketplace' : stage === 'Evaluation' ? 'bid-evaluation' : stage === 'Award' ? 'awarding-contracts' : stage === 'Contract' ? 'awarding-contracts' : 'records-history'
    }));
}

function getWorkspaceDashboardActiveWork(tenders = [], bidDrafts = [], submittedBids = []) {
    const savedTenderDraft = getWorkspaceDashboardSavedTenderDraft();
    const items = [];

    if (savedTenderDraft) {
        items.push({
            id: 'tender-draft',
            title: savedTenderDraft.title || 'Untitled tender',
            type: 'Tender draft',
            status: 'Draft',
            nextAction: 'Complete tender',
            deadline: savedTenderDraft.closingDate || '',
            lastActivity: savedTenderDraft.savedAt || '',
            nav: 'create-tender'
        });
    }

    tenders.forEach(tender => {
        items.push({
            id: tender.id,
            tenderId: tender.id,
            title: tender.title,
            type: 'Tender',
            status: tender.status || 'Open',
            nextAction: /evaluation/i.test(tender.status || '') ? 'Score bids' : /award/i.test(tender.status || '') ? 'Review award' : 'Manage tender',
            deadline: tender.closingDate || tender.milestones?.find(item => item.id === 'milestone-evaluation')?.date || '',
            lastActivity: tender.publishedAt || tender.closingDate || '',
            amount: Number(tender.budget || 0),
            nav: /evaluation/i.test(tender.status || '') ? 'bid-evaluation' : /award/i.test(tender.status || '') ? 'awarding-contracts' : 'tender-details'
        });
    });

    items.push(...bidDrafts, ...submittedBids);

    if (mockData.awardingContracts?.execution) {
        const execution = mockData.awardingContracts.execution;
        items.push({
            id: 'active-contract',
            title: execution.title || 'Active contract execution',
            type: 'Contract',
            status: execution.status || 'Active',
            nextAction: 'Track performance',
            deadline: execution.endDate || '2026-08-30',
            lastActivity: '2026-07-02T14:20:00',
            amount: Number(execution.contractValue || 0),
            nav: 'awarding-contracts'
        });
    }

    return items
        .sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0))
        .slice(0, 8);
}

function getWorkspaceDashboardDeadlines(tenders = [], activeWork = []) {
    const items = [];
    tenders.forEach(tender => {
        if (tender.closingDate) {
            items.push({
                date: tender.closingDate,
                title: `Bid closing: ${tender.title}`,
                tenderId: tender.id,
                nav: tender.createdByCurrentUser ? 'tender-details' : 'tender-detail'
            });
        }
        (tender.milestones || []).forEach(milestone => {
            if (!milestone.date || milestone.id === 'milestone-closing') return;
            items.push({
                date: milestone.date,
                title: `${milestone.name || 'Milestone'}: ${tender.title}`,
                tenderId: tender.id,
                nav: tender.createdByCurrentUser ? 'tender-details' : 'tender-detail'
            });
        });
    });

    activeWork
        .filter(item => item.deadline && !items.some(deadline => deadline.date === item.deadline && deadline.title.includes(item.title)))
        .forEach(item => items.push({
            date: item.deadline,
            title: `${item.type}: ${item.title}`,
            tenderId: item.tenderId,
            nav: item.nav
        }));

    return items
        .filter(item => Number.isFinite(Date.parse(item.date)))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
        .slice(0, 6);
}

function getWorkspaceDashboardRecentActivity(tenders = [], activeWork = []) {
    const activities = [];

    tenders.forEach(tender => {
        activities.push({
            title: `${tender.title} ${/pending admin/i.test(tender.status || '') ? 'sent for compliance review' : 'updated'}`,
            detail: `${tender.id || 'Tender'} / ${tender.status || 'Open'}`,
            time: tender.publishedAt || tender.closingDate || '',
            nav: tender.createdByCurrentUser ? 'tender-details' : 'tender-detail',
            tenderId: tender.id
        });
    });

    activeWork.forEach(item => {
        if (!item.lastActivity) return;
        activities.push({
            title: `${item.type} saved: ${item.title}`,
            detail: item.nextAction || item.status,
            time: item.lastActivity,
            nav: item.nav,
            tenderId: item.tenderId
        });
    });

    (mockData.communicationCenter?.items || []).slice(0, 5).forEach(item => {
        activities.push({
            title: item.subject || 'Communication update',
            detail: item.category || item.tenderReference || 'Message',
            time: item.createdAt || item.updatedAt,
            nav: 'communication-center'
        });
    });

    return activities
        .filter(item => item.title)
        .sort((a, b) => Date.parse(b.time || 0) - Date.parse(a.time || 0))
        .slice(0, 7);
}

function getWorkspaceDashboardSummary(tenders = [], bidDrafts = [], submittedBids = []) {
    const allTenderValue = tenders.reduce((sum, tender) => sum + parseDashboardMoney(tender.budget || tender.estimatedValue || 0), 0);
    const bidValue = [...bidDrafts, ...submittedBids].reduce((sum, bid) => sum + parseDashboardMoney(bid.amount || bid.total || 0), 0);
    const compliancePending = tenders.filter(tender => /review|pending|returned/i.test(`${tender.status || ''} ${tender.complianceStatus || ''}`)).length;

    return [
        ['My tenders', tenders.length, 'Active tenders created by this account'],
        ['My bids', bidDrafts.length + submittedBids.length, 'Bid drafts and submitted opportunities'],
        ['Recorded value', allTenderValue + bidValue ? formatDashboardMoney(allTenderValue + bidValue) : 'No value yet', 'Sum of active tender budgets and captured bid totals'],
        ['Compliance status', compliancePending ? `${compliancePending} pending` : 'Clear', 'Items awaiting or returned from compliance review']
    ];
}

function buildUserDashboardModel() {
    const user = getCurrentDashboardUser();
    const iam = typeof getIamCompletionState === 'function' ? getIamCompletionState() : { isComplete: false, statusLabel: 'Registration required', badgeClass: 'badge-warning' };
    const activeTenders = getWorkspaceDashboardActiveTenders();
    const bidDrafts = getWorkspaceDashboardSavedBidDrafts();
    const submittedBids = getWorkspaceDashboardSubmittedBids();
    const activeWork = getWorkspaceDashboardActiveWork(activeTenders, bidDrafts, submittedBids);
    const pipeline = getWorkspaceDashboardPipeline(activeTenders, bidDrafts, submittedBids);
    const deadlines = getWorkspaceDashboardDeadlines(getWorkspaceDashboardAllTenders(), activeWork);
    const recentActivity = getWorkspaceDashboardRecentActivity(getWorkspaceDashboardAllTenders(), activeWork);
    const unreadCount = getWorkspaceDashboardUnreadCount();

    const baseActions = [
        ...((mockData.userWorkspace?.urgentItems || []).filter(item => item.count > 0)),
        unreadCount ? { type: 'Unread messages', count: unreadCount, urgency: unreadCount >= 5 ? 90 : 78, due: 'Now', nav: 'communication-center' } : null
    ].filter(Boolean);

    const actionQueue = baseActions
        .map(item => ({
            ...item,
            severity: getDashboardSeverity(item.urgency),
            actionLabel: getDashboardActionLabel(item.nav)
        }))
        .sort((a, b) => b.urgency - a.urgency)
        .slice(0, 7);

    return {
        user,
        iam,
        greeting: getDashboardGreeting(),
        unreadCount,
        pipeline,
        actionQueue,
        activeWork,
        deadlines,
        recentActivity,
        summary: getWorkspaceDashboardSummary(activeTenders, bidDrafts, submittedBids)
    };
}

function renderDashboardSidebar(dashboard) {
    return `
        <aside class="sidebar dashboard-sidebar">
            <div class="sidebar-heading">
                <h3>Dashboard</h3>
                <div>${escapeWorkspaceDashboardHtml(dashboard.user.organization)}</div>
            </div>
            <ul class="sidebar-nav">
                <li><a href="#" data-navigate="workspace-dashboard" class="active">Dashboard</a></li>
                <li><a href="#" data-navigate="create-tender">My Tenders</a></li>
                <li><a href="#" data-navigate="marketplace">My Bids</a></li>
                <li><a href="#" data-navigate="communication-center">Communication Center ${dashboard.unreadCount ? `<span class="dashboard-sidebar-count">${dashboard.unreadCount}</span>` : ''}</a></li>
                <li><a href="#" data-navigate="marketplace">Marketplace</a></li>
                <li><a href="#" data-navigate="create-tender">Create Tender</a></li>
                <li><a href="#" data-navigate="bid-evaluation">Evaluation</a></li>
                <li><a href="#" data-navigate="awarding-contracts">Awards and Contracts</a></li>
                <li><a href="#" data-navigate="records-history">Records and History</a></li>
                <li><a href="#" data-navigate="account-profile">Account and Verification</a></li>
                <li><a href="#" data-navigate="sign-in">Logout</a></li>
            </ul>
        </aside>
    `;
}

function renderPipelineStage(stage) {
    return `
        <button class="dashboard-pipeline-stage" type="button" data-navigate="${escapeWorkspaceDashboardHtml(stage.nav)}">
            <strong>${stage.count}</strong>
            <span>${escapeWorkspaceDashboardHtml(stage.stage)}</span>
        </button>
    `;
}

function renderActionQueueItem(item) {
    return `
        <button class="dashboard-action-row ${item.severity.className}" type="button" data-navigate="${escapeWorkspaceDashboardHtml(item.nav)}">
            <span class="dashboard-action-count">${escapeWorkspaceDashboardHtml(item.count)}</span>
            <div>
                <strong>${escapeWorkspaceDashboardHtml(item.type)}</strong>
                <span>${escapeWorkspaceDashboardHtml(item.due ? `Due: ${item.due}` : 'Needs attention')}</span>
            </div>
            <em>${escapeWorkspaceDashboardHtml(item.severity.label)}</em>
            <b>${escapeWorkspaceDashboardHtml(item.actionLabel)}</b>
        </button>
    `;
}

function renderActiveWorkRow(item) {
    return `
        <button class="dashboard-active-work-row" type="button" ${item.tenderId ? `data-select-tender="${escapeWorkspaceDashboardHtml(item.tenderId)}"` : ''} data-navigate="${escapeWorkspaceDashboardHtml(item.nav)}">
            <span>${escapeWorkspaceDashboardHtml(item.type)}</span>
            <strong>${escapeWorkspaceDashboardHtml(item.title)}</strong>
            <em>${escapeWorkspaceDashboardHtml(item.status)}</em>
            <small>${escapeWorkspaceDashboardHtml(item.nextAction)}</small>
            <time>${escapeWorkspaceDashboardHtml(formatWorkspaceDashboardDate(item.deadline))}</time>
        </button>
    `;
}

function renderDeadlineItem(item) {
    return `
        <button class="dashboard-deadline-item" type="button" ${item.tenderId ? `data-select-tender="${escapeWorkspaceDashboardHtml(item.tenderId)}"` : ''} data-navigate="${escapeWorkspaceDashboardHtml(item.nav)}">
            <time>${escapeWorkspaceDashboardHtml(formatWorkspaceDashboardDate(item.date))}</time>
            <strong>${escapeWorkspaceDashboardHtml(item.title)}</strong>
        </button>
    `;
}

function renderActivityItem(item) {
    return `
        <button class="dashboard-activity-item" type="button" ${item.tenderId ? `data-select-tender="${escapeWorkspaceDashboardHtml(item.tenderId)}"` : ''} data-navigate="${escapeWorkspaceDashboardHtml(item.nav)}">
            <div>
                <strong>${escapeWorkspaceDashboardHtml(item.title)}</strong>
                <span>${escapeWorkspaceDashboardHtml(item.detail || '')}</span>
            </div>
            <time>${escapeWorkspaceDashboardHtml(formatWorkspaceDashboardRelative(item.time))}</time>
        </button>
    `;
}

function renderWorkspaceDashboard() {
    const dashboard = buildUserDashboardModel();
    window.currentWorkspaceDashboard = dashboard;

    return `
        <div class="main-layout dashboard-command-center">
            ${renderDashboardSidebar(dashboard)}
            <main class="main-content">
                <div class="workspace-home">
                    <section class="dashboard-welcome-card dashboard-reference-welcome">
                        <div class="dashboard-reference-copy">
                            <span class="section-kicker">User dashboard</span>
                            <h1>${escapeWorkspaceDashboardHtml(dashboard.greeting)}! <span>${escapeWorkspaceDashboardHtml(dashboard.user.displayName)}</span></h1>
                            <p>${escapeWorkspaceDashboardHtml(dashboard.user.email)}</p>
                            <button class="btn btn-primary" type="button" data-navigate="marketplace">View Marketplace</button>
                        </div>
                        <div class="dashboard-reference-visual" aria-label="Account overview">
                            <div class="dashboard-reference-avatar" aria-hidden="true">
                                ${escapeWorkspaceDashboardHtml((dashboard.user.displayName || 'U').trim().charAt(0).toUpperCase() || 'U')}
                            </div>
                            <article class="dashboard-reference-profile">
                                <span class="badge ${dashboard.iam.badgeClass}">${escapeWorkspaceDashboardHtml(dashboard.iam.statusLabel || dashboard.user.iamStatus)}</span>
                                <strong>${escapeWorkspaceDashboardHtml(dashboard.user.organization)}</strong>
                                <p>${escapeWorkspaceDashboardHtml(dashboard.user.entityType)}</p>
                            </article>
                            <div class="dashboard-reference-pills" aria-label="Dashboard totals">
                                <span>${dashboard.actionQueue.length} urgent</span>
                                <span>${dashboard.activeWork.length} workflows</span>
                                <span>4 apps</span>
                            </div>
                        </div>
                    </section>

                    <section class="dashboard-panel dashboard-pipeline-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">Pipeline overview</span>
                                <h2>Procurement lifecycle status</h2>
                            </div>
                        </div>
                        <div class="dashboard-pipeline">
                            ${dashboard.pipeline.map(renderPipelineStage).join('')}
                        </div>
                    </section>

                    <section class="analytics-grid dashboard-real-metrics">
                        ${dashboard.summary.map(item => `
                            <article class="analytics-card">
                                <span>${escapeWorkspaceDashboardHtml(item[0])}</span>
                                <strong>${escapeWorkspaceDashboardHtml(item[1])}</strong>
                                <p>${escapeWorkspaceDashboardHtml(item[2])}</p>
                            </article>
                        `).join('')}
                    </section>

                    <section class="dashboard-grid-main">
                        <div class="dashboard-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Action Queue</span>
                                    <h2>Items requiring attention</h2>
                                </div>
                                <span class="badge ${dashboard.actionQueue.some(item => item.severity.className === 'critical') ? 'badge-error' : 'badge-info'}">${dashboard.actionQueue.length} active</span>
                            </div>
                            <div class="dashboard-action-queue">
                                ${dashboard.actionQueue.length ? dashboard.actionQueue.map(renderActionQueueItem).join('') : '<div class="scope-empty">No urgent actions right now.</div>'}
                            </div>
                        </div>

                        <aside class="dashboard-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Deadline timeline</span>
                                    <h2>Upcoming dates</h2>
                                </div>
                            </div>
                            <div class="dashboard-deadline-list">
                                ${dashboard.deadlines.length ? dashboard.deadlines.map(renderDeadlineItem).join('') : '<div class="scope-empty">No upcoming tender deadlines found.</div>'}
                            </div>
                        </aside>
                    </section>

                    <section class="dashboard-panel">
                        <div class="panel-heading">
                            <div>
                                <span class="section-kicker">My Active Work</span>
                                <h2>Continue where you left off</h2>
                            </div>
                            <div class="inline-actions">
                                <button class="btn btn-secondary" type="button" data-navigate="create-tender">Create Tender</button>
                                <button class="btn btn-secondary" type="button" data-navigate="marketplace">Find Tenders</button>
                            </div>
                        </div>
                        <div class="dashboard-active-work-table">
                            <div class="dashboard-active-work-head">
                                <span>Type</span><span>Item</span><span>Status</span><span>Next action</span><span>Deadline</span>
                            </div>
                            ${dashboard.activeWork.length ? dashboard.activeWork.map(renderActiveWorkRow).join('') : '<div class="scope-empty">No active work yet. Create a tender or start a bid from the marketplace.</div>'}
                        </div>
                    </section>

                    <section class="dashboard-grid-main">
                        <div class="dashboard-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Recent Activity</span>
                                    <h2>Latest account events</h2>
                                </div>
                            </div>
                            <div class="dashboard-activity-feed">
                                ${dashboard.recentActivity.length ? dashboard.recentActivity.map(renderActivityItem).join('') : '<div class="scope-empty">No recent activity yet.</div>'}
                            </div>
                        </div>

                        <aside class="dashboard-panel">
                            <div class="panel-heading">
                                <div>
                                    <span class="section-kicker">Quick Launch</span>
                                    <h2>Common destinations</h2>
                                </div>
                            </div>
                            <div class="quick-action-grid">
                                ${[
                                    ['Procurement', 'Marketplace, create tender, bid', 'marketplace'],
                                    ['Communication Center', `${dashboard.unreadCount} unread messages`, 'communication-center'],
                                    ['Evaluation', 'Bid opening and scoring', 'bid-evaluation'],
                                    ['Records and History', 'Audit archive and exports', 'records-history']
                                ].map(([title, detail, nav]) => `
                                    <button class="smart-action" type="button" data-navigate="${nav}">
                                        <strong>${title}</strong>
                                        <span>${detail}</span>
                                    </button>
                                `).join('')}
                            </div>
                            <div class="status-section-list dashboard-account-compliance">
                                <div class="status-section ${dashboard.iam.isComplete ? 'done' : 'attention'}">
                                    <strong>Account and Compliance</strong>
                                    <span>${escapeWorkspaceDashboardHtml(dashboard.iam.statusLabel || dashboard.user.iamStatus)}</span>
                                    <button class="btn btn-secondary" data-navigate="account-profile">Review</button>
                                </div>
                            </div>
                        </aside>
                    </section>
                </div>
            </main>
        </div>
    `;
}

function initializeWorkspaceDashboard() {
    const root = document.querySelector('.dashboard-command-center');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';
    window.clearInterval(window.procurexDashboardRefreshTimer);
    window.procurexDashboardRefreshTimer = window.setInterval(() => {
        if (window.app?.currentPage === 'workspace-dashboard') {
            window.app.renderPage();
        } else {
            window.clearInterval(window.procurexDashboardRefreshTimer);
        }
    }, 60000);
}

window.getWorkspaceDashboardModel = buildUserDashboardModel;
window.initializeWorkspaceDashboard = initializeWorkspaceDashboard;

if (window.app) {
    window.app.renderWorkspaceDashboard = renderWorkspaceDashboard;
}
