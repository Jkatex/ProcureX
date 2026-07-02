import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '../../hooks';
import type { TenderDetail } from '../../types';

const tabs = ['Overview', 'Requirements', 'Submissions', 'Clarifications', 'Evaluation'];

export function TenderDetailsProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);

  if (!tenderId) return <BuyerEmpty message="Open one of your tenders from My Tenders to view buyer details." />;
  if (isLoading) return <BuyerEmpty message="Loading buyer tender detail..." />;
  if (isError || !tender) return <BuyerEmpty message="Tender detail could not be loaded. Return to My Tenders and try again." />;

  const submitted = tender.bidSummary?.submitted ?? 0;
  const draft = tender.bidSummary?.draft ?? 0;
  const readyForEvaluation = submitted > 0 && ['CLOSED', 'EVALUATION', 'AWARDED'].includes(tender.status);

  return (
    <div className="procurement-app-page tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Buyer tender detail</span>
            <h1>{tender.title}</h1>
            <p>{tender.description || 'Track tender activity, supplier interest, amendments, clarifications, sealed submissions, and evaluation readiness.'}</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-primary" to="/evaluation">
              Open Evaluation
            </Link>
            <Link className="btn btn-secondary" to="/procurement/my-tenders">
              My Tenders
            </Link>
          </div>
        </section>

        <section className="procurement-market-summary">
          <Kpi label="Published status" value={formatStatus(tender.status)} />
          <Kpi label="Submitted bids" value={String(submitted)} />
          <Kpi label="Draft supplier bids" value={String(draft)} />
          <Kpi label="Closing" value={formatDate(tender.closingDate)} />
        </section>

        <section className="supplier-detail-tabbed-view marketplace-tabbed-view">
          <div className="supplier-detail-tabs buyer-detail-tabs" role="tablist" aria-label="Tender detail sections">
            {tabs.map((tab, index) => (
              <button className={`supplier-detail-tab ${index === 0 ? 'active' : ''}`} type="button" role="tab" aria-selected={index === 0} key={tab}>
                {tab}
              </button>
            ))}
          </div>
          <div className="supplier-detail-tab-panels marketplace-tab-panels">
            <section className="supplier-detail-tab-panel" role="tabpanel" aria-label="Tender overview">
              <div className="journey-grid three-col">
                <article className="journey-panel control-panel">
                  <span className="section-kicker">Tender activity</span>
                  <h2>Publication Summary</h2>
                  <div className="record-summary compact">
                    <SummaryItem label="Reference" value={tender.reference} />
                    <SummaryItem label="Buyer" value={tender.organization} />
                    <SummaryItem label="Method" value={tender.method || 'Open Tender'} />
                    <SummaryItem label="Visibility" value={formatStatus(tender.visibility || 'PUBLIC_MARKETPLACE')} />
                  </div>
                </article>

                <article className="journey-panel control-panel">
                  <span className="section-kicker">Submission counts</span>
                  <h2>Sealed Bid Summary</h2>
                  <div className="record-summary compact">
                    <SummaryItem label="Total bid records" value={String(tender.bidSummary?.total ?? 0)} />
                    <SummaryItem label="Submitted" value={String(submitted)} />
                    <SummaryItem label="Withdrawn" value={String(tender.bidSummary?.withdrawn ?? 0)} />
                    <SummaryItem label="Disclosure" value="Sealed until evaluation" />
                  </div>
                </article>

                <article className="journey-panel control-panel">
                  <span className="section-kicker">Evaluation readiness</span>
                  <h2>{readyForEvaluation ? 'Ready to evaluate' : 'Awaiting close'}</h2>
                  <div className="progress-stack">
                    <div>
                      <span>Submission coverage</span>
                      <strong>{submitted}</strong>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min(100, submitted * 25)}%` }} />
                    </div>
                    <p>{readyForEvaluation ? 'Evaluation can begin using the sealed submission summaries.' : 'Detailed bid contents remain sealed until the existing evaluation workflow opens them.'}</p>
                  </div>
                </article>
              </div>

              <article className="tender-document-view">
                <TenderSection index="01" kicker="Requirements" title="Buyer requirements">
                  <RequirementRows tender={tender} />
                </TenderSection>
                <TenderSection index="02" kicker="Commercial" title="Commercial schedule">
                  <CommercialTable tender={tender} />
                </TenderSection>
                <TenderSection index="03" kicker="Timeline" title="Timeline, clarifications, and amendments">
                  <div className="journey-grid three-col">
                    <article className="journey-panel control-panel">
                      <span className="section-kicker">Clarifications</span>
                      <h2>Supplier questions</h2>
                      <p>No open clarification questions are awaiting buyer response.</p>
                      <Link className="btn btn-secondary" to="/communication">
                        Communication Center
                      </Link>
                    </article>
                    <article className="journey-panel control-panel">
                      <span className="section-kicker">Amendments</span>
                      <h2>Addenda</h2>
                      <p>Create structured amendments from the tender workspace when requirements, documents, dates, or pricing instructions change.</p>
                      <button className="btn btn-secondary" type="button">
                        Create Amendment
                      </button>
                    </article>
                    <article className="journey-panel control-panel">
                      <span className="section-kicker">Documents</span>
                      <h2>Tender pack</h2>
                      <p>{(tender.documents ?? []).length} document{(tender.documents ?? []).length === 1 ? '' : 's'} attached for supplier review.</p>
                      <Link className="btn btn-secondary" to={`/procurement/supplier-tender-detail?tenderId=${tender.id}`}>
                        Supplier View
                      </Link>
                    </article>
                  </div>
                </TenderSection>
              </article>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function BuyerEmpty({ message }: { message: string }) {
  return (
    <div className="procurement-app-page tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Buyer tender detail</span>
            <h1>Tender detail</h1>
            <p>{message}</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-secondary" to="/procurement/my-tenders">
              My Tenders
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TenderSection({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="tender-document-section">
      <div className="tender-document-section-heading">
        <span>{index}</span>
        <div>
          <small>{kicker}</small>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="tender-document-section-body">{children}</div>
    </section>
  );
}

function RequirementRows({ tender }: { tender: TenderDetail }) {
  const rows = tender.requirementRows ?? [];
  if (!rows.length) return <div className="scope-empty">No structured requirement rows configured.</div>;
  return (
    <div className="tender-detail-card-list">
      {rows.map((row) => (
        <article className="supplier-requirement-preview" key={row.id}>
          <span>{row.section}</span>
          <strong>{payloadTitle(row.payload, row.section)}</strong>
          <p>{payloadSummary(row.payload)}</p>
        </article>
      ))}
    </div>
  );
}

function CommercialTable({ tender }: { tender: TenderDetail }) {
  const rows = tender.commercialItems ?? [];
  if (!rows.length) return <div className="scope-empty">No commercial schedule configured.</div>;
  return (
    <div className="data-table tender-detail-table">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Requirement</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Estimate</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{row.itemNo || String(index + 1)}</td>
              <td>{row.description}</td>
              <td>{row.quantity}</td>
              <td>{row.unit || 'Lot'}</td>
              <td>{formatMoney(row.rate, tender.currency)}</td>
              <td>{formatMoney(row.total || row.quantity * row.rate, tender.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function payloadTitle(payload: Record<string, unknown>, fallback: string) {
  return String(payload.title || payload.name || payload.requirementName || payload.text || fallback);
}

function payloadSummary(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([key, value]) => key !== 'id' && value !== undefined && value !== null && String(value).trim())
    .slice(0, 4)
    .map(([key, value]) => `${humanize(key)}: ${formatUnknown(value)}`)
    .join(' / ');
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatUnknown).join(', ');
  if (value && typeof value === 'object') return payloadTitle(value as Record<string, unknown>, 'Configured');
  return String(value ?? '');
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
