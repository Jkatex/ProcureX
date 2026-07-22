/* Renders the shared Procurex Loading page UI while keeping page-specific presentation near its workflow data. */
import { useTranslation } from 'react-i18next';
import '@/i18n';

type ProcurexLoadingPageProps = {
  title?: string;
  message?: string;
};

export function ProcurexLoadingPage({ title, message }: ProcurexLoadingPageProps) {
  const { t } = useTranslation();
  const loadingTitle = title ?? t('loading.title');
  const loadingMessage = message ?? t('loading.message');

  return (
    <div className="procurex-loading-page" role="status" aria-live="polite" aria-label={loadingTitle}>
      <div className="loading-animation-shell" aria-hidden="true">
        <img className="procurex-loading-logo" src="/assets/logo.svg" alt="" />
      </div>
      <h2>{loadingTitle}</h2>
      <p>{loadingMessage}</p>
    </div>
  );
}
