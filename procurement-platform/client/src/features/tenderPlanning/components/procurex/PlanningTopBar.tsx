import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import { AppMenuIcon } from './icons';

type PlanningTopBarProps = {
  title?: string;
  onNavigate: (pageKey: string) => void;
};

const appMenuItems = [
  {
    className: 'app-menu-iam',
    page: 'account-profile',
    icon: 'iam',
    title: 'Registration and Verification',
    description: 'Account and identity verification'
  },
  {
    className: 'app-menu-procurement',
    page: 'tender-planning',
    icon: 'planning',
    title: 'Procurement Planning',
    description: 'APP, SPP, budgets, approvals'
  },
  {
    className: 'app-menu-procurement',
    page: 'marketplace',
    icon: 'procurement',
    title: 'Procurement',
    description: 'Marketplace, create tender, bid'
  },
  {
    className: 'app-menu-communication',
    page: 'communication-center',
    icon: 'communication',
    title: 'Communication Center',
    description: 'Messages, clarifications, alerts'
  },
  {
    className: 'app-menu-evaluation',
    page: 'bid-evaluation',
    icon: 'evaluation',
    title: 'Evaluation',
    description: 'Evaluate bids on your tenders'
  },
  {
    className: 'app-menu-awarding',
    page: 'awarding-contracts',
    icon: 'awarding',
    title: 'Awarding and Contract',
    description: 'Awards, negotiations, signatures'
  },
  {
    className: 'app-menu-contracts',
    page: 'records-history',
    icon: 'records',
    title: 'Records and History',
    description: 'Past tenders, bids, awards'
  }
] as const;

function initials(name?: string | null) {
  const parts = String(name || 'ProcureX user')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] || 'P').toUpperCase() + (parts.length > 1 ? (parts[1]?.[0] || '').toUpperCase() : '');
}

export function PlanningTopBar({ title = 'Procurement Planning', onNavigate }: PlanningTopBarProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [openMenu, setOpenMenu] = useState<'apps' | 'profile' | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const organizationLabel = user?.organization || (user?.accountType === 'ADMIN' ? 'Platform admin tools' : 'ProcureX account tools');

  useEffect(() => {
    function handleDocumentClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }

    document.addEventListener('pointerdown', handleDocumentClick);
    return () => document.removeEventListener('pointerdown', handleDocumentClick);
  }, []);

  function navigate(pageKey: string) {
    setOpenMenu(null);
    onNavigate(pageKey);
  }

  function logout() {
    setOpenMenu(null);
    dispatch(signOut());
    onNavigate('sign-in');
  }

  return (
    <header className="app-topbar" ref={headerRef}>
      <div className="app-topbar-left">
        <button
          className="app-brand-button"
          type="button"
          data-navigate="workspace-dashboard"
          onClick={() => navigate('workspace-dashboard')}
        >
          <span className="platform-logo">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <span>{title}</span>
        </button>
      </div>

      <div className="app-topbar-actions">
        <button
          className="icon-menu-btn"
          type="button"
          data-app-menu-toggle
          aria-label="Open apps"
          aria-expanded={openMenu === 'apps'}
          onClick={() => setOpenMenu((current) => (current === 'apps' ? null : 'apps'))}
        >
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </button>
        <div className="profile-menu-wrap">
          <button
            className="profile-button"
            type="button"
            data-profile-menu-toggle
            aria-label="Open profile menu"
            aria-expanded={openMenu === 'profile'}
          onClick={() => setOpenMenu((current) => (current === 'profile' ? null : 'profile'))}
          >
            <span>{initials(user?.displayName)}</span>
          </button>
        </div>
      </div>

      <div className={`app-drawer-menu${openMenu === 'apps' ? ' open' : ''}`} data-app-menu>
        <div className="app-menu-header">
          <div className="app-menu-brand">
            <span className="platform-logo platform-logo-sm">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <strong>ProcureX Apps</strong>
          </div>
          <span>{organizationLabel}</span>
        </div>
        {appMenuItems.map((item) => (
          <button
            key={item.page}
            className={`app-menu-card ${item.className}`}
            type="button"
            data-navigate={item.page}
            onClick={() => navigate(item.page)}
          >
            <AppMenuIcon kind={item.icon} />
            <span>
              <strong>{item.title}</strong>
              <em>{item.description}</em>
            </span>
          </button>
        ))}
      </div>

      <div className={`profile-menu${openMenu === 'profile' ? ' open' : ''}`} data-profile-menu>
        <button type="button" data-navigate="account-profile" onClick={() => navigate('account-profile')}>
          Profile
        </button>
        <button type="button" data-navigate="communication-center" onClick={() => navigate('communication-center')}>
          Messages
        </button>
        <button type="button">Help</button>
        <button type="button">Language</button>
        <button type="button" data-navigate="sign-in" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
