import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { awardsContractsApi } from '../../api';
import type { AwardRecommendationDetailDto, LifecycleAction } from '../../types';
import { ActionFormPanel, itemOptions, option, riskLevelOptions } from './AwardContractActionForms';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge,
  TopSummary
} from './AwardsContractsProcurexShared';

function getRecommendationId(search: string) {
  return new URLSearchParams(search).get('recommendation') || '';
}

const awardReadinessChecks = [
  'Evaluation committee completed scoring',
  'Financial evaluation completed',
  'Due diligence completed',
  'Recommended supplier is eligible',
  'Budget availability confirmed',
  'Conflict-of-interest declarations completed'
];

const statusOptions = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'RETURNED', 'WAIVED', 'EXPIRED', 'SENT', 'FAILED'].map((value) => option(value));
const approvalStatusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'RETURNED'].map((value) => option(value));

function recordText(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key];
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function RecordRegister({ title, records }: { title: string; records: Array<Record<string, unknown>> }) {
  return (
    <SimpleTable headers={['Record', 'Status', 'Note']}>
      {records.length === 0 ? (
        <tr><td colSpan={3}><div className="scope-empty">No {title.toLowerCase()} records yet.</div></td></tr>
      ) : records.map((record) => (
        <tr key={recordText(record, 'id', JSON.stringify(record))}>
          <td><strong>{recordText(record, 'title', recordText(record, 'subject', recordText(record, 'routeKey', recordText(record, 'type', 'Record'))))}</strong><span>{recordText(record, 'id')}</span></td>
          <td><StatusBadge value={recordText(record, 'status', 'Recorded')} /></td>
          <td>{recordText(record, 'note', recordText(record, 'summary', 'No note'))}</td>
        </tr>
      ))}
    </SimpleTable>
  );
}

