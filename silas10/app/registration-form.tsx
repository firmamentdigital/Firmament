"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, CircleCheck, LoaderCircle, Plus, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import ConfirmationCard from "./confirmation-card";
import { affiliationLabel, CHILD_AFFILIATIONS, type ChildAffiliation } from "@/lib/affiliation";
import { ageAtEvent, formatBirthDate, formatPhone, isBirthDate, MARIO_WHATSAPP, normalizeName, isMobilePhone, maskBirthDate, maskMobilePhone, parseBirthDate } from "@/lib/event";
import type { ChildInput, GuardianInput, RegistrationInput, RegistrationReceipt } from "@/lib/types";
import type { EventBrand } from "@/lib/brand-types";
import type { ConfirmationCardData } from "@/lib/confirmation-card";

type ChildDraft = Omit<ChildInput, "affiliation"> & { affiliation: ChildAffiliation | "" };
const primary = (): GuardianInput => ({ key: "primary", fullName: "", birthDate: "", attending: true });
const newChild = (): ChildDraft => ({ fullName: "", birthDate: "", affiliation: "", guardianKeys: ["primary"] });
const steps = ["Criança", "Responsável", "Confirmação"];
const receiptStorage = "silas10:family-card:v4";

function BirthField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const iso = parseBirthDate(value);
  const valid = isBirthDate(iso);
  const age = valid ? ageAtEvent(iso) : null;
  const invalid = value.length === 10 && !valid;
  return <div className="birth-row"><div className="field"><label htmlFor={id}>Data de nascimento <span>*</span></label><input id={id} type="text" inputMode="numeric" value={value} onChange={e => onChange(maskBirthDate(e.target.value))} onInput={e => onChange(maskBirthDate(e.currentTarget.value))} placeholder="DD/MM/AAAA" maxLength={10} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Digite dia, mês e ano: DD/MM/AAAA" required autoComplete={id === "primary-birth" ? "bday" : "off"} aria-invalid={invalid || undefined} aria-describedby={id + "-hint"} /><small id={id + "-hint"} className={invalid ? "field-invalid" : ""}>{invalid ? "Confira o dia, mês e ano informados." : "Digite dia, mês e ano. Ex.: 05/03/2014."}</small></div><div className={"age-display" + (age !== null ? " filled" : "")}><strong>{age ?? "—"}</strong><span>anos no<br />encontro</span></div></div>;
}

