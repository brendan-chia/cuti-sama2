var response = http.post(VOTING_HARNESS_URL + '/voting/assert-lock-consistency', {
  headers: { 'Authorization': 'Bearer ' + VOTING_HARNESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tripId: VOTING_TRIP_ID, optionId: WINNING_OPTION_ID, expectedPhase: 'itinerary_planning', clientCount: 4 })
});
if (response.status !== 200) throw new Error('Four-client lock consistency failed with HTTP ' + response.status);
