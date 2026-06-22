insert into public.locations (id, name, slug)
values
  ('8efe3f9d-62ed-471d-ae7f-f41bd6db0f34', 'Downtown Kitchen', 'downtown-kitchen')
on conflict (slug) do nothing;

insert into public.devices (
  id,
  location_id,
  device_id,
  mac_address,
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
    '02:00:00:12:34:44',
    encode(digest('demo-secret', 'sha256'), 'hex'),
    'Expo Line 01',
    'Expo screen',
    'Mounted above the expo pass. Staff should confirm the printer test before service.',
    'com.squareup.rst.kds',
    null,
    '[
      {"section":"Kitchen Routing","setting":"Routing mode","expected":"Expo controls entire order"},
      {"section":"Kitchen Routing","setting":"Station filter","expected":"All items"},
      {"section":"Sources","setting":"Accepted sources","expected":"POS, Online, Delivery"},
      {"section":"Sources","setting":"Order visibility","expected":"All open tickets"}
    ]'::jsonb
  ),
  (
    'f65f2c54-b5fd-451e-82be-2ec0f9a34e34',
    '8efe3f9d-62ed-471d-ae7f-f41bd6db0f34',
    'grill-01',
    '02:00:00:12:34:47',
    encode(digest('grill-secret', 'sha256'), 'hex'),
    'Grill 01',
    'Station screen',
    'No printer expected. Verify it is on Ethernet during dinner service.',
    null,
    null,
    '[
      {"section":"Kitchen Routing","setting":"Station filter","expected":"Grill only"},
      {"section":"Sources","setting":"Accepted sources","expected":"POS and online"},
      {"section":"Hardware","setting":"Printer","expected":"None"}
    ]'::jsonb
  )
on conflict (device_id) do nothing;

insert into public.printers (device_id, name, host, port, mac_address, description)
select id, 'Hot line printer', '192.168.20.61', 9100, '00:11:32:aa:bb:61', 'Expo station ticket printer'
from public.devices
where device_id = 'expo-line-01'
on conflict do nothing;

insert into public.status_reports (
  device_id,
  reported_at,
  local_ip,
  local_mac,
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
  '02:00:00:12:34:44',
  'ethernet',
  true,
  41,
  '[{"printerId":"printer-hot-line","name":"Hot line printer","host":"192.168.20.61","port":9100,"macAddress":"00:11:32:aa:bb:61","ok":true,"latencyMs":8}]'::jsonb,
  '{"packageName":"com.squareup.rst.kds","installedVersion":"7.12","availableVersion":"7.12","expectedVersion":"7.12","versionStatus":"match"}'::jsonb,
  '0.1.0-demo',
  '{}'
from public.devices
where device_id = 'expo-line-01';
