export const EVENT_DATE = "2026-11-21";
export const MARIO_PHONE = "5511947248000";
export const MARIO_WHATSAPP = "https://wa.me/" + MARIO_PHONE;
export const EVENT_NAME = "Silas 10 — Como realizar seu sonho";

export function todayInBrazil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function isBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" && value <= todayInBrazil();
}

export function ageAtEvent(birthDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const [eventYear, eventMonth, eventDay] = EVENT_DATE.split("-").map(Number);
  return eventYear - year - Number(eventMonth < month || (eventMonth === month && eventDay < day));
}

export function formatBirthDate(value: string) {
  const [year, month, day] = value.split("-");
  return [day, month, year].join("/");
}

/** Keep the field readable while typing; transport dates remain ISO. */
export function maskBirthDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatBirthDate(value);
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.slice(0, 2) + (digits.length > 2 ? "/" + digits.slice(2, 4) : "") + (digits.length > 4 ? "/" + digits.slice(4) : "");
}

export function parseBirthDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export function normalizeName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]/gu, "");
}

export function cleanName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length === 11) return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
  if (digits.length === 10) return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 6) + "-" + digits.slice(6);
  return value;
}

export function maskMobilePhone(value: string) {
  const digits = normalizePhone(value).slice(0, 11);
  if (!digits) return "";
  return "(" + digits.slice(0, 2) + (digits.length > 2 ? ") " + digits.slice(2, 7) : "") + (digits.length > 7 ? "-" + digits.slice(7) : "");
}

export function isMobilePhone(value: string) {
  return /^[1-9]{2}9\d{8}$/.test(normalizePhone(value));
}
