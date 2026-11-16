"use client";
import { useState } from "react";
import { GitMerge, LoaderCircle } from "lucide-react";
import { formatBirthDate, formatPhone } from "@/lib/event";
import type { MergePlan } from "@/lib/family-merge";

// Painel "Juntar inscrição duplicada", dentro dos detalhes da família (somente proprietário).
// A família aberta é a que fica; a outra (pelo código) é incorporada a ela.
export default function FamilyMergePanel({ keepId, keepCode, onMerged }: { keepId: string; keepCode: string; onMerged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<MergePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(confirm: boolean) {
    setBusy(true); setError("");
    try {
      const body = confirm && preview
        ? { keepId, removeCode: preview.remove.code, confirm: true, keepVersion: preview.keep.version, removeVersion: preview.remove.version }
        : { keepId, removeCode: code };
      const response = await fetch("/api/admin/family-merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { preview?: MergePlan; merged?: MergePlan; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível juntar as inscrições.");
      if (confirm) { await onMerged(); return; }
      setPreview(result.preview || null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sem conexão. Tente novamente."); }
    finally { setBusy(false); }
  }

  if (!open) return <div className="family-delete-zone family-merge-zone"><button className="text-button" onClick={() => setOpen(true)}><GitMerge size={16} />Juntar com uma inscrição duplicada</button></div>;

  return <div className="family-delete-zone family-merge-zone">
    <h3>Juntar inscrição duplicada</h3>
    <p>Use quando a mesma família foi inscrita duas vezes (ex.: pai e mãe inscreveram a mesma criança). Esta inscrição <strong>{keepCode}</strong> será mantida; a outra será incorporada a ela e deixará de existir.</p>
    {!preview && <form onSubmit={e => { e.preventDefault(); void call(false); }}>
      <label className="field"><span>Código da inscrição duplicada</span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="S10-..." autoComplete="off" maxLength={14} required /></label>
      <div className="delete-actions"><button type="submit" className="button primary" disabled={busy || code.trim().length < 14}>{busy ? <LoaderCircle size={16} className="spin" /> : <GitMerge size={16} />}Ver o que vai acontecer</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setOpen(false); setCode(""); setError(""); }}>Cancelar</button></div>
    </form>}
    {preview && <div className="merge-preview">
      <p><strong>{preview.remove.code}</strong> será incorporada a <strong>{preview.keep.code}</strong>:</p>
      <ul>
        {preview.duplicates.map((d, i) => <li key={"d" + i}>Criança repetida: <strong>{d.removed}</strong> é a mesma que <strong>{d.kept}</strong> ({formatBirthDate(d.birthDate)}). Fica só uma ficha.</li>)}
        {preview.moved.map((c, i) => <li key={"m" + i}>Criança que passa para esta inscrição: <strong>{c.fullName}</strong> ({formatBirthDate(c.birthDate)}).</li>)}
        {preview.addedGuardians.map((g, i) => <li key={"g" + i}>Novo responsável: <strong>{g.fullName}</strong> · {g.attending ? "acompanhará o encontro" : "sem vaga de acompanhante"}{g.phone ? " · celular " + formatPhone(g.phone) : ""}.</li>)}
        {!preview.addedGuardians.length && <li>Nenhum responsável novo (os mesmos já estão nesta inscrição).</li>}
      </ul>
      <p>Resultado: <strong>{preview.result.children} {preview.result.children === 1 ? "criança" : "crianças"}</strong>, responsáveis <strong>{preview.result.guardians.join(" e ")}</strong>, <strong>{preview.result.people} pessoas</strong> no encontro. O WhatsApp de contato continua o desta inscrição.</p>
      <p className="settings-help">Faça a junção só se tiver certeza de que é a mesma família. A ação não pode ser desfeita pela tela; um backup diário é mantido no servidor.</p>
      <div className="delete-actions"><button className="button danger-button" disabled={busy} onClick={() => void call(true)}>{busy ? <LoaderCircle size={16} className="spin" /> : <GitMerge size={16} />}Confirmar e juntar</button><button className="button secondary" disabled={busy} onClick={() => { setPreview(null); setError(""); }}>Voltar</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
