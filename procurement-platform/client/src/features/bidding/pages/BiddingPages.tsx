/* Connects bidding route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { Button, LinearProgress, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { useNotifications } from '@/features/notifications/hooks';
import { DataTable, PageHeader, StatusBadge } from '@/shared/components';
import { saveBidDraft } from '../slice';

export function BiddingWorkspacePage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { notifyInfo, notifySuccess } = useNotifications();
  const bids = useAppSelector((state) => state.bidding.bids);
  const draftSaved = useAppSelector((state) => state.bidding.draftSaved);

  return (
    <section>
      <PageHeader title={t('pages.bidding.title')} subtitle={t('pages.bidding.subtitle')} />
      <div className="px-grid two">
        <article className="px-card">
          <StatusBadge value={draftSaved ? 'Draft saved' : 'Draft'} />
          <h3>Bid package readiness</h3>
          <LinearProgress variant="determinate" value={72} />
          <div className="px-form-grid">
            <TextField label="Technical response" multiline minRows={4} defaultValue="Methodology, compliance evidence, and delivery plan." />
            <TextField label="Financial offer" defaultValue="2380000000" />
            <TextField label="Declaration" defaultValue="No conflict of interest" />
            <TextField label="Attachment" defaultValue="Technical_Response.pdf" />
          </div>
          <div className="px-actions">
            <Button
              variant="outlined"
              onClick={() => {
                dispatch(saveBidDraft());
                notifySuccess('Bid draft saved', 'Your bid package was saved in this session.', {
                  reason: 'You can keep editing the technical response, financial offer, declaration, and attachments before submission.'
                });
              }}
            >
              {t('actions.saveDraft')}
            </Button>
            <Button
              variant="contained"
              onClick={() =>
                notifyInfo('Bid submission preview', 'This workspace is ready for sealed submission wiring.', {
                  reason: 'The current screen records draft readiness; live bid submission will use the procurement bidding API when enabled.'
                })
              }
            >
              {t('actions.submit')}
            </Button>
          </div>
        </article>
        <DataTable
          rows={bids}
          getRowKey={(bid) => bid.id}
          columns={[
            { key: 'ref', label: 'Tender', render: (bid) => bid.tenderReference },
            { key: 'supplier', label: 'Supplier', render: (bid) => bid.supplier },
            { key: 'status', label: t('common.status'), render: (bid) => <StatusBadge value={bid.status} /> }
          ]}
        />
      </div>
    </section>
  );
}
