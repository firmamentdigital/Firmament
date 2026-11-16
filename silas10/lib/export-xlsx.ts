import type { EventSnapshot } from "./types";
import { affiliationLabel } from "./affiliation";
import { formatPhone } from "./event";

type Cell = string | number | { date: string };
const xml = (text: unknown) => String(text ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const column = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : column(Math.floor(index / 26) - 1) + column(index % 26);
function dateCell(value: string): Cell { return value ? { date: value } : ""; }
function excelDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return (Date.parse(value + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000 - (value < "1900-03-01" ? 1 : 0);
  // Export event times as local São Paulo wall-clock values.
  return (Date.parse(value) - 3 * 3600000 - Date.UTC(1899, 11, 30)) / 86400000;
}
function worksheet(title: string, headers: string[], rows: Cell[][], widths: number[]) {
  const last = column(headers.length - 1); const count = Math.max(5, rows.length + 5);
  const cell = (value: Cell, c: number, r: number, style: number) => {
    const ref = column(c) + r;
    if (typeof value === "object") return `<c r="${ref}" s="${value.date.length === 10 ? 4 : 5}"><v>${excelDate(value.date)}</v></c>`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="6"><v>${value}</v></c>`;
    // All user text is inlineStr, never an Excel formula or external link.
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  };
  const data = [
    `<row r="1" ht="32" customHeight="1">${cell("SILAS 10 · " + title, 0, 1, 1)}</row>`,
    `<row r="2" ht="23" customHeight="1">${cell("Como realizar seu sonho · Da origem ao sucesso", 0, 2, 2)}</row>`,
    `<row r="3" ht="22" customHeight="1">${cell("21/11/2026 · 9h às 11h · SPFC · Uso exclusivo da organização", 0, 3, 2)}</row>`,
    `<row r="5" ht="32" customHeight="1">${headers.map((v, c) => cell(v, c, 5, 3)).join("")}</row>`,
    ...rows.map((values, i) => { const lines = Math.max(1, ...values.map((v, c) => typeof v === "string" ? Math.ceil(v.length / Math.max(10, widths[c] - 4)) + (v.match(/\n/g)?.length || 0) : 1)); return `<row r="${i + 6}" ht="${Math.min(150, Math.max(30, lines * 14 + 8))}" customHeight="1">${values.map((v, c) => cell(v, c, i + 6, i % 2 ? 0 : 7)).join("")}</row>`; }),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${count}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${data}</sheetData><autoFilter ref="A5:${last}${count}"/><mergeCells count="3"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/><mergeCell ref="A3:${last}3"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts><fonts count="4"><font><sz val="11"/><color rgb="FF202024"/><name val="Aptos"/></font><font><b/><sz val="20"/><color rgb="FFCE1934"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><sz val="11"/><color rgb="FF706B66"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1C1B20"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8F5F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

// ZIP method 0 is deliberately dependency-free and supported by Excel and LibreOffice.
function zipFiles(files: Record<string, string>) {
  const encoder = new TextEncoder(); const table = Array.from({ length: 256 }, (_, i) => { let n = i; for (let k = 0; k < 8; k++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0); return n >>> 0; });
  const chunks: Uint8Array[] = []; const directory: Uint8Array[] = []; let offset = 0; let dirSize = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = encoder.encode(path); const bytes = encoder.encode(text); let crc = 0xffffffff;
    for (const b of bytes) crc = (crc >>> 8) ^ table[(crc ^ b) & 255]; crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length); const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(12, 33, true); l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true); l.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length); const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true); c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(local, bytes); directory.push(central); dirSize += central.length; offset += local.length + bytes.length;
  }
  const end = new Uint8Array(22); const e = new DataView(end.buffer); e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length, true); e.setUint16(10, directory.length, true); e.setUint32(12, dirSize, true); e.setUint32(16, offset, true);
  const output = new Uint8Array(offset + dirSize + end.length); let pos = 0;
  for (const chunk of [...chunks, ...directory, end]) { output.set(chunk, pos); pos += chunk.length; } return output;
}
export function buildRegistrationXlsx(snapshot: EventSnapshot) {
  const sheets = [
    { name: "Participantes", widths: [38, 22, 16, 13, 24, 24, 44, 24, 20, 22], headers: ["Nome completo", "Perfil", "Nascimento", "Idade no encontro", "Vínculo da criança", "Celular principal", "Responsável ou crianças vinculadas", "Inscrição", "Presença", "Entrada (São Paulo)"], rows: snapshot.participants.map(p => [p.fullName, p.kind === "child" ? "Criança / jovem" : "Responsável", dateCell(p.birthDate), p.age, p.kind === "child" ? affiliationLabel(p.affiliation) : "", p.phone.split(" / ").map(formatPhone).join("\n"), p.linkedNames.join("\n"), p.familyCodes.join("\n"), p.checkedInAt ? "Presente" : "Aguardando", dateCell(p.checkedInAt || "")]) },
    { name: "Famílias e vínculos", widths: [24, 16, 36, 23, 38, 16, 24, 40, 23], headers: ["Inscrição", "Situação", "Responsável principal", "Celular", "Criança / jovem", "Nascimento", "Vínculo da criança", "Responsáveis vinculados à criança", "Inscrita em (São Paulo)"], rows: snapshot.families.flatMap(f => f.children.map(c => [f.code, f.status === "cancelled" ? "Cancelada" : "Ativa", f.primaryGuardianName, formatPhone(f.phone), c.fullName, dateCell(c.birthDate), affiliationLabel(c.affiliation), c.guardianNames.join("\n"), dateCell(f.createdAt)])) },
    { name: "Responsáveis", widths: [38, 16, 14, 25, 26, 22, 50, 20], headers: ["Nome completo", "Nascimento", "Idade no encontro", "Celular", "Inscrições", "Acompanhará o encontro", "Crianças vinculadas", "Situação das famílias"], rows: [...new Map(snapshot.families.flatMap(f => f.guardians.map(g => [g.id, g] as const))).values()].map(g => { const linked = snapshot.families.filter(f => f.guardians.some(p => p.id === g.id)); return [g.fullName, dateCell(g.birthDate), g.age, [...new Set(linked.map(f => formatPhone(f.phone)))].join("\n"), linked.map(f => f.code).join("\n"), linked.some(f => f.status === "active" && f.guardians.some(p => p.id === g.id && p.attending)) ? "Sim" : "Não", linked.flatMap(f => f.children.filter(c => c.guardianNames.includes(g.fullName)).map(c => c.fullName)).join("\n"), [...new Set(linked.map(f => f.status === "active" ? "Ativa" : "Cancelada"))].join("\n")]; }) },
    { name: "Dúvidas e dificuldades", widths: [24, 35, 23, 16, 100, 23], headers: ["Inscrição", "Responsável", "Celular", "Situação", "Dúvida ou dificuldade", "Recebida em (São Paulo)"], rows: snapshot.families.flatMap(f => f.questions.map(q => [f.code, f.primaryGuardianName, formatPhone(f.phone), f.status === "active" ? "Ativa" : "Cancelada", q.text, dateCell(q.createdAt)])) },
    { name: "Resumo", widths: [42, 28], headers: ["Indicador", "Quantidade"], rows: [["Famílias ativas", snapshot.stats.families], ["Famílias canceladas", snapshot.stats.cancelledFamilies], ["Crianças / jovens", snapshot.stats.children], ["Responsáveis acompanhantes", snapshot.stats.guardians], ["Pessoas previstas", snapshot.stats.expected], ["Presenças registradas", snapshot.stats.present], ["Atualizado em (São Paulo)", dateCell(snapshot.updatedAt)]] },
  ];
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": styles,
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = worksheet(s.name, s.headers, s.rows as Cell[][], s.widths); });
  return zipFiles(files);
}
