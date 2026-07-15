import { Fragment, FormEvent, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/features/auth/api';
import { useCurrentLegalVersions } from '@/features/public/hooks';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AuthAlert, authAlert, authAlertFromError, type AuthAlertMessage } from './AuthAlert';
import { TurnstileWidget } from './TurnstileWidget';

type RegisterStep = 1 | 2 | 3 | 4 | 5;

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

export function RegisterProcurexPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useBodyPageMetadata('register');
  const [step, setStep] = useState<RegisterStep>(1);
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+255');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [activationChallengeId, setActivationChallengeId] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [challengeExpiresAt, setChallengeExpiresAt] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState('');
  const [activationExpiresAt, setActivationExpiresAt] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [status, setStatus] = useState<AuthAlertMessage | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const activeScreenRef = useRef<HTMLDivElement | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const legalVersions = useCurrentLegalVersions();
  const checks = useMemo(() => passwordChecks(password), [password]);
  const passwordReady = Object.values(checks).every(Boolean) && password === confirmPassword && termsAccepted;
  const otpDigits = otp.padEnd(6, ' ').slice(0, 6).split('');
  const otpReady = otp.length === 6;
  const challengeSeconds = secondsUntil(challengeExpiresAt, now);
  const resendSeconds = secondsUntil(resendAvailableAt, now);
  const activationSeconds = secondsUntil(activationExpiresAt, now);
  const strengthScore = Object.values(checks).filter(Boolean).length;
  const strengthKey = strengthScore >= 4 ? 'strong' : strengthScore >= 3 ? 'good' : strengthScore >= 2 ? 'fair' : 'weak';
  const progressSteps = t('auth.register.progress', { returnObjects: true }) as string[];
  const passwordRequirements = t('auth.register.password.requirements', { returnObjects: true }) as string[];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      activeScreenRef.current?.querySelector<HTMLElement>('input, button:not([disabled])')?.focus();
    }, 0);
  }, [step]);

  function normalizedPhone() {
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '');
    const local = trimmed.replace(/[^\d]/g, '').replace(/^0+/, '');
    return `${phoneCountry}${local}`;
  }

  function updateOtpFrom(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const next = otp.split('');
      next[index] = '';
      setOtp(next.join('').slice(0, 6));
      return;
    }

    const next = otp.padEnd(6, ' ').split('');
    digits
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });
    const nextOtp = next.join('').replace(/\s/g, '').slice(0, 6);
    setOtp(nextOtp);
    const nextFocus = Math.min(index + digits.length, 5);
    window.setTimeout(() => otpRefs.current[nextFocus]?.focus(), 0);
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    setOtp(digits);
    window.setTimeout(() => otpRefs.current[Math.min(digits.length, 6) - 1]?.focus(), 0);
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otpDigits[index].trim() && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function resetSecurityCheck() {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  }

  function requireSecurityCheck() {
    if (turnstileToken) return true;
    setStatus(authAlert('auth.security.missing', 'error'));
    return false;
  }

  async function submitAccountInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await authApi.startRegistration({ email, phone: normalizedPhone(), turnstileToken });
      setOtpChallengeId(result.challengeId);
      setChallengeExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt ?? '');
      setOtp('');
      setStep(2);
    } catch (error) {
      setStatus(authAlertFromError(error, 'registration'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const result = await authApi.verifyOtp({ challengeId: otpChallengeId, code: otp });
      setActivationChallengeId(result.activationChallengeId);
      setActivationExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt ?? '');
      setActivationCode('');
      setStep(3);
    } catch (error) {
      setStatus(authAlertFromError(error, 'otp'));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!otpChallengeId || resendSeconds > 0) return;
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await authApi.resendOtp({ challengeId: otpChallengeId, turnstileToken });
      setOtpChallengeId(result.challengeId);
      setChallengeExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt ?? '');
      setOtp('');
      setStatus(authAlert('auth.register.messages.otpResent', 'success'));
    } catch (error) {
      setStatus(authAlertFromError(error, 'resend-otp'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await authApi.activateEmail({ challengeId: activationChallengeId, code: activationCode.trim() });
      setStep(4);
    } catch (error) {
      setStatus(authAlertFromError(error, 'activation'));
    } finally {
      setLoading(false);
    }
  }

  async function resendActivation() {
    if (!activationChallengeId || resendSeconds > 0) return;
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await authApi.resendActivation({ challengeId: activationChallengeId, turnstileToken });
      setActivationChallengeId(result.activationChallengeId);
      setActivationExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt ?? '');
      setActivationCode('');
      setStatus(authAlert('auth.register.messages.activationResent', 'success'));
    } catch (error) {
      setStatus(authAlertFromError(error, 'resend-activation'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordReady) {
      setStatus(authAlert('auth.register.messages.passwordRequirements', 'error'));
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await authApi.setPassword({
        email,
        password,
        termsAccepted: true,
        privacyAccepted: true,
        termsVersionId: legalVersions.data?.terms.id,
        privacyVersionId: legalVersions.data?.privacy.id
      });
      setStep(5);
    } catch (error) {
      setStatus(authAlertFromError(error, 'password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-page-new">
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
              {t('auth.register.headerSignIn')}
            </button>
          </div>
        </div>
      </header>

      <div className="register-container-new">
        <div className="register-card-new">
          <div className="progress-section-new">
            <div className="progress-steps-new">
              {progressSteps.map((label, index) => {
                const itemStep = index + 1;
                return (
                  <Fragment key={label}>
                    <div className={`progress-step-new ${step === itemStep ? 'active' : ''} ${step > itemStep ? 'completed' : ''}`} data-step={itemStep} key={label}>
                      <div className="progress-circle-new">{step > itemStep ? t('auth.register.ok') : itemStep}</div>
                      <span className="progress-label-new">{label}</span>
                    </div>
                    {itemStep < 4 ? <div className="progress-line-new" aria-hidden="true" /> : null}
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="screens-container-new">
            {step === 1 ? (
              <div className="register-screen-new active" ref={activeScreenRef}>
                <div className="screen-header-new">
                  <h2>{t('auth.register.account.title')}</h2>
                  <p>{t('auth.register.account.subtitle')}</p>
                </div>
                <form className="screen-form-new" onSubmit={submitAccountInfo}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="register-email">{t('auth.register.account.email')}</label>
                    <input id="register-email" className="form-input-new" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('auth.register.account.emailPlaceholder')} required />
                    <span className="form-hint-new">{t('auth.register.account.emailHint')}</span>
                  </div>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="register-phone">{t('auth.register.account.phone')}</label>
                    <div className="phone-entry-new">
                      <select className="form-input-new" value={phoneCountry} aria-label="Phone country code" onChange={(event) => setPhoneCountry(event.target.value)}>
                        <option value="+255">TZ +255</option>
                        <option value="+254">KE +254</option>
                        <option value="+256">UG +256</option>
                        <option value="+250">RW +250</option>
                        <option value="+257">BI +257</option>
                      </select>
                      <input id="register-phone" className="form-input-new" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t('auth.register.account.phonePlaceholder')} required />
                    </div>
                    <span className="form-hint-new">{t('auth.register.account.phoneHint')}</span>
                  </div>
                  <TurnstileWidget action="registration_start" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="btn-continue-new" type="submit" disabled={loading || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {t('actions.continue')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="register-screen-new active" ref={activeScreenRef}>
                <div className="screen-header-new">
                  <h2>{t('auth.register.otp.title')}</h2>
                  <p>{t('auth.register.otp.subtitle')} <strong>{normalizedPhone()}</strong></p>
                </div>
                <form className="screen-form-new" onSubmit={submitOtp} noValidate>
                  <div className="form-group-new">
                    <label className="form-label-new" id="register-otp-label">{t('auth.register.otp.label')}</label>
                    <div className="otp-container-new">
                      {otpDigits.map((digit, index) => (
                        <input
                          aria-label={t('auth.register.otp.digitAria', { index: index + 1 })}
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          className="otp-input-new"
                          inputMode="numeric"
                          key={index}
                          maxLength={1}
                          onChange={(event) => updateOtpFrom(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          onPaste={handleOtpPaste}
                          pattern="[0-9]"
                          ref={(element) => {
                            otpRefs.current[index] = element;
                          }}
                          required
                          type="text"
                          value={digit.trim()}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="otp-timer-new">
                    <span>
                      {challengeSeconds > 0 ? (
                        <>{t('auth.register.otp.expiresIn')} <strong>{formatCountdown(challengeSeconds)}</strong></>
                      ) : (
                        t('auth.register.otp.expired')
                      )}
                    </span>
                    {resendAvailableAt ? (
                      <span>
                        {resendSeconds > 0 ? (
                          <>{t('auth.register.otp.resendIn')} <strong>{formatCountdown(resendSeconds)}</strong></>
                        ) : (
                          t('auth.register.otp.resendAvailable')
                        )}
                      </span>
                    ) : null}
                  </div>
                  <TurnstileWidget action="registration_resend_otp" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button className="btn-resend-new" type="button" disabled={loading || resendSeconds > 0 || !turnstileToken} onClick={() => void resendOtp()}>
                    {t('auth.register.otp.resend')}
                  </button>
                  <button className="btn-continue-new" type="submit" disabled={loading || !otpReady}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {t('auth.register.otp.verify')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="register-screen-new active" ref={activeScreenRef}>
                <div className="screen-header-new">
                  <div className="success-icon-new">{t('auth.register.ok')}</div>
                  <h2>{t('auth.register.activation.title')}</h2>
                  <p>{t('auth.register.activation.subtitle')} <strong>{email}</strong></p>
                </div>
                <div className="activation-card-new">
                  <svg className="card-icon-new" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <h3>{t('auth.register.activation.sentTitle')}</h3>
                  <p>{t('auth.register.activation.sentBody')}</p>
                </div>
                <form className="screen-form-new" onSubmit={submitActivation}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="register-activation-code">{t('auth.register.activation.label')}</label>
                    <input id="register-activation-code" className="form-input-new" value={activationCode} autoComplete="one-time-code" onChange={(event) => setActivationCode(event.target.value)} required />
                    {activationExpiresAt ? <span className="form-hint-new">{t('auth.register.activation.expiresIn', { time: formatCountdown(activationSeconds) })}</span> : null}
                  </div>
                  <div className="activation-actions-new">
                    <button className="btn-resend-link-new" type="button" disabled={loading || resendSeconds > 0 || !turnstileToken} onClick={() => void resendActivation()}>
                      {t('auth.register.activation.resend')}
                    </button>
                  </div>
                  <TurnstileWidget action="registration_resend_activation" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button className="btn-continue-new btn-continue-to-password-new" type="submit" disabled={loading || activationCode.trim().length < 8}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {t('auth.register.activation.continue')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="register-screen-new active" ref={activeScreenRef}>
                <div className="screen-header-new">
                  <h2>{t('auth.register.password.title')}</h2>
                  <p>{t('auth.register.password.subtitle')}</p>
                </div>
                <form className="screen-form-new" onSubmit={submitPassword}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="register-password">{t('auth.register.password.label')}</label>
                    <div className="password-input-wrapper-new">
                      <input id="register-password" className={`form-input-new password-input-new ${status?.tone === 'error' && !checks.length ? 'is-invalid' : ''}`} type={showPassword ? 'text' : 'password'} value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.register.password.placeholder')} required />
                      <button className="password-toggle-new" type="button" aria-label={showPassword ? t('auth.register.password.hide') : t('auth.register.password.show')} onClick={() => setShowPassword((value) => !value)}>
                        <svg className="icon-eye-new" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                    <div className="password-strength-new">
                      <div className="strength-meter-new">
                        <div className="strength-fill-new" style={{ width: `${strengthScore * 25}%` }} />
                      </div>
                      <span className="strength-text-new">{t('auth.register.password.strength')} <strong>{t(`auth.register.password.strengthLabels.${strengthKey}`)}</strong></span>
                    </div>
                    <ul className="password-requirements-new">
                      <li className={checks.length ? 'met' : ''}><RequirementIcon met={checks.length} />{passwordRequirements[0]}</li>
                      <li className={checks.uppercase ? 'met' : ''}><RequirementIcon met={checks.uppercase} />{passwordRequirements[1]}</li>
                      <li className={checks.number ? 'met' : ''}><RequirementIcon met={checks.number} />{passwordRequirements[2]}</li>
                      <li className={checks.special ? 'met' : ''}><RequirementIcon met={checks.special} />{passwordRequirements[3]}</li>
                    </ul>
                  </div>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="register-confirm-password">{t('auth.register.password.confirmLabel')}</label>
                    <div className="password-input-wrapper-new">
                      <input id="register-confirm-password" className={`form-input-new confirm-password-new ${status?.tone === 'error' && confirmPassword && password !== confirmPassword ? 'is-invalid' : ''}`} type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} maxLength={128} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t('auth.register.password.confirmPlaceholder')} required />
                      <button className="password-toggle-new" type="button" aria-label={showConfirmPassword ? t('auth.register.password.hideConfirm') : t('auth.register.password.showConfirm')} onClick={() => setShowConfirmPassword((value) => !value)}>
                        <svg className="icon-eye-new" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className={`form-group-new confirm-action register-agreement ${termsAccepted ? 'confirmed' : ''}`} data-confirm-control>
                    <label className="register-agreement-checkbox" htmlFor="terms-accept-new">
                      <input id="terms-accept-new" className="confirm-action-input" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />
                      <span>{t('auth.register.password.confirmAgreement')}</span>
                    </label>
                    <p className="confirm-action-note">
                      {t('auth.register.password.agreementNoteStart')} <Link className="link-new" to="/terms" target="_blank" rel="noopener noreferrer">{t('auth.register.password.terms')}</Link> {t('auth.register.password.agreementAnd')}{' '}
                      <Link className="link-new" to="/privacy" target="_blank" rel="noopener noreferrer">{t('auth.register.password.privacy')}</Link>.
                    </p>
                  </div>
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep(3)}>
                    Back
                  </button>
                  <button className="btn-continue-new btn-create-new" type="submit" disabled={loading || !passwordReady}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {t('auth.register.password.create')}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <div className="success-icon-new success-large">{t('auth.register.done')}</div>
                  <h2>{t('auth.register.success.title')}</h2>
                  <p>{t('auth.register.success.body')}</p>
                </div>
                <div className="success-card-new">
                  <div className="success-detail">
                    <strong>{t('auth.register.success.nextTitle')}</strong>
                    <p>{t('auth.register.success.nextBody')}</p>
                  </div>
                </div>
                <button className="btn-continue-new btn-dashboard-new" type="button" onClick={() => navigate('/sign-in')}>
                  {t('actions.signIn')}
                </button>
              </div>
            ) : null}
            <AuthAlert message={status} />
          </div>
        </div>
        <div className="auth-image-panel" aria-hidden="true">
          <dotlottie-player className="procurex-lottie auth-image-lottie" src="/assets/ProcureX.json" background="transparent" speed="1" loop autoplay />
        </div>
      </div>
    </div>
  );
}
