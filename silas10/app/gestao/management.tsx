"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, CircleAlert, Copy, DoorOpen, Download, Eye, LoaderCircle, MessageSquareText, MessageCircle, QrCode, Phone, RefreshCw, Search, UsersRound, X, ShieldCheck, Settings2, Save, Trash2, Gift } from "lucide-react";
import { formatBirthDate, formatPhone, normalizeName, maskMobilePhone } from "@/lib/event";
import type { EventSnapshot, FamilyDetail, Participant } from "@/lib/types";
import { affiliationLabel } from "@/lib/affiliation";
import QrReception from "./qr-reception";
import MessageCenter from "./message-center";
import EventSettings from "./event-settings";
import { ParticipantTable, FamilyTable } from "./registration-tables";
import FamilyMergePanel from "./family-merge-panel";
import Raffle from "./raffle";

function clock(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

function FamilyDialog({ family, onClose, refresh, isOwner }: { family: FamilyDetail; onClose: () => void; refresh: () => Promise<void>; isOwner: boolean }) {
  const [phone, setPhone] = useState(family.phone);
  const [status, setStatus] = useState(family.status);
  const [guardianPhones, setGuardianPhones] = useState<Record<string, string>>(() => Object.fromEntries(family.guardians.filter(g => !g.primary).map(g => [g.id, g.phone ? formatPhone(g.phone) : ""])));
  const [version] = useState(family.version);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(remove = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/families/" + family.id, { method: remove ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(remove ? { confirmation: code, version } : { phone, status, guardianPhones, version }) });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      await refresh(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog ref={dialog} className="family-dialog" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="dialog-header"><div><span className="eyebrow">INSCRIÇÃO DA FAMÍLIA</span><h2>{family.code}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar detalhes"><X size={21} /></button></div>
    <div className="dialog-body"><span className={"family-status " + family.status}>{family.status === "cancelled" ? "Inscrição cancelada" : "Inscrição ativa"}</span>
      <div className="family-contact"><span>Contato principal</span><strong>{family.primaryGuardianName}</strong><a href={"tel:+55" + family.phone}><Phone size={16} />{formatPhone(family.phone)}</a></div>
      <section><h3>Crianças e jovens <span>{family.children.length}</span></h3>{family.children.map(child => <div className="detail-person" key={child.id}><span className={"status-dot" + (child.checkedInAt ? " present" : "")} /><div><strong>{child.fullName}</strong><small>{formatBirthDate(child.birthDate)} · {child.age} anos no encontro</small><small className="child-affiliation">{affiliationLabel(child.affiliation, child.affiliationOther)}</small><p>Responsáveis · {child.guardianNames.join(" e ")}</p></div><span className={"status-label" + (child.checkedInAt ? " present" : "")}>{child.checkedInAt ? "Presente" : "Aguardando"}</span></div>)}</section>
      <section><h3>Responsáveis <span>{family.guardians.length}</span></h3>{family.guardians.map(person => <div className="detail-person" key={person.id}><span className={"status-dot" + (person.checkedInAt ? " present" : "")} /><div><strong>{person.fullName}</strong><small>{formatBirthDate(person.birthDate)} · {person.age} anos</small><p>{person.attending ? "Acompanhará o encontro" : person.primary ? "Contato da família · não reservou vaga de acompanhante" : "Não reservou vaga de acompanhante"}</p>{person.phone ? <a className="guardian-phone-link" href={"tel:+55" + person.phone}><Phone size={14} />{formatPhone(person.phone)}</a> : <small className="phone-missing">Sem celular cadastrado</small>}</div>{person.attending && <span className={"status-label" + (person.checkedInAt ? " present" : "")}>{person.checkedInAt ? "Presente" : "Aguardando"}</span>}</div>)}</section>
      {family.questions.length > 0 && <section><h3><MessageSquareText size={18} />Dúvidas e dificuldades</h3>{family.questions.map((item, index) => <div className="question-note" key={index}><p>{item.text}</p><small>{new Date(item.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small></div>)}</section>}
      {isOwner ? <form className="family-edit-form" onSubmit={e => { e.preventDefault(); void save(); }}><h3>Editar inscrição</h3><div className="settings-form-grid"><label className="field"><span>Situação da inscrição</span><select value={status} onChange={e => setStatus(e.target.value as FamilyDetail["status"])}><option value="active">Ativa · vagas reservadas</option><option value="cancelled">Cancelada · fora da lista de presença</option></select></label><label className="field"><span>Celular do responsável principal</span><input type="tel" inputMode="tel" value={formatPhone(phone)} onChange={e => setPhone(maskMobilePhone(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} required /></label>{family.guardians.filter(g => !g.primary).map(g => <label className="field" key={g.id}><span>Celular de {g.fullName}</span><input type="tel" inputMode="tel" value={guardianPhones[g.id] || ""} onChange={e => { const value = maskMobilePhone(e.target.value); setGuardianPhones(current => ({ ...current, [g.id]: value })); }} placeholder="(11) 99999-9999" maxLength={15} /></label>)}</div><p className="settings-help">O cancelamento preserva o histórico e permite reativar a inscrição depois. Famílias canceladas ficam fora da recepção, dos avisos e da contagem de vagas.</p><button type="submit" className="button primary" disabled={busy}><Save size={16} />Salvar alterações</button></form> : <p className="settings-help team-readonly-note">Acesso de equipe: consulta e confirmação de presença. Para alterar ou cancelar esta inscrição, fale com a organização.</p>}
      {isOwner && <FamilyMergePanel keepId={family.id} keepCode={family.code} onMerged={async () => { await refresh(); onClose(); }} />}
      {isOwner && <div className="family-delete-zone">{!confirmDelete ? <button className="text-button danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Excluir esta inscrição definitivamente</button> : <div><h3>Excluir esta família?</h3><p>Serão removidos esta inscrição, {family.children.length} {family.children.length === 1 ? "criança ou jovem" : "crianças e jovens"} e seus vínculos. Responsáveis usados por outras inscrições serão preservados. Esta ação não pode ser desfeita.</p><label className="field"><span>Digite {family.code} para confirmar</span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoComplete="off" placeholder={family.code} /></label><div className="delete-actions"><button className="button danger-button" disabled={busy || code !== family.code} onClick={() => void save(true)}><Trash2 size={16} />Excluir definitivamente</button><button className="button secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Manter inscrição</button></div></div>}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="quiet-copy">Inscrição recebida em {new Date(family.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
    </div>
  </dialog>;
}

export default function Management({ userName, signOutPath, initialCode = "", isOwner, userEmail, isGuest = false, sessionLogoutPath = "" }: { userName: string; signOutPath: string; initialCode?: string; isOwner: boolean; userEmail: string; isGuest?: boolean; sessionLogoutPath?: string }) {
  const [data, setData] = useState<EventSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState(initialCode);
  const [kind, setKind] = useState("child");
  const [presence, setPresence] = useState("all");
  const [affiliation, setAffiliation] = useState("all");
  const [familyStatus, setFamilyStatus] = useState("all");
  const [tab, setTab] = useState<"people" | "families">("people");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [operation, setOperation] = useState<"list" | "reception" | "messages" | "settings" | "raffle">(initialCode ? "reception" : "list");
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/snapshot", { cache: "no-store" });
      const result = await response.json() as EventSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar a lista.");
      if (current === sequence.current) { setData(result); setError(""); }
    } catch (failure) {
      if (current === sequence.current) setError(failure instanceof Error ? failure.message : "Não foi possível carregar a lista.");
    } finally {
      if (current === sequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    return () => { clearInterval(timer); sequence.current++; };
  }, [refresh]);
  useEffect(() => { setPage(0); }, [query, kind, presence, affiliation, tab, familyStatus]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const needle = normalizeName(query);
    return (data?.participants || []).filter(person =>
      (kind === "all" || person.kind === kind) &&
      (affiliation === "all" || (person.kind === "child" && (affiliation === "unknown" ? !person.affiliation : person.affiliation === affiliation))) &&
      (presence === "all" || Boolean(person.checkedInAt) === (presence === "present")) &&
      (!needle || normalizeName([person.fullName, person.phone, ...person.familyCodes, ...person.linkedNames].join(" ")).includes(needle))
    );
  }, [data, query, kind, presence, affiliation]);
  const filteredFamilies = useMemo(() => {
    const needle = normalizeName(query);
    return (data?.families || []).filter(family => (familyStatus === "all" || family.status === familyStatus) && (!needle || normalizeName([
      family.code, family.phone, family.primaryGuardianName,
      ...family.children.map(person => person.fullName),
      ...family.guardians.map(person => person.fullName),
      ...family.questions.map(item => item.text),
    ].join(" ")).includes(needle)));
  }, [data, query, familyStatus]);
  const visible = filtered.slice(page * 25, (page + 1) * 25);
  const visibleFamilies = filteredFamilies.slice(page * 25, (page + 1) * 25);
  const pageCount = Math.max(1, Math.ceil((tab === "people" ? filtered.length / 25 : filteredFamilies.length / 25)));
  const selectedFamily = data?.families.find(family => family.id === familyId);
  const stats = data?.stats;
  useEffect(() => { setPage(current => Math.min(current, pageCount - 1)); }, [pageCount]);

  async function markPresence(person: Participant) {
    setBusyId(person.id);
    setError("");
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: person.id, kind: person.kind, present: !person.checkedInAt, version: person.version }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(result.error || "Não foi possível atualizar a presença.");
      }
      await refresh();
      setNotice(person.checkedInAt ? "Presença desfeita." : "Presença registrada.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível atualizar a presença."); }
    finally { setBusyId(""); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/");
      setNotice("Link de inscrição copiado.");
    } catch { setError("Copie o endereço da página de inscrição pela barra do navegador."); }
  }

  async function signOutPasswordSession() {
    try { const response = await fetch(sessionLogoutPath, { method: "POST", credentials: "same-origin" }); if (!response.ok) throw new Error(); window.location.replace(isGuest ? "/gestao/convidado" : "/gestao"); }
    catch { setError("Não foi possível sair agora. Tente novamente."); }
  }

  function selectOperation(next: "list" | "reception" | "messages" | "settings" | "raffle") {
    setOperation(next);
    requestAnimationFrame(() => document.getElementById("management-operations")?.scrollIntoView({ block: "start" }));
  }

  return <>
    <header className="management-header"><a className="brand-link" href="/"><img src="/assets/silas-signature.png" alt="Silas 10" width="136" height="87" /></a><span className="management-header-label">GESTÃO DO ENCONTRO</span><div><span className="user-label">{userName}</span>{sessionLogoutPath ? <button className="icon-button" aria-label="Sair da gestão" onClick={() => void signOutPasswordSession()}><DoorOpen size={19} /></button> : <a href={signOutPath} target="_top" className="icon-button" aria-label="Sair da gestão"><DoorOpen size={19} /></a>}</div></header>
    <main className="management-main">
      <div className="management-title"><div><span className="eyebrow">21 DE NOVEMBRO · 9H ÀS 11H</span><h1>Inscrições do encontro</h1><p>Consulte os nomes, confirme presenças e acompanhe cada família.</p></div><div className="management-actions"><button className="button secondary" onClick={copyLink}><Copy size={16} />Copiar link</button><a className="button secondary" href="/api/admin/export" title="Todos os participantes, para Excel."><ArrowDownToLine size={17} />Excel (.xlsx)</a><a className="button primary" href="/api/admin/export/pdf"><Download size={17} />Lista em PDF</a></div></div>
      <div className="owner-access-note"><ShieldCheck size={15}/><span>{isOwner ? "Seu acesso: proprietário. Para convidar alguém, abra Configurações → Acessos à gestão." : "Acesso de equipe · lista de inscritos, presença e exportações. Avisos e configurações ficam com a organização."}</span></div>
      <section className={"stats-grid"+(operation!=="list"?" compact-stats":"")} aria-label="Resumo das inscrições">
        <div className="stat-card"><span>Pessoas esperadas</span><strong>{stats?.expected ?? "—"}</strong><small>{stats?.families ?? 0} {stats?.families===1?"família ativa":"famílias ativas"}{stats?.cancelledFamilies ? " · " + stats.cancelledFamilies + " canceladas" : ""}</small></div>
        <div className="stat-card"><span>Crianças e jovens</span><strong>{stats?.children ?? "—"}</strong><small>Uma inscrição por criança</small></div>
        <div className="stat-card"><span>Responsáveis acompanhantes</span><strong>{stats?.guardians ?? "—"}</strong><small>Cada pessoa contada uma vez</small></div>
        <div className="stat-card highlight"><span>Presenças confirmadas</span><strong>{stats?.present ?? "—"}<em> / {stats?.expected ?? 0}</em></strong><div className="attendance-meter"><span style={{ width: stats?.expected ? Math.round(stats.present / stats.expected * 100) + "%" : "0%" }} /></div></div>
      </section>
      {error && <div className="form-error management-error" role="alert"><CircleAlert size={19} /><span>{error}</span><button className="text-button" onClick={() => void refresh()}>Tentar novamente</button></div>}
      <nav id="management-operations" className={"operations-nav"+(isOwner?"":" team-nav")} aria-label="Ações da gestão"><button className={operation==="list"?"active":""} aria-current={operation==="list"?"page":undefined} onClick={()=>selectOperation("list")}><UsersRound size={19}/><span>Inscrições</span></button><button className={operation==="reception"?"active":""} aria-current={operation==="reception"?"page":undefined} onClick={()=>selectOperation("reception")}><QrCode size={19}/><span>Presença / QR Code</span></button><button className={operation==="raffle"?"active":""} aria-current={operation==="raffle"?"page":undefined} onClick={()=>selectOperation("raffle")}><Gift size={19}/><span>Sorteio</span></button>{isOwner&&<><button className={operation==="messages"?"active":""} aria-current={operation==="messages"?"page":undefined} onClick={()=>selectOperation("messages")}><MessageCircle size={19}/><span>WhatsApp</span></button><button className={operation==="settings"?"active":""} aria-current={operation==="settings"?"page":undefined} onClick={()=>selectOperation("settings")}><Settings2 size={19}/><span>Configurações</span></button></>}</nav>
      {isOwner&&operation==="settings"&&<EventSettings isOwner={isOwner} ownerEmail={userEmail}/>}
      {operation==="reception"&&data&&<QrReception data={data} initialCode={initialCode} refresh={refresh}/>}
      {operation==="raffle"&&data&&<Raffle data={data}/>}
      {isOwner&&operation==="messages"&&data&&<MessageCenter contactCount={new Set(data.families.filter(f=>f.status==="active").flatMap(f=>[f.phone,...f.guardians.filter(g=>!g.primary&&g.phone).map(g=>g.phone as string)])).size}/>}
      {operation!=="list"&&operation!=="settings"&&!data&&<div className="empty-state"><LoaderCircle className="spin" size={28}/><p>Carregando os dados da gestão…</p></div>}
      {operation==="list"&&<section className="management-list">
        <div className="list-topline"><nav className="management-tabs" aria-label="Visualização"><button className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}>Participantes <span>{data?.participants.length ?? 0}</span></button><button className={tab === "families" ? "active" : ""} onClick={() => setTab("families")}>Por família <span>{data?.families.length ?? 0}</span>{stats?.questions ? <span className="attention-count" title={stats.questions + (stats.questions === 1 ? " família escreveu uma dúvida ou dificuldade na inscrição" : " famílias escreveram dúvidas ou dificuldades na inscrição")} aria-label={stats.questions + (stats.questions === 1 ? " família com dúvida ou dificuldade" : " famílias com dúvidas ou dificuldades")}>{stats.questions} {stats.questions === 1 ? "com dúvida" : "com dúvidas"}</span> : null}</button></nav><button className="refresh-button" onClick={() => void refresh()} disabled={refreshing} aria-label="Atualizar lista"><RefreshCw size={16} className={refreshing ? "spin" : ""} />{refreshing ? "Atualizando" : "Atualizar"}</button></div>
        <div className="list-toolbar">
          <label className="search-field"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === "people" ? "Buscar nome, responsável, celular ou código" : "Buscar família, criança ou observação"} aria-label="Buscar inscrições" />{query && <button className="icon-button" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={15} /></button>}</label>
          {tab === "people" ? <div className="list-filters">
            <label><span>Quem visualizar</span><select value={kind} onChange={e => { setKind(e.target.value); if (e.target.value === "guardian") setAffiliation("all"); }}><option value="child">Crianças e jovens</option><option value="guardian">Responsáveis acompanhantes</option><option value="all">Todos os participantes</option></select></label>
            <label><span>Presença</span><select value={presence} onChange={e => setPresence(e.target.value)}><option value="all">Todas</option><option value="pending">Aguardando entrada</option><option value="present">Presentes</option></select></label>
            <label><span>Vínculo da criança</span><select disabled={kind === "guardian"} value={affiliation} onChange={e => setAffiliation(e.target.value)}><option value="all">Todos os vínculos</option><option value="cod">Sócio COD</option><option value="athletics">Escola de Atletismo</option><option value="other">Outro</option><option value="unknown">Não informado anteriormente</option></select></label>
          </div> : <label className="family-status-filter"><span>Situação da inscrição</span><select value={familyStatus} onChange={e => setFamilyStatus(e.target.value)}><option value="all">Ativas e canceladas</option><option value="active">Somente ativas</option><option value="cancelled">Somente canceladas</option></select></label>}
        </div>
        <div className="list-description"><h2>{tab === "families" ? "Inscrições por família" : kind === "child" ? "Crianças e jovens inscritos" : kind === "guardian" ? "Responsáveis acompanhantes" : "Todos os participantes"}</h2><p>{tab === "families" ? (isOwner ? "Abra Ver / editar para alterar contato, cancelar ou reativar." : "Abra Ver detalhes para consultar a família.") : (isOwner ? "Use Confirmar presença para registrar a entrada ou Ver / editar para os detalhes." : "Use Confirmar presença para registrar a entrada ou Ver detalhes para consultar a família.")}</p></div>
        {loading ? <div className="empty-state"><LoaderCircle className="spin" size={30} /><h2>Carregando as inscrições…</h2></div> : !data?.families.length ? <div className="empty-state"><span className="empty-icon"><UsersRound size={30} /></span><h2>As primeiras inscrições chegam por aqui.</h2><p>Compartilhe o link do formulário com as famílias.<br />Os nomes aparecerão nesta lista assim que a inscrição for concluída.</p><button className="button secondary" onClick={copyLink}><Copy size={16} />Copiar link de inscrição</button></div> : tab === "people" ? <>
          {filtered.length ? <ParticipantTable people={visible} canEdit={isOwner} busyId={busyId} onPresence={person => void markPresence(person)} onOpenFamily={setFamilyId} /> : <div className="empty-state small"><Search size={25} /><h2>Nenhum participante encontrado.</h2><p>Experimente outro nome ou ajuste os filtros.</p></div>}
        </> : filteredFamilies.length ? <FamilyTable families={visibleFamilies} onOpenFamily={setFamilyId} canEdit={isOwner} /> : <div className="empty-state small"><Search size={25} /><h2>Nenhuma família encontrada.</h2><p>Experimente outro nome ou uma parte do celular.</p></div>}
        {!!data?.families.length && <div className="list-footer"><span>{tab === "people" ? filtered.length + " participantes" : filteredFamilies.length + " famílias"} · página {Math.min(page + 1, pageCount)} de {pageCount}</span><div><button className="icon-button" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0} aria-label="Página anterior"><ArrowLeft size={17} /></button><button className="icon-button" onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} disabled={page + 1 >= pageCount} aria-label="Próxima página"><ArrowRight size={17} /></button></div></div>}
      </section>}
      <div className="management-bottom"><span>{data ? "Atualizado às " + clock(data.updatedAt) + " · atualização automática a cada 30 segundos." : "Preparando a lista de participantes."}</span><a href="/" target="_blank" rel="noreferrer">Abrir formulário de inscrição<ArrowUpRight size={14} /></a></div>
    </main>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    {selectedFamily && <FamilyDialog key={selectedFamily.id} isOwner={isOwner} refresh={refresh} family={selectedFamily} onClose={() => setFamilyId(null)} />}
  </>;
}
