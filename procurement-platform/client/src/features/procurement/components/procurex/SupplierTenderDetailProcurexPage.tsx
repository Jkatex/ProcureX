import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenderDetail } from '../../hooks';
import type { TenderDetail } from '../../types';

const tabs = [
  { id: 'procurement', label: 'Procurement details' },
  { id: 'requirements', label: 'Questions and requirements' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'monitoring', label: 'Monitoring and reporting' }
];

const documentSections = [
  'Customer information',
  'Purchase information',
  'Tender documentation',
  'Documents',
  'Contracts'
];

export function SupplierTenderDetailProcurexPage() {
  const [params] = useSearchParams();
  const tenderId = params.get('tenderId');
  const { data: tender, isLoading, isError } = useTenderDetail(tenderId);
  const [activeTab, setActiveTab] = useState('procurement');
  const [activeSection, setActiveSection] = useState(documentSections[0]);

  if (!tenderId) return <EmptyTenderDetail message="Open a tender from the marketplace to view its supplier tender pack." />;
  if (isLoading) return <EmptyTenderDetail message="Loading tender detail..." />;
  if (isError || !tender) return <EmptyTenderDetail message="Tender detail could not be loaded. Return to the marketplace and try again." />;

  const bidUrl = `/bidding?tenderId=${tender.id}`;
  const alreadyBid = tender.currentBid?.status === 'SUBMITTED' || tender.hasSubmittedBid;
  const canBid = Boolean(tender.canBid ?? (!tender.ownedByCurrentOrganization && !alreadyBid));

  return (
    <div className="procurement-app-page supplier-tender-detail-page">
      <main className="procurement-market-shell">
        <section className="journey-hero compact">
          <div>
            <span className="section-kicker">Supplier tender detail</span>
            <h1>{tender.title}</h1>
            <p>{tender.description || 'Review the complete tender document, required evidence, commercial schedule, and timeline before preparing a sealed bid.'}</p>
          </div>
          <div className="hero-action-stack supplier-detail-actions">
            {alreadyBid ? (
              <Link className="btn btn-secondary supplier-detail-primary-action" to={bidUrl}>
                Open Submitted Bid
              </Link>
            ) : canBid ? (
              <Link className="btn btn-primary supplier-detail-primary-action" to={bidUrl}>
                {tender.currentBid || tender.hasDraftBid ? 'Continue Bid' : 'Start Bid'}
              </Link>
            ) : (
              <button className="btn btn-primary supplier-detail-primary-action" type="button" disabled>
                Bidding unavailable
              </button>
            )}
            <div className="supplier-detail-action-row">
              <Link className="btn btn-secondary" to="/procurement/marketplace">Marketplace</Link>
              <Link className="btn btn-secondary" to="/communication">Ask Buyer</Link>
            </div>
          </div>
        </section>

        <section className="procurement-market-summary">
          <Kpi label="Reference" value={tender.reference} />
          <Kpi label="Buyer" value={tender.organization} />
          <Kpi label="Budget" value={formatMoney(tender.budget, tender.currency)} />
          <Kpi label="Closing" value={formatDate(tender.closingDate)} />
        </section>

        <section className="supplier-detail-tabbed-view">
          <div className="supplier-detail-tabs" role="tablist" aria-label="Supplier tender detail sections">
            {tabs.map((tab) => (
              <button className={`supplier-detail-tab ${tab.id === activeTab ? 'active' : ''}`} type="button" role="tab" aria-selected={tab.id === activeTab} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="supplier-detail-tab-panels">
            <section className="supplier-detail-tab-panel" role="tabpanel">
              {activeTab === 'procurement' ? (
                <ProcurementDocument tender={tender} activeSection={activeSection} setActiveSection={setActiveSection} />
              ) : activeTab === 'requirements' ? (
                <QuestionsAndRequirements tender={tender} />
              ) : activeTab === 'complaints' ? (
                <InfoPanel title="Complaints and Review" kicker="Supplier rights">
                  <p>Complaint notices and review requests are filed through the communication center and linked to this tender reference.</p>
                  <Link className="btn btn-secondary" to="/communication">Open Communication Center</Link>
                </InfoPanel>
              ) : (
                <InfoPanel title="Monitoring and Reporting" kicker="Post-submission">
                  <p>Submission receipt, clarification history, evaluation notices, and award updates remain attached to the supplier bid record.</p>
                  <Link className="btn btn-secondary" to={bidUrl}>Open Bid Workspace</Link>
                </InfoPanel>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProcurementDocument({ tender, activeSection, setActiveSection }: { tender: TenderDetail; activeSection: string; setActiveSection: (section: string) => void }) {
  return (
    <div className="supplier-detail-procurement-document">
      <div className="supplier-detail-subtabs supplier-detail-document-index">
        <div className="supplier-detail-tabs">
          {documentSections.map((section) => (
            <button className={`supplier-detail-tab ${section === activeSection ? 'active' : ''}`} type="button" key={section} onClick={() => setActiveSection(section)}>
              {section}
            </button>
          ))}
        </div>
      </div>

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

      {activeSection === 'Customer information' ? (
        <TenderSection index="01" kicker="Instructions and Tender Scope" title="Customer information">
          <div className="tender-detail-field-grid">
            <FieldCard label="Procuring entity" value={tender.organization} />
            <FieldCard label="Reference" value={tender.reference} />
            <FieldCard label="Tender type" value={formatTenderType(tender.type)} />
            <FieldCard label="Location" value={tender.location} />
          </div>
          <p>{tender.description}</p>
        </TenderSection>
      ) : null}

      {activeSection === 'Purchase information' ? (
        <TenderSection index="02" kicker="Eligibility and Compliance" title="Purchase information">
          <div className="record-summary tender-detail-summary">
            <SummaryItem label="Procurement method" value={tender.method || 'OPEN_TENDER'} />
            <SummaryItem label="Contract type" value={tender.contractType || 'Not specified'} />
            <SummaryItem label="Currency" value={tender.currency} />
            <SummaryItem label="Closing" value={formatDate(tender.closingDate)} />
          </div>
          <RequirementRows tender={tender} />
        </TenderSection>
      ) : null}

      {activeSection === 'Tender documentation' ? (
        <TenderSection index="03" kicker="Documents and Annexes" title="Tender documentation">
          <CommercialTable tender={tender} />
        </TenderSection>
      ) : null}

      {activeSection === 'Documents' ? (
        <TenderSection index="04" kicker="Evaluation Criteria and Submission Responses" title="Documents">
          <DocumentGrid tender={tender} />
        </TenderSection>
      ) : null}

      {activeSection === 'Contracts' ? (
        <TenderSection index="05" kicker="Programme and Key Dates" title="Contracts">
          <Timeline tender={tender} />
          <div className="clarification-deadline-card">
            <div>
              <span className="section-kicker">Clarifications</span>
              <strong>Ask buyer a question</strong>
              <p>Supplier clarification messages are tracked in the communication center and linked to this tender record.</p>
            </div>
            <Link className="btn btn-secondary" to="/communication">Ask Buyer</Link>
          </div>
        </TenderSection>
      ) : null}
    </div>
  );
}

function QuestionsAndRequirements({ tender }: { tender: TenderDetail }) {
  return (
    <div className="journey-grid three-col">
      <InfoPanel title="Required Responses" kicker="Supplier checklist">
        <RequirementRows tender={tender} />
      </InfoPanel>
      <InfoPanel title="Clarifications" kicker="Public Q&A">
        <p>No published clarification answers are attached to this tender yet.</p>
        <Link className="btn btn-secondary" to="/communication">Ask Buyer</Link>
      </InfoPanel>
      <InfoPanel title="Amendments" kicker="Tender updates">
        <p>Published addenda and buyer amendments will appear here and remain part of the tender record.</p>
      </InfoPanel>
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
            <Link className="btn btn-secondary" to="/procurement/marketplace">Marketplace</Link>
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
  if (!rows.length) return <div className="scope-empty">No structured requirement fields configured.</div>;
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

function DocumentGrid({ tender }: { tender: TenderDetail }) {
  return (
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
