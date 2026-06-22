import { describe, expect, it } from "vitest";
import {
  hashDeviceSecret,
  normalizeMacAddress,
  readDeviceAuthHeaders,
  verifyDeviceSecret
} from "@/lib/device-auth";

describe("device secret verification", () => {
  it("accepts the matching raw secret", () => {
    const hash = hashDeviceSecret("demo-secret");

    expect(verifyDeviceSecret("demo-secret", hash)).toBe(true);
  });

  it("rejects a different secret", () => {
    const hash = hashDeviceSecret("demo-secret");

    expect(verifyDeviceSecret("wrong-secret", hash)).toBe(false);
  });
});

describe("device auth headers", () => {
  it("accepts MAC address identity with a secret", () => {
    const parsed = readDeviceAuthHeaders(
      new Headers({
        "X-Device-Mac-Address": "02-00-00-12-34-44",
        "X-Device-Secret": "demo-secret"
      })
    );

    expect(parsed).toEqual({
      deviceId: undefined,
      deviceMacAddress: "02:00:00:12:34:44",
      deviceSecret: "demo-secret"
    });
  });

  it("rejects requests without a usable identifier", () => {
    const parsed = readDeviceAuthHeaders(
      new Headers({
        "X-Device-Mac-Address": "not-a-mac",
        "X-Device-Secret": "demo-secret"
      })
    );

    expect(parsed).toBeNull();
  });
});

describe("MAC normalization", () => {
  it("normalizes common MAC address separators", () => {
    expect(normalizeMacAddress("AA-BB-CC-DD-EE-FF")).toBe("aa:bb:cc:dd:ee:ff");
  });
});
