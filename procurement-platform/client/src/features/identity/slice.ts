/* Owns identity client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';

const identitySlice = createSlice({
  name: 'identity',
  initialState: {
    verificationStep: 1,
    profileCompletion: 84
  },
  reducers: {
    nextVerificationStep(state) {
      state.verificationStep = Math.min(state.verificationStep + 1, 4);
    }
  }
});

export const { nextVerificationStep } = identitySlice.actions;
export default identitySlice.reducer;
