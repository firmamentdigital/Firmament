import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { AppError } from "@/lib/http";
import Management from "./management";
import MasterLogin from "./master-login";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gestão · Silas 10", robots: { index: false, follow: false } };
export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ inscricao?: string | string[] }> }) {
  const params = await searchParams;
  const candidate = typeof params.inscricao === "string" ? params.inscricao.toUpperCase() : "";
  const code = /^S10-[A-F0-9]{10}$/.test(candidate) ? candidate : "";
  const returnTo = code ? "/gestao?inscricao=" + encodeURIComponent(code) : "/gestao";
  let admin: AdminUser | null = null;
  try { admin = await requireAdmin(); }
  catch (error) { if (!(error instanceof AppError) || ![401, 403].includes(error.status)) throw error; }
  if (!admin) return <MasterLogin returnTo={returnTo} code={code} />;
  return <Management isOwner={admin.role === "owner"} isGuest={admin.authMethod === "password"} sessionLogoutPath={admin.authMethod === "master" ? "/api/master/logout" : admin.authMethod === "password" ? "/api/guest/logout" : ""} userEmail={admin.email} userName={admin.fullName || (admin.role === "owner" ? "Organização" : admin.email)} signOutPath={chatGPTSignOutPath(returnTo)} initialCode={code} />;
}
