import { ProcurexStaticPage } from '@/shared/components/procurex/ProcurexStaticPage';

const html = `
  <header class="app-topbar">
    <div class="app-topbar-left">
      <button class="app-brand-button" type="button" data-navigate="workspace-dashboard">
        <span class="platform-logo">
          <img class="platform-logo-image" src="/assets/logo.svg" alt="ProcureX">
        </span>
        <span>Tender Planning</span>
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

      <button class="app-menu-card app-menu-iam" data-navigate="account-profile">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/>
          </svg>
        </span>
        <span><strong>Registration and Verification</strong><em>Account and identity verification</em></span>
      </button>
      <button class="app-menu-card app-menu-procurement" data-navigate="tender-planning">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>
          </svg>
        </span>
        <span><strong>Tender Planning</strong><em>APP, SPP, budgets, approvals</em></span>
      </button>
      <button class="app-menu-card app-menu-procurement" data-navigate="marketplace">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/><path d="M9 17h4"/>
          </svg>
        </span>
        <span><strong>Procurement</strong><em>Marketplace, create tender, bid</em></span>
      </button>
      <button class="app-menu-card app-menu-communication" data-navigate="communication-center">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>
          </svg>
        </span>
        <span><strong>Communication Center</strong><em>Messages, clarifications, alerts</em></span>
      </button>
      <button class="app-menu-card app-menu-evaluation" data-navigate="bid-evaluation">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 11l2 2 4-4"/><path d="M8 4h8"/><path d="M8 20h8"/><path d="M5 7h14v10H5z"/>
          </svg>
        </span>
        <span><strong>Evaluation</strong><em>Evaluate bids on your tenders</em></span>
      </button>
      <button class="app-menu-card app-menu-awarding" data-navigate="awarding-contracts">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4"/><path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5"/><path d="M10.5 8l1 1 2-2"/>
          </svg>
        </span>
        <span><strong>Awarding and Contract</strong><em>Awards, negotiations, signatures</em></span>
      </button>
      <button class="app-menu-card app-menu-contracts" data-navigate="records-history">
        <span class="app-menu-icon">
          <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3h8l3 3v15H5V3z"/><path d="M15 3v4h4"/><path d="M8 12h8"/><path d="M8 16h6"/>
          </svg>
        </span>
        <span><strong>Records and History</strong><em>Past tenders, bids, awards</em></span>
      </button>
    </div>

    <div class="profile-menu" data-profile-menu>
      <button type="button" data-navigate="account-profile">Profile</button>
      <button type="button" data-navigate="communication-center">Messages</button>
      <button type="button">Help</button>
      <button type="button">Language</button>
      <button type="button" data-navigate="sign-in">Logout</button>
    </div>
  </header>

  <div class="main-layout procurement-layout awarding-contracts-page tender-planning-page">
    <main class="main-content procurement-content awarding-contracts-workspace tender-planning-content">
      <nav class="planning-top-nav" aria-label="Tender planning sections">
        <a href="#planning-dashboard" class="planning-nav-card active"><span>01</span><strong>Procurement details</strong><em>Overview and readiness</em></a>
        <a href="#spp-plan" class="planning-nav-card"><span>02</span><strong>Questions and requirements</strong><em>SPP schedule and permissions</em></a>
        <a href="#budget-confirmation" class="planning-nav-card"><span>03</span><strong>Complaints</strong><em>Risks, alerts, and actions</em></a>
        <a href="#planning-reports" class="planning-nav-card"><span>04</span><strong>Monitoring and reporting</strong><em>APP and SPP exports</em></a>
        <a href="#app-plan" class="planning-nav-card"><span>05</span><strong>Customer information</strong><em>APP item and department data</em></a>
        <a href="#budget-confirmation" class="planning-nav-card"><span>06</span><strong>Purchase information</strong><em>Budget and funding checks</em></a>
        <a href="#planning-documents" class="planning-nav-card"><span>07</span><strong>Tender documentation</strong><em>Evidence and approvals</em></a>
        <a href="#planning-documents" class="planning-nav-card"><span>08</span><strong>Documents</strong><em>Register and review status</em></a>
      </nav>

      <section class="procurement-hero evaluation-hero-panel award-hero-panel tender-planning-hero planning-command-hero" id="planning-dashboard">
        <div>
          <span class="section-kicker">Planning before tendering</span>
          <h1>Tender Planning</h1>
          <p>Manage APP and SPP records before Tender/RFQ, Evaluation, Award and Contract, Delivery, Inspection, Payment, and Closeout.</p>
          <div class="inline-actions">
            <button class="btn btn-primary" type="button">New APP Item</button>
            <button class="btn btn-secondary" type="button" data-awarding-tab-jump="documents">Upload Plan Documents</button>
          </div>
        </div>
        <div class="planning-command-panel">
          <div class="planning-command-panel-head">
            <span>Portfolio readiness</span>
            <strong>73%</strong>
          </div>
          <div class="planning-readiness-meter" aria-hidden="true"><i style="width: 73%"></i></div>
          <div class="planning-command-list">
            <div><strong>42</strong><span>APP items captured</span></div>
            <div><strong>18</strong><span>SPP schedules active</span></div>
            <div><strong>7</strong><span>Activities need attention</span></div>
          </div>
        </div>
      </section>

      <div class="award-info-banner tender-planning-flow">
        <strong>Workflow</strong>
        <span>APP &rarr; SPP &rarr; Budget Confirmation &rarr; Approval &rarr; Tender/RFQ &rarr; Evaluation &rarr; Award and Contract &rarr; Delivery &rarr; Inspection &rarr; Payment &rarr; Closeout</span>
      </div>

      <div class="planning-workflow-stepper" aria-label="Tender planning workflow">
        <span class="complete">APP</span>
        <span class="complete">SPP</span>
        <span class="active">Budget</span>
        <span>Approval</span>
        <span>Tender/RFQ</span>
        <span>Evaluation</span>
        <span>Award</span>
        <span>Delivery</span>
        <span>Inspection</span>
        <span>Payment</span>
        <span>Closeout</span>
      </div>

      <section class="awarding-summary-grid">
        <button class="awarding-summary-card" type="button" data-awarding-tab-jump="dashboard">
          <span class="summary-trend" aria-hidden="true">!</span>
          <strong>9</strong>
          <span>Budget checks <em class="summary-view">View</em></span>
          <em>Finance confirmations awaiting action</em>
        </button>
        <button class="awarding-summary-card" type="button" data-awarding-tab-jump="app">
          <span class="summary-trend" aria-hidden="true">+</span>
          <strong>6</strong>
          <span>Approved APP <em class="summary-view">Create SPP</em></span>
          <em>Items ready to generate detailed activities</em>
        </button>
        <button class="awarding-summary-card" type="button" data-awarding-tab-jump="spp">
          <span class="summary-trend" aria-hidden="true">%</span>
          <strong>73%</strong>
          <span>Average progress <em class="summary-view">Track</em></span>
          <em>SPP activity completion across departments</em>
        </button>
        <button class="awarding-summary-card" type="button" data-awarding-tab-jump="approvals">
          <span class="summary-trend" aria-hidden="true">?</span>
          <strong>11</strong>
          <span>Approvals <em class="summary-view">Open</em></span>
          <em>Head of procurement and tender board queues</em>
        </button>
        <button class="awarding-summary-card" type="button" data-awarding-tab-jump="documents">
          <span class="summary-trend" aria-hidden="true">#</span>
          <strong>24</strong>
          <span>Documents <em class="summary-view">Review</em></span>
          <em>Plans, specifications, budget notes, and approvals</em>
        </button>
      </section>

      <section class="procurement-panel evaluation-panel awarding-tabs-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">Planning sections</span>
            <h2>APP, SPP, budgets, approvals, documents, reports, and handoff are managed here</h2>
            <p class="panel-note">Approved plans feed Tender/RFQ and later Award and Contract without living inside the Awarding app.</p>
          </div>
          <div class="inline-actions">
            <button class="btn btn-secondary btn-sm" type="button">Export Excel</button>
            <button class="btn btn-secondary btn-sm" type="button">Export PDF</button>
          </div>
        </div>

        <div class="planning-filter-bar">
          <label>Search <input class="form-input" placeholder="APP item, SPP code, department" aria-label="Search planning records"></label>
          <label>Department <select class="form-input" aria-label="Filter by department"><option>All departments</option><option>ICT</option><option>Health Services</option><option>Operations</option></select></label>
          <label>Status <select class="form-input" aria-label="Filter by status"><option>All statuses</option><option>Draft</option><option>Budget confirmed</option><option>Approved</option><option>Delayed</option></select></label>
          <button class="btn btn-secondary btn-sm" type="button">Apply filters</button>
        </div>

        <div class="tabs awarding-contract-tabs tender-planning-tabs">
          <div class="tab active" data-tab="dashboard">Dashboard</div>
          <div class="tab" data-tab="app">Annual Procurement Plan</div>
          <div class="tab" data-tab="spp">Specific Procurement Plan</div>
          <div class="tab" data-tab="budget">Budget Confirmation</div>
          <div class="tab" data-tab="approvals">Plan Approvals</div>
          <div class="tab" data-tab="documents">Documents</div>
          <div class="tab" data-tab="reports">Planning Reports</div>
        </div>

        <div class="awarding-tab-content tender-planning-tab-content">
          <div class="tab-content tab-content--visible" data-tab="dashboard">
            <div class="planning-executive-grid">
              <article class="planning-premium-card planning-readiness-card">
                <div>
                  <span class="section-kicker">Executive snapshot</span>
                  <h3>Planning readiness</h3>
                  <p>Approved demand, confirmed budget, and SPP activities are tracking toward tender handoff.</p>
                </div>
                <div class="planning-ring" aria-hidden="true"><strong>73%</strong><span>ready</span></div>
              </article>
              <article class="planning-premium-card">
                <span class="section-kicker">Next milestone</span>
                <h3>Tender/RFQ preparation</h3>
                <p>6 approved APP items can be converted into SPP schedules this week.</p>
                <div class="planning-card-foot"><span class="badge badge-success">On track</span><strong>Jun 7</strong></div>
              </article>
              <article class="planning-premium-card">
                <span class="section-kicker">Risk watch</span>
                <h3>Budget shortfalls</h3>
                <p>Fleet maintenance and two works packages need finance clearance before approval.</p>
                <div class="planning-card-foot"><span class="badge badge-warning">3 risks</span><strong>TZS 94M</strong></div>
              </article>
              <article class="planning-premium-card">
                <span class="section-kicker">Handoff quality</span>
                <h3>Document completeness</h3>
                <p>Needs assessment, specifications, approval memo, and budget note coverage.</p>
                <div class="planning-card-foot"><span class="badge badge-info">24 files</span><strong>88%</strong></div>
              </article>
            </div>
            <div class="planning-dashboard-grid">
              <article class="dashboard-panel">
                <div class="panel-heading">
                  <div>
                    <span class="section-kicker">Progress tracking</span>
                    <h2>SPP activity health</h2>
                  </div>
                  <span class="badge badge-warning">7 delayed</span>
                </div>
                <div class="planning-progress-list">
                  <div><strong>Specifications</strong><span><i style="width: 92%"></i></span><em>92%</em></div>
                  <div><strong>Budget confirmation</strong><span><i style="width: 68%"></i></span><em>68%</em></div>
                  <div><strong>Tender/RFQ preparation</strong><span><i style="width: 54%"></i></span><em>54%</em></div>
                  <div><strong>Publication readiness</strong><span><i style="width: 37%"></i></span><em>37%</em></div>
                </div>
              </article>
              <article class="dashboard-panel">
                <div class="panel-heading">
                  <div>
                    <span class="section-kicker">Reminders and alerts</span>
                    <h2>Delayed activity alerts</h2>
                  </div>
                </div>
                <div class="dashboard-action-queue planning-alert-list">
                  <button class="dashboard-action-row critical" type="button"><span class="dashboard-action-count">3</span><div><strong>Budget confirmation overdue</strong><span>Finance officer action required today</span></div><em>Critical</em><b>Remind</b></button>
                  <button class="dashboard-action-row attention" type="button"><span class="dashboard-action-count">4</span><div><strong>Specifications delayed</strong><span>Requesting departments have pending uploads</span></div><em>Attention</em><b>Notify</b></button>
                </div>
              </article>
            </div>
            <div class="data-table evaluation-table-scroll awarding-contracts-table">
              <table>
                <thead><tr><th>Pipeline item</th><th>Current stage</th><th>Owner role</th><th>Next action</th><th>Integration</th></tr></thead>
                <tbody>
                  <tr><td><strong>Hospital theatre equipment</strong><span>APP-2026-014 / SPP-2026-006</span></td><td><span class="badge badge-success">Approved</span></td><td>Procurement officer</td><td><button class="btn btn-primary btn-sm" type="button" data-navigate="create-tender">Create Tender/RFQ</button></td><td>Tender/RFQ handoff ready</td></tr>
                  <tr><td><strong>Fleet maintenance framework</strong><span>APP-2026-021 / SPP pending</span></td><td><span class="badge badge-warning">Budget review</span></td><td>Finance officer</td><td><button class="btn btn-secondary btn-sm" type="button">Confirm budget</button></td><td>Blocked before tendering</td></tr>
                  <tr><td><strong>Ward renovation works</strong><span>APP-2026-027 / SPP-2026-011</span></td><td><span class="badge badge-info">Approval</span></td><td>Tender board/approver</td><td><button class="btn btn-secondary btn-sm" type="button">Review approval</button></td><td>Will feed Award and Contract after evaluation</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="tab-content tab-content--hidden" data-tab="app" id="app-plan">
            <div class="planning-form-card">
              <div class="panel-heading">
                <div>
                  <span class="section-kicker">Annual Procurement Plan</span>
                  <h2>Capture APP item details</h2>
                </div>
                <span class="badge badge-info">Draft APP</span>
              </div>
              <form class="planning-form-grid" data-action="save-app">
                <label>Financial year <input class="form-input" value="2026/2027" aria-label="Financial year"></label>
                <label>Department <input class="form-input" value="Health Services" aria-label="Department"></label>
                <label>Procurement item <input class="form-input" value="Hospital theatre equipment" aria-label="Procurement item"></label>
                <label>Category <select class="form-input" aria-label="Category"><option>Goods</option><option>Works</option><option>Services</option><option>Consultancy</option></select></label>
                <label>Estimated budget <input class="form-input" value="TZS 480,000,000" aria-label="Estimated budget"></label>
                <label>Funding source <input class="form-input" value="Development budget" aria-label="Funding source"></label>
                <label>Procurement method <select class="form-input" aria-label="Procurement method"><option>National competitive tendering</option><option>RFQ</option><option>Framework agreement</option><option>Restricted tendering</option></select></label>
                <label>Planned dates <input class="form-input" value="Jul 2026 - Nov 2026" aria-label="Planned dates"></label>
                <label>Responsible officer <input class="form-input" value="Amina Yusuf" aria-label="Responsible officer"></label>
                <label>Priority <select class="form-input" aria-label="Priority"><option>High</option><option>Medium</option><option>Low</option></select></label>
                <label>Status <select class="form-input" aria-label="APP status"><option>Draft</option><option>Submitted</option><option>Approved</option><option>Returned</option></select></label>
                <div class="planning-upload-box"><strong>Document uploads</strong><span>APP schedule, needs assessment, budget note, approvals</span><button class="btn btn-secondary btn-sm" type="button">Attach files</button></div>
                <div class="form-status" data-form-status></div>
                <div class="inline-actions"><button class="btn btn-primary" type="submit">Save APP Item</button><button class="btn btn-secondary" type="button">Submit for Review</button></div>
              </form>
            </div>
            <div class="data-table evaluation-table-scroll awarding-contracts-table">
              <table>
                <thead><tr><th>APP item</th><th>FY</th><th>Department</th><th>Budget</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td><strong>Hospital theatre equipment</strong><span>APP-2026-014</span></td><td>2026/2027</td><td>Health Services</td><td>TZS 480,000,000</td><td>NCT</td><td><span class="badge badge-success">Approved</span></td><td><button class="btn btn-primary btn-sm" type="button">Create SPP</button></td></tr>
                  <tr><td><strong>Fleet maintenance framework</strong><span>APP-2026-021</span></td><td>2026/2027</td><td>Operations</td><td>TZS 125,000,000</td><td>Framework</td><td><span class="badge badge-warning">Budget review</span></td><td><button class="btn btn-secondary btn-sm" type="button">Review</button></td></tr>
                  <tr><td><strong>Ward renovation works</strong><span>APP-2026-027</span></td><td>2026/2027</td><td>Infrastructure</td><td>TZS 760,000,000</td><td>NCT</td><td><span class="badge badge-success">Approved</span></td><td><button class="btn btn-primary btn-sm" type="button">Create SPP</button></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="tab-content tab-content--hidden" data-tab="spp" id="spp-plan">
            <div class="planning-spp-layout">
              <article class="dashboard-panel">
                <div class="panel-heading"><div><span class="section-kicker">Specific Procurement Plan</span><h2>Generated activity schedule</h2></div><span class="badge badge-info">SPP-2026-006</span></div>
                <div class="planning-timeline-list">
                  <div><strong>Specifications</strong><span>Requesting department</span><em class="badge badge-success">Complete</em></div>
                  <div><strong>Budget confirmation</strong><span>Finance officer</span><em class="badge badge-warning">Due today</em></div>
                  <div><strong>Requisition approval</strong><span>Head of department</span><em class="badge badge-info">Queued</em></div>
                  <div><strong>Tender/RFQ preparation</strong><span>Procurement officer</span><em class="badge badge-info">Queued</em></div>
                  <div><strong>Publication</strong><span>Procurement officer</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Bid submission</strong><span>Suppliers</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Evaluation</strong><span>Evaluation committee</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Award recommendation</strong><span>Procurement officer</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Contract preparation</strong><span>Legal and procurement</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Delivery</strong><span>Supplier and stores</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Inspection</strong><span>Inspection committee</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Payment</strong><span>Finance officer</span><em class="badge badge-info">Planned</em></div>
                  <div><strong>Closeout</strong><span>Records and audit</span><em class="badge badge-info">Planned</em></div>
                </div>
              </article>
              <article class="dashboard-panel">
                <div class="panel-heading"><div><span class="section-kicker">Access control</span><h2>Role-based access</h2></div></div>
                <div class="data-table evaluation-table-scroll awarding-contracts-table planning-roles-table">
                  <table>
                    <thead><tr><th>Role</th><th>Planning access</th><th>Approval rights</th></tr></thead>
                    <tbody>
                      <tr><td>Requesting department</td><td>Create needs, specs, APP requests</td><td>Submit requisition</td></tr>
                      <tr><td>Procurement officer</td><td>Manage APP/SPP and tender handoff</td><td>Recommend plan</td></tr>
                      <tr><td>Finance officer</td><td>Budget checks and funding source</td><td>Confirm budget</td></tr>
                      <tr><td>Head of procurement</td><td>Portfolio oversight</td><td>Approve SPP</td></tr>
                      <tr><td>Tender board/approver</td><td>Review approvals</td><td>Approve or return</td></tr>
                      <tr><td>Auditor</td><td>Read-only plans and audit trail</td><td>None</td></tr>
                      <tr><td>Admin</td><td>Configure users, roles, thresholds</td><td>Override by policy</td></tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          </div>

          <div class="tab-content tab-content--hidden" data-tab="budget" id="budget-confirmation">
            <div class="data-table evaluation-table-scroll awarding-contracts-table">
              <table>
                <thead><tr><th>Plan item</th><th>Funding source</th><th>Estimated budget</th><th>Committed</th><th>Finance status</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td><strong>Hospital theatre equipment</strong></td><td>Development budget</td><td>TZS 480,000,000</td><td>TZS 480,000,000</td><td><span class="badge badge-success">Confirmed</span></td><td><button class="btn btn-secondary btn-sm" type="button">View confirmation</button></td></tr>
                  <tr><td><strong>Fleet maintenance framework</strong></td><td>Operational budget</td><td>TZS 125,000,000</td><td>TZS 90,000,000</td><td><span class="badge badge-warning">Shortfall</span></td><td><button class="btn btn-primary btn-sm" type="button">Resolve</button></td></tr>
                  <tr><td><strong>Ward renovation works</strong></td><td>Capital projects</td><td>TZS 760,000,000</td><td>TZS 760,000,000</td><td><span class="badge badge-info">Pending confirmation</span></td><td><button class="btn btn-primary btn-sm" type="button">Confirm</button></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="tab-content tab-content--hidden" data-tab="approvals" id="plan-approvals">
            <div class="planning-approval-grid">
              <article class="dashboard-panel planning-modal-panel">
                <div class="panel-heading"><div><span class="section-kicker">Approval queue</span><h2>Plan approvals</h2></div><span class="badge badge-warning">11 pending</span></div>
                <div class="status-section-list dashboard-account-compliance">
                  <div class="status-section attention"><strong>SPP-2026-006</strong><span>Head of procurement approval required</span><button class="btn btn-primary btn-sm" type="button">Approve</button></div>
                  <div class="status-section attention"><strong>APP-2026-021</strong><span>Finance returned budget shortfall</span><button class="btn btn-secondary btn-sm" type="button">Return</button></div>
                  <div class="status-section"><strong>SPP-2026-011</strong><span>Tender board review scheduled</span><button class="btn btn-secondary btn-sm" type="button">Open</button></div>
                </div>
              </article>
              <article class="dashboard-panel planning-modal-panel">
                <div class="panel-heading"><div><span class="section-kicker">Audit trail</span><h2>Recent planning events</h2></div><span class="badge badge-info">Auditor view</span></div>
                <div class="dashboard-activity-feed">
                  <button class="dashboard-activity-item" type="button"><div><strong>Finance confirmed budget</strong><span>Hospital theatre equipment / Fatma M., Finance officer</span></div><time>Jun 2, 2026</time></button>
                  <button class="dashboard-activity-item" type="button"><div><strong>SPP generated from approved APP</strong><span>SPP-2026-006 / Amina Yusuf</span></div><time>Jun 1, 2026</time></button>
                  <button class="dashboard-activity-item" type="button"><div><strong>Document uploaded</strong><span>Specifications attachment / Requesting department</span></div><time>May 31, 2026</time></button>
                </div>
              </article>
            </div>
          </div>

          <div class="tab-content tab-content--hidden" data-tab="documents" id="planning-documents">
            <div class="planning-documents-grid">
              <article class="dashboard-panel">
                <div class="panel-heading">
                  <div>
                    <span class="section-kicker">Document uploads</span>
                    <h2>Planning document register</h2>
                  </div>
                  <span class="badge badge-warning">5 pending review</span>
                </div>
                <div class="planning-upload-box planning-document-dropzone">
                  <div>
                    <strong>Attach APP/SPP evidence</strong>
                    <span>Needs assessment, specifications/TOR, budget confirmation, approval memo, board minutes, and handoff notes</span>
                  </div>
                  <button class="btn btn-primary btn-sm" type="button">Upload documents</button>
                </div>
                <div class="data-table evaluation-table-scroll awarding-contracts-table planning-documents-table">
                  <table>
                    <thead><tr><th>Document</th><th>Linked record</th><th>Owner</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      <tr><td><strong>Needs assessment</strong><span>PDF / 1.8 MB</span></td><td>APP-2026-014</td><td>Requesting department</td><td><span class="badge badge-success">Accepted</span></td><td><button class="btn btn-secondary btn-sm" type="button">View</button></td></tr>
                      <tr><td><strong>Specifications/TOR</strong><span>DOCX / version 3</span></td><td>SPP-2026-006</td><td>Procurement officer</td><td><span class="badge badge-warning">Review</span></td><td><button class="btn btn-primary btn-sm" type="button">Approve</button></td></tr>
                      <tr><td><strong>Budget confirmation note</strong><span>PDF / finance signed</span></td><td>APP-2026-021</td><td>Finance officer</td><td><span class="badge badge-info">Pending</span></td><td><button class="btn btn-secondary btn-sm" type="button">Remind</button></td></tr>
                      <tr><td><strong>Tender board approval</strong><span>Minutes extract</span></td><td>SPP-2026-011</td><td>Tender board secretary</td><td><span class="badge badge-warning">Missing signature</span></td><td><button class="btn btn-secondary btn-sm" type="button">Request update</button></td></tr>
                    </tbody>
                  </table>
                </div>
              </article>
              <article class="dashboard-panel planning-document-review">
                <div class="panel-heading">
                  <div>
                    <span class="section-kicker">Review modal preview</span>
                    <h2>Document approval decision</h2>
                  </div>
                  <span class="badge badge-info">Role controlled</span>
                </div>
                <div class="planning-modal-card">
                  <strong>Specifications/TOR for Hospital theatre equipment</strong>
                  <span>Linked to SPP-2026-006 and required before Tender/RFQ preparation can start.</span>
                  <label>Reviewer comment <textarea class="form-input" rows="4" placeholder="Add approval note or return reason"></textarea></label>
                  <div class="inline-actions">
                    <button class="btn btn-primary btn-sm" type="button">Approve document</button>
                    <button class="btn btn-secondary btn-sm" type="button">Return for correction</button>
                  </div>
                </div>
                <div class="status-section-list dashboard-account-compliance">
                  <div class="status-section attention"><strong>Expiry reminder</strong><span>Funding letter expires in 14 days</span><button class="btn btn-secondary btn-sm" type="button">Notify owner</button></div>
                  <div class="status-section"><strong>Access rule</strong><span>Auditors can view all documents; finance can approve budget evidence only.</span><button class="btn btn-secondary btn-sm" type="button">View roles</button></div>
                </div>
              </article>
            </div>
          </div>

          <div class="tab-content tab-content--hidden" data-tab="reports" id="planning-reports">
            <div class="planning-report-grid">
              <article class="analytics-card"><span>APP by department</span><strong>42 items</strong><p>Grouped by financial year, department, category, method, priority, and status.</p><button class="btn btn-secondary btn-sm" type="button">Export Excel</button></article>
              <article class="analytics-card"><span>Budget confirmation</span><strong>TZS 2.4B</strong><p>Funding source coverage, shortfalls, and finance confirmation aging.</p><button class="btn btn-secondary btn-sm" type="button">Export PDF</button></article>
              <article class="analytics-card"><span>SPP progress</span><strong>73%</strong><p>Activity completion, delayed activity alerts, and responsible officer workload.</p><button class="btn btn-secondary btn-sm" type="button">Open report</button></article>
              <article class="analytics-card"><span>Approval performance</span><strong>2.8 days</strong><p>Average approval cycle by role, approver, department, and method threshold.</p><button class="btn btn-secondary btn-sm" type="button">Open report</button></article>
              <article class="analytics-card"><span>Document readiness</span><strong>79%</strong><p>Required APP/SPP evidence, missing uploads, expiring documents, and review aging.</p><button class="btn btn-secondary btn-sm" type="button">Export PDF</button></article>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
`;

export function TenderPlanningProcurexPage() {
  return <ProcurexStaticPage pageKey="tender-planning" html={html} />;
}
