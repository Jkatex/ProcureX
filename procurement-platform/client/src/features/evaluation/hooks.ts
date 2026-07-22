/* Exposes evaluation hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useEvaluationState() {
  return useAppSelector((state) => state.evaluation);
}
