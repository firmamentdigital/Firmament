import { loginMaster, requireMasterOrigin } from "@/lib/master-auth";
import { errorResponse, json, readJson } from "@/lib/http";

export async function POST(request: Request) {
  try {
    requireMasterOrigin(request);
    const result = await loginMaster(request, await readJson(request));
    const response = json({ signedIn: true });
    response.headers.set("Set-Cookie", result.cookie);
    return response;
  } catch (error) {
    const response = errorResponse(error);
    if (response.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
}
