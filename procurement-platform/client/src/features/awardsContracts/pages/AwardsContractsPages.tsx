import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { KpiCard, PageHeader, StatusBadge } from '@/shared/components';

function EmptyAwardsPanel({ title, backTo = '/awards-contracts' }: { title: string; backTo?: string }) {
  return (
    <article className="px-card">
      <StatusBadge value="No records" />
      <h3>{title}</h3>
      <p>No awarding or contract records are available yet.</p>
      <Button component={Link} to={backTo} variant="outlined">Back</Button>
    </article>
  );
}

export function AwardingContractsPage() {
  const { t } = useTranslation();
  const draftSaved = useAppSelector((state) => state.awardsContracts.draftSaved);
  return (
    <section>
      <PageHeader title={t('pages.awards.title')} subtitle={t('pages.awards.subtitle')} />
      <div className="px-kpi-grid">
        <KpiCard label="Award decisions" value="0" note="No records" />
        <KpiCard label="Negotiations" value="0" note="No records" />
        <KpiCard label="Contracts" value="0" note="No records" />
        <KpiCard label="Draft state" value={draftSaved ? 'Saved' : 'Open'} note="Local workspace" />
      </div>
      <div className="px-grid">
        {[
          ['/awards-contracts/recommendation', t('pages.awardRecommendation.title')],
          ['/awards-contracts/negotiation', t('pages.contractNegotiation.title')],
          ['/awards-contracts/post-award', t('pages.postAward.title')]
        ].map(([to, label]) => (
          <article className="px-card" key={to}>
            <StatusBadge value="No records" />
            <h3>{label}</h3>
            <p>No data has been created for this workspace yet.</p>
            <Button component={Link} to={to} variant="outlined">{t('actions.open')}</Button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AwardRecommendationPage() {
  const { t } = useTranslation();
  return (
    <section>
      <PageHeader title={t('pages.awardRecommendation.title')} subtitle={t('pages.awardRecommendation.subtitle')} />
      <EmptyAwardsPanel title="No award recommendation records" />
    </section>
  );
}

export function ContractNegotiationPage() {
  const { t } = useTranslation();
  return (
    <section>
      <PageHeader title={t('pages.contractNegotiation.title')} subtitle={t('pages.contractNegotiation.subtitle')} />
      <EmptyAwardsPanel title="No contract negotiation records" />
    </section>
  );
}

export function PostAwardTrackingPage() {
  const { t } = useTranslation();
  return (
    <section>
      <PageHeader title={t('pages.postAward.title')} subtitle={t('pages.postAward.subtitle')} />
      <EmptyAwardsPanel title="No post-award tracking records" />
    </section>
  );
}
