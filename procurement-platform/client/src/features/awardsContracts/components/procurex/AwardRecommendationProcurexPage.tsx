import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardRecommendationDetailDto, FlowStep, LifecycleAction } from '../../types';
import { ActionFormPanel, itemOptions, lifecycleStatusOptions, option, riskLevelOptions } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { AwardContractFlowBar, LockedFlowStepPanel, flowStepFromSearch, searchWithFlowStep } from './AwardContractFlow';
import {
  AwardHero,
  AwardSidebar,
  RegisterCard,
  RecordRegister,
  formatMoney,
  humanizeWorkflowStatus,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge,
  TopSummary
} from './AwardsContractsProcurexShared';

function getRecommendationId(search: string) {
  return new URLSearchParams(search).get('recommendation') || '';
}

const awardReadinessChecks = [
  'Evaluation scoring completed',
  'Financial evaluation completed',
  'Due diligence completed',
  'Recommended supplier is eligible',
  'Budget availability confirmed',
  'Conflict-of-interest declarations completed'
];

const readinessOwnerByCheck: Record<string, string> = {
  'Evaluation scoring completed': 'Evaluation committee',
  'Financial evaluation completed': 'Evaluation committee',
  'Due diligence completed': 'Compliance reviewer',
  'Recommended supplier is eligible': 'Buyer procurement officer',
  'Budget availability confirmed': 'Budget owner',
  'Conflict-of-interest declarations completed': 'Compliance reviewer'
};

const statusOptions = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'RETURNED', 'WAIVED', 'EXPIRED', 'SENT', 'FAILED'].map((value) => option(value));
type AwardWorkflowGroupId = 'readiness' | 'validation' | 'winners' | 'clauses' | 'negotiation' | 'settlement' | 'budget' | 'registers';
const awardFlowStepIds = ['evaluation-result', 'award-decision', 'approval', 'winners-bid-pack', 'clauses', 'negotiation', 'settlement-notice', 'supplier-response', 'contract-handoff'] as const;
type AwardFlowStepId = (typeof awardFlowStepIds)[number];
const awardStepToGroup: Record<AwardFlowStepId, AwardWorkflowGroupId> = {
  'evaluation-result': 'readiness',
  'award-decision': 'readiness',
  approval: 'validation',
  'winners-bid-pack': 'winners',
  clauses: 'clauses',
  negotiation: 'negotiation',
  'settlement-notice': 'settlement',
  'supplier-response': 'registers',
  'contract-handoff': 'budget'
};

function AwardContextCard({
  kicker,
  title,
  badge,
  children
}: {
  kicker: string;
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <section className="award-workspace-card">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge value={badge} />
      </div>
      {children}
    </section>
  );
}

function AwardActionWorkspace({
  kicker,
  title,
  badge,
  context,
  children
}: {
  kicker: string;
  title: string;
  badge: string;
  context: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="award-action-workspace">
      <AwardContextCard kicker={kicker} title={title} badge={badge}>
        {context}
      </AwardContextCard>
      <div className="award-action-stack">{children}</div>
    </div>
  );
}

function singleLinkedOption(value: string | null | undefined, label: string, description: string, emptyLabel: string) {
  return [
    option('', emptyLabel),
    ...(value ? [{ value, label, description }] : [])
  ];
}

