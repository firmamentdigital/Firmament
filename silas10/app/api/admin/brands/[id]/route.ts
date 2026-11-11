import { requireAdmin } from "@/lib/admin";
import { updateBrand } from "@/lib/brands";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const user = await requireAdmin(); return json(await updateBrand((await params).id, await readJson(request), user.userId)); }
  catch (error) { return errorResponse(error); }
}
