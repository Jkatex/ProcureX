import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { assumeUser, signInWithCredentials } from '@/features/auth/slice';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { demoUsers } from '@/shared/data/fixtures';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AuthAlert, authAlert, authAlertFromError, type AuthAlertMessage } from './AuthAlert';
import { TurnstileWidget } from './TurnstileWidget';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

function destinationFor(user: { accountType: string; verificationStatus: string }, intendedPath?: string) {
  if (user.accountType === 'ADMIN') return '/admin';
  if (user.verificationStatus !== 'APPROVED') return '/identity/verification';
  return intendedPath && intendedPath !== '/sign-in' ? intendedPath : '/apps';
}

function demoSignInConfig() {
  return {
    enabled: import.meta.env.MODE === 'development' || import.meta.env.VITE_DEMO_SIGN_IN_ENABLED === 'true',
    email: import.meta.env.VITE_DEMO_USER_EMAIL || 'demo@procurex.tz',
    password: import.meta.env.VITE_DEMO_USER_PASSWORD || 'Demo123!'
  };
}

export function SignInProcurexPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const authStatus = useAppSelector((state) => state.auth.status);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [alert, setAlert] = useState<AuthAlertMessage | null>(null);
  const loading = authStatus === 'loading';
  const locationState = location.state as LocationState | null;
  const demoSignIn = demoSignInConfig();

  useBodyPageMetadata('sign-in');

  function isDemoCredentialAttempt(emailValue: string, passwordValue: string) {
    return (
      demoSignIn.enabled &&
      emailValue.trim().toLowerCase() === demoSignIn.email.toLowerCase() &&
      passwordValue === demoSignIn.password
    );
  }

  async function signIn(emailValue: string, passwordValue: string, destinationOverride?: string) {
    if (loading) return;
    setAlert(null);
    if (!turnstileToken) {
      setAlert(authAlert('auth.security.missingSignIn', 'error'));
      return;
    }

    if (isDemoCredentialAttempt(emailValue, passwordValue)) {
      dispatch(assumeUser(demoUsers.user));
      navigate(destinationOverride ?? destinationFor(demoUsers.user, locationState?.from?.pathname), { replace: true });
      return;
    }

    try {
      const session = await dispatch(signInWithCredentials({ email: emailValue.trim(), password: passwordValue, turnstileToken })).unwrap();
      const intendedPath = locationState?.from?.pathname;
      navigate(destinationOverride ?? destinationFor(session.user, intendedPath), { replace: true });
    } catch (caughtError) {
      setAlert(authAlertFromError(caughtError, 'sign-in'));
      setTurnstileToken('');
      setTurnstileResetKey((value) => value + 1);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signIn(email, password);
  }

  async function submitDemoSignIn() {
    setEmail(demoSignIn.email);
    setPassword(demoSignIn.password);
    await signIn(demoSignIn.email, demoSignIn.password, '/dashboard');
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
            <button className="login-link-new" type="button" onClick={() => navigate('/register')}>
              {t('auth.signIn.headerCreate')}
            </button>
          </div>
        </div>
      </header>

      <div className="register-container-new">
        <div className="register-card-new auth-card">
          <div className="screens-container-new">
            <div className="screen-header-new">
              <h2>{t('auth.signIn.title')}</h2>
              <p>{t('auth.signIn.subtitle')}</p>
            </div>

            <form className="screen-form-new" onSubmit={(event) => void submit(event)}>
              <div className="form-group-new">
                <label className="form-label-new" htmlFor="sign-in-email">{t('auth.signIn.email')}</label>
                <input
                  id="sign-in-email"
                  className="form-input-new"
                  type="email"
                  value={email}
                  placeholder={t('auth.signIn.emailPlaceholder')}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="form-group-new">
                <label className="form-label-new" htmlFor="sign-in-password">{t('auth.signIn.password')}</label>
                <div className="password-input-wrapper-new">
                  <input
                    id="sign-in-password"
                    className="form-input-new"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder={t('auth.signIn.passwordPlaceholder')}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-new"
                    aria-label={showPassword ? t('auth.signIn.hidePassword') : t('auth.signIn.showPassword')}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? t('auth.signIn.hide') : t('auth.signIn.show')}
                  </button>
                </div>
              </div>

              <div className="auth-row">
                <button className="link-new" type="button" onClick={() => navigate('/forgot-password')}>
                  {t('auth.signIn.forgot')}
                </button>
              </div>

              <AuthAlert message={alert} />

              <TurnstileWidget action="sign_in" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

              <button type="submit" className="btn-continue-new" disabled={loading || !turnstileToken}>
                {loading ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
              </button>

            </form>

            {demoSignIn.enabled ? (
              <div className="demo-credentials demo-credentials--auth demo-credentials--icon-only">
                <button
                  className="demo-account demo-account--compact demo-account--icon-only"
                  type="button"
                  aria-label={t('auth.signIn.demo.button')}
                  title={t('auth.signIn.demo.securityHint')}
                  disabled={loading || !turnstileToken}
                  onClick={() => void submitDemoSignIn()}
                >
                  <LoginRoundedIcon fontSize="small" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="auth-note">
              {t('auth.signIn.note')}
            </div>
          </div>
        </div>
        <div className="auth-image-panel" aria-hidden="true">
          <dotlottie-player className="procurex-lottie auth-image-lottie" src="/assets/ProcureX.json" background="transparent" speed="1" loop autoplay />
        </div>
      </div>
    </div>
  );
}
