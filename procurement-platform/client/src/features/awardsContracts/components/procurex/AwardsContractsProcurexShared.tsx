import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import type { AwardQueueId, BadgeTone } from '../../types';
import { awardQueueLabels } from '../../fixtures';

type FrameProps = {
  pageKey: string;
  children: ReactNode;
};

type SidebarProps = {
  title: string;
  subtitle: string;
  activeQueue?: AwardQueueId;
  extraItems?: ReactNode;
};

const routeByPage: Record<string, string> = {
  'workspace-dashboard': '/dashboard',
  'account-profile': '/identity/profile',
  'communication-center': '/communication',
  'sign-in': '/sign-in',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'award-recommendation': '/awards-contracts/recommendation',
  'award-response': '/awards-contracts/award-response',
  'contract-negotiation': '/awards-contracts/negotiation',
  'post-award-tracking': '/awards-contracts/post-award',
  'records-history': '/records'
};

const appMenuItems = [
  ['app-menu-iam', 'account-profile', 'Registration and Verification', 'Account and identity verification'],
  ['app-menu-procurement', 'tender-planning', 'Procurement Planning', 'APP, SPP, budgets, approvals'],
  ['app-menu-procurement', 'marketplace', 'Procurement', 'Marketplace, create tender, bid'],
  ['app-menu-communication', 'communication-center', 'Communication Center', 'Messages, clarifications, alerts'],
  ['app-menu-evaluation', 'bid-evaluation', 'Evaluation', 'Evaluate bids on your tenders'],
  ['app-menu-awarding', 'awarding-contracts', 'Awarding and Contract', 'Awards, negotiations, signatures'],
  ['app-menu-contracts', 'records-history', 'Records and History', 'Past tenders, bids, awards']
] as const;

function initials(name?: string | null) {
  const parts = String(name || 'ProcureX user')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] || 'P').toUpperCase() + (parts.length > 1 ? (parts[1]?.[0] || '').toUpperCase() : '');
}

export function routeWithSearch(path: string, routeSearch = '') {
  if (!routeSearch) return path;
  return `${path}?${routeSearch.replace(/^\?/, '')}`;
}

export function formatMoney(value: number, currency = 'TZS') {
  return `${currency} ${value.toLocaleString()}`;
}

export function badgeTone(value: string): BadgeTone {
  if (/blocked|closed|declined|high|error|failed/i.test(value)) return 'error';
  if (/pending|awaiting|draft|review|warning|invoice|change|required/i.test(value)) return 'warning';
  if (/complete|completed|accepted|approved|ready|paid|success|signed|agreed/i.test(value)) return 'success';
  return 'info';
}

export function StatusBadge({ value, tone }: { value: string; tone?: BadgeTone }) {
  const resolvedTone = tone ?? badgeTone(value);
  return (
    <span className={`badge badge-${resolvedTone} `} aria-label={`Status: ${value}`}>
      {value}
    </span>
  );
}

export function ProcurexAwardFrame({ pageKey, children }: FrameProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [openMenu, setOpenMenu] = useState<'apps' | 'profile' | null>(null);
  const organizationLabel = user?.organization || 'ProcureX account tools';

  useEffect(() => {
    document.body.dataset.page = pageKey;
    document.body.dataset.procurexReactPage = 'true';
    return () => {
      delete document.body.dataset.procurexReactPage;
    };
  }, [pageKey]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const menuButton = target.closest<HTMLElement>('[data-app-menu-toggle], [data-profile-menu-toggle]');
    const navTarget = target.closest<HTMLElement>('[data-navigate]');

    if (menuButton) {
      event.preventDefault();
      setOpenMenu((current) => {
        const next = menuButton.hasAttribute('data-app-menu-toggle') ? 'apps' : 'profile';
        return current === next ? null : next;
      });
      return;
    }

    if (navTarget) {
      event.preventDefault();
      const page = navTarget.getAttribute('data-navigate') || 'workspace-dashboard';
      const routeSearch = navTarget.getAttribute('data-route-search') || '';
      if (page === 'sign-in') dispatch(signOut());
      navigate(routeWithSearch(routeByPage[page] || '/', routeSearch));
    }
  }

  return (
    <div
      id="page-content"
      role="main"
      tabIndex={-1}
      className="procurex-react-page"
      data-procurex-route-path={typeof window === 'undefined' ? '' : window.location.pathname}
      data-procurex-route-search={typeof window === 'undefined' ? '' : window.location.search}
      onClick={handleClick}
    >
      <header className="app-topbar">
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" data-navigate="workspace-dashboard">
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>Awarding and Contract</span>
          </button>
        </div>

        <div className="app-topbar-actions">
          <button
            className="icon-menu-btn"
            type="button"
            data-app-menu-toggle
            aria-label="Open apps"
            aria-expanded={openMenu === 'apps'}
          >
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} />
            ))}
          </button>
          <div className="profile-menu-wrap">
            <button
              className="profile-button"
              type="button"
              data-profile-menu-toggle
              aria-label="Open profile menu"
              aria-expanded={openMenu === 'profile'}
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
          {appMenuItems.map(([className, nav, title, note]) => (
            <button className={`app-menu-card ${className}`} type="button" data-navigate={nav} key={nav}>
              <span className="app-menu-icon">
                <svg
                  className="app-menu-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                  <path d="M8 16h5" />
                </svg>
              </span>
              <span>
                <strong>{title}</strong>
                <em>{note}</em>
              </span>
            </button>
          ))}
        </div>

        <div className={`profile-menu${openMenu === 'profile' ? ' open' : ''}`} data-profile-menu>
          <button type="button" data-navigate="account-profile">Profile</button>
          <button type="button" data-navigate="communication-center">Messages</button>
          <button type="button">Help</button>
          <button type="button">Language</button>
          <button type="button" data-navigate="sign-in">Logout</button>
        </div>
      </header>
      {children}
    </div>
  );
}

export function AwardSidebar({ title, subtitle, activeQueue = 'my-urgent-actions', extraItems }: SidebarProps) {
  return (
    <aside className="sidebar evaluation-sidebar">
      <div className="evaluation-sidebar-head">
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
      <ul className="sidebar-nav">
        {(Object.keys(awardQueueLabels) as AwardQueueId[]).map((queue) => (
          <li key={queue}>
            <a
              href="#"
              data-awarding-tab-jump={queue}
              data-navigate="awarding-contracts"
              data-route-search={`queue=${queue}`}
              className={queue === activeQueue ? 'active' : ''}
            >
              {awardQueueLabels[queue]}
            </a>
          </li>
        ))}
        {extraItems}
        <li><a href="#" data-navigate="workspace-dashboard">Workspace Dashboard</a></li>
        <li><a href="#" data-navigate="sign-in">Logout</a></li>
      </ul>
    </aside>
  );
}

export function AwardHero({
  kicker,
  title,
  copy,
  stats,
  children
}: {
  kicker: string;
  title: string;
  copy: string;
  stats: Array<{ value: string | number; label: string }>;
  children?: ReactNode;
}) {
  return (
    <section className="procurement-hero evaluation-hero-panel award-hero-panel">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {children}
      </div>
      <div className="evaluation-hero-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TopSummary({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <section className="evaluation-top-summary">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          {typeof item.value === 'string' ? <strong>{item.value}</strong> : item.value}
        </div>
      ))}
    </section>
  );
}

export function SimpleTable({
  headers,
  children,
  className = ''
}: {
  headers: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`data-table evaluation-table-scroll ${className}`}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
