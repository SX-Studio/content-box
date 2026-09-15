import { describe, it, expect } from 'vitest';
import { tallyNonOperatorAdmins } from '@/lib/boxes';

// The dashboard flags a box as "no admin yet" from this count, and that flag is what
// tells an operator which boxes still need handing over. Counting admins naively would
// mark every box staffed, because createBox makes the operator box_admin on every box
// they create — so excluding operators IS the feature, not a detail.
describe('tallyNonOperatorAdmins', () => {
  const OP = 'acct-operator';

  it('does not count the operator who created the box', () => {
    const counts = tallyNonOperatorAdmins(
      ['box-1'],
      [{ box_id: 'box-1', account_id: OP }],
      new Set([OP]),
    );
    expect(counts['box-1']).toBe(0);
  });

  it('counts a real admin once the operator hands the box over', () => {
    const counts = tallyNonOperatorAdmins(
      ['box-1'],
      [
        { box_id: 'box-1', account_id: OP },
        { box_id: 'box-1', account_id: 'acct-creator' },
      ],
      new Set([OP]),
    );
    expect(counts['box-1']).toBe(1);
  });

  it('reports every requested box, including ones with no admin rows at all', () => {
    // A box with zero memberships must come back as 0, not missing — the UI tests
    // `adminCount === 0`, and undefined would silently hide the flag.
    const counts = tallyNonOperatorAdmins(
      ['box-1', 'box-2', 'box-3'],
      [{ box_id: 'box-2', account_id: 'acct-a' }],
      new Set([OP]),
    );
    expect(counts).toEqual({ 'box-1': 0, 'box-2': 1, 'box-3': 0 });
  });

  it('counts several admins on one box', () => {
    const counts = tallyNonOperatorAdmins(
      ['box-1'],
      [
        { box_id: 'box-1', account_id: 'acct-a' },
        { box_id: 'box-1', account_id: 'acct-b' },
        { box_id: 'box-1', account_id: OP },
      ],
      new Set([OP]),
    );
    expect(counts['box-1']).toBe(2);
  });

  it('ignores an admin row for a box that was not asked about', () => {
    const counts = tallyNonOperatorAdmins(
      ['box-1'],
      [{ box_id: 'box-other', account_id: 'acct-a' }],
      new Set(),
    );
    expect(counts).toEqual({ 'box-1': 0 });
  });

  it('returns an empty tally for no boxes', () => {
    expect(tallyNonOperatorAdmins([], [], new Set())).toEqual({});
  });
});
