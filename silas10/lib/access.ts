import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError } from "./http";
import { isAdminEmail } from "./admin-config";
import { hashPassword, randomSecret, secretHash } from "./guest-password";
import { INVITE_TTL } from "./guest-auth";
export type AccessMember = { email: string; active: boolean; activatedAt: string | null; createdAt: string; version: number; passwordReady: boolean };
export type GuestInvitation = { email: string; token: string | null; expiresAt: number | null; initialPassword: boolean };
export async function listMembers(): Promise<AccessMember[]> {
  const rows = await env.DB!.prepare("SELECT email, active, activated_at, created_at, version, password_changed_at FROM admin_members ORDER BY active DESC, email").all<{ email: string; active: number; activated_at: string | null; created_at: string; version: number; password_changed_at: string | null }>();
  return rows.results.map(row => ({ email: row.email, active: Boolean(row.active), activatedAt: row.activated_at, createdAt: row.created_at, version: row.version, passwordReady: Boolean(row.password_changed_at) }));
}
const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
export async function prepareInvitation(raw: unknown) {
  const { email, version, reset } = z.object({ email: emailSchema, version: z.number().int().nonnegative(), reset: z.boolean().default(false) }).parse(raw);
  if (isAdminEmail(email)) throw new AppError(422, "O proprietário entra com seu próprio perfil do ChatGPT.");
  const row = await env.DB!.prepare("SELECT active, version, password_changed_at FROM admin_members WHERE email=?").bind(email).first<{ active: number; version: number; password_changed_at: string | null }>();
  if (!row || row.active !== 1) throw new AppError(422, "Autorize o e-mail antes de preparar o convite.");
  if (row.version !== version) throw new AppError(409, "O acesso mudou. Atualize a lista de convidados.");
  let invitation: GuestInvitation = { email, token: null, expiresAt: null, initialPassword: false };
  if (!row.password_changed_at || reset) {
    const token = randomSecret(); const inviteHash = await secretHash(token); const passwordHash = await hashPassword("123456"); const expiresAt = Math.floor(Date.now() / 1000) + INVITE_TTL;
    const results = await env.DB!.batch([
      env.DB!.prepare("UPDATE admin_members SET password_hash=?, password_version=password_version+1, password_changed_at=NULL, invite_hash=?, invite_expires_at=?, version=version+1 WHERE email=? AND active=1 AND version=?")
        .bind(passwordHash, inviteHash, expiresAt, email, version),
      env.DB!.prepare("DELETE FROM guest_sessions WHERE member_email=? AND EXISTS (SELECT 1 FROM admin_members WHERE email=? AND invite_hash=?)").bind(email, email, inviteHash),
      env.DB!.prepare("DELETE FROM guest_login_attempts WHERE key=?").bind("email:" + await secretHash(email)),
    ]);
    if (!results[0].meta.changes) throw new AppError(409, "O acesso mudou. Atualize a lista e tente novamente.");
    invitation = { email, token, expiresAt, initialPassword: true };
  }
  return { members: await listMembers(), invitation };
}
export async function grantMember(raw: unknown, userId: string) {
  const { email } = z.object({ email: emailSchema }).parse(raw);
  if (isAdminEmail(email)) throw new AppError(422, "Seu perfil já é o proprietário da gestão.");
  const existing = await env.DB!.prepare("SELECT active FROM admin_members WHERE email=?").bind(email).first<{ active: number }>();
  const count = await env.DB!.prepare("SELECT COUNT(*) AS n FROM admin_members WHERE active=1").first<{ n: number }>();
  if (existing?.active !== 1 && (count?.n || 0) >= 20) throw new AppError(422, "Revogue um acesso antes de incluir outra pessoa. Limite: 20 acessos ativos.");
  await env.DB!.prepare("INSERT INTO admin_members (email, active, created_at, created_by) VALUES (?, 1, ?, ?) ON CONFLICT(email) DO UPDATE SET active=1, revoked_at=NULL, version=admin_members.version+1")
    .bind(email, new Date().toISOString(), userId).run();
  const member = (await listMembers()).find(m => m.email === email)!;
  return prepareInvitation({ email, version: member.version, reset: false });
}
export async function revokeMember(raw: unknown) {
  const { email, version } = z.object({ email: emailSchema, version: z.number().int().nonnegative() }).parse(raw);
  if (isAdminEmail(email)) throw new AppError(422, "O acesso do proprietário não pode ser removido.");
  const results = await env.DB!.batch([
    env.DB!.prepare("UPDATE admin_members SET active=0, revoked_at=?, password_version=password_version+1, invite_hash=NULL, invite_expires_at=NULL, version=version+1 WHERE email=? AND version=?").bind(new Date().toISOString(), email, version),
    env.DB!.prepare("DELETE FROM guest_sessions WHERE member_email=? AND EXISTS (SELECT 1 FROM admin_members WHERE email=? AND active=0)").bind(email, email),
  ]);
  if (!results[0].meta.changes) throw new AppError(409, "O acesso mudou em outra tela. Atualize a lista.");
  return listMembers();
}
