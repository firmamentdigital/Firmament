import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { z } from "zod";
import { AppError, requireSameOrigin } from "./http";
import { isAdminEmail, ownerConfigured } from "./admin-config";
import { hashPassword, randomSecret, secretHash, verifyPassword } from "./guest-password";

const SESSION_TTL = 8 * 3600;
const SETUP_TTL = 20 * 60;
const WINDOW = 15 * 60;
export const INVITE_TTL = 7 * 24 * 3600;
const emailInput = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
const loginInput = z.object({ email: emailInput, password: z.string().min(1, "Informe a senha.").max(128), invitation: z.string().max(64).optional().default("") });
export type GuestSession = { hash: string; email: string; phase: "setup" | "ready"; credentialVersion: number; userId: string };
function database() { if (!env.DB || !ownerConfigured()) throw new AppError(503, "O acesso está sendo preparado. Tente novamente em instantes."); return env.DB; }
function tokenFromCookie(cookie: string) {
  const production = /(?:^|;\s*)__Host-silas_guest=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1];
  return production || (process.env.NODE_ENV !== "production" ? /(?:^|;\s*)silas_guest_local=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1] : null) || null;
}
export function guestCookieSecure(request: Request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  if (process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost"].includes(url.hostname)) return false;
  throw new AppError(400, "Use o endereço seguro do evento para entrar.");
}
function cookieName(request: Request) { return guestCookieSecure(request) ? "__Host-silas_guest" : "silas_guest_local"; }
export function guestCookie(request: Request, token: string, maxAge: number) {
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function requireGuestOrigin(request: Request) { if (!request.headers.get("origin")) throw new AppError(403, "Entre pelo formulário de acesso."); requireSameOrigin(request); }
export async function readGuestSession(): Promise<GuestSession | null> {
  const token = tokenFromCookie((await headers()).get("cookie") || "");
  if (!token || !env.DB || !ownerConfigured()) return null;
  const hash = await secretHash(token); const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`SELECT s.member_email, s.phase, s.credential_version FROM guest_sessions s
    JOIN admin_members m ON m.email=s.member_email WHERE s.token_hash=? AND s.expires_at>? AND m.active=1
    AND s.credential_version=m.password_version AND (s.phase='setup' OR m.password_changed_at IS NOT NULL)`)
    .bind(hash, now).first<{ member_email: string; phase: "setup" | "ready"; credential_version: number }>();
  if (!row || isAdminEmail(row.member_email)) return null;
  return { hash, email: row.member_email, phase: row.phase, credentialVersion: row.credential_version, userId: "guest_" + await secretHash(row.member_email) };
}
async function attemptKeys(request: Request, email: string) {
  const keys = [{ key: "email:" + await secretHash(email), limit: 5 }];
  const ip = request.headers.get("cf-connecting-ip");
  if (ip && /^[a-fA-F0-9.:]{3,64}$/.test(ip)) keys.push({ key: "ip:" + await secretHash(ip), limit: 50 });
  return keys;
}
export async function loginGuest(request: Request, raw: unknown) {
  const input = loginInput.parse(raw); const db = database(); const now = Math.floor(Date.now() / 1000);
  const keys = await attemptKeys(request, input.email);
  for (const key of keys) {
    const attempts = await db.prepare("SELECT failures, window_started FROM guest_login_attempts WHERE key=?").bind(key.key).first<{ failures: number; window_started: number }>();
    if (attempts && attempts.window_started > now - WINDOW && attempts.failures >= key.limit) throw new AppError(429, "Muitas tentativas. Aguarde 15 minutos e tente novamente.");
  }
  const member = await db.prepare("SELECT active, password_hash, password_changed_at, password_version, invite_hash, invite_expires_at FROM admin_members WHERE email=?")
    .bind(input.email).first<{ active: number; password_hash: string | null; password_changed_at: string | null; password_version: number; invite_hash: string | null; invite_expires_at: number | null }>();
  const passwordMatches = await verifyPassword(input.password, member?.password_hash || null);
  const setup = !member?.password_changed_at;
  const invitationHash = /^[a-f0-9]{64}$/.test(input.invitation) ? await secretHash(input.invitation) : "";
  const valid = member?.active === 1 && !isAdminEmail(input.email) && passwordMatches && (!setup || (Boolean(invitationHash) && member.invite_hash === invitationHash && (member.invite_expires_at || 0) > now));
  if (!valid) {
    await db.batch([
      db.prepare("DELETE FROM guest_login_attempts WHERE window_started < ?").bind(now - WINDOW * 2),
      ...keys.map(key => db.prepare(`INSERT INTO guest_login_attempts (key, failures, window_started) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN window_started<=? THEN 1 ELSE failures+1 END,
        window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END`).bind(key.key, now, now - WINDOW, now - WINDOW)),
    ]);
    throw new AppError(401, "E-mail ou senha inválidos. No primeiro acesso, use o link do convite recebido.");
  }
  const token = randomSecret(); const hash = await secretHash(token); const ttl = setup ? SETUP_TTL : SESSION_TTL;
  const results = await db.batch([
    db.prepare("DELETE FROM guest_sessions WHERE expires_at<=?").bind(now),
    db.prepare(`INSERT INTO guest_sessions (token_hash, member_email, phase, credential_version, created_at, expires_at)
      SELECT ?, email, ?, password_version, ?, ? FROM admin_members WHERE email=? AND active=1 AND password_version=? AND password_hash=?
      AND (?=0 OR (invite_hash=? AND invite_expires_at>?))`).bind(hash, setup ? "setup" : "ready", now, now + ttl, input.email, member!.password_version, member!.password_hash, Number(setup), invitationHash, now),
    db.prepare("UPDATE admin_members SET activated_at=COALESCE(activated_at, ?), version=version+1 WHERE email=? AND EXISTS (SELECT 1 FROM guest_sessions WHERE token_hash=?)").bind(new Date().toISOString(), input.email, hash),
    ...keys.map(key => db.prepare("DELETE FROM guest_login_attempts WHERE key=?").bind(key.key)),
  ]);
  if (!results[1].meta.changes) throw new AppError(401, "O acesso foi atualizado. Abra o último convite recebido e tente novamente.");
  return { mustChangePassword: setup, cookie: guestCookie(request, token, ttl) };
}
export async function changeGuestPassword(request: Request, raw: unknown) {
  const session = await readGuestSession();
  if (!session || session.phase !== "setup") throw new AppError(401, "Abra o convite e entre novamente para criar sua senha.");
  const input = z.object({ password: z.string().min(8, "Crie uma senha com pelo menos 8 caracteres.").max(128), confirmation: z.string().max(128) })
    .refine(value => value.password === value.confirmation, "As senhas precisam ser iguais.").parse(raw);
  const passwordHash = await hashPassword(input.password); const db = database(); const now = Math.floor(Date.now() / 1000);
  const token = randomSecret(); const hash = await secretHash(token); const nextVersion = session.credentialVersion + 1;
  const results = await db.batch([
    db.prepare(`UPDATE admin_members SET password_hash=?, password_changed_at=?, password_version=password_version+1,
      invite_hash=NULL, invite_expires_at=NULL, version=version+1 WHERE email=? AND active=1 AND password_version=?
      AND EXISTS (SELECT 1 FROM guest_sessions WHERE token_hash=? AND phase='setup' AND expires_at>?)`)
      .bind(passwordHash, new Date().toISOString(), session.email, session.credentialVersion, session.hash, now),
    db.prepare("DELETE FROM guest_sessions WHERE member_email=? AND EXISTS (SELECT 1 FROM admin_members WHERE email=? AND password_version=? AND password_hash=?)").bind(session.email, session.email, nextVersion, passwordHash),
    db.prepare(`INSERT INTO guest_sessions (token_hash, member_email, phase, credential_version, created_at, expires_at)
      SELECT ?, email, 'ready', password_version, ?, ? FROM admin_members WHERE email=? AND active=1 AND password_version=? AND password_hash=?`)
      .bind(hash, now, now + SESSION_TTL, session.email, nextVersion, passwordHash),
  ]);
  if (!results[0].meta.changes || !results[2].meta.changes) throw new AppError(409, "O convite foi atualizado. Abra o último link recebido e tente novamente.");
  return { cookie: guestCookie(request, token, SESSION_TTL) };
}
export async function logoutGuest(request: Request) {
  const token = tokenFromCookie(request.headers.get("cookie") || "");
  if (token && env.DB) await env.DB.prepare("DELETE FROM guest_sessions WHERE token_hash=?").bind(await secretHash(token)).run();
  return guestCookie(request, "", 0);
}
