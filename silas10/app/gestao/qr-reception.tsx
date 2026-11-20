"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, CircleAlert, ImageUp, LoaderCircle, QrCode, Search, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { formatPhone, normalizeName } from "@/lib/event";
import { affiliationLabel } from "@/lib/affiliation";
import { registrationCode } from "@/lib/reception";
import type { EventSnapshot, FamilyDetail } from "@/lib/types";

export default function QrReception({ data, initialCode, refresh }: { data: EventSnapshot; initialCode: string; refresh: () => Promise<void> }) {
  const [search, setSearch] = useState(initialCode);
  const [familyId, setFamilyId] = useState(() => data.families.find(f=>f.code===initialCode)?.id || "");
  const [selected, setSelected] = useState<string[]>(() => {
    const f=data.families.find(f=>f.code===initialCode);
    return f ? [...f.children,...f.guardians.filter(g=>g.attending)].filter(p=>!p.checkedInAt).map(p=>p.id) : [];
  });
  const [camera, setCamera] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const family = data.families.find(f=>f.id===familyId);
  const attendees = family ? [...family.children.map(p=>({...p,kind:"Criança / jovem"})),...family.guardians.filter(g=>g.attending).map(p=>({...p,kind:"Acompanhante",affiliation:null}))] : [];
  const pending = family?.status === "cancelled" ? [] : selected.filter(id=>attendees.some(p=>p.id===id && !p.checkedInAt));
  const matches = useMemo(()=> {
    const needle=normalizeName(search);
    return needle ? data.families.filter(f=>normalizeName([f.code,f.phone,f.primaryGuardianName,...f.children.map(c=>c.fullName)].join(" ")).includes(needle)).slice(0,10) : [];
  },[search,data]);

  function choose(f:FamilyDetail) {
    setFamilyId(f.id);setSearch(f.code);setError("");setNotice("");
    setSelected([...f.children,...f.guardians.filter(g=>g.attending)].filter(p=>!p.checkedInAt).map(p=>p.id));
  }
  function receive(value:string) {
    setCamera(false);controls.current?.stop();
    const code=registrationCode(value);
    if (!code) { setError("Este QR Code não é um cartão de inscrição do encontro."); return; }
    setSearch(code);
    const found=data.families.find(f=>f.code===code);
    if (found) choose(found);
    else { setFamilyId("");setError("Inscrição não encontrada nesta lista. Atualize a gestão ou busque pelo nome ou celular."); }
  }
  useEffect(()=> {
    if (!camera) return;
    let cancelled=false;
    setError("");
    void import("@zxing/browser").then(async({BrowserQRCodeReader})=> {
      if (cancelled || !video.current) return;
      const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:350});
      const scanner=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:"environment"}}},video.current,(result,_error,control)=>{
        if (result && !cancelled) { control.stop(); receive(result.getText()); }
      });
      if (cancelled) scanner.stop(); else controls.current=scanner;
    }).catch(()=>{ if(!cancelled){setCamera(false);setError("Não foi possível acessar a câmera. Permita o acesso no navegador ou use uma foto do cartão e a busca abaixo.");} });
    return ()=> {cancelled=true;controls.current?.stop();controls.current=null; const stream=video.current?.srcObject;if(stream instanceof MediaStream) stream.getTracks().forEach(t=>t.stop());};
  // A fresh camera session uses the latest snapshot; polling does not restart a running camera.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[camera]);

  async function readImage(file:File) {
    if(file.size>12*1024*1024){setError("Escolha uma imagem do cartão com até 12 MB.");return;}
    setCamera(false);setReading(true);setError("");const url=URL.createObjectURL(file);
    try { const {BrowserQRCodeReader}=await import("@zxing/browser");const result=await new BrowserQRCodeReader().decodeFromImageUrl(url); receive(result.getText()); }
    catch {setError("Não foi possível ler o QR Code nesta imagem. Use uma foto nítida ou digite o código do cartão.");}
    finally {URL.revokeObjectURL(url);setReading(false);if(fileInput.current)fileInput.current.value="";}
  }
  async function confirm() {
    if(!family||!pending.length)return;setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/admin/attendance/family",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({familyId:family.id,ids:pending})});
      const result=await response.json() as {updated:number;error?:string};
      if(!response.ok)throw new Error(result.error||"Não foi possível confirmar a presença.");
      await refresh();setSelected([]);setNotice(result.updated?`Presença confirmada de ${result.updated} ${result.updated===1?"pessoa":"pessoas"}. Boa chegada!`:"A presença dessas pessoas já estava confirmada.");
    } catch(failure){setError(failure instanceof Error?failure.message:"Tente novamente.");}finally{setBusy(false);}
  }
  return <section className="operation-panel reception-panel" aria-label="Recepção por QR Code">
    <div className="operation-heading"><span className="operation-icon"><QrCode size={25}/></span><div><h2>Receba cada família.</h2><p>Leia o cartão, confira quem chegou e confirme a presença.</p></div></div>
    <div className="scanner-actions"><button className="button primary" onClick={()=>setCamera(v=>!v)} disabled={reading}>{camera?<X size={18}/>:<Camera size={18}/>} {camera?"Fechar câmera":"Ler QR Code com a câmera"}</button><button className="button secondary" disabled={reading} onClick={()=>fileInput.current?.click()}>{reading?<LoaderCircle className="spin" size={18}/>:<ImageUp size={18}/>}Ler imagem do cartão</button><input ref={fileInput} className="sr-only" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)void readImage(f);}} aria-label="Selecionar imagem do cartão"/></div>
    {camera&&<div className="camera-view"><video ref={video} muted playsInline autoPlay/><p>Aponte para o QR Code. A presença só será registrada após sua confirmação.</p></div>}
    <label className="search-field reception-search"><Search size={18}/><input value={search} onChange={e=>{setSearch(e.target.value);setFamilyId("");setNotice("");setError("");}} onPaste={e=>{const code=registrationCode(e.clipboardData.getData("text"));if(code){e.preventDefault();receive(code);}}} placeholder="Ou busque pelo código, nome ou celular" aria-label="Buscar família para recepção"/></label>
    {error&&<div className="form-error" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
    {notice&&<div className="operation-success" role="status"><Check size={20}/>{notice}</div>}
    {!family&&matches.length>0&&<div className="reception-results">{matches.map(f=><button key={f.id} onClick={()=>choose(f)}><strong>{f.primaryGuardianName}</strong><span>{f.code} · {formatPhone(f.phone)}</span><small>{f.children.map(c=>c.fullName).join(", ")}</small></button>)}</div>}
    {!family&&search&&!matches.length&&!error&&<p className="quiet-copy">Nenhuma família encontrada. Confira o código ou tente parte do nome ou celular.</p>}
    {family&&<div className="arrival-family"><div className="arrival-heading"><div><span className="eyebrow">{family.code}</span><h3>{family.primaryGuardianName}</h3><p>{formatPhone(family.phone)}</p></div><button className="text-button" onClick={()=>{setFamilyId("");setSearch("");setNotice("");setSelected([]);}}>Próxima família</button></div><p className="arrival-guide">{family.status === "cancelled" ? "Inscrição cancelada. Reative na gestão de famílias antes de registrar presença." : "Deixe marcadas apenas as pessoas que chegaram agora."}</p>
      <div className="arrival-people">{attendees.map(person=><label key={person.id} className={"arrival-person"+(person.checkedInAt?" already-present":"")}><input type="checkbox" disabled={family.status === "cancelled"||!!person.checkedInAt||busy} checked={!!person.checkedInAt||selected.includes(person.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,person.id]:v.filter(id=>id!==person.id))}/><span><strong>{person.fullName}</strong><small>{person.kind} · {person.age} anos{person.affiliation ? " · " + affiliationLabel(person.affiliation, person.affiliationOther) : ""}</small></span>{person.checkedInAt&&<b><Check size={14}/>Já presente</b>}</label>)}</div>
      {family.questions.length>0&&<div className="arrival-notes"><strong>Atenção da organização</strong>{family.questions.map((q,i)=><p key={i}>{q.text}</p>)}</div>}
      <button className="button primary full" disabled={busy||!pending.length} onClick={()=>void confirm()}>{busy?<LoaderCircle size={19} className="spin"/>:<Check size={19}/>} {busy?"Confirmando…":pending.length?`Confirmar presença de ${pending.length} ${pending.length===1?"pessoa":"pessoas"}`:"Nenhuma presença pendente selecionada"}</button>
    </div>}
    {!family&&!search&&<p className="operation-tip">Sem o cartão? Busque pelo nome da criança, do responsável ou pelo celular cadastrado. O mesmo QR Code pode ser usado novamente quando os demais participantes chegarem.</p>}
  </section>;
}
