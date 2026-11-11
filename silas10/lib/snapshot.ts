import { env } from "cloudflare:workers";
import { ageAtEvent, formatBirthDate, formatPhone } from "./event";
import type { EventSnapshot, FamilyDetail, Participant } from "./types";
import { AppError } from "./http";
import { affiliationLabel, type ChildAffiliation } from "./affiliation";

type PersonRow = { id: string; full_name: string; birth_date: string; checked_in_at: string | null; version: number };
type ChildRow = PersonRow & { family_id: string; affiliation: ChildAffiliation | null };
type FamilyRow = { id: string; code: string; primary_guardian_id: string; phone: string; created_at: string; status: "active" | "cancelled"; version: number };
type FamilyGuardianRow = { family_id: string; guardian_id: string; will_attend: number };
type ChildGuardianRow = { child_id: string; guardian_id: string };
type QuestionRow = { family_id: string; question: string; created_at: string };

export async function getEventSnapshot(): Promise<EventSnapshot> {
  if (!env.DB) throw new AppError(503, "O banco de inscrições ainda está sendo preparado.");
  const results = await env.DB.batch([
    env.DB.prepare("SELECT id, code, primary_guardian_id, phone, created_at, status, version FROM families ORDER BY created_at DESC"),
    env.DB.prepare("SELECT id, family_id, full_name, birth_date, affiliation, checked_in_at, version FROM children ORDER BY full_name"),
    env.DB.prepare("SELECT id, full_name, birth_date, checked_in_at, version FROM guardians ORDER BY full_name"),
    env.DB.prepare("SELECT family_id, guardian_id, will_attend FROM family_guardians"),
    env.DB.prepare("SELECT child_id, guardian_id FROM child_guardians"),
    env.DB.prepare("SELECT family_id, question, created_at FROM submissions WHERE question <> '' ORDER BY created_at"),
  ]);
  const families = results[0].results as unknown as FamilyRow[];
  const allChildren = results[1].results as unknown as ChildRow[];
  const activeIds = new Set(families.filter(f => f.status === "active").map(f => f.id));
  const children = allChildren.filter(c => activeIds.has(c.family_id));
  const guardians = results[2].results as unknown as PersonRow[];
  const familyLinks = results[3].results as unknown as FamilyGuardianRow[];
  const childLinks = results[4].results as unknown as ChildGuardianRow[];
  const questions = results[5].results as unknown as QuestionRow[];
  const guardianMap = new Map(guardians.map(item => [item.id, item]));
  const familyMap = new Map(families.map(item => [item.id, item]));
  const unique = (items: string[]) => [...new Set(items)];

  const details: FamilyDetail[] = families.map(family => ({
    id: family.id, code: family.code, phone: family.phone, createdAt: family.created_at,
    status: family.status, version: family.version,
    primaryGuardianName: guardianMap.get(family.primary_guardian_id)?.full_name || "",
    children: allChildren.filter(child => child.family_id === family.id).map(child => ({
      id: child.id, fullName: child.full_name, birthDate: child.birth_date,
      affiliation: child.affiliation,
      age: ageAtEvent(child.birth_date)!, checkedInAt: child.checked_in_at,
      guardianNames: childLinks.filter(link => link.child_id === child.id).map(link => guardianMap.get(link.guardian_id)?.full_name || ""),
    })),
    guardians: familyLinks.filter(link => link.family_id === family.id).map(link => {
      const person = guardianMap.get(link.guardian_id)!;
      return {
        id: person.id, fullName: person.full_name, birthDate: person.birth_date,
        age: ageAtEvent(person.birth_date)!, attending: Boolean(link.will_attend), checkedInAt: person.checked_in_at,
      };
    }),
    questions: questions.filter(item => item.family_id === family.id).filter((item, index, items) => items.findIndex(other => other.question === item.question) === index)
      .map(item => ({ text: item.question, createdAt: item.created_at })),
  }));

  const participants: Participant[] = children.map(child => {
    const family = familyMap.get(child.family_id)!;
    return {
      id: child.id, kind: "child", fullName: child.full_name, birthDate: child.birth_date,
      affiliation: child.affiliation,
      age: ageAtEvent(child.birth_date)!, phone: family.phone,
      familyCodes: [family.code], familyIds: [family.id],
      linkedNames: childLinks.filter(link => link.child_id === child.id).map(link => guardianMap.get(link.guardian_id)?.full_name || ""),
      checkedInAt: child.checked_in_at, version: child.version,
    };
  });
  for (const guardian of guardians) {
    const attendingLinks = familyLinks.filter(link => link.guardian_id === guardian.id && link.will_attend && activeIds.has(link.family_id));
    if (!attendingLinks.length) continue;
    const linkedFamilyIds = familyLinks.filter(link => link.guardian_id === guardian.id && activeIds.has(link.family_id)).map(link => link.family_id);
    const childIds = new Set(childLinks.filter(link => link.guardian_id === guardian.id).map(link => link.child_id));
    participants.push({
      id: guardian.id, kind: "guardian", fullName: guardian.full_name,
      affiliation: null,
      birthDate: guardian.birth_date, age: ageAtEvent(guardian.birth_date)!,
      phone: unique(linkedFamilyIds.map(id => familyMap.get(id)!.phone)).join(" / "),
      familyCodes: unique(linkedFamilyIds.map(id => familyMap.get(id)!.code)),
      familyIds: linkedFamilyIds,
      linkedNames: children.filter(child => childIds.has(child.id)).map(child => child.full_name),
      checkedInAt: guardian.checked_in_at, version: guardian.version,
    });
  }
  participants.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  return {
    participants, families: details,
    stats: {
      families: activeIds.size, cancelledFamilies: families.length - activeIds.size, children: children.length,
      guardians: participants.filter(item => item.kind === "guardian").length,
      expected: participants.length, present: participants.filter(item => item.checkedInAt).length,
      questions: details.filter(item => item.questions.length).length,
    },
    updatedAt: new Date().toISOString(),
  };
}

function csvCell(value: unknown) {
  let content = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(content)) content = "'" + content;
  return '"' + content.replace(/"/g, '""') + '"';
}

export function snapshotCsv(snapshot: EventSnapshot) {
  const rows: unknown[][] = [[
    "Nome", "Tipo", "Nascimento", "Idade em 21/11/2026", "Celular do responsável principal",
    "Responsáveis ou crianças vinculadas", "Inscrição da família", "Presença", "Entrada",
    "Dúvidas ou dificuldades", "Vínculo da criança",
  ]];
  for (const person of snapshot.participants) {
    const questions = snapshot.families.filter(family => person.familyIds.includes(family.id))
      .flatMap(family => family.questions.map(item => item.text));
    rows.push([
      person.fullName, person.kind === "child" ? "Criança / jovem" : "Responsável",
      formatBirthDate(person.birthDate), person.age, formatPhone(person.phone),
      person.linkedNames.join(" | "), person.familyCodes.join(" | "),
      person.checkedInAt ? "Presente" : "Aguardando",
      person.checkedInAt ? new Date(person.checkedInAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      [...new Set(questions)].join(" | "), person.kind === "child" ? affiliationLabel(person.affiliation) : "",
    ]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}
