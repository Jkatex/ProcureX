import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { useNotifications } from '@/features/notifications/hooks';
import { supportApi, type SupportTicketPriority } from '@/features/support/api';
import { apiClient } from '@/shared/api/http';
import { NotificationCard } from '@/shared/components/NotificationCard';
import '@/i18n';

type HealthResponse = {
  status: string;
  service?: string;
  modules?: Array<{ key: string; basePath: string }>;
};

const faqItems = [
  { questionKey: 'support.help.faq.items.verification.question', answerKey: 'support.help.faq.items.verification.answer' },
  { questionKey: 'support.help.faq.items.dualRole.question', answerKey: 'support.help.faq.items.dualRole.answer' },
  { questionKey: 'support.help.faq.items.bidTiming.question', answerKey: 'support.help.faq.items.bidTiming.answer' },
  { questionKey: 'support.help.faq.items.records.question', answerKey: 'support.help.faq.items.records.answer' }
];

const supportDeskCategories = [
  { value: 'General', labelKey: 'support.categories.general' },
  { value: 'Account access', labelKey: 'support.categories.accountAccess' },
  { value: 'Identity verification', labelKey: 'support.categories.identityVerification' },
  { value: 'Procurement', labelKey: 'support.categories.procurement' },
  { value: 'Evaluation', labelKey: 'support.categories.evaluation' },
  { value: 'Awarding and contract', labelKey: 'support.categories.awardingContract' },
  { value: 'Technical', labelKey: 'support.categories.technical' },
  { value: 'Compliance', labelKey: 'support.categories.compliance' }
];

const supportDeskCards = [
  {
    titleKey: 'support.desk.cards.account.title',
    descriptionKey: 'support.desk.cards.account.description',
    category: 'Account access'
  },
  {
    titleKey: 'support.desk.cards.verification.title',
    descriptionKey: 'support.desk.cards.verification.description',
    category: 'Identity verification'
  },
  {
    titleKey: 'support.desk.cards.procurement.title',
    descriptionKey: 'support.desk.cards.procurement.description',
    category: 'Procurement'
  },
  {
    titleKey: 'support.desk.cards.awarding.title',
    descriptionKey: 'support.desk.cards.awarding.description',
    category: 'Awarding and contract'
  },
  {
    titleKey: 'support.desk.cards.technical.title',
    descriptionKey: 'support.desk.cards.technical.description',
    category: 'Technical'
  }
];

const supportQuickLinks = [
  { labelKey: 'accountMenu.profile', route: '/identity/profile' },
  { labelKey: 'support.quickLinks.verification', route: '/identity/verification' },
  { labelKey: 'nav.dashboard', route: '/dashboard' },
  { labelKey: 'nav.communication', route: '/communication' },
  { labelKey: 'support.quickLinks.awardingContracts', route: '/awards-contracts' },
  { labelKey: 'support.quickLinks.systemStatus', route: '/status' }
];

function SupportShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="launch-support-page">
      <header className="launch-support-nav">
        <Link className="brand welcome-brand-v2" to="/" aria-label={t('welcomeLanding.brandHome')}>
          <span className="platform-logo">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <span className="brand-text">ProcureX</span>
        </Link>
        <nav aria-label={t('support.nav.ariaLabel')}>
          <Link to="/guest-marketplace">{t('support.nav.openTenders')}</Link>
          <Link to="/help">{t('accountMenu.help')}</Link>
          <Link to="/status">{t('support.nav.status')}</Link>
          <Link className="btn btn-primary" to="/sign-in">
            {t('actions.signIn')}
          </Link>
        </nav>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}

