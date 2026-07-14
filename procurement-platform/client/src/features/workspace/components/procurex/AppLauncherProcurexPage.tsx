import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AppMenuIcon } from '@/shared/components/procurex/PlatformAppsDrawer';
import { WorkspaceTopBar } from '@/shared/components/procurex/WorkspaceTopBar';

type LauncherRouteKey =
  | 'account-profile'
  | 'marketplace'
  | 'communication-center'
  | 'bid-evaluation'
  | 'awarding-contracts'
  | 'records-history'
  | 'workspace-dashboard'
  | 'sign-in';

const pageToRoute: Record<LauncherRouteKey, string> = {
  'account-profile': '/identity/profile',
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
    badgeKey: 'launcher.badges.verified',
    titleKey: 'platformApps.items.accountProfile.title',
    descriptionKey: 'launcher.apps.accountProfile.description'
  },
  {
    className: 'app-tone-procurement',
    page: 'marketplace',
    icon: 'procurement',
    badgeKey: 'launcher.badges.marketplace',
    titleKey: 'platformApps.items.procurement.title',
    descriptionKey: 'launcher.apps.procurement.description'
  },
  {
    className: 'app-tone-communication',
    page: 'communication-center',
    icon: 'communication',
    badgeKey: 'launcher.badges.messages',
    titleKey: 'platformApps.items.communication.title',
    descriptionKey: 'launcher.apps.communication.description'
  },
  {
    className: 'app-tone-evaluation',
    page: 'bid-evaluation',
    icon: 'evaluation',
    badgeKey: 'launcher.badges.later',
    titleKey: 'platformApps.items.evaluation.title',
    descriptionKey: 'launcher.apps.evaluation.description'
  },
  {
    className: 'app-tone-awarding',
    page: 'awarding-contracts',
    icon: 'awarding',
    badgeKey: 'launcher.badges.later',
    titleKey: 'platformApps.items.awarding.title',
    descriptionKey: 'launcher.apps.awarding.description'
  },
  {
    className: 'app-tone-contracts',
    page: 'records-history',
    icon: 'records',
    badgeKey: 'launcher.badges.archive',
    titleKey: 'platformApps.items.records.title',
    descriptionKey: 'launcher.apps.records.description'
  }
] as const;

export function AppLauncherProcurexPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const displayName = user?.displayName || t('accountMenu.procurexUser');
  const organization = user?.organization || t('workspaceDashboard.yourOrganization');

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
      <WorkspaceTopBar title={t('pages.launcher.title')} onNavigate={navigateToPage} />
      <div className="workspace-home launcher-intro-page">
        <main className="workspace-shell launcher-shell">
          <section className="launcher-intro-hero">
            <div>
              <span className="section-kicker">{t('launcher.kicker')}</span>
              <h1>{t('launcher.title', { name: displayName })}</h1>
              <p>{t('launcher.body')}</p>
            </div>
            <div className="launcher-intro-card">
              <span className="badge badge-success">{user?.verificationStatus === 'APPROVED' ? t('status.verified') : t('launcher.verificationNeeded')}</span>
              <strong>{organization}</strong>
              <span>{t('launcher.noActivity')}</span>
              <button className="btn btn-primary" type="button" onClick={() => navigateToPage('workspace-dashboard')}>
                {t('launcher.continueToDashboard')}
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
                  <span className="badge badge-info">{t(app.badgeKey)}</span>
                </div>
                <h2>{t(app.titleKey)}</h2>
                <p>{t(app.descriptionKey)}</p>
                <button className="btn btn-primary" type="button" onClick={() => navigateToPage(app.page)}>
                  {t('actions.open')}
                </button>
              </article>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
