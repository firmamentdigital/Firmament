import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError } from "./http";
import { getEventSnapshot } from "./snapshot";
import type { MessageCampaign, MessageContact, MessageDetail } from "./message-types";

const campaignInput = z.object({ title: z.string().trim().min(3, "Dê um nome ao aviso.").max(100), body: z.string().trim().max(2000, "Use até 2.000 caracteres no aviso.") });
export const campaignId = z.string().uuid();
type CampaignRow = { id: string; title: string; body: string; image_key: string | null; image_name: string | null; image_mime: string | null; created_at: string; total: number; confirmed: number };
function db() { if (!env.DB) throw new AppError(503, "Os avisos estão sendo preparados."); return env.DB; }
const campaignQuery = `SELECT m.*, (SELECT COUNT(*) FROM message_contacts c WHERE c.campaign_id=m.id) AS total,
  (SELECT COUNT(*) FROM message_contacts c WHERE c.campaign_id=m.id AND c.confirmed_at IS NOT NULL) AS confirmed FROM message_campaigns m`;
function campaign(row: CampaignRow): MessageCampaign {
  return { id: row.id, title: row.title, body: row.body, imageName: row.image_name, createdAt: row.created_at, total: row.total, confirmed: row.confirmed };
}
export async function listCampaigns() {
  const rows = await db().prepare(campaignQuery + " ORDER BY m.created_at DESC LIMIT 100").all<CampaignRow>();
  return rows.results.map(campaign);
}
export async function getCampaign(id: string): Promise<MessageDetail> {
  campaignId.parse(id);
  const row = await db().prepare(campaignQuery + " WHERE m.id = ?").bind(id).first<CampaignRow>();
  if (!row) throw new AppError(404, "Aviso não encontrado.");
  const contacts = await db().prepare("SELECT phone, details_json, confirmed_at, version FROM message_contacts WHERE campaign_id = ? ORDER BY phone").bind(id)
    .all<{ phone: string; details_json: string; confirmed_at: string | null; version: number }>();
  return { ...campaign(row), contacts: contacts.results.map(item => ({ ...JSON.parse(item.details_json), phone: item.phone, confirmedAt: item.confirmed_at, version: item.version })) };
}
export async function limitedFormData(request: Request) {
  const limit = 5 * 1024 * 1024 + 32_000;
  if (Number(request.headers.get("content-length") || 0) > limit) throw new AppError(413, "A imagem deve ter até 5 MB.");
  if (!request.headers.get("content-type")?.includes("multipart/form-data") || !request.body) throw new AppError(415, "Envie o aviso pelo formulário da gestão.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length;
    if (size > limit) { await reader.cancel(); throw new AppError(413, "A imagem deve ter até 5 MB."); }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
}
export async function createCampaign(form: FormData, userId: string) {
  const input = campaignInput.parse({ title: form.get("title"), body: form.get("body") });
  const upload = form.get("image");
  const image = upload && typeof upload !== "string" && upload.size ? upload : null;
  if (!input.body && !image) throw new AppError(422, "Escreva uma mensagem ou inclua uma imagem.");
  let bytes: ArrayBuffer | null = null; let imageMime: string | null = null;
  if (image) {
    if (image.size > 5 * 1024 * 1024) throw new AppError(413, "A imagem deve ter até 5 MB.");
    bytes = await image.arrayBuffer(); const h = new Uint8Array(bytes);
    if (h.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i)=>h[i]===b)) imageMime = "image/png";
    else if (h.length >= 3 && h[0]===255 && h[1]===216 && h[2]===255) imageMime = "image/jpeg";
    else if (h.length >= 12 && String.fromCharCode(...h.slice(0,4))==='RIFF' && String.fromCharCode(...h.slice(8,12))==='WEBP') imageMime = "image/webp";
    if (!imageMime) throw new AppError(422, "Escolha uma imagem PNG, JPG ou WebP válida.");
    if (!env.BUCKET) throw new AppError(503, "O envio de imagens está sendo preparado.");
  }
  const snapshot = await getEventSnapshot();
  const contacts = new Map<string, Omit<MessageContact, "confirmedAt" | "version">>();
  // Um contato por celular, incluindo o segundo responsável (pai e mãe recebem cada um
  // no seu número). {responsavel} usa o nome de quem recebe aquele celular.
  for (const family of snapshot.families.filter(f => f.status === "active")) {
    for (const person of family.guardians) {
      const phone = person.primary ? family.phone : person.phone;
      if (!phone) continue;
      const item = contacts.get(phone) || { phone, responsibleNames: [], childNames: [], codes: [] };
      item.responsibleNames = [...new Set([...item.responsibleNames, person.fullName])];
      item.childNames = [...new Set([...item.childNames, ...family.children.map(child=>child.fullName)])];
      if (!item.codes.includes(family.code)) item.codes.push(family.code);
      contacts.set(phone, item);
    }
  }
  if (!contacts.size) throw new AppError(422, "Ainda não há famílias inscritas para receber avisos.");
  const id = crypto.randomUUID(); const imageKey = image ? "campaigns/" + id : null;
  const imageName = image ? "Silas_10_aviso." + (imageMime === "image/jpeg" ? "jpg" : imageMime === "image/png" ? "png" : "webp") : null;
  if (imageKey && bytes) await env.BUCKET!.put(imageKey, bytes, { httpMetadata: { contentType: imageMime! } });
  try {
    await db().batch([
      db().prepare("INSERT INTO message_campaigns (id,title,body,image_key,image_name,image_mime,created_at,created_by) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id,input.title,input.body,imageKey,imageName,imageMime,new Date().toISOString(),userId),
      ...Array.from({length:Math.ceil(contacts.size/25)},(_,index)=> {
        const chunk=[...contacts.values()].slice(index*25,(index+1)*25);
        return db().prepare("INSERT INTO message_contacts (campaign_id,phone,details_json) VALUES "+chunk.map(()=>"(?,?,?)").join(","))
          .bind(...chunk.flatMap(contact=>[id,contact.phone,JSON.stringify(contact)]));
      }),
    ]);
  } catch (error) { if (imageKey) await env.BUCKET!.delete(imageKey); throw error; }
  return getCampaign(id);
}
export async function campaignImage(id: string) {
  campaignId.parse(id);
  const row = await db().prepare("SELECT image_key, image_name FROM message_campaigns WHERE id = ?").bind(id).first<{image_key:string|null;image_name:string|null}>();
  if (!row?.image_key || !env.BUCKET) throw new AppError(404, "Este aviso não tem imagem.");
  const object = await env.BUCKET.get(row.image_key);
  if (!object) throw new AppError(404, "Imagem não encontrada.");
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": `inline; filename="${row.image_name}"` });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}
const statusSchema = z.object({ phone:z.string().regex(/^[1-9]\d{9,10}$/), confirmed:z.boolean(), version:z.number().int().nonnegative() });
export async function updateContact(id:string, raw:unknown,userId:string) {
  campaignId.parse(id); const input=statusSchema.parse(raw);
  const result=await db().prepare("UPDATE message_contacts SET confirmed_at=?, confirmed_by=?, version=version+1 WHERE campaign_id=? AND phone=? AND version=?")
    .bind(input.confirmed?new Date().toISOString():null,input.confirmed?userId:null,id,input.phone,input.version).run();
  if (!result.meta.changes) throw new AppError(409,"Este contato foi atualizado em outra tela. Reabra o aviso.");
  return { updated:true };
}
