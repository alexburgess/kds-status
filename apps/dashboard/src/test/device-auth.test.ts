import { describe, expect, it } from "vitest";
import {
  defaultSharedDeviceSecret,
  hashDeviceSecret,
  normalizeMacAddress,
  readDeviceAuthHeaders,
  verifyDeviceSecret,
  verifySharedDeviceSecret
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
  it("accepts MAC address identity", () => {
    const parsed = readDeviceAuthHeaders(
      new Headers({
        "X-Device-Mac-Address": "02-00-00-12-34-44"
      })
    );

    expect(parsed).toEqual({
      deviceId: undefined,
      deviceMacAddress: "02:00:00:12:34:44",
      deviceSecret: undefined
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

describe("shared internal device secret", () => {
  it("accepts the baked-in default secret", () => {
    expect(verifySharedDeviceSecret(defaultSharedDeviceSecret)).toBe(true);
  });

  it("rejects missing shared secrets", () => {
    expect(verifySharedDeviceSecret(undefined)).toBe(false);
  });
});

describe("MAC normalization", () => {
  it("normalizes common MAC address separators", () => {
    expect(normalizeMacAddress("AA-BB-CC-DD-EE-FF")).toBe("aa:bb:cc:dd:ee:ff");
  });
});
