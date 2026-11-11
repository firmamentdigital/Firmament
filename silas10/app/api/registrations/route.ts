import { registerFamily } from "@/lib/registrations";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return json(await registerFamily(await readJson(request)), 201);
  } catch (error) { return errorResponse(error); }
}
