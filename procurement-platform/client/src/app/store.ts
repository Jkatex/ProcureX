import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import adminReducer from '@/features/admin/slice';
import authReducer from '@/features/auth/slice';
import awardsContractsReducer from '@/features/awardsContracts/slice';
import biddingReducer from '@/features/bidding/slice';
import communicationReducer from '@/features/communication/slice';
import documentsReducer from '@/features/documents/slice';
import evaluationReducer from '@/features/evaluation/slice';
import identityReducer from '@/features/identity/slice';
import notificationsReducer from '@/features/notifications/slice';
import procurementReducer from '@/features/procurement/slice';
import publicReducer from '@/features/public/slice';
import recordsReducer from '@/features/records/slice';
import workspaceReducer from '@/features/workspace/slice';

export const store = configureStore({
  reducer: {
    admin: adminReducer,
    auth: authReducer,
    awardsContracts: awardsContractsReducer,
    bidding: biddingReducer,
    communication: communicationReducer,
    documents: documentsReducer,
    evaluation: evaluationReducer,
    identity: identityReducer,
    notifications: notificationsReducer,
    procurement: procurementReducer,
    public: publicReducer,
    records: recordsReducer,
    workspace: workspaceReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
