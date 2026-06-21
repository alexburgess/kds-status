alter table public.printers
  add column if not exists mac_address text;

alter table public.status_reports
  add column if not exists local_mac text;

drop view if exists public.latest_status_reports;
drop view if exists public.status_report_details;

create view public.status_report_details as
select
  sr.id,
  d.device_id as device_device_id,
  sr.reported_at,
  sr.received_at,
  sr.local_ip,
  sr.local_mac,
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
  sr.local_mac,
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

grant select on public.status_report_details to authenticated;
grant select on public.latest_status_reports to authenticated;
