/* Owns communication client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';
import type { MessageItem } from '@/shared/types/domain';

type CommunicationState = {
  messages: MessageItem[];
};

const initialState: CommunicationState = {
  messages: []
};

const communicationSlice = createSlice({
  name: 'communication',
  initialState,
  reducers: {
    markAllRead(state) {
      state.messages = state.messages.map((message) => ({ ...message, status: 'Read' }));
    }
  }
});

export const { markAllRead } = communicationSlice.actions;
export default communicationSlice.reducer;
