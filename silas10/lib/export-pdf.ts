import { PDFDocument, PDFFont, PDFPage, PageSizes, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { MANROPE_BOLD_TTF, MANROPE_REGULAR_TTF } from "./pdf-fonts";
import { formatBirthDate, formatPhone } from "./event";
import type { EventSnapshot, FamilyDetail } from "./types";
import { SILAS_SIGNATURE_PNG } from "./event-artwork";
import { affiliationLabel } from "./affiliation";

const C = {
  ink: rgb(0.09, 0.09, 0.11), red: rgb(0.84, 0.03, 0.13),
  muted: rgb(0.39, 0.4, 0.43), line: rgb(0.85, 0.85, 0.85),
  soft: rgb(0.97, 0.965, 0.95), white: rgb(1, 1, 1), green: rgb(0.13, 0.39, 0.28),
};
const [PAGE_HEIGHT, PAGE_WIDTH] = PageSizes.A4;
const MARGIN = 32;
const WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = 46;
const SIZE = 8.3;
const LEADING = 12;
const COLUMN_WIDTHS = [24, 238, 110, 114, 134, WIDTH - 620];

type Line = { text: string; bold?: boolean; muted?: boolean; color?: typeof C.ink };

function decodeFont(value: string) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** A complete print-ready roster followed by each family's registration details. */
export async function buildRegistrationPdf(snapshot: EventSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(decodeFont(MANROPE_REGULAR_TTF), { subset: true });
  const bold = await pdf.embedFont(decodeFont(MANROPE_BOLD_TTF), { subset: true });
  const signature = await pdf.embedPng(decodeFont(SILAS_SIGNATURE_PNG));
  const characters = new Set(regular.getCharacterSet());
  const safe = (text: string) => Array.from(text.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[\u2010-\u2015\u2212]/g, "-"))
    .map(character => characters.has(character.codePointAt(0)!) || character === "\n" ? character : "[U+" + character.codePointAt(0)!.toString(16).toUpperCase() + "]").join("");

  function wrap(text: string, width: number, font: PDFFont = regular, size = SIZE): string[] {
    const result: string[] = [];
    for (const paragraph of safe(text).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        if (font.widthOfTextAtSize(line ? line + " " + word : word, size) <= width) {
          line = line ? line + " " + word : word;
          continue;
        }
        if (line) { result.push(line); line = ""; }
        for (const character of Array.from(word)) {
          if (line && font.widthOfTextAtSize(line + character, size) > width) {
            result.push(line); line = "";
          }
          line += character;
        }
      }
      result.push(line);
    }
    return result.length ? result : [""];
  }

  let page!: PDFPage;
  let cursor = 0;
  const generated = dateTime(snapshot.updatedAt);
  const draw = (text: string, x: number, y: number, options: { size?: number; bold?: boolean; color?: typeof C.ink } = {}) => {
    page.drawText(safe(text), { x, y, size: options.size || SIZE, font: options.bold ? bold : regular, color: options.color || C.ink });
  };
  function newPage(section: "roster" | "families", first = false) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 5, width: PAGE_WIDTH, height: 5, color: C.red });
    page.drawImage(signature, { x: MARGIN, y: PAGE_HEIGHT - 74, width: 96, height: 61 });
    const privacy = "USO EXCLUSIVO DA ORGANIZAÇÃO";
    draw(privacy, PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(privacy, 7), PAGE_HEIGHT - 27, { size: 7, bold: true, color: C.muted });
    draw(section === "roster" ? "Lista de inscrições" : "Inscrições por família", MARGIN + 122, PAGE_HEIGHT - 58, { size: 23, bold: true });
    draw("Como realizar seu sonho · Da origem ao sucesso", MARGIN + 122, PAGE_HEIGHT - 78, { size: 10, bold: true, color: C.red });
    draw("21 de novembro de 2026 · 9h às 11h · Auditório do Conselho Deliberativo do SPFC", MARGIN, PAGE_HEIGHT - 100, { size: 8.7, color: C.muted });
    cursor = PAGE_HEIGHT - 120;
    if (section === "roster" && first) {
      const metrics = [
        [String(snapshot.stats.families), "FAMÍLIAS ATIVAS"],
        [String(snapshot.stats.cancelledFamilies), "FAMÍLIAS CANCELADAS"],
        [String(snapshot.stats.children), "CRIANÇAS / JOVENS"],
        [String(snapshot.stats.guardians), "ACOMPANHANTES"],
        [String(snapshot.stats.expected), "PESSOAS PREVISTAS"],
        [String(snapshot.stats.present), "PRESENÇAS REGISTRADAS"],
      ];
      const cell = WIDTH / metrics.length;
      page.drawRectangle({ x: MARGIN, y: cursor - 46, width: WIDTH, height: 46, color: C.soft });
      metrics.forEach(([value, label], index) => {
        draw(value, MARGIN + index * cell + 12, cursor - 21, { size: 17, bold: true, color: index === 5 ? C.red : C.ink });
        draw(label, MARGIN + index * cell + 12, cursor - 35, { size: 6.6, bold: true, color: C.muted });
      });
      cursor -= 64;
    }
    if (section === "roster") tableHeader();
    else {
      draw("Inscrições ativas e canceladas, contatos, vínculos e dúvidas. Responsáveis que não irão ao evento constam apenas nesta seção.", MARGIN, cursor, { size: 8.1, color: C.muted });
      cursor -= 24;
    }
  }
  function tableHeader() {
    page.drawRectangle({ x: MARGIN, y: cursor - 24, width: WIDTH, height: 24, color: C.ink });
    let x = MARGIN;
    ["Nº", "NOME COMPLETO", "PERFIL / IDADE / NASC.", "CELULAR PRINCIPAL", "INSCRIÇÃO", "CONFIRMAÇÃO"].forEach((label, i) => {
      draw(label, x + 6, cursor - 15, { size: 6.4, bold: true, color: C.white });
      x += COLUMN_WIDTHS[i];
    });
    cursor -= 24;
  }

  newPage("roster", true);
  const participants = [...snapshot.participants].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  if (!participants.length) {
    draw("Nenhuma inscrição cadastrada até o momento.", MARGIN + 10, cursor - 28, { size: 11 });
  }
  participants.forEach((person, index) => {
    const cells: Line[][] = [
      [{ text: String(index + 1), muted: true }],
      wrap(person.fullName, COLUMN_WIDTHS[1] - 14, bold).map(text => ({ text, bold: true })),
      [
        { text: person.kind === "child" ? "Criança / jovem" : "Responsável", bold: true },
        { text: person.age + " anos · " + formatBirthDate(person.birthDate), muted: true },
        ...(person.kind === "child" ? wrap(affiliationLabel(person.affiliation), COLUMN_WIDTHS[2] - 14).map(text => ({ text, muted: true })) : []),
      ],
      wrap(person.phone.split(" / ").map(formatPhone).join(" / "), COLUMN_WIDTHS[3] - 14).map(text => ({ text })),
      person.familyCodes.flatMap(code => wrap(code, COLUMN_WIDTHS[4] - 14)).map(text => ({ text, muted: true })),
      person.checkedInAt ? [
        { text: "Presente", bold: true, color: C.green },
        { text: dateTime(person.checkedInAt), muted: true },
      ] : [{ text: "A confirmar" }],
    ];
    const lineCount = Math.max(2, ...cells.map(cell => cell.length));
    let offset = 0;
    while (offset < lineCount) {
      const remaining = lineCount - offset;
      if (cursor - BOTTOM < LEADING * Math.min(remaining, 2) + 13 || (remaining * LEADING + 13 <= PAGE_HEIGHT - 120 - 24 - BOTTOM && cursor - BOTTOM < remaining * LEADING + 13)) newPage("roster");
      const take = Math.min(remaining, Math.floor((cursor - BOTTOM - 13) / LEADING));
      const height = take * LEADING + 13;
      if (index % 2 === 0) page.drawRectangle({ x: MARGIN, y: cursor - height, width: WIDTH, height, color: C.soft });
      let x = MARGIN;
      cells.forEach((cell, col) => {
        for (let i = 0; i < take; i++) {
          const line = cell[offset + i] || (offset > 0 && i === 0 && col === 0 ? { text: String(index + 1), muted: true } : undefined)
            || (offset > 0 && col === 1 ? wrap(person.fullName + " (continuação)", COLUMN_WIDTHS[1] - 14, bold).map(text => ({ text, bold: true }))[i] : undefined);
          if (!line) continue;
          const inset = col === 5 && !person.checkedInAt && offset + i === 0 ? 19 : 6;
          draw(line.text, x + inset, cursor - 14 - i * LEADING, { bold: line.bold, color: line.color || (line.muted ? C.muted : C.ink) });
          if (col === 5 && !person.checkedInAt && offset + i === 0) {
            page.drawRectangle({ x: x + 6, y: cursor - 14, width: 8, height: 8, borderColor: C.muted, borderWidth: 0.6 });
          }
        }
        x += COLUMN_WIDTHS[col];
      });
      page.drawLine({ start: { x: MARGIN, y: cursor - height }, end: { x: PAGE_WIDTH - MARGIN, y: cursor - height }, color: C.line, thickness: 0.5 });
      cursor -= height;
      offset += take;
      if (offset < lineCount) newPage("roster");
    }
  });

  newPage("families");
  const families = [...snapshot.families].sort((a, b) => a.primaryGuardianName.localeCompare(b.primaryGuardianName, "pt-BR"));
  if (!families.length) draw("Nenhuma família cadastrada até o momento.", MARGIN, cursor - 10, { size: 11 });

  function familyHeader(family: FamilyDetail, continued: boolean) {
    if (cursor - BOTTOM < 66) newPage("families");
    page.drawRectangle({ x: MARGIN, y: cursor - 29, width: WIDTH, height: 29, color: C.ink });
    draw(family.code + (family.status === "cancelled" ? " · CANCELADA" : " · ATIVA") + (continued ? " · continuação" : ""), MARGIN + 10, cursor - 18, { size: 9.4, bold: true, color: C.white });
    const phone = formatPhone(family.phone);
    draw(phone, PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(phone, 9) - 10, cursor - 18, { size: 9, bold: true, color: C.white });
    cursor -= 44;
  }
  for (const family of families) {
    familyHeader(family, false);
    const textBlock = (label: string, text: string) => {
      const lines = wrap(text, WIDTH - 144);
      let offset = 0;
      while (offset < lines.length) {
        if (cursor - BOTTOM < LEADING + 5) {
          newPage("families"); familyHeader(family, true);
        }
        const take = Math.min(lines.length - offset, Math.max(1, Math.floor((cursor - BOTTOM - 5) / LEADING)));
        draw(label + (offset ? " (cont.)" : ""), MARGIN + 8, cursor, { size: 7.8, bold: true, color: C.muted });
        lines.slice(offset, offset + take).forEach((line, i) => draw(line, MARGIN + 138, cursor - i * LEADING));
        cursor -= take * LEADING + 7;
        offset += take;
      }
    };
    textBlock("SITUAÇÃO", family.status === "cancelled" ? "Cancelada - fora da contagem de vagas e da lista de presença." : "Ativa - vagas reservadas.");
    textBlock("CONTATO PRINCIPAL", family.primaryGuardianName);
    for (const child of family.children) {
      textBlock("CRIANÇA / JOVEM", child.fullName + " · " + formatBirthDate(child.birthDate) + " · " + child.age + " anos" + (child.checkedInAt ? " · Presente" : " · A confirmar"));
      textBlock("VÍNCULO DA CRIANÇA", affiliationLabel(child.affiliation));
      textBlock("RESPONSÁVEIS VINCULADOS", child.guardianNames.join("; ") || "Sem vínculo informado");
    }
    for (const guardian of family.guardians) {
      textBlock(guardian.attending ? "ACOMPANHANTE" : "CONTATO / NÃO IRÁ", guardian.fullName + " · " + formatBirthDate(guardian.birthDate) + " · " + guardian.age + " anos" + " · Celular " + (guardian.phone ? formatPhone(guardian.phone) : "não informado") + (guardian.attending ? guardian.checkedInAt ? " · Presente" : " · A confirmar" : ""));
    }
    for (const question of family.questions) textBlock("DÚVIDA / DIFICULDADE", question.text);
    if (cursor - BOTTOM >= 6) page.drawLine({ start: { x: MARGIN, y: cursor - 2 }, end: { x: PAGE_WIDTH - MARGIN, y: cursor - 2 }, color: C.line, thickness: 0.5 });
    cursor -= 20;
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    page = current;
    page.drawLine({ start: { x: MARGIN, y: 33 }, end: { x: PAGE_WIDTH - MARGIN, y: 33 }, color: C.line, thickness: 0.5 });
    draw("Idades em 21/11/2026 · Gerado em " + generated + " (São Paulo)", MARGIN, 19, { size: 7, color: C.muted });
    const count = "Página " + (index + 1) + " de " + pages.length;
    draw(count, PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(count, 7), 19, { size: 7, color: C.muted });
  });
  pdf.setTitle("Silas 10 - Lista completa de inscrições");
  pdf.setAuthor("Organização Silas 10");
  pdf.setSubject("Participantes, responsáveis vinculados e confirmação de presença");
  return pdf.save();
}
