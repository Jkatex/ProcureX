import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { communicationApi } from '@/features/communication/api';
import type {
  CommunicationListResponse,
  CommunicationMailboxMessage,
  CommunicationMailboxQuery,
  CommunicationRecipient,
  CommunicationTenderLink
} from '@/features/communication/types';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminShell, badgeClass, displayLabel, formatDate } from './AdminShared';

type MailboxFolder = NonNullable<CommunicationMailboxQuery['folder']>;

type ComposeState = {
  recipients: CommunicationRecipient[];
  tenderId: string;
  category: string;
  subject: string;
  body: string;
  organizationSearch: string;
  tenderSearch: string;
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
  pageSize: 30,
  totalPages: 1
};

const folders: Array<{ key: MailboxFolder; label: string }> = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'unread', label: 'Unread' },
  { key: 'archived', label: 'Archived' },
  { key: 'trash', label: 'Trash' }
];

const categories = ['General Message', 'Tender Clarification', 'System Notification', 'Evaluation Update', 'Award Notification', 'Deadline Reminder'];
const pageSize = 30;

function initialComposeState(): ComposeState {
  return {
    recipients: [],
    tenderId: '',
    category: 'General Message',
    subject: '',
    body: '',
    organizationSearch: '',
    tenderSearch: ''
  };
}

export function AdminCommunicationProcurexPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const [mailbox, setMailbox] = useState<CommunicationListResponse>(emptyMailbox);
  const [selectedId, setSelectedId] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMailboxMessage | null>(null);
  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [dateSearch, setDateSearch] = useState('');
  const [page, setPage] = useState(1);
  const [compose, setCompose] = useState<ComposeState>(() => initialComposeState());
  const [organizations, setOrganizations] = useState<CommunicationRecipient[]>([]);
  const [tenders, setTenders] = useState<CommunicationTenderLink[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useBodyPageMetadata('admin-communication');

  const routeView = searchParams.get('view');
  const routeMessageId = routeView === 'message' ? searchParams.get('id') ?? '' : '';
  const composeOpen = routeView === 'compose';
  const messageView = routeView === 'message';
  const senderOrgId = user?.organizationId ?? '';
  const senderMailboxName = user?.organization || user?.displayName || 'Admin mailbox';

  const loadMailbox = useCallback(
    async (nextFolder: MailboxFolder = folder, nextPage = 1, nextSelectedId = '', nextSearch = submittedSearch) => {
      setLoading(true);
      setError('');
      try {
        const response = await communicationApi.listMailbox({
          folder: nextFolder,
          search: nextSearch.trim() || undefined,
          page: nextPage,
          pageSize,
          sortBy: 'date',
          sortDirection: 'desc'
        });
        setMailbox(response);
        setPage(nextPage);

        const nextSelected = nextSelectedId ? response.messages.find((message) => message.id === nextSelectedId) ?? null : null;
        if (nextSelectedId) {
          setSelectedId(nextSelectedId);
          if (nextSelected) setSelectedMessage(nextSelected);
        } else {
          setSelectedId('');
          setSelectedMessage(null);
        }
      } catch (caught) {
        setMailbox(emptyMailbox);
        setSelectedId('');
        setSelectedMessage(null);
        setError(errorMessage(caught, 'Admin communication could not load.'));
      } finally {
        setLoading(false);
      }
    },
    [folder, submittedSearch]
  );

  useEffect(() => {
    void loadMailbox(folder, 1, messageView ? routeMessageId : '', submittedSearch);
  }, [folder, loadMailbox, messageView, routeMessageId, submittedSearch]);

  const markMessageRead = useCallback(async (message: CommunicationMailboxMessage) => {
    if (message.read) return message;

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
      return updated;
    } catch {
      return message;
    }
  }, []);

  const loadMessage = useCallback(
    async (messageId: string) => {
      if (!messageId) return;
      setMessageLoading(true);
      setError('');
      try {
        const mailboxMessage = mailbox.messages.find((message) => message.id === messageId);
        const message = mailboxMessage ?? (await communicationApi.getMessage(messageId));
        setSelectedId(message.id);
        setSelectedMessage(message);
        setReplyBody('');
        await markMessageRead(message);
      } catch (caught) {
        setSelectedId('');
        setSelectedMessage(null);
        setError(errorMessage(caught, 'Admin communication message could not be opened.'));
      } finally {
        setMessageLoading(false);
      }
    },
    [mailbox.messages, markMessageRead]
  );

  useEffect(() => {
    if (!messageView) {
      setMessageLoading(false);
      setSelectedId('');
      setSelectedMessage(null);
      setReplyBody('');
      return;
    }

    if (!routeMessageId) {
      setError('Admin communication link is missing a message id.');
      setSelectedId('');
      setSelectedMessage(null);
      return;
    }

    if (selectedMessage?.id === routeMessageId) {
      setSelectedId(routeMessageId);
      if (!selectedMessage.read) void markMessageRead(selectedMessage);
      return;
    }

    void loadMessage(routeMessageId);
  }, [loadMessage, markMessageRead, messageView, routeMessageId, selectedMessage]);

  useEffect(() => {
    if (!composeOpen) return;
    let active = true;

    async function loadComposeLookups() {
      try {
        const [organizationRows, tenderRows] = await Promise.all([
          communicationApi.listRecipients({ search: compose.organizationSearch.trim() || undefined, pageSize: 30 }),
          communicationApi.listTenderLinks({ search: compose.tenderSearch.trim() || undefined, pageSize: 20 })
        ]);
        if (!active) return;
        setOrganizations(organizationRows);
        setTenders(tenderRows);
      } catch {
        if (!active) return;
        setOrganizations([]);
        setTenders([]);
      }
    }

    const timer = window.setTimeout(() => void loadComposeLookups(), 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [compose.organizationSearch, compose.tenderSearch, composeOpen]);

  const counts = mailbox.counts;
  const selected = useMemo(
    () => selectedMessage ?? mailbox.messages.find((message) => message.id === selectedId) ?? null,
    [mailbox.messages, selectedId, selectedMessage]
  );
  const visibleMessages = useMemo(
    () =>
      dateSearch
        ? mailbox.messages.filter((message) => formatInputDate(message.createdAt) === dateSearch || formatInputDate(message.updatedAt) === dateSearch)
        : mailbox.messages,
    [dateSearch, mailbox.messages]
  );
  const availableRecipients = useMemo(
    () => organizations.filter((organization) => organization.id !== senderOrgId && !compose.recipients.some((recipient) => recipient.id === organization.id)),
    [compose.recipients, organizations, senderOrgId]
  );
  const recipientSearchTerm = compose.organizationSearch.trim();
  const recipientSearchResults = useMemo(
    () => (recipientSearchTerm ? availableRecipients.filter((recipient) => recipientMatchesSearch(recipient, recipientSearchTerm)) : []),
    [availableRecipients, recipientSearchTerm]
  );

  function goAdminCommunicationHome(replace = false) {
    navigate('/admin/communication', { replace });
    setSelectedId('');
    setSelectedMessage(null);
    setReplyBody('');
  }

  function openCompose() {
    setCompose(initialComposeState());
    setReplyBody('');
    setSelectedId('');
    setSelectedMessage(null);
    setSearchParams({ view: 'compose' });
  }

  function openMessage(message: CommunicationMailboxMessage) {
    setSelectedId(message.id);
    setSelectedMessage(message);
    setReplyBody('');
    setSearchParams({ view: 'message', id: message.id });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function addRecipient(recipient: CommunicationRecipient) {
    setCompose((current) => ({
      ...current,
      recipients: current.recipients.some((selectedRecipient) => selectedRecipient.id === recipient.id)
        ? current.recipients
        : [...current.recipients, recipient],
      organizationSearch: ''
    }));
  }

  function removeRecipient(recipientId: string) {
    setCompose((current) => ({
      ...current,
      recipients: current.recipients.filter((recipient) => recipient.id !== recipientId)
    }));
  }

  async function submitCompose(event: FormEvent) {
    event.preventDefault();
    const recipientOrgIds = Array.from(new Set(compose.recipients.map((recipient) => recipient.id).filter((id) => id && id !== senderOrgId)));
    if (!senderOrgId || !recipientOrgIds.length || !compose.subject.trim() || !compose.body.trim()) {
      setError('Choose at least one recipient organization, then write a subject and message.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const results = await Promise.all(recipientOrgIds.map((recipientOrgId) => communicationApi.composeMessage({
        senderOrgId,
        recipientOrgId,
        tenderId: compose.tenderId.trim() || undefined,
        kind: communicationKindForCategory(compose.category),
        category: compose.category,
        subject: compose.subject.trim(),
        body: compose.body.trim()
      })));
      const result = results[0];
      if (!result) throw new Error('No message was sent.');
      setFolder('sent');
      setSelectedId(result.message.id);
      setSelectedMessage(result.message);
      setCompose(initialComposeState());
      setSearchParams({ view: 'message', id: result.message.id }, { replace: true });
      await loadMailbox('sent', 1, result.message.id, submittedSearch);
    } catch (caught) {
      setError(errorMessage(caught, 'Admin message could not be sent.'));
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
      setSearchParams({ view: 'message', id: result.message.id }, { replace: true });
      await loadMailbox('sent', 1, result.message.id, submittedSearch);
    } catch (caught) {
      setError(errorMessage(caught, 'Admin reply could not be sent.'));
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
      goAdminCommunicationHome(true);
      await loadMailbox(folder, page, '', submittedSearch);
    } catch (caught) {
      setError(errorMessage(caught, action === 'archive' ? 'Message could not be archived.' : 'Message could not be moved to trash.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell currentPath="/admin/communication" title="Admin Communication Center">
      <div className="communication-center-page">
        {!composeOpen && !messageView ? (
          <section className="communication-hero">
            <div>
              <span className="section-kicker">Platform mailbox</span>
              <h1>Admin Communication Center</h1>
              <p>Monitor platform messages, clarifications, notices, and action-required communication from the same mailbox layout users work with.</p>
            </div>
            <div className="communication-summary">
              <div><strong>{counts.unread}</strong><span>Unread</span></div>
              <div><strong>{counts.actionRequired}</strong><span>Action required</span></div>
            </div>
          </section>
        ) : null}

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
                <button className="btn btn-secondary" type="button" onClick={() => goAdminCommunicationHome()}>
                  Close
                </button>
              </div>
              <div className="communication-compose-grid">
                <label>
                  <span>From mailbox</span>
                  <input className="form-input" value={senderMailboxName} readOnly />
                </label>
                <label>
                  <span>Category</span>
                  <select className="form-input" value={compose.category} onChange={(event) => setCompose((current) => ({ ...current, category: event.target.value }))}>
                    {categories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <div className="communication-recipient-combobox span-2">
                  <label>
                    <span>Find recipients</span>
                    <input
                      className="form-input"
                      value={compose.organizationSearch}
                      onChange={(event) => setCompose((current) => ({ ...current, organizationSearch: event.target.value }))}
                      placeholder="Search organizations"
                    />
                  </label>
                  {compose.recipients.length ? (
                    <div className="communication-recipient-chips" aria-label="Selected recipients">
                      {compose.recipients.map((recipient) => (
                        <span className="communication-recipient-chip" key={recipient.id}>
                          <strong>{recipient.name}</strong>
                          <button type="button" aria-label={`Remove ${recipient.name}`} onClick={() => removeRecipient(recipient.id)}>
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="communication-recipient-empty">Search and select one or more recipients.</span>
                  )}
                  {recipientSearchTerm ? (
                    <div className="communication-recipient-results">
                      {recipientSearchResults.length ? (
                        recipientSearchResults.map((recipient) => (
                          <button className="communication-recipient-result" type="button" key={recipient.id} onClick={() => addRecipient(recipient)}>
                            <strong>Add {recipient.name}</strong>
                          </button>
                        ))
                      ) : (
                        <span className="communication-recipient-empty">No recipients match this search.</span>
                      )}
                    </div>
                  ) : null}
                  <div className="communication-recipient-count">
                    <span className="badge badge-info">{compose.recipients.length} selected</span>
                  </div>
                </div>
                <label>
                  <span>Find tender</span>
                  <input
                    className="form-input"
                    value={compose.tenderSearch}
                    onChange={(event) => setCompose((current) => ({ ...current, tenderSearch: event.target.value }))}
                    placeholder="Search tender reference or title"
                  />
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
                <button className="btn btn-secondary" type="button" onClick={() => goAdminCommunicationHome()}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : messageView ? (
          <section className="communication-message-view">
            {messageLoading ? (
              <aside className="communication-detail full-screen empty">
                <strong>Loading communication...</strong>
              </aside>
            ) : (
              <MessageDetail
                message={selected}
                replyBody={replyBody}
                saving={saving}
                onArchive={() => void messageAction('archive')}
                onDelete={() => void messageAction('delete')}
                onReply={submitReply}
                onReplyBody={setReplyBody}
                onClose={() => goAdminCommunicationHome()}
              />
            )}
          </section>
        ) : (
          <section className="communication-shell">
            <aside className="communication-folders">
              <div className="communication-folder-title">
                <strong>Admin mailbox</strong>
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
                <input
                  className="form-input"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSubmittedSearch(event.target.value.trim());
                  }}
                  placeholder="Search sender, receiver, tender, subject, status"
                />
                <input
                  aria-label="Search messages by date"
                  className="form-input"
                  type={dateSearch ? 'date' : 'text'}
                  value={dateSearch}
                  onBlur={(event) => {
                    if (!dateSearch) event.currentTarget.type = 'text';
                  }}
                  onChange={(event) => setDateSearch(event.target.value)}
                  onFocus={(event) => {
                    event.currentTarget.type = 'date';
                  }}
                  placeholder="Search by date"
                />
                {search || dateSearch ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSubmittedSearch('');
                      setDateSearch('');
                    }}
                  >
                    Clear
                  </button>
                ) : null}
                <button className="btn btn-primary" type="button" onClick={openCompose}>
                  New Message
                </button>
              </form>
              <div className="communication-tabs">
                {[folders[0], folders[1], folders[3], folders[2]].map((item) => (
                  <button className={folder === item.key ? 'active' : ''} type="button" key={item.key} onClick={() => setFolder(item.key)}>
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="communication-list">
                {loading ? (
                  <div className="communication-detail empty">
                    <strong>Loading communication...</strong>
                  </div>
                ) : visibleMessages.length ? (
                  visibleMessages.map((message) => {
                    const sentMessage = message.folder === 'sent';
                    const partyLabel = sentMessage ? 'Receiver' : 'Sender';
                    const partyName = sentMessage ? message.recipientName : message.senderName;
                    return (
                      <button className={`communication-row ${message.read ? '' : 'unread'} ${selected?.id === message.id ? 'active' : ''}`} type="button" key={message.id} onClick={() => openMessage(message)}>
                        <span className="communication-unread-dot" />
                        <span className="communication-row-main">
                          <span className="communication-row-top">
                            <strong>{partyName ?? 'Platform'}</strong>
                            <time>{formatDate(message.updatedAt)}</time>
                          </span>
                          <h3>{message.subject}</h3>
                          <p>{message.body}</p>
                          <span className="communication-row-meta">
                            <span>{partyLabel}</span>
                            <span>Tender: {message.tenderReference ?? 'Not linked'}</span>
                            <span>{message.category}</span>
                          </span>
                        </span>
                        <span className="communication-row-badges">
                          <span className={badgeClass(message.status)}>{displayLabel(message.status)}</span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="communication-detail empty">
                    <strong>No messages match this view.</strong>
                    <span>Try another folder, clear search, or create a message.</span>
                  </div>
                )}
              </div>
              {mailbox.totalPages > 1 ? (
                <div className="communication-pagination">
                  <button className="btn btn-secondary btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => void loadMailbox(folder, page - 1, '', submittedSearch)}>
                    Previous
                  </button>
                  <span className="badge badge-info">
                    Page {page} of {mailbox.totalPages}
                  </span>
                  <button className="btn btn-secondary btn-sm" type="button" disabled={page >= mailbox.totalPages || loading} onClick={() => void loadMailbox(folder, page + 1, '', submittedSearch)}>
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function MessageDetail({
  message,
  replyBody,
  saving,
  onReply,
  onReplyBody,
  onArchive,
  onDelete,
  onClose
}: {
  message: CommunicationMailboxMessage | null;
  replyBody: string;
  saving: boolean;
  onReply: (event: FormEvent) => void;
  onReplyBody: (value: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!message) {
    return (
      <aside className="communication-detail full-screen empty">
        <strong>Message not found</strong>
        <span>Return to the mailbox list and open another communication item.</span>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Back to inbox
        </button>
      </aside>
    );
  }

  const sentMessage = message.folder === 'sent';
  const contextPartyLabel = sentMessage ? 'Receiver' : 'Sender';
  const contextPartyName = sentMessage ? message.recipientName : message.senderName;

  return (
    <aside className="communication-detail full-screen">
      <section className="communication-context-panel communication-context-panel-primary">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Message context</span>
            <strong>{message.tenderTitle ?? message.subject}</strong>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Back to inbox
          </button>
        </div>
        <div className="record-summary compact">
          <div><span>{contextPartyLabel}</span><strong>{contextPartyName ?? 'Platform'}</strong></div>
          <div><span>Date</span><strong>{formatDate(message.createdAt)}</strong></div>
          <div><span>Tender reference</span><strong>{message.tenderReference ?? 'Not linked'}</strong></div>
          <div><span>Status</span><strong>{message.actionRequired ? 'Action required' : 'Workflow active'}</strong></div>
          <div><span>Visibility</span><strong>{message.visibility ?? 'Private'}</strong></div>
        </div>
        <div className="communication-detail-badges">
          <span className={badgeClass(message.category)}>{message.category}</span>
          <span className={badgeClass(message.status)}>{displayLabel(message.status)}</span>
          <span className={badgeClass(message.priority)}>{displayLabel(message.priority)}</span>
        </div>
      </section>

      <section className="communication-message-body">
        <span className="section-kicker">Message</span>
        <h2>{message.subject}</h2>
        <p>{message.body}</p>
        {message.attachments.length ? (
          <div className="communication-attachments">
            {message.attachments.map((attachment) => (
              <span className="communication-attachment-item" key={attachment.id}>
                <span>{attachment.name}</span>
                <em>{attachment.documentType}</em>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {message.thread.length ? (
        <section className="communication-thread">
          {message.thread.map((entry) => (
            <article key={`${entry.createdAt}:${entry.senderName}:${entry.body}`}>
              <div>
                <strong>{entry.senderName ?? 'Platform'}</strong>
                <time>{formatDate(entry.createdAt)}</time>
              </div>
              <p>{entry.body}</p>
              {entry.notice ? <span className="badge badge-info">{entry.notice}</span> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="communication-action-panel">
        <div>
          <span className="section-kicker">Next action</span>
          <strong>{messageActionText(message)}</strong>
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onArchive}>Archive</button>
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onDelete}>Move to Trash</button>
        </div>
      </section>

      <form className="communication-reply-box" onSubmit={onReply}>
        <div>
          <span className="section-kicker">Reply</span>
          <strong>Send a response from this thread</strong>
        </div>
        <label>
          <span>Response message</span>
          <textarea className="form-input" rows={4} value={replyBody} onChange={(event) => onReplyBody(event.target.value)} placeholder="Write a reply" />
        </label>
        <div className="inline-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || !replyBody.trim()}>
            {saving ? 'Sending...' : 'Send Reply'}
          </button>
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

function communicationKindForCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('clarification')) return 'CLARIFICATION';
  if (normalized.includes('notification') || normalized.includes('notice')) return 'NOTIFICATION';
  if (normalized.includes('alert') || normalized.includes('deadline')) return 'ALERT';
  return 'MESSAGE';
}

function messageActionText(message: CommunicationMailboxMessage) {
  if (message.actionRequired) return 'Reply or resolve this communication item';
  if (message.folder === 'sent') return 'Await recipient response';
  if (!message.read) return 'Review message';
  return 'Reply to this message';
}

function formatInputDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    return response?.data?.error ?? response?.data?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function recipientMatchesSearch(recipient: CommunicationRecipient, searchTerm: string) {
  const normalized = searchTerm.toLowerCase();
  return recipient.name.toLowerCase().includes(normalized);
}
