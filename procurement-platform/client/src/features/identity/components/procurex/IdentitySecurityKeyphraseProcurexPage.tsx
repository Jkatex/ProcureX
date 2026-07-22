/* Renders the identity Identity Security Keyphrase ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { FormEvent, useEffect, useRef, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import { useNavigate } from 'react-router-dom';
import { identityApi } from '@/features/identity/api';
import type { KeyphraseRecoveryHistoryItem, SigningCredentialStatus } from '@/features/identity/types';
import { notificationFromApiError } from '@/shared/api/errors';
import { AccountMenu } from '@/shared/components/AccountMenu';
import { NotificationCard } from '@/shared/components/NotificationCard';
import {
  PlatformAppsButton,
  PlatformAppsDrawer,
  resolvePlatformAppRoute,
  type PlatformAppPageKey
} from '@/shared/components/procurex/PlatformAppsDrawer';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import type { CreateNotificationInput } from '@/shared/types/notifications';

type KeyphraseForm = {
  keyphrase: string;
  repeatedKeyphrase: string;
};

type ChangeForm = {
  currentKeyphrase: string;
  password: string;
  newKeyphrase: string;
  confirmKeyphrase: string;
};

const emptyCreateForm: KeyphraseForm = { keyphrase: '', repeatedKeyphrase: '' };
const emptyChangeForm: ChangeForm = { currentKeyphrase: '', password: '', newKeyphrase: '', confirmKeyphrase: '' };

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

function keyphraseReady(value: string) {
  return value.length >= 6 && value.length <= 128;
}

function securityNotification(tone: CreateNotificationInput['tone'], title: string, message: string, reason?: string): CreateNotificationInput {
  return { tone, title, message, reason, dismissible: false };
}

function historyLabel(item: KeyphraseRecoveryHistoryItem) {
  if (item.status === 'CHANGED') return 'Authenticated change';
  if (item.status === 'COMPLETED') return 'Recovered';
  return item.status.replace(/_/g, ' ').toLowerCase();
}

function shortFingerprint(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function statusTone(status: string) {
  if (status === 'COMPLETED' || status === 'CHANGED') return 'success';
  if (status.includes('FAILED') || status.includes('REVOKED')) return 'error';
  if (status.includes('VERIFIED') || status.includes('SENT')) return 'warning';
  return 'info';
}

function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <span className={`keyphrase-requirement ${met ? 'met' : ''}`}>
      {met ? <CheckCircleRoundedIcon fontSize="small" aria-hidden="true" /> : <ErrorOutlineRoundedIcon fontSize="small" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function IdentitySecurityKeyphraseProcurexPage() {
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement | null>(null);
  const [credential, setCredential] = useState<SigningCredentialStatus | null>(null);
  const [history, setHistory] = useState<KeyphraseRecoveryHistoryItem[]>([]);
  const [createForm, setCreateForm] = useState<KeyphraseForm>(emptyCreateForm);
  const [changeForm, setChangeForm] = useState<ChangeForm>(emptyChangeForm);
  const [message, setMessage] = useState<CreateNotificationInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);

  useBodyPageMetadata('identity-security-keyphrase');

  const hasCredential = Boolean(credential?.hasCredential);
  const canCreate = keyphraseReady(createForm.keyphrase) && createForm.keyphrase === createForm.repeatedKeyphrase;
  const canChange =
    hasCredential &&
    keyphraseReady(changeForm.currentKeyphrase) &&
    changeForm.password.length > 0 &&
    keyphraseReady(changeForm.newKeyphrase) &&
    changeForm.newKeyphrase === changeForm.confirmKeyphrase;

  useEffect(() => {
    function handleDocumentClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setAppsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAppsOpen(false);
    }

    document.addEventListener('pointerdown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function loadStatus() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await identityApi.getKeyphraseStatus();
      setCredential(response.credential);
      setHistory(response.recoveryHistory);
    } catch (error) {
      setMessage(notificationFromApiError(error, { title: 'Keyphrase security could not load', fallback: 'Could not load signing keyphrase status.' }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function selectPlatformApp(pageKey: PlatformAppPageKey) {
    setAppsOpen(false);
    navigate(resolvePlatformAppRoute(pageKey));
  }

  async function createKeyphrase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setMessage(securityNotification('warning', 'Keyphrase not ready', 'Enter matching keyphrases between 6 and 128 characters.'));
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const status = await identityApi.requestSignature(createForm);
      setCredential(status);
      setCreateForm(emptyCreateForm);
      setMessage(securityNotification('success', 'Signing keyphrase created', 'Your reusable ProcureX signing credential is now active.'));
      await loadStatus();
    } catch (error) {
      setMessage(notificationFromApiError(error, { title: 'Keyphrase not created', fallback: 'Could not create the signing keyphrase.' }));
    } finally {
      setSaving(false);
    }
  }

  async function changeKeyphrase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canChange) {
      setMessage(securityNotification('warning', 'Keyphrase change not ready', 'Enter your current keyphrase, account password, and matching new keyphrase.'));
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const status = await identityApi.changeKeyphrase(changeForm);
      setCredential(status);
      setChangeForm(emptyChangeForm);
      setMessage(securityNotification('success', 'Signing keyphrase changed', 'The private signing key was re-encrypted with the new keyphrase.'));
      await loadStatus();
    } catch (error) {
      setMessage(notificationFromApiError(error, { title: 'Keyphrase not changed', fallback: 'Could not change the signing keyphrase.' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="app-topbar" ref={headerRef}>
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" onClick={() => navigate('/identity/profile')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>Identity Security</span>
          </button>
        </div>
        <div className="app-topbar-actions">
          <PlatformAppsButton expanded={appsOpen} onClick={() => setAppsOpen((open) => !open)} />
          <div className="profile-menu-wrap">
            <AccountMenu buttonClassName="profile-button" />
          </div>
        </div>
        <PlatformAppsDrawer open={appsOpen} organizationLabel="ProcureX account tools" onSelect={selectPlatformApp} />
      </header>

      <div className="main-layout identity-security-layout">
        <div className="main-content">
          <main className="keyphrase-security-page">
            <section className="keyphrase-hero">
              <div className="keyphrase-hero-copy">
                <button className="keyphrase-back-button" type="button" onClick={() => navigate('/identity/profile')}>
                  <ArrowBackRoundedIcon fontSize="small" aria-hidden="true" />
                  Registration and Verification
                </button>
                <span className="section-kicker">Signing credential</span>
                <h1>Manage your signing keyphrase</h1>
                <p>The keyphrase unlocks your encrypted private signing key for formal approvals, contract signatures, and other legally meaningful actions.</p>
                <div className="keyphrase-hero-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigate('/recover-keyphrase')}>
                    <LockResetRoundedIcon fontSize="small" aria-hidden="true" />
                    Recover Forgotten Keyphrase
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => void loadStatus()} disabled={loading}>
                    Refresh Status
                  </button>
                </div>
              </div>
              <aside className={`keyphrase-status-panel ${hasCredential ? 'ready' : 'missing'}`}>
                <div className="keyphrase-status-icon">
                  {hasCredential ? <VerifiedUserRoundedIcon aria-hidden="true" /> : <SecurityRoundedIcon aria-hidden="true" />}
                </div>
                <span>{loading ? 'Checking credential' : hasCredential ? 'Ready to sign' : 'Setup required'}</span>
                <strong>{loading ? 'Loading...' : hasCredential ? credential?.status : 'No active signing key'}</strong>
                <small>{hasCredential ? shortFingerprint(credential?.keyFingerprint) : 'Create a keyphrase or recover an existing account.'}</small>
              </aside>
            </section>

            {message ? <NotificationCard notification={message} /> : null}

            <section className="keyphrase-summary-grid" aria-label="Signing credential summary">
              <article>
                <KeyRoundedIcon fontSize="small" aria-hidden="true" />
                <span>Fingerprint</span>
                <strong>{shortFingerprint(credential?.keyFingerprint)}</strong>
              </article>
              <article>
                <SecurityRoundedIcon fontSize="small" aria-hidden="true" />
                <span>Provider</span>
                <strong>{credential?.provider ?? 'Not recorded'}</strong>
              </article>
              <article>
                <HistoryRoundedIcon fontSize="small" aria-hidden="true" />
                <span>History events</span>
                <strong>{history.length}</strong>
              </article>
            </section>

            <section className="keyphrase-workspace">
              <article className="keyphrase-form-card">
                <div className="keyphrase-card-heading">
                  <div>
                    <span className="section-kicker">{hasCredential ? 'Authenticated change' : 'Setup'}</span>
                    <h2>{hasCredential ? 'Change keyphrase' : 'Create signing keyphrase'}</h2>
                    <p>{hasCredential ? 'Use your current keyphrase and account password to re-encrypt the existing signing key.' : 'Create a reusable keyphrase for your ProcureX signing credential.'}</p>
                  </div>
                  <span className={`badge ${hasCredential ? 'badge-success' : 'badge-warning'}`}>{loading ? 'Loading' : hasCredential ? 'Active' : 'Missing'}</span>
                </div>

                {loading ? (
                  <div className="keyphrase-loading-panel">Loading signing credential status...</div>
                ) : !hasCredential ? (
                  <form className="keyphrase-form" onSubmit={(event) => void createKeyphrase(event)}>
                    <label className="keyphrase-field" htmlFor="security-keyphrase">
                      <span>New keyphrase</span>
                      <input id="security-keyphrase" type="password" value={createForm.keyphrase} minLength={6} maxLength={128} autoComplete="new-password" onChange={(event) => setCreateForm((current) => ({ ...current, keyphrase: event.target.value }))} />
                    </label>
                    <label className="keyphrase-field" htmlFor="security-repeat-keyphrase">
                      <span>Repeat keyphrase</span>
                      <input id="security-repeat-keyphrase" type="password" value={createForm.repeatedKeyphrase} minLength={6} maxLength={128} autoComplete="new-password" onChange={(event) => setCreateForm((current) => ({ ...current, repeatedKeyphrase: event.target.value }))} />
                    </label>
                    <div className="keyphrase-requirements">
                      <Requirement met={keyphraseReady(createForm.keyphrase)}>6 to 128 characters</Requirement>
                      <Requirement met={Boolean(createForm.repeatedKeyphrase) && createForm.keyphrase === createForm.repeatedKeyphrase}>Keyphrases match</Requirement>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={saving || !canCreate}>
                      {saving ? 'Creating...' : 'Create Signing Keyphrase'}
                    </button>
                  </form>
                ) : (
                  <form className="keyphrase-form" onSubmit={(event) => void changeKeyphrase(event)}>
                    <div className="keyphrase-form-grid">
                      <label className="keyphrase-field" htmlFor="current-keyphrase">
                        <span>Current keyphrase</span>
                        <input id="current-keyphrase" type="password" value={changeForm.currentKeyphrase} minLength={6} maxLength={128} autoComplete="current-password" onChange={(event) => setChangeForm((current) => ({ ...current, currentKeyphrase: event.target.value }))} />
                      </label>
                      <label className="keyphrase-field" htmlFor="account-password">
                        <span>Account password</span>
                        <input id="account-password" type="password" value={changeForm.password} autoComplete="current-password" onChange={(event) => setChangeForm((current) => ({ ...current, password: event.target.value }))} />
                      </label>
                      <label className="keyphrase-field" htmlFor="new-keyphrase">
                        <span>New keyphrase</span>
                        <input id="new-keyphrase" type="password" value={changeForm.newKeyphrase} minLength={6} maxLength={128} autoComplete="new-password" onChange={(event) => setChangeForm((current) => ({ ...current, newKeyphrase: event.target.value }))} />
                      </label>
                      <label className="keyphrase-field" htmlFor="confirm-keyphrase">
                        <span>Confirm new keyphrase</span>
                        <input id="confirm-keyphrase" type="password" value={changeForm.confirmKeyphrase} minLength={6} maxLength={128} autoComplete="new-password" onChange={(event) => setChangeForm((current) => ({ ...current, confirmKeyphrase: event.target.value }))} />
                      </label>
                    </div>
                    <div className="keyphrase-requirements">
                      <Requirement met={keyphraseReady(changeForm.currentKeyphrase)}>Current keyphrase entered</Requirement>
                      <Requirement met={changeForm.password.length > 0}>Account password entered</Requirement>
                      <Requirement met={keyphraseReady(changeForm.newKeyphrase)}>New keyphrase is valid</Requirement>
                      <Requirement met={Boolean(changeForm.confirmKeyphrase) && changeForm.newKeyphrase === changeForm.confirmKeyphrase}>New keyphrases match</Requirement>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={saving || !canChange}>
                      {saving ? 'Changing...' : 'Change Keyphrase'}
                    </button>
                  </form>
                )}
              </article>

              <aside className="keyphrase-guidance-card">
                <div className="keyphrase-card-heading compact">
                  <LockResetRoundedIcon aria-hidden="true" />
                  <div>
                    <span className="section-kicker">Forgotten keyphrase</span>
                    <h2>Recovery rotates the key</h2>
                  </div>
                </div>
                <p>If you no longer know the current keyphrase, use recovery. ProcureX verifies email and phone, revokes the old active signing credential, creates a new key pair, and ends active sessions.</p>
                <div className="keyphrase-guidance-steps">
                  <span>Email code</span>
                  <span>Phone OTP</span>
                  <span>New keyphrase</span>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => navigate('/recover-keyphrase')}>
                  Start Recovery
                </button>
              </aside>
            </section>

            <section className="keyphrase-history-section">
              <div className="keyphrase-card-heading">
                <div>
                  <span className="section-kicker">Audit trail</span>
                  <h2>Recovery and change history</h2>
                </div>
              </div>
              {history.length ? (
                <div className="keyphrase-history-list">
                  {history.map((item) => (
                    <article className="keyphrase-history-item" key={item.id}>
                      <span className={`keyphrase-history-status ${statusTone(item.status)}`}>{item.status}</span>
                      <div>
                        <strong>{historyLabel(item)}</strong>
                        <span>Created {formatDate(item.createdAt)}</span>
                      </div>
                      <div>
                        <span>Completed</span>
                        <strong>{formatDate(item.completedAt)}</strong>
                      </div>
                      <div>
                        <span>New fingerprint</span>
                        <strong>{shortFingerprint(item.newKeyFingerprint)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="keyphrase-empty-history">
                  <HistoryRoundedIcon aria-hidden="true" />
                  <strong>No keyphrase events yet</strong>
                  <span>Changes and recovery completions will appear here.</span>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
