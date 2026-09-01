begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select ok((select relrowsecurity from pg_class where oid = 'public.invites'::regclass), 'invites has RLS enabled');
select hasnt_column('public', 'invites', 'token', 'raw invite tokens are never stored');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.create_trip('Langkawi weekend', 'destination_locked', array['Langkawi'], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'organizer creates the test Trip Room'
);

reset role;
create temporary table test_trip as select id from public.trips limit 1;
grant select on test_trip to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format(
  $$select public.manage_invite(%L, 'issue', %L, now() + interval '30 days', %L)$$,
  (select id from test_trip), repeat('a', 64), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
), 'organizer can issue an invitation');
reset role;
select is((select count(*)::integer from public.invites where revoked_at is null), 1, 'one open invitation is stored');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*)::integer from jsonb_object_keys(public.resolve_invite(repeat('a', 64)))), 4, 'resolve exposes only four preview fields');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is(
  (public.join_trip(repeat('a', 64), 'Aina', false, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')->>'status'),
  'joined', 'first guest joins without confirmation'
);
select is(
  (public.join_trip(repeat('a', 64), 'Changed name', false, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')->>'displayName'),
  'Aina', 'same device restores its existing membership'
);

select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is(
  (public.join_trip(repeat('a', 64), 'aina', false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')->>'status'),
  'confirmation_required', 'duplicate names require confirmation'
);
select is(
  (public.join_trip(repeat('a', 64), 'aina', true, 'ffffffff-ffff-4fff-8fff-ffffffffffff')->>'discriminator')::integer,
  2, 'confirmed duplicate receives a visual discriminator'
);
select throws_ok(
  format($$select public.manage_invite(%L, 'close', null, null, %L)$$, (select id from test_trip), '12121212-1212-4212-8212-121212121212'),
  '42501', 'Only the organiser can manage invitations.', 'members cannot manage invitations'
);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format(
  $$select public.manage_invite(%L, 'close', null, null, %L)$$,
  (select id from test_trip), '13131313-1313-4313-8313-131313131313'
), 'organizer can close invitations');
select is((select count(*)::integer from public.trip_members where active), 3, 'closing a link does not remove existing members');
select throws_ok(
  $$select public.resolve_invite(repeat('a', 64))$$,
  'P0002', 'Invitation is unavailable.', 'closed links reveal no trip context'
);

select * from finish();
rollback;
