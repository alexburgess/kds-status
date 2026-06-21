create extension if not exists pgcrypto;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete set null,
  device_id text not null unique,
  device_secret_hash text not null check (device_secret_hash ~ '^[a-f0-9]{64}$'),
  display_name text not null,
  role text not null,
  notes text not null default '',
  active boolean not null default true,
  square_kds_package_name text,
  square_kds_expected_version text,
  expected_settings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.printers (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  name text not null,
  host text not null,
  port integer not null default 9100 check (port between 1 and 65535),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.status_reports (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  reported_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  local_ip text,
  active_transport text not null check (
    active_transport in ('wifi', 'ethernet', 'cellular', 'vpn', 'unknown', 'offline')
  ),
  internet_ok boolean not null,
  internet_latency_ms integer check (internet_latency_ms is null or internet_latency_ms >= 0),
  internet_error text,
  printer_checks jsonb not null default '[]'::jsonb,
  square_kds jsonb not null default '{"versionStatus": "unknown"}'::jsonb,
  app_version text not null,
  diagnostics text[] not null default '{}'
);

create index locations_slug_idx on public.locations (slug);
create index devices_device_id_idx on public.devices (device_id);
create index devices_location_id_idx on public.devices (location_id);
create index printers_device_id_idx on public.printers (device_id);
create index status_reports_device_reported_idx on public.status_reports (device_id, reported_at desc);
create index status_reports_received_idx on public.status_reports (received_at desc);

create view public.device_definitions as
select
  d.id,
  d.device_id,
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

create view public.status_report_details as
select
  sr.id,
  d.device_id as device_device_id,
  sr.reported_at,
  sr.received_at,
  sr.local_ip,
  sr.active_transport,
  sr.internet_ok,
  sr.internet_latency_ms,
  sr.internet_error,
  sr.printer_checks,
  sr.square_kds,
  sr.app_version,
  sr.diagnostics
from public.status_reports sr
join public.devices d on d.id = sr.device_id;

create view public.latest_status_reports as
select distinct on (d.device_id)
  sr.id,
  d.device_id as device_device_id,
  sr.reported_at,
  sr.received_at,
  sr.local_ip,
  sr.active_transport,
  sr.internet_ok,
  sr.internet_latency_ms,
  sr.internet_error,
  sr.printer_checks,
  sr.square_kds,
  sr.app_version,
  sr.diagnostics
from public.status_reports sr
join public.devices d on d.id = sr.device_id
order by d.device_id, sr.reported_at desc;

alter table public.locations enable row level security;
alter table public.devices enable row level security;
alter table public.printers enable row level security;
alter table public.status_reports enable row level security;

create policy "Authenticated admins can read locations"
  on public.locations for select
  to authenticated
  using (true);

create policy "Authenticated admins can write locations"
  on public.locations for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated admins can read devices"
  on public.devices for select
  to authenticated
  using (true);

create policy "Authenticated admins can write devices"
  on public.devices for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated admins can read printers"
  on public.printers for select
  to authenticated
  using (true);

create policy "Authenticated admins can write printers"
  on public.printers for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated admins can read status reports"
  on public.status_reports for select
  to authenticated
  using (true);

create policy "Authenticated admins can write status reports"
  on public.status_reports for all
  to authenticated
  using (true)
  with check (true);

grant usage on schema public to authenticated;
grant select on public.device_definitions to authenticated;
grant select on public.status_report_details to authenticated;
grant select on public.latest_status_reports to authenticated;
