import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assignDeviceIdToDefinition,
  parseDefinitionsJson,
  writeDefinitionsJson
} from "@/lib/local-definitions";

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

  it("assigns a fallback Android device ID to a selected definition", async () => {
    const previousDefinitionsPath = process.env.KDS_DEFINITIONS_PATH;
    const tempDir = await mkdtemp(join(tmpdir(), "kds-definitions-"));
    const definitionsPath = join(tempDir, "device-definitions.json");
    process.env.KDS_DEFINITIONS_PATH = definitionsPath;

    try {
      await writeDefinitionsJson(
        JSON.stringify({
          devices: [
            {
              macAddress: "aa:bb:cc:dd:ee:ff",
              displayName: "Expo KDS"
            }
          ]
        })
      );

      const device = await assignDeviceIdToDefinition("mac-aabbccddeeff", "Android-C7103D4DD888716D");
      const written = JSON.parse(await readFile(definitionsPath, "utf8"));

      expect(device).toMatchObject({
        deviceId: "android-c7103d4dd888716d",
        displayName: "Expo KDS"
      });
      expect(written.devices[0]).toMatchObject({
        deviceId: "android-c7103d4dd888716d",
        displayName: "Expo KDS"
      });
    } finally {
      if (previousDefinitionsPath === undefined) {
        delete process.env.KDS_DEFINITIONS_PATH;
      } else {
        process.env.KDS_DEFINITIONS_PATH = previousDefinitionsPath;
      }

      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
