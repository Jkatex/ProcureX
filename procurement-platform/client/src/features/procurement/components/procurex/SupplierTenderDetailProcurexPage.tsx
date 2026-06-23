import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '../../hooks';
import type { TenderDetail } from '../../types';

export function SupplierTenderDetailProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);

  if (!tenderId) return <EmptyTenderDetail message="Open a tender from the marketplace to view its supplier tender pack." />;
  if (isLoading) return <EmptyTenderDetail message="Loading tender detail..." />;
  if (isError || !tender) return <EmptyTenderDetail message="Tender detail could not be loaded. Return to the marketplace and try again." />;

  const bidUrl = `/bidding?tenderId=${tender.id}`;
  const alreadyBid = tender.currentBid?.status === 'SUBMITTED' || tender.hasSubmittedBid;

  return (
    <div className="procurement-app-page supplier-tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Supplier tender detail</span>
            <h1>{tender.title}</h1>
            <p>{tender.description || 'Review the complete tender document, required evidence, commercial schedule, and timeline before preparing a sealed bid.'}</p>
          </div>
          <div className="hero-action-stack">
            {alreadyBid ? (
              <Link className="btn btn-secondary" to={bidUrl}>
                Open Submitted Bid
              </Link>
            ) : (
              <Link className="btn btn-primary" to={bidUrl}>
                {tender.currentBid ? 'Continue Bid' : 'Start Bid'}
              </Link>
            )}
            <Link className="btn btn-secondary" to="/procurement/marketplace">
              Marketplace
            </Link>
          </div>
        </section>

        <section className="procurement-market-summary">
          <Kpi label="Reference" value={tender.reference} />
          <Kpi label="Buyer" value={tender.organization} />
          <Kpi label="Budget" value={formatMoney(tender.budget, tender.currency)} />
          <Kpi label="Closing" value={formatDate(tender.closingDate)} />
        </section>

        <article className="tender-document-view">
          <section className="tender-document-cover">
            <div>
              <span className="tender-document-stamp">
                <strong>{tender.reference}</strong>
                <span>{formatStatus(tender.status)}</span>
              </span>
              <h2>Tender Document</h2>
              <p>{tender.organization} / {formatTenderType(tender.type)} / {tender.location}</p>
            </div>
          </section>

          <section className="tender-document-meta-table">
            <div className="record-summary tender-detail-summary">
              <SummaryItem label="Procurement method" value={tender.method || 'Open Tender'} />
              <SummaryItem label="Visibility" value={formatStatus(tender.visibility || 'PUBLIC_MARKETPLACE')} />
              <SummaryItem label="Published" value={formatDate(tender.publishedAt || '')} />
              <SummaryItem label="Bid state" value={tender.currentBid ? formatStatus(tender.currentBid.status) : 'Not started'} />
            </div>
          </section>

          <TenderSection index="01" kicker="Scope" title="Requirements and eligibility">
            <div className="tender-detail-field-grid">
              <FieldCard label="Location" value={tender.location} />
              <FieldCard label="Tender type" value={formatTenderType(tender.type)} />
              <FieldCard label="Categories" value={tender.categories.join(', ') || 'Not specified'} />
              <FieldCard label="Currency" value={tender.currency} />
            </div>
            <RequirementRows tender={tender} />
          </TenderSection>

          <TenderSection index="02" kicker="Commercial" title="Commercial schedule">
            <CommercialTable tender={tender} />
          </TenderSection>

          <TenderSection index="03" kicker="Documents" title="Tender documents and required uploads">
            <div className="tender-detail-attachment-grid">
              {(tender.documents ?? []).length ? (
                tender.documents?.map((document) => (
                  <article className="supplier-requirement-preview" key={document.id}>
                    <span>{document.documentType}</span>
                    <strong>{document.name}</strong>
                    <p>{document.label || 'Tender document'}</p>
                  </article>
                ))
              ) : (
                <div className="scope-empty">No tender documents are attached.</div>
              )}
            </div>
          </TenderSection>

          <TenderSection index="04" kicker="Timeline" title="Tender timeline and clarifications">
            <Timeline tender={tender} />
            <div className="clarification-deadline-card">
              <div>
                <span className="section-kicker">Clarifications</span>
                <strong>Ask buyer a question</strong>
                <p>Supplier clarification messages are tracked in the communication center and linked to this tender record.</p>
              </div>
              <Link className="btn btn-secondary" to="/communication-center">
                Ask Buyer
              </Link>
            </div>
          </TenderSection>
        </article>
      </main>
    </div>
  );
}

function EmptyTenderDetail({ message }: { message: string }) {
  return (
    <div className="procurement-app-page supplier-tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Supplier tender detail</span>
            <h1>Tender detail</h1>
            <p>{message}</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-secondary" to="/procurement/marketplace">
              Marketplace
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

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="tender-detail-field-card">
      <span>{label}</span>
      <strong>{value || 'Not specified'}</strong>
    </article>
  );
}

function RequirementRows({ tender }: { tender: TenderDetail }) {
  const rows = tender.requirementRows ?? [];
  if (!rows.length && !Object.keys(tender.requirements ?? {}).length) return <div className="scope-empty">No structured requirement fields configured.</div>;
  return (
    <div className="tender-detail-card-list">
      {rows.map((row) => (
        <article className="supplier-requirement-preview" key={row.id}>
          <span>{row.section}</span>
          <strong>{payloadTitle(row.payload, row.section)}</strong>
          <p>{payloadSummary(row.payload)}</p>
        </article>
      ))}
      {Object.entries(tender.requirements ?? {}).map(([key, value]) => (
        <article className="supplier-requirement-preview" key={key}>
          <span>{humanize(key)}</span>
          <strong>{formatUnknown(value)}</strong>
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
            <th>Rate</th>
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

function Timeline({ tender }: { tender: TenderDetail }) {
  const rows = [
    { id: 'published', name: 'Tender published', dueDate: tender.publishedAt },
    ...(tender.milestones ?? []),
    { id: 'closing', name: 'Submission deadline', dueDate: tender.closingDate }
  ];
  return (
    <div className="supplier-timeline-list">
      {rows.map((row) => (
        <div className="timeline-row" key={row.id}>
          <span>{formatDate(row.dueDate || '')}</span>
          <strong>{row.name}</strong>
          <span className="badge badge-info">{row.id === 'closing' ? 'Deadline' : 'Milestone'}</span>
        </div>
      ))}
    </div>
  );
}

function payloadTitle(payload: Record<string, unknown>, fallback: string) {
  return String(payload.title || payload.name || payload.requirementName || payload.text || fallback);
}

function payloadSummary(payload: Record<string, unknown>) {
  const pairs = Object.entries(payload)
    .filter(([key, value]) => key !== 'id' && value !== undefined && value !== null && String(value).trim())
    .slice(0, 4)
    .map(([key, value]) => `${humanize(key)}: ${formatUnknown(value)}`);
  return pairs.join(' / ') || 'Buyer requirement';
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

function formatTenderType(value: string) {
  return formatStatus(value === 'SERVICE' ? 'Services' : value);
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
