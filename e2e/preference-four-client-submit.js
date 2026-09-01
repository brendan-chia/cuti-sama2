var response = http.post(PREFERENCE_HARNESS_URL + '/preference-rounds/submit-peers', {
  headers: { 'Authorization': 'Bearer ' + PREFERENCE_HARNESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tripId: PREFERENCE_TRIP_ID, submissions: ['Night markets', 'Nature first', 'Late nights'], concurrent: true })
});
if (response.status !== 200) throw new Error('Four-client submission harness failed with HTTP ' + response.status);

