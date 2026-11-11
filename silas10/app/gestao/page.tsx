import { ArrowLeft, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { AppError } from "@/lib/http";
import Management from "./management";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gestão · Silas 10", robots: { index: false, follow: false } };
export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ inscricao?: string | string[] }> }) {
  const params = await searchParams;
  const candidate = typeof params.inscricao === "string" ? params.inscricao.toUpperCase() : "";
  const code = /^S10-[A-F0-9]{10}$/.test(candidate) ? candidate : "";
  const returnTo = code ? "/gestao?inscricao=" + encodeURIComponent(code) : "/gestao";
  const guestPath = "/gestao/convidado" + (code ? "?inscricao=" + encodeURIComponent(code) : "");
  let admin: AdminUser | null = null;
  try { admin = await requireAdmin(); }
  catch (error) { if (!(error instanceof AppError) || ![401, 403].includes(error.status)) throw error; }
  if (!admin) {
    const nativeUser = await getChatGPTUser();
    return <main className="access-shell"><a className="back-link" href="/"><ArrowLeft size={16} />Voltar à inscrição</a><div className="access-card"><img src="/assets/silas-signature.png" alt="Silas 10" width="190" height="121" /><div className="access-icon"><LockKeyhole size={24} /></div><span className="eyebrow">GESTÃO DO ENCONTRO</span><h1>{code ? "Receba esta família." : "A organização começa aqui."}</h1><p>Convidados entram com o e-mail autorizado e sua senha. Escolha seu acesso abaixo.</p>{code && <div className="gate-family-code"><small>CÓDIGO DA FAMÍLIA</small><strong>{code}</strong></div>}<a className="button primary full" href={guestPath}><Mail size={18} />Sou convidado · Entrar com e-mail</a><a className="button secondary full owner-login-choice" target="_top" href={nativeUser ? chatGPTSignOutPath(returnTo) : chatGPTSignInPath(returnTo)}>Sou o organizador · Entrar com ChatGPT<ArrowRight size={16} /></a></div></main>;
  }
  return <Management isOwner={admin.role === "owner"} isGuest={admin.authMethod === "password"} userEmail={admin.email} userName={admin.fullName || (admin.role === "owner" ? "Organização" : admin.email)} signOutPath={chatGPTSignOutPath(returnTo)} initialCode={code} />;
}
