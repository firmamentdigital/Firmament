import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { AppError } from "./http";
import { isAdminEmail, ownerConfigured } from "./admin-config";
import { readGuestSession } from "./guest-auth";
export { isAdminEmail } from "./admin-config";
export type AdminUser = ChatGPTUser & { role: "owner" | "manager"; authMethod: "chatgpt" | "password" };
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getChatGPTUser();
  if (!ownerConfigured()) throw new AppError(403, "Esta conta não tem acesso à gestão do encontro.");
  if (!env.DB) throw new AppError(503, "A gestão está sendo preparada. Tente novamente em instantes.");
  if (user && isAdminEmail(user.email)) {
    const email = user.email.trim().toLowerCase();
    // Na VPS o organizador entra por senha (userId fixo "owner"): trocar OWNER_EMAIL
    // no .env atualiza o vínculo sem intervenção manual no banco.
    await env.DB.prepare("INSERT INTO owner_identity (key, user_id, email, bound_at) VALUES ('owner', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET email=excluded.email, bound_at=excluded.bound_at WHERE owner_identity.user_id='owner' AND excluded.user_id='owner'")
      .bind(user.userId, email, new Date().toISOString()).run();
    const bound = await env.DB.prepare("SELECT user_id, email FROM owner_identity WHERE key = 'owner'").first<{ user_id: string; email: string }>();
    if (bound?.user_id === user.userId && bound.email === email) return { ...user, role: "owner", authMethod: "chatgpt" };
    throw new AppError(403, "Esta conta não tem acesso à gestão do encontro.");
  }
  const guest = await readGuestSession();
  if (guest?.phase === "ready") return { userId: guest.userId, email: guest.email, displayName: guest.email, fullName: null, role: "manager", authMethod: "password" };
  if (guest) throw new AppError(403, "Crie sua nova senha para concluir o primeiro acesso.");
  throw new AppError(user ? 403 : 401, user ? "Esta conta não tem acesso à gestão do encontro." : "Entre com seu acesso autorizado para usar a gestão.");
}
export async function requireOwner() {
  const user = await requireAdmin();
  if (user.role !== "owner") throw new AppError(403, "Apenas o proprietário pode autorizar ou revogar acessos.");
  return user;
}
