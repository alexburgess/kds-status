import { DefinitionsWorkbench } from "@/components/DefinitionsWorkbench";
import { getDefinitionsEditorState } from "@/lib/local-definitions";

export const dynamic = "force-dynamic";

export default async function DefinitionsPage() {
  const editorState = await getDefinitionsEditorState();

  return <DefinitionsWorkbench initialState={editorState} />;
}
