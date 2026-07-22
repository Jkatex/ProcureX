/* Renders the shared Workspace Top Bar UI while keeping page-specific presentation near its workflow data. */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/app/store';
import { AccountMenu } from '@/shared/components/AccountMenu';
import {
  PlatformAppsButton,
  PlatformAppsDrawer,
  type PlatformAppPageKey
} from '@/shared/components/procurex/PlatformAppsDrawer';

type WorkspaceTopBarProps = {
  title?: string;
  onNavigate: (pageKey: string) => void;
};

export function WorkspaceTopBar({ title = 'ProcureX', onNavigate }: WorkspaceTopBarProps) {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const [appsOpen, setAppsOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const organizationLabel = user?.organization || (user?.accountType === 'ADMIN' ? t('platformApps.adminTools') : t('platformApps.accountTools'));
  const localizedTitle = t(`pages.${title.toLowerCase()}.title`, { defaultValue: title });

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

  function navigate(pageKey: string) {
    setAppsOpen(false);
    onNavigate(pageKey);
  }

  function navigatePlatformApp(pageKey: PlatformAppPageKey) {
    navigate(pageKey);
  }

  return (
    <header className="app-topbar" ref={headerRef}>
      <div className="app-topbar-left">
        <button
          className="app-brand-button"
          type="button"
          data-navigate="workspace-dashboard"
          onClick={() => navigate('workspace-dashboard')}
        >
          <span className="platform-logo">
            <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
          </span>
          <span>{localizedTitle}</span>
        </button>
      </div>

      <div className="app-topbar-actions">
        <PlatformAppsButton
          expanded={appsOpen}
          onClick={() => setAppsOpen((current) => !current)}
        />
        <div className="profile-menu-wrap">
          <AccountMenu buttonClassName="profile-button" />
        </div>
      </div>

      <PlatformAppsDrawer open={appsOpen} organizationLabel={organizationLabel} onSelect={navigatePlatformApp} />
    </header>
  );
}
