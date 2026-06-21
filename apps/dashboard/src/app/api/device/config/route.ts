import { readDeviceAuthHeaders } from "@/lib/device-auth";
import { authenticateDevice, buildDeviceConfig } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const credentials = readDeviceAuthHeaders(request.headers);

  if (!credentials) {
    return Response.json({ error: "Missing device credentials" }, { status: 401 });
  }

  const device = await authenticateDevice(credentials.deviceId, credentials.deviceSecret);

  if (!device) {
    return Response.json({ error: "Invalid device credentials" }, { status: 401 });
  }

  return Response.json(await buildDeviceConfig(device));
}
