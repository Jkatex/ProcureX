import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { apiErrorMessage, apiRawErrorMessage } from '@/shared/api/errors';
import { clearStoredAuthToken, getStoredAuthToken, storeAuthToken } from '@/shared/api/authToken';
import type { SessionUser } from '@/shared/types/domain';
import { authApi, type AuthSessionResponse, type AuthSignInResponse, type SessionResponse } from './api';

type AuthState = {
  user: SessionUser | null;
  token: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  sessionExpired: boolean;
};

const initialToken = getStoredAuthToken();
const sessionHydrationTimeoutMs = 8000;

const initialState: AuthState = {
  user: null,
  token: initialToken,
  expiresAt: null,
  isAuthenticated: false,
  status: initialToken ? 'loading' : 'idle',
  error: null,
  sessionExpired: false
};

export const signInWithCredentials = createAsyncThunk<AuthSignInResponse, { email: string; password: string; turnstileToken: string }, { rejectValue: string }>(
  'auth/signInWithCredentials',
  async (input, { rejectWithValue }) => {
    try {
      return await authApi.signIn(input);
    } catch (error) {
      return rejectWithValue(apiRawErrorMessage(error) || apiErrorMessage(error, 'Sign-in failed.'));
    }
  }
);

export const completeMfaSignIn = createAsyncThunk<AuthSessionResponse, { challengeId: string; code: string }, { rejectValue: string }>(
  'auth/completeMfaSignIn',
  async (input, { rejectWithValue }) => {
    try {
      return await authApi.verifyMfa(input);
    } catch (error) {
      return rejectWithValue(apiRawErrorMessage(error) || apiErrorMessage(error, 'MFA verification failed.'));
    }
  }
);

export const hydrateAuthSession = createAsyncThunk<SessionResponse, void, { rejectValue: string }>(
  'auth/hydrateAuthSession',
  async (_input, { rejectWithValue }) => {
    try {
      return await withTimeout(authApi.getSession(), sessionHydrationTimeoutMs, 'Session restore timed out.');
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Session could not be restored.'));
    }
  }
);

export const signOutSession = createAsyncThunk('auth/signOutSession', async () => {
  await authApi.signOut();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signOut(state) {
      state.user = null;
      state.token = null;
      state.expiresAt = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.sessionExpired = false;
      clearStoredAuthToken();
    },
    assumeUser(state, action: PayloadAction<SessionUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.status = 'succeeded';
      state.sessionExpired = false;
    },
    setSessionUser(state, action: PayloadAction<SessionUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.status = 'succeeded';
      state.sessionExpired = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithCredentials.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.sessionExpired = false;
      })
      .addCase(signInWithCredentials.fulfilled, (state, action) => {
        if ('mfaRequired' in action.payload) {
          state.status = 'idle';
          state.user = null;
          state.token = null;
          state.expiresAt = null;
          state.isAuthenticated = false;
          state.sessionExpired = false;
          return;
        }
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.expiresAt = action.payload.expiresAt;
        state.isAuthenticated = true;
        state.sessionExpired = false;
        storeAuthToken(action.payload.token);
      })
      .addCase(signInWithCredentials.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? action.error.message ?? 'Sign-in failed.';
      })
      .addCase(completeMfaSignIn.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(completeMfaSignIn.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.expiresAt = action.payload.expiresAt;
        state.isAuthenticated = true;
        state.sessionExpired = false;
        storeAuthToken(action.payload.token);
      })
      .addCase(completeMfaSignIn.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? action.error.message ?? 'MFA verification failed.';
      })
      .addCase(hydrateAuthSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(hydrateAuthSession.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.isAuthenticated = true;
      })
      .addCase(hydrateAuthSession.rejected, (state) => {
        state.sessionExpired = Boolean(state.token);
        state.status = 'idle';
        state.error = 'Session could not be restored.';
        state.user = null;
        state.token = null;
        state.expiresAt = null;
        state.isAuthenticated = false;
        clearStoredAuthToken();
      })
      .addCase(signOutSession.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.expiresAt = null;
        state.isAuthenticated = false;
        state.status = 'idle';
        state.sessionExpired = false;
        clearStoredAuthToken();
      });
  }
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export const { assumeUser, setSessionUser, signOut } = authSlice.actions;
export default authSlice.reducer;
