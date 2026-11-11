import { requireOwner } from "@/lib/admin";
import { prepareInvitation } from "@/lib/access";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try { requireSameOrigin(request); await requireOwner(); return json(await prepareInvitation(await readJson(request))); }
  catch (error) { return errorResponse(error); }
}
