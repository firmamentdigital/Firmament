import { requireAdmin } from "@/lib/admin";
import { buildRegistrationPdf } from "@/lib/export-pdf";
import { getEventSnapshot } from "@/lib/snapshot";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const bytes = await buildRegistrationPdf(await getEventSnapshot());
    return new Response(bytes.slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Silas_10_Lista_de_Inscricoes.pdf"',
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return errorResponse(error); }
}
