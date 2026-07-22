/* Exposes auth hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useAuthSession() {
  return useAppSelector((state) => state.auth);
}
