/* Owns admin client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice } from '@reduxjs/toolkit';
import type { AdminMetric, RecordItem, Tender } from '@/shared/types/domain';

type AdminState = {
  metrics: AdminMetric[];
  tenders: Tender[];
  auditRows: RecordItem[];
};

const initialState: AdminState = {
  metrics: [],
  tenders: [],
  auditRows: []
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {}
});

export default adminSlice.reducer;
