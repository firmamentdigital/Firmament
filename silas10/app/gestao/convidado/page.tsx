import { redirect } from "next/navigation";
import { readGuestSession } from "@/lib/guest-auth";
import GuestLogin from "./guest-login";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acesso do convidado · Silas 10", robots: { index: false, follow: false } };
export default async function GuestLoginPage({ searchParams }: { searchParams: Promise<{ email?: string | string[]; inscricao?: string | string[] }> }) {
  const params = await searchParams;
  const email = typeof params.email === "string" && params.email.length <= 254 ? params.email.trim() : "";
  const code = typeof params.inscricao === "string" && /^S10-[A-F0-9]{10}$/.test(params.inscricao) ? params.inscricao : "";
  const returnTo = code ? "/gestao?inscricao=" + encodeURIComponent(code) : "/gestao";
  const session = await readGuestSession();
  if (session?.phase === "ready") redirect(returnTo);
  return <GuestLogin initialEmail={session?.email || email} initialSetup={session?.phase === "setup"} returnTo={returnTo} ownerPath={returnTo} />;
}
