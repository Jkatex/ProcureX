import { Button, LinearProgress, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { KpiCard, PageHeader, StatusBadge } from '@/shared/components';
import { nextVerificationStep } from '../slice';

export function IdentityVerificationPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const step = useAppSelector((state) => state.identity.verificationStep);

  return (
    <section>
      <PageHeader title={t('pages.identity.title')} subtitle={t('pages.identity.subtitle')} />
      <div className="px-grid two">
        <article className="px-card">
          <StatusBadge value={`Step ${step} of 4`} />
          <h3>Registry verification</h3>
          <div className="px-form-grid">
            <TextField label="TIN" placeholder="Enter TIN" />
            <TextField label="BRELA registration" placeholder="Enter BRELA registration" />
            <TextField label="Authorized signatory" placeholder="Enter authorized signatory" />
            <TextField label="Capability request" placeholder="Enter requested capabilities" />
          </div>
          <div className="px-actions">
            <Button variant="contained" onClick={() => dispatch(nextVerificationStep())}>
              {t('actions.continue')}
            </Button>
            <Button component={Link} to="/identity/profile" variant="outlined">
              {t('actions.review')}
            </Button>
          </div>
        </article>
        <div className="px-hero-media">
          <img src="/assets/page-visuals/auth-verification.jpg" alt="" />
        </div>
      </div>
    </section>
  );
}

export function VerificationStatusPage() {
  const { t } = useTranslation();
  const completion = useAppSelector((state) => state.identity.profileCompletion);
  const user = useAppSelector((state) => state.auth.user);

  return (
    <section>
      <PageHeader title={t('pages.profile.title')} subtitle={t('pages.profile.subtitle')} />
      <div className="px-kpi-grid">
        <KpiCard label="Verification" value={user?.verificationStatus ?? 'PENDING'} note="TRA/BRELA profile" />
        <KpiCard label="Capabilities" value={user?.capabilities.join(' + ') || 'None'} note="Organization permissions" />
        <KpiCard label="Language" value={t('english')} note="User preference" />
        <KpiCard label="Completion" value={`${completion}%`} note="Profile readiness" />
      </div>
      <article className="px-card">
        <LinearProgress variant="determinate" value={completion} />
        <p>{t('pages.identity.subtitle')}</p>
        <Button component={Link} to="/identity/verification" variant="contained">
          {t('actions.review')}
        </Button>
      </article>
    </section>
  );
}
