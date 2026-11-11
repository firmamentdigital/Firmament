import { listBrands } from "@/lib/brands";
import { errorResponse, json } from "@/lib/http";
export async function GET() { try { return json(await listBrands()); } catch (error) { return errorResponse(error); } }