export function AwardRecommendationProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedRecommendationId = useMemo(() => getRecommendationId(location.search), [location.search]);
  const [recommendations, setRecommendations] = useState<LifecycleAction[]>([]);
  const [recommendationDetail, setRecommendationDetail] = useState<AwardRecommendationDetailDto | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let active = true;
    awardsContractsApi.dashboard()
      .then((data) => {
        if (active) setRecommendations(data.queues['awarding-in-progress']);
      })
      .catch(() => {
        if (active) setRecommendations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeRecommendation =
    recommendations.find((item) => item.awardId === selectedRecommendationId || item.id === selectedRecommendationId) ?? recommendations[0] ?? null;
  const activeRecommendationId = activeRecommendation?.awardId ?? activeRecommendation?.id.replace(/^award-/, '') ?? '';
  const approvalRouteOptions = itemOptions(
    (recommendationDetail?.approvalRoutes ?? []).map((record) => ({
      id: recordText(record, 'id'),
      title: recordText(record, 'title', recordText(record, 'routeKey')),
      status: recordText(record, 'status')
    })).filter((record) => record.id),
    'Select approval route'
  );

  useEffect(() => {
    if (!activeRecommendationId || import.meta.env.MODE === 'test') {
      setRecommendationDetail(null);
      return;
    }
    let active = true;
    awardsContractsApi.recommendation(activeRecommendationId)
      .then((data) => {
        if (active) setRecommendationDetail(data);
      })
      .catch(() => {
        if (active) setRecommendationDetail(null);
      });
    return () => {
      active = false;
    };
  }, [activeRecommendationId]);

  function selectRecommendation(row: LifecycleAction) {
    navigate(`/awards-contracts/recommendation?recommendation=${row.awardId ?? row.id}`);
  }

  async function refreshRecommendations() {
    const dashboard = await awardsContractsApi.dashboard();
    setRecommendations(dashboard.queues['awarding-in-progress']);
    if (activeRecommendationId) {
      const detail = await awardsContractsApi.recommendation(activeRecommendationId);
      setRecommendationDetail(detail);
    }
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
          subtitle="Buyer award workspace"
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
            <TopSummary
              items={[
                { label: 'Tender', value: activeRecommendation.title },
                { label: 'Recommended Supplier', value: activeRecommendation.otherParty },
                { label: 'Award Value', value: activeRecommendation.amount === null ? 'Not priced' : formatMoney(activeRecommendation.amount, activeRecommendation.currency) },
                { label: 'Current Stage', value: activeRecommendation.currentStage },
                { label: 'Status', value: <StatusBadge value={activeRecommendation.status} /> }
              ]}
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
            {recommendations.length === 0 ? (
              <div className="scope-empty">When a tender evaluation is completed and routed to award, the recommendation workflow will appear here.</div>
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

          {activeRecommendation ? (
            <section className="procurement-panel evaluation-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Readiness checks</span><h2>Before award notice and contract formation</h2></div>
                <StatusBadge value="Checklist" />
              </div>
              <div className="award-control-grid">
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
                <ActionFormPanel
                  title="Approval route"
                  badge="Route"
                  submitLabel="Save Route"
                  fields={[
                    { name: 'routeKey', label: 'Route key', kind: 'text', required: true },
                    { name: 'title', label: 'Route title', kind: 'text', required: true },
                    { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                    { name: 'currentStepOrder', label: 'Current step order', kind: 'number', min: 1 },
                    { name: 'requiredQuorum', label: 'Required quorum', kind: 'number', min: 1 },
                    { name: 'note', label: 'Route note', kind: 'textarea' },
                    { name: 'payload', label: 'Route payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{ routeKey: 'award-approval', title: 'Award approval route', status: 'PENDING', currentStepOrder: '1', requiredQuorum: '1', payload: '{}' }}
                  onSubmit={(payload) => awardsContractsApi.upsertAwardApprovalRoute(activeRecommendationId, payload)}
                  onComplete={refreshRecommendationDetail}
                />
                <ActionFormPanel
                  title="Approval step"
                  badge="Step"
                  submitLabel="Save Step"
                  fields={[
                    { name: 'routeId', label: 'Approval route', kind: 'select', required: true, options: approvalRouteOptions },
                    { name: 'stepOrder', label: 'Step order', kind: 'number', min: 1, required: true },
                    { name: 'stepKey', label: 'Step key', kind: 'text', required: true },
                    { name: 'role', label: 'Approver role', kind: 'text', required: true },
                    { name: 'actorUserId', label: 'Actor user ID', kind: 'uuid' },
                    { name: 'status', label: 'Status', kind: 'select', options: approvalStatusOptions },
                    { name: 'dueDate', label: 'Due date', kind: 'date' },
                    { name: 'note', label: 'Step note', kind: 'textarea' },
                    { name: 'payload', label: 'Step payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{ routeId: approvalRouteOptions[1]?.value ?? '', stepOrder: '1', stepKey: 'procurement-approval', role: 'PROCUREMENT_MANAGER', status: 'PENDING', payload: '{}' }}
                  onSubmit={(payload) => awardsContractsApi.upsertAwardApprovalStep(activeRecommendationId, payload)}
                  onComplete={refreshRecommendationDetail}
                />
                <ActionFormPanel
                  title="Tie-breaker"
                  badge="Tie-break"
                  submitLabel="Record Tie-breaker"
                  fields={[
                    { name: 'triggerReason', label: 'Trigger reason', kind: 'textarea', required: true },
                    { name: 'method', label: 'Method', kind: 'text', required: true },
                    { name: 'criteria', label: 'Criteria JSON array', kind: 'json', rows: 4 },
                    { name: 'outcomeBidId', label: 'Outcome bid ID', kind: 'uuid' },
                    { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                    { name: 'note', label: 'Decision note', kind: 'textarea' },
                    { name: 'payload', label: 'Tie-breaker payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{ triggerReason: 'Equal evaluated score requires tie-break resolution.', method: 'Best delivery and compliance score', criteria: '[]', status: 'PENDING', payload: '{}' }}
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
                    { name: 'recipientOrgId', label: 'Recipient organization ID', kind: 'uuid' },
                    { name: 'channel', label: 'Channel', kind: 'text' },
                    { name: 'notificationType', label: 'Notification type', kind: 'text', required: true },
                    { name: 'subject', label: 'Subject', kind: 'text', required: true },
                    { name: 'body', label: 'Body', kind: 'textarea' },
                    { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                    { name: 'payload', label: 'Notification payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{ channel: 'IN_APP', notificationType: 'AWARD_NOTICE', subject: `Award notice for ${activeRecommendation.title}`, status: 'SENT', payload: '{}' }}
                  onSubmit={(payload) => awardsContractsApi.createAwardNotification(activeRecommendationId, payload)}
                  onComplete={refreshRecommendationDetail}
                />
                <ActionFormPanel
                  title="Budget commitment"
                  badge="Budget"
                  submitLabel="Commit Budget"
                  fields={[
                    { name: 'contractId', label: 'Contract ID', kind: 'uuid' },
                    { name: 'commitmentNo', label: 'Commitment number', kind: 'text' },
                    { name: 'budgetCode', label: 'Budget code', kind: 'text', required: true },
                    { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01', required: true },
                    { name: 'currency', label: 'Currency', kind: 'currency' },
                    { name: 'status', label: 'Status', kind: 'select', required: true, options: statusOptions },
                    { name: 'note', label: 'Commitment note', kind: 'textarea' },
                    { name: 'payload', label: 'Budget payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{ contractId: activeRecommendation.contractId ?? '', budgetCode: 'PROCUREMENT.AWARD', amount: activeRecommendation.amount === null ? '' : String(activeRecommendation.amount), currency: activeRecommendation.currency, status: 'PENDING', payload: '{}' }}
                  onSubmit={(payload) => awardsContractsApi.createBudgetCommitmentForRecommendation(activeRecommendationId, payload)}
                  onComplete={refreshRecommendationDetail}
                />
              </div>
              {activeRecommendation.contractId ? (
                <div className="inline-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(`/awards-contracts/negotiation?contract=${activeRecommendation.contractId}`)}>Open Contract</button>
                </div>
              ) : null}
              <SimpleTable headers={['Check', 'Status', 'Owner']}>
                {awardReadinessChecks.map((check) => (
                  <tr key={check}>
                    <td><strong>{check}</strong></td>
                    <td><StatusBadge value="Required" /></td>
                    <td>Buyer evaluation / procurement team</td>
                  </tr>
                ))}
              </SimpleTable>
              <div className="award-control-grid">
                <section>
                  <div className="panel-heading"><div><span className="section-kicker">Approval route</span><h2>Route and steps</h2></div><StatusBadge value={`${recommendationDetail?.approvalRoutes?.length ?? 0} routes`} /></div>
                  <RecordRegister title="Approval routes" records={recommendationDetail?.approvalRoutes ?? []} />
                </section>
                <section>
                  <div className="panel-heading"><div><span className="section-kicker">Tie-breakers</span><h2>Tie-breaker register</h2></div><StatusBadge value={`${recommendationDetail?.tieBreakers?.length ?? 0} records`} /></div>
                  <RecordRegister title="Tie-breakers" records={recommendationDetail?.tieBreakers ?? []} />
                </section>
                <section>
                  <div className="panel-heading"><div><span className="section-kicker">Feasibility</span><h2>Delivery feasibility checks</h2></div><StatusBadge value={`${recommendationDetail?.feasibilityChecks?.length ?? 0} checks`} /></div>
                  <RecordRegister title="Feasibility checks" records={recommendationDetail?.feasibilityChecks ?? []} />
                </section>
                <section>
                  <div className="panel-heading"><div><span className="section-kicker">Standstill</span><h2>Standstill periods</h2></div><StatusBadge value={`${recommendationDetail?.standstillPeriods?.length ?? 0} periods`} /></div>
                  <RecordRegister title="Standstill periods" records={recommendationDetail?.standstillPeriods ?? []} />
                </section>
                <section>
                  <div className="panel-heading"><div><span className="section-kicker">Notifications</span><h2>Award notifications</h2></div><StatusBadge value={`${recommendationDetail?.awardNotifications?.length ?? 0} sent`} /></div>
                  <RecordRegister title="Award notifications" records={recommendationDetail?.awardNotifications ?? []} />
                </section>
                <section>
                  <div className="panel-heading"><div><span className="section-kicker">Budget</span><h2>Budget commitments</h2></div><StatusBadge value={`${recommendationDetail?.budgetCommitments?.length ?? 0} commitments`} /></div>
                  <RecordRegister title="Budget commitments" records={recommendationDetail?.budgetCommitments ?? []} />
                </section>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
