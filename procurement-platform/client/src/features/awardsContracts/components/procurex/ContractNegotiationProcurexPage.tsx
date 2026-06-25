import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto } from '../../types';
import {
  ActionFormPanel,
  itemOptions,
  lifecycleStatusOptions,
  milestoneStatusOptions,
  signatureOptions
} from './AwardContractActionForms';
import {
  AwardHero,
  AwardSidebar,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

function getContractId(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

export function ContractNegotiationProcurexPage() {
  const location = useLocation();
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);

  useEffect(() => {
    let active = true;
    if (!contractId) {
      setContract(null);
      return () => {
        active = false;
      };
    }
    awardsContractsApi.contract(contractId)
      .then((data) => {
        if (active) setContract(data);
      })
      .catch(() => {
        if (active) setContract(null);
      });
    return () => {
      active = false;
    };
  }, [contractId]);

  const draft = contract?.payload?.draft as Record<string, unknown> | undefined;

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

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
            title={contract?.title ?? 'No contract record selected'}
            copy="Contract drafting, structured clause review, approval, signature, CMP readiness, and activation checks are managed here."
            stats={[
              { value: contract?.amount ?? 0, label: 'Contract value' },
              { value: contract?.status ?? 'None', label: 'Current status' },
              { value: contract?.signatures?.length ?? 0, label: 'Signature actions' }
            ]}
          />

          {!contract ? (
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
          ) : (
            <>
          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Draft contract</span><h2>Generated from the winning award and tender record</h2></div>
              <StatusBadge value={contract.status} />
            </div>
            <section className="contract-overview-grid">
              <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
              <article><span>Supplier</span><strong>{contract.supplierName ?? 'Supplier pending'}</strong></article>
              <article><span>Reference</span><strong>{contract.reference}</strong></article>
              <article><span>Currency</span><strong>{contract.currency}</strong></article>
            </section>
            <SimpleTable headers={['Draft area', 'Captured content', 'Status']}>
              {['parties', 'tender', 'financials', 'clauses'].map((key) => (
                <tr key={key}>
                  <td><strong>{key}</strong></td>
                  <td>{JSON.stringify(draft?.[key] ?? {}, null, 0)}</td>
                  <td><StatusBadge value={draft?.[key] ? 'Generated' : 'Pending'} /></td>
                </tr>
              ))}
            </SimpleTable>
          </section>

          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Production contract forms</span><h2>Draft, clauses, negotiation, approvals, and signatures</h2></div>
              <StatusBadge value="All fields" />
            </div>
            <div className="award-control-grid">
              <ActionFormPanel
                title="Contract version"
                badge="Version"
                submitLabel="Create Version"
                fields={[
                  { name: 'documentId', label: 'Document ID', kind: 'uuid', placeholder: 'Optional document UUID' },
                  { name: 'payload', label: 'Version payload', kind: 'json', required: true, rows: 7 }
                ]}
                initialValues={{
                  payload: JSON.stringify({
                    source: 'contract-negotiation-workspace',
                    title: contract.title,
                    amount: contract.amount,
                    currency: contract.currency,
                    clauses: contract.clauses ?? []
                  }, null, 2)
                }}
                onSubmit={(payload) => awardsContractsApi.saveDraft(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Contract clause"
                badge="Clause"
                submitLabel="Save Clause"
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
                  clauseKey: 'negotiated-commercial-terms',
                  title: 'Negotiated commercial terms',
                  category: 'financial',
                  status: 'IN_PROGRESS',
                  payload: '{}'
                }}
                onSubmit={(payload) => awardsContractsApi.upsertClause(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Negotiation point"
                badge="Negotiation"
                submitLabel="Create Negotiation"
                fields={[
                  { name: 'clauseId', label: 'Clause', kind: 'select', options: itemOptions(contract.clauses ?? [], 'No linked clause') },
                  { name: 'raisedByRole', label: 'Raised by role', kind: 'text', required: true },
                  { name: 'subject', label: 'Subject', kind: 'text', required: true },
                  { name: 'position', label: 'Position', kind: 'textarea' },
                  { name: 'counterOffer', label: 'Counter offer', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'payload', label: 'Negotiation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  raisedByRole: 'Buyer',
                  subject: 'Structured negotiation point',
                  status: 'OPEN',
                  payload: '{}'
                }}
                onSubmit={(payload) => awardsContractsApi.createNegotiation(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Workflow approval"
                badge="Approval"
                submitLabel="Save Approval"
                fields={[
                  { name: 'stepKey', label: 'Step key', kind: 'text', required: true },
                  { name: 'role', label: 'Role', kind: 'text', required: true },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Approval payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  stepKey: 'legal-review',
                  role: 'Legal Officer',
                  status: 'APPROVED',
                  payload: '{}'
                }}
                onSubmit={(payload) => awardsContractsApi.upsertWorkflowApproval(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Signature request"
                badge="Signature"
                submitLabel="Request Signatures"
                fields={[
                  { name: 'roles', label: 'Required signature roles', kind: 'multi', required: true, options: signatureOptions() }
                ]}
                initialValues={{ roles: ['BUYER', 'SUPPLIER'] }}
                onSubmit={(payload) => awardsContractsApi.createSignatureRequests(contract.id, payload.roles as Array<'BUYER' | 'SUPPLIER'>)}
                onComplete={refreshContract}
              />
              {(contract.signatures ?? []).map((signature) => (
                <ActionFormPanel
                  title={`Sign ${signature.role}`}
                  badge={signature.status}
                  submitLabel="Sign Contract"
                  fields={[
                    { name: 'signerName', label: 'Signer name', kind: 'text', required: true },
                    { name: 'signerTitle', label: 'Signer title', kind: 'text' },
                    { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'text', required: true },
                    { name: 'payload', label: 'Signature payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{
                    signerName: signature.signerName || '',
                    signerTitle: '',
                    payload: JSON.stringify({ signatureId: signature.id, role: signature.role }, null, 2)
                  }}
                  onSubmit={(payload) => awardsContractsApi.signContractSignature(contract.id, signature.id, {
                    signerName: String(payload.signerName),
                    signerTitle: String(payload.signerTitle ?? ''),
                    signatureKeyphrase: String(payload.signatureKeyphrase),
                    payload: payload.payload as Record<string, unknown>
                  })}
                  onComplete={refreshContract}
                  key={signature.id}
                />
              ))}
            </div>
          </section>

          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Clauses and negotiation</span><h2>Structured contract formation record</h2></div>
              <StatusBadge value={`${(contract.clauses ?? []).length} clauses`} />
            </div>
            <SimpleTable headers={['Record', 'Type', 'Status', 'Note']}>
              {[...(contract.clauses ?? []), ...(contract.negotiations ?? [])].length === 0 ? (
                <tr><td colSpan={4}><div className="scope-empty">No clause or negotiation records yet.</div></td></tr>
              ) : [...(contract.clauses ?? []), ...(contract.negotiations ?? [])].map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong></td>
                  <td>{item.type}</td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>{item.note || 'No note'}</td>
                </tr>
              ))}
            </SimpleTable>
          </section>

          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Contract readiness</span><h2>Activation checks before implementation</h2></div>
              <StatusBadge value={contract.managementPlan ? 'CMP ready' : 'CMP pending'} />
            </div>
            <SimpleTable headers={['Check', 'Status', 'Action']}>
              <tr><td><strong>Contract Management Plan</strong></td><td><StatusBadge value={contract.managementPlan ? 'Created' : 'Required'} /></td><td>Assign manager and confirm monitoring plan</td></tr>
              <tr><td><strong>Milestones</strong></td><td><StatusBadge value={contract.milestones.length > 0 ? 'Created' : 'Required'} /></td><td>Create delivery/payment milestones</td></tr>
              <tr><td><strong>Mobilization</strong></td><td><StatusBadge value={contract.mobilizationItems.length > 0 ? 'Checklist ready' : 'Required'} /></td><td>Complete or waive required items</td></tr>
            </SimpleTable>
          </section>

          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Signatures</span><h2>Digital signing status</h2></div>
              <StatusBadge value={`${contract.signatures?.length ?? 0} signature records`} />
            </div>
            <SimpleTable headers={['Role', 'Signer', 'Status', 'Signed at']}>
              {(contract.signatures ?? []).length === 0 ? (
                <tr><td colSpan={4}><div className="scope-empty">No signature requests have been created yet.</div></td></tr>
              ) : contract.signatures.map((signature: any) => (
                <tr key={signature.id}>
                  <td>{signature.role}</td>
                  <td>{signature.signerName || 'Pending signer'}</td>
                  <td><StatusBadge value={signature.status} /></td>
                  <td>{signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Not signed'}</td>
                </tr>
              ))}
            </SimpleTable>
          </section>
            </>
          )}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
