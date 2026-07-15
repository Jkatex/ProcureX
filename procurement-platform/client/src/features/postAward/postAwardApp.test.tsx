import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import '@/i18n';
import { PostAwardAppPage } from './pages/PostAwardAppPage';
import { postAwardApi } from './api';
import type { PostAwardWorkspace } from './types';

vi.mock('./api', () => ({
  postAwardApi: {
    contracts: vi.fn(),
    workspace: vi.fn(),
    uploadDocument: vi.fn(),
    upsertManagementPlan: vi.fn(),
    createDeliverable: vi.fn(),
    addMilestoneEvidence: vi.fn(),
    createInspection: vi.fn(),
    createAcceptance: vi.fn(),
    createInvoice: vi.fn(),
    updateInvoiceStatus: vi.fn(),
    createPayment: vi.fn(),
    createIssue: vi.fn(),
    createVariation: vi.fn(),
    upsertCloseout: vi.fn()
  }
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPostAward(initialEntry = '/post-award') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PostAwardAppPage />
        <LocationProbe />
      </MemoryRouter>
    </Provider>
  );
}

const contractRow = {
  id: 'contract-1',
  reference: 'PX-C-001',
  title: 'Clinic delivery contract',
  status: 'ACTIVE',
  buyerName: 'Arusha City Council',
  supplierName: 'Moshi Medical Supplies',
  viewerRole: 'SUPPLIER' as const,
  amount: 1200000,
  currency: 'TZS',
  stage: 'Active',
  nextAction: 'Submit delivery evidence',
  dueDate: '2026-07-30T00:00:00.000Z',
  riskLevel: 'Low'
};

function workspace(overrides: Partial<PostAwardWorkspace> = {}): PostAwardWorkspace {
  return {
    contract: {
      ...contractRow,
      tenderId: 'tender-1',
      tenderReference: 'TDR-001',
      access: {
        viewerRole: 'SUPPLIER',
        canSubmitSupplierActions: true,
        canManageBuyerActions: false,
        readOnlyReason: null
      }
    },
    metrics: [
      { label: 'Milestones', value: 1, tone: 'info' },
      { label: 'Open issues', value: 0, tone: 'success' },
      { label: 'Invoices', value: 0, tone: 'info' },
      { label: 'Accepted', value: 0, tone: 'success' }
    ],
    stages: [
      { id: 'setup', label: 'CMP / Setup', description: 'Setup', count: 0, records: [] },
      {
        id: 'delivery',
        label: 'Delivery',
        description: 'Milestones, deliverables, and supplier evidence.',
        count: 1,
        records: [{ id: 'milestone-1', type: 'milestone', title: 'First delivery', status: 'OPEN', dueDate: '2026-07-30T00:00:00.000Z' }]
      },
      { id: 'acceptance', label: 'Inspections / Acceptance', description: 'Acceptance', count: 0, records: [] },
      { id: 'finance', label: 'Finance', description: 'Finance', count: 0, records: [] },
      { id: 'issues', label: 'Issues', description: 'Issues', count: 0, records: [] },
      { id: 'variations', label: 'Variations', description: 'Variations', count: 0, records: [] },
      { id: 'closeout', label: 'Close-out', description: 'Close-out', count: 0, records: [] },
      { id: 'history', label: 'History', description: 'History', count: 0, records: [] }
    ],
    secondary: [
      { id: 'termination', label: 'Termination', count: 0, records: [] },
      { id: 'documents', label: 'Documents / Warranty', count: 0, records: [] },
      { id: 'performance', label: 'Supplier Performance', count: 0, records: [] },
      { id: 'securities', label: 'Securities', count: 0, records: [] },
      { id: 'audit', label: 'Audit', count: 0, records: [] }
    ],
    actions: [
      { key: 'deliverable', label: 'Submit deliverable', stage: 'delivery', owner: 'SUPPLIER', priority: 'Medium', enabled: true, reason: null },
      { key: 'evidence', label: 'Upload milestone evidence', stage: 'delivery', owner: 'SUPPLIER', priority: 'High', enabled: true, reason: null },
      { key: 'inspection', label: 'Record inspection', stage: 'acceptance', owner: 'BUYER', priority: 'High', enabled: false, reason: 'Buyer action' },
      { key: 'payment', label: 'Record payment review', stage: 'finance', owner: 'BUYER', priority: 'Medium', enabled: false, reason: 'Buyer action' }
    ],
    ...overrides
  };
}

describe('PostAwardAppPage', () => {
  beforeEach(() => {
    vi.mocked(postAwardApi.contracts).mockResolvedValue([contractRow]);
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createDeliverable).mockImplementation(async (_contractId, payload) =>
      workspace({
        stages: workspace().stages.map((stage) =>
          stage.id === 'delivery'
            ? { ...stage, count: 2, records: [...stage.records, { id: 'deliverable-1', type: 'deliverable', title: String(payload.title), status: 'SUBMITTED', note: String(payload.note ?? '') }] }
            : stage
        )
      })
    );
  });

  it('opens the standalone contract-first workspace at /post-award', async () => {
    renderPostAward();

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/post-award?contract=contract-1&stage=delivery'));
    expect(await screen.findByRole('heading', { name: 'Clinic delivery contract' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Post-award stages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit deliverable/i })).toBeEnabled();
    expect(screen.getByText('Secondary tools and registers')).toBeInTheDocument();
  });

  it('lets a supplier submit a deliverable inline and refreshes the delivery register', async () => {
    const user = userEvent.setup();
    renderPostAward('/post-award?contract=contract-1&stage=delivery');

    await user.click(await screen.findByRole('button', { name: /Submit deliverable/i }));
    const form = screen.getByRole('heading', { name: 'Deliverable' }).closest('form') as HTMLFormElement;
    await user.type(within(form).getByLabelText('Deliverable title'), 'Batch one delivery note');
    await user.selectOptions(within(form).getByLabelText('Milestone'), 'milestone-1');
    await user.type(within(form).getByLabelText('Supplier note'), 'Evidence attached for batch one.');
    await user.click(within(form).getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.createDeliverable).toHaveBeenCalledWith('contract-1', expect.objectContaining({ title: 'Batch one delivery note', milestoneId: 'milestone-1' })));
    expect(await screen.findByText('Batch one delivery note')).toBeInTheDocument();
  });
});
