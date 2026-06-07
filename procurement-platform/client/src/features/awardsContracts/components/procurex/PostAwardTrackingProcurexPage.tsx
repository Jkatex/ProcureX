import {
  AwardHero,
  AwardSidebar,
  ProcurexAwardFrame,
  StatusBadge
} from './AwardsContractsProcurexShared';

export function PostAwardTrackingProcurexPage() {
  return (
    <ProcurexAwardFrame pageKey="post-award-tracking">
      <div className="main-layout procurement-layout evaluation-app-layout post-award-page" data-award-contract-workspace>
        <AwardSidebar
          title="Post-Award Tracking"
          subtitle="No contract selected"
          activeQueue="active-contracts"
          extraItems={<li><a href="#" data-navigate="awarding-contracts" data-route-search="queue=active-contracts">Back to Active Contracts</a></li>}
        />

        <main className="main-content procurement-content post-award-workspace">
          <AwardHero
            kicker="Contract execution and monitoring"
            title="No active or closed contract selected"
            copy="Delivery milestones, invoices, issues, variations, closure, and supplier performance records will appear once contracts are created and activated."
            stats={[
              { value: 0, label: 'Delivery progress' },
              { value: 0, label: 'Payments' },
              { value: 0, label: 'Performance records' }
            ]}
          />

          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Execution workspace</span><h2>No post-award records are available yet.</h2></div>
              <StatusBadge value="No records" />
            </div>
            <div className="scope-empty">When a contract is signed and activated, post-award tracking records will appear here.</div>
            <div className="inline-actions">
              <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=active-contracts">Back to Active Contracts</button>
            </div>
          </section>
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
