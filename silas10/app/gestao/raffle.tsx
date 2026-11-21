"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Expand, Gift, Minimize, RotateCcw, Sparkles, Trophy, Undo2, UsersRound } from "lucide-react";
import { affiliationLabel } from "@/lib/affiliation";
import type { EventSnapshot, Participant } from "@/lib/types";

type Winner = { id: string; fullName: string; detail: string; at: string };
const STORAGE_KEY = "silas10-sorteio-v1";

// Índice uniforme com crypto (sem viés de módulo).
function fairIndex(length: number) {
  const limit = Math.floor(0x1_0000_0000 / length) * length;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % length;
}

function detailOf(person: Participant) {
  if (person.kind === "guardian") return "Responsável";
  return [person.age + " anos", affiliationLabel(person.affiliation, person.affiliationOther)].filter(Boolean).join(" · ");
}

function readWinners(): Winner[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); const list = raw ? JSON.parse(raw) : []; return Array.isArray(list) ? list : []; }
  catch { return []; }
}

export default function Raffle({ data }: { data: EventSnapshot }) {
  const [includeGuardians, setIncludeGuardians] = useState(false);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [display, setDisplay] = useState<{ name: string; detail: string } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setWinners(readWinners()); }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(winners)); } catch { /* sem armazenamento: segue só nesta tela */ } }, [winners]);
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => { document.removeEventListener("fullscreenchange", onChange); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const present = useMemo(() => data.participants.filter(p => p.checkedInAt && (p.kind === "child" || includeGuardians)), [data, includeGuardians]);
  const presentGuardians = useMemo(() => data.participants.filter(p => p.checkedInAt && p.kind === "guardian").length, [data]);
  const pool = useMemo(() => { const won = new Set(winners.map(w => w.id)); return present.filter(p => !won.has(p.id)); }, [present, winners]);

  function draw() {
    if (spinning || !pool.length) return;
    const winner = pool[fairIndex(pool.length)];
    setSpinning(true); setRevealed(false);
    const steps = pool.length > 1 ? 34 : 1;
    let step = 0;
    const tick = () => {
      step++;
      if (step >= steps) {
        setDisplay({ name: winner.fullName, detail: detailOf(winner) });
        setWinners(current => [...current, { id: winner.id, fullName: winner.fullName, detail: detailOf(winner), at: new Date().toISOString() }]);
        setSpinning(false); setRevealed(true);
        return;
      }
      const shown = pool[Math.floor(Math.random() * pool.length)];
      setDisplay({ name: shown.fullName, detail: detailOf(shown) });
      // Começa rápido e desacelera até parar no ganhador (~4s).
      timer.current = setTimeout(tick, 45 + Math.pow(step / steps, 3) * 380);
    };
    tick();
  }

  function undoLast() {
    if (spinning || !winners.length) return;
    setWinners(current => current.slice(0, -1)); setDisplay(null); setRevealed(false);
  }
  function resetAll() {
    if (spinning || !winners.length) return;
    if (!window.confirm("Zerar o sorteio? Todos voltam a concorrer e a lista de sorteados é apagada.")) return;
    setWinners([]); setDisplay(null); setRevealed(false);
  }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen(); } catch { /* navegador sem tela cheia */ }
  }

  return <section ref={stage} className={"operation-panel raffle-panel" + (fullscreen ? " raffle-fullscreen" : "")}>
    <div className="operation-heading"><span className="operation-icon"><Gift size={25} /></span><div><h2>Sorteio entre os presentes</h2><p>Só entra quem teve a presença confirmada na recepção. Quem já foi sorteado não concorre de novo.</p></div><button className="button secondary" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={16} /> : <Expand size={16} />}{fullscreen ? "Sair da tela cheia" : "Tela cheia"}</button></div>

    <div className="raffle-meta">
      <span><UsersRound size={16} /><strong>{pool.length}</strong> {pool.length === 1 ? "pessoa concorrendo" : "pessoas concorrendo"}</span>
      <span><Trophy size={16} /><strong>{winners.length}</strong> {winners.length === 1 ? "sorteado" : "sorteados"}</span>
      {presentGuardians > 0 && <label className="raffle-toggle"><input type="checkbox" checked={includeGuardians} disabled={spinning} onChange={e => setIncludeGuardians(e.target.checked)} />Incluir responsáveis presentes ({presentGuardians})</label>}
    </div>

    <div className={"raffle-stage" + (spinning ? " spinning" : "") + (revealed ? " revealed" : "")} aria-live="polite">
      {display ? <>
        {revealed && <span className="raffle-badge"><Sparkles size={16} />{winners.length}º sorteado</span>}
        <strong className="raffle-name">{display.name}</strong>
        <small className="raffle-detail">{display.detail}</small>
      </> : <>
        <Gift size={44} className="raffle-idle-icon" />
        <strong className="raffle-name idle">{present.length ? "Pronto para sortear" : "Ninguém presente ainda"}</strong>
        <small className="raffle-detail">{present.length ? "Aperte Sortear quando todos estiverem prontos." : "Confirme as presenças na aba Presença / QR Code."}</small>
      </>}
    </div>

    <div className="raffle-actions">
      <button className="button primary raffle-draw" onClick={draw} disabled={spinning || !pool.length}><Sparkles size={19} />{spinning ? "Sorteando…" : !pool.length && present.length ? "Todos já foram sorteados" : winners.length ? "Sortear o próximo" : "Sortear"}</button>
    </div>

    {winners.length > 0 && <div className="raffle-winners">
      <div className="raffle-winners-head"><h3>Sorteados</h3><div><button className="text-button" onClick={undoLast} disabled={spinning}><Undo2 size={15} />Desfazer o último</button><button className="text-button danger" onClick={resetAll} disabled={spinning}><RotateCcw size={15} />Zerar</button></div></div>
      <ol>{winners.map((w, i) => <li key={w.id + w.at}><b>{i + 1}º</b><span><strong>{w.fullName}</strong><small>{w.detail} · {new Date(w.at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</small></span></li>)}</ol>
    </div>}
  </section>;
}
