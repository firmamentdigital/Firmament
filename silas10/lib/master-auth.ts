import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { z } from "zod";
import { AppError, requireSameOrigin } from "./http";
import { randomSecret, secretHash, verifyPassword } from "./guest-password";

const SESSION_TTL = 8 * 3600;
const REMEMBER_TTL = 30 * 24 * 3600;
const WINDOW = 15 * 60;
const loginInput = z.object({
  login: z.string().trim().min(1, "Informe seu login.").max(64),
  password: z.string().min(1, "Informe sua senha.").max(128),
  remember: z.boolean().default(false),
});

// VPS: aceita também "pbkdf2-sha256:100000:sal:hash" (gerado por scripts/owner-password.mjs),
// porque arquivos .env expandem "$" e corromperiam o formato original.
function masterPasswordHash() {
  const value = env.MASTER_PASSWORD_HASH?.trim() || "";
  const colon = /^pbkdf2-sha256:100000:([a-f0-9]{32}):([a-f0-9]{64})$/.exec(value);
  return colon ? ["pbkdf2-sha256", "100000", colon[1], colon[2]].join("$") : value;
}

export function masterConfigured() {
  return Boolean(env.MASTER_LOGIN?.trim() && /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(masterPasswordHash()));
}

function database() {
  if (!env.DB || !masterConfigured()) throw new AppError(503, "O acesso master ainda está sendo configurado. Tente novamente em instantes.");
  return env.DB;
}

function tokenFromCookie(cookie: string) {
  return /(?:^|;\s*)__Host-silas_master=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1]
    || (process.env.NODE_ENV !== "production" ? /(?:^|;\s*)silas_master_local=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1] : null)
    || null;
}

function masterCookie(request: Request, token: string, maxAge?: number) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  if (!secure && (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(url.hostname))) throw new AppError(400, "Use o endereço seguro do evento para entrar.");
  return `${secure ? "__Host-silas_master" : "silas_master_local"}=${token}; Path=/; HttpOnly; SameSite=Lax${maxAge !== undefined ? "; Max-Age=" + maxAge : ""}${secure ? "; Secure" : ""}`;
}

export function requireMasterOrigin(request: Request) {
  if (!request.headers.get("origin")) throw new AppError(403, "Entre pelo formulário de acesso.");
  requireSameOrigin(request);
}

async function credentialFingerprint() {
  return secretHash(env.MASTER_LOGIN!.trim().toLowerCase() + ":" + masterPasswordHash());
}

export async function readMasterSession() {
  if (!env.DB || !masterConfigured()) return null;
  const token = tokenFromCookie((await headers()).get("cookie") || "");
  if (!token) return null;
  const hash = await secretHash(token);
  const row = await env.DB.prepare("SELECT token_hash FROM master_sessions WHERE token_hash=? AND credential_fingerprint=? AND expires_at>?")
    .bind(hash, await credentialFingerprint(), Math.floor(Date.now() / 1000)).first<{ token_hash: string }>();
  if (!row) return null;
  return {
    userId: "master_" + await secretHash(env.MASTER_LOGIN!.trim().toLowerCase()),
    email: env.OWNER_EMAIL?.trim().toLowerCase() || "",
    displayName: env.MASTER_LOGIN!.trim(),
    fullName: env.MASTER_LOGIN!.trim(),
  };
}

export async function loginMaster(request: Request, raw: unknown) {
  const input = loginInput.parse(raw);
  const db = database();
  const now = Math.floor(Date.now() / 1000);
  const normalizedLogin = input.login.toLowerCase();
  const keys = [{ key: "master:account:" + await secretHash(normalizedLogin), limit: 5 }];
  const ip = request.headers.get("cf-connecting-ip");
  if (ip && /^[a-fA-F0-9.:]{3,64}$/.test(ip)) keys.push({ key: "master:ip:" + await secretHash(ip), limit: 50 });
  for (const key of keys) {
    const row = await db.prepare("SELECT failures, window_started FROM guest_login_attempts WHERE key=?").bind(key.key).first<{ failures: number; window_started: number }>();
    if (row && row.window_started > now - WINDOW && row.failures >= key.limit) throw new AppError(429, "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.");
  }
  // Always derive the password, including for a different login name.
  const matches = await verifyPassword(input.password, masterPasswordHash());
  if (normalizedLogin !== env.MASTER_LOGIN!.trim().toLowerCase() || !matches) {
    await db.batch([
      db.prepare("DELETE FROM guest_login_attempts WHERE window_started<?").bind(now - WINDOW * 2),
      ...keys.map(key => db.prepare(`INSERT INTO guest_login_attempts (key, failures, window_started) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN window_started<=? THEN 1 ELSE failures+1 END,
        window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END`).bind(key.key, now, now - WINDOW, now - WINDOW)),
    ]);
    throw new AppError(401, "Login ou senha incorretos.");
  }
  const token = randomSecret();
  const ttl = input.remember ? REMEMBER_TTL : SESSION_TTL;
  const cookie = masterCookie(request, token, input.remember ? ttl : undefined);
  await db.batch([
    db.prepare("DELETE FROM master_sessions WHERE expires_at<=? OR credential_fingerprint<>?").bind(now, await credentialFingerprint()),
    db.prepare("INSERT INTO master_sessions (token_hash, credential_fingerprint, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await secretHash(token), await credentialFingerprint(), now, now + ttl),
    ...keys.map(key => db.prepare("DELETE FROM guest_login_attempts WHERE key=?").bind(key.key)),
  ]);
  return { cookie };
}

export async function logoutMaster(request: Request) {
  const token = tokenFromCookie(request.headers.get("cookie") || "");
  if (token && env.DB) await env.DB.prepare("DELETE FROM master_sessions WHERE token_hash=?").bind(await secretHash(token)).run();
  return masterCookie(request, "", 0);
}
