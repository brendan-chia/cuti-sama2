jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (value: string) => `digest:${value}`),
  randomUUID: jest.fn(() => '9ae175da-33cc-4e25-a083-0dfc5dfb733b'),
  getRandomBytes: jest.fn((length: number) => new Uint8Array(length).fill(7)),
  getRandomBytesAsync: jest.fn(async (length: number) => new Uint8Array(length).fill(7)),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    createAnimatedComponent: (component: unknown) => component,
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown, _config?: unknown, callback?: (finished: boolean) => void) => { callback?.(true); return value; },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react'); const { View } = require('react-native');
  const pan = { enabled() { return this; }, onChange() { return this; }, onEnd() { return this; }, onFinalize() { return this; } };
  return { Gesture: { Pan: () => pan }, GestureDetector: ({ children }: { children: unknown }) => React.createElement(React.Fragment, null, children), GestureHandlerRootView: View };
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) },
}));

jest.mock('@expo/ui/community/datetime-picker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ testID }: { testID?: string }) => React.createElement(View, { testID }),
  };
});
