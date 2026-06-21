insert into public.locations (id, name, slug)
values
  ('8efe3f9d-62ed-471d-ae7f-f41bd6db0f34', 'Downtown Kitchen', 'downtown-kitchen')
on conflict (slug) do nothing;

insert into public.devices (
  id,
  location_id,
  device_id,
  device_secret_hash,
  display_name,
  role,
  notes,
  square_kds_package_name,
  square_kds_expected_version,
  expected_settings
)
values
  (
    '9f6a3d5e-30d1-4d0f-a0cf-42ef4b447e12',
    '8efe3f9d-62ed-471d-ae7f-f41bd6db0f34',
    'expo-line-01',
    encode(digest('demo-secret', 'sha256'), 'hex'),
    'Expo Line 01',
    'Expo screen',
    'Mounted above the expo pass. Staff should confirm the printer test before service.',
    null,
    null,
    '[
      {"section":"Tickets","setting":"Display mode","expected":"Order view"},
      {"section":"Tickets","setting":"Fulfillment","expected":"Expo controls entire order"},
      {"section":"Notifications","setting":"Sound","expected":"Enabled"},
      {"section":"Hardware","setting":"Printer","expected":"Hot line printer"}
    ]'::jsonb
  ),
  (
    'f65f2c54-b5fd-451e-82be-2ec0f9a34e34',
    '8efe3f9d-62ed-471d-ae7f-f41bd6db0f34',
    'grill-01',
    encode(digest('grill-secret', 'sha256'), 'hex'),
    'Grill 01',
    'Station screen',
    'No printer expected. Verify it is on Ethernet during dinner service.',
    null,
    null,
    '[
      {"section":"Tickets","setting":"Station filter","expected":"Grill only"},
      {"section":"Tickets","setting":"Sort","expected":"Oldest first"},
      {"section":"Hardware","setting":"Printer","expected":"None"}
    ]'::jsonb
  )
on conflict (device_id) do nothing;

insert into public.printers (device_id, name, host, port, description)
select id, 'Hot line printer', '192.168.20.61', 9100, 'Expo station ticket printer'
from public.devices
where device_id = 'expo-line-01'
on conflict do nothing;

insert into public.status_reports (
  device_id,
  reported_at,
  local_ip,
  active_transport,
  internet_ok,
  internet_latency_ms,
  printer_checks,
  square_kds,
  app_version,
  diagnostics
)
select
  id,
  now() - interval '2 minutes',
  '192.168.20.44',
  'ethernet',
  true,
  41,
  '[{"printerId":"printer-hot-line","name":"Hot line printer","host":"192.168.20.61","port":9100,"ok":true,"latencyMs":8}]'::jsonb,
  '{"versionStatus":"not_configured"}'::jsonb,
  '0.1.0-demo',
  '{}'
from public.devices
where device_id = 'expo-line-01';
