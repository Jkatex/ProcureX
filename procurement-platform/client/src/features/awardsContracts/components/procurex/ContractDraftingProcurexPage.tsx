import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardContractDocumentDto, ContractDetailDto } from '../../types';
import { notifyAward } from './AwardContractSimpleShared';
import {
  AwardHero,
  formatMoney,
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

function clauseCategory(clause: ClauseItem) {
  return textValue(clause.payload?.category || clause.type || 'other/custom') || 'other/custom';
}

function clauseBody(clause: ClauseItem) {
  return clause.note || textValue(clause.payload?.body);
}

function latestVersion(contract: ContractDetailDto | null) {
  return [...(contract?.versions ?? [])].sort((left, right) => right.versionNo - left.versionNo)[0] ?? null;
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfLine(value: string, maxLength = 92) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function buildGeneratedContractPdfBase64(text: string) {
  const lines = text.split('\n').flatMap((line) => wrapPdfLine(line)).slice(0, 52);
  const stream = [
    'BT',
    '/F1 10 Tf',
    '50 780 Td',
    '14 TL',
    ...lines.map((line) => `(${pdfEscape(line)}) Tj T*`),
    'ET'
  ].join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encodeBase64(pdf);
}

function buildGeneratedContractText(contract: ContractDetailDto) {
  const clauses = contract.clauses ?? [];
  return [
    `OFFICIAL CONTRACT DRAFT`,
    `Reference: ${contract.reference}`,
    `Title: ${contract.title}`,
    `Buyer: ${contract.buyerName}`,
    `Supplier: ${contract.supplierName ?? 'To be confirmed'}`,
    `Tender: ${contract.tenderReference ?? contract.tenderId ?? 'Not linked'}`,
    `Value: ${contract.amount === null ? 'Not priced' : formatMoney(contract.amount, contract.currency)}`,
    '',
    '1. Introduction',
    'This contract draft is prepared from the standard ProcureX contract template and selected contract clauses.',
    '',
    '2. Scope and Commercial Terms',
    'The scope, pricing, delivery, inspection, acceptance, and payment obligations are governed by the tender, accepted award, and clauses below.',
    '',
    '3. Clauses',
    ...clauses.flatMap((clause, index) => [`${index + 1}. ${clause.title}`, clauseBody(clause) || 'Clause body pending.', '']),
    '4. Required Documents',
    ...(contract.requiredDocuments?.length ? contract.requiredDocuments.map((item) => `- ${item.title}: ${item.status}`) : ['- No required documents recorded.']),
    '',
    '5. Signature Blocks',
    `Buyer signature: ____________________`,
    `Supplier signature: ____________________`
  ].join('\n');
}

function ContractPreview({ contract }: { contract: ContractDetailDto }) {
  return (
    <article className="contract-drafting-document" data-testid="contract-template-preview">
      <header className="contract-drafting-document-cover">
        <div>
          <span>Standard Contract Draft</span>
          <h2>{contract.title}</h2>
        </div>
        <p>{contract.reference}</p>
      </header>
      <section className="contract-drafting-summary-grid" aria-label="Contract summary">
        <div>
          <span>Buyer</span>
          <strong>{contract.buyerName}</strong>
        </div>
        <div>
          <span>Supplier</span>
          <strong>{contract.supplierName ?? 'Supplier selected after award acceptance'}</strong>
        </div>
        <div>
          <span>Tender reference</span>
          <strong>{contract.tenderReference ?? contract.tenderId ?? 'Not linked'}</strong>
        </div>
        <div>
          <span>Contract value</span>
          <strong>{contract.amount === null ? 'Not priced' : formatMoney(contract.amount, contract.currency)}</strong>
        </div>
      </section>
      <section className="contract-drafting-document-section">
        <h3><span>1</span> Parties</h3>
        <p>This agreement is prepared between the buyer and the awarded supplier named above. The parties will perform their obligations according to the accepted tender, award record, and final contract wording.</p>
      </section>
      <section className="contract-drafting-document-section">
        <h3><span>2</span> Tender and Commercial Terms</h3>
        <p>The contract is linked to the tender reference and value shown in the summary. Scope, pricing, delivery, inspection, acceptance, payment, and compliance obligations are governed by the tender documents and the clauses below.</p>
      </section>
      <section className="contract-drafting-document-section">
        <h3><span>3</span> Scope, Delivery, Payment, and Acceptance Clauses</h3>
        {(contract.clauses ?? []).length ? contract.clauses?.map((clause) => (
          <div className="contract-drafting-clause" key={clause.id}>
            <span>{clauseCategory(clause)}</span>
            <h4>{clause.title}</h4>
            <p>{clauseBody(clause) || 'Clause body pending.'}</p>
          </div>
        )) : <p>No clauses have been added yet.</p>}
      </section>
      <section className="contract-drafting-document-section">
        <h3><span>4</span> Required Documents</h3>
        {(contract.requiredDocuments ?? []).length ? (
          <ul className="contract-drafting-document-list">{contract.requiredDocuments?.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.status}</span></li>)}</ul>
        ) : <p>No required documents recorded.</p>}
      </section>
      <section className="contract-drafting-document-section">
        <h3><span>5</span> Signature Blocks</h3>
        <div className="contract-drafting-signature-grid">
          <div><strong>Buyer signature</strong><span /></div>
          <div><strong>Supplier signature</strong><span /></div>
        </div>
      </section>
    </article>
  );
}

