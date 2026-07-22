/* Renders the awards Contracts Contract Signing ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardContractDocumentDto, ContractDetailDto, ContractLifecycleItemDto } from '../../types';
import { ActionFormPanel, signatureOptions } from './AwardContractActionForms';
import { AwardPlainRecordList, ExpandableAwardDetails } from './AwardContractSimpleShared';
import {
  AwardHero,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

function contractIdFromSearch(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

function payloadValue(record: ContractLifecycleItemDto | undefined, key: string) {
  const value = record?.payload?.[key];
  return value === null || value === undefined ? '' : String(value);
}

function finalDraftAcceptanceRole(record: ContractLifecycleItemDto) {
  if (!['APPROVED', 'CLOSED'].includes(record.status)) return '';
  if (payloadValue(record, 'acceptanceType') !== 'NEGOTIATED_DRAFT') return '';
  return payloadValue(record, 'role').toUpperCase();
}

function openNegotiationRecords(records: ContractLifecycleItemDto[] = []) {
  const closed = new Set(['APPROVED', 'REJECTED', 'WAIVED', 'CLOSED']);
  return records.filter((record) => !closed.has(record.status));
}

function latestVersionDocument(contract: ContractDetailDto | null, documents: AwardContractDocumentDto[]) {
  const versions = [...(contract?.versions ?? [])]
    .filter((version) => typeof version.documentId === 'string' && version.documentId)
    .sort((left, right) => {
      const leftVersion = Number(left.versionNo ?? 0);
      const rightVersion = Number(right.versionNo ?? 0);
      if (rightVersion !== leftVersion) return rightVersion - leftVersion;
      return String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''));
    });
  const documentId = versions[0]?.documentId;
  return typeof documentId === 'string' ? documents.find((document) => document.id === documentId) ?? null : null;
}

export function ContractSigningProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => contractIdFromSearch(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [documents, setDocuments] = useState<AwardContractDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setContract(null);
      setDocuments([]);
      setLoadError('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const nextContract = await awardsContractsApi.contract(contractId);
      const nextDocuments = await awardsContractsApi.contractDocuments(contractId);
      setContract(nextContract);
      setDocuments(nextDocuments);
    } catch (error) {
      setContract(null);
      setDocuments([]);
      setLoadError(apiErrorMessage(error, 'Contract signing could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const viewerRole = contract?.access?.viewerRole ?? 'NONE';
  const unresolvedNegotiations = openNegotiationRecords(contract?.negotiations ?? []);
  const finalDraftAcceptanceRoles = new Set((contract?.acceptances ?? []).map(finalDraftAcceptanceRole).filter(Boolean));
  const buyerAcceptedFinalDraft = finalDraftAcceptanceRoles.has('BUYER');
  const supplierAcceptedFinalDraft = finalDraftAcceptanceRoles.has('SUPPLIER');
  const outcomeCommunicationsConfirmed = (contract?.workflowApprovals ?? []).some((record) =>
    record.title === 'outcome-communications' && ['APPROVED', 'CLOSED'].includes(record.status)
  );
  const signatureReady = Boolean(contract?.awardId && contract.supplierOrgId) && unresolvedNegotiations.length === 0 && buyerAcceptedFinalDraft && supplierAcceptedFinalDraft && outcomeCommunicationsConfirmed;
  const buyerSignature = (contract?.signatures ?? []).find((signature) => signature.role === 'BUYER');
  const supplierSignature = (contract?.signatures ?? []).find((signature) => signature.role === 'SUPPLIER');
  const buyerSigned = (contract?.signatures ?? []).some((signature) => signature.role === 'BUYER' && signature.status === 'SIGNED');
  const supplierSigned = (contract?.signatures ?? []).some((signature) => signature.role === 'SUPPLIER' && signature.status === 'SIGNED');
  const pendingSignatures = (contract?.signatures ?? []).filter((signature) => signature.status !== 'SIGNED');
  const signableSignatures = (contract?.signatures ?? []).filter((signature) => {
    if (signature.status === 'SIGNED') return false;
    if (signature.role === 'SUPPLIER' && !buyerSigned) return false;
    if (viewerRole === 'ADMIN') return true;
    return signature.role === viewerRole;
  });
  const canRequestSignatures = Boolean(contract && (viewerRole === 'BUYER' || viewerRole === 'ADMIN') && signatureReady);
  const officialDocument = latestVersionDocument(contract, documents);
  const allSigned = Boolean(contract?.signatures?.length) && pendingSignatures.length === 0;
  const signatureLockReason = !contract?.awardId || !contract.supplierOrgId
    ? 'Complete award and negotiation steps first.'
    : unresolvedNegotiations.length > 0
      ? 'Resolve open requests first.'
      : !buyerAcceptedFinalDraft || !supplierAcceptedFinalDraft
        ? 'Both sides must accept the draft first.'
        : !outcomeCommunicationsConfirmed
          ? 'Confirm outcome communications first.'
          : '';
  const supplierSigningStatus = supplierSigned
    ? 'Supplier signed'
    : !supplierSignature
      ? 'Request supplier signature'
      : !buyerSigned
        ? 'After buyer signs'
        : viewerRole === 'SUPPLIER'
          ? 'Open supplier form below'
          : 'Supplier signs on this page';
  const buyerSigningStatus = buyerSigned
    ? 'Buyer signed'
    : buyerSignature
      ? viewerRole === 'BUYER' ? 'Open buyer form below' : 'Waiting for buyer'
      : 'Request buyer signature';

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
    void awardsContractsApi.contractDocuments(contractId).then(setDocuments).catch(() => undefined);
  }

  return (
    <ProcurexAwardFrame pageKey="contract-signing">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract Signing"
            title="Complete digital signatures"
            copy="Request signatures and sign the contract."
            stats={[
              { value: String(contract?.signatures?.length ?? 0), label: 'Signature records' },
              { value: String(pendingSignatures.length), label: 'Pending' },
              { value: officialDocument ? 'Ready' : 'Pending', label: 'Official document' }
            ]}
          />

          {!contractId ? (
            <RemoteStatePanel
              kicker="No contract"
              title="Open a contract pending signature"
              message="Choose a contract to sign."
              status="Ready"
              actionLabel="Back to contracts"
              onAction={() => navigate('/awards-contracts?queue=contract-signing')}
            />
          ) : null}

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading contract signing"
              message="Loading contract signing."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Contract signing could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadContract()}
            />
          ) : null}

          {!isLoading && !loadError && contract ? (
            <>
              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Selected contract</span><h2>{contract.title}</h2></div>
                  <StatusBadge value={contract.status} />
                </div>
                <section className="contract-overview-grid">
                  <article><span>Reference</span><strong>{contract.reference}</strong></article>
                  <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
                  <article><span>Supplier</span><strong>{contract.supplierName ?? 'Pending supplier'}</strong></article>
                  <article><span>Viewer</span><strong>{viewerRole === 'SUPPLIER' ? 'Supplier signer' : viewerRole === 'BUYER' ? 'Buyer signer' : viewerRole}</strong></article>
                </section>
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel post-award-forms-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Digital signatures</span><h2>Signature requests and signing</h2></div>
                  <StatusBadge value={allSigned ? 'Signed' : `${pendingSignatures.length} pending`} />
                </div>
                {!signatureReady ? <div className="scope-empty">{signatureLockReason}</div> : null}
                <SimpleTable headers={['Role', 'Signer', 'Status', 'Signed at']}>
                  {(contract.signatures ?? []).length === 0 ? (
                    <tr><td colSpan={4}><div className="scope-empty">No signature requests have been created yet.</div></td></tr>
                  ) : contract.signatures.map((signature) => (
                    <tr key={signature.id}>
                      <td>{signature.role}</td>
                      <td>{signature.signerName || 'Pending signer'}</td>
                      <td><StatusBadge value={signature.status} /></td>
                      <td>{signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Not signed'}</td>
                    </tr>
                  ))}
                </SimpleTable>
                <section className="contract-overview-grid" aria-label="Signing path">
                  <article><span>Buyer signing</span><strong>{buyerSigningStatus}</strong></article>
                  <article><span>Supplier signing</span><strong>{supplierSigningStatus}</strong></article>
                </section>

                {canRequestSignatures && !pendingSignatures.length && !allSigned ? (
                  <ActionFormPanel
                    title="Signature request"
                    badge="Signature"
                    submitLabel="Request signatures"
                    fields={[
                      { name: 'roles', label: 'Required signature roles', kind: 'multi', required: true, options: signatureOptions() }
                    ]}
                    initialValues={{ roles: ['BUYER', 'SUPPLIER'] }}
                    onSubmit={(payload) => awardsContractsApi.createSignatureRequests(contract.id, payload.roles as Array<'BUYER' | 'SUPPLIER'>)}
                    onComplete={refreshContract}
                    defaultSelected
                  />
                ) : null}

                {!buyerSigned && signableSignatures.some((signature) => signature.role === 'SUPPLIER') ? (
                  <div className="scope-empty">Supplier signature opens after the buyer has signed.</div>
                ) : null}
                {signatureReady && signableSignatures.length === 0 && !allSigned ? (
                  <div className="scope-empty">{viewerRole === 'SUPPLIER' && !buyerSigned ? 'Supplier signature opens after the buyer has signed.' : 'No pending signature is assigned to your side right now.'}</div>
                ) : null}
                {signableSignatures.map((signature) => (
                  <ActionFormPanel
                    title={`Sign ${signature.role}`}
                    badge={signature.status}
                    submitLabel="Sign contract"
                    fields={[
                      { name: 'signerName', label: 'Signer name', kind: 'text', required: true },
                      { name: 'signerTitle', label: 'Signer title', kind: 'text' },
                      { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', required: true, helpText: 'Used only for this signature.' },
                      { name: 'payload', label: 'Signature payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{
                      signerName: signature.signerName || '',
                      signerTitle: signature.signerTitle ?? '',
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
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Official document</span><h2>Signed contract document</h2></div>
                  <StatusBadge value={allSigned ? 'Available after signing' : 'Waiting for signatures'} />
                </div>
                {!allSigned ? (
                  <div className="scope-empty">Available after signing.</div>
                ) : officialDocument ? (
                  <SimpleTable headers={['Document', 'Type', 'Action']}>
                    <tr>
                      <td><strong>{officialDocument.name}</strong><span>{officialDocument.sourceLabel}</span></td>
                      <td>{officialDocument.documentType}</td>
                      <td>
                        <div className="inline-actions">
                          <a className="btn btn-secondary btn-sm" href={officialDocument.contentUrl} target="_blank" rel="noreferrer">Open</a>
                          <a className="btn btn-secondary btn-sm" href={`${officialDocument.contentUrl}?download=true`} download>Download</a>
                        </div>
                      </td>
                    </tr>
                  </SimpleTable>
                ) : (
                  <div className="scope-empty">No official contract document is linked yet.</div>
                )}
              </section>

              <ExpandableAwardDetails title="Saved signature records" summary={`${contract.signatures.length} signature record${contract.signatures.length === 1 ? '' : 's'}`}>
                <AwardPlainRecordList records={(contract.signatures ?? []) as Array<Record<string, unknown>>} />
              </ExpandableAwardDetails>
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
