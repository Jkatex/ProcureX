import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AppMenuIcon } from '@/features/tenderPlanning/components/procurex/icons';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';

type LauncherRouteKey =
  | 'account-profile'
  | 'tender-planning'
  | 'marketplace'
  | 'communication-center'
  | 'bid-evaluation'
  | 'awarding-contracts'
  | 'records-history'
  | 'workspace-dashboard'
  | 'sign-in';

const pageToRoute: Record<LauncherRouteKey, string> = {
  'account-profile': '/identity/profile',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'communication-center': '/communication',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'records-history': '/records',
  'workspace-dashboard': '/dashboard',
  'sign-in': '/sign-in'
};

const apps = [
  {
    className: 'app-tone-iam',
    page: 'account-profile',
    icon: 'iam',
    badge: 'Verified',
    title: 'Registration and Verification',
    description: 'Review identity, profile, and organization details.'
  },
  {
    className: 'app-tone-procurement',
    page: 'tender-planning',
    icon: 'planning',
    badge: 'Start here',
    title: 'Procurement Planning',
    description: 'Create plan lines before preparing tenders.'
  },
  {
    className: 'app-tone-procurement',
    page: 'marketplace',
    icon: 'procurement',
    badge: 'Marketplace',
    title: 'Procurement',
    description: 'Browse opportunities or create your first tender.'
  },
  {
    className: 'app-tone-communication',
    page: 'communication-center',
    icon: 'communication',
    badge: 'Messages',
    title: 'Communication Center',
    description: 'Manage clarifications, notices, and platform messages.'
  },
  {
    className: 'app-tone-evaluation',
    page: 'bid-evaluation',
    icon: 'evaluation',
    badge: 'Later',
    title: 'Evaluation',
    description: 'Evaluate bids after tenders receive submissions.'
  },
  {
    className: 'app-tone-awarding',
    page: 'awarding-contracts',
    icon: 'awarding',
    badge: 'Later',
    title: 'Awarding and Contract',
    description: 'Handle awards, contracts, and post-award tracking.'
  },
  {
    className: 'app-tone-contracts',
    page: 'records-history',
    icon: 'records',
    badge: 'Archive',
    title: 'Records and History',
    description: 'Review generated records once activity begins.'
  }
] as const;

export function AppLauncherProcurexPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const displayName = user?.displayName || 'ProcureX user';
  const organization = user?.organization || 'Your organization';

  useEffect(() => {
    const previousPage = document.body.dataset.page;
    document.body.dataset.page = 'app-launcher';
    document.body.dataset.procurexReactPage = 'true';

    return () => {
      if (previousPage) document.body.dataset.page = previousPage;
      else delete document.body.dataset.page;
      delete document.body.dataset.procurexReactPage;
    };
  }, []);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey as LauncherRouteKey] || '/dashboard');
  }

  return (
    <>
      <PlanningTopBar title="Apps" onNavigate={navigateToPage} />
      <div className="workspace-home launcher-intro-page">
        <main className="workspace-shell launcher-shell">
          <section className="launcher-intro-hero">
            <div>
              <span className="section-kicker">Welcome to ProcureX</span>
              <h1>{displayName}, choose where to start.</h1>
              <p>
                Your workspace is ready and starts clean. Procurement activity, messages, records, and audit trails will
                appear after this account begins real platform work.
              </p>
            </div>
            <div className="launcher-intro-card">
              <span className="badge badge-success">{user?.verificationStatus === 'APPROVED' ? 'Verified' : 'Verification needed'}</span>
              <strong>{organization}</strong>
              <span>No activity yet</span>
              <button className="btn btn-primary" type="button" onClick={() => navigateToPage('workspace-dashboard')}>
                Continue to Dashboard
              </button>
            </div>
          </section>

          <section className="launcher-app-grid">
            {apps.map((app) => (
              <article className={`launcher-app-card ${app.className}`} key={app.page}>
                <div className="app-tile-head">
                  <span className="app-icon">
                    <AppMenuIcon kind={app.icon} />
                  </span>
                  <span className="badge badge-info">{app.badge}</span>
                </div>
                <h2>{app.title}</h2>
                <p>{app.description}</p>
                <button className="btn btn-primary" type="button" onClick={() => navigateToPage(app.page)}>
                  Open
                </button>
              </article>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
