# CutiSama2 System Architecture Diagram

```text
+----------------------+        +--------------------------------+
| Users                |        | Expo React Native App          |
| Organiser            |------->| Profile and favourite places   |
| Group participants   |        | Solo and group planning        |
| Solo traveller       |        | Budgets, voting and attractions|
+----------------------+        | Logistics and itinerary        |
                               | Saved inspiration and memories |
                               +----------------+---------------+
                                                |
                              Authenticated API | Realtime notices
                                                v
+------------------------------------------------------------------+
| Supabase                                                         |
|                                                                  |
| Auth: identities and sessions                                    |
| PostgreSQL: profiles, favourites, trips, members, private      |
| inputs, votes, logistics, itineraries and memories               |
| RPC / Edge Functions: authorised mutations and workflows         |
| Row Level Security: protects private inputs and trip access      |
| Realtime: scoped change notifications; app refetches authorised |
| state                                                            |
+----------------------------+-------------------------------------+
                             |
                             v
+------------------------------------------------------------------+
| Planning Rules and Validation                                   |
| Intersect dates; calculate budget ceilings; count votes;        |
| deduct logistics; validate AI output against trip constraints.  |
| Deterministic rules govern decisions; AI assists with           |
| suggestions.                                                     |
+----------------------------+-------------------------------------+
                             |
                             v
+------------------------------------------------------------------+
| Server-side AI and media services                               |
| Travel-window ranking | Budget/logistics estimates              |
| Itinerary generation/revision | Saved-inspiration analysis      |
+-------------------+-----------------------+----------------------+
                    |                       |
                    v                       v
             +-------------+        +----------------+
             | Groq / AI  |        | OpenAI         |
             | provider   |        | text/image/audio|
             +-------------+        +----------------+

App -----------------------> OpenStreetMap tile service
App -----------------------> External travel providers (booking links)

Saved social post -> Supabase job queue -> Local media worker/FFmpeg
-> Edge Functions -> OpenAI analysis -> Saved places -> User confirms import

Notes:
- Individual budgets remain private; the group receives aggregate ceilings.
- AI outputs are validated before they are saved or displayed.
- Costs are estimates; bookings and payments happen with external providers.

Legend: -----> request/data flow   - - -> realtime notification