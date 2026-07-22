/* Renders the shared Kpi Card UI while keeping page-specific presentation near its workflow data. */
type KpiCardProps = {
  label: string;
  value: string;
  note?: string;
};

export function KpiCard({ label, value, note }: KpiCardProps) {
  return (
    <article className="px-card">
      <span>{label}</span>
      <h3>{value}</h3>
      {note ? <small>{note}</small> : null}
    </article>
  );
}
