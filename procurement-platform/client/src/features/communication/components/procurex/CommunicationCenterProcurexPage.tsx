import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { communicationApi } from '@/features/communication/api';
import type {
  CommunicationListResponse,
  CommunicationAttachmentUpload,
  CommunicationMailboxMessage,
  CommunicationMailboxQuery,
  CommunicationRecipient,
  CommunicationTenderLink
} from '@/features/communication/types';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';

type MailboxFolder = NonNullable<CommunicationMailboxQuery['folder']>;

type ComposeState = {
  recipients: CommunicationRecipient[];
  tenderId: string;
  category: string;
  subject: string;
  body: string;
  recipientSearch: string;
  tenderSearch: string;
  attachments: ComposeAttachment[];
  replyToMessageId: string;
};

type ComposeAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  documentType: string;
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
    unread: 0,
    actionRequired: 0
  },
  totalMessages: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1
};

const pageSize = 30;
const folders: Array<{ key: MailboxFolder; label: string }> = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'unread', label: 'Unread' },
  { key: 'archived', label: 'Archived' }
];

function initialComposeState(overrides: Partial<ComposeState> = {}): ComposeState {
  return {
    recipients: [],
    tenderId: '',
    category: 'General Message',
    subject: '',
    body: '',
    recipientSearch: '',
    tenderSearch: '',
    attachments: [],
    replyToMessageId: '',
    ...overrides
  };
}

export function CommunicationCenterProcurexPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const [mailbox, setMailbox] = useState<CommunicationListResponse>(emptyMailbox);
  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [dateSearch, setDateSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMailboxMessage | null>(null);
  const [compose, setCompose] = useState<ComposeState>(() => initialComposeState());
  const [replySource, setReplySource] = useState<CommunicationMailboxMessage | null>(null);
  const [recipients, setRecipients] = useState<CommunicationRecipient[]>([]);
  const [tenders, setTenders] = useState<CommunicationTenderLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const composePrefillKeyRef = useRef('');

  useBodyPageMetadata('communication-center');

  const routeView = searchParams.get('view');
  const routeMessageId = routeView === 'message' || routeView === 'reply' ? searchParams.get('id') ?? '' : '';
  const searchParamKey = searchParams.toString();
  const replyOpen = routeView === 'reply';
  const composeOpen = routeView === 'compose' || replyOpen;
  const messageView = routeView === 'message';

  const loadMailbox = useCallback(
    async (nextFolder: MailboxFolder, nextPage = 1, nextSelectedId = '', nextSearch = '') => {
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
        setError(errorMessage(caught, 'Communication Center could not load.'));
      } finally {
        setLoading(false);
      }
    },
    []
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
        messages: folder === 'unread'
          ? current.messages.filter((item) => item.id !== updated.id)
          : current.messages.map((item) => (item.id === updated.id ? updated : item)),
        totalMessages: folder === 'unread' ? Math.max(0, current.totalMessages - 1) : current.totalMessages
      }));
      return updated;
    } catch {
      return message;
    }
  }, [folder]);

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
        await markMessageRead(message);
      } catch (caught) {
        setSelectedId('');
        setSelectedMessage(null);
        setError(errorMessage(caught, 'Communication message could not be opened.'));
      } finally {
        setMessageLoading(false);
      }
    },
    [mailbox.messages, markMessageRead]
  );

  const loadReplySource = useCallback(
    async (messageId: string) => {
      if (!messageId) return;
      setMessageLoading(true);
      setError('');
      try {
        const mailboxMessage = mailbox.messages.find((message) => message.id === messageId);
        const message = mailboxMessage ?? (await communicationApi.getMessage(messageId));
        await markMessageRead(message);
        setReplySource(message);
        setCompose(replyComposeState(message));
      } catch (caught) {
        setReplySource(null);
        setCompose(initialComposeState());
        setError(errorMessage(caught, 'Reply could not be prepared.'));
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
      return;
    }

    if (!routeMessageId) {
      setError('Communication message link is missing a message id.');
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
    if (!replyOpen) {
      if (!compose.replyToMessageId) setReplySource(null);
      return;
    }

    if (!routeMessageId) {
      setError('Reply link is missing a message id.');
      setReplySource(null);
      setCompose(initialComposeState());
      return;
    }

    if (replySource?.id === routeMessageId && compose.replyToMessageId === routeMessageId) return;
    void loadReplySource(routeMessageId);
  }, [compose.replyToMessageId, loadReplySource, replyOpen, replySource, routeMessageId]);

  useEffect(() => {
    if (!composeOpen || replyOpen) return;
    if (composePrefillKeyRef.current === searchParamKey) return;
    composePrefillKeyRef.current = searchParamKey;

    const prefilledCompose = composeStateFromParams(searchParams);
    if (prefilledCompose) setCompose(prefilledCompose);
  }, [composeOpen, replyOpen, searchParamKey, searchParams]);

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
  const visibleMessages = useMemo(
    () =>
      dateSearch
        ? mailbox.messages.filter((message) => formatInputDate(message.createdAt) === dateSearch || formatInputDate(message.updatedAt) === dateSearch)
        : mailbox.messages,
    [dateSearch, mailbox.messages]
  );
  const selected = useMemo(
    () => selectedMessage ?? mailbox.messages.find((message) => message.id === selectedId) ?? null,
    [mailbox.messages, selectedId, selectedMessage]
  );
  const availableRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.id !== user?.organizationId && !compose.recipients.some((selectedRecipient) => selectedRecipient.id === recipient.id)),
    [compose.recipients, recipients, user?.organizationId]
  );
  const recipientSearchTerm = compose.recipientSearch.trim();
  const recipientSearchResults = useMemo(
    () => (recipientSearchTerm ? availableRecipients.filter((recipient) => recipientMatchesSearch(recipient, recipientSearchTerm)) : []),
    [availableRecipients, recipientSearchTerm]
  );
  const tenderOptions = useMemo(() => {
    const prefilledTender = tenderLinkFromParams(searchParams);
    const replyTender = replySource?.tenderId
      ? {
          id: replySource.tenderId,
          reference: replySource.tenderReference ?? replySource.tenderId,
          title: replySource.tenderTitle ?? 'Linked tender',
          buyerName: replySource.senderName ?? replySource.recipientName ?? 'Buyer',
          status: 'OPEN'
        }
      : null;
    const options = [...tenders];
    [prefilledTender, replyTender].forEach((item) => {
      if (item && !options.some((tender) => tender.id === item.id)) options.unshift(item);
    });
    return options;
  }, [replySource, searchParamKey, searchParams, tenders]);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey] || '/dashboard');
  }

  function goCommunicationHome(replace = false) {
    navigate('/communication', { replace });
    setSelectedId('');
    setSelectedMessage(null);
  }

  function openCompose() {
    setCompose(initialComposeState());
    setSelectedId('');
    setSelectedMessage(null);
    setSearchParams({ view: 'compose' });
  }

  function openMessage(message: CommunicationMailboxMessage) {
    setSelectedId(message.id);
    setSelectedMessage(message);
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
      recipientSearch: ''
    }));
  }

  function removeRecipient(recipientId: string) {
    setCompose((current) => ({
      ...current,
      recipients: current.recipients.filter((recipient) => recipient.id !== recipientId)
    }));
  }

  function selectTender(tenderId: string) {
    setCompose((current) => ({
      ...current,
      tenderId
    }));
  }

  function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setCompose((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        ...files.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          documentType: documentTypeForFile(file)
        }))
      ].slice(0, 20)
    }));
    event.target.value = '';
  }

  function removeAttachment(attachmentId: string) {
    setCompose((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
    }));
  }

  async function submitCompose(event: FormEvent) {
    event.preventDefault();
    const senderOrgId = user?.organizationId ?? '';
    const recipientOrgIds = Array.from(new Set(compose.recipients.map((recipient) => recipient.id).filter((id) => id && id !== senderOrgId)));
    if (!senderOrgId || !recipientOrgIds.length || !compose.subject.trim() || !compose.body.trim()) {
      setError('Choose at least one recipient and write a subject and message.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const attachmentUploads = compose.attachments.map(toAttachmentUpload);
      const metadata = compose.replyToMessageId ? { replyMode: 'compose-page' } : metadataFromComposeParams(searchParams);
      const results = compose.replyToMessageId
        ? [
            await communicationApi.replyToMessage(compose.replyToMessageId, {
              senderOrgId,
              recipientOrgId: recipientOrgIds[0],
              subject: compose.subject.trim(),
              category: compose.category,
              body: compose.body.trim(),
              attachmentUploads,
              metadata
            })
          ]
        : await Promise.all(recipientOrgIds.map((recipientOrgId) => communicationApi.composeMessage({
          senderOrgId,
          recipientOrgId,
          tenderId: compose.tenderId || undefined,
          kind: compose.category.toLowerCase().includes('clarification') ? 'CLARIFICATION' : 'MESSAGE',
          category: compose.category,
          subject: compose.subject.trim(),
          body: compose.body.trim(),
          attachmentUploads,
          metadata
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
      setError(errorMessage(caught, 'Message could not be sent.'));
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelectedMessage() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await communicationApi.archive(selected.id);
      setSelectedId('');
      setSelectedMessage(null);
      goCommunicationHome(true);
      await loadMailbox(folder, page, '', submittedSearch);
    } catch (caught) {
      setError(errorMessage(caught, 'Message could not be archived.'));
    } finally {
      setSaving(false);
    }
  }

  function openReply(message: CommunicationMailboxMessage) {
    setSearchParams({ view: 'reply', id: message.id });
  }

  function openMessageAction(message: CommunicationMailboxMessage) {
    const action = resolveMessageAction(message);
    if (action) navigate(action.route);
  }

  return (
    <>
      <PlanningTopBar title="Communication Center" onNavigate={navigateToPage} />
      <div className="workspace-home">
        <div className="workspace-shell">
          <main className="communication-center-page">
            {!composeOpen && !messageView ? (
              <section className="communication-hero">
                <div>
                  <span className="section-kicker">Personal mailbox</span>
                  <h1>Communication Center</h1>
                  <p>{user?.organization || 'Your organization'} only sees messages sent to this mailbox or messages sent from it.</p>
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
                      <span className="section-kicker">{replyOpen ? 'Reply message' : 'New message'}</span>
                      <h2>{replyOpen ? 'Reply to sender' : 'Send procurement communication'}</h2>
                    </div>
                    <button className="btn btn-secondary" type="button" onClick={() => goCommunicationHome()}>
                      Close
                    </button>
                  </div>
                  <div className="communication-compose-grid">
                    <label className="span-2">
                      <span>From mailbox</span>
                      <input className="form-input" value={user?.organization || 'Your organization'} readOnly />
                    </label>
                    <div className="communication-recipient-combobox span-2">
                      <label>
                        <span>Find recipients</span>
                        <input className="form-input" value={compose.recipientSearch} onChange={(event) => setCompose((current) => ({ ...current, recipientSearch: event.target.value }))} placeholder="Search organizations" />
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
                                <strong>{recipient.name}</strong>
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
                    <label className="span-2">
                      <span>Find tender</span>
                      <input className="form-input" value={compose.tenderSearch} onChange={(event) => setCompose((current) => ({ ...current, tenderSearch: event.target.value }))} placeholder="Search tender reference or title" />
                    </label>
                    <label>
                      <span>Tender reference</span>
                      <select className="form-input" value={compose.tenderId} onChange={(event) => selectTender(event.target.value)}>
                        <option value="">Not linked</option>
                        {tenderOptions.map((tender) => (
                          <option key={tender.id} value={tender.id}>
                            {tender.reference}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Tender title</span>
                      <select className="form-input" value={compose.tenderId} onChange={(event) => selectTender(event.target.value)}>
                        <option value="">Not linked</option>
                        {tenderOptions.map((tender) => (
                          <option key={tender.id} value={tender.id}>
                            {tender.title}
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
                    <div className="span-2 communication-compose-attachments">
                      <div>
                        <span className="form-label">Attachments</span>
                        <label className="btn btn-secondary communication-file-button">
                          Add files
                          <input type="file" multiple onChange={addAttachments} hidden />
                        </label>
                      </div>
                      {compose.attachments.length ? (
                        <div className="communication-attachment-list" aria-label="Selected attachments">
                          {compose.attachments.map((attachment) => (
                            <span className="communication-attachment-item" key={attachment.id}>
                              <span>{attachment.name}</span>
                              <em>{formatFileSize(attachment.size)}</em>
                              <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(attachment.id)}>
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Sending...' : replyOpen ? 'Send Reply' : 'Send Message'}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => goCommunicationHome()}>
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
                    saving={saving}
                    fullScreen
                    onReply={() => selected ? openReply(selected) : undefined}
                    onAction={() => selected ? openMessageAction(selected) : undefined}
                    onArchive={() => void archiveSelectedMessage()}
                    onClose={() => goCommunicationHome()}
                  />
                )}
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
                    <button className="btn btn-primary" type="button" onClick={openCompose}>New Message</button>
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
                      <div className="communication-detail empty"><strong>Loading communication...</strong></div>
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
          </main>
        </div>
      </div>
    </>
  );
}

function MessageDetail({
  message,
  saving,
  fullScreen = false,
  onReply,
  onAction,
  onArchive,
  onClose
}: {
  message: CommunicationMailboxMessage | null;
  saving: boolean;
  fullScreen?: boolean;
  onReply: () => void;
  onAction: () => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  if (!message) {
    return (
      <aside className={`communication-detail ${fullScreen ? 'full-screen ' : ''}empty`}>
        <strong>Message not found</strong>
        <span>Return to the mailbox list and open another communication item.</span>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Return to mailbox
        </button>
      </aside>
    );
  }

  const sentMessage = message.folder === 'sent';
  const contextPartyLabel = sentMessage ? 'Receiver' : 'Sender';
  const contextPartyName = sentMessage ? message.recipientName : message.senderName;
  const nextAction = resolveMessageAction(message);
  const showWorkflowAction = Boolean(nextAction);

  return (
    <aside className={`communication-detail ${fullScreen ? 'full-screen' : ''}`}>
      <section className="communication-context-panel communication-context-panel-primary">
        <div className="record-summary compact">
          <div><span>{contextPartyLabel}</span><strong>{contextPartyName ?? 'Platform'}</strong></div>
          <div><span>Date</span><strong>{formatDate(message.createdAt)}</strong></div>
          <div><span>Tender reference</span><strong>{message.tenderReference ?? 'Not linked'}</strong></div>
          <div><span>Status</span><strong>{message.actionRequired ? 'Action required' : 'Workflow active'}</strong></div>
          <div><span>Visibility</span><strong>{message.visibility ?? 'Private'}</strong></div>
        </div>
      </section>

      <section className="communication-message-body">
        <h1>{message.subject}</h1>
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

      <section className="communication-action-panel">
        <div>
          <span className="section-kicker">Next action</span>
          <strong>{messageActionText(message)}</strong>
        </div>
        <div className="inline-actions">
          <button className="btn btn-primary" type="button" disabled={saving} onClick={onReply}>Reply</button>
          {showWorkflowAction ? (
            <button className="btn btn-secondary" type="button" disabled={saving} onClick={onAction}>{nextAction?.label}</button>
          ) : null}
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onArchive}>Archive</button>
        </div>
      </section>
    </aside>
  );
}

function folderCount(folder: MailboxFolder, counts: CommunicationListResponse['counts']) {
  if (folder === 'inbox') return counts.inbox;
  if (folder === 'sent') return counts.sent;
  if (folder === 'unread') return counts.unread;
  if (folder === 'archived') return counts.archived;
  return counts.total;
}

function replyComposeState(message: CommunicationMailboxMessage): ComposeState {
  const recipientOrgId = otherPartyOrgId(message);
  const recipientName = otherPartyName(message);
  const isClarification = isClarificationMessage(message);

  return initialComposeState({
    recipients: recipientOrgId
      ? [
          {
            id: recipientOrgId,
            name: recipientName ?? 'Message sender',
            kind: 'COMPANY',
            country: '',
            capabilities: []
          }
        ]
      : [],
    tenderId: message.tenderId ?? '',
    category: isClarification ? 'Clarification' : message.category,
    subject: isClarification ? 'Providing clarification' : prefixReplySubject(message.subject),
    body: '',
    replyToMessageId: message.id
  });
}

function composeStateFromParams(params: URLSearchParams): ComposeState | null {
  const tenderId = params.get('tenderId') ?? '';
  const recipientOrgId = params.get('recipientOrgId') ?? '';
  const recipientName = params.get('recipientName') ?? '';
  const subject = params.get('subject') ?? params.get('title') ?? '';
  const category = params.get('category') ?? (params.get('mode') === 'clarification' ? 'Clarification' : '');

  if (!tenderId && !recipientOrgId && !subject && !category) return null;

  return initialComposeState({
    recipients: recipientOrgId
      ? [
          {
            id: recipientOrgId,
            name: recipientName || 'Selected recipient',
            kind: 'COMPANY',
            country: '',
            capabilities: []
          }
        ]
      : [],
    tenderId,
    category: category || 'General Message',
    subject: subject || (category.toLowerCase().includes('clarification') ? 'Seeking clarification' : ''),
    body: ''
  });
}

function tenderLinkFromParams(params: URLSearchParams): CommunicationTenderLink | null {
  const id = params.get('tenderId');
  if (!id) return null;
  return {
    id,
    reference: params.get('tenderReference') || id,
    title: params.get('tenderTitle') || 'Linked tender',
    buyerName: params.get('buyerName') || params.get('recipientName') || 'Buyer',
    status: params.get('tenderStatus') || 'OPEN'
  };
}

function metadataFromComposeParams(params: URLSearchParams): Record<string, unknown> {
  const actionLabel = params.get('actionLabel');
  const actionRoute = params.get('actionRoute');
  const mode = params.get('mode');
  return {
    ...(mode ? { mode } : {}),
    ...(actionLabel ? { actionLabel } : {}),
    ...(actionRoute ? { actionRoute } : {})
  };
}

function toAttachmentUpload(attachment: ComposeAttachment): CommunicationAttachmentUpload {
  return {
    name: attachment.name,
    documentType: attachment.documentType,
    mimeType: attachment.type || undefined,
    size: attachment.size
  };
}

function messageActionText(message: CommunicationMailboxMessage) {
  const action = resolveMessageAction(message);
  if (isClarificationMessage(message)) return 'Reply to keep the clarification linked to this tender.';
  if (action) return `Reply or continue with ${action.label.toLowerCase()}.`;
  if (message.actionRequired) return 'Reply or resolve this communication item';
  if (message.folder === 'sent') return 'Await recipient response';
  if (!message.read) return 'Review message';
  return 'Reply to this message';
}

function resolveMessageAction(message: CommunicationMailboxMessage): { label: string; route: string } | null {
  const metadataAction = actionFromMetadata(message.metadata);
  if (metadataAction) return metadataAction;
  if (isClarificationMessage(message)) return null;

  const tenderId = message.tenderId ? encodeURIComponent(message.tenderId) : '';
  const text = `${message.category} ${message.subject} ${message.body} ${message.status}`.toLowerCase();

  if (/(passed evaluation|passed review|winner|won|contract negotiation|negotiate|contract)/.test(text) && tenderId) {
    return { label: 'Go to Contracts', route: `/awards-contracts/negotiation?tenderId=${tenderId}` };
  }

  if (/(invited|invitation|start bidding|submit bid|bid now)/.test(text) && tenderId) {
    return { label: 'Start Bidding', route: `/bidding?tenderId=${tenderId}` };
  }

  if (/(deadline|closed|bidding has closed|start evaluation|evaluate|evaluation)/.test(text) && tenderId) {
    return { label: 'Start Evaluation', route: `/evaluation?tenderId=${tenderId}` };
  }

  if (/(award recommendation|recommendation|award decision)/.test(text) && tenderId) {
    return { label: 'Review Award', route: `/awards-contracts/recommendation?tenderId=${tenderId}` };
  }

  if (/(award response|accept award|respond to award)/.test(text) && tenderId) {
    return { label: 'Respond to Award', route: `/awards-contracts/award-response?tenderId=${tenderId}` };
  }

  if (/(delivery|invoice|payment|post-award|performance)/.test(text) && tenderId) {
    return { label: 'Track Contract', route: `/awards-contracts/post-award?tenderId=${tenderId}` };
  }

  if (/(failed review|amend|amendment|published|tender)/.test(text) && tenderId) {
    return { label: 'Open Tender', route: `/procurement/supplier-tender-detail?tenderId=${tenderId}` };
  }

  return null;
}

function actionFromMetadata(metadata: Record<string, unknown>): { label: string; route: string } | null {
  const route = stringMetadata(metadata.actionRoute) ?? stringMetadata(metadata.route) ?? stringMetadata(metadata.nextRoute);
  if (!route) return null;
  return {
    label: stringMetadata(metadata.actionLabel) ?? stringMetadata(metadata.label) ?? 'Open linked action',
    route
  };
}

function otherPartyOrgId(message: CommunicationMailboxMessage) {
  if (message.folder === 'sent') return message.recipientOrgId ?? '';
  return message.senderOrgId ?? '';
}

function otherPartyName(message: CommunicationMailboxMessage) {
  if (message.folder === 'sent') return message.recipientName ?? '';
  return message.senderName ?? '';
}

function isClarificationMessage(message: CommunicationMailboxMessage) {
  return message.kind === 'CLARIFICATION' || /clarification/i.test(`${message.category} ${message.subject}`);
}

function prefixReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function documentTypeForFile(file: File) {
  if (file.type) return file.type;
  const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
  return extension ? extension.toUpperCase() : 'Attachment';
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function stringMetadata(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
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
  if (normalized.includes('deleted')) return 'badge badge-danger';
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
