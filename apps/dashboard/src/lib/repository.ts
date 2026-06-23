import { randomUUID } from "node:crypto";
import { addDemoReport, getDemoReports } from "./demo-store";
import { normalizeMacAddress, verifyDeviceSecret, verifySharedDeviceSecret } from "./device-auth";
import { readDeviceDefinitions } from "./local-definitions";
import { lookupPlayStoreVersion } from "./play-store-version";
import { createSupabaseServiceClient, isSupabaseConfigured } from "./supabase";
import { summarizeDeviceStatus } from "./status";
import type {
  DashboardSnapshot,
  DeviceDefinition,
  DeviceDetail,
  PrinterDefinition,
  StatusReport
} from "./types";
import type { DeviceStatusPayload } from "./validation";

interface DeviceRow {
  id: string;
  device_id: string;
  mac_address: string | null;
  device_secret_hash: string;
  display_name: string;
  location_name?: string;
  role: string;
  notes: string | null;
  active: boolean;
  square_kds_package_name: string | null;
  square_kds_expected_version: string | null;
  expected_settings: Array<{ section: string; setting: string; expected: string }>;
  printers?: PrinterRow[];
}

interface PrinterRow {
  id: string;
  name: string;
  host: string;
  port: number;
  mac_address: string | null;
  description: string | null;
}

interface StatusReportRow {
  id: string;
  device_device_id?: string;
  device_id?: string;
  reported_at: string;
  local_ip: string | null;
  local_mac: string | null;
  active_transport: StatusReport["activeTransport"];
  internet_ok: boolean;
  internet_latency_ms: number | null;
  internet_error: string | null;
  printer_checks: StatusReport["printerChecks"];
  square_kds: StatusReport["squareKds"];
  app_version: string;
  diagnostics: string[] | null;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isSupabaseConfigured()) {
    const definitions = await readDeviceDefinitions();
    const reports = getDemoReports();
    const devices = definitions.map((device) => {
      const latestReport = reports.find((report) => report.deviceId === device.deviceId);
      return {
        device,
        latestReport,
        summary: summarizeDeviceStatus(device, latestReport)
      };
    });

    return {
      devices,
      generatedAt: new Date().toISOString(),
      mode: "local"
    };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is marked configured but client creation failed.");
  }

  const [devicesResult, latestResult] = await Promise.all([
    supabase
      .from("device_definitions")
      .select("*, printers(*)")
      .order("location_name", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase.from("latest_status_reports").select("*")
  ]);

  if (devicesResult.error) {
    throw devicesResult.error;
  }

  if (latestResult.error) {
    throw latestResult.error;
  }

  const reportsByDevice = new Map(
    (latestResult.data ?? []).map((row) => [row.device_device_id, mapStatusReportRow(row)])
  );

  return {
    devices: (devicesResult.data ?? []).map((row) => {
      const device = mapDeviceRow(row);
      const latestReport = reportsByDevice.get(device.deviceId);
      return {
        device,
        latestReport,
        summary: summarizeDeviceStatus(device, latestReport)
      };
    }),
    generatedAt: new Date().toISOString(),
    mode: "supabase"
  };
}

export async function getDeviceDetail(deviceId: string): Promise<DeviceDetail | null> {
  if (!isSupabaseConfigured()) {
    const definitions = await readDeviceDefinitions();
    const device = definitions.find((item) => item.deviceId === deviceId);
    if (!device) {
      return null;
    }

    const history = getDemoReports().filter((report) => report.deviceId === deviceId);
    return {
      device,
      latestReport: history[0],
      history
    };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is marked configured but client creation failed.");
  }

  const deviceResult = await supabase
    .from("device_definitions")
    .select("*, printers(*)")
    .eq("device_id", deviceId)
    .single();

  if (deviceResult.error || !deviceResult.data) {
    return null;
  }

  const historyResult = await supabase
    .from("status_report_details")
    .select("*")
    .eq("device_device_id", deviceId)
    .order("reported_at", { ascending: false })
    .limit(50);

  if (historyResult.error) {
    throw historyResult.error;
  }

  const history = (historyResult.data ?? []).map(mapStatusReportRow);

  return {
    device: mapDeviceRow(deviceResult.data),
    latestReport: history[0],
    history
  };
}

