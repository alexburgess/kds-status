import type { DeviceDefinition, Severity, StatusReport } from "./types";

const STALE_AFTER_MS = 10 * 60 * 1000;

export function isStale(report?: StatusReport, now = Date.now()) {
  if (!report) {
    return true;
  }

  return now - new Date(report.reportedAt).getTime() > STALE_AFTER_MS;
}

export function summarizeDeviceStatus(device: DeviceDefinition, report?: StatusReport) {
  const checks: string[] = [];

  if (!device.active) {
    return {
      severity: "unknown" as Severity,
      label: "Inactive",
      checks: ["Device is disabled in definitions"]
    };
  }

  if (!report) {
    return {
      severity: "unknown" as Severity,
      label: "No reports",
      checks: ["No status report has been received"]
    };
  }

  if (isStale(report)) {
    checks.push("Last report is stale");
  }

  if (!report.internet.ok) {
    checks.push(report.internet.error ? `Internet: ${report.internet.error}` : "Internet check failed");
  }

  const failingPrinters = report.printerChecks.filter((printer) => !printer.ok);
  for (const printer of failingPrinters) {
    checks.push(`Printer ${printer.name}: ${printer.error ?? "unreachable"}`);
  }

  if (report.squareKds.versionStatus === "mismatch") {
    checks.push(
      `Square KDS version mismatch: ${report.squareKds.installedVersion ?? "unknown"} expected ${
        report.squareKds.expectedVersion ?? device.squareKdsExpectedVersion ?? "configured version"
      }`
    );
  }

  if (report.squareKds.versionStatus === "not_installed") {
    checks.push("Square KDS app is not installed or not visible");
  }

  if (checks.length === 0) {
    return {
      severity: "healthy" as Severity,
      label: "Healthy",
      checks: ["All reported checks are passing"]
    };
  }

  const severity: Severity =
    !report.internet.ok || failingPrinters.length > 0 || report.squareKds.versionStatus === "not_installed"
      ? "critical"
      : "warning";

  return {
    severity,
    label: severity === "critical" ? "Needs attention" : "Review",
    checks
  };
}

export function compareVersion(installed?: string, expected?: string) {
  if (!expected) {
    return "unknown";
  }

  if (!installed) {
    return "not_installed";
  }

  return installed === expected ? "match" : "mismatch";
}