export function HelpCenterProcurexPage() {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const { notifyError, notifySuccess } = useNotifications();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<SupportTicketPriority>('NORMAL');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const ticket = await supportApi.createTicket({ subject, category, priority, description });
      setSubject('');
      setCategory('General');
      setPriority('NORMAL');
      setDescription('');
      notifySuccess(t('support.ticket.createdTitle'), t('support.ticket.createdMessage', { id: ticket.id.slice(0, 8) }));
    } catch {
      notifyError(t('support.ticket.failedTitle'), t('support.ticket.failedMessage'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SupportShell>
      <section className="launch-support-hero">
        <span className="eyebrow">{t('support.help.eyebrow')}</span>
        <h1>{t('support.help.title')}</h1>
        <p>{t('support.help.body')}</p>
      </section>

      <section className="launch-support-grid" aria-label={t('support.help.optionsAria')}>
        <article>
          <strong>{t('support.help.options.identity.title')}</strong>
          <p>{t('support.help.options.identity.body')}</p>
          <Link to="/identity/verification">{t('support.help.options.identity.link')}</Link>
        </article>
        <article>
          <strong>{t('support.help.options.tender.title')}</strong>
          <p>{t('support.help.options.tender.body')}</p>
          <Link to="/guest-marketplace">{t('support.help.options.tender.link')}</Link>
        </article>
        <article>
          <strong>{t('support.help.options.channels.title')}</strong>
          <p>{t('support.help.options.channels.body')}</p>
          <Link to="/contact">{t('support.help.options.channels.link')}</Link>
        </article>
      </section>

      {isAuthenticated ? (
        <section className="launch-support-faq" aria-labelledby="support-ticket-title">
          <div className="section-header welcome-centered-v2">
            <span className="section-label">{t('support.ticket.create')}</span>
            <h2 id="support-ticket-title">{t('support.ticket.accountSpecificTitle')}</h2>
          </div>
          <form className="launch-contact-form" onSubmit={submitTicket}>
            <label>
              {t('support.ticket.subject')}
              <input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} maxLength={180} />
            </label>
            <label>
              {t('support.ticket.category')}
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="General">{t('support.categories.general')}</option>
                <option value="Identity">{t('support.categories.identity')}</option>
                <option value="Procurement">{t('support.categories.procurement')}</option>
                <option value="Technical">{t('support.categories.technical')}</option>
                <option value="Compliance">{t('support.categories.compliance')}</option>
              </select>
            </label>
            <label>
              {t('support.ticket.priority')}
              <select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}>
                <option value="LOW">{t('support.priorities.LOW')}</option>
                <option value="NORMAL">{t('support.priorities.NORMAL')}</option>
                <option value="HIGH">{t('support.priorities.HIGH')}</option>
                <option value="URGENT">{t('support.priorities.URGENT')}</option>
              </select>
            </label>
            <label>
              {t('support.ticket.description')}
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} required minLength={10} maxLength={5000} rows={5} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? t('support.ticket.creating') : t('support.ticket.create')}
            </button>
          </form>
        </section>
      ) : null}

      <section className="launch-support-faq" aria-labelledby="support-faq-title">
        <div className="section-header welcome-centered-v2">
          <span className="section-label">{t('support.help.faq.label')}</span>
          <h2 id="support-faq-title">{t('support.help.faq.title')}</h2>
        </div>
        <div className="launch-faq-list">
          {faqItems.map((item) => (
            <details key={item.questionKey}>
              <summary>{t(item.questionKey)}</summary>
              <p>{t(item.answerKey)}</p>
            </details>
          ))}
        </div>
      </section>
    </SupportShell>
  );
}

export function SignedInHelpDeskProcurexPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { notifyError, notifySuccess } = useNotifications();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<SupportTicketPriority>('NORMAL');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previousPage = document.body.dataset.page;
    document.body.dataset.page = 'support-desk';
    document.body.dataset.procurexReactPage = 'true';
    return () => {
      if (previousPage) document.body.dataset.page = previousPage;
      else delete document.body.dataset.page;
      delete document.body.dataset.procurexReactPage;
    };
  }, []);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const ticket = await supportApi.createTicket({ subject, category, priority, description });
      setSubject('');
      setCategory('General');
      setPriority('NORMAL');
      setDescription('');
      notifySuccess(t('support.ticket.createdTitle'), t('support.ticket.createdMessage', { id: ticket.id.slice(0, 8) }));
    } catch {
      notifyError(t('support.ticket.failedTitle'), t('support.ticket.failedMessage'));
    } finally {
      setSubmitting(false);
    }
  }

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    const form = document.getElementById('support-desk-ticket-form');
    form?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    <div className="procurex-react-page support-desk-page">
      <header className="app-topbar">
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" onClick={() => navigate('/dashboard')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>{t('support.desk.title')}</span>
          </button>
        </div>
        <div className="app-topbar-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/dashboard')}>
            {t('nav.dashboard')}
          </button>
        </div>
      </header>

      <div className="main-layout support-desk-layout">
        <aside className="sidebar support-desk-sidebar">
          <div className="sidebar-heading">
            <h3>{t('support.desk.title')}</h3>
            <div>{user?.organization || t('accountMenu.procurexAccount')}</div>
          </div>
          <ul className="sidebar-nav">
            <li><button type="button" className="active" onClick={() => navigate('/support')}>{t('support.desk.nav.request')}</button></li>
            <li><button type="button" onClick={() => navigate('/communication')}>{t('accountMenu.messages')}</button></li>
            <li><button type="button" onClick={() => navigate('/status')}>{t('support.quickLinks.systemStatus')}</button></li>
            <li><button type="button" onClick={() => navigate('/help')}>{t('support.desk.nav.publicHelp')}</button></li>
          </ul>
        </aside>

        <main className="main-content support-desk-content">
          <section className="support-desk-hero">
            <div>
              <span className="section-kicker">{t('support.desk.kicker')}</span>
              <h1>{t('support.desk.title')}</h1>
              <p>{t('support.desk.body')}</p>
            </div>
            <div className="support-desk-account">
              <span>{t('common.organization')}</span>
              <strong>{user?.organization || t('accountMenu.procurexAccount')}</strong>
              <em>{user?.email}</em>
            </div>
          </section>

          <section className="support-desk-card-grid" aria-label={t('support.desk.prioritiesAria')}>
            {supportDeskCards.map((card) => (
              <article key={card.titleKey}>
                <strong>{t(card.titleKey)}</strong>
                <p>{t(card.descriptionKey)}</p>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => selectCategory(card.category)}>
                  {t('support.desk.useCategory')}
                </button>
              </article>
            ))}
          </section>

          <section className="support-desk-panel" aria-labelledby="support-desk-ticket-title">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">{t('support.ticket.kicker')}</span>
                <h2 id="support-desk-ticket-title">{t('support.ticket.createRequest')}</h2>
              </div>
              <span className="badge badge-info">{t(`support.priorities.${priority}`)}</span>
            </div>
            <form id="support-desk-ticket-form" className="support-desk-form" onSubmit={submitTicket}>
              <label>
                {t('support.ticket.subject')}
                <input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} maxLength={180} />
              </label>
              <label>
                {t('support.ticket.category')}
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {supportDeskCategories.map((item) => (
                    <option key={item.value} value={item.value}>{t(item.labelKey)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('support.ticket.priority')}
                <select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}>
                  <option value="LOW">{t('support.priorities.LOW')}</option>
                  <option value="NORMAL">{t('support.priorities.NORMAL')}</option>
                  <option value="HIGH">{t('support.priorities.HIGH')}</option>
                  <option value="URGENT">{t('support.priorities.URGENT')}</option>
                </select>
              </label>
              <label>
                {t('support.ticket.description')}
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                  placeholder={t('support.ticket.descriptionPlaceholder')}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? t('support.ticket.creating') : t('support.ticket.create')}
              </button>
            </form>
          </section>

          <section className="support-desk-panel" aria-labelledby="support-desk-links-title">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">{t('support.desk.quickLinks')}</span>
                <h2 id="support-desk-links-title">{t('support.desk.openRelated')}</h2>
              </div>
            </div>
            <div className="support-desk-links">
              {supportQuickLinks.map((link) => (
                <button className="btn btn-secondary btn-sm" type="button" key={link.route} onClick={() => navigate(link.route)}>
                  {t(link.labelKey)}
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function SystemStatusProcurexPage() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    apiClient
      .get<HealthResponse>('/health')
      .then((response) => {
        if (mounted) {
          setHealth(response.data);
          setError('');
        }
      })
      .catch(() => {
        if (mounted) {
          setError(t('support.status.unreachable'));
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const statusLabel = health?.status === 'ok' ? t('support.status.operational') : error ? t('support.status.connectionIssue') : t('support.status.checking');
  const moduleCount = health?.modules?.length ?? 0;

  return (
    <SupportShell>
      <section className="launch-support-hero launch-status-hero">
        <span className="eyebrow">{t('support.quickLinks.systemStatus')}</span>
        <h1>{statusLabel}</h1>
        <p>{error || t('support.status.responding', { service: health?.service ?? t('support.status.procurexServer'), count: moduleCount })}</p>
      </section>
      <section className="launch-status-panel" aria-label={t('support.status.modulesAria')}>
        {error ? (
          <NotificationCard notification={{ tone: 'error', title: t('support.status.failed'), message: error, reason: t('support.status.failedReason'), action: { label: t('support.status.refresh'), onAction: () => window.location.reload() }, dismissible: false }} />
        ) : null}
        <div>
          <strong>{t('support.status.apiHealth')}</strong>
          <span className={health?.status === 'ok' ? 'status-pill status-pill--ok' : 'status-pill'}>{health?.status ?? 'checking'}</span>
        </div>
        <div className="launch-status-modules">
          {(health?.modules ?? []).map((module) => (
            <span key={module.key}>
              {module.key}
              <small>{module.basePath}</small>
            </span>
          ))}
          {!health && !error ? <span>{t('support.status.checkingModules')}</span> : null}
          {error ? <span>{t('support.status.retry')}</span> : null}
        </div>
      </section>
    </SupportShell>
  );
}

function ActionPage({
  eyebrow,
  title,
  body,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel
}: {
  eyebrow: string;
  title: string;
  body: string;
  primaryTo: string;
  primaryLabel: string;
  secondaryTo: string;
  secondaryLabel: string;
}) {
  return (
    <SupportShell>
      <section className="launch-support-hero launch-action-page">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={primaryTo}>
            {primaryLabel}
          </Link>
          <Link className="btn btn-secondary" to={secondaryTo}>
            {secondaryLabel}
          </Link>
        </div>
      </section>
    </SupportShell>
  );
}

export function NotFoundProcurexPage() {
  const { t } = useTranslation();

  return (
    <ActionPage
      eyebrow="404"
      title={t('support.actions.notFound.title')}
      body={t('support.actions.notFound.body')}
      primaryTo="/"
      primaryLabel={t('support.actions.goHome')}
      secondaryTo="/help"
      secondaryLabel={t('support.actions.openHelp')}
    />
  );
}

export function SessionExpiredProcurexPage() {
  const { t } = useTranslation();

  return (
    <ActionPage
      eyebrow={t('support.actions.sessionExpired.eyebrow')}
      title={t('support.actions.sessionExpired.title')}
      body={t('support.actions.sessionExpired.body')}
      primaryTo="/sign-in"
      primaryLabel={t('actions.signIn')}
      secondaryTo="/help"
      secondaryLabel={t('support.actions.getHelp')}
    />
  );
}

export function AccountLockedProcurexPage() {
  const { t } = useTranslation();

  return (
    <ActionPage
      eyebrow={t('support.actions.accountLocked.eyebrow')}
      title={t('support.actions.accountLocked.title')}
      body={t('support.actions.accountLocked.body')}
      primaryTo="/contact"
      primaryLabel={t('support.help.options.channels.link')}
      secondaryTo="/help"
      secondaryLabel={t('support.actions.readHelp')}
    />
  );
}

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const storageKey = 'procurex.cookieConsent.v1';
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) !== 'accepted';
  });

  const year = useMemo(() => new Date().getFullYear(), []);

  if (!visible) return null;

  return (
    <aside className="cookie-consent" aria-label={t('support.cookie.ariaLabel')}>
      <p>
        {t('support.cookie.message')}{' '}
        <a href="/privacy">{t('pages.privacy.title')}</a> {t('auth.register.password.agreementAnd')}{' '}
        <a href="/terms">{t('nav.terms')}</a>. &copy; {year}
      </p>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => {
          window.localStorage.setItem(storageKey, 'accepted');
          setVisible(false);
        }}
      >
        {t('support.cookie.accept')}
      </button>
    </aside>
  );
}
