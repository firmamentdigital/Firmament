"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, LoaderCircle, MapPin, MessageCircle, Share2 } from "lucide-react";
import { confirmationCardImage, receptionUrl, responsibleSummary, type ConfirmationCardData } from "@/lib/confirmation-card";
import { normalizePhone } from "@/lib/event";
import type { EventBrand } from "@/lib/brand-types";
import type { RegistrationReceipt } from "@/lib/types";
import BrandDisplay from "./brand-display";

export default function ConfirmationCard({ receipt, details, brands, onReset }: { receipt: RegistrationReceipt; details: ConfirmationCardData; brands: EventBrand[]; onReset: () => void }) {
  const [qrImage, setQrImage] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(""); const [hint, setHint] = useState(""); const [sharing, setSharing] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const total = details.children.length + details.guardians.length;
  const responsibleName = details.responsibleName || details.guardians.join(" e ");
  const attending = details.responsibleAttending !== false && details.guardians.length > 0;
  const summary = responsibleSummary(details);
  const shareText = `Minha inscrição no Silas 10 está confirmada!\nComo realizar seu sonho · Da origem ao sucesso\n\nCrianças e jovens:\n${details.children.map(n => "• " + n).join("\n")}\n${summary.plural ? "Responsáveis" : "Responsável"}: ${responsibleName}${summary.plural ? "\n" + summary.note : attending ? " (acompanhará)" : " (contato da família)"}\n\n21/11 · das 9h às 11h\nAuditório do Conselho Deliberativo do SPFC\nPortão 17 · Rua Laudo Natel\nCódigo: ${receipt.code}\n\nApresente o cartão ou este código na recepção.`;
  const whatsapp = "https://wa.me/" + (details.phone ? "55" + normalizePhone(details.phone) : "") + "?text=" + encodeURIComponent(shareText);
  useEffect(() => {
    title.current?.focus({ preventScroll: true }); document.getElementById("inscricao")?.scrollIntoView({ block: "start" }); let active = true;
    import("qrcode").then(m => m.toDataURL(receptionUrl(window.location.origin, receipt.code), { width: 360, margin: 4, errorCorrectionLevel: "M", color: { dark: "#1a1a1eff", light: "#ffffffff" } }))
      .then(image => { if (active) setQrImage(image); }).catch(() => { if (active) setError("A inscrição está confirmada. Guarde o código caso o QR Code não apareça."); });
    return () => { active = false; };
  }, [receipt.code]);
  useEffect(() => {
    if (!qrImage) return; let active = true;
    confirmationCardImage(details, qrImage, brands).then(blob => { if (active) setFile(new File([blob], "Silas_10_" + receipt.code + ".png", { type: "image/png" })); })
      .catch(() => { if (active) setError("Não foi possível preparar a imagem agora. Tire um print ou recarregue a página para tentar novamente."); });
    return () => { active = false; };
  }, [qrImage, details, brands, receipt.code]);
  function saveCard() {
    if (!file) return; const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); setHint("Cartão baixado. Você pode enviá-lo como imagem pelo WhatsApp.");
  }
  async function shareCard() {
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      setSharing(true); setError("");
      try { await navigator.share({ files: [file], title: "Meu cartão · Silas 10" }); setHint("Você pode guardar o cartão na sua conversa do WhatsApp."); }
      catch (failure) { if (!(failure instanceof Error) || failure.name !== "AbortError") setHint("Baixe o cartão e envie a imagem pelo WhatsApp."); }
      finally { setSharing(false); }
    } else { window.open(whatsapp, "_blank", "noopener,noreferrer"); setHint("Envie os dados para seu WhatsApp. Para enviar a imagem também, baixe o cartão e anexe na conversa."); }
  }
  return <div className="registration-panel success-panel mobile-success">
    <div className="confirmation-intro"><span className="confirmation-check"><Check size={22} /></span><div><h2 ref={title} tabIndex={-1}>Sua família está confirmada!</h2><p>Guarde este cartão. Ele reúne os participantes deste envio.</p></div></div>
    <div className="ticket-actions"><button className="button primary" onClick={saveCard} disabled={!file}>{file ? <Download size={18} /> : <LoaderCircle size={18} className="spin" />}{file ? "Baixar cartão" : "Preparando cartão…"}</button><button className="button whatsapp-card-button" onClick={() => void shareCard()} disabled={!file || sharing}><MessageCircle size={18} />Enviar ao meu WhatsApp</button></div>
    <p className="card-save-hint">Baixe, tire um print ou compartilhe a imagem pelo WhatsApp.</p>
    {hint && <p className="card-action-hint" role="status"><Share2 size={16} />{hint}</p>}{error && <p className="card-error" role="alert">{error}</p>}
    <article className="family-ticket clear-family-ticket" aria-label="Cartão de confirmação da inscrição">
      <div className="ticket-heading"><span>CARTÃO DA FAMÍLIA</span><b><Check size={13} />Confirmada</b></div>
      <h3>Como realizar seu sonho<span>Da origem ao sucesso</span></h3>
      <div className="ticket-event"><strong>21</strong><div><b>DE NOVEMBRO</b><span>Sábado · das 9h às 11h</span></div><span className="ticket-total"><b>{total}</b>{total === 1 ? "pessoa" : "pessoas"}</span></div>
      <div className="ticket-people"><section><h4>Crianças e jovens <span>{details.children.length}</span></h4><ol>{details.children.map((name, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><strong>{name}</strong></li>)}</ol></section><section className="ticket-responsible"><h4>{summary.label}</h4><strong>{responsibleName}</strong><p>{summary.note}</p></section>{receipt.totalPeople !== total && <p className="ticket-existing">Este código reúne {receipt.totalPeople} pessoas reservadas para a família. Os nomes acima correspondem a este envio.</p>}</div>
      <div className="ticket-entry"><div className="ticket-qr">{qrImage ? <img src={qrImage} alt={"QR Code da inscrição " + receipt.code} width="132" height="132" /> : <div className="qr-placeholder"><LoaderCircle size={24} className="spin" /></div>}</div><div className="ticket-code"><span>CÓDIGO DA FAMÍLIA</span><strong>{receipt.code}</strong><p>Apresente o QR Code ou o código na recepção.</p></div></div>
      <div className="ticket-place"><MapPin size={18} /><div><strong>Auditório do Conselho Deliberativo do SPFC</strong><span>Entrada pelo Portão 17 · Rua Laudo Natel</span></div></div>
      <BrandDisplay brands={brands} compact />
    </article>
    <button className="text-button reset-registration" onClick={onReset}>Inscrever outra família <ArrowRight size={16} /></button>
  </div>;
}
