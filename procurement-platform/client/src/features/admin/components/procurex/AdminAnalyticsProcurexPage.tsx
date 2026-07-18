import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, type AdminAnalytics } from '@/features/admin/api';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminError, AdminHero, AdminPanel, AdminShell } from './AdminShared';
import { compactNumber, displayLabel, exportCsv, formatDate, maxCount, printAdminPage } from './AdminSharedUtils';

export function AdminAnalyticsProcurexPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const rangeRef = useRef({ from: '', to: '' });

  rangeRef.current = { from, to };

  useBodyPageMetadata('admin-analytics');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = rangeRef.current;
      setAnalytics(await adminApi.analytics({ from: range.from || undefined, to: range.to || undefined }));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = analytics?.totals ?? {};

  function exportAnalytics() {
    exportCsv('admin-analytics.csv', [
      { metric: 'Total procurement value', value: analytics?.procurementValue ?? 0 },
      { metric: 'Tenders published', value: analytics?.tendersPublished ?? 0 },
      { metric: 'Average evaluation duration days', value: analytics?.avgEvaluationDurationDays ?? 0 },
      { metric: 'Average award cycle days', value: analytics?.avgAwardCycleDays ?? 0 },
      ...(analytics?.procurementTypeBreakdown ?? []).map((item) => ({
        metric: `Type ${displayLabel(item.type)}`,
        tenders: item.tenders,
        value: item.totalValue,
        avgBidsPerTender: item.avgBidsPerTender,
        avgDaysToAward: item.avgDaysToAward
      }))
    ]);
    void adminApi.recordAction({ actionType: 'EXPORT', entityType: 'admin_analytics', summary: 'Exported platform analytics.' });
  }

  return (
    <AdminShell currentPath="/admin/analytics" title="Admin Analytics">
      <AdminHero
        badge={loading ? 'Loading' : 'Live aggregates'}
        heading="Platform Analytics"
        body="Monitor platform volume, workflow distribution, compliance outcomes, and audit severity from operational database aggregates."
        actions={
          <>
            <button className="btn btn-secondary" type="button" disabled={loading || !analytics} onClick={exportAnalytics}>Export CSV</button>
            <button className="btn btn-secondary" type="button" onClick={printAdminPage}>Print PDF</button>
            <button className="btn btn-primary" type="button" disabled={loading} onClick={() => void load()}>Refresh</button>
          </>
        }
      />

      {error ? <AdminError error={error} title="Analytics could not load" /> : null}

      <AdminPanel kicker="Range" title="Analytics filters" badge={analytics ? formatDate(analytics.generatedAt) : 'Loading'}>
        <div className="admin-filter-bar">
          <input className="form-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="form-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void load()}>Apply Range</button>
        </div>
      </AdminPanel>

      <section className="admin-kpi-grid six-col">
        {[
          ['Total Procurement Value', analytics?.procurementValue ?? 0],
          ['Tenders Published', analytics?.tendersPublished ?? totals.tenders],
          ['Avg Evaluation Days', analytics?.avgEvaluationDurationDays ?? 0],
          ['Avg Award Cycle Days', analytics?.avgAwardCycleDays ?? 0],
          ['Contracts', totals.contracts],
          ['Audit Events', totals.auditEvents]
        ].map(([label, value]) => (
          <article className="admin-kpi-card" key={label}>
            <span>{label}</span>
            <strong>{compactNumber(Number(value ?? 0))}</strong>
            <em>{analytics ? `As of ${formatDate(analytics.generatedAt)}` : 'Loading'}</em>
          </article>
        ))}
      </section>

      <section className="journey-grid two-column">
        <AdminPanel kicker="Identity" title="Users by verification status" badge={`${analytics?.usersByVerificationStatus.length ?? 0} statuses`}>
          <HorizontalBars items={analytics?.usersByVerificationStatus ?? []} labelKey="status" />
        </AdminPanel>

        <AdminPanel kicker="Procurement" title="Tenders by status" badge={`${analytics?.tendersByStatus.length ?? 0} statuses`}>
          <HorizontalBars items={analytics?.tendersByStatus ?? []} labelKey="status" />
        </AdminPanel>

        <AdminPanel kicker="Bidding" title="Bids by status" badge={`${analytics?.bidsByStatus.length ?? 0} statuses`}>
          <HorizontalBars items={analytics?.bidsByStatus ?? []} labelKey="status" />
        </AdminPanel>

        <AdminPanel kicker="Compliance" title="Cases and audit severity" badge={`${analytics?.complianceByStatus.length ?? 0} case statuses`}>
          <HorizontalBars items={[...(analytics?.complianceByStatus ?? []), ...(analytics?.auditBySeverity ?? []).map((item) => ({ status: item.severity, count: item.count }))]} labelKey="status" />
        </AdminPanel>
      </section>

      <section className="journey-grid two-column">
        <AdminPanel kicker="Procurement" title="Procurement volume by category" badge={`${analytics?.procurementByCategory.length ?? 0} categories`}>
          <ValueBars items={(analytics?.procurementByCategory ?? []).map((item) => ({ label: item.category, count: item.count, value: item.value }))} />
        </AdminPanel>

        <AdminPanel kicker="Mix" title="Tender status mix" badge={`${analytics?.tenderStatusMix.length ?? 0} statuses`}>
          <HorizontalBars items={analytics?.tenderStatusMix ?? []} labelKey="status" />
        </AdminPanel>
      </section>

      <AdminPanel kicker="Breakdown" title="Procurement breakdown" badge={`${analytics?.procurementTypeBreakdown.length ?? 0} types`}>
        <div className="data-table evaluation-table-scroll admin-data-table">
          <table>
            <thead>
              <tr>
                <th>Procurement type</th>
                <th>Tenders</th>
                <th>Total value</th>
                <th>Avg bids/tender</th>
                <th>Avg days to award</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.procurementTypeBreakdown ?? []).map((item) => (
                <tr key={item.type}>
                  <td>{displayLabel(item.type)}</td>
                  <td>{item.tenders}</td>
                  <td>{compactNumber(item.totalValue)}</td>
                  <td>{item.avgBidsPerTender}</td>
                  <td>{item.avgDaysToAward}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <section className="journey-grid two-column">
        <AdminPanel kicker="Buyers" title="Top buyer organizations" badge={`${analytics?.topBuyers.length ?? 0} buyers`}>
          <ValueBars items={(analytics?.topBuyers ?? []).map((item) => ({ label: item.organization, count: item.tenders, value: item.value }))} />
        </AdminPanel>
        <AdminPanel kicker="Suppliers" title="Top supplier organizations" badge={`${analytics?.topSuppliers.length ?? 0} suppliers`}>
          <ValueBars items={(analytics?.topSuppliers ?? []).map((item) => ({ label: item.organization, count: item.bids, value: item.value }))} />
        </AdminPanel>
      </section>

      <AdminPanel kicker="Compliance" title="Compliance rate trend" badge={`${analytics?.complianceTrend.length ?? 0} periods`}>
        <div className="admin-horizontal-bars">
          {(analytics?.complianceTrend ?? []).map((item) => (
            <div key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.rate}%</span>
              <i style={{ width: `${Math.max(8, item.rate)}%` }}></i>
            </div>
          ))}
        </div>
      </AdminPanel>
    </AdminShell>
  );
}

function HorizontalBars({ items, labelKey }: { items: Array<{ count: number } & Record<string, string | number>>; labelKey: string }) {
  const max = maxCount(items);
  return (
    <div className="admin-horizontal-bars">
      {items.map((item) => {
        const label = String(item[labelKey]);
        return (
          <div key={label}>
            <strong>{displayLabel(label)}</strong>
            <span>{item.count}</span>
            <i style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}></i>
          </div>
        );
      })}
      {!items.length ? <div className="admin-mini-record"><strong>No analytics data</strong><em>Aggregates will appear after records exist.</em></div> : null}
    </div>
  );
}

function ValueBars({ items }: { items: Array<{ label: string; count: number; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="admin-horizontal-bars">
      {items.map((item) => (
        <div key={item.label}>
          <strong>{displayLabel(item.label)}</strong>
          <span>{item.count} / {compactNumber(item.value)}</span>
          <i style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }}></i>
        </div>
      ))}
      {!items.length ? <div className="admin-mini-record"><strong>No value data</strong><em>Values will appear after procurement records exist.</em></div> : null}
    </div>
  );
}
