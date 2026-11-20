export const CHILD_AFFILIATIONS = ["cod", "athletics", "other"] as const;
export type ChildAffiliation = typeof CHILD_AFFILIATIONS[number];
// "other" vem com um texto livre (ex.: "Escola X", "Convidado"), guardado em affiliation_other.
export function affiliationLabel(value: ChildAffiliation | null | undefined, other?: string | null) {
  if (value === "other") return other?.trim() ? "Outro: " + other.trim() : "Outro";
  return value === "cod" ? "Sócio COD" : value === "athletics" ? "Escola de Atletismo" : "Não informado (inscrição anterior)";
}
