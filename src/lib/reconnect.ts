import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type Connectivity = { online: boolean; offlineSince: number | null; reconnectedAt: number | null };
type NetworkAdapter = { addEventListener(listener: (state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) => void): () => void };

export function createReconnectCoordinator(adapter: NetworkAdapter, now = () => Date.now()) {
  let state: Connectivity = { online: true, offlineSince: null, reconnectedAt: null }; const listeners = new Set<(value: Connectivity) => void>();
  const unsubscribe = adapter.addEventListener((network) => {
    const online = network.isConnected === true && network.isInternetReachable !== false;
    if (!online && state.online) state = { online: false, offlineSince: now(), reconnectedAt: null };
    else if (online && !state.online) state = { online: true, offlineSince: state.offlineSince, reconnectedAt: now() };
    else state = { ...state, online };
    listeners.forEach((listener) => listener(state));
  });
  return { current: () => state, subscribe(listener: (value: Connectivity) => void) { listeners.add(listener); listener(state); return () => { listeners.delete(listener); }; }, dispose() { unsubscribe(); listeners.clear(); } };
}
export const reconnectCoordinator = createReconnectCoordinator(NetInfo);

export async function convergeAfterReconnect(refresh: () => Promise<void>, timeoutMs = 5_000, now = () => Date.now(), delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const deadline = now() + timeoutMs; let lastError: unknown;
  do { try { await refresh(); return; } catch (cause) { lastError = cause; } await delay(250); } while (now() < deadline);
  throw lastError instanceof Error ? lastError : new Error('Could not refresh authoritative state after reconnecting.');
}
