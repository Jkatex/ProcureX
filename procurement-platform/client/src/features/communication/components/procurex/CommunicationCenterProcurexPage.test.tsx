import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { assumeUser, signOut } from '@/features/auth/slice';
import { communicationApi } from '@/features/communication/api';
import type { CommunicationListResponse, CommunicationMailboxMessage } from '@/features/communication/types';
import { CommunicationCenterProcurexPage } from './CommunicationCenterProcurexPage';

vi.mock('@/features/communication/api', () => ({
  communicationApi: {
    listMailbox: vi.fn(),
    markRead: vi.fn(),
    composeMessage: vi.fn(),
    replyToMessage: vi.fn(),
    archive: vi.fn(),
    deleteMessage: vi.fn(),
    listRecipients: vi.fn(),
    listTenderLinks: vi.fn()
  }
}));

const listMailbox = vi.mocked(communicationApi.listMailbox);
const markRead = vi.mocked(communicationApi.markRead);
const composeMessage = vi.mocked(communicationApi.composeMessage);
const replyToMessage = vi.mocked(communicationApi.replyToMessage);
const archive = vi.mocked(communicationApi.archive);
const deleteMessage = vi.mocked(communicationApi.deleteMessage);
const listRecipients = vi.mocked(communicationApi.listRecipients);
const listTenderLinks = vi.mocked(communicationApi.listTenderLinks);

const now = '2026-07-02T09:00:00.000Z';

const message: CommunicationMailboxMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'MESSAGE',
  folder: 'inbox',
  category: 'General Message',
  subject: 'Site visit schedule',
  body: 'Please confirm whether the site visit is still available on Friday.',
  status: 'UNREAD',
  priority: 'HIGH',
  read: false,
  actionRequired: true,
  visibility: null,
  ownerOrgId: 'org-1',
  ownerName: 'Kilimanjaro Supplies Limited',
  senderOrgId: 'org-2',
  senderName: 'Ministry of Health',
  recipientOrgId: 'org-1',
  recipientName: 'Kilimanjaro Supplies Limited',
  tenderId: '22222222-2222-4222-8222-222222222222',
  tenderReference: 'PX-2026-001',
  tenderTitle: 'Medical supplies',
  relatedMessageId: null,
  conversationId: 'conversation-1',
  contextKey: 'tender:22222222-2222-4222-8222-222222222222',
  thread: [
    {
      senderOrgId: 'org-2',
      senderName: 'Ministry of Health',
      body: 'Please confirm whether the site visit is still available on Friday.',
      notice: null,
      createdAt: now
    }
  ],
  attachments: [
    {
      id: 'attachment-1',
      documentId: 'document-1',
      name: 'agenda.pdf',
      documentType: 'PDF',
      objectKey: 'documents/agenda.pdf',
      checksum: null,
      createdAt: now
    }
  ],
  metadata: {},
  createdAt: now,
  updatedAt: now
};

const readMessage = { ...message, read: true, status: 'READ' as const };
const sentMessage = {
  ...readMessage,
  id: '33333333-3333-4333-8333-333333333333',
  folder: 'sent',
  senderOrgId: 'org-1',
  senderName: 'Kilimanjaro Supplies Limited',
  recipientOrgId: 'org-2',
  recipientName: 'Ministry of Health',
  subject: 'Re: Site visit schedule'
};

function mailbox(messages: CommunicationMailboxMessage[] = [message]): CommunicationListResponse {
  return {
    messages,
    counts: {
      total: messages.length,
      inbox: messages.filter((item) => item.folder === 'inbox').length,
      sent: messages.filter((item) => item.folder === 'sent').length,
      drafts: 0,
      archived: 0,
      trash: 0,
      unread: messages.filter((item) => !item.read).length,
      actionRequired: messages.filter((item) => item.actionRequired).length
    },
    totalMessages: messages.length,
    page: 1,
    pageSize: 30,
    totalPages: 1
  };
}

