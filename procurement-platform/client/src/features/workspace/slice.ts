/* Owns workspace client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';
import type { WorkspaceItem } from './types';

type WorkspaceState = {
  workItems: WorkspaceItem[];
};

const initialState: WorkspaceState = {
  workItems: []
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {}
});

export default workspaceSlice.reducer;
