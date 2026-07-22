/* Connects workspace route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/shared/components';
import { DashboardCommandCenter } from '../components/DashboardCommandCenter';

export function AppLauncherPage() {
  const { t } = useTranslation();
  const apps = [
    ['/identity/profile', 'nav.identity'],
    ['/procurement/marketplace', 'nav.procurement'],
    ['/bidding', 'nav.bidding'],
    ['/evaluation', 'nav.evaluation'],
    ['/awards-contracts', 'nav.awards'],
    ['/records', 'nav.records']
  ];

  return (
    <section>
      <PageHeader title={t('pages.launcher.title')} subtitle={t('pages.launcher.subtitle')} />
      <div className="px-grid">
        {apps.map(([to, key]) => (
          <article className="px-card" key={to}>
            <h3>{t(key)}</h3>
            <p>{t('pages.dashboard.subtitle')}</p>
            <Button component={Link} to={to} variant="outlined">
              {t('actions.open')}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function WorkspaceDashboardPage() {
  return <DashboardCommandCenter />;
}
