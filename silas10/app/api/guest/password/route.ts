import { changeGuestPassword, requireGuestOrigin } from "@/lib/guest-auth";
import { errorResponse, json, readJson } from "@/lib/http";
export async function POST(request: Request) {
  try { requireGuestOrigin(request); const result = await changeGuestPassword(request, await readJson(request)); const response = json({ changed: true }); response.headers.set("Set-Cookie", result.cookie); return response; }
  catch (error) { return errorResponse(error); }
}
