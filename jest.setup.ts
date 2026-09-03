jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (value: string) => `digest:${value}`),
  randomUUID: jest.fn(() => '9ae175da-33cc-4e25-a083-0dfc5dfb733b'),
  getRandomBytesAsync: jest.fn(async (length: number) => new Uint8Array(length).fill(7)),
}));

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
