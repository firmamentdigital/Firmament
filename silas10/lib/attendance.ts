import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError } from "./http";

const schema = z.object({
  familyId: z.string().regex(/^f_[a-f0-9]{64}$/),
  ids: z.array(z.string().regex(/^[cg]_[a-f0-9]{64}$/)).min(1).max(30),
});

export async function confirmFamilyAttendance(raw: unknown, userId: string) {
  const input = schema.parse(raw);
  const db = env.DB;
  if (!db) throw new AppError(503, "A lista está sendo preparada.");
  const state = await db.prepare("SELECT status FROM families WHERE id = ?").bind(input.familyId).first<{ status: string }>();
  if (!state || state.status !== "active") throw new AppError(409, "Esta inscrição está cancelada. Reative-a antes de registrar a presença.");
  const ids = [...new Set(input.ids)];
  const rows = await db.prepare(`SELECT id FROM children WHERE family_id = ?
    UNION SELECT guardian_id AS id FROM family_guardians WHERE family_id = ? AND will_attend = 1`)
    .bind(input.familyId, input.familyId).all<{ id: string }>();
  const allowed = new Set(rows.results.map(row => row.id));
  if (ids.some(id => !allowed.has(id))) throw new AppError(422, "Selecione apenas os participantes desta família que têm vaga reservada.");
  const now = new Date().toISOString();
  // Single D1 transaction; a repeated scan never changes the original arrival time.
  const results = await db.batch(ids.map(id => db.prepare(
    `UPDATE ${id.startsWith('c_') ? 'children' : 'guardians'} SET checked_in_at = ?, checked_in_by = ?, version = version + 1 WHERE id = ? AND checked_in_at IS NULL AND EXISTS (SELECT 1 FROM families WHERE id = ? AND status = 'active')`
  ).bind(now, userId, id, input.familyId)));
  const updated = results.reduce((sum, result) => sum + (result.meta.changes || 0), 0);
  return { updated, alreadyPresent: ids.length - updated };
}
