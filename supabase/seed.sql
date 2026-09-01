-- Placeholder launch catalogue. Product/content review is required before release.
insert into public.destination_catalogue (
  id, slug, name, country, country_code, enabled, estimate_currency, estimate_min, estimate_max, estimate_status,
  travel_times, interests, climate_tags, visa_tags, accessibility_tags, transport_tags, accommodation_tags,
  primary_compromise, evidence, evidence_updated_at
) values
(
  '10000000-0000-4000-8000-000000000001', 'da-nang-vietnam', 'Da Nang', 'Vietnam', 'VN', true, 'MYR', 1400, 2400, 'estimated',
  '[{"origin":"Kuala Lumpur","minutes":180,"status":"estimated","sourceLabel":"Placeholder route fixture","sourceUrl":null,"observedAt":"2026-08-15T00:00:00Z"},{"origin":"Singapore","minutes":165,"status":"estimated","sourceLabel":"Placeholder route fixture","sourceUrl":null,"observedAt":"2026-08-15T00:00:00Z"}]',
  array['beaches','food','culture'], array['warm','tropical'], array['visa-free eligible'], array['step-free hotels'], array['direct flight','ride hailing'], array['private room','resort'],
  'Popular beachfront areas can feel busy during regional holidays.',
  '{"estimate":{"sourceLabel":"Placeholder catalogue estimate","sourceUrl":null},"visa":{"status":"estimated","sourceLabel":"Placeholder visa fixture","sourceUrl":null},"safety":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"openingHours":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"availability":{"status":"unavailable","sourceLabel":null,"sourceUrl":null}}', '2026-08-15T00:00:00Z'
),
(
  '10000000-0000-4000-8000-000000000002', 'chiang-mai-thailand', 'Chiang Mai', 'Thailand', 'TH', true, 'MYR', 1200, 2100, 'estimated',
  '[{"origin":"Kuala Lumpur","minutes":170,"status":"estimated","sourceLabel":"Placeholder route fixture","sourceUrl":null,"observedAt":"2026-08-15T00:00:00Z"},{"origin":"Singapore","minutes":180,"status":"estimated","sourceLabel":"Placeholder route fixture","sourceUrl":null,"observedAt":"2026-08-15T00:00:00Z"}]',
  array['food','temples','nature'], array['mild','dry'], array['visa-free eligible'], array['step-free hotels'], array['direct flight','ride hailing'], array['private room','boutique hotel'],
  'Seasonal air quality can materially affect outdoor plans.',
  '{"estimate":{"sourceLabel":"Placeholder catalogue estimate","sourceUrl":null},"visa":{"status":"estimated","sourceLabel":"Placeholder visa fixture","sourceUrl":null},"safety":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"openingHours":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"availability":{"status":"unavailable","sourceLabel":null,"sourceUrl":null}}', '2026-08-15T00:00:00Z'
),
(
  '10000000-0000-4000-8000-000000000003', 'penang-malaysia', 'Penang', 'Malaysia', 'MY', true, 'MYR', 800, 1600, 'estimated',
  '[{"origin":"Kuala Lumpur","minutes":60,"status":"estimated","sourceLabel":"Placeholder route fixture","sourceUrl":null,"observedAt":"2026-08-15T00:00:00Z"},{"origin":"Singapore","minutes":85,"status":"estimated","sourceLabel":"Placeholder route fixture","sourceUrl":null,"observedAt":"2026-08-15T00:00:00Z"}]',
  array['food','heritage','beaches'], array['warm','tropical'], array['domestic','visa-free eligible'], array['step-free hotels'], array['direct flight','public bus','ride hailing'], array['private room','heritage hotel'],
  'Heat and humidity may make long walking days uncomfortable.',
  '{"estimate":{"sourceLabel":"Placeholder catalogue estimate","sourceUrl":null},"visa":{"status":"estimated","sourceLabel":"Placeholder visa fixture","sourceUrl":null},"safety":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"openingHours":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"availability":{"status":"unavailable","sourceLabel":null,"sourceUrl":null}}', '2026-08-15T00:00:00Z'
),
(
  '10000000-0000-4000-8000-000000000004', 'siem-reap-cambodia', 'Siem Reap', 'Cambodia', 'KH', false, 'MYR', 1300, 2200, 'estimated',
  '[]', array['temples','history'], array['warm'], array['visa required'], '{}', array['flight'], array['private room'],
  'The disabled fixture must never appear in discovery.',
  '{"estimate":{"sourceLabel":"Placeholder catalogue estimate","sourceUrl":null},"visa":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"safety":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"openingHours":{"status":"unavailable","sourceLabel":null,"sourceUrl":null},"availability":{"status":"unavailable","sourceLabel":null,"sourceUrl":null}}', '2026-01-01T00:00:00Z'
)
on conflict (slug) do update set
  name = excluded.name, country = excluded.country, country_code = excluded.country_code, enabled = excluded.enabled,
  estimate_currency = excluded.estimate_currency, estimate_min = excluded.estimate_min, estimate_max = excluded.estimate_max,
  estimate_status = excluded.estimate_status, travel_times = excluded.travel_times, interests = excluded.interests,
  climate_tags = excluded.climate_tags, visa_tags = excluded.visa_tags, accessibility_tags = excluded.accessibility_tags,
  transport_tags = excluded.transport_tags, accommodation_tags = excluded.accommodation_tags,
  primary_compromise = excluded.primary_compromise, evidence = excluded.evidence,
  evidence_updated_at = excluded.evidence_updated_at, updated_at = now();

