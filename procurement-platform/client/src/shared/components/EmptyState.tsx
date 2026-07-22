/* Renders the shared Empty State UI while keeping page-specific presentation near its workflow data. */
import { Button } from '@mui/material';
import { Link } from 'react-router-dom';

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
};

export function EmptyState({ title, body, actionLabel, actionTo }: EmptyStateProps) {
  return (
    <section className="px-card">
      <h3>{title}</h3>
      <p>{body}</p>
      {actionLabel && actionTo ? (
        <Button component={Link} to={actionTo} variant="contained">
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
