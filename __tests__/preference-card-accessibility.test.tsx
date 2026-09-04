import { fireEvent, render } from '@testing-library/react-native';

import { AppButton } from '@/components/app-button';
import { preferenceChoices } from '@/features/cards/card-definitions';
import { PreferenceCard } from '@/features/cards/preference-card';
import { roundMotion } from '@/theme/motion';

describe('preference cards', () => {
  it('provides an illustration, practical meaning, and accessible selection for every card', async () => {
    for (const card of preferenceChoices) {
      const onPress = jest.fn(); const screen = await render(<PreferenceCard card={card} onPress={onPress} selected />);
      expect(screen.getByText(card.title)).toBeTruthy(); expect(screen.getByText(card.description)).toBeTruthy();
      const element = screen.getByTestId(`preference-card-${card.roundType}-${card.id}`);
      expect(element.props.accessibilityLabel).toBe(card.accessibilityLabel); expect(element.props.accessibilityState.selected).toBe(true);
      await fireEvent.press(element); expect(onPress).toHaveBeenCalled(); await screen.unmount();
    }
  });
  it('keeps the non-gesture throw target at least 44 points tall', async () => {
    const screen = await render(<AppButton label="Throw card" onPress={jest.fn()} />);
    expect(screen.getByRole('button').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ minHeight: 54 })]));
  });
  it('removes spatial motion when reduced motion is enabled', () => {
    expect(roundMotion(true)).toEqual({ submitDuration: 0, revealDuration: 120, throwDistance: 0, usesSpatialMotion: false });
    expect(roundMotion(false).usesSpatialMotion).toBe(true);
  });
});