function renderPage() {
  store.dispatch(signOut());
  store.dispatch(
    assumeUser({
      id: 'user-1',
      displayName: 'Demo User',
      email: 'demo@procurex.tz',
      phone: null,
      accountType: 'USER',
      organization: 'Kilimanjaro Supplies Limited',
      organizationId: 'org-1',
      capabilities: ['BUYER', 'SUPPLIER'],
      permissions: ['identity.verify'],
      verificationStatus: 'APPROVED',
      preferences: { preferredLanguage: 'en', timezone: 'Africa/Dar_es_Salaam' }
    })
  );

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/communication']}>
        <CommunicationCenterProcurexPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('CommunicationCenterProcurexPage', () => {
  beforeEach(() => {
    listMailbox.mockResolvedValue(mailbox());
    markRead.mockResolvedValue(readMessage);
    composeMessage.mockResolvedValue({ message: sentMessage, deliveries: [sentMessage] });
    replyToMessage.mockResolvedValue({ message: sentMessage, deliveries: [sentMessage] });
    archive.mockResolvedValue({ ...readMessage, folder: 'archived', status: 'ARCHIVED' });
    deleteMessage.mockResolvedValue({ ...readMessage, folder: 'trash', status: 'DELETED' });
    listRecipients.mockResolvedValue([
      { id: 'org-2', name: 'Ministry of Health', kind: 'COMPANY', country: 'TZ', capabilities: ['BUYER'] }
    ]);
    listTenderLinks.mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', reference: 'PX-2026-001', title: 'Medical supplies', buyerName: 'Ministry of Health', status: 'OPEN' }
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    store.dispatch(signOut());
  });

  it('renders the live user mailbox and marks opened unread messages as read', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /site visit schedule/i })).toBeInTheDocument();
    expect(listMailbox).toHaveBeenCalledWith(expect.objectContaining({ folder: 'inbox' }));

    await userEvent.click(screen.getByRole('button', { name: /site visit schedule/i }));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(message.id));
    expect(screen.getByText('agenda.pdf')).toBeInTheDocument();
  });

  it('reloads mailbox data for search and folder changes', async () => {
    renderPage();
    await screen.findByRole('button', { name: /site visit schedule/i });

    fireEvent.change(screen.getByPlaceholderText(/Search sender/i), { target: { value: 'site' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(listMailbox).toHaveBeenCalledWith(expect.objectContaining({ search: 'site' })));

    fireEvent.click(screen.getByRole('button', { name: /^Sent$/i }));
    await waitFor(() => expect(listMailbox).toHaveBeenCalledWith(expect.objectContaining({ folder: 'sent' })));
  });

  it('composes messages through the communication API', async () => {
    renderPage();
    await screen.findByRole('button', { name: /site visit schedule/i });

    await userEvent.click(screen.getByRole('button', { name: 'Create Message' }));
    expect(await screen.findByRole('option', { name: 'Ministry of Health' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Recipient business'), { target: { value: 'org-2' } });
    fireEvent.change(screen.getByLabelText('Tender link'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Clarification request' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please confirm the meeting location.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() =>
      expect(composeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderOrgId: 'org-1',
          recipientOrgId: 'org-2',
          tenderId: '22222222-2222-4222-8222-222222222222',
          subject: 'Clarification request'
        })
      )
    );
  });

  it('replies, archives, and deletes through the communication API', async () => {
    renderPage();
    await screen.findByRole('button', { name: /site visit schedule/i });
    await userEvent.click(screen.getByRole('button', { name: /site visit schedule/i }));

    fireEvent.change(screen.getByPlaceholderText('Write a reply'), { target: { value: 'Confirmed for Friday.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reply' }));
    await waitFor(() => expect(replyToMessage).toHaveBeenCalledWith(message.id, { body: 'Confirmed for Friday.' }));

    listMailbox.mockResolvedValue(mailbox([readMessage]));
    await userEvent.click(screen.getByRole('button', { name: /site visit schedule/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith(message.id));

    listMailbox.mockResolvedValue(mailbox([readMessage]));
    await userEvent.click(screen.getByRole('button', { name: /site visit schedule/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith(message.id));
  });
});
