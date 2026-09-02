import { render } from '@testing-library/react-native';
import { StaleStateBanner } from '@/components/StaleStateBanner';

it('clearly marks cached state as stale', async () => { const screen = await render(<StaleStateBanner />); expect(screen.getByTestId('stale-state-banner')).toBeTruthy(); expect(screen.getByText('Offline · showing saved state')).toBeTruthy(); });
