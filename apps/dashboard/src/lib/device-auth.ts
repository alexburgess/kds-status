import { createHash, timingSafeEqual } from "node:crypto";

export const defaultSharedDeviceSecret = "kds-status-internal-v1";

export function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function verifyDeviceSecret(secret: string | undefined, expectedHash: string) {
  if (!secret) {
    return false;
  }

  const actual = Buffer.from(hashDeviceSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function verifySharedDeviceSecret(secret: string | undefined) {
  if (!secret) {
    return false;
  }

  const expected = Buffer.from(process.env.KDS_DEVICE_SHARED_SECRET ?? defaultSharedDeviceSecret, "utf8");
  const actual = Buffer.from(secret, "utf8");

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

  if (!deviceId && !deviceMacAddress) {
    return null;
  }

  return { deviceId, deviceMacAddress, deviceSecret };
}
