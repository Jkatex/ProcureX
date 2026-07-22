/* Renders the awards Contracts Sample Procurement ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardContractSampleDashboard, AwardContractSampleDto } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import {
  AwardHero,
  ProcurexAwardFrame,
  RegisterCard,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge,
  humanizeWorkflowStatus
} from './AwardsContractsProcurexShared';

const sampleQueueLabels: Record<string, string> = {
  'awaiting-submission': 'Awaiting Submission',
  'awaiting-receipt': 'Awaiting Receipt',
  received: 'Received',
  'awaiting-verification': 'Awaiting Verification',
  'under-evaluation': 'Under Evaluation',
  'clarification-required': 'Clarification Required',
  passed: 'Passed',
  failed: 'Failed',
  'awaiting-return': 'Awaiting Return',
  'retained-reference-samples': 'Retained Reference Samples',
  'overdue-sample-actions': 'Overdue Sample Actions',
  'not-required': 'Sample Not Required'
};

const sampleQueueIds = Object.keys(sampleQueueLabels);

function selectedId(search: string) {
  return new URLSearchParams(search).get('sample') || '';
}

function flattenSamples(dashboard: AwardContractSampleDashboard | null) {
  return Object.values(dashboard?.queues ?? {}).flat();
}

function records(items: Array<Record<string, unknown>> | undefined) {
  return items ?? [];
}

function sampleRequirementDetails(sample: AwardContractSampleDto) {
  if (sample.sampleRequirementStatus === 'NOT_REQUIRED' || sample.sampleRequired === false) {
    return {
      label: 'Sample not required',
      message: 'This tender or bid does not require sample procurement.'
    };
  }

  if (sample.sampleRequirementStatus === 'MISSING_REQUIRED') {
    return {
      label: 'Sample required',
      message: 'This tender or bid requires a sample, but no submitted sample is available yet.'
    };
  }

  return {
    label: 'Sample required',
    message: 'This tender or bid requires a sample and a sample record is available.'
  };
}

export function SampleProcurementProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AwardContractSampleDashboard | null>(null);
  const [selectedSample, setSelectedSample] = useState<AwardContractSampleDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeQueue, setActiveQueue] = useState('awaiting-receipt');
  const sampleId = useMemo(() => selectedId(location.search), [location.search]);

  const allSamples = useMemo(() => flattenSamples(dashboard), [dashboard]);
  const visibleSamples = dashboard?.queues?.[activeQueue] ?? [];

  const loadSamples = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await awardsContractsApi.samples();
      setDashboard(data);
      const loadedSamples = flattenSamples(data);
      const preferred = sampleId ? loadedSamples.find((sample) => sample.id === sampleId) : null;
      const first = preferred ?? loadedSamples[0] ?? null;
      setSelectedSample(first);
      if (first && !sampleId) navigate({ pathname: '/awards-contracts/samples', search: `sample=${first.id}` }, { replace: true });
    } catch (error) {
      setDashboard(null);
      setSelectedSample(null);
      setLoadError(apiErrorMessage(error, 'Sample procurement records could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [navigate, sampleId]);

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  useEffect(() => {
    if (!sampleId) return;
    const next = allSamples.find((sample) => sample.id === sampleId);
    if (next) {
      setSelectedSample(next);
      setActiveQueue(next.awardingStatus || activeQueue);
    }
  }, [activeQueue, allSamples, sampleId]);

  function chooseSample(sample: AwardContractSampleDto) {
    setSelectedSample(sample);
    navigate({ pathname: '/awards-contracts/samples', search: `sample=${sample.id}` });
  }

  function refreshSelected(result: unknown) {
    const sample = result as AwardContractSampleDto;
    setSelectedSample(sample);
    void loadSamples();
  }

  const canManageSelectedSample = Boolean(
    selectedSample?.actionable !== false &&
    (selectedSample?.viewerRole === 'BUYER' || selectedSample?.viewerRole === 'ADMIN')
  );
  const selectedSampleRequirement = selectedSample ? sampleRequirementDetails(selectedSample) : null;

  return (
    <ProcurexAwardFrame pageKey="sample-procurement">
      <div className="main-layout procurement-layout evaluation-app-layout post-award-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content post-award-workspace">
          <AwardHero
            kicker="Awarding and Contracts"
            title="Sample Procurement"
            copy="Track submitted samples."
            stats={[
              { value: allSamples.length, label: 'Samples' },
              { value: dashboard?.summary?.['overdue-sample-actions'] ?? 0, label: 'Overdue' },
              { value: dashboard?.summary?.['retained-reference-samples'] ?? 0, label: 'Reference' }
            ]}
          />

          {isLoading ? (
            <RemoteStatePanel
              title="Loading sample procurement"
              message="Loading sample actions."
            />
          ) : null}
          {loadError ? (
            <RemoteStatePanel
              title="Sample procurement unavailable"
              message={loadError}
              actionLabel="Retry"
              onAction={() => void loadSamples()}
            />
          ) : null}

          {!isLoading && !loadError ? (
            <>
              <section className="procurement-panel evaluation-panel post-award-panel post-award-cmp-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Sample queues</span><h2>Actions by status</h2></div>
                  <StatusBadge value={`${allSamples.length} samples`} />
                </div>
                <div className="post-award-work-chooser" aria-label="Sample procurement queues">
                  {sampleQueueIds.map((queue) => (
                    <button
                      key={queue}
                      type="button"
                      className={`workflow-section-card ${activeQueue === queue ? 'is-active' : ''}`}
                      onClick={() => setActiveQueue(queue)}
                    >
                      <span>{sampleQueueLabels[queue]}</span>
                      <strong>{dashboard?.summary?.[queue] ?? dashboard?.queues?.[queue]?.length ?? 0}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">{sampleQueueLabels[activeQueue]}</span><h2>Sample records</h2></div>
                  <StatusBadge value={visibleSamples.length ? `${visibleSamples.length} records` : 'Empty'} />
                </div>
                {visibleSamples.length === 0 ? (
                  <div className="scope-empty">No sample records are currently in this queue.</div>
                ) : (
                  <SimpleTable headers={['Sample', 'Tender', 'Supplier', 'Status', 'Action']}>
                    {visibleSamples.map((sample) => (
                      <tr key={sample.id}>
                        <td><strong>{sample.sampleName}</strong><br />{sample.relatedItem || sample.sampleReference || sample.trackingNumber || sample.id}</td>
                        <td>{sample.tenderReference ?? sample.tenderTitle}</td>
                        <td>{sample.supplierName}</td>
                        <td>
                          <StatusBadge value={sample.sampleRequirementStatus === 'MISSING_REQUIRED' ? 'Required sample missing' : sample.sampleRequirementStatus === 'NOT_REQUIRED' ? 'Sample not required' : humanizeWorkflowStatus(sample.awardingStatus)} />
                        </td>
                        <td><button type="button" className="btn btn-secondary" onClick={() => chooseSample(sample)}>Open</button></td>
                      </tr>
                    ))}
                  </SimpleTable>
                )}
              </section>

              {selectedSample ? (
                <>
                  <section className="procurement-panel evaluation-panel post-award-panel">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Selected sample</span><h2>{selectedSample.sampleName}</h2></div>
                      <StatusBadge value={humanizeWorkflowStatus(selectedSample.awardingStatus)} />
                    </div>
                    <section className="contract-overview-grid">
                      <article><span>Tender</span><strong>{selectedSample.tenderReference ?? selectedSample.tenderTitle}</strong></article>
                      <article><span>Supplier</span><strong>{selectedSample.supplierName}</strong></article>
                      <article><span>Quantity</span><strong>{selectedSample.quantity ?? 'Not set'}</strong></article>
                      <article><span>Deadline</span><strong>{selectedSample.deliveryDeadline ? new Date(selectedSample.deliveryDeadline).toLocaleDateString() : 'Not dated'}</strong></article>
                      <article><span>Sample requirement</span><strong>{selectedSampleRequirement?.label}</strong></article>
                      <article><span>Viewer</span><strong>{selectedSample.viewerRole === 'SUPPLIER' ? 'Supplier status view' : selectedSample.viewerRole === 'BUYER' ? 'Buyer action view' : 'Read-only'}</strong></article>
                    </section>
                    {selectedSampleRequirement ? (
                      <p className="award-workspace-note">{selectedSampleRequirement.message}</p>
                    ) : null}
                  </section>

                  <section className="procurement-panel evaluation-panel post-award-panel post-award-forms-panel">
                    <div className="panel-heading">
                      <div><span className="section-kicker">{canManageSelectedSample ? 'Buyer actions' : 'Sample status'}</span><h2>{canManageSelectedSample ? 'Manage sample' : 'Sample progress'}</h2></div>
                      <StatusBadge value={selectedSample.trackingStatus} />
                    </div>
                    {!canManageSelectedSample ? (
                      <div className="scope-empty">
                        {selectedSample.sampleRequirementStatus === 'NOT_REQUIRED'
                          ? 'Sample not required for this tender or bid.'
                          : selectedSample.sampleRequirementStatus === 'MISSING_REQUIRED'
                            ? 'A sample is required, but no submitted bid sample is available for Awarding and Contracts action yet.'
                            : 'Supplier-side access is read-only here. Buyer sample actions are shown only to the buyer organization.'}
                      </div>
                    ) : (
                    <AwardContractAccessProvider access={{
                      viewerRole: selectedSample.viewerRole ?? 'NONE',
                      canManageBuyerActions: selectedSample.viewerRole === 'BUYER' || selectedSample.viewerRole === 'ADMIN',
                      canSubmitSupplierActions: selectedSample.viewerRole === 'SUPPLIER' || selectedSample.viewerRole === 'ADMIN',
                      canSignBuyer: false,
                      canSignSupplier: false,
                      readOnlyReason: selectedSample.viewerRole === 'SUPPLIER' ? 'Buyer sample actions are read-only for the supplier.' : null,
                      hideLockedActions: true
                    }}>
                    <div className="award-control-grid">
                      <ActionFormPanel
                        title="Receive sample"
                        badge="Receipt"
                        submitLabel="Receive"
                        fields={[
                          { name: 'receivedQuantity', label: 'Received quantity', kind: 'number', min: 0, step: '0.01' },
                          { name: 'conditionAtReceipt', label: 'Condition at receipt', kind: 'textarea' },
                          { name: 'packagingCondition', label: 'Packaging condition', kind: 'textarea' },
                          { name: 'deliveryRepresentative', label: 'Delivery representative', kind: 'text' },
                          { name: 'storageLocation', label: 'Storage location', kind: 'text' },
                          { name: 'missingComponents', label: 'Missing components', kind: 'textarea' },
                          { name: 'visibleDamage', label: 'Visible damage', kind: 'textarea' },
                          { name: 'remarks', label: 'Remarks', kind: 'textarea' },
                          { name: 'receivedAt', label: 'Received at', kind: 'datetime' },
                          { name: 'payload', label: 'Receipt payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ receivedQuantity: selectedSample.quantity === null ? '' : String(selectedSample.quantity), storageLocation: selectedSample.deliveryLocation, payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.receiveSample(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                        defaultSelected
                      />
                      <ActionFormPanel
                        title="Verify sample"
                        badge="Verification"
                        fields={[
                          { name: 'result', label: 'Result', kind: 'select', required: true, options: ['VERIFIED', 'CLARIFICATION_REQUIRED', 'REJECTED'].map((value) => option(value)) },
                          { name: 'quantityAccepted', label: 'Quantity accepted', kind: 'checkbox' },
                          { name: 'certificatesAttached', label: 'Certificates attached', kind: 'checkbox' },
                          { name: 'packagingAccepted', label: 'Packaging accepted', kind: 'checkbox' },
                          { name: 'matchesBid', label: 'Matches bid', kind: 'checkbox' },
                          { name: 'completeUndamaged', label: 'Complete and undamaged', kind: 'checkbox' },
                          { name: 'clarificationRequired', label: 'Clarification required', kind: 'checkbox' },
                          { name: 'note', label: 'Verification note', kind: 'textarea' },
                          { name: 'payload', label: 'Verification payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ result: 'VERIFIED', quantityAccepted: true, certificatesAttached: true, packagingAccepted: true, matchesBid: true, completeUndamaged: true, payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.verifySample(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                      <ActionFormPanel
                        title="Custody transfer"
                        badge="Custody"
                        fields={[
                          { name: 'previousLocation', label: 'Previous location', kind: 'text' },
                          { name: 'newLocation', label: 'New location', kind: 'text' },
                          { name: 'transferPurpose', label: 'Transfer purpose', kind: 'text', required: true },
                          { name: 'conditionBefore', label: 'Condition before', kind: 'textarea' },
                          { name: 'conditionAfter', label: 'Condition after', kind: 'textarea' },
                          { name: 'remarks', label: 'Remarks', kind: 'textarea' },
                          { name: 'payload', label: 'Custody payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ previousLocation: selectedSample.deliveryLocation, transferPurpose: 'Evaluation custody transfer', payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.transferSampleCustody(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                      <ActionFormPanel
                        title="Evaluate sample"
                        badge="Evaluation"
                        fields={[
                          { name: 'criterion', label: 'Criterion', kind: 'text', required: true },
                          { name: 'score', label: 'Score', kind: 'number', min: 0, step: '0.01' },
                          { name: 'maximumScore', label: 'Maximum score', kind: 'number', min: 0, step: '0.01' },
                          { name: 'passed', label: 'Passed', kind: 'checkbox' },
                          { name: 'decision', label: 'Decision', kind: 'select', options: ['UNDER_EVALUATION', 'PASSED', 'FAILED'].map((value) => option(value)) },
                          { name: 'comments', label: 'Comments', kind: 'textarea' },
                          { name: 'payload', label: 'Evaluation payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ criterion: 'Technical compliance', maximumScore: '100', decision: 'UNDER_EVALUATION', payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.evaluateSample(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                      <ActionFormPanel
                        title="Test or lab report"
                        badge="Testing"
                        fields={[
                          { name: 'testName', label: 'Test name', kind: 'text', required: true },
                          { name: 'testingInstitution', label: 'Testing institution', kind: 'text' },
                          { name: 'testingMethod', label: 'Testing method', kind: 'textarea' },
                          { name: 'expectedResult', label: 'Expected result', kind: 'textarea' },
                          { name: 'actualResult', label: 'Actual result', kind: 'textarea' },
                          { name: 'result', label: 'Result', kind: 'select', options: ['PENDING', 'PASSED', 'FAILED'].map((value) => option(value)) },
                          { name: 'testCost', label: 'Test cost', kind: 'number', min: 0, step: '0.01' },
                          { name: 'currency', label: 'Currency', kind: 'currency' },
                          { name: 'payload', label: 'Test payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ testName: 'Sample conformity test', result: 'PENDING', currency: 'TZS', payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.createSampleTest(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                      <ActionFormPanel
                        title="Request clarification"
                        badge="Clarification"
                        fields={[
                          { name: 'result', label: 'Result', kind: 'select', required: true, options: [option('CLARIFICATION_REQUIRED')] },
                          { name: 'clarificationRequired', label: 'Clarification required', kind: 'checkbox' },
                          { name: 'note', label: 'Clarification note', kind: 'textarea' },
                          { name: 'payload', label: 'Clarification payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ result: 'CLARIFICATION_REQUIRED', clarificationRequired: true, payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.requestSampleClarification(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                      <ActionFormPanel
                        title="Retain reference sample"
                        badge="Reference"
                        fields={[
                          { name: 'contractId', label: 'Contract', kind: 'uuid', required: true },
                          { name: 'referenceNo', label: 'Reference number', kind: 'text' },
                          { name: 'storageLocation', label: 'Storage location', kind: 'text' },
                          { name: 'reason', label: 'Reason', kind: 'textarea' },
                          { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                          { name: 'payload', label: 'Reference sample payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ contractId: selectedSample.contractId ?? '', referenceNo: selectedSample.sampleReference || selectedSample.sampleName, status: 'APPROVED', payload: '{}' }}
                        onSubmit={(payload) => awardsContractsApi.retainSample(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                      <ActionFormPanel
                        title="Return or dispose"
                        badge="Disposition"
                        fields={[
                          { name: 'dispositionType', label: 'Disposition type', kind: 'select', required: true, options: ['RETURN', 'DISPOSE'].map((value) => option(value)) },
                          { name: 'reason', label: 'Reason', kind: 'textarea' },
                          { name: 'collectionDeadline', label: 'Collection deadline', kind: 'datetime' },
                          { name: 'returnCondition', label: 'Return condition', kind: 'textarea' },
                          { name: 'disposalMethod', label: 'Disposal method', kind: 'text' },
                          { name: 'witnesses', label: 'Witnesses', kind: 'textarea' },
                          { name: 'status', label: 'Status', kind: 'select', options: ['OPEN', 'COMPLETED', 'CLOSED'].map((value) => option(value)) },
                          { name: 'payload', label: 'Disposition payload', kind: 'json', rows: 4 }
                        ]}
                        initialValues={{ dispositionType: 'RETURN', status: 'OPEN', payload: '{}' }}
                        onSubmit={(payload) => String(payload.dispositionType) === 'DISPOSE' ? awardsContractsApi.disposeSample(selectedSample.id, payload) : awardsContractsApi.returnSample(selectedSample.id, payload)}
                        onComplete={refreshSelected}
                      />
                    </div>
                    </AwardContractAccessProvider>
                    )}
                  </section>

                  <div className="post-award-register-grid">
                    <RegisterCard kicker="Receipt" title="Receipt" records={selectedSample.receipt ? [selectedSample.receipt] : []} />
                    <RegisterCard kicker="Verification" title="Latest verification" records={selectedSample.latestVerification ? [selectedSample.latestVerification] : []} />
                    <RegisterCard kicker="Evaluation" title="Evaluations" records={records(selectedSample.evaluations)} />
                    <RegisterCard kicker="Testing" title="Tests and lab reports" records={records(selectedSample.tests)} />
                    <RegisterCard kicker="Custody" title="Custody history" records={records(selectedSample.custodyLogs)} />
                    <RegisterCard kicker="Disposition" title="Return, retain, dispose" records={records(selectedSample.dispositions)} />
                    <RegisterCard kicker="Reference" title="Contract reference samples" records={records(selectedSample.referenceSamples)} />
                  </div>
                </>
              ) : (
                <section className="procurement-panel evaluation-panel post-award-panel">
                  <div className="scope-empty">No sample records are available in Awarding and Contracts yet.</div>
                </section>
              )}
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
