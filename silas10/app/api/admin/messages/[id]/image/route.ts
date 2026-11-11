import { requireAdmin } from "@/lib/admin";
import { campaignImage } from "@/lib/messages";
import { errorResponse } from "@/lib/http";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try { await requireAdmin(); return await campaignImage((await context.params).id); }
  catch (error) { return errorResponse(error); }
}
