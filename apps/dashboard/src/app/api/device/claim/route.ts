import { z } from "zod";
import { verifySharedDeviceSecret } from "@/lib/device-auth";
import { assignDeviceIdToDefinition, DefinitionValidationError } from "@/lib/local-definitions";
import { buildDeviceConfig } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DeviceClaimRequestSchema = z.object({
  deviceId: z.string().min(1),
  targetDeviceId: z.string().min(1)
});

export async function POST(request: Request) {
  if (!verifySharedDeviceSecret(request.headers.get("x-device-secret")?.trim())) {
    return Response.json({ error: "Invalid device credentials" }, { status: 401 });
  }

  if (isSupabaseConfigured()) {
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
      config: await buildDeviceConfig(device)
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
