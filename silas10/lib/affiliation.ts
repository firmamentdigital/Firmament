export const CHILD_AFFILIATIONS = ["cod", "athletics"] as const;
export type ChildAffiliation = typeof CHILD_AFFILIATIONS[number];
export function affiliationLabel(value: ChildAffiliation | null | undefined) {
  return value === "cod" ? "Sócio COD" : value === "athletics" ? "Escola de Atletismo" : "Não informado (inscrição anterior)";
}
