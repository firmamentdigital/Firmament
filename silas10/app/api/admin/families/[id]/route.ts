import { requireAdmin, requireOwner } from "@/lib/admin";
import { deleteFamily, editFamily } from "@/lib/family-management";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const user = await requireAdmin(); return json(await editFamily((await params).id, await readJson(request), user.userId)); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); await requireOwner(); return json(await deleteFamily((await params).id, await readJson(request))); }
  catch (error) { return errorResponse(error); }
}
