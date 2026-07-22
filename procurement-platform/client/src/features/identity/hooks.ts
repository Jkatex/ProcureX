/* Exposes identity hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useIdentityState() {
  return useAppSelector((state) => state.identity);
}
