import { z } from "zod";
import { cleanName, isBirthDate, isMobilePhone, normalizePhone } from "./event";
import { CHILD_AFFILIATIONS } from "./affiliation";

const fullName = z.string().transform(cleanName).pipe(z.string().min(3, "Informe o nome completo.").max(120, "Use até 120 caracteres."));
const birthDate = z.string().refine(isBirthDate, "Informe uma data de nascimento válida.");
const guardian = z.object({
  key: z.literal("primary", { errorMap: () => ({ message: "Cadastre apenas um responsável para esta inscrição." }) }),
  fullName,
  birthDate,
  attending: z.boolean(),
});
const child = z.object({
  fullName,
  birthDate,
  affiliation: z.enum(CHILD_AFFILIATIONS, { errorMap: () => ({ message: "Selecione o vínculo de cada criança: Sócio COD ou Escola de Atletismo." }) }),
  guardianKeys: z.array(z.literal("primary")).length(1, "Cada criança deve ter apenas um responsável."),
});

export const registrationSchema = z.object({
  requestId: z.string().uuid(),
  phone: z.string().transform(normalizePhone).refine(isMobilePhone, "Informe um celular com DDD e 9 dígitos. Exemplo: (11) 99999-9999."),
  guardians: z.array(guardian).length(1, "Cadastre apenas um responsável, que poderá inscrever mais de uma criança. Recarregue a página para usar o novo formulário."),
  children: z.array(child).min(1, "Inclua ao menos uma criança.").max(10, "Para grupos maiores, fale com Mario Ferrari."),
  question: z.string().trim().max(1500, "Use até 1.500 caracteres.").default(""),
  confirmed: z.literal(true, { errorMap: () => ({ message: "Confirme os dados antes de enviar." }) }),
}).superRefine((value, ctx) => {
  if (value.guardians[0]?.key !== "primary" ||
      new Set(value.guardians.map(person => person.key)).size !== value.guardians.length) {
    ctx.addIssue({ code: "custom", path: ["guardians"], message: "Revise os responsáveis informados." });
  }
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
