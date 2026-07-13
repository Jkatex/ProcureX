import { useEffect, useMemo, useState } from 'react';
import { adminApi, type ComplianceCase, type ComplianceRule, type PageDto, type WorkflowRecord } from '@/features/admin/api';
import { ActionFormPanel, option, recordPickerOptions, riskLevelOptions, trustTierOptions } from '@/features/awardsContracts/components/procurex/AwardContractActionForms';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminCommandDrawer, AdminError, AdminHero, AdminPanel, AdminShell, EmptyRow, Pager, badgeClass, displayLabel, formatDate, useAdminCommand } from './AdminShared';

const caseStatuses = ['OPEN', 'INVESTIGATION', 'FALSE_POSITIVE', 'RESOLVED', 'ESCALATED'];
const severities = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
const complianceStatusOptions = caseStatuses.map((status) => option(status));
const severityOptions = severities.map((severity) => option(severity));
const workflowStatusOptions = ['OPEN', 'PENDING', 'SUBMITTED', 'INVESTIGATION', 'APPROVED', 'REJECTED', 'RESOLVED', 'ESCALATED', 'CLOSED'].map((status) => option(status));

function recordText(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key];
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function workflowOptions(items: WorkflowRecord[], emptyLabel: string) {
  return recordPickerOptions(items as unknown as Array<Record<string, unknown>>, emptyLabel);
}

function WorkflowRegister({ title, items }: { title: string; items: WorkflowRecord[] }) {
  if (/supplier risk/i.test(title)) {
    return (
      <div className="data-table evaluation-table-scroll admin-data-table">
        <table>
          <thead>
            <tr>
              <th>Supplier profile</th>
              <th>Risk</th>
              <th>Trust</th>
              <th>Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{recordText(item, 'summary', 'Supplier risk profile')}</strong><em>Score {recordText(item, 'riskScore', '50')} / Alerts {recordText(item, 'activeAlerts', '0')} / Violations {recordText(item, 'openViolations', '0')}</em></td>
                <td><span className={badgeClass(recordText(item, 'riskLevel', 'MEDIUM'))}>{displayLabel(recordText(item, 'riskLevel', 'MEDIUM'))}</span></td>
                <td><span className={badgeClass(recordText(item, 'trustTier', 'UNVERIFIED'))}>{displayLabel(recordText(item, 'trustTier', 'UNVERIFIED'))}</span></td>
                <td>{item.updatedAt ? formatDate(item.updatedAt) : item.createdAt ? formatDate(item.createdAt) : '-'}</td>
              </tr>
            ))}
            {items.length === 0 ? <EmptyRow colSpan={4} label="No supplier risk profiles found." /> : null}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="data-table evaluation-table-scroll admin-data-table">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Status</th>
            <th>Severity</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><strong>{recordText(item, 'title', recordText(item, 'reviewType', recordText(item, 'alertType', recordText(item, 'enforcementType', item.id))))}</strong><em>{recordText(item, 'summary', recordText(item, 'statement', recordText(item, 'signalSummary', 'No summary')))}</em></td>
              <td><span className={badgeClass(recordText(item, 'status', 'RECORDED'))}>{displayLabel(recordText(item, 'status', 'RECORDED'))}</span></td>
              <td><span className={badgeClass(recordText(item, 'severity', 'INFO'))}>{displayLabel(recordText(item, 'severity', 'INFO'))}</span></td>
              <td>{item.createdAt ? formatDate(item.createdAt) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 ? <EmptyRow colSpan={4} label={`No ${title.toLowerCase()} records found.`} /> : null}
        </tbody>
      </table>
    </div>
  );
}

