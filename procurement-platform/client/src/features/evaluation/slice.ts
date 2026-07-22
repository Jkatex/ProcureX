/* Owns evaluation client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';
import type { BidPackage } from '@/features/bidding/types';

type EvaluationState = {
  bids: BidPackage[];
  currentStage: 'not-started' | 'technical' | 'recommendation';
  progress: number;
};

const initialState: EvaluationState = {
  bids: [],
  currentStage: 'not-started',
  progress: 0
};

const evaluationSlice = createSlice({
  name: 'evaluation',
  initialState,
  reducers: {
    lockEvaluation(state) {
      state.currentStage = 'recommendation';
      state.progress = 100;
    }
  }
});

export const { lockEvaluation } = evaluationSlice.actions;
export default evaluationSlice.reducer;