export async function authenticateDevice(credentials: {
  deviceId?: string;
  deviceMacAddress?: string;
  deviceSecret?: string;
}) {
  if (!isSupabaseConfigured()) {
    if (!verifySharedDeviceSecret(credentials.deviceSecret)) {
      return null;
    }

    const definitions = await readDeviceDefinitions();
    let device = credentials.deviceMacAddress
      ? definitions.find((item) => normalizeMacAddress(item.macAddress) === credentials.deviceMacAddress && item.active)
      : undefined;
    if (!device && credentials.deviceId) {
      device = definitions.find((item) => item.deviceId === credentials.deviceId && item.active);
    }

    return device ?? null;
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is marked configured but client creation failed.");
  }

  const select = "*, printers(*)";
  let row: DeviceRow | null = null;

  if (credentials.deviceMacAddress) {
    const result = await supabase
      .from("device_definitions")
      .select(select)
      .eq("mac_address", credentials.deviceMacAddress)
      .eq("active", true)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    row = result.data as DeviceRow | null;
  }

  if (!row && credentials.deviceId) {
    const result = await supabase
      .from("device_definitions")
      .select(select)
      .eq("device_id", credentials.deviceId)
      .eq("active", true)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    row = result.data as DeviceRow | null;
  }

  if (!row || !verifyDeviceSecret(credentials.deviceSecret, row.device_secret_hash)) {
    return null;
  }

  return mapDeviceRow(row);
}

export async function saveStatusReport(device: DeviceDefinition, payload: DeviceStatusPayload) {
  const report = normalizeStatusReport(device.deviceId, payload);

  if (!isSupabaseConfigured()) {
    return addDemoReport(report);
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is marked configured but client creation failed.");
  }

  const result = await supabase.from("status_reports").insert({
    id: report.id,
    device_id: device.id,
    reported_at: report.reportedAt,
    local_ip: report.localIp ?? null,
    local_mac: report.localMacAddress ?? null,
    active_transport: report.activeTransport,
    internet_ok: report.internet.ok,
    internet_latency_ms: report.internet.latencyMs ?? null,
    internet_error: report.internet.error ?? null,
    printer_checks: report.printerChecks,
    square_kds: report.squareKds,
    app_version: report.appVersion,
    diagnostics: report.diagnostics
  });

  if (result.error) {
    throw result.error;
  }

  return report;
}

export async function buildDeviceConfig(device: DeviceDefinition) {
  const playStoreVersion = await lookupPlayStoreVersion(device.squareKdsPackageName);
  const availableVersion = playStoreVersion.version ?? device.squareKdsExpectedVersion;

  return {
    deviceId: device.deviceId,
    displayName: device.displayName,
    locationName: device.locationName,
    role: device.role,
    notes: device.notes,
    squareKds: {
      packageName: device.squareKdsPackageName,
      availableVersion,
      expectedVersion: availableVersion,
      versionSource: playStoreVersion.version ? "play-store" : device.squareKdsExpectedVersion ? "definition-fallback" : playStoreVersion.source,
      versionLookupError: playStoreVersion.error,
      versionCheckedAt: playStoreVersion.checkedAt,
      playStoreUpdatedAt: playStoreVersion.updatedAt
    },
    expectedSettings: device.expectedSettings,
    printers: device.printers.map((printer) => ({
      ...printer,
      port: printer.port || 9100
    }))
  };
}

function normalizeStatusReport(deviceId: string, payload: DeviceStatusPayload): StatusReport {
  return {
    id: randomUUID(),
    deviceId,
    reportedAt: payload.reportedAt ?? new Date().toISOString(),
    localIp: payload.localIp,
    localMacAddress: payload.localMacAddress,
    activeTransport: payload.activeTransport,
    internet: payload.internet,
    printerChecks: payload.printerChecks,
    squareKds: payload.squareKds,
    appVersion: payload.appVersion,
    diagnostics: payload.diagnostics
  };
}

function mapDeviceRow(row: DeviceRow): DeviceDefinition {
  return {
    id: row.id,
    deviceId: row.device_id,
    macAddress: row.mac_address ?? undefined,
    displayName: row.display_name,
    locationName: row.location_name ?? "Unassigned",
    role: row.role,
    notes: row.notes ?? "",
    active: row.active,
    squareKdsPackageName: row.square_kds_package_name ?? undefined,
    squareKdsExpectedVersion: row.square_kds_expected_version ?? undefined,
    expectedSettings: row.expected_settings ?? [],
    printers: (row.printers ?? []).map(mapPrinterRow)
  };
}

function mapPrinterRow(row: PrinterRow): PrinterDefinition {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    macAddress: row.mac_address ?? undefined,
    description: row.description ?? undefined
  };
}

function mapStatusReportRow(row: StatusReportRow): StatusReport {
  return {
    id: row.id,
    deviceId: row.device_device_id ?? row.device_id ?? "unknown",
    reportedAt: row.reported_at,
    localIp: row.local_ip ?? undefined,
    localMacAddress: row.local_mac ?? undefined,
    activeTransport: row.active_transport,
    internet: {
      ok: row.internet_ok,
      latencyMs: row.internet_latency_ms ?? undefined,
      error: row.internet_error ?? undefined
    },
    printerChecks: row.printer_checks ?? [],
    squareKds: row.square_kds ?? { versionStatus: "unknown" },
    appVersion: row.app_version,
    diagnostics: row.diagnostics ?? []
  };
}
