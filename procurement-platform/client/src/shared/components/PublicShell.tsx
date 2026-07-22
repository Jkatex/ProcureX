/* Renders the shared Public Shell UI while keeping page-specific presentation near its workflow data. */
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';

export function PublicShell() {
  const { t } = useTranslation();

  return (
    <div className="px-public-shell">
      <header className="px-public-nav">
        <div className="px-public-nav-inner">
          <Link className="px-brand" to="/">
            <img src="/assets/logo.svg" alt="" />
            <span>{t('brand')}</span>
          </Link>
          <nav className="px-nav-links" aria-label="Public">
            <NavLink to="/guest-marketplace">{t('nav.marketplace')}</NavLink>
            <NavLink to="/about">{t('nav.about')}</NavLink>
            <NavLink to="/privacy">{t('nav.privacy')}</NavLink>
            <NavLink to="/terms">{t('nav.terms')}</NavLink>
            <NavLink to="/contact">{t('nav.contact')}</NavLink>
          </nav>
          <div className="px-actions" style={{ marginTop: 0 }}>
            <LanguageSwitcher />
            <Button component={Link} to="/sign-in" variant="outlined">
              {t('actions.signIn')}
            </Button>
            <Button component={Link} to="/register" variant="contained">
              {t('actions.getStarted')}
            </Button>
          </div>
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
