import { requireOwner } from "@/lib/admin";
import { createBrand, listBrands } from "@/lib/brands";
import { limitedFormData } from "@/lib/messages";
import { errorResponse, json, requireSameOrigin } from "@/lib/http";
export async function GET() { try { await requireOwner(); return json(await listBrands(true)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) {
  try { requireSameOrigin(request); const user = await requireOwner(); return json(await createBrand(await limitedFormData(request), user.userId), 201); }
  catch (error) { return errorResponse(error); }
}
