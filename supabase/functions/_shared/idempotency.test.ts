import { operationHash } from './idempotency.ts';
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
Deno.test('operation hashes are key-order independent and payload-sensitive', async () => {
  assert(await operationHash({ b: 2, a: 1 }) === await operationHash({ a: 1, b: 2 }), 'equivalent payloads should match');
  assert(await operationHash({ value: 'first' }) !== await operationHash({ value: 'second' }), 'different payloads must not share a key');
});
