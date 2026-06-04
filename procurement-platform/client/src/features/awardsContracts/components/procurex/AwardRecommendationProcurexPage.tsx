import { useState } from 'react';
import { awardWorkflowSteps } from '../../fixtures';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge,
  TopSummary
} from './AwardsContractsProcurexShared';

const rankedBidders = [
  ['1', 'BuildRight Ltd', 'Passed', 'Eligible', '92%', 4670000000, 'Recommended', 'Responsive'],
  ['2', 'Prime Contractors', 'Passed', 'Eligible', '88%', 4750000000, 'Responsive', 'Responsive'],
  ['3', 'Civic Builders Co.', 'Passed', 'Eligible', '80%', 4910000000, 'Not selected', 'Responsive']
] as const;

const noticeRows = [
  ['Notice of Intention to Award', 'All bidders', 'Sent', '2026-07-14', 'View'],
  ['Unsuccessful Bidder Notice', '2 bidders', 'Ready', '2026-07-14', 'Send'],
  ['Award Notification', 'ABC Construction Ltd', 'Awaiting Response', '2026-07-05', 'View']
] as const;

const documentRows = ['Performance Security', 'Insurance Certificate', 'Work Program', 'Tax Clearance', 'Bank Details', 'Authorized Signatory Details'];

export function AwardRecommendationProcurexPage() {
  const [activeStep, setActiveStep] = useState(0);
  const step = awardWorkflowSteps[activeStep];

  function moveStep(direction: number) {
    setActiveStep((current) => Math.min(awardWorkflowSteps.length - 1, Math.max(0, current + direction)));
  }

  return (
    <ProcurexAwardFrame pageKey="award-recommendation">
      <div className="main-layout procurement-layout evaluation-app-layout award-page" data-award-contract-workspace data-award-current-step={step.id} data-award-tender-id="PX-WRK-2026-001">
        <AwardSidebar
          title="Awarding in Progress"
          subtitle="PX-WRK-2026-001"
          activeQueue="awarding-in-progress"
          extraItems={<li><a href="#" data-navigate="bid-evaluation">View Evaluation Report</a></li>}
        />

        <main className="main-content procurement-content evaluation-workspace">
          <AwardHero
            kicker="Buyer / awarder path"
            title="Construction of District Maternal Health Wing"
            copy="Best evaluated responsive bid with strong methodology, corrected price, and confirmed mobilization plan."
            stats={[
              { value: formatMoney(6850000000), label: 'Award amount' },
              { value: 'Works', label: 'Procurement type' },
              { value: '14 days', label: 'Standstill duration' }
            ]}
          >
            <div className="award-recommended-callout">
              <StatusBadge value="Selected supplier: ABC Construction Ltd" />
              <span>Supplier response deadline: 2026-07-05</span>
            </div>
          </AwardHero>

          <TopSummary
            items={[
              { label: 'Tender', value: 'Construction of District Maternal Health Wing' },
              { label: 'Reference', value: 'PX-WRK-2026-001' },
              { label: 'Buyer', value: 'Kilimanjaro Supplies Limited' },
              { label: 'Evaluation', value: <StatusBadge value="Completed" /> },
              { label: 'Supplier', value: 'ABC Construction Ltd' }
            ]}
          />

          <section className="award-wizard-page tender-wizard-page">
            <div className="award-draft-strip">
              <div>
                <span className="section-kicker">Resumable workspace</span>
                <h2>Evaluation Results to Draft Contract</h2>
              </div>
              <div className="inline-actions">
                <StatusBadge value="Unsaved draft" />
                <button className="btn btn-secondary" type="button" data-award-save-draft data-award-step={step.id}>Save Draft</button>
                <button className="btn btn-secondary" type="button" data-award-save-exit data-award-step={step.id}>Save Draft & Exit</button>
              </div>
            </div>

            <div className="wizard-shell award-wizard-shell" data-award-wizard data-award-active-step={activeStep}>
              <nav className="wizard-step-progress award-step-progress" aria-label="Award workflow progress">
                {awardWorkflowSteps.map((item, index) => (
                  <button
                    className={`wizard-progress-step${index === activeStep ? ' active' : ''}`}
                    type="button"
                    data-award-step-index={index}
                    aria-current={index === activeStep ? 'step' : 'false'}
                    onClick={() => setActiveStep(index)}
                    key={item.id}
                  >
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                    <span>{item.shortTitle}</span>
                  </button>
                ))}
              </nav>

              <aside className="wizard-rail award-wizard-rail">
                {awardWorkflowSteps.map((item, index) => (
                  <button
                    className={`wizard-rail-step${index === activeStep ? ' active' : ''}${index < activeStep ? ' complete' : ''}`}
                    type="button"
                    data-award-step-index={index}
                    onClick={() => setActiveStep(index)}
                    key={item.id}
                  >
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                    <span>{item.title}</span>
                  </button>
                ))}
              </aside>

              <div className="award-wizard-main">
                <div className="wizard-workspace">
                  <section className={`journey-panel${activeStep === 0 ? ' active' : ''}`} data-award-step-panel data-award-step-id="evaluation-result">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 1</span><h2>Evaluation Results</h2></div>
                      <StatusBadge value="Evaluation completed" />
                    </div>
                    <div className="award-evaluation-summary-grid">
                      <article><span>Evaluation status</span><strong>Completed</strong></article>
                      <article><span>Evaluation method</span><strong>Lowest evaluated substantially responsive bid</strong></article>
                      <article><span>Procurement type</span><strong>Works</strong></article>
                      <article><span>Completion date</span><strong>June 28, 2026</strong></article>
                    </div>
                    <SimpleTable headers={['Rank', 'Supplier', 'Preliminary', 'Eligibility', 'Technical', 'Corrected Price', 'Final Result', 'Decision']}>
                      {rankedBidders.map((row) => (
                        <tr key={row[1]}>
                          <td><StatusBadge value={row[0]} /></td>
                          <td><strong>{row[1]}</strong></td>
                          <td>{row[2]}</td>
                          <td>{row[3]}</td>
                          <td>{row[4]}</td>
                          <td>{formatMoney(row[5])}</td>
                          <td><StatusBadge value={row[6]} /></td>
                          <td>{row[7]}</td>
                        </tr>
                      ))}
                    </SimpleTable>
                  </section>

                  <section className={`journey-panel${activeStep === 1 ? ' active' : ''}`} data-award-step-panel data-award-step-id="award-decision">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 2</span><h2>Award Decision</h2></div>
                      <StatusBadge value="Award Decision Pending" />
                    </div>
                    <div className="evaluation-form-grid recommendation-form">
                      <label>Selected supplier <input className="form-input" defaultValue="ABC Construction Ltd" /></label>
                      <label>Award amount <input className="form-input" defaultValue="6850000000" /></label>
                      <label>Decision reason <textarea className="form-input" rows={4} defaultValue="Highest evaluated responsive bid and complete compliance evidence." /></label>
                      <label>Conflict of Interest declaration <select className="form-input" defaultValue="No conflict declared"><option>No conflict declared</option><option>Conflict declared</option></select></label>
                    </div>
                    <div className="inline-actions">
                      <button className="btn btn-secondary" type="button">Save Decision</button>
                      <button className="btn btn-primary" type="button">Submit for Approval</button>
                    </div>
                  </section>

                  <section className={`journey-panel${activeStep === 2 ? ' active' : ''}`} data-award-step-panel data-award-step-id="approval">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 3</span><h2>Approval</h2></div>
                      <StatusBadge value="Approval pending" />
                    </div>
                    <div className="award-control-grid">
                      {['Evaluation report attached', 'Selected supplier validated', 'Budget confirmed', 'Conflict declaration completed'].map((item) => (
                        <article key={item}><strong>{item}</strong><span>Required before award approval.</span><StatusBadge value="Pending" /></article>
                      ))}
                    </div>
                  </section>

                  <section className={`journey-panel${activeStep === 3 ? ' active' : ''}`} data-award-step-panel data-award-step-id="award-notification">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 4</span><h2>Notification before contracting</h2></div>
                      <StatusBadge value="Required notices pending" />
                    </div>
                    <SimpleTable headers={['Notice', 'Recipient', 'Status', 'Deadline', 'Action']}>
                      {noticeRows.map((row) => (
                        <tr key={row[0]}>
                          <td>{row[0]}</td>
                          <td>{row[1]}</td>
                          <td><StatusBadge value={row[2]} /></td>
                          <td>{row[3]}</td>
                          <td><button className="btn btn-secondary btn-sm" type="button">{row[4]}</button></td>
                        </tr>
                      ))}
                    </SimpleTable>
                    <div className="evaluation-notice warning">Contract blocked: one or more required notices have not been sent.</div>
                  </section>

                  <section className={`journey-panel${activeStep === 4 ? ' active' : ''}`} data-award-step-panel data-award-step-id="standstill-period">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 5</span><h2>Standstill & Complaints</h2></div>
                      <StatusBadge value="Contract blocked" />
                    </div>
                    <div className="award-control-grid">
                      <article><strong>Notice date</strong><span>Jul 1, 2026</span></article>
                      <article><strong>Standstill duration</strong><span>14 days</span></article>
                      <article><strong>Standstill end</strong><span>Jul 15, 2026</span></article>
                      <article><strong>Contract status</strong><StatusBadge value="Blocked" /></article>
                    </div>
                    <div className="evaluation-notice warning">Draft contract generation is blocked until the standstill window closes and any complaints are resolved.</div>
                  </section>

                  <section className={`journey-panel${activeStep === 5 ? ' active' : ''}`} data-award-step-panel data-award-step-id="supplier-acceptance">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 6</span><h2>Supplier Acceptance</h2></div>
                      <StatusBadge value="Awaiting supplier response" />
                    </div>
                    <div className="award-control-grid">
                      {['Accept Award', 'Request Clarification', 'Decline Award'].map((item) => (
                        <article key={item}><strong>{item}</strong><span>Supplier response option recorded before contract drafting.</span><StatusBadge value="Allowed" /></article>
                      ))}
                    </div>
                  </section>

                  <section className={`journey-panel${activeStep === 6 ? ' active' : ''}`} data-award-step-panel data-award-step-id="pre-contract-documents">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 7</span><h2>Pre-Contract Documents</h2></div>
                      <StatusBadge value="Documents pending" />
                    </div>
                    <SimpleTable headers={['Document', 'Required', 'Status', 'Expiry Date', 'Reviewed By', 'Action']}>
                      {documentRows.map((document) => (
                        <tr key={document}>
                          <td><strong>{document}</strong></td>
                          <td>Yes</td>
                          <td><StatusBadge value="Pending Upload" /></td>
                          <td>-</td>
                          <td>-</td>
                          <td><button className="btn btn-secondary btn-sm" type="button">Upload</button></td>
                        </tr>
                      ))}
                    </SimpleTable>
                  </section>

                  <section className={`journey-panel${activeStep === 7 ? ' active' : ''}`} data-award-step-panel data-award-step-id="draft-contract">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Step 8</span><h2>Draft Contract</h2></div>
                      <StatusBadge value="Blocked" />
                    </div>
                    <div className="evaluation-notice warning">Contract negotiation opens only after award approval, notice controls, standstill/complaint handling, supplier acceptance, and document approval are satisfied.</div>
                    <div className="inline-actions">
                      <button className="btn btn-secondary" type="button" data-navigate="bid-evaluation">View Evaluation Report</button>
                      <button className="btn btn-primary" type="button" disabled aria-disabled="true" data-navigate="contract-negotiation" data-route-search="tab=overview">Generate Draft Contract</button>
                    </div>
                  </section>

                  <div className="wizard-flow-controls" data-award-flow-controls>
                    <button className="btn btn-secondary" type="button" data-award-prev onClick={() => moveStep(-1)}>Back</button>
                    <div className="wizard-flow-progress">
                      <strong data-award-progress>Step {activeStep + 1} of {awardWorkflowSteps.length}</strong>
                      <span data-award-step-title>{step.title}</span>
                    </div>
                    <button className="btn btn-primary" type="button" data-award-next onClick={() => moveStep(1)}>Continue</button>
                  </div>
                </div>

              </div>
            </div>
          </section>
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
