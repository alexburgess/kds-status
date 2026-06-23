import { describe, expect, it } from "vitest";
import { compareVersion, summarizeDeviceStatus } from "@/lib/status";
import type { DeviceDefinition, StatusReport } from "@/lib/types";

const device: DeviceDefinition = {
  id: "test-device",
  deviceId: "expo-line-01",
  macAddress: "02:00:00:12:34:44",
  displayName: "Expo Line 01",
  locationName: "Test Kitchen",
  role: "Expo screen",
  notes: "",
  active: true,
  squareKdsPackageName: "com.squareup.rst.kds",
  expectedSettings: [],
  printers: []
};

describe("status summary", () => {
  it("marks a fresh passing report as healthy", () => {
    const report: StatusReport = {
      id: "ok-report",
      deviceId: device.deviceId,
      reportedAt: new Date().toISOString(),
      localIp: "192.168.1.10",
      activeTransport: "ethernet",
      internet: { ok: true },
      printerChecks: [
        {
          name: "Printer",
          host: "192.168.1.20",
          port: 9100,
          ok: true
        }
      ],
      squareKds: { versionStatus: "not_configured" },
      appVersion: "0.1.0",
      diagnostics: []
    };

    expect(summarizeDeviceStatus(device, report)).toMatchObject({
      severity: "healthy",
      label: "Healthy"
    });
  });

  it("marks failed printer checks as critical", () => {
    const report: StatusReport = {
      id: "printer-fail",
      deviceId: device.deviceId,
      reportedAt: new Date().toISOString(),
      localIp: "192.168.1.10",
      activeTransport: "wifi",
      internet: { ok: true },
      printerChecks: [
        {
          name: "Expo printer",
          host: "192.168.1.20",
          port: 9100,
          ok: false,
          error: "Connection timed out"
        }
      ],
      squareKds: { versionStatus: "not_configured" },
      appVersion: "0.1.0",
      diagnostics: []
    };

    expect(summarizeDeviceStatus(device, report).severity).toBe("critical");
  });
});

describe("version comparison", () => {
  it("compares exact configured versions", () => {
    expect(compareVersion("6.0.1", "6.0.1")).toBe("match");
    expect(compareVersion("6.0.0", "6.0.1")).toBe("mismatch");
  });

  it("summarizes mismatches against the available Play Store version", () => {
    const report: StatusReport = {
      id: "version-mismatch",
      deviceId: device.deviceId,
      reportedAt: new Date().toISOString(),
      localIp: "192.168.1.10",
      activeTransport: "ethernet",
      internet: { ok: true },
      printerChecks: [],
      squareKds: {
        packageName: "com.squareup.rst.kds",
        installedVersion: "7.11",
        availableVersion: "7.12",
        versionStatus: "mismatch"
      },
      appVersion: "0.1.0",
      diagnostics: []
    };

    expect(summarizeDeviceStatus(device, report).checks).toContain(
      "Square KDS version mismatch: 7.11 available 7.12"
    );
  });
});
