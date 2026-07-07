import { resolveAppIconAsset } from './appIconAssets';

export type PlatformAppPageKey =
  | 'account-profile'
  | 'tender-planning'
  | 'marketplace'
  | 'communication-center'
  | 'bid-evaluation'
  | 'awarding-contracts'
  | 'records-history';

export type PlatformAppIconKind = 'iam' | 'planning' | 'procurement' | 'communication' | 'evaluation' | 'awarding' | 'records';

type PlatformAppItem = {
  className: string;
  page: PlatformAppPageKey;
  icon: PlatformAppIconKind;
  title: string;
  description: string;
};

type PlatformAppsButtonProps = {
  expanded: boolean;
  onClick: () => void;
  ariaLabel?: string;
};

type PlatformAppsDrawerProps = {
  open: boolean;
  organizationLabel: string;
  onSelect: (pageKey: PlatformAppPageKey) => void;
};

export const platformAppItems = [
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
] as const satisfies readonly PlatformAppItem[];

export const platformAppRoutes: Record<PlatformAppPageKey, string> = {
  'account-profile': '/identity/profile',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'communication-center': '/communication',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'records-history': '/records'
};

export function resolvePlatformAppRoute(pageKey: PlatformAppPageKey) {
  return platformAppRoutes[pageKey];
}

export function PlatformAppsButton({ expanded, onClick, ariaLabel = 'Open apps' }: PlatformAppsButtonProps) {
  return (
    <button
      className="icon-menu-btn"
      type="button"
      data-app-menu-toggle
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onClick={onClick}
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
  );
}

export function PlatformAppsDrawer({ open, organizationLabel, onSelect }: PlatformAppsDrawerProps) {
  return (
    <div className={`app-drawer-menu${open ? ' open' : ''}`} data-app-menu aria-hidden={!open}>
      <div className="app-menu-header">
        <div className="app-menu-brand">
          <span className="platform-logo platform-logo-sm">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <strong>ProcureX Apps</strong>
        </div>
        <span>{organizationLabel}</span>
      </div>
      {platformAppItems.map((item) => (
        <button
          key={item.page}
          className={`app-menu-card ${item.className}`}
          type="button"
          data-navigate={item.page}
          onClick={() => onSelect(item.page)}
        >
          <PlatformAppIcon kind={item.icon} />
          <span>
            <strong>{item.title}</strong>
            <em>{item.description}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

export function PlatformAppIcon({ kind }: { kind: PlatformAppIconKind }) {
  const imageSrc = resolveAppIconAsset(kind);

  if (imageSrc) {
    return (
      <span className="app-menu-icon app-menu-icon-image">
        <img className="app-menu-image" src={imageSrc} alt="" aria-hidden="true" />
      </span>
    );
  }

  return (
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
        {kind === 'iam' ? (
          <>
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
            <path d="M16 11l2 2 4-4" />
          </>
        ) : null}
        {kind === 'planning' ? (
          <>
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8" />
            <path d="M8 12h8" />
            <path d="M8 16h5" />
          </>
        ) : null}
        {kind === 'procurement' ? (
          <>
            <path d="M3 9h18l-2-5H5z" />
            <path d="M5 9v11h14V9" />
            <path d="M9 13h6" />
            <path d="M9 17h4" />
          </>
        ) : null}
        {kind === 'communication' ? (
          <>
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </>
        ) : null}
        {kind === 'evaluation' ? (
          <>
            <path d="M9 11l2 2 4-4" />
            <path d="M8 4h8" />
            <path d="M8 20h8" />
            <path d="M5 7h14v10H5z" />
          </>
        ) : null}
        {kind === 'awarding' ? (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5" />
            <path d="M10.5 8l1 1 2-2" />
          </>
        ) : null}
        {kind === 'records' ? (
          <>
            <path d="M8 3h8l3 3v15H5V3z" />
            <path d="M15 3v4h4" />
            <path d="M8 12h8" />
            <path d="M8 16h6" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
