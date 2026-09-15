import { describe, it, expect } from 'vitest';
import { toE164 } from '@/lib/crypto';

// POST /api/boxes accepts an optional adminPhone. The route normalises it with toE164
// BEFORE createBox runs, so a mistyped number cannot leave an orphan box behind — the
// invitation and the box succeed or fail together. These pin that contract at the unit
// the route depends on; the authz rule itself (operator-only) is enforced in the route
// and mirrored from the invitations route, which box-roles.test.ts already covers.
describe('box admin phone normalisation guards box creation', () => {
  it('accepts the shapes an operator will actually type', () => {
    expect(toE164('+31612345678')).toBe('+31612345678');
    expect(toE164(' +32 470 12 34 56 ')).toBe('+32470123456');
    expect(toE164('+32-470-123-456')).toBe('+32470123456');
  });

  it('rejects a number that would otherwise create a box nobody can be invited to', () => {
    // Each of these reached createInvitation before the pre-validation was added, which
    // would have thrown only after the box row was already committed.
    expect(() => toE164('0612345678')).toThrow(/E.164/);
    expect(() => toE164('+0612345678')).toThrow(/E.164/);
    expect(() => toE164('612345678')).toThrow(/E.164/);
    expect(() => toE164('')).toThrow(/E.164/);
    expect(() => toE164('+31 61 not a number')).toThrow(/E.164/);
  });

  it('rejects a number too short or too long to be dialable', () => {
    expect(() => toE164('+3161')).toThrow(/E.164/);
    expect(() => toE164(`+31${'6'.repeat(20)}`)).toThrow(/E.164/);
  });
});
