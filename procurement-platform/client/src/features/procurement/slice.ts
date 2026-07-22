/* Owns procurement client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';
import type { CreateTenderDraft, ProcurementTender } from './types';

type ProcurementState = {
  tenders: ProcurementTender[];
  selectedTenderId: string | null;
  createTenderDrafts: CreateTenderDraft[];
  publishedTenders: CreateTenderDraft[];
  selectedDraftId: string | null;
  lastSubmittedTenderId: string | null;
};

const initialState: ProcurementState = {
  tenders: [],
  selectedTenderId: null,
  createTenderDrafts: [],
  publishedTenders: [],
  selectedDraftId: null,
  lastSubmittedTenderId: null
};

const procurementSlice = createSlice({
  name: 'procurement',
  initialState,
  reducers: {
    selectTender(state, action: { payload: string }) {
      state.selectedTenderId = action.payload;
    },
    saveCreateTenderDraft(state, action: { payload: CreateTenderDraft }) {
      const draft = { ...action.payload, status: action.payload.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' } satisfies CreateTenderDraft;
      const index = state.createTenderDrafts.findIndex((item) => item.id === draft.id);
      if (index >= 0) state.createTenderDrafts[index] = draft;
      else state.createTenderDrafts.unshift(draft);
      state.selectedDraftId = draft.id;
    },
    updateCreateTenderDraft(state, action: { payload: CreateTenderDraft }) {
      const index = state.createTenderDrafts.findIndex((item) => item.id === action.payload.id);
      if (index >= 0) state.createTenderDrafts[index] = action.payload;
      else state.createTenderDrafts.unshift(action.payload);
      state.selectedDraftId = action.payload.id;
    },
    submitCreateTenderForEvaluation(state, action: { payload: CreateTenderDraft }) {
      const submitted: CreateTenderDraft = { ...action.payload, status: 'SUBMITTED', submittedAt: action.payload.submittedAt ?? new Date().toISOString() };
      state.lastSubmittedTenderId = submitted.id;
      const draftIndex = state.createTenderDrafts.findIndex((item) => item.id === submitted.id);
      if (draftIndex >= 0) state.createTenderDrafts[draftIndex] = submitted;
      else state.createTenderDrafts.unshift(submitted);
    },
    publishSimulatedTender(state, action: { payload: CreateTenderDraft }) {
      const published: CreateTenderDraft = { ...action.payload, status: 'PUBLISHED', publishedAt: action.payload.publishedAt ?? new Date().toISOString() };
      const publishedIndex = state.publishedTenders.findIndex((item) => item.id === published.id);
      if (publishedIndex >= 0) state.publishedTenders[publishedIndex] = published;
      else state.publishedTenders.unshift(published);

      const draftIndex = state.createTenderDrafts.findIndex((item) => item.id === published.id);
      if (draftIndex >= 0) state.createTenderDrafts[draftIndex] = published;
      else state.createTenderDrafts.unshift(published);
      state.lastSubmittedTenderId = published.id;
    },
    selectCreateTenderDraft(state, action: { payload: string | null }) {
      state.selectedDraftId = action.payload;
    },
    deleteCreateTenderDraft(state, action: { payload: string }) {
      state.createTenderDrafts = state.createTenderDrafts.filter((item) => item.id !== action.payload);
      state.publishedTenders = state.publishedTenders.filter((item) => item.id !== action.payload);
      if (state.selectedDraftId === action.payload) state.selectedDraftId = null;
      if (state.lastSubmittedTenderId === action.payload) state.lastSubmittedTenderId = null;
    },
    resetCreateTenderDrafts(state) {
      state.createTenderDrafts = [];
      state.publishedTenders = [];
      state.selectedDraftId = null;
      state.lastSubmittedTenderId = null;
    }
  }
});

export const {
  selectTender,
  saveCreateTenderDraft,
  updateCreateTenderDraft,
  submitCreateTenderForEvaluation,
  publishSimulatedTender,
  selectCreateTenderDraft,
  deleteCreateTenderDraft,
  resetCreateTenderDrafts
} = procurementSlice.actions;
export default procurementSlice.reducer;
