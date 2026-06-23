import { DefinitionValidationError, getDefinitionsEditorState, writeDefinitionsJson } from "@/lib/local-definitions";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getDefinitionsEditorState());
}

export async function PUT(request: Request) {
  const jsonText = await request.text();

  try {
    return Response.json(await writeDefinitionsJson(jsonText));
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
