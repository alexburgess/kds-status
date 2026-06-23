import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { normalizeMacAddress } from "./device-auth";
import type { DeviceDefinition, FulfillmentMethodsDefinition, PrinterDefinition } from "./types";

const ExpectedSettingSchema = z.object({
  section: z.string().min(1),
  setting: z.string().min(1),
  expected: z.string().min(1)
});

const PrinterDefinitionInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  macAddress: z.string().optional().nullable(),
  description: z.string().optional().nullable()
});

const FulfillmentMethodInputSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean()
});

const FulfillmentMethodsInputSchema = z.object({
  includeFutureFulfillmentMethods: z.boolean().optional(),
  methods: z.array(FulfillmentMethodInputSchema).optional()
});

const DeviceDefinitionInputSchema = z.object({
  id: z.string().optional(),
  deviceId: z.string().optional(),
  macAddress: z.string().min(1),
  displayName: z.string().min(1),
  locationName: z.string().optional(),
  role: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  squareKdsPackageName: z.string().optional().nullable(),
  squareKdsExpectedVersion: z.string().optional().nullable(),
  fulfillmentMethods: FulfillmentMethodsInputSchema.optional(),
  expectedSettings: z.array(ExpectedSettingSchema).optional(),
  printers: z.array(PrinterDefinitionInputSchema).optional()
});

export const DeviceDefinitionsDocumentSchema = z.object({
  devices: z.array(DeviceDefinitionInputSchema)
});

type DeviceDefinitionsDocumentInput = z.infer<typeof DeviceDefinitionsDocumentSchema>;

export interface DefinitionEditorState {
  jsonText: string;
  deviceCount: number;
  filePath: string;
  error?: string;
}

export interface DeviceClaimOption {
  deviceId: string;
  displayName: string;
  locationName: string;
  role: string;
  macAddress?: string;
  active: boolean;
}

export class DefinitionValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[]
  ) {
    super(message);
    this.name = "DefinitionValidationError";
  }
}

export const emptyDefinitionsDocument = { devices: [] };

export function getDefinitionsFilePath() {
  return process.env.KDS_DEFINITIONS_PATH ?? path.join(process.cwd(), ".local-data", "device-definitions.json");
}

export async function getDefinitionsEditorState(): Promise<DefinitionEditorState> {
  const filePath = getDefinitionsFilePath();
  const rawText = await readRawDefinitionsText();

  if (!rawText) {
    return {
      jsonText: stringifyDefinitions(emptyDefinitionsDocument),
      deviceCount: 0,
      filePath
    };
  }

  try {
    const devices = parseDefinitionsJson(rawText);

    return {
      jsonText: stringifyDefinitions({ devices }),
      deviceCount: devices.length,
      filePath
    };
  } catch (error) {
    return {
      jsonText: rawText,
      deviceCount: 0,
      filePath,
      error: error instanceof Error ? error.message : "The definitions file could not be parsed."
    };
  }
}

export async function readDeviceDefinitions() {
  const rawText = await readRawDefinitionsText();

  if (!rawText) {
    return [];
  }

  return parseDefinitionsJson(rawText);
}

