/* Renders the shared Timeline UI while keeping page-specific presentation near its workflow data. */
import type { TimelineItem } from '@/shared/types/domain';
import { StatusBadge } from './StatusBadge';

type TimelineProps = {
  items: TimelineItem[];
};

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="px-grid">
      {items.map((item) => (
        <article className="px-card" key={item.id}>
          <StatusBadge value={item.status} />
          <h4>{item.label}</h4>
          <span>{item.date}</span>
        </article>
      ))}
    </div>
  );
}
