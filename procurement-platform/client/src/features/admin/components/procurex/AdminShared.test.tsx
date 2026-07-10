import { describe, expect, it } from 'vitest';
import { adminAppRegistry } from './AdminShared';

describe('admin app registry', () => {
  it('matches the ProcureX admin app list order', () => {
    expect(adminAppRegistry.map((app) => [app.title, app.route])).toEqual([
      ['Command Center', '/admin'],
      ['Deep Search', '/admin/search'],
      ['User Management', '/admin/users'],
      ['Compliance Rules', '/admin/compliance'],
      ['Platform Analytics', '/admin/analytics'],
      ['Full Audit Trail', '/admin/audit'],
      ['Data Store', '/admin/datastore'],
      ['Tender Review', '/admin/tender-review'],
      ['Communication Center', '/admin/communication'],
      ['Admin Profile', '/admin/profile'],
    ]);
  });

  it('keeps primary admin tools separate from secondary links', () => {
    expect(adminAppRegistry.filter((app) => app.group === 'primary')).toHaveLength(8);
    expect(adminAppRegistry.filter((app) => app.group === 'secondary').map((app) => app.key)).toEqual([
      'communication-center',
      'admin-profile',
    ]);
  });
});
