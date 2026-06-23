import { z } from "zod";
import { verifySharedDeviceSecret } from "@/lib/device-auth";
import { assignDeviceIdToDefinition, DefinitionValidationError } from "@/lib/local-definitions";
import type { DeviceDefinition } from "@/lib/types";

export const dynamic = "force-dynamic";

const DeviceClaimRequestSchema = z.object({
  deviceId: z.string().min(1),
  targetDeviceId: z.string().min(1)
});

export async function POST(request: Request) {
  if (!verifySharedDeviceSecret(request.headers.get("x-device-secret")?.trim())) {
    return Response.json({ error: "Invalid device credentials" }, { status: 401 });
  }

  if (isSupabaseConfiguredForDeviceClaim()) {
    return Response.json(
      { error: "Device self-claim is only available when using local JSON definitions." },
      { status: 501 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = DeviceClaimRequestSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid device claim payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const headerDeviceId = request.headers.get("x-device-id")?.trim().toLowerCase();
  const bodyDeviceId = parsed.data.deviceId.trim().toLowerCase();

  if (headerDeviceId && headerDeviceId !== bodyDeviceId) {
    return Response.json(
      { error: "Device claim did not match the requesting tablet identity." },
      { status: 400 }
    );
  }

  try {
    const device = await assignDeviceIdToDefinition(parsed.data.targetDeviceId, parsed.data.deviceId);

    return Response.json({
      ok: true,
      device: {
        deviceId: device.deviceId,
        displayName: device.displayName,
        locationName: device.locationName
      },
      config: buildLocalDeviceConfig(device)
    });
  } catch (error) {
    if (error instanceof DefinitionValidationError) {
      return Response.json(
        {
          error: error.message,
          issues: error.issues
        },
        { status: 400 }
      );
    }

    throw error;
  }
}

function isSupabaseConfiguredForDeviceClaim() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function buildLocalDeviceConfig(device: DeviceDefinition) {
  return {
    deviceId: device.deviceId,
    displayName: device.displayName,
    locationName: device.locationName,
    role: device.role,
    notes: device.notes,
    squareKds: {
      packageName: device.squareKdsPackageName,
      availableVersion: device.squareKdsExpectedVersion,
      expectedVersion: device.squareKdsExpectedVersion,
      versionSource: device.squareKdsExpectedVersion ? "definition-fallback" : "not-configured"
    },
    fulfillmentMethods: device.fulfillmentMethods,
    expectedSettings: device.expectedSettings,
    printers: device.printers.map((printer) => ({
      ...printer,
      port: printer.port || 9100
    }))
  };
}
