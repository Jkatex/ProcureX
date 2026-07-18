import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminAppsDrawer } from './AdminShared';
import { adminAppRegistry } from './AdminSharedUtils';
import { resolveAdminAppIconAsset } from './adminAppIconAssets';

describe('admin app registry', () => {
  it('matches the ProcureX admin app list order', () => {
    expect(adminAppRegistry.map((app) => [app.title, app.route])).toEqual([
      ['Command Center', '/admin'],
      ['User Management', '/admin/users'],
      ['Platform Analytics', '/admin/analytics'],
      ['Full Audit Trail', '/admin/audit'],
      ['Tender Review', '/admin/tender-review'],
      ['Communication Center', '/admin/communication'],
      ['Admin Profile', '/admin/profile'],
    ]);
  });

  it('keeps primary admin tools separate from secondary links', () => {
    expect(adminAppRegistry.filter((app) => app.group === 'primary')).toHaveLength(5);
    expect(adminAppRegistry.filter((app) => app.group === 'secondary').map((app) => app.key)).toEqual([
      'communication-center',
      'admin-profile',
    ]);
  });

  it('resolves a dedicated image icon for every registered admin app', () => {
    expect(adminAppRegistry.map((app) => [app.key, resolveAdminAppIconAsset(app.key)])).toEqual([
      ['command-center', '/assets/app-icons/admin/command-center.png'],
      ['user-management', '/assets/app-icons/admin/user-management.png'],
      ['platform-analytics', '/assets/app-icons/admin/platform-analytics.png'],
      ['full-audit-trail', '/assets/app-icons/admin/full-audit-trail.png'],
      ['tender-review', '/assets/app-icons/admin/tender-review.png'],
      ['communication-center', '/assets/app-icons/admin/communication-center.png'],
      ['admin-profile', '/assets/app-icons/admin/admin-profile.png'],
    ]);
  });

  it('renders admin app drawer entries with image icons', () => {
    const { container } = render(
      <AdminAppsDrawer
        open
        organizationLabel="Platform admin tools"
        apps={adminAppRegistry}
        onSelect={() => undefined}
      />
    );

    expect(screen.getByText('Admin Apps')).toBeInTheDocument();
    for (const app of adminAppRegistry) {
      expect(screen.getByRole('button', { name: new RegExp(app.title) })).toBeInTheDocument();
    }

    const images = Array.from(container.querySelectorAll<HTMLImageElement>('.admin-app-menu-image'));
    expect(images).toHaveLength(adminAppRegistry.length);
    expect(images.map((image) => image.getAttribute('src'))).toEqual(
      adminAppRegistry.map((app) => resolveAdminAppIconAsset(app.key))
    );
  });
});
