"use client";
import { useState } from "react";
import { ArrowUpRight, Clock3, MapPin, MessageCircle } from "lucide-react";
import BrandDisplay from "./brand-display";
import type { EventBrand } from "@/lib/brand-types";
import RegistrationForm from "./registration-form";
import { MARIO_WHATSAPP } from "@/lib/event";

export default function RegistrationExperience({ brands }: { brands: EventBrand[] }) {
  const [confirmed, setConfirmed] = useState(false);

  return <div className="mobile-experience">
    <header className="site-header">
      <a className="brand-link" href="/" aria-label="Silas 10, início"><img src="/assets/silas-signature.png" alt="Silas 10" width="136" height="87" /></a>
      <span className="header-event">21 de novembro · das 9h às 11h</span>
      {!confirmed && <a className="header-enroll" href="#inscricao">Fazer inscrição <ArrowUpRight size={15} /></a>}
      {confirmed && <span className="header-confirmed">Inscrição confirmada</span>}
    </header>

    <main className={"registration-shell" + (confirmed ? " confirmation-shell" : "")}>
      {!confirmed && <aside className="story-column">
        <div className="story-poster">
          <img className="trajectory" src="/assets/trajectory-cutout.png" alt="A trajetória de Silas, do garoto com a bola ao São Paulo FC e à Seleção Brasileira." fetchPriority="high" width="1254" height="1254" />
          <div className="story-art">
            <div className="story-title">
              <h1>Como realizar<br /><em>seu sonho</em></h1>
              <p>Da origem ao sucesso</p>
            </div>
          </div>
          <div className="event-details">
            <div className="event-date"><strong>21</strong><div><span>SÁBADO</span><b>DE NOVEMBRO</b><small><Clock3 size={13} />Das 9h às 11h</small></div></div>
            <div className="event-place"><MapPin size={18} /><div><strong>Auditório do Conselho<br />Deliberativo do SPFC</strong><span>Portão 17 · Rua Laudo Natel</span></div></div>
          </div>
        </div>
        <div className="audience-line"><strong className="audience-age">8 a 16 anos</strong><div><b>Para crianças e jovens.</b><span>Pais e responsáveis são bem-vindos.</span></div></div>
      </aside>}

      <section className="registration-column" id="inscricao" aria-label="Formulário de inscrição">
        <RegistrationForm brands={brands} onConfirmationChange={setConfirmed} />
      </section>
    </main>

    <div className="registration-help">
      <MessageCircle size={21} /><div><strong>Dúvidas ou casos especiais?</strong><span>Fale com Mario Ferrari · (11) 94724-8000</span></div>
      <a href={MARIO_WHATSAPP} target="_blank" rel="noreferrer">Falar pelo WhatsApp <ArrowUpRight size={16} /></a>
    </div>
    <footer className="site-footer event-support-footer">
      <div className="footer-support">
        {!confirmed && <BrandDisplay brands={brands} />}
        <span>Um encontro para aprender,<br /><strong>sonhar e dar o próximo passo.</strong></span>
      </div>
      <a className="admin-entry-link" href="/gestao" target="_blank" rel="noopener noreferrer" title="Acesso administrativo" aria-label="ADM (abre em uma nova aba)">ADM</a>
    </footer>
  </div>;
}
