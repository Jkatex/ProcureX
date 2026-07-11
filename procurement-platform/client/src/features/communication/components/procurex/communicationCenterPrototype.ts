type CommunicationAttachment = {
  id?: string;
  name?: string;
  fileName?: string;
  fileType?: string;
  content?: string;
  url?: string;
  href?: string;
  dataUrl?: string;
};

function notifyCommunication(title: string, message: string, reason?: string, tone: 'success' | 'info' | 'warning' | 'error' = 'info') {
  window.dispatchEvent(
    new CustomEvent('procurex:notify', {
      detail: {
        tone,
        title,
        message,
        reason,
        dismissible: true
      }
    })
  );
}

type CommunicationThreadEntry = {
  senderType?: string;
  senderName?: string;
  body?: string;
  notice?: string;
  createdAt?: string;
};

type CommunicationItem = {
  id: string;
  kind: string;
  folder: string;
  category: string;
  subject: string;
  body: string;
  senderId?: string;
  senderType?: string;
  senderName?: string;
  recipientId?: string;
  recipientType?: string;
  recipientName?: string;
  tenderId?: string;
  tenderReference?: string;
  tenderTitle?: string;
  priority?: string;
  status: string;
  read?: boolean;
  actionRequired?: boolean;
  actionLabel?: string;
  actionPage?: string;
  visibility?: string;
  attachments?: CommunicationAttachment[];
  thread?: CommunicationThreadEntry[];
  relatedMessageId?: string;
  conversationId?: string;
  contextKey?: string;
  createdAt: string;
  updatedAt?: string;
  audience?: string[];
};

type CommunicationState = {
  tab: string;
  folder: string;
  selectedId: string | null;
  query: string;
  date: string;
  category: string;
  composeOpen: boolean;
  composeDraft: Record<string, string | CommunicationAttachment[] | undefined> | null;
};

const communicationCenterStorageKey = 'procurex.communicationCenter.v2.items';

const communicationCategories = [
  'General Message',
  'Tender Clarification',
  'System Notification',
  'System Alert',
  'Evaluation Update',
  'Tender Publication',
  'Tender Rejection',
  'Bid Submission',
  'Supplier Invitation',
  'Award Notification',
  'Deadline Reminder',
  'Reporting Documents',
  'Admin Announcement'
];

const replyVisibilityOptions = [
  'Reply to this supplier only',
  'Publish answer to all bidders for this tender',
  'Issue addendum'
];

const communicationProfiles = [
  { id: 'user-001', role: 'user', type: 'Business', name: 'Kilimanjaro Supplies Limited' },
  { id: 'buyer-001', role: 'buyer', type: 'Buyer', name: 'Ministry of Health' },
  { id: 'supplier-001', role: 'supplier', type: 'Supplier', name: 'ABC Construction Ltd' },
  { id: 'admin-001', role: 'admin', type: 'Admin', name: 'ProcureX Platform' },
  { id: 'business-dar-rapid-transit-agency', role: 'buyer', type: 'Buyer', name: 'Dar Rapid Transit Agency' },
  { id: 'business-dart-environmental-consultants', role: 'supplier', type: 'Consultant', name: 'DART Environmental Consultants' },
  { id: 'business-lake-builders-ltd', role: 'supplier', type: 'Supplier', name: 'Lake Builders Ltd' },
  { id: 'business-medical-stores-department', role: 'buyer', type: 'Buyer', name: 'Medical Stores Department' }
];

const communicationState: CommunicationState = {
  tab: 'Inbox',
  folder: 'Inbox',
  selectedId: null,
  query: '',
  date: '',
  category: 'All categories',
  composeOpen: false,
  composeDraft: null
};

let activeCommunicationShell: HTMLElement | null = null;
let communicationPopStateReady = false;

function getCommunicationRouteSearch(view: 'list' | 'compose' | 'message' = 'list', id = '') {
  const params = new URLSearchParams();
  if (view === 'compose') params.set('view', 'compose');
  if (view === 'message' && id) {
    params.set('view', 'message');
    params.set('id', id);
  }
  return params.toString();
}

function replaceCommunicationRoute(view: 'list' | 'compose' | 'message' = 'list', id = '') {
  if (typeof window === 'undefined' || window.location.pathname !== '/communication') return;
  const search = getCommunicationRouteSearch(view, id);
  const route = search ? `/communication?${search}` : '/communication';
  window.history.replaceState({ ...(window.history.state || {}), communicationView: view }, '', route);
}

function pushCommunicationRoute(view: 'list' | 'compose' | 'message' = 'list', id = '') {
  if (typeof window === 'undefined' || window.location.pathname !== '/communication') return;
  const search = getCommunicationRouteSearch(view, id);
  const route = search ? `/communication?${search}` : '/communication';
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === route) return;
  window.history.pushState({ ...(window.history.state || {}), communicationView: view }, '', route);
}

