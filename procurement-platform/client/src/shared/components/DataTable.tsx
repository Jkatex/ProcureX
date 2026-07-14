import type { ReactNode } from 'react';

type DataTableProps<T> = {
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  rows: T[];
  getRowKey: (row: T) => string;
};

export function DataTable<T>({ columns, rows, getRowKey }: DataTableProps<T>) {
  return (
    <div className="px-table-wrap">
      <table className="px-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <div className="scope-empty">No records yet. Activity will appear here after users start working.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
