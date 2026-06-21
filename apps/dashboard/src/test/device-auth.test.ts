import { describe, expect, it } from "vitest";
import { hashDeviceSecret, verifyDeviceSecret } from "@/lib/device-auth";

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
