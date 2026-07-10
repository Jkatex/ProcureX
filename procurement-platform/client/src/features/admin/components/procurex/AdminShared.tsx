import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { adminApi, type AdminApp } from '@/features/admin/api';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { AccountMenu } from '@/shared/components/AccountMenu';
import { notificationFromApiError } from '@/shared/api/errors';
import type { CreateNotificationInput } from '@/shared/types/notifications';
import { PlatformAppsButton, PlatformAppIcon, type PlatformAppIconKind } from '@/shared/components/procurex/PlatformAppsDrawer';
import { resolveAdminAppIconAsset } from './adminAppIconAssets';

export type AdminCommandConfig = {
  title: string;
  summary: string;
  confirmLabel?: string;
  confirmText?: string;
  defaultNote?: string;
  dangerous?: boolean;
  fields?: Array<{ key: string; label: string; placeholder?: string; required?: boolean; type?: string }>;
  run: (note: string, fields: Record<string, string>) => Promise<unknown>;
  onComplete?: (result: unknown) => void;
};

export const adminAppRegistry: AdminApp[] = [
  {
    key: 'command-center',
    title: 'Command Center',
    description: 'Platform-wide oversight for compliance, risk, admin actions, and procurement activity.',
    route: '/admin',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/dashboard', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'deep-search',
    title: 'Deep Search',
    description: 'Search users, organizations, procurement records, documents, audit events, and archives.',
    route: '/admin/search',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/search', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'user-management',
    title: 'User Management',
    description: 'Review verification queues, inspect user registry data, and record account actions.',
    route: '/admin/users',
    group: 'primary',
    backend: { module: 'compliance-admin + identity', endpoint: '/api/compliance-admin/users + /api/identity/admin/verifications', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'compliance-rules',
    title: 'Compliance Rules',
    description: 'Manage compliance cases, rules, method limits, checklists, standstill settings, and alerts.',
    route: '/admin/compliance',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/compliance/cases + /api/compliance-admin/compliance/rules', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'platform-analytics',
    title: 'Platform Analytics',
    description: 'View aggregate activity, workflow, procurement value, compliance, and risk metrics.',
    route: '/admin/analytics',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/analytics', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'full-audit-trail',
    title: 'Full Audit Trail',
    description: 'Trace system events, admin actions, authentication, verification, and compliance evidence.',
    route: '/admin/audit',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/audit/events', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'data-store',
    title: 'Data Store',
    description: 'Manage global and user-scoped JSON namespaces, keys, and configuration values.',
    route: '/admin/datastore',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/datastore', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'tender-review',
    title: 'Tender Review',
    description: 'Review newly submitted tenders before marketplace publication.',
    route: '/admin/tender-review',
    group: 'primary',
    backend: { module: 'procurement', endpoint: '/api/procurement/admin/tender-review', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'communication-center',
    title: 'Communication Center',
    description: 'Messages, clarifications, alerts, and admin-visible communication activity.',
    route: '/admin/communication',
    group: 'secondary',
    backend: { module: 'communication', endpoint: '/api/communication', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'admin-profile',
    title: 'Admin Profile',
    description: 'Admin identity profile, preferences, verification context, and account controls.',
    route: '/admin/profile',
    group: 'secondary',
    backend: { module: 'identity', endpoint: '/api/identity/me + /api/identity/profile', status: 'live' },
    generatedAt: ''
  }
];

const adminAppIconByKey: Record<string, PlatformAppIconKind> = {
  'command-center': 'records',
  'deep-search': 'procurement',
  'user-management': 'iam',
  'compliance-rules': 'planning',
  'platform-analytics': 'evaluation',
  'full-audit-trail': 'records',
  'data-store': 'records',
  'tender-review': 'procurement',
  'communication-center': 'communication',
  'admin-profile': 'iam'
};

export function AdminShell({ currentPath, title, children }: { currentPath: string; title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [appsOpen, setAppsOpen] = useState(false);
  const [adminApps, setAdminApps] = useState<AdminApp[]>(adminAppRegistry);
  const headerRef = useRef<HTMLElement | null>(null);
  const organizationLabel = user?.organization || 'Platform admin tools';

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

  useEffect(() => {
    let active = true;
    async function loadApps() {
      try {
        const response = await adminApi.apps();
        if (active) setAdminApps(response.items);
      } catch {
        if (active) setAdminApps(adminAppRegistry);
      }
    }

    void loadApps();
    return () => {
      active = false;
    };
  }, []);

  function selectAdminApp(route: string) {
    setAppsOpen(false);
    navigate(route);
  }

  const primaryApps = adminApps.filter((item) => item.group === 'primary');
  const secondaryApps = adminApps.filter((item) => item.group === 'secondary');

  return (
    <>
      <header className="app-topbar" ref={headerRef}>
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" onClick={() => navigate('/admin')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>{title}</span>
          </button>
        </div>

        <div className="app-topbar-actions">
          <PlatformAppsButton expanded={appsOpen} onClick={() => setAppsOpen((current) => !current)} ariaLabel="Open apps" />
          <AdminAppsDrawer open={appsOpen} organizationLabel={organizationLabel} apps={adminApps} onSelect={selectAdminApp} />
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/admin/search')}>
            Search
          </button>
          <div className="profile-menu-wrap">
            <AccountMenu buttonClassName="profile-button" />
          </div>
        </div>
      </header>

      <div className="main-layout admin-page">
        <aside className="sidebar admin-sidebar" aria-label="Platform admin navigation">
          <div className="sidebar-heading">
            <h3>Platform Admin</h3>
            <div>System oversight</div>
          </div>
          <ul className="sidebar-nav">
            {primaryApps.map((item) => (
              <li key={item.route}>
                <a
                  href={item.route}
                  className={item.route === currentPath ? 'active' : ''}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.route);
                  }}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
          <div className="admin-sidebar-divider"></div>
          <ul className="sidebar-nav">
            {secondaryApps.map((item) => (
              <li key={item.route}>
                <a
                  href={item.route}
                  className={item.route === currentPath ? 'active' : ''}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.route);
                  }}
                >
                  {item.title}
                </a>
              </li>
            ))}
            {!secondaryApps.length ? <li>
              <a
                href="/admin/profile"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/admin/profile');
                }}
              >
                Admin Profile
              </a>
            </li> : null}
          </ul>
        </aside>

        <main className="main-content">
          <div className="journey-page">{children}</div>
        </main>
      </div>
    </>
  );
}

