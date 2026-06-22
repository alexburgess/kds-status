alter table public.devices
  add column if not exists mac_address text;

create unique index if not exists devices_mac_address_unique_idx
  on public.devices (lower(mac_address))
  where mac_address is not null;

create or replace view public.device_definitions as
select
  d.id,
  d.device_id,
  d.mac_address,
  d.device_secret_hash,
  d.display_name,
  coalesce(l.name, 'Unassigned') as location_name,
  d.role,
  d.notes,
  d.active,
  d.square_kds_package_name,
  d.square_kds_expected_version,
  d.expected_settings,
  d.created_at,
  d.updated_at
from public.devices d
left join public.locations l on l.id = d.location_id;

grant select on public.device_definitions to authenticated;
