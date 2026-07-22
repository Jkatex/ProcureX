/* Exercises admin behavior so regressions are caught close to the domain workflow they protect. */
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
import { procurementApi } from '@/features/procurement/api';
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
    getAttachment: vi.fn(),
    listRecipients: vi.fn(),
    listTenderLinks: vi.fn()
  }
}));

vi.mock('@/features/procurement/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/procurement/api')>('@/features/procurement/api');
  return {
    ...actual,
    procurementApi: {
      ...actual.procurementApi,
      failTenderReview: vi.fn()
    }
  };
});

const apps = vi.mocked(adminApi.apps);
const listMailbox = vi.mocked(communicationApi.listMailbox);
const getMessage = vi.mocked(communicationApi.getMessage);
const markRead = vi.mocked(communicationApi.markRead);
const composeMessage = vi.mocked(communicationApi.composeMessage);
const replyToMessage = vi.mocked(communicationApi.replyToMessage);
const getAttachment = vi.mocked(communicationApi.getAttachment);
const listRecipients = vi.mocked(communicationApi.listRecipients);
const listTenderLinks = vi.mocked(communicationApi.listTenderLinks);
const failTenderReview = vi.mocked(procurementApi.failTenderReview);

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
  attachments: [
    {
      id: 'attachment-1',
      documentId: 'document-1',
      name: 'admin-agenda.pdf',
      documentType: 'PDF',
      objectKey: 'documents/admin-agenda.pdf',
      checksum: null,
      createdAt: now
    }
  ],
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
    getAttachment.mockResolvedValue(new Blob(['agenda'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:attachment')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => ({}))
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    failTenderReview.mockResolvedValue({
      success: true,
      message: 'Tender review failed. The tender has been returned to draft for amendments.',
      data: {
        tenderId: '22222222-2222-4222-8222-222222222222',
        reference: 'PX-2026-001',
        title: 'Medical supplies',
        status: 'Draft',
        visibility: 'PRIVATE',
        publishedAt: '',
        communicationMessageId: '66666666-6666-4666-8666-666666666666',
        amendmentRoute: '/procurement/create-tender?tenderId=22222222-2222-4222-8222-222222222222'
      }
    });
    listRecipients.mockResolvedValue([
      { id: 'org-1', name: 'Kilimanjaro Supplies Limited', kind: 'COMPANY', country: 'TZ', capabilities: ['SUPPLIER'] },
      { id: 'org-2', name: 'Ministry of Health', kind: 'COMPANY', country: 'TZ', capabilities: ['BUYER'] },
      { id: 'org-3', name: 'Tanzania Ports Authority', kind: 'COMPANY', country: 'TZ', capabilities: ['BUYER'] }
    ]);
    listTenderLinks.mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', reference: 'PX-2026-001', title: 'Medical supplies', buyerName: 'Ministry of Health', status: 'OPEN' },
      { id: '33333333-3333-4333-8333-333333333333', reference: 'PX-2026-002', title: 'Road maintenance', buyerName: 'Tanzania Ports Authority', status: 'OPEN' }
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
    expect(screen.queryByText('Message context')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Notice')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(screen.getByText('Next action')).toBeInTheDocument();
    expect(screen.getByText('Please confirm whether the site visit is still available on Friday.')).toBeInTheDocument();
  });

  it('opens and downloads attachments from the admin message page', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /site visit schedule/i }));

    expect(screen.getByText('admin-agenda.pdf')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(getAttachment).toHaveBeenCalledWith(message.id, 'attachment-1', 'open'));
    expect(window.open).toHaveBeenCalledWith('blob:attachment', '_blank', 'noopener,noreferrer');

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(getAttachment).toHaveBeenCalledWith(message.id, 'attachment-1', 'download'));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
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
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeDisabled();
    fireEvent.change(recipientSearch, { target: { value: 'Ministry' } });
    await userEvent.click(await screen.findByRole('button', { name: /^Ministry of Health$/i }));
    expect(screen.getByRole('button', { name: /Remove Ministry of Health/i })).toBeInTheDocument();
    expect(screen.queryByText('BUYER')).not.toBeInTheDocument();
    expect(screen.queryByText('SUPPLIER')).not.toBeInTheDocument();
    fireEvent.change(recipientSearch, { target: { value: 'Tanzania' } });
    await userEvent.click(await screen.findByRole('button', { name: /^Tanzania Ports Authority$/i }));
    expect(screen.getByRole('button', { name: /Remove Tanzania Ports Authority/i })).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText('Add files'), [
      new File(['report'], 'admin-report.pdf', { type: 'application/pdf' }),
      new File(['sheet'], 'supplier-list.xlsx')
    ]);
    expect(screen.getByText('admin-report.pdf')).toBeInTheDocument();
    expect(screen.getByText('supplier-list.xlsx')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Ready')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Tender reference'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    expect(screen.getByLabelText('Tender title')).toHaveDisplayValue('Medical supplies');
    fireEvent.change(screen.getByLabelText('Tender title'), { target: { value: '33333333-3333-4333-8333-333333333333' } });
    expect(screen.getByLabelText('Tender reference')).toHaveDisplayValue('PX-2026-002');
    fireEvent.change(screen.getByLabelText('Tender reference'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    expect(screen.getByLabelText('Tender title')).toHaveDisplayValue('Medical supplies');
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Clarification follow-up' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please confirm the updated site visit time.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Message' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => expect(composeMessage).toHaveBeenCalledTimes(2));
    expect(composeMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        senderOrgId: 'platform',
        recipientOrgId: 'org-2',
        tenderId: '22222222-2222-4222-8222-222222222222',
        subject: 'Clarification follow-up',
        attachmentUploads: expect.arrayContaining([
          expect.objectContaining({ name: 'admin-report.pdf', mimeType: 'application/pdf' }),
          expect.objectContaining({ name: 'supplier-list.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        ])
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

  it('sends a failed-review message before removing the tender from review', async () => {
    const ownerDelivery: CommunicationMailboxMessage = {
      ...sentMessage,
      id: '66666666-6666-4666-8666-666666666666',
      folder: 'inbox',
      ownerOrgId: 'org-2',
      senderOrgId: 'platform',
      senderName: 'ProcureX Administration',
      recipientOrgId: 'org-2',
      recipientName: 'Ministry of Health',
      tenderId: '22222222-2222-4222-8222-222222222222'
    };
    composeMessage.mockResolvedValueOnce({ message: sentMessage, deliveries: [sentMessage, ownerDelivery] });
    renderPage([
      '/admin/communication?view=compose&reviewDecision=fail&reviewTenderId=22222222-2222-4222-8222-222222222222&tenderId=22222222-2222-4222-8222-222222222222&tenderReference=PX-2026-001&tenderTitle=Medical+supplies&recipientOrgId=org-2&recipientName=Ministry+of+Health&category=Tender+Review&subject=Your+tender+has+failed+review&actionLabel=Amend+Tender&actionRoute=%2Fprocurement%2Fcreate-tender%3FtenderId%3D22222222-2222-4222-8222-222222222222'
    ]);

    expect(await screen.findByLabelText('Subject')).toHaveValue('Your tender has failed review');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please attach the missing delivery schedule and update the budget summary.' } });
    fireEvent.change(screen.getByLabelText('Signature keyphrase'), { target: { value: 'review-keyphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => expect(composeMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(failTenderReview).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      { messageId: '66666666-6666-4666-8666-666666666666', signatureKeyphrase: 'review-keyphrase' }
    ));
    expect(composeMessage.mock.invocationCallOrder[0]).toBeLessThan(failTenderReview.mock.invocationCallOrder[0]);
    expect(composeMessage).toHaveBeenCalledWith(expect.objectContaining({
      recipientOrgId: 'org-2',
      tenderId: '22222222-2222-4222-8222-222222222222',
      subject: 'Your tender has failed review',
      metadata: expect.objectContaining({
        reviewDecision: 'fail',
        actionLabel: 'Amend Tender',
        actionRoute: '/procurement/create-tender?tenderId=22222222-2222-4222-8222-222222222222'
      })
    }));
  });

  it('replies from the full message page', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /site visit schedule/i }));

    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(await screen.findByLabelText('Subject')).toHaveValue('Re: Site visit schedule');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Confirmed for Friday.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reply' }));
    await waitFor(() => expect(replyToMessage).toHaveBeenCalledWith(
      message.id,
      expect.objectContaining({
        body: 'Confirmed for Friday.',
        recipientOrgId: 'org-2',
        subject: 'Re: Site visit schedule'
      })
    ));
  });

});
