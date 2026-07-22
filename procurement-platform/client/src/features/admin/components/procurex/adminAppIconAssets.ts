/* Renders the admin admin App Icon Assets UI while keeping page-specific presentation near its workflow data. */
export const adminAppIconAssetPaths = {
  'command-center': '/assets/app-icons/admin/command-center.png',
  'user-management': '/assets/app-icons/admin/user-management.png',
  'platform-analytics': '/assets/app-icons/admin/platform-analytics.png',
  'full-audit-trail': '/assets/app-icons/admin/full-audit-trail.png',
  'tender-review': '/assets/app-icons/admin/tender-review.png',
  'communication-center': '/assets/app-icons/admin/communication-center.png',
  'admin-profile': '/assets/app-icons/admin/admin-profile.png'
} as const;

export type AdminAppIconAssetKey = keyof typeof adminAppIconAssetPaths;

export function resolveAdminAppIconAsset(key: string) {
  return Object.prototype.hasOwnProperty.call(adminAppIconAssetPaths, key)
    ? adminAppIconAssetPaths[key as AdminAppIconAssetKey]
    : null;
}
