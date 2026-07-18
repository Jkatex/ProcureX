import { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '@/app/store';
import { adminApi } from '@/features/admin/api';
import { identityApi } from '@/features/identity/api';
import type { KeyphraseRecoveryHistoryItem, SigningCredentialStatus, VerificationMe } from '@/features/identity/types';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminCommandDrawer, AdminError, AdminHero, AdminShell } from './AdminShared';
import { badgeClass, displayLabel, formatDate, useAdminCommand } from './AdminSharedUtils';

type AdminProfileTab = 'overview' | 'account' | 'entity' | 'classification' | 'documents' | 'settings' | 'system';

const tabs: Array<{ key: AdminProfileTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'account', label: 'Account' },
  { key: 'entity', label: 'Entity' },
  { key: 'classification', label: 'Classification' },
  { key: 'documents', label: 'Documents' },
  { key: 'settings', label: 'Settings' },
  { key: 'system', label: 'System' }
];

function valueFromPayload(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value : 'Not recorded';
}

export function AdminProfileProcurexPage() {
  const sessionUser = useAppSelector((state) => state.auth.user);
  const [verificationMe, setVerificationMe] = useState<VerificationMe | null>(null);
  const [signature, setSignature] = useState<SigningCredentialStatus | null>(null);
  const [keyphraseRecoveryHistory, setKeyphraseRecoveryHistory] = useState<KeyphraseRecoveryHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<AdminProfileTab>('overview');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Africa/Dar_es_Salaam');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const { command, openCommand, closeCommand } = useAdminCommand();

  useBodyPageMetadata('admin-profile');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [verificationResponse, signatureResponse] = await Promise.all([
        identityApi.getVerificationMe(),
        identityApi.getSignatureStatus()
      ]);
      setVerificationMe(verificationResponse);
      setSignature(signatureResponse);
      try {
        const recoveryResponse = await identityApi.getAdminKeyphraseRecoveryHistory();
        setKeyphraseRecoveryHistory(recoveryResponse.recoveries);
      } catch {
        setKeyphraseRecoveryHistory([]);
      }
      setLanguage(verificationResponse.user?.preferences?.preferredLanguage ?? sessionUser?.preferences?.preferredLanguage ?? 'en');
      setTimezone(verificationResponse.user?.preferences?.timezone ?? sessionUser?.preferences?.timezone ?? 'Africa/Dar_es_Salaam');
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [sessionUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const user = verificationMe?.user ?? sessionUser;
  const verification = verificationMe?.verification;
  const profilePayload = verification?.payload ?? {};

  function savePreferences() {
    openCommand({
      title: 'Save admin preferences',
      summary: 'Language and timezone preferences will be saved through the admin profile endpoint and audited.',
      confirmLabel: 'Save Preferences',
      run: async (note) => {
        await adminApi.updateProfilePreferences({ preferredLanguage: language, timezone, note });
        await loadProfile();
      }
    });
  }

  return (
    <AdminShell currentPath="/admin/profile" title="Admin Profile">
      <AdminHero
        badge={loading ? 'Loading' : 'Admin identity'}
        heading="Admin Profile"
        body="Review the signed-in platform administrator identity, verification evidence, security status, and preferences without opening the normal user profile."
        actions={
          <button className="btn btn-primary" type="button" disabled={loading} onClick={() => void loadProfile()}>
            Refresh
          </button>
        }
      />

      {error ? <AdminError error={error} title="Admin profile could not load" /> : null}

      <div className="iam-profile-shell">
        <aside className="iam-profile-sidebar">
          <div className="iam-avatar">{(user?.displayName ?? 'Admin').slice(0, 2).toUpperCase()}</div>
          <h2>{user?.displayName ?? 'Platform Admin'}</h2>
          <p>{user?.email ?? 'No email recorded'}</p>
          <span className={badgeClass(user?.accountType)}>{displayLabel(user?.accountType ?? 'ADMIN')}</span>
          <div className="iam-profile-score">
            <strong>{displayLabel(user?.verificationStatus)}</strong>
            <span>Verification status</span>
          </div>
          <nav className="iam-profile-tabs" aria-label="Admin profile sections">
            {tabs.map((tab) => (
              <button className={activeTab === tab.key ? 'active' : ''} type="button" key={tab.key} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="iam-profile-content">
          {activeTab === 'overview' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Admin overview</span><h2>Profile completeness</h2></div><span className="badge badge-info">Admin</span></div>
              <div className="record-summary compact">
                <div><span>Account Type</span><strong>{user?.accountType ?? 'ADMIN'}</strong></div>
                <div><span>Trust Tier</span><strong>{displayLabel(user?.trustTier)}</strong></div>
                <div><span>Risk Level</span><strong>{displayLabel(user?.riskLevel)}</strong></div>
                <div><span>Signing Credential</span><strong>{signature?.hasCredential ? displayLabel(signature.status) : 'Not set'}</strong></div>
              </div>
            </section>
          ) : null}

          {activeTab === 'account' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Account</span><h2>Administrator account</h2></div><span className="badge badge-info">{user?.email ?? 'No email'}</span></div>
              <dl className="admin-detail-list">
                <dt>Name</dt><dd>{user?.displayName ?? 'Platform Admin'}</dd>
                <dt>Email</dt><dd>{user?.email ?? 'Not recorded'}</dd>
                <dt>Organization</dt><dd>{user?.organization ?? 'Platform administration'}</dd>
                <dt>Permissions</dt><dd>{user?.permissions?.length ? user.permissions.join(', ') : 'No explicit permissions'}</dd>
              </dl>
            </section>
          ) : null}

          {activeTab === 'entity' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Legal identity</span><h2>Entity information</h2></div><span className="badge badge-info">{displayLabel(verification?.status)}</span></div>
              <dl className="admin-detail-list">
                <dt>Registry source</dt><dd>{verification?.registrySource ?? 'Not recorded'}</dd>
                <dt>Registry number</dt><dd>{verification?.registryNumber ?? 'Not recorded'}</dd>
                <dt>Professional title</dt><dd>{valueFromPayload(profilePayload, 'professionalTitle')}</dd>
                <dt>Country</dt><dd>{valueFromPayload(profilePayload, 'country')}</dd>
              </dl>
            </section>
          ) : null}

          {activeTab === 'classification' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Classification</span><h2>Admin capabilities</h2></div><span className="badge badge-info">Access</span></div>
              <div className="iam-multi-list">
                {(user?.capabilities?.length ? user.capabilities : ['ADMIN']).map((capability) => <label key={capability}><input type="checkbox" checked readOnly /><span>{displayLabel(capability)}</span></label>)}
              </div>
            </section>
          ) : null}

          {activeTab === 'documents' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Documents</span><h2>Verification evidence</h2></div><span className="badge badge-info">Read only</span></div>
              <dl className="admin-detail-list">
                <dt>Profile record</dt><dd>{verification?.id ?? 'No verification profile'}</dd>
                <dt>Last updated</dt><dd>{formatDate(verification?.updatedAt)}</dd>
              </dl>
            </section>
          ) : null}

          {activeTab === 'settings' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Settings</span><h2>Admin preferences</h2></div><span className="badge badge-info">{user?.preferences?.preferredLanguage ?? 'Default'}</span></div>
              <div className="admin-settings-grid">
                <label className="form-group">
                  <span className="form-label">Language</span>
                  <input className="form-input" value={language} onChange={(event) => setLanguage(event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="form-label">Timezone</span>
                  <input className="form-input" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                </label>
                <button className="btn btn-primary" type="button" onClick={savePreferences}>Save Preferences</button>
              </div>
              <dl className="admin-detail-list">
                <dt>Feature gates</dt><dd>{user?.featureGates ? Object.entries(user.featureGates).filter(([, enabled]) => enabled).map(([key]) => displayLabel(key)).join(', ') || 'No enabled gates' : 'Admin bypass'}</dd>
              </dl>
            </section>
          ) : null}

          {activeTab === 'system' ? (
            <section className="iam-profile-section active">
              <div className="iam-section-heading"><div><span className="section-kicker">Security</span><h2>Signing credential</h2></div><span className={badgeClass(signature?.status)}>{displayLabel(signature?.status)}</span></div>
              <dl className="admin-detail-list">
                <dt>Fingerprint</dt><dd>{signature?.keyFingerprint ?? 'Not recorded'}</dd>
                <dt>Provider</dt><dd>{signature?.provider ?? 'No provider'}</dd>
                <dt>Created</dt><dd>{formatDate(signature?.createdAt)}</dd>
                <dt>Revoked</dt><dd>{formatDate(signature?.revokedAt)}</dd>
              </dl>
              <div className="iam-section-heading"><div><span className="section-kicker">Keyphrase recovery</span><h2>Recovery history</h2></div><span className="badge badge-info">Read only</span></div>
              <div className="registry-info-table-wrap">
                <table className="registry-info-table">
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Organization</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created</th>
                      <th scope="col">Completed</th>
                      <th scope="col">New fingerprint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyphraseRecoveryHistory.length ? keyphraseRecoveryHistory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.user?.displayName ?? item.email}</td>
                        <td>{item.organization?.name ?? 'Not recorded'}</td>
                        <td>{displayLabel(item.status)}</td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>{formatDate(item.completedAt)}</td>
                        <td>{item.newKeyFingerprint ?? 'Not recorded'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6}>No keyphrase recovery events recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>
      </div>
      <AdminCommandDrawer command={command} onClose={closeCommand} />
    </AdminShell>
  );
}
