import * as Crypto from 'expo-crypto';

function byteToHex(value: number) {
  return value.toString(16).padStart(2, '0');
}

export function uuidFromBytes(source: Uint8Array): string {
  if (source.length !== 16) throw new TypeError('A UUID requires exactly 16 bytes.');

  const bytes = Uint8Array.from(source);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byteToHex).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createUuid(): string {
  return uuidFromBytes(Crypto.getRandomBytes(16));
}
