// Onboarding entry page component

function renderRoleSelection() {
    return `
        <div class="role-page-v2">
            <main class="role-shell-v2">
                <section class="role-hero-v2">
                    <div>
                        <span class="section-kicker">Registration</span>
                        <h1>Start ProcureX onboarding.</h1>
                        <p>Create an account or sign in to continue with identity verification, profile review, and workspace access.</p>
                    </div>
                </section>

                <section class="role-flow-v2" aria-label="Onboarding steps">
                    <div>
                        <strong>01</strong>
                        <span>Account</span>
                    </div>
                    <div>
                        <strong>02</strong>
                        <span>Identity Verification</span>
                    </div>
                    <div>
                        <strong>03</strong>
                        <span>Verification review</span>
                    </div>
                </section>

                <section class="role-card-grid-v2">
                    <button class="role-card-v2" type="button" data-navigate="register">
                        <span class="role-icon-v2">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 21v-2a4 4 0 00-8 0v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </span>
                        <h3>Create Account</h3>
                        <p>Register your login credentials before completing identity verification.</p>
                    </button>

                    <button class="role-card-v2" type="button" data-navigate="sign-in">
                        <span class="role-icon-v2">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 17l5-5-5-5"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H3"></path>
                            </svg>
                        </span>
                        <h3>Sign In</h3>
                        <p>Continue to identity verification or enter the platform with an existing account.</p>
                    </button>
                </section>

                <div>
                    <button class="btn btn-secondary" data-navigate="welcome">Back</button>
                </div>
            </main>
        </div>
    `;
}

if (window.app) {
    window.app.renderRoleSelection = renderRoleSelection;
}
