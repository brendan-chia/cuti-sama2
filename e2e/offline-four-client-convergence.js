var response = http.post(OFFLINE_HARNESS_URL + '/offline-recovery/disconnect-reconnect', {
  headers: { 'Authorization': 'Bearer ' + OFFLINE_HARNESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tripId: OFFLINE_TRIP_ID, clientCount: 4, disconnectSeconds: 60, convergeWithinMs: 5000, requireIdenticalAuthoritativeState: true })
});
if (response.status !== 200) throw new Error('Four-client reconnect convergence failed with HTTP ' + response.status);
