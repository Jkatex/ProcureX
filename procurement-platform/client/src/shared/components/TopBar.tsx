import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AccountMenu } from './AccountMenu';
import {
  PlatformAppsButton,
  PlatformAppsDrawer,
  resolvePlatformAppRoute,
  type PlatformAppPageKey
} from './procurex/PlatformAppsDrawer';

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [appsOpen, setAppsOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const isAdmin = user?.accountType === 'ADMIN';
  const organizationLabel = user?.organization || (user?.accountType === 'ADMIN' ? t('platformApps.adminTools') : t('platformApps.accountTools'));

  useEffect(() => {
    function handleDocumentClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setAppsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAppsOpen(false);
    }

    document.addEventListener('pointerdown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function selectPlatformApp(pageKey: PlatformAppPageKey) {
    setAppsOpen(false);
    navigate(resolvePlatformAppRoute(pageKey));
  }

  function openAdminApps() {
    setAppsOpen(false);
    navigate('/admin');
  }

  return (
    <header className="px-topbar" ref={headerRef}>
      <div className="px-topbar-inner">
        <Link className="px-brand" to={isAdmin ? '/admin' : '/dashboard'}>
          <img src="/assets/logo.svg" alt="" />
          <span>{t('brand')}</span>
        </Link>
        <nav className="px-nav-links" aria-label={t('nav.primary')}>
          {isAdmin ? (
            <>
              <NavLink to="/admin">{t('admin.commandCenter')}</NavLink>
              <NavLink to="/admin/search">{t('admin.deepSearch')}</NavLink>
              <NavLink to="/admin/communication">{t('nav.communication')}</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>
              <NavLink to="/procurement/marketplace">{t('nav.marketplace')}</NavLink>
              <NavLink to="/communication">{t('nav.communication')}</NavLink>
            </>
          )}
        </nav>
        <div className="px-actions" style={{ marginTop: 0 }}>
          <Tooltip title={t('pages.launcher.title')}>
            <span>
              <PlatformAppsButton expanded={isAdmin ? false : appsOpen} onClick={isAdmin ? openAdminApps : () => setAppsOpen((current) => !current)} />
            </span>
          </Tooltip>
          {isAdmin ? null : <PlatformAppsDrawer open={appsOpen} organizationLabel={organizationLabel} onSelect={selectPlatformApp} />}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
