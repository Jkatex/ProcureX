import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto } from '../../types';
import { lifecycleStatusOptions } from './AwardContractActionForms';
import { notifyAward } from './AwardContractSimpleShared';
import {
  AwardHero,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

type ClauseItem = NonNullable<ContractDetailDto['clauses']>[number];

function contractIdFromSearch(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

function textValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function clauseKey(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `custom-${Date.now()}`;
}

function clauseCategory(clause: ClauseItem) {
  return textValue(clause.payload?.category || clause.type || 'other/custom') || 'other/custom';
}

function clauseBody(clause: ClauseItem) {
  return clause.note || textValue(clause.payload?.body);
}

function emptyClauseValues() {
  return { category: 'other/custom', title: '', body: '', status: 'OPEN' };
}

export function ContractClausesProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => contractIdFromSearch(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [selected, setSelected] = useState<ClauseItem | null>(null);
  const [values, setValues] = useState(emptyClauseValues);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deletingClauseId, setDeletingClauseId] = useState<string | null>(null);
  const canManageClauses = ['BUYER', 'ADMIN'].includes(contract?.access?.viewerRole ?? '');

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setContract(null);
      setSelected(null);
      setValues(emptyClauseValues());
      setEditorOpen(false);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const nextContract = await awardsContractsApi.contract(contractId);
      setContract(nextContract);
      setSelected(null);
      setValues(emptyClauseValues());
      setEditorOpen(false);
    } catch (error) {
      setContract(null);
      setSelected(null);
      setValues(emptyClauseValues());
      setEditorOpen(false);
      setLoadError(apiErrorMessage(error, 'Contract clauses could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  function chooseClause(clause: ClauseItem) {
    setSelected(clause);
    setValues({
      category: clauseCategory(clause),
      title: clause.title,
      body: clauseBody(clause),
      status: clause.status || 'OPEN'
    });
    setEditorOpen(true);
  }

  function startCustomClause() {
    setSelected(null);
    setValues(emptyClauseValues());
    setEditorOpen(true);
  }

  function cancelEdit() {
    setSelected(null);
    setValues(emptyClauseValues());
    setEditorOpen(false);
  }

  async function saveClause(reviewAfterSave = false) {
    if (!contract || !canManageClauses) return;
    if (!values.title.trim() || !values.body.trim()) {
      notifyAward('warning', 'Clause wording required', 'Enter a clause title and wording before saving.');
      return;
    }
    setSaving(true);
    try {
      const key = selected ? textValue(selected.payload?.clauseKey || selected.id || selected.title) : clauseKey(values.title);
      const result = await awardsContractsApi.upsertClause(contract.id, {
        clauseKey: key,
        title: values.title.trim(),
        body: values.body.trim(),
        category: values.category.trim() || 'other/custom',
        status: values.status,
        payload: { clauseKey: key, category: values.category.trim() || 'other/custom', source: selected ? 'clause-editor' : 'custom-clause' }
      });
      notifyAward('success', 'Clause saved', selected ? 'The contract clause was updated.' : 'The custom clause was added.');
      setContract(result);
      if (reviewAfterSave) {
        navigate(`/awards-contracts/drafting?contract=${contract.id}`);
      } else {
        cancelEdit();
      }
    } catch (error) {
      notifyAward('error', 'Clause not saved', apiErrorMessage(error, 'The clause could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void saveClause(false);
  }

  async function deleteClause(clause: ClauseItem) {
    if (!contract || !canManageClauses || deletingClauseId) return;
    if (!window.confirm(`Remove clause "${clause.title}" from this contract draft?`)) return;
    setDeletingClauseId(clause.id);
    try {
      const result = await awardsContractsApi.deleteClause(contract.id, clause.id);
      notifyAward('success', 'Clause removed', 'The clause was removed from the contract draft.');
      setContract(result);
      if (selected?.id === clause.id) {
        cancelEdit();
      }
    } catch (error) {
      notifyAward('error', 'Clause not removed', apiErrorMessage(error, 'The clause could not be removed.'));
    } finally {
      setDeletingClauseId(null);
    }
  }

  return (
    <ProcurexAwardFrame pageKey="contract-clauses">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract Clauses"
            title={contract?.title ?? 'No contract selected'}
            copy="Edit the wording that will appear in the contract draft. Add custom clauses here, then return to the draft document for review and PDF generation."
            stats={[
              { value: String(contract?.clauses?.length ?? 0), label: 'Clauses' },
              { value: contract?.status ?? 'Draft', label: 'Status' },
              { value: selected ? 'Editing' : 'Custom', label: 'Mode' }
            ]}
          />

          {!contractId ? (
            <RemoteStatePanel
              kicker="No contract"
              title="Open contract clauses"
              message="Choose a contract draft before editing clauses."
              status="Ready"
              actionLabel="Back to Contract Drafting"
              onAction={() => navigate('/awards-contracts?queue=contract-preparation')}
            />
          ) : null}

          {isLoading ? <RemoteStatePanel kicker="Loading" title="Loading contract clauses" message="ProcureX is fetching the contract and saved clauses." status="Loading" /> : null}
          {loadError ? <RemoteStatePanel kicker="Service status" title="Contract clauses could not be loaded" message={loadError} status="Error" actionLabel="Retry loading" onAction={() => void loadContract()} /> : null}

          {!isLoading && !loadError && contract ? (
            <>
              {!canManageClauses ? (
                <RemoteStatePanel
                  kicker="Buyer workspace"
                  title="Contract clause editing is buyer-only"
                  message="Suppliers review the draft in Contract Negotiation after the buyer sends it."
                  status="Locked"
                  actionLabel="Back to draft review"
                  onAction={() => navigate(`/awards-contracts/drafting?contract=${contract.id}`)}
                />
              ) : null}

              {canManageClauses ? (
                <>
                <section className="contract-clauses-workspace">
                  <div className="procurement-panel evaluation-panel post-award-panel">
                    <div className="panel-heading">
                      <div><span className="section-kicker">Saved Clauses</span><h2>Choose a clause to edit</h2></div>
                      <StatusBadge value={`${contract.clauses?.length ?? 0} clauses`} />
                    </div>
                    {(contract.clauses ?? []).length ? (
                      <SimpleTable headers={['Clause', 'Category', 'Status', 'Action']}>
                        {(contract.clauses ?? []).map((clause) => (
                          <tr key={clause.id}>
                            <td><strong>{clause.title}</strong><span>{clauseBody(clause) || 'No wording saved yet.'}</span></td>
                            <td>{clauseCategory(clause)}</td>
                            <td><StatusBadge value={clause.status} /></td>
                            <td>
                              <div className="contract-clause-row-actions">
                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => chooseClause(clause)}>Edit</button>
                                <button
                                  className="boq-row-action icon-delete-btn contract-clause-delete-button"
                                  type="button"
                                  aria-label={`Delete ${clause.title}`}
                                  title="Delete clause"
                                  disabled={deletingClauseId === clause.id}
                                  onClick={() => void deleteClause(clause)}
                                >
                                  x
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </SimpleTable>
                    ) : (
                      <div className="scope-empty">No clauses are saved yet. Add a custom clause to include it in the draft document.</div>
                    )}
                    <div className="inline-actions">
                      <button className="btn btn-secondary" type="button" onClick={startCustomClause}>New custom clause</button>
                      <button className="btn btn-secondary" type="button" onClick={() => navigate(`/awards-contracts/drafting?contract=${contract.id}`)}>Back to draft review</button>
                    </div>
                  </div>
                </section>

                {editorOpen ? (
                  <div className="contract-clause-modal-backdrop" role="presentation">
                    <form
                      className="procurement-panel evaluation-panel post-award-panel award-action-form contract-clause-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="contract-clause-editor-title"
                      onSubmit={submit}
                    >
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">{selected ? 'Edit Clause' : 'Custom Clause'}</span>
                          <h2 id="contract-clause-editor-title">{selected ? selected.title : 'Add buyer-defined clause'}</h2>
                        </div>
                        <div className="contract-clause-modal-heading-actions">
                          <StatusBadge value={values.status} />
                          <button className="boq-row-action icon-delete-btn contract-clause-modal-close" type="button" aria-label="Cancel clause edit" onClick={cancelEdit}>x</button>
                        </div>
                      </div>
                      <div className="award-form-grid">
                        <label className="award-form-field">
                          <span>Category</span>
                          <input className="form-input" value={values.category} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))} />
                        </label>
                        <label className="award-form-field">
                          <span>Status</span>
                          <select className="form-input" value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))}>
                            {lifecycleStatusOptions.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}
                          </select>
                        </label>
                        <label className="award-form-field award-form-field-wide">
                          <span>Clause title</span>
                          <input className="form-input" value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} />
                        </label>
                        <label className="award-form-field award-form-field-wide">
                          <span>Clause wording</span>
                          <textarea className="form-input contract-clauses-editor" rows={18} value={values.body} onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))} />
                        </label>
                      </div>
                      <div className="inline-actions">
                        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save clause'}</button>
                        <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => void saveClause(true)}>Save and review draft</button>
                        <button className="btn btn-secondary" type="button" disabled={saving} onClick={cancelEdit}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
