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
import { adminAppRegistry, type AdminCommandConfig } from './AdminSharedUtils';

const adminAppIconByKey: Record<string, PlatformAppIconKind> = {
  'command-center': 'records',
  'user-management': 'iam',
  'platform-analytics': 'evaluation',
  'full-audit-trail': 'records',
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
      <span className={`admin-app-menu-icon admin-app-menu-icon-${appKey}`}>
        <img className={`admin-app-menu-image admin-app-menu-image-${appKey}`} src={imageSrc} alt="" aria-hidden="true" />
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

