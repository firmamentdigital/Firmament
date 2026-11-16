import { requireOwner } from "@/lib/admin";
import { mergeFamilies } from "@/lib/family-merge";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try { requireSameOrigin(request); await requireOwner(); return json(await mergeFamilies(await readJson(request))); }
  catch (error) { return errorResponse(error); }
}
