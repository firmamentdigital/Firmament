import { requireAdmin } from "@/lib/admin";
import { confirmFamilyAttendance } from "@/lib/attendance";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireAdmin();
    return json(await confirmFamilyAttendance(await readJson(request), user.userId));
  } catch (error) { return errorResponse(error); }
}
