import { ProcurexStaticPage } from '@/shared/components/procurex/ProcurexStaticPage';

const html = `
  <header class="app-topbar">
    <div class="app-topbar-left">
      <button class="app-brand-button" type="button" data-navigate="workspace-dashboard">
        <span class="platform-logo">
          <img class="platform-logo-image" src="/assets/logo.svg" alt="ProcureX">
        </span>
        <span>Apps</span>
      </button>
    </div>

    <div class="app-topbar-actions">
      <button class="icon-menu-btn" type="button" data-app-menu-toggle aria-label="Open apps" aria-expanded="false">
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
      </button>
      <div class="profile-menu-wrap">
        <button class="profile-button" type="button" data-profile-menu-toggle aria-label="Open profile menu" aria-expanded="false">
          <span>AU</span>
        </button>
      </div>
    </div>

    <div class="app-drawer-menu" data-app-menu>
      <div class="app-menu-header">
        <div class="app-menu-brand">
          <span class="platform-logo platform-logo-sm">
            <img class="platform-logo-image" src="/assets/logo.svg" alt="ProcureX">
          </span>
          <strong>ProcureX Apps</strong>
        </div>
        <span>Company account tools</span>
      </div>
      <button class="app-menu-card app-menu-iam" data-navigate="account-profile"><span class="app-menu-icon"><svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/></svg></span><span><strong>Registration and Verification</strong><em>Account and identity verification</em></span></button>
      <button class="app-menu-card app-menu-procurement" data-navigate="tender-planning"><span class="app-menu-icon"><svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg></span><span><strong>Tender Planning</strong><em>APP, SPP, budgets, approvals</em></span></button>
      <button class="app-menu-card app-menu-procurement" data-navigate="marketplace"><span class="app-menu-icon"><svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/><path d="M9 17h4"/></svg></span><span><strong>Procurement</strong><em>Marketplace, create tender, bid</em></span></button>
      <button class="app-menu-card app-menu-evaluation" data-navigate="bid-evaluation"><span class="app-menu-icon"><svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l2 2 4-4"/><path d="M8 4h8"/><path d="M8 20h8"/><path d="M5 7h14v10H5z"/></svg></span><span><strong>Evaluation</strong><em>Evaluate bids on your tenders</em></span></button>
      <button class="app-menu-card app-menu-awarding" data-navigate="awarding-contracts"><span class="app-menu-icon"><svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5"/><path d="M10.5 8l1 1 2-2"/></svg></span><span><strong>Awarding and Contract</strong><em>Awards, negotiations, signatures</em></span></button>
      <button class="app-menu-card app-menu-contracts" data-navigate="records-history"><span class="app-menu-icon"><svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l3 3v15H5V3z"/><path d="M15 3v4h4"/><path d="M8 12h8"/><path d="M8 16h6"/></svg></span><span><strong>Records and History</strong><em>Past tenders, bids, awards</em></span></button>
    </div>

    <div class="profile-menu" data-profile-menu>
      <button type="button" data-navigate="account-profile">Profile</button>
      <button type="button" data-navigate="communication-center">Messages</button>
      <button type="button">Help</button>
      <button type="button">Language</button>
      <button type="button" data-navigate="sign-in">Logout</button>
    </div>
  </header>

  <div class="workspace-home launcher-intro-page">
    <main class="workspace-shell launcher-shell">
      <section class="launcher-intro-hero">
        <div>
          <span class="section-kicker">Welcome to ProcureX</span>
          <h1>Your account is ready. Choose where to start.</h1>
          <p>Use the app launcher to move between Registration and Verification, Tender Planning, Procurement, Evaluation, Awarding and Contract, Records, and dashboard analytics.</p>
        </div>
        <div class="launcher-intro-card">
          <span class="badge badge-warning">Registration required</span>
          <strong>Account holder</strong>
          <span>Individual, company, or business</span>
          <button class="btn btn-primary" data-navigate="workspace-dashboard">Continue to Dashboard</button>
        </div>
      </section>

      <section class="launcher-app-grid">
        <article class="launcher-app-card app-tone-iam">
          <div class="app-tile-head"><span class="app-icon"><svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/></svg></span><span class="badge badge-warning">Registration required</span></div>
          <h2>Registration and Verification</h2>
          <p>Registration and identity verification</p>
          <button class="btn btn-primary" data-navigate="identity-verification">Complete Identity Verification</button>
        </article>
        <article class="launcher-app-card app-tone-procurement">
          <div class="app-tile-head"><span class="app-icon"><svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg></span><span class="badge badge-info">Planning</span></div>
          <h2>Tender Planning</h2>
          <p>APP, SPP, budget confirmation, approvals, reports, and Tender/RFQ handoff</p>
          <button class="btn btn-primary" data-navigate="tender-planning">Open planning</button>
        </article>
        <article class="launcher-app-card app-tone-procurement">
          <div class="app-tile-head"><span class="app-icon"><svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/></svg></span><span class="badge badge-success">Marketplace</span></div>
          <h2>Procurement</h2>
          <p>Marketplace, create tender, bid</p>
          <button class="btn btn-primary" data-navigate="marketplace">Open marketplace</button>
        </article>
        <article class="launcher-app-card app-tone-evaluation">
          <div class="app-tile-head"><span class="app-icon"><svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l2 2 4-4"/><path d="M8 4h8"/><path d="M8 20h8"/><path d="M5 7h14v10H5z"/></svg></span><span class="badge badge-info">Review</span></div>
          <h2>Evaluation</h2>
          <p>Bid opening, scoring, technical and financial review</p>
          <button class="btn btn-primary" data-navigate="bid-evaluation">Open evaluation</button>
        </article>
        <article class="launcher-app-card app-tone-awarding">
          <div class="app-tile-head"><span class="app-icon"><svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5"/><path d="M10.5 8l1 1 2-2"/></svg></span><span class="badge badge-success">Lifecycle</span></div>
          <h2>Awarding and Contract</h2>
          <p>Awards, negotiations, signatures, delivery, and closure</p>
          <button class="btn btn-primary" data-navigate="awarding-contracts">Open workspace</button>
        </article>
        <article class="launcher-app-card app-tone-contracts">
          <div class="app-tile-head"><span class="app-icon"><svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l3 3v15H5V3z"/><path d="M15 3v4h4"/><path d="M8 12h8M8 16h6"/></svg></span><span class="badge badge-info">Archive</span></div>
          <h2>Records and History</h2>
          <p>Past tenders, bids, awards, cancellations</p>
          <button class="btn btn-primary" data-navigate="records-history">Open records</button>
        </article>
      </section>
    </main>
  </div>
`;

export function AppLauncherProcurexPage() {
  return <ProcurexStaticPage pageKey="app-launcher" html={html} />;
}
