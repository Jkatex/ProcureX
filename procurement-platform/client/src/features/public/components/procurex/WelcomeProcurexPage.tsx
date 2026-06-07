import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { useWelcomeLandingData } from '../../hooks';

type IconProps = {
  children: ReactNode;
  className?: string;
};

type NavigateButtonProps = {
  children: ReactNode;
  className: string;
  to: string;
};

function NavigateButton({ children, className, to }: NavigateButtonProps) {
  const navigate = useNavigate();
  return (
    <button className={className} type="button" onClick={() => navigate(to)}>
      {children}
    </button>
  );
}

function WelcomeIcon({ children, className = 'welcome-icon' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function PlatformLogo() {
  return (
    <span className="platform-logo">
      <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
    </span>
  );
}

type WelcomeStepCopy = {
  title: string;
  text: string;
};

type WelcomeMarketCardCopy = {
  title: string;
  text: string;
  points: string[];
};

type WelcomeAssuranceCopy = {
  title: string;
  text: string;
};

const stepIcons = [
  {
    icon: (
      <>
        <path d="M12 8v8" />
        <path d="M8 12h8" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
  {
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  },
  {
    icon: <path d="m5 12 14-7-7 14-2-5z" />
  },
  {
    icon: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
  }
];

const marketCardVisuals = [
  {
    image: 'business-collaboration.webp',
    icon: (
      <>
        <path d="M12 3a6 6 0 0 0-6 6c0 4 6 12 6 12s6-8 6-12a6 6 0 0 0-6-6Z" />
        <circle cx="12" cy="9" r="2" />
      </>
    )
  },
  {
    image: 'contract-review.webp',
    icon: (
      <>
        <path d="M7 11a4 4 0 1 1 8 0" />
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    )
  },
  {
    image: 'procurement-meeting.webp',
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </>
    )
  }
];

export function WelcomeProcurexPage() {
  const { t } = useTranslation();
  const { data, status } = useWelcomeLandingData();
  const featuredTender = data.featuredTenders[0];
  const completionRate = t('welcomeLanding.preview.completionRate', { rate: data.stats.verifiedProfileCompletionRate.toFixed(1) });
  const steps = t('welcomeLanding.steps', { returnObjects: true }) as WelcomeStepCopy[];
  const marketCards = t('welcomeLanding.marketCards', { returnObjects: true }) as WelcomeMarketCardCopy[];
  const assuranceItems = t('welcomeLanding.gateway.assurance', { returnObjects: true }) as WelcomeAssuranceCopy[];

  return (
    <div className="landing-page welcome-page-v2" data-welcome-status={status}>
      <header className="landing-nav welcome-nav-v2">
        <div className="landing-nav-inner container">
          <Link className="brand welcome-brand-v2" to="/" aria-label={t('welcomeLanding.brandHome')}>
            <PlatformLogo />
            <span className="brand-text">ProcureX</span>
          </Link>
          <nav className="landing-nav-links welcome-nav-links-v2" aria-label={t('welcomeLanding.navAria')}>
            <Link className="active" to="/guest-marketplace">
              {t('welcomeLanding.nav.browseTenders')}
            </Link>
            <a href="#how-it-works">{t('welcomeLanding.nav.howItWorks')}</a>
            <Link to="/about">{t('welcomeLanding.nav.about')}</Link>
            <a href="#help-center">{t('welcomeLanding.nav.helpCenter')}</a>
          </nav>
          <div className="welcome-nav-actions-v2">
            <span className="procurex-language-inline procurex-language-inline--welcome">
              <LanguageSwitcher />
            </span>
            <Link to="/sign-in">{t('actions.signIn')}</Link>
            <NavigateButton className="btn btn-primary" to="/register">
              {t('welcomeLanding.hero.primaryCta')}
            </NavigateButton>
          </div>
        </div>
      </header>

      <main className="welcome-hero-v2">
        <div className="container welcome-hero-grid-v2">
          <section className="welcome-hero-copy-v2 animate-fade-in">
            <span className="eyebrow">{t('welcomeLanding.hero.eyebrow')}</span>
            <h1>{t('welcomeLanding.hero.title')}</h1>
            <p>{t('welcomeLanding.hero.body')}</p>
            <p>{t('welcomeLanding.hero.support')}</p>
            <div className="hero-actions">
              <NavigateButton className="btn btn-primary" to="/register">
                {t('welcomeLanding.hero.primaryCta')}
              </NavigateButton>
              <NavigateButton className="btn btn-secondary" to="/guest-marketplace">
                {t('welcomeLanding.hero.secondaryCta')}
              </NavigateButton>
            </div>
            <div className="welcome-proof-v2" aria-label={t('welcomeLanding.proofAria')}>
              <span className="welcome-proof-avatars-v2" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{data.stats.participantLabel}</span>
            </div>
          </section>

          <section className="welcome-product-stage-v2 animate-fade-in delay-1" aria-label={t('welcomeLanding.productStageAria')}>
            <div className="welcome-product-window-v2">
              <div className="welcome-product-top-v2">
                <span>
                  <WelcomeIcon className="welcome-product-mark-v2">
                    <path d="M7 7h10v10H7z" />
                    <path d="M9 9h6v6H9z" />
                  </WelcomeIcon>{' '}
                  {t('welcomeLanding.preview.title')}
                </span>
                <em>{data.stats.activeWorkspaceLabel}</em>
              </div>
              <div className="welcome-product-metrics-v2">
                <article>
                  <WelcomeIcon>
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                    <circle cx="12" cy="12" r="9" />
                  </WelcomeIcon>
                  <strong>{t('welcomeLanding.preview.createTender')}</strong>
                  <span>{t('welcomeLanding.preview.openTenders', { count: data.stats.openTenderCount })}</span>
                </article>
                <article>
                  <WelcomeIcon>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </WelcomeIcon>
                  <strong>{featuredTender.reference}</strong>
                  <span>{featuredTender.title}</span>
                </article>
              </div>
              <div className="welcome-product-rate-v2">
                <div>
                  <span>{t('welcomeLanding.preview.verifiedProfile')}</span>
                  <strong>{completionRate}</strong>
                </div>
                <NavigateButton className="btn btn-primary" to="/register">
                  {t('welcomeLanding.preview.viewProfile')}
                </NavigateButton>
              </div>
              <figure className="welcome-product-photo-v2">
                <img src="/assets/welcome/procurement-meeting.webp" alt={t('welcomeLanding.preview.photoAlt')} loading="eager" />
              </figure>
            </div>
          </section>
        </div>
      </main>

      <section id="how-it-works" className="welcome-section-v2 welcome-steps-section-v2">
        <div className="container">
          <div className="section-header welcome-centered-v2">
            <span className="section-label">{t('welcomeLanding.sections.workflowLabel')}</span>
            <h2>{t('welcomeLanding.sections.workflowTitle')}</h2>
          </div>
          <div className="welcome-steps-grid-v2">
            {steps.map((step, index) => (
              <article className="welcome-step-v2" key={step.title}>
                <span className="welcome-step-icon-v2">
                  <WelcomeIcon>{stepIcons[index]?.icon}</WelcomeIcon>
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about-procurex" className="welcome-section-v2 welcome-gateway-section-v2">
        <div className="container">
          <div className="section-header welcome-centered-v2">
            <h2>{t('welcomeLanding.sections.gatewayTitle')}</h2>
            <p>{t('welcomeLanding.sections.gatewayBody')}</p>
          </div>
          <div className="welcome-gateway-grid-v2">
            <figure className="welcome-story-image-v2">
              <img src="/assets/welcome/opportunity-signing.webp" alt={t('welcomeLanding.gateway.imageAlt')} loading="lazy" />
              <figcaption>
                <span>{t('welcomeLanding.gateway.captionLead')}</span>
                <strong>{t('welcomeLanding.gateway.captionStrong')}</strong>
                <small>{t('welcomeLanding.gateway.captionText')}</small>
              </figcaption>
            </figure>
            <div className="welcome-assurance-stack-v2">
              <article>
                <WelcomeIcon>
                  <path d="M4 7h16v10H4z" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </WelcomeIcon>
                <div>
                  <h3>{assuranceItems[0]?.title}</h3>
                  <p>{assuranceItems[0]?.text}</p>
                </div>
              </article>
              <article>
                <WelcomeIcon>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </WelcomeIcon>
                <div>
                  <h3>{assuranceItems[1]?.title}</h3>
                  <p>{assuranceItems[1]?.text}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="welcome-dark-band-v2">
        <div className="container">
          <div className="section-header welcome-centered-v2">
            <h2>{t('welcomeLanding.sections.marketTitle')}</h2>
            <p>{t('welcomeLanding.sections.marketBody')}</p>
          </div>
          <div className="welcome-market-grid-v2">
            {marketCards.map((card, index) => (
              <article className="welcome-market-card-v2" key={card.title}>
                <div className="welcome-market-thumb-v2">
                  <img src={`/assets/welcome/${marketCardVisuals[index]?.image}`} alt="" loading="lazy" aria-hidden="true" />
                </div>
                <span className="welcome-market-icon-v2">
                  <WelcomeIcon>{marketCardVisuals[index]?.icon}</WelcomeIcon>
                </span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <ul>
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                  {index === 0 && <li>{featuredTender.buyerName}</li>}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="welcome-cta-section-v2">
        <div className="container">
          <div className="welcome-cta-panel-v2">
            <div>
              <h2>{t('welcomeLanding.cta.title')}</h2>
              <p>{t('welcomeLanding.cta.body')}</p>
            </div>
            <div className="cta-actions">
              <NavigateButton className="btn btn-primary" to="/register">
                {t('welcomeLanding.cta.button')}
              </NavigateButton>
            </div>
          </div>
        </div>
      </section>

      <footer id="help-center" className="welcome-footer-v2">
        <div className="container">
          <div>
            <strong>ProcureX</strong>
            <p>{t('welcomeLanding.footer.copyright')}</p>
          </div>
          <nav aria-label={t('welcomeLanding.footer.companyAria')}>
            <h3>{t('welcomeLanding.footer.company')}</h3>
            <Link to="/about">{t('welcomeLanding.footer.about')}</Link>
            <Link to="/privacy">{t('welcomeLanding.footer.privacy')}</Link>
            <Link to="/terms">{t('welcomeLanding.footer.terms')}</Link>
          </nav>
          <nav aria-label={t('welcomeLanding.footer.platformAria')}>
            <h3>{t('welcomeLanding.footer.platform')}</h3>
            <Link to="/guest-marketplace">{t('welcomeLanding.nav.browseTenders')}</Link>
            <a href="#help-center">{t('welcomeLanding.footer.systemStatus')}</a>
          </nav>
          <nav aria-label={t('welcomeLanding.footer.supportAria')}>
            <h3>{t('welcomeLanding.footer.support')}</h3>
            <Link to="/contact">{t('welcomeLanding.footer.helpCenter')}</Link>
            <Link to="/contact">{t('welcomeLanding.footer.contactSupport')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
