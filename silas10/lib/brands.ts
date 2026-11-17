import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError } from "./http";
import { DEFAULT_BRANDS, type EventBrand } from "./brand-types";

type Row = { id: string; category: "organizer" | "supporter"; label: string; asset_key: string | null; asset_path: string | null; mime: string | null; sort_order: number; active: number; version: number };
function brandKey(brand: { category: string; label: string }) {
  return brand.category + ":" + brand.label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
export async function listBrands(includeInactive = false): Promise<EventBrand[]> {
  if (!env.DB) return DEFAULT_BRANDS;
  const rows = (await env.DB.prepare("SELECT id, category, label, asset_key, asset_path, mime, sort_order, active, version FROM event_brands").all<Row>()).results;
  const combined = new Map(DEFAULT_BRANDS.map(brand => [brand.id, brand]));
  rows.forEach(row => combined.set(row.id, { id: row.id, category: row.category, label: row.label, imageUrl: row.asset_path || `/api/brands/${row.id}/image?v=${row.version}`, sortOrder: row.sort_order, active: Boolean(row.active), version: row.version }));
  // A brand uploaded in management replaces its bundled fallback, even when
  // hidden, so the public form and downloaded cards never show both copies.
  const customKeys = new Set(rows.filter(row => !row.id.startsWith("default-")).map(brandKey));
  return [...combined.values()].filter(brand => (!brand.id.startsWith("default-") || !customKeys.has(brandKey(brand))) && (includeInactive || brand.active)).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR"));
}
const fields = z.object({ label: z.string().trim().min(2, "Informe o nome da marca.").max(100), category: z.enum(["organizer", "supporter"]), sortOrder: z.coerce.number().int().min(0).max(999) });
const validId = z.string().regex(/^(?:default-(?:silas|cod|athletics|bookfair|wmorente|firmament)|[a-f0-9-]{36})$/);
export async function createBrand(form: FormData, userId: string) {
  const input = fields.parse({ label: form.get("label"), category: form.get("category"), sortOrder: form.get("sortOrder") || 30 });
  if ((await listBrands(true)).length >= 30) throw new AppError(422, "O evento aceita até 30 marcas. Edite uma marca existente.");
  const file = form.get("image");
  if (!file || typeof file === "string" || !file.size) throw new AppError(422, "Escolha a logomarca em PNG, JPG ou WebP.");
  if (file.size > 2 * 1024 * 1024) throw new AppError(413, "Use uma logomarca com até 2 MB.");
  if (!env.BUCKET) throw new AppError(503, "O envio de logomarcas está sendo preparado.");
  const bytes = await file.arrayBuffer(); const h = new Uint8Array(bytes);
  let mime = "";
  if (h.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => h[i] === b)) mime = "image/png";
  else if (h.length >= 3 && h[0] === 255 && h[1] === 216 && h[2] === 255) mime = "image/jpeg";
  else if (h.length >= 12 && String.fromCharCode(...h.slice(0, 4)) === "RIFF" && String.fromCharCode(...h.slice(8, 12)) === "WEBP") mime = "image/webp";
  if (!mime) throw new AppError(422, "O arquivo não é uma imagem PNG, JPG ou WebP válida.");
  const id = crypto.randomUUID(); const key = "brands/" + id;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB!.prepare("INSERT INTO event_brands (id, category, label, asset_key, mime, sort_order, active, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)")
      .bind(id, input.category, input.label, key, mime, input.sortOrder, new Date().toISOString(), userId).run();
  } catch (error) { await env.BUCKET.delete(key); throw error; }
  return listBrands(true);
}
export async function updateBrand(id: string, raw: unknown, userId: string) {
  validId.parse(id);
  const input = fields.extend({ active: z.boolean(), version: z.number().int().nonnegative() }).parse(raw);
  const existing = (await listBrands(true)).find(brand => brand.id === id);
  if (!existing) throw new AppError(404, "Marca não encontrada.");
  if (existing.version !== input.version) throw new AppError(409, "A marca foi atualizada em outra tela. Recarregue a lista.");
  const fallback = DEFAULT_BRANDS.find(brand => brand.id === id);
  const result = fallback
    ? await env.DB!.prepare("INSERT INTO event_brands (id, category, label, asset_path, sort_order, active, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET category=excluded.category, label=excluded.label, sort_order=excluded.sort_order, active=excluded.active, version=event_brands.version+1, updated_at=excluded.updated_at, updated_by=excluded.updated_by WHERE event_brands.version = ?")
      .bind(id, input.category, input.label, fallback.imageUrl, input.sortOrder, Number(input.active), new Date().toISOString(), userId, input.version).run()
    : await env.DB!.prepare("UPDATE event_brands SET category=?, label=?, sort_order=?, active=?, version=version+1, updated_at=?, updated_by=? WHERE id=? AND version=?")
      .bind(input.category, input.label, input.sortOrder, Number(input.active), new Date().toISOString(), userId, id, input.version).run();
  if (!result.meta.changes) throw new AppError(409, "A marca foi atualizada em outra tela. Recarregue a lista.");
  return listBrands(true);
}
// Exclui uma marca enviada pela gestão (banco + arquivo). As marcas que vêm com o
// sistema (default-*) não são excluídas: basta desmarcar "Exibir no formulário".
export async function deleteBrand(id: string, raw: unknown) {
  validId.parse(id);
  if (id.startsWith("default-")) throw new AppError(422, "Esta marca vem com o sistema. Para retirá-la, desmarque \"Exibir no formulário e no cartão\" e salve.");
  const { version } = z.object({ version: z.number().int().nonnegative() }).parse(raw);
  const row = await env.DB!.prepare("SELECT asset_key FROM event_brands WHERE id=? AND version=?").bind(id, version).first<{ asset_key: string | null }>();
  if (!row) throw new AppError(409, "A marca foi alterada ou já foi excluída. Recarregue a lista.");
  const result = await env.DB!.prepare("DELETE FROM event_brands WHERE id=? AND version=?").bind(id, version).run();
  if (!result.meta.changes) throw new AppError(409, "A marca foi alterada ou já foi excluída. Recarregue a lista.");
  if (row.asset_key && env.BUCKET) await env.BUCKET.delete(row.asset_key);
  return listBrands(true);
}
export async function brandImage(id: string) {
  validId.parse(id);
  const row = await env.DB!.prepare("SELECT asset_key, active FROM event_brands WHERE id = ?").bind(id).first<{ asset_key: string | null; active: number }>();
  if (!row?.asset_key || !env.BUCKET) throw new AppError(404, "Logomarca não encontrada.");
  const object = await env.BUCKET.get(row.asset_key);
  if (!object) throw new AppError(404, "Logomarca não encontrada.");
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}
