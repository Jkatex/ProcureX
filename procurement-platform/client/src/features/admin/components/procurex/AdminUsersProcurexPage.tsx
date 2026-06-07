import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { adminApi, type AdminVerification } from '@/features/admin/api';
import { signOut } from '@/features/auth/slice';
import { apiErrorMessage } from '@/shared/api/errors';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import type { SessionUser } from '@/shared/types/domain';

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

function adminNavClass(path: string, currentPath = '/admin/users') {
  return path === currentPath ? 'active' : '';
}

export function AdminUsersProcurexPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [decisionNote, setDecisionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
  const counts = useMemo(
    () => ({
      total: verifications.length,
      pending: verifications.filter((verification) => verification.status === 'PENDING').length,
      approved: verifications.filter((verification) => verification.status === 'APPROVED').length,
      rejected: verifications.filter((verification) => verification.status === 'REJECTED').length
    }),
    [verifications]
  );

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setMessage('');

      try {
        const response = await adminApi.listVerifications();
        if (!active) return;
        setVerifications(response);
        setSelectedId((current) => current || response[0]?.id || '');
      } catch (error) {
        if (active) setMessage(apiErrorMessage(error, 'Could not load verification queue.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  async function decide(verification: AdminVerification, decision: 'approve' | 'reject') {
    setLoading(true);
    setMessage('');

    try {
      const updated = await adminApi.decideVerification(verification.id, {
        decision,
        note: decisionNote.trim() || undefined
      });
      setVerifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
      setDecisionNote('');
      setMessage(`Verification ${decision === 'approve' ? 'approved' : 'rejected'} for ${updated.user.displayName}.`);
    } catch (error) {
      setMessage(apiErrorMessage(error, `Could not ${decision} verification.`));
    } finally {
      setLoading(false);
    }
  }

  function navigateAdmin(path: string) {
    navigate(path);
  }

  const selectedPayload = objectValue(selected?.payload);
  const selectedRegistry = objectValue(selectedPayload.registryRecord);

  return (
    <>
      <header className="app-topbar">
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" onClick={() => navigate('/admin')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>Admin User Management</span>
          </button>
        </div>

        <div className="app-topbar-actions">
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/admin')}>
            Command Center
          </button>
          <button
            className="profile-button"
            type="button"
            aria-label="Sign out"
            onClick={() => {
              dispatch(signOut());
              navigate('/sign-in');
            }}
          >
            <span>{initials(user?.displayName)}</span>
          </button>
        </div>
      </header>

      <div className="main-layout admin-page admin-users-page">
        <aside className="sidebar admin-sidebar" aria-label="Platform admin navigation">
          <div className="sidebar-heading">
            <h3>Platform Admin</h3>
            <div>System oversight</div>
          </div>
          <ul className="sidebar-nav">
            {[
              ['/admin', 'Command Center'],
              ['/admin/search', 'Deep Search'],
              ['/admin/users', 'User Management'],
              ['/admin/compliance', 'Compliance Rules'],
              ['/admin/analytics', 'Platform Analytics'],
              ['/admin/audit', 'Full Audit Trail']
            ].map(([path, label]) => (
              <li key={path}>
                <a
                  href={path}
                  className={adminNavClass(path)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateAdmin(path);
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="admin-sidebar-divider"></div>
          <ul className="sidebar-nav">
            <li>
              <a
                href="/identity/profile"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/identity/profile');
                }}
              >
                Admin Profile
              </a>
            </li>
          </ul>
        </aside>

        <main className="main-content">
          <div className="journey-page">
            <section className="journey-hero compact admin-hero">
              <div>
                <span className="badge badge-info">Identity and access</span>
                <h1>User Verification Management</h1>
                <p>Review submitted registration records, inspect registry evidence, and approve or reject accounts before they access operational ProcureX modules.</p>
              </div>
              <div className="hero-action-stack">
                <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void adminApi.listVerifications().then(setVerifications)}>
                  Refresh Queue
                </button>
                <button className="btn btn-primary" type="button" onClick={() => setStatusFilter('PENDING')}>
                  Pending Only
                </button>
              </div>
            </section>

            <section className="admin-kpi-grid four-col">
              <article className="admin-kpi-card">
                <span>Total Profiles</span>
                <strong>{counts.total}</strong>
                <em>Submitted verification records</em>
              </article>
              <article className="admin-kpi-card">
                <span>Pending</span>
                <strong>{counts.pending}</strong>
                <em>Awaiting admin decision</em>
              </article>
              <article className="admin-kpi-card">
                <span>Approved</span>
                <strong>{counts.approved}</strong>
                <em>App access enabled</em>
              </article>
              <article className="admin-kpi-card">
                <span>Rejected</span>
                <strong>{counts.rejected}</strong>
                <em>Returned for correction</em>
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
              {message ? <p className="auth-note">{message}</p> : null}
            </section>

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
                          </td>
                          <td>{new Date(verification.updatedAt).toLocaleDateString()}</td>
                          <td className="admin-table-actions">
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSelectedId(verification.id)}>
                              View
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" disabled={loading || verification.status !== 'PENDING'} onClick={() => void decide(verification, 'reject')}>
                              Reject
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
          </div>
        </main>
      </div>
    </>
  );
}
