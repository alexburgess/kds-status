export type ActiveTransport = "wifi" | "ethernet" | "cellular" | "vpn" | "unknown" | "offline";

export type Severity = "healthy" | "warning" | "critical" | "unknown";

export interface ExpectedSetting {
  section: string;
  setting: string;
  expected: string;
}

export interface PrinterDefinition {
  id: string;
  name: string;
  host: string;
  port: number;
  macAddress?: string;
  description?: string;
}

export interface DeviceDefinition {
  id: string;
  deviceId: string;
  displayName: string;
  locationName: string;
  role: string;
  notes: string;
  active: boolean;
  squareKdsPackageName?: string;
  squareKdsExpectedVersion?: string;
  expectedSettings: ExpectedSetting[];
  printers: PrinterDefinition[];
}

export interface InternetCheck {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface PrinterCheck {
  printerId?: string;
  name: string;
  host: string;
  port: number;
  macAddress?: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface SquareKdsCheck {
  packageName?: string;
  installedVersion?: string;
  availableVersion?: string;
  expectedVersion?: string;
  versionStatus: "match" | "mismatch" | "unknown" | "not_configured" | "not_installed";
  error?: string;
}

export interface StatusReport {
  id: string;
  deviceId: string;
  reportedAt: string;
  localIp?: string;
  localMacAddress?: string;
  activeTransport: ActiveTransport;
  internet: InternetCheck;
  printerChecks: PrinterCheck[];
  squareKds: SquareKdsCheck;
  appVersion: string;
  diagnostics: string[];
}

export interface DashboardDevice {
  device: DeviceDefinition;
  latestReport?: StatusReport;
  summary: {
    severity: Severity;
    label: string;
    checks: string[];
  };
}

export interface DashboardSnapshot {
  devices: DashboardDevice[];
  generatedAt: string;
  mode: "demo" | "supabase";
}

export interface DeviceDetail {
  device: DeviceDefinition;
  latestReport?: StatusReport;
  history: StatusReport[];
}
