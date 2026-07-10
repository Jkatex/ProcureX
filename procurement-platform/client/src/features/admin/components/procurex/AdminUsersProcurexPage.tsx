import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminUser, type AdminVerification, type PageDto } from '@/features/admin/api';
import { useNotifications } from '@/features/notifications/hooks';
import { notificationFromApiError } from '@/shared/api/errors';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import type { CreateNotificationInput } from '@/shared/types/notifications';
import type { SessionUser } from '@/shared/types/domain';
import { AdminCommandDrawer, AdminHero, AdminShell, AdminUndoBanner, displayLabel, exportCsv, formatDate, printAdminPage, useAdminCommand } from './AdminShared';

type StatusFilter = '' | SessionUser['verificationStatus'];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'NOT_STARTED', label: 'Not started' }
];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function initials(name?: string) {
  return (name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function statusBadge(status: SessionUser['verificationStatus']) {
  if (status === 'APPROVED') return 'badge badge-success';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'badge badge-error';
  if (status === 'PENDING') return 'badge badge-warning';
  return 'badge badge-info';
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminUsersProcurexPage() {
  const { notifySuccess, notifyError } = useNotifications();
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [platformUsers, setPlatformUsers] = useState<PageDto<AdminUser> | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [selectedPlatformUserId, setSelectedPlatformUserId] = useState('');
  const [accountSidebarOpen, setAccountSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [registryVerification, setRegistryVerification] = useState('');
  const [registryRole, setRegistryRole] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<CreateNotificationInput | null>(null);
  const { command, openCommand, closeCommand, undoAction, setUndoAction } = useAdminCommand();

  useBodyPageMetadata('admin-users');

  const filteredVerifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return verifications.filter((verification) => {
      const matchesStatus = statusFilter ? verification.status === statusFilter : true;
      const registryRecord = objectValue(verification.payload.registryRecord);
      const haystack = [
        verification.user.displayName,
        verification.user.email,
        verification.user.organization,
        verification.registrySource,
        verification.registryNumber,
        registryRecord.name
      ]
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [search, statusFilter, verifications]);

  const selected = filteredVerifications.find((verification) => verification.id === selectedId) ?? filteredVerifications[0] ?? null;
  const selectedPlatformUser = (platformUsers?.items ?? []).find((item) => item.id === selectedPlatformUserId) ?? null;
  const counts = useMemo(
    () => ({
      total: verifications.length,
      pending: verifications.filter((verification) => verification.status === 'PENDING').length,
      approved: verifications.filter((verification) => verification.status === 'APPROVED').length,
      rejected: verifications.filter((verification) => verification.status === 'REJECTED').length
    }),
    [verifications]
  );
  const accountCounts = useMemo(
    () => ({
      total: platformUsers?.total ?? 0,
      verified: (platformUsers?.items ?? []).filter((item) => item.verificationStatus === 'APPROVED').length,
      pending: (platformUsers?.items ?? []).filter((item) => item.verificationStatus === 'PENDING').length,
      suspended: (platformUsers?.items ?? []).filter((item) => item.membershipStatus === 'SUSPENDED').length
    }),
    [platformUsers]
  );

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setMessage(null);

      try {
        const [response, usersResponse] = await Promise.all([
          adminApi.listVerifications(),
          adminApi.listUsers({ page: 1, pageSize: 8 })
        ]);
        if (!active) return;
        setVerifications(response);
        setPlatformUsers(usersResponse);
        setSelectedId((current) => current || response[0]?.id || '');
        setSelectedPlatformUserId((current) => current || usersResponse.items[0]?.id || '');
      } catch (error) {
        if (active) setMessage(notificationFromApiError(error, { title: 'Verification queue could not load', fallback: 'Could not load verification queue.' }));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  async function loadPlatformUsers(nextPage = userPage) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApi.listUsers({
        q: search.trim() || undefined,
        verificationStatus: registryVerification || undefined,
        role: registryRole || undefined,
        page: nextPage,
        pageSize: 8
      });
      setPlatformUsers(response);
      setSelectedPlatformUserId((current) => {
        if (current && response.items.some((item) => item.id === current)) return current;
        return response.items[0]?.id || '';
      });
      if (!response.items.some((item) => item.id === selectedPlatformUserId)) setAccountSidebarOpen(false);
      setUserPage(nextPage);
    } catch (error) {
      setMessage(notificationFromApiError(error, { title: 'User registry could not load', fallback: 'Could not load user registry.' }));
    } finally {
      setLoading(false);
    }
  }

  async function decide(verification: AdminVerification, decision: 'approve' | 'reject') {
    setLoading(true);
    setMessage(null);

    try {
      const updated = await adminApi.decideVerification(verification.id, {
        decision,
        note: decisionNote.trim() || undefined
      });
      setVerifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
      setDecisionNote('');
      notifySuccess(`Verification ${decision === 'approve' ? 'approved' : 'rejected'}`, `${updated.user.displayName} was ${decision === 'approve' ? 'approved' : 'rejected'}.`, {
        reason: 'The admin decision was saved and the queue was refreshed in this session.'
      });
    } catch (error) {
      const notification = notificationFromApiError(error, { title: `Could not ${decision} verification`, fallback: `Could not ${decision} verification.` });
      setMessage(notification);
      notifyError(notification.title, notification.message, { reason: notification.reason, action: notification.action });
    } finally {
      setLoading(false);
    }
  }

  async function rescreen(verification: AdminVerification) {
    setLoading(true);
    setMessage(null);

    try {
      const updated = await adminApi.rescreenVerification(verification.id);
      setVerifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
      notifySuccess('Screening rerun complete', `Screening rerun for ${updated.user.displayName}.`, {
        reason: 'The latest screening status, trust tier, and risk level are reflected in the admin queue.'
      });
    } catch (error) {
      const notification = notificationFromApiError(error, { title: 'Could not rerun screening', fallback: 'Could not rerun screening.' });
      setMessage(notification);
      notifyError(notification.title, notification.message, { reason: notification.reason, action: notification.action });
    } finally {
      setLoading(false);
    }
  }

  async function updatePlatformUser(updated: AdminUser) {
    setPlatformUsers((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === updated.id ? updated : item))
          }
        : current
    );
    setSelectedPlatformUserId(updated.id);
  }

  function openUserCommand(kind: 'suspend' | 'reinstate' | 'reset' | 'revoke', target: AdminUser) {
    const configs = {
      suspend: {
        title: `Suspend ${target.displayName}`,
        summary: 'Suspension moves active memberships to suspended and can be undone from the admin action history.',
        confirmLabel: 'Suspend',
        confirmText: 'SUSPEND',
        dangerous: true,
        run: async (note: string) => {
          const action = await adminApi.recordAction({
            actionType: 'HOLD',
            entityType: 'user',
            entityRef: target.id,
            ownerOrgId: target.organization?.id ?? null,
            summary: note || `Suspended ${target.displayName}.`
          });
          await loadPlatformUsers(userPage);
          return action;
        }
      },
      reinstate: {
        title: `Reinstate ${target.displayName}`,
        summary: 'Reinstatement restores suspended memberships to active.',
        confirmLabel: 'Reinstate',
        run: async (note: string) => {
          const updated = await adminApi.reinstateUser(target.id, { note });
          await updatePlatformUser(updated);
          return updated;
        }
      },
      reset: {
        title: `Reset access for ${target.displayName}`,
        summary: 'This revokes active sessions and creates a pending identity reset challenge for the account.',
        confirmLabel: 'Create Reset',
        dangerous: true,
        run: (note: string) => adminApi.resetUserAccess(target.id, { note })
      },
      revoke: {
        title: `Revoke sessions for ${target.displayName}`,
        summary: 'All active sessions for this account will be revoked.',
        confirmLabel: 'Revoke Sessions',
        dangerous: true,
        run: (note: string) => adminApi.revokeUserSessions(target.id, { note })
      }
    };
    openCommand(configs[kind]);
  }

  function openInviteCommand() {
    openCommand({
      title: 'Invite account',
      summary: 'Creates a real pending invited account and identity invite challenge.',
      confirmLabel: 'Invite Account',
      fields: [
        { key: 'email', label: 'Email', type: 'email', placeholder: 'person@example.com', required: true },
        { key: 'displayName', label: 'Display name', placeholder: 'Full name', required: true }
      ],
      run: async (note, fields) => {
        const email = fields.email.trim();
        const displayName = fields.displayName.trim();
        const invited = await adminApi.inviteUser({ email, displayName, accountType: 'USER', note });
        await loadPlatformUsers(1);
        return invited;
      }
    });
  }

  function exportAccounts() {
    exportCsv(
      'admin-users.csv',
      (platformUsers?.items ?? []).map((item) => ({
        name: item.displayName,
        email: item.email,
        phone: item.phone ?? '',
        accountType: item.accountType,
        verificationStatus: item.verificationStatus,
        role: item.role,
        membershipStatus: item.membershipStatus ?? '',
        organization: item.organization?.name ?? '',
        capabilities: item.organization?.capabilities.join('; ') ?? '',
        trustTier: item.trustTier,
        riskLevel: item.riskLevel,
        lastSessionAt: item.lastSessionAt ?? ''
      }))
    );
  }

  const selectedPayload = objectValue(selected?.payload);
  const selectedRegistry = objectValue(selectedPayload.registryRecord);

  return (
    <AdminShell currentPath="/admin/users" title="Admin User Management">
      <AdminHero
        badge="Identity and access"
        heading="User Verification Management"
        body="Review submitted registration records, inspect registry evidence, and approve or reject accounts before they access operational ProcureX modules."
        actions={
          <>
                <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void adminApi.listVerifications().then(setVerifications)}>
                  Refresh Queue
                </button>
                <button className="btn btn-secondary" type="button" disabled={loading} onClick={openInviteCommand}>
                  Invite Account
                </button>
                <button className="btn btn-secondary" type="button" disabled={loading || !platformUsers?.items.length} onClick={exportAccounts}>
                  Export Accounts
                </button>
                <button className="btn btn-secondary" type="button" onClick={printAdminPage}>
                  Print PDF
                </button>
                <button className="btn btn-primary" type="button" onClick={() => setStatusFilter('PENDING')}>
                  Pending Only
                </button>
          </>
        }
      />

            <AdminUndoBanner action={undoAction} onDismiss={() => setUndoAction(null)} onUndo={async (id) => {
              await adminApi.undoAction(id, { note: 'Undone from user management.' });
              await loadPlatformUsers(userPage);
            }} />

            <section className="admin-kpi-grid four-col">
              <article className="admin-kpi-card">
                <span>Total Accounts</span>
                <strong>{accountCounts.total || counts.total}</strong>
                <em>Registered user accounts</em>
              </article>
              <article className="admin-kpi-card">
                <span>Verified</span>
                <strong>{accountCounts.verified || counts.approved}</strong>
                <em>Approved identity profiles</em>
              </article>
              <article className="admin-kpi-card">
                <span>Pending Verification</span>
                <strong>{accountCounts.pending || counts.pending}</strong>
                <em>Awaiting admin decision</em>
              </article>
              <article className="admin-kpi-card">
                <span>Suspended</span>
                <strong>{accountCounts.suspended}</strong>
                <em>Memberships on hold</em>
              </article>
            </section>

            <section className="journey-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Search and filters</span>
                  <h2>Registered verification profiles</h2>
                </div>
                <span className="badge badge-info">{loading ? 'Loading' : `${filteredVerifications.length} visible`}</span>
              </div>
              <div className="admin-filter-bar">
                <input
                  className="form-input"
                  type="search"
                  placeholder="Search name, email, organization, or registry number"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  {statusOptions.map((option) => (
                    <option value={option.value} key={option.value || 'all'}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {message ? <NotificationCard notification={message} /> : null}
            </section>

            <section className="journey-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Platform registry</span>
                    <h2>Admin user registry</h2>
                  </div>
                  <span className="badge badge-info">{platformUsers ? `${platformUsers.total} users` : 'Loading'}</span>
                </div>
                <div className="admin-quick-row">
                  <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void loadPlatformUsers(1)}>
                    Search Registry
                  </button>
                  <select className="form-input" value={registryVerification} onChange={(event) => setRegistryVerification(event.target.value)}>
                    <option value="">All verification statuses</option>
                    {statusOptions.slice(1).map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select className="form-input" value={registryRole} onChange={(event) => setRegistryRole(event.target.value)}>
                    <option value="">All roles</option>
                    <option value="BUYER">Buyer</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button className="btn btn-secondary" type="button" disabled={loading || userPage <= 1} onClick={() => void loadPlatformUsers(userPage - 1)}>
                    Previous
                  </button>
                  <span className="badge badge-info">Page {userPage}</span>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={loading || !platformUsers || userPage >= Math.max(1, Math.ceil(platformUsers.total / platformUsers.pageSize))}
                    onClick={() => void loadPlatformUsers(userPage + 1)}
                  >
                    Next
                  </button>
                </div>
                <div className="data-table evaluation-table-scroll admin-data-table admin-users-table">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Account</th>
                        <th>Organization</th>
                        <th>Trust</th>
                        <th>Screening</th>
                        <th>Last session</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(platformUsers?.items ?? []).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.displayName}</strong>
                            <em>{item.email}</em>
                          </td>
                          <td>
                            <span className={statusBadge(item.verificationStatus as SessionUser['verificationStatus'])}>{statusLabel(item.verificationStatus)}</span>
                            <em>{item.role} / {item.membershipStatus ? displayLabel(item.membershipStatus) : item.accountType}</em>
                          </td>
                          <td>
                            <span>{item.organization?.name ?? 'No organization'}</span>
                            <em>{item.organization?.capabilities.join(', ') || 'No capabilities'}</em>
                          </td>
                          <td>
                            <span>{item.trustTier}</span>
                            <em>{item.riskLevel}</em>
                          </td>
                          <td>{item.screeningStatus}</td>
                          <td>{item.lastSessionAt ? formatDate(item.lastSessionAt) : 'No session'}</td>
                          <td className="admin-table-actions">
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => {
                              setSelectedPlatformUserId(item.id);
                              setAccountSidebarOpen(true);
                            }}>
                              View
                            </button>
                            {item.membershipStatus === 'SUSPENDED' ? (
                              <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={() => openUserCommand('reinstate', item)}>
                                Reinstate
                              </button>
                            ) : (
                              <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={() => openUserCommand('suspend', item)}>
                                Suspend
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={() => openUserCommand('reset', item)}>
                              Reset
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={() => openUserCommand('revoke', item)}>
                              Revoke Sessions
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!platformUsers?.items.length ? (
                        <tr>
                          <td colSpan={7}>No platform users match the current registry search.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
            </section>

            <AccountRegistrySidebar
              open={accountSidebarOpen}
              selectedPlatformUser={selectedPlatformUser}
              onClose={() => setAccountSidebarOpen(false)}
            />

            <section className="admin-split-with-drawer">
              <div className="journey-panel">
                <div className="data-table evaluation-table-scroll admin-data-table admin-users-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Avatar</th>
                        <th>Name</th>
                        <th>Email / Organization</th>
                        <th>Registry</th>
                        <th>Verification</th>
                        <th>Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVerifications.map((verification) => (
                        <tr key={verification.id}>
                          <td>
                            <span className="admin-avatar">{initials(verification.user.displayName)}</span>
                          </td>
                          <td>
                            <strong>{verification.user.displayName}</strong>
                            <em>{verification.user.accountType}</em>
                          </td>
                          <td>
                            <span>{verification.user.email}</span>
                            <em>{verification.user.organization || 'No organization assigned'}</em>
                          </td>
                          <td>
                            <span>{verification.registrySource ?? 'Pending'}</span>
                            <em>{verification.registryNumber ?? 'No registry number'}</em>
                          </td>
                          <td>
                            <span className={statusBadge(verification.status)}>{statusLabel(verification.status)}</span>
                            <em>{verification.screeningStatus} / {verification.trustTier}</em>
                          </td>
                          <td>{new Date(verification.updatedAt).toLocaleDateString()}</td>
                          <td className="admin-table-actions">
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSelectedId(verification.id)}>
                              View
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" disabled={loading || verification.status !== 'PENDING'} onClick={() => void decide(verification, 'reject')}>
                              Reject
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={() => void rescreen(verification)}>
                              Rescreen
                            </button>
                            <button className="btn btn-primary btn-sm" type="button" disabled={loading || verification.status === 'APPROVED'} onClick={() => void decide(verification, 'approve')}>
                              Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!filteredVerifications.length ? (
                        <tr>
                          <td colSpan={7}>No verification profiles match the current filters.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="admin-drawer admin-drawer-open" aria-label="Account detail preview">
                {selected ? (
                  <>
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">Detail drawer</span>
                        <h2>{selected.user.displayName}</h2>
                      </div>
                      <span className={statusBadge(selected.status)}>{statusLabel(selected.status)}</span>
                    </div>
                    <div className="admin-drawer-profile">
                      <span className="admin-avatar large">{initials(selected.user.displayName)}</span>
                      <div>
                        <strong>{selected.user.displayName}</strong>
                        <span>{selected.user.email}</span>
                      </div>
                    </div>
                    <dl className="admin-detail-list">
                      <dt>Source</dt>
                      <dd>{selected.registrySource ?? stringValue(selectedRegistry.source, 'Pending')}</dd>
                      <dt>Number</dt>
                      <dd>{selected.registryNumber ?? stringValue(selectedRegistry.registryNumber, 'Pending')}</dd>
                      <dt>Registry name</dt>
                      <dd>{stringValue(selectedRegistry.name, stringValue(selectedPayload.verifiedName, 'Pending'))}</dd>
                      <dt>Entity type</dt>
                      <dd>{stringValue(selectedPayload.entityType, 'Pending')}</dd>
                      <dt>Signature</dt>
                      <dd>{stringValue(selectedPayload.signatureName, 'Pending')}</dd>
                      <dt>Capabilities</dt>
                      <dd>{selected.user.capabilities.length ? selected.user.capabilities.join(', ') : 'Assigned after approval'}</dd>
                      <dt>Screening</dt>
                      <dd>{selected.screeningStatus}</dd>
                      <dt>Trust tier</dt>
                      <dd>{selected.trustTier}</dd>
                      <dt>Risk level</dt>
                      <dd>{selected.riskLevel}</dd>
                    </dl>
                    {selected.reviewReasons.length ? (
                      <div className="admin-timeline compact">
                        {selected.reviewReasons.map((reason) => (
                          <div key={reason}>
                            <strong>Review reason</strong>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-timeline compact">
                        <div>
                          <strong>No review blockers</strong>
                          <span>The deterministic checks did not record additional reasons.</span>
                        </div>
                      </div>
                    )}
                    <label className="form-group">
                      <span className="form-label">Admin note</span>
                      <textarea className="form-input" rows={4} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
                    </label>
                    <div className="admin-table-actions">
                      <button className="btn btn-secondary" type="button" disabled={loading || selected.status !== 'PENDING'} onClick={() => void decide(selected, 'reject')}>
                        Reject
                      </button>
                      <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void rescreen(selected)}>
                        Rescreen
                      </button>
                      <button className="btn btn-primary" type="button" disabled={loading || selected.status === 'APPROVED'} onClick={() => void decide(selected, 'approve')}>
                        Approve
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Detail drawer</span>
                      <h2>No profile selected</h2>
                    </div>
                  </div>
                )}
              </aside>
            </section>
            <AdminCommandDrawer command={command} onClose={closeCommand} onUndoAvailable={setUndoAction} />
    </AdminShell>
  );
}

function AccountRegistrySidebar({ open, selectedPlatformUser, onClose }: { open: boolean; selectedPlatformUser: AdminUser | null; onClose: () => void }) {
  if (!open) return null;

  if (!selectedPlatformUser) {
    return (
      <div className="admin-account-sidebar-backdrop" role="presentation">
        <aside className="admin-drawer admin-account-sidebar admin-account-sidebar-floating" role="dialog" aria-modal="true" aria-label="Account registry detail">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Detail drawer</span>
              <h2>No profile selected</h2>
            </div>
            <button className="admin-command-close" type="button" aria-label="Close account detail" onClick={onClose}>x</button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="admin-account-sidebar-backdrop" role="presentation">
      <aside className="admin-drawer admin-account-sidebar admin-account-sidebar-floating" role="dialog" aria-modal="true" aria-label="Account registry detail">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Account registry detail</span>
            <h2>{selectedPlatformUser.displayName}</h2>
          </div>
          <div className="admin-account-sidebar-actions">
            <span className={statusBadge(selectedPlatformUser.verificationStatus as SessionUser['verificationStatus'])}>{statusLabel(selectedPlatformUser.verificationStatus)}</span>
            <button className="admin-command-close" type="button" aria-label="Close account detail" onClick={onClose}>x</button>
          </div>
        </div>
        <dl className="admin-detail-list">
          <dt>Role</dt>
          <dd>{selectedPlatformUser.role}</dd>
          <dt>Phone</dt>
          <dd>{selectedPlatformUser.phone ?? 'Not recorded'}</dd>
          <dt>Membership</dt>
          <dd>{selectedPlatformUser.membershipStatus ? displayLabel(selectedPlatformUser.membershipStatus) : 'No membership'}</dd>
          <dt>Documents</dt>
          <dd>{selectedPlatformUser.documents.length ? selectedPlatformUser.documents.join(', ') : 'No documents recorded'}</dd>
          <dt>Permissions</dt>
          <dd>{selectedPlatformUser.permissions.length ? selectedPlatformUser.permissions.join(', ') : 'Default permissions'}</dd>
        </dl>
        <div className="admin-timeline compact">
          {selectedPlatformUser.timeline.map((item) => (
            <div key={`${item.label}:${item.at}`}>
              <strong>{displayLabel(item.label)}</strong>
              <span>{item.detail} / {formatDate(item.at)}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
