import {
  AwardHero,
  AwardSidebar,
  ProcurexAwardFrame,
  StatusBadge
} from './AwardsContractsProcurexShared';

export function ContractNegotiationProcurexPage() {
  return (
    <ProcurexAwardFrame pageKey="contract-negotiation">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page" data-award-contract-workspace>
        <AwardSidebar
          title="Contracts in Progress"
          subtitle="No contract selected"
          activeQueue="contracts-in-progress"
          extraItems={<li><a href="#" data-navigate="awarding-contracts" data-route-search="queue=contracts-in-progress">Back to Contract Queue</a></li>}
        />

        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract preparation"
            title="No contract record selected"
            copy="Contract drafting, negotiation, approval, and signature workspaces will appear after an award creates a contract record."
            stats={[
              { value: 0, label: 'Contract value' },
              { value: 'None', label: 'Current status' },
              { value: 0, label: 'Review actions' }
            ]}
          />

          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Contract workflow</span><h2>No contract is in progress.</h2></div>
              <StatusBadge value="No records" />
            </div>
            <div className="scope-empty">When an award is accepted and a draft contract is generated, contract review and negotiation details will appear here.</div>
            <div className="inline-actions">
              <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=contracts-in-progress">Back to Contract Queue</button>
            </div>
          </section>
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
