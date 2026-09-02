import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const MANIFEST_SUFFIX = '.__chunks';

export type AsyncStorageDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type SecureStoreDriver = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function createChunkedStorage(driver: SecureStoreDriver): AsyncStorageDriver {
  async function chunkCount(key: string) {
    const raw = await driver.getItemAsync(`${key}${MANIFEST_SUFFIX}`);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  return {
    async getItem(key) {
      const count = await chunkCount(key);
      if (count === 0) return driver.getItemAsync(key);

      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) => driver.getItemAsync(`${key}.${index}`)),
      );
      return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
    },
    async setItem(key, value) {
      await this.removeItem(key);
      const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
      await Promise.all(
        chunks.map((chunk, index) => driver.setItemAsync(`${key}.${index}`, chunk)),
      );
      await driver.setItemAsync(`${key}${MANIFEST_SUFFIX}`, String(chunks.length));
    },
    async removeItem(key) {
      const count = await chunkCount(key);
      await Promise.all([
        driver.deleteItemAsync(key),
        driver.deleteItemAsync(`${key}${MANIFEST_SUFFIX}`),
        ...Array.from({ length: count }, (_, index) => driver.deleteItemAsync(`${key}.${index}`)),
      ]);
    },
  };
}

function createWebStorage(): AsyncStorageDriver {
  return {
    async getItem(key) {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    },
    async setItem(key, value) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    },
    async removeItem(key) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    },
  };
}

export const sessionStorage =
  Platform.OS === 'web' ? createWebStorage() : createChunkedStorage(SecureStore);

const LAST_TRIP_KEY = 'cutisama2.last-trip-id';
const IDENTITY_MARKER_KEY = 'cutisama2.anonymous-identity';

export function saveLastTripId(tripId: string) {
  return sessionStorage.setItem(LAST_TRIP_KEY, tripId);
}

export function getLastTripId() {
  return sessionStorage.getItem(LAST_TRIP_KEY);
}

export function saveIdentityMarker(userId: string) { return sessionStorage.setItem(IDENTITY_MARKER_KEY, userId); }
export function getIdentityMarker() { return sessionStorage.getItem(IDENTITY_MARKER_KEY); }
export function clearIdentityMarker() { return sessionStorage.removeItem(IDENTITY_MARKER_KEY); }

function inviteCacheKey(tripId: string) {
  return `cutisama2.invitation.${tripId}`;
}

export function saveCachedInvitation(tripId: string, invitation: string) {
  return sessionStorage.setItem(inviteCacheKey(tripId), invitation);
}

export function getCachedInvitation(tripId: string) {
  return sessionStorage.getItem(inviteCacheKey(tripId));
}

export function clearCachedInvitation(tripId: string) {
  return sessionStorage.removeItem(inviteCacheKey(tripId));
}
