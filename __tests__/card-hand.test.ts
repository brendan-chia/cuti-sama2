import { isUpwardCardThrow } from '@/features/cards/card-hand';

describe('isUpwardCardThrow', () => {
  it('accepts a deliberate upward drag or upward flick', () => {
    expect(isUpwardCardThrow(-111, 0)).toBe(true);
    expect(isUpwardCardThrow(-20, -761)).toBe(true);
  });

  it('rejects short, slow movement', () => {
    expect(isUpwardCardThrow(-60, -300)).toBe(false);
  });
});
