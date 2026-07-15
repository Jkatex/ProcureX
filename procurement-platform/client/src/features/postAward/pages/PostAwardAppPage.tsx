import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { WorkspaceTopBar } from '@/shared/components/procurex/WorkspaceTopBar';
import { postAwardApi } from '../api';
import type { PostAwardAction, PostAwardContractRow, PostAwardRecord, PostAwardStageId, PostAwardWorkspace } from '../types';

const stageOrder: PostAwardStageId[] = ['setup', 'delivery', 'inspections', 'finance', 'risk', 'changes', 'claims', 'documents', 'closeout', 'performance', 'history'];

function routeFor(pageKey: string) {
  const routes: Record<string, string> = {
    'workspace-dashboard': '/dashboard',
    'account-profile': '/identity/profile',
    marketplace: '/procurement/marketplace',
    'communication-center': '/communication',
    'bid-evaluation': '/evaluation',
    'awarding-contracts': '/awards-contracts',
    'post-award': '/post-award',
    'records-history': '/records'
  };
  return routes[pageKey] ?? '/dashboard';
}

function queryValue(search: string, key: string) {
  return new URLSearchParams(search).get(key) ?? '';
}

function dateLabel(value?: string | null) {
  if (!value) return 'Not dated';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function money(value: number | string | null | undefined, currency = 'TZS') {
  if (value === null || value === undefined || value === '') return 'Not priced';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${currency} ${numeric.toLocaleString()}` : `${currency} ${value}`;
}

function badgeTone(value: string) {
  if (/critical|high|blocked|rejected|terminated|failed/i.test(value)) return 'error';
  if (/medium|submitted|review|pending|open|warning/i.test(value)) return 'warning';
  if (/accepted|approved|closed|paid|complete|success|active/i.test(value)) return 'success';
  return 'info';
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value, tone }: { value: string; tone?: string }) {
  return <span className={`post-award-pill post-award-pill-${tone ?? badgeTone(value)}`}>{humanize(value)}</span>;
}

export function PostAwardAppPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [contracts, setContracts] = useState<PostAwardContractRow[]>([]);
  const [workspace, setWorkspace] = useState<PostAwardWorkspace | null>(null);
  const [activeStage, setActiveStage] = useState<PostAwardStageId>((queryValue(location.search, 'stage') as PostAwardStageId) || 'delivery');
  const [activeAction, setActiveAction] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [error, setError] = useState('');
  const selectedContractId = queryValue(location.search, 'contract');

  useEffect(() => {
    document.body.dataset.page = 'post-award';
    document.body.dataset.procurexReactPage = 'true';
    return () => {
      delete document.body.dataset.procurexReactPage;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadContracts() {
      setLoading(true);
      setError('');
      try {
        const rows = await postAwardApi.contracts();
        if (cancelled) return;
        setContracts(rows);
        if (!selectedContractId && rows[0]) {
          navigate(`/post-award?contract=${encodeURIComponent(rows[0].id)}&stage=delivery`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Post Award contracts could not be loaded.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadContracts();
    return () => {
      cancelled = true;
    };
  }, [navigate, selectedContractId]);

  useEffect(() => {
    if (!selectedContractId) {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setError('');
      try {
        const next = await postAwardApi.workspace(selectedContractId);
        if (!cancelled) {
          setWorkspace(next);
          const nextStage = queryValue(location.search, 'stage') as PostAwardStageId;
          if (nextStage && stageOrder.includes(nextStage)) setActiveStage(nextStage);
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Post Award workspace could not be loaded.'));
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [location.search, selectedContractId]);

  const activeStageData = useMemo(
    () => workspace?.stages.find((stage) => stage.id === activeStage) ?? workspace?.stages[0],
    [activeStage, workspace]
  );
  const filteredActions = useMemo(
    () => workspace?.actions.filter((action) => action.stage === activeStage) ?? [],
    [activeStage, workspace]
  );

  function selectContract(contractId: string) {
    navigate(`/post-award?contract=${encodeURIComponent(contractId)}&stage=delivery`);
    setActiveAction('');
  }

  function selectStage(stageId: PostAwardStageId) {
    setActiveStage(stageId);
    setActiveAction('');
    navigate(`/post-award?contract=${encodeURIComponent(selectedContractId)}&stage=${stageId}`, { replace: true });
  }

  function applyWorkspace(next: PostAwardWorkspace) {
    setWorkspace(next);
    setActiveAction('');
  }

  return (
    <>
      <WorkspaceTopBar title="Post Award" onNavigate={(pageKey) => navigate(routeFor(pageKey))} />
      <main className="post-award-app" data-post-award-app>
        <aside className="post-award-contracts" aria-label="Post Award contracts">
          <div className="post-award-pane-head">
            <span>Contract workspace</span>
            <strong>{contracts.length}</strong>
          </div>
          {loading ? <div className="post-award-empty">Loading contracts...</div> : null}
          {!loading && contracts.length === 0 ? <div className="post-award-empty">No contracts are ready for Post Award.</div> : null}
          <div className="post-award-contract-list">
            {contracts.map((contract) => (
              <button
                className={`post-award-contract-card${contract.id === selectedContractId ? ' active' : ''}`}
                type="button"
                onClick={() => selectContract(contract.id)}
                key={contract.id}
              >
                <span>{contract.reference}</span>
                <strong>{contract.title}</strong>
                <em>{contract.viewerRole === 'BUYER' ? contract.supplierName : contract.buyerName}</em>
                <StatusPill value={contract.status} />
              </button>
            ))}
          </div>
        </aside>

        <section className="post-award-workspace">
          {error ? <div className="post-award-alert">{error}</div> : null}
          {!workspace && !workspaceLoading ? (
            <div className="post-award-empty post-award-empty-large">
              <strong>Select a contract</strong>
              <span>Choose a contract from the list.</span>
            </div>
          ) : null}
          {workspace ? (
            <>
              <header className="post-award-contract-header">
                <div>
                  <span>{workspace.contract.reference}</span>
                  <h1>{workspace.contract.title}</h1>
                  <p>{workspace.contract.buyerName} / {workspace.contract.supplierName ?? 'Supplier pending'}</p>
                </div>
                <div className="post-award-header-meta">
                  <StatusPill value={workspace.contract.status} />
                  <StatusPill value={workspace.contract.viewerRole} tone="info" />
                  <strong>{money(workspace.contract.amount, workspace.contract.currency)}</strong>
                </div>
              </header>

              <section className="post-award-metrics" aria-label="Post Award metrics">
                {workspace.metrics.map((metric) => (
                  <article key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </article>
                ))}
              </section>

              <div className="post-award-console">
                <nav className="post-award-stages" aria-label="Post Award stages">
                  {workspace.stages.map((stage) => (
                    <button className={stage.id === activeStage ? 'active' : ''} type="button" onClick={() => selectStage(stage.id)} key={stage.id}>
                      <span>{stage.label}</span>
                      <strong>{stage.count}</strong>
                    </button>
                  ))}
                </nav>

                <section className="post-award-stage-panel">
                  <div className="post-award-pane-head">
                    <div>
                      <span>{activeStageData?.description}</span>
                      <strong>{activeStageData?.label}</strong>
                    </div>
                    {workspaceLoading ? <em>Refreshing...</em> : null}
                  </div>
                  <RecordTable records={activeStageData?.records ?? []} />
                  <SecondaryRegisters workspace={workspace} />
                </section>

                <aside className="post-award-actions" aria-label="Recommended Post Award actions">
                  <div className="post-award-pane-head">
                    <span>Action queue</span>
                    <strong>{filteredActions.length}</strong>
                  </div>
                  <div className="post-award-action-list">
                    {filteredActions.map((action) => (
                      <button
                        className={`post-award-action-card${activeAction === action.key ? ' active' : ''}`}
                        type="button"
                        disabled={!action.enabled}
                        title={action.reason ?? action.label}
                        onClick={() => setActiveAction((current) => (current === action.key ? '' : action.key))}
                        key={action.key}
                      >
                        <span>{action.owner}</span>
                        <strong>{action.label}</strong>
                        <em>{action.reason ?? action.priority}</em>
                      </button>
                    ))}
                  </div>
                  {activeAction ? (
                    <PostAwardActionForm actionKey={activeAction} workspace={workspace} onSaved={applyWorkspace} />
                  ) : (
                    <div className="post-award-empty">Open an action to record work.</div>
                  )}
                </aside>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

function RecordTable({ records }: { records: PostAwardRecord[] }) {
  if (records.length === 0) return <div className="post-award-empty">No records in this work area yet.</div>;
  return (
    <div className="post-award-table-wrap">
      <table className="post-award-table">
        <thead>
          <tr>
            <th>Record</th>
            <th>Status</th>
            <th>Due / Created</th>
            <th>Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <strong>{record.title}</strong>
                <span>{humanize(record.type)}</span>
              </td>
              <td><StatusPill value={record.status} /></td>
              <td>{dateLabel(record.dueDate ?? record.createdAt)}</td>
              <td>{money(record.amount, record.currency ?? 'TZS')}</td>
              <td>{record.note ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecondaryRegisters({ workspace }: { workspace: PostAwardWorkspace }) {
  return (
    <section className="post-award-secondary">
      <div className="post-award-pane-head">
        <span>Secondary tools and registers</span>
        <strong>{workspace.secondary.reduce((total, item) => total + item.count, 0)}</strong>
      </div>
      <div className="post-award-secondary-grid">
        {workspace.secondary.map((register) => (
          <article key={register.id}>
            <span>{register.label}</span>
            <strong>{register.count}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function PostAwardActionForm({ actionKey, workspace, onSaved }: { actionKey: string; workspace: PostAwardWorkspace; onSaved: (workspace: PostAwardWorkspace) => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const contractId = workspace.contract.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage('');
    try {
      const payload = payloadFor(actionKey, form, workspace);
      const next = await saveAction(actionKey, contractId, payload, workspace);
      onSaved(next);
    } catch (error) {
      setMessage(apiErrorMessage(error, 'Post Award action could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="post-award-form" onSubmit={submit}>
      <h2>{labelForAction(actionKey)}</h2>
      <FieldsForAction actionKey={actionKey} workspace={workspace} />
      {message ? <p className="post-award-form-error">{message}</p> : null}
      <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save action'}</button>
    </form>
  );
}

function FieldsForAction({ actionKey, workspace }: { actionKey: string; workspace: PostAwardWorkspace }) {
  const milestones = workspace.stages.find((stage) => stage.id === 'delivery')?.records.filter((record) => record.type === 'milestone') ?? [];
  const deliverables = workspace.stages.find((stage) => stage.id === 'delivery')?.records.filter((record) => record.type === 'deliverable') ?? [];
  const inspections = workspace.stages.find((stage) => stage.id === 'inspections')?.records.filter((record) => /inspection/i.test(record.type)) ?? [];
  const invoices = workspace.stages.find((stage) => stage.id === 'finance')?.records.filter((record) => /invoice/i.test(record.type)) ?? [];
  if (actionKey === 'management-plan') {
    return (
      <>
        <TextArea name="objectives" label="Objectives" required />
        <TextArea name="monitoringPlan" label="Monitoring plan" />
        <TextArea name="reportingPlan" label="Reporting plan" />
        <TextArea name="communicationPlan" label="Communication plan" />
      </>
    );
  }
  if (actionKey === 'deliverable') {
    return (
      <>
        <TextInput name="title" label="Deliverable title" required />
        <SelectInput name="milestoneId" label="Milestone" records={milestones} empty="No linked milestone" />
        <TextArea name="description" label="Description" />
        <TextArea name="note" label="Supplier note" />
      </>
    );
  }
  if (actionKey === 'evidence') {
    return (
      <>
        <SelectInput name="milestoneId" label="Milestone" records={milestones} required />
        <TextInput name="documentName" label="Evidence file name" required />
        <TextInput name="documentType" label="Document type" defaultValue="POST_AWARD_EVIDENCE" />
        <TextArea name="note" label="Evidence note" />
      </>
    );
  }
  if (actionKey === 'inspection') {
    return (
      <>
        <TextInput name="title" label="Inspection title" required />
        <SelectInput name="milestoneId" label="Milestone" records={milestones} empty="No linked milestone" />
        <TextInput name="inspectionType" label="Inspection type" defaultValue="General inspection" required />
        <TextArea name="note" label="Inspection note" />
      </>
    );
  }
  if (actionKey === 'acceptance') {
    return (
      <>
        <SelectInput name="deliverableId" label="Deliverable" records={deliverables} empty="No linked deliverable" />
        <SelectInput name="inspectionId" label="Inspection" records={inspections} empty="No linked inspection" />
        <TextInput name="certificateNo" label="Certificate no." />
        <NumberInput name="acceptedValue" label="Accepted value" />
        <TextArea name="note" label="Acceptance note" />
      </>
    );
  }
  if (actionKey === 'invoice') {
    return (
      <>
        <TextInput name="reference" label="Invoice reference" required />
        <NumberInput name="amount" label="Invoice amount" required />
        <TextInput name="currency" label="Currency" defaultValue={workspace.contract.currency} required />
      </>
    );
  }
  if (actionKey === 'payment') {
    return (
      <>
        <SelectInput name="invoiceId" label="Invoice" records={invoices} empty="No linked invoice" />
        <NumberInput name="netAmount" label="Net amount" required />
        <TextInput name="currency" label="Currency" defaultValue={workspace.contract.currency} required />
        <TextArea name="note" label="Payment review note" />
      </>
    );
  }
  if (actionKey === 'issue') {
    return (
      <>
        <TextInput name="title" label="Issue title" required />
        <TextInput name="category" label="Category" defaultValue="execution" required />
        <TextArea name="description" label="Description" />
        <TextArea name="note" label="Resolution note" />
      </>
    );
  }
  if (actionKey === 'variation') {
    return (
      <>
        <TextInput name="title" label="Variation title" required />
        <TextInput name="changeType" label="Change type" defaultValue="scope" required />
        <TextArea name="reason" label="Reason" required />
        <NumberInput name="costImpact" label="Cost impact" />
        <NumberInput name="timeImpactDays" label="Time impact days" />
      </>
    );
  }
  return (
    <>
      <label className="post-award-check"><input name="completionCertificate" type="checkbox" /> Completion certificate issued</label>
      <label className="post-award-check"><input name="finalAccountApproved" type="checkbox" /> Final account approved</label>
      <TextArea name="lessonsLearned" label="Lessons learned" />
      <TextInput name="signatureKeyphrase" label="Signature keyphrase" type="password" required />
    </>
  );
}

function TextInput({ name, label, required, defaultValue = '', type = 'text' }: { name: string; label: string; required?: boolean; defaultValue?: string; type?: string }) {
  return <label><span>{label}</span><input className="form-input" name={name} type={type} required={required} defaultValue={defaultValue} /></label>;
}

function NumberInput({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return <label><span>{label}</span><input className="form-input" name={name} type="number" min="0" step="0.01" required={required} /></label>;
}

function TextArea({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return <label><span>{label}</span><textarea className="form-input" name={name} rows={3} required={required} /></label>;
}

function SelectInput({ name, label, records, required, empty = 'Select record' }: { name: string; label: string; records: PostAwardRecord[]; required?: boolean; empty?: string }) {
  return (
    <label>
      <span>{label}</span>
      <select className="form-input" name={name} required={required}>
        <option value="">{empty}</option>
        {records.map((record) => <option value={record.id} key={record.id}>{record.title}</option>)}
      </select>
    </label>
  );
}

function payloadFor(actionKey: string, form: FormData, workspace: PostAwardWorkspace) {
  const value = (name: string) => String(form.get(name) ?? '').trim();
  const numberValue = (name: string) => (value(name) ? Number(value(name)) : undefined);
  const base = { payload: { source: 'post-award-app' } };
  if (actionKey === 'management-plan') return { ...base, objectives: value('objectives'), monitoringPlan: value('monitoringPlan'), reportingPlan: value('reportingPlan'), communicationPlan: value('communicationPlan') };
  if (actionKey === 'deliverable') return { ...base, title: value('title'), milestoneId: value('milestoneId') || undefined, description: value('description'), note: value('note'), status: 'SUBMITTED', submittedAt: new Date().toISOString() };
  if (actionKey === 'evidence') return { documentName: value('documentName'), documentType: value('documentType') || 'POST_AWARD_EVIDENCE', milestoneId: value('milestoneId'), note: value('note') };
  if (actionKey === 'inspection') return { ...base, title: value('title'), milestoneId: value('milestoneId') || undefined, inspectionType: value('inspectionType'), note: value('note'), status: 'SUBMITTED' };
  if (actionKey === 'acceptance') return { ...base, deliverableId: value('deliverableId') || undefined, inspectionId: value('inspectionId') || undefined, certificateNo: value('certificateNo'), acceptedValue: numberValue('acceptedValue'), currency: workspace.contract.currency, status: 'APPROVED', acceptedAt: new Date().toISOString(), note: value('note') };
  if (actionKey === 'invoice') return { ...base, reference: value('reference'), amount: Number(value('amount')), currency: value('currency') || workspace.contract.currency, status: 'SUBMITTED' };
  if (actionKey === 'payment') return { ...base, invoiceId: value('invoiceId') || undefined, netAmount: Number(value('netAmount')), currency: value('currency') || workspace.contract.currency, status: 'REVIEW', note: value('note') };
  if (actionKey === 'issue') return { ...base, title: value('title'), category: value('category') || 'execution', description: value('description'), note: value('note'), status: 'OPEN' };
  if (actionKey === 'variation') return { ...base, title: value('title'), changeType: value('changeType'), reason: value('reason'), costImpact: numberValue('costImpact'), timeImpactDays: numberValue('timeImpactDays'), status: 'OPEN' };
  return { ...base, completionCertificate: form.get('completionCertificate') === 'on', finalAccountApproved: form.get('finalAccountApproved') === 'on', lessonsLearned: value('lessonsLearned'), status: 'CLOSED', signatureKeyphrase: value('signatureKeyphrase') };
}

async function saveAction(actionKey: string, contractId: string, payload: Record<string, unknown>, workspace: PostAwardWorkspace) {
  if (actionKey === 'management-plan') return postAwardApi.upsertManagementPlan(contractId, payload);
  if (actionKey === 'deliverable') return postAwardApi.createDeliverable(contractId, payload);
  if (actionKey === 'evidence') {
    const document = await postAwardApi.uploadDocument(contractId, {
      name: payload.documentName,
      documentType: payload.documentType,
      contentBase64: btoa(`Post Award evidence placeholder for ${payload.documentName}`)
    });
    return postAwardApi.addMilestoneEvidence(contractId, String(payload.milestoneId), { documentId: document.id, note: payload.note ?? '' });
  }
  if (actionKey === 'inspection') return postAwardApi.createInspection(contractId, payload);
  if (actionKey === 'acceptance') return postAwardApi.createAcceptance(contractId, payload);
  if (actionKey === 'invoice') return postAwardApi.createInvoice(contractId, payload);
  if (actionKey === 'payment') {
    const invoiceId = String(payload.invoiceId ?? '');
    if (invoiceId) await postAwardApi.updateInvoiceStatus(contractId, invoiceId, { status: 'REVIEW', note: payload.note ?? 'Payment review opened.' });
    return postAwardApi.createPayment(contractId, payload);
  }
  if (actionKey === 'issue') return postAwardApi.createIssue(contractId, payload);
  if (actionKey === 'variation') return postAwardApi.createVariation(contractId, payload);
  if (workspace.contract.status === 'CLOSED') return postAwardApi.workspace(contractId);
  return postAwardApi.upsertCloseout(contractId, payload);
}

function labelForAction(actionKey: string) {
  return humanize(actionKey);
}
