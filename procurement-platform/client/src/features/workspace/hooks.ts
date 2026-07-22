/* Exposes workspace hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useWorkspaceItems() {
  return useAppSelector((state) => state.workspace.workItems);
}
