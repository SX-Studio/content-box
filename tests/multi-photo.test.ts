import { describe, it, expect } from 'vitest';
import { MAX_IMAGES_PER_CONTENT, isValidMasterPath } from '@/lib/content';

const BOX = 'b1f2c3d4-0000-0000-0000-000000000000';

describe('multi-photo upload guards', () => {
  it('caps photos per post', () => {
    expect(MAX_IMAGES_PER_CONTENT).toBe(10);
  });

  it('accepts a path under the box prefix', () => {
    expect(isValidMasterPath(`${BOX}/img/CNT-ABC.jpg`, BOX)).toBe(true);
  });

  it('rejects a path for a DIFFERENT box — the client supplies it, so it is untrusted', () => {
    const other = 'aaaaaaaa-0000-0000-0000-000000000000';
    expect(isValidMasterPath(`${other}/img/CNT-ABC.jpg`, BOX)).toBe(false);
  });

  it('rejects traversal out of the prefix', () => {
    expect(isValidMasterPath(`${BOX}/../${'x'}/evil.jpg`, BOX)).toBe(false);
    expect(isValidMasterPath(`${BOX}/img/../../secret.jpg`, BOX)).toBe(false);
  });

  it('rejects an absolute path and a bare filename', () => {
    expect(isValidMasterPath(`/${BOX}/img/a.jpg`, BOX)).toBe(false);
    expect(isValidMasterPath('a.jpg', BOX)).toBe(false);
  });

  it('rejects a prefix that merely starts with the box id', () => {
    // "<box>evil/..." must not pass as "<box>/..."
    expect(isValidMasterPath(`${BOX}evil/img/a.jpg`, BOX)).toBe(false);
  });
});
