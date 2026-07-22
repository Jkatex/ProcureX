/* Connects communication route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { DataTable, PageHeader, StatusBadge } from '@/shared/components';
import { markAllRead } from '../slice';

export function CommunicationCenterPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => state.communication.messages);

  return (
    <section>
      <PageHeader
        title={t('pages.communication.title')}
        subtitle={t('pages.communication.subtitle')}
        actions={<Button variant="contained" onClick={() => dispatch(markAllRead())}>{t('actions.review')}</Button>}
      />
      <DataTable
        rows={messages}
        getRowKey={(message) => message.id}
        columns={[
          { key: 'subject', label: 'Subject', render: (message) => <strong>{message.subject}</strong> },
          { key: 'category', label: 'Category', render: (message) => message.category },
          { key: 'priority', label: t('common.priority'), render: (message) => <StatusBadge value={message.priority} /> },
          { key: 'status', label: t('common.status'), render: (message) => <StatusBadge value={message.status} /> },
          { key: 'body', label: 'Message', render: (message) => message.body }
        ]}
      />
    </section>
  );
}
