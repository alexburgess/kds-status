import { DashboardShell } from "@/components/DashboardShell";
import { getDashboardSnapshot } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getDashboardSnapshot();

  return <DashboardShell snapshot={snapshot} />;
}
