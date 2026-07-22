/* Exposes documents hooks that keep component state access and side effects consistent across screens. */
import { useAppSelector } from '@/app/store';

export function useDocumentQueue() {
  return useAppSelector((state) => state.documents.uploadQueue);
}