export default function RegistrationForm({ brands, onConfirmationChange }: { brands: EventBrand[]; onConfirmationChange: (confirmed: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [children, setChildren] = useState<ChildDraft[]>([newChild()]);
  const [guardian, setGuardian] = useState<GuardianInput>(primary());
  const [phone, setPhone] = useState("");
  const [question, setQuestion] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const [cardDetails, setCardDetails] = useState<ConfirmationCardData | null>(null);
  const request = useRef<{ id: string; fingerprint: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const accompanying = guardian.attending ? 1 : 0;
  const peopleCount = children.length + accompanying;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(receiptStorage);
      if (!raw || raw.length > 10_000) return;
      const saved = JSON.parse(raw);
      const names = (value: unknown) => Array.isArray(value) && value.length <= 10 && value.every(name => typeof name === "string" && name.length > 0 && name.length <= 120);
      if (!Number.isFinite(saved.at) || Date.now() - saved.at >= 86_400_000 || Date.now() < saved.at || !/^S10-[A-F0-9]{10}$/.test(saved.receipt?.code || "") ||
        ![saved.receipt.children, saved.receipt.accompanyingGuardians, saved.receipt.totalPeople].every(n => Number.isInteger(n) && n >= 0) ||
        typeof saved.details?.responsibleName !== "string" || saved.details.responsibleName.length > 120 || typeof saved.details?.responsibleAttending !== "boolean" || typeof saved.details?.phone !== "string" || !isMobilePhone(saved.details.phone) || saved.details?.code !== saved.receipt.code || !names(saved.details.children) || !names(saved.details.guardians)) return;
      setReceipt(saved.receipt); setCardDetails(saved.details); onConfirmationChange(true);
    } catch { /* The card can still be downloaded when session storage is unavailable. */ }
  }, [onConfirmationChange]);

  function moveTo(next: number) {
    setError(""); setStep(next);
    requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start" }); });
  }
  function updateChild(index: number, changes: Partial<ChildDraft>) {
    setChildren(current => current.map((person, i) => i === index ? { ...person, ...changes } : person));
  }
  function validateChildren() {
    if (children.some(person => person.fullName.trim().length < 3 || !isBirthDate(parseBirthDate(person.birthDate)))) return "Preencha o nome completo e uma data de nascimento válida para cada criança.";
    if (children.some(person => !CHILD_AFFILIATIONS.includes(person.affiliation as ChildAffiliation))) return "Selecione o vínculo de cada criança: Sócio COD ou Escola de Atletismo.";
    const keys = children.map(person => normalizeName(person.fullName) + person.birthDate);
    if (new Set(keys).size !== keys.length) return "Uma criança aparece duas vezes. Confira os nomes e as datas.";
    return "";
  }
  function validateGuardian() {
    if (guardian.fullName.trim().length < 3 || !isBirthDate(parseBirthDate(guardian.birthDate))) return "Preencha o nome completo e uma data de nascimento válida do responsável.";
    if (!isMobilePhone(phone)) return "Informe o celular com DDD e 9 dígitos. Exemplo: (11) 99999-9999.";
    return "";
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = step === 0 ? validateChildren() : step === 1 ? validateGuardian() : validateChildren() || validateGuardian();
    if (issue) { setError(issue); return; }
    if (step < 2) { moveTo(step + 1); return; }
    if (!confirmed) { setError("Confirme os dados para reservar as vagas."); return; }
    const payload = {
      phone, guardians: [{ ...guardian, birthDate: parseBirthDate(guardian.birthDate) }],
      children: children.map(child => ({ ...child, birthDate: parseBirthDate(child.birthDate), affiliation: child.affiliation as ChildAffiliation, guardianKeys: ["primary"] })),
      question, confirmed,
    };
    const fingerprint = JSON.stringify(payload);
    if (!request.current || request.current.fingerprint !== fingerprint) request.current = { id: crypto.randomUUID(), fingerprint };
    setSubmitting(true); setError("");
    try {
      const body: RegistrationInput = { ...payload, requestId: request.current.id };
      const response = await fetch("/api/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as RegistrationReceipt & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a inscrição.");
      const details = { code: result.code, responsibleName: guardian.fullName.trim(), responsibleAttending: guardian.attending, phone, children: children.map(child => child.fullName.trim()), guardians: guardian.attending ? [guardian.fullName.trim()] : [] };
      setCardDetails(details); setReceipt(result);
      try { sessionStorage.setItem(receiptStorage, JSON.stringify({ at: Date.now(), receipt: result, details })); } catch { /* Download remains available. */ }
      onConfirmationChange(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sem conexão no momento. Tente novamente."); }
    finally { setSubmitting(false); }
  }
  function reset() {
    setGuardian(primary()); setChildren([newChild()]); setPhone(""); setQuestion("");
    setConfirmed(true); setReceipt(null); setCardDetails(null); setError(""); setStep(0); request.current = null;
    try { sessionStorage.removeItem(receiptStorage); } catch { /* No stored card. */ }
    onConfirmationChange(false);
    requestAnimationFrame(() => document.getElementById("inscricao")?.scrollIntoView({ block: "start" }));
  }
  if (receipt && cardDetails) return <ConfirmationCard brands={brands} receipt={receipt} details={cardDetails} onReset={reset} />;

  return <div className="registration-panel child-first-form">
    <div className="form-intro"><h2>Inscreva a criança</h2><p>Primeiro a criança. Depois, um responsável. Por fim, seu cartão.</p></div>
    <nav className="form-progress" aria-label="Etapas da inscrição">{steps.map((label, index) => <button key={label} type="button" className={step === index ? "active" : step > index ? "done" : ""} aria-current={step === index ? "step" : undefined} disabled={index > step || submitting} onClick={() => moveTo(index)}><span>{step > index ? <Check size={15} /> : "0" + (index + 1)}</span>{label}</button>)}</nav>
    <form onSubmit={submit}>
      <fieldset disabled={submitting} className="form-fieldset">
        <div className="step-heading"><h3 ref={heading} tabIndex={-1}>{["Quem vai participar?", "Quem é o responsável?", "Confira e confirme"][step]}</h3><p>{["Preencha os dados da criança ou jovem e selecione seu vínculo.", "Um responsável por criança. Preencha uma vez para todas as crianças desta inscrição.", "Confira as crianças, o responsável e o contato antes de reservar."][step]}</p></div>
        {step === 0 && <div className="step-content">
          {children.map((child, index) => {
            const age = isBirthDate(parseBirthDate(child.birthDate)) ? ageAtEvent(parseBirthDate(child.birthDate)) : null;
            return <section className="person-card" key={index} aria-label={"Criança ou jovem " + (index + 1)}>
              <div className="person-card-heading"><span className="person-icon child-icon">{String(index + 1).padStart(2, "0")}</span><strong>Criança ou jovem {index + 1}</strong>{children.length > 1 && <button type="button" className="icon-button" onClick={() => setChildren(current => current.filter((_, i) => i !== index))} aria-label={"Remover criança " + (index + 1)}><Trash2 size={17} /></button>}</div>
              <div className="field"><label htmlFor={"child-name-" + index}>Nome completo da criança <span>*</span></label><input id={"child-name-" + index} value={child.fullName} onChange={e => updateChild(index, { fullName: e.target.value })} onInput={e => updateChild(index, { fullName: e.currentTarget.value })} placeholder="Nome da criança ou jovem" maxLength={120} autoComplete="off" required /></div>
              <BirthField id={"child-birth-" + index} value={child.birthDate} onChange={value => updateChild(index, { birthDate: value })} />
              {age !== null && (age < 8 || age > 16) && <p className="age-note">A programação foi pensada para participantes de <strong>8 a 16 anos</strong>. Para alinhar esta participação, <a href={MARIO_WHATSAPP} target="_blank" rel="noreferrer">fale com Mario Ferrari</a>.</p>}
              <div className="field affiliation-field"><label htmlFor={"child-affiliation-" + index}>Vínculo da criança <span>*</span></label><select id={"child-affiliation-" + index} value={child.affiliation} onChange={e => updateChild(index, { affiliation: e.target.value as ChildAffiliation })} onInput={e => updateChild(index, { affiliation: e.currentTarget.value as ChildAffiliation })} required aria-describedby={"affiliation-help-" + index}><option value="" disabled>Selecione uma opção</option><option value="cod">Sócio COD</option><option value="athletics">Escola de Atletismo</option></select><small id={"affiliation-help-" + index}>Selecione onde esta criança participa.</small></div>
            </section>;
          })}
          {children.length < 10 && <button className="add-person" type="button" onClick={() => setChildren(current => [...current, newChild()])}><span><Plus size={20} /></span><div><strong>Adicionar outra criança</strong><small>Para irmãos ou crianças que terão o mesmo responsável.</small></div><ArrowRight size={18} /></button>}
          <div className="inline-note"><UsersRound size={18} /><span>Os dados do responsável serão preenchidos <strong>uma única vez</strong>, na próxima etapa.</span></div>
        </div>}
        {step === 1 && <div className="step-content">
          <div className="guardian-children-note"><span className="eyebrow">RESPONSÁVEL POR {children.length === 1 ? "ESTA CRIANÇA" : "ESTAS CRIANÇAS"}</span><p>{children.map(child => child.fullName.trim()).join(" · ")}</p></div>
          <section className="person-card">
            <div className="person-card-heading"><span className="person-icon"><UserRound size={18} /></span><strong>Responsável pela inscrição</strong><span className="single-guardian-label">Cadastro único</span></div>
            <div className="field"><label htmlFor="primary-name">Nome completo do responsável <span>*</span></label><input id="primary-name" value={guardian.fullName} onChange={e => setGuardian(current => ({ ...current, fullName: e.target.value }))} onInput={e => { const value = e.currentTarget.value; setGuardian(current => ({ ...current, fullName: value })); }} autoComplete="name" placeholder="Como está no documento" maxLength={120} required /></div>
            <BirthField id="primary-birth" value={guardian.birthDate} onChange={value => setGuardian(current => ({ ...current, birthDate: value }))} />
            <div className="field"><label htmlFor="main-phone">WhatsApp com DDD <span>*</span></label><input id="main-phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(maskMobilePhone(e.target.value))} onInput={e => setPhone(maskMobilePhone(e.currentTarget.value))} autoComplete="tel-national" placeholder="(11) 99999-9999" maxLength={15} minLength={15} title="Celular com DDD: (11) 99999-9999" required aria-describedby="phone-hint" /><small id="phone-hint">Digite o DDD e os 9 números do celular. O formato é automático.</small></div>
            <label className="check-row"><input type="checkbox" checked={guardian.attending} onChange={e => setGuardian(current => ({ ...current, attending: e.target.checked }))} /><span>Também vou acompanhar o encontro.<small>Marque para reservar sua vaga de acompanhante.</small></span></label>
          </section>
          <div className="inline-note"><ShieldCheck size={18} /><span>Este será o único responsável vinculado a {children.length === 1 ? "esta criança" : "todas as crianças acima"}. Cada responsável é contado apenas uma vez.</span></div>
        </div>}
        {step === 2 && <div className="step-content">
          <div className="review-total"><UsersRound size={24} /><div><strong>{peopleCount} {peopleCount === 1 ? "pessoa" : "pessoas"} no encontro</strong><span>{children.length} {children.length === 1 ? "criança / jovem" : "crianças / jovens"}{accompanying ? " e 1 responsável acompanhante" : " · sem acompanhante presencial"}</span></div></div>
          <section className="review-section"><div className="review-heading"><h4>{children.length === 1 ? "Criança ou jovem" : "Crianças e jovens"}</h4><button type="button" onClick={() => moveTo(0)}>Editar</button></div>{children.map((child, index) => <div className="review-person" key={index}><span className="small-check"><Check size={13} /></span><div><strong>{child.fullName}</strong><small>{formatBirthDate(parseBirthDate(child.birthDate))} · {ageAtEvent(parseBirthDate(child.birthDate))} anos no encontro</small><small className="review-affiliation">{affiliationLabel(child.affiliation as ChildAffiliation)}</small></div></div>)}</section>
          <section className="review-section"><div className="review-heading"><h4>Responsável</h4><button type="button" onClick={() => moveTo(1)}>Editar</button></div><div className="review-person"><span className="small-check"><Check size={13} /></span><div><strong>{guardian.fullName}</strong><small>{formatBirthDate(parseBirthDate(guardian.birthDate))} · {guardian.attending ? "Vai acompanhar o encontro" : "Contato da família · não irá ao encontro"}</small><small>Vinculado a {children.length === 1 ? "1 criança" : children.length + " crianças"}</small></div></div><div className="review-phone">WhatsApp <strong>{formatPhone(phone)}</strong></div></section>
          <div className="field"><label htmlFor="question">Alguma dúvida ou dificuldade? <em>Opcional</em></label><textarea id="question" rows={4} value={question} onChange={e => setQuestion(e.target.value)} onInput={e => setQuestion(e.currentTarget.value)} placeholder="Conte o que a organização precisa saber para receber bem sua família." maxLength={1500} /><small>{question.length}/1.500 caracteres</small></div>
          <label className="check-row consent-row"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} onInput={e => setConfirmed(e.currentTarget.checked)} required /><span>Confirmo os dados e sou responsável pela inscrição {children.length === 1 ? "desta criança" : "destas crianças"}.</span></label>
          <p className="privacy-note"><ShieldCheck size={16} />Os dados serão usados pela organização para preparar o encontro, enviar orientações pelo WhatsApp e registrar a presença dos participantes.</p>
        </div>}
        {error && <div className="form-error" role="alert"><CircleAlert size={19} /><span>{error}</span></div>}
        <div className="form-actions">{step > 0 && <button type="button" className="button secondary" onClick={() => moveTo(step - 1)}><ArrowLeft size={17} />Voltar</button>}<button type="submit" className="button primary grow" disabled={submitting}>{submitting ? <><LoaderCircle size={18} className="spin" />Enviando inscrição…</> : step === 2 ? <>Confirmar inscrição <CircleCheck size={18} /></> : <>{step === 0 ? "Continuar para responsável" : "Revisar e confirmar"}<ArrowRight size={18} /></>}</button></div>
        <p className="form-footnote">{step === 2 ? "Após confirmar, seu cartão com QR Code aparecerá nesta tela para baixar no celular." : "Campos com * são obrigatórios. Você poderá revisar tudo antes de enviar."}</p>
      </fieldset>
    </form>
  </div>;
}
