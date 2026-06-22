import { readDeviceAuthHeaders } from "@/lib/device-auth";
import { authenticateDevice, saveStatusReport } from "@/lib/repository";
import { summarizeDeviceStatus } from "@/lib/status";
import { DeviceStatusPayloadSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const credentials = readDeviceAuthHeaders(request.headers);

  if (!credentials) {
    return Response.json({ error: "Missing device credentials" }, { status: 401 });
  }

  const device = await authenticateDevice(credentials);

  if (!device) {
    return Response.json({ error: "Invalid device credentials" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = DeviceStatusPayloadSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid status payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const report = await saveStatusReport(device, parsed.data);

  return Response.json({
    ok: true,
    reportId: report.id,
    summary: summarizeDeviceStatus(device, report)
  });
}