export function AdminComplianceProcurexPage() {
  const [cases, setCases] = useState<PageDto<ComplianceCase> | null>(null);
  const [rules, setRules] = useState<PageDto<ComplianceRule> | null>(null);
  const [reviews, setReviews] = useState<PageDto<WorkflowRecord> | null>(null);
  const [violations, setViolations] = useState<PageDto<WorkflowRecord> | null>(null);
  const [enforcements, setEnforcements] = useState<PageDto<WorkflowRecord> | null>(null);
  const [appeals, setAppeals] = useState<PageDto<WorkflowRecord> | null>(null);
  const [collusionAlerts, setCollusionAlerts] = useState<PageDto<WorkflowRecord> | null>(null);
  const [supplierRiskProfiles, setSupplierRiskProfiles] = useState<PageDto<WorkflowRecord> | null>(null);
  const [casePage, setCasePage] = useState(1);
  const [rulePage, setRulePage] = useState(1);
  const [caseStatus, setCaseStatus] = useState('');
  const [ruleStatus, setRuleStatus] = useState('');
  const [ruleDraft, setRuleDraft] = useState({ code: '', title: '', severity: 'WARNING', status: 'ACTIVE', description: '' });
  const [thresholdDraft, setThresholdDraft] = useState({ method: 'OPEN_TENDER', ceiling: '50000000', biddingDays: '21', approvals: 'Procurement committee' });
  const [checklistDraft, setChecklistDraft] = useState({ title: 'Conflict of interest declaration', stage: 'EVALUATION' });
  const [standstillDays, setStandstillDays] = useState('7');
  const [alertDraft, setAlertDraft] = useState({ event: 'High risk supplier screening', enabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { command, openCommand, closeCommand } = useAdminCommand();

  useBodyPageMetadata('admin-compliance');

  const openCases = useMemo(() => (cases?.items ?? []).filter((item) => ['OPEN', 'INVESTIGATION', 'ESCALATED'].includes(item.status)).length, [cases]);

  async function load(nextCasePage = casePage, nextRulePage = rulePage) {
    setLoading(true);
    setError(null);
    try {
      const [caseResponse, ruleResponse] = await Promise.all([
        adminApi.listComplianceCases({ status: caseStatus || undefined, page: nextCasePage, pageSize: 10 }),
        adminApi.listComplianceRules({ status: ruleStatus || undefined, page: nextRulePage, pageSize: 10 })
      ]);
      const [reviewResponse, violationResponse, enforcementResponse, appealResponse, collusionResponse, supplierRiskResponse] = await Promise.all([
        adminApi.complianceReviews({ page: 1, pageSize: 8 }),
        adminApi.violationCases({ page: 1, pageSize: 8 }),
        adminApi.enforcementRecords({ page: 1, pageSize: 8 }),
        adminApi.appealRecords({ page: 1, pageSize: 8 }),
        adminApi.collusionAlerts({ page: 1, pageSize: 8 }),
        adminApi.supplierRiskProfiles({ page: 1, pageSize: 8 })
      ]);
      setCases(caseResponse);
      setRules(ruleResponse);
      setReviews(reviewResponse);
      setViolations(violationResponse);
      setEnforcements(enforcementResponse);
      setAppeals(appealResponse);
      setCollusionAlerts(collusionResponse);
      setSupplierRiskProfiles(supplierRiskResponse);
      setCasePage(nextCasePage);
      setRulePage(nextRulePage);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, 1);
  }, []);

  async function updateCaseStatus(item: ComplianceCase, status: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.updateComplianceCase(item.id, { status });
      setCases((current) => current ? { ...current, items: current.items.map((row) => (row.id === updated.id ? updated : row)) } : current);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  function openCaseStatus(item: ComplianceCase, status: string) {
    openCommand({
      title: `${displayLabel(status)} case`,
      summary: `Update ${item.title} from ${displayLabel(item.status)} to ${displayLabel(status)}.`,
      confirmLabel: 'Update Case',
      dangerous: ['ESCALATED', 'INVESTIGATION'].includes(status),
      run: async () => updateCaseStatus(item, status)
    });
  }

  async function saveRule() {
    setSaving(true);
    setError(null);
    try {
      await adminApi.createComplianceRule({
        code: ruleDraft.code.trim(),
        title: ruleDraft.title.trim(),
        severity: ruleDraft.severity,
        status: ruleDraft.status,
        description: ruleDraft.description.trim() || null,
        condition: {}
      });
      setRuleDraft({ code: '', title: '', severity: 'WARNING', status: 'ACTIVE', description: '' });
      await load(casePage, 1);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(item: ComplianceRule) {
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.updateComplianceRule(item.id, { status: item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
      setRules((current) => current ? { ...current, items: current.items.map((row) => (row.id === updated.id ? updated : row)) } : current);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  function openRuleToggle(item: ComplianceRule) {
    openCommand({
      title: `${item.status === 'ACTIVE' ? 'Disable' : 'Enable'} ${item.code}`,
      summary: `${item.title} will be ${item.status === 'ACTIVE' ? 'disabled' : 'enabled'} and audited.`,
      confirmLabel: item.status === 'ACTIVE' ? 'Disable Rule' : 'Enable Rule',
      dangerous: item.status === 'ACTIVE',
      run: async () => toggleRule(item)
    });
  }

  async function createSetting(kind: string, title: string, payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await adminApi.createComplianceRule({
        code: `SETTINGS.${kind}.${Date.now()}`,
        title,
        severity: kind === 'ALERT' ? 'WARNING' : 'INFO',
        status: payload.enabled === false ? 'DISABLED' : 'ACTIVE',
        description: `${displayLabel(kind)} setting managed from admin compliance controls.`,
        condition: { kind },
        payload: { kind, ...payload }
      });
      await load(casePage, 1);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell currentPath="/admin/compliance" title="Admin Compliance">
      <AdminHero
        badge={loading ? 'Loading' : `${openCases} open`}
        heading="Compliance Rules"
        body="Review compliance cases, maintain platform rules, and record admin decisions against live compliance data."
        actions={<button className="btn btn-primary" type="button" disabled={loading || saving} onClick={() => void load(1, 1)}>Refresh</button>}
      />

      {error ? <AdminError error={error} title="Compliance data could not load" /> : null}

      <section className="journey-grid two-column">
        <AdminPanel kicker="Cases" title="Compliance case queue" badge={`${cases?.total ?? 0} total`}>
          <div className="admin-filter-bar">
            <select className="form-input" value={caseStatus} onChange={(event) => setCaseStatus(event.target.value)}>
              <option value="">All case statuses</option>
              {caseStatuses.map((status) => <option value={status} key={status}>{displayLabel(status)}</option>)}
            </select>
            <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void load(1, rulePage)}>
              Apply
            </button>
          </div>
          <div className="data-table evaluation-table-scroll admin-data-table">
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {(cases?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong><em>{item.ownerOrg?.name ?? 'Platform case'}</em></td>
                    <td><span className={badgeClass(item.severity)}>{displayLabel(item.severity)}</span></td>
                    <td><span className={badgeClass(item.status)}>{displayLabel(item.status)}</span></td>
                    <td>{item.owner ?? 'Unassigned'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <select className="form-input" value={item.status} disabled={saving} onChange={(event) => openCaseStatus(item, event.target.value)}>
                        {caseStatuses.map((status) => <option value={status} key={status}>{displayLabel(status)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {!cases?.items.length ? <EmptyRow colSpan={6} label={loading ? 'Loading cases.' : 'No compliance cases found.'} /> : null}
              </tbody>
            </table>
          </div>
          <Pager page={casePage} total={cases?.total ?? 0} pageSize={cases?.pageSize ?? 10} onPage={(next) => void load(next, rulePage)} />
        </AdminPanel>

        <AdminPanel kicker="Rules" title="Create compliance rule" badge={saving ? 'Saving' : 'Ready'}>
          <div className="admin-settings-grid">
            <label className="form-group">
              <span className="form-label">Rule code</span>
              <input className="form-input" value={ruleDraft.code} onChange={(event) => setRuleDraft((draft) => ({ ...draft, code: event.target.value.toUpperCase() }))} placeholder="KYC.DUPLICATE_REGISTRY" />
            </label>
            <label className="form-group">
              <span className="form-label">Title</span>
              <input className="form-input" value={ruleDraft.title} onChange={(event) => setRuleDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Duplicate registry number" />
            </label>
            <label className="form-group">
              <span className="form-label">Description</span>
              <textarea className="form-input" rows={3} value={ruleDraft.description} onChange={(event) => setRuleDraft((draft) => ({ ...draft, description: event.target.value }))} />
            </label>
            <div className="admin-filter-bar">
              <select className="form-input" value={ruleDraft.severity} onChange={(event) => setRuleDraft((draft) => ({ ...draft, severity: event.target.value }))}>
                {severities.map((severity) => <option value={severity} key={severity}>{displayLabel(severity)}</option>)}
              </select>
              <select className="form-input" value={ruleDraft.status} onChange={(event) => setRuleDraft((draft) => ({ ...draft, status: event.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
              <button className="btn btn-primary" type="button" disabled={saving || !ruleDraft.code.trim() || !ruleDraft.title.trim()} onClick={() => void saveRule()}>
                Create Rule
              </button>
            </div>
          </div>
        </AdminPanel>
      </section>

      <section className="journey-grid two-column">
        <AdminPanel kicker="Settings" title="Procurement method limits" badge="Live rules">
          <div className="admin-settings-grid">
            <label className="form-group">
              <span className="form-label">Method</span>
              <select className="form-input" value={thresholdDraft.method} onChange={(event) => setThresholdDraft((draft) => ({ ...draft, method: event.target.value }))}>
                <option value="OPEN_TENDER">Open tender</option>
                <option value="INVITED_TENDER">Invited tender</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Budget ceiling</span>
              <input className="form-input" type="number" value={thresholdDraft.ceiling} onChange={(event) => setThresholdDraft((draft) => ({ ...draft, ceiling: event.target.value }))} />
            </label>
            <label className="form-group">
              <span className="form-label">Minimum bidding days</span>
              <input className="form-input" type="number" value={thresholdDraft.biddingDays} onChange={(event) => setThresholdDraft((draft) => ({ ...draft, biddingDays: event.target.value }))} />
            </label>
            <label className="form-group">
              <span className="form-label">Approvals</span>
              <input className="form-input" value={thresholdDraft.approvals} onChange={(event) => setThresholdDraft((draft) => ({ ...draft, approvals: event.target.value }))} />
            </label>
            <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void createSetting('THRESHOLD', `${displayLabel(thresholdDraft.method)} limit`, thresholdDraft)}>
              Save Limit
            </button>
          </div>
        </AdminPanel>

        <AdminPanel kicker="Templates" title="Compliance checklist templates" badge="Reusable checks">
          <div className="admin-settings-grid">
            <label className="form-group">
              <span className="form-label">Checklist item</span>
              <input className="form-input" value={checklistDraft.title} onChange={(event) => setChecklistDraft((draft) => ({ ...draft, title: event.target.value }))} />
            </label>
            <label className="form-group">
              <span className="form-label">Stage</span>
              <input className="form-input" value={checklistDraft.stage} onChange={(event) => setChecklistDraft((draft) => ({ ...draft, stage: event.target.value.toUpperCase() }))} />
            </label>
            <button className="btn btn-primary" type="button" disabled={saving || !checklistDraft.title.trim()} onClick={() => void createSetting('CHECKLIST', checklistDraft.title, checklistDraft)}>
              Add Item
            </button>
          </div>
        </AdminPanel>

        <AdminPanel kicker="Standstill" title="Standstill period settings" badge={`${standstillDays} days`}>
          <div className="admin-settings-grid">
            <label className="form-group">
              <span className="form-label">Required standstill days</span>
              <input className="form-input" type="number" min="0" value={standstillDays} onChange={(event) => setStandstillDays(event.target.value)} />
            </label>
            <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void createSetting('STANDSTILL', 'Award standstill period', { days: Number(standstillDays) })}>
              Save Standstill
            </button>
          </div>
        </AdminPanel>

        <AdminPanel kicker="Alerts" title="Admin alert events" badge={alertDraft.enabled ? 'Enabled' : 'Disabled'}>
          <div className="admin-settings-grid">
            <label className="form-group">
              <span className="form-label">Event</span>
              <input className="form-input" value={alertDraft.event} onChange={(event) => setAlertDraft((draft) => ({ ...draft, event: event.target.value }))} />
            </label>
            <label className="admin-inline-toggle">
              <input type="checkbox" checked={alertDraft.enabled} onChange={(event) => setAlertDraft((draft) => ({ ...draft, enabled: event.target.checked }))} />
              <span>Enabled</span>
            </label>
            <button className="btn btn-primary" type="button" disabled={saving || !alertDraft.event.trim()} onClick={() => void createSetting('ALERT', alertDraft.event, alertDraft)}>
              Save Alert
            </button>
          </div>
        </AdminPanel>
      </section>

      <section className="journey-grid two-column">
        <AdminPanel kicker="Risk" title="Collusion alerts and supplier risk" badge={`${collusionAlerts?.total ?? 0} alerts`}>
          <div className="award-control-grid">
            <ActionFormPanel
              title="Collusion alert"
              badge="Alert"
              fields={[
                { name: 'tenderId', label: 'Tender ID', kind: 'uuid' },
                { name: 'bidId', label: 'Bid ID', kind: 'uuid' },
                { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid' },
                { name: 'alertType', label: 'Alert type', kind: 'text', required: true },
                { name: 'severity', label: 'Severity', kind: 'select', options: severityOptions },
                { name: 'status', label: 'Status', kind: 'select', options: workflowStatusOptions },
                { name: 'confidence', label: 'Confidence', kind: 'number', min: 0, max: 100 },
                { name: 'signalSummary', label: 'Signal summary', kind: 'textarea' },
                { name: 'assignedUserId', label: 'Assigned user ID', kind: 'uuid' },
                { name: 'resolvedAt', label: 'Resolved at', kind: 'datetime' },
                { name: 'payload', label: 'Alert payload', kind: 'json', rows: 4 }
              ]}
              initialValues={{ alertType: 'bid-pattern-anomaly', severity: 'WARNING', status: 'OPEN', confidence: '65', payload: '{}' }}
              onSubmit={(payload) => adminApi.createCollusionAlert(payload)}
              onComplete={() => void load(1, 1)}
            />
            <ActionFormPanel
              title="Admin supplier risk profile"
              badge="Profile"
              fields={[
                { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid', required: true },
                { name: 'riskLevel', label: 'Risk level', kind: 'select', options: riskLevelOptions },
                { name: 'riskScore', label: 'Risk score', kind: 'number', min: 0, max: 100 },
                { name: 'trustTier', label: 'Trust tier', kind: 'select', options: trustTierOptions },
                { name: 'activeAlerts', label: 'Active alerts', kind: 'number', min: 0 },
                { name: 'openViolations', label: 'Open violations', kind: 'number', min: 0 },
                { name: 'summary', label: 'Reason for change', kind: 'textarea', required: true },
                { name: 'drivers', label: 'Risk drivers', kind: 'textarea', rows: 4, transform: 'driverArray', helpText: 'Enter one driver per line.' },
                { name: 'payload', label: 'Advanced payload', kind: 'json', rows: 4, advanced: true }
              ]}
              initialValues={{ riskLevel: 'MEDIUM', riskScore: '50', trustTier: 'UNVERIFIED', activeAlerts: '0', openViolations: '0', summary: 'Risk profile reviewed by compliance admin.', drivers: '', payload: '{}' }}
              onSubmit={(payload) => adminApi.upsertSupplierRiskProfile(payload)}
              onComplete={() => void load(1, 1)}
            />
          </div>
          <WorkflowRegister title="Collusion alerts" items={collusionAlerts?.items ?? []} />
          <WorkflowRegister title="Supplier risk profiles" items={supplierRiskProfiles?.items ?? []} />
        </AdminPanel>

        <AdminPanel kicker="Reviews" title="Compliance reviews and violations" badge={`${reviews?.total ?? 0} reviews`}>
          <div className="award-control-grid">
            <ActionFormPanel
              title="Compliance review"
              badge="Review"
              fields={[
                { name: 'ownerOrgId', label: 'Owner organization ID', kind: 'uuid' },
                { name: 'entityType', label: 'Entity type', kind: 'text', required: true },
                { name: 'entityRef', label: 'Entity reference', kind: 'text' },
                { name: 'reviewType', label: 'Review type', kind: 'text', required: true },
                { name: 'status', label: 'Status', kind: 'select', options: complianceStatusOptions },
                { name: 'severity', label: 'Severity', kind: 'select', options: severityOptions },
                { name: 'assignedUserId', label: 'Assigned user ID', kind: 'uuid' },
                { name: 'findings', label: 'Findings', kind: 'textarea' },
                { name: 'decision', label: 'Decision', kind: 'textarea' },
                { name: 'dueDate', label: 'Due date', kind: 'date' },
                { name: 'completedAt', label: 'Completed at', kind: 'datetime' },
                { name: 'payload', label: 'Review payload', kind: 'json', rows: 4 }
              ]}
              initialValues={{ entityType: 'supplier', reviewType: 'risk-review', status: 'OPEN', severity: 'WARNING', payload: '{}' }}
              onSubmit={(payload) => adminApi.createComplianceReview(payload)}
              onComplete={() => void load(1, 1)}
            />
            <ActionFormPanel
              title="Violation case"
              badge="Violation"
              fields={[
                { name: 'reviewId', label: 'Review', kind: 'select', options: workflowOptions(reviews?.items ?? [], 'No linked review') },
                { name: 'ownerOrgId', label: 'Owner organization ID', kind: 'uuid' },
                { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid' },
                { name: 'title', label: 'Title', kind: 'text', required: true },
                { name: 'violationType', label: 'Violation type', kind: 'text', required: true },
                { name: 'severity', label: 'Severity', kind: 'select', options: severityOptions },
                { name: 'status', label: 'Status', kind: 'select', options: complianceStatusOptions },
                { name: 'statement', label: 'Statement', kind: 'textarea' },
                { name: 'assignedUserId', label: 'Assigned user ID', kind: 'uuid' },
                { name: 'decision', label: 'Decision', kind: 'textarea' },
                { name: 'decidedAt', label: 'Decided at', kind: 'datetime' },
                { name: 'payload', label: 'Violation payload', kind: 'json', rows: 4 }
              ]}
              initialValues={{ reviewId: reviews?.items[0]?.id ?? '', title: 'Supplier compliance violation', violationType: 'non-compliance', severity: 'WARNING', status: 'OPEN', payload: '{}' }}
              onSubmit={(payload) => adminApi.createViolationCase(payload)}
              onComplete={() => void load(1, 1)}
            />
            <ActionFormPanel
              title="Violation evidence"
              badge="Evidence"
              fields={[
                { name: 'violationId', label: 'Violation', kind: 'select', required: true, options: workflowOptions(violations?.items ?? [], 'Select violation') },
                { name: 'documentId', label: 'Document ID', kind: 'uuid' },
                { name: 'evidenceType', label: 'Evidence type', kind: 'text', required: true },
                { name: 'description', label: 'Description', kind: 'textarea' },
                { name: 'payload', label: 'Evidence payload', kind: 'json', rows: 4 }
              ]}
              initialValues={{ violationId: violations?.items[0]?.id ?? '', evidenceType: 'documentary', payload: '{}' }}
              onSubmit={(payload) => adminApi.createViolationEvidence(payload)}
              onComplete={() => void load(1, 1)}
            />
          </div>
          <WorkflowRegister title="Compliance reviews" items={reviews?.items ?? []} />
          <WorkflowRegister title="Violation cases" items={violations?.items ?? []} />
        </AdminPanel>
      </section>

      <section className="journey-grid two-column">
        <AdminPanel kicker="Enforcement" title="Enforcement actions" badge={`${enforcements?.total ?? 0} records`}>
          <div className="award-control-grid">
            <ActionFormPanel
              title="Enforcement record"
              badge="Enforce"
              fields={[
                { name: 'violationId', label: 'Violation', kind: 'select', options: workflowOptions(violations?.items ?? [], 'No linked violation') },
                { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid' },
                { name: 'enforcementType', label: 'Enforcement type', kind: 'text', required: true },
                { name: 'status', label: 'Status', kind: 'select', options: workflowStatusOptions },
                { name: 'severity', label: 'Severity', kind: 'select', options: severityOptions },
                { name: 'effectiveFrom', label: 'Effective from', kind: 'datetime' },
                { name: 'effectiveTo', label: 'Effective to', kind: 'datetime' },
                { name: 'actionSummary', label: 'Action summary', kind: 'textarea' },
                { name: 'payload', label: 'Enforcement payload', kind: 'json', rows: 4 }
              ]}
              initialValues={{ violationId: violations?.items[0]?.id ?? '', enforcementType: 'warning', status: 'PENDING', severity: 'WARNING', payload: '{}' }}
              onSubmit={(payload) => adminApi.createEnforcementRecord(payload)}
              onComplete={() => void load(1, 1)}
            />
            <ActionFormPanel
              title="Appeal record"
              badge="Appeal"
              fields={[
                { name: 'enforcementId', label: 'Enforcement', kind: 'select', options: workflowOptions(enforcements?.items ?? [], 'No linked enforcement') },
                { name: 'violationId', label: 'Violation', kind: 'select', options: workflowOptions(violations?.items ?? [], 'No linked violation') },
                { name: 'appellantOrgId', label: 'Appellant organization ID', kind: 'uuid' },
                { name: 'appealGrounds', label: 'Appeal grounds', kind: 'textarea', required: true },
                { name: 'status', label: 'Status', kind: 'select', options: workflowStatusOptions },
                { name: 'decision', label: 'Decision', kind: 'textarea' },
                { name: 'decidedAt', label: 'Decided at', kind: 'datetime' },
                { name: 'payload', label: 'Appeal payload', kind: 'json', rows: 4 }
              ]}
              initialValues={{ enforcementId: enforcements?.items[0]?.id ?? '', violationId: violations?.items[0]?.id ?? '', appealGrounds: 'Supplier appeal grounds', status: 'SUBMITTED', payload: '{}' }}
              onSubmit={(payload) => adminApi.createAppealRecord(payload)}
              onComplete={() => void load(1, 1)}
            />
          </div>
          <WorkflowRegister title="Enforcement records" items={enforcements?.items ?? []} />
          <WorkflowRegister title="Appeals" items={appeals?.items ?? []} />
        </AdminPanel>

        <AdminPanel kicker="Audit linkage" title="Workflow oversight" badge="Audit-ready">
          <WorkflowRegister title="Open workflow reviews" items={[...(reviews?.items ?? []), ...(collusionAlerts?.items ?? []), ...(violations?.items ?? [])]} />
        </AdminPanel>
      </section>

      <AdminPanel kicker="Rules register" title="Compliance rules" badge={`${rules?.total ?? 0} rules`}>
        <div className="admin-filter-bar">
          <select className="form-input" value={ruleStatus} onChange={(event) => setRuleStatus(event.target.value)}>
            <option value="">All rule statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
          <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => void load(casePage, 1)}>
            Apply
          </button>
        </div>
        <div className="admin-rule-list">
          {(rules?.items ?? []).map((rule) => (
            <article key={rule.id}>
              <div>
                <span className={badgeClass(rule.severity)}>{displayLabel(rule.severity)}</span>
                <strong>{rule.code} / {rule.title}</strong>
                <em>{rule.description ?? 'No description'}</em>
              </div>
              <div className="admin-table-actions">
                <span className={badgeClass(rule.status)}>{displayLabel(rule.status)}</span>
                <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => openRuleToggle(rule)}>
                  {rule.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </article>
          ))}
          {!rules?.items.length ? <article><strong>No compliance rules</strong><em>Create a rule to begin the register.</em></article> : null}
        </div>
        <Pager page={rulePage} total={rules?.total ?? 0} pageSize={rules?.pageSize ?? 10} onPage={(next) => void load(casePage, next)} />
      </AdminPanel>
      <AdminCommandDrawer command={command} onClose={closeCommand} />
    </AdminShell>
  );
}
