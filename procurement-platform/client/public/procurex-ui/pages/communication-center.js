// Communication Center Page Component

const communicationCenterStorageKey = 'procurex.communicationCenter.v2.items';
const communicationCenterComposeDraftStorageKey = 'procurex.communicationCenter.v1.composeDraft';

function escapeCommunicationHtml(value = '') {
    if (typeof window.ProcureXShared?.escapeHtml === 'function') return window.ProcureXShared.escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCommunicationState() {
    if (!mockData.communicationCenterState) {
        mockData.communicationCenterState = {
            tab: 'Inbox',
            folder: 'Inbox',
            selectedId: null,
            query: '',
            date: '',
            category: 'All categories',
            composeOpen: false,
            composeDraft: null
        };
    }
    return mockData.communicationCenterState;
}

function getCommunicationAudience() {
    return mockData.pendingAccount?.accountType === 'admin' || mockData.session?.accountType === 'admin' ? 'admin' : 'user';
}

function normalizeCommunicationMailboxId(value = '') {
    return String(value || '').trim().toLowerCase();
}

function getCommunicationRoleFromType(type = '') {
    const raw = String(type || '').toLowerCase();
    if (raw.includes('admin') || raw.includes('evaluator') || raw.includes('compliance')) return 'admin';
    if (raw.includes('system')) return 'system';
    return 'user';
}

function getCommunicationDefaultMailboxId(type = '') {
    const role = getCommunicationRoleFromType(type);
    const ids = {
        user: 'user-001',
        admin: 'admin-001',
        system: 'system'
    };
    return ids[role] || `${role || 'user'}-001`;
}

function slugCommunicationMailbox(value = '') {
    return normalizeCommunicationMailboxId(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `mailbox-${Math.random().toString(16).slice(2, 8)}`;
}

function createCommunicationMailboxProfile(name = '', type = 'Business', extra = {}) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return null;
    return {
        id: extra.id || `business-${slugCommunicationMailbox(cleanName)}`,
        role: extra.role || getCommunicationRoleFromType(type),
        type,
        name: cleanName,
        email: extra.email || '',
        aliases: [
            extra.id,
            extra.email,
            cleanName,
            `business-${slugCommunicationMailbox(cleanName)}`
        ].map(normalizeCommunicationMailboxId).filter(Boolean)
    };
}

function collectCommunicationBusinessDirectory() {
    const profiles = [];
    const addProfile = (name, type = 'Business', extra = {}) => {
        const profile = createCommunicationMailboxProfile(name, type, extra);
        if (!profile) return;
        const normalizedId = normalizeCommunicationMailboxId(profile.id);
        const normalizedName = normalizeCommunicationMailboxId(profile.name);
        const existing = profiles.find(item => normalizeCommunicationMailboxId(item.id) === normalizedId || normalizeCommunicationMailboxId(item.name) === normalizedName);
        if (existing) {
            existing.aliases = Array.from(new Set([...(existing.aliases || []), ...(profile.aliases || [])]));
            if (!existing.email && profile.email) existing.email = profile.email;
            return;
        }
        profiles.push(profile);
    };

    addProfile(mockData.users?.buyer?.organization, 'Buyer', { id: 'buyer-001' });
    addProfile(mockData.users?.current?.organization, 'Business', { id: 'user-001' });
    addProfile(mockData.users?.supplier?.organization, 'Supplier', { id: 'supplier-001' });
    addProfile(mockData.users?.admin?.organization, 'Admin', { id: 'admin-001', role: 'admin' });
    (mockData.mockAuth?.accounts || []).forEach(account => addProfile(account.displayName, account.accountType === 'admin' ? 'Admin' : 'Business', {
        id: account.email,
        email: account.email,
        role: account.accountType === 'admin' ? 'admin' : 'user'
    }));
    (mockData.tenders || []).forEach(tender => {
        addProfile(tender.organization, 'Buyer');
        (tender.invitedSuppliers || []).forEach(supplier => addProfile(supplier.organization || supplier.name, 'Supplier', { email: supplier.email }));
        (tender.bids || tender.submittedBids || []).forEach(bid => addProfile(bid.supplier || bid.supplierName || bid.consultant || bid.provider, 'Supplier'));
    });
    (mockData.communicationCenter?.items || []).forEach(item => {
        addProfile(item.senderName, item.senderType, { id: item.senderId, email: item.senderEmail });
        addProfile(item.recipientName, item.recipientType, { id: item.recipientId, email: item.recipientEmail });
    });

    return profiles;
}

function getCommunicationMailboxProfiles() {
    const account = mockData.pendingAccount || {};
    const profileName = mockData.eKycProfile?.verifiedName || account.displayName || mockData.users?.current?.organization || 'Company User';
    const baseProfiles = [
        {
            id: 'user-001',
            role: 'user',
            type: 'User',
            name: profileName,
            aliases: ['user-001', profileName].map(normalizeCommunicationMailboxId)
        },
        {
            id: 'admin-001',
            role: 'admin',
            type: 'Admin',
            name: mockData.users?.admin?.organization || 'ProcureX Platform',
            aliases: ['admin-001', mockData.users?.admin?.organization || 'ProcureX Platform'].map(normalizeCommunicationMailboxId)
        },
        {
            id: 'system',
            role: 'system',
            type: 'System',
            name: 'ProcureX System',
            aliases: ['system', 'ProcureX System'].map(normalizeCommunicationMailboxId)
        }
    ];
    const profiles = [...baseProfiles];
    collectCommunicationBusinessDirectory().forEach(profile => {
        const normalizedId = normalizeCommunicationMailboxId(profile.id);
        const normalizedName = normalizeCommunicationMailboxId(profile.name);
        const existing = profiles.find(item => normalizeCommunicationMailboxId(item.id) === normalizedId || normalizeCommunicationMailboxId(item.name) === normalizedName);
        if (existing) {
            existing.aliases = Array.from(new Set([...(existing.aliases || []), ...(profile.aliases || [])]));
            if (!existing.email && profile.email) existing.email = profile.email;
            return;
        }
        profiles.push(profile);
    });
    return profiles;
}

function getCommunicationMailboxById(mailboxId = '') {
    const normalizedId = normalizeCommunicationMailboxId(mailboxId);
    return getCommunicationMailboxProfiles().find(profile => normalizeCommunicationMailboxId(profile.id) === normalizedId || (profile.aliases || []).includes(normalizedId)) || null;
}

function getCommunicationMailboxBySearch(value = '', profiles = getCommunicationMailboxProfiles()) {
    const normalizedValue = normalizeCommunicationMailboxId(value);
    if (!normalizedValue) return null;
    return profiles.find(profile => {
        const candidates = [
            profile.id,
            profile.name,
            profile.email,
            ...(profile.aliases || [])
        ].map(normalizeCommunicationMailboxId).filter(Boolean);
        return candidates.includes(normalizedValue);
    }) || null;
}

function resolveCommunicationRecipient(id = '', searchValue = '') {
    return getCommunicationMailboxById(id) || getCommunicationMailboxBySearch(searchValue);
}

function inferCommunicationRoleFromUser() {
    if (mockData.pendingAccount?.accountType === 'admin') return 'admin';
    if (mockData.session?.accountType === 'admin') return 'admin';
    return 'user';
}

function getCurrentCommunicationUser() {
    const role = inferCommunicationRoleFromUser();
    const account = mockData.pendingAccount || {};
    const session = mockData.session || {};
    const email = normalizeCommunicationMailboxId(session.email || account.email || '');
    const roleMailbox = getCommunicationMailboxById(getCommunicationDefaultMailboxId(role));
    const displayName = mockData.eKycProfile?.verifiedName
        || account.displayName
        || roleMailbox?.name
        || email
        || 'Account Details';
    const id = email || roleMailbox?.id || getCommunicationDefaultMailboxId(role);

    return {
        id: normalizeCommunicationMailboxId(id),
        email,
        role,
        type: roleMailbox?.type || role,
        name: displayName,
        organization: roleMailbox?.name || displayName,
        aliases: [
            id,
            email,
            roleMailbox?.id,
            ...(roleMailbox?.aliases || []),
            getCommunicationDefaultMailboxId(role),
            ...(role === 'admin' ? ['admin-001', 'evaluator-001'] : ['user-001', 'buyer-001', 'supplier-001'])
        ].map(normalizeCommunicationMailboxId).filter(Boolean)
    };
}

function getCommunicationParticipantId(item = {}, key = 'recipient') {
    const explicitId = item[`${key}Id`] || item[`${key}Email`];
    if (explicitId) return normalizeCommunicationMailboxId(explicitId);
    return normalizeCommunicationMailboxId(getCommunicationDefaultMailboxId(item[`${key}Type`] || key));
}

function communicationTypeMatchesUser(type = '', user = getCurrentCommunicationUser()) {
    return getCommunicationRoleFromType(type) === user.role;
}

function readCommunicationStoredItems() {
    try {
        const parsed = JSON.parse(localStorage.getItem(communicationCenterStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        localStorage.removeItem(communicationCenterStorageKey);
        return [];
    }
}

function saveCommunicationStoredItems(items = []) {
    localStorage.setItem(communicationCenterStorageKey, JSON.stringify(items));
}

function consumeCommunicationComposeDraft() {
    try {
        const parsed = JSON.parse(localStorage.getItem(communicationCenterComposeDraftStorageKey) || 'null');
        localStorage.removeItem(communicationCenterComposeDraftStorageKey);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        localStorage.removeItem(communicationCenterComposeDraftStorageKey);
        return null;
    }
}

function normalizeCommunicationSubjectForContext(subject = '', category = '') {
    const rawCategory = String(category || '').toLowerCase();
    return String(subject || 'procurement message')
        .toLowerCase()
        .replace(/^(re|fw|fwd|follow-up):\s*/i, '')
        .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g, '')
        .replace(/\b(20\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|week\s*\d+|wk\s*\d+|no\.\s*\d+|#\d+)\b/g, '')
        .replace(/\b(submitted|submission|attached|updated|update|for review|reporting)\b/g, '')
        .replace(rawCategory.includes('report') || /report/.test(String(subject || '').toLowerCase()) ? /\b(monthly|weekly|daily)\b/g : /a^/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'procurement-message';
}

function buildCommunicationContextKey(item = {}) {
    const tenderKey = normalizeCommunicationMailboxId(item.tenderReference || item.tenderId || 'not-linked');
    const categoryKey = normalizeCommunicationMailboxId(item.category || item.kind || 'message');
    const subjectKey = normalizeCommunicationSubjectForContext(item.subject || item.title, item.category);
    const participants = [item.senderId, item.recipientId]
        .map(normalizeCommunicationMailboxId)
        .filter(Boolean)
        .sort()
        .join('-') || 'participants';
    return [tenderKey, categoryKey, participants, subjectKey].filter(Boolean).join('::');
}

function normalizeCommunicationItem(item = {}) {
    const createdAt = item.createdAt || new Date().toISOString();
    const kind = item.kind || item.type || 'message';
    const senderId = getCommunicationParticipantId(item, 'sender');
    const recipientId = getCommunicationParticipantId(item, 'recipient');
    const tenderReference = item.tenderReference || item.tenderId || 'Not linked';
    const subject = item.subject || item.title || 'Procurement message';
    const category = item.category || (kind === 'alert' ? 'System Alert' : kind === 'notification' ? 'System Notification' : 'General Message');
    const contextKey = item.contextKey || buildCommunicationContextKey({
        ...item,
        kind,
        category,
        subject,
        senderId,
        recipientId,
        tenderReference
    });
    return {
        id: item.id || `comm-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        kind,
        folder: item.folder || 'inbox',
        category,
        subject,
        body: item.body || item.message || '',
        senderId,
        senderType: item.senderType || 'System',
        senderName: item.senderName || item.sender || 'ProcureX System',
        recipientId,
        recipientType: item.recipientType || 'User',
        recipientName: item.recipientName || 'Account Details',
        tenderId: item.tenderId || '',
        tenderReference,
        tenderTitle: item.tenderTitle || 'No tender linked',
        priority: item.priority || (kind === 'alert' ? 'High' : 'Normal'),
        status: item.status || 'Unread',
        read: item.read ?? !/unread|pending|action required/i.test(item.status || ''),
        visibility: item.visibility || 'Private',
        actionRequired: Boolean(item.actionRequired),
        actionLabel: item.actionLabel || '',
        actionPage: item.actionPage || '',
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
        thread: Array.isArray(item.thread) ? item.thread : [],
        relatedMessageId: item.relatedMessageId || '',
        conversationId: item.conversationId || item.threadId || item.relatedMessageId || contextKey,
        contextKey,
        actions: Array.isArray(item.actions) ? item.actions : [],
        createdAt,
        updatedAt: item.updatedAt || createdAt,
        audience: Array.isArray(item.audience) ? item.audience : ['all']
    };
}

function getCommunicationItems() {
    return [
        ...(mockData.communicationCenter?.items || []),
        ...readCommunicationStoredItems()
    ].map(normalizeCommunicationItem);
}

function addProcurexCommunicationItem(item = {}) {
    const currentUser = getCurrentCommunicationUser();
    const scopedItem = { ...item };
    if (!scopedItem.senderId && communicationTypeMatchesUser(scopedItem.senderType, currentUser)) {
        scopedItem.senderId = currentUser.id;
    }
    if (!scopedItem.recipientId && communicationTypeMatchesUser(scopedItem.recipientType, currentUser)) {
        scopedItem.recipientId = currentUser.id;
    }
    const nextItem = normalizeCommunicationItem(scopedItem);
    const stored = readCommunicationStoredItems();
    saveCommunicationStoredItems([nextItem, ...stored.filter(existing => existing.id !== nextItem.id)]);
    return nextItem;
}

function patchCommunicationItem(itemId, patch = {}) {
    const seed = mockData.communicationCenter?.items?.find(item => item.id === itemId);
    if (seed) Object.assign(seed, patch, { updatedAt: new Date().toISOString() });

    const stored = readCommunicationStoredItems();
    const nextStored = stored.map(item => item.id === itemId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
    saveCommunicationStoredItems(nextStored);
}

function formatCommunicationDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCommunicationInputDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function getCommunicationBadgeClass(value = '') {
    const raw = String(value).toLowerCase();
    if (raw.includes('urgent') || raw.includes('action') || raw.includes('rejected') || raw.includes('returned') || raw.includes('high')) return 'badge-error';
    if (raw.includes('pending') || raw.includes('unread') || raw.includes('normal')) return 'badge-warning';
    if (raw.includes('resolved') || raw.includes('completed') || raw.includes('answered') || raw.includes('read')) return 'badge-success';
    return 'badge-info';
}

function communicationIdMatchesUser(participantId = '', user = getCurrentCommunicationUser()) {
    const normalizedId = normalizeCommunicationMailboxId(participantId);
    return Boolean(normalizedId && user.aliases.includes(normalizedId));
}

function isCurrentCommunicationProfile(profile = {}, user = getCurrentCommunicationUser()) {
    const currentIds = [user.id, user.email].map(normalizeCommunicationMailboxId).filter(Boolean);
    const profileIds = [profile.id, profile.email].map(normalizeCommunicationMailboxId).filter(Boolean);
    const sameId = profileIds.some(id => currentIds.includes(id));
    const sameName = normalizeCommunicationMailboxId(profile.name) === normalizeCommunicationMailboxId(user.organization);
    return sameId || sameName;
}

function isCommunicationUserItem(item, user = getCurrentCommunicationUser()) {
    const audience = getCommunicationAudience();
    if (audience === 'admin') {
        if (item.folder === 'sent') return communicationIdMatchesUser(item.senderId, user);
        return item.audience?.includes('admin') || communicationIdMatchesUser(item.recipientId, user);
    }
    if (item.folder === 'sent') return communicationIdMatchesUser(item.senderId, user);
    return communicationIdMatchesUser(item.recipientId, user);
}

function filterCommunicationItems(items, state) {
    const query = String(state.query || '').trim().toLowerCase();
    const selectedDate = String(state.date || '').trim();
    return items.filter(item => {
        if (state.tab === 'Sent' && item.folder !== 'sent') return false;
        if (state.tab === 'Drafts') return false;
        if (state.tab === 'Archived' && item.folder !== 'archived' && item.status !== 'Archived') return false;
        if (state.tab === 'Trash' && item.status !== 'Deleted') return false;
        if (state.tab === 'Unread' && item.read) return false;
        if (state.tab === 'Inbox' && (item.folder === 'sent' || item.folder === 'archived' || item.status === 'Deleted')) return false;
        if (state.category !== 'All categories' && item.category !== state.category) return false;
        if (selectedDate) {
            if (formatCommunicationInputDate(item.createdAt) !== selectedDate) return false;
        }
        if (!query) return true;
        const searchableValues = [
            item.senderName,
            item.recipientName,
            item.subject,
            item.tenderReference,
            item.tenderTitle,
            item.body,
            item.category,
            item.status,
            item.priority,
            item.visibility,
            item.actionLabel,
            item.createdAt,
            formatCommunicationDate(item.createdAt),
            ...(item.attachments || []).map(attachment => getCommunicationAttachmentName(attachment)),
            ...(item.thread || []).flatMap(entry => [entry.senderName, entry.senderType, entry.body, entry.notice])
        ];
        return searchableValues.some(value => String(value || '').toLowerCase().includes(query));
    }).sort((first, second) => {
        const firstTime = Date.parse(first.createdAt) || 0;
        const secondTime = Date.parse(second.createdAt) || 0;
        return secondTime - firstTime;
    });
}

function renderCommunicationOptions(values = [], selected = '', firstLabel = '') {
    const options = firstLabel ? [`<option>${escapeCommunicationHtml(firstLabel)}</option>`] : [];
    values.forEach(value => options.push(`<option ${value === selected ? 'selected' : ''}>${escapeCommunicationHtml(value)}</option>`));
    return options.join('');
}

function getCommunicationAttachmentName(attachment = {}, index = 0) {
    return attachment.name || attachment.fileName || `Attachment ${index + 1}`;
}

function renderCommunicationAttachmentActions(attachments = []) {
    if (!attachments.length) return '';
    return `
        <div class="communication-attachments">
            ${attachments.map((attachment, index) => `
                <div class="communication-attachment-item">
                    <span>${escapeCommunicationHtml(getCommunicationAttachmentName(attachment, index))}</span>
                    <button type="button" data-communication-download-attachment="${escapeCommunicationHtml(String(index))}">Download</button>
                    <button type="button" data-communication-open-attachment="${escapeCommunicationHtml(String(index))}">Open</button>
                </div>
            `).join('')}
        </div>
    `;
}

function getCommunicationAttachmentBlobUrl(attachment = {}) {
    if (attachment.url || attachment.href || attachment.dataUrl) {
        return attachment.url || attachment.href || attachment.dataUrl;
    }
    const name = getCommunicationAttachmentName(attachment);
    const body = attachment.content || `ProcureX attachment placeholder for ${name}.`;
    const type = attachment.fileType?.includes('/') ? attachment.fileType : 'text/plain';
    return URL.createObjectURL(new Blob([body], { type }));
}

function downloadCommunicationAttachment(attachment = {}, index = 0) {
    const name = getCommunicationAttachmentName(attachment, index);
    const url = getCommunicationAttachmentBlobUrl(attachment);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (url.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

function openCommunicationAttachment(attachment = {}, index = 0) {
    const url = getCommunicationAttachmentBlobUrl(attachment);
    const opened = window.open(url, '_blank', 'noopener');
    if (url.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    if (!opened) {
        alert(`Allow pop-ups to open ${getCommunicationAttachmentName(attachment, index)}.`);
    }
}

function renderCommunicationSidebar(state, counts) {
    const folders = [
        ['Inbox', counts.inbox],
        ['Sent', counts.sent],
        ['Drafts', counts.drafts],
        ['Archived', counts.archived],
        ['Trash', counts.trash]
    ];
    return `
        <aside class="communication-folders">
            <div class="communication-folder-title">
                <strong>Communication Center</strong>
                <span>Tender inbox</span>
            </div>
            <div class="communication-folder-list">
                ${folders.map(([folder, count]) => `
                    <button type="button" class="${state.tab === folder ? 'active' : ''}" data-communication-tab="${escapeCommunicationHtml(folder)}">
                        <span>${escapeCommunicationHtml(folder)}</span>
                        <em>${count}</em>
                    </button>
                `).join('')}
            </div>
        </aside>
    `;
}

function renderCommunicationRow(item, selectedId) {
    const isSentMessage = item.folder === 'sent';
    const displayName = isSentMessage ? item.recipientName : item.senderName;
    const displayLabel = isSentMessage ? 'Receiver' : 'Sender';
    return `
        <button class="communication-row ${item.read ? '' : 'unread'} ${item.id === selectedId ? 'active' : ''}" type="button" data-communication-select="${escapeCommunicationHtml(item.id)}">
            <span class="communication-unread-dot" aria-hidden="true"></span>
            <div class="communication-row-main">
                <div class="communication-row-top">
                    <strong>${escapeCommunicationHtml(displayName)}</strong>
                    <time>${escapeCommunicationHtml(formatCommunicationDate(item.createdAt))}</time>
                </div>
                <h3>${escapeCommunicationHtml(item.subject)}</h3>
                <p>${escapeCommunicationHtml(item.body)}</p>
                <div class="communication-row-meta">
                    <span>${escapeCommunicationHtml(displayLabel)}</span>
                    <span>Tender: ${escapeCommunicationHtml(item.tenderReference)}</span>
                    <span>${escapeCommunicationHtml(item.category)}</span>
                </div>
            </div>
            <div class="communication-row-badges">
                <span class="badge ${getCommunicationBadgeClass(item.status)}">${escapeCommunicationHtml(item.status)}</span>
            </div>
        </button>
    `;
}

function renderCommunicationThread(item) {
    const thread = item.thread?.length ? item.thread : [
        { senderType: item.senderType, senderName: item.senderName, body: item.body, createdAt: item.createdAt }
    ];
    return `
        <div class="communication-thread">
            ${thread.map(entry => `
                <article>
                    <div>
                        <strong>${escapeCommunicationHtml(entry.senderName || entry.senderType || 'User')}</strong>
                        <time>${escapeCommunicationHtml(formatCommunicationDate(entry.createdAt || item.createdAt))}</time>
                    </div>
                    <p>${escapeCommunicationHtml(entry.body || '')}</p>
                    ${entry.notice ? `<span class="badge badge-info">${escapeCommunicationHtml(entry.notice)}</span>` : ''}
                </article>
            `).join('')}
        </div>
    `;
}

function getCommunicationConversationItems(item = {}, items = []) {
    const conversationId = item.conversationId || item.contextKey || '';
    const contextKey = item.contextKey || '';
    const relatedIds = new Set([item.id, item.relatedMessageId].filter(Boolean));
    return items
        .filter(entry => {
            if (!entry || entry.id === item.id) return true;
            if (conversationId && entry.conversationId === conversationId) return true;
            if (contextKey && entry.contextKey === contextKey) return true;
            if (relatedIds.has(entry.id) || relatedIds.has(entry.relatedMessageId)) return true;
            if (entry.relatedMessageId === item.id || item.relatedMessageId === entry.id) return true;
            return false;
        })
        .sort((first, second) => (Date.parse(first.createdAt) || 0) - (Date.parse(second.createdAt) || 0));
}

function renderCommunicationContinuityPanel(item = {}, items = []) {
    const conversationItems = getCommunicationConversationItems(item, items);
    if (conversationItems.length < 2) return '';
    return `
        <section class="communication-continuity-panel">
            <div>
                <span class="section-kicker">Context trail</span>
                <strong>${conversationItems.length} linked messages in this conversation</strong>
            </div>
            <div class="communication-continuity-list">
                ${conversationItems.map(entry => `
                    <button type="button" class="${entry.id === item.id ? 'active' : ''}" data-communication-select="${escapeCommunicationHtml(entry.id)}">
                        <span>${escapeCommunicationHtml(formatCommunicationDate(entry.createdAt))}</span>
                        <strong>${escapeCommunicationHtml(entry.subject)}</strong>
                        <em>${escapeCommunicationHtml(entry.folder === 'sent' ? `To ${entry.recipientName}` : `From ${entry.senderName}`)}</em>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function isOpenClarificationRequest(item = {}) {
    const rawStatus = String(item.status || '').toLowerCase();
    if (item.kind !== 'clarification' || item.folder === 'sent') return false;
    if (/answered|resolved|published|closed|replied/.test(rawStatus)) return false;
    return /pending|submitted|unread|action required/.test(rawStatus);
}

function isBidderClarificationAnswer(item = {}) {
    const rawStatus = String(item.status || '').toLowerCase();
    const rawCategory = String(item.category || '').toLowerCase();
    const rawSenderType = String(item.senderType || '').toLowerCase();
    const answerActionLabels = ['View Response', 'Ask Follow-up'];
    if (item.folder === 'sent') return false;
    if (isOpenClarificationRequest(item)) return false;
    if (item.kind !== 'clarification' && !rawCategory.includes('clarification')) return false;
    if (!rawSenderType.includes('buyer') && !answerActionLabels.includes(item.actionLabel)) return false;
    return /answered|resolved|published|replied|read/.test(rawStatus) || item.actionLabel === 'View Response';
}

function isInboxCommunicationItem(item = {}) {
    return item.folder !== 'sent' && item.folder !== 'archived' && item.status !== 'Deleted';
}

function canReplyToCommunicationItem(item = {}) {
    if (!isInboxCommunicationItem(item)) return false;
    if (item.senderId === 'system' || String(item.senderType || '').toLowerCase().includes('system')) return false;
    if (isOpenClarificationRequest(item) || isBidderClarificationAnswer(item)) return false;
    return !item.actionPage || item.actionPage === 'communication-center' || item.kind === 'message';
}

function isCommunicationReportMessage(item = {}) {
    return isInboxCommunicationItem(item) && /reporting documents|report/i.test(`${item.category || ''} ${item.subject || ''}`);
}

function getCommunicationPrimaryAction(item = {}) {
    if (!isInboxCommunicationItem(item) || isBidderClarificationAnswer(item)) return '';
    if (isCommunicationReportMessage(item)) {
        return `<button class="btn btn-primary" type="button" data-communication-report-feedback="${escapeCommunicationHtml(item.id)}">Offer Feedback</button>`;
    }
    if (item.actionPage && item.actionPage !== 'communication-center') {
        return `<button class="btn btn-primary" type="button" data-navigate="${escapeCommunicationHtml(item.actionPage)}">${escapeCommunicationHtml(item.actionLabel || 'Open')}</button>`;
    }
    if (canReplyToCommunicationItem(item)) {
        return `<button class="btn btn-primary" type="button" data-communication-reply-message="${escapeCommunicationHtml(item.id)}">Reply</button>`;
    }
    return '';
}

function getCommunicationActionText(item = {}) {
    if (item.kind === 'clarification') {
        if (item.folder === 'sent') return 'Await buyer response';
        if (isOpenClarificationRequest(item)) return 'Provide clarification answer';
        if (isBidderClarificationAnswer(item)) return 'No action needed if satisfied';
        return 'Clarification answered';
    }
    if (isBidderClarificationAnswer(item)) return 'No action needed if satisfied';
    if (isCommunicationReportMessage(item)) return 'Offer feedback on this report';
    if (canReplyToCommunicationItem(item)) return 'Reply to this message';
    return item.actionLabel || (item.read ? 'Message reviewed' : 'Review message');
}

function renderCommunicationReplyBox(item) {
    if (!isOpenClarificationRequest(item)) return '';
    return `
        <form class="communication-reply-box" data-communication-reply="${escapeCommunicationHtml(item.id)}">
            <div>
                <span class="section-kicker">Buyer response</span>
                <strong>Answer this clarification request</strong>
            </div>
            <label>
                <span>Reply visibility</span>
                <select class="form-input" name="visibility">
                    ${renderCommunicationOptions(mockData.communicationCenter?.replyVisibilityOptions || [], 'Reply to this supplier only')}
                </select>
            </label>
            <label>
                <span>Response message</span>
                <textarea class="form-input" name="body" rows="4" placeholder="Write the buyer response"></textarea>
            </label>
            <div class="communication-reply-actions">
                <button class="btn btn-secondary" type="button">Attach</button>
                <button class="btn btn-primary" type="submit">Send Response</button>
            </div>
        </form>
    `;
}

function renderCommunicationDetail(item, fullScreen = false, allItems = []) {
    if (!item) {
        return `
            <aside class="communication-detail empty">
                <strong>Select a message</strong>
                <span>Open an inbox item to view its tender context, thread, attachments, and available actions.</span>
            </aside>
        `;
    }
    const isSentMessage = item.folder === 'sent';
    const contextPartyLabel = isSentMessage ? 'Receiver' : 'Sender';
    const contextPartyName = isSentMessage ? item.recipientName : item.senderName;
    return `
        <aside class="communication-detail ${fullScreen ? 'full-screen' : ''}">
            <section class="communication-context-panel communication-context-panel-primary">
                <div>
                    <span class="section-kicker">Message context</span>
                    <strong>${escapeCommunicationHtml(item.tenderTitle)}</strong>
                </div>
                <div class="record-summary compact">
                    <div><span>${escapeCommunicationHtml(contextPartyLabel)}</span><strong>${escapeCommunicationHtml(contextPartyName)}</strong></div>
                    <div><span>Date</span><strong>${escapeCommunicationHtml(formatCommunicationDate(item.createdAt))}</strong></div>
                    <div><span>Tender reference</span><strong>${escapeCommunicationHtml(item.tenderReference)}</strong></div>
                    <div><span>Status</span><strong>${item.kind === 'alert' ? 'Correction required' : 'Workflow active'}</strong></div>
                    <div><span>Visibility</span><strong>${escapeCommunicationHtml(item.visibility)}</strong></div>
                </div>
                <div class="communication-detail-badges">
                    <span class="badge ${getCommunicationBadgeClass(item.category)}">${escapeCommunicationHtml(item.category)}</span>
                    <span class="badge ${getCommunicationBadgeClass(item.status)}">${escapeCommunicationHtml(item.status)}</span>
                </div>
            </section>
            <section class="communication-message-body">
                <span class="section-kicker">Message</span>
                <h2>${escapeCommunicationHtml(item.subject)}</h2>
                <p>${escapeCommunicationHtml(item.body)}</p>
                ${renderCommunicationAttachmentActions(item.attachments)}
            </section>
            ${renderCommunicationContinuityPanel(item, allItems)}
            <section class="communication-action-panel">
                <div>
                    <span class="section-kicker">Next action</span>
                    <strong>${escapeCommunicationHtml(getCommunicationActionText(item))}</strong>
                </div>
                <div class="inline-actions">
                    ${isBidderClarificationAnswer(item) ? `<button class="btn btn-primary" type="button" data-communication-followup="${escapeCommunicationHtml(item.id)}">Ask Further Clarification</button>` : ''}
                    ${getCommunicationPrimaryAction(item)}
                    <button class="btn btn-secondary" type="button" data-communication-archive="${escapeCommunicationHtml(item.id)}">Archive</button>
                </div>
            </section>
            ${renderCommunicationReplyBox(item)}
        </aside>
    `;
}

function getCommunicationRecipientProfiles(user = getCurrentCommunicationUser()) {
    return getCommunicationMailboxProfiles()
        .filter(profile => profile.id !== 'system' && !isCurrentCommunicationProfile(profile, user))
        .sort((first, second) => first.name.localeCompare(second.name));
}

function getFilteredCommunicationRecipientProfiles(profiles = [], searchValue = '') {
    const normalizedSearch = normalizeCommunicationMailboxId(searchValue);
    return profiles.filter(profile => !normalizedSearch || [profile.name, profile.email, profile.id]
        .some(value => normalizeCommunicationMailboxId(value).includes(normalizedSearch)));
}

function renderCommunicationRecipientOptions(profiles = [], selectedRecipientId = '', searchValue = '') {
    const filteredProfiles = getFilteredCommunicationRecipientProfiles(profiles, searchValue);
    if (!filteredProfiles.length) {
        return '<option value="">No registered businesses match this search</option>';
    }

    const selectedVisible = filteredProfiles.some(profile => profile.id === selectedRecipientId);
    const options = selectedVisible ? [] : ['<option value="">Select business</option>'];
    filteredProfiles.forEach(profile => {
        options.push(`<option value="${escapeCommunicationHtml(profile.id)}" ${profile.id === selectedRecipientId ? 'selected' : ''}>${escapeCommunicationHtml(profile.name)}</option>`);
    });
    return options.join('');
}

function renderCommunicationCompose(state) {
    if (!state.composeOpen) return '';
    const categories = mockData.communicationCenter?.categories || [];
    const currentUser = getCurrentCommunicationUser();
    const recipientProfiles = getCommunicationRecipientProfiles(currentUser);
    const draft = state.composeDraft || {};
    const selectedCategory = draft.category || 'General Message';
    const selectedRecipientId = draft.recipientId !== undefined ? draft.recipientId : recipientProfiles[0]?.id || '';
    const selectedRecipient = selectedRecipientId ? getCommunicationMailboxById(selectedRecipientId) || recipientProfiles[0] || null : null;
    const recipientSearchValue = draft.recipientSearch || '';
    return `
        <form class="communication-compose-panel ${state.composeOpen ? 'full-screen' : ''}" data-communication-compose>
            <div class="panel-heading">
                <div><span class="section-kicker">New message</span><h2>Send procurement communication</h2></div>
                <button class="btn btn-secondary" type="button" data-communication-compose-close>Close</button>
            </div>
            <div class="communication-compose-grid">
                <label><span>From mailbox</span><input class="form-input" value="${escapeCommunicationHtml(currentUser.organization)}" readonly></label>
                <label><span>Category</span><select class="form-input" name="category" data-communication-compose-field>${renderCommunicationOptions(categories, selectedCategory)}</select></label>
                <label>
                    <span>Recipient business</span>
                    <input class="form-input" name="recipientSearch" value="${escapeCommunicationHtml(recipientSearchValue)}" placeholder="Search registered business name" autocomplete="off" data-communication-recipient-search>
                    <select class="form-input" name="recipientId" data-communication-recipient-select>
                        ${renderCommunicationRecipientOptions(recipientProfiles, selectedRecipient?.id || '', recipientSearchValue)}
                    </select>
                </label>
                <label><span>Tender reference</span><input class="form-input" name="tenderReference" value="${escapeCommunicationHtml(draft.tenderReference || draft.tenderId || 'PX-WRK-2026-001')}" data-communication-compose-field></label>
                <input type="hidden" name="tenderId" value="${escapeCommunicationHtml(draft.tenderId || '')}">
                <input type="hidden" name="tenderTitle" value="${escapeCommunicationHtml(draft.tenderTitle || '')}">
                <input type="hidden" name="kind" value="${escapeCommunicationHtml(draft.kind || '')}">
                <label class="span-2"><span>Subject</span><input class="form-input" name="subject" placeholder="Subject" value="${escapeCommunicationHtml(draft.subject || '')}" data-communication-compose-field></label>
                <label class="span-2"><span>Message</span><textarea class="form-input" name="body" rows="4" placeholder="Write your message" data-communication-compose-field>${escapeCommunicationHtml(draft.body || '')}</textarea></label>
            </div>
            <div class="inline-actions">
                <label class="btn btn-secondary communication-file-button">
                    Attach File
                    <input type="file" data-communication-attachment multiple hidden>
                </label>
                <span class="communication-attachment-preview" data-communication-attachment-preview>${(draft.attachments || []).map(item => escapeCommunicationHtml(item.name)).join(', ')}</span>
                <button class="btn btn-primary" type="submit">Send Message</button>
            </div>
        </form>
    `;
}

function getProcurexUnreadCommunicationCount() {
    const user = getCurrentCommunicationUser();
    return getCommunicationItems()
        .filter(item => isCommunicationUserItem(item, user))
        .filter(item => !item.read)
        .length;
}

function renderCommunicationCenterInner(root) {
    const state = getCommunicationState();
    const currentUser = getCurrentCommunicationUser();
    const allItems = getCommunicationItems().filter(item => isCommunicationUserItem(item, currentUser));
    const counts = {
        inbox: allItems.filter(item => item.folder !== 'sent' && item.folder !== 'archived' && item.status !== 'Deleted').length,
        clarifications: allItems.filter(item => item.kind === 'clarification').length,
        alerts: allItems.filter(item => item.kind === 'alert').length,
        sent: allItems.filter(item => item.folder === 'sent').length,
        drafts: 0,
        archived: allItems.filter(item => item.folder === 'archived' || item.status === 'Archived').length,
        trash: allItems.filter(item => item.status === 'Deleted').length
    };
    const filtered = filterCommunicationItems(allItems, state);
    const selected = state.selectedId ? allItems.find(item => item.id === state.selectedId) || null : null;
    if (state.selectedId && !selected) state.selectedId = null;
    const unreadCount = allItems.filter(item => !item.read).length;
    const actionCount = allItems.filter(item => item.actionRequired || /pending|action required/i.test(item.status)).length;
    const messageView = Boolean(selected);
    const composeView = state.composeOpen;

    root.innerHTML = `
        <main class="communication-center-page">
            ${composeView || messageView ? '' : `
                <section class="communication-hero">
                    <div>
                        <span class="section-kicker">Personal mailbox</span>
                        <h1>Communication Center</h1>
                        <p>${escapeCommunicationHtml(currentUser.organization)} only sees messages sent to this mailbox or messages sent from it.</p>
                    </div>
                    <div class="communication-summary">
                        <div><strong>${unreadCount}</strong><span>Unread</span></div>
                        <div><strong>${actionCount}</strong><span>Action required</span></div>
                    </div>
                </section>
            `}

            ${composeView ? `
                <section class="communication-compose-view">
                    ${renderCommunicationCompose(state)}
                </section>
            ` : messageView ? `
                <section class="communication-message-view">
                    ${renderCommunicationDetail(selected, true, allItems)}
                </section>
            ` : `
                <section class="communication-shell">
                    ${renderCommunicationSidebar(state, counts)}
                    <div class="communication-main">
                        <div class="communication-toolbar">
                            <input class="form-input" data-communication-search value="${escapeCommunicationHtml(state.query)}" placeholder="Search sender, receiver, tender, subject, status">
                            <input class="form-input" type="${state.date ? 'date' : 'text'}" data-communication-date-search value="${escapeCommunicationHtml(state.date || '')}" placeholder="Search by date" aria-label="Search messages by date">
                            ${state.query || state.date ? '<button class="btn btn-secondary" type="button" data-communication-clear-search>Clear</button>' : ''}
                            <button class="btn btn-primary" type="button" data-communication-compose-open>New Message</button>
                        </div>
                        <div class="communication-tabs">
                            ${['Inbox', 'Sent', 'Archived', 'Unread'].map(tab => `
                                <button type="button" class="${state.tab === tab ? 'active' : ''}" data-communication-tab="${tab}">${tab}</button>
                            `).join('')}
                        </div>
                        <div class="communication-list">
                            ${filtered.length ? filtered.map(item => renderCommunicationRow(item, null)).join('') : '<div class="scope-empty">No communication items match this view.</div>'}
                        </div>
                    </div>
                </section>
            `}
        </main>
    `;
}

function renderCommunicationCenter() {
    return '<div class="workspace-home"><div class="workspace-shell" data-communication-center></div></div>';
}

function pushCommunicationMessageHistory(itemId) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'communication-center');
    history.pushState(
        { page: 'communication-center', communicationMessageId: itemId },
        '',
        `${url.pathname}${url.search}${url.hash}`
    );
}

function pushCommunicationComposeHistory() {
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'communication-center');
    history.pushState(
        { page: 'communication-center', communicationCompose: true },
        '',
        `${url.pathname}${url.search}${url.hash}`
    );
}

function updateCommunicationComposeDraftField(field, value) {
    const state = getCommunicationState();
    state.composeDraft = {
        ...(state.composeDraft || {}),
        [field]: value
    };
}

function updateCommunicationRecipientDraft(searchValue, form) {
    const profiles = getCommunicationRecipientProfiles();
    const filteredProfiles = getFilteredCommunicationRecipientProfiles(profiles, searchValue);
    const currentRecipient = getCommunicationMailboxById(getCommunicationState().composeDraft?.recipientId || '');
    const selectedRecipient = currentRecipient && filteredProfiles.some(profile => profile.id === currentRecipient.id) ? currentRecipient : filteredProfiles[0] || null;
    const recipientSelect = form?.querySelector('[data-communication-recipient-select]');
    updateCommunicationComposeDraftField('recipientSearch', searchValue);
    updateCommunicationComposeDraftField('recipientId', selectedRecipient?.id || '');
    if (recipientSelect) {
        recipientSelect.innerHTML = renderCommunicationRecipientOptions(profiles, selectedRecipient?.id || '', searchValue);
        recipientSelect.value = selectedRecipient?.id || '';
    }
}

function updateCommunicationSelectedRecipient(recipientId, form) {
    const recipient = getCommunicationMailboxById(recipientId);
    const searchField = form?.querySelector('[data-communication-recipient-search]');
    updateCommunicationComposeDraftField('recipientId', recipient?.id || '');
    updateCommunicationComposeDraftField('recipientSearch', searchField?.value || '');
}

function syncCommunicationComposeDraft(form) {
    if (!form) return;
    const data = new FormData(form);
    const nextDraft = {
        ...(getCommunicationState().composeDraft || {}),
        category: data.get('category') || 'General Message',
        recipientId: data.get('recipientId') || '',
        recipientSearch: data.get('recipientSearch') || '',
        tenderReference: data.get('tenderReference') || '',
        tenderId: data.get('tenderId') || '',
        tenderTitle: data.get('tenderTitle') || '',
        kind: data.get('kind') || '',
        subject: data.get('subject') || '',
        body: data.get('body') || ''
    };
    getCommunicationState().composeDraft = nextDraft;
}

function focusCommunicationFilter(selector, cursorPosition = null) {
    requestAnimationFrame(() => {
        const input = document.querySelector(selector);
        if (!input) return;
        input.focus();
        if (cursorPosition !== null && typeof input.setSelectionRange === 'function') {
            input.setSelectionRange(cursorPosition, cursorPosition);
        }
    });
}

function openCommunicationFollowUpCompose(item = {}) {
    const state = getCommunicationState();
    const recipient = getCommunicationMailboxById(item.senderId) || getCommunicationMailboxBySearch(item.senderName);
    state.composeDraft = {
        category: 'Tender Clarification',
        recipientId: recipient?.id || item.senderId || '',
        recipientSearch: item.senderName || recipient?.name || '',
        tenderReference: item.tenderReference || item.tenderId || '',
        tenderId: item.tenderId || item.tenderReference || '',
        tenderTitle: item.tenderTitle || '',
        kind: 'clarification',
        subject: `Follow-up: ${String(item.subject || 'Clarification response').replace(/^Re:\s*/i, '')}`,
        body: '',
        relatedMessageId: item.id
    };
    state.composeOpen = true;
    state.selectedId = null;
    pushCommunicationComposeHistory();
}

function openCommunicationReplyCompose(item = {}) {
    const state = getCommunicationState();
    const recipient = getCommunicationMailboxById(item.senderId) || getCommunicationMailboxBySearch(item.senderName);
    state.composeDraft = {
        category: item.category || 'General Message',
        recipientId: recipient?.id || item.senderId || '',
        recipientSearch: item.senderName || recipient?.name || '',
        tenderReference: item.tenderReference || item.tenderId || '',
        tenderId: item.tenderId || item.tenderReference || '',
        tenderTitle: item.tenderTitle || '',
        kind: item.kind === 'clarification' ? 'clarification' : 'message',
        subject: `Re: ${String(item.subject || 'Procurement message').replace(/^Re:\s*/i, '')}`,
        body: '',
        relatedMessageId: item.id
    };
    state.composeOpen = true;
    state.selectedId = null;
    pushCommunicationComposeHistory();
}

function openCommunicationReportFeedbackCompose(item = {}) {
    const state = getCommunicationState();
    const recipient = getCommunicationMailboxById(item.senderId) || getCommunicationMailboxBySearch(item.senderName);
    state.composeDraft = {
        category: 'Reporting Documents',
        recipientId: recipient?.id || item.senderId || '',
        recipientSearch: item.senderName || recipient?.name || '',
        tenderReference: item.tenderReference || item.tenderId || '',
        tenderId: item.tenderId || item.tenderReference || '',
        tenderTitle: item.tenderTitle || '',
        kind: 'message',
        subject: `Feedback: ${String(item.subject || 'Submitted report').replace(/^(Re|Feedback):\s*/i, '')}`,
        body: 'Acknowledged. ',
        relatedMessageId: item.id
    };
    state.composeOpen = true;
    state.selectedId = null;
    pushCommunicationComposeHistory();
}

function initializeCommunicationCenter() {
    const root = document.querySelector('[data-communication-center]');
    if (!root || root.dataset.ready === 'true') return;
    const state = getCommunicationState();
    const pendingDraft = consumeCommunicationComposeDraft();
    state.selectedId = null;
    state.tab = 'Inbox';
    state.folder = 'Inbox';
    state.query = '';
    state.date = '';
    state.category = 'All categories';
    state.composeOpen = false;
    state.composeDraft = null;
    if (pendingDraft) {
        state.composeDraft = pendingDraft;
        state.composeOpen = true;
        state.tab = pendingDraft.tab || 'Inbox';
        state.folder = state.tab;
        state.category = 'All categories';
    }

    const render = () => renderCommunicationCenterInner(root);
    render();

    root.addEventListener('click', (event) => {
        const state = getCommunicationState();
        if (event.target.matches('[data-communication-date-search]')) {
            event.target.type = 'date';
            if (typeof event.target.showPicker === 'function') {
                event.target.showPicker();
            }
            return;
        }

        const selectButton = event.target.closest('[data-communication-select]');
        if (selectButton) {
            state.selectedId = selectButton.dataset.communicationSelect;
            const selectedItem = getCommunicationItems().find(item => item.id === state.selectedId);
            const readPatch = { read: true };
            if (/^unread$/i.test(String(selectedItem?.status || ''))) {
                readPatch.status = 'Read';
            }
            patchCommunicationItem(state.selectedId, readPatch);
            pushCommunicationMessageHistory(state.selectedId);
            render();
            return;
        }

        const tabButton = event.target.closest('[data-communication-tab]');
        if (tabButton) {
            state.tab = tabButton.dataset.communicationTab;
            state.folder = state.tab;
            state.selectedId = null;
            render();
            return;
        }

        if (event.target.closest('[data-communication-compose-open]')) {
            state.composeOpen = true;
            state.composeDraft = null;
            state.selectedId = null;
            pushCommunicationComposeHistory();
            render();
            return;
        }

        if (event.target.closest('[data-communication-compose-close]')) {
            state.composeOpen = false;
            state.composeDraft = null;
            render();
            return;
        }

        if (event.target.closest('[data-communication-clear-search]')) {
            state.query = '';
            state.date = '';
            render();
            return;
        }

        const followUpButton = event.target.closest('[data-communication-followup]');
        if (followUpButton) {
            const item = getCommunicationItems().find(entry => entry.id === followUpButton.dataset.communicationFollowup);
            if (item) {
                openCommunicationFollowUpCompose(item);
                render();
            }
            return;
        }

        const replyMessageButton = event.target.closest('[data-communication-reply-message]');
        if (replyMessageButton) {
            const item = getCommunicationItems().find(entry => entry.id === replyMessageButton.dataset.communicationReplyMessage);
            if (item) {
                openCommunicationReplyCompose(item);
                render();
            }
            return;
        }

        const reportFeedbackButton = event.target.closest('[data-communication-report-feedback]');
        if (reportFeedbackButton) {
            const item = getCommunicationItems().find(entry => entry.id === reportFeedbackButton.dataset.communicationReportFeedback);
            if (item) {
                openCommunicationReportFeedbackCompose(item);
                render();
            }
            return;
        }

        const archiveButton = event.target.closest('[data-communication-archive]');
        if (archiveButton) {
            patchCommunicationItem(archiveButton.dataset.communicationArchive, { folder: 'archived', status: 'Archived', read: true });
            render();
            return;
        }

        const downloadAttachmentButton = event.target.closest('[data-communication-download-attachment]');
        if (downloadAttachmentButton) {
            const state = getCommunicationState();
            const item = getCommunicationItems().find(entry => entry.id === state.selectedId);
            const attachmentIndex = Number(downloadAttachmentButton.dataset.communicationDownloadAttachment);
            const attachment = item?.attachments?.[attachmentIndex];
            if (attachment) {
                downloadCommunicationAttachment(attachment, attachmentIndex);
                if (confirm('Download started. Open the attachment now? Choose Cancel to keep it saved.')) {
                    openCommunicationAttachment(attachment, attachmentIndex);
                }
            }
            return;
        }

        const openAttachmentButton = event.target.closest('[data-communication-open-attachment]');
        if (openAttachmentButton) {
            const state = getCommunicationState();
            const item = getCommunicationItems().find(entry => entry.id === state.selectedId);
            const attachmentIndex = Number(openAttachmentButton.dataset.communicationOpenAttachment);
            const attachment = item?.attachments?.[attachmentIndex];
            if (attachment) {
                openCommunicationAttachment(attachment, attachmentIndex);
            }
            return;
        }

    });

    root.addEventListener('input', (event) => {
        const state = getCommunicationState();
        const recipientSearch = event.target.closest('[data-communication-recipient-search]');
        if (recipientSearch) {
            updateCommunicationRecipientDraft(recipientSearch.value, recipientSearch.closest('[data-communication-compose]'));
            return;
        }
        const composeField = event.target.closest('[data-communication-compose-field]');
        if (composeField) {
            updateCommunicationComposeDraftField(composeField.name, composeField.value);
            return;
        }
        if (event.target.matches('[data-communication-search]')) {
            const cursorPosition = event.target.selectionStart;
            state.query = event.target.value;
            render();
            focusCommunicationFilter('[data-communication-search]', cursorPosition);
            return;
        }
        if (event.target.matches('[data-communication-date-search]')) {
            event.target.type = 'date';
            state.date = event.target.value;
            render();
            focusCommunicationFilter('[data-communication-date-search]');
        }
    });

    root.addEventListener('change', (event) => {
        const state = getCommunicationState();
        const recipientSearch = event.target.closest('[data-communication-recipient-search]');
        if (recipientSearch) {
            updateCommunicationRecipientDraft(recipientSearch.value, recipientSearch.closest('[data-communication-compose]'));
            return;
        }
        const recipientSelect = event.target.closest('[data-communication-recipient-select]');
        if (recipientSelect) {
            updateCommunicationSelectedRecipient(recipientSelect.value, recipientSelect.closest('[data-communication-compose]'));
            return;
        }
        const composeField = event.target.closest('[data-communication-compose-field]');
        if (composeField) {
            updateCommunicationComposeDraftField(composeField.name, composeField.value);
            return;
        }
        if (event.target.matches('[data-communication-attachment]')) {
            syncCommunicationComposeDraft(event.target.closest('[data-communication-compose]'));
            state.composeDraft = {
                ...(state.composeDraft || {}),
                attachments: Array.from(event.target.files || []).map(file => ({
                    id: `att-${Date.now()}-${file.name}`,
                    name: file.name,
                    fileType: file.type || 'file',
                    size: file.size
                }))
            };
        }
        if (event.target.matches('[data-communication-date-search]')) {
            state.date = event.target.value;
        }
        render();
    });

    root.addEventListener('submit', (event) => {
        const composeForm = event.target.closest('[data-communication-compose]');
        const replyForm = event.target.closest('[data-communication-reply]');
        if (!composeForm && !replyForm) return;
        event.preventDefault();
        const state = getCommunicationState();

        if (composeForm) {
            syncCommunicationComposeDraft(composeForm);
            const form = new FormData(composeForm);
            const currentUser = getCurrentCommunicationUser();
            const recipient = resolveCommunicationRecipient(form.get('recipientId'), form.get('recipientSearch'));
            if (!recipient) {
                alert('Select a registered business before sending.');
                return;
            }
            const category = String(form.get('category') || 'General Message');
            const kind = String(form.get('kind') || '').trim() || (/clarification/i.test(category) ? 'clarification' : 'message');
            const tenderReference = form.get('tenderReference') || 'Not linked';
            const tenderTitle = form.get('tenderTitle') || tenderReference || 'Tender communication';
            const relatedMessageId = state.composeDraft?.relatedMessageId || '';
            const relatedMessage = relatedMessageId ? getCommunicationItems().find(entry => entry.id === relatedMessageId) : null;
            const baseMessage = {
                kind,
                category,
                subject: form.get('subject') || 'Procurement message',
                body: form.get('body') || '',
                senderId: currentUser.id,
                senderType: currentUser.type,
                senderName: currentUser.organization,
                recipientId: recipient.id,
                recipientType: recipient.type,
                recipientName: recipient.name,
                tenderId: form.get('tenderId') || tenderReference,
                tenderReference,
                tenderTitle,
                status: kind === 'clarification' ? 'Pending Buyer Response' : 'Read',
                priority: 'Normal',
                audience: [recipient.role || 'user', 'all'],
                attachments: state.composeDraft?.attachments || [],
                relatedMessageId,
                conversationId: relatedMessage?.conversationId || '',
                contextKey: relatedMessage?.contextKey || ''
            };
            const baseContextKey = baseMessage.contextKey || buildCommunicationContextKey(baseMessage);
            baseMessage.contextKey = baseContextKey;
            baseMessage.conversationId = baseMessage.conversationId || baseContextKey;
            addProcurexCommunicationItem({
                ...baseMessage,
                folder: 'inbox',
                status: kind === 'clarification' ? 'Pending Buyer Response' : 'Unread',
                read: false,
                actionRequired: kind === 'clarification',
                actionLabel: kind === 'clarification' ? 'Provide Answer' : 'Open',
                actionPage: 'communication-center'
            });
            const item = addProcurexCommunicationItem({
                ...baseMessage,
                folder: 'sent',
                read: true
            });
            if (relatedMessage) {
                patchCommunicationItem(relatedMessageId, {
                    status: relatedMessage.kind === 'clarification' ? 'Answered' : 'Replied',
                    read: true,
                    conversationId: baseMessage.conversationId,
                    contextKey: baseMessage.contextKey,
                    thread: [
                        ...(relatedMessage.thread || []),
                        {
                            senderType: currentUser.type,
                            senderName: currentUser.organization,
                            body: form.get('body') || '',
                            createdAt: new Date().toISOString()
                        }
                    ]
                });
            }
            state.composeOpen = false;
            state.composeDraft = null;
            state.tab = 'Sent';
            state.selectedId = item.id;
            render();
            return;
        }

        if (replyForm) {
            const itemId = replyForm.dataset.communicationReply;
            const form = new FormData(replyForm);
            const body = String(form.get('body') || '').trim();
            if (!body) {
                alert('Write a response before sending.');
                return;
            }
            const item = getCommunicationItems().find(entry => entry.id === itemId);
            const visibility = String(form.get('visibility') || 'Reply to this supplier only');
            const conversationId = item?.conversationId || item?.contextKey || buildCommunicationContextKey(item);
            const thread = [
                ...(item?.thread || []),
                {
                    senderType: 'User',
                    senderName: getCurrentCommunicationUser().organization,
                    body,
                    notice: visibility,
                    createdAt: new Date().toISOString()
                }
            ];
            const publishToAll = visibility.toLowerCase().includes('all bidders');
            patchCommunicationItem(itemId, {
                thread,
                status: publishToAll ? 'Published to All Bidders' : 'Answered',
                read: true,
                conversationId,
                contextKey: item?.contextKey || conversationId,
                visibility: publishToAll ? 'Public to all bidders' : 'Private'
            });
            addProcurexCommunicationItem({
                kind: 'clarification',
                category: 'Tender Clarification',
                subject: `Re: ${item?.subject || 'Clarification response'}`,
                body,
                senderId: getCurrentCommunicationUser().id,
                senderType: 'User',
                senderName: getCurrentCommunicationUser().organization,
                recipientId: item?.senderId,
                recipientType: 'User',
                recipientName: item?.senderName || 'User',
                tenderId: item?.tenderId,
                tenderReference: item?.tenderReference,
                tenderTitle: item?.tenderTitle,
                priority: 'Normal',
                status: 'Answered',
                read: false,
                actionRequired: false,
                actionLabel: 'Ask Follow-up',
                actionPage: 'communication-center',
                relatedMessageId: itemId,
                conversationId,
                contextKey: item?.contextKey || conversationId
            });
            render();
        }
    });

    root.dataset.ready = 'true';
}

if (window.app) {
    window.app.renderCommunicationCenter = renderCommunicationCenter;
}

window.renderCommunicationCenter = renderCommunicationCenter;
window.initializeCommunicationCenter = initializeCommunicationCenter;
window.addProcurexCommunicationItem = addProcurexCommunicationItem;
window.getProcurexUnreadCommunicationCount = getProcurexUnreadCommunicationCount;