function AwardClauseGrid({ clauses }: { clauses: NonNullable<AwardRecommendationDetailDto['awardGroup']>['clauses'] | undefined }) {
  if (!clauses?.length) return <div className="scope-empty">Award clauses will appear here before notices are issued and contracts are formed.</div>;
  return (
    <div className="contract-clause-review-grid">
      {clauses.map((clause) => {
        const payload = clause.payload ?? {};
        return (
          <article key={clause.id}>
            <div className="contract-clause-card-head">
              <h3>{clause.title}</h3>
              <StatusBadge value={clause.status} />
            </div>
            <p>{clause.note || 'No clause body captured yet.'}</p>
            <dl className="award-detail-list">
              <div><dt>Buyer</dt><dd>{String(payload.buyerComment || 'No buyer comment')}</dd></div>
              <div><dt>Supplier</dt><dd>{String(payload.supplierComment || 'No supplier comment')}</dd></div>
              <div><dt>Legal</dt><dd>{String(payload.legalComment || 'No legal comment')}</dd></div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function AwardLifecycleTimeline({
  recommendation,
  detail
}: {
  recommendation: LifecycleAction;
  detail: AwardRecommendationDetailDto | null;
}) {
  const hasApproval = /approved|notice|response|contract|accepted/i.test(recommendation.status) || Boolean(detail?.notice);
  const hasNotice = Boolean(detail?.notice);
  const hasResponse = /accepted|declined|clarification/i.test(detail?.notice?.status ?? recommendation.status);
  const hasContract = Boolean(detail?.notice?.contractId ?? recommendation.contractId ?? detail?.contract?.id);
  const steps = [
    { label: 'Evaluation result', status: 'Complete', done: true },
    { label: 'Award decision', status: hasApproval ? 'Approved' : humanizeWorkflowStatus(recommendation.status), done: hasApproval },
    { label: 'Notice', status: humanizeWorkflowStatus(detail?.notice?.status ?? 'Pending'), done: hasNotice },
    { label: 'Supplier response', status: hasResponse ? humanizeWorkflowStatus(detail?.notice?.status ?? recommendation.status) : 'Awaiting response', done: hasResponse },
    { label: 'Contract handoff', status: hasContract ? 'Linked' : 'Pending', done: hasContract }
  ];

  return (
    <section className="award-lifecycle-timeline" aria-label="Award lifecycle timeline">
      {steps.map((step, index) => (
        <article className={step.done ? 'complete' : ''} key={step.label}>
          <strong>{index + 1}</strong>
          <div>
            <span>{step.label}</span>
            <StatusBadge value={step.status} />
          </div>
        </article>
      ))}
    </section>
  );
}

export function AwardRecommendationProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedRecommendationId = useMemo(() => getRecommendationId(location.search), [location.search]);
  const [recommendations, setRecommendations] = useState<LifecycleAction[]>([]);
  const [recommendationDetail, setRecommendationDetail] = useState<AwardRecommendationDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [detailError, setDetailError] = useState('');
  const activeStep = useMemo(() => flowStepFromSearch(location.search, awardFlowStepIds, 'evaluation-result'), [location.search]);
  const activeGroup = awardStepToGroup[activeStep];

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await awardsContractsApi.dashboard();
      setRecommendations(data.queues['awarding-in-progress']);
    } catch (error) {
      setRecommendations([]);
      setLoadError(apiErrorMessage(error, 'Award recommendations could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const activeRecommendation =
    recommendations.find((item) => item.awardId === selectedRecommendationId || item.id === selectedRecommendationId) ?? recommendations[0] ?? null;
  const activeRecommendationId = activeRecommendation?.awardId ?? activeRecommendation?.id.replace(/^award-/, '') ?? '';
  const access = recommendationDetail?.access ?? {
    viewerRole: activeRecommendation?.roleContext ?? 'NONE',
    canManageBuyerActions: activeRecommendation?.roleContext === 'BUYER',
    canSubmitSupplierActions: activeRecommendation?.roleContext === 'SUPPLIER',
    canSignBuyer: activeRecommendation?.roleContext === 'BUYER',
    canSignSupplier: activeRecommendation?.roleContext === 'SUPPLIER',
    readOnlyReason: activeRecommendation?.roleContext === 'SUPPLIER' ? 'Buyer actions are read-only for the supplier.' : null
  } as const;
  const registerCounts = {
    readiness: awardReadinessChecks.length,
    validation: (recommendationDetail?.tieBreakers?.length ?? 0) + (recommendationDetail?.feasibilityChecks?.length ?? 0),
    winners: recommendationDetail?.awardGroup?.winners.length ?? 0,
    clauses: recommendationDetail?.awardGroup?.clauses.length ?? 0,
    negotiation: recommendationDetail?.awardGroup?.negotiations.length ?? 0,
    settlement: (recommendationDetail?.standstillPeriods?.length ?? 0) + (recommendationDetail?.awardNotifications?.length ?? 0) + (recommendationDetail?.awardGroup?.bidPacks.length ?? 0),
    budget: recommendationDetail?.budgetCommitments?.length ?? 0,
    registers:
      (recommendationDetail?.approvalRoutes?.length ?? 0) +
      (recommendationDetail?.tieBreakers?.length ?? 0) +
      (recommendationDetail?.feasibilityChecks?.length ?? 0) +
      (recommendationDetail?.awardGroup?.winners.length ?? 0) +
      (recommendationDetail?.awardGroup?.clauses.length ?? 0) +
      (recommendationDetail?.awardGroup?.negotiations.length ?? 0) +
      (recommendationDetail?.awardGroup?.bidPacks.length ?? 0) +
      (recommendationDetail?.standstillPeriods?.length ?? 0) +
      (recommendationDetail?.awardNotifications?.length ?? 0) +
      (recommendationDetail?.budgetCommitments?.length ?? 0)
  } satisfies Record<AwardWorkflowGroupId, number>;
  const selectedContractId = recommendationDetail?.notice?.contractId ?? recommendationDetail?.contract?.id ?? activeRecommendation?.contractId ?? '';
  const hasNotice = Boolean(recommendationDetail?.notice ?? activeRecommendation?.noticeId);
  const hasSupplierResponse = /accepted|declined|clarification/i.test(recommendationDetail?.notice?.status ?? activeRecommendation?.status ?? '') || Boolean(recommendationDetail?.notice?.responses?.length);
  const hasContractHandoff = Boolean(selectedContractId);
  const hasApproval = /approved|notice|response|contract|accepted/i.test(activeRecommendation?.status ?? '') || Boolean(recommendationDetail?.notice);
  const awardGroup = recommendationDetail?.awardGroup;
  const hasBidPack = Boolean(awardGroup?.bidPacks.length);
  const hasUnresolvedAwardNegotiation = Boolean(awardGroup?.negotiations.some((item) => /OPEN|IN_PROGRESS|REJECTED/i.test(item.status)));
  const hasUnresolvedAwardClause = Boolean(awardGroup?.clauses.some((item) => /OPEN|IN_PROGRESS|REJECTED/i.test(item.status)));
  const hasSettlement = Boolean(awardGroup?.settledAt || /SETTLED|NOTICED|CONTRACT_FORMED/i.test(awardGroup?.status ?? ''));
  const readinessRows = useMemo(() => {
    const hasBudgetCommitment = Boolean(recommendationDetail?.budgetCommitments?.length);
    const hasFeasibility = Boolean(recommendationDetail?.feasibilityChecks?.length);
    const hasApprovalRoute = Boolean(recommendationDetail?.approvalRoutes?.length);
    return awardReadinessChecks.map((check) => {
      let status = 'Needs review';
      if (/Evaluation scoring/i.test(check)) status = activeRecommendation ? 'Complete' : 'Missing';
      if (/Financial evaluation/i.test(check)) status = activeRecommendation?.amount !== null && activeRecommendation?.amount !== undefined ? 'Complete' : 'Needs review';
      if (/Due diligence/i.test(check)) status = hasFeasibility ? 'Complete' : 'Needs review';
      if (/Recommended supplier/i.test(check)) status = recommendationDetail?.supplierName || activeRecommendation?.otherParty ? 'Complete' : 'Missing';
      if (/Budget availability/i.test(check)) status = hasBudgetCommitment ? 'Complete' : 'Missing';
      if (/Conflict-of-interest/i.test(check)) status = hasApprovalRoute ? 'Complete' : 'Needs review';
      return { check, status, owner: readinessOwnerByCheck[check] ?? 'Buyer procurement officer' };
    });
  }, [activeRecommendation, recommendationDetail]);
  const activeFlowLock = useMemo(() => {
    const noRecord = { message: 'Select an award recommendation before continuing this workflow.', actionLabel: 'Open Awarding Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=awarding-in-progress' };
    const missingSettlement = { message: 'Settle the award and issue winner notices before supplier response and contract handoff can continue.', actionLabel: 'Go to Settlement', navigatePage: 'award-recommendation', routeSearch: `recommendation=${activeRecommendationId}&step=settlement-notice` };
    const pendingResponse = { message: 'Supplier response must be accepted, clarified, or declined before the contract handoff step can continue.', actionLabel: 'Go to Supplier Response Step', navigatePage: 'award-recommendation', routeSearch: `recommendation=${activeRecommendationId}&step=supplier-response` };
    if (!activeRecommendation) return noRecord;
    if (activeStep === 'supplier-response' && !hasNotice) return missingSettlement;
    if (activeStep === 'contract-handoff') {
      if (!hasNotice) return missingSettlement;
      if (!hasSupplierResponse) return pendingResponse;
    }
    return null;
  }, [activeRecommendation, activeRecommendationId, activeStep, hasNotice, hasSupplierResponse]);
  const flowSteps = useMemo<Array<FlowStep<AwardFlowStepId>>>(() => {
    const noRecord = { message: 'Select an award recommendation before continuing this workflow.', actionLabel: 'Open Awarding Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=awarding-in-progress' };
    const missingSettlement = { message: 'Settle the award and issue winner notices before supplier response and handoff steps can continue.', actionLabel: 'Go to Settlement', navigatePage: 'award-recommendation', routeSearch: `recommendation=${activeRecommendationId}&step=settlement-notice` };
    const pendingResponse = { message: 'Supplier response must be recorded before contract handoff can continue.', actionLabel: 'Go to Supplier Response Step', navigatePage: 'award-recommendation', routeSearch: `recommendation=${activeRecommendationId}&step=supplier-response` };
    return [
      { id: 'evaluation-result', label: 'Evaluation Results', description: 'Review readiness before notice', summary: 'Review readiness checks before issuing the award notice or starting contract formation.', status: activeRecommendation ? 'complete' : 'locked', statusLabel: activeRecommendation ? 'Complete' : 'Locked', count: awardReadinessChecks.length, countLabel: 'readiness checks', lockReason: noRecord },
      { id: 'award-decision', label: 'Award Decision', description: 'Approve or return award', summary: 'Approve the recommendation or return it for evaluation clarification.', status: activeRecommendation ? 'available' : 'locked', statusLabel: hasApproval ? 'Approved' : 'Needs action', lockReason: noRecord },
      { id: 'approval', label: 'Approval', description: 'Validation and feasibility', summary: 'Record tie-break, feasibility, and approval evidence before notice controls.', status: recommendationDetail?.approvalRoutes?.length ? 'complete' : activeRecommendation ? 'available' : 'locked', statusLabel: recommendationDetail?.approvalRoutes?.length ? 'Complete' : 'Needs review', count: registerCounts.validation, countLabel: 'validation records', lockReason: noRecord },
      { id: 'winners-bid-pack', label: 'Notices', description: 'Winners and bid pack', summary: 'Review all winning bidders, submitted bid documents, and the generated award bid pack.', status: activeRecommendation ? (hasBidPack ? 'complete' : 'available') : 'locked', statusLabel: hasBidPack ? 'Bid pack generated' : 'Needs pack', count: registerCounts.winners, countLabel: 'winners', lockReason: noRecord },
      { id: 'clauses', label: 'Standstill', description: 'Terms before contract formation', summary: 'Settle all clauses at award stage so contract formation receives agreed terms.', status: activeRecommendation ? (hasUnresolvedAwardClause ? 'available' : 'complete') : 'locked', statusLabel: hasUnresolvedAwardClause ? 'Needs action' : 'Settled', count: registerCounts.clauses, countLabel: 'clauses', lockReason: noRecord },
      { id: 'negotiation', label: 'Acceptance', description: 'Bidder negotiation points', summary: 'Record buyer, supplier, and legal negotiation positions before award settlement.', status: activeRecommendation ? (hasUnresolvedAwardNegotiation ? 'available' : 'complete') : 'locked', statusLabel: hasUnresolvedAwardNegotiation ? 'Needs action' : 'Settled', count: registerCounts.negotiation, countLabel: 'points', lockReason: noRecord },
      { id: 'settlement-notice', label: 'Documents', description: 'Settle and notify winners', summary: 'Generate the final award bid pack, settle award terms, and issue notices to winning bidders.', status: activeRecommendation ? (hasSettlement ? 'complete' : 'available') : 'locked', statusLabel: hasSettlement ? 'Settled' : 'Needs action', count: registerCounts.settlement, countLabel: 'settlement records', lockReason: noRecord },
      { id: 'supplier-response', label: 'Supplier Response', description: 'Response and activity history', summary: 'Track whether the supplier accepted, declined, or requested clarification.', status: !activeRecommendation ? 'locked' : !hasNotice ? 'locked' : hasSupplierResponse ? 'complete' : 'available', statusLabel: hasSupplierResponse ? 'Response received' : hasNotice ? 'Awaiting response' : 'Locked', count: recommendationDetail?.notice?.responses?.length ?? 0, countLabel: 'responses', lockReason: !activeRecommendation ? noRecord : missingSettlement },
      { id: 'contract-handoff', label: 'Draft Contract', description: 'Budget and linked contract', summary: 'Continue to contract formation after the supplier response is ready.', status: !activeRecommendation ? 'locked' : !hasNotice || !hasSupplierResponse ? 'locked' : hasContractHandoff ? 'complete' : 'available', statusLabel: hasContractHandoff ? 'Linked' : !hasSupplierResponse ? 'Pending response' : 'Ready', count: selectedContractId ? 1 : 0, countLabel: 'linked contracts', lockReason: !activeRecommendation ? noRecord : !hasNotice ? missingSettlement : pendingResponse }
    ];
  }, [activeRecommendation, activeRecommendationId, hasApproval, hasBidPack, hasContractHandoff, hasNotice, hasSettlement, hasSupplierResponse, hasUnresolvedAwardClause, hasUnresolvedAwardNegotiation, recommendationDetail?.approvalRoutes?.length, recommendationDetail?.notice?.responses?.length, registerCounts.clauses, registerCounts.negotiation, registerCounts.settlement, registerCounts.validation, registerCounts.winners, selectedContractId]);
  const bidOptions = singleLinkedOption(
    recommendationDetail?.bidId,
    `${recommendationDetail?.supplierName ?? activeRecommendation?.otherParty ?? 'Recommended supplier'} bid`,
    `${recommendationDetail?.tenderReference ?? activeRecommendation?.reference ?? 'Evaluation outcome'} for ${activeRecommendation?.title ?? 'selected tender'}`,
    'Use the awarded bid from this recommendation'
  );
  const recipientOptions = singleLinkedOption(
    recommendationDetail?.supplierOrgId,
    recommendationDetail?.supplierName ?? activeRecommendation?.otherParty ?? 'Recommended supplier',
    'Supplier organization linked to this recommendation',
    'Use the recommended supplier from this award'
  );
  const contractOptions = singleLinkedOption(
    selectedContractId,
    recommendationDetail?.contract?.reference ?? activeRecommendation?.noticeReference ?? 'Linked contract',
    recommendationDetail?.contract?.title ?? activeRecommendation?.title ?? 'Contract generated from this award',
    'No linked contract yet'
  );

  const loadRecommendationDetail = useCallback(async () => {
    if (!activeRecommendationId) {
      setRecommendationDetail(null);
      setDetailError('');
      return;
    }
    setDetailError('');
    try {
      setRecommendationDetail(await awardsContractsApi.recommendation(activeRecommendationId));
    } catch (error) {
      setRecommendationDetail(null);
      setDetailError(apiErrorMessage(error, 'Award recommendation detail could not be loaded.'));
    }
  }, [activeRecommendationId]);

  useEffect(() => {
    void loadRecommendationDetail();
  }, [loadRecommendationDetail]);

  function selectRecommendation(row: LifecycleAction) {
    navigate(`/awards-contracts/recommendation?recommendation=${row.awardId ?? row.id}&step=evaluation-result`);
  }

  function selectFlowStep(step: AwardFlowStepId) {
    navigate({ pathname: '/awards-contracts/recommendation', search: searchWithFlowStep(location.search, step) });
  }

  function refreshRecommendationsAndAdvance(step: AwardFlowStepId) {
    return () => {
      void refreshRecommendations();
      selectFlowStep(step);
    };
  }

  function refreshDetailAndAdvance(step: AwardFlowStepId) {
    return (result: unknown) => {
      refreshRecommendationDetail(result);
      selectFlowStep(step);
    };
  }

  async function refreshRecommendations() {
    await loadRecommendations();
    await loadRecommendationDetail();
  }

  function refreshRecommendationDetail(result: unknown) {
    setRecommendationDetail(result as AwardRecommendationDetailDto);
    void refreshRecommendations();
  }


  return (
    <ProcurexAwardFrame pageKey="award-recommendation">
      <div className="main-layout procurement-layout evaluation-app-layout award-page" data-award-contract-workspace>
        <AwardSidebar
          title="Awarding in Progress"
          subtitle={activeRecommendation?.title ?? 'Buyer award workspace'}
          activeQueue="awarding-in-progress"
          extraItems={<li><a href="#" data-navigate="awarding-contracts" data-route-search="queue=awarding-in-progress">Back to Award Queue</a></li>}
        />

        <main className="main-content procurement-content evaluation-workspace">
          <AwardHero
            kicker="Buyer / awarder path"
            title={activeRecommendation?.title ?? 'No awarding record selected'}
            copy="Confirm evaluation readiness, settle winners, carry award-stage clauses and negotiations, issue notices, and form contracts from agreed terms."
            stats={[
              { value: activeRecommendation?.amount ?? 0, label: 'Award amount' },
              { value: recommendations.length, label: 'Procurement records' },
              { value: recommendations.filter((item) => /negotiate|clause|notice|response/i.test(item.requiredAction)).length, label: 'Award actions' }
            ]}
          />

          {activeRecommendation ? (
            <>
              <TopSummary
                items={[
                  { label: 'Award No', value: recommendationDetail?.reference ?? activeRecommendation.reference ?? 'Pending reference' },
                  { label: 'Notice No', value: recommendationDetail?.notice?.reference ?? activeRecommendation.noticeReference ?? 'Not issued' },
                  { label: 'Tender', value: recommendationDetail?.tenderReference ?? activeRecommendation.title },
                  { label: 'Recommended Supplier', value: recommendationDetail?.supplierName ?? activeRecommendation.otherParty },
                  { label: 'Award Value', value: activeRecommendation.amount === null ? 'Not priced' : formatMoney(activeRecommendation.amount, activeRecommendation.currency) },
                  { label: 'Current Stage', value: activeRecommendation.currentStage },
                  { label: 'Status', value: <StatusBadge value={activeRecommendation.status} /> }
                ]}
              />
              <AwardLifecycleTimeline recommendation={activeRecommendation} detail={recommendationDetail} />
            </>
          ) : null}

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading award recommendations"
              message="ProcureX is fetching completed evaluations that are ready for award action."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Award recommendations could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadRecommendations()}
            />
          ) : null}

          {activeRecommendation && detailError ? (
            <RemoteStatePanel
              kicker="Award detail"
              title="Selected award detail could not be loaded"
              message={detailError}
              status="Error"
              actionLabel="Retry detail"
              onAction={() => void loadRecommendationDetail()}
            />
          ) : null}

          {activeRecommendation && !detailError ? (
            <AwardContractAccessProvider access={access}>
            <section className="procurement-panel evaluation-panel award-wizard-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Award workspace</span><h2>Award readiness review</h2></div>
                <StatusBadge value={flowSteps.find((step) => step.id === activeStep)?.statusLabel ?? 'Workflow'} />
              </div>
              <AwardContractFlowBar steps={flowSteps} active={activeStep} onSelect={selectFlowStep} label="Award recommendation flow" />

              {activeFlowLock ? (
                <LockedFlowStepPanel title={`${flowSteps.find((step) => step.id === activeStep)?.label ?? 'Workflow'} is locked`} reason={activeFlowLock} />
              ) : (
              <>
              {activeGroup === 'readiness' ? (
                <AwardActionWorkspace
                  kicker="Readiness"
                  title="Evaluation handoff checks"
                  badge="Checklist"
                  context={
                    <>
                      <TopSummary
                        items={[
                          { label: 'Stage', value: activeRecommendation.currentStage },
                          { label: 'Action', value: activeRecommendation.requiredAction },
                          { label: 'Risk', value: <StatusBadge value={activeRecommendation.riskLevel} /> },
                          { label: 'Award status', value: <StatusBadge value={activeRecommendation.status} /> }
                        ]}
                      />
                      <SimpleTable headers={['Check', 'Status', 'Owner']} className="award-readiness-table">
                        {readinessRows.map((row) => (
                          <tr key={row.check}>
                            <td><strong>{row.check}</strong></td>
                            <td><StatusBadge value={row.status} /></td>
                            <td>{row.owner}</td>
                          </tr>
                        ))}
                      </SimpleTable>
                    </>
                  }
                >
                  <ActionFormPanel
                    title="Approve award"
                    badge="Buyer"
                    submitLabel="Approve Award"
                    fields={[{ name: 'note', label: 'Approval note', kind: 'textarea' }]}
                    initialValues={{ note: 'Approved from ProcureX award recommendation workspace' }}
                    onSubmit={(payload) => awardsContractsApi.approveRecommendation(activeRecommendation.awardId ?? activeRecommendation.id.replace(/^award-/, ''), String(payload.note ?? ''))}
                    onComplete={refreshRecommendationsAndAdvance('approval')}
                  />
                  <ActionFormPanel
                    title="Return award"
                    badge="Buyer"
                    submitLabel="Return Award"
                    fields={[{ name: 'note', label: 'Return note', kind: 'textarea', required: true }]}
                    initialValues={{ note: 'Returned for evaluation clarification from ProcureX award recommendation workspace' }}
                    onSubmit={(payload) => awardsContractsApi.returnRecommendation(activeRecommendation.awardId ?? activeRecommendation.id.replace(/^award-/, ''), String(payload.note ?? ''))}
                    onComplete={refreshRecommendationsAndAdvance('approval')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'validation' ? (
                <AwardActionWorkspace
                  kicker="Validation"
                  title="Tie-breaker and feasibility"
                  badge={`${registerCounts.validation} records`}
                  context={
                    <div className="award-register-stack">
                      <RecordRegister title="Tie-breakers" records={recommendationDetail?.tieBreakers ?? []} />
                      <RecordRegister title="Feasibility checks" records={recommendationDetail?.feasibilityChecks ?? []} />
                    </div>
                  }
                >
                  <ActionFormPanel
                    title="Tie-breaker"
                    badge="Tie-break"
                    submitLabel="Record Tie-breaker"
                    fields={[
                      { name: 'triggerReason', label: 'Trigger reason', kind: 'textarea', required: true },
                      { name: 'method', label: 'Method', kind: 'text', required: true },
                      { name: 'criteria', label: 'Tie-break criteria', kind: 'textarea', rows: 4, transform: 'lineArray', helpText: 'Enter one criterion per line.' },
                      { name: 'outcomeBidId', label: 'Tie-break outcome bid', kind: 'select', options: bidOptions, helpText: 'Choose from the selected recommendation context when a bid is available.' },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'note', label: 'Decision note', kind: 'textarea' },
                      { name: 'payload', label: 'Tie-breaker payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ triggerReason: 'Equal evaluated score requires tie-break resolution.', method: 'Best delivery and compliance score', criteria: 'Delivery score\nWarranty compliance', outcomeBidId: recommendationDetail?.bidId ?? '', status: 'PENDING', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.createAwardTieBreaker(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('winners-bid-pack')}
                  />
                  <ActionFormPanel
                    title="Delivery feasibility"
                    badge="Feasibility"
                    submitLabel="Save Feasibility"
                    fields={[
                      { name: 'deliveryCapacity', label: 'Delivery capacity', kind: 'textarea' },
                      { name: 'siteReadiness', label: 'Site readiness', kind: 'textarea' },
                      { name: 'resourcePlan', label: 'Resource plan', kind: 'textarea' },
                      { name: 'riskRating', label: 'Risk rating', kind: 'select', options: riskLevelOptions },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'note', label: 'Feasibility note', kind: 'textarea' },
                      { name: 'payload', label: 'Feasibility payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ riskRating: 'MEDIUM', status: 'PENDING', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.upsertDeliveryFeasibility(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('winners-bid-pack')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'winners' ? (
                <AwardActionWorkspace
                  kicker="Winners and bid pack"
                  title="Winning bidders and source bid documents"
                  badge={`${awardGroup?.winners.length ?? 0} winners`}
                  context={
                    <>
                      <SimpleTable headers={['Winner', 'Bid', 'Status', 'Value', 'Bid documents']}>
                        {(awardGroup?.winners ?? []).length === 0 ? (
                          <tr><td colSpan={5}><div className="scope-empty">Winning bidders will appear here after evaluation recommendations are grouped for award settlement.</div></td></tr>
                        ) : awardGroup?.winners.map((winner) => (
                          <tr key={winner.id}>
                            <td><strong>{winner.supplierName ?? 'Supplier pending'}</strong><span>{String(winner.payload?.lot ?? 'Tender-level award')}</span></td>
                            <td>{winner.bidId ?? 'No bid linked'}</td>
                            <td><StatusBadge value={winner.status} /></td>
                            <td>{winner.amount === null ? 'Not priced' : formatMoney(winner.amount, winner.currency)}</td>
                            <td>{winner.bidDocuments.length ? winner.bidDocuments.map((document) => document.name).join(', ') : 'No bid documents'}</td>
                          </tr>
                        ))}
                      </SimpleTable>
                      <RecordRegister title="Generated award bid packs" records={(awardGroup?.bidPacks ?? []) as unknown as Array<Record<string, unknown>>} />
                    </>
                  }
                >
                  <ActionFormPanel
                    title="Award bid pack"
                    badge="Pack"
                    submitLabel="Generate Bid Pack"
                    fields={[]}
                    initialValues={{}}
                    onSubmit={() => awardsContractsApi.generateAwardBidPack(activeRecommendationId)}
                    onComplete={refreshDetailAndAdvance('clauses')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'clauses' ? (
                <AwardActionWorkspace
                  kicker="Award clauses"
                  title="Negotiated terms before notice"
                  badge={`${awardGroup?.clauses.length ?? 0} clauses`}
                  context={<AwardClauseGrid clauses={awardGroup?.clauses} />}
                >
                  <ActionFormPanel
                    title="Award clause"
                    badge="Clause"
                    submitLabel="Save Award Clause"
                    fields={[
                      { name: 'clauseKey', label: 'Clause key', kind: 'text', required: true },
                      { name: 'title', label: 'Title', kind: 'text', required: true },
                      { name: 'body', label: 'Body', kind: 'textarea', rows: 5 },
                      { name: 'category', label: 'Category', kind: 'text' },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'buyerComment', label: 'Buyer comment', kind: 'textarea' },
                      { name: 'supplierComment', label: 'Supplier comment', kind: 'textarea' },
                      { name: 'legalComment', label: 'Legal comment', kind: 'textarea' },
                      { name: 'payload', label: 'Clause payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{
                      clauseKey: 'negotiated-award-terms',
                      title: 'Negotiated award terms',
                      category: 'commercial',
                      status: 'IN_PROGRESS',
                      payload: '{}'
                    }}
                    onSubmit={(payload) => awardsContractsApi.upsertAwardClause(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('negotiation')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'negotiation' ? (
                <AwardActionWorkspace
                  kicker="Award negotiation"
                  title="Bidder negotiations before award settlement"
                  badge={`${awardGroup?.negotiations.length ?? 0} points`}
                  context={<RecordRegister title="Award negotiation points" records={(awardGroup?.negotiations ?? []) as unknown as Array<Record<string, unknown>>} />}
                >
                  <ActionFormPanel
                    title="Award negotiation point"
                    badge="Negotiation"
                    submitLabel="Create Negotiation"
                    fields={[
                      { name: 'winnerId', label: 'Winning bidder', kind: 'select', options: itemOptions((awardGroup?.winners ?? []).map((winner) => ({ id: winner.id, title: winner.supplierName ?? winner.bidId ?? winner.id, status: winner.status, type: winner.bidId ?? 'winner', note: winner.contractId ?? '' })), 'Tender-level negotiation') },
                      { name: 'clauseId', label: 'Clause', kind: 'select', options: itemOptions(awardGroup?.clauses ?? [], 'No linked clause') },
                      { name: 'raisedByRole', label: 'Raised by', kind: 'select', required: true, options: [option('Buyer'), option('Supplier'), option('Legal'), option('Award Owner')] },
                      { name: 'subject', label: 'Subject', kind: 'text', required: true },
                      { name: 'position', label: 'Position', kind: 'textarea' },
                      { name: 'counterOffer', label: 'Counter offer', kind: 'textarea' },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'dueDate', label: 'Due date', kind: 'date' },
                      { name: 'payload', label: 'Negotiation payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ raisedByRole: 'Buyer', subject: 'Award-stage negotiation point', status: 'OPEN', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.createAwardNegotiation(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('settlement-notice')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'settlement' ? (
                <AwardActionWorkspace
                  kicker="Settlement and notices"
                  title="Settle award terms and notify winners"
                  badge={`${registerCounts.settlement} records`}
                  context={
                    <div className="award-register-stack">
                      <RecordRegister title="Generated award bid packs" records={(awardGroup?.bidPacks ?? []) as unknown as Array<Record<string, unknown>>} />
                      <RecordRegister title="Standstill periods" records={recommendationDetail?.standstillPeriods ?? []} />
                      <RecordRegister title="Award notifications" records={recommendationDetail?.awardNotifications ?? []} />
                    </div>
                  }
                >
                  <ActionFormPanel
                    title="Settle award"
                    badge="Settlement"
                    submitLabel="Settle and Notify Winners"
                    fields={[
                      { name: 'note', label: 'Settlement note', kind: 'textarea' },
                      { name: 'payload', label: 'Settlement payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ note: 'Award terms settled after bidder negotiations. Issue notices to all winning bidders.', payload: JSON.stringify({ source: 'award-workspace', winnerCount: awardGroup?.winners.length ?? 0 }, null, 2) }}
                    onSubmit={(payload) => awardsContractsApi.settleAwardGroup(activeRecommendationId, String(payload.note ?? ''), payload.payload as Record<string, unknown>)}
                    onComplete={refreshDetailAndAdvance('supplier-response')}
                  />
                  <ActionFormPanel
                    title="Standstill period"
                    badge="Standstill"
                    submitLabel="Save Standstill"
                    fields={[
                      { name: 'startsAt', label: 'Starts at', kind: 'datetime' },
                      { name: 'endsAt', label: 'Ends at', kind: 'datetime' },
                      { name: 'days', label: 'Days', kind: 'number', min: 0, max: 365 },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'waived', label: 'Waived', kind: 'checkbox' },
                      { name: 'waiverReason', label: 'Waiver reason', kind: 'textarea' },
                      { name: 'payload', label: 'Standstill payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ days: '7', status: 'PENDING', waived: false, payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.upsertStandstillPeriod(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('supplier-response')}
                  />
                  <ActionFormPanel
                    title="Award notification"
                    badge="Notice"
                    submitLabel="Send Notification"
                    fields={[
                      { name: 'recipientOrgId', label: 'Notice recipient', kind: 'select', options: recipientOptions, helpText: 'Leave as the recommended supplier unless this notice must go to another linked organization.' },
                      { name: 'channel', label: 'Channel', kind: 'text', technical: true },
                      { name: 'notificationType', label: 'Notification type', kind: 'text', required: true, technical: true },
                      { name: 'subject', label: 'Subject', kind: 'text', required: true },
                      { name: 'body', label: 'Body', kind: 'textarea' },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'payload', label: 'Notification payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ recipientOrgId: recommendationDetail?.supplierOrgId ?? '', channel: 'IN_APP', notificationType: 'AWARD_NOTICE', subject: `Award notice for ${activeRecommendation.title}`, status: 'SENT', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.createAwardNotification(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('supplier-response')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'budget' ? (
                <AwardActionWorkspace
                  kicker="Budget"
                  title="Commitment and funding"
                  badge={`${registerCounts.budget} commitments`}
                  context={
                    <>
                      <TopSummary
                        items={[
                          { label: 'Award value', value: activeRecommendation.amount === null ? 'Not priced' : formatMoney(activeRecommendation.amount, activeRecommendation.currency) },
                          { label: 'Currency', value: activeRecommendation.currency },
                          { label: 'Contract handoff', value: selectedContractId ? 'Linked contract available' : 'Not formed' }
                        ]}
                      />
                      <RecordRegister title="Budget commitments" records={recommendationDetail?.budgetCommitments ?? []} />
                    </>
                  }
                >
                  <ActionFormPanel
                    title="Budget commitment"
                    badge="Budget"
                    submitLabel="Commit Budget"
                    fields={[
                      { name: 'contractId', label: 'Linked contract handoff', kind: 'select', options: contractOptions, helpText: 'Budget can be committed before a contract exists; linked contract context is used when available.' },
                      { name: 'commitmentNo', label: 'Commitment number', kind: 'text' },
                      { name: 'budgetCode', label: 'Budget code', kind: 'text', required: true },
                      { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01', required: true },
                      { name: 'currency', label: 'Currency', kind: 'currency' },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'note', label: 'Commitment note', kind: 'textarea' },
                      { name: 'payload', label: 'Budget payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ contractId: selectedContractId, budgetCode: 'PROCUREMENT.AWARD', amount: activeRecommendation.amount === null ? '' : String(activeRecommendation.amount), currency: activeRecommendation.currency, status: 'PENDING', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.createBudgetCommitmentForRecommendation(activeRecommendationId, payload)}
                    onComplete={refreshDetailAndAdvance('contract-handoff')}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'registers' ? (
                <div className="award-register-grid">
                  <RegisterCard kicker="Approval history" title="Single-user approval history" records={recommendationDetail?.approvalRoutes ?? []} countLabel="records" />
                  <RegisterCard kicker="Tie-breakers" title="Tie-breaker register" records={recommendationDetail?.tieBreakers ?? []} countLabel="records" />
                  <RegisterCard kicker="Feasibility" title="Delivery feasibility checks" records={recommendationDetail?.feasibilityChecks ?? []} countLabel="checks" />
                  <RegisterCard kicker="Standstill" title="Standstill periods" records={recommendationDetail?.standstillPeriods ?? []} countLabel="periods" />
                  <RegisterCard kicker="Notifications" title="Award notifications" records={recommendationDetail?.awardNotifications ?? []} countLabel="sent" />
                  <RegisterCard kicker="Budget" title="Budget commitments" records={recommendationDetail?.budgetCommitments ?? []} countLabel="commitments" />
                </div>
              ) : null}
              </>
              )}

              {selectedContractId ? (
                <div className="inline-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(`/awards-contracts/negotiation?contract=${selectedContractId}&step=draft`)}>Open Contract</button>
                </div>
              ) : null}
            </section>
            </AwardContractAccessProvider>
          ) : null}

          <section className="procurement-panel evaluation-panel award-page-empty award-secondary-queue">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Award queue</span>
                <h2>{activeRecommendation ? 'Switch award recommendation' : 'No evaluation result is ready for awarding.'}</h2>
              </div>
              <StatusBadge value={activeRecommendation?.riskLevel ?? 'No records'} />
            </div>
            {isLoading || loadError ? (
              <div className="scope-empty">{isLoading ? 'Loading award recommendations...' : 'Resolve the loading error above, then retry this workspace.'}</div>
            ) : recommendations.length === 0 ? (
              <>
                <div className="scope-empty">When a tender evaluation is completed and routed to award, the recommendation workflow will appear here.</div>
                <div className="inline-actions">
                  <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=awarding-in-progress">Back to Award Queue</button>
                </div>
              </>
            ) : (
              <SimpleTable headers={['Tender', 'Recommended supplier', 'Stage', 'Required action', 'Status']}>
                {recommendations.map((row) => {
                  const selected = row.awardId === activeRecommendationId || row.id === selectedRecommendationId || row.id === activeRecommendation?.id;
                  return (
                    <tr className={selected ? 'award-selected-row' : ''} aria-current={selected ? 'true' : undefined} key={row.id}>
                      <td><strong>{row.title}</strong><span>{row.reference ?? row.noticeReference ?? humanizeWorkflowStatus(row.currentStage)}</span></td>
                      <td>{row.otherParty}</td>
                      <td>{humanizeWorkflowStatus(row.currentStage)}</td>
                      <td><button className="btn btn-primary btn-sm" type="button" onClick={() => selectRecommendation(row)}>{row.requiredAction}</button></td>
                      <td><StatusBadge value={row.status} /></td>
                    </tr>
                  );
                })}
              </SimpleTable>
            )}
          </section>
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
