export type MessageContact = {
  phone: string; responsibleNames: string[]; childNames: string[]; codes: string[];
  confirmedAt: string | null; version: number;
};
export type MessageCampaign = {
  id: string; title: string; body: string; imageName: string | null;
  createdAt: string; total: number; confirmed: number;
};
export type MessageDetail = MessageCampaign & { contacts: MessageContact[] };

export function contactText(template: string, contact: Pick<MessageContact, "responsibleNames" | "childNames" | "codes">) {
  return template.replace(/\{(responsavel|criancas|codigo)\}/g, (_, key: string) =>
    key === "responsavel" ? contact.responsibleNames.join(" e ") : key === "criancas" ? contact.childNames.join(", ") : contact.codes.join(" · "));
}
export function whatsappUrl(phone: string, text: string) {
  if (!/^[1-9]\d{9,10}$/.test(phone)) throw new Error("Celular inválido.");
  return "https://wa.me/55" + phone + "?text=" + encodeURIComponent(text);
}
