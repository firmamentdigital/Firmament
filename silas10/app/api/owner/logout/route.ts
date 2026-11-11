import { safeRelativeReturnPath } from "@/app/chatgpt-auth";
import { logoutOwner } from "@/lib/owner-auth";
import { errorResponse } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const cookie = await logoutOwner(request);
    const returnTo = safeRelativeReturnPath(new URL(request.url).searchParams.get("return_to") || "/gestao");
    return new Response(null, { status: 303, headers: { Location: returnTo, "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
