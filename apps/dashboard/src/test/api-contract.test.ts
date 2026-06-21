import { describe, expect, it } from "vitest";
import { DeviceStatusPayloadSchema } from "@/lib/validation";

describe("device status payload schema", () => {
  it("accepts a complete Android report", () => {
    const parsed = DeviceStatusPayloadSchema.safeParse({
      localIp: "192.168.20.44",
      activeTransport: "ethernet",
      internet: {
        ok: true,
        latencyMs: 34
      },
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
        packageName: "com.squareup.kds",
        installedVersion: "6.0.1",
        expectedVersion: "6.0.1",
        versionStatus: "match"
      },
      appVersion: "0.1.0",
      diagnostics: []
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid printer ports", () => {
    const parsed = DeviceStatusPayloadSchema.safeParse({
      activeTransport: "wifi",
      internet: { ok: true },
      printerChecks: [
        {
          name: "Bad printer",
          host: "192.168.20.61",
          port: 70000,
          ok: false
        }
      ],
      squareKds: {
        versionStatus: "unknown"
      },
      appVersion: "0.1.0",
      diagnostics: []
    });

    expect(parsed.success).toBe(false);
  });
});
