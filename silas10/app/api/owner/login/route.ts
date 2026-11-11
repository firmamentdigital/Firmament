import { requireGuestOrigin } from "@/lib/guest-auth";
import { loginOwner } from "@/lib/owner-auth";
import { errorResponse, json, readJson } from "@/lib/http";
export async function POST(request: Request) {
  try { requireGuestOrigin(request); const result = await loginOwner(request, await readJson(request)); const response = json({ signedIn: true }); response.headers.set("Set-Cookie", result.cookie); return response; }
  catch (error) { const response = errorResponse(error); if (response.status === 429) response.headers.set("Retry-After", "900"); return response; }
}
