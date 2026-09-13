# CutiSama2 by Starstruck

**Team:** Brendan Chia Yan Fei, Neo Li Xin, Chew Chiu Xian  
**Problem Statement:** Travel Planner  
**Video Presentation:** [Youtube Link](https://www.youtube.com/watch?v=SmZNXjGssQs)

**Presentation Slides:** [View the CutiSama2 pitch deck on Canva](https://canva.link/e0cj10tgzjpw03b)

## 1. Project Overview

### The Problem

Most travel apps only handle one piece of this with either bookings, or budgeting, or itineraries. So travellers end up manually piecing it all together themselves. Group trips make it worse, since getting everyone's schedules, budgets, and preferences to line up is genuinely difficult. And when something changes mid-trip, there's rarely any real help from existing platforms in adjusting.

Our target users are students, budget-conscious travellers and friend groups. The stakeholders are both the organiser coordinating decisions and the participants whose availability, interests and financial limits determine whether the plan works.

### Our Solution

CutiSama2 turns travel planning into a guided quest: agree on dates, set private budgets, choose countries, vote, explore places and arrange logistics. Everyone contributes through a shared process, while the organiser confirms key decisions. Solo mode removes group voting so independent travellers can plan directly. Personal profiles, favourite places, saved inspiration and trip history give travellers reasons to return for their next adventure.

| Feature | What travellers can do |
| --- | --- |
| Group planning quest | Submit availability, nominate countries and vote before the organiser confirms shared decisions. |
| Private budget ranges | Set comfortable spending and an absolute maximum in MYR without exposing individual amounts to the group. |
| Solo trips | Choose dates and a destination directly, without waiting for group submissions or votes. |
| Personalisation and favourites | Save a display name, profile picture and up to 30 favourite places. |
| Personal account settings | Start with an anonymous identity and access account settings to retain a personal travel identity. |
| Saved inspiration | Save travel posts, review extracted places and explicitly confirm locations to use in a trip. Media analysis requires its configured worker. |
| Maps and attraction choices | Explore destination attractions and contribute places to the shared plan. |
| Logistics and AI planning | Record transport, compare stays and generate a draft itinerary using the trip's constraints. Estimates are not live booking quotes. |
| Trips and memories | Reopen saved trips and access completed-trip memories from the profile. |
| Invitations and discovery | Invite friends and access public-trip discovery and listing controls. Joining is subject to trip eligibility and membership rules. |

Favourite places are currently saved profile data; this does not imply that every recommendation automatically uses them. Saved inspiration has a separate, explicit place-import flow.

### Competitive Market

| Alternative | Existing strengths | CutiSama2's intended focus |
| --- | --- | --- |
| [Wanderlog](https://wanderlog.com/) | Itinerary planning, maps, collaboration, budgeting and AI assistance. | Guided group agreement, private comfort/hard budget ranges and explicit voting rules. |
| [Mindtrip](https://mindtrip.ai/) | AI-generated itineraries, group collaboration, personalised recommendations and the ability to turn saved social or web inspiration into trip plans. | Use explicit decision rules and private affordability limits to balance the needs of the whole group before producing the itinerary. |
| [TRIPTI.ai](https://tripti.ai/) | Pre-booking group coordination through date scheduling, decision cards, reminders, shared itineraries and expense splitting. | Extend the guided agreement process across dates, destination voting and private comfort/maximum budgets, with affordability enforced as a shared constraint. |
| [Trip.com Trip.Planner](https://www.trip.com/tripplanner) | AI itinerary generation connected to real-time flights, trains, hotels, restaurants, attractions and an established booking ecosystem. | Help friend groups agree on when and where to travel, and what everyone can afford, before they reach the booking stage. |

## 2. Ideation & Process

### 2.1 Ideas We Considered

This table summarises the current implementation and directions raised by the judges. It is not a complete historical brainstorming record; the team should add any other original ideas before submission.

| Idea | Why it was dropped / kept |
| --- | --- |
| Guided group planning quest (Chosen) | Gives the organiser and participants a shared sequence of decisions. |
| Private budget ranges (Chosen) | Makes affordability part of planning without identifying the lowest-budget traveller. |
| Previous trips and memories (Chosen) | Supports returning users and continuity after a trip ends. |
| Invitations and public discovery (Chosen) | Supports existing friends and discoverable trips, subject to joining rules. |
| AI assistance with validated constraints (Chosen) | Helps with suggestions while keeping key decisions explainable. |
| Automatic personalisation from all favourites (Future evaluation) | Saving favourites exists; broader recommendation integration needs explicit design and validation. |
| Card-game interface, with each card representing a travel idea (Dropped) | The card metaphor made the experience playful, but it limited how much information users could compare at once. Dates, budgets, destinations and logistics need clear forms and summaries, so using cards for every decision would add extra steps and make planning harder to scan. The guided quest concept kept the sense of progression without making every interaction behave like a card game. |

### 2.2 Ideation Boards

The following boards document the team's ideation process and the development of the CutiSama2 concept.

#### Ideation 1

![Ideation board 1](assets/images/ideation1.jpg)

#### Ideation 2

![Ideation board 2](assets/images/ideation2.jpg)

#### Ideation 3

![Ideation board 3](assets/images/ideation3.jpg)

### 2.3 Mentor Consultation

The following feedback was discussed with Jeremy Lau Wei Han on 7 September 2026. Existing features are noted as responses to the feedback.

| Date | Mentor | Feedback Received | What Was Changed |
| --- | --- | --- | --- |
| 7/9/2026 | Jeremy Lau Wei Han | Add favourites, personalisation and accounts. | Allow them to register an account, they can also use this app to save places they want to visit in the future |
| 7/9/2026 | Jeremy Lau Wei Han | View previous trips; consider longevity and whether people will use it. | Added trips and memories, repeat-use rationale and a proposed validation plan. |
| 7/9/2026 | Jeremy Lau Wei Han | Allow friends and public joining. | Add discovery features for users to request joining other travel groups|
| 7/9/2026 | Jeremy Lau Wei Han | Highlight the algorithm; consider Gemini for budget recommendations. | Added decision rules, an affordability example and the distinction between AI estimates and personal spending limits. |
| 7/9/2026 | Jeremy Lau Wei Han | Include competitive analysis and a clearer problem statement. | Added target stakeholders and competitive analysis |
| 7/9/2026 | Jeremy Lau Wei Han | Too much text; avoid repetitive organiser/participant demonstrations. | Made the choice to just demo using one scree, not two screens |

## 3. Design & Prototype

**UI Prototype:** [View the CutiSama2 prototype on Canva](https://canva.link/jv8y05dy9n6exli)

## 4. What Makes It Different

CutiSama2 combines structured group decision-making with personal travel continuity. Its distinctive features are:

| Feature | What makes it different |
| --- | --- |
| Reels to saved places | Travellers can save a public Instagram Reel or TikTok, let CutiSama2 extract the places mentioned or shown, review the results, and confirm selected locations for a future trip. This turns travel inspiration into usable planning data instead of leaving it buried in social media bookmarks. |
| Personal travel passport | Profiles, favourite places, saved inspiration, previous trips and memories make the product useful between trips. |
| Private comfort and maximum budgets | Participants contribute real limits without exposing individual amounts. The group plan uses the lowest comfort and maximum ceilings so the itinerary remains affordable for everyone. |
| AI within validated rules | AI ranks or estimates options, while deterministic checks enforce dates, budgets, destination constraints and privacy. |
| Guided planning quest | Dates, budgets, destinations, attractions and logistics are completed as clear stages. This reduces organiser chasing and makes progress visible. |

Compared with general itinerary tools, the twist is that CutiSama2 makes agreement and affordability first-class decisions before generating a plan.

## 5. Technical Architecture & Feasibility

### Technology stack and services

| Component | Technology and responsibility | Deployment / hosting |
| --- | --- | --- |
| Frontend | Expo SDK 57, Expo Router, React Native and TypeScript provide one application codebase for Android, iOS and web. The client renders the planning quest, calls authenticated backend endpoints and displays shared trip state. | The prototype runs through the Expo development runtime or as a static web export. Production Android and iOS binaries are intended to be created with [EAS Build](https://docs.expo.dev/build/introduction/) and distributed through Google Play and the Apple App Store. |
| Backend | Supabase Auth manages guest and linked accounts. Supabase Edge Functions handle protected workflows and provider calls, while PostgreSQL RPC functions enforce trip roles, stage transitions, voting and idempotent mutations. | The backend functions are deployed to the team's managed Supabase Cloud project. API keys are stored as Supabase Edge Function secrets and are never bundled into the mobile or web client. |
| Database and storage | Supabase PostgreSQL stores profiles, memberships, trips, private budget submissions, votes, itineraries and saved inspiration. Row Level Security restricts access, Realtime sends change notifications, and Supabase Storage holds private profile media. | PostgreSQL, Realtime and Storage are hosted in the same managed Supabase project. Database migrations in the repository define and version the schema. |
| AI APIs | Groq structured-output models assist with date ranking, budget and transport estimates, and itinerary generation. OpenAI models support saved-inspiration analysis, online place discovery, accommodation suggestions and vision processing; Whisper provides timestamped audio transcription. Deterministic application rules validate generated results before they are stored. | All AI requests are made from Supabase Edge Functions. Provider credentials remain server-side. Availability, latency, rate limits and per-request cost must be monitored in production. |
| Maps and place lookup | OpenStreetMap raster tiles provide the map, and Photon/OpenStreetMap records help resolve extracted or recommended place names to real locations. | These are external public services accessed over the network. The prototype follows OpenStreetMap attribution and tile-use requirements; higher traffic may require a commercial tile provider or a separately operated Photon instance. |
| Media-processing service | A Node.js worker downloads permitted public Instagram or TikTok media, uses FFmpeg to sample video scenes and sends bounded image/audio evidence to the analysis pipeline. | This worker currently runs on a team-controlled computer for the prototype. A production release would require deploying it as a separate secured worker service with monitoring, job retries and controlled storage. |

### Hosting plan and current status

- **Currently hosted:** the PostgreSQL database, authentication, Realtime, Storage and deployed Edge Functions run on Supabase Cloud.
- **Prototype client:** the Expo application is run on development devices, while the configured static web build can be exported for browser demonstrations.
- **Planned production hosting:** use [EAS Hosting](https://docs.expo.dev/deploy/web/) for the static Expo web application and EAS Build for signed Android and iOS releases submitted to Google Play and the Apple App Store.
- **Not yet production-hosted:** the media-processing worker and the final store/web releases. Production rollout still requires EAS configuration, domains, environment secrets, monitoring, quotas and release validation.

### System architecture diagram

![CutiSama2 system architecture](assets/images/cutisama2-arch-diagram.png)

The diagram shows the main request and data flow. Deterministic rules protect privacy and trip constraints while AI assists with ranking, estimates and media analysis.

### Build plan & scope

The build phase focuses on a demonstrable end-to-end path:

1. Create or enter a trip as a solo traveller or group organiser.
2. Collect availability and private comfort/maximum budgets.
3. Select and vote on destinations, then explore attractions on the map.
4. Add transport and accommodation estimates and review the remaining budget.
5. Generate a constrained draft itinerary and show its assumptions clearly.
6. Save the trip, reopen it from trip history and show favourite places or saved inspiration.

The scope excludes live booking, payment processing, guaranteed prices, turn-by-turn navigation and a full social network. Booking links open external providers. These boundaries keep the prototype feasible while demonstrating the core value: helping travellers reach an affordable, explainable plan together.
