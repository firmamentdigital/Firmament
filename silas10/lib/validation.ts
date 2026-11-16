import { z } from "zod";
import { cleanName, isBirthDate, isMobilePhone, normalizePhone } from "./event";
import { CHILD_AFFILIATIONS } from "./affiliation";

const fullName = z.string().transform(cleanName).pipe(z.string().min(3, "Informe o nome completo.").max(120, "Use até 120 caracteres."));
const birthDate = z.string().refine(isBirthDate, "Informe uma data de nascimento válida.");
const guardianKey = z.enum(["primary", "secondary"], { errorMap: () => ({ message: "Revise os responsáveis informados." }) });
const guardian = z.object({
  key: guardianKey,
  fullName,
  birthDate,
  attending: z.boolean(),
  // Celular próprio: obrigatório para o segundo responsável (o do principal é o "phone" da família).
  phone: z.string().optional(),
});
const child = z.object({
  fullName,
  birthDate,
  affiliation: z.enum(CHILD_AFFILIATIONS, { errorMap: () => ({ message: "Selecione o vínculo de cada criança: Sócio COD ou Escola de Atletismo." }) }),
  guardianKeys: z.array(guardianKey).min(1, "Vincule um responsável a cada criança.").max(2, "Cada criança pode ter no máximo dois responsáveis."),
});

export const registrationSchema = z.object({
  requestId: z.string().uuid(),
  phone: z.string().transform(normalizePhone).refine(isMobilePhone, "Informe um celular com DDD e 9 dígitos. Exemplo: (11) 99999-9999."),
  guardians: z.array(guardian).min(1, "Informe o responsável pela inscrição.").max(2, "Cadastre no máximo dois responsáveis por família."),
  children: z.array(child).min(1, "Inclua ao menos uma criança.").max(10, "Para grupos maiores, fale com Mario Ferrari."),
  question: z.string().trim().max(1500, "Use até 1.500 caracteres.").default(""),
  confirmed: z.literal(true, { errorMap: () => ({ message: "Confirme os dados antes de enviar." }) }),
}).superRefine((value, ctx) => {
  if (value.guardians[0]?.key !== "primary" ||
      new Set(value.guardians.map(person => person.key)).size !== value.guardians.length) {
    ctx.addIssue({ code: "custom", path: ["guardians"], message: "Revise os responsáveis informados." });
  }
  // Segundo responsável (ex.: pai e mãe): só quando há duas ou mais crianças, e
  // vinculado a todas elas, para que a família fique em uma única inscrição.
  const hasSecondary = value.guardians.some(person => person.key === "secondary");
  if (hasSecondary && value.children.length < 2) {
    ctx.addIssue({ code: "custom", path: ["guardians"], message: "O segundo responsável pode ser incluído quando houver duas ou mais crianças na inscrição." });
  }
  value.guardians.forEach((person, index) => {
    if (person.key === "secondary" && !isMobilePhone(normalizePhone(person.phone || ""))) {
      ctx.addIssue({ code: "custom", path: ["guardians", index, "phone"], message: "Informe o celular do segundo responsável com DDD e 9 dígitos." });
    }
  });
  value.children.forEach((item, index) => {
    if (!item.guardianKeys.includes("primary") || (hasSecondary && !item.guardianKeys.includes("secondary"))) {
      ctx.addIssue({ code: "custom", path: ["children", index, "guardianKeys"], message: "Vincule os responsáveis da família a todas as crianças." });
    }
  });
  const available = new Set(value.guardians.map(item => item.key));
  value.guardians.forEach((person, index) => {
    if (!value.children.some(child => child.guardianKeys.includes(person.key))) {
      ctx.addIssue({ code: "custom", path: ["guardians", index], message: "Vincule cada responsável a pelo menos uma criança ou remova o cadastro adicional." });
    }
  });
  value.children.forEach((item, index) => {
    if (new Set(item.guardianKeys).size !== item.guardianKeys.length || item.guardianKeys.some(key => !available.has(key))) {
      ctx.addIssue({ code: "custom", path: ["children", index, "guardianKeys"], message: "Revise os responsáveis vinculados." });
    }
  });
});
