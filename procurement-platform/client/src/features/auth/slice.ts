import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { mockApi } from '@/shared/api/mockApi';
import { demoUsers } from '@/shared/data/fixtures';
import type { SessionUser } from '@/shared/types/domain';

type AuthState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
};

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  status: 'idle'
};

export const signInWithEmail = createAsyncThunk('auth/signInWithEmail', async (email: string) => mockApi.signIn(email));

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signOut(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
    assumeUser(state, action: PayloadAction<SessionUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithEmail.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(signInWithEmail.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(signInWithEmail.rejected, (state) => {
        state.status = 'failed';
      });
  }
});

export const { assumeUser, signOut } = authSlice.actions;
export default authSlice.reducer;
