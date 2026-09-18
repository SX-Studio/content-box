// Nickname rules. Pure — no DB, no `server-only` — so every rule here is unit-tested
// directly rather than inferred from a route's behaviour.
//
// A nickname is shown to other participants, so the rules exist to stop three things:
// a name that leaks a phone number, a name that impersonates staff or another
// account's public ID, and a name made of invisible characters.

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 24;

// Staff and platform words. Someone calling themselves "Support" in a marketplace
// where people pay for content is a social-engineering foothold, not a nickname.
const RESERVED = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'operator', 'staff', 'support',
  'help', 'helpdesk', 'system', 'root', 'official', 'content24', 'contentbox',
  'content box', 'content 24', 'null', 'undefined', 'me',
]);

// Public IDs look like USR-7K3MAB21. A nickname that mimics that shape would read as
// somebody else's identity in any list that shows both.
const ID_PREFIX = /^(usr|crt|box|cnt|inv|mod|bad|rpt|top|ord|pay)[-\s]/i;

// Invisible and direction-flipping characters: zero-width spaces, LTR/RTL overrides,
// BOM. They render as nothing (or reverse the text) and exist mainly to build a name
// that looks identical to another one.
// eslint-disable-next-line no-misleading-character-class
const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/;

// Letters (any script, so "José" and "Sanne" are equally fine), combining marks,
// digits, space, and the punctuation people actually use in names.
const ALLOWED = /^[\p{L}\p{M}0-9 ._'-]+$/u;

/**
 * Normalise a nickname: NFC, trimmed, internal whitespace collapsed.
 * Applied before every check so " Ana   B " and "Ana B" are the same name.
 */
export function normalizeDisplayName(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The case-folded key two nicknames are compared on. Mirrors the GENERATED column in
 * migration 0023 (`lower(btrim(display_name))`) — the database is what enforces
 * uniqueness; this is for pre-checks and tests.
 */
export function displayNameKey(name: string): string {
  return normalizeDisplayName(name).toLowerCase();
}

/**
 * Validate a nickname, returning the normalised form to store.
 * Throws with a message written for the person typing it.
 */
export function validateDisplayName(raw: unknown): string {
  // ⚠️ Checked BEFORE normalising, not after. JS treats U+FEFF as whitespace, so
  // `trim()` and the `\s+` collapse in normalizeDisplayName quietly turn a BOM into a
  // space — "An\uFEFFa" would be stored as "An a", a name the person never chose.
  // U+200B is not whitespace and would survive, so only half of these would ever be
  // caught if this ran later. Refuse them all, and say so.
  if (INVISIBLE.test(String(raw ?? '').normalize('NFC'))) {
    throw new Error('That nickname contains invisible characters');
  }

  const name = normalizeDisplayName(raw);

  if (!name) throw new Error('Choose a nickname');
  // Count code points: an emoji or an accented letter is one character to the person
  // typing it, but two UTF-16 units to `.length`.
  const chars = [...name].length;
  if (chars < DISPLAY_NAME_MIN) throw new Error(`Nicknames are at least ${DISPLAY_NAME_MIN} characters`);
  if (chars > DISPLAY_NAME_MAX) throw new Error(`Nicknames are at most ${DISPLAY_NAME_MAX} characters`);

  if (!ALLOWED.test(name)) throw new Error('Use letters, numbers, spaces, and . _ - only');

  // ⚠️ Privacy rule, not a style rule: a phone number must never be stored in plain
  // text, and a nickname is plain text shown to everyone. A run of digits long enough
  // to be a number is refused whatever separators it is dressed up with.
  const digits = (name.match(/\d/g) ?? []).length;
  if (digits >= 7) throw new Error('A nickname cannot be a phone number');

  const key = displayNameKey(name);
  if (RESERVED.has(key)) throw new Error('That nickname is reserved');
  if (ID_PREFIX.test(name)) throw new Error('That nickname looks like a public ID');

  return name;
}

/**
 * How an account is labelled to other participants: the nickname when there is one,
 * always followed by the public ID. Never the nickname alone — the ID is what makes
 * two similar-looking names distinguishable.
 */
export function participantLabel(displayName: string | null | undefined, publicId: string): string {
  const n = normalizeDisplayName(displayName);
  return n ? `${n} · ${publicId}` : publicId;
}
