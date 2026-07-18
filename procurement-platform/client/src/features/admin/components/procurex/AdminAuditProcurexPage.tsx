import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, type AuditEvent, type PageDto } from '@/features/admin/api';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminError, AdminHero, AdminPanel, AdminShell, EmptyRow } from './AdminShared';
import { badgeClass, displayLabel, exportCsv, formatDate, printAdminPage } from './AdminSharedUtils';

const severities = ['', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

export function AdminAuditProcurexPage() {
  const [events, setEvents] = useState<PageDto<AuditEvent> | null>(null);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [entityType, setEntityType] = useState('');
  const [eventType, setEventType] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const filtersRef = useRef({ query: '', severity: '', entityType: '', eventType: '', actorRole: '', from: '', to: '' });

  filtersRef.current = { query, severity, entityType, eventType, actorRole, from, to };

  useBodyPageMetadata('admin-audit');

  const load = useCallback(async (nextPage = 1, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const filters = filtersRef.current;
      const response = await adminApi.listAuditEvents({
        page: nextPage,
        pageSize: 20,
        q: filters.query || undefined,
        severity: filters.severity || undefined,
        entityType: filters.entityType || undefined,
        eventType: filters.eventType || undefined,
        actorRole: filters.actorRole || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined
      });
      setEvents((current) => (append && current ? { ...response, items: [...current.items, ...response.items] } : response));
      setPage(nextPage);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  function exportEvents() {
    exportCsv(
      'admin-audit-events.csv',
      (events?.items ?? []).map((event) => ({
        timestamp: event.createdAt,
        actor: event.actorUser?.displayName ?? 'System',
        actorRole: event.actorRole,
        event: event.event,
        entityType: event.entityType,
        entityReference: event.entityRef ?? '',
        severity: event.severity,
        summary: event.summary
      }))
    );
    void adminApi.recordAction({ actionType: 'EXPORT', entityType: 'audit_events', summary: `Exported ${events?.items.length ?? 0} audit events.` });
  }

  return (
    <AdminShell currentPath="/admin/audit" title="Admin Audit Trail">
      <AdminHero
        badge={loading ? 'Loading' : `${events?.total ?? 0} events`}
        heading="Full Audit Trail"
        body="Trace platform events, admin actions, authentication activity, verification decisions, and compliance evidence."
        actions={
          <>
            <button className="btn btn-secondary" type="button" disabled={loading || !events?.items.length} onClick={exportEvents}>Export CSV</button>
            <button className="btn btn-secondary" type="button" onClick={printAdminPage}>Print PDF</button>
            <button className="btn btn-primary" type="button" disabled={loading} onClick={() => void load(1)}>Refresh</button>
          </>
        }
      />

      {error ? <AdminError error={error} title="Audit trail could not load" /> : null}

      <AdminPanel kicker="Filters" title="Audit filters" badge="Live database">
        <div className="admin-filter-bar">
          <input className="form-input" type="search" placeholder="Search event, entity type, or reference" value={query} onChange={(event) => setQuery(event.target.value)} />
          <input className="form-input" placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} />
          <input className="form-input" placeholder="Event type" value={eventType} onChange={(event) => setEventType(event.target.value)} />
          <select className="form-input" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {severities.map((item) => <option value={item} key={item || 'all'}>{item ? displayLabel(item) : 'All severities'}</option>)}
          </select>
          <select className="form-input" value={actorRole} onChange={(event) => setActorRole(event.target.value)}>
            <option value="">All actor roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>
          <input className="form-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="form-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void load(1)}>
            Apply
          </button>
        </div>
      </AdminPanel>

      <AdminPanel kicker="Events" title="Audit events" badge={`${events?.items.length ?? 0} visible`}>
        <div className="data-table evaluation-table-scroll admin-data-table admin-audit-table">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Entity</th>
                <th>Severity</th>
                <th>Actor</th>
                <th>Organization</th>
                <th>Summary</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(events?.items ?? []).map((event) => (
                <tr key={event.id}>
                  <td><strong>{event.event}</strong><em>{event.id}</em></td>
                  <td><span>{displayLabel(event.entityType)}</span><em>{event.entityRef ?? 'No reference'}</em></td>
                  <td><span className={badgeClass(event.severity)}>{displayLabel(event.severity)}</span></td>
                  <td><span>{event.actorUser?.displayName ?? 'System'}</span><em>{event.actorRole} / {event.actorUser?.email ?? 'No actor'}</em></td>
                  <td>{event.ownerOrg?.name ?? 'Platform'}</td>
                  <td>{event.summary}</td>
                  <td>{formatDate(event.createdAt)}</td>
                </tr>
              ))}
              {!events?.items.length ? <EmptyRow colSpan={7} label={loading ? 'Loading audit events.' : 'No audit events match the filters.'} /> : null}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span className="badge badge-info">
            Showing {events?.items.length ?? 0} of {events?.total ?? 0}
          </span>
          <button className="btn btn-secondary btn-sm" type="button" disabled={loading || !events || events.items.length >= events.total} onClick={() => void load(page + 1, true)}>
            Load More
          </button>
        </div>
      </AdminPanel>
    </AdminShell>
  );
}
