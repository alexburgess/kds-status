import { verifySharedDeviceSecret } from "@/lib/device-auth";
import { getDeviceClaimOptions } from "@/lib/local-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifySharedDeviceSecret(request.headers.get("x-device-secret")?.trim())) {
    return Response.json({ error: "Invalid device credentials" }, { status: 401 });
  }

  if (isSupabaseConfiguredForDeviceClaim()) {
    return Response.json(
      { error: "Device self-claim is only available when using local JSON definitions." },
      { status: 501 }
    );
  }

  return Response.json({ options: await getDeviceClaimOptions() });
}

function isSupabaseConfiguredForDeviceClaim() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
