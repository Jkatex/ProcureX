import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/features/auth/api';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AuthAlert, authAlert, authAlertFromError, type AuthAlertMessage } from './AuthAlert';
import { TurnstileWidget } from './TurnstileWidget';

type ResetStep = 'request' | 'reset' | 'complete';

function passwordChecks(password: string) {
  return {
    length: password.length >= 8 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
}

function secondsUntil(value: string, now: number) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000));
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(remainingSeconds).padStart(2, '0')}` : `${remainingSeconds}s`;
}

export function ForgotPasswordProcurexPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialChallengeId = searchParams.get('challengeId') ?? '';
  const initialCode = searchParams.get('code') ?? '';
  const [step, setStep] = useState<ResetStep>(initialChallengeId ? 'reset' : 'request');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState('');
  const [message, setMessage] = useState<AuthAlertMessage | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const checks = useMemo(() => passwordChecks(password), [password]);
  const passwordReady = Object.values(checks).every(Boolean) && password === confirmPassword;
  const resendSeconds = secondsUntil(resendAvailableAt, now);

  useBodyPageMetadata('forgot-password');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function resetSecurityCheck() {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  }

  function requireSecurityCheck() {
    if (turnstileToken) return true;
    setMessage(authAlert('Complete the security check before continuing.', 'error'));
    return false;
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await authApi.forgotPassword({ email: email.trim(), turnstileToken });
      setMessage(authAlert(response.message, 'info'));
      if (response.challengeId) {
        setChallengeId(response.challengeId);
        setResendAvailableAt(response.resendAvailableAt ?? '');
        setStep('reset');
      }
    } catch (error) {
      setMessage(authAlertFromError(error, 'forgot-password'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function resendResetCode() {
    if (!challengeId || resendSeconds > 0) return;
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await authApi.resendResetCode({ challengeId, turnstileToken });
      if (response.challengeId) {
        setChallengeId(response.challengeId);
        setResendAvailableAt(response.resendAvailableAt ?? '');
      }
      setCode('');
      setMessage(authAlert(response.message, 'info'));
    } catch (error) {
      setMessage(authAlertFromError(error, 'resend-reset'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId || !code.trim()) {
      setMessage(authAlert('Open the reset link from your email or enter the reset code provided to you.', 'error'));
      return;
    }
    if (!passwordReady) {
      setMessage(authAlert('Complete all password requirements and confirm both passwords match.', 'error'));
      return;
    }
    if (!requireSecurityCheck()) return;

    setLoading(true);
    setMessage(null);

    try {
      await authApi.resetPassword({ challengeId, code: code.trim(), password, turnstileToken });
      setStep('complete');
      setMessage(authAlert('Your password has been updated.', 'success'));
    } catch (error) {
      setMessage(authAlertFromError(error, 'reset-password'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  return (
    <div className="register-page-new auth-page">
      <header className="register-header-new">
        <div className="register-header-inner-new">
          <button className="brand-new" type="button" onClick={() => navigate('/')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span className="brand-text-new">ProcureX</span>
          </button>
          <button className="login-link-new" type="button" onClick={() => navigate('/sign-in')}>
            Back to sign in
          </button>
        </div>
      </header>

      <div className="register-container-new">
        <div className="register-card-new auth-card">
          <div className="screens-container-new">
            {step === 'request' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>Reset Password</h2>
                  <p>Enter your account email to receive reset instructions.</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void requestReset(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="forgot-email">Email Address *</label>
                    <input id="forgot-email" className="form-input-new" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="forgot_password" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="btn-continue-new" type="submit" disabled={loading || !turnstileToken}>
                    {loading ? 'Sending...' : 'Send Reset Instructions'}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'reset' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>Create New Password</h2>
                  <p>Enter the reset code from your email and choose a new password.</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void submitReset(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="reset-code">Reset Code *</label>
                    <input id="reset-code" className="form-input-new" value={code} onChange={(event) => setCode(event.target.value)} required />
                    {resendAvailableAt ? (
                      <span className="form-hint-new">
                        {resendSeconds > 0 ? `Resend available in ${formatCountdown(resendSeconds)}.` : 'Resend is available.'}
                      </span>
                    ) : null}
                  </div>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="reset-password">New Password *</label>
                    <input id="reset-password" className="form-input-new password-input-new" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                    <ul className="password-requirements-new">
                      <li className={checks.length ? 'met' : ''}>8 or more characters</li>
                      <li className={checks.uppercase ? 'met' : ''}>Uppercase letter</li>
                      <li className={checks.number ? 'met' : ''}>Number</li>
                      <li className={checks.special ? 'met' : ''}>Special character</li>
                    </ul>
                  </div>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="reset-confirm-password">Confirm New Password *</label>
                    <input id="reset-confirm-password" className="form-input-new" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="reset_password" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="btn-continue-new" type="submit" disabled={loading || !passwordReady || !turnstileToken}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                  <button className="btn-resend-new" type="button" disabled={loading || resendSeconds > 0 || !turnstileToken} onClick={() => void resendResetCode()}>
                    Resend Reset Code
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'complete' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <div className="success-icon-new success-large">Done</div>
                  <h2>Password Updated</h2>
                  <p>You can now sign in with your new password.</p>
                </div>
                <button className="btn-continue-new btn-dashboard-new" type="button" onClick={() => navigate('/sign-in')}>
                  Sign In
                </button>
              </div>
            ) : null}

            <AuthAlert message={message} />
          </div>
        </div>
        <div className="auth-image-panel" aria-hidden="true">
          <dotlottie-player className="procurex-lottie auth-image-lottie" src="/assets/ProcureX.json" background="transparent" speed="1" loop autoplay />
        </div>
      </div>
    </div>
  );
}