export function AdminAppsDrawer({ open, organizationLabel, apps, onSelect }: { open: boolean; organizationLabel: string; apps: AdminApp[]; onSelect: (route: string) => void }) {
  return (
    <div className={`app-drawer-menu${open ? ' open' : ''}`} data-app-menu aria-hidden={!open}>
      <div className="app-menu-header">
        <div className="app-menu-brand">
          <span className="platform-logo platform-logo-sm">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <strong>Admin Apps</strong>
        </div>
        <span>{organizationLabel}</span>
      </div>
      {apps.map((item) => (
        <button
          key={item.key}
          className={`app-menu-card ${item.group === 'secondary' ? 'app-menu-communication' : 'app-menu-contracts'}`}
          type="button"
          data-navigate={item.key}
          onClick={() => onSelect(item.route)}
        >
          <AdminAppIcon appKey={item.key} fallbackKind={adminAppIconByKey[item.key] ?? 'records'} />
          <span>
            <strong>{item.title}</strong>
            <em>{item.description}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

function AdminAppIcon({ appKey, fallbackKind }: { appKey: string; fallbackKind: PlatformAppIconKind }) {
  const imageSrc = resolveAdminAppIconAsset(appKey);

  if (imageSrc) {
    return (
      <span className="app-menu-icon app-menu-icon-image">
        <img className="app-menu-image" src={imageSrc} alt="" aria-hidden="true" />
      </span>
    );
  }

  return <PlatformAppIcon kind={fallbackKind} useImage={false} />;
}

export function AdminHero({
  badge,
  heading,
  body,
  actions
}: {
  badge: string;
  heading: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <section className="journey-hero compact admin-hero">
      <div>
        <span className="badge badge-info">{badge}</span>
        <h1>{heading}</h1>
        <p>{body}</p>
      </div>
      {actions ? <div className="hero-action-stack">{actions}</div> : null}
    </section>
  );
}

export function AdminPanel({ kicker, title, badge, children }: { kicker?: string; title: string; badge?: string; children: ReactNode }) {
  return (
    <section className="journey-panel">
      <div className="panel-heading">
        <div>
          {kicker ? <span className="section-kicker">{kicker}</span> : null}
          <h2>{title}</h2>
        </div>
        {badge ? <span className="badge badge-info">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminError({ error, title = 'Admin data could not load' }: { error: unknown; title?: string }) {
  const notification: CreateNotificationInput = notificationFromApiError(error, { title, fallback: 'Could not load admin data.' });
  return <NotificationCard notification={notification} />;
}

export function useAdminCommand() {
  const [command, setCommand] = useState<AdminCommandConfig | null>(null);
  const [undoAction, setUndoAction] = useState<{ id: string; label: string } | null>(null);
  return {
    command,
    openCommand: setCommand,
    closeCommand: () => setCommand(null),
    undoAction,
    setUndoAction
  };
}

export function AdminCommandDrawer({
  command,
  onClose,
  onUndoAvailable
}: {
  command: AdminCommandConfig | null;
  onClose: () => void;
  onUndoAvailable?: (action: { id: string; label: string }) => void;
}) {
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setNote(command?.defaultNote ?? '');
    setConfirm('');
    setFieldValues(Object.fromEntries((command?.fields ?? []).map((field) => [field.key, ''])));
    setSaving(false);
    setError(null);
  }, [command]);

  if (!command) return null;

  const activeCommand = command;
  const requiresConfirm = Boolean(command.confirmText);
  const fieldsValid = (command.fields ?? []).every((field) => !field.required || fieldValues[field.key]?.trim());
  const confirmed = (!requiresConfirm || confirm.trim() === command.confirmText) && fieldsValid;

  async function submit() {
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const result = await activeCommand.run(note.trim(), fieldValues);
      const maybeAction = result && typeof result === 'object' && 'id' in result && 'reversible' in result ? result as { id: string; reversible?: boolean } : null;
      if (maybeAction?.reversible) onUndoAvailable?.({ id: maybeAction.id, label: activeCommand.title });
      activeCommand.onComplete?.(result);
      onClose();
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="admin-command-drawer" role="dialog" aria-modal="true" aria-label={command.title}>
      <div className="admin-command-panel">
        <button className="admin-command-close" type="button" aria-label="Close" onClick={onClose}>x</button>
        <span className={command.dangerous ? 'badge badge-error' : 'badge badge-info'}>{command.dangerous ? 'Sensitive action' : 'Admin action'}</span>
        <h2>{command.title}</h2>
        <p>{command.summary}</p>
        <label className="form-group">
          <span className="form-label">Reason or note</span>
          <textarea className="form-input" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {(command.fields ?? []).map((field) => (
          <label className="form-group" key={field.key}>
            <span className="form-label">{field.label}</span>
            <input
              className="form-input"
              type={field.type ?? 'text'}
              placeholder={field.placeholder}
              value={fieldValues[field.key] ?? ''}
              onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
        {requiresConfirm ? (
          <label className="form-group">
            <span className="form-label">Type {command.confirmText} to confirm</span>
            <input className="form-input" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </label>
        ) : null}
        {error ? <AdminError error={error} title="Admin action failed" /> : null}
        <div className="admin-table-actions">
          <button className={command.dangerous ? 'btn btn-secondary' : 'btn btn-primary'} type="button" disabled={saving || !confirmed} onClick={() => void submit()}>
            {saving ? 'Saving' : command.confirmLabel ?? 'Confirm'}
          </button>
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </aside>
  );
}

export function AdminUndoBanner({ action, onUndo, onDismiss }: { action: { id: string; label: string } | null; onUndo: (id: string) => Promise<void>; onDismiss: () => void }) {
  const [saving, setSaving] = useState(false);
  if (!action) return null;
  return (
    <div className="admin-undo-banner">
      <span>{action.label} saved.</span>
      <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={async () => {
        setSaving(true);
        try {
          await onUndo(action.id);
          onDismiss();
        } finally {
          setSaving(false);
        }
      }}>
        {saving ? 'Undoing' : 'Undo'}
      </button>
      <button className="btn btn-secondary btn-sm" type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>{label}</td>
    </tr>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <button className="btn btn-secondary btn-sm" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="badge badge-info">
        Page {page} of {lastPage}
      </span>
      <button className="btn btn-secondary btn-sm" type="button" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function badgeClass(value?: string) {
  const lower = (value ?? '').toLowerCase();
  if (['approved', 'active', 'open', 'clear', 'low', 'published', 'submitted'].some((word) => lower.includes(word))) return 'badge badge-success';
  if (['pending', 'review', 'warning', 'medium', 'draft', 'investigation'].some((word) => lower.includes(word))) return 'badge badge-warning';
  if (['rejected', 'critical', 'error', 'blocked', 'high', 'escalated', 'expired'].some((word) => lower.includes(word))) return 'badge badge-error';
  return 'badge badge-info';
}

export function displayLabel(value?: string | null) {
  if (!value) return 'Not set';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-TZ', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function compactNumber(value: number | undefined) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);
}

export function initials(name?: string | null) {
  return (name || 'Admin')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function maxCount(items: Array<{ count: number }>) {
  return Math.max(1, ...items.map((item) => item.count));
}

export function exportCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? '';
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printAdminPage() {
  window.print();
}
