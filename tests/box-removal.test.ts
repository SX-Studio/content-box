import { describe, it, expect } from 'vitest';
import { boxRemovalMode } from '@/lib/boxes';

// box(id) cascades to content, rental, box_membership and invitation. A rental is a paid
// 24h entitlement, so hard-deleting a box with any history destroys access somebody
// bought AND the record of what they bought — while the ledger debit that paid for it
// survives, leaving a charge with no counterpart. This predicate is the only thing
// standing between an operator's Delete click and that outcome.
describe('boxRemovalMode', () => {
  it('hard-deletes only a box that has never held anything', () => {
    expect(boxRemovalMode(0, 0)).toBe('delete');
  });

  it('archives a box that holds content', () => {
    expect(boxRemovalMode(3, 0)).toBe('archive');
  });

  it('archives a box with rentals even when its content is already gone', () => {
    // Content can be removed by moderation while the rental rows remain. The rentals are
    // the paid entitlements, so their presence alone must block a hard delete.
    expect(boxRemovalMode(0, 1)).toBe('archive');
  });

  it('archives when both are present', () => {
    expect(boxRemovalMode(12, 40)).toBe('archive');
  });

  it('never hard-deletes on a single rental, the smallest amount of money that can exist', () => {
    expect(boxRemovalMode(0, 1)).not.toBe('delete');
  });
});
