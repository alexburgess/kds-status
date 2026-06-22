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

export function normalizeMacAddress(macAddress: string | null | undefined) {
  const normalized = macAddress
    ?.trim()
    .toLowerCase()
    .replaceAll("-", ":");

  if (!normalized) {
    return undefined;
  }

  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(normalized) ? normalized : undefined;
}

export function readDeviceAuthHeaders(headers: Headers) {
  const deviceId = headers.get("x-device-id")?.trim() || undefined;
  const deviceMacAddress = normalizeMacAddress(headers.get("x-device-mac-address"));
  const deviceSecret = headers.get("x-device-secret")?.trim();

  if ((!deviceId && !deviceMacAddress) || !deviceSecret) {
    return null;
  }

  return { deviceId, deviceMacAddress, deviceSecret };
}
