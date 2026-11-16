import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError } from "./http";
import { normalizeName } from "./event";
import { getEventSnapshot } from "./snapshot";
import type { FamilyDetail } from "./types";

// Junta uma inscrição duplicada (ex.: mãe e pai inscreveram a mesma criança
// separadamente) dentro da inscrição que será mantida:
//  - os responsáveis da duplicada entram como responsáveis da mantida (máx. 2);
//  - crianças repetidas (mesma data de nascimento e mesmo primeiro nome) são
//    unificadas; as demais passam para a inscrição mantida;
//  - todos os responsáveis ficam vinculados a todas as crianças;
//  - a inscrição duplicada deixa de existir. Tudo em uma única transação.

const input = z.object({
  keepId: z.string().regex(/^f_[a-f0-9]{64}$/),
  removeCode: z.string().trim().toUpperCase().regex(/^S10-[A-F0-9]{10}$/, "Informe o código da inscrição duplicada. Exemplo: S10-1A2B3C4D5E."),
  confirm: z.boolean().default(false),
  keepVersion: z.number().int().nonnegative().optional(),
  removeVersion: z.number().int().nonnegative().optional(),
});

type Child = FamilyDetail["children"][number];
// Primeira palavra do nome, sem acentos e sem diferença de maiúsculas.
const firstName = (name: string) => normalizeName(name.trim().split(/\s+/)[0] || "");

export type MergePlan = {
  keep: { id: string; code: string; version: number };
  remove: { id: string; code: string; version: number; phone: string };
  duplicates: { removed: string; kept: string; birthDate: string }[];
  moved: { fullName: string; birthDate: string }[];
  addedGuardians: { fullName: string; attending: boolean; phone: string | null }[];
  result: { children: number; guardians: string[]; people: number };
};

function plan(keep: FamilyDetail, remove: FamilyDetail): { plan: MergePlan; pairs: [Child, Child][]; moved: Child[]; newGuardians: FamilyDetail["guardians"] } {
  const keepGuardianIds = new Set(keep.guardians.map(g => g.id));
  const newGuardians = remove.guardians.filter(g => !keepGuardianIds.has(g.id));
  if (keep.guardians.length + newGuardians.length > 2) {
    throw new AppError(422, `A inscrição ${keep.code} ficaria com mais de dois responsáveis. Ajuste manualmente ou fale com o suporte.`);
  }
  const pairs: [Child, Child][] = []; const moved: Child[] = []; const used = new Set<string>();
  for (const child of remove.children) {
    if (keep.children.some(c => c.id === child.id)) { pairs.push([child, keep.children.find(c => c.id === child.id)!]); used.add(child.id); continue; }
    const candidates = keep.children.filter(c => !used.has(c.id) && c.birthDate === child.birthDate && firstName(c.fullName) === firstName(child.fullName));
    if (candidates.length > 1) throw new AppError(422, `Não foi possível identificar com segurança a criança "${child.fullName}" (há mais de uma parecida na inscrição ${keep.code}). Ajuste manualmente.`);
    if (candidates.length === 1) { pairs.push([child, candidates[0]]); used.add(candidates[0].id); }
    else moved.push(child);
  }
  const guardians = [...keep.guardians, ...newGuardians];
  const children = keep.children.length + moved.length;
  return {
    pairs, moved, newGuardians,
    plan: {
      keep: { id: keep.id, code: keep.code, version: keep.version },
      remove: { id: remove.id, code: remove.code, version: remove.version, phone: remove.phone },
      duplicates: pairs.map(([removed, kept]) => ({ removed: removed.fullName, kept: kept.fullName, birthDate: kept.birthDate })),
      moved: moved.map(c => ({ fullName: c.fullName, birthDate: c.birthDate })),
      addedGuardians: newGuardians.map(g => ({ fullName: g.fullName, attending: g.attending, phone: g.primary ? remove.phone : g.phone })),
      result: { children, guardians: guardians.map(g => g.fullName), people: children + guardians.filter(g => g.attending).length },
    },
  };
}

