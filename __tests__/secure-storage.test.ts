import { createChunkedStorage } from '@/lib/secure-storage';

function memoryDriver() {
  const values = new Map<string, string>();
  return {
    values,
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
  };
}

describe('chunked secure storage', () => {
  it('round-trips values larger than a SecureStore entry', async () => {
    const driver = memoryDriver();
    const storage = createChunkedStorage(driver);
    const session = 'x'.repeat(5000);
    await storage.setItem('session', session);
    expect(await storage.getItem('session')).toBe(session);
    expect(driver.values.get('session.__chunks')).toBe('3');
  });

  it('removes every chunk when a session is replaced or cleared', async () => {
    const driver = memoryDriver();
    const storage = createChunkedStorage(driver);
    await storage.setItem('session', 'x'.repeat(4000));
    await storage.setItem('session', 'short');
    expect(await storage.getItem('session')).toBe('short');
    expect(driver.values.has('session.1')).toBe(false);
    await storage.removeItem('session');
    expect(driver.values.size).toBe(0);
  });
});
