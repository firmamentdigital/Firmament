"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
export default function GuestLogin({ initialEmail, initialSetup, returnTo, ownerPath, mode = "guest" }: { initialEmail: string; initialSetup: boolean; returnTo: string; ownerPath: string; mode?: "guest" | "owner" }) {
  const owner = mode === "owner";
  const [email, setEmail] = useState(initialEmail); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [invitation, setInvitation] = useState(""); const [setup, setSetup] = useState(initialSetup); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (owner) return; const token = new URLSearchParams(window.location.hash.slice(1)).get("convite") || ""; if (/^[a-f0-9]{64}$/.test(token)) setInvitation(token); }, [owner]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(owner ? "/api/owner/login" : setup ? "/api/guest/password" : "/api/guest/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(owner ? { email, password } : setup ? { password, confirmation } : { email, password, invitation }) });
      const result = await response.json() as { error?: string; mustChangePassword?: boolean };
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar agora. Tente novamente.");
      if (!owner && !setup && result.mustChangePassword) {
        setSetup(true); setPassword(""); setConfirmation(""); setShow(false); window.history.replaceState(null, "", window.location.pathname + window.location.search);
        requestAnimationFrame(() => heading.current?.focus());
      } else { window.location.replace(returnTo); return; }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sem conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <main className="access-shell guest-access-shell">
    <a className="back-link" href="/"><ArrowLeft size={16} />Voltar à inscrição</a>
    <div className="access-card guest-access-card">
      <img className="guest-access-brand" src="/assets/silas-signature.png" alt="Silas 10" width="190" height="121" />
      <div className="access-icon"><LockKeyhole size={24} /></div><span className="eyebrow">GESTÃO DO ENCONTRO</span>
      <h1 ref={heading} tabIndex={-1}>{owner ? "Acesso do organizador." : setup ? "Crie sua senha." : "Bom ter você no time."}</h1>
      <p>{owner ? "Entre com o e-mail e a senha do organizador do encontro." : setup ? "Só desta vez: troque a senha inicial por uma senha sua para concluir o acesso." : "Entre com o e-mail autorizado e sua senha."}</p>
      <form className="guest-login-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          {setup ? <div className="guest-email-summary"><Mail size={16} /><span>{email}</span></div> : <div className="field"><label htmlFor="guest-email">Seu e-mail</label><input id="guest-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} onInput={e => setEmail(e.currentTarget.value)} placeholder="seuemail@exemplo.com" maxLength={254} required autoCapitalize="none" spellCheck={false} /></div>}
          <div className="field"><label htmlFor="guest-password">{setup ? "Nova senha" : "Senha"}</label><div className="guest-password-input"><input id="guest-password" type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onInput={e => setPassword(e.currentTarget.value)} autoComplete={setup ? "new-password" : "current-password"} minLength={setup ? 8 : 1} maxLength={128} placeholder={setup ? "Crie uma senha sua" : "Digite sua senha"} required aria-describedby="guest-password-help" /><button type="button" className="icon-button" onClick={() => setShow(v => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small id="guest-password-help">{owner ? "Senha definida na configuração do servidor." : setup ? "Use pelo menos 8 caracteres. Não precisa de símbolos especiais." : invitation ? "Primeiro acesso: use a senha inicial informada no convite." : "No primeiro acesso, abra o link que recebeu por e-mail."}</small></div>
          {setup && <div className="field"><label htmlFor="guest-confirmation">Repita a nova senha</label><input id="guest-confirmation" type={show ? "text" : "password"} value={confirmation} onChange={e => setConfirmation(e.target.value)} onInput={e => setConfirmation(e.currentTarget.value)} autoComplete="new-password" maxLength={128} required placeholder="Digite a mesma senha novamente" /></div>}
          {error && <div className="form-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
          <button type="submit" className="button primary full guest-submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}{busy ? "Só um instante…" : setup ? "Salvar senha e entrar" : "Entrar na gestão"}</button>
        </fieldset>
      </form>
      <p className="guest-access-help">{owner ? "Esqueceu a senha? Gere uma nova no servidor com o script de senha do organizador." : setup ? "Nos próximos acessos, você usará apenas seu e-mail e essa nova senha." : "Esqueceu a senha ou o convite venceu? Peça um novo convite à organização."}</p>
      <a className="guest-owner-link" href={ownerPath} target="_top">{owner ? "Sou convidado · Entrar com e-mail" : "Sou o organizador · Entrar como organizador"} <ArrowRight size={14} /></a>
    </div>
  </main>;
}
