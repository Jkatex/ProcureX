/* Supports the app client workflow with reusable logic kept close to the screens that consume it. */
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}
