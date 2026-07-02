import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { communicationApi } from '@/features/communication/api';
import type {
  CommunicationListResponse,
  CommunicationMailboxMessage,
  CommunicationMailboxQuery,
  CommunicationPriority,
  CommunicationRecipient,
  CommunicationTenderLink
} from '@/features/communication/types';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';

type MailboxFolder = NonNullable<CommunicationMailboxQuery['folder']>;

type ComposeState = {
  recipientOrgId: string;
  tenderId: string;
  category: string;
  subject: string;
  body: string;
  priority: CommunicationPriority;
  actionRequired: boolean;
  recipientSearch: string;
  tenderSearch: string;
};

const pageToRoute: Record<string, string> = {
  'account-profile': '/identity/profile',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'communication-center': '/communication',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'records-history': '/records',
  'workspace-dashboard': '/dashboard',
  'sign-in': '/sign-in'
};

const emptyMailbox: CommunicationListResponse = {
  messages: [],
  counts: {
    total: 0,
    inbox: 0,
    sent: 0,
    drafts: 0,
    archived: 0,
    trash: 0,
    unread: 0,
    actionRequired: 0
  },
  totalMessages: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1
};

const categories = ['General Message', 'Tender Clarification', 'System Notification', 'Evaluation Update', 'Award Notification', 'Deadline Reminder'];
const priorities: CommunicationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const folders: Array<{ key: MailboxFolder; label: string }> = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'unread', label: 'Unread' },
  { key: 'archived', label: 'Archived' },
  { key: 'trash', label: 'Trash' }
];

function initialComposeState(): ComposeState {
  return {
    recipientOrgId: '',
    tenderId: '',
    category: 'General Message',
    subject: '',
    body: '',
    priority: 'NORMAL',
    actionRequired: false,
    recipientSearch: '',
    tenderSearch: ''
  };
}

export function CommunicationCenterProcurexPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [mailbox, setMailbox] = useState<CommunicationListResponse>(emptyMailbox);
  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMailboxMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(() => initialComposeState());
  const [recipients, setRecipients] = useState<CommunicationRecipient[]>([]);
  const [tenders, setTenders] = useState<CommunicationTenderLink[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useBodyPageMetadata('communication-center');

  const loadMailbox = useCallback(
    async (nextFolder = folder, nextSelectedId = selectedId, nextSearch = search) => {
      setLoading(true);
      setError('');
      try {
        const response = await communicationApi.listMailbox({
          folder: nextFolder,
          search: nextSearch.trim() || undefined,
          page: 1,
          pageSize: 30,
          sortBy: 'date',
          sortDirection: 'desc'
        });
        setMailbox(response);
        const nextSelected = response.messages.find((message) => message.id === nextSelectedId) ?? response.messages[0] ?? null;
        setSelectedId(nextSelected?.id ?? '');
        setSelectedMessage(nextSelected);
      } catch (caught) {
        setMailbox(emptyMailbox);
        setSelectedId('');
        setSelectedMessage(null);
        setError(errorMessage(caught, 'Communication Center could not load.'));
      } finally {
        setLoading(false);
      }
    },
    [folder, search, selectedId]
  );

  useEffect(() => {
    void loadMailbox(folder, selectedId);
  }, [folder]);

  useEffect(() => {
    if (!composeOpen) return;
    let active = true;

    async function loadComposeLookups() {
      try {
        const [recipientRows, tenderRows] = await Promise.all([
          communicationApi.listRecipients({ search: compose.recipientSearch.trim() || undefined, pageSize: 20 }),
          communicationApi.listTenderLinks({ search: compose.tenderSearch.trim() || undefined, pageSize: 20 })
        ]);
        if (!active) return;
        setRecipients(recipientRows);
        setTenders(tenderRows);
        setCompose((current) => ({
          ...current,
          recipientOrgId: current.recipientOrgId || recipientRows[0]?.id || '',
          tenderId: current.tenderId || ''
        }));
      } catch {
        if (!active) return;
        setRecipients([]);
        setTenders([]);
      }
    }

    const timer = window.setTimeout(() => void loadComposeLookups(), 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [compose.recipientSearch, compose.tenderSearch, composeOpen]);

  const counts = mailbox.counts;
  const selected = useMemo(
    () => selectedMessage ?? mailbox.messages.find((message) => message.id === selectedId) ?? null,
    [mailbox.messages, selectedId, selectedMessage]
  );

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey] || '/dashboard');
  }

  function openCompose() {
    setCompose(initialComposeState());
    setReplyBody('');
    setSelectedId('');
    setSelectedMessage(null);
    setComposeOpen(true);
  }

  async function openMessage(message: CommunicationMailboxMessage) {
    setComposeOpen(false);
    setSelectedId(message.id);
    setSelectedMessage(message);
    setReplyBody('');
    if (message.read) return;

    try {
      const updated = await communicationApi.markRead(message.id);
      setSelectedMessage(updated);
      setMailbox((current) => ({
        ...current,
        counts: {
          ...current.counts,
          unread: Math.max(0, current.counts.unread - 1)
        },
        messages: current.messages.map((item) => (item.id === updated.id ? updated : item))
      }));
    } catch {
      // Opening the message should still work if marking read fails.
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void loadMailbox(folder, selectedId, search);
  }

  async function submitCompose(event: FormEvent) {
    event.preventDefault();
    if (!user?.organizationId || !compose.recipientOrgId || !compose.subject.trim() || !compose.body.trim()) {
      setError('Choose a recipient and write a subject and message.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await communicationApi.composeMessage({
        senderOrgId: user.organizationId,
        recipientOrgId: compose.recipientOrgId,
        tenderId: compose.tenderId || undefined,
        kind: compose.category.toLowerCase().includes('clarification') ? 'CLARIFICATION' : 'MESSAGE',
        category: compose.category,
        subject: compose.subject.trim(),
        body: compose.body.trim(),
        priority: compose.priority,
        actionRequired: compose.actionRequired
      });
      setComposeOpen(false);
      setFolder('sent');
      setSelectedId(result.message.id);
      setSelectedMessage(result.message);
      setCompose(initialComposeState());
      await loadMailbox('sent', result.message.id);
    } catch (caught) {
      setError(errorMessage(caught, 'Message could not be sent.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!selected || !replyBody.trim()) return;

    setSaving(true);
    setError('');
    try {
      const result = await communicationApi.replyToMessage(selected.id, { body: replyBody.trim() });
      setReplyBody('');
      setFolder('sent');
      setSelectedId(result.message.id);
      setSelectedMessage(result.message);
      await loadMailbox('sent', result.message.id);
    } catch (caught) {
      setError(errorMessage(caught, 'Reply could not be sent.'));
    } finally {
      setSaving(false);
    }
  }

  async function messageAction(action: 'archive' | 'delete') {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      if (action === 'archive') await communicationApi.archive(selected.id);
      else await communicationApi.deleteMessage(selected.id);
      setSelectedId('');
      setSelectedMessage(null);
      await loadMailbox(folder, '');
    } catch (caught) {
      setError(errorMessage(caught, action === 'archive' ? 'Message could not be archived.' : 'Message could not be moved to trash.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PlanningTopBar title="Communication Center" onNavigate={navigateToPage} />
      <div className="workspace-home">
        <div className="workspace-shell">
          <main className="communication-center-page">
            <section className="communication-hero">
              <div>
                <span className="section-kicker">Personal mailbox</span>
                <h1>Communication Center</h1>
                <p>
                  {user?.organization || 'Your organization'} sees live procurement messages, clarifications, alerts, and tender communication history from the backend.
                </p>
                <button className="btn btn-primary" type="button" onClick={openCompose}>
                  Create Message
                </button>
              </div>
              <div className="communication-summary">
                <div><strong>{counts.unread}</strong><span>Unread</span></div>
                <div><strong>{counts.actionRequired}</strong><span>Action required</span></div>
                <div><strong>{counts.sent}</strong><span>Sent</span></div>
              </div>
            </section>

            {error ? (
              <section className="communication-context-panel">
                <strong>{error}</strong>
              </section>
            ) : null}

            {composeOpen ? (
              <section className="communication-compose-view">
                <form className="communication-compose-panel full-screen" onSubmit={submitCompose}>
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">New message</span>
                      <h2>Send procurement communication</h2>
                    </div>
                    <button className="btn btn-secondary" type="button" onClick={() => setComposeOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div className="communication-compose-grid">
                    <label>
                      <span>From mailbox</span>
                      <input className="form-input" value={user?.organization || 'Your organization'} readOnly />
                    </label>
                    <label>
                      <span>Category</span>
                      <select className="form-input" value={compose.category} onChange={(event) => setCompose((current) => ({ ...current, category: event.target.value }))}>
                        {categories.map((category) => <option key={category}>{category}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Find recipient</span>
                      <input className="form-input" value={compose.recipientSearch} onChange={(event) => setCompose((current) => ({ ...current, recipientSearch: event.target.value }))} placeholder="Search organizations" />
                    </label>
                    <label>
                      <span>Recipient business</span>
                      <select className="form-input" value={compose.recipientOrgId} onChange={(event) => setCompose((current) => ({ ...current, recipientOrgId: event.target.value }))} required>
                        <option value="">Choose recipient</option>
                        {recipients.map((recipient) => (
                          <option key={recipient.id} value={recipient.id}>
                            {recipient.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Find tender</span>
                      <input className="form-input" value={compose.tenderSearch} onChange={(event) => setCompose((current) => ({ ...current, tenderSearch: event.target.value }))} placeholder="Search tender reference or title" />
                    </label>
                    <label>
                      <span>Tender link</span>
                      <select className="form-input" value={compose.tenderId} onChange={(event) => setCompose((current) => ({ ...current, tenderId: event.target.value }))}>
                        <option value="">Not linked</option>
                        {tenders.map((tender) => (
                          <option key={tender.id} value={tender.id}>
                            {tender.reference} / {tender.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select className="form-input" value={compose.priority} onChange={(event) => setCompose((current) => ({ ...current, priority: event.target.value as CommunicationPriority }))}>
                        {priorities.map((priority) => <option key={priority} value={priority}>{displayLabel(priority)}</option>)}
                      </select>
                    </label>
                    <label className="communication-check">
                      <input type="checkbox" checked={compose.actionRequired} onChange={(event) => setCompose((current) => ({ ...current, actionRequired: event.target.checked }))} />
                      <span>Requires action</span>
                    </label>
                    <label className="span-2">
                      <span>Subject</span>
                      <input className="form-input" value={compose.subject} onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" required />
                    </label>
                    <label className="span-2">
                      <span>Message</span>
                      <textarea className="form-input" rows={6} value={compose.body} onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))} placeholder="Write your message" required />
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Sending...' : 'Send Message'}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => setComposeOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="communication-shell">
                <aside className="communication-folders">
                  <div className="communication-folder-title">
                    <strong>{user?.organization || 'Mailbox'}</strong>
                    <span>{counts.total} total messages</span>
                  </div>
                  <div className="communication-folder-list">
                    {folders.map((item) => (
                      <button className={folder === item.key ? 'active' : ''} type="button" key={item.key} onClick={() => setFolder(item.key)}>
                        <span>{item.label}</span>
                        <em>{folderCount(item.key, counts)}</em>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="communication-main">
                  <form className="communication-toolbar" onSubmit={submitSearch}>
                    <input className="form-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sender, receiver, tender, subject, status" />
                    <button className="btn btn-secondary" type="submit" disabled={loading}>Search</button>
                    <button className="btn btn-secondary" type="button" onClick={() => { setSearch(''); void loadMailbox(folder, selectedId, ''); }}>Clear</button>
                    <button className="btn btn-primary" type="button" onClick={openCompose}>New Message</button>
                  </form>
                  <div className="communication-tabs">
                    {folders.slice(0, 4).map((item) => (
                      <button className={folder === item.key ? 'active' : ''} type="button" key={item.key} onClick={() => setFolder(item.key)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="communication-list">
                    {loading ? (
                      <div className="communication-detail empty"><strong>Loading communication...</strong></div>
                    ) : mailbox.messages.length ? (
                      mailbox.messages.map((message) => (
                        <button className={`communication-row ${message.read ? '' : 'unread'} ${selected?.id === message.id ? 'active' : ''}`} type="button" key={message.id} onClick={() => void openMessage(message)}>
                          <span className="communication-unread-dot" />
                          <span className="communication-row-main">
                            <span className="communication-row-top">
                              <strong>{message.senderName ?? 'Platform'}</strong>
                              <time>{formatDate(message.updatedAt)}</time>
                            </span>
                            <h3>{message.subject}</h3>
                            <p>{message.body}</p>
                            <span className="communication-row-meta">
                              {message.tenderReference ?? message.category}
                            </span>
                          </span>
                          <span className="communication-row-badges">
                            <span className={badgeClass(message.status)}>{displayLabel(message.status)}</span>
                            <span className={badgeClass(message.priority)}>{displayLabel(message.priority)}</span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="communication-detail empty">
                        <strong>No messages match this view.</strong>
                        <span>Try another folder, clear search, or create a message.</span>
                      </div>
                    )}
                  </div>
                </div>

                <MessageDetail
                  message={selected}
                  replyBody={replyBody}
                  saving={saving}
                  onReplyBody={setReplyBody}
                  onReply={submitReply}
                  onArchive={() => void messageAction('archive')}
                  onDelete={() => void messageAction('delete')}
                  onClose={() => {
                    setSelectedId('');
                    setSelectedMessage(null);
                  }}
                />
              </section>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function MessageDetail({
  message,
  replyBody,
  saving,
  onReplyBody,
  onReply,
  onArchive,
  onDelete,
  onClose
}: {
  message: CommunicationMailboxMessage | null;
  replyBody: string;
  saving: boolean;
  onReplyBody: (value: string) => void;
  onReply: (event: FormEvent) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!message) {
    return (
      <aside className="communication-detail empty">
        <strong>Select a message</strong>
        <span>Open a message to read the thread, reply, or manage its folder.</span>
      </aside>
    );
  }

  return (
    <aside className="communication-detail">
      <header>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>
          Back
        </button>
        <div>
          <span className="section-kicker">{message.category}</span>
          <h2>{message.subject}</h2>
        </div>
        <div className="communication-detail-badges">
          <span className={badgeClass(message.status)}>{displayLabel(message.status)}</span>
          <span className={badgeClass(message.priority)}>{displayLabel(message.priority)}</span>
          {message.tenderReference ? <span className="badge badge-info">{message.tenderReference}</span> : null}
        </div>
      </header>

      <section className="record-summary compact">
        <div><span>From</span><strong>{message.senderName ?? 'Platform'}</strong></div>
        <div><span>To</span><strong>{message.recipientName ?? 'Platform'}</strong></div>
        <div><span>Updated</span><strong>{formatDate(message.updatedAt)}</strong></div>
      </section>

      <section className="communication-message-body">
        <p>{message.body}</p>
      </section>

      {message.attachments.length ? (
        <section className="communication-attachments">
          {message.attachments.map((attachment) => (
            <span className="communication-attachment-item" key={attachment.id}>
              <span>{attachment.name}</span>
              <em>{attachment.documentType}</em>
            </span>
          ))}
        </section>
      ) : null}

      {message.thread.length ? (
        <section className="communication-thread">
          {message.thread.map((entry) => (
            <article key={`${entry.createdAt}:${entry.senderName}:${entry.body}`}>
              <div>
                <strong>{entry.senderName ?? 'Platform'}</strong>
                <time>{formatDate(entry.createdAt)}</time>
              </div>
              <p>{entry.body}</p>
              {entry.notice ? <span>{entry.notice}</span> : null}
            </article>
          ))}
        </section>
      ) : null}

      <form className="communication-reply-box" onSubmit={onReply}>
        <label>
          <span>Reply</span>
          <textarea className="form-input" rows={4} value={replyBody} onChange={(event) => onReplyBody(event.target.value)} placeholder="Write a reply" />
        </label>
        <div className="inline-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || !replyBody.trim()}>
            {saving ? 'Sending...' : 'Send Reply'}
          </button>
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onArchive}>Archive</button>
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onDelete}>Move to Trash</button>
        </div>
      </form>
    </aside>
  );
}

function folderCount(folder: MailboxFolder, counts: CommunicationListResponse['counts']) {
  if (folder === 'inbox') return counts.inbox;
  if (folder === 'sent') return counts.sent;
  if (folder === 'unread') return counts.unread;
  if (folder === 'archived') return counts.archived;
  if (folder === 'trash') return counts.trash;
  return counts.total;
}

function displayLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function badgeClass(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('urgent') || normalized.includes('action') || normalized.includes('unread')) return 'badge badge-warning';
  if (normalized.includes('deleted') || normalized.includes('trash')) return 'badge badge-danger';
  if (normalized.includes('archived') || normalized.includes('read') || normalized.includes('replied') || normalized.includes('completed')) return 'badge badge-success';
  return 'badge badge-info';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    return response?.data?.error ?? response?.data?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
