export const appIconAssetPaths = {
  iam: '/assets/app-icons/registration-verification.png',
  procurement: '/assets/app-icons/procurement.png',
  communication: '/assets/app-icons/communication-center.png',
  evaluation: '/assets/app-icons/evaluation.png',
  awarding: '/assets/app-icons/award-contract.png',
  postAward: '/assets/app-icons/post-award.svg',
  records: '/assets/app-icons/records-history.png'
} as const;

export type AppIconAssetKind = keyof typeof appIconAssetPaths;

export function resolveAppIconAsset(kind: string) {
  return Object.prototype.hasOwnProperty.call(appIconAssetPaths, kind) ? appIconAssetPaths[kind as AppIconAssetKind] : null;
}
