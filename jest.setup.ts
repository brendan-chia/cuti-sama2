jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '9ae175da-33cc-4e25-a083-0dfc5dfb733b'),
  getRandomBytesAsync: jest.fn(async (length: number) => new Uint8Array(length).fill(7)),
}));
