/* Exposes public hooks that keep component state access and side effects consistent across screens. */
import { useEffect, useMemo, useState } from 'react';
import { publicApi } from './api';
import type { CurrentLegalVersions, PublicContentPageKey, PublicPageVersion, WelcomeLandingData } from './types';

export function usePublicFeatureName() {
  return 'public';
}

export const welcomeLandingFallback: WelcomeLandingData = {
  stats: {
    participantCount: 2000,
    participantLabel: 'Used by 2,000+ participants',
    openTenderCount: 12,
    verifiedProfileCompletionRate: 98.4,
    activeWorkspaceLabel: 'Active workspace'
  },
  featuredTenders: [
    {
      id: 'welcome-featured-tender',
      reference: 'PX-OPEN-2026',
      title: 'Open procurement opportunities',
      buyerName: 'Verified procuring entities',
      type: 'OPEN_TENDER',
      status: 'OPEN',
      budget: null,
      currency: 'TZS',
      location: 'Tanzania',
      closingDate: null,
      categories: ['Goods', 'Services', 'Works']
    }
  ]
};

export function useWelcomeLandingData() {
  const [data, setData] = useState<WelcomeLandingData>(welcomeLandingFallback);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    publicApi
      .getWelcomeLanding()
      .then((payload) => {
        if (!isMounted) return;
        setData({
          stats: {
            ...welcomeLandingFallback.stats,
            ...payload.stats
          },
          featuredTenders: payload.featuredTenders.length > 0 ? payload.featuredTenders : welcomeLandingFallback.featuredTenders
        });
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setData(welcomeLandingFallback);
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

function fallbackPageVersion(pageKey: PublicContentPageKey, fallbackHtml: string): PublicPageVersion {
  const titles: Record<PublicContentPageKey, string> = {
    'about-procurex': 'About ProcureX',
    'privacy-policy': 'Privacy Policy',
    'terms-and-conditions': 'Terms and Conditions'
  };

  return {
    id: `fallback-${pageKey}-2026-06-06`,
    pageKey,
    version: '2026.06.06',
    status: 'PUBLISHED',
    title: titles[pageKey],
    summary: null,
    content: { html: fallbackHtml },
    contentHash: 'client-fallback',
    effectiveAt: '2026-06-06T00:00:00.000Z',
    publishedAt: '2026-06-06T00:00:00.000Z',
    lastUpdated: '2026-06-06T00:00:00.000Z'
  };
}

export function usePublicPageContent(pageKey: PublicContentPageKey, fallbackHtml: string) {
  const fallback = useMemo(() => fallbackPageVersion(pageKey, fallbackHtml), [fallbackHtml, pageKey]);
  const [data, setData] = useState<PublicPageVersion>(fallback);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    publicApi
      .getPublicPage(pageKey)
      .then((payload) => {
        if (!isMounted) return;
        setData({
          ...payload,
          content: {
            ...payload.content,
            html: payload.content.html || fallbackHtml
          }
        });
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setData(fallback);
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, [fallback, fallbackHtml, pageKey]);

  return {
    data,
    status,
    isLoading: status === 'loading',
    isError: status === 'error'
  };
}

export function useCurrentLegalVersions() {
  const [data, setData] = useState<CurrentLegalVersions | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    publicApi
      .getCurrentLegalVersions()
      .then((payload) => {
        if (!isMounted) return;
        setData(payload);
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setData(null);
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
