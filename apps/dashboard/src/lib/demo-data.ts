import { hashDeviceSecret } from "./device-auth";
import type { DeviceDefinition, StatusReport } from "./types";

export const demoDeviceSecret = "demo-secret";

export const demoDevices: Array<DeviceDefinition & { deviceSecretHash: string }> = [
  {
    id: "9f6a3d5e-30d1-4d0f-a0cf-42ef4b447e12",
    deviceId: "expo-line-01",
    deviceSecretHash: hashDeviceSecret(demoDeviceSecret),
    displayName: "Expo Line 01",
    locationName: "Downtown Kitchen",
    role: "Expo screen",
    notes: "Mounted above the expo pass. Staff should confirm the printer test before service.",
    active: true,
    squareKdsPackageName: undefined,
    squareKdsExpectedVersion: undefined,
    printers: [
      {
        id: "printer-hot-line",
        name: "Hot line printer",
        host: "192.168.20.61",
        port: 9100,
        description: "Expo station ticket printer"
      }
    ],
    expectedSettings: [
      { section: "Tickets", setting: "Display mode", expected: "Order view" },
      { section: "Tickets", setting: "Fulfillment", expected: "Expo controls entire order" },
      { section: "Notifications", setting: "Sound", expected: "Enabled" },
      { section: "Hardware", setting: "Printer", expected: "Hot line printer" }
    ]
  },
  {
    id: "f65f2c54-b5fd-451e-82be-2ec0f9a34e34",
    deviceId: "grill-01",
    deviceSecretHash: hashDeviceSecret("grill-secret"),
    displayName: "Grill 01",
    locationName: "Downtown Kitchen",
    role: "Station screen",
    notes: "No printer expected. Verify it is on Ethernet during dinner service.",
    active: true,
    squareKdsPackageName: undefined,
    squareKdsExpectedVersion: undefined,
    printers: [],
    expectedSettings: [
      { section: "Tickets", setting: "Station filter", expected: "Grill only" },
      { section: "Tickets", setting: "Sort", expected: "Oldest first" },
      { section: "Hardware", setting: "Printer", expected: "None" }
    ]
  }
];

export const demoStatusReports: StatusReport[] = [
  {
    id: "report-demo-expo",
    deviceId: "expo-line-01",
    reportedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    localIp: "192.168.20.44",
    activeTransport: "ethernet",
    internet: { ok: true, latencyMs: 41 },
    printerChecks: [
      {
        printerId: "printer-hot-line",
        name: "Hot line printer",
        host: "192.168.20.61",
        port: 9100,
        ok: true,
        latencyMs: 8
      }
    ],
    squareKds: {
      versionStatus: "not_configured"
    },
    appVersion: "0.1.0-demo",
    diagnostics: []
  },
  {
    id: "report-demo-grill",
    deviceId: "grill-01",
    reportedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    localIp: "192.168.20.47",
    activeTransport: "wifi",
    internet: { ok: true, latencyMs: 58 },
    printerChecks: [],
    squareKds: {
      versionStatus: "not_configured"
    },
    appVersion: "0.1.0-demo",
    diagnostics: ["Report is intentionally stale in demo data"]
  }
];
