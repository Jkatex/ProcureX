import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/features/auth/api';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AuthAlert, authAlert, authAlertFromError, type AuthAlertMessage } from './AuthAlert';
import { TurnstileWidget } from './TurnstileWidget';

type ResetStep = 'request' | 'verify' | 'password' | 'complete';

function passwordChecks(password: string) {
  return {
    length: password.length >= 8 && password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
}

function RequirementIcon({ met }: { met: boolean }) {
  return (
    <span className={`requirement-icon-new ${met ? 'met' : ''}`}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {met ? <path d="M16.2 5.8 8.4 13.6 4.3 9.5" /> : <circle cx="10" cy="10" r="6.5" />}
      </svg>
      <span className="sr-only">{met ? 'Requirement met:' : 'Requirement not met:'}</span>
    </span>
  );
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialChallengeId = searchParams.get('challengeId') ?? '';
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const initialCode = searchParams.get('code') ?? hashParams.get('code') ?? '';
  const [step, setStep] = useState<ResetStep>(initialChallengeId ? 'verify' : 'request');
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
  const passwordRequirements = t('auth.register.password.requirements', { returnObjects: true }) as string[];

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
    setMessage(authAlert('auth.security.missing', 'error'));
    return false;
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await authApi.forgotPassword({ email: email.trim(), turnstileToken });
      if (response.accountFound && response.challengeId) {
        setChallengeId(response.challengeId);
        setResendAvailableAt(response.resendAvailableAt ?? '');
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setStep('verify');
        setMessage(authAlert('auth.forgotPassword.messages.resetRequested', 'info'));
      } else {
        setChallengeId('');
        setResendAvailableAt('');
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setStep('request');
        setMessage(authAlert('auth.forgotPassword.messages.accountNotFound', 'error'));
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
      setStep('verify');
      setMessage(authAlert('auth.forgotPassword.messages.resetResent', 'info'));
    } catch (error) {
      setMessage(authAlertFromError(error, 'resend-reset'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function verifyResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId || !code.trim()) {
      setMessage(authAlert('auth.forgotPassword.messages.missingCode', 'error'));
      return;
    }
    if (!requireSecurityCheck()) return;

    setLoading(true);
    setMessage(null);

    try {
      await authApi.verifyResetCode({ challengeId, code: code.trim(), turnstileToken });
      setPassword('');
      setConfirmPassword('');
      setStep('password');
      setMessage(authAlert('auth.forgotPassword.messages.codeVerified', 'success'));
    } catch (error) {
      setMessage(authAlertFromError(error, 'reset-password'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId || !code.trim()) {
      setMessage(authAlert('auth.forgotPassword.messages.missingCode', 'error'));
      setStep('verify');
      return;
    }
    if (!passwordReady) {
      setMessage(authAlert('auth.forgotPassword.messages.passwordRequirements', 'error'));
      return;
    }
    if (!requireSecurityCheck()) return;

    setLoading(true);
    setMessage(null);

    try {
      await authApi.resetPassword({ challengeId, code: code.trim(), password, turnstileToken });
      setStep('complete');
      setMessage(authAlert('auth.forgotPassword.messages.updated', 'success'));
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
          <div className="auth-header-actions-new">
            <span className="procurex-language-inline procurex-language-inline--auth">
              <LanguageSwitcher />
            </span>
            <button className="login-link-new" type="button" onClick={() => navigate('/sign-in')}>
              {t('auth.forgotPassword.headerBack')}
            </button>
          </div>
        </div>
      </header>

      <div className="register-container-new">
        <div className="register-card-new auth-card">
          <div className="screens-container-new">
            {step === 'request' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>{t('auth.forgotPassword.request.title')}</h2>
                  <p>{t('auth.forgotPassword.request.subtitle')}</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void requestReset(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="forgot-email">{t('auth.forgotPassword.request.email')}</label>
                    <input id="forgot-email" className="form-input-new" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="forgot_password" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="btn-continue-new" type="submit" disabled={loading || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? t('auth.forgotPassword.request.submitting') : t('auth.forgotPassword.request.submit')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'verify' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>{t('auth.forgotPassword.verify.title')}</h2>
                  <p>{t('auth.forgotPassword.verify.subtitle')}</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void verifyResetCode(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="reset-code">{t('auth.forgotPassword.verify.code')}</label>
                    <input id="reset-code" className="form-input-new" value={code} autoComplete="one-time-code" onChange={(event) => setCode(event.target.value)} required />
                    {resendAvailableAt ? (
                      <span className="form-hint-new">
                        {resendSeconds > 0 ? t('auth.forgotPassword.verify.resendIn', { time: formatCountdown(resendSeconds) }) : t('auth.forgotPassword.verify.resendAvailable')}
                      </span>
                    ) : null}
                  </div>
                  <TurnstileWidget action="verify_reset_code" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep('request')}>
                    {t('actions.back')}
                  </button>
                  <button className="btn-continue-new" type="submit" disabled={loading || !code.trim() || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? t('auth.forgotPassword.verify.submitting') : t('auth.forgotPassword.verify.submit')}
                  </button>
                  <button className="btn-resend-new" type="button" disabled={loading || resendSeconds > 0 || !turnstileToken} onClick={() => void resendResetCode()}>
                    {t('auth.forgotPassword.verify.resend')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'password' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>{t('auth.forgotPassword.reset.title')}</h2>
                  <p>{t('auth.forgotPassword.reset.subtitle')}</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void submitNewPassword(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="reset-password">{t('auth.forgotPassword.reset.password')}</label>
                    <input id="reset-password" className={`form-input-new password-input-new ${message?.tone === 'error' && !checks.length ? 'is-invalid' : ''}`} type="password" value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} required />
                    <ul className="password-requirements-new">
                      <li className={checks.length ? 'met' : ''}><RequirementIcon met={checks.length} />{passwordRequirements[0]}</li>
                      <li className={checks.uppercase ? 'met' : ''}><RequirementIcon met={checks.uppercase} />{passwordRequirements[1]}</li>
                      <li className={checks.number ? 'met' : ''}><RequirementIcon met={checks.number} />{passwordRequirements[2]}</li>
                      <li className={checks.special ? 'met' : ''}><RequirementIcon met={checks.special} />{passwordRequirements[3]}</li>
                    </ul>
                  </div>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="reset-confirm-password">{t('auth.forgotPassword.reset.confirmPassword')}</label>
                    <input id="reset-confirm-password" className={`form-input-new ${message?.tone === 'error' && confirmPassword && password !== confirmPassword ? 'is-invalid' : ''}`} type="password" value={confirmPassword} maxLength={128} onChange={(event) => setConfirmPassword(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="reset_password" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep('verify')}>
                    {t('actions.back')}
                  </button>
                  <button className="btn-continue-new" type="submit" disabled={loading || !passwordReady || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? t('auth.forgotPassword.reset.submitting') : t('auth.forgotPassword.reset.submit')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'complete' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <div className="success-icon-new success-large">{t('auth.register.done')}</div>
                  <h2>{t('auth.forgotPassword.complete.title')}</h2>
                  <p>{t('auth.forgotPassword.complete.body')}</p>
                </div>
                <button className="btn-continue-new btn-dashboard-new" type="button" onClick={() => navigate('/sign-in')}>
                  {t('actions.signIn')}
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
