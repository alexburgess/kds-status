import { z } from "zod";

export const ActiveTransportSchema = z.enum([
  "wifi",
  "ethernet",
  "cellular",
  "vpn",
  "unknown",
  "offline"
]);

export const PrinterCheckSchema = z.object({
  printerId: z.string().optional(),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  macAddress: z.string().optional(),
  ok: z.boolean(),
  latencyMs: z.number().int().nonnegative().optional(),
  error: z.string().optional()
});

export const DeviceStatusPayloadSchema = z.object({
  reportedAt: z.string().datetime().optional(),
  localIp: z.string().optional(),
  localMacAddress: z.string().optional(),
  activeTransport: ActiveTransportSchema,
  internet: z.object({
    ok: z.boolean(),
    latencyMs: z.number().int().nonnegative().optional(),
    error: z.string().optional()
  }),
  printerChecks: z.array(PrinterCheckSchema),
  squareKds: z.object({
    packageName: z.string().optional(),
    installedVersion: z.string().optional(),
    availableVersion: z.string().optional(),
    expectedVersion: z.string().optional(),
    versionStatus: z.enum(["match", "mismatch", "unknown", "not_configured", "not_installed"]),
    error: z.string().optional()
  }),
  appVersion: z.string().min(1),
  diagnostics: z.array(z.string()).default([])
});

export type DeviceStatusPayload = z.infer<typeof DeviceStatusPayloadSchema>;
