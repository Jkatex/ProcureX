export const adminAppIconAssetPaths = {
  'command-center': '/assets/app-icons/admin/command-center.png',
  'deep-search': '/assets/app-icons/admin/deep-search.png',
  'user-management': '/assets/app-icons/admin/user-management.png',
  'compliance-rules': '/assets/app-icons/admin/compliance-rules.png',
  'platform-analytics': '/assets/app-icons/admin/platform-analytics.png',
  'full-audit-trail': '/assets/app-icons/admin/full-audit-trail.png',
  'data-store': '/assets/app-icons/admin/data-store.png',
  'communication-center': '/assets/app-icons/admin/communication-center.png',
  'admin-profile': '/assets/app-icons/admin/admin-profile.png'
} as const;

export type AdminAppIconAssetKey = keyof typeof adminAppIconAssetPaths;

export function resolveAdminAppIconAsset(key: string) {
  return Object.prototype.hasOwnProperty.call(adminAppIconAssetPaths, key)
    ? adminAppIconAssetPaths[key as AdminAppIconAssetKey]
    : null;
}
