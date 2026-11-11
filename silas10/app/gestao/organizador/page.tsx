import { redirect } from "next/navigation";
import { getChatGPTUser, safeRelativeReturnPath } from "@/app/chatgpt-auth";
import GuestLogin from "../convidado/guest-login";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acesso do organizador · Silas 10", robots: { index: false, follow: false } };
export default async function OwnerLoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string | string[] }> }) {
  const params = await searchParams;
  const candidate = safeRelativeReturnPath(typeof params.return_to === "string" ? params.return_to : "/gestao");
  const returnTo = candidate.startsWith("/gestao") ? candidate : "/gestao";
  if (await getChatGPTUser()) redirect(returnTo);
  const guestPath = "/gestao/convidado" + (returnTo.includes("?") ? returnTo.slice(returnTo.indexOf("?")) : "");
  return <GuestLogin mode="owner" initialEmail="" initialSetup={false} returnTo={returnTo} ownerPath={guestPath} />;
}
