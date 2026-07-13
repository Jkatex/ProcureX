import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import { identityApi } from '@/features/identity/api';
import { apiClient } from '@/shared/api/http';
import { demoUsers } from '@/shared/data/fixtures';
import { AccountProfileProcurexPage } from './AccountProfileProcurexPage';

vi.mock('@/features/identity/api', () => ({
  identityApi: {
    getVerificationMe: vi.fn(),
    updateProfile: vi.fn()
  }
}));

vi.mock('@/shared/api/http', () => ({
  apiClient: {
    get: vi.fn()
  }
}));

vi.mock('@/features/notifications/hooks', () => ({
  useNotifications: () => ({
    notifySuccess: vi.fn()
  })
}));

vi.mock('@/shared/components/AccountMenu', () => ({
  AccountMenu: () => <button type="button">Account menu</button>
}));

vi.mock('@/shared/components/procurex/PlatformAppsDrawer', () => ({
  PlatformAppsButton: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      Apps
    </button>
  ),
  PlatformAppsDrawer: () => null,
  resolvePlatformAppRoute: () => '/apps'
}));

const mockedIdentityApi = vi.mocked(identityApi);
const mockedApiGet = vi.mocked(apiClient.get);

const verificationProfile = {
  id: 'verification-1',
  status: 'DRAFT' as const,
  registrySource: 'TRA',
  registryNumber: '100-200-300',
  payload: {
    entityType: 'business',
    registryRecord: {
      name: 'Legacy Supplier Limited'
    },
    profile: {
      fullName: 'Legacy Supplier',
      emailAddress: 'supplier@example.test',
      phoneNumber: '+255700000001',
      country: 'Tanzania',
      displayName: 'Legacy Supplier Limited',
      companyName: 'Legacy Supplier Limited',
      tinNumber: '100-200-300',
      businessCategory: 'Medical Supplies',
      preferredTenderCategories: ['ICT Equipment'],
      regionsOfOperation: ['Nationwide']
    },
    documents: []
  },
  createdAt: '2026-06-18T00:00:00.000Z',
  updatedAt: '2026-06-18T00:00:00.000Z'
};

function renderPage() {
  mockedIdentityApi.getVerificationMe.mockResolvedValue({
    user: demoUsers.user,
    verification: verificationProfile
  });
  mockedIdentityApi.updateProfile.mockResolvedValue(verificationProfile);
  mockedApiGet.mockResolvedValue({
    data: {
      data: {
        categories: [
          { label: 'Medical Equipment', isActive: true },
          { label: 'ICT Equipment', isActive: true },
          { label: 'Construction Works', isActive: true }
        ]
      }
    }
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <AccountProfileProcurexPage />
      </MemoryRouter>
    </Provider>
  );
}

async function openTab(name: string) {
  renderPage();
  const user = userEvent.setup();
  await screen.findByRole('button', { name });
  await user.click(screen.getByRole('button', { name }));
  return user;
}

describe('AccountProfileProcurexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.dispatch(signOut());
  });

  it('removes the old role, preferred category, settings, and system controls', async () => {
    renderPage();

    await screen.findByText('Account Profile Workspace');

    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'System' })).not.toBeInTheDocument();
    expect(screen.queryByText('Procurement Role *')).not.toBeInTheDocument();
    expect(screen.queryByText('Preferred Tender Categories')).not.toBeInTheDocument();
  });

  it('migrates legacy categories into the new searchable selector and saves without duplicates', async () => {
    const user = await openTab('Classification');

    expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
    expect(screen.getByText('ICT Equipment')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search Business Categories *'), 'medical');
    await user.click(await screen.findByRole('option', { name: 'Medical Equipment' }));
    await user.type(screen.getByLabelText('Search Business Categories *'), 'medical');
    expect(screen.queryByRole('option', { name: 'Medical Equipment' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Medical Supplies' }));
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(mockedIdentityApi.updateProfile).toHaveBeenCalled());
    const payload = mockedIdentityApi.updateProfile.mock.calls[0][0];
    expect(payload.profile).toEqual(expect.objectContaining({
      businessCategories: ['ICT Equipment', 'Medical Equipment'],
      regionsOfOperation: ['Nationwide']
    }));
    expect(payload.profile).not.toHaveProperty('businessCategory');
    expect(payload.profile).not.toHaveProperty('preferredTenderCategories');
    expect(payload.profile).not.toHaveProperty('procurementRole');
    expect(payload.profile).not.toHaveProperty('canCreateTender');
  }, 10000);

  it('uses the searchable selector for regions of operation', async () => {
    const user = await openTab('Classification');

    await user.type(screen.getByLabelText('Search Regions of Operation'), 'Arusha');
    const regionList = screen.getByRole('listbox', { name: 'Regions of Operation' });
    await user.click(within(regionList).getByRole('option', { name: 'Arusha' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Arusha' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Remove Nationwide' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Nationwide' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(mockedIdentityApi.updateProfile).toHaveBeenCalled());
    const payload = mockedIdentityApi.updateProfile.mock.calls[0][0];
    expect(payload.profile).toEqual(expect.objectContaining({
      regionsOfOperation: ['Arusha']
    }));
  }, 10000);

  it('adds, uploads, removes, and saves dynamic document metadata', async () => {
    const user = await openTab('Documents');

    expect(screen.getByText('No documents added yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Document' }));
    await user.selectOptions(screen.getByLabelText('Document name 1'), 'Tax Clearance Certificate');
    await user.upload(screen.getByLabelText('Upload document 1'), new File(['tax'], 'tax-clearance.pdf', { type: 'application/pdf' }));
    expect(screen.getByText('tax-clearance.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Document' }));
    await user.selectOptions(screen.getByLabelText('Document name 2'), 'Identity Document');
    await user.click(screen.getByRole('button', { name: 'Remove document 2' }));

    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(mockedIdentityApi.updateProfile).toHaveBeenCalled());
    const payload = mockedIdentityApi.updateProfile.mock.calls[0][0];
    expect(payload.documents).toEqual([
      {
        type: 'TAX_CLEARANCE_CERTIFICATE',
        name: 'Tax Clearance Certificate',
        fileName: 'tax-clearance.pdf',
        status: 'captured',
        source: 'profile'
      }
    ]);
  });
});
