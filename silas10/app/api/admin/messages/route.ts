import { requireAdmin } from "@/lib/admin";
import { createCampaign, limitedFormData, listCampaigns } from "@/lib/messages";
import { errorResponse, json, requireSameOrigin } from "@/lib/http";
export async function GET() {
  try { await requireAdmin(); return json(await listCampaigns()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request:Request) {
  try {
    requireSameOrigin(request); const user=await requireAdmin();
    return json(await createCampaign(await limitedFormData(request),user.userId),201);
  } catch (error) { return errorResponse(error); }
}
