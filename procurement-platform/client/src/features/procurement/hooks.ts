import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '@/app/store';
import { demoUsers } from '@/shared/data/fixtures';
import { mergeSessionMarketplaceData, procurementApi } from './api';
import type { MarketplacePayload, TenderDetail } from './types';

export function useTenders() {
  return useAppSelector((state) => state.procurement.tenders);
}

export function useMarketplaceData() {
  const [data, setData] = useState<MarketplacePayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const drafts = useAppSelector((state) => state.procurement.createTenderDrafts);
  const publishedTenders = useAppSelector((state) => state.procurement.publishedTenders);
  const user = useAppSelector((state) => state.auth.user);
  const organization = user?.organization || demoUsers.user.organization;

  useEffect(() => {
    let isMounted = true;

    setStatus('loading');
    procurementApi
      .getMarketplace(user)
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
  }, [user]);

  const mergedData = useMemo(() => {
    if (!data) return null;
    return mergeSessionMarketplaceData(data, drafts, publishedTenders, organization);
  }, [data, drafts, publishedTenders, organization]);

  return {
    data: mergedData,
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
    procurementApi
      .getTenderDetail(tenderId)
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
  }, [tenderId]);

  return {
    data,
    status,
    isLoading: status === 'loading',
    isError: status === 'error'
  };
}
