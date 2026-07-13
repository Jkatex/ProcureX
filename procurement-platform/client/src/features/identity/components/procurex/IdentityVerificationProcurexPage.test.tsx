import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import { identityApi } from '@/features/identity/api';
import type { SigningCredentialStatus } from '@/features/identity/types';
import { demoUsers } from '@/shared/data/fixtures';
import { IdentityVerificationProcurexPage } from './IdentityVerificationProcurexPage';

vi.mock('@/features/identity/api', () => ({
  identityApi: {
    getVerificationMe: vi.fn(),
    getSignatureStatus: vi.fn(),
    lookupRegistry: vi.fn(),
    saveVerificationDraft: vi.fn(),
    submitVerification: vi.fn(),
    requestSignature: vi.fn(),
    testSignature: vi.fn(),
    revokeSignature: vi.fn()
  }
}));

vi.mock('@/features/notifications/hooks', () => ({
  useNotifications: () => ({
    notifySuccess: vi.fn()
  })
}));

const mockedIdentityApi = vi.mocked(identityApi);

const registryRecord = {
  id: 'registry-1',
  source: 'TRA',
  registryNumber: '100-200-300',
  entityType: 'individual',
  name: 'Demo User',
  status: 'MATCHED',
  confidence: 98,
  payload: {
    taxpayerName: 'Demo User'
  }
};

const testLocation = {
  region: 'Dar es Salaam',
  district: 'Ilala',
  ward: 'Kariakoo'
};

const inactiveSignatureStatus: SigningCredentialStatus = {
  hasCredential: false,
  status: 'NONE',
  keyFingerprint: null,
  createdAt: null,
  revokedAt: null,
  provider: null
};

const activeSignatureStatus: SigningCredentialStatus = {
  hasCredential: true,
  status: 'ACTIVE',
  keyFingerprint: 'PX-SIGN-123456',
  createdAt: '2026-06-18T00:00:00.000Z',
  revokedAt: null,
  provider: 'procurex-keyphrase-ed25519-v1'
};

function verificationMe() {
  return {
    user: demoUsers.user,
    verification: {
      id: 'verification-1',
      status: 'DRAFT' as const,
      registrySource: 'TRA',
      registryNumber: registryRecord.registryNumber,
      payload: {
        entityType: 'individual',
        businessRegistrationSource: 'tin',
        registryNumber: registryRecord.registryNumber,
        registryVerified: true,
        registryRecord,
        location: testLocation,
        signatureName: registryRecord.name,
        signatureTitle: 'Owner',
        signatureConsent: false
      },
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z'
    }
  };
}

function renderPage(signatureStatus = inactiveSignatureStatus) {
  mockedIdentityApi.getVerificationMe.mockResolvedValue(verificationMe());
  mockedIdentityApi.getSignatureStatus.mockResolvedValue(signatureStatus);
  mockedIdentityApi.saveVerificationDraft.mockResolvedValue(verificationMe().verification);
  mockedIdentityApi.requestSignature.mockResolvedValue(activeSignatureStatus);
  mockedIdentityApi.testSignature.mockResolvedValue({
    ok: true,
    canonicalPayloadHash: 'a'.repeat(64),
    signatureHash: 'b'.repeat(64)
  });
  mockedIdentityApi.revokeSignature.mockResolvedValue(inactiveSignatureStatus);
  mockedIdentityApi.submitVerification.mockResolvedValue({
    user: { ...demoUsers.user, verificationStatus: 'APPROVED' },
    verification: verificationMe().verification,
    autoApproved: true,
    reviewReasons: []
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <IdentityVerificationProcurexPage />
      </MemoryRouter>
    </Provider>
  );
}

async function openStep3() {
  const user = userEvent.setup();
  await screen.findByText('Select applicant type');
  await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
  await screen.findByText('Enter TIN number');
  await user.click(screen.getAllByRole('button', { name: 'Continue' })[1]);
  await screen.findByText('Create digital signature');
  return user;
}

describe('IdentityVerificationProcurexPage signature step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.dispatch(signOut());
  });

  it('keeps signature creation disabled until both keyphrases match and meet length rules', async () => {
    renderPage();
    const user = await openStep3();

    const createButton = screen.getByRole('button', { name: 'Create signature' });
    expect(createButton).toBeDisabled();

    await user.type(screen.getByLabelText('Keyphrase *'), 'Signing123');
    await user.type(screen.getByLabelText('Repeat keyphrase *'), 'Different123');

    expect(screen.getByText('Keyphrase and repeated keyphrase do not match.')).toBeInTheDocument();
    expect(createButton).toBeDisabled();

    await user.clear(screen.getByLabelText('Repeat keyphrase *'));
    await user.type(screen.getByLabelText('Repeat keyphrase *'), 'Signing123');

    expect(screen.getByText('Keyphrases match.')).toBeInTheDocument();
    expect(createButton).toBeEnabled();

    await user.click(createButton);

    await waitFor(() => expect(mockedIdentityApi.requestSignature).toHaveBeenCalledWith({ keyphrase: 'Signing123', repeatedKeyphrase: 'Signing123' }));
    expect(screen.getByLabelText('Signing keyphrase *')).toHaveValue('Signing123');
  }, 10000);

  it('requires a verified signing keyphrase before submit can run', async () => {
    renderPage(activeSignatureStatus);
    const user = await openStep3();

    mockedIdentityApi.testSignature.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Invalid keyphrase.' } }, message: 'Invalid keyphrase.' });

    const signingInput = screen.getByLabelText('Signing keyphrase *');
    await user.type(signingInput, 'Wrong123');
    await user.click(screen.getByRole('button', { name: 'Verify keyphrase' }));

    expect(await screen.findByText('This keyphrase does not match the active signature. Try again or reset it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit verification' })).toBeDisabled();

    await user.clear(signingInput);
    await user.type(signingInput, 'Signing123');
    await user.click(screen.getByRole('button', { name: 'Verify keyphrase' }));
    await screen.findByText('Keyphrase verified. You can submit after consent is confirmed.');

    await user.click(screen.getByLabelText(/Confirm digital signature consent/));
    expect(screen.getByRole('button', { name: 'Submit verification' })).toBeEnabled();
  });

  it('pre-fills the Tanzania location selector from the verification payload', async () => {
    renderPage(activeSignatureStatus);
    await openStep3();

    expect(screen.getByLabelText('Region *')).toHaveValue(testLocation.region);
    expect(screen.getByLabelText('District *')).toHaveValue(testLocation.district);
    expect(screen.getByLabelText('Ward/shehia *')).toHaveValue(testLocation.ward);
  });

  it('routes forgotten keyphrase management to Identity Security', async () => {
    renderPage(activeSignatureStatus);
    const user = await openStep3();

    await user.click(screen.getByRole('button', { name: 'Manage or recover keyphrase' }));

    expect(mockedIdentityApi.revokeSignature).not.toHaveBeenCalled();
  });
});
