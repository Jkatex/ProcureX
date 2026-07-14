import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AccountMenu } from '@/shared/components/AccountMenu';
import {
  PlatformAppsButton,
  PlatformAppsDrawer,
  resolvePlatformAppRoute,
  type PlatformAppPageKey
} from '@/shared/components/procurex/PlatformAppsDrawer';
import type { AwardQueueId, BadgeTone, LifecycleAction } from '../../types';
import { awardQueueLabels } from '../../fixtures';
import { confirmAwardContractNavigation } from './AwardContractFlow';

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
  marketplace: '/procurement/marketplace',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'award-recommendation': '/awards-contracts/recommendation',
  'award-response': '/awards-contracts/award-response',
  'contract-negotiation': '/awards-contracts/negotiation',
  'sample-procurement': '/awards-contracts/samples',
  'post-award-tracking': '/post-award',
  'records-history': '/records'
};

export function routeWithSearch(path: string, routeSearch = '') {
  if (!routeSearch) return path;
  return `${path}?${routeSearch.replace(/^\?/, '')}`;
}

export function formatMoney(value: number, currency = 'TZS') {
  return `${currency} ${value.toLocaleString()}`;
}

const workflowStatusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  RETURNED: 'Returned for review',
  SENT: 'Sent',
  FAILED: 'Failed',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  PENDING: 'Pending',
  PENDING_RESPONSE: 'Awaiting supplier response',
  REQUEST_CLARIFICATION: 'Clarification requested',
  CLARIFICATION_REQUESTED: 'Clarification requested',
  CONTRACT_FORMATION: 'Contract setup and signing',
  NEGOTIATION: 'In negotiation',
  SIGNATURE_PENDING: 'Awaiting signatures',
  SIGNED: 'Signed',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  TERMINATION_REVIEW: 'Termination review',
  TERMINATED: 'Terminated',
  BLOCKED: 'Blocked',
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  REVIEW: 'In review',
  SUBMITTED: 'Submitted',
  MATCHED: 'Matched',
  PAID: 'Paid',
  WAIVED: 'Waived',
  EXPIRED: 'Expired'
};

