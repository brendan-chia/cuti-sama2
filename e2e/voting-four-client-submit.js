var response = http.post(VOTING_HARNESS_URL + '/voting/submit-peers', {
  headers: { 'Authorization': 'Bearer ' + VOTING_HARNESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tripId: VOTING_TRIP_ID, optionId: WINNING_OPTION_ID, concurrent: true })
});
if (response.status !== 200) throw new Error('Four-client voting harness failed with HTTP ' + response.status);
