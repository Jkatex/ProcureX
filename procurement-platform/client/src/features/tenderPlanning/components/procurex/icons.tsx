import { resolveAppIconAsset } from '@/shared/components/procurex/appIconAssets';

type PlanningActionIconProps = {
  kind: 'create' | 'upload' | 'download' | 'view';
};

type AppMenuIconProps = {
  kind: 'iam' | 'planning' | 'procurement' | 'communication' | 'evaluation' | 'awarding' | 'records';
};

export function PlanningActionIcon({ kind }: PlanningActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'create' ? (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      ) : null}
      {kind === 'upload' ? (
        <>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </>
      ) : null}
      {kind === 'download' ? (
        <>
          <path d="M12 4v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M4 20h16" />
        </>
      ) : null}
      {kind === 'view' ? (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : null}
    </svg>
  );
}

export function AppMenuIcon({ kind }: AppMenuIconProps) {
  const imageSrc = resolveAppIconAsset(kind);

  if (imageSrc) {
    return (
      <span className="app-menu-icon app-menu-icon-image">
        <img className="app-menu-image" src={imageSrc} alt="" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="app-menu-icon">
      <svg
        className="app-menu-svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {kind === 'iam' ? (
          <>
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
            <path d="M16 11l2 2 4-4" />
          </>
        ) : null}
        {kind === 'planning' ? (
          <>
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8" />
            <path d="M8 12h8" />
            <path d="M8 16h5" />
          </>
        ) : null}
        {kind === 'procurement' ? (
          <>
            <path d="M3 9h18l-2-5H5z" />
            <path d="M5 9v11h14V9" />
            <path d="M9 13h6" />
            <path d="M9 17h4" />
          </>
        ) : null}
        {kind === 'communication' ? (
          <>
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </>
        ) : null}
        {kind === 'evaluation' ? (
          <>
            <path d="M9 11l2 2 4-4" />
            <path d="M8 4h8" />
            <path d="M8 20h8" />
            <path d="M5 7h14v10H5z" />
          </>
        ) : null}
        {kind === 'awarding' ? (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5" />
            <path d="M10.5 8l1 1 2-2" />
          </>
        ) : null}
        {kind === 'records' ? (
          <>
            <path d="M8 3h8l3 3v15H5V3z" />
            <path d="M15 3v4h4" />
            <path d="M8 12h8" />
            <path d="M8 16h6" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
