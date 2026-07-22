/* Owns documents client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';

const documentsSlice = createSlice({
  name: 'documents',
  initialState: {
    uploadQueue: [] as string[]
  },
  reducers: {
    queueUpload(state, action: { payload: string }) {
      state.uploadQueue.push(action.payload);
    }
  }
});

export const { queueUpload } = documentsSlice.actions;
export default documentsSlice.reducer;
