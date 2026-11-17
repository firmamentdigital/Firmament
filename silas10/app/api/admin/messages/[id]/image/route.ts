import { requireOwner } from "@/lib/admin";
import { campaignImage } from "@/lib/messages";
import { errorResponse } from "@/lib/http";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try { await requireOwner(); return await campaignImage((await context.params).id); }
  catch (error) { return errorResponse(error); }
}
