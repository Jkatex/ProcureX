/* Connects evaluation route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { BidEvaluationProcurexPage } from '@/features/evaluation/components/procurex/BidEvaluationProcurexPage';

export function BidEvaluationPage() {
  return <BidEvaluationProcurexPage />;
}
