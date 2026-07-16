import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAppSelector } from '@/app/store';

const userLinks = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: DashboardRoundedIcon },
  { to: '/identity/profile', labelKey: 'nav.identity', icon: VerifiedUserRoundedIcon },
  { to: '/procurement/marketplace', labelKey: 'nav.procurement', icon: StoreRoundedIcon },
  { to: '/bidding', labelKey: 'nav.bidding', icon: AssignmentTurnedInRoundedIcon },
  { to: '/evaluation', labelKey: 'nav.evaluation', icon: AccountTreeRoundedIcon },
  { to: '/awards-contracts', labelKey: 'nav.awards', icon: GavelRoundedIcon },
  { to: '/communication', labelKey: 'nav.communication', icon: ChatRoundedIcon },
  { to: '/records', labelKey: 'nav.records', icon: FolderRoundedIcon }
];

const adminLinks = [
  { to: '/admin', labelKey: 'pages.adminDashboard.title', icon: AdminPanelSettingsRoundedIcon },
  { to: '/admin/users', labelKey: 'pages.adminUsers.title', icon: VerifiedUserRoundedIcon },
  { to: '/admin/analytics', labelKey: 'pages.adminAnalytics.title', icon: DashboardRoundedIcon },
  { to: '/admin/audit', labelKey: 'pages.adminAudit.title', icon: FolderRoundedIcon }
];

export function SidebarNav() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const links = user?.accountType === 'ADMIN' ? adminLinks : userLinks;

  return (
    <aside className="px-sidebar">
      <NavLink className="px-brand" to={user?.accountType === 'ADMIN' ? '/admin' : '/dashboard'}>
        <img src="/assets/logo.svg" alt="" />
        <span>{t('brand')}</span>
      </NavLink>
      <nav aria-label={t('nav.workspace')}>
        {links.map(({ to, labelKey, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/admin' || to === '/dashboard'}>
            <Icon fontSize="small" />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
