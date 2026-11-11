import { logoutGuest, requireGuestOrigin } from "@/lib/guest-auth";
import { errorResponse, json } from "@/lib/http";
export async function POST(request: Request) {
  try { requireGuestOrigin(request); const cookie = await logoutGuest(request); const response = json({ signedOut: true }); response.headers.set("Set-Cookie", cookie); return response; }
  catch (error) { return errorResponse(error); }
}