function syncCommunicationStateFromRoute(shell: HTMLElement) {
  if (typeof window === 'undefined' || window.location.pathname !== '/communication') return;

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') || 'list';
  const messageId = params.get('id') || '';
  const hasMessage = messageId && getCommunicationItems().some((item) => item.id === messageId);

  communicationState.composeOpen = view === 'compose';
  communicationState.selectedId = view === 'message' && hasMessage ? messageId : null;
  if (view !== 'compose') communicationState.composeDraft = null;
  if (view === 'list') {
    communicationState.tab = 'Inbox';
    communicationState.folder = 'Inbox';
  }

  renderCommunicationCenterInner(shell);
}

function goCommunicationHome(shell: HTMLElement) {
  communicationState.composeOpen = false;
  communicationState.composeDraft = null;
  communicationState.selectedId = null;
  communicationState.tab = 'Inbox';
  communicationState.folder = 'Inbox';
  replaceCommunicationRoute('list');
  renderCommunicationCenterInner(shell);
}

function attachCommunicationHistory(shell: HTMLElement) {
  activeCommunicationShell = shell;
  if (communicationPopStateReady || typeof window === 'undefined') return;

  window.addEventListener('popstate', () => {
    window.setTimeout(() => {
      const liveShell =
        document.querySelector<HTMLElement>('[data-communication-center]') ||
        (activeCommunicationShell && document.body.contains(activeCommunicationShell) ? activeCommunicationShell : null);
      if (!liveShell) return;
      activeCommunicationShell = liveShell;
      bindCommunicationShellEvents(liveShell);
      syncCommunicationStateFromRoute(liveShell);
    }, 0);
  });
  communicationPopStateReady = true;
}

function escapeCommunicationHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCommunicationItems() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(communicationCenterStorageKey) || 'null') as CommunicationItem[] | null;
    return Array.isArray(parsed) ? parsed.filter((item) => !String(item.id || '').startsWith('scenario-')) : [];
  } catch {
    return [];
  }
}

function saveCommunicationItems(items: CommunicationItem[]) {
  window.localStorage.setItem(communicationCenterStorageKey, JSON.stringify(items));
}

