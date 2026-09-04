import { uuidFromBytes } from '@/lib/uuid';

describe('uuidFromBytes', () => {
  it('creates a valid RFC 4122 version 4 UUID', () => {
    const uuid = uuidFromBytes(Uint8Array.from({ length: 16 }, (_, index) => index));

    expect(uuid).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('does not mutate the supplied bytes', () => {
    const bytes = new Uint8Array(16);

    uuidFromBytes(bytes);

    expect(Array.from(bytes)).toEqual(Array(16).fill(0));
  });

  it('rejects input with the wrong length', () => {
    expect(() => uuidFromBytes(new Uint8Array(15))).toThrow('exactly 16 bytes');
  });
});
