import type { Tender } from '@/shared/types/domain';

export type ProcurementTender = Tender;

export type MarketplaceTenderRow = Tender & {
  saved?: boolean;
  hasDraftBid?: boolean;
  hasSubmittedBid?: boolean;
};

export type MyTenderRow = {
  id: string;
  title: string;
  section: 'draft' | 'posted' | 'completed';
  status: string;
  type: Tender['type'];
  tender?: Tender;
  lastActivity: string;
  actionLabel: string;
  nav: string;
};

export type MyBidRow = {
  id: string;
  title: string;
  section: 'draft' | 'submitted';
  status: string;
  tender: Tender;
  tenderReference: string;
  amount?: string;
  receiptHash?: string;
  lastActivity: string;
  actionLabel: string;
  nav: string;
};

export type MarketplacePayload = {
  tenders: MarketplaceTenderRow[];
  myTenders: MyTenderRow[];
  myBids: MyBidRow[];
};
