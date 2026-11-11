import { requireAdmin } from "@/lib/admin";
import { getEventSnapshot } from "@/lib/snapshot";
import { errorResponse, json } from "@/lib/http";
export async function GET() {
  try {
    await requireAdmin();
    return json(await getEventSnapshot());
  } catch (error) { return errorResponse(error); }
}