export function humanizeWorkflowStatus(value?: string | null) {
  if (!value) return 'Not set';
  const normalized = String(value).trim();
  const mapped = workflowStatusLabels[normalized.toUpperCase()];
  if (mapped) return mapped;
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function lifecycleActionMatches(row: LifecycleAction, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.title,
    row.reference,
    row.noticeReference,
    row.tenderId,
    row.roleContext,
    row.sourceType,
    row.otherParty,
    row.currentStage,
    row.requiredAction,
    row.status,
    row.riskLevel
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

export type WorkflowSection<TId extends string> = {
  id: TId;
  label: string;
  description: string;
  count?: number;
};

export function recordText(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key];
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

export function shortId(value: string) {
  if (!value) return '';
  return value.length <= 12 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function recordTitle(record: Record<string, unknown>) {
  return recordText(
    record,
    'title',
    recordText(record, 'subject', recordText(record, 'reference', recordText(record, 'inspectionNo', recordText(record, 'certificateNo', recordText(record, 'confirmationReference', recordText(record, 'commitmentNo', recordText(record, 'scoreType', recordText(record, 'forecastType', recordText(record, 'routeKey', recordText(record, 'notificationType', recordText(record, 'budgetCode', recordText(record, 'type', 'Record'))))))))))))
  );
}

function recordSearchText(record: Record<string, unknown>) {
  const keys = [
    'title',
    'subject',
    'reference',
    'noticeReference',
    'inspectionNo',
    'certificateNo',
    'confirmationReference',
    'commitmentNo',
    'documentType',
    'type',
    'status',
    'riskLevel',
    'note',
    'summary',
    'amount',
    'paidAmount',
    'score',
    'probability',
    'currency',
    'dueDate',
    'createdAt'
  ];
  return keys.map((key) => recordText(record, key)).filter(Boolean).join(' ').toLowerCase();
}

export function badgeTone(value: string): BadgeTone {
  if (/blocked|closed|declined|high|error|failed/i.test(value)) return 'error';
  if (/pending|awaiting|draft|review|warning|invoice|change|required/i.test(value)) return 'warning';
  if (/complete|completed|accepted|approved|ready|paid|success|signed|agreed/i.test(value)) return 'success';
  return 'info';
}

export function StatusBadge({ value, tone }: { value: string; tone?: BadgeTone }) {
  const displayValue = humanizeWorkflowStatus(value);
  const resolvedTone = tone ?? badgeTone(displayValue);
  return (
    <span className={`badge badge-${resolvedTone} `} aria-label={`Status: ${displayValue}`}>
      {displayValue}
    </span>
  );
}

export function ProcurexAwardFrame({ pageKey, children }: FrameProps) {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [appsOpen, setAppsOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const organizationLabel = user?.organization || 'ProcureX account tools';

  useEffect(() => {
    document.body.dataset.page = pageKey;
    document.body.dataset.procurexReactPage = 'true';
    return () => {
      delete document.body.dataset.procurexReactPage;
    };
  }, [pageKey]);

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

  function selectPlatformApp(pageKey: PlatformAppPageKey) {
    setAppsOpen(false);
    navigate(resolvePlatformAppRoute(pageKey));
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const navTarget = target.closest<HTMLElement>('[data-navigate]');

    if (navTarget) {
      if (navTarget.closest('[data-app-menu]')) return;
      event.preventDefault();
      if (!confirmAwardContractNavigation()) return;
      const page = navTarget.getAttribute('data-navigate') || 'workspace-dashboard';
      const routeSearch = navTarget.getAttribute('data-route-search') || '';
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
      <header className="app-topbar" ref={headerRef}>
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" data-navigate="workspace-dashboard">
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>Awarding and Contract</span>
          </button>
        </div>

        <div className="app-topbar-actions">
          <PlatformAppsButton expanded={appsOpen} onClick={() => setAppsOpen((current) => !current)} />
          <div className="profile-menu-wrap">
            <AccountMenu buttonClassName="profile-button" />
          </div>
        </div>

        <PlatformAppsDrawer open={appsOpen} organizationLabel={organizationLabel} onSelect={selectPlatformApp} />
      </header>
      {children}
    </div>
  );
}

export function AwardSidebar({ title, subtitle, activeQueue = 'awarding-in-progress', extraItems }: SidebarProps) {
  return (
    <aside className="sidebar evaluation-sidebar award-floating-sidebar">
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

export function WorkflowSectionTabs<TId extends string>({
  sections,
  active,
  onSelect,
  label = 'Workflow sections'
}: {
  sections: Array<WorkflowSection<TId>>;
  active: TId;
  onSelect: (id: TId) => void;
  label?: string;
}) {
  return (
    <div className="award-workflow-tabs" role="tablist" aria-label={label}>
      {sections.map((section) => (
        <button
          className={`award-workflow-tab${active === section.id ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-label={section.label}
          aria-selected={active === section.id}
          onClick={() => onSelect(section.id)}
          key={section.id}
        >
          <strong>{section.label}</strong>
          <span>{section.description}</span>
          {section.count !== undefined ? <em>{section.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function ActionWorkspace({
  kicker,
  title,
  badge,
  context,
  children
}: {
  kicker: string;
  title: string;
  badge: string;
  context: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="award-action-workspace">
      <section className="award-workspace-card">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <StatusBadge value={badge} />
        </div>
        {context}
      </section>
      <div className="award-action-stack">{children}</div>
    </div>
  );
}

export function RecordRegister({
  title,
  records,
  headers = ['Record', 'Status', 'Detail', 'Created'],
  emptyMessage
}: {
  title: string;
  records: Array<Record<string, unknown>>;
  headers?: string[];
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState('');
  const filteredRecords = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => recordSearchText(record).includes(normalized));
  }, [records, search]);

  return (
    <div className="award-record-register-wrap">
      {records.length > 0 ? (
        <div className="queue-toolbar award-register-toolbar">
          <label>
            Search
            <input
              className="form-input"
              type="search"
              aria-label={`Search ${title}`}
              placeholder="Reference, status, note, amount, or owner"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span>Showing {filteredRecords.length} of {records.length}</span>
        </div>
      ) : null}
      <SimpleTable headers={headers} className="award-record-register">
        {records.length === 0 ? (
          <tr><td colSpan={headers.length}><div className="scope-empty award-register-empty">{emptyMessage ?? `No ${title.toLowerCase()} records yet.`}</div></td></tr>
        ) : filteredRecords.length === 0 ? (
          <tr><td colSpan={headers.length}><div className="scope-empty award-register-empty">No {title.toLowerCase()} records match the current search.</div></td></tr>
        ) : filteredRecords.map((record, index) => (
          <tr key={recordText(record, 'id', `${recordTitle(record)}-${recordText(record, 'createdAt')}-${index}`)}>
            <td>
              <div className="award-record-title">
                <strong>{recordTitle(record)}</strong>
                {recordText(record, 'reference') ? <span>{recordText(record, 'reference')}</span> : null}
              </div>
            </td>
            <td><StatusBadge value={recordText(record, 'status', recordText(record, 'riskLevel', 'Recorded'))} /></td>
            <td>{recordText(record, 'note', recordText(record, 'summary', recordText(record, 'amount', recordText(record, 'paidAmount', recordText(record, 'score', recordText(record, 'probability', '-'))))))}</td>
            <td>{recordText(record, 'createdAt') ? new Date(recordText(record, 'createdAt')).toLocaleDateString() : '-'}</td>
          </tr>
        ))}
      </SimpleTable>
    </div>
  );
}

export function RegisterCard({
  kicker,
  title,
  records,
  countLabel = 'records'
}: {
  kicker: string;
  title: string;
  records: Array<Record<string, unknown>>;
  countLabel?: string;
}) {
  return (
    <section className="award-register-card">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge value={`${records.length} ${countLabel}`} />
      </div>
      <RecordRegister title={title} records={records} />
    </section>
  );
}

export function RemoteStatePanel({
  kicker = 'Workspace status',
  title,
  message,
  status = 'Attention',
  actionLabel,
  onAction
}: {
  kicker?: string;
  title: string;
  message: string;
  status?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="procurement-panel evaluation-panel award-remote-state-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge value={status} />
      </div>
      <div className="scope-empty">{message}</div>
      {onAction ? (
        <div className="inline-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onAction}>
            {actionLabel ?? 'Retry'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function LifecycleActionCard({
  row,
  actionLabel,
  onAction
}: {
  row: LifecycleAction;
  actionLabel?: string;
  onAction: (row: LifecycleAction) => void;
}) {
  const disabled = row.nextAction?.canAct === false;
  return (
    <article className="award-lifecycle-card">
      <div className="award-lifecycle-card-head">
        <div>
          <strong>{row.title}</strong>
          <span>{row.reference ?? row.noticeReference ?? row.otherParty}</span>
        </div>
        <StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} />
      </div>
      <div className="award-lifecycle-card-meta">
        <span><em>Stage</em>{row.currentStage}</span>
        <span><em>Status</em><StatusBadge value={row.status} /></span>
        <span><em>Risk</em><StatusBadge value={row.riskLevel} /></span>
        <span><em>Due</em>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'Not dated'}</span>
        <span><em>Value</em>{row.amount === null ? 'Not priced' : formatMoney(row.amount, row.currency)}</span>
      </div>
      <div className="award-lifecycle-card-action">
        <span>{row.requiredAction}</span>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={disabled}
          title={row.nextAction?.disabledReason ?? row.requiredAction}
          onClick={() => onAction(row)}
        >
          {actionLabel ?? row.nextAction?.label ?? row.requiredAction}
        </button>
      </div>
    </article>
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
