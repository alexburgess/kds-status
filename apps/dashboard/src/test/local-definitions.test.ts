import { describe, expect, it } from "vitest";
import { parseDefinitionsJson } from "@/lib/local-definitions";

describe("local JSON definitions", () => {
  it("normalizes a minimal MAC-address device definition", () => {
    const [device] = parseDefinitionsJson(
      JSON.stringify({
        devices: [
          {
            macAddress: "AA-BB-CC-DD-EE-FF",
            displayName: "Expo KDS",
            printers: [{ name: "Expo Printer", host: "10.0.70.2" }]
          }
        ]
      })
    );

    expect(device).toMatchObject({
      deviceId: "mac-aabbccddeeff",
      macAddress: "aa:bb:cc:dd:ee:ff",
      displayName: "Expo KDS",
      active: true,
      locationName: "Unassigned"
    });
    expect(device.printers[0]).toMatchObject({
      id: "printer-expo-printer",
      port: 9100
    });
  });

  it("rejects invalid MAC addresses", () => {
    expect(() =>
      parseDefinitionsJson(
        JSON.stringify({
          devices: [{ macAddress: "replace-me", displayName: "Expo KDS" }]
        })
      )
    ).toThrow("Definitions JSON has invalid values.");
  });
});
