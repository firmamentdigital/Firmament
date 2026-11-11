import { requireAdmin } from "@/lib/admin";
import { getCampaign, updateContact } from "@/lib/messages";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context) {
  try { await requireAdmin(); return json(await getCampaign((await context.params).id)); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request:Request,context:Context) {
  try { requireSameOrigin(request); const user=await requireAdmin(); return json(await updateContact((await context.params).id,await readJson(request),user.userId)); }
  catch (error) { return errorResponse(error); }
}
