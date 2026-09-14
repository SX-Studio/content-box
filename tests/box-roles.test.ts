import { describe, it, expect } from 'vitest';

// Mirrors the two guards in POST /api/boxes/[id]/invitations. They run before any DB
// write, so their exact accept/reject sets are what actually decide who gets power.
const ALLOWED = ['box_admin', 'creator', 'user'];
const roleAllowed = (role: string) => ALLOWED.includes(role);

// Appointing a box admin is reserved to platform operators; a box admin may invite
// creators and users into their own box but cannot appoint another admin.
const mayGrant = (role: string, isOperator: boolean) => roleAllowed(role) && (role !== 'box_admin' || isOperator);

describe('box invitation roles', () => {
  it('accepts box_admin, creator and user as role values', () => {
    for (const r of ALLOWED) expect(roleAllowed(r)).toBe(true);
  });

  it('never accepts platform_operator or moderator through a box invite', () => {
    // Box invitations are scoped to one box. A platform-wide role granted this way
    // would be an escalation path out of that box.
    expect(roleAllowed('platform_operator')).toBe(false);
    expect(roleAllowed('moderator')).toBe(false);
  });

  it.each(['', 'admin', 'BOX_ADMIN', 'owner', 'box-admin'])('rejects %j', (r) => {
    expect(roleAllowed(r)).toBe(false);
  });
});

describe('who may appoint a box admin', () => {
  it('an operator may grant any of the three roles', () => {
    for (const r of ALLOWED) expect(mayGrant(r, true)).toBe(true);
  });

  it('a box admin may grant creator and user', () => {
    expect(mayGrant('creator', false)).toBe(true);
    expect(mayGrant('user', false)).toBe(true);
  });

  it('a box admin may NOT appoint another box admin', () => {
    // One careless admin must not be able to multiply into several, which would take
    // the choice of who runs a box away from the operators.
    expect(mayGrant('box_admin', false)).toBe(false);
  });
});
