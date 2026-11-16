import type { EventBrand } from "./brand-types";
export type ConfirmationCardData = {
  code: string; children: string[]; guardians: string[];
  responsibleName?: string; responsibleAttending?: boolean; phone?: string;
  responsibleCount?: number;
};
// Texto do bloco de responsáveis (um ou dois, ex.: pai e mãe).
export function responsibleSummary(data: ConfirmationCardData) {
  const plural = (data.responsibleCount ?? 1) > 1;
  const attending = data.responsibleAttending !== false ? data.guardians : [];
  const note = !attending.length ? "Contato da família · sem vaga de acompanhante."
    : plural && attending.length > 1 ? "Os dois acompanharão as crianças no encontro."
    : plural ? `${attending[0]} acompanhará as crianças no encontro.`
    : "Acompanhará as crianças no encontro.";
  return { label: plural ? "Responsáveis vinculados" : "Responsável vinculado", note, plural, attending: attending.length > 0 };
}
export function receptionUrl(origin: string, code: string) {
  if (!/^S10-[A-F0-9]{10}$/.test(code)) throw new Error("Código de inscrição inválido.");
  const url = new URL("/gestao", origin); url.searchParams.set("inscricao", code); return url.toString();
}
function imageFrom(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar uma marca do cartão. Tente novamente.")); image.src = url;
  });
}
function linesFor(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []; let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? line + " " + word : word;
    if (context.measureText(candidate).width <= width) { line = candidate; continue; }
    if (line) lines.push(line); line = "";
    for (const character of word) {
      if (line && context.measureText(line + character).width > width) { lines.push(line); line = ""; }
      line += character;
    }
  }
  if (line) lines.push(line); return lines;
}
/** A single image includes every name, the responsible adult, QR and active event marks. */
export async function confirmationCardImage(data: ConfirmationCardData, qrImage: string, brands: EventBrand[] = []) {
  await document.fonts.ready; await document.fonts.load("800 32px Manrope");
  const active = brands.filter(b => b.active);
  const [signature, qr, ...logos] = await Promise.all([imageFrom("/assets/silas-signature.png"), imageFrom(qrImage), ...active.map(b => imageFrom(b.imageUrl))]);
  const canvas = document.createElement("canvas"); canvas.width = 1080;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Seu navegador não conseguiu preparar o cartão.");
  ctx.font = "800 36px Manrope";
  const children = data.children.map(name => linesFor(ctx, name, 850));
  const responsible = linesFor(ctx, data.responsibleName || data.guardians.join(" e "), 900);
  const brandRows = (["organizer", "supporter"] as const).map(category => ({ category, indices: active.map((b, i) => b.category === category ? i : -1).filter(i => i >= 0) }));
  const brandsHeight = brandRows.reduce((n, group) => n + (group.indices.length ? 62 + Math.ceil(group.indices.length / 4) * 140 : 0), 0);
  canvas.height = 1180 + children.reduce((n, l) => n + l.length * 49 + 25, 0) + responsible.length * 49 + brandsHeight;
  ctx.fillStyle = "#fcfbf8"; ctx.fillRect(0, 0, 1080, canvas.height);
  ctx.fillStyle = "#ce1934"; ctx.fillRect(0, 0, 1080, 12);
  const mark = document.createElement("canvas"); mark.width = signature.naturalWidth; mark.height = signature.naturalHeight;
  const markContext = mark.getContext("2d"); if (!markContext) throw new Error("Não foi possível preparar a assinatura.");
  markContext.drawImage(signature, 0, 0); markContext.globalCompositeOperation = "source-in"; markContext.fillStyle = "#19191d"; markContext.fillRect(0, 0, mark.width, mark.height);
  ctx.drawImage(mark, 65, 28, 250, 160);
  ctx.textAlign = "right"; ctx.fillStyle = "#246a49"; ctx.font = "800 24px Manrope"; ctx.fillText("VAGAS RESERVADAS", 1010, 107); ctx.textAlign = "left";
  ctx.fillStyle = "#19191d"; ctx.font = "800 42px Manrope"; ctx.fillText("Como realizar seu sonho", 65, 230);
  ctx.fillStyle = "#ce1934"; ctx.font = "800 30px Manrope"; ctx.fillText("Da origem ao sucesso", 65, 278);
  ctx.fillStyle = "#1c1b20"; ctx.beginPath(); ctx.roundRect(65, 320, 950, 136, 18); ctx.fill();
  ctx.fillStyle = "#ff637b"; ctx.font = "800 94px Manrope"; ctx.fillText("21", 90, 426);
  ctx.fillStyle = "#fff"; ctx.font = "800 31px Manrope"; ctx.fillText("DE NOVEMBRO", 235, 376); ctx.font = "400 28px Manrope"; ctx.fillText("Sábado · das 9h às 11h", 235, 420);
  ctx.textAlign = "right"; ctx.font = "800 27px Manrope"; const total = data.children.length + data.guardians.length; ctx.fillText(`${total} ${total === 1 ? "pessoa" : "pessoas"}`, 980, 398); ctx.textAlign = "left";
  let y = 510;
  const label = (text: string) => { ctx.font = "800 22px Manrope"; ctx.fillStyle = "#ce1934"; ctx.fillText(text, 65, y); y += 50; };
  label(`CRIANÇAS E JOVENS · ${data.children.length}`);
  children.forEach((lines, i) => {
    ctx.font = "800 27px Manrope"; ctx.fillStyle = "#ce1934"; ctx.fillText(String(i + 1).padStart(2, "0"), 65, y);
    ctx.font = "800 36px Manrope"; ctx.fillStyle = "#19191d"; lines.forEach(line => { ctx.fillText(line, 128, y); y += 49; }); y += 25;
  });
  label(responsibleSummary(data).label.toUpperCase()); ctx.font = "800 36px Manrope"; ctx.fillStyle = "#19191d";
  responsible.forEach(line => { ctx.fillText(line, 65, y); y += 49; });
  ctx.font = "400 25px Manrope"; ctx.fillStyle = "#716b66";
  ctx.fillText(responsibleSummary(data).note, 65, y); y += 55;
  ctx.strokeStyle = "#dfd9d2"; ctx.beginPath(); ctx.moveTo(65, y); ctx.lineTo(1015, y); ctx.stroke(); y += 30;
  ctx.drawImage(qr, 65, y, 245, 245);
  ctx.fillStyle = "#716b66"; ctx.font = "800 20px Manrope"; ctx.fillText("CÓDIGO DA FAMÍLIA", 350, y + 64);
  ctx.fillStyle = "#19191d"; ctx.font = "800 37px Manrope"; ctx.fillText(data.code, 350, y + 119);
  ctx.font = "400 24px Manrope"; ctx.fillStyle = "#716b66"; ctx.fillText("Apresente este cartão na recepção.", 350, y + 167); y += 293;
  ctx.fillStyle = "#19191d"; ctx.font = "800 26px Manrope"; ctx.fillText("Auditório do Conselho Deliberativo do SPFC", 65, y); y += 42;
  ctx.font = "400 25px Manrope"; ctx.fillStyle = "#716b66"; ctx.fillText("Entrada pelo Portão 17 · Rua Laudo Natel", 65, y); y += 43;
  ctx.font = "400 22px Manrope"; ctx.fillText("Casos especiais · Mario Ferrari · (11) 94724-8000", 65, y); y += 42;
  for (const group of brandRows) {
    if (!group.indices.length) continue;
    y += 18; label(group.category === "organizer" ? "REALIZAÇÃO" : "APOIADORES");
    for (let offset = 0; offset < group.indices.length; offset += 4) {
      const row = group.indices.slice(offset, offset + 4); const cell = 950 / row.length;
      row.forEach((index, col) => { const logo = logos[index]; const scale = Math.min((cell - 32) / logo.naturalWidth, 115 / logo.naturalHeight); const w = logo.naturalWidth * scale; const h = logo.naturalHeight * scale; ctx.drawImage(active[index].id === "default-silas" ? mark : logo, 65 + col * cell + (cell - w) / 2, y + (115 - h) / 2, w, h); });
      y += 140;
    }
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível salvar o cartão.")), "image/png"));
}
