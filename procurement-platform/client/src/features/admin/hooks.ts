/* Exposes admin hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useAdminMetrics() {
  return useAppSelector((state) => state.admin.metrics);
}
