// App launcher introduction shown after onboarding.

function getIamCompletionState() {
    const profile = mockData.eKycProfile || {};
    const account = mockData.pendingAccount || {};
    const isComplete = profile.status === 'completed' || account.ekycCompleted || mockData.session?.isNewUser === false;
    const registryRecord = profile.registryRecord || {};

    return {
        isComplete,
        statusLabel: isComplete ? 'Completed registration' : 'Registration required',
        badgeClass: isComplete ? 'badge-success' : 'badge-warning',
        reviewName: profile.verifiedName || registryRecord.name || account.displayName || 'Account holder',
        source: profile.registrySource || registryRecord.source || 'TRA / BRELA',
        entityType: profile.entityType || 'Individual, company, or business',
        registrationMethod: profile.businessRegistrationMethod || '',
        signature: profile.signatureName || 'Digital signature pending',
        reference: profile.tinNumber || profile.brelaNumber || profile.businessNumber || registryRecord.reference || 'Not captured'
    };
}

function appLauncherIcon(type) {
    const icons = {
        dashboard: '<path d="M3 13h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 21h8v-6H3z"/>',
        iam: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/>',
        procurement: '<path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/>',
        evaluation: '<path d="M9 11l2 2 4-4"/><path d="M8 4h8"/><path d="M8 20h8"/><path d="M5 7h14v10H5z"/>',
        awarding: '<circle cx="12" cy="8" r="4"/><path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5"/><path d="M10.5 8l1 1 2-2"/>',
        contracts: '<path d="M8 3h8l3 3v15H5V3z"/><path d="M15 3v4h4"/><path d="M8 12h8M8 16h6"/>',
        insights: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/>'
    };

    return `
        <svg class="app-tile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${icons[type]}
        </svg>
    `;
}

function renderAppLauncher() {
    const iam = getIamCompletionState();
    const apps = [
        {
            icon: 'iam',
            tone: 'iam',
            title: 'Registration and Verification',
            subtitle: 'Registration and identity verification',
            badge: iam.statusLabel,
            badgeClass: iam.badgeClass,
            nav: iam.isComplete ? 'account-profile' : 'identity-verification',
            action: iam.isComplete ? 'Review Account Profile' : 'Complete Identity Verification'
        },
        {
            icon: 'procurement',
            tone: 'procurement',
            title: 'Procurement',
            subtitle: 'Marketplace, create tender, bid',
            badge: 'Marketplace',
            badgeClass: 'badge-success',
            nav: 'marketplace',
            action: 'Open marketplace'
        },
        {
            icon: 'evaluation',
            tone: 'evaluation',
            title: 'Evaluation',
            subtitle: 'Bid opening, scoring, technical and financial review',
            badge: 'Review',
            badgeClass: 'badge-info',
            nav: 'bid-evaluation',
            action: 'Open evaluation'
        },
        {
            icon: 'awarding',
            tone: 'awarding',
            title: 'Awarding and Contract',
            subtitle: 'Award recommendation, approvals, and contract signature',
            badge: 'Award',
            badgeClass: 'badge-success',
            nav: 'award-recommendation',
            action: 'Open awarding'
        },
        {
            icon: 'contracts',
            tone: 'contracts',
            title: 'Records and History',
            subtitle: 'Past tenders, bids, awards, cancellations',
            badge: 'Archive',
            badgeClass: 'badge-info',
            nav: 'records-history',
            action: 'Open records'
        }
    ];

    return `
        <div class="workspace-home launcher-intro-page">
            <main class="workspace-shell launcher-shell">
                <section class="launcher-intro-hero">
                    <div>
                        <span class="section-kicker">Welcome to ProcureX</span>
                        <h1>Your account is ready. Choose where to start.</h1>
                        <p>Use the app launcher to move between Registration and Verification, Procurement, Evaluation, Awarding and Contract, Records, and dashboard analytics. The 9-dot app drawer stays at the top right on every workspace screen.</p>
                    </div>
                    <div class="launcher-intro-card">
                        <span class="badge ${iam.badgeClass}">${iam.statusLabel}</span>
                        <strong>${iam.reviewName}</strong>
                        <span>${iam.entityType}${iam.registrationMethod ? ` / ${iam.registrationMethod}` : ''}</span>
                        <button class="btn btn-primary" data-navigate="workspace-dashboard">Continue to Dashboard</button>
                    </div>
                </section>

                <section class="launcher-app-grid">
                    ${apps.map(app => `
                        <article class="launcher-app-card app-tone-${app.tone} ${app.disabled ? 'muted' : ''}">
                            <div class="app-tile-head">
                                <span class="app-icon">${appLauncherIcon(app.icon)}</span>
                                <span class="badge ${app.badgeClass}">${app.badge}</span>
                            </div>
                            <h2>${app.title}</h2>
                            <p>${app.subtitle}</p>
                            <button class="btn ${app.disabled ? 'btn-secondary' : 'btn-primary'}" ${app.disabled ? 'disabled' : `data-navigate="${app.nav}"`}>${app.action}</button>
                        </article>
                    `).join('')}
                </section>
            </main>
        </div>
    `;
}

if (window.app) {
    window.app.renderAppLauncher = renderAppLauncher;
}
