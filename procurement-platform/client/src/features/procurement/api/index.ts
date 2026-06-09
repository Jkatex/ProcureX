import { mockApi } from '@/shared/api/mockApi';
import { demoUsers } from '@/shared/data/fixtures';
import type { Bid, Tender } from '@/shared/types/domain';
import type { MarketplacePayload, MyBidRow, MyTenderRow } from '../types';

export const procurementApi = {
  listTenders: mockApi.getTenders,
  async getMarketplace(): Promise<MarketplacePayload> {
    const [tenders, bids, workItems] = await Promise.all([mockApi.getTenders(), mockApi.getBids(), mockApi.getWorkItems()]);
    return buildMarketplacePayload(tenders, bids, workItems);
  }
};

type WorkItemFixture = Awaited<ReturnType<typeof mockApi.getWorkItems>>[number];

function buildMarketplacePayload(tenders: Tender[], bids: Bid[], workItems: WorkItemFixture[]): MarketplacePayload {
  const myTenderRows = buildMyTenderRows(tenders, workItems);
  const myBidRows = buildMyBidRows(tenders, bids, workItems);

  return {
    tenders: tenders.map((tender) => ({
      ...tender,
      hasDraftBid: myBidRows.some((bid) => bid.tenderReference === tender.reference && bid.section === 'draft'),
      hasSubmittedBid: myBidRows.some((bid) => bid.tenderReference === tender.reference && bid.section === 'submitted')
    })),
    myTenders: myTenderRows,
    myBids: myBidRows
  };
}

function buildMyTenderRows(tenders: Tender[], workItems: WorkItemFixture[]): MyTenderRow[] {
  const ownedTenders = tenders.filter((tender) => tender.createdByCurrentUser);
  const draftWorkItems = workItems.filter((item) => /tender draft|publish tender/i.test(`${item.title} ${item.subtitle}`));

  const draftRows = draftWorkItems.map((item, index): MyTenderRow => {
    const tender = ownedTenders[index] ?? ownedTenders[0];
    return {
      id: `my-tender-draft-${item.id}`,
      title: item.subtitle || item.title,
      section: 'draft',
      status: item.status || 'Draft',
      type: tender?.type ?? 'SERVICE',
      tender,
      lastActivity: '2026-06-09',
      actionLabel: 'Continue Draft',
      nav: '/procurement/create-tender'
    };
  });

  const postedRows = ownedTenders.map((tender): MyTenderRow => ({
    id: `my-tender-posted-${tender.id}`,
    title: tender.title,
    section: 'posted',
    status: tender.status === 'PUBLISHED' ? 'Posted' : tender.status,
    type: tender.type,
    tender,
    lastActivity: tender.closingDate,
    actionLabel: 'View My Tender',
    nav: '/procurement/tender-details'
  }));

  return [...draftRows, ...postedRows];
}

function buildMyBidRows(tenders: Tender[], bids: Bid[], workItems: WorkItemFixture[]): MyBidRow[] {
  const tenderByReference = new Map(tenders.map((tender) => [tender.reference, tender]));
  const draftBidWorkItems = workItems.filter((item) => /bid package|continue bid/i.test(`${item.title} ${item.subtitle}`));

  const draftRows = draftBidWorkItems.flatMap((item): MyBidRow[] => {
    const tender = findTenderForWorkItem(tenders, item);
    if (!tender) return [];
    return [
      {
        id: `my-bid-draft-${item.id}`,
        title: item.subtitle || tender.title,
        section: 'draft',
        status: item.status || 'Draft',
        tender,
        tenderReference: tender.reference,
        lastActivity: '2026-06-09',
        actionLabel: 'Continue Bid',
        nav: '/bidding'
      }
    ];
  });

  const submittedRows = bids.flatMap((bid): MyBidRow[] => {
    const tender = tenderByReference.get(bid.tenderReference);
    if (!tender || bid.status === 'DRAFT' || bid.supplier !== demoUsers.user.organization) return [];
    return [
      {
        id: `my-bid-submitted-${bid.id}`,
        title: tender.title,
        section: 'submitted',
        status: bid.status === 'SUBMITTED' ? 'Submitted' : bid.status,
        tender,
        tenderReference: tender.reference,
        amount: `${tender.currency} ${bid.amount.toLocaleString()}`,
        receiptHash: `BID-${bid.id.toUpperCase()}`,
        lastActivity: '2026-06-09',
        actionLabel: 'Open Bid',
        nav: '/bidding'
      }
    ];
  });

  return [...draftRows, ...submittedRows];
}

function findTenderForWorkItem(tenders: Tender[], item: WorkItemFixture) {
  const haystack = `${item.title} ${item.subtitle}`.toLowerCase();
  return tenders.find((tender) => haystack.includes(tender.title.toLowerCase()) || tender.title.toLowerCase().includes(item.subtitle.toLowerCase()));
}
