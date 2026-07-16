import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { hydrateAuthSession } from '@/features/auth/slice';
import { DomLocalization } from '@/i18n/DomLocalization';
import { NotificationToastHost } from '@/features/notifications/NotificationToastHost';
import { CookieConsentBanner } from '@/features/support/components/CookieConsentBanner';
import { router } from './router';
import { useAppDispatch, useAppSelector } from './store';

export function App() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const status = useAppSelector((state) => state.auth.status);
  const hydratedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || user || status !== 'loading' || hydratedTokenRef.current === token) return;
    hydratedTokenRef.current = token;
    void dispatch(hydrateAuthSession());
  }, [dispatch, status, token, user]);

  return (
    <>
      <RouterProvider router={router} />
      <DomLocalization />
      <NotificationToastHost />
      <CookieConsentBanner />
    </>
  );
}
