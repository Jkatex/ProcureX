import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { signInWithCredentials } from '@/features/auth/slice';
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

export function SignInProcurexPage() {
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

  useBodyPageMetadata('sign-in');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setAlert(null);
    if (!turnstileToken) {
      setAlert(authAlert('Complete the security check before signing in.', 'error'));
      return;
    }

    try {
      const session = await dispatch(signInWithCredentials({ email: email.trim(), password, turnstileToken })).unwrap();
      const intendedPath = locationState?.from?.pathname;
      navigate(destinationFor(session.user, intendedPath), { replace: true });
    } catch (caughtError) {
      setAlert(authAlertFromError(caughtError, 'sign-in'));
      setTurnstileToken('');
      setTurnstileResetKey((value) => value + 1);
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
          <button className="login-link-new" type="button" onClick={() => navigate('/register')}>
            Create an account
          </button>
        </div>
      </header>

      <div className="register-container-new">
        <div className="register-card-new auth-card">
          <div className="screens-container-new">
            <div className="screen-header-new">
              <h2>Welcome Back</h2>
              <p>Sign in</p>
            </div>

            <form className="screen-form-new" onSubmit={(event) => void submit(event)}>
              <div className="form-group-new">
                <label className="form-label-new" htmlFor="sign-in-email">Email Address *</label>
                <input
                  id="sign-in-email"
                  className="form-input-new"
                  type="email"
                  value={email}
                  placeholder="you@company.com"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="form-group-new">
                <label className="form-label-new" htmlFor="sign-in-password">Password *</label>
                <div className="password-input-wrapper-new">
                  <input
                    id="sign-in-password"
                    className="form-input-new"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder="Enter your password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-new"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="auth-row">
                <button className="link-new" type="button" onClick={() => navigate('/forgot-password')}>
                  Forgot password?
                </button>
              </div>

              <AuthAlert message={alert} />

              <TurnstileWidget action="sign_in" resetKey={turnstileResetKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

              <button type="submit" className="btn-continue-new" disabled={loading || !turnstileToken}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

            </form>

            <div className="auth-note">
              Your account opens the workspace allowed by its verification status.
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
