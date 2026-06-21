import { DefinitionsWorkbench } from "@/components/DefinitionsWorkbench";
import { getDashboardSnapshot } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function DefinitionsPage() {
  const snapshot = await getDashboardSnapshot();

  return <DefinitionsWorkbench snapshot={snapshot} />;
}
