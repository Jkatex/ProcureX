/* Connects public route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DataTable, PageHeader, StatusBadge } from '@/shared/components';
import { tenders } from '@/shared/data/fixtures';
import type { Tender } from '@/shared/types/domain';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat';

function PublicHero() {
  const { t } = useTranslation();

  return (
    <section className="px-hero">
      <div>
        <h1>{t('pages.welcome.title')}</h1>
        <p>{t('pages.welcome.subtitle')}</p>
        <div className="px-actions">
          <Button component={Link} to="/register" variant="contained">
            {t('actions.getStarted')}
          </Button>
          <Button component={Link} to="/guest-marketplace" variant="outlined">
            {t('actions.browse')}
          </Button>
        </div>
      </div>
      <div className="px-hero-media">
        <img src="/assets/welcome/procurement-meeting.webp" alt="" />
      </div>
    </section>
  );
}

export function WelcomePage() {
  const { t } = useTranslation();
  const cards = ['nav.procurement', 'nav.bidding', 'nav.evaluation', 'nav.awards', 'nav.communication', 'nav.records'];

  return (
    <>
      <PublicHero />
      <section className="px-band">
        <div className="px-section">
          <div className="px-grid">
            {cards.map((key) => (
              <article className="px-card" key={key}>
                <h3>{t(key)}</h3>
                <p>{t('pages.dashboard.subtitle')}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <section className="px-section">
      <PageHeader title={t('pages.about.title')} subtitle={t('pages.about.subtitle')} />
      <div className="px-grid two">
        <div className="px-hero-media">
          <img src="/assets/page-visuals/dashboard-team.jpg" alt="" />
        </div>
        <div className="px-grid">
          {['Buyer and supplier in one account', 'Compliance by design', 'Audit-ready records'].map((item) => (
            <article className="px-card" key={item}>
              <h3>{item}</h3>
              <p>{t('pages.about.subtitle')}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  const { t } = useTranslation();
  return <PolicyPage title={t('pages.privacy.title')} subtitle={t('pages.privacy.subtitle')} tone="privacy" />;
}

export function TermsPage() {
  const { t } = useTranslation();
  return <PolicyPage title={t('pages.terms.title')} subtitle={t('pages.terms.subtitle')} tone="terms" />;
}

function PolicyPage({ title, subtitle, tone }: { title: string; subtitle: string; tone: string }) {
  const sections = ['Identity data', 'Tender documents', 'Bids and evaluations', 'Audit evidence', 'Platform communication'];
  return (
    <section className="px-section">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="px-grid">
        {sections.map((section) => (
          <article className="px-card" key={`${tone}-${section}`}>
            <StatusBadge value="Current" />
            <h3>{section}</h3>
            <p>ProcureX keeps structured records, controlled access, and review history for this area.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContactPage() {
  const { t } = useTranslation();
  return (
    <section className="px-section">
      <PageHeader title={t('pages.contact.title')} subtitle={t('pages.contact.subtitle')} />
      <div className="px-grid two">
        <article className="px-card">
          <h3>Support request</h3>
          <div className="px-form-grid">
            <input aria-label="Email" placeholder="support@example.co.tz" />
            <input aria-label="Topic" placeholder="Verification" />
            <textarea aria-label="Message" placeholder="Describe the request" rows={5} />
          </div>
          <div className="px-actions">
            <Button variant="contained">{t('actions.submit')}</Button>
          </div>
        </article>
        <div className="px-hero-media">
          <img src="/assets/page-visuals/auth-verification.jpg" alt="" />
        </div>
      </div>
    </section>
  );
}

export function GuestMarketplacePage() {
  const { t } = useTranslation();
  const format = useLocaleFormat();

  return (
    <section className="px-section">
      <PageHeader title={t('pages.guestMarketplace.title')} subtitle={t('pages.guestMarketplace.subtitle')} />
      <DataTable<Tender>
        rows={tenders.filter((tender) => tender.status === 'OPEN')}
        getRowKey={(tender) => tender.id}
        columns={[
          { key: 'reference', label: t('common.reference'), render: (tender) => <strong>{tender.reference}</strong> },
          { key: 'title', label: 'Tender', render: (tender) => tender.title },
          { key: 'org', label: t('common.organization'), render: (tender) => tender.organization },
          { key: 'budget', label: t('common.budget'), render: (tender) => format.money(tender.budget, tender.currency) },
          { key: 'closing', label: t('common.closingDate'), render: (tender) => format.date(tender.closingDate) },
          { key: 'status', label: t('common.status'), render: (tender) => <StatusBadge value={tender.status} /> }
        ]}
      />
    </section>
  );
}
