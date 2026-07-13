import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { supportComposeRoute } from '@/features/communication/supportComposeRoute';
import { helpCentreApi } from '@/features/helpCentre/api';
import { useNotifications } from '@/features/notifications/hooks';
import { supportApi, type SupportTicketPriority } from '@/features/support/api';
import { apiClient } from '@/shared/api/http';
import { NotificationCard } from '@/shared/components/NotificationCard';
import type { HelpFaq, HelpFaqCategory, HelpMessageResponse, HelpRelatedQuestion } from '@procurex/shared';
import '@/i18n';

type HealthResponse = {
  status: string;
  service?: string;
  modules?: Array<{ key: string; basePath: string }>;
};

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

function SupportShell({ children, signedIn = false }: { children: ReactNode; signedIn?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className={`launch-support-page${signedIn ? ' signed-in-help-shell' : ''}`}>
      <header className="launch-support-nav">
        <Link className="brand welcome-brand-v2" to={signedIn ? '/dashboard' : '/'} aria-label={t('welcomeLanding.brandHome')}>
          <span className="platform-logo">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <span className="brand-text">ProcureX</span>
        </Link>
        {signedIn ? null : (
          <nav aria-label={t('support.nav.ariaLabel')}>
            <Link to="/guest-marketplace">{t('support.nav.openTenders')}</Link>
            <Link to="/help">{t('accountMenu.help')}</Link>
            <Link to="/status">{t('support.nav.status')}</Link>
            <Link className="btn btn-primary" to="/sign-in">
              {t('actions.signIn')}
            </Link>
          </nav>
        )}
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}

type HelpChatMessage =
  | {
      id: string;
      type: 'user';
      text: string;
    }
  | {
      id: string;
      type: 'assistant';
      answer: HelpMessageResponse;
    };

function HelpAnswerCard({
  answer,
  onAsk,
  onAction
}: {
  answer: HelpMessageResponse;
  onAsk: (question: HelpRelatedQuestion) => void;
  onAction: (path?: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <article className={`help-centre-message assistant${answer.matched ? '' : ' fallback'}`}>
      <div className="help-centre-answer-heading">
        <div>
          {answer.category ? <span>{`${answer.category} / ${answer.subcategory}`}</span> : <span>{t('helpCentre.assistantName')}</span>}
          {answer.title ? <h3>{answer.title}</h3> : null}
        </div>
        {typeof answer.confidence === 'number' ? <strong>{t('helpCentre.confidence', { count: answer.confidence })}</strong> : null}
      </div>
      <p>{answer.summary}</p>
      {answer.steps.length > 0 ? (
        <div className="help-centre-answer-section">
          <strong>{t('helpCentre.sections.steps')}</strong>
          <ol>
            {answer.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {answer.notes?.length ? (
        <div className="help-centre-answer-section note">
          <strong>{t('helpCentre.sections.notes')}</strong>
          <ul>
            {answer.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {answer.warnings?.length ? (
        <div className="help-centre-answer-section warning">
          <strong>{t('helpCentre.sections.warnings')}</strong>
          <ul>
            {answer.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {answer.relatedQuestions?.length ? (
        <div className="help-centre-related">
          <strong>{t('helpCentre.sections.related')}</strong>
          <div>
            {answer.relatedQuestions.map((question) => (
              <button key={question.faqId} type="button" onClick={() => onAsk(question)}>
                {question.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {answer.action ? (
        <button className="btn btn-primary btn-sm" type="button" onClick={() => onAction(answer.action?.path)}>
          {answer.action.label}
        </button>
      ) : null}
    </article>
  );
}

export function HelpCenterProcurexPage() {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const [categories, setCategories] = useState<HelpFaqCategory[]>([]);
  const [popularFaqs, setPopularFaqs] = useState<HelpFaq[]>([]);
  const [categoryFaqs, setCategoryFaqs] = useState<HelpFaq[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [messages, setMessages] = useState<HelpChatMessage[]>([
    {
      id: 'welcome',
      type: 'assistant',
      answer: {
        success: true,
        matched: true,
        summary: t('helpCentre.welcomeMessage'),
        steps: [t('helpCentre.welcomeStepSearch'), t('helpCentre.welcomeStepCategory'), t('helpCentre.welcomeStepSupport')],
        notes: [t('helpCentre.disclaimer')],
        warnings: []
      }
    }
  ]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState('');
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([helpCentreApi.categories(), helpCentreApi.popular()])
      .then(([nextCategories, popular]) => {
        if (!mounted) return;
        setCategories(nextCategories);
        setPopularFaqs(popular.faqs);
        setSelectedCategory(nextCategories[0]?.id ?? '');
      })
      .catch(() => {
        if (mounted) setError(t('helpCentre.errors.load'));
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedCategory) return;
    let mounted = true;
    helpCentreApi
      .category(selectedCategory)
      .then((result) => {
        if (mounted) setCategoryFaqs(result.faqs);
      })
      .catch(() => {
        if (mounted) setCategoryFaqs([]);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCategory]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [messages, loading]);

  async function submitQuestion(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading || trimmed.length > 500) return;

    const userMessage: HelpChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setError('');
    setLoading(true);

    try {
      const answer = await helpCentreApi.message({
        message: trimmed,
        category: selectedCategory,
        currentPath: '/help'
      });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, type: 'assistant', answer }]);
    } catch {
      setError(t('helpCentre.errors.message'));
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          type: 'assistant',
          answer: {
            success: true,
            matched: false,
            summary: t('helpCentre.errors.message'),
            steps: [t('helpCentre.fallback.tryAgain'), t('helpCentre.fallback.selectCategory'), t('helpCentre.fallback.contactSupport')],
            action: { label: t('helpCentre.support.contactSupport'), path: isAuthenticated ? supportComposeRoute() : '/contact' }
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion();
    }
  }

  function askFaq(faq: Pick<HelpFaq, 'title'> | HelpRelatedQuestion) {
    void submitQuestion(faq.title);
  }

  function followAction(path?: string) {
    if (!path) return;
    navigate(path === '/support' && isAuthenticated ? supportComposeRoute() : path);
  }

  const selectedCategoryRecord = categories.find((item) => item.id === selectedCategory);
  const remainingCharacters = 500 - question.length;
  const layoutClassName = `help-centre-layout${helpPanelOpen ? ' panel-open' : ' panel-closed'}`;

  return (
    <SupportShell signedIn={isAuthenticated}>
      <section className={`help-centre-page${isAuthenticated ? ' signed-in' : ''}`} aria-labelledby="help-centre-title">
        {error ? <NotificationCard notification={{ tone: 'error', title: t('helpCentre.errors.title'), message: error, dismissible: false }} /> : null}

        <div className={layoutClassName}>
          {helpPanelOpen ? (
            <aside className="help-centre-panel" aria-label={t('helpCentre.panelLabel')}>
              <div className="help-centre-panel-top">
                <strong>{t('helpCentre.panelLabel')}</strong>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setHelpPanelOpen(false)}>
                  {t('helpCentre.closePanel')}
                </button>
              </div>
              <section className="help-centre-sidebar" aria-label={t('helpCentre.categories')}>
                <div className="help-centre-panel-heading">
                  <span>{t('helpCentre.categories')}</span>
                  <strong>{categories.length}</strong>
                </div>
                {loadingInitial ? <p>{t('helpCentre.loading')}</p> : null}
                <div className="help-centre-category-list">
                  {categories.map((categoryItem) => (
                    <button
                      key={categoryItem.id}
                      type="button"
                      className={categoryItem.id === selectedCategory ? 'active' : ''}
                      onClick={() => setSelectedCategory(categoryItem.id)}
                    >
                      <strong>{categoryItem.title}</strong>
                      <span>{categoryItem.subcategories.slice(0, 2).join(' / ')}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="help-centre-panel-heading">
                  <span>{t('helpCentre.popular')}</span>
                  <strong>{popularFaqs.length}</strong>
                </div>
                <div className="help-centre-question-list">
                  {popularFaqs.slice(0, 8).map((faq) => (
                    <button key={faq.id} type="button" onClick={() => askFaq(faq)}>
                      {faq.title}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="help-centre-panel-heading">
                  <span>{t('helpCentre.frequentlyViewed')}</span>
                  <strong>{categoryFaqs.length}</strong>
                </div>
                <div className="help-centre-question-list">
                  {categoryFaqs.slice(0, 8).map((faq) => (
                    <button key={faq.id} type="button" onClick={() => askFaq(faq)}>
                      {faq.title}
                    </button>
                  ))}
                </div>
              </section>

              <section className="help-centre-support">
                <strong>{t('helpCentre.support.title')}</strong>
                <p>{t('helpCentre.support.body')}</p>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(isAuthenticated ? supportComposeRoute() : '/contact')}>
                  {t('helpCentre.support.communication')}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(isAuthenticated ? supportComposeRoute() : '/contact')}>
                  {t('helpCentre.support.contactSupport')}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/privacy')}>
                  {t('helpCentre.support.privacy')}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/terms')}>
                  {t('helpCentre.support.terms')}
                </button>
              </section>

              <p className="help-centre-disclaimer">{t('helpCentre.disclaimer')}</p>
            </aside>
          ) : null}

          <section className="help-centre-chat" aria-label={t('helpCentre.chatAria')}>
            <div className="help-centre-chat-header">
              <div className="help-centre-chat-title">
                <span>{t('helpCentre.eyebrow')}</span>
                <h1 id="help-centre-title">{t('helpCentre.assistantTitle')}</h1>
                <p>{t('helpCentre.intro')}</p>
                <div className="help-centre-context">
                  <span>{user?.organization || t('accountMenu.procurexAccount')}</span>
                  <strong>{user?.capabilities?.length ? user.capabilities.join(' + ') : t('helpCentre.publicContext')}</strong>
                  <em>{selectedCategoryRecord?.title ?? t('helpCentre.allCategories')}</em>
                </div>
              </div>
              <div className="help-centre-chat-actions">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setHelpPanelOpen((current) => !current)}>
                  {helpPanelOpen ? t('helpCentre.hidePanel') : t('helpCentre.openPanel')}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMessages([])}>
                  {t('helpCentre.clear')}
                </button>
              </div>
            </div>
            <div className="help-centre-messages" aria-live="polite">
              {messages.length === 0 ? (
                <div className="help-centre-empty">
                  <strong>{t('helpCentre.emptyTitle')}</strong>
                  <p>{t('helpCentre.emptyBody')}</p>
                </div>
              ) : null}
              {messages.map((message) =>
                message.type === 'user' ? (
                  <div className="help-centre-message user" key={message.id}>
                    <p>{message.text}</p>
                  </div>
                ) : (
                  <HelpAnswerCard key={message.id} answer={message.answer} onAsk={askFaq} onAction={followAction} />
                )
              )}
              {loading ? <div className="help-centre-message assistant loading">{t('helpCentre.loadingAnswer')}</div> : null}
              <div ref={conversationEndRef} />
            </div>
            <div className="help-centre-search help-centre-chat-composer" role="search">
              <label htmlFor="help-centre-question">{t('helpCentre.searchLabel')}</label>
              <div className="help-centre-search-row">
                <textarea
                  id="help-centre-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
                  onKeyDown={handleKeyDown}
                  placeholder={t('helpCentre.searchPlaceholder')}
                  rows={2}
                  maxLength={500}
                  aria-describedby="help-centre-count"
                />
                <button className="btn btn-primary" type="button" onClick={() => void submitQuestion()} disabled={!question.trim() || loading}>
                  {loading ? t('helpCentre.asking') : t('helpCentre.ask')}
                </button>
              </div>
              <div className="help-centre-search-meta">
                <span id="help-centre-count">{t('helpCentre.charactersRemaining', { count: remainingCharacters })}</span>
                <span>{t('helpCentre.enterHint')}</span>
              </div>
            </div>
          </section>
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
  }, [t]);

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
    form?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
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
