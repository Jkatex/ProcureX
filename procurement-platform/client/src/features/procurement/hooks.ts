import { useEffect, useState } from 'react';
import { useAppSelector } from '@/app/store';
import { procurementApi } from './api';
import type { MarketplacePayload } from './types';

export function useTenders() {
  return useAppSelector((state) => state.procurement.tenders);
}

export function useMarketplaceData() {
  const [data, setData] = useState<MarketplacePayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    setStatus('loading');
    procurementApi
      .getMarketplace()
      .then((payload) => {
        if (!isMounted) return;
        setData(payload);
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    data,
    status,
    isLoading: status === 'loading',
    isError: status === 'error'
  };
}
