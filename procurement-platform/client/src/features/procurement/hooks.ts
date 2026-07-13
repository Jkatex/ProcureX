import { useEffect, useState } from 'react';
import { useAppSelector } from '@/app/store';
import { mergeSessionMarketplaceData, procurementApi } from './api';
import type { MarketplacePayload, TenderDetail } from './types';

export function useTenders() {
  return useAppSelector((state) => state.procurement.tenders);
}

export function useMarketplaceData() {
  const [data, setData] = useState<MarketplacePayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const user = useAppSelector((state) => state.auth.user);
  const createTenderDrafts = useAppSelector((state) => state.procurement.createTenderDrafts);
  const publishedTenders = useAppSelector((state) => state.procurement.publishedTenders);

  useEffect(() => {
    let isMounted = true;

    setStatus('loading');
    procurementApi
      .getMarketplace()
      .then((payload) => {
        if (!isMounted) return;
        if (!payload) {
          setStatus('error');
          return;
        }
        setData(mergeSessionMarketplaceData(payload, createTenderDrafts, publishedTenders, user?.organization));
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, [createTenderDrafts, publishedTenders, user]);

  return {
    data,
    status,
    isLoading: status === 'loading',
    isError: status === 'error'
  };
}

export function useTenderDetail(tenderId: string | null) {
  const [data, setData] = useState<TenderDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(tenderId ? 'loading' : 'idle');

  useEffect(() => {
    if (!tenderId) {
      setData(null);
      setStatus('idle');
      return;
    }

    let isMounted = true;
    setStatus('loading');
    Promise.resolve(procurementApi.getTenderDetail(tenderId))
      .then((payload) => {
        if (!isMounted) return;
        if (!payload) {
          setStatus('error');
          return;
        }
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
  }, [tenderId]);

  return {
    data,
    status,
    isLoading: status === 'loading',
    isError: status === 'error'
  };
}
