import {
  AwardHero,
  AwardSidebar,
  ProcurexAwardFrame,
  StatusBadge
} from './AwardsContractsProcurexShared';

export function AwardRecommendationProcurexPage() {
  return (
    <ProcurexAwardFrame pageKey="award-recommendation">
      <div className="main-layout procurement-layout evaluation-app-layout award-page" data-award-contract-workspace>
        <AwardSidebar
          title="Awarding in Progress"
          subtitle="No award selected"
          activeQueue="awarding-in-progress"
          extraItems={<li><a href="#" data-navigate="awarding-contracts" data-route-search="queue=awarding-in-progress">Back to Award Queue</a></li>}
        />

        <main className="main-content procurement-content evaluation-workspace">
          <AwardHero
            kicker="Buyer / awarder path"
            title="No awarding record selected"
            copy="Award recommendation workspaces will appear here after evaluation results create an award-ready tender."
            stats={[
              { value: 0, label: 'Award amount' },
              { value: 0, label: 'Procurement records' },
              { value: 0, label: 'Pending notices' }
            ]}
          />

          <section className="procurement-panel evaluation-panel award-page-empty">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Award recommendation</span>
                <h2>No evaluation result is ready for awarding.</h2>
              </div>
              <StatusBadge value="No records" />
            </div>
            <div className="scope-empty">When a tender evaluation is completed and routed to award, the recommendation workflow will appear here.</div>
            <div className="inline-actions">
              <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=awarding-in-progress">Back to Award Queue</button>
            </div>
          </section>
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