export function ContractDraftingProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => contractIdFromSearch(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [documents, setDocuments] = useState<AwardContractDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const latest = latestVersion(contract);
  const canManageDraft = ['BUYER', 'ADMIN'].includes(contract?.access?.viewerRole ?? '');

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setContract(null);
      setDocuments([]);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const nextContract = await awardsContractsApi.contract(contractId);
      setContract(nextContract);
      setDocuments(await awardsContractsApi.contractDocuments(contractId));
    } catch (error) {
      setContract(null);
      setDocuments([]);
      setLoadError(apiErrorMessage(error, 'Contract draft could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
    void awardsContractsApi.contractDocuments(contractId).then(setDocuments).catch(() => undefined);
  }

  async function generateDraftVersion() {
    if (!contract) return;
    setGenerating(true);
    try {
      const generated = buildGeneratedContractText(contract);
      const uploaded = await awardsContractsApi.uploadContractDocument(contract.id, {
        name: `${contract.reference}-draft-v${(latest?.versionNo ?? 0) + 1}.pdf`,
        documentType: 'CONTRACT_DRAFT',
        mimeType: 'application/pdf',
        contentBase64: buildGeneratedContractPdfBase64(generated)
      });
      const result = await awardsContractsApi.saveDraft(contract.id, {
        source: 'contract-drafting-template',
        generatedAt: new Date().toISOString(),
        title: contract.title,
        clauseCount: contract.clauses?.length ?? 0,
        documentId: uploaded.id
      }, uploaded.id);
      notifyAward('success', 'Draft version generated', 'The generated draft was uploaded and linked as the latest contract version.');
      refreshContract(result);
    } catch (error) {
      notifyAward('error', 'Draft not generated', apiErrorMessage(error, 'The contract draft could not be generated.'));
    } finally {
      setGenerating(false);
    }
  }

  async function sendForNegotiation() {
    if (!contract) return;
    try {
      const result = await awardsContractsApi.sendForNegotiation(contract.id);
      notifyAward('success', 'Sent to negotiation', 'The supplier can now review the draft contract.');
      refreshContract(result);
      navigate(`/awards-contracts/negotiation?contract=${contract.id}`);
    } catch (error) {
      notifyAward('error', 'Not sent', apiErrorMessage(error, 'The contract could not be sent to negotiation.'));
    }
  }

  return (
    <ProcurexAwardFrame pageKey="contract-drafting">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract Drafting"
            title={contract?.title ?? 'No contract selected'}
            copy="Build a clean final draft from the standard contract template, selected clauses, and buyer custom wording before sending it to supplier negotiation."
            stats={[
              { value: String(contract?.clauses?.length ?? 0), label: 'Clauses' },
              { value: String(contract?.versions?.length ?? 0), label: 'Versions' },
              { value: contract?.status ?? 'Draft', label: 'Status' }
            ]}
          />

          {!contractId ? (
            <RemoteStatePanel
              kicker="No contract"
              title="Open a draft contract"
              message="Choose a record from Contract Drafting to start contract drafting."
              status="Ready"
              actionLabel="Back to Contract Drafting"
              onAction={() => navigate('/awards-contracts?queue=contract-preparation')}
            />
          ) : null}

          {isLoading ? <RemoteStatePanel kicker="Loading" title="Loading contract draft" message="ProcureX is fetching the selected contract, clauses, and documents." status="Loading" /> : null}
          {loadError ? <RemoteStatePanel kicker="Service status" title="Contract draft could not be loaded" message={loadError} status="Error" actionLabel="Retry loading" onAction={() => void loadContract()} /> : null}

          {!isLoading && !loadError && contract ? (
            <>
              {!canManageDraft ? (
                <RemoteStatePanel
                  kicker="Buyer workspace"
                  title="Contract drafting is buyer-only"
                  message="Suppliers review the draft in Contract Negotiation after the buyer sends it."
                  status="Locked"
                  actionLabel="Open negotiation"
                  onAction={() => navigate(`/awards-contracts/negotiation?contract=${contract.id}`)}
                />
              ) : null}

              <section className="contract-drafting-layout">
                <div className="procurement-panel evaluation-panel post-award-panel contract-drafting-main">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Template Preview</span><h2>Standard contract document</h2></div>
                    <StatusBadge value={latest ? `Version ${latest.versionNo}` : 'No version'} />
                  </div>
                  <ContractPreview contract={contract} />
                  <div className="inline-actions">
                    {canManageDraft ? (
                      <button className="btn btn-secondary" type="button" onClick={() => navigate(`/awards-contracts/drafting/clauses?contract=${contract.id}`)}>
                        Edit Contract Clauses
                      </button>
                    ) : null}
                    <button className="btn btn-primary" type="button" disabled={!canManageDraft || generating} onClick={() => void generateDraftVersion()}>
                      {generating ? 'Generating...' : 'Generate draft document'}
                    </button>
                    <button className="btn btn-secondary" type="button" disabled={!canManageDraft || !latest} onClick={() => void sendForNegotiation()}>
                      Send to negotiation
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => navigate('/awards-contracts?queue=contract-preparation')}>Back to drafts</button>
                  </div>
                  {!latest ? <div className="scope-empty">Generate a draft document before sending this contract to negotiation.</div> : null}
                </div>
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Draft Files</span><h2>Generated and uploaded documents</h2></div>
                  <StatusBadge value={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
                </div>
                {documents.length ? (
                  <SimpleTable headers={['Document', 'Type', 'Action']}>
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td><strong>{document.name}</strong><span>{document.sourceLabel}</span></td>
                        <td>{document.documentType}</td>
                        <td>
                          <div className="inline-actions">
                            <a className="btn btn-secondary btn-sm" href={document.contentUrl} target="_blank" rel="noreferrer">Open</a>
                            <a className="btn btn-secondary btn-sm" href={document.contentUrl} download>Download</a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </SimpleTable>
                ) : <div className="scope-empty">No generated draft document is linked yet.</div>}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
