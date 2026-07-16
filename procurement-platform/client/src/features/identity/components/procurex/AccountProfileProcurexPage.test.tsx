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
    updateProfile: vi.fn(),
    startProfileContactChange: vi.fn(),
    verifyProfileContactChange: vi.fn(),
    uploadProfileImage: vi.fn(),
    getProfileImageBlob: vi.fn(),
    deleteProfileImage: vi.fn()
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

const profileImage = {
  objectKey: 'profile-images/user/logo.png',
  fileName: 'logo.png',
  mimeType: 'image/png',
  size: 8,
  checksum: 'image-checksum',
  uploadedAt: '2026-06-18T00:00:00.000Z',
  imageRole: 'logo'
};

function renderPage(profile = verificationProfile) {
  mockedIdentityApi.getVerificationMe.mockResolvedValue({
    user: demoUsers.user,
    verification: profile
  });
  mockedIdentityApi.updateProfile.mockResolvedValue(profile);
  mockedIdentityApi.startProfileContactChange.mockResolvedValue({
    challengeId: '11111111-1111-4111-8111-111111111111',
    field: 'email',
    target: 'updated@example.test',
    expiresAt: '2026-06-18T00:10:00.000Z',
    resendAvailableAt: '2026-06-18T00:00:30.000Z',
    maxAttempts: 5,
    devCode: '123456'
  });
  mockedIdentityApi.verifyProfileContactChange.mockResolvedValue({
    user: {
      ...demoUsers.user,
      email: 'updated@example.test'
    },
    verification: {
      ...profile,
      payload: {
        ...profile.payload,
        profile: {
          ...profile.payload.profile,
          emailAddress: 'updated@example.test'
        }
      }
    }
  });
  mockedIdentityApi.uploadProfileImage.mockResolvedValue({ profile, profileImage });
  mockedIdentityApi.getProfileImageBlob.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  mockedIdentityApi.deleteProfileImage.mockResolvedValue({ profile, profileImage: null });
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

async function openTabWithProfile(name: string, profile: typeof verificationProfile) {
  renderPage(profile);
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
    expect(payload.profile).not.toHaveProperty('emailAddress');
    expect(payload.profile).not.toHaveProperty('phoneNumber');
    expect(payload.profile).not.toHaveProperty('displayName');
  }, 10000);

  it('shows the default avatar in account information when no image is uploaded', async () => {
    const user = await openTab('Account');

    expect(screen.getByText('Default person avatar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit account image' }));
    expect(screen.getByRole('menuitem', { name: 'Add image' })).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Logo or profile image'), new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' }));

    await waitFor(() => expect(mockedIdentityApi.uploadProfileImage).toHaveBeenCalled());
    expect(screen.getByText('Image saved.')).toBeInTheDocument();
  });

  it('shows email and phone as verified edit rows in account information', async () => {
    await openTab('Account');

    expect(screen.getByText('supplier@example.test')).toBeInTheDocument();
    expect(screen.getByText('+255700000001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Email Address' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Phone Number' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('supplier@example.test')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('+255700000001')).not.toBeInTheDocument();
  });

  it('verifies a new email address before updating the account row', async () => {
    const user = await openTab('Account');
    mockedIdentityApi.startProfileContactChange.mockImplementation(async (input) => ({
      challengeId: '11111111-1111-4111-8111-111111111111',
      field: input.field,
      target: input.value,
      expiresAt: '2026-06-18T00:10:00.000Z',
      resendAvailableAt: '2026-06-18T00:00:30.000Z',
      maxAttempts: 5,
      devCode: '123456'
    }));
    mockedIdentityApi.verifyProfileContactChange.mockResolvedValue({
      user: {
        ...demoUsers.user,
        email: 'verified-new@example.test'
      },
      verification: {
        ...verificationProfile,
        payload: {
          ...verificationProfile.payload,
          profile: {
            ...verificationProfile.payload.profile,
            emailAddress: 'verified-new@example.test'
          }
        }
      }
    });

    await user.click(screen.getByRole('button', { name: 'Edit Email Address' }));
    await user.clear(screen.getByLabelText('New Email Address'));
    await user.type(screen.getByLabelText('New Email Address'), 'verified-new@example.test');
    await user.click(screen.getByRole('button', { name: 'Send Code' }));

    await waitFor(() =>
      expect(mockedIdentityApi.startProfileContactChange).toHaveBeenCalledWith({
        field: 'email',
        value: 'verified-new@example.test'
      })
    );
    expect(await screen.findByText('Temporary local code: 123456')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Verification Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and Update' }));

    await waitFor(() =>
      expect(mockedIdentityApi.verifyProfileContactChange).toHaveBeenCalledWith({
        challengeId: '11111111-1111-4111-8111-111111111111',
        code: '123456'
      })
    );
    expect(await screen.findByText('verified-new@example.test')).toBeInTheDocument();
  });

  it('loads uploaded image metadata and can remove the image from the account section', async () => {
    const profileWithImage = {
      ...verificationProfile,
      payload: {
        ...verificationProfile.payload,
        profile: {
          ...verificationProfile.payload.profile,
          profileImage
        }
      }
    };
    const user = await openTabWithProfile('Account', profileWithImage);

    expect(await screen.findByText('Image added')).toBeInTheDocument();
    expect(screen.queryByText('logo.png')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit account image' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove image' }));

    await waitFor(() => expect(mockedIdentityApi.deleteProfileImage).toHaveBeenCalled());
    expect(screen.getByText('Image removed.')).toBeInTheDocument();
  });

  it('locks legal name edits on the user side', async () => {
    await openTab('Entity');

    expect(screen.getByLabelText('Display / Legal Name *')).toBeDisabled();
    expect(screen.getByText('Legal name changes require identity verification or admin review.')).toBeInTheDocument();
  });

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
