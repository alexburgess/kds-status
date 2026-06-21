import { createHash, timingSafeEqual } from "node:crypto";

export function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function verifyDeviceSecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(hashDeviceSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function readDeviceAuthHeaders(headers: Headers) {
  const deviceId = headers.get("x-device-id")?.trim();
  const deviceSecret = headers.get("x-device-secret")?.trim();

  if (!deviceId || !deviceSecret) {
    return null;
  }

  return { deviceId, deviceSecret };
}
