/* Owns awards Contracts client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';

const awardsContractsSlice = createSlice({
  name: 'awardsContracts',
  initialState: {
    currentStep: 'award-decision',
    draftSaved: false
  },
  reducers: {
    saveAwardDraft(state) {
      state.draftSaved = true;
    }
  }
});

export const { saveAwardDraft } = awardsContractsSlice.actions;
export default awardsContractsSlice.reducer;
