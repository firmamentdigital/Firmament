import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError } from "./http";
import { isMobilePhone, normalizePhone } from "./event";
import { getEventSnapshot } from "./snapshot";
const familyId = z.string().regex(/^f_[a-f0-9]{64}$/);
export async function editFamily(id: string, raw: unknown, userId: string) {
  familyId.parse(id);
  const input = z.object({
    status: z.enum(["active", "cancelled"]),
    phone: z.string().transform(normalizePhone).refine(isMobilePhone, "Informe um celular com DDD e 9 dígitos."),
    // Celular do segundo responsável (vazio = sem celular).
    guardianPhones: z.record(z.string().regex(/^g_[a-f0-9]{64}$/), z.string().transform(normalizePhone).refine(value => value === "" || isMobilePhone(value), "Informe o celular do segundo responsável com DDD e 9 dígitos, ou deixe em branco.")).default({}),
    version: z.number().int().nonnegative(),
  }).parse(raw);
  const db = env.DB!;
  const statements = [db.prepare("UPDATE families SET status=?, phone=?, cancelled_at=?, cancelled_by=?, version=version+1 WHERE id=? AND version=?")
    .bind(input.status, input.phone, input.status === "cancelled" ? new Date().toISOString() : null, input.status === "cancelled" ? userId : null, id, input.version)];
  for (const [guardianId, phone] of Object.entries(input.guardianPhones)) {
    statements.push(db.prepare("UPDATE family_guardians SET phone=? WHERE family_id=? AND guardian_id=? AND guardian_id <> (SELECT primary_guardian_id FROM families WHERE id=?) AND EXISTS (SELECT 1 FROM families WHERE id=? AND version=? AND status=? AND phone=?)")
      .bind(phone || null, id, guardianId, id, id, input.version + 1, input.status, input.phone));
  }
  const results = await db.batch(statements);
  if (!results[0].meta.changes) throw new AppError(409, "A inscrição foi atualizada em outra tela. Atualize a lista antes de editar.");
  return { updated: true };
}
export async function deleteFamily(id: string, raw: unknown) {
  familyId.parse(id);
  const input = z.object({ confirmation: z.string(), version: z.number().int().nonnegative() }).parse(raw);
  const snapshot = await getEventSnapshot(); const family = snapshot.families.find(f => f.id === id);
  if (!family) throw new AppError(404, "Inscrição não encontrada.");
  if (input.confirmation !== family.code) throw new AppError(422, "Digite o código da inscrição para confirmar a exclusão.");
  if (input.version !== family.version) throw new AppError(409, "A inscrição mudou. Atualize a lista antes de excluir.");
  const db = env.DB!;
  const exists = "EXISTS (SELECT 1 FROM families WHERE id=? AND version=?)";
  const statements = [
    db.prepare(`DELETE FROM child_guardians WHERE child_id IN (SELECT id FROM children WHERE family_id=?) AND ${exists}`).bind(id, id, input.version),
    db.prepare(`DELETE FROM children WHERE family_id=? AND ${exists}`).bind(id, id, input.version),
    db.prepare(`DELETE FROM family_guardians WHERE family_id=? AND ${exists}`).bind(id, id, input.version),
    db.prepare(`DELETE FROM submissions WHERE family_id=? AND ${exists}`).bind(id, id, input.version),
  ];
  // Remove this family's names from prepared recipient lists while retaining other families on that phone.
  const others = snapshot.families.filter(f => f.id !== id && f.phone === family.phone);
  if (others.length) statements.push(db.prepare(`UPDATE message_contacts SET details_json=?, version=version+1 WHERE phone=? AND ${exists}`).bind(JSON.stringify({ phone: family.phone, responsibleNames: [...new Set(others.map(f => f.primaryGuardianName))], childNames: [...new Set(others.flatMap(f => f.children.map(c => c.fullName)))], codes: others.map(f => f.code) }), family.phone, id, input.version));
  else statements.push(db.prepare(`DELETE FROM message_contacts WHERE phone=? AND ${exists}`).bind(family.phone, id, input.version));
  statements.push(db.prepare("DELETE FROM families WHERE id=? AND version=?").bind(id, input.version));
  const deletionIndex = statements.length - 1;
  for (const guardian of family.guardians) statements.push(db.prepare("DELETE FROM guardians WHERE id=? AND NOT EXISTS (SELECT 1 FROM family_guardians WHERE guardian_id=?) AND NOT EXISTS (SELECT 1 FROM child_guardians WHERE guardian_id=?)").bind(guardian.id, guardian.id, guardian.id));
  const results = await db.batch(statements);
  if (!results[deletionIndex].meta.changes) throw new AppError(409, "A inscrição foi atualizada. Reabra os detalhes antes de excluir.");
  return { deleted: true };
}