export async function mergeFamilies(raw: unknown) {
  const data = input.parse(raw);
  const db = env.DB;
  if (!db) throw new AppError(503, "A gestão está sendo preparada. Tente novamente em instantes.");
  const snapshot = await getEventSnapshot();
  const keep = snapshot.families.find(f => f.id === data.keepId);
  const remove = snapshot.families.find(f => f.code === data.removeCode);
  if (!keep) throw new AppError(404, "Inscrição não encontrada. Atualize a lista.");
  if (!remove) throw new AppError(404, `Não encontrei a inscrição ${data.removeCode}. Confira o código na lista.`);
  if (keep.id === remove.id) throw new AppError(422, "Informe o código da outra inscrição, a duplicada.");
  const { plan: result, pairs, moved, newGuardians } = plan(keep, remove);
  if (!data.confirm) return { preview: result };

  if (data.keepVersion !== keep.version || data.removeVersion !== remove.version) {
    throw new AppError(409, "Uma das inscrições mudou. Veja a prévia de novo antes de confirmar.");
  }
  const guard = "EXISTS (SELECT 1 FROM families WHERE id=? AND version=?) AND EXISTS (SELECT 1 FROM families WHERE id=? AND version=?)";
  const g = [keep.id, keep.version, remove.id, remove.version];
  const s: D1PreparedStatement[] = [];
  for (const person of newGuardians) {
    // Quem era o contato principal da inscrição duplicada leva o celular dela.
    const ownPhone = person.primary ? remove.phone : person.phone;
    s.push(db.prepare(`INSERT INTO family_guardians (family_id, guardian_id, will_attend, phone) SELECT ?, ?, ?, ? WHERE ${guard} ON CONFLICT(family_id, guardian_id) DO NOTHING`).bind(keep.id, person.id, Number(person.attending), ownPhone || null, ...g));
  }
  for (const [duplicate, kept] of pairs) {
    if (duplicate.id === kept.id) continue;
    // Mantém a presença registrada em qualquer uma das duas fichas.
    s.push(db.prepare(`UPDATE children SET checked_in_at=COALESCE(checked_in_at, (SELECT checked_in_at FROM children WHERE id=?)), checked_in_by=COALESCE(checked_in_by, (SELECT checked_in_by FROM children WHERE id=?)), version=version+1 WHERE id=? AND ${guard}`).bind(duplicate.id, duplicate.id, kept.id, ...g));
    s.push(db.prepare(`DELETE FROM child_guardians WHERE child_id=? AND ${guard}`).bind(duplicate.id, ...g));
    s.push(db.prepare(`DELETE FROM children WHERE id=? AND ${guard}`).bind(duplicate.id, ...g));
  }
  for (const child of moved) {
    s.push(db.prepare(`UPDATE children SET family_id=?, version=version+1 WHERE id=? AND ${guard}`).bind(keep.id, child.id, ...g));
  }
  // Todos os responsáveis da família ficam vinculados a todas as crianças.
  s.push(db.prepare(`INSERT INTO child_guardians (child_id, guardian_id)
    SELECT c.id, fg.guardian_id FROM children c JOIN family_guardians fg ON fg.family_id = c.family_id
    WHERE c.family_id=? AND ${guard} ON CONFLICT(child_id, guardian_id) DO NOTHING`).bind(keep.id, ...g));
  s.push(db.prepare(`UPDATE submissions SET family_id=? WHERE family_id=? AND ${guard}`).bind(keep.id, remove.id, ...g));
  s.push(db.prepare(`DELETE FROM family_guardians WHERE family_id=? AND ${guard}`).bind(remove.id, ...g));
  if (remove.phone !== keep.phone) {
    const others = snapshot.families.filter(f => f.id !== remove.id && f.phone === remove.phone);
    if (others.length) s.push(db.prepare(`UPDATE message_contacts SET details_json=?, version=version+1 WHERE phone=? AND ${guard}`).bind(JSON.stringify({ phone: remove.phone, responsibleNames: [...new Set(others.map(f => f.primaryGuardianName))], childNames: [...new Set(others.flatMap(f => f.children.map(c => c.fullName)))], codes: others.map(f => f.code) }), remove.phone, ...g));
    else s.push(db.prepare(`DELETE FROM message_contacts WHERE phone=? AND ${guard}`).bind(remove.phone, ...g));
  }
  s.push(db.prepare("DELETE FROM families WHERE id=? AND version=? AND EXISTS (SELECT 1 FROM families WHERE id=? AND version=?)").bind(remove.id, remove.version, keep.id, keep.version));
  const removedIndex = s.length - 1;
  s.push(db.prepare("UPDATE families SET version=version+1 WHERE id=? AND version=? AND NOT EXISTS (SELECT 1 FROM families WHERE id=?)").bind(keep.id, keep.version, remove.id));
  const results = await db.batch(s);
  if (!results[removedIndex].meta.changes || !results[removedIndex + 1].meta.changes) {
    throw new AppError(409, "Uma das inscrições mudou durante a operação. Nada foi alterado; veja a prévia de novo.");
  }
  return { merged: result };
}
