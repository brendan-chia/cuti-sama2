begin;
select plan(7);

select tests.create_supabase_user('destination_lock_owner');
select tests.authenticate_as('destination_lock_owner');

select public.create_trip('Kuala Lumpur trip', 'destination_locked', array['Kuala Lumpur'], null, null, '40404040-4040-4040-8040-404040404040');

select is((select locked_destination_name from public.trips where name = 'Kuala Lumpur trip'), 'Kuala Lumpur', 'the declared destination is locked at creation');
select like((select locked_destination_option_id from public.trips where name = 'Kuala Lumpur trip'), 'manual:%', 'the lock uses a manual destination option ID');
select ok((select destination_locked_at is not null from public.trips where name = 'Kuala Lumpur trip'), 'the destination lock has a timestamp');
select is((select planning_phase from public.trips where name = 'Kuala Lumpur trip'), 'itinerary_planning', 'the trip advances to itinerary planning');

select public.create_trip('Shortlist trip', 'shortlist', array['Penang', 'Ipoh'], null, null, '50505050-5050-4050-8050-505050505050');

select is((select locked_destination_name from public.trips where name = 'Shortlist trip'), null::text, 'shortlist destinations are not automatically locked');
select is((select destination_locked_at from public.trips where name = 'Shortlist trip'), null::timestamptz, 'shortlist remains unlocked');
select is((select planning_phase from public.trips where name = 'Shortlist trip'), 'destination_voting', 'shortlist remains in destination voting');

select * from finish();
rollback;
