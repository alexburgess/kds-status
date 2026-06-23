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
            fulfillmentMethods: {
              includeFutureFulfillmentMethods: true,
              methods: [
                { name: "For Here", enabled: true },
                { name: "Pergola Order", enabled: false }
              ]
            },
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
    expect(device.fulfillmentMethods).toEqual({
      includeFutureFulfillmentMethods: true,
      methods: [
        { name: "For Here", enabled: true },
        { name: "Pergola Order", enabled: false }
      ]
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

  it("rejects duplicate fulfillment methods", () => {
    expect(() =>
      parseDefinitionsJson(
        JSON.stringify({
          devices: [
            {
              macAddress: "aa:bb:cc:dd:ee:ff",
              displayName: "Expo KDS",
              fulfillmentMethods: {
                methods: [
                  { name: "For Here", enabled: true },
                  { name: " for   here ", enabled: false }
                ]
              }
            }
          ]
        })
      )
    ).toThrow("Definitions JSON has duplicate fulfillment methods.");
  });
});
