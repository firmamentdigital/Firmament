"use client";
import { useMemo, useState } from "react";
import { Check, ChevronRight, Copy, LoaderCircle, MessageCircle, Play, Share2, SkipForward, X } from "lucide-react";
import { formatPhone } from "@/lib/event";
import { contactText, whatsappUrl, type MessageContact, type MessageDetail } from "@/lib/message-types";

// Envio guiado: mostra um contato pendente por vez, com a mensagem personalizada.
// O envio continua sendo feito por você no WhatsApp; aqui só se abre a conversa
// certa e, depois, marca-se o contato e passa para o próximo.
export default function GuidedSend({ detail, busy, hasImage, canShare, onMark, onShare, onCopy }: {
  detail: MessageDetail; busy: string; hasImage: boolean; canShare: boolean;
  onMark: (contact: MessageContact) => Promise<void>;
  onShare: (contact: MessageContact) => Promise<void>;
  onCopy: (text: string) => Promise<void>;
}) {
  const [active, setActive] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [opened, setOpened] = useState("");
  const pending = useMemo(() => detail.contacts.filter(c => !c.confirmedAt), [detail.contacts]);
  // Quem foi pulado vai para o fim da fila (e volta a aparecer depois dos demais).
  const queue = useMemo(() => [...pending.filter(c => !skipped.includes(c.phone)), ...skipped.map(p => pending.find(c => c.phone === p)).filter((c): c is MessageContact => Boolean(c))], [pending, skipped]);
  const current = queue[0];
  const done = detail.total - pending.length;

  if (!active) {
    return <div className="guided-send guided-start">
      <div><strong>Envio guiado</strong><p>{pending.length ? `${pending.length} ${pending.length === 1 ? "contato pendente" : "contatos pendentes"}. Um por vez: abra a conversa, envie e passe para o próximo.` : "Todos os contatos deste aviso já foram marcados como avisados."}</p></div>
      {pending.length > 0 && <button className="button primary" onClick={() => { setActive(true); setSkipped([]); setOpened(""); }}><Play size={17} />Começar envio guiado</button>}
    </div>;
  }

  if (!current) {
    return <div className="guided-send guided-finished" role="status">
      <Check size={22} /><div><strong>Pronto! Todos os contatos foram avisados.</strong><p>{detail.total} de {detail.total} marcados neste aviso.</p></div>
      <button className="button secondary" onClick={() => setActive(false)}>Fechar</button>
    </div>;
  }

  const text = contactText(detail.body, current);
  const wasOpened = opened === current.phone;
  const marking = busy === current.phone;
  const position = done + 1;
  return <div className="guided-send" aria-live="polite">
    <div className="guided-top">
      <span className="eyebrow">ENVIO GUIADO · {position} DE {detail.total}</span>
      <button className="icon-button" onClick={() => setActive(false)} aria-label="Encerrar envio guiado"><X size={18} /></button>
    </div>
    <div className="guided-progress" aria-hidden="true"><span style={{ width: Math.round(done / Math.max(1, detail.total) * 100) + "%" }} /></div>
    <div className="guided-contact">
      <strong>{current.responsibleNames.join(" e ")}</strong>
      <span>{formatPhone(current.phone)}</span>
      <small>{current.childNames.join(", ")}</small>
      {skipped.includes(current.phone) && <em>Você pulou este contato antes.</em>}
    </div>
    <p className="guided-text">{text || "Aviso com imagem."}</p>
    <ol className="guided-steps">
      <li className={wasOpened ? "done" : ""}>
        <a className="button primary" href={whatsappUrl(current.phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(current.phone)}><MessageCircle size={17} />{wasOpened ? "Abrir de novo" : "Abrir conversa no WhatsApp"}</a>
        {hasImage && <button className="button secondary" disabled={!canShare} onClick={() => { setOpened(current.phone); void onShare(current); }}><Share2 size={16} />Compartilhar imagem + texto</button>}
      </li>
      <li>
        <button className={"button " + (wasOpened ? "primary" : "secondary")} disabled={marking} onClick={async () => { await onMark(current); setOpened(""); setSkipped(list => list.filter(p => p !== current.phone)); }}>{marking ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}Enviei · próximo<ChevronRight size={16} /></button>
        <button className="text-button" disabled={marking} onClick={() => { setSkipped(list => [...list.filter(p => p !== current.phone), current.phone]); setOpened(""); }}><SkipForward size={15} />Pular por agora</button>
        <button className="text-button" onClick={() => void onCopy(text)}><Copy size={15} />Copiar texto</button>
      </li>
    </ol>
    <p className="guided-hint">{wasOpened ? "Confira se a mensagem foi enviada no WhatsApp e clique em \"Enviei · próximo\"." : "Abra a conversa: a mensagem já vai preenchida. Envie no WhatsApp e volte aqui."}</p>
  </div>;
}
