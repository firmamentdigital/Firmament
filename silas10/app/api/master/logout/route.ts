import { logoutMaster, requireMasterOrigin } from "@/lib/master-auth";
import { errorResponse, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    requireMasterOrigin(request);
    const response = json({ signedOut: true });
    response.headers.set("Set-Cookie", await logoutMaster(request));
    return response;
  } catch (error) { return errorResponse(error); }
}
