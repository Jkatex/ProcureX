/* Connects procurement route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { useTranslation } from 'react-i18next';
import { PageHeader, Timeline } from '@/shared/components';
import { procurementTimeline } from '@/shared/data/fixtures';
import { FirstRunAppPage } from '@/features/workspace/components/procurex/FirstRunAppPage';
import { CreateTenderProcurexPage } from '../components/procurex/CreateTenderProcurexPage';
import { MarketplaceProcurexPage } from '../components/procurex/MarketplaceProcurexPage';

export function ProcurementGuidePage() {
  const { t } = useTranslation();
  return (
    <section>
      <PageHeader title={t('pages.procurementGuide.title')} subtitle={t('pages.procurementGuide.subtitle')} />
      <Timeline items={procurementTimeline} />
    </section>
  );
}

export function MarketplacePage() {
  return <MarketplaceProcurexPage />;
}

export function CreateTenderPage() {
  return <CreateTenderProcurexPage />;
}

export function TenderPublicationPage() {
  return <FirstRunAppPage page="tender-publication" />;
}

export function TenderDetailsPage() {
  return <FirstRunAppPage page="tender-details" />;
}

export function TenderDocumentPage() {
  return <FirstRunAppPage page="tender-document" />;
}

export function SupplierTenderDetailPage() {
  return <FirstRunAppPage page="tender-detail" />;
}
