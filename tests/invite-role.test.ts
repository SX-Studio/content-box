import { describe, it, expect } from 'vitest';
import { resolveAcceptedRole } from '@/lib/invitations';

// Before this, an accepted invite never changed an existing member's role: the
// membership upsert used ignoreDuplicates, so the invite was consumed, the UI said
// "Joined as creator", and the row stayed whatever it was. These pin the intended
// outcome for every combination an admin can actually produce.
describe('resolveAcceptedRole', () => {
  it('a new member gets exactly the invited role', () => {
    expect(resolveAcceptedRole(null, 'creator')).toBe('creator');
    expect(resolveAcceptedRole(null, 'user')).toBe('user');
    expect(resolveAcceptedRole(null, 'box_admin')).toBe('box_admin');
  });

  it('upgrades: user → creator, user/creator → box_admin', () => {
    expect(resolveAcceptedRole('user', 'creator')).toBe('creator');
    expect(resolveAcceptedRole('user', 'box_admin')).toBe('box_admin');
    expect(resolveAcceptedRole('creator', 'box_admin')).toBe('box_admin');
  });

  it('creator → user follows the invite (the admin chose it)', () => {
    expect(resolveAcceptedRole('creator', 'user')).toBe('user');
  });

  it('never strips box_admin through a creator/user link', () => {
    expect(resolveAcceptedRole('box_admin', 'creator')).toBe('box_admin');
    expect(resolveAcceptedRole('box_admin', 'user')).toBe('box_admin');
  });

  it('re-accepting the same role is a no-op', () => {
    for (const r of ['user', 'creator', 'box_admin']) expect(resolveAcceptedRole(r, r)).toBe(r);
  });
});
