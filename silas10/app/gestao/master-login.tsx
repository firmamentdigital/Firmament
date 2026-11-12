"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

export default function MasterLogin({ returnTo, code = "" }: { returnTo: string; code?: string }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/master/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password, remember }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar. Tente novamente.");
      setPassword(""); window.location.replace(returnTo);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sem conexão. Tente novamente."); }
    finally { setBusy(false); }
  }

  return <main className="access-shell master-access-shell">
    <a className="back-link" href="/"><ArrowLeft size={16} />Voltar à inscrição</a>
    <div className="access-card admin-access-card master-access-card">
      <img className="guest-access-brand" src="/assets/silas-signature.png" alt="Silas 10" width="190" height="121" />
      <span className="eyebrow">ÁREA ADMINISTRATIVA</span>
      <h1>Acesso do administrador</h1>
      <p>Entre com seu login e sua senha para gerenciar o encontro.</p>
      {code && <div className="gate-family-code"><small>CÓDIGO DA FAMÍLIA</small><strong>{code}</strong></div>}
      <form className="guest-login-form master-login-form" method="post" action="/api/master/login" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label className="field" htmlFor="master-login"><span>Login</span><input id="master-login" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={event => setLogin(event.target.value)} onInput={event => setLogin(event.currentTarget.value)} placeholder="Seu login de administrador" maxLength={64} required /></label>
          <div className="field"><label htmlFor="master-password">Senha</label><div className="guest-password-input"><input id="master-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onInput={event => setPassword(event.currentTarget.value)} placeholder="Sua senha" maxLength={128} required /><button className="icon-button" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <label className="check-row master-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>Manter conectado neste dispositivo<small>Seu acesso será lembrado por até 30 dias.</small></span></label>
          {error && <div className="form-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
          <button className="button primary full guest-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <LockKeyhole size={18} />}{busy ? "Entrando…" : "Entrar na gestão"}<ArrowRight size={16} /></button>
        </fieldset>
      </form>
      <div className="admin-access-divider"><span>Equipe convidada</span></div>
      <a className="button secondary full" href={"/gestao/convidado" + (code ? "?inscricao=" + encodeURIComponent(code) : "")}><Mail size={17} />Entrar como convidado</a>
    </div>
  </main>;
}