function addCommunicationItem(item: Omit<CommunicationItem, 'id' | 'createdAt'> & Partial<Pick<CommunicationItem, 'id' | 'createdAt'>>) {
  const items = getCommunicationItems();
  const next: CommunicationItem = {
    ...item,
    id: item.id || `communication-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: item.createdAt || new Date().toISOString()
  } as CommunicationItem;
  saveCommunicationItems([next, ...items]);
  return next;
}

function patchCommunicationItem(id = '', patch: Partial<CommunicationItem>) {
  saveCommunicationItems(getCommunicationItems().map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)));
}

function getCurrentCommunicationUser() {
  return {
    id: 'user-001',
    role: 'user',
    type: 'Business',
    organization: 'Kilimanjaro Supplies Limited',
    aliases: ['user-001', 'buyer-001', 'supplier-001', 'Kilimanjaro Supplies Limited'].map((value) => value.toLowerCase())
  };
}

function isCommunicationUserItem(item: CommunicationItem) {
  const user = getCurrentCommunicationUser();
  const audience = item.audience || [];
  const candidates = [item.senderId, item.recipientId, item.senderName, item.recipientName].map((value) => String(value || '').toLowerCase());
  return audience.includes('all') || audience.includes(user.role) || candidates.some((value) => user.aliases.includes(value));
}

function formatCommunicationDate(value = '') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCommunicationBadgeClass(value = '') {
  const raw = value.toLowerCase();
  if (/urgent|high|required|pending|unread|rejection|alert/.test(raw)) return 'badge-warning';
  if (/answered|resolved|published|read|completed|replied/.test(raw)) return 'badge-success';
  return 'badge-info';
}

function getCommunicationAttachmentName(attachment: CommunicationAttachment = {}, index = 0) {
  return attachment.name || attachment.fileName || `Attachment ${index + 1}`;
}

function renderCommunicationOptions(values: string[] = [], selected = '', firstLabel = '') {
  const options = firstLabel ? [`<option>${escapeCommunicationHtml(firstLabel)}</option>`] : [];
  values.forEach((value) => options.push(`<option ${value === selected ? 'selected' : ''}>${escapeCommunicationHtml(value)}</option>`));
  return options.join('');
}

function renderCommunicationAttachmentActions(attachments: CommunicationAttachment[] = []) {
  if (!attachments.length) return '';
  return `
        <div class="communication-attachments">
            ${attachments.map((attachment, index) => `
                <div class="communication-attachment-item">
                    <span>${escapeCommunicationHtml(getCommunicationAttachmentName(attachment, index))}</span>
                    <button type="button" data-communication-download-attachment="${index}">Download</button>
                    <button type="button" data-communication-open-attachment="${index}">Open</button>
                </div>
            `).join('')}
        </div>
    `;
}

function getCommunicationAttachmentBlobUrl(attachment: CommunicationAttachment = {}) {
  if (attachment.url || attachment.href || attachment.dataUrl) return attachment.url || attachment.href || attachment.dataUrl || '';
  return URL.createObjectURL(new Blob([attachment.content || `ProcureX attachment placeholder for ${getCommunicationAttachmentName(attachment)}.`], { type: attachment.fileType?.includes('/') ? attachment.fileType : 'text/plain' }));
}

function openCommunicationAttachment(attachment: CommunicationAttachment = {}, index = 0) {
  const url = getCommunicationAttachmentBlobUrl(attachment);
  const opened = window.open(url, '_blank', 'noopener');
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 5000);
  if (!opened) notifyCommunication('Attachment blocked', `Allow pop-ups to open ${getCommunicationAttachmentName(attachment, index)}.`, 'Your browser blocked the new tab for this attachment.', 'warning');
}

function downloadCommunicationAttachment(attachment: CommunicationAttachment = {}, index = 0) {
  const url = getCommunicationAttachmentBlobUrl(attachment);
  const link = document.createElement('a');
  link.href = url;
  link.download = getCommunicationAttachmentName(attachment, index);
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filterCommunicationItems(items: CommunicationItem[], state: CommunicationState) {
  const query = state.query.trim().toLowerCase();
  return items
    .filter((item) => {
      if (state.tab === 'Sent') return item.folder === 'sent';
      if (state.tab === 'Archived') return item.folder === 'archived' || item.status === 'Archived';
      if (state.tab === 'Unread') return !item.read;
      return item.folder !== 'sent' && item.folder !== 'archived' && item.status !== 'Deleted';
    })
    .filter((item) => {
      if (!state.date) return true;
      return item.createdAt.slice(0, 10) === state.date;
    })
    .filter((item) => {
      if (!query) return true;
      return [
        item.senderName,
        item.recipientName,
        item.tenderReference,
        item.tenderTitle,
        item.subject,
        item.body,
        item.category,
        item.status,
        item.priority,
        item.visibility,
        item.actionLabel,
        item.createdAt,
        formatCommunicationDate(item.createdAt),
        ...(item.attachments || []).map((attachment) => getCommunicationAttachmentName(attachment))
      ].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort((first, second) => (Date.parse(second.createdAt) || 0) - (Date.parse(first.createdAt) || 0));
}

function renderCommunicationSidebar(state: CommunicationState, counts: Record<string, number>) {
  const folders = [
    ['Inbox', counts.inbox],
    ['Sent', counts.sent],
    ['Drafts', counts.drafts],
    ['Archived', counts.archived]
  ];
  return `
        <aside class="communication-folders">
            <div class="communication-folder-title">
                <strong>Communication Center</strong>
                <span>Tender inbox</span>
            </div>
            <div class="communication-folder-list">
                ${folders.map(([folder, count]) => `
                    <button type="button" class="${state.tab === folder ? 'active' : ''}" data-communication-tab="${escapeCommunicationHtml(String(folder))}">
                        <span>${escapeCommunicationHtml(String(folder))}</span>
                        <em>${count}</em>
                    </button>
                `).join('')}
            </div>
        </aside>
    `;
}

function renderCommunicationRow(item: CommunicationItem, selectedId: string | null) {
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

function renderCommunicationThread(item: CommunicationItem) {
  const thread = item.thread?.length ? item.thread : [{ senderType: item.senderType, senderName: item.senderName, body: item.body, createdAt: item.createdAt }];
  return `
        <div class="communication-thread">
            ${thread.map((entry) => `
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

function getCommunicationConversationItems(item: CommunicationItem, items: CommunicationItem[]) {
  const conversationId = item.conversationId || item.contextKey || '';
  const contextKey = item.contextKey || '';
  const relatedIds = new Set([item.id, item.relatedMessageId].filter(Boolean));
  return items
    .filter((entry) => {
      if (entry.id === item.id) return true;
      if (conversationId && entry.conversationId === conversationId) return true;
      if (contextKey && entry.contextKey === contextKey) return true;
      if (relatedIds.has(entry.id) || relatedIds.has(entry.relatedMessageId)) return true;
      return entry.relatedMessageId === item.id || item.relatedMessageId === entry.id;
    })
    .sort((first, second) => (Date.parse(first.createdAt) || 0) - (Date.parse(second.createdAt) || 0));
}

function renderCommunicationContinuityPanel(item: CommunicationItem, items: CommunicationItem[]) {
  const conversationItems = getCommunicationConversationItems(item, items);
  if (conversationItems.length < 2) return '';
  return `
        <section class="communication-continuity-panel">
            <div>
                <span class="section-kicker">Context trail</span>
                <strong>${conversationItems.length} linked messages in this conversation</strong>
            </div>
            <div class="communication-continuity-list">
                ${conversationItems.map((entry) => `
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

function isOpenClarificationRequest(item: CommunicationItem) {
  const rawStatus = String(item.status || '').toLowerCase();
  if (item.kind !== 'clarification' || item.folder === 'sent') return false;
  if (/answered|resolved|published|closed|replied/.test(rawStatus)) return false;
  return /pending|submitted|unread|action required/.test(rawStatus);
}

function isBidderClarificationAnswer(item: CommunicationItem) {
  const rawStatus = String(item.status || '').toLowerCase();
  const rawCategory = String(item.category || '').toLowerCase();
  const rawSenderType = String(item.senderType || '').toLowerCase();
  if (item.folder === 'sent') return false;
  if (isOpenClarificationRequest(item)) return false;
  if (item.kind !== 'clarification' && !rawCategory.includes('clarification')) return false;
  if (!rawSenderType.includes('buyer') && item.actionLabel !== 'View Response' && item.actionLabel !== 'Ask Follow-up') return false;
  return /answered|resolved|published|replied|read/.test(rawStatus) || item.actionLabel === 'View Response';
}

function isInboxCommunicationItem(item: CommunicationItem) {
  return item.folder !== 'sent' && item.folder !== 'archived' && item.status !== 'Deleted';
}

function canReplyToCommunicationItem(item: CommunicationItem) {
  if (!isInboxCommunicationItem(item)) return false;
  if (item.senderId === 'system' || String(item.senderType || '').toLowerCase().includes('system')) return false;
  if (isOpenClarificationRequest(item) || isBidderClarificationAnswer(item)) return false;
  return !item.actionPage || item.actionPage === 'communication-center' || item.kind === 'message';
}

function isCommunicationReportMessage(item: CommunicationItem) {
  return isInboxCommunicationItem(item) && /reporting documents|report/i.test(`${item.category || ''} ${item.subject || ''}`);
}

function getCommunicationPrimaryAction(item: CommunicationItem) {
  if (!isInboxCommunicationItem(item) || isBidderClarificationAnswer(item)) return '';
  if (isCommunicationReportMessage(item)) return `<button class="btn btn-primary" type="button" data-communication-report-feedback="${escapeCommunicationHtml(item.id)}">Offer Feedback</button>`;
  if (item.actionPage && item.actionPage !== 'communication-center') return `<button class="btn btn-primary" type="button" data-navigate="${escapeCommunicationHtml(item.actionPage)}">${escapeCommunicationHtml(item.actionLabel || 'Open')}</button>`;
  if (canReplyToCommunicationItem(item)) return `<button class="btn btn-primary" type="button" data-communication-reply-message="${escapeCommunicationHtml(item.id)}">Reply</button>`;
  return '';
}

function getCommunicationActionText(item: CommunicationItem) {
  if (item.kind === 'clarification') {
    if (item.folder === 'sent') return 'Await buyer response';
    if (isOpenClarificationRequest(item)) return 'Provide clarification answer';
    if (isBidderClarificationAnswer(item)) return 'No action needed if satisfied';
    return 'Clarification answered';
  }
  if (isCommunicationReportMessage(item)) return 'Offer feedback on this report';
  if (canReplyToCommunicationItem(item)) return 'Reply to this message';
  return item.actionLabel || (item.read ? 'Message reviewed' : 'Review message');
}

function renderCommunicationReplyBox(item: CommunicationItem) {
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
                    ${renderCommunicationOptions(replyVisibilityOptions, 'Reply to this supplier only')}
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

function renderCommunicationDetail(item: CommunicationItem | null, fullScreen = false, allItems: CommunicationItem[] = []) {
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
            ${renderCommunicationThread(item)}
            <section class="communication-action-panel">
                <div>
                    <span class="section-kicker">Next action</span>
                    <strong>${escapeCommunicationHtml(getCommunicationActionText(item))}</strong>
                </div>
                <div class="inline-actions">
                    ${isBidderClarificationAnswer(item) ? `<button class="btn btn-primary" type="button" data-communication-followup="${escapeCommunicationHtml(item.id)}">Ask Further Clarification</button>` : ''}
                    ${getCommunicationPrimaryAction(item)}
                    <button class="btn btn-secondary" type="button" data-communication-archive="${escapeCommunicationHtml(item.id)}">Archive</button>
                    <button class="btn btn-secondary" type="button" data-communication-back>Back</button>
                </div>
            </section>
            ${renderCommunicationReplyBox(item)}
        </aside>
    `;
}

function getFilteredCommunicationRecipientProfiles(searchValue = '') {
  const normalizedSearch = searchValue.trim().toLowerCase();
  return communicationProfiles.filter((profile) => profile.id !== 'user-001' && (!normalizedSearch || [profile.name, profile.id].some((value) => value.toLowerCase().includes(normalizedSearch))));
}

function renderCommunicationRecipientOptions(selectedRecipientId = '', searchValue = '') {
  const filteredProfiles = getFilteredCommunicationRecipientProfiles(searchValue);
  if (!filteredProfiles.length) return '<option value="">No registered businesses match this search</option>';
  const selectedVisible = filteredProfiles.some((profile) => profile.id === selectedRecipientId);
  const options = selectedVisible ? [] : ['<option value="">Select business</option>'];
  filteredProfiles.forEach((profile) => {
    options.push(`<option value="${escapeCommunicationHtml(profile.id)}" ${profile.id === selectedRecipientId ? 'selected' : ''}>${escapeCommunicationHtml(profile.name)}</option>`);
  });
  return options.join('');
}

function renderCommunicationCompose(state: CommunicationState) {
  if (!state.composeOpen) return '';
  const draft = state.composeDraft || {};
  const selectedCategory = String(draft.category || 'General Message');
  const recipientSearchValue = String(draft.recipientSearch || '');
  const selectedRecipientId = String(draft.recipientId || getFilteredCommunicationRecipientProfiles(recipientSearchValue)[0]?.id || '');
  return `
        <form class="communication-compose-panel ${state.composeOpen ? 'full-screen' : ''}" data-communication-compose>
            <div class="panel-heading">
                <div><span class="section-kicker">New message</span><h2>Send procurement communication</h2></div>
                <button class="btn btn-secondary" type="button" data-communication-compose-close>Close</button>
            </div>
            <div class="communication-compose-grid">
                <label><span>From mailbox</span><input class="form-input" value="Kilimanjaro Supplies Limited" readonly></label>
                <label><span>Category</span><select class="form-input" name="category" data-communication-compose-field>${renderCommunicationOptions(communicationCategories, selectedCategory)}</select></label>
                <label>
                    <span>Recipient business</span>
                    <input class="form-input" name="recipientSearch" value="${escapeCommunicationHtml(recipientSearchValue)}" placeholder="Search registered business name" autocomplete="off" data-communication-recipient-search>
                    <select class="form-input" name="recipientId" data-communication-recipient-select>
                        ${renderCommunicationRecipientOptions(selectedRecipientId, recipientSearchValue)}
                    </select>
                </label>
                <label><span>Tender reference</span><input class="form-input" name="tenderReference" value="${escapeCommunicationHtml(String(draft.tenderReference || draft.tenderId || ''))}" placeholder="Optional tender reference" data-communication-compose-field></label>
                <input type="hidden" name="tenderId" value="${escapeCommunicationHtml(String(draft.tenderId || ''))}">
                <input type="hidden" name="tenderTitle" value="${escapeCommunicationHtml(String(draft.tenderTitle || ''))}">
                <input type="hidden" name="kind" value="${escapeCommunicationHtml(String(draft.kind || ''))}">
                <label class="span-2"><span>Subject</span><input class="form-input" name="subject" placeholder="Subject" value="${escapeCommunicationHtml(String(draft.subject || ''))}" data-communication-compose-field></label>
                <label class="span-2"><span>Message</span><textarea class="form-input" name="body" rows="4" placeholder="Write your message" data-communication-compose-field>${escapeCommunicationHtml(String(draft.body || ''))}</textarea></label>
            </div>
            <div class="inline-actions">
                <label class="btn btn-secondary communication-file-button">
                    Add files
                    <input type="file" data-communication-attachment multiple hidden>
                </label>
                <span class="communication-attachment-preview" data-communication-attachment-preview>${((draft.attachments as CommunicationAttachment[] | undefined) || []).map((item) => escapeCommunicationHtml(item.name)).join(', ')}</span>
                <button class="btn btn-primary" type="submit">Send Message</button>
            </div>
        </form>
    `;
}

function renderCommunicationEmptyState(hasAnyItems: boolean) {
  if (hasAnyItems) {
    return `
        <div class="scope-empty communication-empty-state compact">
            <strong>No messages match this view.</strong>
            <span>Try a different folder, clear the search, or create a new message.</span>
            <button class="btn btn-secondary" type="button" data-communication-compose-open>New Message</button>
        </div>
    `;
  }

  return `
        <div class="scope-empty communication-empty-state">
            <span class="section-kicker">Welcome to Communication Center</span>
            <h2>This is where all your in-platform communication will take place.</h2>
            <p>
                Your inbox, sent messages, clarification threads, notices, and message attachments will appear here
                after you start communicating through ProcureX.
            </p>
            <div class="communication-empty-steps">
                <span>1. Create a message or clarification.</span>
                <span>2. Link it to a tender when needed.</span>
                <span>3. Track replies and attachments from the same thread.</span>
            </div>
            <button class="btn btn-primary" type="button" data-communication-compose-open>Create Message</button>
        </div>
    `;
}

function renderCommunicationCenterInner(shell: HTMLElement) {
  const state = communicationState;
  const currentUser = getCurrentCommunicationUser();
  const allItems = getCommunicationItems().filter(isCommunicationUserItem);
  const counts = {
    inbox: allItems.filter((item) => item.folder !== 'sent' && item.folder !== 'archived' && item.status !== 'Deleted').length,
    sent: allItems.filter((item) => item.folder === 'sent').length,
    drafts: 0,
    archived: allItems.filter((item) => item.folder === 'archived' || item.status === 'Archived').length
  };
  const filtered = filterCommunicationItems(allItems, state);
  const selected = state.selectedId ? allItems.find((item) => item.id === state.selectedId) || null : null;
  if (state.selectedId && !selected) state.selectedId = null;
  const unreadCount = allItems.filter((item) => !item.read).length;
  const actionCount = allItems.filter((item) => item.actionRequired || /pending|action required/i.test(item.status)).length;
  const messageView = Boolean(selected);
  const composeView = state.composeOpen;
  const hasAnyItems = allItems.length > 0;

  shell.innerHTML = `
        <main class="communication-center-page">
            ${composeView || messageView ? '' : `
                <section class="communication-hero">
                    <div>
                        <span class="section-kicker">Personal mailbox</span>
                        <h1>Communication Center</h1>
                        <p>${hasAnyItems
                          ? `${escapeCommunicationHtml(currentUser.organization)} only sees messages sent to this mailbox or messages sent from it.`
                          : 'Welcome. This is where all your in-platform communication will take place once you start sending and receiving messages.'}</p>
                        ${hasAnyItems ? '' : '<button class="btn btn-primary" type="button" data-communication-compose-open>Create Message</button>'}
                    </div>
                    <div class="communication-summary">
                        <div><strong>${unreadCount}</strong><span>Unread</span></div>
                        <div><strong>${actionCount}</strong><span>Action required</span></div>
                        <div><strong>${counts.sent}</strong><span>Sent</span></div>
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
                            ${['Inbox', 'Sent', 'Archived', 'Unread'].map((tab) => `
                                <button type="button" class="${state.tab === tab ? 'active' : ''}" data-communication-tab="${tab}">${tab}</button>
                            `).join('')}
                        </div>
                        <div class="communication-list">
                            ${filtered.length ? filtered.map((item) => renderCommunicationRow(item, null)).join('') : renderCommunicationEmptyState(hasAnyItems)}
                        </div>
                    </div>
                </section>
            `}
        </main>
    `;
}

function updateCommunicationComposeDraftField(field: string, value: string) {
  communicationState.composeDraft = {
    ...(communicationState.composeDraft || {}),
    [field]: value
  };
}

function syncCommunicationComposeDraft(form: HTMLFormElement) {
  const formData = new FormData(form);
  communicationState.composeDraft = {
    ...(communicationState.composeDraft || {}),
    recipientId: String(formData.get('recipientId') || ''),
    recipientSearch: String(formData.get('recipientSearch') || ''),
    category: String(formData.get('category') || ''),
    tenderReference: String(formData.get('tenderReference') || ''),
    tenderId: String(formData.get('tenderId') || ''),
    tenderTitle: String(formData.get('tenderTitle') || ''),
    kind: String(formData.get('kind') || ''),
    subject: String(formData.get('subject') || ''),
    body: String(formData.get('body') || '')
  };
}

function getProfileById(id = '') {
  return communicationProfiles.find((profile) => profile.id === id) || communicationProfiles[0];
}

function openCommunicationReplyCompose(item: CommunicationItem, subjectPrefix = 'Re') {
  communicationState.composeDraft = {
    recipientId: item.senderId,
    recipientSearch: item.senderName,
    category: item.category || 'General Message',
    tenderReference: item.tenderReference || '',
    tenderId: item.tenderId || '',
    tenderTitle: item.tenderTitle || '',
    kind: item.kind || 'message',
    subject: `${subjectPrefix}: ${String(item.subject || 'Message').replace(/^(Re|Feedback):\s*/i, '')}`,
    body: '',
    relatedMessageId: item.id
  };
  communicationState.composeOpen = true;
  communicationState.selectedId = null;
}

function handleCommunicationClick(event: Event, shell: HTMLElement) {
  const target = event.target as HTMLElement;
  const state = communicationState;
  const handled = () => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (target.matches('[data-communication-date-search]')) {
    (target as HTMLInputElement).type = 'date';
    return;
  }

  const selectButton = target.closest<HTMLElement>('[data-communication-select]');
  if (selectButton) {
    handled();
    state.selectedId = selectButton.dataset.communicationSelect || null;
    const selectedItem = getCommunicationItems().find((item) => item.id === state.selectedId);
    patchCommunicationItem(state.selectedId || '', { read: true, status: /^unread$/i.test(String(selectedItem?.status || '')) ? 'Read' : selectedItem?.status });
    pushCommunicationRoute('message', state.selectedId || '');
    renderCommunicationCenterInner(shell);
    return;
  }

  const tabButton = target.closest<HTMLElement>('[data-communication-tab]');
  if (tabButton) {
    handled();
    state.tab = tabButton.dataset.communicationTab || 'Inbox';
    state.folder = state.tab;
    state.selectedId = null;
    renderCommunicationCenterInner(shell);
    return;
  }

  if (target.closest('[data-communication-compose-open]')) {
    handled();
    state.composeOpen = true;
    state.composeDraft = null;
    state.selectedId = null;
    pushCommunicationRoute('compose');
    renderCommunicationCenterInner(shell);
    return;
  }

  if (target.closest('[data-communication-compose-close], [data-communication-back]')) {
    handled();
    goCommunicationHome(shell);
    return;
  }

  if (target.closest('[data-communication-clear-search]')) {
    handled();
    state.query = '';
    state.date = '';
    renderCommunicationCenterInner(shell);
    return;
  }

  const replyMessageButton = target.closest<HTMLElement>('[data-communication-reply-message], [data-communication-followup], [data-communication-report-feedback]');
  if (replyMessageButton) {
    handled();
    const itemId = replyMessageButton.dataset.communicationReplyMessage || replyMessageButton.dataset.communicationFollowup || replyMessageButton.dataset.communicationReportFeedback || '';
    const item = getCommunicationItems().find((entry) => entry.id === itemId);
    if (item) openCommunicationReplyCompose(item, replyMessageButton.hasAttribute('data-communication-report-feedback') ? 'Feedback' : 'Re');
    pushCommunicationRoute('compose');
    renderCommunicationCenterInner(shell);
    return;
  }

  const archiveButton = target.closest<HTMLElement>('[data-communication-archive]');
  if (archiveButton) {
    handled();
    patchCommunicationItem(archiveButton.dataset.communicationArchive || '', { folder: 'archived', status: 'Archived', read: true });
    goCommunicationHome(shell);
    return;
  }

  const downloadAttachmentButton = target.closest<HTMLElement>('[data-communication-download-attachment]');
  if (downloadAttachmentButton) {
    handled();
    const item = getCommunicationItems().find((entry) => entry.id === state.selectedId);
    const attachmentIndex = Number(downloadAttachmentButton.dataset.communicationDownloadAttachment);
    const attachment = item?.attachments?.[attachmentIndex];
    if (attachment) downloadCommunicationAttachment(attachment, attachmentIndex);
    return;
  }

  const openAttachmentButton = target.closest<HTMLElement>('[data-communication-open-attachment]');
  if (openAttachmentButton) {
    handled();
    const item = getCommunicationItems().find((entry) => entry.id === state.selectedId);
    const attachmentIndex = Number(openAttachmentButton.dataset.communicationOpenAttachment);
    const attachment = item?.attachments?.[attachmentIndex];
    if (attachment) openCommunicationAttachment(attachment, attachmentIndex);
  }
}

function handleCommunicationInput(event: Event, shell: HTMLElement) {
  const target = event.target as HTMLElement;
  const state = communicationState;

  const recipientSearch = target.closest<HTMLInputElement>('[data-communication-recipient-search]');
  if (recipientSearch) {
    updateCommunicationComposeDraftField('recipientSearch', recipientSearch.value);
    const select = recipientSearch.closest('form')?.querySelector<HTMLSelectElement>('[data-communication-recipient-select]');
    if (select) {
      const selected = getFilteredCommunicationRecipientProfiles(recipientSearch.value)[0]?.id || '';
      select.innerHTML = renderCommunicationRecipientOptions(selected, recipientSearch.value);
      updateCommunicationComposeDraftField('recipientId', selected);
    }
    return;
  }

  const composeField = target.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-communication-compose-field]');
  if (composeField) {
    updateCommunicationComposeDraftField(composeField.name, composeField.value);
    return;
  }

  if (target.matches('[data-communication-search]')) {
    state.query = (target as HTMLInputElement).value;
    renderCommunicationCenterInner(shell);
    shell.querySelector<HTMLInputElement>('[data-communication-search]')?.focus();
    return;
  }

  if (target.matches('[data-communication-date-search]')) {
    state.date = (target as HTMLInputElement).value;
    renderCommunicationCenterInner(shell);
  }
}

function handleCommunicationChange(event: Event, shell: HTMLElement) {
  const target = event.target as HTMLElement;
  const state = communicationState;

  const recipientSelect = target.closest<HTMLSelectElement>('[data-communication-recipient-select]');
  if (recipientSelect) {
    updateCommunicationComposeDraftField('recipientId', recipientSelect.value);
    return;
  }

  const attachmentInput = target.closest<HTMLInputElement>('[data-communication-attachment]');
  if (attachmentInput) {
    state.composeDraft = {
      ...(state.composeDraft || {}),
      attachments: Array.from(attachmentInput.files || []).map((file) => ({
        id: `att-${Date.now()}-${file.name}`,
        name: file.name,
        fileType: file.type || 'file'
      }))
    };
    renderCommunicationCenterInner(shell);
  }
}

function handleCommunicationSubmit(event: Event, shell: HTMLElement) {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('[data-communication-compose], [data-communication-reply]');
  if (!form) return;
  event.preventDefault();
  event.stopPropagation();

  const state = communicationState;
  const replyForm = form.matches('[data-communication-reply]') ? form : null;
  const composeForm = form.matches('[data-communication-compose]') ? form : null;

  if (composeForm) {
    syncCommunicationComposeDraft(composeForm);
    const formData = new FormData(composeForm);
    const recipient = getProfileById(String(formData.get('recipientId') || ''));
    const category = String(formData.get('category') || 'General Message');
    const kind = String(formData.get('kind') || '').trim() || (/clarification/i.test(category) ? 'clarification' : 'message');
    const subject = String(formData.get('subject') || 'Procurement message');
    const body = String(formData.get('body') || '');
    const tenderReference = String(formData.get('tenderReference') || 'Not linked');
    const relatedMessageId = String(state.composeDraft?.relatedMessageId || '');
    const relatedMessage = relatedMessageId ? getCommunicationItems().find((entry) => entry.id === relatedMessageId) : null;
    const conversationId = relatedMessage?.conversationId || relatedMessage?.contextKey || `conversation-${Date.now()}`;

    const sentItem = addCommunicationItem({
      kind,
      category,
      subject,
      body,
      senderId: 'user-001',
      senderType: 'Business',
      senderName: 'Kilimanjaro Supplies Limited',
      recipientId: recipient.id,
      recipientType: recipient.type,
      recipientName: recipient.name,
      tenderId: String(formData.get('tenderId') || tenderReference),
      tenderReference,
      tenderTitle: String(formData.get('tenderTitle') || tenderReference || 'Tender communication'),
      status: kind === 'clarification' ? 'Pending Buyer Response' : 'Read',
      priority: 'Normal',
      folder: 'sent',
      read: true,
      visibility: 'Private',
      attachments: (state.composeDraft?.attachments as CommunicationAttachment[] | undefined) || [],
      relatedMessageId,
      conversationId,
      contextKey: conversationId,
      audience: ['user', 'all']
    });

    if (relatedMessage) {
      patchCommunicationItem(relatedMessageId, {
        status: relatedMessage.kind === 'clarification' ? 'Answered' : 'Replied',
        read: true,
        conversationId,
        contextKey: conversationId,
        thread: [
          ...(relatedMessage.thread || []),
          { senderType: 'Business', senderName: 'Kilimanjaro Supplies Limited', body, createdAt: new Date().toISOString() }
        ]
      });
    }

    state.composeOpen = false;
    state.composeDraft = null;
    state.tab = 'Sent';
    state.selectedId = sentItem.id;
    replaceCommunicationRoute('message', sentItem.id);
    renderCommunicationCenterInner(shell);
    return;
  }

  if (replyForm) {
    const itemId = replyForm.dataset.communicationReply || '';
    const formData = new FormData(replyForm);
    const body = String(formData.get('body') || '').trim();
    if (!body) {
      notifyCommunication('Response required', 'Write a response before sending.', 'ProcureX cannot send an empty communication response.', 'warning');
      return;
    }
    const item = getCommunicationItems().find((entry) => entry.id === itemId);
    const visibility = String(formData.get('visibility') || 'Reply to this supplier only');
    const conversationId = item?.conversationId || item?.contextKey || `conversation-${Date.now()}`;
    patchCommunicationItem(itemId, {
      status: visibility.toLowerCase().includes('all bidders') ? 'Published to All Bidders' : 'Answered',
      read: true,
      visibility: visibility.toLowerCase().includes('all bidders') ? 'Public to all bidders' : 'Private',
      conversationId,
      contextKey: conversationId,
      thread: [
        ...(item?.thread || []),
        { senderType: 'Business', senderName: 'Kilimanjaro Supplies Limited', body, notice: visibility, createdAt: new Date().toISOString() }
      ]
    });
    renderCommunicationCenterInner(shell);
  }
}

function bindCommunicationShellEvents(shell: HTMLElement) {
  if (shell.dataset.eventsReady === 'true') return;

  shell.addEventListener('click', (event) => handleCommunicationClick(event, shell));
  shell.addEventListener('input', (event) => handleCommunicationInput(event, shell));
  shell.addEventListener('change', (event) => handleCommunicationChange(event, shell));
  shell.addEventListener('submit', (event) => handleCommunicationSubmit(event, shell));
  shell.dataset.eventsReady = 'true';
}

export function initializeCommunicationCenterPrototype(root: HTMLElement) {
  const shell = root.querySelector<HTMLElement>('[data-communication-center]');
  if (!shell) return;

  attachCommunicationHistory(shell);
  bindCommunicationShellEvents(shell);

  if (shell.dataset.ready === 'true') {
    syncCommunicationStateFromRoute(shell);
    return;
  }

  communicationState.selectedId = null;
  communicationState.tab = 'Inbox';
  communicationState.folder = 'Inbox';
  communicationState.query = '';
  communicationState.date = '';
  communicationState.category = 'All categories';
  communicationState.composeOpen = false;
  communicationState.composeDraft = null;

  syncCommunicationStateFromRoute(shell);

  shell.dataset.ready = 'true';
}
