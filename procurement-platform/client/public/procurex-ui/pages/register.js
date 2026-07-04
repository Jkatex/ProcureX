// Account registration page.

function renderRegister() {
    return `
        <div class="register-page-new">
            <header class="register-header-new">
                <div class="register-header-inner-new">
                    <div class="brand-new" data-navigate="welcome">
                        ${renderPlatformLogo()}
                        <span class="brand-text-new">ProcureX</span>
                    </div>
                    <a href="#" data-navigate="sign-in" class="login-link-new">Already have an account? Sign in</a>
                </div>
            </header>

            <div class="register-container-new">
                <div class="register-card-new">
                    <div class="progress-section-new">
                        <div class="progress-steps-new">
                            <div class="progress-step-new active" data-step="1">
                                <div class="progress-circle-new">1</div>
                                <span class="progress-label-new">Account Info</span>
                            </div>
                            <div class="progress-line-new"></div>
                            <div class="progress-step-new" data-step="2">
                                <div class="progress-circle-new">2</div>
                                <span class="progress-label-new">Verify Contact</span>
                            </div>
                            <div class="progress-line-new"></div>
                            <div class="progress-step-new" data-step="3">
                                <div class="progress-circle-new">3</div>
                                <span class="progress-label-new">Activate</span>
                            </div>
                            <div class="progress-line-new"></div>
                            <div class="progress-step-new" data-step="4">
                                <div class="progress-circle-new">4</div>
                                <span class="progress-label-new">Password</span>
                            </div>
                        </div>
                    </div>

                    <div class="screens-container-new">
                        <div class="register-screen-new active" data-screen="1">
                            <div class="screen-header-new">
                                <h2>Join Us</h2>
                                <p>Create an account</p>
                            </div>

                            <button type="button" class="mock-fill-btn" data-fill-signup>
                                Use mock sign-up data
                            </button>

                            <form class="screen-form-new" data-action="register-step1">
                                <div class="form-group-new">
                                    <label class="form-label-new">Email Address *</label>
                                    <input type="email" class="form-input-new" name="email" placeholder="you@company.com" required>
                                    <span class="form-error-new"></span>
                                    <span class="form-hint-new">Your sign-in email and activation address.</span>
                                </div>

                                <div class="form-group-new">
                                    <label class="form-label-new">Mobile Number *</label>
                                    <input type="tel" class="form-input-new" name="phone" placeholder="+255 XXX XXX XXX" required>
                                    <span class="form-error-new"></span>
                                    <span class="form-hint-new">Used for one-time verification codes.</span>
                                </div>

                                <button type="submit" class="btn-continue-new">
                                    Continue
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            </form>
                        </div>

                        <div class="register-screen-new" data-screen="2">
                            <div class="screen-header-new">
                                <h2>Verify Your Number</h2>
                                <p>Enter the 6-digit code sent to <strong id="phone-display"></strong></p>
                            </div>

                            <form class="screen-form-new" data-action="register-step2" novalidate>
                                <div class="form-group-new">
                                    <label class="form-label-new">Verification Code *</label>
                                    <div class="otp-container-new">
                                        <input type="text" class="otp-input-new" maxlength="1" inputmode="numeric" pattern="[0-9]" required>
                                        <input type="text" class="otp-input-new" maxlength="1" inputmode="numeric" pattern="[0-9]" required>
                                        <input type="text" class="otp-input-new" maxlength="1" inputmode="numeric" pattern="[0-9]" required>
                                        <input type="text" class="otp-input-new" maxlength="1" inputmode="numeric" pattern="[0-9]" required>
                                        <input type="text" class="otp-input-new" maxlength="1" inputmode="numeric" pattern="[0-9]" required>
                                        <input type="text" class="otp-input-new" maxlength="1" inputmode="numeric" pattern="[0-9]" required>
                                    </div>
                                    <span class="form-error-new"></span>
                                </div>

                                <div class="otp-timer-new">
                                    <span>Resend code in <strong id="timer">30</strong>s</span>
                                </div>

                                <button type="submit" class="btn-continue-new" disabled>
                                    Verify
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </button>

                                <button type="button" class="btn-resend-new" id="resend-otp-btn" disabled>
                                    Resend Code
                                </button>
                            </form>
                        </div>

                        <div class="register-screen-new" data-screen="3">
                            <div class="screen-header-new">
                                <div class="success-icon-new">OK</div>
                                <h2>Activate Your Email</h2>
                                <p>An activation link was sent to <strong id="email-display"></strong></p>
                            </div>

                            <div class="activation-card-new">
                                <svg class="card-icon-new" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 6L9 17l-5-5"/>
                                </svg>
                                <h3>Email Sent Successfully</h3>
                                <p>Your account is activated after email confirmation, then you can create your password.</p>
                            </div>

                            <div class="activation-actions-new">
                                <button type="button" class="btn-open-email-new">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                        <polyline points="22 6 12 13 2 6"/>
                                    </svg>
                                    Open Email App
                                </button>
                                <button type="button" class="btn-resend-link-new">
                                    Resend Activation Link
                                </button>
                            </div>

                            <button type="button" class="btn-continue-new btn-continue-to-password-new">
                                Continue to Password Setup
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>

                        <div class="register-screen-new" data-screen="4">
                            <div class="screen-header-new">
                                <h2>Create Your Password</h2>
                                <p>This password is required on the sign-in screen.</p>
                            </div>

                            <form class="screen-form-new" data-action="register-step4">
                                <div class="form-group-new">
                                    <label class="form-label-new">Password *</label>
                                    <div class="password-input-wrapper-new">
                                        <input type="password" class="form-input-new password-input-new" name="password" placeholder="Enter strong password" required>
                                        <button type="button" class="password-toggle-new" aria-label="Show password">
                                            <svg class="icon-eye-new" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>
                                    </div>

                                    <div class="password-strength-new">
                                        <div class="strength-meter-new">
                                            <div class="strength-fill-new"></div>
                                        </div>
                                        <span class="strength-text-new">Strength: <strong>Weak</strong></span>
                                    </div>

                                    <ul class="password-requirements-new">
                                        <li data-requirement="length"><span class="requirement-icon-new">o</span>8-12 characters</li>
                                        <li data-requirement="uppercase"><span class="requirement-icon-new">o</span>Uppercase letter</li>
                                        <li data-requirement="number"><span class="requirement-icon-new">o</span>Number</li>
                                        <li data-requirement="special"><span class="requirement-icon-new">o</span>Special character</li>
                                    </ul>
                                </div>

                                <div class="form-group-new">
                                    <label class="form-label-new">Confirm Password *</label>
                                    <div class="password-input-wrapper-new">
                                        <input type="password" class="form-input-new confirm-password-new" name="confirmPassword" placeholder="Re-enter your password" required>
                                        <button type="button" class="password-toggle-new" aria-label="Show password">
                                            <svg class="icon-eye-new" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <span class="form-error-new"></span>
                                </div>

                                <div class="form-group-new confirm-action" data-confirm-control>
                                    <input type="checkbox" class="confirm-action-input" id="terms-accept-new" name="termsAccepted" required>
                                    <button type="button" class="confirm-action-button" data-confirm-toggle aria-pressed="false">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M20 6L9 17l-5-5"/>
                                        </svg>
                                        <span>Confirm agreement</span>
                                    </button>
                                    <p class="confirm-action-note" data-confirm-note>
                                        Confirm that you accept the <a href="?page=terms-and-conditions" class="link-new" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and <a href="?page=privacy-policy" class="link-new" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                                    </p>
                                </div>

                                <button type="submit" class="btn-continue-new btn-create-new" disabled>
                                    Create Account
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            </form>
                        </div>

                        <div class="register-screen-new" data-screen="5">
                            <div class="screen-header-new">
                                <div class="success-icon-new success-large">Done</div>
                                <h2>Account Created</h2>
                                <p>Your login credentials are ready. Sign in to continue with identity verification.</p>
                            </div>

                            <div class="success-card-new">
                                <div class="success-detail">
                                    <strong>Next step: Sign in</strong>
                                    <p>After sign-in, new users complete identity verification before entering the platform.</p>
                                </div>
                            </div>

                            <button type="button" class="btn-continue-new btn-dashboard-new" data-navigate="sign-in">
                                Sign In
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
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
