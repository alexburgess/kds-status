import { hashDeviceSecret } from "./device-auth";
import type { DeviceDefinition, StatusReport } from "./types";

export const demoDeviceSecret = "demo-secret";

const expoExpectedSettings = [
  { section: "General", setting: "Display Type", expected: "Expeditor" },
  { section: "Source & Fulfilment", setting: "View point of sale orders", expected: "On" },
  { section: "Source & Fulfilment", setting: "View online, kiosk, and delayed fulfillment orders", expected: "On" },
  { section: "Source & Fulfilment", setting: "Show orders", expected: "Show orders when they're placed" },
  { section: "Items & Categories", setting: "Include future kitchen routing categories", expected: "Off" },
  { section: "Items & Categories", setting: "HB Pergola Wine", expected: "On" },
  { section: "Items & Categories", setting: "HBK Charcuterie", expected: "On" },
  { section: "Items & Categories", setting: "HBK Cold Line", expected: "Off" },
  { section: "Items & Categories", setting: "HBK Expo", expected: "On" },
  { section: "Items & Categories", setting: "HBK Hot Line", expected: "On" },
  { section: "Items & Categories", setting: "HBK Pizza Line", expected: "Off" },
  { section: "Items & Categories", setting: "TVTR Cold Line", expected: "Off" },
  { section: "Items & Categories", setting: "TVTR Expo", expected: "Off" },
  { section: "Items & Categories", setting: "TVTR Hot Line", expected: "Off" },
  { section: "Items & Categories", setting: "TVTR Pizza Line", expected: "Off" },
  { section: "Items & Categories", setting: "TVTR Wine Expos", expected: "Off" },
  { section: "Tickets", setting: "Complete tickets", expected: "Complete only on this device" },
  { section: "Tickets", setting: "Staggered item prep times", expected: "Off" },
  { section: "Coursing", setting: "Course visibility", expected: "Show fired and held courses" },
  { section: "Printers", setting: "Printer Profile name", expected: "Expo Printer" }
];

const grillExpectedSettings = [
  { section: "General", setting: "Display Type", expected: "Prep" },
  { section: "Source & Fulfilment", setting: "View point of sale orders", expected: "On" },
  { section: "Source & Fulfilment", setting: "View online, kiosk, and delayed fulfillment orders", expected: "Off" },
  { section: "Source & Fulfilment", setting: "Show orders", expected: "Show orders when marked in progress" },
  { section: "Items & Categories", setting: "Include future kitchen routing categories", expected: "Off" },
  { section: "Items & Categories", setting: "HBK Hot Line", expected: "On" },
  { section: "Tickets", setting: "Complete tickets", expected: "Complete on all devices" },
  { section: "Tickets", setting: "Staggered item prep times", expected: "On" },
  { section: "Coursing", setting: "Course visibility", expected: "Only show fired courses" },
  { section: "Printers", setting: "Printer Profile name", expected: "Not configured" }
];

export const demoDevices: Array<DeviceDefinition & { deviceSecretHash: string }> = [
  {
    id: "9f6a3d5e-30d1-4d0f-a0cf-42ef4b447e12",
    deviceId: "expo-line-01",
    macAddress: "02:00:00:12:34:44",
    deviceSecretHash: hashDeviceSecret(demoDeviceSecret),
    displayName: "Expo Line 01",
    locationName: "Downtown Kitchen",
    role: "Expo screen",
    notes: "Mounted above the expo pass. Staff should confirm the printer test before service.",
    active: true,
    squareKdsPackageName: "com.squareup.rst.kds",
    squareKdsExpectedVersion: undefined,
    printers: [
      {
        id: "printer-hot-line",
        name: "Hot line printer",
        host: "192.168.20.61",
        port: 9100,
        macAddress: "00:11:32:aa:bb:61",
        description: "Expo station ticket printer"
      }
    ],
    expectedSettings: expoExpectedSettings
  },
  {
    id: "f65f2c54-b5fd-451e-82be-2ec0f9a34e34",
    deviceId: "grill-01",
    macAddress: "02:00:00:12:34:47",
    deviceSecretHash: hashDeviceSecret("grill-secret"),
    displayName: "Grill 01",
    locationName: "Downtown Kitchen",
    role: "Station screen",
    notes: "No printer expected. Verify it is on Ethernet during dinner service.",
    active: true,
    squareKdsPackageName: undefined,
    squareKdsExpectedVersion: undefined,
    printers: [],
    expectedSettings: grillExpectedSettings
  }
];

export const demoStatusReports: StatusReport[] = [
  {
    id: "report-demo-expo",
    deviceId: "expo-line-01",
    reportedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    localIp: "192.168.20.44",
    localMacAddress: "02:00:00:12:34:44",
    activeTransport: "ethernet",
    internet: { ok: true, latencyMs: 41 },
    printerChecks: [
      {
        printerId: "printer-hot-line",
        name: "Hot line printer",
        host: "192.168.20.61",
        port: 9100,
        macAddress: "00:11:32:aa:bb:61",
        ok: true,
        latencyMs: 8
      }
    ],
    squareKds: {
      packageName: "com.squareup.rst.kds",
      installedVersion: "7.12",
      availableVersion: "7.12",
      expectedVersion: "7.12",
      versionStatus: "match"
    },
    appVersion: "0.1.0-demo",
    diagnostics: []
  },
  {
    id: "report-demo-grill",
    deviceId: "grill-01",
    reportedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    localIp: "192.168.20.47",
    localMacAddress: "02:00:00:12:34:47",
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
