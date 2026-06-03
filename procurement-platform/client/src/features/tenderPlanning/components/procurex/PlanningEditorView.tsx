import { FormEvent, useEffect, useMemo, useState } from 'react';
import { procurementPlanningCreateColumns, procurementPlanningDefaultColumns } from '../../data';
import type { PlanningEditorRow, ProcurementPlanningColumn, ProcurementPlanningRecord } from '../../types';
import { normalizeEditorRecord } from '../../utils';

type PlanningEditorViewProps = {
  hidden: boolean;
  selectedYear: string;
  onSave: (financialYear: string, records: ProcurementPlanningRecord[]) => void;
};

function createInitialRows(): PlanningEditorRow[] {
  return [0, 1, 2].map((index) => ({
    id: `editor-row-${index}`,
    values: {}
  }));
}

function columnWithFallback(columnId: string, label?: string): ProcurementPlanningColumn {
  return (
    procurementPlanningDefaultColumns.find((column) => column.id === columnId) || {
      id: columnId,
      label: label || 'New Column',
      type: 'text',
      custom: true
    }
  );
}

export function PlanningEditorView({ hidden, selectedYear, onSave }: PlanningEditorViewProps) {
  const [financialYear, setFinancialYear] = useState(selectedYear);
  const [columns, setColumns] = useState<ProcurementPlanningColumn[]>(procurementPlanningCreateColumns);
  const [rows, setRows] = useState<PlanningEditorRow[]>(createInitialRows);
  const [status, setStatus] = useState('');
  const [statusSuccess, setStatusSuccess] = useState(false);

  const visibleColumns = useMemo(() => columns.filter(Boolean), [columns]);

  useEffect(() => {
    setFinancialYear(selectedYear);
  }, [selectedYear]);

  function addRow() {
    setRows((current) => [...current, { id: `editor-row-${Date.now()}`, values: {} }]);
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  function addColumn() {
    const id = `custom-${Date.now()}`;
    setColumns((current) => [...current, { id, label: 'New Column', type: 'text', custom: true }]);
    setRows((current) => current.map((row) => ({ ...row, values: { ...row.values, [id]: '' } })));
  }

  function removeColumn(columnId: string) {
    setColumns((current) => current.filter((column) => column.id !== columnId));
    setRows((current) =>
      current.map((row) => {
        const values = { ...row.values };
        delete values[columnId];
        return { ...row, values };
      })
    );
  }

  function renameColumn(columnId: string, currentLabel: string) {
    const label = window.prompt('Column name', currentLabel);
    if (!label) return;
    setColumns((current) => current.map((column) => (column.id === columnId ? { ...column, label } : column)));
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row))
    );
  }

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedRecords = rows
      .map((row, index) => normalizeEditorRecord(row.values, financialYear, index))
      .filter((record) => record.tenderTitle && record.tenderTitle !== 'Untitled tender');

    if (!normalizedRecords.length) {
      setStatus('Add at least one tender title before saving.');
      setStatusSuccess(false);
      return;
    }

    setStatus(`${normalizedRecords.length} plan row${normalizedRecords.length === 1 ? '' : 's'} saved.`);
    setStatusSuccess(true);
    onSave(financialYear, normalizedRecords);
    setRows(createInitialRows());
  }

  return (
    <section className="planning-editor-page" data-planning-editor hidden={hidden}>
      <form className="procurement-plan-create-form" data-procurement-plan-form noValidate onSubmit={submitPlan}>
        <div className="planning-editor-header">
          <div>
            <span className="section-kicker">Create plan</span>
            <h1>Procurement Plan Worksheet</h1>
            <p>Start with blank rows, then add the planned tenders your team is ready to approve.</p>
          </div>
          <button className="btn btn-primary" type="submit">
            Save Plan
          </button>
        </div>
        <div className="procurement-panel planning-editor-settings">
          <label className="planning-field">
            <span>Financial Year</span>
            <input className="form-input" name="financialYear" value={financialYear} onChange={(event) => setFinancialYear(event.target.value)} />
          </label>
          <div className="planning-editor-tools">
            <button className="btn btn-secondary btn-sm" type="button" data-plan-add-row onClick={addRow}>
              Add Row
            </button>
            <button className="btn btn-secondary btn-sm" type="button" data-plan-add-column onClick={addColumn}>
              Add Column
            </button>
          </div>
        </div>
        <div className="data-table procurement-plan-create-table planning-editor-table">
          <table>
            <thead>
              <tr data-plan-create-head>
                {visibleColumns.map((column) => (
                  <th key={column.id} data-column-id={column.id} data-custom-column={column.custom ? 'true' : undefined}>
                    <span data-plan-column-label onClick={() => renameColumn(column.id, column.label)}>
                      {column.label}
                    </span>
                    <button
                      className="planning-column-remove"
                      type="button"
                      data-plan-remove-column={column.id}
                      aria-label={`Remove ${column.label} column`}
                      onClick={() => removeColumn(column.id)}
                    >
                      Remove Column
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody data-plan-create-body>
              {rows.map((row) => (
                <tr key={row.id} data-plan-create-row>
                  {visibleColumns.map((column) => (
                    <td key={column.id} data-column-id={column.id} data-custom-column={column.custom ? 'true' : undefined}>
                      <PlanningEditorInput
                        column={columnWithFallback(column.id, column.label)}
                        value={row.values[column.id] || ''}
                        onChange={(value) => updateCell(row.id, column.id, value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button className="btn btn-secondary btn-sm planning-remove-control" type="button" data-plan-remove-row onClick={() => removeRow(row.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`form-status app-form-status${statusSuccess ? ' success' : ''}`} data-plan-form-status aria-live="polite">
          {status}
        </div>
      </form>
    </section>
  );
}

function PlanningEditorInput({
  column,
  value,
  onChange
}: {
  column: ProcurementPlanningColumn;
  value: string;
  onChange: (value: string) => void;
}) {
  if (column.type === 'select') {
    const selectedValue = value || column.options?.[0] || '';

    return (
      <select className="form-input" name={column.id} value={selectedValue} onChange={(event) => onChange(event.target.value)}>
        {(column.options || []).map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="form-input"
      type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
      name={column.id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
