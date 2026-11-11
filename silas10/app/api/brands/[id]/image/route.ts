import { brandImage } from "@/lib/brands";
import { errorResponse } from "@/lib/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await brandImage((await params).id); } catch (error) { return errorResponse(error); }
}
