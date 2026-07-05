import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardRecommendationDetailDto, LifecycleAction } from '../../types';
import { ActionFormPanel, option, riskLevelOptions } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import {
  AwardHero,
  AwardSidebar,
  RegisterCard,
  RecordRegister,
  formatMoney,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  shortId,
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

const statusOptions = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'RETURNED', 'WAIVED', 'EXPIRED', 'SENT', 'FAILED'].map((value) => option(value));
const awardWorkflowGroups = [
  { id: 'readiness', label: 'Readiness', description: 'Checks and award decision.' },
  { id: 'validation', label: 'Validation', description: 'Tie-breaker and feasibility.' },
  { id: 'notice', label: 'Notice', description: 'Standstill and notification.' },
  { id: 'budget', label: 'Budget', description: 'Budget reservation.' },
  { id: 'registers', label: 'Registers', description: 'All saved records.' }
] as const;

type AwardWorkflowGroupId = (typeof awardWorkflowGroups)[number]['id'];

function AwardSectionTabs({
  activeGroup,
  counts,
  onSelect
}: {
  activeGroup: AwardWorkflowGroupId;
  counts: Partial<Record<AwardWorkflowGroupId, number>>;
  onSelect: (group: AwardWorkflowGroupId) => void;
}) {
  return (
    <div className="award-workflow-tabs" role="tablist" aria-label="Award workflow sections">
      {awardWorkflowGroups.map((group) => (
        <button
          className={`award-workflow-tab${activeGroup === group.id ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-label={group.label}
          aria-selected={activeGroup === group.id}
          onClick={() => onSelect(group.id)}
          key={group.id}
        >
          <strong>{group.label}</strong>
          <span>{group.description}</span>
          {counts[group.id] !== undefined ? <em>{counts[group.id]}</em> : null}
        </button>
      ))}
    </div>
  );
}

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
    { label: 'Award decision', status: hasApproval ? 'Approved' : recommendation.status, done: hasApproval },
    { label: 'Notice', status: detail?.notice?.status ?? 'Pending', done: hasNotice },
    { label: 'Supplier response', status: hasResponse ? (detail?.notice?.status ?? recommendation.status) : 'Awaiting response', done: hasResponse },
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
  const [activeGroup, setActiveGroup] = useState<AwardWorkflowGroupId>('readiness');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [detailError, setDetailError] = useState('');

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
    notice: (recommendationDetail?.standstillPeriods?.length ?? 0) + (recommendationDetail?.awardNotifications?.length ?? 0),
    budget: recommendationDetail?.budgetCommitments?.length ?? 0,
    registers:
      (recommendationDetail?.approvalRoutes?.length ?? 0) +
      (recommendationDetail?.tieBreakers?.length ?? 0) +
      (recommendationDetail?.feasibilityChecks?.length ?? 0) +
      (recommendationDetail?.standstillPeriods?.length ?? 0) +
      (recommendationDetail?.awardNotifications?.length ?? 0) +
      (recommendationDetail?.budgetCommitments?.length ?? 0)
  } satisfies Record<AwardWorkflowGroupId, number>;
  const selectedContractId = recommendationDetail?.notice?.contractId ?? recommendationDetail?.contract?.id ?? activeRecommendation?.contractId ?? '';
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
    navigate(`/awards-contracts/recommendation?recommendation=${row.awardId ?? row.id}`);
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
            copy="Confirm evaluation readiness, approve award actions, issue notices, track supplier response, and hand off to contract drafting."
            stats={[
              { value: activeRecommendation?.amount ?? 0, label: 'Award amount' },
              { value: recommendations.length, label: 'Procurement records' },
              { value: recommendations.filter((item) => /notice|response/i.test(item.requiredAction)).length, label: 'Notice actions' }
            ]}
          />

          {activeRecommendation ? (
            <>
              <TopSummary
                items={[
                  { label: 'Award No', value: recommendationDetail?.reference ?? activeRecommendation.reference ?? activeRecommendation.id },
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

          <section className="procurement-panel evaluation-panel award-page-empty">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Award recommendation</span>
                <h2>{activeRecommendation ? 'Award-ready tender actions' : 'No evaluation result is ready for awarding.'}</h2>
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
                {recommendations.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.title}</strong><span>{row.tenderId}</span></td>
                    <td>{row.otherParty}</td>
                    <td>{row.currentStage}</td>
                    <td><button className="btn btn-primary btn-sm" type="button" onClick={() => selectRecommendation(row)}>{row.requiredAction}</button></td>
                    <td><StatusBadge value={row.status} /></td>
                  </tr>
                ))}
              </SimpleTable>
            )}
          </section>

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
            <section className="procurement-panel evaluation-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Award workspace</span><h2>Before award notice and contract formation</h2></div>
                <StatusBadge value={awardWorkflowGroups.find((group) => group.id === activeGroup)?.label ?? 'Workflow'} />
              </div>
              <AwardSectionTabs activeGroup={activeGroup} counts={registerCounts} onSelect={setActiveGroup} />

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
                        {awardReadinessChecks.map((check) => (
                          <tr key={check}>
                            <td><strong>{check}</strong></td>
                            <td><StatusBadge value="Required" /></td>
                            <td>Logged-in buyer user</td>
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
                    onComplete={() => void refreshRecommendations()}
                  />
                  <ActionFormPanel
                    title="Return award"
                    badge="Buyer"
                    submitLabel="Return Award"
                    fields={[{ name: 'note', label: 'Return note', kind: 'textarea', required: true }]}
                    initialValues={{ note: 'Returned for evaluation clarification from ProcureX award recommendation workspace' }}
                    onSubmit={(payload) => awardsContractsApi.returnRecommendation(activeRecommendation.awardId ?? activeRecommendation.id.replace(/^award-/, ''), String(payload.note ?? ''))}
                    onComplete={() => void refreshRecommendations()}
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
                      { name: 'criteria', label: 'Criteria JSON array', kind: 'json', rows: 4 },
                      { name: 'outcomeBidId', label: 'Tie-break outcome bid', kind: 'select', options: bidOptions, helpText: 'Choose from the selected recommendation context when a bid is available.' },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'note', label: 'Decision note', kind: 'textarea' },
                      { name: 'payload', label: 'Tie-breaker payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ triggerReason: 'Equal evaluated score requires tie-break resolution.', method: 'Best delivery and compliance score', criteria: '[]', outcomeBidId: recommendationDetail?.bidId ?? '', status: 'PENDING', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.createAwardTieBreaker(activeRecommendationId, payload)}
                    onComplete={refreshRecommendationDetail}
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
                    onComplete={refreshRecommendationDetail}
                  />
                </AwardActionWorkspace>
              ) : null}

              {activeGroup === 'notice' ? (
                <AwardActionWorkspace
                  kicker="Notice and standstill"
                  title="Supplier notice controls"
                  badge={`${registerCounts.notice} records`}
                  context={
                    <div className="award-register-stack">
                      <RecordRegister title="Standstill periods" records={recommendationDetail?.standstillPeriods ?? []} />
                      <RecordRegister title="Award notifications" records={recommendationDetail?.awardNotifications ?? []} />
                    </div>
                  }
                >
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
                    onComplete={refreshRecommendationDetail}
                  />
                  <ActionFormPanel
                    title="Award notification"
                    badge="Notice"
                    submitLabel="Send Notification"
                    fields={[
                      { name: 'recipientOrgId', label: 'Notice recipient', kind: 'select', options: recipientOptions, helpText: 'Leave as the recommended supplier unless this notice must go to another linked organization.' },
                      { name: 'channel', label: 'Channel', kind: 'text' },
                      { name: 'notificationType', label: 'Notification type', kind: 'text', required: true },
                      { name: 'subject', label: 'Subject', kind: 'text', required: true },
                      { name: 'body', label: 'Body', kind: 'textarea' },
                      { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                      { name: 'payload', label: 'Notification payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{ recipientOrgId: recommendationDetail?.supplierOrgId ?? '', channel: 'IN_APP', notificationType: 'AWARD_NOTICE', subject: `Award notice for ${activeRecommendation.title}`, status: 'SENT', payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.createAwardNotification(activeRecommendationId, payload)}
                    onComplete={refreshRecommendationDetail}
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
                          { label: 'Contract handoff', value: selectedContractId ? shortId(selectedContractId) : 'Not formed' }
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
                    onComplete={refreshRecommendationDetail}
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

              {selectedContractId ? (
                <div className="inline-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(`/awards-contracts/negotiation?contract=${selectedContractId}`)}>Open Contract</button>
                </div>
              ) : null}
            </section>
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
