import { requireAdmin } from "@/lib/admin";
import { getEventSnapshot } from "@/lib/snapshot";
import { buildRegistrationXlsx } from "@/lib/export-xlsx";
import { errorResponse } from "@/lib/http";
export async function GET() {
  try {
    await requireAdmin(); const bytes = buildRegistrationXlsx(await getEventSnapshot());
    return new Response(bytes.slice().buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="Silas_10_Inscricoes.xlsx"', "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
