/* Owns public client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';

const publicSlice = createSlice({
  name: 'public',
  initialState: {
    lastVisitedPage: 'welcome'
  },
  reducers: {}
});

export default publicSlice.reducer;
