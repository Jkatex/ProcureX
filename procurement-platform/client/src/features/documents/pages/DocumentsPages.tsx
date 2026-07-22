/* Connects documents route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { Button, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { PageHeader, StatusBadge } from '@/shared/components';
import { queueUpload } from '../slice';

export function DocumentsPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.documents.uploadQueue);

  return (
    <section>
      <PageHeader title="Documents" subtitle="Upload and track procurement documents, verification evidence, bid attachments, and contract files." />
      <article className="px-card">
        <div className="px-form-grid">
          <TextField label="Document name" defaultValue="Technical_Response.pdf" />
          <TextField label="Document type" defaultValue="Technical Attachment" />
        </div>
        <div className="px-actions">
          <Button variant="contained" onClick={() => dispatch(queueUpload('Technical_Response.pdf'))}>{t('actions.submit')}</Button>
          <StatusBadge value={`${queue.length} queued`} />
        </div>
      </article>
    </section>
  );
}
