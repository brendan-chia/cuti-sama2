import { render } from '@testing-library/react-native';

import { preferenceCards } from '@/features/cards/card-definitions';
import { PreferenceCard } from '@/features/cards/preference-card';
import { AppButton } from '@/components/app-button';
import { roundMotion } from '@/theme/motion';

describe('preference cards', () => {
  it('provides labels, examples, accessible names, and selection state for every input', async () => {
    for (const card of preferenceCards) {
      const screen = await render(<PreferenceCard card={card} onChange={jest.fn()} selected value="" />);
      expect(screen.getByText(card.label)).toBeTruthy();
      expect(screen.getByText(card.example)).toBeTruthy();
      const element = screen.getByTestId(`preference-card-${card.kind}`);
      const accessibleCard = screen.getByTestId(`preference-card-accessible-${card.kind}`);
      expect(accessibleCard.props.accessibilityLabel).toBe(card.accessibleName);
      expect(accessibleCard.props.accessibilityState.selected).toBe(true);
      expect(element.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ minHeight: 220 })]));
      await screen.unmount();
    }
  });

  it('supports dynamic text without truncating the answer', async () => {
    const screen = await render(<PreferenceCard card={preferenceCards[0]} onChange={jest.fn()} selected={false} value={'Long preference '.repeat(8)} />);
    expect(screen.getByLabelText('Vibe answer').props.multiline).toBe(true);
    expect(screen.getByLabelText('Vibe answer').props.numberOfLines).toBeUndefined();
  });

  it('keeps the tap submission target at least 44 points tall', async () => {
    const screen = await render(<AppButton label="Submit card" onPress={jest.fn()} />);
    const button = screen.getByRole('button');
    expect(button.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ minHeight: 54 })]));
  });

  it('removes spatial motion and keeps a short fade when reduced motion is enabled', () => {
    expect(roundMotion(true)).toEqual({ submitDuration: 0, revealDuration: 120, throwDistance: 0, usesSpatialMotion: false });
    expect(roundMotion(false).usesSpatialMotion).toBe(true);
  });
});
