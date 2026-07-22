/* Exposes records hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useRecords() {
  return useAppSelector((state) => state.records.records);
}
