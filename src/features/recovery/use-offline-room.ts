import { useCallback, useEffect, useRef, useState } from 'react';
import { offlineCache } from '@/lib/offline-cache';
import { convergeAfterReconnect, reconnectCoordinator } from '@/lib/reconnect';

type Options<T> = { namespace: string; scope: string; load: () => Promise<T>; parse: (value: unknown) => T; accept: (value: T) => void };
export function useOfflineRoom<T>({ namespace, scope, load, parse, accept }: Options<T>) {
  const [stale, setStale] = useState(false); const [reconnecting, setReconnecting] = useState(false); const [error, setError] = useState<unknown>(null);
  const callbacks = useRef({ load, parse, accept });
  useEffect(() => { callbacks.current = { load, parse, accept }; }, [accept, load, parse]);
  const refresh = useCallback(async () => {
    try { const value = await callbacks.current.load(); callbacks.current.accept(value); await offlineCache.write(namespace, scope, value); setStale(false); setError(null); }
    catch (cause) { setError(cause); const cached = await offlineCache.read(namespace, scope, callbacks.current.parse); if (cached) { callbacks.current.accept(cached.value); setStale(true); return; } throw cause; }
  }, [namespace, scope]);
  const acceptAuthoritative = useCallback((value: T) => { callbacks.current.accept(value); setStale(false); setError(null); void offlineCache.write(namespace, scope, value); }, [namespace, scope]);
  useEffect(() => reconnectCoordinator.subscribe((network) => {
    if (!network.online) { setStale(true); return; }
    if (network.reconnectedAt !== null) { setReconnecting(true); void convergeAfterReconnect(refresh).catch(setError).finally(() => setReconnecting(false)); }
  }), [refresh]);
  return { refresh, acceptAuthoritative, stale, reconnecting, error };
}
