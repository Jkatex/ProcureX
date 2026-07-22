/* Exposes awards Contracts hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useAwardsContractsState() {
  return useAppSelector((state) => state.awardsContracts);
}
