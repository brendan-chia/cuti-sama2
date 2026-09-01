var response = http.post(PREFERENCE_HARNESS_URL + '/preference-rounds/submit-and-remove', {
  headers: { 'Authorization': 'Bearer ' + PREFERENCE_HARNESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tripId: PREFERENCE_TRIP_ID, submissions: ['Relaxed', 'Full days'], removePendingMember: true })
});
if (response.status !== 200) throw new Error('Member-removal harness failed with HTTP ' + response.status);

