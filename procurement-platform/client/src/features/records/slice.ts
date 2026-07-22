/* Owns records client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';
import type { ProcurementRecord } from './types';

type RecordsState = {
  records: ProcurementRecord[];
};

const initialState: RecordsState = {
  records: []
};

const recordsSlice = createSlice({
  name: 'records',
  initialState,
  reducers: {}
});

export default recordsSlice.reducer;
