import { BidStatus, TenderStatus, Visibility } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { tenderAcceptsBids } from './repository.js';

describe('bidding tender guards', () => {
  it('accepts public open tenders before close', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  it('accepts published invited tenders before close', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.PUBLISHED,
        visibility: Visibility.INVITED,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  it('rejects closed, private, or expired tenders', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.CLOSED,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PRIVATE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() - 86400000)
      })
    ).toBe(false);
  });

  it('keeps withdrawn bids separate from active draft and submission states', () => {
    const activeStatuses = [BidStatus.DRAFT, BidStatus.SUBMITTED];
    expect(activeStatuses).not.toContain(BidStatus.WITHDRAWN);
  });
});
