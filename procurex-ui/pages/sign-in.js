// Sign-in page shown after account registration.

function renderSignIn() {
    const savedEmail = mockData.pendingAccount?.email || mockData.registrationDraft?.email || '';
    const savedPassword = mockData.pendingAccount?.password || '';

    return `
        <div class="register-page-new auth-page">
            <header class="register-header-new">
                <div class="register-header-inner-new">
                    <div class="brand-new" data-navigate="welcome">
                        ${renderPlatformLogo()}
                        <span class="brand-text-new">ProcureX</span>
                    </div>
                    <a href="#" data-navigate="register" class="login-link-new">Create an account</a>
                </div>
            </header>

            <div class="register-container-new">
                <div class="register-card-new auth-card">
                    <div class="screens-container-new">
                        <div class="screen-header-new">
                            <h2>Welcome Back</h2>
                            <p>Sign in</p>
                        </div>

                        <form class="screen-form-new" data-action="sign-in">
                            <div class="form-group-new">
                                <label class="form-label-new">Email Address *</label>
                                <input type="email" class="form-input-new" name="email" value="${savedEmail}" placeholder="you@company.com" required>
                                <span class="form-error-new"></span>
                            </div>

                            <div class="form-group-new">
                                <label class="form-label-new">Password *</label>
                                <div class="password-input-wrapper-new">
                                    <input type="password" class="form-input-new" name="password" value="${savedPassword}" placeholder="Enter your password" required>
                                    <button type="button" class="password-toggle-new" aria-label="Show password">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                </div>
                                <span class="form-error-new"></span>
                            </div>

                            <div class="auth-row">
                                <label class="auth-check">
                                    <input type="checkbox" name="remember">
                                    <span>Remember me</span>
                                </label>
                                <a href="#" class="link-new">Forgot password?</a>
                            </div>

                            <button type="submit" class="btn-continue-new">
                                Sign In
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </form>

                        <div class="auth-note">
                            New users continue to identity verification. Existing users enter the platform.
                        </div>
                    </div>
                </div>
                <div class="auth-image-panel" aria-hidden="true">
                    ${typeof renderProcureXLottie === 'function' ? renderProcureXLottie('procurex-lottie auth-image-lottie', 'ProcureX auth animation') : ''}
                </div>
            </div>
        </div>
    `;
}
