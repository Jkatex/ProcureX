/* Renders the auth Recover Keyphrase ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { FormEvent, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { identityApi } from '@/features/identity/api';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { apiErrorMessage } from '@/shared/api/errors';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AuthAlert, authAlert, authAlertText, type AuthAlertMessage } from './AuthAlert';
import { TurnstileWidget } from './TurnstileWidget';

type RecoveryStep = 'request' | 'email' | 'phone' | 'keyphrase' | 'complete';

function keyphraseReady(value: string) {
  return value.length >= 6 && value.length <= 128;
}

function recoveryError(error: unknown, fallback: string): AuthAlertMessage {
  return authAlertText(apiErrorMessage(error, fallback), 'error');
}

export function RecoverKeyphraseProcurexPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const initialRecoveryId = searchParams.get('recoveryId') ?? hashParams.get('recoveryId') ?? '';
  const initialEmailCode = searchParams.get('code') ?? hashParams.get('code') ?? '';

  const [step, setStep] = useState<RecoveryStep>(initialRecoveryId ? 'email' : 'request');
  const [email, setEmail] = useState('');
  const [recoveryId, setRecoveryId] = useState(initialRecoveryId);
  const [emailCode, setEmailCode] = useState(initialEmailCode);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [newKeyphrase, setNewKeyphrase] = useState('');
  const [confirmKeyphrase, setConfirmKeyphrase] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [message, setMessage] = useState<AuthAlertMessage | null>(null);
  const [loading, setLoading] = useState(false);

  useBodyPageMetadata('recover-keyphrase');

  const canComplete = recoveryId && keyphraseReady(newKeyphrase) && newKeyphrase === confirmKeyphrase;

  function resetSecurityCheck() {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  }

  function requireSecurityCheck() {
    if (turnstileToken) return true;
    setMessage(authAlert('auth.security.missing', 'error'));
    return false;
  }

  async function startRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await identityApi.startKeyphraseRecovery({ email: email.trim(), turnstileToken });
      setMessage(authAlertText(response.message, 'info'));
      setEmailCode('');
      setPhoneCode('');
      setNewKeyphrase('');
      setConfirmKeyphrase('');
      if (response.recoveryId) {
        setRecoveryId(response.recoveryId);
        setStep('email');
      }
    } catch (error) {
      setMessage(recoveryError(error, 'Could not start keyphrase recovery.'));
    } finally {
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recoveryId || !emailCode.trim()) {
      setMessage(authAlertText('Enter the recovery code from your email.', 'error'));
      return;
    }
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await identityApi.verifyKeyphraseRecoveryEmail({ recoveryId, code: emailCode.trim(), turnstileToken });
      setPhoneMasked(response.phoneMasked);
      setPhoneCode('');
      setStep('phone');
      setMessage(authAlertText('Email code verified. Enter the phone OTP to continue.', 'success'));
    } catch (error) {
      setMessage(recoveryError(error, 'Could not verify the email recovery code.'));
    } finally {
      setEmailCode('');
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recoveryId || !phoneCode.trim()) {
      setMessage(authAlertText('Enter the phone OTP.', 'error'));
      return;
    }
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      await identityApi.verifyKeyphraseRecoveryPhone({ recoveryId, code: phoneCode.trim(), turnstileToken });
      setStep('keyphrase');
      setMessage(authAlertText('Phone OTP verified. Create a new signing keyphrase.', 'success'));
    } catch (error) {
      setMessage(recoveryError(error, 'Could not verify the phone OTP.'));
    } finally {
      setPhoneCode('');
      resetSecurityCheck();
      setLoading(false);
    }
  }

  async function completeRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canComplete) {
      setMessage(authAlertText('Enter matching keyphrases between 6 and 128 characters.', 'error'));
      return;
    }
    if (!requireSecurityCheck()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await identityApi.completeKeyphraseRecovery({ recoveryId, newKeyphrase, confirmKeyphrase, turnstileToken });
      setStep('complete');
      setMessage(authAlertText(response.message, 'success'));
    } catch (error) {
      setMessage(recoveryError(error, 'Could not complete keyphrase recovery.'));
    } finally {
      setNewKeyphrase('');
      setConfirmKeyphrase('');
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
              Sign in
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
                  <h2>Recover signing keyphrase</h2>
                  <p>Enter the registered email for the ProcureX account. The response will not reveal whether an account exists.</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void startRecovery(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="keyphrase-recovery-email">Registered email</label>
                    <input id="keyphrase-recovery-email" className="form-input-new" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="keyphrase_recovery_start" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="btn-continue-new" type="submit" disabled={loading || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? 'Sending...' : 'Continue'}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'email' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>Verify email code</h2>
                  <p>Enter the recovery code sent to the registered email.</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void verifyEmail(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="keyphrase-email-code">Email recovery code</label>
                    <input id="keyphrase-email-code" className="form-input-new" value={emailCode} autoComplete="one-time-code" onChange={(event) => setEmailCode(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="keyphrase_recovery_email" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep('request')}>
                    Back
                  </button>
                  <button className="btn-continue-new" type="submit" disabled={loading || !emailCode.trim() || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? 'Verifying...' : 'Verify email'}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'phone' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>Verify phone OTP</h2>
                  <p>{phoneMasked ? `Enter the OTP sent to ${phoneMasked}.` : 'Enter the OTP sent to the registered phone.'}</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void verifyPhone(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="keyphrase-phone-code">Phone OTP</label>
                    <input id="keyphrase-phone-code" className="form-input-new" value={phoneCode} autoComplete="one-time-code" onChange={(event) => setPhoneCode(event.target.value)} required />
                  </div>
                  <TurnstileWidget action="keyphrase_recovery_phone" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep('email')}>
                    Back
                  </button>
                  <button className="btn-continue-new" type="submit" disabled={loading || !phoneCode.trim() || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? 'Verifying...' : 'Verify phone'}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'keyphrase' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <h2>Create new signing keyphrase</h2>
                  <p>This recovery revokes the old active signing credential and creates a new signing key pair.</p>
                </div>
                <form className="screen-form-new" onSubmit={(event) => void completeRecovery(event)}>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="recovered-keyphrase">New keyphrase</label>
                    <input id="recovered-keyphrase" className="form-input-new" type="password" value={newKeyphrase} minLength={6} maxLength={128} autoComplete="new-password" onChange={(event) => setNewKeyphrase(event.target.value)} required />
                    <span className="form-hint-new">Minimum 6 characters, maximum 128.</span>
                  </div>
                  <div className="form-group-new">
                    <label className="form-label-new" htmlFor="recovered-confirm-keyphrase">Confirm keyphrase</label>
                    <input id="recovered-confirm-keyphrase" className="form-input-new" type="password" value={confirmKeyphrase} minLength={6} maxLength={128} autoComplete="new-password" onChange={(event) => setConfirmKeyphrase(event.target.value)} required />
                    <span className={`form-hint-new ${confirmKeyphrase && newKeyphrase !== confirmKeyphrase ? 'is-error' : canComplete ? 'is-success' : ''}`}>
                      {confirmKeyphrase && newKeyphrase !== confirmKeyphrase ? 'Keyphrases do not match.' : canComplete ? 'Ready to recover.' : 'Repeat the same keyphrase.'}
                    </span>
                  </div>
                  <TurnstileWidget action="keyphrase_recovery_complete" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  <button className="auth-back-button" type="button" disabled={loading} onClick={() => setStep('phone')}>
                    Back
                  </button>
                  <button className="btn-continue-new" type="submit" disabled={loading || !canComplete || !turnstileToken}>
                    {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                    {loading ? 'Recovering...' : 'Recover keyphrase'}
                  </button>
                </form>
              </div>
            ) : null}

            {step === 'complete' ? (
              <div className="register-screen-new active">
                <div className="screen-header-new">
                  <div className="success-icon-new success-large">OK</div>
                  <h2>Keyphrase recovered</h2>
                  <p>Your sessions were revoked. Sign in again with your account password, then use the new keyphrase for future signing actions.</p>
                </div>
                <button className="btn-continue-new btn-dashboard-new" type="button" onClick={() => navigate('/sign-in')}>
                  Sign in
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
