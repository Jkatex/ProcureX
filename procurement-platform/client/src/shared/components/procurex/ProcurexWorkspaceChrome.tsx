/* Renders the shared Procurex Workspace Chrome UI while keeping page-specific presentation near its workflow data. */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AccountMenu } from '@/shared/components/AccountMenu';
import {
  PlatformAppsButton,
  PlatformAppsDrawer,
  resolvePlatformAppRoute,
  type PlatformAppPageKey
} from './PlatformAppsDrawer';

type ProcurexWorkspaceChromeProps = {
  title: string;
  children: ReactNode;
};

export function ProcurexWorkspaceChrome({ title, children }: ProcurexWorkspaceChromeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [appsOpen, setAppsOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const organizationLabel = user?.organization || t('platformApps.accountTools');

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

  return (
    <>
      <header className="app-topbar" ref={headerRef}>
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" onClick={() => navigate('/dashboard')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>{title}</span>
          </button>
        </div>

        <div className="app-topbar-actions">
          <PlatformAppsButton expanded={appsOpen} onClick={() => setAppsOpen((current) => !current)} />
          <div className="profile-menu-wrap">
            <AccountMenu buttonClassName="profile-button" />
          </div>
        </div>

        <PlatformAppsDrawer open={appsOpen} organizationLabel={organizationLabel} onSelect={selectPlatformApp} />
      </header>
      {children}
    </>
  );
}
