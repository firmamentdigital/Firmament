import { loginGuest, requireGuestOrigin } from "@/lib/guest-auth";
import { errorResponse, json, readJson } from "@/lib/http";
export async function POST(request: Request) {
  try { requireGuestOrigin(request); const result = await loginGuest(request, await readJson(request)); const response = json({ mustChangePassword: result.mustChangePassword }); response.headers.set("Set-Cookie", result.cookie); return response; }
  catch (error) { const response = errorResponse(error); if (response.status === 429) response.headers.set("Retry-After", "900"); return response; }
}
