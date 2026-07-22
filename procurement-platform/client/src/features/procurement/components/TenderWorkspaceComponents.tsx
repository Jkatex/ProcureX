/* Renders the procurement Tender Workspace Components UI while keeping page-specific presentation near its workflow data. */
import { Button, TextField } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { procurementTimeline } from '@/shared/data/fixtures';
import type { Tender } from '@/shared/types/domain';
import { StatusBadge } from '@/shared/components';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat';

export function CreateTenderWizardShell() {
  const { t } = useTranslation();
  const steps = ['Planning', 'Requirements', 'Commercials', 'Documents', 'Review'];
  return (
    <div className="tender-wizard-page">
      <section className="journey-hero compact">
        <div>
          <span className="section-kicker">{t('pages.createTender.title')}</span>
          <h1>{t('pages.createTender.title')}</h1>
          <p>{t('pages.createTender.subtitle')}</p>
        </div>
        <div className="hero-action-stack">
          <Button variant="outlined" className="btn btn-secondary">{t('actions.saveDraft')}</Button>
          <Button component={Link} to="/procurement/tender-publication" variant="contained" className="btn btn-primary">{t('actions.review')}</Button>
        </div>
      </section>
      <section className="wizard-shell">
        <aside className="wizard-rail">
          {steps.map((step, index) => (
            <button className={`wizard-rail-step ${index === 0 ? 'active' : ''}`} type="button" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </button>
          ))}
        </aside>
        <main className="wizard-workspace">
          <article className="journey-panel active">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Tender workspace</span>
                <h2>Procurement details</h2>
              </div>
              <StatusBadge value="Draft" />
            </div>
            <div className="form-grid">
              <TextField label="Tender title" placeholder="Enter the procurement title" />
              <TextField label="Procurement type" placeholder="Goods, works, services, or consultancy" />
              <TextField label="Budget" placeholder="Enter estimated budget" />
              <TextField label="Closing date" type="date" InputLabelProps={{ shrink: true }} />
              <TextField label="Scope summary" multiline minRows={5} placeholder="Describe the goods, works, services, or consultancy required." />
              <TextField label="Required documents" multiline minRows={5} placeholder="List eligibility, technical, financial, and declaration documents bidders must provide." />
            </div>
          </article>
        </main>
      </section>
    </div>
  );
}

export function TenderDocumentView({ tender, title, subtitle, actionLabel }: { tender: Tender; title: string; subtitle: string; actionLabel: string }) {
  const format = useLocaleFormat();

  return (
    <div className="supplier-tender-detail-page">
      <section className="journey-hero compact">
        <div>
          <span className="section-kicker">{title}</span>
          <h1>{tender.title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="hero-action-stack">
          <Button component={Link} to="/bidding" variant="contained" className="btn btn-primary">{actionLabel}</Button>
          <Button component={Link} to="/records" variant="outlined" className="btn btn-secondary">Records</Button>
        </div>
      </section>
      <article className="tender-document-view">
        <section className="tender-document-cover">
          <div>
            <span className="tender-document-stamp"><strong>{tender.reference}</strong><span>{tender.status}</span></span>
            <h2>{title}</h2>
            <p>{tender.description}</p>
          </div>
        </section>
        <section className="tender-document-meta-table">
          <div className="record-summary">
            <div><span>Buyer</span><strong>{tender.organization}</strong></div>
            <div><span>Type</span><strong>{tender.type}</strong></div>
            <div><span>Budget</span><strong>{format.money(tender.budget, tender.currency)}</strong></div>
            <div><span>Closing</span><strong>{format.date(tender.closingDate)}</strong></div>
          </div>
        </section>
        <section className="tender-document-section">
          <div className="tender-document-section-heading">
            <span>01</span>
            <div>
              <small>Scope of tender</small>
              <h3>Requirements and eligibility</h3>
            </div>
          </div>
          <div className="tender-document-section-body">
            <div className="tender-detail-field-grid">
              {tender.categories.map((category) => (
                <article className="tender-detail-field-card" key={category}>
                  <span>Category</span>
                  <strong>{category}</strong>
                </article>
              ))}
              <article className="tender-detail-field-card">
                <span>Location</span>
                <strong>{tender.location}</strong>
              </article>
            </div>
          </div>
        </section>
        <section className="tender-document-section">
          <div className="tender-document-section-heading">
            <span>02</span>
            <div>
              <small>Lifecycle</small>
              <h3>Milestones</h3>
            </div>
          </div>
          <div className="supplier-timeline-list">
            {procurementTimeline.map((item) => (
              <div className="timeline-row" key={item.id}>
                <span>{item.date}</span>
                <strong>{item.label}</strong>
                <StatusBadge value={item.status} />
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