export async function writeDefinitionsJson(jsonText: string) {
  const devices = parseDefinitionsJson(jsonText);
  const filePath = getDefinitionsFilePath();
  const nextText = stringifyDefinitions({ devices });

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${nextText}\n`, "utf8");

  return {
    jsonText: nextText,
    deviceCount: devices.length,
    filePath
  };
}

export async function getDeviceClaimOptions(): Promise<DeviceClaimOption[]> {
  const devices = await readDeviceDefinitions();

  return devices.map((device) => ({
    deviceId: device.deviceId,
    displayName: device.displayName,
    locationName: device.locationName,
    role: device.role,
    macAddress: device.macAddress,
    active: device.active
  }));
}

export async function assignDeviceIdToDefinition(targetDeviceId: string, nextDeviceId: string) {
  const normalizedTargetDeviceId = normalizeDeviceId(targetDeviceId);
  const normalizedNextDeviceId = normalizeDeviceId(nextDeviceId);

  if (!normalizedTargetDeviceId) {
    throw new DefinitionValidationError("Device selection is invalid.", ["targetDeviceId is required."]);
  }

  if (!normalizedNextDeviceId?.startsWith("android-")) {
    throw new DefinitionValidationError("Fallback device ID is invalid.", [
      "deviceId must be the android-... value shown on the tablet."
    ]);
  }

  const devices = await readDeviceDefinitions();
  const targetIndex = devices.findIndex((device) => device.deviceId === normalizedTargetDeviceId);

  if (targetIndex === -1) {
    throw new DefinitionValidationError("Device selection was not found.", [
      `No definition exists for deviceId ${normalizedTargetDeviceId}.`
    ]);
  }

  const duplicateDevice = devices.find(
    (device, index) => index !== targetIndex && device.deviceId === normalizedNextDeviceId
  );

  if (duplicateDevice) {
    throw new DefinitionValidationError("Fallback device ID is already assigned.", [
      `${normalizedNextDeviceId} is already assigned to ${duplicateDevice.displayName}.`
    ]);
  }

  const nextDevices = devices.map((device, index) => {
    if (index !== targetIndex) {
      return device;
    }

    return {
      ...device,
      id: device.id === device.deviceId ? normalizedNextDeviceId : device.id,
      deviceId: normalizedNextDeviceId
    };
  });

  await writeDefinitionsJson(stringifyDefinitions({ devices: nextDevices }));

  return nextDevices[targetIndex];
}

export function parseDefinitionsJson(jsonText: string): DeviceDefinition[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new DefinitionValidationError("Definitions must be valid JSON.", [
      error instanceof Error ? error.message : "Invalid JSON"
    ]);
  }

  const result = DeviceDefinitionsDocumentSchema.safeParse(parsed);

  if (!result.success) {
    throw new DefinitionValidationError("Definitions JSON has the wrong shape.", formatIssues(result.error));
  }

  return normalizeDefinitions(result.data);
}

export function stringifyDefinitions(document: { devices: DeviceDefinition[] | [] }) {
  return JSON.stringify(document, null, 2);
}

async function readRawDefinitionsText() {
  try {
    return await readFile(getDefinitionsFilePath(), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function normalizeDefinitions(document: DeviceDefinitionsDocumentInput): DeviceDefinition[] {
  const seenMacs = new Set<string>();
  const seenDeviceIds = new Set<string>();

  return document.devices.map((device, index) => {
    const macAddress = normalizeMacAddress(device.macAddress);

    if (!macAddress) {
      throw new DefinitionValidationError("Definitions JSON has invalid values.", [
        `devices.${index}.macAddress must be a MAC address like aa:bb:cc:dd:ee:ff.`
      ]);
    }

    if (seenMacs.has(macAddress)) {
      throw new DefinitionValidationError("Definitions JSON has duplicate MAC addresses.", [
        `devices.${index}.macAddress repeats ${macAddress}.`
      ]);
    }
    seenMacs.add(macAddress);

    const deviceId = normalizeDeviceId(device.deviceId) ?? `mac-${macAddress.replaceAll(":", "")}`;

    if (seenDeviceIds.has(deviceId)) {
      throw new DefinitionValidationError("Definitions JSON has duplicate device IDs.", [
        `devices.${index}.deviceId repeats ${deviceId}.`
      ]);
    }
    seenDeviceIds.add(deviceId);

    return {
      id: device.id?.trim() || deviceId,
      deviceId,
      macAddress,
      displayName: device.displayName.trim(),
      locationName: normalizeOptionalString(device.locationName) ?? "Unassigned",
      role: normalizeOptionalString(device.role) ?? "KDS screen",
      notes: normalizeOptionalString(device.notes) ?? "",
      active: device.active ?? true,
      squareKdsPackageName: normalizeOptionalString(device.squareKdsPackageName),
      squareKdsExpectedVersion: normalizeOptionalString(device.squareKdsExpectedVersion),
      fulfillmentMethods: normalizeFulfillmentMethods(device.fulfillmentMethods),
      expectedSettings: device.expectedSettings ?? [],
      printers: normalizePrinters(device.printers ?? [])
    };
  });
}

function normalizeFulfillmentMethods(
  fulfillmentMethods: z.infer<typeof FulfillmentMethodsInputSchema> | undefined
): FulfillmentMethodsDefinition | undefined {
  if (!fulfillmentMethods) {
    return undefined;
  }

  const seenNames = new Set<string>();
  const methods = (fulfillmentMethods.methods ?? []).map((method, index) => {
    const name = method.name.trim();
    const normalizedName = normalizedNameKey(name);

    if (seenNames.has(normalizedName)) {
      throw new DefinitionValidationError("Definitions JSON has duplicate fulfillment methods.", [
        `fulfillmentMethods.methods.${index}.name repeats ${name}.`
      ]);
    }

    seenNames.add(normalizedName);

    return {
      name,
      enabled: method.enabled
    };
  });

  return {
    includeFutureFulfillmentMethods: fulfillmentMethods.includeFutureFulfillmentMethods ?? false,
    methods
  };
}

function normalizePrinters(printers: Array<z.infer<typeof PrinterDefinitionInputSchema>>): PrinterDefinition[] {
  return printers.map((printer, index) => {
    const normalizedMacAddress = normalizeMacAddress(printer.macAddress);
    const id = printer.id?.trim() || `printer-${slugify(printer.name) || index + 1}`;

    return {
      id,
      name: printer.name.trim(),
      host: printer.host.trim(),
      port: printer.port ?? 9100,
      macAddress: normalizedMacAddress,
      description: normalizeOptionalString(printer.description)
    };
  });
}

function normalizeDeviceId(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? slugify(trimmed) : undefined;
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizedNameKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => {
    const pathLabel = issue.path.length ? issue.path.join(".") : "root";
    return `${pathLabel}: ${issue.message}`;
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
