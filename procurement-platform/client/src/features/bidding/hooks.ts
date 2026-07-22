/* Exposes bidding hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useBids() {
  return useAppSelector((state) => state.bidding.bids);
}
