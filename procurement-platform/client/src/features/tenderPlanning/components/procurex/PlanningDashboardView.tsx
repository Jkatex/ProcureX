import type { ChangeEvent, RefObject } from 'react';
import { procurementPlanningDefaultColumns } from '../../data';
import type { ProcurementPlanningRecord } from '../../types';
import {
  formatProcurementPlanningDate,
  formatProcurementPlanningMoney,
  getPlanningSummary,
  getProcurementPlanningBadgeClass,
  getProcurementPlanningStatusMeta
} from '../../utils';
import { PlanningActionIcon } from './icons';

type PlanningDashboardViewProps = {
  hidden: boolean;
  records: ProcurementPlanningRecord[];
  selectedYear: string;
  years: string[];
  uploadInputRef: RefObject<HTMLInputElement | null>;
  onCreatePlan: () => void;
  onUploadPlan: () => void;
  onDownloadTemplate: () => void;
  onViewFullPlan: () => void;
  onDownloadPlan: () => void;
  onYearChange: (year: string) => void;
  onDetails: (recordId: string) => void;
  onPlanTender: (recordId: string) => void;
  onStatusNavigate: (page: string) => void;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

type PlanningRouteViewProps = {
  hidden: boolean;
  records: ProcurementPlanningRecord[];
  selectedYear: string;
};

type PlanningDetailViewProps = {
  hidden: boolean;
  record?: ProcurementPlanningRecord;
};

export function PlanningDashboardView({
  hidden,
  records,
  selectedYear,
  years,
  uploadInputRef,
  onCreatePlan,
  onUploadPlan,
  onDownloadTemplate,
  onViewFullPlan,
  onDownloadPlan,
  onYearChange,
  onDetails,
  onPlanTender,
  onStatusNavigate,
  onUploadChange
}: PlanningDashboardViewProps) {
  const hasRecords = records.length > 0;
  const yearOptions = years.length ? years : [selectedYear];

  return (
    <div data-planning-front hidden={hidden}>
      <section className="planning-dashboard-header app-planning-hero" id="planning-dashboard">
        <div>
          <span className="section-kicker">Annual Procurement Plan</span>
          <h1>Procurement Planning</h1>
          <p>
            Create, upload, view, and download procurement plans. Use the Plan action to finish tender requirements before
            publication.
          </p>
          <div className="inline-actions planning-primary-actions">
            <button className="btn btn-primary planning-action-button" type="button" data-planning-mode="create" onClick={onCreatePlan}>
              <PlanningActionIcon kind="create" />
              <span>Create Plan</span>
            </button>
            <button className="btn btn-secondary planning-action-button" type="button" data-planning-mode="upload" onClick={onUploadPlan}>
              <PlanningActionIcon kind="upload" />
              <span>Upload Plan</span>
            </button>
            <button className="btn btn-secondary planning-action-button" type="button" data-plan-template-download onClick={onDownloadTemplate}>
              <PlanningActionIcon kind="download" />
              <span>Download Template</span>
            </button>
          </div>
        </div>
        <article className="planning-readiness-summary">
          <span>Current year</span>
          <strong data-planning-current-year>{selectedYear}</strong>
        </article>
      </section>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xls,.xlsx,.csv"
        data-plan-upload-input
        aria-label="Upload annual procurement plan Excel file"
        hidden
        onChange={onUploadChange}
      />

      {!hasRecords ? (
        <section className="procurex-empty-guidance planning-first-run">
          <div className="procurex-empty-icon" aria-hidden="true">
            <PlanningActionIcon kind="create" />
          </div>
          <div>
            <span className="section-kicker">First plan setup</span>
            <h2>Your procurement plan will appear here once you create or upload it.</h2>
            <p>
              Begin by creating the annual procurement plan worksheet, or upload an approved spreadsheet from your team.
              ProcureX will keep this page focused on your own plan lines after that.
            </p>
          </div>
          <div className="procurex-empty-actions">
            <button className="btn btn-primary planning-action-button" type="button" onClick={onCreatePlan}>
              <PlanningActionIcon kind="create" />
              <span>Create Plan</span>
            </button>
            <button className="btn btn-secondary planning-action-button" type="button" onClick={onUploadPlan}>
              <PlanningActionIcon kind="upload" />
              <span>Upload Plan</span>
            </button>
          </div>
        </section>
      ) : null}

      <PlanningSummary records={records} selectedYear={selectedYear} />

      <section className="procurement-panel evaluation-panel planning-control-panel" id="planning-register">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Plan by year</span>
            <h2>Quick procurement plan view</h2>
            <p className="panel-note">The front table shows essential columns only. Use View Plan for the full worksheet.</p>
          </div>
          <div className="planning-register-actions">
            <label className="planning-field planning-year-filter">
              <span>Filter Year</span>
              <select className="form-input" data-planning-year-filter value={selectedYear} onChange={(event) => onYearChange(event.target.value)}>
                {yearOptions.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary btn-sm" type="button" data-plan-view-full onClick={onViewFullPlan}>
              <PlanningActionIcon kind="view" />
              <span>View Plan</span>
            </button>
            <button className="btn btn-secondary btn-sm" type="button" data-plan-download onClick={onDownloadPlan} disabled={!hasRecords}>
              <PlanningActionIcon kind="download" />
              <span>Download Plan</span>
            </button>
          </div>
        </div>
        <div data-planning-year-table>
          <PlanningRecordsTable
            records={records}
            selectedYear={selectedYear}
            onDetails={onDetails}
            onPlanTender={onPlanTender}
            onStatusNavigate={onStatusNavigate}
          />
        </div>
      </section>
    </div>
  );
}

function PlanningSummary({ records, selectedYear }: Pick<PlanningDashboardViewProps, 'records' | 'selectedYear'>) {
  return (
    <section className="planning-kpi-grid app-planning-kpis" data-planning-summary aria-label="Procurement planning summary">
      {getPlanningSummary(records, selectedYear).map(([label, value, note, tone]) => (
        <article className={`planning-kpi-card ${tone}`} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <em>{note}</em>
        </article>
      ))}
    </section>
  );
}

function PlanningRecordsTable({
  records,
  selectedYear,
  onDetails,
  onPlanTender,
  onStatusNavigate
}: Pick<PlanningDashboardViewProps, 'records' | 'selectedYear' | 'onDetails' | 'onPlanTender' | 'onStatusNavigate'>) {
  const yearRecords = records.filter((record) => record.financialYear === selectedYear);

  return (
    <div className="data-table planning-records-table procurement-plan-table procurement-plan-quick-table">
      <table>
        <thead>
          <tr>
            <th>Tender</th>
            <th>Opening</th>
            <th>Closing</th>
            <th>Category</th>
            <th>Budget</th>
            <th>Method</th>
            <th>Status</th>
            <th>Description</th>
            <th>Plan</th>
          </tr>
        </thead>
        <tbody data-planning-table-body>
          {yearRecords.length ? (
            yearRecords.map((record) => (
              <PlanningRecordRow
                key={record.id}
                record={record}
                onDetails={onDetails}
                onPlanTender={onPlanTender}
                onStatusNavigate={onStatusNavigate}
              />
            ))
          ) : (
            <tr>
              <td colSpan={9} className="planning-empty-row">
                <strong>No plan lines yet.</strong>
                <span>Create a plan or upload a spreadsheet to start building this year's procurement schedule.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PlanningRecordRow({
  record,
  onDetails,
  onPlanTender,
  onStatusNavigate
}: {
  record: ProcurementPlanningRecord;
  onDetails: (recordId: string) => void;
  onPlanTender: (recordId: string) => void;
  onStatusNavigate: (page: string) => void;
}) {
  const done = /done|finished/i.test(`${record.planState} ${record.status}`);
  const meta = getProcurementPlanningStatusMeta(record.status);
  const actionLabel = done ? 'View' : record.planState === 'Not started' ? 'Plan' : 'Amend';

  return (
    <tr data-financial-year={record.financialYear}>
      <td>
        <strong>{record.tenderTitle}</strong>
        <span>{record.sourceOfFunds}</span>
      </td>
      <td>{formatProcurementPlanningDate(record.openingDate)}</td>
      <td>{formatProcurementPlanningDate(record.closingDate)}</td>
      <td>{record.category}</td>
      <td>{formatProcurementPlanningMoney(record.budget)}</td>
      <td>{record.procurementMethod}</td>
      <td>
        <PlanningStatusCell record={record} onStatusNavigate={onStatusNavigate} />
      </td>
      <td>{meta.description || record.notes || ''}</td>
      <td>
        <div className="planning-table-actions">
          <button className="btn btn-primary btn-sm" type="button" data-plan-tender={record.id} onClick={() => onPlanTender(record.id)}>
            {actionLabel}
          </button>
          <button className="btn btn-secondary btn-sm" type="button" data-plan-details={record.id} onClick={() => onDetails(record.id)}>
            Details
          </button>
        </div>
      </td>
    </tr>
  );
}

function PlanningStatusCell({
  record,
  onStatusNavigate
}: {
  record: ProcurementPlanningRecord;
  onStatusNavigate: (page: string) => void;
}) {
  const meta = getProcurementPlanningStatusMeta(record.status);
  const label = meta.label || record.status;
  const badgeClass = /^not open$/i.test(label) ? 'badge-info' : getProcurementPlanningBadgeClass(record.status);

  if (!meta.page || /^not open$/i.test(label)) {
    return <span className={`planning-status-label ${badgeClass}`}>{label}</span>;
  }

  return (
    <button
      className={`btn btn-secondary btn-sm planning-status-button ${getProcurementPlanningBadgeClass(record.status)}`}
      type="button"
      data-status-navigate={meta.page}
      onClick={() => onStatusNavigate(meta.page)}
    >
      {label}
    </button>
  );
}

export function PlanningFullPlanView({ hidden, records, selectedYear }: PlanningRouteViewProps) {
  const yearRecords = records.filter((record) => record.financialYear === selectedYear);

  return (
    <div data-planning-full-slot>
      <section className="procurement-panel evaluation-panel planning-full-plan planning-route-page" data-plan-full-view hidden={hidden}>
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Full plan</span>
            <h2>{selectedYear} annual procurement plan</h2>
          </div>
        </div>
        <div className="data-table procurement-plan-create-table">
          <table className="procurement-plan-full-table">
            <thead>
              <tr>
                {procurementPlanningDefaultColumns.map((column) => (
                  <th key={column.id} data-plan-column={column.id}>
                    {column.label}
                  </th>
                ))}
                <th data-plan-column="status">Status</th>
                <th data-plan-column="planState">Plan State</th>
                <th data-plan-column="notes">Notes</th>
              </tr>
            </thead>
            <tbody>
              {yearRecords.length ? (
                yearRecords.map((record) => (
                  <tr key={record.id}>
                    {procurementPlanningDefaultColumns.map((column) => (
                      <td key={column.id} data-plan-column={column.id}>
                        {formatPlanColumn(record, column.id)}
                      </td>
                    ))}
                    <td data-plan-column="status">{record.status}</td>
                    <td data-plan-column="planState">{record.planState}</td>
                    <td data-plan-column="notes">{record.notes || ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="planning-empty-row">
                    <strong>No records yet.</strong>
                    <span>Create or upload a procurement plan before viewing the full worksheet.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatPlanColumn(record: ProcurementPlanningRecord, columnId: string) {
  const value = record[columnId as keyof ProcurementPlanningRecord];
  if (columnId === 'budget') return formatProcurementPlanningMoney(record.budget);
  if (columnId === 'openingDate' || columnId === 'closingDate' || columnId === 'expectedCompletionDate') {
    return formatProcurementPlanningDate(String(value || ''));
  }
  return String(value || '');
}

export function PlanningDetailView({ hidden, record }: PlanningDetailViewProps) {
  return (
    <div data-planning-detail-slot>
      <section className="procurement-panel evaluation-panel planning-route-page planning-detail-page" data-plan-detail-view hidden={hidden}>
        <div data-plan-detail-content>
          {record ? (
            <div className="procurement-plan-drawer-content">
              <span className="section-kicker">{record.financialYear}</span>
              <h2 id="plan-drawer-title">{record.tenderTitle}</h2>
              <div className="procurement-plan-drawer-status">
                <span className={`badge ${getProcurementPlanningBadgeClass(record.status)}`}>{record.status}</span>
                <span className="planning-readiness-pill">{record.planState}</span>
              </div>
              <section>
                <h3>Plan Details</h3>
                <div className="planning-detail-grid procurement-plan-detail-grid">
                  <div>
                    <span>Opening Date</span>
                    <strong>{formatProcurementPlanningDate(record.openingDate)}</strong>
                  </div>
                  <div>
                    <span>Closing Date</span>
                    <strong>{formatProcurementPlanningDate(record.closingDate)}</strong>
                  </div>
                  <div>
                    <span>Category</span>
                    <strong>{record.category}</strong>
                  </div>
                  <div>
                    <span>Budget</span>
                    <strong>{formatProcurementPlanningMoney(record.budget)}</strong>
                  </div>
                  <div>
                    <span>Method</span>
                    <strong>{record.procurementMethod}</strong>
                  </div>
                  <div>
                    <span>Source of Funds</span>
                    <strong>{record.sourceOfFunds}</strong>
                  </div>
                  <div>
                    <span>Expected Completion</span>
                    <strong>{formatProcurementPlanningDate(record.expectedCompletionDate)}</strong>
                  </div>
                  <div>
                    <span>Notes</span>
                    <strong>{record.notes || 'No additional notes captured.'}</strong>
                  </div>
                </div>
              </section>
              <section>
                <h3>Notes</h3>
                <div className="procurement-plan-drawer-list">
                  <div>
                    <span>Description</span>
                    <strong>{record.notes || 'No additional notes captured.'}</strong>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
