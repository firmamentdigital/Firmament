"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, ImagePlus, LoaderCircle, Mail, Save, ShieldCheck, UserPlus, X, Copy, Trash2 } from "lucide-react";
import type { EventBrand } from "@/lib/brand-types";
import type { AccessMember, GuestInvitation } from "@/lib/access";
import BrandDisplay from "../brand-display";

async function resultOf<T>(response: Response) {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível salvar. Tente novamente.");
  return body as T;
}
function BrandEditor({ brand, busy, onSave, onDelete }: { brand: EventBrand; busy: boolean; onSave: (brand: EventBrand) => void; onDelete: (brand: EventBrand) => void }) {
  const [draft, setDraft] = useState(brand);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removable = !brand.id.startsWith("default-");
  useEffect(() => setDraft(brand), [brand]);
  return <form className="brand-editor" onSubmit={e => { e.preventDefault(); onSave(draft); }}>
    <div className="brand-preview"><img src={brand.imageUrl} alt={brand.label} /></div>
    <div className="brand-edit-fields"><label className="field"><span>Nome da marca</span><input value={draft.label} onChange={e => setDraft(v => ({ ...v, label: e.target.value }))} required maxLength={100} minLength={2} /></label><div className="brand-edit-options"><label className="field"><span>Categoria</span><select value={draft.category} onChange={e => setDraft(v => ({ ...v, category: e.target.value as EventBrand["category"] }))}><option value="organizer">Realização</option><option value="supporter">Apoio</option></select></label><label className="field order-field"><span>Ordem</span><input type="number" min={0} max={999} value={draft.sortOrder} onChange={e => setDraft(v => ({ ...v, sortOrder: Number(e.target.value) }))} required /></label></div><label className="check-row"><input type="checkbox" checked={draft.active} onChange={e => setDraft(v => ({ ...v, active: e.target.checked }))} /><span>Exibir no formulário e no cartão</span></label></div>
    <div className="brand-editor-actions">
      <button className="button secondary" disabled={busy} type="submit"><Save size={16} />Salvar</button>
      {removable && (!confirmDelete
        ? <button type="button" className="text-button danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Excluir</button>
        : <span className="brand-delete-confirm">Excluir {brand.label}? <button type="button" className="text-button danger" disabled={busy} onClick={() => onDelete(brand)}>Sim, excluir</button><button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>Manter</button></span>)}
    </div>
  </form>;
}
export default function EventSettings({ isOwner, ownerEmail }: { isOwner: boolean; ownerEmail: string }) {
  const [section, setSection] = useState<"brands" | "access">("brands");
  const [brands, setBrands] = useState<EventBrand[]>([]); const [members, setMembers] = useState<AccessMember[]>([]);
  const [invitation, setInvitation] = useState<GuestInvitation | null>(null);
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [uploadPreview, setUploadPreview] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/admin/brands", { cache: "no-store" }).then(resultOf<EventBrand[]>), isOwner ? fetch("/api/admin/access", { cache: "no-store" }).then(resultOf<{ members: AccessMember[] }>) : Promise.resolve({ members: [] })])
      .then(([b, a]) => { if (active) { setBrands(b); setMembers(a.members); } })
      .catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOwner]);
  useEffect(() => () => { if (uploadPreview) URL.revokeObjectURL(uploadPreview); }, [uploadPreview]);
  async function run(task: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await task(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar."); } finally { setBusy(false); } }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    await run(async () => {
      const image = data.get("image");
      if (!(image instanceof File) || !image.size) throw new Error("Escolha a logomarca antes de publicar.");
      if (image.size > 2 * 1024 * 1024) throw new Error("Use uma logomarca com até 2 MB.");
      const url = URL.createObjectURL(image); const check = new Image();
      try { check.src = url; await check.decode(); if (!check.naturalWidth || !check.naturalHeight) throw new Error(); }
      catch { throw new Error("Esta imagem não abriu corretamente. Escolha outro PNG, JPG ou WebP."); }
      finally { URL.revokeObjectURL(url); }
      const list = await resultOf<EventBrand[]>(await fetch("/api/admin/brands", { method: "POST", body: data })); setBrands(list); form.current?.reset(); setUploadPreview(""); setNotice("Logomarca publicada no formulário e nos próximos cartões."); });
  }
  async function removeBrand(brand: EventBrand) {
    await run(async () => { setBrands(await resultOf<EventBrand[]>(await fetch("/api/admin/brands/" + brand.id, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: brand.version }) }))); setNotice("Marca excluída do formulário e dos próximos cartões."); });
  }
  async function saveBrand(brand: EventBrand) {
    await run(async () => { setBrands(await resultOf<EventBrand[]>(await fetch("/api/admin/brands/" + brand.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brand) }))); setNotice("Marca atualizada."); });
  }
  async function grant(e: React.FormEvent) {
    e.preventDefault(); await run(async () => { const result = await resultOf<{ members: AccessMember[]; invitation: GuestInvitation }>(await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })); setMembers(result.members); setInvitation(result.invitation); setEmail(""); setNotice("Acesso autorizado. O convite está pronto para você enviar."); });
  }
  async function revoke(member: AccessMember) {
    await run(async () => { const latest = await resultOf<{ members: AccessMember[] }>(await fetch("/api/admin/access", { cache: "no-store" })); const current = latest.members.find(m => m.email === member.email); if (!current) throw new Error("Acesso não encontrado. Atualize a página."); const result = await resultOf<{ members: AccessMember[] }>(await fetch("/api/admin/access", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: member.email, version: current.version }) })); setMembers(result.members); setInvitation(current => current?.email === member.email ? null : current); setNotice("Acesso revogado. A conta não poderá mais usar a gestão."); });
  }
  function inviteLink(value: GuestInvitation) {
    return window.location.origin + "/gestao/convidado?email=" + encodeURIComponent(value.email) + (value.token ? "#convite=" + value.token : "");
  }
  function inviteMail(value: GuestInvitation) {
    const body = `Olá! Você está convidado para a gestão do evento Silas 10.\n\nAcesse este link:\n${inviteLink(value)}\n\nE-mail: ${value.email}\n${value.initialPassword ? "Senha inicial: 123456\nNo primeiro acesso, crie sua própria senha. O link inicial vale por 7 dias." : "Entre com a senha que você já cadastrou."}\n\nVocê poderá acompanhar inscrições, receber participantes e preparar os avisos do evento.`;
    return "mailto:" + value.email + "?subject=" + encodeURIComponent("Seu acesso à gestão · Silas 10") + "&body=" + encodeURIComponent(body);
  }
  async function prepare(member: AccessMember, reset = false) {
    await run(async () => {
      const latest = await resultOf<{ members: AccessMember[] }>(await fetch("/api/admin/access", { cache: "no-store" }));
      const current = latest.members.find(m => m.email === member.email); if (!current) throw new Error("Acesso não encontrado. Atualize a página.");
      const result = await resultOf<{ members: AccessMember[]; invitation: GuestInvitation }>(await fetch("/api/admin/access/invitation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: member.email, version: current.version, reset }) }));
      setMembers(result.members); setInvitation(result.invitation);
      setNotice(reset ? "Senha redefinida. Envie o novo convite para a pessoa entrar." : "Convite pronto para enviar.");
      requestAnimationFrame(() => document.getElementById("invite-ready")?.scrollIntoView({ block: "center" }));
    });
  }
  async function copyInvitation(value: GuestInvitation) {
    try { await navigator.clipboard.writeText(inviteLink(value)); setNotice("Link do convidado copiado."); }
    catch { setError("Não foi possível copiar. Use o botão de envio por e-mail."); }
  }

  return <section className="operation-panel event-settings" aria-label="Configurações do evento">
    <div className="operation-heading"><span className="operation-icon"><ShieldCheck size={24} /></span><div><h2>Seu evento, organizado.</h2><p>Gerencie as marcas e as pessoas autorizadas.</p></div></div>
    <nav className="settings-tabs" aria-label="Configurações"><button className={section === "brands" ? "active" : ""} onClick={() => setSection("brands")}>Realizadores e apoiadores</button>{isOwner && <button className={section === "access" ? "active" : ""} onClick={() => setSection("access")}>Acessos à gestão</button>}</nav>
    {error && <p className="form-error" role="alert"><CircleAlert size={18} />{error}</p>}{notice && <p className="operation-success" role="status"><Check size={18} />{notice}</p>}
    {loading ? <p><LoaderCircle className="spin" size={19} /> Carregando configurações…</p> : section === "brands" ? <>
      <div className="settings-description"><h3>As marcas certas, em todos os lugares.</h3><p>As marcas ativas aparecem ao final do formulário e no cartão de confirmação, inclusive na imagem baixada. Cartões já salvos no celular mantêm as marcas da data do download.</p></div>
      <div className="branding-live-preview"><BrandDisplay brands={brands} compact /></div>
      <div className="brand-editor-list">{brands.map(brand => <BrandEditor key={brand.id} brand={brand} busy={busy} onSave={b => void saveBrand(b)} onDelete={b => void removeBrand(b)} />)}</div>
      <form ref={form} className="brand-upload-form" onSubmit={upload}><h3><ImagePlus size={21} />Incluir uma logomarca</h3><fieldset disabled={busy}><div className="settings-form-grid"><label className="field"><span>Nome da marca</span><input name="label" required minLength={2} maxLength={100} placeholder="Nome do realizador ou apoiador" /></label><label className="field"><span>Categoria</span><select name="category" defaultValue="supporter"><option value="supporter">Apoio</option><option value="organizer">Realização</option></select></label><label className="field order-field"><span>Ordem de exibição</span><input name="sortOrder" type="number" min={0} max={999} defaultValue={30} required /></label></div><label className="field"><span>Arquivo da logomarca</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" required onChange={e => { const f = e.target.files?.[0]; setUploadPreview(f ? URL.createObjectURL(f) : ""); }} /><small>PNG com fundo transparente é o ideal. Também aceita JPG e WebP, até 2 MB.</small></label>{uploadPreview && <img className="new-brand-preview" src={uploadPreview} alt="Prévia da nova logomarca" />}<button type="submit" className="button primary">{busy ? <LoaderCircle className="spin" size={18} /> : <ImagePlus size={18} />}Publicar logomarca</button></fieldset></form>
    </> : <>
      <div className="access-owner"><ShieldCheck size={21} /><div><strong>Seu perfil é o proprietário</strong><span>{ownerEmail}</span><small>Só você pode autorizar, revogar acessos e excluir inscrições definitivamente.</small></div></div>
      <form className="invite-form" onSubmit={grant}><label className="field"><span>E-mail de quem terá acesso</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" required maxLength={254} autoComplete="off" /></label><button className="button primary" type="submit" disabled={busy}><UserPlus size={18} />Autorizar e-mail</button></form>
      <p className="settings-help">O convidado entra com o e-mail autorizado e a senha inicial 123456. O link já preenche o e-mail; na primeira entrada, ele cria sua própria senha. O envio abre seu aplicativo de e-mail com tudo pronto.</p>
      {invitation && <div className="invite-ready-card" id="invite-ready"><h3><Mail size={19} />Convite pronto</h3><p><strong>{invitation.email}</strong></p>{invitation.initialPassword ? <p>Senha inicial: <code>123456</code></p> : <p>A pessoa usa a senha que já cadastrou.</p>}<div className="invite-ready-actions"><a className="button primary" href={inviteMail(invitation)}><Mail size={16} />Enviar por e-mail</a><button className="button secondary" onClick={() => void copyInvitation(invitation)}><Copy size={16} />Copiar link</button></div>{invitation.initialPassword && <small>O link de primeiro acesso vale por 7 dias. A senha inicial é trocada antes de liberar a gestão. Ao gerar outro convite inicial, o anterior deixa de funcionar.</small>}</div>}
      <div className="access-members">{members.length ? members.map(member => <div className={"access-member" + (member.active ? "" : " revoked")} key={member.email}><div><strong>{member.email}</strong><small>{!member.active ? "Acesso revogado" : member.passwordReady ? "Ativo · senha definida" : "Autorizado · aguardando primeiro acesso"}</small></div>{member.active ? <><button className="button secondary" disabled={busy} onClick={() => void prepare(member)}><Mail size={16} />Enviar convite</button>{member.passwordReady && <button className="text-button reset-member-password" disabled={busy} onClick={() => void prepare(member, true)}>Redefinir senha</button>}<button className="text-button danger" disabled={busy} onClick={() => void revoke(member)}><X size={15} />Revogar</button></> : <button className="text-button" disabled={busy} onClick={() => void run(async () => { const r = await resultOf<{ members: AccessMember[]; invitation: GuestInvitation }>(await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: member.email }) })); setMembers(r.members); setInvitation(r.invitation); setNotice("Acesso reativado. Envie o convite."); })}>Reativar acesso</button>}</div>) : <p className="quiet-copy">Apenas você tem acesso à gestão. Nenhum outro e-mail foi autorizado.</p>}</div>
    </>}
  </section>;
}
