import { env } from "cloudflare:workers";
import { registrationSchema } from "./validation";
import { normalizeName, normalizePhone } from "./event";
import { AppError } from "./http";
import type { RegistrationReceipt } from "./types";

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function database() {
  if (!env.DB) throw new AppError(503, "As inscrições estão sendo preparadas. Tente novamente em alguns instantes.");
  return env.DB;
}

async function previousReceipt(db: D1Database, requestId: string, payloadHash: string) {
  const record = await db.prepare("SELECT family_id, payload_hash, response_json FROM submissions WHERE id = ?")
    .bind(requestId).first<{ family_id: string; payload_hash: string; response_json: string }>();
  if (!record) return null;
  if (record.payload_hash !== payloadHash) throw new AppError(409, "Os dados mudaram durante o envio. Recarregue a página e revise a inscrição.");
  return familyReceipt(db, record.family_id, JSON.parse(record.response_json).code);
}

async function familyReceipt(db: D1Database, familyId: string, code: string): Promise<RegistrationReceipt> {
  const counts = await db.batch<{ count: number }>([
    db.prepare("SELECT COUNT(*) AS count FROM children WHERE family_id = ?").bind(familyId),
    db.prepare("SELECT COUNT(*) AS count FROM family_guardians WHERE family_id = ? AND will_attend = 1").bind(familyId),
  ]);
  const children = Number(counts[0].results[0].count);
  const accompanyingGuardians = Number(counts[1].results[0].count);
  return { code, children, accompanyingGuardians, totalPeople: children + accompanyingGuardians };
}

export async function registerFamily(raw: unknown) {
  const input = registrationSchema.parse(raw);
  const db = database();
  const payloadHash = await digest(JSON.stringify({ ...input, requestId: undefined }));
  const previous = await previousReceipt(db, input.requestId, payloadHash);
  if (previous) {
    const state = await db.prepare("SELECT status FROM families WHERE code = ?").bind(previous.code).first<{ status: string }>();
    if (state?.status === "cancelled") throw new AppError(409, "Esta inscrição foi cancelada. Fale com Mario Ferrari para reativá-la.");
    return previous;
  }

  const guardians = await Promise.all(input.guardians.map(async item => ({
    ...item, id: "g_" + await digest(normalizeName(item.fullName) + "|" + item.birthDate),
  })));
  const children = await Promise.all(input.children.map(async item => ({
    ...item, id: "c_" + await digest(normalizeName(item.fullName) + "|" + item.birthDate),
  })));
  if (new Set(guardians.map(item => item.id)).size !== guardians.length) {
    throw new AppError(422, "O mesmo responsável foi informado duas vezes. Preencha cada pessoa uma vez.");
  }
  if (new Set(children.map(item => item.id)).size !== children.length) {
    throw new AppError(422, "A mesma criança foi informada duas vezes. Revise os nomes e as datas.");
  }

  const familyId = "f_" + await digest(guardians[0].id + "|" + input.phone);
  const familyState = await db.prepare("SELECT status FROM families WHERE id = ?").bind(familyId).first<{ status: string }>();
  if (familyState?.status === "cancelled") throw new AppError(409, "Esta inscrição foi cancelada. Fale com Mario Ferrari para reativá-la.");
  const code = "S10-" + familyId.slice(2, 12).toUpperCase();
  const now = new Date().toISOString();
  const receipt: RegistrationReceipt = {
    code, children: children.length,
    accompanyingGuardians: guardians.filter(item => item.attending).length,
    totalPeople: children.length + guardians.filter(item => item.attending).length,
  };
  const statements: D1PreparedStatement[] = [];
  for (const person of guardians) {
    statements.push(db.prepare("INSERT INTO guardians (id, full_name, birth_date, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(person.id, person.fullName, person.birthDate, now));
  }
  statements.push(db.prepare("INSERT INTO families (id, code, primary_guardian_id, phone, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(familyId, code, guardians[0].id, input.phone, now));
  for (const person of guardians) {
    const ownPhone = person.key === "secondary" ? normalizePhone(person.phone || "") : null;
    statements.push(db.prepare("INSERT INTO family_guardians (family_id, guardian_id, will_attend, phone) VALUES (?, ?, ?, ?) ON CONFLICT(family_id, guardian_id) DO UPDATE SET will_attend = MAX(family_guardians.will_attend, excluded.will_attend), phone = COALESCE(excluded.phone, family_guardians.phone)")
      .bind(familyId, person.id, Number(person.attending), ownPhone));
  }
  for (const child of children) {
    statements.push(db.prepare("INSERT INTO children (id, family_id, full_name, birth_date, affiliation, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET family_id = CASE WHEN children.family_id = excluded.family_id THEN children.family_id ELSE NULL END, affiliation = excluded.affiliation")
      .bind(child.id, familyId, child.fullName, child.birthDate, child.affiliation, now));
    for (const key of child.guardianKeys) {
      const guardian = guardians.find(item => item.key === key)!;
      statements.push(db.prepare("INSERT INTO child_guardians (child_id, guardian_id) VALUES (?, ?) ON CONFLICT(child_id, guardian_id) DO NOTHING")
        .bind(child.id, guardian.id));
    }
  }
  statements.push(db.prepare("INSERT INTO submissions (id, family_id, payload_hash, question, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(input.requestId, familyId, payloadHash, input.question, JSON.stringify(receipt), now));

  try {
    await db.batch(statements);
    return familyReceipt(db, familyId, code);
  } catch (error) {
    const retried = await previousReceipt(db, input.requestId, payloadHash);
    if (retried) return retried;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("children.family_id")) {
      throw new AppError(409, "Uma das crianças já está inscrita. Para ajustar responsáveis ou contato, fale com Mario Ferrari.");
    }
    if (message.includes("child_guardian_limit")) {
      throw new AppError(409, "Uma das crianças já tem responsáveis vinculados em outra inscrição. Fale com Mario Ferrari para ajustar o cadastro.");
    }
    throw error;
  }
}
