import { requireOwner } from "@/lib/admin";
import { deleteBrand, updateBrand } from "@/lib/brands";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const user = await requireOwner(); return json(await updateBrand((await params).id, await readJson(request), user.userId)); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); await requireOwner(); return json(await deleteBrand((await params).id, await readJson(request))); }
  catch (error) { return errorResponse(error); }
}
