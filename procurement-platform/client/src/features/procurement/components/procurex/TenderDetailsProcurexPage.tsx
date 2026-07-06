import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '../../hooks';
import type { TenderDetail } from '../../types';

const tabs = [
  { id: 'procurement', label: 'Procurement details' },
  { id: 'questions', label: 'Questions and amendments' },
  { id: 'activity', label: 'Supplier activity' },
  { id: 'evaluation', label: 'Evaluation and records' }
];

export function TenderDetailsProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);
  const [activeTab, setActiveTab] = useState('procurement');

  if (!tenderId) return <BuyerEmpty message="Open one of your tenders from My Tenders to view buyer details." />;
  if (isLoading) return <BuyerEmpty message="Loading buyer tender detail..." />;
  if (isError || !tender) return <BuyerEmpty message="Tender detail could not be loaded. Return to My Tenders and try again." />;

  const submitted = tender.bidSummary?.submitted ?? 0;
  const draft = tender.bidSummary?.draft ?? 0;
  const withdrawn = tender.bidSummary?.withdrawn ?? 0;
  const readyForEvaluation = submitted > 0 && ['CLOSED', 'EVALUATION', 'AWARDED', 'Closed', 'Evaluation', 'Awarded'].includes(tender.status);

  return (
    <div className="procurement-app-page tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">{tender.reference} / {tender.organization}</span>
            <h1>{tender.title}</h1>
            <p>Manage live tender interactions, amendments, supplier clarifications, and evaluation readiness.</p>
          </div>
          <div className="hero-action-stack">
            <Link className="btn btn-primary" to="/evaluation">Open Evaluation</Link>
            <Link className="btn btn-secondary" to={`/procurement/supplier-tender-detail?tenderId=${tender.id}`}>Supplier View</Link>
            <Link className="btn btn-secondary" to="/procurement/my-tenders">My Tenders</Link>
          </div>
        </section>

        <section className="procurement-market-summary">
          <Kpi label="Published status" value={formatStatus(tender.status)} />
          <Kpi label="Submitted bids" value={String(submitted)} />
          <Kpi label="Draft supplier bids" value={String(draft)} />
          <Kpi label="Closing" value={formatDate(tender.closingDate)} />
        </section>

        <section className="supplier-detail-tabbed-view buyer-detail-tabbed-view">
          <div className="supplier-detail-tabs buyer-detail-tabs" role="tablist" aria-label="Buyer tender detail sections">
            {tabs.map((tab) => (
              <button className={`supplier-detail-tab ${tab.id === activeTab ? 'active' : ''}`} type="button" role="tab" aria-selected={tab.id === activeTab} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="supplier-detail-tab-panels buyer-detail-tab-panels">
            <section className="supplier-detail-tab-panel" role="tabpanel">
              {activeTab === 'procurement' ? <ProcurementPanel tender={tender} /> : null}
              {activeTab === 'questions' ? <QuestionsPanel tender={tender} /> : null}
              {activeTab === 'activity' ? <ActivityPanel tender={tender} submitted={submitted} draft={draft} withdrawn={withdrawn} /> : null}
              {activeTab === 'evaluation' ? <EvaluationPanel tender={tender} submitted={submitted} readyForEvaluation={readyForEvaluation} /> : null}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProcurementPanel({ tender }: { tender: TenderDetail }) {
  return (
    <article className="tender-document-view">
      <TenderSection index="01" kicker="Instructions and Tender Scope" title="Customer information">
        <div className="tender-detail-field-grid">
          <FieldCard label="Reference" value={tender.reference} />
          <FieldCard label="Buyer organization" value={tender.organization} />
          <FieldCard label="Tender type" value={formatTenderType(tender.type)} />
          <FieldCard label="Location" value={tender.location} />
        </div>
        <p>{tender.description}</p>
      </TenderSection>
      <TenderSection index="02" kicker="Eligibility and Compliance" title="Purchase information">
        <div className="record-summary tender-detail-summary">
          <SummaryItem label="Procurement method" value={tender.method || 'OPEN_TENDER'} />
          <SummaryItem label="Visibility" value={formatStatus(tender.visibility || 'PUBLIC_MARKETPLACE')} />
          <SummaryItem label="Budget" value={formatMoney(tender.budget, tender.currency)} />
          <SummaryItem label="Published" value={formatDate(tender.publishedAt || '')} />
        </div>
      </TenderSection>
      <TenderSection index="03" kicker="Documents and Annexes" title="Tender documentation">
        <RequirementRows tender={tender} />
      </TenderSection>
      <TenderSection index="04" kicker="Evaluation Criteria and Submission Responses" title="Commercial schedule">
        <CommercialTable tender={tender} />
      </TenderSection>
      <TenderSection index="05" kicker="Programme and Key Dates" title="Timeline">
        <Timeline tender={tender} />
      </TenderSection>
    </article>
  );
}

function QuestionsPanel({ tender }: { tender: TenderDetail }) {
  return (
    <div className="journey-grid three-col">
      <InfoPanel kicker="Clarifications" title="Supplier questions">
        <p>No open clarification questions are awaiting buyer response for {tender.reference}.</p>
        <Link className="btn btn-secondary" to="/communication">Communication Center</Link>
      </InfoPanel>
      <InfoPanel kicker="Amendment workspace" title="Addenda">
        <p>Create structured amendments when requirements, documents, dates, or pricing instructions change.</p>
        <button className="btn btn-secondary" type="button">Create Amendment</button>
      </InfoPanel>
      <InfoPanel kicker="Published record" title="Tender documents">
        <p>{(tender.documents ?? []).length} document{(tender.documents ?? []).length === 1 ? '' : 's'} attached for supplier review.</p>
        <Link className="btn btn-secondary" to={`/procurement/supplier-tender-detail?tenderId=${tender.id}`}>Preview Supplier View</Link>
      </InfoPanel>
    </div>
  );
}

function ActivityPanel({ tender, submitted, draft, withdrawn }: { tender: TenderDetail; submitted: number; draft: number; withdrawn: number }) {
  return (
    <div className="journey-grid three-col">
      <InfoPanel kicker="Supplier activity" title="Aggregate interest">
        <div className="record-summary compact">
          <SummaryItem label="Total bid records" value={String(tender.bidSummary?.total ?? 0)} />
          <SummaryItem label="Draft bid packages" value={String(draft)} />
          <SummaryItem label="Submitted sealed packages" value={String(submitted)} />
          <SummaryItem label="Withdrawn packages" value={String(withdrawn)} />
        </div>
      </InfoPanel>
      <InfoPanel kicker="Sealed disclosure" title="Confidentiality gate">
        <p>Supplier identity and bid contents remain sealed here. Evaluation workflows open records only after the tender reaches the configured opening stage.</p>
      </InfoPanel>
      <InfoPanel kicker="Records" title="Audit trail">
        <p>Draft saves, submissions, withdrawals, receipts, amendments, and clarifications are recorded against stable tender and bid identifiers.</p>
      </InfoPanel>
    </div>
  );
}

function EvaluationPanel({ tender, submitted, readyForEvaluation }: { tender: TenderDetail; submitted: number; readyForEvaluation: boolean }) {
  return (
    <div className="journey-grid three-col">
      <InfoPanel kicker="Evaluation readiness" title={readyForEvaluation ? 'Ready to evaluate' : 'Awaiting close'}>
        <div className="progress-stack">
          <div>
            <span>Submission coverage</span>
            <strong>{submitted}</strong>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(100, submitted * 25)}%` }} />
          </div>
          <p>{readyForEvaluation ? 'Evaluation can begin using sealed submission records.' : 'Detailed bid contents remain sealed until the configured opening stage.'}</p>
        </div>
      </InfoPanel>
      <InfoPanel kicker="Receipt evidence" title="Submission records">
        <p>Receipt hashes and sealed bid versions are stored in the bidding ledger and connected to {tender.reference}.</p>
      </InfoPanel>
      <InfoPanel kicker="Next step" title="Evaluation workspace">
        <Link className="btn btn-primary" to="/evaluation">Open Evaluation</Link>
      </InfoPanel>
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
            <Link className="btn btn-secondary" to="/procurement/my-tenders">My Tenders</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoPanel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <article className="journey-panel control-panel">
      <span className="section-kicker">{kicker}</span>
      <h2>{title}</h2>
      {children}
    </article>
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

function TenderSection({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: ReactNode }) {
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
  const rows = tender.requirementRows?.length ? tender.requirementRows : requirementRowsFromJson(tender.requirements);
  if (!rows.length) return <div className="scope-empty">No structured requirement rows configured.</div>;
  return (
    <div className="tender-detail-card-list">
      {rows.map((row) => (
        <article className="supplier-requirement-preview" key={row.id}>
          <span>{humanize(row.section)}</span>
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

function requirementRowsFromJson(requirements?: Record<string, unknown>) {
  if (!requirements) return [];
  return Object.entries(requirements).flatMap(([section, value]) => {
    if (Array.isArray(value)) return value.map((item, index) => ({ id: `${section}-${index}`, section, payload: objectPayload(item) }));
    if (value && typeof value === 'object') return [{ id: section, section, payload: objectPayload(value) }];
    return [{ id: section, section, payload: { value } }];
  });
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function payloadTitle(payload: Record<string, unknown>, fallback: string) {
  return String(payload.title || payload.name || payload.requirementName || payload.description || payload.value || fallback);
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
