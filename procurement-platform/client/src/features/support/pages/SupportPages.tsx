import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { useNotifications } from '@/features/notifications/hooks';
import { supportApi, type SupportTicketPriority } from '@/features/support/api';
import { apiClient } from '@/shared/api/http';
import { NotificationCard } from '@/shared/components/NotificationCard';

type HealthResponse = {
  status: string;
  service?: string;
  modules?: Array<{ key: string; basePath: string }>;
};

const faqItems = [
  {
    question: 'How do I get verified on ProcureX?',
    answer:
      'Create an account, complete contact verification, then submit your registry details, authorized signatory information, and supporting documents from the identity verification workspace.'
  },
  {
    question: 'Can one organization buy and supply?',
    answer:
      'Yes. ProcureX supports buyer, supplier, and combined capabilities. Available tools are controlled by verification, permissions, and trust tier rules.'
  },
  {
    question: 'When can suppliers submit bids?',
    answer:
      'Suppliers can submit bids after their organization is approved and the tender is open for participation. Restricted actions stay gated until verification and trust checks pass.'
  },
  {
    question: 'Where do procurement records go?',
    answer:
      'Tender activity, clarification messages, bids, evaluations, awards, contracts, and audit events are retained in the platform record views as activity is created.'
  }
];

function SupportShell({ children }: { children: ReactNode }) {
  return (
    <div className="launch-support-page">
      <header className="launch-support-nav">
        <Link className="brand welcome-brand-v2" to="/" aria-label="ProcureX home">
          <span className="platform-logo">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <span className="brand-text">ProcureX</span>
        </Link>
        <nav aria-label="Support navigation">
          <Link to="/guest-marketplace">Open tenders</Link>
          <Link to="/help">Help</Link>
          <Link to="/status">Status</Link>
          <Link className="btn btn-primary" to="/sign-in">
            Sign In
          </Link>
        </nav>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}

export function HelpCenterProcurexPage() {
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
      notifySuccess('Support ticket created', `Ticket ${ticket.id.slice(0, 8)} is now with ProcureX support.`);
    } catch {
      notifyError('Ticket could not be created', 'Please check your session and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SupportShell>
      <section className="launch-support-hero">
        <span className="eyebrow">ProcureX Help Center</span>
        <h1>Help for registration, verification, tenders, and bids.</h1>
        <p>
          Find practical guidance for the first ProcureX workflows. For account-specific issues, contact support with the email address used on your organization profile.
        </p>
      </section>

      <section className="launch-support-grid" aria-label="Support options">
        <article>
          <strong>Identity and access</strong>
          <p>Registration, OTP verification, registry checks, trust tier status, and role-based access questions.</p>
          <Link to="/identity/verification">Open verification</Link>
        </article>
        <article>
          <strong>Tender workflow</strong>
          <p>Create tenders, publish procurement opportunities, review requirements, and keep tender records together.</p>
          <Link to="/guest-marketplace">Browse tenders</Link>
        </article>
        <article>
          <strong>Support channels</strong>
          <p>Send onboarding, compliance, or technical questions to the ProcureX support team.</p>
          <Link to="/contact">Contact support</Link>
        </article>
      </section>

      {isAuthenticated ? (
        <section className="launch-support-faq" aria-labelledby="support-ticket-title">
          <div className="section-header welcome-centered-v2">
            <span className="section-label">Create support ticket</span>
            <h2 id="support-ticket-title">Send an account-specific support request</h2>
          </div>
          <form className="launch-contact-form" onSubmit={submitTicket}>
            <label>
              Subject
              <input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} maxLength={180} />
            </label>
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="General">General</option>
                <option value="Identity">Identity</option>
                <option value="Procurement">Procurement</option>
                <option value="Technical">Technical</option>
                <option value="Compliance">Compliance</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label>
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} required minLength={10} maxLength={5000} rows={5} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create support ticket'}
            </button>
          </form>
        </section>
      ) : null}

      <section className="launch-support-faq" aria-labelledby="support-faq-title">
        <div className="section-header welcome-centered-v2">
          <span className="section-label">Frequently asked</span>
          <h2 id="support-faq-title">Procurement support questions</h2>
        </div>
        <div className="launch-faq-list">
          {faqItems.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </SupportShell>
  );
}

export function SystemStatusProcurexPage() {
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
          setError('The ProcureX API health check is not reachable from this browser right now.');
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const statusLabel = health?.status === 'ok' ? 'Operational' : error ? 'Connection issue' : 'Checking';
  const moduleCount = health?.modules?.length ?? 0;

  return (
    <SupportShell>
      <section className="launch-support-hero launch-status-hero">
        <span className="eyebrow">System Status</span>
        <h1>{statusLabel}</h1>
        <p>{error || `Health check for ${health?.service ?? 'ProcureX server'} is responding. ${moduleCount} service modules are registered.`}</p>
      </section>
      <section className="launch-status-panel" aria-label="Service modules">
        {error ? (
          <NotificationCard notification={{ tone: 'error', title: 'Health check failed', message: error, reason: 'The browser could not reach the public /health endpoint.', action: { label: 'Refresh status', onAction: () => window.location.reload() }, dismissible: false }} />
        ) : null}
        <div>
          <strong>API health</strong>
          <span className={health?.status === 'ok' ? 'status-pill status-pill--ok' : 'status-pill'}>{health?.status ?? 'checking'}</span>
        </div>
        <div className="launch-status-modules">
          {(health?.modules ?? []).map((module) => (
            <span key={module.key}>
              {module.key}
              <small>{module.basePath}</small>
            </span>
          ))}
          {!health && !error ? <span>Checking registered modules...</span> : null}
          {error ? <span>Retry by refreshing this page after the API is available.</span> : null}
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
  return (
    <ActionPage
      eyebrow="404"
      title="That ProcureX page was not found."
      body="The link may be old, mistyped, or no longer available. You can return home or open the help center."
      primaryTo="/"
      primaryLabel="Go home"
      secondaryTo="/help"
      secondaryLabel="Open help"
    />
  );
}

export function SessionExpiredProcurexPage() {
  return (
    <ActionPage
      eyebrow="Session expired"
      title="Please sign in again."
      body="Your saved session could not be restored. Sign in again to continue with your ProcureX workspace."
      primaryTo="/sign-in"
      primaryLabel="Sign in"
      secondaryTo="/help"
      secondaryLabel="Get help"
    />
  );
}

export function AccountLockedProcurexPage() {
  return (
    <ActionPage
      eyebrow="Account access"
      title="This account needs support review."
      body="The sign-in response indicates the account may be locked or suspended. Contact ProcureX support before trying again."
      primaryTo="/contact"
      primaryLabel="Contact support"
      secondaryTo="/help"
      secondaryLabel="Read help"
    />
  );
}

export function CookieConsentBanner() {
  const storageKey = 'procurex.cookieConsent.v1';
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) !== 'accepted';
  });

  const year = useMemo(() => new Date().getFullYear(), []);

  if (!visible) return null;

  return (
    <aside className="cookie-consent" aria-label="Cookie notice">
      <p>
        ProcureX uses essential browser storage for sign-in, language, security checks, and service reliability. See our <a href="/privacy">Privacy Policy</a> and{' '}
        <a href="/terms">Terms</a>. © {year}
      </p>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => {
          window.localStorage.setItem(storageKey, 'accepted');
          setVisible(false);
        }}
      >
        Accept
      </button>
    </aside>
  );
}
