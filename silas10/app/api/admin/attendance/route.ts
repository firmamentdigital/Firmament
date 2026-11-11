import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { AppError, errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
const inputSchema = z.object({
  id: z.string().regex(/^[cg]_[a-f0-9]{64}$/),
  kind: z.enum(["child", "guardian"]),
  present: z.boolean(),
  version: z.number().int().nonnegative(),
});
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireAdmin();
    const input = inputSchema.parse(await readJson(request));
    if (!env.DB) throw new AppError(503, "A lista está sendo preparada.");
    const table = input.kind === "child" ? "children" : "guardians";
    if (!input.id.startsWith(input.kind === "child" ? "c_" : "g_")) throw new AppError(422, "Participante inválido.");
    const active = input.kind === "child"
      ? "EXISTS (SELECT 1 FROM families f WHERE f.id=children.family_id AND f.status='active')"
      : "EXISTS (SELECT 1 FROM family_guardians fg JOIN families f ON f.id=fg.family_id WHERE fg.guardian_id=guardians.id AND fg.will_attend=1 AND f.status='active')";
    const result = await env.DB.prepare(
      "UPDATE " + table + " SET checked_in_at = ?, checked_in_by = ?, version = version + 1 WHERE id = ? AND version = ? AND " + active
    ).bind(input.present ? new Date().toISOString() : null, user.userId, input.id, input.version).run();
    if (!result.meta.changes) throw new AppError(409, "A presença foi atualizada em outra tela. A lista será recarregada.");
    return json({ updated: true });
  } catch (error) { return errorResponse(error); }
}
