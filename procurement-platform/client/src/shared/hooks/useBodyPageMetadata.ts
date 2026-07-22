/* Exposes shared hooks that keep component state access and side effects consistent across screens. */
import { useEffect } from 'react';

export function useBodyPageMetadata(pageKey: string) {
  useEffect(() => {
    document.body.dataset.page = pageKey;
    document.body.dataset.procurexReactPage = 'true';

    return () => {
      if (document.body.dataset.page === pageKey) {
        delete document.body.dataset.page;
      }
      delete document.body.dataset.procurexReactPage;
    };
  }, [pageKey]);
}
