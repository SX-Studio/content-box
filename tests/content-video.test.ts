import { describe, it, expect } from 'vitest';
import { extForVideoMime, ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES } from '@/lib/content';

describe('video content helpers', () => {
  it('maps video mimes to extensions', () => {
    expect(extForVideoMime('video/mp4')).toBe('mp4');
    expect(extForVideoMime('video/webm')).toBe('webm');
    expect(extForVideoMime('video/quicktime')).toBe('mov');
    expect(extForVideoMime('video/unknown')).toBe('mp4'); // safe default
  });

  it('allows the expected video types and a sane size cap', () => {
    expect(ALLOWED_VIDEO_MIME).toEqual(['video/mp4', 'video/webm', 'video/quicktime']);
    expect(MAX_VIDEO_BYTES).toBe(100 * 1024 * 1024);
  });
});
