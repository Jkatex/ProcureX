import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { adminApi } from '@/features/admin/api';
import { assumeUser, signOut } from '@/features/auth/slice';
import { communicationApi } from '@/features/communication/api';
import type { CommunicationListResponse, CommunicationMailboxMessage } from '@/features/communication/types';
import { procurexTheme } from '@/styles/mui-theme';
import { AdminCommunicationProcurexPage } from './AdminCommunicationProcurexPage';

vi.mock('@/features/admin/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/api')>('@/features/admin/api');
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      apps: vi.fn(),
      updateCommunicationState: vi.fn()
    }
  };
});

vi.mock('@/features/communication/api', () => ({
  communicationApi: {
    listMailbox: vi.fn(),
    getMessage: vi.fn(),
    markRead: vi.fn(),
    composeMessage: vi.fn(),
    replyToMessage: vi.fn(),
    archive: vi.fn(),
    deleteMessage: vi.fn(),
    listRecipients: vi.fn(),
    listTenderLinks: vi.fn()
  }
}));

const apps = vi.mocked(adminApi.apps);
const listMailbox = vi.mocked(communicationApi.listMailbox);
const getMessage = vi.mocked(communicationApi.getMessage);
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
  category: 'Admin Notice',
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
  attachments: [],
  metadata: {},
  createdAt: now,
  updatedAt: now
};

const sentMessage: CommunicationMailboxMessage = {
  ...message,
  id: '33333333-3333-4333-8333-333333333333',
  folder: 'sent',
  read: true,
  status: 'READ',
  senderOrgId: 'org-1',
  senderName: 'Kilimanjaro Supplies Limited',
  recipientOrgId: 'org-2',
  recipientName: 'Ministry of Health',
  subject: 'Re: Site visit schedule',
  actionRequired: false
};

function mailbox(messages: CommunicationMailboxMessage[] = [message]): CommunicationListResponse {
  return {
    messages,
    counts: {
      total: messages.length,
      inbox: messages.filter((item) => item.folder === 'inbox').length,
      sent: messages.filter((item) => item.folder === 'sent').length,
      drafts: 0,
      archived: messages.filter((item) => item.folder === 'archived').length,
      trash: messages.filter((item) => item.folder === 'trash').length,
      unread: messages.filter((item) => !item.read).length,
      actionRequired: messages.filter((item) => item.actionRequired).length
    },
    totalMessages: messages.length,
    page: 1,
    pageSize: 30,
    totalPages: 1
  };
}

function renderPage(initialEntries = ['/admin/communication']) {
  store.dispatch(signOut());
  store.dispatch(
    assumeUser({
      id: 'admin-1',
      displayName: 'Platform Admin',
      email: 'admin@procurex.tz',
      phone: null,
      accountType: 'ADMIN',
      organization: 'ProcureX Administration',
      organizationId: 'platform',
      capabilities: ['BUYER'],
      permissions: ['admin.access'],
      verificationStatus: 'APPROVED',
      preferences: { preferredLanguage: 'en', timezone: 'Africa/Dar_es_Salaam' }
    })
  );

  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter initialEntries={initialEntries}>
          <AdminCommunicationProcurexPage />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('AdminCommunicationProcurexPage', () => {
  beforeEach(() => {
    apps.mockResolvedValue({ items: [], generatedAt: now });
    listMailbox.mockResolvedValue(mailbox());
    getMessage.mockResolvedValue(message);
    markRead.mockResolvedValue({ ...message, read: true, status: 'READ' as const });
    composeMessage.mockResolvedValue({ message: sentMessage, deliveries: [sentMessage] });
    replyToMessage.mockResolvedValue({ message: sentMessage, deliveries: [sentMessage] });
    archive.mockResolvedValue({ ...message, folder: 'archived', status: 'ARCHIVED', read: true, actionRequired: false });
    deleteMessage.mockResolvedValue({ ...message, folder: 'trash', status: 'DELETED', read: true, actionRequired: false });
    listRecipients.mockResolvedValue([
      { id: 'org-1', name: 'Kilimanjaro Supplies Limited', kind: 'COMPANY', country: 'TZ', capabilities: ['SUPPLIER'] },
      { id: 'org-2', name: 'Ministry of Health', kind: 'COMPANY', country: 'TZ', capabilities: ['BUYER'] },
      { id: 'org-3', name: 'Tanzania Ports Authority', kind: 'COMPANY', country: 'TZ', capabilities: ['BUYER'] }
    ]);
    listTenderLinks.mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', reference: 'PX-2026-001', title: 'Medical supplies', buyerName: 'Ministry of Health', status: 'OPEN' }
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    store.dispatch(signOut());
  });

  it('opens a mailbox row as a complete admin message page', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /site visit schedule/i }));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(message.id));
    expect(screen.getByRole('button', { name: 'Back to inbox' })).toBeInTheDocument();
    expect(screen.getByText('Next action')).toBeInTheDocument();
    expect(screen.getByText('Medical supplies')).toBeInTheDocument();
  });

  it('opens compose as a full page and sends an admin message', async () => {
    renderPage();
    await screen.findByRole('button', { name: /site visit schedule/i });

    await userEvent.click(screen.getByRole('button', { name: 'New Message' }));
    expect(await screen.findByRole('option', { name: /PX-2026-001/i })).toBeInTheDocument();
    expect(screen.getByLabelText('From mailbox')).toHaveValue('ProcureX Administration');
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument();
    expect(screen.queryByText('Requires action')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    const recipientSearch = screen.getByLabelText('Find recipients');
    fireEvent.change(recipientSearch, { target: { value: 'Ministry' } });
    await userEvent.click(await screen.findByRole('button', { name: /Add Ministry of Health/i }));
    expect(screen.getByRole('button', { name: /Remove Ministry of Health/i })).toBeInTheDocument();
    expect(screen.queryByText('BUYER')).not.toBeInTheDocument();
    expect(screen.queryByText('SUPPLIER')).not.toBeInTheDocument();
    fireEvent.change(recipientSearch, { target: { value: 'Tanzania' } });
    await userEvent.click(await screen.findByRole('button', { name: /Add Tanzania Ports Authority/i }));
    expect(screen.getByRole('button', { name: /Remove Tanzania Ports Authority/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tender link'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Clarification follow-up' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please confirm the updated site visit time.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => expect(composeMessage).toHaveBeenCalledTimes(2));
    expect(composeMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        senderOrgId: 'platform',
        recipientOrgId: 'org-2',
        tenderId: '22222222-2222-4222-8222-222222222222',
        subject: 'Clarification follow-up'
      })
    );
    expect(composeMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        senderOrgId: 'platform',
        recipientOrgId: 'org-3',
        tenderId: '22222222-2222-4222-8222-222222222222',
        subject: 'Clarification follow-up'
      })
    );
    expect(composeMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        priority: expect.anything(),
        actionRequired: expect.anything()
      })
    );
  });

  it('replies from the full message page', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /site visit schedule/i }));

    fireEvent.change(screen.getByPlaceholderText('Write a reply'), { target: { value: 'Confirmed for Friday.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reply' }));
    await waitFor(() => expect(replyToMessage).toHaveBeenCalledWith(message.id, { body: 'Confirmed for Friday.' }));
  });

  it('archives from the full message page', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /site visit schedule/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith(message.id));
  });

  it('moves messages to trash from the full message page', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /site visit schedule/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith(message.id));
  });
});
