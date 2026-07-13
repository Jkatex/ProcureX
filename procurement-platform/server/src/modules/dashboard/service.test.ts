import { describe, expect, it } from 'vitest';
import { ModuleService } from './service.js';
import { dashboardQuerySchema } from './validators.js';
import type { DashboardQuery } from './types.js';

describe('dashboard module', () => {
  it('normalizes workspace dashboard query defaults', () => {
    expect(dashboardQuerySchema.parse({})).toEqual({
      deadlineWindowDays: 90,
      itemLimit: 8
    });
  });

  it('rejects unsafe dashboard query values', () => {
    expect(() => dashboardQuerySchema.parse({ organizationId: 'not-a-uuid' })).toThrow();
    expect(() => dashboardQuerySchema.parse({ deadlineWindowDays: 0 })).toThrow();
    expect(() => dashboardQuerySchema.parse({ itemLimit: 100 })).toThrow();
  });

  it('returns an empty dashboard contract when the database is unavailable', async () => {
    const query: DashboardQuery = {
      organizationId: '',
      deadlineWindowDays: 90,
      itemLimit: 8
    };
    const service = new ModuleService({
      health: async () => ({ ready: true }),
      workspaceDashboard: async () => {
        throw new Error("Can't reach database server");
      }
    } as any);

    await expect(service.workspaceDashboard(query)).resolves.toMatchObject({
      summary: {
        urgentCount: 0,
        workflowCount: 0,
        unreadMessages: 0,
        myTenders: 0,
        myBids: 0,
        recordedValue: 0,
        currency: 'TZS',
        complianceStatus: 'Clear'
      },
      pipeline: [
        { stage: 'Draft', count: 0 },
        { stage: 'Published', count: 0 },
        { stage: 'Evaluation', count: 0 },
        { stage: 'Award', count: 0 },
        { stage: 'Contract', count: 0 },
        { stage: 'Completed', count: 0 }
      ],
      actionQueue: [],
      deadlines: [],
      activeWork: []
    });
  });
});
